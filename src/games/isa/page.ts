// ISA Lab page: edit RISC-V assembly, judge it against hidden cases, and step through it in a debugger with registers,
// memory, the machine-code listing and an execution trace.
import { award } from '../../mastery/promotion';
import { mentorSay } from '../../os/mentor';
import { clearDraft, levelRecord, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { editor } from '../../ui/editor';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { rng } from '../../sim/harness';
import { AsmError, assemble, MNEMONICS, REG_NAMES, type Program } from './asm';
import { evaluate, setupMachine, SENTINEL, type Evaluation } from './check';
import { findIsaLevel } from './levels';
import { Machine, STACK_TOP } from './sim';

export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PSEUDO = ['nop', 'li', 'la', 'mv', 'not', 'neg', 'seqz', 'snez', 'sltz', 'sgtz', 'beqz', 'bnez', 'blez', 'bgez', 'bltz', 'bgtz', 'bgt', 'ble', 'bgtu', 'bleu', 'j', 'jr', 'ret', 'call', 'tail'];
const OPSET = new Set([...MNEMONICS, ...PSEUDO]);
const REGSET = new Set([...REG_NAMES, ...Array.from({ length: 32 }, (_, i) => `x${i}`), 'fp']);

export function highlightAsm(src: string): string {
  return src.split('\n').map((line) => {
    const ci = (() => { let q = ''; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === q) q = ''; continue; } if (c === '"' || c === "'") q = c; else if (c === '#' || c === ';') return i; } return -1; })();
    const code = ci < 0 ? line : line.slice(0, ci);
    const com = ci < 0 ? '' : `<span class="tk-com">${esc(line.slice(ci))}</span>`;
    const body = esc(code).replace(/^(\s*)([A-Za-z_.$][\w.$]*:)/, '$1<span class="tk-sys">$2</span>')
      .replace(/(^|[\s,(])([A-Za-z_.%][\w.$%]*)(?=$|[\s,()])/g, (m, pre: string, w: string) => (w.startsWith('.') ? `${pre}<span class="tk-kw">${w}</span>` : OPSET.has(w.toLowerCase()) ? `${pre}<span class="tk-kw">${w}</span>` : REGSET.has(w.toLowerCase()) ? `${pre}<span class="tk-sys">${w}</span>` : m))
      .replace(/(^|[\s,(])(-?(?:0x[0-9a-fA-F]+|\d+))(?=$|[\s,()])/g, '$1<span class="tk-num">$2</span>');
    return body + com;
  }).join('\n') + '\n';
}

const hx = (v: number) => `0x${(v >>> 0).toString(16).padStart(8, '0')}`;

export function isaPage(id: string): HTMLElement {
  const level = findIsaLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `isa.${level.id}.seed`;
  let seed = loadDraft<number>(seedKey);
  if (seed === undefined) { seed = Math.floor(Math.random() * 1e6) + 1; saveDraft(seedKey, seed); }
  const inst = level.build(rng(seed));
  const draftKey = `isa.${level.id}.${seed}`;
  const usage = loadDraft<{ hints: number }>(`${draftKey}.usage`) ?? { hints: 0 };
  const saveUsage = () => saveDraft(`${draftKey}.usage`, usage);

  const ed = editor(loadDraft<string>(draftKey) ?? inst.starter, (v) => saveDraft(draftKey, v), () => check(false), { highlight: highlightAsm, label: 'RISC-V assembly' });

  const hintList = h('ol', { class: 'hints' });
  const hintBtn = h('button', { class: 'btn ghost small', onclick: () => reveal() }, '');
  const renderHints = () => {
    hintList.replaceChildren(...inst.hints.slice(0, usage.hints).map((t) => h('li', { html: t })));
    hintBtn.textContent = usage.hints >= inst.hints.length ? 'No more hints' : `Reveal a hint (${inst.hints.length - usage.hints} left, caps you at 2 stars)`;
    (hintBtn as HTMLButtonElement).disabled = usage.hints >= inst.hints.length;
  };
  const reveal = () => {
    usage.hints = Math.min(inst.hints.length, usage.hints + 1);
    saveUsage();
    renderHints();
    mentorSay(`Hint: ${inst.hints[usage.hints - 1].replace(/<[^>]+>/g, '')}`, 'thinking');
  };
  renderHints();

  const brief = h('aside', { class: 'brief panel' },
    h('div', { class: 'tag' }, `ISA Lab · ${level.concept}`),
    h('p', { class: 'dim small' }, level.ticket),
    h('div', { class: 'brief-body', html: inst.brief }),
    inst.fixed ? h('details', { class: 'src-view' }, h('summary', null, 'Provided code (appended after yours)'), h('pre', { class: 'ed-hl src', html: highlightAsm(inst.fixed) })) : '',
    boss ? h('p', { class: 'dim small' }, 'Boss mission: no hints, hidden cases. A new variant picks a different routine.') : '',
    inst.hints.length ? h('div', { class: 'hint-box' }, hintBtn, hintList) : '',
  );

  // ---- results
  const status = h('div', { class: 'status idle' }, 'Check assembles your code and runs every case. Submit also banks the result.');
  const goalList = h('ul', { class: 'goals' });
  const show = (ev: Evaluation) => {
    goalList.replaceChildren(...ev.goals.map((g) => h('li', { class: g.ok ? 'ok' : 'bad' }, h('span', { class: 'mark' }, g.ok ? '✓' : '✗'), h('span', null, g.label, g.note ? h('span', { class: 'dim small' }, ` — ${g.note}`) : ''))));
    ed.markLines(ev.error?.line ? [ev.error.line] : [], []);
  };
  const check = (submit: boolean) => {
    const ev = evaluate(inst, ed.value);
    show(ev);
    resetDebug();
    if (ev.error) {
      status.className = 'status err';
      status.textContent = ev.error.message + (ev.error.line ? ` (line ${ev.error.line})` : '');
      mentorSay(status.textContent, 'concerned');
      return;
    }
    if (!ev.passed) {
      const bad = ev.goals.filter((g) => !g.ok);
      status.className = 'status err';
      status.textContent = `${bad.length} of ${ev.goals.length} goals not met.`;
      mentorSay(`Not yet: ${bad[0].label}${bad[0].note ? ` (${bad[0].note})` : ''}.`, 'concerned');
      return;
    }
    status.className = 'status ok';
    if (!submit) { status.textContent = `All ${ev.goals.length} goals met. Submit to bank the result.`; return; }
    status.textContent = `PASS: all ${ev.goals.length} goals met.`;
    const stars = starsFor(usage.hints);
    const aw = award(level.id, level.xp, stars);
    celebrate(stars, aw, usage.hints ? ['Solve it without hints for another star.'] : [], nextHref(level.id));
  };

  // ---- debugger
  const caseSel = h('select', { class: 'isa-case', 'aria-label': 'Case to debug' }, ...inst.cases.map((c, i) => h('option', { value: String(i) }, c.hidden ? `case ${i + 1}: ${c.label}` : c.label))) as HTMLSelectElement;
  const dbgStatus = h('div', { class: 'dim small' }, 'Pick a case, then Load to step through your program.');
  const regBox = h('div', { class: 'isa-regs' });
  const listBox = h('pre', { class: 'isa-list' });
  const traceBox = h('pre', { class: 'isa-trace' });
  const outBox = h('div', { class: 'dim small' });
  const memAddr = h('input', { type: 'text', class: 'isa-addr', value: '0x4000', 'aria-label': 'Memory address' }) as HTMLInputElement;
  const memBox = h('div', { class: 'isa-mem dim small' });
  let m: Machine | undefined;
  let prog: Program | undefined;
  let prevRegs: number[] = [];

  const draw = () => {
    if (!m || !prog) { regBox.replaceChildren(); listBox.textContent = ''; traceBox.textContent = ''; outBox.textContent = ''; memBox.textContent = ''; return; }
    const cells: HTMLElement[] = [];
    cells.push(h('div', { class: 'isa-reg pc' }, h('b', null, 'pc'), ` ${hx(m.pc)}`));
    for (let i = 0; i < 32; i++) cells.push(h('div', { class: `isa-reg${prevRegs[i] !== undefined && prevRegs[i] !== m.regs[i] ? ' chg' : ''}`, title: `x${i}` }, h('b', null, REG_NAMES[i]), ` ${m.regs[i]}`, h('span', { class: 'dim' }, ` ${hx(m.regs[i])}`)));
    regBox.replaceChildren(...cells);
    const lines = prog.text.slice(0, 80).map((t) => `${t.addr === m!.pc && m!.stopped === 'running' ? '▶' : ' '} ${t.addr.toString(16).padStart(4, '0')}  ${t.word.toString(16).padStart(8, '0')}  ${t.text}`);
    listBox.textContent = lines.join('\n') + (prog.text.length > 80 ? '\n…' : '');
    traceBox.textContent = m.trace.slice(-14).map((s) => `${s.pc.toString(16).padStart(4, '0')}  ${s.text.padEnd(26)}${s.rd !== undefined ? `${REG_NAMES[s.rd]} ← ${s.value}` : ''}${s.mem ? `${s.mem.write ? ' mem[' : ' ← mem['}${s.mem.addr.toString(16)}]${s.mem.write ? ` = ${s.mem.value}` : ''}` : ''}`).join('\n');
    outBox.textContent = `${m.steps} instruction${m.steps === 1 ? '' : 's'} executed${m.out ? ` · output: ${m.out}` : ''}${m.stopped === 'running' ? '' : m.stopped === 'error' || m.stopped === 'limit' ? ` · stopped: ${m.error!.msg}` : ` · ${m.stopped === 'exit' ? `exited with code ${m.exitCode}` : 'stopped at ebreak'}`}`;
    const addr = parseInt(memAddr.value, 16) || parseInt(memAddr.value, 10) || 0;
    memBox.textContent = Array.from({ length: 6 }, (_, i) => { const a = (addr & ~3) + 4 * i; return a + 4 <= 0x10000 ? `${a.toString(16)}: ${m!.word(a)}` : ''; }).filter(Boolean).join('   ');
  };
  function resetDebug() { m = undefined; prog = undefined; prevRegs = []; dbgStatus.textContent = 'Pick a case, then Load to step through your program.'; draw(); }
  const load = () => {
    try {
      prog = assemble(inst.fixed ? `${ed.value}\n${inst.fixed}` : ed.value);
      const c = inst.cases[Number(caseSel.value)];
      m = setupMachine(inst, prog, c.setup);
      m.keepTrace = true;
      prevRegs = Array.from(m.regs);
      dbgStatus.textContent = inst.style === 'function' ? `Calling ${inst.entry} (returns to ${hx(SENTINEL)})` : 'Running from address 0';
      draw();
    } catch (e) {
      m = undefined;
      dbgStatus.textContent = e instanceof AsmError ? `${e.message} (line ${e.line})` : (e as Error).message;
      draw();
    }
  };
  const stepN = (n: number) => {
    if (!m) { load(); if (!m) return; }
    prevRegs = Array.from(m.regs);
    for (let i = 0; i < n && m.stopped === 'running'; i++) {
      if (inst.style === 'function' && m.pc === SENTINEL) { m.stopped = 'exit'; dbgStatus.textContent = `Returned. a0 = ${m.regs[10]}`; break; }
      m.step();
    }
    draw();
  };
  const runAll = () => {
    if (!m) { load(); if (!m) return; }
    prevRegs = Array.from(m.regs);
    for (let i = 0; i < 200000 && m.stopped === 'running'; i++) { if (inst.style === 'function' && m.pc === SENTINEL) { m.stopped = 'exit'; dbgStatus.textContent = `Returned. a0 = ${m.regs[10]}`; break; } m.step(); }
    if (m.stopped === 'running') { m.stopped = 'limit'; m.error = { msg: 'no exit after 200000 instructions', pc: m.pc }; }
    draw();
  };
  memAddr.addEventListener('change', draw);

  const debug = h('details', { class: 'src-view isa-debug', open: '' },
    h('summary', null, 'Debugger'),
    h('div', { class: 'toolbar' }, caseSel, h('button', { class: 'btn small', onclick: load }, 'Load'), h('button', { class: 'btn small', onclick: () => stepN(1) }, 'Step'), h('button', { class: 'btn small', onclick: () => stepN(10) }, 'Step ×10'), h('button', { class: 'btn small', onclick: runAll }, 'Run to end')),
    dbgStatus, regBox,
    h('div', { class: 'isa-cols' }, h('div', null, h('h4', null, 'Machine code'), listBox), h('div', null, h('h4', null, 'Last instructions'), traceBox)),
    outBox,
    h('div', { class: 'dim small' }, 'Memory at ', memAddr, ' (hex): ', memBox),
    h('div', { class: 'dim small' }, `Memory is 64 KiB: code at 0, data at 0x2000, stack top ${hx(STACK_TOP)}.`),
  );

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => check(false), title: 'Ctrl+Enter' }, '▶ Check'),
    h('button', { class: 'btn primary', onclick: () => check(true) }, '✔ Submit'),
    h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset to the starter?')) { ed.value = inst.starter; clearDraft(draftKey); } } }, 'Reset'),
    boss ? h('button', { class: 'btn ghost', onclick: () => { if (confirm('Roll a new variant? This clears your current work.')) { saveDraft(seedKey, Math.floor(Math.random() * 1e6) + 1); const host = document.getElementById('lab-slot'); if (host) host.replaceWith(isaPage(level.id)); else location.reload(); } } }, 'New variant') : '',
  );

  return h('div', { class: 'level', id: 'lab-slot' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid clab-grid' }, brief, h('section', { class: 'work panel' }, toolbar, ed.el)),
    h('section', { class: 'results panel' }, status, goalList, debug),
  );
}

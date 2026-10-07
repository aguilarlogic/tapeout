import { mentorSay } from '../../os/mentor';
import { run, RunResult } from '../../sim/harness';
import { levelRecord, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { levelHeader } from '../../ui/layout';
import { waveform } from '../../ui/waveform';
import { ALL_RTL, RtlLevel } from './levels';
import { briefPanel, draftEditor, finish, resetButton, setStatus, useHints } from '../../ui/labkit';

export const MODEL_NOTE = 'This simulator is 2-state: X and Z are not modelled, and registers power up at 0. Real simulators start registers at X, so a missing reset shows up as X there.';

export function rtlPage(id: string): HTMLElement {
  const level = ALL_RTL.find((l) => l.id === id);
  if (!level) return h('p', null, 'Unknown level.');

  const draftKey = `rtl.${level.id}`;
  const { hintBox, usage } = useHints(level.hints, `${draftKey}.usage`, { extra: { solution: false }, text: true, cost: 'costs a star' });
  const saveUsage = () => saveDraft(`${draftKey}.usage`, usage);

  const ed = draftEditor(draftKey, level.starter, () => doRun());

  const brief = briefPanel({ tag: level.concept, html: level.brief, model: MODEL_NOTE, hintBox });

  // --- results area
  const status = h('div', { class: 'status idle' }, 'Press Run (Ctrl+Enter) to simulate your design against the golden model.');
  const messages = h('ul', { class: 'messages' });
  const waveHost = h('div', { class: 'wave-host' });
  const internalsToggle = h('input', { type: 'checkbox', id: 'internals' }) as HTMLInputElement;
  internalsToggle.checked = level.track === 'debug';
  let last: RunResult | null = null;
  const stim = level.stimulus();
  const renderWave = () => {
    waveHost.replaceChildren();
    if (last && last.samples.length) waveHost.append(waveform(last, stim.clock, internalsToggle.checked));
  };
  internalsToggle.addEventListener('change', renderWave);

  const doRun = () => {
    const res = run(ed.value, level.golden, stim);
    last = res;
    messages.replaceChildren();
    const errLines: number[] = [];
    if (res.error) {
      const where = res.error.line ? `line ${res.error.line}: ` : '';
      const label = res.error.phase === 'compile' ? 'Compile error' : res.error.phase === 'ports' ? 'Port mismatch' : 'Simulation error';
      messages.append(h('li', { class: 'msg err' }, h('b', null, label), ` ${where}${res.error.message}`));
      if (res.error.line) errLines.push(res.error.line);
    }
    for (const l of res.lints) messages.append(h('li', { class: 'msg warn' }, h('b', null, 'Lint'), ` line ${l.line}: ${l.message}`));
    for (const w of res.warnings) messages.append(h('li', { class: 'msg warn' }, h('b', null, 'Warning'), ` line ${w.line}: ${w.message}`));
    ed.markLines(errLines, res.lints.map((l) => l.line));

    if (res.error) {
      mentorSay(res.error.phase === 'compile' ? `The compiler stopped${res.error.line ? ` at line ${res.error.line}` : ''}: ${res.error.message}` : res.error.phase === 'ports' ? `Your ports do not match the spec: ${res.error.message}` : `Simulation stopped: ${res.error.message}`, 'concerned');
      setStatus(status, 'err', res.error.phase === 'compile' ? 'Design did not compile.' : res.error.phase === 'ports' ? 'Your ports don\'t match the spec.' : 'Simulation stopped.');
    } else if (!res.ok) {
      const m = res.mismatches[0];
      const clk = stim.clock ? 'cycle' : 'sample';
      status.className = 'status err';
      mentorSay(`'${m.signal}' is ${fmt(m.got)} at ${stim.clock ? 'cycle' : 'vector'} ${m.step}, but I expected ${fmt(m.expected)}. The yellow trace in the waveform is the expected one; walk backwards from there.`, 'concerned');
      status.textContent = `FAIL - ${res.mismatches.length} mismatch${res.mismatches.length > 1 ? 'es' : ''}. First at ${clk} ${m.step}: '${m.signal}' is ${fmt(m.got)} but the spec says ${fmt(m.expected)}.`;
    } else {
      setStatus(status, 'ok', `PASS - ${res.samples.length} ${stim.clock ? 'cycles' : 'vectors'} checked, 0 mismatches.`);
      let stars = 3;
      if (res.lints.length) stars--;
      if (usage.hints > 0) stars--;
      if (usage.solution) stars = 1;
      const notes = [
        res.lints.length ? 'Clean up the lint warnings for another star.' : '',
        usage.hints ? 'Solve it without hints for another star.' : '',
        usage.solution ? 'You viewed the solution, so this counts for 1 star.' : '',
      ].filter(Boolean);
      finish(level.id, level.xp, stars, notes);
    }
    renderWave();
  };

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn primary', onclick: doRun, title: 'Ctrl+Enter' }, '▶ Run simulation'),
    resetButton(ed, level.starter, draftKey, 'the starter code', 'Reset code'),
    h('button', {
      class: 'btn ghost',
      onclick: () => {
        if (!confirm('Show the reference solution? You can still finish the level, but for 1 star.')) return;
        usage.solution = true;
        saveUsage();
        ed.value = level.golden;
      },
    }, 'Show solution'),
    h('span', { class: 'spacer' }),
    h('label', { class: 'check' }, internalsToggle, ' internal signals'),
  );

  const results = h('section', { class: 'results panel' }, status, messages, waveHost);

  return h('div', { class: 'level' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid' }, brief, h('section', { class: 'work panel' }, toolbar, ed.el)),
    results,
  );
}

function fmt(v: bigint): string {
  return v > 9n ? `${v} (0x${v.toString(16).toUpperCase()})` : v.toString();
}

export type { RtlLevel };

// Shell Lab page: a real-feeling terminal over the virtual machine, a live goal list, hints, and a Check button.
import { briefPanel, finish, hintNote, labPage, loadSeed, newVariantButton, setStatus, useHints } from '../../ui/labkit';
import { mentorSay } from '../../os/mentor';
import { clearDraft, loadDraft, saveDraft } from '../../state';
import { h } from '../../ui/dom';
import { findShellLevel, shellInstanceFor, starsFor } from './levels';
import { evaluate, exec, passed, replay, type Machine } from './run';
import { parseScript } from './sh';
import { askConfirm } from '../../ui/modal';

/** True when the text so far is an unfinished command (open quote, compound statement or here-document). */
function incomplete(src: string): boolean {
  const here = [...src.matchAll(/<<-?\s*['"]?(\w+)['"]?/g)];
  for (const m of here) {
    const after = src.slice((m.index ?? 0) + m[0].length).split('\n').slice(1);
    if (!after.some((l) => l.replace(/^\t+/, '') === m[1])) return true;
  }
  try { parseScript(src); return false; } catch (e) {
    const msg = (e as Error).message;
    return /unexpected EOF|unexpected token `newline'/.test(msg);
  }
}

export const MODEL_NOTE = 'A POSIX-style shell with GNU tools. Bash-only and GNU-only features are marked where they appear.';

export function shellPage(id: string): HTMLElement {
  const level = findShellLevel(id);
  if (!level) return h('p', null, 'Unknown mission.');
  const boss = level.tier === 'boss';
  const seedKey = `shell.${level.id}.seed`;
  const seed = loadSeed(seedKey);
  const inst = shellInstanceFor(level, seed);
  const draftKey = `shell.${level.id}.${seed}`;
  let history = loadDraft<string[]>(`${draftKey}.hist`) ?? [];
  let m: Machine = replay(inst, history);

  // --- brief and hints
  const { hintBox, usage } = useHints(inst.hints, `${draftKey}.usage`);

  const brief = briefPanel({ tag: `Shell · ${level.concept}`, ticket: level.ticket, model: MODEL_NOTE, html: inst.brief, note: boss ? 'Boss mission: no hints. Check runs hidden verification.' : undefined, hintBox });

  // --- terminal
  const screen = h('div', { class: 'sh-screen', tabindex: '-1' });
  const prompt = () => `${m.sh.env.get('USER') ?? 'user'}@fab:${m.sh.cwd.replace(m.sh.env.get('HOME') ?? '/home/user', '~')}$`;
  const input = h('textarea', { class: 'sh-input', rows: '1', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Terminal input' }) as HTMLTextAreaElement;
  const promptLabel = h('span', { class: 'sh-prompt' }, '');
  let buffer = '';
  let cursor = history.length;

  const addLine = (text: string | Node, cls = '') => { screen.append(h('pre', { class: `sh-line ${cls}` }, text)); screen.scrollTop = screen.scrollHeight; };
  const refreshPrompt = () => { promptLabel.textContent = buffer ? '>' : prompt(); };
  const echoHistory = () => {
    screen.replaceChildren();
    addLine(h('span', null, 'Type commands and press Enter. ', h('span', { class: 'kbd-hint' }, 'Shift+Enter adds a line. Up/Down recall history. '), '"help" lists what is available.'), 'dim');
    m = replay(inst, history);
    // show the output of replayed commands so the session looks continuous
    history.forEach((c, i) => { addLine(`$ ${c}`, 'cmd'); const o = m.hist[i]?.out ?? ''; if (o) addLine(o.replace(/\n$/, ''), 'out'); });
  };

  const goalList = h('ul', { class: 'goals' });
  const status = h('div', { class: 'status idle' }, 'Run commands in the terminal. Check tests every goal against the machine.');
  const showGoals = (res?: { label: string; ok: boolean }[]) => {
    goalList.replaceChildren(...(res ?? inst.goals.map((g) => ({ label: g.label, ok: false }))).map((r) => h('li', { class: res ? (r.ok ? 'ok' : 'bad') : '' }, h('span', { class: 'mark' }, res ? (r.ok ? '✓' : '✗') : '○'), h('span', null, r.label))));
  };
  showGoals();

  const run = (text: string) => {
    if (text.trim() === 'help') {
      addLine('Available: ls cd pwd cat echo printf head tail wc sort uniq cut tr grep sed awk find xargs tee mkdir touch rm cp mv chmod diff test [ expr seq basename dirname date python3 make cc git, plus pipes, redirects, $(...), loops, functions and scripts.', 'dim');
      return;
    }
    if (text.trim() === 'clear') { screen.replaceChildren(); return; }
    addLine(`${prompt()} ${text}`, 'cmd');
    const e = exec(m, text);
    if (e.out) addLine(e.out.replace(/\n$/, ''), e.status ? 'out err' : 'out');
    history.push(text);
    saveDraft(`${draftKey}.hist`, history);
    cursor = history.length;
    // goals update live for guided missions
    if (!boss) { const res = evaluate(m, inst); showGoals(res); if (passed(res)) { status.className = 'status ok'; status.textContent = 'All goals met. Press Check to bank the result.'; } }
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      const line = input.value;
      input.value = '';
      input.rows = 1;
      const full = buffer ? `${buffer}\n${line}` : line;
      if (!full.trim()) { addLine(prompt(), 'cmd'); return; }
      if (incomplete(full)) {
        addLine(`${buffer ? '>' : prompt()} ${line}`, 'cmd');
        // The bare ">" prompt means "still waiting": say why, once, and how to get out.
        if (!buffer) addLine(h('span', null, 'The line is not finished (an open quote, a trailing \\, or a heredoc without its end word). Keep typing', h('span', { class: 'kbd-hint' }, ', or press Ctrl+C to cancel'), '.'), 'dim');
        buffer = full; refreshPrompt(); return;
      }
      buffer = '';
      run(full);
      refreshPrompt();
    } else if (ev.key === 'ArrowUp' && !input.value.includes('\n')) {
      ev.preventDefault();
      if (cursor > 0) { cursor--; input.value = history[cursor]; }
    } else if (ev.key === 'ArrowDown' && !input.value.includes('\n')) {
      ev.preventDefault();
      cursor = Math.min(history.length, cursor + 1);
      input.value = history[cursor] ?? '';
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      const words = input.value.split(/\s+/);
      const last = words[words.length - 1];
      if (!last) return;
      const slash = last.lastIndexOf('/');
      const dir = slash >= 0 ? last.slice(0, slash + 1) : '';
      try {
        const names = m.sh.fs.list(m.sh.abs(dir || '.')).filter((n) => n.startsWith(last.slice(slash + 1)));
        if (names.length === 1) { const full = m.sh.abs(`${dir}${names[0]}`); words[words.length - 1] = dir + names[0] + (m.sh.fs.isDir(full) ? '/' : ' '); input.value = words.join(' '); }
        else if (names.length > 1) addLine(names.join('  '), 'dim');
      } catch { /* not a directory */ }
    } else if (ev.key === 'c' && ev.ctrlKey) { buffer = ''; input.value = ''; addLine('^C', 'dim'); refreshPrompt(); }
  });
  input.addEventListener('input', () => { input.rows = Math.min(8, input.value.split('\n').length); });

  const check = () => {
    const res = evaluate(m, inst);
    showGoals(res);
    if (!passed(res)) {
      const bad = res.filter((r) => !r.ok);
      setStatus(status, 'err', `${bad.length} of ${res.length} goals not met yet.`);
      mentorSay(`Not yet: ${bad[0].label}.`, 'concerned');
      return;
    }
    const stars = starsFor(usage.hints);
    setStatus(status, 'ok', `PASS: all ${res.length} goals met.`);
    finish(level.id, level.xp, stars, hintNote(usage.hints));
  };

  const reset = () => {
    history = [];
    clearDraft(`${draftKey}.hist`);
    buffer = '';
    echoHistory();
    showGoals();
    setStatus(status, 'idle', 'Machine reset to its starting state.');
    refreshPrompt();
  };
  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn primary', onclick: check }, '✔ Check goals'),
    h('button', { class: 'btn ghost', onclick: () => void askConfirm({ title: 'Reset the machine?', body: 'It goes back to its starting state, and your command history is cleared.', confirm: 'Reset', danger: true }).then((ok) => { if (ok) reset(); }) }, 'Reset machine'),
    boss && newVariantButton(seedKey, () => shellPage(level.id), 'Roll a new variant of this mission? The machine resets.'),
  );

  echoHistory();
  refreshPrompt();
  const term = h('div', { class: 'sh-term', onclick: () => input.focus() }, screen, h('div', { class: 'sh-row' }, promptLabel, input));
  return labPage(level, brief, [toolbar, term], [status, goalList]);
}

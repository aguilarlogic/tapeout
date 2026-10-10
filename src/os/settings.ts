// Settings.app: how TAPEOUT types, how the screen reads (text size, motion), the keys, backups, and the danger zone.
import { applyBackup, backupFileName, exportBackup, load, markExported, onChange, prefs, profile, rank, readBackup, resetAll, setPrefs, totalXp, type Backup, type Prefs } from '../state';
import { pace, rich } from '../term/terminal';
import { PACES, prefersReducedMotion, type Token, typeInto } from '../term/typewriter';
import { h, toast } from '../ui/dom';
import { askConfirm } from '../ui/modal';
import { radioStep } from './keys';

const SPEEDS: { id: Prefs['speed']; name: string; blurb: string }[] = [
  { id: 'slow', name: 'Slow', blurb: `about ${PACES.slow.cps} characters a second, with long pauses: plenty of time to read` },
  { id: 'normal', name: 'Normal', blurb: `about ${PACES.normal.cps} characters a second (the default)` },
  { id: 'fast', name: 'Fast', blurb: `about ${PACES.fast.cps} characters a second, short pauses` },
  { id: 'instant', name: 'Instant', blurb: 'no typing and no loading animations: text appears at once' },
];

const TEXT: { id: Prefs['text']; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'large', name: 'Large' },
  { id: 'larger', name: 'Larger' },
];

const MOTION: { id: Prefs['motion']; name: string; blurb: string }[] = [
  { id: 'system', name: 'As my system says', blurb: 'follows the reduce-motion setting of this computer' },
  { id: 'reduce', name: 'Reduce', blurb: 'no typing animations, spinners or fading windows, whatever the system says' },
  { id: 'full', name: 'Full', blurb: 'all animations, even if the system asks for less' },
];

/** Keys that work in the game today. Keep this list in step with the handlers. */
const KEYS: [string, string][] = [
  ['Escape', 'Close the focused window (not while you type in the terminal, a text field or a canvas)'],
  ['Alt + `', 'Cycle through the open windows'],
  ['Enter / Space', 'Open a focused desktop icon'],
  ['Enter / Esc', 'In a dialog: confirm, or cancel'],
  ['Enter', 'In the terminal: send the line. ↑ and ↓ recall earlier commands'],
  ['Tab', 'In the terminal, on an empty line: pick the first suggested command'],
  ['Any key', 'While TAPEOUT is typing: finish the message at once'],
  ['Ctrl + Enter', 'In a code lab: run the check'],
  ['Tab', 'In a code lab: indent'],
  ['Ctrl + Z', 'Undo in the board router'],
  ['R / V', 'In the board router: route tool, or via tool'],
  ['Delete', 'In the logic lab: remove the selected part or wire'],
  ['Ctrl + C', 'In the shell lab: cancel the line you are typing'],
];

const SAMPLE = 'Hi, {name}. This is how fast I will type. I pause after each sentence, and a little longer before a question. Press any key or click to finish a line early. Ready?';

/** Save a backup file to the player's downloads. Counts as an export, so TAPEOUT stops suggesting one. */
export function downloadBackup() {
  const json = JSON.stringify(exportBackup(), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = h('a', { href: url, download: backupFileName() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  markExported();
  toast('Progress exported. Keep the file somewhere safe.', 'ok');
}

/** Wipe everything this game keeps in this browser, then start again from the desktop. */
function fullReset() {
  resetAll();
  try { Object.keys(localStorage).filter((k) => k.startsWith('tapeout.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  location.hash = '#/';
  location.reload();
}

const when = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 'an unknown date' : new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** One row of radio buttons: used for speed, text size and motion. One Tab stop (the chosen option), and arrow keys move. */
function choice<T extends string>(label: string, items: { id: T; name: string; blurb?: string }[], current: () => T, pick: (id: T) => void): HTMLElement {
  const group = h('div', { class: 'speed-options', role: 'radiogroup', 'aria-label': label });
  const render = () => {
    const cur = current();
    group.replaceChildren(...items.map((s) => h('button', {
      class: `speed-option${s.id === cur ? ' on' : ''}`, role: 'radio', 'aria-checked': String(s.id === cur),
      tabindex: s.id === cur ? '0' : '-1',
      onclick: () => { pick(s.id); render(); },
    }, h('b', null, s.name), s.blurb ? h('span', { class: 'dim' }, s.blurb) : null)));
  };
  group.addEventListener('keydown', (e) => {
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
    const next = radioStep(e.key, radios.indexOf(document.activeElement as HTMLElement), items.length);
    if (next === undefined) return;
    e.preventDefault();
    pick(items[next].id);
    render();
    group.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus();
  });
  render();
  return group;
}

export function settingsApp(): HTMLElement {
  const root = h('div', { class: 'level settings' });
  let tk: Token = { skip: true };

  // ---- typing speed, with a live preview
  const preview = h('div', { class: 'settings-preview term' });
  const play = () => {
    tk.skip = true; // stop the previous preview
    const mine: Token = { skip: false };
    tk = mine;
    const body = h('span', { class: 'ai-text' }, ...rich(SAMPLE));
    preview.replaceChildren(h('div', { class: 'tl' }, h('span', { class: 'ai-name' }, 'tapeout'), h('span', { class: 'ai-sep' }, '› '), body));
    void typeInto(body, pace(), mine);
  };
  preview.addEventListener('click', () => (tk.skip = true));
  const speedOptions = choice('TAPEOUT typing speed', SPEEDS, () => prefs().speed, (id) => { setPrefs({ speed: id }); play(); });

  // ---- your progress: a summary that stays live, then export and import
  const summary = h('p', { class: 'dim progress-summary' });
  const renderSummary = () => {
    const r = rank(), n = Object.keys(load().levels).length, last = load().lastExport;
    summary.textContent = `${totalXp()} XP · ${r.title} · ${n} ${n === 1 ? 'module' : 'modules'} with results · ${last ? `last exported ${when(new Date(last).toISOString())}` : 'never exported'}`;
  };
  renderSummary();
  const exportBtn = h('button', { class: 'btn primary', onclick: downloadBackup }, 'Export progress');
  const importBox = h('div', { class: 'import-box', role: 'status', 'aria-live': 'polite' });
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choose a TAPEOUT backup file' }) as HTMLInputElement;
  let pending: Backup | null = null;

  const apply = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    applyBackup(pending, mode);
    pending = null;
    importBox.replaceChildren();
    toast(mode === 'merge' ? 'Progress merged into your save.' : 'Progress replaced from the file.', 'ok');
  };
  const importPreview = (s: Extract<ReturnType<typeof readBackup>, { ok: true }>) => {
    const m = s.summary;
    return h('div', { class: 'import-preview' },
      h('h4', null, 'This file holds'),
      h('ul', { class: 'dim small' },
        h('li', null, m.name ? `Player: ${m.name}` : 'No player name'),
        h('li', null, `${m.xp} XP across ${m.levels} ${m.levels === 1 ? 'module' : 'modules'}`),
        h('li', null, `${m.cards} flashcard ${m.cards === 1 ? 'record' : 'records'}, ${m.best} high ${m.best === 1 ? 'score' : 'scores'}, ${m.drafts} lab ${m.drafts === 1 ? 'draft' : 'drafts'}`),
        h('li', null, `Exported ${when(m.exported)}`)),
      h('p', { class: 'dim small' }, 'Merge keeps the better result for each module and keeps any lab drafts you already have open. Replace swaps your whole save for the file.'),
      h('div', { class: 'import-actions' },
        h('button', { class: 'btn primary', onclick: () => apply('merge') }, 'Merge into my save'),
        h('button', { class: 'btn danger', onclick: () => void askConfirm({ title: 'Replace your progress?', body: 'Your current save is overwritten by this file. Export first if you might want it back.', confirm: 'Replace', danger: true, extra: h('button', { class: 'btn ghost', onclick: downloadBackup }, 'Export current first') }).then((ok) => { if (ok) apply('replace'); }) }, 'Replace my save'),
        h('button', { class: 'btn ghost', onclick: () => { pending = null; importBox.replaceChildren(); } }, 'Cancel')));
  };
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    void f.text().then((text) => {
      const r = readBackup(text);
      if (!r.ok) {
        pending = null;
        importBox.replaceChildren(h('p', { class: 'note', role: 'alert' }, r.error, ' Your save has not changed.'));
        return;
      }
      pending = r.backup;
      importBox.replaceChildren(importPreview(r));
    }, () => importBox.replaceChildren(h('p', { class: 'note', role: 'alert' }, 'That file could not be read. Your save has not changed.')));
  });

  // ---- reduced motion and text size
  const motionNote = () => {
    const m = prefs().motion;
    if (m === 'reduce') return 'Typing and loading animations are off.';
    if (m === 'full') return 'Animations stay on, even though your system asks for less.';
    return prefersReducedMotion() ? 'Your system asks for reduced motion, so typing and loading animations are off.' : '';
  };
  const motionLine = h('p', { class: 'note' }, motionNote());
  const motionOptions = choice('Reduced motion', MOTION, () => prefs().motion, (id) => { setPrefs({ motion: id }); motionLine.textContent = motionNote(); play(); });
  const textOptions = choice('Text size', TEXT, () => prefs().text, (id) => setPrefs({ text: id }));

  // ---- the danger zone
  const resetFlow = () => {
    const name = profile()?.name;
    const phrases = [name, 'RESET'].filter((x): x is string => !!x);
    void askConfirm({
      title: 'Erase all progress?',
      body: 'This clears your name, XP, rank, flashcards, lab work and high scores from this browser. It cannot be undone.',
      confirm: 'Erase everything', danger: true, typeToConfirm: phrases,
      extra: h('button', { class: 'btn ghost', onclick: downloadBackup }, 'Export first'),
    }).then((ok) => { if (ok) fullReset(); });
  };

  const unsubscribe = onChange(() => {
    if (!root.isConnected) { unsubscribe(); return; }
    renderSummary();
  });

  root.append(
    h('header', { class: 'level-head' }, h('div', { class: 'title-row' }, h('h2', null, 'Settings'))),
    h('section', { class: 'panel' },
      h('h3', null, 'TAPEOUT typing speed'),
      h('p', { class: 'dim' }, ...rich('How fast TAPEOUT types in the terminal, the flashcards and its speech bubbles. You can also type `speed slow` (or `normal`, `fast`, `instant`) in the terminal.')),
      speedOptions,
      h('div', { class: 'preview-head' }, h('span', { class: 'dim' }, 'Preview'), h('button', { class: 'btn ghost', onclick: play }, '↻ Replay')),
      preview),
    h('section', { class: 'panel' },
      h('h3', null, 'Screen'),
      h('p', { class: 'dim' }, 'Text size makes the contents of every window bigger. The desktop and taskbar keep their size.'),
      textOptions,
      h('h4', null, 'Reduced motion'),
      motionOptions,
      motionLine),
    h('section', { class: 'panel' },
      h('h3', null, 'Your progress'),
      summary,
      h('p', { class: 'dim' }, 'A backup is one file with your XP, ranks, flashcards, high scores and lab drafts. Keep it somewhere safe: the game lives in this browser, and clearing the site data loses it.'),
      h('div', { class: 'import-actions' }, exportBtn, h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Import progress…'), fileInput),
      importBox),
    h('section', { class: 'panel kbd-hint' },
      h('h3', null, 'Keyboard shortcuts'),
      h('dl', { class: 'keys' }, ...KEYS.flatMap(([k, what]) => [h('dt', null, h('kbd', null, k)), h('dd', { class: 'dim' }, what)]))),
    h('section', { class: 'panel danger-zone' },
      h('h3', null, 'Danger zone'),
      h('p', { class: 'dim' }, 'Erase everything in this browser. You will be asked to type your name, or RESET, and offered an export first.'),
      h('button', { class: 'btn danger', onclick: resetFlow }, 'Reset all progress…')),
  );
  requestAnimationFrame(play);
  return root;
}

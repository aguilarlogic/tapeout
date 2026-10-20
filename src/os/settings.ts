// Settings.app: how fast TAPEOUT types (with a live preview), sound, and moving your save between copies of the game.
import { prefs, setPrefs, type Prefs } from '../state';
import { pace, rich } from '../term/terminal';
import { PACES, prefersReducedMotion, type Token, typeInto } from '../term/typewriter';
import { applyImport, exportSave, fileName, parseSave } from '../game/save/transfer';
import { h, toast } from '../ui/dom';
import { playCue } from '../ui/sound';

const SPEEDS: { id: Prefs['speed']; name: string; blurb: string }[] = [
  { id: 'slow', name: 'Slow', blurb: `about ${PACES.slow.cps} characters a second, with long pauses: plenty of time to read` },
  { id: 'normal', name: 'Normal', blurb: `about ${PACES.normal.cps} characters a second (the default)` },
  { id: 'fast', name: 'Fast', blurb: `about ${PACES.fast.cps} characters a second, short pauses` },
  { id: 'instant', name: 'Instant', blurb: 'no typing and no loading animations: text appears at once' },
];

const SAMPLE = 'Hi, {name}. This is how fast I will type. I pause after each sentence, and a little longer before a question. Press any key or click to finish a line early. Ready?';

export function settingsApp(): HTMLElement {
  const root = h('div', { class: 'level settings' });
  let tk: Token = { skip: true };

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

  const options = h('div', { class: 'speed-options', role: 'radiogroup', 'aria-label': 'TAPEOUT typing speed' });
  const render = () => {
    const cur = prefs().speed;
    options.replaceChildren(...SPEEDS.map((s) => h('button', {
      class: `speed-option${s.id === cur ? ' on' : ''}`, role: 'radio', 'aria-checked': String(s.id === cur),
      onclick: () => { setPrefs({ speed: s.id }); render(); play(); },
    }, h('b', null, s.name), h('span', { class: 'dim' }, s.blurb))));
  };
  render();

  // Sound: a mute switch. Turning it on plays the pass chime, which also starts audio after this click.
  const soundBtn = h('button', { class: 'btn ghost', role: 'switch', onclick: () => {
    const on = prefs().muted;
    setPrefs({ muted: !on });
    renderSound();
    if (on) playCue('pass');
  } }) as HTMLButtonElement;
  const renderSound = () => {
    const on = !prefs().muted;
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-checked', String(on));
    soundBtn.classList.toggle('on', on);
  };
  renderSound();

  root.append(
    h('header', { class: 'level-head' }, h('div', { class: 'title-row' }, h('h2', null, 'Settings'))),
    h('section', { class: 'panel' },
      h('h3', null, 'TAPEOUT typing speed'),
      h('p', { class: 'dim' }, ...rich('How fast TAPEOUT types in the terminal, the flashcards and its speech bubbles. You can also type `speed slow` (or `normal`, `fast`, `instant`) in the terminal.')),
      options,
      prefersReducedMotion() ? h('p', { class: 'note' }, 'Your system asks for reduced motion, so typing and loading animations are off whatever you pick here.') : null,
      h('div', { class: 'preview-head' }, h('span', { class: 'dim' }, 'Preview'), h('button', { class: 'btn ghost', onclick: play }, '↻ Replay')),
      preview),
    h('section', { class: 'panel' },
      h('h3', null, 'Sound'),
      h('p', { class: 'dim' }, 'Short synthesized chimes when a check passes or fails, and a brighter jingle on promotion. They are quiet, and they stop when you mute them here.'),
      h('div', { class: 'speed-options' }, soundBtn)),
    saveSection(),
  );
  requestAnimationFrame(play);
  return root;
}

/** Every "tapeout." key in localStorage, as a plain map. */
function storageMap(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('tapeout.')) out[k] = localStorage.getItem(k) ?? '';
    }
  } catch { /* storage unavailable: export an empty save */ }
  return out;
}

// Move your save: the browser and the desktop app keep separate saves, so a file carries progress between them.
function saveSection(): HTMLElement {
  const status = h('p', { class: 'note', role: 'status' });
  const exportBtn = h('button', { class: 'btn', onclick: () => {
    const now = new Date();
    const blob = new Blob([JSON.stringify(exportSave(storageMap(), now.getTime()), null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: fileName(now) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status.textContent = `Saved ${fileName(now)} to your downloads.`;
  } }, 'Export save');
  const picker = h('input', { type: 'file', accept: '.json,application/json', hidden: true }) as HTMLInputElement;
  const choice = h('div', { class: 'speed-options' });
  picker.addEventListener('change', async () => {
    const f = picker.files?.[0];
    picker.value = '';
    if (!f) return;
    const parsed = parseSave(await f.text());
    if (typeof parsed === 'string') { status.textContent = parsed; choice.replaceChildren(); return; }
    const run = (mode: 'merge' | 'replace') => {
      if (mode === 'replace' && !confirm('Replace this copy\'s progress with the file? Progress only in this copy will be lost (your rank never drops).')) return;
      const next = applyImport(storageMap(), parsed, mode);
      try {
        for (const k of Object.keys(storageMap())) if (!(k in next)) localStorage.removeItem(k);
        for (const [k, v] of Object.entries(next)) localStorage.setItem(k, v);
      } catch {
        toast('Could not write the save here (storage is unavailable).', 'err');
        return;
      }
      toast(mode === 'merge' ? 'Save merged. Reloading.' : 'Save replaced. Reloading.', 'ok');
      setTimeout(() => location.reload(), 600);
    };
    status.textContent = `${f.name} is a save from ${new Date(parsed.exportedAt).toLocaleString()}. How should it be loaded?`;
    choice.replaceChildren(
      h('button', { class: 'speed-option on', onclick: () => run('merge') }, h('b', null, 'Merge (recommended)'), h('span', { class: 'dim' }, 'keep the best of both: more XP per module, the higher card level, the higher rank, the longer streak')),
      h('button', { class: 'speed-option', onclick: () => run('replace') }, h('b', null, 'Replace'), h('span', { class: 'dim' }, 'use only the file; asks first')));
  });
  return h('section', { class: 'panel' },
    h('h3', null, 'Move your save'),
    h('p', { class: 'dim' }, 'The browser version and the desktop app keep separate saves. Export a save file from one, then import it in the other.'),
    h('div', { class: 'preview-head' }, exportBtn, h('button', { class: 'btn ghost', onclick: () => picker.click() }, 'Import save…')),
    picker, status, choice);
}

// Settings.app: how fast TAPEOUT types, with a live preview.
import { prefs, setPrefs, type Prefs } from '../state';
import { pace, rich } from '../term/terminal';
import { PACES, prefersReducedMotion, type Token, typeInto } from '../term/typewriter';
import { h } from '../ui/dom';

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

  root.append(
    h('header', { class: 'level-head' }, h('div', { class: 'title-row' }, h('h2', null, 'Settings'))),
    h('section', { class: 'panel' },
      h('h3', null, 'TAPEOUT typing speed'),
      h('p', { class: 'dim' }, ...rich('How fast TAPEOUT types in the terminal, the flashcards and its speech bubbles. You can also type `speed slow` (or `normal`, `fast`, `instant`) in the terminal.')),
      options,
      prefersReducedMotion() ? h('p', { class: 'note' }, 'Your system asks for reduced motion, so typing and loading animations are off whatever you pick here.') : null,
      h('div', { class: 'preview-head' }, h('span', { class: 'dim' }, 'Preview'), h('button', { class: 'btn ghost', onclick: play }, '↻ Replay')),
      preview),
  );
  requestAnimationFrame(play);
  return root;
}

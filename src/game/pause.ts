// The pause menu (Esc or P): Resume, Controls (remapping), Reduced motion, Back to desktop. DOM, over the canvas.
// Controls: click a cell, press a key (or click a mouse button); Esc cancels. A key already used elsewhere swaps.
import { prefs, setPrefs } from '../state';
import { h } from '../ui/dom';
import { ACTIONS, type Action, assign, type Bindings, DEFAULTS, keyName, overrides, resolve } from './input/bindings';
import type { InputDevice } from './input/device';

export interface PauseHooks {
  input: InputDevice;
  resume(): void;
  quit(): void;
  onBindings(b: Bindings): void;
  onReducedMotion(): void;
}

export function pauseMenu(hooks: PauseHooks): HTMLElement {
  const root = h('div', { class: 'gm-pause', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' });
  const main = () => {
    const rm = prefs().reducedMotion;
    const rmLabel = { system: 'Follow my system', on: 'On', off: 'Off' }[rm];
    const resume = h('button', { class: 'gm-btn primary', onclick: hooks.resume }, 'Resume');
    root.replaceChildren(h('div', { class: 'gm-panel' },
      h('h2', null, 'Paused'),
      resume,
      h('button', { class: 'gm-btn', onclick: controls }, 'Controls'),
      h('button', { class: 'gm-btn', onclick: () => {
        const order = ['system', 'on', 'off'] as const;
        setPrefs({ reducedMotion: order[(order.indexOf(rm) + 1) % 3] });
        hooks.onReducedMotion();
        main();
      } }, `Reduced motion: ${rmLabel}`),
      h('button', { class: 'gm-btn', onclick: hooks.quit }, 'Back to desktop'),
      h('p', { class: 'gm-note' }, 'This is a preview of the new story game: one test room to try the movement and the weapons. Your course progress is not touched.')));
    resume.focus();
  };

  const controls = () => {
    let b = resolve(prefs().keys);
    let note = '';
    let waiting: { action: Action; col: 0 | 1 } | null = null;
    const save = (nb: Bindings) => {
      b = nb;
      setPrefs({ keys: overrides(b) });
      hooks.onBindings(b);
    };
    const render = () => {
      const rows = ACTIONS.map((a) => h('tr', null,
        h('th', { scope: 'row' }, a.label, a.later ? h('span', { class: 'gm-later' }, ' (later)') : null),
        ...([0, 1] as const).map((col) => {
          const on = waiting?.action === a.id && waiting.col === col;
          return h('td', null, h('button', {
            class: `gm-key${on ? ' on' : ''}`, 'aria-label': `${a.label}, ${col ? 'second' : 'main'} key: ${keyName(b[a.id][col])}. Click to change.`,
            onclick: (e: Event) => { e.stopPropagation(); start(a.id, col); },
          }, on ? 'Press a key…' : keyName(b[a.id][col])));
        })));
      root.replaceChildren(h('div', { class: 'gm-panel wide' },
        h('h2', null, 'Controls'),
        h('p', { class: 'gm-note' }, 'Click a key to change it, then press the new key or mouse button. Esc cancels. A key used elsewhere swaps places.'),
        h('div', { class: 'gm-status', role: 'status' }, note),
        h('div', { class: 'gm-table-wrap' }, h('table', { class: 'gm-keys' }, h('thead', null, h('tr', null, h('th', null, 'Action'), h('th', null, 'Main'), h('th', null, 'Second'))), h('tbody', null, ...rows))),
        h('div', { class: 'gm-row' },
          h('button', { class: 'gm-btn', onclick: () => { save(structuredClone(DEFAULTS)); note = 'Controls reset to the defaults.'; render(); } }, 'Reset to defaults'),
          h('button', { class: 'gm-btn primary', onclick: () => { hooks.input.capture = null; main(); } }, 'Done'))));
    };
    const start = (action: Action, col: 0 | 1) => {
      waiting = { action, col };
      note = '';
      render();
      // the click that chose the cell is still in flight; capture from the next event on
      setTimeout(() => {
        hooks.input.capture = (code) => {
          hooks.input.capture = null;
          const w = waiting!;
          waiting = null;
          if (code === 'Escape') { note = 'Cancelled.'; render(); return; }
          const label = ACTIONS.find((x) => x.id === w.action)!.label;
          const r = assign(b, w.action, w.col, code);
          save(r.bindings);
          note = r.swapped
            ? `${keyName(code)} was on ${ACTIONS.find((x) => x.id === r.swapped!.action)!.label}; swapped, so that now has ${keyName(r.bindings[r.swapped.action][r.swapped.col])}.`
            : `${label} is now ${keyName(code)}.`;
          render();
        };
      }, 0);
    };
    render();
  };

  main();
  return root;
}

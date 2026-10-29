// The pause menu (Esc or P), in line art (polish bar P2): Resume, Settings and Quit to title, each with hover and
// press states and sounds. Settings holds the story game's options (plan I and J, P5) and the Controls remapping.
// Controls: click a cell, press a key (or click a mouse button); Esc cancels. A key already used elsewhere swaps.
import { type Prefs, prefs, profile, setPrefs } from '../state';
import { h } from '../ui/dom';
import type { Sfx } from './audio';
import { ACTIONS, type Action, assign, type Bindings, DEFAULTS, keyName, overrides, resolve } from './input/bindings';
import { AIM_ASSIST_OPTIONS, padRows, TOUCH_NOTES } from './input/controlsinfo';
import type { InputDevice } from './input/device';

export interface PauseHooks {
  input: InputDevice;
  resume(): void;
  quit(): void;
  onBindings(b: Bindings): void;
  /** Settings changed (motion, shake, flashes, numbers, volumes). */
  onSettings(): void;
  sound(s: Sfx): void;
  /** The story is running (not the test room): the menu offers difficulty and assists. */
  story?: boolean;
  /** Room skip (Phase 10 Spec, section 2.6): true when this room may be skipped; skipRoom moves on and resumes. */
  canSkipRoom?(): boolean;
  skipRoom?(): void;
}

/** A labelled select row for the Accessibility panel. */
interface Choice<T extends string> { value: T; label: string }

export function pauseMenu(hooks: PauseHooks): HTMLElement {
  const root = h('div', { class: 'gm-pause', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' });
  const btn = (label: string, onclick: () => void, cls = '') => {
    const b = h('button', { class: `gm-btn ${cls}`, onclick: () => { hooks.sound('uiPress'); onclick(); } }, label);
    b.addEventListener('mouseenter', () => hooks.sound('uiHover'));
    b.addEventListener('focus', () => { if (b.matches(':focus-visible')) hooks.sound('uiHover'); });
    return b;
  };
  /** Swap the panel with a short cross-fade so nothing pops (P1). */
  const show = (panel: HTMLElement, focus?: HTMLElement) => {
    panel.classList.add('gm-enter');
    root.replaceChildren(panel);
    requestAnimationFrame(() => panel.classList.remove('gm-enter'));
    focus?.focus();
  };

  const main = () => {
    const resume = btn('Resume', hooks.resume, 'primary');
    show(h('div', { class: 'gm-panel' },
      h('h2', null, 'PAUSED'),
      resume,
      hooks.story && prefs().roomSkip && hooks.canSkipRoom?.() ? btn('Skip this room', () => hooks.skipRoom?.()) : null,
      btn('Settings', settings),
      btn('Accessibility', access),
      hooks.story ? btn('Difficulty and assists', assists) : null,
      btn(hooks.story ? 'Classic desktop' : 'Quit to title', hooks.quit),
      h('p', { class: 'gm-note' }, hooks.story
        ? 'Your progress saves as you go and counts in the course too. The Classic Desktop holds every lesson and lab outside the story.'
        : 'The test room: try the drone, its guns and the Field Coil. Your course progress is not touched.')), resume);
  };

  /** Difficulty and assists (Level 1 spec, "Difficulty"): Story halves damage taken and weakens the boss. */
  const assists = () => {
    const p = prefs();
    const diff = p.difficulty ?? (profile()?.background === 'pro' ? 'standard' : 'story');
    const flip = (label: string, key: 'invincible' | 'autoFire' | 'infiniteEnergy' | 'roomSkip') =>
      btn(`${label}: ${p[key] ? 'On' : 'Off'}`, () => { setPrefs({ [key]: !prefs()[key] } as Partial<Prefs>); hooks.onSettings(); assists(); }, 'toggle');
    const out = h('output', null, `${p.gameSpeed}%`);
    const speed = h('input', { type: 'range', min: '50', max: '100', step: '10', value: `${p.gameSpeed}`, 'aria-label': 'Game speed' }) as HTMLInputElement;
    speed.addEventListener('input', () => { out.textContent = `${speed.value}%`; setPrefs({ gameSpeed: Number(speed.value) }); hooks.onSettings(); });
    /** Aim assist (Phase 9 Spec, section 5): a select, so it works from the keyboard and reads as "Aim assist". */
    const aim = h('select', { class: 'gm-select', 'aria-label': 'Aim assist' },
      ...AIM_ASSIST_OPTIONS.map((o) => h('option', { value: o.value }, o.label)));
    aim.value = p.aimAssist ?? 'auto';
    aim.addEventListener('change', () => {
      const pick = AIM_ASSIST_OPTIONS.find((o) => o.value === aim.value);
      if (pick) { setPrefs({ aimAssist: pick.value }); hooks.onSettings(); }
    });
    const back = btn('Back', main, 'primary');
    show(h('div', { class: 'gm-panel wide' },
      h('h2', null, 'DIFFICULTY'),
      btn(`Difficulty: ${diff === 'story' ? 'Story' : 'Standard'}`, () => { setPrefs({ difficulty: diff === 'story' ? 'standard' : 'story' }); hooks.onSettings(); assists(); }, 'toggle'),
      h('p', { class: 'gm-note' }, diff === 'story' ? 'Story: you take half damage and the boss has less health. The puzzles are the same.' : 'Standard: full damage, full boss. The puzzles are the same.'),
      h('label', { class: 'gm-slider' }, h('span', null, 'Game speed'), speed, out),
      h('label', { class: 'gm-slider' }, h('span', null, 'Aim assist'), aim),
      h('div', { class: 'gm-grid' }, flip('Invincible', 'invincible'), flip('Auto-fire', 'autoFire'), flip('Endless energy', 'infiniteEnergy'), flip('Room skip', 'roomSkip')),
      h('p', { class: 'gm-note' }, 'Assists never cost stars or progress. Turn them on and off whenever you like.'),
      h('div', { class: 'gm-row' }, h('span'), back)), back);
  };

  /** Accessibility (Phase 10 Spec, section 2): text size, colours, captions and hold or toggle. Selects work from the
   * keyboard, the pad (padnav) and touch alike, and read their label. */
  const access = () => {
    const p = prefs();
    const select = <T extends string>(label: string, value: T, options: Choice<T>[], set: (v: T) => void) => {
      const el = h('select', { class: 'gm-select', 'aria-label': label }, ...options.map((o) => h('option', { value: o.value }, o.label))) as HTMLSelectElement;
      el.value = value;
      el.addEventListener('change', () => {
        const pick = options.find((o) => o.value === el.value);
        if (pick) { set(pick.value); hooks.sound('uiPress'); hooks.onSettings(); }
      });
      return h('label', { class: 'gm-slider' }, h('span', null, label), el);
    };
    const back = btn('Back', main, 'primary');
    show(h('div', { class: 'gm-panel wide' },
      h('h2', null, 'ACCESSIBILITY'),
      select('Text size', String(p.textSize ?? 100) as '100' | '125' | '150',
        [{ value: '100', label: '100%' }, { value: '125', label: '125%' }, { value: '150', label: '150%' }],
        (v) => setPrefs({ textSize: Number(v) as 100 | 125 | 150 })),
      select('Colours', p.palette ?? 'standard',
        [{ value: 'standard', label: 'Standard' }, { value: 'okabe', label: 'Colour-blind safe (Okabe-Ito)' }],
        (v) => setPrefs({ palette: v })),
      select('Hold actions', p.holdMode ?? 'hold',
        [{ value: 'hold', label: 'Hold' }, { value: 'toggle', label: 'Press to toggle' }],
        (v) => setPrefs({ holdMode: v })),
      h('div', { class: 'gm-grid' },
        btn(`Captions: ${p.captions ? 'On' : 'Off'}`, () => { setPrefs({ captions: !prefs().captions }); hooks.onSettings(); access(); }, 'toggle')),
      h('p', { class: 'gm-note' }, 'Captions name the sounds that matter. Press to toggle latches the Field Coil, the charged shot and your notes, so you never have to hold a button. Reduce flashes, in Settings, also holds every blink steady.'),
      h('div', { class: 'gm-row' }, h('span'), back)), back);
  };

  const settings = () => {
    const p = prefs();
    const toggle = (label: string, key: 'reduceShake' | 'reduceFlash' | 'damageNumbers') =>
      btn(`${label}: ${p[key] ? 'On' : 'Off'}`, () => { setPrefs({ [key]: !prefs()[key] } as Partial<Prefs>); hooks.onSettings(); settings(); }, 'toggle');
    const rm = p.reducedMotion;
    const slider = (label: string, key: 'volume' | 'sfxVolume' | 'musicVolume') => {
      const out = h('output', null, `${p[key]}`);
      const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: `${p[key]}`, 'aria-label': label }) as HTMLInputElement;
      input.addEventListener('input', () => { out.textContent = input.value; setPrefs({ [key]: Number(input.value) } as Partial<Prefs>); hooks.onSettings(); });
      input.addEventListener('change', () => hooks.sound(key === 'musicVolume' ? 'uiHover' : 'shot'));
      return h('label', { class: 'gm-slider' }, h('span', null, label), input, out);
    };
    const back = btn('Back', main, 'primary');
    show(h('div', { class: 'gm-panel wide' },
      h('h2', null, 'SETTINGS'),
      h('div', { class: 'gm-grid' },
        toggle('Reduce screen shake', 'reduceShake'),
        toggle('Reduce flashes', 'reduceFlash'),
        toggle('Damage numbers', 'damageNumbers'),
        btn(`Reduced motion: ${{ system: 'Follow my system', on: 'On', off: 'Off' }[rm]}`, () => {
          const order = ['system', 'on', 'off'] as const;
          setPrefs({ reducedMotion: order[(order.indexOf(rm) + 1) % 3] });
          hooks.onSettings();
          settings();
        }, 'toggle'),
        btn(`Start in: ${prefs().startIn === 'desktop' ? 'Classic desktop' : 'The game'}`, () => {
          setPrefs({ startIn: prefs().startIn === 'desktop' ? 'game' : 'desktop' });
          settings();
        }, 'toggle')),
      slider('Master volume', 'volume'),
      slider('Effects volume', 'sfxVolume'),
      slider('Music volume', 'musicVolume'),
      h('div', { class: 'gm-row' }, btn('Controls', controls), back)), back);
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
    const render = (first = false) => {
      const rows = ACTIONS.map((a) => h('tr', null,
        h('th', { scope: 'row' }, a.label, a.later ? h('span', { class: 'gm-later' }, ' (later)') : null),
        ...([0, 1] as const).map((col) => {
          const on = waiting?.action === a.id && waiting.col === col;
          return h('td', null, h('button', {
            class: `gm-key${on ? ' on' : ''}`, 'aria-label': `${a.label}, ${col ? 'second' : 'main'} key: ${keyName(b[a.id][col])}. Click to change.`,
            onclick: (e: Event) => { e.stopPropagation(); hooks.sound('uiPress'); start(a.id, col); },
          }, on ? 'Press a key…' : keyName(b[a.id][col])));
        })));
      const panel = h('div', { class: 'gm-panel wide' },
        h('h2', null, 'CONTROLS'),
        h('p', { class: 'gm-note' }, 'Click a key to change it, then press the new key or mouse button. Esc cancels. A key used elsewhere swaps places.'),
        h('div', { class: 'gm-status', role: 'status' }, note),
        h('div', { class: 'gm-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Keys' }, h('table', { class: 'gm-keys' }, h('thead', null, h('tr', null, h('th', null, 'Action'), h('th', null, 'Main'), h('th', null, 'Second'))), h('tbody', null, ...rows))),
        h('h3', { class: 'gm-sub' }, 'Gamepad'),
        h('div', { class: 'gm-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Gamepad buttons' }, h('table', { class: 'gm-keys' },
          h('thead', null, h('tr', null, h('th', null, 'Action'), h('th', null, 'Button'))),
          h('tbody', null, ...padRows().map(([what, button]) => h('tr', null, h('th', { scope: 'row' }, what), h('td', null, button)))))),
        h('h3', { class: 'gm-sub' }, 'Touch'),
        h('ul', { class: 'gm-list' }, ...TOUCH_NOTES.map((t) => h('li', null, t))),
        h('div', { class: 'gm-row' },
          btn('Reset to defaults', () => { save(structuredClone(DEFAULTS)); note = 'Controls reset to the defaults.'; render(); }),
          btn('Done', () => { hooks.input.capture = null; settings(); }, 'primary')));
      if (first) show(panel);
      else root.replaceChildren(panel);
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
    render(true);
  };

  main();
  return root;
}

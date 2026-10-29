// The story's DOM layer over the canvas (Level 1 spec, "Overlays"): the wall port (today's TAPEOUT terminal, running
// one lesson), the patch panel (today's Logic Lab), the bench (today's Verilog lab), the cards (pager, upgrade, info,
// debrief), choice cards, the profile card, the Loft's station panels, and minigames in the arcade. Each eases in and
// out (polish bar P1) and gives focus back to the canvas when it closes.
import { CHIPS, chipProgress, slotProgress } from '../../chip';
import { logicPage } from '../../games/logic/page';
import { rtlPage } from '../../games/rtl/page';
import { findModule } from '../../curriculum';
import { MINIGAMES } from '../../minigames/apps';
import { launchGame, type Mount } from '../../os/launch';
import { levelRecord, onChange, type Profile, setProfile } from '../../state';
import { readableReport } from '../../steplog';
import { progressReport } from '../../term/wrap';
import { Shell } from '../../term/shell';
import { Terminal } from '../../term/terminal';
import { h } from '../../ui/dom';
import { learningRoute } from './route';
import type { StationKind } from './types';

export interface OverlayHost {
  /** The game screen's element: overlays mount inside it, above the canvas. */
  el: HTMLElement;
  /** UI sounds. */
  sound(name: 'uiOpen' | 'uiClose' | 'uiPress'): void;
  /** Called when an overlay opens or the last one closes (the screen mutes game input and ducks the music). */
  busy(on: boolean): void;
  /** Rewrites key names in card text for the device in use (Phase 9 Spec, section 6). */
  text?: (s: string) => string;
}

let open = 0;
function mount(host: OverlayHost, node: HTMLElement, onEsc: (() => void) | null): () => void {
  const wrap = h('div', { class: 'st-overlay' }, node);
  host.el.append(wrap);
  if (open++ === 0) host.busy(true);
  host.sound('uiOpen');
  requestAnimationFrame(() => node.classList.remove('gm-enter'));
  const esc = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' || !onEsc || wrap !== host.el.querySelector('.st-overlay:last-of-type')) return;
    e.preventDefault();
    e.stopPropagation();
    onEsc();
  };
  window.addEventListener('keydown', esc, true);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', esc, true);
    wrap.classList.add('gm-leave');
    host.sound('uiClose');
    setTimeout(() => wrap.remove(), 180);
    if (--open === 0) host.busy(false);
  };
}

const button = (label: string, onclick: () => void, cls = '') => h('button', { class: `gm-btn ${cls}`, onclick }, label);
const starRow = (n: number) => h('div', { class: 'st-stars', 'aria-label': `${n} of 3 stars` }, ...[0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : '' }, '★')));
const recordKey = (id: string) => JSON.stringify(levelRecord(id) ?? null);

/** The playtest log (`log export` in the terminal): the per-step report and the progress JSON, to the clipboard. */
async function copyLog(): Promise<boolean> {
  const text = `${readableReport()}\n\n--- progress (JSON) ---\n${JSON.stringify(progressReport(), null, 2)}`;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** A framed device window: the station's name in the header, a close button, the content below. */
function frame(title: string, sub: string, body: HTMLElement, close: () => void, closeLabel: string) {
  const btn = h('button', { class: 'gm-btn mini st-close', onclick: close, 'data-testid': 'overlay-close' }, closeLabel);
  return h('div', { class: 'st-frame gm-enter', role: 'dialog', 'aria-label': title },
    h('header', { class: 'st-frame-head' }, h('b', null, title), h('span', { class: 'dim' }, sub), h('span', { class: 'spacer' }), btn),
    h('div', { class: 'st-frame-body' }, body));
}

/** A minigame inside the game: the same app, framed like a station. */
export function gameMount(host: OverlayHost): Mount {
  return ({ title, content, onClose }) => {
    let done: () => void = () => {};
    const close = () => { done(); onClose(); };
    const node = frame(title, 'ARCADE', h('div', { class: 'st-mini' }, content), close, 'Close · Esc');
    done = mount(host, node, close);
    return { close: () => done() };
  };
}

/**
 * The wall port: TAPEOUT's terminal, running one lesson. `onClose(passed)`: passed when the lesson's record appeared or
 * improved while the port was open.
 */
export function openPort(host: OverlayHost, module: string, onAnswer: (ok: boolean) => void, onClose: (passed: boolean) => void, o: { label?: string; practice?: boolean } = {}) {
  const before = recordKey(module);
  const term = new Terminal();
  const shell = new Shell(term, () => {}, { embedded: true, onAnswer, launch: (id, o) => launchGame(id, { ...o, mount: gameMount(host) }) });
  const title = findModule(module)?.module.title ?? module;
  let done: () => void = () => {};
  const close = () => {
    done();
    term.interrupt();
    off();
    onClose(recordKey(module) !== before && !!levelRecord(module));
  };
  const node = frame(`${o.label ?? 'PORT'} · ${title.toUpperCase()}`, 'TAPEOUT terminal', h('div', { class: 'st-term' }, term.el), close, 'Unplug · Esc');
  node.dataset.testid = 'port';
  done = mount(host, node, close);
  // when the lesson signs off, the port says so and offers to unplug
  const off = onChange(() => {
    if (recordKey(module) !== before && !node.querySelector('.st-unplug')) {
      node.querySelector('.st-frame-head')!.append(button('Done · unplug', close, 'primary mini st-unplug'));
    }
  });
  setTimeout(() => { term.focus(); void (o.practice ? shell.exec(`practice ${module}`) : shell.runLesson(module)); }, 60);
}

/**
 * The patch panel (Logic Lab) or the bench (Verilog lab), framed. Closes itself a moment after a pass. `o` names another
 * lab page and its frame label (story/open.ts opens every lab kind through here).
 */
export function openLab(host: OverlayHost, kind: 'panel' | 'bench', module: string, onClose: (passed: boolean) => void, o: { page?: (id: string) => HTMLElement; label?: string; sub?: string } = {}) {
  const before = recordKey(module);
  const page = (o.page ?? (kind === 'panel' ? logicPage : rtlPage))(module);
  const title = findModule(module)?.module.title ?? module;
  let done: () => void = () => {};
  let off = () => {};
  const close = () => { done(); off(); onClose(recordKey(module) !== before && !!levelRecord(module)); };
  const node = frame(`${o.label ?? (kind === 'panel' ? 'PATCH PANEL' : 'WORKBENCH')} · ${title.toUpperCase()}`, o.sub ?? (kind === 'panel' ? 'Logic Lab' : 'Verilog lab'), h('div', { class: `st-lab lab-${kind}` }, page), close, 'Close · Esc');
  node.dataset.testid = kind;
  // a desktop page's own links (its "Map /" crumbs) would leave the game: inside the overlay they close it instead
  node.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || !a.getAttribute('href')?.startsWith('#/')) return;
    e.preventDefault();
    close();
  });
  done = mount(host, node, close);
  off = onChange(() => {
    if (recordKey(module) !== before && !node.querySelector('.st-unplug')) node.querySelector('.st-frame-head')!.append(button('It works · back to the room', close, 'primary mini st-unplug'));
  });
}

/** A card: the pager, an upgrade, an info note or a debrief. One button closes it. */
export function openCard(host: OverlayHost, c: { kind: 'pager' | 'upgrade' | 'debrief' | 'info'; title: string; lines: string[]; stars?: number; button?: string }, onClose: () => void) {
  let done: () => void = () => {};
  const close = () => { done(); onClose(); };
  const ok = button(c.button ?? (c.kind === 'upgrade' ? 'Got it' : 'Continue'), close, 'primary');
  const node = h('div', { class: `gm-panel wide st-card ${c.kind} gm-enter`, role: 'dialog', 'aria-label': c.title, 'data-testid': 'story-card' },
    h('h2', null, c.title),
    c.stars !== undefined ? starRow(c.stars) : null,
    ...c.lines.map((l) => h('p', { class: 'st-line' }, host.text?.(l) ?? l)),
    h('div', { class: 'gm-row' }, h('span'), ok));
  done = mount(host, node, close);
  setTimeout(() => ok.focus(), 30);
}

/** A choice card: pick one option (or back out, where `back` is given). */
export function openChoice(host: OverlayHost, c: { title: string; lines?: string[]; options: { text: string; dim?: boolean }[]; back?: string }, onPick: (i: number) => void) {
  let done: () => void = () => {};
  const pick = (i: number) => { done(); onPick(i); };
  const btns = c.options.map((o, i) => button(o.text, () => pick(i), o.dim ? 'dim' : ''));
  const node = h('div', { class: 'gm-panel wide st-choice gm-enter', role: 'dialog', 'aria-label': c.title, 'data-testid': 'story-choice' },
    h('h2', null, c.title), ...(c.lines ?? []).map((l) => h('p', { class: 'st-line' }, host.text?.(l) ?? l)), ...btns, c.back ? h('div', { class: 'gm-row' }, h('span'), button(c.back, () => pick(-1), 'mini')) : null);
  done = mount(host, node, c.back ? () => pick(-1) : null);
  setTimeout(() => btns.find((b) => !b.classList.contains('dim'))?.focus(), 30);
}

/** First run in the game with no profile yet: a name, and where to start. */
export function openProfile(host: OverlayHost, onClose: () => void) {
  let done: () => void = () => {};
  const name = h('input', { class: 'st-input', type: 'text', maxlength: '24', placeholder: 'your name', 'aria-label': 'Your name', 'aria-describedby': 'st-name-note', autocomplete: 'off' }) as HTMLInputElement;
  // the error is words, announced as it appears, and the field is marked invalid until a name is typed (WCAG 3.3.1)
  const note = h('p', { class: 'gm-status', id: 'st-name-note', role: 'status' });
  name.addEventListener('input', () => name.removeAttribute('aria-invalid'));
  const go = (background: Profile['background']) => {
    const n = name.value.trim().replace(/[<>]/g, '').slice(0, 24);
    if (!n) { note.textContent = 'Type a name first. Even a repair tech has one.'; name.setAttribute('aria-invalid', 'true'); name.focus(); return; }
    setProfile({ name: n, background, goal: 'unsure', since: Date.now() });
    done();
    onClose();
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go('new'); e.stopPropagation(); });
  const node = h('div', { class: 'gm-panel wide st-card gm-enter', role: 'dialog', 'aria-label': 'Who is fixing me?', 'data-testid': 'story-profile' },
    h('h2', null, 'WHO IS FIXING ME?'),
    h('p', { class: 'st-line' }, 'A repair drone is booting inside a broken chip. You steer it. What should TAPEOUT call you?'),
    name, note,
    button('I am new to this', () => go('new'), 'primary'),
    button('I have studied some electronics', () => go('student')),
    h('p', { class: 'gm-note' }, 'Either way you start at the first room. Story difficulty for new players, Standard otherwise. You can change it in the pause menu.'));
  done = mount(host, node, null);
  setTimeout(() => name.focus(), 40);
}

/**
 * The Learning route (Phase 10 Spec, section 2.7): every open place in play order, each a heading and its modules as
 * buttons. A module button calls `open` (the story's module opener, which reports back through its onClose); when the
 * module closes, the list comes back with focus on that button. "Back to the map" and Escape call `back`.
 */
export function openLearningRoute(host: OverlayHost, open: (id: string, onClose: (passed: boolean) => void) => void, back: () => void, focus?: string) {
  let done: () => void = () => {};
  const toMap = () => { done(); back(); };
  const pick = (id: string) => { done(); open(id, () => openLearningRoute(host, open, back, id)); };
  const btns = new Map<string, HTMLButtonElement>();
  const body = h('div', null, ...learningRoute((id) => !!levelRecord(id)).flatMap(({ place, modules }) => [
    h('h3', null, place.name),
    h('ul', { class: 'st-route' }, ...modules.map((m) => {
      const b = h('button', { class: `gm-btn ${m.done ? '' : 'primary'}`, onclick: () => pick(m.id) }, `${m.title}${m.done ? ' ✓' : ''} `, h('span', { class: 'dim' }, m.kind));
      btns.set(m.id, b);
      return h('li', null, b);
    })),
  ]));
  const node = h('div', { class: 'gm-panel wide st-card gm-enter', role: 'dialog', 'aria-label': 'Learning route', 'data-testid': 'story-route' },
    h('h2', null, 'LEARNING ROUTE'),
    body,
    h('div', { class: 'gm-row' }, h('span'), button('Back to the map', toMap, 'primary')));
  done = mount(host, node, toMap);
  const first = focus ? btns.get(focus) : [...btns.values()][0];
  setTimeout(() => first?.focus(), 30);
}

/** The Loft's stations that open a panel. */
export function openLoft(host: OverlayHost, kind: StationKind, a: { log: string[]; openLesson: (id: string) => void; settings: () => void; openModule?: (id: string, onClose: (passed: boolean) => void) => void }, onClose: () => void) {
  let done: () => void = () => {};
  const close = () => { done(); onClose(); };
  let body: HTMLElement;
  let title = '';
  switch (kind) {
    case 'archive': {
      title = 'THE ARCHIVE';
      const status = h('p', { class: 'gm-status' });
      body = h('div', null,
        h('p', { class: 'st-line' }, 'Everything TAPEOUT has said to you, newest last.'),
        h('ol', { class: 'st-log' }, ...a.log.slice(-40).map((l) => h('li', null, l))),
        h('div', { class: 'gm-row wrap' },
          button('Copy the play log', () => { void copyLog().then((ok) => (status.textContent = ok ? 'Copied the play log. Paste it into a message to whoever runs your playtest.' : 'The clipboard is blocked here. Type `log export` in the old desktop terminal instead.')); }),
          button('Save or load your game', () => { close(); a.settings(); })),
        status);
      break;
    }
    case 'review': {
      title = 'THE REVIEW DESK';
      body = h('div', null, h('p', { class: 'st-line' }, 'A few minutes of review keeps what you learned. Today it covers Bit Zero.'),
        h('div', { class: 'gm-row wrap' }, ...['first-wire', 'bits', 'bool', 'first-not', 'first-and'].filter((id) => levelRecord(id)).map((id) => button(findModule(id)?.module.title ?? id, () => { close(); a.openLesson(id); }))),
        h('p', { class: 'gm-note' }, 'Each one runs at the port, like before. Your best result is kept.'));
      break;
    }
    case 'board': {
      title = 'THE CHALKBOARD';
      const ids = ['electricity', 'resistance'].filter((id) => findModule(id));
      body = h('div', null, h('p', { class: 'st-line' }, 'Volts, amps and ohms. The power rooms in Level 2 need these. Study them here first.'),
        h('div', { class: 'gm-row wrap' }, ...ids.map((id) => button(`${findModule(id)!.module.title}${levelRecord(id) ? ' ✓' : ''}`, () => { close(); a.openLesson(id); }, levelRecord(id) ? '' : 'primary'))));
      break;
    }
    case 'map': {
      title = 'THE CHIP MAP';
      const chip = CHIPS[0];
      const p = chipProgress(chip);
      const route = a.openModule;
      body = h('div', null,
        h('p', { class: 'st-line' }, `${chip.name}: ${p.built} of ${p.total} parts built. Each block lights as you repair it.`),
        h('div', { class: 'st-map' }, ...chip.blocks.map((b) => {
          const states = b.slots.map((s) => slotProgress(s).state);
          const cls = states.every((s) => s === 'built') ? 'built' : states.some((s) => s !== 'empty') ? 'half' : 'empty';
          return h('div', { class: `st-block ${cls}` }, h('b', null, b.name), h('span', { class: 'dim' }, cls === 'built' ? 'working' : cls === 'half' ? 'half lit' : 'dark'));
        })),
        // the route needs the story's module opener (it gives back the room's rewards); without one it is not offered
        route ? h('div', { class: 'gm-row wrap' }, button('Learning route', () => { done(); openLearningRoute(host, route, () => openLoft(host, 'map', a, onClose)); })) : null);
      break;
    }
    case 'arcade': {
      title = 'THE ARCADE';
      body = h('div', null, h('p', { class: 'st-line' }, 'Quick games on what you have learned. Good for a break.'),
        h('div', { class: 'gm-grid' }, ...MINIGAMES.map((g) => button(`${g.icon}  ${g.title}`, () => { close(); void launchGame(g.id, { mount: gameMount(host) }); }))));
      break;
    }
    default:
      return onClose();
  }
  const node = h('div', { class: 'gm-panel wide st-card gm-enter', role: 'dialog', 'aria-label': title, 'data-testid': 'story-loft' }, h('h2', null, title), body, h('div', { class: 'gm-row' }, h('span'), button('Back to the Loft', close, 'primary')));
  done = mount(host, node, close);
}

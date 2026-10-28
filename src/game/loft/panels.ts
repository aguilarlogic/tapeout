// The Loft's station panels (Phase 3 Spec, section 8): the chip map, the chalkboard, the review desk, the calibration
// range and the patrol board. Each is a framed card drawn like the Loft's panels in story/overlay.ts, and its rows come
// from data.ts. Every row is a real button; a choice closes the panel before it acts.
import { CHIPS, chipProgress, slotProgress } from '../../chip';
import { dailyGoal, levelRecord } from '../../state';
import { dayKey, streakLine } from '../../streak';
import { h } from '../../ui/dom';
import type { OverlayHost } from '../story/overlay';
import { calibRows, mapRows, reviewDue, studyRows } from './data';

/** The Loft panels that open from a station. */
export type LoftPanel = 'map' | 'board' | 'review' | 'calib' | 'patrol';

/** What a panel's buttons do. The lead supplies these; the panels only call them after the panel closes. */
export interface LoftActions {
  /** Opens a module at its port, gate, bench or panel. */
  openModule(id: string): void;
  /** Goes to a place's landing. */
  go(place: string): void;
  /** Starts today's Daily Mix. */
  openMix(): void;
  /** The Mk II a chapter's banks unlock: its state, or null when the chapter has none. */
  mk2(chapter: string): { name: string; online: boolean; done: number; total: number } | null;
}

const recorded = (id: string) => !!levelRecord(id);
const button = (label: string, onclick: () => void, cls = '') => h('button', { class: `gm-btn ${cls}`, onclick }, label);
/** Three stars, filled by count: ★★☆. */
const starText = (n: number) => [0, 1, 2].map((i) => (i < n ? '★' : '☆')).join('');

let open = 0;
/** Mounts a panel in the host, the way story/overlay.ts mounts its cards: eases in, Escape closes, the host hears it. */
function mount(host: OverlayHost, node: HTMLElement, onEsc: () => void): () => void {
  const wrap = h('div', { class: 'st-overlay' }, node);
  host.el.append(wrap);
  if (open++ === 0) host.busy(true);
  host.sound('uiOpen');
  requestAnimationFrame(() => node.classList.remove('gm-enter'));
  const esc = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' || wrap !== host.el.querySelector('.st-overlay:last-of-type')) return;
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

/** The chip map: today's ADA-1 block grid, then the act 1 places with their percent done and a Go button when open. */
function chipMap(a: LoftActions, choose: (run: () => void) => void): HTMLElement {
  const chip = CHIPS[0];
  const p = chipProgress(chip);
  return h('div', null,
    h('p', { class: 'st-line' }, `${chip.name}: ${p.built} of ${p.total} parts built. Each block lights as you repair it.`),
    h('div', { class: 'st-map' }, ...chip.blocks.map((b) => {
      const states = b.slots.map((s) => slotProgress(s).state);
      const cls = states.every((s) => s === 'built') ? 'built' : states.some((s) => s !== 'empty') ? 'half' : 'empty';
      return h('div', { class: `st-block ${cls}` }, h('b', null, b.name), h('span', { class: 'dim' }, cls === 'built' ? 'working' : cls === 'half' ? 'half lit' : 'dark'));
    })),
    h('p', { class: 'st-line' }, 'Act 1, place by place.'),
    h('ol', { class: 'st-log' }, ...mapRows(recorded).map((r) => h('li', null,
      h('b', null, r.name), ' ', h('span', { class: 'dim' }, `${r.pct}% done`), ' ',
      r.open ? button('Go', () => choose(() => a.go(r.place)), 'primary mini') : h('span', { class: 'dim' }, 'Locked')))));
}

/** The chalkboard: the open study rooms, each with its modules as buttons and a line once it is complete. */
function chalkboard(a: LoftActions, choose: (run: () => void) => void): HTMLElement {
  const rows = studyRows(recorded);
  return h('div', null,
    h('p', { class: 'st-line' }, 'Study rooms. Each one opens at the port, like before.'),
    rows.length ? null : h('p', { class: 'gm-note' }, 'No study room is open yet.'),
    ...rows.map((r) => h('div', null,
      h('h3', null, r.name),
      h('div', { class: 'gm-row wrap' }, ...r.modules.map((m) => button(`${m.title}${m.done ? ' ✓' : ''}`, () => choose(() => a.openModule(m.id)), m.done ? '' : 'primary'))),
      r.complete ? h('p', { class: 'st-line' }, r.place === 'volts-and-amps' ? 'All done. The Power Cell is yours.' : 'All done.') : null)));
}

/** The review desk: the lessons due today, as buttons, or a line when none is due. */
function reviewDesk(a: LoftActions, choose: (run: () => void) => void): HTMLElement {
  const due = reviewDue();
  return h('div', null,
    h('p', { class: 'st-line' }, 'A few minutes of review keeps what you learned.'),
    due.length
      ? h('div', { class: 'gm-row wrap' }, ...due.map((d) => button(d.title, () => choose(() => a.openModule(d.id)))))
      : h('p', { class: 'gm-note' }, 'Nothing due today. Come back tomorrow.'));
}

/** The calibration range: one rig per chapter with practice banks, and the Mk II each chapter unlocks. */
function calibration(a: LoftActions, choose: (run: () => void) => void): HTMLElement {
  const rigs = calibRows(recorded);
  return h('div', null,
    h('p', { class: 'st-line' }, 'Practice banks tune your parts. They never lock a door.'),
    rigs.length ? null : h('p', { class: 'gm-note' }, 'No practice banks are open yet.'),
    ...rigs.map((r) => {
      const mk2 = a.mk2(r.chapter);
      return h('div', null,
        h('h3', null, r.chapter),
        h('div', { class: 'gm-row wrap' }, ...r.banks.map((b) => button(`${b.title} ${starText(b.stars)}`, () => choose(() => a.openModule(b.id))))),
        mk2 ? h('p', { class: 'gm-status' }, mk2.online ? `${mk2.name} Mk II online` : `${mk2.name} Mk II: ${mk2.done} of ${mk2.total} banks`) : null);
    }));
}

/** The patrol board: the streak line, whether today's goal is done, and the button to start today's Daily Mix. */
function patrol(a: LoftActions, choose: (run: () => void) => void): HTMLElement {
  const today = dayKey();
  const goal = dailyGoal();
  return h('div', null,
    h('p', { class: 'st-line' }, "Today's patrol: one Daily Mix keeps your streak alive."),
    h('p', { class: 'gm-status' }, streakLine(goal, today)),
    h('p', { class: 'dim' }, goal.last === today ? 'Goal done today' : 'Goal not done yet'),
    h('div', { class: 'gm-row wrap' }, button("Start today's Daily Mix", () => choose(() => a.openMix()), 'primary')));
}

/**
 * Opens one Loft panel. Its buttons close it, then act (through `a`). `onClose` runs when it closes, however it closes.
 */
export function openLoftPanel(host: OverlayHost, kind: LoftPanel, a: LoftActions, onClose: () => void): void {
  let done: () => void = () => {};
  const close = () => { done(); onClose(); };
  const choose = (run: () => void) => { close(); run(); };
  const titles: Record<LoftPanel, string> = { map: 'THE CHIP MAP', board: 'THE CHALKBOARD', review: 'THE REVIEW DESK', calib: 'THE CALIBRATION RANGE', patrol: 'THE PATROL BOARD' };
  const bodies: Record<LoftPanel, () => HTMLElement> = {
    map: () => chipMap(a, choose),
    board: () => chalkboard(a, choose),
    review: () => reviewDesk(a, choose),
    calib: () => calibration(a, choose),
    patrol: () => patrol(a, choose),
  };
  const title = titles[kind];
  const node = h('div', { class: 'gm-panel wide st-card gm-enter', role: 'dialog', 'aria-label': title, 'data-testid': 'story-loft' },
    h('h2', null, title), bodies[kind](), h('div', { class: 'gm-row' }, h('span'), button('Back to the Loft', close, 'primary')));
  done = mount(host, node, close);
}

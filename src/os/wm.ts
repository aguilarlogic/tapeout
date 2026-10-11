// A tiny window manager: draggable, resizable, minimizable windows plus taskbar buttons.
// Windows live in one of two regions (see regions.ts). The mentor region holds one docked window (the terminal)
// that fills its column and cannot be moved, minimized or closed. The workspace holds floating windows.
import { pace } from '../term/terminal';
import { animate, progressBar, spinFrame, type Token } from '../term/typewriter';
import { h } from '../ui/dom';
import { type Region, regionEl } from './regions';

export interface WinOpts {
  id: string;
  title: string;
  icon?: string;
  content: HTMLElement;
  /** Which region the window opens in. Defaults to the workspace; 'mentor' docks it into the mentor column. */
  region?: Region;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  maximized?: boolean;
  /** Called when the user closes the window (not when it is replaced). */
  onClose?: () => void;
  /** Show a short TAPE-OS loading screen ("loading Map.app") over the content first. */
  loading?: string;
}

export interface Win {
  id: string;
  el: HTMLElement;
  body: HTMLElement;
  setTitle(t: string): void;
  setContent(c: HTMLElement): void;
  focus(): void;
  close(): void;
  minimize(): void;
  onClose?: () => void;
}

let tasks: HTMLElement;
let z = 10;
const wins = new Map<string, Win>();
const listeners = new Set<() => void>();
export const onWindowsChange = (f: () => void) => listeners.add(f);
const changed = () => listeners.forEach((f) => f());

export function initWM(taskArea: HTMLElement) {
  tasks = taskArea;
}

const small = () => window.innerWidth < 760;

export function getWindow(id: string) {
  return wins.get(id);
}

export function focusedWindow(): string | undefined {
  let best: [string, number] | undefined;
  for (const [id, w] of wins) {
    const zi = +w.el.style.zIndex;
    if (!w.el.classList.contains('min') && (!best || zi > best[1])) best = [id, zi];
  }
  return best?.[0];
}

/** A spinner and progress bar over a window's content for well under a second. Any key or click skips it. */
function loadingScreen(body: HTMLElement, label: string) {
  const ms = Math.min(600, pace().load * 0.7);
  if (!ms) return;
  const spin = h('span', { class: 'spin' }, spinFrame(0));
  const barEl = h('div', { class: 'pbar' }, progressBar(0, 22));
  const ov = h('div', { class: 'win-loading', role: 'status' }, h('div', null, spin, ' ', `loading ${label}`), barEl);
  body.append(ov);
  const tk: Token = { skip: false };
  const skip = () => (tk.skip = true);
  ov.addEventListener('click', skip);
  window.addEventListener('keydown', skip, true);
  void animate(ms, (t) => { spin.textContent = spinFrame(t); barEl.textContent = progressBar(t / ms, 22); }, tk).then(() => {
    window.removeEventListener('keydown', skip, true);
    ov.classList.add('bye');
    setTimeout(() => ov.remove(), 160);
  });
}

export function openWindow(o: WinOpts): Win {
  const existing = wins.get(o.id);
  if (existing) {
    existing.setTitle(o.title);
    existing.setContent(o.content);
    existing.onClose = o.onClose;
    existing.el.classList.remove('min');
    existing.focus();
    if (o.loading) loadingScreen(existing.body, o.loading);
    return existing;
  }
  const region = o.region ?? 'workspace';
  const docked = region === 'mentor';
  const host = regionEl(region);
  if (!host) throw new Error(`desktop region "${region}" is not built yet`);

  const titleEl = h('span', { class: 'win-title' }, o.title);
  const body = h('div', { class: 'win-body' }, o.content);
  const btnMin = h('button', { class: 'win-btn', title: 'Minimize', 'aria-label': 'Minimize' }, '–');
  const btnMax = h('button', { class: 'win-btn', title: 'Maximize', 'aria-label': 'Maximize' }, '□');
  const btnClose = h('button', { class: 'win-btn close', title: 'Close', 'aria-label': 'Close' }, '×');
  const bar = h('div', { class: 'win-bar' }, h('span', { class: 'win-icon', 'aria-hidden': 'true' }, o.icon ?? '▣'), titleEl, h('span', { class: 'spacer' }), btnMin, btnMax, btnClose);
  const el = h('section', { class: docked ? 'win docked' : 'win', role: 'dialog', 'aria-label': o.title }, bar, body);

  // Docked windows fill their region through CSS; floating ones are sized and placed here.
  if (!docked) {
    const dw = host.clientWidth, dh = host.clientHeight;
    const w = Math.min(o.w ?? 900, dw - 16), hh = Math.min(o.h ?? 600, dh - 16);
    const cascade = (wins.size % 5) * 26;
    el.style.width = `${w}px`;
    el.style.height = `${hh}px`;
    el.style.left = `${Math.max(8, Math.min(dw - w - 8, o.x ?? (dw - w) / 2 + cascade))}px`;
    el.style.top = `${Math.max(8, Math.min(dh - hh - 8, o.y ?? 20 + cascade))}px`;
    if (o.maximized) el.classList.add('max');
  }

  const taskBtn = h('button', { class: 'task', title: o.title, 'aria-label': o.title }, h('span', { class: 'task-icon' }, o.icon ?? '▣'), h('span', { class: 'task-label' }, o.title));

  const win: Win = {
    id: o.id, el, body, onClose: o.onClose,
    setTitle(t) { titleEl.textContent = t; taskBtn.title = t; taskBtn.setAttribute('aria-label', t); taskBtn.querySelector('.task-label')!.textContent = t; el.setAttribute('aria-label', t); },
    setContent(c) { body.replaceChildren(c); body.scrollTop = 0; },
    focus() {
      el.classList.remove('min');
      el.style.zIndex = String(++z);
      document.querySelectorAll('.win.focused').forEach((x) => x.classList.remove('focused'));
      el.classList.add('focused');
      tasks.querySelectorAll('.task.on').forEach((x) => x.classList.remove('on'));
      taskBtn.classList.add('on');
      changed();
    },
    close() {
      el.remove();
      taskBtn.remove();
      wins.delete(o.id);
      changed();
      const next = focusedWindow();
      if (next) wins.get(next)!.focus();
    },
    minimize() {
      if (docked) return; // the mentor column is always on screen
      el.classList.add('min');
      el.classList.remove('focused');
      taskBtn.classList.remove('on');
      changed();
    },
  };
  const toggleMax = () => { if (!docked) el.classList.toggle('max'); };
  btnClose.addEventListener('click', () => { if (docked) return; const cb = win.onClose; win.close(); cb?.(); });
  btnMin.addEventListener('click', () => win.minimize());
  btnMax.addEventListener('click', toggleMax);
  bar.addEventListener('dblclick', (e) => { if (!(e.target as HTMLElement).closest('button')) toggleMax(); });
  el.addEventListener('pointerdown', () => { if (!el.classList.contains('focused')) win.focus(); }, true);
  taskBtn.addEventListener('click', () => (el.classList.contains('focused') ? win.minimize() : win.focus()));

  // dragging by the title bar (floating windows only)
  bar.addEventListener('pointerdown', (e) => {
    if (docked || (e.target as HTMLElement).closest('button') || el.classList.contains('max') || small()) return;
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      el.style.left = `${Math.max(-el.offsetWidth + 80, Math.min(host.clientWidth - 80, ox + ev.clientX - sx))}px`;
      el.style.top = `${Math.max(0, Math.min(host.clientHeight - 40, oy + ev.clientY - sy))}px`;
    };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });

  host.append(el);
  tasks.append(taskBtn);
  wins.set(o.id, win);
  win.focus();
  if (o.loading) loadingScreen(body, o.loading);
  return win;
}

export function closeWindow(id: string) {
  wins.get(id)?.close();
}

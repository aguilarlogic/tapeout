// A tiny window manager: draggable, resizable, minimizable windows plus taskbar buttons.
import { h } from '../ui/dom';

export interface WinOpts {
  id: string;
  title: string;
  icon?: string;
  content: HTMLElement;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  maximized?: boolean;
  /** Called when the user closes the window (not when it is replaced). */
  onClose?: () => void;
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

let desktop: HTMLElement;
let tasks: HTMLElement;
let z = 10;
const wins = new Map<string, Win>();
const listeners = new Set<() => void>();
export const onWindowsChange = (f: () => void) => listeners.add(f);
const changed = () => listeners.forEach((f) => f());

export function initWM(d: HTMLElement, taskArea: HTMLElement) {
  desktop = d;
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

export function openWindow(o: WinOpts): Win {
  const existing = wins.get(o.id);
  if (existing) {
    existing.setTitle(o.title);
    existing.setContent(o.content);
    existing.onClose = o.onClose;
    existing.el.classList.remove('min');
    existing.focus();
    return existing;
  }
  const titleEl = h('span', { class: 'win-title' }, o.title);
  const body = h('div', { class: 'win-body' }, o.content);
  const btnMin = h('button', { class: 'win-btn', title: 'Minimize', 'aria-label': 'Minimize' }, '–');
  const btnMax = h('button', { class: 'win-btn', title: 'Maximize', 'aria-label': 'Maximize' }, '□');
  const btnClose = h('button', { class: 'win-btn close', title: 'Close', 'aria-label': 'Close' }, '×');
  const bar = h('div', { class: 'win-bar' }, h('span', { class: 'win-icon', 'aria-hidden': 'true' }, o.icon ?? '▣'), titleEl, h('span', { class: 'spacer' }), btnMin, btnMax, btnClose);
  const el = h('section', { class: 'win', role: 'dialog', 'aria-label': o.title }, bar, body);

  const dw = desktop.clientWidth, dh = desktop.clientHeight;
  const w = Math.min(o.w ?? 900, dw - 16), hh = Math.min(o.h ?? 600, dh - 16);
  const cascade = (wins.size % 5) * 26;
  el.style.width = `${w}px`;
  el.style.height = `${hh}px`;
  // New windows prefer the free space to the right of the terminal, so TAPEOUT stays visible.
  const term = wins.get('term')?.el;
  const right = term && !term.classList.contains('min') ? term.offsetLeft + term.offsetWidth + 12 : 0;
  const autoX = right && dw - right >= w + 8 ? right + Math.min(cascade, dw - right - w - 8) : (dw - w) / 2 + cascade;
  el.style.left = `${Math.max(8, Math.min(dw - w - 8, o.x ?? autoX))}px`;
  el.style.top = `${Math.max(8, Math.min(dh - hh - 8, o.y ?? 20 + cascade))}px`;
  if (o.maximized) el.classList.add('max');

  const taskBtn = h('button', { class: 'task', title: o.title }, h('span', { class: 'task-icon' }, o.icon ?? '▣'), h('span', { class: 'task-label' }, o.title));

  const win: Win = {
    id: o.id, el, body, onClose: o.onClose,
    setTitle(t) { titleEl.textContent = t; taskBtn.title = t; taskBtn.querySelector('.task-label')!.textContent = t; el.setAttribute('aria-label', t); },
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
      el.classList.add('min');
      el.classList.remove('focused');
      taskBtn.classList.remove('on');
      changed();
    },
  };
  btnClose.addEventListener('click', () => { const cb = win.onClose; win.close(); cb?.(); });
  btnMin.addEventListener('click', () => win.minimize());
  btnMax.addEventListener('click', () => el.classList.toggle('max'));
  bar.addEventListener('dblclick', (e) => { if (!(e.target as HTMLElement).closest('button')) el.classList.toggle('max'); });
  el.addEventListener('pointerdown', () => { if (!el.classList.contains('focused')) win.focus(); }, true);
  taskBtn.addEventListener('click', () => (el.classList.contains('focused') ? win.minimize() : win.focus()));

  // dragging by the title bar
  bar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button') || el.classList.contains('max') || small()) return;
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      el.style.left = `${Math.max(-el.offsetWidth + 80, Math.min(desktop.clientWidth - 80, ox + ev.clientX - sx))}px`;
      el.style.top = `${Math.max(0, Math.min(desktop.clientHeight - 40, oy + ev.clientY - sy))}px`;
    };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });

  desktop.append(el);
  tasks.append(taskBtn);
  wins.set(o.id, win);
  win.focus();
  return win;
}

export function closeWindow(id: string) {
  wins.get(id)?.close();
}

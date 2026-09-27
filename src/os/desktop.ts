// TAPE-OS: the desktop the whole game lives in. The terminal (TAPEOUT) is always there; labs, minigames,
// the map and flashcards open as windows. URLs (#/rtl/fifo, #/learn/cache...) open the matching window.
import { findModule, KIND_APP } from '../curriculum';
import { coveragePage } from '../games/coverage/page';
import { drillsPage } from '../games/drills/page';
import { logicPage } from '../games/logic/page';
import { pcbPage } from '../games/pcb/page';
import { rtlPage } from '../games/rtl/page';
import { timingPage } from '../games/timing/page';
import { uvmPage } from '../games/uvm/page';
import { MINIGAMES } from '../minigames/apps';
import { onChange, profile, rank, resetAll, totalXp } from '../state';
import { Shell } from '../term/shell';
import { Terminal } from '../term/terminal';
import { h } from '../ui/dom';
import { avatar } from './avatar';
import { launchGame } from './launch';
import { mapApp } from './map';
import { bindMentorLog } from './mentor';
import { getWindow, initWM, openWindow } from './wm';

const LABS: Record<string, (id: string) => HTMLElement> = {
  logic: logicPage, rtl: rtlPage, pcb: pcbPage, sta: timingPage, cov: coveragePage, uvm: uvmPage,
};

let term: Terminal;
let shell: Shell;

function openTerminal() {
  const d = document.getElementById('desktop')!;
  const wide = d.clientWidth >= 1100;
  const content = h('div', { class: 'term-window' },
    h('div', { class: 'term-side' }, avatar(84), h('div', { class: 'term-side-name' }, 'TAPEOUT'), h('div', { class: 'term-side-sub' }, 'mentor · v1.0')),
    term.el);
  const w = openWindow({
    id: 'term', title: 'tapeout — mentor', icon: '›_', content,
    x: 16, y: 16, w: wide ? Math.min(760, d.clientWidth * 0.5) : d.clientWidth, h: d.clientHeight - 32,
  });
  term.focus();
  return w;
}

function openMap() {
  openWindow({ id: 'map', title: 'Map.app — campaign', icon: '◈', content: mapApp(), w: 980, h: 720, onClose: home });
}

function home() {
  if (location.hash && location.hash !== '#/') location.hash = '#/';
}

function route() {
  const [section, id] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  document.querySelectorAll('.modal-bg').forEach((m) => m.remove());
  if (!section) {
    (getWindow('term') ?? openTerminal()).focus();
    term.focus();
    return;
  }
  if (section === 'learn' && id) {
    (getWindow('term') ?? openTerminal()).focus();
    if (profile()) shell.run(`learn ${id}`);
    return;
  }
  if (section === 'map' || section === 'track') return openMap();
  if (section === 'drills') {
    openWindow({ id: 'drills', title: 'Flashcards.app — interview gauntlet', icon: '?!', content: drillsPage(id), w: 860, h: 680, onClose: home });
    return;
  }
  if (section === 'play') {
    void launchGame(id ?? MINIGAMES[0].id);
    return;
  }
  const lab = LABS[section];
  if (lab && id) {
    const m = findModule(id);
    const app = m ? KIND_APP[m.module.kind] : 'Lab';
    openWindow({ id: 'lab', title: `${app} — ${m?.module.title ?? id}`, icon: '▣', content: lab(id), maximized: true, onClose: home });
    return;
  }
  home();
}

function taskbar(): HTMLElement {
  const tray = h('div', { class: 'tray' });
  const clock = h('span', { class: 'clock' });
  const renderTray = () => {
    const xp = totalXp(), r = rank(xp);
    tray.replaceChildren(
      h('span', { class: 'tray-rank', title: r.next ? `${r.next.xp - xp} XP to ${r.next.title}` : 'Top rank' }, r.title),
      h('div', { class: 'track small' }, h('div', { class: 'fill', style: `width:${Math.round(r.progress * 100)}%` })),
      h('span', { class: 'dim' }, `${xp} XP`),
      clock);
  };
  const tick = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  tick();
  setInterval(tick, 30000);
  renderTray();
  onChange(() => {
    renderTray();
    const map = getWindow('map');
    if (map) map.setContent(mapApp());
  });

  const menu = h('div', { class: 'start-menu', hidden: true, role: 'menu' });
  const item = (icon: string, label: string, fn: () => void) => h('button', { class: 'start-item', role: 'menuitem', onclick: () => { menu.hidden = true; fn(); } }, h('span', { class: 'si-icon' }, icon), label);
  menu.append(
    h('div', { class: 'start-head' }, h('b', null, 'TAPE-OS'), h('span', { class: 'dim' }, profile()?.name ?? '')),
    item('›_', 'Terminal (TAPEOUT)', () => { (getWindow('term') ?? openTerminal()).focus(); term.focus(); }),
    item('◈', 'Campaign map', () => (location.hash = '#/map')),
    item('?!', 'Interview flashcards', () => (location.hash = '#/drills')),
    h('div', { class: 'start-sep' }, 'Arcade'),
    ...MINIGAMES.map((g) => item(g.icon, g.title, () => void launchGame(g.id))),
    h('div', { class: 'start-sep' }),
    item('⟲', 'Reset all progress', () => {
      if (!confirm('Erase all progress, your name and saved work?')) return;
      resetAll();
      try { Object.keys(localStorage).filter((k) => k.startsWith('tapeout.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
      location.hash = '#/';
      location.reload();
    }),
  );
  const start = h('button', { class: 'start', 'aria-haspopup': 'menu', onclick: (e: Event) => { e.stopPropagation(); menu.hidden = !menu.hidden; } }, h('span', { class: 'logo-mark', 'aria-hidden': 'true' }), 'tapeout');
  document.addEventListener('click', (e) => { if (!menu.contains(e.target as Node)) menu.hidden = true; });
  return h('footer', { class: 'taskbar' }, start, menu, h('div', { class: 'tasks' }), tray);
}

function icons(): HTMLElement {
  const icon = (glyph: string, label: string, fn: () => void) => h('button', { class: 'desk-icon', ondblclick: fn, onclick: (e: MouseEvent) => { if (e.detail === 1 && matchMedia('(pointer: coarse)').matches) fn(); } },
    h('span', { class: 'di-glyph' }, glyph), h('span', { class: 'di-label' }, label));
  return h('div', { class: 'desk-icons' },
    icon('›_', 'Terminal', () => { (getWindow('term') ?? openTerminal()).focus(); term.focus(); }),
    icon('◈', 'Map', () => (location.hash = '#/map')),
    icon('?!', 'Flashcards', () => (location.hash = '#/drills')),
    icon('▶', 'Arcade', () => { (getWindow('term') ?? openTerminal()).focus(); shell.run('play'); }));
}

async function bootScreen(first: boolean) {
  const lines = ['TAPE-OS BIOS v1.0', 'CPU: tapeout-risc-v @ 1 GHz ...... ok', 'SRAM 64 KiB ...... ok', 'PDK sky130 ...... mounted', 'mentor.ko ...... loaded'];
  const log = h('div', { class: 'boot-log' });
  const el = h('div', { class: 'boot', onclick: () => el.classList.add('skip') }, h('div', { class: 'boot-inner' }, avatar(96), h('div', { class: 'boot-title' }, 'TAPE-OS'), log));
  document.body.append(el);
  const delay = first ? 260 : 70;
  for (const l of lines) {
    if (el.classList.contains('skip')) break;
    log.append(h('div', null, l));
    await new Promise((r) => setTimeout(r, delay));
  }
  el.classList.add('bye');
  setTimeout(() => el.remove(), 400);
}

export async function bootDesktop() {
  const os = document.getElementById('os')!;
  const desktop = h('main', { id: 'desktop', class: 'desktop' }, icons());
  const bar = taskbar();
  os.replaceChildren(desktop, bar);
  initWM(desktop, bar.querySelector('.tasks') as HTMLElement);
  term = new Terminal();
  shell = new Shell(term, (r) => { if (location.hash === r) route(); else location.hash = r; });
  bindMentorLog((text) => {
    if (!term.el.isConnected) return;
    term.print(`${text}`, 'ai-aside');
  });
  await bootScreen(!profile());
  openTerminal();
  void shell.start();
  window.addEventListener('hashchange', route);
  if (location.hash && location.hash !== '#/') route();
}

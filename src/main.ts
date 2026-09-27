import './styles.css';
import { coveragePage } from './games/coverage/page';
import { drillsPage } from './games/drills/page';
import { pcbPage } from './games/pcb/page';
import { rtlPage } from './games/rtl/page';
import { timingPage } from './games/timing/page';
import { uvmPage } from './games/uvm/page';
import { onChange, rank, resetAll, totalXp } from './state';
import { h } from './ui/dom';
import { homePage, trackPage } from './ui/home';

const app = document.getElementById('app')!;

function topbar(): HTMLElement {
  const xp = totalXp();
  const r = rank(xp);
  return h('div', { class: 'topbar-inner' },
    h('a', { class: 'logo', href: '#/' }, h('span', { class: 'logo-mark', 'aria-hidden': 'true' }), 'tapeout'),
    h('span', { class: 'spacer' }),
    h('div', { class: 'career', title: r.next ? `${r.next.xp - xp} XP to ${r.next.title}` : 'Top rank' },
      h('span', { class: 'rank-title' }, r.title),
      h('div', { class: 'track small' }, h('div', { class: 'fill', style: `width:${Math.round(r.progress * 100)}%` })),
      h('span', { class: 'dim' }, `${xp} XP`)),
  );
}

const bar = document.getElementById('topbar')!;
const renderBar = () => bar.replaceChildren(topbar());
onChange(renderBar);

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [section, id] = parts;
  let page: HTMLElement;
  switch (section) {
    case undefined: page = homePage(); break;
    case 'track': page = trackPage(id); break;
    case 'rtl': page = rtlPage(id); break;
    case 'pcb': page = pcbPage(id); break;
    case 'sta': page = timingPage(id); break;
    case 'cov': page = coveragePage(id); break;
    case 'uvm': page = uvmPage(id); break;
    case 'drills': page = drillsPage(id); break;
    default: page = h('p', null, 'Page not found. ', h('a', { href: '#/' }, 'Go home'));
  }
  document.querySelectorAll('.modal-bg').forEach((m) => m.remove());
  app.replaceChildren(page);
  renderBar();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
document.getElementById('reset')!.addEventListener('click', () => {
  if (confirm('Erase all progress and saved work?')) {
    resetAll();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('tapeout.')).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    route();
  }
});
route();

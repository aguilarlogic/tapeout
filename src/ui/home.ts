import { CARDS } from '../games/drills/cards';
import { load, levelRecord, rank, RANKS, totalXp } from '../state';
import { INTERVIEW, Track, TRACKS } from '../tracks';
import { h, stars, svg } from './dom';

function trackProgress(t: Track) {
  const done = t.levels.filter((l) => levelRecord(l.id)).length;
  return { done, total: t.levels.length, frac: done / t.levels.length };
}

function drillProgress() {
  const p = load();
  const mastered = CARDS.filter((c) => (p.cards[c.id]?.box ?? 0) >= 3).length;
  return { done: mastered, total: CARDS.length, frac: mastered / CARDS.length };
}

/** The chip floorplan: each track fills in one region of the die as you progress. */
function die(): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 320 320', class: 'die', role: 'img', 'aria-label': 'Your chip floorplan: regions fill in as you complete tracks' });
  // package / board ring = PCB track
  const pcb = trackProgress(TRACKS.find((t) => t.id === 'pcb')!);
  root.append(svg('rect', { x: 4, y: 4, width: 312, height: 312, rx: 10, class: `pkg${pcb.frac === 1 ? ' done' : ''}` }));
  const pads = 14;
  for (let i = 0; i < pads; i++) {
    const lit = i / pads < pcb.frac;
    const o = 30 + i * (260 / (pads - 1)) - 5;
    for (const [x, y] of [[o, 14], [o, 296], [14, o], [296, o]]) root.append(svg('rect', { x, y, width: 10, height: 10, rx: 1.5, class: `pad${lit ? ' lit' : ''}` }));
  }
  root.append(svg('rect', { x: 32, y: 32, width: 256, height: 256, class: 'diebody' }));

  const region = (x: number, y: number, w: number, hh: number, label: string, frac: number, href: string) => {
    const g = svg('a', { href, class: 'region' });
    g.append(svg('rect', { x, y, width: w, height: hh, class: `blk${frac === 1 ? ' done' : ''}` }));
    const rows = Math.floor((hh - 22) / 7);
    const lit = Math.round(rows * frac);
    for (let r = 0; r < rows; r++) {
      g.append(svg('rect', { x: x + 6, y: y + 18 + r * 7, width: w - 12, height: 4, class: `row${r < lit ? ' lit' : ''}` }));
    }
    g.append(svg('text', { x: x + 6, y: y + 12, class: 'blk-label' }, label));
    return g;
  };
  const tp = (id: string) => trackProgress(TRACKS.find((t) => t.id === id)!).frac;
  root.append(region(42, 42, 140, 130, 'CPU CORE · RTL', tp('rtl'), '#/track/rtl'));
  root.append(region(190, 42, 88, 130, 'DV SIGNOFF', tp('verif'), '#/track/verif'));
  root.append(region(42, 180, 140, 98, 'SRAM · INTERVIEW', drillProgress().frac, '#/drills'));
  root.append(region(190, 180, 88, 98, 'CLOCKS · STA', tp('sta'), '#/track/sta'));
  return root;
}

export function homePage(): HTMLElement {
  const xp = totalXp();
  const r = rank(xp);
  const all = TRACKS.flatMap((t) => t.levels);
  const next = all.find((l) => !levelRecord(l.id));
  const trackFracs = TRACKS.map((t) => trackProgress(t).frac);
  const readiness = Math.round(((trackFracs.reduce((a, b) => a + b, 0) + drillProgress().frac) / (TRACKS.length + 1)) * 100);

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-text' },
      h('p', { class: 'kicker' }, `Tapeout readiness ${readiness}%`),
      h('h1', null, 'Take a chip from RTL to silicon.'),
      h('p', { class: 'lede' }, 'Write and debug real Verilog, close coverage like a verification engineer, fix timing like a physical designer, and route the bring-up board. Every region of the die fills in as you master it.'),
      h('div', { class: 'hero-actions' },
        next ? h('a', { class: 'btn primary', href: next.route }, `${xp ? 'Continue' : 'Start'}: ${next.title} →`) : h('span', { class: 'promo' }, 'Every level signed off. Your chip is ready to tape out.'),
        h('a', { class: 'btn ghost', href: '#/drills' }, 'Interview drills')),
      h('div', { class: 'ranks' }, ...RANKS.map((rk, i) => h('span', { class: `rank${i === r.index ? ' on' : i < r.index ? ' past' : ''}`, title: `${rk.xp} XP` }, rk.title))),
    ),
    h('div', { class: 'hero-die' }, die()),
  );

  const cards = TRACKS.map((t) => {
    const p = trackProgress(t);
    return h('a', { class: 'track-card', href: `#/track/${t.id}` },
      h('div', { class: 'tc-head' }, h('b', null, t.name), h('span', { class: 'dim' }, `${p.done}/${p.total}`)),
      h('div', { class: 'role' }, t.role),
      h('p', null, t.blurb),
      h('div', { class: 'skills' }, ...t.skills.map((s) => h('span', { class: 'skill' }, s))),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.round(p.frac * 100)}%` })));
  });
  const d = drillProgress();
  cards.push(h('a', { class: 'track-card', href: '#/drills' },
    h('div', { class: 'tc-head' }, h('b', null, INTERVIEW.name), h('span', { class: 'dim' }, `${d.done}/${d.total}`)),
    h('div', { class: 'role' }, 'Every role'),
    h('p', null, INTERVIEW.blurb),
    h('div', { class: 'skills' }, ...['CDC', 'SVA', 'STA', 'CMOS', 'SI/PI', 'AXI'].map((s) => h('span', { class: 'skill' }, s))),
    h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.round(d.frac * 100)}%` }))));

  return h('div', { class: 'home' }, hero, h('h3', { class: 'section-title' }, 'Career tracks'), h('div', { class: 'track-grid' }, ...cards),
    h('section', { class: 'next-steps panel' },
      h('h3', null, 'Beyond the game'),
      h('p', null, 'When a track is done, do it for real: simulate with Icarus Verilog or Verilator, write cocotb or UVM testbenches, route a board in KiCad, run OpenROAD on your RTL, and put your design on real silicon through Tiny Tapeout.'),
    ));
}

export function trackPage(id: string): HTMLElement {
  const t = TRACKS.find((x) => x.id === id);
  if (!t) return h('p', null, 'Unknown track.');
  const p = trackProgress(t);
  return h('div', { class: 'level' },
    h('header', { class: 'level-head' },
      h('nav', { class: 'crumbs' }, h('a', { href: '#/' }, 'Home'), ' / ', t.name),
      h('div', { class: 'title-row' }, h('h2', null, t.name), h('span', { class: 'dim' }, `${p.done} of ${p.total} signed off`))),
    h('p', { class: 'lede' }, `${t.blurb} Role: ${t.role}.`),
    h('ol', { class: 'level-list' }, ...t.levels.map((l, i) => {
      const rec = levelRecord(l.id);
      return h('li', null, h('a', { href: l.route, class: rec ? 'done' : '' },
        h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'lvl-main' }, h('b', null, l.title), h('span', { class: 'dim' }, l.concept)),
        h('span', { class: 'kind' }, l.kind),
        stars(rec?.stars ?? 0),
        h('span', { class: 'xp-chip' }, `${l.xp} XP`)));
    })),
  );
}

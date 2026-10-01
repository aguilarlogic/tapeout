// Map.app: the campaign as a chip. Each act is a block of the die; every module is a node on a trace.
import { ACTS, Act, actProgress, KIND_LABEL, ModKind, readiness, recommended } from '../curriculum';
import { levelRecord, rank, RANKS, totalXp } from '../state';
import { h, stars, svg } from '../ui/dom';

const ICON: Record<ModKind, string> = {
  lesson: '›_', practice: '∞', boss: '♛', incident: '☎', logic: '⊼', cmos: '⊥', rtl: '{}', debug: '⚑', cov: '◎', uvm: '⧉', clab: '∿', sta: '⏱', pcb: '▦', drills: '?!', final: '★',
};

/** The die floorplan: one block per act, whose standard-cell rows light up with progress. */
export function die(onPick?: (a: Act) => void): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 320 320', class: 'die', role: 'img', 'aria-label': 'Your chip: each block fills in as you complete an act' });
  root.append(svg('rect', { x: 4, y: 4, width: 312, height: 312, rx: 10, class: `pkg${readiness() === 100 ? ' done' : ''}` }));
  const pads = 14, lit = readiness() / 100;
  for (let i = 0; i < pads; i++) {
    const o = 30 + i * (260 / (pads - 1)) - 5;
    for (const [x, y] of [[o, 14], [o, 296], [14, o], [296, o]]) root.append(svg('rect', { x, y, width: 10, height: 10, rx: 1.5, class: `pad${i / pads < lit ? ' lit' : ''}` }));
  }
  root.append(svg('rect', { x: 32, y: 32, width: 256, height: 256, class: 'diebody' }));
  const boxes: [number, number, number, number][] = [
    [40, 40, 116, 66], [164, 40, 116, 66], [40, 114, 150, 80], [198, 114, 82, 80], [40, 202, 116, 42], [164, 202, 116, 42],
    [40, 252, 240, 30],
  ];
  ACTS.forEach((a, i) => {
    const [x, y, w, hh] = boxes[i];
    const frac = actProgress(a).frac;
    const g = svg('g', { class: 'region', tabindex: 0, role: 'button', 'aria-label': `Act ${a.n}: ${a.name}, ${Math.round(frac * 100)}%` });
    if (onPick) { g.addEventListener('click', () => onPick(a)); g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') onPick(a); }); }
    g.append(svg('rect', { x, y, width: w, height: hh, class: `blk${frac === 1 ? ' done' : ''}` }));
    const rows = Math.floor((hh - 22) / 7), on = Math.round(rows * frac);
    for (let r = 0; r < rows; r++) g.append(svg('rect', { x: x + 6, y: y + 18 + r * 7, width: w - 12, height: 4, class: `row${r < on ? ' lit' : ''}` }));
    g.append(svg('text', { x: x + 6, y: y + 12, class: 'blk-label' }, `${a.n} · ${a.region}`));
    root.append(g);
  });
  return root;
}

export function mapApp(): HTMLElement {
  const xp = totalXp(), r = rank(xp), next = recommended();
  const acts = ACTS.map((a) => {
    const p = actProgress(a);
    return h('section', { class: 'act', id: `act-${a.n}` },
      h('header', { class: 'act-head' },
        h('span', { class: 'act-n' }, `ACT ${a.n}`),
        h('div', null, h('h3', null, a.name), h('p', { class: 'dim' }, a.tagline)),
        h('span', { class: 'spacer' }),
        h('span', { class: 'dim' }, `${p.done}/${p.total}`),
        h('div', { class: 'track small' }, h('div', { class: 'fill', style: `width:${Math.round(p.frac * 100)}%` }))),
      ...a.chapters.map((c) => h('div', { class: 'chapter' },
        h('div', { class: 'ch-name' }, c.name),
        h('div', { class: 'nodes' }, ...c.modules.map((m) => {
          const rec = levelRecord(m.id);
          return h('a', { class: `node k-${m.kind}${rec ? ' done' : ''}${next?.id === m.id ? ' next' : ''}`, href: m.route, title: `${KIND_LABEL[m.kind]}: ${m.concept}` },
            h('span', { class: 'node-icon', 'aria-hidden': 'true' }, ICON[m.kind]),
            h('span', { class: 'node-title' }, m.title),
            h('span', { class: 'node-kind' }, KIND_LABEL[m.kind]),
            rec ? stars(rec.stars) : h('span', { class: 'node-xp' }, `${m.xp} XP`));
        })))));
  });
  const root = h('div', { class: 'map' });
  const scrollTo = (a: Act) => root.querySelector(`#act-${a.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  root.append(
    h('div', { class: 'map-top' },
      h('div', { class: 'map-die' }, die(scrollTo)),
      h('div', { class: 'map-summary' },
        h('p', { class: 'kicker' }, `Tapeout readiness ${readiness()}%`),
        h('h2', null, 'From electrons to architecture'),
        h('p', { class: 'dim' }, 'Six core acts and a block of specialist roles, each a region of your chip. Lessons run in the terminal with TAPEOUT; labs open their own windows. Everything is open: skip ahead whenever you like.'),
        next ? h('a', { class: 'btn primary', href: next.route }, `▶ Next: ${next.title}`) : h('p', { class: 'promo' }, 'Everything signed off. Your chip is ready to tape out.'),
        h('div', { class: 'ranks' }, ...RANKS.map((rk, i) => h('span', { class: `rank${i === r.index ? ' on' : i < r.index ? ' past' : ''}`, title: `${rk.xp} XP` }, rk.title))))),
    ...acts,
  );
  return root;
}

// Map.app: the campaign as a chip. The current chip is a floorplan of its blocks; below it, every act is a list of modules on a trace.
import './chip.css';
import { ACTS, actProgress, KIND_LABEL, ModKind, readiness, recommended } from '../curriculum';
import { blockLine, blockProgress, Chip, chipSummary, currentChip, slotProgress, SlotState } from '../chip';
import { levelRecord, rank, RANKS, totalXp } from '../state';
import { h, stars, svg } from '../ui/dom';

const ICON: Record<ModKind, string> = {
  lesson: '›_', practice: '∞', boss: '♛', incident: '☎', logic: '⊼', cmos: '⊥', rtl: '{}', debug: '⚑', cov: '◎', uvm: '⧉', clab: '∿', code: '</>', shell: '$_', sva: '|->', tb: 'tb', cdc: '⇄', isa: 'rv', arch: '▤', rv: '⌬', dft: '⊘', pd: '▥', sta2: '⏱', layout: '▤', sig: '∿', spec: '◈', sta: '⏱', pcb: '▦', drills: '?!', final: '★',
};

const STATE_WORD: Record<SlotState, string> = { empty: 'not built yet', half: 'started', built: 'built' };

/** The chip as a floorplan: one rectangle per block, one cell per slot. Built slots are lit; unbuilt blocks are dim. */
function floorplan(chip: Chip): SVGSVGElement {
  const W = 360, pad = 8, gap = 6, rowH = 104, n = chip.blocks.length;
  const cols = n <= 3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const H = rows * rowH + (rows + 1) * gap;
  const label = `${chip.id} floorplan. ${chip.blocks.map((b) => `${b.name}: ${blockLine(b)}`).join('. ')}.`;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chip-fp', role: 'img', 'aria-label': label });
  chip.blocks.forEach((b, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), col = i - row * cols;
    const bw = (W - 2 * pad - (inRow - 1) * gap) / inRow;
    const x = pad + col * (bw + gap), y = gap + row * (rowH + gap);
    const p = blockProgress(b);
    const cls = ['chip-blk', p.done ? 'done' : '', p.built + p.half === 0 ? 'dim' : ''].filter(Boolean).join(' ');
    const g = svg('g', { class: cls });
    g.append(svg('rect', { x, y, width: bw, height: rowH, rx: 6, class: 'chip-box' }));
    // Long names shrink to fit their block instead of running into the next one (about 0.58em per character).
    const size = Math.min(14, Math.floor(((bw - 16) / (b.name.length * 0.58)) * 2) / 2);
    g.append(svg('text', { x: x + 8, y: y + 19, class: 'chip-blk-name', 'font-size': size }, b.name));
    // The slots sit in a small grid under the block name.
    const ax = x + 8, ay = y + 30, aw = bw - 16, ah = rowH - 38, k = b.slots.length;
    const sc = Math.min(k, Math.ceil(Math.sqrt((k * aw) / ah)));
    const sr = Math.ceil(k / sc), sg = 3;
    const cw = (aw - (sc - 1) * sg) / sc, ch = Math.min(26, (ah - (sr - 1) * sg) / sr);
    b.slots.forEach((s, j) => {
      const st = slotProgress(s).state;
      const cell = svg('rect', { x: ax + (j % sc) * (cw + sg), y: ay + Math.floor(j / sc) * (ch + sg), width: cw, height: ch, rx: 2, class: `chip-slot ${st}` });
      cell.append(svg('title', {}, `${s.name}: ${s.what}. ${STATE_WORD[st]}.`));
      g.append(cell);
    });
    root.append(g);
  });
  return root;
}

/** The current chip's floorplan with its caption. */
function chipFigure(): HTMLElement {
  const chip = currentChip();
  return h('figure', { class: 'chip-figure' },
    h('p', { class: 'chip-name' }, `${chip.id} · ${chip.name}`),
    floorplan(chip),
    h('figcaption', { class: 'chip-cap' }, chipSummary(chip)));
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
        h('div', { class: 'ch-name' }, c.name, c.need ? h('span', { class: 'dim ch-need' }, ` · before ${c.need}`) : null),
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
  root.append(
    h('div', { class: 'map-top' },
      h('div', { class: 'map-die' }, chipFigure()),
      h('div', { class: 'map-summary' },
        h('p', { class: 'kicker' }, `Tapeout readiness ${readiness()}%`),
        h('h2', null, 'From electrons to architecture'),
        h('p', { class: 'dim' }, 'Four chips on the main path. The detours teach one subject at a time, each called in just before the chip chapter that needs it. Then the specialist roles. Every act is a region of your chip. Lessons run in the terminal with TAPEOUT; labs open their own windows. Everything is open: skip ahead whenever you like.'),
        next ? h('a', { class: 'btn primary', href: next.route }, `▶ Next: ${next.title}`) : h('p', { class: 'promo' }, 'Everything signed off. Your chip is ready to tape out.'),
        h('div', { class: 'ranks' }, ...RANKS.map((rk, i) => h('span', { class: `rank${i === r.index ? ' on' : i < r.index ? ' past' : ''}`, title: `${rk.xp} XP` }, rk.title))))),
    ...acts,
  );
  return root;
}

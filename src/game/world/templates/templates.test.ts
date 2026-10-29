// Phase 3 Spec, section 4: the traverse, fight and arena templates. Every variant must be passable with and without the
// double jump (footholds checked against REACH), keep its anchors out of solids and place the counts the spec asks for.
// Seeds 1 to 20 drive the rng, and every variant must come up across them.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { TILE } from '../../tuning';
import type { Shell, Template } from '../types';
import { arena } from './arena';
import { FIGHT_VARIANTS, fight } from './fight';
import { gapFor, pick, REACH } from './kit';
import { TRAVERSE_VARIANTS, traverse } from './traverse';

const KITS = [
  { doubleJump: false, wallLatch: false },
  { doubleJump: true, wallLatch: false },
];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const ROOMS: [string, Template][] = [...TRAVERSE_VARIANTS, ...FIGHT_VARIANTS, ['arena', arena]];

/** A small linear congruential rng in [0, 1). The seed is scrambled and two draws discarded, so that nearby seeds take
 * different paths. */
function lcg(seed: number): () => number {
  let s = (Math.imul(seed, 0x9e3779b9) + 1) >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  next();
  next();
  return next;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: Vec, q: Rect) => p.x > q.x && p.x < q.x + q.w && p.y > q.y && p.y < q.y + q.h;
/** Whether a point stands `dy` above some foothold's top, within that foothold's width. */
const onFoothold = (s: Shell, p: Vec, dy: number) => s.footholds.some((f) => p.x >= f.x && p.x <= f.x + f.w && p.y === f.y - dy);

/** The reach problems of a room for one kit: the spawn stands on footholds[0], each step's rise and gap are within
 * REACH (the riseDouble limit with the double jump), and the last foothold reaches the exit: its right edge within
 * 200 px of the exit x and its top below the doorway (side exits), or its top above exit.y + 40 (shaft exits).
 * Returns the problems found; an empty list means the room is passable. */
function reachProblems(s: Shell, kit: { doubleJump: boolean }): string[] {
  const problems: string[] = [];
  const maxRise = kit.doubleJump ? REACH.riseDouble : REACH.rise;
  const f = s.footholds;
  const first = f[0];
  if (s.spawn.y + 24 !== first.y || s.spawn.x < first.x || s.spawn.x > first.x + first.w) problems.push('spawn is not on footholds[0]');
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1], b = f[i];
    const rise = a.y - b.y;
    const gap = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
    if (rise > maxRise) problems.push(`foothold ${i}: rise ${rise} > ${maxRise}`);
    if (gap > (kit.doubleJump ? REACH.gap : gapFor(rise))) problems.push(`foothold ${i}: gap ${gap} at rise ${rise} > ${kit.doubleJump ? REACH.gap : gapFor(rise)}`);
  }
  const last = f[f.length - 1];
  if (s.exit.y !== undefined) {
    if (!(last.y < s.exit.y + 40)) problems.push('last foothold is below the shaft exit');
  } else {
    // The right wall's upper piece starts at the wall's top (y -TILE); its bottom is the doorway's top.
    const wall = s.solids.find((q) => q.x === s.w && q.y === -TILE);
    if (!wall) problems.push('no doorway in the right wall');
    else if (!(last.y > wall.y + wall.h)) problems.push('last foothold is above the doorway');
    if (Math.abs(last.x + last.w - s.exit.x) > 200) problems.push(`last foothold ends ${last.x + last.w}, exit at ${s.exit.x}`);
  }
  return problems;
}

/** Every anchor a room places (enemies, crates, stations, nodes, debug port). */
const pointAnchors = (s: Shell): Vec[] => [
  ...s.anchors.enemies,
  ...s.anchors.props,
  ...s.anchors.stations,
  ...(s.anchors.nodes ?? []),
  ...(s.anchors.debug ? [s.anchors.debug] : []),
];

/** Checks that a picker room draws one of its variants from rng and that every variant comes up across the seeds. */
function coverage(room: Template, variants: [string, Template][]) {
  const picked = new Set<string>();
  for (const seed of SEEDS) {
    const r = lcg(seed);
    const [name, variant] = pick(r, variants);
    const opts = { doubleJump: false, wallLatch: false };
    expect(room(lcg(seed), opts)).toEqual(variant(r, opts));
    picked.add(name);
  }
  expect([...picked].sort()).toEqual(variants.map(([name]) => name).sort());
}

describe.each(ROOMS)('%s', (_name, room) => {
  it('is passable with and without the double jump, for seeds 1 to 20', () => {
    for (const kit of KITS) {
      for (const seed of SEEDS) {
        expect(reachProblems(room(lcg(seed), kit), kit), `seed ${seed}, doubleJump ${kit.doubleJump}`).toEqual([]);
      }
    }
  });

  it('keeps every anchor out of the solids', () => {
    for (const kit of KITS) {
      for (const seed of SEEDS) {
        const s = room(lcg(seed), kit);
        for (const p of pointAnchors(s)) {
          expect(s.solids.some((q) => inside(p, q)), `seed ${seed}: anchor (${p.x}, ${p.y})`).toBe(false);
        }
      }
    }
  });
});

describe.each(TRAVERSE_VARIANTS)('traverse %s', (_name, room) => {
  it('places two to four enemies over footholds, at least 300 px from the spawn, and up to two crates on footholds', () => {
    for (const enemies of [undefined, 1, 4, 9]) {
      for (const seed of SEEDS) {
        const s = room(lcg(seed), { doubleJump: false, wallLatch: false, enemies });
        expect(s.anchors.enemies).toHaveLength(Math.max(2, Math.min(enemies ?? 3, 4)));
        for (const p of s.anchors.enemies) {
          expect(onFoothold(s, p, 40), `seed ${seed}: enemy (${p.x}, ${p.y})`).toBe(true);
          expect(dist(p, s.spawn)).toBeGreaterThanOrEqual(300);
        }
        expect(s.anchors.props.length).toBeLessThanOrEqual(2);
        for (const p of s.anchors.props) expect(onFoothold(s, p, 30), `seed ${seed}: crate (${p.x}, ${p.y})`).toBe(true);
      }
    }
  });
});

describe.each(FIGHT_VARIANTS)('fight %s', (_name, room) => {
  it('places six to ten enemies over footholds, at least 400 px from the spawn, three crates and a gate with a solid above it', () => {
    for (const enemies of [undefined, 1, 7, 12]) {
      for (const seed of SEEDS) {
        const s = room(lcg(seed), { doubleJump: false, wallLatch: false, enemies });
        expect(s.anchors.enemies).toHaveLength(Math.min(10, Math.max(6, enemies ?? 8)));
        for (const p of s.anchors.enemies) {
          expect(onFoothold(s, p, 40), `seed ${seed}: enemy (${p.x}, ${p.y})`).toBe(true);
          expect(dist(p, s.spawn)).toBeGreaterThanOrEqual(400);
        }
        expect(s.anchors.props).toHaveLength(3);
        for (const p of s.anchors.props) expect(onFoothold(s, p, 30), `seed ${seed}: crate (${p.x}, ${p.y})`).toBe(true);
        const gate = s.anchors.gate;
        expect(gate, `seed ${seed}: gate`).toBeDefined();
        if (gate) expect(s.solids.some((q) => q.x === gate.x && q.y === 0 && q.h === gate.y), `seed ${seed}: solid above gate`).toBe(true);
      }
    }
  });
});

describe('arena', () => {
  it('places opts.nodes instrument nodes for 1 to 12, none within 120 px of another, each standing on a surface', () => {
    for (let n = 1; n <= 12; n++) {
      const s = arena(lcg(1), { doubleJump: false, wallLatch: false, nodes: n });
      const nodes = s.anchors.nodes ?? [];
      expect(nodes).toHaveLength(n);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) expect(dist(nodes[i], nodes[j]), `nodes ${i} and ${j} of ${n}`).toBeGreaterThanOrEqual(120);
        expect(s.solids.some((q) => q.y === nodes[i].y && nodes[i].x >= q.x && nodes[i].x <= q.x + q.w), `node ${i} of ${n}`).toBe(true);
      }
    }
  });

  it('defaults to four nodes, keeps nodes and the debug port out of the boss, and has the gate and its solid', () => {
    const s = arena(lcg(1), { doubleJump: false, wallLatch: false });
    expect(s.anchors.nodes).toHaveLength(4);
    const boss = s.anchors.boss;
    expect(boss).toBeDefined();
    if (boss) {
      for (const p of pointAnchors(s)) expect(inside(p, boss), `anchor (${p.x}, ${p.y}) in the boss`).toBe(false);
    }
    expect(s.anchors.gate).toEqual({ x: 1872, y: 600, w: 48, h: 220 });
    expect(s.solids).toContainEqual({ x: 1872, y: 0, w: 48, h: 600 });
    expect(s.anchors.debug).toEqual({ x: 960, y: 820 });
    expect(s.spawn).toEqual({ x: 240, y: 796 });
  });
});

describe('picking', () => {
  it('traverse draws one of its six variants with rng, and every variant comes up across seeds 1 to 20', () => {
    coverage(traverse, TRAVERSE_VARIANTS);
  });

  it('fight draws one of its four variants with rng, and every variant comes up across seeds 1 to 20', () => {
    coverage(fight, FIGHT_VARIANTS);
  });
});

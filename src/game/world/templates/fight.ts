// Phase 3 Spec, section 4: fight rooms. Four arenas of footholds with six to ten enemies spread across them, three
// crates, and a gate on the right that the director opens once the room is cleared. Every pillar and ledge keeps to
// the kit's rise and gap limits; pillars may only be as tall as the kit can climb.
import type { Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import type { Template, TemplateOpts } from '../types';
import { floorY, pick, r, REACH, shell, spawnAt, trace } from './kit';
import { above, assemble, spread } from './traverse';

/** The gate (the solid the director opens) and the solid above it, at the right wall. */
function gateAt(w: number, F: number): { gate: Rect; wall: Rect } {
  return { gate: r(w - 180, F - 200, 48, 200), wall: r(w - 180, 0, 48, F - 200) };
}

/** Enemies a fight room places: six to ten, as the spec asks. */
const fightEnemies = (opts: TemplateOpts) => Math.max(6, Math.min(opts.enemies ?? 8, 10));

// --- 1. Pillars ---------------------------------------------------------------------------------------------------
/** Three solid pillars 80 wide on the floor, each as tall as the kit can climb (120 to 150 px, or 120 to 160 with
 * the double jump). */
export const pillars: Template = (rng, opts) => {
  const w = 2400, h = 720, F = floorY(h);
  const tallest = opts.doubleJump ? 160 : REACH.rise;
  const tall = () => 120 + Math.floor(rng() * (tallest - 120 + 1));
  const floor = r(0, F, w, 80);
  const px = [700, 1300, 1900];
  const pil = px.map((x) => { const hh = tall(); return r(x, F - hh, 80, hh); });
  const { gate, wall } = gateAt(w, F);
  const cands: Vec[] = [
    { x: 580, y: F - 40 }, above(pil[0]), { x: 1000, y: F - 40 }, { x: 1100, y: F - 40 }, { x: 1200, y: F - 40 },
    above(pil[1]), { x: 1550, y: F - 40 }, { x: 1700, y: F - 40 }, above(pil[2]), { x: 2000, y: F - 40 },
  ];
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    solids: [...shell(w, h), ...pil, wall],
    footholds: [floor, pil[0], floor, pil[1], floor, pil[2], floor],
    anchors: {
      enemies: spread(cands, fightEnemies(opts)),
      props: [{ x: 320, y: F - 30 }, { x: 1450, y: F - 30 }, { x: 2120, y: F - 30 }],
      gate,
    },
    traces: [trace(0, w, 420), trace(0, 1200, 200)],
  });
};

// --- 2. Two tiers -------------------------------------------------------------------------------------------------
/** A long upper tier of one-way platforms, 150 px above the floor, with two 160 px gaps. */
export const twoTiers: Template = (_rng, opts) => {
  const w = 2400, h = 720, F = floorY(h), T = F - 150;
  const floor = r(0, F, w, 80);
  const t1 = r(500, T, 340, 16), t2 = r(1000, T, 340, 16), t3 = r(1500, T, 400, 16);
  const { gate, wall } = gateAt(w, F);
  const cands: Vec[] = [
    { x: 580, y: F - 40 }, { x: 602, y: T - 40 }, { x: 738, y: T - 40 }, { x: 1100, y: F - 40 },
    { x: 1102, y: T - 40 }, { x: 1238, y: T - 40 }, { x: 1620, y: T - 40 }, { x: 1700, y: F - 40 },
    { x: 1780, y: T - 40 }, { x: 2050, y: F - 40 },
  ];
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    oneWay: [t1, t2, t3],
    solids: [...shell(w, h), wall],
    footholds: [floor, t1, t2, t3, floor],
    anchors: {
      enemies: spread(cands, fightEnemies(opts)),
      props: [{ x: 330, y: F - 30 }, { x: 1400, y: F - 30 }, { x: 2150, y: F - 30 }],
      gate,
    },
    traces: [trace(0, w, 420), trace(0, w, 150, -40)],
  });
};

// --- 3. Pit bridges -----------------------------------------------------------------------------------------------
/** A 600 px trench in the middle, 70 px deep so a fall costs a hop and never a life, bridged by three one-way platforms
 * 120 px wide, 40 px below the floor's top. */
export const pitBridges: Template = (_rng, opts) => {
  const w = 2600, h = 720, F = floorY(h);
  const left = r(0, F, 1000, 80), right = r(1600, F, 1000, 80), trench = r(1000, F + 70, 600, h - F - 70);
  const b1 = r(1060, F - 40, 120, 16), b2 = r(1240, F - 40, 120, 16), b3 = r(1420, F - 40, 120, 16);
  const { gate, wall } = gateAt(w, F);
  const cands: Vec[] = [
    { x: 560, y: F - 40 }, { x: 760, y: F - 40 }, { x: 960, y: F - 40 }, above(b1), above(b2), above(b3),
    { x: 1700, y: F - 40 }, { x: 1900, y: F - 40 }, { x: 2100, y: F - 40 }, { x: 2300, y: F - 40 },
  ];
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    oneWay: [b1, b2, b3],
    solids: [...shell(w, h, { floor: false }), left, trench, right, wall],
    footholds: [left, b1, b2, b3, right],
    anchors: {
      enemies: spread(cands, fightEnemies(opts)),
      props: [{ x: 330, y: F - 30 }, { x: 1800, y: F - 30 }, { x: 2200, y: F - 30 }],
      gate,
    },
    traces: [trace(0, w, 420), trace(0, 1000, 200)],
  });
};

// --- 4. Tower -----------------------------------------------------------------------------------------------------
/** A stepped tower of six solid tiers in the middle, each 130 px above the last, with 40 px of ledge on each side.
 * The drone climbs the left flank and comes back down the right to the floor by the gate. */
export const tower: Template = (_rng, opts) => {
  const w = 1600, h = 1200, F = floorY(h);
  const tiers = [0, 1, 2, 3, 4, 5].map((k) => {
    const half = 240 - 40 * k;
    return r(800 - half, F - 130 * (k + 1), 2 * half, 130);
  });
  const floorL = r(0, F, 560, 80), floorR = r(1040, F, w - 1040, 80);
  const down = tiers.slice(0, -1).reverse();
  const { gate, wall } = gateAt(w, F);
  const cands: Vec[] = [
    { x: 580, y: 950 }, { x: 620, y: 820 }, { x: 660, y: 690 }, { x: 700, y: 560 }, { x: 740, y: 430 }, { x: 800, y: 300 },
    { x: 860, y: 430 }, { x: 900, y: 560 }, { x: 940, y: 690 }, { x: 980, y: 820 }, { x: 1020, y: 950 },
    { x: 1200, y: F - 40 }, { x: 1320, y: F - 40 },
  ];
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    solids: [...shell(w, h), ...tiers, wall],
    footholds: [floorL, ...tiers, ...down, floorR],
    anchors: {
      enemies: spread(cands, fightEnemies(opts)),
      props: [{ x: 300, y: F - 30 }, { x: 1100, y: F - 30 }, { x: 1500, y: F - 30 }],
      gate,
    },
    traces: [trace(0, w, 240), trace(0, 500, 700, -30)],
  });
};

export const FIGHT_VARIANTS: [string, Template][] = [
  ['pillars', pillars],
  ['twoTiers', twoTiers],
  ['pitBridges', pitBridges],
  ['tower', tower],
];

/** A fight room: one of the four variants, picked with rng. */
export const fight: Template = (rng, opts) => pick(rng, FIGHT_VARIANTS)[1](rng, opts);

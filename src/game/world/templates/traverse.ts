// Phase 3 Spec, section 4: traverse rooms. Six ways from the left wall to the exit, each a route of footholds that keeps
// to the kit's rise and gap limits (REACH, without the double jump, so the same room passes either way), with enemies
// and crates placed on the route. The shared helpers at the bottom (assemble, spread, above, crate) also serve fight.ts
// and arena.ts.
import type { Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import type { Shell, Template, TemplateOpts } from '../types';
import { floorY, pick, r, shell, spawnAt, trace } from './kit';

/** The fields a room builds, with the ones it leaves out (oneWay, hazards, plates, traces, signs, stations) filled in. */
export type RoomParts = Omit<Shell, 'anchors' | 'oneWay' | 'hazards' | 'plates' | 'traces' | 'signs'> &
  Partial<Pick<Shell, 'oneWay' | 'hazards' | 'plates' | 'traces' | 'signs'>> & { anchors: Omit<Shell['anchors'], 'stations'> };

/** A room from its parts; a room has no stations unless it says so. */
export function assemble(p: RoomParts): Shell {
  return { oneWay: [], hazards: [], plates: [], traces: [], signs: [], ...p, anchors: { stations: [], ...p.anchors } };
}

/** n points taken evenly along a list of candidates, in list order. */
export function spread(xs: Vec[], n: number): Vec[] {
  return Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / Math.max(1, n - 1))]);
}

/** An enemy anchor 40 px above a surface, at a fraction of its width. */
export const above = (s: Rect, fx = 0.5): Vec => ({ x: s.x + s.w * fx, y: s.y - 40 });
/** A crate anchor resting on a surface, at a fraction of its width. */
export const crate = (s: Rect, fx = 0.5): Vec => ({ x: s.x + s.w * fx, y: s.y - 30 });

/** Enemies a traverse room places: two to four, as the spec asks. */
const traverseEnemies = (opts: TemplateOpts) => Math.max(2, Math.min(opts.enemies ?? 3, 4));

// --- 1. Stair climb -----------------------------------------------------------------------------------------------
/** Four solid steps, 110 px apart, the last one the high exit ledge. The doorway sits above it. */
export const stairClimb: Template = (_rng, opts) => {
  const w = 1800, h = 720, F = floorY(h), top = 200;
  const floor = r(0, F, w, 80);
  const s1 = r(360, 530, 180, 110), s2 = r(540, 420, 180, 220), s3 = r(720, 310, 180, 330), ledge = r(900, top, 900, 440);
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    solids: [...shell(w, h, { exitFloor: top }), s1, s2, s3, ledge],
    footholds: [floor, s1, s2, s3, ledge],
    anchors: {
      enemies: spread([above(s1), above(s2), above(s3), above(ledge, 0.25)], traverseEnemies(opts)),
      props: [crate(floor, 0.14)],
    },
    traces: [trace(0, w, 120, -30), trace(0, 360, 400)],
  });
};

// --- 2. One-way ladder --------------------------------------------------------------------------------------------
/** Six one-way platforms zigzag up the shaft to a solid ledge at the top; the doorway is in the right wall above it. */
export const oneWayLadder: Template = (_rng, opts) => {
  const w = 1600, h = 1200, F = floorY(h), top = 220;
  const plat = [[180, 1000], [460, 870], [740, 740], [460, 610], [180, 480], [460, 350]].map(([x, y]) => r(x, y, 260, 16));
  const ledge = r(740, top, 860, 40);
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    solids: [...shell(w, h, { exitFloor: top }), ledge],
    oneWay: plat,
    footholds: [r(0, F, w, 80), ...plat, ledge],
    anchors: {
      enemies: spread(plat.slice(1).map((p) => above(p)), traverseEnemies(opts)),
      props: [crate(plat[0], 0.25)],
    },
    traces: [trace(0, w, 1060, 30), trace(0, 1100, 700), trace(300, w, 420)],
  });
};

// --- 3. Gap run ---------------------------------------------------------------------------------------------------
/** A flat floor broken by three pits of 140 to 180 px (rng), with a low pillar on the near side of each pit. */
export const gapRun: Template = (rng, opts) => {
  const w = 2400, h = 720, F = floorY(h);
  const pit = () => 140 + 5 * Math.floor(rng() * 9);
  const w1 = pit(), w2 = pit(), w3 = pit();
  const seg0 = r(0, F, 560, 80), seg1 = r(560 + w1, F, 1130 - 560 - w1, 80);
  const seg2 = r(1130 + w2, F, 1700 - 1130 - w2, 80), seg3 = r(1700 + w3, F, w - 1700 - w3, 80);
  const p0 = r(480, F - 60, 80, 60), p1 = r(1050, F - 60, 80, 60), p2 = r(1620, F - 60, 80, 60);
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    solids: [...shell(w, h, { floor: false }), seg0, seg1, seg2, seg3, p0, p1, p2],
    footholds: [seg0, p0, seg1, p1, seg2, p2, seg3],
    anchors: {
      enemies: spread([above(seg1), above(p1), above(seg2), above(p2), above(seg3)], traverseEnemies(opts)),
      props: [crate(seg0, 0.5)],
    },
    traces: [trace(0, w, 420), trace(0, 1200, 200)],
  });
};

// --- 4. Shaft up --------------------------------------------------------------------------------------------------
/** Up a 1280 px shaft from the floor: one-way and solid ledges in three columns, stepping one column at a time, to a
 * ledge that leads out of the top right. The exit is the ledge's top: the drone must be above it. */
export const shaftUp: Template = (_rng, opts) => {
  const w = 1280, h = 1440, F = floorY(h), top = 260;
  const col = [100, 520, 940];
  const one = (c: number, y: number) => r(col[c], y, 260, 16);
  const solid = (c: number, y: number) => r(col[c], y, 260, 40);
  const s1 = one(0, 1230), s2 = one(1, 1100), s3 = solid(2, 970), s4 = one(1, 840);
  const s5 = solid(0, 710), s6 = one(1, 580), s7 = one(2, 450), s8 = solid(1, 320);
  const ledge = r(col[2], top, w - col[2], 40);
  const ladder = [s1, s2, s3, s4, s5, s6, s7, s8];
  const floor = r(0, F, w, 80);
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40, y: top + 2 },
    solids: [...shell(w, h, { exitFloor: top }), s3, s5, s8, ledge],
    oneWay: [s1, s2, s4, s6, s7],
    footholds: [floor, ...ladder, ledge],
    anchors: {
      enemies: spread(ladder.slice(1).map((p) => above(p)), traverseEnemies(opts)),
      props: [crate(floor, 0.6)],
    },
    traces: [trace(0, w, 1200, 30), trace(0, w, 120, -30)],
  });
};

// --- 5. Drop and climb --------------------------------------------------------------------------------------------
/** Start on a high ledge on the left, drop into a basin, climb the steps on the right to a doorway at mid height. */
export const dropAndClimb: Template = (_rng, opts) => {
  const w = 2000, h = 1120, F = h - 80, mid = 560;
  const left = r(0, 680, 480, h - 680), basin = r(480, F, 620, 80);
  const st1 = r(1100, 900, 160, h - 900), st2 = r(1260, 760, 160, h - 760), st3 = r(1420, 620, 160, h - 620);
  const exitLedge = r(1580, mid, w - 1580, h - mid);
  return assemble({
    w, h, spawn: { x: 140, y: left.y - 24 }, exit: { x: w - 40 },
    solids: [...shell(w, h, { exitFloor: mid, floor: false }), left, basin, st1, st2, st3, exitLedge],
    footholds: [left, basin, st1, st2, st3, exitLedge],
    anchors: {
      enemies: spread([above(basin), above(st1), above(st2), above(st3)], traverseEnemies(opts)),
      props: [crate(left, 0.6)],
    },
    traces: [trace(0, 1000, 240), trace(600, w, 980, -30)],
  });
};

// --- 6. Hazard corridor -------------------------------------------------------------------------------------------
/** A flat floor with three hazard strips (80 to 120 px, rng) on it: jump each one, or take the one-way platform
 * above it. */
export const hazardCorridor: Template = (rng, opts) => {
  const w = 2200, h = 720, F = floorY(h);
  const width = () => 80 + 10 * Math.floor(rng() * 5);
  const hx = [560, 1100, 1640];
  const wd = hx.map(width);
  const hazards = hx.map((x, i) => r(x, F - 16, wd[i], 16));
  const plats = hx.map((x, i) => r(x - 40, F - 110, wd[i] + 80, 16));
  const segs = [
    r(0, F, hx[0], 80),
    r(hx[0] + wd[0], F, hx[1] - hx[0] - wd[0], 80),
    r(hx[1] + wd[1], F, hx[2] - hx[1] - wd[1], 80),
    r(hx[2] + wd[2], F, w - hx[2] - wd[2], 80),
  ];
  return assemble({
    w, h, spawn: spawnAt(140, F), exit: { x: w - 40 },
    solids: shell(w, h),
    oneWay: plats,
    hazards,
    footholds: segs,
    anchors: {
      enemies: spread([above(segs[1], 1 / 3), above(segs[1], 2 / 3), above(segs[2], 1 / 3), above(segs[2], 2 / 3), above(segs[3], 1 / 3), above(segs[3], 2 / 3)], traverseEnemies(opts)),
      props: [crate(segs[0]), crate(segs[3])],
    },
    traces: [trace(0, w, 420), trace(0, 1100, 200)],
  });
};

export const TRAVERSE_VARIANTS: [string, Template][] = [
  ['stairClimb', stairClimb],
  ['oneWayLadder', oneWayLadder],
  ['gapRun', gapRun],
  ['shaftUp', shaftUp],
  ['dropAndClimb', dropAndClimb],
  ['hazardCorridor', hazardCorridor],
];

/** A traverse room: one of the six variants, picked with rng. */
export const traverse: Template = (rng, opts) => pick(rng, TRAVERSE_VARIANTS)[1](rng, opts);

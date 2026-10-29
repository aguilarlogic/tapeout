// Attack library tests (Phase 3 Spec, section 6; Phase 6 Spec, section 6): every attack on a fake context, at speeds 1 and 1.4, Story on and off.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { bolts, chain, drop, freeze, grid, mirror, segments } from './attacks';
import { ATTACKS } from './table';
import type { Attack, AttackCtx } from './types';

const ARENA: Rect = { x: 0, y: 0, w: 1920, h: 900 };
const BOSS: Rect = { x: 700, y: 240, w: 520, h: 260 };
const FLOORS: Rect[] = [
  { x: 0, y: 820, w: 1920, h: 80 },
  { x: 240, y: 680, w: 140, h: 20 },
  { x: 1540, y: 680, w: 140, h: 20 },
];
const DRONE: Rect = { x: 900, y: 772, w: 36, h: 48 };
const TRAIL = Array.from({ length: 180 }, (_, i) => ({ x: 300 + i, y: 500 }));

interface Shot { x: number; y: number; vx: number; vy: number; damage: number; at: number }
interface Hurt { area: Rect; n: number; at: number }
interface Hazard { r: Rect; ms: number; damage: number; at: number }
interface Log { at: number; shots: Shot[]; hurts: Hurt[]; hazards: Hazard[]; sfx: string[] }
interface Opts {
  story: boolean; speed: number; seed: number; drone?: Rect; floors?: Rect[]; trail?: { x: number; y: number }[];
}

/** A small seeded generator (mulberry32), so every run is repeatable. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs one attack to its end (or 900 steps), recording every call with the step index it was made on. */
function play<R>(a: Attack<R>, o: Opts, onStep?: (i: number, run: R) => void) {
  const log: Log = { at: 0, shots: [], hurts: [], hazards: [], sfx: [] };
  const c: AttackCtx = {
    rand: seeded(o.seed),
    story: o.story,
    drone: o.drone ?? DRONE,
    trail: o.trail ?? TRAIL,
    arena: ARENA,
    boss: BOSS,
    floors: o.floors ?? FLOORS,
    shoot: (x, y, vx, vy, damage) => log.shots.push({ x, y, vx, vy, damage, at: log.at }),
    hurt: (area, n) => log.hurts.push({ area, n, at: log.at }),
    hazard: (r, ms, damage) => log.hazards.push({ r, ms, damage, at: log.at }),
    platform: () => undefined,
    lens: 0,
    spawn: () => undefined,
    soak: () => 0,
    sfx: (n) => log.sfx.push(n),
  };
  const run = a.start(c);
  let steps = 0;
  let done = false;
  while (!done && steps < 900) {
    log.at = steps;
    done = a.step(run, c, o.speed);
    onStep?.(steps, run);
    steps++;
  }
  return { run, log, steps, done };
}

/** A canvas stub: every method a draw uses is a no-op, and the properties can be set. */
function stubContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const gradient = { addColorStop: noop };
  const g = {
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop, fillText: noop, strokeText: noop, measureText: () => ({ width: 0 }),
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clip: noop, translate: noop, rotate: noop,
    setLineDash: noop, createRadialGradient: () => gradient, createLinearGradient: () => gradient,
    globalAlpha: 1, globalCompositeOperation: 'source-over', strokeStyle: '', fillStyle: '', lineWidth: 1,
    lineCap: 'butt', lineDashOffset: 0, shadowBlur: 0, shadowColor: '',
  };
  return g as unknown as CanvasRenderingContext2D;
}

const SPEEDS = [1, 1.4];
const STORY = [false, true];
const ATTACK_LIST = Object.values(ATTACKS);

describe('every attack', () => {
  for (const a of ATTACK_LIST) {
    for (const speed of SPEEDS) {
      for (const story of STORY) {
        it(`${a.id}: ends within 900 steps, is quiet for the first 30, and sounds once per strike (speed ${speed}, story ${story})`, () => {
          const { log, steps, done } = play(a, { story, speed, seed: 11 });
          expect(done).toBe(true);
          expect(steps).toBeLessThanOrEqual(900);
          const early = [...log.shots, ...log.hurts, ...log.hazards].filter((e) => e.at < 30);
          expect(early).toEqual([]);
          // one cue per attack, or one per strike for act 3's multi-strike attacks (4 slams at most, 2 cues each)
          expect(log.sfx.length).toBeGreaterThanOrEqual(1);
          expect(log.sfx.length).toBeLessThanOrEqual(8);
        });
      }
    }
  }
});

describe('telegraphs', () => {
  const table: [string, Attack<unknown>, number][] = [
    ['bolts', bolts, 36], ['drop', drop, 42], ['grid', grid, 36], ['chain', chain, 30],
    ['freeze', freeze, 36], ['segments', segments, 30], ['mirror', mirror, 30],
  ];
  it.each(table)('%s warns for its base length, 1.5x on Story, and never less than 30 steps', (_name, a, base) => {
    const plain = play(a, { story: false, speed: 1, seed: 3 }).run as { tele: number };
    const story = play(a, { story: true, speed: 1, seed: 3 }).run as { tele: number };
    expect(plain.tele).toBe(base);
    expect(story.tele).toBe(Math.round(base * 1.5));
    expect(plain.tele).toBeGreaterThanOrEqual(30);
  });
});

describe('bolts', () => {
  it('fires 3 aimed shots per lit emitter at 360 px/s, 7 steps apart', () => {
    const { run, log } = play(bolts, { story: false, speed: 1, seed: 7 });
    const lit = run.lit.map((l, i) => (l ? BOSS.x + (BOSS.w * (i + 0.5)) / 4 : -1)).filter((x) => x >= 0);
    expect(lit.length).toBeGreaterThanOrEqual(1);
    expect(log.shots).toHaveLength(3 * lit.length);
    for (const s of log.shots) {
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
      expect(s.damage).toBe(10);
      expect(lit.some((x) => Math.abs(x - s.x) < 1e-9)).toBe(true);
    }
    const times = [...new Set(log.shots.map((s) => s.at))];
    expect(times).toEqual([run.tele, run.tele + 7, run.tele + 14]);
  });

  it('lights exactly one emitter on Story and never none', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const normal = play(bolts, { story: false, speed: 1, seed }).run;
      const story = play(bolts, { story: true, speed: 1, seed }).run;
      expect(normal.lit.filter(Boolean).length).toBeGreaterThanOrEqual(1);
      expect(story.lit.filter(Boolean)).toHaveLength(1);
    }
  });
});

describe('drop', () => {
  it('hurts 25 once per block, on the step it lands, with a column over the drone', () => {
    const { run, log } = play(drop, { story: false, speed: 1, seed: 3 });
    expect(run.cols).toHaveLength(3);
    expect(log.hurts).toHaveLength(3);
    for (const h of log.hurts) {
      expect(h.n).toBe(25);
      expect(h.area.w).toBe(80);
      expect(h.area.h).toBe(80);
      expect([820, 680]).toContain(h.area.y + 80);
      expect(h.at).toBeGreaterThanOrEqual(run.tele);
    }
    const dc = DRONE.x + DRONE.w / 2;
    expect(log.hurts.some((h) => h.area.x <= dc && dc <= h.area.x + 80)).toBe(true);
  });

  it('uses 2 columns on Story', () => {
    const { log } = play(drop, { story: true, speed: 1, seed: 3 });
    expect(log.hurts).toHaveLength(2);
  });
});

describe('grid', () => {
  it('hurts each line at most once, and keeps the lines in their bands', () => {
    const everywhere: Rect = { x: 0, y: 0, w: 1920, h: 900 };
    const { run, log } = play(grid, { story: false, speed: 1, seed: 5, drone: everywhere });
    expect(log.hurts).toHaveLength(4);
    expect(new Set(log.hurts.map((h) => JSON.stringify(h.area))).size).toBe(4);
    expect(log.hurts.every((h) => h.n === 15)).toBe(true);
    for (const l of run.lines.filter((x) => x.horizontal)) {
      expect(l.rect.y + 3).toBeGreaterThanOrEqual(200);
      expect(l.rect.y + 3).toBeLessThanOrEqual(800);
    }
    for (const l of run.lines.filter((x) => !x.horizontal)) {
      expect(l.rect.x + 3).toBeGreaterThanOrEqual(120);
      expect(l.rect.x + 3).toBeLessThanOrEqual(1800);
    }
  });
});

describe('chain', () => {
  it('runs along the floor at 420 px/s toward the drone, then bursts once', () => {
    const far: Rect = { x: 1700, y: 772, w: 36, h: 48 };
    for (const speed of SPEEDS) {
      const xs: number[] = [];
      const ys: number[] = [];
      const { log } = play(chain, { story: false, speed, seed: 2, drone: far }, (_i, r) => {
        if (r.phase === 'run') {
          xs.push(r.x);
          ys.push(r.y);
        }
      });
      expect(xs.length).toBeGreaterThan(50);
      const diffs = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
      for (const d of diffs) expect(d).toBeCloseTo(420 / 60, 6);
      expect(new Set(ys)).toEqual(new Set([812]));
      const bursts = log.hurts.filter((h) => h.n === 20);
      expect(bursts).toHaveLength(1);
      expect(bursts[0].area.w).toBe(200);
    }
  });
});

describe('freeze', () => {
  it('makes exactly 2 hazards of 3000 ms on the platforms, never the arena floor', () => {
    const { run, log } = play(freeze, { story: false, speed: 1, seed: 9 });
    expect(run.plats).toHaveLength(2);
    expect(log.hazards).toHaveLength(2);
    for (const h of log.hazards) {
      expect(h.ms).toBe(3000);
      expect(h.damage).toBe(15);
      expect(h.r.h).toBe(16);
      expect(h.r.y).not.toBe(816);
      expect(run.plats.some((p) => p.x === h.r.x && p.y - 4 === h.r.y)).toBe(true);
    }
  });

  it('makes no hazards when only the arena floor exists', () => {
    const { run, log } = play(freeze, { story: false, speed: 1, seed: 9, floors: [FLOORS[0]] });
    expect(run.plats).toHaveLength(0);
    expect(log.hazards).toHaveLength(0);
  });
});

describe('segments', () => {
  it('returns every segment home, and reports them away while they fly', () => {
    for (const speed of SPEEDS) {
      for (const story of STORY) {
        let peak = 0;
        const { run, log } = play(segments, { story, speed, seed: 4 }, (_i, r) => {
          peak = Math.max(peak, r.away);
        });
        expect(run.segs.every((s) => s.state === 'home')).toBe(true);
        expect(run.away).toBe(0);
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThanOrEqual(run.segs.length);
        if (story) expect(run.segs).toHaveLength(4);
        else {
          expect(run.segs.length).toBeGreaterThanOrEqual(4);
          expect(run.segs.length).toBeLessThanOrEqual(7);
        }
        expect(log.hurts.length).toBeLessThanOrEqual(run.segs.length);
        expect(log.hurts.every((h) => h.n === 15)).toBe(true);
      }
    }
  });
});

describe('mirror', () => {
  it('fires every 90 steps, three times in its 360 steps', () => {
    const { run, log } = play(mirror, { story: false, speed: 1, seed: 4 });
    expect(log.shots.map((s) => s.at)).toEqual([run.tele + 90, run.tele + 180, run.tele + 270]);
    for (const s of log.shots) expect(s.damage).toBe(10);
  });

  it('keeps 3 shots at speed 1.4 too', () => {
    const { log } = play(mirror, { story: true, speed: 1.4, seed: 4 });
    expect(log.shots).toHaveLength(3);
  });

  it('hurts 15 on every step the twin overlaps the drone', () => {
    const onDrone = Array.from({ length: 180 }, () => ({ x: DRONE.x, y: DRONE.y }));
    const { log } = play(mirror, { story: false, speed: 1, seed: 4, trail: onDrone });
    expect(log.hurts).toHaveLength(360);
    expect(log.hurts.every((h) => h.n === 15 && h.area.w === 36 && h.area.h === 48)).toBe(true);
  });
});

describe('draw', () => {
  it('runs on a stub context at every step, for every attack', () => {
    const g = stubContext();
    for (const a of ATTACK_LIST) {
      for (const story of STORY) {
        expect(() => play(a, { story, speed: 1.4, seed: 8 }, (i, run) => a.draw(g, run, i))).not.toThrow();
      }
    }
  });
});

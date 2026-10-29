// Act 3 attack tests, part B (Phase 6 Spec, section 6): congest, rush, shift and eye on a fake context, Standard and
// Story, at speeds 1 and 1.4, plus one number check per attack. The four bodies are drawn in the same test file.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { STEP_MS, frames } from '../tuning';
import { congest, eye, rush, shift } from './attacks-act3b';
import { knot, sleeper, snake, snakePoints, transceivers } from './bodies-act3b';
import type { Attack, AttackCtx, BodyDrawer, BodyState } from './types';

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
interface Platform { r: Rect; ms: number; at: number }
interface Log {
  at: number; shots: Shot[]; hurts: Hurt[]; hazards: Hazard[]; platforms: Platform[]; sfx: string[];
}
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

/** The fake context, with every call written to `log` against the step it was made on. */
function makeCtx(o: Opts, log: Log): AttackCtx {
  return {
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
    platform: (r, ms) => log.platforms.push({ r, ms, at: log.at }),
    sfx: (n) => log.sfx.push(n),
  };
}

function freshLog(): Log {
  return { at: 0, shots: [], hurts: [], hazards: [], platforms: [], sfx: [] };
}

/** Runs one attack to its end (or 900 steps), recording every call with the step index it was made on. */
function play<R>(a: Attack<R>, o: Opts, onStep?: (i: number, run: R) => void) {
  const log = freshLog();
  const c = makeCtx(o, log);
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

/** A canvas stand-in: any method or property a draw uses is accepted, and gradients have a stop method. */
function proxyContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const gradient = { addColorStop: noop };
  const store: Record<PropertyKey, unknown> = {};
  const handler: ProxyHandler<Record<PropertyKey, unknown>> = {
    get: (t, k) => {
      if (k in t) return t[k];
      return k === 'createRadialGradient' || k === 'createLinearGradient' ? () => gradient : noop;
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  };
  return new Proxy(store, handler) as unknown as CanvasRenderingContext2D;
}

const ACT3B: Attack<unknown>[] = [congest, rush, shift, eye];
const SPEEDS = [1, 1.4];

describe('act 3 part B attack ids', () => {
  it('names each attack as the table will look it up', () => {
    expect(congest.id).toBe('congest');
    expect(rush.id).toBe('rush');
    expect(shift.id).toBe('shift');
    expect(eye.id).toBe('eye');
  });
});

describe('every act 3 part B attack', () => {
  for (const a of ACT3B) {
    for (const story of [false, true]) {
      it(`${a.id}: starts, ends within 900 steps, and draws without throwing for 20 seeds (story ${story})`, () => {
        const g = proxyContext();
        for (const speed of SPEEDS) {
          for (let seed = 1; seed <= 20; seed++) {
            const { done, steps } = play(a, { story, speed, seed }, (i, run) => a.draw(g, run, i));
            expect(done).toBe(true);
            expect(steps).toBeLessThanOrEqual(900);
          }
        }
      });
    }
  }
});

describe('congest', () => {
  it('leaves a 360 px gap for 3 s, then the walls retreat', () => {
    let open = 0;
    let firstOpen = -1;
    play(congest, { story: false, speed: 1, seed: 1 }, (i, run) => {
      if (run.right.x - (run.left.x + run.left.w) === 360) {
        open++;
        if (firstOpen < 0) firstOpen = i;
      }
    });
    expect(open).toBe(frames(3000));
    expect(firstOpen).toBeGreaterThan(0);
  });

  it('walls do no damage: they only push, one step at a time as platforms', () => {
    const { log } = play(congest, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(0);
    expect(log.platforms.length).toBeGreaterThan(0);
    for (const p of log.platforms) expect(p.ms).toBe(STEP_MS);
  });

  it('puts 2 hot floor patches, 120 px wide, at the gap edges, when the gap opens, for the same 3 s', () => {
    const { log } = play(congest, { story: false, speed: 1, seed: 1 });
    expect(log.hazards).toHaveLength(2);
    const [left, right] = log.hazards;
    expect(left.r.w).toBe(120);
    expect(right.r.w).toBe(120);
    expect(left.r.x).toBe(780);
    expect(right.r.x + right.r.w).toBe(1140);
    for (const h of log.hazards) {
      expect(h.ms).toBe(3000);
      expect(h.r.y + h.r.h).toBe(820);
    }
    // the patches come out on the step the gap is fully open
    expect(log.hazards[0].at).toBe(log.hazards[1].at);
  });

  it('hurts 3 per hit, which at one hit every 0.6 s of i-frames is 5 damage a second', () => {
    const { log } = play(congest, { story: false, speed: 1, seed: 1 });
    for (const h of log.hazards) expect(h.damage * (1000 / 600)).toBeCloseTo(5, 6);
  });
});

describe('rush', () => {
  it('wakes three times, 2 s apart, the first at the start of the attack', () => {
    const wakesAt: number[] = [];
    let seen = 0;
    play(rush, { story: false, speed: 1, seed: 2 }, (_i, run) => {
      if (run.launched > seen) {
        seen = run.launched;
        wakesAt.push(run.t);
      }
    });
    expect(wakesAt).toEqual([0, 120, 240]);
    expect(frames(2000)).toBe(120);
  });

  it('runs the shockwave both ways along the floor at 420 px/s, 7 px a step', () => {
    const steps = new Map<object, number[]>();
    play(rush, { story: false, speed: 1, seed: 2 }, (_i, run) => {
      for (const f of run.fronts) {
        const xs = steps.get(f) ?? [];
        xs.push(f.x);
        steps.set(f, xs);
      }
    });
    const fronts = [...steps.entries()];
    expect(fronts).toHaveLength(6);
    const dirs = new Set<number>();
    for (const [f, xs] of fronts) {
      const dir = (f as { dir: number }).dir;
      dirs.add(dir);
      for (let k = 1; k < Math.min(xs.length, 20); k++) expect(xs[k] - xs[k - 1]).toBeCloseTo(dir * 7, 9);
    }
    expect([...dirs].sort()).toEqual([-1, 1]);
  });

  it('hurts the drone 15 once per wake when a front passes through it', () => {
    const { log } = play(rush, { story: false, speed: 1, seed: 2 });
    expect(log.hurts).toHaveLength(3);
    for (const h of log.hurts) {
      expect(h.n).toBe(15);
      expect(h.area.h).toBe(30);
    }
  });
});

describe('shift', () => {
  it('shows the numbers 1 to 6 in a scrambled order, never in order', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run } = play(shift, { story: false, speed: 1, seed });
      expect([...run.label].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(run.label).not.toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('fires one 10 damage bolt per number, in number order, 0.3 s apart, from that segment', () => {
    const { run, log } = play(shift, { story: false, speed: 1, seed: 3 });
    expect(log.shots).toHaveLength(6);
    expect(run.pts).toEqual(snakePoints(mid(BOSS).x, mid(BOSS).y));
    log.shots.forEach((s, n) => {
      const k = run.label.indexOf(n + 1);
      expect(s.damage).toBe(10);
      expect(s.x).toBeCloseTo(run.pts[k].x, 9);
      expect(s.y).toBeCloseTo(run.pts[k].y, 9);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
    });
    const ats = log.shots.map((s) => s.at);
    for (let i = 1; i < ats.length; i++) expect(ats[i] - ats[i - 1]).toBe(frames(300));
    expect(frames(300)).toBe(18);
  });

  it('spaces the six segments 74 px apart on the arch', () => {
    const pts = snakePoints(960, 400);
    expect(pts).toHaveLength(6);
    for (let k = 1; k < 6; k++) expect(pts[k].x - pts[k - 1].x).toBeCloseTo(74, 9);
  });
});

describe('eye', () => {
  it('closes two rings from 600 px to 0 over 2.5 s', () => {
    const radii: [number, number][] = [];
    const { run } = play(eye, { story: false, speed: 1, seed: 4 }, (_i, r) => radii.push([r.t, r.radius]));
    expect(radii[0]).toEqual([0, 600]);
    for (const [t, r] of radii) expect(r).toBeCloseTo(600 * (1 - Math.min(1, t / 150)), 6);
    expect(run.radius).toBe(0);
    expect(frames(2500)).toBe(150);
  });

  it('hurts 18 when the rings meet a drone that is outside the eye', () => {
    const { hurts } = closeOn(5, -1);
    expect(hurts).toEqual([18]);
  });

  it('does not hurt a drone that is inside the eye when the rings meet', () => {
    const { hurts } = closeOn(5, 1);
    expect(hurts).toEqual([]);
  });
});

/** Runs the eye with the drone held 300 px from the rings' anchor. `onOpen` 1 puts it on the eye's open side, -1 on
 *  the side the eye is closed to. Returns the damage the rings did. */
function closeOn(seed: number, onOpen: number) {
  const log = freshLog();
  const c = makeCtx({ story: false, speed: 1, seed }, log);
  const run = eye.start(c);
  const side = run.side;
  const drone = (dir: number): Rect => ({ x: run.anchor.x + dir * 300 - 18, y: run.anchor.y - 24, w: 36, h: 48 });
  c.drone = drone(onOpen === 1 ? side : -side);
  let done = false;
  let steps = 0;
  while (!done && steps < 900) {
    log.at = steps;
    done = eye.step(run, c, 1);
    steps++;
  }
  return { hurts: log.hurts.map((h) => h.n), side };
}

describe('the act 3 bodies in part B', () => {
  const BOX: Rect = { x: 0, y: 0, w: 520, h: 260 };
  const BASE: BodyState = {
    t: 0, hp: 1, shielded: false, enraged: false, flash: 0, attack: null, telegraph: 0,
    lit: [false, false, false, false], away: 0,
  };
  const STATES: [string, Partial<BodyState>][] = [
    ['t 0', {}],
    ['t 600', { t: 600 }],
    ['hp 0.1 shielded enraged', { hp: 0.1, shielded: true, enraged: true }],
    ['flash 6', { flash: 6 }],
    ['congest telegraph', { attack: 'congest', telegraph: 0.5 }],
    ['rush awake', { attack: 'rush', telegraph: 0.8 }],
    ['shift telegraph', { attack: 'shift', telegraph: 0.4 }],
    ['segments away 3', { attack: 'segments', away: 3, telegraph: 0.9 }],
    ['bolts telegraph', { attack: 'bolts', telegraph: 0.5 }],
    ['eye closing', { attack: 'eye', t: 90 }],
  ];
  const BODIES: [string, BodyDrawer][] = [
    ['knot', knot], ['sleeper', sleeper], ['snake', snake], ['transceivers', transceivers],
  ];
  for (const [name, draw] of BODIES) {
    it(`${name}: draws in every state without throwing`, () => {
      const g = proxyContext();
      for (const [, over] of STATES) {
        for (let k = 0; k < 4; k++) {
          const s: BodyState = { ...BASE, ...over, t: (over.t ?? 0) + k * 61 };
          expect(() => draw(g, BOX, s)).not.toThrow();
        }
      }
    });
  }
});

/** The midpoint of a rect. */
function mid(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

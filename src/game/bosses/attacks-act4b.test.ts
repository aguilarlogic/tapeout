// Act 4 attack tests, part B (Phase 7 Spec, section 6): reorder, evict, jam and predict on a fake context, Standard and
// Story, at speeds 1 and 1.4, plus one number check per attack. The four bodies are tested in bodies-act4b.test.ts.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { frames } from '../tuning';
import type { Timed } from './attacks';
import { evict, jam, predict, reorder } from './attacks-act4b';
import { hologramPorts, windowSlots } from './bodies-act4b';
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
    lens: 0,
    spawn: () => undefined,
    soak: () => 0,
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

const ACT4B: Attack<unknown>[] = [reorder, evict, jam, predict];
const SPEEDS = [1, 1.4];
const mid = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The telegraph length, in real steps, for an attack on the given profile. */
function teleOf(a: Attack<unknown>, story: boolean): number {
  return (a.start(makeCtx({ story, speed: 1, seed: 1 }, freshLog())) as Timed).tele;
}

describe('act 4 part B attack ids', () => {
  it('names each attack as the table will look it up', () => {
    expect(reorder.id).toBe('reorder');
    expect(evict.id).toBe('evict');
    expect(jam.id).toBe('jam');
    expect(predict.id).toBe('predict');
  });
});

describe('every act 4 part B attack', () => {
  for (const a of ACT4B) {
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

  for (const a of ACT4B) {
    it(`${a.id}: telegraphs at least 30 steps, longer on Story, and plays 1 to 8 sfx cues`, () => {
      const std = teleOf(a, false), st = teleOf(a, true);
      expect(std).toBeGreaterThanOrEqual(30);
      expect(st).toBeGreaterThan(std);
      for (const story of [false, true]) {
        for (let seed = 1; seed <= 20; seed++) {
          const { log } = play(a, { story, speed: 1, seed });
          expect(log.sfx.length).toBeGreaterThanOrEqual(1);
          expect(log.sfx.length).toBeLessThanOrEqual(8);
        }
      }
    });

    it(`${a.id}: does nothing that hurts, fires or spawns before its telegraph ends`, () => {
      for (const story of [false, true]) {
        for (let seed = 1; seed <= 5; seed++) {
          const { run, log } = play(a, { story, speed: 1.4, seed });
          const tele = (run as Timed).tele;
          const all = [...log.shots, ...log.hurts, ...log.hazards, ...log.platforms];
          for (const e of all) expect(e.at).toBeGreaterThanOrEqual(tele);
        }
      }
    });
  }
});

describe('reorder', () => {
  it('six numbered bolts start in the window slots, numbers 1 to 6 scrambled, never in order', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run } = play(reorder, { story: false, speed: 1, seed });
      const labels = [...run.bolts].sort((x, y) => x.slot - y.slot).map((b) => b.label);
      expect([...labels].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(labels).not.toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('bolts leave in a scrambled order, 0.1 s apart, and not in number order', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run } = play(reorder, { story: false, speed: 1, seed });
      const byLeave = [...run.bolts].sort((x, y) => x.leave - y.leave);
      expect(byLeave.map((b) => b.leave)).toEqual([0, 1, 2, 3, 4, 5].map((i) => i * frames(100)));
      expect(byLeave.map((b) => b.label)).not.toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('each bolt drifts 200 px in 1 s and then stops', () => {
    const slots = windowSlots(mid(BOSS).x, mid(BOSS).y);
    const last = new Map<number, { x: number; y: number }>();
    play(reorder, { story: false, speed: 1, seed: 7 }, (_i, run) => {
      for (const b of run.bolts) if (!b.gone) last.set(b.slot, { x: b.x, y: b.y });
    });
    expect(last.size).toBe(6);
    for (const [slot, p] of last) {
      expect(Math.hypot(p.x - slots[slot].x, p.y - slots[slot].y)).toBeCloseTo(200, 5);
    }
  });

  it('retires the bolts in number order, 1 to 6, 0.3 s apart, at 420 px/s for 10 each', () => {
    const { log } = play(reorder, { story: false, speed: 1, seed: 3 });
    expect(log.shots).toHaveLength(6);
    for (const s of log.shots) {
      expect(s.damage).toBe(10);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(420, 6);
    }
    for (let i = 1; i < 6; i++) expect(log.shots[i].at - log.shots[i - 1].at).toBe(frames(300));
    expect(frames(300)).toBe(18);
  });
});

describe('evict', () => {
  it('puts four cache lines 110 px over the floor, two of them evicted early', () => {
    const { log } = play(evict, { story: false, speed: 1, seed: 4 });
    expect(log.platforms).toHaveLength(4);
    for (const p of log.platforms) {
      expect(p.r.w).toBe(160);
      expect(p.r.h).toBe(16);
      expect(p.r.y + p.r.h).toBe(820 - 110);
    }
    const ms = log.platforms.map((p) => p.ms).sort((x, y) => x - y);
    expect(ms.filter((m) => m === 3300)).toHaveLength(2);
    expect(ms.filter((m) => m === 5000)).toHaveLength(2);
  });

  it('keeps the evicted lines on time at any speed (the platform time is active time over speed)', () => {
    const { log } = play(evict, { story: false, speed: 1.4, seed: 4 });
    for (const p of log.platforms) {
      const active = p.ms * 1.4;
      expect(Math.abs(active - 3300) < 3 || Math.abs(active - 5000) < 3).toBe(true);
    }
  });

  it('turns the floor into one 24 px MISS strip 1 s after the lines, for 3 s, 12 damage', () => {
    const { log } = play(evict, { story: false, speed: 1, seed: 4 });
    expect(log.hazards).toHaveLength(1);
    const [h] = log.hazards;
    expect(h.r.h).toBe(24);
    expect(h.r.w).toBe(1920);
    expect(h.r.y + h.r.h).toBe(820);
    expect(h.damage).toBe(12);
    expect(h.ms).toBe(3000);
    expect(h.at - log.platforms[0].at).toBe(frames(1000));
  });

  it('fires three bolts while the strip is live', () => {
    const { log } = play(evict, { story: false, speed: 1, seed: 4 });
    expect(log.shots).toHaveLength(3);
    const strip = log.hazards[0].at;
    for (const s of log.shots) {
      expect(s.at).toBeGreaterThanOrEqual(strip);
      expect(s.at).toBeLessThan(strip + frames(3000));
      expect(s.damage).toBe(10);
    }
  });

  it('a Story run lengthens the wait before the strip (the lines and strip are telegraphed)', () => {
    const { log } = play(evict, { story: true, speed: 1, seed: 4 });
    expect(log.hazards[0].at - log.platforms[0].at).toBe(frames(1000) * 1.5);
  });
});

describe('jam', () => {
  it('cuts the arena into five columns and fills three of them in each of three jams', () => {
    const { log } = play(jam, { story: false, speed: 1, seed: 5 });
    expect(log.hazards).toHaveLength(9);
    const colW = 1920 / 5;
    const groups = new Map<number, Hazard[]>();
    for (const h of log.hazards) groups.set(h.at, [...(groups.get(h.at) ?? []), h]);
    expect(groups.size).toBe(3);
    for (const hs of groups.values()) {
      expect(hs).toHaveLength(3);
      const cols = hs.map((h) => h.r.x / colW);
      expect(new Set(cols).size).toBe(3);
      for (const k of cols) expect(Number.isInteger(k) && k >= 0 && k <= 4).toBe(true);
      for (const h of hs) {
        expect(h.r.w).toBe(colW);
        expect(h.r.h).toBe(900);
        expect(h.damage).toBe(15);
        expect(h.ms).toBe(2000);
      }
    }
  });

  it('spaces the jams by the 2 s fill and the 0.8 s lock between them', () => {
    const { log } = play(jam, { story: false, speed: 1, seed: 5 });
    const ats = [...new Set(log.hazards.map((h) => h.at))];
    expect(ats[1] - ats[0]).toBe(frames(2000) + frames(800));
    expect(ats[2] - ats[1]).toBe(frames(2000) + frames(800));
  });

  it('lengthens the later locks on Story', () => {
    const { log } = play(jam, { story: true, speed: 1, seed: 5 });
    const ats = [...new Set(log.hazards.map((h) => h.at))];
    expect(ats[1] - ats[0]).toBe(frames(2000) + Math.round(frames(800) * 1.5));
  });
});

describe('predict', () => {
  it('shows four lines from the ports to the drone for 0.6 s, then fires four 12 damage bolts at 420 px/s', () => {
    const { run, log } = play(predict, { story: false, speed: 1, seed: 6 });
    expect(run.lines).toHaveLength(4);
    expect(run.tele).toBe(frames(600));
    expect(log.shots).toHaveLength(4);
    for (const s of log.shots) {
      expect(s.damage).toBe(12);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(420, 6);
    }
  });

  it('fires 0.6 s after the lines fade, later than they showed', () => {
    const { run, log } = play(predict, { story: false, speed: 1, seed: 6 });
    expect(log.shots[0].at - run.tele).toBe(frames(600));
  });

  it('aims the bolts at the drone where it is when they fire, so an early dodge is still in the path', () => {
    const log = freshLog();
    const c = makeCtx({ story: false, speed: 1, seed: 6 }, log);
    const run = predict.start(c);
    for (let i = 0; i < run.tele; i++) {
      log.at = i;
      predict.step(run, c, 1);
    }
    // the drone dodges right after the lines show, to the far left of the arena
    const moved: Rect = { x: 200, y: 772, w: 36, h: 48 };
    c.drone = moved;
    let done = false;
    let steps = 0;
    while (!done && steps < 900) {
      log.at = run.tele + steps;
      done = predict.step(run, c, 1);
      steps++;
    }
    expect(log.shots).toHaveLength(4);
    const target = mid(moved);
    for (const s of log.shots) {
      const dx = target.x - s.x, dy = target.y - s.y, len = Math.hypot(dx, dy);
      const dot = (s.vx * dx + s.vy * dy) / (Math.hypot(s.vx, s.vy) * len);
      expect(dot).toBeCloseTo(1, 6);
    }
  });

  it('starts its lines at the hologram ports, one per port', () => {
    const { run } = play(predict, { story: false, speed: 1, seed: 6 });
    const ports = hologramPorts(mid(BOSS).x, mid(BOSS).y);
    run.lines.forEach((l, k) => expect(l.from).toEqual(ports[k]));
  });
});

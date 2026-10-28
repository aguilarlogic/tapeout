// Wing attack tests, part B (Phase 8 Spec, section 5): dies, cracks and hang on a fake context, Standard and Story. The
// attacks are imported directly; table.ts registers them with the rest of the wing bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { HZ } from '../tuning';
import type { Pt, Timed } from './attacks';
import { cracks, dies, hang } from './attacks-wings-b';
import type { Attack, AttackCtx } from './types';

const ARENA: Rect = { x: 0, y: 0, w: 1920, h: 900 };
const BOSS: Rect = { x: 700, y: 240, w: 520, h: 260 };
const FLOORS: Rect[] = [
  { x: 0, y: 820, w: 1920, h: 80 },
  { x: 240, y: 680, w: 140, h: 20 },
  { x: 1540, y: 680, w: 140, h: 20 },
];
const DRONE: Rect = { x: 900, y: 772, w: 36, h: 48 };
/** A drone at the left edge of the arena: a crack from the boss runs its full 900 px. */
const LEFT: Rect = { x: 0, y: 100, w: 36, h: 48 };
/** A drone far from the boss and the floor, so no shot or hazard meets it in the first steps. */
const FAR: Rect = { x: 60, y: 100, w: 36, h: 48 };
const TRAIL = Array.from({ length: 180 }, (_, i) => ({ x: 300 + i, y: 500 }));

interface Shot { x: number; y: number; vx: number; vy: number; damage: number; at: number }
interface Hurt { area: Rect; n: number; at: number }
interface Hazard { r: Rect; ms: number; damage: number; at: number }
interface Platform { r: Rect; ms: number; at: number }
interface Spawn { kind: string; x: number; y: number; at: number }
interface Log {
  at: number; shots: Shot[]; hurts: Hurt[]; hazards: Hazard[]; platforms: Platform[]; spawns: Spawn[]; sfx: string[];
}
interface Opts {
  story: boolean; speed: number; seed: number; drone?: Rect; lens?: number; soak?: (r: Rect) => number;
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
  const log: Log = { at: 0, shots: [], hurts: [], hazards: [], platforms: [], spawns: [], sfx: [] };
  const c: AttackCtx = {
    rand: seeded(o.seed),
    story: o.story,
    drone: o.drone ?? DRONE,
    trail: TRAIL,
    arena: ARENA,
    boss: BOSS,
    floors: FLOORS,
    shoot: (x, y, vx, vy, damage) => log.shots.push({ x, y, vx, vy, damage, at: log.at }),
    hurt: (area, n) => log.hurts.push({ area, n, at: log.at }),
    hazard: (r, ms, damage) => log.hazards.push({ r, ms, damage, at: log.at }),
    platform: (r, ms) => log.platforms.push({ r, ms, at: log.at }),
    lens: o.lens ?? 0,
    spawn: (kind, x, y) => log.spawns.push({ kind, x, y, at: log.at }),
    soak: (r) => (o.soak ? o.soak(r) : 0),
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

const WING_B: Attack<unknown>[] = [dies, cracks, hang];
const SPEEDS = [1, 1.4];
const teleOf = (r: unknown) => (r as Timed).tele;
const droneMid = { x: DRONE.x + DRONE.w / 2, y: DRONE.y + DRONE.h / 2 };
/** A hang bolt sits on the 170 px ring round (cx, cy), or, where the ring dips under the drone's floor, 16 px above it. */
function onRing(p: { x: number; y: number }, cx: number, cy: number) {
  const floor = Math.min(...FLOORS.filter((f) => f.x < cx + 1 && f.x + f.w > cx - 1 && f.y >= cy).map((f) => f.y), ARENA.y + ARENA.h) - 16;
  if (p.y === floor) expect(cy + Math.sqrt(170 ** 2 - (p.x - cx) ** 2)).toBeGreaterThanOrEqual(floor - 1e-6);
  else expect(Math.hypot(p.x - cx, p.y - cy)).toBeCloseTo(170, 6);
}

describe('every wing attack, part B', () => {
  for (const a of WING_B) {
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

  for (const a of WING_B) {
    it(`${a.id}: telegraphs at least 30 steps, longer on Story, and lens adds its steps`, () => {
      const plain = play(a, { story: false, speed: 1, seed: 1 });
      const story = play(a, { story: true, speed: 1, seed: 1 });
      const lens = play(a, { story: false, speed: 1, seed: 1, lens: 10 });
      expect(teleOf(plain.run)).toBeGreaterThanOrEqual(30);
      expect(teleOf(story.run)).toBeGreaterThan(teleOf(plain.run));
      expect(teleOf(lens.run)).toBe(teleOf(plain.run) + 10);
    });

    it(`${a.id}: plays between 1 and 8 sound cues`, () => {
      for (const story of [false, true]) {
        for (let seed = 1; seed <= 20; seed++) {
          const { log } = play(a, { story, speed: 1, seed });
          expect(log.sfx.length).toBeGreaterThanOrEqual(1);
          expect(log.sfx.length).toBeLessThanOrEqual(8);
        }
      }
    });
  }
});

describe('dies', () => {
  it('splits the bottom 120 px of the arena into 6 x 2 die cells', () => {
    const { run } = play(dies, { story: false, speed: 1, seed: 1 });
    expect(run.cells).toHaveLength(12);
    for (const r of run.cells) {
      expect(r.y).toBeGreaterThanOrEqual(ARENA.y + ARENA.h - 120);
      expect(r.y + r.h).toBeLessThanOrEqual(ARENA.y + ARENA.h);
    }
    expect(new Set(run.cells.map((r) => r.x)).size).toBe(6);
    expect(new Set(run.cells.map((r) => r.y)).size).toBe(2);
    expect(run.cells[0].w * 6).toBe(ARENA.w);
  });

  it('glows 4 cells for 0.9 s (1.35 s on Story), then bursts them for 1 s at 14 damage', () => {
    const plain = play(dies, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(54);
    expect(play(dies, { story: true, speed: 1, seed: 1 }).run.tele).toBe(81);
    expect(plain.log.hazards).toHaveLength(8);
    for (const h of plain.log.hazards) {
      expect(h.damage).toBe(14);
      expect(h.ms).toBe(1000);
    }
  });

  it('runs twice, with a different pattern of 4 glowing cells each time, all from the first glow', () => {
    const sets: string[] = [];
    const glows: number[][] = [];
    play(dies, { story: false, speed: 1, seed: 4 }, (_i, run) => {
      const key = run.glow.join(',');
      if (sets[sets.length - 1] !== key) {
        sets.push(key);
        glows.push([...run.glow]);
      }
    });
    expect(glows).toHaveLength(2);
    for (const g of glows) expect(g).toHaveLength(4);
    expect(glows[0].join(',')).not.toBe(glows[1].join(','));
  });

  it('bursts the cells that glowed, in two bursts 115 steps apart (60 burst + 54 glow + 1)', () => {
    let firstGlow: number[] = [];
    const { log, run } = play(dies, { story: false, speed: 1, seed: 1 }, (i, r) => {
      if (i === 0) firstGlow = [...r.glow];
    });
    const starts = [...new Set(log.hazards.map((h) => h.at))];
    expect(starts).toHaveLength(2);
    expect(starts[0]).toBe(run.tele);
    expect(starts[1] - starts[0]).toBe(115);
    const firstBurst = log.hazards.filter((h) => h.at === starts[0]).map((h) => h.r);
    expect(firstBurst).toEqual(firstGlow.map((i) => run.cells[i]));
    expect(log.sfx).toEqual(['drop', 'drop']);
  });

  it('does no damage during a glow', () => {
    const { log } = play(dies, { story: false, speed: 1, seed: 1 });
    expect(log.hurts).toHaveLength(0);
    expect(log.hazards.every((h) => h.at >= 54)).toBe(true);
  });
});

describe('cracks', () => {
  it('starts 3 cracks from the boss x on the floor, 0.7 s apart', () => {
    const { run } = play(cracks, { story: false, speed: 1, seed: 1 });
    expect(run.x0).toBe(960);
    expect(run.floorY).toBe(820);
    expect(run.cracks).toHaveLength(3);
    expect(run.cracks.map((k) => k.at)).toEqual([0, 42, 84]);
  });

  it('shows a 0.4 s dashed lead before each tip runs (24 steps)', () => {
    const { run } = play(cracks, { story: false, speed: 1, seed: 1 });
    for (const k of run.cracks) expect(k.go - k.at).toBe(24);
  });

  it('runs the tips toward the drone at 260 px/s, one step at a time', () => {
    const xs: number[] = [];
    play(cracks, { story: false, speed: 1, seed: 1, drone: LEFT }, (_i, run) => {
      if (run.cracks[0].moving && !run.cracks[0].done) xs.push(run.cracks[0].ran);
    });
    expect(xs.length).toBeGreaterThan(50);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeCloseTo(260 / HZ, 6);
  });

  it('runs up to 900 px, and stops at the drone x if that comes first', () => {
    const far = play(cracks, { story: false, speed: 1, seed: 1, drone: LEFT }).run;
    for (const k of far.cracks) expect(k.len).toBe(900);
    const near = play(cracks, { story: false, speed: 1, seed: 1 }).run;
    for (const k of near.cracks) expect(k.len).toBeCloseTo(Math.abs(droneMid.x - 960), 6);
    const mid = play(cracks, { story: false, speed: 1, seed: 1, drone: FAR }).run;
    for (const k of mid.cracks) expect(k.len).toBe(Math.abs(FAR.x + FAR.w / 2 - 960));
  });

  it('leaves 16 px tall hazard tiles behind each tip, 10 damage each, lasting 2 s', () => {
    const { log, run } = play(cracks, { story: false, speed: 1, seed: 1, drone: LEFT });
    expect(log.hazards.length).toBeGreaterThan(3 * 18);
    for (const h of log.hazards) {
      expect(h.damage).toBe(10);
      expect(h.ms).toBe(2000);
      expect(h.r.h).toBe(16);
      expect(h.r.y + h.r.h).toBe(820);
      expect(h.r.w).toBeLessThanOrEqual(48);
    }
    const laid = log.hazards.reduce((sum, h) => sum + h.r.w, 0);
    expect(laid).toBeCloseTo(3 * 900, 6);
    expect(run.tiles).toHaveLength(log.hazards.length);
  });

  it('plays the crack sound once for each crack as it starts to run', () => {
    const { log } = play(cracks, { story: false, speed: 1, seed: 1 });
    expect(log.sfx).toEqual(['laser', 'laser', 'laser']);
  });

  it('does no damage before the wind-up ends', () => {
    const { log, run } = play(cracks, { story: false, speed: 1, seed: 1 });
    expect(log.hazards.every((h) => h.at >= run.tele)).toBe(true);
  });
});

describe('hang', () => {
  it('rings 8 frozen bolts at radius 170 round the drone spot, after a 1.5 s telegraph (2.25 s on Story)', () => {
    const plain = play(hang, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(90);
    expect(play(hang, { story: true, speed: 1, seed: 1 }).run.tele).toBe(135);
    const cx = droneMid.x, cy = droneMid.y;
    const bolts: Pt[] = plain.run.bolts;
    expect(bolts).toHaveLength(8);
    for (const p of bolts) onRing(p, cx, cy);
  });

  it('fires all 8 bolts inward at once at 380 px/s, 10 each, at the end of each telegraph', () => {
    const { log, run } = play(hang, { story: false, speed: 1, seed: 1 });
    expect(log.shots).toHaveLength(16);
    expect(log.shots.filter((s) => s.at === run.tele)).toHaveLength(8);
    const times = [...new Set(log.shots.map((s) => s.at))];
    expect(times).toEqual([90, 181]);
    for (const s of log.shots) {
      expect(s.damage).toBe(10);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(380, 6);
      const toCx = droneMid.x - s.x, toCy = droneMid.y - s.y;
      expect(s.vx * toCy - s.vy * toCx).toBeCloseTo(0, 4);
      expect(s.vx * toCx + s.vy * toCy).toBeGreaterThan(0);
    }
  });

  it('runs twice, and the second ring is round the drone spot again', () => {
    const rings: Pt[][] = [];
    play(hang, { story: false, speed: 1, seed: 2 }, (_i, run) => {
      if (rings.length === 0 || rings[rings.length - 1] !== run.bolts) rings.push(run.bolts);
    });
    expect(rings).toHaveLength(2);
    for (const r of rings) {
      for (const p of r) onRing(p, droneMid.x, droneMid.y);
    }
  });

  it('plays the turret sound once for each volley', () => {
    expect(play(hang, { story: false, speed: 1, seed: 1 }).log.sfx).toEqual(['turret', 'turret']);
  });
});

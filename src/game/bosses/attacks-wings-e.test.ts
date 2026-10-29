// Wing attack tests, part E (Phase 8 Spec, section 5): address, mismatch and bands on a fake context, Standard and Story.
// The attacks are imported directly; table.ts registers them with the rest of the wing bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { HZ } from '../tuning';
import { address, bands, mismatch } from './attacks-wings-e';
import type { Timed } from './attacks';
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

const WING_E: Attack<unknown>[] = [address, mismatch, bands];
const SPEEDS = [1, 1.4];
const teleOf = (r: unknown) => (r as Timed).tele;

describe('every wing attack, part E', () => {
  for (const a of WING_E) {
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

  for (const a of WING_E) {
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

describe('address', () => {
  it('opens four 80 x 80 px windows, labelled 0x00 to 0x0C, spread across the arena', () => {
    const { run } = play(address, { story: false, speed: 1, seed: 1 });
    expect(run.wins).toHaveLength(4);
    expect(run.wins.map((w) => w.label)).toEqual(['0x00', '0x04', '0x08', '0x0C']);
    for (const w of run.wins) {
      expect(w.rect.w).toBe(80);
      expect(w.rect.h).toBe(80);
    }
    const xs = run.wins.map((w) => w.rect.x + 40);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThan(400);
  });

  it('telegraphs for 0.8 s (1.2 s on Story)', () => {
    expect(play(address, { story: false, speed: 1, seed: 1 }).run.tele).toBe(48);
    expect(play(address, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
  });

  it('soaks drone shots at every step of the 3 s open, once per window, and no more', () => {
    let calls = 0;
    const { run } = play(address, { story: false, speed: 1, seed: 1, soak: () => { calls++; return 5; } });
    expect(calls).toBe(4 * 180);
    expect(run.absorbed).toBe(4 * 180 * 5);
  });

  it('fires each window as a 3 bolt spread, in label order, 0.4 s apart, at 360 px/s, 9 each', () => {
    const { run, log } = play(address, { story: false, speed: 1, seed: 1 });
    expect(log.shots).toHaveLength(12);
    const at = log.shots.map((s) => s.at - run.tele);
    expect(at).toEqual([180, 180, 180, 204, 204, 204, 228, 228, 228, 252, 252, 252]);
    for (const s of log.shots) {
      expect(s.damage).toBe(9);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(360, 6);
    }
    for (let k = 0; k < 4; k++) {
      const first = log.shots[3 * k];
      expect(first.x).toBeCloseTo(run.wins[k].rect.x + 40, 6);
      expect(first.y).toBeCloseTo(run.wins[k].rect.y + 40, 6);
    }
  });

  it('aims the middle shot of each spread at the drone centre, and the sides a step either side', () => {
    const { log } = play(address, { story: false, speed: 1, seed: 1 });
    const tx = DRONE.x + DRONE.w / 2, ty = DRONE.y + DRONE.h / 2;
    for (let k = 0; k < 4; k++) {
      const [left, mid, right] = log.shots.slice(3 * k, 3 * k + 3);
      const want = Math.atan2(ty - mid.y, tx - mid.x);
      expect(Math.cos(Math.atan2(mid.vy, mid.vx) - want)).toBeCloseTo(1, 9);
      for (const side of [left, right]) {
        expect(Math.cos(Math.atan2(side.vy, side.vx) - want)).toBeCloseTo(Math.cos(0.14), 9);
      }
    }
  });
});

describe('mismatch', () => {
  it('draws four telegraph lines for 0.7 s, from spots on the left side', () => {
    const { run } = play(mismatch, { story: false, speed: 1, seed: 1 });
    expect(run.pairs).toHaveLength(4);
    expect(run.tele).toBe(42);
    expect(teleOf(play(mismatch, { story: true, speed: 1, seed: 1 }).run)).toBe(63);
    for (const p of run.pairs) expect(p.left.x).toBeLessThan(ARENA.w / 2);
  });

  it('aims every telegraph line at the drone centre', () => {
    const { run } = play(mismatch, { story: false, speed: 1, seed: 1 });
    expect(run.target.x).toBe(DRONE.x + DRONE.w / 2);
    expect(run.target.y).toBe(DRONE.y + DRONE.h / 2);
  });

  it('puts the right side spots at the mirror of the left spots, about the arena centre x', () => {
    const { run } = play(mismatch, { story: false, speed: 1, seed: 1 });
    for (const p of run.pairs) {
      expect(p.right.x).toBe(ARENA.w - p.left.x);
      expect(p.right.y).toBe(p.left.y);
    }
  });

  it('fires 4 bolts at 420 px/s, 12 each, once from each right side spot as the telegraph ends', () => {
    const { run, log } = play(mismatch, { story: false, speed: 1, seed: 1 });
    expect(log.shots).toHaveLength(4);
    for (let k = 0; k < 4; k++) {
      const s = log.shots[k];
      expect(s.at).toBe(run.tele);
      expect(s.damage).toBe(12);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(420, 6);
      expect(s.x).toBeCloseTo(run.pairs[k].right.x, 6);
      expect(s.y).toBeCloseTo(run.pairs[k].right.y, 6);
    }
  });

  it('sends each bolt along the mirror of its telegraph line', () => {
    const { run, log } = play(mismatch, { story: false, speed: 1, seed: 1 });
    run.pairs.forEach((p, k) => {
      const dx = run.target.x - p.left.x, dy = run.target.y - p.left.y, l = Math.hypot(dx, dy);
      expect(log.shots[k].vx / 420).toBeCloseTo(-dx / l, 9);
      expect(log.shots[k].vy / 420).toBeCloseTo(dy / l, 9);
    });
  });

  it('flashes "!" on the right side spots for the last 0.2 s of the telegraph, and not on the left', () => {
    const g = proxyContext();
    const texts: string[] = [];
    g.fillText = (text: string) => { texts.push(text); };
    const marks: { age: number; count: number }[] = [];
    play(mismatch, { story: false, speed: 1, seed: 1 }, (i, run) => {
      texts.length = 0;
      mismatch.draw(g, run, i);
      marks.push({ age: run.age, count: texts.filter((t) => t === '!').length });
    });
    const tele = 42;
    const flashAges = marks.filter((m) => m.count > 0).map((m) => m.age);
    expect(flashAges).toEqual(Array.from({ length: 12 }, (_, k) => tele - 11 + k));
    expect(marks.every((m) => m.count === 0 || m.count === 4)).toBe(true);
  });
});

describe('bands', () => {
  it('shows a 120 px vertical band dashed at the left edge, then sweeps it right at 420 px/s', () => {
    const xs: number[] = [];
    let startX = -1;
    const { run } = play(bands, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      if (r.n === 0 && r.age === r.tele) startX = r.vert.x;
      if (r.n === 0 && r.age > r.tele) xs.push(r.vert.x);
    });
    expect(startX).toBe(ARENA.x);
    expect(run.vert.w).toBe(120);
    expect(xs.length).toBeGreaterThan(200);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeCloseTo(420 / HZ, 6);
  });

  it('sweeps the vertical band across the whole arena, about 275 steps at 7 px a step', () => {
    let steps = 0;
    play(bands, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      if (r.n === 0 && r.age > r.tele) steps++;
    });
    expect(steps).toBeGreaterThanOrEqual(274);
    expect(steps).toBeLessThanOrEqual(276);
  });

  it('shows a 60 px horizontal band at the top with a 140 px gap, then sweeps it down at 300 px/s', () => {
    const ys: number[] = [];
    let topY = -1;
    play(bands, { story: false, speed: 1, seed: 1 }, (_i, r) => {
      if (r.n === 1 && r.age === r.tele) topY = r.horizY;
      if (r.n === 1 && r.age > r.tele) ys.push(r.horizY);
    });
    expect(topY).toBe(ARENA.y);
    expect(ys.length).toBeGreaterThan(100);
    for (let k = 1; k < ys.length; k++) expect(ys[k] - ys[k - 1]).toBeCloseTo(300 / HZ, 6);
  });

  it('places the gap at a random x, so different seeds give different gaps', () => {
    const gaps = new Set<number>();
    for (let seed = 1; seed <= 5; seed++) {
      const { run } = play(bands, { story: false, speed: 1, seed });
      expect(run.gap).toBeGreaterThanOrEqual(ARENA.x);
      expect(run.gap).toBeLessThanOrEqual(ARENA.x + ARENA.w - 140);
      gaps.add(run.gap);
    }
    expect(gaps.size).toBeGreaterThan(1);
  });

  it('telegraphs each band for 0.8 s (1.2 s on Story)', () => {
    expect(play(bands, { story: false, speed: 1, seed: 1 }).run.tele).toBe(48);
    expect(play(bands, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
  });

  it('hurts 14 once for the vertical band, and at most once for the horizontal one', () => {
    const { log } = play(bands, { story: false, speed: 1, seed: 1 });
    expect(log.hurts.every((h) => h.n === 14)).toBe(true);
    expect(log.hurts.filter((h) => h.area.h === ARENA.h)).toHaveLength(1);
    expect(log.hurts.length).toBeGreaterThanOrEqual(1);
    expect(log.hurts.length).toBeLessThanOrEqual(2);
  });

  it('hurts the drone under the horizontal band when it is outside the gap', () => {
    const gap = play(bands, { story: false, speed: 1, seed: 4 }).run.gap;
    const x = gap > 136 ? 100 : 1700;
    const { log } = play(bands, { story: false, speed: 1, seed: 4, drone: { x, y: 772, w: 36, h: 48 } });
    expect(log.hurts.filter((h) => h.area.h === 60)).toHaveLength(1);
  });

  it('lets the drone through the gap in the horizontal band', () => {
    const gap = play(bands, { story: false, speed: 1, seed: 4 }).run.gap;
    const drone = { x: gap + 52, y: 772, w: 36, h: 48 };
    const { log } = play(bands, { story: false, speed: 1, seed: 4, drone });
    expect(log.hurts.filter((h) => h.area.h === 60)).toHaveLength(0);
  });
});

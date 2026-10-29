// Phase 8 attack tests, part D (Phase 8 Spec, section 5): flare, phase and zap on a fake context, Standard and Story. The
// attacks are imported directly; table.ts registers them with the rest of the wing bosses.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../level/room';
import { frames } from '../tuning';
import type { Pt, Timed } from './attacks';
import { flare, GHOST_LABELS, phase, zap } from './attacks-wings-d';
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
/** A drone as big as the arena: every flare beam and every arc meets it. */
const TALL: Rect = { x: 0, y: 0, w: 1920, h: 900 };

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

/** A canvas stand-in that records every string drawn with fillText, into `out`. */
function textContext(out: string[]): CanvasRenderingContext2D {
  const store: Record<PropertyKey, unknown> = {};
  const handler: ProxyHandler<Record<PropertyKey, unknown>> = {
    get: (t, k) => {
      if (k === 'fillText') return (s: string) => { out.push(s); };
      if (k in t) return t[k];
      return () => undefined;
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  };
  return new Proxy(store, handler) as unknown as CanvasRenderingContext2D;
}

const WING_D: Attack<unknown>[] = [flare, phase, zap];
const SPEEDS = [1, 1.4];
const teleOf = (r: unknown) => (r as Timed).tele;

describe('every wing attack, part D', () => {
  for (const a of WING_D) {
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

  for (const a of WING_D) {
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

describe('flare', () => {
  it('has eight channel lines at even heights, labelled 1 to 8', () => {
    const { run } = play(flare, { story: false, speed: 1, seed: 1 });
    expect(run.lines).toHaveLength(8);
    expect(run.lines.map((l) => l.label)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const gaps = run.lines.slice(1).map((l, k) => l.y - run.lines[k].y);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
    expect(run.lines[0].y).toBe(120);
    expect(run.lines[7].y).toBe(780);
  });

  it('brightens four channels and darkens four in each round, with new picks each round', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sets: boolean[][] = [];
      play(flare, { story: false, speed: 1, seed }, (_i, r) => {
        if (sets.length === r.round) sets.push(r.lines.map((l) => l.bright));
      });
      expect(sets).toHaveLength(2);
      for (const s of sets) expect(s.filter(Boolean)).toHaveLength(4);
      expect(sets[1]).not.toEqual(sets[0]);
    }
  });

  it('brightens for 0.8 s, then flares 10 px tall full-width beams for 0.4 s, two rounds', () => {
    const plain = play(flare, { story: false, speed: 1, seed: 1 });
    expect(plain.run.tele).toBe(48);
    // per round: 48 telegraph steps, the first flare step, then 24 more while the beams run (the last one switches round)
    expect(plain.steps).toBe(2 * (48 + 1 + frames(400)));
    expect(play(flare, { story: true, speed: 1, seed: 1 }).run.tele).toBe(72);
  });

  it('hurts the drone 12 once for each bright channel in each round, and never through a dark one', () => {
    const { log } = play(flare, { story: false, speed: 1, seed: 1, drone: TALL });
    expect(log.hurts).toHaveLength(8);
    for (const h of log.hurts) {
      expect(h.n).toBe(12);
      expect(h.area.h).toBe(10);
      expect(h.area.w).toBe(1920);
      expect(h.at).toBeGreaterThanOrEqual(48);
    }
  });

  it('does no damage while the channels brighten', () => {
    const { log } = play(flare, { story: false, speed: 1, seed: 4, drone: TALL });
    expect(log.hurts.every((h) => h.at >= 48)).toBe(true);
    expect(log.hazards).toHaveLength(0);
  });
});

describe('phase', () => {
  it('shows two ghosts in the left and right thirds of the arena, labelled |0⟩ and |1⟩', () => {
    const { run } = play(phase, { story: false, speed: 1, seed: 1 });
    expect(GHOST_LABELS).toEqual(['|0⟩', '|1⟩']);
    expect(run.spots).toHaveLength(2);
    expect(run.spots[0].x).toBe(320);
    expect(run.spots[1].x).toBe(1600);
  });

  it('fires three fans of nine bolts at 380 px/s, 9 each, from the ghost that was picked', () => {
    const { run, log } = play(phase, { story: false, speed: 1, seed: 2 });
    expect(run.picked).toHaveLength(3);
    expect(log.shots).toHaveLength(27);
    for (let k = 0; k < 3; k++) {
      const fan = log.shots.slice(k * 9, k * 9 + 9);
      for (const s of fan) {
        expect(s.damage).toBe(9);
        expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(380, 6);
        expect(s.x).toBe(run.spots[run.picked[k]].x);
      }
    }
  });

  it('aims the middle bolt of each fan at the drone', () => {
    const { log } = play(phase, { story: false, speed: 1, seed: 3 });
    const d = { x: DRONE.x + DRONE.w / 2, y: DRONE.y + DRONE.h / 2 };
    const s = log.shots[4];
    const len = Math.hypot(d.x - s.x, d.y - s.y);
    expect(s.vx).toBeCloseTo((380 * (d.x - s.x)) / len, 6);
    expect(s.vy).toBeCloseTo((380 * (d.y - s.y)) / len, 6);
  });

  it('waits for the 0.8 s telegraph before the first fan (1.2 s on Story)', () => {
    const { run, log } = play(phase, { story: false, speed: 1, seed: 1 });
    expect(run.tele).toBe(48);
    expect(log.shots[0].at).toBe(48);
    expect(play(phase, { story: true, speed: 1, seed: 1 }).log.shots[0].at).toBe(72);
  });

  it('picks either ghost at random: both fire across 20 seeds', () => {
    const picks = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const p of play(phase, { story: false, speed: 1, seed }).run.picked) picks.add(p);
    }
    expect([...picks].sort()).toEqual([0, 1]);
  });

  it('flashes "!" on the firing ghost for the last 0.3 s of each telegraph only', () => {
    const shown: string[] = [];
    const g = textContext(shown);
    const bangs: number[] = [];
    play(phase, { story: false, speed: 1, seed: 1 }, (i, run) => {
      shown.length = 0;
      phase.draw(g, run, i);
      if (shown.includes('!')) {
        bangs.push(i);
        expect(run.age).toBeGreaterThan(run.tele - frames(300));
        expect(run.age).toBeLessThanOrEqual(run.tele);
      }
    });
    expect(bangs).toHaveLength(3 * frames(300));
  });
});

describe('zap', () => {
  it('lands four charge nodes on floor tops within 500 px of the drone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run } = play(zap, { story: false, speed: 1, seed });
      const d = { x: DRONE.x + DRONE.w / 2, y: DRONE.y + DRONE.h / 2 };
      expect(run.nodes).toHaveLength(4);
      for (const p of run.nodes) {
        expect(Math.hypot(p.x - d.x, p.y - d.y)).toBeLessThanOrEqual(500);
        const onFloor = FLOORS.some((f) => p.x >= f.x && p.x <= f.x + f.w && Math.abs(p.y - (f.y - 16)) < 1e-9);
        expect(onFloor).toBe(true);
      }
    }
  });

  it('telegraphs 0.6 s (0.9 s on Story), then arcs 1 to 2, 2 to 3 and 3 to 4, 0.5 s apart', () => {
    expect(play(zap, { story: false, speed: 1, seed: 1 }).run.tele).toBe(36);
    expect(play(zap, { story: true, speed: 1, seed: 1 }).run.tele).toBe(54);
    const starts: [number, number][] = [];
    play(zap, { story: false, speed: 1, seed: 1 }, (i, r) => {
      if (r.round === 0 && r.arc >= 0 && (starts.length === 0 || starts[starts.length - 1][1] !== r.arc)) {
        starts.push([i, r.arc]);
      }
    });
    expect(starts).toEqual([[36, 0], [66, 1], [96, 2]]);
  });

  it('hurts 15 once per arc with 8 px hurt squares along the line, six arcs in two rounds', () => {
    const { log } = play(zap, { story: false, speed: 1, seed: 1, drone: TALL });
    expect(log.hurts).toHaveLength(6);
    for (const h of log.hurts) {
      expect(h.n).toBe(15);
      expect(h.area.w).toBe(8);
      expect(h.area.h).toBe(8);
    }
  });

  it('gives two rounds with new nodes each round', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sets: Pt[][] = [];
      play(zap, { story: false, speed: 1, seed }, (_i, r) => {
        if (sets.length === r.round) sets.push(r.nodes.map((p) => ({ x: p.x, y: p.y })));
      });
      expect(sets).toHaveLength(2);
      expect(sets[1]).not.toEqual(sets[0]);
    }
  });
});

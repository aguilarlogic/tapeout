// Leg feel tests: walking left is an exact mirror of walking right, backpedalling keeps the knees toward the facing
// side with planted feet that never slide, and turning round mid-walk eases instead of snapping or crossing the legs.
import { describe, expect, it } from 'vitest';
import type { Action } from '../input/bindings';
import type { Room } from '../level/room';
import { Sim } from '../sim';
import { TUNING } from '../tuning';
import { DroneRig } from './drone';
import { Fx } from './fx';

const FLOOR = 1000, W = 6000;
/** A flat empty room, symmetric about x = 3000. */
function flat(spawnX: number): Room {
  return {
    name: 'flat', w: W, h: 2000, spawn: { x: spawnX, y: FLOOR - 24 },
    solids: [{ x: 0, y: FLOOR, w: W, h: 80 }, { x: -40, y: -2000, w: 40, h: 4000 }, { x: W, y: -2000, w: 40, h: 4000 }],
    oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], traces: [], signs: [],
  };
}

type Leg = { hipX: number; hipY: number; knee: { x: number; y: number; fx: number; fy: number } };
interface Frame { legs: Leg[]; feet: { x: number; planted: boolean }[]; kneeFace: number; face: number; cx: number }

/** Run a sim with its rig, holding `hold(i)` and aiming at `aim(sim, i)`; returns the rig's pose every step. */
function walk(spawnX: number, steps: number, hold: (i: number) => Action[], aim: (s: Sim, i: number) => { x: number; y: number }): Frame[] {
  const sim = new Sim(flat(spawnX)), rig = new DroneRig(() => 0.5), fx = new Fx();
  const out: Frame[] = [];
  let prev = new Set<Action>();
  for (let i = 0; i < steps; i++) {
    const held = new Set(hold(i));
    sim.step({ held, pressed: new Set([...held].filter((a) => !prev.has(a))) }, aim(sim, i));
    prev = held;
    rig.step(sim, fx, sim.world.statics);
    const d = sim.drone, cx = d.x, cy = d.y - d.h / 2 + 13;
    out.push({ legs: rig.pose(cx, cy), feet: rig.feet.map((f) => ({ x: f.x, planted: f.planted })), kneeFace: rig.kneeFace, face: d.facing, cx });
  }
  return out;
}

/** Which side of the hip-to-foot line the knee sits on, signed so +1 is "toward x+". */
const kneeSide = (l: Leg) => Math.sign((l.knee.fx - l.hipX) * (l.knee.y - l.hipY) - (l.knee.fy - l.hipY) * (l.knee.x - l.hipX)) * -1;

describe('drone legs', () => {
  it('walking left while aiming left is an exact mirror of walking right while aiming right', () => {
    const right = walk(400, 120, (i) => (i > 20 ? ['right'] : []), (s) => ({ x: s.drone.x + 500, y: s.drone.y }));
    const left = walk(W - 400, 120, (i) => (i > 20 ? ['left'] : []), (s) => ({ x: s.drone.x - 500, y: s.drone.y }));
    for (let i = 0; i < right.length; i++) {
      expect(left[i].cx).toBeCloseTo(W - right[i].cx, 1);
      right[i].legs.forEach((r, j) => {
        const l = left[i].legs[j];
        expect(l.hipX).toBeCloseTo(W - r.hipX, 1);
        expect(l.knee.x).toBeCloseTo(W - r.knee.x, 1);
        expect(l.knee.y).toBeCloseTo(r.knee.y, 1);
        expect(l.knee.fx).toBeCloseTo(W - r.knee.fx, 1);
        expect(l.knee.fy).toBeCloseTo(r.knee.fy, 1);
      });
    }
    // and the knees point forward: toward x+ walking right, toward x- walking left
    expect(right.slice(40).every((f) => f.legs.every((l) => kneeSide(l) >= 0))).toBe(true);
    expect(left.slice(40).every((f) => f.legs.every((l) => kneeSide(l) <= 0))).toBe(true);
  });

  for (const face of [1, -1]) {
    it(`backpedalling (${face > 0 ? 'aiming right, walking left' : 'aiming left, walking right'}) keeps the knees toward the aim and planted feet still`, () => {
      const frames = walk(3000, 160, (i) => (i > 20 ? [face > 0 ? 'left' : 'right'] : []), (s) => ({ x: s.drone.x + 500 * face, y: s.drone.y }));
      const moving = frames.slice(40);
      expect(Math.abs(moving[moving.length - 1].cx - moving[0].cx)).toBeGreaterThan(200); // it really walked
      expect(moving.every((f) => f.legs.every((l) => kneeSide(l) * face >= 0))).toBe(true);
      // a foot that stays planted from one step to the next does not move
      let plantedPairs = 0;
      for (let i = 1; i < moving.length; i++) {
        moving[i].feet.forEach((f, j) => {
          const p = moving[i - 1].feet[j];
          if (p.planted && f.planted) { plantedPairs++; expect(f.x).toBe(p.x); }
        });
      }
      expect(plantedPairs).toBeGreaterThan(60);
    });
  }

  it('turning round mid-walk eases the knees over about 120 ms and never crosses the legs', () => {
    const turnAt = 70;
    const frames = walk(3000, 140, (i) => (i > 20 ? ['right'] : []), (s, i) => ({ x: s.drone.x + (i < turnAt ? 500 : -500), y: s.drone.y }));
    // the knee direction eases: no single step moves it more than about a third of the swing (2), and it settles within 8 steps (133 ms)
    for (let i = 1; i < frames.length; i++) expect(Math.abs(frames[i].kneeFace - frames[i - 1].kneeFace)).toBeLessThan(0.7);
    expect(frames[turnAt + 8].kneeFace).toBeLessThan(-0.95);
    // every foot stays within reach of its own hip, before, during and after the turn
    const reach = TUNING.anim.leg * 2 + 1;
    for (const f of frames) {
      f.legs.forEach((l, j) => expect(Math.hypot(f.feet[j].x - l.hipX, l.knee.fy - l.hipY)).toBeLessThan(reach + TUNING.anim.stride));
    }
    // no foot teleports across the turn
    for (let i = turnAt - 2; i < turnAt + 4; i++) {
      frames[i].feet.forEach((f, j) => {
        const p = frames[i - 1].feet.find((q) => Math.abs(q.x - f.x) < TUNING.anim.stride + 1);
        expect(p, `step ${i} foot ${j}`).toBeTruthy();
      });
    }
  });

  it('idle, landing and the dash mirror exactly too', () => {
    const script = (dir: 'left' | 'right') => (i: number): Action[] => (i === 30 ? ['jump'] : i === 100 ? ['dash'] : i > 100 && i < 110 ? [dir] : []);
    const right = walk(1000, 160, script('right'), (s) => ({ x: s.drone.x + 500, y: s.drone.y }));
    const left = walk(W - 1000, 160, script('left'), (s) => ({ x: s.drone.x - 500, y: s.drone.y }));
    for (let i = 0; i < right.length; i++) {
      right[i].legs.forEach((r, j) => {
        const l = left[i].legs[j];
        expect(l.knee.x).toBeCloseTo(W - r.knee.x, 1);
        expect(l.knee.fy).toBeCloseTo(r.knee.fy, 1);
      });
    }
  });
});

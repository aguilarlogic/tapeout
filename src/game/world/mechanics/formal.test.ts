// Discovery beat 'formal' (Phase 7 Spec, section 4), headless: the room is valid, with ASSUME on the three lamps read
// PROVED and the door stays shut, dropping ASSUME shows a CEX block that six hits take down (and only then the door
// opens), a shot before the CEX is up does nothing, ASSUME cannot be turned back on with the drone inside the corridor,
// and idling never solves. The drone, the wall, the door and the shots are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY, gapFor, REACH } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { FORMAL, type FormalState } from './formal';

const FLOOR = floorY(720);
const rng = () => 0.5;
const SWEEP_STEPS = 90;
const CEX_HITS = 6;
const SOLVE_SAY = 'say:A tight assumption hides bugs. Dropping it found this one.';
const FOUND_SAY = 'say:Counterexample: a real input breaks the rule. Shoot the CEX block.';
const REFUSE_SAY = 'say:Step out of the corridor before you turn ASSUME on.';

/** The fake sim: the drone, the gates it opens and closes, and a log of every call it made. */
interface Rig {
  c: MechCtx;
  /** Calls in order: open:id, close:id, sfx:name, say:line, hurt:n, warp, solve. */
  log: string[];
}

function rig(room: StoryRoom): Rig {
  const gates = new Map<string, Rect>(room.gates.map((g): [string, Rect] => [g.id, { ...g.rect }]));
  const log: string[] = [];
  const c: MechCtx = {
    t: 0,
    story: false,
    drone: { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 },
    grounded: true,
    props: [],
    used: null,
    hit: [],
    rect: (id) => {
      const g = gates.get(id);
      if (!g) throw new Error(`no gate ${id}`);
      return g;
    },
    move: () => { log.push('move'); },
    open: (id) => { log.push(`open:${id}`); },
    close: (id) => { log.push(`close:${id}`); },
    sfx: (n) => { log.push(`sfx:${n}`); },
    say: (line) => { log.push(`say:${line}`); },
    warp(x, y) { c.drone = { ...c.drone, x: x - c.drone.w / 2, y: y - c.drone.h / 2 }; log.push('warp'); },
    hurt: (n) => { log.push(`hurt:${n}`); },
    solve: () => { log.push('solve'); },
  };
  return { c, log };
}

const solves = (rg: Rig) => rg.log.filter((l) => l === 'solve').length;
const count = (rg: Rig, entry: string) => rg.log.filter((l) => l === entry).length;

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after each. */
function tick(def: MechanicDef<FormalState>, s: FormalState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** One shot on the CEX block per step, for n steps. */
function shoot(def: MechanicDef<FormalState>, s: FormalState, rg: Rig, n: number) {
  for (let i = 0; i < n; i++) {
    rg.c.hit = ['cex'];
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.hit = [];
  }
}

/** Puts the drone with its centre at x and its feet on the floor. */
function feet(rg: Rig, x: number) {
  rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
  rg.c.grounded = true;
}

/** Walks the drone from x 140 to x 1460, 10 px a step. */
function walkToDoor(rg: Rig, s: FormalState) {
  for (let x = 140; x <= 1460; x += 10) {
    feet(rg, x);
    tick(FORMAL, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('formal', () => {
  it('builds a valid discovery room: the ASSUME lever on the floor, the wall at the third corridor, the CEX block inside it, the door at the right', () => {
    const room = FORMAL.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('formal');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id)).toEqual(['exit', 'wall']);
    expect(room.stations.map((st) => [st.id, st.kind, st.label])).toEqual([['assume', 'lever', 'ASSUME']]);
    const door = room.gates[0].rect;
    expect([door.x, door.w, door.h]).toEqual([room.w - 200, 48, 200]);
    expect(door.y + door.h).toBe(FLOOR);
    const wall = room.gates[1].rect;
    expect(wall.y).toBeGreaterThanOrEqual(460);
    expect(wall.y + wall.h).toBeLessThanOrEqual(540);
    const cex = room.targets?.find((t) => t.id === 'cex');
    expect(cex).toBeDefined();
    // the CEX block sits inside the third corridor, past its wall
    expect(cex!.rect.x).toBeGreaterThan(wall.x + wall.w);
    expect(cex!.rect.y).toBeGreaterThanOrEqual(460);
    expect(cex!.rect.y + cex!.rect.h).toBeLessThanOrEqual(540);
  });

  it('the route is passable with a beginner jump: the hub ledge is 140 px up with no gap, and the floor runs on to the door', () => {
    const room = FORMAL.room(rng);
    const ledge = room.solids.find((q) => q.y === 500 && q.h === 140);
    expect(ledge).toBeDefined();
    const rise = FLOOR - 500;
    expect(rise).toBeLessThanOrEqual(REACH.rise);
    expect(gapFor(rise)).toBeGreaterThanOrEqual(0);
  });

  it('with ASSUME on, the prover sweeps all three corridors and reads PROVED on each, and the door stays shut', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    tick(FORMAL, s, rg, SWEEP_STEPS * 3);
    expect(s.proved).toEqual([true, true, true]);
    expect(s.cexUp).toBe(false);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(count(rg, 'open:wall')).toBe(0);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
  });

  it('a shot before the CEX block is up does nothing, even with the wall standing', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    shoot(FORMAL, s, rg, CEX_HITS + 2);
    expect(s.cexHits).toBe(0);
    expect(s.open).toBe(false);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('dropping ASSUME opens the wall, the sweep finds the CEX block, six hits open the door, and the beat solves past it', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    rg.c.used = 'assume';
    tick(FORMAL, s, rg);
    expect(s.assume).toBe(false);
    expect(count(rg, 'open:wall')).toBe(1);
    // corridors 1 and 2 are swept, then corridor 3, which now finds the counterexample
    tick(FORMAL, s, rg, SWEEP_STEPS * 3);
    expect(s.cexUp).toBe(true);
    expect(rg.log.filter((l) => l === FOUND_SAY)).toHaveLength(1);
    expect(count(rg, 'open:exit')).toBe(0);
    shoot(FORMAL, s, rg, CEX_HITS - 1);
    expect(s.cexHits).toBe(CEX_HITS - 1);
    expect(count(rg, 'open:exit')).toBe(0);
    shoot(FORMAL, s, rg, 1);
    expect(s.cexHits).toBe(CEX_HITS);
    expect(count(rg, 'open:exit')).toBe(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
    expect(rg.log.filter((l) => l === SOLVE_SAY)).toHaveLength(1);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(1);
  });

  it('a corridor 3 sweep with ASSUME dropped shows the CEX block, and never PROVED for it after the drop', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    tick(FORMAL, s, rg, SWEEP_STEPS * 3);
    expect(s.proved[2]).toBe(true);
    rg.c.used = 'assume';
    tick(FORMAL, s, rg);
    expect(s.proved[2]).toBe(false);
    tick(FORMAL, s, rg, SWEEP_STEPS * 3);
    expect(s.cexUp).toBe(true);
    expect(s.proved[2]).toBe(false);
  });

  it('ASSUME cannot be turned back on with the drone inside the third corridor: it refuses, and the wall stays open', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    rg.c.used = 'assume';
    tick(FORMAL, s, rg);
    rg.c.drone = { x: 800 - 18, y: 500 - 24, w: 36, h: 48 };
    rg.c.used = 'assume';
    tick(FORMAL, s, rg);
    expect(s.assume).toBe(false);
    expect(count(rg, 'close:wall')).toBe(0);
    expect(rg.log.filter((l) => l === REFUSE_SAY)).toHaveLength(1);
    // out on the floor, the wall closes again
    feet(rg, 800);
    rg.c.used = 'assume';
    tick(FORMAL, s, rg);
    expect(s.assume).toBe(true);
    expect(count(rg, 'close:wall')).toBe(1);
  });

  it('with ASSUME on forever, nothing solves: the lamps read PROVED and the door stays shut, however long the drone walks', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    tick(FORMAL, s, rg, 3600);
    walkToDoor(rg, s);
    walkToDoor(rg, s);
    expect(solves(rg)).toBe(0);
    expect(count(rg, 'open:exit')).toBe(0);
  });

  it('draws every state, wall up or dropped, CEX hidden, up and shot down, without throwing', () => {
    const rg = rig(FORMAL.room(rng)), s = FORMAL.init();
    for (let i = 0; i < 20; i++) {
      expect(() => FORMAL.draw(canvas, s, i)).not.toThrow();
      tick(FORMAL, s, rg, 1);
    }
    rg.c.used = 'assume';
    tick(FORMAL, s, rg);
    tick(FORMAL, s, rg, SWEEP_STEPS * 3);
    expect(() => FORMAL.draw(canvas, s, 0)).not.toThrow();
    shoot(FORMAL, s, rg, 3);
    expect(() => FORMAL.draw(canvas, s, 0)).not.toThrow();
    shoot(FORMAL, s, rg, CEX_HITS);
    expect(() => FORMAL.draw(canvas, s, 0)).not.toThrow();
    expect(FORMAL.nudge.length).toBeGreaterThan(0);
  });
});

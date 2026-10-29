// Discovery beat 10, The Pipeline (Phase 4 Spec, section 4), headless: the room is valid, pressing STALL EX at
// the amber tick solves once, never pressing it jams and restarts, a stall at a wrong tick still lets a later
// correct stall solve, and the draw code runs. The drone and the gates are a fake MechCtx, not the real sim.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY, r } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { HAZARD_TICK, STAGES, type StagesState, TICK_STEPS } from './stages';

const FLOOR = floorY(720);
const rng = () => 0.5;

/** The fake sim: a drone rect, gates that the mechanic moves, and a log of every call it made. */
interface Rig {
  c: MechCtx;
  /** Calls in order: open:id, close:id, sfx:name, say:line, solve. */
  log: string[];
  gate: (id: string) => Rect;
}

function rig(room: StoryRoom): Rig {
  const rects = new Map<string, Rect>(room.gates.map((g): [string, Rect] => [g.id, { ...g.rect }]));
  const gate = (id: string): Rect => {
    const g = rects.get(id);
    if (!g) throw new Error(`no gate ${id}`);
    return g;
  };
  const log: string[] = [];
  const c: MechCtx = {
    t: 0,
    story: false,
    drone: { x: room.spawn.x - 18, y: room.spawn.y - 24, w: 36, h: 48 },
    grounded: true,
    props: [],
    used: null,
    hit: [],
    rect: gate,
    move(id, x, y) {
      const old = gate(id), d = c.drone;
      // a grounded drone standing on the gate rides along
      if (c.grounded && Math.abs(d.y + d.h - old.y) <= 2 && d.x + d.w > old.x && d.x < old.x + old.w) d.y += y - old.y;
      rects.set(id, { ...old, x, y });
    },
    open: (id) => { log.push(`open:${id}`); },
    close: (id) => { log.push(`close:${id}`); },
    sfx: (n) => { log.push(`sfx:${n}`); },
    say: (line) => { log.push(`say:${line}`); },
    warp(x, y) { c.drone = { ...c.drone, x: x - c.drone.w / 2, y: y - c.drone.h / 2 }; log.push('warp'); },
    hurt: (n) => { log.push(`hurt:${n}`); },
    solve: () => { log.push('solve'); },
  };
  return { c, log, gate };
}

const solves = (rg: Rig) => rg.log.filter((l) => l === 'solve').length;
const says = (rg: Rig) => rg.log.filter((l) => l.startsWith('say:')).length;

/** Runs n 60 Hz steps; the one-shot inputs (used, hit) clear after each. */
function tick<S>(def: MechanicDef<S>, s: S, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

/** Runs the belt until its lamp turns amber, then presses STALL EX once on that tick. Returns that tick's index. */
function stallOnAmber(rg: Rig, s: StagesState): number {
  for (let i = 0; i < 400; i++) {
    if (s.amber) {
      const k = s.k;
      rg.c.used = 'stall';
      tick(STAGES, s, rg);
      return k;
    }
    tick(STAGES, s, rg);
  }
  throw new Error('the lamp never turned amber');
}

describe('stages', () => {
  it('builds a valid discovery room: exit door at the right, STALL EX on the floor under stage 3', () => {
    const room = STAGES.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('stages');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.find((g) => g.id === 'exit')?.rect).toEqual(r(room.w - 200, FLOOR - 200, 48, 200));
    expect(room.stations).toEqual([
      expect.objectContaining({ id: 'stall', kind: 'lever', y: 720 - 80, label: 'STALL EX', x: 810 }),
    ]);
  });

  it('the amber lamp lights on the hazard tick, and pressing stall there solves once', () => {
    const rg = rig(STAGES.room(rng)), s = STAGES.init();
    // the first amber tick is the slow crate's first EX tick, with crate 3 in ID
    expect(stallOnAmber(rg, s)).toBe(HAZARD_TICK);
    expect(HAZARD_TICK).toBe(3);
    expect(TICK_STEPS).toBe(48);
    tick(STAGES, s, rg, 1800);
    expect(solves(rg)).toBe(1);
    expect(s.jams).toBe(0);
    expect(s.landed).toBe(3);
    tick(STAGES, s, rg, 600);
    expect(solves(rg)).toBe(1);
  });

  it('without a stall, crate 3 steps into EX on the hazard tick and the two jam', () => {
    const rg = rig(STAGES.room(rng)), s = STAGES.init();
    tick(STAGES, s, rg, (HAZARD_TICK + 1) * TICK_STEPS - 1);
    expect(s.jams).toBe(0);
    tick(STAGES, s, rg);
    expect(s.jams).toBe(1);
    expect(s.crates.filter((c) => c.hit).map((c) => c.id).sort()).toEqual([2, 3]);
  });

  it('never pressing stall jams: no solve within 30 s, the belt restarts, and the restart is said once', () => {
    const rg = rig(STAGES.room(rng)), s = STAGES.init();
    tick(STAGES, s, rg, 1800);
    expect(solves(rg)).toBe(0);
    expect(s.jams).toBeGreaterThanOrEqual(2);
    expect(says(rg)).toBe(1);
    expect(rg.log).not.toContain('sfx:lever');
  });

  it('a stall at a wrong tick wastes a tick without a jam, and a later stall at the amber tick still solves', () => {
    const rg = rig(STAGES.room(rng)), s = STAGES.init();
    rg.c.used = 'stall'; // on tick 0: crate 1 is held in IF for a tick, nothing jams
    tick(STAGES, s, rg);
    expect(s.jams).toBe(0);
    // the whole script is one tick late, so the hazard comes one tick later too
    expect(stallOnAmber(rg, s)).toBe(HAZARD_TICK + 1);
    tick(STAGES, s, rg, 1800);
    expect(solves(rg)).toBe(1);
    expect(s.jams).toBe(0);
  });

  it('draws every state with a Proxy canvas, through a jam and a restart', () => {
    const rg = rig(STAGES.room(rng)), s = STAGES.init();
    for (let i = 0; i < 400; i++) {
      expect(() => STAGES.draw(canvas, s, i)).not.toThrow();
      tick(STAGES, s, rg);
    }
    tick(STAGES, s, rg, 600); // a jam and the start of its restart
    expect(() => STAGES.draw(canvas, s, 0)).not.toThrow();
    expect(STAGES.nudge.length).toBeGreaterThan(0);
  });
});

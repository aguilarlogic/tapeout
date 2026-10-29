// Discovery beat 'agents' (Phase 7 Spec, section 4), headless: the room is valid, blocks 1, 2 and 3 pushed in order
// solve it once with the door opening at 3 of 3, a block out of order resets the count and holds the belt for 2 s,
// a block that is still on the plate after its push is not pushed twice, and idling never solves. The drone, the
// blocks and the gates are a fake MechCtx, not the real sim. A block is carried by taking it out of the props for a step.
import { describe, expect, it } from 'vitest';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY, gapFor, REACH } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';
import { AGENTS, type AgentsState, BLOCK_SIDE, DRIVER, HALF, NUMBERS, PLATE, SHELF_Y } from './agents';

const FLOOR = floorY(720);
const rng = () => 0.5;
const PLATE_CX = PLATE.x + PLATE.w / 2;
const DRIVER_CX = DRIVER.x + DRIVER.w / 2;
const SOLVE_SAY = 'say:The driver drives, the monitor watches, the scoreboard compares.';
const WRONG_SAY = 'say:Out of order. The scoreboard resets, and the belt holds for 2 s.';

/** The fake sim: the drone, the blocks (held ones are not props), gates, and a log of every call it made. */
interface Rig {
  c: MechCtx;
  /** Calls in order: open:id, close:id, sfx:name, say:line, hurt:n, warp, solve. */
  log: string[];
  blocks: Rect[];
  held: boolean[];
}

const blockRect = (x: number, y: number): Rect => ({ x: x - HALF, y: y - HALF, w: BLOCK_SIDE, h: BLOCK_SIDE });

function rig(room: StoryRoom): Rig {
  const gates = new Map<string, Rect>(room.gates.map((g): [string, Rect] => [g.id, { ...g.rect }]));
  const log: string[] = [];
  const blocks = room.props.map((p) => blockRect(p.x, p.y));
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
  return { c, log, blocks, held: blocks.map(() => false) };
}

const solves = (rg: Rig) => rg.log.filter((l) => l === 'solve').length;
const count = (rg: Rig, entry: string) => rg.log.filter((l) => l === entry).length;

/** Runs n 60 Hz steps with the loose blocks as the props; the one-shot inputs (used, hit) clear after each. */
function tick(def: MechanicDef<AgentsState>, s: AgentsState, rg: Rig, n = 1) {
  for (let i = 0; i < n; i++) {
    rg.c.props = rg.blocks.filter((_, k) => !rg.held[k]);
    def.step(s, rg.c);
    rg.c.t += 1;
    rg.c.used = null;
    rg.c.hit = [];
  }
}

/** Puts the drone with its centre at x and its feet on the floor. */
function feet(rg: Rig, x: number) {
  rg.c.drone = { x: x - 18, y: FLOOR - 48, w: 36, h: 48 };
  rg.c.grounded = true;
}

/** Carries block i to a new centre: held for a step while the drone moves it, then dropped there. */
function carryTo(rg: Rig, def: MechanicDef<AgentsState>, s: AgentsState, i: number, x: number, y: number) {
  rg.held[i] = true;
  tick(def, s, rg);
  rg.blocks[i] = blockRect(x, y);
  rg.held[i] = false;
  tick(def, s, rg);
}

/** Pushes block n: carries it onto the plate, steps off the DRIVER pad and onto it, then waits for the belt to read it. */
function send(rg: Rig, def: MechanicDef<AgentsState>, s: AgentsState, n: number) {
  const i = NUMBERS.indexOf(n);
  carryTo(rg, def, s, i, PLATE_CX, FLOOR - HALF - 1);
  feet(rg, DRIVER_CX - 60);
  tick(def, s, rg);
  feet(rg, DRIVER_CX);
  tick(def, s, rg);
  tick(def, s, rg, 150);
}

/** Walks the drone from x 770 to x 1460, 10 px a step. */
function walkToDoor(rg: Rig, def: MechanicDef<AgentsState>, s: AgentsState) {
  for (let x = DRIVER_CX; x <= 1460; x += 10) {
    feet(rg, x);
    tick(def, s, rg);
  }
}

// A canvas that accepts every call: the draw code runs, its pixels are not checked.
const canvas = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

describe('agents', () => {
  it('builds a valid discovery room: three numbered blocks on a shelf, the plate and the driver pad, the exit door at the right', () => {
    const room = AGENTS.room(rng);
    expect(room.role).toBe('discovery');
    expect(room.mechanic).toBe('agents');
    expect(room.modules).toEqual([]);
    expect(room.exit.x).toBe(room.w - 40);
    expect(room.gates.map((g) => g.id)).toEqual(['exit']);
    expect(room.stations).toEqual([]);
    expect(room.props).toHaveLength(3);
    expect(room.props.every((p) => p.kind === 'crate' && p.y === SHELF_Y - HALF - 1)).toBe(true);
    // the shelf runs left to right as blocks 3, 1, 2
    const order = room.props.map((_, i) => i).sort((a, b) => room.props[a].x - room.props[b].x);
    expect(order.map((i) => NUMBERS[i])).toEqual([3, 1, 2]);
    expect(room.gates[0].rect).toEqual({ x: room.w - 200, y: FLOOR - 200, w: 48, h: 200 });
    expect(room.gates[0].rect.y + room.gates[0].rect.h).toBe(FLOOR);
  });

  it('the shelf is a step the drone can jump: its top is one beginner jump above the floor, with no gap', () => {
    const rise = FLOOR - SHELF_Y;
    expect(rise).toBeLessThanOrEqual(REACH.rise);
    expect(gapFor(rise)).toBeGreaterThanOrEqual(0);
  });

  it('pushing 1, then 2, then 3 reads 3 of 3 in order, opens the door once, and solves past it', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    send(rg, AGENTS, s, 1);
    expect(s.ok).toBe(1);
    send(rg, AGENTS, s, 2);
    expect(s.ok).toBe(2);
    expect(count(rg, 'open:exit')).toBe(0);
    send(rg, AGENTS, s, 3);
    expect(s.ok).toBe(3);
    expect(count(rg, 'open:exit')).toBe(1);
    expect(s.wrong).toBeNull();
    expect(solves(rg)).toBe(0);
    walkToDoor(rg, AGENTS, s);
    expect(solves(rg)).toBe(1);
    expect(rg.log.filter((l) => l === SOLVE_SAY)).toHaveLength(1);
    walkToDoor(rg, AGENTS, s);
    expect(solves(rg)).toBe(1);
  });

  it('a block out of order (1, then 3) reads "expected 2, got 3", resets to 0 of 3, and holds the belt for 2 s', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    send(rg, AGENTS, s, 1);
    send(rg, AGENTS, s, 3);
    expect(s.wrong).toEqual({ expect: 2, got: 3 });
    expect(s.ok).toBe(0);
    expect(count(rg, WRONG_SAY)).toBe(1);
    expect(count(rg, 'open:exit')).toBe(0);
    // the hold is 2 s: it is still on, then it clears
    expect(s.hold).toBeGreaterThan(0);
    tick(AGENTS, s, rg, 130);
    expect(s.hold).toBe(0);
    expect(s.wrong).toBeNull();
    expect(s.tokens).toEqual([]);
    walkToDoor(rg, AGENTS, s);
    expect(solves(rg)).toBe(0);
  });

  it('a block 2 pushed first is out of order: expected 1, got 2, and the door stays shut', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    send(rg, AGENTS, s, 2);
    expect(s.wrong).toEqual({ expect: 1, got: 2 });
    expect(s.ok).toBe(0);
    walkToDoor(rg, AGENTS, s);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(solves(rg)).toBe(0);
  });

  it('a block that is still on the plate after its push is not pushed again', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    send(rg, AGENTS, s, 1);
    const pushes = count(rg, 'sfx:plate');
    feet(rg, DRIVER_CX - 60);
    tick(AGENTS, s, rg);
    feet(rg, DRIVER_CX);
    tick(AGENTS, s, rg, 150);
    expect(count(rg, 'sfx:plate')).toBe(pushes);
    expect(s.ok).toBe(1);
  });

  it('stepping on DRIVER with no block on the plate pushes nothing and says so once', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    feet(rg, DRIVER_CX - 60);
    tick(AGENTS, s, rg);
    feet(rg, DRIVER_CX);
    tick(AGENTS, s, rg);
    feet(rg, DRIVER_CX - 60);
    tick(AGENTS, s, rg);
    feet(rg, DRIVER_CX);
    tick(AGENTS, s, rg);
    expect(count(rg, 'sfx:plate')).toBe(0);
    expect(rg.log.filter((l) => l.startsWith('say:Put a block on the plate'))).toHaveLength(1);
    expect(solves(rg)).toBe(0);
  });

  it('idle on the shelf with blocks never solves', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    tick(AGENTS, s, rg, 3600);
    walkToDoor(rg, AGENTS, s);
    expect(count(rg, 'open:exit')).toBe(0);
    expect(solves(rg)).toBe(0);
  });

  it('draws every state, idle, belt running, and a wrong read on hold, without throwing', () => {
    const room = AGENTS.room(rng), rg = rig(room), s = AGENTS.init();
    for (let i = 0; i < 20; i++) {
      expect(() => AGENTS.draw(canvas, s, i)).not.toThrow();
      tick(AGENTS, s, rg, 1);
    }
    send(rg, AGENTS, s, 1);
    expect(() => AGENTS.draw(canvas, s, 0)).not.toThrow();
    send(rg, AGENTS, s, 3);
    expect(s.wrong).not.toBeNull();
    expect(() => AGENTS.draw(canvas, s, 0)).not.toThrow();
    expect(AGENTS.nudge.length).toBeGreaterThan(0);
  });
});

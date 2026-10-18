// The matter.js wrapper. matter moves and collides the bodies (the drone and the Field Coil blocks) against the
// room's static geometry; game rules (drone control, shots, enemies) live outside it. Engine gravity is set so a free
// body falls at the doc's 1800 px/s²; the drone cancels it and integrates its own gravity (see player/drone.ts).
import Matter from 'matter-js';
import type { Rect, Room } from '../level/room';
import { blockMass, DRONE, STEP_MS } from '../tuning';

/** Collision categories: the drone, blocks and the room collide with each other. */
export const CAT = { room: 0x1, drone: 0x2, block: 0x4 } as const;

/** matter's gravity force per step is gravity.y × scale × dt²; this makes it DRONE.gravity px/step². */
const GRAVITY_Y = DRONE.gravity / (0.001 * STEP_MS * STEP_MS);

export interface Block { body: Matter.Body; size: number; mass: number; held: boolean; thrownHits: Set<unknown> | null }

export interface World {
  engine: Matter.Engine;
  statics: Rect[];
  blocks: Block[];
}

export function createWorld(room: Room): World {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: GRAVITY_Y, scale: 0.001 }, positionIterations: 8, velocityIterations: 6 });
  const statics = room.solids;
  Matter.Composite.add(engine.world, statics.map((s) => Matter.Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
    isStatic: true, friction: 0, restitution: 0, collisionFilter: { category: CAT.room },
  })));
  const blocks = room.blocks.map((b) => {
    const body = Matter.Bodies.rectangle(b.x, b.y, b.size, b.size, {
      friction: 0.4, frictionAir: 0.01, restitution: 0.05, chamfer: { radius: 3 }, collisionFilter: { category: CAT.block },
    });
    const mass = blockMass(b.size);
    Matter.Body.setMass(body, mass);
    return { body, size: b.size, mass, held: false, thrownHits: null } as Block;
  });
  Matter.Composite.add(engine.world, blocks.map((b) => b.body));
  return { engine, statics, blocks };
}

export function stepWorld(w: World) {
  Matter.Engine.update(w.engine, STEP_MS);
}

/** A block's axis-aligned bounds as a Rect. */
export function blockRect(b: Block): Rect {
  const { min, max } = b.body.bounds;
  return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
}

// The matter.js wrapper. matter moves and collides the bodies (the drone, props and enemies) against the room's static
// geometry; game rules (drone control, shots, enemy brains) live outside it. Engine gravity is set so a free body
// falls at the doc's 1800 px/s²; the drone cancels it and integrates its own gravity (see player/drone.ts).
import Matter from 'matter-js';
import type { PropSpec, Rect, Room } from '../level/room';
import { crateSide, DRONE, STEP_MS, TUNING } from '../tuning';

/** Collision categories. The drone collides with the room and props only; enemies never push the drone (decision 4);
 * a held prop ignores the drone (decision 10). */
export const CAT = { room: 0x1, drone: 0x2, prop: 0x4, enemy: 0x8, held: 0x10 } as const;
export const MASK = {
  drone: CAT.room | CAT.prop,
  prop: CAT.room | CAT.drone | CAT.prop | CAT.enemy | CAT.held,
  held: CAT.room | CAT.prop | CAT.enemy,
  enemy: CAT.room | CAT.prop | CAT.enemy | CAT.held,
};

/** matter's gravity force per step is gravity.y × scale × dt²; this makes it DRONE.gravity px/step². */
const GRAVITY_Y = DRONE.gravity / (0.001 * STEP_MS * STEP_MS);

export interface Prop {
  body: Matter.Body;
  kind: 'crate' | 'logic' | 'debris';
  size: number;
  mass: number;
  bit?: 0 | 1;
  held: boolean;
  /** Steps left before a debris chunk fades out; -1 for props that stay. */
  life: number;
  /** Steps left ignoring the drone after a throw. */
  noDrone: number;
  /** Per enemy: the step it was last hurt by this prop (decision 12). */
  hits: Map<unknown, number>;
}

export interface World {
  engine: Matter.Engine;
  /** The room's solids plus the door while it is closed. */
  statics: Rect[];
  props: Prop[];
  door: { body: Matter.Body; rect: Rect; home: Rect } | null;
}

export function createWorld(room: Room): World {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: GRAVITY_Y, scale: 0.001 }, positionIterations: 8, velocityIterations: 6 });
  const statics = [...room.solids];
  Matter.Composite.add(engine.world, room.solids.map((s) => staticBody(s)));
  const w: World = { engine, statics, props: [], door: null };
  for (const p of room.props) addProp(w, p);
  if (room.door) {
    const rect = { ...room.door.rect };
    const body = staticBody(rect);
    Matter.Composite.add(engine.world, body);
    statics.push(rect);
    w.door = { body, rect, home: { ...room.door.rect } };
  }
  return w;
}

function staticBody(s: Rect) {
  return Matter.Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
    isStatic: true, friction: 0.6, restitution: 0, chamfer: { radius: 2 }, collisionFilter: { category: CAT.room },
  });
}

/** Add a crate, logic block or debris chunk at its centre. */
export function addProp(w: World, spec: PropSpec | { kind: 'debris'; x: number; y: number }, life = -1): Prop {
  const mass = spec.kind === 'crate' ? spec.mass ?? 1 : spec.kind === 'logic' ? TUNING.props.logicMass : TUNING.feel.debrisMass;
  const size = spec.kind === 'crate' ? crateSide(mass) : spec.kind === 'logic' ? TUNING.props.logicSize : TUNING.feel.debrisSize;
  const body = spec.kind === 'debris'
    ? Matter.Bodies.polygon(spec.x, spec.y, 5, size / 2, { friction: 0.5, frictionAir: 0.01, restitution: 0.3 })
    : Matter.Bodies.rectangle(spec.x, spec.y, size, size, { friction: 0.6, frictionAir: 0.01, restitution: 0.08, chamfer: { radius: 3 } });
  body.collisionFilter = { group: 0, category: CAT.prop, mask: MASK.prop };
  Matter.Body.setMass(body, mass);
  Matter.Composite.add(w.engine.world, body);
  const p: Prop = { body, kind: spec.kind, size, mass, bit: 'bit' in spec ? spec.bit : undefined, held: false, life, noDrone: 0, hits: new Map() };
  w.props.push(p);
  return p;
}

export function removeProp(w: World, p: Prop) {
  Matter.Composite.remove(w.engine.world, p.body);
  w.props = w.props.filter((q) => q !== p);
}

/** Switch a prop between held (ignores the drone) and loose. */
export function setHeld(p: Prop, held: boolean) {
  p.held = held;
  p.body.collisionFilter.category = held ? CAT.held : CAT.prop;
  p.body.collisionFilter.mask = held ? MASK.held : MASK.prop;
}

export function stepWorld(w: World) {
  for (const p of w.props) {
    if (p.noDrone > 0 && --p.noDrone === 0 && !p.held) setHeld(p, false);
  }
  Matter.Engine.update(w.engine, STEP_MS);
}

/** A body's axis-aligned bounds as a Rect. */
export function boundsRect(b: Matter.Body): Rect {
  const { min, max } = b.bounds;
  return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
}

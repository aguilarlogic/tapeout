// The drone's movement: run, jump, short hop, fast fall, coyote time, jump buffer, crouch, one-way platforms,
// double jump, wall latch and wall jump, and the dash (doc section 3). The drone is a matter body so it collides
// with the room and pushes blocks, but this controller owns its velocity: each step it sets the velocity it wants,
// matter moves and resolves it, and the probes below read back what the drone touches.
//
// Gravity uses trapezoid integration (the step moves by the average of the speed before and after gravity), so a
// jump of v px/step under gravity g peaks at exactly v² / 2g: 13² / (2 × 0.5) = 169 px, as the doc specifies.
import Matter from 'matter-js';
import type { Action } from '../input/bindings';
import type { Rect, Room } from '../level/room';
import { type Vec, approach, overlaps } from '../physics/geom';
import { boundsRect, CAT, MASK, type World } from '../physics/world';
import { DRONE } from '../tuning';

export interface Controls {
  held: Set<Action>;
  pressed: Set<Action>;
  /** Unit vector from the drone toward the aim point. */
  aim: Vec;
}

export interface Drone {
  body: Matter.Body;
  x: number; // centre
  y: number;
  vx: number; // px/step, what the controller wants
  vy: number;
  h: number; // current height (48, or 30 crouched)
  facing: 1 | -1;
  crouched: boolean;
  grounded: boolean;
  /** True when the ground under the drone is a one-way platform only. */
  onOneWay: boolean;
  ceiling: boolean;
  wall: -1 | 0 | 1; // a wall touching the drone's left (-1) or right (1) side
  latched: -1 | 0 | 1; // sliding down a wall on that side
  coyote: number;
  buffer: number;
  shortHop: boolean; // rising from a jump; releasing jump now cuts the rise
  airJumps: number;
  wallTime: number;
  lastLatch: -1 | 0 | 1;
  wallLock: number; // steps left ignoring input toward `lockSide`
  lockSide: -1 | 1;
  dash: { t: number; dx: number; dy: number } | null;
  dashCd: number;
  dashUsed: boolean; // used this airtime
  drop: number; // steps left ignoring one-way platforms
  prevX: number; // body position before the world step
  prevBottom: number;
  /** Upgrades that switch moves on (Level 1 spec): double jump comes in Level 2, wall latch in Level 5. */
  abilities: { doubleJump: boolean; wallLatch: boolean };
}

const cancelGravity = (b: Matter.Body, w: World) => {
  const g = w.engine.gravity;
  b.force.y -= b.mass * g.y * (g.scale ?? 0.001);
};

export function createDrone(w: World, x: number, y: number): Drone {
  const body = Matter.Bodies.rectangle(x, y, DRONE.w, DRONE.h, {
    friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, chamfer: { radius: 4 },
    collisionFilter: { category: CAT.drone, mask: MASK.drone },
  });
  Matter.Body.setInertia(body, Infinity);
  Matter.Body.setMass(body, 20);
  Matter.Composite.add(w.engine.world, body);
  return {
    body, x, y, vx: 0, vy: 0, h: DRONE.h, facing: 1, crouched: false, grounded: false, onOneWay: false, ceiling: false,
    wall: 0, latched: 0, coyote: 0, buffer: 0, shortHop: false, airJumps: 1, wallTime: 0, lastLatch: 0, wallLock: 0,
    lockSide: 1, dash: null, dashCd: 0, dashUsed: false, drop: 0, prevX: x, prevBottom: y + DRONE.h / 2,
    abilities: { doubleJump: true, wallLatch: true },
  };
}

export function droneRect(d: Drone): Rect {
  return { x: d.x - DRONE.w / 2, y: d.y - d.h / 2, w: DRONE.w, h: d.h };
}

/** Move the drone (and its body) to a spot, standing, at rest. Used for respawns and pit returns. */
export function placeDrone(d: Drone, x: number, y: number) {
  setHeight(d, DRONE.h);
  d.crouched = false;
  Matter.Body.setPosition(d.body, { x, y });
  Matter.Body.setVelocity(d.body, { x: 0, y: 0 });
  Object.assign(d, { x, y, vx: 0, vy: 0, dash: null, latched: 0, wallLock: 0, drop: 0, shortHop: false });
}

function setHeight(d: Drone, h: number) {
  if (d.h === h) return;
  const bottom = d.body.position.y + d.h / 2;
  Matter.Body.scale(d.body, 1, h / d.h);
  Matter.Body.setInertia(d.body, Infinity);
  Matter.Body.setMass(d.body, 20);
  Matter.Body.setPosition(d.body, { x: d.body.position.x, y: bottom - h / 2 });
  d.h = h;
  d.y = d.body.position.y;
}

/** Solid things the drone stands on or bumps into: the room, the closed door and the props it collides with. */
function solidsNear(w: World): Rect[] {
  return [...w.statics, ...w.props.filter((p) => p.body.collisionFilter.category === CAT.prop).map((p) => boundsRect(p.body))];
}

/** Read what the drone touches, using thin probe rects just outside its body. */
function probe(d: Drone, w: World, room: Room) {
  const r = droneRect(d), solids = solidsNear(w);
  const hit = (p: Rect) => solids.some((s) => overlaps(p, s));
  const feet = { x: r.x + 3, y: r.y + r.h - 1, w: r.w - 6, h: 3 };
  const onOne = d.drop === 0 && d.vy >= 0 && room.oneWay.some((o) => overlaps(feet, { x: o.x, y: o.y - 1, w: o.w, h: 3 }));
  const onSolid = hit(feet);
  d.grounded = onSolid || onOne;
  d.onOneWay = onOne && !onSolid;
  d.ceiling = hit({ x: r.x + 3, y: r.y - 2, w: r.w - 6, h: 3 });
  const side = (dx: number) => hit({ x: dx < 0 ? r.x - 2 : r.x + r.w - 1, y: r.y + 6, w: 3, h: r.h - 12 });
  d.wall = side(-1) ? -1 : side(1) ? 1 : 0;
}

/** Land on one-way platforms: matter does not know them, so a falling drone that crossed a top edge is set on it. */
function landOneWay(d: Drone, room: Room, prevBottom: number) {
  if (d.drop > 0 || d.vy < 0) return;
  const bottom = d.body.position.y + d.h / 2, left = d.body.position.x - DRONE.w / 2 + 3, right = d.body.position.x + DRONE.w / 2 - 3;
  for (const o of room.oneWay) {
    if (right > o.x && left < o.x + o.w && prevBottom <= o.y + 0.5 && bottom >= o.y) {
      Matter.Body.setPosition(d.body, { x: d.body.position.x, y: o.y - d.h / 2 });
      d.vy = 0;
      return;
    }
  }
}

export interface StepResult { dashed: boolean; jumped: boolean }

/**
 * Drone control for one 60 Hz step, before the world step (call settleDrone after it). `energy` is what the drone can spend; the result says whether a dash started
 * (the caller charges its energy). `frozen` (dying, paused overlays) skips input but keeps physics.
 */
export function stepDrone(d: Drone, c: Controls, w: World, energy: number, frozen = false): StepResult {
  const res: StepResult = { dashed: false, jumped: false };
  const held = (a: Action) => !frozen && c.held.has(a);
  const pressed = (a: Action) => !frozen && c.pressed.has(a);

  d.buffer = pressed('jump') ? DRONE.buffer : Math.max(0, d.buffer - 1);
  if (d.grounded) {
    d.coyote = DRONE.coyote;
    d.airJumps = 1;
    d.dashUsed = false;
    d.wallTime = 0;
    d.lastLatch = 0;
  }
  const airborne = !d.grounded;
  d.dashCd = Math.max(0, d.dashCd - 1);
  d.drop = Math.max(0, d.drop - 1);
  d.wallLock = Math.max(0, d.wallLock - 1);

  // crouch: hold down on the ground; stand back up only where there is head room
  const wantCrouch = held('down') && d.grounded && !d.dash;
  if (wantCrouch && !d.crouched) {
    setHeight(d, DRONE.crouchH);
    d.crouched = true;
  } else if (!wantCrouch && d.crouched) {
    const head = { x: d.x - DRONE.w / 2 + 1, y: d.y + d.h / 2 - DRONE.h, w: DRONE.w - 2, h: DRONE.h - d.h };
    if (!solidsNear(w).some((s) => overlaps(head, s))) {
      setHeight(d, DRONE.h);
      d.crouched = false;
    }
  }

  // dash: along the aim, once per airtime, invulnerable throughout (the caller reads d.dash for that)
  if (!d.dash && pressed('dash') && d.dashCd === 0 && energy >= DRONE.dashEnergy && (d.grounded || !d.dashUsed) && !d.crouched) {
    const v = DRONE.dashDist / DRONE.dashSteps;
    d.dash = { t: DRONE.dashSteps, dx: c.aim.x * v, dy: c.aim.y * v };
    d.dashCd = DRONE.dashCooldown;
    d.dashUsed = !d.grounded;
    d.latched = 0;
    res.dashed = true;
  }

  let applyVy: number;
  if (d.dash) {
    d.vx = d.dash.dx;
    d.vy = d.dash.dy;
    applyVy = d.vy;
    d.dash.t--; // settleDrone ends the dash after its last step
  } else {
    // horizontal
    let dir = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (d.wallLock > 0 && dir === d.lockSide) dir = 0;
    if (dir) d.facing = dir as 1 | -1;
    const top = d.crouched ? DRONE.crouchRun : DRONE.run;
    const accel = d.grounded ? DRONE.groundAccel : DRONE.airAccel;
    if (Math.abs(d.vx) > DRONE.run && Math.sign(d.vx) !== -dir) {
      d.vx = approach(d.vx, Math.sign(d.vx) * DRONE.run, DRONE.momentumDecay); // momentum: decays, never clamped
    } else if (dir) {
      const over = Math.abs(d.vx) > top && Math.sign(d.vx) === dir;
      d.vx = approach(d.vx, dir * top, over ? DRONE.groundStop : Math.sign(d.vx) === -dir ? Math.max(accel, d.grounded ? DRONE.groundStop : accel) : accel);
    } else {
      d.vx = approach(d.vx, 0, d.grounded ? DRONE.groundStop : DRONE.airDrag);
    }

    // jumps: ground (with coyote time and buffer), drop-through, wall jump, double jump
    if (d.buffer > 0 && (d.grounded || d.coyote > 0)) {
      if (held('down') && d.grounded && d.onOneWay) {
        d.drop = DRONE.dropThrough;
        d.buffer = 0;
      } else {
        d.vy = -DRONE.jump;
        res.jumped = true;
      }
    } else if (d.buffer > 0 && d.latched !== 0) {
      d.vx = -d.latched * DRONE.wallJumpOut;
      d.vy = -DRONE.wallJumpUp;
      d.wallLock = DRONE.wallJumpLock;
      d.lockSide = d.latched;
      d.airJumps = 1;
      res.jumped = true;
    } else if (pressed('jump') && d.abilities.doubleJump && d.airJumps > 0 && !d.grounded && d.coyote === 0) {
      d.vy = -DRONE.doubleJump;
      d.airJumps = 0;
      res.jumped = true;
    }
    if (res.jumped) {
      d.buffer = 0;
      d.coyote = 0;
      d.grounded = false;
      d.latched = 0;
      d.shortHop = true;
    }
    // coyote time counts down after this step's jump check, so it covers the first DRONE.coyote airborne steps
    if (airborne) d.coyote = Math.max(0, d.coyote - 1);
    if (d.shortHop && (d.vy >= 0 || !held('jump'))) {
      if (d.vy < 0) d.vy *= DRONE.shortHop;
      d.shortHop = false;
    }

    // wall latch: falling, pushing into a wall, for up to wallSlideMax steps per latch
    const pushing = d.abilities.wallLatch && d.wall !== 0 && dir === d.wall;
    if (!d.grounded && pushing && d.vy >= 0 && (d.wallTime < DRONE.wallSlideMax || d.lastLatch !== d.wall)) {
      if (d.lastLatch !== d.wall) d.wallTime = 0;
      d.latched = d.wall;
      d.lastLatch = d.wall;
      d.wallTime++;
      d.airJumps = 1;
    } else if (!res.jumped) {
      d.latched = 0;
    }

    // gravity (trapezoid), fast fall, wall slide, fall cap
    if (d.grounded && d.vy >= 0) {
      d.vy = 0;
      applyVy = 0;
    } else {
      const g = DRONE.gravity * (held('down') && !d.latched ? DRONE.fastFall : 1);
      const next = Math.min(d.vy + g, d.latched ? DRONE.wallSlide : Math.max(DRONE.fallCap, d.vy));
      applyVy = (d.vy + next) / 2;
      d.vy = next;
    }
  }

  d.prevX = d.body.position.x;
  d.prevBottom = d.body.position.y + d.h / 2;
  Matter.Body.setVelocity(d.body, { x: d.vx, y: applyVy });
  cancelGravity(d.body, w);
  return res;
}

/** After the world step: settle on one-way platforms, read contacts and drop the speed the room took away. */
export function settleDrone(d: Drone, w: World, room: Room) {
  landOneWay(d, room, d.prevBottom);
  d.x = d.body.position.x;
  d.y = d.body.position.y;
  probe(d, w, room);
  // a wall or a heavy block cuts horizontal speed to what actually happened
  const moved = d.body.position.x - d.prevX;
  if (Math.abs(moved) < Math.abs(d.vx) - 0.01 && d.wall !== 0 && Math.sign(d.vx) === d.wall) d.vx = moved;
  if (d.ceiling && d.vy < 0) {
    d.vy = 0;
    if (d.dash) d.dash.dy = 0;
  }
  if (d.dash && d.dash.t === 0) {
    const v = Math.hypot(d.dash.dx, d.dash.dy) || 1, k = DRONE.dashExit / v;
    d.vx = d.dash.dx * k;
    d.vy = d.dash.dy * k;
    d.dash = null;
  }
  if (d.grounded && d.vy > 0) d.vy = 0;
}

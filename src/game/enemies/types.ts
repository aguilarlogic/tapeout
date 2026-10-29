// What every enemy offers the simulation. The test enemies (Glitch, Spark, Latch) are matter bodies, so knockback,
// the Field Coil's push and thrown props move them physically (decision 4); phase 1's Floater and Glitch Spike move
// themselves.
import type Matter from 'matter-js';
import type { EnemyKind, Rect } from '../level/room';
import type { Vec } from '../physics/geom';

export interface EnemyCtx {
  rand: () => number;
  drone: Rect;
  /** The drone's centre. */
  target: Vec;
  solids: Rect[];
  plates: Rect[];
  /** Is there a clear line between two points (no room solid in the way)? */
  sight(a: Vec, b: Vec): boolean;
  /** Fire an enemy shot (px/s). `copied`: a Crosstalk victim's copy of its aggressor's shot (Noise Filter stops it). */
  shoot(x: number, y: number, vx: number, vy: number, damage: number, opts?: { copied?: boolean }): void;
  /** Hurt the drone (it ignores this while invulnerable), knocked away from `from`. */
  hurtDrone(n: number, from: Vec): void;
  /** Add an enemy to the room (an X-Blob's children). It joins on the next step. */
  spawn(kind: EnemyKind, x: number, y: number, opts?: { gen?: number; vx?: number; vy?: number }): void;
  /** The room's other live enemies (an X-Blob marks the ones it touches). */
  others(): Enemy[];
  /** The drone's headlamp: on, and when Beam Toggle has it in cone mode, the cone (apex, aim angle, half-angle, reach). */
  /** Model Lens: steps added to wind-ups and warning lines (0 or absent without the upgrade). */
  lens?: number;
  lamp: { cone: { x: number; y: number; a: number; half: number; reach: number } | null; scan?: { x: number; y: number; r: number } | null };
}

export interface Enemy {
  kind: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Centre in world px. */
  readonly x: number;
  readonly y: number;
  /** The matter body, for the test enemies. */
  body?: Matter.Body;
  /** 1 or -1: the side the enemy faces. */
  facing: 1 | -1;
  /** Steps left of the white hit flash. */
  flash: number;
  /** 0..1 while an attack is being telegraphed, else 0. */
  telegraph: number;
  /** Marked by an X-Blob: +50% HP, drawn in the X colour (phase 3 spec section 6). */
  xed?: boolean;
  /** X-Blob generation: 0 splits into two 1s, 1 into two 2s, 2 does not split. */
  gen?: number;
  /** Mass for the Inverted Grip (phase 3 spec section 7): 3 or less can be grabbed; absent means too heavy. */
  gripMass?: number;
  /** Drawn faint until revealed (the hidden Stuck-At Turret); 0..1, 1 when fully seen. */
  seen?: number;
  /** Stall Bubble: the radius of its field, in px; inside it the drone runs at half speed. */
  field?: number;
  /** Metastable: the Synchronizer holds it resolved and hittable for this many steps. */
  resolve?(steps: number): void;
  /** A thrown prop struck it or the Field Coil grabbed it, whether or not it is hittable (the Deadlock Pair's lock). */
  jolt?(): void;
  /** Can shots and thrown objects hit it right now? */
  hittable(): boolean;
  /** Does touching it hurt right now, and for how much? 0 means harmless. */
  touchDamage(): number;
  /** Its outline in world px (a convex polygon): drawn, hit-tested and shattered into edges on death. */
  outline(): Vec[];
  step(ctx: EnemyCtx): void;
  /** Take damage travelling along `dir` (a unit vector; absent for thrown props and blasts). Returns what landed. */
  damage(n: number, dir?: Vec): number;
  /** Knock it along v (px/s) and stun its brain for a moment so the push carries. */
  knock(v: Vec): void;
}

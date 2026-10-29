// What every enemy offers the simulation. The test enemies (Glitch, Spark, Latch) are matter bodies, so knockback,
// the Field Coil's push and thrown props move them physically (decision 4); phase 1's Floater and Glitch Spike move
// themselves.
import type Matter from 'matter-js';
import type { Rect } from '../level/room';
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
  /** Fire an enemy shot (px/s). */
  shoot(x: number, y: number, vx: number, vy: number, damage: number): void;
  /** Hurt the drone (it ignores this while invulnerable), knocked away from `from`. */
  hurtDrone(n: number, from: Vec): void;
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

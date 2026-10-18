// What every enemy offers the simulation. Phase 1 enemies are kinematic: they move themselves, not through matter.
import type { Rect } from '../level/room';
import type { Vec } from '../physics/geom';

export type Shape = { kind: 'circle'; x: number; y: number; r: number } | { kind: 'rect'; rect: Rect };

export interface EnemyCtx {
  rand: () => number;
  drone: Rect;
  solids: Rect[];
  plates: Rect[];
}

export interface Enemy {
  kind: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Can shots and thrown objects hit it right now? */
  hittable(): boolean;
  /** Does touching it hurt right now, and for how much? 0 means harmless. */
  touchDamage(): number;
  shape(): Shape;
  step(ctx: EnemyCtx): void;
  damage(n: number): void;
  /** Field Coil: mass if it can be grabbed, else 0, plus where it is. */
  grab?: { mass: number; pos(): Vec; moveTo(p: Vec, solids: Rect[]): void; release(v: Vec): void };
}

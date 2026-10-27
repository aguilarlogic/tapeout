// Every enemy kind a room can place, with how to make it and how to draw it (Phase 3 Spec, section 6). The Sim makes
// enemies through here and the renderer draws any kind it has no special case for through here.
import type { EnemyKind } from '../level/room';
import type { Enemy } from './types';

export interface MakeCtx {
  /** px/step², for bodies that fall. */
  gravity: number;
  rand: () => number;
  /** The act the room belongs to: HP × (1 + 0.15 × (act - 1)). */
  act: number;
  /** Story difficulty: HP × 0.75. */
  story: boolean;
}

export interface EnemyEntry {
  /** One anchor can make more than one enemy (a Racer Pair). */
  make(x: number, y: number, k: MakeCtx, opts?: { gen?: number; vx?: number; vy?: number }): Enemy | Enemy[];
  /** Draw it in world px; `t` is the step count, for idle motion. */
  draw(g: CanvasRenderingContext2D, e: Enemy, t: number): void;
}

export const ENEMY: Partial<Record<EnemyKind, EnemyEntry>> = {};

/** HP for an enemy of this base HP in this act and difficulty. */
export const scaledHp = (base: number, k: MakeCtx) => Math.round(base * (1 + 0.15 * (k.act - 1)) * (k.story ? 0.75 : 1));

export function register(kind: EnemyKind, entry: EnemyEntry) {
  ENEMY[kind] = entry;
}

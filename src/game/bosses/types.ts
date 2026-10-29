// Boss contracts (Phase 3 Spec, section 6). A boss is one of today's incidents (BossFight keeps every rule of the
// investigation); its form is a line-art body in the arena that runs attacks from a shared library, one at a time.
import type { EnemyKind, Rect } from '../level/room';

export type AttackId = 'bolts' | 'drop' | 'grid' | 'chain' | 'freeze' | 'segments' | 'mirror' | 'push' | 'relay' | 'split' | 'stage' | 'slam' | 'lash' | 'paths' | 'spikes' | 'congest' | 'rush' | 'shift' | 'eye' | 'walls' | 'holes' | 'agents' | 'assume' | 'reorder' | 'evict' | 'jam' | 'predict'
  | 'noise' | 'ring' | 'flips' | 'dies' | 'cracks' | 'hang' | 'probes' | 'leak' | 'lockdown' | 'flare' | 'phase' | 'zap' | 'address' | 'mismatch' | 'bands';
export type BodyKind = 'lamps' | 'gate' | 'chain' | 'wheel' | 'digit' | 'twin' | 'stack' | 'datapath' | 'clocks' | 'worm' | 'cell' | 'serpent' | 'titan' | 'polygon' | 'knot' | 'sleeper' | 'snake' | 'transceivers' | 'scoreboard' | 'ring' | 'trio' | 'engine' | 'window' | 'tower' | 'mesh' | 'hologram'
  | 'antenna' | 'buck' | 'memarray' | 'wafer' | 'package' | 'server' | 'tester' | 'vault' | 'ecu' | 'optical' | 'qubit' | 'golem' | 'mute' | 'custboard' | 'sensor';

export interface BossForm {
  incident: string;
  name: string;
  body: BodyKind;
  attacks: AttackId[];
}

/** What an attack can see and do. Damage is before difficulty scaling (the Sim applies it). */
export interface AttackCtx {
  rand: () => number;
  story: boolean;
  /** The drone's bounds now. */
  drone: Rect;
  /** Where the drone was, one entry per step, newest last (the last 3 s), for the mirror twin. */
  trail: { x: number; y: number }[];
  arena: Rect;
  /** The boss body. */
  boss: Rect;
  /** Floors and platforms the drone can stand on. */
  floors: Rect[];
  /** Fire an enemy shot (px/s). */
  shoot(x: number, y: number, vx: number, vy: number, damage: number): void;
  /** Hurt the drone if it overlaps `area` (it ignores this while invulnerable). */
  hurt(area: Rect, n: number): void;
  /** A temporary hazard rect that hurts on touch for `ms`. */
  hazard(r: Rect, ms: number, damage: number): void;
  /** A temporary platform the drone can stand on, for `ms` (the Bad Call's push). */
  platform(r: Rect, ms: number): void;
  sfx(n: 'laser' | 'drop' | 'chain' | 'freeze' | 'mirror' | 'turret'): void;
  /** Model Lens: steps added to every telegraph (0 without the upgrade). timed() adds it. */
  lens: number;
  /** Spawn a bug in the arena (the Coverage Holes). */
  spawn(kind: EnemyKind, x: number, y: number): void;
  /** Friendly shots that hit `r` this step: they are used up, and their total damage is returned (PASS walls). */
  soak(r: Rect): number;
}

/** One attack: started, stepped at 60 Hz until it says it is done, drawn on top of the arena. */
export interface Attack<R = unknown> {
  id: AttackId;
  start(c: AttackCtx): R;
  /** Returns true when finished. `speed` is 1 normally, 1.25 enraged, 1.4 in the finish phase. */
  step(run: R, c: AttackCtx, speed: number): boolean;
  draw(g: CanvasRenderingContext2D, run: R, t: number): void;
}

/** What a body drawer is told each frame. */
export interface BodyState {
  /** Steps since the fight started. */
  t: number;
  /** 0..1 HP left. */
  hp: number;
  shielded: boolean;
  enraged: boolean;
  /** Steps left of the hit flash. */
  flash: number;
  /** The running attack, for bodies that show it (lamps light, segments missing). */
  attack: AttackId | null;
  /** 0..1 through the running attack's telegraph, else 0. */
  telegraph: number;
  /** Lamps body: which of the four lamps are lit (bit 3 first). */
  lit: boolean[];
  /** Segments body parts flying (hidden on the body). */
  away: number;
}

export type BodyDrawer = (g: CanvasRenderingContext2D, box: Rect, s: BodyState) => void;

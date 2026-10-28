// Room data: everything a room holds, as plain numbers in world px (y grows downward). Rects are top-left based.
export interface Rect { x: number; y: number; w: number; h: number }
export type Dir = 'left' | 'right' | 'up' | 'down';
/** Body enemies placed by rooms. The first three are the feel-pass test enemies; the rest arrive with the places
 * (phase 3 spec section 6) and are made through enemies/registry.ts. */
export type EnemyKind = 'glitch' | 'spark' | 'latch' | 'stuckat' | 'stuckat0' | 'racer' | 'crawler' | 'xblob' | 'floater' | 'metastable' | 'swarm' | 'bubble' | 'ringer' | 'shunt';

export interface PropSpec {
  kind: 'crate' | 'logic';
  x: number; // centre
  y: number;
  /** Crates: mass 1, 2, 3 or 5 (side from crateSide). Logic blocks are mass 1. */
  mass?: number;
  /** Logic blocks: the bit they hold. */
  bit?: 0 | 1;
}

export interface Room {
  name: string;
  w: number;
  h: number;
  spawn: { x: number; y: number }; // the drone's centre at the room's save node
  solids: Rect[];
  /** Platforms you can jump up through and stand on; S + jump drops through. Only their top edge matters. */
  oneWay: Rect[];
  /** Short-circuit spikes: touching one costs 15 integrity and knocks the drone back. */
  hazards: Rect[];
  /** Grounding plates: a Floater over one is pinned and harmless. */
  plates: Rect[];
  props: PropSpec[];
  enemies: { kind: EnemyKind; x: number; y: number }[];
  /** Phase 1 enemies (kept for phase 2 levels). */
  floaters: { x: number; y: number }[];
  spikes: { x: number; y: number; dir: Dir; offset: number }[]; // anchor, strike direction, steps before the first strike
  emitters: { x: number; y: number }[]; // test fixtures that fire small shots at the drone
  /** A door that a prop resting on its pressure plate opens for good (decision 16). */
  door?: { rect: Rect; plate: Rect };
  /** An input pad that reads the bit of a logic block resting on it. */
  pads?: Rect[];
  /** A target dummy (decision 22): its post stands on the floor at x, y. */
  dummy?: { x: number; y: number };
  /** Decorative circuit traces (polylines) drawn on the back wall. */
  traces: { x: number; y: number }[][];
  /** Text painted on the back wall, to label each part of the room. */
  signs: { x: number; y: number; text: string }[];
}

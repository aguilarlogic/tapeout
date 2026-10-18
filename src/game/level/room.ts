// Room data: everything a room holds, as plain numbers in world px (y grows downward). Rects are top-left based.
export interface Rect { x: number; y: number; w: number; h: number }
export type Dir = 'left' | 'right' | 'up' | 'down';

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
  blocks: { x: number; y: number; size: number }[]; // centre and side length
  floaters: { x: number; y: number }[];
  spikes: { x: number; y: number; dir: Dir; offset: number }[]; // anchor, strike direction, steps before the first strike
  emitters: { x: number; y: number }[]; // test fixtures that fire small shots at the drone
  /** Decorative circuit traces (polylines) drawn behind the room, with a dash that moves along them. */
  traces: { x: number; y: number }[][];
  /** Text painted on the back wall, to label each part of the test room. */
  signs: { x: number; y: number; text: string }[];
}

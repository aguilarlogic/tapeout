// Story rooms: a Room (geometry, props, enemies) plus what the story hangs on it: wire-run terminals, ports, panels,
// benches, levers, plates, moving solids, dialogue triggers and the exit. Plain data, in world px (y grows downward).
import type { Rect, Room } from '../level/room';

/** A wire-run terminal: a stand on the floor with one pin of the level's circuit. `pin` is a circuit pin ref
 * ("in.y", "g.a"); `role` says how it is drawn. */
export interface Terminal { pin: string; x: number; y: number; label: string; role: 'source' | 'sink' | 'gate' }

/** A world wire run (Level 1 spec, puzzle rules): today's Logic Lab level, with its gate fixed on the wall. */
export interface WireRun {
  level: string;
  /** The fixed gate: its kind and where it hangs on the wall (its centre). */
  gate?: { kind: 'NOT' | 'AND'; x: number; y: number };
  terminals: Terminal[];
  /** The safety strip: one lamp per truth-table row, centred here. */
  strip: { x: number; y: number };
}

export type StationKind =
  | 'port' | 'panel' | 'bench' | 'lever' | 'debug' | 'node'
  | 'archive' | 'review' | 'board' | 'map' | 'crt' | 'arcade' | 'interview' | 'lift';

/** Something the drone presses E at. `module` is the module it scores, `arg` an instrument reading or a lesson. */
export interface Station { id: string; kind: StationKind; x: number; y: number; label: string; module?: string; arg?: string }

export type GateKind = 'door' | 'crust' | 'bridge' | 'lift' | 'shutter';
/** A solid the story opens, breaks, extends or moves. */
export interface Gate { id: string; kind: GateKind; rect: Rect }

/** Lines TAPEOUT says when the drone first passes x (and y, when given: the drone must be above it). */
export interface Trigger { id: string; x: number; y?: number; lines: string[] }

export type Music = 'keeper' | 'boss' | 'loft' | 'bench';

export interface StoryRoom extends Room {
  id: string;
  /** Dark until its lights come on: only the drone's glow (and lit terminals) show. */
  dark?: boolean;
  gates: Gate[];
  wire?: WireRun;
  stations: Station[];
  triggers: Trigger[];
  /** Gate Hall: plates that read pressed under the drone or any prop. */
  dplates?: Rect[];
  /** Wall lamps (the Bit Wall's eight): where they hang. */
  lamps?: { x: number; y: number; n: number; gap: number };
  /** Where the drone leaves: past this x (or above this y for a shaft) the next room fades in. */
  exit: { x: number; y?: number };
  /** The module(s) this room scores, in order; empty for rooms with none. */
  modules: string[];
  music: Music;
  /** A decorative fixture the art draws: the lamp, the lift sensor, the ALU, the board, the bench rig. */
  props2?: { kind: 'lamp' | 'sensor' | 'alu' | 'board' | 'rig' | 'window' | 'plaque' | 'coilgate'; x: number; y: number; w?: number; h?: number }[];
}

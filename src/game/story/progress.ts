// What the story knows about the player, and where it is kept (Level 1 spec, "Saves, progress and migration").
// Scores, stars and ranks stay in today's progress save. Upgrades, integrity, repaired panels and the chip map are
// derived from level records every time, never stored. Only world state (where the drone stands, what it discovered,
// which cutscenes played, what TAPEOUT said) lives under tapeout.world.v1.
import { TUNING } from '../tuning';
import { LEVEL1 } from './level1';

export const WORLD_KEY = 'tapeout.world.v1';

export type Place = 'bit-zero' | 'loft';

export interface WorldSave {
  version: 1;
  /** The save node: the room the drone wakes in. */
  at: { place: Place; room: number };
  places: { 'bit-zero': { discoveries: string[]; cleared: string[] } };
  cutscenes: string[];
  /** Everything TAPEOUT has said, oldest first, for the Archive's story log (capped). */
  heard: string[];
  /** Seconds played in the story. */
  storyClock: number;
}

export const LOG_CAP = 200;

export function blankWorld(): WorldSave {
  return { version: 1, at: { place: 'bit-zero', room: 0 }, places: { 'bit-zero': { discoveries: [], cleared: [] } }, cutscenes: [], heard: [], storyClock: 0 };
}

/** Read the world save; undefined when there is none (or it cannot be read). */
export function loadWorld(store: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): WorldSave | undefined {
  try {
    const raw = store?.getItem(WORLD_KEY);
    if (!raw) return undefined;
    const w = JSON.parse(raw) as Partial<WorldSave>;
    if (w.version !== 1 || !w.at) return undefined;
    const b = blankWorld();
    return { ...b, ...w, places: { 'bit-zero': { ...b.places['bit-zero'], ...w.places?.['bit-zero'] } } } as WorldSave;
  } catch {
    return undefined;
  }
}

export function saveWorld(w: WorldSave, store: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) {
  try {
    store?.setItem(WORLD_KEY, JSON.stringify(w));
  } catch {
    /* private mode: the story still plays, it just starts over next time */
  }
}

type Done = (id: string) => boolean;

/** The Level 1 modules, in order. */
export const LEVEL1_MODULES = LEVEL1.flatMap((r) => r.modules);

/** Every module of Level 1 has a record. */
export const level1Done = (done: Done) => LEVEL1_MODULES.every(done);

/**
 * The room a player with these records wakes in: just after the last room whose scored modules are all done, with
 * every room before it done too. Rooms with no module (the Floater Shaft, the First Fight, the Boss Door) are passed
 * through: the save node is the room right after the last finished module room.
 */
export function nodeFor(done: Done): number {
  let node = 0;
  for (let i = 0; i < LEVEL1.length; i++) {
    const mods = LEVEL1[i].modules;
    if (!mods.length) continue;
    if (!mods.every(done)) break;
    node = i + 1;
  }
  return Math.min(node, LEVEL1.length - 1);
}

/** Has any module anywhere been done? (Any progress at all means a migration, not a cold boot.) */
export type Start =
  | { kind: 'cold' } // no progress: the cold boot in the Dark Bay
  | { kind: 'resume'; at: WorldSave['at'] } // a world save: wake at its node
  | { kind: 'migrate'; at: WorldSave['at']; discoveries: string[] }; // progress but no world save: partial memory

/** Where the story starts for a player (Level 1 spec, migration rules). */
export function startFor(world: WorldSave | undefined, done: Done, anyProgress: boolean): Start {
  if (world) return { kind: 'resume', at: world.at };
  if (!anyProgress) return { kind: 'cold' };
  if (level1Done(done)) return { kind: 'migrate', at: { place: 'loft', room: 0 }, discoveries: discoveriesFor(LEVEL1.length) };
  const node = nodeFor(done);
  return { kind: 'migrate', at: { place: 'bit-zero', room: node }, discoveries: discoveriesFor(node) };
}

/** Story events a player who reached room `node` has already seen. */
export function discoveriesFor(node: number): string[] {
  const out: string[] = [];
  if (node > 1) out.push('coil');
  if (node > 2) out.push('both-plates');
  return out;
}

/** The drone's kit, derived from records (and the one story event, the Field Coil). */
export interface StoryKit {
  headlamp: boolean;
  gun: boolean;
  coil: boolean;
  grabLimit: number;
  maxIntegrity: number;
  carryShot: boolean;
  /** Hull panels, in repair order: optics, legs, motors, tool arm, chassis, comms. */
  panels: boolean[];
  /** TAPEOUT speaks in full sentences once the exit lift has played. */
  voice: boolean;
}

export const PANEL_MODULES = ['first-wire', 'first-not', 'first-and', 'logic-half', 'inc-demo-board', 'half-adder-v'];
export const PANEL_NAMES = ['optics', 'legs', 'motors', 'tool arm', 'chassis', 'comms'];

export function kitFor(done: Done, discoveries: readonly string[], cutscenes: readonly string[]): StoryKit {
  const S = TUNING.story;
  return {
    headlamp: done('first-wire'),
    gun: done('first-wire'),
    coil: discoveries.includes('coil') || done('bits'),
    grabLimit: done('first-and') ? S.grip : TUNING.field.grabLimit,
    maxIntegrity: done('inc-demo-board') ? S.bossIntegrity : TUNING.vitals.health,
    carryShot: done('half-adder-v'),
    panels: PANEL_MODULES.map(done),
    voice: cutscenes.includes('exit-lift'),
  };
}

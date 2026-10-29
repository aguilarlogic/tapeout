// The place engine's contracts (Phase 3 Spec, sections 2 to 6). Every place after Level 1 is built from a PlaceDef
// (where it sits in the story), a PlaceTheme (how it looks, sounds and talks) and its chapter's modules, by
// compose.ts. Templates, mechanics and themes are written against these types only.
import type { EnemyKind, Rect } from '../level/room';
import type { Vec } from '../physics/geom';
import type { Music, StoryRoom } from '../story/types';

// --- places ---------------------------------------------------------------------------------------------------------

export type PlaceKind = 'main' | 'deep' | 'study' | 'wing' | 'hall';

/** One row of the design doc's "full map, in play order" table. */
export interface PlaceDef {
  /** Kebab-case game name: 'bit-zero', 'lamp-board', 'firmware-pit'. */
  id: string;
  /** The map number as shown: '1'..'27', 'S1'..'S8', 'D1'..'D18', 'W1'..'W8', 'H'. */
  n: string;
  /** The game name: 'Bit Zero', 'The Lamp Board'. */
  name: string;
  /** Today's curriculum chapter name, exactly. */
  chapter: string;
  kind: PlaceKind;
  /** 1 Keeper, 2 Core, 3 Silicon, 4 Cluster, 5 the Underlayers, 6 the epilogue (wings and the hall). */
  act: 1 | 2 | 3 | 4 | 5 | 6;
  /** The ADA region it repairs. */
  region: string;
  /** Place ids that must be complete before this one opens. */
  after: string[];
  /** Incident ids fought here, in chapter order. */
  bosses: string[];
}

// --- rooms ----------------------------------------------------------------------------------------------------------

export type RoomRole = 'landing' | 'discovery' | 'port' | 'panel' | 'annex' | 'bench' | 'gate' | 'fight' | 'traverse' | 'bossdoor' | 'arena' | 'exit';

/** What a room template returns: geometry plus the anchors compose.ts hangs stations, gates and enemies on. World px,
 * y down, floor 80 px above the bottom edge, entry on the left. */
export interface Shell {
  w: number;
  h: number;
  solids: Rect[];
  oneWay: Rect[];
  hazards: Rect[];
  /** Grounding plates (they pin Floaters). */
  plates: Rect[];
  /** The drone's centre at the room's save node. */
  spawn: Vec;
  /** Past this x (or above this y for a shaft) the next room fades in. */
  exit: { x: number; y?: number };
  anchors: {
    /** Station feet (x, floor y), left to right. */
    stations: Vec[];
    /** The solid the director opens: a shutter, a door. */
    gate?: Rect;
    /** Enemy centres. */
    enemies: Vec[];
    /** Crate centres (resting on a floor). */
    props: Vec[];
    /** Arena instrument nodes (feet). */
    nodes?: Vec[];
    /** Arena boss body. */
    boss?: Rect;
    /** Arena debug port foot. */
    debug?: Vec;
    /** Landing and exit lift foot. */
    lift?: Vec;
    /** Bench rig centre. */
    rig?: Vec;
  };
  /** The surfaces the reachability test walks, in order from the spawn to the exit. */
  footholds: Rect[];
  traces: Vec[][];
  signs: { x: number; y: number; text: string }[];
}

export interface TemplateOpts {
  /** Stations wanted (port 1, panel 1, annex and bench n). */
  stations?: number;
  /** Arena: instrument nodes wanted. */
  nodes?: number;
  /** Fight and traverse: enemy anchors wanted (the template may return fewer, never more). */
  enemies?: number;
  /** The kit the room must be passable with. */
  doubleJump: boolean;
  wallLatch: boolean;
}

export type Template = (rng: () => number, opts: TemplateOpts) => Shell;

// --- themes ---------------------------------------------------------------------------------------------------------

export type MechanicKind = 'lamps' | 'inverted' | 'select' | 'clocked' | 'pattern' | 'loop' | 'bus' | 'clocks' | 'stages';
export interface MechanicSpec { kind: MechanicKind; /** The module whose port follows the discovery room. */ before: string }

export type BackdropKind = 'lamps' | 'gates' | 'carry' | 'clock' | 'rom' | 'core' | 'under' | 'grid' | 'silicon' | 'cluster' | 'fab' | 'loft';

/** Everything TAPEOUT says in a place. Keys of `rooms`: 'port:<module>', 'panel:<module>', 'bench:<first module>',
 * 'gate:<module>', 'annex', 'discovery', 'fight', 'traverse', 'upgrade:<upgrade id>'. */
export interface PlaceLines {
  arrive: string[];
  rooms: Record<string, string[]>;
  /** Fight cleared: one of these at random. */
  clear: string[];
  bossIntro: string[];
  bossBeaten: string[];
  leave: string[];
}

export interface PlaceTheme {
  place: string;
  music: Music;
  enemies: EnemyKind[];
  /** Fillers (traverse and fight rooms) in the place. */
  fights: number;
  discovery?: MechanicSpec;
  lines: PlaceLines;
  backdrop: BackdropKind;
}

// --- discovery mechanics --------------------------------------------------------------------------------------------

export interface MechCtx {
  /** Steps since the room was entered. */
  t: number;
  /** Story difficulty (slower clocks). */
  story: boolean;
  drone: Rect;
  grounded: boolean;
  /** Bounds of props on the ground (not held). */
  props: Rect[];
  /** The lever station E was pressed at this step, if any. */
  used: string | null;
  /** Target ids shot this step. */
  hit: string[];
  /** A gate's current rect. */
  rect(id: string): Rect;
  /** Move a gate; a grounded drone standing on it rides along. */
  move(id: string, x: number, y: number): void;
  open(id: string): void;
  close(id: string): void;
  sfx(n: 'lever' | 'plate' | 'rowTick' | 'door' | 'liftHum' | 'pass'): void;
  say(line: string): void;
  /** Put the drone's centre at x, y with velocity vx, vy in px/s (rails, pads, a reset to the start). */
  warp(x: number, y: number, vx?: number, vy?: number): void;
  /** Hurt the drone by n (it ignores this while invulnerable). */
  hurt(n: number): void;
  /** The beat is done: opens the exit, records the discovery once, plays the pass chime. */
  solve(): void;
}

export interface MechanicDef<S = unknown> {
  kind: MechanicKind;
  /** The whole room: role 'discovery', modules [], gates the mechanic moves, lever stations, shootable targets. */
  room(rng: () => number): StoryRoom;
  init(): S;
  step(s: S, c: MechCtx): void;
  /** Drawn after the room geometry, in world px. */
  draw(g: CanvasRenderingContext2D, s: S, t: number): void;
  /** TAPEOUT's nudge after 60 s with no progress. */
  nudge: string;
}

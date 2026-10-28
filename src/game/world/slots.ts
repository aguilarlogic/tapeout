// Modules to rooms (Phase 3 Spec, section 4): the slot rules that turn a chapter into the list of rooms a place is
// made of, before any geometry. compose.ts builds each planned room from a template; the test checks this plan against
// the section 5 table, room for room.
import type { Module } from '../../curriculum';
import { chapterOf } from './places';
import type { MechanicKind, PlaceDef, PlaceTheme, RoomRole } from './types';
import { upgradeFor } from './upgrades';

export interface PlanRoom {
  role: RoomRole;
  /** The modules the room scores, in order (an arena's incident; a boss door's checkpoint, when it has one). */
  modules: string[];
  /** Annex rooms: none of their modules locks the exit. */
  optional?: boolean;
  /** The bench that holds the capstone: it draws the rig with the upgrade part. */
  capstone?: boolean;
  /** Boss doors and arenas: the incident behind the door. */
  incident?: string;
  /** A discovery room's mechanic. */
  mechanic?: MechanicKind;
  /** The elite gauntlet that ends a place with no boss: three waves. */
  gauntlet?: boolean;
  /** Level 27's X arenas: which of the four forms (Phase 7 Spec, section 7). */
  xform?: 1 | 2 | 3 | 4;
}

/** Labs that open on a workbench. */
const WORKBENCH = new Set(['rtl', 'debug', 'isa', 'rv', 'cdc', 'arch', 'sta', 'sta2', 'layout', 'pd', 'dft', 'pcb', 'sig', 'spec', 'code', 'shell', 'sva', 'tb', 'cov', 'uvm']);
/** Labs that hang on a wall panel. */
const PANEL = new Set(['logic', 'cmos', 'clab']);
const NOT_LAB = new Set(['lesson', 'practice', 'boss', 'incident', 'drills', 'final']);
/** Rooms that count toward the filler rhythm. */
const SCORED = new Set<RoomRole>(['port', 'panel', 'annex', 'bench', 'gate']);
/** Most stations a bench room holds. */
const BENCH_MAX = 6;

/** The chapter's capstone: its last non-optional lab, or its last lesson when it has no lab. It grants the major. */
export function capstoneOf(mods: readonly Module[]): string | undefined {
  const scored = mods.filter((m) => !m.optional);
  return [...scored].reverse().find((m) => !NOT_LAB.has(m.kind))?.id ?? [...scored].reverse().find((m) => m.kind === 'lesson')?.id;
}

/** n items in groups of at most `max`, split as evenly as possible (15 → 5, 5, 5). */
function split<T>(xs: T[], max: number): T[][] {
  const groups = Math.ceil(xs.length / max), out: T[][] = [];
  let at = 0;
  for (let g = 0; g < groups; g++) {
    const n = Math.floor(xs.length / groups) + (g < xs.length % groups ? 1 : 0);
    out.push(xs.slice(at, at + n));
    at += n;
  }
  return out;
}

/** The rooms of a place in order. Study places live at the Loft's chalkboard and have no rooms. */
export function planPlace(place: PlaceDef, theme: Pick<PlaceTheme, 'fights' | 'discovery'>): PlanRoom[] {
  if (place.kind === 'study') return [];
  // Level 27 has its own plan (Phase 7 Spec, section 2): the Interview, a run, the Tapeout Review, X four times, the end
  if (place.id === 'tapeout') {
    return [
      { role: 'landing', modules: [] }, { role: 'port', modules: ['drills'] }, { role: 'traverse', modules: [] },
      { role: 'fight', modules: [] }, { role: 'gate', modules: ['final'] },
      ...([1, 2, 3, 4] as const).map((n): PlanRoom => ({ role: 'xarena', modules: [], xform: n })),
      { role: 'ending', modules: [] },
    ];
  }
  const mods = chapterOf(place).modules.filter((m) => m.kind !== 'practice');
  const cap = capstoneOf(mods);
  const body: PlanRoom[] = [];
  for (let i = 0; i < mods.length; i++) {
    const m = mods[i];
    if (m.optional) {
      const run = [m];
      while (mods[i + 1]?.optional) run.push(mods[++i]);
      body.push({ role: 'annex', modules: run.map((x) => x.id), optional: true });
    } else if (WORKBENCH.has(m.kind)) {
      const run = [m];
      while (mods[i + 1] && !mods[i + 1].optional && WORKBENCH.has(mods[i + 1].kind)) run.push(mods[++i]);
      for (const g of split(run, BENCH_MAX)) body.push({ role: 'bench', modules: g.map((x) => x.id), ...(g.some((x) => x.id === cap) ? { capstone: true } : {}) });
    } else if (m.id === cap) {
      body.push({ role: 'bench', modules: [m.id], capstone: true });
    } else if (m.kind === 'boss') {
      const next = mods[i + 1];
      body.push(next?.kind === 'incident' ? { role: 'bossdoor', modules: [m.id], incident: next.id } : { role: 'gate', modules: [m.id] });
    } else if (m.kind === 'incident') {
      const prev = body[body.length - 1];
      if (!(prev?.role === 'bossdoor' && prev.incident === m.id)) body.push({ role: 'bossdoor', modules: [], incident: m.id });
      body.push({ role: 'arena', modules: [m.id], incident: m.id });
    } else {
      body.push({ role: PANEL.has(m.kind) ? 'panel' : 'port', modules: [m.id] });
    }
  }

  // Fillers: one after every second scored room and one between two benches in a row, alternating traverse and
  // fight, up to theme.fights; the rest go before the first boss door.
  const out: PlanRoom[] = [{ role: 'landing', modules: [] }];
  let scored = 0, fillers = 0;
  const filler = () => {
    if (fillers >= theme.fights) return;
    const want = fillers++ % 2 === 0 ? 'traverse' : 'fight';
    // no two fights in a row (Phase 4 Spec, section 3)
    out.push({ role: want === 'fight' && out[out.length - 1].role === 'fight' ? 'traverse' : want, modules: [] });
  };
  const disc = theme.discovery;
  let discovered = false;
  for (const room of body) {
    if (room.role === 'bossdoor' && out.every((r) => r.role !== 'bossdoor')) while (fillers < theme.fights) filler();
    if (room.role === 'bench' && out[out.length - 1].role === 'bench') filler();
    if (disc && !discovered && room.modules.includes(disc.before)) {
      out.push({ role: 'discovery', modules: [], mechanic: disc.kind });
      discovered = true;
    }
    out.push(room);
    if (SCORED.has(room.role) && ++scored % 2 === 0) filler();
  }
  // Deep Layers are short: no closing gauntlet (Phase 4 Spec, section 3)
  if (!place.bosses.length && place.kind !== 'deep') out.push({ role: 'fight', modules: [], gauntlet: true });
  out.push({ role: 'exit', modules: [] });
  return out;
}

/** The major upgrade a place's capstone grants. */
export function majorOf(place: PlaceDef) {
  const cap = capstoneOf(chapterOf(place).modules);
  const u = cap ? upgradeFor(cap) : undefined;
  return u?.type === 'major' ? u : undefined;
}

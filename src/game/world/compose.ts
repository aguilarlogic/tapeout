// The place engine (Phase 3 Spec, sections 2 and 4): a place's planned rooms (slots.ts) built from the room templates,
// with stations, doors, enemies and TAPEOUT's lines hung on the anchors each template returns. Deterministic: the same
// place always gives the same rooms, so saves can name a room by its index.
import { findModule, type ModKind } from '../../curriculum';
import { findIncident } from '../../incidents';
import type { EnemyKind, PropSpec } from '../level/room';
import { overlaps } from '../physics/geom';
import type { Station, StoryRoom, Trigger } from '../story/types';
import { MECHANICS } from './mechanics';
import { PLACES, placeById } from './places';
import { majorOf, planPlace, type PlanRoom } from './slots';
import { arena } from './templates/arena';
import { FIGHT_VARIANTS } from './templates/fight';
import { ROOMS } from './templates/rooms';
import { TRAVERSE_VARIANTS } from './templates/traverse';
import { themeFor as act1Theme } from './themes/act1';
import { ACT2_THEMES } from './themes/act2';
import { UNDER_THEMES } from './themes/under';
import type { BackdropKind, PlaceDef, PlaceTheme, Shell, Template, TemplateOpts } from './types';

/** A small seeded rng (mulberry32). */
export function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const BACKDROP: Record<PlaceDef['act'], BackdropKind> = { 1: 'lamps', 2: 'core', 3: 'silicon', 4: 'cluster', 5: 'under', 6: 'fab' };

/** The theme a place without its own (phases 4 to 8 fill these in) is built with. */
export function themeOf(place: PlaceDef): PlaceTheme {
  return act1Theme(place.id) ?? [...ACT2_THEMES, ...UNDER_THEMES].find((t) => t.place === place.id) ?? {
    place: place.id, music: 'keeper', enemies: ['glitch', 'spark', 'latch'], fights: 3, backdrop: BACKDROP[place.act],
    lines: { arrive: [`${place.name}.`], rooms: {}, clear: ['Clear.'], bossIntro: [], bossBeaten: [], leave: [] },
  };
}

/** The story clock shown at a place's landing: T-27, one less for each main place before it. */
export const clockAt = (place: PlaceDef) => 27 - PLACES.slice(0, PLACES.indexOf(place)).filter((p) => p.kind === 'main').length;

/** The label on a module's station. */
function label(kind: ModKind, title: string): string {
  const head = kind === 'boss' ? 'GATE TERMINAL' : kind === 'lesson' || kind === 'final' ? 'PORT' : kind === 'logic' || kind === 'cmos' ? 'PATCH PANEL' : kind === 'clab' ? 'CIRCUIT BENCH' : 'WORKBENCH';
  return `${head} · ${title.toUpperCase()}`;
}
const stationKind = (role: PlanRoom['role'], kind: ModKind): Station['kind'] =>
  role === 'gate' || role === 'bossdoor' ? 'gate' : role === 'bench' ? 'bench' : kind === 'lesson' || kind === 'final' ? 'port' : 'panel';

/** Stations on a shell's anchors, one per module. */
function stationsFor(room: PlanRoom, s: Shell): Station[] {
  return room.modules.map((id, i) => {
    const m = findModule(id)?.module;
    const at = s.anchors.stations[i] ?? s.anchors.stations[s.anchors.stations.length - 1];
    return { id: `st:${id}`, kind: stationKind(room.role, m?.kind ?? 'lesson'), x: at.x, y: at.y, label: label(m?.kind ?? 'lesson', m?.title ?? id), module: id };
  });
}

/** The theme line key for a planned room. */
function lineKey(room: PlanRoom): string | undefined {
  const first = room.modules[0];
  switch (room.role) {
    case 'port': case 'panel': case 'bench': case 'gate': return `${room.role}:${first}`;
    case 'bossdoor': return first ? `gate:${first}` : undefined;
    case 'annex': case 'discovery': case 'fight': case 'traverse': return room.role;
    default: return undefined;
  }
}

/** Enemy kinds for a filler, taken in turn from the theme's list from a random start. */
function enemiesFor(theme: PlaceTheme, anchors: Shell['anchors']['enemies'], rng: () => number): { kind: EnemyKind; x: number; y: number }[] {
  const start = Math.floor(rng() * theme.enemies.length);
  return anchors.map((a, i) => ({ kind: theme.enemies[(start + i) % theme.enemies.length], x: a.x, y: a.y }));
}

const crates = (s: Shell): PropSpec[] => s.anchors.props.map((p) => ({ kind: 'crate', mass: 2, x: p.x, y: p.y }));

/** Picks a variant other than the last one used. */
function variant(rng: () => number, list: [string, Template][], last: string | undefined): [string, Template] {
  const pool = list.filter(([n]) => n !== last);
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/** Every room of a place, built. Study places return []. */
export function composePlace(place: PlaceDef, theme: PlaceTheme = themeOf(place)): StoryRoom[] {
  const rng = rngFor(PLACES.indexOf(place) * 7919 + 1);
  const opts: TemplateOpts = { doubleJump: false, wallLatch: false };
  const plan = planPlace(place, theme);
  const major = majorOf(place);
  let lastTraverse: string | undefined, lastFight: string | undefined, fights = 0;
  return plan.map((room, index): StoryRoom => {
    const id = `${place.id}:${index}:${room.role}`;
    const music = room.role === 'bench' ? 'bench' : room.role === 'arena' ? 'boss' : theme.music;
    const base = { id, role: room.role, place: place.id, modules: room.modules, music, backdrop: theme.backdrop };
    if (room.role === 'discovery' && room.mechanic) {
      return { ...MECHANICS[room.mechanic].room(rng), ...base, mechanic: room.mechanic, triggers: lines(theme, room, 200) };
    }
    let s: Shell;
    let enemies: StoryRoom['enemies'] = [];
    if (room.role === 'traverse') {
      const [n, t] = variant(rng, TRAVERSE_VARIANTS, lastTraverse);
      lastTraverse = n;
      s = t(rng, { ...opts, enemies: 3 });
      enemies = enemiesFor(theme, s.anchors.enemies, rng);
    } else if (room.role === 'fight') {
      const [n, t] = variant(rng, FIGHT_VARIANTS, lastFight);
      lastFight = n;
      s = t(rng, { ...opts, enemies: room.gauntlet ? 10 : Math.min(10, 6 + fights++) });
      enemies = enemiesFor(theme, s.anchors.enemies, rng);
    } else if (room.role === 'arena') {
      s = arena(rng, { ...opts, nodes: findIncident(room.incident!)?.instruments.length ?? 4 });
    } else {
      s = ROOMS[room.role as keyof typeof ROOMS](rng, { ...opts, stations: Math.max(1, room.modules.length) });
    }
    const stations = room.role === 'arena' ? arenaStations(room, s) : room.role === 'exit' || room.role === 'landing' ? [...liftStation(s), ...hatchStation(place, room, s)] : stationsFor(room, s);
    const rail = room.role === 'traverse' && place.act === 2 ? railFor(s) : null;
    if (rail) stations.push({ id: 'rail0', kind: 'rail', x: rail.x1, y: rail.y1 + RAIL_LIFT, label: 'BUS RAIL', arg: '0' });
    const signs = room.role === 'landing' ? [{ x: 640, y: 200, text: `${place.name.toUpperCase()} · ${place.region.toUpperCase()} · T-${clockAt(place)}` }] : s.signs;
    return {
      ...base,
      name: `${place.name} ${index}`,
      w: s.w, h: s.h, spawn: s.spawn, exit: s.exit,
      solids: s.solids, oneWay: s.oneWay, hazards: s.hazards, plates: s.plates,
      props: crates(s), enemies, floaters: [], spikes: [], emitters: [],
      traces: s.traces, signs,
      gates: s.anchors.gate ? [{ id: 'door', kind: room.role === 'port' ? 'shutter' : 'door', rect: s.anchors.gate }] : [],
      stations,
      triggers: lines(theme, room, 0),
      ...(room.optional ? { optional: room.modules } : {}),
      ...(room.capstone && major ? { upgrade: major.id } : {}),
      ...(room.role === 'bench' && s.anchors.rig ? { props2: [{ kind: 'rig' as const, x: s.anchors.rig.x, y: s.anchors.rig.y, w: 520, h: 140 }] } : {}),
      ...(room.role === 'arena' && s.anchors.boss ? { boss: { incident: room.incident!, rect: s.anchors.boss } } : {}),
      ...(rail ? { rails: [rail] } : {}),
    };
  });
}

/** One node per instrument and the debug port. */
function arenaStations(room: PlanRoom, s: Shell): Station[] {
  const inc = findIncident(room.incident!);
  const nodes = (inc?.instruments ?? []).slice(0, s.anchors.nodes?.length ?? 0).map((ins, i): Station => {
    const at = s.anchors.nodes![i];
    return { id: `node:${ins.cmd}`, kind: 'node', x: at.x, y: at.y, label: ins.cmd.toUpperCase(), arg: ins.cmd };
  });
  const d = s.anchors.debug;
  return d ? [...nodes, { id: 'debug', kind: 'debug', x: d.x, y: d.y, label: 'DEBUG PORT', module: room.incident }] : nodes;
}

function liftStation(s: Shell): Station[] {
  const l = s.anchors.lift;
  // the landing's lift is the one the drone came down on: it goes home too
  return l ? [{ id: 'lift', kind: 'lift', x: l.x, y: l.y, label: 'LIFT TO THE LOFT' }] : [];
}

/** A rail starts this far above the ground at its start station, so the drone barely rises as it clips on. */
const RAIL_LIFT = 90;
/** Room the drone needs along a rail: the rail line plus the drone hanging under it. */
const RAIL_BAND = { above: 12, below: 64, side: 24 };

/**
 * A bus rail across an act 2 traverse room (Phase 4 Spec, section 7), from the ground near the spawn up to a clear
 * height and across to 260 px short of the far wall. Every point along it has room for the hanging drone; a room with
 * no clear line gets no rail. Only the Datapath Rail rides it; without it the rail is scenery that says so.
 */
function railFor(s: Shell): { x1: number; y1: number; x2: number; y2: number } | null {
  const x1 = s.spawn.x + 80, ground = s.spawn.y + 24, x2 = s.w - 260;
  if (x2 - x1 < 600 || !s.solids.some((b) => b.y === ground && b.x <= x1 && b.x + b.w >= x1)) return null;
  const y1 = ground - RAIL_LIFT;
  const clear = (y2: number) => {
    for (let x = x1; x <= x2; x += 16) {
      const y = y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
      const band = { x: x - RAIL_BAND.side, y: y - RAIL_BAND.above, w: RAIL_BAND.side * 2, h: RAIL_BAND.above + RAIL_BAND.below };
      if (s.solids.some((b) => overlaps(b, band))) return false;
    }
    return true;
  };
  for (let y2 = y1; y2 >= 120; y2 -= 20) if (clear(y2)) return { x1, y1, x2, y2 };
  return null;
}

/** The places in play order without the chalkboard studies: the ones with rooms, as the drone walks them. */

/** Deep Layer hatches (Phase 4 Spec, section 3; Phase 5 Spec, section 3): the exit of the place before a Deep Layer
 * drops into it, and a Deep Layer's landing climbs back up to that exit. A hatch joins only neighbours in PLACES: a
 * study chapter between them (taught at the Loft's chalkboard) breaks the link. `arg` names the place it leads to. */
function hatchStation(place: PlaceDef, room: PlanRoom, s: Shell): Station[] {
  const l = s.anchors.lift, i = PLACES.indexOf(place);
  if (!l || i < 0) return [];
  const next = PLACES[i + 1], prev = PLACES[i - 1];
  if (room.role === 'exit' && next?.kind === 'deep') {
    return [{ id: 'hatch', kind: 'hatch', x: l.x - HATCH_OFF, y: l.y, label: `HATCH · ${next.name.toUpperCase()}`, arg: next.id }];
  }
  if (room.role === 'landing' && place.kind === 'deep' && prev && (prev.kind === 'main' || prev.kind === 'deep')) {
    return [{ id: 'hatch', kind: 'hatch', x: l.x + HATCH_OFF, y: l.y, label: `HATCH · UP TO ${prev.name.toUpperCase()}`, arg: prev.id }];
  }
  return [];
}
/** A hatch sits this far from the lift, on the floor. */
const HATCH_OFF = 300;

/** TAPEOUT's lines for a room: the arrive lines at the landing, the leave lines at the exit, else the room's own. */
function lines(theme: PlaceTheme, room: PlanRoom, x: number): Trigger[] {
  const l = theme.lines;
  if (room.role === 'landing') return l.arrive.length ? [{ id: 'arrive', x, lines: l.arrive }] : [];
  if (room.role === 'exit') return l.leave.length ? [{ id: 'leave', x, lines: l.leave }] : [];
  const key = lineKey(room);
  const said = key ? l.rooms[key] : undefined;
  return said?.length ? [{ id: key!, x: x + 200, lines: said }] : [];
}

const cache = new Map<string, StoryRoom[]>();
/** A place's rooms, built once. */
export function roomsOf(placeId: string): StoryRoom[] {
  let rooms = cache.get(placeId);
  if (!rooms) {
    const p = placeById(placeId);
    rooms = p ? composePlace(p) : [];
    cache.set(placeId, rooms);
  }
  return rooms;
}

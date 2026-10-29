// The story director: runs the story room by room around the Sim: Level 1's hand-built rooms, the Loft, and every
// composed place (Phase 3 Spec, section 2), whose rooms it runs by their role, never by their id. It owns the room's
// story state (wires, plates, doors, the lift, the bridge, lamps, lights, discovery puzzles), TAPEOUT's lines, the E key,
// rewards and upgrades, room transitions, the save node and the bosses. The Sim stays the physics and combat it was;
// the director sets its kit and reads its target hits.
// No DOM in here: overlays and sound leave as `out` records the game screen turns into windows and noise.
import Matter from 'matter-js';
import { recommended } from '../../curriculum';
import { findIncident } from '../../incidents';
import { award } from '../../mastery/promotion';
import { levelRecord, load, prefs, profile } from '../../state';
import { recordLabFirstWire, recordLabTest } from '../../steplog';
import type { Action } from '../input/bindings';
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { addMover, boundsRect, type Mover, moveMover, setPresent } from '../physics/world';
import { droneRect } from '../player/drone';
import { Sim } from '../sim';
import { frames, HZ, TUNING } from '../tuning';
import { FormRun } from '../bosses/form';
import { formFor } from '../bosses/forms-act1';
import type { AttackCtx } from '../bosses/types';
import { liftChoices } from '../loft/data';
import { rngFor, roomsOf, themeOf } from '../world/compose';
import { MECHANICS } from '../world/mechanics';
import { openPlaces, PLACES, placeById, placeDone, placeOf } from '../world/places';
import { STORY } from '../world/story';
import { X_HP, X_LINES, xIncident } from '../world/x';
import type { MechanicDef, PlaceTheme } from '../world/types';
import { type ActKit, actKit, UP, upgradeFor } from '../world/upgrades';
import { racerPending } from '../enemies/racer';
import { BossFight } from './boss';
import { LEVEL1, LOFT } from './level1';
import { blankWorld, kitFor, LOG_CAP, loadWorld, nodeIn, PANEL_NAMES, type Place, type PlaceSave, saveWorld, type StoryKit, startFor, type WorldSave } from './progress';
import { BOOT_COLD, BOOT_PARTIAL, LINES, PARTIAL_LINES } from './script';
import { ENDING, HELLO, LAMP_AT_S, SKIP_S, stepLen, TYPE_S } from './ending';
import type { Music, Station, StationKind, StoryRoom, Terminal } from './types';
import { combos } from '../../games/logic/circuit';
import { check, type Check, levelOf, nextWire, runStars, type Wire } from './wirerun';

const S = TUNING.story;

export type StorySfx =
  | 'wireGrab' | 'wirePlug' | 'wireSnap' | 'rowTick' | 'pass' | 'notYet' | 'spark' | 'lever' | 'plate' | 'liftHum'
  | 'portOpen' | 'bossPhase' | 'fanfare' | 'chirp' | 'door' | 'crack' | 'shatter' | 'lightsOn' | 'reading'
  | 'turret' | 'laser' | 'bossDrop' | 'chain' | 'freeze' | 'mirror' | 'beam' | 'repair';

export type StoryOut =
  | { t: 'sfx'; name: StorySfx; gain?: number }
  | { t: 'overlay'; kind: 'port' | 'panel' | 'bench' | 'study' | 'module'; module: string }
  | { t: 'choose'; kind: Choice; title: string; options: { text: string; dim?: boolean }[] }
  | { t: 'card'; kind: 'pager' | 'upgrade' | 'debrief' | 'info'; title: string; lines: string[]; stars?: number; button?: string }
  | { t: 'loft'; station: StationKind }
  | { t: 'profile' }
  | { t: 'music'; track: Music }
  | { t: 'shake'; px: number; ms: number }
  | { t: 'shatter'; rect: Rect }
  | { t: 'enter' };

export type Choice = 'cause' | 'fix' | 'loftLift' | 'guard' | 'node';

/** Rooms where Enable Lock folds the gun away. */
const QUIET = new Set(['port', 'panel', 'annex', 'bench', 'gate']);
/** The main-path bosses after the Dark Demo Board: each one beaten adds integrity. */
/** Boss health by act from act 2 on (Phase 4 Spec, section 3; the Design Doc's table). Act 1 ramps instead. */
const BOSS_HP: Partial<Record<number, number>> = { 2: 900, 3: 1500, 4: 2200 };
const ACT_BOSSES = PLACES.filter((p) => p.kind === 'main' && p.id !== 'bit-zero').flatMap((p) => p.bosses);
/** Steps a boss door with no checkpoint waits before it opens. */
const DOOR_WAIT_MS = 1200;

/** One wire on the floor, between two terminal pins. */
interface RoomState {
  wires: Wire[];
  carrying: string | null; // the pin the carried wire is anchored at
  check: Check;
  /** The safety strip's test run: rows lit so far, and how it ends. */
  strip: { rows: boolean[]; shown: number; t: number; pass: boolean; failRow: number } | null;
  spark: number; // steps left of a wrong loop's spark
  passed: boolean;
  attempts: number;
  firstWire: boolean;
  openedAt: number;
  hintStage: number;
  sinceTry: number; // steps since the last plug, for the timed hints
  ghost: Wire | null;
  light: number; // 0 dark .. 1 lit
  lightTo: number;
  gates: Map<string, { m: Mover; open: number; opening: boolean; hp: number }>;
  plateT: number;
  latched: boolean;
  nudged: boolean;
  lamps: number;
  levers: Record<string, boolean>;
  lift: number; // 0 bottom .. 1 top
  bridge: number; // 0 .. 1 extended
  cleared: boolean;
  fired: Set<string>;
  t: number; // steps in this room
  /** Composed rooms: the discovery puzzle running here. */
  mech: { def: MechanicDef<unknown>; state: unknown; solved: boolean; used: string | null; hits: string[]; nudged: boolean } | null;
  /** Step a module in this room passed (the traces power up and a pulse runs to the door), or -1. */
  powered: number;
  /** Step the capstone's part started flying into the drone, or -1. */
  partFly: number;
}

export interface Bubble { text: string; age: number }
export interface Prompt { x: number; y: number; text: string }

type Cut = { kind: 'boot'; lines: string[]; t: number; then: string[] } | { kind: 'exitLift'; t: number; x: number } | { kind: 'ending'; t: number; step: number } | null;

/** Height of each station's name label above its foot, in px (as drawn in render.ts). */
const STATION_TOP: Record<string, number> = {
  port: 184, panel: 224, bench: 130, lever: 120, node: 84, debug: 102, board: 264, map: 216, archive: 236, interview: 236, arcade: 236, lift: 236,
  gate: 184, calib: 236, patrol: 236,
};

export class Director {
  place: Place = 'bit-zero';
  index = 0;
  room: StoryRoom = LEVEL1[0];
  sim!: Sim;
  rs!: RoomState;
  world: WorldSave;
  kit!: StoryKit;
  /** What act 1's upgrades add (from records). */
  act!: ActKit;
  boss: BossFight | null = null;
  /** A composed arena's boss body and its attacks. */
  form: FormRun | null = null;
  private rng: () => number = rngFor(1);
  /** The places on the Loft lift's card, in order (the last option is "Stay in the Loft"). */
  private liftOpts: { place: string; text: string; dim: boolean }[] = [];
  /** The node whose argument card is open. */
  private nodeCmd: string | null = null;
  /** Beam Toggle: the headlamp is in its long cone. */
  beamOn = false;
  out: StoryOut[] = [];
  bubble: Bubble | null = null;
  private queue: string[] = [];
  prompt: Prompt | null = null;
  /** Room fade: steps into the fade, with the room to load at the midpoint. */
  fade: { t: number; to: { place: Place; index: number } } | null = null;
  cut: Cut = null;
  /** Level 27's X form being fought (1 to 4), or 0. */
  xn: 0 | 1 | 2 | 3 | 4 = 0;
  /** The bit X leaves after its last form: it falls to the floor, and walking into it starts the ending. */
  bit: { x: number; y: number; vy: number; t: number } | null = null;
  /** Boot text for the screen to type (cold boot or partial memory); empty for a plain resume. */
  bootLines: string[] = BOOT_COLD;
  /** A choice the screen is showing; input waits until it comes back. */
  waiting = false;
  private seed: number;
  /** Set by the screen once its own boot sequence hands over control. */
  live = false;

  constructor(seed = Date.now() >>> 0, private store: Storage | undefined = globalThis.localStorage) {
    this.seed = seed;
    const done = (id: string) => !!levelRecord(id);
    const w = loadWorld(store);
    const start = startFor(w, done, Object.keys(load().levels).some((k) => !k.startsWith('mini.')), Director.beyond(done));
    this.world = w ?? blankWorld();
    let lines: string[] = [];
    if (start.kind === 'cold') this.bootLines = BOOT_COLD;
    else if (start.kind === 'migrate') {
      this.bootLines = BOOT_PARTIAL;
      this.world.at = start.at;
      for (const d of start.discoveries) this.discover(d, start.at.place);
      lines = PARTIAL_LINES;
    } else this.bootLines = [];
    const at = this.world.at;
    this.enter(at.place, at.room);
    if (lines.length) this.say(...lines);
    if (!profile()) this.out.push({ t: 'profile' });
  }

  /**
   * Where a player past Level 1 with no world save wakes (Phase 3 Spec, section 9): the act 1 place holding their next
   * module, after its last finished room, with the discoveries before it. Later places wait for their phases: the Loft.
   */
  static beyond(done: (id: string) => boolean): { place: string; room: number; discoveries: string[] } | undefined {
    const next = recommended(), p = next ? placeOf(next.id) : undefined;
    if (!p || p.kind !== 'main' || p.act !== 1 || p.id === 'bit-zero') return undefined;
    const rooms = roomsOf(p.id), room = nodeIn(rooms, done);
    return { place: p.id, room, discoveries: rooms.slice(0, room).flatMap((r) => (r.mechanic ? [`${p.id}:${r.mechanic}`] : [])) };
  }

  // --- the save ---
  private save() { saveWorld(this.world, this.store); }
  /** A place's saved state (the Loft shares Level 1's, where its one discovery lives). */
  private ps(place: Place = this.place): PlaceSave {
    const k = place === 'loft' ? 'bit-zero' : place;
    return (this.world.places[k] ??= { discoveries: [], cleared: [] });
  }
  discover(id: string, place: Place = this.place) {
    const d = this.ps(place).discoveries;
    if (!d.includes(id)) { d.push(id); this.save(); }
  }
  private has(id: string) { return this.ps().discoveries.includes(id); }
  private clear(id: string) {
    const c = this.ps().cleared;
    if (!c.includes(id)) { c.push(id); this.save(); }
  }
  private cleared(id: string) { return this.ps().cleared.includes(id); }
  private done = (id: string) => !!levelRecord(id);
  /** The rooms of a place. */
  /** Coverage Map: the current place's rooms, which were entered, and the one the drone is in (null without it). */
  coverage(): { seen: boolean[]; at: number } | null {
    if (!this.act.coverageMap || this.place === 'loft') return null;
    const v = this.ps().visited ?? [];
    return { seen: this.roomsFor(this.place).map((_, i) => v.includes(i)), at: this.index };
  }

  roomsFor(place: Place): StoryRoom[] { return place === 'loft' ? [LOFT] : place === 'bit-zero' ? LEVEL1 : roomsOf(place); }
  /** The place's theme (lines, music), for composed places. */
  get theme(): PlaceTheme | undefined { const p = placeById(this.place); return p && p.id !== 'bit-zero' ? themeOf(p) : undefined; }

  /** Difficulty from prefs, or from the profile (new and student players start on Story). */
  static difficulty(): 'story' | 'standard' {
    const d = prefs().difficulty;
    if (d) return d;
    return profile()?.background === 'pro' ? 'standard' : 'story';
  }

  /** Apply difficulty and assists to the sim (also when the pause menu changes them). */
  applyPrefs() {
    const p = prefs();
    this.sim.assist.damageScale = p.invincible ? 0 : Director.difficulty() === 'story' ? S.storyDamage : 1;
    this.sim.assist.infiniteEnergy = p.infiniteEnergy;
  }

  // --- TAPEOUT's lines ---
  say(...lines: string[]) {
    for (const l of lines) {
      this.queue.push(l);
      this.world.heard.push(l);
    }
    if (this.world.heard.length > LOG_CAP) this.world.heard.splice(0, this.world.heard.length - LOG_CAP);
  }
  private stepBubble() {
    if (this.bubble) {
      this.bubble.age++;
      const typed = this.bubble.text.length / S.lineCps * HZ;
      if (this.bubble.age > typed + frames(S.lineMs) || (this.queue.length && this.bubble.age > typed + frames(900))) this.bubble = null;
    }
    if (!this.bubble && this.queue.length) {
      this.bubble = { text: this.queue.shift()!, age: 0 };
      this.out.push({ t: 'sfx', name: 'chirp', gain: 0.6 });
    }
  }

  // --- rooms ---
  /** Load a room: a fresh Sim, the kit from records, story solids, and whatever is already solved. */
  enter(place: Place, index: number) {
    const rooms = this.roomsFor(place);
    this.place = place;
    this.index = Math.max(0, Math.min(index, rooms.length - 1));
    this.room = rooms[this.index];
    const room = this.room;
    // lines belong to their room: a new room starts quiet
    this.queue = [];
    this.bubble = null;
    this.form = null;
    this.formPlatforms.clear();
    this.xn = 0;
    this.bit = null;
    // the weapon in hand and the slot order go with the drone from room to room
    const hand = this.sim ? { weapon: this.sim.weapon, picked: this.sim.picked } : null;
    this.sim = new Sim(room, (this.seed = (this.seed * 1664525 + 1013904223) >>> 0), { act: placeById(place)?.act ?? 1, story: Director.difficulty() === 'story' });
    this.sim.respawnEnemies = room.id === 'arena';
    if (hand) { this.sim.weapon = hand.weapon; this.sim.picked = hand.picked; }
    this.sim.panels = [false, false, false, false, false, false];
    const rs: RoomState = {
      wires: [], carrying: null, check: { state: 'open' }, strip: null, spark: 0, passed: false, attempts: 0, firstWire: false,
      openedAt: Date.now(), hintStage: 0, sinceTry: 0, ghost: null, light: room.dark ? 0 : 1, lightTo: room.dark ? 0 : 1,
      gates: new Map(), plateT: 0, latched: false, nudged: false, lamps: 0, levers: {}, lift: 0, bridge: 0, cleared: false,
      fired: new Set(), t: 0, mech: null, powered: -1, partFly: -1,
    };
    this.rs = rs;
    for (const g of room.gates) {
      const m = addMover(this.sim.world, g.id, g.rect, g.kind !== 'bridge');
      rs.gates.set(g.id, { m, open: 0, opening: false, hp: g.kind === 'crust' ? S.crustHp : 0 });
    }
    this.sim.targets = [
      ...room.gates.filter((g) => g.kind === 'crust').map((g) => ({ id: g.id, rect: g.rect, active: true })),
      ...(room.targets ?? []).map((t) => ({ id: t.id, rect: t.rect, active: true })),
    ];
    if (room.mechanic) { const def = MECHANICS[room.mechanic]; rs.mech = { def, state: def.init(), solved: false, used: null, hits: [], nudged: false }; }
    for (const st of room.stations) if (st.kind === 'lever') rs.levers[st.id] = false;
    this.applyKit();
    this.applyPrefs();
    this.restore();
    this.world.at = place === 'loft' ? { place: 'loft', room: 0 } : { place, room: this.index };
    // the Coverage Map (Phase 7 Spec, section 3): every room entered is kept, upgrade or not
    if (place !== 'loft') { const ps = this.ps(place), v = (ps.visited ??= []); if (!v.includes(this.index)) v.push(this.index); }
    this.save();
    this.boss = null;
    if (room.id === 'arena' || room.role === 'arena') this.startBoss();
    if (room.role === 'xarena' && room.xform) this.startX(room.xform);
    if (room.role === 'ending') this.startEnding();
    this.out.push({ t: 'enter' }, { t: 'music', track: room.music });
    // the first landing in the Underlayers (Phase 5 Spec, section 3), act 3, Silicon (Phase 6 Spec, section 3) and act 4,
    // the Cluster (Phase 7 Spec, section 3)
    const act = placeById(place)?.act, card = act === 5 ? 'underlayers' : act === 3 ? 'silicon' : act === 4 ? 'cluster' : null;
    if (card && !this.world.cutscenes.includes(card)) {
      this.world.cutscenes.push(card);
      this.save();
      const u = STORY[card];
      this.out.push({ t: 'card', kind: 'info', title: u.title, lines: [...u.lines], button: u.button });
      this.waiting = true;
    }
  }

  /** The drone's kit from records: what it can do, and how it looks. */
  applyKit(announce = false) {
    const k = kitFor(this.done, this.ps('bit-zero').discoveries, this.world.cutscenes);
    const a = actKit(this.done, ACT_BOSSES);
    const before = this.kit;
    this.kit = k;
    this.act = a;
    const s = this.sim;
    s.kit = {
      gun: k.gun, coil: k.coil, charged: a.weapons.includes('charged'), grabLimit: k.grabLimit + a.grabBonus, carryShot: k.carryShot,
      weapons: a.weapons, probeDamage: a.probeDamage, cannonDamage: a.cannonDamage, counterTo: a.counterTo, weak: a.weak || undefined,
      holster: a.holster && QUIET.has(this.room.role ?? ''), gripEnemies: a.gripEnemies, fieldRadius: a.fieldRadius,
      damageScale: a.damageScale, behindScale: a.behindScale, phasor: a.phasor || undefined, stillRegen: a.stillRegen,
      dashHit: a.dashHit || undefined, dashCooldownMs: a.dashCooldownMs, compass: a.compass || undefined,
      throwChargeS: a.throwChargeS, throwDamage: a.throwDamage, drop: a.drop || undefined, hover: a.hover || undefined,
      visor: a.visor || undefined, chargedDamage: a.chargedDamage,
      slots: a.slots, burstBolts: a.burstBolts || undefined, loopDrone: a.loopDrone || undefined, rail: a.rail || undefined, sync: a.sync || undefined,
      mirror: a.mirror || undefined, cooldownScale: a.cooldownScale, parryMs: a.parryMs || undefined, viaThick: a.viaThick || undefined,
      turret: a.turret || undefined, gateS: a.gateS || undefined, scan: a.scan || undefined, tether: a.tether || undefined,
      loopRange: a.loopRange, repairDelayMs: a.repairDelayMs, noiseFilter: a.noiseFilter || undefined, pid: a.pid || undefined,
      templates: a.templates || undefined, rewind: a.rewind || undefined, crit: a.crit || undefined, newton: a.newton || undefined,
      agents: a.agents || undefined, mine: a.mine || undefined, specDamage: a.specDamage, sched: a.sched, pockets: a.pockets || undefined,
      warp: a.warp || undefined, lens: a.lens || undefined,
    };
    s.drone.abilities = { doubleJump: a.doubleJump, wallLatch: a.wallLatch, ...(a.doubleJump ? { jump2: a.jump2 / HZ } : {}) };
    if (!a.beam) this.beamOn = false;
    const v = s.vitals;
    const maxI = Math.min(UP.integrityCap, k.maxIntegrity + a.integrityBonus);
    if (v.maxIntegrity !== maxI) { const up = maxI - v.maxIntegrity; v.maxIntegrity = maxI; if (up > 0) v.integrity += up; }
    if (v.maxEnergy !== a.energyMax) { const up = a.energyMax - v.maxEnergy; v.maxEnergy = a.energyMax; if (up > 0) v.energy += up; }
    k.panels.forEach((on, i) => {
      if (on && !s.panels[i]) {
        s.panels[i] = true;
        if (announce && before && !before.panels[i]) { s.panelAge[i] = 0; s.fx.push({ t: 'repair', panel: i }); }
      }
    });
    if (!k.coil) v.energy = 0;
  }

  /** On entry, a room shows what is already solved (a replay, or a migrated save). */
  private restore() {
    const room = this.room, rs = this.rs;
    const passed = room.modules.length > 0 && room.modules.every(this.done);
    switch (room.id) {
      case 'dark-bay':
        if (passed) { rs.passed = true; rs.light = rs.lightTo = 1; rs.wires = [['in:in', 'out:out']]; }
        if (this.cleared('crust')) this.removeGate('crust');
        break;
      case 'bit-wall':
        if (passed) { rs.passed = true; rs.lamps = 8; this.openGate('shutter', true); }
        if (this.has('coil')) rs.fired.add('coil');
        break;
      case 'gate-hall':
        if (this.has('both-plates')) { rs.latched = true; this.openGate('door', true); }
        if (passed) { rs.passed = true; this.openGate('power', true); }
        break;
      case 'lift-shaft':
        if (passed) { rs.passed = true; rs.wires = [['in:a', 'g.a'], ['g.y', 'out:y']]; }
        break;
      case 'twin-motors':
        if (passed) { rs.passed = true; rs.wires = [['in:a', 'g.a'], ['in:b', 'g.b'], ['g.y', 'out:y']]; rs.levers = { 'lever-a': true, 'lever-b': true }; rs.bridge = 1; this.setBridge(); }
        break;
      case 'bit0-chamber':
        if (passed) { rs.passed = true; rs.light = rs.lightTo = 1; this.openGate('door', true); }
        break;
      case 'first-fight':
        if (this.cleared('first-fight')) { rs.cleared = true; this.openGate('door', true); for (const e of this.sim.enemies) e.alive = false; this.sim.enemies = []; }
        break;
      case 'workbench':
        rs.passed = passed;
        break;
    }
    if (room.role) this.restoreRole();
    if (rs.passed) rs.check = { state: 'pass', verdict: { ok: true, rows: [], errors: [], count: 0 } };
  }

  /** Composed rooms on entry: open what is already done (Phase 3 Spec, section 2). */
  private restoreRole() {
    const room = this.room, rs = this.rs;
    const scored = room.modules.filter((m) => !room.optional?.includes(m));
    if (scored.length && scored.every(this.done)) { rs.passed = true; this.openGate('door', true); }
    if (room.role === 'annex') rs.passed = true;
    if (room.role === 'fight' && this.cleared(room.id)) {
      rs.cleared = true;
      this.openGate('door', true);
      for (const e of this.sim.enemies) e.alive = false;
      this.sim.enemies = [];
    }
    if (room.role === 'discovery' && room.mechanic && this.has(`${this.place}:${room.mechanic}`)) {
      rs.mech!.solved = true;
      this.openGate('exit', true);
    }
  }

  /** Start the next room with a fade (the drone walked out, or a lift arrived). */
  go(place: Place, index: number) {
    if (this.fade) return;
    this.fade = { t: 0, to: { place, index } };
    this.out.push({ t: 'sfx', name: 'door', gain: 0.5 });
  }

  private startBoss() {
    const spec = this.room.boss;
    const inc = spec ? findIncident(spec.incident) : undefined;
    if (this.done(inc?.id ?? 'inc-demo-board')) { this.openGate('door', true); this.sim.enemies = []; return; }
    const story = Director.difficulty() === 'story';
    if (spec && inc) {
      // a composed arena: act 1 grows 50 a level after the board's 400, later acts use BOSS_HP; the body fights back
      const n = PLACES.filter((p) => p.kind === 'main').findIndex((p) => p.id === this.place) + 1;
      const act = PLACES.find((p) => p.id === this.place)?.act ?? 1;
      this.boss = new BossFight(story, this.seed, undefined, inc, BOSS_HP[act] ?? 400 + 50 * (Math.max(1, n) - 1));
      this.form = new FormRun(formFor(inc.id), spec.rect, story);
      this.rng = rngFor(this.seed);
    } else this.boss = new BossFight(story, this.seed);
    this.sim.targets.push({ id: 'board', rect: this.boardRect(), active: false });
    // shooting a node takes its reading, the same as E beside it
    for (const st of this.room.stations) if (st.kind === 'node') this.sim.targets.push({ id: `node:${st.arg}`, rect: { x: st.x - 16, y: st.y - 74, w: 32, h: 56 }, active: true });
    // the card's title carries the page's own severity, and the body drops the repeated "PAGER · SEV-n · " prefix
    const page = /^PAGER · (SEV-\d) · (.*)$/s.exec(this.boss.incident.pager);
    this.out.push({ t: 'card', kind: 'pager', title: `PAGER · ${page?.[1] ?? 'SEV-2'}`, lines: [page?.[2] ?? this.boss.incident.pager], button: 'Take the call' });
    this.waiting = true;
  }

  /** Level 27's X arena n (Phase 7 Spec, section 7): a straight fight with the form of one of act n's bosses, no shield,
   * no investigation and no record. */
  private startX(n: 1 | 2 | 3 | 4) {
    const spec = this.room.boss, inc = findIncident(xIncident(profile()?.name ?? '', n));
    if (!spec || !inc) { this.openGate('door', true); return; }
    const story = Director.difficulty() === 'story', form = formFor(inc.id);
    this.xn = n;
    this.boss = new BossFight(story, this.seed, undefined, inc, X_HP);
    this.boss.phase = 'finish';
    this.form = new FormRun({ ...form, name: `X · as ${form.name}` }, spec.rect, story);
    this.rng = rngFor(this.seed);
    this.sim.targets.push({ id: 'board', rect: this.boardRect(), active: true });
    this.say(X_LINES[n]);
  }

  /** X at 0 HP: it slips away and the next door opens; after the last form it leaves the bit. */
  private xBeaten() {
    const n = this.xn, r = this.boardRect();
    this.sim.targets = this.sim.targets.filter((t) => t.id !== 'board');
    for (const e of this.sim.enemies) e.alive = false;
    this.sim.enemies = [];
    this.sim.respawns = [];
    this.form = null;
    this.xn = 0;
    this.out.push({ t: 'shatter', rect: r }, { t: 'sfx', name: 'shatter' }, { t: 'shake', px: 6, ms: 500 });
    // the slip line answers the kill at once, over whatever TAPEOUT was still saying
    this.queue = [];
    this.bubble = null;
    this.say(STORY.ending.slip);
    if (n < 4) { this.openGate('door'); return; }
    this.bit = { x: r.x + r.w / 2, y: r.y + r.h / 2, vy: 0, t: 0 };
    this.say(STORY.ending.bit);
  }

  /** The bit falls to the floor under it; the drone walking into it starts the ending. */
  private stepBit() {
    const b = this.bit;
    if (!b || this.fade) return;
    b.t++;
    const floor = Math.min(...this.room.solids.filter((s) => s.x <= b.x && s.x + s.w >= b.x && s.y >= b.y).map((s) => s.y), this.room.h) - 10;
    b.vy = Math.min(12, b.vy + 0.4);
    b.y = Math.min(floor, b.y + b.vy);
    if (b.y >= floor) b.vy = 0;
    if (overlaps(droneRect(this.sim.drone), { x: b.x - 10, y: b.y - 10, w: 20, h: 20 })) {
      this.bit = null;
      this.out.push({ t: 'sfx', name: 'fanfare' });
      this.go(this.place, this.index + 1);
    }
  }

  /** The ending room: black, then the timed steps (story/ending.ts). */
  private startEnding() {
    this.cut = { kind: 'ending', t: 0, step: 0 };
    this.out.push({ t: 'music', track: 'ending' });
  }

  /** The ending's last step done: the ENDING card, then the Loft. */
  private endingCard() {
    const e = STORY.ending.card;
    this.out.push({ t: 'card', kind: 'info', title: e.title, lines: [...e.lines], button: e.button });
    this.waiting = true;
  }

  boardRect(): Rect {
    if (this.room.boss) return { ...this.room.boss.rect };
    const b = this.room.props2!.find((p) => p.kind === 'board')!;
    return { x: b.x - b.w! / 2, y: b.y - b.h! / 2, w: b.w!, h: b.h! };
  }

  // --- gates ---
  openGate(id: string, instant = false) {
    const g = this.rs.gates.get(id);
    if (!g || g.opening) return;
    g.opening = true;
    if (instant) { g.open = 1; setPresent(this.sim.world, g.m, false); return; }
    this.out.push({ t: 'sfx', name: 'door' }, { t: 'shake', px: 2, ms: 300 });
  }
  /** Shut a door again (the discovery puzzles' doors open and close). */
  closeGate(id: string) {
    const g = this.rs.gates.get(id);
    if (!g || !g.opening) return;
    g.opening = false;
    setPresent(this.sim.world, g.m, true);
    this.out.push({ t: 'sfx', name: 'door', gain: 0.5 });
  }
  private removeGate(id: string) {
    const g = this.rs.gates.get(id);
    if (!g) return;
    g.open = 1;
    g.opening = true;
    setPresent(this.sim.world, g.m, false);
    this.sim.targets = this.sim.targets.filter((t) => t.id !== id);
  }
  private stepGates() {
    for (const [id, g] of this.rs.gates) {
      const kind = this.room.gates.find((x) => x.id === id)!.kind;
      if (kind === 'bridge' || kind === 'lift' || kind === 'crust') continue;
      const to = g.opening ? 1 : 0;
      if (g.open === to) continue;
      const v = 1 / frames(kind === 'shutter' ? S.shutterMs : S.doorMs);
      g.open = to > g.open ? Math.min(1, g.open + v) : Math.max(0, g.open - v);
      const k = 1 - (1 - g.open) ** 3;
      moveMover(g.m, g.m.home.x, g.m.home.y - g.m.home.h * k);
      if (g.open >= 1) setPresent(this.sim.world, g.m, false);
    }
  }

  // --- the step ---
  /**
   * One 60 Hz step. Returns the input the sim should see (none during fades, cutscenes and choices), after which the
   * screen calls sim.step and then `after()`.
   */
  before(input: { held: Set<Action>; pressed: Set<Action> }): { held: Set<Action>; pressed: Set<Action> } {
    const blank = { held: new Set<Action>(), pressed: new Set<Action>() };
    if (this.fade) {
      this.fade.t++;
      const half = frames(S.fadeMs);
      if (this.fade.t === half) this.enter(this.fade.to.place, this.fade.to.index);
      if (this.fade.t >= half * 2) this.fade = null;
      return blank;
    }
    const c = this.cut;
    if (c?.kind === 'ending' && !this.waiting && c.step < ENDING.length && input.pressed.size && c.t >= Math.round(SKIP_S * HZ)) this.nextEndingStep();
    if (this.cut || this.waiting || !this.live) return blank;
    if (input.pressed.has('interact')) this.interact();
    if (input.pressed.has('beam') && this.act.beam) { this.beamOn = !this.beamOn; this.out.push({ t: 'sfx', name: 'beam', gain: 0.5 }); }
    if (prefs().autoFire && this.sim.kit.gun && !input.held.has('field')) input.held.add('fire');
    return input;
  }

  after() {
    const rs = this.rs;
    rs.t++;
    this.world.storyClock += 1 / HZ;
    this.stepBubble();
    this.stepCut();
    if (this.fade && this.fade.t < frames(S.fadeMs)) return;
    this.stepTriggers();
    this.stepGates();
    rs.light += (rs.lightTo - rs.light) / Math.max(1, frames(S.lightUpMs) / 4);
    if (Math.abs(rs.lightTo - rs.light) < 0.002) rs.light = rs.lightTo;
    this.stepWires();
    this.stepRoom();
    this.stepTargets();
    this.boss?.step();
    this.stepForm();
    this.stepBit();
    // dying in an X arena restarts that form (Phase 7 Spec, section 7, item 2)
    if (this.xn && this.boss && this.sim.dying === 1) this.boss.hp = this.boss.maxHp;
    this.stepBeam();
    this.updatePrompt();
    this.checkExit();
  }

  /** A composed boss's body attacks while the fight is on (held while a card is open or before the pager closes). */
  private stepForm() {
    const f = this.form, b = this.boss, room = this.room;
    if (!f || !b || !room.boss) return;
    const s = this.sim;
    const c: AttackCtx = {
      rand: this.rng, story: Director.difficulty() === 'story', drone: droneRect(s.drone), trail: f.trail,
      arena: { x: 0, y: 0, w: room.w, h: room.h }, boss: room.boss.rect, floors: [...room.solids, ...room.oneWay],
      shoot: (x, y, vx, vy, n) => s.hostileShot(x, y, vx, vy, n),
      hurt: (r, n) => s.hurtIn(r, n),
      hazard: (r, ms, n) => f.hazard(r, ms, n),
      platform: (r, ms) => f.platform(r, ms),
      sfx: (n) => this.out.push({ t: 'sfx', name: n === 'drop' ? 'bossDrop' : n, gain: 0.8 }),
      lens: s.kit.lens ? Math.round(s.kit.lens * HZ) : 0,
      spawn: (k, x, y) => s.spawnLater(k, x, y),
      soak: (r) => s.soakShots(r),
    };
    // the Synchronizer halves the boss's clock too: its body and attacks step every other step
    if (s.slowT > 0 && s.steps % 2) return;
    f.step(c, b.phase === 'finish' ? 'finish' : b.enraged > 0 ? 'enraged' : 'calm', this.waiting || b.phase === 'pager' || b.phase === 'done');
    this.syncPlatforms(f);
  }

  /** The Bad Call's pushed frames are solid while they last: one mover for each live platform. */
  private formPlatforms = new Map<{ r: Rect; until: number }, Mover>();
  private syncPlatforms(f: FormRun) {
    const w = this.sim.world;
    for (const p of f.platforms) if (!this.formPlatforms.has(p)) this.formPlatforms.set(p, addMover(w, 'boss-frame', p.r));
    for (const [p, m] of this.formPlatforms) {
      if (f.platforms.includes(p)) continue;
      setPresent(w, m, false);
      w.movers = w.movers.filter((x) => x !== m);
      this.formPlatforms.delete(p);
    }
  }

  /** Beam Toggle: the headlamp's long cone follows the aim. */
  private stepBeam() {
    const s = this.sim;
    if (!this.beamOn) { s.lampCone = null; return; }
    const p = s.pivot();
    s.lampCone = { x: p.x, y: p.y, a: Math.atan2(s.aim.y, s.aim.x), half: (UP.beam.halfDeg * Math.PI) / 180, reach: UP.beam.reach };
  }

  private stepTriggers() {
    const d = this.sim.drone;
    for (const tr of this.room.triggers) {
      if (this.rs.fired.has(tr.id) || d.x < tr.x || (tr.y !== undefined && d.y > tr.y)) continue;
      this.rs.fired.add(tr.id);
      // Bit Wall: the Field Coil comes online as the drone walks through the coil gate
      if (this.room.id === 'bit-wall' && tr.id === 'coil') {
        this.discover('coil');
        this.applyKit();
        this.sim.vitals.energy = this.sim.vitals.maxEnergy;
        this.out.push({ t: 'sfx', name: 'fanfare' }, { t: 'shake', px: 3, ms: 250 });
        this.card('upgrade', 'FIELD COIL ONLINE', ['Hold right click to grab a crate.', 'Release to drop it. Hold left click while holding to charge a throw.', 'The coil uses energy, the pink bar.']);
      }
      if (this.room.id === 'boss-door' && tr.id === 'ahead') this.openGate('door');
      this.say(...tr.lines);
    }
  }

  private card(kind: 'upgrade' | 'info' | 'debrief', title: string, lines: string[], stars?: number) {
    this.out.push({ t: 'card', kind, title, lines, stars });
    this.waiting = true;
  }

  /** The screen closed a card. */
  cardClosed() {
    this.waiting = false;
    if (this.cut?.kind === 'ending' && this.cut.step >= ENDING.length) {
      // after the ending (Phase 7 Spec, section 7, item 6): it is kept, and the drone goes home
      if (!this.world.cutscenes.includes('ending')) this.world.cutscenes.push('ending');
      this.save();
      this.cut = null;
      this.go('loft', 0);
      return;
    }
    if (this.boss && this.boss.phase === 'pager') {
      this.boss.phase = 'investigate';
      this.out.push({ t: 'sfx', name: 'bossPhase' });
      this.say(this.bl('pager'), this.bl('readings'), ...(this.room.role ? this.theme?.lines.bossIntro ?? [] : []));
    }
  }

  // --- E ---
  /** Things E can reach right now, nearest first. */
  private reachable(): ({ t: 'terminal'; term: Terminal } | { t: 'station'; st: Station })[] {
    const d = this.sim.drone, near = (x: number, y: number) => Math.abs(x - d.x) <= S.reach && Math.abs(y - (d.y + d.h / 2)) <= 60;
    const out: ({ t: 'terminal'; term: Terminal; dx: number } | { t: 'station'; st: Station; dx: number })[] = [];
    const run = this.room.wire;
    if (run && !this.rs.passed && !this.rs.strip) for (const term of run.terminals) if (near(term.x, term.y)) out.push({ t: 'terminal', term, dx: Math.abs(term.x - d.x) });
    for (const st of this.room.stations) {
      if (!near(st.x, st.y)) continue;
      if (st.kind === 'lever' && !this.rs.passed && !this.room.mechanic) continue; // until the check passes, the lever's spot is a terminal
      if (st.kind === 'node' && (!this.boss || this.boss.phase !== 'investigate')) continue;
      if (st.kind === 'debug' && (!this.boss || this.boss.phase !== 'investigate')) continue;
      if (st.kind === 'lift' && this.room.id === 'workbench' && !this.done('half-adder-v')) continue;
      out.push({ t: 'station', st, dx: Math.abs(st.x - d.x) });
    }
    return out.sort((a, b) => a.dx - b.dx);
  }

  private interact() {
    const it = this.reachable()[0];
    if (!it) return;
    if (it.t === 'terminal') this.touchTerminal(it.term);
    else this.useStation(it.st);
  }

  private updatePrompt() {
    this.prompt = null;
    if (this.cut || this.waiting || this.fade) return;
    const it = this.reachable()[0];
    if (!it) {
      if (this.rs.carrying) this.prompt = { x: this.sim.drone.x, y: this.sim.drone.y - 60, text: 'Carrying a wire · E at a terminal to plug it in' };
      return;
    }
    if (it.t === 'terminal') {
      const has = this.rs.wires.some((w) => w.includes(it.term.pin));
      const text = this.rs.carrying ? (this.rs.carrying === it.term.pin ? 'E  Put the wire down' : 'E  Plug in the wire') : has ? 'E  Unplug the wire' : 'E  Pick up a wire';
      this.prompt = { x: it.term.x, y: it.term.y - 96, text };
      return;
    }
    const st = it.st;
    const verb: Partial<Record<StationKind, string>> = {
      port: 'Plug in', panel: 'Open the patch panel', bench: 'Use the bench', lever: this.rs.levers[st.id] ? 'Switch off' : 'Switch on',
      debug: 'Open the debug port', node: 'Take the reading', archive: 'Open the archive', review: 'Review', board: 'Study',
      map: 'Look at the chip map', crt: 'Use the old desktop', arcade: 'Play', interview: 'Try the door', lift: 'Ride the lift',
    };
    // above the station's name label (render.ts draws each label at these heights), never over its art
    this.prompt = { x: st.x, y: st.y - (STATION_TOP[st.kind] ?? 186) - 24, text: `E  ${verb[st.kind] ?? 'Use'}` };
  }

  // --- wire runs ---
  private touchTerminal(term: Terminal) {
    const rs = this.rs, run = this.room.wire!;
    if (rs.carrying) {
      if (rs.carrying === term.pin) { rs.carrying = null; this.out.push({ t: 'sfx', name: 'wireSnap' }); return; }
      rs.wires = rs.wires.filter((w) => !w.includes(term.pin));
      rs.wires.push([rs.carrying, term.pin]);
      rs.carrying = null;
      rs.ghost = null;
      rs.sinceTry = 0;
      this.out.push({ t: 'sfx', name: 'wirePlug' });
      if (!rs.firstWire) { rs.firstWire = true; recordLabFirstWire(run.level, (Date.now() - rs.openedAt) / 1000); }
      this.evaluate();
      return;
    }
    const w = rs.wires.find((x) => x.includes(term.pin));
    if (w) { rs.wires = rs.wires.filter((x) => x !== w); rs.carrying = w[0] === term.pin ? w[1] : w[0]; }
    else rs.carrying = term.pin;
    this.out.push({ t: 'sfx', name: 'wireGrab' });
  }

  /** After a plug: judge the wiring; a complete loop starts the safety strip's test run. */
  private evaluate() {
    const rs = this.rs, run = this.room.wire!;
    rs.check = check(run, rs.wires);
    if (rs.check.state === 'open') {
      const level = levelOf(run);
      if (level.outputs.every((o) => rs.wires.some((w) => w.includes(`out:${o}`)))) this.say(LINES.openWire);
      return;
    }
    rs.attempts++;
    const v = rs.check.verdict;
    rs.strip = { rows: v.rows.map((r) => r.ok), shown: 0, t: 0, pass: rs.check.state === 'pass', failRow: rs.check.state === 'fail' ? rs.check.row : -1 };
  }

  private stepWires() {
    const rs = this.rs, run = this.room.wire;
    if (!run) return;
    if (rs.spark > 0) rs.spark--;
    // a carried end snaps back past the leash
    if (rs.carrying) {
      const t = run.terminals.find((x) => x.pin === rs.carrying)!, d = this.sim.drone;
      if (Math.hypot(t.x - d.x, t.y - 24 - d.y) > S.leash) { rs.carrying = null; this.out.push({ t: 'sfx', name: 'wireSnap' }); this.say('Too far... it snapped back.'); }
    }
    // the safety strip ticks through the rows
    const st = rs.strip;
    if (st) {
      st.t++;
      if (st.t >= frames(S.rowMs)) {
        st.t = 0;
        const ok = st.rows[st.shown];
        st.shown++;
        this.out.push({ t: 'sfx', name: 'rowTick', gain: ok ? 1 : 0.6 });
        const end = !ok || st.shown >= st.rows.length;
        if (end) this.finishStrip(ok && st.pass);
      }
    }
    // timed hints while the run is unsolved
    if (!rs.passed && !rs.strip && this.live) {
      rs.sinceTry++;
      if (rs.sinceTry >= frames(S.hintS * 1000)) {
        rs.sinceTry = 0;
        const hints = WIRE_HINTS[run.level] ?? [];
        if (rs.hintStage < hints.length) this.say(hints[rs.hintStage]);
        else { rs.ghost = nextWire(run, rs.wires) ?? null; if (rs.ghost) this.say('Like... this.'); }
        rs.hintStage++;
      }
    }
  }

  private finishStrip(pass: boolean) {
    const rs = this.rs, run = this.room.wire!;
    rs.strip = null;
    const level = levelOf(run);
    recordLabTest(level.id, pass, rs.attempts);
    if (!pass) {
      rs.spark = frames(S.sparkMs);
      this.failRow = run && rs.attempts ? Math.max(0, (rs.check as { row?: number }).row ?? 0) : 0;
      // the wire plugged last snaps back
      rs.wires.pop();
      rs.check = { state: 'open' };
      this.out.push({ t: 'sfx', name: 'spark' }, { t: 'sfx', name: 'notYet' }, { t: 'shake', px: 2, ms: 200 });
      this.say(LINES.notYetWire);
      return;
    }
    rs.passed = true;
    const ghostUsed = rs.hintStage > (WIRE_HINTS[run.level]?.length ?? 0) ? 1 : 0;
    award(level.id, level.xp, runStars(run, (rs.check as { verdict: Parameters<typeof runStars>[1] }).verdict, ghostUsed));
    this.out.push({ t: 'sfx', name: 'pass' });
    this.reward(level.id);
  }

  /** A module passed in this room: the room's reward, the kit, the lines. */
  reward(module: string) {
    const rs = this.rs;
    this.applyKit(true);
    if (this.room.role) { this.rewardRole(module); return; }
    const panel = ['first-wire', 'first-not', 'first-and', 'logic-half', 'inc-demo-board', 'half-adder-v'].indexOf(module);
    if (panel >= 0) this.out.push({ t: 'sfx', name: 'fanfare', gain: 0.8 });
    switch (module) {
      case 'first-wire':
        rs.lightTo = 1;
        this.out.push({ t: 'sfx', name: 'lightsOn' });
        this.say(LINES.lampLit, LINES.toolArm);
        this.card('upgrade', 'PULSE PROBE ONLINE', ['Hold left click to fire.', 'The Headlamp is on too: you can see further now.', `Repaired: ${PANEL_NAMES[0]} panel.`]);
        break;
      case 'bits':
        rs.lamps = 8;
        rs.passed = true;
        this.openGate('shutter');
        this.say(LINES.bitsPass);
        break;
      case 'bool':
        rs.passed = true;
        this.openGate('power');
        this.say(LINES.boolPass);
        break;
      case 'first-not':
        this.say(LINES.notPass);
        this.card('upgrade', 'LIFT POWERED', ['Stand on the lift to ride it up.', `Repaired: ${PANEL_NAMES[1]} panel.`]);
        break;
      case 'first-and':
        this.say(LINES.andPass);
        this.card('upgrade', 'GRIP SERVOS', ['The Field Coil can lift heavier crates now: up to mass 5.', 'Flip both levers to run the bridge.', `Repaired: ${PANEL_NAMES[2]} panel.`]);
        break;
      case 'logic-half':
        rs.passed = true;
        rs.lightTo = 1;
        this.openGate('door');
        this.out.push({ t: 'sfx', name: 'lightsOn' });
        this.say(LINES.halfPass);
        this.card('upgrade', 'ALU BIT 0 · HALF LIT', ['Sum and carry work.', 'The chip map shows bit 0 half lit.', `Repaired: ${PANEL_NAMES[3]} panel.`]);
        break;
      case 'gates':
        break;
      case 'half-adder-v':
        rs.passed = true;
        this.say(LINES.liftOn);
        this.card('upgrade', 'CARRY SHOT', ['Hit the same enemy twice in half a second: the second hit carries +4.', 'The chip map shows bit 0 fully lit.', `Repaired: ${PANEL_NAMES[5]} panel.`]);
        break;
    }
  }

  /** A composed room's module passed: its line, the door when every scored module is in, the upgrade card. */
  private rewardRole(module: string) {
    const rs = this.rs, room = this.room;
    const st = room.stations.find((s) => s.module === module);
    const line = st?.kind === 'gate' ? STORY.gatePass : st?.kind === 'bench' ? STORY.benchPass : st?.kind === 'panel' ? STORY.panelPass : STORY.portPass;
    this.say(line);
    const scored = room.modules.filter((m) => !room.optional?.includes(m));
    if (!rs.passed && scored.length && scored.every(this.done)) {
      rs.passed = true;
      rs.powered = rs.t;
      this.openGate('door');
    }
    const u = upgradeFor(module);
    if (!u) return;
    if (room.upgrade === u.id) rs.partFly = rs.t;
    const plates = u.id === 'nand-plating' ? u.source.filter(this.done).length : 0;
    this.out.push({ t: 'sfx', name: 'fanfare', gain: 0.8 });
    this.card('upgrade', u.name.toUpperCase(), [
      u.effect,
      ...(plates ? [`Plate ${plates} of ${u.source.length}.`] : []),
      ...(this.theme?.lines.rooms[`upgrade:${u.id}`] ?? [STORY.upgradeGeneric]).slice(0, 1),
      `Repaired: ${placeById(this.place)?.region ?? 'the chip'}.`,
    ]);
  }

  // --- room mechanics ---
  private stepRoom() {
    const rs = this.rs, d = this.sim.drone, room = this.room;
    if (room.role) { this.stepRole(); return; }
    switch (room.id) {
      case 'gate-hall': {
        if (rs.latched) break;
        const plates = room.dplates!;
        const feet = { ...droneRect(d), y: d.y + d.h / 2 - 2, h: 6 };
        const down = plates.map((p) => overlaps(feet, { x: p.x, y: p.y - 4, w: p.w, h: p.h + 4 }) || this.sim.world.props.some((pr) => !pr.held && overlaps(boundsRect(pr.body), { x: p.x, y: p.y - 6, w: p.w, h: p.h + 6 })));
        const was = this.plates;
        this.plates = down;
        down.forEach((on, i) => { if (on && !was[i]) this.out.push({ t: 'sfx', name: 'plate' }); });
        rs.plateT = down.every(Boolean) ? rs.plateT + 1 : 0;
        if (rs.plateT >= frames(S.plateHoldMs)) {
          rs.latched = true;
          this.discover('both-plates');
          this.openGate('door');
          this.say(LINES.latched);
        } else if (!rs.nudged && rs.t > frames(S.nudgeS * 1000)) {
          rs.nudged = true;
          this.say(LINES.nudge);
        }
        break;
      }
      case 'lift-shaft': {
        const g = rs.gates.get('lift')!, lift = room.gates[0].rect, top = 260;
        const on = d.grounded && d.x > g.m.rect.x - 10 && d.x < g.m.rect.x + g.m.rect.w + 10 && Math.abs(d.y + d.h / 2 - g.m.rect.y) < 6;
        this.liftOccupied = on;
        if (!rs.passed) break;
        const to = on ? 1 : 0, v = 1 / (S.liftS * HZ);
        const prev = rs.lift;
        rs.lift = to > rs.lift ? Math.min(1, rs.lift + v) : to < rs.lift ? Math.max(0, rs.lift - v) : rs.lift;
        if (rs.lift !== prev) {
          const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
          const y = lift.y - (lift.y - top) * ease(rs.lift), dy = y - g.m.rect.y;
          moveMover(g.m, lift.x, y);
          if (on) { Matter.Body.translate(d.body, { x: 0, y: dy }); d.y += dy; }
          if (rs.t % 20 === 0) this.out.push({ t: 'sfx', name: 'liftHum', gain: 0.5 });
        }
        break;
      }
      case 'twin-motors': {
        if (!rs.passed) break;
        const want = rs.levers['lever-a'] && rs.levers['lever-b'] ? 1 : 0;
        const onBridge = d.grounded && d.x > 900 && d.x < 1540;
        if (want === rs.bridge || (want === 0 && onBridge)) break; // settled, or never pull the bridge out from under the drone
        const prev = rs.bridge;
        rs.bridge = want > rs.bridge ? Math.min(1, rs.bridge + 1 / frames(S.bridgeMs)) : Math.max(0, rs.bridge - 1 / frames(S.bridgeMs));
        if (rs.bridge !== prev) { this.setBridge(); if (rs.t % 12 === 0) this.out.push({ t: 'sfx', name: 'liftHum', gain: 0.4 }); }
        break;
      }
      case 'first-fight': {
        if (rs.cleared) break;
        // the Glitches are the fight; floaters and spikes are the room's hazards
        const glitches = this.sim.enemies.filter((e) => e.kind === 'glitch');
        if (glitches.length && glitches.every((e) => !e.alive)) {
          rs.cleared = true;
          this.clear('first-fight');
          this.openGate('door');
          this.say(LINES.clear);
        }
        break;
      }
    }
  }
  plates: boolean[] = [];
  liftOccupied = false;

  /** Composed rooms, by role: fights clear, boss doors open, puzzles run. */
  private stepRole() {
    const rs = this.rs, room = this.room;
    if (room.role === 'bossdoor' && !room.modules.length && rs.t === frames(DOOR_WAIT_MS)) this.openGate('door');
    if (room.role === 'fight' && !rs.cleared) {
      const foes = this.sim.enemies.filter((e) => e.kind !== 'spike');
      if (foes.length && foes.every((e) => !e.alive && !racerPending(e))) {
        rs.cleared = true;
        this.clear(room.id);
        this.openGate('door');
        const lines = this.theme?.lines.clear ?? STORY.fightClear;
        this.say(lines[rs.t % lines.length]);
      }
    }
    const m = rs.mech;
    if (m && !m.solved) {
      m.def.step(m.state, this.mechCtx(m));
      m.used = null;
      m.hits = [];
      if (!m.solved && !m.nudged && rs.t > frames(S.nudgeS * 1000)) { m.nudged = true; this.say(m.def.nudge); }
    }
  }

  /** What a discovery puzzle sees and can do this step. */
  private mechCtx(m: NonNullable<RoomState['mech']>) {
    const d = this.sim.drone, rs = this.rs;
    const gate = (id: string) => rs.gates.get(id);
    return {
      t: rs.t, story: Director.difficulty() === 'story', drone: droneRect(d), grounded: d.grounded,
      props: this.sim.world.props.filter((p) => !p.held && p.kind !== 'debris').map((p) => boundsRect(p.body)),
      used: m.used, hit: m.hits,
      rect: (id: string) => ({ ...(gate(id)?.m.rect ?? { x: 0, y: 0, w: 0, h: 0 }) }),
      move: (id: string, x: number, y: number) => {
        const g = gate(id);
        if (!g) return;
        const r = g.m.rect, on = d.grounded && d.x > r.x - 10 && d.x < r.x + r.w + 10 && Math.abs(d.y + d.h / 2 - r.y) < 6;
        const dx = x - r.x, dy = y - r.y;
        moveMover(g.m, x, y);
        if (on) { Matter.Body.translate(d.body, { x: dx, y: dy }); d.x += dx; d.y += dy; }
      },
      open: (id: string) => this.openGate(id),
      close: (id: string) => this.closeGate(id),
      sfx: (n: 'lever' | 'plate' | 'rowTick' | 'door' | 'liftHum' | 'pass') => this.out.push({ t: 'sfx', name: n, gain: n === 'liftHum' ? 0.4 : 1 }),
      say: (line: string) => this.say(line),
      warp: (x: number, y: number, vx = 0, vy = 0) => {
        Matter.Body.setPosition(d.body, { x, y });
        Matter.Body.setVelocity(d.body, { x: vx / HZ, y: vy / HZ });
        d.x = x;
        d.y = y;
      },
      hurt: (n: number) => this.sim.hurtIn(droneRect(d), n),
      solve: () => {
        if (m.solved) return;
        m.solved = true;
        this.discover(`${this.place}:${this.room.mechanic}`);
        this.openGate('exit');
        this.out.push({ t: 'sfx', name: 'pass' });
      },
    };
  }

  // --- read by the renderer ---
  /** A module has a record (the stations glow green once passed). */
  kitDone(id: string) { return this.done(id); }
  /** The safety strip's rows: each input combination and the output it must give. */
  stripRows(): { ins: string; out: string }[] {
    const l = levelOf(this.room.wire!);
    if (l.spec.kind !== 'table') return [];
    const fn = l.spec.fn;
    return combos(l.inputs).map((b) => ({ ins: l.inputs.map((n) => b[n]).join(''), out: l.outputs.map((o) => fn(b)[o]).join('') }));
  }
  /** The row the last failed test run stopped on, for the strip's red lamp while the spark lasts. */
  failRow = -1;
  /** What a terminal shows: a lever's or sensor's value, and what reaches a lamp once the run has passed. */
  terminalValue(tm: Terminal): 0 | 1 | null {
    const rs = this.rs;
    const lever = (pin: string) => (rs.levers[pin === 'in:a' ? 'lever-a' : 'lever-b'] ? 1 : 0);
    const src = (pin: string): 0 | 1 => (this.room.id === 'twin-motors' ? lever(pin) : this.room.id === 'lift-shaft' ? (this.liftOccupied ? 0 : 1) : 1);
    if (tm.role === 'source') return this.room.id === 'twin-motors' || this.room.id === 'lift-shaft' ? src(tm.pin) : null;
    if (tm.role === 'sink' && rs.passed) {
      if (this.room.id === 'twin-motors') return (lever('in:a') & lever('in:b')) as 0 | 1;
      if (this.room.id === 'lift-shaft') return this.liftOccupied ? 1 : 0;
      return 1;
    }
    return null;
  }

  private setBridge() {
    const n = this.room.gates.filter((g) => g.kind === 'bridge').length;
    this.room.gates.forEach((g) => {
      if (g.kind !== 'bridge') return;
      const i = Number(g.id.slice(6));
      setPresent(this.sim.world, this.rs.gates.get(g.id)!.m, this.rs.bridge * n > i + 0.5);
    });
  }

  private stepTargets() {
    for (const h of this.sim.targetHits) {
      if (h.id === 'board') { this.hitBoard(h.n); continue; }
      if (h.id.startsWith('node:')) { if (this.room.role) this.shootNode(h.id.slice(5)); else this.takeReading(h.id.slice(5)); continue; }
      if (this.rs.mech) { this.rs.mech.hits.push(h.id); continue; }
      const g = this.rs.gates.get(h.id);
      if (!g || g.open >= 1) continue;
      const before = g.hp;
      g.hp -= h.n;
      if (before > S.crustHp / 2 && g.hp <= S.crustHp / 2) this.out.push({ t: 'sfx', name: 'crack' });
      if (g.hp <= 0) {
        this.out.push({ t: 'shatter', rect: { ...g.m.rect } }, { t: 'sfx', name: 'shatter' }, { t: 'shake', px: 4, ms: 200 });
        this.removeGate(h.id);
        this.clear(h.id);
      }
    }
  }

  private checkExit() {
    const d = this.sim.drone, ex = this.room.exit;
    if (this.place === 'loft' || this.room.role === 'exit' || this.fade || this.cut || d.x < ex.x || (ex.y !== undefined && d.y > ex.y)) return;
    if (this.index + 1 >= this.roomsFor(this.place).length) return;
    this.go(this.place, this.index + 1);
  }

  // --- stations ---
  private useStation(st: Station) {
    if (this.room.role && st.module && (st.kind === 'port' || st.kind === 'panel' || st.kind === 'bench' || st.kind === 'gate')) {
      // a composed room's station opens its module where it lives: the terminal, or the lab window
      this.out.push({ t: 'sfx', name: 'portOpen' }, { t: 'overlay', kind: 'module', module: st.module });
      this.waiting = true;
      return;
    }
    switch (st.kind) {
      case 'port':
        this.out.push({ t: 'sfx', name: 'portOpen' }, { t: 'overlay', kind: 'port', module: st.module! });
        this.waiting = true;
        break;
      case 'panel':
      case 'bench':
        this.out.push({ t: 'sfx', name: 'portOpen' }, { t: 'overlay', kind: st.kind, module: st.module! });
        this.waiting = true;
        break;
      case 'lever':
        this.rs.levers[st.id] = !this.rs.levers[st.id];
        if (this.rs.mech) this.rs.mech.used = st.id;
        this.out.push({ t: 'sfx', name: 'lever' });
        break;
      case 'node':
        this.useNode(st.arg!);
        break;
      case 'debug':
        this.openCauses();
        break;
      case 'hatch': {
        // a Deep Layer hatch (Phase 4 Spec, section 3): down to its landing, or back up to the exit above it
        const to = st.arg && placeById(st.arg);
        if (!to) break;
        // a hatch down into a place that is not open yet stays shut (Phase 5 Spec, section 3); the way back up never is
        const down = PLACES.findIndex((p) => p.id === to.id) > PLACES.findIndex((p) => p.id === this.place);
        if (down && !openPlaces(this.done).some((p) => p.id === to.id)) {
          const need = to.after.map((id) => placeById(id)).find((q) => !!q && !placeDone(q, this.done));
          this.say(STORY.hatchLocked.replace('{place}', need?.name ?? to.name));
          break;
        }
        this.out.push({ t: 'sfx', name: 'door', gain: 0.6 });
        this.go(to.id as Place, to.kind === 'deep' && this.place !== to.id && this.room.role === 'exit' ? 0 : roomsOf(to.id).length - 1);
        break;
      }
      case 'rail':
        if (this.room.rails?.[Number(st.arg ?? 0)]) this.sim.ride(this.room.rails[Number(st.arg ?? 0)]);
        else this.say(STORY.railLocked);
        break;
      case 'lift':
        if (this.room.id === 'workbench') this.startExitLift(1140);
        else if (this.room.role === 'exit' || this.room.role === 'landing') this.startExitLift(st.x);
        else {
          this.liftOpts = liftChoices(this.done);
          this.out.push({ t: 'choose', kind: 'loftLift', title: 'THE LIFT', options: [...this.liftOpts.map((o) => ({ text: o.text, dim: o.dim })), { text: 'Stay in the Loft' }] });
          this.waiting = true;
        }
        break;
      default: {
        const line = LOFT_LINES[st.kind];
        if (line) this.say(line);
        this.out.push({ t: 'loft', station: st.kind });
        if (st.kind !== 'interview' && st.kind !== 'crt') this.waiting = true;
      }
    }
  }

  /** E at a node, or a shot into it: an instrument with arguments asks which, one without reads at once. */
  private useNode(cmd: string) {
    const ins = this.boss?.incident.instruments.find((i) => i.cmd === cmd);
    if (!this.boss || this.boss.phase !== 'investigate' || !ins) return;
    if (!ins.args?.length) { this.takeReading(cmd); return; }
    this.nodeCmd = cmd;
    this.out.push({ t: 'choose', kind: 'node', title: `${cmd.toUpperCase()} · WHERE?`, options: ins.args.map((a) => ({ text: a, dim: this.boss!.log.some((r) => r.key === `${cmd} ${a}`) })) });
    this.waiting = true;
  }

  /** A shot into a node reads its next argument not yet read (no card mid-fight). */
  private shootNode(cmd: string) {
    const ins = this.boss?.incident.instruments.find((i) => i.cmd === cmd);
    if (!ins) return;
    if (!ins.args?.length) { this.takeReading(cmd); return; }
    const next = ins.args.find((a) => !this.boss!.log.some((r) => r.key === `${cmd} ${a}`)) ?? ins.args[0];
    this.takeReading(`${cmd} ${next}`);
  }

  /** The screen closed an overlay. `passed`: the module's record appeared or improved while it was open. */
  overlayClosed(module: string, passed: boolean) {
    this.waiting = false;
    this.applyKit(true);
    if (passed) { this.out.push({ t: 'sfx', name: 'pass' }); this.reward(module); }
    else if (this.room.role === 'gate' && !this.done(module)) this.say(STORY.gateLocked.replace(/^\{score\}% so far\. /, ''));
  }

  /** Bit Wall: a correct answer in the port lights the next lamp. */
  lampOn() {
    if (this.room.id !== 'bit-wall' || this.rs.lamps >= 8) return;
    this.rs.lamps++;
    this.out.push({ t: 'sfx', name: 'rowTick' });
  }

  // --- the boss ---
  private takeReading(arg: string) {
    const b = this.boss;
    if (!b) return;
    const r = b.read(arg);
    if (!r) return;
    this.lastReading = { arg, text: r.text, ruledOut: r.ruledOut.map((id) => b.incident.causes.find((c) => c.id === id)!.name), age: 0, repeat: r.repeat, left: r.left };
    this.out.push({ t: 'sfx', name: 'reading' });
    if (!r.repeat && r.left === 1) this.say(this.bl('oneFits'));
    if (b.inv.left <= 0) this.bossLate();
  }
  lastReading: { arg: string; text: string; ruledOut: string[]; age: number; repeat: boolean; left: number } | null = null;

  private openCauses() {
    const b = this.boss!;
    this.say(this.bl('pickCause'));
    this.out.push({ t: 'choose', kind: 'cause', title: 'ROOT CAUSE', options: b.causes().map((c) => ({ text: c.out ? `${c.name} (wrong call)` : c.struck ? `${c.name} (crossed off)` : c.name, dim: c.out || c.struck })) });
    this.waiting = true;
  }

  /** The screen picked an option on a choice card (or -1 for "back"). */
  chose(kind: Choice, i: number) {
    this.waiting = false;
    const b = this.boss;
    if (kind === 'loftLift') {
      const o = this.liftOpts[i];
      if (!o) return; // "Stay in the Loft", or back
      if (o.dim) { this.say(o.text.split(' · ')[1] ? `${o.text.split(' · ')[1]} first.` : 'Not yet.'); return; }
      if (placeById(o.place)?.kind === 'study') { this.say(LINES.board); this.out.push({ t: 'loft', station: 'board' }); this.waiting = true; return; }
      this.say(STORY.liftNext.replace('{place}', placeById(o.place)?.name ?? o.place));
      this.go(o.place, 0);
      return;
    }
    if (kind === 'node') {
      const cmd = this.nodeCmd, arg = cmd ? this.boss?.incident.instruments.find((x) => x.cmd === cmd)?.args?.[i] : undefined;
      this.nodeCmd = null;
      if (cmd && arg) this.takeReading(`${cmd} ${arg}`);
      return;
    }
    if (!b || i < 0) return;
    if (kind === 'cause' || kind === 'guard') {
      const pick = kind === 'guard' ? this.pendingCause! : b.causes()[i].id;
      if (kind === 'guard' && i !== 1) return; // "Take another reading"
      const fits = b.fits();
      if (kind === 'cause' && fits.length > 1 && fits.includes(pick)) {
        this.pendingCause = pick;
        this.out.push({ t: 'choose', kind: 'guard', title: `${fits.length} CAUSES STILL FIT EVERY READING`, options: [{ text: 'Take another reading' }, { text: 'Diagnose anyway' }] });
        this.waiting = true;
        return;
      }
      const res = b.diagnose(pick);
      if (res === 'wrong') { this.say(this.bl('angry')); this.out.push({ t: 'sfx', name: 'notYet' }, { t: 'shake', px: 4, ms: 300 }); this.sim.enemies.forEach((e) => (e.flash = 8)); }
      else if (res === 'late') this.bossLate();
      else if (res === 'guessed') { this.say(this.bl('sentBack')); this.card('debrief', 'SENT BACK BY THE REVIEW BOARD', [`It was: ${b.inv.cause.name}.`, b.inv.missed ? `What would have proved it: ${b.inv.missed.ins.cmd} ${b.inv.missed.arg}. It splits the causes your readings still allowed.` : 'One more reading would have proved it.', 'The board goes dark again, with a new fault. Prove it this time.']); b.restart(); }
      else {
        this.out.push({ t: 'sfx', name: 'bossPhase' });
        this.out.push({ t: 'choose', kind: 'fix', title: 'WHICH FIX GOES IN?', options: b.fixes().map((o) => ({ text: o.text })) });
        this.waiting = true;
      }
      return;
    }
    if (kind === 'fix') {
      const res = b.fix(i);
      if (res === 'right') {
        this.sim.targets.find((t) => t.id === 'board')!.active = true;
        this.say(this.bl('shieldDown'), this.bl('finish'));
        this.out.push({ t: 'sfx', name: 'bossPhase' }, { t: 'shake', px: 5, ms: 400 });
      } else if (res === 'late') this.bossLate();
      else {
        this.sim.targets.find((t) => t.id === 'board')!.active = true;
        this.say(this.bl('shieldSoon'));
        this.out.push({ t: 'sfx', name: 'notYet' });
        this.out.push({ t: 'choose', kind: 'fix', title: 'THAT DID NOT HOLD · WHICH FIX GOES IN?', options: b.fixes().map((o) => ({ text: o.text })) });
        this.waiting = true;
      }
    }
  }
  private pendingCause: string | null = null;

  /** A boss line: Level 1 keeps its own script, every other arena the generic full voice (and its theme's). */
  private bl(k: 'pager' | 'readings' | 'oneFits' | 'pickCause' | 'angry' | 'sentBack' | 'shieldDown' | 'finish' | 'shieldSoon' | 'tooSlow' | 'lit'): string {
    if (!this.room.role) return LINES[k];
    const m = { pager: 'bossPager', readings: 'bossReadings', oneFits: 'bossOneFits', pickCause: 'bossPickCause', angry: 'bossWrong', sentBack: 'bossSentBack', shieldDown: 'bossShieldDown', finish: 'bossFinish', shieldSoon: 'bossShieldSoon', tooSlow: 'bossTooSlow', lit: 'bossBeaten' } as const;
    return STORY[m[k]];
  }

  private bossLate() {
    const b = this.boss!;
    this.say(this.bl('tooSlow'));
    this.card('debrief', 'OUT OF BENCH TIME', [`It was: ${b.inv.cause.name}.`, 'The open day is tomorrow and the clock ran out. The board goes dark again with a new fault.', 'Let one more reading settle it before you commit.']);
    b.restart();
    this.sim.targets.find((t) => t.id === 'board')!.active = false;
  }

  private hitBoard(n: number) {
    const b = this.boss;
    if (!b) return;
    if (b.phase !== 'finish' && b.tempDown <= 0) { this.out.push({ t: 'sfx', name: 'reading', gain: 0.3 }); return; }
    if (b.phase !== 'finish' && b.tempDown <= 1) this.sim.targets.find((t) => t.id === 'board')!.active = false;
    if (this.form) this.form.flash = 8;
    if (!b.hit(n)) return;
    if (this.xn) { this.xBeaten(); return; }
    // beaten: the board lights, the record is written, the debrief
    const st = b.stars();
    const inv = b.inv;
    const { gained } = st ? award(inv.inc.id, inv.inc.xp, st) : { gained: 0 };
    this.sim.targets = this.sim.targets.filter((t) => t.id !== 'board');
    for (const e of this.sim.enemies) e.alive = false;
    this.sim.enemies = [];
    this.sim.respawns = [];
    const composed = !!this.room.role;
    this.form = null;
    this.out.push({ t: 'sfx', name: 'shatter' }, { t: 'sfx', name: 'fanfare' }, { t: 'shake', px: 6, ms: 500 }, { t: 'music', track: composed ? this.theme?.music ?? 'keeper' : 'keeper' });
    if (composed) this.say(STORY.bossBeaten, ...(this.theme?.lines.bossBeaten ?? []));
    else this.say(LINES.lit);
    this.openGate('door');
    this.applyKit(true);
    const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
    this.card('debrief', st ? 'INCIDENT RESOLVED' : 'RESOLVED, BUT LATE', [
      `${hm(inv.spent)} used of ${hm(inv.inc.budget)} · ${inv.notes.size} readings · ${inv.mistakes} wrong calls · a careful expert: about ${hm(b.expertMinutes())} · ${gained ? `+${gained} XP` : 'no new XP'}`,
      `What happened: ${inv.cause.story}`,
      `The fix: ${inv.cause.fix}`,
      `Your path: ${[...inv.notes.keys()].join(' → ') || 'straight to a diagnosis'}`,
      composed ? `Upgrade: +${UP.bossIntegrity} integrity. Repaired: ${placeById(this.place)?.region ?? 'the chip'}.` : `Upgrade: integrity ${TUNING.vitals.health} → ${S.bossIntegrity}. Repaired: ${PANEL_NAMES[4]} panel.`,
    ], st);
  }

  // --- cutscenes ---
  private startExitLift(x: number) {
    this.cut = { kind: 'exitLift', t: 0, x };
    this.out.push({ t: 'sfx', name: 'liftHum' }, { t: 'music', track: 'loft' });
  }
  private stepCut() {
    const c = this.cut;
    if (!c) return;
    c.t++;
    if (c.kind === 'exitLift') {
      const T = frames(S.exitLiftS * 1000);
      // the drone rides the lift up out of the room; TAPEOUT's voice comes back on the way
      if (c.t === 1) { Matter.Body.setPosition(this.sim.drone.body, { x: c.x, y: this.sim.drone.y }); this.sim.drone.x = c.x; }
      const d = this.sim.drone;
      if (c.t < T * 0.35) { Matter.Body.translate(d.body, { x: 0, y: -1.2 }); d.y -= 1.2; }
      if (c.t === Math.round(T * 0.2)) {
        if (this.place === 'bit-zero') { if (!this.world.cutscenes.includes('exit-lift')) this.world.cutscenes.push('exit-lift'); this.save(); this.applyKit(); this.say(...LINES.exitLift); }
        else this.say(STORY.liftHome);
      }
      if (c.t % 30 === 0) this.out.push({ t: 'sfx', name: 'liftHum', gain: 0.4 });
      if (c.t >= T) { this.cut = null; this.go('loft', 0); }
    }
    if (c.kind === 'ending') {
      if (c.step >= ENDING.length || this.waiting) return;
      const id = ENDING[c.step].id;
      if (id === 'board' && c.t === Math.round(LAMP_AT_S * HZ)) this.out.push({ t: 'sfx', name: 'lightsOn' });
      if (id === 'hello' && c.t % Math.round(TYPE_S * HZ) === 0 && c.t / Math.round(TYPE_S * HZ) <= HELLO.length && HELLO[c.t / Math.round(TYPE_S * HZ) - 1] !== ' ') this.out.push({ t: 'sfx', name: 'chirp', gain: 0.4 });
      if (id === 'face' && c.t === 20) this.out.push({ t: 'sfx', name: 'chirp', gain: 0.6 });
      if (c.t >= stepLen(c.step)) this.nextEndingStep();
    }
  }
  private nextEndingStep() {
    const c = this.cut;
    if (c?.kind !== 'ending') return;
    c.step++;
    c.t = 0;
    if (c.step >= ENDING.length) this.endingCard();
  }

  /** For tests and the recorder: jump straight to a room. */
  warp(place: Place, index: number) {
    this.fade = null;
    this.cut = null;
    this.waiting = false;
    this.enter(place, index);
  }

  /**
   * The Gradient Compass's point (world px): the nearest station in this room whose module has no record yet, or the
   * room's exit once they are all done. Null with no compass, in the Loft, and in an arena.
   */
  compassTarget(): { x: number; y: number } | null {
    const room = this.room;
    if (!this.sim.kit.compass || this.place === 'loft' || room.boss || room.role === 'arena' || room.id === 'arena') return null;
    const d = this.sim.drone;
    let best: Station | null = null, bestD = Infinity;
    for (const st of room.stations) {
      if (!st.module || this.done(st.module)) continue;
      const dist = Math.hypot(st.x - d.x, st.y - d.y);
      if (dist < bestD) { best = st; bestD = dist; }
    }
    if (best) return { x: best.x, y: best.y };
    return { x: room.exit.x, y: room.exit.y ?? d.y };
  }

  /** The Spectrum Visor's bar: the live boss's next attack (null outside a composed arena's live fight). */
  nextAttack(): { progress: number; starting: boolean } | null {
    if (!this.form || !this.bossBar || !this.room.boss) return null;
    return this.form.nextAttack();
  }

  get bossBar() { return this.boss && this.boss.phase !== 'pager' && this.boss.phase !== 'done' ? this.boss : null; }
  get ending() { return this.cut?.kind === 'ending' ? this.cut : null; }
  get exitLift() { return this.cut?.kind === 'exitLift' ? this.cut.t / frames(S.exitLiftS * 1000) : 0; }
}

/** Timed hints for the wire runs (the third time, a ghost wire shows the next connection). */
export const WIRE_HINTS: Record<string, string[]> = {
  'first-wire': ['Pick up the wire at the switch. Press E.', 'Carry it to the lamp. Press E again.'],
  'first-not': ['Sensor... into the NOT. NOT... to the lift.', 'The NOT flips it. Empty lift: 1 in, 0 out.'],
  'first-and': ['Lever A into one AND input. Lever B into the other.', 'Then AND out... to the bridge.'],
};

const LOFT_LINES: Partial<Record<StationKind, string>> = {
  archive: LINES.archive, review: LINES.review, board: LINES.board, map: LINES.map, crt: LINES.crt, arcade: LINES.arcade, interview: LINES.interview,
};

export { BOOT_COLD };

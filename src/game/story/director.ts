// The story director: runs Level 1 room by room around the Sim. It owns the room's story state (wires, plates,
// doors, the lift, the bridge, lamps, lights), TAPEOUT's lines, the E key, rewards, room transitions, the save node and
// the boss. The Sim stays the physics and combat it was; the director sets its kit and reads its target hits.
// No DOM in here: overlays and sound leave as `out` records the game screen turns into windows and noise.
import Matter from 'matter-js';
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
import { BossFight } from './boss';
import { LEVEL1, LOFT } from './level1';
import { blankWorld, kitFor, LOG_CAP, loadWorld, PANEL_NAMES, type Place, saveWorld, type StoryKit, startFor, type WorldSave } from './progress';
import { BOOT_COLD, BOOT_PARTIAL, LINES, PARTIAL_LINES } from './script';
import type { Music, Station, StationKind, StoryRoom, Terminal } from './types';
import { combos } from '../../games/logic/circuit';
import { check, type Check, levelOf, nextWire, runStars, type Wire } from './wirerun';

const S = TUNING.story;

export type StorySfx =
  | 'wireGrab' | 'wirePlug' | 'wireSnap' | 'rowTick' | 'pass' | 'notYet' | 'spark' | 'lever' | 'plate' | 'liftHum'
  | 'portOpen' | 'bossPhase' | 'fanfare' | 'chirp' | 'door' | 'crack' | 'shatter' | 'lightsOn' | 'reading';

export type StoryOut =
  | { t: 'sfx'; name: StorySfx; gain?: number }
  | { t: 'overlay'; kind: 'port' | 'panel' | 'bench' | 'study'; module: string }
  | { t: 'choose'; kind: 'cause' | 'fix' | 'loftLift' | 'guard'; title: string; options: { text: string; dim?: boolean }[] }
  | { t: 'card'; kind: 'pager' | 'upgrade' | 'debrief' | 'info'; title: string; lines: string[]; stars?: number; button?: string }
  | { t: 'loft'; station: StationKind }
  | { t: 'profile' }
  | { t: 'music'; track: Music }
  | { t: 'shake'; px: number; ms: number }
  | { t: 'shatter'; rect: Rect }
  | { t: 'enter' };

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
}

export interface Bubble { text: string; age: number }
export interface Prompt { x: number; y: number; text: string }

type Cut = { kind: 'boot'; lines: string[]; t: number; then: string[] } | { kind: 'exitLift'; t: number } | null;

export class Director {
  place: Place = 'bit-zero';
  index = 0;
  room: StoryRoom = LEVEL1[0];
  sim!: Sim;
  rs!: RoomState;
  world: WorldSave;
  kit!: StoryKit;
  boss: BossFight | null = null;
  out: StoryOut[] = [];
  bubble: Bubble | null = null;
  private queue: string[] = [];
  prompt: Prompt | null = null;
  /** Room fade: steps into the fade, with the room to load at the midpoint. */
  fade: { t: number; to: { place: Place; index: number } } | null = null;
  cut: Cut = null;
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
    const start = startFor(w, done, Object.keys(load().levels).some((k) => !k.startsWith('mini.')));
    this.world = w ?? blankWorld();
    let lines: string[] = [];
    if (start.kind === 'cold') this.bootLines = BOOT_COLD;
    else if (start.kind === 'migrate') {
      this.bootLines = BOOT_PARTIAL;
      this.world.at = start.at;
      for (const d of start.discoveries) this.discover(d);
      lines = PARTIAL_LINES;
    } else this.bootLines = [];
    const at = this.world.at;
    this.enter(at.place, at.place === 'loft' ? 0 : Math.min(at.room, LEVEL1.length - 1));
    if (lines.length) this.say(...lines);
    if (!profile()) this.out.push({ t: 'profile' });
  }

  // --- the save ---
  private save() { saveWorld(this.world, this.store); }
  discover(id: string) {
    const d = this.world.places['bit-zero'].discoveries;
    if (!d.includes(id)) { d.push(id); this.save(); }
  }
  private has(id: string) { return this.world.places['bit-zero'].discoveries.includes(id); }
  private clear(id: string) {
    const c = this.world.places['bit-zero'].cleared;
    if (!c.includes(id)) { c.push(id); this.save(); }
  }
  private cleared(id: string) { return this.world.places['bit-zero'].cleared.includes(id); }
  private done = (id: string) => !!levelRecord(id);

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
    this.place = place;
    this.index = index;
    this.room = place === 'loft' ? LOFT : LEVEL1[index];
    const room = this.room;
    // lines belong to their room: a new room starts quiet
    this.queue = [];
    this.bubble = null;
    this.sim = new Sim(room, (this.seed = (this.seed * 1664525 + 1013904223) >>> 0));
    this.sim.respawnEnemies = room.id === 'arena';
    this.sim.panels = [false, false, false, false, false, false];
    const rs: RoomState = {
      wires: [], carrying: null, check: { state: 'open' }, strip: null, spark: 0, passed: false, attempts: 0, firstWire: false,
      openedAt: Date.now(), hintStage: 0, sinceTry: 0, ghost: null, light: room.dark ? 0 : 1, lightTo: room.dark ? 0 : 1,
      gates: new Map(), plateT: 0, latched: false, nudged: false, lamps: 0, levers: {}, lift: 0, bridge: 0, cleared: false,
      fired: new Set(), t: 0,
    };
    this.rs = rs;
    for (const g of room.gates) {
      const m = addMover(this.sim.world, g.id, g.rect, g.kind !== 'bridge');
      rs.gates.set(g.id, { m, open: 0, opening: false, hp: g.kind === 'crust' ? S.crustHp : 0 });
    }
    this.sim.targets = room.gates.filter((g) => g.kind === 'crust').map((g) => ({ id: g.id, rect: g.rect, active: true }));
    for (const st of room.stations) if (st.kind === 'lever') rs.levers[st.id] = false;
    this.applyKit();
    this.applyPrefs();
    this.restore();
    if (place === 'bit-zero') { this.world.at = { place, room: index }; this.save(); }
    else { this.world.at = { place: 'loft', room: 0 }; this.save(); }
    this.boss = null;
    if (room.id === 'arena') this.startBoss();
    this.out.push({ t: 'enter' }, { t: 'music', track: room.music });
  }

  /** The drone's kit from records: what it can do, and how it looks. */
  applyKit(announce = false) {
    const k = kitFor(this.done, this.world.places['bit-zero'].discoveries, this.world.cutscenes);
    const before = this.kit;
    this.kit = k;
    const s = this.sim;
    s.kit = { gun: k.gun, coil: k.coil, charged: false, grabLimit: k.grabLimit, carryShot: k.carryShot };
    s.drone.abilities = { doubleJump: false, wallLatch: false };
    const v = s.vitals;
    if (v.maxIntegrity !== k.maxIntegrity) { const up = k.maxIntegrity - v.maxIntegrity; v.maxIntegrity = k.maxIntegrity; if (up > 0) v.integrity += up; }
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
    if (rs.passed) rs.check = { state: 'pass', verdict: { ok: true, rows: [], errors: [], count: 0 } };
  }

  /** Start the next room with a fade (the drone walked out, or a lift arrived). */
  go(place: Place, index: number) {
    if (this.fade) return;
    this.fade = { t: 0, to: { place, index } };
    this.out.push({ t: 'sfx', name: 'door', gain: 0.5 });
  }

  private startBoss() {
    if (this.done('inc-demo-board')) { this.openGate('door', true); this.sim.enemies = []; return; }
    this.boss = new BossFight(Director.difficulty() === 'story', this.seed);
    this.sim.targets.push({ id: 'board', rect: this.boardRect(), active: false });
    // shooting a node takes its reading, the same as E beside it
    for (const st of this.room.stations) if (st.kind === 'node') this.sim.targets.push({ id: `node:${st.arg}`, rect: { x: st.x - 16, y: st.y - 74, w: 32, h: 56 }, active: true });
    this.out.push({ t: 'card', kind: 'pager', title: 'PAGER · SEV-3', lines: [this.boss.incident.pager], button: 'Take the call' });
    this.waiting = true;
  }

  boardRect(): Rect {
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
      if (kind === 'bridge' || kind === 'lift' || kind === 'crust' || !g.opening || g.open >= 1) continue;
      g.open = Math.min(1, g.open + 1 / frames(kind === 'shutter' ? S.shutterMs : S.doorMs));
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
    this.out = this.out.filter((o) => o.t === 'enter' || o.t === 'music' || o.t === 'card' || o.t === 'profile' || o.t === 'choose');
    const blank = { held: new Set<Action>(), pressed: new Set<Action>() };
    if (this.fade) {
      this.fade.t++;
      const half = frames(S.fadeMs);
      if (this.fade.t === half) this.enter(this.fade.to.place, this.fade.to.index);
      if (this.fade.t >= half * 2) this.fade = null;
      return blank;
    }
    if (this.cut || this.waiting || !this.live) return blank;
    if (input.pressed.has('interact')) this.interact();
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
    this.updatePrompt();
    this.checkExit();
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
    if (this.boss && this.boss.phase === 'pager') {
      this.boss.phase = 'investigate';
      this.out.push({ t: 'sfx', name: 'bossPhase' });
      this.say(LINES.pager, LINES.readings);
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
      if (st.kind === 'lever' && !this.rs.passed) continue; // until the check passes, the lever's spot is a terminal
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
    this.prompt = { x: st.x, y: st.y - 110, text: `E  ${verb[st.kind] ?? 'Use'}` };
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

  // --- room mechanics ---
  private stepRoom() {
    const rs = this.rs, d = this.sim.drone, room = this.room;
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
        if (this.sim.enemies.length && this.sim.enemies.every((e) => !e.alive)) {
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
      if (h.id.startsWith('node:')) { this.takeReading(h.id.slice(5)); continue; }
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
    if (this.place !== 'bit-zero' || this.fade || d.x < ex.x || (ex.y !== undefined && d.y > ex.y)) return;
    this.go('bit-zero', this.index + 1);
  }

  // --- stations ---
  private useStation(st: Station) {
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
        this.out.push({ t: 'sfx', name: 'lever' });
        break;
      case 'node':
        this.takeReading(st.arg!);
        break;
      case 'debug':
        this.openCauses();
        break;
      case 'lift':
        if (this.room.id === 'workbench') this.startExitLift();
        else this.out.push({ t: 'choose', kind: 'loftLift', title: 'THE LIFT', options: [{ text: 'Replay Bit Zero' }, { text: 'Level 2 · still being built', dim: true }, { text: 'Stay in the Loft' }] }), (this.waiting = true);
        break;
      default:
        this.say(LOFT_LINES[st.kind] ?? '');
        this.out.push({ t: 'loft', station: st.kind });
        if (st.kind !== 'interview' && st.kind !== 'crt') this.waiting = true;
    }
  }

  /** The screen closed an overlay. `passed`: the module's record appeared or improved while it was open. */
  overlayClosed(module: string, passed: boolean) {
    this.waiting = false;
    this.applyKit(true);
    if (passed) { this.out.push({ t: 'sfx', name: 'pass' }); this.reward(module); }
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
    if (!r.repeat && r.left === 1) this.say(LINES.oneFits);
    if (b.inv.left <= 0) this.bossLate();
  }
  lastReading: { arg: string; text: string; ruledOut: string[]; age: number; repeat: boolean; left: number } | null = null;

  private openCauses() {
    const b = this.boss!;
    this.say(LINES.pickCause);
    this.out.push({ t: 'choose', kind: 'cause', title: 'ROOT CAUSE', options: b.causes().map((c) => ({ text: c.out ? `${c.name} (wrong call)` : c.struck ? `${c.name} (crossed off)` : c.name, dim: c.out || c.struck })) });
    this.waiting = true;
  }

  /** The screen picked an option on a choice card (or -1 for "back"). */
  chose(kind: 'cause' | 'fix' | 'loftLift' | 'guard', i: number) {
    this.waiting = false;
    const b = this.boss;
    if (kind === 'loftLift') {
      if (i === 0) this.go('bit-zero', 0);
      else if (i === 1) this.say(LINES.level2);
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
      if (res === 'wrong') { this.say(LINES.angry); this.out.push({ t: 'sfx', name: 'notYet' }, { t: 'shake', px: 4, ms: 300 }); this.sim.enemies.forEach((e) => (e.flash = 8)); }
      else if (res === 'late') this.bossLate();
      else if (res === 'guessed') { this.say(LINES.sentBack); this.card('debrief', 'SENT BACK BY THE REVIEW BOARD', [`It was: ${b.inv.cause.name}.`, b.inv.missed ? `What would have proved it: ${b.inv.missed.ins.cmd} ${b.inv.missed.arg}. It splits the causes your readings still allowed.` : 'One more reading would have proved it.', 'The board goes dark again, with a new fault. Prove it this time.']); b.restart(); }
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
        this.say(LINES.shieldDown, LINES.finish);
        this.out.push({ t: 'sfx', name: 'bossPhase' }, { t: 'shake', px: 5, ms: 400 });
      } else if (res === 'late') this.bossLate();
      else {
        this.sim.targets.find((t) => t.id === 'board')!.active = true;
        this.say(LINES.shieldSoon);
        this.out.push({ t: 'sfx', name: 'notYet' });
        this.out.push({ t: 'choose', kind: 'fix', title: 'THAT DID NOT HOLD · WHICH FIX GOES IN?', options: b.fixes().map((o) => ({ text: o.text })) });
        this.waiting = true;
      }
    }
  }
  private pendingCause: string | null = null;

  private bossLate() {
    const b = this.boss!;
    this.say(LINES.tooSlow);
    this.card('debrief', 'OUT OF BENCH TIME', [`It was: ${b.inv.cause.name}.`, 'The open day is tomorrow and the clock ran out. The board goes dark again with a new fault.', 'Let one more reading settle it before you commit.']);
    b.restart();
    this.sim.targets.find((t) => t.id === 'board')!.active = false;
  }

  private hitBoard(n: number) {
    const b = this.boss;
    if (!b) return;
    if (b.phase !== 'finish' && b.tempDown <= 0) { this.out.push({ t: 'sfx', name: 'reading', gain: 0.3 }); return; }
    if (b.phase !== 'finish' && b.tempDown <= 1) this.sim.targets.find((t) => t.id === 'board')!.active = false;
    if (!b.hit(n)) return;
    // beaten: the board lights, the record is written, the debrief
    const st = b.stars();
    const inv = b.inv;
    const { gained } = st ? award(inv.inc.id, inv.inc.xp, st) : { gained: 0 };
    this.sim.targets = this.sim.targets.filter((t) => t.id !== 'board');
    for (const e of this.sim.enemies) e.alive = false;
    this.sim.enemies = [];
    this.sim.respawns = [];
    this.out.push({ t: 'sfx', name: 'shatter' }, { t: 'sfx', name: 'fanfare' }, { t: 'shake', px: 6, ms: 500 }, { t: 'music', track: 'keeper' });
    this.say(LINES.lit);
    this.openGate('door');
    this.applyKit(true);
    const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
    this.card('debrief', st ? 'INCIDENT RESOLVED' : 'RESOLVED, BUT LATE', [
      `${hm(inv.spent)} used of ${hm(inv.inc.budget)} · ${inv.notes.size} readings · ${inv.mistakes} wrong calls · a careful expert: about ${hm(b.expertMinutes())} · ${gained ? `+${gained} XP` : 'no new XP'}`,
      `What happened: ${inv.cause.story}`,
      `The fix: ${inv.cause.fix}`,
      `Your path: ${[...inv.notes.keys()].join(' → ') || 'straight to a diagnosis'}`,
      `Upgrade: integrity ${TUNING.vitals.health} → ${S.bossIntegrity}. Repaired: ${PANEL_NAMES[4]} panel.`,
    ], st);
  }

  // --- cutscenes ---
  private startExitLift() {
    this.cut = { kind: 'exitLift', t: 0 };
    this.out.push({ t: 'sfx', name: 'liftHum' }, { t: 'music', track: 'loft' });
  }
  private stepCut() {
    const c = this.cut;
    if (!c) return;
    c.t++;
    if (c.kind === 'exitLift') {
      const T = frames(S.exitLiftS * 1000);
      // the drone rides the lift up out of the room; TAPEOUT's voice comes back on the way
      if (c.t === 1) Matter.Body.setPosition(this.sim.drone.body, { x: 1140, y: this.sim.drone.y });
      const d = this.sim.drone;
      if (c.t < T * 0.35) { Matter.Body.translate(d.body, { x: 0, y: -1.2 }); d.y -= 1.2; }
      if (c.t === Math.round(T * 0.2)) { this.world.cutscenes.push('exit-lift'); this.save(); this.applyKit(); this.say(...LINES.exitLift); }
      if (c.t % 30 === 0) this.out.push({ t: 'sfx', name: 'liftHum', gain: 0.4 });
      if (c.t >= T) { this.cut = null; this.go('loft', 0); }
    }
  }

  /** For tests and the recorder: jump straight to a room. */
  warp(place: Place, index: number) {
    this.fade = null;
    this.cut = null;
    this.waiting = false;
    this.enter(place, index);
  }

  get bossBar() { return this.boss && this.boss.phase !== 'pager' && this.boss.phase !== 'done' ? this.boss : null; }
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

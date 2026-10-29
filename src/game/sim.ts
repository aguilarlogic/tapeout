// The simulation: one room, the drone, its weapons and Field Coil, props, enemies, shots, the door and the target
// dummy, advanced in fixed 60 Hz steps. No DOM and no clock in here, so tests drive it step by step with scripted
// controls. Visual and audio feedback leaves as `fx` records that the screen turns into particles, shake and sound.
import Matter from 'matter-js';
import { Glitch, Latch, Spark } from './enemies/bugs';
import { Floater } from './enemies/floater';
import './enemies/all';
import { racerPending } from './enemies/racer';
import { ENEMY } from './enemies/registry';
import { GlitchSpike } from './enemies/spike';
import type { Enemy, EnemyCtx } from './enemies/types';
import type { EnemyKind, Rect, Room } from './level/room';
import { angleTo, inPoly, len, norm, overlaps, segPoly, segRect, type Vec } from './physics/geom';
import { addProp, boundsRect, CAT, createWorld, type Prop, removeProp, setHeld, stepWorld, type World } from './physics/world';
import { type Controls, createDrone, type Drone, droneRect, placeDrone, settleDrone, stepDrone } from './player/drone';
import { createVitals, hurt, spend, tickVitals } from './player/stats';
import { DAMAGE, DRONE, EMITTER, frames, HZ, propDamage, STEP_MS, throwSpeed, TUNING, VITALS } from './tuning';
import { UP } from './world/upgrades';

/** Inverted Grip lifts bugs up to this grip mass. */
const UP_GRIP = UP.gripMass;

const T = TUNING;
const deg = Math.PI / 180;

export interface Shot {
  x: number; y: number;
  vx: number; vy: number; // px/step
  left: number; // steps of life left
  damage: number;
  friendly: boolean;
  kind: 'bolt' | 'charged' | 'orb';
  /** Enemies a charged bolt can still pierce. */
  pierce: number;
  /** Knockback on hit, times the Pulse Probe's (the ALU Cannon hits harder). */
  knockMul: number;
  hit: Set<Enemy>;
  reflected: boolean;
  dead: boolean;
}

export type Weapon = 'pulse' | 'charged' | 'fan' | 'cannon' | 'burst';
export const WEAPONS: Weapon[] = ['pulse', 'charged'];

/** What the Field Coil is doing this step. */
export type FieldState = { on: false } | { on: true; held: Prop | null; charge: number };

/** Feedback for the screen: particles, shake, sound. Positions in world px, velocities in px/s. */
export type Fx =
  | { t: 'shot'; x: number; y: number; dx: number; dy: number; weapon: Weapon }
  | { t: 'hit'; x: number; y: number; dx: number; dy: number; n: number; armored: boolean; enemy: boolean }
  | { t: 'kill'; x: number; y: number; outline: Vec[]; vx: number; vy: number; kind: string }
  | { t: 'orb'; x: number; y: number }
  | { t: 'reflect'; x: number; y: number }
  | { t: 'push'; x: number; y: number }
  | { t: 'grab'; x: number; y: number }
  | { t: 'throw'; x: number; y: number; charge: number }
  | { t: 'drop'; x: number; y: number }
  | { t: 'thud'; x: number; y: number; speed: number }
  | { t: 'jump'; x: number; y: number }
  | { t: 'land'; x: number; y: number; speed: number }
  | { t: 'dash'; x: number; y: number }
  | { t: 'hurt'; x: number; y: number; n: number }
  | { t: 'death'; x: number; y: number }
  | { t: 'respawn'; x: number; y: number }
  | { t: 'door'; x: number; y: number }
  | { t: 'swap'; weapon: Weapon }
  | { t: 'fizzle'; x: number; y: number }
  | { t: 'repair'; panel: number }
  | { t: 'sync'; x: number; y: number }
  | { t: 'rail'; x: number; y: number }
  | { t: 'enemyBoot'; x: number; y: number };

/** Deterministic random numbers (mulberry32), so a test run is the same every time. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the drone has working (Level 1 spec, the drone's kit). The test room has everything. */
export interface Kit {
  gun: boolean;
  coil: boolean;
  /** Q swaps to the Charged Probe only once it exists. */
  charged: boolean;
  /** Heaviest prop the Field Coil can lift; Grip Servos raise it from 3 to 5. */
  grabLimit: number;
  /** Carry Shot: a second hit on the same enemy within 0.5 s deals +4. */
  carryShot: boolean;
  // --- act 1 upgrades (Phase 3 Spec, section 7); left out, the drone works as in Level 1 ---
  /** Weapons Q, the wheel and the number keys cycle through (Selector). Default: the Pulse Probe, and the Charged
   * Probe when `charged`. */
  weapons?: Weapon[];
  /** Pulse Probe damage (Full-Adder Coupling: 12). */
  probeDamage?: number;
  /** Counter Fire: the rate the Pulse Probe climbs to over 4 hits in a row (0 or left out: off). */
  counterTo?: number;
  /** Comparator Sight: weak-point multiplier (left out: no weak points, no health bars). */
  weak?: number;
  /** Enable Lock: the gun is folded away (quiet rooms). */
  holster?: boolean;
  /** Inverted Grip: the Field Coil also grabs enemies of grip mass 3 or less. */
  gripEnemies?: boolean;
  /** Field Coil reach (Inverted Grip Mk II: 108). */
  fieldRadius?: number;
  /** ALU Cannon damage (Mk II: 48). */
  cannonDamage?: number;
  // --- act 2 upgrades (Phase 4 Spec, section 7) ---
  /** Weapon slots the HUD lists and the number keys pick (left out: every owned weapon). Q still cycles them all. */
  slots?: number;
  /** Pipeline Burst: bolts a burst. */
  burstBolts?: number;
  /** Loop Drone: damage a bolt (left out: no companion). */
  loopDrone?: number;
  /** Datapath Rail: ride speed px/s (left out: rails cannot be ridden). */
  rail?: number;
  /** Synchronizer: seconds of slow time on F (left out: no gadget). */
  sync?: number;
}

/** A bus rail (Phase 4 Spec, section 7): the drone hangs RAIL_HANG px under it while it rides. */
export interface RailLine { x1: number; y1: number; x2: number; y2: number }
export const RAIL_HANG = 30;
/** The rail's y at x (a straight line). */
export const railY = (r: RailLine, x: number) => r.y1 + (r.y2 - r.y1) * ((x - r.x1) / (r.x2 - r.x1 || 1));

/** Enemies the sim keeps in its list: the living, and dead Racers their partner can still revive. */
const kept = (e: Enemy) => e.alive || racerPending(e);

/** Walkers take weak-point hits from behind; these take them near the centre. */
const CENTRE_WEAK = new Set(['floater', 'stuckat', 'stuckat0', 'xblob']);

/** A shootable story fixture (an X crust, an instrument node, the boss board). Shots that hit one are reported in
 * `targetHits`; the story decides what they do. */
export interface Target { id: string; rect: Rect; active: boolean }

export type SimEvent = 'hit' | 'shot' | 'kill' | 'block' | 'throw' | 'death' | 'respawn' | 'pit' | 'jump' | 'dash' | 'grab' | 'land' | 'reflect' | 'push';

const SHOT_POOL = 256;

export class Sim {
  world: World;
  drone: Drone;
  vitals = createVitals();
  enemies: Enemy[] = [];
  /** Live shots; dead ones go back to the pool. */
  shots: Shot[] = [];
  private pool: Shot[] = [];
  field: FieldState = { on: false };
  weapon: Weapon = 'pulse';
  /** Charged Probe: 0..1 while left click is held. */
  charge = 0;
  /** Unit vector from the turret pivot toward the aim point. */
  aim: Vec = { x: 1, y: 0 };
  aimAt: Vec = { x: 0, y: 0 };
  steps = 0;
  /** Steps left in the death animation; the drone rebuilds at the save node when it reaches 0. */
  dying = 0;
  /** Steps left of the boot flicker after a respawn. */
  booting = 0;
  lastSafe: Vec;
  events: SimEvent[] = [];
  fx: Fx[] = [];
  /** Six damage panels on the chassis (plan C): true = repaired (decision 23: the test room starts with 4). */
  panels = [true, true, true, true, false, false];
  /** Steps since each panel was repaired, for the repair pulse. */
  panelAge = [999, 999, 999, 999, 999, 999];
  doorOpen = 0; // 0 closed .. 1 open
  /** The bit each input pad reads, or null with nothing on it. */
  padBits: (0 | 1 | null)[] = [];
  /** Target dummy: recent hits as [step, damage], and the last hit. */
  dummyHits: [number, number][] = [];
  dummyLast = 0;
  dummyFlash = 0;
  /** Enemy respawn timers (test room, decision 20). */
  respawns: { kind: EnemyKind; x: number; y: number; t: number }[] = [];
  /** Steps since the drone was last hurt, for animation. */
  hurtAge = 999;
  private fireCd = 0; // ms until the Pulse Probe may fire again
  private fireBuf = 0; // ms left on a buffered press
  private fireWasHeld = false;
  private emitT: number[];
  private pushCd = new Map<Enemy, number>();
  private rand: () => number;
  kit: Kit = { gun: true, coil: true, charged: true, grabLimit: TUNING.field.grabLimit, carryShot: false };
  /** Assists and difficulty: damage taken is scaled (0 = invincible); infinite energy refills the bar each step. */
  assist = { damageScale: 1, infiniteEnergy: false };
  /** Story rooms keep the dead dead; the test room brings enemies back (decision 20). */
  respawnEnemies = true;
  targets: Target[] = [];
  /** This step's hits on targets. */
  targetHits: { id: string; n: number }[] = [];
  /** Carry Shot: the step each enemy was last hit by a bolt. */
  private lastBoltHit = new Map<Enemy, number>();

  /** The act and difficulty enemies are made for (registry kinds scale their HP by both). */
  make: { act: number; story: boolean } = { act: 1, story: false };
  /** Beam Toggle's cone, when the headlamp is in cone mode (the story sets it each step). */
  lampCone: EnemyCtx['lamp']['cone'] = null;
  /** Enemies added during a step (X-Blob children); they join after it. */
  private spawned: Enemy[] = [];
  /** Counter Fire: hits in a row by Pulse bolts (a bolt that expires without a hit resets it). */
  streak = 0;
  /** Inverted Grip: the enemy the field holds, and enemies thrown and still flying (they hurt what they hit). */
  heldEnemy: Enemy | null = null;
  private thrown = new Map<Enemy, number>();
  /** Synchronizer: steps of slow time left, and steps until it can be used again. */
  slowT = 0;
  slowCd = 0;
  /** Pipeline Burst: bolts still to fire in this burst, and ms until the next. */
  private burstLeft = 0;
  private burstT = 0;
  /** Loop Drone: its place on the orbit (radians) and ms until its next bolt; `loopPos` is null while it is hidden. */
  loopAngle = 0;
  private loopCd = 0;
  loopPos: Vec | null = null;
  /** Datapath Rail: the rail being ridden, where along it (x), and which way. */
  riding: { rail: RailLine; x: number; dir: 1 | -1 } | null = null;
  /** Stall Bubble: the drone is inside a field this step (it runs at half speed). */
  stalled = false;
  /** The weapons the drone can switch between now. */
  get weapons(): Weapon[] { return this.kit.weapons ?? (this.kit.charged ? ['pulse', 'charged'] : ['pulse']); }
  /** Weapons in the order they were last picked, most recent first (Phase 4 Spec, section 7: the slot rule). */
  picked: Weapon[] = [];
  /** The slots the HUD shows and the number keys pick: the most recently picked weapons, in the order owned. */
  get slotted(): Weapon[] {
    const ws = this.weapons, n = Math.min(this.kit.slots ?? ws.length, ws.length);
    const keep = [...this.picked.filter((w) => ws.includes(w)), ...ws.filter((w) => !this.picked.includes(w))].slice(0, n);
    return ws.filter((w) => keep.includes(w));
  }

  constructor(public room: Room, seed = 1, make?: { act: number; story: boolean }) {
    if (make) this.make = make;
    this.rand = rng(seed);
    this.world = createWorld(room);
    this.drone = createDrone(this.world, room.spawn.x, room.spawn.y);
    this.lastSafe = { ...room.spawn };
    this.emitT = room.emitters.map(() => EMITTER.period);
    this.padBits = (room.pads ?? []).map(() => null);
    for (let i = 0; i < SHOT_POOL; i++) this.pool.push(blankShot());
    Matter.Events.on(this.world.engine, 'collisionStart', (e) => this.onCollide(e.pairs));
    this.spawnEnemies();
  }

  private spawnEnemies() {
    for (const e of this.enemies) if (e.body) Matter.Composite.remove(this.world.engine.world, e.body);
    this.respawns = [];
    this.enemies = [
      ...this.room.enemies.flatMap((s) => this.makeEnemies(s.kind, s.x, s.y)),
      ...this.room.floaters.map((f) => new Floater(f.x, f.y, { x: f.x, y: f.y }, this.rand)),
      ...this.room.spikes.map((s) => new GlitchSpike(s.x, s.y, s.dir, s.offset)),
    ];
  }

  private gravity = () => { const g = this.world.engine.gravity; return g.y * (g.scale ?? 0.001); };

  makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    return this.makeEnemies(kind, x, y)[0];
  }

  /** The enemies one anchor makes: the test enemies directly, every other kind through the registry. */
  makeEnemies(kind: EnemyKind, x: number, y: number, opts?: { gen?: number; vx?: number; vy?: number }): Enemy[] {
    let made: Enemy[];
    if (kind === 'glitch' || kind === 'spark' || kind === 'latch') made = [kind === 'glitch' ? new Glitch(x, y) : kind === 'spark' ? new Spark(x, y, this.gravity) : new Latch(x, y)];
    else if (kind === 'floater') made = [new Floater(x, y, { x, y }, this.rand)];
    else {
      const entry = ENEMY[kind];
      if (!entry) throw new Error(`no enemy registered for ${kind}`);
      const m = entry.make(x, y, { gravity: this.gravity(), rand: this.rand, ...this.make }, opts);
      made = Array.isArray(m) ? m : [m];
    }
    for (const e of made) {
      if (e.body) Matter.Composite.add(this.world.engine.world, e.body);
      (e as unknown as { spawn: Vec }).spawn = { x, y };
    }
    return made;
  }

  get invulnerable() {
    return this.drone.dash !== null || this.dying > 0 || this.booting > 0;
  }

  /** The turret's pivot on the front shoulder: shots leave from pivot + aim × barrel. */
  pivot(): Vec {
    const d = this.drone;
    return { x: d.x + d.facing * 8, y: d.y - d.h / 2 + 2 };
  }
  muzzle(): Vec {
    const p = this.pivot();
    return { x: p.x + this.aim.x * T.anim.barrel, y: p.y + this.aim.y * T.anim.barrel };
  }
  /** The field's centre: the chassis centre. */
  core(): Vec {
    const d = this.drone;
    return { x: d.x, y: d.y - d.h / 2 + 13 };
  }

  /** Advance one 60 Hz step. `aimAt` is the aim point in world px. */
  step(c: Omit<Controls, 'aim'>, aimAt: Vec) {
    this.events = [];
    this.fx = [];
    this.targetHits = [];
    this.steps++;
    this.hurtAge++;
    const d = this.drone, v = this.vitals;
    const frozen = this.dying > 0;
    this.aimAt = aimAt;
    if (!frozen) d.facing = aimAt.x >= d.x ? 1 : -1; // decision 3: facing follows the cursor's side
    const pv = this.pivot();
    this.aim = norm({ x: aimAt.x - pv.x, y: aimAt.y - pv.y });
    const ctl: Controls = { ...c, aim: this.aim };
    const wasGrounded = d.grounded, fallSpeed = d.vy * HZ;

    const ws = this.weapons;
    if (!ws.includes(this.weapon)) this.weapon = ws[0];
    if (!frozen && ws.length > 1) {
      const slot = (['slot1', 'slot2', 'slot3'] as const).findIndex((a) => c.pressed.has(a));
      const next = c.pressed.has('weapon') ? ws[(ws.indexOf(this.weapon) + 1) % ws.length] : slot >= 0 ? this.slotted[slot] : undefined;
      if (next && next !== this.weapon) {
        this.weapon = next;
        this.picked = [next, ...this.picked.filter((w) => w !== next)];
        this.charge = 0;
        this.fx.push({ t: 'swap', weapon: this.weapon });
      }
    }

    this.stalled = !frozen && this.enemies.some((e) => e.alive && !!e.field && Math.hypot(e.x - d.x, e.y - d.y) < e.field);
    d.slow = this.stalled ? 0.5 : 1;
    this.stepSync(ctl, frozen);
    const r = stepDrone(d, ctl, this.world, v.energy, frozen);
    if (!frozen) d.facing = aimAt.x >= d.x ? 1 : -1;
    if (r.dashed) { spend(v, DRONE.dashEnergy); this.events.push('dash'); this.fx.push({ t: 'dash', x: d.x, y: d.y }); }
    if (r.jumped) { this.events.push('jump'); this.fx.push({ t: 'jump', x: d.x, y: d.y + d.h / 2 }); }
    this.stepField(ctl, frozen);
    const ctx = this.ctx();
    // the Synchronizer halves the enemies' clock: their brains run every other step and their bodies move half as far
    const slow = this.slowT > 0, tick = !slow || this.steps % 2 === 0;
    const before = slow ? this.enemies.map((e) => (e.body ? { x: e.body.position.x, y: e.body.position.y } : null)) : [];
    for (const e of this.enemies) if (tick) e.step(ctx);
    if (this.spawned.length) { this.enemies.push(...this.spawned); this.spawned = []; }
    stepWorld(this.world);
    if (slow) this.enemies.forEach((e, i) => {
      const b = before[i];
      if (b && e.body) Matter.Body.setPosition(e.body, { x: b.x + (e.body.position.x - b.x) * UP.sync.scale, y: b.y + (e.body.position.y - b.y) * UP.sync.scale });
    });
    this.stepRail(ctl, frozen);
    settleDrone(d, this.world, this.room);
    if (!wasGrounded && d.grounded && !frozen) { this.events.push('land'); this.fx.push({ t: 'land', x: d.x, y: d.y + d.h / 2, speed: Math.max(0, fallSpeed) }); }
    if (d.grounded && !d.onOneWay && !this.room.hazards.some((h) => overlaps(droneRect(d), { ...h, y: h.y - 40, h: h.h + 40 }))) {
      this.lastSafe = { x: d.x, y: d.y + d.h / 2 - DRONE.h / 2 };
    }

    this.stepWeapon(ctl, frozen);
    if (!frozen) this.stepBurst();
    this.stepLoopDrone(frozen);
    this.stepThrown();
    this.stepContacts();
    this.stepEmitters();
    this.stepShots();
    this.stepProps();
    this.stepDoorAndPads();
    this.stepHazards();
    this.stepRespawns();
    tickVitals(v);
    if (this.assist.infiniteEnergy) v.energy = v.maxEnergy;
    for (let i = 0; i < 6; i++) this.panelAge[i]++;
    this.booting = Math.max(0, this.booting - 1);
    this.dummyFlash = Math.max(0, this.dummyFlash - 1);
    this.stepDeath();
  }

  private hurtDrone(n: number, from?: Vec) {
    n *= this.assist.damageScale;
    if (n <= 0) return;
    if (!hurt(this.vitals, n, this.invulnerable)) return;
    this.events.push('hit');
    this.hurtAge = 0;
    const d = this.drone;
    this.fx.push({ t: 'hurt', x: d.x, y: d.y, n });
    if (from) {
      const k = norm({ x: d.x - from.x, y: -Math.max(30, Math.abs(d.y - from.y)) });
      d.vx = k.x * DAMAGE.hazardKnock;
      d.vy = k.y * DAMAGE.hazardKnock;
      d.grounded = false;
    }
  }

  private stepDeath() {
    const v = this.vitals;
    if (this.dying > 0) {
      if (--this.dying === 0) {
        placeDrone(this.drone, this.room.spawn.x, this.room.spawn.y);
        v.integrity = v.maxIntegrity;
        v.energy = v.maxEnergy;
        v.iFrames = 0;
        for (const s of this.shots) this.free(s);
        this.shots = [];
        this.dropHeld();
        this.spawnEnemies();
        this.booting = VITALS.bootSteps;
        this.events.push('respawn');
        this.fx.push({ t: 'respawn', x: this.drone.x, y: this.drone.y });
      }
      return;
    }
    if (v.integrity <= 0) {
      this.dying = VITALS.deathSteps;
      this.dropHeld();
      this.events.push('death');
      this.fx.push({ t: 'death', x: this.drone.x, y: this.drone.y });
    }
  }

  // --- Field Coil (plan F): push enemies, reflect shots, grab and throw props ---
  /** Is a point (with a margin for its size) inside the field's arc? */
  inField(p: Vec, margin = 0): boolean {
    if (!this.field.on) return false;
    const o = this.core(), dx = p.x - o.x, dy = p.y - o.y, dist = Math.hypot(dx, dy);
    return dist <= (this.kit.fieldRadius ?? T.field.radius) + margin && (dist < 8 || angleTo(this.aim, { x: dx, y: dy }) <= (T.field.arc / 2) * deg);
  }

  private dropHeld(vel?: Vec) {
    const he = this.heldEnemy;
    if (he?.body) {
      Matter.Body.setVelocity(he.body, vel ?? { x: 0, y: 0 });
      if (vel) this.thrown.set(he, this.steps + frames(1500));
    }
    this.heldEnemy = null;
    if (this.field.on && this.field.held) {
      const p = this.field.held;
      if (vel) Matter.Body.setVelocity(p.body, vel);
      p.held = false;
      p.noDrone = frames(T.field.noDroneMs);
    }
    this.field = { on: false };
  }

  /** The prop under the drone's feet, which it can't grab (plan F). */
  private standingOn(): Prop | null {
    const r = droneRect(this.drone), feet = { x: r.x + 2, y: r.y + r.h - 1, w: r.w - 4, h: 4 };
    return this.world.props.find((p) => !p.held && overlaps(feet, boundsRect(p.body))) ?? null;
  }

  private stepField(c: Controls, frozen: boolean) {
    const v = this.vitals, F = T.field;
    const want = !frozen && this.kit.coil && c.held.has('field') && (this.field.on ? v.energy > 0 : v.energy >= F.reengage);
    if (!want) {
      if (this.field.on && this.field.held) this.fx.push({ t: 'drop', x: this.field.held.body.position.x, y: this.field.held.body.position.y });
      this.dropHeld();
      return;
    }
    if (!this.field.on) this.field = { on: true, held: null, charge: 0 };
    const f = this.field;
    v.energy = Math.max(0, v.energy - (f.held ? F.drainHold : F.drain) / HZ);
    v.sinceSpend = 0;
    if (v.energy <= 0) { this.dropHeld(); return; }
    const o = this.core();
    if (!f.held) {
      // push enemies in the arc out, 15 energy each, at most once per enemy per 0.3 s
      for (const e of this.enemies) {
        if (!e.alive || !e.body) continue;
        const cd = this.pushCd.get(e) ?? 0;
        if (this.steps < cd) continue;
        if (!this.inField(e, e.body.bounds.max.x - e.body.bounds.min.x)) continue;
        const n = norm({ x: e.x - o.x, y: e.y - o.y });
        e.knock({ x: n.x * F.pushSpeed, y: n.y * F.pushSpeed - 120 });
        v.energy = Math.max(0, v.energy - F.pushCost);
        this.pushCd.set(e, this.steps + frames(F.pushCooldownMs));
        this.events.push('push');
        this.fx.push({ t: 'push', x: e.x, y: e.y });
      }
      // grab the nearest loose prop in the arc within the grab limit
      const under = this.standingOn();
      let best: Prop | null = null, bestD = Infinity;
      for (const p of this.world.props) {
        if (p === under || p.mass > this.kit.grabLimit || p.noDrone > 0) continue;
        const pos = p.body.position, dist = Math.hypot(pos.x - o.x, pos.y - o.y);
        if (dist < bestD && this.inField(pos, p.size / 2)) { best = p; bestD = dist; }
      }
      if (best) {
        f.held = best;
        f.charge = 0;
        setHeld(best, true);
        this.events.push('grab');
        this.fx.push({ t: 'grab', x: best.body.position.x, y: best.body.position.y });
      } else if (this.kit.gripEnemies && !this.heldEnemy) {
        // Inverted Grip: the nearest small bug in the arc
        let near: Enemy | null = null, nd = Infinity;
        for (const e of this.enemies) {
          if (!e.alive || !e.body || (e.gripMass ?? Infinity) > UP_GRIP) continue;
          const dist = Math.hypot(e.x - o.x, e.y - o.y);
          if (dist < nd && this.inField(e, 16)) { near = e; nd = dist; }
        }
        if (near) {
          this.heldEnemy = near;
          f.charge = 0;
          this.events.push('grab');
          this.fx.push({ t: 'grab', x: near.x, y: near.y });
        }
      }
    }
    const he = this.heldEnemy;
    if (he?.body) {
      if (!he.alive) { this.heldEnemy = null; return; }
      const b = he.body, target = { x: o.x + this.aim.x * F.holdDist, y: o.y + this.aim.y * F.holdDist };
      Matter.Body.setVelocity(b, { x: (target.x - b.position.x) * 0.3 + this.drone.vx, y: (target.y - b.position.y) * 0.3 + this.drone.vy });
      he.knock({ x: 0, y: 0 }); // held bugs are stunned
      if (c.held.has('fire')) f.charge = Math.min(1, f.charge + 1 / (F.chargeS * HZ));
      else if (this.fireWasHeld) {
        const sp = throwSpeed(f.charge) / HZ;
        this.fx.push({ t: 'throw', x: b.position.x, y: b.position.y, charge: f.charge });
        this.dropHeld({ x: this.aim.x * sp, y: this.aim.y * sp });
        this.field = { on: true, held: null, charge: 0 };
        this.fireCd = 1000 / T.probe.rate;
        this.fireBuf = 0;
        this.events.push('throw');
      }
      return;
    }
    if (f.held) {
      const p = f.held, b = p.body;
      const dist = Math.max(F.holdDist, p.size / 2 + 26);
      const target = { x: o.x + this.aim.x * dist, y: o.y + this.aim.y * dist };
      const dvx = this.drone.vx, dvy = this.drone.vy;
      Matter.Body.setVelocity(b, {
        x: b.velocity.x + F.stiffness * (target.x - b.position.x) - F.damping * (b.velocity.x - dvx),
        y: b.velocity.y + F.stiffness * (target.y - b.position.y) - F.damping * (b.velocity.y - dvy),
      });
      Matter.Body.setAngularVelocity(b, b.angularVelocity * 0.9);
      b.force.y -= b.mass * this.gravity(); // weightless while held
      // stuck behind a wall: let go
      if (Math.hypot(b.position.x - target.x, b.position.y - target.y) > F.radius * 2.2) { this.fx.push({ t: 'drop', x: b.position.x, y: b.position.y }); this.dropHeld(); return; }
      // throw: hold left click to charge over 0.8 s, release to throw at 600 + 900 × charge px/s
      if (c.held.has('fire')) f.charge = Math.min(1, f.charge + 1 / (F.chargeS * HZ));
      else if (this.fireWasHeld) {
        const s = throwSpeed(f.charge) / HZ;
        this.fx.push({ t: 'throw', x: b.position.x, y: b.position.y, charge: f.charge });
        this.dropHeld({ x: this.aim.x * s, y: this.aim.y * s });
        this.field = { on: true, held: null, charge: 0 };
        this.fireCd = 1000 / T.probe.rate; // the throw uses this click; no bolt leaves with it
        this.fireBuf = 0;
        this.events.push('throw');
      }
    }
  }

  // --- Weapons (plan E; decision 29) ---
  private take(): Shot {
    return this.pool.pop() ?? blankShot();
  }
  private free(s: Shot) {
    if (this.pool.length < SHOT_POOL) this.pool.push(s);
  }
  private fire(kind: 'bolt' | 'charged') {
    if (kind === 'bolt') this.shoot('bolt', (this.rand() * 2 - 1) * T.probe.spread * deg, T.probe.speed, T.probe.life * T.probe.speed, this.kit.probeDamage ?? T.probe.damage, 1, 1, 'pulse');
    else this.shoot('charged', 0, T.charged.speed, T.charged.range, T.charged.damage, T.charged.pierce, 3, 'charged');
  }
  /** One shot from the muzzle: `off` radians off the aim, speed in px/s, range in px. */
  private shoot(kind: 'bolt' | 'charged', off: number, speed: number, range: number, damage: number, pierce: number, knockMul: number, weapon: Weapon, fx = true) {
    const m = this.muzzle(), a = Math.atan2(this.aim.y, this.aim.x) + off, sp = speed / HZ;
    const s = this.take();
    Object.assign(s, { x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, left: Math.round((range / speed) * HZ), damage, friendly: true, kind, pierce, knockMul, reflected: false, dead: false });
    s.hit.clear();
    this.shots.push(s);
    if (!fx) return;
    this.events.push('shot');
    this.fx.push({ t: 'shot', x: m.x, y: m.y, dx: Math.cos(a), dy: Math.sin(a), weapon });
  }
  /** The Pulse Probe's rate now: Counter Fire climbs with hits in a row. */
  probeRate(): number {
    const to = this.kit.counterTo;
    return to ? T.probe.rate + (to - T.probe.rate) * Math.min(this.streak, UP.counter.hits) / UP.counter.hits : T.probe.rate;
  }

  private stepWeapon(c: Controls, frozen: boolean) {
    const held = !frozen && c.held.has('fire'), pressed = !frozen && c.pressed.has('fire');
    const holding = this.field.on && this.field.held;
    this.fireCd -= STEP_MS;
    this.fireBuf = Math.max(0, this.fireBuf - STEP_MS);
    if (holding || this.heldEnemy || frozen || !this.kit.gun || this.kit.holster) { this.charge = 0; this.fireWasHeld = held; if (this.fireCd < 0) this.fireCd = 0; return; }
    if (this.weapon === 'burst') {
      if (pressed) this.fireBuf = T.probe.bufferMs;
      if ((held || this.fireBuf > 0) && this.fireCd <= 0 && this.burstLeft === 0) {
        if (spend(this.vitals, UP.burst.energy)) { this.burstLeft = this.kit.burstBolts ?? UP.burst.bolts; this.burstT = STEP_MS; }
        else { const m = this.muzzle(); this.fx.push({ t: 'fizzle', x: m.x, y: m.y }); }
        this.fireCd = UP.burst.cooldownS * 1000;
        this.fireBuf = 0;
      }
      if (this.fireCd < 0) this.fireCd = 0;
    } else if (this.weapon === 'pulse' || this.weapon === 'fan' || this.weapon === 'cannon') {
      const rate = this.weapon === 'pulse' ? this.probeRate() : this.weapon === 'fan' ? UP.fan.rate : UP.cannon.rate;
      if (pressed) this.fireBuf = T.probe.bufferMs;
      if ((held || this.fireBuf > 0) && this.fireCd <= 0) {
        if (this.weapon === 'pulse') this.fire('bolt');
        else if (this.weapon === 'fan') for (let i = 0; i < UP.fan.bolts; i++) this.shoot('bolt', (i - 1) * (UP.fan.spreadDeg / 2) * deg, UP.fan.speed, UP.fan.range, UP.fan.damage, 1, 1, 'fan', i === 1);
        else if (spend(this.vitals, UP.cannon.energy)) this.shoot('charged', 0, UP.cannon.speed, UP.cannon.range, this.kit.cannonDamage ?? UP.cannon.damage, 1, UP.cannon.knock / T.probe.knock, 'cannon');
        else { const m = this.muzzle(); this.fx.push({ t: 'fizzle', x: m.x, y: m.y }); }
        this.fireCd += 1000 / rate;
        this.fireBuf = 0;
      }
      if (!held && this.fireCd < 0) this.fireCd = 0;
    } else {
      // Charged Probe: hold to charge over 0.8 s, release to fire; a release before full charge fires one Pulse bolt
      if (held) this.charge = Math.min(1, this.charge + 1 / (T.charged.chargeS * HZ));
      else if (this.fireWasHeld) {
        if (this.charge >= 1) {
          if (spend(this.vitals, T.charged.energy)) this.fire('charged');
          else { const m = this.muzzle(); this.fx.push({ t: 'fizzle', x: m.x, y: m.y }); }
        } else if (this.fireCd <= 0) {
          this.fire('bolt');
          this.fireCd = 1000 / T.probe.rate;
        }
        this.charge = 0;
      }
      if (this.fireCd < 0) this.fireCd = 0;
    }
    this.fireWasHeld = held;
  }

  /** Pipeline Burst: the armed bolts leave 80 ms apart, the first on the step the burst is armed. */
  private stepBurst() {
    if (this.burstLeft <= 0) return;
    this.burstT -= STEP_MS;
    if (this.burstT > 0) return;
    const B = UP.burst;
    this.shoot('bolt', (this.rand() * 2 - 1) * T.probe.spread * deg, B.speed, B.range, B.damage, 1, 1, 'burst');
    this.burstLeft--;
    this.burstT += B.gapMs;
  }

  /** Synchronizer (F): half-speed enemies for a few seconds; Metastables in view resolve and stay hittable. */
  private stepSync(c: Controls, frozen: boolean) {
    if (this.slowT > 0) this.slowT--;
    if (this.slowCd > 0) this.slowCd--;
    const sec = this.kit.sync;
    if (!sec || frozen || !c.pressed.has('gadget')) return;
    const d = this.drone;
    if (this.slowCd > 0 || !spend(this.vitals, UP.sync.energy)) { this.fx.push({ t: 'fizzle', x: d.x, y: d.y }); return; }
    this.slowT = Math.round(sec * HZ);
    this.slowCd = Math.round(UP.sync.cooldownS * HZ);
    this.fx.push({ t: 'sync', x: d.x, y: d.y });
    for (const e of this.enemies) if (e.alive && Math.abs(e.x - d.x) < 960 && Math.abs(e.y - d.y) < 560) e.resolve?.(this.slowT);
  }

  /** Datapath Rail: clip on at a rail's end (the story calls this from a rail station). */
  ride(rail: RailLine) {
    if (!this.kit.rail || this.riding) return false;
    const d = this.drone, dir: 1 | -1 = Math.abs(d.x - rail.x1) <= Math.abs(d.x - rail.x2) ? (rail.x2 > rail.x1 ? 1 : -1) : (rail.x2 > rail.x1 ? -1 : 1);
    this.riding = { rail, x: dir === (rail.x2 > rail.x1 ? 1 : -1) ? rail.x1 : rail.x2, dir };
    this.fx.push({ t: 'rail', x: d.x, y: d.y });
    return true;
  }

  private stepRail(c: Controls, frozen: boolean) {
    const ride = this.riding;
    if (!ride) return;
    const d = this.drone, sp = this.kit.rail ?? UP.rail.speed, r = ride.rail;
    const lo = Math.min(r.x1, r.x2), hi = Math.max(r.x1, r.x2);
    ride.x += (ride.dir * sp) / HZ;
    const end = ride.x <= lo || ride.x >= hi;
    ride.x = Math.max(lo, Math.min(hi, ride.x));
    const y = railY(r, ride.x) + RAIL_HANG;
    Matter.Body.setPosition(d.body, { x: ride.x, y });
    d.x = ride.x;
    d.y = y;
    // jumping off keeps the speed; so does reaching the end
    const jump = c.pressed.has('jump') && !frozen;
    Matter.Body.setVelocity(d.body, { x: (ride.dir * sp) / HZ, y: jump ? -DRONE.jump * 0.6 : 0 });
    d.vx = (ride.dir * sp) / HZ;
    d.vy = jump ? -DRONE.jump * 0.6 : 0;
    if (end || jump || frozen) this.riding = null;
  }

  /** Loop Drone: orbits at 60 px and fires at the nearest enemy in reach it can see, twice a second. */
  private stepLoopDrone(frozen: boolean) {
    const dmg = this.kit.loopDrone;
    if (!dmg || this.kit.holster || frozen) { this.loopPos = null; return; }
    const d = this.drone, L = UP.loopDrone;
    this.loopAngle += (Math.PI * 2) / (2.4 * HZ);
    this.loopPos = { x: d.x + Math.cos(this.loopAngle) * L.orbit, y: d.y - 10 + Math.sin(this.loopAngle) * L.orbit * 0.45 };
    this.loopCd -= STEP_MS;
    if (this.loopCd > 0) return;
    const p = this.loopPos;
    let best: Enemy | null = null, bd: number = L.range;
    for (const e of this.enemies) {
      if (!e.alive || !e.hittable()) continue;
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist < bd && this.ctx().sight(p, { x: e.x, y: e.y })) { best = e; bd = dist; }
    }
    if (!best) { this.loopCd = 0; return; }
    const a = Math.atan2(best.y - p.y, best.x - p.x), sp = L.speed / HZ;
    const s = this.take();
    Object.assign(s, { x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, left: Math.round((L.range * 1.2 / L.speed) * HZ), damage: dmg, friendly: true, kind: 'bolt', pierce: 1, knockMul: 0.5, reflected: false, dead: false });
    s.hit.clear();
    this.shots.push(s);
    this.fx.push({ t: 'shot', x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a), weapon: 'pulse' });
    this.loopCd = 1000 / L.rate;
  }

  /** An enemy shot (px/s): enemies and boss attacks fire these. */
  hostileShot(x: number, y: number, vx: number, vy: number, damage: number) {
    const s = this.take();
    Object.assign(s, { x, y, vx: vx / HZ, vy: vy / HZ, left: HZ * 4, damage, friendly: false, kind: 'orb', pierce: 1, knockMul: 1, reflected: false, dead: false });
    s.hit.clear();
    this.shots.push(s);
    this.fx.push({ t: 'orb', x, y });
  }

  /** Hurt the drone if it overlaps `area` (boss attacks and hazards); i-frames and the dash still protect it. */
  hurtIn(area: Rect, n: number) {
    if (this.dying === 0 && overlaps(droneRect(this.drone), area)) this.hurtDrone(n, { x: area.x + area.w / 2, y: area.y + area.h / 2 });
  }

  private ctx(): EnemyCtx {
    const d = this.drone;
    return {
      rand: this.rand,
      drone: droneRect(d),
      target: { x: d.x, y: d.y },
      solids: this.world.statics,
      plates: this.room.plates,
      sight: (a, b) => this.sight(a, b),
      shoot: (x, y, vx, vy, damage) => this.hostileShot(x, y, vx, vy, damage),
      hurtDrone: (n, from) => { if (this.dying === 0) this.hurtDrone(n, from); },
      spawn: (kind, x, y, opts) => { this.spawned.push(...this.makeEnemies(kind, x, y, opts)); },
      others: () => this.enemies.filter((e) => e.alive),
      lamp: { cone: this.lampCone },
    };
  }

  sight(a: Vec, b: Vec): boolean {
    const dv = { x: b.x - a.x, y: b.y - a.y };
    return !this.world.statics.some((r) => { const u = segRect(a, dv, r); return u !== undefined && u < 1; });
  }

  /** Contact damage: overlapping an enemy hurts and knocks the drone away (decision 5). */
  private stepContacts() {
    if (this.dying) return;
    const r = droneRect(this.drone);
    for (const e of this.enemies) {
      const dmg = e === this.heldEnemy ? 0 : e.touchDamage();
      if (dmg && polyRect(e.outline(), r)) this.hurtDrone(dmg, { x: e.x, y: e.y });
    }
  }

  private stepEmitters() {
    this.room.emitters.forEach((em, i) => {
      if (--this.emitT[i] > 0) return;
      this.emitT[i] = EMITTER.period;
      const dx = this.drone.x - em.x, dy = this.drone.y - em.y;
      if (Math.hypot(dx, dy) > 900 || this.dying) return;
      const n = norm({ x: dx, y: dy });
      this.ctx().shoot(em.x, em.y, n.x * EMITTER.speed * HZ, n.y * EMITTER.speed * HZ, DAMAGE.smallShot);
    });
  }

  private dummyRect(): Rect | null {
    const dm = this.room.dummy;
    return dm ? { x: dm.x - 16, y: dm.y - 96, w: 32, h: 96 } : null;
  }

  private stepShots() {
    const d = this.drone, dr = droneRect(d), dummy = this.dummyRect();
    // the Synchronizer: enemy shots fly at half speed (and live twice as long, so they still reach as far)
    const slowed = this.slowT > 0 ? this.shots.filter((s) => !s.friendly) : [];
    for (const s of slowed) { s.vx *= UP.sync.scale; s.vy *= UP.sync.scale; if (this.steps % 2) s.left++; }
    for (const s of this.shots) {
      // reflect enemy orbs that enter the field (plan F, decision 8)
      if (!s.friendly && this.inField({ x: s.x, y: s.y }, 6)) {
        const sp = len({ x: s.vx, y: s.vy }) * T.field.reflect;
        s.vx = this.aim.x * sp;
        s.vy = this.aim.y * sp;
        s.friendly = true;
        s.reflected = true;
        s.left = HZ * 3;
        this.events.push('reflect');
        this.fx.push({ t: 'reflect', x: s.x, y: s.y });
        continue;
      }
      const p = { x: s.x, y: s.y }, dv = { x: s.vx, y: s.vy };
      let t = 1, end = false;
      let hit: { e: Enemy } | { prop: Prop } | { target: Target } | 'drone' | 'dummy' | 'wall' | null = null;
      for (const r of this.world.statics) { const u = segRect(p, dv, r); if (u !== undefined && u < t) { t = u; hit = 'wall'; } }
      for (const pr of this.world.props) {
        if (pr.held && s.friendly) continue;
        const u = segPoly(p, dv, pr.body.vertices);
        if (u !== undefined && u < t) { t = u; hit = { prop: pr }; }
      }
      if (s.friendly) {
        if (dummy) { const u = segRect(p, dv, dummy); if (u !== undefined && u < t) { t = u; hit = 'dummy'; } }
        for (const tg of this.targets) {
          if (!tg.active) continue;
          const u = segRect(p, dv, tg.rect);
          if (u !== undefined && u <= t) { t = u; hit = { target: tg }; }
        }
        for (const e of this.enemies) {
          if (!e.hittable() || s.hit.has(e)) continue;
          const u = segPoly(p, dv, e.outline());
          if (u !== undefined && u <= t) { t = u; hit = { e }; }
        }
      } else {
        const u = segRect(p, dv, dr);
        if (u !== undefined && u <= t) { t = u; hit = 'drone'; }
      }
      end = hit !== null;
      s.x += s.vx * t;
      s.y += s.vy * t;
      const dir = norm(dv);
      if (hit === 'drone') {
        if (!this.invulnerable) this.hurtDrone(s.damage, { x: s.x - dir.x * 20, y: s.y - dir.y * 20 });
        else end = false; // a dash passes through
      } else if (hit === 'dummy') {
        this.dummyHits.push([this.steps, s.damage]);
        this.dummyLast = s.damage;
        this.dummyFlash = frames(T.feel.hitFlashMs);
        this.fx.push({ t: 'hit', x: s.x, y: s.y, dx: dir.x, dy: dir.y, n: s.damage, armored: false, enemy: true });
      } else if (hit && hit !== 'wall' && 'target' in hit) {
        this.targetHits.push({ id: hit.target.id, n: s.damage });
        this.fx.push({ t: 'hit', x: s.x, y: s.y, dx: dir.x, dy: dir.y, n: 0, armored: false, enemy: false });
      } else if (hit && hit !== 'wall' && 'e' in hit) {
        const e = hit.e;
        const armored = e instanceof Latch && e.armored(dir);
        // Carry Shot: a bolt landing within 0.5 s of the last one on the same enemy carries +4
        const carry = this.kit.carryShot && s.kind !== 'orb' && this.steps - (this.lastBoltHit.get(e) ?? -999) <= frames(T.story.carryMs) ? T.story.carryBonus : 0;
        if (s.kind !== 'orb') this.lastBoltHit.set(e, this.steps);
        const weakHit = !!this.kit.weak && (CENTRE_WEAK.has(e.kind) ? Math.hypot(s.x - e.x, s.y - e.y) <= 10 : Math.sign(dir.x) === e.facing);
        const n = e.damage(Math.round((s.damage + carry) * (weakHit ? this.kit.weak! : 1)), dir);
        s.hit.add(e);
        if (s.kind === 'bolt' && s.knockMul === 1) this.streak++;
        const k = (e.kind === 'latch' ? T.probe.knockHeavy : T.probe.knock) * s.knockMul;
        e.knock({ x: dir.x * k, y: dir.y * k });
        this.fx.push({ t: 'hit', x: s.x, y: s.y, dx: dir.x, dy: dir.y, n, armored, enemy: true });
        this.onEnemyDamaged(e, dir);
        if (s.kind === 'charged' && --s.pierce > 0) { end = false; s.x += dir.x * 2; s.y += dir.y * 2; }
      } else if (hit && hit !== 'wall' && 'prop' in hit) {
        const b = hit.prop.body, k = T.probe.propNudge / HZ / hit.prop.mass * (s.kind === 'orb' ? 1 : 1);
        Matter.Body.setVelocity(b, { x: b.velocity.x + dir.x * k, y: b.velocity.y + dir.y * k });
        this.fx.push({ t: 'hit', x: s.x, y: s.y, dx: dir.x, dy: dir.y, n: 0, armored: false, enemy: false });
      } else if (hit === 'wall') {
        this.fx.push({ t: 'hit', x: s.x, y: s.y, dx: dir.x, dy: dir.y, n: 0, armored: false, enemy: false });
      }
      if (!end) { s.x += s.vx * (1 - t); s.y += s.vy * (1 - t); }
      if (end || --s.left <= 0) {
        if (!end && s.friendly && s.kind === 'bolt' && !s.hit.size) this.streak = 0; // Counter Fire: a miss resets it
        s.dead = true;
      }
    }
    for (const s of slowed) { s.vx /= UP.sync.scale; s.vy /= UP.sync.scale; }
    const live: Shot[] = [];
    for (const s of this.shots) (s.dead ? this.free(s) : live.push(s));
    this.shots = live;
    const cut = this.steps - 2 * HZ;
    while (this.dummyHits.length && this.dummyHits[0][0] < cut) this.dummyHits.shift();
  }

  /** Damage per second at the dummy over the last 2 s (decision 22). */
  dummyDps(): number {
    return this.dummyHits.reduce((a, [, n]) => a + n, 0) / 2;
  }

  /** After any damage: a kill shatters the enemy and leaves a grabbable core chunk (plan E, decision 15). */
  private onEnemyDamaged(e: Enemy, dir: Vec) {
    if (e.alive) return;
    this.events.push('kill');
    // a Racer whose partner can still revive it keeps its body where it fell
    if (racerPending(e)) { this.fx.push({ t: 'kill', x: e.x, y: e.y, outline: e.outline(), vx: dir.x * 60, vy: dir.y * 60, kind: e.kind }); return; }
    const vel = e.body ? { x: e.body.velocity.x * HZ + dir.x * 120, y: e.body.velocity.y * HZ + dir.y * 120 } : { x: dir.x * 120, y: dir.y * 120 };
    this.fx.push({ t: 'kill', x: e.x, y: e.y, outline: e.outline(), vx: vel.x, vy: vel.y, kind: e.kind });
    if (e.body) {
      Matter.Composite.remove(this.world.engine.world, e.body);
      const chunk = addProp(this.world, { kind: 'debris', x: e.x, y: e.y }, Math.round(T.feel.debrisS * HZ));
      Matter.Body.setVelocity(chunk.body, { x: vel.x / HZ, y: vel.y / HZ - 3 });
      const sp = (e as unknown as { spawn?: Vec }).spawn;
      if (sp && this.respawnEnemies && this.room.enemies.length) this.respawns.push({ kind: e.kind as EnemyKind, x: sp.x, y: sp.y, t: Math.round(T.enemy.respawnS * HZ) });
    }
  }

  /** Props: hurt enemies on hard hits (decision 12), fade debris, report heavy landings. */
  private onCollide(pairs: Matter.Pair[]) {
    for (const pair of pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const pa = this.propOf(a), pb = this.propOf(b);
      const ea = pa ? null : this.enemyOf(a), eb = pb ? null : this.enemyOf(b);
      const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y) * HZ;
      const prop = pa ?? pb, enemy = ea ?? eb;
      if (prop && enemy && enemy.alive) {
        const last = prop.hits.get(enemy) ?? -999;
        if (this.steps - last < frames(T.field.propHitCooldownMs)) continue;
        const n = propDamage(prop.mass, rel);
        if (n <= 0) continue;
        prop.hits.set(enemy, this.steps);
        const dir = norm({ x: enemy.x - prop.body.position.x, y: enemy.y - prop.body.position.y });
        enemy.damage(n);
        this.fx.push({ t: 'hit', x: (enemy.x + prop.body.position.x) / 2, y: (enemy.y + prop.body.position.y) / 2, dx: dir.x, dy: dir.y, n, armored: false, enemy: true });
        this.onEnemyDamaged(enemy, dir);
      } else if (prop && !enemy && rel > 260 && prop.kind !== 'debris') {
        this.fx.push({ t: 'thud', x: prop.body.position.x, y: prop.body.position.y, speed: rel });
      }
    }
  }
  /** Inverted Grip: a thrown bug hurts the first other bug it reaches, and itself, like a thrown crate. */
  private stepThrown() {
    for (const [e, until] of this.thrown) {
      if (!e.alive || !e.body || this.steps > until) { this.thrown.delete(e); continue; }
      const v = e.body.velocity, speed = Math.hypot(v.x, v.y) * HZ;
      const other = this.enemies.find((o) => o !== e && o.alive && o.hittable() && Math.hypot(o.x - e.x, o.y - e.y) < 34);
      if (!other) continue;
      const n = propDamage(e.gripMass ?? 1, speed);
      this.thrown.delete(e);
      if (n <= 0) continue;
      const dir = norm({ x: other.x - e.x, y: other.y - e.y });
      for (const hit of [other, e]) {
        hit.damage(n, dir);
        this.fx.push({ t: 'hit', x: hit.x, y: hit.y, dx: dir.x, dy: dir.y, n, armored: false, enemy: true });
        this.onEnemyDamaged(hit, dir);
      }
    }
  }
  private propOf(b: Matter.Body) {
    return b.collisionFilter.category === CAT.prop || b.collisionFilter.category === CAT.held ? this.world.props.find((p) => p.body === b) ?? null : null;
  }
  private enemyOf(b: Matter.Body) {
    return b.collisionFilter.category === CAT.enemy ? this.enemies.find((e) => e.body === b) ?? null : null;
  }

  private stepProps() {
    for (const p of [...this.world.props]) {
      if (p.life > 0 && --p.life === 0) {
        if (this.field.on && this.field.held === p) this.dropHeld();
        removeProp(this.world, p);
      }
    }
  }

  private stepDoorAndPads() {
    const w = this.world, door = this.room.door;
    const resting = (r: Rect) => w.props.some((p) => p.kind !== 'debris' && !p.held && overlaps(boundsRect(p.body), { x: r.x, y: r.y - 6, w: r.w, h: r.h + 6 }));
    if (door && w.door) {
      if (this.doorOpen === 0 && resting(door.plate)) { this.doorOpen = 0.001; this.fx.push({ t: 'door', x: door.rect.x, y: door.rect.y }); }
      if (this.doorOpen > 0 && this.doorOpen < 1) {
        this.doorOpen = Math.min(1, this.doorOpen + 1 / (0.6 * HZ));
        const k = 1 - (1 - this.doorOpen) ** 3; // ease out
        const home = w.door.home, y = home.y - home.h * k;
        w.door.rect.y = y;
        Matter.Body.setPosition(w.door.body, { x: home.x + home.w / 2, y: y + home.h / 2 });
        if (this.doorOpen >= 1) {
          Matter.Composite.remove(w.engine.world, w.door.body);
          w.statics = w.statics.filter((s) => s !== w.door!.rect);
        }
      }
    }
    (this.room.pads ?? []).forEach((pad, i) => {
      const b = w.props.find((p) => p.kind === 'logic' && !p.held && overlaps(boundsRect(p.body), { x: pad.x, y: pad.y - 6, w: pad.w, h: pad.h + 6 }));
      this.padBits[i] = b ? b.bit ?? 0 : null;
    });
  }

  private stepHazards() {
    const d = this.drone;
    if (this.dying) return;
    const r = droneRect(d);
    for (const h of this.room.hazards) {
      if (overlaps(r, h)) this.hurtDrone(DAMAGE.hazard, { x: h.x + h.w / 2, y: h.y + h.h / 2 });
    }
    // pits: below the room, back to the last safe ground for 10 damage (dash and i-frames do not save you)
    if (d.y - d.h / 2 > this.room.h) {
      this.dropHeld();
      placeDrone(d, this.lastSafe.x, this.lastSafe.y);
      this.vitals.integrity = Math.max(0, this.vitals.integrity - DAMAGE.pit);
      this.vitals.sinceHit = 0;
      this.events.push('pit');
    }
    // anything that fell out of the room (a thrown crate through a gap) comes back to its start
    for (const e of this.enemies) if (e.alive && e.body && e.y > this.room.h + 200) { e.alive = false; this.onEnemyDamaged(e, { x: 0, y: 1 }); }
  }

  private stepRespawns() {
    for (const r of this.respawns) {
      if (--r.t > 0) continue;
      const e = this.makeEnemy(r.kind, r.x, r.y);
      this.enemies = [...this.enemies.filter(kept), e];
      this.fx.push({ t: 'enemyBoot', x: r.x, y: r.y });
    }
    this.respawns = this.respawns.filter((r) => r.t > 0);
    if (this.enemies.length > 64) this.enemies = this.enemies.filter(kept);
  }

  /** Repair the next broken panel (the tuning panel's button; in the story, upgrades do this). */
  repairPanel() {
    const i = this.panels.indexOf(false);
    if (i < 0) return;
    this.panels[i] = true;
    this.panelAge[i] = 0;
    this.fx.push({ t: 'repair', panel: i });
  }
  breakPanels() {
    this.panels = this.panels.map((_, i) => i < 2);
  }

  /** Stress test (decision 28): fill the arena to 30 enemies and 50 props. */
  stress() {
    const kinds: EnemyKind[] = ['glitch', 'spark', 'latch'];
    let i = 0;
    while (this.enemies.filter((e) => e.alive).length < 30) {
      const k = kinds[i % 3], x = 2400 + (i * 97) % 1100;
      this.enemies.push(this.makeEnemy(k, x, k === 'spark' ? 520 + (i % 4) * 60 : 960));
      i++;
    }
    let j = 0;
    while (this.world.props.length < 50) {
      addProp(this.world, { kind: 'crate', mass: [1, 2, 3][j % 3], x: 300 + (j * 53) % 1500, y: 400 - (j % 5) * 60 });
      j++;
    }
  }
}

function blankShot(): Shot {
  return { x: 0, y: 0, vx: 0, vy: 0, left: 0, damage: 0, friendly: true, kind: 'bolt', pierce: 1, knockMul: 1, hit: new Set(), reflected: false, dead: true };
}

/** Does a convex polygon overlap a rect? */
function polyRect(poly: Vec[], r: Rect): boolean {
  if (poly.some((p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return true;
  const corners = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  if (corners.some((c) => inPoly(c, poly))) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const u = segRect(a, { x: b.x - a.x, y: b.y - a.y }, r);
    if (u !== undefined && u <= 1) return true;
  }
  return false;
}

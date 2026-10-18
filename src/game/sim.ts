// The simulation: one room, the drone, its weapon and Field Coil, enemies, shots and the test-room emitter, advanced in
// fixed 60 Hz steps. No DOM and no clock in here, so tests drive it step by step with scripted controls.
import Matter from 'matter-js';
import { Floater } from './enemies/floater';
import { GlitchSpike } from './enemies/spike';
import type { Enemy, EnemyCtx, Shape } from './enemies/types';
import type { Rect, Room } from './level/room';
import { circleRect, len, norm, overlaps, segCircle, segRect, type Vec } from './physics/geom';
import { type Block, blockRect, createWorld, stepWorld, type World } from './physics/world';
import { type Controls, createDrone, type Drone, droneRect, placeDrone, settleDrone, stepDrone } from './player/drone';
import { createVitals, hurt, spend, tickVitals } from './player/stats';
import { DAMAGE, DRONE, EMITTER, FIELD, PROBE, throwDamage, VITALS } from './tuning';

export interface Shot { x: number; y: number; vx: number; vy: number; left: number; damage: number; friendly: boolean; dead: boolean }

/** What the Field Coil is doing this step. */
export type FieldState = { on: false } | { on: true; held: Block | Enemy | null };

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

export type SimEvent = 'hit' | 'shot' | 'kill' | 'block' | 'throw' | 'death' | 'respawn' | 'pit' | 'jump' | 'dash';

export class Sim {
  world: World;
  drone: Drone;
  vitals = createVitals();
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  field: FieldState = { on: false };
  aim: Vec = { x: 1, y: 0 };
  steps = 0;
  /** Steps left in the death animation; the drone rebuilds at the save node when it reaches 0. */
  dying = 0;
  lastSafe: Vec;
  events: SimEvent[] = [];
  private probeCd = 0;
  private emitT: number[];
  private rand: () => number;

  constructor(public room: Room, seed = 1) {
    this.rand = rng(seed);
    this.world = createWorld(room);
    this.drone = createDrone(this.world, room.spawn.x, room.spawn.y);
    this.lastSafe = { ...room.spawn };
    this.emitT = room.emitters.map(() => EMITTER.period);
    this.spawnEnemies();
  }

  private spawnEnemies() {
    this.enemies = [
      ...this.room.floaters.map((f) => new Floater(f.x, f.y, { x: f.x, y: f.y }, this.rand)),
      ...this.room.spikes.map((s) => new GlitchSpike(s.x, s.y, s.dir, s.offset)),
    ];
  }

  get invulnerable() {
    return this.drone.dash !== null || this.dying > 0;
  }

  /** Advance one 60 Hz step. `aimAt` is the aim point in world px. */
  step(c: Omit<Controls, 'aim'>, aimAt: Vec) {
    this.events = [];
    this.steps++;
    const d = this.drone, v = this.vitals;
    this.aim = norm({ x: aimAt.x - d.x, y: aimAt.y - d.y });
    const ctl: Controls = { ...c, aim: this.aim };
    const frozen = this.dying > 0;

    const r = stepDrone(d, ctl, this.world, v.energy, frozen);
    if (r.dashed) { spend(v, DRONE.dashEnergy); this.events.push('dash'); }
    if (r.jumped) this.events.push('jump');
    this.stepField(ctl, frozen);
    stepWorld(this.world);
    settleDrone(d, this.world, this.room);
    if (d.grounded && !d.onOneWay && !this.room.hazards.some((h) => overlaps(droneRect(d), { ...h, y: h.y - 40, h: h.h + 40 }))) {
      this.lastSafe = { x: d.x, y: d.y + d.h / 2 - DRONE.h / 2 };
    }

    this.stepWeapon(ctl, frozen);
    this.stepEnemies();
    this.stepShots();
    this.stepThrown();
    this.stepHazards();
    tickVitals(v);
    this.stepDeath();
  }

  private hurtDrone(n: number) {
    if (hurt(this.vitals, n, this.invulnerable)) this.events.push('hit');
  }

  private stepDeath() {
    const v = this.vitals;
    if (this.dying > 0) {
      if (--this.dying === 0) {
        placeDrone(this.drone, this.room.spawn.x, this.room.spawn.y);
        v.integrity = v.maxIntegrity;
        v.energy = v.maxEnergy;
        v.iFrames = 0;
        this.shots = [];
        this.dropHeld();
        this.spawnEnemies();
        this.events.push('respawn');
      }
      return;
    }
    if (v.integrity <= 0) {
      this.dying = VITALS.deathSteps;
      this.dropHeld();
      this.events.push('death');
    }
  }

  // --- Field Coil: hold to grab the nearest light object in front of the aim, or to stop enemy shots ---
  private grabbables(): (Block | Enemy)[] {
    return [...this.world.blocks.filter((b) => b.mass <= FIELD.maxMass), ...this.enemies.filter((e) => e.alive && e.grab && e.grab.mass <= FIELD.maxMass)];
  }
  private posOf(o: Block | Enemy): Vec {
    return 'body' in o ? o.body.position : o.grab!.pos();
  }
  private dropHeld(v: Vec = { x: 0, y: 0 }) {
    if (this.field.on && this.field.held) {
      const o = this.field.held;
      if ('body' in o) { o.held = false; Matter.Body.setVelocity(o.body, v); }
      else o.grab!.release(v);
    }
    this.field = { on: false };
  }
  private stepField(c: Controls, frozen: boolean) {
    const d = this.drone, v = this.vitals;
    const want = !frozen && c.held.has('field') && v.energy > 0;
    if (!want) { this.dropHeld(); return; }
    if (!this.field.on) this.field = { on: true, held: null };
    const f = this.field;
    if (!f.held) {
      let best: Block | Enemy | null = null, bestD = Infinity;
      for (const o of this.grabbables()) {
        const p = this.posOf(o), dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy);
        const reach = FIELD.range + ('body' in o ? o.size / 2 : 0);
        const ang = Math.acos(Math.max(-1, Math.min(1, (dx * this.aim.x + dy * this.aim.y) / (dist || 1))));
        if (dist <= reach && ang <= FIELD.cone && dist < bestD) { best = o; bestD = dist; }
      }
      f.held = best;
      if (best && 'body' in best) best.held = true;
    }
    if (f.held) {
      v.energy = Math.max(0, v.energy - FIELD.holdCost);
      v.sinceSpend = 0;
      const o = f.held;
      const size = 'body' in o ? o.size : 36;
      const dist = FIELD.holdDist + size / 2 - 18;
      const target = { x: d.x + this.aim.x * dist, y: d.y + this.aim.y * dist };
      if ('body' in o) {
        const p = o.body.position;
        Matter.Body.setVelocity(o.body, { x: (target.x - p.x) * 0.35 + d.vx * 0.5, y: (target.y - p.y) * 0.35 });
        Matter.Body.setAngularVelocity(o.body, o.body.angularVelocity * 0.8);
        // cancel gravity while held
        const g = this.world.engine.gravity;
        o.body.force.y -= o.body.mass * g.y * (g.scale ?? 0.001);
      } else {
        o.grab!.moveTo(target, this.room.solids);
      }
      if (c.pressed.has('fire')) {
        const tv = { x: this.aim.x * FIELD.throwSpeed, y: this.aim.y * FIELD.throwSpeed };
        if ('body' in o) o.thrownHits = new Set();
        this.dropHeld(tv);
        this.probeCd = PROBE.cooldown; // the throw uses this press; no shot leaves with it
        this.events.push('throw');
      }
    }
  }

  // --- Pulse Probe ---
  private stepWeapon(c: Controls, frozen: boolean) {
    this.probeCd = Math.max(0, this.probeCd - 1);
    if (frozen || !c.held.has('fire') || this.probeCd > 0 || (this.field.on && this.field.held)) return;
    const d = this.drone;
    this.probeCd = PROBE.cooldown;
    this.shots.push({ x: d.x + this.aim.x * 22, y: d.y + this.aim.y * 22, vx: this.aim.x * PROBE.speed, vy: this.aim.y * PROBE.speed, left: PROBE.range, damage: PROBE.damage, friendly: true, dead: false });
    this.events.push('shot');
  }

  private ctx(): EnemyCtx {
    return { rand: this.rand, drone: droneRect(this.drone), solids: this.room.solids, plates: this.room.plates };
  }

  private stepEnemies() {
    const ctx = this.ctx();
    for (const e of this.enemies) {
      e.step(ctx);
      const dmg = e.touchDamage();
      if (dmg && this.touches(e.shape(), ctx.drone)) this.hurtDrone(dmg);
    }
    // test-room emitters: a small shot at the drone every EMITTER.period steps while it is within 900 px
    this.room.emitters.forEach((em, i) => {
      if (--this.emitT[i] > 0) return;
      this.emitT[i] = EMITTER.period;
      const dx = this.drone.x - em.x, dy = this.drone.y - em.y;
      if (Math.hypot(dx, dy) > 900 || this.dying) return;
      const n = norm({ x: dx, y: dy });
      this.shots.push({ x: em.x, y: em.y, vx: n.x * EMITTER.speed, vy: n.y * EMITTER.speed, left: 1200, damage: DAMAGE.smallShot, friendly: false, dead: false });
    });
  }

  private touches(s: Shape, r: Rect) {
    return s.kind === 'circle' ? circleRect(s.x, s.y, s.r, r) : overlaps(s.rect, r);
  }

  private stepShots() {
    const d = this.drone, v = this.vitals;
    for (const s of this.shots) {
      const p = { x: s.x, y: s.y }, dv = { x: s.vx, y: s.vy };
      let t = 1, hit: Enemy | 'drone' | null = null;
      for (const r of this.room.solids) { const u = segRect(p, dv, r); if (u !== undefined && u < t) { t = u; hit = null; } }
      for (const b of this.world.blocks) { if (b.held && s.friendly) continue; const u = segRect(p, dv, blockRect(b)); if (u !== undefined && u < t) { t = u; hit = null; } }
      let end = t < 1;
      if (s.friendly) {
        for (const e of this.enemies) {
          if (!e.hittable()) continue;
          const sh = e.shape();
          const u = sh.kind === 'circle' ? segCircle(p, dv, sh.x, sh.y, sh.r) : segRect(p, dv, sh.rect, 2);
          if (u !== undefined && u <= t) { t = u; hit = e; end = true; }
        }
      } else {
        // the Field Coil stops enemy shots inside its arc, for 15 energy each
        if (this.field.on && !this.field.held && v.energy >= FIELD.blockCost) {
          const qx = s.x + s.vx - d.x, qy = s.y + s.vy - d.y, dist = Math.hypot(qx, qy);
          const ang = Math.acos(Math.max(-1, Math.min(1, (qx * this.aim.x + qy * this.aim.y) / (dist || 1))));
          if (dist <= FIELD.range && ang <= FIELD.cone) {
            spend(v, FIELD.blockCost);
            s.dead = true;
            this.events.push('block');
            continue;
          }
        }
        const u = segRect(p, dv, droneRect(d));
        if (u !== undefined && u <= t) { t = u; hit = 'drone'; end = true; }
      }
      s.x += s.vx * t;
      s.y += s.vy * t;
      s.left -= len(dv) * t;
      if (hit === 'drone') this.hurtDrone(s.damage);
      else if (hit) this.damageEnemy(hit, s.damage);
      if (end || s.left <= 0) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  private damageEnemy(e: Enemy, n: number) {
    const was = e.alive;
    e.damage(n);
    if (was && !e.alive) this.events.push('kill');
  }

  /** Thrown blocks hurt enemies they hit at 300 px/s or more: mass × speed ÷ 1000, once per enemy per throw. */
  private stepThrown() {
    for (const b of this.world.blocks) {
      if (!b.thrownHits) continue;
      const speed = Math.hypot(b.body.velocity.x, b.body.velocity.y);
      if (speed < FIELD.throwDamageMinSpeed) { b.thrownHits = null; continue; }
      const r = blockRect(b);
      for (const e of this.enemies) {
        if (!e.hittable() || b.thrownHits.has(e) || !this.touches(e.shape(), r)) continue;
        b.thrownHits.add(e);
        this.damageEnemy(e, throwDamage(b.mass, speed));
      }
    }
  }

  private stepHazards() {
    const d = this.drone;
    if (this.dying) return;
    const r = droneRect(d);
    for (const h of this.room.hazards) {
      if (!overlaps(r, h)) continue;
      if (hurt(this.vitals, DAMAGE.hazard, this.invulnerable)) {
        this.events.push('hit');
        const n = norm({ x: d.x - (h.x + h.w / 2), y: -Math.max(40, Math.abs(d.y - (h.y + h.h / 2))) });
        d.vx = n.x * DAMAGE.hazardKnock;
        d.vy = n.y * DAMAGE.hazardKnock;
        d.grounded = false;
      }
    }
    // pits: below the room, back to the last safe ground for 10 damage (dash and i-frames do not save you)
    if (d.y - d.h / 2 > this.room.h) {
      this.dropHeld();
      placeDrone(d, this.lastSafe.x, this.lastSafe.y);
      this.vitals.integrity = Math.max(0, this.vitals.integrity - DAMAGE.pit);
      this.vitals.sinceHit = 0;
      this.events.push('pit');
    }
  }
}

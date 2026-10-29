// Wake Glitch (Phase 6 Spec, section 5): a thin jagged line, 40 px long, on its own 6 s cycle. Asleep for 5 s it is a dashed
// faint outline: not hittable, and no damage. Then it wakes for 1 s. In the first 0.2 s it flashes once and takes aim at the
// drone's centre. Then it dashes at that point at 300 px/s (240 px at most), stopping at a solid. Awake it is hittable and
// touches for 10. When the second is over it snaps back to where it spawned and sleeps again. Its start phase comes from
// its spawn x, so a group does not wake together. It has 30 HP. It is not a matter body: it moves itself.
import type { Rect } from '../level/room';
import { overlaps, type Vec } from '../physics/geom';
import { LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Wake Glitch numbers (Phase 6 Spec, section 5). Not on TUNING yet. */
const S = {
  length: 40, // px: the line's length
  half: 5, // px: half its height, for the hit outline and the solid check
  hp: 30, // base HP
  touch: 10, // touch damage while awake
  cycleS: 6, // s: one full cycle
  sleepS: 5, // s: asleep at the start of each cycle
  flashMs: 200, // ms: the flash at the start of the awake second, before the dash
  dash: 300, // px/s
  stagger: 240, // px: spawn x repeats its start phase every 240 px, so spawns 60 px apart wake a quarter cycle apart
  jag: [0, -4, 3, -5, 4, -3, 5, -4, 2, 0], // px: the zigzag's heights, left to right, fixed so it does not shimmer
};
const ps = (v: number) => v / HZ; // px/s -> px/step
const CYCLE = frames(S.cycleS * 1000); // 360 steps
const ASLEEP = frames(S.sleepS * 1000); // 300 steps: the awake second starts here
const FLASH = frames(S.flashMs); // 12 steps of flash before the dash

/** Start phase in steps, from spawn x: spawns 60 px apart start a quarter of a cycle apart. */
const startPhase = (x: number) => {
  const m = ((x % S.stagger) + S.stagger) % S.stagger;
  return Math.round((m / S.stagger) * CYCLE) % CYCLE;
};

/** The body's hit outline: the line's band, 40 px by 10 px. */
const band = (x: number, y: number): Rect => ({ x: x - S.length / 2, y: y - S.half, w: S.length, h: S.half * 2 });

/** The Wake Glitch: asleep for 5 s, then awake for 1 s, when it flashes and dashes at the drone. */
export class Wake implements Enemy {
  kind = 'wake';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  /** 1 during the flash, falling to 0 as the dash begins; 0 otherwise. */
  telegraph = 0;
  /** Steps into the 6 s cycle. */
  clock: number;
  /** Where it spawned: where it sleeps, and where it snaps back to. */
  readonly home: Vec;
  /** The drone's centre when the dash began; null until then. */
  private aim: Vec | null = null;
  /** Set once the dash has arrived or hit a solid; it then waits there until it sleeps. */
  private stopped = false;

  constructor(public x: number, public y: number, public maxHp: number, clock: number) {
    this.hp = maxHp;
    this.clock = clock;
    this.home = { x, y };
  }
  /** Awake for the last second of the cycle. */
  awake(): boolean { return this.clock >= ASLEEP; }
  /** Only while awake. */
  hittable(): boolean { return this.alive && this.awake(); }
  /** Only while awake. */
  touchDamage(): number { return this.hittable() ? S.touch : 0; }
  /** The line's band, a convex box round it. */
  outline(): Vec[] {
    const b = band(this.x, this.y);
    return [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
  }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** It moves itself: a knock does nothing. */
  knock(_v: Vec) { /* moves itself */ }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.clock = (this.clock + 1) % CYCLE;
    if (this.clock === 0) {
      // asleep again: it snaps back to its spawn point and forgets its aim
      this.x = this.home.x;
      this.y = this.home.y;
      this.aim = null;
      this.stopped = false;
    }
    if (!this.awake()) {
      this.telegraph = 0;
      return;
    }
    const w = this.clock - ASLEEP; // steps into the awake second
    if (w < FLASH) {
      this.telegraph = 1 - w / FLASH;
      return;
    }
    this.telegraph = 0;
    if (this.aim === null) this.aim = { x: ctx.target.x, y: ctx.target.y };
    if (!this.stopped) this.dash(ctx.solids);
  }
  /** One step toward the aim point at 300 px/s. It stops there, or at a solid. */
  private dash(solids: Rect[]) {
    const aim = this.aim;
    if (!aim) return;
    const dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy);
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    if (d <= 1e-9) {
      this.stopped = true;
      return;
    }
    const move = Math.min(ps(S.dash), d);
    const nx = this.x + (dx / d) * move, ny = this.y + (dy / d) * move;
    if (solids.some((s) => overlaps(band(nx, ny), s))) {
      this.stopped = true;
      return;
    }
    this.x = nx;
    this.y = ny;
    if (move >= d) this.stopped = true;
  }
}

/** Its start phase is set by its spawn x, so a group does not wake together. */
function make(x: number, y: number, k: MakeCtx): Wake {
  return new Wake(x, y, scaledHp(S.hp, k), startPhase(x));
}

/** The jagged line through its zigzag vertices, centred on (x, y). */
function zigzag(g: CanvasRenderingContext2D, x: number, y: number) {
  g.beginPath();
  S.jag.forEach((dy, i) => {
    const px = x - S.length / 2 + (i * S.length) / (S.jag.length - 1), py = y + dy;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  });
}

/** Asleep: a dashed faint zigzag. Awake: a glowing zigzag, brighter through its flash. Hostile by its jagged shape. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Wake) || !e.alive) return;
  if (!e.awake()) {
    g.save();
    g.setLineDash([3, 4]);
    g.strokeStyle = rgba(PAL.neon, 0.3);
    g.lineWidth = 1;
    zigzag(g, e.x, e.y);
    g.stroke();
    g.restore();
    return;
  }
  const t = e.telegraph, flash = e.flash > 0;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.3 + 0.5 * t);
  g.lineWidth = LINE.enemyGlow + 6 * t;
  zigzag(g, e.x, e.y);
  g.stroke();
  g.restore();
  g.save();
  g.strokeStyle = flash ? PAL.text : PAL.neon;
  g.lineWidth = 2;
  zigzag(g, e.x, e.y);
  g.stroke();
  g.restore();
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = e.y + S.half + 6;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
}

register('wake', { make, draw });

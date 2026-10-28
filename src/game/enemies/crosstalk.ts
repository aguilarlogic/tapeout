// Crosstalk Pair (Phase 6 Spec, section 5): two 18 px diamonds joined by a dashed coupling line. The aggressor is solid. It
// floats at 160 px/s and keeps about 300 px from the drone, and every 1.6 s it fires a pulse at 360 px/s for 8 damage. The
// victim is hollow. It replays the aggressor's path 0.3 s later, 120 px to its right, and fires a copy of each pulse at
// the same moment in its replay, with the same velocity. Kill the aggressor and the victim goes neutral: grey, harmless,
// and it fades out over 2 s. Killing the victim does nothing to the aggressor. Both have 40 HP.
// One spawn makes both. They are two enemies that share a Link (as the darts of a swarm share a Pack): the link holds the
// aggressor's recent path, the pulses still to be copied, and whether the aggressor is down.
import type { Vec } from '../physics/geom';
import { LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Crosstalk numbers (Phase 6 Spec, section 5). Not on TUNING yet. */
const S = {
  half: 9, // px: half a diamond's width or height (18 px across)
  hp: 40, // base HP of each diamond
  hover: 300, // px: the aggressor keeps about this far from the drone
  speed: 160, // px/s: the aggressor's floating speed
  shotSpeed: 360, // px/s: a pulse
  shotDamage: 8, // damage per pulse
  fireMs: 1600, // ms between the aggressor's pulses
  copyMs: 300, // ms the victim's replay lags the aggressor
  offsetX: 120, // px: the victim sits this far to the right of what it copies
  fadeMs: 2000, // ms a neutral victim takes to fade out
  knockDamp: 0.8, // share of a knock's push left each step
};
const ps = (v: number) => v / HZ; // px/s -> px/step
const FIRE = frames(S.fireMs);
const COPY = frames(S.copyMs);
const FADE = frames(S.fadeMs);

/** A pulse the aggressor has fired, waiting for the victim to replay it. */
interface Pulse {
  /** The aggressor's step count when the victim copies it. */
  at: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** What the two diamonds share: the aggressor's recent path by step count, the pulses still to be copied, and whether the
 * aggressor is down. */
class Link {
  /** The aggressor's position after each of its recent steps, oldest first. */
  private trail: { t: number; p: Vec }[] = [];
  /** The aggressor's live position, for the coupling line. */
  head: Vec;
  /** Pulses fired but not yet copied. */
  pulses: Pulse[] = [];
  /** Set when the aggressor dies: the victim goes neutral. */
  down = false;

  constructor(spawn: Vec) {
    this.head = { x: spawn.x, y: spawn.y };
    this.trail.push({ t: 0, p: { x: spawn.x, y: spawn.y } });
  }
  /** Notes where the aggressor is after its step `t`. Only the last few steps are kept. */
  record(t: number, p: Vec) {
    this.head = { x: p.x, y: p.y };
    this.trail.push({ t, p: { x: p.x, y: p.y } });
    if (this.trail.length > COPY + 4) this.trail.shift();
  }
  /** Where the aggressor was after step `t`, or the oldest step kept if `t` is older than that. */
  at(t: number): Vec {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const s = this.trail[i];
      if (s.t <= t) return s.p;
    }
    return this.trail[0].p;
  }
}

/** The diamond's corners: top, right, bottom, left. */
function diamond(x: number, y: number): Vec[] {
  return [{ x, y: y - S.half }, { x: x + S.half, y }, { x, y: y + S.half }, { x: x - S.half, y }];
}

/** The solid diamond. It floats, keeps its distance from the drone and fires pulses. Its death cuts the victim loose. */
export class CrosstalkAggressor implements Enemy {
  kind = 'crosstalk';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Steps lived: the clock the victim replays from. */
  t = 0;
  /** Steps until the next pulse. */
  private cool = FIRE;
  /** The knock's push, px per step, decaying. */
  private push: Vec = { x: 0, y: 0 };

  constructor(public x: number, public y: number, public maxHp: number, private readonly link: Link) {
    this.hp = maxHp;
  }
  hittable() { return this.alive; }
  /** It floats clear of the drone and fires; only its pulses hurt. */
  touchDamage() { return 0; }
  outline(): Vec[] { return diamond(this.x, this.y); }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) {
      this.alive = false;
      this.link.down = true;
    }
    return n;
  }
  /** A knock shoves it for a moment; it then floats back to its distance. */
  knock(v: Vec) {
    if (!this.alive) return;
    this.push = { x: ps(v.x), y: ps(v.y) };
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.t++;
    this.x += this.push.x;
    this.y += this.push.y;
    this.push = { x: this.push.x * S.knockDamp, y: this.push.y * S.knockDamp };
    this.keepDistance(ctx.target);
    this.link.record(this.t, this);
    if (--this.cool > 0) return;
    this.cool = FIRE;
    this.pulse(ctx);
  }
  /** Floats toward the drone or away from it, at 160 px/s at most, until it is 300 px off. */
  private keepDistance(target: Vec) {
    const dx = this.x - target.x, dy = this.y - target.y, d = Math.hypot(dx, dy) || 1;
    const err = d - S.hover; // more than 0: too far, so it moves in
    const move = Math.max(-ps(S.speed), Math.min(ps(S.speed), err));
    this.x -= (dx / d) * move;
    this.y -= (dy / d) * move;
    this.facing = target.x >= this.x ? 1 : -1;
  }
  /** One pulse from its centre at the drone. The victim copies it S.copyMs later, from its own spot. */
  private pulse(ctx: EnemyCtx) {
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y, d = Math.hypot(dx, dy) || 1;
    const vx = (dx / d) * S.shotSpeed, vy = (dy / d) * S.shotSpeed;
    ctx.shoot(this.x, this.y, vx, vy, S.shotDamage);
    this.link.pulses.push({ at: this.t + COPY, x: this.x, y: this.y, vx, vy });
  }
}

/** The hollow diamond. It replays the aggressor's path and pulses 0.3 s late. Once the aggressor is down it is neutral. */
export class CrosstalkVictim implements Enemy {
  kind = 'crosstalk';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Steps lived: the clock it replays against. */
  private t = 0;
  /** Steps since the aggressor went down; the fade runs over these. */
  private fade = 0;

  constructor(public x: number, public y: number, public maxHp: number, private readonly link: Link) {
    this.hp = maxHp;
  }
  /** Grey and harmless from the moment its aggressor is down. */
  neutral(): boolean { return this.link.down; }
  /** Its opacity: 1 while coupled, falling to 0 over 2 s once neutral. */
  alpha(): number { return this.link.down ? Math.max(0, 1 - this.fade / FADE) : 1; }
  /** Where the coupling line runs to, or null once the victim is neutral. */
  aggressorAt(): Vec | null { return this.link.down ? null : this.link.head; }
  /** A neutral victim cannot be hit: shots pass through it while it fades. */
  hittable() { return this.alive && !this.link.down; }
  touchDamage() { return 0; }
  outline(): Vec[] { return diamond(this.x, this.y); }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** A copy: only its aggressor moves it, so a knock does nothing. */
  knock(_v: Vec) { /* replays only */ }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.t++;
    if (this.link.down) {
      this.fade++;
      if (this.fade >= FADE) this.alive = false;
      return;
    }
    const p = this.link.at(this.t - COPY);
    this.x = p.x + S.offsetX;
    this.y = p.y;
    while (this.link.pulses.length > 0 && this.link.pulses[0].at <= this.t) {
      const s = this.link.pulses.shift();
      if (!s) break;
      // the copy leaves from the same spot, offset, with the same velocity; Noise Filter stops copied shots
      ctx.shoot(s.x + S.offsetX, s.y, s.vx, s.vy, S.shotDamage, { copied: true });
    }
  }
}

function make(x: number, y: number, k: MakeCtx): Enemy[] {
  const hp = scaledHp(S.hp, k), link = new Link({ x, y });
  return [new CrosstalkAggressor(x, y, hp, link), new CrosstalkVictim(x + S.offsetX, y, hp, link)];
}

/** Traces a diamond on the canvas. */
function trace(g: CanvasRenderingContext2D, x: number, y: number) {
  const pts = diamond(x, y);
  g.beginPath();
  pts.forEach((p, i) => {
    if (i) g.lineTo(p.x, p.y);
    else g.moveTo(p.x, p.y);
  });
  g.closePath();
}

/** The diamond's outline with a glow under it, as the other enemies have. */
function glowOutline(g: CanvasRenderingContext2D, x: number, y: number, colour: string) {
  trace(g, x, y);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(colour, 0.34);
  g.lineWidth = LINE.enemyGlow;
  g.stroke();
  g.restore();
  trace(g, x, y);
  g.strokeStyle = colour;
  g.lineWidth = LINE.enemy;
  g.stroke();
}

/** The hit-points bar under a damaged diamond. */
function hpBar(g: CanvasRenderingContext2D, e: Enemy, colour: string) {
  if (e.hp >= e.maxHp) return;
  const w = 18, k = Math.max(0, e.hp / e.maxHp), y = e.y + S.half + 5;
  g.fillStyle = rgba(colour, 0.25);
  g.fillRect(e.x - w / 2, y, w, 2);
  g.fillStyle = colour;
  g.fillRect(e.x - w / 2, y, w * k, 2);
}

/** The aggressor is a solid diamond; the victim is hollow, with a dashed coupling line while it is coupled. Once the
 * aggressor is down the victim is grey and fades out. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (e instanceof CrosstalkAggressor) {
    if (!e.alive) return;
    const colour = e.flash > 0 ? PAL.text : PAL.neon;
    trace(g, e.x, e.y);
    g.fillStyle = colour;
    g.fill();
    glowOutline(g, e.x, e.y, colour);
    hpBar(g, e, PAL.neon);
    return;
  }
  if (!(e instanceof CrosstalkVictim) || !e.alive) return;
  const to = e.aggressorAt();
  if (to) {
    g.save();
    g.setLineDash([4, 4]);
    g.strokeStyle = rgba(PAL.neon, 0.5);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(e.x, e.y);
    g.lineTo(to.x, to.y);
    g.stroke();
    g.restore();
  }
  g.save();
  g.globalAlpha = e.alpha();
  const colour = e.neutral() ? PAL.idle : e.flash > 0 ? PAL.text : PAL.neon;
  glowOutline(g, e.x, e.y, colour);
  if (!e.neutral()) hpBar(g, e, PAL.neon);
  g.restore();
}

register('crosstalk', { make, draw });

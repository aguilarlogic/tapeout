// Metastable (Phase 3 Spec, section 6): a synchroniser that has not settled. Two overlapping triangles flicker at 8 Hz
// between two spots 40 px apart, and cannot be hit while they do. After a random 0.8 to 2.0 s it resolves to one spot,
// telegraphs for 0.4 s, fires two shots at the drone 0.15 s apart, and is hittable for 1.5 s before it flickers again.
// It floats, drifting toward the drone at 20 px/s while it can see it, and never comes within 220 px. The Synchronizer
// holds it resolved with resolve().
import type { Vec } from '../physics/geom';
import { blinkSteady, LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Metastable numbers (Phase 3 Spec, section 6). Not on TUNING yet. */
const S = {
  /** Each triangle's corner distance from its centre: the figure is about 28 px across. */
  radius: 14,
  /** Each spot's distance either side of the anchor: the two spots are 40 px apart. */
  spot: 20,
  hp: 50,
  /** The flicker before it resolves: a random 0.8 to 2.0 s. */
  flickerMinMs: 800,
  flickerMaxMs: 2000,
  /** Full flicker cycles a second. */
  flickerHz: 8,
  /** Shot speed, px/s. */
  shotSpeed: 360,
  /** Damage per shot. */
  damage: 8,
  /** Gap between its two shots, ms. */
  shotGapMs: 150,
  /** How long it stays hittable after its volley, ms. */
  openMs: 1500,
  /** Drift speed toward the drone while it can see it, px/s. */
  drift: 20,
  /** It never comes closer than this to the drone, px. */
  minRange: 220,
  /** Alpha of the ghost of the spot it is not showing. */
  ghost: 0.25,
};
const TELE = frames(TUNING.enemy.telegraphMs);
const GAP = frames(S.shotGapMs);
const OPEN = frames(S.openMs);
const C30 = Math.cos(Math.PI / 6);
/** The two triangles as unit corners: up (apex at the top) and down (apex at the bottom). */
const UP = [{ x: 0, y: -1 }, { x: C30, y: 0.5 }, { x: -C30, y: 0.5 }];
const DOWN = [{ x: 0, y: 1 }, { x: C30, y: -0.5 }, { x: -C30, y: -0.5 }];
/** The hull of the two triangles: their six outer corners in order round the figure, a regular hexagon. */
const HULL = [UP[1], DOWN[0], UP[2], DOWN[2], UP[0], DOWN[1]];

type Phase = 'flicker' | 'aim' | 'volley' | 'open';

export class Metastable implements Enemy {
  kind = 'metastable';
  hp: number;
  alive = true;
  facing: 1 | -1 = -1;
  flash = 0;
  telegraph = 0;
  /** The spot it shows: -1 left, 1 right. While flickering it alternates; once resolved it stays on this one. */
  side: 1 | -1 = -1;
  /** Steps of flicker so far; the spot changes every half cycle. */
  private blink = 0;
  private phase: Phase = 'flicker';
  /** Steps left in the current phase. */
  private timer: number;
  /** Steps until the second shot of the volley. */
  private gap = 0;

  /** `flicker` is the first flicker's length in steps. */
  constructor(public x: number, public y: number, public maxHp: number, flicker: number) {
    this.hp = maxHp;
    this.timer = flicker;
  }
  /** Still flickering, so it cannot be hit. */
  flickering(): boolean { return this.phase === 'flicker'; }
  /** Hittable only in the window after its volley, or while the Synchronizer holds it. */
  hittable(): boolean { return this.alive && this.phase === 'open'; }
  touchDamage() { return 0; }
  /** The hull of the two triangles at the spot it shows. */
  outline(): Vec[] {
    const cx = this.spotX();
    return HULL.map((p) => ({ x: cx + p.x * S.radius, y: this.y + p.y * S.radius }));
  }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** It floats on its own: a knock does nothing. */
  knock(_v: Vec) { /* floats */ }
  /** The Synchronizer holds it resolved and hittable for `steps` steps. It fires nothing during the hold. */
  resolve(steps: number) {
    if (!this.alive) return;
    this.timer = this.phase === 'open' ? Math.max(this.timer, steps) : steps;
    this.phase = 'open';
    this.telegraph = 0;
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.drift(ctx);
    switch (this.phase) {
      case 'flicker':
        this.blink++;
        this.side = Math.floor((this.blink * S.flickerHz * 2) / HZ) % 2 === 0 ? -1 : 1;
        this.timer--;
        if (this.timer > 0) break;
        // it resolves to one of the two spots and telegraphs
        this.phase = 'aim';
        this.timer = TELE;
        this.side = ctx.rand() < 0.5 ? -1 : 1;
        break;
      case 'aim':
        this.timer--;
        this.telegraph = 1 - this.timer / TELE;
        if (this.timer > 0) break;
        this.telegraph = 0;
        this.fire(ctx);
        this.phase = 'volley';
        this.gap = GAP;
        break;
      case 'volley':
        this.gap--;
        if (this.gap > 0) break;
        this.fire(ctx);
        this.phase = 'open';
        this.timer = OPEN;
        break;
      case 'open':
        this.timer--;
        if (this.timer > 0) break;
        this.phase = 'flicker';
        this.timer = frames(S.flickerMinMs + ctx.rand() * (S.flickerMaxMs - S.flickerMinMs));
        break;
    }
    this.facing = this.side;
  }
  /** x of the spot it shows. */
  private spotX() { return this.x + this.side * S.spot; }
  /** One shot from the spot it shows, at the drone. */
  private fire(ctx: EnemyCtx) {
    const ox = this.spotX();
    const dx = ctx.target.x - ox, dy = ctx.target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    ctx.shoot(ox, this.y, (dx / d) * S.shotSpeed, (dy / d) * S.shotSpeed, S.damage);
  }
  /** Floats toward the drone at 20 px/s while it can see it, and stops 220 px short. */
  private drift(ctx: EnemyCtx) {
    if (!ctx.sight({ x: this.x, y: this.y }, ctx.target)) return;
    const dx = ctx.target.x - this.x, dy = ctx.target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= S.minRange) return;
    const move = Math.min(S.drift / HZ, d - S.minRange);
    this.x += (dx / d) * move;
    this.y += (dy / d) * move;
  }
}

function make(x: number, y: number, k: MakeCtx) {
  return new Metastable(x, y, scaledHp(S.hp, k), frames(S.flickerMinMs + k.rand() * (S.flickerMaxMs - S.flickerMinMs)));
}

/** Trace the two overlapping triangles centred on (cx, cy) as one path. */
function trace(g: CanvasRenderingContext2D, cx: number, cy: number) {
  g.beginPath();
  for (const tri of [UP, DOWN]) {
    tri.forEach((p, i) => {
      const x = cx + p.x * S.radius, y = cy + p.y * S.radius;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.closePath();
  }
}

/** One spot's figure: the fill, a glow under the outline (wider while telegraphing), then the outline. */
function sketch(
  g: CanvasRenderingContext2D, cx: number, cy: number, o: { colour: string; fill: string; alpha: number; tele: number },
) {
  g.save();
  g.globalAlpha *= o.alpha;
  trace(g, cx, cy);
  g.fillStyle = o.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, o.tele > 0 ? 0.25 + 0.5 * o.tele : 0.34);
  g.lineWidth = LINE.enemyGlow + 8 * o.tele;
  g.stroke();
  g.restore();
  g.strokeStyle = o.colour;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.restore();
}

/** Line art in the enemy colour. While flickering, the other spot ghosts at low alpha (both show steady when blinks are
 * held steady); a hit flashes white, and under steady blinks only its outline does. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof Metastable)) return;
  const flash = e.flash > 0;
  const colour = flash ? PAL.text : e.telegraph > 0.6 ? PAL.line : PAL.neon;
  const fill = flash && !blinkSteady() ? PAL.text : PAL.fill;
  if (e.flickering() && blinkSteady()) {
    // a steady double outline: both spots, no blinking
    for (const side of [-1, 1] as const) {
      sketch(g, e.x + side * S.spot, e.y, { colour: PAL.neon, fill: PAL.fill, alpha: 1, tele: 0 });
    }
  } else {
    if (e.flickering()) {
      sketch(g, e.x - e.side * S.spot, e.y, { colour: PAL.neon, fill: PAL.fill, alpha: S.ghost, tele: 0 });
    }
    sketch(g, e.x + e.side * S.spot, e.y, { colour, fill, alpha: 1, tele: e.telegraph });
  }
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = e.y + S.radius + 6;
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
}

register('metastable', { make, draw });

// False Pass (Phase 7 Spec, section 5): a 34 x 26 px panel that says PASS. It floats at 100 px/s, keeping 280 px from the
// drone. It shows PASS for 2.5 s, and while PASS shows, shots pass through it. Then it shows FAIL for 1.2 s, with a jagged
// outline and a "!". FAIL is the only time it can be hit. When FAIL begins it fires a 3 shot fan at 360 px/s, 8 damage per
// shot. While the Scan Visor's ring covers it, it can be hit at any time. It has 60 HP and no touch damage.
import type { Vec } from '../physics/geom';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
/** False Pass numbers (Phase 7 Spec, section 5). Not on TUNING yet. */
const S = {
  w: 34, h: 26, // px: the panel
  hp: 60, // base HP
  float: 100, // px/s: its drift round the drone
  keep: 280, // px: the distance it holds from the drone's centre
  passMs: 2500, // ms: PASS shows, and shots pass through
  failMs: 1200, // ms: FAIL shows, and it can be hit
  shots: 3, // the fan, fired as FAIL begins
  shotSpeed: 360, // px/s
  damage: 8, // per shot
  spreadDeg: 12, // degrees between the fan's shots (not in the spec: a tuning guess)
  teeth: 4, // points per edge of the jagged FAIL outline, where every other one sticks out
  tooth: 3, // px: how far a tooth sticks out
};
const DEG = Math.PI / 180;
const PASS = frames(S.passMs); // 150 steps
const CYCLE = PASS + frames(S.failMs); // 222 steps
const ps = (v: number) => v / HZ; // px/s -> px/step

/** The False Pass: a panel that shows PASS (safe) or FAIL (hittable, and it fires a fan). */
export class FalsePass implements Enemy {
  kind = 'falsepass';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Steps into the 3.7 s cycle: PASS first, then FAIL. */
  private clock = 0;
  /** The Scan Visor's ring covered it on its last step. */
  private scanned = false;
  /** A knock's push, in px per step, fading each step. */
  private push: Vec = { x: 0, y: 0 };

  constructor(public x: number, public y: number, public maxHp: number) {
    this.hp = maxHp;
  }
  /** The word on the panel now. */
  showing(): 'PASS' | 'FAIL' { return this.clock < PASS ? 'PASS' : 'FAIL'; }
  /** On FAIL, or at any time while the Scan Visor marks it. */
  hittable() { return this.alive && (this.showing() === 'FAIL' || this.scanned); }
  touchDamage() { return 0; }
  outline(): Vec[] {
    const x0 = this.x - S.w / 2, y0 = this.y - S.h / 2;
    return [{ x: x0, y: y0 }, { x: x0 + S.w, y: y0 }, { x: x0 + S.w, y: y0 + S.h }, { x: x0, y: y0 + S.h }];
  }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** Pushes it a step's worth along v; the push fades over a few steps. */
  knock(v: Vec) { this.push = { x: ps(v.x), y: ps(v.y) }; }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.clock = (this.clock + 1) % CYCLE;
    this.float(ctx.target);
    this.facing = ctx.target.x >= this.x ? 1 : -1;
    const scan = ctx.lamp.scan;
    this.scanned = !!scan && Math.hypot(this.x - scan.x, this.y - scan.y) <= scan.r;
    // the step FAIL begins: one fan, aimed at the drone
    if (this.clock === PASS) this.fan(ctx);
  }
  /** Drifts round the drone at 100 px/s, easing in or out to hold 280 px from its centre. */
  private float(target: Vec) {
    const dx = this.x - target.x, dy = this.y - target.y, d = Math.hypot(dx, dy);
    const ux = d > 1e-9 ? dx / d : 1, uy = d > 1e-9 ? dy / d : 0;
    const v = ps(S.float);
    const ease = Math.max(-v, Math.min(v, S.keep - d));
    this.x += ux * ease - uy * v + this.push.x;
    this.y += uy * ease + ux * v + this.push.y;
    this.push = { x: this.push.x * 0.9, y: this.push.y * 0.9 };
  }
  /** Three shots fanned round the aim line to the drone, from the panel's centre. */
  private fan(ctx: EnemyCtx) {
    const aim = Math.atan2(ctx.target.y - this.y, ctx.target.x - this.x);
    for (let i = 0; i < S.shots; i++) {
      const a = aim + (i - (S.shots - 1) / 2) * S.spreadDeg * DEG;
      ctx.shoot(this.x, this.y, Math.cos(a) * S.shotSpeed, Math.sin(a) * S.shotSpeed, S.damage);
    }
  }
}

function make(x: number, y: number, k: MakeCtx): FalsePass {
  return new FalsePass(x, y, scaledHp(S.hp, k));
}

/** The panel's outline as a jagged loop: teeth point out along each edge, so FAIL reads as hostile by its shape. */
function jaggedPath(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  const n = S.teeth * 2, x1 = x0 + w, y1 = y0 + h, j = S.tooth;
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) pts.push({ x: x0 + (w * i) / n, y: y0 - (i % 2 ? j : 0) }); // top, left to right
  for (let i = 0; i < n; i++) pts.push({ x: x1 + (i % 2 ? j : 0), y: y0 + (h * i) / n }); // right, top to bottom
  for (let i = 0; i < n; i++) pts.push({ x: x1 - (w * i) / n, y: y1 + (i % 2 ? j : 0) }); // bottom, right to left
  for (let i = 0; i < n; i++) pts.push({ x: x0 - (i % 2 ? j : 0), y: y1 - (h * i) / n }); // left, bottom to top
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
}

/** PASS: a smooth green panel with the word. FAIL: a jagged red panel with the word and a "!" above it. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof FalsePass) || !e.alive) return;
  const x0 = e.x - S.w / 2, y0 = e.y - S.h / 2, y1 = y0 + S.h;
  const fail = e.showing() === 'FAIL', flash = e.flash > 0;
  const col = fail ? PAL.hostile : PAL.ok;
  const outline = () => {
    if (fail) jaggedPath(g, x0, y0, S.w, S.h);
    else {
      g.beginPath();
      g.rect(x0, y0, S.w, S.h);
    }
  };
  outline();
  g.fillStyle = PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(col, 0.34);
  g.lineWidth = LINE.enemyGlow;
  outline();
  g.stroke();
  g.restore();
  outline();
  g.strokeStyle = flash ? '#FFFFFF' : col;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.font = `bold 10px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = flash ? '#FFFFFF' : col;
  g.fillText(fail ? 'FAIL' : 'PASS', e.x, e.y + 1);
  if (fail) {
    g.font = `bold 14px ${FONT}`;
    g.fillStyle = PAL.hostile;
    g.fillText('!', e.x, y0 - 12);
  }
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = y1 + 6;
    g.fillStyle = rgba(col, 0.25);
    g.fillRect(e.x - w / 2, y, w, 2);
    g.fillStyle = col;
    g.fillRect(e.x - w / 2, y, w * k, 2);
  }
}

register('falsepass', { make, draw });

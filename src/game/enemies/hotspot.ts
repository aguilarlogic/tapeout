// Hotspot (Phase 6 Spec, section 5): a hot spot that has overheated on the floor. It never moves. The floor within 160 px
// of it glows amber, and the drone takes 5 damage a second while it stands on that floor; in the air it is safe. Three
// heat rings pulse out from it every 1 s. It has no touch damage. The Sim asks `hot` and `heat` about the drone's feet:
// there is no body to touch, so the area is the hazard. It is not a matter body and it does not move.
import type { Vec } from '../physics/geom';
import { prefs } from '../../state';
import { prefersReducedMotion } from '../../term/typewriter';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Rect } from '../level/room';
import type { Enemy, EnemyCtx } from './types';

const T = TUNING;
/** Hotspot numbers (Phase 6 Spec, section 5). Not on TUNING yet. */
const S = {
  radius: 15, // px: the circle is 30 px across
  hp: 90, // base HP
  reach: 160, // px: the floor either side of its centre that glows and burns
  floorTol: 2, // px: how far off the floor line a point may be and still count as floor
  dps: 5, // damage a second to a drone standing on the hot floor
  rings: 3,
  ringFrom: 17, // px: the first ring's radius at the start of its pulse
  ringTo: 38, // px: the radius the rings reach by the end of their pulse
  pulseMs: 1000, // one outward pulse of the rings
  sides: 16, // vertices in its outline
  ringW: 2, // px
};
const TAU = Math.PI * 2;
const PULSE = frames(S.pulseMs);

/** The Hotspot: a 30 px circle on the floor with a hot zone 160 px either side of it. */
export class Hotspot implements Enemy {
  kind = 'hotspot';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** The floor line it stands on: 15 px below its centre. */
  /** The floor line its heat spreads along: its spawn's foot, then the floor under it once it has settled. */
  floorY: number;
  private settled = false;
  /** Steps since it was made: drives the ring pulse. */
  private age = 0;

  constructor(public x: number, public y: number, public maxHp: number) {
    this.hp = maxHp;
    this.floorY = y + S.radius;
  }
  hittable() { return this.alive; }
  /** It does no touch damage. Its harm is the hot floor, read through `hot` and `heat`. */
  touchDamage() { return 0; }
  /** A convex polygon approximating the circle. */
  outline(): Vec[] {
    return Array.from({ length: S.sides }, (_, i) => {
      const a = (i / S.sides) * TAU;
      return { x: this.x + Math.cos(a) * S.radius, y: this.y + Math.sin(a) * S.radius };
    });
  }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(T.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** It is fixed to the floor: a knock does nothing. */
  knock(_v: Vec) { /* anchored to the floor */ }
  step(ctx: EnemyCtx) {
    this.flash = Math.max(0, this.flash - 1);
    this.age++;
    if (!this.settled) this.settle(ctx.solids);
  }
  /** On its first step it sits down on the nearest floor below its anchor, so its heat lies where the drone walks. */
  private settle(solids: Rect[]) {
    this.settled = true;
    let top = Infinity;
    for (const r of solids) if (r.x <= this.x && r.x + r.w >= this.x && r.y >= this.y - S.radius && r.y < top) top = r.y;
    if (top === Infinity) return;
    this.floorY = top;
    this.y = top - S.radius;
  }
  /** Is the floor point (x, y) hot? True for a point on the floor line within 160 px of the spot, either side. Points in
   * the air are never hot. A dead spot is cold. */
  hot(x: number, y: number): boolean {
    return this.alive && Math.abs(y - this.floorY) <= S.floorTol && Math.abs(x - this.x) <= S.reach;
  }
  /** Damage this step to a drone whose feet are at (x, y): 5 a second (5/60 a step) on the hot floor, none in the air. The
   * Sim adds it up step by step. */
  heat(x: number, y: number, grounded: boolean): number {
    return grounded && this.hot(x, y) ? S.dps / HZ : 0;
  }
}

function make(x: number, y: number, k: MakeCtx): Hotspot {
  return new Hotspot(x, y, scaledHp(S.hp, k));
}

/** Reduced motion as the story game resolves it (screen.ts reducedMotion): the setting, or the system's if set so. */
function reducedMotion(): boolean {
  const p = prefs().reducedMotion;
  return p === 'on' || (p === 'system' && prefersReducedMotion());
}

/** The amber glow on the floor, the rings, then the circle with a "!" in it. */
function draw(g: CanvasRenderingContext2D, e: Enemy, t: number) {
  if (!(e instanceof Hotspot) || !e.alive) return;
  const cx = e.x, cy = e.y, fy = e.floorY, reach = S.reach;
  // the hot floor: stacked amber bands, brightest on the floor line, with a tick at each end of the reach
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [h, a] of [[20, 0.07], [11, 0.12], [4, 0.28]] as const) {
    g.fillStyle = rgba(PAL.amber, a);
    g.fillRect(cx - reach, fy - h, reach * 2, h);
  }
  g.restore();
  g.strokeStyle = rgba(PAL.amber, 0.85);
  g.lineWidth = LINE.enemy;
  g.beginPath();
  g.moveTo(cx - reach, fy);
  g.lineTo(cx + reach, fy);
  g.moveTo(cx - reach, fy - 6);
  g.lineTo(cx - reach, fy);
  g.moveTo(cx + reach, fy - 6);
  g.lineTo(cx + reach, fy);
  g.stroke();
  // three heat rings, each a third of a pulse behind the last, growing and fading as they go
  const phase = reducedMotion() ? 0 : (t % PULSE) / PULSE;
  g.lineWidth = S.ringW;
  for (let i = 0; i < S.rings; i++) {
    const p = (phase + i / S.rings) % 1;
    g.strokeStyle = rgba(PAL.amber, 0.7 * (1 - p));
    g.beginPath();
    g.arc(cx, cy, S.ringFrom + (S.ringTo - S.ringFrom) * p, 0, TAU);
    g.stroke();
  }
  // the body: a 30 px circle with a neon outline and a glow
  const circle = () => {
    g.beginPath();
    g.arc(cx, cy, S.radius, 0, TAU);
  };
  const flash = e.flash > 0;
  circle();
  g.fillStyle = flash ? '#FFFFFF' : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = LINE.enemyGlow;
  circle();
  g.stroke();
  g.restore();
  circle();
  g.strokeStyle = flash ? '#FFFFFF' : PAL.neon;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.font = `bold 16px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = PAL.text;
  g.fillText('!', cx, cy + 1);
  if (e.hp < e.maxHp) {
    const w = 24, k = Math.max(0, e.hp / e.maxHp), y = fy + 6;
    g.fillStyle = rgba(PAL.amber, 0.25);
    g.fillRect(cx - w / 2, y, w, 2);
    g.fillStyle = PAL.amber;
    g.fillRect(cx - w / 2, y, w * k, 2);
  }
}

register('hotspot', { make, draw });

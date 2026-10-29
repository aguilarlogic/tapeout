// Skew Swarm (Phase 4 Spec, section 6): five small darts hover in a line over one anchor. When the drone comes
// within 400 px of the swarm's leader (the centre dart's slot, which is the anchor), they dive one after another,
// 0.15 s apart, each at the point the drone was at when its own dive began. Then each climbs back to its slot, and
// the swarm waits 1.5 s before the next round. Each dart is its own enemy; the darts of one anchor share a Pack that
// runs the round.
import type { Vec } from '../physics/geom';
import { PAL, rgba } from '../render/palette';
import { frames, HZ, TUNING } from '../tuning';
import { register, scaledHp, type MakeCtx } from './registry';
import type { Enemy, EnemyCtx } from './types';

/** Swarm numbers (Phase 4 Spec, section 6). Not on TUNING yet. */
const S = {
  count: 5, // darts per swarm
  spacing: 30, // px between formation slots
  hp: 12, // base HP of each dart
  range: 400, // px from the leader within which a round starts
  dive: 420, // px/s
  climb: 200, // px/s back to the slot
  gapMs: 150, // between one dart's dive and the next
  telegraphMs: 300, // a dart glows this long before it dives
  waitMs: 1500, // after a round, before the next one may start
  touchDive: 10, // touch damage while diving
  touchHover: 5, // touch damage while hovering or climbing
  nose: 7, // px from the centre to the nose and to the tail: 14 px wide
  half: 4, // px from the centre to the top and bottom: 8 px tall
  shoulder: 2, // px behind the centre where the notch and the shoulders sit
  bobPx: 3, // px of hover bob (not in the spec: a gentle idle)
  bobHz: 0.6, // bobs a second (not in the spec: the drone's idle rate)
  knockDamp: 0.8, // share of a knock's push left each step
};
const ps = (v: number) => v / HZ; // px/s -> px/step
const TAU = Math.PI * 2;
const GAP = frames(S.gapMs); // 9 steps between dives
const TELE = frames(S.telegraphMs); // 18 steps of glow before a dive
const WAIT = frames(S.waitMs); // 90 steps of rest
/** The round step of the last dart's dive; once every dart is home after it, the round is over. */
const LAST_DIVE = TELE + (S.count - 1) * GAP;
/** The centre slot's index in the line. */
const CENTRE = (S.count - 1) / 2;

/** The round one anchor runs: when each dart dives. Shared by the darts that one anchor made. */
class Pack {
  darts: SwarmDart[] = [];
  /** Steps left to rest after a round before the next may start. */
  private rest = 0;
  /** Steps since the round began; null between rounds. */
  round: number | null = null;
  /** Counts rounds, so that each dart dives once in each. */
  serial = 0;
  constructor(readonly anchor: Vec) {}
  /** The first living dart keeps the clock: it advances the round once a step, however many darts there are. */
  clock(): SwarmDart | undefined {
    return this.darts.find((d) => d.alive);
  }
  /** Advances the round by one step. A new round starts when the swarm has rested and the drone is near. */
  tick(target: Vec) {
    if (this.round === null) {
      if (this.rest > 0) this.rest--;
      else if (Math.hypot(target.x - this.anchor.x, target.y - this.anchor.y) <= S.range) {
        this.round = 0;
        this.serial++;
      }
      return;
    }
    this.round++;
    if (this.round > LAST_DIVE && this.darts.every((d) => !d.alive || d.mode === 'hover')) {
      this.round = null;
      this.rest = WAIT;
    }
  }
}

/** One dart of a swarm: it hovers in its slot, dives when its turn comes in the round, and climbs back. */
export class SwarmDart implements Enemy {
  kind = 'swarm';
  hp: number;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  /** Light enough for the Inverted Grip (phase 3 spec section 7). */
  gripMass = 1;
  /** Hovering in its slot, diving at the drone's old spot, or climbing back to the slot. */
  mode: 'hover' | 'dive' | 'climb' = 'hover';
  /** Unit direction of travel, for the trail. */
  heading: Vec = { x: 0, y: 0 };
  private px: number;
  private py: number;
  private readonly slot: Vec;
  /** Where this dart's dive is aimed: the drone's centre when the dive began. */
  private aim: Vec = { x: 0, y: 0 };
  /** The round serial this dart last dove in, so it dives once per round. */
  private served = -1;
  /** Steps this dart has lived; with `phase`, the bob. */
  private t = 0;
  /** Bob phase, so the darts do not bob in step. */
  private readonly phase: number;
  /** Steps left of a knock's stun. */
  private stun = 0;
  /** The knock's push, px per step, decaying. */
  private push: Vec = { x: 0, y: 0 };

  constructor(readonly order: number, private readonly pack: Pack, slot: Vec, public maxHp: number) {
    this.hp = maxHp;
    this.px = slot.x;
    this.py = slot.y;
    this.slot = { x: slot.x, y: slot.y };
    this.phase = order * 1.3;
  }
  get x() { return this.px; }
  get y() { return this.py; }
  hittable() { return this.alive; }
  touchDamage() {
    if (!this.alive) return 0;
    return this.mode === 'dive' ? S.touchDive : S.touchHover;
  }
  /** A convex dart: nose, two shoulders and a square tail, mirrored to its facing. */
  outline(): Vec[] {
    const f = this.facing;
    return [
      { x: this.px + f * S.nose, y: this.py },
      { x: this.px - f * S.shoulder, y: this.py - S.half },
      { x: this.px - f * S.nose, y: this.py - S.half },
      { x: this.px - f * S.nose, y: this.py + S.half },
      { x: this.px - f * S.shoulder, y: this.py + S.half },
    ];
  }
  damage(n: number) {
    if (!this.alive) return 0;
    this.hp -= n;
    this.flash = frames(TUNING.feel.hitFlashMs);
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  /** A knock pushes the dart off course for a moment; then it carries on to its aim, or climbs back to its slot. */
  knock(v: Vec) {
    if (!this.alive) return;
    this.push = { x: ps(v.x), y: ps(v.y) };
    this.stun = frames(TUNING.enemy.stunMs);
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - 1);
    this.t++;
    if (this.pack.clock() === this) this.pack.tick(ctx.target);
    if (this.stun > 0) {
      this.stun--;
      this.px += this.push.x;
      this.py += this.push.y;
      this.push = { x: this.push.x * S.knockDamp, y: this.push.y * S.knockDamp };
      return;
    }
    if (this.mode === 'dive') this.flyDive();
    else if (this.mode === 'climb') this.climb();
    else this.hover(ctx);
  }
  /** In formation: glows as its turn nears, starts its dive when the round reaches it, else bobs in its slot. */
  private hover(ctx: EnemyCtx) {
    const r = this.pack.round, fresh = this.served !== this.pack.serial;
    const start = this.order * GAP, dive = start + TELE;
    if (r !== null && fresh && r >= dive) {
      this.served = this.pack.serial;
      this.aim = { x: ctx.target.x, y: ctx.target.y };
      this.mode = 'dive';
      this.telegraph = 0;
      this.flyDive();
      return;
    }
    this.telegraph = r !== null && fresh && r >= start ? (r - start) / TELE : 0;
    this.facing = ctx.target.x >= this.px ? 1 : -1;
    const bob = S.bobPx * Math.sin((this.t / HZ) * TAU * S.bobHz + this.phase);
    // a knock's push is pulled back to the slot at climb speed, so a hovering dart does not snap home
    this.fly({ x: this.slot.x, y: this.slot.y + bob }, ps(S.climb));
  }
  /** Straight at the aim point at dive speed; on arrival it turns for home. */
  private flyDive() {
    if (this.fly(this.aim, ps(S.dive))) this.mode = 'climb';
  }
  /** Back to the slot at climb speed; on arrival it hovers again. */
  private climb() {
    if (this.fly(this.slot, ps(S.climb))) this.mode = 'hover';
  }
  /** One step toward `to` at `speed`. Returns true on arrival, where it snaps onto the point. */
  private fly(to: Vec, speed: number): boolean {
    const dx = to.x - this.px, dy = to.y - this.py, d = Math.hypot(dx, dy);
    if (d <= speed) {
      this.px = to.x;
      this.py = to.y;
      this.heading = { x: 0, y: 0 };
      return true;
    }
    this.px += (dx / d) * speed;
    this.py += (dy / d) * speed;
    this.heading = { x: dx / d, y: dy / d };
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    return false;
  }
}

function make(x: number, y: number, k: MakeCtx): SwarmDart[] {
  const pack = new Pack({ x, y }), hp = scaledHp(S.hp, k);
  pack.darts = Array.from({ length: S.count }, (_, i) =>
    new SwarmDart(i, pack, { x: x + (i - CENTRE) * S.spacing, y }, hp));
  return pack.darts;
}

/** A slim notched arrowhead in line art, glowing like the other enemies. A trail follows it while it dives, and a ring
 *  grows round it while it telegraphs its dive. */
function draw(g: CanvasRenderingContext2D, e: Enemy) {
  if (!(e instanceof SwarmDart)) return;
  const f = e.facing, x = e.x, y = e.y, tele = e.telegraph, flash = e.flash > 0;
  if (e.mode === 'dive') {
    // the trail: a line running back along the dart's track
    const h = e.heading;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = rgba(PAL.neon, 0.35);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - h.x * S.nose, y - h.y * S.nose);
    g.lineTo(x - h.x * (S.nose + 14), y - h.y * (S.nose + 14));
    g.stroke();
    g.restore();
  }
  if (tele > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(PAL.neon, 0.3 + 0.5 * tele);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, 6 + 8 * tele, 0, TAU);
    g.stroke();
    g.restore();
  }
  const chevron = () => {
    g.beginPath();
    g.moveTo(x + f * S.nose, y);
    g.lineTo(x - f * S.nose, y - S.half);
    g.lineTo(x - f * S.shoulder, y);
    g.lineTo(x - f * S.nose, y + S.half);
    g.closePath();
  };
  chevron();
  g.fillStyle = flash ? PAL.text : PAL.fill;
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(PAL.neon, 0.34);
  g.lineWidth = 6;
  chevron();
  g.stroke();
  g.restore();
  chevron();
  g.strokeStyle = flash ? PAL.text : PAL.neon;
  g.lineWidth = 1.5;
  g.stroke();
  if (e.hp < e.maxHp) {
    const w = 14, k = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = rgba(PAL.neon, 0.25);
    g.fillRect(x - w / 2, y + 9, w, 2);
    g.fillStyle = PAL.neon;
    g.fillRect(x - w / 2, y + 9, w * k, 2);
  }
}

register('swarm', { make, draw });

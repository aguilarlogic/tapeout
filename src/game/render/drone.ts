// PROBE-7's body and animation (plan C and D). The rig steps with the simulation (dt = 1/60 s) and keeps only visual
// state: feet planted by a ground raycast and placed with 2-bone IK, idle bob, run lean, landing squash, dash
// afterimages, barrel recoil, blinking, the field emitter's spin, damage panels, death and boot.
//
// Local frame: the chassis centre is the origin, +x is the side the drone faces. The 36 × 48 collision box holds the
// 34 × 26 chassis at its top and the legs in the 22 px below (decision 2).
import type { Rect } from '../level/room';
import type { Sim } from '../sim';
import { HZ, TUNING, VITALS } from '../tuning';
import type { Fx } from './fx';
import { PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;
const A = TUNING.anim;
const DT = 1 / HZ;

/** The rounded-hex chassis outline, 34 × 26. */
const HULL: [number, number][] = [[-11, -13], [11, -13], [17, 0], [11, 13], [-11, 13], [-17, 0]];
/** Six damage panels inside the hull (plan C): three on top, three below. */
const PANELS: [number, number][][] = [
  [[-9, -10], [-3, -10], [-3, -2], [-12, -2]],
  [[-1, -10], [5, -10], [5, -6], [-1, -6]],
  [[7, -10], [10, -10], [13, -2], [7, -2]],
  [[-12, 2], [-3, 2], [-3, 10], [-9, 10]],
  [[-1, 6], [7, 6], [7, 10], [-1, 10]],
  [[9, 2], [13, 2], [10, 10], [9, 10]],
];
const EYE = { x: 3, y: 1 };
const EMITTER = { x: -9, y: -1 };
const TURRET = { x: 8, y: -11 };
const HIP_Y = 11;
const HIPS = [-6, 6];

interface Ghost { x: number; y: number; rot: number; sx: number; sy: number; face: number; age: number }

export class DroneRig {
  t = 0;
  /** Foot positions in world px, and whether each is planted. */
  feet: { x: number; y: number; planted: boolean; lift: number }[] = [];
  private phase = 0;
  private blinkIn = 5;
  private blink = 0;
  private squash = 1; // vertical scale, springs back to 1
  private squashV = 0;
  private recoil = 0; // px back along the barrel
  private muzzle = 0; // steps left of the muzzle flash
  private lean = 0; // degrees, smoothed
  private sway = 0; // antenna, radians
  private swayV = 0;
  private spin = 0;
  private spinRate = 1;
  private thrust = 0; // 0..1 thruster glow
  private ghosts: Ghost[] = [];
  private ghostT = 0;
  private hurtFlash = 0;
  private sparkIn = [2, 2, 2, 2, 2, 2];
  private lastVx = 0;
  /** Which way the knees bend (-1..1): follows the facing, eased over about 120 ms so a turn never snaps. */
  kneeFace = 1;
  private lastFace = 0;
  /** The chassis centre in world px, as last drawn (for effects). */
  cx = 0;
  cy = 0;

  constructor(private rand: () => number = Math.random) {}

  /** One 60 Hz step of visual state, after sim.step. Reacts to the sim's fx records. */
  step(sim: Sim, fx: Fx, solids: Rect[]) {
    this.t += DT;
    const d = sim.drone;
    const speed = Math.abs(d.vx) * HZ;
    const cx = d.x, cy = d.y - d.h / 2 + 13;
    const face = d.facing;
    // hips are mirrored with the body, so hip i sits at cx + HIPS[i] × facing
    if (!this.feet.length) { this.feet = HIPS.map((hx) => ({ x: cx + hx * face, y: d.y + d.h / 2, planted: true, lift: 0 })); this.lastFace = face; this.kneeFace = face; }
    if (face !== this.lastFace) {
      // turning round mirrors the hips: hand each foot to the hip now on its side, and shift the step cycle half
      // a stride with it, so no foot jumps and the legs never cross
      this.feet.reverse();
      this.phase = (this.phase + 0.5) % 1;
      this.lastFace = face;
    }
    this.kneeFace += (face - this.kneeFace) * (1 - Math.exp(-DT / 0.04)); // 95% there in 120 ms

    for (const f of sim.fx) {
      if (f.t === 'land') {
        const k = Math.min(1, f.speed / 900);
        this.squash = 1 - (1 - A.squash) * Math.max(0.35, k);
        this.squashV = 0;
        fx.dust(f.x, f.y, Math.round(A.landDust * Math.max(0.4, k)), 1 + k * 2.2);
      } else if (f.t === 'jump') {
        this.thrust = Math.max(this.thrust, 0.8);
        fx.dust(f.x, f.y, 4, 1.2, 0.3);
      } else if (f.t === 'shot') {
        this.recoil = A.barrel > 0 ? TUNING.feel.recoil : 0;
        this.muzzle = TUNING.feel.muzzleSteps;
      } else if (f.t === 'hurt') {
        this.hurtFlash = Math.round((A.hurtFlashMs / 1000) * HZ);
      } else if (f.t === 'dash') {
        this.ghostT = 0;
        this.thrust = 1;
      } else if (f.t === 'respawn') {
        // re-plant the feet under the respawned body
        this.feet = HIPS.map((hx) => ({ x: cx + hx * face, y: d.y + d.h / 2, planted: true, lift: 0 }));
      }
    }

    // idle bob is computed at draw time from t; squash springs back to 1 in about 120 ms
    const kq = 2 * Math.PI / (A.squashMs / 1000 * 2);
    this.squashV += (1 - this.squash) * kq * kq * DT - this.squashV * 18 * DT;
    this.squash += this.squashV * DT;
    this.recoil = Math.max(0, this.recoil - (TUNING.feel.recoil / (TUNING.feel.recoilMs / 1000)) * DT);
    this.muzzle = Math.max(0, this.muzzle - 1);
    this.hurtFlash = Math.max(0, this.hurtFlash - 1);

    // lean: into the run, back while charging a throw
    const charge = sim.field.on ? sim.field.charge : 0;
    // backpedalling (moving away from the aim side) leans half as much: the drone is bracing, not running
    const back = d.vx * face < 0 ? 0.5 : 1;
    const want = (d.vx * HZ / 240) * A.lean * back - (sim.field.on && sim.field.held ? charge * TUNING.field.lean * Math.sign(sim.aim.x || 1) : 0);
    this.lean += (want - this.lean) * 0.25;
    // antenna: a damped spring pushed by horizontal acceleration
    const ax = (d.vx - this.lastVx) * HZ;
    this.lastVx = d.vx;
    this.swayV += (-this.sway * 140 - this.swayV * 6 - ax * 0.004) * DT;
    this.sway += this.swayV * DT;
    // emitter spin: fast and glowing while the field is on
    this.spinRate += ((sim.field.on ? 9 : 1.2) - this.spinRate) * 0.15;
    this.spin += this.spinRate * DT;
    this.thrust = Math.max(d.dash ? 1 : !d.grounded && d.vy < 0 ? 0.25 : 0, this.thrust - DT * 3);

    // blink every 4-7 s
    if (this.blink > 0) this.blink -= DT;
    else if ((this.blinkIn -= DT) <= 0) { this.blink = 0.13; this.blinkIn = A.blinkMin + this.rand() * (A.blinkMax - A.blinkMin); }

    // dash afterimages: one every 30 ms while dashing, each fading over 150 ms
    for (const g of this.ghosts) g.age += DT * 1000;
    this.ghosts = this.ghosts.filter((g) => g.age < A.afterimageFadeMs);
    if (d.dash) {
      if (this.ghostT <= 0 && this.ghosts.length < A.afterimages) {
        this.ghosts.push({ x: cx, y: cy, rot: this.lean, sx: d.dash.dx !== 0 ? A.dashStretch : 1, sy: d.dash.dx !== 0 ? 1 / A.dashStretch : A.dashStretch, face: d.facing, age: 0 });
        this.ghostT = A.afterimageMs;
      }
      this.ghostT -= DT * 1000;
    }

    // feet: step cycle tied to speed (22 px stride); planted feet stay put on the ground until their swing
    const ground = (x: number) => groundY(solids, x, cy + HIP_Y - 2, cy + HIP_Y + 40);
    const dying = sim.dying > 0;
    if (d.grounded && !dying) {
      const dir = Math.sign(d.vx) || 1;
      this.phase = (this.phase + (speed * DT) / (A.stride * 2)) % 1;
      HIPS.forEach((hx, i) => {
        const f = this.feet[i];
        const hip = cx + hx * face;
        if (speed < 12) {
          // idle: settle each foot under its hip
          const tx = hip + hx * face * 0.3;
          f.x += (tx - f.x) * 0.25;
          f.y = ground(f.x) ?? d.y + d.h / 2;
          f.lift *= 0.7;
          return;
        }
        const p = (this.phase + i * 0.5) % 1;
        if (p < 0.5) {
          // stance: foot stays where it was planted
          if (!f.planted) {
            f.planted = true;
            f.x = hip + dir * A.stride / 2;
            if (speed > 240 * A.dustAt) fx.dust(f.x, d.y + d.h / 2, 1, 0.8, 0.3);
          }
          f.lift = 0;
        } else {
          // swing: arc forward to the next plant
          f.planted = false;
          const s = (p - 0.5) / 0.5;
          f.x = hip + dir * (-A.stride / 2 + A.stride * s);
          f.lift = Math.sin(s * Math.PI) * 7;
        }
        f.y = (ground(f.x) ?? d.y + d.h / 2) - f.lift;
      });
    } else {
      // airborne (or dying): legs tuck 40% toward the hips
      HIPS.forEach((hx, i) => {
        const f = this.feet[i];
        const reach = (d.y + d.h / 2 - (cy + HIP_Y)) * (dying ? 0.15 : 1 - A.tuck);
        const tx = cx + hx * face - d.vx * 1.2, ty = cy + HIP_Y + reach;
        f.x += (tx - f.x) * 0.35;
        f.y += (ty - f.y) * 0.35;
        f.planted = false;
      });
    }

    // unrepaired panels spark every 1.5-3 s
    sim.panels.forEach((ok, i) => {
      if (ok || dying) return;
      if ((this.sparkIn[i] -= DT) > 0) return;
      this.sparkIn[i] = A.panelSparkMin + this.rand() * (A.panelSparkMax - A.panelSparkMin);
      const p = PANELS[i][0];
      fx.sparks(cx + p[0] * d.facing, cy + p[1], 0, -1, 3, PAL.gold, 2.5, 1.4);
    });
  }

  /**
   * Each leg's hip, knee and foot in world px for a chassis centre (cx, cy). The knees bend toward the facing side
   * (eased through kneeFace on a turn); `pull` draws the feet up toward the hips (the death drop).
   */
  pose(cx: number, cy: number, tilt = this.lean, face = this.lastFace || 1, squashX = 1, squashY = 1, pull = 0) {
    return HIPS.map((hx, i) => {
      const f = this.feet[i] ?? { x: cx + hx * face, y: cy + HIP_Y + 20 };
      const hip = rotate(hx * squashX, HIP_Y * squashY, tilt, face);
      const hipX = cx + hip.x, hipY = cy + hip.y;
      const fy = hipY + (f.y - hipY) * (1 - pull);
      return { hipX, hipY, knee: ik(hipX, hipY, f.x, fy, A.leg, A.leg, this.kneeFace) };
    });
  }

  /** Draw the drone at its interpolated box centre (x, y). */
  draw(c: C, sim: Sim, x: number, y: number, opts: { reducedFlash: boolean; reduced: boolean }) {
    const d = sim.drone, v = sim.vitals;
    const face = d.facing;
    const dying = sim.dying > 0, k = dying ? 1 - sim.dying / VITALS.deathSteps : 0;
    let cx = x, cy = y - d.h / 2 + 13;
    const bob = d.grounded && Math.abs(d.vx) < 0.3 && !dying && !opts.reduced ? Math.sin(this.t * Math.PI * 2 * A.bobHz) * A.bob : 0;
    cy += bob;
    // death: the chassis drops to the ground and tilts
    let tilt = this.lean;
    if (dying) {
      const drop = (y + d.h / 2 - 13) - cy;
      cy += drop * easeIn(k);
      tilt = this.lean + face * 18 * easeIn(k);
    }
    this.cx = cx;
    this.cy = cy;

    // boot flicker and i-frame flicker
    let alpha = 1;
    if (sim.booting > 0) alpha = (Math.floor(this.t * 30) % 3 === 0 ? 0.25 : 1) * (1 - sim.booting / VITALS.bootSteps) + 0.15;
    else if (v.iFrames > 0 && !dying) alpha = Math.floor(this.t * TUNING.vitals.blinkHz * 2) % 2 ? (opts.reducedFlash ? 0.6 : 0.3) : 1;

    c.save();
    c.globalAlpha = alpha;
    c.lineJoin = 'round';
    c.lineCap = 'round';

    // afterimages
    for (const g of this.ghosts) {
      const a = 1 - g.age / A.afterimageFadeMs;
      c.save();
      c.globalAlpha = alpha * a * 0.5;
      c.translate(g.x, g.y);
      c.rotate((g.rot * Math.PI) / 180);
      c.scale(g.face * g.sx, g.sy);
      c.strokeStyle = PAL.trace;
      c.lineWidth = 2;
      hullPath(c);
      c.stroke();
      c.restore();
    }

    const squashY = dying ? 1 : this.squash, squashX = 1 + (1 - squashY) * 0.6;
    const stretch = d.dash ? A.dashStretch : 1;
    const dashH = d.dash && Math.abs(d.dash.dx) >= Math.abs(d.dash.dy);

    // legs (world space, behind the chassis)
    c.strokeStyle = PAL.line;
    c.lineWidth = 2.5;
    this.pose(cx, cy, tilt, face, squashX, squashY, dying ? easeIn(k) * 0.85 : 0).forEach(({ hipX, hipY, knee }, i) => {
      c.globalAlpha = alpha * (i === 0 ? 0.75 : 1); // the far leg slightly dimmer
      c.beginPath();
      c.moveTo(hipX, hipY);
      c.lineTo(knee.x, knee.y);
      c.lineTo(knee.fx, knee.fy);
      c.stroke();
      // foot: the toe points the way the drone faces, mirrored exactly
      c.beginPath();
      c.moveTo(knee.fx - 3 * face, knee.fy);
      c.lineTo(knee.fx + 4 * face, knee.fy);
      c.stroke();
      // knee joint
      c.fillStyle = PAL.fill;
      c.beginPath();
      c.arc(knee.x, knee.y, 2.2, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    c.globalAlpha = alpha;

    // thruster flame under the chassis
    if (this.thrust > 0.02 && !dying) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const fl = 6 + this.thrust * 14 + (opts.reduced ? 0 : Math.sin(this.t * 60) * 2);
      const g = c.createLinearGradient(cx, cy + 12, cx, cy + 12 + fl);
      g.addColorStop(0, rgba(PAL.trace, 0.9 * this.thrust));
      g.addColorStop(1, rgba(PAL.neon, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(cx - 5, cy + 12);
      c.lineTo(cx + 5, cy + 12);
      c.lineTo(cx, cy + 12 + fl);
      c.closePath();
      c.fill();
      c.restore();
    }

    // chassis (local frame)
    c.save();
    c.translate(cx, cy);
    c.rotate((tilt * Math.PI) / 180);
    if (d.dash) c.scale(face * (dashH ? stretch : 1 / stretch), dashH ? 1 / stretch : stretch);
    else c.scale(face * squashX, squashY);

    // antenna (behind the hull)
    c.strokeStyle = PAL.line;
    c.lineWidth = 1.5;
    const tip = { x: -6 + Math.sin(this.sway - 0.2) * 9, y: -13 - Math.cos(this.sway - 0.2) * 9 };
    c.beginPath();
    c.moveTo(-6, -13);
    c.lineTo(tip.x, tip.y);
    c.stroke();
    c.fillStyle = dying ? PAL.idle : PAL.neon;
    c.beginPath();
    c.arc(tip.x, tip.y, 1.8, 0, Math.PI * 2);
    c.fill();

    // hull
    const flashing = this.hurtFlash > 0 && !opts.reducedFlash;
    c.fillStyle = flashing ? '#FFFFFF' : PAL.fill;
    c.strokeStyle = this.hurtFlash > 0 ? '#FFFFFF' : PAL.line;
    c.lineWidth = LINE_W;
    hullPath(c);
    c.fill();
    c.stroke();

    // damage panels: repaired = glowing trace, broken = dashed outline
    if (!flashing) {
      PANELS.forEach((pts, i) => {
        const ok = sim.panels[i];
        c.beginPath();
        pts.forEach(([px, py], j) => (j ? c.lineTo(px, py) : c.moveTo(px, py)));
        c.closePath();
        if (ok) {
          const pulse = Math.max(0, 1 - sim.panelAge[i] / ((A.repairPulseMs / 1000) * HZ));
          c.fillStyle = rgba(PAL.trace, 0.12 + 0.5 * pulse);
          c.fill();
          c.strokeStyle = rgba(PAL.trace, 0.55 + 0.45 * pulse);
          c.lineWidth = 1;
          c.stroke();
        } else {
          c.setLineDash([2, 2]);
          c.strokeStyle = rgba(PAL.gold, 0.7);
          c.lineWidth = 1;
          c.stroke();
          c.setLineDash([]);
        }
      });
    }

    // field emitter ring on the back
    const fieldOn = sim.field.on;
    c.save();
    c.translate(EMITTER.x, EMITTER.y);
    c.strokeStyle = fieldOn ? PAL.trace : rgba(PAL.trace, 0.55);
    c.lineWidth = 1.5;
    if (fieldOn) { c.shadowColor = PAL.trace; c.shadowBlur = 10; }
    c.beginPath();
    c.arc(0, 0, A.emitter / 2, 0, Math.PI * 2);
    c.stroke();
    c.rotate(this.spin);
    c.beginPath();
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2;
      c.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
      c.lineTo(Math.cos(a) * (A.emitter / 2 - 1.5), Math.sin(a) * (A.emitter / 2 - 1.5));
    }
    c.stroke();
    c.restore();

    // eye: socket, glowing lens tracking the cursor, pupil, blink
    const look = toLocal(sim.aimAt.x - cx, sim.aimAt.y - cy, tilt, face);
    const ll = Math.hypot(look.x, look.y) || 1;
    const lens = { x: EYE.x + (look.x / ll) * 1.5, y: EYE.y + (look.y / ll) * 1.5 };
    c.fillStyle = PAL.bgDeep;
    c.beginPath();
    c.arc(EYE.x, EYE.y, A.eye / 2 + 2, 0, Math.PI * 2);
    c.fill();
    const eyeA = dying ? 1 - k : sim.booting > 0 ? (Math.floor(this.t * 24) % 2 ? 0.2 : 1) : 1;
    const open = this.blink > 0 ? Math.abs(Math.cos((this.blink / 0.13) * Math.PI)) : 1;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(PAL.trace, 0.25 * eyeA);
    c.beginPath();
    c.arc(lens.x, lens.y, A.eye / 2 + 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = rgba(PAL.trace, eyeA);
    c.beginPath();
    c.ellipse(lens.x, lens.y, A.eye / 2, (A.eye / 2) * Math.max(0.12, open), 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    if (open > 0.3) {
      c.fillStyle = rgba(PAL.bgDeep, eyeA);
      c.beginPath();
      c.arc(lens.x + (look.x / ll) * (A.pupil - 1.5), lens.y + (look.y / ll) * (A.pupil - 1.5) * open, 1.6, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // turret on the front shoulder, aimed at the cursor (world space so the aim is exact)
    if (!dying) {
      const piv = rotate(TURRET.x * squashX, TURRET.y * squashY, tilt, face);
      const px = cx + piv.x, py = cy + piv.y;
      // before the probe comes online (Level 1's first room) the tool arm hangs limp and dark
      const armed = sim.kit.gun;
      const ax = armed ? sim.aim.x : face * 0.32, ay = armed ? sim.aim.y : 0.95;
      const back = this.recoil;
      const charging = sim.weapon === 'charged' ? sim.charge : 0;
      c.strokeStyle = PAL.line;
      c.fillStyle = PAL.fill;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, 4.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      const bx = px + ax * (A.barrel - back), by = py + ay * (A.barrel - back);
      c.lineWidth = 4;
      c.strokeStyle = PAL.line;
      c.beginPath();
      c.moveTo(px + ax * (2 - back), py + ay * (2 - back));
      c.lineTo(bx, by);
      c.stroke();
      c.lineWidth = 1.5;
      c.strokeStyle = !armed ? rgba(PAL.idle, 0.6) : charging > 0 ? PAL.neon : PAL.trace;
      c.beginPath();
      c.moveTo(px + ax * (4 - back), py + ay * (4 - back));
      c.lineTo(bx, by);
      c.stroke();
      if (charging > 0 || this.muzzle > 0) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        const r = this.muzzle > 0 ? (opts.reducedFlash ? 5 : 11) : 3 + charging * 8;
        const col = charging > 0 ? PAL.neon : PAL.trace;
        const g = c.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, rgba('#FFFFFF', opts.reducedFlash ? 0.4 : 0.95));
        g.addColorStop(0.35, rgba(col, 0.8));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.beginPath();
        c.arc(bx, by, r, 0, Math.PI * 2);
        c.fill();
        if (charging >= 1) {
          c.strokeStyle = rgba(PAL.neon, 0.6 + 0.4 * Math.sin(this.t * 30));
          c.lineWidth = 1;
          c.beginPath();
          c.arc(bx, by, 9, 0, Math.PI * 2);
          c.stroke();
        }
        c.restore();
      }
    }
    c.restore();
  }
}

const LINE_W = 2.5;
const easeIn = (t: number) => t * t;

function hullPath(c: C) {
  c.beginPath();
  const n = HULL.length, r = 4;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = HULL[(i + n - 1) % n], [x1, y1] = HULL[i], [x2, y2] = HULL[(i + 1) % n];
    if (i === 0) c.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
    c.arcTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2, r);
  }
  c.closePath();
}

/** Rotate a local point by `deg` and mirror by facing, to an offset in world px. */
function rotate(x: number, y: number, deg: number, face: number) {
  const a = (deg * Math.PI) / 180, lx = x * face;
  return { x: lx * Math.cos(a) - y * Math.sin(a), y: lx * Math.sin(a) + y * Math.cos(a) };
}
/** World offset → local frame (inverse of rotate). */
function toLocal(x: number, y: number, deg: number, face: number) {
  const a = (-deg * Math.PI) / 180;
  const rx = x * Math.cos(a) - y * Math.sin(a), ry = x * Math.sin(a) + y * Math.cos(a);
  return { x: rx * face, y: ry };
}

/** 2-bone IK: the knee for a hip and a foot target, bending toward the facing side (`face` in -1..1). */
function ik(hx: number, hy: number, fx: number, fy: number, l1: number, l2: number, face: number) {
  let dx = fx - hx, dy = fy - hy;
  let dist = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (dist > max) { dx *= max / dist; dy *= max / dist; dist = max; }
  if (dist < 1) dist = 1;
  const a = Math.atan2(dy, dx);
  const cosK = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const k = Math.acos(Math.max(-1, Math.min(1, cosK)));
  const ka = a - k * face;
  return { x: hx + Math.cos(ka) * l1, y: hy + Math.sin(ka) * l1, fx: hx + dx, fy: hy + dy };
}

/** The top of the highest solid under x between y0 and y1 (a ground raycast), or null. */
export function groundY(solids: Rect[], x: number, y0: number, y1: number): number | null {
  let best: number | null = null;
  for (const r of solids) {
    if (x < r.x || x > r.x + r.w) continue;
    if (r.y >= y0 && r.y <= y1 && (best === null || r.y < best)) best = r.y;
  }
  return best;
}

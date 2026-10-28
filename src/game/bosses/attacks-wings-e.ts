// Wing boss attacks, part E (Phase 8 Spec, section 5): address (inc-soc), mismatch (inc-customer) and bands (inc-pixel).
// Each shows its telegraph first, in real steps (1.5x on Story, plus Model Lens's steps, as timed() gives), then acts on
// an active clock that advances `speed` per step. Shot speeds are px/s and sweep speeds are px per real step, as the act 4
// attacks keep them, so only the timers scale. Hostile marks are PAL.hostile with a jagged edge or a "!". The ATTACKS
// table is in table.ts.
import type { Rect } from '../level/room';
import { norm, overlaps } from '../physics/geom';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ, frames } from '../tuning';
import { dashed, mid, pulse, tick, timed } from './attacks';
import type { G, Pt, Timed } from './attacks';
import type { Attack, AttackCtx } from './types';

/** A rect's outline with a zigzag edge: a tooth every 8 px, 4 px high. The jagged edge is the hostile mark that is not
 *  colour alone. Call it inside a path. */
function jaggedRect(g: G, r: Rect) {
  const corners: Pt[] = [
    { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
  ];
  g.moveTo(corners[0].x, corners[0].y);
  for (let k = 0; k < 4; k++) {
    const a = corners[k], b = corners[(k + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const n = Math.max(1, Math.round(len / 8));
    for (let i = 1; i <= n; i++) {
      const tooth = i < n && i % 2 === 1 ? 4 : 0;
      const s = (len * i) / n;
      g.lineTo(a.x + ux * s + uy * tooth, a.y + uy * s - ux * tooth);
    }
  }
  g.closePath();
}

/** Three velocities of `v` px/s from `from` aimed at `to`: the aimed one, and one `step` radians either side. */
function fan(from: Pt, to: Pt, v: number, step: number): Pt[] {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  return [-1, 0, 1].map((k) => ({ x: Math.cos(a + k * step) * v, y: Math.sin(a + k * step) * v }));
}

// ---- address (inc-soc, The Silent Peripheral) -----------------------------------------------------------------------

/** Four address windows, 80 x 80 px, labelled 0x00, 0x04, 0x08 and 0x0C, spread across the arena. They show a dashed
 *  telegraph (0.8 s, real steps), then soak drone shots for 3 s (active steps). In label order, 0.4 s apart, each window
 *  fires a 3 bolt spread at the drone (360 px/s, 9 each). */
const WINDOWS = 4, WIN = 80;
const LABELS = ['0x00', '0x04', '0x08', '0x0C'];
const WIN_WARN = frames(800);
const SOAK = frames(3000), VOLLEY_GAP = frames(400), HOLD = frames(500);
const SPREAD_STEP = 0.14, VOLLEY_V = 360, VOLLEY_DMG = 9;

interface Window { rect: Rect; label: string; fired: boolean }
interface AddressRun extends Timed { wins: Window[]; absorbed: number }

/** The window spots: two high and two low, spread from the left of the arena to the right, so no two share a column. */
function windowRects(c: AttackCtx): Rect[] {
  const a = c.arena;
  return LABELS.map((_, k) => ({
    x: a.x + a.w * (0.15 + 0.7 * (k / (WINDOWS - 1))) - WIN / 2,
    y: a.y + (k % 2 ? 0.62 : 0.12) * a.h,
    w: WIN, h: WIN,
  }));
}

/** Four windows open across the arena. For 3 s they soak drone shots (ctx.soak, each step). Then each fires its 3 bolt
 *  spread at the drone, in label order, 0.4 s apart. */
export const address: Attack<AddressRun> = {
  id: 'address',
  start(c) {
    const wins = windowRects(c).map((rect, k): Window => ({ rect, label: LABELS[k], fired: false }));
    return { ...timed(c, WIN_WARN), wins, absorbed: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    if (run.t < SOAK) {
      for (const w of run.wins) run.absorbed += c.soak(w.rect);
    }
    run.wins.forEach((w, k) => {
      if (w.fired || run.t < SOAK + k * VOLLEY_GAP) return;
      w.fired = true;
      const o = mid(w.rect);
      for (const v of fan(o, mid(c.drone), VOLLEY_V, SPREAD_STEP)) c.shoot(o.x, o.y, v.x, v.y, VOLLEY_DMG);
      c.sfx('laser');
    });
    return run.t >= SOAK + (WINDOWS - 1) * VOLLEY_GAP + HOLD;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    for (const w of run.wins) {
      const r = w.rect;
      g.save();
      g.beginPath();
      jaggedRect(g, r);
      if (tele) {
        g.setLineDash([6, 6]);
        g.strokeStyle = PAL.hostile;
        g.globalAlpha = 0.4 + 0.4 * pulse(t);
        g.lineWidth = LINE.world;
        g.stroke();
      } else if (!w.fired) {
        g.shadowColor = PAL.hostile;
        g.shadowBlur = LINE.enemyGlow;
        g.fillStyle = PAL.fill;
        g.fill();
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.enemy;
        g.stroke();
      } else {
        g.globalAlpha = 0.3;
        g.setLineDash([6, 6]);
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.world;
        g.stroke();
      }
      g.restore();
      if (!tele && !w.fired && run.t < SOAK) dashed(g, { x: r.x + 12, y: r.y + 12, w: r.w - 24, h: r.h - 24 }, PAL.trace, 0.6);
      g.save();
      g.font = `12px ${FONT}`;
      g.fillStyle = PAL.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(w.label, r.x + r.w / 2, r.y + r.h / 2);
      g.restore();
    }
  },
};

// ---- mismatch (inc-customer, The Board That Will Not Boot) ---------------------------------------------------------

/** Four telegraph lines run from spots on the arena's left side, aimed at the drone (0.7 s, real steps). Then four bolts
 *  fire from the mirrored spots on the right side, along the mirrored lines (420 px/s, 12 each). The real right side spots
 *  flash "!" for the last 0.2 s of the telegraph. The mirror is about the arena's centre x. */
const SOURCES = 4, MIS_WARN = frames(700), FLASH = frames(200), MIS_HOLD = frames(500);
const MIS_V = 420, MIS_DMG = 12, SPOT = 16, SPOT_INSET = 60;

interface Pair { left: Pt; right: Pt; aim: Pt }
interface MismatchRun extends Timed { pairs: Pair[]; target: Pt }

/** The four left spots, top to bottom, and their mirrored right spots. Each bolt's velocity runs along the mirror of the
 *  line from its left spot to the drone. */
export const mismatch: Attack<MismatchRun> = {
  id: 'mismatch',
  start(c) {
    const a = c.arena, d = mid(c.drone), cx = mid(a).x;
    /** The mirror is about the arena's centre x, so each right spot is 2 * cx minus its left spot. */
    const pairs = Array.from({ length: SOURCES }, (_, k): Pair => {
      const left = { x: a.x + SPOT_INSET, y: a.y + a.h * (0.15 + 0.2 * k) };
      const right = { x: 2 * cx - left.x, y: left.y };
      const u = norm({ x: -(d.x - left.x), y: d.y - left.y });
      return { left, right, aim: { x: u.x * MIS_V, y: u.y * MIS_V } };
    });
    return { ...timed(c, MIS_WARN), pairs, target: d };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('mirror');
      for (const p of run.pairs) c.shoot(p.right.x, p.right.y, p.aim.x, p.aim.y, MIS_DMG);
    }
    return run.t >= MIS_HOLD;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    const flashing = tele && run.age > run.tele - FLASH;
    if (tele) {
      g.save();
      g.setLineDash([8, 6]);
      g.strokeStyle = PAL.hostile;
      g.globalAlpha = 0.35 + 0.4 * pulse(t);
      g.lineWidth = LINE.world;
      g.beginPath();
      for (const p of run.pairs) {
        g.moveTo(p.left.x, p.left.y);
        g.lineTo(run.target.x, run.target.y);
      }
      g.stroke();
      g.restore();
    }
    for (const p of run.pairs) {
      for (const [spot, real] of [[p.left, false], [p.right, true]] as [Pt, boolean][]) {
        const r = { x: spot.x - SPOT / 2, y: spot.y - SPOT / 2, w: SPOT, h: SPOT };
        g.save();
        g.beginPath();
        jaggedRect(g, r);
        if (!tele) {
          g.fillStyle = real ? PAL.fill : rgba(PAL.idle, 0.2);
          g.fill();
        }
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.enemy;
        if (tele) g.setLineDash([4, 4]);
        g.stroke();
        g.restore();
        if (real && flashing) {
          g.save();
          g.font = `bold 18px ${FONT}`;
          g.fillStyle = PAL.hostile;
          g.globalAlpha = 0.4 + 0.6 * pulse(t);
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.fillText('!', spot.x, spot.y - SPOT / 2 - 2);
          g.restore();
        }
      }
    }
  },
};

// ---- bands (inc-pixel, The Banded Image) ---------------------------------------------------------------------------

/** A vertical band, 120 px wide, shows dashed at the arena's left edge (0.8 s, real steps), then sweeps right at 420 px/s,
 *  14 once. Then a horizontal band, 60 px tall, shows at the top with a 140 px gap at a random x (0.8 s), and sweeps down
 *  at 300 px/s, 14 once. */
const V_W = 120, V_SWEEP = 420;
const H_H = 60, GAP_W = 140, H_SWEEP = 300;
const BAND_WARN = frames(800), BAND_DMG = 14;

interface BandsRun extends Timed {
  /** 0: the vertical band. 1: the horizontal band. */
  n: number;
  arena: Rect;
  vert: Rect;
  /** The horizontal band's gap: its left edge, and the band's top. */
  gap: number;
  horizY: number;
  hit: boolean;
}

/** The horizontal band's pieces at height y: the band either side of the gap. A piece with no width is left out. */
function bandPieces(a: Rect, gap: number, y: number): Rect[] {
  return [
    { x: a.x, y, w: gap - a.x, h: H_H },
    { x: gap + GAP_W, y, w: a.x + a.w - gap - GAP_W, h: H_H },
  ].filter((p) => p.w > 0);
}

/** Starts the band `run.n`: its telegraph, and the hit flag for its sweep. */
function beginBand(c: AttackCtx, run: BandsRun) {
  run.age = 0;
  run.t = 0;
  run.tele = timed(c, BAND_WARN).tele;
  run.hit = false;
}

/** A vertical band sweeps the arena from left to right, then a horizontal band with a gap sweeps it from top to bottom.
 *  Each hurts the drone once, the first time it overlaps a piece of the band. */
export const bands: Attack<BandsRun> = {
  id: 'bands',
  start(c) {
    const a = c.arena;
    const gap = a.x + c.rand() * (a.w - GAP_W);
    return {
      ...timed(c, BAND_WARN),
      n: 0,
      arena: { ...a },
      vert: { x: a.x, y: a.y, w: V_W, h: a.h },
      gap,
      horizY: a.y,
      hit: false,
    };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx(run.n === 0 ? 'turret' : 'drop');
    const a = c.arena;
    if (run.n === 0) {
      run.vert.x += V_SWEEP / HZ;
      if (!run.hit && overlaps(c.drone, run.vert)) {
        run.hit = true;
        c.hurt(run.vert, BAND_DMG);
      }
      if (run.vert.x >= a.x + a.w) {
        run.n = 1;
        beginBand(c, run);
      }
      return false;
    }
    run.horizY += H_SWEEP / HZ;
    const hit = bandPieces(a, run.gap, run.horizY).find((p) => overlaps(c.drone, p));
    if (!run.hit && hit) {
      run.hit = true;
      c.hurt(hit, BAND_DMG);
    }
    return run.horizY >= a.y + a.h;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    const pieces = run.n === 0 ? [run.vert] : bandPieces(run.arena, run.gap, run.horizY);
    for (const r of pieces) {
      g.save();
      g.beginPath();
      jaggedRect(g, r);
      if (tele) {
        g.setLineDash([6, 6]);
        g.strokeStyle = PAL.hostile;
        g.globalAlpha = 0.4 + 0.4 * pulse(t);
        g.lineWidth = LINE.world;
      } else {
        g.shadowColor = PAL.hostile;
        g.shadowBlur = LINE.enemyGlow;
        g.fillStyle = rgba(PAL.hostile, 0.35);
        g.fill();
        g.strokeStyle = PAL.hostile;
        g.lineWidth = LINE.enemy;
      }
      g.stroke();
      g.restore();
    }
    if (tele && run.n === 1) {
      g.save();
      g.font = `12px ${FONT}`;
      g.fillStyle = PAL.ok;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('GAP', run.gap + GAP_W / 2, run.arena.y + H_H / 2);
      g.restore();
    }
  },
};

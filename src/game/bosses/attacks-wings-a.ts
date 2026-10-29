// Wing boss attacks, part A (Phase 8 Spec, section 5): noise (The Deaf Radio), ring (The Rail That Rings) and flips
// (The Flipping Bits). Each shows its telegraph first, in real steps (1.5x on Story, plus Model Lens's steps, as timed()
// gives), then acts on an active clock that advances `speed` per step. Speeds in px/s stay as the spec gives them; only
// the timers scale. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ, frames } from '../tuning';
import { dashed, landingFloor, mid, pulse, tick, timed } from './attacks';
import type { G, Pt, Timed } from './attacks';
import type { Attack } from './types';

/** A hostile band, wave or bit: a PAL.hostile fill with a soft glow and a zigzag top and bottom (never colour alone). */
function jagged(g: G, r: Rect, a: number) {
  const d = Math.min(6, r.h / 4), n = Math.max(2, Math.ceil(r.w / 12));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push({ x: r.x + (r.w * i) / n, y: r.y + (i % 2 ? d : 0) });
  for (let i = n; i >= 0; i--) pts.push({ x: r.x + (r.w * i) / n, y: r.y + r.h - (i % 2 ? 0 : d) });
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.shadowColor = PAL.hostile;
  g.shadowBlur = LINE.enemyGlow;
  g.beginPath();
  pts.forEach((p, i) => { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
  g.closePath();
  g.fillStyle = rgba(PAL.hostile, 0.35);
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.world;
  g.stroke();
  g.restore();
}

/** The SIGNAL slot: a bright green box with its label, open in the drone's band (always shown, so it is not colour alone). */
function slot(g: G, r: Rect) {
  g.save();
  g.fillStyle = rgba(PAL.ok, 0.12);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = PAL.ok;
  g.lineWidth = LINE.world;
  g.shadowColor = rgba(PAL.ok, 0.8);
  g.shadowBlur = LINE.enemyGlow;
  g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  g.shadowBlur = 0;
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.ok;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SIGNAL', r.x + r.w / 2, r.y + r.h / 2);
  g.restore();
}

// ---- noise (inc-radio, The Deaf Radio) -----------------------------------------------------------------------------

/** Three static bands, the full arena width and 60 px tall. The middle one sits on the drone's height, the others 140 px
 *  above and below it, clipped to the arena. */
const BAND_H = 60, BAND_OFF = 140;
/** The middle band leaves a 160 px clear gap at a random x: the SIGNAL slot. */
const GAP_W = 160;
/** The dashed telegraph is 0.8 s (real steps). Then the bands are hazards for 2.5 s (active steps), 8 damage on touch. */
const NOISE_WARN = frames(800);
const NOISE_MS = 2500, NOISE_ON = frames(NOISE_MS), NOISE_DMG = 8;

interface Band { rect: Rect; gap: Rect | null }
interface NoiseRun extends Timed { bands: Band[] }

/** A band's hostile parts: the band itself, or the two parts either side of its SIGNAL gap. */
function pieces(b: Band): Rect[] {
  const r = b.rect, g = b.gap;
  if (!g) return [r];
  return [
    { x: r.x, y: r.y, w: g.x - r.x, h: r.h },
    { x: g.x + g.w, y: r.y, w: r.x + r.w - (g.x + g.w), h: r.h },
  ].filter((p) => p.w > 0);
}

/** Three static bands, the middle one on the drone's height, each turned into 8 damage hazards after its telegraph. The
 *  middle band's gap is the SIGNAL slot, and it stays clear. */
export const noise: Attack<NoiseRun> = {
  id: 'noise',
  start(c) {
    const a = c.arena, my = mid(c.drone).y;
    const gapX = a.x + c.rand() * (a.w - GAP_W);
    const bands: Band[] = [];
    [-BAND_OFF, 0, BAND_OFF].forEach((dy, i) => {
      const top = Math.max(a.y, my + dy - BAND_H / 2), bot = Math.min(a.y + a.h, my + dy + BAND_H / 2);
      if (bot <= top) return;
      const rect: Rect = { x: a.x, y: top, w: a.w, h: bot - top };
      bands.push({ rect, gap: i === 1 ? { x: gapX, y: top, w: GAP_W, h: bot - top } : null });
    });
    return { ...timed(c, NOISE_WARN), bands };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('laser');
      for (const b of run.bands) for (const p of pieces(b)) c.hazard(p, NOISE_MS, NOISE_DMG);
    }
    return run.t >= NOISE_ON;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    for (const b of run.bands) {
      for (const p of pieces(b)) {
        if (tele) dashed(g, p, PAL.hostile, 0.4 + 0.4 * pulse(t));
        else jagged(g, p, 1);
      }
      if (b.gap) slot(g, b.gap);
    }
  },
};

// ---- ring (inc-rail, The Rail That Rings) ---------------------------------------------------------------------------

/** The floor under the boss flashes for 0.6 s (real steps). Then 3 ground waves leave the boss's foot both ways, 0.6 s
 *  apart, each smaller than the last: 40, 28 and 16 px tall, for 12, 10 and 8 damage. */
const RING_WARN = frames(600);
const WAVES = 3, WAVE_GAP = frames(600), WAVE_V = 500 / HZ, WAVE_W = 48;
const WAVE_H = [40, 28, 16], WAVE_DMG = [12, 10, 8];

interface Wave { dir: number; k: number; x: number; h: number; dmg: number; at: number; live: boolean; out: boolean; hit: boolean }
interface RingRun extends Timed {
  /** The boss's foot and the floor it stands on. */
  foot: Pt;
  floorY: number;
  /** The flashing line along the floor under the boss. */
  span: Rect;
  waves: Wave[];
}

/** A wave's hurt rect: WAVE_W wide, standing on the floor. */
function waveRect(run: RingRun, w: Wave): Rect {
  return { x: w.x - WAVE_W / 2, y: run.floorY - w.h, w: WAVE_W, h: w.h };
}

/** The floor under the boss flashes, then three waves leave its foot both ways, 0.6 s apart. Each wave hurts the drone
 *  once when it reaches it, and a wave that has left the arena is spent. */
export const ring: Attack<RingRun> = {
  id: 'ring',
  start(c) {
    const b = c.boss, foot: Pt = { x: b.x + b.w / 2, y: b.y + b.h };
    const floorY = landingFloor(c, foot.x, foot.x + 1, foot.y).y;
    const waves: Wave[] = [];
    for (let k = 0; k < WAVES; k++) {
      for (const dir of [-1, 1]) {
        waves.push({ dir, k, x: foot.x, h: WAVE_H[k], dmg: WAVE_DMG[k], at: k * WAVE_GAP, live: false, out: false, hit: false });
      }
    }
    return { ...timed(c, RING_WARN), foot, floorY, span: { x: b.x, y: floorY, w: b.w, h: 0 }, waves };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('laser');
    const a = c.arena;
    for (const w of run.waves) {
      if (w.out || run.t < w.at) continue;
      if (!w.live && w.dir < 0) c.sfx('chain');
      w.live = true;
      w.x += w.dir * WAVE_V;
      const r = waveRect(run, w);
      if (!w.hit && overlaps(r, c.drone)) {
        w.hit = true;
        c.hurt(r, w.dmg);
      }
      w.out = w.dir < 0 ? r.x + r.w <= a.x : r.x >= a.x + a.w;
    }
    return run.waves.every((w) => w.out);
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      const r = run.span;
      g.save();
      g.globalAlpha = 0.4 + 0.5 * pulse(t);
      g.strokeStyle = PAL.hostile;
      g.lineWidth = LINE.enemy;
      g.shadowColor = rgba(PAL.hostile, 0.9);
      g.shadowBlur = LINE.enemyGlow;
      g.beginPath();
      g.moveTo(r.x, r.y);
      g.lineTo(r.x + r.w, r.y);
      g.stroke();
      g.shadowBlur = 0;
      g.font = `14px ${FONT}`;
      g.fillStyle = PAL.hostile;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText('!', run.foot.x, r.y - 6);
      g.restore();
      return;
    }
    for (const w of run.waves) if (w.live && !w.out) jagged(g, waveRect(run, w), 1);
  },
};

// ---- flips (inc-bitflip, The Flipping Bits) ------------------------------------------------------------------------

/** Ten bits fall from the arena top at random x, 0.12 s apart. Each has a 0.6 s dashed column first, then falls at 450 px/s
 *  for 8 damage on touch. A bit that lands as a "1" spawns a Spark, at most 2 per attack. */
const BITS = 10, BIT_GAP = frames(120), BIT_WARN = frames(600), BIT = 16;
const BIT_V = 450 / HZ, BIT_DMG = 8, SPARKS = 2;
/** A landed bit shows for 0.5 s (active steps), then goes. The lanes show for the 0.6 s telegraph (real steps). */
const BIT_REST = frames(500), FLIP_WARN = frames(600);

type BitState = 'wait' | 'column' | 'fall' | 'land' | 'gone';
interface Bit {
  x: number;
  /** The bit's value: a "1" lands as a Spark. */
  one: boolean;
  floorY: number;
  /** Active step its column appears, and the step it starts to fall (0.6 s later). */
  at: number;
  fall: number;
  y: number;
  state: BitState;
  age: number;
  hit: boolean;
}
interface FlipsRun extends Timed { bits: Bit[]; sparks: number; top: number }

/** The bit's hurt rect. */
const bitRect = (b: Bit): Rect => ({ x: b.x, y: b.y, w: BIT, h: BIT });

/** A bit's column: from the arena top to the floor under it. */
const lane = (run: FlipsRun, b: Bit): Rect => ({ x: b.x, y: run.top, w: BIT, h: b.floorY - run.top });

/** A bit: a PAL.fill square with a hostile outline and its value, "1" or "0". */
function cell(g: G, r: Rect, one: boolean, a: number) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = PAL.fill;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.shadowColor = rgba(PAL.hostile, 0.9);
  g.shadowBlur = LINE.enemyGlow;
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.shadowBlur = 0;
  g.font = `12px ${FONT}`;
  g.fillStyle = one ? PAL.trace : PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(one ? '1' : '0', r.x + r.w / 2, r.y + r.h / 2);
  g.restore();
}

/** Ten bits, each with its own column 0.6 s before it falls. The telegraph shows every bit's lane, so the drone can see
 *  where they will come. A falling bit hurts 8 once. Bits that land as "1" spawn a Spark, two at most. */
export const flips: Attack<FlipsRun> = {
  id: 'flips',
  start(c) {
    const a = c.arena;
    const bits: Bit[] = Array.from({ length: BITS }, (_, k): Bit => {
      const x = a.x + c.rand() * (a.w - BIT);
      const one = c.rand() < 0.5;
      return {
        x, one, floorY: landingFloor(c, x, x + BIT, a.y).y,
        at: k * BIT_GAP, fall: k * BIT_GAP + BIT_WARN, y: a.y, state: 'wait', age: 0, hit: false,
      };
    });
    return { ...timed(c, FLIP_WARN), bits, sparks: 0, top: a.y };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    for (const b of run.bits) {
      if (b.state === 'wait' && run.t >= b.at) b.state = 'column';
      if (b.state === 'column' && run.t >= b.fall) b.state = 'fall';
      if (b.state === 'fall') {
        b.y += BIT_V;
        const r = bitRect(b);
        if (!b.hit && overlaps(r, c.drone)) {
          b.hit = true;
          c.hurt(r, BIT_DMG);
        }
        if (b.y + BIT >= b.floorY) {
          b.y = b.floorY - BIT;
          b.state = 'land';
          if (b.one && run.sparks < SPARKS) {
            run.sparks++;
            c.spawn('spark', b.x + BIT / 2, b.floorY - BIT / 2);
            if (run.sparks === 1) c.sfx('laser');
          }
        }
      } else if (b.state === 'land') {
        b.age += speed;
        if (b.age >= BIT_REST) b.state = 'gone';
      }
    }
    return run.bits.every((b) => b.state === 'gone');
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      for (const b of run.bits) dashed(g, lane(run, b), PAL.hostile, 0.2 + 0.3 * pulse(t));
      return;
    }
    for (const b of run.bits) {
      if (b.state === 'column') {
        const r = lane(run, b);
        dashed(g, r, PAL.hostile, 0.8);
        g.save();
        g.font = `14px ${FONT}`;
        g.fillStyle = PAL.hostile;
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillText('!', r.x + r.w / 2, r.y + 4);
        g.restore();
      } else if (b.state === 'fall') {
        cell(g, bitRect(b), b.one, 1);
      } else if (b.state === 'land') {
        cell(g, bitRect(b), b.one, 1 - b.age / BIT_REST);
      }
    }
  },
};

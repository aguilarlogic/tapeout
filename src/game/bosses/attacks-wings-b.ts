// Wing boss attacks, part B (Phase 8 Spec, section 5): dies (The Wafer Map), cracks (The Field Returns) and hang (The 3
// A.M. Hang). Each shows its telegraph first, in real steps (1.5x on Story, plus Model Lens's steps, as timed() gives),
// then acts on an active clock that advances `speed` per step. Speeds in px/s stay as the spec gives them; only the
// timers scale. Hazards are given real milliseconds, so an active length of N steps is passed as N steps at `speed`, as
// attacks-act4b does. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ, STEP_MS, frames } from '../tuning';
import { dashed, landingFloor, light, mid, pulse, tick, timed, toward } from './attacks';
import type { G, Pt, Timed } from './attacks';
import type { Attack, AttackCtx } from './types';

/** Real milliseconds for `steps` active steps at `speed`, so the active clock keeps its length. */
const realMs = (steps: number, speed: number) => Math.round((steps * STEP_MS) / speed);

/** A rect shrunk by `d` on every side. */
const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

/** A filled hostile block with a soft glow: a live hazard. */
function hot(g: G, r: Rect, a: number) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 12;
  g.fillStyle = rgba(PAL.hostile, 0.35 * a);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A jagged hostile outline round a rect: its top and bottom edges zigzag, so the hazard reads by its shape. */
function jagged(g: G, r: Rect, a: number) {
  const n = Math.max(1, Math.round(r.w / 8)), tooth = 5;
  g.save();
  g.globalAlpha = a;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = r.x + (i * r.w) / n, y = r.y + (i % 2 ? tooth : 0);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  for (let i = n; i >= 0; i--) g.lineTo(r.x + (i * r.w) / n, r.y + r.h - (i % 2 ? tooth : 0));
  g.closePath();
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.world;
  g.stroke();
  g.restore();
}

/** A jagged hostile line along the floor from x0 to x1 at height y: a crack that has run this far. */
function seam(g: G, x0: number, x1: number, y: number) {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / 8));
  g.save();
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, yy = y + (i % 2 ? 4 : -4);
    if (i) g.lineTo(x, yy); else g.moveTo(x, yy);
  }
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.world;
  g.lineCap = 'round';
  g.stroke();
  g.restore();
}

/** A "!" in hostile red: the mark for a cell or line that is about to hurt, besides its colour. */
function bang(g: G, x: number, y: number, a: number) {
  g.save();
  g.globalAlpha = a;
  g.font = `bold 20px ${FONT}`;
  g.fillStyle = PAL.hostile;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', x, y);
  g.restore();
}

// ---- dies (inc-wafer, The Wafer Map) -------------------------------------------------------------------------------

/** The floor zone is the arena's bottom 120 px, split into 6 columns and 2 rows of die cells. */
const DIE_COLS = 6, DIE_ROWS = 2, ZONE_H = 120;
/** Each round, 4 cells glow for 0.9 s (real steps: the telegraph), then burst for 1 s (14 damage). Two rounds. */
const GLOW = frames(900), BURST = frames(1000), BURST_DMG = 14, ROUNDS = 2;

/** The three glow patterns, each lighting 4 cells: the two outer columns (the edge ring), the two middle columns (the
 *  centre cluster), and a checker of the four inner columns. */
const PATTERNS: ((col: number, row: number) => boolean)[] = [
  (col) => col === 0 || col === DIE_COLS - 1,
  (col) => col === 2 || col === 3,
  (col, row) => col >= 1 && col <= 4 && (col + row) % 2 === 0,
];

interface DiesRun extends Timed {
  /** The 12 die cells, row by row, over the floor zone. */
  cells: Rect[];
  /** The cells that glow this round (indices into cells). */
  glow: number[];
  /** The pattern picked at random for round 0. Round k uses the pattern k steps along from it, so the rounds differ. */
  first: number;
  round: number;
}

/** Starts round run.round: its glow (the telegraph) and its pattern. */
function beginDieRound(c: AttackCtx, run: DiesRun) {
  const pat = PATTERNS[(run.first + run.round) % PATTERNS.length];
  run.age = 0;
  run.t = 0;
  run.tele = timed(c, GLOW).tele;
  run.glow = run.cells.flatMap((_, i) => (pat(i % DIE_COLS, Math.floor(i / DIE_COLS)) ? [i] : []));
}

/** The floor zone splits into die cells. Four glow in a pattern for 0.9 s, then burst for 1 s (14 damage each cell that
 *  glows). This runs twice, with a different pattern each time. The glow is a dashed "!" box, the burst a jagged block. */
export const dies: Attack<DiesRun> = {
  id: 'dies',
  start(c) {
    const a = c.arena, top = a.y + a.h - ZONE_H, cw = a.w / DIE_COLS, ch = ZONE_H / DIE_ROWS;
    const cells = Array.from({ length: DIE_COLS * DIE_ROWS }, (_, i): Rect => ({
      x: a.x + (i % DIE_COLS) * cw, y: top + Math.floor(i / DIE_COLS) * ch, w: cw, h: ch,
    }));
    const first = Math.floor(c.rand() * PATTERNS.length);
    const run: DiesRun = { tele: 0, age: 0, t: 0, cells, glow: [], first, round: 0 };
    beginDieRound(c, run);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('drop');
      const ms = realMs(BURST, speed);
      for (const i of run.glow) c.hazard(run.cells[i], ms, BURST_DMG);
    }
    if (run.t < BURST) return false;
    run.round++;
    if (run.round >= ROUNDS) return true;
    beginDieRound(c, run);
    return false;
  },
  draw(g, run, t) {
    const bursting = run.age > run.tele;
    run.cells.forEach((r, i) => {
      if (!run.glow.includes(i)) {
        dashed(g, inset(r, 3), PAL.idle, 0.3);
        return;
      }
      const m = mid(r);
      if (bursting) {
        hot(g, r, 1);
        jagged(g, inset(r, 3), 1);
        return;
      }
      light(g, m.x, m.y, 60, PAL.hostile, 0.2 + 0.4 * pulse(t));
      dashed(g, inset(r, 3), PAL.hostile, 0.5 + 0.4 * pulse(t));
      bang(g, m.x, m.y, 0.6 + 0.4 * pulse(t));
    });
  },
};

// ---- cracks (inc-package, The Field Returns) -----------------------------------------------------------------------

/** Three cracks start at the boss's x on the floor, 0.7 s apart. Each shows a 0.4 s dashed lead, then runs toward the
 *  drone's x at 260 px/s, for up to 900 px (it stops at the drone's x if that comes first). Behind its tip it leaves
 *  16 px tall tiles of hazard, 48 px long each, that last 2 s (10 damage). A 0.6 s flash on the floor comes first. */
const CRACKS = 3, CRACK_GAP = frames(700), LEAD = frames(400), WIND_UP = frames(600);
const CRACK_V = 260, CRACK_MAX = 900, CRACK_H = 16, TILE = 48, TILE_DMG = 10, TILE_LIFE = frames(2000);
/** The dashed lead runs this far ahead of the tip, in px. */
const LEAD_PX = 60;

interface Crack {
  /** The active steps when the crack starts, and when its tip starts to run (after the lead). */
  at: number;
  go: number;
  /** The way it runs (-1 or 1) and how far in px: the drone's x or 900 px, whichever is nearer. */
  dir: number;
  len: number;
  /** Px run so far, and px already left as hazard tiles. */
  ran: number;
  tiled: number;
  moving: boolean;
  done: boolean;
  /** The active step the tip stopped. */
  doneAt: number;
}

/** A hazard tile left behind a tip: its rect and the active step it was laid. */
interface Tile { r: Rect; at: number }

interface CracksRun extends Timed {
  /** The boss's x, where every crack starts, and the floor under it. */
  x0: number;
  floorY: number;
  cracks: Crack[];
  tiles: Tile[];
}

/** Lays one hazard tile of a crack, from `a` to `b` px along it, lying on the floor. */
function tile(c: AttackCtx, speed: number, run: CracksRun, k: Crack, a: number, b: number) {
  const xa = run.x0 + k.dir * a, xb = run.x0 + k.dir * b;
  const r: Rect = { x: Math.min(xa, xb), y: run.floorY - CRACK_H, w: Math.abs(xb - xa), h: CRACK_H };
  c.hazard(r, realMs(TILE_LIFE, speed), TILE_DMG);
  run.tiles.push({ r, at: run.t });
}

/** Three cracks run from the boss's x toward the drone's x along the floor. Each tip leaves hazard tiles behind it. */
export const cracks: Attack<CracksRun> = {
  id: 'cracks',
  start(c) {
    const b = c.boss, x0 = mid(b).x, floorY = landingFloor(c, x0, x0, b.y + b.h).y;
    const dx = mid(c.drone).x;
    const dir = dx >= x0 ? 1 : -1;
    const toEdge = dir > 0 ? c.arena.x + c.arena.w - x0 : x0 - c.arena.x;
    const len = Math.min(CRACK_MAX, Math.abs(dx - x0), toEdge);
    const list = Array.from({ length: CRACKS }, (_, k): Crack => ({
      at: k * CRACK_GAP, go: k * CRACK_GAP + LEAD, dir, len, ran: 0, tiled: 0, moving: false, done: false, doneAt: 0,
    }));
    return { ...timed(c, WIND_UP), x0, floorY, cracks: list, tiles: [] };
  },
  step(run, c, speed) {
    if (tick(run, speed) === 'tele') return false;
    for (const k of run.cracks) {
      if (k.done || run.t < k.go) continue;
      if (!k.moving) {
        k.moving = true;
        c.sfx('laser');
      }
      k.ran = Math.min(k.len, k.ran + CRACK_V / HZ);
      while (k.tiled + TILE <= k.ran) {
        tile(c, speed, run, k, k.tiled, k.tiled + TILE);
        k.tiled += TILE;
      }
      if (k.ran >= k.len) {
        if (k.tiled < k.len) tile(c, speed, run, k, k.tiled, k.len);
        k.tiled = k.len;
        k.done = true;
        k.doneAt = run.t;
      }
    }
    // the attack ends once the last tile has gone, so the strips stay drawn for their 2 s
    return run.cracks.every((k) => k.done) && run.t >= Math.max(...run.cracks.map((k) => k.doneAt)) + TILE_LIFE;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      dashed(g, { x: run.x0 - 60, y: run.floorY - 6, w: 120, h: 6 }, PAL.hostile, 0.4 + 0.4 * pulse(t));
      return;
    }
    const y = run.floorY - 8;
    for (const k of run.cracks) {
      if (run.t < k.at) continue;
      const tip = run.x0 + k.dir * k.ran;
      if (k.moving) {
        seam(g, run.x0, tip, y);
      } else {
        g.save();
        g.beginPath();
        g.moveTo(run.x0, y);
        g.lineTo(run.x0 + k.dir * LEAD_PX, y);
        g.strokeStyle = PAL.hostile;
        g.globalAlpha = 0.4 + 0.4 * pulse(t);
        g.lineWidth = LINE.world;
        g.setLineDash([8, 6]);
        g.stroke();
        g.restore();
      }
    }
    for (const tl of run.tiles) {
      const age = run.t - tl.at;
      if (age >= TILE_LIFE) continue;
      const a = 1 - age / TILE_LIFE;
      hot(g, tl.r, a);
      jagged(g, tl.r, a);
    }
  },
};

// ---- hang (inc-hang, The 3 A.M. Hang) ------------------------------------------------------------------------------

/** Eight bolts appear frozen on a ring of radius 170 round the drone's spot. Their clock faces tick for 1.5 s (the
 *  telegraph), then all eight fire inward at once at 380 px/s (10 each). This runs twice. */
const BOLTS = 8, RING = 170, HANG_WARN = frames(1500), HANG_V = 380, HANG_DMG = 10, HANG_ROUNDS = 2;
/** The clock hand jumps one tick every 0.25 s (real steps), so it reads as a clock, not a smooth sweep. */
const TICK = frames(250);

interface HangRun extends Timed {
  /** The ring's centre: the drone's spot when the round began. */
  ctr: Pt;
  /** The eight frozen bolts. */
  bolts: Pt[];
  round: number;
}

/** Starts round run.round: the ring round the drone's spot, and its 1.5 s telegraph. */
function beginHangRound(c: AttackCtx, run: HangRun) {
  const d = mid(c.drone), a0 = c.rand() * (Math.PI / 4);
  run.ctr = d;
  run.bolts = Array.from({ length: BOLTS }, (_, k): Pt => {
    const a = a0 + (k * Math.PI * 2) / BOLTS;
    return { x: d.x + RING * Math.cos(a), y: d.y + RING * Math.sin(a) };
  });
  run.age = 0;
  run.t = 0;
  run.tele = timed(c, HANG_WARN).tele;
}

/** A frozen bolt: a spiky hostile disc with a clock face. Its hand sits at 12 and jumps one tick at a time. */
function clockBolt(g: G, p: Pt, ticks: number) {
  const R = 14, teeth = 12;
  g.save();
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 ? R * 0.7 : R, a = (i * Math.PI) / teeth;
    const x = p.x + r * Math.cos(a), y = p.y + r * Math.sin(a);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = PAL.fill;
  g.fill();
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.beginPath();
  for (let m = 0; m < 4; m++) {
    const a = m * (Math.PI / 2);
    g.moveTo(p.x + 9 * Math.cos(a), p.y + 9 * Math.sin(a));
    g.lineTo(p.x + 12 * Math.cos(a), p.y + 12 * Math.sin(a));
  }
  const hand = ticks * (Math.PI / 6) - Math.PI / 2;
  g.moveTo(p.x, p.y);
  g.lineTo(p.x + 9 * Math.cos(hand), p.y + 9 * Math.sin(hand));
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.world;
  g.stroke();
  g.restore();
}

/** Eight frozen bolts ring the drone's spot, their clocks ticking for 1.5 s. Then all eight fire inward at 380 px/s. */
export const hang: Attack<HangRun> = {
  id: 'hang',
  start(c) {
    const run: HangRun = { tele: 0, age: 0, t: 0, ctr: { x: 0, y: 0 }, bolts: [], round: 0 };
    beginHangRound(c, run);
    return run;
  },
  step(run, c, speed) {
    if (tick(run, speed) !== 'start') return false;
    c.sfx('turret');
    for (const p of run.bolts) {
      const v = toward(p, run.ctr, HANG_V);
      c.shoot(p.x, p.y, v.x, v.y, HANG_DMG);
    }
    run.round++;
    if (run.round >= HANG_ROUNDS) return true;
    beginHangRound(c, run);
    return false;
  },
  draw(g, run, t) {
    if (run.age > run.tele) return;
    const k = run.age / run.tele, ticks = Math.floor(run.age / TICK);
    g.save();
    g.beginPath();
    g.arc(run.ctr.x, run.ctr.y, RING, 0, Math.PI * 2);
    g.strokeStyle = rgba(PAL.hostile, 0.3 + 0.4 * pulse(t));
    g.lineWidth = LINE.world;
    g.setLineDash([6, 6]);
    g.stroke();
    g.restore();
    for (const p of run.bolts) {
      light(g, p.x, p.y, 26, PAL.hostile, 0.2 + 0.4 * k);
      clockBolt(g, p, ticks);
    }
  },
};

// Act 4 boss attacks, part B (Phase 7 Spec, section 6): reorder, evict, jam and predict. Each shows a telegraph first, in
// real steps (1.5x on Story, plus Model Lens), then acts on an active clock that advances `speed` per step, so timers
// scale with speed while the warnings stay as the spec gives them. Movement speeds are px per real step, as the act 1 to
// 3 attacks keep them, and shot speeds are px/s. Hazards and platforms are given real milliseconds, so an active length
// of N steps is passed as N steps of real time divided by speed, as congest does. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ, STEP_MS, frames } from '../tuning';
import { clamp, dashed, light, mid, pulse, tick, timed, toward } from './attacks';
import type { G, Pt, Timed } from './attacks';
import { hologramPorts, windowSlots } from './bodies-act4b';
import type { Attack, AttackCtx } from './types';

/** Real milliseconds for `steps` active steps at `speed`, so the active clock keeps its length. */
const realMs = (steps: number, speed: number) => Math.round((steps * STEP_MS) / speed);

/** A seeded shuffle of 0 to n-1, drawn from the attack's own generator. */
function shuffled(c: AttackCtx, n: number): number[] {
  const a = Array.from({ length: n }, (_, k) => k);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(c.rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A filled hazard with a soft glow, the same look as the act 3 hazards. */
function hot(g: G, r: Rect) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 12;
  g.fillStyle = rgba(PAL.hostile, 0.35);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.restore();
}

// ---- 16. reorder ---------------------------------------------------------------------------------------------------

const BOLTS = 6; // six numbered bolts, one in each slot
const BOLT_R = 16; // each bolt is a 32 px disc with its number in it
const LEAVE_GAP = frames(100); // active steps between bolts leaving, in a scrambled order (0.1 s)
const DRIFT = frames(1000); // active steps each bolt drifts for (1 s)
const DRIFT_V = 200 / HZ; // px per real step: 200 px/s while it drifts
const SPREAD = 0.35; // radians between neighbouring drift directions, so they fan out
const RETIRE_GAP = frames(300); // active steps between bolts retiring, in number order (0.3 s)
const RETIRE_V = 420; // px/s, the bolt flying at the drone
const RETIRE_DMG = 10;
/** The active step the last bolt stops drifting: every bolt has stopped by then, so retiring can start. */
const LAST_STOP = (BOLTS - 1) * LEAVE_GAP + DRIFT;

interface Bolt { x: number; y: number; slot: number; label: number; leave: number; dx: number; dy: number; gone: boolean }
interface ReorderRun extends Timed {
  bolts: Bolt[];
  /** How many bolts have retired so far. The next one to retire is number fired + 1. */
  fired: number;
}

/** Six numbered bolts sit in the window's slots. They leave in a scrambled order and drift for 1 s, then stop. Then they
 *  retire in number order, 1 to 6, each flying at the drone at 420 px/s, 0.3 s apart. The numbers are the telegraph. */
export const reorder: Attack<ReorderRun> = {
  id: 'reorder',
  start(c) {
    const m = mid(c.boss);
    const slots = windowSlots(m.x, m.y);
    const label = shuffled(c, BOLTS).map((v) => v + 1);
    // a scramble that is already in order would not be a scramble: swap the first two
    if (label.every((v, k) => v === k + 1)) [label[0], label[1]] = [label[1], label[0]];
    const order = shuffled(c, BOLTS);
    // the bolts must leave in a scrambled order too, not 1 to 6
    if (order.every((k, i) => label[k] === i + 1)) [order[0], order[1]] = [order[1], order[0]];
    const bolts: Bolt[] = slots.map((p, k) => ({
      x: p.x, y: p.y, slot: k, label: label[k], leave: 0, dx: 0, dy: 0, gone: false,
    }));
    order.forEach((k, i) => {
      const b = bolts[k];
      const a = (k - (BOLTS - 1) / 2) * SPREAD;
      b.leave = i * LEAVE_GAP;
      b.dx = Math.sin(a);
      b.dy = Math.cos(a);
    });
    return { ...timed(c, 60), bolts, fired: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    for (const b of run.bolts) {
      if (run.t >= b.leave && run.t < b.leave + DRIFT) {
        b.x += b.dx * DRIFT_V;
        b.y += b.dy * DRIFT_V;
      }
    }
    while (run.fired < BOLTS && run.t >= LAST_STOP + run.fired * RETIRE_GAP) {
      const n = run.fired + 1;
      if (run.fired === 0) c.sfx('laser');
      const b = run.bolts.find((x) => x.label === n);
      if (b) {
        const v = toward(b, mid(c.drone), RETIRE_V);
        c.shoot(b.x, b.y, v.x, v.y, RETIRE_DMG);
        b.gone = true;
      }
      run.fired++;
    }
    return run.fired >= BOLTS;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    for (const b of run.bolts) {
      if (b.gone) continue;
      light(g, b.x, b.y, 28, PAL.hostile, tele ? 0.2 + 0.3 * pulse(t) : 0.3);
      g.save();
      g.beginPath();
      g.arc(b.x, b.y, BOLT_R, 0, Math.PI * 2);
      g.fillStyle = PAL.fill;
      g.fill();
      g.strokeStyle = tele ? PAL.amber : PAL.hostile;
      g.lineWidth = LINE.enemy;
      g.stroke();
      g.font = `16px ${FONT}`;
      g.fillStyle = PAL.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(b.label), b.x, b.y);
      g.restore();
    }
  },
};

// ---- 17. evict -----------------------------------------------------------------------------------------------------

const CACHE_N = 4; // four cache lines
const CACHE_W = 160, CACHE_H = 16; // each is 160 x 16 px
const CACHE_UP = 110; // its bottom sits 110 px over the floor
const CACHE_LIFE = frames(5000); // a line lives 5 s
const CACHE_EVICT = 2; // two of them are evicted early
const WARN_BASE = 60; // the strip comes 1 s after the lines appear (lengthened on Story)
const STRIP_H = 24; // the MISS strip is 24 px tall, along the floor
const STRIP_STEPS = frames(3000); // and lasts 3 s
const STRIP_DMG = 12;
const FLASH_AT = frames(1500); // the evicted lines flash 1.5 s into the strip
const FLASH = frames(800); // for 0.8 s, then vanish
const STRIP_BOLTS = [frames(500), frames(1500), frames(2500)]; // three bolts while the strip is live
const BOLT_V = 360; // px/s, the same as the bolts attack
const BOLT_DMG = 10;

interface CacheLine { r: Rect; evicted: boolean }
interface EvictRun extends Timed {
  arena: Rect;
  lines: CacheLine[];
  /** The MISS strip along the floor, and the active steps until it turns on and off. */
  strip: Rect;
  warn: number;
  stripEnd: number;
  stripOn: boolean;
  /** The evicted lines start to flash at `flashAt` and are gone at `vanish` (active steps). */
  flashAt: number;
  vanish: number;
  /** Bolts fired so far while the strip is live. */
  shots: number;
  /** The active step the attack ends. */
  life: number;
}

/** Four cache lines appear over the floor, spread across the arena. 1 s later the floor turns into a MISS strip for 3 s.
 *  Two lines flash 1.5 s into the strip and vanish 0.8 s later, so the drone has to stand on the others. Three bolts
 *  fire while the strip is live. */
export const evict: Attack<EvictRun> = {
  id: 'evict',
  start(c) {
    const a = c.arena;
    // the arena floor is the lowest floor (landingFloor would pick a platform that only overlaps the width)
    const floorY = Math.max(a.y, ...c.floors.map((f) => f.y));
    const slot = a.w / CACHE_N;
    const picks = shuffled(c, CACHE_N);
    const lines: CacheLine[] = Array.from({ length: CACHE_N }, (_, k) => {
      const jitter = (c.rand() - 0.5) * 40;
      const x = clamp(a.x + k * slot + (slot - CACHE_W) / 2 + jitter, a.x, a.x + a.w - CACHE_W);
      return { r: { x, y: floorY - CACHE_UP - CACHE_H, w: CACHE_W, h: CACHE_H }, evicted: false };
    });
    for (const k of picks.slice(0, CACHE_EVICT)) lines[k].evicted = true;
    const warn = timed(c, WARN_BASE).tele;
    const flashAt = warn + FLASH_AT;
    const stripEnd = warn + STRIP_STEPS;
    return {
      ...timed(c, 48),
      arena: a,
      lines,
      strip: { x: a.x, y: floorY - STRIP_H, w: a.w, h: STRIP_H },
      warn,
      stripEnd,
      stripOn: false,
      flashAt,
      vanish: flashAt + FLASH,
      shots: 0,
      life: Math.max(CACHE_LIFE, stripEnd + frames(500)),
    };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('drop');
      for (const l of run.lines) {
        // an evicted line's platform time runs out at its vanish; the rest last the full 5 s
        const steps = l.evicted ? run.vanish : CACHE_LIFE;
        c.platform(l.r, realMs(steps, speed));
      }
    }
    if (!run.stripOn && run.t >= run.warn) {
      run.stripOn = true;
      c.hazard(run.strip, realMs(STRIP_STEPS, speed), STRIP_DMG);
      c.sfx('laser');
    }
    while (run.shots < STRIP_BOLTS.length && run.t >= run.warn + STRIP_BOLTS[run.shots]) {
      if (run.shots === 0) c.sfx('turret');
      const o = mid(c.boss), v = toward(o, mid(c.drone), BOLT_V);
      c.shoot(o.x, o.y, v.x, v.y, BOLT_DMG);
      run.shots++;
    }
    return run.t >= run.life;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      for (const l of run.lines) dashed(g, l.r, PAL.trace, 0.4 + 0.4 * pulse(t));
      return;
    }
    for (const l of run.lines) {
      if (l.evicted && run.t >= run.vanish) continue;
      if (l.evicted && run.t >= run.flashAt) {
        dashed(g, l.r, PAL.amber, 0.5 + 0.5 * pulse(t));
        continue;
      }
      g.save();
      g.fillStyle = PAL.fill;
      g.strokeStyle = PAL.trace;
      g.lineWidth = LINE.trace;
      g.fillRect(l.r.x, l.r.y, l.r.w, l.r.h);
      g.strokeRect(l.r.x, l.r.y, l.r.w, l.r.h);
      g.restore();
    }
    const s = run.strip;
    if (run.t < run.warn) {
      dashed(g, s, PAL.hostile, 0.4 + 0.4 * pulse(t));
    } else if (run.t < run.stripEnd) {
      hot(g, s);
      g.save();
      g.font = `14px ${FONT}`;
      g.fillStyle = PAL.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('MISS', s.x + s.w / 2, s.y + s.h / 2);
      g.restore();
    }
  },
};

// ---- 18. jam -------------------------------------------------------------------------------------------------------

const COLS = 5; // the arena splits into five columns
const LOCKED = 3; // three of them lock in each jam
const JAMS = 3; // three jams in a row
const JAM_LOCK = frames(800); // the lock is a 0.8 s dashed telegraph
const JAM_FILL = frames(2000); // the locked columns fill for 2 s
const JAM_DMG = 15; // a touch in a filled column
const PACKET_V = 500; // px/s, the packets falling in a filled column
const PACKETS = 4; // packets drawn in each filled column
const PACKET_H = 20;

interface Jam { cols: number[]; lockAt: number; fillAt: number; endAt: number; placed: boolean }
interface JamRun extends Timed {
  arena: Rect;
  colW: number;
  jams: Jam[];
}

/** The rect of column k, from the arena's top to its floor. */
const colRect = (a: Rect, colW: number, k: number): Rect => ({ x: a.x + k * colW, y: a.y, w: colW, h: a.h });

/** Three random columns of the five, in left to right order. */
function pickCols(c: AttackCtx): number[] {
  return shuffled(c, COLS).slice(0, LOCKED).sort((x, y) => x - y);
}

/** The arena is cut into five columns. In each of three jams, three of them lock (a 0.8 s dashed telegraph), then fill
 *  with packets falling at 500 px/s for 2 s. A touch of a filled column hurts 15. The two free columns are safe. */
export const jam: Attack<JamRun> = {
  id: 'jam',
  start(c) {
    const a = c.arena, colW = a.w / COLS;
    const lockSteps = timed(c, JAM_LOCK).tele;
    let prevEnd = 0;
    const jams: Jam[] = Array.from({ length: JAMS }, (_, j) => {
      const lockAt = prevEnd;
      // jam 0 locks during the real telegraph, so it fills at once; later locks take the same Story and lens rule
      const fillAt = j === 0 ? 0 : lockAt + lockSteps;
      const endAt = fillAt + JAM_FILL;
      prevEnd = endAt;
      return { cols: pickCols(c), lockAt, fillAt, endAt, placed: false };
    });
    return { ...timed(c, JAM_LOCK), arena: a, colW, jams };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    for (const j of run.jams) {
      if (j.placed || run.t < j.fillAt) continue;
      j.placed = true;
      c.sfx('drop');
      for (const k of j.cols) c.hazard(colRect(run.arena, run.colW, k), realMs(JAM_FILL, speed), JAM_DMG);
    }
    return run.t >= Math.max(...run.jams.map((j) => j.endAt));
  },
  draw(g, run, t) {
    const a = run.arena, tele = run.age <= run.tele;
    g.save();
    g.strokeStyle = rgba(PAL.idle, 0.5);
    g.lineWidth = LINE.world;
    g.setLineDash([6, 6]);
    for (let k = 1; k < COLS; k++) {
      const x = a.x + k * run.colW;
      g.beginPath();
      g.moveTo(x, a.y);
      g.lineTo(x, a.y + a.h);
      g.stroke();
    }
    g.restore();
    run.jams.forEach((j, n) => {
      const locking = tele ? n === 0 : run.t >= j.lockAt && run.t < j.fillAt;
      const filling = !tele && run.t >= j.fillAt && run.t < j.endAt;
      for (const k of j.cols) {
        const r = colRect(a, run.colW, k);
        if (locking) {
          dashed(g, r, PAL.hostile, 0.5 + 0.4 * pulse(t));
          label(g, 'LOCK', r);
        } else if (filling) {
          g.save();
          g.fillStyle = rgba(PAL.hostile, 0.15);
          g.fillRect(r.x, r.y, r.w, r.h);
          g.restore();
          packets(g, r, run.t - j.fillAt);
          label(g, 'FULL', r);
        }
      }
    });
  },
};

/** A short word at the top of a column, so the state reads without its colour. */
function label(g: G, text: string, r: Rect) {
  g.save();
  g.font = `14px ${FONT}`;
  g.fillStyle = PAL.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, r.x + r.w / 2, r.y + 24);
  g.restore();
}

/** Packets falling down a filled column at 500 px/s, `since` active steps into the fill. */
function packets(g: G, r: Rect, since: number) {
  const pw = r.w * 0.5, span = r.h, fall = (since / HZ) * PACKET_V;
  g.save();
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.world;
  for (let i = 0; i < PACKETS; i++) {
    const y = r.y + ((fall + (i * span) / PACKETS) % span);
    g.fillRect(r.x + (r.w - pw) / 2, y, pw, PACKET_H);
    g.strokeRect(r.x + (r.w - pw) / 2, y, pw, PACKET_H);
  }
  g.restore();
}

// ---- 19. predict ---------------------------------------------------------------------------------------------------

const PREDICT_V = 420; // px/s, the bolts
const PREDICT_DMG = 12;
/** The bolts fire 0.6 s after the lines fade. This gap is fixed, not lengthened by Story. */
const PREDICT_GAP = frames(600);
/** The bolts are still out for 0.5 s after they fire, which is when the attack ends. */
const PREDICT_TAIL = frames(500);

interface PredictRun extends Timed {
  /** One line per port, from the port to where the drone was when the lines were drawn. */
  lines: { from: Pt; to: Pt }[];
  fired: boolean;
}

/** Four telegraph lines show from the chip's ports to the drone for 0.6 s, then fade. 0.6 s later, each port fires a
 *  bolt (12 each, 420 px/s). The bolts aim at the drone where it is when they fire, not where the lines showed, so a
 *  drone that dodged early is still in the path. */
export const predict: Attack<PredictRun> = {
  id: 'predict',
  start(c) {
    const m = mid(c.boss), aim = mid(c.drone);
    const lines = hologramPorts(m.x, m.y).map((p) => ({ from: p, to: aim }));
    return { ...timed(c, 36), lines, fired: false };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('laser');
    if (!run.fired && run.t >= PREDICT_GAP) {
      run.fired = true;
      c.sfx('turret');
      for (const l of run.lines) {
        const v = toward(l.from, mid(c.drone), PREDICT_V);
        c.shoot(l.from.x, l.from.y, v.x, v.y, PREDICT_DMG);
      }
    }
    return run.fired && run.t >= PREDICT_GAP + PREDICT_TAIL;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      const a = 0.5 + 0.4 * pulse(t);
      g.save();
      g.strokeStyle = PAL.amber;
      g.globalAlpha = a;
      g.lineWidth = LINE.trace;
      g.shadowColor = rgba(PAL.amber, 0.8);
      g.shadowBlur = LINE.traceGlow;
      g.beginPath();
      for (const l of run.lines) {
        g.moveTo(l.from.x, l.from.y);
        g.lineTo(l.to.x, l.to.y);
      }
      g.stroke();
      g.restore();
      return;
    }
    if (run.fired) return;
    for (const l of run.lines) light(g, l.from.x, l.from.y, 20, PAL.amber, 0.3 + 0.4 * pulse(t));
  },
};

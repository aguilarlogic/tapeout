// Act 2 boss attacks (Phase 4 Spec, section 6): push, relay, split and stage. Each shows a telegraph first, in real
// steps (1.5x on Story), then acts on an active clock that advances `speed` per step, so shots and block cadence
// scale while the warnings and the hazards' own lengths stay as the spec gives them. Story runs fewer of each, as the
// act 1 attacks do. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { LINE, PAL, easeOut, rgba } from '../render/palette';
import { HZ, frames } from '../tuning';
import { clamp, dashed, landingFloor, light, mid, pulse, tick, timed, toward } from './attacks';
import type { G, Pt, Timed } from './attacks';
import type { Attack, AttackCtx } from './types';

/** One aimed shot of `v` px/s from `o` at the drone's centre. */
function aimed(c: AttackCtx, o: Pt, v: number, dmg: number) {
  const u = toward(o, mid(c.drone), v);
  c.shoot(o.x, o.y, u.x, u.y, dmg);
}

/** One square outline in a filled bar, the body of a push frame. */
function bar(g: G, r: Rect, a: number) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.trace;
  g.lineWidth = LINE.enemy;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A solid hazard: a hostile fill with a soft glow. */
function solid(g: G, r: Rect) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 12;
  g.fillStyle = rgba(PAL.hostile, 0.35);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A dashed horizontal line from x0 to x1 at height y: the MEM band's telegraph. */
function lineAcross(g: G, x0: number, y: number, x1: number, col: string, a: number) {
  g.save();
  g.strokeStyle = col;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([8, 6]);
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.restore();
}

// ---- 8. push -------------------------------------------------------------------------------------------------------

const PUSH_W = 140; // a frame is 140 x 20 px
const PUSH_H = 20;
const PUSH_STAY_MS = 2400; // how long the frames stay out, real time
const PUSH_STAY = frames(PUSH_STAY_MS); // the same, in steps
const PUSH_POP = frames(200); // steps of the pop flash after they go
const PUSH_SHOT = frames(800); // active steps between the slow bolts (0.8 s)
const PUSH_V = 300; // px/s, the slow bolt
const PUSH_DMG = 8;

interface Frame { r: Rect; x0: number }
interface PushRun extends Timed { plats: Frame[]; out: number; next: number }

/** Frames slide out of the boss's side (the drone's side) at three heights between the boss top and the floor. */
export const push: Attack<PushRun> = {
  id: 'push',
  start(c) {
    const b = c.boss;
    const left = mid(c.drone).x < mid(b).x;
    const span = Math.max(...c.floors.map((f) => f.y)) - b.y;
    const slots = c.story ? [0, 2] : [0, 1, 2];
    const plats = slots.map((k) => {
      const y = b.y + (span * (k + 1)) / 4 - PUSH_H / 2;
      const x = clamp(left ? b.x - 40 - PUSH_W : b.x + b.w + 40, c.arena.x, c.arena.x + c.arena.w - PUSH_W);
      return { r: { x, y, w: PUSH_W, h: PUSH_H }, x0: left ? b.x : b.x + b.w - PUSH_W };
    });
    return { ...timed(c, 36), plats, out: 0, next: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('chain');
      for (const p of run.plats) c.platform(p.r, PUSH_STAY_MS);
    }
    run.out = run.age - run.tele;
    if (run.out < PUSH_STAY) {
      if (run.t >= run.next) {
        // plats[0] is the top frame: the slots run down the arena.
        aimed(c, mid(run.plats[0].r), PUSH_V, PUSH_DMG);
        run.next += PUSH_SHOT;
      }
      return false;
    }
    return run.out >= PUSH_STAY + PUSH_POP;
  },
  draw(g, run, _t) {
    if (run.age <= run.tele) {
      const p = easeOut(run.age / run.tele);
      for (const f of run.plats) bar(g, { ...f.r, x: f.x0 + (f.r.x - f.x0) * p }, 1);
      return;
    }
    if (run.out < PUSH_STAY) {
      for (const f of run.plats) bar(g, f.r, 1);
      return;
    }
    const k = (run.out - PUSH_STAY) / PUSH_POP; // 0..1 through the pop flash
    for (const f of run.plats) {
      const r = f.r, e = 10 * k, m = mid(r);
      light(g, m.x, m.y, 60, PAL.trace, 0.5 * (1 - k));
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = PAL.line;
      g.lineWidth = LINE.world;
      g.strokeRect(r.x - e, r.y - e, r.w + 2 * e, r.h + 2 * e);
      g.restore();
    }
  },
};

// ---- 9. relay ------------------------------------------------------------------------------------------------------

const BLOCK_GAP = frames(700); // active steps between the five blocks firing (0.7 s)
const RELAY_TAIL = frames(1000); // real steps after the last block starts, when its hazards are gone
const IF_V = 420; // px/s, the IF fan
const IF_DMG = 8;
const WB_V = 360; // px/s, the WB spread
const WB_DMG = 6;
const FAN_STEP = 12; // degrees between the bolts of a fan
const RAD = Math.PI / 180;
const ID_TELE = frames(400); // real steps the ID columns are dashed before they hurt (0.4 s)
const ID_MS = 600; // how long the ID columns hurt
const ID_LIFE = frames(ID_MS);
const ID_DMG = 10;
const COLUMN_W = 40; // ID column width, px
const COLUMN_AT = 100; // px from the drone's centre to each ID column
const EX_TELE = frames(500); // real steps of the EX shadow (0.5 s)
const EX_MS = 500; // how long the heavy block hurts
const EX_LIFE = frames(EX_MS);
const EX_DMG = 14;
const HEAVY = 60; // the EX block is 60 x 60 px
const MEM_TELE = frames(400); // real steps of the MEM line (0.4 s)
const MEM_MS = 500; // how long the band hurts
const MEM_LIFE = frames(MEM_MS);
const MEM_DMG = 10;
const BAND_H = 20; // the MEM band is 20 px tall

interface RelayRun extends Timed {
  /** The block that started last (0..4), for the body. */
  block: number;
  /** The five block origins: the boss box's fifths along its top edge. */
  origins: Pt[];
  /** The real step each block started on, -1 before it does. */
  started: number[];
  /** The ID columns, set when block 1 starts. */
  cols: Rect[];
  /** The EX block's landing rect on the floor under the drone, and its shadow. */
  heavy: Rect;
  shadow: Rect;
  /** The MEM band, and the height of its telegraph line. */
  band: Rect;
  lineY: number;
}

const NONE: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Real steps since block i started, or -1 before it does. */
const since = (run: RelayRun, i: number) => (run.started[i] < 0 ? -1 : run.age - run.started[i]);

/** Block i starts: IF and WB fire their fans now, ID, EX and MEM set up their hazards and telegraphs. */
function startBlock(c: AttackCtx, run: RelayRun, i: number) {
  const d = mid(c.drone), a = c.arena;
  if (i === 0) fan(c, run.origins[0], c.story ? 2 : 3, IF_V, IF_DMG);
  if (i === 1) {
    const xs = c.story ? [d.x + COLUMN_AT] : [d.x - COLUMN_AT, d.x + COLUMN_AT];
    run.cols = xs.map((x) => ({ x: clamp(x - COLUMN_W / 2, a.x, a.x + a.w - COLUMN_W), y: a.y, w: COLUMN_W, h: a.h }));
  }
  if (i === 2) {
    const f = landingFloor(c, d.x, d.x, c.drone.y);
    const x = clamp(d.x - HEAVY / 2, f.x, f.x + f.w - HEAVY);
    run.shadow = { x, y: f.y - 4, w: HEAVY, h: 4 };
    run.heavy = { x, y: f.y - HEAVY, w: HEAVY, h: HEAVY };
  }
  if (i === 3) {
    run.lineY = d.y;
    run.band = { x: a.x, y: d.y - BAND_H / 2, w: a.w, h: BAND_H };
  }
  if (i === 4) fan(c, run.origins[4], c.story ? 3 : 5, WB_V, WB_DMG);
}

/** A fan of `n` bolts from `o` at the drone, `FAN_STEP` degrees apart, centred on the aim. */
function fan(c: AttackCtx, o: Pt, n: number, v: number, dmg: number) {
  const d = mid(c.drone), aim = Math.atan2(d.y - o.y, d.x - o.x);
  for (let k = 0; k < n; k++) {
    const a = aim + (k - (n - 1) / 2) * FAN_STEP * RAD;
    c.shoot(o.x, o.y, Math.cos(a) * v, Math.sin(a) * v, dmg);
  }
}

/** Five blocks fire in turn, 0.7 s apart, in one relay: IF bolts, ID columns, EX drop, MEM band, WB spread. */
export const relay: Attack<RelayRun> = {
  id: 'relay',
  start(c) {
    const b = c.boss;
    const origins = Array.from({ length: 5 }, (_, i) => ({ x: b.x + (b.w * (i + 0.5)) / 5, y: b.y }));
    return {
      ...timed(c, 36),
      block: 0,
      origins,
      started: [-1, -1, -1, -1, -1],
      cols: [],
      heavy: NONE,
      shadow: NONE,
      band: NONE,
      lineY: 0,
    };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    for (let i = 0; i < 5; i++) {
      if (run.started[i] < 0 && run.t >= i * BLOCK_GAP) {
        run.started[i] = run.age;
        run.block = i;
        startBlock(c, run, i);
      }
    }
    if (since(run, 1) === ID_TELE) {
      for (const col of run.cols) c.hazard(col, ID_MS, ID_DMG);
    }
    if (since(run, 2) === EX_TELE) c.hazard(run.heavy, EX_MS, EX_DMG);
    if (since(run, 3) === MEM_TELE) c.hazard(run.band, MEM_MS, MEM_DMG);
    return since(run, 4) >= RELAY_TAIL;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      for (const o of run.origins) light(g, o.x, o.y, 14, PAL.hostile, 0.2 + 0.2 * pulse(t));
      return;
    }
    run.origins.forEach((o, i) => {
      const s = since(run, i);
      if (s >= 0 && s < 6) light(g, o.x, o.y, 22, PAL.hostile, 0.8 - 0.1 * s);
    });
    const s1 = since(run, 1);
    if (s1 >= 0) {
      for (const col of run.cols) {
        if (s1 < ID_TELE) dashed(g, col, PAL.hostile, 0.8);
        else if (s1 < ID_TELE + ID_LIFE) solid(g, col);
      }
    }
    const s2 = since(run, 2);
    if (s2 >= 0) {
      if (s2 < EX_TELE) dashed(g, run.shadow, PAL.hostile, 0.8);
      else if (s2 < EX_TELE + EX_LIFE) solid(g, run.heavy);
    }
    const s3 = since(run, 3);
    if (s3 >= 0) {
      if (s3 < MEM_TELE) lineAcross(g, run.band.x, run.lineY, run.band.x + run.band.w, PAL.hostile, 0.8);
      else if (s3 < MEM_TELE + MEM_LIFE) solid(g, run.band);
    }
  },
};

// ---- 10. split -----------------------------------------------------------------------------------------------------

const SPLIT_LEN = frames(4000); // the attack lasts 4 s of active time
const LEFT_GAP = frames(1000); // active steps between the left half's bolts (1 Hz)
const RIGHT_GAP = HZ / 1.6; // active steps between the right half's bolts (1.6 Hz)
const SPLIT_V = 400; // px/s
const SPLIT_DMG = 8;
const LEFT_AT = 0.17; // where the left half fires from, as a fraction of the boss's width
const RIGHT_AT = 0.83; // and the right half

interface SplitRun extends Timed {
  origins: Pt[];
  /** The lamps for the body: left, right, then two unused. Lit for one frame on each shot. */
  lit: boolean[];
  nextL: number;
  nextR: number;
}

/** The two halves of the bridge fire at the drone out of step for 4 s, the right half faster. */
export const split: Attack<SplitRun> = {
  id: 'split',
  start(c) {
    const b = c.boss;
    return {
      ...timed(c, 36),
      origins: [{ x: b.x + b.w * LEFT_AT, y: b.y }, { x: b.x + b.w * RIGHT_AT, y: b.y }],
      lit: [false, false, false, false],
      nextL: 0,
      nextR: RIGHT_GAP / 2,
    };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    run.lit = [false, false, false, false];
    if (run.t < SPLIT_LEN) {
      if (run.t >= run.nextL) {
        aimed(c, run.origins[0], SPLIT_V, SPLIT_DMG);
        run.nextL += LEFT_GAP;
        run.lit[0] = true;
      }
      if (!c.story && run.t >= run.nextR) {
        aimed(c, run.origins[1], SPLIT_V, SPLIT_DMG);
        run.nextR += RIGHT_GAP;
        run.lit[1] = true;
      }
    }
    return run.t >= SPLIT_LEN;
  },
  draw(g, run, t) {
    run.origins.forEach((o, i) => {
      const on = run.lit[i];
      light(g, o.x, o.y, on ? 26 : 12, PAL.hostile, on ? 0.9 : 0.2 + 0.2 * pulse(t));
    });
  },
};

// ---- 11. stage -----------------------------------------------------------------------------------------------------

const SEGS = 5; // segments in the gate
const STAGE_SEG = frames(250); // active steps a bolt sits on each segment (0.25 s)
const STAGE_STALL = frames(500); // active steps a stalled segment holds it (0.5 s)
const STAGE_HEAD = frames(500); // steps between passes, after the head fires (0.5 s)
const STAGE_V = 520; // px/s
const STAGE_DMG = 12;

interface StageRun extends Timed {
  /** The pass running, 0-based. */
  pass: number;
  /** The segment the bolt is on (0..4, tail first), or SEGS once it has fired from the head. */
  bolt: number;
  /** The segment stalling the bolt right now, else -1. */
  stall: number;
  /** Per pass, the segment that stalls the bolt before it moves on (-1: none), rolled at the start. */
  stalls: number[];
  /** The active step the bolt next moves on. */
  until: number;
  /** The segment centres, tail first, and the head it fires from. */
  seg: Pt[];
  head: Pt;
}

/** How long the bolt sits on segment i: the stall's 0.5 s on the stalled one, 0.25 s on the rest. */
const dwell = (run: StageRun, i: number) => (run.stalls[run.pass] === i ? STAGE_STALL : STAGE_SEG);

/** A bolt passes down the gate's segments, then fires from the head nearer the drone. Three passes (two on Story). */
export const stage: Attack<StageRun> = {
  id: 'stage',
  start(c) {
    const b = c.boss, left = mid(c.drone).x < mid(b).x, y = b.y + b.h / 2;
    const seg = Array.from({ length: SEGS }, (_, i) => {
      const k = left ? SEGS - 1 - i : i; // tail first: the far end of the gate
      return { x: b.x + (b.w * (k + 0.5)) / SEGS, y };
    });
    const stalls: number[] = [];
    for (let p = 0; p < (c.story ? 2 : 3); p++) {
      stalls.push(c.rand() < 1 / 3 ? Math.floor(c.rand() * SEGS) : -1);
    }
    return {
      ...timed(c, 30),
      pass: 0,
      bolt: 0,
      stall: stalls[0] === 0 ? 0 : -1,
      stalls,
      until: 0,
      seg,
      head: { x: left ? b.x : b.x + b.w, y },
    };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('chain');
      run.until = run.t + dwell(run, 0);
    }
    if (run.t < run.until) return false;
    if (run.bolt < SEGS - 1) {
      run.bolt++;
      run.until += dwell(run, run.bolt);
    } else if (run.bolt === SEGS - 1) {
      aimed(c, run.head, STAGE_V, STAGE_DMG);
      run.bolt = SEGS;
      run.until += STAGE_HEAD;
    } else {
      run.pass++;
      if (run.pass >= run.stalls.length) return true;
      run.bolt = 0;
      run.until += dwell(run, 0);
    }
    run.stall = run.bolt < SEGS && run.stalls[run.pass] === run.bolt ? run.bolt : -1;
    return false;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    run.seg.forEach((s, i) => {
      if (tele) {
        light(g, s.x, s.y, 16, PAL.neon, 0.2 + 0.3 * pulse(t));
        return;
      }
      g.save();
      g.fillStyle = PAL.fill;
      g.strokeStyle = PAL.neon;
      g.lineWidth = LINE.enemy;
      g.fillRect(s.x - 7, s.y - 5, 14, 10);
      g.strokeRect(s.x - 7, s.y - 5, 14, 10);
      g.restore();
      if (run.stall === i) light(g, s.x, s.y, 26, PAL.hostile, 0.7);
    });
    light(g, run.head.x, run.head.y, 20, PAL.hostile, run.bolt === SEGS ? 0.9 : 0.3);
    if (tele) return;
    const at = run.bolt === SEGS ? run.head : run.bolt >= 0 ? run.seg[run.bolt] : null;
    if (!at) return;
    light(g, at.x, at.y, 14, PAL.hostile, 0.9);
    g.save();
    g.fillStyle = PAL.hostile;
    g.beginPath();
    g.arc(at.x, at.y, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  },
};

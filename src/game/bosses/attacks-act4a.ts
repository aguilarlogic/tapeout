// Act 4 boss attacks, part A (Phase 7 Spec, section 6): walls, holes, agents and assume. Each shows its telegraph first,
// in real steps (1.5x on Story, plus Model Lens's steps, as timed() gives), then acts on an active clock that advances
// `speed` per step. Speeds in px/s stay as the spec gives them; only the timers scale. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ, STEP_MS, frames } from '../tuning';
import { clamp, dashed, landingFloor, light, mid, pulse, tick, timed, toward } from './attacks';
import type { G, Pt, Timed } from './attacks';
import { trioSlot } from './bodies-act4a';
import type { Attack, AttackCtx } from './types';

/** A rect that is nothing, the placeholder before a set-up. */
const NONE: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** A hostile solid: a hostile fill with a soft glow. */
function solid(g: G, r: Rect) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 12;
  g.fillStyle = rgba(PAL.hostile, 0.35);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A block: a PAL.fill inside and a hostile outline. */
function drawBlock(g: G, r: Rect) {
  g.save();
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.restore();
}

/** A dashed horizontal line from x0 to x1 at height y: a beam's lane in its telegraph. */
function lineAcross(g: G, x0: number, y: number, x1: number, a: number) {
  g.save();
  g.strokeStyle = PAL.hostile;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([8, 6]);
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.restore();
}

/** A dashed ellipse: a hole's rim in its telegraph. */
function dashedOval(g: G, x: number, y: number, rx: number, ry: number, col: string, a: number) {
  g.save();
  g.strokeStyle = col;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([6, 6]);
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// ---- walls (inc-tb, The Pass That Checked Nothing) -----------------------------------------------------------------

/** Three PASS walls, one after another, a second apart. Each is 36 x 200 px with 60 HP and can be shot down. */
const WALLS = 3;
const WALL_GAP = frames(1000);
const WALL_W = 36, WALL_H = 200, WALL_HP = 60;
/** The walls slide out of the boss at 140 px/s toward the drone's centre. A wall that reaches the drone hurts it 12, once. */
const WALL_V = 140, WALL_DMG = 12;
/** A wall still standing after 6 s fades away (active steps). A broken or faded wall takes 0.5 s to go (active steps). */
const WALL_LIFE = frames(6000), SHATTER = frames(500);
/** The wind-up before the first wall: 0.7 s (real steps). */
const WALLS_WARN = frames(700);
/** A broken wall throws 6 pieces. */
const PIECES = 6;

type WallState = 'wait' | 'live' | 'broken' | 'spent' | 'gone';

interface PassWall {
  rect: Rect;
  hp: number;
  state: WallState;
  /** Active steps in the current state. */
  age: number;
  /** Where a broken wall broke, and the velocity of each piece (px per step). */
  origin: Pt;
  pieces: Pt[];
}

interface WallsRun extends Timed {
  /** The spot the walls slide out of: the boss's side that faces the drone, at its middle. */
  spot: Rect;
  walls: PassWall[];
}

/** A PASS wall: a PAL.fill block, a green outline and the word PASS read up the wall. */
function passWall(g: G, r: Rect, a: number) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.ok;
  g.lineWidth = LINE.enemy;
  g.shadowColor = rgba(PAL.ok, 0.8);
  g.shadowBlur = LINE.enemyGlow;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.shadowBlur = 0;
  g.translate(r.x + r.w / 2, r.y + r.h / 2);
  g.rotate(-Math.PI / 2);
  g.font = `14px ${FONT}`;
  g.fillStyle = PAL.ok;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PASS', 0, 0);
  g.restore();
}

/** A broken wall: a jagged hostile outline and the word FAIL, while its pieces fly off for 0.5 s. */
function failWall(g: G, w: PassWall) {
  const r = w.rect, a = 1 - w.age / SHATTER;
  const edge: Pt[] = [];
  for (let y = 0; y <= r.h; y += 10) edge.push({ x: r.x + (Math.floor(y / 10) % 2 ? 6 : 0), y: r.y + y });
  for (let y = r.h; y >= 0; y -= 10) edge.push({ x: r.x + r.w - (Math.floor(y / 10) % 2 ? 0 : 6), y: r.y + y });
  g.save();
  g.globalAlpha = a;
  g.beginPath();
  edge.forEach((p, i) => { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
  g.closePath();
  g.fillStyle = PAL.fill;
  g.fill();
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.translate(r.x + r.w / 2, r.y + r.h / 2);
  g.rotate(-Math.PI / 2);
  g.font = `14px ${FONT}`;
  g.fillStyle = PAL.hostile;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('FAIL', 0, 0);
  g.restore();
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.world;
  g.lineCap = 'round';
  for (const v of w.pieces) {
    const x = w.origin.x + v.x * w.age, y = w.origin.y + v.y * w.age;
    g.beginPath();
    g.moveTo(x - v.x * 2, y - v.y * 2);
    g.lineTo(x, y);
    g.stroke();
  }
  g.restore();
}

/** A wall's HP is gone: it breaks, throws its pieces and shows FAIL until they land. */
function breakWall(c: AttackCtx, w: PassWall) {
  w.state = 'broken';
  w.age = 0;
  w.origin = mid(w.rect);
  w.pieces = Array.from({ length: PIECES }, (_, i) => {
    const a = ((i + c.rand()) / PIECES) * Math.PI * 2, v = 1.5 + c.rand() * 2;
    return { x: Math.cos(a) * v, y: Math.sin(a) * v - 1 };
  });
  c.sfx('drop');
}

/** Three PASS walls slide out of the boss toward the drone, a second apart. Each reaches the drone and hurts it 12 once,
 *  or is shot down: friendly shots that hit it take its 60 HP (ctx.soak). A broken wall shows FAIL as it shatters. */
export const walls: Attack<WallsRun> = {
  id: 'walls',
  start(c) {
    const b = c.boss, d = mid(c.drone), m = mid(b);
    const spot: Rect = { x: d.x < m.x ? b.x : b.x + b.w - WALL_W, y: m.y - WALL_H / 2, w: WALL_W, h: WALL_H };
    const list: PassWall[] = Array.from({ length: WALLS }, (): PassWall => ({
      rect: { ...spot }, hp: WALL_HP, state: 'wait', age: 0, origin: { x: 0, y: 0 }, pieces: [],
    }));
    return { ...timed(c, WALLS_WARN), spot, walls: list };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('turret');
    run.walls.forEach((w, i) => {
      if (w.state === 'wait' && run.t >= i * WALL_GAP) w.state = 'live';
    });
    for (const w of run.walls) {
      if (w.state === 'live') {
        w.age += speed;
        w.hp -= c.soak(w.rect);
        if (w.hp <= 0) {
          breakWall(c, w);
        } else if (overlaps(w.rect, c.drone)) {
          c.hurt(w.rect, WALL_DMG);
          c.sfx('chain');
          w.state = 'spent';
          w.age = 0;
        } else if (w.age >= WALL_LIFE) {
          w.state = 'spent';
          w.age = 0;
        } else {
          const v = toward(mid(w.rect), mid(c.drone), WALL_V / HZ);
          w.rect.x += v.x;
          w.rect.y += v.y;
          c.platform(w.rect, STEP_MS);
        }
      } else if (w.state === 'broken' || w.state === 'spent') {
        w.age += speed;
        if (w.age >= SHATTER) w.state = 'gone';
      }
    }
    return run.walls.every((w) => w.state === 'gone');
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      dashed(g, run.spot, PAL.ok, 0.4 + 0.4 * pulse(t));
      return;
    }
    for (const w of run.walls) {
      if (w.state === 'live') passWall(g, w.rect, 1);
      else if (w.state === 'spent') passWall(g, w.rect, 1 - w.age / SHATTER);
      else if (w.state === 'broken') failWall(g, w);
    }
  },
};

// ---- holes (inc-cov, Stuck at 94 Percent) --------------------------------------------------------------------------

/** Three Coverage Holes open on the floor, 300 px apart. Each shows a dashed telegraph (0.8 s, real steps), then spawns
 *  2 Sparks and stays open for 4 s (active steps). The holes do no damage themselves. */
const HOLES = 3, HOLE_GAP = 300;
const HOLE_WARN = frames(800);
const HOLE_OPEN = frames(4000);
const SPARKS = 2;
/** A hole is a 40 x 24 px ellipse, lying on the floor. It closes over its last 0.5 s (active steps). */
const HOLE_RX = 20, HOLE_RY = 12, CLOSE = frames(500);

interface HolesRun extends Timed {
  /** Each hole's centre, on the floor under it. */
  holes: Pt[];
}

/** Three holes open on the floor, in a row 300 px apart, centred on the arena. Each spawns two Sparks as it opens, then
 *  closes after 4 s. The telegraph is the dashed rim. */
export const holes: Attack<HolesRun> = {
  id: 'holes',
  start(c) {
    const cx = mid(c.arena).x;
    const list = Array.from({ length: HOLES }, (_, i): Pt => {
      const x = cx + (i - (HOLES - 1) / 2) * HOLE_GAP;
      return { x, y: landingFloor(c, x - HOLE_RX, x + HOLE_RX, c.arena.y).y - HOLE_RY };
    });
    return { ...timed(c, HOLE_WARN), holes: list };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('turret');
      for (const h of run.holes) {
        for (let k = 0; k < SPARKS; k++) c.spawn('spark', h.x + (k ? 12 : -12), h.y);
      }
    }
    return run.t >= HOLE_OPEN;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      for (const h of run.holes) dashedOval(g, h.x, h.y, HOLE_RX, HOLE_RY, PAL.hostile, 0.4 + 0.4 * pulse(t));
      return;
    }
    const open = Math.max(0, Math.min(1, (HOLE_OPEN - run.t) / CLOSE));
    if (open <= 0) return;
    for (const h of run.holes) {
      g.save();
      g.beginPath();
      g.ellipse(h.x, h.y, HOLE_RX * open, HOLE_RY * open, 0, 0, Math.PI * 2);
      g.fillStyle = PAL.bgDeep;
      g.fill();
      g.setLineDash([4, 4]);
      g.strokeStyle = PAL.hostile;
      g.lineWidth = LINE.world;
      g.stroke();
      g.restore();
    }
  },
};

// ---- agents (inc-uvm, The Misbehaving Environment) -----------------------------------------------------------------

/** Three sub-attacks in turn: the driver, the monitor and the scoreboard. Each is telegraphed for 0.6 s (real steps),
 *  and its box in the trio body lights while it runs (through `lit`, which the body reads). */
const SUBS = 3;
const SUB_WARN = frames(600);
const SUB_SFX = ['turret', 'laser', 'drop'] as const;
/** The driver fires 5 bolts 0.1 s apart, at 420 px/s, 10 each. */
const DRIVER_SHOTS = 5, DRIVER_GAP = frames(100), DRIVER_V = 420, DRIVER_DMG = 10;
/** The monitor sweeps a 120 x 12 px beam along the drone's height at 600 px/s, 15 once. */
const BEAM_W = 120, BEAM_H = 12, BEAM_V = 600, BEAM_DMG = 15;
/** The scoreboard drops a 120 px block on the drone's spot at the drop attack's fall speed, 20 once. It rests on the
 *  floor for 0.5 s after it lands. */
const BLOCK = 120, BLOCK_V = 900 / HZ, BLOCK_DMG = 20, BLOCK_REST = frames(500);

interface AgentsRun extends Timed {
  /** The sub-attack under way: 0 driver, 1 monitor, 2 scoreboard. */
  n: number;
  /** The box that is running, in the trio body. */
  slot: Rect;
  /** The lit boxes (through BodyState.lit): only the running sub-attack's. */
  lit: boolean[];
  /** Driver: bolts fired so far. */
  shots: number;
  /** Monitor: the beam, its direction (-1 left, 1 right) and its lane (the telegraph's line). */
  beam: Rect;
  dir: number;
  /** Scoreboard: the block, the floor it lands on, and steps since it landed. Its lane is the telegraph's column. */
  block: Rect;
  floorY: number;
  landed: boolean;
  rest: number;
  /** Whether the running sub-attack has hurt the drone yet. */
  hit: boolean;
  lane: Rect;
}

/** Starts sub-attack run.n: its telegraph, its lit box and its set-up (the beam's line or the block's column). */
function beginSub(c: AttackCtx, run: AgentsRun) {
  const a = c.arena, d = mid(c.drone);
  run.age = 0;
  run.t = 0;
  run.tele = timed(c, SUB_WARN).tele;
  run.slot = trioSlot(c.boss, run.n);
  run.lit = [false, false, false, false];
  run.lit[run.n] = true;
  run.shots = 0;
  run.hit = false;
  run.landed = false;
  run.rest = 0;
  if (run.n === 1) {
    const y = d.y - BEAM_H / 2;
    run.dir = d.x < mid(a).x ? -1 : 1;
    run.beam = { x: run.dir < 0 ? a.x + a.w : a.x - BEAM_W, y, w: BEAM_W, h: BEAM_H };
    run.lane = { x: a.x, y, w: a.w, h: BEAM_H };
  }
  if (run.n === 2) {
    const x = clamp(d.x - BLOCK / 2, a.x, a.x + a.w - BLOCK);
    run.floorY = landingFloor(c, x, x + BLOCK, a.y).y;
    run.block = { x, y: a.y - BLOCK, w: BLOCK, h: BLOCK };
    run.lane = { x, y: a.y, w: BLOCK, h: run.floorY - a.y };
  }
}

/** The running sub-attack is over: the next one starts (after its telegraph), or the attack ends after the third. */
function advance(c: AttackCtx, run: AgentsRun): boolean {
  run.n++;
  if (run.n >= SUBS) return true;
  beginSub(c, run);
  return false;
}

/** Driver, monitor, then scoreboard, each telegraphed for 0.6 s. The driver fires a stream of five bolts; the monitor
 *  sweeps a beam at the drone's height across the arena; the scoreboard drops a block on the drone's spot. */
export const agents: Attack<AgentsRun> = {
  id: 'agents',
  start(c) {
    const run: AgentsRun = {
      ...timed(c, SUB_WARN), n: 0, slot: NONE, lit: [false, false, false, false], shots: 0,
      beam: NONE, dir: 1, block: NONE, floorY: 0, landed: false, rest: 0, hit: false, lane: NONE,
    };
    beginSub(c, run);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx(SUB_SFX[run.n]);
    if (run.n === 0) {
      if (run.shots < DRIVER_SHOTS && run.t >= run.shots * DRIVER_GAP) {
        const o: Pt = { x: run.slot.x + run.slot.w / 2, y: run.slot.y + run.slot.h };
        const v = toward(o, mid(c.drone), DRIVER_V);
        c.shoot(o.x, o.y, v.x, v.y, DRIVER_DMG);
        run.shots++;
      }
      return run.shots >= DRIVER_SHOTS ? advance(c, run) : false;
    }
    if (run.n === 1) {
      run.beam.x += (run.dir * BEAM_V) / HZ;
      if (!run.hit && overlaps(c.drone, run.beam)) {
        run.hit = true;
        c.hurt(run.beam, BEAM_DMG);
      }
      const a = c.arena;
      const out = run.dir < 0 ? run.beam.x + run.beam.w <= a.x : run.beam.x >= a.x + a.w;
      return out ? advance(c, run) : false;
    }
    if (!run.landed) {
      run.block.y += BLOCK_V;
      if (!run.hit && overlaps(c.drone, run.block)) {
        run.hit = true;
        c.hurt(run.block, BLOCK_DMG);
      }
      if (run.block.y + BLOCK >= run.floorY) {
        run.block.y = run.floorY - BLOCK;
        run.landed = true;
      }
      return false;
    }
    run.rest += speed;
    return run.rest >= BLOCK_REST ? advance(c, run) : false;
  },
  draw(g, run, _t) {
    const tele = run.age <= run.tele;
    const k = run.age / run.tele;
    if (run.n === 0) {
      if (tele) light(g, run.slot.x + run.slot.w / 2, run.slot.y + run.slot.h, 20, PAL.hostile, 0.3 + 0.5 * k);
      return;
    }
    if (run.n === 1) {
      const y = run.lane.y + run.lane.h / 2;
      if (tele) lineAcross(g, run.lane.x, y, run.lane.x + run.lane.w, 0.2 + 0.6 * k);
      else solid(g, run.beam);
      return;
    }
    if (tele) dashed(g, run.lane, PAL.hostile, 0.3 + 0.5 * k);
    else drawBlock(g, run.block);
  },
};

// ---- assume (inc-formal, Proved, Mostly) ---------------------------------------------------------------------------

/** Four walls close a 520 px box round the drone. They are dashed for 0.8 s (real steps), then solid for 4 s. Inside,
 *  six shots fall from the box's top, one every 0.5 s, at x on the blind spot side: the right half, where the engine
 *  body has its dark wedge. The walls block movement only. */
const CAGE = 520, CAGE_T = 12;
const ASSUME_WARN = frames(800);
const SOLID_MS = 4000, SOLID = frames(SOLID_MS);
const SHOTS = 6, SHOT_GAP = frames(500), SHOT_V = 360, SHOT_DMG = 10;

interface AssumeRun extends Timed {
  /** The box round the drone, and its four walls (top, bottom, left, right). */
  cage: Rect;
  walls: Rect[];
  /** The x of each shot, picked at the start on the right half of the box. */
  xs: number[];
  shots: number;
}

/** A box of four walls closes round the drone. The walls are dashed for 0.8 s, then they lock solid for 4 s: a platform
 *  each, so they block movement but do no damage. Six shots fall from the top of the box on its blind spot side. */
export const assume: Attack<AssumeRun> = {
  id: 'assume',
  start(c) {
    const a = c.arena, d = mid(c.drone);
    const cage: Rect = {
      x: clamp(d.x - CAGE / 2, a.x, a.x + a.w - CAGE),
      y: clamp(d.y - CAGE / 2, a.y, a.y + a.h - CAGE),
      w: CAGE, h: CAGE,
    };
    const walls: Rect[] = [
      { x: cage.x, y: cage.y, w: cage.w, h: CAGE_T },
      { x: cage.x, y: cage.y + cage.h - CAGE_T, w: cage.w, h: CAGE_T },
      { x: cage.x, y: cage.y, w: CAGE_T, h: cage.h },
      { x: cage.x + cage.w - CAGE_T, y: cage.y, w: CAGE_T, h: cage.h },
    ];
    const xs = Array.from({ length: SHOTS }, () => cage.x + cage.w / 2 + c.rand() * (cage.w / 2));
    return { ...timed(c, ASSUME_WARN), cage, walls, xs, shots: 0 };
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('chain');
      for (const w of run.walls) c.platform(w, SOLID_MS);
    }
    if (run.shots < SHOTS && run.t >= run.shots * SHOT_GAP) {
      if (run.shots === 0) c.sfx('turret');
      c.shoot(run.xs[run.shots], run.cage.y, 0, SHOT_V, SHOT_DMG);
      run.shots++;
    }
    return run.t >= SOLID;
  },
  draw(g, run, t) {
    if (run.age <= run.tele) {
      dashed(g, run.cage, PAL.hostile, 0.4 + 0.4 * pulse(t));
      return;
    }
    g.save();
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.trace;
    g.lineWidth = LINE.enemy;
    g.shadowColor = rgba(PAL.trace, 0.8);
    g.shadowBlur = LINE.enemyGlow;
    for (const w of run.walls) {
      g.fillRect(w.x, w.y, w.w, w.h);
      g.strokeRect(w.x, w.y, w.w, w.h);
    }
    g.shadowBlur = 0;
    g.font = `12px ${FONT}`;
    g.fillStyle = PAL.trace;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ASSUME', run.cage.x + run.cage.w / 2, run.cage.y + 30);
    g.restore();
    for (let k = run.shots; k < SHOTS; k++) light(g, run.xs[k], run.cage.y + 12, 10, PAL.hostile, 0.5);
  },
};

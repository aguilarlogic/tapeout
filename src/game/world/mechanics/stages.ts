// Discovery beat 10, The Pipeline (Phase 4 Spec, section 4): five conveyor stages, IF, ID, EX, MEM and WB, on a
// raised shelf. Every tick (0.8 s, 1.2 s on Story) each crate moves one stage on, strictly one stage at a time.
// Crates enter at ticks 0, 1 and 2. Crate 2 is a slow multiply (MUL): it must spend two ticks in EX before it may
// move on. So when it sits in EX on its first tick, crate 3 steps from ID into EX and the two jam. The amber EX lamp
// lights on exactly that tick. The STALL EX lever holds stage 3 and everything behind it for one tick: crate 2 gets
// its second EX tick, crate 3 waits in ID, and then the belt moves on. A jam flashes the two crates red, drops the
// belt and restarts after 1.5 s.
import { blink, easeInOut, FONT, LINE, PAL, ROLE } from '../../render/palette';
import type { Station, StoryRoom } from '../../story/types';
import { frames, HZ } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** Stage labels, left to right. Stage 3 (index 2) is EX. */
const LABELS = ['IF', 'ID', 'EX', 'MEM', 'WB'];
/** Index of EX: the stage the lever stalls and whose lamp hints. */
const EX = 2;
/** Index of IF, the stage crates enter, and the stage number past the plate's end. */
const IN = 0, PLATE_POS = 5;
/** Five stages of 220 px from x 260 to 1360, on a shelf whose top is BELT_Y. */
const SHELF_X = 260, STAGE_W = 220, STAGES_N = 5, BELT_Y = 380;
/** Crate side, px. */
const SIDE = 40;
/** The red of a jammed pair blinks at this rate in Hz while the belt restarts. */
const JAM_BLINK_HZ = 5;
/** The plate by the exit (its top edge is the floor's top less 8 px), and the crate centres that land on it. */
const PLATE = { x: 1200, w: 160, y: F - 8 };
const LANDS = [1230, 1280, 1330];
/** The EX lamp: centre height, radius, px. */
const LAMP_Y = 280, LAMP_R = 10;
/** Roller radius, px; roller spin per step, radians. */
const ROLLER_R = 5, ROLL = 0.15;
/** Tick length in ms (1.2 s on Story), and the 1.5 s hold after a jam. */
const TICK_MS = 800, TICK_STORY_MS = 1200, RESTART_MS = 1500;
/** How far a jammed crate drops, px per squared step since the jam. */
const FALL_K = 0.02;
/** Ticks a slow crate must spend in EX before it may move on. */
const SLOW_TICKS = 2;
/** Tick length in steps, Standard and Story. */
export const TICK_STEPS = frames(TICK_MS);
export const TICK_STORY_STEPS = frames(TICK_STORY_MS);
/** The first tick (counted from 0) on which the amber lamp is lit on Standard: crate 2 on its first EX tick, crate 3
 * in ID. The belt jams there unless the lever is pressed on that tick. */
export const HAZARD_TICK = 3;
/** Lines TAPEOUT says on the first restart, and when the plate is full. */
const RESTART_LINE = 'Two crates in one stage. Watch EX, and stall it when its lamp turns amber.';
const SOLVE_LINE = 'A stall buys one tick. A jam costs the whole run, so time it.';

/** The script: crate 1 enters stage 1 at tick 0, crate 2 at tick 1 and crate 3 at tick 2. Crate 2 is the slow MUL. */
const SCRIPT: { id: number; at: number; slow: boolean }[] = [
  { id: 1, at: 0, slow: false },
  { id: 2, at: 1, slow: true },
  { id: 3, at: 2, slow: false },
];
/** Crates the plate needs before the beat solves. */
const CRATES = SCRIPT.length;
/** The stall lever, on the floor under EX. */
const STALL: Station = { id: 'stall', kind: 'lever', x: 0, y: F, label: 'STALL EX' };

/** One crate. `pos` is its stage now (0 to 4 the belt, 5 the plate); `prev` is the stage it left this tick; `ex`
 * counts the ticks it has spent in EX on this visit. */
export interface Crate { id: number; slow: boolean; pos: number; prev: number; ex: number; slot: number; hit: boolean }

export interface StagesState {
  crates: Crate[];
  /** Ticks since the script started (the index of the tick now running). */
  k: number;
  /** Steps into the current tick, and the tick's length in steps. */
  ph: number;
  span: number;
  /** A stall press, applied at the next tick. */
  stall: boolean;
  /** The EX lamp: the next tick would put two crates in EX. */
  amber: boolean;
  /** Steps left in a jam's hold; 0 while the belt runs. */
  restart: number;
  /** Scripted crates not yet placed. */
  queued: number;
  /** Crates on the plate. */
  landed: number;
  /** Jams so far. */
  jams: number;
  /** Whether the first-restart line has been said. */
  told: boolean;
  /** Roller spin, in steps of motion. */
  turn: number;
  solved: boolean;
}

/** A crate's centre x: its stage's middle, or its landing spot on the plate. */
function centreX(pos: number, slot: number): number {
  if (pos === PLATE_POS) return LANDS[slot];
  return SHELF_X + STAGE_W * pos + STAGE_W / 2;
}

/** A crate's top edge: on the belt, or on the plate. */
const topY = (pos: number): number => (pos === PLATE_POS ? PLATE.y - SIDE : BELT_Y - SIDE);

function fresh(): StagesState {
  return {
    crates: [], k: 0, ph: 0, span: TICK_STEPS, stall: false, amber: false, restart: 0, queued: 0,
    landed: 0, jams: 0, told: false, turn: 0, solved: false,
  };
}

/** Places each scripted crate whose tick has come, in script order, once stage IF is free. */
function place(s: StagesState) {
  while (s.queued < SCRIPT.length) {
    const e = SCRIPT[s.queued];
    if (s.k < e.at || s.crates.some((c) => c.pos === IN)) return;
    s.crates.push({ id: e.id, slow: e.slow, pos: IN, prev: IN, ex: 0, slot: 0, hit: false });
    s.queued += 1;
  }
}

/** Where each crate wants to be after this tick: one stage on, except that a stalled stage 3 and everything behind it
 * stay, and a slow crate in EX stays until it has spent SLOW_TICKS there. */
function wants(s: StagesState, stall: boolean): number[] {
  return s.crates.map((c) => {
    if (c.pos === PLATE_POS) return c.pos;
    if (stall && c.pos <= EX) return c.pos;
    if (c.slow && c.pos === EX && c.ex + 1 < SLOW_TICKS) return c.pos;
    return c.pos + 1;
  });
}

/** The ids of two crates the plan puts into one belt stage, or null. */
function clash(s: StagesState, want: number[]): [number, number] | null {
  for (let i = 0; i < want.length; i++) {
    for (let j = i + 1; j < want.length; j++) {
      if (want[i] === want[j] && want[i] < PLATE_POS) return [s.crates[i].id, s.crates[j].id];
    }
  }
  return null;
}

/** Two crates share a stage: both flash, every crate on the belt drops, and the script holds for 1.5 s. */
function jam(s: StagesState, bad: [number, number]) {
  s.jams += 1;
  s.restart = frames(RESTART_MS);
  for (const x of s.crates) x.hit = bad.includes(x.id);
}

/** Starts the script again, with an empty belt. The first restart says its line. */
function restartScript(s: StagesState, c: MechCtx) {
  s.crates = [];
  s.k = 0;
  s.ph = 0;
  s.queued = 0;
  s.landed = 0;
  s.amber = false;
  s.stall = false;
  if (!s.told) {
    s.told = true;
    c.say(RESTART_LINE);
  }
  place(s);
}

/** The end of a tick: the belt moves one stage (a stall holds stage 3 and behind), a clash jams it unless stalled, and
 * the script places its next crate. */
function tick(s: StagesState, c: MechCtx) {
  const stall = s.stall;
  s.stall = false;
  const bad = clash(s, wants(s, false));
  if (bad && !stall) {
    jam(s, bad);
    return;
  }
  const want = wants(s, stall);
  s.k += 1;
  c.sfx('rowTick');
  s.crates.forEach((x, i) => {
    if (x.pos === EX) x.ex += 1;
    x.prev = x.pos;
    x.pos = want[i];
    if (x.pos === EX && x.prev !== EX) x.ex = 0;
    if (x.pos === PLATE_POS && x.prev !== PLATE_POS) {
      x.slot = s.landed;
      s.landed += 1;
      c.sfx('plate');
    }
  });
  place(s);
  if (s.landed >= CRATES) {
    s.solved = true;
    c.say(SOLVE_LINE);
    c.solve();
  }
}

function stagesRoom(): StoryRoom {
  return {
    oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
    traces: [trace(0, SHELF_X - 20, 200), trace(SHELF_X + STAGE_W * STAGES_N + 20, W, 200)],
    stations: [{ ...STALL, x: centreX(EX, 0) }],
    triggers: [],
    id: 'discovery-stages', name: 'The Pipeline', role: 'discovery', mechanic: 'stages', w: W, h: H, music: 'keeper',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, F - 200)],
    gates: [{ id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) }],
    exit: { x: W - 40 },
  };
}

export const STAGES: MechanicDef<StagesState> = {
  kind: 'stages',
  room: stagesRoom,
  init() {
    const s = fresh();
    place(s);
    return s;
  },
  step(s, c) {
    if (s.solved) return;
    if (s.restart > 0) {
      s.restart -= 1;
      if (s.restart === 0) restartScript(s, c);
      return;
    }
    if (c.used === 'stall') {
      s.stall = true;
      c.sfx('lever');
    }
    s.span = c.story ? TICK_STORY_STEPS : TICK_STEPS;
    s.amber = clash(s, wants(s, false)) !== null;
    if (s.crates.some((x) => x.pos !== x.prev)) s.turn += 1;
    s.ph += 1;
    if (s.ph >= s.span) {
      s.ph = 0;
      tick(s, c);
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    // the legs, from the shelf to the floor
    g.strokeStyle = PAL.idle;
    for (let i = 0; i <= STAGES_N; i++) {
      const x = SHELF_X + STAGE_W * i;
      g.beginPath();
      g.moveTo(x, BELT_Y + 16);
      g.lineTo(x, F);
      g.stroke();
    }
    // the belt: a shelf strip with rollers that turn while the crates move, and a frame and label per stage
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(SHELF_X, BELT_Y, STAGE_W * STAGES_N, 16);
    g.strokeRect(SHELF_X, BELT_Y, STAGE_W * STAGES_N, 16);
    g.font = `22px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < STAGES_N; i++) {
      const x0 = SHELF_X + STAGE_W * i;
      g.strokeRect(x0 + 8, 300, STAGE_W - 16, 80);
      for (let rx = x0 + 22; rx < x0 + STAGE_W - 10; rx += 22) {
        g.beginPath();
        g.arc(rx, BELT_Y + 8, ROLLER_R, 0, Math.PI * 2);
        g.stroke();
        const a = s.turn * ROLL;
        g.beginPath();
        g.moveTo(rx, BELT_Y + 8);
        g.lineTo(rx + Math.cos(a) * ROLLER_R, BELT_Y + 8 + Math.sin(a) * ROLLER_R);
        g.stroke();
      }
      g.fillStyle = PAL.text;
      g.fillText(LABELS[i], x0 + STAGE_W / 2, 420);
    }
    // the EX lamp: amber while the next tick would put two crates in EX
    const lx = centreX(EX, 0);
    g.beginPath();
    g.arc(lx, LAMP_Y, LAMP_R, 0, Math.PI * 2);
    if (s.amber) {
      g.fillStyle = PAL.amber;
      g.shadowColor = PAL.amber;
      g.shadowBlur = 12;
      g.fill();
      g.shadowBlur = 0;
    } else {
      g.strokeStyle = PAL.idle;
      g.setLineDash([6, 6]);
      g.stroke();
      g.setLineDash([]);
    }
    // the stall lever on the floor, lit while a press waits for its tick
    g.strokeStyle = PAL.line;
    g.beginPath();
    g.moveTo(lx, F);
    g.lineTo(lx, F - 34);
    g.stroke();
    g.fillStyle = s.stall ? PAL.amber : PAL.fill;
    g.beginPath();
    g.arc(lx, F - 38, 6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // the plate by the exit
    g.fillStyle = PAL.fill;
    g.fillRect(PLATE.x, PLATE.y, PLATE.w, 8);
    g.strokeRect(PLATE.x, PLATE.y, PLATE.w, 8);
    g.fillStyle = PAL.text;
    g.fillText('PLATE', PLATE.x + PLATE.w / 2, PLATE.y + 26);
    // the crates: eased from the stage they left to the one they reach, numbered (the slow one MUL), dropped on a jam
    const e = easeInOut(s.ph / s.span);
    for (const c of s.crates) {
      const fall = s.restart > 0 && c.pos !== PLATE_POS ? (frames(RESTART_MS) - s.restart) ** 2 * FALL_K : 0;
      const x0 = centreX(c.prev, c.slot), x1 = centreX(c.pos, c.slot);
      const y0 = topY(c.prev), y1 = topY(c.pos);
      const cx = x0 + (x1 - x0) * e;
      const top = y0 + (y1 - y0) * e + fall;
      const red = c.hit && s.restart > 0 && blink(s.restart / HZ, JAM_BLINK_HZ) === 1;
      g.fillStyle = PAL.fill;
      g.strokeStyle = red ? PAL.hostile : ROLE.prop;
      g.fillRect(cx - SIDE / 2, top, SIDE, SIDE);
      g.strokeRect(cx - SIDE / 2, top, SIDE, SIDE);
      g.fillStyle = PAL.text;
      g.font = `${c.slow ? 16 : 22}px ${FONT}`;
      g.fillText(c.slow ? 'MUL' : String(c.id), cx, top + SIDE / 2);
    }
    g.restore();
  },
  nudge: 'Watch stage EX. When its lamp turns amber, stall it once.',
};

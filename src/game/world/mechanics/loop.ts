// Discovery beat 'loop', Instruction Memory (Phase 4 Spec, section 4): a lift runs a four-line program, UP, UP, WAIT,
// DOWN, shown on a wall panel. STEP runs one line per press; RUN loops the program forever, one line every 0.8 s (the
// WAIT line holds 1.6 s on Story). Two UPs lift the drone to the height of the exit ledge, and a short hop takes it
// across. Standing on the ledge solves the beat.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { easeInOut, FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The lift: 120 x 20, left edge at LIFT_X, resting on the floor. Its top at rest is REST. */
const LIFT_X = 760, LIFT_W = 120, LIFT_H = 20, REST = F - LIFT_H;
/** One UP raises the lift 150 px; one DOWN drops it 300 px, which always reaches the floor from the top. */
const RISE = 150, DROP = 300;
/** Steps an UP or a DOWN takes to ease (0.5 s). */
const MOVE = 30;
/** The exit ledge is 2 lifts high: its top is 300 px above the lift's rest top, 60 px past the lift's right edge. */
const LEDGE_TOP = REST - 2 * RISE;
const LEDGE = r(LIFT_X + LIFT_W + 60, LEDGE_TOP, 400, F - LEDGE_TOP);
/** The guide line of the lift's travel runs down the middle of the lift's column. */
const GUIDE_X = LIFT_X + LIFT_W / 2;
/** The program: one line per cell, read left to right. */
type Op = 'UP' | 'DOWN' | 'WAIT';
const PROG: Op[] = ['UP', 'UP', 'WAIT', 'DOWN'];
/** Steps between two lines of a run: 0.8 s, and the WAIT line holds 1.6 s on Story (1.6 s is 96 steps). */
const SLOT = 48, WAIT_STORY = 96;
/** The wall panel that shows the program, and its four cells. */
const PANEL = { x: 705, y: 100, w: 230, h: 90 };
const CELL = { y: 128, w: 48, h: 36, gap: 6, pad: 10 };
/** The two levers on the floor, left of the lift. */
const STEP_X = 520, RUN_X = 640;
/** The lift's corner cut, in px. */
const CHAMFER = 6;

/** The lift's motion: it eases from `from` to `goal` over MOVE steps, `ph` of them done; `pos` is its height in px. */
interface Lift { pos: number; from: number; goal: number; ph: number }

export interface LoopState {
  /** The program counter: the cell that is lit, the next line to run. */
  pc: number;
  /** RUN is on: the program runs by itself. */
  run: boolean;
  /** Steps until the next line may run while RUN is on. */
  hold: number;
  lift: Lift;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
  traces: [], stations: [], triggers: [], gates: [],
};

function loopRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-loop', name: 'The Loop', role: 'discovery', mechanic: 'loop', w: W, h: H, music: 'core',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), LEDGE, r(W - 200, 0, 48, F - 200)],
    gates: [
      { id: 'lift', kind: 'lift', rect: r(LIFT_X, REST, LIFT_W, LIFT_H) },
      { id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) },
    ],
    stations: [
      { id: 'step', kind: 'lever', x: STEP_X, y: F, label: 'STEP' },
      { id: 'run', kind: 'lever', x: RUN_X, y: F, label: 'RUN' },
    ],
    traces: [trace(0, 700, 420), trace(1360, W, 420)],
    exit: { x: W - 40 },
  };
}

/** Runs the line at the program counter and moves the counter on. Returns the steps until the next line may run. */
function fire(s: LoopState, c: MechCtx): number {
  const op = PROG[s.pc];
  s.pc = (s.pc + 1) % PROG.length;
  if (op === 'WAIT') return c.story ? WAIT_STORY : SLOT;
  const L = s.lift;
  L.from = L.pos;
  L.ph = 0;
  L.goal = op === 'UP' ? L.goal + RISE : Math.max(0, L.goal - DROP);
  c.sfx('liftHum');
  return SLOT;
}

/** The drone is under the lift (its centre below the lift's top) and the lift's next top would reach it. */
function crushes(d: Rect, here: number, next: number): boolean {
  return d.y + d.h / 2 > here && overlaps(d, { x: LIFT_X, y: next, w: LIFT_W, h: LIFT_H });
}

/** One step of the lift's ease. It holds while the drone is under it and its next top would catch the drone. */
function moveLift(s: LoopState, c: MechCtx) {
  const L = s.lift;
  if (L.ph >= MOVE) return;
  const next = L.from + (L.goal - L.from) * easeInOut((L.ph + 1) / MOVE);
  if (crushes(c.drone, REST - L.pos, REST - next)) return;
  L.ph += 1;
  L.pos = next;
  c.move('lift', LIFT_X, REST - next);
}

/** The drone's feet are on the exit ledge's top. */
function standsOnLedge(c: MechCtx): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > LEDGE.x && cx < LEDGE.x + LEDGE.w && Math.abs(d.y + d.h - LEDGE.y) <= 2;
}

/** The left edge of program cell i. */
const cellX = (i: number) => PANEL.x + CELL.pad + i * (CELL.w + CELL.gap);

/** The wall panel: a title and four cells, the lit one amber, with a small arrow under it. */
function drawPanel(g: CanvasRenderingContext2D, pc: number) {
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.line;
  g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  g.strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  g.fillStyle = PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PROGRAM', PANEL.x + PANEL.w / 2, PANEL.y + 14);
  PROG.forEach((label, i) => {
    const x = cellX(i);
    if (i === pc) {
      g.fillStyle = PAL.amber;
      g.shadowColor = PAL.amber;
      g.shadowBlur = 12;
      g.fillRect(x, CELL.y, CELL.w, CELL.h);
      g.shadowBlur = 0;
      g.fillStyle = PAL.bgDeep;
    } else {
      g.strokeStyle = PAL.idle;
      g.strokeRect(x, CELL.y, CELL.w, CELL.h);
      g.fillStyle = PAL.text;
    }
    g.fillText(label, x + CELL.w / 2, CELL.y + CELL.h / 2);
  });
  const ax = cellX(pc) + CELL.w / 2, ay = CELL.y + CELL.h + 4;
  g.strokeStyle = PAL.amber;
  g.beginPath();
  g.moveTo(ax - 5, ay + 6);
  g.lineTo(ax, ay);
  g.lineTo(ax + 5, ay + 6);
  g.stroke();
}

/** The lift as a chamfered line-art slab, its top edge glowing. */
function drawLift(g: CanvasRenderingContext2D, pos: number) {
  const x = LIFT_X, y = REST - pos, c = CHAMFER;
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + LIFT_W - c, y);
  g.lineTo(x + LIFT_W, y + c);
  g.lineTo(x + LIFT_W, y + LIFT_H);
  g.lineTo(x, y + LIFT_H);
  g.lineTo(x, y + c);
  g.closePath();
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.line;
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + LIFT_W - c, y);
  g.strokeStyle = PAL.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = 10;
  g.stroke();
  g.shadowBlur = 0;
}

export const LOOP: MechanicDef<LoopState> = {
  kind: 'loop',
  room: loopRoom,
  init: () => ({ pc: 0, run: false, hold: 0, lift: { pos: 0, from: 0, goal: 0, ph: MOVE }, solved: false }),
  step(s, c) {
    if (s.solved) return;
    if (c.used === 'step') {
      c.sfx('lever');
      if (!s.run) fire(s, c);
    }
    if (c.used === 'run') {
      c.sfx('lever');
      s.run = !s.run;
      s.hold = 0;
    }
    if (s.run) {
      if (s.hold <= 0) s.hold = fire(s, c);
      s.hold -= 1;
    }
    moveLift(s, c);
    if (standsOnLedge(c)) {
      s.solved = true;
      c.say('A loop: the same four lines, again and again.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    g.strokeStyle = PAL.idle;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(GUIDE_X, LEDGE_TOP);
    g.lineTo(GUIDE_X, REST + LIFT_H);
    g.stroke();
    g.setLineDash([]);
    drawPanel(g, s.pc);
    drawLift(g, s.lift.pos);
    g.restore();
  },
  nudge: 'Press STEP to run one line. Two UPs take you to the top.',
};

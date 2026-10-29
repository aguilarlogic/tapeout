// Discovery beat, Floorplan (Phase 6 Spec, section 4): four cell blocks, A, B, C and D, lie scattered on the floor. A
// rubber-band wire joins A to B, B to C and C to D, and the meter shows the total wire length in px against a target of
// 900. Six floor slots snap a block in place when it rests within 24 px of one. The exit door is open while the total
// is under 900, so the blocks must sit next to each other, in order. Solved past the door.
import type { PropSpec, Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** The total wire length, in px, under which the door is open. */
export const TARGET = 900;
/** Block side, px (a mass 2 crate), and the height of its centre when it rests on the floor. */
const SIDE = crateSide(2), HALF = SIDE / 2;
/** A block's centre height when it rests on the floor. */
export const BLOCK_Y = F - HALF - 1;
/** The six floor slots, by centre x, left to right (180 px apart). */
export const SLOT_X = [300, 480, 660, 840, 1020, 1200];
/** A block within this many px of a free slot, on the floor, snaps to that slot. */
const SNAP = 24;
/** Where the four blocks start, A to D, by centre x. Their wires total well over the target. */
const START_X = [1060, 340, 1240, 600];
const LABELS = ['A', 'B', 'C', 'D'];
/** A block that moved this step costs MOVED on top of its distance (a block that stays put costs nothing), and a move
 * under MOVE_EPS px is jitter. So the match keeps the blocks that did not move on their spots, and never swaps two. */
const MOVED = 1000, MOVE_EPS = 2;
/** The meter's full scale: twice the target, so the target sits at its middle. */
const METER = { x: 500, y: 56, w: 600, h: 14, full: 2 * TARGET };
/** Lines TAPEOUT says when the door first opens and when the beat is done. */
const SOLVE_LINE = 'Neighbours make short wires. Short wires keep the total low.';

/** A block's centre on the floor, by its x. */
const floorAt = (x: number): Vec => ({ x, y: BLOCK_Y });

export interface PlacementState {
  /** Each block's last centre while it lay loose, A to D (a carried block keeps the spot it was picked from). */
  at: Vec[];
  /** Whether each block is carried by the drone (not among the loose props) on the last step. */
  carried: boolean[];
  /** Each block's centre as the beat sees it: where it lies, or the drone's centre while the drone carries it. */
  shown: Vec[];
  /** The total wire length on the last step, in px. */
  total: number;
  /** The door is open: the total is under the target. */
  open: boolean;
  solved: boolean;
}

/** The total length of the wires A-B, B-C and C-D through these centres, in px. */
export function wireLength(pos: Vec[]): number {
  let total = 0;
  for (let i = 1; i < pos.length; i++) total += Math.hypot(pos[i].x - pos[i - 1].x, pos[i].y - pos[i - 1].y);
  return total;
}

/** Each block's logical centre: a block on the floor within SNAP px of a free slot sits in that slot. Carried blocks
 * never snap. */
export function placed(at: Vec[], carried: boolean[]): Vec[] {
  const taken = new Set<number>();
  return at.map((p, i) => {
    if (carried[i] || Math.abs(p.y - BLOCK_Y) > 3) return p;
    const k = SLOT_X.findIndex((x, j) => !taken.has(j) && Math.abs(p.x - x) <= SNAP);
    if (k < 0) return p;
    taken.add(k);
    return floorAt(SLOT_X[k]);
  });
}

/** The best match of each block to a loose prop: the prop's index, or null when the block is carried. Every loose prop
 * belongs to a block, so exactly (blocks - props) blocks are carried. */
function match(last: Vec[], seen: Vec[]): (number | null)[] {
  const carriedMax = last.length - seen.length;
  let best = Infinity;
  let out: (number | null)[] = last.map(() => null);
  const cur: (number | null)[] = last.map(() => null);
  const used = new Set<number>();
  const go = (i: number, cost: number) => {
    if (cost >= best) return;
    if (i === last.length) {
      if (used.size === seen.length) { best = cost; out = [...cur]; }
      return;
    }
    if (i - used.size < carriedMax) go(i + 1, cost);
    seen.forEach((p, j) => {
      if (used.has(j)) return;
      used.add(j);
      cur[i] = j;
      const d = Math.hypot(p.x - last[i].x, p.y - last[i].y);
      go(i + 1, cost + d + (d > MOVE_EPS ? MOVED : 0));
      used.delete(j);
      cur[i] = null;
    });
  };
  go(0, 0);
  return out;
}

/** Follows each block by its nearest prop, so the letters stay with their blocks however the props are listed. */
function track(s: PlacementState, c: MechCtx) {
  const seen = c.props.map((p): Vec => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 }));
  const me: Vec = { x: c.drone.x + c.drone.w / 2, y: c.drone.y + c.drone.h / 2 };
  match(s.at, seen).forEach((j, i) => {
    s.carried[i] = j === null;
    if (j !== null) s.at[i] = seen[j];
    s.shown[i] = j === null ? me : s.at[i];
  });
}

/** Drives the door to `open` with one call and one sfx per change. */
function drive(c: MechCtx, s: PlacementState, open: boolean) {
  if (open === s.open) return;
  s.open = open;
  c.sfx('door');
  if (open) c.open('exit');
  else c.close('exit');
}

function placementRoom(): StoryRoom {
  const props: PropSpec[] = START_X.map((x): PropSpec => ({ kind: 'crate', mass: 2, x, y: BLOCK_Y }));
  return {
    name: 'Floorplan', w: W, h: H, spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y)],
    oneWay: [], hazards: [], plates: [], props,
    enemies: [], floaters: [], spikes: [], emitters: [],
    traces: [trace(0, 700, 420), trace(900, W, 420)], signs: [],
    id: 'discovery-placement', role: 'discovery', mechanic: 'placement', music: 'silicon', modules: [],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [], triggers: [],
    exit: { x: W - 40 },
  };
}

/** A block's bounds, for a test rig or a loose prop: centred on (x, BLOCK_Y). */
export const blockRect = (x: number, y = BLOCK_Y): Rect => ({ x: x - HALF, y: y - HALF, w: SIDE, h: SIDE });

/** The meter: the total against the target, with a tick at the target. Its words say which side it is on. */
function drawMeter(g: CanvasRenderingContext2D, s: PlacementState) {
  const over = s.total >= TARGET;
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.line;
  g.fillRect(METER.x, METER.y, METER.w, METER.h);
  g.strokeRect(METER.x, METER.y, METER.w, METER.h);
  g.fillStyle = over ? PAL.hostile : PAL.trace;
  g.fillRect(METER.x, METER.y, METER.w * Math.min(1, s.total / METER.full), METER.h);
  const tx = METER.x + (TARGET / METER.full) * METER.w;
  g.strokeStyle = PAL.text;
  g.beginPath();
  g.moveTo(tx, METER.y - 6);
  g.lineTo(tx, METER.y + METER.h + 6);
  g.stroke();
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`WIRE ${Math.round(s.total)} PX`, METER.x + METER.w / 2, METER.y - 18);
  g.fillText(over ? `OVER ${TARGET}: DOOR SHUT` : `UNDER ${TARGET}: DOOR OPEN`, METER.x + METER.w / 2, METER.y + METER.h + 18);
}

/** The six slots: dashed on the floor, solid once a block sits in one, numbered above the floor. */
function drawSlots(g: CanvasRenderingContext2D, pos: Vec[]) {
  SLOT_X.forEach((x, k) => {
    const full = pos.some((p) => p.x === x && p.y === BLOCK_Y);
    g.strokeStyle = full ? PAL.trace : PAL.idle;
    g.setLineDash(full ? [] : [4, 4]);
    g.strokeRect(x - 22, F - 6, 44, 6);
    g.setLineDash([]);
    g.fillStyle = PAL.idle;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(String(k + 1), x, F - 56);
  });
}

/** The wires: a rubber band that sags between each pair of neighbouring blocks, labelled with its length. */
function drawWires(g: CanvasRenderingContext2D, pos: Vec[], over: boolean) {
  const colour = over ? PAL.hostile : PAL.trace;
  g.strokeStyle = colour;
  g.shadowColor = colour;
  g.shadowBlur = 8;
  for (let i = 1; i < pos.length; i++) {
    const a = pos[i - 1], b = pos[i], mx = (a.x + b.x) / 2;
    g.beginPath();
    g.moveTo(a.x, BLOCK_Y - HALF - 6);
    g.quadraticCurveTo(mx, BLOCK_Y - 2 * 60, b.x, BLOCK_Y - HALF - 6);
    g.stroke();
    g.fillStyle = PAL.text;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(`${Math.round(Math.hypot(b.x - a.x, b.y - a.y))} PX`, mx, BLOCK_Y - 80);
  }
  g.shadowBlur = 0;
}

export const PLACEMENT: MechanicDef<PlacementState> = {
  kind: 'placement',
  room: placementRoom,
  init: () => ({
    at: START_X.map(floorAt), carried: START_X.map(() => false), shown: START_X.map(floorAt),
    total: wireLength(START_X.map(floorAt)), open: false, solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    track(s, c);
    s.total = wireLength(placed(s.shown, s.carried));
    drive(c, s, s.total < TARGET);
    if (s.open && c.drone.x + c.drone.w / 2 > DOOR.x + DOOR.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    const pos = placed(s.shown, s.carried);
    drawSlots(g, pos);
    drawWires(g, pos, s.total >= TARGET);
    // each block's letter sits above it, where the sim's crates do not cover it
    g.fillStyle = PAL.text;
    g.font = `16px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    s.shown.forEach((p, i) => g.fillText(LABELS[i], p.x, p.y - HALF - 22));
    drawMeter(g, s);
    g.restore();
  },
  nudge: 'Move the blocks next to each other, in order A, B, C, D.',
};

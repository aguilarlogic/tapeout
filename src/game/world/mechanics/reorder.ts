// Discovery beat, Reorder Window (Phase 7 Spec, section 4): a chute drops four numbered blocks into a WINDOW pit, in the
// order 3, 1, 4, 2, one every 1.5 s. Four RETIRE slots at the right are numbered 1 to 4. Carry each block into the slot
// with its number. When all four sit in their own slots, they retire one by one (a lamp chain), and the door opens.
// Solved past the door. A block in the wrong slot turns that slot red with its number, and nothing retires.
import type { PropSpec, Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { FONT, LINE, PAL } from '../../render/palette';
import type { Gate, StoryRoom } from '../../story/types';
import { crateSide, frames } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** Block side, px (a mass 2 crate), and the height of its centre when it rests on the floor. */
const SIDE = crateSide(2), HALF = SIDE / 2;
/** A block's centre height when it rests on the floor. */
export const BLOCK_Y = F - HALF - 1;
/** The WINDOW pit: a gap 400 px wide in the floor, 40 px deep. Its tray is walkable, so the drone can go in and out. */
const PIT = { x: 400, w: 400, depth: 40 };
/** The chute's four shelves over the pit, by centre x, left to right. Each shelf is a gate that drops its block. */
const SHELF_X = [450, 550, 650, 750];
const SHELF_W = 70, SHELF_H = 8;
const SHELF_Y = F - 240;
/** A block's centre when it rests on a shelf. */
const SHELF_CY = SHELF_Y - HALF - 1;
/** The block numbers on the shelves, left to right: the chute drops 3, 1, 4, 2. */
export const DROP_ORDER = [3, 1, 4, 2];
/** One block drops every 1.5 s, the first at 1.5 s. */
const DROP_EVERY = frames(1500);
/** The four RETIRE slots at the right, by centre x, numbered 1 to 4. Block n belongs in slot n. */
export const SLOT_X = [1000, 1100, 1200, 1300];
/** A block within this many px of a slot, on the floor, sits in that slot. */
const SNAP = 24;
/** The retire lamp chain: one lamp every 0.4 s once all four blocks sit in their own slots. */
const RETIRE_EVERY = frames(400);
const BLOCKS = 4;
/** A block that moved this step costs MOVED on top of its distance, and a move under MOVE_EPS px is jitter. */
const MOVED = 1000, MOVE_EPS = 2;
/** Lines TAPEOUT says when a block first sits in a wrong slot, and when the beat is done. */
const WRONG_LINE = 'Each slot takes the block with its number. Check the numbers.';
const SOLVE_LINE = 'Work runs as it arrives, but it retires in order.';

export interface ReorderState {
  /** Each block's last centre while it lay loose, by block number minus one (a carried block keeps its last spot). */
  at: Vec[];
  /** Whether each block is carried by the drone (not among the loose props) on the last step. */
  carried: boolean[];
  /** Each block's centre as the beat sees it: where it lies, or the drone's centre while the drone carries it. */
  shown: Vec[];
  /** The shelves opened so far: the chute has dropped this many blocks. */
  dropped: number;
  /** The slot each block sits in on the last step, or -1 when it is carried or not in a slot. */
  seat: number[];
  /** Each slot holds a block with the wrong number. */
  wrong: boolean[];
  /** Retire lamps lit, 0 to 4. */
  lit: number;
  /** Steps all four blocks have sat home, toward the next lamp. */
  beat: number;
  /** The retire chain finished: the door is open and stays open. */
  open: boolean;
  /** The wrong-slot hint has been said. */
  told: boolean;
  solved: boolean;
}

/** Each block's start: on its shelf, where the chute holds it. Block n sits on the shelf that drops it. */
const startAt = (): Vec[] => [1, 2, 3, 4].map((n): Vec => ({ x: SHELF_X[DROP_ORDER.indexOf(n)], y: SHELF_CY }));

const shelfRect = (i: number): Rect => r(SHELF_X[i] - SHELF_W / 2, SHELF_Y, SHELF_W, SHELF_H);

function reorderRoom(): StoryRoom {
  const props: PropSpec[] = DROP_ORDER.map((_, i): PropSpec => ({ kind: 'crate', mass: 2, x: SHELF_X[i], y: SHELF_CY }));
  const gates: Gate[] = [
    { id: 'exit', kind: 'door', rect: DOOR },
    ...SHELF_X.map((_, i): Gate => ({ id: `shelf${i}`, kind: 'shutter', rect: shelfRect(i) })),
  ];
  return {
    name: 'Reorder Window', w: W, h: H, spawn: spawnAt(140, F),
    solids: [
      ...shell(W, H, { floor: false }),
      r(W - 200, 0, 48, DOOR.y),
      r(0, F, PIT.x, 80),
      r(PIT.x + PIT.w, F, W - PIT.x - PIT.w, 80),
      r(PIT.x, F + PIT.depth, PIT.w, 80 - PIT.depth),
    ],
    oneWay: [], hazards: [], plates: [], props, enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
    traces: [trace(0, 360, 420), trace(840, W, 420)],
    id: 'discovery-reorder', role: 'discovery', mechanic: 'reorder', music: 'cluster', modules: [],
    gates,
    stations: [], triggers: [],
    exit: { x: W - 40 },
  };
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

/** Follows each block by its best match, so the numbers stay with their blocks however the props are listed. */
function track(s: ReorderState, c: MechCtx) {
  const seen = c.props.map((p): Vec => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 }));
  const me: Vec = { x: c.drone.x + c.drone.w / 2, y: c.drone.y + c.drone.h / 2 };
  match(s.at, seen).forEach((j, i) => {
    s.carried[i] = j === null;
    if (j !== null) s.at[i] = seen[j];
    s.shown[i] = j === null ? me : s.at[i];
  });
}

/** The slot a loose block sits in, by its centre: on the floor and within SNAP px of the slot, or -1. */
const slotAt = (p: Vec): number =>
  SLOT_X.findIndex((x) => Math.abs(p.x - x) <= SNAP && Math.abs(p.y - BLOCK_Y) <= 3);

export const REORDER: MechanicDef<ReorderState> = {
  kind: 'reorder',
  room: reorderRoom,
  init: () => ({
    at: startAt(), carried: [false, false, false, false], shown: startAt(), dropped: 0,
    seat: [-1, -1, -1, -1], wrong: SLOT_X.map(() => false), lit: 0, beat: 0, open: false, told: false, solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    // the chute: one shelf opens every 1.5 s, and its block falls into the pit
    if (s.dropped < BLOCKS && c.t >= DROP_EVERY * (s.dropped + 1)) {
      c.open(`shelf${s.dropped}`);
      c.sfx('plate');
      s.dropped += 1;
    }
    track(s, c);
    s.seat = s.at.map((p, b) => (s.carried[b] ? -1 : slotAt(p)));
    s.wrong = SLOT_X.map((_, k) => s.seat.some((seat, b) => seat === k && b !== k));
    if (!s.told && s.wrong.some(Boolean)) { s.told = true; c.say(WRONG_LINE); }
    // the retire chain: all four home lights one lamp every 0.4 s; any block out of place resets it
    const home = s.seat.every((seat, b) => seat === b);
    if (!s.open) {
      if (home) {
        s.beat += 1;
        if (s.beat >= RETIRE_EVERY) {
          s.beat = 0;
          s.lit += 1;
          c.sfx('rowTick');
        }
        if (s.lit >= BLOCKS) {
          s.open = true;
          c.sfx('door');
          c.open('exit');
        }
      } else {
        s.lit = 0;
        s.beat = 0;
      }
    }
    if (s.open && c.drone.x + c.drone.w / 2 > DOOR.x + DOOR.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    drawChute(g);
    drawSlots(g, s);
    drawTags(g, s);
    g.restore();
  },
  nudge: 'Each block goes in the slot with its number, 1 to 4.',
};

/** The chute above the pit, and the pit's name. */
function drawChute(g: CanvasRenderingContext2D) {
  g.strokeStyle = PAL.idle;
  g.setLineDash([6, 6]);
  g.beginPath();
  g.moveTo(PIT.x, 0); g.lineTo(PIT.x, SHELF_Y - 16);
  g.moveTo(PIT.x + PIT.w, 0); g.lineTo(PIT.x + PIT.w, SHELF_Y - 16);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CHUTE', PIT.x + PIT.w / 2, 40);
  g.fillText('WINDOW', PIT.x + PIT.w / 2, F - 20);
}

/** The four slots: dashed when empty, solid when a block sits in one, red with a "!" when it holds the wrong block.
 * Above each slot, its number, and its retire lamp on the row over the numbers. */
function drawSlots(g: CanvasRenderingContext2D, s: ReorderState) {
  SLOT_X.forEach((x, k) => {
    const full = s.seat.includes(k), bad = s.wrong[k];
    g.strokeStyle = bad ? PAL.hostile : full ? PAL.trace : PAL.idle;
    g.setLineDash(full ? [] : [4, 4]);
    g.strokeRect(x - 22, F - 6, 44, 6);
    g.setLineDash([]);
    g.fillStyle = bad ? PAL.hostile : PAL.idle;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(bad ? `! ${k + 1}` : `${k + 1}`, x, F - 56);
    const on = s.lit > k;
    g.beginPath();
    g.arc(x, F - 84, 8, 0, Math.PI * 2);
    if (on) { g.fillStyle = PAL.ok; g.fill(); }
    g.strokeStyle = on ? PAL.ok : PAL.idle;
    g.stroke();
  });
  g.fillStyle = PAL.idle;
  g.font = `12px ${FONT}`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText('RETIRE', SLOT_X[0] - 40, F - 84);
}

/** Each block's number, on a small tag sitting on the block's top edge. The sim draws the crate after the mechanic,
 * so the tag sits just above the block where the crate cannot cover it. */
function drawTags(g: CanvasRenderingContext2D, s: ReorderState) {
  s.shown.forEach((p, b) => {
    const x = p.x, y = p.y - HALF - 14;
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(x - 12, y - 9, 24, 18);
    g.strokeRect(x - 12, y - 9, 24, 18);
    g.fillStyle = PAL.text;
    g.font = `bold 13px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${b + 1}`, x, y);
  });
}

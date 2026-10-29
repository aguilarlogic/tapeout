// Discovery beat 'agents', The Misbehaving Environment (Phase 7 Spec, section 4): three numbered blocks, 1, 2 and 3, sit
// on a shelf in the order 3, 1, 2. Carry a block onto the PLATE, then step on the DRIVER pad: the driver pushes the
// block onto a belt. A MONITOR lamp reads each block as it passes, and the SCOREBOARD by the door checks it against the
// next number it expects. Send 1, then 2, then 3, and the scoreboard reads 3 of 3 and the door opens. A block out of
// order resets the count to 0 of 3 and holds the belt for 2 s. Solved past the door.
import type { PropSpec, Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames, HZ } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The number on each block, by block index. Block 0 starts at the left of the shelf: block 3, then 1, then 2. */
export const NUMBERS = [3, 1, 2];
/** The shelf: a solid block from SHELF_X, SHELF_W wide, whose top is SHELF_Y. */
export const SHELF_X = 260, SHELF_W = 300, SHELF_Y = F - 120;
/** Block side from crateSide (mass 1), its half side, and the centre x of each block on the shelf. */
export const BLOCK_SIDE = crateSide(1), HALF = BLOCK_SIDE / 2;
const START_X = [300, 380, 460];
/** The copper PLATE a block sits on, and the DRIVER pad beside it, both on the floor (x and width, px). */
export const PLATE = { x: 640, w: 60 }, DRIVER = { x: 740, w: 60 };
/** A block whose centre is within LOW px of the floor is on the floor, not on the shelf or in the air. */
const LOW = 120;
/** The belt: tokens ride from the plate to BELT_X1 along BELT_Y, at BELT_SPEED px/s. */
const BELT_X0 = 820, BELT_X1 = 1200, BELT_Y = F - 36, BELT_SPEED = 200;
/** The MONITOR reads a token when it crosses MON_X. Its lamp hangs at MON_Y, radius LAMP_R. */
export const MON_X = 1000, MON_Y = F - 150, LAMP_R = 12;
/** How long the monitor lamp stays lit after a read, and the belt's hold after a wrong block, in ms. */
const LAMP_MS = 300, HOLD_MS = 2000;
/** The scoreboard panel, to the left of the door. */
const BOARD = { x: 1210, y: 230, w: 170, h: 120 };
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** Past this x the drone has passed the door (the door is 48 px wide, its right edge at W - 152). */
const PASS_X = W - 152;
/** The numbers that solve the beat, in order, and the token's side in px. */
const GOAL = 3, TOKEN = 26;

/** TAPEOUT's lines. */
const NOBLOCK_LINE = 'Put a block on the plate, then step on DRIVER.';
const SENT_LINE = 'That block is already on the belt. Move it off the plate.';
const DRIVE_LINE = 'The driver pushes the block onto the belt. The monitor reads it.';
const WRONG_LINE = 'Out of order. The scoreboard resets, and the belt holds for 2 s.';
const SOLVE_LINE = 'The driver drives, the monitor watches, the scoreboard compares.';

/** A block on the belt: its number, and its centre x. */
interface Token { n: number; x: number }

export interface AgentsState {
  /** Each block's last centre while it lay loose, by block index (a carried block keeps the spot it was picked from). */
  at: Vec[];
  /** Whether each block is carried by the drone (not among the loose props) on the last step. */
  carried: boolean[];
  /** Each block's centre as the beat sees it: where it lies, or the drone's centre while the drone carries it. */
  shown: Vec[];
  /** Whether each block has been pushed onto the belt and still sits on the plate. A block must leave the plate to go again. */
  sent: boolean[];
  /** The drone stood on the DRIVER pad on the last step, so stepping on it counts once. */
  onPad: boolean;
  /** Blocks on the belt, in the order they were pushed. */
  tokens: Token[];
  /** Blocks read in order so far, 0 to 3. */
  ok: number;
  /** Steps left in a hold after a wrong block: the belt stops and reads nothing. */
  hold: number;
  /** The last wrong read, shown on the scoreboard until the hold ends. */
  wrong: { expect: number; got: number } | null;
  /** Steps left with the monitor lamp lit. */
  lamp: number;
  /** The door is open: the scoreboard reads 3 of 3. */
  open: boolean;
  toldNoBlock: boolean;
  toldDrive: boolean;
  toldWrong: boolean;
  solved: boolean;
}

function agentsRoom(): StoryRoom {
  const props: PropSpec[] = START_X.map((x): PropSpec => ({ kind: 'crate', mass: 1, x, y: SHELF_Y - HALF - 1 }));
  return {
    id: 'discovery-agents', name: 'The Misbehaving Environment', role: 'discovery', mechanic: 'agents', w: W, h: H,
    music: 'cluster', modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y), r(SHELF_X, SHELF_Y, SHELF_W, F - SHELF_Y)],
    oneWay: [], hazards: [], plates: [], props, enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
    traces: [trace(0, 700, 420), trace(900, W, 420)],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [], triggers: [],
    exit: { x: W - 40 },
  };
}

const centre = (b: Rect): Vec => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** The best match of each block to a loose prop: the prop's index, or null when the block is carried. Every loose prop
 * belongs to a block, so exactly (blocks - props) blocks are carried. Three blocks make the search cheap. */
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
      go(i + 1, cost + Math.hypot(p.x - last[i].x, p.y - last[i].y));
      used.delete(j);
      cur[i] = null;
    });
  };
  go(0, 0);
  return out;
}

/** Follows each block by its nearest prop, so the numbers stay with their blocks however the props are listed. */
function track(s: AgentsState, c: MechCtx) {
  const seen = c.props.map(centre);
  const me = centre(c.drone);
  match(s.at, seen).forEach((j, i) => {
    s.carried[i] = j === null;
    if (j !== null) s.at[i] = seen[j];
    s.shown[i] = j === null ? me : s.at[i];
  });
}

/** Whether a block's centre sits on the PLATE. */
const onPlate = (p: Vec): boolean => p.x >= PLATE.x && p.x <= PLATE.x + PLATE.w && p.y > F - LOW;

/** The drone stands on a floor pad: grounded, within its width, feet on the floor. */
function standing(c: MechCtx, x: number, w: number): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > x && cx < x + w && Math.abs(d.y + d.h - F) <= 2;
}

/** The DRIVER press: pushes the first block on the plate that has not gone yet onto the belt. */
function drive(s: AgentsState, c: MechCtx) {
  const i = s.at.findIndex((p, k) => !s.carried[k] && !s.sent[k] && onPlate(p));
  if (i < 0) {
    if (!s.toldNoBlock) {
      s.toldNoBlock = true;
      c.say(s.at.some((p, k) => !s.carried[k] && onPlate(p)) ? SENT_LINE : NOBLOCK_LINE);
    }
    return;
  }
  s.sent[i] = true;
  s.tokens.push({ n: NUMBERS[i], x: PLATE.x + PLATE.w / 2 });
  c.sfx('plate');
  if (!s.toldDrive) { s.toldDrive = true; c.say(DRIVE_LINE); }
}

/** The monitor reads a block: the next number adds one to the count, any other number resets it and holds the belt. */
function read(s: AgentsState, c: MechCtx, n: number) {
  s.lamp = frames(LAMP_MS);
  c.sfx('rowTick');
  const want = s.ok + 1;
  if (n === want) {
    s.ok += 1;
    return;
  }
  s.wrong = { expect: want, got: n };
  s.ok = 0;
  s.hold = frames(HOLD_MS);
  if (!s.toldWrong) { s.toldWrong = true; c.say(WRONG_LINE); }
}

/** The belt: tokens move while it runs; each one that crosses the monitor is read once. */
function belt(s: AgentsState, c: MechCtx) {
  for (const t of s.tokens) {
    const was = t.x;
    t.x += BELT_SPEED / HZ;
    if (was < MON_X && t.x >= MON_X) read(s, c, t.n);
  }
  s.tokens = s.tokens.filter((t) => t.x <= BELT_X1);
}

/** The belt, the monitor and the scoreboard, drawn in world px above the floor line. */
function drawBelt(g: CanvasRenderingContext2D, s: AgentsState) {
  const hold = s.hold > 0;
  g.strokeStyle = hold ? PAL.hostile : PAL.trace;
  g.strokeRect(BELT_X0, BELT_Y - 14, BELT_X1 - BELT_X0, 28);
  g.fillStyle = PAL.text;
  g.font = `13px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BELT', BELT_X1 - 40, BELT_Y - 26);
  for (const tok of s.tokens) {
    g.fillStyle = PAL.fill;
    g.fillRect(tok.x - TOKEN / 2, BELT_Y - TOKEN / 2, TOKEN, TOKEN);
    g.strokeStyle = hold ? PAL.hostile : PAL.trace;
    g.strokeRect(tok.x - TOKEN / 2, BELT_Y - TOKEN / 2, TOKEN, TOKEN);
    g.fillStyle = PAL.text;
    g.fillText(String(tok.n), tok.x, BELT_Y);
    if (hold) g.fillText('!', tok.x, BELT_Y - TOKEN / 2 - 10);
  }
  // the monitor: a lamp over the belt, lit amber for a moment after each read
  g.beginPath();
  g.arc(MON_X, MON_Y, LAMP_R, 0, Math.PI * 2);
  if (s.lamp > 0) {
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
  g.fillStyle = PAL.text;
  g.fillText('MONITOR', MON_X, MON_Y - LAMP_R - 14);
}

/** The scoreboard by the door: what it expects next, the count, and the wrong read while it holds. */
function drawBoard(g: CanvasRenderingContext2D, s: AgentsState) {
  g.fillStyle = PAL.fill;
  g.strokeStyle = s.wrong ? PAL.hostile : PAL.line;
  g.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  g.strokeRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  g.font = `13px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const x = BOARD.x + 12;
  g.fillStyle = PAL.text;
  g.fillText('SCOREBOARD', x, BOARD.y + 20);
  if (s.wrong) {
    g.fillStyle = PAL.hostile;
    g.fillText(`! expected ${s.wrong.expect}, got ${s.wrong.got}`, x, BOARD.y + 56);
  } else if (s.ok === GOAL) {
    g.fillStyle = PAL.ok;
    g.fillText('PASS', x, BOARD.y + 56);
  } else {
    g.fillStyle = PAL.text;
    g.fillText(`EXPECT ${s.ok + 1}`, x, BOARD.y + 56);
  }
  g.fillStyle = PAL.text;
  g.fillText(`${s.ok} OF ${GOAL}`, x, BOARD.y + 90);
}

export const AGENTS: MechanicDef<AgentsState> = {
  kind: 'agents',
  room: agentsRoom,
  init: () => ({
    at: START_X.map((x) => ({ x, y: SHELF_Y - HALF - 1 })),
    carried: START_X.map(() => false),
    shown: START_X.map((x) => ({ x, y: SHELF_Y - HALF - 1 })),
    sent: START_X.map(() => false),
    onPad: false, tokens: [], ok: 0, hold: 0, wrong: null, lamp: 0, open: false,
    toldNoBlock: false, toldDrive: false, toldWrong: false, solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    track(s, c);
    // a block that has left the plate may be pushed again
    s.at.forEach((p, i) => { if (s.carried[i] || !onPlate(p)) s.sent[i] = false; });
    const pad = standing(c, DRIVER.x, DRIVER.w);
    const press = pad && !s.onPad;
    s.onPad = pad;
    if (press && s.hold === 0 && !s.open) drive(s, c);
    if (s.lamp > 0) s.lamp -= 1;
    if (s.hold > 0) {
      // the belt holds: nothing moves or reads until the hold ends, then the belt is clear
      s.hold -= 1;
      if (s.hold === 0) { s.tokens = []; s.wrong = null; }
    } else if (!s.open) {
      belt(s, c);
    }
    if (s.ok === GOAL && !s.open) {
      s.open = true;
      s.tokens = [];
      c.sfx('door');
      c.open('exit');
    }
    if (s.open && c.drone.x + c.drone.w / 2 > PASS_X) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `14px ${FONT}`;
    g.fillStyle = PAL.text;
    g.fillText('SHELF', SHELF_X + SHELF_W / 2, SHELF_Y - 22);
    // the PLATE and the DRIVER pad: copper strips on the floor, with labels above them
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.amber;
    for (const pad of [PLATE, DRIVER]) {
      g.fillRect(pad.x, F - 6, pad.w, 6);
      g.strokeRect(pad.x, F - 6, pad.w, 6);
    }
    g.fillStyle = PAL.text;
    g.font = `13px ${FONT}`;
    g.fillText('PLATE', PLATE.x + PLATE.w / 2, F - 60);
    g.fillText('DRIVER', DRIVER.x + DRIVER.w / 2, F - 60);
    drawBelt(g, s);
    // each block's number, above the block (a carried block shows its number over the drone)
    g.fillStyle = PAL.text;
    g.font = `16px ${FONT}`;
    s.shown.forEach((p, i) => g.fillText(String(NUMBERS[i]), p.x, p.y - HALF - 14));
    drawBoard(g, s);
    g.restore();
  },
  nudge: 'Put block 1 on the plate, then step on DRIVER. Then block 2, then 3.',
};

// Discovery beat 'repeater', Bypass Bus (Phase 6 Spec, section 4): a long wire is slow, and repeaters cut it into short
// pieces that are each fast. A trace runs 1200 px from the SEND button to the exit door. A pulse on it takes
// 4.0 s / (1 + n) to reach the door, where n is the number of buffer blocks in the three sockets on the trace. The
// door opens when the pulse arrives and stays open for 1 s + (4.0 - delay) * 2, so with no blocks it shuts after 1 s,
// before a drone that starts at the button can walk the 1200 px. Buffer blocks are crates marked with a triangle; the
// Field Coil moves them. Standing past the door solves the beat.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { FONT, LINE, PAL, rgba } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The SEND button on the floor at the trace's start, and the exit door at its far end: 1200 px apart. */
const BUTTON_X = 200;
const DOOR = r(1400, F - 200, 48, 200);
const TRACE_LEN = DOOR.x - BUTTON_X;
/** The trace runs along the floor face, TRACE_Y px down. */
const TRACE_Y = F + 28;
/** The three sockets: their centres, and their boxes on the floor (60 px wide, 40 px tall). */
export const SOCKETS = [560, 860, 1160];
const SOCKET_W = 60, SOCKET_H = 40;
/** The buffer blocks start on the floor near the button: crates of mass 1, side from crateSide. */
const BLOCK_SIDE = crateSide(1);
const START_X = [280, 330, 380];
/** The delay with no blocks, in seconds, and the door's base open time (1 s). */
const BASE_DELAY = 4.0, BASE_OPEN = 1.0;
/** The drone's rect is past the door once its left edge clears the door's right edge. */
const PAST = DOOR.x + DOOR.w;
/** A triangle's half base and height, px, drawn inside a block. */
const TRI_HALF = 7, TRI_PAD = 5;
/** The pulse's dot radius, px. */
const PULSE_R = 5;

/** The RC delay and the door's open time for n buffer blocks, in seconds: delay = 4.0 s / (1 + n), and the door stays
 * open 1 s + (4.0 - delay) * 2 after the pulse arrives. */
export function repeaterTiming(n: number): { delayS: number; openS: number } {
  const delayS = BASE_DELAY / (1 + n);
  return { delayS, openS: BASE_OPEN + (BASE_DELAY - delayS) * 2 };
}

/** The socket's box on the floor. */
const socketRect = (x: number): Rect => r(x - SOCKET_W / 2, F - SOCKET_H, SOCKET_W, SOCKET_H);

/** Which sockets hold a block: a block's rect overlaps the socket's box. */
function filledSockets(props: Rect[]): boolean[] {
  return SOCKETS.map((x) => props.some((p) => overlaps(p, socketRect(x))));
}

export interface RepeaterState {
  /** Which sockets hold a block now, and how many. */
  filled: boolean[];
  n: number;
  /** Every loose block now (held blocks are left out), for the triangle mark. */
  blocks: Rect[];
  /** Steps since SEND was pressed, or null while no pulse is on the trace. */
  age: number | null;
  /** The pulse's travel to the door, and the door's open time, in steps (set by the press). */
  delay: number;
  hold: number;
  /** The door is open now. */
  open: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
  traces: [], stations: [], triggers: [], gates: [],
};

function repeaterRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-repeater', name: 'The Repeater', role: 'discovery', mechanic: 'repeater', w: W, h: H,
    music: 'silicon',
    modules: [],
    spawn: spawnAt(140, F),
    // the wall above the door is solid, and the door fills the bottom 200 px of the wall
    solids: [...shell(W, H), r(DOOR.x, 0, DOOR.w, DOOR.y)],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [{ id: 'send', kind: 'lever', x: BUTTON_X, y: F, label: 'SEND' }],
    props: START_X.map((x) => ({ kind: 'crate' as const, mass: 1, x, y: F - BLOCK_SIDE / 2 - 1 })),
    traces: [trace(0, 500, 300), trace(W - 560, W, 300)],
    exit: { x: W - 40 },
  };
}

export const REPEATER: MechanicDef<RepeaterState> = {
  kind: 'repeater',
  room: repeaterRoom,
  init: () => ({
    filled: SOCKETS.map(() => false), n: 0, blocks: [], age: null, delay: 0, hold: 0, open: false, solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    s.blocks = c.props;
    s.filled = filledSockets(c.props);
    s.n = s.filled.filter(Boolean).length;
    if (s.age === null && c.used === 'send') {
      const { delayS, openS } = repeaterTiming(s.n);
      s.delay = frames(delayS * 1000);
      s.hold = frames(openS * 1000);
      s.age = 0;
      c.sfx('lever');
    } else if (s.age !== null) {
      // a press while the pulse is on the trace does nothing
      s.age += 1;
      if (s.age === s.delay) {
        s.open = true;
        c.open('exit');
      }
      if (s.age === s.delay + s.hold) {
        s.open = false;
        c.close('exit');
        s.age = null;
      }
    }
    if (s.open && c.drone.x > PAST) {
      s.solved = true;
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    drawTrace(g, s);
    drawSockets(g, s);
    drawBlocks(g, s.blocks);
    drawReadout(g, s);
    g.restore();
  },
  nudge: 'Put blocks in the sockets, press SEND, then run for the door.',
};

/** The trace as a dim line from the button to the door, lit from the button up to the pulse. */
function drawTrace(g: CanvasRenderingContext2D, s: RepeaterState) {
  g.strokeStyle = rgba(PAL.trace, 0.3);
  g.beginPath();
  g.moveTo(BUTTON_X, F);
  g.lineTo(BUTTON_X, TRACE_Y);
  g.lineTo(DOOR.x, TRACE_Y);
  g.lineTo(DOOR.x, F);
  g.stroke();
  if (s.age === null) return;
  const frac = Math.min(1, s.age / s.delay);
  const px = BUTTON_X + TRACE_LEN * frac;
  g.strokeStyle = PAL.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = LINE.traceGlow;
  g.beginPath();
  g.moveTo(BUTTON_X, TRACE_Y);
  g.lineTo(Math.min(px, DOOR.x), TRACE_Y);
  g.stroke();
  // the pulse itself: a bright dot riding the lit part
  g.fillStyle = PAL.trace;
  g.beginPath();
  g.arc(px, TRACE_Y, PULSE_R, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
}

/** Each socket: a box on the floor, dashed while empty and solid once a block sits in it, with its number above. */
function drawSockets(g: CanvasRenderingContext2D, s: RepeaterState) {
  g.font = `12px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  SOCKETS.forEach((x, i) => {
    const b = socketRect(x);
    g.strokeStyle = s.filled[i] ? PAL.trace : PAL.idle;
    g.fillStyle = PAL.fill;
    if (s.filled[i]) {
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeRect(b.x, b.y, b.w, b.h);
    } else {
      g.setLineDash([4, 4]);
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.setLineDash([]);
    }
    g.fillStyle = PAL.text;
    g.fillText(String(i + 1), x, b.y - 12);
  });
}

/** Each loose block: a triangle inside its crate, the mark of a buffer. */
function drawBlocks(g: CanvasRenderingContext2D, blocks: Rect[]) {
  g.strokeStyle = PAL.trace;
  for (const b of blocks) {
    const cx = b.x + b.w / 2, top = b.y + TRI_PAD, base = b.y + b.h - TRI_PAD;
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(cx + TRI_HALF, base);
    g.lineTo(cx - TRI_HALF, base);
    g.closePath();
    g.stroke();
  }
}

/** Three lines of text at the top left: the blocks placed, the pulse's delay, and the door's open time. */
function drawReadout(g: CanvasRenderingContext2D, s: RepeaterState) {
  const { delayS, openS } = repeaterTiming(s.n);
  const lines = [
    `Blocks in sockets: ${s.n} of ${SOCKETS.length}`,
    `The pulse takes ${delayS.toFixed(1)} s to reach the door.`,
    `The door stays open for ${openS.toFixed(1)} s.`,
  ];
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  lines.forEach((line, i) => g.fillText(line, 260, 110 + i * 20));
}

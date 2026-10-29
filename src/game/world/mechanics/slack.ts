// Discovery beat, Slack (Phase 6 Spec, section 4): a clock lamp ticks every 2.4 s. Stepping on LAUNCH arms one data
// token, and it leaves on the next tick, so the capture edge is always one full period (2.4 s) after it leaves. Lever
// PATH picks the path: A has three gate blocks (1.2 s each, 3.6 s), B has one (1.2 s). The capture door opens and stays
// open only if the token has arrived by that edge. A readout shows slack = required − arrival: +1.2 s on B, −1.2 s on A.
// Solved past the capture door.
import type { Rect } from '../../level/room';
import { FONT, LINE, PAL, rgba } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { frames, HZ } from '../../tuning';
import { floorY, r, shell, spawnAt } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The clock: one tick every 2.4 s, in steps. Its lamp lights for 0.12 s after each tick. */
const PERIOD = frames(2400), BLINK = frames(120);
/** One gate block takes 1.2 s, in steps. */
const GATE = frames(1200);
/** The two paths. */
export type Path = 'A' | 'B';
/** The gate blocks on each path, by their centre x. Lane A is the lower lane, lane B the upper one. */
const BLOCKS: Record<Path, number[]> = { A: [460, 660, 860], B: [660] };
/** The lane heights (centre lines). */
const LANE_Y: Record<Path, number> = { A: 520, B: 360 };
/** A token's travel time on each path, in steps: 3.6 s on A, 1.2 s on B. */
export const TRAVEL: Record<Path, number> = { A: BLOCKS.A.length * GATE, B: BLOCKS.B.length * GATE };
/** The LAUNCH pad: a step, its top at y 600. The token trunk rises from its middle. */
const LAUNCH = r(200, 600, 120, 40);
const TRUNK_X = 260;
/** The PATH lever's x on the floor. */
const PATH_X = 420;
/** The capture door on the right: 48 px wide, tall enough to block both lanes, with the wall solid above it. */
const CAPTURE = r(1240, 300, 48, 340);
const CAPTURE_WALL = r(CAPTURE.x, 0, CAPTURE.w, CAPTURE.y);
/** The exit door past the capture door, standing on the floor, with the wall solid above it. */
const EXIT = r(W - 200, F - 200, 48, 200);
const EXIT_WALL = r(EXIT.x, 0, EXIT.w, EXIT.y);
/** A gate block's box, px. */
const BOX = { w: 64, h: 28 };
/** The token's radius, px. */
const TOKEN_R = 6;
/** The clock lamp's centre and radius, and the readout's top left corner. */
const LAMP = { x: 260, y: 96 }, LAMP_R = 22;
const READ = { x: 820, y: 96 };
/** The drone's spawn on the floor, at the left. */
const SPAWN = spawnAt(100, F);
/** Lines TAPEOUT says when the token is late and when the door opens. */
const LATE_LINE = 'The token lands after the clock edge. The door stays shut.';
const SOLVE_LINE = 'Data made it before the clock edge. That spare time is slack.';

/** The slack of a path, in seconds: the required time (one clock period) minus the arrival (the path's travel time). */
export function slackSeconds(path: Path): number {
  return (PERIOD - TRAVEL[path]) / HZ;
}

export interface SlackState {
  /** The step count, for the draw. */
  t: number;
  /** Lever PATH: the path the next token takes. */
  path: Path;
  /** LAUNCH was stepped on: the token leaves on the next tick. */
  armed: boolean;
  /** The drone stood on LAUNCH last step: a press is a step onto it, not a stand on it. */
  pad: boolean;
  /** The token out now: the step it left on, and its path. Null when none is out. */
  flight: { at: number; path: Path } | null;
  /** The capture door has opened, and stays open. */
  open: boolean;
  /** The late line has been said. */
  told: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
  traces: [], stations: [], triggers: [],
};

function slackRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-slack', name: 'Slack', role: 'discovery', mechanic: 'slack', w: W, h: H, music: 'silicon', modules: [],
    spawn: SPAWN,
    solids: [...shell(W, H), LAUNCH, CAPTURE_WALL, EXIT_WALL],
    gates: [
      { id: 'capture', kind: 'door', rect: CAPTURE },
      { id: 'exit', kind: 'door', rect: EXIT },
    ],
    stations: [{ id: 'path', kind: 'lever', x: PATH_X, y: F, label: 'PATH' }],
    exit: { x: W - 40 },
  };
}

/** The drone stands on a rect: grounded, within its width, feet on its top. */
function standing(c: MechCtx, rect: Rect): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > rect.x && cx < rect.x + rect.w && Math.abs(d.y + d.h - rect.y) <= 2;
}

/** The clock ticks on step t (every period, not on step 0). */
const isTick = (t: number) => t > 0 && t % PERIOD === 0;

/** A token stays out for its travel time, and sits at the door until the edge. Then it is gone. */
const flightEnd = (f: { at: number; path: Path }) => f.at + Math.max(TRAVEL[f.path], PERIOD);

/** The clock lamp: a glowing disc for BLINK steps after each tick, a dashed ring otherwise. */
function clockLamp(g: CanvasRenderingContext2D, t: number) {
  const on = t > 0 && t % PERIOD < BLINK;
  g.beginPath();
  g.arc(LAMP.x, LAMP.y, LAMP_R, 0, Math.PI * 2);
  if (on) {
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
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('CLOCK 2.4 s', LAMP.x, LAMP.y + LAMP_R + 18);
}

/** One path: its lane, its gate blocks and its name. The chosen path is bright, the other dim. */
function lane(g: CanvasRenderingContext2D, p: Path, live: boolean) {
  const y = LANE_Y[p];
  g.strokeStyle = rgba(PAL.trace, live ? 0.8 : 0.3);
  g.lineWidth = LINE.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = live ? LINE.traceGlow : 0;
  g.beginPath();
  g.moveTo(TRUNK_X, y);
  g.lineTo(CAPTURE.x, y);
  g.stroke();
  g.shadowBlur = 0;
  g.font = `12px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const x of BLOCKS[p]) {
    g.strokeStyle = rgba(PAL.trace, live ? 0.9 : 0.4);
    g.strokeRect(x - BOX.w / 2, y - BOX.h / 2, BOX.w, BOX.h);
    g.fillStyle = live ? PAL.text : PAL.idle;
    g.fillText('GATE', x, y);
  }
  g.fillStyle = live ? PAL.text : PAL.idle;
  g.font = `14px ${FONT}`;
  g.textAlign = 'left';
  g.fillText(`PATH ${p}`, TRUNK_X + 16, y - 18);
}

/** The token, out on its lane: it moves at its path's pace and waits at the capture door once it has arrived. */
function token(g: CanvasRenderingContext2D, f: { at: number; path: Path }, t: number) {
  const p = Math.min(1, (t - f.at) / TRAVEL[f.path]);
  const x = TRUNK_X + (CAPTURE.x - TRUNK_X) * p;
  g.fillStyle = PAL.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = LINE.droneGlow;
  g.beginPath();
  g.arc(x, LANE_Y[f.path], TOKEN_R, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
}

/** The readout: slack = required − arrival, in green with a plus when it is positive, red with a minus when not. */
function readout(g: CanvasRenderingContext2D, path: Path) {
  const v = slackSeconds(path), ok = v >= 0;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.fillText('slack = required − arrival', READ.x, READ.y);
  g.fillStyle = ok ? PAL.ok : PAL.hostile;
  g.font = `28px ${FONT}`;
  g.fillText(`${ok ? '+' : '−'}${Math.abs(v).toFixed(1)} s`, READ.x, READ.y + 36);
  g.fillStyle = PAL.idle;
  g.font = `14px ${FONT}`;
  g.fillText(`${(PERIOD / HZ).toFixed(1)} s − ${(TRAVEL[path] / HZ).toFixed(1)} s`, READ.x, READ.y + 66);
}

export const SLACK: MechanicDef<SlackState> = {
  kind: 'slack',
  room: slackRoom,
  init: () => ({ t: 0, path: 'A', armed: false, pad: false, flight: null, open: false, told: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    s.t = c.t;
    if (c.used === 'path') {
      s.path = s.path === 'A' ? 'B' : 'A';
      c.sfx('lever');
    }
    // the capture edge, one period after the token left: the door opens only if the token has arrived by then
    const f = s.flight;
    if (f && c.t === f.at + PERIOD) {
      if (TRAVEL[f.path] <= PERIOD) {
        s.open = true;
        c.open('capture');
        c.sfx('door');
      } else if (!s.told) {
        s.told = true;
        c.say(LATE_LINE);
      }
    }
    if (f && c.t >= flightEnd(f)) s.flight = null;
    // LAUNCH: stepping onto the pad arms one token, which leaves on the next tick
    const onPad = standing(c, LAUNCH);
    if (onPad && !s.pad && s.flight === null) s.armed = true;
    s.pad = onPad;
    if (s.armed && s.flight === null && isTick(c.t)) {
      s.armed = false;
      s.flight = { at: c.t, path: s.path };
      c.sfx('plate');
    }
    // past the open capture door, on the floor: done
    const d = c.drone;
    if (s.open && c.grounded && Math.abs(d.y + d.h - F) <= 2 && d.x + d.w / 2 > CAPTURE.x + CAPTURE.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    clockLamp(g, s.t);
    // the trunk from LAUNCH up to the lower lane, then both lanes with their gate blocks
    g.strokeStyle = rgba(PAL.trace, 0.4);
    g.lineWidth = LINE.trace;
    g.beginPath();
    g.moveTo(TRUNK_X, LAUNCH.y);
    g.lineTo(TRUNK_X, LANE_Y.B);
    g.stroke();
    lane(g, 'A', s.path === 'A');
    lane(g, 'B', s.path === 'B');
    if (s.flight) token(g, s.flight, s.t);
    // the LAUNCH pad, with a dashed ring and a note while the token waits for the tick
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('LAUNCH', LAUNCH.x + LAUNCH.w / 2, LAUNCH.y + LAUNCH.h / 2);
    if (s.armed) {
      g.strokeStyle = PAL.amber;
      g.setLineDash([4, 6]);
      g.strokeRect(LAUNCH.x - 6, LAUNCH.y - 6, LAUNCH.w + 12, LAUNCH.h + 12);
      g.setLineDash([]);
      g.textAlign = 'left';
      g.fillStyle = PAL.amber;
      g.fillText('ARMED: waits for the tick', TRUNK_X + 16, 580);
    }
    // the capture door's label, the lever's readout
    g.fillStyle = PAL.text;
    g.textAlign = 'center';
    g.fillText('CAPTURE', CAPTURE.x + CAPTURE.w / 2, CAPTURE.y - 14);
    readout(g, s.path);
    g.restore();
  },
  nudge: 'Pick path B with PATH, then step on LAUNCH.',
};

// Discovery beat 'return', The Board (Phase 6 Spec, section 4): a driver pad on the left sends current along a top
// trace to a receiver on the right. Its return current runs back through the ground plane under the floor. The plane
// has a 200 px split, so while nothing bridges it the return loops around the split, and the big loop throws noise
// sparks at the drone (8 damage every 1.5 s) and keeps the door shut. Two copper bridge blocks (crates) carried into
// the split give the return a straight path under the trace: the sparks stop, the door opens, and the beat is solved
// once the drone is past it. The bridges latch: once the return runs straight it stays that way.
import type { Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { FONT, LINE, PAL, rgba } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames } from '../../tuning';
import { floorY, r, shell, spawnAt } from '../templates/kit';
import type { MechanicDef } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The ground plane runs under the floor at PLANE_Y; the big loop dips to PLANE_LOW below the split. */
const PLANE_Y = 668, PLANE_LOW = 704, PLANE_X0 = 60, PLANE_X1 = W - 60;
/** The split in the plane: 200 px wide, from SPLIT_X to SPLIT_X + SPLIT_W. */
const SPLIT_X = 700, SPLIT_W = 200;
/** Copper bridge blocks: how many fill the split, their crate mass, and where they start. */
const BRIDGES = 2, BRIDGE_MASS = 2, BRIDGE_X = [360, 440];
/** Noise sparks while the loop is big: 8 damage every 1.5 s, each flashing for 0.4 s. */
const SPARK_DAMAGE = 8, SPARK_STEPS = frames(1500), FLASH_STEPS = frames(400);
/** The driver pad (left), the receiver pad (right), and the top trace between them at TRACE_Y. */
const DRIVER_X = 170, RECEIVER_X = 1310, TRACE_Y = 420, PAD_W = 60, PAD_H = 10;
/** Past this x the drone has passed the door (the door is 48 px wide, its right edge at W - 152). */
const PASS_X = W - 152;
/** The return's dashes move 2 px a frame, along the return path (from the receiver back to the driver). */
const DASH_SPEED = 2;
/** The loop's corners, from the receiver back to the driver. */
const LOOP: Vec[] = [
  { x: RECEIVER_X, y: PLANE_Y },
  { x: SPLIT_X + SPLIT_W, y: PLANE_Y },
  { x: SPLIT_X + SPLIT_W, y: PLANE_LOW },
  { x: SPLIT_X, y: PLANE_LOW },
  { x: SPLIT_X, y: PLANE_Y },
  { x: DRIVER_X, y: PLANE_Y },
];
/** The straight return: the same path, directly under the trace. */
const STRAIGHT: Vec[] = [{ x: RECEIVER_X, y: PLANE_Y }, { x: DRIVER_X, y: PLANE_Y }];

/** TAPEOUT's lines. */
const NOISE_LINE = 'Noise. The return took the long way round the split.';
const LINK_LINE = 'Two bridges. The return runs straight under its signal now.';
const SOLVE_LINE = 'Keep the return close to the trace. Small loops, little noise.';

export interface ReturnState {
  /** Bridge blocks sitting in the split, counted on the last step. */
  bridges: number;
  /** Both bridges are in: the return runs straight, and it stays that way. */
  linked: boolean;
  /** Steps since the last spark while the loop is big. */
  spark: number;
  /** Steps the last spark still shows, and the drone's centre it flew at. */
  flash: number;
  aim: Vec;
  /** The first spark's hint has been said. */
  told: boolean;
  solved: boolean;
}

/** A bridge block counts when its centre is inside the split. */
const inSplit = (b: Rect) => {
  const cx = b.x + b.w / 2;
  return cx > SPLIT_X && cx < SPLIT_X + SPLIT_W;
};

function returnRoom(): StoryRoom {
  return {
    id: 'discovery-return', name: 'The Board', role: 'discovery', mechanic: 'return', w: W, h: H, music: 'silicon',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, F - 200)],
    oneWay: [], hazards: [], plates: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
    props: BRIDGE_X.map((x) => ({
      kind: 'crate' as const, mass: BRIDGE_MASS, x, y: F - crateSide(BRIDGE_MASS) / 2 - 1,
    })),
    traces: [],
    stations: [],
    triggers: [],
    gates: [{ id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) }],
    exit: { x: W - 40 },
  };
}

export const RETURN: MechanicDef<ReturnState> = {
  kind: 'return',
  room: returnRoom,
  init: () => ({ bridges: 0, linked: false, spark: 0, flash: 0, aim: { x: 0, y: 0 }, told: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    const d = c.drone, cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    if (!s.linked) {
      s.bridges = c.props.filter(inSplit).length;
      if (s.bridges >= BRIDGES) {
        s.linked = true;
        s.flash = 0;
        c.sfx('door');
        c.open('exit');
        c.say(LINK_LINE);
      } else {
        s.spark += 1;
        if (s.spark >= SPARK_STEPS) {
          s.spark = 0;
          s.flash = FLASH_STEPS;
          s.aim = { x: cx, y: cy };
          c.hurt(SPARK_DAMAGE);
          if (!s.told) {
            s.told = true;
            c.say(NOISE_LINE);
          }
        }
      }
    }
    if (s.flash > 0) s.flash -= 1;
    if (s.linked && cx > PASS_X) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s, t) {
    g.save();
    g.lineWidth = LINE.world;
    drawBoard(g);
    drawPlane(g, s.linked);
    drawReturn(g, s.linked, t);
    if (s.flash > 0) drawSpark(g, s.aim);
    g.restore();
  },
  nudge: 'Carry both copper blocks into the split under the trace.',
};

/** The driver and receiver pads, and the top trace between them with its stalks. */
function drawBoard(g: CanvasRenderingContext2D) {
  g.strokeStyle = rgba(PAL.trace, 0.8);
  g.shadowColor = PAL.trace;
  g.shadowBlur = LINE.traceGlow;
  g.beginPath();
  g.moveTo(DRIVER_X, TRACE_Y);
  g.lineTo(RECEIVER_X, TRACE_Y);
  g.stroke();
  g.shadowBlur = 0;
  for (const x of [DRIVER_X, RECEIVER_X]) {
    g.strokeStyle = PAL.line;
    g.beginPath();
    g.moveTo(x, F - PAD_H);
    g.lineTo(x, TRACE_Y);
    g.stroke();
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.amber;
    g.fillRect(x - PAD_W / 2, F - PAD_H, PAD_W, PAD_H);
    g.strokeRect(x - PAD_W / 2, F - PAD_H, PAD_W, PAD_H);
  }
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DRIVER', DRIVER_X, TRACE_Y - 18);
  g.fillText('RECEIVER', RECEIVER_X, TRACE_Y - 18);
}

/** The copper ground plane under the floor. The split is a gap in it until the bridges fill it. */
function drawPlane(g: CanvasRenderingContext2D, linked: boolean) {
  g.lineWidth = 6;
  g.strokeStyle = rgba(PAL.amber, 0.45);
  g.beginPath();
  g.moveTo(PLANE_X0, PLANE_Y);
  g.lineTo(SPLIT_X, PLANE_Y);
  g.moveTo(SPLIT_X + SPLIT_W, PLANE_Y);
  g.lineTo(PLANE_X1, PLANE_Y);
  g.stroke();
  g.lineWidth = LINE.world;
  if (linked) {
    g.strokeStyle = PAL.amber;
    g.beginPath();
    g.moveTo(SPLIT_X, PLANE_Y);
    g.lineTo(SPLIT_X + SPLIT_W, PLANE_Y);
    g.stroke();
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([4, 6]);
    g.beginPath();
    g.moveTo(SPLIT_X, PLANE_Y - 10);
    g.lineTo(SPLIT_X, PLANE_Y + 10);
    g.moveTo(SPLIT_X + SPLIT_W, PLANE_Y - 10);
    g.lineTo(SPLIT_X + SPLIT_W, PLANE_Y + 10);
    g.stroke();
    g.setLineDash([]);
  }
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(linked ? 'SPLIT BRIDGED' : 'SPLIT 200 PX', SPLIT_X + SPLIT_W / 2, PLANE_LOW - 14);
  g.fillText(linked ? 'RETURN STRAIGHT' : 'BIG LOOP', SPLIT_X + SPLIT_W / 2, F - 96);
}

/** The return current: moving dashes along the straight path, or round the loop while the split is open. */
function drawReturn(g: CanvasRenderingContext2D, linked: boolean, t: number) {
  g.beginPath();
  const path = linked ? STRAIGHT : LOOP;
  path.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  g.strokeStyle = linked ? rgba(PAL.trace, 0.9) : PAL.hostile;
  g.shadowColor = linked ? PAL.trace : PAL.hostile;
  g.shadowBlur = LINE.traceGlow;
  g.setLineDash([10, 8]);
  g.lineDashOffset = -t * DASH_SPEED;
  g.stroke();
  g.setLineDash([]);
  g.lineDashOffset = 0;
  g.shadowBlur = 0;
}

/** A jagged spark from the split to the drone, with a "!" by the drone. */
function drawSpark(g: CanvasRenderingContext2D, aim: Vec) {
  const x0 = SPLIT_X + SPLIT_W / 2, y0 = PLANE_Y;
  const N = 5;
  g.strokeStyle = PAL.hostile;
  g.shadowColor = PAL.hostile;
  g.shadowBlur = LINE.shotGlow;
  g.beginPath();
  g.moveTo(x0, y0);
  for (let i = 1; i < N; i++) {
    const k = i / N, side = i % 2 ? 10 : -10;
    g.lineTo(x0 + (aim.x - x0) * k + side, y0 + (aim.y - y0) * k);
  }
  g.lineTo(aim.x, aim.y);
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = PAL.hostile;
  g.font = `22px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', aim.x, aim.y - 34);
}

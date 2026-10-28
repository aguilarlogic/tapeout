// Discovery beat 'bins', Coverage Holes (Phase 7 Spec, section 4): a coverage ring on the wall has 4 segments for 4 bins.
// Bin A is a floor cup, bin B a cup on a 140 px ledge, bin C a cup on a 300 px ledge, and bin D a cup inside a box whose
// right wall has a 40 px slot at floor level. The drone is too tall for the slot, so only a crate (28 px) can reach D.
// A bin lights when the drone or any crate touches it. The ring shows the percent, and the door opens at 100%. A crate
// that lies on the lower ledge, against the upper one, is the step up to C. Solved past the door.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { FONT, LINE, PAL, rgba } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** The lower ledge (140 px) and the upper ledge (300 px): solid blocks standing on the floor, flush with each other. */
export const B_BLOCK = r(400, F - 140, 180, 140);
export const C_BLOCK = r(580, F - 300, 160, 300);
/** The box round bin D: a roof 140 px up that the drone can stand on, a left wall, and a right wall whose slot sits at
 * floor level. The slot is 40 px tall: the drone is 48 px and cannot pass, a crate of mass 1 (28 px) can. */
export const D_ROOF = r(900, F - 140, 120, 20);
const D_LEFT = r(900, F - 120, 20, 120);
const D_RIGHT = r(1000, F - 120, 20, 80);
export const SLOT_H = 40;
/** The four bins' cups, A to D, each 60 x 28 px and standing on the floor or a ledge. */
export const CUPS: Rect[] = [
  r(260, F - 28, 60, 28),
  r(420, B_BLOCK.y - 28, 60, 28),
  r(600, C_BLOCK.y - 28, 60, 28),
  r(920, F - 28, 60, 28),
];
const LABELS = ['A', 'B', 'C', 'D'];
const BIN_COUNT = CUPS.length;
/** The step crate: mass 2 (40 px), on the lower ledge against the upper one, so it cannot roll off. */
export const STEP_X = 560;
const STEP_Y = B_BLOCK.y - crateSide(2) / 2 - 1;
/** The crate for the slot (mass 1, on the floor, right of the box) and a spare one. */
const SLOT_CRATE_X = 1060, SPARE_X = 1200;
const CRATE_Y = F - crateSide(1) / 2 - 1;
/** The coverage ring on the wall: its centre and radius. Segments run clockwise from the top. */
const RING = { x: 800, y: 160, r: 80 };
/** Lines TAPEOUT says when the door first opens and when the beat is done. */
const OPEN_LINE = 'Every bin has a hit. Coverage is full.';
const SOLVE_LINE = 'Some bins fill only when a test aims at them.';

export interface BinsState {
  /** Each bin has been touched by the drone or a crate (a bin, once lit, stays lit). */
  hit: boolean[];
  /** The door is open: all four bins are lit. */
  open: boolean;
  solved: boolean;
}

/** The coverage in percent: lit bins over all bins, rounded. */
export function coverage(hit: boolean[]): number {
  return Math.round((hit.filter(Boolean).length / BIN_COUNT) * 100);
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
};

function binsRoom(): StoryRoom {
  return {
    ...none,
    props: [
      { kind: 'crate', mass: 2, x: STEP_X, y: STEP_Y },
      { kind: 'crate', mass: 1, x: SLOT_CRATE_X, y: CRATE_Y },
      { kind: 'crate', mass: 1, x: SPARE_X, y: CRATE_Y },
    ],
    traces: [trace(0, 700, 260), trace(900, W, 260)],
    id: 'discovery-bins', name: 'The Coverage Holes', role: 'discovery', mechanic: 'bins', w: W, h: H, music: 'cluster',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y), B_BLOCK, C_BLOCK, D_ROOF, D_LEFT, D_RIGHT],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [],
    triggers: [],
    exit: { x: W - 40 },
  };
}

/** Drives the door to `open` with one call and one sfx per change. */
function drive(c: MechCtx, s: BinsState, open: boolean) {
  if (open === s.open) return;
  s.open = open;
  c.sfx('door');
  if (open) c.open('exit');
  else c.close('exit');
}

/** The ring: one arc per bin, lit and solid when the bin is hit, dashed when not, with its letter outside it. The
 * percent sits in the middle, and "D never hit" says what is missing once three bins are lit. */
function drawRing(g: CanvasRenderingContext2D, s: BinsState) {
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  LABELS.forEach((label, i) => {
    const a0 = -Math.PI / 2 + (i * Math.PI) / 2, a1 = a0 + Math.PI / 2, mid = a0 + Math.PI / 4;
    g.beginPath();
    g.arc(RING.x, RING.y, RING.r, a0, a1);
    g.strokeStyle = s.hit[i] ? PAL.ok : PAL.idle;
    g.setLineDash(s.hit[i] ? [] : [6, 6]);
    if (s.hit[i]) { g.shadowColor = PAL.ok; g.shadowBlur = 10; }
    g.stroke();
    g.shadowBlur = 0;
    g.setLineDash([]);
    g.fillStyle = PAL.text;
    g.fillText(label, RING.x + Math.cos(mid) * (RING.r + 22), RING.y + Math.sin(mid) * (RING.r + 22));
  });
  g.fillStyle = PAL.text;
  g.font = `22px ${FONT}`;
  g.fillText(`${coverage(s.hit)}%`, RING.x, RING.y);
  g.font = `11px ${FONT}`;
  g.fillText('COVERAGE', RING.x, RING.y - RING.r - 26);
  if (!s.hit[BIN_COUNT - 1] && coverage(s.hit) >= 75) {
    g.fillStyle = PAL.hostile;
    g.font = `13px ${FONT}`;
    g.fillText('D never hit', RING.x, RING.y + RING.r + 26);
  }
}

/** A bin: a U-shaped cup with its letter above it. Lit bins are filled and solid; unlit ones are dashed outlines. */
function drawCup(g: CanvasRenderingContext2D, cup: Rect, label: string, lit: boolean) {
  g.strokeStyle = lit ? PAL.ok : PAL.idle;
  g.setLineDash(lit ? [] : [4, 4]);
  if (lit) {
    g.fillStyle = rgba(PAL.ok, 0.25);
    g.fillRect(cup.x, cup.y, cup.w, cup.h);
    g.shadowColor = PAL.ok;
    g.shadowBlur = 10;
  }
  g.beginPath();
  g.moveTo(cup.x, cup.y);
  g.lineTo(cup.x, cup.y + cup.h);
  g.lineTo(cup.x + cup.w, cup.y + cup.h);
  g.lineTo(cup.x + cup.w, cup.y);
  g.stroke();
  g.shadowBlur = 0;
  g.setLineDash([]);
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, cup.x + cup.w / 2, cup.y - 14);
}

export const BINS: MechanicDef<BinsState> = {
  kind: 'bins',
  room: binsRoom,
  init: () => ({ hit: CUPS.map(() => false), open: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    CUPS.forEach((cup, i) => {
      if (!s.hit[i] && (overlaps(c.drone, cup) || c.props.some((p) => overlaps(p, cup)))) s.hit[i] = true;
    });
    if (!s.open && s.hit.every(Boolean)) {
      drive(c, s, true);
      c.say(OPEN_LINE);
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
    drawRing(g, s);
    CUPS.forEach((cup, i) => drawCup(g, cup, LABELS[i], s.hit[i]));
    // the slot, named above the box's roof
    g.fillStyle = PAL.text;
    g.font = `11px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`SLOT ${SLOT_H} PX`, (D_ROOF.x + D_ROOF.x + D_ROOF.w) / 2, D_ROOF.y - 14);
    g.restore();
  },
  nudge: 'Touch every bin. Bin D is behind a slot a drone cannot fit through.',
};

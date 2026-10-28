// Discovery beat 'scoreboard', The Pass That Checked Nothing (Phase 7 Spec, section 4): a DUT box adds A = 2 and B = 3
// and shows OUT 6, because its carry-in is stuck at 1. Lever FIX clears the stuck carry, so OUT becomes 5. A scoreboard
// by the door shows a big PASS, but its CHECK cable hangs loose, so it compares nothing and the door stays shut. Drop the
// CHK block (a crate with a check mark) in the socket under the cable: the scoreboard now compares OUT with the expected
// 5 and shows FAIL while OUT is 6. With FIX on, OUT is 5, the verdict is PASS and the door opens. Solved past the door.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** The DUT: a box on the floor, 200 x 160 px, with its inputs and its output written on it. */
const DUT = r(420, F - 160, 200, 160);
/** The DUT's inputs, and the sum it must give with no carry-in. */
const A_IN = 2, B_IN = 3;
export const EXPECTED = A_IN + B_IN;
/** The stuck carry adds this much to OUT until FIX clears it. */
const STUCK_CARRY = 1;
/** The FIX lever on the floor, to the right of the DUT. */
const FIX_X = 660;
/** The scoreboard panel by the door, and the x where its CHECK cable leaves its bottom edge. */
const PANEL = r(1180, 170, 200, 150);
const CABLE_X = 1220;
/** The socket on the floor under the cable's end: a 44 x 28 px box whose top the CHK block sits on. */
export const SOCKET = r(1198, F - 28, 44, 28);
/** Where the CHK block starts: a mass 1 crate on the floor, away from the socket. */
const CHK_X = 800;
const CHK_Y = F - crateSide(1) / 2 - 1;
/** The lines TAPEOUT says: when FIX is flipped with the checker unplugged, and when the beat is done. */
const TOLD_LINE = 'It passes, but it checked nothing.';
const SOLVE_LINE = 'The checker compares the real answer. Now PASS means something.';

export interface ScoreboardState {
  /** FIX is on: the carry-in is no longer stuck, so OUT is 5. */
  fix: boolean;
  /** The CHK block sits in the socket: the cable is connected and the scoreboard compares. */
  plugged: boolean;
  /** OUT now: A + B, plus the stuck carry while FIX is off. */
  out: number;
  /** The scoreboard's verdict now: PASS, or FAIL when connected and OUT is not the expected sum. */
  pass: boolean;
  /** The door is open: connected, and OUT is the expected sum. */
  open: boolean;
  /** The CHK block's bounds on the last step, while it lies loose on the floor. */
  crate: Rect | null;
  /** The FIX-first line has been said. */
  told: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
};

function scoreboardRoom(): StoryRoom {
  return {
    ...none,
    props: [{ kind: 'crate', mass: 1, x: CHK_X, y: CHK_Y }],
    traces: [trace(0, 700, 240), trace(760, 1100, 240)],
    id: 'discovery-scoreboard', name: 'The Testbench', role: 'discovery', mechanic: 'scoreboard', w: W, h: H,
    music: 'cluster',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y)],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [{ id: 'fix', kind: 'lever', x: FIX_X, y: F, label: 'FIX' }],
    triggers: [],
    exit: { x: W - 40 },
  };
}

/** Drives the door to `open` with one call and one sfx per change. */
function drive(c: MechCtx, s: ScoreboardState, open: boolean) {
  if (open === s.open) return;
  s.open = open;
  c.sfx('door');
  if (open) c.open('exit');
  else c.close('exit');
}

/** The DUT: its inputs and its output, written on the box so the sum can be read. */
function drawDut(g: CanvasRenderingContext2D, s: ScoreboardState) {
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.line;
  g.fillRect(DUT.x, DUT.y, DUT.w, DUT.h);
  g.strokeRect(DUT.x, DUT.y, DUT.w, DUT.h);
  const cx = DUT.x + DUT.w / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.fillText('DUT', cx, DUT.y + 20);
  g.font = `13px ${FONT}`;
  g.fillText(`A = ${A_IN}   B = ${B_IN}`, cx, DUT.y + 50);
  g.font = `26px ${FONT}`;
  g.fillText(`OUT ${s.out}`, cx, DUT.y + 88);
  g.font = `12px ${FONT}`;
  g.fillText(s.fix ? 'carry in 0' : 'carry in stuck at 1', cx, DUT.y + 122);
}

/** The FIX lever's words: what it does now, beside the handle. */
function drawLever(g: CanvasRenderingContext2D, s: ScoreboardState) {
  g.fillStyle = s.fix ? PAL.ok : PAL.text;
  g.font = `13px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(`FIX ${s.fix ? 'ON' : 'OFF'}`, FIX_X + 28, F - 30);
}

/** The CHECK cable: solid into the socket while connected, dashed and hanging with an open tip while loose. */
function drawCable(g: CanvasRenderingContext2D, s: ScoreboardState) {
  const top = PANEL.y + PANEL.h;
  if (s.plugged) {
    g.strokeStyle = PAL.ok;
    g.shadowColor = PAL.ok;
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(CABLE_X, top);
    g.lineTo(CABLE_X, SOCKET.y);
    g.stroke();
    g.shadowBlur = 0;
    return;
  }
  g.strokeStyle = PAL.amber;
  g.setLineDash([6, 6]);
  g.beginPath();
  g.moveTo(CABLE_X, top);
  g.quadraticCurveTo(CABLE_X + 30, top + 60, CABLE_X + 10, top + 100);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.arc(CABLE_X + 10, top + 100, 4, 0, Math.PI * 2);
  g.stroke();
}

/** The scoreboard: its title, the big verdict, and the line that says why. */
function drawPanel(g: CanvasRenderingContext2D, s: ScoreboardState) {
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.line;
  g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  g.strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  const cx = PANEL.x + PANEL.w / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = PAL.text;
  g.font = `12px ${FONT}`;
  g.fillText('SCOREBOARD', cx, PANEL.y + 20);
  g.fillStyle = s.pass ? PAL.ok : PAL.hostile;
  g.font = `40px ${FONT}`;
  g.fillText(s.pass ? 'PASS' : '! FAIL', cx, PANEL.y + 72);
  g.fillStyle = PAL.text;
  g.font = `13px ${FONT}`;
  g.fillText(s.plugged ? `expected ${EXPECTED}, got ${s.out}` : 'CHECK cable loose', cx, PANEL.y + 120);
}

/** The socket: dashed while empty, solid once the CHK block sits in it, labelled at its right. */
function drawSocket(g: CanvasRenderingContext2D, s: ScoreboardState) {
  g.strokeStyle = s.plugged ? PAL.ok : PAL.idle;
  g.setLineDash(s.plugged ? [] : [4, 4]);
  g.strokeRect(SOCKET.x, SOCKET.y, SOCKET.w, SOCKET.h);
  g.setLineDash([]);
  g.fillStyle = PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('SOCKET', SOCKET.x + SOCKET.w + 8, SOCKET.y + SOCKET.h / 2);
}

/** The CHK block's tag: a check mark and its name above the crate, while it lies loose. The crate is drawn over
 * anything under it, so the tag sits in the air above the crate's top. */
function drawTag(g: CanvasRenderingContext2D, s: ScoreboardState) {
  if (!s.crate || s.plugged) return;
  const cx = s.crate.x + s.crate.w / 2, top = s.crate.y;
  g.strokeStyle = PAL.ok;
  g.beginPath();
  g.moveTo(cx - 6, top - 26);
  g.lineTo(cx - 2, top - 22);
  g.lineTo(cx + 6, top - 30);
  g.stroke();
  g.fillStyle = PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CHK', cx, top - 44);
}

export const SCOREBOARD: MechanicDef<ScoreboardState> = {
  kind: 'scoreboard',
  room: scoreboardRoom,
  init: () => ({
    fix: false, plugged: false, out: A_IN + B_IN + STUCK_CARRY, pass: true, open: false, crate: null, told: false,
    solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    s.crate = c.props[0] ?? null;
    s.plugged = c.props.some((p) => overlaps(p, SOCKET));
    if (c.used === 'fix') {
      s.fix = !s.fix;
      c.sfx('lever');
      // FIX first, with nothing to check the sum: the scoreboard passes, and TAPEOUT says so
      if (s.fix && !s.plugged && !s.told) {
        s.told = true;
        c.say(TOLD_LINE);
      }
    }
    s.out = A_IN + B_IN + (s.fix ? 0 : STUCK_CARRY);
    s.pass = !s.plugged || s.out === EXPECTED;
    drive(c, s, s.plugged && s.pass);
    if (s.open && c.drone.x + c.drone.w / 2 > DOOR.x + DOOR.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    drawDut(g, s);
    drawLever(g, s);
    drawCable(g, s);
    drawPanel(g, s);
    drawSocket(g, s);
    drawTag(g, s);
    g.restore();
  },
  nudge: 'Drop the CHK block in the socket under the cable. Then flip FIX.',
};

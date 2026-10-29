// Discovery beat 'pullnet', Cell Library (Phase 6 Spec, section 4): an inverter is a pull-up and a pull-down. The OUT
// platform hangs in a shaft between a VDD rail at the ceiling and a GND rail under the floor. A PMOS switch above it
// (drawn with a bubble) pulls OUT up to VDD, and an NMOS switch below it pulls OUT down to GND. The lever IN flips the
// input. IN=0 closes the PMOS, so the platform rises 420 px to the exit ledge at y 200 over 1.2 s. IN=1 closes the
// NMOS and the platform sinks back to the floor. A wall lamp shows OUT, which is always NOT IN. Standing on the exit
// ledge solves the beat. The lever's glyph is drawn by the sim where it stands, so it stays on the floor when the
// platform rises; the drone presses it once, while it stands on the platform at rest.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { easeInOut, FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { frames } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The OUT platform: 160 px wide, 20 px thick. Down, it rests on the floor; up, its top is at the ledge's top. */
const PLAT = { x: 700, w: 160, h: 20 };
const REST = F - PLAT.h;
/** The exit ledge's top, px. The platform's top at the top of its travel is level with it. */
const LEDGE_TOP = 200;
/** The platform's travel, px, and its ease: 1.2 s, 72 steps. */
const RISE = REST - LEDGE_TOP;
const MOVE = frames(1200);
/** The exit ledge runs from x 900 to the right wall. Its exit door stands in the wall above it, from the ceiling to the
 * ledge's top, so the door shuts the way on until the beat is solved. */
const LEDGE = r(900, LEDGE_TOP, W - 900, F - LEDGE_TOP);
const DOOR = r(1400, 0, 48, LEDGE_TOP);
/** The shaft's centre line, and the IN lever: on the platform's left corner, where E reaches it from the platform. */
const SX = PLAT.x + PLAT.w / 2;
const LEVER_X = PLAT.x + 24;
/** The rails: VDD across the ceiling of the shaft; GND is a ground mark on the floor, left of the NMOS. */
const VDD_Y = 40, GND_X = 520;
/** The rail spans, and the labels' right edge. */
const RAIL_X0 = 620, RAIL_X1 = 940;
/** The PMOS box above the shaft, and the NMOS box standing on the floor left of the shaft (the floor would hide it
 * under the platform). Both 44 px wide. */
const PMOS = { y: 70, h: 40 };
const NMOS = { x: 600, y: F - 40, h: 30 };
const BOX_W = 44;
/** The wall lamp: centre and radius, px. It hangs on the wall left of the shaft. */
const LAMP = { x: 620, y: 300, r: 12 };
/** The chamfer on the platform's corners, px. */
const CHAMFER = 6;

/** The platform's motion: `pos` is how far it has risen, px. It eases from `from` to `goal` over MOVE steps; `ph` steps are done. */
interface Lift { pos: number; from: number; goal: number; ph: number }

export interface PullnetState {
  /** The IN lever: 1 at the start (NMOS on, platform down), 0 after a press (PMOS on, platform up). */
  input: 0 | 1;
  lift: Lift;
  solved: boolean;
}

/** OUT is NOT IN: an inverter's output. */
export const outOf = (input: 0 | 1): 0 | 1 => (input === 1 ? 0 : 1);

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
  traces: [], stations: [], triggers: [], gates: [],
};

function pullnetRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-pullnet', name: 'The Inverter', role: 'discovery', mechanic: 'pullnet', w: W, h: H, music: 'silicon',
    modules: [],
    spawn: spawnAt(120, F),
    solids: [...shell(W, H), LEDGE],
    gates: [
      { id: 'out', kind: 'lift', rect: r(PLAT.x, REST, PLAT.w, PLAT.h) },
      { id: 'exit', kind: 'door', rect: DOOR },
    ],
    stations: [{ id: 'in', kind: 'lever', x: LEVER_X, y: F, label: 'IN' }],
    traces: [trace(0, 560, 300), trace(940, W, 300)],
    exit: { x: W - 40 },
  };
}

/** Whether the platform's next place would catch the drone: its centre is below the platform's current top and its rect
 * overlaps the next place. A drone standing on the platform has its centre above the top, so it rides instead. */
function crushes(d: Rect, here: number, next: number): boolean {
  return d.y + d.h / 2 > here && overlaps(d, { x: PLAT.x, y: next, w: PLAT.w, h: PLAT.h });
}

/** One step of the platform's ease. It holds while it would crush the drone. */
function moveLift(s: PullnetState, c: MechCtx) {
  const L = s.lift;
  if (L.ph >= MOVE) return;
  const next = L.from + (L.goal - L.from) * easeInOut((L.ph + 1) / MOVE);
  if (crushes(c.drone, REST - L.pos, REST - next)) return;
  L.ph += 1;
  L.pos = next;
  c.move('out', PLAT.x, REST - next);
}

/** The drone's feet are on the exit ledge's top. */
function standsOnLedge(c: MechCtx): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > LEDGE.x && cx < LEDGE.x + LEDGE.w && Math.abs(d.y + d.h - LEDGE.y) <= 2;
}

/** VDD: a plain line across the shaft, with its name to the left. GND: the three-bar ground mark, named below. */
function drawRails(g: CanvasRenderingContext2D) {
  g.strokeStyle = PAL.line;
  g.beginPath();
  g.moveTo(RAIL_X0, VDD_Y);
  g.lineTo(RAIL_X1, VDD_Y);
  const gy = NMOS.y + NMOS.h / 2;
  g.moveTo(GND_X, gy - 12);
  g.lineTo(GND_X, gy);
  for (const [w, dy] of [[18, 0], [12, 5], [6, 10]]) { g.moveTo(GND_X - w / 2, gy + dy); g.lineTo(GND_X + w / 2, gy + dy); }
  g.stroke();
  g.fillStyle = PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText('VDD', RAIL_X0 - 8, VDD_Y);
  g.textAlign = 'center';
  g.fillText('GND', GND_X, gy - 22);
}

/** A wire, glowing when its switch conducts and dashed when it does not. */
function wire(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, live: boolean) {
  g.beginPath();
  g.moveTo(x, y0);
  g.lineTo(x, y1);
  if (live) {
    g.strokeStyle = PAL.trace;
    g.shadowColor = PAL.trace;
    g.shadowBlur = LINE.traceGlow;
    g.stroke();
    g.shadowBlur = 0;
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([4, 5]);
    g.stroke();
    g.setLineDash([]);
  }
}

/** A switch centred on `cx`: a chamfered box with its name beside it, and a gate line from the left. A PMOS gate
 * has a bubble. */
function drawSwitch(g: CanvasRenderingContext2D, cx: number, y: number, h: number, name: string, bubble: boolean, on: boolean) {
  const x = cx - BOX_W / 2, mid = y + h / 2;
  g.strokeStyle = PAL.line;
  g.fillStyle = PAL.fill;
  g.beginPath();
  g.moveTo(x + CHAMFER, y);
  g.lineTo(x + BOX_W - CHAMFER, y);
  g.lineTo(x + BOX_W, y + CHAMFER);
  g.lineTo(x + BOX_W, y + h - CHAMFER);
  g.lineTo(x + BOX_W - CHAMFER, y + h);
  g.lineTo(x + CHAMFER, y + h);
  g.lineTo(x, y + h - CHAMFER);
  g.lineTo(x, y + CHAMFER);
  g.closePath();
  g.fill();
  g.stroke();
  // the gate comes in from the left; a PMOS inverts it, so its gate has a bubble on the box edge
  g.beginPath();
  g.moveTo(x - 18, mid);
  g.lineTo(bubble ? x - 8 : x, mid);
  g.stroke();
  if (bubble) {
    g.beginPath();
    g.arc(x - 4, mid, 4, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = on ? PAL.trace : PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  // the PMOS's name sits to its right; the NMOS's above it, clear of the wire to OUT
  if (bubble) g.fillText(name, x + BOX_W + 8, mid);
  else { g.textAlign = 'center'; g.fillText(name, cx, y - 10); }
}

/** The circuit: VDD to the PMOS, PMOS to the platform, platform to the NMOS, NMOS to GND. The PMOS conducts at IN=0,
 * the NMOS at IN=1, so exactly one path, rail to OUT, glows. The NMOS's wire runs up the shaft's left wall to the platform. */
function drawCircuit(g: CanvasRenderingContext2D, s: PullnetState) {
  const top = REST - s.lift.pos;
  const pOn = s.input === 0, nOn = s.input === 1;
  const ny = NMOS.y + NMOS.h / 2, wallX = PLAT.x - 8;
  wire(g, SX, VDD_Y, PMOS.y, pOn);
  wire(g, SX, PMOS.y + PMOS.h, top, pOn);
  link(g, [[NMOS.x + BOX_W / 2, ny], [wallX, ny], [wallX, top + PLAT.h / 2], [PLAT.x, top + PLAT.h / 2]], nOn);
  link(g, [[NMOS.x - BOX_W / 2, ny], [GND_X, ny]], nOn);
  drawSwitch(g, SX, PMOS.y, PMOS.h, 'PMOS', true, pOn);
  drawSwitch(g, NMOS.x, NMOS.y, NMOS.h, 'NMOS', false, nOn);
}

/** A wire through the points, glowing when live and dashed when not. */
function link(g: CanvasRenderingContext2D, pts: [number, number][], live: boolean) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (live) {
    g.strokeStyle = PAL.trace;
    g.shadowColor = PAL.trace;
    g.shadowBlur = LINE.traceGlow;
    g.stroke();
    g.shadowBlur = 0;
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([4, 5]);
    g.stroke();
    g.setLineDash([]);
  }
}

/** The OUT platform as a chamfered slab, its top edge glowing, and its name standing on it. */
function drawPlatform(g: CanvasRenderingContext2D, pos: number) {
  const x = PLAT.x, y = REST - pos, c = CHAMFER;
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + PLAT.w - c, y);
  g.lineTo(x + PLAT.w, y + c);
  g.lineTo(x + PLAT.w, y + PLAT.h);
  g.lineTo(x, y + PLAT.h);
  g.lineTo(x, y + c);
  g.closePath();
  g.fillStyle = PAL.fill;
  g.strokeStyle = PAL.line;
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + PLAT.w - c, y);
  g.strokeStyle = PAL.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = 10;
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // on top of the slab, right of the lever: the world draws the slab itself over this one
  g.fillText('OUT', PLAT.x + PLAT.w - 30, y - 12);
}

/** The wall lamp: lit when OUT is 1, with the reading written under it. */
function drawLamp(g: CanvasRenderingContext2D, input: 0 | 1) {
  const on = outOf(input) === 1;
  g.beginPath();
  g.arc(LAMP.x, LAMP.y, LAMP.r, 0, Math.PI * 2);
  if (on) {
    g.fillStyle = PAL.amber;
    g.shadowColor = PAL.amber;
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([3, 3]);
    g.stroke();
    g.setLineDash([]);
  }
  g.fillStyle = PAL.text;
  g.font = `11px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('OUT = NOT IN', LAMP.x, LAMP.y - 28);
  g.fillText(`OUT ${on ? 1 : 0}`, LAMP.x, LAMP.y + 28);
}

export const PULLNET: MechanicDef<PullnetState> = {
  kind: 'pullnet',
  room: pullnetRoom,
  init: () => ({ input: 1, lift: { pos: 0, from: 0, goal: 0, ph: MOVE }, solved: false }),
  step(s, c) {
    if (s.solved) return;
    if (c.used === 'in') {
      s.input = s.input === 1 ? 0 : 1;
      c.sfx('lever');
      c.sfx('liftHum');
      s.lift.from = s.lift.pos;
      s.lift.goal = s.input === 0 ? RISE : 0;
      s.lift.ph = 0;
    }
    moveLift(s, c);
    if (standsOnLedge(c)) {
      s.solved = true;
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    drawRails(g);
    drawCircuit(g, s);
    drawPlatform(g, s.lift.pos);
    drawLamp(g, s.input);
    g.restore();
  },
  nudge: 'Stand on the platform and press E at the lever. It lifts you.',
};

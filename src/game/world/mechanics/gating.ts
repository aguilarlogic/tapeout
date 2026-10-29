// Discovery beat, Sleep Domains (Phase 6 Spec, section 4): the room has two power domains. Domain B, the right half,
// runs a spinning fan that blocks the passage. Lever PWR switches B off, and the fan stops. Lever ISO clamps B's
// outputs. B's output drives the exit door: with B on it holds the door open. With B off and ISO off the output floats,
// and the door flickers at random, hitting whoever stands at it (10 damage and a knock back). Walking into the spinning
// fan hurts (15) and knocks back too. Solved past the door, with ISO on and PWR off.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { FONT, LINE, PAL, rgba } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { DAMAGE, frames } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The line between domain A (left) and domain B (right). */
const DIVIDE_X = 800;
/** The fan: a duct 40 px wide from the ceiling to the floor, spinning while B is on. */
const FAN = r(1000, 0, 40, F);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** B's output node, drawn as a dot on a wire that runs to the door. */
const OUT = { x: 1352, y: 540 };
/** The two levers on the floor, in domain A. */
const PWR_X = 300, ISO_X = 480;
/** While floating, the door picks open or shut every 0.25 s. */
const FLICK = frames(250);
/** Steps before the door (or the fan) may hit again. */
const COOL = frames(500);
/** The knock back: a push left at 300 px/s, and up at 150 px/s. */
const KNOCK_VX = 300, KNOCK_VY = 150;
/** The seed of the flicker's generator. */
const SEED = 12345;
/** Lines TAPEOUT says on the first fan hit, the first door hit and when the beat is done. */
const FAN_LINE = 'The fan hits hard. PWR stops it.';
const DOOR_LINE = 'A floating output slams the door. ISO holds it steady.';
const SOLVE_LINE = 'Isolation holds the output. With the fan off, the way is clear.';

export interface GatingState {
  /** B is on: its fan spins and its output drives the door open. */
  pwr: boolean;
  /** ISO is on: B's output is clamped, so it holds the door open even with B off. */
  iso: boolean;
  /** The door, as last driven. */
  open: boolean;
  /** Steps until a floating output picks open or shut again. */
  flick: number;
  /** Steps until the door or the fan may hit again. */
  cool: number;
  /** The drone touched the fan on the last step: a hit lands once per contact. */
  inFan: boolean;
  /** The fan's spin, in steps, for the draw. */
  turn: number;
  /** The flicker's generator state. */
  seed: number;
  toldFan: boolean;
  toldDoor: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
};

function gatingRoom(): StoryRoom {
  return {
    ...none,
    traces: [trace(0, 760, 420), trace(840, W, 420)],
    id: 'discovery-gating', name: 'Sleep Domains', role: 'discovery', mechanic: 'gating', w: W, h: H, music: 'silicon',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y)],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [
      { id: 'pwr', kind: 'lever', x: PWR_X, y: F, label: 'PWR' },
      { id: 'iso', kind: 'lever', x: ISO_X, y: F, label: 'ISO' },
    ],
    triggers: [],
    exit: { x: W - 40 },
  };
}

/** The next value of the flicker's generator (a 32-bit linear congruential step, so the beat repeats). */
const next = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

/** Whether the drone's box touches a rect, grown by `pad` px on every side. */
const touching = (c: MechCtx, rect: Rect, pad: number): boolean =>
  overlaps(c.drone, { x: rect.x - pad, y: rect.y - pad, w: rect.w + 2 * pad, h: rect.h + 2 * pad });

/** Pushes the drone back to the left and up, so the hit throws it off the fan or the door. */
function knock(c: MechCtx) {
  const d = c.drone;
  c.warp(d.x + d.w / 2, d.y + d.h / 2, -KNOCK_VX, -KNOCK_VY);
}

/** Drives the door to `open` with one call and one sfx per change. */
function drive(c: MechCtx, s: GatingState, open: boolean) {
  if (open === s.open) return;
  s.open = open;
  c.sfx('door');
  if (open) c.open('exit');
  else c.close('exit');
}

/** The floating output's flicker: a random pick every 0.25 s; shutting on a drone that stands at the door hits it. */
function flicker(s: GatingState, c: MechCtx) {
  s.flick -= 1;
  if (s.flick > 0) return;
  s.flick = FLICK;
  s.seed = next(s.seed);
  const shut = s.seed / 4294967296 < 0.5;
  drive(c, s, !shut);
  if (shut && s.cool === 0 && touching(c, DOOR, 6)) {
    s.cool = COOL;
    c.hurt(DAMAGE.touch);
    knock(c);
    if (!s.toldDoor) { s.toldDoor = true; c.say(DOOR_LINE); }
  }
}

/** The fan: a hit on each contact while it spins. */
function fan(s: GatingState, c: MechCtx) {
  if (!s.pwr) { s.inFan = false; return; }
  s.turn += 1;
  const hot = overlaps(c.drone, FAN);
  if (hot && !s.inFan) {
    c.hurt(DAMAGE.hazard);
    knock(c);
    if (!s.toldFan) { s.toldFan = true; c.say(FAN_LINE); }
  }
  s.inFan = hot;
}

/** The levers' words: what each does now, beside the lever so they never cross its handle. */
function drawLevers(g: CanvasRenderingContext2D, s: GatingState) {
  g.fillStyle = PAL.text;
  g.font = `13px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(`B ${s.pwr ? 'ON' : 'OFF'}`, PWR_X + 28, F - 30);
  g.fillText(`ISO ${s.iso ? 'ON' : 'OFF'}`, ISO_X + 28, F - 30);
}

/** The fan: a duct with spinning blades while B is on, dashed and still while it is off. */
function drawFan(g: CanvasRenderingContext2D, s: GatingState) {
  const on = s.pwr, x0 = FAN.x, x1 = FAN.x + FAN.w, cx = FAN.x + FAN.w / 2;
  g.strokeStyle = on ? PAL.hostile : PAL.idle;
  if (on) { g.shadowColor = PAL.hostile; g.shadowBlur = 12; }
  g.setLineDash(on ? [] : [6, 6]);
  g.beginPath();
  g.moveTo(x0, 0); g.lineTo(x0, F);
  g.moveTo(x1, 0); g.lineTo(x1, F);
  g.stroke();
  // the blades: slanted strokes that scroll down the duct while the fan spins
  const step = 110, off = on ? (s.turn * 4) % step : 0;
  for (let y = off - step; y < F; y += step) {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y + 36);
    g.stroke();
  }
  g.setLineDash([]);
  g.shadowBlur = 0;
  g.fillStyle = on ? PAL.hostile : PAL.idle;
  g.font = `13px ${FONT}`;
  // beside the fan, never over its blades
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText(on ? '! FAN ON' : 'FAN OFF', cx - 36, 40);
}

/** B's output: a wire to the door, dashed while it floats, with a dot that is filled while the output is driven or
 * clamped. ISO puts a bracket round the dot. */
function drawOutput(g: CanvasRenderingContext2D, s: GatingState) {
  const floating = !s.pwr && !s.iso;
  g.strokeStyle = floating ? PAL.amber : PAL.trace;
  g.setLineDash(floating ? [6, 6] : []);
  g.beginPath();
  g.moveTo(OUT.x, OUT.y);
  g.lineTo(DOOR.x, OUT.y);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.arc(OUT.x, OUT.y, 7, 0, Math.PI * 2);
  if (floating) { g.strokeStyle = PAL.amber; g.stroke(); } else { g.fillStyle = PAL.trace; g.fill(); }
  if (s.iso) {
    g.strokeStyle = PAL.ok;
    g.strokeRect(OUT.x - 22, OUT.y - 20, 44, 40);
  }
  g.fillStyle = PAL.text;
  g.font = `12px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(floating ? 'B OUT FLOATS' : s.iso ? 'B OUT CLAMPED' : 'B OUT DRIVEN', OUT.x, OUT.y + 36);
}

export const GATING: MechanicDef<GatingState> = {
  kind: 'gating',
  room: gatingRoom,
  init: () => ({
    pwr: true, iso: false, open: false, flick: 0, cool: 0, inFan: false, turn: 0, seed: SEED,
    toldFan: false, toldDoor: false, solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    if (c.used === 'pwr') { s.pwr = !s.pwr; c.sfx('lever'); }
    if (c.used === 'iso') { s.iso = !s.iso; c.sfx('lever'); }
    if (s.cool > 0) s.cool -= 1;
    // B's output: driven by B when B is on, clamped by ISO, and floating (flickering) when both are off
    if (s.pwr || s.iso) {
      s.flick = 0;
      drive(c, s, true);
    } else {
      flicker(s, c);
    }
    fan(s, c);
    // past the door with a steady output: ISO on and B off
    if (s.iso && !s.pwr && c.drone.x + c.drone.w / 2 > DOOR.x + DOOR.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    // domain B is dimmed while it is off
    if (!s.pwr) {
      g.fillStyle = rgba(PAL.bgDeep, 0.55);
      g.fillRect(DIVIDE_X, 0, W - DIVIDE_X, F);
    }
    g.strokeStyle = PAL.idle;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(DIVIDE_X, 0);
    g.lineTo(DIVIDE_X, F);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DOMAIN A', DIVIDE_X / 2, 40);
    g.fillText('DOMAIN B', DIVIDE_X + (W - DIVIDE_X) / 2, 80);
    drawFan(g, s);
    drawOutput(g, s);
    drawLevers(g, s);
    g.restore();
  },
  nudge: 'Try ISO first. Then PWR turns the fan off.',
};

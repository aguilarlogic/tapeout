// Discovery beat, The Model Room (Phase 7 Spec, section 4): a 640 px pit with one platform that slides across it, from
// the near floor's edge to the far floor's edge and back. A dashed HOLOGRAM shows where the MODEL says the platform is,
// 0.6 s ahead of the real one. The hologram is not solid. CALIBRATE pulls the hologram onto the real timing, and the
// readout goes from 0.6 s to 0.0 s. Riding the real platform across works with or without it. Jumping for the hologram
// before calibrating drops the drone into the pit, which puts it back at the start with no damage. Solved on the far
// ledge.
import { overlaps } from '../../physics/geom';
import { easeInOut, FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { frames, HZ } from '../../tuning';
import { floorY, r, shell, spawnAt } from '../templates/kit';
import type { MechanicDef } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The pit runs from the near floor's edge to the far floor's edge: 640 px. */
const PIT_X0 = 400, PIT_X1 = 1040;
/** The platform: 120 x 24, its top at PLAT_Y. Its near place touches the near floor, its far place the far floor. */
const PLAT_W = 120, PLAT_H = 24, PLAT_Y = 500;
const NEAR_X = 280, FAR_X = PIT_X1 - PLAT_W;
/** One way across takes 6 s, so one full swing takes 12 s. The platform eases at each end. */
const ONE_WAY = frames(6000);
/** The model's lead: the hologram is where the platform will be 0.6 s from now. */
const LEAD = frames(600);
/** A drone whose top passes FALL_Y is in the pit. */
const FALL_Y = F + 20;
/** The start: the drone stands on the near floor. */
const SPAWN = spawnAt(140, F);
/** The CALIBRATE lever on the near floor. */
const CALIB_X = 200;
/** The exit door at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
const DOOR_WALL = r(W - 200, 0, 48, F - 200);
/** The drone counts as on the far ledge past this x, grounded on the far floor. */
const FAR_LEDGE_X = PIT_X1 + 20;
/** Lines TAPEOUT says. */
const EARLY = 'The model was early.';
const MISS = 'The platform was not there. Try again.';
const CAL = 'The model is on the chip clock now.';
const SOLVE_LINE = 'A model is a prediction. Check it against the real chip.';

export interface ModelState {
  /** The step count, for the draw. */
  t: number;
  /** The real platform's left x. */
  x: number;
  /** The model's lead, in steps: 0.6 s until CALIBRATE, then 0. */
  lead: number;
  calibrated: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [],
  triggers: [],
};

function modelRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-model', name: 'The Model Room', role: 'discovery', mechanic: 'model', w: W, h: H, music: 'cluster',
    modules: [],
    spawn: SPAWN,
    solids: [
      ...shell(W, H, { floor: false }), r(0, F, PIT_X0, 80), r(PIT_X1, F, W - PIT_X1, 80), DOOR_WALL,
    ],
    gates: [
      { id: 'plat', kind: 'lift', rect: r(NEAR_X, PLAT_Y, PLAT_W, PLAT_H) },
      { id: 'exit', kind: 'door', rect: DOOR },
    ],
    stations: [{ id: 'calib', kind: 'lever', x: CALIB_X, y: F, label: 'CALIBRATE' }],
    props: [],
    exit: { x: W - 40 },
  };
}

/** The platform's left x after `t` steps: it eases across, then back, one way every ONE_WAY steps. */
function posAt(t: number): number {
  const ph = (t % (2 * ONE_WAY)) / ONE_WAY;
  const tri = ph <= 1 ? ph : 2 - ph;
  return NEAR_X + (FAR_X - NEAR_X) * easeInOut(tri);
}

export const MODEL: MechanicDef<ModelState> = {
  kind: 'model',
  room: modelRoom,
  init: () => ({ t: 0, x: NEAR_X, lead: LEAD, calibrated: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    s.t = c.t;
    if (c.used === 'calib' && !s.calibrated) {
      s.calibrated = true;
      s.lead = 0;
      c.sfx('lever');
      c.say(CAL);
    }
    // the real platform follows its timing; it waits while the drone is in its path (a rider stands on top, so it is not in it)
    const want = posAt(c.t);
    if (want !== s.x && !overlaps(c.drone, { x: want, y: PLAT_Y, w: PLAT_W, h: PLAT_H })) {
      s.x = want;
      c.move('plat', want, PLAT_Y);
    }
    // the pit: a drone that drops below the floor line is back at the start, with no damage
    if (c.drone.y > FALL_Y) {
      c.warp(SPAWN.x, SPAWN.y);
      c.say(s.calibrated ? MISS : EARLY);
    }
    // the far ledge: grounded on the far floor, past the pit
    const d = c.drone;
    if (c.grounded && d.x + d.w / 2 > FAR_LEDGE_X && Math.abs(d.y + d.h - F) <= 2) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    // the pit: a dashed hostile rule along the floor line, with its words, both above the floor line
    g.strokeStyle = PAL.hostile;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(PIT_X0, F - 2);
    g.lineTo(PIT_X1, F - 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = PAL.hostile;
    g.font = `13px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('! PIT: no floor. A fall sends you back.', (PIT_X0 + PIT_X1) / 2, F - 8);
    // the track the platform slides along, under it
    g.strokeStyle = PAL.idle;
    g.setLineDash([2, 6]);
    g.beginPath();
    g.moveTo(NEAR_X, PLAT_Y + PLAT_H + 14);
    g.lineTo(FAR_X + PLAT_W, PLAT_Y + PLAT_H + 14);
    g.stroke();
    g.setLineDash([]);
    // the hologram: where the model says the platform is, dashed and not solid
    const hx = posAt(s.t + s.lead);
    g.strokeStyle = PAL.neon;
    g.setLineDash([6, 4]);
    g.strokeRect(hx, PLAT_Y, PLAT_W, PLAT_H);
    g.setLineDash([]);
    g.fillStyle = PAL.neon;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('MODEL', hx + PLAT_W / 2, PLAT_Y - 26);
    // the real platform: solid, with its trace glow
    g.strokeStyle = PAL.trace;
    g.fillStyle = PAL.fill;
    g.shadowColor = PAL.trace;
    g.shadowBlur = LINE.traceGlow;
    g.fillRect(s.x, PLAT_Y, PLAT_W, PLAT_H);
    g.strokeRect(s.x, PLAT_Y, PLAT_W, PLAT_H);
    g.shadowBlur = 0;
    g.fillStyle = PAL.trace;
    g.fillText('SILICON', s.x + PLAT_W / 2, PLAT_Y - 6);
    // the readout: the lead in seconds, and whether CALIBRATE has been pulled
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(`model − silicon = ${(s.lead / HZ).toFixed(1)} s`, 40, 100);
    g.fillText(s.calibrated ? 'CALIBRATE: done' : 'CALIBRATE: not yet', 40, 122);
    g.restore();
  },
  nudge: 'Pull CALIBRATE, then ride the real platform across.',
};

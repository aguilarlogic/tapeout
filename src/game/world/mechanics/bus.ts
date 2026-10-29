// Discovery beat, The Bus, Datapath (Phase 4 Spec, section 4): two rails cross the room. E at a rail's start end clips
// the drone on; it rides at 600 px/s to the far end, lets go there and flies off at the same speed. Rail B runs only
// while the SEL lever reads 1. The beat is solved by standing on the exit ledge that rail B lands the drone on.
import { FONT, LINE, PAL, rgba } from '../../render/palette';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { HZ } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);

/** A rail: a straight line at height y from x0 (its start end, where the lever station `id` sits) to x1 (far end). */
export interface Rail {
  id: string;
  /** The letter tagged at its start end. */
  tag: string;
  y: number;
  x0: number;
  x1: number;
}
/** Rail A: from the floor step at x 200 to the landing ledge at x 760. */
const RAIL_A: Rail = { id: 'railA', tag: 'A', y: 520, x0: 200, x1: 760 };
/** Rail B: from the landing ledge at x 820 to x 1340, over the exit ledge. */
const RAIL_B: Rail = { id: 'railB', tag: 'B', y: 360, x0: 820, x1: 1340 };
/** Ride speed in px/s; a rider moves this far each step. */
const SPEED = 600;
/** The drone's centre hangs this far below the rail while it rides. */
const RIDE_DROP = 30;
/** The drone lets go this far above the rail line, so it clears the edge of the ledge it flies onto. */
const RELEASE_UP = 10;
/** The floor step under rail A's start: 60 px high, its top at y 580. */
const STEP = r(160, 580, 100, 60);
/** The landing ledge at rail A's far end, with rail B's start and the SEL lever on its top (y 580). */
const LANDING = r(760, 580, 240, 60);
/** The exit ledge rail B lands on: a column beside the exit door, its top at y 380. */
const EXIT_LEDGE = r(1340, 380, 60, 260);
/** The exit door sits on the exit ledge, so the way out is along the top; the wall is solid above and below it. */
const DOOR = r(W - 200, EXIT_LEDGE.y - 200, 48, 200);
/** Rail A lets go at walking pace, so the drone lands on the landing ledge instead of sliding off it. */
const LAND_SPEED = 200;
/** The SEL lever's x on the landing ledge (its feet sit on the ledge top). */
const SEL_X = 940;
/** The SEL lamp's centre, a little above the lever. */
const SEL_LAMP = { x: SEL_X, y: 536 };
/** Steps the SEL lamp stays dim after a press on rail B with SEL at 0 (0.2 s). */
const FLASH = 12;
/** The rail's two lines sit this many px above and below the rail line. */
const RAIL_GAP = 5;
/** Gap in px between the dots that flow along a live rail. */
const DOT_GAP = 40;
/** Radius in px of each flowing dot. */
const DOT_R = 2.5;
/** SEL lamp radius in px. */
const LAMP_R = 6;
/** Base radius in px of the clip glow at the rail under the drone; it pulses out by up to 4 px. */
const CLIP_R = 10;

export interface BusState {
  /** The SEL lever: 0 leaves rail B dead, 1 lets it run. */
  sel: number;
  /** Steps the SEL lamp still shows its dim flash. */
  flash: number;
  /** The rail the drone is clipped to and the x it has reached on it; null when it is free. */
  ride: { rail: Rail; x: number } | null;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
  traces: [], stations: [], triggers: [],
};

function room(): StoryRoom {
  return {
    ...none,
    id: 'discovery-bus', name: 'The Bus', role: 'discovery', mechanic: 'bus', w: W, h: H, music: 'core', modules: [],
    // the drone starts at the left wall, clear of the step
    spawn: spawnAt(60, F),
    solids: [...shell(W, H), STEP, LANDING, EXIT_LEDGE, r(W - 200, 0, 48, DOOR.y), r(W - 200, EXIT_LEDGE.y, 48, F - EXIT_LEDGE.y)],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [
      { id: RAIL_A.id, kind: 'lever', x: RAIL_A.x0, y: STEP.y, label: 'RAIL A' },
      { id: RAIL_B.id, kind: 'lever', x: RAIL_B.x0, y: LANDING.y, label: 'RAIL B' },
      { id: 'sel', kind: 'lever', x: SEL_X, y: LANDING.y, label: 'SEL' },
    ],
    traces: [trace(0, 600, 200), trace(1000, W, 200)],
    exit: { x: W - 40 },
  };
}

/** The drone stands on a ledge: grounded, within its width, feet within 2 px of its top. */
function standing(c: MechCtx, ledge: Rect): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > ledge.x && cx < ledge.x + ledge.w && Math.abs(d.y + d.h - ledge.y) <= 2;
}

/** E at a rail's start end: the drone clips on at x0, riding its centre 30 px below the rail. */
function clip(s: BusState, c: MechCtx, rail: Rail) {
  s.ride = { rail, x: rail.x0 };
  c.warp(rail.x0, rail.y + RIDE_DROP, SPEED, 0);
}

export const BUS: MechanicDef<BusState> = {
  kind: 'bus',
  room,
  init: () => ({ sel: 0, flash: 0, ride: null, solved: false }),
  step(s, c) {
    if (s.solved) return;
    if (s.ride) {
      // 600 px/s is 10 px a step; at the far end the drone lets go and flies off at the same speed
      const { rail } = s.ride;
      s.ride.x = Math.min(rail.x1, s.ride.x + SPEED / HZ);
      if (s.ride.x < rail.x1) {
        c.warp(s.ride.x, rail.y + RIDE_DROP, SPEED, 0);
      } else {
        c.warp(rail.x1, rail.y - RELEASE_UP, rail === RAIL_B ? SPEED : LAND_SPEED, 0);
        s.ride = null;
      }
      return;
    }
    if (standing(c, EXIT_LEDGE)) {
      s.solved = true;
      c.say('One bus, many lines. Select picks the one that drives.');
      c.solve();
      return;
    }
    if (s.flash > 0) s.flash -= 1;
    if (c.used === 'sel') {
      s.sel = s.sel === 0 ? 1 : 0;
      c.sfx('lever');
    } else if (c.used === RAIL_A.id) {
      clip(s, c, RAIL_A);
    } else if (c.used === RAIL_B.id) {
      if (s.sel === 1) {
        clip(s, c, RAIL_B);
      } else {
        s.flash = FLASH;
        c.sfx('lever');
      }
    }
  },
  draw(g, s, t) {
    g.save();
    g.lineWidth = LINE.trace;
    drawRail(g, RAIL_A, true, t);
    drawRail(g, RAIL_B, s.sel === 1, t);
    drawSelLamp(g, s);
    if (s.ride) drawClip(g, s.ride, t);
    g.restore();
  },
  nudge: 'Ride rail A, then set SEL to 1 for rail B.',
};

/** A rail as two lines and a tag at its start. A live rail (rail A always, rail B once SEL reads 1) carries dots that
 * flow from its start toward its far end, one px a step. */
function drawRail(g: CanvasRenderingContext2D, rail: Rail, live: boolean, t: number) {
  g.strokeStyle = rgba(PAL.trace, live ? 0.8 : 0.3);
  g.shadowColor = PAL.trace;
  g.shadowBlur = live ? LINE.traceGlow : 0;
  for (const dy of [-RAIL_GAP, RAIL_GAP]) {
    g.beginPath();
    g.moveTo(rail.x0, rail.y + dy);
    g.lineTo(rail.x1, rail.y + dy);
    g.stroke();
  }
  g.shadowBlur = 0;
  if (live) {
    g.fillStyle = PAL.trace;
    for (let x = rail.x0 + (t % DOT_GAP); x < rail.x1; x += DOT_GAP) {
      g.beginPath();
      g.arc(x, rail.y, DOT_R, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = live ? PAL.text : PAL.idle;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(rail.tag, rail.x0, rail.y - 24);
}

/** The SEL lamp: amber and glowing at 1; a dim amber flash while rail B refuses; a dashed ring otherwise. */
function drawSelLamp(g: CanvasRenderingContext2D, s: BusState) {
  g.beginPath();
  g.arc(SEL_LAMP.x, SEL_LAMP.y, LAMP_R, 0, Math.PI * 2);
  if (s.sel === 1) {
    g.fillStyle = PAL.amber;
    g.shadowColor = PAL.amber;
    g.shadowBlur = 12; // the lamp's glow, in px
    g.fill();
    g.shadowBlur = 0;
  } else if (s.flash > 0) {
    g.fillStyle = rgba(PAL.amber, 0.3);
    g.fill();
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([3, 3]);
    g.stroke();
    g.setLineDash([]);
  }
}

/** The clip glow: a bright ring at the rail under the drone, pulsing a beat every 16 steps (0.4 rad a step). */
function drawClip(g: CanvasRenderingContext2D, ride: NonNullable<BusState['ride']>, t: number) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.4);
  g.lineWidth = LINE.drone;
  g.strokeStyle = PAL.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = LINE.droneGlow;
  g.beginPath();
  g.arc(ride.x, ride.rail.y, CLIP_R + 4 * pulse, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
}

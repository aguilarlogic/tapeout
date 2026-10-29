// Discovery beat 2, The Inverted Hall (Phase 3 Spec, section 6): door A opens under weight on plate A, while door B
// opens only while plate B is empty. A crate on A holds that door; the drone jumps over plate B and passes door B.
// Solved when the drone's centre passes x 1560.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 2000, H = 720, F = floorY(H);
const PLATE_A = r(600, F - 8, 100, 8), PLATE_B = r(1200, F - 8, 100, 8);
const DOOR_A_X = 900, DOOR_B_X = 1500;
const PASS_X = 1560;
const CRATE_MASS = 3, CRATE_X = 400;

export interface InvertedState {
  doorA: boolean;
  doorB: boolean;
  plateA: boolean;
  plateB: boolean;
  solved: boolean;
}

const none = { oneWay: [], hazards: [], plates: [], enemies: [], floaters: [], spikes: [], emitters: [], traces: [], stations: [], triggers: [], gates: [] };

/** A door column: the door itself (floor to 200 px up) and the solid wall above it. */
const doorSolid = (x: number) => r(x, 0, 48, F - 200);

function invertedRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-inverted', name: 'The Inverted Hall', role: 'discovery', mechanic: 'inverted', w: W, h: H, music: 'keeper', modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), doorSolid(DOOR_A_X), doorSolid(DOOR_B_X), doorSolid(W - 200)],
    gates: [
      { id: 'doorA', kind: 'door', rect: r(DOOR_A_X, F - 200, 48, 200) },
      { id: 'doorB', kind: 'door', rect: r(DOOR_B_X, F - 200, 48, 200) },
      { id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) },
    ],
    props: [{ kind: 'crate', mass: CRATE_MASS, x: CRATE_X, y: F - crateSide(CRATE_MASS) / 2 - 1 }],
    signs: [{ x: 650, y: 560, text: 'PLATE A' }, { x: 1250, y: 560, text: 'PLATE B' }],
    traces: [trace(0, 1400, 420, 30), trace(1600, W, 380)],
    exit: { x: W - 40 },
  };
}

/** A plate reads pressed under the drone's feet or a loose crate; its zone reaches 6 px above the plate. */
function pressed(p: Rect, c: MechCtx): boolean {
  const zone = { x: p.x, y: p.y - 6, w: p.w, h: p.h + 6 };
  const d = c.drone;
  const feet = { x: d.x, y: d.y + d.h - 4, w: d.w, h: 8 };
  return overlaps(feet, zone) || c.props.some((b) => overlaps(b, zone));
}

/** Drives a door to `open` with one call and one sfx per change; returns its new state. */
function drive(c: MechCtx, id: string, open: boolean, was: boolean): boolean {
  if (open === was) return was;
  c.sfx('door');
  if (open) c.open(id);
  else c.close(id);
  return open;
}

function plate(g: CanvasRenderingContext2D, p: Rect, on: boolean) {
  if (on) {
    g.fillStyle = PAL.amber;
    g.shadowColor = PAL.amber;
    g.shadowBlur = 12;
    g.fillRect(p.x, p.y, p.w, p.h);
    g.shadowBlur = 0;
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([6, 6]);
    g.strokeRect(p.x, p.y, p.w, p.h);
    g.setLineDash([]);
  }
}

export const INVERTED: MechanicDef<InvertedState> = {
  kind: 'inverted',
  room: invertedRoom,
  init: () => ({ doorA: false, doorB: false, plateA: false, plateB: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    const a = pressed(PLATE_A, c), b = pressed(PLATE_B, c);
    if (a !== s.plateA || b !== s.plateB) c.sfx('plate');
    s.plateA = a;
    s.plateB = b;
    s.doorA = drive(c, 'doorA', s.plateA, s.doorA);
    s.doorB = drive(c, 'doorB', !s.plateB, s.doorB);
    if (c.drone.x + c.drone.w / 2 > PASS_X) {
      s.solved = true;
      c.say('Weight holds one door. None holds the other.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    plate(g, PLATE_A, s.plateA);
    plate(g, PLATE_B, s.plateB);
    g.restore();
  },
  nudge: 'One door wants weight. The other wants none.',
};

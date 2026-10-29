// Discovery beat 3, The Lift Select (Phase 3 Spec, section 6): one lever picks which lift has power. A powered lift
// rises while the drone stands on it and sinks back when it is empty. Only the right lift's top reaches the exit
// ledge; the left lift tops out under a low ceiling and leads nowhere.
import { easeInOut, LINE, PAL } from '../../render/palette';
import type { Rect } from '../../level/room';
import type { StoryRoom } from '../../story/types';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1800, H = 720, F = floorY(H);
const LIFT_IDS = ['liftL', 'liftR'];
const LIFT_X = [700, 1100], LIFT_W = 160, LIFT_H = 24;
/** A lift at rest sits on the floor; fully risen, its top is 360 px above the floor. */
const REST = F - LIFT_H, UP = F - 360;
/** A lift travels its whole way in this many steps (rate 1/144 of the travel per step, eased). */
const TRAVEL_STEPS = 144;
const LEDGE = r(1300, UP, 500, 40);
/** The left lift's low ceiling: its underside 56 px above the top of a risen lift, so the drone fits under it. */
const CEILING = r(640, 200, 300, 24);

export interface SelectState {
  /** The powered lift: 0 left, 1 right. */
  sel: number;
  /** Each lift's progress up its travel, 0 at rest to 1 risen. */
  rise: number[];
  solved: boolean;
}

const none = { oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [], stations: [], triggers: [] };

function selectRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-select', name: 'The Lift Select', role: 'discovery', mechanic: 'select', w: W, h: H, music: 'keeper', modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), CEILING, LEDGE, r(W - 200, 0, 48, F - 200)],
    gates: [
      { id: 'liftL', kind: 'lift', rect: r(LIFT_X[0], REST, LIFT_W, LIFT_H) },
      { id: 'liftR', kind: 'lift', rect: r(LIFT_X[1], REST, LIFT_W, LIFT_H) },
      { id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) },
    ],
    stations: [{ id: 'sel', kind: 'lever', x: 400, y: F, label: 'SELECT LIFT' }],
    traces: [trace(0, 600, 420), trace(1260, W, 420)],
    exit: { x: W - 40 },
  };
}

/** The lift's top at progress p. */
const topAt = (p: number) => REST + (UP - REST) * easeInOut(p);

/** The drone stands on a lift: grounded, within its width, feet on its top. */
function standing(c: MechCtx, lift: Rect): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > lift.x && cx < lift.x + lift.w && Math.abs(d.y + d.h - lift.y) <= 2;
}

export const SELECT: MechanicDef<SelectState> = {
  kind: 'select',
  room: selectRoom,
  init: () => ({ sel: 0, rise: [0, 0], solved: false }),
  step(s, c) {
    if (s.solved) return;
    if (c.used === 'sel') {
      s.sel = s.sel === 0 ? 1 : 0;
      c.sfx('lever');
    }
    let moving = false;
    LIFT_IDS.forEach((id, i) => {
      const p = s.rise[i];
      // a powered lift with the drone on it rises; an empty lift sinks; a powered-off lift holds its drone
      const want = standing(c, c.rect(id)) ? (s.sel === i ? 1 : p) : 0;
      const next = want > p ? Math.min(want, p + 1 / TRAVEL_STEPS) : Math.max(want, p - 1 / TRAVEL_STEPS);
      if (next === p) return;
      s.rise[i] = next;
      moving = true;
      c.move(id, LIFT_X[i], topAt(next));
    });
    if (moving && c.t % 20 === 0) c.sfx('liftHum');
    const d = c.drone, cx = d.x + d.w / 2;
    if (c.grounded && cx > LEDGE.x && cx < LEDGE.x + LEDGE.w && Math.abs(d.y + d.h - LEDGE.y) <= 2) {
      s.solved = true;
      c.say('The right lift. Up to the ledge.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    LIFT_IDS.forEach((_, i) => {
      const x = LIFT_X[i] + 14, y = topAt(s.rise[i]) + LIFT_H / 2;
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      if (s.sel === i) {
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
    });
    g.restore();
  },
  nudge: 'The lever picks a lift. Only one goes where you need.',
};

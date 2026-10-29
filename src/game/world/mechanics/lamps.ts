// Discovery beat 1, The Lamp Board (Phase 3 Spec, section 6): four lamps worth 8, 4, 2 and 1 hang under a plaque that
// says 5. Shooting a lamp or pressing E at its lever toggles it; the reading 0, 1, 0, 1 held for 24 steps solves it.
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom, Station } from '../../story/types';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
const IDS = ['lamp0', 'lamp1', 'lamp2', 'lamp3'];
const VALUE = [8, 4, 2, 1];
/** Lamp centres, left to right, hanging at Y. */
const X = [900, 960, 1020, 1080], Y = 260, RADIUS = 18;
const PLAQUE = { x: 990, y: 150 };
/** The reading that solves the beat: 0, 1, 0, 1 (5). */
const TARGET = [false, true, false, true];
/** Steps the reading must hold without a break. */
const HOLD = 24;

export interface LampsState { lit: boolean[]; hold: number; solved: boolean }

const none = { oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [], stations: [], triggers: [], gates: [] };

function lampRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-lamps', name: 'The Lamp Board', role: 'discovery', mechanic: 'lamps', w: W, h: H, music: 'keeper', modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, F - 200)],
    gates: [{ id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) }],
    stations: IDS.map((id, i): Station => ({ id, kind: 'lever', x: X[i], y: F, label: `LAMP ${VALUE[i]}` })),
    targets: IDS.map((id, i) => ({ id, rect: r(X[i] - 20, Y - 20, 40, 40) })),
    traces: [trace(0, 760, 420), trace(1120, W, 420)],
    exit: { x: W - 40 },
  };
}

/** A shot or an E press flips the lamp with that id. */
function toggle(s: LampsState, c: MechCtx, id: string) {
  const i = IDS.indexOf(id);
  if (i < 0) return;
  s.lit[i] = !s.lit[i];
  c.sfx('rowTick');
}

export const LAMPS: MechanicDef<LampsState> = {
  kind: 'lamps',
  room: lampRoom,
  init: () => ({ lit: [false, false, false, false], hold: 0, solved: false }),
  step(s, c) {
    if (s.solved) return;
    for (const id of c.hit) toggle(s, c, id);
    if (c.used) toggle(s, c, c.used);
    s.hold = s.lit.every((on, i) => on === TARGET[i]) ? s.hold + 1 : 0;
    if (s.hold >= HOLD) {
      s.solved = true;
      c.say('Five. Read the lamps as a number.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(PLAQUE.x - 40, PLAQUE.y - 22, 80, 44);
    g.strokeRect(PLAQUE.x - 40, PLAQUE.y - 22, 80, 44);
    g.fillStyle = PAL.text;
    g.font = `22px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('5', PLAQUE.x, PLAQUE.y);
    X.forEach((x, i) => {
      g.beginPath();
      g.arc(x, Y, RADIUS, 0, Math.PI * 2);
      if (s.lit[i]) {
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
    });
    g.restore();
  },
  nudge: 'The plaque says 5. Lamps are worth 8, 4, 2 and 1.',
};

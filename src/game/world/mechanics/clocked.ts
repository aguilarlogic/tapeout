// Discovery beat 4, The Clock Pit (Phase 3 Spec, section 6): a pit with four platforms that step once on each rising
// edge of a blinking clock lamp (every 60 steps, 120 on Story). Each move is eased over 12 steps. A platform never
// moves into the drone: it waits while the drone is under it and its next place would catch the drone. Solved when
// the drone stands on the far floor past x 1520.
import type { Rect } from '../../level/room';
import { overlaps } from '../../physics/geom';
import { easeInOut, FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 2000, H = 720, F = floorY(H);
const PIT_X = 500, PIT_X2 = 1500;
const PLAT_W = 120, PLAT_H = 24;
/** The two places a platform moves between: its low place is 40 px above the floor, its high place 80 px higher. */
const LOW = F - 40, HIGH = F - 120;
/** Steps a platform takes to move between its two places. */
const MOVE = 12;
const PLATS = [
  { id: 'p0', x: 560, start: LOW },
  { id: 'p1', x: 800, start: HIGH },
  { id: 'p2', x: 1040, start: LOW },
  { id: 'p3', x: 1280, start: HIGH },
];
const CLOCK = { x: 1000, y: 160, r: 22 };
const FAR_X = 1520;

/** One platform: it moves from `from` to `to` over MOVE steps, `ph` steps in (MOVE when at rest). */
interface Platform { from: number; to: number; ph: number }

export interface ClockedState { lit: boolean; plats: Platform[]; solved: boolean }

const none = { oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [], stations: [], triggers: [] };

function clockedRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-clocked', name: 'The Clock Pit', role: 'discovery', mechanic: 'clocked', w: W, h: H, music: 'keeper', modules: [],
    spawn: spawnAt(140, F),
    solids: [
      ...shell(W, H, { floor: false }),
      r(0, F, PIT_X, 80), r(PIT_X2, F, W - PIT_X2, 80),
      r(W - 200, 0, 48, F - 200),
    ],
    gates: [
      ...PLATS.map((p) => ({ id: p.id, kind: 'lift' as const, rect: r(p.x, p.start, PLAT_W, PLAT_H) })),
      { id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) },
    ],
    traces: [trace(0, PIT_X, 420), trace(PIT_X2, W, 420)],
    exit: { x: W - 40 },
  };
}

/** The platform's top at step ph of its move. */
const topAt = (p: Platform, ph: number) => p.from + (p.to - p.from) * easeInOut(ph / MOVE);

/** The drone is under the platform (its centre below the top) and the platform's next top would reach it. */
function crushes(d: Rect, x: number, here: number, next: number): boolean {
  return d.y + d.h / 2 > here && overlaps(d, { x, y: next, w: PLAT_W, h: PLAT_H });
}

/** One step of a platform's move: it moves unless its next place would catch the drone under it (then it skips the step). */
function advance(p: Platform, x: number, c: MechCtx, id: string) {
  if (p.ph === MOVE) return;
  const here = topAt(p, p.ph), next = topAt(p, p.ph + 1);
  if (crushes(c.drone, x, here, next)) return;
  p.ph += 1;
  c.move(id, x, next);
}

/** A rising edge sends each platform at rest to its other place. An edge that finds a platform still moving is dropped. */
function edge(p: Platform) {
  if (p.ph !== MOVE) return;
  p.from = p.to;
  p.to = p.to === LOW ? HIGH : LOW;
  p.ph = 0;
}

export const CLOCKED: MechanicDef<ClockedState> = {
  kind: 'clocked',
  room: clockedRoom,
  init: () => ({ lit: false, plats: PLATS.map((p) => ({ from: p.start, to: p.start, ph: MOVE })), solved: false }),
  step(s, c) {
    if (s.solved) return;
    const period = c.story ? 120 : 60;
    const lit = c.t % period >= period / 2;
    if (lit && !s.lit) {
      c.sfx('rowTick');
      s.plats.forEach(edge);
    }
    s.lit = lit;
    PLATS.forEach((spec, i) => advance(s.plats[i], spec.x, c, spec.id));
    const d = c.drone;
    if (c.grounded && d.x + d.w / 2 > FAR_X && Math.abs(d.y + d.h - F) <= 2) {
      s.solved = true;
      c.say('Every flash is a step.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    g.beginPath();
    g.arc(CLOCK.x, CLOCK.y, CLOCK.r, 0, Math.PI * 2);
    if (s.lit) {
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
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('CLOCK', CLOCK.x, CLOCK.y + CLOCK.r + 18);
    g.restore();
  },
  nudge: 'They only move when the lamp flashes. Count the flashes.',
};

// Phase 8 Spec, section 4: the Hiring Hall's office room. A 2560 x 720 room with a flat floor, four low desks as
// stepping ledges and eight panel spots along the floor (OFFICE_PANELS, drawn by render/hall.ts). No enemies, no
// props and no locked door: the doorway in the right wall is open, so the drone walks on to the next office.
import type { Rect } from '../../level/room';
import type { Shell } from '../types';
import { TILE } from '../../tuning';
import { floorY, r, shell, spawnAt } from './kit';
import { assemble } from './traverse';

const W = 2560, H = 720, F = floorY(H);
/** A desk is 160 x 24 px, and its top is 90 px above the floor: one beginner jump (kit.ts REACH.rise is 150). */
const DESK_W = 160, DESK_H = 24, DESK_RISE = 90;

/** The eight panel spots: centres evenly spaced from x 280 to x 2280, rounded to whole px. */
export const OFFICE_PANELS: readonly number[] = Array.from({ length: 8 }, (_, i) => Math.round(280 + (i * 2000) / 7));

/** The desks sit in the gaps between panel pairs (1-2, 3-4, 5-6, 7-8), centred on each gap: no desk meets a panel. */
const DESK_GAPS = [0, 2, 4, 6];

/** The office room: the shell, four desks on the floor (each one a foothold between two floor pieces), the drone's
 * spawn on the left and an exit just past the open doorway in the right wall. */
export function offices(): Shell {
  const desks: Rect[] = DESK_GAPS.map((i) => {
    const mid = (OFFICE_PANELS[i] + OFFICE_PANELS[i + 1]) / 2;
    return r(Math.round(mid - DESK_W / 2), F - DESK_RISE, DESK_W, DESK_H);
  });
  // the floor between the desks, so each desk is reached from the floor beside it
  const floors: Rect[] = [];
  let x = 0;
  for (const d of desks) {
    floors.push(r(x, F, d.x - x, 80));
    x = d.x + d.w;
  }
  floors.push(r(x, F, W - x, 80));
  const footholds = floors.flatMap((f, i) => (i < desks.length ? [f, desks[i]] : [f]));
  return assemble({
    w: W, h: H, spawn: spawnAt(140, F), exit: { x: W + TILE },
    solids: [...shell(W, H), ...desks],
    footholds,
    anchors: { enemies: [], props: [] },
  });
}

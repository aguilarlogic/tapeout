// Phase 7 Spec, section 7: the ending room. A closed 1280 x 720 room with a floor and no way out: the ending plays over
// it (story/ending.ts) and its last card takes the drone back to the Loft.
import type { Shell } from '../types';
import { floorY, r, shell } from './kit';
import { assemble } from './traverse';

export function ending(): Shell {
  const w = 1280, h = 720, F = floorY(h);
  return assemble({
    w, h, spawn: { x: 640, y: F - 24 }, exit: { x: w + 400 },
    solids: [...shell(w, h, { door: 0 }), r(w - 48, 0, 48, F)],
    footholds: [r(0, F, w, 80)],
    anchors: { enemies: [], props: [] },
  });
}

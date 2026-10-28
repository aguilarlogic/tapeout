// Phase 3 Spec, section 4: the boss arena. A closed room 1920 px wide with the boss in the middle, three tiers of solid
// platforms on each side for the instrument nodes, and the exit through the floor's doorway behind a gate.
import type { Vec } from '../../physics/geom';
import type { Template } from '../types';
import { floorY, r, shell, trace } from './kit';
import { assemble } from './traverse';

const NODE_MAX = 12, NODE_DEFAULT = 4;
/** Width of each tier platform. */
const TIER_W = 140;

export const arena: Template = (_rng, opts) => {
  const w = 1920, h = 900, F = floorY(h);
  const left = [240, 90, 240];
  const right = left.map((x) => w - x - TIER_W);
  const tiers = [F - 140, F - 280, F - 420];
  const top = F - 560;
  const n = Math.min(NODE_MAX, Math.max(1, opts.nodes ?? NODE_DEFAULT));

  const floor = r(0, F, w, 80);
  const rightTiers = tiers.map((y, i) => r(right[i], y, TIER_W, 20));
  const platforms = [
    ...tiers.map((y, i) => r(left[i], y, TIER_W, 20)),
    ...rightTiers,
    ...(n > 10 ? [r(left[0], top, TIER_W, 20), r(right[0], top, TIER_W, 20)] : []),
  ];

  // Node feet: the floor first, then the tiers alternating left and right, then the top platforms.
  const feet: Vec[] = [
    { x: 150, y: F }, { x: 1770, y: F }, { x: 560, y: F }, { x: 1360, y: F },
    ...tiers.flatMap((y, i) => [{ x: left[i] + TIER_W / 2, y }, { x: right[i] + TIER_W / 2, y }]),
    { x: left[0] + TIER_W / 2, y: top }, { x: right[0] + TIER_W / 2, y: top },
  ];

  return assemble({
    w, h, spawn: { x: 240, y: F - 24 }, exit: { x: w - 40 },
    solids: [
      ...shell(w, h, { door: 220 }),
      r(1872, 0, 48, F - 220), // the wall above the gate
      ...platforms,
    ],
    footholds: [floor, ...rightTiers, floor],
    anchors: {
      enemies: [],
      props: [],
      nodes: feet.slice(0, n),
      boss: r(960 - 260, 370 - 130, 520, 260),
      debug: { x: 960, y: F },
      gate: r(1872, F - 220, 48, 220),
    },
    traces: [trace(0, 700, 700), trace(1220, w, 700), trace(0, w, 90, -30)],
  });
};

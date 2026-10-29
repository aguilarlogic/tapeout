// Every boss body and attack by id (Phase 3, 4 and 6 Specs, section 6). The tables live here, apart
// from the act files, so later acts' drawers and attacks can reuse act 1's helpers without an import cycle.
import { bolts, chain, drop, freeze, grid, mirror, segments } from './attacks';
import { push, relay, split, stage } from './attacks-act2';
import { lash, paths, slam, spikes } from './attacks-act3a';
import { congest, eye, rush, shift } from './attacks-act3b';
import { chain as chainBody, digit, gate, lamps, twin, wheel } from './bodies';
import { clocks, datapath, stack, worm } from './bodies-act2';
import { cell, polygon, serpent, titan } from './bodies-act3a';
import { knot, sleeper, snake, transceivers } from './bodies-act3b';
import type { Attack, AttackId, BodyDrawer, BodyKind } from './types';

/** Every attack by id. The Sim runs a boss's attacks from this table, one at a time. */
export const ATTACKS: Record<AttackId, Attack<unknown>> = {
  bolts, drop, grid, chain, freeze, segments, mirror, push, relay, split, stage,
  slam, lash, paths, spikes, congest, rush, shift, eye,
};

/** Every body drawer by kind. */
export const BODIES: Record<BodyKind, BodyDrawer> = {
  lamps, gate, chain: chainBody, wheel, digit, twin, stack, datapath, clocks, worm,
  cell, serpent, titan, polygon, knot, sleeper, snake, transceivers,
};

// Every boss body and attack by id (Phase 3, 4, 6 and 7 Specs, section 6; Phase 8 Spec, section 5). The tables live here, apart
// from the act files, so later acts' drawers and attacks can reuse act 1's helpers without an import cycle.
import { bolts, chain, drop, freeze, grid, mirror, segments } from './attacks';
import { push, relay, split, stage } from './attacks-act2';
import { lash, paths, slam, spikes } from './attacks-act3a';
import { congest, eye, rush, shift } from './attacks-act3b';
import { agents, assume, holes, walls } from './attacks-act4a';
import { evict, jam, predict, reorder } from './attacks-act4b';
import { flips, noise, ring as ringAttack } from './attacks-wings-a';
import { cracks, dies, hang } from './attacks-wings-b';
import { leak, lockdown, probes } from './attacks-wings-c';
import { flare, phase, zap } from './attacks-wings-d';
import { address, bands, mismatch } from './attacks-wings-e';
import { chain as chainBody, digit, gate, lamps, twin, wheel } from './bodies';
import { clocks, datapath, stack, worm } from './bodies-act2';
import { cell, polygon, serpent, titan } from './bodies-act3a';
import { knot, sleeper, snake, transceivers } from './bodies-act3b';
import { engine, ring, scoreboard, trio } from './bodies-act4a';
import { hologram, mesh, tower, window as windowBody } from './bodies-act4b';
import { antenna, buck, memarray } from './bodies-wings-a';
import { packageBody, server, wafer } from './bodies-wings-b';
import { ecu, tester, vault } from './bodies-wings-c';
import { golem, optical, qubit } from './bodies-wings-d';
import { custboard, mute, sensor } from './bodies-wings-e';
import type { Attack, AttackId, BodyDrawer, BodyKind } from './types';

/** Every attack by id. The Sim runs a boss's attacks from this table, one at a time. */
export const ATTACKS: Record<AttackId, Attack<unknown>> = {
  bolts, drop, grid, chain, freeze, segments, mirror, push, relay, split, stage,
  slam, lash, paths, spikes, congest, rush, shift, eye,
  walls, holes, agents, assume, reorder, evict, jam, predict,
  noise, ring: ringAttack, flips, dies, cracks, hang, probes, leak, lockdown, flare, phase, zap, address, mismatch, bands,
};

/** Every body drawer by kind. */
export const BODIES: Record<BodyKind, BodyDrawer> = {
  lamps, gate, chain: chainBody, wheel, digit, twin, stack, datapath, clocks, worm,
  cell, serpent, titan, polygon, knot, sleeper, snake, transceivers,
  scoreboard, ring, trio, engine, window: windowBody, tower, mesh, hologram,
  antenna, buck, memarray, wafer, package: packageBody, server, tester, vault, ecu, optical, qubit, golem, mute, custboard, sensor,
};

// The discovery beats (Phase 3 Spec, section 6; Phase 4, 6 and 7 Specs, section 4), one file each, keyed by mechanic kind. A place's discovery room
// comes from MECHANICS[kind].room(); the director then runs init, step and draw on it, once per 60 Hz step.
import type { MechanicDef, MechanicKind } from '../types';
import { AGENTS } from './agents';
import { BINS } from './bins';
import { BUS } from './bus';
import { CACHE } from './cache';
import { CLOCKED } from './clocked';
import { CLOCKS } from './clocks';
import { FORMAL } from './formal';
import { GATING } from './gating';
import { INVERTED } from './inverted';
import { LAMPS } from './lamps';
import { LOOP } from './loop';
import { MODEL } from './model';
import { PATTERN } from './pattern';
import { PLACEMENT } from './placement';
import { PULLNET } from './pullnet';
import { REORDER } from './reorder';
import { REPEATER } from './repeater';
import { RETURN } from './return';
import { ROUTING } from './routing';
import { SCAN } from './scan';
import { SCOREBOARD } from './scoreboard';
import { SELECT } from './select';
import { SLACK } from './slack';
import { STAGES } from './stages';
import { VIAS } from './vias';

export const MECHANICS: Record<MechanicKind, MechanicDef<unknown>> = {
  lamps: LAMPS,
  inverted: INVERTED,
  select: SELECT,
  clocked: CLOCKED,
  pattern: PATTERN,
  loop: LOOP,
  bus: BUS,
  clocks: CLOCKS,
  stages: STAGES,
  pullnet: PULLNET,
  repeater: REPEATER,
  slack: SLACK,
  vias: VIAS,
  placement: PLACEMENT,
  gating: GATING,
  scan: SCAN,
  return: RETURN,
  scoreboard: SCOREBOARD,
  bins: BINS,
  agents: AGENTS,
  formal: FORMAL,
  reorder: REORDER,
  cache: CACHE,
  routing: ROUTING,
  model: MODEL,
};

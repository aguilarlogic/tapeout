// The discovery beats (Phase 3 Spec, section 6; Phase 4 and 6 Specs, section 4), one file each, keyed by mechanic kind. A place's discovery room
// comes from MECHANICS[kind].room(); the director then runs init, step and draw on it, once per 60 Hz step.
import type { MechanicDef, MechanicKind } from '../types';
import { BUS } from './bus';
import { CLOCKED } from './clocked';
import { CLOCKS } from './clocks';
import { GATING } from './gating';
import { INVERTED } from './inverted';
import { LAMPS } from './lamps';
import { LOOP } from './loop';
import { PATTERN } from './pattern';
import { PLACEMENT } from './placement';
import { PULLNET } from './pullnet';
import { REPEATER } from './repeater';
import { RETURN } from './return';
import { SCAN } from './scan';
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
};

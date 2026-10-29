// The discovery beats (Phase 3 Spec, section 6; Phase 4 Spec, section 4), one file each, keyed by mechanic kind. A place's discovery room
// comes from MECHANICS[kind].room(); the director then runs init, step and draw on it, once per 60 Hz step.
import type { MechanicDef, MechanicKind } from '../types';
import { BUS } from './bus';
import { CLOCKED } from './clocked';
import { CLOCKS } from './clocks';
import { INVERTED } from './inverted';
import { LAMPS } from './lamps';
import { LOOP } from './loop';
import { PATTERN } from './pattern';
import { SELECT } from './select';
import { STAGES } from './stages';

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
};

// The five discovery beats (Phase 3 Spec, section 6), one file each, keyed by mechanic kind. A place's discovery room
// comes from MECHANICS[kind].room(); the director then runs init, step and draw on it, once per 60 Hz step.
import type { MechanicDef, MechanicKind } from '../types';
import { CLOCKED } from './clocked';
import { INVERTED } from './inverted';
import { LAMPS } from './lamps';
import { PATTERN } from './pattern';
import { SELECT } from './select';

export const MECHANICS: Record<MechanicKind, MechanicDef<unknown>> = {
  lamps: LAMPS,
  inverted: INVERTED,
  select: SELECT,
  clocked: CLOCKED,
  pattern: PATTERN,
};

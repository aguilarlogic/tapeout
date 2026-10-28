// The act 2 bosses' forms (Phase 4 Spec, section 6): which body each incident wears in its arena, and which attacks it
// runs, in turn. formFor (forms-act1.ts) looks here as well as in the act 1 list.
import type { BossForm } from './types';

export const FORMS_ACT2: BossForm[] = [
  { incident: 'inc-isa', name: 'The Bad Call', body: 'stack', attacks: ['push', 'bolts'] },
  { incident: 'inc-datapath', name: 'The Core That Failed Its Tests', body: 'datapath', attacks: ['relay'] },
  { incident: 'inc-crossing', name: 'The Bridge Between Clocks', body: 'clocks', attacks: ['split', 'bolts'] },
  { incident: 'inc-pipeline', name: 'The Red Integer Gate', body: 'worm', attacks: ['stage', 'segments'] },
];

// The act 3 bosses' forms (Phase 6 Spec, section 6): which body each incident wears in its arena, and which attacks it
// runs, in turn. formFor (forms-act1.ts) looks here as well as in the act 1 and 2 lists.
import type { BossForm } from './types';

export const FORMS_ACT3: BossForm[] = [
  { incident: 'inc-cell', name: 'The Stalled Gate', body: 'cell', attacks: ['slam', 'bolts'] },
  { incident: 'inc-bypass', name: 'The Slow Bypass Bus', body: 'serpent', attacks: ['lash', 'segments'] },
  { incident: 'inc-sta', name: 'The Red Signoff', body: 'titan', attacks: ['paths', 'grid'] },
  { incident: 'inc-drc', name: 'The Dirty Signoff', body: 'polygon', attacks: ['spikes', 'drop'] },
  { incident: 'inc-pdcore', name: 'The Congested Core', body: 'knot', attacks: ['congest', 'bolts'] },
  { incident: 'inc-wake', name: 'The Wake-Up Glitch', body: 'sleeper', attacks: ['rush', 'bolts'] },
  { incident: 'inc-dft', name: 'The Chain That Would Not Shift', body: 'snake', attacks: ['shift', 'segments'] },
  { incident: 'inc-link', name: 'The Flaky Link', body: 'transceivers', attacks: ['eye', 'bolts'] },
];

// The act 1 bosses' forms (Phase 3 Spec, section 6): which body each incident wears in its arena, and which attacks it
// runs, in turn.
import { FORMS_ACT2 } from './forms-act2';
import { FORMS_ACT3 } from './forms-act3';
import { FORMS_ACT4 } from './forms-act4';
import type { BossForm } from './types';

export const FORMS_ACT1: BossForm[] = [
  { incident: 'inc-lamp-board', name: 'The Lamp Board', body: 'lamps', attacks: ['bolts', 'drop'] },
  { incident: 'inc-logic', name: 'The Wrong Flag', body: 'gate', attacks: ['grid', 'bolts'] },
  { incident: 'inc-adder', name: 'The Dropped Carry', body: 'chain', attacks: ['chain', 'segments'] },
  { incident: 'inc-controller', name: 'The Hung Controller', body: 'wheel', attacks: ['freeze', 'bolts'] },
  { incident: 'inc-numbers', name: 'The Wrong Numbers', body: 'digit', attacks: ['segments', 'drop'] },
  { incident: 'inc-rtl', name: 'The Regression That Lied', body: 'twin', attacks: ['mirror', 'grid'] },
];

/** The form an incident fights in (acts 1 to 3). A later act's incident with no form of its own wears the lamps and
 *  fires bolts. */
export const formFor = (incident: string): BossForm =>
  [...FORMS_ACT1, ...FORMS_ACT2, ...FORMS_ACT3, ...FORMS_ACT4].find((f) => f.incident === incident) ?? {
    incident, name: incident, body: 'lamps', attacks: ['bolts', 'drop'],
  };

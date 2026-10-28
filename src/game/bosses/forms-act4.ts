// The act 4 bosses' forms (Phase 7 Spec, section 6): which body each incident wears in its arena, and which attacks it
// runs, in turn. formFor (forms-act1.ts) looks here as well as in the act 1 to 3 lists.
import type { BossForm } from './types';

export const FORMS_ACT4: BossForm[] = [
  { incident: 'inc-tb', name: 'The Pass That Checked Nothing', body: 'scoreboard', attacks: ['walls', 'bolts'] },
  { incident: 'inc-cov', name: 'Stuck at 94 Percent', body: 'ring', attacks: ['holes', 'drop'] },
  { incident: 'inc-uvm', name: 'The Misbehaving Environment', body: 'trio', attacks: ['agents', 'segments'] },
  { incident: 'inc-formal', name: 'Proved, Mostly', body: 'engine', attacks: ['assume', 'bolts'] },
  { incident: 'inc-ooo', name: 'The Wandering Window', body: 'window', attacks: ['reorder', 'grid'] },
  { incident: 'inc-memhier', name: 'The Thrashing Cache', body: 'tower', attacks: ['evict', 'bolts'] },
  { incident: 'inc-noc', name: 'The Frozen Mesh', body: 'mesh', attacks: ['jam', 'segments'] },
  { incident: 'inc-model', name: 'The Optimistic Model', body: 'hologram', attacks: ['predict', 'bolts'] },
];

// The wing bosses' forms (Phase 8 Spec, section 5): which body each incident wears in its arena, and which attacks it
// runs, in turn. formFor (forms-act1.ts) looks here as well as in the act 1 to 4 lists.
import type { BossForm } from './types';

export const FORMS_WINGS: BossForm[] = [
  { incident: 'inc-radio', name: 'The Deaf Radio', body: 'antenna', attacks: ['noise', 'bolts'] },
  { incident: 'inc-rail', name: 'The Rail That Rings', body: 'buck', attacks: ['ring', 'drop'] },
  { incident: 'inc-bitflip', name: 'The Flipping Bits', body: 'memarray', attacks: ['flips', 'bolts'] },
  { incident: 'inc-wafer', name: 'The Wafer Map', body: 'wafer', attacks: ['dies', 'grid'] },
  { incident: 'inc-package', name: 'The Field Returns', body: 'package', attacks: ['cracks', 'bolts'] },
  { incident: 'inc-hang', name: 'The 3 A.M. Hang', body: 'server', attacks: ['hang', 'segments'] },
  { incident: 'inc-finaltest', name: 'The Final-Test Yield Drop', body: 'tester', attacks: ['probes', 'drop'] },
  { incident: 'inc-key', name: 'The Leaking Key', body: 'vault', attacks: ['leak', 'bolts'] },
  { incident: 'inc-limp', name: 'The Limp-Mode Storm', body: 'ecu', attacks: ['lockdown', 'bolts'] },
  { incident: 'inc-optical', name: 'The Dark Channel', body: 'optical', attacks: ['flare', 'segments'] },
  { incident: 'inc-qubit', name: 'The Qubit That Will Not Behave', body: 'qubit', attacks: ['phase', 'bolts'] },
  { incident: 'inc-esd', name: 'The Dead USB Ports', body: 'golem', attacks: ['zap', 'rush'] },
  { incident: 'inc-soc', name: 'The Silent Peripheral', body: 'mute', attacks: ['address', 'bolts'] },
  { incident: 'inc-customer', name: 'The Board That Will Not Boot', body: 'custboard', attacks: ['mismatch', 'drop'] },
  { incident: 'inc-pixel', name: 'The Banded Image', body: 'sensor', attacks: ['bands', 'bolts'] },
];

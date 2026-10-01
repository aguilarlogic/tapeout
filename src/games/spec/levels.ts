import type { ArchLevel } from '../arch/types';
import { DIGITAL_LEVELS } from './digital';
import { MEM_LEVELS } from './memory';
import { QUANTUM_LEVELS } from './quantum';
import { RFPH_LEVELS } from './rf-photonics';
import { SECSAFE_LEVELS } from './secsafe';

export const SPEC_LEVELS: ArchLevel[] = [...RFPH_LEVELS, ...MEM_LEVELS, ...DIGITAL_LEVELS, ...SECSAFE_LEVELS, ...QUANTUM_LEVELS];

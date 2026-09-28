// Every practice set and boss, gathered in curriculum order.
import { CIRCUIT_BOSSES, CIRCUIT_PRACTICE } from './circuits';
import { DIGITAL_BOSSES, DIGITAL_PRACTICE } from './digital';
import { FOUNDATION_BOSSES, FOUNDATION_PRACTICE } from './foundations';
import { MATH_BOSSES, MATH_PRACTICE } from './math';
import { SIGNAL_BOSSES, SIGNAL_PRACTICE } from './signals';
import { SYSTEMS_BOSSES, SYSTEMS_PRACTICE } from './systems';
import { TOOLING_BOSSES, TOOLING_PRACTICE } from './tooling';
import { VERIFICATION_BOSSES, VERIFICATION_PRACTICE } from './verification';
import { VLSI_BOSSES, VLSI_PRACTICE } from './vlsi';
import type { Boss, PracticeSet } from './types';

export const PRACTICE_LIST: PracticeSet[] = [...FOUNDATION_PRACTICE, ...CIRCUIT_PRACTICE, ...MATH_PRACTICE, ...SIGNAL_PRACTICE, ...TOOLING_PRACTICE, ...SYSTEMS_PRACTICE, ...DIGITAL_PRACTICE, ...VLSI_PRACTICE, ...VERIFICATION_PRACTICE];
export const BOSSES_LIST: Boss[] = [...FOUNDATION_BOSSES, ...CIRCUIT_BOSSES, ...MATH_BOSSES, ...SIGNAL_BOSSES, ...TOOLING_BOSSES, ...SYSTEMS_BOSSES, ...DIGITAL_BOSSES, ...VLSI_BOSSES, ...VERIFICATION_BOSSES];

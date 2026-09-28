// Every practice set and boss, gathered in curriculum order.
import { CIRCUIT_BOSSES, CIRCUIT_PRACTICE } from './circuits';
import { FOUNDATION_BOSSES, FOUNDATION_PRACTICE } from './foundations';
import { MATH_BOSSES, MATH_PRACTICE } from './math';
import { SIGNAL_BOSSES, SIGNAL_PRACTICE } from './signals';
import type { Boss, PracticeSet } from './types';

export const PRACTICE_LIST: PracticeSet[] = [...FOUNDATION_PRACTICE, ...CIRCUIT_PRACTICE, ...MATH_PRACTICE, ...SIGNAL_PRACTICE];
export const BOSSES_LIST: Boss[] = [...FOUNDATION_BOSSES, ...CIRCUIT_BOSSES, ...MATH_BOSSES, ...SIGNAL_BOSSES];

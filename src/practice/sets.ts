// Every practice set and boss, gathered in curriculum order.
import { FOUNDATION_BOSSES, FOUNDATION_PRACTICE } from './foundations';
import { MATH_BOSSES, MATH_PRACTICE } from './math';
import type { Boss, PracticeSet } from './types';

export const PRACTICE_LIST: PracticeSet[] = [...FOUNDATION_PRACTICE, ...MATH_PRACTICE];
export const BOSSES_LIST: Boss[] = [...FOUNDATION_BOSSES, ...MATH_BOSSES];

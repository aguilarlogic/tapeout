// The frontier roles' practice banks and bosses, gathered for the registry.
import { FRONTIER_BOSSES_A, FRONTIER_PRACTICE_A } from './frontier-a';
import { FRONTIER_BOSSES_B, FRONTIER_PRACTICE_B } from './frontier-b';
import type { Boss, PracticeSet } from './types';

export const FRONTIER_PRACTICE: PracticeSet[] = [...FRONTIER_PRACTICE_A, ...FRONTIER_PRACTICE_B];
export const FRONTIER_BOSSES: Boss[] = [...FRONTIER_BOSSES_A, ...FRONTIER_BOSSES_B];

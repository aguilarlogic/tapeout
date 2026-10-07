import { RULES_0 } from './rules-0';
import { RULES_C } from './rules-c';
import { RULES_E } from './rules-e';
import { RULES_G } from './rules-g';
import { RULES_U } from './rules-u';
import { RULES_W } from './rules-w';
import type { Rule } from './types';

export type { Rule };
export const RULES: Rule[] = [...RULES_0, ...RULES_E, ...RULES_C, ...RULES_U, ...RULES_W, ...RULES_G];

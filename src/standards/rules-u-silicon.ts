import type { Rule } from './types';

// Part U items U6, U8, U9, U10 (silicon facts that moved on). See docs/STANDARDS-PLAN.md.
export const RULES_U_SILICON: Rule[] = [
  { id: 'U6', why: 'U6: GAA nanosheets and backside power are in volume production, not "lining up"', ban: /lining up what comes next: gate-all-around/ },
];

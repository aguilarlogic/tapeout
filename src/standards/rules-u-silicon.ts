import type { Rule } from './types';

// Part U items U6, U8, U9, U10 (silicon facts that moved on). See docs/STANDARDS-PLAN.md.
export const RULES_U_SILICON: Rule[] = [
  { id: 'U6', why: 'U6: GAA nanosheets and backside power are in volume production, not "lining up"', ban: /lining up what comes next: gate-all-around/ },
  { id: 'U8', why: 'U8: the machine model is withdrawn; teach HBM and CDM', ban: /charged machine|machine model/i },
  { id: 'U8-req', why: 'U8: the I/O lesson must teach the charged-device model', require: { file: /lessons\/frontier\.ts$/, re: /charged-device model|CDM/ } },
  { id: 'U8-cdm', why: 'U8: CDM is a destructive qualification test, not a production screen', ban: /CDM screening at final test/ },
  { id: 'U8-latch', why: 'U8: the I/O lesson must teach latch-up qualification', require: { file: /lessons\/frontier\.ts$/, re: /[Ll]atch-up qualification/ } },
];

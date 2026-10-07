import type { Rule } from './types';

// Part U items U6, U8, U9, U10 (silicon facts that moved on). See docs/STANDARDS-PLAN.md.
export const RULES_U_SILICON: Rule[] = [
  { id: 'U6', why: 'U6: GAA nanosheets and backside power are in volume production, not "lining up"', ban: /lining up what comes next: gate-all-around/ },
  { id: 'U8', why: 'U8: the machine model is withdrawn; teach HBM and CDM', ban: /charged machine|machine model/i },
  { id: 'U8-req', why: 'U8: the I/O lesson must teach the charged-device model', require: { file: /lessons\/frontier\.ts$/, re: /charged-device model|CDM/ } },
  { id: 'U8-cdm', why: 'U8: CDM is a destructive qualification test, not a production screen', ban: /CDM screening at final test/ },
  { id: 'U8-latch', why: 'U8: the I/O lesson must teach latch-up qualification', require: { file: /lessons\/frontier\.ts$/, re: /[Ll]atch-up qualification/ } },
  { id: 'U9', why: 'U9: automotive zero-defect programmes run far below 1 DPPM, not single digits', ban: /single.digit(s)? DPPM|DPPM[^.]*single digits|under 10 DPPM|[Aa]utomotive (wants|customers want) (under 10|single digits)|[Cc]ars want single digits/ },
  { id: 'U10', why: 'U10: maximum junction temperature is typically 95-125 C by product, not "below about 105 C" for most chips', ban: /(most chips|[Mm]ost chips) must stay below about 105|keep it under ~105/ },
  { id: 'U10-req', why: 'U10: the packaging lesson must teach Psi_JT for in-system Tj', require: { file: /lessons\/roles\.ts$/, re: /Ψ_?JT/i } },
  { id: 'U10-gloss', why: 'U10: the glossary must define psi-JT', require: { file: /glossary\.ts$/, re: /psi_jt/ } },
];

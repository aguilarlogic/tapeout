import type { Rule } from './types';

export const RULES_G_SVA: Rule[] = [
  {
    id: 'G1.4-goto-ends',
    why: 'G1.4: b[->n] (goto) ends on the n-th b; b[=n] may continue through idle cycles',
    require: { file: /lessons\/verification/, re: /match \*\*ends on that 3rd b\*\*/ },
  },
  {
    id: 'G1.4-nonconsecutive-idle',
    why: 'G1.4: the lesson must say b[=n] carries on through idle cycles after the n-th b',
    require: { file: /lessons\/verification/, re: /carry on through idle cycles/ },
  },
  {
    id: 'G1.4-goto-not-idle',
    why: 'G1.4: it is [=n], not [->n], that may be followed by idle cycles',
    files: /lessons|practice|glossary|games\/sva\/levels/,
    ban: /\[->[\dn]\][^\n;]{0,50}(may|can) (carry on|continue|end)[^\n]{0,20}idle/,
  },
  {
    id: 'G1.4-liveness-fairness',
    why: 'G1.4: liveness needs an unbounded trace and a fairness assumption; a finite trace cannot refute it',
    require: { file: /lessons\/verification/, re: /fairness assumption/ },
  },
  {
    id: 'G1.4-liveness-never-refuted',
    why: 'G1.4: s_eventually is pending on a finite trace, never failed',
    files: /lessons|practice|glossary|games\/sva\/levels/,
    ban: /s_eventually[^\n]{0,80}(fails|is refuted) (when|if) [^\n]{0,30}(no|never|not)/,
  },
];

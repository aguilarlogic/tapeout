import type { Rule } from './types';

export const RULES_E_SHELL_SVA_UVM: Rule[] = [
  {
    id: 'E6-grep',
    why: 'E6: \\d is Perl-only; plain grep / grep -E treat it as a literal d',
    ban: /grep( -[a-zA-Z]*E[a-zA-Z]*)? ['"][^'"]*\\\\d/,
    unless: /grep -P|Python|re\./,
  },
  {
    id: 'E8-isunknown',
    why: 'E8: $isunknown is a compile error in the 2-state SVA lab; no mission may use it',
    files: /games\/sva\/(levels|check|formal)|practice\//,
    ban: /\$isunknown/,
  },
  {
    id: 'E8-2state-sentence',
    why: 'E8: the X-optimism teaching must say the lab is 2-state',
    require: { file: /practice\/verification/, re: /our lab is 2-state, so you see 0 instead/ },
  },
  {
    id: 'E9-report-top-down',
    why: 'E9: report/check/extract run bottom-up, never top-down',
    ban: /(report|check|extract|connect)_phase[^\n]{0,40}top-down/i,
  },
  {
    id: 'E6-find-exec',
    why: 'E6: an unquoted ; ends the shell command, so find needs -exec … {} \\; or +',
    ban: /-exec [^\n]*\{\} ;/,
  },
];

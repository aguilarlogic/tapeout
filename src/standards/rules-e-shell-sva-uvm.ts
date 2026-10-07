import type { Rule } from './types';

export const RULES_E_SHELL_SVA_UVM: Rule[] = [
  {
    id: 'E6-grep',
    why: 'E6: \\d is Perl-only; plain grep / grep -E treat it as a literal d',
    ban: /grep( -[a-zA-Z]*E[a-zA-Z]*)? ['"][^'"]*\\\\d/,
    unless: /grep -P|Python|re\./,
  },
  {
    id: 'E6-find-exec',
    why: 'E6: an unquoted ; ends the shell command, so find needs -exec … {} \\; or +',
    ban: /-exec [^\n]*\{\} ;/,
  },
];

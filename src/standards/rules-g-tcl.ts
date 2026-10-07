import type { Rule } from './types';

export const RULES_G_TCL: Rule[] = [
  { id: 'G2.1a', why: 'G2.1: the flows lesson teaches foreach_in_collection and filters', require: { file: /lessons\/tooling/, re: /foreach_in_collection/ } },
  { id: 'G2.1b', why: 'G2.1: the flows lesson teaches catch', require: { file: /lessons\/tooling/, re: /\bcatch\b/ } },
  { id: 'G2.1c', why: 'G2.1: the flows lesson teaches dict', require: { file: /lessons\/tooling/, re: /dict set/ } },
  { id: 'G2.1e', why: 'G2.1: the flows lesson teaches regexp', require: { file: /lessons\/tooling/, re: /regexp \{/ } },
  { id: 'G2.1d', why: 'G2.1: the Tcl drills include catch (difficulty 3)', require: { file: /practice\/tooling/, re: /catch \{check/ } },
];

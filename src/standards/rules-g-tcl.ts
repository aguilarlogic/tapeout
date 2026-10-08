import type { Rule } from './types';

export const RULES_G_TCL: Rule[] = [
  { id: 'G2.1a', why: 'G2.1: the flows lesson teaches foreach_in_collection and filters', require: { file: /lessons\/tooling/, re: /foreach_in_collection/ } },
  { id: 'G2.1b', why: 'G2.1: the flows lesson teaches catch', require: { file: /lessons\/tooling/, re: /\bcatch\b/ } },
  { id: 'G2.1c', why: 'G2.1: the flows lesson teaches dict', require: { file: /lessons\/tooling/, re: /dict set/ } },
  { id: 'G2.1e', why: 'G2.1: the flows lesson teaches regexp', require: { file: /lessons\/tooling/, re: /regexp \{/ } },
  { id: 'G2.1d', why: 'G2.1: the Tcl drills include catch (difficulty 3)', require: { file: /practice\/tooling/, re: /catch \{check/ } },
  { id: 'G3.5a', why: 'G3.5: Tcl missions include a netlist collection level', require: { file: /games\/code\/levels-tcl/, re: /foreach_in_collection c/ } },
  { id: 'G3.5c', why: 'G3.5: the Code Lab page carries the Tcl model note', require: { file: /games\/code\/page/, re: /A Tcl subset with a toy netlist; real EDA shells have far more commands\./ } },
];

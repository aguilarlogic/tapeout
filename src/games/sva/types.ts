import type { Rng } from '../../lessons/types';
import type { Env } from './formal';

export interface Mutant { name: string; src: string }

export interface SvaInstance {
  /** write: the learner writes assertions; assume: the learner writes assumptions; fix: the learner repairs the design. */
  mode: 'write' | 'assume' | 'fix';
  brief: string;
  hints: string[];
  /** The Verilog under test. In fix mode this is the buggy starter the learner edits; `golden` is the reference. */
  design: string;
  golden?: string;
  env: Env;
  /** Text the learner edits: SVA for write and assume modes, Verilog for fix mode. */
  starter: string;
  /** SVA that is always included (given assertions and covers for assume and fix modes). */
  given?: string;
  solution: string;
  mutants: Mutant[];
  /** Exhaustive search depth, in cycles after reset. */
  depth: number;
  simLen?: number;
  bias?: Record<string, number>;
  /** Names of cover directives that must be hit on the correct design. */
  covers?: string[];
  /** write mode: at least this many assertions, so one catch-all cannot pass. */
  minAsserts?: number;
}

export interface SvaLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'boss';
  ticket: string;
  build: (r: Rng) => SvaInstance;
}

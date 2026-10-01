import type { Rng } from '../../lessons/types';
import type { SvRun } from './run';

export interface TbMutant { name: string; dut: string }

export interface TbGoal {
  label: string;
  /** Judge one run of the correct design.  Return true, or a string explaining the miss. */
  check: (run: SvRun) => boolean | string;
}

export interface TbInstance {
  /** write: the learner writes new code.  fix: the learner repairs given code. */
  mode: 'write' | 'fix';
  brief: string;
  hints: string[];
  /** What the editor starts with. */
  starter: string;
  /** Code that is always appended after the learner's text (harness, DUT, interfaces). Contains `@@DUT@@` where a design goes. */
  fixed: string;
  dut?: string;
  mutants?: TbMutant[];
  /** The mutants must make the testbench report an error; the correct design must run clean. */
  needCatch?: boolean;
  uvm?: boolean;
  seeds?: number[];
  maxTime?: number;
  maxOps?: number;
  goals: TbGoal[];
  /** Coverage the learner's covergroups must reach on the correct design (percent), with a minimum number of coverpoints. */
  coverage?: { min: number; points?: number };
  solution: string;
}

export interface TbLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'boss';
  ticket: string;
  build: (r: Rng) => TbInstance;
}

export type { SvRun };

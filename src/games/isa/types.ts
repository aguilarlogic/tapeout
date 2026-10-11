import type { Rng } from '../../lessons/types';
import type { Program } from './asm';
import type { Machine } from './sim';

export interface Setup {
  regs?: Record<string, number>;
  /** memory to preload: words or bytes at an address */
  data?: { addr: number; words?: number[]; bytes?: number[] }[];
}

export interface IsaCase {
  label: string;
  setup: Setup;
  /** true on success, or why it failed */
  check: (m: Machine, prog: Program) => true | string;
  maxSteps?: number;
  hidden?: boolean;
}

export interface IsaInstance {
  /** program: runs from address 0 and must exit with ecall. function: `entry` is called with the standard ABI. */
  style: 'program' | 'function';
  entry?: string;
  mode: 'write' | 'fix';
  brief: string;
  hints: string[];
  starter: string;
  /** code appended after the learner's (helpers the program calls) */
  fixed?: string;
  cases: IsaCase[];
  /** instructions that may not appear anywhere in the source, with the reason */
  forbid?: { re: RegExp; why: string };
  /** limit on the number of instructions in the program text */
  maxInstrs?: number;
  /** limit on executed instructions per case, reported as a goal */
  budget?: number;
  /** a function must restore s0-s11 and sp (default true for function style) */
  abi?: boolean;
  solution: string;
}

export interface IsaLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'debug' | 'boss';
  ticket: string;
  build: (r: Rng) => IsaInstance;
}

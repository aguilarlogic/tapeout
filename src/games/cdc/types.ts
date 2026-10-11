import type { Rng } from '../../lessons/types';
import type { Bench, Scenario } from './dsim';
import type { CdcSpec } from './analyze';

export interface CdcInstance {
  mode: 'write' | 'fix';
  brief: string;
  hints: string[];
  starter: string;
  spec: CdcSpec;
  /** ports the module must have, so the bench can drive it */
  ports: string[];
  scenarios: Scenario[];
  bench: (sc: Scenario) => Bench;
  /** a one-line description of what the simulation checks, shown in the goal list */
  checks: string;
  solution: string;
}

export interface CdcLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'boss';
  ticket: string;
  build: (r: Rng) => CdcInstance;
}

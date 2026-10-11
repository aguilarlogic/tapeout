import type { Rng } from '../../lessons/types';
import type { PipeRow } from './pipeline';

export type Values = Record<string, string | number | boolean>;

export type Control =
  | { id: string; kind: 'select'; label: string; options: { value: string; label: string }[]; value: string; hint?: string }
  | { id: string; kind: 'toggle'; label: string; value: boolean; hint?: string }
  | { id: string; kind: 'text'; label: string; value: string; rows?: number; placeholder?: string; hint?: string }
  | { id: string; kind: 'number'; label: string; min: number; max: number; step?: number; value: number; hint?: string };

export interface Goal { label: string; ok: boolean; note?: string }

export type View =
  | { kind: 'diagram'; rows: PipeRow[]; caption?: string }
  | { kind: 'table'; head: string[]; rows: (string | number)[][]; caption?: string; /** a CSS class per row */ classes?: string[] }
  | { kind: 'grid'; cells: { t: string; c?: string }[][]; caption?: string }
  | { kind: 'bars'; items: { label: string; value: number; of: number }[]; caption?: string }
  | { kind: 'plot'; series: PlotSeries[]; xlabel?: string; ylabel?: string; caption?: string; /** horizontal reference lines */ marks?: { y: number; label: string }[] };

export interface PlotSeries { label: string; ys: number[]; /** x for each y; defaults to the index */ xs?: number[]; stem?: boolean; color?: string }

export interface ArchResult {
  goals: Goal[];
  metrics: [string, string][];
  view?: View;
  /** a second view shown under the first */
  extra?: View;
  error?: { message: string; line?: number };
}

export interface ArchInstance {
  brief: string;
  hints: string[];
  controls: Control[];
  /** optional assembly the learner edits */
  code?: { label: string; starter: string };
  /** a read-only listing shown above the controls (workload) */
  listing?: { label: string; text: string };
  run: (values: Values, code?: string) => ArchResult;
  solution: { values: Values; code?: string };
}

export interface ArchLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'boss';
  /** which lab the mission belongs to, for the header tag */
  lab: 'Pipeline' | 'Cache' | 'Out-of-order' | 'DFT' | 'PD' | 'Layout' | 'STA' | 'Signals' | 'RF' | 'Photonics' | 'Memory' | 'Process' | 'Package' | 'FPGA' | 'AI' | 'Security' | 'Safety' | 'Quantum';
  ticket: string;
  build: (r: Rng) => ArchInstance;
}

export const defaults = (cs: Control[]): Values => Object.fromEntries(cs.map((c) => [c.id, c.value]));

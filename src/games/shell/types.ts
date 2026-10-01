import type { Rng } from '../../lessons/types';
import type { Shell } from './sh';

export interface ShellEntry { cmd: string; out: string; status: number }
export interface ShellGoal { label: string; ok: (sh: Shell, hist: ShellEntry[]) => boolean }
export type FileSpec = string | { data: string; mode?: number };

export interface ShellInstance {
  brief: string;
  hints: string[];
  files: Record<string, FileSpec>;
  /** Working directory the terminal starts in (relative to the home directory). */
  cwd?: string;
  /** Commands run silently before the learner starts (builds a git history, for instance). */
  setup?: string[];
  /** Commands that solve the mission; the tests prove they pass every goal while doing nothing does not. */
  solution: string[];
  goals: ShellGoal[];
}

export interface ShellLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  tier: 'guided' | 'boss';
  ticket: string;
  build: (r: Rng) => ShellInstance;
}

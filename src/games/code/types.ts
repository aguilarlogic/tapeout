import type { Rng } from '../../lessons/types';
import type { CodeInstance } from './run';

export interface CodeLevel {
  id: string;
  title: string;
  concept: string;
  xp: number;
  /** guided: hints and a story; debug: fix a crashing program; boss: randomized, no hints. */
  tier: 'guided' | 'debug' | 'boss';
  lang: 'py' | 'c';
  /** One line shown above the brief: who is asking. */
  ticket: string;
  build: (r: Rng) => CodeInstance;
}

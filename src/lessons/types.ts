import type { Answer } from './answers';

export type Mood = 'neutral' | 'happy' | 'excited' | 'thinking' | 'concerned' | 'proud' | 'wink';
export type Rng = () => number;

export interface AskStep { t: 'ask'; q: string; a: Answer; why: string; hint?: string; chips?: string[] }
export interface McStep { t: 'mc'; q: string; options: string[]; a: number; why: string }
export type Question = AskStep | McStep;

export type Step =
  | { t: 'say'; text: string; mood?: Mood }
  | { t: 'art'; text: string; caption?: string }
  | Question
  | { t: 'gen'; make: (r: Rng) => Question }
  /** TAPEOUT opens a minigame window and waits for it to finish. */
  | { t: 'app'; game: string; rounds?: number; text: string };

export interface Lesson {
  id: string;
  title: string;
  concept: string;
  xp: number;
  steps: Step[];
  recap: string[];
}

// Small constructors keep the lesson files readable.
export const say = (text: string, mood?: Mood): Step => ({ t: 'say', text, mood });
export const art = (text: string, caption?: string): Step => ({ t: 'art', text: text.replace(/^\n/, '').replace(/\n\s*$/, ''), caption });
export const ask = (q: string, a: Answer, why: string, hint?: string): AskStep => ({ t: 'ask', q, a, why, hint });
export const mc = (q: string, options: string[], a: number, why: string): McStep => ({ t: 'mc', q, options, a, why });
export const gen = (make: (r: Rng) => Question): Step => ({ t: 'gen', make });
export const app = (game: string, text: string, rounds?: number): Step => ({ t: 'app', game, text, rounds });

export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const between = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

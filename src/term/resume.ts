// A lesson in progress, kept as a lab draft so a reload can pick it up (U29). One lesson runs at a time, so one key.
import type { Lesson, Step } from '../lessons/types';
import { clearDraft, loadDraft, saveDraft } from '../state';

export const RUN_KEY = 'lesson.run';

/** What is stored: the lesson, the step about to start, and the grading so far (so XP is unchanged on resume). */
export interface RunDraft { id: string; step: number; asked: number; firstTry: number }

export function runSnapshot(id: string, step: number, asked: number, firstTry: number): RunDraft {
  return { id, step, asked, firstTry };
}

/** A stored run, checked. A damaged record, or a step past the end of the lesson, is ignored. */
export function parseRun(v: unknown, stepCount?: number): RunDraft | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const { id, step, asked, firstTry } = v as Record<string, unknown>;
  const whole = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  if (typeof id !== 'string' || !id || !whole(step) || !whole(asked) || !whole(firstTry)) return undefined;
  if ((firstTry as number) > (asked as number)) return undefined;
  if (stepCount !== undefined && (step as number) >= stepCount) return undefined;
  return { id, step: step as number, asked: asked as number, firstTry: firstTry as number };
}

export const saveRun = (run: RunDraft) => saveDraft(RUN_KEY, run);
export const loadRun = (): RunDraft | undefined => parseRun(loadDraft<unknown>(RUN_KEY));
export const clearRun = () => clearDraft(RUN_KEY);

/** Where the player was, in a few words: the question they were on, or the line TAPEOUT was saying. */
export function stepDescription(l: Lesson, i: number): string {
  const s: Step | undefined = l.steps[i];
  const text = !s ? '' : s.t === 'ask' || s.t === 'mc' ? s.q : s.t === 'gen' ? 'the next question' : s.t === 'app' ? s.text : s.t === 'say' || s.t === 'art' ? s.text : '';
  if (text === 'the next question') return text;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? `${flat.slice(0, 77).replace(/\s+\S*$/, '')}…` : flat;
}

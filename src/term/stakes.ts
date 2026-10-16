// When a lesson counts as signed off. Skipping is allowed, but a lesson skipped by more than half stays unsigned.

/** True when the lesson signs off: at most half of its questions were skipped. */
export const signsOff = (asked: number, skipped: number): boolean => skipped * 2 <= asked;

/** A lesson signs off at this share of its questions right. */
export const LESSON_PASS = 0.8;

/**
 * Mastery bar for a lesson: first-try answers count fully, and a missed question answered right when it comes back
 * near the end counts half (it was learned, with help). Below the bar the lesson is "not yet", and is not signed off.
 */
export const masters = (asked: number, firstTry: number, recovered = 0): boolean =>
  asked === 0 || (firstTry + recovered / 2) / asked >= LESSON_PASS - 1e-9;

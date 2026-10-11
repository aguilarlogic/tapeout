// When a lesson counts as signed off. Skipping is allowed, but a lesson skipped by more than half stays unsigned.

/** True when the lesson signs off: at most half of its questions were skipped. */
export const signsOff = (asked: number, skipped: number): boolean => skipped * 2 <= asked;

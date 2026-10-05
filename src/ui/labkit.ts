// Pieces every lab page shares.

/** Hints cost a star: 3 for a clean solve, 2 if any hint was used. (Circuit and logic labs add their own par rules.) */
export const starsFor = (hintsUsed: number) => (hintsUsed > 0 ? 2 : 3);

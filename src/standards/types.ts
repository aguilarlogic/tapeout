/** One lint rule over the player-facing source text. See docs/STANDARDS-PLAN.md, S0.2. */
export interface Rule {
  id: string;
  /** Short reason, pointing at the plan item (for example 'U1: HBM4 is 2048-bit'). */
  why: string;
  /** Restrict the rule to paths matching this (the path is relative to the repo root, with forward slashes). */
  files?: RegExp;
  /** Fail when a line matches… */
  ban?: RegExp;
  /** …unless the same line also matches this. */
  unless?: RegExp;
  /** Fail when no line of any matching file matches (a fact that must be taught). */
  require?: { file: RegExp; re: RegExp };
}

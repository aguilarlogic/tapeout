# Content lint rules

`src/standards.test.ts` scans the player-facing source for the rules exported from `rules-*.ts` here.

- One file per plan area, for example `rules-e1-c-lab.ts`, exporting `export const RULES_E1: Rule[] = [...]`.
- Any export whose name starts with `RULES` is collected; there is no list to edit.
- A rule is a `ban` (with an optional `unless`) or a `require` (a fact that must be taught). See `types.ts`.
- Keep `why` short and point at the plan item, for example `why: 'U1: HBM4 is 2048-bit'`.

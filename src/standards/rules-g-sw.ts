import type { Rule } from './types';

// G2.2-G2.4: privileged basics and start-up, git/shell for real projects, C for embedded and interview C++.
export const RULES_G_SW: Rule[] = [
  { id: 'G2.2a', why: 'G2.2: the asm lesson teaches traps (mcause, mepc, mret)', require: { file: /lessons\/systems/, re: /mcause/ } },
  { id: 'G2.2b', why: 'G2.2: the asm lesson names the privilege modes and fence', require: { file: /lessons\/systems/, re: /\*\*fence\*\*/ } },
  { id: 'G2.2c', why: 'G2.2: the asm lesson says one sentence each about the A and C extensions and RV64', require: { file: /lessons\/systems/, re: /\*\*RV64\*\*/ } },
  { id: 'G2.2d', why: 'G2.2: mission isa-trap exists', require: { file: /games\/isa\/levels/, re: /id: 'isa-trap'/ } },
  { id: 'G2.2e', why: 'G2.2: mission isa-timer exists', require: { file: /games\/isa\/levels/, re: /id: 'isa-timer'/ } },
  { id: 'G2.2f', why: 'G2.2: mission isa-crt0 exists', require: { file: /games\/isa\/levels/, re: /id: 'isa-crt0'/ } },
  { id: 'G2.3a', why: 'G2.3: the git lesson teaches fetch versus pull, submodules, LFS and interactive rebase', require: { file: /lessons\/tooling/, re: /\*\*interactive rebase\*\*/ } },
  { id: 'G2.3b', why: 'G2.3: the git lesson teaches submodules and LFS', require: { file: /lessons\/tooling/, re: /\*\*Git LFS\*\*/ } },
  { id: 'G2.3c', why: 'G2.3: the shell lesson teaches set -euo pipefail', require: { file: /lessons\/tooling/, re: /set -euo pipefail/ } },
  { id: 'G2.3d', why: 'G2.3: the shell lesson teaches find -print0 | xargs -0', require: { file: /lessons\/tooling/, re: /-print0 \| xargs -0/ } },
  { id: 'G2.3e', why: 'G2.3: the shell lesson teaches environment modules and csh setenv', require: { file: /lessons\/tooling/, re: /setenv NAME value/ } },
  { id: 'G2.3f', why: 'G2.3: mission git-remote exists', require: { file: /games\/shell\/levels-git/, re: /id: 'git-remote'/ } },
  { id: 'G2.3g', why: 'G2.3: mission git-rebase-i exists', require: { file: /games\/shell\/levels-git/, re: /id: 'git-rebase-i'/ } },
  { id: 'G2.3h', why: 'G2.3: mission sh-quoting exists', require: { file: /games\/shell\/levels-sh/, re: /id: 'sh-quoting'/ } },
];

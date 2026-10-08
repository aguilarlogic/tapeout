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
  { id: 'G2.4a', why: 'G2.4: the C lesson teaches ISR-shared variables and why volatile is not atomic', require: { file: /lessons\/systems/, re: /\*\*ISR\*\*/ } },
  { id: 'G2.4b', why: 'G2.4: the C lesson teaches strict aliasing', require: { file: /lessons\/systems/, re: /\*\*strict aliasing\*\*/ } },
  { id: 'G2.4c', why: 'G2.4: the C lesson names static_assert and offsetof for register maps', require: { file: /lessons\/systems/, re: /static_assert\(sizeof/ } },
  { id: 'G2.4d', why: 'G2.4: the C lesson names the sanitizers', require: { file: /lessons\/systems/, re: /\*\*AddressSanitizer\*\*/ } },
  { id: 'G2.4e', why: 'G2.4: the C++ lesson teaches the rule of zero, three and five', require: { file: /lessons\/systems/, re: /\*\*rule of zero, three and five\*\*/ } },
  { id: 'G2.4f', why: 'G2.4: the C++ lesson teaches std::atomic and memory order', require: { file: /lessons\/systems/, re: /\*\*memory order\*\*/ } },
  { id: 'G2.4g', why: 'G2.4: mission code-c-isr exists', require: { file: /games\/code\/levels-c/, re: /id: 'code-c-isr'/ } },
  { id: 'G2.4h', why: 'G2.4: the C practice set covers the embedded topics (aliasing, sanitizers)', require: { file: /practice\/systems/, re: /strict aliasing/ } },
  { id: 'G2.4i', why: 'G2.4: the C++ practice set covers the rule of zero and memory order', require: { file: /practice\/systems/, re: /'memory order'/ } },
];

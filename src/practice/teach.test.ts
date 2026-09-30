import { describe, expect, it } from 'vitest';
import type { Question } from '../lessons/types';
import { rng } from '../sim/harness';
import { PRACTICE } from './index';
import type { Difficulty } from './types';

/** Every practice question can be taught: a method, why it applies, and steps the player works through. */
function checkWalk(q: Question, where: string) {
  const w = q.teach;
  expect(w, `${where}: needs a walkthrough`).toBeDefined();
  if (!w) return;
  expect(w.method.length, `${where}: method name`).toBeGreaterThan(3);
  expect(w.idea.length, `${where}: when and why the method applies`).toBeGreaterThan(30);
  const work = w.beats.filter((b) => b.t === 'do' || b.t === 'pick');
  expect(work.length, `${where}: at least one step for the player to do`).toBeGreaterThanOrEqual(1);
  for (const [i, b] of w.beats.entries()) {
    if (b.t === 'do') {
      expect(b.a.check(b.a.canonical), `${where} step ${i}: canonical "${b.a.canonical}" must be accepted`).toBe(true);
      expect(b.a.check(''), `${where} step ${i}: empty must be rejected`).toBe(false);
    } else if (b.t === 'pick') {
      expect(new Set(b.options).size, `${where} step ${i}: distinct options`).toBe(b.options.length);
      expect(b.options.length, `${where} step ${i}`).toBeGreaterThanOrEqual(2);
    } else expect(b.text.trim().length, `${where} step ${i}`).toBeGreaterThan(5);
  }
  // A worked calculation must land on the answer: the last step's result is accepted by the question itself.
  const last = w.beats[w.beats.length - 1];
  if (q.t === 'ask' && last.t === 'do') expect(q.a.check(last.a.canonical), `${where}: last step "${last.a.canonical}" must be the answer (${q.a.canonical})`).toBe(true);
}

/**
 * Sets whose walkthroughs are still being written (see docs/TEACH-ME-PLAN.md). Remove a set's id as soon as
 * every one of its generators is taught; the list must end up empty, and then this set and its guard go away.
 */
const PENDING = new Set([
  'practice-c', 'practice-cpp', 'practice-dsa', 'practice-asm', 'practice-os',
  'practice-comb', 'practice-seq', 'practice-fsm', 'practice-verilog', 'practice-alu', 'practice-clk', 'practice-sta', 'practice-vlsi',
  'practice-power', 'practice-pcb', 'practice-dv', 'practice-crv', 'practice-cov', 'practice-uvm', 'practice-sva', 'practice-formal', 'practice-dft',
  'practice-pipe', 'practice-ooo', 'practice-cache', 'practice-coherence', 'practice-dram', 'practice-bus', 'practice-noc', 'practice-serdes',
  'practice-perf', 'practice-analog', 'practice-rf', 'practice-pmic', 'practice-pnr', 'practice-sram', 'practice-fab', 'practice-pkg',
  'practice-postsi', 'practice-ate', 'practice-emu', 'practice-npu', 'practice-hwsec', 'practice-fusa', 'practice-photonics', 'practice-qubit',
  'practice-qctrl',
]);

describe('practice walkthroughs', () => {
  for (const p of PRACTICE) {
    if (PENDING.has(p.id)) { it.todo(`${p.id}: every problem can be taught step by step`); continue; }
    it(`${p.id}: every problem can be taught step by step`, () => {
      for (const d of [1, 2, 3] as Difficulty[]) for (let seed = 1; seed <= 25; seed++) {
        p.gens.forEach((g, i) => checkWalk(g(rng(seed * 7 + i), d), `${p.id} gen${i} d${d} seed${seed}`));
      }
    });
  }
  it('the pending list names only real sets', () => {
    const ids = new Set(PRACTICE.map((p) => p.id));
    for (const id of PENDING) expect(ids.has(id), id).toBe(true);
  });
});

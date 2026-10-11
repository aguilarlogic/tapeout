import { beforeEach, describe, expect, it } from 'vitest';
import { findModule } from './curriculum';
import { resetAll, complete } from './state';

// Minimal Storage-like stub, installed before state.ts is used (no jsdom in this project).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const chip = await import('./chip');
const { CHIPS, SLOT_MODULE_IDS, blockLine, blockProgress, chipProgress, chipSummary, currentChip, slotProgress } = chip;

const alu = CHIPS[0].blocks[0];

describe('chip data', () => {
  it('every slot names a module that exists in the curriculum', () => {
    for (const id of SLOT_MODULE_IDS) expect(findModule(id), id).toBeDefined();
  });

  it('no module fills two slots', () => {
    expect(new Set(SLOT_MODULE_IDS).size).toBe(SLOT_MODULE_IDS.length);
  });

  it('has four chips in order, each with blocks and slots that have modules', () => {
    expect(CHIPS.map((c) => c.id)).toEqual(['ADA-1', 'ADA-2', 'ADA-3', 'ADA-4']);
    for (const c of CHIPS) {
      expect(c.blocks.length).toBeGreaterThan(0);
      for (const b of c.blocks) {
        expect(b.slots.length).toBeGreaterThan(0);
        for (const s of b.slots) expect(s.modules.length, `${c.id} ${b.name} ${s.name}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('chip progress', () => {
  beforeEach(() => { store.clear(); resetAll(); });

  it('a fresh save shows ADA-1 with nothing built', () => {
    expect(currentChip().id).toBe('ADA-1');
    expect(chipProgress(CHIPS[0]).built).toBe(0);
    expect(blockProgress(alu).built).toBe(0);
    expect(chipSummary()).toBe('ADA-1 · ALU: no bits built yet, next: Half Adder');
  });

  it('after logic-half, bit 0 is half-lit and not yet built', () => {
    complete('logic-half', 70, 2);
    expect(slotProgress(alu.slots[0]).state).toBe('half');
    expect(blockProgress(alu).built).toBe(0);
    expect(chipSummary()).toContain('bit 0 of 8 started');
    expect(chipSummary()).toContain('next: Half Adder in Verilog');
  });

  it('after half-adder-v, bit 0 is built and the summary says so', () => {
    complete('logic-half', 70, 2);
    complete('half-adder-v', 70, 2);
    expect(slotProgress(alu.slots[0]).state).toBe('built');
    expect(blockProgress(alu).built).toBe(1);
    expect(chipSummary()).toContain('bit 0 of 8');
    expect(chipSummary()).toBe('ADA-1 · ALU: bit 0 of 8 built, next: Full Adder');
  });

  it('the ALU reports the run from bit 0; a later bit on its own is counted without a position', () => {
    complete('adder4', 90, 2);
    expect(blockLine(alu)).toBe('2 of 8 bits built');
    complete('logic-half', 70, 2);
    complete('half-adder-v', 70, 2);
    expect(blockLine(alu)).toBe('bit 0 of 8 built');
    complete('logic-full', 100, 2);
    expect(blockLine(alu)).toBe('bits 0 to 3 of 8 built');
  });

  it('moves on to ADA-2 once every ADA-1 slot is built', () => {
    for (const id of CHIPS[0].blocks.flatMap((b) => b.slots.flatMap((s) => s.modules))) complete(id, 10, 1);
    expect(chipProgress(CHIPS[0]).done).toBe(true);
    expect(currentChip().id).toBe('ADA-2');
    expect(chipSummary().startsWith('ADA-2 · ')).toBe(true);
  });
});

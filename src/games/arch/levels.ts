import { SPEC_LEVELS } from '../spec/levels';
import { SIG_LEVELS } from '../sig/levels';
import { LAYOUT_LEVELS } from '../layout/levels';
import { STA2_LEVELS } from '../sta2/levels';
import { PD_LEVELS } from '../pd/levels';
import { DFT_LEVELS } from '../dft/levels';
import { CACHE_LEVELS } from './levels-cache';
import { OOO_LEVELS } from './levels-ooo';
import { PIPE_LEVELS } from './levels-pipe';
import type { ArchLevel, ArchResult } from './types';

/** A run is a pure function of its settings and code, so repeats (a player re-checking, a test sweeping a small settings space) are answered from memory. */
const memoised = (l: ArchLevel): ArchLevel => ({
  ...l,
  build: (r) => {
    const inst = l.build(r), seen = new Map<string, ArchResult>();
    return { ...inst, run: (v, code) => { const k = JSON.stringify([v, code]); let res = seen.get(k); if (!res) { res = inst.run(v, code); if (seen.size < 500) seen.set(k, res); } return res; } };
  },
});
export const ARCH_LEVELS: ArchLevel[] = [...PIPE_LEVELS, ...CACHE_LEVELS, ...OOO_LEVELS, ...DFT_LEVELS, ...PD_LEVELS, ...STA2_LEVELS, ...LAYOUT_LEVELS, ...SIG_LEVELS, ...SPEC_LEVELS].map(memoised);
export const findArchLevel = (id: string) => ARCH_LEVELS.find((l) => l.id === id);

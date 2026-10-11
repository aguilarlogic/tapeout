import { SPEC_LEVELS } from '../spec/levels';
import { SIG_LEVELS } from '../sig/levels';
import { LAYOUT_LEVELS } from '../layout/levels';
import { STA2_LEVELS } from '../sta2/levels';
import { PD_LEVELS } from '../pd/levels';
import { DFT_LEVELS } from '../dft/levels';
import { CACHE_LEVELS } from './levels-cache';
import { OOO_LEVELS } from './levels-ooo';
import { PIPE_LEVELS } from './levels-pipe';
import type { ArchLevel } from './types';

export const ARCH_LEVELS: ArchLevel[] = [...PIPE_LEVELS, ...CACHE_LEVELS, ...OOO_LEVELS, ...DFT_LEVELS, ...PD_LEVELS, ...STA2_LEVELS, ...LAYOUT_LEVELS, ...SIG_LEVELS, ...SPEC_LEVELS];
export const findArchLevel = (id: string) => ARCH_LEVELS.find((l) => l.id === id);

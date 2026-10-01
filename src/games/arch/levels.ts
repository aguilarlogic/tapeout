import { CACHE_LEVELS } from './levels-cache';
import { OOO_LEVELS } from './levels-ooo';
import { PIPE_LEVELS } from './levels-pipe';
import type { ArchLevel } from './types';

export const ARCH_LEVELS: ArchLevel[] = [...PIPE_LEVELS, ...CACHE_LEVELS, ...OOO_LEVELS];
export const findArchLevel = (id: string) => ARCH_LEVELS.find((l) => l.id === id);

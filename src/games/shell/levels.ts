// Shell Lab: the mission registry.
import { rng } from '../../sim/harness';
import { GIT_LEVELS } from './levels-git';
import { SH_LEVELS } from './levels-sh';
import type { ShellLevel } from './types';

export type { ShellLevel };
export const SHELL_LEVELS: ShellLevel[] = [...SH_LEVELS, ...GIT_LEVELS];
export const findShellLevel = (id: string) => SHELL_LEVELS.find((l) => l.id === id);
export const shellInstanceFor = (level: ShellLevel, seed: number) => level.build(rng(seed));
export { starsFor } from '../../ui/labkit';

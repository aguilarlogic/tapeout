// Code Lab: the mission registry.
import { rng } from '../../sim/harness';
import { C_LEVELS } from './levels-c';
import { EDA_CODE_LEVELS } from './levels-eda';
import { OS_LEVELS } from './levels-os';
import { PY_LEVELS } from './levels-py';
import type { CodeLevel } from './types';

export type { CodeLevel };
export const CODE_LEVELS: CodeLevel[] = [...PY_LEVELS, ...OS_LEVELS, ...C_LEVELS, ...EDA_CODE_LEVELS];
export const findCodeLevel = (id: string) => CODE_LEVELS.find((l) => l.id === id);

/** A stable seed per learner and mission, so a boss keeps its variant until the learner asks for a new one. */
export const instanceFor = (level: CodeLevel, seed: number) => level.build(rng(seed));

import { OOP_LEVELS } from './levels-oop';
import type { TbLevel } from './types';

export const TB_LEVELS: TbLevel[] = [...OOP_LEVELS];
export const findTbLevel = (id: string) => TB_LEVELS.find((l) => l.id === id);

import { OOP_LEVELS } from './levels-oop';
import { TB_ARCH_LEVELS } from './levels-tb';
import { UVM_LEVELS } from './levels-uvm';
import type { TbLevel } from './types';

export const TB_LEVELS: TbLevel[] = [...OOP_LEVELS, ...TB_ARCH_LEVELS, ...UVM_LEVELS];
export const findTbLevel = (id: string) => TB_LEVELS.find((l) => l.id === id);

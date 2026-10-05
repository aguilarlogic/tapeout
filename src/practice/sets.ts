// Every practice set and boss, gathered in curriculum order.
import { ARCH_BOSSES, ARCH_PRACTICE } from './arch';
import { CIRCUIT_BOSSES, CIRCUIT_PRACTICE } from './circuits';
import { DOMAIN_BOSSES, DOMAIN_PRACTICE } from './domains';
import { DIGITAL_BOSSES, DIGITAL_PRACTICE } from './digital';
import { FOUNDATION_BOSSES, FOUNDATION_PRACTICE } from './foundations';
import { FRONTIER_BOSSES, FRONTIER_PRACTICE } from './frontier';
import { MATH_BOSSES, MATH_PRACTICE } from './math';
import { SILICON_BOSSES, SILICON_PRACTICE } from './silicon';
import { SIGNAL_BOSSES, SIGNAL_PRACTICE } from './signals';
import { SPECIALTY_BOSSES, SPECIALTY_PRACTICE } from './specialty';
import { SYSTEMS_BOSSES, SYSTEMS_PRACTICE } from './systems';
import { TOOLING_BOSSES, TOOLING_PRACTICE } from './tooling';
import { VERIFICATION_BOSSES, VERIFICATION_PRACTICE } from './verification';
import { VLSI_BOSSES, VLSI_PRACTICE } from './vlsi';
import { makeCapstones } from './capstones';
import type { Boss, PracticeSet } from './types';

export const PRACTICE_LIST: PracticeSet[] = [...FOUNDATION_PRACTICE, ...CIRCUIT_PRACTICE, ...MATH_PRACTICE, ...SIGNAL_PRACTICE, ...TOOLING_PRACTICE, ...SYSTEMS_PRACTICE, ...DIGITAL_PRACTICE, ...VLSI_PRACTICE, ...VERIFICATION_PRACTICE, ...ARCH_PRACTICE, ...SPECIALTY_PRACTICE, ...SILICON_PRACTICE, ...DOMAIN_PRACTICE, ...FRONTIER_PRACTICE];
export const BOSSES_LIST: Boss[] = [...FOUNDATION_BOSSES, ...CIRCUIT_BOSSES, ...MATH_BOSSES, ...SIGNAL_BOSSES, ...TOOLING_BOSSES, ...SYSTEMS_BOSSES, ...DIGITAL_BOSSES, ...VLSI_BOSSES, ...VERIFICATION_BOSSES, ...ARCH_BOSSES, ...SPECIALTY_BOSSES, ...SILICON_BOSSES, ...DOMAIN_BOSSES, ...FRONTIER_BOSSES];
/** Role capstones are built from the practice sets above. */
export const CAPSTONE_LIST: Boss[] = makeCapstones(PRACTICE_LIST, BOSSES_LIST);
BOSSES_LIST.push(...CAPSTONE_LIST);

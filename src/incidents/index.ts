// Registry of incidents.
import { ARCH_INCIDENTS } from './archcore';
import { DIGITAL_INCIDENTS } from './digital';
import { FIRST_INCIDENTS } from './first';
import { FRONTIER_INCIDENTS } from './frontier';
import { IMPL_INCIDENTS } from './impl';
import { PATH_INCIDENTS } from './path';
import { SIGNAL_INCIDENTS } from './signals';
import { SILICON_INCIDENTS } from './silicon';
import { SYSTEM_INCIDENTS } from './systems';
import type { Incident } from './types';
import { VERIF_INCIDENTS } from './verif';

export const INCIDENTS: Incident[] = [...FIRST_INCIDENTS, ...DIGITAL_INCIDENTS, ...IMPL_INCIDENTS, ...VERIF_INCIDENTS, ...ARCH_INCIDENTS, ...PATH_INCIDENTS, ...SILICON_INCIDENTS, ...SIGNAL_INCIDENTS, ...SYSTEM_INCIDENTS, ...FRONTIER_INCIDENTS];
export const findIncident = (id: string) => INCIDENTS.find((i) => i.id === id);

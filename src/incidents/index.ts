// Registry of incidents.
import { FIRST_INCIDENTS } from './first';
import { FRONTIER_INCIDENTS } from './frontier';
import { SIGNAL_INCIDENTS } from './signals';
import { SILICON_INCIDENTS } from './silicon';
import { SYSTEM_INCIDENTS } from './systems';
import type { Incident } from './types';

export const INCIDENTS: Incident[] = [...FIRST_INCIDENTS, ...SILICON_INCIDENTS, ...SIGNAL_INCIDENTS, ...SYSTEM_INCIDENTS, ...FRONTIER_INCIDENTS];
export const findIncident = (id: string) => INCIDENTS.find((i) => i.id === id);

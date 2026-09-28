// Registry of incidents.
import { SIGNAL_INCIDENTS } from './signals';
import { SILICON_INCIDENTS } from './silicon';
import { SYSTEM_INCIDENTS } from './systems';
import type { Incident } from './types';

export const INCIDENTS: Incident[] = [...SILICON_INCIDENTS, ...SIGNAL_INCIDENTS, ...SYSTEM_INCIDENTS];
export const findIncident = (id: string) => INCIDENTS.find((i) => i.id === id);

// Integrity (health), energy, invulnerability after a hit, and out-of-combat repair (doc section 3).
import { VITALS } from '../tuning';

export interface Vitals {
  integrity: number;
  maxIntegrity: number;
  energy: number;
  maxEnergy: number;
  iFrames: number;
  sinceSpend: number; // steps since energy was last spent
  sinceHit: number; // steps since damage was last taken
}

export function createVitals(): Vitals {
  return { integrity: VITALS.integrity, maxIntegrity: VITALS.integrity, energy: VITALS.energy, maxEnergy: VITALS.energy, iFrames: 0, sinceSpend: 999, sinceHit: 999 };
}

/** Spend energy if there is enough; returns whether it was spent. */
export function spend(v: Vitals, amount: number): boolean {
  if (v.energy < amount) return false;
  v.energy -= amount;
  v.sinceSpend = 0;
  return true;
}

/** Take damage unless invulnerable. Returns whether it landed. */
export function hurt(v: Vitals, amount: number, invulnerable: boolean): boolean {
  if (invulnerable || v.iFrames > 0 || v.integrity <= 0) return false;
  v.integrity = Math.max(0, v.integrity - amount);
  v.iFrames = VITALS.iFrames;
  v.sinceHit = 0;
  return true;
}

export function tickVitals(v: Vitals) {
  v.iFrames = Math.max(0, v.iFrames - 1);
  v.sinceSpend++;
  v.sinceHit++;
  if (v.sinceSpend > VITALS.energyRegenDelay) v.energy = Math.min(v.maxEnergy, v.energy + VITALS.energyRegen);
  if (v.sinceHit > VITALS.repairDelay && v.integrity > 0) v.integrity = Math.min(v.maxIntegrity, v.integrity + VITALS.repairRate);
}

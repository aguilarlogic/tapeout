// The drone's upgrades (Phase 3 Spec, section 7). Each is earned by passing a module and is never stored: owned() reads
// today's records, so a player who finished a lab on the desktop has its part in the game too. Numbers are on this
// game's scale (Pulse Probe 10 damage at 7 shots/s, integrity 100).

export type UpgradeId =
  | 'overflow-jump' | 'inverted-grip' | 'nand-plating' | 'enable-lock' | 'selector' | 'fan-decoder' | 'full-adder'
  | 'comparator-sight' | 'wall-latch' | 'beam-toggle' | 'counter-fire' | 'alu-cannon' | 'power-cell';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  /** A major upgrade is a place's capstone; a minor one comes from any other module. */
  type: 'major' | 'minor';
  weapon?: boolean;
  /** Modules that grant it (NAND Plating: one plate each). */
  source: string[];
  /** The effect, one sentence, for the upgrade card. */
  effect: string;
  /** The Mk II: the practice banks that tune it, and what it adds. */
  mk2?: { banks: string[]; effect: string };
}

export const UPGRADES: Upgrade[] = [
  { id: 'overflow-jump', name: 'Overflow Jump', type: 'major', source: ['twos'], effect: 'Jump again in mid-air, once per jump.', mk2: { banks: ['practice-bits', 'practice-twos'], effect: 'A stronger second jump.' } },
  { id: 'inverted-grip', name: 'Inverted Grip', type: 'major', source: ['demorgan'], effect: 'The Field Coil can grab small bugs. A held bug is stunned, and a thrown one hits hard.', mk2: { banks: ['practice-bool'], effect: 'A wider field.' } },
  { id: 'nand-plating', name: 'NAND Plating', type: 'minor', source: ['logic-not', 'logic-and', 'logic-or', 'logic-xor', 'logic-latch'], effect: 'Two more points of hull.' },
  { id: 'enable-lock', name: 'Enable Lock', type: 'minor', source: ['logic-enable'], effect: 'Your gun folds away in quiet rooms, so a click never fires by mistake.' },
  { id: 'selector', name: 'Selector', type: 'minor', source: ['logic-mux'], effect: 'Switch weapons with Q, the mouse wheel, or the number keys.' },
  { id: 'fan-decoder', name: 'Fan Decoder', type: 'minor', weapon: true, source: ['logic-dec'], effect: 'A new weapon: three bolts in a fan.' },
  { id: 'full-adder', name: 'Full-Adder Coupling', type: 'minor', source: ['logic-full'], effect: 'The Pulse Probe hits for 12 instead of 10.' },
  { id: 'comparator-sight', name: 'Comparator Sight', type: 'major', source: ['logic-cmp'], effect: 'Hurt bugs show their health, and weak spots take extra damage.', mk2: { banks: ['practice-comb'], effect: 'Weak spots take even more.' } },
  { id: 'wall-latch', name: 'Wall Latch', type: 'minor', source: ['logic-dff'], effect: 'Cling to walls and jump off them.' },
  { id: 'beam-toggle', name: 'Beam Toggle', type: 'minor', source: ['logic-toggle'], effect: 'Press B to switch your lamp to a long beam that shows hidden things.' },
  { id: 'counter-fire', name: 'Counter Fire', type: 'major', source: ['logic-counter'], effect: 'Hits in a row speed up the Pulse Probe. A miss resets it.', mk2: { banks: ['practice-seq', 'practice-fsm'], effect: 'A higher top speed.' } },
  { id: 'alu-cannon', name: 'ALU Cannon', type: 'major', weapon: true, source: ['cpu-tiny'], effect: 'A new weapon: one heavy shot a second that knocks bugs back.', mk2: { banks: ['practice-verilog'], effect: 'Heavier shots.' } },
  { id: 'power-cell', name: 'Power Cell', type: 'minor', source: ['resistance'], effect: 'More energy for the Field Coil and the cannon.' },
];

/** The numbers each upgrade changes. */
export const UP = {
  doubleJump: 650, doubleJumpMk2: 780,
  gripMass: 3, fieldRadiusMk2: 108,
  plating: 2,
  fan: { bolts: 3, spreadDeg: 20, damage: 7, rate: 2.5, speed: 800, range: 480 },
  fullAdderDamage: 12,
  weakPoint: 1.5, weakPointMk2: 1.8,
  beam: { reach: 400, halfDeg: 25 },
  counter: { from: 7, to: 10, toMk2: 11, hits: 4 },
  cannon: { damage: 40, damageMk2: 48, rate: 1, speed: 700, range: 720, knock: 600, energy: 10 },
  energyMax: 125,
  /** Integrity: +5 per main-path boss after the Dark Demo Board, capped. */
  bossIntegrity: 5, integrityCap: 200,
} as const;

/** The upgrade a module grants, if any. */
export const upgradeFor = (module: string): Upgrade | undefined => UPGRADES.find((u) => u.source.includes(module));
export const upgradeById = (id: string): Upgrade | undefined => UPGRADES.find((u) => u.id === id);

/** Whether the drone has an upgrade (any of its sources done). */
export const owned = (id: UpgradeId, done: (id: string) => boolean): boolean => !!upgradeById(id)?.source.some(done);

/** Mk II state: banks done of total, online when all are done. Null for an upgrade without a Mk II. */
export function mk2(id: UpgradeId, done: (id: string) => boolean): { done: number; total: number; online: boolean } | null {
  const m = upgradeById(id)?.mk2;
  if (!m) return null;
  const n = m.banks.filter(done).length;
  return { done: n, total: m.banks.length, online: n === m.banks.length };
}

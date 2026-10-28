// The drone's upgrades (Phase 3 Spec, section 7). Each is earned by passing a module and is never stored: owned() reads
// today's records, so a player who finished a lab on the desktop has its part in the game too. Numbers are on this
// game's scale (Pulse Probe 10 damage at 7 shots/s, integrity 100).

export type UpgradeId =
  | 'overflow-jump' | 'inverted-grip' | 'nand-plating' | 'enable-lock' | 'selector' | 'fan-decoder' | 'full-adder'
  | 'comparator-sight' | 'wall-latch' | 'beam-toggle' | 'counter-fire' | 'alu-cannon' | 'power-cell'
  | 'loop-drone' | 'datapath-rail' | 'synchronizer' | 'pipeline-burst' | 'third-slot'
  | 'current-limiter' | 'phasor-curve' | 'integrator' | 'kickback-dash' | 'charged-probe' | 'gradient-compass'
  | 'matrix-throw' | 'damped-landing' | 'resonant-hover' | 'spectrum-visor' | 'gauss-field' | 'diode-plating'
  | 'gain-stage' | 'bias-plates';

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
  // Act 2, the Core (Phase 4 Spec, section 7)
  { id: 'loop-drone', name: 'Loop Drone', type: 'major', source: ['isa-boss-rec'], effect: 'A small helper drone circles you and shoots the nearest bug.', mk2: { banks: ['practice-asm'], effect: 'Its shots hit harder.' } },
  { id: 'datapath-rail', name: 'Datapath Rail', type: 'major', source: ['rv-boss'], effect: 'Press E at a bus rail to clip on and ride it fast.', mk2: { banks: ['practice-alu'], effect: 'Faster rides.' } },
  { id: 'synchronizer', name: 'Synchronizer', type: 'major', source: ['cdc-fifo'], effect: 'Press F to slow every bug to half speed for 3 seconds.', mk2: { banks: ['practice-clk'], effect: 'The slow lasts longer.' } },
  { id: 'pipeline-burst', name: 'Pipeline Burst', type: 'major', weapon: true, source: ['pipe-boss'], effect: 'A new weapon: four quick bolts in a row.', mk2: { banks: ['practice-pipe'], effect: 'Five bolts instead of four.' } },
  { id: 'third-slot', name: 'Third Slot', type: 'minor', source: ['code-boss-c-crc'], effect: 'Room for a third weapon on the Selector.' },
  // The Underlayers (Phase 5 Spec, section 7)
  { id: 'current-limiter', name: 'Current Limiter', type: 'minor', source: ['clab-mesh'], effect: 'You take a little less damage from every hit.' },
  { id: 'phasor-curve', name: 'Phasor Curve', type: 'minor', source: ['phasor'], effect: 'Charged shots curve toward a bug just off your aim.' },
  { id: 'integrator', name: 'Integrator', type: 'minor', source: ['integral'], effect: 'Energy refills faster while you stand still.' },
  { id: 'kickback-dash', name: 'Kickback Dash', type: 'major', source: ['clab-kickback'], effect: 'Your dash hits every bug it passes through, and recharges faster.' },
  { id: 'charged-probe', name: 'Charged Probe', type: 'major', weapon: true, source: ['clab-debounce'], effect: 'A new weapon: hold to charge a heavy shot that goes through bugs.' },
  { id: 'gradient-compass', name: 'Gradient Compass', type: 'minor', source: ['calc'], effect: 'An arrow at the edge of the screen points to the next thing to do.' },
  { id: 'matrix-throw', name: 'Matrix Throw', type: 'minor', source: ['linalg'], effect: 'Throws charge twice as fast and hit harder.' },
  { id: 'damped-landing', name: 'Damped Landing', type: 'major', source: ['clab-boss-ode'], effect: 'Hold down in the air to drop fast. You land with a ring that hits nearby bugs.' },
  { id: 'resonant-hover', name: 'Resonant Hover', type: 'major', source: ['clab-boss-ac'], effect: 'Hold jump while falling to float for a moment.' },
  { id: 'spectrum-visor', name: 'Spectrum Visor', type: 'minor', source: ['fourier'], effect: 'In a boss fight, a bar shows when the next attack comes.' },
  { id: 'gauss-field', name: 'Gauss Field', type: 'minor', source: ['em'], effect: 'The Field Coil reaches further and lifts heavier things.' },
  { id: 'diode-plating', name: 'Diode Plating', type: 'minor', source: ['clab-boss-ohm'], effect: 'Hits from behind do half damage.' },
  { id: 'gain-stage', name: 'Gain Stage', type: 'minor', source: ['clab-dac'], effect: 'Charged shots hit for 60 instead of 40.' },
  { id: 'bias-plates', name: 'Bias Plates', type: 'minor', source: ['clab-boss-bjt'], effect: 'Ten more points of hull.' },
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
  // --- act 2 (Phase 4 Spec, section 7) ---
  /** Loop Drone: orbit radius px, damage (Mk II), shots a second, reach px, bolt speed px/s. */
  loopDrone: { orbit: 60, damage: 4, damageMk2: 5, rate: 2, range: 400, speed: 900 },
  /** Datapath Rail: ride speed px/s (Mk II). */
  rail: { speed: 600, speedMk2: 720 },
  /** Synchronizer: enemies at this fraction of speed for s seconds (Mk II), its energy and cooldown. */
  sync: { scale: 0.5, s: 3, sMk2: 3.6, energy: 40, cooldownS: 12 },
  /** Pipeline Burst: bolts (Mk II) 80 ms apart, a 1.2 s cooldown, 10 damage each at 1000 px/s over 640 px, 12 energy. */
  burst: { bolts: 4, boltsMk2: 5, gapMs: 80, cooldownS: 1.2, damage: 10, speed: 1000, range: 640, energy: 12 },
  // --- the Underlayers (Phase 5 Spec, section 7) ---
  /** Current Limiter: damage taken × this, rounded, at least 1. */
  limiter: 0.9,
  /** Phasor Curve: cone half-angle (degrees) and turn rate (degrees/s) for charged shots. */
  phasor: { coneDeg: 30, turnDegS: 90 },
  /** Integrator: energy regen × this while grounded and under stillSpeed px/s. */
  integrator: { regen: 1.5, stillSpeed: 20 },
  /** Kickback Dash: damage to each enemy crossed, and the dash cooldown. */
  kickback: { damage: 12, cooldownMs: 700 },
  /** Matrix Throw: throw charge time (s) and thrown-prop damage multiplier. */
  matrixThrow: { chargeS: 0.4, damage: 1.5 },
  /** Damped Landing: drop speed px/s, ring radius px, damage, push px/s. */
  drop: { speed: 900, radius: 100, damage: 10, push: 300 },
  /** Resonant Hover: fall speed cap px/s, and seconds a hover lasts (once per airtime). */
  hover: { fall: 60, s: 1.2 },
  /** Gauss Field: Field Coil radius px and grab limit added. */
  gauss: { radius: 135, grab: 2 },
  /** Diode Plating: damage from behind × this. */
  diode: 0.5,
  /** Gain Stage: Charged Probe damage. */
  chargedDamage: 40, gainStageDamage: 60,
  /** Bias Plates: integrity added. */
  biasPlates: 10,
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

/** What act 1 and act 2's upgrades add to the drone, from records (the Director lays it over Level 1's kit). */
export interface ActKit {
  doubleJump: boolean;
  /** Double jump speed, px/s. */
  jump2: number;
  wallLatch: boolean;
  /** Weapons the Selector cycles; just the Pulse Probe before it. */
  weapons: ('pulse' | 'charged' | 'fan' | 'cannon' | 'burst')[];
  /** Weapon slots the HUD shows: 2, or 3 after the Firmware Pit (Phase 4 Spec, section 7: Q still cycles them all). */
  slots: 2 | 3;
  /** Pipeline Burst bolts a burst (0: not owned). */
  burstBolts: number;
  /** Loop Drone damage a bolt (0: not owned). */
  loopDrone: number;
  /** Datapath Rail ride speed, px/s (0: not owned). */
  rail: number;
  /** Synchronizer seconds (0: not owned). */
  sync: number;
  probeDamage: number;
  cannonDamage: number;
  /** Counter Fire's top rate, 0 when not owned. */
  counterTo: number;
  /** Comparator Sight's weak-point multiplier, 0 when not owned. */
  weak: number;
  /** Enable Lock: the gun folds away in quiet rooms. */
  holster: boolean;
  gripEnemies: boolean;
  fieldRadius: number | undefined;
  beam: boolean;
  energyMax: number;
  /** Integrity on top of Level 1's: +5 per later main-path boss, +2 per NAND plate, +10 Bias Plates. */
  integrityBonus: number;
  // --- the Underlayers (Phase 5 Spec, section 7); 0, 1 or false when not owned ---
  /** Damage taken × this (Current Limiter 0.9). */
  damageScale: number;
  /** Damage from behind × this (Diode Plating 0.5). */
  behindScale: number;
  /** Phasor Curve turn rate, degrees/s (0: off). */
  phasor: number;
  /** Energy regen × this when still (Integrator 1.5). */
  stillRegen: number;
  /** Kickback Dash damage to each enemy crossed (0: off). */
  dashHit: number;
  /** Dash cooldown, ms. */
  dashCooldownMs: number;
  /** Gradient Compass on. */
  compass: boolean;
  /** Throw charge seconds (0.8 before Matrix Throw). */
  throwChargeS: number;
  /** Thrown-prop damage × this (Matrix Throw 1.5). */
  throwDamage: number;
  /** Damped Landing on. */
  drop: boolean;
  /** Resonant Hover seconds (0: off). */
  hover: number;
  /** Spectrum Visor on. */
  visor: boolean;
  /** Grab limit added (Gauss Field 2). */
  grabBonus: number;
  /** Charged Probe damage (Gain Stage 60). */
  chargedDamage: number;
}

/**
 * The act 1 kit for a player with these records. `bosses` are the main-path incidents after the Dark Demo Board
 * (places.ts knows them; passed in to keep this module free of the curriculum).
 */
export function actKit(done: (id: string) => boolean, bosses: readonly string[]): ActKit {
  const has = (id: UpgradeId) => owned(id, done);
  const mk = (id: UpgradeId) => !!mk2(id, done)?.online;
  const plates = upgradeById('nand-plating')!.source.filter(done).length;
  return {
    doubleJump: has('overflow-jump'),
    jump2: mk('overflow-jump') ? UP.doubleJumpMk2 : UP.doubleJump,
    wallLatch: has('wall-latch'),
    // the Charged Probe is in the list as soon as it is owned (Level 1's Q swap); the rest need the Selector
    weapons: [
      'pulse', ...(has('charged-probe') ? ['charged' as const] : []),
      ...(has('selector') ? [...(has('fan-decoder') ? ['fan' as const] : []), ...(has('alu-cannon') ? ['cannon' as const] : []), ...(has('pipeline-burst') ? ['burst' as const] : [])] : []),
    ],
    slots: has('third-slot') ? 3 : 2,
    burstBolts: has('pipeline-burst') ? (mk('pipeline-burst') ? UP.burst.boltsMk2 : UP.burst.bolts) : 0,
    loopDrone: has('loop-drone') ? (mk('loop-drone') ? UP.loopDrone.damageMk2 : UP.loopDrone.damage) : 0,
    rail: has('datapath-rail') ? (mk('datapath-rail') ? UP.rail.speedMk2 : UP.rail.speed) : 0,
    sync: has('synchronizer') ? (mk('synchronizer') ? UP.sync.sMk2 : UP.sync.s) : 0,
    probeDamage: has('full-adder') ? UP.fullAdderDamage : 10,
    cannonDamage: mk('alu-cannon') ? UP.cannon.damageMk2 : UP.cannon.damage,
    counterTo: has('counter-fire') ? (mk('counter-fire') ? UP.counter.toMk2 : UP.counter.to) : 0,
    weak: has('comparator-sight') ? (mk('comparator-sight') ? UP.weakPointMk2 : UP.weakPoint) : 0,
    holster: has('enable-lock'),
    gripEnemies: has('inverted-grip'),
    fieldRadius: has('gauss-field') ? UP.gauss.radius : mk('inverted-grip') ? UP.fieldRadiusMk2 : undefined,
    beam: has('beam-toggle'),
    energyMax: has('power-cell') ? UP.energyMax : 100,
    integrityBonus: bosses.filter(done).length * UP.bossIntegrity + plates * UP.plating + (has('bias-plates') ? UP.biasPlates : 0),
    damageScale: has('current-limiter') ? UP.limiter : 1,
    behindScale: has('diode-plating') ? UP.diode : 1,
    phasor: has('phasor-curve') ? UP.phasor.turnDegS : 0,
    stillRegen: has('integrator') ? UP.integrator.regen : 1,
    dashHit: has('kickback-dash') ? UP.kickback.damage : 0,
    dashCooldownMs: has('kickback-dash') ? UP.kickback.cooldownMs : 1000,
    compass: has('gradient-compass'),
    throwChargeS: has('matrix-throw') ? UP.matrixThrow.chargeS : 0.8,
    throwDamage: has('matrix-throw') ? UP.matrixThrow.damage : 1,
    drop: has('damped-landing'),
    hover: has('resonant-hover') ? UP.hover.s : 0,
    visor: has('spectrum-visor'),
    grabBonus: has('gauss-field') ? UP.gauss.grab : 0,
    chargedDamage: has('gain-stage') ? UP.gainStageDamage : UP.chargedDamage,
  };
}

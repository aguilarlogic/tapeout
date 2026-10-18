// Every number the story game plays by, in one TUNING object, in the units the plans use (px, px/s, ms, s). Sources:
// the design doc (sections 3, 8, 9 and 10) and the Feel and Combat Plan (sections C to M, decisions 1-29), which
// overrides the doc where they differ. The F3 tuning panel edits TUNING.probe, .charged, .field, .camera and .feel live,
// so code reads those groups at the moment it uses them; the movement groups are converted once below (DRONE etc.).
// Change a number here only with a line in the plan's tuning log; never inline one of these values elsewhere.
export const HZ = 60;
export const STEP_MS = 1000 / HZ;
/** At most this many physics steps per animation frame; a longer stall is dropped, not caught up. */
export const MAX_STEPS = 5;

const ps = (pxPerSec: number) => pxPerSec / HZ; // px/s -> px/step
const ps2 = (pxPerSec2: number) => pxPerSec2 / (HZ * HZ); // px/s² -> px/step²
/** ms -> whole 60 Hz steps. */
export const frames = (ms: number) => Math.round((ms / 1000) * HZ);

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 40;

export const TUNING = {
  /** Movement (design doc section 3). Kept exactly by plan section A; not on the F3 panel. */
  move: {
    w: 36, h: 48, crouchH: 30, // the collision box (decision 2); the art is drawn inside it
    run: 240, crouchRun: 96, groundAccel: 1600, groundStop: 2400, airAccel: 960, airDrag: 480, momentumDecay: 600,
    gravity: 1800, jump: 780, shortHop: 0.45, fastFall: 1.6, fallCap: 1100, coyoteMs: 100, bufferMs: 120,
    doubleJump: 650, wallSlide: 120, wallSlideMaxMs: 1000, wallJumpOut: 360, wallJumpUp: 700, wallJumpLock: 8,
    dashDist: 240, dashMs: 150, dashCooldownMs: 1000, dashEnergy: 15, dashExit: 480, dropThrough: 12,
  },
  vitals: {
    health: 100, energy: 100, energyRegen: 20, energyRegenDelayMs: 500,
    iFramesMs: 600, blinkHz: 10, // plan D: 600 ms invulnerable flicker at 10 Hz
    repairRate: 10, repairDelayMs: 4000,
    deathMs: 1000, bootMs: 500, // plan D: the chassis drops over 1 s; decision 21: 0.5 s boot flicker
  },
  /** Pulse Probe (plan E). */
  probe: {
    rate: 7, // shots/s while held
    bufferMs: 100,
    speed: 1100, // px/s
    life: 0.7, // s
    spread: 1.5, // ± degrees
    damage: 10,
    trail: 6, // px
    aimLine: 120, // px, dotted
    shake: 1, // px per shot
    knock: 90, // px/s along the bolt (decision 6)
    knockHeavy: 30, // Latch
    propNudge: 40, // px/s ÷ mass when a bolt hits a prop
  },
  /** Charged Probe (design doc weapons table; decision 29: Q swaps to it). */
  charged: { chargeS: 0.8, damage: 40, pierce: 3, speed: 1100, range: 800, energy: 30 },
  /** Hit and kill feedback (plan E). */
  feel: {
    hitFlashMs: 60, sparks: 5, hitStopMs: 40, killShake: 3, killShakeMs: 120,
    fragmentS: 1.2, debrisS: 3, debrisMass: 0.5, debrisSize: 14,
    recoil: 4, recoilMs: 80, muzzleSteps: 2,
  },
  /** Field Coil (plan F, decisions 7-12). */
  field: {
    arc: 120, // degrees, toward the cursor
    radius: 90,
    drain: 12, // energy/s while on
    drainHold: 25, // energy/s while holding
    reengage: 10, // energy needed to switch on again after running dry
    pushSpeed: 500, pushCost: 15, pushCooldownMs: 300,
    reflect: 0.8,
    grabLimit: 3,
    holdDist: 60,
    stiffness: 0.2, damping: 0.1,
    chargeS: 0.8, throwMin: 600, throwBonus: 900,
    lean: 8, // degrees, while charging a throw
    throwDamage: 0.02, throwDamageMin: 300, propHitCooldownMs: 300,
    noDroneMs: 200,
  },
  /** Camera (plan I). */
  camera: { follow: 0.12, lookahead: 0.2, lookMax: 120, hurtShake: 6, hurtShakeMs: 200 },
  /** Props (plan G, decisions 13-16). */
  props: { crateK: 28, logicSize: 32, logicMass: 1 },
  /** Test enemies (plan H, decisions 17-20). Sizes are bounding widths in px. */
  glitch: { size: 18, hp: 30, patrol: 90, charge: 380, chargeRange: 300, chargeMs: 800, cooldownMs: 1000, touch: 15, mass: 2 },
  spark: { size: 22, hp: 40, period: 1.6, orbSpeed: 260, orbDamage: 10, range: 700, bob: 6, leash: 80, mass: 2 },
  latch: { size: 44, hp: 120, armor: 0.2, walk: 60, sight: 500, turnMs: 600, biteRange: 70, biteReach: 60, bite: 20, biteCooldownMs: 1200, touch: 10, mass: 8 },
  enemy: { telegraphMs: 400, respawnS: 5, stunMs: 150, knockDrone: 300 },
  /** Drone body art and animation (plan C and D). */
  anim: {
    chassisW: 34, chassisH: 26, eye: 9, pupil: 4, blinkMin: 4, blinkMax: 7, barrel: 18, emitter: 14, leg: 16,
    bob: 2, bobHz: 0.6, stride: 22, lean: 6, dustAt: 0.8, tuck: 0.4,
    squash: 0.85, squashMs: 120, landDust: 8,
    afterimages: 4, afterimageMs: 30, afterimageFadeMs: 150, dashStretch: 1.15,
    hurtFlashMs: 80,
    panelSparkMin: 1.5, panelSparkMax: 3, repairPulseMs: 400,
  },
};

export type Tuning = typeof TUNING;
/** The values the game shipped with, for the tuning panel's reset and "Copy values" diff. */
export const TUNING_DEFAULTS: Tuning = structuredClone(TUNING);

const M = TUNING.move, V = TUNING.vitals;
export const DRONE = {
  w: M.w,
  h: M.h,
  crouchH: M.crouchH,
  run: ps(M.run),
  crouchRun: ps(M.crouchRun),
  groundAccel: ps2(M.groundAccel), // 0 to full speed in 9 steps (0.15 s)
  groundStop: ps2(M.groundStop),
  airAccel: ps2(M.airAccel),
  /** With no input in the air, horizontal speed bleeds off at half the air acceleration (phase 1 builder default). */
  airDrag: ps2(M.airDrag),
  momentumDecay: ps2(M.momentumDecay), // speed above run speed decays at this rate, never clamped
  gravity: ps2(M.gravity),
  jump: ps(M.jump), // apex = jump² / (2 · gravity) = 169 px
  shortHop: M.shortHop,
  fastFall: M.fastFall,
  fallCap: ps(M.fallCap),
  coyote: frames(M.coyoteMs), // 6 steps
  buffer: frames(M.bufferMs), // 7 steps
  doubleJump: ps(M.doubleJump),
  wallSlide: ps(M.wallSlide),
  wallSlideMax: frames(M.wallSlideMaxMs),
  wallJumpOut: ps(M.wallJumpOut),
  wallJumpUp: ps(M.wallJumpUp),
  /** After a wall jump, input back toward that wall is ignored for 8 steps so the jump clears it. */
  wallJumpLock: M.wallJumpLock,
  dashDist: M.dashDist,
  dashSteps: frames(M.dashMs), // 9 steps
  dashCooldown: frames(M.dashCooldownMs),
  dashEnergy: M.dashEnergy,
  /** The dash leaves the drone moving at 480 px/s along the dash, which the momentum rule then decays. */
  dashExit: ps(M.dashExit),
  /** S + jump on a one-way platform ignores one-way platforms for this many steps. */
  dropThrough: M.dropThrough,
};

export const VITALS = {
  integrity: V.health,
  energy: V.energy,
  energyRegen: V.energyRegen / HZ,
  energyRegenDelay: frames(V.energyRegenDelayMs),
  iFrames: frames(V.iFramesMs), // 36 steps
  blinkHz: V.blinkHz,
  repairRate: V.repairRate / HZ,
  repairDelay: frames(V.repairDelayMs),
  deathSteps: frames(V.deathMs),
  bootSteps: frames(V.bootMs),
};

export const DAMAGE = { touch: 10, smallShot: 8, heavyShot: 15, hazard: 15, hazardKnock: ps(300), pit: 10 };

/** Phase 1 enemies, kept for phase 2 levels (decision 25); not in the test room. */
export const FLOATER = { hp: 20, speed: ps(60), flipMin: frames(1000), flipMax: frames(3000), radius: 18, mass: 10, leash: 160 };
export const SPIKE = {
  hp: 15,
  length: 160,
  warn: frames(400),
  visible: frames(1000),
  /** Hidden time between strikes (phase 1 builder default). */
  rest: frames(2000),
  damage: 10,
};
/** Test fixture: fires small shots at the drone. Kept for flat test rooms; the test room uses Sparks instead. */
export const EMITTER = { period: frames(1500), speed: ps(360) };

/** Crate side for a mass: 28 × √mass (decision 13), so mass 1, 2, 3, 5 give 28, 40, 48 and 63 px. */
export const crateSide = (mass: number) => Math.round(TUNING.props.crateK * Math.sqrt(mass));
/** Damage a prop deals hitting an enemy: 0.02 × mass × (relative speed − 300 px/s), never below 0 (plan F). */
export const propDamage = (mass: number, relPxPerSec: number) =>
  Math.max(0, TUNING.field.throwDamage * mass * (relPxPerSec - TUNING.field.throwDamageMin));
/** Throw speed in px/s for a charge 0..1 (plan F). */
export const throwSpeed = (charge: number) => TUNING.field.throwMin + TUNING.field.throwBonus * Math.max(0, Math.min(1, charge));

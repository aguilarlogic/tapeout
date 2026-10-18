// Every phase 1 number from the design doc (sections 3, 8, 9 and 10), converted once to the units the code uses.
// The game steps at a fixed 60 Hz, so speeds are px per step and accelerations px per step². Change a number here only
// with a line in the doc's tuning log; never inline one of these values elsewhere.
export const HZ = 60;
export const STEP_MS = 1000 / HZ;
/** At most this many physics steps per animation frame; a longer stall is dropped, not caught up. */
export const MAX_STEPS = 5;

const ps = (pxPerSec: number) => pxPerSec / HZ; // px/s -> px/step
const ps2 = (pxPerSec2: number) => pxPerSec2 / (HZ * HZ); // px/s² -> px/step²
const frames = (ms: number) => Math.round((ms / 1000) * HZ);

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 40;

export const DRONE = {
  w: 36,
  h: 48,
  crouchH: 30,
  run: ps(240),
  crouchRun: ps(96),
  groundAccel: ps2(1600), // 0 to full speed in 9 steps (0.15 s)
  groundStop: ps2(2400),
  airAccel: ps2(960),
  /** Not in the doc: with no input in the air, horizontal speed bleeds off at half the air acceleration, so a
   * released stick keeps most of a jump's momentum. Logged as a builder default in the PR. */
  airDrag: ps2(480),
  momentumDecay: ps2(600), // speed above run speed decays at this rate, never clamped
  gravity: ps2(1800),
  jump: ps(780), // apex = jump² / (2 · gravity) = 169 px
  shortHop: 0.45,
  fastFall: 1.6,
  fallCap: ps(1100),
  coyote: frames(100), // 6 steps
  buffer: frames(120), // 7 steps
  doubleJump: ps(650),
  wallSlide: ps(120),
  wallSlideMax: frames(1000),
  wallJumpOut: ps(360),
  wallJumpUp: ps(700),
  /** Not in the doc: after a wall jump, input back toward that wall is ignored for 8 steps so the jump clears it. */
  wallJumpLock: 8,
  dashDist: 240,
  dashSteps: frames(150), // 9 steps
  dashCooldown: frames(1000),
  dashEnergy: 15,
  /** Not in the doc: the dash leaves the drone moving at 480 px/s along the dash, which the momentum rule then decays. */
  dashExit: ps(480),
  /** S + jump on a one-way platform ignores one-way platforms for this many steps. */
  dropThrough: 12,
};

export const FIELD = {
  range: 120,
  /** Grab cone half-angle around the aim. Not in the doc beyond "in front of the aim"; 50° each side. */
  cone: (50 * Math.PI) / 180,
  maxMass: 40,
  holdCost: 5 / HZ, // energy per step
  throwSpeed: ps(900),
  holdDist: 64, // held object's centre, px from the drone's centre along the aim
  blockCost: 15,
  throwDamageMinSpeed: ps(300),
};
/** Thrown object damage: mass × speed (px/s) ÷ 1000. */
export const throwDamage = (mass: number, pxPerStep: number) => (mass * pxPerStep * HZ) / 1000;
/** Mass of a square block of side s px: 40 units at 80 px, scaling with area. */
export const blockMass = (side: number) => 40 * (side / 80) ** 2;

export const VITALS = {
  /** Test room only: the story's starting integrity (40) and its gains arrive with the level data in phase 2. */
  integrity: 100,
  energy: 100,
  energyRegen: 20 / HZ,
  energyRegenDelay: frames(500),
  iFrames: frames(750), // 45 steps
  blinkHz: 10,
  repairRate: 10 / HZ,
  repairDelay: frames(4000),
  deathSteps: frames(1200),
};

export const DAMAGE = { touch: 10, smallShot: 8, heavyShot: 15, hazard: 15, hazardKnock: ps(300), pit: 10 };

export const PROBE = { damage: 8, cooldown: frames(1000 / 3), speed: ps(900), range: 640 };

export const FLOATER = { hp: 20, speed: ps(60), flipMin: frames(1000), flipMax: frames(3000), radius: 18, mass: 10, leash: 160 };
export const SPIKE = {
  hp: 15,
  length: 160,
  warn: frames(400),
  visible: frames(1000),
  /** Not in the doc: hidden time between strikes. */
  rest: frames(2000),
  damage: 10,
};
/** Test fixture only (not an enemy): fires small shots so the Field Coil's bullet block can be felt in the test room. */
export const EMITTER = { period: frames(1500), speed: ps(360) };
export const ENEMY_SHOT_SPEED = ps(360);

export const CAMERA = { lookahead: 120, smoothing: 0.12, shakeMax: 6, shakeSteps: frames(200) };

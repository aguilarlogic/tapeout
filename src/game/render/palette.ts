// The game's colours and line widths (design doc section 9). Canvas code reads only these. Colour roles (polish bar
// P4): the player and the field are cyan, enemies magenta, interactables and props amber.
/** The colour names canvas code reads. */
export type PalKey = 'bgDeep' | 'bgFar' | 'line' | 'fill' | 'trace' | 'neon' | 'hostile' | 'ok' | 'x' | 'idle' | 'text' | 'amber' | 'gold';

/** Today's colours, never changed: the Standard palette. */
export const BASE_PAL: Readonly<Record<PalKey, string>> = Object.freeze({
  bgDeep: '#0B0A1A',
  bgFar: '#14122B',
  line: '#E8E6F5',
  fill: '#1B1838',
  trace: '#2EF2FF',
  neon: '#FF3EC8',
  hostile: '#FF4D5E',
  ok: '#3DFFA2',
  x: '#9B5CFF',
  idle: '#8A87A3',
  text: '#F4F3FF',
  amber: '#FF8A3D',
  gold: '#FFD23F',
});

/** The colour-blind safe palette (Phase 10 Spec, section 2.2): Okabe-Ito swaps for the six signal colours. */
export const OKABE_PAL: Readonly<Partial<Record<PalKey, string>>> = Object.freeze({
  trace: '#56B4E9', neon: '#CC79A7', hostile: '#D55E00', ok: '#009E73', amber: '#E69F00', gold: '#F0E442',
});

/** Which palette is in use. */
export type PaletteKind = 'standard' | 'okabe';

/** The live colours. applyPalette rewrites them in place, so always read PAL.x when drawing; never copy a colour into
 * a module-level const. */
export const PAL: Record<PalKey, string> = { ...BASE_PAL };

/** Switches the live colours to a palette (Phase 10 Spec, section 2.2). */
export function applyPalette(kind: PaletteKind): void {
  Object.assign(PAL, BASE_PAL, kind === 'okabe' ? OKABE_PAL : {});
}

/** Colour roles. Getters, so they follow the live palette. */
export const ROLE = {
  get player() { return PAL.trace; },
  get enemy() { return PAL.neon; },
  get prop() { return PAL.amber; },
  get danger() { return PAL.hostile; },
};

/** Text size (Phase 10 Spec, section 2.1): 1, 1.25 or 1.5. */
let scale = 1;
/** Sets the text size from the pref, in percent (100, 125 or 150). */
export function setTextSize(pct: number): void { scale = pct / 100; }
/** The text scale: 1, 1.25 or 1.5. */
export const textScale = (): number => scale;
/** A canvas font size scaled by the text size setting. */
export const px = (n: number): number => Math.round(n * scale);

/** Steady mode for blinks (Phase 10 Spec, section 2.9): on while Reduce flashes or reduced motion is on. */
let steady = false;
/** Turns steady blinking on or off. */
export function setSteadyBlink(on: boolean): void { steady = on; }
/** True while blinks are held steady. */
export const blinkSteady = (): boolean => steady;
/** Every blink and flicker in the game: 1 (shown) or 0 (hidden), a square wave at hz cycles per second at time t in
 * seconds. Steady mode always returns 1. */
export function blink(t: number, hz: number): 0 | 1 {
  if (steady) return 1;
  return Math.floor(t * hz * 2) % 2 === 0 ? 1 : 0;
}

export const LINE = { world: 2, drone: 2.5, droneGlow: 12, enemy: 2.5, enemyGlow: 10, shot: 3, shotGlow: 12, trace: 2, traceGlow: 10, traceDashSpeed: 60, hud: 1.5 };

export const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** `#RRGGBB` + alpha 0..1 → rgba(). */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export const easeOut = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
export const easeInOut = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };

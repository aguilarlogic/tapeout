// The game's colours and line widths (design doc section 9). Canvas code reads only these. Colour roles (polish bar
// P4): the player and the field are cyan, enemies magenta, interactables and props amber.
export const PAL = {
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
} as const;

/** Colour roles. */
export const ROLE = { player: PAL.trace, enemy: PAL.neon, prop: PAL.amber, danger: PAL.hostile } as const;

export const LINE = { world: 2, drone: 2.5, droneGlow: 12, enemy: 2.5, enemyGlow: 10, shot: 3, shotGlow: 12, trace: 2, traceGlow: 10, traceDashSpeed: 60, hud: 1.5 };

export const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** `#RRGGBB` + alpha 0..1 → rgba(). */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export const easeOut = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
export const easeInOut = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };

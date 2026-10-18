// The game's colours and line widths (doc section 10). Canvas code reads only these.
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
} as const;

export const LINE = { world: 2, drone: 3, droneGlow: 12, enemy: 2.5, enemyGlow: 8, shot: 3, shotGlow: 12, trace: 2, traceGlow: 10, traceDashSpeed: 60, hud: 1.5 };

export const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

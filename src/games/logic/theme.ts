// The Logic Lab's retrowave palette: a dark board with a faint grid, neon wires, and one accent colour per gate kind,
// matching TAPE-OS's desktop and terminal. The board stays dark in both themes, like the terminal. The colours live
// here (not only in CSS) so a test can check every text colour against its background for WCAG AA contrast.
import { Kind } from './circuit';

export const LAB = {
  bg: '#0b0618', // lab window background
  panel: '#140c2b', // goal strip, tray, table panel
  panel2: '#1e1240', // buttons, chips
  board: '#0d0720', // the board itself
  gridMinor: 'rgba(124, 92, 255, 0.10)',
  gridMajor: 'rgba(255, 79, 216, 0.16)',
  line: '#3a2a6b', // borders
  text: '#ece8ff', // body text
  dim: '#b4a9dd', // secondary text
  accent: '#5eead4', // neon teal: wires carrying 1, primary button
  accentInk: '#06221d', // text on the accent
  pink: '#ff4fd8',
  ok: '#4ade80',
  warn: '#fbbf24',
  err: '#fb7185',
  wire0: '#5b5f9e', // a wire carrying 0
  wireZ: '#4a3f70', // a wire with nothing driving it
} as const;

/** Each gate kind's accent: its outline and the colour of its name. */
export const KIND_COLOR: Record<Kind, string> = {
  IN: '#5eead4', OUT: '#fde68a', AND: '#22d3ee', OR: '#f472b6', NOT: '#fbbf24', XOR: '#a78bfa', NAND: '#2dd4bf',
  NOR: '#fb7185', DFF: '#a3e635', NMOS: '#38bdf8', PMOS: '#fb923c', VDD: '#f87171', GND: '#93c5fd',
};

const rgbOf = (c: string) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function mix(a: string, b: string, t: number): string {
  const A = rgbOf(a), B = rgbOf(b);
  return `#${A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
}

/** A gate body's fill: its accent mixed 14% into the board colour (the same mix the CSS uses). */
export const bodyFill = (k: Kind) => mix(KIND_COLOR[k], LAB.board, 0.14);

/** The pairs of text colour on background that the lab shows. Every one must reach 4.5:1. */
export const TEXT_PAIRS: [string, string, string][] = [
  ['body text on the lab', LAB.text, LAB.bg],
  ['body text on a panel', LAB.text, LAB.panel],
  ['secondary text on a panel', LAB.dim, LAB.panel],
  ['secondary text on a button', LAB.dim, LAB.panel2],
  ['button text', LAB.text, LAB.panel2],
  ['primary button text', LAB.accentInk, LAB.accent],
  ['board labels', LAB.text, LAB.board],
  ['board hints', LAB.dim, LAB.board],
  ['problem text', LAB.err, LAB.panel],
  ['pass text', LAB.ok, LAB.panel],
  ...(Object.keys(KIND_COLOR) as Kind[]).map((k): [string, string, string] => [`${k} name on its body`, KIND_COLOR[k], bodyFill(k)]),
];


/** WCAG 2 contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = rgbOf(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The palette as CSS custom properties, set on the lab's root element. */
export function themeStyle(): string {
  const vars = Object.entries(LAB).map(([k, v]) => `--lab-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`);
  return vars.join(';');
}

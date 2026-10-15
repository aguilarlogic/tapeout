// How Logic Lab parts look and what they say. Each part is a short list of shapes in its symbol box (60x40 for a
// gate), drawn twice that size on the board. Every part prints its name on its body; switches look like toggles and
// lamps like bulbs. The shapes are plain data, so tests can check every part's label without a browser.
import { GLOSSARY } from '../../glossary';
import { Kind, Part, PINS, V } from './circuit';
import { Box, Dir, K, pinOut, pinXY } from './board';

export interface Shape {
  t: 'path' | 'circle' | 'line' | 'rect' | 'text';
  a: Record<string, string | number>;
  /** The text of a 'text' shape. */
  text?: string;
}

/** The smallest label on any part body, in symbol units (twice that on the board). */
export const LABEL_MIN = 10;

/** The word printed on a part's body. Switches and lamps show their signal's name instead. */
export const KIND_NAME: Record<Kind, string> = {
  IN: 'switch', OUT: 'lamp', AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR', NAND: 'NAND', NOR: 'NOR', DFF: 'DFF',
  NMOS: 'NMOS', PMOS: 'PMOS', VDD: 'VDD', GND: 'GND',
};

export const vcls = (v: V) => (v === 1 ? 'v1' : v === 0 ? 'v0' : v === 'x' ? 'vx' : 'vz');

const T = (x: number, y: number, text: string, size: number, cls = 'lbl', anchor = 'middle'): Shape => ({ t: 'text', a: { x, y, class: cls, 'font-size': size, 'text-anchor': anchor }, text });
const P = (d: string, cls = 'body'): Shape => ({ t: 'path', a: { d, class: cls } });
const L = (x1: number, y1: number, x2: number, y2: number, cls: string): Shape => ({ t: 'line', a: { x1, y1, x2, y2, class: cls } });
const C = (cx: number, cy: number, r: number, cls: string): Shape => ({ t: 'circle', a: { cx, cy, r, class: cls } });

/** Text a little smaller for longer names, never under LABEL_MIN. */
const fit = (s: string, big: number) => Math.max(LABEL_MIN, s.length <= 2 ? big : s.length === 3 ? big - 2 : big - 3);

/**
 * The shapes for a part, in its symbol box. `value(pin)` colours the wire stubs; `on` is a switch's position.
 */
export function partShapes(p: Part, value: (pin: string) => V, on?: 0 | 1): Shape[] {
  const s: Shape[] = [];
  const stub = (x1: number, y1: number, x2: number, y2: number, pin: string) => s.push(L(x1, y1, x2, y2, `stub ${vcls(value(pin))}`));
  const two = () => { stub(0, 10, 12, 10, 'a'); stub(0, 30, 12, 30, 'b'); };
  const name = KIND_NAME[p.kind];
  switch (p.kind) {
    case 'AND': two(); s.push(P('M12,2 H32 A18,18 0 0 1 32,38 H12 Z'), T(29, 24.5, name, 12)); stub(50, 20, 60, 20, 'y'); break;
    case 'NAND': two(); s.push(P('M12,2 H28 A18,18 0 0 1 28,38 H12 Z'), C(50, 20, 4, 'body bubble'), T(28, 24, name, 10)); stub(54, 20, 60, 20, 'y'); break;
    case 'OR': two(); s.push(P('M10,2 Q30,2 50,20 Q30,38 10,38 Q20,20 10,2 Z'), T(30, 24.5, name, 12)); stub(50, 20, 60, 20, 'y'); break;
    case 'NOR': two(); s.push(P('M10,2 Q28,2 45,20 Q28,38 10,38 Q20,20 10,2 Z'), C(49, 20, 4, 'body bubble'), T(28.5, 24, name, 10)); stub(53, 20, 60, 20, 'y'); break;
    case 'XOR':
      two();
      s.push(P('M14,2 Q32,2 50,20 Q32,38 14,38 Q24,20 14,2 Z'), P('M8,2 Q18,20 8,38', 'body open'), T(33, 24.5, name, 11));
      stub(50, 20, 60, 20, 'y');
      break;
    case 'NOT': stub(0, 20, 10, 20, 'a'); s.push(P('M10,2 L46,20 L10,38 Z'), C(50, 20, 4, 'body bubble'), T(22, 24, name, 10)); stub(54, 20, 60, 20, 'y'); break;
    case 'DFF':
      stub(0, 20, 12, 20, 'd'); stub(48, 20, 60, 20, 'q');
      s.push(P('M12,2 H48 V48 H12 Z'), P('M12,36 L19,41 L12,46', 'body open'), T(30, 14, name, 10), T(17, 24, 'D', 8, 'pin-t', 'start'), T(43, 24, 'Q', 8, 'pin-t', 'end'));
      break;
    case 'NMOS': case 'PMOS': {
      const pm = p.kind === 'PMOS';
      const top = pm ? 's' : 'd', bot = pm ? 'd' : 's';
      stub(0, 30, pm ? 11 : 18, 30, 'g');
      if (pm) s.push(C(14, 30, 3.5, 'body bubble'));
      s.push(L(19, 14, 19, 46, 'body open'), L(25, 10, 25, 50, `chan ${vcls(value('g')) === (pm ? 'v0' : 'v1') ? 'on' : ''}`));
      stub(25, 14, 40, 14, top); stub(40, 14, 40, 0, top);
      stub(25, 46, 40, 46, bot); stub(40, 46, 40, 60, bot);
      s.push(T(38, 34, name, 10));
      break;
    }
    case 'VDD': stub(30, 30, 30, 12, 'y'); s.push(L(12, 12, 48, 12, 'body open rail1'), T(30, 8, name, 10)); break;
    case 'GND': stub(30, 0, 30, 12, 'y'); s.push(P('M18,12 H42 M22,18 H38 M27,24 H33', 'body open rail0'), T(0, 24, name, 10, 'lbl', 'start')); break;
    case 'IN': {
      const label = p.label ?? '';
      const lit = on ? ' on' : '';
      s.push(
        T(18, 25, label, fit(label, 16), 'io-name', 'end'),
        { t: 'rect', a: { x: 21, y: 8, width: 31, height: 24, rx: 12, class: `toggle${lit}` } },
        C(on ? 43 : 30, 20, 9, `tknob${lit}`),
        T(on ? 29 : 45.5, 22.5, on ? 'ON' : 'OFF', 6.5, `state${lit}`),
      );
      stub(52, 20, 60, 20, 'y');
      break;
    }
    case 'OUT': {
      const v = value('a');
      const label = p.label ?? '';
      stub(0, 20, 10, 20, 'a');
      s.push(
        C(24, 17, 17, `halo ${vcls(v)}`),
        C(24, 17, 11, `bulb ${vcls(v)}`),
        P('M19.5,20 L21.5,13 L24,19 L26.5,13 L28.5,20', `filament ${vcls(v)}`),
        { t: 'rect', a: { x: 19, y: 28, width: 10, height: 6, rx: 1.5, class: 'socket' } },
        T(40, 24.5, label, fit(label, 15), 'io-name', 'start'),
      );
      if (v === 'z') s.push(T(24, 39.5, 'not wired yet', 5.5, 'unwired'));
      break;
    }
  }
  return s;
}

/** The text a part shows as its name, as a player would read it (used by the tests and by screen readers). */
export function partLabel(p: Part): string {
  if (p.kind === 'IN') return `switch ${p.label ?? ''}`.trim();
  if (p.kind === 'OUT') return `lamp ${p.label ?? ''}`.trim();
  return KIND_NAME[p.kind];
}

// ---------------------------------------------------------------- one-line explanations

/** Which glossary sentence explains each gate (the glossary is TAPEOUT's `define` knowledge base). */
const FROM_GLOSSARY: Partial<Record<Kind, [string, RegExp]>> = {
  AND: ['and', /^AND says/], OR: ['or', /^OR says/], NOT: ['not', /^NOT flips/], XOR: ['xor', /^XOR says/],
  NAND: ['nand', /^NAND is/], NOR: ['nor', /NOR is/], DFF: ['flip-flop', /^A part that remembers/],
  NMOS: ['nmos', /NMOS conducts/], PMOS: ['pmos', /PMOS conducts/],
};

function glossarySentence(term: string, re: RegExp): string | undefined {
  const e = GLOSSARY.find((g) => g.terms.includes(term));
  return e?.def.split(/(?<=\.)\s+/).find((s) => re.test(s));
}

/** One plain line on what a part does, shown when the player taps it. */
export function partInfo(p: Part): string {
  switch (p.kind) {
    case 'IN': return `Switch ${p.label}: tap it to flip it between off (0) and on (1).`;
    case 'OUT': return `Lamp ${p.label}: it lights up when its wire carries a 1.`;
    case 'VDD': return 'VDD, the power rail: it always gives a 1.';
    case 'GND': return 'GND, ground: it always gives a 0.';
    default: {
      const g = FROM_GLOSSARY[p.kind];
      const line = g && glossarySentence(...g);
      return `${KIND_NAME[p.kind]}${p.kind === 'DFF' || p.kind === 'NMOS' || p.kind === 'PMOS' ? '' : ' gate'}: ${line ?? ''}`.trim();
    }
  }
}

// ---------------------------------------------------------------- touch targets

/** A pin's touch target is at least this many screen pixels across, the usual minimum for a finger. */
export const PIN_TARGET_PX = 44;
/** How far the target reaches into the part's body; the rest of it sits outside, where the wire leaves. */
const INWARD_PX = 12;
/** The visible pin dot is at least this many screen pixels across. */
export const PIN_DOT_PX = 12;

/** A pin's touch target on the board at a given zoom (`scale` is screen pixels per board unit). */
export function pinHitBox(p: Part, pin: string, scale: number): Box {
  const [x, y] = pinXY(p, pin);
  const size = PIN_TARGET_PX / scale, inward = INWARD_PX / scale, half = size / 2;
  const d: Dir = pinOut(p.kind, pin);
  if (d === 'L') return { x: x - (size - inward), y: y - half, w: size, h: size };
  if (d === 'R') return { x: x - inward, y: y - half, w: size, h: size };
  if (d === 'U') return { x: x - half, y: y - (size - inward), w: size, h: size };
  return { x: x - half, y: y - inward, w: size, h: size };
}

/** The pin whose touch target holds the point, nearest first. `ok` filters which pins count (valid wire ends). */
export function hitPin(parts: Part[], wx: number, wy: number, scale: number, ok: (ref: string) => boolean = () => true, reach = 1): string | undefined {
  let best: string | undefined, bd = Infinity;
  for (const p of parts) {
    for (const d of PINS[p.kind]) {
      const ref = `${p.id}.${d.name}`;
      if (!ok(ref)) continue;
      const b = pinHitBox(p, d.name, scale / reach);
      if (wx < b.x || wx > b.x + b.w || wy < b.y || wy > b.y + b.h) continue;
      const [px, py] = pinXY(p, d.name);
      const dist = Math.hypot(wx - px, wy - py);
      if (dist < bd) { bd = dist; best = ref; }
    }
  }
  return best;
}

/** Board units for a screen-constant pin dot radius. */
export const pinDotR = (scale: number) => Math.max(PIN_DOT_PX / 2 / scale, 3 * K);

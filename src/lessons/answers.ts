// Answer checkers for terminal questions. Each checker carries a canonical answer (shown when the
// player gives up) and a forgiving parser: engineers write 0x1F, 8'h1F, 31, 4.7k, 1.6 kHz...

export interface Answer {
  canonical: string;
  check(input: string): boolean;
}

const clean = (s: string) => s.trim().toLowerCase().replace(/[\s_]/g, '');

/** Parse an integer in any common notation: 42, 0x2A, 0b101010, 8'h2A, 'd42, -5. */
export function parseInteger(input: string, defaultBase = 10): number | null {
  let s = clean(input);
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  let base = defaultBase;
  const v = s.match(/^(\d*)'s?([bodh])(.+)$/);
  if (v) {
    base = { b: 2, o: 8, d: 10, h: 16 }[v[2] as 'b' | 'o' | 'd' | 'h'];
    s = v[3];
  } else if (s.startsWith('0x')) { base = 16; s = s.slice(2); }
  else if (s.startsWith('0b')) { base = 2; s = s.slice(2); }
  else if (s.endsWith('h') && base === 16) s = s.slice(0, -1);
  const digits = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/ }[base];
  if (!digits || !digits.test(s)) return null;
  const n = parseInt(s, base);
  return neg ? -n : n;
}

const SI: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9 };
const UNIT_ALIASES: Record<string, string[]> = {
  'Ω': ['ω', 'ohm', 'ohms', 'r'],
  V: ['v', 'volt', 'volts'],
  A: ['a', 'amp', 'amps'],
  W: ['w', 'watt', 'watts'],
  F: ['f', 'farad', 'farads'],
  Hz: ['hz', 'hertz'],
  s: ['s', 'sec', 'secs', 'second', 'seconds'],
  '%': ['%', 'percent'],
  x: ['x', 'times'],
  C: ['c', 'coulomb', 'coulombs'],
  J: ['j', 'joule', 'joules'],
  S: ['s', 'siemens'],
  m: ['m', 'meter', 'meters', 'metre', 'metres'],
  K: ['k', 'kelvin'],
  '°C': ['°c', 'c', 'degc', 'deg', 'degrees'],
  '': [''],
};

/** Split a display unit like "ns", "kHz", "Ω" into (multiplier, base unit). */
function splitUnit(unit: string): [number, string] {
  if (unit in UNIT_ALIASES) return [1, unit];
  const p = unit[0];
  if (p in SI && unit.slice(1) in UNIT_ALIASES) return [SI[p], unit.slice(1)];
  return [1, unit];
}

/**
 * Parse a physical quantity and return it in `unit`: parseQuantity("4.7k", "Ω") = 4700,
 * parseQuantity("2500ps", "ns") = 2.5, parseQuantity("1.6 kHz", "Hz") = 1600. A bare number is taken to be
 * in `unit` already. Returns null if the text isn't a number or names a different unit.
 */
export function parseQuantity(input: string, unit = ''): number | null {
  const s = input.trim().replace(/,/g, '').replace(/\s+/g, '')
    .replace(/^(-?\d*\.?\d+)[x×*]10\^/, '$1e').replace(/^10\^/, '1e');
  const m = s.match(/^(-?\d*\.?\d+(?:e[-+]?\d+)?)(.*)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const rest = m[2];
  if (rest === '') return n;
  const [mult, base] = splitUnit(unit);
  const aliases = UNIT_ALIASES[base] ?? [base.toLowerCase()];
  for (const pre of Object.keys(SI)) {
    if (!rest.startsWith(pre)) continue;
    const u = rest.slice(pre.length).toLowerCase();
    if (!aliases.includes(u) && u !== '') continue;
    let k = SI[pre];
    if (pre === 'm' && base === 'Hz') k = 1e6; // nobody means millihertz
    return (n * k) / mult;
  }
  return null;
}

/** Integer answer; accepts any base notation. */
export function num(value: number): Answer {
  return { canonical: String(value), check: (s) => parseInteger(s) === value };
}

/** Binary answer. Leading zeros and 0b / n'b prefixes are fine. */
export function bin(value: number, width = 0): Answer {
  const canonical = value.toString(2).padStart(width, '0');
  return {
    canonical,
    check: (s) => {
      const c = clean(s);
      if (/^\d+'[dh]|^0x/.test(c)) return false;
      return parseInteger(c, 2) === value;
    },
  };
}

/** Hex answer. 0x / n'h prefixes and a trailing h are fine. */
export function hexa(value: number, width = 0): Answer {
  const canonical = value.toString(16).toUpperCase().padStart(width, '0');
  return {
    canonical,
    check: (s) => {
      const c = clean(s);
      if (/^[0-9a-f]+h?$/.test(c)) return parseInt(c.replace(/h$/, ''), 16) === value; // bare hex digits, even "0b"
      if (/^\d*'[bd]|^0b/.test(c)) return false;
      return parseInteger(c, 16) === value;
    },
  };
}

/** "10000000 Hz" reads better as "10 MHz": add an SI prefix to very large or small values of a base unit. */
function withPrefix(value: number, unit: string): string {
  const a = Math.abs(value);
  const base = ['Ω', 'V', 'A', 'W', 'F', 'Hz', 's', 'C', 'J', 'S'].includes(unit);
  if (!base || a === 0 || (a >= 0.1 && a < 1e4)) return `${+value.toPrecision(3)} ${unit}`.trim();
  const [k, p] = a >= 1e9 ? [1e-9, 'G'] : a >= 1e6 ? [1e-6, 'M'] : a >= 1e3 ? [1e-3, 'k'] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : a >= 1e-9 ? [1e9, 'n'] : [1e12, 'p'];
  return `${+(value * k).toPrecision(3)} ${p}${unit}`;
}

/** Real-valued answer in `unit`, with relative tolerance. SI prefixes and unit spellings are accepted. */
export function qty(value: number, unit: string, tol = 0.03, display?: string): Answer {
  return {
    canonical: display ?? withPrefix(value, unit),
    check: (s) => {
      const v = parseQuantity(s, unit);
      if (v === null) return false;
      if (value === 0) return Math.abs(v) < 1e-9;
      return Math.abs(v - value) / Math.abs(value) <= tol;
    },
  };
}

/** Free-text answer: any of the alternatives, ignoring case, spaces and punctuation. */
export function words(...alts: string[]): Answer {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9|&^~!+*()'=]/g, '');
  const set = alts.map(norm);
  return { canonical: alts[0], check: (s) => set.includes(norm(s)) };
}

/** Boolean-expression answer: checked by truth table, so any equivalent form passes. */
export function expr(canonical: string, vars: string[], fn: (v: Record<string, boolean>) => boolean): Answer {
  return {
    canonical,
    check: (s) => {
      const f = compileBool(s, vars);
      if (!f) return false;
      for (let m = 0; m < 1 << vars.length; m++) {
        const env: Record<string, boolean> = {};
        vars.forEach((v, i) => (env[v] = !!((m >> (vars.length - 1 - i)) & 1)));
        if (f(env) !== fn(env)) return false;
      }
      return true;
    },
  };
}

/**
 * Compile a boolean expression written the way people type them:
 * a&b, a*b, ab (adjacent single letters), a|b, a+b, ~a, !a, a', a^b, parentheses, 0/1.
 * Multi-character names (cin, s2, a0) are matched longest-first.
 */
export function compileBool(src: string, vars: string[]): ((env: Record<string, boolean>) => boolean) | null {
  const names = [...vars].sort((x, y) => y.length - x.length);
  const s = src.replace(/\s+/g, '').toLowerCase().replace(/\band\b/g, '&').replace(/\bor\b/g, '|').replace(/\bnot\b/g, '!');
  let i = 0;
  const peek = () => s[i];
  type F = (e: Record<string, boolean>) => boolean;
  const parseOr = (): F | null => {
    let l = parseXor();
    while (l && (peek() === '|' || peek() === '+')) {
      i++;
      const r = parseXor();
      if (!r) return null;
      const a = l;
      l = (e) => a(e) || r(e);
    }
    return l;
  };
  const parseXor = (): F | null => {
    let l = parseAnd();
    while (l && peek() === '^') {
      i++;
      const r = parseAnd();
      if (!r) return null;
      const a = l;
      l = (e) => a(e) !== r(e);
    }
    return l;
  };
  const startsAtom = (c: string | undefined) => c !== undefined && (/[a-z01(!~]/.test(c));
  const parseAnd = (): F | null => {
    let l = parseUnary();
    while (l && (peek() === '&' || peek() === '*' || peek() === '.' || startsAtom(peek()))) {
      if (!startsAtom(peek())) i++;
      const r = parseUnary();
      if (!r) return null;
      const a = l;
      l = (e) => a(e) && r(e);
    }
    return l;
  };
  const parseUnary = (): F | null => {
    if (peek() === '!' || peek() === '~') {
      i++;
      const x = parseUnary();
      return x ? (e) => !x(e) : null;
    }
    let base: F | null = null;
    const c = peek();
    if (c === '(') {
      i++;
      base = parseOr();
      if (peek() !== ')') return null;
      i++;
    } else if (c === '0' || c === '1') {
      i++;
      const k = c === '1';
      base = () => k;
    } else {
      const v = names.find((n) => s.startsWith(n, i));
      if (!v) return null;
      i += v.length;
      base = (e) => e[v];
    }
    while (peek() === "'") {
      i++;
      const b = base!;
      base = (e) => !b(e);
    }
    return base;
  };
  const f = parseOr();
  return f && i === s.length ? f : null;
}

/**
 * Regular-expression answer: the player's pattern must match every string in `pos` and none in `neg`.
 * Accepts bare patterns (`0x[0-9a-f]+`) or slash-delimited ones with flags (`/error/i`).
 */
export function rx(canonical: string, pos: string[], neg: string[]): Answer {
  const compile = (s: string): RegExp | null => {
    const t = s.trim();
    if (!t) return null;
    const m = t.match(/^\/(.*)\/([gimsuy]*)$/);
    try {
      return m ? new RegExp(m[1], m[2].replace('g', '')) : new RegExp(t);
    } catch {
      return null;
    }
  };
  return {
    canonical,
    check: (s) => {
      const re = compile(s);
      return !!re && pos.every((p) => re.test(p)) && neg.every((n) => !re.test(n));
    },
  };
}

/** Free-text answer that must contain every one of the required tokens (in any order), ignoring case and spacing. */
export function has(canonical: string, ...tokens: string[][]): Answer {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return {
    canonical,
    check: (s) => {
      const v = norm(s);
      return !!v && tokens.every((alts) => alts.some((a) => v.includes(norm(a))));
    },
  };
}

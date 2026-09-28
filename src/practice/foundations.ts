// Practice banks and bosses for Act 1: numbers, circuits, CMOS basics.
import { bin, expr, hexa, num, qty } from '../lessons/answers';
import { ask, between, mc, pick } from '../lessons/types';
import { boss, practice, tier } from './types';

const hex = (n: number, w = 2) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');
const eng = (x: number, unit: string) => {
  const a = Math.abs(x);
  const [k, p] = a >= 1e6 ? [1e-6, 'M'] : a >= 1e3 ? [1e-3, 'k'] : a >= 1 || a === 0 ? [1, ''] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : a >= 1e-9 ? [1e9, 'n'] : [1e12, 'p'];
  return `${+(x * k).toPrecision(3)} ${p}${unit}`;
};
const pow2 = (n: number) => (n ? n.toString(2).split('').reverse().map((b, i) => (b === '1' ? 2 ** i : 0)).filter(Boolean).reverse().join(' + ') : 'no powers of two at all');
const toSigned = (v: number, w: number) => (v >= 2 ** (w - 1) ? v - 2 ** w : v);

export const bitsPractice = practice('practice-bits', 'Bit Drills', 'binary, hex, bit manipulation', [
  (r, d) => {
    const n = between(r, 0, tier(d, 15, 255, 4095));
    return ask(`Write ${n} in binary.`, bin(n), `${n} = ${pow2(n)} = ${n.toString(2)}₂.`, 'Subtract the largest power of two that fits, repeatedly.');
  },
  (r, d) => {
    const n = between(r, tier(d, 1, 16, 256), tier(d, 15, 255, 4095));
    return ask(`What is ${n.toString(2)}₂ in decimal?`, num(n), `${n.toString(2)}₂ = ${pow2(n)} = ${n}.`, 'Add up the powers of two where the bits are 1.');
  },
  (r, d) => {
    const n = between(r, 0, tier(d, 255, 0xffff, 0xffffff));
    return ask(`Write ${n} in hexadecimal.`, hexa(n), `${n} = ${hex(n, 1)}: each hex digit is 4 bits (${n.toString(2).padStart(Math.ceil(Math.max(1, n.toString(2).length) / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1_')}).`, 'Divide by 16 repeatedly, or go through binary 4 bits at a time.');
  },
  (r, d) => {
    const n = between(r, 1, tier(d, 0xff, 0xfff, 0xffff));
    return ask(`Write ${hex(n, 1)} in binary.`, bin(n), `Each hex digit is 4 bits: ${n.toString(2).padStart(Math.ceil(n.toString(2).length / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1_')}.`, 'Expand each hex digit into 4 bits.');
  },
  (r, d) => {
    const n = tier(d, between(r, 3, 40), between(r, 50, 1000), between(r, 1000, 1_000_000));
    const b = Math.ceil(Math.log2(n));
    return ask(`What is the minimum number of bits needed to give ${n} different items a unique code?`, num(b), `2^${b} = ${2 ** b} ≥ ${n} but 2^${b - 1} = ${2 ** (b - 1)} is not enough, so ${b} bits (ceil(log2 ${n})).`, 'Find the smallest k with 2^k ≥ n.');
  },
  (r, d) => {
    const a = between(r, 0, 255), b = between(r, 0, 255);
    const [op, f] = pick(r, [['&', (x: number, y: number) => x & y], ['|', (x: number, y: number) => x | y], ['^', (x: number, y: number) => x ^ y]] as const);
    if (d === 1) return ask(`${hex(a)} ${op} ${hex(b)} = ? (hex)`, hexa(f(a, b), 2), `${a.toString(2).padStart(8, '0')} ${op} ${b.toString(2).padStart(8, '0')} = ${f(a, b).toString(2).padStart(8, '0')} = ${hex(f(a, b))}.`, 'Work bit by bit in binary.');
    const s = between(r, 1, 4);
    const [sop, g] = pick(r, [['<<', (x: number) => (x << s) & 0xff], ['>>', (x: number) => x >> s]] as const);
    const v = g(f(a, b));
    if (d === 2) return ask(`For 8-bit values: (${hex(a)} ${op} ${hex(b)}) ${sop} ${s} = ? (hex, keep 8 bits)`, hexa(v, 2), `${hex(a)} ${op} ${hex(b)} = ${hex(f(a, b))}; shifted ${sop === '<<' ? 'left' : 'right'} by ${s} and kept to 8 bits: ${hex(v)}.`, 'Do the bitwise operation first, then the shift, then drop bits above bit 7.');
    const lo = between(r, 0, 5), w = between(r, 2, 4), x = between(r, 0, 0xffff);
    const field = (x >> lo) & ((1 << w) - 1);
    return ask(`Register value ${hex(x, 4)}. Extract the ${w}-bit field at bits [${lo + w - 1}:${lo}]. Value in decimal?`, num(field), `(${hex(x, 4)} >> ${lo}) & ${hex((1 << w) - 1, 1)} = ${field}. Shift the field down to bit 0, then mask off everything above it: the bread and butter of firmware and testbench code.`, 'Shift right by the low bit index, then AND with a mask of w ones.');
  },
  (r, d) => {
    const w = tier(d, 8, 16, 32);
    const bit = between(r, 0, w - 1);
    const [act, expr2] = pick(r, [['set', `x | (1 << ${bit})`], ['clear', `x & ~(1 << ${bit})`], ['toggle', `x ^ (1 << ${bit})`]] as const);
    const m = 2 ** bit;
    return ask(`What is the mask (in hex) you would use to ${act} bit ${bit} of a ${w}-bit register? (the operation is \`${expr2}\`)`, hexa(act === 'clear' ? (2 ** w - 1) - m : m), `1 << ${bit} = ${hex(m, 1)}${act === 'clear' ? `; clearing ANDs with its complement, ${hex(2 ** w - 1 - m, w / 4)}` : ''}.`, act === 'clear' ? 'The complement of 1 << bit, within the register width.' : '1 shifted left by the bit index.');
  },
]);

export const twosPractice = practice('practice-twos', 'Signed Number Drills', "two's complement, overflow, sign extension", [
  (r, d) => {
    const w = tier(d, 4, 8, 16);
    const v = -between(r, 1, 2 ** (w - 1));
    const enc = 2 ** w + v;
    return w === 4
      ? ask(`Write ${v} as a 4-bit two's complement number (binary).`, bin(enc, 4), `Invert ${(-v).toString(2).padStart(4, '0')} and add 1: ${enc.toString(2).padStart(4, '0')}.`, 'Write the positive value, invert every bit, add 1.')
      : ask(`Write ${v} as a ${w}-bit two's complement number, in hex.`, hexa(enc, w / 4), `2^${w} ${v} = ${enc} = ${hex(enc, w / 4)}.`, `Add 2^${w} to the negative number.`);
  },
  (r, d) => {
    const w = tier(d, 4, 8, 16);
    const enc = between(r, 2 ** (w - 1), 2 ** w - 1);
    const q = w === 4 ? enc.toString(2).padStart(4, '0') + '₂' : hex(enc, w / 4);
    return ask(`${q} is a ${w}-bit two's complement value. What is it in decimal?`, num(enc - 2 ** w), `The top bit is set, so it is negative: ${enc} - 2^${w} = ${enc - 2 ** w}.`, `If the top bit is 1, subtract 2^${w}.`);
  },
  (r, d) => {
    const w = tier(d, 4, 8, pick(r, [12, 16, 32]));
    const lo = pick(r, [true, false]);
    return ask(`What is the ${lo ? 'most negative' : 'largest positive'} value of a ${w}-bit signed (two's complement) integer?`, num(lo ? -(2 ** (w - 1)) : 2 ** (w - 1) - 1), `An n-bit signed range is -2^(n-1) .. 2^(n-1) - 1: ${-(2 ** (w - 1))} .. ${2 ** (w - 1) - 1}.`, '-2^(n-1) to 2^(n-1) - 1.');
  },
  (r, d) => {
    const w = 8;
    const a = between(r, tier(d, 20, 60, 90), 127) * (d === 3 && r() < 0.5 ? -1 : 1);
    const b = between(r, tier(d, 20, 60, 90), 127) * (a < 0 ? -1 : 1);
    const raw = (a + b + 512) % 256;
    const res = toSigned(raw, w);
    return ask(`8-bit signed addition: ${a} + ${b}. What value does the 8-bit result hold (as signed decimal)?`, num(res), `The true sum ${a + b} ${a + b > 127 || a + b < -128 ? `does not fit in -128..127, so it wraps to ${res}: signed overflow. Two operands of the same sign gave a result of the other sign.` : `fits, so the result is ${res}.`}`, 'Compute the true sum; if it is outside -128..127, add or subtract 256.');
  },
  (r, d) => {
    const from = tier(d, 4, 8, 8), to = tier(d, 8, 16, 32);
    const v = between(r, 2 ** (from - 1), 2 ** from - 1);
    const ext = v + (2 ** to - 2 ** from);
    return ask(`Sign-extend the ${from}-bit value ${hex(v, from / 4)} to ${to} bits. Answer in hex.`, hexa(ext, to / 4), `The sign bit is 1, so the new upper bits are all 1s: ${hex(ext, to / 4)}. The value (${toSigned(v, from)}) is unchanged.`, 'Copy the top bit into every new bit.');
  },
  (r, d) => {
    const w = tier(d, 8, 8, 16);
    const v = between(r, 1, 2 ** (w - 1) - 1);
    const s = between(r, 1, 3);
    const neg = -v;
    const ar = Math.floor(neg / 2 ** s);
    return d < 3
      ? ask(`In Verilog, \`-${v}\` stored in an 8-bit signed reg, then arithmetic-shifted right by ${s} (\`>>> ${s}\`). What signed value results?`, num(ar), `Arithmetic right shift copies the sign bit in, which divides by 2^${s} rounding toward minus infinity: floor(${neg} / ${2 ** s}) = ${ar}.`, 'An arithmetic shift is floor division by a power of two.')
      : ask(`A 16-bit signed \`-${v}\` is shifted with a **logical** right shift (\`>> ${s}\`). What is the result as an unsigned hex value?`, hexa(((2 ** 16 + neg) >>> s) & 0xffff, 4), `Logical shift fills with zeros, so the sign is lost: ${hex(2 ** 16 + neg, 4)} >> ${s} = ${hex(((2 ** 16 + neg) >>> s) & 0xffff, 4)}. Mixing >> and >>> on signed data is a classic RTL bug.`, 'Take the 16-bit pattern and shift zeros in from the top.');
  },
]);

export const boolPractice = practice('practice-bool', 'Boolean Drills', 'truth tables, De Morgan, minterms', [
  (r, d) => {
    const cases = [
      ['output is 1 when exactly one of a and b is 1', ['a', 'b'], (v: Record<string, boolean>) => v.a !== v.b, 'a ^ b'],
      ['output is 1 when both a and b are 0', ['a', 'b'], (v: Record<string, boolean>) => !v.a && !v.b, '~(a | b)'],
      ['output is 1 when a and b are equal', ['a', 'b'], (v: Record<string, boolean>) => v.a === v.b, '~(a ^ b)'],
      ['output is 1 when at least two of a, b, c are 1 (majority)', ['a', 'b', 'c'], (v: Record<string, boolean>) => +v.a + +v.b + +v.c >= 2, 'a&b | a&c | b&c'],
      ['output is a when s is 0 and b when s is 1 (a mux)', ['a', 'b', 's'], (v: Record<string, boolean>) => (v.s ? v.b : v.a), '~s&a | s&b'],
      ['output is 1 when an odd number of a, b, c are 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => (+v.a + +v.b + +v.c) % 2 === 1, 'a ^ b ^ c'],
      ['output is 1 when a is 1 and neither b nor c is 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => v.a && !v.b && !v.c, 'a & ~b & ~c'],
      ['output is 1 when the 2-bit number {a,b} is greater than the 1-bit number c', ['a', 'b', 'c'], (v: Record<string, boolean>) => 2 * +v.a + +v.b > +v.c, 'a | b&~c'],
    ] as const;
    const [desc, vars, f, canon] = pick(r, d === 1 ? cases.slice(0, 3) : d === 2 ? cases.slice(3, 6) : cases.slice(5));
    return ask(`Write a boolean expression (use & | ^ ~ or a b' notation) for: ${desc}.`, expr(canon, [...vars], f), `One answer: ${canon}. Any equivalent expression is accepted, because I check it against the full truth table.`, 'Write the truth table first, then OR together the rows where the output is 1.');
  },
  (r, d) => {
    const vars = tier(d, ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']);
    const n = vars.length;
    const ms = Array.from({ length: 2 ** n }, (_, i) => i).filter(() => r() < 0.45);
    if (!ms.length) ms.push(between(r, 0, 2 ** n - 1));
    if (ms.length === 2 ** n) ms.pop();
    const f = (v: Record<string, boolean>) => ms.includes(vars.reduce((acc, x) => acc * 2 + +v[x], 0));
    const canon = ms.map((m) => vars.map((x, i) => ((m >> (n - 1 - i)) & 1 ? x : `~${x}`)).join('&')).join(' | ');
    return ask(`f(${vars.join(',')}) = Σm(${ms.join(', ')}), with ${vars[0]} as the most significant bit. Write any expression for f.`, expr(canon, vars, f), `A sum of the minterms works: ${canon}. A K-map would simplify it, and any equivalent form is accepted.`, `Minterm m${ms[0]} is the row where ${vars.join('')} = ${ms[0].toString(2).padStart(n, '0')}.`);
  },
  (r, d) => {
    const forms = [
      ['~(a & b)', '~a | ~b', ['a', 'b'], (v: Record<string, boolean>) => !v.a || !v.b],
      ['~(a | b | c)', '~a & ~b & ~c', ['a', 'b', 'c'], (v: Record<string, boolean>) => !v.a && !v.b && !v.c],
      ['~(a & b | c)', '(~a | ~b) & ~c', ['a', 'b', 'c'], (v: Record<string, boolean>) => !((v.a && v.b) || v.c)],
      ['~((a | b) & (c | d))', '~a & ~b | ~c & ~d', ['a', 'b', 'c', 'd'], (v: Record<string, boolean>) => !((v.a || v.b) && (v.c || v.d))],
    ] as const;
    const [e, canon, vars, f] = forms[Math.min(forms.length - 1, d - 1 + (r() < 0.5 ? 0 : 1))];
    const inner = expr(canon, [...vars], f);
    return ask(`Push the inversion all the way down to the variables with De Morgan's laws: ${e}. (Your answer may only put ~ directly on variables.)`, { canonical: canon, check: (s) => !/[~!]\s*\(|\)\s*'/.test(s) && inner.check(s) }, `One answer: ${canon}. De Morgan: ~(x & y) = ~x | ~y and ~(x | y) = ~x & ~y, applied level by level.`, 'Flip & to | (and back) as the ~ moves inward.');
  },
  (_r, d) => {
    const n = tier(d, 2, 3, 4);
    return ask(`How many different boolean functions of ${n} inputs are there?`, qty(2 ** 2 ** n, '', 0.001, String(2 ** 2 ** n)), `A truth table has 2^${n} = ${2 ** n} rows, and each can be 0 or 1: 2^${2 ** n} = ${2 ** 2 ** n} functions.`, 'Count the rows, then the ways to fill the output column.');
  },
]);

export const ohmPractice = practice('practice-ohm', 'Circuit Arithmetic', "Ohm's law, power, series/parallel, dividers", [
  (r, d) => {
    const R = pick(r, tier(d, [100, 1000, 10000], [220, 470, 4700, 33000], [330, 680, 2200, 15000]));
    const I = pick(r, tier(d, [0.001, 0.01], [0.002, 0.005, 0.02], [0.0015, 0.0025, 0.012]));
    const which = d === 1 ? 0 : between(r, 0, 2);
    if (which === 0) return ask(`${eng(I, 'A')} flows through ${eng(R, 'Ω')}. What is the voltage across it, in V?`, qty(I * R, 'V'), `V = I × R = ${eng(I * R, 'V')}.`, 'V = I × R.');
    if (which === 1) return ask(`${eng(I * R, 'V')} is across ${eng(R, 'Ω')}. What current flows, in mA?`, qty(I * 1000, 'mA'), `I = V / R = ${eng(I, 'A')}.`, 'I = V / R.');
    return ask(`${eng(I * R, 'V')} across ${eng(R, 'Ω')}. How much power does the resistor dissipate, in mW?`, qty(I * I * R * 1000, 'mW'), `P = V² / R = ${eng(I * I * R, 'W')}.`, 'P = V²/R = I²R.');
  },
  (r, d) => {
    const rs = Array.from({ length: tier(d, 2, 3, 3) }, () => pick(r, [1000, 2200, 4700, 10000, 3300, 6800]));
    const par = d >= 2 && r() < 0.6 || d === 1 && r() < 0.5;
    const eq = par ? 1 / rs.reduce((a, x) => a + 1 / x, 0) : rs.reduce((a, x) => a + x, 0);
    if (d === 3 && !par) {
      const a = rs[0], b = rs[1], c = rs[2];
      const v = a + (b * c) / (b + c);
      return ask(`${eng(a, 'Ω')} in series with (${eng(b, 'Ω')} ∥ ${eng(c, 'Ω')}). Total resistance, in kΩ?`, qty(v / 1000, 'kΩ'), `${eng(b, 'Ω')} ∥ ${eng(c, 'Ω')} = ${eng((b * c) / (b + c), 'Ω')}; plus ${eng(a, 'Ω')} = ${eng(v, 'Ω')}.`, 'Parallel pair first: product over sum.');
    }
    return ask(`${rs.map((x) => eng(x, 'Ω')).join(par ? ' ∥ ' : ' + ')}: equivalent resistance, in kΩ?`, qty(eq / 1000, 'kΩ'), par ? `1/R = ${rs.map((x) => `1/${eng(x, 'Ω')}`).join(' + ')}, so R = ${eng(eq, 'Ω')}. Parallel is always smaller than the smallest.` : `Series resistances add: ${eng(eq, 'Ω')}.`, par ? '1/R = sum of 1/Ri.' : 'Series: add them.');
  },
  (r, d) => {
    const vin = pick(r, [3.3, 5, 12, 1.8]);
    const r1 = pick(r, [1000, 2200, 4700, 10000]), r2 = pick(r, [1000, 3300, 4700, 10000]);
    if (d <= 2) {
      const load = d === 2 ? pick(r, [10000, 4700]) : 0;
      const r2e = load ? (r2 * load) / (r2 + load) : r2;
      const v = (vin * r2e) / (r1 + r2e);
      return ask(`A divider: ${vin} V → R1 = ${eng(r1, 'Ω')} → out → R2 = ${eng(r2, 'Ω')} → ground${load ? `, with a ${eng(load, 'Ω')} load on the output` : ''}. Vout in V?`, qty(v, 'V'), load ? `The load is in parallel with R2: ${eng(r2e, 'Ω')}. Vout = ${vin} × ${eng(r2e, 'Ω')} / (${eng(r1, 'Ω')} + ${eng(r2e, 'Ω')}) = ${v.toFixed(3)} V. Loads pull dividers down: that is why references are buffered.` : `Vout = Vin × R2/(R1 + R2) = ${v.toFixed(3)} V.`, 'Vout = Vin × R2 / (R1 + R2).');
    }
    const target = pick(r, [1.2, 0.9, 2.5, 1.0].filter((x) => x < vin));
    const rr2 = (r1 * target) / (vin - target);
    return ask(`Design: make ${target} V from ${vin} V with R1 = ${eng(r1, 'Ω')} on top. What R2 do you need, in kΩ?`, qty(rr2 / 1000, 'kΩ', 0.02), `R2 = R1 × Vout/(Vin - Vout) = ${eng(r1, 'Ω')} × ${target}/${+(vin - target).toFixed(2)} = ${eng(rr2, 'Ω')}. In practice you would pick the nearest standard (E24/E96) value.`, 'Solve Vout = Vin·R2/(R1+R2) for R2.');
  },
  (r, d) => {
    const vs = pick(r, [3.3, 5]);
    const vf = pick(r, [1.8, 2.0, 2.1]);
    const i = pick(r, tier(d, [0.01, 0.02], [0.005, 0.015], [0.002, 0.008]));
    const R = (vs - vf) / i;
    return ask(`An LED drops ${vf} V at ${i * 1000} mA. It is driven from a ${vs} V pin. What series resistor do you need, in Ω?`, qty(R, 'Ω', 0.02), `R = (${vs} - ${vf}) / ${i} = ${R.toFixed(0)} Ω. It dissipates ${eng((vs - vf) * i, 'W')}.`, 'The resistor takes whatever voltage the LED does not.');
  },
]);

export const rcPractice = practice('practice-rc', 'RC Drills', 'time constants, charging, cutoff frequency, energy', [
  (r) => {
    const R = pick(r, [1e3, 4.7e3, 10e3, 100e3]), C = pick(r, [1e-9, 10e-9, 100e-9, 1e-6]);
    return ask(`R = ${eng(R, 'Ω')}, C = ${eng(C, 'F')}. What is τ, in µs?`, qty(R * C * 1e6, 'us'), `τ = RC = ${eng(R * C, 's')}.`, 'τ = R × C.');
  },
  (r, d) => {
    const tau = pick(r, [1, 2, 5, 10]);
    const frac = pick(r, tier(d, [63.2, 86.5, 95], [50, 90, 99], [75, 99.9, 30]));
    const t = -tau * Math.log(1 - frac / 100);
    return ask(`An RC with τ = ${tau} µs charges from 0 toward its supply. How long until it reaches ${frac}% of the final value, in µs?`, qty(t, 'us', 0.02), `v(t) = V(1 - e^(-t/τ)) → t = -τ·ln(1 - ${frac / 100}) = ${t.toFixed(2)} µs.`, 't = -τ ln(1 - fraction).');
  },
  (r, d) => {
    const V = pick(r, [1, 3.3, 5]);
    const tau = pick(r, [1, 2, 10]);
    const t = pick(r, tier(d, [tau, 2 * tau], [0.5 * tau, 3 * tau], [0.3 * tau, 1.7 * tau]));
    const discharge = d >= 2 && r() < 0.5;
    const v = discharge ? V * Math.exp(-t / tau) : V * (1 - Math.exp(-t / tau));
    return ask(`A ${V} V RC circuit (τ = ${tau} ms) ${discharge ? 'discharges from' : 'charges from 0 toward'} ${V} V. What is the capacitor voltage after ${+t.toFixed(2)} ms, in V?`, qty(v, 'V', 0.02), discharge ? `v = ${V}·e^(-${+t.toFixed(2)}/${tau}) = ${v.toFixed(3)} V.` : `v = ${V}(1 - e^(-${+t.toFixed(2)}/${tau})) = ${v.toFixed(3)} V.`, discharge ? 'v = V e^(-t/τ).' : 'v = V (1 - e^(-t/τ)).');
  },
  (r, d) => {
    const R = pick(r, [1e3, 1.6e3, 10e3, 50]), C = pick(r, [1e-9, 100e-9, 1e-6, 10e-12]);
    const f = 1 / (2 * Math.PI * R * C);
    if (d < 3) return ask(`RC low-pass with R = ${eng(R, 'Ω')} and C = ${eng(C, 'F')}. What is the -3 dB cutoff frequency?`, qty(f, 'Hz'), `f = 1/(2πRC) = ${eng(f, 'Hz')}.`, 'f = 1 / (2πRC).');
    const fc = pick(r, [1e3, 10e3, 100e3]);
    const c2 = 1 / (2 * Math.PI * R * fc);
    return ask(`You need a ${eng(fc, 'Hz')} cutoff and R is fixed at ${eng(R, 'Ω')}. What C do you need, in nF?`, qty(c2 * 1e9, 'nF', 0.02), `C = 1/(2π·R·f) = ${eng(c2, 'F')}.`, 'Rearrange f = 1/(2πRC).');
  },
  (r, d) => {
    const C = pick(r, [1e-6, 10e-6, 100e-6, 1e-12]), V = pick(r, [1, 3.3, 5, 12]);
    const which = d === 1 ? 0 : between(r, 0, 1);
    if (which === 0) return ask(`How much charge is on ${eng(C, 'F')} at ${V} V, in coulombs? (scientific notation is fine, e.g. 3.3e-6)`, qty(C * V, ''), `Q = CV = ${(C * V).toExponential(3)} C.`, 'Q = C × V.');
    const E = 0.5 * C * V * V;
    return ask(`How much energy is stored in ${eng(C, 'F')} at ${V} V, in joules?`, qty(E, ''), `E = ½CV² = ${E.toExponential(3)} J. Charging a gate's capacitance from a supply also burns an equal ½CV² in the pull-up, so each full charge/discharge cycle costs CV²: the root of the dynamic power formula.`, 'E = ½ C V².');
  },
]);

export const mosPractice = practice('practice-mos', 'Transistor Drills', 'NMOS/PMOS switching, CMOS gates, transistor counts', [
  (r, d) => {
    const n = tier(d, between(r, 2, 3), between(r, 3, 4), between(r, 4, 6));
    const g = pick(r, ['NAND', 'NOR']);
    return ask(`How many transistors does a static CMOS ${n}-input ${g} gate need?`, num(2 * n), `One NMOS and one PMOS per input: ${2 * n}. The ${g === 'NAND' ? 'NMOS in series, PMOS in parallel' : 'NMOS in parallel, PMOS in series'}.`, 'Each input drives one NMOS and one PMOS.');
  },
  (r) => {
    const g = pick(r, ['NAND', 'NOR']);
    const net = pick(r, ['pull-down (NMOS)', 'pull-up (PMOS)']);
    const series = (g === 'NAND') === net.startsWith('pull-down');
    return mc(`In a CMOS ${g} gate, how are the transistors of the ${net} network connected?`, ['In series', 'In parallel'], series ? 0 : 1, `${g}: output low only when ${g === 'NAND' ? 'all inputs are 1 (series NMOS)' : 'any input is 1 (parallel NMOS)'}; the PMOS network is always the dual.`);
  },
  (r, d) => {
    const g = pick(r, d === 1 ? ['AND', 'OR'] : ['AND', 'OR', 'XOR', 'AOI21', 'OAI21', 'MUX2']);
    const counts: Record<string, [number, string]> = { AND: [6, 'NAND2 (4) + inverter (2)'], OR: [6, 'NOR2 (4) + inverter (2)'], XOR: [12, 'a common static CMOS XOR2 uses 12 (transmission-gate designs use fewer)'], AOI21: [6, 'one complex gate: 3 NMOS + 3 PMOS'], OAI21: [6, 'one complex gate: 3 NMOS + 3 PMOS'], MUX2: [12, 'AOI22 (8) + an inverter on select (2) + output inverter (2)'] };
    const [n, why] = counts[g];
    return ask(`Minimum transistor count for a static CMOS ${g}${g === 'XOR' ? ' (standard complementary design)' : g === 'MUX2' ? ' built as AOI22 plus inverters' : ''}?`, num(n), `${n}: ${why}. CMOS gates are naturally inverting, which is why AOI/OAI cells are so efficient.`, 'Build the inverting version, then add inverters where needed.');
  },
  (r, d) => {
    const vdd = pick(r, [0.8, 1.0, 1.2, 1.8]);
    const vt = pick(r, [0.3, 0.4]);
    const typ = pick(r, ['NMOS', 'PMOS']);
    const vg = +(between(r, 0, 10) / 10 * vdd).toFixed(2);
    const vs = typ === 'NMOS' ? 0 : vdd;
    const on = typ === 'NMOS' ? vg - vs > vt : vs - vg > vt;
    return mc(`${typ}, source at ${vs} V, |Vt| = ${vt} V, gate at ${vg} V (Vdd = ${vdd}). Is the channel on?`, ['On', 'Off'], on ? 0 : 1, `${typ === 'NMOS' ? `Vgs = ${+(vg - vs).toFixed(2)} V` : `Vsg = ${+(vs - vg).toFixed(2)} V`} ${on ? '>' : '≤'} ${vt} V, so it is ${on ? 'on' : 'off (only subthreshold leakage flows)'}.${d === 3 ? ' In between, the transistor is partially on: that is where both networks conduct and short-circuit current flows.' : ''}`);
  },
]);

export const FOUNDATION_PRACTICE = [bitsPractice, twosPractice, boolPractice, ohmPractice, rcPractice, mosPractice];

// ------------------------------------------------------------------ bosses

export const numbersBoss = boss({
  id: 'boss-numbers',
  title: 'The Register Map',
  concept: 'bits, hex, signed values and fields, all at once',
  xp: 150,
  steps: [
    { t: 'say', text: 'Boss fight, {name}. A firmware engineer pings you at 6 pm: their driver reads garbage from a sensor chip. The register map is below. No hints: this is what the job looks like.', mood: 'thinking' },
    { t: 'art', text: `  STATUS  @0x04   [15]    ready\n                  [14:12] mode\n                  [11:0]  temperature, signed 12-bit, 1 LSB = 0.0625 °C\n  CTRL    @0x08   [7]     enable   [3:0] gain` },
    { t: 'gen', make: (r) => { const t = -between(r, 5, 40) * 16; const raw = 0x8000 | (3 << 12) | ((t + 4096) & 0xfff); return ask(`STATUS reads ${hex(raw, 4)}. What is the \`mode\` field, in decimal?`, num(3), `(${hex(raw, 4)} >> 12) & 0x7 = 3.`); } },
    { t: 'gen', make: (r) => { const deg = -between(r, 5, 40); const t = deg * 16; const raw = 0x8000 | (3 << 12) | ((t + 4096) & 0xfff); return ask(`Same STATUS = ${hex(raw, 4)}. What temperature does it report, in °C?`, qty(deg, '°C', 0.001, String(deg)), `Field [11:0] = ${hex((t + 4096) & 0xfff, 3)}. Top bit set, so it is negative: ${((t + 4096) & 0xfff)} - 4096 = ${t}. × 0.0625 = ${deg} °C. The driver bug was reading it as unsigned.`); } },
    { t: 'gen', make: (r) => { const g = between(r, 1, 15); return ask(`Write CTRL to enable the sensor with gain ${g}, leaving other bits 0. What hex value do you write?`, hexa(0x80 | g, 2), `enable is bit 7 (0x80), gain goes in [3:0]: 0x80 | ${g} = ${hex(0x80 | g)}.`); } },
    { t: 'gen', make: (r) => { const v = between(r, 0x80, 0xff); return ask(`Later CTRL reads ${hex(v)}. Firmware must clear **only** the enable bit. Which 8-bit mask does it AND with (hex)?`, hexa(0x7f, 2), `~0x80 within 8 bits = 0x7F. ${hex(v)} & 0x7F = ${hex(v & 0x7f)}: read-modify-write keeps the gain.`); } },
    { t: 'gen', make: (r) => { const n = between(r, 3000, 60000); return ask(`The sensor streams ${n} samples per second, 12 bits each, packed with no padding. How many bytes per second is that?`, num(Math.ceil((n * 12) / 8)), `${n} × 12 / 8 = ${Math.ceil((n * 12) / 8)} bytes/s.`); } },
    { t: 'mc', q: 'A 12-bit temperature is sign-extended into a 16-bit register for software. Which is right for 0xF80 (12-bit)?', options: ['0x0F80', '0xFF80', '0x8F80', '0xF800'], a: 1, why: 'Copy the sign bit (1) into bits 15:12: 0xFF80, still -128 LSBs.' },
  ],
  recap: ['Fields: shift down, mask off.', 'Signed fields need sign handling.', 'Read-modify-write with masks.'],
});

export const circuitsBoss = boss({
  id: 'boss-circuits1',
  title: 'The Sensor Front End',
  concept: 'dividers, loading, RC filtering and power in one design',
  xp: 150,
  steps: [
    { t: 'say', text: 'Boss fight. You are designing the input of a battery monitor. A 12 V battery must be read by a 3.3 V ADC, and the reading must be filtered. Show me the numbers.', mood: 'thinking' },
    { t: 'gen', make: (r) => { const r1 = pick(r, [100e3, 47e3, 220e3]); const r2 = (r1 * 3.0) / (12 - 3.0); return ask(`Full scale should be 3.0 V when the battery reads 12 V. With R1 = ${eng(r1, 'Ω')} on top, what R2 (kΩ)?`, qty(r2 / 1000, 'kΩ', 0.02), `R2 = R1 × 3/(12 - 3) = ${eng(r2, 'Ω')}.`); } },
    { t: 'gen', make: (r) => { const r1 = pick(r, [100e3, 47e3]); const r2 = r1 / 3; const i = 12 / (r1 + r2); return ask(`R1 = ${eng(r1, 'Ω')}, R2 = ${eng(r2, 'Ω')}. How much current does the divider draw from the battery, in µA?`, qty(i * 1e6, 'uA'), `12 / ${eng(r1 + r2, 'Ω')} = ${(i * 1e6).toFixed(1)} µA, forever. On a battery product that matters: this is why dividers get big resistors, or a switch to turn them off.`); } },
    { t: 'gen', make: (r) => { const r1 = 100e3, r2 = 33e3; const rin = pick(r, [100e3, 50e3]); const r2e = (r2 * rin) / (r2 + rin); const v = (12 * r2e) / (r1 + r2e); return ask(`R1 = 100 kΩ, R2 = 33 kΩ, but the ADC input looks like ${eng(rin, 'Ω')} to ground. At 12 V, what voltage does the ADC actually see?`, qty(v, 'V', 0.02), `R2 ∥ R_in = ${eng(r2e, 'Ω')}, so Vout = 12 × ${eng(r2e, 'Ω')}/(100k + ${eng(r2e, 'Ω')}) = ${v.toFixed(2)} V instead of 2.98 V: a big gain error. Buffer it or use much smaller resistors.`); } },
    { t: 'gen', make: (r) => { const rth = pick(r, [25e3, 33e3]); const fc = pick(r, [10, 100]); const c = 1 / (2 * Math.PI * rth * fc); return ask(`The divider's Thevenin resistance is ${eng(rth, 'Ω')}. You add a capacitor to ground for a ${fc} Hz low-pass. What C, in nF?`, qty(c * 1e9, 'nF', 0.02), `C = 1/(2π × ${eng(rth, 'Ω')} × ${fc}) = ${eng(c, 'F')}. The source resistance of a divider is R1 ∥ R2: exactly the R in the filter.`); } },
    { t: 'gen', make: (r) => { const tau = pick(r, [1, 5, 16]); return ask(`After power-up, the filtered node needs to settle within 0.1% before the first reading. With τ = ${tau} ms, how long must firmware wait, in ms?`, qty(tau * Math.log(1000), 'ms', 0.03), `ln(1000) ≈ 6.9 τ = ${(tau * Math.log(1000)).toFixed(1)} ms.`); } },
    { t: 'mc', q: 'The ADC samples by briefly connecting a 10 pF capacitor. Why does a big filter capacitor on the input help?', options: ['It raises the input voltage', 'It acts as a charge reservoir, so the sampling cap is charged from it instead of through the 25 kΩ source, avoiding a sampling error', 'It lowers the noise of the ADC reference', 'It does not help'], a: 1, why: 'Charge sharing: a 100 nF reservoir barely moves when a 10 pF sampler connects. Without it, the high source impedance could not recharge the sampler in time.' },
  ],
  recap: ['Divider design + loading + Thevenin resistance + RC settling.'],
});

export const FOUNDATION_BOSSES = [numbersBoss, circuitsBoss];

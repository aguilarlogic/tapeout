// Practice banks and bosses for Act 1: numbers, circuits, CMOS basics.
import { bin, expr, hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, show, sim, step, walk, type Part } from '../lessons/teach';
import { ask, between, mc, pick } from '../lessons/types';
import { boss, practice, tier } from './types';
import { choose, eng, hex, pow2, sig, toSigned } from './util';

/** Binary digits grouped in fours, e.g. 1010_0011. */
const nibbles = (n: number, bits?: number) => {
  const b = n.toString(2);
  return b.padStart(bits ?? Math.ceil(b.length / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1_');
};

/** The powers-of-two method, step by step: the largest power that fits, subtract, repeat. */
function powersBeats(n: number): Part[] {
  if (n === 0) return ['0 contains no powers of two at all, so every bit is 0.', step('So 0 in binary is:', bin(0))];
  const top = Math.floor(Math.log2(n));
  const beats: Part[] = [show(Array.from({ length: top + 1 }, (_, i) => top - i).map((k) => `2^${k} = ${2 ** k}`).join('   '), 'the powers of two up to your number')];
  let rest = n, shown = 0;
  while (rest > 0 && shown < 4) {
    const p = 2 ** Math.floor(Math.log2(rest));
    beats.push(count(`What is the largest power of two that fits in ${rest}? Then ${rest} - that power leaves the rest.`, `largest power ≤ ${rest}`, p));
    rest -= p; shown++;
  }
  if (rest > 0) beats.push(`Keep going the same way: ${rest} = ${pow2(rest)}.`);
  beats.push(`So ${n} = ${pow2(n)}. Now write a 1 under each power you used and a 0 under each one you did not, from 2^${top} down to 2^0.`);
  beats.push(step(`Write ${n} in binary:`, bin(n)));
  return beats;
}

export const bitsPractice = practice('practice-bits', 'Bit Drills', 'binary, hex, bit manipulation', [
  (r, d) => {
    const n = between(r, 0, tier(d, 15, 255, 4095));
    return walk(ask(`Write ${n} in binary.`, bin(n), `${n} = ${pow2(n)} = ${n.toString(2)}₂.`, 'Subtract the largest power of two that fits, repeatedly.'),
      'powers of two', 'Each binary digit stands for a power of two: 1, 2, 4, 8, 16, 32... A 1 means "this power is included". So to write a number in binary, split it into powers of two, biggest first.',
      ...powersBeats(n));
  },
  (r, d) => {
    const n = between(r, tier(d, 1, 16, 256), tier(d, 15, 255, 4095));
    const b = n.toString(2), used = b.split('').map((c, i) => (c === '1' ? 2 ** (b.length - 1 - i) : 0)).filter(Boolean);
    return walk(ask(`What is ${b}₂ in decimal?`, num(n), `${b}₂ = ${pow2(n)} = ${n}.`, 'Add up the powers of two where the bits are 1.'),
      'place values', 'Binary is just like decimal, but each place is worth twice the one to its right instead of ten times: 1, 2, 4, 8, 16... from the right. A 1 in a place means "add that place value".',
      show(`${b.split('').join('   ')}\n${b.split('').map((_, i) => String(2 ** (b.length - 1 - i))).join(' ')}`, 'each bit with its place value (rightmost bit = 1)'),
      count(`The leftmost bit sits in place ${b.length - 1} (counting from 0 on the right). What is it worth?`, `2^${b.length - 1}`, 2 ** (b.length - 1)),
      `The 1-bits are worth ${used.join(', ')}. Add them up; the 0-bits add nothing.`,
      count('The number in decimal:', used.join(' + '), n));
  },
  (r, d) => {
    const n = between(r, 0, tier(d, 255, 0xffff, 0xffffff));
    const rems: [number, number][] = [];
    for (let x = n; ; x = Math.floor(x / 16)) { rems.push([x, x % 16]); if (x < 16) break; }
    return walk(ask(`Write ${n} in hexadecimal.`, hexa(n), `${n} = ${hex(n, 1)}: each hex digit is 4 bits (${n.toString(2).padStart(Math.ceil(Math.max(1, n.toString(2).length) / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1_')}).`, 'Divide by 16 repeatedly, or go through binary 4 bits at a time.'),
      'repeated division by 16', 'Hex has 16 digits: 0-9, then A=10, B=11, C=12, D=13, E=14, F=15. Divide the number by 16: the remainder is the last hex digit. Divide what is left by 16 again for the next digit, and so on until nothing is left. Read the digits from the last one you found to the first.',
      ...rems.map(([x, rm], i) => count(`${i === 0 ? 'Start with the number itself.' : 'Now divide the quotient.'} ${x} ÷ 16 = ${Math.floor(x / 16)} remainder ?`, `${x} mod 16`, rm)),
      `The remainders, last to first, are ${rems.map(([, rm]) => rm).reverse().join(', ')}. As hex digits (10 → A ... 15 → F) that reads ${hex(n, 1).slice(2)}.`,
      step(`${n} in hex:`, hexa(n)));
  },
  (r, d) => {
    const n = between(r, 1, tier(d, 0xff, 0xfff, 0xffff));
    const digits = n.toString(16).toUpperCase().split('');
    return walk(ask(`Write ${hex(n, 1)} in binary.`, bin(n), `Each hex digit is 4 bits: ${n.toString(2).padStart(Math.ceil(n.toString(2).length / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1_')}.`, 'Expand each hex digit into 4 bits.'),
      'one hex digit = four bits', '16 = 2^4, so every hex digit maps to exactly four binary digits, independently of its neighbours. Convert each digit on its own (8 4 2 1 weights), then write the groups side by side.',
      show('0=0000 1=0001 2=0010 3=0011 4=0100 5=0101 6=0110 7=0111\n8=1000 9=1001 A=1010 B=1011 C=1100 D=1101 E=1110 F=1111', 'the sixteen hex digits in binary'),
      ...digits.slice(0, 3).map((h) => step(`Hex digit ${h} (= ${parseInt(h, 16)}) as four bits:`, bin(parseInt(h, 16), 4))),
      digits.length > 3 && `And the last digit, ${digits[3]}, is ${parseInt(digits[3], 16).toString(2).padStart(4, '0')}.`,
      step('Now put the groups side by side (leading zeros are fine):', bin(n)));
  },
  (r, d) => {
    const n = tier(d, between(r, 3, 40), between(r, 50, 1000), between(r, 1000, 1_000_000));
    const b = Math.ceil(Math.log2(n));
    return walk(ask(`What is the minimum number of bits needed to give ${n} different items a unique code?`, num(b), `2^${b} = ${2 ** b} ≥ ${n} but 2^${b - 1} = ${2 ** (b - 1)} is not enough, so ${b} bits (ceil(log2 ${n})).`, 'Find the smallest k with 2^k ≥ n.'),
      'count the codes', 'k bits can form 2^k different patterns: 1 bit gives 2 codes, 2 bits give 4, 3 bits give 8, each extra bit doubles it. You need the smallest k whose 2^k is at least the number of items.',
      count(`Try ${b - 1} bits. How many different codes is that?`, `2^${b - 1}`, 2 ** (b - 1)),
      choice(`Is ${2 ** (b - 1)} codes enough for ${n} items?`, 'No, too few', ['Yes, enough'], `${2 ** (b - 1)} < ${n}.`),
      count(`One more bit doubles it. ${b} bits give:`, `2^${b}`, 2 ** b),
      step(`${2 ** b} ≥ ${n}, so the minimum number of bits is:`, num(b)));
  },
  (r, d) => {
    const a = between(r, 0, 255), b = between(r, 0, 255);
    const [op, f] = pick(r, [['&', (x: number, y: number) => x & y], ['|', (x: number, y: number) => x | y], ['^', (x: number, y: number) => x ^ y]] as const);
    const rule = { '&': 'AND: a result bit is 1 only where BOTH bits are 1', '|': 'OR: a result bit is 1 where EITHER bit is 1', '^': 'XOR: a result bit is 1 where the two bits DIFFER' }[op];
    const opBeats: Part[] = [
      step(`${hex(a)} in 8 bits:`, bin(a, 8)), step(`${hex(b)} in 8 bits:`, bin(b, 8)),
      show(`  ${a.toString(2).padStart(8, '0')}\n${op} ${b.toString(2).padStart(8, '0')}\n  --------`, `line the bits up; ${rule}`),
      step(`Apply ${op} to each column:`, bin(f(a, b), 8)),
    ];
    if (d === 1) return walk(ask(`${hex(a)} ${op} ${hex(b)} = ? (hex)`, hexa(f(a, b), 2), `${a.toString(2).padStart(8, '0')} ${op} ${b.toString(2).padStart(8, '0')} = ${f(a, b).toString(2).padStart(8, '0')} = ${hex(f(a, b))}.`, 'Work bit by bit in binary.'),
      'bit by bit', `Bitwise operators work on each bit position separately. ${rule}. Convert both hex numbers to binary (each hex digit is 4 bits), line them up, apply the rule column by column, then convert back to hex.`,
      ...opBeats, step('Back to hex, 4 bits per digit:', hexa(f(a, b), 2)));
    const s = between(r, 1, 4);
    const [sop, g] = pick(r, [['<<', (x: number) => (x << s) & 0xff], ['>>', (x: number) => x >> s]] as const);
    const v = g(f(a, b));
    if (d === 2) return walk(ask(`For 8-bit values: (${hex(a)} ${op} ${hex(b)}) ${sop} ${s} = ? (hex, keep 8 bits)`, hexa(v, 2), `${hex(a)} ${op} ${hex(b)} = ${hex(f(a, b))}; shifted ${sop === '<<' ? 'left' : 'right'} by ${s} and kept to 8 bits: ${hex(v)}.`, 'Do the bitwise operation first, then the shift, then drop bits above bit 7.'),
      'bitwise, then shift', `Inside the parentheses first: ${rule}. Then the shift moves every bit ${sop === '<<' ? 'left (toward the high end); zeros come in on the right and bits pushed past bit 7 fall off' : 'right (toward bit 0); zeros come in on the left and bits pushed past bit 0 fall off'}.`,
      ...opBeats, step(`Shift ${sop === '<<' ? 'left' : 'right'} by ${s}, keeping 8 bits:`, bin(v, 8)), step('As hex:', hexa(v, 2)));
    const lo = between(r, 0, 5), w = between(r, 2, 4), x = between(r, 0, 0xffff);
    const field = (x >> lo) & ((1 << w) - 1);
    return walk(ask(`Register value ${hex(x, 4)}. Extract the ${w}-bit field at bits [${lo + w - 1}:${lo}]. Value in decimal?`, num(field), `(${hex(x, 4)} >> ${lo}) & ${hex((1 << w) - 1, 1)} = ${field}. Shift the field down to bit 0, then mask off everything above it: the bread and butter of firmware and testbench code.`, 'Shift right by the low bit index, then AND with a mask of w ones.'),
      'shift, then mask', `A field [hi:lo] is a group of bits inside a bigger register. Two moves pull it out: shift right by lo so the field starts at bit 0, then AND with a mask of ${w} ones to throw away everything above it.`,
      step(`${hex(x, 4)} in binary (16 bits):`, bin(x, 16)),
      step(`Shift right by ${lo}: drop the lowest ${lo} bit${lo === 1 ? '' : 's'}.`, bin(x >> lo)),
      count(`A mask of ${w} ones is 2^${w} - 1:`, `2^${w} - 1`, (1 << w) - 1),
      step(`Keep only the lowest ${w} bits (AND with the mask). The field value in decimal:`, num(field)));
  },
  (r, d) => {
    const w = tier(d, 8, 16, 32);
    const bit = between(r, 0, w - 1);
    const [act, expr2] = pick(r, [['set', `x | (1 << ${bit})`], ['clear', `x & ~(1 << ${bit})`], ['toggle', `x ^ (1 << ${bit})`]] as const);
    const m = 2 ** bit;
    const why = { set: 'OR with a 1 forces a bit to 1 and leaves the others alone', clear: 'AND with a 0 forces a bit to 0, so the mask is all ones except that bit', toggle: 'XOR with a 1 flips a bit and leaves the others alone' }[act];
    return walk(ask(`What is the mask (in hex) you would use to ${act} bit ${bit} of a ${w}-bit register? (the operation is \`${expr2}\`)`, hexa(act === 'clear' ? (2 ** w - 1) - m : m), `1 << ${bit} = ${hex(m, 1)}${act === 'clear' ? `; clearing ANDs with its complement, ${hex(2 ** w - 1 - m, w / 4)}` : ''}.`, act === 'clear' ? 'The complement of 1 << bit, within the register width.' : '1 shifted left by the bit index.'),
      'one-hot masks', `1 << k is a number with only bit k set (its value is 2^k). ${why[0].toUpperCase() + why.slice(1)}. In hex, bit k lands in hex digit ⌊k/4⌋ (from the right) with value 1, 2, 4 or 8.`,
      step(`1 << ${bit}: the ${bit === 0 ? '' : `${bit} zeros after a `}single 1, in hex:`, hexa(m)),
      act === 'clear' && `Now invert it within ${w} bits: every hex digit becomes F minus itself.`,
      act === 'clear' && step(`~(1 << ${bit}) as a ${w}-bit mask:`, hexa(2 ** w - 1 - m)));
  },
]);

export const twosPractice = practice('practice-twos', 'Signed Number Drills', "two's complement, overflow, sign extension", [
  (r, d) => {
    const w = tier(d, 4, 8, 16);
    const v = -between(r, 1, 2 ** (w - 1));
    const enc = 2 ** w + v;
    const idea = `In two's complement, a negative number -x is stored as 2^n - x: the pattern you get by counting backwards from zero and wrapping around. The quick way by hand: write +x, invert every bit, add 1.`;
    return w === 4
      ? walk(ask(`Write ${v} as a 4-bit two's complement number (binary).`, bin(enc, 4), `Invert ${(-v).toString(2).padStart(4, '0')} and add 1: ${enc.toString(2).padStart(4, '0')}.`, 'Write the positive value, invert every bit, add 1.'),
        "two's complement: invert and add 1", idea,
        step(`First write +${-v} in 4 bits:`, bin(-v, 4)),
        step('Invert every bit (0 ↔ 1):', bin(15 - -v, 4)),
        step('Add 1:', bin(enc, 4)))
      : walk(ask(`Write ${v} as a ${w}-bit two's complement number, in hex.`, hexa(enc, w / 4), `2^${w} ${v} = ${enc} = ${hex(enc, w / 4)}.`, `Add 2^${w} to the negative number.`),
        "two's complement: add 2^n", `${idea} With ${w} bits it is easier to add 2^${w} and convert the result to hex.`,
        count(`What is 2^${w}?`, `2^${w}`, 2 ** w),
        count(`Add the negative number:`, `${2 ** w} + (${v})`, enc),
        step(`${enc} in hex (${w / 4} digits):`, hexa(enc, w / 4)));
  },
  (r, d) => {
    const w = tier(d, 4, 8, 16);
    const enc = between(r, 2 ** (w - 1), 2 ** w - 1);
    const q = w === 4 ? enc.toString(2).padStart(4, '0') + '₂' : hex(enc, w / 4);
    return walk(ask(`${q} is a ${w}-bit two's complement value. What is it in decimal?`, num(enc - 2 ** w), `The top bit is set, so it is negative: ${enc} - 2^${w} = ${enc - 2 ** w}.`, `If the top bit is 1, subtract 2^${w}.`),
      'read the sign bit, then subtract 2^n', `The top bit of a two's complement number is the sign. If it is 0, read the number normally. If it is 1, the number is negative: read the pattern as an ordinary unsigned number, then subtract 2^${w}.`,
      choice(`The top bit of ${q} is 1${w > 4 ? ` (the first hex digit is ${hex(enc, w / 4)[2]}, which is 8 or more)` : ''}. So the value is:`, 'Negative', ['Positive']),
      count('Read the pattern as an unsigned number first:', `${q} unsigned`, enc),
      count(`Subtract 2^${w} = ${2 ** w}:`, `${enc} - ${2 ** w}`, enc - 2 ** w));
  },
  (r, d) => {
    const w = tier(d, 4, 8, pick(r, [12, 16, 32]));
    const lo = pick(r, [true, false]);
    return walk(ask(`What is the ${lo ? 'most negative' : 'largest positive'} value of a ${w}-bit signed (two's complement) integer?`, num(lo ? -(2 ** (w - 1)) : 2 ** (w - 1) - 1), `An n-bit signed range is -2^(n-1) .. 2^(n-1) - 1: ${-(2 ** (w - 1))} .. ${2 ** (w - 1) - 1}.`, '-2^(n-1) to 2^(n-1) - 1.'),
      'split the codes in half', `n bits give 2^n patterns. Two's complement spends half of them on negatives (-1 down to -2^(n-1)) and half on zero and the positives (0 up to 2^(n-1) - 1). That is why the range is lopsided by one.`,
      count(`Half of the ${w}-bit patterns: 2^(${w}-1) =`, `2^${w - 1}`, 2 ** (w - 1)),
      lo ? step('The negatives run from -1 down to minus that many. The most negative value:', num(-(2 ** (w - 1))))
        : step('Zero takes one of the non-negative codes, so the largest positive is one less:', num(2 ** (w - 1) - 1)));
  },
  (r, d) => {
    const w = 8;
    const a = between(r, tier(d, 20, 60, 90), 127) * (d === 3 && r() < 0.5 ? -1 : 1);
    const b = between(r, tier(d, 20, 60, 90), 127) * (a < 0 ? -1 : 1);
    const raw = (a + b + 512) % 256;
    const res = toSigned(raw, w);
    const fits = a + b <= 127 && a + b >= -128;
    return walk(ask(`8-bit signed addition: ${a} + ${b}. What value does the 8-bit result hold (as signed decimal)?`, num(res), `The true sum ${a + b} ${a + b > 127 || a + b < -128 ? `does not fit in -128..127, so it wraps to ${res}: signed overflow. Two operands of the same sign gave a result of the other sign.` : `fits, so the result is ${res}.`}`, 'Compute the true sum; if it is outside -128..127, add or subtract 256.'),
      'check the range, then wrap', 'An 8-bit signed number holds -128..127. The hardware adds normally, but only 8 bits survive, so a result outside the range wraps around by 256, like an odometer rolling over. That wrap is called overflow.',
      count('First the true sum, as if you had unlimited bits:', `${a} + ${b}`, a + b),
      choice(`Does ${a + b} fit in -128..127?`, fits ? 'Yes, inside' : 'No, outside', [fits ? 'No, outside' : 'Yes, inside']),
      fits ? step('Then the result is simply the sum:', num(res))
        : count(`It does not fit, so it wraps by 256 (${a + b > 0 ? 'subtract' : 'add'} 256):`, `${a + b} ${a + b > 0 ? '-' : '+'} 256`, res));
  },
  (r, d) => {
    const from = tier(d, 4, 8, 8), to = tier(d, 8, 16, 32);
    const v = between(r, 2 ** (from - 1), 2 ** from - 1);
    const ext = v + (2 ** to - 2 ** from);
    return walk(ask(`Sign-extend the ${from}-bit value ${hex(v, from / 4)} to ${to} bits. Answer in hex.`, hexa(ext, to / 4), `The sign bit is 1, so the new upper bits are all 1s: ${hex(ext, to / 4)}. The value (${toSigned(v, from)}) is unchanged.`, 'Copy the top bit into every new bit.'),
      'copy the sign bit', 'To widen a signed number without changing its value, copy its top (sign) bit into every new bit. A positive number gets zeros; a negative one gets ones. In hex, a run of four 1-bits is one F digit.',
      step(`${hex(v, from / 4)} in ${from} bits:`, bin(v, from)),
      choice('Its top bit is:', '1, so the new bits are all 1s', ['0, so the new bits are all 0s']),
      count(`How many new bits are added (${to} - ${from})? That many ones is ${(to - from) / 4} hex F digits.`, `${to} - ${from}`, to - from),
      step(`Put the F digits in front of the original:`, hexa(ext, to / 4)));
  },
  (r, d) => {
    const w = tier(d, 8, 8, 16);
    const v = between(r, 1, 2 ** (w - 1) - 1);
    const s = between(r, 1, 3);
    const neg = -v;
    const ar = Math.floor(neg / 2 ** s);
    const pat = 2 ** 16 + neg, lg = (pat >>> s) & 0xffff;
    return d < 3
      ? walk(ask(`In Verilog, \`-${v}\` stored in an 8-bit signed reg, then arithmetic-shifted right by ${s} (\`>>> ${s}\`). What signed value results?`, num(ar), `Arithmetic right shift copies the sign bit in, which divides by 2^${s} rounding toward minus infinity: floor(${neg} / ${2 ** s}) = ${ar}.`, 'An arithmetic shift is floor division by a power of two.'),
        'shift = divide by 2^s, rounding down', 'Shifting right by s moves every bit down s places: that divides by 2^s. An ARITHMETIC shift (>>>) copies the sign bit into the top so negatives stay negative, and the bits that fall off make it round toward minus infinity (floor), not toward zero.',
        count(`2^${s} =`, `2^${s}`, 2 ** s),
        calc('Divide exactly first:', `${neg} / ${2 ** s}`, neg / 2 ** s),
        step(`Round DOWN (toward minus infinity), so ${neg / 2 ** s} becomes:`, num(ar)))
      : walk(ask(`A 16-bit signed \`-${v}\` is shifted with a **logical** right shift (\`>> ${s}\`). What is the result as an unsigned hex value?`, hexa(lg, 4), `Logical shift fills with zeros, so the sign is lost: ${hex(pat, 4)} >> ${s} = ${hex(lg, 4)}. Mixing >> and >>> on signed data is a classic RTL bug.`, 'Take the 16-bit pattern and shift zeros in from the top.'),
        'find the bit pattern, then shift in zeros', "First find how -x is stored: 2^16 - x. A LOGICAL shift ignores the sign: it moves the raw bits down and fills the top with zeros. So the result is just the unsigned pattern divided by 2^s, rounded down.",
        count(`The 16-bit pattern of -${v} is 2^16 - ${v}:`, `65536 - ${v}`, pat),
        step('As 16 bits:', bin(pat, 16)),
        step(`Shift right by ${s}, filling with zeros (${nibbles(lg, 16)} in binary). In hex:`, hexa(lg, 4)));
  },
]);

const sopOf = (vars: readonly string[], f: (v: Record<string, boolean>) => boolean) => {
  const n = vars.length;
  const terms: string[] = [];
  for (let i = 0; i < 2 ** n; i++) {
    const env = Object.fromEntries(vars.map((x, k) => [x, !!((i >> (n - 1 - k)) & 1)]));
    if (f(env)) terms.push(vars.map((x) => (env[x] ? x : `~${x}`)).join('&'));
  }
  return terms.join(' | ');
};

export const boolPractice = practice('practice-bool', 'Boolean Drills', 'truth tables, De Morgan, minterms', [
  (r, d) => {
    // [description, inputs, function, one correct expression, level]
    const cases = [
      ['output is 1 when exactly one of a and b is 1', ['a', 'b'], (v: Record<string, boolean>) => v.a !== v.b, 'a ^ b', 1],
      ['output is 1 when both a and b are 0', ['a', 'b'], (v: Record<string, boolean>) => !v.a && !v.b, '~(a | b)', 1],
      ['output is 1 when a and b are equal', ['a', 'b'], (v: Record<string, boolean>) => v.a === v.b, '~(a ^ b)', 1],
      ['output is 1 when a or b is 1', ['a', 'b'], (v: Record<string, boolean>) => v.a || v.b, 'a | b', 1],
      ['output is 1 when a is 1 and b is 0', ['a', 'b'], (v: Record<string, boolean>) => v.a && !v.b, 'a & ~b', 1],
      ['output is 1 when a is 0 or b is 1', ['a', 'b'], (v: Record<string, boolean>) => !v.a || v.b, '~a | b', 1],
      ['output is 0 only when both a and b are 1', ['a', 'b'], (v: Record<string, boolean>) => !(v.a && v.b), '~(a & b)', 1],
      ['output is 1 when at least two of a, b, c are 1 (majority)', ['a', 'b', 'c'], (v: Record<string, boolean>) => +v.a + +v.b + +v.c >= 2, 'a&b | a&c | b&c', 2],
      ['output is a when s is 0 and b when s is 1 (a mux)', ['a', 'b', 's'], (v: Record<string, boolean>) => (v.s ? v.b : v.a), '~s&a | s&b', 2],
      ['output is 1 when a is 1 and neither b nor c is 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => v.a && !v.b && !v.c, 'a & ~b & ~c', 2],
      ['output is 1 when a, b and c are all equal', ['a', 'b', 'c'], (v: Record<string, boolean>) => v.a === v.b && v.b === v.c, '(a & b & c) | (~a & ~b & ~c)', 2],
      ['output is 1 when a is 1, or b and c are both 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => v.a || (v.b && v.c), 'a | b & c', 2],
      ['output is 1 when exactly one of a, b, c is 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => +v.a + +v.b + +v.c === 1, '~a&~b&c | ~a&b&~c | a&~b&~c', 2],
      ['output is 1 when an odd number of a, b, c are 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => (+v.a + +v.b + +v.c) % 2 === 1, 'a ^ b ^ c', 3],
      ['output is 1 when the 2-bit number {a,b} is greater than the 1-bit number c', ['a', 'b', 'c'], (v: Record<string, boolean>) => 2 * +v.a + +v.b > +v.c, 'a | b&~c', 3],
      ['output is 1 when a and b are 1, or c and d are 1 (four inputs)', ['a', 'b', 'c', 'd'], (v: Record<string, boolean>) => (v.a && v.b) || (v.c && v.d), 'a&b | c&d', 3],
      ['output is 1 when a is 1 and b is 0, or c is 1 and d is 0 (four inputs)', ['a', 'b', 'c', 'd'], (v: Record<string, boolean>) => (v.a && !v.b) || (v.c && !v.d), 'a&~b | c&~d', 3],
      ['output is 1 when a, b, c and d are all equal (four inputs)', ['a', 'b', 'c', 'd'], (v: Record<string, boolean>) => v.a === v.b && v.b === v.c && v.c === v.d, '(a&b&c&d) | (~a&~b&~c&~d)', 3],
      ['output is 1 when an odd number of a, b, c and d are 1 (four inputs)', ['a', 'b', 'c', 'd'], (v: Record<string, boolean>) => (+v.a + +v.b + +v.c + +v.d) % 2 === 1, 'a ^ b ^ c ^ d', 3],
    ] as const;
    const [desc, vars, f, canon] = pick(r, cases.filter((c) => c[4] === d));
    const n = vars.length;
    const sop = sopOf(vars, f);
    return walk(ask(`Write a boolean expression (use & | ^ ~ or a b' notation) for: ${desc}.`, expr(canon, [...vars], f), `One answer: ${canon}. Any equivalent expression is accepted, because I check it against the full truth table.`, 'Write the truth table first, then OR together the rows where the output is 1.'),
      'truth table, then sum of products', 'When a description is hard to turn into logic directly, list every input combination (the truth table) and decide the output for each row. Then write one AND term for every row whose output is 1 (a variable if it is 1 in that row, ~variable if it is 0) and OR those terms together. It always works; simplifying comes later.',
      ...sim(Array.from({ length: 2 ** n }, (_, i) => {
        const e = Object.fromEntries(vars.map((x, k) => [x, !!((i >> (n - 1 - k)) & 1)]));
        const label = vars.map((x) => `${x} = ${+e[x]}`).join(', ');
        return { beats: [step(`Row ${i}: ${label}. Output?`, num(+f(e)), `Check it against the description: ${desc}.`)], row: `${vars.map((x) => +e[x]).join(' ')}  →  ${+f(e)}` };
      }), 3, 'the whole truth table'),
      `Each row with output 1 becomes an AND term. For example, the row ${vars.join('')} = ${vars.map(() => '1').join('')} would be ${vars.join('&')}, and a row with ${vars[0]} = 0 uses ~${vars[0]}.`,
      step('Write the OR of the AND terms for every 1-row (any equivalent expression is fine):', expr(sop, [...vars], f)));
  },
  (r, d) => {
    const vars = tier(d, ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']);
    const n = vars.length;
    const ms = Array.from({ length: 2 ** n }, (_, i) => i).filter(() => r() < 0.45);
    if (!ms.length) ms.push(between(r, 0, 2 ** n - 1));
    if (ms.length === 2 ** n) ms.pop();
    const f = (v: Record<string, boolean>) => ms.includes(vars.reduce((acc, x) => acc * 2 + +v[x], 0));
    const term = (m: number) => vars.map((x, i) => ((m >> (n - 1 - i)) & 1 ? x : `~${x}`)).join('&');
    const canon = ms.map(term).join(' | ');
    return walk(ask(`f(${vars.join(',')}) = Σm(${ms.join(', ')}), with ${vars[0]} as the most significant bit. Write any expression for f.`, expr(canon, vars, f), `A sum of the minterms works: ${canon}. A K-map would simplify it, and any equivalent form is accepted.`, `Minterm m${ms[0]} is the row where ${vars.join('')} = ${ms[0].toString(2).padStart(n, '0')}.`),
      'minterms to products', `Σm(...) lists the truth-table rows where f is 1, by row number. Row k is k written in ${n}-bit binary, with ${vars[0]} as the leftmost bit. Each such row becomes one AND term (the variable where its bit is 1, ~variable where it is 0), and f is the OR of those terms.`,
      step(`Row m${ms[0]} in ${n}-bit binary (${vars.join('')}):`, bin(ms[0], n)),
      `So m${ms[0]} is the term ${term(ms[0])}. The same for the others: ${ms.map((m) => `m${m} = ${m.toString(2).padStart(n, '0')} → ${term(m)}`).join('; ')}.`,
      step('Now OR all the terms together:', expr(canon, vars, f)));
  },
  (r, d) => {
    // [expression, one correct form with ~ only on variables, inputs, function, level, the steps of the walkthrough]
    const forms: [string, string, string[], (v: Record<string, boolean>) => boolean, number, Part[][]][] = [
      ['~(a & b)', '~a | ~b', ['a', 'b'], (v) => !(v.a && v.b), 1, [[choice('~(a & b): the ~ moves onto each variable and the & flips to:', '~a | ~b', ['~a & ~b', 'a | b'])]]],
      ['~(a | b | c)', '~a & ~b & ~c', ['a', 'b', 'c'], (v) => !(v.a || v.b || v.c), 1, [[choice('~(a | b | c): the ~ moves onto each variable and every | flips to:', '~a & ~b & ~c', ['~a | ~b | ~c', '~(a & b & c)'])]]],
      ['~(a | b)', '~a & ~b', ['a', 'b'], (v) => !(v.a || v.b), 1, [[choice('~(a | b): the ~ moves onto each variable and the | flips to:', '~a & ~b', ['~a | ~b', 'a | b'])]]],
      ['~(a & b & c)', '~a | ~b | ~c', ['a', 'b', 'c'], (v) => !(v.a && v.b && v.c), 1, [[choice('~(a & b & c): the ~ moves onto each variable and every & flips to:', '~a | ~b | ~c', ['~a & ~b & ~c', 'a | b | c'])]]],
      ['~(a | ~b)', '~a & b', ['a', 'b'], (v) => !(v.a || !v.b), 1, [[choice('~(a | ~b): the ~ moves onto each piece, the | flips to &, and ~~b cancels to:', '~a & b', ['~a | ~b', 'a | b'])]]],
      ['~(~a | ~b)', 'a & b', ['a', 'b'], (v) => !(!v.a || !v.b), 1, [[choice('~(~a | ~b): the ~ moves onto each piece, the | flips to &, and the double ~ cancels to:', 'a & b', ['~a & ~b', '~a | ~b'])]]],
      ['~(a & b | c)', '(~a | ~b) & ~c', ['a', 'b', 'c'], (v) => !((v.a && v.b) || v.c), 2, [
        [choice('The outermost operator inside ~( ) is the |, between (a & b) and c. Apply De Morgan to it: ~(X | c) =', '~X & ~c', ['~X | ~c', 'X & c'])],
        [choice('Now X = a & b, so ~X = ~(a & b) =', '~a | ~b', ['~a & ~b', 'a | b'])]]],
      ['~(a & (b | c))', '~a | (~b & ~c)', ['a', 'b', 'c'], (v) => !(v.a && (v.b || v.c)), 2, [
        [choice('The outermost operator is the & between a and Y = (b | c). De Morgan on it: ~(a & Y) =', '~a | ~Y', ['~a & ~Y', 'a | Y'])],
        [choice('Now Y = b | c, so ~Y = ~(b | c) =', '~b & ~c', ['~b | ~c', 'b & c'])]]],
      ['~(a | ~b & c)', '~a & (b | ~c)', ['a', 'b', 'c'], (v) => !(v.a || (!v.b && v.c)), 2, [
        [choice('The outermost operator is the | between a and Z = (~b & c). De Morgan: ~(a | Z) =', '~a & ~Z', ['~a | ~Z', 'a & Z'])],
        [choice('Now ~Z = ~(~b & c) =', 'b | ~c', ['~b & ~c', '~b | ~c'])]]],
      ['~(a & ~b | c)', '(~a | b) & ~c', ['a', 'b', 'c'], (v) => !((v.a && !v.b) || v.c), 2, [
        [choice('The outermost operator is the | between X = (a & ~b) and c: ~(X | c) =', '~X & ~c', ['~X | ~c', 'X & c'])],
        [choice('Now ~X = ~(a & ~b) =', '~a | b', ['~a | ~b', 'a & b'])]]],
      ['~(a | b & c)', '~a & (~b | ~c)', ['a', 'b', 'c'], (v) => !(v.a || (v.b && v.c)), 2, [
        [choice('The outermost operator is the | between a and Y = (b & c): ~(a | Y) =', '~a & ~Y', ['~a | ~Y', 'a & Y'])],
        [choice('Now ~Y = ~(b & c) =', '~b | ~c', ['~b & ~c', 'b | c'])]]],
      ['~(~a & (b | c))', 'a | (~b & ~c)', ['a', 'b', 'c'], (v) => !(!v.a && (v.b || v.c)), 2, [
        [choice('The outermost operator is the & between X = ~a and Y = (b | c): ~(X & Y) =', '~X | ~Y', ['~X & ~Y', 'X | Y'])],
        [choice('Now ~Y = ~(b | c) =', '~b & ~c', ['~b | ~c', 'b | c'])]]],
      ['~((a | b) & (c | d))', '~a & ~b | ~c & ~d', ['a', 'b', 'c', 'd'], (v) => !((v.a || v.b) && (v.c || v.d)), 3, [
        [choice('The outermost operator is the & between (a | b) and (c | d). De Morgan on it: ~(X & Y) =', '~X | ~Y', ['~X & ~Y', 'X | Y'])],
        [choice('Then ~(a | b) becomes:', '~a & ~b', ['~a | ~b', 'a & b'])]]],
      ['~((a & b) | (c & d))', '(~a | ~b) & (~c | ~d)', ['a', 'b', 'c', 'd'], (v) => !((v.a && v.b) || (v.c && v.d)), 3, [
        [choice('The outermost operator is the | between X = (a & b) and Y = (c & d): ~(X | Y) =', '~X & ~Y', ['~X | ~Y', 'X & Y'])],
        [choice('Now ~X = ~(a & b) =', '~a | ~b', ['~a & ~b', 'a | b'])]]],
      ['~((a | b) & c)', '~a & ~b | ~c', ['a', 'b', 'c'], (v) => !((v.a || v.b) && v.c), 3, [
        [choice('The outermost operator is the & between X = (a | b) and c: ~(X & c) =', '~X | ~c', ['~X & ~c', 'X | c'])],
        [choice('Now ~X = ~(a | b) =', '~a & ~b', ['~a | ~b', 'a & b'])]]],
      ['~(a & (b | c | d))', '~a | ~b & ~c & ~d', ['a', 'b', 'c', 'd'], (v) => !(v.a && (v.b || v.c || v.d)), 3, [
        [choice('The outermost operator is the & between a and Y = (b | c | d): ~(a & Y) =', '~a | ~Y', ['~a & ~Y', 'a | Y'])],
        [choice('Now ~Y = ~(b | c | d) =', '~b & ~c & ~d', ['~b | ~c | ~d', 'b & c & d'])]]],
      ['~(a | b | (c & ~d))', '~a & ~b & (~c | d)', ['a', 'b', 'c', 'd'], (v) => !(v.a || v.b || (v.c && !v.d)), 3, [
        [choice('The outermost operator is the | between a, b and Y = (c & ~d). De Morgan on every piece: ~(a | b | Y) =', '~a & ~b & ~Y', ['~a | ~b | ~Y', 'a & b & Y'])],
        [choice('Now ~Y = ~(c & ~d) =', '~c | d', ['~c & d', '~c | ~d'])]]],
      ['~((a & b) | (c | d))', '(~a | ~b) & ~c & ~d', ['a', 'b', 'c', 'd'], (v) => !((v.a && v.b) || v.c || v.d), 3, [
        [choice('The outermost operator is the | between X = (a & b) and Y = (c | d): ~(X | Y) =', '~X & ~Y', ['~X | ~Y', 'X & Y'])],
        [choice('Now ~Y = ~(c | d) =', '~c & ~d', ['~c | ~d', 'c & d'])]]],
    ];
    const [e, canon, vars, f, , steps] = pick(r, forms.filter((x) => x[4] === d));
    const inner = expr(canon, vars, f);
    const pushed = { canonical: canon, check: (s: string) => !/[~!]\s*\(|\)\s*'/.test(s) && inner.check(s) };
    return walk(ask(`Push the inversion all the way down to the variables with De Morgan's laws: ${e}. (Your answer may only put ~ directly on variables.)`, pushed, `One answer: ${canon}. De Morgan: ~(x & y) = ~x | ~y and ~(x | y) = ~x & ~y, applied level by level.`, 'Flip & to | (and back) as the ~ moves inward.'),
      "De Morgan's laws, outside in", 'De Morgan says: ~(x & y) = ~x | ~y, and ~(x | y) = ~x & ~y. In words: move the NOT onto each piece and flip AND ↔ OR. With nested brackets, start at the outermost operator and work inward one level at a time.',
      ...steps.flat(),
      step('Write the whole result, with ~ only on single variables:', pushed));
  },
  (r, d) => {
    const n = pick(r, tier(d, [1, 2], [2, 3], [3, 4]));
    const rows = 2 ** n;
    if (r() < 0.5) {
      return walk(ask(`How many different boolean functions of ${n} inputs are there?`, qty(2 ** rows, '', 0.001, String(2 ** rows)), `A truth table has 2^${n} = ${rows} rows, and each can be 0 or 1: 2^${rows} = ${2 ** rows} functions.`, 'Count the rows, then the ways to fill the output column.'),
        'count the truth tables', 'A boolean function is completely described by its truth table. Two functions are different exactly when their output columns differ. So count the rows, then count the ways to fill a column of that many 0s and 1s.',
        count(`How many rows does a ${n}-input truth table have?`, `2^${n}`, rows),
        count(`Each of those ${rows} rows can independently be 0 or 1. Number of ways to fill the column:`, `2^${rows}`, 2 ** rows));
    }
    const k = between(r, 1, Math.min(3, rows - 1));
    const ways = choose(rows, k);
    return walk(ask(`How many boolean functions of ${n} inputs are 1 on exactly ${k} of their ${rows} rows?`, qty(ways, '', 0.001, String(ways)), `Choose which ${k} of the ${rows} rows are 1 (the rest are 0): C(${rows}, ${k}) = ${ways} functions.`, 'Each choice of the 1-rows is a different function.'),
      'choose the 1-rows', 'A function is decided by which rows output 1. Counting the functions with exactly k ones means counting the ways to choose those k rows out of all the rows of the truth table.',
      count(`How many rows does a ${n}-input truth table have?`, `2^${n}`, rows),
      count(`Ways to choose ${k} of those ${rows} rows to be 1:`, `C(${rows}, ${k})`, ways));
  },
]);

export const ohmPractice = practice('practice-ohm', 'Circuit Arithmetic', "Ohm's law, power, series/parallel, dividers", [
  (r, d) => {
    const R = pick(r, tier(d, [100, 1000, 10000], [220, 470, 4700, 33000], [330, 680, 2200, 15000]));
    const I = pick(r, tier(d, [0.001, 0.01], [0.002, 0.005, 0.02], [0.0015, 0.0025, 0.012]));
    const which = d === 1 ? 0 : between(r, 0, 2);
    const idea = "Ohm's law, V = I × R, links the three: voltage (V, volts) pushes current (I, amps) through resistance (R, ohms). Rearranged: I = V / R. Power is P = V × I, which with Ohm's law is also V²/R or I²R. Always convert to base units (A, Ω, V) first: 1 mA = 0.001 A, 1 kΩ = 1000 Ω.";
    if (which === 0) return walk(ask(`${eng(I, 'A')} flows through ${eng(R, 'Ω')}. What is the voltage across it, in V?`, qty(I * R, 'V'), `V = I × R = ${eng(I * R, 'V')}.`, 'V = I × R.'),
      "Ohm's law", idea,
      calc(`Convert ${eng(I, 'A')} to amps:`, `${eng(I, 'A')} in A`, I, 'A', String(I)),
      calc('Multiply by the resistance:', `V = ${I} A × ${R} Ω`, I * R, 'V'));
    if (which === 1) return walk(ask(`${eng(I * R, 'V')} is across ${eng(R, 'Ω')}. What current flows, in mA?`, qty(I * 1000, 'mA'), `I = V / R = ${eng(I, 'A')}.`, 'I = V / R.'),
      "Ohm's law, solved for current", idea,
      calc('Divide voltage by resistance to get amps:', `I = ${sig(I * R)} V / ${R} Ω`, I, 'A', sig(I)),
      calc('Convert to mA (× 1000):', `${sig(I)} A × 1000`, I * 1000, 'mA'));
    return walk(ask(`${eng(I * R, 'V')} across ${eng(R, 'Ω')}. How much power does the resistor dissipate, in mW?`, qty(I * I * R * 1000, 'mW'), `P = V² / R = ${eng(I * I * R, 'W')}.`, 'P = V²/R = I²R.'),
      'power from voltage and resistance', idea,
      calc('Square the voltage:', `(${sig(I * R)} V)²`, (I * R) ** 2, '', sig((I * R) ** 2)),
      calc('Divide by the resistance to get watts:', `P = ${sig((I * R) ** 2)} / ${R} Ω`, I * I * R, 'W', sig(I * I * R)),
      calc('Convert to mW (× 1000):', `${sig(I * I * R)} W × 1000`, I * I * R * 1000, 'mW'));
  },
  (r, d) => {
    const rs = Array.from({ length: tier(d, 2, 3, 3) }, () => pick(r, [1000, 2200, 4700, 10000, 3300, 6800]));
    const par = d >= 2 && r() < 0.6 || d === 1 && r() < 0.5;
    const eq = par ? 1 / rs.reduce((a, x) => a + 1 / x, 0) : rs.reduce((a, x) => a + x, 0);
    const kk = (x: number) => sig(x / 1000);
    const idea = 'Series resistors (one after another, same current) simply add: R = R1 + R2 + ... Parallel resistors (side by side, same voltage) add as conductances: 1/R = 1/R1 + 1/R2 + ..., then flip. For two in parallel the shortcut is product over sum, R1·R2/(R1 + R2). Working in kΩ keeps the numbers small.';
    if (d === 3 && !par) {
      const a = rs[0], b = rs[1], c = rs[2];
      const pb = (b * c) / (b + c), v = a + pb;
      return walk(ask(`${eng(a, 'Ω')} in series with (${eng(b, 'Ω')} ∥ ${eng(c, 'Ω')}). Total resistance, in kΩ?`, qty(v / 1000, 'kΩ'), `${eng(b, 'Ω')} ∥ ${eng(c, 'Ω')} = ${eng((b * c) / (b + c), 'Ω')}; plus ${eng(a, 'Ω')} = ${eng(v, 'Ω')}.`, 'Parallel pair first: product over sum.'),
        'reduce the network step by step', `${idea} In a mixed network, collapse the innermost group first (here the parallel pair), then treat the result as a single resistor.`,
        calc('The parallel pair, product over sum (in kΩ):', `${kk(b)} × ${kk(c)} / (${kk(b)} + ${kk(c)})`, pb / 1000, 'kΩ'),
        calc('Now it is in series with the first resistor, so add:', `${kk(a)} + ${sig(pb / 1000)}`, v / 1000, 'kΩ'));
    }
    return walk(ask(`${rs.map((x) => eng(x, 'Ω')).join(par ? ' ∥ ' : ' + ')}: equivalent resistance, in kΩ?`, qty(eq / 1000, 'kΩ'), par ? `1/R = ${rs.map((x) => `1/${eng(x, 'Ω')}`).join(' + ')}, so R = ${eng(eq, 'Ω')}. Parallel is always smaller than the smallest.` : `Series resistances add: ${eng(eq, 'Ω')}.`, par ? '1/R = sum of 1/Ri.' : 'Series: add them.'),
      par ? 'parallel resistors' : 'series resistors', idea,
      ...(par ? [
        calc('Add the conductances (1/R, with R in kΩ):', rs.map((x) => `1/${kk(x)}`).join(' + '), rs.reduce((a, x) => a + 1000 / x, 0), '', sig(rs.reduce((a, x) => a + 1000 / x, 0))),
        calc('Flip it to get the resistance:', `1 / ${sig(rs.reduce((a, x) => a + 1000 / x, 0))}`, eq / 1000, 'kΩ'),
      ] : [calc('Series resistors just add:', rs.map(kk).join(' + '), eq / 1000, 'kΩ')]));
  },
  (r, d) => {
    const vin = pick(r, [3.3, 5, 12, 1.8]);
    const r1 = pick(r, [1000, 2200, 4700, 10000]), r2 = pick(r, [1000, 3300, 4700, 10000]);
    const idea = 'A voltage divider is two resistors in series across a supply. The same current I = Vin/(R1 + R2) flows through both, so the output (the voltage across R2) is I × R2 = Vin × R2/(R1 + R2). Anything connected to the output is in parallel with R2 and changes the answer.';
    if (d <= 2) {
      const load = d === 2 ? pick(r, [10000, 4700]) : 0;
      const r2e = load ? (r2 * load) / (r2 + load) : r2;
      const v = (vin * r2e) / (r1 + r2e);
      const k = (x: number) => sig(x / 1000);
      return walk(ask(`A divider: ${vin} V → R1 = ${eng(r1, 'Ω')} → out → R2 = ${eng(r2, 'Ω')} → ground${load ? `, with a ${eng(load, 'Ω')} load on the output` : ''}. Vout in V?`, qty(v, 'V'), load ? `The load is in parallel with R2: ${eng(r2e, 'Ω')}. Vout = ${vin} × ${eng(r2e, 'Ω')} / (${eng(r1, 'Ω')} + ${eng(r2e, 'Ω')}) = ${v.toFixed(3)} V. Loads pull dividers down: that is why references are buffered.` : `Vout = Vin × R2/(R1 + R2) = ${v.toFixed(3)} V.`, 'Vout = Vin × R2 / (R1 + R2).'),
        'the voltage divider', idea,
        !!load && calc('The load sits in parallel with R2. Combine them first (product over sum, kΩ):', `${k(r2)} × ${k(load)} / (${k(r2)} + ${k(load)})`, r2e / 1000, 'kΩ'),
        calc('Total resistance from the supply to ground (kΩ):', `${k(r1)} + ${k(r2e)}`, (r1 + r2e) / 1000, 'kΩ'),
        calc('Current through the chain, in mA (V / kΩ gives mA):', `${vin} / ${k(r1 + r2e)}`, (vin / (r1 + r2e)) * 1000, 'mA'),
        calc(`The output is that current times the bottom resistance${load ? ' (R2 with its load)' : ''}:`, `${sig((vin / (r1 + r2e)) * 1000)} mA × ${k(r2e)} kΩ`, v, 'V'));
    }
    const target = pick(r, [1.2, 0.9, 2.5, 1.0].filter((x) => x < vin));
    const rr2 = (r1 * target) / (vin - target);
    const i = (vin - target) / r1;
    return walk(ask(`Design: make ${target} V from ${vin} V with R1 = ${eng(r1, 'Ω')} on top. What R2 do you need, in kΩ?`, qty(rr2 / 1000, 'kΩ', 0.02), `R2 = R1 × Vout/(Vin - Vout) = ${eng(r1, 'Ω')} × ${target}/${+(vin - target).toFixed(2)} = ${eng(rr2, 'Ω')}. In practice you would pick the nearest standard (E24/E96) value.`, 'Solve Vout = Vin·R2/(R1+R2) for R2.'),
      'design a divider backwards', `${idea} To design one, work backwards: R1 must drop whatever voltage the output does not, and the same current then flows through R2.`,
      calc('Voltage across R1 (the part the output does not take):', `${vin} - ${target}`, vin - target, 'V'),
      calc('Current through R1, in mA (V / kΩ):', `${sig(vin - target)} / ${sig(r1 / 1000)}`, i * 1000, 'mA'),
      calc(`The same current flows through R2, which must drop ${target} V. R2 = V / I, in kΩ:`, `${target} / ${sig(i * 1000)}`, rr2 / 1000, 'kΩ', undefined, 0.02));
  },
  (r, d) => {
    const vs = pick(r, [3.3, 5]);
    const vf = pick(r, [1.8, 2.0, 2.1]);
    const i = pick(r, tier(d, [0.01, 0.02], [0.005, 0.015], [0.002, 0.008]));
    const R = (vs - vf) / i;
    return walk(ask(`An LED drops ${vf} V at ${i * 1000} mA. It is driven from a ${vs} V pin. What series resistor do you need, in Ω?`, qty(R, 'Ω', 0.02), `R = (${vs} - ${vf}) / ${i} = ${R.toFixed(0)} Ω. It dissipates ${eng((vs - vf) * i, 'W')}.`, 'The resistor takes whatever voltage the LED does not.'),
      "Kirchhoff's voltage law plus Ohm's law", 'In a series loop, the voltages add up to the supply (KVL). An LED holds roughly a fixed voltage across itself, so the resistor gets the rest. The resistor also sets the current, so R = (its voltage) / (the current you want).',
      calc('Voltage left for the resistor:', `${vs} - ${vf}`, vs - vf, 'V'),
      calc('Convert the current to amps:', `${i * 1000} mA`, i, 'A', String(i)),
      calc('R = V / I:', `${sig(vs - vf)} V / ${i} A`, R, 'Ω', undefined, 0.02));
  },
]);

export const rcPractice = practice('practice-rc', 'RC Drills', 'time constants, charging, cutoff frequency, energy', [
  (r, d) => {
    const R = pick(r, tier(d, [1e3, 4.7e3, 10e3, 100e3], [1e3, 4.7e3, 10e3, 100e3, 470e3], [2.2e3, 47e3, 1e6, 2.2e6]));
    const C = pick(r, tier(d, [1e-9, 10e-9, 100e-9, 1e-6], [1e-9, 10e-9, 100e-9, 1e-6, 4.7e-6], [2.2e-9, 47e-9, 470e-9, 4.7e-6]));
    return walk(ask(`R = ${eng(R, 'Ω')}, C = ${eng(C, 'F')}. What is τ, in µs?`, qty(R * C * 1e6, 'us'), `τ = RC = ${eng(R * C, 's')}.`, 'τ = R × C.'),
      'the time constant τ = RC', 'τ (tau) is how fast an RC circuit responds: after one τ a charging capacitor is 63% of the way there, after 5τ it is essentially done. τ = R (in ohms) × C (in farads) gives seconds. Multiply by 10^6 to get microseconds.',
      calc(`Write C in farads (${eng(C, 'F')}):`, eng(C, 'F'), C, '', String(C)),
      calc('Multiply by R (in ohms) to get seconds:', `${R} × ${C}`, R * C, 's', sig(R * C)),
      calc('Convert to µs (× 1,000,000):', `${sig(R * C)} s × 10^6`, R * C * 1e6, 'us'));
  },
  (r, d) => {
    const tau = pick(r, [1, 2, 5, 10]);
    const frac = pick(r, tier(d, [63.2, 86.5, 95], [50, 90, 99], [75, 99.9, 30]));
    const t = -tau * Math.log(1 - frac / 100);
    return walk(ask(`An RC with τ = ${tau} µs charges from 0 toward its supply. How long until it reaches ${frac}% of the final value, in µs?`, qty(t, 'us', 0.02), `v(t) = V(1 - e^(-t/τ)) → t = -τ·ln(1 - ${frac / 100}) = ${t.toFixed(2)} µs.`, 't = -τ ln(1 - fraction).'),
      'solve the charging curve for time', 'A charging RC follows v(t) = V(1 - e^(-t/τ)). The fraction still missing is e^(-t/τ). Take the natural log of the missing fraction to undo the exponential: t = -τ × ln(missing fraction).',
      calc(`What fraction is still missing at ${frac}%?`, `1 - ${frac / 100}`, 1 - frac / 100, '', sig(1 - frac / 100, 4), 0.001),
      calc('Take its natural log (ln):', `ln(${sig(1 - frac / 100, 4)})`, Math.log(1 - frac / 100), '', sig(Math.log(1 - frac / 100))),
      calc('Multiply by -τ:', `-${tau} × ${sig(Math.log(1 - frac / 100))}`, t, 'us', undefined, 0.02));
  },
  (r, d) => {
    const V = pick(r, [1, 3.3, 5]);
    const tau = pick(r, [1, 2, 10]);
    const t = pick(r, tier(d, [tau, 2 * tau], [0.5 * tau, 3 * tau], [0.3 * tau, 1.7 * tau]));
    const discharge = d >= 2 && r() < 0.5;
    const v = discharge ? V * Math.exp(-t / tau) : V * (1 - Math.exp(-t / tau));
    const e = Math.exp(-t / tau);
    return walk(ask(`A ${V} V RC circuit (τ = ${tau} ms) ${discharge ? 'discharges from' : 'charges from 0 toward'} ${V} V. What is the capacitor voltage after ${+t.toFixed(2)} ms, in V?`, qty(v, 'V', 0.02), discharge ? `v = ${V}·e^(-${+t.toFixed(2)}/${tau}) = ${v.toFixed(3)} V.` : `v = ${V}(1 - e^(-${+t.toFixed(2)}/${tau})) = ${v.toFixed(3)} V.`, discharge ? 'v = V e^(-t/τ).' : 'v = V (1 - e^(-t/τ)).'),
      discharge ? 'the discharge curve' : 'the charging curve', `An RC circuit moves toward its target exponentially. The part of the journey still left after time t is e^(-t/τ). ${discharge ? 'Discharging, the voltage left is exactly that fraction of the start: v = V·e^(-t/τ).' : 'Charging from 0, the voltage reached is the rest: v = V·(1 - e^(-t/τ)).'}`,
      calc('How many time constants have passed?', `t/τ = ${+t.toFixed(2)} / ${tau}`, t / tau, '', sig(t / tau)),
      calc('The fraction of the journey still left:', `e^(-${sig(t / tau)})`, e, '', sig(e)),
      discharge ? calc('Voltage left on the capacitor:', `${V} × ${sig(e)}`, v, 'V', undefined, 0.02)
        : calc('Voltage reached so far:', `${V} × (1 - ${sig(e)})`, v, 'V', undefined, 0.02));
  },
  (r, d) => {
    const R = pick(r, [1e3, 1.6e3, 10e3, 50]), C = pick(r, [1e-9, 100e-9, 1e-6, 10e-12]);
    const f = 1 / (2 * Math.PI * R * C);
    const idea = 'An RC low-pass passes low frequencies and cuts high ones. The corner (-3 dB) frequency is where the capacitor\'s reactance equals R: f = 1/(2πRC), with R in ohms and C in farads giving hertz.';
    if (d < 3) return walk(ask(`RC low-pass with R = ${eng(R, 'Ω')} and C = ${eng(C, 'F')}. What is the -3 dB cutoff frequency?`, qty(f, 'Hz'), `f = 1/(2πRC) = ${eng(f, 'Hz')}.`, 'f = 1 / (2πRC).'),
      'the RC corner frequency', idea,
      calc('First RC (ohms × farads = seconds):', `${R} × ${C}`, R * C, 's', sig(R * C)),
      calc('Multiply by 2π:', `2π × ${sig(R * C)}`, 2 * Math.PI * R * C, 's', sig(2 * Math.PI * R * C)),
      calc('Flip it to get hertz:', `1 / ${sig(2 * Math.PI * R * C)}`, f, 'Hz'));
    const fc = pick(r, [1e3, 10e3, 100e3]);
    const c2 = 1 / (2 * Math.PI * R * fc);
    return walk(ask(`You need a ${eng(fc, 'Hz')} cutoff and R is fixed at ${eng(R, 'Ω')}. What C do you need, in nF?`, qty(c2 * 1e9, 'nF', 0.02), `C = 1/(2π·R·f) = ${eng(c2, 'F')}.`, 'Rearrange f = 1/(2πRC).'),
      'rearrange the corner-frequency formula', `${idea} Solving for C: C = 1/(2π·R·f).`,
      calc('Compute 2π × R × f:', `2π × ${R} × ${fc}`, 2 * Math.PI * R * fc, '', sig(2 * Math.PI * R * fc)),
      calc('Flip it to get farads:', `1 / ${sig(2 * Math.PI * R * fc)}`, c2, 'F', sig(c2)),
      calc('Convert to nF (× 10^9):', `${sig(c2)} × 10^9`, c2 * 1e9, 'nF', undefined, 0.02));
  },
  (r, d) => {
    const C = pick(r, [1e-6, 10e-6, 100e-6, 1e-12]), V = pick(r, [1, 3.3, 5, 12]);
    const which = d === 1 ? 0 : between(r, 0, 1);
    if (which === 0) return walk(ask(`How much charge is on ${eng(C, 'F')} at ${V} V, in coulombs? (scientific notation is fine, e.g. 3.3e-6)`, qty(C * V, ''), `Q = CV = ${(C * V).toExponential(3)} C.`, 'Q = C × V.'),
      'Q = C × V', 'Capacitance is charge stored per volt: a 1 F capacitor holds 1 coulomb at 1 volt. So charge = capacitance (in farads) × voltage. Prefixes: µ = 10^-6, p = 10^-12.',
      calc(`${eng(C, 'F')} in farads:`, eng(C, 'F'), C, '', String(C)),
      calc('Multiply by the voltage:', `${C} × ${V}`, C * V, '', (C * V).toExponential(2)));
    const E = 0.5 * C * V * V;
    return walk(ask(`How much energy is stored in ${eng(C, 'F')} at ${V} V, in joules?`, qty(E, ''), `E = ½CV² = ${E.toExponential(3)} J. Charging a gate's capacitance from a supply also burns an equal ½CV² in the pull-up, so each full charge/discharge cycle costs CV²: the root of the dynamic power formula.`, 'E = ½ C V².'),
      'E = ½CV²', 'The energy in a capacitor grows with the square of the voltage: E = ½ × C × V², with C in farads and V in volts giving joules. Doubling the voltage stores four times the energy.',
      calc('Square the voltage:', `${V}²`, V * V, '', sig(V * V)),
      calc('Multiply by C (in farads):', `${C} × ${sig(V * V)}`, C * V * V, '', (C * V * V).toExponential(2)),
      calc('Halve it:', `½ × ${(C * V * V).toExponential(2)}`, E, '', E.toExponential(2)));
  },
]);

export const mosPractice = practice('practice-mos', 'Transistor Drills', 'NMOS/PMOS switching, CMOS gates, transistor counts', [
  (r, d) => {
    const n = tier(d, between(r, 2, 3), between(r, 3, 4), between(r, 4, 6));
    const g = pick(r, ['NAND', 'NOR']);
    return walk(ask(`How many transistors does a static CMOS ${n}-input ${g} gate need?`, num(2 * n), `One NMOS and one PMOS per input: ${2 * n}. The ${g === 'NAND' ? 'NMOS in series, PMOS in parallel' : 'NMOS in parallel, PMOS in series'}.`, 'Each input drives one NMOS and one PMOS.'),
      'one pull-down and one pull-up per input', 'A static CMOS gate has two networks: NMOS transistors that pull the output to ground, and PMOS transistors that pull it to Vdd. Every input must be able to switch both networks, so each input drives exactly one NMOS and one PMOS.',
      count('Transistors per input:', '1 NMOS + 1 PMOS', 2),
      count(`Total for ${n} inputs:`, `${n} × 2`, 2 * n));
  },
  (r, d) => {
    const g = pick(r, d === 1 ? ['NAND', 'NOR'] : ['NAND', 'NOR', 'NAND3', 'NOR3']);
    const nand = g.startsWith('NAND');
    const net = pick(r, ['pull-down (NMOS)', 'pull-up (PMOS)']);
    const series = nand === net.startsWith('pull-down');
    return walk(mc(`In a CMOS ${g} gate, how are the transistors of the ${net} network connected?`, ['In series: each must be on', 'In parallel: one is enough'], series ? 0 : 1, `${g}: output low only when ${nand ? 'all inputs are 1 (series NMOS)' : 'any input is 1 (parallel NMOS)'}; the PMOS network is always the dual.`),
      'series = AND, parallel = OR', 'Transistors are switches. Switches in series conduct only if ALL are on (AND); in parallel if ANY is on (OR). Ask when the output is pulled low: that condition is the NMOS network. The PMOS network is always the opposite arrangement (the dual).',
      choice(`When is a ${g}'s output 0?`, nand ? 'When every input is 1' : 'When any input is a 1', [nand ? 'When any input is a 1' : 'When every input is 1']),
      choice('So the NMOS pull-down network (an NMOS is on when its input is 1) is:', nand ? 'In series: each must be on' : 'In parallel: one is enough', [nand ? 'In parallel: one is enough' : 'In series: each must be on'], 'Series needs all switches on; parallel needs any one.'),
      'And the PMOS pull-up network is always the opposite of the NMOS one.');
  },
  (r, d) => {
    const g = pick(r, d === 1 ? ['AND', 'OR'] : ['AND', 'OR', 'XOR', 'AOI21', 'OAI21', 'MUX2']);
    const counts: Record<string, [number, string]> = { AND: [6, 'NAND2 (4) + inverter (2)'], OR: [6, 'NOR2 (4) + inverter (2)'], XOR: [12, 'a common static CMOS XOR2 uses 12 (transmission-gate designs use fewer)'], AOI21: [6, 'one complex gate: 3 NMOS + 3 PMOS'], OAI21: [6, 'one complex gate: 3 NMOS + 3 PMOS'], MUX2: [12, 'AOI22 (8) + an inverter on select (2) + output inverter (2)'] };
    const [n, why] = counts[g];
    const parts: Record<string, Part[]> = {
      AND: [count('A NAND2 has 2 inputs, each with an NMOS and a PMOS:', '2 × 2', 4), count('Add an inverter (1 NMOS + 1 PMOS) to turn NAND into AND:', '4 + 2', 6)],
      OR: [count('A NOR2 has 2 inputs, each with an NMOS and a PMOS:', '2 × 2', 4), count('Add an inverter (1 NMOS + 1 PMOS) to turn NOR into OR:', '4 + 2', 6)],
      XOR: ['The standard design builds ~a and ~b with two inverters, then one complex gate computes a·~b + ~a·b, inverted, using all four signals.', count('Two inverters:', '2 × 2', 4), count('The complex gate has 4 inputs (a, b, ~a, ~b), each with one NMOS and one PMOS:', '4 × 2', 8), count('Total:', '4 + 8', 12)],
      AOI21: [`AOI21 computes ~(a·b + c) in a single inverting stage: no extra inverters needed.`, count('It has 3 inputs, each with one NMOS and one PMOS:', '3 × 2', 6)],
      OAI21: [`OAI21 computes ~((a + b)·c) in a single inverting stage: no extra inverters needed.`, count('It has 3 inputs, each with one NMOS and one PMOS:', '3 × 2', 6)],
      MUX2: ['The MUX computes s·b + ~s·a. An AOI22 gives the inverted version ~(s·b + ~s·a) in one stage, but it needs ~s, and its output must be inverted back.', count('AOI22: 4 inputs, each with one NMOS and one PMOS:', '4 × 2', 8), count('Plus an inverter for ~s and one on the output:', '8 + 2 + 2', 12)],
    };
    return walk(ask(`Minimum transistor count for a static CMOS ${g}${g === 'XOR' ? ' (standard complementary design)' : g === 'MUX2' ? ' built as AOI22 plus inverters' : ''}?`, num(n), `${n}: ${why}. CMOS gates are naturally inverting, which is why AOI/OAI cells are so efficient.`, 'Build the inverting version, then add inverters where needed.'),
      'build it from inverting stages', 'A single CMOS stage can only make INVERTING functions (NAND, NOR, AOI, OAI), with one NMOS and one PMOS per input. A non-inverting function needs an inverting stage plus an inverter (2 transistors). Count each stage and add them up.',
      ...parts[g]);
  },
  (r, d) => {
    const vdd = pick(r, tier(d, [0.8, 1.0, 1.2, 1.8], [0.8, 1.0, 1.2, 1.8], [0.6, 0.9, 1.5, 2.5]));
    const vt = pick(r, tier(d, [0.3, 0.4], [0.3, 0.4], [0.25, 0.35, 0.45]));
    const typ = pick(r, ['NMOS', 'PMOS']);
    const steps = d === 3 ? 20 : 10;
    const vg = +(between(r, 0, steps) / steps * vdd).toFixed(2);
    const vs = typ === 'NMOS' ? 0 : vdd;
    const on = typ === 'NMOS' ? vg - vs > vt : vs - vg > vt;
    const ov = typ === 'NMOS' ? vg - vs : vs - vg;
    return walk(mc(`${typ}, source at ${vs} V, |Vt| = ${vt} V, gate at ${vg} V (Vdd = ${vdd}). Is the channel on?`, ['Yes, it is on', 'No, it is off'], on ? 0 : 1, `${typ === 'NMOS' ? `Vgs = ${+(vg - vs).toFixed(2)} V` : `Vsg = ${+(vs - vg).toFixed(2)} V`} ${on ? '>' : '≤'} ${vt} V, so it is ${on ? 'on' : 'off (only subthreshold leakage flows)'}.${d === 3 ? ' In between, the transistor is partially on: that is where both networks conduct and short-circuit current flows.' : ''}`),
      'compare the gate drive with Vt', typ === 'NMOS'
        ? 'An NMOS turns on when its gate is at least a threshold voltage Vt ABOVE its source: Vgs = Vg - Vs > Vt.'
        : 'A PMOS is the mirror image: it turns on when its gate is at least |Vt| BELOW its source: Vsg = Vs - Vg > |Vt|. Its source usually sits at Vdd.',
      calc(`Compute the gate drive, ${typ === 'NMOS' ? 'Vgs = Vg - Vs' : 'Vsg = Vs - Vg'}:`, typ === 'NMOS' ? `${vg} - ${vs}` : `${vs} - ${vg}`, ov, 'V', String(+ov.toFixed(2)), 0.001),
      choice(`Is ${+ov.toFixed(2)} V more than |Vt| = ${vt} V?`, on ? 'Yes, above it' : 'No, not above', [on ? 'No, not above' : 'Yes, above it']));
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
    { t: 'mc', q: 'The ADC samples by briefly connecting a 10 pF capacitor. Why does a big filter capacitor on the input help?', options: ['It raises the voltage the ADC sees', 'It is a charge reservoir for the sampler', 'It lowers the noise of the ADC reference', 'It speeds up the divider settling'], a: 1, why: 'The sampling cap is charged from the reservoir instead of through the 25 kΩ source, avoiding a sampling error. Charge sharing: a 100 nF reservoir barely moves when a 10 pF sampler connects. Without it, the high source impedance could not recharge the sampler in time.' },
  ],
  recap: ['Divider design + loading + Thevenin resistance + RC settling.'],
});

export const FOUNDATION_BOSSES = [numbersBoss, circuitsBoss];

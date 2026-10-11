import { describe, expect, it } from 'vitest';
import { bin, compileBool, expr, hexa, num, parseQuantity, qty } from './answers';

// The forgiving parser: what engineers actually type. Each case was probed against the real checkers.
describe('quantities', () => {
  it('reads the usual SI spellings', () => {
    expect(parseQuantity('4.7k', 'Ω')).toBe(4700);
    expect(parseQuantity('2500ps', 'ns')).toBeCloseTo(2.5);
    expect(parseQuantity('1.6 kHz', 'Hz')).toBe(1600);
  });
  it('accepts the micro sign written as Greek mu (U+03BC) as well as the micro sign (U+00B5)', () => {
    expect(parseQuantity('1 µA', 'A')).toBeCloseTo(1e-6);
    expect(parseQuantity('1 μA', 'A')).toBeCloseTo(1e-6);
    expect(qty(1e-6, 'A').check('1 μA')).toBe(true);
  });
  it('accepts a capital K for kilo, as in "4.7K" and "100 KHz", but still reads K alone as kelvin', () => {
    expect(parseQuantity('4.7K', 'Ω')).toBe(4700);
    expect(parseQuantity('100 KHz', 'Hz')).toBe(1e5);
    expect(parseQuantity('300 K', 'K')).toBe(300);
  });
  it('accepts the SPICE spelling "meg" for mega, in any case', () => {
    expect(parseQuantity('4.7meg', 'Ω')).toBeCloseTo(4.7e6);
    expect(parseQuantity('4.7 MEG', 'Ω')).toBeCloseTo(4.7e6);
  });
  it('still rejects a different unit and a wrong prefix', () => {
    expect(qty(1e-12, 'F').check('1 pH')).toBe(false);
    expect(qty(1e-6, 'A').check('1 mA')).toBe(false);
    expect(qty(5, 'V').check('5 mV')).toBe(false);
  });
});

describe('integers', () => {
  it('accepts thousands separators in the usual grouping, as quantities already do', () => {
    expect(num(10000).check('10,000')).toBe(true);
    expect(num(1234567).check('1,234,567')).toBe(true);
    expect(num(1).check('1,5')).toBe(false);
  });
  it('accepts a decimal exponent that lands on a whole number', () => {
    expect(num(10000).check('1e4')).toBe(true);
    expect(num(10).check('1e1')).toBe(true);
    expect(num(10).check('1e0')).toBe(false);
  });
  it('keeps the base rules: a bare hex-looking word is not a decimal', () => {
    expect(num(31).check('1f')).toBe(false);
    expect(hexa(31).check('1F')).toBe(true);
    expect(bin(5, 4).check('0101')).toBe(true);
  });
});

// Near misses name the kind of slip and never give the value away.
describe('near-miss messages', () => {
  const correctValueLeaks = (msg: string, values: string[]) => values.some((v) => msg.includes(v));

  it('a quantity off by a power of 1000 names the prefix, not which one', () => {
    const a = qty(4700, 'Ω');
    for (const typed of ['4.7', '4.7M', '0.0047']) {
      const msg = a.near!(typed);
      expect(msg, typed).toMatch(/prefix/i);
      expect(correctValueLeaks(msg!, ['4700', '4.7k', '4.7 k', '4,700', '4.7 kΩ'])).toBe(false);
    }
  });
  it('a quantity with the sign flipped says so', () => {
    expect(qty(4700, 'Ω').near!('-4.7k')).toMatch(/sign/i);
  });
  it('a quantity in the wrong kind of unit names the kind it is, and the kind asked for', () => {
    expect(qty(1e-3, 'A').near!('1 V')).toBe('That is a voltage; the question asks for a current.');
    expect(qty(5, 'V').near!('5 Ω')).toBe('That is a resistance; the question asks for a voltage.');
    // A prefixed unit ("mA") names the kind of its base unit, as a lesson question does.
    expect(qty(5, 'mA').near!('5 V')).toBe('That is a voltage; the question asks for a current.');
  });
  it('a far-off answer gives no near message', () => {
    expect(qty(4700, 'Ω').near!('5k')).toBeUndefined();
    expect(qty(4700, 'Ω').near!('12')).toBeUndefined();
  });
  it('a correct answer gives no near message', () => {
    expect(qty(4700, 'Ω').near!('4.8k')).toBeUndefined();
  });
  it('an integer off by one says to check counting from 0 or 1', () => {
    expect(num(10).near!('11')).toMatch(/0 or 1/);
    expect(num(10).near!('9')).toMatch(/0 or 1/);
  });
  it('an integer off by more than one gives no near message', () => {
    expect(num(10).near!('12')).toBeUndefined();
    expect(num(10).near!('abc')).toBeUndefined();
  });
  it('the right value in the wrong base says so, for hex answers typed in decimal', () => {
    expect(hexa(31).near!('31')).toBe('Right value, wrong base.');
    expect(hexa(31).near!("8'd31")).toBe('Right value, wrong base.');
  });
  it('the right value in the wrong base says so, for integer answers typed in hex', () => {
    expect(num(31).near!('1F')).toBe('Right value, wrong base.');
  });
  it('a hex answer one off gets the counting message, and no message names the answer', () => {
    expect(hexa(31).near!('1E')).toMatch(/0 or 1/);
    for (const [a, typed] of [[hexa(31), '31'], [num(31), '1F'], [num(10), '11']] as const) {
      expect(correctValueLeaks(a.near!(typed)!, ['31', '1F', '1f', '0x1F', '10', '0x0A'])).toBe(false);
    }
  });
});

describe('boolean expressions', () => {
  const xor = expr('a^b', ['a', 'b'], (v) => v.a !== v.b);
  it('reads the word XOR as ^', () => {
    expect(xor.check('a XOR b')).toBe(true);
    expect(xor.check('a xor b')).toBe(true);
  });
  it('reads the XOR symbol and middle dot / times as operators', () => {
    expect(xor.check('a⊕b')).toBe(true);
    const and = expr('a·b', ['a', 'b'], (v) => v.a && v.b);
    expect(and.check('a·b')).toBe(true);
    expect(and.check('a⋅b')).toBe(true);
    expect(and.check('a×b')).toBe(true);
  });
  it('reads the words and / or / not', () => {
    expect(expr('a&b', ['a', 'b'], (v) => v.a && v.b).check('a and b')).toBe(true);
    expect(expr('a|b', ['a', 'b'], (v) => v.a || v.b).check('a or b')).toBe(true);
    expect(expr('!a', ['a'], (v) => !v.a).check('not a')).toBe(true);
  });
  it('still rejects a wrong formula', () => {
    expect(expr('x', ['a', 'b'], (v) => v.a !== v.b).check("a'b")).toBe(false);
    expect(compileBool('a b c', ['a', 'b', 'c'])).not.toBeNull(); // adjacency still means AND
  });
});

import { describe, expect, it } from 'vitest';
import { bin, hexa, num, qty, parseQuantity } from './answers';

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


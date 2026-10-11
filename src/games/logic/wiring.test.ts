import { describe, expect, it } from 'vitest';
import { displayNames, nearestTarget, wireStep, type Target } from './wiring';

const label = (ref: string) => ({ 'nand1.y': 'NAND1.y', 'out.a': 'OUT', 'nand1.a': 'NAND1.a' } as Record<string, string>)[ref] ?? ref;

describe('the wiring state machine (idle → first pin → wired or cancelled)', () => {
  it('starts idle; the first pin is chosen and waits for a second', () => {
    const s = wireStep({}, { t: 'pin', ref: 'nand1.y' }, label);
    expect(s.state).toEqual({ from: 'nand1.y' });
    expect(s.connect).toBeUndefined();
    expect(s.message).toBe('Wiring from NAND1.y. Pick a second pin, or press Escape to cancel.');
  });
  it('a second pin wires the two, and the machine is idle again, with the announcement', () => {
    const s = wireStep({ from: 'nand1.y' }, { t: 'pin', ref: 'out.a' }, label);
    expect(s.state).toEqual({});
    expect(s.connect).toEqual(['nand1.y', 'out.a']);
    expect(s.message).toBe('Wired NAND1.y to OUT');
  });
  it('Escape cancels a half-made wire', () => {
    const s = wireStep({ from: 'nand1.y' }, { t: 'cancel' }, label);
    expect(s.state).toEqual({});
    expect(s.connect).toBeUndefined();
    expect(s.message).toBe('Wire cancelled.');
  });
  it('Escape when idle does nothing and says nothing', () => {
    const s = wireStep({}, { t: 'cancel' }, label);
    expect(s).toEqual({ state: {}, message: '' });
  });
  it('the same pin twice cancels rather than wiring a pin to itself', () => {
    const s = wireStep({ from: 'nand1.a' }, { t: 'pin', ref: 'nand1.a' }, label);
    expect(s.state).toEqual({});
    expect(s.connect).toBeUndefined();
    expect(s.message).toBe('Wire cancelled.');
  });
});

describe('display names', () => {
  it('numbers parts of the same kind, and keeps a part\'s own label', () => {
    const names = displayNames([
      { id: 'in_a', kind: 'IN', label: 'a' },
      { id: 'nand_1', kind: 'NAND' },
      { id: 'nand_2', kind: 'NAND' },
      { id: 'out_y', kind: 'OUT', label: 'OUT' },
    ]);
    expect(names.get('nand_1')).toBe('NAND1');
    expect(names.get('nand_2')).toBe('NAND2');
    expect(names.get('in_a')).toBe('a');
    expect(names.get('out_y')).toBe('OUT');
  });
});

describe('moving the keyboard cursor', () => {
  const t = (x: number, y: number, ref?: string): Target => ({ x, y, ref });
  const pins = [t(0, 0, 'a.y'), t(100, 0, 'b.a'), t(100, 80, 'b.b'), t(40, 200, 'c.a')];

  it('moves to the nearest target ahead in the direction', () => {
    expect(nearestTarget(pins, { x: 0, y: 0 }, 'right')?.ref).toBe('b.a');
    expect(nearestTarget(pins, { x: 100, y: 0 }, 'down')?.ref).toBe('b.b');
    expect(nearestTarget(pins, { x: 100, y: 80 }, 'down')?.ref).toBe('c.a');
  });
  it('ignores targets that are not ahead, or are more than 45 degrees off the direction', () => {
    expect(nearestTarget(pins, { x: 100, y: 0 }, 'left')?.ref).toBe('a.y');
    // c.a is far below and to the side: not "right" from b.b
    expect(nearestTarget([t(0, 0, 'p'), t(10, 300, 'q')], { x: 0, y: 0 }, 'right')).toBeUndefined();
  });
  it('returns nothing when there is no target that way', () => {
    expect(nearestTarget(pins, { x: 0, y: 0 }, 'up')).toBeUndefined();
  });
});

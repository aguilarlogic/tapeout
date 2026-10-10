import { describe, expect, it } from 'vitest';
import { ACTS } from '../curriculum';
import { complete } from '../state';
import { actFractions, litRows, movedActs, signedOffLabel } from './die-state';

describe('chip die: progress to fill', () => {
  it('lights whole rows, rounded, and never more than the block has', () => {
    expect(litRows(0, 5)).toBe(0);
    expect(litRows(1, 5)).toBe(5);
    expect(litRows(0.5, 4)).toBe(2);
    expect(litRows(0.4, 5)).toBe(2);
    expect(litRows(-1, 3)).toBe(0);
    expect(litRows(2, 3)).toBe(3);
  });

  it('labels a block with its act number, name and percentage signed off', () => {
    expect(signedOffLabel(3, 'Digital Design', 0.4)).toBe('Act 3, Digital Design: 40% signed off');
    expect(signedOffLabel(1, 'Foundations', 0)).toBe('Act 1, Foundations: 0% signed off');
  });
});

describe('chip die: completing a level lights the right block', () => {
  it('only the act the level belongs to moves', () => {
    const before = actFractions();
    const digital = ACTS.findIndex((a) => a.name === 'Digital Design');
    const lesson = ACTS[digital].chapters.flatMap((c) => c.modules).find((m) => m.kind === 'lesson')!;
    complete(lesson.id, 40, 3);
    expect(movedActs(before, actFractions())).toEqual([digital]);
  });

  it('nothing moves when no progress is made', () => {
    const snapshot = actFractions();
    expect(movedActs(snapshot, actFractions())).toEqual([]);
  });
});

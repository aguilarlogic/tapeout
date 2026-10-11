import { describe, expect, it } from 'vitest';
import { goalSummary } from './types';

describe('arch status line names the first goal not met', () => {
  it('counts the misses and names the first one with its reading', () => {
    const goals = [
      { label: 'Stalls ≤ 2', ok: true },
      { label: 'IPC ≥ 1.4', ok: false, note: 'IPC is 1.12' },
      { label: 'Area ≤ 300', ok: true },
      { label: 'Power ≤ 1 W', ok: false, note: 'power is 1.3 W' },
    ];
    expect(goalSummary(goals)).toBe('2 of 4 goals not met: IPC ≥ 1.4 (IPC is 1.12)');
  });

  it('names the goal without a note when it has none', () => {
    expect(goalSummary([{ label: 'Stalls ≤ 2', ok: false }, { label: 'Area', ok: true }])).toBe('1 of 2 goals not met: Stalls ≤ 2');
  });
});

import { describe, expect, it } from 'vitest';
import { BURST_MS, UNDO_CAP, UndoHistory } from './undo';

describe('undo history: push and undo', () => {
  it('undo returns the state each change replaced, newest first', () => {
    const hist = new UndoHistory<number>();
    hist.record(1, 'a', 0);
    hist.record(2, 'b', 10_000);
    hist.record(3, 'c', 20_000);
    expect(hist.size).toBe(3);
    expect(hist.undo()).toBe(3);
    expect(hist.undo()).toBe(2);
    expect(hist.undo()).toBe(1);
    expect(hist.undo()).toBeUndefined();
  });
});

describe('undo history: cap', () => {
  it('keeps the newest 100 steps and drops the oldest', () => {
    expect(UNDO_CAP).toBe(100);
    const hist = new UndoHistory<number>();
    for (let i = 0; i < 150; i++) hist.record(i, `k${i}`, i * 10_000);
    expect(hist.size).toBe(100);
    let last: number | undefined, count = 0;
    while (hist.size) { last = hist.undo(); count++; }
    expect(count).toBe(100);
    expect(last).toBe(50); // the first 50 snapshots were dropped; 50 is the oldest kept
  });
});

describe('undo history: bursts', () => {
  it('a run of changes to one control, closer together than the gap, is one step', () => {
    const hist = new UndoHistory<string>();
    // A slider drag: 40 changes, 50 ms apart, each replacing the value before it.
    for (let i = 0; i < 40; i++) hist.record(`v${i}`, 'rate', i * 50);
    expect(hist.size).toBe(1);
    expect(hist.undo()).toBe('v0'); // the state before the drag began
  });

  it('a change to another control starts a new step', () => {
    const hist = new UndoHistory<string>();
    hist.record('a0', 'rate', 0);
    hist.record('a1', 'rate', 50);
    hist.record('b0', 'size', 100);
    expect(hist.size).toBe(2);
    expect(hist.undo()).toBe('b0'); // undoing the 'size' change restores the state it replaced
    expect(hist.undo()).toBe('a0'); // the whole 'rate' drag is one step, back to where it began
  });

  it('a pause longer than the gap ends the burst', () => {
    const hist = new UndoHistory<string>();
    hist.record('x0', 'rate', 0);
    hist.record('x1', 'rate', BURST_MS + 1);
    expect(hist.size).toBe(2);
  });

  it('undo ends a burst, so the next change to the same control is a new step', () => {
    const hist = new UndoHistory<string>();
    hist.record('p0', 'rate', 0);
    hist.undo();
    hist.record('p1', 'rate', 10);
    expect(hist.size).toBe(1);
  });
});

describe('undo history: clear', () => {
  it('clear empties the history', () => {
    const hist = new UndoHistory<number>();
    hist.record(1, 'a', 0);
    hist.clear();
    expect(hist.size).toBe(0);
    expect(hist.undo()).toBeUndefined();
  });
});

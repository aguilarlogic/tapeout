import { describe, expect, it } from 'vitest';
import { ACTIONS } from './bindings';
import { AIM_ASSIST_OPTIONS, padRows, TOUCH_NOTES } from './controlsinfo';
import { PAD_BUTTONS } from './padmap';

describe('controls screen text', () => {
  it('lists the sticks first, then one row per pad button', () => {
    const rows = padRows();
    expect(rows.slice(0, 2)).toEqual([['Move', 'Left stick'], ['Aim', 'Right stick']]);
    expect(rows).toHaveLength(2 + PAD_BUTTONS.length);
    PAD_BUTTONS.forEach((b, i) => {
      const action = ACTIONS.find((a) => a.id === b.action);
      expect(rows[i + 2]).toEqual([action?.label, b.name]);
    });
  });

  it('names real actions and buttons in the table', () => {
    const rows = padRows();
    expect(rows).toContainEqual(['Interact', 'X']);
    expect(rows).toContainEqual(['Field Coil', 'LT']);
    expect(rows).toContainEqual(['Previous weapon', 'LB']);
    expect(rows).toContainEqual(['Pause', 'Start']);
    expect(rows.every(([what, button]) => what.length > 0 && button.length > 0)).toBe(true);
  });

  it('keeps the touch notes short, plain and free of dashes', () => {
    expect(TOUCH_NOTES).toHaveLength(3);
    expect(TOUCH_NOTES[0]).toBe('Left side: a stick appears where your thumb lands. Push it up to jump.');
    for (const line of TOUCH_NOTES) {
      expect(line).not.toMatch(/[–—]| - /);
      expect(line).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('offers Auto, On and Off for aim assist, in that order', () => {
    expect(AIM_ASSIST_OPTIONS).toEqual([
      { value: 'auto', label: 'Auto' },
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ]);
  });
});

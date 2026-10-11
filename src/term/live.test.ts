import { describe, expect, it } from 'vitest';
import { progressBar, spinFrame, spokenLine } from './typewriter';

describe('spokenLine (what the screen-reader log is given for a finished line)', () => {
  it('drops spinner and progress-bar glyphs', () => {
    expect(spokenLine(`${spinFrame(0)} loading mentor.ko ${progressBar(0.5, 8)} ✓`)).toBe('loading mentor.ko ✓');
  });

  it('collapses spaces and trims', () => {
    expect(spokenLine('  tapeout›   Hello \n  there ')).toBe('tapeout› Hello there');
  });

  it('is empty for a line with nothing to say', () => {
    expect(spokenLine(` ${progressBar(0, 4)} `)).toBe('');
  });
});

// Phase 10 Spec, section 2.1: the text size setting. Every canvas font in the HUD, the story renderer, the touch labels and
// the ending must go through px(), so no font string may carry a bare pixel size. px() itself must scale at 125 and 150.
import { afterEach, describe, expect, it } from 'vitest';
import endingSrc from '../story/ending.ts?raw';
import renderSrc from '../story/render.ts?raw';
import hudSrc from './hud.ts?raw';
import { px, setTextSize } from './palette';
import touchSrc from './touch.ts?raw';

/** The four files whose canvas text sizes go through px(), as source text. */
const FILES: Record<string, string> = { 'render/hud.ts': hudSrc, 'story/render.ts': renderSrc, 'render/touch.ts': touchSrc, 'story/ending.ts': endingSrc };

/** A font string with a literal pixel size, such as `bold 13px ${FONT}`. */
const BARE_FONT = /\d+px \$\{FONT\}/;

afterEach(() => setTextSize(100));

describe('text size', () => {
  it('px scales a size by the text size setting', () => {
    setTextSize(100);
    expect(px(13)).toBe(13);
    setTextSize(125);
    expect(px(13)).toBe(16);
    setTextSize(150);
    expect(px(13)).toBe(20);
  });

  it('no canvas font in the four files has a bare pixel size', () => {
    const bare: string[] = [];
    for (const [file, src] of Object.entries(FILES)) {
      src.split('\n').forEach((line, i) => {
        if (BARE_FONT.test(line)) bare.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bare).toEqual([]);
  });
});

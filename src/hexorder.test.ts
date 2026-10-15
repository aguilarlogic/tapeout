import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from './curriculum';
import { textOf } from './contenttext';
import { HEX_LESSON, HEX_PATTERN } from './hexgate';

describe('hexadecimal is taught before it is used', () => {
  const at = ALL_MODULES.findIndex((m) => m.id === HEX_LESSON);

  it('has a hex lesson on the main path', () => {
    expect(at).toBeGreaterThan(0);
  });

  it('shows no hex in anything the player meets before the hex lesson', () => {
    const offenders: string[] = [];
    for (const m of ALL_MODULES.slice(0, at)) {
      const hit = textOf(m).find((t) => HEX_PATTERN.test(t));
      if (hit) offenders.push(`${m.id}: "${hit.match(HEX_PATTERN)![0]}" in ${JSON.stringify(hit.slice(0, 80))}`);
    }
    expect(offenders).toEqual([]);
  });
});

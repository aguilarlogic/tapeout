import { describe, expect, it } from 'vitest';
import { ALL_MODULES } from './curriculum';
import { ALL_RTL } from './games/rtl/levels';
import { LOGIC_LEVELS } from './games/logic/levels';
import { findIncident } from './incidents';
import { findLesson } from './lessons';
import { findBoss, findPractice } from './practice';
import type { Step } from './lessons/types';
import { HEX_LESSON, HEX_PATTERN, strings } from './hexgate';

/** A tiny seeded generator, so a failure names the same text every run. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

function stepText(steps: Step[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.t === 'gen') for (let seed = 1; seed <= 25; seed++) strings(s.make(rng(seed)), out);
    else strings(s, out);
  }
  return out;
}

/** All the text a module shows, as far as the tests can reach it. */
function textOf(m: { id: string; kind: string }): string[] {
  if (m.kind === 'lesson') return stepText(findLesson(m.id)?.steps ?? []);
  if (m.kind === 'boss') return stepText(findBoss(m.id)?.steps ?? []);
  if (m.kind === 'practice') {
    const set = findPractice(m.id);
    const out: string[] = [];
    for (const g of set?.gens ?? []) for (const d of [1, 2, 3] as const) for (let seed = 1; seed <= 25; seed++) strings(g(rng(seed), d), out);
    return out;
  }
  if (m.kind === 'logic' || m.kind === 'cmos') return strings(LOGIC_LEVELS.find((l) => l.id === m.id));
  if (m.kind === 'rtl' || m.kind === 'debug') {
    const l = ALL_RTL.find((x) => x.id === m.id);
    return l ? strings([l.title, l.concept, l.brief, l.starter, l.hints]) : [];
  }
  if (m.kind === 'incident') return strings(findIncident(m.id));
  return [];
}

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

// Phase 10 Spec, section 6: the README's numbers are counted from the code, never copied. This test counts the course
// (modules, lessons, labs by kind, incidents, minigames, story places, rooms, bosses, upgrades, roles in the Hiring Hall),
// prints the table, and checks that README.md says each count next to its noun. The test count is left out on purpose:
// it changes with every change, so README.md gives it rounded down to the hundred ("7500+ tests").
import { describe, expect, it } from 'vitest';

/** The README's line limit (Phase 10 Spec, section 6). */
const MAX_LINES = 250;
/** Labs are every module kind that is not a lesson, a practice set, a checkpoint, an incident, or the two review kinds. */
const NOT_LABS = ['lesson', 'practice', 'boss', 'incident', 'drills', 'final'];

// The state module reads localStorage at import time; a plain stub is enough (no jsdom in this project).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const { ACTS, ALL_MODULES } = await import('./curriculum');
const { PLACES } = await import('./game/world/places');
const { roomsOf } = await import('./game/world/compose');
const { LEVEL1 } = await import('./game/story/level1');
const { INCIDENTS } = await import('./incidents');
const { MINIGAMES } = await import('./minigames/apps');
const { UPGRADES } = await import('./game/world/upgrades');
const { ROLES } = await import('./mastery/skills');

// The two text files are read with Vite's raw import (no Node types in this project's tsconfig).
const README = Object.values(import.meta.glob<string>('../README.md', { query: '?raw', import: 'default', eager: true }))[0];
const PREREQS = Object.values(import.meta.glob<string>('./prereqs.ts', { query: '?raw', import: 'default', eager: true }))[0];

/** How many modules have this kind. */
const kind = (k: string): number => ALL_MODULES.filter((m) => m.kind === k).length;

/** Each lab noun in the README, with the module kinds it counts. */
const LAB_NOUNS: [string, string[]][] = [
  ['logic labs', ['logic']], ['transistor labs', ['cmos']], ['Verilog labs', ['rtl']], ['bug hunts', ['debug']],
  ['circuit labs', ['clab']], ['coding labs', ['code']], ['shell labs', ['shell']], ['assertion labs', ['sva']],
  ['testbench labs', ['tb']], ['UVM labs', ['uvm']], ['coverage labs', ['cov']], ['clock-crossing labs', ['cdc']],
  ['assembly labs', ['isa']], ['architecture labs', ['arch']], ['RISC-V core projects', ['rv']], ['DFT labs', ['dft']],
  ['physical design labs', ['pd']], ['timing labs', ['sta']], ['STA labs', ['sta2']], ['layout labs', ['layout']],
  ['signals labs', ['sig']], ['specialty labs', ['spec']], ['board labs', ['pcb']],
];

/** Stage numbers from the comments in src/prereqs.ts (`// S1: ...`). */
const stages = new Set([...PREREQS.matchAll(/\/\/ S(\d+):/g)].map((m) => m[1]));

const chapters = ACTS.flatMap((a) => a.chapters);
const placeKind = (k: string) => PLACES.filter((p) => p.kind === k).length;
const rooms = PLACES.reduce((n, p) => n + (p.id === 'bit-zero' ? LEVEL1.length : roomsOf(p.id).length), 0);
const bosses = new Set(PLACES.flatMap((p) => p.bosses)).size;
const labTotal = LAB_NOUNS.reduce((n, [, kinds]) => n + kinds.reduce((s, k) => s + kind(k), 0), 0);

/** Each count the README states, with the noun it must sit next to. */
const COUNTS: [number, string][] = [
  [ALL_MODULES.length, 'modules'],
  [chapters.length, 'chapters'],
  [ACTS.length, 'acts'],
  [ACTS.filter((a) => a.kind === 'chip').length, 'chips'],
  [ACTS.filter((a) => a.kind === 'detour').length, 'detour acts'],
  [kind('lesson'), 'lessons'],
  [kind('practice'), 'practice sets'],
  [kind('boss'), 'checkpoints'],
  [kind('incident'), 'incidents'],
  [labTotal, 'labs'],
  ...LAB_NOUNS.map(([noun, kinds]): [number, string] => [kinds.reduce((n, k) => n + kind(k), 0), noun]),
  [stages.size, 'stages'],
  [ROLES.length, 'roles'],
  [MINIGAMES.length, 'minigames'],
  [PLACES.length, 'places'],
  [placeKind('main'), 'main places'],
  [placeKind('deep'), 'deep places'],
  [placeKind('study'), 'study places'],
  [placeKind('wing'), 'wings'],
  [new Set(PLACES.filter((p) => p.act <= 4).map((p) => p.act)).size, 'acts'],
  [PLACES.filter((p) => p.kind === 'deep' && p.act === 5).length, 'deep places'],
  [rooms, 'rooms'],
  [LEVEL1.length, 'rooms'],
  [bosses, 'bosses'],
  [UPGRADES.length, 'upgrades'],
];

describe('README counts', () => {
  it('counts the course from the code and prints the table', () => {
    const rows = COUNTS.map(([n, noun]) => `${String(n).padStart(5)}  ${noun}`);
    console.log(['README counts (from the code):', ...rows].join('\n'));
    expect(INCIDENTS.length).toBe(kind('incident'));
    expect(labTotal).toBe(ALL_MODULES.length - NOT_LABS.reduce((n, k) => n + kind(k), 0));
    expect(PLACES.length).toBe(placeKind('main') + placeKind('deep') + placeKind('study') + placeKind('wing') + placeKind('hall'));
  });

  it('states each count next to its noun', () => {
    const missing = COUNTS.map(([n, noun]) => `${n} ${noun}`).filter((phrase) => !README.includes(phrase));
    expect(missing, `README.md is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('gives the test count as a rounded floor, and keeps the line limit', () => {
    expect(README).toMatch(/\b\d+00\+ tests\b/);
    expect(README.split('\n').length).toBeLessThan(MAX_LINES);
  });

  it('has no preview or not-released wording', () => {
    expect(README.toLowerCase()).not.toMatch(/preview|not released|not in a release|coming next/);
  });
});

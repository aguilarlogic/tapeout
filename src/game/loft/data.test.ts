// The Loft's station lists (Phase 3 Spec, section 8): the lift, the chip map, the chalkboard, the review desk and the
// calibration range, checked against the place rules. The save is a Map-backed stub (no jsdom in this project), and
// every "done" is written through complete(), so the record test and recommended() see the same progress.
import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const state = await import('../../state');
const recall = await import('../../recall');
const places = await import('../world/places');
const { ALL_MODULES } = await import('../../curriculum');
const { calibRows, liftChoices, LOCKED_SHOWN, mapRows, reviewDue, studyRows } = await import('./data');

const DAY = 86400000;
const done = (id: string) => !!state.levelRecord(id);

/** Finishes these modules in the save. */
function finish(ids: string[]) {
  for (const id of ids) state.complete(id, 10, 3);
}

/** A place's scored module ids: not optional and not practice. */
function scoredIds(place: string): string[] {
  const p = places.placeById(place);
  if (!p) throw new Error(place);
  return places.chapterOf(p).modules.filter((m) => !m.optional && m.kind !== 'practice').map((m) => m.id);
}

beforeEach(() => {
  store.clear();
  state.resetAll();
  recall.resetRecall();
});

describe('the lift choices', () => {
  it('starts a blank save at Bit Zero, with Bit Zero open and the rest locked', () => {
    const rows = liftChoices(done);
    expect(rows[0]).toEqual({ place: 'bit-zero', text: 'Continue: Bit Zero', dim: false });
    expect(rows).toContainEqual({ place: 'bit-zero', text: 'Bit Zero', dim: false });
    expect(rows).toContainEqual({ place: 'lamp-board', text: 'The Lamp Board · Needs: Volts and Amps', dim: true });
    expect(rows).toContainEqual({ place: 'volts-and-amps', text: 'Volts and Amps (Chalkboard) · Needs: Bit Zero', dim: true });
  });

  it('lists main, study and deep places, not wings or side areas', () => {
    for (const p of ['bit-zero', 'volts-and-amps', 'lamp-board', 'inverted-hall', 'carry-chain', 'clockwork']) finish(scoredIds(p));
    const rows = liftChoices(done), ids = rows.map((r) => r.place);
    expect(ids).toContain('firmware-pit');
    expect(rows.find((r) => r.place === 'firmware-pit')?.text).toMatch(/^Firmware Pit \(Deep Layer\)/);
    expect(ids).not.toContain('analog-wing');
    expect(ids).not.toContain('hiring-hall');
  });

  it('opens Volts and Amps once Bit Zero is finished, and ticks Bit Zero', () => {
    finish(scoredIds('bit-zero'));
    const rows = liftChoices(done);
    expect(rows[0]).toEqual({ place: 'volts-and-amps', text: 'Continue: Volts and Amps (Chalkboard)', dim: false });
    expect(rows).toContainEqual({ place: 'bit-zero', text: 'Bit Zero ✓', dim: false });
    expect(rows).toContainEqual({ place: 'volts-and-amps', text: 'Volts and Amps (Chalkboard)', dim: false });
  });

  it('keeps The Lamp Board locked after Bit Zero alone, since it needs Volts and Amps', () => {
    finish(scoredIds('bit-zero'));
    expect(liftChoices(done)).toContainEqual({ place: 'lamp-board', text: 'The Lamp Board · Needs: Volts and Amps', dim: true });
  });

  it('lists only the next few locked places, so the lift stays short', () => {
    const rows = liftChoices(done);
    expect(rows.filter((r) => r.dim).length).toBe(LOCKED_SHOWN);
  });

  it('opens The Lamp Board once Volts and Amps is finished, and continues there', () => {
    finish([...scoredIds('bit-zero'), ...scoredIds('volts-and-amps')]);
    const rows = liftChoices(done);
    expect(rows[0]).toEqual({ place: 'lamp-board', text: 'Continue: The Lamp Board', dim: false });
    expect(rows).toContainEqual({ place: 'lamp-board', text: 'The Lamp Board', dim: false });
  });
});

describe('the chip map rows', () => {
  it('lists the seven act 1 places in play order, all at 0 percent on a blank save', () => {
    const rows = mapRows(done);
    expect(rows.map((r) => r.place)).toEqual(['bit-zero', 'volts-and-amps', 'lamp-board', 'inverted-hall', 'carry-chain', 'clockwork', 'boot-rom']);
    expect(rows.every((r) => r.pct === 0)).toBe(true);
    expect(rows[0].open).toBe(true);
    expect(rows[1].open).toBe(false);
  });

  it('reads 100 percent for a finished chapter and counts only scored modules', () => {
    finish(scoredIds('bit-zero'));
    expect(mapRows(done)[0].pct).toBe(100);
    expect(mapRows(done)[1].open).toBe(true);
  });

  it('rounds a partial chapter: one of nine scored modules is 11 percent', () => {
    finish(['bits']);
    expect(mapRows(done)[0].pct).toBe(11);
  });

  it('adds a later act once one of its places opens, numbered as the places are', () => {
    expect(mapRows(done).some((r) => r.act === 2)).toBe(false);
    finish(places.PLACES.filter((p) => p.act === 1).flatMap((p) => scoredIds(p.id)));
    const act2 = mapRows(done).filter((r) => r.act === 2);
    expect(act2.length).toBeGreaterThan(0);
    expect(act2[0]).toMatchObject({ n: 'D1', open: true });
  });

  it('leaves optional challenges out of the percentage', () => {
    finish(['logic-not']);
    expect(mapRows(done).find((r) => r.place === 'inverted-hall')?.pct).toBe(0);
    finish(['demorgan']);
    expect(mapRows(done).find((r) => r.place === 'inverted-hall')?.pct).toBe(50);
  });
});

describe('the chalkboard rows', () => {
  it('has no rows on a blank save: Volts and Amps is not open yet', () => {
    expect(studyRows(done)).toEqual([]);
  });

  it('lists Volts and Amps once Bit Zero is finished, with its two lessons', () => {
    finish(scoredIds('bit-zero'));
    const rows = studyRows(done);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ place: 'volts-and-amps', name: 'Volts and Amps', complete: false });
    expect(rows[0].modules.map((m) => m.id)).toEqual(['electricity', 'resistance']);
    expect(rows[0].modules.every((m) => !m.done)).toBe(true);
  });

  it('opens the room on any record in its chapter, and completes when both lessons are done', () => {
    finish(['electricity']);
    expect(studyRows(done)[0].modules.find((m) => m.id === 'electricity')?.done).toBe(true);
    expect(studyRows(done)[0].complete).toBe(false);
    finish(['resistance']);
    expect(studyRows(done)[0].complete).toBe(true);
  });
});

describe('the review desk', () => {
  it('is empty on a blank save', () => {
    expect(reviewDue()).toEqual([]);
  });

  it('lists at most eight lessons, each once and each finished', () => {
    finish(ALL_MODULES.map((m) => m.id));
    const due = reviewDue();
    expect(due.length).toBeGreaterThan(0);
    expect(due.length).toBeLessThanOrEqual(8);
    expect(new Set(due.map((d) => d.id)).size).toBe(due.length);
    expect(due.every((d) => done(d.id))).toBe(true);
    expect(due.every((d) => d.title.length > 0)).toBe(true);
  });

  it('keeps a lesson out of the desk until its recall question is due again', () => {
    finish(scoredIds('bit-zero'));
    const now = Date.now();
    const lesson = recall.pool().find((i) => done(i.lesson))?.lesson;
    expect(lesson).toBeDefined();
    for (const it of recall.pool().filter((i) => i.lesson === lesson)) recall.record(it.key, true, now);
    expect(reviewDue(now).map((d) => d.id)).not.toContain(lesson);
    expect(reviewDue(now + DAY * 2).map((d) => d.id)).toContain(lesson);
  });
});

describe('the calibration rows', () => {
  it('has no rigs on a blank save', () => {
    expect(calibRows(done)).toEqual([]);
  });

  it('shows the practice banks of an open place with their best stars', () => {
    finish([...scoredIds('bit-zero'), ...scoredIds('volts-and-amps')]);
    state.complete('practice-bits', 10, 2);
    const rows = calibRows(done);
    expect(rows.map((r) => r.chapter)).toEqual(['Numbers']);
    expect(rows[0].banks.find((b) => b.id === 'practice-bits')?.stars).toBe(2);
  });

  it('shows no rig for a chapter whose place is still locked', () => {
    finish(scoredIds('bit-zero'));
    expect(calibRows(done).map((r) => r.chapter)).not.toContain('Numbers');
  });

  it('gives every bank zero stars until it is played', () => {
    finish([...scoredIds('bit-zero'), ...scoredIds('volts-and-amps')]);
    expect(calibRows(done)[0].banks.every((b) => b.stars === 0)).toBe(true);
  });
});

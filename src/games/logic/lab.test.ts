// The overhauled Logic Lab: readable parts, finger-sized pins, clean wiring, plain-word runs and AA contrast.
import { describe, expect, it } from 'vitest';
import { reading } from '../../readability';
import { Circuit, Kind, PINS, SIZE, verify } from './circuit';
import { boxOf, GRID, layoutLab, overlaps, pinXY } from './board';
import { LOGIC_LEVELS } from './levels';
import { hitPin, LABEL_MIN, partInfo, partShapes, pinHitBox, PIN_TARGET_PX } from './parts';
import { route } from './route';
import { testRun } from './run';
import { contrast, TEXT_PAIRS } from './theme';

const KINDS = Object.keys(SIZE) as Kind[];
const part = (kind: Kind) => ({ id: 'p', kind, x: 100, y: 100, label: kind === 'IN' || kind === 'OUT' ? 'a' : undefined });
/** The board area of a 390x844 phone with the lab open (measured from the screenshots, rounded down). */
const PHONE = { w: 360, h: 460 };
/** Screen pixels per board unit when a lab's board is fitted to the phone, on its side if that is bigger. */
const phoneScale = (b: { w: number; h: number }) => {
  const at = (w: number, h: number) => Math.min(PHONE.w / (w + GRID * 2), PHONE.h / (h + GRID * 2));
  return Math.max(at(b.w, b.h), at(b.h, b.w));
};

describe('every part is readable', () => {
  for (const k of KINDS) {
    it(`${k} prints its name on its body, at least ${LABEL_MIN} units tall`, () => {
      const texts = partShapes(part(k), () => 0, 0).filter((s) => s.t === 'text' && s.text);
      expect(texts.length).toBeGreaterThan(0);
      const name = texts.find((s) => s.text === (k === 'IN' || k === 'OUT' ? 'a' : k));
      expect(name, `${k} has no name label`).toBeDefined();
      expect(Number(name!.a['font-size'])).toBeGreaterThanOrEqual(LABEL_MIN);
    });
    it(`${k} has a one-line explanation`, () => {
      const line = partInfo(part(k));
      expect(line.length).toBeGreaterThan(12);
      expect(line).not.toMatch(/:\s*$/);
    });
  }
  it('a lamp with nothing on its wire says it is not wired yet', () => {
    const t = partShapes(part('OUT'), () => 'z').map((s) => s.text);
    expect(t).toContain('not wired yet');
  });
});

describe('pins are finger-sized on a phone', () => {
  for (const l of LOGIC_LEVELS) {
    it(`${l.id}: every pin target is at least ${PIN_TARGET_PX}px and finds its pin`, () => {
      const { board, solved } = layoutLab(l);
      const s = phoneScale(board);
      for (const p of solved.parts) for (const d of PINS[p.kind]) {
        const b = pinHitBox(p, d.name, s);
        expect(Math.min(b.w, b.h) * s).toBeGreaterThanOrEqual(PIN_TARGET_PX - 0.01);
        const [x, y] = pinXY(p, d.name);
        expect(hitPin(solved.parts, x, y, s)).toBe(`${p.id}.${d.name}`);
      }
    });
  }
});

describe('board layout', () => {
  for (const l of LOGIC_LEVELS) {
    it(`${l.id}: parts sit on the board, on the grid, without overlapping`, () => {
      const { board, solved } = layoutLab(l);
      for (const p of solved.parts) {
        const b = boxOf(p);
        expect(p.x % GRID, p.id).toBe(0);
        expect(p.y % GRID, p.id).toBe(0);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(board.w);
        expect(b.y + b.h).toBeLessThanOrEqual(board.h);
      }
      const ps = solved.parts;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(overlaps(boxOf(ps[i]), boxOf(ps[j])), `${ps[i].id} / ${ps[j].id}`).toBe(false);
    });
    it(`${l.id}: the reference solution routes with no wire through a part and no ambiguous crossing`, () => {
      const { board, solved } = layoutLab(l);
      const r = route(solved, board);
      expect(r.through).toBe(0);
      expect(r.touches).toBe(0);
      expect(r.wires.length).toBe(solved.wires.length);
    });
  }

  it('draws a dot where wires join and a hop where they only cross', () => {
    // Two switches; a drives two lamps (a join), b's wire runs across a's branch (a crossing).
    const c: Circuit = {
      parts: [
        { id: 'a', kind: 'IN', label: 'a', x: 40, y: 200, fixed: true },
        { id: 'b', kind: 'IN', label: 'b', x: 40, y: 40, fixed: true },
        { id: 'y1', kind: 'OUT', label: 'y1', x: 560, y: 120, fixed: true },
        { id: 'y2', kind: 'OUT', label: 'y2', x: 560, y: 280, fixed: true },
        { id: 'y3', kind: 'OUT', label: 'y3', x: 560, y: 400, fixed: true },
      ],
      wires: [
        { a: 'a.y', b: 'y1.a' },
        { a: 'a.y', b: 'y2.a' },
        { a: 'b.y', b: 'y3.a' },
      ],
    };
    const r = route(c, { w: 720, h: 520 });
    expect(r.through).toBe(0);
    expect(r.touches).toBe(0);
    expect(r.dots.length).toBeGreaterThanOrEqual(1);
    expect(r.hops.length).toBeGreaterThanOrEqual(1);
    // A dot is never also a hop.
    for (const d of r.dots) expect(r.hops.some((h) => h[0] === d[0] && h[1] === d[1])).toBe(false);
  });
});

describe('Test it', () => {
  for (const l of LOGIC_LEVELS) {
    it(`${l.id}: the board opens without a problem showing, and a run of it fails in plain words`, () => {
      const { start } = layoutLab(l);
      const r = testRun(start, l);
      expect(r.ok).toBe(false);
      expect(r.problem?.text).toBeTruthy();
      expect(r.problem!.text).not.toMatch(/undefined|NaN|\[object/);
    });
    it(`${l.id}: the reference solution plays every row and wins`, () => {
      const { solved } = layoutLab(l);
      const r = testRun(solved, l);
      const rows = l.spec.kind === 'table' ? 2 ** l.inputs.length : l.spec.steps.length;
      expect(r.frames.length).toBe(rows);
      expect(r.stopAt).toBe(-1);
      expect(r.ok).toBe(true);
      expect(verify(solved, l.inputs, l.outputs, l.spec).ok).toBe(true);
    });
  }
  it('stops at the first wrong row and says what the lamp did', () => {
    const l = LOGIC_LEVELS.find((x) => x.id === 'first-and')!;
    const { start } = layoutLab(l);
    // A wire straight from a to the lamp: right for a=0, wrong for a=1, b=0.
    const c: Circuit = { parts: start.parts, wires: [{ a: `${start.parts.find((p) => p.label === 'a')!.id}.y`, b: `${start.parts.find((p) => p.kind === 'OUT')!.id}.a` }] };
    const r = testRun(c, l);
    expect(r.ok).toBe(false);
    expect(r.frames[r.stopAt].ok).toBe(false);
    expect(r.frames.slice(0, r.stopAt).every((f) => f.ok)).toBe(true);
    expect(r.problem!.text).toMatch(/lamp y lit up\. It should stay off\./);
    expect(r.problem!.part).toBeDefined();
  });
});

describe('words the lab says', () => {
  const said = [
    ...LOGIC_LEVELS.map((l) => l.goal),
    ...KINDS.map((k) => partInfo(part(k))),
    "Lamp y isn't connected to anything yet.",
    "This AND gate's top input isn't connected to anything yet.",
    'With a on, b off, lamp y stayed off. It should light up.',
  ];
  it('read at about a grade 6 level', () => {
    const r = reading(said);
    expect(r.grade, `longest: ${r.longest}`).toBeLessThanOrEqual(7);
  });
  it('every goal is one short sentence', () => {
    for (const l of LOGIC_LEVELS) expect(l.goal.split(/\s+/).length, l.id).toBeLessThanOrEqual(24);
  });
});

describe('retrowave palette', () => {
  for (const [name, fg, bg] of TEXT_PAIRS) {
    it(`${name} reaches WCAG AA (4.5:1)`, () => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5));
  }
  it('measures contrast correctly', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

import { describe, expect, it } from 'vitest';
import { ALL_MODULES, ACTS } from '../curriculum';
import { lookup } from '../glossary';
import { findGame } from '../minigames/apps';
import { rng } from '../sim/harness';
import { bin, compileBool, expr, hexa, num, parseInteger, parseQuantity, qty, words } from './answers';
import { finalExam, FINAL_COUNT, LESSONS, questionsOf } from './index';
import type { Question } from './types';

const checkQuestion = (q: Question, where: string) => {
  expect(q.why.length, `${where}: explanation`).toBeGreaterThan(10);
  if (q.t === 'ask') {
    expect(q.a.check(q.a.canonical), `${where}: canonical "${q.a.canonical}" must be accepted`).toBe(true);
    expect(q.a.check(''), `${where}: empty must be rejected`).toBe(false);
  } else {
    expect(q.a, where).toBeGreaterThanOrEqual(0);
    expect(q.a, where).toBeLessThan(q.options.length);
    expect(new Set(q.options).size, `${where}: distinct options`).toBe(q.options.length);
  }
};

describe('lessons', () => {
  it('have unique ids and at least three questions each', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(questionsOf(l, rng(1)).length, l.id).toBeGreaterThanOrEqual(3);
  });
  for (const l of LESSONS) {
    it(`${l.id}: every question is answerable, over many random seeds`, () => {
      for (let seed = 1; seed <= 60; seed++) questionsOf(l, rng(seed)).forEach((q, i) => checkQuestion(q, `${l.id} q${i} seed ${seed}`));
      for (const s of l.steps) if (s.t === 'app') expect(findGame(s.game), `${l.id} opens ${s.game}`).toBeTruthy();
      expect(l.recap.length).toBeGreaterThan(0);
    });
  }
  it('the final review draws FINAL_COUNT questions from distinct lessons', () => {
    for (let seed = 1; seed < 20; seed++) {
      const ex = finalExam(rng(seed));
      const qs = ex.steps.filter((s) => s.t === 'ask' || s.t === 'mc') as Question[];
      expect(qs.length).toBe(FINAL_COUNT);
      qs.forEach((q, i) => checkQuestion(q, `final ${seed} q${i}`));
      expect(qs.every((q) => q.t !== 'ask' || !q.hint)).toBe(true);
    }
  });
});

describe('answer parsing', () => {
  it('reads integers in engineering notations', () => {
    expect(parseInteger('0x1F')).toBe(31);
    expect(parseInteger("8'h1f")).toBe(31);
    expect(parseInteger("4'b1010")).toBe(10);
    expect(parseInteger('0b1_0000')).toBe(16);
    expect(parseInteger('-5')).toBe(-5);
    expect(parseInteger('12abc')).toBe(null);
  });
  it('checks binary, hex and decimal answers', () => {
    expect(bin(11).check('1011')).toBe(true);
    expect(bin(11).check('01011')).toBe(true);
    expect(bin(11).check('11')).toBe(false);
    expect(hexa(214, 2).check('d6')).toBe(true);
    expect(hexa(214, 2).check('0xD6')).toBe(true);
    expect(num(6).check(' 6 ')).toBe(true);
    expect(num(6).check('0b110')).toBe(true);
  });
  it('reads quantities with prefixes and units', () => {
    expect(parseQuantity('4.7k', 'Ω')).toBeCloseTo(4700);
    expect(parseQuantity('4.7 kohm', 'Ω')).toBeCloseTo(4700);
    expect(parseQuantity('2500ps', 'ns')).toBeCloseTo(2.5);
    expect(parseQuantity('2.5', 'ns')).toBeCloseTo(2.5);
    expect(parseQuantity('1.6 kHz', 'Hz')).toBeCloseTo(1600);
    expect(parseQuantity('500mhz', 'MHz')).toBeCloseTo(500);
    expect(parseQuantity('15.2mA', 'mA')).toBeCloseTo(15.2);
    expect(parseQuantity('1e4')).toBe(10000);
    expect(parseQuantity('10^4')).toBe(10000);
    expect(parseQuantity('3 volts', 'Hz')).toBe(null);
    expect(qty(1592, 'Hz').check('1.59k')).toBe(true);
    expect(qty(1592, 'Hz').check('2k')).toBe(false);
  });
  it('checks boolean expressions by truth table', () => {
    const xor = expr('A^B', ['a', 'b'], (v) => v.a !== v.b);
    expect(xor.check('a^b')).toBe(true);
    expect(xor.check("a b' + a' b")).toBe(true);
    expect(xor.check('(a|b)&!(a&b)')).toBe(true);
    expect(xor.check('a|b')).toBe(false);
    expect(compileBool('a &', ['a'])).toBe(null);
    expect(words('run_phase', 'run').check('Run Phase')).toBe(true);
  });
});

describe('curriculum', () => {
  it('has six core acts plus specializations, and unique module ids', () => {
    expect(ACTS.map((a) => a.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(ALL_MODULES.map((m) => m.id)).size).toBe(ALL_MODULES.length);
  });
  it('starts specialists at Act 7 and keeps the final review to the core acts', () => {
    expect(ACTS[6].chapters.flatMap((c) => c.modules).every((m) => ['lesson', 'practice', 'boss', 'incident', 'clab'].includes(m.kind))).toBe(true);
    for (let seed = 1; seed < 20; seed++) {
      const titles = finalExam(rng(seed)).steps.filter((s) => s.t === 'say').map((s) => (s as { text: string }).text);
      for (const m of ACTS[6].chapters.flatMap((c) => c.modules)) expect(titles).not.toContain(`**${m.title}**`);
    }
  });
  it('covers every lesson exactly once', () => {
    const lessonMods = ALL_MODULES.filter((m) => m.kind === 'lesson').map((m) => m.id).sort();
    expect(lessonMods).toEqual(LESSONS.map((l) => l.id).sort());
  });
});

describe('glossary', () => {
  it('answers natural questions', () => {
    expect(lookup('what is setup time?')?.lesson).toBe('sta');
    expect(lookup('What is a flip-flop')?.lesson).toBe('seq');
    expect(lookup('MESI')?.lesson).toBe('coherence');
    expect(lookup('metastabilty')?.lesson).toBe('clk'); // typo
    expect(lookup('eigenvalues')?.lesson).toBe('linalg');
    expect(lookup('what is a transmon')?.lesson).toBe('qubit');
    expect(lookup('shmoo plot')?.lesson).toBe('postsi');
    expect(lookup('What is ISO 26262?')?.lesson).toBe('fusa');
    expect(lookup('dilution fridge')?.lesson).toBe('qctrl');
    expect(lookup('pizza')).toBeUndefined();
  });
});

// `what is <term>` must answer the term asked, not a neighbour, and every "learn more" link must point at a real lesson.
import { describe, expect, it } from 'vitest';
import { GLOSSARY, lookup } from './glossary';
import { findLesson } from './lessons';
import { findModule } from './curriculum';

const headOf = (q: string) => lookup(q)?.terms;

describe('glossary answers the term asked', () => {
  const ownEntry: [string, string][] = [
    ['CDC', 'cdc'], ['clock domain crossing', 'cdc'], ['FIFO', 'fifo'], ['latch-up', 'latch-up'],
    ['pipelining', 'pipelining'], ['LVS', 'lvs'], ['DRC', 'drc'], ['metastability', 'metastability'],
  ];
  for (const [q, term] of ownEntry) {
    it(`"${q}" is defined under "${term}"`, () => {
      expect(headOf(q)?.[0], q).toBe(term);
    });
  }
});

describe('glossary links', () => {
  it('every "learn more" lesson exists', () => {
    const missing = GLOSSARY.filter((e) => e.lesson && !(findLesson(e.lesson) || findModule(e.lesson))).map((e) => `${e.terms[0]} -> ${e.lesson}`);
    expect(missing).toEqual([]);
  });
});

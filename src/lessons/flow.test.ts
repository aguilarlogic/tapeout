import { describe, expect, it } from 'vitest';
import { ACTS, PLAY_ORDER } from '../curriculum';
import { lookup } from '../glossary';
import { findSkill } from '../mastery/skills';
import { reading } from '../readability';
import { rng } from '../sim/harness';
import { celllayout, openflow } from './flow';
import type { Lesson, Question } from './types';

const at = (id: string) => {
  const i = PLAY_ORDER.findIndex((m) => m.id === id);
  expect(i, id).toBeGreaterThanOrEqual(0);
  return i;
};
const chapter = (name: string) => ACTS.find((a) => a.id === 'ada3')!.chapters.find((c) => c.name === name)!;

describe('physical design is taught before its labs', () => {
  it('opens the Layout chapter with the open flow and the cell-layout lesson', () => {
    const ids = chapter('Layout').modules.map((m) => m.id);
    expect(ids.slice(0, 3)).toEqual(['openflow', 'practice-openflow', 'celllayout']);
    for (const lab of ['layout-drc', 'layout-inv', 'layout-lvs', 'layout-nand', 'layout-boss']) {
      expect(at('openflow')).toBeLessThan(at(lab));
      expect(at('celllayout')).toBeLessThan(at(lab));
    }
  });

  it('teaches place and route, and the file formats, before the PD Lab', () => {
    const ids = chapter('Physical design').modules.map((m) => m.id);
    expect(ids.slice(0, 3)).toEqual(['pnr', 'practice-pnr', 'practice-pdfiles']);
    for (const lab of ['pd-place', 'pd-congestion', 'pd-cts', 'pd-ir', 'pd-floorplan', 'pd-boss']) expect(at('pnr')).toBeLessThan(at(lab));
  });

  it('keeps the place-and-route boss with the physical design role', () => {
    expect(at('pnr')).toBeLessThan(at('boss-pd'));
    expect(findSkill('pd')!.learn).toEqual(['openflow', 'pnr']);
    expect(findSkill('pd')!.practice).toContain('practice-pdfiles');
    expect(findSkill('circuit')!.learn).toContain('celllayout');
  });
});

describe('the open-flow lessons follow the house style', () => {
  const check = (l: Lesson) => {
    const first = l.steps.findIndex((s) => s.t === 'ask' || s.t === 'mc' || s.t === 'gen');
    expect(l.steps.slice(0, first).some((s) => s.t === 'art'), `${l.id}: a worked example before the first question`).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const qs = l.steps.flatMap((s): Question[] => (s.t === 'ask' || s.t === 'mc' ? [s] : s.t === 'gen' ? [s.make(rng(seed))] : []));
      for (const q of qs) {
        expect(q.why.length, q.q).toBeGreaterThan(20);
        if (q.t === 'ask') expect(q.hint?.trim(), q.q).toBeTruthy();
      }
    }
    expect(l.recap.length).toBeGreaterThanOrEqual(4);
    const said = l.steps.flatMap((s) => (s.t === 'say' ? [s.text] : s.t === 'mc' || s.t === 'ask' ? [s.q, s.why] : []));
    expect(reading(said).grade, `${l.id}: reading level`).toBeLessThanOrEqual(10);
  };
  it('openflow', () => check(openflow));
  it('celllayout', () => check(celllayout));

  it('names the open tools and the Tiny Tapeout rules', () => {
    const text = JSON.stringify(openflow.steps);
    for (const word of ['Yosys', 'synth -top', 'stat', 'OpenROAD', 'OpenLane', 'OpenSTA', 'sky130', 'Magic', 'KLayout', 'Netgen', 'GDS', 'tt_um_', 'info.yaml', 'uio_oe', 'rst_n']) expect(text, word).toContain(word);
  });
});

describe('glossary', () => {
  it('knows the open flow and the PD file formats', () => {
    expect(lookup('what is yosys')?.lesson).toBe('openflow');
    expect(lookup('OpenROAD')?.lesson).toBe('openflow');
    expect(lookup('sky130')?.lesson).toBe('openflow');
    expect(lookup('GDS')?.lesson).toBe('openflow');
    expect(lookup('tiny tapeout')?.lesson).toBe('openflow');
    for (const f of ['LEF', 'DEF', 'liberty', 'SPEF', 'SDF']) expect(lookup(f)?.lesson, f).toBe('pnr');
    expect(lookup('LVS')).toBeDefined();
    expect(lookup('DRC')).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { Investigation, probes, seeded } from './engine';
import { findIncident, INCIDENTS } from './index';
import { HINT_COST, WRONG_COST } from './types';

/** Commands the incident runner uses itself; instruments must not shadow them. */
const RESERVED = ['help', 'tools', 'instruments', 'causes', 'suspects', 'list', 'x', 'strike', 'cross', 'rule', 'notes', 'notebook', 'log', 'time', 'budget',
  'ask', 'hint', 'senior', 'diagnose', 'd', 'solve', 'fix', 'blame', 'quit', 'exit', 'q', 'what', 'who', 'define', 'explain'];

describe('incident definitions', () => {
  it('have unique ids and well-formed parts', () => {
    expect(new Set(INCIDENTS.map((i) => i.id)).size).toBe(INCIDENTS.length);
    for (const inc of INCIDENTS) {
      expect(inc.causes.length, inc.id).toBeGreaterThanOrEqual(5);
      expect(inc.bandaids.length, inc.id).toBeGreaterThanOrEqual(1);
      expect(new Set(inc.causes.map((c) => c.id)).size, inc.id).toBe(inc.causes.length);
      const cmds = inc.instruments.map((i) => i.cmd);
      expect(new Set(cmds).size, inc.id).toBe(cmds.length);
      for (const c of cmds) {
        expect(c, inc.id).toMatch(/^[a-z0-9]+$/);
        expect(RESERVED, `${inc.id}: ${c}`).not.toContain(c);
      }
      for (const c of inc.causes) {
        expect(c.story.length, `${inc.id}/${c.id}`).toBeGreaterThan(40);
        expect(c.fix.length, `${inc.id}/${c.id}`).toBeGreaterThan(15);
      }
    }
  });

  it('readings are non-empty and deterministic for every cause', () => {
    for (const inc of INCIDENTS) for (let seed = 1; seed <= 10; seed++) {
      const inv = new Investigation(inc, seed);
      for (const c of inc.causes) for (const p of probes(inc)) {
        const a = inv.readAs(c.id, p.ins, p.arg);
        expect(a.trim().length, `${inc.id} ${c.id} ${p.ins.cmd} ${p.arg}`).toBeGreaterThan(5);
        expect(inv.readAs(c.id, p.ins, p.arg)).toBe(a);
      }
    }
  });

  it('every pair of causes can be told apart by some reading', () => {
    for (const inc of INCIDENTS) for (let seed = 1; seed <= 10; seed++) {
      const inv = new Investigation(inc, seed);
      const sig = (c: string) => probes(inc).map((p) => inv.readAs(c, p.ins, p.arg)).join('\u0001');
      const sigs = inc.causes.map((c) => sig(c.id));
      expect(new Set(sigs).size, `${inc.id} seed ${seed}`).toBe(inc.causes.length);
    }
  });

  it('no single reading gives the answer away', () => {
    // The fun is combining evidence: no instrument, however expensive, separates every cause on its own.
    for (const inc of INCIDENTS) for (let seed = 1; seed <= 5; seed++) for (const p of probes(inc)) {
      const inv = new Investigation(inc, seed);
      const n = new Set(inc.causes.map((c) => inv.readAs(c.id, p.ins, p.arg))).size;
      expect(n, `${inc.id} ${p.ins.cmd} ${p.arg}`).toBeLessThan(inc.causes.length);
    }
  });

  it('a careful engineer solves every case well within budget', () => {
    for (const inc of INCIDENTS) for (let seed = 1; seed <= 15; seed++) for (const c of inc.causes) {
      const inv = new Investigation(inc, seed, c.id);
      for (let guard = 0; guard < 50; guard++) {
        const nx = inv.bestNext();
        if (!nx) break;
        inv.measure(nx.ins, nx.arg);
      }
      expect(inv.consistent(), `${inc.id} seed ${seed} cause ${c.id}`).toEqual([c.id]);
      expect(inv.spent, `${inc.id} seed ${seed} cause ${c.id}: ${[...inv.notes.keys()].join(', ')}`).toBeLessThanOrEqual(inc.budget * 0.7);
    }
  });

  it('the root cause varies between runs', () => {
    for (const inc of INCIDENTS) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) seen.add(new Investigation(inc, seed).world.cause);
      expect(seen.size, inc.id).toBe(inc.causes.length);
    }
  });
});

describe('investigation rules', () => {
  const inc = findIncident('inc-hang')!;

  it('charges lab time once per reading; repeats come from the notebook', () => {
    const inv = new Investigation(inc, 1, 'firmware');
    const logs = inv.find('logs')!;
    expect(inv.measure(logs).cost).toBe(logs.cost);
    const again = inv.measure(logs);
    expect(again.repeat).toBe(true);
    expect(inv.spent).toBe(logs.cost);
  });

  it('evidence narrows the candidates', () => {
    const inv = new Investigation(inc, 1, 'firmware');
    expect(inv.consistent()).toHaveLength(inc.causes.length);
    inv.measure(inv.find('logs')!);
    expect(inv.consistent().sort()).toEqual(['coherence', 'firmware']);
    inv.measure(inv.find('idle')!);
    expect(inv.consistent()).toEqual(['firmware']);
  });

  it('a wrong diagnosis costs time and crosses the cause off', () => {
    const inv = new Investigation(inc, 1, 'firmware');
    expect(inv.diagnose('coherence')).toBe(false);
    expect(inv.spent).toBe(WRONG_COST);
    expect(inv.consistent()).not.toContain('coherence');
    expect(inv.diagnose('firmware')).toBe(true);
  });

  it('the fix menu has exactly one right answer, plus other causes\' fixes and band-aids', () => {
    const inv = new Investigation(inc, 1, 'droop');
    const opts = inv.fixOptions(seeded(9));
    expect(opts.filter((o) => o.right)).toHaveLength(1);
    expect(opts.find((o) => o.right)!.text).toBe(inc.causes.find((c) => c.id === 'droop')!.fix);
    expect(opts).toHaveLength(3 + inc.bandaids.length);
  });

  it('the senior engineer points at the most useful reading, for a price', () => {
    const inv = new Investigation(inc, 1, 'sram');
    const h = inv.hint();
    expect(inv.spent).toBe(HINT_COST);
    expect(h).toBeDefined();
  });

  it('stars reward clean, quick work', () => {
    const clean = new Investigation(inc, 1, 'firmware');
    clean.measure(clean.find('logs')!);
    clean.measure(clean.find('idle')!);
    clean.diagnose('firmware');
    clean.applyFix({ text: '', right: true, why: '' });
    expect(clean.stars()).toBe(3);

    const messy = new Investigation(inc, 1, 'firmware');
    messy.diagnose('droop');
    messy.hint();
    messy.diagnose('firmware');
    messy.applyFix({ text: '', right: true, why: '' });
    expect(messy.stars()).toBe(1);

    const late = new Investigation(inc, 1, 'firmware');
    late.spent = inc.budget + 1;
    late.applyFix({ text: '', right: true, why: '' });
    expect(late.stars()).toBe(0);
  });
});

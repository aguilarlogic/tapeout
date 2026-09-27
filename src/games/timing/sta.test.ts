import { describe, expect, it } from 'vitest';
import { analyzeTiming, emptyTiming, TimingLevel, TimingState } from './sta';
import { TIMING_LEVELS } from './levels';

const lvl = (id: string) => TIMING_LEVELS.find((l) => l.id === id)!;
const SIZES = [1, 2, 4] as const;
const VTS = ['svt', 'lvt'] as const;

/** Every size/Vt assignment for the level's gates. */
function* sizings(level: TimingLevel): Generator<TimingState> {
  const gates = level.nodes.filter((n) => n.kind === 'gate').map((n) => n.id);
  const opts = level.allow.vt ? SIZES.flatMap((s) => VTS.map((v) => [s, v] as const)) : SIZES.map((s) => [s, 'svt'] as const);
  const idx = gates.map(() => 0);
  for (;;) {
    const st = emptyTiming();
    gates.forEach((g, i) => { st.size[g] = opts[idx[i]][0]; st.vt[g] = opts[idx[i]][1]; });
    yield st;
    let i = 0;
    while (i < idx.length && ++idx[i] === opts.length) idx[i++] = 0;
    if (i === idx.length) return;
  }
}

function bestBySizing(level: TimingLevel) {
  let best: { area: number; st: TimingState } | null = null;
  for (const st of sizings(level)) {
    const r = analyzeTiming(level, st);
    if (r.passed && (!best || r.area < best.area)) best = { area: r.area, st };
  }
  return best;
}

describe('static timing engine', () => {
  it('computes setup slack like a timing report', () => {
    const r = analyzeTiming(lvl('sta-slack'), emptyTiming());
    const p = r.paths[0];
    expect(p.arrival).toBe(1.95); // 0.15 clk->Q + 0.9 + 0.5 + 0.4
    expect(p.required).toBe(1.7); // 1.8 - 0.1 setup
    expect(p.setupSlack).toBe(-0.25);
    expect(p.points.at(-1)!.path).toBe(1.95);
    expect(r.critical.has('G1')).toBe(true);
  });

  it('adds load delay to the driver of an upsized gate', () => {
    const st = emptyTiming();
    st.size.G2 = 4;
    const r = analyzeTiming(lvl('sta-slack'), st);
    expect(r.gateDelay.G1).toBeCloseTo(0.99);
    expect(r.gateDelay.G2).toBeCloseTo(0.3);
  });
});

describe('levels are solvable, and only the intended way', () => {
  it('sta-slack: sizing closes timing with 3 stars possible', () => {
    const l = lvl('sta-slack');
    const best = bestBySizing(l)!;
    expect(best.area).toBeLessThanOrEqual(l.par.area);
  });

  it('sta-battles: a par-area solution exists', () => {
    const l = lvl('sta-battles');
    const best = bestBySizing(l)!;
    expect(best).not.toBeNull();
    expect(best.area).toBeLessThanOrEqual(l.par.area);
  });

  it('sta-hold: buffering the shared wire breaks setup; buffering the short path works', () => {
    const l = lvl('sta-hold');
    const shared = emptyTiming();
    shared.buffers['G3>B'] = 2;
    const r1 = analyzeTiming(l, shared);
    expect(r1.whs).toBe(0);
    expect(r1.wns).toBeLessThan(0);
    const good = emptyTiming();
    good.buffers['A>G1'] = 2;
    const r2 = analyzeTiming(l, good);
    expect(r2.passed).toBe(true);
    expect(r2.stars).toBe(3);
  });

  it('sta-skew: skew alone trades a setup violation for a hold violation; skew + buffers pass', () => {
    const l = lvl('sta-skew');
    const skewOnly = emptyTiming();
    skewOnly.skew.B = 0.4;
    const r1 = analyzeTiming(l, skewOnly);
    expect(r1.wns).toBe(0);
    expect(r1.whs).toBeLessThan(0);
    for (let s = -0.5; s <= 0.5; s += 0.05) {
      const st = emptyTiming();
      st.skew.B = Math.round(s * 100) / 100;
      expect(analyzeTiming(l, st).passed).toBe(false);
    }
    skewOnly.buffers['X>G5'] = 3;
    const r2 = analyzeTiming(l, skewOnly);
    expect(r2.passed).toBe(true);
    expect(r2.stars).toBe(3);
  });

  it('sta-pipeline: sizing alone cannot close; an unbalanced cut is rejected; a clean cut passes', () => {
    const l = lvl('sta-pipeline');
    expect(bestBySizing(l)).toBeNull();
    const half = emptyTiming();
    half.pipes['M>S'] = true;
    const r1 = analyzeTiming(l, half);
    expect(r1.conflicts.some((c) => /different pipeline stages/.test(c))).toBe(true);
    half.pipes['P>S'] = true;
    const r2 = analyzeTiming(l, half);
    expect(r2.conflicts).toEqual([]);
    expect(r2.passed).toBe(true);
    expect(r2.stars).toBe(3);
    const late = emptyTiming();
    late.pipes['R>Y'] = true;
    expect(analyzeTiming(l, late).passed).toBe(false);
  });
});

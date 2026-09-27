import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { bestDivider, bestRc, bpNext, cacheRun, DIV_TARGETS, DIV_TOL, ffRound, hsRound, mesiStep, RC_TARGETS, RC_TOL } from './logic';

describe('minigame logic', () => {
  it('every divider target is achievable with E12 parts', () => {
    for (const t of DIV_TARGETS) expect(bestDivider(t.vin, t.vout).err, `${t.vin}->${t.vout}`).toBeLessThanOrEqual(DIV_TOL);
  });
  it('every RC spec is achievable with standard parts', () => {
    for (const t of RC_TARGETS) expect(bestRc(t).err, t.text).toBeLessThanOrEqual(RC_TOL);
  });
  it('direct-mapped cache: reuse hits, same-set different-tag conflicts', () => {
    const a = cacheRun([0x00, 0x04, 0x40, 0x00, 0x10]);
    expect(a.map((x) => x.hit)).toEqual([false, true, false, false, false]);
    expect(a[2].evicted).toBe(0);
    expect(a[4].set).toBe(1);
  });
  it('2-bit counter saturates', () => {
    expect(bpNext(3, true)).toBe(3);
    expect(bpNext(0, false)).toBe(0);
    expect(bpNext(2, false)).toBe(1);
  });
  it('MESI transitions', () => {
    expect(mesiStep(['I', 'I'], { core: 0, op: 'read' })).toEqual(['E', 'I']);
    expect(mesiStep(['E', 'I'], { core: 1, op: 'read' })).toEqual(['S', 'S']);
    expect(mesiStep(['S', 'S'], { core: 1, op: 'write' })).toEqual(['I', 'M']);
    expect(mesiStep(['I', 'M'], { core: 0, op: 'read' })).toEqual(['S', 'S']);
    expect(mesiStep(['M', 'I'], { core: 0, op: 'read' })).toEqual(['M', 'I']);
  });
  it('flip-flop rounds follow D, enable and reset', () => {
    for (let s = 1; s < 30; s++) {
      const r = ffRound(rng(s), 'enable');
      let q = 0;
      r.d.forEach((d, i) => { if (r.en[i]) q = d; expect(r.q[i]).toBe(q); });
    }
  });
  it('handshakes obey AXI: VALID stays high until a transfer', () => {
    for (let s = 1; s < 50; s++) {
      const hs = hsRound(rng(s));
      hs.valid.forEach((v, i) => {
        expect(hs.fire[i]).toBe(v & hs.ready[i]);
        if (i && hs.valid[i - 1] && !hs.fire[i - 1]) expect(v).toBe(1);
      });
    }
  });
});

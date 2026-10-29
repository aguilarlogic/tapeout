// The Underlayers, damage taken (Phase 5 Spec, section 7): Current Limiter scales every hit, Diode Plating halves hits
// from behind, and Bias Plates adds hull. The sim takes damage through hurtDrone, after the assist scale.
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll, setPrefs } from '../../state';
import { Director } from './director';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
// Standard difficulty: Story takes half damage, and these tests check the upgrades alone
beforeEach(() => { mem.clear(); resetAll(); setPrefs({ difficulty: 'standard' }); });

const pass = (id: string) => award(id, 10, 3);
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
type Hurtable = { hurtDrone(n: number, from?: { x: number; y: number }): void };
/** One hit of n from the front or from behind the drone (it faces right); returns the integrity it took. */
function hit(d: Director, n: number, side: 'front' | 'behind'): number {
  const dr = d.sim.drone;
  dr.facing = 1;
  d.sim.vitals.iFrames = 0; // a hit opens 600 ms of invulnerability
  const before = d.sim.vitals.integrity;
  (d.sim as unknown as Hurtable).hurtDrone(n, { x: dr.x + (side === 'front' ? 100 : -100), y: dr.y });
  return before - d.sim.vitals.integrity;
}

describe('the Underlayers: damage taken', () => {
  it('takes the full hit with no underlayer upgrade', () => {
    const d = director();
    d.warp('datapath', 0);
    expect(d.sim.assist.damageScale).toBe(1);
    expect(hit(d, 20, 'front')).toBe(20);
  });

  it('Current Limiter: every hit takes 90%, rounded', () => {
    pass('clab-mesh');
    const d = director();
    d.warp('datapath', 0);
    d.applyKit();
    expect(hit(d, 20, 'front')).toBe(18);
  });

  it('Diode Plating: a hit from behind takes half, a hit from the front the full amount', () => {
    pass('clab-boss-ohm');
    const d = director();
    d.warp('datapath', 0);
    d.applyKit();
    expect(hit(d, 20, 'behind')).toBe(10);
    expect(hit(d, 20, 'front')).toBe(20);
  });

  it('both: from behind 20 takes 10, then 9 with the Current Limiter', () => {
    pass('clab-mesh');
    pass('clab-boss-ohm');
    const d = director();
    d.warp('datapath', 0);
    d.applyKit();
    expect(hit(d, 20, 'behind')).toBe(9);
    expect(hit(d, 20, 'front')).toBe(18);
  });

  it('Bias Plates: ten more points of hull', () => {
    const d = director();
    d.warp('datapath', 0);
    const before = d.sim.vitals.maxIntegrity;
    pass('clab-boss-bjt');
    d.applyKit();
    expect(d.sim.vitals.maxIntegrity).toBe(before + 10);
  });
});

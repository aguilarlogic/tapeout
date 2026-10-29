// Act 4, The Cluster (Phase 7 Spec, sections 2, 3, 4, 5 and 6): every room of its places loads and runs with the real
// sim and its theme, with the whole act 4 kit on as well as with none of it; the new enemies spawn; every boss wears
// its own form; NoC Warp's router pads sit on The Mesh and the places after it; the first landing shows the Cluster
// card once. Tapeout has its own plan (section 2), so the room sweeps leave it out.
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { resetAll } from '../../state';
import { formFor } from '../bosses/forms-act1';
import { ATTACKS, BODIES } from '../bosses/table';
import type { Action } from '../input/bindings';
import { roomsOf, themeOf } from '../world/compose';
import { chapterOf, PLACES } from '../world/places';
import { STORY } from '../world/story';
import { Director } from './director';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); });

function step(d: Director, held: Action[] = [], pressed: Action[] = []) {
  const input = d.before({ held: new Set(held), pressed: new Set(pressed) });
  d.sim.step(input, { x: d.sim.drone.x + 300 * d.sim.drone.facing, y: d.sim.drone.y });
  d.after();
}
const run = (d: Director, n: number, held: Action[] = []) => { for (let i = 0; i < n; i++) step(d, held); };
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const CLUSTER = PLACES.filter((p) => p.act === 4);
/** Every act 4 place but Tapeout (section 2: Level 27 has its own plan, with X's rooms and the ending). */
const SWEPT = CLUSTER.filter((p) => p.id !== 'tapeout');
const pass = (id: string) => award(id, 10, 3);
/** Every module of every place up to and including the last act 4 place before Tapeout, so the whole act 4 kit is owned. */
function passAll() {
  const last = PLACES.findIndex((p) => p.id === 'model-room');
  for (const p of PLACES.slice(0, last + 1)) for (const m of chapterOf(p).modules) pass(m.id);
}
/**
 * Every room of every act 4 place but Tapeout: warp in, close any card, run, and check the drone is still inside the
 * room. X's arena and the ending are skipped, since they start their own fights.
 */
function runAll(d: Director, steps: number, held: Action[] = []) {
  for (const p of SWEPT) {
    roomsOf(p.id).forEach((r, i) => {
      if (r.role === 'xarena' || r.role === 'ending') return;
      d.warp(p.id, i);
      d.waiting = false;
      run(d, steps, held);
      const dr = d.sim.drone;
      expect(dr.x > 0 && dr.x < r.w && dr.y > 0 && dr.y < r.h, `${r.id} drone at ${Math.round(dr.x)},${Math.round(dr.y)}`).toBe(true);
    });
  }
}
/** Does a pad sit on the top edge of some solid: same y, and inside the solid's x range. */
const onSolidTop = (pad: { x: number; y: number }, solids: { x: number; y: number; w: number }[]) =>
  solids.some((s) => s.y === pad.y && pad.x >= s.x && pad.x <= s.x + s.w);

describe('act 4, The Cluster', () => {
  it('has thirteen places, numbered S8 to 27, all on the cluster theme', () => {
    expect(CLUSTER.map((p) => p.n)).toEqual(['S8', '19', 'D16', 'D17', '20', '21', '22', '23', 'D18', '24', '25', '26', '27']);
    for (const p of CLUSTER) {
      const t = themeOf(p);
      expect([t.place, t.music], p.id).toEqual([p.id, 'cluster']);
    }
  });

  it('builds every room of every act 4 place but Tapeout and runs it for two seconds', () => {
    runAll(director(), 120);
  });

  it('runs every room with the whole act 4 kit on, firing and moving right', () => {
    passAll();
    const d = director();
    expect(d.sim.kit.rewind && d.sim.kit.agents && d.sim.kit.mine).toBeTruthy();
    runAll(d, 60, ['fire', 'right']);
  });

  it('spawns the False Pass, Coverage Hole, Deadlock Pair and Thrasher in their places', () => {
    const d = director();
    const kinds = new Set<string>();
    for (const p of CLUSTER) {
      roomsOf(p.id).forEach((r, i) => {
        if (!r.enemies.length) return;
        d.warp(p.id, i);
        for (const e of d.sim.enemies) kinds.add(e.kind);
      });
    }
    for (const k of ['falsepass', 'hole', 'deadlock', 'thrash']) expect(kinds.has(k), k).toBe(true);
  });

  it('gives every act 4 boss its own form, with a body and attacks that exist', () => {
    for (const p of CLUSTER) {
      for (const inc of p.bosses) {
        const f = formFor(inc);
        expect(f.body, inc).not.toBe('lamps');
        expect(BODIES[f.body], inc).toBeDefined();
        for (const a of f.attacks) expect(ATTACKS[a], `${inc} ${a}`).toBeDefined();
      }
    }
  });

  it('puts two router pads on every traverse room from The Mesh on, each on a solid top, and none before it', () => {
    const mesh = PLACES.findIndex((p) => p.id === 'mesh');
    for (const p of CLUSTER) {
      const late = PLACES.indexOf(p) >= mesh;
      const traverse = roomsOf(p.id).filter((r) => r.role === 'traverse');
      if (late) expect(traverse.length, p.id).toBeGreaterThan(0);
      for (const r of traverse) {
        if (!late) {
          expect(r.routers ?? [], `${p.id} ${r.id}`).toEqual([]);
          continue;
        }
        expect(r.routers?.length ?? 0, `${p.id} ${r.id}`).toBe(2);
        for (const pad of r.routers ?? []) expect(onSolidTop(pad, r.solids), `${r.id} pad at ${pad.x},${pad.y}`).toBe(true);
      }
    }
  });

  it('shows the Cluster card on the first landing only', () => {
    const d = director();
    d.warp('testbench', 0);
    const cards = () => d.out.filter((o) => o.t === 'card' && o.title === STORY.cluster.title).length;
    expect(cards()).toBe(1);
    expect(d.waiting).toBe(true);
    d.cardClosed();
    d.out = [];
    d.warp('environment', 0);
    expect(cards()).toBe(0);
    expect(d.world.cutscenes).toContain('cluster');
  });
});

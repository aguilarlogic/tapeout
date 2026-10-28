// Act 3, Silicon (Phase 6 Spec, sections 2, 3, 6 and 8): every room of its twelve places loads and runs with the real
// sim and its theme, with the whole act 3 kit on as well as with none of it; the new bugs spawn; every boss wears its
// own form; Metal Stack's traverse rooms get barriers and the Board's get copper pads; the first landing shows the
// Silicon card once.
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
const SILICON = PLACES.filter((p) => p.act === 3);
const pass = (id: string) => award(id, 10, 3);
/** Every module of every place up to and including act 3, so the whole act 3 kit is owned. */
function passAll() {
  const last = PLACES.findIndex((p) => p.id === 'board');
  for (const p of PLACES.slice(0, last + 1)) for (const m of chapterOf(p).modules) pass(m.id);
}
/** Every room of every act 3 place: warp in, close any card, run, and check the drone is still inside the room. */
function runAll(d: Director, steps: number, held: Action[] = []) {
  for (const p of SILICON) {
    roomsOf(p.id).forEach((r, i) => {
      d.warp(p.id, i);
      d.waiting = false;
      run(d, steps, held);
      const dr = d.sim.drone;
      expect(dr.x > 0 && dr.x < r.w && dr.y > 0 && dr.y < r.h, `${r.id} drone at ${Math.round(dr.x)},${Math.round(dr.y)}`).toBe(true);
    });
  }
}

describe('act 3, Silicon', () => {
  it('has eight main places and four Deep Layers, numbered 11 to 18 and D12 to D15, on the silicon theme', () => {
    expect(SILICON.map((p) => p.n)).toEqual(['11', '12', 'D12', 'D13', '13', '14', '15', '16', '17', 'D14', 'D15', '18']);
    for (const p of SILICON) {
      const t = themeOf(p);
      expect([t.place, t.music], p.id).toEqual([p.id, 'silicon']);
    }
  });

  it('builds every room of every act 3 place and runs it for two seconds', () => {
    runAll(director(), 120);
  });

  it('runs every room with the whole act 3 kit on, firing and switching gadgets', () => {
    passAll();
    const d = director();
    expect(d.sim.kit.turret && d.sim.kit.scan && d.sim.kit.tether && d.sim.kit.parryMs).toBeTruthy();
    runAll(d, 60, ['fire', 'right']);
  });

  it('spawns the Brute, Crosstalk, Hotspot and Wake in their places', () => {
    const d = director();
    const kinds = new Set<string>();
    for (const p of SILICON) {
      roomsOf(p.id).forEach((r, i) => {
        if (!r.enemies.length) return;
        d.warp(p.id, i);
        for (const e of d.sim.enemies) kinds.add(e.kind);
      });
    }
    for (const k of ['brute', 'crosstalk', 'hotspot', 'wake']) expect(kinds.has(k), k).toBe(true);
  });

  it('gives every act 3 boss its own form, with a body and attacks that exist', () => {
    for (const p of SILICON) {
      for (const inc of p.bosses) {
        const f = formFor(inc);
        expect(f.body, inc).not.toBe('lamps');
        expect(BODIES[f.body], inc).toBeDefined();
        for (const a of f.attacks) expect(ATTACKS[a], `${inc} ${a}`).toBeDefined();
      }
    }
  });

  it('puts metal barriers in Metal Stack traverse rooms and copper pads in the Board', () => {
    const traverse = (id: string) => roomsOf(id).filter((r) => r.role === 'traverse');
    expect(traverse('metal-stack').some((r) => (r.barriers ?? []).length > 0)).toBe(true);
    expect(traverse('board').some((r) => (r.copper ?? []).length > 0)).toBe(true);
    for (const id of ['cell-library', 'critical-path']) {
      expect(roomsOf(id).every((r) => !r.barriers?.length && !r.copper?.length), id).toBe(true);
    }
  });

  it('shows the Silicon card on the first landing only', () => {
    const d = director();
    d.warp('cell-library', 0);
    const cards = () => d.out.filter((o) => o.t === 'card' && o.title === STORY.silicon.title).length;
    expect(cards()).toBe(1);
    expect(d.waiting).toBe(true);
    d.cardClosed();
    d.out = [];
    d.warp('bypass-bus', 0);
    expect(cards()).toBe(0);
    expect(d.world.cutscenes).toContain('silicon');
  });
});

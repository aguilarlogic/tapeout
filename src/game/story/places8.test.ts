// The Fab (Phase 8 Spec, sections 2, 3, 4 and 5): every room of the eight Specialist Wings and the Hiring Hall loads
// and runs with the real sim and its theme, with no kit and with the whole kit; every wing boss wears its own form at
// 2500 health (1875 on Story); the first landing shows the Fab card once; the lift lists the wings only after the
// ending; and a hiring panel opens only when its role is 60% ready or it has a record.
import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_MODULES } from '../../curriculum';
import { award } from '../../mastery/promotion';
import { resetAll, setPrefs } from '../../state';
import { formFor } from '../bosses/forms-act1';
import { ATTACKS, BODIES } from '../bosses/table';
import type { Action } from '../input/bindings';
import { liftChoices } from '../loft/data';
import { placeDrone } from '../player/drone';
import { roomsOf, themeOf } from '../world/compose';
import { chapterOf, PLACES } from '../world/places';
import { STORY } from '../world/story';
import { Director } from './director';
import { panelOf } from './hall';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); setPrefs({ difficulty: 'standard' }); });

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
const FAB = PLACES.filter((p) => p.act === 6);
const pass = (id: string) => award(id, 10, 3);
const done = (ids: Set<string>) => (id: string) => ids.has(id);

/** Every room of every act 6 place: warp in, close any card, run, and check the drone is still inside the room. */
function runAll(d: Director, steps: number, held: Action[] = []) {
  for (const p of FAB) {
    roomsOf(p.id).forEach((r, i) => {
      d.warp(p.id, i);
      d.waiting = false;
      run(d, steps, held);
      const dr = d.sim.drone;
      expect(dr.x > 0 && dr.x < r.w && dr.y > 0 && dr.y < r.h, `${r.id} drone at ${Math.round(dr.x)},${Math.round(dr.y)}`).toBe(true);
    });
  }
}

describe('act 6, the Fab', () => {
  it('has the eight wings and the Hiring Hall, all on the wings theme and the fab backdrop', () => {
    expect(FAB.map((p) => p.n)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'H']);
    for (const p of FAB) {
      const t = themeOf(p);
      expect([t.place, t.music, t.backdrop], p.id).toEqual([p.id, 'wings', 'fab']);
    }
  });

  it('builds every room and runs it for two seconds', () => {
    runAll(director(), 120);
  });

  it('runs every room with the whole kit on, firing and moving right', () => {
    for (const m of ALL_MODULES) pass(m.id);
    const d = director();
    expect(d.sim.kit.decoy && d.sim.kit.reflex && d.sim.kit.split && d.sim.kit.phaseLock).toBeTruthy();
    runAll(d, 60, ['fire', 'right']);
  });

  it('gives each of the 15 wing bosses its own form, with a body and attacks that exist', () => {
    const incs = FAB.flatMap((p) => p.bosses);
    expect(incs.length).toBe(15);
    expect(new Set(incs.map((i) => formFor(i).body)).size).toBe(15);
    for (const inc of incs) {
      const f = formFor(inc);
      expect(BODIES[f.body], inc).toBeDefined();
      for (const a of f.attacks) expect(ATTACKS[a], `${inc} ${a}`).toBeDefined();
    }
  });

  it('gives wing bosses 2500 health, and 1875 on Story', () => {
    const arena = roomsOf('analog-wing').findIndex((r) => r.role === 'arena');
    let d = director();
    d.warp('analog-wing', arena);
    expect(d.boss?.maxHp).toBe(2500);
    setPrefs({ difficulty: 'story' });
    d = director();
    d.warp('analog-wing', arena);
    expect(d.boss?.maxHp).toBe(1875);
  });

  it('shows the Fab card on the first landing only', () => {
    const d = director();
    d.warp('cold-lab', 0);
    const cards = () => d.out.filter((o) => o.t === 'card' && o.title === STORY.fab.title).length;
    expect(cards()).toBe(1);
    expect(d.waiting).toBe(true);
    d.cardClosed();
    d.out = [];
    d.warp('hiring-hall', 0);
    expect(cards()).toBe(0);
    expect(d.world.cutscenes).toContain('fab');
  });

  it('lists the wings and the Hall on the lift only after the ending', () => {
    const ids = new Set(PLACES.filter((p) => p.act !== 6).flatMap((p) => chapterOf(p).modules.map((m) => m.id)));
    const fab = (ended: boolean) => liftChoices(done(ids), ended).filter((c) => FAB.some((p) => p.id === c.place));
    expect(fab(false)).toEqual([]);
    expect(fab(true).map((c) => c.place)).toEqual(FAB.map((p) => p.id));
    expect(fab(true).find((c) => c.place === 'analog-wing')?.text).toBe('Analog Wing (Fab)');
  });
});

describe('the Hiring Hall', () => {
  it('plans a landing, four offices and an exit, with every office door open', () => {
    const rooms = roomsOf('hiring-hall');
    expect(rooms.map((r) => r.role)).toEqual(['landing', 'offices', 'offices', 'offices', 'offices', 'exit']);
    for (const r of rooms.filter((x) => x.role === 'offices')) {
      expect(r.gates, r.id).toEqual([]);
      expect(r.enemies, r.id).toEqual([]);
      expect(r.stations.every((s) => s.label.startsWith('HIRING PANEL · ')), r.id).toBe(true);
    }
  });

  /** E at office 1's first panel (cap-rtl). */
  function pressPanel(d: Director) {
    d.warp('hiring-hall', 1);
    d.waiting = false;
    const st = d.room.stations[0];
    expect(st.module).toBe('cap-rtl');
    run(d, 30);
    placeDrone(d.sim.drone, st.x, d.sim.drone.y);
    run(d, 30);
    d.out = [];
    step(d, [], ['interact']);
    return d.out;
  }

  it('keeps a panel shut below 60% readiness, and says how ready the role is', () => {
    const d = director();
    expect(panelOf('cap-rtl')?.open).toBe(false);
    const out = pressPanel(d);
    expect(out.some((o) => o.t === 'overlay')).toBe(false);
    expect(d.world.heard.at(-1)?.startsWith('Not yet: RTL design engineer is '), d.world.heard.at(-1)).toBe(true);
  });

  it('opens a panel with a record, and at 60% readiness', () => {
    pass('cap-rtl');
    expect(panelOf('cap-rtl')?.open).toBe(true);
    expect(pressPanel(director()).some((o) => o.t === 'overlay' && o.module === 'cap-rtl')).toBe(true);
    mem.clear();
    resetAll();
    for (const m of ALL_MODULES) if (!m.id.startsWith('cap-')) pass(m.id);
    expect(panelOf('cap-rtl')).toMatchObject({ open: true, passed: false });
  });

  it('wears a badge for each panel passed, and names the count at the exit', () => {
    pass('cap-rtl');
    pass('cap-dv');
    const d = director();
    d.warp('hiring-hall', 5);
    d.waiting = false;
    expect(d.sim.badges).toBe(2);
    run(d, 30, ['right']);
    expect(d.world.heard.some((l) => l.startsWith('2 of 32 panels passed.'))).toBe(true);
  });
});

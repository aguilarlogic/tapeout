// The Underlayers (Phase 5 Spec, sections 2, 3 and 10): every Deep Layer room of D5 to D11 loads and runs with the
// real sim and its theme, hatches join only neighbouring places and stay shut on a locked one, the first landing shows
// the Underlayers card once, and the study chapters S2 to S7 ride the lift to the chalkboard.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { award } from '../../mastery/promotion';
import { levelRecord, resetAll } from '../../state';
import { liftChoices } from '../loft/data';
import type { Action } from '../input/bindings';
import { roomsOf, themeOf } from '../world/compose';
import { chapterOf, PLACES, placeById } from '../world/places';
import { planPlace } from '../world/slots';
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
const run = (d: Director, n: number) => { for (let i = 0; i < n; i++) step(d); };
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}
const UNDER = PLACES.filter((p) => p.act === 5);
const DEEP = UNDER.filter((p) => p.kind === 'deep');
const pass = (id: string) => award(id, 10, 3);
function moveTo(d: Director, x: number) {
  Matter.Body.setPosition(d.sim.drone.body, { x, y: d.sim.drone.y });
  Matter.Body.setVelocity(d.sim.drone.body, { x: 0, y: 0 });
  d.sim.drone.x = x;
}
/** Walk up to a station and press E at it. */
function use(d: Director, id: string) {
  const st = d.room.stations.find((s) => s.id === id)!;
  moveTo(d, st.x);
  d.out = [];
  run(d, 2);
  step(d, ['interact'], ['interact']);
}

describe('the Underlayers', () => {
  it('has seven Deep Layers and six study chapters, with their own theme, music and backdrop', () => {
    expect(DEEP.map((p) => p.n)).toEqual(['D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11']);
    expect(UNDER.filter((p) => p.kind === 'study').map((p) => p.n)).toEqual(['S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
    for (const p of DEEP) {
      const t = themeOf(p);
      expect([t.place, t.music, t.backdrop], p.id).toEqual([p.id, 'under', 'under']);
      expect(planPlace(p, t).some((r) => r.gauntlet), p.id).toBe(false);
    }
  });

  it('builds every room of every Deep Layer and runs it for two seconds', () => {
    const d = director();
    for (const p of DEEP) {
      roomsOf(p.id).forEach((r, i) => {
        d.warp(p.id, i);
        d.waiting = false;
        run(d, 120);
        const dr = d.sim.drone;
        expect(dr.x > 0 && dr.x < r.w && dr.y > 0 && dr.y < r.h, `${r.id} drone at ${Math.round(dr.x)},${Math.round(dr.y)}`).toBe(true);
      });
    }
  });

  it('spawns the Ringer and the Shunt in their places', () => {
    const d = director();
    const kinds = new Set<string>();
    for (const id of ['ringing-supply', 'junction-depths']) {
      roomsOf(id).forEach((r, i) => {
        if (!r.enemies.length) return;
        d.warp(id, i);
        for (const e of d.sim.enemies) kinds.add(e.kind);
      });
    }
    expect(kinds.has('ringer')).toBe(true);
    expect(kinds.has('shunt')).toBe(true);
  });

  it('joins only neighbours with a hatch: the Pipeline drops into D5, D5 has none, D7 drops into D8', () => {
    const exitHatch = (id: string) => roomsOf(id).at(-1)!.stations.find((s) => s.kind === 'hatch')?.arg;
    const landHatch = (id: string) => roomsOf(id)[0].stations.find((s) => s.kind === 'hatch')?.arg;
    expect(exitHatch('pipeline')).toBe('power-grid');
    expect(landHatch('power-grid')).toBe('pipeline');
    expect(exitHatch('power-grid')).toBeUndefined();
    expect(landHatch('capacitor-bank')).toBeUndefined();
    expect(exitHatch('ringing-supply')).toBe('ac-filters');
    expect(landHatch('ac-filters')).toBe('ringing-supply');
    expect(exitHatch('bias-network')).toBeUndefined();
  });

  it('keeps a hatch down shut while its place is locked, and opens it once it is', () => {
    const d = director();
    d.warp('ringing-supply', roomsOf('ringing-supply').length - 1);
    d.cardClosed(); // the Underlayers card
    use(d, 'hatch');
    run(d, 90);
    expect(d.place).toBe('ringing-supply');
    expect(d.world.heard.some((l) => l.startsWith('Locked.'))).toBe(true);
    pass(chapterOf(placeById('ac-filters')!).modules[0].id);
    use(d, 'hatch');
    run(d, 90);
    expect([d.place, d.index]).toEqual(['ac-filters', 0]);
  });

  it('shows the Underlayers card on the first landing only', () => {
    const d = director();
    d.warp('power-grid', 0);
    const cards = () => d.out.filter((o) => o.t === 'card' && o.title === STORY.underlayers.title).length;
    expect(cards()).toBe(1);
    expect(d.waiting).toBe(true);
    d.cardClosed();
    d.out = [];
    d.warp('power-grid', 0);
    expect(cards()).toBe(0);
    expect(d.world.cutscenes).toContain('underlayers');
  });

  it('sends a study chapter on the lift to the chalkboard', () => {
    // everything before Rotations done, so S2 is open
    const upTo = PLACES.findIndex((p) => p.id === 'rotations');
    for (const p of PLACES.slice(0, upTo)) for (const m of chapterOf(p).modules) pass(m.id);
    const rows = liftChoices((id) => !!levelRecord(id));
    const row = rows.find((r) => r.place === 'rotations' && !r.text.startsWith('Continue'));
    expect(row?.text).toBe('Rotations (Chalkboard)');
    expect(row?.dim).toBe(false);
    const d = director();
    d.warp('loft', 0);
    const lift = d.room.stations.find((s) => s.kind === 'lift')!;
    use(d, lift.id);
    d.out = [];
    d.chose('loftLift', rows.indexOf(row!));
    expect(d.out).toContainEqual({ t: 'loft', station: 'board' });
  });
});

// Level 27's end (Phase 7 Spec, section 7), with the real Director and Sim: X wears one of act n's boss forms, chosen
// by a stable hash of the player's name; it is a straight fight with no record; dying restarts the form; after the
// fourth form the bit falls, and picking it up runs the ending, which ends in the Loft with 'ending' kept.
import { beforeEach, describe, expect, it } from 'vitest';
import { levelRecord, resetAll, setPrefs, setProfile } from '../../state';
import type { Action } from '../input/bindings';
import { placeDrone } from '../player/drone';
import { HZ } from '../tuning';
import { roomsOf } from '../world/compose';
import { STORY } from '../world/story';
import { actIncidents, X_HP, X_LINES, xIncident } from '../world/x';
import { Director } from './director';
import { creditLines, ENDING, HELLO, SKIP_S, stepLen } from './ending';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => {
  mem.clear();
  resetAll();
  setProfile({ name: 'Sam', background: 'new', goal: 'design', since: 0 });
  setPrefs({ difficulty: 'standard' });
});

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
const X_ROOM = (n: number) => roomsOf('tapeout').findIndex((r) => r.role === 'xarena' && r.xform === n);
function toX(d: Director, n: 1 | 2 | 3 | 4) {
  d.warp('tapeout', X_ROOM(n));
  d.waiting = false;
}
/** Land a hit of n on X's body, as a shot would report it. */
function hitX(d: Director, n: number) {
  step(d);
  d.sim.targetHits.push({ id: 'board', n });
  d.after();
}

describe('which form X wears', () => {
  it('is one of act n main places\' bosses, the same every time for a name', () => {
    for (const n of [1, 2, 3, 4] as const) {
      const pick = xIncident('Sam', n);
      expect(actIncidents(n)).toContain(pick);
      expect(xIncident('  sam ', n)).toBe(pick);
    }
  });
  it('differs between names', () => {
    const names = ['Sam', 'Ada', 'Lin', 'Kai', 'Ola', 'Raj', 'Mei', 'Tom'];
    expect(new Set(names.map((s) => xIncident(s, 4))).size).toBeGreaterThan(1);
  });
});

describe('the X fight', () => {
  it('starts with no pager, no shield and 1500 HP, the form named "X · as ..."', () => {
    const d = director();
    toX(d, 1);
    expect(d.xn).toBe(1);
    expect(d.waiting).toBe(false);
    expect(d.boss!.phase).toBe('finish');
    expect(d.boss!.shielded).toBe(false);
    expect(d.boss!.maxHp).toBe(X_HP);
    expect(d.boss!.incident.id).toBe(xIncident('Sam', 1));
    expect(d.form!.form.name.startsWith('X · as ')).toBe(true);
    expect(d.sim.targets.find((t) => t.id === 'board')?.active).toBe(true);
    run(d, 2);
    expect(d.bubble?.text).toBe(X_LINES[1]);
  });

  it('Story difficulty gives X 1125 HP', () => {
    setPrefs({ difficulty: 'story' });
    const d = director();
    toX(d, 2);
    expect(d.boss!.maxHp).toBe(1125);
  });

  it('at 0 HP X slips away, the door opens, and nothing is recorded', () => {
    const d = director();
    toX(d, 1);
    const inc = d.boss!.incident.id;
    hitX(d, X_HP - 1);
    expect(d.xn).toBe(1);
    hitX(d, 1);
    expect(d.xn).toBe(0);
    expect(d.form).toBeNull();
    expect(d.sim.enemies).toEqual([]);
    expect(d.rs.gates.get('door')?.opening).toBe(true);
    expect(levelRecord(inc)).toBeFalsy();
    run(d, 2);
    expect(d.bubble?.text).toBe(STORY.ending.slip);
  });

  it('dying in an X arena restarts that form at full health', () => {
    const d = director();
    toX(d, 3);
    hitX(d, 600);
    expect(d.boss!.hp).toBe(X_HP - 600);
    d.sim.vitals.integrity = 0;
    run(d, 3 * HZ);
    expect(d.boss!.hp).toBe(X_HP);
    expect(d.xn).toBe(3);
  });
});

describe('the bit and the ending', () => {
  function beatX4(d: Director) {
    toX(d, 4);
    hitX(d, X_HP);
  }

  it('after the fourth form the bit falls to the floor, and the door stays shut', () => {
    const d = director();
    beatX4(d);
    expect(d.bit).not.toBeNull();
    expect(d.rs.gates.get('door')?.opening ?? false).toBe(false);
    const y0 = d.bit!.y;
    run(d, 2 * HZ);
    expect(d.bit!.y).toBeGreaterThan(y0);
    expect(d.bit!.y).toBeLessThan(d.room.h);
  });

  it('walking into the bit starts the ending; it runs every step, then the ENDING card, then the Loft', () => {
    const d = director();
    beatX4(d);
    run(d, 2 * HZ);
    placeDrone(d.sim.drone, d.bit!.x, d.bit!.y - 10);
    step(d);
    expect(d.bit).toBeNull();
    expect(d.out.some((o) => o.t === 'sfx' && o.name === 'fanfare')).toBe(true);
    run(d, HZ);
    expect(d.room.role).toBe('ending');
    expect(d.ending?.step).toBe(0);
    d.out = [];
    const total = ENDING.reduce((n, _, i) => n + stepLen(i), 0);
    run(d, total + 2);
    expect(d.out.filter((o) => o.t === 'sfx' && o.name === 'lightsOn').length).toBe(1);
    expect(d.out.filter((o) => o.t === 'sfx' && o.name === 'chirp').length).toBeGreaterThanOrEqual(HELLO.replace(/ /g, '').length);
    const card = d.out.find((o) => o.t === 'card');
    expect(card && card.t === 'card' ? [card.title, card.button] : null).toEqual([STORY.ending.card.title, STORY.ending.card.button]);
    expect(d.waiting).toBe(true);
    d.cardClosed();
    expect(d.world.cutscenes).toContain('ending');
    run(d, HZ);
    expect(d.place).toBe('loft');
    expect(d.ending).toBeNull();
  });

  it('a key skips to the next step, but only after the step has run 1 s', () => {
    const d = director();
    d.warp('tapeout', roomsOf('tapeout').length - 1);
    d.waiting = false;
    expect(d.ending?.step).toBe(0);
    run(d, 10);
    step(d, [], ['jump']);
    expect(d.ending?.step).toBe(0);
    run(d, Math.round(SKIP_S * HZ));
    step(d, [], ['jump']);
    expect(d.ending?.step).toBe(1);
  });

  it('the credits name the player as PROBE-7', () => {
    expect(creditLines('Sam')).toContain('Repair drone PROBE-7: Sam');
    expect(creditLines('Sam')).toContain('Made with Claude');
  });
});

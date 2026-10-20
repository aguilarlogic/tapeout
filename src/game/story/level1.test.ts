// Level 1 (Phase 2 Level 1 Build Spec, "Tests"): the room order and their modules, every wire run solvable from its own
// terminals, the kit derived from records, saves and migration, the award only after a passed check, a headless
// play-through of the first rooms with the real sim, the boss beaten by careful readings, and every line TAPEOUT says
// held to the beginner reading ceiling.
import Matter from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { findModule } from '../../curriculum';
import { findLogicLevel } from '../../games/logic/levels';
import { findIncident } from '../../incidents';
import { award } from '../../mastery/promotion';
import { reading } from '../../readability';
import { CEILING_GRADE } from '../../readability.test';
import { levelRecord, resetAll } from '../../state';
import type { Action } from '../input/bindings';
import { TUNING } from '../tuning';
import { Director, WIRE_HINTS } from './director';
import { LEVEL1, LOFT } from './level1';
import { blankWorld, discoveriesFor, kitFor, LEVEL1_MODULES, loadWorld, nodeFor, startFor, WORLD_KEY } from './progress';
import { BOOT_COLD, BOOT_PARTIAL, LINES, PARTIAL_LINES } from './script';
import { check, levelOf, nextWire, solution, type Wire } from './wirerun';

const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  },
  configurable: true,
});
beforeEach(() => { mem.clear(); resetAll(); });

// --- a headless player: the director around the real sim, one 60 Hz step at a time ---
function step(d: Director, held: Action[] = [], pressed: Action[] = []) {
  const input = d.before({ held: new Set(held), pressed: new Set(pressed) });
  d.sim.step(input, { x: d.sim.drone.x + 300 * d.sim.drone.facing, y: d.sim.drone.y });
  d.after();
}
function run(d: Director, n: number) { for (let i = 0; i < n; i++) step(d); }
/** Walk to x, hopping over anything in the way. */
function walkTo(d: Director, x: number, max = 1500) {
  let stuck = 0, hop = 0;
  for (let i = 0; i < max && Math.abs(d.sim.drone.x - x) > 10; i++) {
    const dir: Action = d.sim.drone.x < x ? 'right' : 'left';
    stuck = Math.abs(d.sim.drone.vx) < 0.2 && d.sim.drone.grounded ? stuck + 1 : 0;
    if (stuck > 6) hop = 24;
    const held: Action[] = [dir];
    if (hop > 0) { hop--; held.push('jump'); }
    step(d, held, hop === 23 ? ['jump'] : []);
  }
  run(d, 20);
}
const press = (d: Director, a: Action = 'interact') => { step(d, [a], [a]); step(d); };
function director() {
  const d = new Director(7);
  d.live = true;
  d.out = [];
  return d;
}

describe('Level 1 layout', () => {
  it('has the eleven rooms in order, then the Loft', () => {
    expect(LEVEL1.map((r) => r.id)).toEqual(['dark-bay', 'bit-wall', 'gate-hall', 'lift-shaft', 'floater-shaft', 'twin-motors', 'bit0-chamber', 'first-fight', 'boss-door', 'arena', 'workbench']);
    expect(LOFT.id).toBe('loft');
  });

  it('teaches the S1 modules in order of need, each one real', () => {
    expect(LEVEL1_MODULES).toEqual(['first-wire', 'bits', 'bool', 'first-not', 'first-and', 'logic-half', 'inc-demo-board', 'gates', 'half-adder-v']);
    for (const id of LEVEL1_MODULES) expect(findModule(id) ?? findIncident(id), id).toBeTruthy();
  });

  it('keeps every room enclosed with a way out on the right', () => {
    for (const r of LEVEL1) {
      expect(r.exit.x, r.id).toBeGreaterThan(r.w - 80);
      expect(r.spawn.x, r.id).toBeLessThan(r.w);
    }
  });

  it('puts every station, terminal and gate inside its room', () => {
    for (const r of [...LEVEL1, LOFT]) {
      for (const s of r.stations) expect(s.x > 0 && s.x < r.w && s.y > 0 && s.y <= r.h, `${r.id} ${s.id}`).toBe(true);
      for (const t of r.wire?.terminals ?? []) expect(t.x > 0 && t.x < r.w, `${r.id} ${t.pin}`).toBe(true);
    }
  });
});

describe('wire runs', () => {
  const runs = LEVEL1.filter((r) => r.wire).map((r) => [r.id, r.wire!] as const);

  it.each(runs)('%s is solvable from its own terminals', (_id, w) => {
    // every pin in the reference wiring is a terminal the player can reach
    const pins = new Set(w.terminals.map((t) => t.pin));
    for (const [a, b] of solution(w)) { expect(pins.has(a)).toBe(true); expect(pins.has(b)).toBe(true); }
    expect(check(w, solution(w)).state).toBe('pass');
  });

  it.each(runs)('%s waits while the lamp end is unplugged', (_id, w) => {
    expect(check(w, []).state).toBe('open');
    expect(check(w, solution(w).slice(0, -1)).state).toBe('open');
  });

  it('fails a lift wired straight past its NOT, on the right row', () => {
    const w = LEVEL1.find((r) => r.id === 'lift-shaft')!.wire!;
    const c = check(w, [['in:a', 'out:y']]);
    expect(c.state).toBe('fail');
  });

  it('fails a bridge with one lever wired straight to it', () => {
    const w = LEVEL1.find((r) => r.id === 'twin-motors')!.wire!;
    expect(check(w, [['in:a', 'out:y']]).state).toBe('fail');
  });

  it('draws the next missing wire as the ghost hint', () => {
    const w = LEVEL1.find((r) => r.id === 'twin-motors')!.wire!;
    const sol = solution(w);
    expect(nextWire(w, [])).toEqual(sol[0]);
    expect(nextWire(w, [sol[0]])).toEqual(sol[1]);
    expect(nextWire(w, sol)).toBeUndefined();
  });

  it('uses today\'s Logic Lab levels', () => {
    for (const [, w] of runs) expect(findLogicLevel(w.level)).toBe(levelOf(w));
  });

  it('has timed hints for every wire run', () => {
    for (const [, w] of runs) expect(WIRE_HINTS[w.level]?.length, w.level).toBeGreaterThan(0);
  });
});

describe('the kit comes from records', () => {
  const none = () => false;
  it('starts with legs only', () => {
    const k = kitFor(none, [], []);
    expect(k).toMatchObject({ gun: false, coil: false, headlamp: false, carryShot: false, voice: false, maxIntegrity: TUNING.vitals.health, grabLimit: TUNING.field.grabLimit });
    expect(k.panels.every((p) => !p)).toBe(true);
  });
  it('turns on the probe and headlamp with the first wire, the coil at the coil gate', () => {
    const k = kitFor((id) => id === 'first-wire', ['coil'], []);
    expect(k.gun && k.headlamp && k.coil).toBe(true);
    expect(k.panels[0]).toBe(true);
  });
  it('gives the coil to an old player who did the bits lesson, without the discovery', () => {
    expect(kitFor((id) => id === 'bits', [], []).coil).toBe(true);
  });
  it('lifts heavier crates after AND, more integrity after the boss, Carry Shot after the bench', () => {
    expect(kitFor((id) => id === 'first-and', [], []).grabLimit).toBe(TUNING.story.grip);
    expect(kitFor((id) => id === 'inc-demo-board', [], []).maxIntegrity).toBe(TUNING.story.bossIntegrity);
    expect(kitFor((id) => id === 'half-adder-v', [], []).carryShot).toBe(true);
    expect(kitFor(none, [], ['exit-lift']).voice).toBe(true);
  });
});

describe('saves and migration', () => {
  it('cold boots a brand-new player in the Dark Bay', () => {
    expect(startFor(undefined, () => false, false)).toEqual({ kind: 'cold' });
    const d = director();
    expect(d.bootLines).toEqual(BOOT_COLD);
    expect(d.room.id).toBe('dark-bay');
  });

  it('wakes an old player after the last room they finished, with partial memory', () => {
    const done = new Set(['first-wire', 'bits', 'bool']);
    expect(nodeFor((id) => done.has(id))).toBe(3);
    const s = startFor(undefined, (id) => done.has(id), true);
    expect(s).toEqual({ kind: 'migrate', at: { place: 'bit-zero', room: 3 }, discoveries: discoveriesFor(3) });
    for (const id of done) award(id, 10, 3);
    const d = director();
    expect(d.bootLines).toEqual(BOOT_PARTIAL);
    expect(d.room.id).toBe('lift-shaft');
    expect(d.world.heard).toEqual(expect.arrayContaining(PARTIAL_LINES));
    expect(d.kit.coil && d.kit.gun).toBe(true);
  });

  it('a module done out of order does not skip the rooms before it', () => {
    expect(nodeFor((id) => id === 'first-and')).toBe(0);
  });

  it('sends a player who finished all of Level 1 to the Loft', () => {
    for (const id of LEVEL1_MODULES) award(id, 10, 3);
    const d = director();
    expect(d.place).toBe('loft');
  });

  it('resumes at the saved room, and today\'s records carry over untouched', () => {
    award('first-wire', 10, 2);
    const before = JSON.stringify(levelRecord('first-wire'));
    const w = { ...blankWorld(), at: { place: 'bit-zero' as const, room: 2 } };
    localStorage.setItem(WORLD_KEY, JSON.stringify(w));
    const d = director();
    expect(d.bootLines).toEqual([]);
    expect(d.room.id).toBe('gate-hall');
    expect(JSON.stringify(levelRecord('first-wire'))).toBe(before);
  });

  it('stores only world state under its own key, never upgrades', () => {
    const d = director();
    d.warp('bit-zero', 1);
    const w = loadWorld()!;
    expect(w.at).toEqual({ place: 'bit-zero', room: 1 });
    expect(Object.keys(w).sort()).toEqual(['at', 'cutscenes', 'heard', 'places', 'storyClock', 'version']);
  });

  it('a reset wipes the world save too', () => {
    director().warp('bit-zero', 4);
    expect(loadWorld()).toBeTruthy();
    resetAll();
    expect(loadWorld()).toBeUndefined();
  });
});

describe('playing Level 1 headless', () => {
  it('climbs the Floater Shaft ledge by ledge with a running jump', () => {
    const d = director();
    d.warp('bit-zero', 4);
    run(d, 30);
    const ledges = [...d.room.oneWay].sort((a, b) => b.y - a.y);
    const exitFloor = d.room.solids.find((s) => s.y === 220)!;
    let cur = { x: 0, w: d.room.w };
    for (const to of [...ledges, exitFloor]) {
      // walk to the take-off edge of this ledge, stop, then a held jump toward the middle of the next one
      const mid = to.x + to.w / 2;
      walkTo(d, Math.min(Math.max(mid, cur.x + 30), cur.x + cur.w - 30));
      let landed = false;
      for (let i = 0; i < 120 && !landed; i++) {
        const held: Action[] = [d.sim.drone.x < mid - 6 ? 'right' : d.sim.drone.x > mid + 6 ? 'left' : 'jump'];
        if (i < 26) held.push('jump');
        step(d, held, i === 0 ? ['jump'] : []);
        landed = i > 10 && d.sim.drone.grounded && d.sim.drone.y < to.y;
      }
      expect(landed, `onto the ledge at y ${to.y}`).toBe(true);
      cur = to;
    }
  });

  /** Carry a wire from one terminal to another. */
  function wire(d: Director, [a, b]: Wire) {
    const t = (pin: string) => d.room.wire!.terminals.find((x) => x.pin === pin)!;
    walkTo(d, t(a).x);
    press(d);
    walkTo(d, t(b).x);
    press(d);
  }

  it('Dark Bay: the first wire lights the room, turns on the probe and writes the record', () => {
    const d = director();
    expect(d.sim.kit.gun).toBe(false);
    expect(d.sim.drone.abilities).toEqual({ doubleJump: false, wallLatch: false });
    wire(d, ['in:in', 'out:out']);
    expect(levelRecord('first-wire')).toBeUndefined(); // not yet: the strip is still testing
    run(d, 120);
    expect(levelRecord('first-wire')).toBeTruthy();
    expect(d.sim.kit.gun).toBe(true);
    expect(d.rs.lightTo).toBe(1);
    expect(d.waiting).toBe(true); // the upgrade card
    d.cardClosed();
  });

  it('Dark Bay: the crust breaks to probe fire and the exit leads on', () => {
    award('first-wire', 10, 3);
    const d = director();
    expect(d.room.id).toBe('bit-wall'); // the save node is the next room; a replay walks back in
    d.warp('bit-zero', 0);
    expect(d.sim.kit.gun).toBe(true);
    walkTo(d, 1700);
    for (let i = 0; i < 240 && d.rs.gates.get('crust')!.open < 1; i++) step(d, ['fire']);
    expect(d.rs.gates.get('crust')!.open).toBe(1);
    walkTo(d, 1990);
    run(d, 40);
    expect(d.room.id).toBe('bit-wall');
  });

  it('a wrong loop sparks, snaps its last wire back, and writes no record', () => {
    award('first-wire', 10, 3); award('bits', 10, 3); award('bool', 10, 3);
    const d = director();
    expect(d.room.id).toBe('lift-shaft');
    wire(d, ['in:a', 'out:y']);
    run(d, 120);
    expect(levelRecord('first-not')).toBeUndefined();
    expect(d.rs.wires).toEqual([]);
    expect(d.rs.passed).toBe(false);
    wire(d, ['in:a', 'g.a']);
    wire(d, ['g.y', 'out:y']);
    run(d, 120);
    expect(levelRecord('first-not')).toBeTruthy();
    expect(d.rs.passed).toBe(true);
  });

  it('Lift Shaft: the lift carries the drone up to the exit ledge, and the exit leads on', () => {
    for (const id of ['first-wire', 'bits', 'bool', 'first-not']) award(id, 10, 3);
    const d = director();
    d.warp('bit-zero', 3);
    walkTo(d, 640);
    run(d, Math.round(TUNING.story.liftS * 60) + 30);
    expect(d.rs.lift).toBe(1);
    expect(d.sim.drone.y).toBeLessThan(300);
    walkTo(d, 1260);
    run(d, 40);
    expect(d.room.id).toBe('floater-shaft');
  });

  it('Bit Wall: walking through the coil gate brings the Field Coil online and saves it', () => {
    award('first-wire', 10, 3);
    const d = director();
    d.warp('bit-zero', 1);
    expect(d.sim.kit.coil).toBe(false);
    walkTo(d, 300);
    expect(d.sim.kit.coil).toBe(true);
    expect(loadWorld()!.places['bit-zero'].discoveries).toContain('coil');
  });

  it('Bit Wall: the port lesson lights lamps and opens the shutter only once it signs off', () => {
    award('first-wire', 10, 3);
    const d = director();
    d.warp('bit-zero', 1);
    d.lampOn(); d.lampOn();
    expect(d.rs.lamps).toBe(2);
    d.overlayClosed('bits', false);
    expect(d.rs.gates.get('shutter')!.opening).toBe(false);
    award('bits', 10, 3);
    d.overlayClosed('bits', true);
    expect(d.rs.gates.get('shutter')!.opening).toBe(true);
  });

  it('Gate Hall: both plates latch the door; one is not enough', () => {
    award('first-wire', 10, 3); award('bits', 10, 3);
    const d = director();
    expect(d.room.id).toBe('gate-hall');
    walkTo(d, 700);
    run(d, 60);
    expect(d.rs.latched).toBe(false);
    // push the crate onto plate B by standing it there with the coil: here, drop the crate straight onto the plate
    // the crate onto plate B (the player carries it there with the coil; here it is set down directly)
    Matter.Body.setPosition(d.sim.world.props[0].body, { x: 1000, y: 600 });
    run(d, 90);
    expect(d.rs.latched).toBe(true);
    expect(loadWorld()!.places['bit-zero'].discoveries).toContain('both-plates');
  });

  it('Twin Motors: the levers drive the bridge only after the AND passes', () => {
    for (const id of ['first-wire', 'bits', 'bool', 'first-not']) award(id, 10, 3);
    const d = director();
    expect(d.room.id).toBe('floater-shaft');
    d.warp('bit-zero', 5);
    wire(d, ['in:a', 'g.a']);
    wire(d, ['in:b', 'g.b']);
    wire(d, ['g.y', 'out:y']);
    run(d, 120);
    expect(levelRecord('first-and')).toBeTruthy();
    d.cardClosed();
    expect(d.sim.kit.grabLimit).toBe(TUNING.story.grip);
    walkTo(d, 260); press(d);
    run(d, 90);
    expect(d.rs.bridge).toBe(0);
    walkTo(d, 360); press(d);
    run(d, 121);
    expect(d.rs.bridge).toBe(1);
  });

  it('the boss: careful readings, the right cause and fix, then the board falls and the record is written', () => {
    for (const id of ['first-wire', 'bits', 'bool', 'first-not', 'first-and', 'logic-half']) award(id, 10, 3);
    const d = director();
    d.warp('bit-zero', 9);
    expect(d.room.id).toBe('arena');
    const b = d.boss!;
    d.cardClosed(); // the pager
    expect(b.phase).toBe('investigate');
    const priv = d as unknown as { takeReading(a: string): void; hitBoard(n: number): void };
    for (let g = 0; g < 20 && b.fits().length > 1; g++) {
      const nx = b.inv.bestNext()!;
      priv.takeReading(`${nx.ins.cmd}${nx.arg ? ` ${nx.arg}` : ''}`);
      run(d, 40); // the node cooldown
    }
    expect(b.fits().length).toBe(1);
    // the board cannot be beaten before the fix: it never drops below a quarter
    b.tempDown = 600;
    priv.hitBoard(10_000);
    expect(b.hp).toBeGreaterThan(0);
    b.tempDown = 0;
    d.chose('cause', b.causes().findIndex((c) => c.id === b.fits()[0]));
    expect(b.phase).toBe('fix');
    d.chose('fix', b.fixes().findIndex((o) => o.right));
    expect(b.phase).toBe('finish');
    priv.hitBoard(10_000);
    expect(b.phase).toBe('done');
    expect(levelRecord('inc-demo-board')).toBeTruthy();
    expect(d.sim.vitals.maxIntegrity).toBe(TUNING.story.bossIntegrity);
  });

  it('a guess is sent back and the board goes dark with a new fault', () => {
    for (const id of ['first-wire', 'bits', 'bool', 'first-not', 'first-and', 'logic-half']) award(id, 10, 3);
    const d = director();
    d.warp('bit-zero', 9);
    const b = d.boss!;
    d.cardClosed();
    const right = b.inv.cause.id;
    d.chose('cause', b.causes().findIndex((c) => c.id === right));
    // more than one cause still fits: the guard asks first
    d.chose('guard', 1);
    expect(levelRecord('inc-demo-board')).toBeUndefined();
    expect(b.restarts).toBe(1);
  });

  it('the exit lift waits for the bench, then plays and lands in the Loft', () => {
    for (const id of LEVEL1_MODULES.filter((m) => m !== 'half-adder-v')) award(id, 10, 3);
    const d = director();
    d.warp('bit-zero', 10);
    walkTo(d, 1140);
    press(d);
    expect(d.cut).toBeNull();
    award('half-adder-v', 10, 3);
    d.overlayClosed('half-adder-v', true);
    d.cardClosed();
    press(d);
    expect(d.cut?.kind).toBe('exitLift');
    run(d, Math.round(TUNING.story.exitLiftS * 60) + 60);
    expect(d.place).toBe('loft');
    expect(d.kit.voice).toBe(true);
    expect(loadWorld()!.at.place).toBe('loft');
  });
});

describe('what TAPEOUT says', () => {
  const lines = [
    ...BOOT_COLD, ...BOOT_PARTIAL, ...PARTIAL_LINES,
    ...Object.values(LINES).flat(),
    ...Object.values(WIRE_HINTS).flat(),
    ...[...LEVEL1, LOFT].flatMap((r) => r.triggers.flatMap((t) => t.lines)),
  ];
  it(`stays under grade ${CEILING_GRADE}`, () => {
    const r = reading(lines);
    expect(r.grade, `longest sentence: ${r.longest}`).toBeLessThanOrEqual(CEILING_GRADE);
  });
  it('keeps every line short enough for the bubble', () => {
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(80);
  });
});

import { describe, expect, it } from 'vitest';
import { ACTIONS, type Action, assign, DEFAULTS, resolve } from './bindings';
import { actionLabel, deviceText } from './labels';
import { PAD_BUTTONS } from './padmap';

// Real lines from the game (src/game/world, src/game/story), with what each device should show.
const REAL: [string, string, string][] = [
  ['Press E at a bus rail to clip on and ride it fast.', 'Press X at a bus rail to clip on and ride it fast.',
    'Press USE at a bus rail to clip on and ride it fast.'],
  ['A gadget: press F to lay a mine. A bug that comes close sets it off. G switches gadgets.',
    'A gadget: press D-pad up to lay a mine. A bug that comes close sets it off. D-pad left switches gadgets.',
    'A gadget: press GADGET to lay a mine. A bug that comes close sets it off. NEXT switches gadgets.'],
  ['Press B to switch your lamp to a long beam that shows hidden things.',
    'Press L3 to switch your lamp to a long beam that shows hidden things.',
    'Press BEAM to switch your lamp to a long beam that shows hidden things.'],
  ['Press C to pocket the block your field holds, up to three. Press C again to take one out.',
    'Press D-pad right to pocket the block your field holds, up to three. Press D-pad right again to take one out.',
    'Press POCKET to pocket the block your field holds, up to three. Press POCKET again to take one out.'],
  ['Press R to rewind. It recharges in 20 s, and it does not work in a cutscene.',
    'Press B to rewind. It recharges in 20 s, and it does not work in a cutscene.',
    'Press REWIND to rewind. It recharges in 20 s, and it does not work in a cutscene.'],
  ['Press V to see their health.', 'Press R3 to see their health.', 'Press SCAN to see their health.'],
  ['Stand on the platform and press E at the lever. It lifts you.',
    'Stand on the platform and press X at the lever. It lifts you.',
    'Stand on the platform and press USE at the lever. It lifts you.'],
  ['Each switch pulls the platform one way. Press E at the lever to flip IN.',
    'Each switch pulls the platform one way. Press X at the lever to flip IN.',
    'Each switch pulls the platform one way. Press USE at the lever to flip IN.'],
  ['Carry the via block into the M2 socket. Then press E at a via to climb.',
    'Carry the via block into the M2 socket. Then press X at a via to climb.',
    'Carry the via block into the M2 socket. Then press USE at a via to climb.'],
  ['A bus is shared wiring. Press E to clip onto rail A.',
    'A bus is shared wiring. Press X to clip onto rail A.',
    'A bus is shared wiring. Press USE to clip onto rail A.'],
  ['Pick up the wire at the switch. Press E.', 'Pick up the wire at the switch. Press X.',
    'Pick up the wire at the switch. Press USE.'],
  ['Carry it to the lamp. Press E again.', 'Carry it to the lamp. Press X again.',
    'Carry it to the lamp. Press USE again.'],
  ['E  Pick up a wire', 'X  Pick up a wire', 'USE  Pick up a wire'],
  ['Superposition Decoy: press F to set a faint decoy drone that draws fire.',
    'Superposition Decoy: press D-pad up to set a faint decoy drone that draws fire.',
    'Superposition Decoy: press GADGET to set a faint decoy drone that draws fire.'],
  ['Assertion Mine: a gadget. Press F to lay a mine at your feet, up to three.',
    'Assertion Mine: a gadget. Press D-pad up to lay a mine at your feet, up to three.',
    'Assertion Mine: a gadget. Press GADGET to lay a mine at your feet, up to three.'],
  ['Take readings. Press E at each node, or shoot it.', 'Take readings. Press X at each node, or shoot it.',
    'Take readings. Press USE at each node, or shoot it.'],
  ['Press E on a router pad to warp to the other pad in the room.',
    'Press X on a router pad to warp to the other pad in the room.',
    'Press USE on a router pad to warp to the other pad in the room.'],
  ['Press Escape to pause.', 'Press Escape to pause.', 'Press Escape to pause.'],
];

describe('actionLabel', () => {
  it('keys: the main key of each action, else the second', () => {
    expect(actionLabel('interact', 'keys', DEFAULTS)).toBe('E');
    expect(actionLabel('jump', 'keys', DEFAULTS)).toBe('W');
    expect(actionLabel('dash', 'keys', DEFAULTS)).toBe('Left Shift');
    expect(actionLabel('fire', 'keys', DEFAULTS)).toBe('Left click');
    expect(actionLabel('map', 'keys', DEFAULTS)).toBe('Tab');
    expect(actionLabel('gadgetNext', 'keys', DEFAULTS)).toBe('G');
    expect(actionLabel('slot1', 'keys', DEFAULTS)).toBe('1');
    expect(actionLabel('interact', 'keys', resolve({ interact: [null, 'Enter'] }))).toBe('Enter');
    expect(actionLabel('interact', 'keys', resolve({ interact: [null, null] }))).toBe('—');
  });

  it('keys: a remapped key shows its new name', () => {
    const b = assign(DEFAULTS, 'interact', 0, 'KeyT').bindings;
    expect(actionLabel('interact', 'keys', b)).toBe('T');
  });

  it('pad: the button from the pad map, with the stick and slot names', () => {
    expect(actionLabel('interact', 'pad', DEFAULTS)).toBe('X');
    expect(actionLabel('jump', 'pad', DEFAULTS)).toBe('A');
    expect(actionLabel('dash', 'pad', DEFAULTS)).toBe('RB');
    expect(actionLabel('fire', 'pad', DEFAULTS)).toBe('RT');
    expect(actionLabel('field', 'pad', DEFAULTS)).toBe('LT');
    expect(actionLabel('gadget', 'pad', DEFAULTS)).toBe('D-pad up');
    expect(actionLabel('down', 'pad', DEFAULTS)).toBe('D-pad down');
    expect(actionLabel('left', 'pad', DEFAULTS)).toBe('left stick');
    expect(actionLabel('right', 'pad', DEFAULTS)).toBe('left stick');
    expect(actionLabel('slot1', 'pad', DEFAULTS)).toBe('Y');
    expect(actionLabel('slot3', 'pad', DEFAULTS)).toBe('Y');
  });

  it('pad: every action that has a pad button names it from PAD_BUTTONS', () => {
    for (const a of ACTIONS) {
      const btn = PAD_BUTTONS.find((b) => b.action === a.id);
      if (btn) expect(actionLabel(a.id, 'pad', DEFAULTS)).toBe(btn.name);
    }
  });

  it('touch: the on-screen label for every action', () => {
    const touch: Record<Action, string> = {
      left: 'the stick', right: 'the stick', jump: 'push the stick up', down: 'pull the stick down',
      fire: 'hold the right side', field: 'two fingers on the right', dash: 'DASH', interact: 'USE',
      weapon: 'SWAP', weaponPrev: 'SWAP', slot1: 'SWAP', slot2: 'SWAP', slot3: 'SWAP', beam: 'BEAM',
      gadget: 'GADGET', gadgetNext: 'NEXT', scan: 'SCAN', rewind: 'REWIND', pocket: 'POCKET', map: 'NOTES',
      pause: 'PAUSE',
    };
    for (const a of ACTIONS) expect(actionLabel(a.id, 'touch', DEFAULTS)).toBe(touch[a.id]);
  });

  it('every action has a non-empty name on each device', () => {
    for (const a of ACTIONS) {
      for (const kind of ['keys', 'pad', 'touch'] as const) expect(actionLabel(a.id, kind, DEFAULTS)).not.toBe('');
    }
  });
});

describe('deviceText on real game lines', () => {
  it.each(REAL)('keeps the default keys unchanged: %s', (line) => {
    expect(deviceText(line, 'keys', DEFAULTS)).toBe(line);
  });

  it.each(REAL)('pad: %s', (line, pad) => {
    expect(deviceText(line, 'pad', DEFAULTS)).toBe(pad);
  });

  it.each(REAL)('touch: %s', (line, _pad, touch) => {
    expect(deviceText(line, 'touch', DEFAULTS)).toBe(touch);
  });
});

describe('deviceText rules', () => {
  it('rewrites every default letter key the same way as its label', () => {
    for (const a of ACTIONS) {
      const code = DEFAULTS[a.id][0];
      if (!code || !code.startsWith('Key') || code.length !== 4) continue;
      const letter = code.slice(3);
      for (const kind of ['pad', 'touch'] as const) {
        expect(deviceText(`Press ${letter} now.`, kind, DEFAULTS)).toBe(`Press ${actionLabel(a.id, kind, DEFAULTS)} now.`);
      }
    }
  });

  it('rewrites the words Shift and Tab through their default actions', () => {
    expect(deviceText('Press Shift to dash.', 'touch', DEFAULTS)).toBe('Press DASH to dash.');
    expect(deviceText('Press Tab for notes.', 'pad', DEFAULTS)).toBe('Press Back for notes.');
    expect(deviceText('Press Shift to dash.', 'keys', DEFAULTS)).toBe('Press Shift to dash.');
  });

  it('rewrites Space through jump, and keeps the prompt capitals', () => {
    expect(deviceText('Press Space to jump.', 'pad', DEFAULTS)).toBe('Press A to jump.');
    expect(deviceText('Press Space to jump.', 'keys', DEFAULTS)).toBe('Press Space to jump.');
  });

  it('keeps the capital of Press and the lower-case press as written', () => {
    expect(deviceText('press E at the lever', 'pad', DEFAULTS)).toBe('press X at the lever');
    expect(deviceText('Press E at the lever', 'pad', DEFAULTS)).toBe('Press X at the lever');
  });

  it('never touches letters inside words or acronyms, or the article A', () => {
    const plain = [
      'Wire A to B, and B to C.', 'a 1 at the node', 'A gadget: a bit of wiring.', 'EDA tools, ESD rules and I/O pins.',
      'Check the A.M. window.', 'TAG switches are not keys.', 'Repress E now.', 'Press EDA rules.', 'Press ESD rules.',
    ];
    for (const line of plain) {
      expect(deviceText(line, 'pad', DEFAULTS)).toBe(line);
      expect(deviceText(line, 'touch', DEFAULTS)).toBe(line);
    }
  });

  it('shows a remapped key in keys mode, and the fixed name on pad and touch', () => {
    const b = assign(DEFAULTS, 'interact', 0, 'KeyT').bindings;
    expect(deviceText('Press E at the lever.', 'keys', b)).toBe('Press T at the lever.');
    expect(deviceText('E  Ride the lift', 'keys', b)).toBe('T  Ride the lift');
    expect(deviceText('Press E at the lever.', 'pad', b)).toBe('Press X at the lever.');
    const g = assign(DEFAULTS, 'gadget', 0, 'KeyH').bindings;
    expect(deviceText('A gadget: press F to lay a mine.', 'keys', g)).toBe('A gadget: press H to lay a mine.');
  });
});

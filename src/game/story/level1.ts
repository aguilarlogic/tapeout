// Level 1, Bit Zero (Phase 2 Level 1 Build Spec, "Room by room"): eleven rooms from the cold boot to the exit lift,
// and the Loft. Each room is its own area with a save node at its entry. Floors sit 80 px above the room's bottom
// edge; every step up is within the 169 px jump, and the Twin Motors pit is wider than a jump plus a dash
// (level1.test.ts checks both).
import type { Rect } from '../level/room';
import { crateSide, TILE } from '../tuning';
import type { StoryRoom } from './types';

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Outer walls, ceiling and floor for a w × h room. The right wall leaves a doorway `door` px tall above `exitFloor`
 * (default: the floor); the left wall is closed (the way back is behind a shut door). */
function shell(w: number, h: number, o: { exitFloor?: number; door?: number; floor?: boolean } = {}): Rect[] {
  const floor = h - 80, ef = o.exitFloor ?? floor, door = o.door ?? 150;
  return [
    r(-TILE, -TILE, TILE, h + 2 * TILE), // left wall
    r(0, -TILE, w, TILE), // ceiling
    r(w, -TILE, TILE, ef - door + TILE), // right wall above the doorway
    r(w, ef, TILE, h - ef + TILE), // right wall below it
    ...(o.floor === false ? [] : [r(0, floor, w, 80)]),
  ];
}

const crate = (x: number, floor: number, mass: number) => ({ kind: 'crate' as const, mass, x, y: floor - crateSide(mass) / 2 - 1 });
const none = { oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [], stations: [], triggers: [], gates: [] };
/** A trace along the back wall at height y, with a jog. */
const trace = (x0: number, x1: number, y: number, jog = 40) => [{ x: x0, y }, { x: (x0 + x1) / 2 - 20, y }, { x: (x0 + x1) / 2 + 20, y: y - jog }, { x: x1, y: y - jog }];

// --- 1. Dark Bay --------------------------------------------------------------------------------------------------
const F1 = 640;
export const DARK_BAY: StoryRoom = {
  ...none,
  id: 'dark-bay', name: 'Dark Bay', w: 2000, h: 720, dark: true, music: 'keeper', modules: ['first-wire'],
  spawn: { x: 140, y: F1 - 24 },
  solids: [...shell(2000, 720), r(520, F1 - 60, 220, 60), r(1500, F1 - 90, 160, 90), r(1800, 0, 48, F1 - 150)],
  wire: {
    level: 'first-wire',
    terminals: [
      { pin: 'in:in', x: 900, y: F1, label: 'SWITCH', role: 'source' },
      { pin: 'out:out', x: 1300, y: F1, label: 'LAMP', role: 'sink' },
    ],
    strip: { x: 1100, y: 470 },
  },
  gates: [{ id: 'crust', kind: 'crust', rect: r(1800, F1 - 150, 48, 150) }],
  props2: [{ kind: 'lamp', x: 1300, y: 300 }],
  triggers: [
    { id: 'wake', x: 0, lines: ['...dr ne... onl ne?', 'Dark. ...find th  lamp.'] },
    { id: 'wire', x: 760, lines: ['Wire. ...switch to lamp.'] },
    { id: 'crust', x: 1560, lines: ['X... crust. ...shoot it.'] },
  ],
  traces: [trace(0, 900, 420), trace(1000, 2000, 360), trace(200, 1300, 220, -40)],
  exit: { x: 1960 },
};

// --- 2. Bit Wall --------------------------------------------------------------------------------------------------
const F2 = 640;
export const BIT_WALL: StoryRoom = {
  ...none,
  id: 'bit-wall', name: 'Bit Wall', w: 1800, h: 720, music: 'keeper', modules: ['bits'],
  spawn: { x: 100, y: F2 - 24 },
  solids: [...shell(1800, 720), r(500, F2 - 40, 260, 40), r(1500, 0, 48, F2 - 200)],
  props: [crate(560, F2 - 40, 1), crate(630, F2 - 40, 2), crate(700, F2 - 40, 2)],
  stations: [{ id: 'port', kind: 'port', x: 1150, y: F2, label: 'DIAGNOSTIC PORT', module: 'bits' }],
  gates: [{ id: 'shutter', kind: 'shutter', rect: r(1500, F2 - 200, 48, 200) }],
  lamps: { x: 1330, y: 300, n: 8, gap: 50 },
  props2: [{ kind: 'coilgate', x: 240, y: F2 }],
  triggers: [
    { id: 'coil', x: 240, lines: ['Coil... onl ne. Hold... right cl ck.'] },
    { id: 'port', x: 980, lines: ['Port. ...plug in.'] },
  ],
  signs: [{ x: 520, y: 520, text: 'CRATES · GRAB, CARRY, THROW' }],
  traces: [trace(0, 1500, 440), trace(300, 1800, 160, -30)],
  exit: { x: 1760 },
};

// --- 3. Gate Hall -------------------------------------------------------------------------------------------------
const F3 = 640;
export const GATE_HALL: StoryRoom = {
  ...none,
  id: 'gate-hall', name: 'Gate Hall', w: 2200, h: 720, music: 'keeper', modules: ['bool'],
  spawn: { x: 100, y: F3 - 24 },
  solids: [...shell(2200, 720), r(1200, 0, 48, F3 - 220), r(1900, 0, 48, F3 - 220)],
  props: [crate(450, F3, 3)],
  dplates: [r(650, F3 - 8, 100, 8), r(950, F3 - 8, 100, 8)],
  gates: [
    { id: 'door', kind: 'door', rect: r(1200, F3 - 220, 48, 220) },
    { id: 'power', kind: 'door', rect: r(1900, F3 - 220, 48, 220) },
  ],
  stations: [{ id: 'port', kind: 'port', x: 1550, y: F3, label: 'DIAGNOSTIC PORT', module: 'bool' }],
  triggers: [
    { id: 'door', x: 0, lines: ['Door. ...two plates.'] },
    { id: 'port', x: 1380, lines: ['AND. ...that was the door.'] },
  ],
  signs: [{ x: 640, y: 560, text: 'PLATE A' }, { x: 940, y: 560, text: 'PLATE B' }],
  traces: [trace(0, 1200, 420), trace(1248, 2200, 380)],
  exit: { x: 2160 },
};

// --- 4. Lift Shaft ------------------------------------------------------------------------------------------------
const F4 = 1360, TOP4 = 260;
export const LIFT_SHAFT: StoryRoom = {
  ...none,
  id: 'lift-shaft', name: 'Lift Shaft', w: 1280, h: 1440, music: 'keeper', modules: ['first-not'],
  spawn: { x: 100, y: F4 - 24 },
  solids: [
    ...shell(1280, 1440, { exitFloor: TOP4, floor: false }),
    r(0, F4, 520, 80), r(760, F4, 520, 80), r(520, F4 + 24, 240, 56), // floor either side of the lift well
    r(760, TOP4, 520, 40), // the exit ledge
    r(760, TOP4 + 40, 40, F4 - TOP4 - 40 - 200), // the shaft's right wall, open at the bottom to the floor
  ],
  wire: {
    level: 'first-not',
    gate: { kind: 'NOT', x: 330, y: 1100 },
    terminals: [
      { pin: 'in:a', x: 140, y: F4, label: 'SENSOR', role: 'source' },
      { pin: 'g.a', x: 290, y: F4, label: 'NOT IN', role: 'gate' },
      { pin: 'g.y', x: 370, y: F4, label: 'NOT OUT', role: 'gate' },
      { pin: 'out:y', x: 470, y: F4, label: 'LIFT', role: 'sink' },
    ],
    strip: { x: 330, y: 960 },
  },
  gates: [{ id: 'lift', kind: 'lift', rect: r(520, F4, 240, 24) }],
  props2: [{ kind: 'sensor', x: 640, y: F4 - 4 }],
  triggers: [{ id: 'lift', x: 0, lines: ['Lift. ...sensor\'s upside down.'] }],
  signs: [{ x: 800, y: 1180, text: 'SENSOR READS 1 WHEN THE LIFT IS EMPTY · LIFT GOES UP ON 1' }],
  traces: [trace(0, 520, 900), trace(800, 1280, 600), trace(0, 760, 500, -40)],
  exit: { x: 1240, y: TOP4 + 2 },
};

// --- 5. Floater Shaft ---------------------------------------------------------------------------------------------
const F5 = 1120;
const steps5: [number, number][] = [[180, 1000], [460, 870], [740, 740], [460, 610], [180, 480], [460, 350]];
export const FLOATER_SHAFT: StoryRoom = {
  ...none,
  id: 'floater-shaft', name: 'Floater Shaft', w: 1600, h: 1200, music: 'keeper', modules: [],
  spawn: { x: 100, y: F5 - 24 },
  solids: [...shell(1600, 1200, { exitFloor: 220 }), r(740, 220, 860, 40)],
  oneWay: steps5.map(([x, y]) => r(x, y, 260, 16)),
  plates: [r(810, 740 - 6, 120, 6), r(250, 480 - 6, 120, 6)],
  floaters: [{ x: 600, y: 960 }, { x: 900, y: 660 }, { x: 330, y: 540 }, { x: 620, y: 300 }],
  triggers: [{ id: 'float', x: 0, lines: ['Float rs. ...red ones bite.'] }],
  signs: [{ x: 60, y: 1060, text: 'FLOATING INPUTS DRIFT · RED HURTS · GREY IS SAFE · GROUND PLATES PIN THEM' }],
  traces: [trace(0, 1600, 1060, 30), trace(0, 1100, 700), trace(300, 1600, 420)],
  exit: { x: 1560, y: 222 },
};

// --- 6. Twin Motors -----------------------------------------------------------------------------------------------
const F6 = 640, PIT = { x: 900, w: 640 };
export const TWIN_MOTORS: StoryRoom = {
  ...none,
  id: 'twin-motors', name: 'Twin Motors', w: 2000, h: 720, music: 'keeper', modules: ['first-and'],
  spawn: { x: 100, y: F6 - 24 },
  solids: [...shell(2000, 720, { floor: false }), r(0, F6, PIT.x, 80), r(PIT.x + PIT.w, F6, 2000 - PIT.x - PIT.w, 80)],
  props: [crate(1760, F6, 5)],
  wire: {
    level: 'first-and',
    gate: { kind: 'AND', x: 600, y: 420 },
    terminals: [
      { pin: 'in:a', x: 260, y: F6, label: 'LEVER A', role: 'source' },
      { pin: 'in:b', x: 360, y: F6, label: 'LEVER B', role: 'source' },
      { pin: 'g.a', x: 540, y: F6, label: 'AND IN A', role: 'gate' },
      { pin: 'g.b', x: 610, y: F6, label: 'AND IN B', role: 'gate' },
      { pin: 'g.y', x: 690, y: F6, label: 'AND OUT', role: 'gate' },
      { pin: 'out:y', x: 840, y: F6, label: 'BRIDGE', role: 'sink' },
    ],
    strip: { x: 600, y: 300 },
  },
  stations: [
    // the levers stand on the source terminals: E wires them until the check passes, then flips them
    { id: 'lever-a', kind: 'lever', x: 260, y: F6, label: 'LEVER A' },
    { id: 'lever-b', kind: 'lever', x: 360, y: F6, label: 'LEVER B' },
  ],
  gates: Array.from({ length: 8 }, (_, i) => ({ id: `bridge${i}`, kind: 'bridge' as const, rect: r(PIT.x + i * 80, F6, 80, 24) })),
  triggers: [
    { id: 'bridge', x: 0, lines: ['Bridge. ...needs both motors.'] },
  ],
  signs: [{ x: 1600, y: 520, text: 'MASS 5' }],
  traces: [trace(0, 900, 520), trace(900, 2000, 300)],
  exit: { x: 1960 },
};
export const PIT6 = PIT;

// --- 7. Bit 0 Chamber ---------------------------------------------------------------------------------------------
const F7 = 640;
export const BIT0_CHAMBER: StoryRoom = {
  ...none,
  id: 'bit0-chamber', name: 'Bit 0 Chamber', w: 1600, h: 720, dark: true, music: 'keeper', modules: ['logic-half'],
  spawn: { x: 100, y: F7 - 24 },
  solids: [...shell(1600, 720), r(1480, 0, 48, F7 - 200)],
  stations: [{ id: 'panel', kind: 'panel', x: 800, y: F7, label: 'PATCH PANEL', module: 'logic-half' }],
  gates: [{ id: 'door', kind: 'door', rect: r(1480, F7 - 200, 48, 200) }],
  props2: [{ kind: 'alu', x: 800, y: 300, w: 420, h: 200 }, { kind: 'plaque', x: 800, y: 540 }],
  triggers: [{ id: 'alu', x: 0, lines: ['Bit zero. ...ALU. Dark.'] }],
  traces: [trace(0, 1600, 560, 30), trace(0, 700, 200), trace(900, 1600, 220)],
  exit: { x: 1560 },
};

// --- 8. First Fight -----------------------------------------------------------------------------------------------
const F8 = 640;
export const FIRST_FIGHT: StoryRoom = {
  ...none,
  id: 'first-fight', name: 'First Fight', w: 2400, h: 720, music: 'keeper', modules: [],
  spawn: { x: 100, y: F8 - 24 },
  solids: [...shell(2400, 720), r(500, F8 - 130, 220, 24), r(1050, F8 - 150, 260, 24), r(1650, F8 - 130, 220, 24), r(2300, 0, 48, F8 - 200)],
  props: [crate(380, F8, 2), crate(980, F8, 3), crate(1500, F8, 5)],
  floaters: [{ x: 620, y: 380 }, { x: 1180, y: 340 }, { x: 1760, y: 380 }, { x: 1400, y: 470 }],
  spikes: [{ x: 860, y: F8, dir: 'up', offset: 0 }, { x: 1950, y: F8, dir: 'up', offset: 60 }],
  enemies: [{ kind: 'glitch', x: 1200, y: F8 - 16 }, { kind: 'glitch', x: 1800, y: F8 - 16 }, { kind: 'glitch', x: 2100, y: F8 - 16 }],
  gates: [{ id: 'door', kind: 'door', rect: r(2300, F8 - 200, 48, 200) }],
  triggers: [{ id: 'fight', x: 0, lines: ['Glitches. ...lots.'] }],
  signs: [{ x: 160, y: 520, text: 'THROW CRATES · THEY HIT HARD' }],
  traces: [trace(0, 2400, 420), trace(0, 1200, 200)],
  exit: { x: 2360 },
};

// --- 9. Boss Door -------------------------------------------------------------------------------------------------
const F9 = 640;
export const BOSS_DOOR: StoryRoom = {
  ...none,
  id: 'boss-door', name: 'Boss Door', w: 1280, h: 720, music: 'keeper', modules: [],
  spawn: { x: 100, y: F9 - 24 },
  solids: [...shell(1280, 720, { door: 220 }), r(1100, 0, 48, F9 - 220)],
  gates: [{ id: 'door', kind: 'door', rect: r(1100, F9 - 220, 48, 220) }],
  triggers: [{ id: 'ahead', x: 300, lines: ['Demo board... ahead. It\'s... dark.'] }],
  traces: [trace(0, 1280, 400, 30), trace(0, 1100, 240)],
  exit: { x: 1240 },
};

// --- 10. Demo Board Arena -----------------------------------------------------------------------------------------
const F10 = 820;
/** Instrument nodes, in the incident's order: flip 00..11, probe a..led-pin, meter led, look. */
const NODES: [string, string, number, number][] = [
  ['flip', '00', 150, F10], ['flip', '01', 300, F10 - 140], ['flip', '10', 150, F10 - 280], ['flip', '11', 300, F10 - 420],
  ['probe', 'a', 1770, F10], ['probe', 'b', 1620, F10 - 140], ['probe', 'and-out', 1770, F10 - 280], ['probe', 'led-pin', 1620, F10 - 420],
  ['meter', 'led', 640, F10 - 200], ['look', '', 1280, F10 - 200],
];
export const ARENA: StoryRoom = {
  ...none,
  id: 'arena', name: 'Demo Board Arena', w: 1920, h: 900, music: 'boss', modules: ['inc-demo-board'],
  spawn: { x: 960, y: F10 - 24 },
  solids: [
    ...shell(1920, 900, { door: 220 }),
    r(1872, 0, 48, F10 - 220), // the wall above the way out
    // the node platforms up each side
    r(240, F10 - 140, 140, 20), r(90, F10 - 280, 140, 20), r(240, F10 - 420, 140, 20),
    r(1540, F10 - 140, 140, 20), r(1690, F10 - 280, 140, 20), r(1540, F10 - 420, 140, 20),
    r(560, F10 - 200, 160, 20), r(1200, F10 - 200, 160, 20),
  ],
  stations: [
    ...NODES.map(([cmd, arg, x, y]) => ({ id: `node:${cmd}${arg ? ` ${arg}` : ''}`, kind: 'node' as const, x, y, label: `${cmd.toUpperCase()}${arg ? ` ${arg.toUpperCase()}` : ''}`, arg: `${cmd}${arg ? ` ${arg}` : ''}` })),
    { id: 'debug', kind: 'debug', x: 960, y: F10, label: 'DEBUG PORT', module: 'inc-demo-board' },
  ],
  enemies: [{ kind: 'glitch', x: 600, y: F10 - 16 }, { kind: 'glitch', x: 1320, y: F10 - 16 }],
  gates: [{ id: 'door', kind: 'door', rect: r(1872, F10 - 220, 48, 220) }],
  props2: [{ kind: 'board', x: 960, y: 370, w: 520, h: 240 }],
  traces: [trace(0, 700, 700), trace(1220, 1920, 700), trace(0, 1920, 90, -30)],
  exit: { x: 1900 },
};

// --- 11. Workbench ------------------------------------------------------------------------------------------------
const F11 = 640;
export const WORKBENCH: StoryRoom = {
  ...none,
  id: 'workbench', name: 'Workbench', w: 1280, h: 720, music: 'bench', modules: ['gates', 'half-adder-v'],
  spawn: { x: 100, y: F11 - 24 },
  solids: [...shell(1280, 720, { door: 0 })],
  stations: [
    { id: 'bench-gates', kind: 'bench', x: 480, y: F11, label: 'BENCH · GATES', module: 'gates' },
    { id: 'bench-ha', kind: 'bench', x: 760, y: F11, label: 'BENCH · HALF ADDER', module: 'half-adder-v' },
    { id: 'lift', kind: 'lift', x: 1140, y: F11, label: 'EXIT LIFT' },
  ],
  props2: [{ kind: 'rig', x: 620, y: 380, w: 520, h: 160 }],
  triggers: [{ id: 'bench', x: 0, lines: ['Bench. ...write it down. Verilog. So it stays.'] }],
  traces: [trace(0, 1280, 300), trace(0, 1280, 140, -30)],
  exit: { x: 99999 },
};

export const LEVEL1: StoryRoom[] = [DARK_BAY, BIT_WALL, GATE_HALL, LIFT_SHAFT, FLOATER_SHAFT, TWIN_MOTORS, BIT0_CHAMBER, FIRST_FIGHT, BOSS_DOOR, ARENA, WORKBENCH];

// --- The Loft -----------------------------------------------------------------------------------------------------
const FL = 640;
export const LOFT: StoryRoom = {
  ...none,
  id: 'loft', name: 'The Loft', w: 2400, h: 720, music: 'loft', modules: [],
  spawn: { x: 2260, y: FL - 24 },
  solids: [...shell(2400, 720, { door: 0 }), r(0, FL - 20, 140, 20)],
  stations: [
    { id: 'archive', kind: 'archive', x: 260, y: FL, label: 'ARCHIVE' },
    { id: 'review', kind: 'review', x: 640, y: FL, label: 'REVIEW DESK' },
    { id: 'board', kind: 'board', x: 880, y: FL, label: 'CHALKBOARD · VOLTS AND AMPS' },
    { id: 'map', kind: 'map', x: 1200, y: FL, label: 'CHIP MAP' },
    { id: 'crt', kind: 'crt', x: 1540, y: FL, label: 'OLD DESKTOP' },
    { id: 'arcade', kind: 'arcade', x: 1760, y: FL, label: 'ARCADE' },
    { id: 'interview', kind: 'interview', x: 1980, y: FL, label: 'INTERVIEW ROOM' },
    { id: 'lift', kind: 'lift', x: 2260, y: FL, label: 'LIFT' },
  ],
  props2: [{ kind: 'window', x: 1200, y: 250, w: 760, h: 300 }],
  triggers: [],
  traces: [trace(0, 600, 560, 20), trace(1600, 2400, 560, 20)],
  exit: { x: 99999 },
};

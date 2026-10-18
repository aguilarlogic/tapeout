// The phase 1 test room: one long room that exercises every move, the Field Coil, the Pulse Probe and both
// phase 1 enemies, left to right. Floor top is at y = 1000; the room is 4000 × 1080 px (100 × 27 tiles).
import { TILE } from '../tuning';
import type { Rect, Room } from './room';

const FLOOR = 1000;
const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const TEST_ROOM: Room = {
  name: 'Test room',
  w: 4000,
  h: 1080,
  spawn: { x: 160, y: FLOOR - 24 },
  solids: [
    // outer walls and ceiling
    r(-TILE, 0, TILE, 1080), r(4000, 0, TILE, 1080), r(0, -TILE, 4000, TILE),
    // floor, broken by the pit at 1480..1680
    r(0, FLOOR, 1480, 80), r(1680, FLOOR, 2320, 80),
    // 1. jump steps 80 and 160 high, then a 240 px pillar that needs the double jump from the floor
    r(400, FLOOR - 80, 120, 80), r(560, FLOOR - 160, 120, 160), r(800, FLOOR - 240, 80, 240),
    // 2. wall-jump shaft: two walls 160 apart, 480 tall, with a ledge on top of the right one
    r(1000, FLOOR - 560, 40, 480), r(1200, FLOOR - 560, 40, 560), r(1240, FLOOR - 560, 160, 40),
    // 3. a low ceiling to crouch under (38 px gap: standing is 48, crouched 30)
    r(1760, FLOOR - 38 - 40, 200, 40),
    // 6. far wall step before the emitter
    r(3640, FLOOR - 80, 360, 80),
  ],
  oneWay: [r(1040, FLOOR - 200, 160, 8), r(1040, FLOOR - 380, 160, 8), r(2040, FLOOR - 140, 200, 8), r(2040, FLOOR - 280, 200, 8)],
  hazards: [r(3420, FLOOR - 20, 160, 20)],
  plates: [r(2760, FLOOR - 8, 120, 8)],
  blocks: [
    { x: 2320, y: FLOOR - 20, size: 40 },
    { x: 2400, y: FLOOR - 30, size: 60 },
    { x: 2500, y: FLOOR - 40, size: 80 },
    { x: 2630, y: FLOOR - 60, size: 120 }, // too heavy for the Field Coil (90 units)
  ],
  floaters: [{ x: 2900, y: FLOOR - 200 }, { x: 3060, y: FLOOR - 260 }],
  spikes: [
    { x: 3240, y: FLOOR, dir: 'up', offset: 30 },
    { x: 3340, y: FLOOR, dir: 'up', offset: 90 },
  ],
  emitters: [{ x: 3940, y: FLOOR - 200 }],
  traces: [
    [{ x: 0, y: 900 }, { x: 360, y: 900 }, { x: 400, y: 860 }, { x: 960, y: 860 }],
    [{ x: 1300, y: 300 }, { x: 1700, y: 300 }, { x: 1760, y: 360 }, { x: 2600, y: 360 }, { x: 2640, y: 320 }, { x: 4000, y: 320 }],
    [{ x: 1800, y: 820 }, { x: 2200, y: 820 }, { x: 2240, y: 780 }, { x: 3600, y: 780 }],
  ],
  signs: [
    { x: 120, y: 800, text: 'MOVE  A D  ·  JUMP  W / SPACE' },
    { x: 400, y: 640, text: 'STEPS 80 · 160  ·  PILLAR 240: DOUBLE JUMP' },
    { x: 1020, y: 340, text: 'WALL JUMP' },
    { x: 1480, y: 880, text: 'PIT' },
    { x: 3420, y: 940, text: 'SHORT CIRCUIT' },
    { x: 1760, y: 880, text: 'CROUCH  S' },
    { x: 2040, y: 660, text: 'ONE-WAY  ·  S + JUMP DROPS' },
    { x: 2300, y: 780, text: 'FIELD COIL  RIGHT CLICK  ·  THROW  LEFT CLICK' },
    { x: 2760, y: 940, text: 'GROUNDING PLATE' },
    { x: 3200, y: 840, text: 'GLITCH SPIKES' },
    { x: 3600, y: 640, text: 'BLOCK SHOTS WITH THE FIELD' },
  ],
};

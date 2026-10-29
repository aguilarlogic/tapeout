// The test room (plan section L, decision 25): a flat start, three platforms at 80, 160 and 260 px, a pile of ten
// crates, two logic blocks and an input pad, a target dummy, and a pressure-plate door with two of each test enemy
// behind it. Floor top is at y = 1000; the room is 3600 × 1080 px.
import { crateSide, TILE } from '../tuning';
import type { PropSpec, Rect, Room } from './room';

const FLOOR = 1000;
const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Ten crates (masses 5, 5, 3, 3, 2, 2, 2, 1, 1, 1) stacked in a rough pyramid, heavy ones at the bottom. */
function cratePile(x0: number): PropSpec[] {
  const rows = [[5, 5, 3], [3, 2, 2], [2, 1], [1, 1]];
  const out: PropSpec[] = [];
  let y = FLOOR;
  for (const row of rows) {
    const sides = row.map(crateSide), w = sides.reduce((a, b) => a + b + 2, 0);
    let x = x0 - w / 2;
    for (let i = 0; i < row.length; i++) {
      out.push({ kind: 'crate', mass: row[i], x: x + sides[i] / 2, y: y - sides[i] / 2 - 1 });
      x += sides[i] + 2;
    }
    y -= Math.max(...sides) + 1;
  }
  return out;
}

export const TEST_ROOM: Room = {
  name: 'Test room',
  w: 3600,
  h: 1080,
  spawn: { x: 200, y: FLOOR - 24 },
  solids: [
    // outer walls and ceiling
    r(-TILE, -TILE, TILE, 1080 + 2 * TILE), r(3600, -TILE, TILE, 1080 + 2 * TILE), r(0, -TILE, 3600, TILE),
    // one floor slab, so nothing snags on seams
    r(0, FLOOR, 3600, 80),
    // three floating platforms whose tops are 80, 160 and 260 px above the floor
    r(560, FLOOR - 80, 200, 24), r(840, FLOOR - 160, 200, 24), r(1120, FLOOR - 260, 200, 24),
    // the wall above the door: nothing gets over it
    r(2240, 0, 48, FLOOR - 200),
    // the arena: two ledges and a raised block
    r(2560, FLOOR - 200, 220, 24), r(3060, FLOOR - 280, 220, 24), r(3420, FLOOR - 120, 180, 120),
  ],
  oneWay: [],
  hazards: [],
  plates: [],
  props: [
    ...cratePile(1560),
    { kind: 'logic', bit: 0, x: 1840, y: FLOOR - 17 },
    { kind: 'logic', bit: 1, x: 1890, y: FLOOR - 17 },
  ],
  pads: [r(1700, FLOOR - 6, 60, 6)],
  dummy: { x: 1300, y: FLOOR },
  door: { rect: r(2240, FLOOR - 200, 48, 200), plate: r(2060, FLOOR - 8, 120, 8) },
  enemies: [
    { kind: 'glitch', x: 2480, y: FLOOR - 16 },
    { kind: 'glitch', x: 2900, y: FLOOR - 16 },
    { kind: 'spark', x: 2670, y: FLOOR - 380 },
    { kind: 'spark', x: 3170, y: FLOOR - 460 },
    { kind: 'latch', x: 2760, y: FLOOR - 24 },
    { kind: 'latch', x: 3260, y: FLOOR - 24 },
  ],
  floaters: [],
  spikes: [],
  emitters: [],
  traces: [
    [{ x: 0, y: 860 }, { x: 420, y: 860 }, { x: 460, y: 820 }, { x: 1000, y: 820 }, { x: 1040, y: 780 }, { x: 1500, y: 780 }],
    [{ x: 300, y: 300 }, { x: 900, y: 300 }, { x: 960, y: 360 }, { x: 1900, y: 360 }, { x: 1940, y: 320 }, { x: 2240, y: 320 }],
    [{ x: 1500, y: 900 }, { x: 2000, y: 900 }, { x: 2040, y: 940 }, { x: 2240, y: 940 }],
    [{ x: 2288, y: 600 }, { x: 2700, y: 600 }, { x: 2740, y: 560 }, { x: 3600, y: 560 }],
    [{ x: 2288, y: 860 }, { x: 3000, y: 860 }, { x: 3040, y: 900 }, { x: 3420, y: 900 }],
  ],
  signs: [
    { x: 120, y: 760, text: 'MOVE  A D  ·  JUMP  W / SPACE  ·  DASH  SHIFT' },
    { x: 560, y: 640, text: 'FIRE  HOLD LEFT CLICK  ·  SWAP  Q' },
    { x: 1250, y: 620, text: 'TARGET DUMMY' },
    { x: 1440, y: 680, text: 'FIELD COIL  HOLD RIGHT CLICK' },
    { x: 1440, y: 702, text: 'THROW  HOLD + RELEASE LEFT CLICK' },
    { x: 1680, y: 940, text: 'INPUT PAD' },
    { x: 2010, y: 760, text: 'PUT A CRATE ON THE PLATE' },
    { x: 2330, y: 700, text: 'LATCH: ARMOURED FRONT. HIT IT FROM BEHIND, OR THROW A CRATE' },
  ],
};

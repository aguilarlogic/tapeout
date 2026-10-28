// The wing boss bodies, part E (Phase 8 Spec, section 5): the mute (a block with an SPI port and a crossed-out speaker), the
// custboard (a demo board outline with one chip turned) and the sensor (a 12 x 8 pixel grid with bands moving through).
// They keep the act 1 to 4 look (line art with a glow, a PAL.fill inside, amber for the part that is about to attack,
// cracks for damage, a white flash on a hit, a dashed shield ring) and draw inside the arena's boss rect.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import type { Pt } from './attacks';
import { C, centre, circle, cracks, flash, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

/** The four corners of a w x h rect centred on (cx, cy), turned by `ang` radians (clockwise on screen). */
function corners(cx: number, cy: number, w: number, h: number, ang: number): Pt[] {
  const co = Math.cos(ang), si = Math.sin(ang);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({
    x: cx + (u * w) / 2 * co - (v * h) / 2 * si,
    y: cy + (u * w) / 2 * si + (v * h) / 2 * co,
  }));
}

/** A closed polygon through `pts`. */
function poly(g: C, pts: Pt[]) {
  pts.forEach((p, k) => { if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
  g.closePath();
}

// ---- mute ----------------------------------------------------------------------------------------------------------

/** The block is 300 x 150 px. Its SPI port hangs 22 px below the bottom edge, with four pins up into the block. The
 *  speaker sits on the left: a cone, with a cross over it that says it is switched off. */
const BLOCK_W = 300, BLOCK_H = 150, BLOCK_R = 12;
const PORT_W = 140, PORT_H = 22, PINS = 4, PIN_STEP = 28;
const CONE: [number, number][] = [[-120, -18], [-96, -18], [-74, -40], [-74, 40], [-96, 18], [-120, 18]];
const CROSS: [number, number][][] = [[[-130, -52], [-64, 52]], [[-64, -52], [-130, 52]]];

/** The mute: a block with an SPI port on its bottom edge and a speaker crossed out on its left. The address attack glows
 *  the port as it telegraphs; the bolts attack glows the speaker's cone. */
export const mute: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: BLOCK_W, h: BLOCK_H };
  const block = () => rrect(g, cx - BLOCK_W / 2, cy - BLOCK_H / 2, BLOCK_W, BLOCK_H, BLOCK_R);
  const bottom = cy + BLOCK_H / 2;
  const port = () => { g.rect(cx - PORT_W / 2, bottom, PORT_W, PORT_H); };
  const pins = () => {
    for (let k = 0; k < PINS; k++) {
      const x = cx + (k - (PINS - 1) / 2) * PIN_STEP;
      g.moveTo(x, bottom + 5);
      g.lineTo(x, bottom + PORT_H - 5);
    }
  };
  const cone = () => poly(g, CONE.map(([x, y]) => ({ x: cx + x, y: cy + y })));
  const cross = () => {
    for (const [a, b] of CROSS) {
      g.moveTo(cx + a[0], cy + a[1]);
      g.lineTo(cx + b[0], cy + b[1]);
    }
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, block);
  cracks(g, e, s);
  g.beginPath();
  port();
  pins();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  cone();
  g.strokeStyle = PAL.line;
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  cross();
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.font = `14px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SPI', cx + 70, cy - 36);
  telegraph(g, s, s.attack === 'address' ? () => { port(); pins(); } : cone);
  flash(g, s, block);
  g.restore();
};

// ---- custboard -----------------------------------------------------------------------------------------------------

/** The board is 420 x 240 px, with rounded corners, like the Level 1 demo board. Two chips sit straight, and one is turned
 *  by 45 degrees, the chip that will not boot. Chips are 64 x 44 px, with a pin 1 dot in one corner. */
const BOARD_W = 420, BOARD_H = 240, BOARD_R = 14;
const CHIP_W = 64, CHIP_H = 44, TURN = Math.PI / 4;

/** The custboard: the demo board outline with two straight chips and one chip turned. The mismatch attack glows the
 *  turned chip as it telegraphs; the drop attack glows the board. */
export const custboard: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: BOARD_W, h: BOARD_H };
  const board = () => rrect(g, cx - BOARD_W / 2, cy - BOARD_H / 2, BOARD_W, BOARD_H, BOARD_R);
  const straight: Rect[] = [
    { x: cx - 150, y: cy - 80, w: CHIP_W, h: CHIP_H },
    { x: cx - 150, y: cy + 30, w: CHIP_W, h: CHIP_H },
  ];
  const tx = cx + 100, ty = cy - 10;
  const turned = () => poly(g, corners(tx, ty, CHIP_W, CHIP_H, TURN));
  const pin1 = (): Pt => corners(tx, ty, CHIP_W, CHIP_H, TURN)[0];
  const traces = () => {
    g.moveTo(cx - 86, cy - 58); g.lineTo(cx - 30, cy - 58); g.lineTo(cx - 30, cy - 100); g.lineTo(cx + 60, cy - 100);
    g.moveTo(cx - 86, cy + 52); g.lineTo(cx - 40, cy + 52); g.lineTo(cx - 40, cy + 90); g.lineTo(cx + 150, cy + 90);
    g.moveTo(cx - 40, cy - 20); g.lineTo(cx + 20, cy - 20);
  };
  const chips = () => { for (const r of straight) g.rect(r.x, r.y, r.w, r.h); };
  g.save();
  shield(g, e, s);
  silhouette(g, s, board);
  cracks(g, e, s);
  g.beginPath();
  traces();
  g.strokeStyle = rgba(PAL.idle, 0.6);
  g.lineWidth = LINE.world;
  g.stroke();
  g.beginPath();
  chips();
  turned();
  g.strokeStyle = PAL.line;
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  for (const r of straight) circle(g, r.x + 8, r.y + 8, 2.5);
  const p = pin1();
  circle(g, p.x, p.y, 2.5);
  g.fillStyle = PAL.idle;
  g.fill();
  telegraph(g, s, s.attack === 'mismatch' ? turned : board);
  flash(g, s, board);
  g.restore();
};

// ---- sensor --------------------------------------------------------------------------------------------------------

/** The sensor: 12 columns by 8 rows of pixels, 22 px apart, each drawn 17 px square. Two bands move through the grid: a
 *  vertical one 3 columns wide, moving 2 columns a second, and a horizontal one 2 rows tall, moving 1.2 rows a second. */
const COLS = 12, ROWS = 8, CELL = 22, PIX = 17, PAD = 14, FRAME_R = 14;
const COL_RATE = 2, ROW_RATE = 1.2;

/** The distance between two positions on a ring of `n` cells, so the bands wrap at the edges. */
function wrapDist(a: number, n: number): number {
  const d = ((a % n) + n) % n;
  return Math.min(d, n - d);
}

/** Whether pixel (c, r) is inside a moving band at step `t`: the vertical band's column or the horizontal band's row. */
function lit(c: number, r: number, t: number): boolean {
  const secs = t / HZ;
  const col = (secs * COL_RATE) % COLS, row = (secs * ROW_RATE) % ROWS;
  return wrapDist(c + 0.5 - col, COLS) < 1.5 || wrapDist(r + 0.5 - row, ROWS) < 1;
}

/** The sensor: a framed grid of pixels. The lit pixels are the bands, filled; the rest are outlined. The bands attack
 *  glows the frame as it telegraphs; the bolts attack glows every pixel. */
export const sensor: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const W = COLS * CELL, H = ROWS * CELL;
  const x0 = cx - W / 2, y0 = cy - H / 2;
  const e: Ext = { cx, cy, w: W + 2 * PAD, h: H + 2 * PAD };
  const frame = () => rrect(g, cx - e.w / 2, cy - e.h / 2, e.w, e.h, FRAME_R);
  const cells = (keep: (on: boolean) => boolean) => () => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!keep(lit(c, r, s.t))) continue;
        g.rect(x0 + c * CELL + (CELL - PIX) / 2, y0 + r * CELL + (CELL - PIX) / 2, PIX, PIX);
      }
    }
  };
  const dim = cells((on) => !on);
  const bright = cells((on) => on);
  const all = cells(() => true);
  g.save();
  shield(g, e, s);
  silhouette(g, s, frame);
  cracks(g, e, s);
  g.beginPath();
  dim();
  g.strokeStyle = rgba(PAL.idle, 0.35);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  bright();
  g.fillStyle = rgba(PAL.neon, 0.55);
  g.fill();
  g.strokeStyle = PAL.neon;
  g.lineWidth = LINE.hud;
  g.stroke();
  telegraph(g, s, s.attack === 'bands' ? frame : all);
  flash(g, s, frame);
  g.restore();
};

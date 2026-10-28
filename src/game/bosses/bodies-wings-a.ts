// The wing boss bodies, part A (Phase 8 Spec, section 5): the antenna mast of The Deaf Radio, the buck coil over a switch
// of The Rail That Rings, and the 8 x 4 memory array of The Flipping Bits. They keep the act 1 to 4 look (magenta line art
// with a glow, a PAL.fill inside, amber for the part about to attack, cracks for damage, a white flash on a hit, a dashed
// shield ring) and draw inside the arena's boss rect. The attacks in attacks-wings-a.ts draw their own bands, waves and
// bits on top of these bodies.
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { HZ } from '../tuning';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

// ---- antenna -------------------------------------------------------------------------------------------------------

/** The mast: a tapered tower from a base 100 px below the box centre up to the arc centre, 20 px above it. */
const MAST_TOP = -20, MAST_BASE = 100, MAST_W = 64, TIP_W = 14;
/** Three arcs round the tip, 30, 56 and 82 px out. The outer arc is broken at the top, a gap of 0.25 rad either side. */
const ARCS = [30, 56, 82], ARC_A0 = -0.75 * Math.PI, ARC_A1 = -0.25 * Math.PI, ARC_GAP = 0.25;

/** The antenna: a mast with 3 arcs over its tip, the top arc broken. The noise attack glows the arcs as it telegraphs,
 *  the bolts attack glows the tip. */
export const antenna: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const tip = cy + MAST_TOP, base = cy + MAST_BASE;
  const e: Ext = { cx, cy, w: 180, h: 210 };
  const mast = () => {
    g.moveTo(cx - MAST_W / 2, base);
    g.lineTo(cx - TIP_W / 2, tip);
    g.lineTo(cx + TIP_W / 2, tip);
    g.lineTo(cx + MAST_W / 2, base);
    g.closePath();
  };
  const arcs = () => {
    ARCS.forEach((r, k) => {
      if (k < 2) {
        g.moveTo(cx + r * Math.cos(ARC_A0), tip + r * Math.sin(ARC_A0));
        g.arc(cx, tip, r, ARC_A0, ARC_A1);
        return;
      }
      const up = -Math.PI / 2;
      g.moveTo(cx + r * Math.cos(ARC_A0), tip + r * Math.sin(ARC_A0));
      g.arc(cx, tip, r, ARC_A0, up - ARC_GAP);
      g.moveTo(cx + r * Math.cos(up + ARC_GAP), tip + r * Math.sin(up + ARC_GAP));
      g.arc(cx, tip, r, up + ARC_GAP, ARC_A1);
    });
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, mast);
  cracks(g, e, s);
  g.beginPath();
  arcs();
  glow(g, PAL.neon, 0.9, LINE.enemy);
  telegraph(g, s, s.attack === 'bolts' ? () => circle(g, cx, tip, 10) : arcs);
  flash(g, s, mast);
  g.restore();
};

// ---- buck ----------------------------------------------------------------------------------------------------------

/** The coil: six upper half loops 24 px apart over a core bar, 30 px above the box centre. */
const LOOPS = 6, LOOP_STEP = 24, LOOP_R = 12, COIL_Y = -30;
/** The switch: a 120 x 110 px square under the coil, from 10 px above the centre. */
const SW_W = 120, SW_H = 110, SW_Y = -10, SW_R = 8;
/** The ringing waveform on the switch face: 96 px wide, 28 px amplitude, 3 cycles that decay. Its phase turns at 0.5 Hz. */
const WAVE_W = 96, WAVE_AMP = 28, WAVE_CYCLES = 3, WAVE_N = 48, WAVE_HZ = 0.5;

/** The buck: an inductor coil over a square switch, with a ringing waveform on its face. The ring attack glows the switch
 *  as it telegraphs, the drop attack the coil. */
export const buck: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const sx = cx - SW_W / 2, sy = cy + SW_Y, core = cy + COIL_Y, mid = sy + SW_H / 2;
  const e: Ext = { cx, cy: cy + 29, w: 170, h: 142 };
  const body = () => rrect(g, sx, sy, SW_W, SW_H, SW_R);
  const coil = () => {
    for (let i = 0; i < LOOPS; i++) {
      const x = cx + (i - (LOOPS - 1) / 2) * LOOP_STEP;
      g.moveTo(x - LOOP_R, core);
      g.arc(x, core, LOOP_R, Math.PI, 0);
    }
    g.moveTo(cx - 72, core);
    g.lineTo(cx + 72, core);
  };
  const phase = (s.t / HZ) * WAVE_HZ * 2 * Math.PI;
  const wave = () => {
    for (let i = 0; i <= WAVE_N; i++) {
      const u = i / WAVE_N;
      const x = cx - WAVE_W / 2 + u * WAVE_W;
      const y = mid + WAVE_AMP * Math.exp(-2.5 * u) * Math.sin(2 * Math.PI * WAVE_CYCLES * u + phase);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, body);
  cracks(g, e, s);
  g.beginPath();
  coil();
  glow(g, PAL.neon, 0.9, LINE.enemy);
  g.beginPath();
  wave();
  glow(g, PAL.trace, 0.9, LINE.hud);
  telegraph(g, s, s.attack === 'drop' ? coil : body);
  flash(g, s, body);
  g.restore();
};

// ---- memarray ------------------------------------------------------------------------------------------------------

/** The array: 8 columns and 4 rows of 40 px cells, 8 px apart, inside a frame 14 px out. */
const COLS = 8, ROWS = 4, CELL = 40, CELL_GAP = 8, CELL_R = 5, FRAME = 14;
const GRID_W = COLS * CELL + (COLS - 1) * CELL_GAP, GRID_H = ROWS * CELL + (ROWS - 1) * CELL_GAP;
/** Every 7th cell from the 4th (5 in all) flickers between 0 and 1, changing every 0.4 s. The rest stay put. */
const FLICKER = (i: number) => i % 7 === 3;
const FLICKER_STEP = 24;

/** The memory array: an 8 x 4 grid of cells, a few flickering between 0 and 1. Each cell shows its value, so the state is
 *  not colour alone. The flips attack glows the top row as it telegraphs, the bolts attack the frame. */
export const memarray: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const x0 = cx - GRID_W / 2, y0 = cy - GRID_H / 2;
  const cellAt = (i: number) => ({
    x: x0 + (i % COLS) * (CELL + CELL_GAP),
    y: y0 + Math.floor(i / COLS) * (CELL + CELL_GAP),
    w: CELL,
    h: CELL,
  });
  const frame = () => rrect(g, x0 - FRAME, y0 - FRAME, GRID_W + 2 * FRAME, GRID_H + 2 * FRAME, 12);
  const topRow = () => {
    for (let i = 0; i < COLS; i++) {
      const r = cellAt(i);
      rrect(g, r.x, r.y, r.w, r.h, CELL_R);
    }
  };
  const e: Ext = { cx, cy, w: GRID_W + 2 * FRAME, h: GRID_H + 2 * FRAME };
  g.save();
  shield(g, e, s);
  silhouette(g, s, frame);
  cracks(g, e, s);
  for (let i = 0; i < COLS * ROWS; i++) {
    const r = cellAt(i);
    const flicker = FLICKER(i);
    const one = flicker ? ((Math.floor(s.t / FLICKER_STEP) + i) & 1) === 1 : i % 3 === 1;
    g.beginPath();
    rrect(g, r.x, r.y, r.w, r.h, CELL_R);
    g.fillStyle = PAL.fill;
    g.fill();
    g.setLineDash(flicker ? [3, 3] : []);
    g.strokeStyle = flicker ? PAL.trace : rgba(PAL.idle, 0.6);
    g.lineWidth = LINE.hud;
    g.stroke();
    g.setLineDash([]);
    g.font = `14px ${FONT}`;
    g.fillStyle = one ? PAL.trace : PAL.idle;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(one ? '1' : '0', r.x + r.w / 2, r.y + r.h / 2);
  }
  telegraph(g, s, s.attack === 'bolts' ? frame : topRow);
  flash(g, s, frame);
  g.restore();
};

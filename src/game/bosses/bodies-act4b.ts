// The act 4 boss bodies, part B (Phase 7 Spec, section 6): the wandering window of six numbered slots, the tower of four
// cache levels, the frozen mesh of 3 x 3 routers and the optimistic model's hologram. They keep the act 1 to 3 look
// (magenta line art with a glow, a PAL.fill inside, amber for the part about to attack, cracks for damage, a white flash
// on a hit, a dashed shield ring) and draw inside the arena's boss rect. The attacks in attacks-act4b.ts draw their own
// numbers, lines and strips on top of these bodies, and place them with the points exported here.
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

/** A point in the arena. */
interface Pt { x: number; y: number }

// ---- window --------------------------------------------------------------------------------------------------------

/** Six slots in a row, 80 px apart, each 64 x 44 px, in a 512 x 120 px frame with a title bar. */
const SLOTS = 6, SLOT_STEP = 80, SLOT_W = 64, SLOT_H = 44, SLOT_R = 6;
/** The slots sit 8 px below the box centre, under the title bar. */
const SLOT_DY = 8;
const WIN_W = 512, WIN_H = 120, WIN_R = 14, BAR_DY = 22;

/** The window's six slot centres, 1 (left) to 6 (right), round a centre point. The reorder attack puts its bolts here. */
export function windowSlots(cx: number, cy: number): Pt[] {
  return Array.from({ length: SLOTS }, (_, k) => ({
    x: cx + (k - (SLOTS - 1) / 2) * SLOT_STEP,
    y: cy + SLOT_DY,
  }));
}

/** The window: a frame with a title bar and six numbered slots in a row. The reorder attack glows the slots as it
 *  telegraphs; the grid attack glows the frame. */
export const window: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: WIN_W, h: WIN_H };
  const frame = () => rrect(g, cx - WIN_W / 2, cy - WIN_H / 2, WIN_W, WIN_H, WIN_R);
  const bar = () => {
    g.moveTo(cx - WIN_W / 2, cy - WIN_H / 2 + BAR_DY);
    g.lineTo(cx + WIN_W / 2, cy - WIN_H / 2 + BAR_DY);
  };
  const slots = windowSlots(cx, cy);
  const slotPath = () => { for (const p of slots) rrect(g, p.x - SLOT_W / 2, p.y - SLOT_H / 2, SLOT_W, SLOT_H, SLOT_R); };
  g.save();
  shield(g, e, s);
  silhouette(g, s, frame);
  cracks(g, e, s);
  g.beginPath();
  bar();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  slotPath();
  g.stroke();
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  slots.forEach((p, k) => g.fillText(String(k + 1), p.x, p.y + SLOT_H / 2 + 8));
  telegraph(g, s, s.attack === 'reorder' ? slotPath : frame);
  flash(g, s, frame);
  g.restore();
};

// ---- tower ---------------------------------------------------------------------------------------------------------

/** Four cache levels, stacked. Level 1 is the narrowest, at the top. Each is 44 px tall, 10 px apart. */
const LEVELS = 4, LEVEL_H = 44, LEVEL_GAP = 10, LEVEL_R = 8;
const LEVEL_W = [180, 260, 340, 420];
const TOWER_H = LEVELS * LEVEL_H + (LEVELS - 1) * LEVEL_GAP;
/** The core: a ring at the middle of the stack, where the bolts leave from. */
const CORE_R = 14;

/** The tower: four stacked cache levels (L1 to L4) joined by a bus, with a core ring in the middle. The evict attack
 *  glows every level as its lines are about to appear; the bolts attack glows the core. */
export const tower: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const top = cy - TOWER_H / 2;
  const levels = Array.from({ length: LEVELS }, (_, k) => ({
    x: cx - LEVEL_W[k] / 2, y: top + k * (LEVEL_H + LEVEL_GAP), w: LEVEL_W[k], h: LEVEL_H,
  }));
  const all = () => { for (const r of levels) rrect(g, r.x, r.y, r.w, r.h, LEVEL_R); };
  const bus = () => {
    for (let k = 0; k < LEVELS - 1; k++) {
      g.moveTo(cx, levels[k].y + LEVEL_H);
      g.lineTo(cx, levels[k + 1].y);
    }
  };
  const core = () => circle(g, cx, cy, CORE_R);
  const e: Ext = { cx, cy, w: LEVEL_W[LEVELS - 1], h: TOWER_H };
  g.save();
  shield(g, e, s);
  silhouette(g, s, all);
  cracks(g, e, s);
  g.beginPath();
  bus();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  core();
  g.stroke();
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  levels.forEach((r, k) => g.fillText(`L${k + 1}`, r.x + r.w / 2, r.y + r.h / 2));
  telegraph(g, s, s.attack === 'evict' ? all : core);
  flash(g, s, all);
  g.restore();
};

// ---- mesh ----------------------------------------------------------------------------------------------------------

/** A 3 x 3 grid of routers, 130 px apart across and 84 px down, each router a 44 px square. */
const ROWS = 3, COLS = 3, PITCH_X = 130, PITCH_Y = 84, ROUTER = 44, ROUTER_R = 8;
/** A router's centre dot. */
const DOT_R = 5;

/** The router centres, row by row from the top left, round a centre point. The jam attack reads the mesh's columns from
 *  here; the segments attack hides the first routers in this order. */
export function meshRouters(cx: number, cy: number): Pt[] {
  const pts: Pt[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) pts.push({ x: cx + (c - 1) * PITCH_X, y: cy + (r - 1) * PITCH_Y });
  }
  return pts;
}

/** The mesh: nine routers joined by twelve links. The jam attack glows the links as it telegraphs; the segments attack
 *  hides the first `away` routers, as the chain does. */
export const mesh: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const pts = meshRouters(cx, cy);
  const gone = (k: number) => s.attack === 'segments' && k < s.away;
  const routers = () => { pts.forEach((p, k) => { if (!gone(k)) rrect(g, p.x - ROUTER / 2, p.y - ROUTER / 2, ROUTER, ROUTER, ROUTER_R); }); };
  const links = () => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = r * COLS + c, p = pts[k];
        if (c + 1 < COLS && !gone(k) && !gone(k + 1)) {
          g.moveTo(p.x + ROUTER / 2, p.y);
          g.lineTo(p.x + PITCH_X - ROUTER / 2, p.y);
        }
        if (r + 1 < ROWS && !gone(k) && !gone(k + COLS)) {
          g.moveTo(p.x, p.y + ROUTER / 2);
          g.lineTo(p.x, p.y + PITCH_Y - ROUTER / 2);
        }
      }
    }
  };
  const dots = () => { pts.forEach((p, k) => { if (!gone(k)) circle(g, p.x, p.y, DOT_R); }); };
  const e: Ext = { cx, cy, w: 2 * PITCH_X + ROUTER, h: 2 * PITCH_Y + ROUTER };
  g.save();
  shield(g, e, s);
  g.beginPath();
  links();
  glow(g, PAL.neon, 0.6, LINE.hud);
  silhouette(g, s, routers);
  cracks(g, e, s);
  g.beginPath();
  dots();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  telegraph(g, s, s.attack === 'jam' ? links : routers);
  flash(g, s, routers);
  g.restore();
};

// ---- hologram ------------------------------------------------------------------------------------------------------

/** The chip: a dashed outline 420 x 200 px, with a solid core 180 x 90 px in its middle. */
const CHIP_W = 420, CHIP_H = 200, CHIP_R = 12;
const CORE_W = 180, CORE_H = 90, CORE_CR = 8;
/** Four ports on the chip's top edge, 100 px apart, each with a 14 px pin above it. */
const PORTS = 4, PORT_STEP = 100, PIN = 14, PORT_R = 5;

/** The four port points on the chip's top edge, left to right, round a centre point. The predict attack fires from
 *  these points, and its telegraph lines start here. */
export function hologramPorts(cx: number, cy: number): Pt[] {
  return Array.from({ length: PORTS }, (_, k) => ({
    x: cx + (k - (PORTS - 1) / 2) * PORT_STEP,
    y: cy - CHIP_H / 2,
  }));
}

/** The hologram: a dashed outline of the chip with four pins on its top edge, and a solid core in its middle. The
 *  bolts attack glows the core as it telegraphs; the predict attack glows the ports. */
export const hologram: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: CHIP_W, h: CHIP_H };
  const outline = () => rrect(g, cx - CHIP_W / 2, cy - CHIP_H / 2, CHIP_W, CHIP_H, CHIP_R);
  const core = () => rrect(g, cx - CORE_W / 2, cy - CORE_H / 2, CORE_W, CORE_H, CORE_CR);
  const ports = hologramPorts(cx, cy);
  const pins = () => { for (const p of ports) { g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - PIN); } };
  const portDots = () => { for (const p of ports) circle(g, p.x, p.y, PORT_R); };
  g.save();
  shield(g, e, s);
  g.beginPath();
  outline();
  g.setLineDash([10, 8]);
  glow(g, PAL.neon, 0.8, LINE.hud);
  g.setLineDash([]);
  silhouette(g, s, core);
  cracks(g, e, s);
  g.beginPath();
  pins();
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  portDots();
  g.stroke();
  telegraph(g, s, s.attack === 'predict' ? portDots : core);
  flash(g, s, core);
  g.restore();
};

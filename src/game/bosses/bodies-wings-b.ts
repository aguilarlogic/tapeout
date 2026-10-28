// The wing boss bodies, part B (Phase 8 Spec, section 5): the wafer, the package and the server rack. They keep the act 1
// to 4 look (magenta line art with a glow, a PAL.fill inside, amber for the part that is about to attack, cracks for
// damage, a white flash on a hit, a dashed shield ring) and draw inside the arena's boss rect. `packageBody` is named so
// because `package` is a reserved word.
import { LINE, PAL } from '../render/palette';
import { HZ } from '../tuning';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

// ---- wafer ---------------------------------------------------------------------------------------------------------

/** The wafer is a disc 240 px across with a notch in its lower edge. It holds a 7 by 7 grid of die squares (22 px, on a
 *  26 px pitch), and only the squares inside the disc show. The grid turns 0.2 rad a second. */
const WAFER_R = 120, NOTCH_R = 8, DIE = 22, PITCH = 26, DIES_N = 7, SPIN = 0.2;

/** The wafer: a disc of die squares, slowly turning, with a notch. The dies attack glows the disc as it telegraphs. */
export const wafer: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: 2 * WAFER_R, h: 2 * WAFER_R };
  const disc = () => { circle(g, cx, cy, WAFER_R); };
  const turn = (s.t / HZ) * SPIN;
  const dies = () => {
    for (let i = 0; i < DIES_N; i++) {
      for (let j = 0; j < DIES_N; j++) {
        const ox = (i - (DIES_N - 1) / 2) * PITCH, oy = (j - (DIES_N - 1) / 2) * PITCH;
        if (Math.hypot(ox, oy) > WAFER_R - 14) continue;
        const dx = ox * Math.cos(turn) - oy * Math.sin(turn), dy = ox * Math.sin(turn) + oy * Math.cos(turn);
        g.save();
        g.translate(cx + dx, cy + dy);
        g.rotate(turn);
        g.rect(-DIE / 2, -DIE / 2, DIE, DIE);
        g.restore();
      }
    }
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, disc);
  cracks(g, e, s);
  g.beginPath();
  dies();
  glow(g, PAL.trace, 0.7, LINE.hud);
  g.beginPath();
  circle(g, cx, cy + WAFER_R, NOTCH_R);
  g.fillStyle = PAL.bgDeep;
  g.fill();
  glow(g, PAL.neon, 0.8, LINE.hud);
  telegraph(g, s, disc);
  flash(g, s, disc);
  g.restore();
};

// ---- package -------------------------------------------------------------------------------------------------------

/** The package is a square 150 px across, with 7 by 2 balls under it on a 16 px pitch. A crack runs across it, from the
 *  top left corner to the lower right. The cracks attack glows that crack as it telegraphs. */
const PKG = 150, PKG_R = 10, PKG_DROP = 22, BALL_R = 6, BALL_PITCH = 16, BALLS_X = 7, BALLS_Y = 2;
/** The crack as unit points inside the package, from its top left to its lower right. */
const CRACK_PTS: [number, number][] = [[-0.7, -0.8], [-0.3, -0.35], [-0.4, 0.05], [0.1, 0.3], [0.0, 0.6], [0.6, 0.85]];

/** The package: a square on a ball grid, with a crack across it. The cracks attack glows the crack as it telegraphs. */
export const packageBody: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const pcy = cy - PKG_DROP, half = PKG / 2;
  const e: Ext = { cx, cy: cy - 6, w: PKG, h: PKG + 2 * BALL_PITCH + 2 * BALL_R };
  const pkg = () => { rrect(g, cx - half, pcy - half, PKG, PKG, PKG_R); };
  const crack = () => {
    CRACK_PTS.forEach(([u, v], i) => {
      const x = cx + u * half, y = pcy + v * half;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
  };
  const balls = () => {
    for (let j = 0; j < BALLS_Y; j++) {
      for (let i = 0; i < BALLS_X; i++) {
        circle(g, cx + (i - (BALLS_X - 1) / 2) * BALL_PITCH, pcy + half + 10 + j * BALL_PITCH, BALL_R);
      }
    }
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, pkg);
  cracks(g, e, s);
  g.beginPath();
  crack();
  glow(g, PAL.idle, 0.8, LINE.hud);
  g.beginPath();
  balls();
  glow(g, PAL.trace, 0.8, LINE.hud);
  telegraph(g, s, s.attack === 'cracks' ? crack : pkg);
  flash(g, s, pkg);
  g.restore();
};

// ---- server --------------------------------------------------------------------------------------------------------

/** The rack: four blades, 280 by 44 px, 10 px apart, in a frame 300 px wide. Blade 2 (the second from the top) has a
 *  clock face, frozen at ten past ten. The hang attack glows that clock as it telegraphs. */
const RACK_W = 300, PAD = 8, BLADE_W = 280, BLADE_H = 44, BLADE_GAP = 10, BLADES = 4, FROZEN = 1, CLOCK_R = 16;
const FRAME_H = BLADES * BLADE_H + (BLADES - 1) * BLADE_GAP + 2 * PAD;

/** The server: a rack of four blades with LEDs and vents, one of them with a frozen clock face. */
export const server: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const top = cy - FRAME_H / 2, left = cx - BLADE_W / 2;
  const e: Ext = { cx, cy, w: RACK_W, h: FRAME_H };
  const frame = () => { rrect(g, cx - RACK_W / 2, top, RACK_W, FRAME_H, 12); };
  const blade = (k: number) => ({ x: left, y: top + PAD + k * (BLADE_H + BLADE_GAP) });
  const blades = () => {
    for (let k = 0; k < BLADES; k++) { const b = blade(k); rrect(g, b.x, b.y, BLADE_W, BLADE_H, 6); }
  };
  const leds = () => {
    for (let k = 0; k < BLADES; k++) {
      const b = blade(k);
      for (let i = 0; i < 3; i++) circle(g, b.x + 16 + i * 14, b.y + BLADE_H / 2, 3);
    }
  };
  const vents = () => {
    for (let k = 0; k < BLADES; k++) {
      const b = blade(k);
      for (let i = 0; i < 3; i++) {
        const y = b.y + 14 + i * 8;
        g.moveTo(b.x + 180, y);
        g.lineTo(b.x + 260, y);
      }
    }
  };
  const face = () => {
    const b = blade(FROZEN), fx = b.x + 240, fy = b.y + BLADE_H / 2;
    circle(g, fx, fy, CLOCK_R);
    g.moveTo(fx, fy);
    g.lineTo(fx + 7 * Math.cos(Math.PI * 7 / 6), fy + 7 * Math.sin(Math.PI * 7 / 6));
    g.moveTo(fx, fy);
    g.lineTo(fx + 11 * Math.cos(-Math.PI / 6), fy + 11 * Math.sin(-Math.PI / 6));
  };
  g.save();
  shield(g, e, s);
  silhouette(g, s, frame);
  cracks(g, e, s);
  g.beginPath();
  blades();
  glow(g, PAL.neon, 0.6, LINE.hud);
  g.beginPath();
  leds();
  glow(g, PAL.trace, 0.9, LINE.hud);
  g.beginPath();
  vents();
  glow(g, PAL.idle, 0.8, LINE.hud);
  g.beginPath();
  face();
  glow(g, PAL.line, 0.9, LINE.hud);
  telegraph(g, s, s.attack === 'hang' ? face : frame);
  flash(g, s, frame);
  g.restore();
};

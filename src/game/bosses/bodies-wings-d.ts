// The Phase 8 wing boss bodies, part D (Phase 8 Spec, section 5): the optical engine with eight numbered channels, the qubit
// sphere with its drifting state arrow, and the golem connector with four pin teeth. They keep the act 1 to 3 look (magenta
// line art with a glow, a PAL.fill inside, amber for the part about to attack, cracks for damage, a white flash on a hit, a
// dashed shield ring) and draw inside the arena's boss rect. The qubit's ball is exported, so the phase attack draws its two
// ghost copies with the same drawing.
import { FONT, LINE, PAL, rgba, type PalKey } from '../render/palette';
import { HZ } from '../tuning';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { C, Ext } from './bodies';
import type { BodyDrawer } from './types';

// ---- optical -------------------------------------------------------------------------------------------------------

/** The engine: a 170 x 130 px block, 230 px left of the box centre, with a lens in its middle. Eight channels leave its
 *  right side, 16 px apart, and end 200 px right of the centre. Each has its number 216 px right of the centre. */
const ENG_W = 170, ENG_H = 130, ENG_R = 14, LENS_R = 24;
const CHANNELS = 8, CH_GAP = 16, CH_X1 = 200, CH_LABEL = 216;
/** One palette key per channel, read from PAL at draw time. Each line also carries its number, so the state is not just colour. */
const CH_COLOURS: readonly PalKey[] = ['trace', 'ok', 'gold', 'amber', 'neon', 'x', 'line', 'text'];

/** The optical engine: a long block with a lens, and eight numbered channel lines out of its right side. The flare attack
 *  glows the channels as they telegraph; the other attacks glow the block. */
export const optical: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const x0 = cx - 230, x1 = cx - 60, top = cy - ENG_H / 2;
  const chY = (k: number) => cy + (k - (CHANNELS - 1) / 2) * CH_GAP;
  const block = () => rrect(g, x0, top, ENG_W, ENG_H, ENG_R);
  const lens = () => circle(g, (x0 + x1) / 2, cy, LENS_R);
  const lines = () => {
    for (let k = 0; k < CHANNELS; k++) {
      g.moveTo(x1, chY(k));
      g.lineTo(cx + CH_X1, chY(k));
    }
  };
  const e: Ext = { cx: cx - 15, cy, w: 430, h: ENG_H };
  g.save();
  shield(g, e, s);
  silhouette(g, s, block);
  cracks(g, e, s);
  g.beginPath();
  lens();
  glow(g, PAL.trace, 0.6, LINE.hud);
  for (let k = 0; k < CHANNELS; k++) {
    g.beginPath();
    g.moveTo(x1, chY(k));
    g.lineTo(cx + CH_X1, chY(k));
    glow(g, PAL[CH_COLOURS[k]], 1, LINE.world);
  }
  g.font = `12px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < CHANNELS; k++) {
    g.fillStyle = PAL[CH_COLOURS[k]];
    g.fillText(String(k + 1), cx + CH_LABEL, chY(k));
  }
  telegraph(g, s, s.attack === 'flare' ? lines : block);
  flash(g, s, block);
  g.restore();
};

// ---- qubit ---------------------------------------------------------------------------------------------------------

/** The sphere's radius. Its state arrow is 70% of that long, and swings 0.6 rad either side of 45 degrees on a 4 s cycle,
 *  so it drifts rather than spins. */
export const QUBIT_R = 70;
const ARROW_LEN = 0.7, ARROW_SWING = 0.6, ARROW_CYCLE = 4;

/** The state arrow's angle at step t. */
function arrowAngle(t: number): number {
  return -Math.PI / 4 + ARROW_SWING * Math.sin((t / HZ) * ((2 * Math.PI) / ARROW_CYCLE));
}

/** The inside of the sphere: an equator and a meridian, and the state arrow at step t. */
function inside(g: C, cx: number, cy: number, r: number, t: number) {
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2);
  g.ellipse(cx, cy, r * 0.3, r, 0, 0, Math.PI * 2);
  g.strokeStyle = rgba(PAL.neon, 0.5);
  g.lineWidth = LINE.hud;
  g.stroke();
  const a = arrowAngle(t), L = r * ARROW_LEN;
  const tx = cx + L * Math.cos(a), ty = cy + L * Math.sin(a);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(tx, ty);
  for (const side of [-1, 1]) {
    const b = a + Math.PI + side * 0.45;
    g.moveTo(tx, ty);
    g.lineTo(tx + 9 * Math.cos(b), ty + 9 * Math.sin(b));
  }
  glow(g, PAL.trace, 1, LINE.enemy);
  g.restore();
}

/** A qubit's ball on its own: a PAL.fill disc with a neon outline, and its inside at step t. The phase attack draws its two
 *  ghost copies with this. */
export function qubitBall(g: C, cx: number, cy: number, r: number, t: number) {
  g.save();
  g.beginPath();
  circle(g, cx, cy, r);
  g.fillStyle = PAL.fill;
  g.fill();
  glow(g, PAL.neon);
  inside(g, cx, cy, r, t);
  g.restore();
}

/** The qubit: a sphere with an equator, a meridian and a state arrow that drifts. The phase attack glows the ball as it
 *  telegraphs. */
export const qubit: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const e: Ext = { cx, cy, w: 2 * QUBIT_R, h: 2 * QUBIT_R };
  const ball = () => circle(g, cx, cy, QUBIT_R);
  g.save();
  shield(g, e, s);
  silhouette(g, s, ball);
  inside(g, cx, cy, QUBIT_R, s.t);
  cracks(g, e, s);
  telegraph(g, s, ball);
  flash(g, s, ball);
  g.restore();
};

// ---- golem ---------------------------------------------------------------------------------------------------------

/** The golem: a 300 x 170 px connector body with a socket in its face, and four pin teeth under it. Each tooth is 22 px
 *  wide and 26 px long, and they sit 62 px apart. */
const G_W = 300, G_H = 170, G_R = 18, TEETH = 4, TOOTH_W = 22, TOOTH_H = 26, TOOTH_GAP = 62;
const SOCK_W = 120, SOCK_H = 44, SOCK_DY = -14;

/** The golem: a hulking connector body with a socket in its face and four pin teeth under it. The zap attack glows the
 *  teeth as it telegraphs; the other attacks glow the body. */
export const golem: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const top = cy - G_H / 2, bot = cy + G_H / 2;
  const body = () => rrect(g, cx - G_W / 2, top, G_W, G_H, G_R);
  const teeth = () => {
    for (let k = 0; k < TEETH; k++) g.rect(cx + (k - (TEETH - 1) / 2) * TOOTH_GAP - TOOTH_W / 2, bot - 4, TOOTH_W, TOOTH_H);
  };
  const outline = () => { body(); teeth(); };
  const socket = () => rrect(g, cx - SOCK_W / 2, cy + SOCK_DY - SOCK_H / 2, SOCK_W, SOCK_H, 6);
  const e: Ext = { cx, cy: cy + (TOOTH_H - 4) / 2, w: G_W, h: G_H + TOOTH_H - 4 };
  g.save();
  shield(g, e, s);
  silhouette(g, s, outline);
  cracks(g, e, s);
  g.beginPath();
  socket();
  g.fillStyle = PAL.bgDeep;
  g.fill();
  glow(g, PAL.trace, 0.6, LINE.hud);
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('USB', cx, cy + SOCK_DY);
  telegraph(g, s, s.attack === 'zap' ? teeth : body);
  flash(g, s, outline);
  g.restore();
};

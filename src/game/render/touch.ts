// Phase 9 Spec, section 4: the on-screen touch controls' drawing. The floating move stick (a ring and a knob) and each
// button as a circle with a line-art icon and its label under the icon. Idle buttons are a thin trace line; held ones
// get a fill and an additive glow pass, as render/hall.ts does. Everything is multiplied by the fade alpha.
import type { TouchButton } from '../input/touch';
import { HZ } from '../tuning';
import { FONT, LINE, PAL, px, rgba } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** The floating stick's ring radius, view px. */
const STICK_R = 70;
/** The knob's radius, view px. */
const KNOB_R = 26;
/** Stroke alpha of an idle control, and of a held button. */
const IDLE_STROKE = 0.55, HELD_STROKE = 0.95;
/** Fill alpha of the knob and of a held button. */
const HELD_FILL = 0.15;
/** Width of the additive glow stroke round a held button, px, and its pulse: alpha between these two values. */
const GLOW_W = 8;
const GLOW_LO = 0.25, GLOW_HI = 0.45;
/** Speed of the glow pulse, radians per sim step: one cycle in about 1.6 s. */
const GLOW_SPEED = (2 * Math.PI) / (1.6 * HZ);
/** The icon's half-size as a share of the button radius, and its centre's and the label's offsets (share of the radius). */
const ICON_SIZE = 0.32, ICON_DY = -0.28, LABEL_DY = 0.42;
/** Label size, px. */
const LABEL_PX = 11;

/** What the touch controls show. `t` is the sim time in steps. `alpha` is the 0..1 fade, multiplied into everything. */
export interface TouchDraw {
  buttons: readonly TouchButton[];
  held: ReadonlySet<string>;
  stick: { ox: number; oy: number; kx: number; ky: number } | null;
  /** The stick's own fade, 0..1 (it eases in when a thumb lands and out over 150 ms when it lifts); 1 when left out. */
  stickAlpha?: number;
  alpha: number;
  t: number;
}

/** An icon: draws line art centred on (x, y), with half-size s. */
type Icon = (c: C, x: number, y: number, s: number) => void;

/** A circle path of radius r centred on (x, y). */
function disc(c: C, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}

/** An arrowhead with its tip at (x, y), pointing along the unit vector (dx, dy). Two short wings, s / 2 long. */
function head(c: C, x: number, y: number, dx: number, dy: number, s: number) {
  const back = Math.atan2(-dy, -dx), L = s * 0.5;
  for (const side of [-1, 1]) {
    const a = back + side * 0.7;
    c.moveTo(x, y);
    c.lineTo(x + L * Math.cos(a), y + L * Math.sin(a));
  }
}

/** DASH: a double chevron pointing right. */
const dash: Icon = (c, x, y, s) => {
  c.beginPath();
  for (const dx of [-s * 0.4, s * 0.4]) {
    c.moveTo(x + dx - s * 0.4, y - s * 0.8);
    c.lineTo(x + dx + s * 0.4, y);
    c.lineTo(x + dx - s * 0.4, y + s * 0.8);
  }
  c.stroke();
};

/** USE: a square bracket on each side of a dot. */
const use: Icon = (c, x, y, s) => {
  c.beginPath();
  c.moveTo(x - s * 0.5, y - s); c.lineTo(x - s, y - s); c.lineTo(x - s, y + s); c.lineTo(x - s * 0.5, y + s);
  c.moveTo(x + s * 0.5, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y + s); c.lineTo(x + s * 0.5, y + s);
  c.moveTo(x + s * 0.3, y);
  c.arc(x, y, s * 0.3, 0, TAU);
  c.stroke();
};

/** SWAP: two curved arrows, one over the other, turning in opposite directions. */
const swap: Icon = (c, x, y, s) => {
  const a0 = Math.PI * 1.1, a1 = Math.PI * 1.9, b0 = Math.PI * 0.1, b1 = Math.PI * 0.9;
  c.beginPath();
  c.arc(x, y, s, a0, a1);
  // the arrowhead at the end of the top arc, pointing along the clockwise tangent
  head(c, x + s * Math.cos(a1), y + s * Math.sin(a1), -Math.sin(a1), Math.cos(a1), s);
  c.moveTo(x + s * Math.cos(b0), y + s * Math.sin(b0));
  c.arc(x, y, s, b0, b1);
  head(c, x + s * Math.cos(b1), y + s * Math.sin(b1), -Math.sin(b1), Math.cos(b1), s);
  c.stroke();
};

/** PAUSE: two bars. */
const pause: Icon = (c, x, y, s) => {
  c.beginPath();
  c.rect(x - s * 0.7, y - s, s * 0.45, s * 2);
  c.rect(x + s * 0.25, y - s, s * 0.45, s * 2);
  c.stroke();
};

/** NOTES: three lines of text, the last one short. */
const notes: Icon = (c, x, y, s) => {
  c.beginPath();
  c.moveTo(x - s, y - s * 0.8); c.lineTo(x + s, y - s * 0.8);
  c.moveTo(x - s, y); c.lineTo(x + s, y);
  c.moveTo(x - s, y + s * 0.8); c.lineTo(x, y + s * 0.8);
  c.stroke();
};

/** GADGET: a small cube, its outline and the three inner edges that meet in the middle. */
const gadget: Icon = (c, x, y, s) => {
  const h = s * 0.5;
  c.beginPath();
  c.moveTo(x, y - s); c.lineTo(x + s, y - h); c.lineTo(x + s, y + h); c.lineTo(x, y + s); c.lineTo(x - s, y + h); c.lineTo(x - s, y - h);
  c.closePath();
  c.moveTo(x - s, y - h); c.lineTo(x, y); c.lineTo(x + s, y - h);
  c.moveTo(x, y); c.lineTo(x, y + s);
  c.stroke();
};

/** SCAN: a radar: two arcs over a dot. */
const scan: Icon = (c, x, y, s) => {
  const cy = y + s * 0.4, a0 = Math.PI * 1.2, a1 = Math.PI * 1.8, r = s * 0.5;
  c.beginPath();
  c.arc(x, cy, s, a0, a1);
  c.moveTo(x + r * Math.cos(a0), cy + r * Math.sin(a0));
  c.arc(x, cy, r, a0, a1);
  c.moveTo(x + 2, cy);
  c.arc(x, cy, 2, 0, TAU);
  c.stroke();
};

/** REWIND: a counter-clockwise arrow, round most of a circle. */
const rewind: Icon = (c, x, y, s) => {
  const a = -Math.PI * 1.2;
  c.beginPath();
  c.arc(x, y, s, 0, a, true);
  // the tip at the end of the arc, pointing along the counter-clockwise tangent
  head(c, x + s * Math.cos(a), y + s * Math.sin(a), Math.sin(a), -Math.cos(a), s);
  c.stroke();
};

/** POCKET: an open box with an arrow going down into it. */
const pocket: Icon = (c, x, y, s) => {
  c.beginPath();
  c.moveTo(x - s, y - s * 0.2); c.lineTo(x - s, y + s); c.lineTo(x + s, y + s); c.lineTo(x + s, y - s * 0.2);
  c.moveTo(x, y - s); c.lineTo(x, y + s * 0.4);
  head(c, x, y + s * 0.4, 0, 1, s);
  c.stroke();
};

/** BEAM: a cone, its point at the left. */
const beam: Icon = (c, x, y, s) => {
  c.beginPath();
  c.moveTo(x - s, y); c.lineTo(x + s, y - s * 0.8); c.lineTo(x + s, y + s * 0.8);
  c.closePath();
  c.stroke();
};

/** NEXT: a right-pointing chevron. */
const next: Icon = (c, x, y, s) => {
  c.beginPath();
  c.moveTo(x - s * 0.5, y - s); c.lineTo(x + s * 0.5, y); c.lineTo(x - s * 0.5, y + s);
  c.stroke();
};

/** The icon for each button label (the layout ids are lower case). A button with a label not listed here draws its circle and label only. */
const ICONS = new Map<string, Icon>([
  ['DASH', dash], ['USE', use], ['SWAP', swap], ['PAUSE', pause], ['NOTES', notes], ['GADGET', gadget],
  ['SCAN', scan], ['REWIND', rewind], ['POCKET', pocket], ['BEAM', beam], ['NEXT', next],
]);

/** The floating stick: its ring at the origin and the knob at its own point. */
function drawStick(c: C, s: { ox: number; oy: number; kx: number; ky: number }) {
  c.save();
  c.strokeStyle = rgba(PAL.trace, IDLE_STROKE);
  c.lineWidth = LINE.hud;
  disc(c, s.ox, s.oy, STICK_R);
  c.stroke();
  c.fillStyle = rgba(PAL.trace, HELD_FILL);
  disc(c, s.kx, s.ky, KNOB_R);
  c.fill();
  c.stroke();
  c.restore();
}

/** One button: a circle (filled and glowing while held), its icon, and its label under the icon. */
function drawButton(c: C, b: TouchButton, held: boolean, t: number) {
  const r = b.r;
  c.save();
  if (held) {
    c.fillStyle = rgba(PAL.trace, HELD_FILL);
    disc(c, b.x, b.y, r);
    c.fill();
    // the glow pass: an additive stroke round the rim
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.trace, GLOW_LO + (GLOW_HI - GLOW_LO) * (0.5 + 0.5 * Math.sin(t * GLOW_SPEED)));
    c.lineWidth = GLOW_W;
    disc(c, b.x, b.y, r);
    c.stroke();
    c.restore();
  }
  c.strokeStyle = rgba(PAL.trace, held ? HELD_STROKE : IDLE_STROKE);
  c.lineWidth = LINE.hud;
  disc(c, b.x, b.y, r);
  c.stroke();
  ICONS.get(b.label)?.(c, b.x, b.y + r * ICON_DY, r * ICON_SIZE);
  c.font = `${px(LABEL_PX)}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = rgba(PAL.text, 0.9);
  c.fillText(b.label, b.x, b.y + r * LABEL_DY);
  c.restore();
}

/** Draws the touch controls in view px: the floating stick when it is down, then each button. Held buttons are filled
 * and glow. Nothing is drawn at alpha 0. Everything fades with `alpha`, so the 150 ms ease is the caller's number. */
export function drawTouch(c: C, d: TouchDraw): void {
  const alpha = Math.min(1, Math.max(0, d.alpha));
  if (!(alpha > 0)) return;
  c.save();
  c.globalAlpha = alpha;
  const sa = Math.min(1, Math.max(0, d.stickAlpha ?? 1));
  if (d.stick && sa > 0) { c.globalAlpha = alpha * sa; drawStick(c, d.stick); c.globalAlpha = alpha; }
  for (const b of d.buttons) drawButton(c, b, d.held.has(b.id), d.t);
  c.restore();
}

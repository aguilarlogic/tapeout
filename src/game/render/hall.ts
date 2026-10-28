// Phase 8 Spec, section 4 and section 3 item 7: the Hiring Hall's drawing. A hiring panel (a tall glass panel with its
// role's icon: dim with a padlock while the role is not ready, a gold check once passed, a slow glow while it is open),
// the role badges on the drone's back plate, and the carpet of the office floor. Line art with an additive glow pass,
// as render/act4.ts does. The glow pulse changes alpha only, never moves, so it stays on under reduced motion.
import { HZ } from '../tuning';
import { FONT, LINE, PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;

/** Panel size, px: 70 wide and 150 tall, standing on the floor. */
const PANEL_W = 70, PANEL_H = 150;
/** Corner chamfer of the panel, px. */
const CHAMFER = 10;
/** Alpha of a locked panel (not open, no record). */
const DIM_ALPHA = 0.4;
/** Width of the additive glow stroke round a panel, px. */
const GLOW_W = 8;
/** Alpha of a passed panel's steady glow. */
const PASSED_GLOW = 0.35;
/** The open panel's glow pulse: alpha between these two values. */
const PULSE_LO = 0.2, PULSE_HI = 0.45;
/** Speed of the pulse, radians per sim step. At 60 steps a second one cycle takes about 2.6 s. */
const PULSE_SPEED = (2 * Math.PI) / (2.6 * HZ);
/** Height of the lock or check above the panel's top, px: the middle of the top third. */
const SYMBOL_DY = 30;
/** Role badges: a chevron is 6 px wide and high, with 4 px between two chevrons. At most 8 are drawn, then "+k". */
// small rank stripes: the hull is only 34 px wide, so four fit along its top edge (Phase 8 self-review)
const CHEV = 5, CHEV_GAP = 1, BADGE_MAX = 4;
/** Carpet: three seam lines, 4 px apart, under the floor's top line, at a low alpha. */
const CARPET_LINES = 3, CARPET_STEP = 4, CARPET_ALPHA = 0.12;

/** What a hiring panel shows. `t` is the sim time in steps, as every draw call takes. */
export interface HiringPanelProps {
  /** The role's icon text, drawn big in the middle. */
  icon: string;
  /** The role's name; drawn in caps under the icon. */
  name: string;
  /** The panel opens its module (the role is ready, or there is a record). */
  open: boolean;
  /** The role has a record: a gold check. A passed panel is always open. */
  passed: boolean;
  t: number;
}

/** A padlock in lines, centred on (x, y): a body with a shackle over it and a keyhole. */
function padlock(c: C, x: number, y: number) {
  c.beginPath();
  c.rect(x - 6, y - 2, 12, 10);
  c.moveTo(x + 4, y - 2);
  c.arc(x, y - 2, 4, 0, Math.PI, true);
  c.moveTo(x + 1.5, y + 3);
  c.arc(x, y + 3, 1.5, 0, Math.PI * 2);
  c.stroke();
}

/** A gold check mark centred on (x, y). */
function check(c: C, x: number, y: number) {
  c.beginPath();
  c.moveTo(x - 7, y);
  c.lineTo(x - 2, y + 5);
  c.lineTo(x + 7, y - 6);
  c.stroke();
}

/** A hiring panel standing on the floor, centred on x, with its feet at floorY. A locked panel (not open, no record) is
 * dim with a padlock. A passed panel is gold with a check. An open one that has not passed glows and pulses slowly. */
export function drawHiringPanel(c: C, x: number, floorY: number, p: HiringPanelProps): void {
  const L = x - PANEL_W / 2, R = x + PANEL_W / 2, T = floorY - PANEL_H, B = floorY, k = CHAMFER;
  const locked = !p.open && !p.passed;
  const col = p.passed ? PAL.gold : PAL.trace;
  const outline = () => {
    c.beginPath();
    c.moveTo(L + k, T); c.lineTo(R - k, T); c.lineTo(R, T + k); c.lineTo(R, B); c.lineTo(L, B); c.lineTo(L, T + k);
    c.closePath();
  };
  c.save();
  if (locked) c.globalAlpha = DIM_ALPHA;
  // the additive glow pass: steady gold when passed, a slow pulse when open, none when locked
  if (p.passed || p.open) {
    const a = p.passed ? PASSED_GLOW : PULSE_LO + (PULSE_HI - PULSE_LO) * (0.5 + 0.5 * Math.sin(p.t * PULSE_SPEED));
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(col, a);
    c.lineWidth = GLOW_W;
    outline();
    c.stroke();
    c.restore();
  }
  // the glass: a dark fill, the chamfered outline and two short glare lines
  c.fillStyle = PAL.fill;
  outline();
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = LINE.world;
  outline();
  c.stroke();
  c.strokeStyle = rgba(PAL.line, 0.25);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(R - 12, T + 22); c.lineTo(R - 22, T + 32);
  c.moveTo(R - 12, T + 34); c.lineTo(R - 16, T + 38);
  c.stroke();
  // the symbol above the icon: a lock while locked, a check once passed
  c.strokeStyle = locked ? PAL.text : PAL.gold;
  c.lineWidth = LINE.world;
  if (locked) padlock(c, x, T + SYMBOL_DY);
  if (p.passed) check(c, x, T + SYMBOL_DY);
  // the icon, big in the middle; the label and the role name in small caps under it
  c.fillStyle = PAL.text;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `26px ${FONT}`;
  c.fillText(p.icon, x, floorY - 80, PANEL_W - 12);
  c.font = `9px ${FONT}`;
  c.fillStyle = rgba(PAL.text, 0.85);
  c.fillText('HIRING PANEL', x, floorY - 44, PANEL_W - 8);
  c.fillText(p.name.toUpperCase(), x, floorY - 30, PANEL_W - 8);
  c.restore();
}

/** Role badges on the drone's back plate: a row of chevrons, centred on the plate at (x, y) and running away from the
 * facing direction (so they trail behind the drone). At most 4 are drawn; any more show as "+k". */
export function drawBadges(c: C, x: number, y: number, n: number, facing: 1 | -1): void {
  const count = Math.max(0, Math.floor(n));
  const shown = Math.min(count, BADGE_MAX);
  if (shown === 0) return;
  const step = CHEV + CHEV_GAP;
  c.save();
  c.strokeStyle = PAL.gold;
  c.lineWidth = LINE.hud;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < shown; i++) {
    const cx = x - facing * i * step;
    // each chevron points the way the drone faces
    c.moveTo(cx - (facing * CHEV) / 2, y - CHEV / 2);
    c.lineTo(cx + (facing * CHEV) / 2, y);
    c.lineTo(cx - (facing * CHEV) / 2, y + CHEV / 2);
  }
  c.stroke();
  if (count > BADGE_MAX) {
    c.fillStyle = rgba(PAL.text, 0.85);
    c.font = `9px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`+${count - BADGE_MAX}`, x - facing * (shown * step + 6), y);
  }
  c.restore();
}

/** The office carpet: three thin parallel seam lines along the floor, under its top line from x0 to x1. */
export function drawOfficeFloor(c: C, x0: number, x1: number, floorY: number): void {
  c.save();
  c.strokeStyle = rgba(PAL.line, CARPET_ALPHA);
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i <= CARPET_LINES; i++) {
    const y = floorY + i * CARPET_STEP;
    c.moveTo(x0, y);
    c.lineTo(x1, y);
  }
  c.stroke();
  c.restore();
}

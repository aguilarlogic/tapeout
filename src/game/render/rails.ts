// The bus rail (Phase 4 Spec, sections 7 and 8): a straight double-line rail with chamfered end caps. Powered, bright
// dots flow from its first end to its second at 120 px/s, and a rider can sit on it as a clip glow. Unpowered it is
// dimmer and still. Colours and widths come only from PAL and LINE. Times are sim steps (the `t` every draw call
// takes), so the dots move at the same rate whatever the frame rate.
import { HZ } from '../tuning';
import { LINE, PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;

/** A straight rail from (x1, y1) to (x2, y2), in world px. */
export interface Rail { x1: number; y1: number; x2: number; y2: number }

/** Half the distance between the two lines of the double rail, px. */
const HALF_GAP = 3;
/** Flow speed of the powered dots, px per second. */
const FLOW = 120;
/** Spacing of the powered dots along the rail, px. */
const DOT_GAP = 40;
/** Radius of a flowing dot's bright core, px. */
const DOT_R = 2.5;
/** Radius of the rider's clip glow, px. */
const RIDER_R = 9;
/** Half the cap's length along the rail, px. */
const CAP_HALF_LEN = 4;
/** Half the cap's height across the rail, px. */
const CAP_HALF_W = 7;
/** Corner chamfer on the caps, px. */
const CAP_CHAMFER = 2;
/** Alpha of the rail lines while powered. */
const ON_ALPHA = 0.85;
/** Alpha of the rail lines while unpowered (dimmer). */
const OFF_ALPHA = 0.3;

/** The y on the rail at x, along the straight line. Outside the rail it gives the nearer end; a vertical rail gives its
 * first end. */
export function railAt(rail: Rail, x: number): number {
  const dx = rail.x2 - rail.x1;
  if (dx === 0) return rail.y1;
  const k = Math.max(0, Math.min(1, (x - rail.x1) / dx));
  return rail.y1 + (rail.y2 - rail.y1) * k;
}

/** Draw one rail: two lines, an end cap at each end, and while powered the flowing dots. `t` is the sim time in steps.
 * `rider` (0 to 1, optional) puts a bright clip glow that far along the rail. */
export function drawRail(c: C, rail: Rail, t: number, powered: boolean, rider?: number): void {
  const dx = rail.x2 - rail.x1, dy = rail.y2 - rail.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy * HALF_GAP, ny = ux * HALF_GAP;
  const ends = [{ x: rail.x1, y: rail.y1 }, { x: rail.x2, y: rail.y2 }];

  c.save();
  // the double line
  c.lineCap = 'butt';
  c.lineWidth = LINE.trace;
  c.strokeStyle = rgba(PAL.trace, powered ? ON_ALPHA : OFF_ALPHA);
  c.beginPath();
  c.moveTo(rail.x1 + nx, rail.y1 + ny);
  c.lineTo(rail.x2 + nx, rail.y2 + ny);
  c.moveTo(rail.x1 - nx, rail.y1 - ny);
  c.lineTo(rail.x2 - nx, rail.y2 - ny);
  c.stroke();

  // end caps: small chamfered blocks across the rail, centred on each end
  for (const e of ends) {
    c.save();
    c.translate(e.x, e.y);
    c.rotate(Math.atan2(dy, dx));
    const a = CAP_HALF_LEN, b = CAP_HALF_W, k = CAP_CHAMFER;
    c.beginPath();
    c.moveTo(-a + k, -b);
    c.lineTo(a - k, -b);
    c.lineTo(a, -b + k);
    c.lineTo(a, b - k);
    c.lineTo(a - k, b);
    c.lineTo(-a + k, b);
    c.lineTo(-a, b - k);
    c.lineTo(-a, -b + k);
    c.closePath();
    c.fillStyle = PAL.fill;
    c.fill();
    c.strokeStyle = rgba(PAL.trace, powered ? 0.9 : 0.4);
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  // flowing dots, 40 px apart, moving at 120 px/s, with a soft glow (powered only)
  if (powered) {
    const offset = ((t / HZ) * FLOW) % DOT_GAP;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.shadowColor = rgba(PAL.trace, 0.9);
    c.shadowBlur = LINE.traceGlow;
    c.fillStyle = PAL.text;
    for (let d = offset; d <= len; d += DOT_GAP) {
      c.beginPath();
      c.arc(rail.x1 + ux * d, rail.y1 + uy * d, DOT_R, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // the rider's clip glow, a halo with a bright centre
  if (rider !== undefined) {
    const k = Math.max(0, Math.min(1, rider));
    const x = rail.x1 + dx * k, y = rail.y1 + dy * k;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(PAL.trace, 0.25);
    c.beginPath();
    c.arc(x, y, RIDER_R, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAL.text;
    c.beginPath();
    c.arc(x, y, DOT_R + 1, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.restore();
}

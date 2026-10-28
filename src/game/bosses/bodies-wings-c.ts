// The wing boss bodies, part C (Phase 8 Spec, section 5): the tester, the vault and the ecu. They keep the story's
// enemy look (magenta line art with a glow, a PAL.fill inside, amber for the part that is about to attack, cracks for
// damage, a white flash on a hit, a dashed shield ring) and draw inside the arena's boss rect. The probes attack glows
// the tester's needles, the leak attack glows the vault's keyhole, and the lockdown attack glows the ecu's lamp as they
// telegraph. The ecu's lamp is solid with a "!" while the shutters are down, and dashed with a "!" otherwise.
import type { Rect } from '../level/room';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import type { Pt } from './attacks';
import type { C } from './bodies';
import { centre, circle, cracks, flash, glow, rrect, shield, silhouette, telegraph } from './bodies';
import type { Ext } from './bodies';
import type { BodyDrawer } from './types';

// ---- tester --------------------------------------------------------------------------------------------------------

/** The head is 62% of the box wide and 30% tall, sitting high. Five needles hang from its underside, 46% of the box
 *  tall, each with a pointed tip. The needles glow as the probes attack telegraphs. */
const HEAD_W = 0.62, HEAD_H = 0.3, NEEDLES = 5, NEEDLE_LEN = 0.46, TIP = 8, TIP_HALF = 5;
const SCREW_R = 3, SCREW_IN = 14;

/** The head rect, centred on the box's middle and raised toward its top. */
function headRect(box: Rect, cx: number, cy: number): Rect {
  const w = box.w * HEAD_W, h = box.h * HEAD_H;
  return { x: cx - w / 2, y: cy - box.h * 0.36, w, h };
}

/** The x of each needle: evenly spaced under the head, with the outer two a sixth of its width in. */
const needleXs = (head: Rect): number[] =>
  Array.from({ length: NEEDLES }, (_, k) => head.x + (head.w * (k + 1)) / (NEEDLES + 1));

/** The needles as one path: a shaft and a pointed tip for each. */
function needles(g: C, head: Rect, box: Rect) {
  const base = head.y + head.h, tip = base + box.h * NEEDLE_LEN;
  for (const x of needleXs(head)) {
    g.moveTo(x, base);
    g.lineTo(x, tip - TIP);
    g.moveTo(x - TIP_HALF, tip - TIP);
    g.lineTo(x, tip);
    g.lineTo(x + TIP_HALF, tip - TIP);
  }
}

/** The tester: a probe head with five needles under it. Its needles glow as the probes attack telegraphs. */
export const tester: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const head = headRect(box, cx, cy);
  const e: Ext = { cx, cy, w: head.w, h: box.h * 0.8 };
  const top = () => { rrect(g, head.x, head.y, head.w, head.h, 12); };
  const pins = () => { needles(g, head, box); };
  const screws: Pt[] = [
    { x: head.x + SCREW_IN, y: head.y + SCREW_IN },
    { x: head.x + head.w - SCREW_IN, y: head.y + SCREW_IN },
    { x: head.x + SCREW_IN, y: head.y + head.h - SCREW_IN },
    { x: head.x + head.w - SCREW_IN, y: head.y + head.h - SCREW_IN },
  ];
  g.save();
  shield(g, e, s);
  silhouette(g, s, top);
  cracks(g, e, s);
  g.beginPath();
  for (const p of screws) circle(g, p.x, p.y, SCREW_R);
  g.strokeStyle = PAL.idle;
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  pins();
  glow(g, PAL.neon, 1, LINE.enemy);
  telegraph(g, s, s.attack === 'probes' ? pins : top);
  flash(g, s, top);
  g.restore();
};

// ---- vault ---------------------------------------------------------------------------------------------------------

/** The door is square, 80% of the box tall. Its dial ring sits at the middle and four bolts at its corners. */
const DOOR = 0.8, RING = 0.32, BOLT_AT = 0.42, BOLT_R = 4;

/** A key-shaped slot below the middle: a round bow over a shaft with two teeth on its right. */
function keyhole(g: C, cx: number, cy: number, side: number) {
  const bowY = cy - side * 0.1, u = side * 0.035;
  circle(g, cx, bowY, side * 0.09);
  g.rect(cx - u, bowY, 2 * u, side * 0.26);
  g.rect(cx + u, bowY + side * 0.16, side * 0.05, side * 0.05);
  g.rect(cx + u, bowY + side * 0.08, side * 0.05, side * 0.05);
}

/** The vault: a square door with a dial and a key-shaped slot. The slot glows as the leak attack telegraphs. */
export const vault: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const side = box.h * DOOR;
  const door = () => { rrect(g, cx - side / 2, cy - side / 2, side, side, 14); };
  const slot = () => { keyhole(g, cx, cy, side); };
  const e: Ext = { cx, cy, w: side, h: side };
  g.save();
  shield(g, e, s);
  silhouette(g, s, door);
  cracks(g, e, s);
  g.beginPath();
  circle(g, cx, cy, side * RING);
  g.setLineDash([5, 5]);
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) circle(g, cx + dx * side * BOLT_AT, cy + dy * side * BOLT_AT, BOLT_R);
  }
  g.strokeStyle = PAL.idle;
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  slot();
  g.fillStyle = PAL.bgDeep;
  g.fill();
  glow(g, PAL.neon, 1, LINE.hud);
  telegraph(g, s, s.attack === 'leak' ? slot : door);
  flash(g, s, door);
  g.restore();
};

// ---- ecu -----------------------------------------------------------------------------------------------------------

/** The control box is 70% of the box wide and tall. Its warning lamp is a disc 40% of the box tall, set just above the
 *  middle, with three vent lines below it. */
const ECU_W = 0.7, ECU_H = 0.7, LAMP = 0.4, VENTS = 3, VENT_GAP = 10, VENT_IN = 16;

/** The ecu: a car control box with a big warning lamp. The lamp is solid with a "!" while the lockdown shutters
 *  are down, and dashed with a "!" otherwise. It glows amber as the lockdown attack telegraphs. */
export const ecu: BodyDrawer = (g, box, s) => {
  const { cx, cy } = centre(box, s);
  const w = box.w * ECU_W, h = box.h * ECU_H;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const lampY = cy - h * 0.06, lampR = (box.h * LAMP) / 2;
  const body = () => { rrect(g, x0, y0, w, h, 16); };
  const lamp = () => { circle(g, cx, lampY, lampR); };
  const e: Ext = { cx, cy, w, h };
  const down = s.attack === 'lockdown' && s.telegraph <= 0;
  g.save();
  shield(g, e, s);
  silhouette(g, s, body);
  cracks(g, e, s);
  g.beginPath();
  for (let k = 0; k < VENTS; k++) {
    const y = y0 + h * 0.8 + k * VENT_GAP;
    g.moveTo(x0 + VENT_IN, y);
    g.lineTo(x0 + w - VENT_IN, y);
  }
  g.strokeStyle = rgba(PAL.idle, 0.9);
  g.lineWidth = LINE.hud;
  g.stroke();
  g.beginPath();
  lamp();
  g.fillStyle = down ? PAL.hostile : PAL.fill;
  g.fill();
  g.setLineDash(down ? [] : [6, 5]);
  g.strokeStyle = down ? PAL.hostile : PAL.idle;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.setLineDash([]);
  g.font = `${Math.round(lampR * 1.2)}px ${FONT}`;
  g.fillStyle = down ? PAL.bgDeep : PAL.idle;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', cx, lampY);
  telegraph(g, s, s.attack === 'lockdown' ? lamp : body);
  flash(g, s, body);
  g.restore();
};

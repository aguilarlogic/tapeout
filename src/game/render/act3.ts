// Act 3's drawing (Phase 6 Spec, sections 3 and 7): metal barriers, copper pads and the Trace Tether, Buffer Turrets,
// the Scan Visor's marks and the Power Gate's fade. Line art with an additive glow pass, like the rest of the world.
import type { Rect } from '../level/room';
import type { Sim } from '../sim';
import { LINE, PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** A metal barrier: a magenta block hatched on the diagonal, or, while a Via Phase dash is inside it, a dashed ghost. */
function barrier(c: C, r: Rect, present: boolean, t: number) {
  c.save();
  if (!present) {
    c.setLineDash([4, 4]);
    c.strokeStyle = rgba(PAL.neon, 0.45);
    c.lineWidth = 1.5;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    c.restore();
    return;
  }
  c.fillStyle = rgba(PAL.neon, 0.16);
  c.fillRect(r.x, r.y, r.w, r.h);
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  c.strokeStyle = rgba(PAL.neon, 0.6);
  c.lineWidth = 1.5;
  c.beginPath();
  for (let y = r.y - r.w; y < r.y + r.h; y += 12) { c.moveTo(r.x, y + r.w); c.lineTo(r.x + r.w, y); }
  c.stroke();
  c.restore();
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(PAL.neon, 0.25 + 0.08 * Math.sin(t * 0.05));
  c.lineWidth = LINE.enemyGlow * 0.6;
  c.strokeRect(r.x, r.y, r.w, r.h);
  c.restore();
  c.strokeStyle = PAL.neon;
  c.lineWidth = LINE.world;
  c.strokeRect(r.x, r.y, r.w, r.h);
}

/** A copper pad: an amber square with four pins; lit while the Trace Tether can reach for it. */
function pad(c: C, x: number, y: number, live: boolean, t: number) {
  const s = 14;
  c.save();
  if (live) {
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.amber, 0.3 + 0.1 * Math.sin(t * 0.08));
    c.lineWidth = 10;
    c.strokeRect(x - s, y - s, s * 2, s * 2);
    c.globalCompositeOperation = 'source-over';
  }
  c.fillStyle = PAL.fill;
  c.fillRect(x - s, y - s, s * 2, s * 2);
  c.strokeStyle = live ? PAL.amber : rgba(PAL.amber, 0.5);
  c.lineWidth = LINE.world;
  c.strokeRect(x - s, y - s, s * 2, s * 2);
  c.fillStyle = live ? PAL.amber : rgba(PAL.amber, 0.5);
  for (const [dx, dy] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { c.beginPath(); c.arc(x + dx, y + dy, 2, 0, TAU); c.fill(); }
  c.restore();
}

/** Under the drone: barriers, copper pads and turrets (world space). */
export function drawAct3Back(c: C, sim: Sim, t: number) {
  for (const b of sim.barriers) barrier(c, b.rect, b.present, t);
  for (const p of sim.room.copper ?? []) pad(c, p.x, p.y, !!sim.kit.tether, t);
  for (const tu of sim.turrets) turret(c, tu.x, tu.y, tu.life, t);
}

/** A Buffer Turret: a post with a buffer triangle on top that points at nothing in particular; it blinks out at the end. */
function turret(c: C, x: number, y: number, life: number, t: number) {
  if (life < 90 && Math.floor(t / 6) % 2) return;
  c.save();
  c.strokeStyle = PAL.trace;
  c.lineWidth = LINE.world;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 24);
  c.moveTo(x - 10, y);
  c.lineTo(x + 10, y);
  c.stroke();
  c.beginPath();
  c.moveTo(x - 10, y - 42);
  c.lineTo(x + 12, y - 33);
  c.lineTo(x - 10, y - 24);
  c.closePath();
  c.fillStyle = PAL.fill;
  c.fill();
  c.shadowColor = PAL.trace;
  c.shadowBlur = 8;
  c.stroke();
  c.restore();
}

/** Over the drone: the tether line, scan marks on caught bugs, stun stars, and the Power Gate's ring. */
export function drawAct3Front(c: C, sim: Sim, t: number) {
  const d = sim.drone, tt = sim.tethered;
  if (tt) {
    c.save();
    c.strokeStyle = PAL.amber;
    c.lineWidth = 2;
    c.shadowColor = PAL.amber;
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(d.x, d.y - d.h / 2 + 13);
    c.lineTo(tt.x, tt.y);
    c.stroke();
    c.restore();
  }
  for (const e of sim.enemies) {
    if (!e.alive) continue;
    if (sim.isScanned(e)) scanMark(c, e.x, Math.min(...e.outline().map((p) => p.y)), e.hp / e.maxHp);
    if (sim.isStunned(e)) stars(c, e.x, Math.min(...e.outline().map((p) => p.y)) - 10, t);
  }
  if (sim.gated) {
    c.save();
    c.strokeStyle = rgba(PAL.trace, 0.35 + 0.15 * Math.sin(t * 0.06));
    c.setLineDash([3, 5]);
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(d.x, d.y, 40, 0, TAU);
    c.stroke();
    c.restore();
  }
}

/** Scan Visor: a bracketed health bar over a caught bug, so its state shows by shape as well as colour. */
function scanMark(c: C, x: number, top: number, k: number) {
  const w = 36, y = top - 16;
  c.save();
  c.strokeStyle = PAL.gold;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x - w / 2 - 4, y - 4); c.lineTo(x - w / 2 - 4, y + 6); c.lineTo(x - w / 2, y + 6);
  c.moveTo(x + w / 2 + 4, y - 4); c.lineTo(x + w / 2 + 4, y + 6); c.lineTo(x + w / 2, y + 6);
  c.stroke();
  c.fillStyle = rgba(PAL.gold, 0.25);
  c.fillRect(x - w / 2, y, w, 3);
  c.fillStyle = PAL.gold;
  c.fillRect(x - w / 2, y, w * Math.max(0, k), 3);
  c.restore();
}

/** Slack Parry's stun: three small stars circling over the bug. */
function stars(c: C, x: number, y: number, t: number) {
  c.save();
  c.fillStyle = PAL.text;
  for (let i = 0; i < 3; i++) {
    const a = t * 0.12 + (i / 3) * TAU;
    c.beginPath();
    c.arc(x + Math.cos(a) * 12, y + Math.sin(a) * 4, 2, 0, TAU);
    c.fill();
  }
  c.restore();
}

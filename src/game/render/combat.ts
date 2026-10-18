// Enemies, shots, the aim line and the Field Coil. Enemies are magenta line art with idle motion; telegraphs, bolts,
// orbs and the field are lights drawn additively with a soft halo (polish bar P4).
import type { Floater } from '../enemies/floater';
import type { GlitchSpike } from '../enemies/spike';
import type { Enemy } from '../enemies/types';
import type { Sim } from '../sim';
import { TUNING } from '../tuning';
import { PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;
const deg = Math.PI / 180;

function poly(c: C, pts: { x: number; y: number }[]) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
}

export function drawEnemies(c: C, sim: Sim, t: number, reducedFlash: boolean) {
  c.lineJoin = 'round';
  for (const e of sim.enemies) {
    if (!e.alive) continue;
    if (e.kind === 'spike') { drawSpike(c, e as GlitchSpike); continue; }
    const out = idle(e, t);
    const tele = e.telegraph;
    // telegraph halo: grows and brightens through the 0.4 s wind-up
    if (tele > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(PAL.neon, 0.25 + 0.5 * tele);
      c.lineWidth = 6 + 8 * tele;
      poly(c, out);
      c.stroke();
      c.restore();
    }
    const flash = e.flash > 0;
    poly(c, out);
    c.fillStyle = flash && !reducedFlash ? '#FFFFFF' : PAL.fill;
    c.fill();
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.neon, 0.34);
    c.lineWidth = 8;
    c.stroke();
    c.restore();
    c.strokeStyle = flash ? '#FFFFFF' : tele > 0.6 ? '#FFC8F0' : PAL.neon;
    c.lineWidth = 2.5;
    c.stroke();
    // per-kind details
    if (e.kind === 'glitch') {
      const eye = { x: e.x + e.facing * 2, y: e.y - 1 };
      c.fillStyle = tele > 0 ? '#FFFFFF' : PAL.neon;
      c.fillRect(eye.x - 2 + Math.sin(t * 0.9) * 0.6, eye.y - 1, 4, 2);
    } else if (e.kind === 'spark') {
      // an inner square spinning, charged during the telegraph
      c.save();
      c.translate(e.x, e.y);
      c.rotate(t * 0.05 + tele * 3);
      c.strokeStyle = rgba(PAL.neon, 0.8);
      c.lineWidth = 1.5;
      const s = 4 + tele * 3;
      c.strokeRect(-s, -s, s * 2, s * 2);
      c.restore();
      if (tele > 0) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, 10 + tele * 12);
        g.addColorStop(0, rgba('#FFFFFF', 0.7 * tele));
        g.addColorStop(1, rgba(PAL.neon, 0));
        c.fillStyle = g;
        c.beginPath();
        c.arc(e.x, e.y, 10 + tele * 12, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    } else if (e.kind === 'latch') {
      // the armoured front: a thick plate on the facing side, and a jaw that opens through the telegraph
      const r = TUNING.latch.size / 2, f = e.facing;
      c.strokeStyle = flash ? '#FFFFFF' : '#FFD0F3';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(e.x + f * r * 0.62, e.y - r * 0.72);
      c.lineTo(e.x + f * r * 0.98, e.y);
      c.lineTo(e.x + f * r * 0.62, e.y + r * 0.72);
      c.stroke();
      const jaw = tele * 6;
      c.strokeStyle = PAL.neon;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(e.x + f * r * 0.2, e.y + 4 - jaw * 0.3);
      c.lineTo(e.x + f * r * 0.7, e.y + 4 - jaw);
      c.moveTo(e.x + f * r * 0.2, e.y + 8 + jaw * 0.3);
      c.lineTo(e.x + f * r * 0.7, e.y + 8 + jaw);
      c.stroke();
      c.fillStyle = tele > 0 ? '#FFFFFF' : PAL.neon;
      c.beginPath();
      c.arc(e.x + f * r * 0.25, e.y - 6, 2.5, 0, Math.PI * 2);
      c.fill();
    } else if (e.kind === 'floater') {
      const fl = e as Floater;
      c.strokeStyle = fl.pinned ? PAL.ok : PAL.neon;
      c.beginPath();
      c.moveTo(fl.x, fl.y + 18);
      c.lineTo(fl.x, fl.y + 30);
      c.stroke();
    }
    // health tick under hurt enemies
    if (e.hp < e.maxHp) {
      const w = 24, k = Math.max(0, e.hp / e.maxHp);
      const top = Math.max(...out.map((p) => p.y));
      c.fillStyle = rgba(PAL.neon, 0.25);
      c.fillRect(e.x - w / 2, top + 6, w, 2);
      c.fillStyle = PAL.neon;
      c.fillRect(e.x - w / 2, top + 6, w * k, 2);
    }
  }
}

/** Idle motion on top of physics: a little jitter for Glitch, a breathing scale for Latch. */
function idle(e: Enemy, t: number) {
  const out = e.outline();
  const s = e.kind === 'latch' ? 1 + Math.sin(t * 0.06) * 0.025 : 1;
  const jx = e.kind === 'glitch' && Math.floor(t / 7) % 9 === 0 ? 1.2 : 0;
  return out.map((p) => ({ x: e.x + (p.x - e.x) * s + jx, y: e.y + (p.y - e.y) * s }));
}

function drawSpike(c: C, s: GlitchSpike) {
  const r = s.rect;
  if (s.phase === 'warn') {
    c.save();
    c.strokeStyle = PAL.neon;
    c.globalAlpha = 0.3 + 0.5 * s.telegraph;
    c.lineWidth = 1;
    c.setLineDash([6, 6]);
    c.beginPath();
    c.moveTo(r.x + r.w / 2, r.y);
    c.lineTo(r.x + r.w / 2, r.y + r.h);
    c.stroke();
    c.restore();
  } else if (s.phase === 'strike') {
    c.strokeStyle = PAL.neon;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(r.x, r.y + r.h); c.lineTo(r.x + r.w / 2, r.y); c.lineTo(r.x + r.w, r.y + r.h);
    c.stroke();
  }
}

export function drawShots(c: C, sim: Sim, alpha: number) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (const s of sim.shots) {
    const x = s.x + s.vx * alpha, y = s.y + s.vy * alpha;
    const l = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / l, uy = s.vy / l;
    if (s.kind === 'orb') {
      const col = s.friendly ? PAL.trace : PAL.neon;
      const g = c.createRadialGradient(x, y, 0, x, y, 18);
      g.addColorStop(0, rgba('#FFFFFF', 0.95));
      g.addColorStop(0.3, rgba(col, 0.8));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, 18, 0, Math.PI * 2);
      c.fill();
      continue;
    }
    const charged = s.kind === 'charged';
    const body = charged ? 26 : 12, w = charged ? 6 : 3, trail = charged ? 40 : TUNING.probe.trail + body;
    const col = charged ? PAL.neon : PAL.trace;
    // halo, fading trail, then the hot core
    c.strokeStyle = rgba(col, 0.22);
    c.lineWidth = w + 7;
    c.beginPath();
    c.moveTo(x - ux * body, y - uy * body);
    c.lineTo(x, y);
    c.stroke();
    const g = c.createLinearGradient(x - ux * trail, y - uy * trail, x, y);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(1, rgba(col, 0.9));
    c.strokeStyle = g;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x - ux * trail, y - uy * trail);
    c.lineTo(x, y);
    c.stroke();
    c.strokeStyle = '#EFFFFF';
    c.lineWidth = Math.max(1, w - 1.5);
    c.beginPath();
    c.moveTo(x - ux * body * 0.6, y - uy * body * 0.6);
    c.lineTo(x, y);
    c.stroke();
  }
  c.restore();
}

/** The dotted 120 px aim line from the muzzle (plan E). */
export function drawAimLine(c: C, sim: Sim, mx: number, my: number) {
  if (sim.dying || sim.booting) return;
  c.save();
  c.strokeStyle = rgba(sim.weapon === 'charged' ? PAL.neon : PAL.trace, 0.4);
  c.lineWidth = 1.5;
  c.setLineDash([2, 6]);
  c.beginPath();
  c.moveTo(mx + sim.aim.x * 8, my + sim.aim.y * 8);
  c.lineTo(mx + sim.aim.x * TUNING.probe.aimLine, my + sim.aim.y * TUNING.probe.aimLine);
  c.stroke();
  c.restore();
}

/** Field Coil: three rippling arcs in a 120° wedge toward the cursor, and tethers to a held prop (plan F). */
export function drawField(c: C, sim: Sim, ox: number, oy: number, ex: number, ey: number, t: number, power: number) {
  if (power <= 0.01) return;
  const F = TUNING.field, a = Math.atan2(sim.aim.y, sim.aim.x), half = (F.arc / 2) * deg;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(ox, oy, 8, ox, oy, F.radius);
  g.addColorStop(0, rgba(PAL.trace, 0));
  g.addColorStop(1, rgba(PAL.trace, 0.12 * power));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(ox, oy);
  c.arc(ox, oy, F.radius * (0.9 + 0.1 * power), a - half, a + half);
  c.closePath();
  c.fill();
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.04 + i / 3) % 1;
    const r = F.radius * (0.45 + 0.55 * ph) * (0.9 + 0.1 * power);
    c.strokeStyle = rgba(PAL.trace, (0.25 + 0.55 * (1 - Math.abs(ph - 0.7) * 1.4)) * power);
    c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k <= 24; k++) {
      const aa = a - half + (2 * half * k) / 24;
      const rr = r + Math.sin(k * 0.9 + t * 0.3 + i) * 2.2;
      const px = ox + Math.cos(aa) * rr, py = oy + Math.sin(aa) * rr;
      k ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.stroke();
  }
  if (sim.field.on && sim.field.held) {
    const p = sim.field.held.body.position, ch = sim.field.charge;
    const n = { x: -(p.y - ey), y: p.x - ex }, nl = Math.hypot(n.x, n.y) || 1;
    for (const side of [-1, 1]) {
      const sx = ex + (n.x / nl) * 3 * side, sy = ey + (n.y / nl) * 3 * side;
      const mx = (sx + p.x) / 2 + (n.x / nl) * 6 * side * Math.sin(t * 0.3), my = (sy + p.y) / 2 + (n.y / nl) * 6 * side * Math.sin(t * 0.3);
      c.strokeStyle = rgba(PAL.trace, 0.5 + 0.4 * ch);
      c.lineWidth = 1.5 + ch;
      c.beginPath();
      c.moveTo(sx, sy);
      c.quadraticCurveTo(mx, my, p.x, p.y);
      c.stroke();
    }
  }
  c.restore();
}

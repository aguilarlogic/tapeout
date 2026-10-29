// Act 4's drawing (Phase 7 Spec, sections 3 and 8): router pads and the NoC Warp, Assertion Mines, the Agent Pair and
// the monitor's mark, the Rewind's ghost trail, and the Coverage Map strip. Line art with an additive glow pass.
import type { Vec } from '../physics/geom';
import type { Sim } from '../sim';
import { HZ } from '../tuning';
import { UP } from '../world/upgrades';
import { FONT, LINE, PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** A router pad: a 40 x 8 px plate on the floor with four arrow ticks; lit while the NoC Warp can use it. */
function router(c: C, x: number, y: number, live: boolean, here: boolean, t: number) {
  const w = 40, h = 8, x0 = x - w / 2, y0 = y - h;
  c.save();
  if (live) {
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.trace, 0.25 + 0.1 * Math.sin(t * 0.08));
    c.lineWidth = 8;
    c.strokeRect(x0, y0, w, h);
    c.globalCompositeOperation = 'source-over';
  }
  c.fillStyle = PAL.fill;
  c.fillRect(x0, y0, w, h);
  c.strokeStyle = live ? PAL.trace : rgba(PAL.trace, 0.45);
  c.lineWidth = LINE.world;
  c.strokeRect(x0, y0, w, h);
  c.beginPath();
  for (const dx of [-14, -5, 5, 14]) { const s = dx < 0 ? -1 : 1; c.moveTo(x + dx - s * 2, y0 + 2); c.lineTo(x + dx + s * 2, y0 + 4); c.lineTo(x + dx - s * 2, y0 + 6); }
  c.stroke();
  if (here) {
    c.font = `12px ${FONT}`;
    c.textAlign = 'center';
    c.fillStyle = rgba(PAL.text, 0.85);
    c.fillText('E  WARP', x, y0 - 54);
  }
  c.restore();
}

/** An Assertion Mine: a small diamond on the floor; it blinks once armed. */
function mine(c: C, x: number, y: number, age: number, t: number) {
  const armed = age >= Math.round(UP.mine.armS * HZ), s = 7, cy = y - s;
  c.save();
  c.beginPath();
  c.moveTo(x, cy - s); c.lineTo(x + s, cy); c.lineTo(x, cy + s); c.lineTo(x - s, cy);
  c.closePath();
  c.fillStyle = PAL.fill;
  c.fill();
  c.strokeStyle = armed ? PAL.amber : rgba(PAL.amber, 0.5);
  c.lineWidth = 1.5;
  c.stroke();
  if (armed && Math.floor(t / 20) % 2 === 0) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(PAL.amber, 0.8);
    c.beginPath();
    c.arc(x, cy, 2, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** Under the drone: router pads and mines (world space). */
export function drawAct4Back(c: C, sim: Sim, t: number) {
  const pads = sim.room.routers ?? [], live = !!sim.kit.warp && pads.length > 1, here = sim.onRouter() && sim.warpT === 0;
  const d = sim.drone, feet = d.y + d.h / 2;
  for (const p of pads) router(c, p.x, p.y, live, here && Math.abs(p.x - d.x) <= 26 && Math.abs(p.y - feet) <= 12, t);
  for (const m of sim.mines) mine(c, m.x, m.y, m.age, t);
}

/** A small helper drone: the driver is a square, the monitor an eye. */
function agent(c: C, p: Vec, kind: 'driver' | 'monitor', t: number) {
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = PAL.fill;
  c.strokeStyle = kind === 'driver' ? PAL.trace : PAL.gold;
  c.shadowColor = c.strokeStyle;
  c.shadowBlur = 8;
  c.lineWidth = 1.5;
  c.beginPath();
  if (kind === 'driver') { c.rotate(t * 0.04); c.rect(-5, -5, 10, 10); }
  else { c.ellipse(0, 0, 8, 5, 0, 0, TAU); }
  c.fill();
  c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = c.strokeStyle;
  c.beginPath();
  c.arc(0, 0, kind === 'driver' ? 1.5 : 2.5, 0, TAU);
  c.fill();
  c.restore();
}

/** The monitor's mark: gold corner brackets round the marked bug. */
function markBrackets(c: C, x: number, y: number, r: number) {
  const k = 6;
  c.save();
  c.strokeStyle = PAL.gold;
  c.lineWidth = 1.5;
  c.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    c.moveTo(x + sx * r, y + sy * (r - k)); c.lineTo(x + sx * r, y + sy * r); c.lineTo(x + sx * (r - k), y + sy * r);
  }
  c.stroke();
  c.restore();
}

/** The Rewind's ghost trail: faint drone outlines along the path it jumped back over, fading out. */
let ghost: { path: Vec[]; left: number } | null = null;
export function noteRewind(path: Vec[]) { ghost = { path, left: 30 }; }

/** Over the drone: the Agent Pair, its mark, and the Rewind trail. */
export function drawAct4Front(c: C, sim: Sim, t: number) {
  const a = sim.agentPos;
  if (a) {
    agent(c, a.driver, 'driver', t);
    agent(c, a.monitor, 'monitor', t);
    const m = sim.marked;
    if (m?.alive) {
      const ys = m.outline().map((p) => p.y), xs = m.outline().map((p) => p.x);
      markBrackets(c, m.x, m.y, Math.max(14, (Math.max(...xs) - Math.min(...xs)) / 2 + 6, (Math.max(...ys) - Math.min(...ys)) / 2 + 6));
    }
  }
  if (ghost) {
    const k = ghost.left / 30;
    c.save();
    c.strokeStyle = rgba(PAL.trace, 0.5 * k);
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    for (const p of ghost.path) c.strokeRect(p.x - 13, p.y - 22, 26, 44);
    c.restore();
    if (--ghost.left <= 0) ghost = null;
  }
}

/** The drone's fade while it warps: out over the first half, in over the second. */
export function warpAlpha(sim: Sim): number {
  if (!sim.warpT) return 1;
  const f = Math.round(UP.warp.fadeS * HZ);
  return sim.warpT < f ? 1 - sim.warpT / f : (sim.warpT - f) / f;
}

/** Coverage Map: one 12 px box per room of the place, top right; filled once entered, the current one framed bright. */
export function drawCoverage(c: C, cov: { seen: boolean[]; at: number } | null, viewW: number) {
  if (!cov || !cov.seen.length) return;
  const n = cov.seen.length, box = 12, gap = 4, pct = Math.round((cov.seen.filter(Boolean).length / n) * 100);
  c.save();
  c.font = `12px ${FONT}`;
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  const label = `${pct}%`, lw = c.measureText(label).width;
  const right = viewW - 20, x0 = right - lw - 10 - n * (box + gap) + gap, y = 16;
  c.fillStyle = rgba(PAL.bgDeep, 0.7);
  c.fillRect(x0 - 8, y - 6, right - x0 + 16, box + 12);
  cov.seen.forEach((seen, i) => {
    const x = x0 + i * (box + gap);
    if (seen) { c.fillStyle = rgba(PAL.trace, 0.55); c.fillRect(x, y, box, box); }
    c.strokeStyle = i === cov.at ? PAL.text : rgba(PAL.trace, 0.6);
    c.lineWidth = i === cov.at ? 2 : 1;
    c.strokeRect(x + 0.5, y + 0.5, box - 1, box - 1);
  });
  c.fillStyle = rgba(PAL.text, 0.85);
  c.fillText(label, right, y + box / 2);
  c.restore();
}

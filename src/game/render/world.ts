// The world's art (polish bar P3): three parallax layers of circuit traces with glow pulses, chip-layout platforms
// (inner trace pattern, bright top edge, 3 px chamfers), props in amber, the door, plate, pad and target dummy,
// drifting dust motes and a soft vignette. World coordinates unless a function says otherwise.
import type { Rect, Room } from '../level/room';
import type { Prop } from '../physics/world';
import { rng, type Sim } from '../sim';
import { VIEW_H, VIEW_W } from '../tuning';
import { FONT, LINE, PAL, rgba } from './palette';

type C = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

interface Trace { pts: Pt[]; len: number; seg: number[]; pulseAt: number; pulse: number; minX: number; maxX: number; minY: number; maxY: number }
interface Layer { f: number; traces: Trace[]; alpha: number; width: number }

/** A random Manhattan trace with 45° corners, like routing on a chip. */
function makeTrace(r: () => number, x: number, y: number, w: number, h: number): Pt[] {
  const pts: Pt[] = [{ x, y }];
  let cx = x, cy = y, horiz = r() < 0.7;
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const L = 60 + r() * 260;
    if (horiz) cx += (r() < 0.75 ? 1 : -1) * L;
    else cy += (r() < 0.5 ? 1 : -1) * L * 0.5;
    cx = Math.max(0, Math.min(w, cx));
    cy = Math.max(0, Math.min(h, cy));
    const p = pts[pts.length - 1];
    // a 45° chamfer at the corner
    if (pts.length > 1) { const c = 14; const q = { x: p.x + Math.sign(cx - p.x) * c, y: p.y + Math.sign(cy - p.y) * c }; pts.push(q); }
    pts.push({ x: cx, y: cy });
    horiz = !horiz;
  }
  return pts;
}

function measure(pts: Pt[]): Trace {
  const seg: number[] = [];
  let len = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    if (i) { const l = Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); seg.push(l); len += l; }
  }
  return { pts, len, seg, pulseAt: 0, pulse: -1, minX, maxX, minY, maxY };
}

function pointAt(t: Trace, d: number): Pt {
  let acc = 0;
  for (let i = 0; i < t.seg.length; i++) {
    if (acc + t.seg[i] >= d) {
      const k = (d - acc) / (t.seg[i] || 1), a = t.pts[i], b = t.pts[i + 1];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    acc += t.seg[i];
  }
  return t.pts[t.pts.length - 1];
}

export class WorldArt {
  private layers: Layer[];
  private roomTraces: Trace[];
  private motes: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
  private rand: () => number;
  private vignette: CanvasGradient | null = null;

  constructor(private room: Room, seed = 3) {
    this.rand = rng(seed);
    const r = this.rand;
    this.layers = [
      { f: 0.2, alpha: 0.10, width: 1.5, count: 26 },
      { f: 0.4, alpha: 0.16, width: 1.5, count: 30 },
      { f: 0.7, alpha: 0.24, width: 2, count: 34 },
    ].map(({ f, alpha, width, count }) => {
      const w = room.w * f + VIEW_W, h = room.h * f + VIEW_H;
      const traces: Trace[] = [];
      for (let i = 0; i < count; i++) {
        const t = measure(makeTrace(r, r() * w, r() * h, w, h));
        t.pulseAt = r() * 3;
        traces.push(t);
      }
      return { f, traces, alpha, width };
    });
    this.roomTraces = room.traces.map((p) => { const t = measure(p); t.pulseAt = r() * 3; return t; });
    for (let i = 0; i < 46; i++) this.motes.push({ x: r() * room.w, y: r() * room.h, vx: (r() - 0.5) * 0.15, vy: -0.05 - r() * 0.12, r: 0.6 + r() * 1.4, a: 0.15 + r() * 0.3 });
  }

  /** Advance pulses and motes one 60 Hz step. Pulses start along a trace every 2-4 s (P3). */
  step(reduced: boolean) {
    const dt = 1 / 60;
    for (const t of [...this.layers.flatMap((l) => l.traces), ...this.roomTraces]) {
      if (t.pulse >= 0) {
        t.pulse += dt * 420;
        if (t.pulse > t.len + 60) t.pulse = -1;
      } else if ((t.pulseAt -= dt) <= 0) {
        t.pulse = 0;
        t.pulseAt = 2 + this.rand() * 2;
      }
    }
    if (reduced) return;
    for (const m of this.motes) {
      m.x += m.vx + Math.sin((m.y + m.x) * 0.01) * 0.05;
      m.y += m.vy;
      if (m.y < 0) m.y += this.room.h;
      if (m.x < 0) m.x += this.room.w;
      if (m.x > this.room.w) m.x -= this.room.w;
    }
  }

  /** Back wall and the three parallax layers. `cam` is the view's top-left in world px. */
  drawBackdrop(c: C, cam: Pt) {
    const view = { x: cam.x, y: cam.y, w: VIEW_W, h: VIEW_H };
    const g = c.createLinearGradient(0, view.y, 0, view.y + view.h);
    g.addColorStop(0, '#120F27');
    g.addColorStop(1, PAL.bgDeep);
    c.fillStyle = g;
    c.fillRect(view.x, view.y, view.w, view.h);
    for (const L of this.layers) {
      c.save();
      // a layer at factor f moves f px per world px: draw it at world = layer + cam·(1 − f)
      const ox = cam.x * (1 - L.f), oy = cam.y * (1 - L.f);
      c.translate(ox, oy);
      const vx = cam.x - ox, vy = cam.y - oy;
      this.drawTraces(c, L.traces, { x: vx, y: vy, w: VIEW_W, h: VIEW_H }, L.alpha, L.width, L.f);
      c.restore();
    }
    this.drawTraces(c, this.roomTraces, view, 0.5, LINE.trace, 1);
  }

  private drawTraces(c: C, traces: Trace[], view: Rect, alpha: number, width: number, depth: number) {
    const vis = traces.filter((t) => t.maxX >= view.x - 20 && t.minX <= view.x + view.w + 20 && t.maxY >= view.y - 20 && t.minY <= view.y + view.h + 20);
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.strokeStyle = rgba(depth < 1 ? '#6F6AA8' : PAL.trace, alpha);
    c.beginPath();
    for (const t of vis) t.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
    // vias at the ends
    c.fillStyle = rgba(depth < 1 ? '#6F6AA8' : PAL.trace, alpha * 1.4);
    for (const t of vis) {
      for (const p of [t.pts[0], t.pts[t.pts.length - 1]]) { c.beginPath(); c.arc(p.x, p.y, width + 1.5, 0, Math.PI * 2); c.fill(); }
    }
    // travelling glow pulses, additive
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const t of vis) {
      if (t.pulse < 0) continue;
      const head = pointAt(t, Math.min(t.len, t.pulse)), tail = pointAt(t, Math.max(0, t.pulse - 50));
      const col = depth < 1 ? '#8E7CFF' : PAL.trace;
      c.strokeStyle = rgba(col, Math.min(1, alpha * 3.2));
      c.lineWidth = width + 1;
      c.beginPath();
      c.moveTo(tail.x, tail.y);
      c.lineTo(head.x, head.y);
      c.stroke();
      c.fillStyle = rgba(col, Math.min(1, alpha * 2.5));
      c.beginPath();
      c.arc(head.x, head.y, width + 3, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  /** Room signs, painted on the back wall. */
  drawSigns(c: C) {
    c.fillStyle = 'rgba(244,243,255,0.46)';
    c.font = `13px ${FONT}`;
    for (const s of this.room.signs) c.fillText(s.text, s.x, s.y);
  }

  /** Every solid as a chip-layout block (P3). */
  drawSolids(c: C, sim: Sim, cam: Pt) {
    const view = { x: cam.x - 4, y: cam.y - 4, w: VIEW_W + 8, h: VIEW_H + 8 };
    for (const s of sim.world.statics) {
      if (s === sim.world.door?.rect) continue;
      if (s.x > view.x + view.w || s.x + s.w < view.x || s.y > view.y + view.h || s.y + s.h < view.y) continue;
      this.block(c, s, view);
    }
  }

  private block(c: C, s: Rect, view: Rect) {
    // clip big slabs to the view so the inner pattern stays cheap
    const x0 = Math.max(s.x, view.x), x1 = Math.min(s.x + s.w, view.x + view.w);
    const y0 = Math.max(s.y, view.y), y1 = Math.min(s.y + s.h, view.y + view.h);
    c.save();
    chamfer(c, s, 3);
    c.fillStyle = PAL.fill;
    c.fill();
    c.clip();
    // inner trace pattern on a 20 px grid: short routed stubs with vias, seeded by grid cell so it never shimmers
    c.strokeStyle = 'rgba(111,106,168,0.35)';
    c.fillStyle = 'rgba(111,106,168,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    const G = 20;
    for (let gx = Math.floor(x0 / G) * G; gx < x1; gx += G) {
      for (let gy = Math.floor(y0 / G) * G; gy < y1; gy += G) {
        const h = hash(gx, gy);
        if (gy < s.y + 6 || gy > s.y + s.h - 6 || gx < s.x + 4 || gx > s.x + s.w - 4) continue;
        if (h < 0.35) { c.moveTo(gx, gy); c.lineTo(gx + G, gy); }
        else if (h < 0.55) { c.moveTo(gx, gy); c.lineTo(gx, gy + G); }
        else if (h < 0.62) { c.moveTo(gx, gy); c.lineTo(gx + 7, gy + 7); c.lineTo(gx + G, gy + 7); }
      }
    }
    c.stroke();
    for (let gx = Math.floor(x0 / G) * G; gx < x1; gx += G) {
      for (let gy = Math.floor(y0 / G) * G; gy < y1; gy += G) {
        if (gy < s.y + 6 || gy > s.y + s.h - 6 || gx < s.x + 4 || gx > s.x + s.w - 4) continue;
        if (hash(gy, gx) < 0.12) c.fillRect(gx - 1.5, gy - 1.5, 3, 3);
      }
    }
    c.restore();
    // outline, then the bright top edge with a soft halo
    c.strokeStyle = 'rgba(232,230,245,0.55)';
    c.lineWidth = 1.5;
    chamfer(c, s, 3);
    c.stroke();
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(Math.max(s.x + 3, x0 - 2), s.y + 0.75);
    c.lineTo(Math.min(s.x + s.w - 3, x1 + 2), s.y + 0.75);
    c.strokeStyle = rgba(PAL.trace, 0.16);
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = rgba('#DFFBFF', 0.9);
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  /** Door, pressure plate, input pads and the target dummy (amber interactables). */
  drawFixtures(c: C, sim: Sim, t: number) {
    const room = this.room;
    if (room.door && sim.world.door) {
      const d = sim.world.door.rect, home = sim.world.door.home;
      if (sim.doorOpen < 1) {
        c.save();
        c.beginPath();
        c.rect(home.x - 2, home.y, home.w + 4, home.h);
        c.clip();
        c.fillStyle = PAL.fill;
        c.fillRect(d.x, d.y, d.w, d.h);
        // hazard stripes and a lock light
        c.strokeStyle = rgba(PAL.amber, 0.55);
        c.lineWidth = 3;
        c.beginPath();
        for (let y = d.y - d.w; y < d.y + d.h; y += 18) { c.moveTo(d.x, y + d.w); c.lineTo(d.x + d.w, y); }
        c.stroke();
        c.strokeStyle = PAL.amber;
        c.lineWidth = 2;
        c.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2);
        c.restore();
      }
      const p = room.door.plate, on = sim.doorOpen > 0;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(on ? PAL.ok : PAL.amber, on ? 0.35 : 0.18 + 0.08 * Math.sin(t * 0.08));
      c.fillRect(p.x, p.y - 2, p.w, p.h + 2);
      c.restore();
      c.strokeStyle = on ? PAL.ok : PAL.amber;
      c.lineWidth = 2;
      c.strokeRect(p.x, p.y - 2, p.w, p.h + 2);
      // the wire from plate to door
      c.strokeStyle = rgba(on ? PAL.ok : PAL.amber, 0.6);
      c.lineWidth = 1.5;
      c.setLineDash([6, 5]);
      c.lineDashOffset = on ? -t * 0.8 : 0;
      c.beginPath();
      c.moveTo(p.x + p.w, p.y + 2);
      c.lineTo(home.x, p.y + 2);
      c.lineTo(home.x, home.y + home.h - 10);
      c.stroke();
      c.setLineDash([]);
    }
    (room.pads ?? []).forEach((pad, i) => {
      const bit = sim.padBits[i];
      c.strokeStyle = PAL.amber;
      c.lineWidth = 2;
      c.strokeRect(pad.x, pad.y - 2, pad.w, pad.h + 2);
      c.font = `bold 14px ${FONT}`;
      c.textAlign = 'center';
      c.fillStyle = bit === null ? rgba(PAL.idle, 0.8) : bit ? PAL.trace : PAL.amber;
      c.fillText(bit === null ? '·' : `IN = ${bit}`, pad.x + pad.w / 2, pad.y - 70);
      c.textAlign = 'start';
    });
    if (room.dummy) {
      const { x, y } = room.dummy, f = sim.dummyFlash > 0;
      c.strokeStyle = f ? '#FFFFFF' : PAL.amber;
      c.fillStyle = PAL.fill;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 18, y);
      c.lineTo(x + 18, y);
      c.moveTo(x, y);
      c.lineTo(x, y - 52);
      c.stroke();
      c.beginPath();
      c.arc(x, y - 72, 20, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(x, y - 72, 11, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(x, y - 72, 3, 0, Math.PI * 2);
      c.stroke();
      const dps = sim.dummyDps();
      c.font = `bold 13px ${FONT}`;
      c.textAlign = 'center';
      c.fillStyle = PAL.text;
      c.fillText(`${dps.toFixed(0)} DPS`, x, y - 112);
      c.fillStyle = rgba(PAL.amber, 0.85);
      c.font = `11px ${FONT}`;
      c.fillText(sim.dummyLast ? `last hit ${sim.dummyLast.toFixed(0)}` : 'shoot me', x, y - 98);
      c.textAlign = 'start';
    }
  }

  drawProps(c: C, sim: Sim, t: number) {
    for (const p of sim.world.props) drawProp(c, p, sim, t);
  }

  drawMotes(c: C, cam: Pt) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      if (m.x < cam.x || m.x > cam.x + VIEW_W || m.y < cam.y || m.y > cam.y + VIEW_H) continue;
      c.fillStyle = `rgba(185,182,230,${m.a})`;
      c.beginPath();
      c.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  /** The soft vignette, in view coordinates. */
  drawVignette(c: C) {
    if (!this.vignette) {
      this.vignette = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
      this.vignette.addColorStop(0, 'rgba(5,4,14,0)');
      this.vignette.addColorStop(1, 'rgba(5,4,14,0.6)');
    }
    c.fillStyle = this.vignette;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawProp(c: C, p: Prop, sim: Sim, t: number) {
  const b = p.body, v = b.vertices;
  const heavy = p.mass > sim.kit.grabLimit;
  let alpha = 1;
  if (p.kind === 'debris' && p.life > 0) alpha = Math.min(1, p.life / 30);
  c.save();
  c.globalAlpha = alpha;
  c.beginPath();
  v.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  c.closePath();
  c.fillStyle = PAL.fill;
  c.fill();
  const col = p.held ? PAL.trace : p.kind === 'debris' ? PAL.neon : PAL.amber;
  if (p.held) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.trace, 0.25 + 0.5 * (sim.field.on ? sim.field.charge : 0));
    c.lineWidth = 8;
    c.stroke();
    c.restore();
  }
  c.strokeStyle = heavy ? rgba(PAL.amber, 0.55) : col;
  c.lineWidth = 2;
  c.stroke();
  // inner details, in the prop's own frame
  c.translate(b.position.x, b.position.y);
  c.rotate(b.angle);
  const h = p.size / 2 - 5;
  c.lineWidth = 1;
  if (p.kind === 'crate') {
    c.strokeStyle = rgba(heavy ? PAL.amber : col, heavy ? 0.4 : 0.6);
    c.beginPath();
    c.moveTo(-h, -h); c.lineTo(h, h);
    if (heavy) { c.moveTo(h, -h); c.lineTo(-h, h); }
    c.rect(-h, -h, h * 2, h * 2);
    c.stroke();
    // mass pips
    c.fillStyle = rgba(col, 0.8);
    for (let i = 0; i < p.mass; i++) c.fillRect(-h + 2 + i * 5, h - 4, 3, 3);
  } else if (p.kind === 'logic') {
    c.font = `bold 16px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = p.bit ? PAL.trace : PAL.amber;
    c.fillText(`${p.bit ?? 0}`, 0, 1);
    c.restore();
    c.strokeStyle = rgba(col, 0.5);
    c.strokeRect(-h, -h, h * 2, h * 2);
  }
  c.restore();
  void t;
}

/** A rect path with chamfered corners. */
function chamfer(c: C, r: Rect, k: number) {
  c.beginPath();
  c.moveTo(r.x + k, r.y);
  c.lineTo(r.x + r.w - k, r.y);
  c.lineTo(r.x + r.w, r.y + k);
  c.lineTo(r.x + r.w, r.y + r.h - k);
  c.lineTo(r.x + r.w - k, r.y + r.h);
  c.lineTo(r.x + k, r.y + r.h);
  c.lineTo(r.x, r.y + r.h - k);
  c.lineTo(r.x, r.y + k);
  c.closePath();
}

function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

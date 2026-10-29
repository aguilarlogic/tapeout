// Particles: sparks, dust, shatter fragments, flashes, rings and damage numbers, from one pool of 400 (plan M). They
// step with the 60 Hz simulation and are drawn with the render's interpolation fraction. Lights (sparks, flashes,
// rings) draw additively with a soft halo (polish bar P4).
import type { Rect } from '../level/room';
import { blinkSteady, FONT, rgba } from './palette';

export type PKind = 'spark' | 'dust' | 'frag' | 'flash' | 'ring' | 'text' | 'mote';

export interface Particle {
  kind: PKind;
  x: number; y: number;
  vx: number; vy: number; // px/step
  life: number; max: number; // steps
  size: number;
  color: string;
  rot: number; vr: number;
  len: number;
  grav: number; // px/step²
  drag: number; // velocity kept per step
  text: string;
  live: boolean;
}

export const POOL = 400;

export class Fx {
  parts: Particle[] = [];
  private free: Particle[] = [];
  constructor() {
    for (let i = 0; i < POOL; i++) this.free.push(blank());
  }
  get count() { return this.parts.length; }

  /** Spawn a particle; the oldest one is recycled when the pool is full. */
  spawn(p: Partial<Particle> & { kind: PKind; x: number; y: number; life: number }): Particle {
    let q = this.free.pop();
    if (!q) { q = this.parts.shift()!; }
    Object.assign(q, blank(), p, { max: p.life, live: true });
    this.parts.push(q);
    return q;
  }

  sparks(x: number, y: number, dx: number, dy: number, n: number, color: string, speed = 5, spreadRad = 0.9) {
    const a0 = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = a0 + (Math.random() * 2 - 1) * spreadRad, s = speed * (0.5 + Math.random() * 0.8);
      this.spawn({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 10 + Math.floor(Math.random() * 10), size: 1.5, len: 5 + Math.random() * 5, color, grav: 0.12, drag: 0.9 });
    }
  }
  dust(x: number, y: number, n: number, speed = 1.4, up = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI; // upper half
      const s = speed * (0.4 + Math.random());
      this.spawn({ kind: 'dust', x: x + (Math.random() * 2 - 1) * 8, y, vx: Math.cos(a) * s * 1.6, vy: Math.sin(a) * s * up, life: 18 + Math.floor(Math.random() * 14), size: 2 + Math.random() * 2.5, color: '#B9B6CF', grav: -0.005, drag: 0.92 });
    }
  }
  flash(x: number, y: number, size: number, color: string, life = 6) {
    this.spawn({ kind: 'flash', x, y, life, size, color });
  }
  ring(x: number, y: number, size: number, color: string, life = 16) {
    this.spawn({ kind: 'ring', x, y, life, size, color });
  }
  number(x: number, y: number, n: number, color: string) {
    this.spawn({ kind: 'text', x: x + (Math.random() * 2 - 1) * 6, y: y - 8, vx: (Math.random() * 2 - 1) * 0.4, vy: -1.4, life: 40, size: 13, color, text: `${Math.round(n)}`, drag: 0.94 });
  }
  /** Break an outline into its edges, flying apart from the centre and tumbling (plan E). */
  shatter(outline: { x: number; y: number }[], cx: number, cy: number, vx: number, vy: number, color: string, life: number) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, l = Math.hypot(b.x - a.x, b.y - a.y);
      const ox = mx - cx, oy = my - cy, ol = Math.hypot(ox, oy) || 1;
      const s = 1.6 + Math.random() * 2.2;
      this.spawn({
        kind: 'frag', x: mx, y: my, vx: vx / 60 + (ox / ol) * s, vy: vy / 60 + (oy / ol) * s - 1.6, life,
        len: l, rot: Math.atan2(b.y - a.y, b.x - a.x), vr: (Math.random() * 2 - 1) * 0.25, size: 2.5, color, grav: 0.35, drag: 0.99,
      });
    }
  }

  step(solids: Rect[]) {
    const keep: Particle[] = [];
    for (const p of this.parts) {
      if (--p.life <= 0) { p.live = false; this.free.push(p); continue; }
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.kind === 'frag') {
        for (const r of solids) {
          if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) {
            if (p.vy > 0 && p.y - p.vy <= r.y + 1) { p.y = r.y - 1; p.vy *= -0.35; p.vx *= 0.7; p.vr *= 0.6; }
            else { p.x -= p.vx; p.vx *= -0.4; }
          }
        }
      }
      keep.push(p);
    }
    this.parts = keep;
  }

  clear() {
    for (const p of this.parts) this.free.push(p);
    this.parts = [];
  }

  /** Draw every particle; `reducedFlash` turns flashes into thin outlines (plan I setting). */
  draw(c: CanvasRenderingContext2D, alpha: number, reducedFlash: boolean, numbers: boolean) {
    for (const p of this.parts) {
      const k = p.life / p.max, x = p.x + p.vx * alpha, y = p.y + p.vy * alpha;
      switch (p.kind) {
        case 'dust': {
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = rgba(p.color, 0.35 * k);
          c.beginPath();
          c.arc(x, y, p.size * (1.4 - k * 0.4), 0, Math.PI * 2);
          c.fill();
          break;
        }
        case 'spark': {
          c.globalCompositeOperation = 'lighter';
          const l = Math.hypot(p.vx, p.vy) || 1;
          c.strokeStyle = rgba(p.color, Math.min(1, k * 1.4));
          c.lineWidth = p.size;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - (p.vx / l) * p.len * k, y - (p.vy / l) * p.len * k);
          c.stroke();
          break;
        }
        case 'frag': {
          c.globalCompositeOperation = 'source-over';
          const fade = Math.min(1, k * 2.5);
          const hx = Math.cos(p.rot) * p.len / 2, hy = Math.sin(p.rot) * p.len / 2;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(x - hx, y - hy);
          c.lineTo(x + hx, y + hy);
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = rgba(p.color, 0.18 * fade);
          c.lineWidth = p.size + 6;
          c.stroke();
          c.globalCompositeOperation = 'source-over';
          c.strokeStyle = rgba(p.color, fade);
          c.lineWidth = p.size;
          c.stroke();
          c.lineCap = 'butt';
          break;
        }
        case 'flash': {
          if (reducedFlash || blinkSteady()) {
            c.globalCompositeOperation = 'source-over';
            c.strokeStyle = rgba(p.color, 0.6 * k);
            c.lineWidth = 1;
            c.beginPath();
            c.arc(x, y, p.size * 0.5, 0, Math.PI * 2);
            c.stroke();
            break;
          }
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(x, y, 0, x, y, p.size);
          g.addColorStop(0, rgba('#FFFFFF', 0.9 * k));
          g.addColorStop(0.3, rgba(p.color, 0.6 * k));
          g.addColorStop(1, rgba(p.color, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(x, y, p.size, 0, Math.PI * 2);
          c.fill();
          break;
        }
        case 'ring': {
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = rgba(p.color, 0.7 * k);
          c.lineWidth = 2 * k + 0.5;
          c.beginPath();
          c.arc(x, y, p.size * (1.2 - k), 0, Math.PI * 2);
          c.stroke();
          break;
        }
        case 'text': {
          if (!numbers) break;
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = rgba(p.color, Math.min(1, k * 2));
          c.font = `bold ${p.size}px ${FONT}`;
          c.textAlign = 'center';
          c.fillText(p.text, x, y);
          c.textAlign = 'start';
          break;
        }
        default:
          break;
      }
    }
    c.globalCompositeOperation = 'source-over';
  }
}

function blank(): Particle {
  return { kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#FFFFFF', rot: 0, vr: 0, len: 0, grav: 0, drag: 1, text: '', live: false };
}

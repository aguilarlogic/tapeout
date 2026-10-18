// Drawing the world: clean line art, glowing circuit traces, neon accents (doc section 10). World coordinates;
// the caller has already applied the camera transform.
import type { Floater } from '../enemies/floater';
import type { GlitchSpike } from '../enemies/spike';
import type { Room } from '../level/room';
import type { Sim } from '../sim';
import { DRONE, FIELD, VITALS } from '../tuning';
import { FONT, LINE, PAL } from './palette';

type C = CanvasRenderingContext2D;

function glow(c: C, color: string, blur: number) {
  c.shadowColor = color;
  c.shadowBlur = blur;
}
const noGlow = (c: C) => { c.shadowBlur = 0; };

/** Back wall: a faint tile grid, the room's traces with a dash that crawls along them (still with reduced motion), and signs. */
export function drawBackdrop(c: C, room: Room, t: number, reduced: boolean, view: { x: number; y: number; w: number; h: number }) {
  c.fillStyle = PAL.bgFar;
  c.fillRect(view.x, view.y, view.w, view.h);
  c.strokeStyle = 'rgba(232,230,245,0.04)';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = Math.floor(view.x / 40) * 40; x < view.x + view.w; x += 40) { c.moveTo(x, view.y); c.lineTo(x, view.y + view.h); }
  for (let y = Math.floor(view.y / 40) * 40; y < view.y + view.h; y += 40) { c.moveTo(view.x, y); c.lineTo(view.x + view.w, y); }
  c.stroke();

  c.lineWidth = LINE.trace;
  c.strokeStyle = PAL.trace;
  c.globalAlpha = 0.55;
  glow(c, PAL.trace, LINE.traceGlow);
  c.setLineDash([18, 14]);
  c.lineDashOffset = reduced ? 0 : -((t / 60) * LINE.traceDashSpeed);
  for (const tr of room.traces) {
    c.beginPath();
    tr.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  }
  c.setLineDash([]);
  noGlow(c);
  c.globalAlpha = 1;

  c.fillStyle = 'rgba(244,243,255,0.35)';
  c.font = `14px ${FONT}`;
  for (const s of room.signs) c.fillText(s.text, s.x, s.y);
}

export function drawRoom(c: C, sim: Sim) {
  const room = sim.room;
  c.lineWidth = LINE.world;
  c.strokeStyle = PAL.line;
  c.fillStyle = PAL.fill;
  for (const s of room.solids) {
    c.fillRect(s.x, s.y, s.w, s.h);
    c.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
  }
  for (const o of room.oneWay) {
    c.beginPath();
    c.moveTo(o.x, o.y);
    c.lineTo(o.x + o.w, o.y);
    c.stroke();
    c.save();
    c.setLineDash([4, 6]);
    c.strokeStyle = PAL.idle;
    c.beginPath();
    c.moveTo(o.x, o.y + o.h);
    c.lineTo(o.x + o.w, o.y + o.h);
    c.stroke();
    c.restore();
  }
  // short-circuit spikes: a red zigzag
  c.strokeStyle = PAL.hostile;
  glow(c, PAL.hostile, 8);
  for (const h of room.hazards) {
    c.beginPath();
    for (let x = h.x, i = 0; x <= h.x + h.w; x += 10, i++) c.lineTo(x, i % 2 ? h.y : h.y + h.h);
    c.stroke();
  }
  // grounding plates: green bar with ground symbol
  c.strokeStyle = PAL.ok;
  glow(c, PAL.ok, 8);
  for (const p of room.plates) {
    c.strokeRect(p.x, p.y, p.w, p.h);
    const cx = p.x + p.w / 2;
    c.beginPath();
    c.moveTo(cx, p.y - 30); c.lineTo(cx, p.y - 12);
    c.moveTo(cx - 14, p.y - 12); c.lineTo(cx + 14, p.y - 12);
    c.moveTo(cx - 9, p.y - 7); c.lineTo(cx + 9, p.y - 7);
    c.moveTo(cx - 4, p.y - 2); c.lineTo(cx + 4, p.y - 2);
    c.stroke();
  }
  noGlow(c);
  // emitters (test fixtures): a hollow diamond
  c.strokeStyle = PAL.idle;
  for (const e of room.emitters) {
    c.beginPath();
    c.moveTo(e.x, e.y - 14); c.lineTo(e.x + 14, e.y); c.lineTo(e.x, e.y + 14); c.lineTo(e.x - 14, e.y); c.closePath();
    c.stroke();
  }
}

export function drawBlocks(c: C, sim: Sim) {
  c.lineWidth = LINE.world;
  for (const b of sim.world.blocks) {
    const v = b.body.vertices;
    c.beginPath();
    v.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fillStyle = PAL.fill;
    c.fill();
    const heavy = b.mass > FIELD.maxMass;
    c.strokeStyle = b.held ? PAL.trace : heavy ? PAL.idle : PAL.line;
    if (b.held) glow(c, PAL.trace, 10);
    c.stroke();
    noGlow(c);
    if (heavy) { // cross-hatch marks a block too heavy to lift
      const p = b.body.position, s = b.size / 4;
      c.beginPath(); c.moveTo(p.x - s, p.y - s); c.lineTo(p.x + s, p.y + s); c.moveTo(p.x + s, p.y - s); c.lineTo(p.x - s, p.y + s); c.stroke();
    }
  }
}

function jagged(c: C, x: number, y: number, r: number, t: number) {
  c.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2, rr = r + (i % 2 ? 3 : -2) + Math.sin(t * 0.3 + i) * 0.8;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

export function drawEnemies(c: C, sim: Sim, t: number, reduced: boolean) {
  c.lineWidth = LINE.enemy;
  for (const e of sim.enemies) {
    if (!e.alive) continue;
    if (e.kind === 'floater') {
      const f = e as Floater;
      const hostile = f.touchDamage() > 0;
      c.strokeStyle = f.pinned ? PAL.ok : hostile ? PAL.hostile : PAL.idle;
      if (hostile) {
        glow(c, PAL.hostile, LINE.enemyGlow);
        jagged(c, f.x, f.y, 18, reduced ? 0 : t);
      } else {
        c.beginPath();
        c.arc(f.x, f.y, 18, 0, Math.PI * 2);
      }
      c.fillStyle = PAL.fill;
      c.fill();
      c.stroke();
      noGlow(c);
      // a dangling, unconnected input pin
      c.beginPath();
      c.moveTo(f.x, f.y + 18);
      c.lineTo(f.x, f.y + 30);
      c.stroke();
      c.beginPath();
      c.arc(f.x, f.y + 33, 3, 0, Math.PI * 2);
      c.stroke();
      if (hostile) bang(c, f.x, f.y - 34, t, reduced);
    } else if (e.kind === 'spike') {
      const s = e as GlitchSpike;
      const r = s.rect;
      if (s.phase === 'warn') {
        c.save();
        c.strokeStyle = PAL.hostile;
        c.globalAlpha = 0.6;
        c.lineWidth = 1;
        c.setLineDash([6, 6]);
        c.beginPath();
        if (r.w < r.h) { c.moveTo(r.x + r.w / 2, r.y); c.lineTo(r.x + r.w / 2, r.y + r.h); } else { c.moveTo(r.x, r.y + r.h / 2); c.lineTo(r.x + r.w, r.y + r.h / 2); }
        c.stroke();
        c.restore();
      } else if (s.phase === 'strike') {
        c.strokeStyle = PAL.hostile;
        glow(c, PAL.hostile, LINE.enemyGlow);
        c.beginPath();
        if (r.w < r.h) {
          const up = s.dir === 'up', base = up ? r.y + r.h : r.y, tip = up ? r.y : r.y + r.h;
          c.moveTo(r.x, base); c.lineTo(r.x + r.w / 2, tip); c.lineTo(r.x + r.w, base);
        } else {
          const left = s.dir === 'left', base = left ? r.x + r.w : r.x, tip = left ? r.x : r.x + r.w;
          c.moveTo(base, r.y); c.lineTo(tip, r.y + r.h / 2); c.lineTo(base, r.y + r.h);
        }
        c.stroke();
        noGlow(c);
        bang(c, s.x, r.y - 20, t, reduced);
      }
    }
  }
}

/** The "!" over a hostile enemy: pulses, or holds steady with reduced motion. */
function bang(c: C, x: number, y: number, t: number, reduced: boolean) {
  c.save();
  c.fillStyle = PAL.hostile;
  c.globalAlpha = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 0.25);
  c.font = `bold 16px ${FONT}`;
  c.textAlign = 'center';
  c.fillText('!', x, y);
  c.restore();
}

export function drawShots(c: C, sim: Sim) {
  c.lineWidth = LINE.shot;
  c.lineCap = 'round';
  for (const s of sim.shots) {
    const col = s.friendly ? PAL.trace : PAL.hostile;
    c.strokeStyle = col;
    glow(c, col, LINE.shotGlow);
    const l = Math.hypot(s.vx, s.vy) || 1, k = 14 / l;
    c.beginPath();
    c.moveTo(s.x - s.vx * k, s.y - s.vy * k);
    c.lineTo(s.x, s.y);
    c.stroke();
  }
  noGlow(c);
  c.lineCap = 'butt';
}

/** The Field Coil: a cyan arc in front of the aim. */
export function drawField(c: C, sim: Sim, x: number, y: number) {
  if (!sim.field.on) return;
  const a = Math.atan2(sim.aim.y, sim.aim.x);
  c.save();
  c.strokeStyle = PAL.trace;
  c.fillStyle = 'rgba(46,242,255,0.08)';
  c.lineWidth = 2;
  glow(c, PAL.trace, 12);
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, FIELD.range, a - FIELD.cone, a + FIELD.cone);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(x, y, FIELD.range, a - FIELD.cone, a + FIELD.cone);
  c.stroke();
  c.restore();
}

/** The drone: a rounded pentagon with a glowing lens that looks along the aim. Blinks after a hit; falls apart on death. */
export function drawDrone(c: C, sim: Sim, x: number, y: number, t: number, reduced: boolean) {
  const d = sim.drone, v = sim.vitals;
  const w = DRONE.w, h = d.h;
  let alpha = 1;
  if (v.iFrames > 0 && !sim.dying) {
    alpha = reduced ? 0.55 + 0.45 * Math.cos((v.iFrames / VITALS.iFrames) * Math.PI * 2) : Math.floor((t / 60) * 10 * 2) % 2 ? 0.25 : 1;
  }
  const pts: [number, number][] = [[-w / 2, -h / 2 + 10], [0, -h / 2], [w / 2, -h / 2 + 10], [w / 2, h / 2], [-w / 2, h / 2]];
  c.save();
  c.globalAlpha = alpha;
  c.lineWidth = LINE.drone;
  c.strokeStyle = PAL.line;
  c.fillStyle = PAL.fill;
  c.lineJoin = 'round';
  if (sim.dying) {
    // falling apart: each edge drifts away from the centre and fades (fades in place with reduced motion)
    const k = 1 - sim.dying / VITALS.deathSteps;
    c.globalAlpha = 1 - k;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, push = reduced ? 0 : k * 60;
      const l = Math.hypot(mx, my) || 1;
      c.beginPath();
      c.moveTo(x + ax + (mx / l) * push, y + ay + (my / l) * push + k * k * 40);
      c.lineTo(x + bx + (mx / l) * push, y + by + (my / l) * push + k * k * 40);
      c.stroke();
    }
    c.restore();
    return;
  }
  c.beginPath();
  pts.forEach(([px, py], i) => (i ? c.lineTo(x + px, y + py) : c.moveTo(x + px, y + py)));
  c.closePath();
  c.fill();
  c.stroke();
  // the lens
  const lx = x + sim.aim.x * 6, ly = y - h / 2 + 18 + sim.aim.y * 4;
  c.fillStyle = PAL.trace;
  glow(c, PAL.trace, LINE.droneGlow);
  c.beginPath();
  c.arc(lx, ly, 5, 0, Math.PI * 2);
  c.fill();
  noGlow(c);
  // dash streak
  if (d.dash) {
    c.strokeStyle = PAL.neon;
    glow(c, PAL.neon, 12);
    c.globalAlpha = 0.6;
    c.beginPath();
    c.moveTo(x - d.dash.dx * 3, y - d.dash.dy * 3);
    c.lineTo(x, y);
    c.stroke();
  }
  c.restore();
}

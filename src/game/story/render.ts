// Drawing the story on top of the room art (polish bar P3/P4: clean line art, glowing traces, amber for things you
// use, cyan for the player's power, magenta for the hostile): terminals, wires and the safety strip, the wall gates,
// ports, panels, benches, levers, plates, doors, the crust, the lift and the bridge, the room's set pieces (the lamp,
// the ALU, the demo board, the Loft's sunset window), the composed places' bench rigs, capstone part, gates, calibration
// ranges, patrol boards and powered traces, the darkness of an unlit room (and the headlamp's cone), TAPEOUT's speech
// bubble, the E prompt, and the boss's bar, log and readings.
import { chipProgress, CHIPS, slotProgress } from '../../chip';
import { findModule } from '../../curriculum';
import { easeOut, FONT, PAL, rgba } from '../render/palette';
import { HZ, TUNING, VIEW_H, VIEW_W } from '../tuning';
import type { Director } from './director';
import type { Station, StationKind, Terminal } from './types';

type C = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
const S = TUNING.story;

function glowLine(c: C, col: string, w: number, a = 0.3) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(col, a);
  c.lineWidth = w + 7;
  c.stroke();
  c.restore();
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
}

function chamfer(c: C, x: number, y: number, w: number, h: number, k = 4) {
  c.beginPath();
  c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k);
  c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k);
  c.closePath();
}

function label(c: C, text: string, x: number, y: number, col: string = rgba(PAL.text, 0.6), size = 11) {
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = col;
  c.fillText(text, x, y);
  c.textAlign = 'start';
}

function dot(c: C, x: number, y: number, r: number, col: string, a = 1) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = rgba(col, a);
  c.fill();
}

/** A soft additive glow disc. */
function halo(c: C, x: number, y: number, r: number, col: string, a: number) {
  if (a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ------------------------------------------------------------------------------------------------ set pieces

/** Everything behind the solids: set pieces, wall gates, wires' wall traces, stations, lamps, the strip. */
export function drawStoryBack(c: C, d: Director, t: number) {
  const room = d.room, rs = d.rs;
  for (const p of room.props2 ?? []) {
    switch (p.kind) {
      case 'lamp': drawCeilingLamp(c, p.x, p.y, rs.passed); break;
      case 'coilgate': drawCoilGate(c, p.x, p.y, rs.fired.has('coil'), t); break;
      case 'sensor': break;
      case 'alu': drawAlu(c, p.x, p.y, p.w!, p.h!, rs.passed, t); break;
      case 'plaque': chamfer(c, p.x - 170, p.y - 20, 340, 30); c.fillStyle = rgba(PAL.fill, 0.9); c.fill(); c.strokeStyle = rgba(PAL.amber, 0.6); c.lineWidth = 1.5; c.stroke(); label(c, 'ALU BIT 0 · ADDS TWO BITS · SUM AND CARRY', p.x, p.y, rgba(PAL.amber, 0.9), 12); break;
      case 'board': drawBoard(c, d, p.x, p.y, p.w!, p.h!, t); break;
      case 'rig': drawRig(c, p.x, p.y, p.w!, p.h!, d, t); break;
      case 'window': drawSunset(c, p.x, p.y, p.w!, p.h!, t); break;
    }
  }
  if (room.lamps) {
    const L = room.lamps;
    for (let i = 0; i < L.n; i++) {
      const x = L.x + i * L.gap, on = i < rs.lamps;
      label(c, `${2 ** (L.n - 1 - i)}`, x, L.y - 26, rgba(PAL.text, 0.45), 10);
      if (on) halo(c, x, L.y, 34, PAL.gold, 0.45);
      c.beginPath();
      c.arc(x, L.y, 12, 0, Math.PI * 2);
      c.fillStyle = on ? rgba(PAL.gold, 0.9) : PAL.fill;
      c.fill();
      c.strokeStyle = on ? PAL.gold : rgba(PAL.idle, 0.8);
      c.lineWidth = 2;
      c.stroke();
    }
    label(c, 'EIGHT LAMPS · EIGHT BITS', L.x + (L.n - 1) * L.gap / 2, L.y + 40, rgba(PAL.text, 0.45));
  }
  const run = room.wire;
  if (run?.gate) drawWallGate(c, run.gate.kind, run.gate.x, run.gate.y, run.terminals, rs.passed, t);
  if (run) drawStrip(c, d, t);
  for (const st of room.stations) drawStation(c, d, st, t);
  if (room.dplates) room.dplates.forEach((p, i) => {
    const on = rs.latched || d.plates[i];
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(on ? PAL.ok : PAL.amber, on ? 0.4 : 0.16 + 0.06 * Math.sin(t * 0.08 + i));
    c.fillRect(p.x, p.y - 2, p.w, p.h + 2);
    c.restore();
    c.strokeStyle = on ? PAL.ok : PAL.amber;
    c.lineWidth = 2;
    c.strokeRect(p.x, p.y - 2, p.w, p.h + 2);
    // the plate's wire runs along the floor to the door
    const door = room.gates.find((g) => g.id === 'door')!.rect;
    c.setLineDash([6, 5]);
    c.lineDashOffset = on ? -t * 0.8 : 0;
    c.strokeStyle = rgba(on ? PAL.ok : PAL.amber, 0.55);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(p.x + p.w / 2, p.y - 2);
    c.lineTo(p.x + p.w / 2, p.y - 30 - i * 10);
    c.lineTo(door.x - 6, p.y - 30 - i * 10);
    c.lineTo(door.x - 6, door.y + door.h - 40);
    c.stroke();
    c.setLineDash([]);
  });
  // a discovery puzzle, a composed arena's boss body, and the powered pulse of a module that just passed
  if (rs.mech) rs.mech.def.draw(c, rs.mech.state, t);
  if (d.form && d.boss) d.form.draw(c, d.form.state(d.boss.hp / d.boss.maxHp, d.boss.shielded, d.boss.enraged > 0), t);
  if (room.role) drawPowered(c, d);
}

/** Steps the powered pulse takes to run its trace. */
const PULSE_STEPS = 50;

/** The powered pulse: a module passed here, so a bright pulse runs from its station up and across to the door, and the
 * trace it leaves stays lit for the rest of the room. */
function drawPowered(c: C, d: Director) {
  const rs = d.rs, st = d.room.stations.find((s) => s.module), door = d.room.gates.find((g) => g.id === 'door')?.rect;
  if (rs.powered < 0 || !st || !door) return;
  const rise = 30, run = Math.abs(door.x - st.x), dir = Math.sign(door.x - st.x) || 1;
  c.save();
  c.setLineDash([6, 5]);
  c.strokeStyle = rgba(PAL.ok, 0.5);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(st.x, st.y); c.lineTo(st.x, st.y - rise); c.lineTo(door.x, st.y - rise);
  c.stroke();
  c.restore();
  const age = rs.t - rs.powered;
  if (age < 0 || age >= PULSE_STEPS) return;
  const dist = (age / PULSE_STEPS) * (rise + run);
  const px = dist <= rise ? st.x : st.x + dir * (dist - rise), py = dist <= rise ? st.y - dist : st.y - rise;
  halo(c, px, py, 24, PAL.ok, 0.8);
  dot(c, px, py, 4, PAL.ok);
}

function drawCeilingLamp(c: C, x: number, y: number, on: boolean) {
  c.strokeStyle = rgba(PAL.line, 0.5);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x, 0); c.lineTo(x, y - 30);
  c.stroke();
  if (on) { halo(c, x, y, 260, PAL.gold, 0.18); halo(c, x, y, 70, PAL.gold, 0.5); }
  c.beginPath();
  c.moveTo(x - 36, y); c.lineTo(x - 18, y - 30); c.lineTo(x + 18, y - 30); c.lineTo(x + 36, y); c.closePath();
  c.fillStyle = PAL.fill;
  c.fill();
  c.strokeStyle = on ? PAL.gold : rgba(PAL.idle, 0.9);
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.arc(x, y + 2, 14, 0, Math.PI);
  c.fillStyle = on ? rgba(PAL.gold, 0.95) : rgba(PAL.idle, 0.25);
  c.fill();
}

function drawCoilGate(c: C, x: number, y: number, done: boolean, t: number) {
  const top = y - 210;
  c.strokeStyle = rgba(done ? PAL.trace : PAL.line, done ? 0.7 : 0.45);
  c.lineWidth = 2;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + s * 60, y); c.lineTo(x + s * 60, top + 30); c.lineTo(x + s * 30, top);
    c.stroke();
    // coil windings
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.ellipse(x + s * 60, top + 60 + i * 20, 10, 5, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.beginPath();
  c.moveTo(x - 30, top); c.lineTo(x + 30, top);
  c.stroke();
  if (!done) {
    // idle arcs between the coils
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(PAL.trace, 0.25 + 0.2 * Math.sin(t * 0.3));
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = top + 80 + ((t * 2 + i * 50) % 120);
      c.moveTo(x - 50, yy);
      for (let k = 1; k <= 5; k++) c.lineTo(x - 50 + k * 20, yy + (((k * 37 + Math.floor(t / 3) * 13) % 17) - 8));
    }
    c.stroke();
    c.restore();
  }
  label(c, 'COIL GATE', x, top - 10, rgba(PAL.text, 0.45));
}

function drawAlu(c: C, x: number, y: number, w: number, h: number, lit: boolean, t: number) {
  const x0 = x - w / 2, y0 = y - h / 2;
  if (lit) halo(c, x, y, w * 0.7, PAL.trace, 0.12);
  chamfer(c, x0, y0, w, h, 10);
  c.fillStyle = PAL.fill;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = lit ? PAL.trace : rgba(PAL.idle, 0.6);
  c.stroke();
  label(c, 'ALU · BIT 0', x, y0 + 26, lit ? PAL.trace : rgba(PAL.idle, 0.8), 14);
  // two inputs, XOR (sum) and AND (carry)
  const col = lit ? PAL.trace : rgba(PAL.idle, 0.6);
  const gate = (gx: number, gy: number, kind: 'XOR' | 'AND') => {
    c.beginPath();
    if (kind === 'AND') { c.moveTo(gx - 22, gy - 18); c.lineTo(gx, gy - 18); c.arc(gx, gy, 18, -Math.PI / 2, Math.PI / 2); c.lineTo(gx - 22, gy + 18); c.closePath(); }
    else { c.moveTo(gx - 22, gy - 18); c.quadraticCurveTo(gx + 6, gy - 18, gx + 20, gy); c.quadraticCurveTo(gx + 6, gy + 18, gx - 22, gy + 18); c.quadraticCurveTo(gx - 10, gy, gx - 22, gy - 18); c.moveTo(gx - 28, gy - 18); c.quadraticCurveTo(gx - 16, gy, gx - 28, gy + 18); }
    c.strokeStyle = col;
    c.lineWidth = 2;
    c.stroke();
  };
  gate(x + 10, y - 20, 'XOR');
  gate(x + 10, y + 50, 'AND');
  c.beginPath();
  c.moveTo(x0 + 30, y - 10); c.lineTo(x - 40, y - 10); c.lineTo(x - 40, y + 40); c.lineTo(x - 12, y + 40);
  c.moveTo(x - 40, y - 28); c.lineTo(x - 12, y - 28);
  c.moveTo(x0 + 30, y + 20); c.lineTo(x - 60, y + 20); c.lineTo(x - 60, y - 12); c.lineTo(x - 12, y - 12);
  c.moveTo(x - 60, y + 60); c.lineTo(x - 12, y + 60); c.moveTo(x - 60, y + 20); c.lineTo(x - 60, y + 60);
  c.moveTo(x + 30, y - 20); c.lineTo(x0 + w - 40, y - 20);
  c.moveTo(x + 28, y + 50); c.lineTo(x0 + w - 40, y + 50);
  c.strokeStyle = rgba(lit ? PAL.trace : PAL.idle, lit ? 0.8 : 0.4);
  c.lineWidth = 1.5;
  c.stroke();
  label(c, 'A', x0 + 18, y - 6, col); label(c, 'B', x0 + 18, y + 24, col);
  label(c, 'SUM', x0 + w - 22, y - 16, col); label(c, 'CARRY', x0 + w - 26, y + 54, col);
  if (lit) {
    const k = (t * 3) % 200;
    halo(c, x0 + 30 + k, y - 10, 14, PAL.trace, 0.6);
  }
}

/** A composed bench's rig: one monitor per module (three at most, side by side), each showing its title and its verdict. */
function drawBenchRig(c: C, x: number, y: number, w: number, h: number, d: Director, t: number) {
  const x0 = x - w / 2, y0 = y - h / 2;
  const mods = d.room.modules.slice(0, 3), slot = w / mods.length;
  mods.forEach((m, i) => {
    const mx = x0 + i * slot + 10, mw = slot - 20, done = d.kitDone(m);
    const title = `// ${findModule(m)?.module.title ?? m}`;
    chamfer(c, mx, y0, mw, h, 6);
    c.fillStyle = rgba('#0E0C22', 0.95);
    c.fill();
    c.strokeStyle = done ? PAL.ok : rgba(PAL.trace, 0.6);
    c.lineWidth = 2;
    c.stroke();
    // the title shrinks to fit the monitor, and anything past its edge is cut
    let size = 12;
    c.font = `${size}px ${FONT}`;
    while (size > 9 && c.measureText(title).width > mw - 28) { size--; c.font = `${size}px ${FONT}`; }
    const verdict = done ? '// PASS' : '// write me';
    c.save();
    c.beginPath();
    c.rect(mx + 2, y0 + 2, mw - 4, h - 4);
    c.clip();
    c.fillStyle = rgba(PAL.trace, 0.85);
    c.fillText(title, mx + 14, y0 + 24);
    c.fillStyle = done ? PAL.ok : rgba(PAL.trace, 0.85);
    c.fillText(verdict, mx + 14, y0 + 42);
    if (!done && Math.floor(t / 30) % 2) c.fillRect(mx + 14 + c.measureText(verdict).width + 4, y0 + 42 - 11, 7, 13);
    c.restore();
  });
  if (d.room.role === 'bench' && d.room.upgrade) drawCapstone(c, d, x, y0, t);
}

/** The capstone's part: a chip the bench fits. It hovers over the rig until its module passes, then flies into the drone. */
function drawCapstone(c: C, d: Director, x: number, top: number, t: number) {
  const rs = d.rs;
  if (rs.partFly < 0 && d.room.modules.every((m) => d.kitDone(m))) return; // already fitted
  let px = x, py = top - 40, s = 1;
  if (rs.partFly >= 0) {
    const k = (rs.t - rs.partFly) / 60;
    if (k >= 1) return;
    const e = easeOut(k), dr = d.sim.drone;
    px += (dr.x - px) * e;
    py += (dr.y - py) * e;
    s = 1 - 0.7 * e;
  }
  c.save();
  c.translate(px, py);
  c.scale(s, s);
  halo(c, 0, 0, 46 + 6 * Math.sin(t * 0.1), PAL.gold, 0.2 + 0.12 * Math.sin(t * 0.1));
  chamfer(c, -26, -18, 52, 36, 5);
  c.fillStyle = PAL.fill;
  c.fill();
  c.strokeStyle = PAL.gold;
  c.lineWidth = 2;
  c.stroke();
  // four pins a side
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const u = -18 + i * 12, v = -12 + i * 8;
    c.moveTo(u, -18); c.lineTo(u, -26); c.moveTo(u, 18); c.lineTo(u, 26);
    c.moveTo(-26, v); c.lineTo(-34, v); c.moveTo(26, v); c.lineTo(34, v);
  }
  c.strokeStyle = rgba(PAL.gold, 0.8);
  c.lineWidth = 2;
  c.stroke();
  chamfer(c, -9, -8, 18, 16, 2);
  c.strokeStyle = rgba(PAL.trace, 0.8);
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();
}

function drawRig(c: C, x: number, y: number, w: number, h: number, d: Director, t: number) {
  if (d.room.role) { drawBenchRig(c, x, y, w, h, d, t); return; }
  const x0 = x - w / 2, y0 = y - h / 2;
  // two monitors over the benches, showing each module's state
  const mods = ['gates', 'half-adder-v'];
  mods.forEach((m, i) => {
    const mx = x0 + 20 + i * (w / 2), done = d.kitDone(m);
    chamfer(c, mx, y0, w / 2 - 40, h, 6);
    c.fillStyle = rgba('#0E0C22', 0.95);
    c.fill();
    c.strokeStyle = done ? PAL.ok : rgba(PAL.trace, 0.6);
    c.lineWidth = 2;
    c.stroke();
    c.font = `12px ${FONT}`;
    c.fillStyle = rgba(done ? PAL.ok : PAL.trace, 0.85);
    const lines = m === 'gates'
      ? ['module gates(', '  input a, b,', '  output y_and, y_or', ');', done ? '// PASS' : '// write me']
      : ['module half_adder(', '  input a, b,', '  output sum, carry', ');', done ? '// PASS' : '// write me'];
    lines.forEach((l, k) => c.fillText(l, mx + 14, y0 + 24 + k * 18));
    if (!done && Math.floor(t / 30) % 2) c.fillRect(mx + 14 + c.measureText(lines[4]).width + 4, y0 + 24 + 4 * 18 - 11, 7, 13);
  });
}

function drawSunset(c: C, x: number, y: number, w: number, h: number, t: number) {
  const x0 = x - w / 2, y0 = y - h / 2;
  c.save();
  chamfer(c, x0, y0, w, h, 10);
  c.clip();
  const sky = c.createLinearGradient(0, y0, 0, y0 + h);
  sky.addColorStop(0, '#1A0B3A');
  sky.addColorStop(0.55, '#5A1E6E');
  sky.addColorStop(0.75, '#C2306E');
  sky.addColorStop(1, '#2A0C3C');
  c.fillStyle = sky;
  c.fillRect(x0, y0, w, h);
  const hz = y0 + h * 0.72;
  // the sun, cut by stripes
  const sun = c.createLinearGradient(0, hz - 120, 0, hz);
  sun.addColorStop(0, '#FFD23F');
  sun.addColorStop(1, '#FF3EC8');
  c.fillStyle = sun;
  c.beginPath();
  c.arc(x, hz, 110, Math.PI, 0);
  c.fill();
  c.fillStyle = '#5A1E6E';
  for (let i = 0; i < 6; i++) c.fillRect(x - 120, hz - 10 - i * 14, 240, 2 + i * 0.6);
  // mountains
  c.fillStyle = '#140A2E';
  c.beginPath();
  c.moveTo(x0, hz);
  const peaks = [0, 0.08, 0.16, 0.27, 0.36, 0.5, 0.62, 0.71, 0.83, 0.92, 1];
  peaks.forEach((p, i) => c.lineTo(x0 + p * w, hz - (i % 2 ? 40 + ((i * 29) % 30) : 8)));
  c.lineTo(x0 + w, hz);
  c.fill();
  // the grid floor, scrolling toward the viewer
  c.fillStyle = '#0B0620';
  c.fillRect(x0, hz, w, y0 + h - hz);
  c.strokeStyle = rgba(PAL.neon, 0.7);
  c.lineWidth = 1;
  c.beginPath();
  for (let i = -12; i <= 12; i++) { c.moveTo(x + i * 18, hz); c.lineTo(x + i * 120, y0 + h); }
  const off = (t * 0.6) % 1;
  for (let k = 0; k < 8; k++) {
    const f = (k + off) / 8, yy = hz + (y0 + h - hz) * f * f;
    c.moveTo(x0, yy); c.lineTo(x0 + w, yy);
  }
  c.stroke();
  c.restore();
  chamfer(c, x0, y0, w, h, 10);
  c.strokeStyle = rgba(PAL.line, 0.7);
  c.lineWidth = 3;
  c.stroke();
  // window mullions
  c.beginPath();
  c.moveTo(x0 + w / 3, y0); c.lineTo(x0 + w / 3, y0 + h);
  c.moveTo(x0 + (2 * w) / 3, y0); c.lineTo(x0 + (2 * w) / 3, y0 + h);
  c.strokeStyle = rgba(PAL.line, 0.35);
  c.lineWidth = 2;
  c.stroke();
}

/** The demo board: a big line-art PCB with two switches, the sum and carry lights, its chips, and its shield. */
function drawBoard(c: C, d: Director, x: number, y: number, w: number, h: number, t: number) {
  const b = d.boss, x0 = x - w / 2, y0 = y - h / 2;
  const beaten = !b || b.phase === 'done';
  const enraged = !!b && b.enraged > 0;
  const red = enraged ? PAL.hostile : PAL.neon;
  if (beaten) halo(c, x, y, w * 0.8, PAL.gold, 0.14);
  chamfer(c, x0, y0, w, h, 14);
  c.fillStyle = '#121030';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = beaten ? PAL.gold : rgba(red, 0.55 + 0.25 * Math.sin(t * (enraged ? 0.4 : 0.08)));
  c.stroke();
  // traces and chips
  c.strokeStyle = rgba(beaten ? PAL.gold : PAL.idle, beaten ? 0.7 : 0.45);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x0 + 70, y0 + 90); c.lineTo(x - 70, y0 + 90); c.lineTo(x - 70, y - 20);
  c.moveTo(x0 + 70, y0 + 200); c.lineTo(x - 90, y0 + 200); c.lineTo(x - 90, y + 30);
  c.moveTo(x + 40, y - 30); c.lineTo(x0 + w - 110, y - 30); c.lineTo(x0 + w - 110, y0 + 90);
  c.moveTo(x + 40, y + 40); c.lineTo(x0 + w - 90, y + 40); c.lineTo(x0 + w - 90, y0 + 200);
  c.stroke();
  for (const [cx, cy, name] of [[x - 30, y - 30, 'XOR'], [x - 30, y + 40, 'AND']] as [number, number, string][]) {
    chamfer(c, cx - 36, cy - 22, 72, 44, 4);
    c.fillStyle = PAL.fill;
    c.fill();
    c.strokeStyle = rgba(beaten ? PAL.gold : PAL.line, 0.8);
    c.lineWidth = 1.5;
    c.stroke();
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx - 28 + i * 18, cy - 22); c.lineTo(cx - 28 + i * 18, cy - 30); c.moveTo(cx - 28 + i * 18, cy + 22); c.lineTo(cx - 28 + i * 18, cy + 30); c.stroke(); }
    label(c, name, cx, cy + 4, rgba(PAL.text, 0.7), 12);
  }
  // switches A and B
  for (const [i, sy] of [[0, y0 + 90], [1, y0 + 200]] as [number, number][]) {
    chamfer(c, x0 + 30, sy - 16, 40, 32, 4);
    c.strokeStyle = rgba(PAL.amber, 0.8);
    c.lineWidth = 1.5;
    c.stroke();
    label(c, i ? 'B' : 'A', x0 + 50, sy + 5, PAL.amber, 13);
  }
  // the two lights: sum (it works) and carry (dark, the symptom)
  const lights: [string, number, boolean][] = [['SUM', y0 + 90, true], ['CARRY', y0 + 200, beaten]];
  for (const [name, ly, on] of lights) {
    const lx = x0 + w - 60;
    if (on) halo(c, lx, ly, 46, beaten ? PAL.gold : PAL.trace, 0.5);
    dot(c, lx, ly, 15, on ? (beaten ? PAL.gold : PAL.trace) : '#000000', on ? 0.95 : 0.6);
    c.beginPath();
    c.arc(lx, ly, 15, 0, Math.PI * 2);
    c.strokeStyle = on ? PAL.text : rgba(red, 0.7);
    c.lineWidth = 2;
    c.stroke();
    label(c, name, lx, ly + 34, rgba(PAL.text, 0.6));
  }
  if (!d.bossBar) label(c, 'DEMO BOARD · HALF ADDER', x, y0 - 12, rgba(PAL.text, 0.55), 12); // the boss bar names it during the fight
  // the shield: a hex lattice, flickering; gone once the right fix is in
  if (b && b.shielded && b.phase !== 'done') {
    c.save();
    chamfer(c, x0 - 10, y0 - 10, w + 20, h + 20, 18);
    c.clip();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(red, 0.16 + 0.08 * Math.sin(t * 0.2));
    c.lineWidth = 1.5;
    c.beginPath();
    const R = 22;
    for (let row = 0; row * R * 1.5 < h + 40; row++) {
      for (let col = 0; col * R * 1.73 < w + 40; col++) {
        const hx = x0 - 10 + col * R * 1.73 + (row % 2) * R * 0.87, hy = y0 - 10 + row * R * 1.5;
        for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; (k ? c.lineTo : c.moveTo).call(c, hx + Math.cos(a) * R * 0.95, hy + Math.sin(a) * R * 0.95); }
      }
    }
    c.stroke();
    c.restore();
  }
  // damage: cracks as health drops
  if (b && b.phase !== 'pager') {
    const k = 1 - b.hp / b.maxHp;
    c.strokeStyle = rgba(PAL.text, 0.6);
    c.lineWidth = 1.5;
    c.beginPath();
    const cracks = [[0.3, 0.2], [0.7, 0.6], [0.5, 0.85], [0.15, 0.7], [0.85, 0.25]];
    cracks.slice(0, Math.floor(k * 6)).forEach(([u, v], i) => {
      let px = x0 + u * w, py = y0 + v * h;
      c.moveTo(px, py);
      for (let s = 0; s < 4; s++) { px += ((i * 13 + s * 7) % 11) * 4 - 20; py += ((i * 5 + s * 11) % 9) * 4 - 16; c.lineTo(px, py); }
    });
    c.stroke();
  }
}

function drawWallGate(c: C, kind: 'NOT' | 'AND', x: number, y: number, terms: Terminal[], lit: boolean, t: number) {
  const col = lit ? PAL.trace : PAL.line;
  // the gate symbol, big, on a wall plate
  chamfer(c, x - 80, y - 60, 160, 120, 8);
  c.fillStyle = rgba(PAL.fill, 0.9);
  c.fill();
  c.strokeStyle = rgba(col, 0.5);
  c.lineWidth = 1.5;
  c.stroke();
  c.beginPath();
  if (kind === 'NOT') { c.moveTo(x - 30, y - 30); c.lineTo(x + 26, y); c.lineTo(x - 30, y + 30); c.closePath(); c.moveTo(x + 40, y); c.arc(x + 33, y, 7, 0, Math.PI * 2); }
  else { c.moveTo(x - 34, y - 30); c.lineTo(x, y - 30); c.arc(x, y, 30, -Math.PI / 2, Math.PI / 2); c.lineTo(x - 34, y + 30); c.closePath(); }
  glowLine(c, col, 2.5, lit ? 0.35 : 0.1);
  label(c, kind, x - 4, y + 5, rgba(col, 0.9), 14);
  // its pins run down the wall to their floor terminals
  c.strokeStyle = rgba(col, 0.45);
  c.lineWidth = 1.5;
  c.beginPath();
  for (const tm of terms.filter((q) => q.role === 'gate')) {
    const out = tm.pin === 'g.y';
    const py = kind === 'NOT' || out ? y : tm.pin === 'g.a' ? y - 16 : y + 16;
    const px = out ? x + (kind === 'NOT' ? 40 : 30) : x - 34;
    c.moveTo(px, py);
    c.lineTo(out ? px + 18 : px - 18, py);
    c.lineTo(out ? px + 18 : px - 18, y + 70);
    c.lineTo(tm.x, y + 70);
    c.lineTo(tm.x, tm.y - 40);
  }
  c.stroke();
  void t;
}

/** The safety strip: one lamp per truth-table row; it ticks through them when the loop closes. */
function drawStrip(c: C, d: Director, t: number) {
  const run = d.room.wire!, rs = d.rs;
  const rows = d.stripRows();
  const n = rows.length, gap = 64, w = n * gap + 24, x0 = run.strip.x - w / 2, y0 = run.strip.y - 34;
  chamfer(c, x0, y0, w, 74, 6);
  c.fillStyle = rgba('#0E0C22', 0.92);
  c.fill();
  c.strokeStyle = rgba(rs.passed ? PAL.ok : PAL.amber, 0.7);
  c.lineWidth = 1.5;
  c.stroke();
  label(c, rs.passed ? 'SAFETY CHECK · PASSED' : 'SAFETY CHECK', run.strip.x, y0 - 8, rgba(rs.passed ? PAL.ok : PAL.amber, 0.85));
  rows.forEach((r, i) => {
    const cx = x0 + 12 + gap * i + gap / 2;
    const st = rs.strip;
    const state = rs.passed ? 'ok' : st ? (i < st.shown ? (st.rows[i] ? 'ok' : 'bad') : i === st.shown ? 'cur' : 'idle') : rs.spark > 0 && i === d.failRow ? 'bad' : 'idle';
    const col = state === 'ok' ? PAL.ok : state === 'bad' ? PAL.hostile : state === 'cur' ? PAL.text : PAL.idle;
    if (state === 'ok' || state === 'bad') halo(c, cx, y0 + 22, 22, col, 0.4);
    dot(c, cx, y0 + 22, 8, col, state === 'idle' ? 0.35 : 0.95);
    label(c, r.ins, cx, y0 + 50, rgba(PAL.text, 0.55), 10);
    label(c, `→ ${r.out}`, cx, y0 + 64, rgba(PAL.text, 0.75), 10);
  });
  void t;
}

function drawStation(c: C, d: Director, st: Station, t: number) {
  const x = st.x, y = st.y;
  switch (st.kind) {
    case 'port': {
      const done = !!st.module && d.kitDone(st.module);
      chamfer(c, x - 34, y - 170, 68, 90, 6);
      c.fillStyle = PAL.fill;
      c.fill();
      c.strokeStyle = done ? PAL.ok : PAL.amber;
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.arc(x, y - 125, 16, 0, Math.PI * 2);
      glowLine(c, done ? PAL.ok : PAL.amber, 2, 0.15 + 0.15 * Math.sin(t * 0.1));
      for (let i = 0; i < 3; i++) dot(c, x - 6 + i * 6, y - 125, 2, done ? PAL.ok : PAL.amber);
      c.beginPath();
      c.moveTo(x, y - 80); c.lineTo(x, y);
      c.strokeStyle = rgba(PAL.line, 0.35);
      c.lineWidth = 3;
      c.stroke();
      label(c, st.label, x, y - 184, rgba(PAL.text, 0.55));
      break;
    }
    case 'panel': {
      const done = d.kitDone(st.module!);
      chamfer(c, x - 70, y - 210, 140, 150, 8);
      c.fillStyle = PAL.fill;
      c.fill();
      c.strokeStyle = done ? PAL.ok : PAL.amber;
      c.lineWidth = 2;
      c.stroke();
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.arc(x - 48 + k * 24, y - 180 + r * 28, 6, 0, Math.PI * 2);
        c.strokeStyle = rgba(done ? PAL.ok : PAL.amber, 0.7);
        c.lineWidth = 1.5;
        c.stroke();
      }
      c.beginPath();
      c.moveTo(x - 48, y - 180); c.bezierCurveTo(x - 30, y - 130, x + 10, y - 170, x + 24, y - 124);
      c.moveTo(x - 24, y - 152); c.bezierCurveTo(x - 10, y - 110, x + 30, y - 120, x + 48, y - 96);
      glowLine(c, done ? PAL.ok : rgba(PAL.trace, 0.6), 2, 0.12);
      c.beginPath();
      c.moveTo(x - 20, y - 60); c.lineTo(x - 20, y); c.moveTo(x + 20, y - 60); c.lineTo(x + 20, y);
      c.strokeStyle = rgba(PAL.line, 0.4);
      c.lineWidth = 3;
      c.stroke();
      label(c, st.label, x, y - 224, rgba(PAL.text, 0.55));
      break;
    }
    case 'bench': {
      const done = d.kitDone(st.module!);
      c.beginPath();
      c.moveTo(x - 90, y - 70); c.lineTo(x + 90, y - 70);
      c.moveTo(x - 80, y - 70); c.lineTo(x - 80, y); c.moveTo(x + 80, y - 70); c.lineTo(x + 80, y);
      glowLine(c, done ? PAL.ok : PAL.amber, 2, 0.12);
      chamfer(c, x - 40, y - 118, 80, 44, 4);
      c.fillStyle = '#0E0C22';
      c.fill();
      c.strokeStyle = done ? PAL.ok : PAL.amber;
      c.lineWidth = 1.5;
      c.stroke();
      label(c, done ? 'PASS' : '_', x, y - 92, done ? PAL.ok : rgba(PAL.amber, 0.5 + 0.5 * (Math.floor(t / 30) % 2)), 12);
      label(c, st.label, x, y - 130, rgba(PAL.text, 0.55));
      break;
    }
    case 'lever': {
      const on = !!d.rs.levers[st.id], passed = d.rs.passed;
      if (!passed) break; // drawn as a terminal until the check passes
      const a = on ? -0.6 : 0.6;
      c.beginPath();
      c.moveTo(x, y - 60); c.lineTo(x + Math.sin(a) * 34, y - 60 - Math.cos(a) * 34);
      glowLine(c, on ? PAL.ok : PAL.amber, 3, 0.2);
      dot(c, x + Math.sin(a) * 34, y - 60 - Math.cos(a) * 34, 6, on ? PAL.ok : PAL.amber);
      label(c, on ? 'ON' : 'OFF', x, y - 108, on ? PAL.ok : PAL.amber, 12);
      break;
    }
    case 'node': drawNode(c, d, st, t); break;
    case 'debug': {
      const live = !!d.boss && d.boss.phase === 'investigate';
      chamfer(c, x - 60, y - 90, 120, 90, 8);
      c.fillStyle = PAL.fill;
      c.fill();
      c.strokeStyle = live ? PAL.amber : rgba(PAL.idle, 0.6);
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.rect(x - 30, y - 70, 60, 34);
      c.strokeStyle = rgba(live ? PAL.amber : PAL.idle, 0.8);
      c.stroke();
      if (live) label(c, 'DIAGNOSE', x, y - 48, rgba(PAL.amber, 0.6 + 0.4 * Math.sin(t * 0.1)), 11);
      label(c, st.label, x, y - 102, rgba(PAL.text, 0.55));
      break;
    }
    default: drawLoftStation(c, d, st, t);
  }
}

function drawNode(c: C, d: Director, st: Station, t: number) {
  const b = d.boss, x = st.x, y = st.y;
  const read = !!b && b.inv.notes.has(st.arg!);
  const live = !!b && b.phase === 'investigate';
  const col = read ? PAL.ok : live ? PAL.trace : PAL.idle;
  c.beginPath();
  c.moveTo(x, y); c.lineTo(x, y - 24);
  c.strokeStyle = rgba(PAL.line, 0.5);
  c.lineWidth = 3;
  c.stroke();
  chamfer(c, x - 16, y - 74, 32, 50, 5);
  c.fillStyle = PAL.fill;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = col;
  c.stroke();
  if (live && !read) halo(c, x, y - 50, 26, PAL.trace, 0.15 + 0.1 * Math.sin(t * 0.12 + x));
  dot(c, x, y - 50, read ? 5 : 4, col, 0.9);
  label(c, st.label, x, y - 84, rgba(col, 0.85), 10);
}

/** Name-label heights above a Loft or composed station's foot (the rest sit at 186); director.ts's STATION_TOP matches. */
const LOFT_TOP: Partial<Record<StationKind, number>> = { board: 264, map: 216, archive: 236, interview: 236, arcade: 236, lift: 236, gate: 184, calib: 236, patrol: 236 };

function drawLoftStation(c: C, d: Director, st: Station, t: number) {
  const x = st.x, y = st.y, col = PAL.amber;
  c.lineWidth = 2;
  c.strokeStyle = col;
  switch (st.kind) {
    case 'archive':
      for (let i = 0; i < 4; i++) { chamfer(c, x - 70, y - 220 + i * 52, 140, 44, 4); c.fillStyle = PAL.fill; c.fill(); c.stroke(); for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x - 58 + k * 22, y - 214 + i * 52); c.lineTo(x - 58 + k * 22, y - 182 + i * 52); c.strokeStyle = rgba(PAL.line, 0.4); c.stroke(); c.strokeStyle = col; } }
      break;
    case 'review':
      c.beginPath(); c.moveTo(x - 70, y - 64); c.lineTo(x + 70, y - 64); c.moveTo(x - 60, y - 64); c.lineTo(x - 60, y); c.moveTo(x + 60, y - 64); c.lineTo(x + 60, y); c.stroke();
      for (let i = 0; i < 3; i++) { chamfer(c, x - 40 + i * 6, y - 96 + i * 6, 56, 30, 3); c.fillStyle = PAL.fill; c.fill(); c.stroke(); }
      break;
    case 'board':
      chamfer(c, x - 90, y - 250, 180, 130, 6); c.fillStyle = '#0F1A1A'; c.fill(); c.stroke();
      c.font = `13px ${FONT}`; c.fillStyle = rgba(PAL.text, 0.7);
      c.fillText('V = I × R', x - 70, y - 214); c.fillText('1 V = 1 A × 1 Ω', x - 70, y - 190); c.fillText('P = V × I', x - 70, y - 166);
      c.beginPath(); c.moveTo(x - 60, y - 120); c.lineTo(x - 70, y); c.moveTo(x + 60, y - 120); c.lineTo(x + 70, y); c.strokeStyle = rgba(PAL.line, 0.4); c.stroke();
      break;
    case 'map': drawMapTable(c, x, y, t); break;
    case 'crt':
      chamfer(c, x - 60, y - 170, 120, 96, 10); c.fillStyle = PAL.fill; c.fill(); c.stroke();
      chamfer(c, x - 48, y - 160, 96, 70, 14); c.fillStyle = '#062018'; c.fill(); c.strokeStyle = rgba(PAL.ok, 0.6); c.stroke();
      c.font = `11px ${FONT}`; c.fillStyle = rgba(PAL.ok, 0.8); c.fillText('$ tapeout', x - 38, y - 136); if (Math.floor(t / 30) % 2) c.fillRect(x - 38, y - 126, 7, 11);
      c.beginPath(); c.moveTo(x - 70, y - 74); c.lineTo(x + 70, y - 74); c.moveTo(x - 60, y - 74); c.lineTo(x - 60, y); c.moveTo(x + 60, y - 74); c.lineTo(x + 60, y); c.strokeStyle = col; c.stroke();
      break;
    case 'arcade':
      c.beginPath(); c.moveTo(x - 40, y); c.lineTo(x - 40, y - 200); c.lineTo(x - 20, y - 230); c.lineTo(x + 40, y - 230); c.lineTo(x + 40, y); c.closePath(); c.fillStyle = PAL.fill; c.fill(); c.strokeStyle = PAL.neon; c.stroke();
      chamfer(c, x - 30, y - 200, 60, 56, 6); c.fillStyle = '#10051F'; c.fill(); c.stroke();
      halo(c, x, y - 172, 30, PAL.neon, 0.2 + 0.1 * Math.sin(t * 0.15));
      label(c, 'PLAY', x, y - 168, PAL.neon, 12);
      dot(c, x - 10, y - 120, 5, PAL.gold); dot(c, x + 12, y - 120, 5, PAL.trace);
      break;
    case 'interview':
      chamfer(c, x - 46, y - 210, 92, 210, 6); c.fillStyle = PAL.fill; c.fill(); c.strokeStyle = rgba(PAL.idle, 0.8); c.stroke();
      dot(c, x + 30, y - 100, 4, PAL.hostile, 0.9);
      label(c, 'LOCKED', x, y - 220, rgba(PAL.hostile, 0.8), 11);
      break;
    case 'gate': {
      // the gate terminal: a tall frame on the floor, its padlock springing open once the module passes
      const done = !!st.module && d.kitDone(st.module), k = done ? PAL.ok : PAL.amber;
      if (done) halo(c, x, y - 60, 70, PAL.ok, 0.18);
      chamfer(c, x - 38, y - 110, 76, 110, 6);
      c.fillStyle = PAL.fill;
      c.fill();
      c.strokeStyle = k;
      c.stroke();
      c.beginPath();
      if (done) { c.arc(x - 2, y - 74, 10, Math.PI, 0); c.moveTo(x + 8, y - 74); c.lineTo(x + 8, y - 54); c.moveTo(x - 12, y - 74); c.lineTo(x - 12, y - 68); }
      else { c.arc(x, y - 66, 10, Math.PI, 0); c.moveTo(x - 10, y - 66); c.lineTo(x - 10, y - 54); c.moveTo(x + 10, y - 66); c.lineTo(x + 10, y - 54); }
      c.stroke();
      chamfer(c, x - 16, y - 54, 32, 26, 3);
      c.fillStyle = '#0E0C22';
      c.fill();
      c.stroke();
      dot(c, x, y - 44, 3, k);
      break;
    }
    case 'calib': {
      // the calibration range: a small bench with three ring targets above it, lit once the module passes
      const done = !!st.module && d.kitDone(st.module), k = done ? PAL.ok : PAL.amber;
      c.beginPath();
      c.moveTo(x - 90, y - 60); c.lineTo(x + 90, y - 60); c.moveTo(x - 80, y - 60); c.lineTo(x - 80, y); c.moveTo(x + 80, y - 60); c.lineTo(x + 80, y);
      glowLine(c, k, 2, 0.12);
      if (done) halo(c, x, y - 110, 60, PAL.ok, 0.2);
      for (const dx of [-50, 0, 50]) {
        const tx = x + dx, ty = y - 110;
        c.beginPath();
        c.moveTo(tx, ty + 22); c.lineTo(tx, y - 60);
        c.strokeStyle = rgba(PAL.line, 0.35);
        c.lineWidth = 2;
        c.stroke();
        for (const r of [22, 14, 6]) {
          c.beginPath();
          c.arc(tx, ty, r, 0, Math.PI * 2);
          c.strokeStyle = rgba(k, r === 6 ? 0.95 : 0.6);
          c.lineWidth = 1.5;
          c.stroke();
        }
        dot(c, tx, ty, 2, k);
      }
      break;
    }
    case 'patrol': {
      // the patrol board: a corkboard in a chamfered frame, five pins joined by a dashed route
      const done = !!st.module && d.kitDone(st.module), k = done ? PAL.ok : PAL.amber;
      c.beginPath();
      c.moveTo(x - 40, y - 84); c.lineTo(x - 40, y); c.moveTo(x + 40, y - 84); c.lineTo(x + 40, y);
      c.strokeStyle = rgba(PAL.line, 0.4);
      c.lineWidth = 3;
      c.stroke();
      chamfer(c, x - 72, y - 212, 144, 128, 8);
      c.fillStyle = PAL.fill;
      c.fill();
      c.strokeStyle = k;
      c.lineWidth = 2;
      c.stroke();
      for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) dot(c, x - 60 + i * 15 + (j % 2) * 7, y - 196 + j * 18, 1.2, PAL.amber, 0.14);
      const pins: [number, number][] = [[-48, -184], [-18, -150], [16, -190], [46, -146], [-6, -106]];
      c.beginPath();
      pins.forEach(([px, py], i) => { if (i) c.lineTo(x + px, y + py); else c.moveTo(x + px, y + py); });
      c.setLineDash([5, 4]);
      c.strokeStyle = rgba(k, 0.8);
      c.lineWidth = 1.5;
      c.stroke();
      c.setLineDash([]);
      for (const [px, py] of pins) { halo(c, x + px, y + py, 12, k, 0.3); dot(c, x + px, y + py, 4, k); }
      break;
    }
    case 'lift':
      c.beginPath(); c.moveTo(x - 60, y); c.lineTo(x - 60, y - 220); c.lineTo(x + 60, y - 220); c.lineTo(x + 60, y);
      glowLine(c, PAL.trace, 2, 0.1);
      c.beginPath(); c.moveTo(x - 50, y - 4); c.lineTo(x + 50, y - 4);
      glowLine(c, PAL.trace, 3, 0.2);
      if (d.room.id === 'workbench' && !d.kitDone('half-adder-v')) label(c, 'NO POWER', x, y - 110, rgba(PAL.hostile, 0.8), 11);
      break;
  }
  label(c, st.label, x, y - (LOFT_TOP[st.kind] ?? 186), rgba(PAL.text, 0.55));
}

/** The Chip Map table: the 8-bit chip's floorplan, blocks lit by progress (read from records, never stored). */
function drawMapTable(c: C, x: number, y: number, t: number) {
  c.beginPath();
  c.moveTo(x - 100, y - 60); c.lineTo(x + 100, y - 60); c.moveTo(x - 90, y - 60); c.lineTo(x - 90, y); c.moveTo(x + 90, y - 60); c.lineTo(x + 90, y);
  c.strokeStyle = PAL.amber;
  c.lineWidth = 2;
  c.stroke();
  // a hologram of the chip floating over the table
  const chip = CHIPS[0];
  const bw = 34, gap = 6, blocks = chip.blocks.slice(0, 8);
  const x0 = x - ((bw + gap) * 4 - gap) / 2, y0 = y - 200;
  c.save();
  c.globalCompositeOperation = 'lighter';
  blocks.forEach((bl, i) => {
    const bx = x0 + (i % 4) * (bw + gap), by = y0 + Math.floor(i / 4) * (bw + gap);
    const lit = bl.slots.filter((s) => slotProgress(s).state === 'built').length / bl.slots.length;
    const half = bl.slots.some((s) => slotProgress(s).state !== 'empty');
    c.strokeStyle = rgba(PAL.trace, 0.35 + 0.2 * Math.sin(t * 0.05 + i));
    c.lineWidth = 1.5;
    c.strokeRect(bx, by, bw, bw);
    if (half) { c.fillStyle = rgba(PAL.trace, 0.2 + 0.5 * lit); c.fillRect(bx + 3, by + 3, (bw - 6) * Math.max(0.25, lit), bw - 6); }
  });
  c.restore();
  const p = chipProgress(chip);
  label(c, `${chip.id} · ${p.built} of ${p.total} parts built`, x, y - 70, rgba(PAL.trace, 0.8), 11);
}

// ------------------------------------------------------------------------------------------------ in front

/** Gates, terminals and wires: in front of the solids, behind the drone. */
export function drawStoryFront(c: C, d: Director, t: number, droneHand: Pt) {
  const room = d.room, rs = d.rs;
  for (const g of room.gates) {
    const s = rs.gates.get(g.id)!;
    const r = s.m.rect;
    switch (g.kind) {
      case 'door': case 'shutter':
        if (s.open >= 1) break;
        c.save();
        c.beginPath();
        c.rect(s.m.home.x - 2, s.m.home.y, s.m.home.w + 4, s.m.home.h);
        c.clip();
        c.fillStyle = PAL.fill;
        c.fillRect(r.x, r.y, r.w, r.h);
        c.strokeStyle = rgba(PAL.amber, 0.5);
        c.lineWidth = 3;
        c.beginPath();
        if (g.kind === 'door') for (let yy = r.y - r.w; yy < r.y + r.h; yy += 18) { c.moveTo(r.x, yy + r.w); c.lineTo(r.x + r.w, yy); }
        else for (let yy = r.y + 10; yy < r.y + r.h; yy += 16) { c.moveTo(r.x + 4, yy); c.lineTo(r.x + r.w - 4, yy); }
        c.stroke();
        c.strokeStyle = s.opening ? PAL.ok : PAL.amber;
        c.lineWidth = 2;
        c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
        c.restore();
        dot(c, s.m.home.x + s.m.home.w / 2, s.m.home.y - 12, 5, s.opening ? PAL.ok : PAL.hostile, 0.9);
        break;
      case 'crust': {
        if (s.open >= 1) break;
        const k = 1 - s.hp / S.crustHp;
        c.beginPath();
        // a jagged violet crust: an X-state wall
        const n = 9;
        c.moveTo(r.x, r.y);
        for (let i = 0; i <= n; i++) c.lineTo(r.x + r.w + ((i % 2) * 8 - 4), r.y + (r.h / n) * i);
        c.lineTo(r.x, r.y + r.h);
        for (let i = n; i >= 0; i--) c.lineTo(r.x - ((i % 2) * 8 - 4), r.y + (r.h / n) * i);
        c.closePath();
        c.fillStyle = rgba('#1E1240', 0.95);
        c.fill();
        glowLine(c, PAL.x, 2, 0.25 + 0.1 * Math.sin(t * 0.1));
        label(c, 'X', r.x + r.w / 2, r.y + r.h / 2 + 8, rgba(PAL.x, 0.95), 26);
        if (k > 0) {
          c.strokeStyle = rgba(PAL.text, 0.7);
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(r.x + 6, r.y + r.h * 0.2); c.lineTo(r.x + r.w * 0.6, r.y + r.h * 0.45); c.lineTo(r.x + r.w - 6, r.y + r.h * 0.4);
          if (k > 0.45) { c.moveTo(r.x + r.w * 0.6, r.y + r.h * 0.45); c.lineTo(r.x + r.w * 0.3, r.y + r.h * 0.8); c.lineTo(r.x + r.w * 0.7, r.y + r.h - 6); }
          c.stroke();
        }
        break;
      }
      case 'lift': {
        c.beginPath();
        c.rect(r.x, r.y, r.w, r.h);
        c.fillStyle = PAL.fill;
        c.fill();
        glowLine(c, rs.passed ? PAL.trace : PAL.amber, 2, rs.passed ? 0.3 : 0.1);
        // cables up the shaft
        c.beginPath();
        c.moveTo(r.x + 20, r.y); c.lineTo(r.x + 20, 0); c.moveTo(r.x + r.w - 20, r.y); c.lineTo(r.x + r.w - 20, 0);
        c.strokeStyle = rgba(PAL.line, 0.3);
        c.lineWidth = 1.5;
        c.stroke();
        // the sensor box on the lift: reads 1 while empty
        const v = d.liftOccupied ? 0 : 1;
        chamfer(c, r.x + r.w / 2 - 22, r.y + 4, 44, 16, 3);
        c.fillStyle = '#0E0C22';
        c.fill();
        label(c, `SENSOR ${v}`, r.x + r.w / 2, r.y + 16, v ? PAL.trace : PAL.amber, 10);
        break;
      }
      case 'bridge': {
        const i = Number(g.id.slice(6)), n = room.gates.filter((x) => x.kind === 'bridge').length;
        const ext = Math.max(0, Math.min(1, rs.bridge * n - i));
        if (ext <= 0) break;
        c.beginPath();
        c.rect(r.x, r.y, r.w * ext, r.h);
        c.fillStyle = PAL.fill;
        c.fill();
        glowLine(c, PAL.trace, 2, 0.25);
        c.beginPath();
        for (let k = 0; k < 4; k++) { c.moveTo(r.x + k * 20, r.y + r.h); c.lineTo(r.x + k * 20 + 10, r.y); }
        c.strokeStyle = rgba(PAL.trace, 0.3);
        c.lineWidth = 1;
        c.stroke();
        break;
      }
    }
  }
  const run = room.wire;
  if (!run) return;
  // wires: sagging lines between terminals; cyan with travelling pulses once the run passes
  const pos = (pin: string) => { const tm = run.terminals.find((q) => q.pin === pin)!; return { x: tm.x, y: tm.y - 40 }; };
  const wire = (a: Pt, b: Pt, col: string, alpha: number, pulse: boolean) => {
    const dist = Math.hypot(b.x - a.x, b.y - a.y), sag = Math.min(90, 20 + dist * 0.18);
    const mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) + sag;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo(mx, my, b.x, b.y);
    c.save();
    c.globalAlpha = alpha;
    glowLine(c, col, 2.5, 0.25);
    c.restore();
    if (pulse) {
      const u = (t * 0.02) % 1, q = (1 - u) * (1 - u), r2 = 2 * (1 - u) * u, s2 = u * u;
      halo(c, q * a.x + r2 * mx + s2 * b.x, q * a.y + r2 * my + s2 * b.y, 12, col, 0.8);
    }
  };
  const sparking = rs.spark > 0;
  for (const [a, b] of rs.wires) wire(pos(a), pos(b), sparking ? PAL.hostile : rs.passed ? PAL.trace : PAL.amber, 1, rs.passed);
  if (rs.ghost) wire(pos(rs.ghost[0]), pos(rs.ghost[1]), PAL.text, 0.25 + 0.15 * Math.sin(t * 0.15), false);
  if (rs.carrying) wire(pos(rs.carrying), droneHand, PAL.amber, 1, false);
  for (const tm of run.terminals) drawTerminal(c, d, tm, t);
}

function drawTerminal(c: C, d: Director, tm: Terminal, t: number) {
  const rs = d.rs, x = tm.x, y = tm.y;
  const wired = rs.wires.some((w) => w.includes(tm.pin)) || rs.carrying === tm.pin;
  const isLever = d.room.stations.some((s) => s.kind === 'lever' && s.x === x);
  if (isLever && rs.passed) {
    // after the pass, a lever stands here (drawn with the stations)
    chamfer(c, x - 16, y - 60, 32, 60, 4);
    c.fillStyle = PAL.fill;
    c.fill();
    c.strokeStyle = rgba(PAL.trace, 0.7);
    c.lineWidth = 2;
    c.stroke();
    return;
  }
  const col = rs.passed ? PAL.trace : tm.role === 'source' ? PAL.amber : tm.role === 'sink' ? PAL.gold : PAL.line;
  chamfer(c, x - 15, y - 54, 30, 54, 4);
  c.fillStyle = PAL.fill;
  c.fill();
  c.strokeStyle = rgba(col, 0.85);
  c.lineWidth = 2;
  c.stroke();
  // the socket
  c.beginPath();
  c.arc(x, y - 40, 7, 0, Math.PI * 2);
  c.fillStyle = wired ? col : '#000000';
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 1.5;
  c.stroke();
  if (!wired && !rs.passed) halo(c, x, y - 40, 18, col, 0.18 + 0.12 * Math.sin(t * 0.12 + x * 0.01));
  // a source shows its value; a sink shows what reaches it
  const v = d.terminalValue(tm);
  if (v !== null) label(c, `${v}`, x, y - 14, v ? PAL.trace : rgba(PAL.idle, 0.9), 13);
  label(c, tm.label, x, y - 64, rgba(col, 0.8), 10);
}

/** The dark: everything but the drone's light (and lit terminals) under a near-black veil until the lights come on. */
export function drawDark(c: C, d: Director, cam: Pt, drone: Pt, scratch: { canvas: HTMLCanvasElement | null }) {
  const a = 1 - d.rs.light;
  if (a <= 0.01) return;
  if (!scratch.canvas) { scratch.canvas = document.createElement('canvas'); scratch.canvas.width = VIEW_W; scratch.canvas.height = VIEW_H; }
  const m = scratch.canvas.getContext('2d')!;
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, VIEW_W, VIEW_H);
  m.fillStyle = `rgba(3,2,10,${0.9 * a})`;
  m.fillRect(0, 0, VIEW_W, VIEW_H);
  m.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, k = 1) => {
    const g = m.createRadialGradient(x - cam.x, y - cam.y, r * 0.35, x - cam.x, y - cam.y, r);
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g;
    m.fillRect(x - cam.x - r, y - cam.y - r, r * 2, r * 2);
  };
  hole(drone.x, drone.y, d.kit.headlamp ? S.headlamp : S.glow);
  for (const tm of d.room.wire?.terminals ?? []) hole(tm.x, tm.y - 36, 64, 0.9);
  for (const st of d.room.stations) hole(st.x, st.y - 120, 90, 0.7);
  if (d.room.id === 'bit0-chamber') hole(800, 300, 120, 0.25);
  const lc = d.sim.lampCone;
  if (lc) {
    // the beam's cone: the circle's soft radial falloff, cut to a wedge, its edge feathered by two wider wedges
    const cx = lc.x - cam.x, cy = lc.y - cam.y;
    const wedge = (k: number, spread: number) => {
      const g = m.createRadialGradient(cx, cy, lc.reach * 0.35, cx, cy, lc.reach);
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      m.beginPath();
      m.moveTo(cx, cy);
      m.arc(cx, cy, lc.reach, lc.a - lc.half * spread, lc.a + lc.half * spread);
      m.closePath();
      m.fill();
    };
    wedge(1, 1);
    wedge(0.5, 1.12);
    wedge(0.2, 1.25);
  }
  c.drawImage(scratch.canvas, 0, 0, VIEW_W, VIEW_H);
}

// ------------------------------------------------------------------------------------------------ view space

/** TAPEOUT's speech bubble, bottom left, typed at 40 characters a second. */
export function drawBubble(c: C, d: Director, t: number) {
  const b = d.bubble;
  if (!b) return;
  const shown = Math.min(b.text.length, Math.floor((b.age / HZ) * S.lineCps));
  const typed = b.text.slice(0, shown);
  const typedFor = b.text.length / S.lineCps * HZ;
  const fadeOut = Math.max(0, Math.min(1, (b.age - typedFor - (S.lineMs / 1000) * HZ + 20) / 20));
  const inK = easeOut(Math.min(1, b.age / 10));
  c.save();
  c.globalAlpha = inK * (1 - fadeOut);
  c.font = `15px ${FONT}`;
  // top centre, under the HUD (under the boss bar in the arena), clear of the drone and the floor
  const w = Math.max(240, c.measureText(b.text).width + 40), ax = (VIEW_W - w) / 2 - 8, y = (d.bossBar ? 104 : 66) + (1 - inK) * -8;
  const x = ax + 36;
  // the avatar: TAPEOUT's eye in a ring, flickering while it is still broken
  const broken = !d.kit.voice;
  const flick = broken && Math.floor(t / 7) % 9 === 0 ? 0.5 : 1;
  const cy = y + 8;
  c.beginPath();
  c.arc(ax, cy, 22, 0, Math.PI * 2);
  c.fillStyle = rgba(PAL.bgDeep, 0.85);
  c.fill();
  c.strokeStyle = rgba(PAL.trace, 0.9 * flick);
  c.lineWidth = 2;
  c.stroke();
  halo(c, ax, cy, 20, PAL.trace, 0.25 * flick);
  dot(c, ax + (shown < b.text.length ? Math.sin(t * 0.6) * 2 : 0), cy, 6, PAL.trace, flick);
  dot(c, ax + 2, cy - 2, 2.2, '#FFFFFF', flick);
  // the box
  chamfer(c, x, y - 18, w, 52, 6);
  c.fillStyle = rgba(PAL.bgDeep, 0.85);
  c.fill();
  c.strokeStyle = rgba(PAL.trace, 0.7);
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = rgba(PAL.trace, 0.7);
  c.font = `10px ${FONT}`;
  c.fillText('TAPEOUT', x + 14, y - 3);
  c.font = `15px ${FONT}`;
  c.fillStyle = PAL.text;
  c.fillText(typed, x + 14, y + 20);
  c.restore();
}

/** The E prompt over whatever E would use. World space. */
export function drawPrompt(c: C, d: Director, t: number) {
  const p = d.prompt;
  if (!p) return;
  c.save();
  c.font = `12px ${FONT}`;
  const w = c.measureText(p.text).width + 20, bob = Math.sin(t * 0.08) * 2;
  chamfer(c, p.x - w / 2, p.y - 16 + bob, w, 24, 4);
  c.fillStyle = rgba(PAL.bgDeep, 0.85);
  c.fill();
  c.strokeStyle = rgba(PAL.amber, 0.9);
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = PAL.text;
  c.textAlign = 'center';
  c.fillText(p.text, p.x, p.y + 1 + bob);
  c.restore();
}

/** The boss bar (top centre), its lab-time clock, the latest reading, and the log while Tab is held. */
export function drawBossHud(c: C, d: Director, t: number, showLog: boolean) {
  const b = d.bossBar;
  if (!b) return;
  const W = 460, x = (VIEW_W - W) / 2, y = 26;
  c.save();
  // a dark backing plate, so world labels behind the bar never show through its text
  chamfer(c, x - 40, 4, W + 80, y + 40, 6);
  c.fillStyle = rgba(PAL.bgDeep, 0.82);
  c.fill();
  c.font = `12px ${FONT}`;
  c.textAlign = 'center';
  c.fillStyle = b.enraged > 0 ? PAL.hostile : PAL.neon;
  c.fillText(b.enraged > 0 ? 'THE DARK DEMO BOARD · ENRAGED' : 'THE DARK DEMO BOARD', VIEW_W / 2, y - 6);
  chamfer(c, x, y, W, 12, 3);
  c.fillStyle = rgba(PAL.bgDeep, 0.7);
  c.fill();
  c.strokeStyle = rgba(PAL.line, 0.9);
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = b.shielded ? rgba(PAL.idle, 0.8) : PAL.neon;
  c.fillRect(x + 3, y + 3, (W - 6) * (b.hp / b.maxHp), 6);
  const left = b.inv.left, frac = Math.max(0, left / b.inv.inc.budget);
  c.fillStyle = rgba(frac < 0.3 ? PAL.hostile : PAL.amber, 0.9);
  c.fillRect(x + 3, y + 18, (W - 6) * frac, 3);
  c.fillStyle = rgba(PAL.text, 0.75);
  c.font = `11px ${FONT}`;
  const phase = b.phase === 'investigate' ? (b.tempDown > 0 ? 'SHIELD DOWN · HIT IT' : 'TAKE READINGS · THEN THE DEBUG PORT') : b.phase === 'fix' ? 'PICK THE FIX' : 'SHIELD DOWN · FINISH IT';
  c.fillText(`${phase}  ·  lab time ${Math.max(0, left)} min  ·  TAB: notes`, VIEW_W / 2, y + 36);
  c.restore();
  // the latest reading, for a few seconds
  const r = d.lastReading;
  if (r && r.age < 6 * HZ) {
    r.age++;
    const lines = [`${r.arg.toUpperCase()}${r.repeat ? ' (from your notes)' : ''}`, ...r.text.split('\n')];
    if (r.ruledOut.length) lines.push(`Rules out: ${r.ruledOut.join('; ')}`);
    lines.push(r.left === 1 ? 'One cause fits. Go to the debug port.' : `${r.left} causes still fit.`);
    panel(c, VIEW_W / 2 - 330, 152, 660, lines, Math.min(1, r.age / 8) * Math.min(1, (6 * HZ - r.age) / 20), PAL.trace);
  }
  if (showLog) {
    const causes = b.causes().map((k) => `${k.out ? '✗' : k.struck ? '–' : '•'} ${k.name}${k.out ? ' (wrong call)' : k.struck ? ' (crossed off)' : ''}`);
    const notes = b.log.map((n) => `${n.key}: ${n.text.split('\n').slice(-1)[0]}`);
    panel(c, VIEW_W - 560, 152, 540, ['CAUSES', ...causes, '', 'READINGS', ...(notes.length ? notes : ['none yet'])], 1, PAL.amber);
  }
  void t;
}

function panel(c: C, x: number, y: number, w: number, lines: string[], alpha: number, col: string) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.font = `12px ${FONT}`;
  // wrap long lines
  const out: string[] = [];
  for (const l of lines) {
    let s = l;
    while (c.measureText(s).width > w - 28) {
      let k = s.length;
      while (k > 0 && c.measureText(s.slice(0, k)).width > w - 28) k = s.lastIndexOf(' ', k - 1);
      if (k <= 0) break;
      out.push(s.slice(0, k));
      s = '  ' + s.slice(k + 1);
    }
    out.push(s);
  }
  const h = out.length * 17 + 18;
  chamfer(c, x, y, w, h, 6);
  c.fillStyle = rgba(PAL.bgDeep, 0.9);
  c.fill();
  c.strokeStyle = rgba(col, 0.8);
  c.lineWidth = 1.5;
  c.stroke();
  out.forEach((l, i) => {
    c.fillStyle = i === 0 || l === 'READINGS' || l === 'CAUSES' ? col : rgba(PAL.text, l.startsWith('–') || l.startsWith('✗') ? 0.45 : 0.85);
    c.fillText(l, x + 14, y + 22 + i * 17);
  });
  c.restore();
}

/** The exit lift's ride: the room drops away, a bright shaft, then the fade. View space. */
export function drawExitLift(c: C, k: number) {
  if (k <= 0) return;
  c.save();
  const a = Math.min(1, k / 0.25);
  c.fillStyle = `rgba(11,10,26,${0.6 * a})`;
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const y = ((i * 80 + k * 4000) % (VIEW_H + 80)) - 40;
    c.fillStyle = rgba(PAL.trace, 0.08 * a);
    c.fillRect(0, VIEW_H - y, VIEW_W, 2);
  }
  c.restore();
}

// The HUD (plan K, polish bar P5): line-art health and energy bars top-left, the selected weapon's icon beside the
// energy bar (decision 29) and a small crosshair. Damage drops the health bar at once and a white "recent damage"
// segment drains over 400 ms; the energy bar pulses below 25%. Drawn in view coordinates (1280 × 720 logical px).
import type { Sim } from '../sim';
import { easeOut, FONT, PAL, rgba } from './palette';

export class Hud {
  /** Health shown by the white recent-damage segment; drains toward the real value. */
  private ghost = 100;
  private ghostHold = 0;
  private drainFrom = 100;
  private lastHealth = 100;
  private swapT = 1;

  step(sim: Sim) {
    const h = sim.vitals.integrity;
    if (h < this.lastHealth) { this.ghostHold = 6; this.drainFrom = this.ghost; } // a beat before the drain starts
    if (h > this.ghost) this.ghost = h;
    this.lastHealth = h;
    if (this.ghostHold > 0) this.ghostHold--;
    else this.ghost = Math.max(h, this.ghost - Math.max(0.2, (this.drainFrom - h) / 24)); // gone in 400 ms
    if (sim.fx.some((f) => f.t === 'swap')) this.swapT = 0;
    this.swapT = Math.min(1, this.swapT + 1 / 12);
  }

  /** `slide` 0..1 brings the HUD in from the top-left during the boot (P2). */
  draw(c: CanvasRenderingContext2D, sim: Sim, slide: number, t: number) {
    const v = sim.vitals, s = easeOut(slide);
    const x = 24 - (1 - s) * 280, y = 22;
    c.save();
    c.globalAlpha = s;
    c.lineWidth = 1.5;
    c.font = `11px ${FONT}`;
    c.textBaseline = 'middle';
    // health
    const W = 220, frac = Math.max(0, v.integrity / v.maxIntegrity), ghost = Math.max(frac, this.ghost / v.maxIntegrity);
    frame(c, x, y, W, 12);
    c.fillStyle = rgba('#FFFFFF', 0.85);
    c.fillRect(x + 3, y + 3, (W - 6) * ghost, 6);
    const low = frac < 0.3;
    c.fillStyle = low ? PAL.hostile : PAL.trace;
    c.fillRect(x + 3, y + 3, (W - 6) * frac, 6);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(low ? PAL.hostile : PAL.trace, 0.25);
    c.fillRect(x + 1, y + 1, (W - 2) * frac, 10);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = PAL.text;
    c.fillText(`${Math.ceil(v.integrity)}`, x + W + 10, y + 6);
    // energy
    const ey = y + 20, ef = Math.max(0, v.energy / v.maxEnergy);
    const pulse = ef < 0.25 ? 0.55 + 0.45 * Math.sin(t * 0.25) : 1;
    frame(c, x, ey, W, 8);
    c.fillStyle = rgba(PAL.neon, pulse);
    c.fillRect(x + 3, ey + 3, (W - 6) * ef, 2);
    if (ef < 0.25) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(PAL.neon, 0.25 * pulse);
      c.fillRect(x + 1, ey + 1, (W - 2) * ef + 2, 6);
      c.globalCompositeOperation = 'source-over';
    }
    // the selected weapon, next to the energy bar
    const wx = x + W + 12, wy = ey + 4, k = easeOut(this.swapT);
    c.globalAlpha = s * (0.4 + 0.6 * k);
    c.strokeStyle = sim.weapon === 'charged' ? PAL.neon : PAL.trace;
    c.lineWidth = 1.5;
    c.beginPath();
    if (sim.weapon === 'pulse') {
      c.moveTo(wx, wy); c.lineTo(wx + 8, wy); c.lineTo(wx + 11, wy - 4); c.lineTo(wx + 14, wy + 4); c.lineTo(wx + 17, wy); c.lineTo(wx + 24, wy);
    } else {
      c.arc(wx + 6, wy, 4, 0, Math.PI * 2);
      c.moveTo(wx + 12, wy); c.lineTo(wx + 24, wy);
      c.moveTo(wx + 20, wy - 3); c.lineTo(wx + 24, wy); c.lineTo(wx + 20, wy + 3);
    }
    c.stroke();
    c.fillStyle = rgba(PAL.text, 0.7);
    c.fillText(sim.weapon === 'pulse' ? 'PULSE' : 'CHARGED', wx + 30, wy);
    c.restore();
  }

  /** The crosshair at the mouse, in view coordinates. Brightens while charging. */
  crosshair(c: CanvasRenderingContext2D, sim: Sim, mx: number, my: number) {
    const ch = sim.weapon === 'charged' ? sim.charge : sim.field.on ? sim.field.charge : 0;
    const col = sim.weapon === 'charged' ? PAL.neon : PAL.trace;
    const g = 3 + (1 - ch) * 3;
    c.save();
    c.strokeStyle = rgba(PAL.text, 0.9);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(mx - g - 5, my); c.lineTo(mx - g, my);
    c.moveTo(mx + g, my); c.lineTo(mx + g + 5, my);
    c.moveTo(mx, my - g - 5); c.lineTo(mx, my - g);
    c.moveTo(mx, my + g); c.lineTo(mx, my + g + 5);
    c.stroke();
    if (ch > 0) {
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(mx, my, 11, -Math.PI / 2, -Math.PI / 2 + ch * Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = col;
    c.fillRect(mx - 1, my - 1, 2, 2);
    c.restore();
  }
}

/** A line-art bar frame with clipped corners. */
function frame(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.strokeStyle = rgba(PAL.line, 0.9);
  c.fillStyle = rgba(PAL.bgDeep, 0.65);
  c.beginPath();
  c.moveTo(x + 4, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - 4); c.lineTo(x + w - 4, y + h); c.lineTo(x, y + h); c.lineTo(x, y + 4);
  c.closePath();
  c.fill();
  c.stroke();
}

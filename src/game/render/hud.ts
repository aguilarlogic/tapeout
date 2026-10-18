// The HUD (doc section 10): integrity bar 240 × 10 top-left with its number, energy bar 240 × 6 under it, and the weapon
// icon. Drawn in view coordinates (1280 × 720 logical px).
import type { Sim } from '../sim';
import { FONT, LINE, PAL } from './palette';

export function drawHud(c: CanvasRenderingContext2D, sim: Sim) {
  const v = sim.vitals, x = 24, y = 24;
  c.save();
  c.lineWidth = LINE.hud;
  // integrity
  c.strokeStyle = PAL.line;
  c.strokeRect(x, y, 240, 10);
  c.fillStyle = PAL.trace;
  c.shadowColor = PAL.trace;
  c.shadowBlur = 8;
  c.fillRect(x + 2, y + 2, Math.max(0, 236 * (v.integrity / v.maxIntegrity)), 6);
  c.shadowBlur = 0;
  c.fillStyle = PAL.text;
  c.font = `13px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText(`${Math.ceil(v.integrity)}`, x + 250, y + 5);
  // energy
  c.strokeStyle = PAL.line;
  c.strokeRect(x, y + 16, 240, 6);
  c.fillStyle = PAL.neon;
  c.fillRect(x + 1.5, y + 17.5, Math.max(0, 237 * (v.energy / v.maxEnergy)), 3);
  // weapon icon: the Pulse Probe, a probe tip with a pulse
  const wx = x + 290, wy = y + 11;
  c.strokeStyle = PAL.trace;
  c.beginPath();
  c.moveTo(wx, wy); c.lineTo(wx + 14, wy); c.lineTo(wx + 18, wy - 6); c.lineTo(wx + 22, wy + 6); c.lineTo(wx + 26, wy); c.lineTo(wx + 34, wy);
  c.stroke();
  c.fillStyle = PAL.idle;
  c.fillText('PULSE PROBE', wx + 42, wy);
  c.restore();
}

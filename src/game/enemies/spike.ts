// Glitch Spike (a combinational hazard): invisible, then a thin warning line for 0.4 s, then a spike across 160 px that
// stays for 1 s. It can be hit only while the spike shows. It strikes again after a rest.
import type { Dir, Rect } from '../level/room';
import { SPIKE } from '../tuning';
import type { Enemy, Shape } from './types';

export type SpikePhase = 'rest' | 'warn' | 'strike';
const THICK = 10;

export class GlitchSpike implements Enemy {
  kind = 'spike';
  hp = SPIKE.hp;
  maxHp = SPIKE.hp;
  alive = true;
  phase: SpikePhase = 'rest';
  t: number;
  readonly rect: Rect;
  constructor(public x: number, public y: number, public dir: Dir, offset: number) {
    this.t = offset;
    const L = SPIKE.length;
    this.rect = dir === 'up' ? { x: x - THICK / 2, y: y - L, w: THICK, h: L }
      : dir === 'down' ? { x: x - THICK / 2, y, w: THICK, h: L }
      : dir === 'left' ? { x: x - L, y: y - THICK / 2, w: L, h: THICK }
      : { x, y: y - THICK / 2, w: L, h: THICK };
  }
  hittable() { return this.alive && this.phase === 'strike'; }
  touchDamage() { return this.alive && this.phase === 'strike' ? SPIKE.damage : 0; }
  shape(): Shape { return { kind: 'rect', rect: this.rect }; }
  damage(n: number) {
    if (!this.hittable()) return;
    this.hp -= n;
    if (this.hp <= 0) this.alive = false;
  }
  step() {
    if (!this.alive || --this.t > 0) return;
    if (this.phase === 'rest') { this.phase = 'warn'; this.t = SPIKE.warn; }
    else if (this.phase === 'warn') { this.phase = 'strike'; this.t = SPIKE.visible; }
    else { this.phase = 'rest'; this.t = SPIKE.rest; }
  }
}

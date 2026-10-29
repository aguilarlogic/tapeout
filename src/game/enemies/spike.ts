// Glitch Spike (a combinational hazard): invisible, then a thin warning line for 0.4 s, then a spike across 160 px that
// stays for 1 s. It can be hit only while the spike shows. It strikes again after a rest. Kept for phase 2 levels.
import type { Dir, Rect } from '../level/room';
import { SPIKE } from '../tuning';
import type { Vec } from '../physics/geom';
import type { Enemy, EnemyCtx } from './types';

export type SpikePhase = 'rest' | 'warn' | 'strike';
const THICK = 10;

export class GlitchSpike implements Enemy {
  kind = 'spike';
  hp = SPIKE.hp;
  maxHp = SPIKE.hp;
  alive = true;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
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
  outline(): Vec[] {
    const r = this.rect;
    return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  }
  damage(n: number) {
    if (!this.hittable()) return 0;
    this.hp -= n;
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  knock() { /* anchored to the floor */ }
  step(ctx?: EnemyCtx) {
    // Model Lens (Phase 7 Spec, section 3): the warning line shows `lens` steps sooner; the strike keeps its beat
    const lens = Math.min(ctx?.lens ?? 0, SPIKE.rest - 1);
    this.telegraph = this.alive && this.phase === 'warn' ? 1 - this.t / this.warnLen : 0;
    if (!this.alive || --this.t > 0) return;
    if (this.phase === 'rest') { this.phase = 'warn'; this.warnLen = SPIKE.warn + lens; this.t = this.warnLen; }
    else if (this.phase === 'warn') { this.phase = 'strike'; this.t = SPIKE.visible; }
    else { this.phase = 'rest'; this.t = SPIKE.rest - lens; }
  }
  private warnLen = SPIKE.warn;
}

// Floater (a floating input): drifts on a random walk and flips between grey (harmless) and red (hostile) every 1 to 3 s
// at random. Over a grounding plate it is pinned: grey for good and still. Kept for phase 2 levels (decision 25); the
// Field Coil pushes it rather than carrying it (plan F).
import type { Rect } from '../level/room';
import { circleRect, type Vec } from '../physics/geom';
import { DAMAGE, FLOATER } from '../tuning';
import type { Enemy, EnemyCtx } from './types';

export class Floater implements Enemy {
  kind = 'floater';
  hp = FLOATER.hp;
  maxHp = FLOATER.hp;
  alive = true;
  hostile = false;
  pinned = false;
  facing: 1 | -1 = 1;
  flash = 0;
  telegraph = 0;
  vx = 0;
  vy = 0;
  private turn = 0;
  private flip: number;
  private thrown = 0;
  constructor(public x: number, public y: number, private home: Vec, rand: () => number) {
    this.flip = FLOATER.flipMin + Math.floor(rand() * (FLOATER.flipMax - FLOATER.flipMin));
  }
  hittable() { return this.alive; }
  touchDamage() { return this.alive && this.hostile && !this.pinned ? DAMAGE.touch : 0; }
  outline(): Vec[] {
    return Array.from({ length: 12 }, (_, i) => ({ x: this.x + Math.cos((i / 12) * Math.PI * 2) * FLOATER.radius, y: this.y + Math.sin((i / 12) * Math.PI * 2) * FLOATER.radius }));
  }
  damage(n: number) {
    this.hp -= n;
    if (this.hp <= 0) this.alive = false;
    return n;
  }
  knock(v: Vec) {
    this.vx = v.x / 60;
    this.vy = v.y / 60;
    this.thrown = 20;
  }
  private blocked(x: number, y: number, solids: Rect[]) {
    return solids.some((s) => circleRect(x, y, FLOATER.radius, s));
  }
  step(ctx: EnemyCtx) {
    if (!this.alive) return;
    if (!this.pinned && ctx.plates.some((p) => this.x > p.x && this.x < p.x + p.w && this.y > p.y - 70 && this.y < p.y + p.h)) {
      this.pinned = true;
      this.hostile = false;
    }
    if (!this.pinned && --this.flip <= 0) {
      this.hostile = !this.hostile;
      this.flip = FLOATER.flipMin + Math.floor(ctx.rand() * (FLOATER.flipMax - FLOATER.flipMin));
    }
    if (this.pinned && !this.thrown) return;
    if (this.thrown > 0) {
      this.thrown--;
      this.vx *= 0.96;
      this.vy *= 0.96;
    } else {
      if (--this.turn <= 0) {
        const a = ctx.rand() * Math.PI * 2;
        this.vx = Math.cos(a) * FLOATER.speed;
        this.vy = Math.sin(a) * FLOATER.speed;
        this.turn = 30 + Math.floor(ctx.rand() * 60);
      }
      const dx = this.home.x - this.x, dy = this.home.y - this.y, dist = Math.hypot(dx, dy);
      if (dist > FLOATER.leash) {
        this.vx = (dx / dist) * FLOATER.speed;
        this.vy = (dy / dist) * FLOATER.speed;
      }
    }
    const nx = this.x + this.vx, ny = this.y + this.vy;
    if (!this.blocked(nx, this.y, ctx.solids)) this.x = nx; else this.vx = -this.vx;
    if (!this.blocked(this.x, ny, ctx.solids)) this.y = ny; else this.vy = -this.vy;
  }
}

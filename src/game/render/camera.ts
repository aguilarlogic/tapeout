// The camera (plan I): follows the drone at 0.12 per 60 Hz step, looks ahead 20% of the way toward the cursor (at
// most 120 px), kept inside the room. Shake decays linearly from its strongest recent kick; "Reduce screen shake"
// (or reduced motion) turns it off.
import type { Room } from '../level/room';
import type { Vec } from '../physics/geom';
import { TUNING, VIEW_H, VIEW_W } from '../tuning';

export class Camera {
  x = 0; // top-left of the view in world px
  y = 0;
  prevX = 0;
  prevY = 0;
  shakeX = 0;
  shakeY = 0;
  private amp = 0;
  private decay = 0; // px per step

  snap(target: Vec, room: Room) {
    [this.x, this.y] = this.clamp(target.x - VIEW_W / 2, target.y - VIEW_H / 2, room);
    this.prevX = this.x;
    this.prevY = this.y;
  }

  step(drone: Vec, cursor: Vec, room: Room, rand: () => number) {
    const C = TUNING.camera;
    this.prevX = this.x;
    this.prevY = this.y;
    let lx = (cursor.x - drone.x) * C.lookahead, ly = (cursor.y - drone.y) * C.lookahead;
    const l = Math.hypot(lx, ly);
    if (l > C.lookMax) { lx *= C.lookMax / l; ly *= C.lookMax / l; }
    const [cx, cy] = this.clamp(drone.x + lx - VIEW_W / 2, drone.y + ly - VIEW_H / 2, room);
    this.x += (cx - this.x) * C.follow;
    this.y += (cy - this.y) * C.follow;
    if (this.amp > 0) {
      this.shakeX = (rand() * 2 - 1) * this.amp;
      this.shakeY = (rand() * 2 - 1) * this.amp;
      this.amp = Math.max(0, this.amp - this.decay);
    } else {
      this.shakeX = this.shakeY = 0;
    }
  }

  /** Kick the shake to `px` for `ms` (keeps a stronger shake already running). */
  shake(px: number, ms: number, off: boolean) {
    if (off || px <= this.amp) return;
    this.amp = px;
    this.decay = px / Math.max(1, (ms / 1000) * 60);
  }

  private clamp(x: number, y: number, room: Room): [number, number] {
    return [Math.max(0, Math.min(room.w - VIEW_W, x)), Math.max(0, Math.min(room.h - VIEW_H, y))];
  }
}

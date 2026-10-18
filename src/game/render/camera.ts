// The camera: follows the drone with a 120 px lookahead toward the aim, eased at 0.12 a step, kept inside the room.
// Screen shake (at most 6 px, 0.2 s) is off with reduced motion.
import type { Room } from '../level/room';
import type { Vec } from '../physics/geom';
import { CAMERA, VIEW_H, VIEW_W } from '../tuning';

export class Camera {
  x = 0; // top-left of the view in world px
  y = 0;
  prevX = 0;
  prevY = 0;
  private shakeT = 0;
  shakeX = 0;
  shakeY = 0;

  snap(target: Vec, room: Room) {
    [this.x, this.y] = this.clamp(target.x - VIEW_W / 2, target.y - VIEW_H / 2, room);
    this.prevX = this.x;
    this.prevY = this.y;
  }

  step(drone: Vec, aim: Vec, room: Room, rand: () => number) {
    this.prevX = this.x;
    this.prevY = this.y;
    const tx = drone.x + aim.x * CAMERA.lookahead - VIEW_W / 2, ty = drone.y + aim.y * CAMERA.lookahead - VIEW_H / 2;
    const [cx, cy] = this.clamp(tx, ty, room);
    this.x += (cx - this.x) * CAMERA.smoothing;
    this.y += (cy - this.y) * CAMERA.smoothing;
    if (this.shakeT > 0) {
      const k = (this.shakeT-- / CAMERA.shakeSteps) * CAMERA.shakeMax;
      this.shakeX = (rand() * 2 - 1) * k;
      this.shakeY = (rand() * 2 - 1) * k;
    } else {
      this.shakeX = this.shakeY = 0;
    }
  }

  shake(reduced: boolean) {
    if (!reduced) this.shakeT = CAMERA.shakeSteps;
  }

  private clamp(x: number, y: number, room: Room): [number, number] {
    return [Math.max(0, Math.min(room.w - VIEW_W, x)), Math.max(0, Math.min(room.h - VIEW_H, y))];
  }
}

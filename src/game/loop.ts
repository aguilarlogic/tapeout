// The fixed-step loop: a 60 Hz simulation driven by requestAnimationFrame with an accumulator (at most MAX_STEPS steps a
// frame; a longer stall is dropped), and a render that gets the fraction of a step left over for interpolation.
import { MAX_STEPS, STEP_MS } from './tuning';

export interface LoopStats { frameMs: number[]; workMs: number[] }

export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  running = false;
  /** The last 240 frame intervals and the time spent stepping and drawing each frame, in ms. */
  stats: LoopStats = { frameMs: [], workMs: [] };

  constructor(private step: () => void, private render: (alpha: number) => void, private now = () => performance.now()) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = this.now();
    this.acc = 0;
    const tick = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** One animation frame: run the steps owed, then draw. Public so tests can drive it with a fake clock. */
  frame() {
    const t = this.now();
    const dt = t - this.last;
    this.last = t;
    this.acc += Math.min(dt, STEP_MS * MAX_STEPS);
    let n = 0;
    while (this.acc >= STEP_MS && n < MAX_STEPS) {
      this.step();
      this.acc -= STEP_MS;
      n++;
    }
    if (n === MAX_STEPS) this.acc = Math.min(this.acc, STEP_MS);
    this.render(this.acc / STEP_MS);
    const work = this.now() - t;
    push(this.stats.frameMs, dt);
    push(this.stats.workMs, work);
  }
}

function push(a: number[], v: number) {
  a.push(v);
  if (a.length > 240) a.shift();
}

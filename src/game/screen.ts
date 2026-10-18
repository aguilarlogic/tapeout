// The story game screen: a full-window canvas over the desktop, the loop, input, camera, pause menu and (dev builds
// only) the F9 debug overlay. Phase 1 shows the test room.
import { prefs } from '../state';
import { prefersReducedMotion } from '../term/typewriter';
import { h } from '../ui/dom';
import { type Bindings, resolve } from './input/bindings';
import { InputDevice } from './input/device';
import { TEST_ROOM } from './level/testroom';
import { Loop } from './loop';
import { pauseMenu } from './pause';
import { Camera } from './render/camera';
import { drawBackdrop, drawBlocks, drawDrone, drawEnemies, drawField, drawRoom, drawShots } from './render/draw';
import { drawHud } from './render/hud';
import { FONT, PAL } from './render/palette';
import { rng, Sim } from './sim';
import { VIEW_H, VIEW_W } from './tuning';

let current: GameScreen | null = null;

export function reducedMotion(): boolean {
  const p = prefs().reducedMotion;
  return p === 'on' || (p === 'system' && prefersReducedMotion());
}

/** Open the story game, or return the one already open. `onQuit` runs when the player picks Back to desktop. */
export function openGame(onQuit: () => void): GameScreen {
  current ??= new GameScreen(onQuit);
  return current;
}

/** Close the game without calling its onQuit (the desktop navigated somewhere else). */
export function closeGame() {
  current?.close(false);
}

export class GameScreen {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  sim = new Sim(TEST_ROOM, Date.now() >>> 0);
  private cam = new Camera();
  private input: InputDevice;
  loop: Loop;
  private paused = false;
  private pauseEl: HTMLElement | null = null;
  private debug = false;
  private reduced = reducedMotion();
  private shakeRand = rng(7);
  private prev = { x: 0, y: 0 };
  private view = { s: 1, ox: 0, oy: 0, w: 0, h: 0 };
  private offs: (() => void)[] = [];
  private stepMs: number[] = [];

  constructor(private onQuit: () => void) {
    this.canvas = h('canvas', { class: 'gm-canvas', 'aria-label': 'Story game. Press Escape to pause.', tabindex: '0' });
    this.el = h('div', { class: 'gm-screen', 'data-testid': 'game' }, this.canvas);
    document.body.append(this.el);
    this.ctx = this.canvas.getContext('2d')!;
    this.input = new InputDevice(this.canvas, resolve(prefs().keys), (code) => this.onKey(code));
    this.loop = new Loop(() => this.step(), (a) => this.render(a));
    this.cam.snap(this.sim.drone, this.sim.room);
    this.prev = { x: this.sim.drone.x, y: this.sim.drone.y };
    const resize = () => this.resize();
    const vis = () => { if (document.hidden) this.pause(); };
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const rm = () => (this.reduced = reducedMotion());
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', vis);
    mq?.addEventListener('change', rm);
    this.offs.push(() => window.removeEventListener('resize', resize), () => document.removeEventListener('visibilitychange', vis), () => mq?.removeEventListener('change', rm));
    this.resize();
    this.canvas.focus();
    this.loop.start();
    (window as unknown as { __tapeoutGame?: GameScreen }).__tapeoutGame = this;
  }

  private onKey(code: string) {
    if (this.paused) return;
    const b = this.input.bindings;
    if (b.pause.includes(code)) this.pause();
    else if (code === 'F9' && import.meta.env.DEV) this.debug = !this.debug;
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.loop.stop();
    this.input.clear();
    this.input.active = false;
    this.pauseEl = pauseMenu({
      input: this.input,
      resume: () => this.resume(),
      quit: () => this.close(),
      onBindings: (b: Bindings) => (this.input.bindings = b),
      onReducedMotion: () => (this.reduced = reducedMotion()),
    });
    this.el.append(this.pauseEl);
    const esc = (e: KeyboardEvent) => {
      if (this.input.capture || !this.paused) return;
      if (this.input.bindings.pause.includes(e.code)) { e.preventDefault(); this.resume(); }
    };
    // added after this event finishes so the key that paused does not resume at once
    setTimeout(() => window.addEventListener('keydown', esc), 0);
    this.offs.push(() => window.removeEventListener('keydown', esc));
    this.escOff = () => window.removeEventListener('keydown', esc);
  }
  private escOff: (() => void) | null = null;

  resume() {
    if (!this.paused) return;
    this.escOff?.();
    this.input.capture = null;
    this.pauseEl?.remove();
    this.pauseEl = null;
    this.paused = false;
    this.input.active = true;
    this.input.clear();
    this.canvas.focus();
    this.loop.start();
  }

  get isPaused() {
    return this.paused;
  }

  close(notify = true) {
    this.loop.stop();
    this.input.dispose();
    this.offs.forEach((f) => f());
    this.el.remove();
    if (current === this) current = null;
    if (notify) this.onQuit();
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.el.clientWidth || window.innerWidth, hh = this.el.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hh * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${hh}px`;
    const s = Math.min(w / VIEW_W, hh / VIEW_H);
    this.view = { s: s * dpr, ox: ((w - VIEW_W * s) / 2) * dpr, oy: ((hh - VIEW_H * s) / 2) * dpr, w: this.canvas.width, h: this.canvas.height };
    this.mouseScale = { s, ox: (w - VIEW_W * s) / 2, oy: (hh - VIEW_H * s) / 2 };
  }
  private mouseScale = { s: 1, ox: 0, oy: 0 };

  /** The mouse in world px. */
  private aimPoint() {
    const m = this.input.mouse, k = this.mouseScale;
    return { x: (m.x - k.ox) / k.s + this.cam.x, y: (m.y - k.oy) / k.s + this.cam.y };
  }

  private step() {
    const t0 = performance.now();
    this.prev = { x: this.sim.drone.x, y: this.sim.drone.y };
    this.sim.step(this.input.sample(), this.aimPoint());
    if (this.sim.events.includes('hit') || this.sim.events.includes('pit')) this.cam.shake(this.reduced);
    if (this.sim.events.includes('respawn') || this.sim.events.includes('pit')) this.prev = { x: this.sim.drone.x, y: this.sim.drone.y };
    this.cam.step(this.sim.drone, this.sim.aim, this.sim.room, this.shakeRand);
    this.stepMs.push(performance.now() - t0);
    if (this.stepMs.length > 240) this.stepMs.shift();
  }

  private render(alpha: number) {
    const c = this.ctx, v = this.view, sim = this.sim;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PAL.bgDeep;
    c.fillRect(0, 0, v.w, v.h);
    const camX = this.cam.prevX + (this.cam.x - this.cam.prevX) * alpha + this.cam.shakeX;
    const camY = this.cam.prevY + (this.cam.y - this.cam.prevY) * alpha + this.cam.shakeY;
    c.setTransform(v.s, 0, 0, v.s, v.ox, v.oy);
    c.save();
    c.beginPath();
    c.rect(0, 0, VIEW_W, VIEW_H);
    c.clip();
    c.translate(-camX, -camY);
    const t = sim.steps + alpha;
    drawBackdrop(c, sim.room, t, this.reduced, { x: camX, y: camY, w: VIEW_W, h: VIEW_H });
    drawRoom(c, sim);
    drawBlocks(c, sim);
    drawEnemies(c, sim, t, this.reduced);
    const dx = this.prev.x + (sim.drone.x - this.prev.x) * alpha, dy = this.prev.y + (sim.drone.y - this.prev.y) * alpha;
    drawField(c, sim, dx, dy);
    drawDrone(c, sim, dx, dy, t, this.reduced);
    drawShots(c, sim);
    c.restore();
    drawHud(c, sim);
    if (this.debug) this.drawDebug(c);
  }

  /** Frame statistics, for the debug overlay and the frame-budget check. */
  frameStats() {
    const pct = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
    const f = this.loop.stats.frameMs, w = this.loop.stats.workMs;
    return { fps: f.length ? 1000 / (f.reduce((a, b) => a + b, 0) / f.length) : 0, workAvg: w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0, workP95: pct(w, 0.95), stepP95: pct(this.stepMs, 0.95), frames: f.length };
  }

  private drawDebug(c: CanvasRenderingContext2D) {
    const d = this.sim.drone, s = this.frameStats();
    const lines = [
      `fps ${s.fps.toFixed(0)}  frame work ${s.workAvg.toFixed(2)} ms (p95 ${s.workP95.toFixed(2)})  step p95 ${s.stepP95.toFixed(2)} ms`,
      `pos ${d.x.toFixed(1)}, ${d.y.toFixed(1)}  vel ${(d.vx * 60).toFixed(0)}, ${(d.vy * 60).toFixed(0)} px/s`,
      `ground ${d.grounded ? (d.onOneWay ? 'one-way' : 'yes') : 'no'}  wall ${d.wall}  latched ${d.latched}  coyote ${d.coyote}  buffer ${d.buffer}`,
      `air jumps ${d.airJumps}  dash cd ${d.dashCd}  energy ${this.sim.vitals.energy.toFixed(0)}  shots ${this.sim.shots.length}  bodies ${this.sim.world.engine.world.bodies.length}`,
    ];
    c.save();
    c.fillStyle = 'rgba(11,10,26,0.8)';
    c.fillRect(VIEW_W - 620, 12, 608, 18 * lines.length + 12);
    c.fillStyle = PAL.ok;
    c.font = `12px ${FONT}`;
    c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, VIEW_W - 612, 18 + i * 18));
    c.restore();
  }
}

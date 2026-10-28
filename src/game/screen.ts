// The story game screen: a full-window canvas over the desktop, the loop, input, camera, effects, sound, pause menu,
// the F3 tuning panel and (dev builds only) the F9 debug overlay. Entry fades to black in 300 ms and boots the drone
// (polish bar P2); quitting fades out the same way.
import { award } from '../mastery/promotion';
import { prefs } from '../state';
import { prefersReducedMotion } from '../term/typewriter';
import { h } from '../ui/dom';
import { GameAudio, type Sfx, type Track } from './audio';
import { type Action, type Bindings, resolve } from './input/bindings';
import { InputDevice } from './input/device';
import { TEST_ROOM } from './level/testroom';
import { Director } from './story/director';
import { gameMount, openCard, openChoice, openLab, openLoft, openPort, openProfile, type OverlayHost } from './story/overlay';
import { openModule } from './story/open';
import { levelRecord } from '../state';
import { calibRows } from './loft/data';
import { type LoftActions, openLoftPanel } from './loft/panels';
import { mk2, UP, UPGRADES } from './world/upgrades';
import { drawBossHud, drawBubble, drawCompass, drawDark, drawExitLift, drawPrompt, drawStoryBack, drawStoryFront } from './story/render';
import { Loop } from './loop';
import { pauseMenu } from './pause';
import { Camera } from './render/camera';
import { drawAct3Back, drawAct3Front } from './render/act3';
import { drawAimLine, drawBeam, drawEnemies, drawField, drawLoopDrone, drawShots, drawSyncTint } from './render/combat';
import { DroneRig } from './render/drone';
import { Fx } from './render/fx';
import { Hud } from './render/hud';
import { easeOut, FONT, PAL, rgba } from './render/palette';
import { WorldArt } from './render/world';
import { rng, Sim } from './sim';
import { Tuner } from './tuner';
import { frames, HZ, TUNING, VIEW_H, VIEW_W, VITALS } from './tuning';
import type { Rect } from './level/room';
import { boundsRect } from './physics/world';

let current: GameScreen | null = null;

export function reducedMotion(): boolean {
  const p = prefs().reducedMotion;
  return p === 'on' || (p === 'system' && prefersReducedMotion());
}

/** Open the story game, or return the one already open. `onQuit` runs when the player picks Quit to title. `test`: the
 * phase 1 test room (`#/story/test`) instead of the story. */
export function openGame(onQuit: () => void, opts: { test?: boolean } = {}): GameScreen {
  current ??= new GameScreen(onQuit, opts);
  return current;
}

/** Close the game without calling its onQuit (the desktop navigated somewhere else). */
export function closeGame() {
  current?.close(false);
}

const TEST_BOOT = ['PROBE-7 FIRMWARE 7.0.3 . . . . . . . OK', 'LEGS / PULSE PROBE / FIELD COIL . . ONLINE', 'HULL PANELS 4 OF 6 . . . . SELF-REPAIR STANDBY'];
const BOOT = { fadeIn: 0.3, eye: 0.6, cps: 40, hold: 0.35, hud: 0.25 };

export class GameScreen {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** The story director (null in the test room). It owns the sim and swaps it on every room load. */
  story: Director | null = null;
  private testSim: Sim | null = null;
  get sim(): Sim { return this.story?.sim ?? this.testSim!; }
  private bootLines: string[];
  private track: Track = 'test';
  private speedAcc = 0;
  private showLog = false;
  private dark: { canvas: HTMLCanvasElement | null } = { canvas: null };
  private cam = new Camera();
  private input: InputDevice;
  loop: Loop;
  private audio = new GameAudio();
  private fx = new Fx();
  private rig = new DroneRig();
  private hud = new Hud();
  private art: WorldArt;
  private tuner: Tuner;
  private paused = false;
  private pauseEl: HTMLElement | null = null;
  private debug = false;
  private reduced = reducedMotion();
  private shakeRand = rng(7);
  private prev = { x: 0, y: 0 };
  private view = { s: 1, ox: 0, oy: 0, w: 0, h: 0 };
  private offs: (() => void)[] = [];
  private stepMs: number[] = [];
  /** Seconds since the screen opened (drives the boot sequence). */
  private age = 0;
  /** True once the boot sequence hands over control. */
  ready = false;
  private hitStop = 0;
  private fieldPower = 0;
  private respawnFade = 0;
  private quitting = false;
  private bootLen: number;

  constructor(private onQuit: () => void, opts: { test?: boolean } = {}) {
    if (opts.test) {
      this.testSim = new Sim(TEST_ROOM, Date.now() >>> 0);
      this.bootLines = TEST_BOOT;
    } else {
      this.story = new Director();
      this.bootLines = this.story.bootLines;
    }
    this.art = new WorldArt(this.sim.room);
    this.bootLen = this.bootLines.reduce((a, l) => a + l.length, 0);
    this.canvas = h('canvas', { class: 'gm-canvas', 'aria-label': 'Story game. Press Escape to pause.', tabindex: '0' });
    this.el = h('div', { class: 'gm-screen gm-fading', 'data-testid': 'game' }, this.canvas);
    document.body.append(this.el);
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.remove('gm-fading')));
    this.ctx = this.canvas.getContext('2d')!;
    this.input = new InputDevice(this.canvas, resolve(prefs().keys), (code) => this.onKey(code));
    this.tuner = new Tuner(this.el, { repair: () => this.sim.repairPanel(), breakPanels: () => this.sim.breakPanels(), stress: () => this.stress() });
    this.loop = new Loop(() => this.step(), (a) => this.render(a));
    this.cam.snap(this.sim.drone, this.sim.room);
    this.prev = { x: this.sim.drone.x, y: this.sim.drone.y };
    const resize = () => this.resize();
    const vis = () => { if (document.hidden) this.pause(); };
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const rm = () => (this.reduced = reducedMotion());
    // F3 is the browser's find shortcut: take it before the browser does
    const f3 = (e: KeyboardEvent) => { if (e.code === 'F3') { e.preventDefault(); if (!this.paused) this.tuner.toggle(); } };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', f3, true);
    document.addEventListener('visibilitychange', vis);
    mq?.addEventListener('change', rm);
    this.offs.push(() => window.removeEventListener('resize', resize), () => window.removeEventListener('keydown', f3, true), () => document.removeEventListener('visibilitychange', vis), () => mq?.removeEventListener('change', rm));
    this.resize();
    this.canvas.focus();
    this.loop.start();
    (window as unknown as { __tapeoutGame?: GameScreen }).__tapeoutGame = this;
    // the Level 1 recorder (scripts/record-level1.mjs, `?record` in the URL) signs off the lessons it shows but cannot
    // answer; it never runs for a player
    if (new URLSearchParams(location.search).has('record')) (window as unknown as { __tapeoutAward?: (id: string) => void }).__tapeoutAward = (id) => award(id, 50, 3);
  }

  private onKey(code: string) {
    if (this.paused || !this.ready) return;
    const b = this.input.bindings;
    if (b.pause.includes(code)) this.pause();
    else if (code === 'F9' && import.meta.env.DEV) this.debug = !this.debug;
  }

  pause() {
    if (this.paused || this.quitting) return;
    this.paused = true;
    this.loop.stop();
    this.input.clear();
    this.input.active = false;
    this.audio.fieldHum(false);
    this.audio.duck(true);
    this.audio.play('uiOpen');
    this.tuner.close();
    this.render(0);
    this.pauseEl = pauseMenu({
      input: this.input,
      resume: () => this.resume(),
      quit: () => this.quit(),
      onBindings: (b: Bindings) => (this.input.bindings = b),
      onSettings: () => { this.reduced = reducedMotion(); this.audio.applyVolumes(); this.story?.applyPrefs(); },
      story: !!this.story,
      sound: (s) => this.audio.play(s),
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
    const el = this.pauseEl;
    this.pauseEl = null;
    if (el) { el.classList.add('gm-leave'); setTimeout(() => el.remove(), 160); }
    this.paused = false;
    this.input.active = true;
    this.input.clear();
    this.audio.duck(false);
    this.audio.play('uiClose');
    this.canvas.focus();
    this.loop.start();
  }

  get isPaused() {
    return this.paused;
  }

  /** Quit to title: fade to black over 300 ms, then close. */
  quit() {
    if (this.quitting) return;
    this.quitting = true;
    this.audio.stopMusic(0.3);
    this.el.classList.add('gm-fading');
    setTimeout(() => this.close(), 320);
  }

  close(notify = true) {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
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

  /**
   * For the recorded demo and browser tests: a scripted player. Returns the actions held this step and the aim point
   * in world px, or null to hand control back to the keyboard and mouse.
   */
  drive: ((sim: Sim) => { held: Action[]; aim: { x: number; y: number } } | null) | null = null;
  /** For recordings: a close-up zoom about the drone (1 = the normal view). */
  zoom = 1;
  private driven: { held: Set<Action>; aim: { x: number; y: number } } | null = null;

  /** The mouse in view px (0..1280, 0..720). */
  private mouseView() {
    if (this.driven) return { x: this.driven.aim.x - this.cam.x, y: this.driven.aim.y - this.cam.y };
    const m = this.input.mouse, k = this.mouseScale;
    return { x: Math.max(0, Math.min(VIEW_W, (m.x - k.ox) / k.s)), y: Math.max(0, Math.min(VIEW_H, (m.y - k.oy) / k.s)) };
  }
  /** The mouse in world px. */
  private aimPoint() {
    if (this.driven) return this.driven.aim;
    const m = this.mouseView();
    return { x: m.x + this.cam.x, y: m.y + this.cam.y };
  }

  /** The boot sequence's timeline (P2), in seconds since the screen opened. */
  private bootTimes() {
    const text = BOOT.fadeIn + BOOT.eye, typed = text + this.bootLen / BOOT.cps;
    return { text, typed, hud: typed + BOOT.hold, control: typed + BOOT.hold + BOOT.hud };
  }

  private step() {
    const t0 = performance.now();
    this.age += 1 / HZ;
    const bt = this.bootTimes();
    if (!this.ready && this.age >= bt.control) { this.ready = true; this.input.clear(); if (this.story) this.story.live = true; }
    if (!this.ready) {
      this.sim.booting = this.age < bt.typed ? VITALS.bootSteps : Math.min(this.sim.booting, VITALS.bootSteps);
      if (Math.abs(this.age - BOOT.fadeIn) < 0.5 / HZ) { this.audio.play('boot'); this.audio.startMusic(this.track); }
    }
    // the game speed assist: below 100% some steps are skipped (the world runs slower; nothing else changes)
    if (this.story) {
      this.speedAcc += Math.max(50, Math.min(100, prefs().gameSpeed ?? 100)) / 100;
      if (this.speedAcc < 1 - 1e-9) return;
      this.speedAcc -= 1;
    }
    this.art.step(this.reduced);
    if (this.hitStop > 0) {
      // hit-stop: the world holds for a beat; particles keep moving so it reads as impact, not lag
      this.hitStop--;
      this.fx.step(this.sim.world.statics);
      return;
    }
    this.prev = { x: this.sim.drone.x, y: this.sim.drone.y };
    let input = this.input.sample();
    const prevHeld = this.driven?.held ?? new Set<Action>();
    const auto = this.ready ? this.drive?.(this.sim) ?? null : null;
    this.driven = auto ? { held: new Set(auto.held), aim: auto.aim } : null;
    if (this.driven) input = { held: this.driven.held, pressed: new Set([...this.driven.held].filter((a) => !prevHeld.has(a))) };
    if (!this.ready) input = { held: new Set(), pressed: new Set() };
    this.showLog = input.held.has('map');
    if (this.story) input = this.story.before(input);
    this.sim.step(input, this.aimPoint());
    this.handleFx();
    if (this.story) { this.story.after(); this.handleStory(); }
    this.cam.step(this.sim.drone, this.aimPoint(), this.sim.room, this.shakeRand);
    const solids: Rect[] = [...this.sim.world.statics, ...this.sim.world.props.filter((p) => !p.held).map((p) => boundsRect(p.body))];
    this.rig.step(this.sim, this.fx, solids);
    this.hud.step(this.sim);
    this.fx.step(this.sim.world.statics);
    this.fieldPower += ((this.sim.field.on ? 1 : 0) - this.fieldPower) * 0.3;
    this.audio.fieldHum(this.sim.field.on);
    this.respawnFade = Math.max(0, this.respawnFade - 1);
    this.stepMs.push(performance.now() - t0);
    if (this.stepMs.length > 240) this.stepMs.shift();
  }

  /** Turn the sim's fx records into particles, shake and sound. */
  private handleFx() {
    const sim = this.sim, fx = this.fx, a = this.audio, F = TUNING.feel;
    const noShake = prefs().reduceShake || this.reduced;
    for (const f of sim.fx) {
      switch (f.t) {
        case 'shot':
          fx.flash(f.x, f.y, f.weapon === 'charged' ? 30 : 14, f.weapon === 'charged' ? PAL.neon : PAL.trace, 3);
          a.play(f.weapon === 'charged' ? 'charged' : 'shot');
          this.cam.shake(f.weapon === 'charged' ? 4 : TUNING.probe.shake, f.weapon === 'charged' ? 140 : 60, noShake);
          break;
        case 'hit':
          if (f.enemy) {
            fx.sparks(f.x, f.y, -f.dx, -f.dy, F.sparks, f.armored ? '#FFFFFF' : PAL.neon, 4.5);
            fx.flash(f.x, f.y, f.armored ? 12 : 18, f.armored ? '#FFFFFF' : PAL.neon, 4);
            if (f.n > 0) fx.number(f.x, f.y, f.n, f.armored ? PAL.idle : PAL.text);
            a.play(f.armored ? 'clank' : 'hit');
          } else {
            fx.sparks(f.x, f.y, -f.dx, -f.dy, 3, PAL.trace, 3);
          }
          break;
        case 'kill':
          fx.shatter(f.outline, f.x, f.y, f.vx, f.vy, PAL.neon, Math.round(F.fragmentS * HZ));
          fx.flash(f.x, f.y, 46, PAL.neon, 8);
          fx.ring(f.x, f.y, 40, PAL.neon, 18);
          fx.sparks(f.x, f.y, 0, -1, 10, PAL.neon, 6, Math.PI);
          a.play('kill');
          this.hitStop = frames(F.hitStopMs);
          this.cam.shake(F.killShake, F.killShakeMs, noShake);
          break;
        case 'orb': a.play('orb', 0.7); fx.flash(f.x, f.y, 16, PAL.neon, 5); break;
        case 'reflect': a.play('reflect'); fx.ring(f.x, f.y, 18, PAL.trace, 10); fx.sparks(f.x, f.y, sim.aim.x, sim.aim.y, 4, PAL.trace, 4); break;
        case 'push': a.play('push'); fx.ring(f.x, f.y, 26, PAL.trace, 12); break;
        case 'grab': a.play('grab'); fx.ring(f.x, f.y, 22, PAL.trace, 10); break;
        case 'throw': a.play('throw', 0.6 + 0.5 * f.charge); fx.sparks(f.x, f.y, sim.aim.x, sim.aim.y, 4 + Math.round(f.charge * 6), PAL.trace, 4 + f.charge * 4); break;
        case 'drop': a.play('drop'); break;
        case 'thud': a.play('thud', Math.min(1, f.speed / 900)); fx.dust(f.x, f.y + 10, 3, 1); break;
        case 'jump': a.play('jump'); break;
        case 'land': if (f.speed > 120) a.play('land', Math.min(1, 0.3 + f.speed / 1200)); break;
        case 'dash': a.play('dash'); break;
        case 'hurt':
          a.play('hurt');
          fx.sparks(f.x, f.y, 0, -1, 8, '#FFFFFF', 4, Math.PI);
          this.cam.shake(TUNING.camera.hurtShake, TUNING.camera.hurtShakeMs, noShake);
          break;
        case 'death': a.play('death'); a.fieldHum(false); break;
        case 'respawn': this.respawnFade = frames(400); a.play('boot'); this.fx.clear(); break;
        case 'door': a.play('door'); this.cam.shake(2, 300, noShake); break;
        case 'swap': a.play('swap'); break;
        case 'fizzle': a.play('fizzle'); fx.sparks(f.x, f.y, sim.aim.x, sim.aim.y, 4, PAL.idle, 2); break;
        case 'repair': a.play('repair'); break;
        case 'enemyBoot': fx.ring(f.x, f.y, 30, PAL.neon, 20); break;
        // a ring grows from 0.2 to 1.2 of its size, so size radius / 1.2 ends at the drop's radius
        case 'slam': a.play('land', 1.3); fx.ring(f.x, f.y, UP.drop.radius / 1.2, PAL.trace, frames(250)); this.cam.shake(2, 200, noShake); break;
        case 'hover': a.play('hover'); break;
        case 'sync': a.play('freeze'); fx.ring(f.x, f.y, 80, PAL.trace, 24); fx.ring(f.x, f.y, 140, PAL.trace, 30); break;
        case 'rail': a.play('grab'); fx.sparks(f.x, f.y - 30, 0, -1, 6, PAL.trace, 3, Math.PI); break;
        case 'parry':
          a.play('parry');
          fx.ring(f.x, f.y, 56, '#FFFFFF', 16);
          fx.flash(f.x, f.y, 30, '#FFFFFF', 4);
          this.hitStop = frames(UP.parry.hitStopMs);
          break;
        // the ring grows to 1.2 of its size, so the visor's edge is where the ring ends
        case 'scan': a.play('scan'); fx.ring(f.x, f.y, f.r / 1.2, PAL.gold, frames(400)); break;
        case 'turret': a.play('turret'); fx.ring(f.x, f.y - 30, 26, PAL.trace, 14); fx.dust(f.x, f.y, 3, 1); break;
        case 'tether': a.play('tether'); fx.sparks(f.tx, f.ty, f.x - f.tx, f.y - f.ty, 5, PAL.amber, 3); break;
        case 'phase': a.play('phase'); fx.ring(f.x, f.y, 34, PAL.neon, 12); break;
      }
    }
    if (sim.weapon === 'charged' && sim.charge > 0 && sim.charge < 1 && sim.steps % 6 === 0) a.play('charge', 0.4 + sim.charge * 0.6);
  }

  /** The overlay host the story's DOM layer mounts into. */
  private host: OverlayHost = {
    el: null as unknown as HTMLElement,
    sound: (s) => this.audio.play(s),
    busy: (on) => {
      this.input.active = !on;
      this.input.clear();
      this.audio.duck(on);
      this.audio.fieldHum(false);
      if (!on) this.canvas.focus();
    },
  };

  /** Turn the director's out records into sound, shake, overlays and room loads. */
  private handleStory() {
    const st = this.story!, host = this.host;
    host.el = this.el;
    const noShake = prefs().reduceShake || this.reduced;
    const outs = st.out;
    st.out = [];
    for (const o of outs) {
      switch (o.t) {
        case 'sfx': this.audio.play(o.name as Sfx, o.gain ?? 1); break;
        case 'shake': this.cam.shake(o.px, o.ms, noShake); break;
        case 'music': this.track = o.track; if (this.age >= BOOT.fadeIn) this.audio.startMusic(o.track); break;
        case 'shatter': {
          const r = o.rect, outline = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
          this.fx.shatter(outline, r.x + r.w / 2, r.y + r.h / 2, 2, -1, PAL.x, Math.round(TUNING.feel.fragmentS * HZ));
          this.fx.flash(r.x + r.w / 2, r.y + r.h / 2, 60, PAL.x, 8);
          break;
        }
        case 'enter':
          this.art = new WorldArt(this.sim.room);
          this.rig = new DroneRig();
          this.fx.clear();
          this.cam.snap(this.sim.drone, this.sim.room);
          this.prev = { x: this.sim.drone.x, y: this.sim.drone.y };
          this.hud.syncKit(this.sim);
          break;
        case 'overlay':
          if (o.kind === 'module') openModule(host, o.module, () => {}, (passed) => st.overlayClosed(o.module, passed));
          else if (o.kind === 'panel' || o.kind === 'bench') openLab(host, o.kind, o.module, (passed) => st.overlayClosed(o.module, passed));
          else openPort(host, o.module, (ok) => { if (ok) st.lampOn(); }, (passed) => st.overlayClosed(o.module, passed));
          break;
        case 'card': openCard(host, o, () => st.cardClosed()); break;
        case 'choose': openChoice(host, { title: o.title, options: o.options, back: o.kind === 'cause' || o.kind === 'loftLift' ? 'Back' : undefined }, (i) => st.chose(o.kind, i)); break;
        case 'profile': st.waiting = true; openProfile(host, () => { st.waiting = false; st.applyPrefs(); }); break;
        case 'loft':
          if (o.station === 'crt') { this.quit(); break; }
          if (o.station === 'interview') break;
          if (o.station === 'map' || o.station === 'board' || o.station === 'review' || o.station === 'calib' || o.station === 'patrol') {
            openLoftPanel(host, o.station, this.loftActions(), () => { st.waiting = false; });
            break;
          }
          openLoft(host, o.station, {
            log: st.world.heard,
            openLesson: (id) => { st.waiting = true; openPort(host, id, () => {}, (passed) => st.overlayClosed(id, passed)); },
            settings: () => { this.quit(); setTimeout(() => (location.hash = '#/settings'), 340); },
          }, () => { st.waiting = false; });
          break;
      }
    }
  }

  /** What the Loft's panels can do: open a module at its station's window, ride to a place, run the Daily Mix. */
  private loftActions(): LoftActions {
    const st = this.story!, host = this.host, done = (id: string) => !!levelRecord(id);
    return {
      openModule: (id) => { st.waiting = true; openModule(host, id, () => {}, (passed) => st.overlayClosed(id, passed)); },
      go: (place) => st.go(place, 0),
      openMix: () => { st.waiting = true; openPort(host, 'mix', () => {}, () => { st.waiting = false; st.applyKit(true); }, { label: 'DAILY MIX', practice: true }); },
      mk2: (chapter) => {
        const ids = calibRows(done).find((r) => r.chapter === chapter)?.banks.map((b) => b.id) ?? [];
        const u = UPGRADES.find((x) => x.mk2?.banks.some((b) => ids.includes(b)));
        const m = u ? mk2(u.id, done) : null;
        return u && m ? { name: u.name, ...m } : null;
      },
    };
  }

  /** For the recorder and tests: the arcade's frame inside the game. */
  get arcadeMount() { return gameMount(this.host); }

  private stress() {
    this.sim.stress();
    // fill the particle pool too, so the frame budget is measured at the plan's worst case
    for (let i = 0; i < 400; i++) this.fx.spawn({ kind: 'spark', x: 2400 + Math.random() * 1100, y: 500 + Math.random() * 400, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4, life: 600, len: 6, size: 1.5, color: PAL.neon, grav: 0.02, drag: 0.99 });
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
    const dx = this.prev.x + (sim.drone.x - this.prev.x) * alpha, dy = this.prev.y + (sim.drone.y - this.prev.y) * alpha;
    if (this.zoom !== 1) {
      // close-up for recordings: scale the world about the drone, which sits a little below the middle of the view
      c.translate(VIEW_W / 2, VIEW_H * 0.6);
      c.scale(this.zoom, this.zoom);
      c.translate(-(dx - camX), -(dy - camY));
    }
    c.translate(-camX, -camY);
    const t = sim.steps + alpha;
    const cam = { x: camX, y: camY };
    const reducedFlash = prefs().reduceFlash;
    this.art.drawBackdrop(c, cam);
    this.art.drawSigns(c);
    this.art.drawFixtures(c, sim, t);
    const st = this.story;
    if (st) drawStoryBack(c, st, t);
    this.art.drawSolids(c, sim, cam);
    this.art.drawProps(c, sim, t);
    drawAct3Back(c, sim, t);
    if (st) drawStoryFront(c, st, t, { x: dx + sim.drone.facing * 12, y: dy - 4 });
    drawEnemies(c, sim, t, reducedFlash);
    drawBeam(c, sim, t);
    drawLoopDrone(c, sim, t);
    const core = { x: dx, y: dy - sim.drone.h / 2 + 13 };
    const emitter = { x: dx - sim.drone.facing * 9, y: core.y - 1 };
    drawField(c, sim, core.x, core.y, emitter.x, emitter.y, t, this.fieldPower);
    if (this.ready && sim.kit.gun && !(sim.field.on && sim.field.held)) {
      const m = { x: dx + sim.drone.facing * 8 + sim.aim.x * TUNING.anim.barrel, y: dy - sim.drone.h / 2 + 2 + sim.aim.y * TUNING.anim.barrel };
      drawAimLine(c, sim, m.x, m.y);
    }
    this.rig.draw(c, sim, dx, dy, { reducedFlash, reduced: this.reduced });
    drawShots(c, sim, alpha);
    drawAct3Front(c, sim, t);
    this.fx.draw(c, alpha, reducedFlash, prefs().damageNumbers);
    if (st) drawPrompt(c, st, t);
    this.art.drawMotes(c, cam);
    c.restore();

    // view space: the dark, vignette, HUD, TAPEOUT, boot text, crosshair, fades
    if (st) drawDark(c, st, cam, { x: dx, y: dy - sim.drone.h / 2 + 13 }, this.dark);
    this.art.drawVignette(c);
    drawSyncTint(c, sim, VIEW_W, VIEW_H, this.reduced);
    const bt = this.bootTimes();
    this.hud.draw(c, sim, Math.max(0, Math.min(1, (this.age - bt.hud) / BOOT.hud)), t);
    if (st) { drawBossHud(c, st, t, this.showLog); drawCompass(c, st, cam, t, this.reduced); drawBubble(c, st, t); drawExitLift(c, st.exitLift); }
    if (!this.ready || this.age < bt.control + 1) this.drawBoot(c, bt);
    if (this.ready && !this.paused && (sim.kit.gun || sim.kit.coil)) { const m = this.mouseView(); this.hud.crosshair(c, sim, m.x, m.y); }
    let black = 0;
    if (this.age < BOOT.fadeIn + BOOT.eye) black = 1 - easeOut((this.age - BOOT.fadeIn) / BOOT.eye);
    if (sim.dying > 0) black = Math.max(black, Math.max(0, (1 - sim.dying / VITALS.deathSteps - 0.6) / 0.4));
    if (this.respawnFade > 0) black = Math.max(black, this.respawnFade / frames(400));
    if (st?.fade) { const half = frames(TUNING.story.fadeMs); black = Math.max(black, st.fade.t < half ? st.fade.t / half : 1 - (st.fade.t - half) / half); }
    if (black > 0) { c.fillStyle = rgba('#000000', Math.min(1, black)); c.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.paused) { c.fillStyle = 'rgba(11,10,26,0.35)'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.debug) this.drawDebug(c);
  }

  /** Three lines of boot text typed at 40 characters a second, then faded out (P2). */
  private drawBoot(c: CanvasRenderingContext2D, bt: ReturnType<GameScreen['bootTimes']>) {
    if (this.age < bt.text) return;
    let chars = Math.floor((this.age - bt.text) * BOOT.cps);
    const fade = this.ready ? Math.max(0, 1 - (this.age - bt.control) / 1) : 1;
    c.save();
    c.font = `14px ${FONT}`;
    c.textBaseline = 'top';
    const x = 24, y = 72; // under the HUD, clear of the drone
    const lines = this.bootLines;
    lines.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, chars));
      chars -= line.length;
      if (n <= 0 && i > 0) return;
      const s = line.slice(0, n);
      c.fillStyle = rgba(i === lines.length - 1 ? PAL.gold : PAL.trace, 0.9 * fade);
      c.fillText(s, x, y + i * 22);
      if (n < line.length && n > 0 && Math.floor(this.age * 6) % 2) c.fillRect(x + c.measureText(s).width + 2, y + i * 22, 8, 15);
    });
    c.restore();
  }

  /** Frame statistics, for the debug overlay and the frame-budget check. */
  frameStats() {
    const pct = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
    const f = this.loop.stats.frameMs, w = this.loop.stats.workMs;
    return { fps: f.length ? 1000 / (f.reduce((a, b) => a + b, 0) / f.length) : 0, workAvg: w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0, workP95: pct(w, 0.95), stepP95: pct(this.stepMs, 0.95), frames: f.length, particles: this.fx.count, enemies: this.sim.enemies.filter((e) => e.alive).length, props: this.sim.world.props.length };
  }

  /** For the browser test: reset the frame statistics. */
  resetStats() {
    this.loop.stats.frameMs.length = 0;
    this.loop.stats.workMs.length = 0;
    this.stepMs.length = 0;
  }

  /** For the browser test: run the stress scene. */
  stressTest() { this.stress(); }

  private drawDebug(c: CanvasRenderingContext2D) {
    const d = this.sim.drone, s = this.frameStats();
    const lines = [
      `fps ${s.fps.toFixed(0)}  frame work ${s.workAvg.toFixed(2)} ms (p95 ${s.workP95.toFixed(2)})  step p95 ${s.stepP95.toFixed(2)} ms`,
      `pos ${d.x.toFixed(1)}, ${d.y.toFixed(1)}  vel ${(d.vx * 60).toFixed(0)}, ${(d.vy * 60).toFixed(0)} px/s`,
      `ground ${d.grounded ? (d.onOneWay ? 'one-way' : 'yes') : 'no'}  wall ${d.wall}  coyote ${d.coyote}  buffer ${d.buffer}`,
      `energy ${this.sim.vitals.energy.toFixed(0)}  shots ${this.sim.shots.length}  particles ${s.particles}  enemies ${s.enemies}  props ${s.props}`,
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

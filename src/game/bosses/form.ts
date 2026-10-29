// A boss's body in its arena (Phase 3 Spec, section 6): the line-art form an incident fights in, running its attacks
// one at a time, one every 2.4 s (1.8 s enraged, 1.6 s once the fix is in; twice as long on Story), and the temporary
// hazards they leave. The investigation and the health stay in story/boss.ts; this is the part that fights back.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { HZ } from '../tuning';
import { ATTACKS, BODIES } from './table';
import type { Attack, AttackCtx, BodyState, BossForm } from './types';

/** Seconds between attacks: calm, enraged, finish. */
const GAP = { calm: 2.4, enraged: 1.8, finish: 1.6 };
/** Steps of drone positions the mirror twin can replay (3 s). */
const TRAIL = 3 * HZ;

export class FormRun {
  /** Steps since the fight started. */
  t = 0;
  private wait: number;
  private turn = 0;
  private now: { a: Attack<unknown>; run: unknown } | null = null;
  /** Drone positions (top-left), oldest first. */
  trail: { x: number; y: number }[] = [];
  /** Live hazards: a rect that hurts on touch until `until` (steps). */
  hazards: { r: Rect; until: number; dmg: number }[] = [];
  flash = 0;
  /** Live platforms from the push attack: solid to stand on until `until` (steps). The director mirrors them into the sim. */
  platforms: { r: Rect; until: number }[] = [];

  constructor(readonly form: BossForm, readonly box: Rect, private story: boolean) {
    this.wait = this.gap('calm');
  }

  private gap(k: keyof typeof GAP) { return Math.round(GAP[k] * HZ * (this.story ? 2 : 1)); }

  /** One step. `mood` picks the pace; `hold` pauses attacks (a card is open, or the boss is down). */
  step(c: AttackCtx, mood: 'calm' | 'enraged' | 'finish', hold: boolean) {
    this.t++;
    if (this.flash > 0) this.flash--;
    this.trail.push({ x: c.drone.x, y: c.drone.y });
    if (this.trail.length > TRAIL) this.trail.shift();
    this.hazards = this.hazards.filter((h) => h.until > this.t);
    this.platforms = this.platforms.filter((p) => p.until > this.t);
    for (const h of this.hazards) c.hurt(h.r, h.dmg);
    if (hold) return;
    const speed = mood === 'finish' ? 1.4 : mood === 'enraged' ? 1.25 : 1;
    if (this.now) {
      if (this.now.a.step(this.now.run, c, speed)) { this.now = null; this.wait = this.gap(mood); }
      return;
    }
    if (--this.wait > 0) return;
    const a = ATTACKS[this.form.attacks[this.turn++ % this.form.attacks.length]];
    this.now = { a, run: a.start(c) };
  }

  /** Add a hazard for `ms` (the freeze attack's frosted platforms). */
  hazard(r: Rect, ms: number, dmg: number) { this.hazards.push({ r, until: this.t + Math.round((ms / 1000) * HZ), dmg }); }

  /** Add a platform for `ms` (the Bad Call's push). */
  platform(r: Rect, ms: number) { this.platforms.push({ r, until: this.t + Math.round((ms / 1000) * HZ) }); }

  /** Whether a rect overlaps a live hazard (for tests). */
  hits(r: Rect) { return this.hazards.some((h) => overlaps(h.r, r)); }

  /** What the body drawer is told. */
  state(hp: number, shielded: boolean, enraged: boolean): BodyState {
    const run = this.now?.run as { tele?: number; age?: number; lit?: boolean[]; away?: number } | undefined;
    const tele = run?.tele && run.age !== undefined && run.age < run.tele ? run.age / run.tele : 0;
    return {
      t: this.t, hp, shielded, enraged, flash: this.flash,
      attack: this.now?.a.id ?? null, telegraph: tele,
      lit: run?.lit ?? [false, false, false, false], away: run?.away ?? 0,
    };
  }

  draw(g: CanvasRenderingContext2D, s: BodyState, t: number) {
    BODIES[this.form.body](g, this.box, s);
    if (this.now) this.now.a.draw(g, this.now.run, t);
  }
}

// A boss fight (Level 1 spec, "Boss"; Phase 3 Spec, section 6): one of today's incident investigations, played in an
// arena. Level 1's is the Dark Demo Board. The Investigation (src/incidents/engine.ts) keeps every rule: the budget,
// the readings and their cost, the crossing-off, a guess sent back, the fix menu, the stars. This class adds the fight
// around it: phases, the boss's shield and health, the enrage after a wrong call, and the per-node read cooldown.
// Pure: the director feeds it steps.
import { demoBoardIncident } from '../../incidents/first';
import { type FixOption, Investigation, seeded } from '../../incidents/engine';
import type { Incident } from '../../incidents/types';
import { frames, TUNING } from '../tuning';

export type BossPhase = 'pager' | 'investigate' | 'fix' | 'finish' | 'done';

export interface Reading { key: string; text: string; cost: number; repeat: boolean; ruledOut: string[]; left: number }

export class BossFight {
  inv: Investigation;
  phase: BossPhase = 'pager';
  readonly maxHp: number;
  hp: number;
  /** Steps left of the enrage after a wrong diagnosis. */
  enraged = 0;
  /** Steps left of a shield dropped by a wrong fix (it comes back). */
  tempDown = 0;
  /** Readings in the order taken, for the boss log. */
  log: Reading[] = [];
  /** Causes the coach has crossed off (they no longer fit the readings). */
  struck = new Set<string>();
  private fixOpts: FixOption[] | null = null;
  private cool = new Map<string, number>();
  private steps = 0;
  /** How many times the board went dark again (a guess sent back, or the clock ran out). */
  restarts = 0;

  /** Any incident can be the boss (Phase 3 Spec, section 6); `hp` is its Standard health (Level 1: the board's). */
  constructor(story: boolean, private seed = (Date.now() >>> 0) || 1, cause?: string, readonly incident: Incident = demoBoardIncident, hp: number = TUNING.story.boss.hp) {
    const B = TUNING.story.boss;
    this.maxHp = Math.round(hp * (story ? B.storyHp : 1));
    this.hp = this.maxHp;
    this.inv = new Investigation(incident, seed, cause);
  }

  /** The shield is down for good once the right fix is in. */
  get shielded() { return this.phase !== 'finish' && this.tempDown <= 0; }

  step() {
    this.steps++;
    if (this.enraged > 0) this.enraged--;
    if (this.tempDown > 0) this.tempDown--;
  }

  /** Take a reading at a node ("flip 00", "look"). Null while that node is cooling down. */
  read(arg: string): Reading | null {
    if (this.phase !== 'investigate') return null;
    if ((this.cool.get(arg) ?? -1) > this.steps) return null;
    this.cool.set(arg, this.steps + frames(TUNING.story.boss.readCooldownMs));
    const [cmd, ...a] = arg.split(' ');
    const ins = this.inv.find(cmd)!;
    const before = this.inv.evidence();
    const m = this.inv.measure(ins, a.join(' '));
    const now = this.inv.evidence();
    const ruledOut = m.repeat ? [] : before.filter((c) => !now.includes(c));
    ruledOut.forEach((c) => this.struck.add(c));
    const r: Reading = { key: arg, text: m.text, cost: m.cost, repeat: m.repeat, ruledOut, left: now.length };
    if (!m.repeat) this.log.push(r);
    return r;
  }

  /** The cause list for the debug port: every cause, crossed off or ruled out by a wrong call. */
  causes() {
    return this.inc().causes.map((c) => ({ id: c.id, name: c.name, struck: this.struck.has(c.id), out: this.inv.ruledOut.has(c.id) }));
  }
  private inc() { return this.inv.inc; }

  /** Causes that still fit every reading (the "Diagnose anyway?" guard asks when there is more than one). */
  fits() { return this.inv.evidence(); }

  /** Name the cause. Wrong: costs time and enrages the board. Right but not proven: sent back. Right: on to the fix. */
  diagnose(id: string): 'wrong' | 'guessed' | 'right' | 'late' {
    const ok = this.inv.diagnose(id);
    if (!ok) {
      this.enraged = frames(TUNING.story.boss.enrageMs);
      return this.inv.left <= 0 ? 'late' : 'wrong';
    }
    if (this.inv.guessed) return 'guessed';
    this.phase = 'fix';
    return 'right';
  }

  fixes(): FixOption[] {
    this.fixOpts ??= this.inv.fixOptions(seeded(this.seed ^ 0x5f));
    return this.fixOpts;
  }

  /** Put a fix in. A wrong one costs time and drops the shield for a moment only. */
  fix(i: number): 'wrong' | 'right' | 'late' {
    const o = this.fixes()[i];
    if (this.inv.applyFix(o)) { this.phase = 'finish'; return 'right'; }
    this.fixOpts = this.fixes().filter((x) => x !== o);
    this.tempDown = frames(TUNING.story.boss.bandaidShieldMs);
    return this.inv.left <= 0 ? 'late' : 'wrong';
  }

  /** Damage the board. While unsolved it never drops below a quarter: only the real fix lets it fall. Returns true when
   * the board is beaten. */
  hit(n: number): boolean {
    if (this.shielded || this.phase === 'done') return false;
    const floor = this.phase === 'finish' ? 0 : Math.round(this.maxHp / 4);
    this.hp = Math.max(floor, this.hp - n);
    if (this.hp <= 0) { this.phase = 'done'; return true; }
    return false;
  }

  /** The board goes dark again with a new root cause: after a guess, or when the clock runs out. Readings reset. */
  restart() {
    this.restarts++;
    this.seed = (this.seed * 1103515245 + 12345) >>> 0 || 7;
    this.inv = new Investigation(this.incident, this.seed);
    this.phase = 'investigate';
    this.hp = this.maxHp;
    this.log = [];
    this.struck.clear();
    this.fixOpts = null;
    this.cool.clear();
    this.enraged = 0;
    this.tempDown = 0;
  }

  stars() { return this.inv.stars(); }

  /** What a careful expert would have spent on the same case (the debrief's benchmark). */
  expertMinutes(): number {
    const ex = new Investigation(this.inv.inc, this.inv.world.seed, this.inv.world.cause);
    for (let g = 0; g < 50; g++) { const nx = ex.bestNext(); if (!nx) break; ex.measure(nx.ins, nx.arg); }
    return ex.spent;
  }
}

// The investigation state machine. Pure: no DOM, seeded randomness, so it can be tested exhaustively.
import type { Rng } from '../lessons/types';
import { HINT_COST, type Incident, type Instrument, WRONG_COST, type World } from './types';

/** mulberry32: a small, fast seeded generator. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('\u0000')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const key = (cmd: string, arg = '') => (arg ? `${cmd} ${arg}` : cmd);

/** Every (instrument, argument) pair an incident offers. */
export const probes = (inc: Incident): { ins: Instrument; arg: string }[] =>
  inc.instruments.flatMap((ins) => (ins.args?.length ? ins.args.map((arg) => ({ ins, arg })) : [{ ins, arg: '' }]));

export interface FixOption { text: string; right: boolean; why: string }

export class Investigation {
  readonly world: World;
  spent = 0;
  mistakes = 0;
  hints = 0;
  /** Readings taken so far, in order. */
  readonly notes = new Map<string, string>();
  readonly ruledOut = new Set<string>();
  diagnosed = false;
  solved = false;
  /** Set when any call was made while the readings alone still left several causes standing. */
  guessed = false;
  /** A reading that would have split the candidates at the moment of the first guess. */
  guessHint: { ins: Instrument; arg: string } | undefined;

  constructor(readonly inc: Incident, seed: number, cause?: string) {
    const v = inc.setup?.(seeded(hash(seed, 'setup'))) ?? {};
    const pool = inc.pool ?? inc.causes.map((c) => c.id);
    const pickR = seeded(hash(seed, 'cause'));
    this.world = { seed, v, cause: cause ?? pool[Math.floor(pickR() * pool.length)] };
  }

  get left() { return this.inc.budget - this.spent; }
  get over() { return this.left <= 0 && !this.solved; }
  get cause() { return this.inc.causes.find((c) => c.id === this.world.cause)!; }

  /** What an instrument would show if `cause` were the root cause (same noise, same world). */
  readAs(cause: string, ins: Instrument, arg: string): string {
    return ins.read({ ...this.world, cause }, arg, seeded(hash(this.world.seed, ins.cmd, arg)));
  }

  find(cmd: string): Instrument | undefined {
    const c = cmd.toLowerCase();
    return this.inc.instruments.find((i) => i.cmd === c);
  }

  /** Take a reading. Repeating one is free: it comes from your notebook. */
  measure(ins: Instrument, arg = ''): { text: string; cost: number; repeat: boolean } {
    const k = key(ins.cmd, arg);
    const prev = this.notes.get(k);
    if (prev !== undefined) return { text: prev, cost: 0, repeat: true };
    const text = this.readAs(this.world.cause, ins, arg);
    this.notes.set(k, text);
    this.spent += ins.cost;
    return { text, cost: ins.cost, repeat: false };
  }

  /** Causes still consistent with every reading taken (and not already ruled out by a failed fix). */
  consistent(): string[] {
    return this.inc.causes.map((c) => c.id).filter((id) => !this.ruledOut.has(id) && [...this.notes].every(([k, text]) => {
      const [cmd, ...a] = k.split(' ');
      return this.readAs(id, this.find(cmd)!, a.join(' ')) === text;
    }));
  }

  /** Causes the readings alone cannot tell apart (wrong calls do not count as evidence). */
  byEvidence(): string[] {
    const keep = new Set(this.ruledOut);
    this.ruledOut.clear();
    const c = this.consistent();
    keep.forEach((k) => this.ruledOut.add(k));
    return c;
  }

  /**
   * The most useful next reading: the one whose worst case leaves the fewest candidates, cheapest first on ties.
   * This is what the senior engineer suggests, and what the solvability tests play.
   */
  bestNext(): { ins: Instrument; arg: string } | undefined {
    const cands = this.consistent();
    if (cands.length <= 1) return undefined;
    let best: { ins: Instrument; arg: string; worst: number } | undefined;
    for (const p of probes(this.inc)) {
      if (this.notes.has(key(p.ins.cmd, p.arg))) continue;
      const groups = new Map<string, number>();
      for (const c of cands) { const t = this.readAs(c, p.ins, p.arg); groups.set(t, (groups.get(t) ?? 0) + 1); }
      const worst = Math.max(...groups.values());
      if (worst === cands.length) continue;
      if (!best || worst < best.worst || (worst === best.worst && p.ins.cost < best.ins.cost)) best = { ...p, worst };
    }
    return best;
  }

  /** Ask a senior engineer: costs time, suggests the next reading. */
  hint(): { ins: Instrument; arg: string } | undefined {
    this.hints++;
    this.spent += HINT_COST;
    return this.bestNext();
  }

  /** Commit to a root cause. A wrong one costs time and is crossed off. */
  diagnose(id: string): boolean {
    if (!this.guessed && this.byEvidence().length > 1) {
      this.guessHint = this.bestNext();
      this.guessed = true;
    }
    if (id === this.world.cause) { this.diagnosed = true; return true; }
    this.mistakes++;
    this.spent += WRONG_COST;
    this.ruledOut.add(id);
    return false;
  }

  /** The fix menu: the right fix, two other causes' fixes, and the symptom-only fixes. */
  fixOptions(r: Rng): FixOption[] {
    const others = this.inc.causes.filter((c) => c.id !== this.world.cause);
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const opts: FixOption[] = [
      { text: this.cause.fix, right: true, why: this.cause.story },
      ...others.slice(0, 2).map((c) => ({ text: c.fix, right: false, why: `That fixes a different problem (${c.name.charAt(0).toLowerCase() + c.name.slice(1)}), not this one.` })),
      ...this.inc.bandaids.map((b) => ({ text: b.text, right: false, why: b.why })),
    ];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return opts;
  }

  applyFix(o: FixOption): boolean {
    if (o.right) { this.solved = true; return true; }
    this.mistakes++;
    this.spent += WRONG_COST;
    return false;
  }

  /** 3: clean and quick. 2: one slip or hint. 1: solved anyway. 0: not solved within budget, or the diagnosis was a guess. */
  stars(): number {
    if (!this.solved || this.left < 0 || this.guessed) return 0;
    const slips = this.mistakes + this.hints;
    if (slips === 0 && this.left >= this.inc.budget * 0.25) return 3;
    return slips <= 1 ? 2 : 1;
  }
}

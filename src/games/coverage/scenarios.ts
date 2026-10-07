// Constrained-random coverage closure. The player writes a test as a list of "phases"
// (think UVM sequences), each with dist weights for every knob and a transaction count.
// A model DUT with one planted bug runs the stimulus, a coverage model samples it, and a
// scoreboard reports the bug only when it is both triggered and observed.

import { rng } from '../../sim/harness';

export interface Knob {
  id: string;
  label: string;
  options: { id: string; label: string }[];
  defaults: Record<string, number>;
}

export interface Bin {
  id: string;
  group: string;
  label: string;
}

export interface Phase {
  count: number;
  weights: Record<string, Record<string, number>>; // knob -> option -> weight
}

export interface TxnLog {
  n: number;
  text: string;
  hits: string[];
  error?: string;
}

export interface RunOutcome {
  hits: Record<string, number>;
  log: TxnLog[];
  bugAt?: number;
  bugMessage?: string;
  total: number;
}

export interface Scenario {
  id: string;
  title: string;
  concept: string;
  xp: number;
  brief: string;
  knobs: Knob[];
  bins: Bin[];
  budget: number;
  par: number;
  maxPhases: number;
  run(phases: Phase[], seed: number): RunOutcome;
}

function pick(r: () => number, weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total) return Object.keys(weights)[0];
  let x = r() * total;
  for (const [k, w] of entries) {
    if ((x -= w) < 0) return k;
  }
  return entries[entries.length - 1][0];
}

const hx = (v: number) => `0x${v.toString(16).toUpperCase().padStart(2, '0')}`;

// ---------------------------------------------------------------- ALU

const ALU_OPS = ['ADD', 'SUB', 'AND', 'XOR', 'SHL'] as const;

const alu: Scenario = {
  id: 'cov-alu',
  title: 'Corner Cases',
  concept: 'constrained random & functional coverage',
  xp: 250,
  brief: `
    <p>Directed tests check what you thought of. <b>Constrained-random</b> tests find what you didn't &mdash; but pure random
    stimulus almost never hits corners: an 8-bit operand is 0 only 1 time in 256.</p>
    <p><b>Functional coverage</b> measures which interesting scenarios actually happened. In SystemVerilog you'd bias the
    randomization with a <code>dist</code> constraint:</p>
    <pre>constraint c_a { a_kind dist { ZERO := 2, MAX := 2, RAND := 6 }; }</pre>
    <p>Build a test out of phases (like UVM sequences), each with its own weights. Simulation time costs money: the
    regression budget is limited.</p>
    <h4>Goal</h4><ul><li>Reach 100% coverage <b>and</b> find the bug the designer hid in the ALU.</li>
    <li>3 stars: do it in 150 transactions or fewer.</li></ul>`,
  knobs: [
    { id: 'op', label: 'opcode', options: ALU_OPS.map((o) => ({ id: o, label: o })), defaults: { ADD: 1, SUB: 1, AND: 1, XOR: 1, SHL: 1 } },
    { id: 'a', label: 'operand a', options: [{ id: 'zero', label: "8'h00" }, { id: 'max', label: "8'hFF" }, { id: 'rand', label: 'random' }], defaults: { zero: 0, max: 0, rand: 1 } },
    { id: 'b', label: 'operand b', options: [{ id: 'zero', label: "8'h00" }, { id: 'max', label: "8'hFF" }, { id: 'rand', label: 'random' }, { id: 'eq', label: 'b == a' }], defaults: { zero: 0, max: 0, rand: 1, eq: 0 } },
  ],
  bins: [
    ...ALU_OPS.map((o) => ({ id: `op_${o}`, group: 'cp_op', label: o })),
    { id: 'a_zero', group: 'cp_a', label: 'a == 0' },
    { id: 'a_max', group: 'cp_a', label: "a == 8'hFF" },
    { id: 'b_zero', group: 'cp_b', label: 'b == 0' },
    { id: 'b_max', group: 'cp_b', label: "b == 8'hFF" },
    { id: 'add_carry', group: 'cp_flags', label: 'ADD sets carry' },
    { id: 'sub_borrow', group: 'cp_flags', label: 'SUB borrows (a < b)' },
    { id: 'sub_zero', group: 'cp_flags', label: 'SUB result is zero' },
    { id: 'shl_7', group: 'cp_flags', label: 'SHL by 7' },
    ...ALU_OPS.map((o) => ({ id: `x_${o}_bmax`, group: 'cx_op_b', label: `${o} × b == FF` })),
  ],
  budget: 600,
  par: 150,
  maxPhases: 4,
  run(phases, seed) {
    const r = rng(seed);
    const hits: Record<string, number> = {};
    const log: TxnLog[] = [];
    let n = 0, bugAt: number | undefined, bugMessage: string | undefined;
    const operand = (kind: string, a?: number) => kind === 'zero' ? 0 : kind === 'max' ? 255 : kind === 'eq' ? a! : Math.floor(r() * 256);
    for (const ph of phases) {
      for (let i = 0; i < ph.count; i++) {
        n++;
        const op = pick(r, ph.weights.op) as (typeof ALU_OPS)[number];
        const a = operand(pick(r, ph.weights.a));
        const b = operand(pick(r, ph.weights.b), a);
        const full = op === 'ADD' ? a + b : op === 'SUB' ? a - b : op === 'AND' ? a & b : op === 'XOR' ? a ^ b : a << (b & 7);
        const y = full & 0xff;
        const zeroExp = y === 0 ? 1 : 0;
        // Planted bug: the zero flag is taken from the adder path, so SUB never sets it.
        const zeroDut = op === 'SUB' ? 0 : zeroExp;
        const h: string[] = [`op_${op}`];
        if (a === 0) h.push('a_zero');
        if (a === 255) h.push('a_max');
        if (b === 0) h.push('b_zero');
        if (b === 255) { h.push('b_max'); h.push(`x_${op}_bmax`); }
        if (op === 'ADD' && full > 255) h.push('add_carry');
        if (op === 'SUB' && a < b) h.push('sub_borrow');
        if (op === 'SUB' && y === 0) h.push('sub_zero');
        if (op === 'SHL' && (b & 7) === 7) h.push('shl_7');
        for (const b2 of h) hits[b2] = (hits[b2] ?? 0) + 1;
        const t: TxnLog = { n, text: `${op.padEnd(3)} a=${hx(a)} b=${hx(b)} -> y=${hx(y)} z=${zeroDut}`, hits: h };
        if (zeroDut !== zeroExp && bugAt === undefined) {
          bugAt = n;
          bugMessage = `UVM_ERROR @ txn ${n} [SCBD] ${op} ${hx(a)} - ${hx(b)}: zero flag mismatch, expected ${zeroExp} got ${zeroDut}`;
          t.error = bugMessage;
        }
        if (log.length < 400) log.push(t);
      }
    }
    return { hits, log, bugAt, bugMessage, total: n };
  },
};

// ---------------------------------------------------------------- FIFO

const DEPTH = 32;

const fifo: Scenario = {
  id: 'cov-fifo',
  title: 'Fill It Up',
  concept: 'sequences, corner states & observability',
  xp: 300,
  brief: `
    <p>Some bugs hide behind <b>state</b>, not values. A FIFO only misbehaves when it's full or empty, and a 50/50
    push/pop random walk hovers near empty almost forever.</p>
    <p>To reach deep states you need <b>sequences</b>: a phase that fills, a phase that hammers the full FIFO,
    a phase that drains. That's what layered (nested) sequences are for; virtual sequences do the same across several sequencers.</p>
    <p>And remember: a bug that corrupts data is only <b>found</b> when the corrupted data comes out and the
    scoreboard compares it. Triggering isn't enough &mdash; you need <b>observability</b>.</p>
    <h4>Goal</h4><ul><li>100% coverage of the 32-deep FIFO and the scoreboard catching the bug.</li>
    <li>3 stars: 90 transactions or fewer.</li></ul>`,
  knobs: [
    { id: 'cmd', label: 'command', options: [{ id: 'push', label: 'push' }, { id: 'pop', label: 'pop' }, { id: 'both', label: 'push+pop' }, { id: 'idle', label: 'idle' }], defaults: { push: 1, pop: 1, both: 1, idle: 1 } },
  ],
  bins: [
    { id: 'occ_low', group: 'cp_level', label: 'level 1..15' },
    { id: 'occ_high', group: 'cp_level', label: 'level 16..31' },
    { id: 'occ_full', group: 'cp_level', label: 'full (32)' },
    { id: 'occ_drained', group: 'cp_level', label: 'drained back to empty' },
    { id: 'push_full', group: 'cp_illegal', label: 'push while full' },
    { id: 'pop_empty', group: 'cp_illegal', label: 'pop while empty' },
    { id: 'both_full', group: 'cp_simul', label: 'push+pop while full' },
    { id: 'both_empty', group: 'cp_simul', label: 'push+pop while empty' },
    { id: 'wrap', group: 'cp_ptr', label: 'write pointer wraps' },
  ],
  budget: 400,
  par: 90,
  maxPhases: 4,
  run(phases, seed) {
    const r = rng(seed);
    const hits: Record<string, number> = {};
    const log: TxnLog[] = [];
    const model: number[] = []; // reference model (scoreboard's expected queue)
    const dut: number[] = []; // buggy DUT storage
    let n = 0, wptr = 0, pushed = 0, bugAt: number | undefined, bugMessage: string | undefined;
    for (const ph of phases) {
      for (let i = 0; i < ph.count; i++) {
        n++;
        const cmd = pick(r, ph.weights.cmd);
        const lvl = model.length;
        const h: string[] = [];
        const push = cmd === 'push' || cmd === 'both';
        const pop = cmd === 'pop' || cmd === 'both';
        if (push && lvl === DEPTH) h.push('push_full');
        if (pop && lvl === 0) h.push('pop_empty');
        if (cmd === 'both' && lvl === DEPTH) h.push('both_full');
        if (cmd === 'both' && lvl === 0) h.push('both_empty');
        let text = cmd.padEnd(4);
        let error: string | undefined;
        const canPop = pop && lvl > 0;
        const canPush = push && lvl < DEPTH;
        if (canPop) {
          const exp = model.shift()!;
          const got = dut.shift()!;
          text += ` pop=${hx(got)}`;
          if (exp !== got && bugAt === undefined) {
            bugAt = n;
            error = bugMessage = `UVM_ERROR @ txn ${n} [SCBD] data mismatch on pop: expected ${hx(exp)}, got ${hx(got)}`;
          }
        }
        const d = Math.floor(r() * 256);
        if (canPush) {
          model.push(d);
          dut.push(d);
          wptr = (wptr + 1) % DEPTH;
          pushed++;
          if (wptr === 0) h.push('wrap');
          text += ` push=${hx(d)}`;
        } else if (push && lvl === DEPTH && !(cmd === 'both')) {
          // Planted bug: the DUT ignores 'full' and overwrites the newest entry.
          dut[dut.length - 1] = d;
          text += ` push=${hx(d)} (dropped)`;
        }
        const now = model.length;
        if (now >= 1 && now < DEPTH / 2) h.push('occ_low');
        if (now >= DEPTH / 2 && now < DEPTH) h.push('occ_high');
        if (now === DEPTH) h.push('occ_full');
        if (now === 0 && pushed > 0 && lvl > 0) h.push('occ_drained');
        text += `  level=${now}`;
        for (const b of h) hits[b] = (hits[b] ?? 0) + 1;
        if (log.length < 400) log.push({ n, text, hits: h, error });
      }
    }
    return { hits, log, bugAt, bugMessage, total: n };
  },
};

export const SCENARIOS: Scenario[] = [alu, fifo];

export function defaultPhase(s: Scenario, count = 50): Phase {
  return { count, weights: Object.fromEntries(s.knobs.map((k) => [k.id, { ...k.defaults }])) };
}

export function score(s: Scenario, out: RunOutcome) {
  const covered = s.bins.filter((b) => out.hits[b.id]).length;
  const pct = Math.round((covered / s.bins.length) * 1000) / 10;
  const done = covered === s.bins.length && out.bugAt !== undefined;
  const stars = !done ? 0 : out.total <= s.par ? 3 : out.total <= (s.par + s.budget) / 2 ? 2 : 1;
  return { covered, pct, done, stars };
}

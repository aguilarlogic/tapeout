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
    a phase that drains. That's exactly what UVM virtual sequences are for.</p>
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

// ---------------------------------------------------------------- ARBITER

const popcount = (v: number) => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1);

const arb: Scenario = {
  id: 'cov-arb',
  title: 'Fair Share',
  concept: 'round-robin arbitration & cross coverage',
  xp: 250,
  brief: `
    <p>A round-robin arbiter gives the grant to each requester in turn. After master <i>n</i> wins, the search for the next
    grant starts at master <i>n+1</i> and wraps around after master 3.</p>
    <p>Random requests hit the usual cases: one or two requesters. The corners are rarer: <b>no</b> requests at all, and
    <b>all four</b> requesting. The hardest one is when all four request right after master 3 won, because the grant has to
    wrap around.</p>
    <p><b>Cross coverage</b> counts the combination, not the parts. "All four request" and "master 3 just won" are each easy
    to hit; both at once is one bin, and only a directed mix of request patterns fills it.</p>
    <h4>Goal</h4><ul><li>Cover every request pattern, every grant and the wrap-around corner, and let the scoreboard catch the bug.</li>
    <li>3 stars: 40 transactions or fewer.</li></ul>`,
  knobs: [
    {
      id: 'req', label: 'requests',
      options: [{ id: 'none', label: 'none' }, { id: 'one', label: 'one master' }, { id: 'two', label: 'two masters' }, { id: 'all', label: 'all four' }],
      defaults: { none: 0, one: 1, two: 1, all: 0 },
    },
  ],
  bins: [
    { id: 'req_none', group: 'cp_req', label: 'no requests' },
    { id: 'req_one', group: 'cp_req', label: 'one request' },
    { id: 'req_two', group: 'cp_req', label: 'two requests' },
    { id: 'req_all', group: 'cp_req', label: 'all four request' },
    ...[0, 1, 2, 3].map((i) => ({ id: `win_${i}`, group: 'cp_grant', label: `master ${i} wins` })),
    { id: 'wrap', group: 'cp_ptr', label: 'grant wraps from master 3 to master 0' },
    { id: 'all_after3', group: 'cx_req_ptr', label: 'all four request right after master 3 won' },
  ],
  budget: 200,
  par: 40,
  maxPhases: 4,
  run(phases, seed) {
    const r = rng(seed);
    const hits: Record<string, number> = {};
    const log: TxnLog[] = [];
    let n = 0, last = -1, bugAt: number | undefined, bugMessage: string | undefined;
    for (const ph of phases) {
      for (let i = 0; i < ph.count; i++) {
        n++;
        const kind = pick(r, ph.weights.req);
        let req = 0;
        if (kind === 'one') req = 1 << Math.floor(r() * 4);
        else if (kind === 'two') {
          const a = Math.floor(r() * 4);
          let b = Math.floor(r() * 4);
          while (b === a) b = Math.floor(r() * 4);
          req = (1 << a) | (1 << b);
        } else if (kind === 'all') req = 0xf;
        // Reference model: round-robin, starting one past the last winner.
        const start = last < 0 ? 0 : (last + 1) % 4;
        let gnt = -1;
        for (let k = 0; k < 4 && gnt < 0; k++) if (req & (1 << ((start + k) % 4))) gnt = (start + k) % 4;
        // Planted bug: with all four requesting right after master 3 won, the DUT skips master 0 and grants master 1.
        const dut = req === 0xf && last === 3 ? 1 : gnt;
        const h: string[] = [];
        const pc = popcount(req);
        if (pc === 0) h.push('req_none');
        else if (pc === 1) h.push('req_one');
        else if (pc === 2) h.push('req_two');
        if (req === 0xf) h.push('req_all');
        if (gnt >= 0) h.push(`win_${gnt}`);
        if (gnt === 0 && last === 3) h.push('wrap');
        if (req === 0xf && last === 3) h.push('all_after3');
        for (const b of h) hits[b] = (hits[b] ?? 0) + 1;
        const show = (g: number) => (g < 0 ? '-' : `m${g}`);
        const t: TxnLog = { n, text: `req=${req.toString(2).padStart(4, '0')} gnt=${show(gnt)} dut=${show(dut)}`, hits: h };
        if (dut !== gnt && bugAt === undefined) {
          bugAt = n;
          bugMessage = t.error = `UVM_ERROR @ txn ${n} [SCBD] grant mismatch: expected ${show(gnt)}, got ${show(dut)}`;
        }
        if (gnt >= 0) last = gnt;
        if (log.length < 400) log.push(t);
      }
    }
    return { hits, log, bugAt, bugMessage, total: n };
  },
};

// ---------------------------------------------------------------- UART

const uart: Scenario = {
  id: 'cov-uart',
  title: 'Bad Frame',
  concept: 'protocol corners, framing errors & observability',
  xp: 300,
  brief: `
    <p>A UART frame is a start bit, eight data bits sent LSB first, and a stop bit that must be high. A stop bit held low is a
    <b>framing error</b>. If the line stays low for the whole frame, that is a <b>break</b>: all zeros, with the stop bit low too.</p>
    <p>The receiver throws away framing errors and breaks; only good frames reach the scoreboard. Random traffic gives you plenty
    of good frames, but the errors, breaks, the 0x00 and 0xFF patterns and back-to-back frames have to be asked for.</p>
    <p>One corner is easy to miss: a good frame that comes straight after a break, with no idle bit in between. And a dropped
    byte is only <b>observed</b> when a later byte comes out and gets compared with the byte the scoreboard expected. A
    byte lost at the very end of the test never shows up.</p>
    <h4>Goal</h4><ul><li>Cover every frame type, data pattern and gap, including a good frame right after a break.</li>
    <li>Find the receiver bug in the scoreboard.</li>
    <li>3 stars: 60 transactions or fewer.</li></ul>`,
  knobs: [
    {
      id: 'frame', label: 'frame',
      options: [{ id: 'good', label: 'good' }, { id: 'ferr', label: 'framing error' }, { id: 'brk', label: 'break' }],
      defaults: { good: 1, ferr: 0, brk: 0 },
    },
    {
      id: 'data', label: 'data',
      options: [{ id: 'zero', label: '0x00' }, { id: 'ones', label: '0xFF' }, { id: 'alt', label: '0x55 / 0xAA' }, { id: 'rand', label: 'random' }],
      defaults: { zero: 0, ones: 0, alt: 0, rand: 1 },
    },
    {
      id: 'gap', label: 'gap',
      options: [{ id: 'none', label: 'back-to-back' }, { id: 'idle', label: 'idle bit' }],
      defaults: { none: 0, idle: 1 },
    },
  ],
  bins: [
    { id: 'fr_good', group: 'cp_frame', label: 'good frame' },
    { id: 'fr_ferr', group: 'cp_frame', label: 'framing error (stop bit low)' },
    { id: 'fr_brk', group: 'cp_frame', label: 'break (line low for a whole frame)' },
    { id: 'd_zero', group: 'cp_data', label: 'data 0x00' },
    { id: 'd_ones', group: 'cp_data', label: 'data 0xFF' },
    { id: 'd_alt', group: 'cp_data', label: 'data 0x55 or 0xAA' },
    { id: 'd_other', group: 'cp_data', label: 'any other data' },
    { id: 'gap_none', group: 'cp_gap', label: 'back-to-back frames' },
    { id: 'gap_idle', group: 'cp_gap', label: 'idle bit between frames' },
    { id: 'brk_good', group: 'cx_brk', label: 'good frame right after a break, no idle' },
  ],
  budget: 300,
  par: 60,
  maxPhases: 4,
  run(phases, seed) {
    const r = rng(seed);
    const hits: Record<string, number> = {};
    const log: TxnLog[] = [];
    const exp: number[] = []; // bytes the scoreboard expects, in order
    const got: number[] = []; // bytes the DUT actually delivers
    let n = 0, prev = '', bugAt: number | undefined, bugMessage: string | undefined;
    for (const ph of phases) {
      for (let i = 0; i < ph.count; i++) {
        n++;
        const frame = pick(r, ph.weights.frame);
        const dk = pick(r, ph.weights.data);
        let d = dk === 'zero' ? 0 : dk === 'ones' ? 0xff : dk === 'alt' ? (r() < 0.5 ? 0x55 : 0xaa) : Math.floor(r() * 256);
        const gap = pick(r, ph.weights.gap);
        if (frame === 'brk') d = 0; // a break is all zeros on the line
        const h: string[] = [`fr_${frame}`];
        if (d === 0) h.push('d_zero');
        else if (d === 0xff) h.push('d_ones');
        else if (d === 0x55 || d === 0xaa) h.push('d_alt');
        else h.push('d_other');
        h.push(gap === 'none' ? 'gap_none' : 'gap_idle');
        if (frame === 'good' && gap === 'none' && prev === 'brk') h.push('brk_good');
        let text = `${frame.padEnd(4)} gap=${gap.padEnd(4)} data=${hx(d)}`;
        let error: string | undefined;
        if (frame === 'good') {
          exp.push(d);
          // Planted bug: a good frame straight after a break, with no idle bit, loses its byte.
          if (gap === 'none' && prev === 'brk') text += ' -> dropped';
          else {
            got.push(d);
            text += ` -> rx=${hx(d)}`;
            const e = exp[got.length - 1];
            if (e !== d && bugAt === undefined) {
              bugAt = n;
              error = bugMessage = `UVM_ERROR @ txn ${n} [SCBD] rx data mismatch: expected ${hx(e)}, got ${hx(d)}`;
            }
          }
        } else text += frame === 'ferr' ? ' -> framing error, discarded' : ' -> break, discarded';
        for (const b of h) hits[b] = (hits[b] ?? 0) + 1;
        if (log.length < 400) log.push({ n, text, hits: h, error });
        prev = frame;
      }
    }
    return { hits, log, bugAt, bugMessage, total: n };
  },
};

// ---------------------------------------------------------------- CACHE

const cache: Scenario = {
  id: 'cov-cache',
  title: 'Write Back',
  concept: 'hit, miss & eviction corners with writeback',
  xp: 350,
  brief: `
    <p>The cache in this lab is 2-way set associative with 4 sets. The two low address bits pick the set and the rest is the
    tag. A miss fills an empty way if one is free; otherwise it <b>evicts</b> the least recently used (LRU) way.</p>
    <p>A <b>dirty</b> line has been written but not yet written back to memory. It must be written back before its way is
    reused. A clean line can simply be dropped. Hits and clean evictions come out of ordinary traffic. The rare case is a
    dirty line in way 1 that is the LRU line when a conflicting access arrives.</p>
    <p>Lost writebacks are also found late: the wrong value only shows when you read that address again.</p>
    <h4>Goal</h4><ul><li>Cover read and write hits and misses, clean and dirty evictions, a re-read after an eviction, and a dirty eviction from way 1.</li>
    <li>Find the writeback bug in the scoreboard.</li>
    <li>3 stars: 90 transactions or fewer.</li></ul>`,
  knobs: [
    {
      id: 'op', label: 'access',
      options: [{ id: 'rd', label: 'read' }, { id: 'wr', label: 'write' }],
      defaults: { rd: 1, wr: 0 },
    },
    {
      id: 'addr', label: 'address',
      options: [{ id: 'hot', label: 'hot line (set 0-3)' }, { id: 'conflict', label: 'same set, new tag' }, { id: 'rand', label: 'random' }],
      defaults: { hot: 0, conflict: 0, rand: 1 },
    },
  ],
  bins: [
    { id: 'rd_hit', group: 'cp_access', label: 'read hit' },
    { id: 'rd_miss', group: 'cp_access', label: 'read miss' },
    { id: 'wr_hit', group: 'cp_access', label: 'write hit' },
    { id: 'wr_miss', group: 'cp_access', label: 'write miss' },
    { id: 'hit_lru', group: 'cp_replace', label: 'hit on the LRU way' },
    { id: 'evict_clean', group: 'cp_replace', label: 'evict a clean line' },
    { id: 'evict_dirty', group: 'cp_replace', label: 'evict a dirty line' },
    { id: 'refill', group: 'cp_replace', label: 'read miss to an address seen before' },
    { id: 'dirty_way1', group: 'cx_way', label: 'dirty line evicted from way 1' },
  ],
  budget: 400,
  par: 90,
  maxPhases: 4,
  run(phases, seed) {
    const r = rng(seed);
    const hits: Record<string, number> = {};
    const log: TxnLog[] = [];
    type Line = { valid: boolean; tag: number; dirty: boolean; data: number };
    const sets: Line[][] = Array.from({ length: 4 }, () => [0, 1].map(() => ({ valid: false, tag: 0, dirty: false, data: 0 })));
    const lru = [0, 0, 0, 0]; // per set: the way that is least recently used
    const gold = new Map<number, number>(); // what every read must return
    const mem = new Map<number, number>(); // memory behind the cache, as the DUT sees it
    const seen = new Set<number>();
    let n = 0, prev = -1, bugAt: number | undefined, bugMessage: string | undefined;
    for (const ph of phases) {
      for (let i = 0; i < ph.count; i++) {
        n++;
        const op = pick(r, ph.weights.op);
        const kind = pick(r, ph.weights.addr);
        let addr: number;
        if (kind === 'hot') addr = Math.floor(r() * 4);
        else if (kind === 'conflict' && prev >= 0) {
          let tag = Math.floor(r() * 16);
          while (tag === prev >> 2) tag = Math.floor(r() * 16);
          addr = (prev & 3) | (tag << 2);
        } else addr = Math.floor(r() * 64);
        prev = addr;
        const set = addr & 3, tag = addr >> 2;
        const val = Math.floor(r() * 256);
        const ways = sets[set];
        const h: string[] = [];
        let w = ways.findIndex((x) => x.valid && x.tag === tag);
        const hit = w >= 0;
        if (hit) {
          h.push(op === 'rd' ? 'rd_hit' : 'wr_hit');
          if (w === lru[set]) h.push('hit_lru');
        } else {
          h.push(op === 'rd' ? 'rd_miss' : 'wr_miss');
          if (op === 'rd' && seen.has(addr)) h.push('refill');
          w = !ways[0].valid ? 0 : !ways[1].valid ? 1 : lru[set];
          const victim = ways[w];
          if (victim.valid) {
            if (victim.dirty) {
              h.push('evict_dirty');
              if (w === 1) h.push('dirty_way1');
              // Planted bug: a dirty victim in way 1 is dropped without its writeback.
              if (w === 0) mem.set((victim.tag << 2) | set, victim.data);
            } else h.push('evict_clean');
          }
          ways[w] = { valid: true, tag, dirty: false, data: mem.get(addr) ?? 0 };
          seen.add(addr);
        }
        const line = ways[w];
        let text = `${op} a=${hx(addr)} s${set} w${w} ${hit ? 'hit ' : 'miss'}`;
        let error: string | undefined;
        if (op === 'wr') {
          line.data = val;
          line.dirty = true;
          gold.set(addr, val);
          text += ` wdata=${hx(val)}`;
        } else {
          const e = gold.get(addr) ?? 0;
          text += ` rdata=${hx(line.data)}`;
          if (e !== line.data && bugAt === undefined) {
            bugAt = n;
            error = bugMessage = `UVM_ERROR @ txn ${n} [SCBD] data mismatch on read ${hx(addr)}: expected ${hx(e)}, got ${hx(line.data)}`;
          }
        }
        lru[set] = 1 - w;
        for (const b of h) hits[b] = (hits[b] ?? 0) + 1;
        if (log.length < 400) log.push({ n, text, hits: h, error });
      }
    }
    return { hits, log, bugAt, bugMessage, total: n };
  },
};

export const SCENARIOS: Scenario[] = [alu, fifo, arb, uart, cache];

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

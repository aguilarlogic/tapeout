// Practice banks and bosses for digital design: combinational and sequential logic, FSMs, Verilog, datapaths, clocking.
import { bin, expr, hexa, num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { exact, hex, mcs, shuffle, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';
const bits = (r: Rng, n: number) => Array.from({ length: n }, () => (r() < 0.5 ? 1 : 0)).join('');
const gray = (b: number) => b ^ (b >> 1);

/** Count (overlapping) occurrences of `pat` in `s`: what a sequence-detector FSM fires on. */
const matches = (s: string, pat: string) => { let n = 0; for (let i = 0; i + pat.length <= s.length; i++) if (s.slice(i, i + pat.length) === pat) n++; return n; };

// ------------------------------------------------------------------ combinational

export const combPractice = practice('practice-comb', 'Building Block Drills', 'muxes, decoders, adders, encoders, Gray code', [
  (r, d) => {
    const n = pick(r, tier(d, [2, 4, 8], [16, 32, 5], [64, 12, 100]));
    const variants = [
      [1, `How many select bits does a ${n}:1 mux need?`, Math.ceil(Math.log2(n)), `ceil(log2 ${n}) = ${Math.ceil(Math.log2(n))}.`],
      [2, `How many 2:1 muxes does it take to build a ${n}:1 mux as a tree?`, n - 1, `Each 2:1 mux removes one candidate: ${n} → 1 needs ${n - 1}.`],
      [3, `A decoder has enough outputs to select one of ${n} registers. How many inputs does it have?`, Math.ceil(Math.log2(n)), `ceil(log2 ${n}) = ${Math.ceil(Math.log2(n))} inputs (${2 ** Math.ceil(Math.log2(n))} outputs, some unused).`],
    ] as const;
    const [, q, v, why] = pick(r, variants.filter((x) => x[0] <= d));
    return ask(q, num(v), why, 'Think powers of two.');
  },
  (r, d) => {
    const w = tier(d, 4, 8, 8);
    const a = between(r, 0, 2 ** w - 1), b = between(r, 0, 2 ** w - 1);
    const s = a + b;
    if (d < 3) return ask(`A ${w}-bit adder adds ${hex(a, w / 4)} + ${hex(b, w / 4)}. What is the ${w}-bit sum (hex), ignoring carry-out?`, hexa(s & (2 ** w - 1), w / 4), `${a} + ${b} = ${s}${s >= 2 ** w ? `, which overflows ${w} bits: carry-out 1, sum ${hex(s & (2 ** w - 1), w / 4)}` : ` = ${hex(s, w / 4)}, no carry-out`}.`, 'Add in decimal, then take it modulo 2^w.');
    return ask(`8-bit adder: ${hex(a)} + ${hex(b)}. What is the carry-out (0 or 1)?`, num(s >= 256 ? 1 : 0), `${a} + ${b} = ${s}: ${s >= 256 ? 'more than 255, so carry-out = 1' : 'fits in 8 bits, carry-out = 0'}. For unsigned numbers, carry-out means overflow.`, 'Does the true sum exceed 255?');
  },
  (r, d) => {
    const n = pick(r, tier(d, [4, 8], [16, 32], [32, 64]));
    const tfa = pick(r, [20, 30, 50]);
    if (d === 1) return ask(`A ${n}-bit ripple-carry adder, ${tfa} ps per full-adder carry stage. Worst-case delay, in ps?`, qty(n * tfa, 'ps', 0.01), `The carry ripples through all ${n} stages: ${n} × ${tfa} = ${n * tfa} ps. O(n).`, 'Carry through every stage.');
    const lv = Math.log2(n);
    if (d === 2) return ask(`A ${n}-bit parallel-prefix (Kogge-Stone) adder: how many prefix levels compute all the carries?`, num(lv), `log2(${n}) = ${lv} levels: O(log n) delay, paid for with O(n log n) wiring.`, 'Each level doubles the span.');
    return ask(`${n}-bit adders: ripple at ${tfa} ps per bit versus Kogge-Stone at ${tfa * 2} ps per prefix level (plus one ${tfa} ps level each for setup and sum). How many ps faster is Kogge-Stone?`, qty(n * tfa - (lv * 2 * tfa + 2 * tfa), 'ps', 0.01), `Ripple: ${n * tfa} ps. KS: ${lv} × ${2 * tfa} + ${2 * tfa} = ${lv * 2 * tfa + 2 * tfa} ps. Difference ${n * tfa - (lv * 2 * tfa + 2 * tfa)} ps.`, 'Compare O(n) with O(log n).');
  },
  (r, d) => {
    const w = tier(d, 4, 8, 8);
    const v = between(r, 1, 2 ** w - 1);
    if (d < 3) return ask(`A ${w}-input priority encoder (highest bit wins) sees ${v.toString(2).padStart(w, '0')}. What index does it output?`, num(Math.floor(Math.log2(v))), `The highest set bit is bit ${Math.floor(Math.log2(v))}. Interrupt controllers and arbiters are built on priority encoders.`, 'Find the leftmost 1.');
    return ask(`Same 8-bit input ${v.toString(2).padStart(8, '0')}, but the encoder picks the LOWEST set bit. Index?`, num(Math.log2(v & -v)), `v & -v = ${(v & -v).toString(2)} → bit ${Math.log2(v & -v)}.`, 'Find the rightmost 1.');
  },
  (r, d) => {
    const w = tier(d, 3, 4, 8);
    const b = between(r, 1, 2 ** w - 1);
    if (d < 3) return ask(`Convert the ${w}-bit binary ${b.toString(2).padStart(w, '0')} to Gray code (binary answer).`, bin(gray(b), w), `g = b ^ (b >> 1) = ${gray(b).toString(2).padStart(w, '0')}. Consecutive Gray codes differ in exactly one bit.`, 'XOR each bit with the bit to its left.');
    const g = gray(b);
    return ask(`Convert the 8-bit Gray code ${g.toString(2).padStart(8, '0')} back to binary (binary answer).`, bin(b, 8), `Each binary bit is the XOR of all Gray bits at or above it: ${b.toString(2).padStart(8, '0')}.`, 'b[7] = g[7]; b[i] = b[i+1] ^ g[i].');
  },
  (r, d) => {
    const cases = [
      ['y = 1 when a 2-bit number {a1,a0} equals the 2-bit number {b1,b0}', ['a1', 'a0', 'b1', 'b0'], (v: Record<string, boolean>) => v.a1 === v.b1 && v.a0 === v.b0, '~(a1 ^ b1) & ~(a0 ^ b0)'],
      ['y = 1 when {a1,a0} > {b1,b0} (unsigned)', ['a1', 'a0', 'b1', 'b0'], (v: Record<string, boolean>) => 2 * +v.a1 + +v.a0 > 2 * +v.b1 + +v.b0, 'a1&~b1 | ~(a1^b1)&a0&~b0'],
      ['the carry-out of a full adder with inputs a, b, cin', ['a', 'b', 'cin'], (v: Record<string, boolean>) => +v.a + +v.b + +v.cin >= 2, 'a&b | cin&(a^b)'],
      ['the sum of a full adder with inputs a, b, cin', ['a', 'b', 'cin'], (v: Record<string, boolean>) => (+v.a + +v.b + +v.cin) % 2 === 1, 'a ^ b ^ cin'],
      ['a 2:1 mux: y = d1 when s, else d0', ['s', 'd0', 'd1'], (v: Record<string, boolean>) => (v.s ? v.d1 : v.d0), 's&d1 | ~s&d0'],
    ] as const;
    const [desc, vars, f, canon] = pick(r, d === 1 ? cases.slice(2) : d === 2 ? cases.slice(0, 4) : cases.slice(0, 2));
    return ask(`Write a boolean expression for ${desc}. (& | ^ ~, any equivalent form)`, expr(canon, [...vars], f), `One answer: ${canon}. Checked against the full truth table.`, 'Write the truth table rows where y = 1.');
  },
]);

// ------------------------------------------------------------------ sequential

export const seqPractice = practice('practice-seq', 'Flop & Counter Drills', 'counters, shift registers, LFSRs, setup/hold, Fmax', [
  (r, d) => {
    const M = pick(r, tier(d, [4, 8, 10], [6, 12, 60], [7, 24, 100])), s = between(r, 0, M - 1), n = between(r, 3, tier(d, 10, 40, 1000));
    return ask(`A mod-${M} counter (counts 0..${M - 1} then wraps) starts at ${s}. What does it hold after ${n} clock edges?`, num((s + n) % M), `(${s} + ${n}) mod ${M} = ${(s + n) % M}.`, 'Add, then take the remainder.');
  },
  (r, d) => {
    const w = tier(d, 4, 4, 8), init = between(r, 0, 2 ** w - 1), ins = bits(r, tier(d, 2, 3, 5));
    let v = init;
    for (const b of ins) v = ((v << 1) | +b) & (2 ** w - 1);
    return ask(`A ${w}-bit shift register shifts left each clock, taking a new bit into bit 0. It starts at ${init.toString(2).padStart(w, '0')} and receives ${ins.split('').join(', ')} (first to last). Final contents (binary)?`, bin(v, w), `Each clock: shift left, drop the MSB, insert the new bit: ${v.toString(2).padStart(w, '0')}.`, 'Shift once per input bit.');
  },
  (r, d) => {
    const s0 = between(r, 1, 15), k = between(r, 1, tier(d, 2, 4, 8));
    let s = s0;
    for (let i = 0; i < k; i++) s = ((s << 1) | (((s >> 3) ^ (s >> 2)) & 1)) & 0xf;
    return ask(`A 4-bit Fibonacci LFSR: each clock, new_bit = s[3] ^ s[2], then s = {s[2:0], new_bit}. From ${s0.toString(2).padStart(4, '0')}, what is the state after ${k} clock${k > 1 ? 's' : ''}? (binary)`, bin(s, 4), `Step by step gives ${s.toString(2).padStart(4, '0')}. With taps x⁴ + x³ + 1 it cycles through all 15 nonzero states: the cheapest pseudo-random generator in hardware (BIST, scramblers, CRC).`, 'Compute new_bit from the top two bits, then shift left.');
  },
  (r, d) => {
    const tcq = pick(r, [30, 50, 80]), tl = pick(r, [200, 400, 700]), ts = pick(r, [20, 40, 60]);
    if (d < 3) {
      const T = tcq + tl + ts;
      return ask(`t_clk→q = ${tcq} ps, worst logic delay = ${tl} ps, setup = ${ts} ps. Maximum clock frequency, in GHz?`, qty(1000 / T, 'GHz', 0.02, sig(1000 / T)), `T_min = ${tcq} + ${tl} + ${ts} = ${T} ps → f_max = ${sig(1000 / T)} GHz.`, 'f_max = 1 / (t_cq + t_logic + t_setup).');
    }
    const tmin = pick(r, [5, 15, 40]), th = pick(r, [30, 50, 70]), skew = pick(r, [0, 20, 40]);
    const slack = tcq + tmin - th - skew;
    return ask(`Hold check: t_clk→q = ${tcq} ps, shortest logic path = ${tmin} ps, hold = ${th} ps, and the capture clock arrives ${skew} ps late. Hold slack, in ps (negative = violation)?`, qty(slack, 'ps', 0.01, String(slack)), `slack = t_cq + t_min - t_hold - skew = ${slack} ps. ${slack < 0 ? 'Violated: insert delay buffers on the short path. Hold violations cannot be fixed by slowing the clock!' : 'Met.'}`, 'New data must not arrive before the hold window closes.');
  },
  (r, d) => {
    const qs = [
      [1, 'What is the difference between a latch and a flip-flop?', 'A latch is transparent while its enable is high; a flip-flop samples only at the clock edge', ['They are identical', 'A flip-flop is transparent while the clock is high', 'Latches cannot store data']],
      [1, 'Setup time is violated when data arrives…', 'Too late before the clock edge', ['Too early after the edge', 'Exactly at the edge', 'After the hold window']],
      [2, 'Why is gating a clock with a plain AND gate dangerous?', 'The enable can glitch while the clock is high, producing runt clock pulses; use an integrated clock-gating cell with a latch', ['It uses too much area', 'AND gates cannot pass clocks', 'It makes the clock faster']],
      [2, 'Why prefer a clock-enable mux over a gated clock in FPGA designs?', 'FPGA clock networks are dedicated; enables keep one clean clock and let the tools time everything', ['Muxes are faster', 'Gated clocks do not simulate', 'Enables use no logic']],
      [3, 'A flop\'s D input changes right at the clock edge. What can happen?', 'Metastability: the output hovers between 0 and 1 for an unbounded time before resolving', ['Nothing', 'The flop always captures 0', 'The clock stops']],
      [3, 'Why are asynchronous-reset flops released through a synchronizer?', 'If reset deasserts near a clock edge, flops can leave reset on different cycles or go metastable', ['To save power', 'Because reset is a clock', 'To make reset faster']],
    ] as const;
    const [, q, right, wrong] = pick(r, qs.filter((x) => x[0] === d));
    return mcs(r, q, right, wrong, `${right}.`);
  },
  (r, d) => {
    const n = pick(r, tier(d, [10, 60, 100], [1000, 1e6], [48e6, 1e9]));
    const k = Math.ceil(Math.log2(n));
    return ask(`${d === 3 ? `A timer counts ${n.toLocaleString('en-US')} cycles of a clock and then fires.` : `A counter must count from 0 to ${n - 1}.`} How many flip-flops does it need at minimum?`, num(k), `ceil(log2 ${n}) = ${k}${d === 3 ? ` (2^${k} = ${(2 ** k).toLocaleString('en-US')} ≥ ${n.toLocaleString('en-US')})` : ''}.`, 'Smallest k with 2^k ≥ n.');
  },
]);

// ------------------------------------------------------------------ FSMs

export const fsmPractice = practice('practice-fsm', 'State Machine Drills', 'encodings, sequence detectors, transition tables', [
  (r, d) => {
    const n = pick(r, tier(d, [4, 5, 8], [6, 12, 17], [33, 20, 9]));
    const enc = pick(r, ['binary', 'one-hot', 'Gray']);
    const f = enc === 'one-hot' ? n : Math.ceil(Math.log2(n));
    return ask(`An FSM has ${n} states. How many flip-flops with ${enc} encoding?`, num(f), `${enc === 'one-hot' ? `One flop per state: ${n}. More flops, but next-state logic is tiny and fast (and FPGAs have flops to spare).` : `ceil(log2 ${n}) = ${f}. ${enc === 'Gray' ? 'Gray also changes one bit per transition along a sequence, reducing glitches and power.' : 'Fewest flops.'}`}`, enc === 'one-hot' ? 'One-hot: one flop per state.' : 'log2 of the state count, rounded up.');
  },
  (r, d) => {
    const pat = bits(r, tier(d, 2, 3, 4)).replace(/^0*$/, '101');
    const s = bits(r, tier(d, 10, 14, 20));
    const n = matches(s, pat);
    return ask(`A detector fires each time the last ${pat.length} input bits are ${pat} (overlapping matches count). Input stream (first to last): ${s}. How many times does it fire?`, num(n), `Slide a ${pat.length}-bit window along the stream: ${n} match${n === 1 ? '' : 'es'}. The FSM must keep the longest suffix that is still a prefix of ${pat}, which is what makes overlap work.`, 'Check every position, including overlapping ones.');
  },
  (r, d) => {
    const L = between(r, 3, tier(d, 4, 6, 8));
    const moore = pick(r, [true, false]);
    return ask(`Minimum number of states for a ${moore ? 'Moore' : 'Mealy'} FSM that detects one specific ${L}-bit pattern (overlap allowed)?`, num(moore ? L + 1 : L), moore ? `Moore needs a state for "matched 0, 1, … ${L} bits" = ${L + 1} states, because the output belongs to a state.` : `Mealy outputs on the transition, so it needs states for "matched 0 … ${L - 1} bits" = ${L}.`, 'Count how many "progress" states the matcher needs.');
  },
  (r, d) => {
    const S = ['IDLE', 'REQ', 'BUSY', 'DONE'];
    const t: Record<string, [string, string]> = {};
    for (const s of S) t[s] = [pick(r, S), pick(r, S)];
    t.IDLE = ['IDLE', 'REQ'];
    const ins = bits(r, tier(d, 3, 5, 8));
    let st = 'IDLE';
    for (const b of ins) st = t[st][+b];
    return ask(`Transition table (next state for in = 0 / in = 1):${code(S.map((s) => `${s.padEnd(5)}  ${t[s][0].padEnd(5)} / ${t[s][1]}`).join('\n'))}Starting in IDLE, the inputs are ${ins.split('').join(', ')}. Final state?`, exact(st, st.toLowerCase()), `Follow the table one input per clock: ends in ${st}.`, 'One row lookup per input bit.');
  },
  (r) => {
    const qs = [
      ['Moore vs Mealy: which reacts to an input in the same cycle?', 'Mealy (outputs depend on inputs directly), at the risk of glitches and long combinational paths', ['Moore', 'Both, equally', 'Neither']],
      ['Why register FSM outputs in a high-speed design?', 'Registered outputs are glitch-free and cut the timing path to the next block', ['It saves flops', 'It makes the FSM Mealy', 'It removes the reset']],
      ['What should an FSM do if it ever lands in an unused state (e.g. after a radiation upset)?', 'Recover to a safe state (a default branch to IDLE); safety standards demand it', ['Stay there forever', 'Nothing, unused states cannot be reached', 'Stop the clock']],
      ['Why do FPGAs favour one-hot encoding?', 'Flops are plentiful and next-state logic becomes a few gates per state, so it is fast', ['It uses the fewest flops', 'It is the only encoding that works', 'It removes the need for a clock']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ Verilog

export const verilogPractice = practice('practice-verilog', 'Verilog Drills', 'widths, literals, blocking vs non-blocking, 4-state logic, bug spotting', [
  (r, d) => {
    const a = between(r, 2, 8), b = between(r, 1, 8), k = between(r, 2, 4);
    const variants = [
      [1, `wire [${a - 1}:0] a;\n... {${k}{a}}`, k * a],
      [2, `wire [${a - 1}:0] a; wire [${b - 1}:0] b;\n... {a, b, 2'b01}`, a + b + 2],
      [3, `wire [${a - 1}:0] a; wire [${b - 1}:0] b;\n... {${k}{a[0]}, b, {2{a}}}`, k + b + 2 * a],
    ] as const;
    const [, src, v] = pick(r, variants.filter((x) => x[0] === d));
    return ask(`What is the width, in bits, of the expression:${code(src)}`, num(v), `Concatenation adds widths; {k{x}} repeats x k times: ${v} bits.`, 'Add up each part.');
  },
  (r, d) => {
    const x = between(r, 0, 255), y = between(r, 0, 15), s = between(r, 1, 3);
    const variants = [
      [1, `8'h${x.toString(16).toUpperCase()} >> ${s}`, x >> s, 8],
      [2, `4'b${y.toString(2).padStart(4, '0')} + 4'b${(15 - y + s).toString(2).slice(-4).padStart(4, '0')}`, (y + ((15 - y + s) & 15)) & 15, 4],
      [3, `~8'h${x.toString(16).toUpperCase()} & 8'hF0`, ~x & 0xf0, 8],
    ] as const;
    const [, e, v, w] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`In a ${w}-bit context, what is ${e}? (hex)`, hexa(v, w / 4), `${e} = ${hex(v, w / 4)}. Results are truncated to the context width: ${w === 4 ? 'the carry out of bit 3 is lost.' : 'always know your widths.'}`, 'Work in binary and keep only the context width.');
  },
  (r, d) => {
    const a = between(r, 0, 9), b = between(r, 0, 9), c = between(r, 0, 9);
    const blocking = pick(r, [true, false]);
    const n = tier(d, 1, 1, 2);
    let [A, B, C] = [a, b, c];
    for (let i = 0; i < n; i++) {
      if (blocking) { B = A; C = B; } else { const nb = A, nc = B; B = nb; C = nc; }
    }
    return ask(`${code(`always @(posedge clk) begin\n  b ${blocking ? '=' : '<='} a;\n  c ${blocking ? '=' : '<='} b;\nend`)}Before the edge a = ${a}, b = ${b}, c = ${c}, and a stays ${a}. What is c after ${n} clock edge${n > 1 ? 's' : ''}?`, num(C), blocking ? `Blocking (=) updates immediately, so c gets the NEW b, which is a: c = ${C}. The two flops collapse into one: a classic bug.` : `Non-blocking (<=) samples all right-hand sides first, then updates: c gets the OLD b. ${n > 1 ? `After two edges the value of a has moved through both flops: c = ${C}.` : `c = ${C}.`} That is a real two-stage shift register.`, blocking ? 'Blocking assignments happen in order.' : 'Non-blocking: every right-hand side uses the values from before the edge.');
  },
  (r, d) => {
    const v = between(r, 1, 255);
    const ones = v.toString(2).split('').filter((c) => c === '1').length;
    const variants = [
      [1, `&8'h${v.toString(16).toUpperCase()}`, v === 255 ? 1 : 0, 'AND-reduce is 1 only if every bit is 1.'],
      [1, `|8'h${v.toString(16).toUpperCase()}`, 1, 'OR-reduce is 1 if any bit is 1.'],
      [2, `^8'h${v.toString(16).toUpperCase()}`, ones % 2, `XOR-reduce is the parity: ${ones} ones → ${ones % 2}.`],
      [3, `(1'bx & 1'b0) | (1'bx & 1'b1 & 1'b0)`, 0, 'x & 0 = 0 in 4-state logic, so both terms are 0.'],
      [3, `1'bx | 1'b1`, 1, 'x | 1 = 1: whatever x is, the OR is 1.'],
    ] as const;
    const [, e, val, why] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`What does ${e} evaluate to? (0 or 1)`, num(val), why, 'Reduction operators fold every bit with the same gate.');
  },
  (r) => {
    const bugs = [
      ['always @(*) begin\n  if (sel) y = a;\nend', 'Incomplete assignment: y is not assigned when sel = 0, so synthesis infers a latch'],
      ['always @(a) y = a & b;', 'Incomplete sensitivity list: simulation ignores changes on b, but synthesis builds an AND gate (mismatch)'],
      ['always @(posedge clk) begin\n  q1 = d;\n  q2 = q1;\nend', 'Blocking assignments in a clocked block: q2 gets the new d, collapsing two flops into one'],
      ['wire [7:0] sum;\nassign sum = a + b;  // a, b are [7:0]', 'The carry-out is lost: an 8-bit sum of two 8-bit values needs 9 bits'],
      ['assign y = a;\nassign y = b;', 'Multiple drivers on y: contention, x in simulation'],
      ['case (op)\n  2\'b00: y = a;\n  2\'b01: y = b;\nendcase  // inside always @(*)', 'Missing default: op = 2 or 3 leaves y unassigned, inferring a latch'],
    ] as const;
    const i = between(r, 0, bugs.length - 1);
    const others = shuffle(r, bugs.filter((_, j) => j !== i).map((b) => b[1])).slice(0, 3);
    return mcs(r, `What is wrong with this Verilog?${code(bugs[i][0])}`, bugs[i][1], others, `${bugs[i][1]}. Lint tools flag all of these; learn to see them yourself in reviews.`);
  },
  (r, d) => {
    const n = between(r, 2, 8), m = between(r, 2, 4);
    if (d < 3) return ask(`${code(`genvar i;\ngenerate for (i = 0; i < ${n}; i = i + 1) begin : g\n  dff u (.clk(clk), .d(d[i]), .q(q[i]));\nend endgenerate`)}How many dff instances are created?`, num(n), `One per loop iteration: ${n}, named g[0].u … g[${n - 1}].u.`, 'Count the iterations.');
    return ask(`${code(`module fifo #(parameter DEPTH = 8, parameter WIDTH = 32) (...);\n  reg [WIDTH-1:0] mem [0:DEPTH-1];\nendmodule\n\nfifo #(.DEPTH(${2 ** m}), .WIDTH(${n * 8})) u_fifo (...);`)}How many storage bits does u_fifo's mem hold?`, num(2 ** m * n * 8), `DEPTH × WIDTH = ${2 ** m} × ${n * 8} = ${2 ** m * n * 8} bits. Parameter overrides replace the defaults per instance.`, 'Use the overridden parameters.');
  },
]);

// ------------------------------------------------------------------ datapaths (ALU)

export const aluPractice = practice('practice-alu', 'Datapath Drills', 'ALU flags, shifts, multipliers, pipelining', [
  (r, d) => {
    const a = between(r, 0, 255), b = between(r, 0, 255), sub = d >= 2 && r() < 0.5;
    const res = (sub ? a - b : a + b) & 255;
    const C = sub ? (a >= b ? 1 : 0) : a + b > 255 ? 1 : 0;
    const sa = a >= 128 ? a - 256 : a, sb = b >= 128 ? b - 256 : b;
    const tr = sub ? sa - sb : sa + sb;
    const V = tr > 127 || tr < -128 ? 1 : 0;
    const flag = pick(r, tier(d, ['Z', 'C'], ['C', 'N', 'V'], ['V', 'C']));
    const val = flag === 'Z' ? (res === 0 ? 1 : 0) : flag === 'N' ? res >> 7 : flag === 'C' ? C : V;
    return ask(`8-bit ALU: ${hex(a)} ${sub ? '-' : '+'} ${hex(b)}. What is the ${flag} flag? (${flag === 'Z' ? 'zero' : flag === 'N' ? 'negative' : flag === 'C' ? sub ? 'carry, ARM-style: 1 means no borrow' : 'carry out' : 'signed overflow'})`, num(val), `Result ${hex(res)}. Z = ${res === 0 ? 1 : 0}, N = ${res >> 7}, C = ${C}, V = ${V} (signed: ${sa} ${sub ? '-' : '+'} ${sb} = ${tr}${V ? ', outside -128..127' : ''}). C is overflow for unsigned numbers; V is overflow for signed ones.`, flag === 'V' ? 'Interpret both as signed and check the true result fits.' : 'Compute the 8-bit result first.');
  },
  (r, d) => {
    const x = between(r, 1, 255), k = between(r, 1, 7);
    const variants = [
      [1, `logical shift left by ${k} (8-bit)`, (x << k) & 255],
      [2, `rotate left by ${k} (8-bit)`, ((x << k) | (x >> (8 - k))) & 255],
      [3, `arithmetic shift right by ${k} (8-bit signed)`, ((x >= 128 ? x - 256 : x) >> k) & 255],
    ] as const;
    const [, op, v] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`${hex(x)}: ${op}. Result (hex)?`, hexa(v, 2), `${x.toString(2).padStart(8, '0')} → ${v.toString(2).padStart(8, '0')} = ${hex(v)}. A barrel shifter does any of these in one cycle with log2(8) = 3 mux levels.`, 'Work in binary.');
  },
  (r, d) => {
    const n = pick(r, [8, 16, 32, 64]);
    if (d === 1) return ask(`A plain n×n array multiplier makes one partial product per multiplier bit. For ${n}×${n}, how many partial products?`, num(n), `${n}: one per bit of the multiplier, each an AND of the multiplicand with that bit.`, 'One per multiplier bit.');
    if (d === 2) return ask(`With radix-4 Booth encoding, how many partial products does a ${n}×${n} signed multiplier need?`, num(n / 2), `Radix-4 Booth recodes pairs of bits into digits from {-2..2}: ${n}/2 = ${n / 2} partial products, halving the adder tree.`, 'Booth radix-4 handles two bits per digit.');
    return ask(`A Wallace tree of 3:2 compressors reduces ${n / 2} Booth partial products to 2 rows. Each level cuts the row count by about 1.5×. How many levels (ceil(log1.5(rows/2)))?`, num(Math.ceil(Math.log(n / 4) / Math.log(1.5))), `log1.5(${n / 2}/2) = ${sig(Math.log(n / 4) / Math.log(1.5))} → ${Math.ceil(Math.log(n / 4) / Math.log(1.5))} levels, then one fast adder. O(log n), which is why multipliers are not n times slower than adders.`, 'Divide by 1.5 until 2 rows remain.');
  },
  (r, d) => {
    const T = pick(r, [2000, 3000, 4000]), k = pick(r, tier(d, [2, 4], [5, 8], [10, 20])), ov = pick(r, [50, 80, 100]);
    const period = T / k + ov;
    if (d === 1) return ask(`A ${T} ps combinational block is cut into ${k} equal pipeline stages, adding ${ov} ps of flop overhead per stage. New clock period, in ps?`, qty(period, 'ps', 0.01), `${T}/${k} + ${ov} = ${period} ps.`, 'Logic per stage plus flop overhead.');
    if (d === 2) return ask(`Same block: ${T} ps split into ${k} stages with ${ov} ps overhead each. Throughput speedup versus unpipelined (period ${T + ov} ps)?`, qty((T + ov) / period, 'x', 0.02, sig((T + ov) / period)), `(${T + ov}) / (${T / k} + ${ov}) = ${sig((T + ov) / period)}×, not ${k}×: flop overhead eats the gains as stages shrink.`, 'Old period / new period.');
    return ask(`${T} ps of logic, ${ov} ps flop overhead per stage, ${k} stages. What is the latency of one operation through the pipeline, in ps?`, qty(k * period, 'ps', 0.01), `${k} × ${period} = ${k * period} ps, longer than the unpipelined ${T + ov} ps. Pipelining raises throughput, not latency.`, 'Stages × period.');
  },
  (r, d) => {
    const n = pick(r, [8, 12, 16]), N = pick(r, tier(d, [2, 4], [16, 100], [1000, 4096]));
    const g = Math.ceil(Math.log2(N));
    return ask(`A MAC unit multiplies two signed ${n}-bit values and accumulates ${N.toLocaleString('en-US')} products. Accumulator width so it can never overflow?`, num(2 * n + g), `Each product needs 2n = ${2 * n} bits; summing ${N} of them needs ceil(log2 ${N}) = ${g} guard bits: ${2 * n + g}.`, '2n for the product, plus log2(N) guard bits.');
  },
]);

// ------------------------------------------------------------------ clocks, resets, CDC

export const clkPractice = practice('practice-clk', 'Clock Domain Drills', 'MTBF, synchronizers, Gray pointers, async FIFO depth, dividers', [
  (r, d) => {
    const tau = pick(r, [10, 20, 30]), extra = pick(r, [200, 500, 1000]);
    if (d < 3) return ask(`Metastability resolves with time constant τ = ${tau} ps. Adding a synchronizer stage gives ${extra} ps more resolution time. By what factor does MTBF grow? (e^(t/τ), scientific notation fine)`, qty(Math.exp(extra / tau), '', 0.05, Math.exp(extra / tau).toExponential(2).replace('e+', 'e')), `e^(${extra}/${tau}) = ${Math.exp(extra / tau).toExponential(2)}. Exponential: one extra flop turns hours into centuries.`, 'MTBF ∝ e^(t_resolve / τ).');
    const T0 = 1e-9, fc = pick(r, [500e6, 1e9]), fd = pick(r, [10e6, 100e6]), tr = pick(r, [0.6e-9, 0.8e-9]), t = tau * 1e-12;
    const mtbf = Math.exp(tr / t) / (T0 * fc * fd);
    const years = mtbf / 3.156e7;
    return ask(`MTBF = e^(t_r/τ) / (T0·f_clk·f_data). τ = ${tau} ps, T0 = 1 ns, f_clk = ${fc / 1e6} MHz, f_data = ${fd / 1e6} MHz, t_r = ${tr * 1e9} ns. MTBF in years (scientific notation fine)?`, qty(years, '', 0.05, years.toExponential(2).replace('e+', 'e')), `e^(${sig(tr / t)}) / (${sig(T0 * fc * fd)}) = ${sig(mtbf)} s = ${years.toExponential(2)} years. Multiply by the number of synchronizers on the chip and the number of chips shipped before judging it.`, 'Plug in; convert seconds to years (3.16e7 s).');
  },
  (r, d) => {
    const w = tier(d, 3, 4, 5);
    const b = between(r, 0, 2 ** w - 2);
    const g1 = gray(b), g2 = gray(b + 1);
    if (d < 3) return ask(`An async FIFO pointer increments from ${b} to ${b + 1}. In ${w}-bit Gray code, how many bits change?`, num(1), `${g1.toString(2).padStart(w, '0')} → ${g2.toString(2).padStart(w, '0')}: exactly one. In binary, ${b} → ${b + 1} flips ${(b ^ (b + 1)).toString(2).split('').filter((c) => c === '1').length} bits, which a synchronizer could capture half-updated.`, 'Gray code: consecutive values differ in one bit.');
    const x = between(r, 1, 2 ** w - 1);
    return ask(`The read side synchronizes the write pointer as Gray code ${gray(x).toString(2).padStart(w, '0')}. What binary pointer value is that?`, num(x), `Gray to binary (prefix XOR from the top): ${x}. The comparison for full/empty is done after conversion (or directly in Gray with the top-bit trick).`, 'b[i] = XOR of g[w-1..i].');
  },
  (r, d) => {
    const B = pick(r, [64, 100, 256]), fw = pick(r, [200, 250, 400]), fr = pick(r, tier(d, [100, 50], [125, 150], [160, 100]));
    const idleW = d === 3 ? pick(r, [1, 2]) : 0;
    const fwEff = idleW ? fw / (idleW + 1) : fw;
    const depth = Math.ceil(B - B * (fr / fwEff));
    return ask(`An async FIFO takes bursts of ${B} words written at ${fw} MHz${idleW ? `, one write every ${idleW + 1} cycles` : ''}, and drains at ${fr} MHz (one word per read cycle) continuously. Minimum depth so a burst never overflows?`, num(Math.max(0, depth)), `The burst lasts ${B}/${sig(fwEff)} µs; meanwhile ${sig(B * (fr / fwEff))} words are read. Depth = ${B} - ${sig(B * (fr / fwEff))} → ${Math.max(0, depth)}. Real designs add margin for synchronizer latency (a few words).`, 'Words written during the burst minus words read in the same time.');
  },
  (r, d) => {
    const f = pick(r, [100, 200, 400]), n = pick(r, tier(d, [2, 4], [3, 5, 8], [3, 5, 7]));
    if (d < 3) return ask(`A counter-based divider divides a ${f} MHz clock by ${n}. Output frequency, in MHz?`, qty(f / n, 'MHz', 0.01), `${f}/${n} = ${sig(f / n)} MHz.`, 'Divide.');
    return ask(`A divide-by-${n} made from one posedge counter (output high for ${Math.floor(n / 2)} of ${n} cycles). Duty cycle, in %?`, qty((Math.floor(n / 2) / n) * 100, '%', 0.01, sig((Math.floor(n / 2) / n) * 100)), `${Math.floor(n / 2)}/${n} = ${sig((Math.floor(n / 2) / n) * 100)}%. A 50% odd divider needs both clock edges (a negedge flop ORed in).`, 'High cycles / total cycles.');
  },
  (r) => {
    const qs = [
      ['A single control bit crosses from clock A to unrelated clock B. What is the standard fix?', 'A two-flop synchronizer in domain B', ['Nothing, it is one bit', 'A wider bus', 'An AND gate']],
      ['An 8-bit counter value crosses domains through 8 separate two-flop synchronizers. Problem?', 'Bits can resolve on different cycles, so B can see a value that never existed; use Gray code, a handshake, or an async FIFO', ['None', 'It uses too many flops', 'The synchronizers cancel each other']],
      ['A one-cycle pulse in a 500 MHz domain goes to a 100 MHz domain via a two-flop synchronizer. Problem?', 'The pulse can be missed entirely; stretch it or convert it to a toggle and detect the edge', ['It arrives twice', 'Nothing', 'It becomes metastable forever']],
      ['Two signals from the same domain are synchronized separately and then combined in domain B. Risk?', 'Reconvergence: they may arrive on different cycles, giving a combination that never existed', ['None', 'Too much power', 'Hold violations only']],
      ['Why must no logic sit between a source flop and the first synchronizer flop?', 'Combinational glitches could be captured as false pulses; the crossing must launch from a flop', ['It slows the clock', 'Synthesis forbids it', 'It uses more area']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}. CDC tools check exactly these rules.`);
  },
]);

export const DIGITAL_PRACTICE = [combPractice, seqPractice, fsmPractice, verilogPractice, aluPractice, clkPractice];

// ------------------------------------------------------------------ bosses

export const logicBoss = boss({
  id: 'boss-logic',
  title: 'The Vending Machine',
  concept: 'design an FSM and its logic from a spec, unguided',
  xp: 180,
  steps: [
    say('Boss fight, {name}. A client wants the controller for a vending machine. No hand-holding: here is the spec, you do the design. Exam rules.', 'thinking'),
    art(`SPEC
  · coins: nickel (5¢) or dime (10¢), one per clock at most
  · price: 15¢. When credit reaches 15¢ or more, dispense for one cycle
  · 20¢ paid → dispense and return a nickel (change) in the same cycle
  · then go back to 0¢ credit`),
    { t: 'gen', make: () => ask('How many states does a Moore machine need for credit (0, 5, 10, 15, 20)?', num(5), 'One state per credit value: 0, 5, 10, 15 (dispense), 20 (dispense + change). 5 states.') },
    { t: 'gen', make: () => ask('With binary encoding, how many flip-flops?', num(3), 'ceil(log2 5) = 3.') },
    { t: 'gen', make: () => ask('With one-hot encoding, how many flip-flops?', num(5), 'One per state: 5.') },
    { t: 'gen', make: (r) => { const coins = Array.from({ length: 6 }, () => pick(r, ['N', 'D', '-'])); let c = 0, n = 0; for (const x of coins) { if (c >= 15) c = 0; c += x === 'N' ? 5 : x === 'D' ? 10 : 0; if (c >= 15) n++; } return ask(`Coins over 6 cycles (N nickel, D dime, - none): ${coins.join(' ')}. How many times does it dispense?`, num(n), `Track credit, resetting after each dispense: ${n} dispense${n === 1 ? '' : 's'}.`); } },
    { t: 'gen', make: () => ask('With a 3-bit binary state s2 s1 s0 where 20¢ = 100 and 15¢ = 011, write the dispense output as a function of the state bits (any equivalent form; unused codes 101-111 may be treated as 0).', expr('s2&~s1&~s0 | ~s2&s1&s0', ['s2', 's1', 's0'], (v) => (v.s2 && !v.s1 && !v.s0) || (!v.s2 && v.s1 && v.s0)), 'dispense = (state == 011) | (state == 100) = ~s2&s1&s0 | s2&~s1&~s0. A don\'t-care for unused codes could simplify it further, but I checked the full table.') },
    mc('A nickel and a dime arrive in the same clock due to a sensor glitch. What should a robust design do?', ['Define the behaviour in the spec (e.g. count both, or reject) and handle it; never leave an input combination undefined', 'Nothing, it cannot happen', 'Stop the clock', 'Let it go to an unused state'], 0, 'Undefined input combinations are where real field failures come from.'),
    mc('The machine must also reset to 0¢ on power-up. Which reset style?', ['An asynchronous reset asserted immediately, released synchronously through a reset synchronizer', 'No reset: the flops power up at 0', 'Reset only through the coin input', 'A synchronous reset with no clock running'], 0, 'Flops power up random; async assert + sync release is the standard pattern.'),
  ],
  recap: ['Spec → states → encoding → logic.', 'Moore outputs from states; one-hot vs binary trade.', 'Handle every input combination and the reset.'],
});

export const hdlBoss = boss({
  id: 'boss-hdl',
  title: 'The Code Review',
  concept: 'review real RTL and find every bug before synthesis does',
  xp: 180,
  steps: [
    say('Boss fight. A junior engineer submitted this module for review. Tapeout depends on it. Find the problems. Exam rules.', 'thinking'),
    art(`module packer (input clk, rst_n, input [7:0] din, input vld,
               output reg [15:0] dout, output reg dvld);
  reg [7:0] lo; reg half;
  always @(posedge clk or negedge rst_n)
    if (!rst_n) half <= 0;
    else if (vld) begin
      half = ~half;                       // (1)
      if (!half) lo <= din;
      else begin dout <= {lo, din}; end
    end
  always @(*) if (half) dvld = vld;       // (2)
endmodule`),
    mc('What is wrong at (1)?', ['A blocking assignment in a clocked block: the if below sees the NEW half, inverting the packing logic (and mixing = with <= on half)', 'Nothing', 'half must be 8 bits', '~ should be !'], 0, 'Use half <= ~half. The later if then sees the old half, as intended.'),
    mc('What is wrong at (2)?', ['dvld is not assigned when half = 0, so a latch is inferred', 'The sensitivity list is wrong', 'dvld must be a wire', 'Nothing'], 0, 'Assign a default: always @(*) dvld = half & vld;'),
    { t: 'gen', make: () => ask('What is the width of {lo, din}?', num(16), '8 + 8 = 16 bits: matches dout.') },
    mc('dout and lo have no reset. Is that a problem?', ['Usually acceptable for datapath registers if dvld (the control) is reset and qualifies them; resetting wide datapaths costs area and routing', 'Always a bug', 'It causes latches', 'It breaks synthesis'], 0, 'Reset control, not necessarily data. Verification must still check X is never observed on outputs when dvld = 1.'),
    { t: 'gen', make: (r) => { const n = between(r, 3, 6); return ask(`After the fixes, ${2 * n} valid bytes arrive back-to-back. How many 16-bit words come out?`, num(n), `Two bytes per word: ${n}.`); } },
    mc('How would you verify this module most efficiently?', ['A self-checking testbench with a reference model (a queue of bytes), random vld gaps, and assertions that dvld pulses once per two bytes', 'Look at waveforms by eye', 'Synthesize it and count gates', 'Run one directed test'], 0, 'Random stimulus + model + assertions finds the corner cases (back-to-back, gaps, reset mid-word).'),
  ],
  recap: ['<= in clocked blocks.', 'Every combinational output assigned on every path.', 'Widths; reset strategy; self-checking tests.'],
});

export const uarchBoss = boss({
  id: 'boss-uarch',
  title: 'The Datapath',
  concept: 'size and pipeline a multiply-accumulate datapath',
  xp: 180,
  steps: [
    say('Boss fight. An audio DSP needs a 16×16 multiply-accumulate unit summing 1024 products at 800 MHz. Design the datapath on paper. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('Signed 16×16 product width, in bits?', num(32), '2 × 16 = 32 bits.') },
    { t: 'gen', make: () => ask('Accumulator width so 1024 products can never overflow?', num(42), '32 + log2(1024) = 42 bits.') },
    { t: 'gen', make: () => ask('Radix-4 Booth: how many partial products for 16×16?', num(8), 'Two multiplier bits per Booth digit: 16/2 = 8.') },
    { t: 'gen', make: () => ask('The multiplier takes 1800 ps and the accumulate adder 600 ps; flop overhead is 100 ps per stage. Unpipelined (one stage), what is the clock period, in ps?', qty(2500, 'ps', 0.01), '1800 + 600 + 100 = 2500 ps: only 400 MHz.') },
    { t: 'gen', make: () => ask('To reach 800 MHz (1250 ps), what is the minimum number of pipeline stages, if the logic can be split evenly? (period = 2400/k + 100)', num(3), '2400/k + 100 ≤ 1250 → k ≥ 2.09 → 3 stages (900 ps per stage).') },
    { t: 'gen', make: (r) => { const a = between(r, 0x60, 0x7f), b = between(r, 0x40, 0x7f); const s = (a + b) & 255; return ask(`A saturating 8-bit adder check: ${hex(a)} + ${hex(b)} (signed). Plain wrap-around result would be ${hex(s)}. What does a saturating adder output (hex)?`, hexa(0x7f, 2), `${a} + ${b} = ${a + b} > 127: signed overflow (V = 1). Saturation clamps to 0x7F instead of wrapping to ${s - 256}. Audio and ML datapaths saturate because wrap-around sounds like a gunshot.`); } },
    mc('The accumulator adder is now in the critical path because it feeds itself every cycle. Classic fix?', ['Carry-save accumulation: keep the sum in redundant form and resolve it only at the end', 'Add more pipeline stages inside the loop', 'Use a ripple-carry adder', 'Lower the voltage'], 0, 'A loop cannot be pipelined without changing the result timing; carry-save removes carry propagation from the loop.'),
  ],
  recap: ['Product 2n bits, + log2(N) guard bits.', 'Booth halves partial products.', 'Pipelining for throughput; loops need carry-save.', 'Saturate, don\'t wrap.'],
});

export const cdcBoss = boss({
  id: 'boss-cdc',
  title: 'The Crossing',
  concept: 'find and fix every clock-domain-crossing bug in a subsystem',
  xp: 180,
  steps: [
    say('Boss fight. A camera subsystem drops frames once a day in the field. It has a 150 MHz sensor clock and a 400 MHz system clock. The CDC report was waived. You un-waive it. Exam rules.', 'concerned'),
    art(`sensor_clk (150 MHz)                sys_clk (400 MHz)
  frame_start pulse (1 cycle)  ───►  2-flop sync ──► rising-edge detect
  line_count[11:0]             ───►  12 × 2-flop sync
  pixel data                   ───►  async FIFO (Gray pointers)
  soft_reset (from sys)        ◄───  wire (no sync)`),
    mc('frame_start crosses slow → fast. Can a 1-cycle pulse be missed?', ['No: a 150 MHz pulse lasts 6.7 ns, longer than a 400 MHz period (2.5 ns), so the fast domain always samples it', 'Yes, always', 'Only at high temperature', 'Only if the FIFO is full'], 0, 'Slow-to-fast pulses are safe if the pulse is wider than about 1.5 destination periods. The reverse direction is the danger.'),
    mc('line_count uses 12 independent synchronizers. What is the bug?', ['Bits can resolve on different cycles, so sys sees a corrupted count; send it in Gray code (it only increments) or through a handshake', 'None', 'It needs 3 flops per bit', 'It should be 16 bits'], 0, 'Multi-bit binary values must never cross through per-bit synchronizers.'),
    { t: 'gen', make: () => ask('Pixels arrive at 150 MHz in bursts of 2048 per line and drain at 400 MHz with one read every 4 cycles (100 MHz effective). Minimum FIFO depth for one line?', num(Math.ceil(2048 - 2048 * (100 / 150))), '2048 - 2048 × 100/150 = 683 words. Round up to 1024 with margin.') },
    mc('soft_reset crosses from sys to sensor with no synchronizer. What should it be?', ['An async-assert, sync-release reset synchronizer in the sensor domain', 'A plain wire is fine for resets', 'A Gray-code counter', 'An async FIFO'], 0, 'Reset deassertion is a CDC event: it must be synchronized to each domain it releases.'),
    { t: 'gen', make: () => { const m = Math.exp(1.2e-9 / 25e-12) / (1e-9 * 400e6 * 150e6) / 3.156e7; return ask('With τ = 25 ps, T0 = 1 ns, f_clk = 400 MHz, f_data = 150 MHz and 1.2 ns of resolution time, what is one synchronizer\'s MTBF, in years? (scientific notation fine)', qty(m, '', 0.05, m.toExponential(2).replace('e+', 'e')), `e^48 / (6e7) = ${m.toExponential(2)} years: plenty. The daily frame drops were the multi-bit count, not metastability.`); } },
    mc('What single process change would have caught this before silicon?', ['Run structural CDC analysis and never waive violations without a design review; add CDC assertions and formal checks', 'More directed tests', 'Faster simulators', 'Lower clock frequencies'], 0, 'CDC bugs rarely show in RTL simulation: simulators do not model metastability. Static CDC tools and reviews catch them.'),
  ],
  recap: ['Slow→fast pulses are safe if wide enough.', 'Multi-bit data: Gray, handshake or async FIFO.', 'Synchronize reset release.', 'MTBF is exponential; CDC tools, not simulation, find these.'],
});

export const DIGITAL_BOSSES = [logicBoss, hdlBoss, uarchBoss, cdcBoss];

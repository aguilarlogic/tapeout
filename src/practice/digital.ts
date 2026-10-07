// Practice banks and bosses for digital design: combinational and sequential logic, FSMs, Verilog, datapaths, clocking.
import { bin, expr, hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, show, sim, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, type ConceptQ, exact, hex, mcs, shuffle, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';
const bits = (r: Rng, n: number) => Array.from({ length: n }, () => (r() < 0.5 ? 1 : 0)).join('');
const gray = (b: number) => b ^ (b >> 1);

/** Count (overlapping) occurrences of `pat` in `s`: what a sequence-detector FSM fires on. */
const matches = (s: string, pat: string) => { let n = 0; for (let i = 0; i + pat.length <= s.length; i++) if (s.slice(i, i + pat.length) === pat) n++; return n; };

// ------------------------------------------------------------------ combinational

/** Truth table of f over `vars` as text, for walkthroughs. */
function truthTable(vars: readonly string[], f: (v: Record<string, boolean>) => boolean) {
  const rows = [`${vars.join(' ')} | y`];
  for (let i = 0; i < 2 ** vars.length; i++) {
    const v: Record<string, boolean> = {};
    vars.forEach((n, k) => { v[n] = !!((i >> (vars.length - 1 - k)) & 1); });
    rows.push(`${vars.map((n) => (v[n] ? '1' : '0').padStart(n.length)).join(' ')} | ${f(v) ? 1 : 0}`);
  }
  return rows.join('\n');
}

export const combPractice = practice('practice-comb', 'Building Block Drills', 'muxes, decoders, adders, encoders, Gray code', [
  (r, d) => {
    const n = pick(r, tier(d, [2, 4, 8], [16, 32, 5], [64, 12, 100]));
    const k = Math.ceil(Math.log2(n));
    const variants = [
      [1, `How many select bits does a ${n}:1 mux need?`, k, `ceil(log2 ${n}) = ${k}.`, 'select bits of a mux', 'A mux chooses one of n inputs, and the select lines are a binary number saying which one. k select bits can name 2^k different inputs, so you need the smallest k with 2^k at least n.', [count(`Smallest k such that 2^k is at least ${n}:`, `ceil(log2(${n}))`, k)]],
      [2, `How many 2:1 muxes does it take to build a ${n}:1 mux as a tree?`, n - 1, `Each 2:1 mux removes one candidate: ${n} → 1 needs ${n - 1}.`, 'counting the muxes in a mux tree', 'A 2:1 mux takes two candidates and leaves one, so it removes exactly one candidate. Going from n candidates down to 1 candidate means removing n - 1 of them, which takes n - 1 muxes.', [count(`${n} candidates must become 1. Each 2:1 mux removes one. Muxes needed:`, `${n} - 1`, n - 1)]],
      [3, `A decoder has enough outputs to select one of ${n} registers. How many inputs does it have?`, k, `ceil(log2 ${n}) = ${k} inputs (${2 ** k} outputs, some unused).`, 'decoder inputs', 'A decoder turns a binary number into one active output line. With k input bits it can drive 2^k different outputs, so to reach n registers you need the smallest k with 2^k at least n.', [count(`Smallest k such that 2^k is at least ${n}:`, `ceil(log2(${n}))`, k)]],
    ] as const;
    const [, q, v, why, method, idea, beats] = pick(r, variants.filter((x) => x[0] <= d));
    return walk(ask(q, num(v), why, 'Think powers of two.'), method, idea, ...beats);
  },
  (r, d) => {
    const w = tier(d, 4, 8, 8);
    const a = between(r, 0, 2 ** w - 1), b = between(r, 0, 2 ** w - 1);
    const s = a + b;
    const idea = `An adder produces one more bit than its inputs: a ${w}-bit adder gives a ${w}-bit sum plus a carry-out. If the true sum fits in ${w} bits (at most ${2 ** w - 1}) there is no carry. Otherwise the carry-out is 1 and the ${w}-bit result is the true sum minus ${2 ** w}. So: add in decimal, then see if you went over.`;
    if (d < 3) return walk(ask(`A ${w}-bit adder adds ${hex(a, w / 4)} + ${hex(b, w / 4)}. What is the ${w}-bit sum (hex), ignoring carry-out?`, hexa(s & (2 ** w - 1), w / 4), `${a} + ${b} = ${s}${s >= 2 ** w ? `, which overflows ${w} bits: carry-out 1, sum ${hex(s & (2 ** w - 1), w / 4)}` : ` = ${hex(s, w / 4)}, no carry-out`}.`, 'Add in decimal, then take it modulo 2^w.'),
      'adding fixed-width numbers', idea,
      count(`${hex(a, w / 4)} is ${a} and ${hex(b, w / 4)} is ${b}. True sum:`, `${a} + ${b}`, s),
      choice(`Is the true sum more than ${2 ** w - 1} (too big for ${w} bits)?`, s >= 2 ** w ? `Yes: it wraps, so subtract ${2 ** w}` : 'No: it fits as it is', [s >= 2 ** w ? 'No: it fits as it is' : `Yes: it wraps, so subtract ${2 ** w}`]),
      step(`The ${w}-bit result, in hex:`, hexa(s & (2 ** w - 1), w / 4)));
    return walk(ask(`8-bit adder: ${hex(a)} + ${hex(b)}. What is the carry-out (0 or 1)?`, num(s >= 256 ? 1 : 0), `${a} + ${b} = ${s}: ${s >= 256 ? 'more than 255, so carry-out = 1' : 'fits in 8 bits, carry-out = 0'}. For unsigned numbers, carry-out means overflow.`, 'Does the true sum exceed 255?'),
      'the carry-out of an adder', idea,
      count(`${hex(a)} is ${a} and ${hex(b)} is ${b}. True sum:`, `${a} + ${b}`, s),
      count('The carry-out is 1 if the sum is 256 or more, else 0:', `${s} >= 256 ?`, s >= 256 ? 1 : 0));
  },
  (r, d) => {
    const n = pick(r, tier(d, [4, 8], [16, 32], [32, 64]));
    const tfa = pick(r, [20, 30, 50]);
    const ripple = 'A ripple-carry adder chains full adders: each one must wait for the carry from the one before, so the carry ripples through every stage and delay grows with n. A parallel-prefix adder (Kogge-Stone) computes all carries together in log2(n) levels, each level doubling how far the information reaches: faster, but more wires.';
    if (d === 1) return walk(ask(`A ${n}-bit ripple-carry adder, ${tfa} ps per full-adder carry stage. Worst-case delay, in ps?`, qty(n * tfa, 'ps', 0.01), `The carry ripples through all ${n} stages: ${n} × ${tfa} = ${n * tfa} ps. O(n).`, 'Carry through every stage.'),
      'ripple-carry delay', ripple,
      calc('Worst case: the carry passes through every stage, n × delay per stage:', `${n} × ${tfa}`, n * tfa, 'ps', String(n * tfa), 0.01));
    const lv = Math.log2(n);
    if (d === 2) return walk(ask(`A ${n}-bit parallel-prefix (Kogge-Stone) adder: how many prefix levels compute all the carries?`, num(lv), `log2(${n}) = ${lv} levels: O(log n) delay, paid for with O(n log n) wiring.`, 'Each level doubles the span.'),
      'prefix adder levels', ripple,
      count(`After level 1 each bit knows about 2 bits, after level 2 about 4, and so on: span doubles. Levels until the span reaches ${n}:`, `log2(${n})`, lv));
    return walk(ask(`${n}-bit adders: ripple at ${tfa} ps per bit versus Kogge-Stone at ${tfa * 2} ps per prefix level (plus one ${tfa} ps level each for setup and sum). How many ps faster is Kogge-Stone?`, qty(n * tfa - (lv * 2 * tfa + 2 * tfa), 'ps', 0.01), `Ripple: ${n * tfa} ps. KS: ${lv} × ${2 * tfa} + ${2 * tfa} = ${lv * 2 * tfa + 2 * tfa} ps. Difference ${n * tfa - (lv * 2 * tfa + 2 * tfa)} ps.`, 'Compare O(n) with O(log n).'),
      'comparing adder speeds', ripple,
      calc('Ripple delay, n × per-bit delay:', `${n} × ${tfa}`, n * tfa, 'ps', String(n * tfa), 0.01),
      count(`Prefix levels, log2(${n}):`, `log2(${n})`, lv),
      calc(`Kogge-Stone delay: levels × ${2 * tfa} ps, plus the setup and sum levels (${tfa} ps each, two of them):`, `${lv} × ${2 * tfa} + 2 × ${tfa}`, lv * 2 * tfa + 2 * tfa, 'ps', String(lv * 2 * tfa + 2 * tfa), 0.01),
      calc('How much faster is Kogge-Stone (ripple minus KS)?', `${n * tfa} - ${lv * 2 * tfa + 2 * tfa}`, n * tfa - (lv * 2 * tfa + 2 * tfa), 'ps', String(n * tfa - (lv * 2 * tfa + 2 * tfa)), 0.01));
  },
  (r, d) => {
    const w = tier(d, 4, 8, 8);
    const v = between(r, 1, 2 ** w - 1);
    const bitsText = v.toString(2).padStart(w, '0');
    const positions = `bit:   ${Array.from({ length: w }, (_, i) => w - 1 - i).join(' ')}\nvalue: ${bitsText.split('').join(' ')}`;
    if (d < 3) return walk(ask(`A ${w}-input priority encoder (highest bit wins) sees ${bitsText}. What index does it output?`, num(Math.floor(Math.log2(v))), `The highest set bit is bit ${Math.floor(Math.log2(v))}. Interrupt controllers and arbiters are built on priority encoders.`, 'Find the leftmost 1.'),
      'priority encoding', 'A priority encoder looks at many request lines and reports the INDEX of the one that wins. When several lines are 1, a fixed rule decides: here the highest-numbered line wins. Bits are numbered from 0 at the right, so the leftmost 1 is the winner.',
      show(positions, 'bit numbers, 0 on the right'),
      ...sim(Array.from({ length: w - Math.floor(Math.log2(v)) }, (_, i) => { const bt = w - 1 - i, on = (v >> bt) & 1; return { beats: [choice(`Look at bit ${bt}, the next one from the left. Is it a 1?`, on ? 'Yes: the winner' : 'No: keep looking', [on ? 'No: keep looking' : 'Yes: the winner'])], row: `bit ${bt}: ${on}` }; }), 3, 'scanning from the left until the first 1'),
      count('Index of the leftmost 1:', `leftmost 1 in ${bitsText}`, Math.floor(Math.log2(v))));
    return walk(ask(`Same 8-bit input ${bitsText}, but the encoder picks the LOWEST set bit. Index?`, num(Math.log2(v & -v)), `v & -v = ${(v & -v).toString(2)} → bit ${Math.log2(v & -v)}.`, 'Find the rightmost 1.'),
      'priority encoding, lowest wins', 'This encoder reports the index of the LOWEST-numbered request that is 1. Bits are numbered from 0 at the right, so the winner is the rightmost 1. (The expression v & -v isolates exactly that bit.)',
      show(positions, 'bit numbers, 0 on the right'),
      ...sim(Array.from({ length: Math.log2(v & -v) + 1 }, (_, i) => { const on = (v >> i) & 1; return { beats: [choice(`Look at bit ${i}, the next one from the right. Is it a 1?`, on ? 'Yes: the winner' : 'No: keep looking', [on ? 'No: keep looking' : 'Yes: the winner'])], row: `bit ${i}: ${on}` }; }), 3, 'scanning from the right until the first 1'),
      count('Index of the rightmost 1:', `rightmost 1 in ${bitsText}`, Math.log2(v & -v)));
  },
  (r, d) => {
    const w = tier(d, 3, 4, 8);
    const b = between(r, 1, 2 ** w - 1);
    if (d < 3) return walk(ask(`Convert the ${w}-bit binary ${b.toString(2).padStart(w, '0')} to Gray code (binary answer).`, bin(gray(b), w), `g = b ^ (b >> 1) = ${gray(b).toString(2).padStart(w, '0')}. Consecutive Gray codes differ in exactly one bit.`, 'XOR each bit with the bit to its left.'),
      'binary to Gray code', 'Gray code is a way of counting where each step along the counting sequence changes only ONE bit (jumping between arbitrary values does not). To convert: g = b XOR (b shifted right by one). Equivalently, each Gray bit is the XOR of the same binary bit and the binary bit to its left (the top bit is copied unchanged).',
      step('Shift the binary number right by one (drop the last bit, add a 0 at the left):', bin(b >> 1, w)),
      step('XOR it, bit by bit, with the original. That is the Gray code:', bin(gray(b), w)));
    const g = gray(b);
    const gb = g.toString(2).padStart(w, '0'), bb = b.toString(2).padStart(w, '0');
    return walk(ask(`Convert the 8-bit Gray code ${gb} back to binary (binary answer).`, bin(b, 8), `Each binary bit is the XOR of all Gray bits at or above it: ${bb}.`, 'b[7] = g[7]; b[i] = b[i+1] ^ g[i].'),
      'Gray code to binary', 'Going back is done from the top bit down: the top binary bit equals the top Gray bit, and every next binary bit is (the binary bit above it) XOR (the Gray bit at this position). Each binary bit is therefore the XOR of all Gray bits at or above it.',
      count(`b[7] is copied from g[7] = ${gb[0]}:`, 'b7', +bb[0]),
      ...Array.from({ length: 7 }, (_, i) => count(`b[${6 - i}] = b[${7 - i}] XOR g[${6 - i}] (${bb[i]} XOR ${gb[i + 1]}):`, `${bb[i]} XOR ${gb[i + 1]}`, +bb[i + 1])),
      step('Write the eight bits of b, from b[7] down to b[0]:', bin(b, 8)));
  },
  (r, d) => {
    const cases = [
      ['y = 1 when a 2-bit number {a1,a0} equals the 2-bit number {b1,b0}', ['a1', 'a0', 'b1', 'b0'], (v: Record<string, boolean>) => v.a1 === v.b1 && v.a0 === v.b0, '~(a1 ^ b1) & ~(a0 ^ b0)', ['Two bits are equal exactly when their XOR is:', '0, so ~(x ^ y) is 1', ['1', 'always 0']]],
      ['y = 1 when {a1,a0} > {b1,b0} (unsigned)', ['a1', 'a0', 'b1', 'b0'], (v: Record<string, boolean>) => 2 * +v.a1 + +v.a0 > 2 * +v.b1 + +v.b0, 'a1&~b1 | ~(a1^b1)&a0&~b0', ['To compare two numbers, which bits decide first?', 'The top bits; the low bits matter only if the top bits are equal', ['The low bits first', 'Only the bits of b']]],
      ['the carry-out of a full adder with inputs a, b, cin', ['a', 'b', 'cin'], (v: Record<string, boolean>) => +v.a + +v.b + +v.cin >= 2, 'a&b | cin&(a^b)', ['A full adder carries out when:', 'At least two of the three inputs are 1', ['Exactly one input is 1', 'All inputs are 0']]],
      ['the sum of a full adder with inputs a, b, cin', ['a', 'b', 'cin'], (v: Record<string, boolean>) => (+v.a + +v.b + +v.cin) % 2 === 1, 'a ^ b ^ cin', ['The sum bit of a full adder is 1 when:', 'An odd number of the inputs are 1', ['At least two inputs are 1', 'All inputs are equal']]],
      ['a 2:1 mux: y = d1 when s, else d0', ['s', 'd0', 'd1'], (v: Record<string, boolean>) => (v.s ? v.d1 : v.d0), 's&d1 | ~s&d0', ['A 2:1 mux passes:', 'd1 when s = 1, and d0 when s = 0', ['d0 when s = 1', 'Both at once']]],
      ['y = 1 when {a1,a0} < {b1,b0} (unsigned)', ['a1', 'a0', 'b1', 'b0'], (v: Record<string, boolean>) => 2 * +v.a1 + +v.a0 < 2 * +v.b1 + +v.b0, '~a1&b1 | ~(a1^b1)&~a0&b0', ['To compare two numbers, which bit decides first?', 'The most significant bit that differs', ['The least significant bit', 'The sum of the bits']]],
      ['y = 1 when {a1,a0} + {b1,b0} carries out of 2 bits (the sum is 4 or more)', ['a1', 'a0', 'b1', 'b0'], (v: Record<string, boolean>) => 2 * +v.a1 + +v.a0 + 2 * +v.b1 + +v.b0 >= 4, 'a1&b1 | (a1|b1)&a0&b0', ['A 2-bit add carries out when:', 'The top bits both 1, or one is 1 and the low bits carry', ['Either low bit is 1', 'The inputs are equal']]],
      ['y = 1 when exactly one of a, b, c is 1', ['a', 'b', 'c'], (v: Record<string, boolean>) => +v.a + +v.b + +v.c === 1, 'a&~b&~c | ~a&b&~c | ~a&~b&c', ['Exactly one input is 1 means:', 'Only the three single-1 rows give y = 1', ['Every row with any 1 gives y = 1', 'Only the all-ones row gives y = 1']]],
    ] as const;
    const [desc, vars, f, canon, [pq, pr, pw]] = pick(r, d === 1 ? cases.slice(2, 5) : d === 2 ? cases.slice(0, 4) : [cases[0], cases[1], cases[2], cases[5], cases[6], cases[7]]);
    const a = expr(canon, [...vars], f);
    return walk(ask(`Write a boolean expression for ${desc}. (& | ^ ~, any equivalent form)`, a, `One answer: ${canon}. Checked against the full truth table.`, 'Write the truth table rows where y = 1.'),
      'from a truth table to an expression', 'Any logic function can be written from its truth table: list every input combination and mark where y is 1. Each 1-row becomes an AND of the inputs (an input that is 0 in that row is written with ~), and you OR the rows together (sum of products). Then simplify by spotting patterns like XOR. Operators here: & AND, | OR, ^ XOR, ~ NOT.',
      show(truthTable(vars, f), 'the function as a truth table'),
      choice(pq, pr, pw),
      step('Now write the expression:', a));
  },
]);

// ------------------------------------------------------------------ sequential

const Q_SEQ1: ConceptQ[] = [
  ['What is the difference between a latch and a flip-flop?', 'A latch is transparent while enabled; a flop samples at the edge', ['They are identical, apart from the name they are given in a library', 'A flip-flop is transparent for as long as the clock stays high', 'Latches cannot store data, so they are only used inside a flop'], 'latch versus flip-flop', 'A latch is a storage element with an enable: while the enable is high it is see-through (the output follows the input), and when the enable falls it holds. A flip-flop looks at its input only at one instant, the clock edge, and holds it for the whole cycle. That is why flip-flops make tidy, predictable pipelines.', ['A flip-flop pays attention to its input:', 'Only at the clock edge', ['The whole time the clock is high', 'Never']], 'A latch is transparent while its enable is high; a flip-flop samples only at the clock edge'],
  ['Setup time is violated when data arrives…', 'Too late before the clock edge', ['Too early, after the previous edge has passed', 'Exactly on the edge, with no margin at all', 'After the hold window has closed for the flop'], 'setup time', 'A flip-flop needs its input to be steady for a short time BEFORE the clock edge (setup) and a short time AFTER it (hold). Setup is violated when the data settles too late, leaving less than the required time before the edge.', ['Setup is measured relative to the clock edge, looking:', 'Before it', ['After it', 'At a random time']]],
      ['What does a flip-flop do at the active clock edge?', 'Samples D and holds it until the next edge', ['Passes D straight through while the clock is high', 'Clears its output, ready for the next cycle', 'Stores D only if the reset is also asserted'],
        'edge-triggered storage', 'A flip-flop looks at its input only at the instant of the active clock edge, then ignores it. That is why the logic between flops can settle in between.',
        ['Between clock edges, a change on D:', 'Does not reach Q', ['Reaches Q at once', 'Resets the flop']]],
      ['Hold time is violated when data…', 'Changes too soon after the clock edge', ['Arrives too late before the clock edge', 'Never changes at all between two edges', 'Changes while the clock is low'],
        'hold time', 'The flop needs its input to stay steady for a short time after the edge. If the next data races through too quickly, it overwrites what should have been captured.',
        ['Hold is about data after the edge, setup about data:', 'Before the edge', ['At the edge', 'After a reset']]],
      ['Which gives a clock-to-Q delay?', 'The time from the clock edge until Q settles', ['The time for D to reach the flop input', 'The time between two clock edges', 'The time that the reset needs to release'],
        'clock-to-Q', 'After the edge the flop output does not change at once; it takes a short delay, clock-to-Q. It is the first term in a path delay, before the logic delay and the setup time.',
        ['The first term of a path delay is:', 'Clock-to-Q', ['The setup time', 'The hold time']]],
      ['Why does a synchronous reset need a running clock?', 'It is only sampled at a clock edge', ['It is stronger than an asynchronous reset', 'It uses less area than any other reset', 'It resets the clock tree as well'],
        'reset styles', 'A synchronous reset is just another input of the flop, so it takes effect at the next edge. An asynchronous reset acts at once, with no clock needed.',
        ['A synchronous reset acts:', 'At the next clock edge', ['Immediately', 'Only at power-up']]],
];
const Q_SEQ2: ConceptQ[] = [
  ['Why is gating a clock with a plain AND gate dangerous?', 'The enable can glitch while the clock is high', ['It uses far too much area for a single gating cell', 'AND gates cannot pass a clock signal at all', 'It makes the clock faster than the flops can follow'], 'safe clock gating', 'AND-ing a clock with an enable switches the clock on and off. If the enable changes while the clock is high, the output gets a short, partial pulse (a runt) that can clock flops at the wrong moment. A clock-gating cell holds the enable in a latch that only changes while the clock is low, so the output is always clean.', ['If the enable changes while the clock is high, the gated clock gets:', 'A partial pulse (a glitch)', ['A faster edge', 'Nothing']], 'The enable can glitch while the clock is high, producing runt clock pulses; use an integrated clock-gating cell with a latch'],
  ['Why prefer a clock-enable mux over a gated clock in FPGA designs?', 'FPGA clocks are dedicated; enables keep one clean clock', ['Muxes are faster than the dedicated clock buffers are', 'Gated clocks do not simulate correctly in FPGA tools', 'Enables use no logic at all, so they are free in the fabric'], 'enables versus gated clocks in FPGAs', 'An FPGA has special, carefully balanced wires for clocks. Putting logic in the clock path pulls it off those wires and creates timing trouble. A clock enable keeps the one clean clock everywhere and simply tells the flop whether to load, which the tools handle well.', ['FPGA clock networks are:', 'Dedicated, carefully balanced wires', ['Ordinary logic wires', 'Unused']], 'FPGA clock networks are dedicated; enables keep one clean clock and let the tools time everything'],
      ['What does an integrated clock-gating cell add to the AND gate?', 'A latch that holds the enable steady while the clock is high', ['A second AND gate for the reset', 'A buffer that makes the clock faster', 'A flop that samples the enable on the falling edge only'],
        'ICG cells', 'The latch is transparent while the clock is low, so the enable can only change then. During the high phase it is frozen, so the gated clock never has a runt pulse.',
        ['The latch is transparent when the clock is:', 'Low', ['High', 'Gated']]],
      ['Why gate the clock of an idle block?', 'To cut its dynamic power: no clock edges, no switching', ['To make the block run faster when it wakes up', 'To remove leakage current from the transistors', 'To reduce the number of flops in the block'],
        'clock gating', 'Dynamic power comes from toggling. A gated clock stops the flops and everything they drive from switching, but leakage still flows, which needs power gating to remove.',
        ['Clock gating saves mainly:', 'Dynamic power', ['Leakage power', 'Wire area']]],
      ['What is clock skew?', 'The difference in clock arrival time between two flops', ['The change in clock period from one cycle to the next', 'The delay of the clock inside one flop', 'The fraction of the period that the clock is high'],
        'skew', 'The clock tree cannot reach every flop at exactly the same instant. The spread between arrival times is skew; it can help or hurt setup and hold, depending on its direction.',
        ['Skew is a difference in:', 'Arrival time between flops', ['Period between cycles', 'Duty cycle']]],
      ['What is jitter?', 'Cycle-to-cycle variation of a clock edge from its ideal time', ['A fixed delay between two flops on the same clock', 'The spread of arrival times across the tree', 'The loss of amplitude on a long clock wire'],
        'jitter', 'Even at one flop, the edges do not arrive on an ideal grid; noise moves them a little each cycle. Timing budgets keep a margin for it, as it eats directly into the period.',
        ['Jitter varies from cycle to cycle, at:', 'One flop', ['Every flop equally', 'No flop']]],
];
const Q_SEQ3: ConceptQ[] = [
  ['A flop\'s D input changes right at the clock edge. What can happen?', 'Metastability: the output hovers between 0 and 1', ['Nothing at all, since the flop is edge triggered here', 'The flop always captures a 0 when this happens at the edge', 'The clock stops, until the data input has settled again'], 'metastability', 'If the input changes inside the setup/hold window, the flop cannot decide between 0 and 1: its output can hover in between for an unpredictable time before falling one way. The longer you wait, the less likely it is still undecided, but the wait has no fixed upper bound.', ['A metastable flop\'s output is:', 'Between 0 and 1, for an unpredictable time', ['Always 0', 'Always 1']], 'Metastability: the output hovers between 0 and 1 for an unbounded time before resolving'],
  ['Why are asynchronous-reset flops released through a synchronizer?', 'Release near a clock edge can free flops unevenly', ['To save power while the design sits in reset for long', 'Because reset is a clock, and clocks must be synchronized', 'To make the reset signal itself arrive earlier at the flops'], 'reset synchronization', 'Asserting an async reset is safe at any time, but RELEASING it near a clock edge is just like an async input changing at the edge: some flops may see it and some not, or go metastable. A synchronizer makes the release line up cleanly with the clock.', ['Releasing reset near a clock edge is risky because:', 'Flops may see it at different times or go metastable', ['It shortens the clock', 'It resets the clock']], 'If reset deasserts near a clock edge, flops can leave reset on different cycles or go metastable'],
      ['How long does a metastable flop stay unresolved?', 'There is no hard bound; the chance falls off exponentially', ['Exactly one clock period, then it resolves', 'Until the next reset arrives at the flop', 'Never, once it has gone metastable for a cycle'],
        'resolution time', 'Resolution time is random with an exponential tail. Waiting a whole extra cycle (a second flop) makes the chance of failure astronomically small, but never zero.',
        ['Waiting longer makes failure:', 'Exponentially less likely', ['Certain', 'No different']]],
      ['What does MTBF depend on for a synchronizer?', 'The clock rate, the data rate, and the time allowed to resolve', ['Only the number of flops in the design', 'Only the supply voltage of the chip', 'The depth of the logic before the first flop'],
        'synchronizer MTBF', 'Failures come when data changes near an edge. More edges and more data changes mean more chances, while extra resolution time cuts the chance a lot, which is why a second stage helps.',
        ['A faster clock gives a:', 'Lower MTBF', ['Higher MTBF', 'Same MTBF']]],
      ['Which signal is safe to cross clock domains with a plain two-flop synchronizer?', 'A single, slowly changing control bit', ['A 16-bit bus that changes every cycle', 'A pulse that is one fast clock cycle wide', 'Two bits that must change at the same instant'],
        'what crosses safely', 'A two-flop synchronizer protects one bit. Buses, narrow pulses and linked bits need a handshake, a Gray code, a pulse stretcher or an async FIFO.',
        ['A bus needs more than a synchronizer because bits:', 'Can arrive in different cycles', ['Are too fast', 'Use more power']]],
      ['Why is reset deassertion more dangerous than assertion?', 'It can happen near a clock edge, and flops leave reset unevenly', ['It uses more current than assertion does', 'It always needs a longer pulse than assertion', 'It resets the clock tree as well'],
        'reset release', 'Assertion can be asynchronous without harm. Release must be synchronous: if some flops see it one cycle earlier, the design starts in a state that never existed.',
        ['Reset release is best made:', 'Synchronous to the clock', ['Asynchronous', 'Random']]],
];

export const seqPractice = practice('practice-seq', 'Flop & Counter Drills', 'counters, shift registers, LFSRs, setup/hold, Fmax', [
  (r, d) => {
    const M = pick(r, tier(d, [4, 8, 10], [6, 12, 60], [7, 24, 100])), s = between(r, 0, M - 1), n = between(r, 3, tier(d, 10, 40, 1000));
    return walk(ask(`A mod-${M} counter (counts 0..${M - 1} then wraps) starts at ${s}. What does it hold after ${n} clock edges?`, num((s + n) % M), `(${s} + ${n}) mod ${M} = ${(s + n) % M}.`, 'Add, then take the remainder.'),
      'modulo counters', `A mod-${M} counter goes up by one each clock edge, and after ${M - 1} it wraps back to 0, so it only ever holds 0 to ${M - 1}. After n edges from a start value s the count is (s + n) with all the complete trips around removed: the remainder when dividing by ${M}.`,
      count(`Start plus edges, ignoring the wrapping for now:`, `${s} + ${n}`, s + n),
      count(`Take the remainder after dividing by ${M} (the wraps disappear):`, `${s + n} mod ${M}`, (s + n) % M));
  },
  (r, d) => {
    const w = tier(d, 4, 4, 8), init = between(r, 0, 2 ** w - 1), ins = bits(r, tier(d, 2, 3, 5));
    let v = init;
    const trace: number[] = [];
    for (const b of ins) { v = ((v << 1) | +b) & (2 ** w - 1); trace.push(v); }
    return walk(ask(`A ${w}-bit shift register shifts left each clock, taking a new bit into bit 0. It starts at ${init.toString(2).padStart(w, '0')} and receives ${ins.split('').join(', ')} (first to last). Final contents (binary)?`, bin(v, w), `Each clock: shift left, drop the MSB, insert the new bit: ${v.toString(2).padStart(w, '0')}.`, 'Shift once per input bit.'),
      'shift registers', 'On each clock a shift register moves every bit one place to the left: the top bit falls off the end, every other bit moves up, and the new input bit enters at the bottom (bit 0). Do this once per clock, in the order the bits arrive.',
      ...ins.split('').map((b, i) => step(`Clock ${i + 1}: shift left and bring in ${b}. Contents:`, bin(trace[i], w))));
  },
  (r, d) => {
    const s0 = between(r, 1, 15), k = between(r, 1, tier(d, 2, 4, 8));
    let s = s0;
    const trace: { nb: number; s: number }[] = [];
    for (let i = 0; i < k; i++) { const nb = ((s >> 3) ^ (s >> 2)) & 1; s = ((s << 1) | nb) & 0xf; trace.push({ nb, s }); }
    return walk(ask(`A 4-bit Fibonacci LFSR: each clock, new_bit = s[3] ^ s[2], then s = {s[2:0], new_bit}. From ${s0.toString(2).padStart(4, '0')}, what is the state after ${k} clock${k > 1 ? 's' : ''}? (binary)`, bin(s, 4), `Step by step gives ${s.toString(2).padStart(4, '0')}. With taps x⁴ + x³ + 1 it cycles through all 15 nonzero states: the cheapest pseudo-random generator in hardware (BIST, scramblers, CRC).`, 'Compute new_bit from the top two bits, then shift left.'),
      'stepping an LFSR', 'An LFSR (linear-feedback shift register) is a shift register whose incoming bit is the XOR of a few of its own bits (the taps). Each clock: compute the feedback bit from the taps, shift everything left (dropping the top bit), and put the feedback bit in at the bottom. It steps through a long pseudo-random sequence using almost no logic.',
      ...trace.flatMap((t, i) => [
        count(`Clock ${i + 1}: new_bit = s[3] XOR s[2] of the current state (${(i === 0 ? s0 : trace[i - 1].s).toString(2).padStart(4, '0')}):`, 's[3] ^ s[2]', t.nb),
        step('Shift left and insert it. State now:', bin(t.s, 4)),
      ]));
  },
  (r, d) => {
    const tcq = pick(r, [30, 50, 80]), tl = pick(r, [200, 400, 700]), ts = pick(r, [20, 40, 60]);
    if (d < 3) {
      const T = tcq + tl + ts;
      return walk(ask(`t_clk→q = ${tcq} ps, worst logic delay = ${tl} ps, setup = ${ts} ps. Maximum clock frequency, in GHz?`, qty(1000 / T, 'GHz', 0.02, sig(1000 / T)), `T_min = ${tcq} + ${tl} + ${ts} = ${T} ps → f_max = ${sig(1000 / T)} GHz.`, 'f_max = 1 / (t_cq + t_logic + t_setup).'),
        'maximum clock frequency', 'Between two flops, data has to travel: it leaves the first flop (clock-to-q), goes through the logic, and must arrive at the next flop a setup time BEFORE the next edge. So the clock period has to be at least the sum of those three delays. The maximum frequency is 1 divided by that period; with the period in picoseconds, 1000/T gives GHz.',
        calc('Minimum period, clock-to-q + logic + setup:', `${tcq} + ${tl} + ${ts}`, T, 'ps', String(T), 0.001),
        calc('Frequency in GHz = 1000 / period (ps):', `1000 / ${T}`, 1000 / T, 'GHz', sig(1000 / T), 0.02));
    }
    const tmin = pick(r, [5, 15, 40]), th = pick(r, [30, 50, 70]), skew = pick(r, [0, 20, 40]);
    const slack = tcq + tmin - th - skew;
    return walk(ask(`Hold check: t_clk→q = ${tcq} ps, shortest logic path = ${tmin} ps, hold = ${th} ps, and the capture clock arrives ${skew} ps late. Hold slack, in ps (negative = violation)?`, qty(slack, 'ps', 0.01, String(slack)), `slack = t_cq + t_min - t_hold - skew = ${slack} ps. ${slack < 0 ? 'Violated: insert delay buffers on the short path. Hold violations cannot be fixed by slowing the clock!' : 'Met.'}`, 'New data must not arrive before the hold window closes.'),
      'hold slack', 'Hold is the opposite worry to setup: the capturing flop needs its input to stay steady for a short time AFTER the same clock edge. The new data launched by that very edge must not race through and arrive too soon. Earliest arrival = clock-to-q + the SHORTEST logic path. It must be later than hold time + any extra delay of the capture clock (skew). The margin is the hold slack.',
      calc('Earliest the new data can arrive, clock-to-q + shortest path:', `${tcq} + ${tmin}`, tcq + tmin, 'ps', String(tcq + tmin), 0.001),
      calc('What it must beat, hold time + clock skew:', `${th} + ${skew}`, th + skew, 'ps', String(th + skew), 0.001),
      calc('Hold slack = earliest arrival minus that:', `${tcq + tmin} - ${th + skew}`, slack, 'ps', String(slack), 0.01));
  },
  (r, d) => concept(r, tier(d, Q_SEQ1, Q_SEQ2, Q_SEQ3), (why) => `${why}.`),
  (r, d) => {
    const n = pick(r, tier(d, [10, 60, 100], [1000, 1e6], [48e6, 1e9, 2e9, 3e8, 5e7, 24e6, 125e6, 1e10]));
    const k = Math.ceil(Math.log2(n));
    return walk(ask(`${d === 3 ? `A timer counts ${n.toLocaleString('en-US')} cycles of a clock and then fires.` : `A counter must count from 0 to ${n - 1}.`} How many flip-flops does it need at minimum?`, num(k), `ceil(log2 ${n}) = ${k}${d === 3 ? ` (2^${k} = ${(2 ** k).toLocaleString('en-US')} ≥ ${n.toLocaleString('en-US')})` : ''}.`, 'Smallest k with 2^k ≥ n.'),
      'how many flops to count', `Each flip-flop stores one bit, and k bits can tell 2^k different values apart. A counter that must reach ${n} different values therefore needs the smallest k with 2^k at least ${n}: that is log2 of ${n}, rounded UP.`,
      calc(`log2 of ${n}:`, `log2(${n})`, Math.log2(n), '', sig(Math.log2(n), 5), 0.002),
      count('Round up to a whole number of flops:', `ceil(${sig(Math.log2(n), 5)})`, k));
  },
]);

// ------------------------------------------------------------------ FSMs

const Q_FSM: ConceptQ[] = [
  ['Moore vs Mealy: which reacts to an input in the same cycle?', 'Mealy, at the risk of glitches and long paths', ['Moore, because its outputs are looked up from the state', 'Both of them equally, since both read the inputs directly', 'Neither one, because both need a clock edge to react first'], 'Moore versus Mealy', 'In a Moore machine the output depends only on the current STATE, so an input change shows up only after the next clock edge. In a Mealy machine the output also depends directly on the input, so it can react immediately, in the same cycle, but it can glitch and the input now has a long path to the output.', ['In a Moore machine the output depends on:', 'The current state only', ['The state and the input', 'The input only']], 'Mealy (outputs depend on inputs directly), at the risk of glitches and long combinational paths'],
  ['Why register FSM outputs in a high-speed design?', 'They are glitch-free and cut the path to the next block', ['It saves flops, since the state register can be shared with them', 'It turns the FSM into a Mealy machine, which is faster', 'It removes the need for a reset on the state register'], 'registered outputs', 'Outputs coming straight from next-state logic can glitch and they arrive late in the cycle, eating the time budget of the block that uses them. Passing them through a flop makes them clean and gives the next block a full cycle to work with.', ['A flop on an output gives it:', 'A clean value at the start of the cycle', ['A glitch', 'A random value']], 'Registered outputs are glitch-free and cut the timing path to the next block'],
  ['What should an FSM do if it ever lands in an unused state (e.g. after a radiation upset)?', 'Recover to a safe state, with a default branch to IDLE', ['Stay there forever, so that the fault can be seen later', 'Do nothing, since unused states can never be reached in practice', 'Stop the clock, until a technician resets the whole machine'], 'illegal states', 'An FSM with 5 states in 3 bits has 3 unused encodings. A stray particle or glitch can flip a bit and put the machine in one. If nothing is defined there it could hang forever, so designs add a default branch that sends every unused state back to a safe one.', ['With 5 states in 3 flops, how many encodings are unused?', '3', ['0', '5']], 'Recover to a safe state (a default branch to IDLE); safety-critical flows expect it, and synthesis must be told to keep it (safe-FSM options)'],
  ['Why do FPGAs favour one-hot encoding?', 'Flops are plentiful and next-state logic is tiny per state', ['It uses the fewest flops of any state encoding that exists', 'It is the only encoding that FPGA tools are able to map', 'It removes the need for a clock on the state register'], 'one-hot encoding', 'One-hot uses one flop per state with exactly one of them set. It uses MORE flops than binary, but next-state and output logic shrink to a gate or two per state, which is fast. FPGAs have lots of flops already built in, so the trade is good.', ['One-hot encoding uses how many flops for n states?', 'n, one per state', ['log2(n)', '2']], 'Flops are plentiful and next-state logic becomes a few gates per state, so it is fast'],
      ['What does a one-hot FSM encoding use?', 'One flop per state, and exactly one of them is high', ['A binary number that counts the states', 'Two flops for any machine, whatever its size', 'The Gray code of the state number'],
        'state encodings', 'One-hot spends a flop per state but makes next-state logic tiny: each state is set by a few gates. Binary uses the fewest flops but needs wider decode logic.',
        ['One-hot with 8 states uses:', '8 flops', ['3 flops', '1 flop']]],
      ['When does a Mealy output change?', 'As soon as an input changes, even between clock edges', ['Only when the clock edge arrives', 'Only when the machine goes back to IDLE', 'Only when the reset is asserted again'],
        'Mealy outputs', 'A Mealy output is a function of state and input, so a changing input moves it at once. A Moore output depends only on state, so it moves only after a clock edge.',
        ['A Moore output depends on:', 'State only', ['Input only', 'Neither']]],
];

export const fsmPractice = practice('practice-fsm', 'State Machine Drills', 'encodings, sequence detectors, transition tables', [
  (r, d) => {
    const n = pick(r, tier(d, [4, 5, 8], [6, 12, 17], [33, 20, 9]));
    const enc = pick(r, ['binary', 'one-hot', 'Gray']);
    const f = enc === 'one-hot' ? n : Math.ceil(Math.log2(n));
    const q = ask(`An FSM has ${n} states. How many flip-flops with ${enc} encoding?`, num(f), `${enc === 'one-hot' ? `One flop per state: ${n}. More flops, but next-state logic is tiny and fast (and FPGAs have flops to spare).` : `ceil(log2 ${n}) = ${f}. ${enc === 'Gray' ? 'Gray also changes one bit per transition along a sequence, reducing glitches and power.' : 'Fewest flops.'}`}`, enc === 'one-hot' ? 'One-hot: one flop per state.' : 'log2 of the state count, rounded up.');
    if (enc === 'one-hot') return walk(q, 'one-hot state encoding', 'One-hot encoding gives every state its own flip-flop, and exactly one of them is 1 at a time. The number of flops is simply the number of states.',
      count('One flop per state, so for this many states:', `${n} states`, f));
    return walk(q, `${enc} state encoding`, `${enc === 'Gray' ? 'Gray-coded states are numbered like Gray code (one bit changes between consecutive codes in the sequence) but' : 'Binary-coded states are numbered 0, 1, 2… and'} k flops can hold 2^k different codes. So the number of flops is the smallest k with 2^k at least the number of states: log2 of the state count, rounded up.`,
      calc(`log2 of ${n}:`, `log2(${n})`, Math.log2(n), '', sig(Math.log2(n), 4), 0.005),
      count('Round up to whole flops:', `ceil(${sig(Math.log2(n), 4)})`, f));
  },
  (r, d) => {
    const pat = bits(r, tier(d, 2, 3, 4)).replace(/^0*$/, '101');
    const s = bits(r, tier(d, 10, 14, 20));
    const n = matches(s, pat);
    return walk(ask(`A detector fires each time the last ${pat.length} input bits are ${pat} (overlapping matches count). Input stream (first to last): ${s}. How many times does it fire?`, num(n), `Slide a ${pat.length}-bit window along the stream: ${n} match${n === 1 ? '' : 'es'}. The FSM must keep the longest suffix that is still a prefix of ${pat}, which is what makes overlap work.`, 'Check every position, including overlapping ones.'),
      'sequence detection', `A sequence detector fires every time the most recent ${pat.length} bits equal the pattern. Overlaps count: in 10101 the pattern 101 appears twice, sharing a bit. To count by hand, slide a window of ${pat.length} bits along the stream one position at a time and compare it to ${pat}.`,
      count(`The stream has ${s.length} bits, so it has this many windows of ${pat.length}:`, `${s.length} - ${pat.length} + 1`, s.length - pat.length + 1),
      ...sim(Array.from({ length: s.length - pat.length + 1 }, (_, i) => { const w = s.slice(i, i + pat.length); return { beats: [choice(`Window ${i} is ${w}. Does it equal ${pat}?`, w === pat ? 'Yes: a match' : 'No', [w === pat ? 'No' : 'Yes: a match'])], row: `${String(i).padStart(2)}: ${w}${w === pat ? '  <- match' : ''}` }; }), 3, `every window compared with ${pat}`),
      count('How many windows match?', 'number of "match" lines', n));
  },
  (r, d) => {
    const L = between(r, 3, tier(d, 4, 6, 8));
    const moore = pick(r, [true, false]);
    return walk(ask(`Minimum number of states for a ${moore ? 'Moore' : 'Mealy'} FSM that detects one specific ${L}-bit pattern (overlap allowed)?`, num(moore ? L + 1 : L), moore ? `Moore needs a state for "matched 0, 1, … ${L} bits" = ${L + 1} states, because the output belongs to a state.` : `Mealy outputs on the transition, so it needs states for "matched 0 … ${L - 1} bits" = ${L}.`, 'Count how many "progress" states the matcher needs.'),
      'counting detector states', 'A pattern detector\'s states record how much of the pattern has been matched so far: 0 bits, 1 bit, 2 bits, and so on. A Moore machine\'s output depends only on the state, so it needs one extra state meaning "the whole pattern was just matched". A Mealy machine\'s output can depend on the input, so the final match happens on a transition and needs no extra state.',
      choice('Does this machine need the extra "fully matched" state?', moore ? 'Yes: Moore puts its output in a state' : 'No: Mealy signals the match on a transition', [moore ? 'No: Mealy signals the match on a transition' : 'Yes: Moore puts its output in a state']),
      count(moore ? `States for matching 0 to ${L - 1} bits, plus the matched state:` : `States for having matched 0 to ${L - 1} bits:`, moore ? `${L} + 1` : `${L}`, moore ? L + 1 : L));
  },
  (r, d) => {
    const S = ['IDLE', 'REQ', 'BUSY', 'DONE'];
    const t: Record<string, [string, string]> = {};
    for (const s of S) t[s] = [pick(r, S), pick(r, S)];
    t.IDLE = ['IDLE', 'REQ'];
    const ins = bits(r, tier(d, 3, 5, 8));
    let st = 'IDLE';
    const trace: string[] = [];
    for (const b of ins) { st = t[st][+b]; trace.push(st); }
    return walk(ask(`Transition table (next state for in = 0 / in = 1):${code(S.map((s) => `${s.padEnd(5)}  ${t[s][0].padEnd(5)} / ${t[s][1]}`).join('\n'))}Starting in IDLE, the inputs are ${ins.split('').join(', ')}. Final state?`, exact(st, st.toLowerCase()), `Follow the table one input per clock: ends in ${st}.`, 'One row lookup per input bit.'),
      'following a transition table', 'A transition table lists, for every state, the next state for each input value. To run the machine: start in the given state, and for each input bit look up the row of the CURRENT state and pick the column for that bit (the left entry for 0, the right for 1). The result is the new current state. Repeat for every input.',
      ...ins.split('').map((b, i) => step(`${i === 0 ? 'IDLE' : trace[i - 1]}, input ${b}: next state?`, exact(trace[i], trace[i].toLowerCase()))));
  },
  (r) => concept(r, Q_FSM, (why) => `${why}.`),
]);

// ------------------------------------------------------------------ Verilog

/** Verilog bug spotting: [code, what is wrong, method, idea, [step question, right, wrong]]. */
const V_BUGS = [
  ['always @(*) begin\n  if (sel) y = a;\nend', 'Incomplete assignment: y is not assigned when sel = 0, so synthesis infers a latch', 'unintended latches', 'Hardware that is purely combinational must give y a value for EVERY input combination. If some path through the always block does not assign y, the synthesizer concludes "y must remember its old value" and builds a latch. Give every branch an assignment (or a default at the top).', ['What is y when sel = 0?', 'Not assigned: it keeps the old value, which needs a latch', ['0', 'a']]],
  ['always @(a) y = a & b;', 'Incomplete sensitivity list: simulation ignores changes on b, but synthesis builds an AND gate (mismatch)', 'sensitivity lists', 'A plain always @(a) block only re-runs when a changes. Synthesis ignores the list and builds the logic from the code, so the hardware (an AND gate of a and b) reacts to b but the simulation does not: they disagree. Use always @(*) to list everything read.', ['When b changes (a does not), does the simulation re-run the block?', 'No: the list only mentions a', ['Yes, always', 'Only at time 0']]],
  ['always @(posedge clk) begin\n  q1 = d;\n  q2 = q1;\nend', 'Blocking assignments in a clocked block: q2 gets the new d, collapsing two flops into one', 'blocking versus non-blocking', 'Inside a clocked block, use non-blocking (<=) for registers. A blocking assignment (=) takes effect immediately, so the next line already sees the NEW value: q2 = q1 picks up d directly and the two flops behave as one.', ['With blocking assignments, what does q2 = q1 read?', 'The new q1, which was just set to d', ['The old q1', 'Zero']]],
  ['wire [7:0] sum;\nassign sum = a + b;  // a, b are [7:0]', 'The carry-out is lost: an 8-bit sum of two 8-bit values needs 9 bits', 'width of a sum', 'Adding two N-bit numbers can produce an (N+1)-bit result. If the destination is only N bits, the top bit, the carry-out, is silently dropped. Make the destination one bit wider, for example a 9-bit sum.', ['The largest 8-bit value is 255. 255 + 255 is:', '510, which needs 9 bits', ['255, which fits', '256, which fits']]],
  ['assign y = a;\nassign y = b;', 'Multiple drivers on y: contention, x in simulation', 'multiple drivers', 'A wire can only be driven by one source at a time. Two continuous assignments to y fight each other: if they disagree, the simulator shows x (unknown), and real hardware would short two outputs together.', ['When a = 1 and b = 0 both drive y, the result is:', 'x: the drivers conflict', ['1', '0']]],
  ['case (op)\n  2\'b00: y = a;\n  2\'b01: y = b;\nendcase  // inside always_comb', 'Missing default: op = 2 or 3 leaves y unassigned, inferring a latch', 'complete case statements', 'A 2-bit op has four possible values. This case covers only two of them. For op = 2 or 3 the output is not assigned, so a latch is inferred. A default branch assigns it in every remaining case.', ['How many values can a 2-bit op take, and how many does the case cover?', '4 values, 2 covered', ['2 values, 2 covered', '4 values, 4 covered']]],
] as const;

// SystemVerilog-first RTL style (U11).
const SV_STYLE: readonly ConceptQ[] = [
  ['Which block makes the tool complain if you accidentally infer a latch?', 'always_comb', ['always_ff', 'initial', 'always @(a)'], 'latch checking in always_comb', 'always_comb works out its own sensitivity list and expects every output to be assigned on every path. If one is not, lint and synthesis warn that a latch would be inferred. A plain always @(*) builds the same hardware but says nothing.', ['An output is assigned only inside an if with no else. In always_comb the tool will:', 'warn that a latch is inferred', ['stay silent, as it is fine', 'insert a flop']]],
  ['What does `always_ff` add over `always @(posedge clk)`?', 'Tools check that it describes only flops', ['It makes the flops run on both clock edges', 'It lets you mix blocking and non-blocking safely', 'It adds a reset to every register'], 'always_ff', 'always_ff is a promise: this block is sequential logic and nothing else. If the body would build a latch or combinational logic, the tool says so instead of quietly accepting it. The hardware for a correct block is the same.', ['You write always_ff @(posedge clk) and assign a latch-like value. The tool:', 'reports the mismatch', ['accepts it quietly', 'adds a clock for you']]],
  ['What does `unique case` promise the tools?', 'No two arms can match at once', ['The first matching arm wins', 'The case has a default branch', 'The select is a single bit'], 'unique case', 'unique case says the arms are mutually exclusive and one of them always matches. Simulation can warn when two match or none does, and synthesis may drop the priority logic. priority case instead says the first match wins and that at least one arm matches.', ['A unique case has overlapping arms and the select matches both. A simulator will:', 'warn about the violation', ['pick the last arm silently', 'stop the clock']]],
  ['In `priority case`, what happens when two arms match?', 'The first one listed wins', ['The last one listed wins', 'Both run, in order', 'The tool reports an error'], 'priority case', 'priority case keeps the written order: the first matching arm is taken. It also promises that some arm matches, so a missing default is not a latch warning. It builds a priority chain, so it costs more logic than unique case.', ['Which costs more logic, a priority case or a unique case with the same arms?', 'priority case, for the ordered chain', ['unique case, for the overlap checks', 'They are always identical']]],
  ['`typedef enum logic [1:0] { A, B, C } s_t;` What is the value of C?', '2', ['3', '1', '0'], 'enum numbering', 'Enum names count up from 0 unless you give a value: A is 0, B is 1, C is 2. The logic [1:0] base type fixes the width at 2 bits, so up to four names fit.', ['With no explicit values, the first name in an enum is:', '0', ['1', 'x']]],
  ['How many bits does the base type need to name 5 FSM states in binary?', '3', ['2', '4', '5'], 'bits for an enum', 'N names need ceil(log2 N) bits in a binary encoding: 5 names need 3 bits, because 2 bits only give 4 codes. One-hot would need one bit per state instead.', ['How many codes do 2 bits give?', '4', ['2', '8']]],
  ['An old file says `reg [3:0] q; always @(*) q = a + b;`. The SystemVerilog equivalent is:', '`logic [3:0] q; always_comb q = a + b;`', ['`wire [3:0] q; always_ff q = a + b;`', '`logic [3:0] q; always_ff q <= a + b;`', '`reg [3:0] q; assign q <= a + b;`'], 'reading older Verilog', 'reg/wire and always @(*) mean the same as logic and always_comb. The new names add checking, not new hardware. Combinational logic keeps the blocking = and no clock.', ['The old always @(*) block maps to:', 'always_comb', ['always_ff', 'initial']]],
] as const;

export const verilogPractice = practice('practice-verilog', 'Verilog Drills', 'widths, literals, blocking vs non-blocking, 4-state logic, bug spotting', [
  (r, d) => {
    const a = between(r, 2, 8), b = between(r, 1, 8), k = between(r, 2, 4);
    const variants = [
      [1, `wire [${a - 1}:0] a;\n... {${k}{a}}`, k * a],
      [2, `wire [${a - 1}:0] a; wire [${b - 1}:0] b;\n... {a, b, 2'b01}`, a + b + 2],
      [3, `wire [${a - 1}:0] a; wire [${b - 1}:0] b;\n... {${k}{a[0]}, b, {2{a}}}`, k + b + 2 * a],
    ] as const;
    const [, src, v] = pick(r, variants.filter((x) => x[0] === d));
    const q = ask(`What is the width, in bits, of the expression:${code(src)}`, num(v), `Concatenation adds widths; {k{x}} repeats x k times: ${v} bits.`, 'Add up each part.');
    const idea = 'A vector declared [h:0] has h + 1 bits. Concatenation { , } glues its parts side by side, so the total width is the sum of the widths. A replication {k{x}} repeats x k times, so it is k times the width of x. A sized literal like 2\'b01 has exactly the size in front of the apostrophe.';
    if (d === 1) return walk(q, 'widths of a replication', idea,
      count(`a is [${a - 1}:0], so its width is:`, `${a - 1} + 1`, a),
      count(`{${k}{a}} repeats a ${k} times:`, `${k} × ${a}`, v));
    if (d === 2) return walk(q, 'widths of a concatenation', idea,
      count(`a is [${a - 1}:0]. Width:`, `${a - 1} + 1`, a),
      count(`b is [${b - 1}:0]. Width:`, `${b - 1} + 1`, b),
      count('2\'b01 is a 2-bit literal. Width:', '2', 2),
      count('Total width:', `${a} + ${b} + 2`, v));
    return walk(q, 'widths of nested concatenations', idea,
      count(`{${k}{a[0]}}: a[0] is one bit, repeated ${k} times:`, `${k} × 1`, k),
      count(`b is [${b - 1}:0]. Width:`, `${b - 1} + 1`, b),
      count(`{2{a}}: a is ${a} bits, repeated twice:`, `2 × ${a}`, 2 * a),
      count('Total width:', `${k} + ${b} + ${2 * a}`, v));
  },
  (r, d) => {
    const x = between(r, 0, 255), y = between(r, 0, 15), s = between(r, 1, 3);
    const z = (15 - y + s) & 15;
    const variants = [
      [1, `8'h${x.toString(16).toUpperCase()} >> ${s}`, x >> s, 8],
      [2, `4'b${y.toString(2).padStart(4, '0')} + 4'b${z.toString(2).padStart(4, '0')}`, (y + z) & 15, 4],
      [3, `~8'h${x.toString(16).toUpperCase()} & 8'hF0`, ~x & 0xf0, 8],
    ] as const;
    const [, e, v, w] = pick(r, variants.filter((q) => q[0] === d));
    const q = ask(`In a ${w}-bit context, what is ${e}? (hex)`, hexa(v, w / 4), `${e} = ${hex(v, w / 4)}. Results are truncated to the context width: ${w === 4 ? 'the carry out of bit 3 is lost.' : 'always know your widths.'}`, 'Work in binary and keep only the context width.');
    if (d === 1) return walk(q, 'shifting a vector', '>> n shifts the bits right by n places: the lowest n bits fall off, and zeros enter at the top (for an unsigned value). Convert the hex to binary first, four bits per hex digit, then shift, then convert back.',
      step('Write it in binary (8 bits):', bin(x, 8)),
      step(`Shift right by ${s}, filling with zeros at the left:`, bin(v, 8)),
      step('Back to hex:', hexa(v, 2)));
    if (d === 2) return walk(q, 'fixed-width addition', 'In a 4-bit context the result keeps only 4 bits: if the true sum is 16 or more, the carry out of bit 3 is thrown away, which is the same as subtracting 16. Add the two values, then keep the low 4 bits.',
      count(`The two values in decimal, added (${y} + ${z}):`, `${y} + ${z}`, y + z),
      count('Keep only 4 bits (the remainder after dividing by 16):', `${y + z} mod 16`, v),
      step('As a hex digit:', hexa(v, 1)));
    return walk(q, 'bitwise NOT and masking', '~ flips every bit of the vector (0 becomes 1 and 1 becomes 0), keeping the width. & with a mask like F0 keeps only the bits where the mask has a 1 and forces the others to 0. Work in binary: one hex digit is four bits.',
      step('x in binary (8 bits):', bin(x, 8)),
      step('~x: flip every bit:', bin(~x & 255, 8)),
      step('AND with 8\'hF0 = 11110000 (keeps only the top four bits):', bin(v, 8)),
      step('In hex:', hexa(v, 2)));
  },
  (r, d) => {
    const a = between(r, 0, 9), b = between(r, 0, 9), c = between(r, 0, 9);
    const blocking = pick(r, [true, false]);
    const n = tier(d, 1, 1, 2);
    let [A, B, C] = [a, b, c];
    const trace: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      if (blocking) { B = A; C = B; } else { const nb = A, nc = B; B = nb; C = nc; }
      trace.push([B, C]);
    }
    return walk(ask(`${code(`always @(posedge clk) begin\n  b ${blocking ? '=' : '<='} a;\n  c ${blocking ? '=' : '<='} b;\nend`)}Before the edge a = ${a}, b = ${b}, c = ${c}, and a stays ${a}. What is c after ${n} clock edge${n > 1 ? 's' : ''}?`, num(C), blocking ? `Blocking (=) updates immediately, so c gets the NEW b, which is a: c = ${C}. The two flops collapse into one: a classic bug.` : `Non-blocking (<=) samples all right-hand sides first, then updates: c gets the OLD b. ${n > 1 ? `After two edges the value of a has moved through both flops: c = ${C}.` : `c = ${C}.`} That is a real two-stage shift register.`, blocking ? 'Blocking assignments happen in order.' : 'Non-blocking: every right-hand side uses the values from before the edge.'),
      blocking ? 'blocking assignments' : 'non-blocking assignments', blocking ? 'A blocking assignment (=) takes effect at once, and the next line sees the new value. So in this block, b becomes a first, and then c = b copies that NEW b. Both registers end up holding a.' : 'A non-blocking assignment (<=) works in two phases: first every right-hand side is read using the values from BEFORE the clock edge, then all the left-hand sides are updated together. So each register takes the OLD value of the one before it: a real shift register.',
      ...trace.flatMap(([bb, cc], i) => [
        count(`Edge ${i + 1}: b becomes:`, blocking ? 'a' : `a (${a})`, bb),
        count(blocking ? `c = b uses the NEW b (just assigned). c becomes:` : `c <= b uses the OLD b, from before the edge. c becomes:`, blocking ? 'new b' : 'old b', cc),
      ]));
  },
  (r, d) => {
    const v = between(r, 1, 255);
    const ones = v.toString(2).split('').filter((c) => c === '1').length;
    const bv = v.toString(2).padStart(8, '0');
    const H = v.toString(16).toUpperCase();
    const idea4 = 'Verilog has four values: 0, 1, x (unknown) and z. An unknown input makes the output unknown UNLESS the other inputs already settle it: AND with a 0 is always 0 and OR with a 1 is always 1, whatever x is.';
    const variants = [
      [1, `&8'h${H}`, v === 255 ? 1 : 0, 'AND-reduce is 1 only if every bit is 1.', 'reduction AND', 'A reduction operator folds all the bits of a vector into one bit with the same gate. &x is the AND of every bit: it is 1 only when every bit is 1.', [step('Write the value in binary:', bin(v, 8)), count('Are all eight bits 1? (1 for yes, 0 for no)', '&x', v === 255 ? 1 : 0)]],
      [1, `|8'h${H}`, 1, 'OR-reduce is 1 if any bit is 1.', 'reduction OR', 'A reduction operator folds all the bits of a vector into one bit with the same gate. |x is the OR of every bit: it is 1 when at least one bit is 1.', [step('Write the value in binary:', bin(v, 8)), count('Is at least one bit 1? (1 for yes, 0 for no)', '|x', 1)]],
      [2, `^8'h${H}`, ones % 2, `XOR-reduce is the parity: ${ones} ones → ${ones % 2}.`, 'reduction XOR (parity)', 'A reduction operator folds all the bits of a vector into one bit with the same gate. ^x is the XOR of every bit, which is 1 exactly when the number of 1 bits is odd: the parity.', [step('Write the value in binary:', bin(v, 8)), count('How many of the bits are 1?', `ones in ${bv}`, ones), count('Odd count gives 1, even gives 0. The result:', `${ones} mod 2`, ones % 2)]],
      [3, `(1'bx & 1'b0) | (1'bx & 1'b1 & 1'b0)`, 0, 'x & 0 = 0 in 4-state logic, so both terms are 0.', 'x in 4-state logic', 'Verilog has four values: 0, 1, x (unknown) and z. An unknown input makes the output unknown UNLESS the other inputs already settle it: AND with a 0 is always 0 and OR with a 1 is always 1, whatever x is.', [choice('x AND 0 is:', '0: a 0 forces an AND to 0', ['x', '1']), choice('x AND 1 AND 0 is:', '0: the 0 settles it', ['x', '1']), count('OR of the two terms (0 | 0):', '0 | 0', 0)]],
      [3, `1'bx | 1'b1`, 1, 'x | 1 = 1: whatever x is, the OR is 1.', 'x in 4-state logic', 'Verilog has four values: 0, 1, x (unknown) and z. An unknown input makes the output unknown UNLESS the other inputs already settle it: AND with a 0 is always 0 and OR with a 1 is always 1, whatever x is.', [choice('x OR 1 is:', '1: a 1 forces an OR to 1', ['x', '0']), count('The result:', "1'bx | 1'b1", 1)]],
      [3, `1'b0 & 1'bz`, 0, 'z & 0 = 0: a 0 settles an AND, whatever z is.', 'x in 4-state logic', idea4, [choice('z AND 0 is:', '0: a 0 forces an AND to 0', ['x', '1']), count('The result:', "1'b0 & 1'bz", 0)]],
      [3, `1'b1 | 1'bz`, 1, 'z | 1 = 1: a 1 settles an OR, whatever z is.', 'x in 4-state logic', idea4, [choice('z OR 1 is:', '1: a 1 forces an OR to 1', ['x', '0']), count('The result:', "1'b1 | 1'bz", 1)]],
      [3, `(1'bx | 1'b1) & 1'b1`, 1, 'x | 1 = 1, then 1 & 1 = 1.', 'x in 4-state logic', idea4, [choice('x OR 1 is:', '1: a 1 forces an OR to 1', ['x', '0']), count('Then 1 AND 1:', '1 & 1', 1)]],
      [3, `~(1'bx | 1'b1)`, 0, 'x | 1 = 1, and the inverse of 1 is 0.', 'x in 4-state logic', idea4, [choice('x OR 1 is:', '1: a 1 forces an OR to 1', ['x', '0']), count('The inverse of that:', '~1', 0)]],
      [3, `(1'bx & 1'b0) | 1'b1`, 1, 'x & 0 = 0, and 0 | 1 = 1.', 'x in 4-state logic', idea4, [choice('x AND 0 is:', '0: a 0 forces an AND to 0', ['x', '1']), count('Then 0 OR 1:', '0 | 1', 1)]],
      [3, `1'bz & 1'b0 & 1'b1`, 0, 'z & 0 & 1 = 0: the 0 settles the AND.', 'x in 4-state logic', idea4, [choice('z AND 0 is:', '0: a 0 forces an AND to 0', ['x', '1']), count('The result:', "1'bz & 1'b0 & 1'b1", 0)]],
    ] as const;
    const [, e, val, why, method, idea, beats] = pick(r, variants.filter((q) => q[0] === d));
    return walk(ask(`What does ${e} evaluate to? (0 or 1)`, num(val), why, 'Reduction operators fold every bit with the same gate.'), method, idea, ...beats);
  },
  (r) => {
    const i = between(r, 0, V_BUGS.length - 1);
    const others = shuffle(r, V_BUGS.filter((_, j) => j !== i).map((b) => b[1])).slice(0, 3);
    const [src, bug, method, idea, [sq, sr, sw]] = V_BUGS[i];
    return walk(mcs(r, `What is wrong with this Verilog?${code(src)}`, bug, others, `${bug}. Lint tools flag all of these; learn to see them yourself in reviews.`), method, idea, choice(sq, sr, sw));
  },
  (r, d) => {
    const n = between(r, 2, 8), m = between(r, 2, 4);
    if (d < 3) return walk(ask(`${code(`genvar i;\ngenerate for (i = 0; i < ${n}; i = i + 1) begin : g\n  dff u (.clk(clk), .d(d[i]), .q(q[i]));\nend endgenerate`)}How many dff instances are created?`, num(n), `One per loop iteration: ${n}, named g[0].u … g[${n - 1}].u.`, 'Count the iterations.'),
      'generate loops', 'A generate for-loop is unrolled at elaboration time: the code inside is copied once for every value of the loop variable, before simulation or synthesis begins. So the number of instances is the number of times the loop body runs.',
      count(`i runs 0, 1, 2 … while i < ${n}. Iterations:`, `${n} - 0`, n));
    return walk(ask(`${code(`module fifo #(parameter DEPTH = 8, parameter WIDTH = 32) (...);\n  reg [WIDTH-1:0] mem [0:DEPTH-1];\nendmodule\n\nfifo #(.DEPTH(${2 ** m}), .WIDTH(${n * 8})) u_fifo (...);`)}How many storage bits does u_fifo's mem hold?`, num(2 ** m * n * 8), `DEPTH × WIDTH = ${2 ** m} × ${n * 8} = ${2 ** m * n * 8} bits. Parameter overrides replace the defaults per instance.`, 'Use the overridden parameters.'),
      'parameter overrides', 'A parameter is a constant with a default value that each instance can override with #( .NAME(value) ). The defaults in the module header (8 and 32 here) only apply when the instance does not override them. The memory holds DEPTH words, each WIDTH bits wide.',
      count('DEPTH in this instance (the override, not the default 8):', 'DEPTH', 2 ** m),
      count('WIDTH in this instance (the override, not the default 32):', 'WIDTH', n * 8),
      count('Storage bits = DEPTH × WIDTH:', `${2 ** m} × ${n * 8}`, 2 ** m * n * 8));
  },
  (r, d) => concept(r, d === 1 ? [SV_STYLE[0], SV_STYLE[1], SV_STYLE[6]] : SV_STYLE, (right) => `Correct: ${right}. The new keywords add checking, not new hardware.`),
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
    const op = sub ? '-' : '+';
    const common = 'An ALU sets flags that describe its result. Z (zero) is 1 if the result is 0. N (negative) is the top bit of the result. C (carry) means the UNSIGNED result did not fit in 8 bits (for a subtraction, ARM-style, C = 1 means no borrow was needed). V (overflow) means the SIGNED result did not fit in -128..127. So always compute the 8-bit result first, then decide the flag.';
    const flagBeat = flag === 'Z' ? choice('Is the 8-bit result exactly 0?', res === 0 ? 'Yes: Z = 1' : 'No: Z = 0', [res === 0 ? 'No: Z = 0' : 'Yes: Z = 1'])
      : flag === 'N' ? count(`The top bit of ${hex(res)} (1 if it is ${hex(128)} or more):`, `top bit of ${res.toString(2).padStart(8, '0')}`, res >> 7)
      : flag === 'C' ? (sub ? choice(`Is ${a} at least ${b}, so no borrow is needed?`, a >= b ? 'Yes: C = 1' : 'No: C = 0', [a >= b ? 'No: C = 0' : 'Yes: C = 1']) : choice(`Is the true sum ${a + b} above 255?`, a + b > 255 ? 'Yes: C = 1' : 'No: C = 0', [a + b > 255 ? 'No: C = 0' : 'Yes: C = 1']))
      : choice(`The signed result ${sa} ${op} ${sb} = ${tr}. Is it outside -128..127?`, V ? 'Yes: V = 1' : 'No: V = 0', [V ? 'No: V = 0' : 'Yes: V = 1']);
    return walk(ask(`8-bit ALU: ${hex(a)} ${op} ${hex(b)}. What is the ${flag} flag? (${flag === 'Z' ? 'zero' : flag === 'N' ? 'negative' : flag === 'C' ? sub ? 'carry, ARM-style: 1 means no borrow' : 'carry out' : 'signed overflow'})`, num(val), `Result ${hex(res)}. Z = ${res === 0 ? 1 : 0}, N = ${res >> 7}, C = ${C}, V = ${V} (signed: ${sa} ${op} ${sb} = ${tr}${V ? ', outside -128..127' : ''}). C is overflow for unsigned numbers; V is overflow for signed ones.`, flag === 'V' ? 'Interpret both as signed and check the true result fits.' : 'Compute the 8-bit result first.'),
      `the ${flag} flag`, common,
      step(`The 8-bit result of ${hex(a)} ${op} ${hex(b)} (hex):`, hexa(res, 2)),
      ...(flag === 'V' ? [count(`Reading both as signed 8-bit numbers (${hex(a)} is ${sa}, ${hex(b)} is ${sb}), the true result is:`, `${sa} ${op} ${sb}`, tr)] : []),
      flagBeat,
      count(`So the ${flag} flag is:`, flag, val));
  },
  (r, d) => {
    const x = between(r, 1, 255), k = between(r, 1, 7);
    const variants = [
      [1, `logical shift left by ${k} (8-bit)`, (x << k) & 255, 'logical shift left', 'A left shift moves every bit toward the top by k places, filling the vacated low bits with 0 and dropping bits that fall off the top. It multiplies by 2^k (as long as nothing falls off).'],
      [2, `rotate left by ${k} (8-bit)`, ((x << k) | (x >> (8 - k))) & 255, 'rotate left', 'A rotate is a shift in which the bits that fall off the top re-enter at the bottom, so nothing is lost. Rotating left by k: shift left by k, and put the k dropped top bits into the low k positions.'],
      [3, `arithmetic shift right by ${k} (8-bit signed)`, ((x >= 128 ? x - 256 : x) >> k) & 255, 'arithmetic shift right', 'An arithmetic right shift moves bits down by k places but copies the SIGN bit (the top bit) into the vacated positions, so a negative number stays negative: it divides a signed value by 2^k, rounding down.'],
    ] as const;
    const [, op, v, method, idea] = pick(r, variants.filter((q) => q[0] === d));
    const bx = x.toString(2).padStart(8, '0');
    return walk(ask(`${hex(x)}: ${op}. Result (hex)?`, hexa(v, 2), `${bx} → ${v.toString(2).padStart(8, '0')} = ${hex(v)}. A barrel shifter does any of these in one cycle with log2(8) = 3 mux levels.`, 'Work in binary.'),
      method, idea,
      step(`${hex(x)} in binary (8 bits):`, bin(x, 8)),
      step(`After the ${method === 'rotate left' ? 'rotate' : 'shift'} by ${k}, in binary:`, bin(v, 8)),
      step('In hex:', hexa(v, 2)));
  },
  (r, d) => {
    const n = pick(r, [8, 16, 32, 64, 12, 24, 48, 128]);
    const mult = 'Multiplying is adding shifted copies: for each bit of the multiplier that is 1, you add a copy of the multiplicand shifted into that bit\'s position. Each copy is a partial product, and all of them must be added. Fewer partial products means a smaller, faster adder tree. Booth recoding reads the multiplier two bits at a time to halve the count.';
    if (d === 1) return walk(ask(`A plain n×n array multiplier makes one partial product per multiplier bit. For ${n}×${n}, how many partial products?`, num(n), `${n}: one per bit of the multiplier, each an AND of the multiplicand with that bit.`, 'One per multiplier bit.'),
      'partial products', mult,
      count(`The multiplier has ${n} bits, and each bit gives one partial product:`, `${n} bits`, n));
    if (d === 2) return walk(ask(`With radix-4 Booth encoding, how many partial products does a ${n}×${n} signed multiplier need?`, num(n / 2), `Radix-4 Booth recodes pairs of bits into digits from {-2..2}: ${n}/2 = ${n / 2} partial products, halving the adder tree.`, 'Booth radix-4 handles two bits per digit.'),
      'Booth recoding', mult,
      count(`Radix-4 Booth turns each pair of multiplier bits into one digit. Pairs in ${n} bits:`, `${n} / 2`, n / 2));
    const rows = n / 2, lv = Math.ceil(Math.log(n / 4) / Math.log(1.5));
    return walk(ask(`A Wallace tree of 3:2 compressors reduces ${n / 2} Booth partial products to 2 rows. Each level cuts the row count by about 1.5×. How many levels (ceil(log1.5(rows/2)))?`, num(lv), `log1.5(${n / 2}/2) = ${sig(Math.log(n / 4) / Math.log(1.5))} → ${lv} levels, then one fast adder. O(log n), which is why multipliers are not n times slower than adders.`, 'Divide by 1.5 until 2 rows remain.'),
      'Wallace tree depth', 'A 3:2 compressor (a full adder) takes three rows of bits and turns them into two, so each level of the tree cuts the number of rows by about a factor 1.5 (3 in, 2 out). Starting from the partial-product rows, keep compressing until only 2 rows remain; then one ordinary fast adder finishes. The number of levels is how many times you must divide by 1.5: a logarithm base 1.5. (This is an approximation: real trees count compressor levels exactly, and the exact count can differ by one for some sizes.)',
      calc('The reduction factor needed, rows ÷ 2:', `${rows} / 2`, rows / 2, '', String(rows / 2), 0.001),
      calc('Levels = log base 1.5 of that, ln(x) / ln(1.5):', `ln(${rows / 2}) / ln(1.5)`, Math.log(rows / 2) / Math.log(1.5), '', sig(Math.log(rows / 2) / Math.log(1.5), 4), 0.005),
      count('Whole levels, so round up:', `ceil(${sig(Math.log(rows / 2) / Math.log(1.5), 4)})`, lv));
  },
  (r, d) => {
    const T = pick(r, [2000, 3000, 4000]), k = pick(r, tier(d, [2, 4], [5, 8], [10, 20])), ov = pick(r, [50, 80, 100]);
    const period = T / k + ov;
    const idea = 'Pipelining cuts a long block of logic into k shorter stages separated by flip-flops. The clock period must now fit only ONE stage (its share of the logic plus the flop overhead: clock-to-q and setup), so the clock can be faster and a new operation can start every cycle. But a single operation must now pass through all k stages, each a full clock period, so its latency does not improve.';
    if (d === 1) return walk(ask(`A ${T} ps combinational block is cut into ${k} equal pipeline stages, adding ${ov} ps of flop overhead per stage. New clock period, in ps?`, qty(period, 'ps', 0.01), `${T}/${k} + ${ov} = ${period} ps.`, 'Logic per stage plus flop overhead.'),
      'the pipelined clock period', idea,
      calc('Logic in each stage, total ÷ stages:', `${T} / ${k}`, T / k, 'ps', String(T / k), 0.001),
      calc('Add the flop overhead to get the period:', `${T / k} + ${ov}`, period, 'ps', String(period), 0.01));
    if (d === 2) return walk(ask(`Same block: ${T} ps split into ${k} stages with ${ov} ps overhead each. Throughput speedup versus unpipelined (period ${T + ov} ps)?`, qty((T + ov) / period, 'x', 0.02, sig((T + ov) / period)), `(${T + ov}) / (${T / k} + ${ov}) = ${sig((T + ov) / period)}×, not ${k}×: flop overhead eats the gains as stages shrink.`, 'Old period / new period.'),
      'pipeline speedup', idea,
      calc('Pipelined period, logic per stage plus overhead:', `${T} / ${k} + ${ov}`, period, 'ps', String(period), 0.001),
      calc('Speedup = old period ÷ new period:', `${T + ov} / ${period}`, (T + ov) / period, 'x', sig((T + ov) / period), 0.02));
    return walk(ask(`${T} ps of logic, ${ov} ps flop overhead per stage, ${k} stages. What is the latency of one operation through the pipeline, in ps?`, qty(k * period, 'ps', 0.01), `${k} × ${period} = ${k * period} ps, longer than the unpipelined ${T + ov} ps. Pipelining raises throughput, not latency.`, 'Stages × period.'),
      'pipeline latency', idea,
      calc('Clock period, logic per stage plus overhead:', `${T} / ${k} + ${ov}`, period, 'ps', String(period), 0.001),
      calc('One operation passes through every stage, one period each:', `${k} × ${period}`, k * period, 'ps', String(k * period), 0.01));
  },
  (r, d) => {
    const n = pick(r, [8, 12, 16]), N = pick(r, tier(d, [2, 4], [16, 100], [1000, 4096]));
    const g = Math.ceil(Math.log2(N));
    return walk(ask(`A MAC unit multiplies two signed ${n}-bit values and accumulates ${N.toLocaleString('en-US')} products. Accumulator width so it can never overflow?`, num(2 * n + g), `Each product needs 2n = ${2 * n} bits; summing ${N} of them needs ceil(log2 ${N}) = ${g} guard bits: ${2 * n + g}.`, '2n for the product, plus log2(N) guard bits.'),
      'accumulator width', 'Multiplying two n-bit numbers gives a product of up to 2n bits. Adding N such products can make the total up to N times bigger, which needs log2(N) extra bits (rounded up): the guard bits. So the accumulator needs 2n + ceil(log2 N) bits to never overflow.',
      count('Bits in one product, 2 × n:', `2 × ${n}`, 2 * n),
      calc(`Guard bits for ${N} additions, log2(${N}):`, `log2(${N})`, Math.log2(N), '', sig(Math.log2(N), 4), 0.005),
      count('Product bits plus the guard bits, rounded up:', `${2 * n} + ceil(${sig(Math.log2(N), 4)})`, 2 * n + g));
  },
]);

// ------------------------------------------------------------------ clocks, resets, CDC

const Q_CLK: ConceptQ[] = [
  ['A single control bit crosses from clock A to unrelated clock B. What is the standard fix?', 'A two-flop synchronizer in domain B', ['Nothing, since a single bit cannot go metastable at all', 'A wider bus, so that the bit is held for longer in B', 'An AND gate with the clock B, to align it with the edges'], 'the two-flop synchronizer', 'When a signal from another clock domain changes near a capture edge, the first flop can go metastable. A second flop in the receiving domain gives it a full extra clock period to settle before anything uses it, which makes the chance of a bad value astronomically small.', ['The second flop of a synchronizer gives the first flop:', 'A whole extra cycle to settle', ['A faster clock', 'A reset']]],
  ['An 8-bit counter value crosses domains through 8 separate two-flop synchronizers. Problem?', 'Bits resolve on different cycles, so B sees a value that never was', ['None: eight synchronizers in parallel are the standard fix here today', 'It uses too many flops for a bus of this width in domain B', 'The synchronizers cancel each other out when they all resolve at once'], 'multi-bit crossings', 'Each synchronizer settles independently, so when several bits change at once, domain B may capture some of the new bits and some of the old ones: a value that never existed (like 0111 → 1000 seen as 1111). Fix it by making only one bit change at a time (Gray code), or use a handshake or an async FIFO.', ['A binary counter goes 0111 → 1000. How many bits change at once?', 'All four', ['One', 'None']], 'Bits can resolve on different cycles, so B can see a value that never existed; use Gray code, a handshake, or an async FIFO'],
  ['A one-cycle pulse in a 500 MHz domain goes to a 100 MHz domain via a two-flop synchronizer. Problem?', 'The pulse can be missed; stretch it, or turn it into a toggle', ['It arrives twice, since both edges of the slow clock see it', 'Nothing at all, because a two-flop synchronizer always keeps it', 'It becomes metastable forever, and never resolves to a level'], 'pulses across slow clocks', 'A 500 MHz pulse lasts 2 ns, but the slow 100 MHz clock only looks every 10 ns. The pulse can fall completely between two looks and never be seen. The fix: turn the pulse into a level change (a toggle) that stays put until the slow side has seen it.', ['A 2 ns pulse meets a clock that samples every 10 ns. Can it be missed?', 'Yes, it may fall between two samples', ['No, it is always caught', 'Only in simulation']], 'The pulse can be missed entirely; stretch it or convert it to a toggle and detect the edge'],
  ['Two signals from the same domain are synchronized separately and then combined in domain B. Risk?', 'Reconvergence: they may land in different cycles', ['None: two signals from one domain always arrive together', 'Too much power', 'Hold violations only'], 'reconvergence', 'Two signals that change together in domain A go through two separate synchronizers, and each may take a different number of cycles to settle. Combining them in B can give a pairing of old and new values that was never true in A. Synchronize ONE signal (or a Gray/handshake bundle) and derive the rest from it.', ['Each separate synchronizer settles:', 'Independently of the others', ['At the same instant', 'Never']], 'Reconvergence: they may arrive on different cycles, giving a combination that never existed'],
  ['Why must no logic sit between a source flop and the first synchronizer flop?', 'Glitches could be captured as false pulses', ['It slows the clock down for the source domain as a whole', 'Synthesis forbids any cell placed there', 'It uses more area'], 'launching from a flop', 'Combinational logic can glitch: briefly show wrong values before settling. If a glitch appears at the synchronizer\'s input at the wrong moment, it can be captured as a real pulse. A flop output changes once, cleanly, per cycle, so the crossing must start at a flop.', ['Logic between flops can briefly show:', 'Glitches: wrong values before settling', ['A faster clock', 'Nothing at all']], 'Combinational glitches could be captured as false pulses; the crossing must launch from a flop'],
      ['What does an asynchronous FIFO use to cross a multi-bit pointer safely?', 'Gray-coded pointers, so only one bit changes at a time', ['Binary pointers, passed through a plain wire', 'A faster clock on the receiving side', 'A reset pulse each time the pointer moves'],
        'Gray-code pointers', 'If only one bit changes per step, a sampler can only be wrong by one count at worst: it sees the old or the new value, never a mixture. Binary can flip many bits at once.',
        ['In Gray code, neighbouring values differ in:', 'One bit', ['All bits', 'Two bits']]],
];

export const clkPractice = practice('practice-clk', 'Clock Domain Drills', 'MTBF, synchronizers, Gray pointers, async FIFO depth, dividers', [
  (r, d) => {
    const tau = pick(r, [10, 20, 30]), extra = pick(r, [200, 500, 1000]);
    const idea = 'A flop that goes metastable resolves randomly, with a time constant τ: the chance it is STILL undecided after waiting t falls as e^(-t/τ). So the mean time between failures grows exponentially with the resolution time given: MTBF ∝ e^(t/τ). Every extra clock period of settling time multiplies it by e^(period/τ).';
    if (d < 3) { const f = Math.exp(extra / tau); const disp = f.toExponential(2).replace('e+', 'e'); return walk(ask(`Metastability resolves with time constant τ = ${tau} ps. Adding a synchronizer stage gives ${extra} ps more resolution time. By what factor does MTBF grow? (e^(t/τ), scientific notation fine)`, qty(f, '', 0.05, disp), `e^(${extra}/${tau}) = ${Math.exp(extra / tau).toExponential(2)}. Exponential: one extra flop turns hours into centuries.`, 'MTBF ∝ e^(t_resolve / τ).'),
      'metastability and MTBF', idea,
      calc('The exponent, extra time ÷ τ:', `${extra} / ${tau}`, extra / tau, '', sig(extra / tau, 4), 0.005),
      calc('The factor, e to that power:', `e^${sig(extra / tau, 4)}`, f, '', disp, 0.05)); }
    const T0 = 1e-9, fc = pick(r, [500e6, 1e9]), fd = pick(r, [10e6, 100e6]), tr = pick(r, [0.6e-9, 0.8e-9]), t = tau * 1e-12;
    const mtbf = Math.exp(tr / t) / (T0 * fc * fd);
    const years = mtbf / 3.156e7;
    const disp = years.toExponential(2).replace('e+', 'e');
    return walk(ask(`MTBF = e^(t_r/τ) / (T0·f_clk·f_data). τ = ${tau} ps, T0 = 1 ns, f_clk = ${fc / 1e6} MHz, f_data = ${fd / 1e6} MHz, t_r = ${tr * 1e9} ns. MTBF in years (scientific notation fine)?`, qty(years, '', 0.05, disp), `e^(${sig(tr / t)}) / (${sig(T0 * fc * fd)}) = ${sig(mtbf)} s = ${years.toExponential(2)} years. Multiply by the number of synchronizers on the chip and the number of chips shipped before judging it.`, 'Plug in; convert seconds to years (3.16e7 s).'),
      'computing MTBF', `${idea} The full formula divides by how often a failure could even be triggered: MTBF = e^(t_r/τ) / (T0 · f_clk · f_data), where t_r is the resolution time available, T0 is a flop-specific window, and the two frequencies say how often the clock samples and how often the data changes.`,
      calc('The exponent, resolution time ÷ τ (both in seconds):', `${sig(tr * 1e9)} ns / ${tau} ps`, tr / t, '', sig(tr / t, 4), 0.005),
      calc('The numerator, e to that power:', `e^${sig(tr / t, 4)}`, Math.exp(tr / t), '', sig(Math.exp(tr / t)), 0.02),
      calc('The denominator, T0 × f_clk × f_data (in SI units):', `${T0} × ${fc} × ${fd}`, T0 * fc * fd, '', sig(T0 * fc * fd), 0.001),
      calc('MTBF in seconds:', `${sig(Math.exp(tr / t))} / ${sig(T0 * fc * fd)}`, mtbf, '', sig(mtbf, 4), 0.03),
      calc('In years, dividing by 3.156e7 seconds per year:', `${sig(mtbf, 4)} / 3.156e7`, years, '', disp, 0.05));
  },
  (r, d) => {
    const w = tier(d, 3, 4, 5);
    const b = between(r, 0, 2 ** w - 2);
    const g1 = gray(b), g2 = gray(b + 1);
    if (d < 3) return walk(ask(`An async FIFO pointer increments from ${b} to ${b + 1}. In ${w}-bit Gray code, how many bits change?`, num(1), `${g1.toString(2).padStart(w, '0')} → ${g2.toString(2).padStart(w, '0')}: exactly one. In binary, ${b} → ${b + 1} flips ${(b ^ (b + 1)).toString(2).split('').filter((c) => c === '1').length} bits, which a synchronizer could capture half-updated.`, 'Gray code: consecutive values differ in one bit.'),
      'why pointers cross in Gray code', 'A FIFO pointer crossing to another clock domain is captured bit by bit, and bits can settle on different cycles. If several bits change at once, the other side may see a half-updated, wrong pointer. Gray code counts so that each step changes exactly ONE bit, so the captured value is always either the old or the new one, never a mixture. Convert with g = b XOR (b >> 1).',
      step(`${b} in ${w}-bit Gray code, g = b XOR (b >> 1):`, bin(g1, w)),
      step(`${b + 1} in Gray code:`, bin(g2, w)),
      count('How many bit positions differ between the two?', 'XOR the two and count the 1s', 1));
    const x = between(r, 1, 2 ** w - 1);
    const gb = gray(x).toString(2).padStart(w, '0'), bb = x.toString(2).padStart(w, '0');
    return walk(ask(`The read side synchronizes the write pointer as Gray code ${gb}. What binary pointer value is that?`, num(x), `Gray to binary (prefix XOR from the top): ${x}. The comparison for full/empty is done after conversion (or directly in Gray: the FIFO is full when the synchronised read pointer equals the write pointer with its top two bits inverted).`, 'b[i] = XOR of g[w-1..i].'),
      'Gray pointer to binary', 'The other side receives the pointer in Gray code and needs the ordinary number. From the top bit down: the top binary bit is the top Gray bit, and each next binary bit is (binary bit above) XOR (Gray bit here). Then read the bits as a normal binary number.',
      count(`b[${w - 1}] is copied from g[${w - 1}] = ${gb[0]}:`, `b${w - 1}`, +bb[0]),
      ...Array.from({ length: w - 1 }, (_, i) => count(`b[${w - 2 - i}] = b[${w - 1 - i}] XOR g[${w - 2 - i}] (${bb[i]} XOR ${gb[i + 1]}):`, `${bb[i]} XOR ${gb[i + 1]}`, +bb[i + 1])),
      count(`Read the bits ${bb} as a binary number:`, `0b${bb}`, x));
  },
  (r, d) => {
    const B = pick(r, [64, 100, 256]), fw = pick(r, [200, 250, 400]), fr = pick(r, tier(d, [100, 50], [125, 150], [160, 100]));
    const idleW = d === 3 ? pick(r, [1, 2]) : 0;
    const fwEff = idleW ? fw / (idleW + 1) : fw;
    const depth = Math.ceil(B - B * (fr / fwEff));
    return walk(ask(`An async FIFO takes bursts of ${B} words written at ${fw} MHz${idleW ? `, one write every ${idleW + 1} cycles` : ''}, and drains at ${fr} MHz (one word per read cycle) continuously. Minimum depth so a burst never overflows?`, num(Math.max(0, depth)), `The burst lasts ${B}/${sig(fwEff)} µs; meanwhile ${sig(B * (fr / fwEff))} words are read. Depth = ${B} - ${sig(B * (fr / fwEff))} → ${Math.max(0, depth)}. Real designs add margin for synchronizer latency (a few words).`, 'Words written during the burst minus words read in the same time.'),
      'sizing an async FIFO', 'A FIFO has to absorb whatever the writer sends faster than the reader can drain it. During a burst, words go in at the write rate and come out at the read rate; the FIFO must hold the difference at the end of the burst. So: find how long the burst lasts, how many words the reader removes in that time, and the depth is the burst size minus those.',
      ...(idleW ? [calc(`Only one write every ${idleW + 1} cycles, so the real write rate in MHz:`, `${fw} / ${idleW + 1}`, fwEff, 'MHz', sig(fwEff), 0.005)] : []),
      calc(`Burst duration in µs, words ÷ write rate (MHz):`, `${B} / ${sig(fwEff)}`, B / fwEff, '', sig(B / fwEff, 4), 0.005),
      calc('Words the reader removes in that time, duration × read rate:', `${sig(B / fwEff, 4)} × ${fr}`, (B / fwEff) * fr, '', sig((B / fwEff) * fr, 4), 0.005),
      count('Depth = burst words minus words read, rounded up (never below 0):', `max(0, ceil(${B} - ${sig((B / fwEff) * fr, 4)}))`, Math.max(0, depth)));
  },
  (r, d) => {
    const f = pick(r, [100, 200, 400, 50, 250, 500, 800, 1000]), n = pick(r, tier(d, [2, 4], [3, 5, 8], [3, 5, 7, 9, 11, 13]));
    if (d < 3) return walk(ask(`A counter-based divider divides a ${f} MHz clock by ${n}. Output frequency, in MHz?`, qty(f / n, 'MHz', 0.01), `${f}/${n} = ${sig(f / n)} MHz.`, 'Divide.'),
      'clock dividers', 'A divide-by-n circuit produces one output cycle for every n input cycles, so the output frequency is the input frequency divided by n.',
      calc('Output frequency = input ÷ n:', `${f} / ${n}`, f / n, 'MHz', sig(f / n, 4), 0.01));
    const hi = Math.floor(n / 2);
    return walk(ask(`A divide-by-${n} made from one posedge counter (output high for ${hi} of ${n} cycles). Duty cycle, in %?`, qty((hi / n) * 100, '%', 0.01, sig((hi / n) * 100)), `${hi}/${n} = ${sig((hi / n) * 100)}%. A 50% odd divider needs both clock edges (a negedge flop ORed in).`, 'High cycles / total cycles.'),
      'duty cycle of a divider', 'Duty cycle is the fraction of each output period that the signal is high. For a divider built from a counter, it is the number of input cycles the output stays high divided by the number of input cycles in a whole output period (n). An odd n cannot give exactly 50% from one edge alone.',
      count('Cycles the output is high (given in the question):', `${hi}`, hi),
      calc('Duty cycle = high cycles ÷ total cycles, as a %:', `${hi} / ${n} × 100`, (hi / n) * 100, '%', sig((hi / n) * 100), 0.01));
  },
  (r) => concept(r, Q_CLK, (why) => `${why}. CDC tools check exactly these rules.`),
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
    mc('A nickel and a dime arrive in the same clock due to a sensor glitch. What should a robust design do?', ['Define the behaviour in the spec and handle it', 'Treat the pair as impossible and leave the table silent', 'Stretch the clock until only one coin remains', 'Drop both coins and fall into an unused state'], 0, 'Undefined input combinations are where real field failures come from, so the spec says what happens (count both, or reject) and the logic handles it.'),
    mc('The machine must also reset to 0¢ on power-up. Which reset style?', ['Asynchronous assert, released through a synchronizer', 'No reset at all, since flops power up at zero cents', 'A reset driven only by a coin input on the machine', 'Synchronous reset, applied even if the clock is stopped'], 0, 'Flops power up random; async assert + sync release is the standard pattern.'),
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
    mc('What is wrong at (1)?', ['A blocking assignment in a clocked block', 'half is declared one bit narrower than it needs to be', 'The ~ operator should be a logical ! here instead', 'The non-blocking arrow is also missing from the lo assignment'], 0, 'The if below sees the NEW half, which inverts the packing logic (and = is mixed with <= on half). Use half <= ~half. The later if then sees the old half, as intended.'),
    mc('What is wrong at (2)?', ['dvld is unassigned when half = 0, so a latch is inferred', 'The sensitivity list leaves out the clock edge it needs', 'dvld has to be declared as a wire for this to be legal', 'The block should use a non-blocking assignment instead of ='], 0, 'Assign a default: always @(*) dvld = half & vld;'),
    { t: 'gen', make: () => ask('What is the width of {lo, din}?', num(16), '8 + 8 = 16 bits: matches dout.') },
    mc('dout and lo have no reset. Is that a problem?', ['Usually fine if dvld is reset and qualifies the data', 'Always a bug, because every register must have a reset', 'It makes synthesis infer latches on the whole data path', 'It stops the module synthesizing, since reset is mandatory'], 0, 'Resetting wide datapaths costs area and routing. Reset control, not necessarily data. Verification must still check X is never observed on outputs when dvld = 1.'),
    { t: 'gen', make: (r) => { const n = between(r, 3, 6); return ask(`After the fixes, ${2 * n} valid bytes arrive back-to-back. How many 16-bit words come out?`, num(n), `Two bytes per word: ${n}.`); } },
    mc('How would you verify this module most efficiently?', ['A self-checking bench with a model and random gaps', 'Read the waveforms by eye until the output looks right', 'Synthesize it and compare the gate count with last time', 'Run one very long directed test with a stream of bytes'], 0, 'The model is a queue of bytes, and an assertion checks that dvld pulses once per two bytes. Random stimulus + model + assertions finds the corner cases (back-to-back, gaps, reset mid-word).'),
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
    mc('The accumulator adder is now in the critical path because it feeds itself every cycle. Classic fix?', ['Carry-save accumulation: keep the sum in redundant form and resolve it only at the end', 'Add more pipeline stages inside the accumulator loop', 'Swap in a ripple-carry adder built from smaller cells', 'Drop the supply voltage so the loop path is slower'], 0, 'Keep the running sum in redundant form and resolve it only after the last product. A loop cannot be pipelined without changing the result timing; carry-save removes carry propagation from the loop.'),
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
    mc('frame_start crosses slow → fast. Can a 1-cycle pulse be missed?', ['No: the 6.7 ns pulse outlasts a 2.5 ns period', 'Yes: any single pulse can fall between two fast edges', 'Only when the die is running at high temperature', 'Only when the receiving FIFO is already completely full'], 0, 'A 150 MHz pulse lasts 6.7 ns, longer than a 400 MHz period (2.5 ns), so the fast domain always samples it. Slow-to-fast pulses are safe if the pulse is wider than about 1.5 destination periods. The reverse direction is the danger.'),
    mc('line_count uses 12 independent synchronizers. What is the bug?', ['Bits can resolve on different cycles and corrupt the count', 'Twelve synchronizers use too much area for one counter', 'Each bit needs three flops, not two, to be fully safe', 'The counter ought to be sixteen bits wide, not twelve bits'], 0, 'Send it in Gray code (it only increments) or through a handshake. Multi-bit binary values must never cross through per-bit synchronizers.'),
    { t: 'gen', make: () => ask('Pixels arrive at 150 MHz in bursts of 2048 per line and drain at 400 MHz with one read every 4 cycles (100 MHz effective). Minimum FIFO depth for one line?', num(Math.ceil(2048 - 2048 * (100 / 150))), '2048 - 2048 × 100/150 = 683 words. Round up to 1024 with margin.') },
    mc('soft_reset crosses from sys to sensor with no synchronizer. What should it be?', ['An async-assert, sync-release synchronizer in sensor', 'A plain wire, since resets are static control signals', 'A Gray-code counter driving the reset line over', 'An async FIFO that carries the reset request as data'], 0, 'Reset deassertion is a CDC event: it must be synchronized to each domain it releases.'),
    { t: 'gen', make: () => { const m = Math.exp(1.2e-9 / 25e-12) / (1e-9 * 400e6 * 150e6) / 3.156e7; return ask('With τ = 25 ps, T0 = 1 ns, f_clk = 400 MHz, f_data = 150 MHz and 1.2 ns of resolution time, what is one synchronizer\'s MTBF, in years? (scientific notation fine)', qty(m, '', 0.05, m.toExponential(2).replace('e+', 'e')), `e^48 / (6e7) = ${m.toExponential(2)} years: plenty. The daily frame drops were the multi-bit count, not metastability.`); } },
    mc('What single process change would have caught this before silicon?', ['Structural CDC analysis, with no unreviewed waivers', 'More directed tests written at the chip top level', 'A faster simulator for the nightly full-chip regression', 'A lower clock frequency throughout the bring-up stage'], 0, 'Add CDC assertions and formal checks too. CDC bugs rarely show in RTL simulation: simulators do not model metastability. Static CDC tools and reviews catch them.'),
  ],
  recap: ['Slow→fast pulses are safe if wide enough.', 'Multi-bit data: Gray, handshake or async FIFO.', 'Synchronize reset release.', 'MTBF is exponential; CDC tools, not simulation, find these.'],
});

export const DIGITAL_BOSSES = [logicBoss, hdlBoss, uarchBoss, cdcBoss];

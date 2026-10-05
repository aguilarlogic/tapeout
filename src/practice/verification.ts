// Practice banks and bosses for verification and test: testbenches, debug, constrained random, coverage, UVM, SVA, formal, DFT.
import { hexa, num, qty, words } from '../lessons/answers';
import { calc, choice, count, show, sim, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, exact, hex, mcs, sci, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';
const NONE = words('none', 'never', 'no failure', 'pass', 'passes', 'it passes', 'no');

/** A waveform as a table: one row per signal, one column per cycle. */
export function waveform(rows: [string, number[]][]): string {
  const n = rows[0][1].length;
  const head = 'cycle ' + Array.from({ length: n }, (_, i) => String(i).padStart(3)).join('');
  return code([head, ...rows.map(([name, v]) => name.padEnd(6) + v.map((x) => String(x).padStart(3)).join(''))].join('\n'));
}

/** Evaluate `ante |-> ##[m:n] cons` on a trace: every attempt with its result. */
export function attempts(ante: boolean[], cons: number[], m: number, n: number) {
  return ante.flatMap((a, t) => (a ? [{ t, ok: cons.slice(t + m, t + n + 1).some((x) => x === 1) }] : []));
}

const lcm = (a: number, b: number) => { const g = (x: number, y: number): number => (y ? g(y, x % y) : x); return (a * b) / g(a, b); };

// ------------------------------------------------------------------ testbench architecture and debug

export const dvPractice = practice('practice-dv', 'Testbench & Debug Drills', 'scoreboards, reference models, races, waveform debugging', [
  (r, d) => {
    const n = tier(d, 6, 8, 10);
    const exp = Array.from({ length: n }, () => between(r, 0, 255));
    const k = between(r, 1, n - 2);
    const act = [...exp];
    const dropped = d > 1 && r() < 0.5;
    if (dropped) act.splice(k, 1);
    else act[k] = (exp[k] ^ (1 << between(r, 0, 7))) & 255;
    return walk(ask(`An in-order scoreboard compares transactions one by one.${code(`expected: ${exp.map((x) => hex(x, 2)).join(' ')}\nactual:   ${act.map((x) => hex(x, 2)).join(' ')}`)}At which transaction (counting from 1) is the first mismatch reported?`, num(k + 1), dropped ? `Transaction ${k + 1} was dropped, so every later actual value is shifted by one: the first mismatch is at ${k + 1}, and everything after it also mismatches. One missing item looks like a flood of errors; always read the first one.` : `Transaction ${k + 1}: expected ${hex(exp[k], 2)}, got ${hex(act[k], 2)} (a single flipped bit).`, 'Compare position by position.'),
      'reading a scoreboard comparison', 'An in-order scoreboard takes the next actual transaction from the DUT and compares it with the next expected one from the reference model, pair by pair, in order. The FIRST position where they differ is the real clue. If an item is dropped, everything after it is shifted by one place and mismatches too, so later errors are usually just consequences. Always start at the first.',
      count('Compare the two rows from the left. How many leading positions are identical?', 'leading matches', k),
      count('So the first position that differs, counting from 1, is:', `${k} + 1`, k + 1));
  },
  (r, d) => {
    const depth = d === 3 ? 3 : 99;
    const ops: string[] = [];
    const q: number[] = [];
    const pops: number[] = [];
    const trace: string[] = [];
    let v = between(r, 1, 5);
    for (let i = 0; i < tier(d, 6, 8, 10); i++) {
      if (q.length === 0 || (r() < 0.6 && ops.filter((o) => o.startsWith('push')).length < 7)) {
        ops.push(`push ${v}`);
        const dropped = q.length >= depth;
        if (!dropped) q.push(v);
        trace.push(`push ${v}${dropped ? ' (full: dropped)' : ''} -> [${q.join(', ')}]`);
        v += between(r, 1, 4);
      } else { ops.push('pop'); const x = q.shift()!; pops.push(x); trace.push(`pop (returns ${x}) -> [${q.join(', ')}]`); }
    }
    while (pops.length < tier(d, 1, 2, 3) && q.length) { ops.push('pop'); const x = q.shift()!; pops.push(x); trace.push(`pop (returns ${x}) -> [${q.join(', ')}]`); }
    const k = pops.length;
    return walk(ask(`A reference model for a FIFO${depth < 99 ? ` of depth ${depth} that silently drops pushes when full` : ''} sees:${code(ops.join('\n'))}What does pop number ${k} return?`, num(pops[k - 1]), `Pops return, in order: ${pops.join(', ')}.${depth < 99 ? ' Pushes that arrive while 3 items are waiting are lost: that is exactly the corner a scoreboard must model, or it reports false errors.' : ' First in, first out.'}`, 'Keep a queue: push at the back, pop from the front.'),
      'a FIFO reference model', `A reference model predicts what the DUT should do. For a FIFO it is just a queue: push adds an item at the back, and pop removes and returns the item at the FRONT (the oldest one).${depth < 99 ? ` This FIFO holds at most ${depth} items: a push that arrives while it is full is thrown away, and the model must do the same.` : ''} Replay the operations one at a time, keeping the queue contents.`,
      ...sim(trace.map((tr, i) => {
        const [opName] = ops[i].split(' ');
        const state = tr.slice(tr.indexOf('->') + 3);
        return { beats: [step(`Operation ${i + 1} is \`${ops[i]}\`. Write the queue afterwards, front first, as a list like [1, 2] (or [] if empty):`, exact(state, state.replace(/[\[\]]/g, ''), ...(state === '[]' ? ['empty', 'nothing'] : [])), opName === 'push' ? 'A push adds to the back unless the FIFO is full.' : 'A pop removes the item at the front.')], row: tr };
      }), 3, 'the queue after each operation'),
      count(`Which value does pop number ${k} return?`, `pop #${k}`, pops[k - 1]));
  },
  (r, d) => {
    const a = between(r, 1, 9), b = between(r, 10, 19);
    const nb = 'A non-blocking assignment (<=) works in two phases: first every right-hand side is read using the values from BEFORE the clock edge, then all the left-hand sides are updated together. A blocking assignment (=) takes effect immediately, so the next line sees the new value.';
    if (d === 1) return walk(ask(`Registers a = ${a}, b = ${b}.${code('always @(posedge clk) begin\n  a <= b;\n  b <= a;\nend')}What is b after one clock edge?`, num(a), `Nonblocking assignments all read their right-hand sides first, then update: the values swap. b = ${a}.`, 'With <=, every right side is read before anything changes.'),
      'non-blocking assignments swap values', nb,
      count(`a <= b reads the OLD b (${b}), so a becomes:`, 'old b', b),
      count(`b <= a reads the OLD a (${a}), not the new one, so b becomes:`, 'old a', a));
    if (d === 2) return walk(ask(`Registers a = ${a}, b = ${b}.${code('always @(posedge clk) begin\n  a = b;\n  b = a;\nend')}What is b after one clock edge?`, num(b), `Blocking: a becomes ${b} immediately, then b = a reads the new a: b = ${b}. Both end up ${b}. Use <= for flops.`, 'With =, each line sees the previous line\'s result.'),
      'blocking assignments in order', nb,
      count(`a = b happens immediately: a becomes the value of b:`, 'b', b),
      count('b = a then reads the NEW a, so b becomes:', 'new a', b));
    const c = between(r, 20, 29);
    return walk(ask(`Registers a = ${a}, b = ${b}, c = ${c}. The designer meant a 2-stage pipeline:${code('always @(posedge clk) begin\n  b = a;\n  c = b;\nend')}What is c after one clock edge?`, num(a), `Blocking assignments collapse the pipeline: b = ${a}, then c = b = ${a}. With <= c would be ${b}. One stage of latency just vanished, and the test only fails when data changes every cycle.`, 'Each blocking line sees the line above.'),
      'blocking assignments collapse a pipeline', nb,
      count('b = a takes effect at once. b becomes:', 'a', a),
      count('c = b now reads the NEW b, so c becomes:', 'new b', a));
  },
  (r) => concept(r, [
    ['In RTL simulation, `if (sel) y = a; else y = b;` runs with sel = X. What does y get?', 'b: an X condition takes the else branch (X-optimism)', ['X, because the simulator propagates the unknown through the mux', 'a, because the first branch is always the one that is taken', 'The simulator stops with an error on the unknown condition'], 'X-optimism', 'In RTL simulation an if treats an X (unknown) condition as "not true" and takes the else branch, quietly giving a definite answer. Real hardware would have a real but unknown 0 or 1, and gate-level simulation shows the X. So RTL simulation can hide bugs involving uninitialised signals.', ['An if with an X condition takes:', 'The else branch', ['The then branch', 'Both branches']], 'b, because an X condition takes the else branch: X-optimism hides the problem that gates would show'],
    ['Why should a monitor be passive?', 'It only observes; driving pins would change what it checks', ['Monitors must drive the DUT, so that the bus stays in a legal state', 'Passive monitors run faster than active ones in a simulator', 'Only the scoreboard is allowed to be active in the environment'], 'passive monitors', 'A monitor\'s job is to watch the interface and report what really happened. If it also drove any signal, it would be influencing the very behaviour it is supposed to judge, and could hide or cause bugs. So monitors only read.', ['A monitor\'s job is to:', 'Watch and report, not drive', ['Drive stimulus', 'Replace the DUT']], 'It only observes pins and reports transactions; if it drove signals it would change what it is checking'],
    ['Who should write the reference model?', 'Someone working from the spec, not from the RTL', ['The RTL designer, copying the RTL into a model of their own', 'Nobody: the waveforms are enough for a human to check by eye', 'The synthesis tool, which can generate a model from the netlist'], 'independent reference models', 'A reference model is the "answer key" that the DUT is graded against. If it is written by translating the RTL, any mistake in understanding the spec is copied into both, and the check passes while both are wrong. Write it independently from the spec.', ['If the model is a copy of the RTL, a misunderstanding of the spec is:', 'In both, so the check cannot catch it', ['Caught immediately', 'Removed']], 'Someone working from the specification, not from the RTL, so the same misunderstanding is not copied into both'],
    ['A test fails at cycle 900,000. What do you look at first?', 'The first error message, then walk back in the waveform', ['The last error message that was printed before the run ended', 'The coverage report', 'The synthesis log'], 'debugging from the first error', 'After the first wrong value, everything downstream can be wrong too, so later messages are mostly noise. Start at the first error, then trace backwards in the waveform along the data path to the point where a value first differs from what it should be.', ['Later error messages are usually:', 'Consequences of the first one', ['More important', 'Unrelated']], 'The first error message and the cycle it points to, then walk backwards in the waveform to where the data first went wrong'],
    ['A testbench drives inputs with blocking assignments right at the clock edge, and the DUT sometimes sees the new value. What is this?', 'A race: fix it by driving through a clocking block or with nonblocking assignments / after the edge', ['A timing violation, which the synthesis tool will report later', 'An X-propagation issue, from a signal that was left undriven', 'Correct behaviour, since blocking assignments are the safe kind'], 'testbench races', 'If the testbench changes a signal at the exact instant of the clock edge, the simulator may run the DUT\'s always block either before or after that change: the result depends on the order, a race. A clocking block or a non-blocking drive makes the change land just after the edge, every time.', ['A race means the result depends on:', 'The order the simulator runs the code', ['The clock speed', 'The synthesis tool']], 'A race: fix it by driving through a clocking block or with nonblocking assignments / after the edge'],
  ], (why) => `${why}.`),
  (r, d) => {
    const n = pick(r, tier(d, [1000, 4000], [1e5, 1e6], [5e6, 1e7]));
    const k = Math.ceil(Math.log2(n));
    return walk(ask(`A failure appears somewhere in a ${n.toLocaleString('en-US')}-cycle run, and you can rerun with a checkpoint at any cycle. How many bisection runs to narrow it to a single cycle?`, num(k), `Each run halves the window: ⌈log2(${n.toLocaleString('en-US')})⌉ = ${k}. Bisection (on cycles, on commits, on seeds) is the debugger's most reliable tool.`, 'Halve the window each time.'),
      'bisection debugging', 'Bisection finds where something went wrong by binary search: test the middle of the window, see whether the failure has already happened, and throw away the half that cannot contain the start of it. Each run halves the window, so the number of runs to get down to a single cycle is log2 of the window, rounded up.',
      calc('log2 of the number of cycles:', `log2(${n})`, Math.log2(n), '', sig(Math.log2(n), 5), 0.002),
      count('Round up to whole runs:', `ceil(${sig(Math.log2(n), 5)})`, k));
  },
]);

// ------------------------------------------------------------------ constrained random

export const crvPractice = practice('practice-crv', 'Constraint Drills', 'solution spaces, dist weights, solve-before, randc', [
  (r, d) => {
    const idea = 'A constraint block defines the SOLUTION SPACE: the set of value combinations the solver may pick from. Each randomize() picks one solution, (nearly) uniformly at random. To predict behaviour, list or count the solutions that satisfy every constraint at once.';
    if (d < 3) {
      const lo = between(r, 0, 6), hi = between(r, lo + 5, 15), k = pick(r, [2, 3, 4]);
      const sols = Array.from({ length: 16 }, (_, x) => x).filter((x) => x >= lo && x <= hi && (d === 1 || x % k === 0));
      return walk(ask(`How many values can x take?${code(`rand bit [3:0] x;\nconstraint c { x inside {[${lo}:${hi}]};${d === 2 ? ` x % ${k} == 0;` : ''} }`)}`, num(sols.length), `Solutions: ${sols.join(', ')} → ${sols.length}.`, 'List them.'),
        'counting solutions of a constraint', idea,
        `x is a 4-bit value, so it is between 0 and 15. "inside {[${lo}:${hi}]}" keeps ${lo} through ${hi}.${d === 2 ? ` The second constraint keeps only multiples of ${k}.` : ''}`,
        step('Write the values x can take, separated by commas:', exact(sols.join(', '), sols.join(','))),
        count('How many are there?', `count of the list`, sols.length));
    }
    const kind = pick(r, ['lt', 'sum', 'sumlt']);
    const s = between(r, 4, 10);
    let n = 0;
    const per: number[] = [];
    for (let a = 0; a < 8; a++) { let na = 0; for (let b = 0; b < 8; b++) if (kind === 'lt' ? a < b : kind === 'sum' ? a + b === s : a + b < s) na++; per.push(na); n += na; }
    const c = kind === 'lt' ? 'a < b;' : kind === 'sum' ? `a + b == ${s};` : `a + b < ${s};`;
    return walk(ask(`How many (a, b) pairs satisfy this?${code(`rand bit [2:0] a, b;\nconstraint c { ${c} }`)}(The sum is evaluated at 32 bits, so it does not wrap.)`, num(n), `Count the pairs of 0-7 values: ${n}. The solver picks uniformly among these ${n} solutions, which is why joint constraints skew each variable's distribution.`, 'Go through a = 0..7 and count valid b.'),
      'counting joint solutions', `${idea} With two variables, go through each value of a and count how many values of b (0 to 7) work with it, then add them up.`,
      ...per.map((x, a) => count(`a = ${a}: how many b values in 0..7 satisfy "${c.replace(';', '')}"?`, `b choices for a = ${a}`, x)),
      count('Add them up:', per.join(' + '), n));
  },
  (r, d) => {
    const w0 = pick(r, [10, 20, 40]), w1 = pick(r, [10, 20, 30]), w2 = pick(r, [10, 20]);
    const idea = 'A dist constraint gives each value a weight, and the probability of a value is its weight divided by the total weight. For a range like [1:3], there are two operators: := gives EACH value in the range that weight, while :/ gives the range that weight IN TOTAL, split equally between its values.';
    if (d === 1) {
      const p = (w1 / (w0 + w1)) * 100;
      return walk(ask(`P(x == 1), in %?${code(`x dist { 0 := ${w0}, 1 := ${w1} };`)}`, qty(p, '%', 0.01, sig(p)), `${w1}/(${w0} + ${w1}) = ${sig(p)}%.`, 'Weight / total weight.'),
        'dist weights', idea,
        count('The total weight:', `${w0} + ${w1}`, w0 + w1),
        calc('P = weight of 1 ÷ total, as a %:', `${w1} / ${w0 + w1} × 100`, p, '%', sig(p), 0.01));
    }
    const each = d === 2;
    const total = each ? w0 + 3 * w1 + w2 : w0 + w1 + w2;
    const mine = each ? w1 : w1 / 3;
    const p = (mine / total) * 100;
    return walk(ask(`P(x == 2), in %?${code(`x dist { 0 ${each ? ':=' : ':/'} ${w0}, [1:3] ${each ? ':=' : ':/'} ${w1}, 4 ${each ? ':=' : ':/'} ${w2} };`)}`, qty(p, '%', 0.01, sig(p)), each ? `:= gives EACH value in the range weight ${w1}: total = ${w0} + 3×${w1} + ${w2} = ${w0 + 3 * w1 + w2}; P = ${w1}/${w0 + 3 * w1 + w2} = ${sig(p)}%.` : `:/ SPLITS ${w1} across the 3 values: ${sig(w1 / 3)} each; total = ${w0 + w1 + w2}; P = ${sig(p)}%.`, ':= is per value, :/ is shared by the range.'),
      each ? 'dist with := (per value)' : 'dist with :/ (shared by the range)', idea,
      ...(each ? [count('The range [1:3] has 3 values, each with weight ' + w1 + '. Total weight, 0 + 3 × ' + w1 + ' + 4:', `${w0} + 3 × ${w1} + ${w2}`, total)]
        : [calc(`:/ shares ${w1} between the 3 values, so each gets:`, `${w1} / 3`, w1 / 3, '', sig(w1 / 3, 4), 0.005),
          count(`Total weight, ${w0} + ${w1} + ${w2} (the range counts once as ${w1}):`, `${w0} + ${w1} + ${w2}`, total)]),
      calc(`P(x == 2) = its weight ${sig(mine, 4)} ÷ total ${total}, as a %:`, `${sig(mine, 4)} / ${total} × 100`, p, '%', sig(p), 0.01));
  },
  (r, d) => {
    if (d === 1) {
      const w = pick(r, [2, 3]), calls = 2 ** w * pick(r, [2, 3]);
      return walk(ask(`\`randc bit [${w - 1}:0] v;\` is randomized ${calls} times. How many times does each value appear?`, num(calls / 2 ** w), `randc cycles through all ${2 ** w} values before repeating any: ${calls}/${2 ** w} = ${calls / 2 ** w} each.`, 'randc is a shuffled deck.'),
        'randc (random cyclic)', 'randc is like dealing cards from a shuffled deck: every value appears exactly once before any value repeats, then the deck is reshuffled. So in a whole number of rounds, every value appears the same number of times.',
        count(`A ${w}-bit variable has this many different values:`, `2^${w}`, 2 ** w),
        count(`${calls} calls make this many full rounds through the deck, so each value appears:`, `${calls} / ${2 ** w}`, calls / 2 ** w));
    }
    const w = pick(r, [2, 3, 4]), sb = d === 3 && r() < 0.5;
    const p = sb ? 50 : (1 / (2 ** w + 1)) * 100;
    const idea = 'The solver picks uniformly among ALL solutions of the constraints, not among the values of each variable separately. So a variable that is allowed in only a few solutions comes up rarely. "solve a before b" changes this: a is picked first (uniformly over its own possible values), then b is chosen from what is left.';
    const code1 = `rand bit en;\nrand bit [${w - 1}:0] v;\nconstraint c { en -> v == 0; }${sb ? '\nconstraint o { solve en before v; }' : ''}`;
    if (sb) return walk(ask(`P(en == 1), in %?${code(code1)}`, qty(p, '%', 0.01, sig(p)), 'solve en before v picks en first, uniformly (50%), then v given en.', 'Count solutions with en = 0 and en = 1.'),
      'solve-before', idea,
      choice('With "solve en before v", how is en picked?', 'First, with equal chance for 0 and 1', ['In proportion to how many solutions each value has', 'After v']),
      calc('P(en == 1) for a fair 0/1 choice, as a %:', '1 / 2 × 100', 50, '%', '50', 0.01));
    return walk(ask(`P(en == 1), in %?${code(code1)}`, qty(p, '%', 0.01, sig(p)), `The solver is uniform over solutions: en = 0 allows ${2 ** w} values of v, en = 1 only v = 0. So ${2 ** w + 1} solutions, one with en = 1: ${sig(p)}%. The "feature enable" almost never fires: use solve-before or dist.`, 'Count solutions with en = 0 and en = 1.'),
      'uniform over solutions', idea,
      count(`When en = 0, v is free: ${2 ** w} possible values of v (${w} bits). Solutions with en = 0:`, `2^${w}`, 2 ** w),
      count('When en = 1, the constraint forces v == 0: how many solutions?', 'v = 0 only', 1),
      calc(`P(en == 1) = 1 solution out of ${2 ** w + 1}, as a %:`, `1 / ${2 ** w + 1} × 100`, p, '%', sig(p), 0.01));
  },
  (r) => concept(r, [
    ['`randomize()` fails because constraints conflict, and the return value is ignored. What happens?', 'The variables keep old values and the test runs on with stale data', ['The simulator stops at once, with a fatal error and a message', 'The constraints are relaxed automatically, until a solution is found', 'Random values are chosen anyway, ignoring the conflicting constraints'], 'checking randomize()', 'When the constraints cannot all be satisfied, randomize() returns 0 and leaves the variables UNCHANGED. If the code does not check the return value, the test carries on with stale values as if nothing happened, and you may think you are testing new scenarios when you are not.', ['When randomize() fails, the variables:', 'Keep their old values', ['Get new random values', 'Become zero']], 'The variables keep their old values and the test continues silently with stale stimulus'],
    ['What does `soft` do on a constraint?', 'It holds unless a stronger constraint contradicts it', ['It is ignored by the solver, and only read by the coverage tool', 'It makes the constraint probabilistic, so that it holds half of the time', 'It turns the constraint into a coverage point for the same variable'], 'soft constraints', 'A normal constraint must always hold. A soft constraint is a default: it holds unless something stronger (a normal constraint, for example an inline "with" from a test) contradicts it, in which case the soft one is quietly dropped instead of making randomize() fail.', ['If a normal constraint contradicts a soft one:', 'The soft one is dropped and randomize still succeeds', ['randomize fails', 'Both are dropped']], 'It holds unless a later, stronger (non-soft) constraint contradicts it, so tests can override defaults'],
    ['What does `c.constraint_mode(0)` do?', 'Disables block c for later randomize() calls on that object', ['Deletes the object, so that it cannot be randomized any more', 'Randomizes only block c, and leaves the other blocks alone', 'Makes block c soft, so that a test can override it with its own'], 'constraint_mode', 'Every named constraint block can be switched on and off while the test runs: constraint_mode(0) turns it off, constraint_mode(1) back on. The object is unchanged; later randomize() calls simply ignore the disabled block.', ['After c.constraint_mode(0), the next randomize():', 'Ignores constraint block c', ['Fails', 'Deletes c']], 'Disables constraint block c for later randomize() calls on that object'],
    ['When does post_randomize() run?', 'Automatically after each successful randomize()', ['Before randomize(), so that the fields can be set up for the solver', 'Only when randomize() fails, to put the object back as it was', 'Only at time zero, once, when the object is first constructed'], 'pre_ and post_randomize', 'SystemVerilog calls pre_randomize() just before and post_randomize() just after each randomize(). Post is the place for things computed from the random values, for example a checksum field that depends on the payload the solver just chose.', ['A checksum depends on the random payload, so it must be computed:', 'After randomization', ['Before randomization', 'Never']], 'Automatically after every successful randomize(), e.g. to compute a checksum field from the random ones'],
    ['Why are seeds recorded for every random test?', 'So a failing run can be reproduced exactly', ['For licensing, since the vendor counts the seeds that were used', 'To make the tests faster, by skipping the seeds already tried', 'Seeds only matter for coverage, and not for repeating a failure'], 'reproducibility', 'Random simulation looks unpredictable, but a simulator\'s random numbers come from a seed. Run again with the same seed and the same design and you get exactly the same stimulus, so a failure can be reproduced and debugged. Without the seed, a rare failure is lost.', ['The same seed gives:', 'The same random sequence', ['A new sequence', 'No randomness']], 'So a failing run can be reproduced exactly with the same seed'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ coverage

export const covPractice = practice('practice-cov', 'Coverage Drills', 'bins, crosses, coverage %, closure math', [
  (r, d) => {
    const a = between(r, 0, 2), b = a + between(r, 2, 4), c = b + 1 + between(r, 2, 4), e = c + 4 + between(r, 3, 6);
    const k = pick(r, [2, 3, 4]);
    const lines = [`bins lo = {[${a}:${b}]};`, `bins mid[] = {[${b + 1}:${c}]};`];
    let n = 1 + (c - b);
    if (d > 1) { lines.push(`bins hi[${k}] = {[${c + 1}:${e}]};`); n += k; }
    if (d > 2) lines.push(`ignore_bins odd = {${e + 1}, ${e + 3}};`, `illegal_bins bad = {${e + 2}};`);
    return walk(ask(`How many bins does this coverpoint have?${code(`coverpoint x {\n  ${lines.join('\n  ')}\n}`)}`, num(n), `lo is 1 bin; mid[] makes one bin per value: ${c - b}${d > 1 ? `; hi[${k}] splits the range into ${k} bins` : ''}${d > 2 ? '; ignore and illegal bins are not counted' : ''}. Total ${n}.`, 'bins x = {...} is one bin; bins x[] = {...} is one per value; bins x[N] is N bins.'),
      'counting coverage bins', 'Each line defines bins, and the brackets decide how many: "bins b = {...}" is ONE bin covering all the listed values; "bins b[] = {...}" makes one bin PER value; "bins b[N] = {...}" splits the values into N bins. ignore_bins and illegal_bins are not counted as bins to hit.',
      count(`"bins lo = {[${a}:${b}]}" (no brackets): how many bins?`, 'one bin for the whole range', 1),
      count(`"bins mid[] = {[${b + 1}:${c}]}": one per value, ${b + 1} through ${c}:`, `${c} - ${b}`, c - b),
      ...(d > 1 ? [count(`"bins hi[${k}]": explicitly ${k} bins:`, `${k}`, k)] : []),
      ...(d > 2 ? ['ignore_bins and illegal_bins are excluded from the count: values you do not need to hit, or that must never happen.'] : []),
      count('Total number of bins:', 'add them up', n));
  },
  (r, d) => {
    const n = between(r, 3, 6), m = between(r, 2, 5);
    const idea = 'A cross makes a bin for every COMBINATION of one bin from each coverpoint: it records when both things happened together. With a bins from the first and b from the second there are a × b combinations. Bins you mark to ignore are removed from that total.';
    if (d < 3) return walk(ask(`cp_a has ${n} bins and cp_b has ${m}. How many bins does \`cross cp_a, cp_b\` have?`, num(n * m), `Every combination: ${n} × ${m} = ${n * m}. Crosses grow fast, so cross only what the spec says interacts.`, 'Multiply.'),
      'cross coverage', idea,
      count('Every bin of cp_a pairs with every bin of cp_b:', `${n} × ${m}`, n * m));
    return walk(ask(`cp_a has ${n} bins and cp_b has ${m}. The cross ignores every combination with cp_a's bin "reserved". How many cross bins remain?`, num((n - 1) * m), `${n} × ${m} = ${n * m}, minus the ${m} combinations of "reserved" with each cp_b bin = ${(n - 1) * m}.`, 'Total minus the ignored combinations.'),
      'cross coverage with ignored bins', idea,
      count('All combinations:', `${n} × ${m}`, n * m),
      count('The bin "reserved" pairs with each of the cp_b bins. Combinations ignored:', `1 × ${m}`, m),
      count('Bins remaining:', `${n * m} - ${m}`, (n - 1) * m));
  },
  (r, d) => {
    const n1 = pick(r, [4, 8, 10]), h1 = between(r, 1, n1);
    const idea = 'Coverage is the fraction of bins that have been hit at least once, as a percentage: hit ÷ total × 100. A bin hit once counts the same as one hit a million times. A covergroup\'s score is the weighted average of its coverpoints\' scores (equal weights: the plain average of the percentages), not a pooled count of all bins.';
    if (d < 3) return walk(ask(`A coverpoint has ${n1} bins; ${h1} have been hit at least once. Coverage, in %?`, qty((h1 / n1) * 100, '%', 0.01, sig((h1 / n1) * 100)), `${h1}/${n1} = ${sig((h1 / n1) * 100)}%. A bin hit once counts the same as a bin hit a million times (unless at_least is set).`, 'Hit bins / total bins.'),
      'coverage percentage', idea,
      calc('Hit bins ÷ total bins, as a %:', `${h1} / ${n1} × 100`, (h1 / n1) * 100, '%', sig((h1 / n1) * 100), 0.01));
    const n2 = pick(r, [6, 12, 20]), h2 = between(r, 1, n2);
    const cov = ((h1 / n1 + h2 / n2) / 2) * 100;
    return walk(ask(`A covergroup has two coverpoints with equal weight: A (${h1}/${n1} bins hit) and B (${h2}/${n2}). Group coverage, in %?`, qty(cov, '%', 0.01, sig(cov)), `The group score is the weighted average of the coverpoint scores, not of the bins: (${sig((h1 / n1) * 100)}% + ${sig((h2 / n2) * 100)}%)/2 = ${sig(cov)}%.`, 'Average the two percentages.'),
      'covergroup coverage', idea,
      calc('Coverpoint A, as a %:', `${h1} / ${n1} × 100`, (h1 / n1) * 100, '%', sig((h1 / n1) * 100, 4), 0.005),
      calc('Coverpoint B, as a %:', `${h2} / ${n2} × 100`, (h2 / n2) * 100, '%', sig((h2 / n2) * 100, 4), 0.005),
      calc('Equal weights, so the group score is the average of the two:', `(${sig((h1 / n1) * 100, 4)} + ${sig((h2 / n2) * 100, 4)}) / 2`, cov, '%', sig(cov), 0.01));
  },
  (r, d) => {
    const N = pick(r, tier(d, [2, 4], [6, 8], [16, 32]));
    let H = 0;
    for (let i = 1; i <= N; i++) H += 1 / i;
    return walk(ask(`A random test hits one of ${N} equally likely bins per transaction. On average, how many transactions until every bin is hit?`, qty(N * H, '', 0.03, sig(N * H)), `The coupon collector problem: N·(1 + 1/2 + … + 1/N) = ${N} × ${sig(H)} = ${sig(N * H)}. The last bins take the longest, which is why closure needs directed tests or tuned constraints.`, 'Expected time = N × H_N (the N-th harmonic number).'),
      'the coupon-collector problem', `Collecting all ${N} bins by random hits gets slower as you go: when k bins are still missing, each hit finds a new one with probability k/${N}, so you expect ${N}/k hits to find the next. Adding up ${N}/${N} + ${N}/${N - 1} + … + ${N}/1 gives N × (1 + 1/2 + … + 1/N): N times the harmonic number H_N.`,
      calc(`The harmonic number H_${N} = 1 + 1/2 + … + 1/${N}:`, Array.from({ length: Math.min(N, 4) }, (_, i) => `1/${i + 1}`).join(' + ') + (N > 4 ? ' + …' : ''), H, '', sig(H, 4), 0.005),
      calc('Expected hits = N × H_N:', `${N} × ${sig(H, 4)}`, N * H, '', sig(N * H), 0.03));
  },
  (r) => concept(r, [
    ['Code coverage is 100%. Does that mean the design is verified?', 'No: it only says lines ran, not that results were checked', ['Yes, fully, since every line of the design has now been exercised', 'Yes, as long as the regression reported no errors at all', 'Only for FSMs, where every state and arc has been visited'], 'code versus functional coverage', 'Code coverage only tells you which lines of RTL ran. A line can run without its result ever being checked, and a whole scenario (like two requests at once) can be missing even though every line ran. So 100% code coverage does not mean the design is verified.', ['Code coverage reports which:', 'Lines of code ran', ['Scenarios the spec needs', 'Bugs exist']], 'No: code coverage only says lines were executed, not that the right scenarios happened or the results were checked'],
    ['What does functional coverage measure?', 'Whether the scenarios in the test plan really happened', ['Which lines of the RTL ran during the simulation of the test', 'How fast the simulator runs', 'Toggles at gate level only'], 'functional coverage', 'Functional coverage is written by the verification engineer from the test plan: a list of things that must be seen (every command type, every burst length, a full FIFO, and so on). It measures whether simulation really produced those scenarios.', ['Functional coverage comes from:', 'The spec and the test plan', ['The RTL lines', 'The synthesis tool']], 'Whether the scenarios in the test plan (from the spec) actually happened in simulation'],
    ['A coverage bin can never be hit because the feature was removed from the spec. What do you do?', 'Move it to ignore_bins and record the waiver in the plan', ['Leave it as it is, and report 99% coverage at the review', 'Force the signal in the testbench, so that the bin is hit', 'Delete the whole covergroup, since the feature is gone from it'], 'handling unreachable bins', 'A bin that can never be hit will hold coverage below 100% forever. If the spec no longer has that case, take the bin out of the goal (ignore_bins, or delete it) and write down why in the test plan, so the decision is reviewed rather than hidden.', ['A bin for a feature that no longer exists should be:', 'Removed or ignored, with the reason recorded', ['Left there forever', 'Hit by forcing the signal']], 'Move it to ignore_bins (or remove it) and record the waiver in the test plan'],
    ['Coverage is stuck at 92% after 10,000 random seeds. Best next step?', 'Analyze the holes, then tune constraints or add directed tests', ['Run 100,000 more seeds, in case they turn up the missing bins', 'Lower the goal to 90%, so that the report shows a pass again', 'Remove the missing bins from the covergroup, so they stop showing'], 'closing coverage holes', 'If random tests have not hit a bin after many seeds, the constraints probably make it very unlikely or impossible. More of the same seeds will not help. Look at which bins are missing and why, then change the constraints or write a directed test that aims straight at them.', ['Coverage that does not improve with more seeds suggests:', 'The constraints make those bins unlikely or impossible', ['You need even more seeds', 'The bins do not matter']], 'Analyze the holes, then tune constraints or write directed tests aimed at them'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ UVM

const PHASES = ['build', 'connect', 'end_of_elaboration', 'start_of_simulation', 'run', 'extract', 'check', 'report', 'final'];

export const uvmPractice = practice('practice-uvm', 'UVM Drills', 'phases, objections, components, factory, config_db', [
  (r, d) => {
    const i = between(r, 0, PHASES.length - 2);
    const idea = 'UVM runs every component through the same sequence of phases, in a fixed order: build, connect, end_of_elaboration, start_of_simulation, run, extract, check, report, final. build creates the testbench hierarchy (top-down: a parent must exist before it can create its children); the others walk bottom-up. Only run takes simulation time; the rest are instant functions.';
    if (d < 3) {
      const a = words(PHASES[i + 1], `${PHASES[i + 1]}_phase`);
      return walk(ask(`Which UVM common phase comes right after ${PHASES[i]}_phase?`, a, `${PHASES.join(' → ')}. build runs top-down (parents create children); the rest bottom-up; run is the only time-consuming one.`, 'build, connect, end_of_elaboration, start_of_simulation, run, extract, check, report, final.'),
        'the UVM phase order', idea,
        show(PHASES.map((p, k) => `${k + 1}. ${p}`).join('\n'), 'the common phases, in order'),
        choice('Only one of these phases consumes simulation time (the rest are instant functions). Which one?', 'run', ['build', 'connect', 'report'], 'run is where the testbench drives stimulus and time passes; everything else just sets up or reports.'),
        step(`Which phase is next after ${PHASES[i]}?`, a));
    }
    return walk(mcs(r, 'In which order are build_phase methods called?', 'Top-down: parents build their children', ['Bottom-up: drivers and monitors build first, then their agents', 'Alphabetical, by the instance names of the components', 'In parallel, in an order the simulator picks at random'], 'Test, then env, then agents, then drivers/monitors: a parent must build its children, so build_phase is top-down; connect_phase and later function phases are bottom-up.'),
      'build is top-down', idea,
      choice('A parent has to create its children in its own build_phase. So the parent\'s build must run:', 'Before its children\'s build', ['After its children\'s build', 'At the same instant']));
  },
  (r, d) => {
    const tDrop = pick(r, [500, 800, 1000]), sDrop = tDrop + pick(r, [-200, 100, 300]), drain = d > 1 ? pick(r, [50, 100]) : 0;
    const idea = 'A UVM run phase lasts as long as someone objects to it ending. Each component that wants the test to keep running raises an objection, and drops it when done. The phase ends when the objection count reaches zero (after any drain time, which lets in-flight transactions finish). So the end is the moment of the LAST drop.';
    if (d === 3 && r() < 0.5) {
      const s = pick(r, [5, 10]);
      return walk(ask(`The test raises an objection at 0 ns and drops it at 0 ns (after starting a sequence with fork/join_none). The sequence raises its own objection at ${s} ns and would finish at 900 ns. At what time does the run phase end, in ns?`, num(0), `At 0 ns the objection count is back to zero, so the run phase ends immediately and the sequence never gets to raise. Tests that "pass" in 0 ns are the classic symptom.`, 'The phase ends when the count first reaches zero.'),
        'objections ending the run phase', idea,
        choice(`At 0 ns the test drops its objection. The sequence only raises its own at ${s} ns. What is the count at 0 ns?`, 'Zero: nobody is objecting yet', ['One, the sequence is already counted', 'Undefined']),
        count('The phase ends the first time the count reaches zero, at (ns):', 'time of the first zero', 0));
    }
    const end = Math.max(tDrop, sDrop) + drain;
    return walk(ask(`run_phase objections: the test raises at 0 ns and drops at ${tDrop} ns; a sequence raises at 20 ns and drops at ${sDrop} ns.${drain ? ` Drain time is ${drain} ns.` : ''} When does the run phase end, in ns?`, num(end), `The count reaches zero at ${Math.max(tDrop, sDrop)} ns${drain ? `, then the ${drain} ns drain time lets in-flight transactions finish: ${end} ns` : ''}.`, 'Find the last drop.'),
      'objections ending the run phase', idea,
      count(`Both objections overlap from 20 ns. The count reaches zero when the later of the two drops (${tDrop} and ${sDrop} ns) happens:`, `max(${tDrop}, ${sDrop})`, Math.max(tDrop, sDrop)),
      ...(drain ? [count(`Then the drain time of ${drain} ns is waited out. The run phase ends at (ns):`, `${Math.max(tDrop, sDrop)} + ${drain}`, end)] : []));
  },
  (r, d) => {
    const a = between(r, 1, 3), p = between(r, 0, 2), extra = d > 1 ? between(r, 1, 2) : 0;
    const n = a * 4 + p * 2 + 1 + extra;
    return walk(ask(`An env holds ${a} active agent${a > 1 ? 's' : ''} (each: sequencer, driver, monitor), ${p} passive agent${p === 1 ? '' : 's'} (monitor only), a scoreboard${extra ? ` and ${extra} coverage collector${extra > 1 ? 's' : ''}` : ''}. How many uvm_components are inside the env, counting the agents themselves?`, num(n), `Active: ${a} × (agent + 3) = ${a * 4}; passive: ${p} × (agent + monitor) = ${p * 2}; scoreboard 1${extra ? `; coverage ${extra}` : ''}. Total ${n}.`, 'Count each agent plus its children.'),
      'counting components in the hierarchy', 'Every agent, sequencer, driver, monitor, scoreboard and coverage collector is its own uvm_component. The agent itself counts, plus everything inside it. An ACTIVE agent contains a sequencer, a driver and a monitor; a PASSIVE one has only a monitor. Count each group, then add.',
      count(`Each active agent is 1 (the agent) + 3 (sequencer, driver, monitor) = 4, and there are ${a}:`, `${a} × 4`, a * 4),
      ...(p > 0 ? [count(`Each passive agent is 1 + 1 (monitor) = 2, and there are ${p}:`, `${p} × 2`, p * 2)] : []),
      count(`Add the scoreboard${extra ? ' and the coverage collectors' : ''}. Total:`, `${a * 4} + ${p * 2} + 1${extra ? ` + ${extra}` : ''}`, n));
  },
  (r) => concept(r, [
    ['A test calls `set_type_override_by_type(base_drv::get_type(), err_drv::get_type())`, but the agent creates its driver with `drv = new("drv", this);`. What happens?', 'The override is ignored: only factory-created objects change', ['err_drv is created, since the override applies to every object', 'A compile error', 'Both drivers are created, one after the other, in the same agent'], 'the UVM factory', 'The factory lets a test swap one class for another without touching the testbench code, but only for objects that are created BY the factory, using type_id::create. A plain new() builds exactly the named class directly and the factory never gets a say.', ['Which creation call lets the factory substitute a different type?', 'type_id::create', ['new', 'Both equally']], 'The override is ignored: only objects created through the factory (type_id::create) can be overridden'],
    ['`uvm_config_db#(virtual bus_if)::set(this, "env.agt*", "vif", vif)` is called in the test. Can uvm_test_top.env.agt0.drv get("vif")?', 'Yes: the path is relative to the test, and * matches dots', ['No: * does not match dots, so it stops at the first level', 'Only the env can get it, and not the agents that sit in it', 'Only if the driver calls set too, with the same path as here'], 'config_db paths', 'uvm_config_db set() stores a value for every component whose hierarchical path matches a pattern, starting from the component you pass as context (here the test). The * wildcard matches any characters, dots included, so "env.agt*" covers env.agt0 and everything underneath it, such as its driver.', ['In a config_db path pattern, * matches:', 'Any characters, including dots', ['Only one letter', 'Nothing']], 'Yes: the path is relative to the test and * matches any characters, including the dots'],
    ['What is an analysis port for?', 'Broadcasting transactions from a monitor to any number of subscribers (scoreboard', ['Driving the pins of the DUT, from a sequence on a sequencer', 'A point-to-point, blocking transfer between two components only', 'Configuring the sequencer of an agent before the run phase'], 'analysis ports', 'A monitor sees every transaction on an interface and wants to share it with whoever cares (a scoreboard, a coverage collector, a logger), without knowing how many there are. An analysis port broadcasts each transaction to every subscriber connected to it, and never blocks.', ['An analysis port can feed:', 'Any number of subscribers', ['Exactly one receiver', 'Only the DUT']], 'Broadcasting transactions from a monitor to any number of subscribers (scoreboard, coverage) without knowing who they are'],
    ['Order of the sequence/driver handshake?', 'start_item, randomize, finish_item; get_next_item, drive, item_done', ['The driver calls start_item, and the sequence calls get_next_item', 'The driver calls start_item, and then the sequence calls get_next_item', 'The monitor calls item_done, once it has seen the item on the bus'], 'the sequence-driver handshake', 'The sequence creates an item, calls start_item (asks the sequencer for a turn), randomizes it, then finish_item (hands it over). The driver calls get_next_item to receive it, drives the pins, and calls item_done to say it is finished. Each side has its own matching calls.', ['Who calls start_item and finish_item?', 'The sequence', ['The driver', 'The monitor']], 'Sequence: start_item → (randomize) → finish_item; driver: get_next_item → drive → item_done'],
    ['What is a virtual sequence for?', 'Coordinating sequences on several sequencers', ['Running a test without a DUT, with only the testbench in place', 'Replacing the driver of an agent with a software model of it', 'Only for register tests'], 'virtual sequences', 'A normal sequence runs on one sequencer, feeding one interface. A scenario like "CPU writes while the DMA moves data" needs traffic on several interfaces in a coordinated way. A virtual sequence runs on no particular sequencer and starts ordinary sequences on each of the real ones.', ['A scenario needs traffic on two different interfaces. You need:', 'A virtual sequence to coordinate both', ['Two separate tests', 'A scoreboard']], 'Coordinating sequences on several sequencers (e.g. CPU and DMA traffic together)'],
    ['Where does the virtual interface come from in a driver?', 'The top module sets it in uvm_config_db; the driver gets it in build/connect phase', ['The driver instantiates the interface by itself in its constructor', 'It is a global variable, which every component can read directly', 'The factory creates it, when the driver itself is created'], 'virtual interfaces', 'Pins live in a module-world interface created in the top-level testbench module, but the UVM classes are in class-world and cannot reach it directly. The top module stores a handle to it (a virtual interface) in uvm_config_db, and the driver fetches it from there during build or connect.', ['The interface is instantiated in:', 'The top-level module, not in the driver', ['The driver', 'The factory']], 'The top module sets it in uvm_config_db; the driver gets it in build/connect phase'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ SVA

function svaTrace(r: Rng, d: 1 | 2 | 3) {
  const N = 12;
  const opts: [number, number, string][][] = [
    [[0, 0, 'req |-> ack'], [1, 1, 'req |=> ack']],
    [[2, 2, 'req |-> ##2 ack'], [1, 3, 'req |-> ##[1:3] ack'], [1, 2, 'req |=> ##[0:1] ack']],
    [[1, 3, '$rose(req) |-> ##[1:3] ack'], [0, 2, '$rose(req) |-> ##[0:2] ack'], [2, 2, '$rose(req) |=> ##1 ack']],
  ];
  const [m, n, text] = pick(r, opts[d - 1]);
  const req = Array.from({ length: N }, (_, t) => (t > 0 && t < N - 4 && r() < (d === 3 ? 0.5 : 0.3) ? 1 : 0));
  if (!req.some((x) => x)) req[between(r, 1, 5)] = 1;
  const ack = Array.from({ length: N }, () => (r() < 0.4 ? 1 : 0));
  const rose = d === 3;
  const ante = req.map((x, t) => (rose ? x === 1 && (t === 0 ? true : req[t - 1] === 0) : x === 1));
  if (r() < 0.35) for (const a of attempts(ante, ack, m, n)) if (!a.ok) ack[a.t + m] = 1;
  return { req, ack, ante, m, n, text, all: attempts(ante, ack, m, n) };
}

const SVA_IDEA = 'A property "A |-> B" is checked by starting an ATTEMPT at every clock cycle where the left side A (the antecedent) is true. Each attempt then needs B to hold: |-> means from the same cycle, |=> from the next cycle, ##n after n more cycles, and ##[m:n] at some cycle between m and n later. If A is false, the attempt is skipped and passes vacuously (it checked nothing). $rose(x) is true when x is 1 now and was 0 on the previous cycle.';

export const svaPractice = practice('practice-sva', 'Assertion Drills', 'evaluate SVA properties on waveforms, $rose, $past, vacuity', [
  (r, d) => {
    const s = svaTrace(r, d);
    const fail = s.all.find((a) => !a.ok);
    const expl = s.all.map((a) => `${a.t} ${a.ok ? '✓' : '✗'}`).join(', ');
    const a = fail ? num(fail.t) : NONE;
    const win = s.m === s.n ? `cycle ${s.m} after the start` : `some cycle from ${s.m} to ${s.n} after the start`;
    return walk(ask(`\`assert property (@(posedge clk) ${s.text});\`${waveform([['req', s.req], ['ack', s.ack]])}At which cycle does the first FAILING attempt start? (Type "none" if it never fails.)`, a, `Attempts start at every cycle where the antecedent${d === 3 ? ' ($rose: req is 1 now and was 0 the cycle before)' : ''} holds: ${expl}. Each needs ack at offset ${s.m === s.n ? s.m : `${s.m} to ${s.n}`}.${fail ? ` First failure: the attempt from cycle ${fail.t}.` : ' None fail.'}`, `|-> checks from the same cycle, |=> from the next; ##[m:n] means some cycle in that window.`),
      'evaluating an assertion on a waveform', SVA_IDEA,
      step(`${d === 3 ? 'The antecedent $rose(req) is true where req is 1 and was 0 the cycle before.' : 'The antecedent req is true where req is 1.'} Write the cycles where an attempt starts, separated by commas:`, exact(s.all.map((x) => x.t).join(', '), s.all.map((x) => x.t).join(','))),
      ...s.all.map((x) => choice(`The attempt from cycle ${x.t} needs ack at ${win}, meaning cycle${s.m === s.n ? ` ${x.t + s.m}` : `s ${x.t + s.m} to ${x.t + s.n}`}. Does it get it?`, x.ok ? 'Yes: the attempt passes' : 'No: the attempt fails', [x.ok ? 'No: the attempt fails' : 'Yes: the attempt passes'])),
      step('The start cycle of the first failing attempt (or "none"):', a));
  },
  (r, d) => {
    const s = svaTrace(r, d);
    const k = s.all.length, bad = s.all.filter((a) => !a.ok).length;
    const askFails = d > 1 && r() < 0.5;
    const win = s.m === s.n ? `cycle ${s.m} after the start` : `some cycle from ${s.m} to ${s.n} after the start`;
    return walk(ask(`\`${s.text}\`${waveform([['req', s.req], ['ack', s.ack]])}How many ${askFails ? 'attempts fail' : 'attempts start (cycles where the antecedent is true)'}?`, num(askFails ? bad : k), `Antecedent true at cycles ${s.all.map((a) => a.t).join(', ')} (${k} attempt${k === 1 ? '' : 's'}); ${bad} fail. Every other cycle is a vacuous success: the property "passes" without checking anything.`, askFails ? 'Check each attempt\'s window.' : 'Count the cycles where the left side is true.'),
      askFails ? 'counting failing attempts' : 'counting attempts', SVA_IDEA,
      step(`${d === 3 ? '$rose(req): req is 1 and was 0 before.' : 'req is 1.'} The cycles where an attempt starts:`, exact(s.all.map((x) => x.t).join(', '), s.all.map((x) => x.t).join(','))),
      ...(askFails ? s.all.map((x) => choice(`Attempt from cycle ${x.t}: is ack seen at ${win}?`, x.ok ? 'Yes: it passes' : 'No: it fails', [x.ok ? 'No: it fails' : 'Yes: it passes'])) : []),
      count(askFails ? 'How many of those attempts fail?' : 'How many attempts is that?', askFails ? 'failing attempts' : 'number of start cycles', askFails ? bad : k));
  },
  (r, d) => {
    const x = Array.from({ length: 10 }, () => between(r, 0, 9));
    const k = tier(d, 1, 2, 3), t = between(r, k + 1, 9);
    return walk(ask(`${waveform([['x', x]])}What is \`$past(x, ${k})\` evaluated at cycle ${t}?`, num(x[t - k]), `$past(x, ${k}) is x from ${k} cycle${k > 1 ? 's' : ''} earlier: cycle ${t - k}, value ${x[t - k]}.`, 'Look back that many cycles.'),
      '$past: looking back in time', '$past(x, n) gives the value x had n clock cycles earlier than the cycle being checked. It is how an assertion compares the present with the past. To evaluate it, go to the cycle in question, step back n columns in the waveform, and read x there.',
      count(`The cycle in question is ${t}. ${k} cycle${k > 1 ? 's' : ''} earlier is cycle:`, `${t} - ${k}`, t - k),
      count(`The value of x at cycle ${t - k}, read from the waveform:`, `x[${t - k}]`, x[t - k]));
  },
  (r) => concept(r, [
    ['Difference between `a |-> b` and `a |=> b`?', '`|->` checks b the same cycle; `|=>` the next cycle', ['None: the two operators mean the same, with a different spelling', '`|=>` is for formal tools only', '`|->` checks b before a'], 'overlapping and non-overlapping implication', 'Both mean "if a happens, then b must follow". The difference is timing: |-> is overlapping, so b is checked in the SAME cycle a is true; |=> is non-overlapping, so b is checked one cycle LATER. So a |=> b is the same as a |-> ##1 b.', ['a |=> b checks b in:', 'The cycle after a', ['The same cycle as a', 'The cycle before a']], '|-> checks b in the same cycle as a; |=> checks b one cycle later (same as |-> ##1 b)'],
    ['What does `$rose(req)` mean at cycle t?', 'req is 1 at t and was 0 at t-1', ['req is 1 at t, whatever the value was in the cycle before it', 'req changed in either direction between the cycle before and t', 'req will be 1 at t+1'], '$rose', '$rose(x) detects a rising edge as seen by the clock: x is 1 now and was 0 on the previous clock cycle. Both values are sampled at clock edges, so it cannot see glitches between edges. ($fell is the opposite; $changed is either.)', ['$rose(req) is true when req:', 'Was 0 last cycle and is 1 now', ['Is 1', 'Is 0']], 'req is 1 at t and was 0 at t-1 (sampled values)'],
    ['An assertion never fails in a 1-hour regression. What must you also check?', 'That its antecedent fired: add a cover, or it may be vacuous', ['Nothing more, since a passing assertion is proven to be correct', 'That the simulator is licensed for assertions in this version', 'That it is written with |=> rather than with |-> in the sequence'], 'vacuous passes', 'If the left side of an implication is never true, every attempt is skipped and the assertion "passes" without ever checking anything. To make sure it is really exercised, add a cover property for the antecedent and check that it was hit.', ['If the antecedent is never true, the assertion:', 'Passes vacuously, having checked nothing', ['Fails', 'Checks the consequent anyway']], 'That its antecedent actually fired: add a cover property, or it may be passing vacuously'],
    ['What does `disable iff (!rst_n)` do?', 'Stops and discards checking while reset is active', ['Disables the clock of the design while the reset is active', 'Makes the assertion an assumption, for the formal tool to use', 'Checks only during reset'], 'disable iff', 'During reset, signals are in unusual states and most properties do not apply. "disable iff (condition)" switches the assertion off while the condition is true and abandons any attempt in progress, so reset does not produce false failures.', ['With disable iff (!rst_n), checking is off while:', 'Reset is active', ['Reset is released', 'The clock is low']], 'Stops (and discards) checking while reset is active, so reset behavior does not cause false failures'],
    ['`req ##1 gnt[*3]` means?', 'req, then gnt high for 3 consecutive cycles from the next one', ['gnt at some point within three cycles after req has been seen', 'req three times in a row, then gnt on the cycle after those', 'gnt at any time in the next three cycles, and then it stays low'], 'sequences and repetition', 'A sequence strings conditions along the clock. ##1 means "one cycle later", and x[*3] means x is true for 3 consecutive cycles. So req, then next cycle gnt is true and stays true for three cycles in a row.', ['gnt[*3] means gnt is true:', 'On 3 consecutive cycles', ['Once, within 3 cycles', 'Three times in total, anywhere']], 'req, then gnt high for 3 consecutive cycles starting the next cycle'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ formal

export const formalPractice = practice('practice-formal', 'Formal Drills', 'state spaces, BMC depth, vacuity, equivalence, induction', [
  (r, d) => {
    const n = pick(r, tier(d, [8, 10, 16], [32, 40, 64], [100, 128, 256]));
    const s = 2 ** n;
    const disp = n <= 16 ? String(s) : sci(s, 2);
    return walk(ask(`A block has ${n} flip-flops. At most how many states can it be in?`, qty(s, '', 0.03, disp), `2^${n} = ${n <= 16 ? s : sci(s, 2)}. Simulation can never visit them all; formal tools reason about them symbolically instead.`, 'Each flop doubles it.'),
      'the size of a state space', 'The state of a design is the combination of all its flip-flop values. Each flop is 0 or 1, so every extra flop DOUBLES the number of possible states: n flops give 2^n. The count explodes quickly, which is why simulation can never visit them all and formal tools reason about huge sets of states at once.',
      calc(`Each of the ${n} flops has 2 values, so the number of states is 2 to the power ${n}:`, `2^${n}`, s, '', disp, 0.03));
  },
  (r, d) => {
    if (d < 3) {
      const k = d === 1 ? 1 : pick(r, [2, 3, 4]), v = k * between(r, 5, 40);
      return walk(ask(`After reset a counter is 0 and adds ${k} every cycle. A bug triggers when it equals ${v}. What is the minimum BMC depth (cycles after reset) that can find it?`, num(v / k), `${v}/${k} = ${v / k} cycles. Bounded model checking explores every input sequence up to that depth.`, 'How many increments to reach it?'),
        'bounded model checking depth', 'Bounded model checking (BMC) unrolls the design for a fixed number of cycles after reset and asks a solver whether any input sequence within that depth can break the property. So a bug can only be found if the depth is AT LEAST the number of cycles needed to reach it.',
        count(`The counter adds ${k} per cycle, starting at 0. Cycles to reach ${v}:`, `${v} / ${k}`, v / k));
    }
    const a = pick(r, [4, 6, 8, 9]), b = pick(r, [10, 12, 15]);
    return walk(ask(`Two free-running counters start at 0 together: one counts modulo ${a}, the other modulo ${b}. A bug needs both to be 0 again at the same time. After how many cycles?`, num(lcm(a, b)), `lcm(${a}, ${b}) = ${lcm(a, b)}. Deep, rare states like this are where formal beats random simulation.`, 'Least common multiple.'),
      'deep states and the least common multiple', 'The first counter is 0 at every multiple of its period, the second at every multiple of its own. Both are 0 at the same time at a common multiple of the two periods, and the first time that happens is the LEAST common multiple. Such a deep, rare state is easy to miss with random simulation but reachable for formal tools.',
      choice('The first time both counters are 0 again is the:', 'Least common multiple of the two periods', ['Sum of the periods', 'Greatest common divisor']),
      count(`Smallest number divisible by both ${a} and ${b}:`, `lcm(${a}, ${b})`, lcm(a, b)));
  },
  (r) => concept(r, [
    ['A proof passes instantly. The environment has `assume property (!valid_in);`. What went wrong?', 'The assumption over-constrains: valid never arrives', ['Nothing: the design is correct, and the tool is just very quick', 'The tool crashed, and reported a pass in place of the error', 'Formal cannot handle valid signals, so it skips all of the checks'], 'over-constraining', 'An assumption tells the tool to only consider input behaviour that obeys it. "valid_in is never true" removes all real traffic, so nothing interesting can ever happen, and every assertion holds vacuously. A proof that finishes suspiciously fast usually means the environment is over-constrained.', ['With valid_in never true, the design:', 'Never sees any real input, so nothing can fail', ['Sees all inputs', 'Crashes']], 'The assumption over-constrains the inputs: valid never arrives, so every assertion passes vacuously'],
    ['What does a bounded proof of depth 30 guarantee?', 'No failure within 30 cycles of reset, and nothing beyond', ['The property holds forever, for all of the reachable states', 'Nothing at all, because a bounded proof is not a real result', 'The design is equivalent to the RTL, up to the depth of 30'], 'what a bounded proof means', 'A bounded proof checks all input sequences up to a fixed length. It says no violation exists within those cycles after reset, but a bug needing 31 cycles would be missed. Only a full proof (for example by induction) covers every depth.', ['A bug that needs 31 cycles to appear, against a depth-30 proof:', 'Is not covered by the proof', ['Is always found', 'Cannot exist']], 'No failure is reachable within 30 cycles of reset, and nothing beyond that'],
    ['What does logical equivalence checking (LEC) compare?', 'Two versions of a design, at matched flops and outputs', ['The timing of two netlists, path by path', 'Two testbenches', 'Coverage databases from two regressions, bin by bin for each'], 'equivalence checking', 'After synthesis the netlist should do exactly what the RTL did. LEC proves this mathematically: it matches the flip-flops and outputs of the two versions and checks that the logic feeding each pair is equivalent for all inputs, without simulating anything.', ['LEC checks that two versions of a design:', 'Compute the same logic at matched points', ['Have the same timing', 'Have the same size']], 'Two versions of a design (e.g. RTL vs netlist) at matched key points: flops and outputs'],
    ['Why write `cover property` in a formal setup?', 'To prove the interesting scenarios are reachable under the assumptions', ['To collect functional coverage for the simulation runs only', 'To make the proofs run faster, by guiding the engine to them', 'Cover is the same as assert, and is only a different keyword'], 'covers as a sanity check', 'An assert says "this never happens". A cover asks "can this happen?" and the tool finds an example, or proves it impossible. Covering the interesting scenarios shows the assumptions have not shut the design off, which would make the proofs meaningless.', ['If a cover of a normal scenario is unreachable, the assumptions may be:', 'Too strong (over-constraining)', ['Too weak', 'Perfect']], 'To prove the interesting scenarios are reachable under the assumptions (a sanity check against over-constraint)'],
    ['Induction (k-induction) can prove a property for all depths. What often makes it fail spuriously?', 'Unreachable start states: add helper invariants (lemmas)', ['Too many assumptions', 'Too few flops in the design, so there is not enough state', 'Using |=> in the property, rather than the overlapped form'], 'induction and helper invariants', 'Induction proves the step "if the property holds now, it holds next cycle" starting from ANY state, including ones the design can never actually reach. A failure from such an impossible starting state is spurious. Adding helper invariants (facts that are always true) rules those states out.', ['A spurious induction failure often starts from a state that is:', 'Unreachable in real operation', ['The reset state', 'Always valid']], 'Unreachable starting states: add helper invariants (lemmas) that rule them out'],
    ['In formal verification of a block, properties about its inputs should be…', 'Assumptions; properties about its outputs are assertions', ['Assertions, since inputs are the thing that must be proven', 'Covers, since inputs are only ever checked for reachability', 'Ignored, because the tool works out the inputs by itself'], 'assume versus assert', 'Formal treats the block\'s surroundings as free inputs. What the environment promises about the inputs is ASSUMED (constrain the tool to those behaviours); what the block must guarantee about its outputs is ASSERTED (the tool tries to break it).', ['Promises the environment makes about inputs are:', 'Assumptions', ['Assertions', 'Covers']], 'Assumptions (constraints on the environment); properties about its outputs are assertions'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ DFT

const TAP: [string, string, string, string][] = [
  ['Test-Logic-Reset', 'Shift-DR', '0100', 'Test-Logic-Reset -0-> Run-Test/Idle -1-> Select-DR-Scan -0-> Capture-DR -0-> Shift-DR'],
  ['Test-Logic-Reset', 'Shift-IR', '01100', 'Test-Logic-Reset -0-> Run-Test/Idle -1-> Select-DR-Scan -1-> Select-IR-Scan -0-> Capture-IR -0-> Shift-IR'],
  ['Run-Test/Idle', 'Shift-DR', '100', 'Run-Test/Idle -1-> Select-DR-Scan -0-> Capture-DR -0-> Shift-DR'],
  ['Run-Test/Idle', 'Shift-IR', '1100', 'Run-Test/Idle -1-> Select-DR-Scan -1-> Select-IR-Scan -0-> Capture-IR -0-> Shift-IR'],
  ['Shift-DR', 'Update-DR', '11', 'Shift-DR -1-> Exit1-DR -1-> Update-DR'],
  ['Shift-DR', 'Run-Test/Idle', '110', 'Shift-DR -1-> Exit1-DR -1-> Update-DR -0-> Run-Test/Idle'],
];

export const dftPractice = practice('practice-dft', 'Test Drills', 'stuck-at tests, fault coverage, scan time, defect level, MBIST, JTAG', [
  (r, d) => {
    const gate = pick(r, d === 3 ? ['AND3', 'OR3', 'NAND3', 'NOR3'] : ['AND', 'OR', 'NAND', 'NOR']);
    const n = d === 3 ? 3 : 2, names = ['A', 'B', 'C'].slice(0, n);
    const pin = d === 1 ? 0 : between(r, 0, n - 1), sv = between(r, 0, 1);
    const nc = gate.startsWith('AND') || gate.startsWith('NAND') ? 1 : 0;
    const v = names.map((_, i) => (i === pin ? 1 - sv : nc)).join('');
    const a = exact(v);
    return walk(ask(`Which input vector (${names.join('')}) detects input ${names[pin]} stuck-at-${sv} on a ${n}-input ${gate.replace(/\d$/, '')} gate?`, a, `Activate the fault: drive ${names[pin]} to ${1 - sv}. Propagate it: hold the other input${n > 2 ? 's' : ''} at the non-controlling value (${nc} for ${nc ? 'AND/NAND' : 'OR/NOR'}). Vector ${v}: the good and faulty outputs differ.`, 'Set the pin opposite to the stuck value; others to the non-controlling value.'),
      'finding a test vector for a stuck-at fault', 'A stuck-at fault means a pin is permanently stuck at 0 or 1. To detect it you need a test vector that (1) ACTIVATES the fault: drives the pin to the OPPOSITE of the stuck value, so the good and the faulty circuit differ there; and (2) PROPAGATES the difference to the output: the other inputs are held at the non-controlling value (1 for AND/NAND, 0 for OR/NOR), which lets the pin decide the output.',
      choice(`To activate "${names[pin]} stuck-at-${sv}", drive ${names[pin]} to:`, String(1 - sv), [String(sv)], 'If it is stuck at the value you drive, nothing looks different.'),
      choice(`For ${gate.replace(/\d$/, '')}, the other input${n > 2 ? 's' : ''} must be held at (the non-controlling value):`, String(nc), [String(1 - nc)], nc ? 'A 0 on an AND would force the output to 0 whatever the pin does.' : 'A 1 on an OR would force the output to 1 whatever the pin does.'),
      step(`Write the vector in the order ${names.join('')}:`, a));
  },
  (r, d) => {
    if (d < 3) {
      const tot = pick(r, [20000, 50000, 100000]), det = tot - between(r, 100, tot / 20);
      return walk(ask(`ATPG detects ${det.toLocaleString('en-US')} of ${tot.toLocaleString('en-US')} stuck-at faults. Fault coverage, in %?`, qty((det / tot) * 100, '%', 0.001, sig((det / tot) * 100, 4)), `${det}/${tot} = ${sig((det / tot) * 100, 4)}%. Production usually wants 99%+ for stuck-at.`, 'Detected / total.'),
        'fault coverage', 'Fault coverage says how much of the list of possible faults the test patterns can detect: detected faults ÷ total faults, as a percentage. Production test aims for well over 99% of stuck-at faults.',
        calc('Detected ÷ total, as a %:', `${det} / ${tot} × 100`, (det / tot) * 100, '%', sig((det / tot) * 100, 4), 0.001));
    }
    const Y = pick(r, [0.8, 0.85, 0.9]), T = pick(r, [0.98, 0.99, 0.995]);
    const DL = 1 - Y ** (1 - T);
    return walk(ask(`Yield Y = ${Y * 100}%, fault coverage T = ${T * 100}%. Using Williams-Brown, DL = 1 - Y^(1-T), how many defective parts per million ship?`, qty(DL * 1e6, '', 0.02, sig(DL * 1e6)), `1 - ${Y}^${sig(1 - T)} = ${sig(DL)} → ${sig(DL * 1e6)} DPPM. Automotive targets are near 1 DPPM, which is why coverage must approach 100%.`, 'Compute Y^(1-T) and subtract from 1.'),
      'defect level (Williams-Brown)', 'Some defective chips slip through because the test does not detect every possible fault. The Williams-Brown model estimates the defect level as DL = 1 - Y^(1 - T), where Y is the manufacturing yield (fraction of good chips) and T is the fault coverage (both as fractions, not percentages). Multiply by a million to get defective parts per million (DPPM).',
      calc('The exponent 1 - T:', `1 - ${T}`, 1 - T, '', sig(1 - T, 4), 0.005),
      calc('Y raised to that power:', `${Y}^${sig(1 - T, 4)}`, Y ** (1 - T), '', sig(Y ** (1 - T), 7), 0.0005),
      calc('DL = 1 minus that, times a million (DPPM):', `(1 - ${sig(Y ** (1 - T), 7)}) × 1,000,000`, DL * 1e6, '', sig(DL * 1e6), 0.02));
  },
  (r, d) => {
    const F = pick(r, [100000, 500000, 2000000]), C = pick(r, [100, 200, 400, 800]);
    const L = Math.ceil(F / C);
    const idea = 'In scan test, all the flip-flops are linked into chains that act as long shift registers. To load a test pattern, you shift it in: one bit per clock into every chain at once. So the time to load a pattern is the length of the longest chain (flops ÷ number of chains, rounded up). After the load comes one capture cycle, and the result is shifted out while the next pattern shifts in.';
    if (d === 1) return walk(ask(`${F.toLocaleString('en-US')} scan flops are split evenly into ${C} chains. How many shift cycles to load one pattern?`, num(L), `⌈${F}/${C}⌉ = ${L} cycles. More chains, shorter shifts, but each chain needs a pin (or a compressor).`, 'Flops per chain.'),
      'scan chain length', idea,
      calc('Flops per chain, flops ÷ chains:', `${F} / ${C}`, F / C, '', sig(F / C, 6), 0.001),
      count('Round up to whole flops. Shift cycles per pattern:', `ceil(${sig(F / C, 6)})`, L));
    const P = pick(r, [5000, 10000, 20000]), f = pick(r, [25, 50, 100]);
    const cyc = P * (L + 1) + L;
    return walk(ask(`Chains are ${L} flops long. ${P.toLocaleString('en-US')} patterns, each one shift plus one capture cycle, with the unload of one pattern overlapping the load of the next. Scan clock ${f} MHz. Test time, in ms?`, qty((cyc / (f * 1e6)) * 1000, 'ms', 0.02), `Cycles ≈ P·(L + 1) + L = ${cyc.toLocaleString('en-US')} → ${sig((cyc / (f * 1e6)) * 1000)} ms. Tester time is money: that is what compression is for.`, 'P × (L + 1) + L cycles, divided by the clock.'),
      'scan test time', `${idea} Because unloading overlaps the next load, each pattern costs (L shift cycles + 1 capture cycle), plus one extra unload of length L at the very end.`,
      count(`Each pattern costs L + 1 = ${L} + 1 cycles. For ${P} patterns, plus one final unload of ${L} cycles, total cycles:`, `${P} × (${L} + 1) + ${L}`, cyc),
      calc('Time = cycles ÷ clock frequency, in ms:', `${cyc} / (${f} × 10^6) × 1000`, (cyc / (f * 1e6)) * 1000, 'ms', sig((cyc / (f * 1e6)) * 1000), 0.02));
  },
  (r, d) => {
    const N = pick(r, [64, 256, 1024]) * 1024, f = pick(r, [200, 500, 1000]);
    const ops = tier(d, 4, 10, 10);
    const name = tier(d, 'MATS (4N)', 'March C- (10N)', 'March C- (10N)');
    const banks = d === 3 ? pick(r, [2, 4]) : 1;
    const t = (ops * N) / banks / (f * 1e6);
    return walk(ask(`MBIST runs ${name} on a ${N >= 1048576 ? `${N / 1048576}M` : `${N / 1024}K`}-word SRAM at ${f} MHz${banks > 1 ? `, testing ${banks} equal banks in parallel` : ''}. Test time, in ms?`, qty(t * 1000, 'ms', 0.02), `${ops}N = ${ops * N} operations${banks > 1 ? ` / ${banks}` : ''} at ${f} MHz = ${sig(t * 1000)} ms. March tests catch stuck-at, transition and many coupling faults in the array.`, 'Operations = k × N; divide by frequency.'),
      'memory BIST test time', 'MBIST is a little on-chip engine that tests an SRAM by marching through it. A March test is named for how many operations it does per word: "10N" means 10 reads/writes for each of the N words. Total operations = k × N; if banks are tested in parallel, divide by the number of banks; then divide by the clock rate to get time.',
      count(`${name.split(' ')[0]} does ${ops} operations per word, and there are ${N.toLocaleString('en-US')} words. Operations:`, `${ops} × ${N}`, ops * N),
      ...(banks > 1 ? [count(`${banks} banks are tested at the same time, so the sequential operations are divided by ${banks}:`, `${ops * N} / ${banks}`, (ops * N) / banks)] : []),
      calc(`Time = operations ÷ clock (${f} MHz), in ms:`, `${(ops * N) / banks} / (${f} × 10^6) × 1000`, t * 1000, 'ms', sig(t * 1000), 0.02));
  },
  (r, d) => {
    if (d === 1) return walk(ask('From any TAP state, how many clocks with TMS = 1 guarantee you reach Test-Logic-Reset?', num(5), 'Five TMS = 1 clocks reach Test-Logic-Reset from any of the 16 states. That is how a tester recovers the TAP no matter what.', 'It is the longest escape path.'),
      'the JTAG TAP reset', 'The JTAG test access port is a 16-state machine driven by just one input, TMS, sampled on each TCK. Holding TMS at 1 always moves the machine toward the reset state: from the deepest place (inside a shift state) it takes 5 clocks to get all the way out. So five 1s guarantee a known starting point.',
      count('The longest route back to Test-Logic-Reset with TMS = 1 takes how many clocks?', 'longest escape path', 5));
    const [from, to, seq, path] = pick(r, TAP);
    const a = exact(seq);
    return walk(ask(`JTAG TAP: which TMS sequence (one bit per TCK) goes from ${from} to ${to}?`, a, `${from} → ${to}: TMS ${seq.split('').join(', ')}. From Run-Test/Idle, 1 goes to Select-DR-Scan, another 1 to Select-IR-Scan, then 0 to Capture, 0 to Shift.`, 'Draw the TAP state diagram: 1 moves toward the IR side and exits, 0 goes deeper.'),
      'walking the JTAG state machine', 'The TAP is a state machine with two arrows out of every state, one for TMS = 0 and one for TMS = 1. To get from one state to another, follow the arrows along the route and write down the TMS value on each arrow. Shift states are entered through a Select and a Capture state; you leave them through Exit1 and Update.',
      ...sim((() => { const parts = path.split(/ -([01])-> /); return Array.from({ length: (parts.length - 1) / 2 }, (_, i) => ({ beats: [choice(`Hop ${i + 1}: from ${parts[2 * i]} the machine must move to ${parts[2 * i + 2]}. Which TMS value takes that arrow?`, parts[2 * i + 1], [parts[2 * i + 1] === '0' ? '1' : '0'], 'Every state has exactly one arrow for TMS = 0 and one for TMS = 1.')], row: `${parts[2 * i]} -${parts[2 * i + 1]}-> ${parts[2 * i + 2]}` })); })(), 4, `the route from ${from} to ${to}, TMS value on each arrow`),
      step('Write the TMS values along that route, in order:', a));
  },
  (r) => concept(r, [
    ['Why do transition-delay faults need at-speed testing?', 'Slow-to-rise/fall defects need launch and capture one period apart', ['They are the same as stuck-at faults, so no special test is needed', 'Tester clocks are too fast to apply the pattern in the right way', 'They only occur in SRAM cells, which are tested with march tests'], 'at-speed testing', 'A stuck-at fault is always wrong, so a slow test finds it. A transition-delay fault is a defect that makes a signal change too SLOWLY: it still gets there, just late. To catch it, the test must launch a change and capture the result after exactly one real (fast) clock period, so a late signal is seen as wrong.', ['A slow-to-rise defect makes a signal arrive:', 'Late, not never', ['Never', 'Early']], 'They model slow-to-rise/fall defects, so the launch and capture must be one functional clock period apart'],
    ['What does scan compression do?', 'Fans a few pins out to many short chains via a decompressor', ['Compresses the netlist, so that the scan logic takes up less area', 'Removes flops from the scan chains, to make them shorter in use', 'Speeds up the functional clock, so the test is over more quickly'], 'scan compression', 'A chip may have millions of flops but only a few test pins. Compression splits the flops into many short internal chains, fed by a decompressor that expands a few pins into many chains, and compacts the results back down. Shorter chains mean far less shifting, and less data to store.', ['Shorter internal chains mean:', 'Fewer shift cycles per pattern', ['More shift cycles', 'No shifting']], 'Feeds many short internal chains from a few tester pins through a decompressor, and compacts the outputs, cutting test time and data'],
    ['What does scan insertion change in each flop?', 'Adds a mux to load from the previous flop in shift mode', ['Removes the clock input', 'Doubles its size', 'Nothing, since the scan chain is built outside of the flops'], 'scan flops', 'A scan flop has a small mux in front of it. In normal mode it takes its usual data input; in scan (shift) mode it takes the output of the previous flop in the chain instead. Linking all the flops this way turns them into a giant shift register that a tester can load and read.', ['In shift mode a scan flop loads its data from:', 'The previous flop in the chain', ['Its functional input', 'The clock']], 'Adds a mux so it can load from the previous flop in the chain (shift mode) instead of its functional input'],
    ['Why is logic BIST (LBIST) used in cars?', 'The chip can test itself in the field, at key-on', ['It replaces ATPG completely, so no patterns are needed at all', 'It is faster than scan on the tester, so the cost per part drops', 'It tests the SRAM only, which is the part with the most faults'], 'logic BIST', 'Logic BIST puts a pattern generator and a signature checker on the chip itself, so it can test its own logic without a tester. A car can run it every time the key is turned, which finds faults that appear during its life, as safety standards require.', ['LBIST lets a chip test itself:', 'Without an external tester, even in the field', ['Only in the factory', 'Only with a tester']], 'The chip can test itself in the field (at key-on), which safety standards require'],
  ], (why) => `${why}.`),
]);

export const VERIFICATION_PRACTICE = [dvPractice, crvPractice, covPractice, uvmPractice, svaPractice, formalPractice, dftPractice];

// ------------------------------------------------------------------ bosses

export const tbBoss = boss({
  id: 'boss-tb',
  title: 'The Silent Scoreboard',
  concept: 'find why a green regression missed a real bug',
  xp: 200,
  steps: [
    say('Boss fight, {name}. The packet engine\'s regression has been 100% green for three months. First silicon just came back corrupting packets. Management wants to know how the testbench missed it. Exam rules.', 'concerned'),
    art(`function void check_phase(uvm_phase phase);
  foreach (actual_q[i])
    if (actual_q[i].compare(expected_q[i]) == 0)
      \`uvm_error("SB", "mismatch")
endfunction`),
    { t: 'gen', make: () => ask('You discover the monitor\'s analysis port was never connected to the scoreboard. How many comparisons did the scoreboard perform per test?', num(0), 'actual_q was always empty, so the foreach ran zero times and nothing could fail. Every "pass" meant nothing.') },
    mc('Which check would have caught this on day one?', ['An end-of-test check that sent equals compared, with both queues empty', 'A much longer timeout, so the scoreboard waits for every last packet to arrive', 'More random seeds, so that a late packet is eventually seen by the checker', 'Waveform dumping turned on for every transaction in the whole run'], 0, 'At the end of the test, require that the number of compared transactions equals the number sent, and that both queues are empty. A scoreboard must prove it did work: count checks, and fail on leftovers or zero.'),
    mc('After connecting it, 1000 packets are expected but 998 arrive. The loop above reports…', ['Nothing: it only walks actual_q, so the 2 missing are never seen', 'Two mismatches, one reported for each of the missing packets in the queue', 'A fatal error, because the queue sizes disagree at the end', '998 mismatches, since every later packet is shifted by two places'], 0, 'The loop only iterates over actual_q, so the 2 missing packets are never reported. Loop bounds hide missing items. Check the queue sizes explicitly.'),
    mc('The DUT legally reorders packets between its two output ports. The in-order scoreboard now fails. Right fix?', ['Match by packet ID, in an associative array', 'Sort both queues by arrival time at the end of the test', 'Disable the scoreboard on the port that reorders packets', 'Send only one packet at a time so order cannot differ'], 0, 'Store expected items in an associative array keyed by ID, and remove them as they arrive. Out-of-order scoreboards match on a key, then check leftovers at the end.'),
    { t: 'gen', make: () => ask('The reference model computes an 8-bit additive checksum (sum mod 256). For payload bytes 0x12, 0xF0, 0x33, 0x80, what is it (hex)?', hexa(0xb5, 2), '0x12 + 0xF0 + 0x33 + 0x80 = 0x1B5 → 0xB5 modulo 256.') },
    mc('Who should write that reference model?', ['A verification engineer working from the spec, independently', 'The RTL designer, translating their own RTL line by line into a model', 'Nobody: the checker should compare against the RTL itself', 'The synthesis tool, as part of generating the gate-level netlist'], 0, 'Independence is the point: a copied misunderstanding passes every check.'),
  ],
  recap: ['A scoreboard must count its checks.', 'Report missing and leftover items.', 'Out-of-order matching by key.', 'Independent reference models.'],
});

export const debugBoss = boss({
  id: 'boss-debug',
  title: 'The Heisenbug',
  concept: 'waveform debug, races and X-optimism',
  xp: 200,
  steps: [
    say('Boss fight. A counter "sometimes" skips a value. The bug disappears when you add $display statements. Classic. Exam rules.', 'thinking'),
    art(`count increments on each clock edge where en was 1 (count[t+1] = count[t] + en[t])

cycle   0  1  2  3  4  5  6  7  8  9
en      1  1  1  0  1  1  1  1  0  1
count   0  1  2  3  3  4  5  7  8  8`),
    { t: 'gen', make: () => ask('At which cycle does count first show a wrong value?', num(7), 'Expected: 0 1 2 3 3 4 5 6 7 7. Cycle 7 shows 7 instead of 6; everything after is off by one.') },
    art(`always @(posedge clk) begin
  tmp = a + b;       // blocking
  y  <= tmp;
end
always @(posedge clk) z <= tmp;`),
    mc('What does z get on each edge?', ['Either the old or the new tmp, depending on which always block the simulator runs first: a race', 'Always the new tmp, because blocking writes are applied before the edge', 'Always the old tmp, because the clock edge samples values first', 'X, since two always blocks end up driving the same variable'], 0, 'It depends on which always block the simulator runs first. Blocking writes read by another block at the same edge race. Adding a $display changes scheduling, which is why the bug "moved".'),
    mc('The counter\'s enable comes from the testbench, driven with a blocking assignment exactly at posedge clk. Fix?', ['Drive it through a clocking block, so the DUT samples the old value', 'Add a #1 delay inside the DUT on the enable input path to the counter', 'Switch the counter over to blocking assignments throughout the design', 'Run the same test on a second simulator and compare the two logs'], 0, 'Clocking blocks exist precisely to remove TB/DUT races.'),
    { t: 'gen', make: () => ask('Unrelated: `if (sel) y = a; else y = b;` with sel = X, a = 1, b = 0. What does RTL simulation give y?', num(0), 'The else branch: y = 0. Gate-level sim would give X. RTL X-optimism hides reset and init bugs.') },
    { t: 'gen', make: () => ask('A second failure shows up only after about 1,000,000 cycles. Using checkpoints, how many bisection runs to locate the first bad cycle exactly?', num(20), '⌈log2(1,000,000)⌉ = 20.') },
  ],
  recap: ['Find the FIRST wrong value.', 'Blocking-assignment races between blocks.', 'Clocking blocks for TB drive.', 'X-optimism in RTL.', 'Bisection.'],
});

export const crvBoss = boss({
  id: 'boss-crv',
  title: 'The Constraint That Never Fires',
  concept: 'fix a random test that never generates the interesting case',
  xp: 200,
  steps: [
    say('Boss fight. The team ran 50,000 random seeds. Silicon then failed on short packets, and coverage shows short packets almost never happened. Exam rules.', 'concerned'),
    art(`class pkt;
  rand bit [7:0] len;
  rand bit       short_pkt;
  constraint c_short { short_pkt -> len < 4; }
endclass`),
    { t: 'gen', make: () => ask('P(short_pkt == 1), in %?', qty((4 / 260) * 100, '%', 0.02, sig((4 / 260) * 100)), 'short_pkt = 0 allows 256 lengths; short_pkt = 1 allows 4. The solver is uniform over all 260 solutions: 4/260 = 1.54%.') },
    { t: 'gen', make: () => ask('Add `solve short_pkt before len;`. Now P(short_pkt == 1), in %?', qty(50, '%', 0.01, '50'), 'short_pkt is chosen first, uniformly: 50%.') },
    mc('Someone adds `constraint c_eth { len inside {[64:1500]}; }`. What happens?', ['The constraints are unsatisfiable, so randomize() returns 0', 'len wraps around so that the value fits into its eight bits', 'The solver quietly picks 255 as the nearest legal value for it', 'The compiler rejects the constraint because of the range chosen'], 0, 'len is 8 bits (max 255), so nothing satisfies 64..1500: randomize() returns 0 and len keeps its old value. Always check the return value: `if (!p.randomize()) `uvm_fatal(...)`.'),
    { t: 'gen', make: () => ask('A command kind uses `kind dist { READ := 60, WRITE := 30, [CFG0:CFG3] :/ 10 };`. P(kind == CFG2), in %?', qty(2.5, '%', 0.01, '2.5'), ':/ 10 shares the weight across 4 values: 2.5 each. Total 100, so 2.5%.') },
    { t: 'gen', make: () => ask('A `randc bit [2:0] port;` is randomized 16 times. How many times is port 5 chosen?', num(2), 'randc visits all 8 values before repeating: exactly twice in 16 calls.') },
    mc('The base class says `constraint c_len { soft len <= 64; }`. A test does `p.randomize() with { len == 200; }`. Result?', ['len = 200: the inline constraint overrides the soft one', 'Randomization fails, because the two constraints conflict', 'len = 64, the most the base class allows at all', 'len is random in 0-64 and the inline "with" is ignored'], 0, 'soft constraints are defaults that tests can override, exactly for this.'),
  ],
  recap: ['Uniform over solutions skews implications.', 'solve-before, dist.', 'Check randomize() results.', 'randc and soft.'],
});

export const coverageBoss = boss({
  id: 'boss-coverage',
  title: 'Coverage Closure',
  concept: 'build, measure and close a coverage model',
  xp: 200,
  steps: [
    say('Boss fight. Sign-off review is tomorrow and the verification lead wants the coverage numbers explained, not just reported. Exam rules.', 'thinking'),
    art(`covergroup cg @(posedge clk);
  cp_op:   coverpoint op   { bins alu[] = {ADD, SUB, AND, OR};
                             bins mem[] = {LD, ST}; }
  cp_size: coverpoint size { bins s[] = {1, 2, 4, 8}; }
  x_op_size: cross cp_op, cp_size {
    ignore_bins no_mem8 = binsof(cp_op.mem) && binsof(cp_size) intersect {8}; }
endgroup`),
    { t: 'gen', make: () => ask('How many bins does cp_op have?', num(6), 'alu[] gives 4 bins, mem[] gives 2.') },
    { t: 'gen', make: () => ask('How many bins does the cross have?', num(22), '6 × 4 = 24, minus the 2 ignored combinations (LD/ST with size 8) = 22.') },
    { t: 'gen', make: () => ask('After the regression: cp_op 6/6, cp_size 3/4, cross 15/22. With equal weights, what is the covergroup coverage, in %?', qty(((1 + 0.75 + 15 / 22) / 3) * 100, '%', 0.01, sig(((1 + 0.75 + 15 / 22) / 3) * 100)), `(100 + 75 + ${sig((15 / 22) * 100)})/3 = ${sig(((1 + 0.75 + 15 / 22) / 3) * 100)}%.`) },
    mc('cp_size never hits 8. The stimulus class, copied from an older design, says `constraint c_size { size inside {1, 2, 4}; }`. What is the right fix?', ['Fix the constraint so size 8 is generated; it is a stimulus gap', 'Add size 8 to ignore_bins so that the coverage report is clean again', 'Lower the coverage goal to 90% for this one coverpoint alone', 'Run many more seeds until the bin is eventually hit by luck'], 0, 'The hole is a stimulus gap, not a reason to change the coverage model. Read the constraints next to the coverage model; holes usually point at stimulus. Only waive bins the spec says cannot happen.'),
    { t: 'gen', make: () => ask('Once fixed, size is uniform over 4 values. On average how many transactions until all 4 size bins are hit?', qty(4 * (1 + 1 / 2 + 1 / 3 + 1 / 4), '', 0.03, sig(4 * (1 + 1 / 2 + 1 / 3 + 1 / 4))), '4 × (1 + 1/2 + 1/3 + 1/4) = 8.33.') },
    mc('Code coverage is 100%, functional coverage 100%. Is the block done?', ['Only if coverage maps to the plan and every checker was active', 'Yes: with both measures at 100% there is nothing left to verify here', 'No: sign-off needs coverage above 110% to leave some margin', 'Only after the whole suite has been rerun on the gate-level netlist'], 0, 'Coverage without checking proves nothing: items must map to the test plan, and the scoreboard and assertions must have been on. Coverage says what happened; checkers say whether it was right. Sign-off needs both.'),
  ],
  recap: ['bins/ bins[] / cross / ignore_bins.', 'Group coverage averages coverpoints.', 'Holes point at stimulus.', 'Coverage + checking.'],
});

export const uvmBoss = boss({
  id: 'boss-uvm',
  title: 'The Test That Ends at Time Zero',
  concept: 'phases, objections, the factory and config_db under pressure',
  xp: 200,
  steps: [
    say('Boss fight. A new UVM test "passes" in 0 ns, the error-injection override does nothing, and one agent has a null interface. Three bugs, one afternoon. Exam rules.', 'concerned'),
    mc('The test passes at 0 ns with no traffic. Most likely cause?', ['No objection is raised in run_phase, so the phase ends at once', 'The clock is not running, so the sequences never get to start at all', 'The DUT is held in reset for the whole length of the test', 'The scoreboard is disabled, so nothing is ever compared or reported'], 0, 'phase.raise_objection(this) before starting sequences, drop after.'),
    { t: 'gen', make: () => ask('Fixed: the test raises at 0 ns, the sequence finishes at 850 ns, the test drops at 900 ns, drain time 100 ns. When does run_phase end, in ns?', num(1000), '900 + 100 = 1000 ns.') },
    art(`class my_agent extends uvm_agent;
  function void build_phase(uvm_phase phase);
    drv = my_driver::new("drv", this);
  endfunction`),
    mc('The test did `set_type_override_by_type(my_driver::get_type(), err_driver::get_type())`, but no errors are injected. Why?', ['The agent calls new() instead of type_id::create()', 'Overrides only apply to sequences, not drivers or monitors', 'The override has to be set later, in connect_phase', 'err_driver must be a sequence type to replace my_driver'], 0, 'new() bypasses the factory; only type_id::create consults it. Only type_id::create consults the factory.'),
    mc('The test does `uvm_config_db#(virtual bus_if)::set(this, "env.agt*", "vif", vif)`. agent "uvm_test_top.env.mon_agt.mon" gets null. Why?', ['"env.agt*" does not match "env.mon_agt...": the glob must start with agt', 'config_db entries can only ever be read by drivers, and never by monitors', 'Monitors are not allowed to hold a virtual interface handle at all', 'set must be called in run_phase, after the whole environment is built'], 0, 'Glob patterns match the full hierarchical path; use "env.*" or set it per agent. Glob patterns match the full hierarchical path; use "env.*" or set it per agent.'),
    { t: 'gen', make: () => ask('Which phase runs right after connect_phase?', words('end_of_elaboration', 'end_of_elaboration_phase'), 'build → connect → end_of_elaboration → start_of_simulation → run → extract → check → report → final.') },
    { t: 'gen', make: () => ask('The env has 2 active agents (sequencer, driver, monitor each), 1 passive agent (monitor) and a scoreboard. How many components inside env, counting agents?', num(11), '2 × 4 + 2 + 1 = 11.') },
  ],
  recap: ['Objections keep run_phase alive.', 'type_id::create or the factory is bypassed.', 'config_db paths are globs.', 'Phase order.'],
});

export const svaBoss = boss({
  id: 'boss-sva',
  title: 'The Handshake Contract',
  concept: 'turn a protocol spec into assertions and debug them on a waveform',
  xp: 200,
  steps: [
    say('Boss fight. The bus spec says: "every request must be granted 1 to 3 cycles after it rises; req must stay high until gnt; gnt is never asserted without req." Write the contract, then judge a waveform. Exam rules.', 'thinking'),
    mc('Which property encodes "granted 1 to 3 cycles after req rises"?', ['$rose(req) |-> ##[1:3] gnt', 'req |-> gnt, checked on every cycle req is high', 'req |=> ##3 gnt, a grant after exactly four cycles', 'gnt |-> $past(req, 3), looking back exactly three'], 0, '$rose starts one attempt per request; ##[1:3] is the window.'),
    mc('Which encodes "req must stay high until gnt"?', ['req && !gnt |=> req', 'req |-> ##1 req', '$fell(req) |-> gnt', 'req throughout gnt, as a bare sequence expression'], 0, 'While requesting and not yet granted, req must still be high next cycle.'),
    art(`cycle   0  1  2  3  4  5  6  7  8  9 10 11
req     0  1  1  1  1  0  0  1  1  1  1  1
gnt     0  0  0  0  1  0  0  0  0  0  0  1`),
    { t: 'gen', make: () => ask('For `$rose(req) |-> ##[1:3] gnt`, at which cycle does the first failing attempt start? ("none" if it passes)', num(7), 'Rises at 1 and 7. Attempt 1: gnt at 4, inside 2-4 ✓. Attempt 7: needs gnt in 8-10: none ✗. It fails at cycle 10, for the attempt that started at 7.') },
    { t: 'gen', make: () => ask('How many attempts of `$rose(req) |-> ##[1:3] gnt` start in those 12 cycles?', num(2), 'Two rising edges of req: cycles 1 and 7. The other 10 cycles are vacuous.') },
    mc('`gnt |-> req` checks the arbiter\'s output. When formally verifying the ARBITER, what are the req-side rules (e.g. req stays high until gnt)?', ['Assumptions: they constrain the inputs; gnt rules are assertions', 'Assertions: every property is something the tool must try to prove here', 'Covers: formal tools only ever check whether states are reachable', 'None are needed, since the tool can infer the legal environment alone'], 0, 'Assume the environment, assert the design. Swap roles when verifying the requester.'),
    mc('The team\'s assertion `req |-> ##[1:3] gnt` (no $rose) fails constantly on legal traffic. Why?', ['It starts a new attempt each cycle req is high, so a held request demands grants the spec never promised', 'It is correct as written, so the DUT must be at fault', 'The implication should be |=> rather than |->', 'Assertions are not allowed to use delay ranges at all, so the tool is silently rejecting the property as written'], 0, 'Without $rose, a long request spawns many overlapping attempts.'),
  ],
  recap: ['$rose for one attempt per event.', 'Hold rules with |=>.', 'Evaluate windows on waveforms.', 'Assume inputs, assert outputs.'],
});

export const formalBoss = boss({
  id: 'boss-formal',
  title: 'The Proof That Proved Nothing',
  concept: 'vacuity, depth and abstraction in formal verification',
  xp: 200,
  steps: [
    say('Boss fight. The formal report says "all 48 properties proven" in 3 seconds. The lead is suspicious, and so should you be. Exam rules.', 'concerned'),
    art(`assume property (@(posedge clk) !(valid_in && !ready_out));
assume property (@(posedge clk) !valid_in);   // added "temporarily" to debug`),
    mc('Why did everything prove in 3 seconds?', ['The second assumption forbids valid_in forever, so every assertion is vacuous', 'The design is simple enough that every single proof finishes almost instantly', 'Formal engines always finish quickly on small blocks like this one is, really', 'The first assumption is too weak, and should be removed from the setup entirely'], 0, 'No traffic ever reaches the design. Over-constraint is the most common formal mistake.'),
    mc('Which check would have exposed it automatically?', ['A cover like `cover property (valid_in && ready_out)`, shown unreachable', 'Running a larger number of assertions together in the same single job', 'Increasing the proof depth until the engine runs for a good while longer', 'Switching the whole run over to random simulation instead of formal'], 0, 'Always prove your covers reachable before trusting proofs.'),
    { t: 'gen', make: () => ask('After the fix, a 32-bit timeout counter must reach 0xFFFFFFFF to trigger a suspected bug. How many cycles after reset (minimum BMC depth)?', num(4294967295), '2^32 - 1 = 4,294,967,295 cycles: far beyond any bounded search.') },
    mc('How do you check that overflow bug formally?', ['Abstract the counter: reduce its width via a parameter, or let it start from any value', 'Run bounded model checking for four billion cycles, in overnight batches', 'Give up on it, since formal tools cannot reason about counters at all', 'Simulate a single random seed and hope that it overflows in time'], 0, 'Reduce its width via a parameter, or let it start from any value (a free initial state) and prove the property under that abstraction. Abstraction makes deep states shallow, soundly if done carefully.'),
    { t: 'gen', make: () => ask('Two FSM counters (modulo 6 and modulo 10) start at 0. The bug needs both at 0 again at the same time. After how many cycles?', num(30), 'lcm(6, 10) = 30.') },
    mc('The tool now reports "bounded proof, depth 40" for one property. What may you claim?', ['No violation within 40 cycles of reset; not a full proof', 'The property is fully proven for every reachable state', 'The property fails after exactly 40 cycles of operation', 'Nothing at all, because bounded results mean no information'], 0, 'Say exactly what was proven. Full proofs need induction or a known diameter.'),
  ],
  recap: ['Covers guard against over-constraint.', 'Bounded vs full proofs.', 'Abstraction for deep counters.', 'Report exactly what was proven.'],
});

export const dftBoss = boss({
  id: 'boss-dft',
  title: 'The Tester Bill',
  concept: 'scan time, compression, coverage and escapes on a production chip',
  xp: 200,
  steps: [
    say('Boss fight. The chip goes to production next quarter. Tester time costs money and the customer wants fewer than 500 defective parts per million. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('2,000,000 scan flops in 400 chains. Shift length per pattern?', num(5000), '2,000,000 / 400 = 5000.') },
    { t: 'gen', make: () => { const c = 10000 * 5001 + 5000; return ask('10,000 patterns at a 50 MHz scan clock, using P·(L + 1) + L cycles. Test time, in s?', qty(c / 50e6, 's', 0.02), `${c.toLocaleString('en-US')} cycles / 50 MHz = ${sig(c / 50e6)} s per chip.`); } },
    { t: 'gen', make: () => { const c = 10000 * 501 + 500; return ask('With 10× compression, the same pins feed 4000 internal chains. New test time, in s?', qty(c / 50e6, 's', 0.02), `Shift length 500: ${sig(c / 50e6)} s. About 10× less tester time.`); } },
    { t: 'gen', make: () => ask('ATPG detects 9,850,000 of 10,000,000 stuck-at faults. Fault coverage, in %?', qty(98.5, '%', 0.001, '98.5'), '9.85M / 10M = 98.5%. Sounds high; the next question shows why it is not enough.') },
    { t: 'gen', make: () => { const DL = 1 - 0.85 ** 0.015; return ask('Yield is 85% and coverage 98.5%. Defect level by Williams-Brown (1 - Y^(1-T)), in DPPM?', qty(DL * 1e6, '', 0.02, sig(DL * 1e6)), `1 - 0.85^0.015 = ${sig(DL)}: ${sig(DL * 1e6)} DPPM, far above 500.`); } },
    { t: 'gen', make: () => { const T = 1 - Math.log(1 - 500e-6) / Math.log(0.85); return ask('What fault coverage (in %) meets 500 DPPM at 85% yield?', qty(T * 100, '%', 0.0005, sig(T * 100, 4)), `Solve 1 - 0.85^(1-T) = 0.0005: 1 - T = ln(0.9995)/ln(0.85) = ${sig(1 - T)} → T = ${sig(T * 100, 4)}%.`); } },
    { t: 'gen', make: () => ask('The chip also has a 1M-word SRAM. March C- (10N) at 500 MHz: MBIST time, in ms?', qty(20.97, 'ms', 0.02, '21'), '10 × 1,048,576 / 500 MHz ≈ 21 ms.') },
  ],
  recap: ['Shift length and test time.', 'Compression.', 'Coverage → DPPM.', 'MBIST time.'],
});

export const upfBoss = boss({
  id: 'boss-upf',
  title: 'The Power State Bug',
  concept: 'power-aware verification: isolation, level shifting, retention, sequencing',
  xp: 200,
  steps: [
    say('Boss fight. The GPU domain wakes up with garbage in its registers, and the always-on block sometimes reads X. You are running power-aware simulation with the UPF. Exam rules.', 'concerned'),
    art(`PD_TOP  always on   0.8 V
PD_GPU  switchable  0.8 V   (power switch, retention on 12 control regs)
PD_DSP  always on   0.6 V`),
    mc('GPU outputs go into PD_TOP. What must sit on them?', ['Isolation cells, enabled before the GPU is switched off', 'Level shifters only, as the voltages differ between them', 'Retention flops, to keep the outputs while it is off', 'Nothing, since an off domain simply drives zeros out'], 0, 'They clamp the outputs to safe values. Off domains drive X; isolation contains it.'),
    mc('DSP (0.6 V) outputs go into PD_TOP (0.8 V). What must sit on them?', ['Low-to-high level shifters', 'Isolation cells', 'Nothing, 0.6 V is a valid 1', 'Retention flops'], 0, 'A 0.6 V high may leave 0.8 V PMOS partly on: leakage and wrong levels.'),
    mc('GPU (switchable 0.8 V) outputs go into DSP (0.6 V). What do they need?', ['Both isolation and level shifting, often one combined cell', 'Only isolation, because the source is the one that switches', 'Only level shifting, because the two voltages differ here', 'Nothing, since the DSP input buffers tolerate either voltage'], 0, 'Different voltage AND switchable source.'),
    mc('Correct power-DOWN order for the GPU?', ['Stop clocks, save retention, enable isolation, open the switch', 'Open the switch, then enable isolation, then save the state', 'Enable isolation, open the switch, then save the retention state', 'Save the state, open the switch, then stop the clocks last'], 0, 'Power-up reverses it: switch on and wait for the rail, restore, release isolation, restart clocks.'),
    mc('Power-aware simulation shows the 12 control registers are X after wake-up. Most likely cause?', ['Restore was never asserted (or asserted before the rail was stable), so retention flops did not restore', 'Isolation cells were missing on the control register outputs altogether', 'Level shifters were missing on the signals at the domain boundary here', 'The clock was running too fast for the retention flops to capture'], 0, 'Retention flops did not restore; the save/restore sequence matters, and power-aware simulation checks it. Retention needs the right save/restore sequence, and power-aware sim checks it.'),
    { t: 'gen', make: () => ask('The GPU rail has 10 nF of capacitance and the switch brings it to 0.8 V in 2 µs. Average in-rush current, in mA?', qty(4, 'mA', 0.01, '4'), 'I = C·dV/dt = 10 nF × 0.8 V / 2 µs = 4 mA. Faster switching makes a bigger spike on the always-on rail, which is why switches turn on in a daisy chain.') },
  ],
  recap: ['Isolation for off domains.', 'Level shifters across voltages.', 'Power-down/up sequencing.', 'Retention restore and in-rush.'],
});

export const VERIFICATION_BOSSES = [tbBoss, debugBoss, crvBoss, coverageBoss, uvmBoss, svaBoss, formalBoss, dftBoss, upfBoss];

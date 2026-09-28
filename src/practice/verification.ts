// Practice banks and bosses for verification and test: testbenches, debug, constrained random, coverage, UVM, SVA, formal, DFT.
import { hexa, num, qty, words } from '../lessons/answers';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { exact, hex, mcs, sci, sig } from './util';

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
    return ask(`An in-order scoreboard compares transactions one by one.${code(`expected: ${exp.map((x) => hex(x, 2)).join(' ')}\nactual:   ${act.map((x) => hex(x, 2)).join(' ')}`)}At which transaction (counting from 1) is the first mismatch reported?`, num(k + 1), dropped ? `Transaction ${k + 1} was dropped, so every later actual value is shifted by one: the first mismatch is at ${k + 1}, and everything after it also mismatches. One missing item looks like a flood of errors; always read the first one.` : `Transaction ${k + 1}: expected ${hex(exp[k], 2)}, got ${hex(act[k], 2)} (a single flipped bit).`, 'Compare position by position.');
  },
  (r, d) => {
    const depth = d === 3 ? 3 : 99;
    const ops: string[] = [];
    const q: number[] = [];
    const pops: number[] = [];
    let v = between(r, 1, 5);
    for (let i = 0; i < tier(d, 6, 8, 10); i++) {
      if (q.length === 0 || (r() < 0.6 && ops.filter((o) => o.startsWith('push')).length < 7)) {
        ops.push(`push ${v}`);
        if (q.length < depth) q.push(v);
        v += between(r, 1, 4);
      } else { ops.push('pop'); pops.push(q.shift()!); }
    }
    while (pops.length < tier(d, 1, 2, 3) && q.length) { ops.push('pop'); pops.push(q.shift()!); }
    const k = pops.length;
    return ask(`A reference model for a FIFO${depth < 99 ? ` of depth ${depth} that silently drops pushes when full` : ''} sees:${code(ops.join('\n'))}What does pop number ${k} return?`, num(pops[k - 1]), `Pops return, in order: ${pops.join(', ')}.${depth < 99 ? ' Pushes that arrive while 3 items are waiting are lost: that is exactly the corner a scoreboard must model, or it reports false errors.' : ' First in, first out.'}`, 'Keep a queue: push at the back, pop from the front.');
  },
  (r, d) => {
    const a = between(r, 1, 9), b = between(r, 10, 19);
    if (d === 1) return ask(`Registers a = ${a}, b = ${b}.${code('always @(posedge clk) begin\n  a <= b;\n  b <= a;\nend')}What is b after one clock edge?`, num(a), `Nonblocking assignments all read their right-hand sides first, then update: the values swap. b = ${a}.`, 'With <=, every right side is read before anything changes.');
    if (d === 2) return ask(`Registers a = ${a}, b = ${b}.${code('always @(posedge clk) begin\n  a = b;\n  b = a;\nend')}What is b after one clock edge?`, num(b), `Blocking: a becomes ${b} immediately, then b = a reads the new a: b = ${b}. Both end up ${b}. Use <= for flops.`, 'With =, each line sees the previous line\'s result.');
    const c = between(r, 20, 29);
    return ask(`Registers a = ${a}, b = ${b}, c = ${c}. The designer meant a 2-stage pipeline:${code('always @(posedge clk) begin\n  b = a;\n  c = b;\nend')}What is c after one clock edge?`, num(a), `Blocking assignments collapse the pipeline: b = ${a}, then c = b = ${a}. With <= c would be ${b}. One stage of latency just vanished, and the test only fails when data changes every cycle.`, 'Each blocking line sees the line above.');
  },
  (r) => {
    const qs = [
      ['In RTL simulation, `if (sel) y = a; else y = b;` runs with sel = X. What does y get?', 'b, because an X condition takes the else branch: X-optimism hides the problem that gates would show', ['X', 'a', 'The simulator stops']],
      ['Why should a monitor be passive?', 'It only observes pins and reports transactions; if it drove signals it would change what it is checking', ['Monitors must drive the DUT', 'Passive monitors are faster', 'Only the scoreboard may be active']],
      ['Who should write the reference model?', 'Someone working from the specification, not from the RTL, so the same misunderstanding is not copied into both', ['The RTL designer, copying the RTL', 'Nobody: waveforms are enough', 'The synthesis tool']],
      ['A test fails at cycle 900,000. What do you look at first?', 'The first error message and the cycle it points to, then walk backwards in the waveform to where the data first went wrong', ['The last error message', 'The coverage report', 'The synthesis log']],
      ['A testbench drives inputs with blocking assignments right at the clock edge, and the DUT sometimes sees the new value. What is this?', 'A race: fix it by driving through a clocking block or with nonblocking assignments / after the edge', ['A timing violation', 'An X-propagation issue', 'Correct behavior']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
  (r, d) => {
    const n = pick(r, tier(d, [1000, 4000], [1e5, 1e6], [5e6, 1e7]));
    const k = Math.ceil(Math.log2(n));
    return ask(`A failure appears somewhere in a ${n.toLocaleString('en-US')}-cycle run, and you can rerun with a checkpoint at any cycle. How many bisection runs to narrow it to a single cycle?`, num(k), `Each run halves the window: ⌈log2(${n.toLocaleString('en-US')})⌉ = ${k}. Bisection (on cycles, on commits, on seeds) is the debugger's most reliable tool.`, 'Halve the window each time.');
  },
]);

// ------------------------------------------------------------------ constrained random

export const crvPractice = practice('practice-crv', 'Constraint Drills', 'solution spaces, dist weights, solve-before, randc', [
  (r, d) => {
    if (d < 3) {
      const lo = between(r, 0, 6), hi = between(r, lo + 5, 15), k = pick(r, [2, 3, 4]);
      const sols = Array.from({ length: 16 }, (_, x) => x).filter((x) => x >= lo && x <= hi && (d === 1 || x % k === 0));
      return ask(`How many values can x take?${code(`rand bit [3:0] x;\nconstraint c { x inside {[${lo}:${hi}]};${d === 2 ? ` x % ${k} == 0;` : ''} }`)}`, num(sols.length), `Solutions: ${sols.join(', ')} → ${sols.length}.`, 'List them.');
    }
    const kind = pick(r, ['lt', 'sum', 'sumlt']);
    const s = between(r, 4, 10);
    let n = 0;
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) if (kind === 'lt' ? a < b : kind === 'sum' ? a + b === s : a + b < s) n++;
    const c = kind === 'lt' ? 'a < b;' : kind === 'sum' ? `a + b == ${s};` : `a + b < ${s};`;
    return ask(`How many (a, b) pairs satisfy this?${code(`rand bit [2:0] a, b;\nconstraint c { ${c} }`)}(The sum is evaluated at 32 bits, so it does not wrap.)`, num(n), `Count the pairs of 0-7 values: ${n}. The solver picks uniformly among these ${n} solutions, which is why joint constraints skew each variable's distribution.`, 'Go through a = 0..7 and count valid b.');
  },
  (r, d) => {
    const w0 = pick(r, [10, 20, 40]), w1 = pick(r, [10, 20, 30]), w2 = pick(r, [10, 20]);
    if (d === 1) {
      const p = (w1 / (w0 + w1)) * 100;
      return ask(`P(x == 1), in %?${code(`x dist { 0 := ${w0}, 1 := ${w1} };`)}`, qty(p, '%', 0.01, sig(p)), `${w1}/(${w0} + ${w1}) = ${sig(p)}%.`, 'Weight / total weight.');
    }
    const each = d === 2;
    const p = each ? (w1 / (w0 + 3 * w1 + w2)) * 100 : (w1 / 3 / (w0 + w1 + w2)) * 100;
    return ask(`P(x == 2), in %?${code(`x dist { 0 ${each ? ':=' : ':/'} ${w0}, [1:3] ${each ? ':=' : ':/'} ${w1}, 4 ${each ? ':=' : ':/'} ${w2} };`)}`, qty(p, '%', 0.01, sig(p)), each ? `:= gives EACH value in the range weight ${w1}: total = ${w0} + 3×${w1} + ${w2} = ${w0 + 3 * w1 + w2}; P = ${w1}/${w0 + 3 * w1 + w2} = ${sig(p)}%.` : `:/ SPLITS ${w1} across the 3 values: ${sig(w1 / 3)} each; total = ${w0 + w1 + w2}; P = ${sig(p)}%.`, ':= is per value, :/ is shared by the range.');
  },
  (r, d) => {
    if (d === 1) {
      const w = pick(r, [2, 3]), calls = 2 ** w * pick(r, [2, 3]);
      return ask(`\`randc bit [${w - 1}:0] v;\` is randomized ${calls} times. How many times does each value appear?`, num(calls / 2 ** w), `randc cycles through all ${2 ** w} values before repeating any: ${calls}/${2 ** w} = ${calls / 2 ** w} each.`, 'randc is a shuffled deck.');
    }
    const w = pick(r, [2, 3, 4]), sb = d === 3 && r() < 0.5;
    const p = sb ? 50 : (1 / (2 ** w + 1)) * 100;
    return ask(`P(en == 1), in %?${code(`rand bit en;\nrand bit [${w - 1}:0] v;\nconstraint c { en -> v == 0; }${sb ? '\nconstraint o { solve en before v; }' : ''}`)}`, qty(p, '%', 0.01, sig(p)), sb ? 'solve en before v picks en first, uniformly (50%), then v given en.' : `The solver is uniform over solutions: en = 0 allows ${2 ** w} values of v, en = 1 only v = 0. So ${2 ** w + 1} solutions, one with en = 1: ${sig(p)}%. The "feature enable" almost never fires: use solve-before or dist.`, 'Count solutions with en = 0 and en = 1.');
  },
  (r) => {
    const qs = [
      ['`randomize()` fails because constraints conflict, and the return value is ignored. What happens?', 'The variables keep their old values and the test continues silently with stale stimulus', ['The simulator stops', 'The constraints are relaxed automatically', 'Random values are chosen anyway']],
      ['What does `soft` do on a constraint?', 'It holds unless a later, stronger (non-soft) constraint contradicts it, so tests can override defaults', ['It is ignored by the solver', 'It makes the constraint probabilistic', 'It turns the constraint into a coverage point']],
      ['What does `c.constraint_mode(0)` do?', 'Disables constraint block c for later randomize() calls on that object', ['Deletes the object', 'Randomizes only c', 'Makes c soft']],
      ['When does post_randomize() run?', 'Automatically after every successful randomize(), e.g. to compute a checksum field from the random ones', ['Before randomize()', 'Only when randomize() fails', 'Only at time 0']],
      ['Why are seeds recorded for every random test?', 'So a failing run can be reproduced exactly with the same seed', ['For licensing', 'To make tests faster', 'Seeds only matter for coverage']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
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
    return ask(`How many bins does this coverpoint have?${code(`coverpoint x {\n  ${lines.join('\n  ')}\n}`)}`, num(n), `lo is 1 bin; mid[] makes one bin per value: ${c - b}${d > 1 ? `; hi[${k}] splits the range into ${k} bins` : ''}${d > 2 ? '; ignore and illegal bins are not counted' : ''}. Total ${n}.`, 'bins x = {...} is one bin; bins x[] = {...} is one per value; bins x[N] is N bins.');
  },
  (r, d) => {
    const n = between(r, 3, 6), m = between(r, 2, 5);
    if (d < 3) return ask(`cp_a has ${n} bins and cp_b has ${m}. How many bins does \`cross cp_a, cp_b\` have?`, num(n * m), `Every combination: ${n} × ${m} = ${n * m}. Crosses grow fast, so cross only what the spec says interacts.`, 'Multiply.');
    return ask(`cp_a has ${n} bins and cp_b has ${m}. The cross ignores every combination with cp_a's bin "reserved". How many cross bins remain?`, num((n - 1) * m), `${n} × ${m} = ${n * m}, minus the ${m} combinations of "reserved" with each cp_b bin = ${(n - 1) * m}.`, 'Total minus the ignored combinations.');
  },
  (r, d) => {
    const n1 = pick(r, [4, 8, 10]), h1 = between(r, 1, n1);
    if (d < 3) return ask(`A coverpoint has ${n1} bins; ${h1} have been hit at least once. Coverage, in %?`, qty((h1 / n1) * 100, '%', 0.01, sig((h1 / n1) * 100)), `${h1}/${n1} = ${sig((h1 / n1) * 100)}%. A bin hit once counts the same as a bin hit a million times (unless at_least is set).`, 'Hit bins / total bins.');
    const n2 = pick(r, [6, 12, 20]), h2 = between(r, 1, n2);
    const cov = ((h1 / n1 + h2 / n2) / 2) * 100;
    return ask(`A covergroup has two coverpoints with equal weight: A (${h1}/${n1} bins hit) and B (${h2}/${n2}). Group coverage, in %?`, qty(cov, '%', 0.01, sig(cov)), `The group score is the weighted average of the coverpoint scores, not of the bins: (${sig((h1 / n1) * 100)}% + ${sig((h2 / n2) * 100)}%)/2 = ${sig(cov)}%.`, 'Average the two percentages.');
  },
  (r, d) => {
    const N = pick(r, tier(d, [2, 4], [6, 8], [16, 32]));
    let H = 0;
    for (let i = 1; i <= N; i++) H += 1 / i;
    return ask(`A random test hits one of ${N} equally likely bins per transaction. On average, how many transactions until every bin is hit?`, qty(N * H, '', 0.03, sig(N * H)), `The coupon collector problem: N·(1 + 1/2 + … + 1/N) = ${N} × ${sig(H)} = ${sig(N * H)}. The last bins take the longest, which is why closure needs directed tests or tuned constraints.`, 'Expected time = N × H_N (the N-th harmonic number).');
  },
  (r) => {
    const qs = [
      ['Code coverage is 100%. Does that mean the design is verified?', 'No: code coverage only says lines were executed, not that the right scenarios happened or the results were checked', ['Yes, fully', 'Yes, if there are no errors', 'Only for FSMs']],
      ['What does functional coverage measure?', 'Whether the scenarios in the test plan (from the spec) actually happened in simulation', ['Which lines of RTL ran', 'How fast the simulator is', 'Gate-level toggles only']],
      ['A coverage bin can never be hit because the feature was removed from the spec. What do you do?', 'Move it to ignore_bins (or remove it) and record the waiver in the test plan', ['Leave it and report 99%', 'Force the signal to hit it', 'Delete the covergroup']],
      ['Coverage is stuck at 92% after 10,000 random seeds. Best next step?', 'Analyze the holes, then tune constraints or write directed tests aimed at them', ['Run 100,000 more seeds', 'Lower the goal', 'Remove the missing bins']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ UVM

const PHASES = ['build', 'connect', 'end_of_elaboration', 'start_of_simulation', 'run', 'extract', 'check', 'report', 'final'];

export const uvmPractice = practice('practice-uvm', 'UVM Drills', 'phases, objections, components, factory, config_db', [
  (r, d) => {
    const i = between(r, 0, PHASES.length - 2);
    if (d < 3) return ask(`Which UVM common phase comes right after ${PHASES[i]}_phase?`, words(PHASES[i + 1], `${PHASES[i + 1]}_phase`), `${PHASES.join(' → ')}. build runs top-down (parents create children); the rest bottom-up; run is the only time-consuming one.`, 'build, connect, end_of_elaboration, start_of_simulation, run, extract, check, report, final.');
    return mcs(r, 'In which order are build_phase methods called?', 'Top-down: test, then env, then agents, then drivers/monitors (a parent must build its children)', ['Bottom-up: drivers first', 'Alphabetical', 'In parallel, in random order'], 'build_phase is top-down; connect_phase and later function phases are bottom-up.');
  },
  (r, d) => {
    const tDrop = pick(r, [500, 800, 1000]), sDrop = tDrop + pick(r, [-200, 100, 300]), drain = d > 1 ? pick(r, [50, 100]) : 0;
    if (d === 3 && r() < 0.5) {
      const s = pick(r, [5, 10]);
      return ask(`The test raises an objection at 0 ns and drops it at 0 ns (after starting a sequence with fork/join_none). The sequence raises its own objection at ${s} ns and would finish at 900 ns. At what time does the run phase end, in ns?`, num(0), `At 0 ns the objection count is back to zero, so the run phase ends immediately and the sequence never gets to raise. Tests that "pass" in 0 ns are the classic symptom.`, 'The phase ends when the count first reaches zero.');
    }
    const end = Math.max(tDrop, sDrop) + drain;
    return ask(`run_phase objections: the test raises at 0 ns and drops at ${tDrop} ns; a sequence raises at 20 ns and drops at ${sDrop} ns.${drain ? ` Drain time is ${drain} ns.` : ''} When does the run phase end, in ns?`, num(end), `The count reaches zero at ${Math.max(tDrop, sDrop)} ns${drain ? `, then the ${drain} ns drain time lets in-flight transactions finish: ${end} ns` : ''}.`, 'Find the last drop.');
  },
  (r, d) => {
    const a = between(r, 1, 3), p = between(r, 0, 2), extra = d > 1 ? between(r, 1, 2) : 0;
    const n = a * 4 + p * 2 + 1 + extra;
    return ask(`An env holds ${a} active agent${a > 1 ? 's' : ''} (each: sequencer, driver, monitor), ${p} passive agent${p === 1 ? '' : 's'} (monitor only), a scoreboard${extra ? ` and ${extra} coverage collector${extra > 1 ? 's' : ''}` : ''}. How many uvm_components are inside the env, counting the agents themselves?`, num(n), `Active: ${a} × (agent + 3) = ${a * 4}; passive: ${p} × (agent + monitor) = ${p * 2}; scoreboard 1${extra ? `; coverage ${extra}` : ''}. Total ${n}.`, 'Count each agent plus its children.');
  },
  (r) => {
    const qs = [
      ['A test calls `set_type_override_by_type(base_drv::get_type(), err_drv::get_type())`, but the agent creates its driver with `drv = new("drv", this);`. What happens?', 'The override is ignored: only objects created through the factory (type_id::create) can be overridden', ['err_drv is created', 'A compile error', 'Both drivers are created']],
      ['`uvm_config_db#(virtual bus_if)::set(this, "env.agt*", "vif", vif)` is called in the test. Can uvm_test_top.env.agt0.drv get("vif")?', 'Yes: the path is relative to the test and * matches any characters, including the dots', ['No, * does not match dots', 'Only env can get it', 'Only if the driver calls set too']],
      ['What is an analysis port for?', 'Broadcasting transactions from a monitor to any number of subscribers (scoreboard, coverage) without knowing who they are', ['Driving pins', 'Point-to-point blocking transfer only', 'Configuring the sequencer']],
      ['Order of the sequence/driver handshake?', 'Sequence: start_item → (randomize) → finish_item; driver: get_next_item → drive → item_done', ['Driver calls start_item', 'finish_item before start_item', 'The monitor calls item_done']],
      ['What is a virtual sequence for?', 'Coordinating sequences on several sequencers (e.g. CPU and DMA traffic together)', ['Running without a DUT', 'Replacing the driver', 'Only for register tests']],
      ['Where does the virtual interface come from in a driver?', 'The top module sets it in uvm_config_db; the driver gets it in build/connect phase', ['The driver instantiates the interface', 'It is a global variable', 'The factory creates it']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
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

export const svaPractice = practice('practice-sva', 'Assertion Drills', 'evaluate SVA properties on waveforms, $rose, $past, vacuity', [
  (r, d) => {
    const s = svaTrace(r, d);
    const fail = s.all.find((a) => !a.ok);
    const expl = s.all.map((a) => `${a.t} ${a.ok ? '✓' : '✗'}`).join(', ');
    return ask(`\`assert property (@(posedge clk) ${s.text});\`${waveform([['req', s.req], ['ack', s.ack]])}At which cycle does the first FAILING attempt start? (Type "none" if it never fails.)`, fail ? num(fail.t) : NONE, `Attempts start at every cycle where the antecedent${d === 3 ? ' ($rose: req is 1 now and was 0 the cycle before)' : ''} holds: ${expl}. Each needs ack at offset ${s.m === s.n ? s.m : `${s.m} to ${s.n}`}.${fail ? ` First failure: the attempt from cycle ${fail.t}.` : ' None fail.'}`, `|-> checks from the same cycle, |=> from the next; ##[m:n] means some cycle in that window.`);
  },
  (r, d) => {
    const s = svaTrace(r, d);
    const k = s.all.length, bad = s.all.filter((a) => !a.ok).length;
    const askFails = d > 1 && r() < 0.5;
    return ask(`\`${s.text}\`${waveform([['req', s.req], ['ack', s.ack]])}How many ${askFails ? 'attempts fail' : 'attempts start (cycles where the antecedent is true)'}?`, num(askFails ? bad : k), `Antecedent true at cycles ${s.all.map((a) => a.t).join(', ')} (${k} attempt${k === 1 ? '' : 's'}); ${bad} fail. Every other cycle is a vacuous success: the property "passes" without checking anything.`, askFails ? 'Check each attempt\'s window.' : 'Count the cycles where the left side is true.');
  },
  (r, d) => {
    const x = Array.from({ length: 10 }, () => between(r, 0, 9));
    const k = tier(d, 1, 2, 3), t = between(r, k + 1, 9);
    return ask(`${waveform([['x', x]])}What is \`$past(x, ${k})\` evaluated at cycle ${t}?`, num(x[t - k]), `$past(x, ${k}) is x from ${k} cycle${k > 1 ? 's' : ''} earlier: cycle ${t - k}, value ${x[t - k]}.`, 'Look back that many cycles.');
  },
  (r) => {
    const qs = [
      ['Difference between `a |-> b` and `a |=> b`?', '|-> checks b in the same cycle as a; |=> checks b one cycle later (same as |-> ##1 b)', ['None', '|=> is for formal only', '|-> checks b before a']],
      ['What does `$rose(req)` mean at cycle t?', 'req is 1 at t and was 0 at t-1 (sampled values)', ['req is 1', 'req changed in either direction', 'req will be 1 at t+1']],
      ['An assertion never fails in a 1-hour regression. What must you also check?', 'That its antecedent actually fired: add a cover property, or it may be passing vacuously', ['Nothing', 'That the simulator is licensed', 'That it is written with |=>']],
      ['What does `disable iff (!rst_n)` do?', 'Stops (and discards) checking while reset is active, so reset behavior does not cause false failures', ['Disables the clock', 'Makes the assertion an assumption', 'Checks only during reset']],
      ['`req ##1 gnt[*3]` means?', 'req, then gnt high for 3 consecutive cycles starting the next cycle', ['gnt within 3 cycles', 'req 3 times', 'gnt anytime in 3 cycles']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ formal

export const formalPractice = practice('practice-formal', 'Formal Drills', 'state spaces, BMC depth, vacuity, equivalence, induction', [
  (r, d) => {
    const n = pick(r, tier(d, [8, 10, 16], [32, 40, 64], [100, 128, 256]));
    const s = 2 ** n;
    return ask(`A block has ${n} flip-flops. At most how many states can it be in?`, qty(s, '', 0.03, n <= 16 ? String(s) : sci(s, 2)), `2^${n} = ${n <= 16 ? s : sci(s, 2)}. Simulation can never visit them all; formal tools reason about them symbolically instead.`, 'Each flop doubles it.');
  },
  (r, d) => {
    if (d < 3) {
      const k = d === 1 ? 1 : pick(r, [2, 3, 4]), v = k * between(r, 5, 40);
      return ask(`After reset a counter is 0 and adds ${k} every cycle. A bug triggers when it equals ${v}. What is the minimum BMC depth (cycles after reset) that can find it?`, num(v / k), `${v}/${k} = ${v / k} cycles. Bounded model checking explores every input sequence up to that depth.`, 'How many increments to reach it?');
    }
    const a = pick(r, [4, 6, 8, 9]), b = pick(r, [10, 12, 15]);
    return ask(`Two free-running counters start at 0 together: one counts modulo ${a}, the other modulo ${b}. A bug needs both to be 0 again at the same time. After how many cycles?`, num(lcm(a, b)), `lcm(${a}, ${b}) = ${lcm(a, b)}. Deep, rare states like this are where formal beats random simulation.`, 'Least common multiple.');
  },
  (r) => {
    const qs = [
      ['A proof passes instantly. The environment has `assume property (!valid_in);`. What went wrong?', 'The assumption over-constrains the inputs: valid never arrives, so every assertion passes vacuously', ['Nothing, the design is correct', 'The tool crashed', 'Formal cannot handle valid signals']],
      ['What does a bounded proof of depth 30 guarantee?', 'No failure is reachable within 30 cycles of reset, and nothing beyond that', ['The property holds forever', 'Nothing at all', 'The design is equivalent to the RTL']],
      ['What does logical equivalence checking (LEC) compare?', 'Two versions of a design (e.g. RTL vs netlist) at matched key points: flops and outputs', ['Timing of two netlists', 'Two testbenches', 'Coverage databases']],
      ['Why write `cover property` in a formal setup?', 'To prove the interesting scenarios are reachable under the assumptions (a sanity check against over-constraint)', ['To collect functional coverage for simulation only', 'To make proofs faster', 'Cover is the same as assert']],
      ['Induction (k-induction) can prove a property for all depths. What often makes it fail spuriously?', 'Unreachable starting states: add helper invariants (lemmas) that rule them out', ['Too many assumptions', 'Too few flops', 'Using |=>']],
      ['In formal verification of a block, properties about its inputs should be…', 'Assumptions (constraints on the environment); properties about its outputs are assertions', ['Assertions', 'Covers', 'Ignored']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ DFT

const TAP: [string, string, string][] = [
  ['Test-Logic-Reset', 'Shift-DR', '0100'],
  ['Test-Logic-Reset', 'Shift-IR', '01100'],
  ['Run-Test/Idle', 'Shift-DR', '100'],
  ['Run-Test/Idle', 'Shift-IR', '1100'],
  ['Shift-DR', 'Update-DR', '11'],
  ['Shift-DR', 'Run-Test/Idle', '110'],
];

export const dftPractice = practice('practice-dft', 'Test Drills', 'stuck-at tests, fault coverage, scan time, defect level, MBIST, JTAG', [
  (r, d) => {
    const gate = pick(r, d === 3 ? ['AND3', 'OR3', 'NAND3', 'NOR3'] : ['AND', 'OR', 'NAND', 'NOR']);
    const n = d === 3 ? 3 : 2, names = ['A', 'B', 'C'].slice(0, n);
    const pin = d === 1 ? 0 : between(r, 0, n - 1), sv = between(r, 0, 1);
    const nc = gate.startsWith('AND') || gate.startsWith('NAND') ? 1 : 0;
    const v = names.map((_, i) => (i === pin ? 1 - sv : nc)).join('');
    return ask(`Which input vector (${names.join('')}) detects input ${names[pin]} stuck-at-${sv} on a ${n}-input ${gate.replace(/\d$/, '')} gate?`, exact(v), `Activate the fault: drive ${names[pin]} to ${1 - sv}. Propagate it: hold the other input${n > 2 ? 's' : ''} at the non-controlling value (${nc} for ${nc ? 'AND/NAND' : 'OR/NOR'}). Vector ${v}: the good and faulty outputs differ.`, 'Set the pin opposite to the stuck value; others to the non-controlling value.');
  },
  (r, d) => {
    if (d < 3) {
      const tot = pick(r, [20000, 50000, 100000]), det = tot - between(r, 100, tot / 20);
      return ask(`ATPG detects ${det.toLocaleString('en-US')} of ${tot.toLocaleString('en-US')} stuck-at faults. Fault coverage, in %?`, qty((det / tot) * 100, '%', 0.001, sig((det / tot) * 100, 4)), `${det}/${tot} = ${sig((det / tot) * 100, 4)}%. Production usually wants 99%+ for stuck-at.`, 'Detected / total.');
    }
    const Y = pick(r, [0.8, 0.85, 0.9]), T = pick(r, [0.98, 0.99, 0.995]);
    const DL = 1 - Y ** (1 - T);
    return ask(`Yield Y = ${Y * 100}%, fault coverage T = ${T * 100}%. Using Williams-Brown, DL = 1 - Y^(1-T), how many defective parts per million ship?`, qty(DL * 1e6, '', 0.02, sig(DL * 1e6)), `1 - ${Y}^${sig(1 - T)} = ${sig(DL)} → ${sig(DL * 1e6)} DPPM. Automotive targets are near 1 DPPM, which is why coverage must approach 100%.`, 'Compute Y^(1-T) and subtract from 1.');
  },
  (r, d) => {
    const F = pick(r, [100000, 500000, 2000000]), C = pick(r, [100, 200, 400, 800]);
    const L = Math.ceil(F / C);
    if (d === 1) return ask(`${F.toLocaleString('en-US')} scan flops are split evenly into ${C} chains. How many shift cycles to load one pattern?`, num(L), `⌈${F}/${C}⌉ = ${L} cycles. More chains, shorter shifts, but each chain needs a pin (or a compressor).`, 'Flops per chain.');
    const P = pick(r, [5000, 10000, 20000]), f = pick(r, [25, 50, 100]);
    const cyc = P * (L + 1) + L;
    return ask(`Chains are ${L} flops long. ${P.toLocaleString('en-US')} patterns, each one shift plus one capture cycle, with the unload of one pattern overlapping the load of the next. Scan clock ${f} MHz. Test time, in ms?`, qty((cyc / (f * 1e6)) * 1000, 'ms', 0.02), `Cycles ≈ P·(L + 1) + L = ${cyc.toLocaleString('en-US')} → ${sig((cyc / (f * 1e6)) * 1000)} ms. Tester time is money: that is what compression is for.`, 'P × (L + 1) + L cycles, divided by the clock.');
  },
  (r, d) => {
    const N = pick(r, [64, 256, 1024]) * 1024, f = pick(r, [200, 500, 1000]);
    const ops = tier(d, 4, 10, 10);
    const name = tier(d, 'MATS (4N)', 'March C- (10N)', 'March C- (10N)');
    const banks = d === 3 ? pick(r, [2, 4]) : 1;
    const t = (ops * N) / banks / (f * 1e6);
    return ask(`MBIST runs ${name} on a ${N >= 1048576 ? `${N / 1048576}M` : `${N / 1024}K`}-word SRAM at ${f} MHz${banks > 1 ? `, testing ${banks} equal banks in parallel` : ''}. Test time, in ms?`, qty(t * 1000, 'ms', 0.02), `${ops}N = ${ops * N} operations${banks > 1 ? ` / ${banks}` : ''} at ${f} MHz = ${sig(t * 1000)} ms. March tests catch stuck-at, transition and many coupling faults in the array.`, 'Operations = k × N; divide by frequency.');
  },
  (r, d) => {
    if (d === 1) return ask('From any TAP state, how many clocks with TMS = 1 guarantee you reach Test-Logic-Reset?', num(5), 'Five TMS = 1 clocks reach Test-Logic-Reset from any of the 16 states. That is how a tester recovers the TAP no matter what.', 'It is the longest escape path.');
    const [from, to, seq] = pick(r, TAP);
    return ask(`JTAG TAP: which TMS sequence (one bit per TCK) goes from ${from} to ${to}?`, exact(seq), `${from} → ${to}: TMS ${seq.split('').join(', ')}. From Run-Test/Idle, 1 goes to Select-DR-Scan, another 1 to Select-IR-Scan, then 0 to Capture, 0 to Shift.`, 'Draw the TAP state diagram: 1 moves toward the IR side and exits, 0 goes deeper.');
  },
  (r) => {
    const qs = [
      ['Why do transition-delay faults need at-speed testing?', 'They model slow-to-rise/fall defects, so the launch and capture must be one functional clock period apart', ['They are stuck-at faults', 'Tester clocks are too fast', 'They only occur in SRAM']],
      ['What does scan compression do?', 'Feeds many short internal chains from a few tester pins through a decompressor, and compacts the outputs, cutting test time and data', ['Compresses the netlist', 'Removes flops', 'Speeds up the functional clock']],
      ['What does scan insertion change in each flop?', 'Adds a mux so it can load from the previous flop in the chain (shift mode) instead of its functional input', ['Removes the clock', 'Doubles its size for redundancy', 'Nothing']],
      ['Why is logic BIST (LBIST) used in cars?', 'The chip can test itself in the field (at key-on), which safety standards require', ['It replaces ATPG completely', 'It is faster than scan on the tester', 'It tests the SRAM only']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
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
    mc('Which check would have caught this on day one?', ['At the end of the test, require that the number of compared transactions equals the number sent, and that both queues are empty', 'A longer timeout', 'More random seeds', 'Turning on waveform dumping'], 0, 'A scoreboard must prove it did work: count checks, and fail on leftovers or zero.'),
    mc('After connecting it, 1000 packets are expected but 998 arrive. The loop above reports…', ['Nothing: it only iterates over actual_q, so the 2 missing packets are never reported', 'Two mismatches', 'A fatal error', '998 mismatches'], 0, 'Loop bounds hide missing items. Check the queue sizes explicitly.'),
    mc('The DUT legally reorders packets between its two output ports. The in-order scoreboard now fails. Right fix?', ['Match by packet ID: store expected items in an associative array keyed by ID, and remove them as they arrive', 'Sort both queues at the end', 'Disable the scoreboard for that port', 'Only send one packet at a time'], 0, 'Out-of-order scoreboards match on a key, then check leftovers at the end.'),
    { t: 'gen', make: () => ask('The reference model computes an 8-bit additive checksum (sum mod 256). For payload bytes 0x12, 0xF0, 0x33, 0x80, what is it (hex)?', hexa(0xb5, 2), '0x12 + 0xF0 + 0x33 + 0x80 = 0x1B5 → 0xB5 modulo 256.') },
    mc('Who should write that reference model?', ['A verification engineer working from the spec, independently of the RTL', 'The RTL designer, by translating the RTL', 'Nobody: compare against the RTL itself', 'The synthesis tool'], 0, 'Independence is the point: a copied misunderstanding passes every check.'),
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
    mc('What does z get on each edge?', ['Either the old or the new tmp, depending on which always block the simulator runs first: a race', 'Always the new tmp', 'Always the old tmp', 'X'], 0, 'Blocking writes read by another block at the same edge race. Adding a $display changes scheduling, which is why the bug "moved".'),
    mc('The counter\'s enable comes from the testbench, driven with a blocking assignment exactly at posedge clk. Fix?', ['Drive it through a clocking block (or with <= / after the edge) so the DUT always samples the pre-edge value', 'Add a #1 delay inside the DUT', 'Make the counter use blocking assignments', 'Run with a different simulator'], 0, 'Clocking blocks exist precisely to remove TB/DUT races.'),
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
    mc('Someone adds `constraint c_eth { len inside {[64:1500]}; }`. What happens?', ['The constraints are unsatisfiable (len is 8 bits, max 255): randomize() returns 0 and len keeps its old value', 'len wraps to fit', 'The solver picks 255', 'Compile error'], 0, 'Always check the return value: `if (!p.randomize()) `uvm_fatal(...)`.'),
    { t: 'gen', make: () => ask('A command kind uses `kind dist { READ := 60, WRITE := 30, [CFG0:CFG3] :/ 10 };`. P(kind == CFG2), in %?', qty(2.5, '%', 0.01, '2.5'), ':/ 10 shares the weight across 4 values: 2.5 each. Total 100, so 2.5%.') },
    { t: 'gen', make: () => ask('A `randc bit [2:0] port;` is randomized 16 times. How many times is port 5 chosen?', num(2), 'randc visits all 8 values before repeating: exactly twice in 16 calls.') },
    mc('The base class says `constraint c_len { soft len <= 64; }`. A test does `p.randomize() with { len == 200; }`. Result?', ['len = 200: the inline constraint overrides the soft one', 'Randomization fails', 'len = 64', 'len is random 0-64'], 0, 'soft constraints are defaults that tests can override, exactly for this.'),
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
    mc('cp_size never hits 8. The stimulus class, copied from an older design, says `constraint c_size { size inside {1, 2, 4}; }`. What is the right fix?', ['Fix the constraint so size 8 is generated: the hole is a stimulus gap, not a reason to change the coverage model', 'Add size 8 to ignore_bins', 'Lower the coverage goal to 90%', 'Run more seeds'], 0, 'Read the constraints next to the coverage model; holes usually point at stimulus. Only waive bins the spec says cannot happen.'),
    { t: 'gen', make: () => ask('Once fixed, size is uniform over 4 values. On average how many transactions until all 4 size bins are hit?', qty(4 * (1 + 1 / 2 + 1 / 3 + 1 / 4), '', 0.03, sig(4 * (1 + 1 / 2 + 1 / 3 + 1 / 4))), '4 × (1 + 1/2 + 1/3 + 1/4) = 8.33.') },
    mc('Code coverage is 100%, functional coverage 100%. Is the block done?', ['Only if every coverage item maps to the test plan and every check (scoreboard, assertions) was active: coverage without checking proves nothing', 'Yes', 'No, coverage must be 110%', 'Only after gate-level simulation'], 0, 'Coverage says what happened; checkers say whether it was right. Sign-off needs both.'),
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
    mc('The test passes at 0 ns with no traffic. Most likely cause?', ['No objection is raised in run_phase, so the phase ends immediately', 'The clock is not running', 'The DUT is in reset', 'The scoreboard is disabled'], 0, 'phase.raise_objection(this) before starting sequences, drop after.'),
    { t: 'gen', make: () => ask('Fixed: the test raises at 0 ns, the sequence finishes at 850 ns, the test drops at 900 ns, drain time 100 ns. When does run_phase end, in ns?', num(1000), '900 + 100 = 1000 ns.') },
    art(`class my_agent extends uvm_agent;
  function void build_phase(uvm_phase phase);
    drv = my_driver::new("drv", this);
  endfunction`),
    mc('The test did `set_type_override_by_type(my_driver::get_type(), err_driver::get_type())`, but no errors are injected. Why?', ['The agent calls new() instead of my_driver::type_id::create(), bypassing the factory', 'Overrides only work on sequences', 'The override must be set in connect_phase', 'err_driver must be a sequence'], 0, 'Only type_id::create consults the factory.'),
    mc('The test does `uvm_config_db#(virtual bus_if)::set(this, "env.agt*", "vif", vif)`. agent "uvm_test_top.env.mon_agt.mon" gets null. Why?', ['"env.agt*" does not match "env.mon_agt...": the path glob must start with agt', 'config_db only works for drivers', 'Monitors cannot use interfaces', 'set must be called in run_phase'], 0, 'Glob patterns match the full hierarchical path; use "env.*" or set it per agent.'),
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
    mc('Which property encodes "granted 1 to 3 cycles after req rises"?', ['$rose(req) |-> ##[1:3] gnt', 'req |-> gnt', 'req |=> ##3 gnt', 'gnt |-> $past(req, 3)'], 0, '$rose starts one attempt per request; ##[1:3] is the window.'),
    mc('Which encodes "req must stay high until gnt"?', ['req && !gnt |=> req', 'req |-> ##1 req', '$fell(req) |-> gnt', 'req throughout gnt'], 0, 'While requesting and not yet granted, req must still be high next cycle.'),
    art(`cycle   0  1  2  3  4  5  6  7  8  9 10 11
req     0  1  1  1  1  0  0  1  1  1  1  1
gnt     0  0  0  0  1  0  0  0  0  0  0  1`),
    { t: 'gen', make: () => ask('For `$rose(req) |-> ##[1:3] gnt`, at which cycle does the first failing attempt start? ("none" if it passes)', num(7), 'Rises at 1 and 7. Attempt 1: gnt at 4, inside 2-4 ✓. Attempt 7: needs gnt in 8-10: none ✗. It fails at cycle 10, for the attempt that started at 7.') },
    { t: 'gen', make: () => ask('How many attempts of `$rose(req) |-> ##[1:3] gnt` start in those 12 cycles?', num(2), 'Two rising edges of req: cycles 1 and 7. The other 10 cycles are vacuous.') },
    mc('`gnt |-> req` checks the arbiter\'s output. When formally verifying the ARBITER, what are the req-side rules (e.g. req stays high until gnt)?', ['Assumptions: they constrain the arbiter\'s inputs; gnt rules are assertions', 'Assertions', 'Covers', 'They are not needed'], 0, 'Assume the environment, assert the design. Swap roles when verifying the requester.'),
    mc('The team\'s assertion `req |-> ##[1:3] gnt` (no $rose) fails constantly on legal traffic. Why?', ['It starts a new attempt every cycle req is high, so a request held 4 cycles demands grants the spec never promised', 'It is correct; the DUT is wrong', '|-> should be |=>', 'Assertions cannot use ranges'], 0, 'Without $rose, a long request spawns many overlapping attempts.'),
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
    mc('Why did everything prove in 3 seconds?', ['The second assumption forbids valid_in forever, so no traffic ever reaches the design: every assertion is vacuous', 'The design is simple', 'Formal tools are fast', 'The first assumption is wrong'], 0, 'Over-constraint is the most common formal mistake.'),
    mc('Which check would have exposed it automatically?', ['A cover property like `cover property (valid_in && ready_out)`: it would be unreachable', 'Running more properties', 'Increasing the depth', 'Switching to simulation'], 0, 'Always prove your covers reachable before trusting proofs.'),
    { t: 'gen', make: () => ask('After the fix, a 32-bit timeout counter must reach 0xFFFFFFFF to trigger a suspected bug. How many cycles after reset (minimum BMC depth)?', num(4294967295), '2^32 - 1 = 4,294,967,295 cycles: far beyond any bounded search.') },
    mc('How do you check that overflow bug formally?', ['Abstract the counter: reduce its width via a parameter, or let it start from any value (a free initial state) and prove the property under that abstraction', 'Run BMC for 4 billion cycles', 'Give up; formal cannot do it', 'Simulate one random seed'], 0, 'Abstraction makes deep states shallow, soundly if done carefully.'),
    { t: 'gen', make: () => ask('Two FSM counters (modulo 6 and modulo 10) start at 0. The bug needs both at 0 again at the same time. After how many cycles?', num(30), 'lcm(6, 10) = 30.') },
    mc('The tool now reports "bounded proof, depth 40" for one property. What may you claim?', ['No violation exists within 40 cycles of reset; not a full proof', 'The property is fully proven', 'The property fails', 'Nothing'], 0, 'Say exactly what was proven. Full proofs need induction or a known diameter.'),
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
    mc('GPU outputs go into PD_TOP. What must sit on them?', ['Isolation cells, enabled before the GPU turns off, clamping to safe values', 'Level shifters only', 'Retention flops', 'Nothing'], 0, 'Off domains drive X; isolation contains it.'),
    mc('DSP (0.6 V) outputs go into PD_TOP (0.8 V). What must sit on them?', ['Low-to-high level shifters', 'Isolation cells', 'Nothing, 0.6 V is a valid 1', 'Retention flops'], 0, 'A 0.6 V high may leave 0.8 V PMOS partly on: leakage and wrong levels.'),
    mc('GPU (switchable 0.8 V) outputs go into DSP (0.6 V). What do they need?', ['Both isolation and level shifting (often a combined cell)', 'Only isolation', 'Only level shifting', 'Nothing'], 0, 'Different voltage AND switchable source.'),
    mc('Correct power-DOWN order for the GPU?', ['Stop clocks → save retention → enable isolation → open the power switch', 'Open the switch → enable isolation → save', 'Enable isolation → open the switch → save retention', 'Save → open the switch → stop clocks'], 0, 'Power-up reverses it: switch on and wait for the rail, restore, release isolation, restart clocks.'),
    mc('Power-aware simulation shows the 12 control registers are X after wake-up. Most likely cause?', ['Restore was never asserted (or asserted before the rail was stable), so retention flops did not restore', 'Isolation was missing', 'Level shifters were missing', 'The clock is too fast'], 0, 'Retention needs the right save/restore sequence, and power-aware sim checks it.'),
    { t: 'gen', make: () => ask('The GPU rail has 10 nF of capacitance and the switch brings it to 0.8 V in 2 µs. Average in-rush current, in mA?', qty(4, 'mA', 0.01, '4'), 'I = C·dV/dt = 10 nF × 0.8 V / 2 µs = 4 mA. Faster switching makes a bigger spike on the always-on rail, which is why switches turn on in a daisy chain.') },
  ],
  recap: ['Isolation for off domains.', 'Level shifters across voltages.', 'Power-down/up sequencing.', 'Retention restore and in-rush.'],
});

export const VERIFICATION_BOSSES = [tbBoss, debugBoss, crvBoss, coverageBoss, uvmBoss, svaBoss, formalBoss, dftBoss, upfBoss];

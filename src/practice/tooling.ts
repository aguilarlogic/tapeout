// Practice banks and bosses for the engineer's toolbox: shell and regex, git, Python, TCL/Make flows.
import { has, num, qty, rx } from '../lessons/answers';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { exact, mcs, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';

// ------------------------------------------------------------------ shell & regex

const REGEX_TASKS = [
  // [difficulty, task, canonical, should match, should not match]
  [1, 'lines containing ERROR in capitals', 'ERROR', ['UVM_ERROR @ 10ns: bad', 'ERROR: timeout'], ['error: lower case', 'WARNING: slow']],
  [1, 'a seed written like seed=12345 (seed= then at least one digit)', 'seed=[0-9]+', ['seed=1', 'run 4 seed=98765 ok'], ['seed=', 'seed=abc']],
  [1, 'test names that end in _test', '_test$', ['fifo_test', 'axi_burst_test'], ['fifo_test_old', 'testbench', 'test_fifo']],
  [2, 'hex numbers like 0x1F, 0xdeadBEEF or 0x0', '0x[0-9a-fA-F]+', ['0x1F', 'val=0xdeadBEEF', '0x0'], ['0x', '1F', '0xZZ']],
  [2, 'lines that START with UVM_ERROR or UVM_FATAL', '^UVM_(ERROR|FATAL)', ['UVM_ERROR x', 'UVM_FATAL y'], ['  UVM_ERROR', 'UVM_WARNING z', 'x UVM_FATAL']],
  [2, 'simulation timestamps like "@ 1234 ns" (an @, a space, digits, a space, ns)', '@ [0-9]+ ns', ['@ 10 ns', 'at @ 123456 ns'], ['@ ns', '@ 12 ps', '@12ns']],
  [3, 'bus references like data_q[7] or addr[15:0]', '\\w+\\[\\d+(:\\d+)?\\]', ['data_q[7]', 'addr[15:0]', 'x[0]'], ['data_q[]', 'addr[15:]', 'data_q']],
  [3, "Verilog sized literals like 8'hFF, 4'b1010 or 32'd7", "[0-9]+'[bdh][0-9a-fA-F_]+", ["8'hFF", "4'b1010", "32'd7"], ["'hFF", "8'q12", "8'h"]],
  [3, 'lines that do NOT contain PASS anywhere', '^(?!.*PASS)', ['FAIL fifo_test', 'timeout in axi'], ['PASS fifo_test', 'test 3 PASS']],
] as const;

const TESTS = ['fifo_test', 'axi_test', 'dma_test', 'irq_test', 'cdc_test'];
function results(r: Rng, n: number) {
  return Array.from({ length: n }, () => ({ t: pick(r, TESTS), ok: r() < 0.55, seed: between(r, 1000, 9999) }));
}

const PERM = (bits: number) => (bits & 4 ? 'r' : '-') + (bits & 2 ? 'w' : '-') + (bits & 1 ? 'x' : '-');

export const shellPractice = practice('practice-shell', 'Shell Drills', 'regex, pipes, grep/sort/uniq, permissions', [
  (r, d) => {
    const [, task, canon, pos, neg] = pick(r, REGEX_TASKS.filter((x) => x[0] === d));
    return ask(`Write a regular expression that matches ${task}.\nMust match: ${pos.map((x) => `\`${x}\``).join(', ')}\nMust not match: ${neg.map((x) => `\`${x}\``).join(', ')}`, rx(canon, [...pos], [...neg]), `One answer: \`${canon}\`. I test yours against every example, so any correct pattern passes.`, 'Anchors: ^ start, $ end. Classes: [0-9], \\w, \\d. Repeats: + one or more, * zero or more.');
  },
  (r, d) => {
    const rows = results(r, tier(d, 6, 8, 10));
    const log = rows.map((x) => `${x.t} ${x.ok ? 'PASS' : 'FAIL'} seed=${x.seed}`).join('\n');
    if (d === 1) {
      const n = rows.filter((x) => !x.ok).length;
      return ask(`results.txt:${code(log)}What does \`grep -c FAIL results.txt\` print?`, num(n), `-c counts matching lines: ${n}.`, 'Count the lines containing FAIL.');
    }
    if (d === 2) {
      const n = new Set(rows.filter((x) => !x.ok).map((x) => x.t)).size;
      return ask(`results.txt:${code(log)}What does \`grep FAIL results.txt | cut -d' ' -f1 | sort -u | wc -l\` print?`, num(n), `grep keeps the failing lines, cut takes the test name, sort -u removes duplicates, wc -l counts: ${n} distinct failing tests.`, 'How many different test names failed?');
    }
    const counts = new Map<string, number>();
    rows.forEach((x) => counts.set(x.t, (counts.get(x.t) ?? 0) + 1));
    const top = Math.max(...counts.values());
    return ask(`results.txt:${code(log)}\`cut -d' ' -f1 results.txt | sort | uniq -c | sort -rn | head -1\` prints a count and a name. What is the count?`, num(top), `uniq -c counts adjacent duplicates (hence the sort first), sort -rn orders by count, head -1 takes the biggest: ${top}. This one-liner is the classic "what fails most?" triage.`, 'Which test name appears most often, and how many times?');
  },
  (r, d) => {
    const tasks = [
      [1, 'Show the last 50 lines of run.log.', 'tail -n 50 run.log', [['tail'], ['50'], ['run.log']]],
      [1, 'Count the lines in run.log that contain UVM_ERROR.', 'grep -c UVM_ERROR run.log', [['grep'], ['-c', 'wc -l'], ['uvm_error'], ['run.log']]],
      [1, 'Keep printing new lines of run.log as the simulation writes them.', 'tail -f run.log', [['tail'], ['-f', '-F', '--follow'], ['run.log']]],
      [2, 'Find every file named *.sv under the rtl directory.', 'find rtl -name "*.sv"', [['find'], ['rtl'], ['-name', '-iname'], ['.sv']]],
      [2, 'Replace every "clk_old" with "clk_core" in top.sv, in place.', "sed -i 's/clk_old/clk_core/g' top.sv", [['sed'], ['-i'], ['s/clk_old/clk_core/'], ['top.sv']]],
      [2, 'Search recursively for "fifo_full" in every file under rtl/, showing line numbers.', 'grep -rn fifo_full rtl/', [['grep'], ['-r', '-R', '--recursive', '-nr', '-nR'], ['-n', '-rn', '-Rn', '--line-number'], ['fifo_full'], ['rtl']]],
      [3, 'Print only the 3rd whitespace-separated column of report.txt, for lines whose 2nd column is FAIL.', "awk '$2 == \"FAIL\" {print $3}' report.txt", [['awk'], ['$2'], ['fail'], ['print $3'], ['report.txt']]],
      [3, 'Run make, and only if it succeeds, run ./sim.', 'make && ./sim', [['make'], ['&&'], ['./sim']]],
      [3, 'Send both stdout and stderr of ./sim into sim.log.', './sim > sim.log 2>&1', [['./sim'], ['sim.log'], ['2>&1', '&>']]],
    ] as const;
    const [, task, canon, toks] = pick(r, tasks.filter((x) => x[0] === d));
    return ask(`Write the command: ${task}`, has(canon, ...toks.map((t) => [...t])), `One answer: \`${canon}\`.`, 'Think of the tool first (tail, grep, find, sed, awk), then its flags.');
  },
  (r, d) => {
    const bits = [between(r, 4, 7), between(r, 0, 7), between(r, 0, 7)];
    const oct = bits.join('');
    const str = bits.map(PERM).join('');
    if (d === 1) return ask(`What permission string does \`chmod ${oct} file\` give? (like rwxr-xr-x)`, exact(str), `Each digit is r=4 + w=2 + x=1, for user, group, others: ${oct} → ${str}.`, 'Split each digit into 4 + 2 + 1.');
    return ask(`A file shows \`-${str}\`. What octal mode is that?`, num(parseInt(oct, 10)), `${str.slice(0, 3)} = ${bits[0]}, ${str.slice(3, 6)} = ${bits[1]}, ${str.slice(6)} = ${bits[2]} → ${oct}.${d === 3 ? ' Scripts need x to run; shared project directories often need g+w too.' : ''}`, 'r = 4, w = 2, x = 1, per group of three.');
  },
  (r) => {
    const qs = [
      ['`grep FAIL log.txt` finds nothing. What is `$?` afterwards?', '1', ['0', '2', '-1'], 'grep exits 0 on a match, 1 on no match, 2 on an error. Scripts use this: `grep -q FAIL log && echo broken`.'],
      ['What is the difference between `>` and `>>`?', '> overwrites the file, >> appends to it', ['> appends, >> overwrites', 'They are identical', '>> redirects stderr'], 'Redirect with care: `>` on the wrong file erases it.'],
      ['`cmd1 ; cmd2` versus `cmd1 && cmd2`?', '; always runs cmd2; && runs cmd2 only if cmd1 succeeded', ['They are identical', '&& runs them in parallel', '; runs cmd2 only on failure'], 'Build scripts chain with && so a failed step stops the flow.'],
      ['What does `2>&1` mean?', 'Send stderr (2) to wherever stdout (1) currently goes', ['Run two commands', 'Append to file 1', 'Swap stdin and stdout'], 'Order matters: `> log 2>&1` captures both, `2>&1 > log` does not.'],
      ['How do you run a long regression so it survives logging out?', 'Use nohup, tmux/screen, or submit it to the farm scheduler', ['Close the terminal quickly', 'Run it with sudo', 'Use Ctrl+Z'], 'Compute farms (LSF, Slurm) are the norm for real regressions.'],
      ['What does `xargs` do in `find . -name "*.log" | xargs grep -l FAIL`?', 'Turns the list of file names on stdin into arguments for grep', ['Deletes the files', 'Sorts the list', 'Counts the files'], 'find | xargs is the standard way to run a command over many files.'],
    ] as const;
    const [q, right, wrong, why] = pick(r, qs);
    return mcs(r, q, right, wrong, why);
  },
]);

// ------------------------------------------------------------------ git

export const gitPractice = practice('practice-git', 'Git Drills', 'commits, branches, merge vs rebase, bisect, recovery', [
  (r, d) => {
    const n = pick(r, tier(d, [8, 16, 100], [300, 1000, 50], [5000, 12345, 777]));
    const k = Math.ceil(Math.log2(n));
    return ask(`A test broke somewhere in the last ${n} commits. At most how many test runs does \`git bisect\` need?`, num(k), `Each run halves the range: ceil(log2(${n})) = ${k}. With \`git bisect run ./test.sh\` it runs unattended.`, 'Binary search: log2 of the number of commits.');
  },
  (r, d) => {
    const m = between(r, tier(d, 0, 1, 2), tier(d, 3, 5, 9)), f = between(r, 1, tier(d, 3, 5, 8));
    const qs = [
      [`git log --oneline main..feature | wc -l`, f, `main..feature lists commits reachable from feature but not main: the ${f} feature commits.`],
      [`git log --oneline feature..main | wc -l`, m, `feature..main lists commits on main that feature lacks: ${m}.`],
    ] as const;
    if (d === 3) {
      return ask(`feature branched from main; since then main got ${m} commits and feature got ${f}. You run \`git rebase main\` on feature. How many commits are now in \`git log main..feature\`?`, num(f), `Rebase replays the ${f} feature commits on top of main (new hashes, same changes). main..feature still shows ${f}; feature..main is now 0.`, 'Rebase moves the feature commits; it does not add or remove any.');
    }
    const [cmd, ans, why] = pick(r, qs);
    return ask(`feature branched from main; since then main got ${m} commit${m === 1 ? '' : 's'} and feature got ${f}. What does \`${cmd}\` print?`, num(ans), why, 'A..B means "in B but not in A".');
  },
  (r, d) => {
    const tasks = [
      [1, 'Stage every change in the rtl directory.', 'git add rtl', [['git add'], ['rtl']]],
      [1, 'Create and switch to a new branch called fix-fifo.', 'git switch -c fix-fifo', [['git'], ['switch -c', 'checkout -b'], ['fix-fifo']]],
      [1, 'Show what you changed but have not staged yet.', 'git diff', [['git diff']]],
      [2, 'Undo your last commit but keep its changes staged.', 'git reset --soft HEAD~1', [['git reset'], ['--soft'], ['head~1', 'head^']]],
      [2, 'Undo a commit (abc123) that is already pushed, safely, by adding a new commit.', 'git revert abc123', [['git revert'], ['abc123']]],
      [2, 'Temporarily shelve your uncommitted changes.', 'git stash', [['git stash']]],
      [3, 'Copy one commit (def456) from another branch onto yours.', 'git cherry-pick def456', [['git cherry-pick'], ['def456']]],
      [3, 'Find the commit where HEAD pointed before a bad reset, so you can recover it.', 'git reflog', [['git reflog']]],
      [3, 'Show who last changed each line of fifo.sv.', 'git blame fifo.sv', [['git blame', 'git annotate'], ['fifo.sv']]],
    ] as const;
    const [, task, canon, toks] = pick(r, tasks.filter((x) => x[0] === d));
    return ask(`Write the git command: ${task}`, has(canon, ...toks.map((t) => [...t])), `One answer: \`${canon}\`.`, 'git <verb> <options> <target>.');
  },
  (r) => {
    const qs = [
      ['You and a colleague both work on the shared branch `dev`. Should you rebase `dev`?', 'No: rebasing rewrites commits other people already have; merge instead', ['Yes, always rebase shared branches', 'Only on Fridays', 'Rebasing and merging are identical'], 'Golden rule: never rewrite history others have pulled.'],
      ['A file shows `<<<<<<< HEAD … ======= … >>>>>>> feature`. What is between `<<<<<<< HEAD` and `=======`?', 'Your current branch\'s version of the conflicting lines', ['The feature branch\'s version', 'The common ancestor', 'A git error message'], 'Edit to the correct result, delete the markers, `git add`, then continue.'],
      ['What does "detached HEAD" mean?', 'You checked out a commit directly, not a branch; new commits will not belong to any branch unless you create one', ['The repository is corrupted', 'HEAD was deleted', 'You are offline'], 'Make a branch (`git switch -c name`) before committing if you want to keep the work.'],
      ['Why keep build outputs and waveforms out of git with `.gitignore`?', 'They are huge, regenerable and change every run, bloating history forever', ['git cannot store binary files', 'They are secret', 'They slow down the simulator'], 'Commit sources and scripts; regenerate outputs.'],
      ['What does a fast-forward merge do?', 'Moves the branch pointer forward because there is no divergent history, creating no merge commit', ['Squashes all commits', 'Deletes the source branch', 'Creates a merge commit with two parents'], 'Possible only when the target has not moved since the branch point.'],
    ] as const;
    const [q, right, wrong, why] = pick(r, qs);
    return mcs(r, q, right, wrong, why);
  },
]);

// ------------------------------------------------------------------ Python

export const pythonPractice = practice('practice-python', 'Python Drills', 'predict the output: lists, dicts, strings, ints, comprehensions', [
  (r, d) => {
    const a = Array.from({ length: 6 }, () => between(r, 0, 9));
    const variants = [
      [1, 'a[1:4]', a.slice(1, 4)],
      [1, 'a[-2:]', a.slice(-2)],
      [2, 'a[::2]', a.filter((_, i) => i % 2 === 0)],
      [2, 'a[:-1]', a.slice(0, -1)],
      [3, 'a[::-1][1:3]', [...a].reverse().slice(1, 3)],
      [3, 'sorted(a)[-3:]', [...a].sort((x, y) => x - y).slice(-3)],
    ] as const;
    const [, e, v] = pick(r, variants.filter((x) => x[0] === d));
    const out = `[${v.join(', ')}]`;
    return ask(`${code(`a = [${a.join(', ')}]\nprint(${e})`)}What does this print?`, exact(out), `${e} → ${out}. Slices are [start:stop:step], stop excluded; negative indexes count from the end.`, 'Index 0 is the first item; the stop index is not included.');
  },
  (r, d) => {
    const n = between(r, 5, tier(d, 8, 12, 20)), k = between(r, 2, 4);
    const xs = Array.from({ length: n }, (_, i) => i).filter((x) => x % k === 0);
    const v = d === 1 ? xs.length : d === 2 ? xs.reduce((s, x) => s + x, 0) : xs.reduce((s, x) => s + x * x, 0);
    const e = d === 1 ? `len([x for x in range(${n}) if x % ${k} == 0])` : d === 2 ? `sum(x for x in range(${n}) if x % ${k} == 0)` : `sum(x * x for x in range(${n}) if x % ${k} == 0)`;
    return ask(`${code(`print(${e})`)}Output?`, num(v), `range(${n}) is 0..${n - 1}; multiples of ${k}: [${xs.join(', ')}] → ${v}.`, `range(n) stops at n - 1.`);
  },
  (r, d) => {
    const words = Array.from({ length: tier(d, 5, 7, 9) }, () => pick(r, ['ERROR', 'WARN', 'INFO', 'FATAL']));
    const key = pick(r, words);
    const counts: Record<string, number> = {};
    words.forEach((w) => (counts[w] = (counts[w] ?? 0) + 1));
    if (d < 3) return ask(`${code(`counts = {}\nfor w in ${JSON.stringify(words).replace(/"/g, "'").replace(/,/g, ', ')}:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts['${key}'])`)}Output?`, num(counts[key]), `'${key}' appears ${counts[key]} times. \`get(w, 0)\` returns 0 for keys not seen yet.`, 'Count how often the key appears.');
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1] || words.indexOf(x[0]) - words.indexOf(y[0]))[0];
    return ask(`${code(`from collections import Counter\nc = Counter(${JSON.stringify(words).replace(/"/g, "'").replace(/,/g, ', ')})\nprint(c.most_common(1)[0][1])`)}Output?`, num(top[1]), `most_common(1) is [(${JSON.stringify(top[0]).replace(/"/g, "'")}, ${top[1]})], and [0][1] is the count: ${top[1]}.`, 'The count of the most frequent item.');
  },
  (r, d) => {
    const x = between(r, 1, 255);
    const w = pick(r, [8, 12, 16]);
    const variants = [
      [1, `f"{${x}:x}"`, x.toString(16)],
      [1, `bin(${x})`, '0b' + x.toString(2)],
      [2, `f"{${x}:0${w}b}"`, x.toString(2).padStart(w, '0')],
      [2, `hex(${x} << 4)`, '0x' + (x << 4).toString(16)],
      [3, `f"{${x}:#06x}"`, '0x' + x.toString(16).padStart(4, '0')],
      [3, `int("${x.toString(16)}", 16) + int("101", 2)`, String(x + 5)],
    ] as const;
    const [, e, v] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`${code(`print(${e})`)}Output?`, exact(v, `'${v}'`), `${e} → ${v}. Format specs: x hex, b binary, 0Nb zero-pad to N, # adds the 0x prefix (counted in the width).`, 'Work it out in binary or hex first.');
  },
  (r, d) => {
    const a = between(r, 5, 20), b = between(r, 2, 6);
    const pyDiv = Math.floor(-a / b), pyMod = ((-a % b) + b) % b;
    const variants = [
      [1, `${a} // ${b}`, Math.floor(a / b)],
      [1, `${a} % ${b}`, a % b],
      [2, `-${a} // ${b}`, pyDiv],
      [2, `2 ** ${b + 4}`, 2 ** (b + 4)],
      [3, `-${a} % ${b}`, pyMod],
      [3, `(1 << ${b + 30}) >> ${b + 20}`, 2 ** 10],
    ] as const;
    const [, e, v] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`${code(`print(${e})`)}Output?`, num(v), `${e} = ${v}. Python's // floors toward minus infinity (so -${a} // ${b} = ${pyDiv}, unlike C's ${Math.trunc(-a / b)}), and % takes the sign of the divisor. Python ints never overflow.`, 'Floor division rounds down, even for negatives.');
  },
  (r, d) => {
    if (d < 3) {
      const n = between(r, 2, 5);
      return ask(`${code(`a = [${Array.from({ length: n }, (_, i) => i).join(', ')}]\nb = a\nb.append(99)\nprint(len(a))`)}Output?`, num(n + 1), `b = a does not copy: both names refer to the same list, so a has ${n + 1} items. Use a.copy() or list(a) for a real copy.`, 'Assignment binds a new name to the same object.');
    }
    const n = between(r, 2, 4);
    return ask(`${code(`def add(x, acc=[]):\n    acc.append(x)\n    return acc\n\nfor i in range(${n}):\n    out = add(i)\nprint(len(out))`)}Output?`, num(n), `The default list is created once, when the function is defined, and shared by every call: it collects all ${n} items. Use acc=None and create the list inside. A classic interview bug.`, 'When is the default [] created?');
  },
]);

// ------------------------------------------------------------------ TCL, Make, SDC flows

const MAKE_RULES = [
  ['synth.v', ['rtl.sv', 'constraints.sdc']],
  ['place.def', ['synth.v', 'floorplan.tcl']],
  ['route.def', ['place.def']],
  ['timing.rpt', ['route.def', 'constraints.sdc']],
  ['power.rpt', ['route.def', 'activity.saif']],
] as const;
function rebuilt(touched: string) {
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [t, deps] of MAKE_RULES) if (!out.has(t) && deps.some((x) => x === touched || out.has(x))) { out.add(t); grew = true; }
  }
  return [...out];
}

export const flowsPractice = practice('practice-flows', 'Flow Drills', 'Make dependencies, TCL, SDC basics, farm arithmetic', [
  (r) => {
    const touched = pick(r, ['rtl.sv', 'constraints.sdc', 'floorplan.tcl', 'activity.saif', 'place.def']);
    const rb = rebuilt(touched);
    return ask(`${code(MAKE_RULES.map(([t, ds]) => `${t}: ${ds.join(' ')}`).join('\n'))}Everything is up to date. You edit \`${touched}\` and run \`make timing.rpt power.rpt\`. How many targets rebuild?`, num(rb.length), `Targets downstream of ${touched}: ${rb.join(', ')}. Make compares timestamps and rebuilds only what depends on the change.`, 'Follow the arrows downstream from the file you touched.');
  },
  (r, d) => {
    const x = between(r, 2, 9), y = between(r, 2, 9);
    const variants = [
      [1, `set x ${x}\nset y [expr {$x * ${y}}]\nputs $y`, String(x * y)],
      [1, `set a ${x}\nputs "a=$a"`, `a=${x}`],
      [2, `puts [llength {clk rst_n data valid}]`, '4'],
      [2, `puts [lindex {u0 u1 u2 u3 u4} ${Math.min(x, 4)}]`, `u${Math.min(x, 4)}`],
      [3, `set s 0\nforeach v {${x} ${y} ${x + y}} {\n  incr s $v\n}\nputs $s`, String(2 * (x + y))],
      [3, `set n ${x}\nputs {n is $n}`, 'n is $n'],
    ] as const;
    const [, src, out] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`${code(src)}What does this TCL print?`, exact(out), `Output: ${out}. TCL rules: $ substitutes, [ ] runs a command, " " allows substitution, { } does not.${d === 3 && out.includes('$') ? ' Braces suppress substitution, so $n is printed literally.' : ''}`, 'Apply substitution rules word by word.');
  },
  (r, d) => {
    const p = pick(r, [0.5, 0.8, 1, 1.25, 2, 4]);
    if (d === 1) return ask(`\`create_clock -period ${p} [get_ports clk]\` (ns). What frequency, in MHz?`, qty(1000 / p, 'MHz', 0.01), `1/${p} ns = ${sig(1000 / p)} MHz.`, 'f = 1 / period.');
    const ind = +(p * pick(r, [0.2, 0.3, 0.4])).toFixed(3);
    if (d === 2) return ask(`Clock period ${p} ns, \`set_input_delay ${ind} -clock clk [get_ports din]\`. How much of the cycle is left for logic from din to the first flop, ignoring setup, in ns?`, qty(p - ind, 'ns', 0.01), `The input delay models logic outside the chip: ${p} - ${ind} = ${sig(p - ind)} ns remains inside.`, 'Period minus the external delay.');
    const unc = pick(r, [0.05, 0.1]), setup = pick(r, [0.03, 0.05]), outd = +(p * 0.25).toFixed(3);
    const left = p - ind - unc - setup;
    return ask(`Period ${p} ns, input delay ${ind} ns, clock uncertainty ${unc} ns, flop setup ${setup} ns (output delay ${outd} ns applies to other paths). Budget for the din → flop logic, in ns?`, qty(left, 'ns', 0.01), `${p} - ${ind} - ${unc} - ${setup} = ${sig(left)} ns. The output delay is irrelevant here: it constrains flop → output paths.`, 'Subtract everything that eats this path\'s cycle.');
  },
  (r, d) => {
    const period = pick(r, [1.25, 2, 0.8]), port = pick(r, ['clk', 'core_clk', 'ref_clk']);
    if (d === 3) return ask(`Write the SDC to declare a clock named ${port} with a ${period} ns period on port ${port}, and then 0.1 ns of setup uncertainty on it (two commands; separate with ;).`, has(`create_clock -name ${port} -period ${period} [get_ports ${port}]; set_clock_uncertainty -setup 0.1 [get_clocks ${port}]`, ['create_clock'], [`-period ${period}`], ['get_ports'], ['set_clock_uncertainty'], ['0.1'], ['get_clocks']), `\`create_clock -name ${port} -period ${period} [get_ports ${port}]\` then \`set_clock_uncertainty -setup 0.1 [get_clocks ${port}]\`. Clocks are referenced with get_clocks, ports with get_ports.`, 'create_clock, then set_clock_uncertainty.');
    return ask(`Write the SDC command that creates a ${period} ns clock on port ${port}.`, has(`create_clock -period ${period} [get_ports ${port}]`, ['create_clock'], [`-period ${period}`], ['get_ports'], [port]), `\`create_clock -period ${period} [get_ports ${port}]\`. Every timing run starts here.`, 'create_clock -period <ns> [get_ports <name>].');
  },
  (r) => {
    const qs = [
      ['In a Makefile recipe, what is `$@`?', 'The target being built', ['The first prerequisite', 'All prerequisites', 'The make command itself'], '$@ target, $< first prerequisite, $^ all prerequisites.'],
      ['In a Makefile recipe, what is `$<`?', 'The first prerequisite', ['The target being built', 'All prerequisites', 'The previous target'], '$@ target, $< first prerequisite, $^ all prerequisites.'],
      ['Why mark `clean` as `.PHONY`?', 'So make runs it even if a file named "clean" exists', ['So it runs in parallel', 'So it never runs', 'So it deletes .PHONY files'], 'Phony targets are commands, not files.'],
      ['Make says "missing separator". Most likely cause?', 'A recipe line indented with spaces instead of a tab', ['A missing semicolon', 'Too many targets', 'A circular dependency'], 'Recipes must start with a literal tab. Famously.'],
      ['What does `make -j 16` do?', 'Runs up to 16 independent recipes in parallel', ['Runs make 16 times', 'Skips 16 targets', 'Sets the clock to 16 MHz'], 'Correct dependencies are what make -j safe.'],
    ] as const;
    const [q, right, wrong, why] = pick(r, qs);
    return mcs(r, q, right, wrong, why);
  },
  (r, d) => {
    const tests = pick(r, [2000, 5000, 10000]), mins = pick(r, [3, 6, 10]), cores = pick(r, [100, 200, 500]);
    const hours = (tests * mins) / cores / 60;
    if (d < 3) return ask(`A nightly regression has ${tests} tests averaging ${mins} min each, on ${cores} farm cores. Wall-clock time, in hours (perfect packing)?`, qty(hours, '', 0.02, sig(hours)), `${tests} × ${mins} min / ${cores} cores = ${sig(hours * 60)} min = ${sig(hours)} h.`, 'Total CPU time divided by cores.');
    const fail = pick(r, [0.01, 0.02, 0.05]);
    return ask(`${tests} tests run nightly and ${fail * 100}% fail. Each failure takes an engineer 15 min to triage by hand. How many engineer-hours per night?`, qty((tests * fail * 15) / 60, '', 0.02, sig((tests * fail * 15) / 60)), `${tests * fail} failures × 15 min = ${sig((tests * fail * 15) / 60)} h. That is why teams bucket failures automatically by error signature before any human looks.`, 'Failures × minutes each.');
  },
]);

export const TOOLING_PRACTICE = [shellPractice, gitPractice, pythonPractice, flowsPractice];

// ------------------------------------------------------------------ bosses

export const shellBoss = boss({
  id: 'boss-shell',
  title: 'The 3 AM Regression',
  concept: 'triage a failing regression with nothing but the shell',
  xp: 160,
  steps: [
    say('Boss fight, {name}. The nightly regression went red at 3 AM and tapeout is in two weeks. The lead wants a triage summary before standup. All you have is a terminal. Exam rules.', 'concerned'),
    { t: 'gen', make: (r) => { const rows = results(r, 10); const log = rows.map((x) => `${x.t} ${x.ok ? 'PASS' : 'FAIL'} seed=${x.seed}`).join('\n'); return ask(`summary.txt:${code(log)}How many tests failed? (what \`grep -c FAIL summary.txt\` prints)`, num(rows.filter((x) => !x.ok).length), `${rows.filter((x) => !x.ok).length} FAIL lines.`); } },
    { t: 'gen', make: () => ask('Write a regex that matches error signatures like `[E-1234]` (square brackets, E, a dash, exactly four digits) so you can bucket failures.', rx('\\[E-[0-9]{4}\\]', ['[E-1234] fifo', 'x [E-0007] y'], ['E-1234', '[E-123]', '[E-12345]', '[W-1234]']), 'One answer: `\\[E-[0-9]{4}\\]`. Brackets must be escaped; {4} means exactly four.') },
    { t: 'gen', make: () => ask('Write a command that prints each distinct error signature with its count, from all *.log files (hint: grep -o, sort, uniq -c).', has("grep -oh '\\[E-[0-9]\\{4\\}\\]' *.log | sort | uniq -c", ['grep'], ['-o'], ['.log'], ['sort'], ['uniq -c']), "`grep -oh '\\[E-[0-9]\\{4\\}\\]' *.log | sort | uniq -c`: -o prints only the match, -h drops file names, sort groups them, uniq -c counts.") },
    mc('Two signatures account for 90% of failures. What do you do first?', ['Rerun one failing seed of each with waves on, to reproduce and debug the root cause', 'Rerun the whole regression', 'Mark them as known failures', 'Email everyone the raw logs'], 0, 'Deterministic reproduction from the seed is how DV debug starts. Bucket, reproduce, root-cause.'),
    { t: 'gen', make: (r) => { const seed = between(r, 10000, 99999); return ask(`Write the command to rerun test fifo_test with seed ${seed} using the script ./run_test (it takes --test and --seed), saving all output to rerun.log.`, has(`./run_test --test fifo_test --seed ${seed} > rerun.log 2>&1`, ['./run_test'], ['--test fifo_test', '--test=fifo_test'], [`--seed ${seed}`, `--seed=${seed}`], ['rerun.log']), `\`./run_test --test fifo_test --seed ${seed} > rerun.log 2>&1\`.`); } },
    mc('The rerun passes. The regression run with the same seed failed. What is the most likely explanation?', ['The test is not reproducible from its seed: some randomness or timing is not seeded (a DV bug in itself)', 'The seed was wrong', 'Linux is flaky', 'The first run had a cosmic ray'], 0, 'Every source of randomness must derive from the seed, or failures cannot be reproduced. Check for unseeded $urandom, wall-clock time, or ordering of parallel processes.'),
    { t: 'gen', make: () => ask('Write a command that lists the 5 largest files in the current directory tree (to find the waveform dump filling the disk).', has('du -ah . | sort -rh | head -5', ['du'], ['sort'], ['-h', '-rh', '-hr', '-n', '-rn', '-nr'], ['head'], ['5']), '`du -ah . | sort -rh | head -5` (or find with -size, or ls -S). Full disks kill regressions at 3 AM all the time.') },
  ],
  recap: ['grep -c / -o, sort | uniq -c to bucket failures.', 'Regex with escapes and counts.', 'Reproduce from the seed; nondeterminism is a bug.'],
});

export const gitBoss = boss({
  id: 'boss-git',
  title: 'Main Is Broken',
  concept: 'bisect, revert and recover without losing anyone\'s work',
  xp: 160,
  steps: [
    say('Boss fight. Main has been broken since sometime last week: 200 commits by 40 engineers. Everyone is blocked. Fix it without rewriting shared history. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('How many test runs, at most, will `git bisect` need across 200 commits?', num(8), 'ceil(log2(200)) = 8.') },
    { t: 'gen', make: () => ask('Write the two commands that start bisect, marking HEAD as bad and tag v1.4 as good.', has('git bisect start; git bisect bad; git bisect good v1.4', ['git bisect start'], ['git bisect bad'], ['git bisect good v1.4']), '`git bisect start`, `git bisect bad` (HEAD by default), `git bisect good v1.4`. Or in one go: `git bisect start HEAD v1.4`.') },
    { t: 'gen', make: () => ask('Bisect points at commit 9f3c2e1. It is already on the shared main branch. Write the safe command to undo it.', has('git revert 9f3c2e1', ['git revert'], ['9f3c2e1']), '`git revert 9f3c2e1` adds a new commit that undoes it. Never reset and force-push a shared branch.') },
    mc('The revert conflicts with a later commit. What do you do?', ['Resolve the conflict markers by hand, `git add` the files, then `git revert --continue`', 'Force-push the old main', 'Delete the repository and re-clone', 'Run git bisect again'], 0, 'Conflicts in revert are resolved like merge conflicts.'),
    mc('Meanwhile a colleague ran `git reset --hard HEAD~3` on their local branch and lost 3 commits they had not pushed. Can they get them back?', ['Yes: `git reflog` shows where HEAD was; `git reset --hard HEAD@{1}` (or branch from that hash) restores them', 'No, reset --hard destroys commits immediately', 'Only if they were pushed', 'Only with root access'], 0, 'Commits stay in the object store for weeks; the reflog remembers every HEAD position.'),
    { t: 'gen', make: (r) => { const f = between(r, 2, 6), m = between(r, 20, 40); return ask(`Your feature branch has ${f} commits; main moved ${m} commits since you branched (including the revert). You rebase your private feature branch onto main. How many commits does \`git log main..feature\` show?`, num(f), `Still ${f}: rebase replays your commits on top of the new main. It is fine here because feature is private.`); } },
    mc('What process change prevents this next time?', ['Require CI (a smoke regression) to pass on every pull request before it merges', 'Ban git bisect', 'Only let one person commit', 'Commit less often'], 0, 'Pre-merge CI gates catch breakage per change instead of per week.'),
  ],
  recap: ['bisect to find, revert to undo on shared branches.', 'reflog recovers "lost" commits.', 'Rebase private branches only; gate merges with CI.'],
});

export const pythonBoss = boss({
  id: 'boss-python',
  title: 'The Log Parser',
  concept: 'read, predict and fix a real regression-report script',
  xp: 160,
  steps: [
    say('Boss fight. The team\'s regression report script gives wrong totals and nobody knows Python well. You do. Exam rules.', 'thinking'),
    art(`import re
from collections import Counter

sig = re.compile(r'\\[(E-\\d{4})\\]')
counts = Counter()
for line in open('regress.log'):
    m = sig.search(line)
    if m:
        counts[m.group(1)] += 1

for s, n in counts.most_common(3):
    print(f"{s}: {n}")`),
    { t: 'gen', make: (r) => { const n = between(r, 2, 5); const lines = Array.from({ length: n }, (_, i) => `[E-00${i}] fail`); return ask(`regress.log has ${n} lines, each with a different signature (${lines.slice(0, 2).join(', ')}, ...). How many lines does the script print?`, num(Math.min(n, 3)), `most_common(3) returns at most 3 entries: ${Math.min(n, 3)} lines.`); } },
    mc('What does `m.group(1)` return for the line `x [E-0042] timeout`?', ['E-0042', '[E-0042]', 'x', '0042'], 0, 'group(0) is the whole match `[E-0042]`; group(1) is the first parenthesized group, `E-0042`.'),
    mc('Some lines contain two signatures, like `[E-0001] after [E-0002]`. What does the script count for such a line?', ['Only the first signature, because search() stops at the first match', 'Both', 'Neither', 'It crashes'], 0, 'Use sig.findall(line) (or finditer) to catch every match on a line.'),
    { t: 'gen', make: (r) => { const a = between(r, 3, 9), b = between(r, 3, 9); return ask(`${code(`totals = {'pass': ${a}, 'fail': ${b}}\nrate = totals['fail'] / (totals['pass'] + totals['fail'])\nprint(f"{rate:.1%}")`)}Output?`, exact(`${((b / (a + b)) * 100).toFixed(1)}%`), `${b}/${a + b} = ${((b / (a + b)) * 100).toFixed(1)}%. The :.1% format multiplies by 100 and adds the % sign.`); } },
    { t: 'gen', make: (r) => { const n = between(r, 3, 6); return ask(`${code(`def collect(x, seen=[]):\n    seen.append(x)\n    return seen\n\nfor t in range(${n}):\n    failures = collect(t)\nprint(len(failures))`)}The report shows too many failures. What does this print?`, num(n), `${n}: the default list is shared between calls, so it keeps growing. Fix: seen=None, then seen = [] inside.`); } },
    { t: 'gen', make: () => ask('Write a regex (Python syntax, no slashes) that captures the test name and seed from lines like `TEST fifo_smoke SEED 81723 FAILED`, as two groups.', rx('TEST (\\w+) SEED (\\d+)', ['TEST fifo_smoke SEED 81723 FAILED', 'TEST a SEED 1'], ['TEST SEED 1', 'TEST fifo SEED x'], ), 'One answer: `TEST (\\w+) SEED (\\d+)`. \\w+ matches identifier characters, \\d+ digits.') },
  ],
  recap: ['search finds the first match; findall finds all.', 'group(0) vs group(1).', 'Mutable defaults are shared.', 'f-string formats like :.1%.'],
});

export const flowsBoss = boss({
  id: 'boss-flows',
  title: 'The Flow That Won\'t Close',
  concept: 'debug a Make/TCL/SDC implementation flow',
  xp: 160,
  steps: [
    say('Boss fight. A block\'s implementation flow reports impossible timing and rebuilds everything every time. You own the flow now. Exam rules.', 'thinking'),
    art(MAKE_RULES.map(([t, ds]) => `${t}: ${ds.join(' ')}`).join('\n')),
    { t: 'gen', make: () => ask('A designer edits only floorplan.tcl. How many of the five targets should rebuild?', num(rebuilt('floorplan.tcl').length), `${rebuilt('floorplan.tcl').join(', ')}: everything downstream of placement, but not synthesis.`) },
    mc('Yet every run rebuilds synth.v too. The rtl.sv timestamp keeps changing. Likely cause?', ['A script regenerates rtl.sv (for example from a template) on every run, touching it even when unchanged', 'Make is broken', 'The disk is full', 'synth.v is .PHONY'], 0, 'Generators should write to a temp file and only replace the target if the content changed.'),
    { t: 'gen', make: (r) => { const p = pick(r, [1, 1.25]); return mcs(r, `The SDC says \`create_clock -period ${p * 1000} [get_ports clk]\` and the report shows a ${p * 1000} ns clock. The designer meant ${p} ns. Which line is correct?`, `create_clock -period ${p} [get_ports clk]`, [`create_clock -period ${p * 1000}ps [get_ports clk]`, `create_clock -freq ${p} [get_ports clk]`, `set_clock_period ${p * 1000} clk`], `SDC time is in the library's unit, almost always ns. ${p * 1000} was meant as picoseconds. Write -period ${p}.`); } },
    { t: 'gen', make: (r) => { const x = between(r, 2, 5); return ask(`${code(`set pins [get_pins u_core/*/D]\nputs [llength {a b c}]\nset n ${x}\nputs "slack_$n"`)}What does the last line print?`, exact(`slack_${x}`), `Double quotes allow $ substitution: slack_${x}.`); } },
    { t: 'gen', make: () => ask('Clock period 1 ns, input delay 0.4 ns, uncertainty 0.1 ns, setup 0.05 ns. Budget for input-to-flop logic, in ns?', qty(0.45, 'ns', 0.01), '1 - 0.4 - 0.1 - 0.05 = 0.45 ns.') },
    mc('The input delay was set to 0.9 ns "to be safe". What happens?', ['Input paths get only ~0 ns of budget, so synthesis over-sizes gates or reports violations that are not real', 'Nothing, extra margin is free', 'The clock gets faster', 'Hold time improves for free'], 0, 'Over-constraining wastes area and power and hides real problems. Constraints must model reality.'),
  ],
  recap: ['Make rebuilds by timestamp; generators must not touch unchanged files.', 'SDC units matter.', 'TCL substitution rules.', 'Constraints should model reality, not "safety".'],
});

export const TOOLING_BOSSES = [shellBoss, gitBoss, pythonBoss, flowsBoss];


// Act II - the tools every chip engineer uses every day: the Linux shell, regular expressions, git, Python,
// Make and TCL. Interviewers assume them; nobody teaches them.
import { has, num, rx, words } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

export const shell: Lesson = {
  id: 'shell',
  title: 'The Command Line',
  concept: 'files, pipes, grep, find, redirection, regular expressions',
  xp: 90,
  steps: [
    say('Here is a secret of the chip industry: almost all the work happens in a **Linux terminal**, a lot like this one. Simulators, synthesis and place-and-route tools run on big Linux compute farms, and engineers drive them by typing commands and chaining small tools together. Get fast at the shell and you get fast at everything.'),
    art(`
   pwd                      where am I?
   ls -l                    list files, with details
   cd sim/run42             change directory   (.. = up one, ~ = home)
   cat / less file.log      print / page through a file
   head -20 / tail -f       first 20 lines / follow a growing log
   cp, mv, rm, mkdir        copy, move, delete, make a directory`),
    mc('A regression is still running and writing to `run.log`. Which command shows new lines as they arrive?', ['cat run.log', 'tail -f run.log', 'head run.log', 'ls run.log'], 1, '`tail -f` (follow) keeps printing as the file grows. Ctrl+C stops it.'),
    say('The real power is the **pipe**, `|`. It sends the output of one command into the next, so small tools combine into big ones. `grep` finds lines matching a pattern, `wc -l` counts lines, `sort` sorts, `uniq -c` counts repeats.'),
    art(`
   grep UVM_ERROR run.log | wc -l                  how many errors?
   grep UVM_ERROR *.log | sort | uniq -c | sort -rn  which errors are most common?
   find . -name "*.sv" | xargs grep -l "always_latch"  which files use latches?`),
    ask('Write one command that counts how many lines in `run.log` contain `UVM_ERROR`.', has('grep -c UVM_ERROR run.log', ['grep'], ['uvm_error'], ['run.log'], ['-c', 'wc -l', 'wc']), 'Either `grep -c UVM_ERROR run.log` or `grep UVM_ERROR run.log | wc -l`. The first is shorter; the second shows the pipe idea.', 'grep finds the lines; -c counts them (or pipe into wc -l).'),
    mc('What does `>` do in `grep FAIL results.txt > fails.txt`, and how is `>>` different?', ['They are the same', '`>` sends the output into a file, replacing it; `>>` appends to the end', '`>` compares numbers', '`>>` runs in the background'], 1, 'Redirection. `2>` redirects errors, `&>` both, and `< file` feeds a file in as input.'),
    say('grep patterns are **regular expressions**: a tiny language for describing text. Learn these and you can find anything in a million-line log.'),
    art(`
   .        any character          ^ / $    start / end of line
   [0-9]    one digit              [a-fA-F] one of these letters
   *        0 or more of previous  +        1 or more        ?  0 or 1
   \\d \\w \\s  digit, word char, space  (a|b)    a or b          {2,4}  2 to 4 times`),
    ask('Write a regular expression that matches hex numbers written like `0x1F`, `0xdeadBEEF` or `0x0` (the 0x prefix plus at least one hex digit).', rx('0x[0-9a-fA-F]+', ['0x1F', '0xdeadBEEF', '0x0', 'addr=0x40'], ['0x', '1F', '0xZZ']), 'One answer: `0x[0-9a-fA-F]+`. The + requires at least one digit; the character class lists every legal hex digit. I test your pattern against real examples, so any correct regex passes.', 'Literal 0x, then a character class of hex digits, then +.'),
    ask('Write a regex that matches lines that **start** with `UVM_ERROR` or `UVM_FATAL`.', rx('^UVM_(ERROR|FATAL)', ['UVM_ERROR @ 100ns: mismatch', 'UVM_FATAL @ 5ns: timeout'], ['UVM_INFO @ 1ns', 'note: UVM_ERROR was expected', 'UVM_WARNING x']), 'One answer: `^UVM_(ERROR|FATAL)`. The ^ anchors it to the start of the line, and (a|b) is alternation.', 'Anchor with ^, then UVM_ and a group with |.'),
    mc('You run a job on the compute farm and log out. How do you keep long jobs alive and find their output later?', ['You cannot', 'Submit them through the farm scheduler (LSF `bsub`, Slurm `sbatch`, or `nohup`/`tmux` on a single machine) with output redirected to a log file', 'Keep the laptop open forever', 'Email the results'], 1, 'Big companies run thousands of simulations at once through job schedulers. `bjobs`/`squeue` show what is running.'),
    mc('What does `chmod +x run.sh` do?', ['Deletes it', 'Makes the file executable, so it can be run as `./run.sh`', 'Makes it read-only', 'Changes its owner'], 1, 'Unix permissions: read, write and execute, for the owner, the group and others. `ls -l` shows them as rwxr-xr-x.'),
  ],
  recap: ['Everything runs on Linux: navigate with pwd, ls, cd; read with cat, less, head, tail -f.', 'Pipes chain tools: grep | sort | uniq -c | sort -rn.', 'Redirect with > (overwrite), >> (append), 2> (errors).', 'Regex: . [ ] * + ? ^ $ ( | ) {n,m}.', 'Long jobs go through the farm scheduler.'],
};

export const git: Lesson = {
  id: 'git',
  title: 'Version Control with git',
  concept: 'commits, branches, merges, conflicts, bisect, code review',
  xp: 90,
  steps: [
    say('Chip designs are code, and hundreds of engineers edit the same repository every day. **git** keeps the full history, lets everyone work in parallel on **branches**, and merges their work together. Every design and verification team uses it (or something very like it).'),
    art(`
   git status              what changed?
   git diff                show the changes
   git add file.sv         stage a change for the next commit
   git commit -m "msg"     record a snapshot
   git log --oneline       history
   git switch -c fix-fifo  create and switch to a new branch
   git pull / git push     sync with the shared remote`),
    mc('What is the **staging area** (the index) for?', ['It backs up your files', 'It lets you choose exactly which changes go into the next commit, so one commit holds one logical change', 'It compiles the code', 'It stores deleted files'], 1, '`git add` stages; `git commit` records what is staged. Small, focused commits make history readable and bugs easy to find.'),
    ask('What command creates a commit from the staged changes with the message "fix fifo overflow"?', words('git commit -m "fix fifo overflow"', "git commit -m 'fix fifo overflow'", 'git commit -m fix fifo overflow', 'git commit --message "fix fifo overflow"', 'git commit --message="fix fifo overflow"'), '`git commit -m "fix fifo overflow"`. Good messages say what and why, in the present tense.', 'git commit with the -m flag.'),
    say('A **branch** is a movable pointer to a line of commits. You make a branch for your change, commit on it, and when it is reviewed, **merge** it back into `main`. If two people changed the same lines, git cannot decide, and you get a **merge conflict** to resolve by hand.'),
    art(`
   <<<<<<< HEAD
   assign full = (count == DEPTH);
   =======
   assign full = (count >= DEPTH);
   >>>>>>> fix-fifo

   Keep the right version (or combine them), delete the markers, git add, git commit.`),
    mc('What is the difference between **merge** and **rebase**?', ['None', 'Merge joins two histories with a merge commit; rebase replays your commits on top of the other branch, giving a straight history. Never rebase commits other people already have', 'Rebase deletes branches', 'Merge only works locally'], 1, 'Both integrate work. Rebase rewrites history, so it is for your own unpublished branch; merge is always safe on shared branches.'),
    say('A superpower for verification engineers: **git bisect**. A test passed last week and fails today, with 300 commits in between. Bisect binary-searches the history: you mark one commit good and one bad, and git checks out the middle for you to test.'),
    ask('A regression broke somewhere in the last 300 commits. At most how many test runs does `git bisect` need to find the guilty commit?', num(9), 'Each test halves the range: 2^9 = 512 ≥ 300, so at most 9 runs. With `git bisect run ./test.sh` it happens automatically.', 'log2 of the number of commits, rounded up.'),
    mc('Before merging to main, most teams require a **pull request** (or merge request). Why?', ['To slow people down', 'Another engineer reviews the change, and CI runs lint, tests and regressions on it, so bugs are caught before they reach everyone', 'git requires it', 'To count commits'], 1, 'Code review and continuous integration. On chip teams, CI often runs smoke regressions, lint and synthesis checks on every request.'),
    mc('Your simulation writes 2 GB of waveform files into the repository folder. What stops you from committing them by accident?', ['Nothing', 'A `.gitignore` entry such as `*.fsdb` or `sim_out/`', 'git refuses large files automatically', 'Deleting them every time'], 1, 'Generated outputs (waveforms, logs, build products) never belong in git. `.gitignore` lists patterns to leave out.'),
  ],
  recap: ['status, diff, add, commit, log, switch -c, pull, push.', 'Stage to make focused commits.', 'Branches + merges; resolve conflicts by editing the markers.', 'Rebase only your own unpublished work.', 'git bisect finds the breaking commit in log2(n) tests.', 'Pull requests: review + CI. .gitignore keeps outputs out.'],
};

export const python: Lesson = {
  id: 'python',
  title: 'Python for Engineers',
  concept: 'lists, dicts, loops, functions, comprehensions, parsing logs',
  xp: 100,
  steps: [
    say('**Python** is the glue of the chip industry: regression scripts, log parsers, reference models, test generators, data analysis, and whole testbenches (cocotb). You will write it every week in almost any role. Let us learn it by predicting what code prints. Type exactly what the program would print.'),
    art(`
   errors = 3
   name = "fifo"
   print(name.upper(), errors * 2)       →  FIFO 6`),
    gen((r) => {
      const a = pick(r, [2, 3, 4]), b = pick(r, [5, 7, 10]);
      return ask(`What does this print?\n\n\`x = ${a}\`\n\`y = ${b}\`\n\`print(x * y + 1)\``, num(a * b + 1), `${a} × ${b} + 1 = ${a * b + 1}.`, 'Multiplication before addition, like maths.');
    }),
    say('**Lists** hold sequences; indexing starts at 0, and negative indexes count from the end. **Slices** `a[i:j]` take items i up to (not including) j.'),
    gen((r) => {
      const xs = [pick(r, [3, 5, 7]), pick(r, [1, 2, 4]), pick(r, [8, 9, 6]), pick(r, [0, 10, 11])];
      const q = pick(r, [['xs[1]', xs[1]], ['xs[-1]', xs[3]], ['len(xs)', 4], ['sum(xs[1:3])', xs[1] + xs[2]], ['max(xs)', Math.max(...xs)]] as const);
      return ask(`\`xs = [${xs.join(', ')}]\`. What is \`${q[0]}\`?`, num(q[1] as number), `${q[0]} = ${q[1]}. Index 0 is the first item, -1 the last, and xs[1:3] is items 1 and 2.`, 'Count from 0.');
    }),
    say('**Loops** repeat, and `range(n)` counts 0 .. n-1. **Comprehensions** build a list from a loop in one line: `[x * x for x in range(4)]` is `[0, 1, 4, 9]`.'),
    gen((r) => {
      const n = pick(r, [3, 4, 5, 6]);
      const kind = pick(r, ['sq', 'even', 'count']);
      if (kind === 'sq') { let s = 0; for (let i = 0; i < n; i++) s += i * i; return ask(`What does \`print(sum(x * x for x in range(${n})))\` print?`, num(s), `range(${n}) is 0..${n - 1}; the squares sum to ${s}.`, 'Square 0 through n-1, then add.'); }
      if (kind === 'even') { const v = Array.from({ length: n * 2 }, (_, i) => i).filter((i) => i % 2 === 0).length; return ask(`What does \`print(len([i for i in range(${n * 2}) if i % 2 == 0]))\` print?`, num(v), `The even numbers in 0..${n * 2 - 1}: there are ${v}.`, 'Count the evens below the limit, including 0.'); }
      let t = 0; for (let i = 1; i <= n; i++) t += i; return ask(`What does this print?\n\n\`total = 0\`\n\`for i in range(1, ${n + 1}):\`\n\`    total += i\`\n\`print(total)\``, num(t), `1 + 2 + ... + ${n} = ${t}. range(1, ${n + 1}) stops before ${n + 1}.`, 'range(a, b) includes a but not b.');
    }),
    say('**Dictionaries** map keys to values, which is perfect for counting things, like how many times each error appears in a log.'),
    art(`
   counts = {}
   for line in open("run.log"):
       if "UVM_ERROR" in line:
           key = line.split(":")[1].strip()
           counts[key] = counts.get(key, 0) + 1
   for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
       print(v, k)`),
    mc('In that script, what does `counts.get(key, 0)` do?', ['Crashes if the key is missing', 'Returns the current count, or 0 if this key has not been seen yet', 'Deletes the key', 'Returns the key'], 1, '`dict.get(key, default)` avoids a KeyError. (`collections.Counter` does the whole counting job in one line.)'),
    gen((r) => {
      const s = pick(r, ['UVM_ERROR @ 120ns: scoreboard mismatch', 'UVM_ERROR @ 5ns: bad parity']);
      const parts = s.split(':');
      return ask(`\`line = "${s}"\`. What does \`print(line.split(":")[1].strip())\` print?`, words(parts[1].trim()), `split(":") cuts at the colon: ["${parts[0]}", "${parts[1]}"]. [1] is the second piece, and strip() trims the spaces: "${parts[1].trim()}".`, 'split at ":" and take the piece after it.');
    }),
    say('**Functions** package logic for reuse. In verification, a Python function is often the **reference model**: the golden answer your testbench compares the hardware against.'),
    gen((r) => {
      const x = pick(r, [0b1011, 0b1110, 0b0111, 0b10000001]);
      const ones = x.toString(2).split('').filter((c) => c === '1').length;
      return ask(`A reference model for a parity checker:\n\n\`def parity(x):\`\n\`    return bin(x).count("1") % 2\`\n\nWhat does \`parity(0b${x.toString(2)})\` return?`, num(ones % 2), `0b${x.toString(2)} has ${ones} ones; ${ones} % 2 = ${ones % 2}.`, 'Count the 1 bits, then take the remainder mod 2.');
    }),
    mc('Why do verification teams like writing reference models in Python rather than in SystemVerilog?', ['Python runs faster than hardware', 'It is quick to write and read, has huge libraries, and tools like cocotb (or DPI and sockets) connect it to the simulator', 'SystemVerilog cannot do math', 'It is required by UVM'], 1, 'Fast to write and easy to check against the spec. Performance-critical models move to C/C++ through DPI.'),
  ],
  recap: ['Predict before you run: that is how you learn a language.', 'Lists index from 0; -1 is the last; slices exclude the end.', 'range(a, b) stops before b; comprehensions build lists in one line.', 'Dicts count things; .get(k, 0) avoids KeyErrors.', 'split/strip parse log lines.', 'Functions make reference models.'],
};

export const flows: Lesson = {
  id: 'flows',
  title: 'Make, TCL and Tool Flows',
  concept: 'Makefiles, dependencies, TCL scripting, EDA flow scripts',
  xp: 90,
  steps: [
    say('Chip tools are not clicked, they are **scripted**. A synthesis run, a place-and-route flow or a regression is a pipeline of steps, each with inputs and outputs. **Make** decides which steps need to rerun, and **TCL** is the language almost every EDA tool (Synopsys, Cadence, Siemens, Xilinx Vivado) speaks.'),
    art(`
   # Makefile: target: dependencies, then the command (indented with a TAB)
   netlist.v: rtl/*.sv constraints.sdc
   	dc_shell -f synth.tcl

   timing.rpt: netlist.v
   	pt_shell -f sta.tcl`),
    mc('You edit `constraints.sdc` and run `make timing.rpt`. What reruns?', ['Nothing', 'Only STA', 'Synthesis (because netlist.v depends on the SDC) and then STA (because timing.rpt depends on netlist.v)', 'Everything in the project'], 2, 'Make compares file timestamps along the dependency chain and rebuilds only what is out of date. The same idea powers incremental compiles and regressions.'),
    mc('Make reports "missing separator". What is the most famous cause?', ['A missing semicolon', 'The recipe line is indented with spaces instead of a TAB', 'The target has no dependencies', 'The file is too long'], 1, 'Make recipes must start with a literal TAB character. Everyone hits this once.'),
    say('**TCL** has a simple rule: everything is a command followed by words. `set x 5` stores a variable, `$x` reads it, and **square brackets run a command and substitute its result**: `[expr {$x * 2}]`.'),
    art(`
   set period 2.0
   set half [expr {$period / 2}]
   puts "half period = $half"          →  half period = 1.0

   foreach cell [get_cells *reg*] {    # EDA commands return lists of objects
     puts [get_attribute $cell ref_name]
   }`),
    gen((r) => {
      const a = pick(r, [3, 4, 6]), b = pick(r, [2, 5, 10]);
      return ask(`What does this TCL print?\n\n\`set a ${a}\`\n\`set b [expr {$a * ${b}}]\`\n\`puts $b\``, num(a * b), `[expr {$a * ${b}}] evaluates to ${a * b}, stored in b; puts prints ${a * b}.`, 'Brackets are replaced by the result of the command inside.');
    }),
    gen((r) => {
      const n = pick(r, [3, 4, 5]);
      const items = ['u_alu', 'u_fifo', 'u_ctrl', 'u_dma', 'u_uart'].slice(0, n);
      return ask(`What does this TCL print?\n\n\`set blocks {${items.join(' ')}}\`\n\`puts [llength $blocks]\``, num(n), `llength counts list elements: ${n}. TCL lists are space-separated words in braces.`, 'Count the words in the list.');
    }),
    mc('In a synthesis script, what do `create_clock -period 1.0 [get_ports clk]` and `set_input_delay` define?', ['The RTL', 'Timing constraints (SDC): the clock and when inputs arrive relative to it, which synthesis and STA optimize against', 'The layout', 'Simulation stimulus'], 1, 'SDC is itself TCL. Constraints tell the tools what "fast enough" means; wrong constraints are a top cause of silicon timing failures.'),
    mc('A regression flow runs 5,000 tests every night. What turns this into something one engineer can manage?', ['Running them by hand', 'A scripted flow: a test list, a scheduler that farms runs out in parallel, automatic pass/fail parsing, and a summary report with failure signatures', 'Buying a faster laptop', 'Running only the tests that passed yesterday'], 1, 'Regression infrastructure is itself engineering. The triage lab later in the game makes you do it.'),
  ],
  recap: ['Make: targets, dependencies, recipes (TAB!); rebuild only what is stale.', 'TCL: `set x 5`, `$x`, `[cmd]` substitution, `expr {}`, lists, foreach.', 'EDA tools and SDC constraints are TCL.', 'Flows = scripted pipelines; regressions = test lists + scheduler + parsing + reports.'],
};

export const TOOLING_LESSONS = [shell, git, python, flows];

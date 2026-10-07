// Shell Lab missions: navigation, text tools, scripting, make and python. Each has goals checked against the machine's final
// state (and what the learner's commands printed), a reference solution, and, for bosses, randomised data.
import { between, pick, type Rng } from '../../lessons/types';
import type { Shell } from './sh';
import type { ShellEntry, ShellGoal, ShellLevel } from './types';

const read = (sh: Shell, path: string): string | null => { try { return sh.fs.readFile(sh.abs(path)); } catch { return null; } };
const norm = (s: string) => s.trim().split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join('\n');
const ran = (h: ShellEntry[], re: RegExp) => h.some((e) => re.test(e.cmd));
const printed = (h: ShellEntry[], s: string) => h.some((e) => e.out.includes(s));
const fileIs = (path: string, want: string, label: string): ShellGoal => ({ label, ok: (sh) => { const t = read(sh, path); return t !== null && norm(t) === norm(want); } });
const out = (sh: Shell, cmd: string) => sh.capture(cmd);

// ---- 1. navigation
const nav: ShellLevel = {
  id: 'sh-nav', title: 'Find the token', concept: 'cd, ls -a, cat, hidden files', xp: 60, tier: 'guided',
  ticket: 'A build agent left an access token somewhere in the project. Security wants to see it before they rotate it.',
  build: () => ({
    brief: `<p>The project lives in <code>~/proj</code>. Somewhere under <code>logs/</code> a <b>hidden</b> file (its name starts with a dot) holds the token.</p>
<ul><li><code>cd</code> into the directory and list it with hidden files shown (<code>ls -a</code>).</li><li>Print the token file with <code>cat</code>.</li></ul>`,
    hints: ['Hidden files do not show in plain <code>ls</code>. Add <code>-a</code>.', 'The file is <code>~/proj/logs/.token</code>. <code>cat ~/proj/logs/.token</code> prints it.'],
    files: { 'proj/README.md': '# proj\nBuild system.\n', 'proj/logs/build.log': 'ok\n', 'proj/logs/.token': 'TK-7731-ALPHA\n', 'proj/src/main.c': 'int main(void){return 0;}\n' },
    solution: ['cd proj/logs', 'ls -a', 'cat .token'],
    goals: [
      { label: 'you are inside ~/proj/logs', ok: (sh) => sh.cwd.endsWith('/proj/logs') },
      { label: 'you listed hidden files with ls -a', ok: (_s, h) => ran(h, /\bls\b.*-\w*a/) },
      { label: 'the token was printed', ok: (_s, h) => printed(h, 'TK-7731-ALPHA') },
    ],
  }),
};

// ---- 2. grep
const grepMission: ShellLevel = {
  id: 'sh-grep', title: 'Count the errors', concept: 'grep, -c, -v, redirection', xp: 70, tier: 'guided',
  ticket: 'The nightly regression finished red. How bad is it?',
  build: () => {
    const lines: string[] = [];
    let errs = 0;
    const msgs = ['INFO boot ok', 'ERROR scoreboard mismatch', 'INFO cache warm', 'WARN retry 2', 'ERROR timeout waiting for ack', 'INFO done'];
    for (let i = 0; i < 24; i++) { const m = msgs[(i * 5 + 1) % msgs.length]; if (m.startsWith('ERROR')) errs++; lines.push(`[${100 + i * 7}] ${m}`); }
    const text = lines.join('\n') + '\n';
    return {
      brief: `<p><code>sim.log</code> is in your home directory.</p><ul><li>Count the lines containing <code>ERROR</code> (let <code>grep</code> count for you).</li><li>Save the matching lines themselves into <code>errors.txt</code>.</li></ul>`,
      hints: ['<code>grep -c PATTERN FILE</code> prints how many lines match.', '<code>grep ERROR sim.log > errors.txt</code> writes the matches to a file.'],
      files: { 'sim.log': text },
      solution: ['grep -c ERROR sim.log', 'grep ERROR sim.log > errors.txt'],
      goals: [
        { label: 'you used grep -c and it printed the right count', ok: (_s, h) => h.some((e) => /grep\b.*-c/.test(e.cmd) && e.out.trim() === String(errs)) },
        fileIs('errors.txt', lines.filter((l) => l.includes('ERROR')).join('\n'), 'errors.txt holds exactly the ERROR lines'),
      ],
    };
  },
};

// ---- 3. pipes
const pipes: ShellLevel = {
  id: 'sh-pipes', title: 'Who is hammering the server?', concept: 'sort | uniq -c | sort -rn | head', xp: 80, tier: 'guided',
  ticket: 'The lab license server is slow. Find the three hosts making the most requests.',
  build: () => {
    const hosts = ['10.0.0.7', '10.0.0.12', '10.0.0.3', '10.0.0.9', '10.0.0.21'];
    const counts = [9, 5, 3, 2, 1];
    const rows: string[] = [];
    for (let i = 0; i < 20; i++) for (let k = 0; k < hosts.length; k++) if (i < counts[k]) rows.push(`${hosts[k]} GET /lic ${i % 3 ? 200 : 503}`);
    rows.sort((a, b) => (a.length + a.charCodeAt(9)) % 7 - (b.length + b.charCodeAt(9)) % 7 || (a < b ? 1 : -1));
    return {
      brief: `<p><code>access.log</code> has one request per line: <code>host method path status</code>.</p>
<p>Write the top 3 hosts with their request counts to <code>top3.txt</code> as <code>COUNT HOST</code> lines, busiest first. The classic recipe is a pipeline: pick the host column, <code>sort</code>, count runs with <code>uniq -c</code>, sort numerically in reverse, take the head.</p>`,
      hints: ['<code>cut -d" " -f1 access.log</code> (or <code>awk \'{print $1}\'</code>) extracts the host column.', '<code>uniq</code> only collapses <b>adjacent</b> duplicates, so <code>sort</code> first.', '<code>... | sort | uniq -c | sort -rn | head -3 > top3.txt</code>'],
      files: { 'access.log': rows.join('\n') + '\n' },
      solution: ["cut -d' ' -f1 access.log | sort | uniq -c | sort -rn | head -3 > top3.txt"],
      goals: [fileIs('top3.txt', '9 10.0.0.7\n5 10.0.0.12\n3 10.0.0.3', 'top3.txt lists the three busiest hosts with counts, busiest first')],
    };
  },
};

// ---- 4. find
const findMission: ShellLevel = {
  id: 'sh-find', title: 'Clean the scratch files', concept: 'find, -name, -type, -delete', xp: 70, tier: 'guided',
  ticket: 'The project disk is full of editor and tool scratch files. Remove them without touching real sources.',
  build: () => ({
    brief: `<p>Delete every file ending in <code>.tmp</code> anywhere under <code>~/proj</code>. Keep everything else, including the directory <code>tmp.d</code> and the file <code>notes.tmp.md</code>.</p><p>Preview first (<code>find</code> prints), then delete.</p>`,
    hints: ['<code>find proj -name "*.tmp"</code> lists the matches. Quote the pattern so the shell does not expand it.', 'Add <code>-type f</code> to files only, then <code>-delete</code> (or <code>-exec rm {} \\;</code>; the backslash stops the shell eating the <code>;</code>, and <code>+</code> instead of <code>\\;</code> is the faster form that batches the files).'],
    files: { 'proj/a.tmp': 'x', 'proj/src/b.tmp': 'x', 'proj/src/deep/c.tmp': 'x', 'proj/src/main.c': 'int main(){}', 'proj/notes.tmp.md': 'keep', 'proj/tmp.d/keep.txt': 'keep' },
    solution: ['find proj -name "*.tmp"', 'find proj -type f -name "*.tmp" -delete'],
    goals: [
      { label: 'no .tmp files remain', ok: (sh) => !out(sh, 'find proj -name "*.tmp"').trim() },
      { label: 'real files and the tmp.d directory are untouched', ok: (sh) => !!read(sh, 'proj/src/main.c') && !!read(sh, 'proj/notes.tmp.md') && !!read(sh, 'proj/tmp.d/keep.txt') },
      { label: 'you previewed with find before deleting', ok: (_s, h) => h.length >= 2 && ran(h, /\bfind\b(?!.*-delete)/) },
    ],
  }),
};

// ---- 5. awk
const awkMission: ShellLevel = {
  id: 'sh-awk', title: 'Average slack', concept: 'awk fields, -F, accumulators, END', xp: 80, tier: 'guided',
  ticket: 'Timing closure wants the mean slack across paths, and which path is worst.',
  build: () => ({
    brief: `<p><code>paths.csv</code> has a header row, then <code>path,slack_ns</code> rows.</p>
<ul><li>Write the average slack (two decimals) to <code>avg.txt</code>. Skip the header.</li><li>Write the name of the worst path (smallest slack) to <code>worst.txt</code>.</li></ul>
<p>awk reads line by line: <code>awk -F, 'NR&gt;1 {sum+=$2; n++} END {printf "%.2f\\n", sum/n}'</code></p>`,
    hints: ['<code>-F,</code> sets the field separator to a comma; <code>NR&gt;1</code> skips line 1.', 'For the worst path keep the minimum: <code>NR==2 || $2&lt;min {min=$2; name=$1}</code>.', 'Redirect each result: <code>&gt; avg.txt</code>, <code>&gt; worst.txt</code>.'],
    files: { 'paths.csv': 'path,slack_ns\nu_core/alu,0.42\nu_core/fpu,-0.18\nu_mem/ctl,0.07\nu_io/uart,1.20\nu_core/dec,0.33\n' },
    solution: [`awk -F, 'NR>1 {s+=$2; n++} END {printf "%.2f\\n", s/n}' paths.csv > avg.txt`, `awk -F, 'NR==2 || $2<m {m=$2; w=$1} END {print w}' paths.csv > worst.txt`],
    goals: [fileIs('avg.txt', '0.37', 'avg.txt is 0.37'), fileIs('worst.txt', 'u_core/fpu', 'worst.txt names u_core/fpu')],
  }),
};

// ---- 6. sed
const sedMission: ShellLevel = {
  id: 'sh-sed', title: 'Rename a port safely', concept: 'sed -i, s///g, word boundaries', xp: 80, tier: 'guided',
  ticket: 'The clock port is being renamed from clk_i to clk across the RTL. A blind replace would also mangle clk_i_n.',
  build: () => ({
    brief: `<p>In every <code>rtl/*.v</code> file replace the whole word <code>clk_i</code> with <code>clk</code>, editing the files in place. Leave names that merely <i>contain</i> it (like <code>clk_i_n</code>) alone.</p>`,
    hints: ['<code>sed -i \'s/old/new/g\' files...</code> edits in place.', 'Anchor the match on word boundaries: <code>\\bclk_i\\b</code>.'],
    files: { 'rtl/core.v': 'module core(input clk_i, input clk_i_n);\n  always @(posedge clk_i) q <= d;\nendmodule\n', 'rtl/mem.v': 'module mem(input clk_i);\n  wire g = clk_i & en; // clk_i gates\nendmodule\n' },
    solution: ["sed -i 's/\\bclk_i\\b/clk/g' rtl/*.v"],
    goals: [
      { label: 'the old name clk_i is gone from every file', ok: (sh) => !/\bclk_i\b/.test((read(sh, 'rtl/core.v') ?? 'clk_i') + (read(sh, 'rtl/mem.v') ?? 'clk_i')) },
      { label: 'clk_i_n was left alone', ok: (sh) => (read(sh, 'rtl/core.v') ?? '').includes('clk_i_n') },
      { label: 'the new name is in place', ok: (sh) => (read(sh, 'rtl/core.v') ?? '').includes('posedge clk)') && (read(sh, 'rtl/mem.v') ?? '').includes('clk & en') },
    ],
  }),
};

// ---- 7. permissions
const perms: ShellLevel = {
  id: 'sh-perm', title: 'Permission denied', concept: 'chmod, execute bits, running scripts', xp: 70, tier: 'guided',
  ticket: 'The deploy script will not run, and the key file is readable by everyone.',
  build: () => ({
    brief: `<p>Two problems in <code>~/deploy</code>:</p><ul><li><code>run.sh</code> gives <code>Permission denied</code>. Make it executable and run it (<code>./run.sh</code>).</li><li><code>key.pem</code> must only be readable and writable by its owner (mode 600).</li></ul>`,
    hints: ['<code>ls -l</code> shows the mode. A script needs the <code>x</code> bit.', '<code>chmod +x run.sh</code>, then <code>./run.sh</code>.', '<code>chmod 600 key.pem</code>'],
    files: { 'deploy/run.sh': '#!/bin/bash\necho "deploy PASS"\n', 'deploy/key.pem': { data: 'secret\n', mode: 0o644 } },
    cwd: 'deploy',
    solution: ['./run.sh', 'chmod +x run.sh', './run.sh', 'chmod 600 key.pem'],
    goals: [
      { label: 'run.sh is executable', ok: (sh) => ((sh.fs.get(sh.abs('run.sh'))?.mode ?? 0) & 0o100) !== 0 },
      { label: 'run.sh ran and printed PASS', ok: (_s, h) => h.some((e) => /run\.sh/.test(e.cmd) && e.out.includes('deploy PASS')) },
      { label: 'key.pem is mode 600', ok: (sh) => ((sh.fs.get(sh.abs('key.pem'))?.mode ?? 0) & 0o777) === 0o600 },
    ],
  }),
};

// ---- 8. loops
const loops: ShellLevel = {
  id: 'sh-loop', title: 'Archive the old logs', concept: 'for loops, globs, parameter expansion', xp: 80, tier: 'guided',
  ticket: 'Rotate last week\'s logs: every run_N.log becomes run_N.log.bak, in one command, not twelve.',
  build: () => ({
    brief: `<p>In <code>~/runs</code> rename every <code>*.log</code> file to the same name ending in <code>.bak</code> (<code>run_1.log</code> becomes <code>run_1.bak</code>). Use a <code>for</code> loop.</p>`,
    hints: ['<code>for f in *.log; do ...; done</code>', '<code>${f%.log}</code> strips the suffix: <code>mv "$f" "${f%.log}.bak"</code>'],
    files: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`runs/run_${i}.log`, `run ${i}\n`])),
    cwd: 'runs',
    solution: ['for f in *.log; do mv "$f" "${f%.log}.bak"; done'],
    goals: [
      { label: 'no .log files remain', ok: (sh) => !out(sh, 'ls').includes('.log') },
      { label: 'all six .bak files exist with their contents', ok: (sh) => [1, 2, 3, 4, 5, 6].every((i) => read(sh, `run_${i}.bak`) === `run ${i}\n`) },
      { label: 'you used a loop (not six mv commands)', ok: (_s, h) => ran(h, /\bfor\b/) },
    ],
  }),
};

// ---- 9. scripts
const scripts: ShellLevel = {
  id: 'sh-script', title: 'Write a log checker', concept: 'shell scripts, $1, exit codes, grep -c', xp: 100, tier: 'guided',
  ticket: 'CI needs a reusable check: given a log, say how many errors it has and fail if there are any.',
  build: () => ({
    brief: `<p>Create <code>~/check.sh</code>, an executable script that takes a log file as <code>$1</code>, prints <code>N errors</code> (N = lines containing <code>ERROR</code>) and exits with status <b>1</b> if N is not zero, <b>0</b> otherwise. It is tested on logs you have not seen.</p>
<pre>#!/bin/bash
n=$(grep -c ERROR "$1")
...</pre>`,
    hints: ['Put <code>#!/bin/bash</code> first, then <code>chmod +x check.sh</code>.', 'Write the file with <code>cat &gt; check.sh &lt;&lt;\'EOF\'</code> ... <code>EOF</code> (a here-document).', '<code>if [ "$n" -ne 0 ]; then exit 1; fi</code> and print with <code>echo "$n errors"</code>.'],
    files: { 'sample.log': 'INFO a\nERROR b\nINFO c\n' },
    solution: ["cat > check.sh <<'EOF'\n#!/bin/bash\nn=$(grep -c ERROR \"$1\")\necho \"$n errors\"\nif [ \"$n\" -ne 0 ]; then exit 1; fi\nexit 0\nEOF", 'chmod +x check.sh', './check.sh sample.log'],
    goals: [
      { label: 'check.sh is executable', ok: (sh) => ((sh.fs.get(sh.abs('check.sh'))?.mode ?? 0) & 0o100) !== 0 },
      {
        label: 'it reports the count and fails on errors (hidden logs)',
        ok: (sh) => {
          sh.fs.mkdir('/tmp/chk', true);
          sh.fs.writeFile('/tmp/chk/clean.log', 'INFO x\nINFO y\n');
          sh.fs.writeFile('/tmp/chk/bad.log', 'ERROR 1\nERROR 2\nINFO\nERROR 3\n');
          const a = sh.run('(cd /tmp/chk && ~/check.sh clean.log; echo "rc=$?")');
          const b = sh.run('(cd /tmp/chk && ~/check.sh bad.log; echo "rc=$?")');
          const ta = a.chunks.map((c) => c.text).join(''), tb = b.chunks.map((c) => c.text).join('');
          return /0 errors/.test(ta) && /rc=0/.test(ta) && /3 errors/.test(tb) && /rc=1/.test(tb);
        },
      },
    ],
  }),
};

// ---- 10. make
const CPROJ = {
  'proj/main.c': '#include "util.h"\nint main(void) { puts(GREETING); return 0; }\n',
  'proj/util.c': '#include "util.h"\nint twice(int x) { return 2 * x; }\n',
  'proj/include/util.h': '#define GREETING "hello v1"\nint twice(int x);\n',
};
const makeFirst: ShellLevel = {
  id: 'sh-make', title: 'Your first Makefile', concept: 'targets, prerequisites, pattern rules, $@ $<', xp: 100, tier: 'guided',
  ticket: 'The team builds by typing cc by hand. Write a Makefile so only what changed gets rebuilt.',
  build: () => ({
    brief: `<p>In <code>~/proj</code> write a <code>Makefile</code> that builds <code>app</code> from <code>main.o</code> and <code>util.o</code>. Each <code>.o</code> is compiled from its <code>.c</code> with <code>cc -Iinclude -c</code>. Add a <code>clean</code> target that removes the objects and the program.</p>
<p>Then prove it works: <code>make</code>, run <code>./app</code>, run <code>make</code> again (it should say it is up to date), and finish with <code>make clean</code>.</p>
<pre>app: main.o util.o
\tcc main.o util.o -o app

%.o: %.c
\tcc -Iinclude -c $&lt; -o $@</pre><p class="dim small">Recipe lines start with a real tab character.</p>`,
    hints: ['A <code>%.o: %.c</code> rule builds any object from its source; <code>$&lt;</code> is the first prerequisite and <code>$@</code> the target.', 'Do not forget <code>.PHONY: clean</code> so a file called clean cannot block it.', 'Use <code>printf</code> or a here-document to write tabs: <code>printf "app: main.o\\n\\tcc ..."</code>.'],
    files: CPROJ,
    cwd: 'proj',
    solution: ['printf \'app: main.o util.o\\n\\tcc main.o util.o -o app\\n\\n%%.o: %%.c\\n\\tcc -Iinclude -c $< -o $@\\n\\nclean:\\n\\trm -f *.o app\\n\\n.PHONY: clean\\n\' > Makefile', 'make', './app', 'make', 'make clean'],
    goals: [
      { label: 'make built the program and it prints its greeting', ok: (_s, h) => h.some((e) => /\.\/app/.test(e.cmd) && e.out.includes('hello v1')) },
      { label: 'a second make said everything is up to date', ok: (_s, h) => h.some((e) => /^make\b/.test(e.cmd) && e.out.includes('up to date')) },
      { label: 'make clean removed the objects and the program', ok: (sh) => !out(sh, 'ls').match(/\.o\b|\bapp\b/) && !!read(sh, 'Makefile') },
      { label: 'the Makefile uses a pattern rule or automatic variables', ok: (sh) => /%|\$@|\$</.test(read(sh, 'Makefile') ?? '') },
    ],
  }),
};

const makeHeader: ShellLevel = {
  id: 'sh-make-hdr', title: 'The stale build', concept: 'header dependencies, why make misses them', xp: 110, tier: 'guided',
  ticket: 'Someone bumped the greeting in util.h, ran make, and the binary still says v1. The Makefile never learned that objects depend on headers.',
  build: () => ({
    brief: `<p>The Makefile in <code>~/proj</code> works, but it does not know that <code>main.o</code> and <code>util.o</code> depend on <code>include/util.h</code>.</p>
<ul><li>Run <code>make</code> and <code>./app</code> to see <code>hello v1</code>.</li><li>Change the greeting in <code>include/util.h</code> to <code>hello v2</code> and run <code>make</code> again. <code>./app</code> still says v1: that is the bug.</li><li>Fix the Makefile so objects depend on the header, then rebuild. <code>./app</code> must print <code>hello v2</code>.</li></ul>`,
    hints: ['A rule with no recipe just adds prerequisites: <code>main.o util.o: include/util.h</code>.', 'After editing the Makefile, run <code>make</code> again: now the objects are older than the header and rebuild.'],
    files: { ...CPROJ, 'proj/Makefile': 'app: main.o util.o\n\tcc main.o util.o -o app\n\n%.o: %.c\n\tcc -Iinclude -c $< -o $@\n\nclean:\n\trm -f *.o app\n\n.PHONY: clean\n' },
    cwd: 'proj',
    solution: ['make', './app', "sed -i 's/v1/v2/' include/util.h", 'make', './app', "echo 'main.o util.o: include/util.h' >> Makefile", 'make', './app'],
    goals: [
      { label: 'the Makefile now lists the header as a prerequisite', ok: (sh) => /util\.h/.test(read(sh, 'Makefile') ?? '') },
      { label: 'the program built from the new header prints hello v2', ok: (sh) => /hello v2/.test(sh.capture('./app')) },
      { label: 'you saw the stale v1 build first', ok: (_s, h) => h.some((e) => /\.\/app/.test(e.cmd) && e.out.includes('hello v1')) },
    ],
  }),
};

// ---- 11. python from the shell
const py: ShellLevel = {
  id: 'sh-python', title: 'A quick script', concept: 'python3 from the shell, scripts and shebangs', xp: 60, tier: 'guided',
  ticket: 'Sometimes a ten-line Python script is the right answer. Practice the loop: write it, run it, read the output.',
  build: () => ({
    brief: `<p>Create <code>fib.py</code> that prints the first 10 Fibonacci numbers on one line, separated by spaces (<code>0 1 1 2 3 5 8 13 21 34</code>), then run it with <code>python3 fib.py</code>.</p>`,
    hints: ['Write the file with a here-document: <code>cat &gt; fib.py &lt;&lt;\'EOF\'</code> ... <code>EOF</code>.', '<code>a, b = 0, 1</code> and a loop that appends <code>a</code> then does <code>a, b = b, a + b</code>; <code>print(" ".join(...))</code>.'],
    files: {},
    solution: ["cat > fib.py <<'EOF'\na, b = 0, 1\nxs = []\nfor _ in range(10):\n    xs.append(str(a))\n    a, b = b, a + b\nprint(' '.join(xs))\nEOF", 'python3 fib.py'],
    goals: [
      { label: 'fib.py exists', ok: (sh) => read(sh, 'fib.py') !== null },
      { label: 'running it printed the first ten Fibonacci numbers', ok: (_s, h) => h.some((e) => /python3?\s+fib\.py/.test(e.cmd) && norm(e.out) === '0 1 1 2 3 5 8 13 21 34') },
    ],
  }),
};

// ===================================================================== bosses
const bossTriage: ShellLevel = {
  id: 'sh-boss-triage', title: 'Boss: regression triage', concept: 'globs, grep, awk, sort, uniq under pressure', xp: 220, tier: 'boss',
  ticket: 'Overnight regression: dozens of runs, several tests flaking. The 9am meeting wants the offenders ranked. No hints.',
  build: (r: Rng) => {
    const tests = ['t_alu', 't_fifo', 't_axi', 't_dma', 't_irq', 't_cache', 't_uart'];
    const runs = between(r, 6, 9);
    const fails = new Map<string, number>();
    const files: Record<string, string> = {};
    const flaky = [pick(r, tests), pick(r, tests), pick(r, tests)];
    for (let i = 1; i <= runs; i++) {
      const rows: string[] = [];
      for (const t of tests) {
        const hit = (flaky.includes(t) && r() < 0.6) || r() < 0.08;
        rows.push(`${hit ? 'FAIL' : 'PASS'} ${t} seed=${between(r, 100, 999)}`);
        if (hit) fails.set(t, (fails.get(t) ?? 0) + 1);
      }
      files[`regress/run_${String(i).padStart(2, '0')}.log`] = rows.join('\n') + '\n';
    }
    // break ties so the expected order is unambiguous (count desc, then name)
    const ranked = [...fails].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const expected = ranked.map(([t, c]) => `${t} ${c}`).join('\n');
    return {
      brief: `<p>The logs are <code>~/regress/run_*.log</code>. Each line is <code>PASS|FAIL test seed=N</code>.</p>
<p>Write <code>~/report.txt</code>: every test that <b>failed in at least 2 runs</b>, one per line as <code>TEST COUNT</code>, most failures first (ties broken alphabetically by test name). Tests that never fail or failed once must not appear.</p>`,
      hints: [],
      files,
      solution: [`cat regress/*.log | grep FAIL | awk '{print $2}' | sort | uniq -c | awk '$1>=2 {print $2, $1}' | sort -k2,2nr -k1,1 > report.txt`],
      goals: [fileIs('report.txt', expected || 'none', 'report.txt lists the repeat offenders in the right order with the right counts')],
    };
  },
};

const bossMake: ShellLevel = {
  id: 'sh-boss-make', title: 'Boss: fix the build system', concept: 'make dependencies, phony targets, incremental builds', xp: 240, tier: 'boss',
  ticket: 'The build "works on my machine". Three engineers rebuild from scratch every time because nobody trusts it. No hints.',
  build: (r: Rng) => {
    const n = between(r, 3, 5);
    const names = ['alu', 'fifo', 'ctl', 'dma', 'uart'].slice(0, n);
    const files: Record<string, string> = {
      'proj/include/cfg.h': '#define BANNER "build-A"\n',
      'proj/main.c': '#include "cfg.h"\nint main(void) { puts(BANNER); return 0; }\n',
    };
    for (const nm of names) files[`proj/${nm}.c`] = `#include "cfg.h"\nint ${nm}_step(int x) { return x + ${between(r, 1, 9)}; }\n`;
    // a file called "clean" exists, the header dependency is missing, and the link line lists nothing but main.o
    files['proj/clean'] = 'stale marker\n';
    const objs = ['main', ...names].map((x) => `${x}.o`);
    files['proj/Makefile'] = `app: ${objs.join(' ')}\n\tcc ${objs.join(' ')} -o app\n\n%.o: %.c\n\tcc -Iinclude -c $< -o $@\n\nclean:\n\trm -f *.o app\n`;
    const banner2 = `build-${pick(r, ['B', 'C', 'D'])}`;
    return {
      brief: `<p>The project is in <code>~/proj</code> and the <code>Makefile</code> has several problems. Without being told what they are, make these true:</p>
<ul><li><code>make clean</code> really cleans (try it).</li><li>Changing <code>include/cfg.h</code> rebuilds <b>every</b> object that includes it. The tests change the banner to <code>${banner2}</code> and expect <code>./app</code> to show it after a plain <code>make</code>.</li><li>Touching one <code>.c</code> file rebuilds only that object.</li></ul>`,
      hints: [],
      files, cwd: 'proj',
      solution: ['printf ".PHONY: clean\\n" >> Makefile', `echo '${objs.join(' ')}: include/cfg.h' >> Makefile`, 'make clean', 'make'],
      goals: [
        {
          label: 'make clean removes objects and the program even though a file called clean exists',
          ok: (sh) => { sh.run('make'); sh.run('make clean'); return !out(sh, 'ls').match(/\.o\b|\bapp\b/); },
        },
        {
          label: 'a header change triggers a rebuild of everything that includes it',
          ok: (sh) => { sh.run('make clean'); sh.run('make'); sh.run(`sed -i 's/build-[A-D]/${banner2}/' include/cfg.h`); sh.run('make'); return sh.capture('./app').trim() === banner2; },
        },
        {
          label: 'touching one source rebuilds only its object',
          ok: (sh) => { sh.run('make'); sh.run(`touch ${names[0]}.c`); const o = sh.capture('make'); return o.includes(`${names[0]}.c`) && (o.match(/cc -Iinclude -c/g) ?? []).length === 1; },
        },
      ],
    };
  },
};

export const SH_LEVELS: ShellLevel[] = [nav, grepMission, pipes, findMission, awkMission, sedMission, perms, loops, scripts, makeFirst, makeHeader, py, bossTriage, bossMake];

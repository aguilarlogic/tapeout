// Practice banks and bosses for the engineer's toolbox: shell and regex, git, Python, TCL/Make flows.
import { has, num, qty, rx } from '../lessons/answers';
import { calc, choice, count, show, sim, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, exact, mcs, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';

// ------------------------------------------------------------------ shell & regex

const REGEX_IDEA = 'A regular expression is a pattern. Plain characters match themselves; special symbols add rules: ^ is the start of a line, $ the end, [0-9] any one digit, + means one or more, * zero or more, (a|b) means a or b, and a backslash makes a special symbol literal. Build it from the examples: what must be there, what can vary, and what pins it in place.';

const REGEX_TASKS = [
  // [difficulty, task, canonical, should match, should not match, method, [piece question, right, wrong]]
  [1, 'lines containing ERROR in capitals', 'ERROR', ['UVM_ERROR @ 10ns: bad', 'ERROR: timeout'], ['error: lower case', 'WARNING: slow'], 'matching literal text', ['Is any special symbol needed, or is plain text enough?', 'Plain text: the letters match themselves, in capitals', ['An anchor ^ at the start', 'A repeat + after each letter']]],
  [1, 'a seed written like seed=12345 (seed= then at least one digit)', 'seed=[0-9]+', ['seed=1', 'run 4 seed=98765 ok'], ['seed=', 'seed=abc'], 'classes and repeats', ['"At least one digit" is written:', '[0-9]+', ['[0-9]*', '[0-9]']]],
  [1, 'test names that end in _test', '_test$', ['fifo_test', 'axi_burst_test'], ['fifo_test_old', 'testbench', 'test_fifo'], 'anchors', ['Which symbol pins a match to the END of the line?', '$', ['^', '+']]],
  [2, 'hex numbers like 0x1F, 0xdeadBEEF or 0x0', '0x[0-9a-fA-F]+', ['0x1F', 'val=0xdeadBEEF', '0x0'], ['0x', '1F', '0xZZ'], 'classes and repeats', ['Which class covers every hex digit?', '[0-9a-fA-F]', ['[0-9]', '[a-z]']]],
  [2, 'lines that START with UVM_ERROR or UVM_FATAL', '^UVM_(ERROR|FATAL)', ['UVM_ERROR x', 'UVM_FATAL y'], ['  UVM_ERROR', 'UVM_WARNING z', 'x UVM_FATAL'], 'anchors and alternatives', ['How do you say "ERROR or FATAL"?', '(ERROR|FATAL)', ['[ERROR,FATAL]', 'ERROR+FATAL']]],
  [2, 'simulation timestamps like "@ 1234 ns" (an @, a space, digits, a space, ns)', '@ [0-9]+ ns', ['@ 10 ns', 'at @ 123456 ns'], ['@ ns', '@ 12 ps', '@12ns'], 'classes and repeats', ['Between "@ " and " ns" you need:', '[0-9]+', ['[0-9]', '.']]],
  [3, 'bus references like data_q[7] or addr[15:0]', '\\w+\\[\\d+(:\\d+)?\\]', ['data_q[7]', 'addr[15:0]', 'x[0]'], ['data_q[]', 'addr[15:]', 'data_q'], 'escapes and optional groups', ['To match a literal square bracket you write:', '\\[ (escape it)', ['[ (unescaped)', '{ }']]],
  [3, "Verilog sized literals like 8'hFF, 4'b1010 or 32'd7", "[0-9]+'[bdh][0-9a-fA-F_]+", ["8'hFF", "4'b1010", "32'd7"], ["'hFF", "8'q12", "8'h"], 'escapes and optional groups', ['After the size and the apostrophe, one base letter b, d or h is:', "[bdh]", ['(bdh)', 'bdh+']]],
  [3, 'lines that do NOT contain PASS anywhere', '^(?!.*PASS)', ['FAIL fifo_test', 'timeout in axi'], ['PASS fifo_test', 'test 3 PASS'], 'negative lookahead', ['Which piece says "from the start of the line, PASS never appears after this point"?', '(?!.*PASS)', ['[^PASS]', '!PASS']]],
  [3, 'Verilog identifiers that start with a letter or underscore, like clk_en or _tmp1', '^[A-Za-z_][A-Za-z0-9_]*$', ['clk_en', '_tmp1', 'a'], ['1abc', 'clk-en', 'a b'], 'anchors, classes and repeats', ['Why anchor the pattern with ^ and $?', 'So the whole line must be an identifier, not just contain one', ['To make the match run faster', 'To allow any characters in between']]],
  [3, 'dotted quads such as 192.168.0.1 (four groups of 1 to 3 digits)', '^[0-9]{1,3}(\\.[0-9]{1,3}){3}$', ['192.168.0.1', '10.0.0.255'], ['192.168.0', '1.2.3.4.5', 'a.b.c.d'], 'counted repeats', ['To repeat a group exactly three times you write:', '(...){3}', ['(...)+3', '(...)*3']]],
  [3, 'lines containing PASS or FAIL as a whole word, not inside another word', '\\b(PASS|FAIL)\\b', ['test PASS', 'FAIL fifo', 'x: FAIL.'], ['PASSED', 'BYPASS', 'FAILURE'], 'word boundaries', ['Which symbol marks a word boundary?', '\\b', ['\\w', '^']]],
  [3, 'a hex literal with optional underscores, like 0xDEAD_BEEF', '0x[0-9a-fA-F]+(_[0-9a-fA-F]+)*', ['0xDEAD_BEEF', '0x1F', '0x12_34_56'], ['0x', '0xZZ', 'DEAD_BEEF'], 'optional repeating groups', ['Which suffix means "zero or more of the group"?', '*', ['+', '?']]],
  [3, "a Verilog sized binary like 4'b1010 or 8'b0000_1111", "[0-9]+'b[01_]+", ["4'b1010", "8'b0000_1111"], ["4'bx", "8'hFF", "'b01"], 'classes inside literals', ['Which class allows only the digits 0 and 1, and underscores?', '[01_]', ['[0-9]', '[01-]']]],
] as const;

const TESTS = ['fifo_test', 'axi_test', 'dma_test', 'irq_test', 'cdc_test'];
function results(r: Rng, n: number) {
  return Array.from({ length: n }, () => ({ t: pick(r, TESTS), ok: r() < 0.55, seed: between(r, 1000, 9999) }));
}

const PERM = (bits: number) => (bits & 4 ? 'r' : '-') + (bits & 2 ? 'w' : '-') + (bits & 1 ? 'x' : '-');

/** Command-writing tasks: [difficulty, task, canonical, required tokens, method, idea, [piece question, right, wrong]]. */
const SHELL_TASKS = [
  [1, 'Show the last 50 lines of run.log.', 'tail -n 50 run.log', [['tail'], ['50'], ['run.log']], 'the tail command', 'tail prints the END of a file. -n N says how many lines. The shape is: the tool, the option, then the file.', ['Which tool prints the end of a file?', 'tail', ['head', 'cat']]],
  [1, 'Count the lines in run.log that contain UVM_ERROR.', 'grep -c UVM_ERROR run.log', [['grep'], ['-c', 'wc -l'], ['uvm_error'], ['run.log']], 'grep -c', 'grep searches for text. Normally it prints the matching lines; with -c it prints just how many there are. The shape is: grep, option, what to find, where.', ['Which option makes grep print a count?', '-c', ['-n', '-v']]],
  [1, 'Keep printing new lines of run.log as the simulation writes them.', 'tail -f run.log', [['tail'], ['-f', '-F', '--follow'], ['run.log']], 'tail -f', 'tail -f keeps the file open and prints new lines as they arrive. It is how you watch a simulation live.', ['Which option keeps following the file?', '-f', ['-n', '-c']]],
  [2, 'Find every file named *.sv under the rtl directory.', 'find rtl -name "*.sv"', [['find'], ['rtl'], ['-name', '-iname'], ['.sv']], 'find by name', 'find walks a directory tree. First the directory to start in, then a test such as -name with a pattern. Quote the pattern so the shell does not expand the * first.', ['Which tool searches directories for files by name?', 'find', ['grep', 'sed']]],
  [2, 'Replace every "clk_old" with "clk_core" in top.sv, in place.', "sed -i 's/clk_old/clk_core/g' top.sv", [['sed'], ['-i'], ['s/clk_old/clk_core/'], ['top.sv']], 'sed substitute', 's/old/new/g is sed\'s replace command: g means every occurrence on each line. By default sed only prints the result; -i writes it back into the file (GNU sed; macOS sed needs `sed -i \'\'`).', ['Which flag edits the file in place?', '-i', ['-n', '-e']]],
  [2, 'Search recursively for "fifo_full" in every file under rtl/, showing line numbers.', 'grep -rn fifo_full rtl/', [['grep'], ['-r', '-R', '--recursive', '-nr', '-nR'], ['-n', '-rn', '-Rn', '--line-number'], ['fifo_full'], ['rtl']], 'recursive grep', 'grep -r searches every file under a directory, and -n adds the line number of each match. You can combine flags: -rn.', ['Which flag searches directories recursively?', '-r', ['-l', '-c']]],
  [3, 'Print only the 3rd whitespace-separated column of report.txt, for lines whose 2nd column is FAIL.', "awk '$2 == \"FAIL\" {print $3}' report.txt", [['awk'], ['$2'], ['fail'], ['print $3'], ['report.txt']], 'awk fields', 'awk splits every line into columns called $1, $2, $3. A condition picks which lines to act on, and the braces say what to do: awk \'condition {action}\' file.', ['How does awk name the 3rd column?', '$3', ['%3', '3$']]],
  [3, 'Run make, and only if it succeeds, run ./sim.', 'make && ./sim', [['make'], ['&&'], ['./sim']], 'chaining with &&', 'Every command ends with an exit status: 0 means success. && runs the next command only if the previous one succeeded, so a failed build never reaches the simulator.', ['Which joiner runs the second command only if the first succeeded?', '&&', [';', '|']]],
  [3, 'Send both stdout and stderr of ./sim into sim.log.', './sim > sim.log 2>&1', [['./sim'], ['sim.log'], ['2>&1', '&>']], 'redirecting both streams', 'A program writes normal output to stream 1 (stdout) and errors to stream 2 (stderr). > file sends stdout to a file; 2>&1 sends stderr to wherever stdout is going. Order matters: redirect to the file first, then add 2>&1. (&> is a bash-only shorthand for the same thing; > file 2>&1 works in any POSIX shell.)', ['To send stderr to the same place as stdout, add:', '2>&1', ['1>&2', '>> 2']]],
  [3, 'Print how many different tests appear in the first column of results.txt.', "cut -d' ' -f1 results.txt | sort -u | wc -l", [['cut', 'awk'], ['sort'], ['-u', 'uniq'], ['wc'], ['results.txt']], 'sort -u and wc', 'sort -u prints each distinct line once, and wc -l counts lines. Pipe them: pull out the column, remove the duplicates, then count.', ['Which sort option drops duplicate lines?', '-u', ['-r', '-n']]],
  [3, 'List the 5 largest files in the current directory, biggest first.', 'ls -S | head -n 5', [['ls'], ['-s'], ['head'], ['5']], 'ls -S', 'ls -S sorts by size, largest first, and head -n 5 keeps just the first five lines.', ['Which ls option sorts by size?', '-S', ['-t', '-r']]],
  [3, 'Run ./sim in the background so you can keep using the terminal.', './sim &', [['./sim'], ['&']], 'background jobs', 'A trailing & starts the command in the background and gives the prompt back. jobs lists them and fg brings one to the front.', ['Which symbol at the end of a command runs it in the background?', '&', ['|', ';']]],
  [3, 'Print every line of run.log that does NOT contain PASS.', 'grep -v PASS run.log', [['grep'], ['-v'], ['pass'], ['run.log']], 'inverting grep', 'grep -v prints the lines that do NOT match. It hides the noise and keeps what is left.', ['Which grep option inverts the match?', '-v', ['-i', '-c']]],
  [3, 'Delete every .tmp file under the current directory, in one command.', 'find . -name "*.tmp" -delete', [['find'], ['-name', '-iname'], ['.tmp'], ['-delete', 'xargs rm', '-exec rm']], 'find -delete', 'find can act on what it finds: -delete removes each match. Try it with -print first, because there is no undo.', ['Which find action removes the matched files?', '-delete', ['-remove', '-kill']]],
] as const;

export const shellPractice = practice('practice-shell', 'Shell Drills', 'regex, pipes, grep/sort/uniq, permissions', [
  (r, d) => {
    const [, task, canon, pos, neg, method, [pq, pr, pw]] = pick(r, REGEX_TASKS.filter((x) => x[0] === d));
    const a = rx(canon, [...pos], [...neg]);
    return walk(ask(`Write a regular expression${/\\d|\(\?[=!]/.test(canon) ? " (Python `re` syntax; grep -P is the same)" : ""} that matches ${task}.\nMust match: ${pos.map((x) => `\`${x}\``).join(', ')}\nMust not match: ${neg.map((x) => `\`${x}\``).join(', ')}`, a, `One answer: \`${canon}\`. I test yours against every example, so any correct pattern passes.`, 'Anchors: ^ start, $ end. Classes: [0-9] works in every tool; \\w and \\d are Perl-style shorthands (Python re, grep -P). Repeats: + one or more, * zero or more.'),
      `regex: ${method}`, REGEX_IDEA,
      'Look at what the "must match" lines share, and what the "must not match" lines lack: that difference is exactly what your pattern has to demand.',
      choice(pq, pr, pw),
      step('Now write the whole pattern:', a));
  },
  (r, d) => {
    const rows = results(r, tier(d, 6, 8, 10));
    const log = rows.map((x) => `${x.t} ${x.ok ? 'PASS' : 'FAIL'} seed=${x.seed}`).join('\n');
    if (d === 1) {
      const n = rows.filter((x) => !x.ok).length;
      return walk(ask(`results.txt:${code(log)}What does \`grep -c FAIL results.txt\` print?`, num(n), `-c counts matching lines: ${n}.`, 'Count the lines containing FAIL.'),
        'counting matches with grep -c', 'grep FAIL file keeps only the lines containing FAIL. Adding -c prints how many such lines there are instead of the lines themselves. To predict the output, do what grep does: look at each line and ask "does it contain FAIL?".',
        count('How many of the lines above contain FAIL? Count them:', 'grep -c FAIL results.txt', n));
    }
    if (d === 2) {
      const fails = rows.filter((x) => !x.ok);
      const n = new Set(fails.map((x) => x.t)).size;
      return walk(ask(`results.txt:${code(log)}What does \`grep FAIL results.txt | cut -d' ' -f1 | sort -u | wc -l\` print?`, num(n), `grep keeps the failing lines, cut takes the test name, sort -u removes duplicates, wc -l counts: ${n} distinct failing tests.`, 'How many different test names failed?'),
        'reading a pipeline stage by stage', 'A pipe | feeds one command\'s output into the next. Read it left to right and write down what comes out after each stage; the last stage\'s output is the answer. Here: grep keeps lines, cut -d\' \' -f1 keeps the first space-separated word (the test name), sort -u sorts and drops duplicates, wc -l counts lines.',
        count('After grep: how many FAIL lines survive?', 'grep FAIL', fails.length),
        step('After cut: the first word of each of those lines. Write the test names, separated by commas:', exact(fails.map((x) => x.t).join(','))),
        count('After sort -u: duplicates vanish. How many different names remain? wc -l counts them:', 'sort -u | wc -l', n));
    }
    const counts = new Map<string, number>();
    rows.forEach((x) => counts.set(x.t, (counts.get(x.t) ?? 0) + 1));
    const top = Math.max(...counts.values());
    return walk(ask(`results.txt:${code(log)}\`cut -d' ' -f1 results.txt | sort | uniq -c | sort -rn | head -1\` prints a count and a name. What is the count?`, num(top), `uniq -c counts adjacent duplicates (hence the sort first), sort -rn orders by count, head -1 takes the biggest: ${top}. This one-liner is the classic "what fails most?" triage.`, 'Which test name appears most often, and how many times?'),
      'the count-and-rank pipeline', 'sort | uniq -c is the shell\'s way of tallying: sort puts equal lines next to each other, and uniq -c collapses each run into "count line". A second sort -rn ranks by that count, biggest first, and head -1 keeps the top row. The answer is that row\'s count.',
      'cut keeps the first word of every line, the test name. After sort | uniq -c you get one row per name with how often it appears:',
      ...sim([...counts.entries()].sort().map(([t, c]) => ({ beats: [count(`How many lines of the log start with \`${t}\`? That is its uniq -c count:`, `count of ${t}`, c)], row: `${String(c).padStart(3)} ${t}` })), 3, 'what uniq -c prints'),
      count('sort -rn puts the biggest count first and head -1 keeps it. That count is:', 'max of the counts', top));
  },
  (r, d) => {
    const [, task, canon, toks, method, idea, [pq, pr, pw]] = pick(r, SHELL_TASKS.filter((x) => x[0] === d));
    const a = has(canon, ...toks.map((t) => [...t]));
    return walk(ask(`Write the command: ${task}`, a, `One answer: \`${canon}\`.`, 'Think of the tool first (tail, grep, find, sed, awk), then its flags.'),
      method, idea,
      choice(pq, pr, pw),
      step('Now write the whole command:', a));
  },
  (r, d) => {
    const bits = [between(r, 4, 7), between(r, 0, 7), between(r, 0, 7)];
    const oct = bits.join('');
    const str = bits.map(PERM).join('');
    const idea = 'Unix permissions are three groups of three switches: user, group, others. Each group has read (r), write (w) and execute (x), worth 4, 2 and 1. A group\'s digit is the sum of its switches: r-x = 4 + 1 = 5; rwx = 7; r-- = 4. Three digits, one per group, make the octal mode.';
    if (d === 1) return walk(ask(`What permission string does \`chmod ${oct} file\` give? (like rwxr-xr-x)`, exact(str), `Each digit is r=4 + w=2 + x=1, for user, group, others: ${oct} → ${str}.`, 'Split each digit into 4 + 2 + 1.'),
      'octal digits to permission letters', idea,
      ...bits.map((b, i) => step(`The ${['user', 'group', 'others'][i]} digit is ${b}. Which of 4 (r), 2 (w), 1 (x) add up to ${b}? Write it as three characters, like r-x:`, exact(PERM(b)))),
      step('Put the three groups side by side:', exact(str)));
    const groups = [str.slice(0, 3), str.slice(3, 6), str.slice(6)];
    return walk(ask(`A file shows \`-${str}\`. What octal mode is that?`, num(parseInt(oct, 10)), `${groups[0]} = ${bits[0]}, ${groups[1]} = ${bits[1]}, ${groups[2]} = ${bits[2]} → ${oct}.${d === 3 ? ' Scripts need x to run; shared project directories often need g+w too.' : ''}`, 'r = 4, w = 2, x = 1, per group of three.'),
      'permission letters to octal digits', idea,
      ...bits.map((b, i) => count(`${['User', 'Group', 'Others'][i]} is \`${groups[i]}\`. Add 4 for r, 2 for w, 1 for x:`, groups[i].split('').map((c, k) => (c === '-' ? '0' : String([4, 2, 1][k]))).join(' + '), b)),
      count('Write the three digits side by side (as one number):', bits.join(''), parseInt(oct, 10)));
  },
  (r) => concept(r, [
    ['`grep FAIL log.txt` finds nothing. What is `$?` afterwards?', '1', ['0', '2', '-1'], 'exit status', 'Every command leaves an exit status in $?. By convention 0 means success and non-zero means trouble. grep\'s own rule: 0 if it found a match, 1 if it found none, 2 if something went wrong (like a missing file).', ['grep found no match. Which status does it use for "no match"?', '1', ['0', '2']], '1. Every command leaves an exit status in $?. By convention 0 means success and non-zero means trouble. grep\'s own rule: 0 if it found a match, 1 if it found none, 2 if something went wrong (like a missing file)'],
    ['What is the difference between `>` and `>>`?', '`>` overwrites the file, `>>` appends to it', ['`>` appends to the file, while `>>` overwrites what was there', 'They are identical, and both overwrite the file each time', '`>>` redirects stderr, while `>` redirects stdout only'], 'redirection', 'Redirection sends a command\'s output to a file instead of the screen. The single arrow starts the file afresh (anything already in it is lost); the double arrow adds to the end.', ['Which one would erase the old contents of log.txt?', '>', ['>>', 'Neither']], '> overwrites the file, >> appends to it'],
    ['`cmd1 ; cmd2` versus `cmd1 && cmd2`?', '`;` always runs cmd2; `&&` only if cmd1 succeeded', ['They are identical, and both skip cmd2 when cmd1 fails', '`&&` runs both of them in parallel, while `;` runs them in turn', '`;` runs cmd2 only when cmd1 failed, and `&&` after a success'], 'chaining commands', 'A semicolon just means "then": the second command runs no matter what. && means "and, if that worked": the second runs only when the first exits with status 0.', ['cmd1 fails. Which joiner still runs cmd2?', ';', ['&&', 'Both skip it']], '; always runs cmd2; && runs cmd2 only if cmd1 succeeded'],
    ['What does `2>&1` mean?', 'Send stderr (2) to where stdout (1) goes', ['Run two commands', 'Append the output to file 1, instead of overwriting the file', 'Swap stdin and stdout'], 'file descriptors', 'Every program has numbered streams: 0 input, 1 normal output (stdout), 2 error output (stderr). 2>&1 reads "make stream 2 point to where stream 1 points right now", which is how you capture both in one log.', ['Which number is stderr?', '2', ['0', '1']], 'Send stderr (2) to wherever stdout (1) currently goes'],
    ['How do you run a long regression so it survives logging out?', 'Use nohup, tmux or screen, or the farm scheduler', ['Close the terminal quickly, before the session is taken down', 'Run it with sudo', 'Press Ctrl+Z, so that the shell keeps the job for later use'], 'long-running jobs', 'Closing a terminal sends its programs a hang-up signal, which kills them. nohup ignores it; tmux and screen keep a session alive on the machine; real regressions go to a scheduler (LSF, Slurm) on the compute farm.', ['When the terminal closes, what happens to a normal running job?', 'It gets a hang-up signal and usually dies', ['It keeps running forever', 'It pauses until you return']], 'Use nohup, tmux/screen, or submit it to the farm scheduler'],
    ['What does `xargs` do in `find . -name "*.log" | xargs grep -l FAIL`?', 'Turns file names on stdin into arguments for grep', ['Deletes the files that find lists', 'Sorts the list of file names, before it is passed to grep', 'Counts the files that find lists'], 'xargs', 'A pipe passes text as a command\'s input, but grep wants file names as arguments. xargs bridges them: it reads names from its input and puts them after the command, so grep -l FAIL runs on every file find found.', ['grep -l FAIL wants file names as:', 'Arguments on its command line', ['Keyboard input', 'Environment variables']], 'Turns the list of file names on stdin into arguments for grep'],
  ], (why) => `The answer is: ${why}.`),
]);

// ------------------------------------------------------------------ git

/** Git command tasks: [difficulty, task, canonical, required tokens, method, idea, [piece question, right, wrong]]. */
const GIT_TASKS = [
  [1, 'Stage every change in the rtl directory.', 'git add rtl', [['git add'], ['rtl']], 'staging with git add', 'git keeps a staging area: the list of changes the next commit will contain. git add <path> puts changes there; nothing is saved until you commit.', ['Which command puts changes into the staging area?', 'git add', ['git commit', 'git push']]],
  [1, 'Create and switch to a new branch called fix-fifo.', 'git switch -c fix-fifo', [['git'], ['switch -c', 'checkout -b'], ['fix-fifo']], 'creating a branch', 'git switch moves you to another branch. Adding -c (create) makes the branch first. The older spelling is git checkout -b.', ['Which flag creates the branch as you switch?', '-c', ['-d', '-m']]],
  [1, 'Show what you changed but have not staged yet.', 'git diff', [['git diff']], 'git diff', 'git diff prints your unstaged edits line by line. (git diff --staged shows what is staged.) It is how you review your own work before committing.', ['Which command shows changes that are not staged yet?', 'git diff', ['git log', 'git show']]],
  [2, 'Undo your last commit but keep its changes staged.', 'git reset --soft HEAD~1', [['git reset'], ['--soft'], ['head~1', 'head^']], 'a soft reset', 'git reset moves the branch pointer back. The mode decides what happens to the undone changes: --soft keeps them staged, --mixed keeps them unstaged, --hard throws them away. HEAD~1 means "one commit before HEAD".', ['Which mode keeps the undone changes staged?', '--soft', ['--hard', '--mixed']]],
  [2, 'Undo a commit (abc123) that is already pushed, safely, by adding a new commit.', 'git revert abc123', [['git revert'], ['abc123']], 'reverting a pushed commit', 'Once a commit is pushed, others may have it, so you must not rewrite history. git revert <hash> adds a NEW commit that undoes the old one, and history stays intact.', ['Which command safely undoes a commit others already have?', 'git revert', ['git reset --hard', 'git rebase -i']]],
  [2, 'Temporarily shelve your uncommitted changes.', 'git stash', [['git stash']], 'git stash', 'git stash puts your uncommitted changes on a shelf and gives you a clean working tree; git stash pop brings them back. Use it when you must switch tasks mid-edit.', ['Which command shelves uncommitted changes?', 'git stash', ['git shelve', 'git clean']]],
  [3, 'Copy one commit (def456) from another branch onto yours.', 'git cherry-pick def456', [['git cherry-pick'], ['def456']], 'cherry-picking', 'Merge brings a whole branch; cherry-pick copies just one commit, named by its hash, onto the branch you are on (as a new commit).', ['Which command copies one single commit onto the current branch?', 'git cherry-pick', ['git merge', 'git rebase']]],
  [3, 'Find the commit where HEAD pointed before a bad reset, so you can recover it.', 'git reflog', [['git reflog']], 'the reflog', 'git reflog is a private diary of everywhere HEAD has been, including commits no branch points to any more. After a bad reset, the lost commit\'s hash is still listed there.', ['Which command lists where HEAD used to point?', 'git reflog', ['git status', 'git log --all']]],
  [3, 'Show who last changed each line of fifo.sv.', 'git blame fifo.sv', [['git blame', 'git annotate'], ['fifo.sv']], 'git blame', 'git blame prints the file with, on every line, the commit and author that last changed it. Use it to find out why a line is the way it is.', ['Which command shows who last changed each line?', 'git blame', ['git diff', 'git log']]],
  [3, 'Replay your branch commits on top of main, one by one.', 'git rebase main', [['git rebase'], ['main']], 'rebasing', 'git rebase main sets your commits aside, moves the branch to the tip of main, and replays them on top. History stays linear, but the replayed commits are new ones. (In a rebase conflict, HEAD and "ours" are the branch you are replaying onto, and "theirs" is your own commit being replayed: the reverse of a merge.)', ['Which command replays your commits on top of main?', 'git rebase', ['git merge', 'git cherry-pick']]],
  [3, 'Start a binary search for a bug between the known good tag v1.0 and now.', 'git bisect start HEAD v1.0', [['git bisect'], ['start'], ['v1.0']], 'starting a bisect', 'git bisect start <bad> <good> begins a binary search over the commits between a bad one and a good one. You then test each commit it checks out and answer good or bad.', ['What does git bisect need to start?', 'One bad and one good commit', ['Only the bad commit', 'A list of every commit']]],
  [3, 'Show the full history of one file, fifo.sv, following it across renames.', 'git log --follow fifo.sv', [['git log'], ['--follow'], ['fifo.sv']], 'following a file', 'git log <file> lists the commits that touched it; --follow keeps following it across renames, which a plain git log would lose.', ['Which flag follows a file across renames?', '--follow', ['--rename', '--all']]],
  [3, 'Squash your last 3 commits into one by editing them interactively.', 'git rebase -i HEAD~3', [['git rebase'], ['-i', '--interactive'], ['head~3']], 'interactive rebase', 'git rebase -i HEAD~3 opens the last three commits in an editor. Mark the later ones squash (or fixup) to fold them into the first.', ['Which flag makes a rebase interactive?', '-i', ['-s', '-f']]],
  [3, 'Delete the local branch fix-fifo after it has been merged.', 'git branch -d fix-fifo', [['git branch'], ['-d', '-D', '--delete'], ['fix-fifo']], 'deleting a branch', 'git branch -d deletes a branch and refuses if it has unmerged commits (-D forces it). Deleting a merged branch loses nothing.', ['Which flag deletes a branch safely?', '-d', ['-m', '-a']]],
] as const;

export const gitPractice = practice('practice-git', 'Git Drills', 'commits, branches, merge vs rebase, bisect, recovery', [
  (r, d) => {
    const n = pick(r, tier(d, [8, 16, 100], [300, 1000, 50], [5000, 12345, 777, 20000, 100000, 3000, 65000, 9999, 250000]));
    const k = Math.ceil(Math.log2(n));
    return walk(ask(`A test broke somewhere in the last ${n} commits. At most how many test runs does \`git bisect\` need?`, num(k), `Each run halves the range: ceil(log2(${n})) = ${k}. With \`git bisect run ./test.sh\` it runs unattended.`, 'Binary search: log2 of the number of commits.'),
      'binary search with git bisect', `git bisect finds the commit that broke something by binary search: it checks out the middle commit, you say good or bad, and half of the suspects are eliminated. Halving ${n} commits over and over until one is left takes about log2(${n}) rounds, rounded UP because you cannot run part of a test.`,
      calc('log2 of the number of commits:', `log2(${n})`, Math.log2(n), '', sig(Math.log2(n), 4), 0.005),
      count('Round up, since each run is a whole test:', `ceil(${sig(Math.log2(n), 4)})`, k));
  },
  (r, d) => {
    const m = between(r, tier(d, 0, 1, 2), tier(d, 3, 5, 9)), f = between(r, 1, tier(d, 3, 5, 8));
    const qs = [
      [`git log --oneline main..feature | wc -l`, f, `main..feature lists commits reachable from feature but not main: the ${f} feature commits.`, 'feature'],
      [`git log --oneline feature..main | wc -l`, m, `feature..main lists commits on main that feature lacks: ${m}.`, 'main'],
    ] as const;
    if (d === 3) {
      return walk(ask(`feature branched from main; since then main got ${m} commits and feature got ${f}. You run \`git rebase main\` on feature. How many commits are now in \`git log main..feature\`?`, num(f), `Rebase replays the ${f} feature commits on top of main (new hashes, same changes). main..feature still shows ${f}; feature..main is now 0.`, 'Rebase moves the feature commits; it does not add or remove any.'),
        'what a rebase does', 'git rebase main takes your branch\'s own commits, sets them aside, moves the branch to the tip of main, and replays them one by one on top. They get new hashes but the same changes, so nothing is added or dropped. Then "commits in feature but not in main" is exactly your own commits again. (If a replay conflicts, HEAD and "ours" mean the branch you are rebasing onto and "theirs" means your own commit being replayed: the opposite of a merge.)',
        choice('Does a rebase add or remove any of feature\'s own commits?', 'No: it replays the same ones on a new base', ['It drops main\'s commits', 'It squashes them into one']),
        count('So main..feature (feature\'s own commits) still counts:', `the ${f} feature commits`, f));
    }
    const [cmd, ans, why, side] = pick(r, qs);
    return walk(ask(`feature branched from main; since then main got ${m} commit${m === 1 ? '' : 's'} and feature got ${f}. What does \`${cmd}\` print?`, num(ans), why, 'A..B means "in B but not in A".'),
      'the A..B range', 'In git, A..B means "the commits you can reach from B that you cannot reach from A". Since feature branched from main, each side has its own commits after the split; the shared history before the split belongs to both and is left out. Decide which branch is on the right, then count that branch\'s own commits.',
      choice(`In \`${cmd.split(' ')[3]}\`, whose commits are listed?`, `Only ${side}'s own commits`, [`Only ${side === 'main' ? 'feature' : 'main'}'s own commits`, 'Every commit in the repository']),
      count(`Since the split, ${side} has how many commits? (wc -l counts them)`, `commits on ${side}`, ans));
  },
  (r, d) => {
    const [, task, canon, toks, method, idea, [pq, pr, pw]] = pick(r, GIT_TASKS.filter((x) => x[0] === d));
    const a = has(canon, ...toks.map((t) => [...t]));
    return walk(ask(`Write the git command: ${task}`, a, `One answer: \`${canon}\`.`, 'git <verb> <options> <target>.'),
      method, idea,
      choice(pq, pr, pw),
      step('Now write the whole command:', a));
  },
  (r) => concept(r, [
    ['You and a colleague both work on the shared branch `dev`. Should you rebase `dev`?', 'No: rebasing rewrites commits others already have; merge instead', ['Yes: always rebase shared branches, to keep the history linear', 'Only on Fridays, when nobody else is working on the branch', 'Rebasing and merging are identical, so either one is fine to use'], 'the golden rule of rebasing', 'A rebase makes NEW copies of commits with new hashes. If teammates already built on the old ones, their history and yours now disagree and merging becomes a mess. So: rebase only your own private work, never a branch others have pulled.', ['Does a rebase keep the old commits\' hashes?', 'No, it creates new commits with new hashes', ['Yes, it only moves a label', 'It deletes the hashes']], 'No: rebasing rewrites commits other people already have; merge instead'],
    ['A file shows `<<<<<<< HEAD … ======= … >>>>>>> feature`. What is between `<<<<<<< HEAD` and `=======`?', 'Your current branch\'s version of the lines', ['The feature branch\'s version of the lines that conflict', 'The common ancestor of the two branches', 'A git error message'], 'reading conflict markers', 'When two branches changed the same lines, git cannot choose, so it writes both versions into the file. The top half (from <<<<<<< HEAD to =======) is what is on the branch you are on; the bottom half is what is coming in. You edit to the right result, delete the markers, git add, and continue.', ['HEAD points to:', 'The branch (commit) you currently have checked out', ['The branch being merged in', 'The oldest commit']], 'Your current branch\'s version of the conflicting lines'],
    ['What does "detached HEAD" mean?', 'You checked out a commit; new commits belong to no branch', ['The repository is corrupted, and has to be fetched again from origin', 'HEAD was deleted by a bad rebase, so the branch is now lost', 'You are offline, and git cannot reach the remote to update HEAD'], 'detached HEAD', 'Normally HEAD points at a branch name, and new commits move that branch forward. If you check out a bare commit, HEAD points at the commit itself; new commits hang off it with no branch label, and switching away leaves them hard to find. Make a branch first to keep them.', ['When you commit on a detached HEAD, which branch moves forward?', 'None: no branch is attached', ['main', 'The last one you used']], 'You checked out a commit directly, not a branch; new commits will not belong to any branch unless you create one'],
    ['Why keep build outputs and waveforms out of git with `.gitignore`?', 'They are huge, regenerable and change every run', ['git cannot store binary files at all, so they have to stay out', 'They are secret, and must never be pushed to a shared server', 'They slow down the simulator, if they are in a tracked directory'], 'what belongs in a repository', 'git stores every version of every tracked file forever. Generated files (build output, waveform dumps) are large, change on every run, and can be recreated from the sources, so committing them only bloats the history. Commit the sources and the scripts; list the rest in .gitignore.', ['A waveform dump can be regenerated by rerunning the test. Should you commit it?', 'No: commit the sources and regenerate it', ['Yes, so you never lose it', 'Yes, but only on Mondays']], 'They are huge, regenerable and change every run, bloating history forever'],
    ['What does a fast-forward merge do?', 'Moves the branch pointer on, with no merge commit', ['Squashes all of the commits on the branch into just a single one', 'Deletes the source branch', 'Creates a merge commit that has two parents, one from each side'], 'fast-forward merges', 'If main has not moved since you branched, your branch is simply main plus some extra commits in a straight line. Merging then only needs to slide the main label forward to your tip: no new commit, no two-parent merge. A merge commit is needed only when both sides have new commits.', ['main has no new commits since you branched. To merge, git has to:', 'Just move the main label forward', ['Create a two-parent merge commit', 'Rewrite your commits']], 'Moves the branch pointer forward because there is no divergent history, creating no merge commit'],
      ['What does `git stash` do?', 'Sets your uncommitted changes aside, leaving a clean tree', ['Deletes all the changes that have not been committed', 'Pushes your changes to the remote repository', 'Creates a new branch from the current commit'],
        'stashing', 'Stash saves the working changes on a stack and restores the last commit. You can later bring them back with `git stash pop`, handy when you need to switch tasks.',
        ['To get stashed changes back, use:', 'git stash pop', ['git reset', 'git clean']]],
  ], (why) => `${why}.`),
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
    const idx = a.map((_, i) => String(i).padStart(2)).join(' ');
    const neg = a.map((_, i) => String(i - a.length).padStart(2)).join(' ');
    return walk(ask(`${code(`a = [${a.join(', ')}]\nprint(${e})`)}What does this print?`, exact(out), `${e} → ${out}. Slices are [start:stop:step], stop excluded; negative indexes count from the end.`, 'Index 0 is the first item; the stop index is not included.'),
      'list slicing', 'A slice a[start:stop:step] copies part of a list. Indexes start at 0; the stop index is NOT included; a negative index counts from the end (-1 is the last item); a step of 2 takes every second item and a negative step walks backwards. Leaving a part out means "from the beginning", "to the end" or "step 1".',
      show(`index:   ${idx}\nvalue:   ${a.map((x) => String(x).padStart(2)).join(' ')}\nnegative:${neg}`, 'a, with its indexes'),
      choice('In a[start:stop], is the item at index stop included?', 'No: the slice stops just before it', ['Yes', 'Only when stop is negative']),
      ...(e.startsWith('sorted') ? [step('First sorted(a): write the list in increasing order:', exact(`[${[...a].sort((x, y) => x - y).join(', ')}]`))] : []),
      ...(e === 'a[::-1][1:3]' ? [step('First a[::-1], the list reversed:', exact(`[${[...a].reverse().join(', ')}]`))] : []),
      step('Write the printed result:', exact(out)));
  },
  (r, d) => {
    const n = between(r, 5, tier(d, 8, 12, 20)), k = between(r, 2, 4);
    const xs = Array.from({ length: n }, (_, i) => i).filter((x) => x % k === 0);
    const v = d === 1 ? xs.length : d === 2 ? xs.reduce((s, x) => s + x, 0) : xs.reduce((s, x) => s + x * x, 0);
    const e = d === 1 ? `len([x for x in range(${n}) if x % ${k} == 0])` : d === 2 ? `sum(x for x in range(${n}) if x % ${k} == 0)` : `sum(x * x for x in range(${n}) if x % ${k} == 0)`;
    return walk(ask(`${code(`print(${e})`)}Output?`, num(v), `range(${n}) is 0..${n - 1}; multiples of ${k}: [${xs.join(', ')}] → ${v}.`, `range(n) stops at n - 1.`),
      'reading a comprehension', 'A comprehension [f(x) for x in range(n) if cond] is a loop in one line: take each x from the range, keep it only if the condition is true, and collect f(x). range(n) gives 0 up to n - 1. Work out what is collected, then apply the outer function (len, sum).',
      step(`range(${n}) gives 0 to ${n - 1}. Keep the x where x % ${k} == 0 (divisible by ${k}). Write the kept values, separated by commas:`, exact(xs.join(', '), xs.join(','))),
      d === 1 && count('len() counts the items:', `len([${xs.join(', ')}])`, v),
      d === 2 && count('sum() adds them:', xs.join(' + '), v),
      d === 3 && step(`x * x squares each one. Write the squares, separated by commas:`, exact(xs.map((x) => x * x).join(', '), xs.map((x) => x * x).join(','))),
      d === 3 && count('sum() adds the squares:', xs.map((x) => x * x).join(' + '), v));
  },
  (r, d) => {
    const words = Array.from({ length: tier(d, 5, 7, 9) }, () => pick(r, ['ERROR', 'WARN', 'INFO', 'FATAL']));
    const key = pick(r, words);
    const counts: Record<string, number> = {};
    words.forEach((w) => (counts[w] = (counts[w] ?? 0) + 1));
    const listText = JSON.stringify(words).replace(/"/g, "'").replace(/,/g, ', ');
    if (d < 3) return walk(ask(`${code(`counts = {}\nfor w in ${listText}:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts['${key}'])`)}Output?`, num(counts[key]), `'${key}' appears ${counts[key]} times. \`get(w, 0)\` returns 0 for keys not seen yet.`, 'Count how often the key appears.'),
      'counting with a dictionary', 'A dict maps keys to values. counts.get(w, 0) looks up w, giving 0 if it is missing; adding 1 and storing it back means each word\'s entry grows by one every time the loop meets that word. So at the end, counts[w] is how many times w appeared in the list.',
      count(`How many times does '${key}' appear in ${listText}?`, `counts['${key}']`, counts[key]));
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1] || words.indexOf(x[0]) - words.indexOf(y[0]))[0];
    const tally = Object.entries(counts).map(([w, c]) => `${w.padEnd(6)} ${c}`).join('\n');
    return walk(ask(`${code(`from collections import Counter\nc = Counter(${listText})\nprint(c.most_common(1)[0][1])`)}Output?`, num(top[1]), `most_common(1) is [(${JSON.stringify(top[0]).replace(/"/g, "'")}, ${top[1]})], and [0][1] is the count: ${top[1]}.`, 'The count of the most frequent item.'),
      'Counter and most_common', 'Counter(list) builds the tally dictionary for you. most_common(1) returns a list holding the single most frequent (item, count) pair. [0] takes that pair out of the list, and [1] takes the count out of the pair.',
      show(tally, 'the Counter'),
      step('most_common(1) is a list with one (item, count) pair. Which pair? Write it like [(\'NAME\', 3)]:', exact(`[('${top[0]}', ${top[1]})]`)),
      count('[0] takes the pair, then [1] takes the second part of it: the count.', 'most_common(1)[0][1]', top[1]));
  },
  (r, d) => {
    const x = between(r, 1, 255);
    const w = pick(r, [8, 12, 16]);
    const variants = [
      [1, `f"{${x}:x}"`, x.toString(16), ['What does the :x format spec mean?', 'Print in lowercase hexadecimal', ['Print in binary', 'Multiply by x']]],
      [1, `bin(${x})`, '0b' + x.toString(2), ['What does bin() return?', 'Text: 0b followed by the binary digits', ['Only the digits', 'A number']]],
      [2, `f"{${x}:0${w}b}"`, x.toString(2).padStart(w, '0'), [`In 0${w}b, what does the 0${w} do?`, `Pads with zeros on the left up to ${w} characters`, [`Adds ${w} zeros on the right`, `Keeps only ${w} bits`]]],
      [2, `hex(${x} << 4)`, '0x' + (x << 4).toString(16), ['What does << 4 do to a number?', 'Shifts left 4 bits: multiplies by 16', ['Divides by 16', 'Adds 4']]],
      [3, `f"{${x}:#06x}"`, '0x' + x.toString(16).padStart(4, '0'), ['In #06x, does the width of 6 count the 0x prefix?', 'Yes: 0x plus 4 digits makes 6', ['No: 6 digits after the prefix', 'Only for capital letters']]],
      [3, `int("${x.toString(16)}", 16) + int("101", 2)`, String(x + 5), ['What does int(text, base) do?', 'Reads the text as a number written in that base', ['Converts a number to text', 'Rounds down']]],
    ] as const;
    const [, e, v, [pq, pr, pw]] = pick(r, variants.filter((q) => q[0] === d));
    return walk(ask(`${code(`print(${e})`)}Output?`, exact(v, `'${v}'`), `${e} → ${v}. Format specs: x hex, b binary, 0Nb zero-pad to N, # adds the 0x prefix (counted in the width).`, 'Work it out in binary or hex first.'),
      'number formatting and base conversion', 'Python prints numbers in other bases through format specs and helper functions: :x is hex, :b is binary, a leading 0N pads with zeros to width N, # adds the 0x / 0b prefix, and bin() / hex() return text with that prefix. << n shifts left by n bits (times 2^n). int(text, base) goes the other way. Work in the base asked, digit by digit.',
      choice(pq, pr, pw),
      step(`${x} in decimal. Write the final output exactly as Python prints it:`, exact(v, `'${v}'`)));
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
    const q = ask(`${code(`print(${e})`)}Output?`, num(v), `${e} = ${v}. Python's // floors toward minus infinity (so -${a} // ${b} = ${pyDiv}, unlike C's ${Math.trunc(-a / b)}), and % takes the sign of the divisor. Python ints never overflow.`, 'Floor division rounds down, even for negatives.');
    if (e === `${a} // ${b}`) return walk(q, 'floor division', '// divides and throws away the remainder: it rounds DOWN to a whole number (toward minus infinity). 17 // 5 is 3, because 5 fits into 17 three whole times.',
      calc(`The exact quotient ${a} ÷ ${b}:`, `${a} / ${b}`, a / b, '', sig(a / b, 4), 0.005),
      count('Round down to a whole number:', `floor(${sig(a / b, 4)})`, v));
    if (e === `${a} % ${b}`) return walk(q, 'the remainder (modulo)', '% gives the remainder after dividing: what is left once you have removed as many whole copies of the divisor as fit. 17 % 5 is 2, because 3 × 5 = 15 and 17 - 15 = 2.',
      count(`How many whole times does ${b} fit into ${a}?`, `${a} // ${b}`, Math.floor(a / b)),
      count('The leftover after removing those copies:', `${a} - ${b} × ${Math.floor(a / b)}`, v));
    if (e === `-${a} // ${b}`) return walk(q, 'floor division of negatives', '// always rounds toward MINUS infinity, which for a negative quotient means away from zero: -3.2 becomes -4, not -3. (C and Java truncate toward zero instead, so they say -3.)',
      calc('The exact quotient:', `-${a} / ${b}`, -a / b, '', sig(-a / b, 4), 0.005),
      choice('Floor division rounds toward:', 'Minus infinity (down)', ['Zero', 'The nearest whole number']),
      count('So it becomes:', `floor(${sig(-a / b, 4)})`, v));
    if (e === `2 ** ${b + 4}`) return walk(q, 'powers with **', '** is exponentiation: 2 ** n is 2 multiplied by itself n times. Each step doubles: 2, 4, 8, 16, 32, 64, 128... (Python integers never overflow, however large.)',
      count(`Multiply 2 by itself ${b + 4} times. Result:`, `2 ** ${b + 4}`, v));
    if (e === `-${a} % ${b}`) return walk(q, 'modulo of negatives', 'In Python, a % b always lands between 0 and b (it takes the sign of the divisor b). It is defined so that a == (a // b) * b + (a % b), with // rounding down. So first floor-divide, then the leftover is what remains.',
      choice('With a positive divisor, the result of % in Python is:', 'Zero or positive: it takes the divisor\'s sign', ['Negative, like the dividend', 'Always zero']),
      count('First the floor division:', `-${a} // ${b}`, pyDiv),
      count('The remainder is a minus (quotient × divisor):', `-${a} - (${pyDiv} × ${b})`, v));
    return walk(q, 'shifts', '<< n shifts the bits left by n places, which multiplies by 2^n; >> n shifts right, dividing by 2^n (rounding down). Shifting a 1 left by n just gives 2^n, and shifting it back right by m leaves 2^(n - m).',
      count(`1 << ${b + 30} is 2 to the power of ${b + 30}. Its value:`, `2 ** ${b + 30}`, 2 ** (b + 30)),
      count(`Then >> ${b + 20} divides by 2^${b + 20}:`, `2 ** ${b + 30} / 2 ** ${b + 20}`, v));
  },
  (r, d) => {
    if (d < 3) {
      const n = between(r, 2, 5);
      return walk(ask(`${code(`a = [${Array.from({ length: n }, (_, i) => i).join(', ')}]\nb = a\nb.append(99)\nprint(len(a))`)}Output?`, num(n + 1), `b = a does not copy: both names refer to the same list, so a has ${n + 1} items. Use a.copy() or list(a) for a real copy.`, 'Assignment binds a new name to the same object.'),
        'names and aliases', 'In Python, a variable is a name stuck on an object, not a box holding a copy. b = a puts a SECOND name on the same list: there is still only one list. So changing it through b changes what a sees, too. To get an independent copy, use a.copy() or list(a).',
        choice('After b = a, how many lists exist?', 'One, with two names on it', ['Two, an independent copy', 'None until append']),
        count(`a started with ${n} items; b.append(99) adds one to the shared list. Items a sees:`, `${n} + 1`, n + 1));
    }
    const n = between(r, 2, 8);
    return walk(ask(`${code(`def add(x, acc=[]):\n    acc.append(x)\n    return acc\n\nfor i in range(${n}):\n    out = add(i)\nprint(len(out))`)}Output?`, num(n), `The default list is created once, when the function is defined, and shared by every call: it collects all ${n} items. Use acc=None and create the list inside. A classic interview bug.`, 'When is the default [] created?'),
      'mutable default arguments', 'A default value like acc=[] is created ONCE, when the def line runs, not each time the function is called. If you call add without passing acc, every call gets that same list and keeps appending to it. That is why the list grows across calls. The fix is acc=None and creating a new list inside.',
      choice('When is the default [] created?', 'Once, when the def statement runs', ['On every call', 'Only on the first call that needs it']),
      count(`The loop calls add ${n} times, each appending one item to the same list. Final length:`, `${n} calls × 1 item`, n));
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

/** Output-prediction scripts for the TCL drills: [difficulty, source, what it prints, a reasoning step]. The Code Lab interpreter tests run these too. */
export interface TclScript { d: 1 | 2 | 3; src: string; out: string; method: string; idea: string; step: readonly [string, string, readonly string[]] }
export const tclScripts = (a: number, b: number): TclScript[] => {
  const sub = 'TCL reads each word once: $x gives the variable\'s value, [cmd] runs the command and gives its result, "..." allows both, {...} allows neither. Work through the script one line at a time, writing down each variable as it changes.';
  return [
    { d: 1, src: `set a ${a}\nset b ${b}\nputs [expr {$a + $b}]`, out: String(a + b), method: 'command substitution', idea: sub, step: ['What does [expr {$a + $b}] turn into?', 'The sum of the two values', ['The text "$a + $b"', 'An error, since a is not a number']] },
    { d: 1, src: `set x ${a}\nset y $x\nset x ${b}\nputs $y`, out: String(a), method: 'variables hold values', idea: sub, step: ['After set y $x, changing x changes y?', 'No: y took a copy of the value at that moment', ['Yes, y follows x', 'Yes, but only inside braces']] },
    { d: 2, src: `set l {u0 u1 u2}\nlappend l u${a}\nputs "[llength $l] [lindex $l end]"`, out: `4 u${a}`, method: 'lists', idea: `${sub} A list is words separated by spaces. lappend adds one at the end, llength counts them, and lindex picks one by position (end means the last).`, step: ['What does lindex $l end give?', 'The last element', ['The first element', 'The number of elements']] },
    { d: 2, src: `set s 0\nforeach v {${a} ${b} ${a}} {\n  incr s $v\n}\nputs $s`, out: String(2 * a + b), method: 'foreach and incr', idea: `${sub} foreach runs its body once per list element, with the variable set to that element. incr s $v adds v to s.`, step: ['How many times does the body run?', 'Three: once for each list element', ['Once', `${a} times`]] },
    { d: 2, src: `proc scale {x k} {\n  return [expr {$x * $k}]\n}\nputs [scale ${a} ${b}]`, out: String(a * b), method: 'procedures', idea: `${sub} proc name {arguments} {body} defines a new command. Calling it runs the body with the arguments bound, and return hands back the result, which the surrounding brackets substitute.`, step: [`What does the call scale ${a} ${b} pass to x and k?`, `x = ${a}, k = ${b}`, [`x = ${b}, k = ${a}`, 'Both get the first value']] },
    { d: 2, src: `dict set d clk ${a}\ndict set d rst ${b}\nputs [dict get $d rst]-[dict size $d]`, out: `${b}-2`, method: 'dictionaries', idea: `${sub} A dict maps keys to values. dict set adds or replaces a pair, dict get reads one, dict size counts the pairs.`, step: ['How many pairs does d hold?', 'Two: clk and rst', ['One', 'None until it is printed']] },
    { d: 2, src: `regexp {u_(\\w+)/(\\d+)} "u_alu/${b}" m name idx\nputs "$name:$idx"`, out: `alu:${b}`, method: 'regexp with capture variables', idea: `${sub} regexp pattern string whole group1 group2 matches and stores the whole match, then each parenthesised group, in the variables you name.`, step: ['Which variable receives the first group in parentheses?', 'name (the one after m)', ['m', 'idx']] },
    { d: 3, src: `set clk_period ${a}\nset which clk\nputs [expr {[set \${which}_period] * ${b}}]`, out: String(a * b), method: 'nested substitution', idea: `${sub} Substitution works inside out: \${which}_period becomes clk_period first, then set with one argument reads that variable, then expr multiplies.`, step: ['What does \${which}_period become?', 'clk_period', ['clk', 'which_period']] },
    { d: 3, src: `proc check {x} {\n  if {$x > ${b}} {error "too big: $x"}\n  return ok\n}\nset rc [catch {check ${a}} msg]\nputs "$rc $msg"`, out: a > b ? `1 too big: ${a}` : `0 ok`, method: 'catch and error', idea: `${sub} catch runs a script and returns 0 if it finished normally or 1 if it raised an error. The result, or the error message, is stored in the variable you name. Without catch, an error stops the whole script.`, step: [`Is ${a} greater than ${b}?`, a > b ? 'Yes, so error is called' : 'No, so check returns ok', [a > b ? 'No, so check returns ok' : 'Yes, so error is called']] },
    { d: 3, src: `set x ${a}\nset y {$x}\nputs [expr $y + ${b}]`, out: String(a + b), method: 'substitution happens twice here', idea: `${sub} Braces keep $x as text, so y holds the two characters $x. But expr gets that text, joins its arguments and evaluates the string, and expr itself substitutes variables again.`, step: ['What does y hold after set y {$x}?', 'The text $x, not yet substituted', [`The number ${a}`, 'Nothing']] },
    { d: 3, src: `puts "[catch {expr {${a} * ${b}}} res] $res"`, out: `0 ${a * b}`, method: 'catch inside a quoted string', idea: `${sub} Inside double quotes the substitutions happen left to right. [catch ...] runs first and stores the result in res, so by the time $res is read it holds the product. catch itself returns 0 for success.`, step: ['What does catch return when the script succeeds?', '0', ['1', 'The value of the expression']] },
    { d: 3, src: `puts [lindex [lsort -integer {${a} ${b} ${a + b}}] 1]`, out: String(Math.max(a, b)), method: 'nested commands', idea: `${sub} Brackets nest: the innermost runs first. Here lsort -integer sorts the three numbers ascending, and lindex ... 1 takes the middle one (positions start at 0).`, step: ['What is the position of the middle element?', '1, since positions start at 0', ['2', '0']] },
  ];
};

export const flowsPractice = practice('practice-flows', 'Flow Drills', 'Make dependencies, TCL, SDC basics, farm arithmetic', [
  (r) => {
    const touched = pick(r, [...new Set(MAKE_RULES.flatMap(([, deps]) => [...deps]))]);
    const rb = rebuilt(touched);
    const out = new Set<string>();
    const checks = MAKE_RULES.map(([t, deps]) => {
      const why = deps.filter((x) => x === touched || out.has(x));
      const yes = why.length > 0;
      if (yes) out.add(t);
      return choice(`Rule \`${t}: ${deps.join(' ')}\`. Does ${t} have to rebuild?`, yes ? `Yes: ${why[0]} is new or was rebuilt` : 'No: nothing it depends on changed', [yes ? 'No: nothing it depends on changed' : `Yes: ${deps[0]} is new or was rebuilt`]);
    });
    return walk(ask(`${code(MAKE_RULES.map(([t, ds]) => `${t}: ${ds.join(' ')}`).join('\n'))}Everything is up to date. You edit \`${touched}\` and run \`make timing.rpt power.rpt\`. How many targets rebuild?`, num(rb.length), `Targets downstream of ${touched}: ${rb.join(', ')}. Make compares timestamps and rebuilds only what depends on the change.`, 'Follow the arrows downstream from the file you touched.'),
      'following make dependencies downstream', `Each rule says "target: the files it is built from". When a file changes, make rebuilds every target that depends on it, and then everything that depends on THOSE, because their inputs just changed too. Walk the rules top to bottom: a target rebuilds if any of its inputs is ${touched} or was itself rebuilt.`,
      ...checks,
      count('Count the targets that rebuilt:', 'number of Yes answers', rb.length));
  },
  (r, d) => {
    const x = between(r, 2, 9), y = between(r, 2, 9);
    const variants = [
      [1, `set x ${x}\nset y [expr {$x * ${y}}]\nputs $y`, String(x * y), ['What does [expr {...}] do?', 'Runs the arithmetic and gives back the value', ['Prints it without calculating', 'Treats it as plain text']]],
      [1, `set a ${x}\nputs "a=$a"`, `a=${x}`, ['Inside double quotes, is $a replaced by its value?', 'Yes, quotes still allow substitution', ['No, it prints $a']]],
      [2, `puts [llength {clk rst_n data valid}]`, '4', ['What does llength count?', 'The items in the list', ['The characters in the text']]],
      [2, `puts [lindex {u0 u1 u2 u3 u4} ${Math.min(x, 4)}]`, `u${Math.min(x, 4)}`, ['TCL list positions start at:', '0: the first item is index 0', ['1: the first item is index 1']]],
      [3, `set s 0\nforeach v {${x} ${y} ${x + y}} {\n  incr s $v\n}\nputs $s`, String(2 * (x + y)), ['What does incr s $v do?', 'Adds v to s', ['Sets s to v']]],
      [3, `set n ${x}\nputs {n is $n}`, 'n is $n', ['Do curly braces allow substitution?', 'No: everything inside is taken literally', ['Yes, like double quotes']]],
    ] as const;
    const [, src, out, [pq, pr, pw]] = pick(r, variants.filter((q) => q[0] === d));
    return walk(ask(`${code(src)}What does this TCL print?`, exact(out), `Output: ${out}. TCL rules: $ substitutes, [ ] runs a command, " " allows substitution, { } does not.${d === 3 && out.includes('$') ? ' Braces suppress substitution, so $n is printed literally.' : ''}`, 'Apply substitution rules word by word.'),
      'TCL substitution rules', 'TCL treats everything as text and only substitutes when the syntax says so. $name is replaced by the variable\'s value. [command] runs the command and is replaced by its result. Double quotes "..." still allow both; curly braces {...} allow neither, so their contents stay exactly as typed. Go through the script a line at a time, tracking the variables.',
      choice(pq, pr, pw),
      step('What does the script print?', exact(out)));
  },
  (r, d) => {
    const a = between(r, 2, 9), b = 2 + ((a - 2) + between(r, 1, 7)) % 8; // b differs from a, so swapped-argument distractors stay distinct
    // check() compares against b: draw a from a wider range so both outcomes (ok / too big) occur
    const s = pick(r, tclScripts(d === 3 ? between(r, 2, 12) : a, d === 3 ? between(r, 4, 9) : b).filter((t) => t.d === d));
    return walk(ask(`${code(s.src)}What does this TCL print?`, exact(s.out), `It prints ${s.out}. The key idea: ${s.method}.`, 'Substitute word by word, inside out.'),
      s.method, s.idea, choice(...s.step), step('What does the script print?', exact(s.out)));
  },
  (r, d) => {
    const p = pick(r, [0.5, 0.8, 1, 1.25, 2, 4]);
    const idea = 'In SDC, create_clock -period P declares a clock whose cycle lasts P nanoseconds. Everything between flops must fit inside that cycle, and the constraints say how much of it is already used up elsewhere: input delay is time consumed outside the chip before the signal arrives, uncertainty is margin for clock jitter and skew, and setup is the flop\'s own requirement. The logic gets what is left.';
    if (d === 1) return walk(ask(`\`create_clock -period ${p} [get_ports clk]\` (ns). What frequency, in MHz?`, qty(1000 / p, 'MHz', 0.01), `1/${p} ns = ${sig(1000 / p)} MHz.`, 'f = 1 / period.'),
      'period to frequency', 'Frequency is how many cycles fit in a second, so it is 1 divided by the period. With the period in nanoseconds, 1 / P gives gigahertz; multiply by 1000 for megahertz.',
      calc('Frequency in MHz = 1000 / period (ns):', `1000 / ${p}`, 1000 / p, 'MHz', sig(1000 / p, 4), 0.01));
    const ind = +(p * pick(r, [0.2, 0.3, 0.4])).toFixed(3);
    if (d === 2) return walk(ask(`Clock period ${p} ns, \`set_input_delay ${ind} -clock clk [get_ports din]\`. How much of the cycle is left for logic from din to the first flop, ignoring setup, in ns?`, qty(p - ind, 'ns', 0.01), `The input delay models logic outside the chip: ${p} - ${ind} = ${sig(p - ind)} ns remains inside.`, 'Period minus the external delay.'),
      'the input delay budget', idea,
      calc('What is left inside the chip: period minus input delay:', `${p} - ${ind}`, p - ind, 'ns', sig(p - ind, 4), 0.01));
    const unc = pick(r, [0.05, 0.1]), setup = pick(r, [0.03, 0.05]), outd = +(p * 0.25).toFixed(3);
    const left = p - ind - unc - setup;
    return walk(ask(`Period ${p} ns, input delay ${ind} ns, clock uncertainty ${unc} ns, flop setup ${setup} ns (output delay ${outd} ns applies to other paths). Budget for the din → flop logic, in ns?`, qty(left, 'ns', 0.01), `${p} - ${ind} - ${unc} - ${setup} = ${sig(left)} ns. The output delay is irrelevant here: it constrains flop → output paths.`, 'Subtract everything that eats this path\'s cycle.'),
      'the full timing budget', idea,
      choice('Does the output delay come off the din → flop path?', 'No: it only constrains flop → output paths', ['Yes, subtract it too', 'Only if it is larger than the input delay']),
      calc('Start with the period and subtract the input delay:', `${p} - ${ind}`, p - ind, 'ns', sig(p - ind, 4), 0.01),
      calc('Also subtract the uncertainty and the flop\'s setup:', `${sig(p - ind, 4)} - ${unc} - ${setup}`, left, 'ns', sig(left, 4), 0.01));
  },
  (r, d) => {
    const period = pick(r, [1.25, 2, 0.8]), port = pick(r, ['clk', 'core_clk', 'ref_clk']);
    if (d === 3) {
      const a = has(`create_clock -name ${port} -period ${period} [get_ports ${port}]; set_clock_uncertainty -setup 0.1 [get_clocks ${port}]`, ['create_clock'], [`-period ${period}`], ['get_ports'], ['set_clock_uncertainty'], ['0.1'], ['get_clocks']);
      return walk(ask(`Write the SDC to declare a clock named ${port} with a ${period} ns period on port ${port}, and then 0.1 ns of setup uncertainty on it (two commands; separate with ;).`, a, `\`create_clock -name ${port} -period ${period} [get_ports ${port}]\` then \`set_clock_uncertainty -setup 0.1 [get_clocks ${port}]\`. Clocks are referenced with get_clocks, ports with get_ports.`, 'create_clock, then set_clock_uncertainty.'),
        'declaring a clock and its uncertainty', 'SDC constraints are TCL commands. create_clock defines the clock on a port: -name gives it a name, -period gives its cycle in ns, and the port is fetched with [get_ports name]. Once the clock exists, other commands refer to it by name with [get_clocks name], for example set_clock_uncertainty -setup N to add margin.',
        choice('A clock is fetched by name with:', '[get_clocks name]', ['[get_ports name]', '[get_pins name]'], 'get_ports finds a physical port; get_clocks finds a declared clock.'),
        choice('Which command adds jitter and skew margin on a clock?', 'set_clock_uncertainty', ['set_input_delay', 'set_clock_margin']),
        step('Now write both commands, separated by ;', a));
    }
    const a = has(`create_clock -period ${period} [get_ports ${port}]`, ['create_clock'], [`-period ${period}`], ['get_ports'], [port]);
    return walk(ask(`Write the SDC command that creates a ${period} ns clock on port ${port}.`, a, `\`create_clock -period ${period} [get_ports ${port}]\`. Every timing run starts here.`, 'create_clock -period <ns> [get_ports <name>].'),
      'declaring a clock', 'Timing analysis needs to know which signals are clocks and how fast they run. create_clock does that: -period gives the cycle in nanoseconds, and the port the clock comes in on is fetched with [get_ports name]. The shape is: create_clock -period <ns> [get_ports <name>].',
      choice('Which command defines a clock?', 'create_clock', ['set_clock', 'define_clock']),
      choice('Which option gives the cycle time?', '-period', ['-freq', '-width']),
      step('Now write the whole command:', a));
  },
  (r) => concept(r, [
    ['In a Makefile recipe, what is `$@`?', 'The target being built', ['The first prerequisite', 'All prerequisites', 'The make command itself'], 'automatic variables', 'A rule looks like: target: prerequisites, followed by recipe lines. Inside a recipe, make fills in shortcuts: $@ is the target, $< the first prerequisite, $^ all the prerequisites. They save you from repeating file names.', ['In `synth.v: rtl.sv`, which part is the target?', 'synth.v, the file on the left of the colon', ['rtl.sv', 'The recipe']], 'The target being built. A rule looks like: target: prerequisites, followed by recipe lines. Inside a recipe, make fills in shortcuts: $@ is the target, $< the first prerequisite, $^ all the prerequisites. They save you from repeating file names'],
    ['In a Makefile recipe, what is `$<`?', 'The first prerequisite', ['The target being built', 'All prerequisites', 'The previous target'], 'automatic variables', 'A rule looks like: target: prerequisites, followed by recipe lines. Inside a recipe, make fills in shortcuts: $@ is the target, $< the first prerequisite, $^ all the prerequisites. They save you from repeating file names.', ['In `synth.v: rtl.sv constraints.sdc`, the first prerequisite is:', 'rtl.sv', ['constraints.sdc', 'synth.v']], 'The first prerequisite. A rule looks like: target: prerequisites, followed by recipe lines. Inside a recipe, make fills in shortcuts: $@ is the target, $< the first prerequisite, $^ all the prerequisites. They save you from repeating file names'],
    ['Why mark `clean` as `.PHONY`?', 'So make runs it even if a file named "clean" exists', ['So it runs in parallel with all the other targets in the makefile', 'So it never runs, unless someone asks for it by its full path', 'So it deletes every file that has .PHONY in its name, too'], 'phony targets', 'Make assumes every target is a file, and skips a rule if that file is already up to date. A target like clean is a command, not a file. If someone creates a file named clean, make would say "nothing to do". Listing it under .PHONY tells make to always run it.', ['If a file named clean exists and clean is not .PHONY, make thinks:', 'The target is up to date and skips the recipe', ['It must delete the file', 'It should run twice']]],
    ['Make says "missing separator". Most likely cause?', 'A recipe line indented with spaces, not a tab', ['A missing semicolon at the end of the recipe line before it', 'Too many targets on a single line', 'A circular dependency between two of the targets in the makefile'], 'Makefile syntax', 'Make\'s syntax is strict: every recipe line must begin with a literal TAB character. If an editor converted it to spaces, make does not recognise the line as a recipe and complains about a "missing separator".', ['Recipe lines must be indented with:', 'A tab character', ['Four spaces', 'A semicolon']], 'A recipe line indented with spaces instead of a tab'],
    ['What does `make -j 16` do?', 'Runs up to 16 independent recipes in parallel', ['Runs the whole of make 16 times', 'Skips the first 16 targets', 'Sets the clock of the build machine to 16 MHz for the run'], 'parallel builds', 'By default make runs one recipe at a time. -j N lets it run up to N at once, but only those that do not depend on each other. That only works safely if the dependencies are declared correctly, since make uses them to decide what may overlap.', ['Two targets do not depend on each other. With -j 16 make may:', 'Build them at the same time', ['Build them only one by one', 'Skip one of them']]],
      ['What is a pattern rule such as `%.o: %.c` for?', 'One recipe that builds every object file from its matching source', ['A rule that matches only a file called %.o', 'A rule that deletes every file with that suffix', 'A rule that is only run when the %.c is missing'],
        'pattern rules', 'The % matches the same stem on both sides, so one rule covers every .c file. Inside the recipe `$<` is the source and `$@` the target.',
        ['In `%.o: %.c`, the % stands for the:', 'Matching file stem', ['Percentage', 'Directory only']]],
  ], (why) => `${why}.`),
  (r, d) => {
    const tests = pick(r, [2000, 5000, 10000]), mins = pick(r, [3, 6, 10]), cores = pick(r, [100, 200, 500]);
    const hours = (tests * mins) / cores / 60;
    if (d < 3) return walk(ask(`A nightly regression has ${tests} tests averaging ${mins} min each, on ${cores} farm cores. Wall-clock time, in hours (perfect packing)?`, qty(hours, '', 0.02, sig(hours)), `${tests} × ${mins} min / ${cores} cores = ${sig(hours * 60)} min = ${sig(hours)} h.`, 'Total CPU time divided by cores.'),
      'farm arithmetic', 'Total work is tests × minutes each. Spread evenly over the cores, every core does a share: total ÷ cores is the wall-clock time (with perfect packing). Finally convert minutes to hours by dividing by 60.',
      calc('Total work in minutes:', `${tests} × ${mins}`, tests * mins, '', String(tests * mins), 0.001),
      calc('Divide over the cores, in minutes:', `${tests * mins} / ${cores}`, (tests * mins) / cores, '', sig((tests * mins) / cores, 4), 0.005),
      calc('Convert to hours:', `${sig((tests * mins) / cores, 4)} / 60`, hours, '', sig(hours), 0.02));
    const fail = pick(r, [0.01, 0.02, 0.05]);
    const fails = tests * fail;
    return walk(ask(`${tests} tests run nightly and ${fail * 100}% fail. Each failure takes an engineer 15 min to triage by hand. How many engineer-hours per night?`, qty((tests * fail * 15) / 60, '', 0.02, sig((tests * fail * 15) / 60)), `${tests * fail} failures × 15 min = ${sig((tests * fail * 15) / 60)} h. That is why teams bucket failures automatically by error signature before any human looks.`, 'Failures × minutes each.'),
      'triage cost', 'Engineer time is the number of failures times the minutes each one takes. The failure count is the percentage of the tests; then convert the total minutes to hours by dividing by 60.',
      calc('The number of failures, tests × failure rate:', `${tests} × ${fail}`, fails, '', sig(fails), 0.005),
      calc('Minutes of triage at 15 minutes each:', `${sig(fails)} × 15`, fails * 15, '', sig(fails * 15), 0.005),
      calc('Convert to hours:', `${sig(fails * 15)} / 60`, (fails * 15) / 60, '', sig((fails * 15) / 60), 0.02));
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
    mc('Two signatures account for 90% of failures. What do you do first?', ['Rerun one failing seed of each with waves on, to reproduce it', 'Rerun the whole regression with a new set of random seeds', 'Mark both as known failures, and move on to the long tail', 'Email everyone the raw logs, and ask who has seen them before'], 0, 'Deterministic reproduction from the seed is how DV debug starts: bucket, reproduce, then find the root cause. Deterministic reproduction from the seed is how DV debug starts. Bucket, reproduce, root-cause.'),
    { t: 'gen', make: (r) => { const seed = between(r, 10000, 99999); return ask(`Write the command to rerun test fifo_test with seed ${seed} using the script ./run_test (it takes --test and --seed), saving all output to rerun.log.`, has(`./run_test --test fifo_test --seed ${seed} > rerun.log 2>&1`, ['./run_test'], ['--test fifo_test', '--test=fifo_test'], [`--seed ${seed}`, `--seed=${seed}`], ['rerun.log']), `\`./run_test --test fifo_test --seed ${seed} > rerun.log 2>&1\`.`); } },
    mc('The rerun passes. The regression run with the same seed failed. What is the most likely explanation?', ['The test is not reproducible from its seed', 'The seed was recorded wrongly in the regression log file', 'The Linux farm machine is flaky, so the run just glitched', 'The first run was hit by a cosmic ray during the simulation'], 0, 'Some randomness or timing is not seeded: a DV bug in itself. Every source of randomness must derive from the seed, or failures cannot be reproduced. Check for unseeded $urandom, wall-clock time, or ordering of parallel processes.'),
    { t: 'gen', make: () => ask('Write a command that lists the 5 largest files in the current directory tree (to find the waveform dump filling the disk).', has('find . -type f -exec du -h {} + | sort -rh | head -5', ['find'], ['du'], ['sort'], ['-h', '-rh', '-hr', '-n', '-rn', '-nr'], ['head'], ['5']), '`find . -type f -exec du -h {} + | sort -rh | head -5`. (`du -ah . | sort -rh | head -5` also lists directories and the top-level `.`, so it shows files or directories, not just files.) Full disks kill regressions at 3 AM all the time.') },
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
    mc('The revert conflicts with a later commit. What do you do?', ['Resolve the conflict markers by hand, `git add` the files, then `git revert --continue`', 'Force-push the old main branch over the top, to undo the changes', 'Delete the repository and re-clone it, to start from a clean copy', 'Run git bisect again, to find a commit that does not conflict'], 0, 'Conflicts in revert are resolved like merge conflicts.'),
    mc('Meanwhile a colleague ran `git reset --hard HEAD~3` on their local branch and lost 3 commits they had not pushed. Can they get them back?', ['Yes: `git reflog` shows where HEAD was; reset to HEAD@{1}', 'No: reset --hard destroys the commits as soon as it runs', 'Only if the three commits had already been pushed to the remote', 'Only with root access to the machine that holds the repository'], 0, 'Or branch from that hash. Commits stay in the object store for weeks; the reflog remembers every HEAD position.'),
    { t: 'gen', make: (r) => { const f = between(r, 2, 6), m = between(r, 20, 40); return ask(`Your feature branch has ${f} commits; main moved ${m} commits since you branched (including the revert). You rebase your private feature branch onto main. How many commits does \`git log main..feature\` show?`, num(f), `Still ${f}: rebase replays your commits on top of the new main. It is fine here because feature is private.`); } },
    mc('What process change prevents this next time?', ['Require a smoke regression in CI before any pull request merges', 'Ban git bisect, since it tempts people to merge unchecked changes', 'Let only one person commit, so that nothing can ever conflict', 'Commit less often, with larger batches that are reviewed more carefully'], 0, 'Pre-merge CI gates catch breakage per change instead of per week.'),
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
    mc('Some lines contain two signatures, like `[E-0001] after [E-0002]`. What does the script count for such a line?', ['Only the first, because search() stops at the first match', 'Both of them, since search() collects every match on the line', 'Neither of them', 'It crashes with an error'], 0, 'Use sig.findall(line) (or finditer) to catch every match on a line.'),
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
    mc('Yet every run rebuilds synth.v too. The rtl.sv timestamp keeps changing. Likely cause?', ['A script regenerates rtl.sv on every run, touching it unchanged', 'Make is broken, and no longer compares the file timestamps', 'The disk is full, so the old synth.v cannot be kept around', 'synth.v is marked .PHONY, so it is always considered out of date'], 0, 'Generators should write to a temp file and only replace the target if the content changed.'),
    { t: 'gen', make: (r) => { const p = pick(r, [1, 1.25]); return mcs(r, `The SDC says \`create_clock -period ${p * 1000} [get_ports clk]\` and the report shows a ${p * 1000} ns clock. The designer meant ${p} ns. Which line is correct?`, `create_clock -period ${p} [get_ports clk]`, [`create_clock -period ${p * 1000}ps [get_ports clk]`, `create_clock -freq ${p} [get_ports clk]`, `set_clock_period ${p * 1000} clk`], `SDC time is in the library's unit, almost always ns. ${p * 1000} was meant as picoseconds. Write -period ${p}.`); } },
    { t: 'gen', make: (r) => { const x = between(r, 2, 5); return ask(`${code(`set pins [get_pins u_core/*/D]\nputs [llength {a b c}]\nset n ${x}\nputs "slack_$n"`)}What does the last line print?`, exact(`slack_${x}`), `Double quotes allow $ substitution: slack_${x}.`); } },
    { t: 'gen', make: () => ask('Clock period 1 ns, input delay 0.4 ns, uncertainty 0.1 ns, setup 0.05 ns. Budget for input-to-flop logic, in ns?', qty(0.45, 'ns', 0.01), '1 - 0.4 - 0.1 - 0.05 = 0.45 ns.') },
    mc('The input delay was set to 0.9 ns "to be safe". What happens?', ['Input paths get ~0 ns of budget, so synthesis over-sizes gates', 'Nothing, since extra margin on the inputs is free in synthesis', 'The clock gets faster, since the input paths have less slack', 'Hold time improves for free, because the inputs arrive later'], 0, 'It also reports violations that are not real. Over-constraining wastes area and power and hides real problems. Over-constraining wastes area and power and hides real problems. Constraints must model reality.'),
  ],
  recap: ['Make rebuilds by timestamp; generators must not touch unchanged files.', 'SDC units matter.', 'TCL substitution rules.', 'Constraints should model reality, not "safety".'],
});

export const TOOLING_BOSSES = [shellBoss, gitBoss, pythonBoss, flowsBoss];


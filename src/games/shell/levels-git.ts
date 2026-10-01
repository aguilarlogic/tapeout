// Shell Lab missions for git: first commits, branches, undoing mistakes, conflicts, stash and bisect.
// The history is built by setup commands, so every mission starts from a realistic repository.
import { between, pick, type Rng } from '../../lessons/types';
import { gitApi } from './git';
import type { Shell } from './sh';
import type { ShellEntry, ShellLevel } from './types';

const read = (sh: Shell, path: string): string | null => { try { return sh.fs.readFile(sh.abs(path)); } catch { return null; } };
const repo = (sh: Shell) => gitApi.findRepo({ sh, fs: sh.fs, in: undefined as never, out: () => undefined, err: () => undefined });
const ran = (h: ShellEntry[], re: RegExp) => h.some((e) => re.test(e.cmd));
const IDENT = 'git config user.name Dev; git config user.email dev@fab';

// ---- 1. first commit
const first: ShellLevel = {
  id: 'git-first', title: 'Put it under version control', concept: 'init, add, commit, .gitignore', xp: 70, tier: 'guided',
  ticket: 'Day one on the team: the block directory is not in git yet, and the simulator log must not be.',
  build: () => ({
    brief: `<p>In <code>~/block</code> create a repository and make one commit containing the sources and README, but <b>not</b> the <code>*.log</code> files.</p>
<ul><li><code>git init</code></li><li>Write a <code>.gitignore</code> that ignores logs (it is committed too).</li><li><code>git add</code> then <code>git commit -m "..."</code>. <code>git status</code> should end up clean.</li></ul>`,
    hints: ['<code>echo "*.log" &gt; .gitignore</code> is a whole .gitignore.', '<code>git status</code> shows what is tracked, staged and untracked. Check it before committing.', 'Ignore rules are not wired into my status in this lab, so simply do not <code>git add</code> the log: add files by name or use <code>git add alu.v README.md .gitignore</code>.'],
    files: { 'block/alu.v': 'module alu; endmodule\n', 'block/README.md': '# block\n', 'block/sim.log': 'noise\n' },
    cwd: 'block',
    solution: ['git init', IDENT, 'echo "*.log" > .gitignore', 'git add alu.v README.md .gitignore', 'git commit -m "Initial import"', 'git status'],
    goals: [
      { label: 'a repository exists with a commit', ok: (sh) => !!repo(sh) && !!gitApi.headId(repo(sh)!) },
      { label: 'the sources, README and .gitignore are tracked', ok: (sh) => { const t = repo(sh) ? gitApi.headTree(repo(sh)!) : {}; return 'alu.v' in t && 'README.md' in t && '.gitignore' in t; } },
      { label: 'the log file was not committed', ok: (sh) => { const t = repo(sh) ? gitApi.headTree(repo(sh)!) : {}; return !('sim.log' in t); } },
      { label: '.gitignore ignores *.log', ok: (sh) => /\*\.log/.test(read(sh, '.gitignore') ?? '') },
    ],
  }),
};

// ---- 2. branch and merge
const branch: ShellLevel = {
  id: 'git-branch', title: 'Work on a branch', concept: 'branch, checkout -b, merge, branch -d', xp: 80, tier: 'guided',
  ticket: 'You are adding UART parity. Do it on a feature branch so main stays releasable.',
  build: () => ({
    brief: `<p>The repo in <code>~/chip</code> has one commit on <code>main</code>.</p>
<ul><li>Create and switch to <code>feature/parity</code>.</li><li>Append a line <code>parity: even</code> to <code>uart.cfg</code> and commit.</li><li>Switch back to <code>main</code>, merge the feature, then delete the merged branch.</li></ul>`,
    hints: ['<code>git checkout -b feature/parity</code> creates and switches in one step.', '<code>git commit -am "msg"</code> stages tracked changes and commits.', '<code>git merge feature/parity</code> from main, then <code>git branch -d feature/parity</code>.'],
    files: { 'chip/uart.cfg': 'baud: 115200\n' },
    cwd: 'chip',
    setup: ['git init', IDENT, 'git add uart.cfg', 'git commit -m "uart baseline"'],
    solution: ['git checkout -b feature/parity', 'echo "parity: even" >> uart.cfg', 'git commit -am "Add parity option"', 'git checkout main', 'git merge feature/parity', 'git branch -d feature/parity'],
    goals: [
      { label: 'you are on main', ok: (sh) => (repo(sh)?.head as { branch?: string } | undefined)?.branch === 'main' },
      { label: 'main contains the parity line', ok: (sh) => /parity: even/.test(read(sh, 'uart.cfg') ?? '') && /parity: even/.test(gitApi.headTree(repo(sh)!)['uart.cfg'] ?? '') },
      { label: 'the feature branch is deleted', ok: (sh) => !repo(sh)!.branches.has('feature/parity') },
      { label: 'the feature work was committed on the branch first (two commits since baseline)', ok: (sh) => gitApi.logLines(repo(sh)!, gitApi.headId(repo(sh)!)!).length >= 2 },
    ],
  }),
};

// ---- 3. undo
const undo: ShellLevel = {
  id: 'git-undo', title: 'Undo three mistakes', concept: 'restore, restore --staged, revert', xp: 100, tier: 'guided',
  ticket: 'A rough afternoon: a debug file got staged, config.yml has a bad edit, and a commit leaked the password.',
  build: () => ({
    brief: `<p>The repo in <code>~/svc</code> has three problems. Fix each the right way:</p>
<ul><li><code>debug.txt</code> is <b>staged</b> but must not be committed. Unstage it (keep the file).</li><li><code>config.yml</code> has an uncommitted bad edit. Throw the edit away.</li><li>The last commit added <code>secrets.env</code> by mistake. Undo it <b>safely, without rewriting history</b> (the commit is already pushed): <code>git revert</code>.</li></ul>`,
    hints: ['<code>git status</code> tells you which command to use for each.', '<code>git restore --staged debug.txt</code> unstages; <code>git restore config.yml</code> discards the working change.', '<code>git revert HEAD</code> (the message editor is skipped here) makes a new commit that undoes the last one.'],
    files: { 'svc/app.py': 'print("v1")\n', 'svc/config.yml': 'debug: false\nworkers: 4\n' },
    cwd: 'svc',
    setup: ['git init', IDENT, 'git add app.py config.yml', 'git commit -m "service v1"', 'echo "PASSWORD=hunter2" > secrets.env', 'git add secrets.env', 'git commit -m "Add env"', 'echo trace > debug.txt', 'git add debug.txt', 'echo "debug: true" > config.yml'],
    solution: ['git status', 'git restore --staged debug.txt', 'git restore config.yml', 'git revert HEAD'],
    goals: [
      { label: 'debug.txt is no longer staged but still exists', ok: (sh) => { const r = repo(sh)!; return !('debug.txt' in r.index) && read(sh, 'debug.txt') !== null; } },
      { label: 'config.yml is back to the committed content', ok: (sh) => read(sh, 'config.yml') === 'debug: false\nworkers: 4\n' },
      { label: 'secrets.env is gone from the working tree and the latest commit is a revert', ok: (sh) => read(sh, 'secrets.env') === null && /^Revert/.test(repo(sh)!.commits.get(gitApi.headId(repo(sh)!)!)!.msg) },
      { label: 'history was kept: the leaking commit is still there', ok: (sh) => gitApi.logLines(repo(sh)!, gitApi.headId(repo(sh)!)!).length === 3 },
    ],
  }),
};

// ---- 4. conflict
const conflict: ShellLevel = {
  id: 'git-conflict', title: 'Resolve a merge conflict', concept: 'merge conflicts, markers, resolving, committing the merge', xp: 120, tier: 'guided',
  ticket: 'Two engineers edited the same constraint line. Git cannot choose; you can.',
  build: () => ({
    brief: `<p>In <code>~/pnr</code>, merge <code>origin-tweak</code> into <code>main</code>. Both branches changed the same line of <code>timing.sdc</code>, so git stops with a conflict.</p>
<ul><li>Open the file: find the <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code>=======</code>, <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> markers.</li><li>Keep <b>both</b> constraints (the uncertainty line from each side) and remove the markers.</li><li><code>git add</code> the file and <code>git commit</code> to finish the merge.</li></ul>`,
    hints: ['<code>git status</code> lists "both modified" files. <code>cat timing.sdc</code> shows the markers.', 'Rewrite the file with both lines and no marker lines, e.g. <code>printf "...\\n" &gt; timing.sdc</code>.', '<code>git add timing.sdc; git commit -m "Merge origin-tweak"</code>'],
    files: { 'pnr/timing.sdc': 'create_clock -period 2.0 clk\nset_clock_uncertainty 0.10 clk\nset_input_delay 0.5 din\n' },
    cwd: 'pnr',
    setup: ['git init', IDENT, 'git add timing.sdc', 'git commit -m "base constraints"', 'git checkout -b origin-tweak', 'printf "create_clock -period 2.0 clk\\nset_clock_uncertainty 0.25 clk\\nset_input_delay 0.5 din\\n" > timing.sdc', 'git commit -am "Loosen uncertainty"', 'git checkout main', 'printf "create_clock -period 2.0 clk\\nset_clock_uncertainty 0.15 clk\\nset_input_delay 0.5 din\\n" > timing.sdc', 'git commit -am "Tighten uncertainty"'],
    solution: ['git merge origin-tweak', 'git status', 'printf "create_clock -period 2.0 clk\\nset_clock_uncertainty 0.15 clk\\nset_clock_uncertainty 0.25 clk\\nset_input_delay 0.5 din\\n" > timing.sdc', 'git add timing.sdc', 'git commit -m "Merge origin-tweak"'],
    goals: [
      { label: 'no conflict markers remain', ok: (sh) => !/^(<<<<<<<|=======|>>>>>>>)/m.test(read(sh, 'timing.sdc') ?? '<<<<<<<') },
      { label: 'both constraints survive', ok: (sh) => { const t = read(sh, 'timing.sdc') ?? ''; return t.includes('0.15 clk') && t.includes('0.25 clk') && t.includes('create_clock') && t.includes('set_input_delay'); } },
      { label: 'the merge is committed (a commit with two parents)', ok: (sh) => { const r = repo(sh)!; return !r.merging && r.commits.get(gitApi.headId(r)!)!.parents.length === 2; } },
    ],
  }),
};

// ---- 5. stash
const stash: ShellLevel = {
  id: 'git-stash', title: 'Hotfix in the middle of work', concept: 'stash, stash pop, switching branches with dirty trees', xp: 110, tier: 'guided',
  ticket: 'You are halfway through a feature when production needs a one-line fix. Do not lose the feature work, and do not commit it half-done.',
  build: () => ({
    brief: `<p><code>~/fw</code> is on <code>feature</code> with uncommitted edits in <code>feature.c</code>. Production is broken: <code>version.txt</code> on <code>main</code> says <code>1.0-broken</code> and must say <code>1.0</code>.</p>
<ul><li><code>git stash</code> your work.</li><li>Switch to <code>main</code>, fix <code>version.txt</code>, commit.</li><li>Go back to <code>feature</code> and <code>git stash pop</code>. Your edits must be back, uncommitted.</li></ul>`,
    hints: ['A dirty tree can block checkout; <code>git stash</code> sets your edits aside.', '<code>git stash pop</code> restores them (and drops the stash).'],
    files: { 'fw/version.txt': '1.0-broken\n', 'fw/feature.c': 'int feature(void) { return 0; }\n' },
    cwd: 'fw',
    setup: ['git init', IDENT, 'git add version.txt feature.c', 'git commit -m "firmware 1.0"', 'git checkout -b feature', 'printf "int feature(void) { return 42; /* wip */ }\\n" > feature.c'],
    solution: ['git stash', 'git checkout main', 'echo 1.0 > version.txt', 'git commit -am "Fix version string"', 'git checkout feature', 'git stash pop'],
    goals: [
      { label: 'main has the fixed version in a commit', ok: (sh) => { const r = repo(sh)!; const t = r.commits.get(r.branches.get('main')!)!.tree; return t['version.txt'] === '1.0\n'; } },
      { label: 'you are back on feature', ok: (sh) => (repo(sh)!.head as { branch?: string }).branch === 'feature' },
      { label: 'the work in progress is back, uncommitted', ok: (sh) => /return 42/.test(read(sh, 'feature.c') ?? '') && !/return 42/.test(gitApi.headTree(repo(sh)!)['feature.c'] ?? '') },
      { label: 'the stash is empty', ok: (sh) => repo(sh)!.stash.length === 0 },
    ],
  }),
};

// ---- 6. bisect (guided)
function bisectSetup(good: number, total: number, badAt: number): string[] {
  const cmds = ['git init', IDENT, 'printf "#!/bin/bash\\ngrep -q pass status.txt\\n" > check.sh', 'chmod +x check.sh', 'echo pass > status.txt', 'git add check.sh status.txt', 'git commit -m "c0: baseline"'];
  void good;
  for (let i = 1; i <= total; i++) {
    if (i === badAt) cmds.push('echo fail > status.txt', 'git add status.txt');
    else cmds.push(`echo "change ${i}" >> notes.txt`, 'git add notes.txt');
    cmds.push(`git commit -m "c${i}: ${i === badAt ? 'refactor status handling' : 'update notes ' + i}"`);
  }
  return cmds;
}
const bisect: ShellLevel = {
  id: 'git-bisect', title: 'Find the commit that broke it', concept: 'bisect, run, binary search over history', xp: 130, tier: 'guided',
  ticket: 'check.sh passed last week and fails today, with 12 commits in between. Do not read them all.',
  build: () => ({
    brief: `<p>In <code>~/dut</code>, <code>./check.sh</code> succeeds on the first commit and fails now. Find the first bad commit with <b>git bisect</b>, let it run the script for you, and write the commit hash to <code>culprit.txt</code>.</p>
<pre>git bisect start
git bisect bad HEAD
git bisect good HEAD~12
git bisect run ./check.sh</pre><p>git prints <code>&lt;hash&gt; is the first bad commit</code>. Finish with <code>git bisect reset</code>.</p>`,
    hints: ['<code>git bisect run CMD</code> runs CMD at each step: exit 0 means good, non-zero bad.', 'Redirect the interesting line: <code>... | grep "first bad" | cut -d" " -f1 &gt; culprit.txt</code>', 'Do not forget <code>git bisect reset</code> to get back to main.'],
    files: {},
    cwd: 'dut',
    setup: ['mkdir -p ~/dut', 'cd ~/dut', ...bisectSetup(0, 12, 7)],
    solution: ['git bisect start', 'git bisect bad HEAD', 'git bisect good HEAD~12', 'git bisect run ./check.sh | grep "first bad" | cut -d" " -f1 > culprit.txt', 'git bisect reset'],
    goals: [
      { label: 'culprit.txt names the commit that broke status.txt', ok: (sh) => { const r = repo(sh)!; const bad = [...r.commits.values()].find((c) => c.msg.startsWith('c7:')); const t = (read(sh, 'culprit.txt') ?? '').trim(); return !!bad && t.length >= 7 && bad.id.startsWith(t); } },
      { label: 'you used git bisect', ok: (_s, h) => ran(h, /git bisect run/) },
      { label: 'you ended the bisect: back on main', ok: (sh) => (repo(sh)!.head as { branch?: string }).branch === 'main' },
    ],
  }),
};

// ===================================================================== bosses
const names = ['alu', 'fifo', 'uart', 'dma', 'irq'];
const bossMerge: ShellLevel = {
  id: 'git-boss-merge', title: 'Boss: merge two long-lived branches', concept: 'conflicts in several files, resolving and finishing a merge', xp: 240, tier: 'boss',
  ticket: 'The release branch and main diverged for a month. Merge release into main, keeping everyone\'s work. No hints.',
  build: (r: Rng) => {
    const a = pick(r, names);
    const b = pick(r, names.filter((x) => x !== a));
    const va = between(r, 2, 9), vb = between(r, 10, 19), vc = between(r, 20, 29);
    const files: Record<string, string> = {
      [`soc/${a}.cfg`]: `name: ${a}\ndepth: 4\nmode: base\n`,
      [`soc/${b}.cfg`]: `name: ${b}\nwidth: 8\nmode: base\n`,
      'soc/CHANGELOG': 'start\n',
    };
    return {
      brief: `<p>The repo in <code>~/soc</code> has <code>main</code> and <code>release</code>, diverged. Merge <code>release</code> into <code>main</code> and make the result contain <b>both sides' changes</b> in every conflicted file (their lines are different values for the same keys; keep main's <code>depth</code>/<code>width</code> and release's extra keys), no markers left, merge committed.</p>
<p>Files to watch: <code>${a}.cfg</code>, <code>${b}.cfg</code> and <code>CHANGELOG</code>.</p>`,
      hints: [], files, cwd: 'soc',
      setup: [
        'git init', IDENT, `git add ${a}.cfg ${b}.cfg CHANGELOG`, 'git commit -m "base"',
        'git checkout -b release',
        `printf "name: ${a}\\ndepth: 4\\nmode: release\\nstages: ${va}\\n" > ${a}.cfg`,
        `printf "name: ${b}\\nwidth: ${vb}\\nmode: release\\n" > ${b}.cfg`,
        'echo "release notes" >> CHANGELOG',
        'git commit -am "release work"',
        'git checkout main',
        `printf "name: ${a}\\ndepth: ${vc}\\nmode: dev\\n" > ${a}.cfg`,
        `printf "name: ${b}\\nwidth: 8\\nmode: dev\\nlanes: ${va}\\n" > ${b}.cfg`,
        'echo "dev notes" >> CHANGELOG',
        'git commit -am "main work"',
      ],
      solution: [
        'git merge release',
        `printf "name: ${a}\\ndepth: ${vc}\\nmode: dev\\nstages: ${va}\\n" > ${a}.cfg`,
        `printf "name: ${b}\\nwidth: ${vb}\\nmode: dev\\nlanes: ${va}\\n" > ${b}.cfg`,
        'printf "start\\ndev notes\\nrelease notes\\n" > CHANGELOG',
        'git add -A', 'git commit -m "Merge release into main"',
      ],
      goals: [
        { label: 'no conflict markers remain anywhere', ok: (sh) => !Object.values(gitApi.workTree({ sh, fs: sh.fs, in: undefined as never, out: () => undefined, err: () => undefined }, repo(sh)!)).some((t) => /^(<<<<<<<|>>>>>>>)/m.test(t)) },
        { label: `${a}.cfg keeps main's depth and release's stages`, ok: (sh) => { const t = read(sh, `${a}.cfg`) ?? ''; return t.includes(`depth: ${vc}`) && t.includes(`stages: ${va}`); } },
        { label: `${b}.cfg keeps release's width and main's lanes`, ok: (sh) => { const t = read(sh, `${b}.cfg`) ?? ''; return t.includes(`width: ${vb}`) && t.includes(`lanes: ${va}`); } },
        { label: 'CHANGELOG has both notes', ok: (sh) => { const t = read(sh, 'CHANGELOG') ?? ''; return t.includes('dev notes') && t.includes('release notes'); } },
        { label: 'the merge is committed on main', ok: (sh) => { const rp = repo(sh)!; return !rp.merging && (rp.head as { branch?: string }).branch === 'main' && rp.commits.get(gitApi.headId(rp)!)!.parents.length === 2; } },
      ],
    };
  },
};

const bossBisect: ShellLevel = {
  id: 'git-boss-bisect', title: 'Boss: bisect, then fix it properly', concept: 'bisect run, revert, reading history', xp: 260, tier: 'boss',
  ticket: 'A regression hides somewhere in a long history. Find it, record it, and revert only that commit. No hints.',
  build: (r: Rng) => {
    const total = between(r, 14, 22);
    const badAt = between(r, 4, total - 3);
    return {
      brief: `<p>The repo in <code>~/dut</code> has ${total} commits after the baseline; <code>./check.sh</code> passes at the baseline and fails at <code>HEAD</code>.</p>
<ul><li>Write the hash of the first bad commit to <code>culprit.txt</code>.</li><li>Fix it by <b>reverting that one commit</b> (not by resetting: the branch is shared). <code>./check.sh</code> must pass again and the other commits must remain.</li><li>End on <code>main</code> with no bisect in progress.</li></ul>`,
      hints: [], files: {}, cwd: 'dut',
      setup: ['mkdir -p ~/dut', 'cd ~/dut', ...bisectSetup(0, total, badAt)],
      solution: [`git bisect start`, `git bisect bad HEAD`, `git bisect good HEAD~${total}`, `git bisect run ./check.sh | grep "first bad" | cut -d" " -f1 > culprit.txt`, 'git bisect reset', 'git revert $(cat culprit.txt)'],
      goals: [
        { label: 'culprit.txt holds the first bad commit', ok: (sh) => { const rp = repo(sh)!; const bad = [...rp.commits.values()].find((c) => c.msg.startsWith(`c${badAt}:`)); const t = (read(sh, 'culprit.txt') ?? '').trim(); return !!bad && t.length >= 7 && bad.id.startsWith(t); } },
        { label: 'check.sh passes on the current tree', ok: (sh) => sh.run('./check.sh').status === 0 },
        { label: 'the culprit was reverted, not erased (history intact, a Revert commit on top)', ok: (sh) => { const rp = repo(sh)!; const log = gitApi.logLines(rp, gitApi.headId(rp)!); return log.length === total + 2 && /^Revert/.test(log[0].msg); } },
        { label: 'the other work is still there', ok: (sh) => (read(sh, 'notes.txt') ?? '').split('\n').filter(Boolean).length === total - 1 },
        { label: 'back on main, bisect finished', ok: (sh) => { const rp = repo(sh)!; return (rp.head as { branch?: string }).branch === 'main' && !rp.bisect; } },
      ],
    };
  },
};

export const GIT_LEVELS: ShellLevel[] = [first, branch, undo, conflict, stash, bisect, bossMerge, bossBisect];

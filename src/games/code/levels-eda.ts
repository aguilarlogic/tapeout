// EDA algorithm missions in Python: maze routing, static timing, SAT solving, and a slack and critical-path boss.
import { between, pick, type Rng } from '../../lessons/types';
import type { CodeLevel } from './types';

const maze: CodeLevel = {
  id: 'code-eda-maze', title: 'Maze routing', concept: 'Lee\'s algorithm: wavefront expansion on a routing grid', xp: 140, tier: 'guided', lang: 'py',
  ticket: 'The router has to connect a source pin to a target pin around blockages. Start with the oldest algorithm in the book.',
  build: () => ({
    brief: `<p>The routing grid is a list of strings: <code>S</code> is the source pin, <code>D</code> the target pin, <code>#</code> a blockage and <code>.</code> a free cell. A wire moves one cell up, down, left or right. Write <code>route(grid)</code> returning the length of the <b>shortest wire</b> from S to D (number of steps), or <code>-1</code> if the target cannot be reached.</p>`,
    starter: 'def route(grid):\n    return 0\n',
    hints: ['Find S first, then expand a wavefront: a queue of (row, col, distance), a visited set.', 'The first time the wavefront reaches D is the shortest distance. If the queue empties, return -1.'],
    solution: `def route(grid):
    rows = len(grid)
    cols = len(grid[0])
    start = None
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "S":
                start = (r, c)
    queue = [(start[0], start[1], 0)]
    seen = {start}
    while queue:
        r, c, d = queue.pop(0)
        if grid[r][c] == "D":
            return d
        for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nr = r + dr
            nc = c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != "#" and (nr, nc) not in seen:
                seen.add((nr, nc))
                queue.append((nr, nc, d + 1))
    return -1
`,
    cases: [
      { call: 'route(["S..#....", ".#.#.##.", ".#...#..", ".####.#.", "......#D"])' },
      { call: 'route(["S...D"])' },
      { call: 'route(["S#.", "##.", "..D"])' },
      { call: 'route(["S....", ".###.", ".#D#.", ".#.#.", "....."])', hidden: true },
      { call: 'route(["S.#.....", "..#.###.", "..#...#.", "..###.#.", "......#D"])', hidden: true },
    ],
  }),
};

const sta: CodeLevel = {
  id: 'code-eda-sta', title: 'Static timing in code', concept: 'arrival times on a DAG: the longest path through the gates', xp: 150, tier: 'guided', lang: 'py',
  ticket: 'Your own mini STA: the longest path through a combinational netlist, without simulating a single vector.',
  build: () => ({
    brief: `<p>A netlist is a dict mapping each gate name to <code>(delay, [fanins])</code>. A name that is not a key is a primary input, with arrival time 0. A gate's arrival time is the <b>latest</b> fanin arrival plus its own delay. Write <code>worst_arrival(gates)</code> returning the largest arrival time over all gates.</p>`,
    starter: 'def worst_arrival(gates):\n    return 0\n',
    hints: ['A gate cannot be timed before its fanins: use recursion with a cache (a dict), or process the gates in topological order.', 'arrival(g) = delay + max(arrival(f) for f in fanins), with arrival(input) = 0.'],
    solution: `def worst_arrival(gates):
    cache = {}
    def arr(n):
        if n not in gates:
            return 0
        if n not in cache:
            d, fanins = gates[n]
            cache[n] = d + max(arr(f) for f in fanins)
        return cache[n]
    return max(arr(g) for g in gates)
`,
    cases: [
      { call: 'worst_arrival({"g1": (3, ["a", "b"]), "g2": (2, ["g1", "c"]), "g3": (4, ["g2"])})' },
      { call: 'worst_arrival({"x": (5, ["a"]), "y": (1, ["b"])})' },
      { call: 'worst_arrival({"g1": (2, ["a", "b"]), "g2": (3, ["b", "c"]), "g3": (1, ["g1", "g2"]), "g4": (6, ["g3", "a"]), "g5": (2, ["g1"])})', hidden: true },
      { call: 'worst_arrival({"u": (4, ["a", "b", "c"])})', hidden: true },
    ],
  }),
};

const dpll: CodeLevel = {
  id: 'code-eda-dpll', title: 'A tiny SAT solver', concept: 'DPLL: unit propagation and branching, the engine under equivalence checking', xp: 180, tier: 'guided', lang: 'py',
  ticket: 'Formal tools bottom out in a SAT solver. Write the core of one: DPLL on a clause list.',
  build: () => ({
    brief: `<p>A formula in conjunctive normal form is a list of clauses; each clause is a list of non-zero integers, where <code>k</code> means variable k is true and <code>-k</code> means it is false. A clause is satisfied if any of its literals is. Write <code>dpll(clauses)</code> returning <code>True</code> if some assignment satisfies every clause, else <code>False</code>.</p>
<p>The DPLL method: (1) if a clause has a single literal, that literal is forced (<b>unit propagation</b>): drop the clauses it satisfies and remove its negation from the others; (2) an empty clause means this branch has failed; (3) no clauses left means success; (4) otherwise pick a literal and try it true, then false.</p>`,
    starter: 'def dpll(clauses):\n    return True\n',
    hints: ['Write a helper simplify(clauses, lit): keep the clauses without lit, and strip -lit from the rest.', 'Loop: find an empty clause (return False) or a unit clause (simplify and repeat). When neither exists, branch on any literal.'],
    solution: `def dpll(clauses):
    def simplify(cs, lit):
        out = []
        for c in cs:
            if lit in c:
                continue
            out.append([x for x in c if x != -lit])
        return out
    cs = [list(c) for c in clauses]
    while True:
        unit = None
        for c in cs:
            if len(c) == 0:
                return False
            if len(c) == 1 and unit is None:
                unit = c[0]
        if unit is None:
            break
        cs = simplify(cs, unit)
    if not cs:
        return True
    lit = cs[0][0]
    return dpll(simplify(cs, lit)) or dpll(simplify(cs, -lit))
`,
    cases: [
      { call: 'dpll([[1, 2], [-1, 3], [-2, -3]])' },
      { call: 'dpll([[1], [-1]])' },
      { call: 'dpll([[1, 2], [1, -2], [-1, 2], [-1, -2]])' },
      { call: 'dpll([[1, 2, 3], [-1, -2], [-2, -3], [-1, -3], [1, -2, 3]])', hidden: true },
      { call: 'dpll([[1], [-1, 2], [-2, 3], [-3, 4], [-4, -1]])', hidden: true },
      { call: 'dpll([])', hidden: true },
    ],
  }),
};

// ---------------------------------------------------------------- boss: slack and the critical path

const netlist = (r: Rng, gates: number) => {
  const inputs = ['a', 'b', 'c', 'd'];
  const names: string[] = [], defs: string[] = [];
  for (let i = 0; i < gates; i++) {
    const pool = [...inputs, ...names], k = between(r, 1, 3), fan: string[] = [];
    while (fan.length < Math.min(k, pool.length)) { const f = pick(r, pool); if (!fan.includes(f)) fan.push(f); }
    const name = `g${i}`;
    defs.push(`"${name}": (${between(r, 1, 9)}, [${fan.map((f) => `"${f}"`).join(', ')}])`);
    names.push(name);
  }
  return '{' + defs.join(', ') + '}';
};

const boss: CodeLevel = {
  id: 'code-eda-boss', title: 'Boss: slack and the critical path', concept: 'forward arrival times, the worst output, the path behind it', xp: 380, tier: 'boss', lang: 'py',
  ticket: 'The timing report for the netlist: worst slack and the critical path, for three netlists of growing size. No hints.',
  build: (r: Rng) => {
    const n1 = netlist(r, 6), n2 = netlist(r, 12), n3 = netlist(r, 20), n4 = netlist(r, 30);
    const per = () => between(r, 8, 40);
    return {
      brief: `<p>A netlist is a dict mapping each gate to <code>(delay, [fanins])</code>; a name that is not a key is a primary input with arrival time 0. A gate's arrival is its delay plus the latest fanin arrival. The <b>outputs</b> are the gates that no other gate reads.</p>
<p>Write <code>report(gates, period)</code> returning a tuple <code>(worst_slack, path)</code>:</p>
<ul><li><code>worst_slack</code> = <code>period</code> − the largest output arrival time.</li>
<li><code>path</code> is the critical path as a list of names from a primary input to the worst output (a tie between outputs goes to the one that sorts first). Walk back from the output, at each gate taking the fanin with the latest arrival (a tie goes to the name that sorts first); stop at a primary input.</li></ul>`,
      starter: 'def report(gates, period):\n    return (0, [])\n',
      hints: [],
      solution: `def report(gates, period):
    cache = {}
    def arr(n):
        if n not in gates:
            return 0
        if n not in cache:
            d, fanins = gates[n]
            cache[n] = d + max(arr(f) for f in fanins)
        return cache[n]
    used = set()
    for n in gates:
        for f in gates[n][1]:
            used.add(f)
    outs = sorted([n for n in gates if n not in used])
    worst = outs[0]
    for o in outs:
        if arr(o) > arr(worst):
            worst = o
    path = [worst]
    cur = worst
    while cur in gates:
        best = None
        for f in sorted(gates[cur][1]):
            if best is None or arr(f) > arr(best):
                best = f
        path.append(best)
        cur = best
    path.reverse()
    return (period - arr(worst), path)
`,
      cases: [
        { call: `report(${n1}, ${per()})` },
        { call: `report(${n2}, ${per()})` },
        { call: `report(${n3}, ${per()})`, hidden: true },
        { call: `report(${n4}, ${per()})`, hidden: true },
        { call: `report(${n4}, ${per()})`, hidden: true },
      ],
    };
  },
};

export const EDA_CODE_LEVELS: CodeLevel[] = [maze, sta, dpll, boss];

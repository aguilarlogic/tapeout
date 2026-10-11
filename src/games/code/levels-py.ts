// Code Lab missions in Python. Each one gives a ticket, a starter, example cases to run, hidden cases that run on Submit,
// and a reference solution that the tests prove passes every case while the starter does not.
import { between, pick, type Rng } from '../../lessons/types';
import type { CodeLevel } from './types';

const q = (s: string) => JSON.stringify(s);

const parse: CodeLevel = {
  id: 'code-py-parse', title: 'Parse a simulator log line', concept: 'string methods, dicts and early returns', xp: 80, tier: 'guided', lang: 'py',
  ticket: 'The regression dashboard needs structured data. Every tool in the flow prints text; someone has to parse it.',
  build: () => ({
    brief: `<p>Write <code>parse_line(line)</code> for log lines like</p><pre>[1200 ns] ERROR dut.alu: overflow flag stuck</pre>
<p>It returns <code>{'time_ns': 1200, 'level': 'ERROR', 'src': 'dut.alu', 'msg': 'overflow flag stuck'}</code> with <code>time_ns</code> as an int, and <code>None</code> for any line that does not have this shape (no leading <code>[</code>, a non-numeric time, and so on). Messages may contain colons.</p>`,
    starter: 'def parse_line(line):\n    # split the line into time, level, source and message\n    return None\n',
    hints: ['str.find, str.partition and str.startswith are all you need. Find where " ns]" ends the timestamp first.', '"".isdigit() tells you whether the time is a number. partition(": ") splits only at the first colon-and-space.', 'After the timestamp: level, then the source up to ": ", then the message is everything else.'],
    solution: `def parse_line(line):
    if not line.startswith('['):
        return None
    close = line.find(' ns]')
    if close < 0 or not line[1:close].isdigit():
        return None
    rest = line[close + 4:].strip()
    level, _, rest = rest.partition(' ')
    src, sep, msg = rest.partition(': ')
    if not sep:
        return None
    return {'time_ns': int(line[1:close]), 'level': level, 'src': src, 'msg': msg}
`,
    cases: [
      { call: 'parse_line("[1200 ns] ERROR dut.alu: overflow flag stuck")' },
      { call: 'parse_line("[5 ns] INFO tb: start of test")' },
      { call: 'parse_line("random text")' },
      { call: 'parse_line("[x ns] INFO a: b")', hidden: true },
      { call: 'parse_line("[77 ns] WARN mem.ctl: retry: bank 3: timeout")', hidden: true },
      { call: 'parse_line("[9 ns] FATAL no colon here")', hidden: true },
      { call: 'parse_line("")', hidden: true },
    ],
  }),
};

const hist: CodeLevel = {
  id: 'code-py-hist', title: 'Count and rank', concept: 'dicts, sorting with a key', xp: 80, tier: 'guided', lang: 'py',
  ticket: 'Which assertion fires most often in last night\'s regression? Count them and rank them.',
  build: () => ({
    brief: `<p>Write <code>histogram(words)</code> returning a dict of how many times each word appears, and <code>top(counts, n)</code> returning the <code>n</code> most frequent as a list of <code>(word, count)</code> tuples. Highest count first; ties are broken alphabetically.</p>`,
    starter: 'def histogram(words):\n    counts = {}\n    return counts\n\ndef top(counts, n):\n    return []\n',
    hints: ['counts[w] = counts.get(w, 0) + 1', 'sorted() takes key=. A tuple key like (-count, word) sorts count descending and word ascending.'],
    solution: `def histogram(words):
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    return counts

def top(counts, n):
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:n]
`,
    cases: [
      { call: 'histogram(["a", "b", "a"])' },
      { call: 'top(histogram("x y x z y x".split()), 2)' },
      { call: 'top(histogram(["b", "a", "b", "a", "c"]), 3)', hidden: true },
      { call: 'histogram([])', hidden: true },
      { call: 'top({"q": 1}, 5)', hidden: true },
    ],
  }),
};

const triage: CodeLevel = {
  id: 'code-py-triage', title: 'Triage a regression', concept: 'grouping results, sets and sorted output', xp: 100, tier: 'guided', lang: 'py',
  ticket: 'Nightly regression finished: 4,000 results and 60 failures. Which tests are flaky, and which are really broken?',
  build: () => ({
    brief: `<p>A result is a <code>(test, status)</code> tuple with status <code>"pass"</code> or <code>"fail"</code>.</p>
<p><code>summarize(results)</code> returns <code>{test: {'pass': n, 'fail': m}}</code>.<br><code>flaky(summary)</code> returns the sorted list of tests that both passed and failed.<br><code>broken(summary)</code> returns the sorted list of tests that failed and never passed.</p>`,
    starter: 'def summarize(results):\n    return {}\n\ndef flaky(summary):\n    return []\n\ndef broken(summary):\n    return []\n',
    hints: ['setdefault(test, {"pass": 0, "fail": 0}) gives you the inner dict to update.', 'flaky: both counts above zero. broken: fail above zero and pass equal to zero.'],
    solution: `def summarize(results):
    out = {}
    for test, status in results:
        row = out.setdefault(test, {'pass': 0, 'fail': 0})
        row[status] += 1
    return out

def flaky(summary):
    return sorted(t for t, r in summary.items() if r['pass'] and r['fail'])

def broken(summary):
    return sorted(t for t, r in summary.items() if r['fail'] and not r['pass'])
`,
    cases: [
      { pre: 'R = [("a","pass"),("a","fail"),("b","fail"),("b","fail"),("c","pass")]', call: 'summarize(R)' },
      { pre: 'R = [("a","pass"),("a","fail"),("b","fail"),("b","fail"),("c","pass")]', call: 'flaky(summarize(R))' },
      { pre: 'R = [("a","pass"),("a","fail"),("b","fail"),("b","fail"),("c","pass")]', call: 'broken(summarize(R))' },
      { pre: 'R = [("t%d" % (i % 4), "fail" if i % 3 == 0 else "pass") for i in range(40)]', call: '(flaky(summarize(R)), broken(summarize(R)))', hidden: true },
      { call: 'summarize([])', hidden: true },
    ],
  }),
};

const regfield: CodeLevel = {
  id: 'code-py-regfield', title: 'Pack a control register', concept: 'bit manipulation with shifts and masks', xp: 100, tier: 'guided', lang: 'py',
  ticket: 'Firmware writes this register and the testbench reads it back. Both sides must agree on the layout.',
  build: () => ({
    brief: `<p>The control register is 16 bits:</p><pre>bit  0      en    (1 bit)
bits 2:1    mode  (2 bits)
bits 10:3   div   (8 bits)
bits 15:11  reserved, always 0</pre>
<p>Write <code>pack(en, mode, div)</code> returning the register value, and <code>unpack(reg)</code> returning the tuple <code>(en, mode, div)</code>. Out-of-range inputs are masked to their field width, never spilled into a neighbouring field.</p>`,
    starter: 'def pack(en, mode, div):\n    return 0\n\ndef unpack(reg):\n    return (0, 0, 0)\n',
    hints: ['(x & mask) << position puts a field in place. A mask for w bits is (1 << w) - 1.', 'unpack is the reverse: shift right by the position, then mask.'],
    solution: `def pack(en, mode, div):
    return (en & 1) | ((mode & 3) << 1) | ((div & 0xFF) << 3)

def unpack(reg):
    return (reg & 1, (reg >> 1) & 3, (reg >> 3) & 0xFF)
`,
    cases: [
      { call: 'pack(1, 2, 5)' },
      { call: 'unpack(0x2B)' },
      { call: 'pack(0, 0, 255)' },
      { call: 'pack(3, 7, 300)', hidden: true },
      { call: 'unpack(pack(1, 3, 200))', hidden: true },
      { call: 'unpack(0xFFFF)', hidden: true },
    ],
  }),
};

const fibmemo: CodeLevel = {
  id: 'code-py-fibmemo', title: 'Make it fast', concept: 'memoization and avoiding exponential recursion', xp: 80, tier: 'guided', lang: 'py',
  ticket: 'The reference model takes forever once the input grows. Same answers, in no time.',
  build: () => ({
    brief: `<p><code>fib(n)</code> below is correct and hopelessly slow: it recomputes the same values exponentially many times. Make <code>fib(80)</code> and <code>fib(300)</code> instant without changing what it returns.</p>`,
    starter: 'def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n',
    hints: ['Remember each answer in a dict the first time you compute it.', 'Or skip recursion: keep the last two values in a loop.'],
    solution: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n',
    cases: [{ call: 'fib(10)' }, { call: 'fib(80)' }, { call: 'fib(0)', hidden: true }, { call: 'fib(300)', hidden: true }],
    maxSteps: 200_000,
  }),
};

const bsearch: CodeLevel = {
  id: 'code-py-bsearch', title: 'Binary search', concept: 'invariants and off-by-one care', xp: 100, tier: 'guided', lang: 'py',
  ticket: 'Look up a timestamp in a sorted trace of a million entries, fast.',
  build: () => ({
    brief: `<p>Write <code>lower_bound(a, x)</code>: the index of the first element of the sorted list <code>a</code> that is <code>&gt;= x</code>, or <code>len(a)</code> if there is none. It must take O(log n) steps: it is tested on a list of 100,000 items with a small step budget.</p>`,
    starter: 'def lower_bound(a, x):\n    for i in range(len(a)):\n        if a[i] >= x:\n            return i\n    return len(a)\n',
    hints: ['Keep lo and hi such that the answer is always in [lo, hi].', 'mid = (lo + hi) // 2. If a[mid] < x the answer is right of mid: lo = mid + 1. Otherwise hi = mid.', 'Stop when lo == hi.'],
    solution: `def lower_bound(a, x):
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo
`,
    cases: [
      { call: 'lower_bound([1, 3, 5, 7], 5)' },
      { call: 'lower_bound([1, 3, 5, 7], 4)' },
      { call: 'lower_bound([], 1)', hidden: true },
      { call: 'lower_bound([2, 2, 2], 2)', hidden: true },
      { call: 'lower_bound([1, 2, 3], 9)', hidden: true },
      { pre: 'A = list(range(0, 200000, 2))', call: 'lower_bound(A, 123457)', hidden: true },
    ],
    maxSteps: 40_000,
  }),
};

const gridBfs: CodeLevel = {
  id: 'code-py-bfs', title: 'Shortest route', concept: 'breadth-first search with a queue', xp: 120, tier: 'guided', lang: 'py',
  ticket: 'The router needs the shortest path between two pins on a blockage map.',
  build: () => ({
    brief: `<p><code>shortest(grid, start, goal)</code>: <code>grid</code> is a list of strings; <code>#</code> is a blockage, anything else is free. Moves are up, down, left and right. Positions are <code>(row, col)</code> tuples. Return the number of moves of the shortest path, or <code>-1</code> if the goal cannot be reached.</p>`,
    starter: 'from collections import deque\n\ndef shortest(grid, start, goal):\n    return -1\n',
    hints: ['BFS explores in rings of equal distance, so the first time you reach the goal is the shortest way.', 'Keep a deque of (row, col, dist) and a set of visited cells. Mark a cell visited when you push it, not when you pop it.'],
    solution: `from collections import deque

def shortest(grid, start, goal):
    rows, cols = len(grid), len(grid[0])
    seen = {start}
    q = deque([(start[0], start[1], 0)])
    while q:
        r, c, d = q.popleft()
        if (r, c) == goal:
            return d
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != '#' and (nr, nc) not in seen:
                seen.add((nr, nc))
                q.append((nr, nc, d + 1))
    return -1
`,
    cases: [
      { pre: 'G = ["....", ".##.", "...."]', call: 'shortest(G, (0, 0), (2, 3))' },
      { pre: 'G = ["..#.", ".##.", "..#."]', call: 'shortest(G, (0, 0), (0, 3))' },
      { pre: 'G = ["."]', call: 'shortest(G, (0, 0), (0, 0))', hidden: true },
      { pre: 'G = ["#...", "....", "...#"]', call: 'shortest(G, (0, 1), (2, 2))', hidden: true },
      { pre: 'G = ["....." , ".###.", ".#...", ".#.#.", "...#."]', call: 'shortest(G, (0, 0), (4, 4))', hidden: true },
    ],
  }),
};

const topo: CodeLevel = {
  id: 'code-py-topo', title: 'Build order', concept: 'graphs, topological sort and cycle detection', xp: 140, tier: 'guided', lang: 'py',
  ticket: 'Make decides the order from the dependency graph. Write the part that decides.',
  build: () => ({
    brief: `<p><code>build_order(deps)</code>: <code>deps</code> maps each target to the list of targets it needs first (every target appears as a key). Return a list that builds prerequisites before the things that need them. When several targets are ready, build the alphabetically first. If there is a cycle, return <code>None</code>.</p>`,
    starter: 'def build_order(deps):\n    return []\n',
    hints: ['Count how many unbuilt prerequisites each target has. Targets with zero are ready.', 'Repeatedly take the smallest ready target (a heap or sorted()), build it, and reduce the count of everything that depends on it.', 'If you could not build every target, there is a cycle.'],
    solution: `import heapq

def build_order(deps):
    need = {t: len(set(p)) for t, p in deps.items()}
    users = {t: [] for t in deps}
    for t, p in deps.items():
        for x in set(p):
            users[x].append(t)
    ready = [t for t, n in need.items() if n == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        t = heapq.heappop(ready)
        order.append(t)
        for u in users[t]:
            need[u] -= 1
            if need[u] == 0:
                heapq.heappush(ready, u)
    return order if len(order) == len(deps) else None
`,
    cases: [
      { call: 'build_order({"app": ["lib", "util"], "lib": ["util"], "util": []})' },
      { call: 'build_order({"b": [], "a": []})' },
      { call: 'build_order({"a": ["b"], "b": ["a"]})' },
      { call: 'build_order({"x": ["y", "y"], "y": ["z"], "z": [], "w": ["z"]})', hidden: true },
      { call: 'build_order({})', hidden: true },
      { call: 'build_order({"a": ["b"], "b": ["c"], "c": ["b"], "d": []})', hidden: true },
    ],
  }),
};

const lru: CodeLevel = {
  id: 'code-py-lru', title: 'Write a cache', concept: 'classes, ordered dicts and eviction', xp: 140, tier: 'guided', lang: 'py',
  ticket: 'Model the cache before RTL exists. The architecture team will want to try different sizes.',
  build: () => ({
    brief: `<p>Write class <code>LRU</code>: <code>LRU(capacity)</code>, <code>get(key)</code> returning the value or <code>-1</code>, and <code>put(key, value)</code>. Using a key makes it the most recently used. When a <code>put</code> would exceed the capacity, evict the least recently used key. Updating an existing key never evicts.</p>`,
    starter: 'class LRU:\n    def __init__(self, capacity):\n        self.capacity = capacity\n\n    def get(self, key):\n        return -1\n\n    def put(self, key, value):\n        pass\n',
    hints: ['A dict remembers insertion order. To mark a key as recently used, delete it and insert it again.', 'The oldest key is the first one: next(iter(self.d)).'],
    solution: `class LRU:
    def __init__(self, capacity):
        self.capacity = capacity
        self.d = {}

    def get(self, key):
        if key not in self.d:
            return -1
        v = self.d.pop(key)
        self.d[key] = v
        return v

    def put(self, key, value):
        if key in self.d:
            del self.d[key]
        elif len(self.d) >= self.capacity:
            del self.d[next(iter(self.d))]
        self.d[key] = value
`,
    cases: [
      { pre: 'c = LRU(2)\nc.put(1, 10)\nc.put(2, 20)\nc.put(3, 30)', call: '(c.get(1), c.get(2), c.get(3))' },
      { pre: 'c = LRU(2)\nc.put(1, 1)\nc.put(2, 2)\nc.get(1)\nc.put(3, 3)', call: '(c.get(1), c.get(2), c.get(3))' },
      { pre: 'c = LRU(1)\nc.put(1, 1)\nc.put(1, 5)', call: 'c.get(1)', hidden: true },
      { pre: 'c = LRU(3)\nfor i in range(10):\n    c.put(i % 5, i)\n    c.get((i + 2) % 5)', call: '[c.get(k) for k in range(5)]', hidden: true },
    ],
  }),
};

const newton: CodeLevel = {
  id: 'code-py-newton', title: 'Square roots by hand', concept: 'Newton iteration and stopping criteria', xp: 100, tier: 'guided', lang: 'py',
  ticket: 'The fixed-point model needs a software sqrt it can compare the RTL against. No libraries allowed: this is the algorithm the hardware implements.',
  build: () => ({
    brief: `<p>Write <code>my_sqrt(x)</code> for <code>x &gt;= 0</code> using Newton's method: repeat <code>g = (g + x / g) / 2</code> until it stops improving. Do not use <code>math.sqrt</code> or <code>**&nbsp;0.5</code>. Return <code>0.0</code> for <code>x == 0</code>. Answers must be within 1e-9.</p>`,
    starter: 'def my_sqrt(x):\n    return 0.0\n',
    hints: ['Start from a guess like max(x, 1.0).', 'Stop when |g * g - x| is tiny relative to x, or after a fixed number of iterations: 60 is plenty, Newton converges quadratically.'],
    solution: `def my_sqrt(x):
    if x == 0:
        return 0.0
    g = max(x, 1.0)
    for _ in range(80):
        g = (g + x / g) / 2
    return g
`,
    rules: [{ label: 'Does not call math.sqrt or use ** 0.5', ok: (s) => !/sqrt\(|\*\*\s*0?\.5/.test(s.replace(/def\s+my_sqrt/, '')) }],
    cases: [
      { call: 'my_sqrt(2)', tol: 1e-9 }, { call: 'my_sqrt(144)', tol: 1e-9 }, { call: 'my_sqrt(0)', tol: 1e-9, hidden: true },
      { call: 'my_sqrt(1e-6)', tol: 1e-9, hidden: true }, { call: 'my_sqrt(1e12)', tol: 1e-6, hidden: true }, { call: 'my_sqrt(0.25)', tol: 1e-9, hidden: true },
    ],
  }),
};

const simpson: CodeLevel = {
  id: 'code-py-simpson', title: 'Integrate numerically', concept: 'Simpson\'s rule and passing functions as arguments', xp: 120, tier: 'guided', lang: 'py',
  ticket: 'Compute the energy in a waveform without a closed form: integrate the samples numerically.',
  build: () => ({
    brief: `<p>Write <code>integrate(f, a, b, n)</code> using Simpson's rule with <code>n</code> subintervals (<code>n</code> is even): <code>h/3 * (f0 + 4 f1 + 2 f2 + 4 f3 + ... + fn)</code>, with <code>h = (b - a) / n</code>. <code>f</code> is a function. Answers must be within 1e-6 on smooth functions.</p>`,
    starter: 'def integrate(f, a, b, n):\n    return 0.0\n',
    hints: ['Sample x = a + i * h for i from 0 to n.', 'Interior points alternate weight 4 (odd i) and 2 (even i). The ends have weight 1.'],
    solution: `def integrate(f, a, b, n):
    h = (b - a) / n
    s = f(a) + f(b)
    for i in range(1, n):
        s += (4 if i % 2 else 2) * f(a + i * h)
    return s * h / 3
`,
    cases: [
      { call: 'integrate(lambda x: x * x, 0, 3, 10)', tol: 1e-6 },
      { call: 'integrate(lambda x: 2 * x + 1, 0, 4, 2)', tol: 1e-6 },
      { call: 'integrate(lambda x: 1 / x, 1, 2, 20)', tol: 1e-6, hidden: true },
      { pre: 'import math', call: 'integrate(math.sin, 0, math.pi, 40)', tol: 1e-6, hidden: true },
      { pre: 'import math', call: 'integrate(lambda x: math.exp(-x * x), -2, 2, 100)', tol: 1e-6, hidden: true },
    ],
  }),
};

const mc: CodeLevel = {
  id: 'code-py-mc', title: 'Monte Carlo yield', concept: 'random sampling and estimating a probability', xp: 120, tier: 'guided', lang: 'py',
  ticket: 'Fab wants a yield estimate before committing to a die size. Simulate it.',
  build: () => ({
    brief: `<p>Write <code>estimate_yield(n, p, cells)</code>: simulate <code>n</code> dies. A die has <code>cells</code> independent cells, each defective with probability <code>p</code>; a die is good only if every cell is good. Return the fraction of good dies as a float. Use <code>random.random()</code>. The test accepts anything within 0.05 of the exact answer <code>(1 - p) ** cells</code>.</p>`,
    starter: 'import random\n\ndef estimate_yield(n, p, cells):\n    return 0.0\n',
    hints: ['For each die, check every cell: random.random() < p means that cell is defective.', 'good / n at the end.'],
    solution: `import random

def estimate_yield(n, p, cells):
    good = 0
    for _ in range(n):
        ok = True
        for _ in range(cells):
            if random.random() < p:
                ok = False
                break
        if ok:
            good += 1
    return good / n
`,
    cases: [
      { call: 'estimate_yield(2000, 0.01, 50)', tol: 0.05 },
      { call: 'estimate_yield(2000, 0.05, 20)', tol: 0.05, hidden: true },
      { call: 'estimate_yield(2000, 0.0, 30)', tol: 0.001, hidden: true },
      { call: 'estimate_yield(1000, 1.0, 5)', tol: 0.001, hidden: true },
    ],
  }),
};

const lfsr: CodeLevel = {
  id: 'code-py-lfsr', title: 'A golden model for an LFSR', concept: 'writing a bit-exact reference model', xp: 120, tier: 'guided', lang: 'py',
  ticket: 'The scoreboard needs expected values. The RTL is an 8-bit LFSR; write the model it will be compared against.',
  build: () => ({
    brief: `<p>The RTL is an 8-bit Fibonacci LFSR. Each clock: <code>feedback = s[7] ^ s[5] ^ s[4] ^ s[3]</code>, then <code>s = ((s &lt;&lt; 1) | feedback) &amp; 0xFF</code>.</p>
<p>Write <code>lfsr(seed, n)</code> returning the list of the next <code>n</code> states (not including the seed). Mask the seed to 8 bits.</p>`,
    starter: 'def lfsr(seed, n):\n    return []\n',
    hints: ['Bit i of s is (s >> i) & 1. XOR the four tapped bits, keep only the lowest bit of the result.', 'Append the new state after each step.'],
    solution: `def lfsr(seed, n):
    s = seed & 0xFF
    out = []
    for _ in range(n):
        fb = ((s >> 7) ^ (s >> 5) ^ (s >> 4) ^ (s >> 3)) & 1
        s = ((s << 1) | fb) & 0xFF
        out.append(s)
    return out
`,
    cases: [{ call: 'lfsr(1, 6)' }, { call: 'lfsr(0xA5, 4)' }, { call: 'lfsr(0, 3)', hidden: true }, { call: 'lfsr(0x1FF, 5)', hidden: true }, { call: 'len(set(lfsr(1, 255)))', hidden: true }],
  }),
};

const uart: CodeLevel = {
  id: 'code-py-uart', title: 'Model a UART frame', concept: 'protocol reference models and framing errors', xp: 140, tier: 'guided', lang: 'py',
  ticket: 'Before the monitor can check a UART transmitter, someone has to write down what a correct frame looks like.',
  build: () => ({
    brief: `<p>A frame is: one start bit (0), eight data bits <b>least significant first</b>, an optional parity bit, one stop bit (1).</p>
<p><code>uart_frame(byte, parity)</code> returns the list of bits. <code>parity</code> is <code>"none"</code>, <code>"even"</code> (parity bit makes the total number of 1s in data+parity even) or <code>"odd"</code>.</p>
<p><code>uart_decode(bits, parity)</code> is the inverse: return the byte, or <code>None</code> on a framing error (wrong length, bad start or stop bit) or a parity error.</p>`,
    starter: 'def uart_frame(byte, parity):\n    return []\n\ndef uart_decode(bits, parity):\n    return None\n',
    hints: ['Data bits LSB first: [(byte >> i) & 1 for i in range(8)].', 'Even parity bit = number of ones in the data % 2. Odd parity is the opposite.', 'In decode, rebuild the byte with the weights 1, 2, 4... and compare the parity bit with what the data demands.'],
    solution: `def uart_frame(byte, parity):
    data = [(byte >> i) & 1 for i in range(8)]
    bits = [0] + data
    if parity != 'none':
        p = sum(data) % 2
        bits.append(p if parity == 'even' else 1 - p)
    return bits + [1]

def uart_decode(bits, parity):
    n = 10 if parity == 'none' else 11
    if len(bits) != n or bits[0] != 0 or bits[-1] != 1:
        return None
    data = bits[1:9]
    if parity != 'none':
        p = sum(data) % 2
        if bits[9] != (p if parity == 'even' else 1 - p):
            return None
    return sum(b << i for i, b in enumerate(data))
`,
    cases: [
      { call: 'uart_frame(0x41, "none")' }, { call: 'uart_frame(0x41, "even")' }, { call: 'uart_frame(0xFF, "odd")' },
      { call: 'uart_decode(uart_frame(0x5A, "even"), "even")' },
      { call: 'uart_decode([0,1,0,0,0,0,0,1,0,1,1], "even")', hidden: true },
      { call: 'uart_decode([1,1,0,0,0,0,0,1,0,1], "none")', hidden: true },
      { call: 'uart_decode([0,1,0,0,0,0,0,1,0], "none")', hidden: true },
      { call: 'uart_decode(uart_frame(200, "odd"), "none")', hidden: true },
    ],
  }),
};

// ------------------------------------------------------------------ boss missions (randomized)

const bossLog: CodeLevel = {
  id: 'code-boss-py-log', title: 'Boss: the log summarizer', concept: 'parsing an unfamiliar format and summarizing it', xp: 320, tier: 'boss', lang: 'py',
  ticket: 'A new simulator, a new log format, a ticket asking for numbers by Monday. No hints.',
  build: (r: Rng) => {
    const v = pick(r, ['A', 'B', 'C']);
    const mods = ['alu', 'lsu', 'ifu', 'dcache', 'rob', 'tlb'];
    const msgs = ['ok', 'timeout', 'parity mismatch', 'queue full, dropping', 'stuck at 0', 'reset released'];
    const levels = ['INFO', 'WARN', 'ERROR', 'INFO', 'ERROR'];
    const mk = (n: number) => Array.from({ length: n }, (_, i) => {
      const t = 10 * (i + 1) + between(r, 0, 9), lv = pick(r, levels), m = pick(r, mods), msg = pick(r, msgs);
      return v === 'A' ? `${t}ns ${lv} ${m}: ${msg}` : v === 'B' ? `${lv},${m},${t},${msg}` : `t=${t} lvl=${lv} mod=${m} msg=${msg}`;
    });
    const fmtDoc = v === 'A' ? '<code>&lt;time&gt;ns &lt;LEVEL&gt; &lt;module&gt;: &lt;message&gt;</code>, e.g. <code>130ns ERROR alu: timeout</code>'
      : v === 'B' ? '<code>LEVEL,module,time,message</code> (comma separated; the message itself may contain commas), e.g. <code>ERROR,alu,130,queue full, dropping</code>'
        : '<code>t=&lt;time&gt; lvl=&lt;LEVEL&gt; mod=&lt;module&gt; msg=&lt;message&gt;</code>, e.g. <code>t=130 lvl=ERROR mod=alu msg=timeout</code>';
    const parseBody = v === 'A'
      ? `        t, lv, rest = line.split(' ', 2)\n        mod = rest.split(':')[0]\n        t = int(t[:-2])`
      : v === 'B'
        ? `        lv, mod, t, _ = line.split(',', 3)\n        t = int(t)`
        : `        parts = line.split(' ', 3)\n        t = int(parts[0][2:])\n        lv = parts[1][4:]\n        mod = parts[2][4:]`;
    const solution = `def summarize(lines):
    errors = 0
    first = None
    mods = set()
    for line in lines:
${parseBody}
        if lv == 'ERROR':
            errors += 1
            if first is None or t < first:
                first = t
            mods.add(mod)
    return {'errors': errors, 'first_error_ns': first, 'modules': sorted(mods)}
`;
    const lists = [mk(6), mk(12), mk(1), mk(25)];
    return {
      brief: `<p>The new simulator logs one line per event in this format: ${fmtDoc}.</p>
<p>Write <code>summarize(lines)</code> (a list of strings) returning <code>{'errors': n, 'first_error_ns': t, 'modules': [...]}</code>: how many <code>ERROR</code> lines, the earliest time of an error (<code>None</code> if there are none), and the sorted list of distinct modules that logged an error.</p>`,
      starter: 'def summarize(lines):\n    return {}\n',
      hints: [],
      solution,
      cases: [
        ...lists.map((l, i) => ({ call: `summarize(${JSON.stringify(l)})`, hidden: i > 0 })),
        { call: 'summarize([])', hidden: true },
      ],
    };
  },
};

const bossGraph: CodeLevel = {
  id: 'code-boss-py-graph', title: 'Boss: the critical path', concept: 'dynamic programming over a dependency graph', xp: 340, tier: 'boss', lang: 'py',
  ticket: 'How long will the build take with unlimited machines? The answer is the longest chain of dependent jobs. No hints.',
  build: (r: Rng) => {
    const mkTasks = (n: number) => {
      const names = Array.from({ length: n }, (_, i) => `t${i}`);
      const tasks: Record<string, [number, string[]]> = {};
      names.forEach((nm, i) => {
        const deps: string[] = [];
        for (let j = 0; j < i; j++) if (r() < 0.25) deps.push(names[j]);
        tasks[nm] = [between(r, 1, 9), deps];
      });
      return tasks;
    };
    const lit = (t: Record<string, [number, string[]]>) => '{' + Object.entries(t).map(([k, [d, deps]]) => `${q(k)}: (${d}, ${JSON.stringify(deps)})`).join(', ') + '}';
    const t1 = mkTasks(5), t2 = mkTasks(9), t3 = mkTasks(15), t4 = mkTasks(40);
    return {
      brief: `<p>Jobs are described by a dict <code>tasks</code> mapping a job name to <code>(duration, [prerequisites])</code>. A job starts when all its prerequisites have finished; there are unlimited machines.</p>
<p>Write <code>makespan(tasks)</code> returning when the last job finishes, and <code>critical(tasks)</code> returning the list of job names on one longest chain, from first to last (if several chains tie, the one whose last job has the alphabetically smallest name; among a job's prerequisites prefer the alphabetically smallest on ties). Prerequisites always have the smaller index in the name, so there are no cycles.</p>`,
      starter: 'def makespan(tasks):\n    return 0\n\ndef critical(tasks):\n    return []\n',
      hints: [],
      solution: `def finish_times(tasks):
    memo = {}
    best = {}
    def f(t):
        if t in memo:
            return memo[t]
        dur, deps = tasks[t]
        start = 0
        prev = None
        for d in sorted(deps):
            if f(d) > start:
                start = f(d)
                prev = d
        memo[t] = start + dur
        best[t] = prev
        return memo[t]
    for t in tasks:
        f(t)
    return memo, best

def makespan(tasks):
    memo, _ = finish_times(tasks)
    return max(memo.values()) if memo else 0

def critical(tasks):
    memo, best = finish_times(tasks)
    if not memo:
        return []
    end = min(memo, key=lambda t: (-memo[t], t))
    path = []
    while end is not None:
        path.append(end)
        end = best[end]
    return path[::-1]
`,
      cases: [t1, t2, t3, t4].flatMap((t, i) => [{ call: `makespan(${lit(t)})`, hidden: i > 1 }, { call: `critical(${lit(t)})`, hidden: i > 0 }]).concat([{ call: 'makespan({})', hidden: true }]),
    };
  },
};

const bossRoot: CodeLevel = {
  id: 'code-boss-py-root', title: 'Boss: find the operating point', concept: 'bracketing and bisection on an arbitrary function', xp: 320, tier: 'boss', lang: 'py',
  ticket: 'The bias point is where a nonlinear equation crosses zero. Find it for whatever function the designer hands you. No hints.',
  build: (r: Rng) => {
    const fs = [
      () => { const a = between(r, 2, 9), b = between(r, 1, 20); return { src: `lambda x: ${a} * x ** 3 - ${b}`, lo: 0, hi: 5 }; },
      () => { const a = between(r, 1, 5); return { src: `lambda x: math.exp(x) - ${a + 2}`, lo: -1, hi: 4 }; },
      () => { const a = between(r, 1, 9) / 10; return { src: `lambda x: math.cos(x) - ${a}`, lo: 0, hi: 3 }; },
      () => { const a = between(r, 2, 50); return { src: `lambda x: x * x - ${a}`, lo: 0, hi: 10 }; },
    ];
    const cases = Array.from({ length: 5 }, (_, i) => { const f = pick(r, fs)(); return { call: `solve(${f.src}, ${f.lo}, ${f.hi})`, pre: 'import math', tol: 1e-6, hidden: i > 1 }; });
    return {
      brief: `<p>Write <code>solve(f, lo, hi)</code>: return an <code>x</code> in <code>[lo, hi]</code> where <code>f(x)</code> is zero, to within 1e-6 of the true root. You are guaranteed that <code>f(lo)</code> and <code>f(hi)</code> have opposite signs, and that <code>f</code> is continuous with exactly one root in the interval.</p>
<p>You have at most a few thousand calls of <code>f</code> per test.</p>`,
      starter: 'def solve(f, lo, hi):\n    return lo\n',
      hints: [],
      solution: `def solve(f, lo, hi):
    flo = f(lo)
    for _ in range(100):
        mid = (lo + hi) / 2
        fm = f(mid)
        if (fm < 0) == (flo < 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2
`,
      cases,
      maxSteps: 400_000,
    };
  },
};

export const PY_LEVELS: CodeLevel[] = [parse, hist, triage, regfield, fibmemo, bsearch, gridBfs, topo, lru, newton, simpson, mc, lfsr, uart, bossLog, bossGraph, bossRoot];

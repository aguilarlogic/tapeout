// Practice banks and bosses for systems software: C, C++, algorithms, assembly and operating systems.
import { hexa, num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { exact, hex, mcs, shuffle, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';

// ------------------------------------------------------------------ C

const CTYPES = [['char', 1], ['short', 2], ['int', 4], ['double', 8], ['char *', 8], ['uint16_t', 2], ['uint32_t', 4], ['uint64_t', 8]] as const;
function structLayout(fields: (typeof CTYPES)[number][]) {
  let off = 0, align = 1;
  for (const [, s] of fields) { off = Math.ceil(off / s) * s; off += s; align = Math.max(align, s); }
  return Math.ceil(off / align) * align;
}

export const cPractice = practice('practice-c', 'C Drills', 'pointers, struct layout, bit idioms, integer rules, endianness', [
  (r, d) => {
    const n = tier(d, 2, 3, 4);
    const fields = Array.from({ length: n }, () => pick(r, CTYPES));
    const size = structLayout(fields);
    return ask(`On a 64-bit machine with natural alignment:${code(`struct s {\n${fields.map(([t], i) => `    ${t} f${i};`).join('\n')}\n};`)}What is sizeof(struct s)?`, num(size), `Each field starts at a multiple of its own size, and the struct is padded to a multiple of its largest member. Total: ${size} bytes. Ordering fields from largest to smallest minimizes padding, which matters for register maps and packet formats.`, 'Place fields one by one, padding each to its alignment, then pad the end.');
  },
  (r, d) => {
    if (d < 3) {
      const a = Array.from({ length: 6 }, () => between(r, 1, 99));
      const i = between(r, 0, 3), j = between(r, 0, 2);
      const e = d === 1 ? `*(p + ${j})` : `p[${j}] + *(a + ${i + j >= 5 ? 0 : i + j + 1})`;
      const v = d === 1 ? a[i + j] : a[i + j] + a[i + j >= 5 ? 0 : i + j + 1];
      return ask(`${code(`int a[6] = {${a.join(', ')}};\nint *p = a + ${i};\nprintf("%d", ${e});`)}Output?`, num(v), `p points at a[${i}], so p[k] and *(p + k) are a[${i} + k]. Answer: ${v}.`, 'Pointer + k moves k elements, not k bytes.');
    }
    const row = between(r, 0, 2), col = between(r, 0, 3), k = row * 4 + col;
    return ask(`${code(`int m[3][4];  /* m[r][c] = 10*r + c */\nint *p = &m[0][0];\nprintf("%d", p[${k}]);`)}Output?`, num(10 * row + col), `C arrays are row-major: p[${k}] is m[${k} / 4][${k} % 4] = m[${row}][${col}] = ${10 * row + col}.`, 'Row-major: index = r × columns + c.');
  },
  (r, d) => {
    let v = between(r, 0, 255);
    const start = v;
    const ops: string[] = [];
    const steps = tier(d, 1, 2, 3);
    for (let s = 0; s < steps; s++) {
      const b = between(r, 0, 7);
      const k = pick(r, [0, 1, 2]);
      if (k === 0) { v |= 1 << b; ops.push(`reg |= (1u << ${b});`); }
      else if (k === 1) { v &= ~(1 << b) & 0xff; ops.push(`reg &= ~(1u << ${b});`); }
      else { v ^= 1 << b; ops.push(`reg ^= (1u << ${b});`); }
    }
    return ask(`${code(`uint8_t reg = ${hex(start)};\n${ops.join('\n')}`)}Final value of reg (hex)?`, hexa(v, 2), `Set (|=), clear (&= ~) and toggle (^=) bits one at a time: ${hex(start)} → ${hex(v)}. These three idioms are half of every device driver.`, 'Work in binary, one line at a time.');
  },
  (r, d) => {
    const a = between(r, 150, 250), b = between(r, 60, 200);
    const variants = [
      [1, `uint8_t x = ${a};\nx = x + ${b};\nprintf("%u", x);`, (a + b) & 255, `uint8_t wraps modulo 256: ${a + b} → ${(a + b) & 255}.`],
      [1, `printf("%d", -${a % 20 + 7} / 2);`, Math.trunc(-(a % 20 + 7) / 2), `C integer division truncates toward zero: ${Math.trunc(-(a % 20 + 7) / 2)} (Python would give ${Math.floor(-(a % 20 + 7) / 2)}).`],
      [2, `printf("%d", -${a % 20 + 7} % 3);`, -((a % 20 + 7) % 3), `In C the remainder takes the sign of the dividend: ${-((a % 20 + 7) % 3)} (Python: ${(((-(a % 20 + 7)) % 3) + 3) % 3}).`],
      [2, `uint8_t x = ${a}, y = ${b};\nint z = x + y;\nprintf("%d", z);`, a + b, `Integer promotion: uint8_t operands are promoted to int before adding, so no wrap: ${a + b}. Only storing back into a uint8_t would truncate.`],
      [3, `uint8_t x = ${b % 100 + 5};\nuint8_t y = ${b % 100 + 10};\nprintf("%d", x - y);`, -5, 'Both promote to int, so x - y = -5, not 251. Classic surprise in firmware.'],
      [3, `uint32_t x = 0;\nx = x - 1;\nprintf("%u", x >> 28);`, 15, 'Unsigned arithmetic wraps: 0 - 1 = 0xFFFFFFFF, and >> 28 leaves 0xF = 15. (Signed overflow, by contrast, is undefined behaviour.)'],
    ] as const;
    const [, src, v, why] = pick(r, variants.filter((x) => x[0] === d));
    return ask(`${code(src)}Output?`, num(v), why, 'Watch the types: width, signedness and promotion.');
  },
  (r, d) => {
    const v = between(r, 0x10000000, 0x7fffffff);
    const k = between(r, 0, 3);
    const little = d < 3 || r() < 0.5;
    const byte = little ? (v >>> (8 * k)) & 0xff : (v >>> (8 * (3 - k))) & 0xff;
    return ask(`The 32-bit value ${hex(v, 8)} is stored at address 0x1000 on a ${little ? 'little' : 'big'}-endian machine. What byte is at address 0x100${k}? (hex)`, hexa(byte, 2), `${little ? 'Little-endian stores the least significant byte first' : 'Big-endian stores the most significant byte first'}: byte ${k} is ${hex(byte)}. Network protocols are big-endian; x86, ARM and RISC-V are little-endian.`, little ? 'Address + 0 holds the lowest byte.' : 'Address + 0 holds the highest byte.');
  },
  (r) => {
    const bugs = [
      ['int *make(void) { int x = 5; return &x; }', 'Returns a pointer to a local variable, which dies when the function returns'],
      ['uint32_t *status = (uint32_t *)0x40000000;\nwhile (*status == 0) {}', 'Missing volatile: the compiler may read the register once and loop forever'],
      ['char buf[8];\nstrcpy(buf, "overflowing");', 'Buffer overflow: the string needs 12 bytes including the terminator'],
      ['for (int i = 0; i <= 10; i++) a[i] = 0;  /* int a[10] */', 'Off-by-one: writes a[10], one past the end'],
      ['free(p);\nprintf("%d", p->len);', 'Use after free'],
      ['if (x & 1 == 0) even();', 'Precedence: == binds tighter than &, so this is x & (1 == 0), always 0'],
    ] as const;
    const i = between(r, 0, bugs.length - 1);
    const others = shuffle(r, bugs.filter((_, j) => j !== i).map((b) => b[1])).slice(0, 3);
    return mcs(r, `What is wrong with this C?${code(bugs[i][0])}`, bugs[i][1], others, `${bugs[i][1]}. Every one of these has shipped in real firmware.`);
  },
]);

// ------------------------------------------------------------------ C++

export const cppPractice = practice('practice-cpp', 'C++ Drills', 'virtual dispatch, object lifetime, smart pointers, templates, containers', [
  (r, d) => {
    const virt = d === 1 ? true : r() < 0.6;
    const how = d === 3 ? pick(r, ['pointer', 'value', 'reference']) : 'pointer';
    const call = how === 'pointer' ? 'Base *b = new Derived; std::cout << b->name();' : how === 'reference' ? 'Derived d; Base &b = d; std::cout << b.name();' : 'Derived d; Base b = d; std::cout << b.name();';
    const out = virt && how !== 'value' ? 'Derived' : 'Base';
    return ask(`${code(`struct Base    { ${virt ? 'virtual ' : ''}std::string name() const { return "Base"; } };\nstruct Derived : Base { std::string name() const ${virt ? 'override ' : ''}{ return "Derived"; } };\n\n${call}`)}What is printed?`, exact(out), !virt ? 'name() is not virtual, so the call is bound at compile time by the static type Base: "Base".' : how === 'value' ? 'Copying a Derived into a Base object slices it: only the Base part survives, so "Base" even with virtual.' : 'A virtual call through a pointer or reference dispatches on the dynamic type: "Derived".', 'Is the function virtual? Is the call through a pointer/reference or a copy?');
  },
  (r, d) => {
    const extra = between(r, 1, 3), inner = between(r, 0, 2);
    const lines = ['auto a = std::make_shared<Txn>();', ...Array.from({ length: extra }, (_, i) => `auto b${i} = a;`), '{', ...Array.from({ length: inner }, (_, i) => `    auto c${i} = a;`), '}'];
    if (d === 3) lines.push('b0.reset();');
    const count = 1 + extra - (d === 3 ? 1 : 0);
    return ask(`${code(`${lines.join('\n')}\nstd::cout << a.use_count();`)}Output?`, num(count), `Each shared_ptr copy adds one owner; copies inside the braces die at the closing brace${d === 3 ? '; reset() drops b0\'s ownership' : ''}. Count: ${count}. The object is freed when the count reaches 0.`, 'Count the live shared_ptr copies at the print.');
  },
  (r, d) => {
    const n = between(r, tier(d, 2, 4, 5), tier(d, 4, 6, 8));
    const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
    const fib = (k: number): number => (k < 2 ? k : fib(k - 1) + fib(k - 2));
    const useFib = d >= 2 && r() < 0.5;
    const src = useFib
      ? `template <int N> struct F { static constexpr int v = F<N-1>::v + F<N-2>::v; };\ntemplate <> struct F<0> { static constexpr int v = 0; };\ntemplate <> struct F<1> { static constexpr int v = 1; };\n\nstd::cout << F<${n + 3}>::v;`
      : `template <int N> struct F { static constexpr int v = N * F<N-1>::v; };\ntemplate <> struct F<0> { static constexpr int v = 1; };\n\nstd::cout << F<${n}>::v;`;
    const v = useFib ? fib(n + 3) : fact(n);
    return ask(`${code(src)}Output? (computed entirely at compile time)`, num(v), `The compiler instantiates F<N> recursively until the specialization stops it: ${useFib ? `Fibonacci(${n + 3})` : `${n}!`} = ${v}. Template metaprogramming like this generates lookup tables in hardware models.`, 'Unroll the recursion by hand.');
  },
  (r) => {
    const perm = shuffle(r, ['A', 'B', 'C']);
    const dtor = pick(r, [true, false]);
    const out = dtor ? [...perm].reverse().map((x) => x.toLowerCase()).join('') : perm.join('');
    return ask(`Each member prints its letter in its constructor (capital) and destructor (lower case).${code(`struct Top {\n${perm.map((m) => `    ${m} ${m.toLowerCase()}_;`).join('\n')}\n};\n{ Top t; }   // construct, then destroy`)}What do the ${dtor ? 'destructors' : 'constructors'} print, in order?`, exact(out), `Members are constructed in declaration order (${perm.join('')}) and destroyed in reverse (${[...perm].reverse().map((x) => x.toLowerCase()).join('')}), regardless of the initializer list order. RAII relies on this.`, 'Declaration order, then reversed.');
  },
  (r) => {
    const qs = [
      ['Look up cells by name millions of times; order never matters. Best container?', 'std::unordered_map (hash table, O(1) average)', ['std::map (tree, O(log n))', 'std::vector with linear search', 'std::list']],
      ['A simulator needs "give me the earliest pending event" repeatedly. Best container?', 'std::priority_queue (a binary heap)', ['std::vector sorted after every insert', 'std::unordered_set', 'std::stack']],
      ['Store a million transactions and iterate them in order, appending at the end. Best container?', 'std::vector (contiguous, cache-friendly, amortized O(1) push_back)', ['std::list', 'std::map', 'std::deque of deques']],
      ['Keep coverage bins sorted by name so reports print in order. Best container?', 'std::map (ordered by key)', ['std::unordered_map', 'std::stack', 'std::priority_queue']],
      ['Which smart pointer for a single, exclusive owner?', 'std::unique_ptr (zero overhead, move-only)', ['std::shared_ptr', 'A raw pointer with delete in every path', 'std::weak_ptr']],
      ['What does std::move(v) actually do?', 'Casts v to an rvalue so a move constructor can steal its buffer; it moves nothing by itself', ['Copies v', 'Deletes v', 'Moves v to the heap']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ data structures & algorithms

function dag(r: Rng, n: number) {
  const edges: [number, number, number][] = [];
  for (let v = 1; v < n; v++) {
    const preds = shuffle(r, Array.from({ length: v }, (_, i) => i)).slice(0, Math.min(v, between(r, 1, 2)));
    for (const u of preds) edges.push([u, v, between(r, 1, 9)]);
  }
  const at = Array(n).fill(0);
  for (const [u, v, w] of edges.sort((a, b) => a[1] - b[1] || a[0] - b[0])) at[v] = Math.max(at[v], at[u] + w);
  return { edges, at };
}

/** Two different numbers in 0..n-1. */
function pair(r: Rng, n: number): [number, number] {
  const a = between(r, 0, n - 1);
  let b = between(r, 0, n - 2);
  if (b >= a) b++;
  return [a, b];
}

export const dsaPractice = practice('practice-dsa', 'Algorithm Drills', 'complexity, graphs, longest paths, hashing, bit tricks', [
  (r, d) => {
    const n = pick(r, tier(d, [7, 15, 100], [1000, 1e6, 5000], [1e9, 3e7, 65536]));
    const k = Math.floor(Math.log2(n)) + 1;
    return ask(`Binary search over ${n.toLocaleString('en-US')} sorted items: worst-case number of comparisons?`, num(k), `floor(log2(${n})) + 1 = ${k}. A billion items in about 30 steps: that is the power of O(log n).`, 'Each comparison halves the range.');
  },
  (r, d) => {
    const n = tier(d, 4, 5, 7);
    const { edges, at } = dag(r, n);
    const names = 'ABCDEFGH'.slice(0, n).split('');
    return ask(`A timing graph (edge delays in ps):${code(edges.map(([u, v, w]) => `${names[u]} -> ${names[v]}  ${w}`).join('\n'))}Arrival at A is 0. Latest arrival time at ${names[n - 1]}?`, num(at[n - 1]), `Process nodes in topological order, taking the max over incoming edges: ${names.map((x, i) => `${x}=${at[i]}`).join(', ')}. Linear time in the graph size, with no path enumeration: this is how STA works.`, 'Longest path in a DAG: max over predecessors, in topological order.');
  },
  (r, d) => {
    const n = pick(r, tier(d, [10, 100], [1000, 50], [1e4, 2000]));
    const variants = [
      [1, `for (i = 0; i < n; i++)\n  for (j = 0; j < n; j++)\n    work();`, n * n],
      [2, `for (i = 0; i < n; i++)\n  for (j = 0; j < i; j++)\n    work();`, (n * (n - 1)) / 2],
      [3, `for (i = 1; i < n; i *= 2)\n  for (j = 0; j < n; j++)\n    work();`, Math.ceil(Math.log2(n)) * n],
    ] as const;
    const [, src, v] = pick(r, variants.filter((x) => x[0] === d));
    return ask(`With n = ${n}, how many times is work() called?${code(src)}`, num(v), d === 1 ? `Two nested loops of n each: n² = ${v}. O(n²).` : d === 2 ? `0 + 1 + … + (n-1) = n(n-1)/2 = ${v}: still O(n²).` : `The outer loop runs ceil(log2 n) = ${Math.ceil(Math.log2(n))} times: ${v} calls, O(n log n).`, 'Count the outer iterations, then the inner work per iteration.');
  },
  (r, d) => {
    const x = between(r, 1, tier(d, 255, 4095, 65535));
    const pc = x.toString(2).split('').filter((c) => c === '1').length;
    const variants = [
      [1, `popcount(${hex(x, 1)}) (number of 1 bits)`, pc, `${x.toString(2)} has ${pc} ones.`],
      [2, `${hex(x, 1)} & (${hex(x, 1)} - 1)`, x & (x - 1), `x & (x-1) clears the lowest set bit: ${x.toString(2)} → ${(x & (x - 1)).toString(2)} = ${x & (x - 1)}. x & (x-1) == 0 tests for a power of two.`],
      [3, `${hex(x, 1)} & -${hex(x, 1)}  (two's complement)`, x & -x, `x & -x isolates the lowest set bit: ${x & -x}. Priority arbiters in RTL use the same trick.`],
    ] as const;
    const [, e, v, why] = pick(r, variants.filter((q) => q[0] === d));
    return ask(`What is ${e}, in decimal?`, num(v), why, 'Write it in binary.');
  },
  (r, d) => {
    const n = tier(d, 5, 7, 9);
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const unions = Array.from({ length: tier(d, 2, 4, 6) }, () => pair(r, n));
    for (const [a, b] of unions) parent[find(a)] = find(b);
    const comps = new Set(Array.from({ length: n }, (_, i) => find(i))).size;
    return ask(`${n} nets, numbered 0-${n - 1}. These pairs are shorted together: ${unions.map(([a, b]) => `${a}-${b}`).join(', ')}. How many electrically separate groups remain?`, num(comps), `Union-find merges each pair's groups: ${comps} groups. LVS and short-checking tools use exactly this structure on billions of shapes.`, 'Merge sets pair by pair; count the survivors.');
  },
  (r) => {
    const qs = [
      ['Detect a combinational loop in a netlist. Algorithm?', 'Depth-first search looking for a back edge (or a failed topological sort)', ['Dijkstra', 'Binary search', 'Quicksort']],
      ['Route a wire through a grid with obstacles by shortest path. Classic algorithm?', 'BFS / Lee maze routing (or A* with a heuristic)', ['Bubble sort', 'Union-find', 'Huffman coding']],
      ['Merge identical gates during logic synthesis. Data structure?', 'A hash table keyed by (gate type, inputs): structural hashing', ['A linked list', 'A stack', 'A priority queue']],
      ['An event-driven simulator must always process the earliest event next. Data structure?', 'A priority queue (heap) or a timing wheel', ['A FIFO only', 'A sorted array re-sorted each time', 'A hash set']],
      ['T(n) = 2T(n/2) + n solves to?', 'O(n log n)', ['O(n)', 'O(n²)', 'O(log n)']],
      ['Which problem is NP-complete, so EDA uses heuristics for it?', 'Optimal placement / graph partitioning', ['Sorting', 'Shortest path with positive weights', 'Topological sort']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
]);

// ------------------------------------------------------------------ RISC-V assembly

const R = ['t0', 't1', 't2'];
function runAsm(r: Rng, len: number) {
  const regs: Record<string, number> = { t0: between(r, 1, 20), t1: between(r, 1, 20), t2: 0 };
  const lines = [`li t0, ${regs.t0}`, `li t1, ${regs.t1}`];
  for (let i = 0; i < len; i++) {
    const rd = pick(r, R), rs = pick(r, R), rt = pick(r, R);
    const op = pick(r, ['addi', 'add', 'sub', 'slli', 'srai', 'andi', 'ori', 'xori']);
    const imm = op === 'slli' || op === 'srai' ? between(r, 1, 3) : between(r, -8, 15);
    let v: number;
    if (op === 'addi') v = regs[rs] + imm;
    else if (op === 'add') v = regs[rs] + regs[rt];
    else if (op === 'sub') v = regs[rs] - regs[rt];
    else if (op === 'slli') v = regs[rs] << imm;
    else if (op === 'srai') v = regs[rs] >> imm;
    else if (op === 'andi') v = regs[rs] & imm;
    else if (op === 'ori') v = regs[rs] | imm;
    else v = regs[rs] ^ imm;
    regs[rd] = v | 0;
    lines.push(['add', 'sub'].includes(op) ? `${op} ${rd}, ${rs}, ${rt}` : `${op} ${rd}, ${rs}, ${imm}`);
  }
  return { lines, regs };
}

export const asmPractice = practice('practice-asm', 'RISC-V Drills', 'execute RV32I by hand, immediates, loads, calling convention', [
  (r, d) => {
    const { lines, regs } = runAsm(r, tier(d, 2, 4, 6));
    const reg = pick(r, R);
    return ask(`${code(lines.join('\n'))}Final value of ${reg} (signed decimal)?`, num(regs[reg]), `Step through it: t0 = ${regs.t0}, t1 = ${regs.t1}, t2 = ${regs.t2}. andi/ori/xori sign-extend their 12-bit immediate; srai keeps the sign.`, 'Track all three registers line by line.');
  },
  (r, d) => {
    const n = between(r, 2, tier(d, 5, 10, 20)), k = between(r, 1, 5);
    const src = d < 3 ? `    li   t0, ${n}\n    li   t1, 0\nloop:\n    addi t1, t1, ${k}\n    addi t0, t0, -1\n    bnez t0, loop` : `    li   t0, 0\n    li   t1, 0\n    li   t2, ${n}\nloop:\n    add  t1, t1, t0\n    addi t0, t0, 1\n    blt  t0, t2, loop`;
    const v = d < 3 ? n * k : (n * (n - 1)) / 2;
    return ask(`${code(src)}Value of t1 after the loop?`, num(v), d < 3 ? `The loop runs ${n} times, adding ${k} each time: ${v}.` : `t1 = 0 + 1 + … + ${n - 1} = ${v}.`, 'How many iterations, and what does each add?');
  },
  (r, d) => {
    const c = d === 1 ? between(r, 1, 0xfffff) << 12 : d === 2 ? (between(r, 0x10000, 0x7ffff) << 12) | between(r, 0, 0x7ff) : (between(r, 0x10000, 0x7ffff) << 12) | between(r, 0x800, 0xfff);
    const hi = ((c + 0x800) >>> 12) & 0xfffff;
    const lo = c - (hi << 12);
    return ask(`To load ${hex(c >>> 0, 8)} into a0 you write \`lui a0, X\` then \`addi a0, a0, Y\`. What is X (hex)?`, hexa(hi, 5), `addi sign-extends its 12-bit immediate. Low 12 bits = ${hex(c & 0xfff, 3)}${(c & 0x800) ? `, which is negative as a 12-bit value (${lo}), so lui must add one: X = ${hex(hi, 5)}` : `, positive, so X is just the upper 20 bits: ${hex(hi, 5)}`}, Y = ${lo}. The assembler's \`li\` does this for you, but every toolchain bug hunter learns it.`, 'Is bit 11 of the constant set? If so, round the upper part up.');
  },
  (r, d) => {
    const w = between(r, 0x10000000, 0xffffffff) >>> 0;
    const off = between(r, 0, 3);
    const byte = (w >>> (8 * off)) & 0xff;
    const variants = [
      [1, `lbu t1, ${off}(sp)`, byte, 'lbu zero-extends the byte.'],
      [2, `lb  t1, ${off}(sp)`, byte >= 128 ? byte - 256 : byte, 'lb sign-extends: a byte ≥ 0x80 becomes negative.'],
      [3, `lh  t1, ${off & 2}(sp)`, (() => { const h = (w >>> (8 * (off & 2))) & 0xffff; return h >= 0x8000 ? h - 0x10000 : h; })(), 'lh loads 16 bits little-endian and sign-extends.'],
    ] as const;
    const [, ins, v, why] = pick(r, variants.filter((x) => x[0] === d));
    return ask(`${code(`li  t0, ${hex(w, 8)}\nsw  t0, 0(sp)\n${ins}`)}Value of t1 (signed decimal)? RISC-V is little-endian.`, num(v), `Byte 0 is the least significant. ${why} t1 = ${v}.`, 'Find the byte(s) at that offset, then extend.');
  },
  (r) => {
    const qs = [
      ['In the RISC-V calling convention, where do the first arguments and the return value go?', 'a0-a7 for arguments; a0 (and a1) for the return value', ['t0-t6', 's0-s11', 'On the stack only']],
      ['Which registers must a function restore before returning if it uses them?', 's0-s11 (callee-saved) and sp', ['t0-t6', 'a0-a7', 'None']],
      ['What does `jal ra, func` do?', 'Jumps to func and saves the return address (pc + 4) in ra', ['Jumps without returning', 'Loads func into ra', 'Calls the OS']],
      ['What is x0 in RISC-V?', 'A register hard-wired to zero; writes to it are ignored', ['The program counter', 'The stack pointer', 'The return address']],
      ['Why does RISC-V split big constants into lui + addi?', 'Instructions are 32 bits, so an immediate holds at most 20 (lui) or 12 (addi) bits', ['It is faster', 'To save registers', 'Memory is 12 bits wide']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
  (r, d) => {
    const ic = pick(r, [1e9, 2e9, 5e8]), cpi = pick(r, tier(d, [1, 2], [1.2, 1.5, 0.8], [0.6, 1.8, 2.5])), f = pick(r, [1e9, 2e9, 3e9]);
    const t = (ic * cpi) / f;
    return ask(`A program runs ${ic.toExponential(0).replace('e+', 'e')} instructions at CPI = ${cpi} on a ${f / 1e9} GHz core. Run time, in ms?`, qty(t * 1000, 'ms', 0.02), `time = IC × CPI / f = ${sig(t * 1000)} ms. The "iron law": every architecture trick attacks one of these three terms.`, 'time = instructions × CPI / frequency.');
  },
]);

// ------------------------------------------------------------------ operating systems

export const osPractice = practice('practice-os', 'OS Drills', 'paging, TLBs, scheduling, concurrency, I/O', [
  (r, d) => {
    const pageBits = pick(r, tier(d, [12], [12, 14, 16], [12, 21]));
    const va = between(r, 0x10000000, 0x7fffffff);
    const vpn = va >>> pageBits, off = va & ((1 << pageBits) - 1);
    const which = d === 1 ? 'offset' : pick(r, ['page number', 'offset']);
    return ask(`Page size ${2 ** pageBits >= 1 << 20 ? `${2 ** (pageBits - 20)} MB` : `${2 ** (pageBits - 10)} KB`}. For virtual address ${hex(va, 8)}, what is the ${which} (hex)?`, hexa(which === 'offset' ? off : vpn), `${2 ** pageBits} bytes per page → ${pageBits} offset bits. Offset = VA & ${hex((1 << pageBits) - 1, 1)} = ${hex(off, 1)}; page number = VA >> ${pageBits} = ${hex(vpn, 1)}.`, `Low ${pageBits} bits are the offset.`);
  },
  (r, d) => {
    if (d < 3) {
      const vaBits = pick(r, [32, 36]), pageBits = 12, pte = 4;
      const mb = (2 ** (vaBits - pageBits) * pte) / 2 ** 20;
      return ask(`${vaBits}-bit virtual addresses, 4 KB pages, 4-byte page table entries, one flat table. Page table size per process, in MB?`, qty(mb, '', 0.01, String(mb)), `2^(${vaBits}-12) entries × 4 B = ${mb} MB per process, mostly empty. That waste is why page tables are multi-level.`, 'Entries = 2^(VA bits - offset bits).');
    }
    const h = pick(r, [0.9, 0.98, 0.99]), tlb = 1, mem = pick(r, [50, 100]), levels = pick(r, [1, 2, 4]);
    const eat = h * (tlb + mem) + (1 - h) * (tlb + (levels + 1) * mem);
    return ask(`TLB hit rate ${h * 100}%, TLB lookup 1 ns, memory access ${mem} ns, ${levels}-level page table walked on a miss. Effective memory access time, in ns?`, qty(eat, 'ns', 0.02), `hit: 1 + ${mem}; miss: 1 + ${levels} walk accesses + 1 data access = 1 + ${(levels + 1) * mem}. EAT = ${sig(eat)} ns. Page-walk caches and huge pages exist to shrink the miss term.`, 'Weight the hit and miss costs by their probabilities.');
  },
  (r, d) => {
    const bursts = Array.from({ length: tier(d, 3, 4, 4) }, () => between(r, 1, 9));
    if (d < 3) {
      let t = 0, wait = 0;
      for (const b of bursts) { wait += t; t += b; }
      return ask(`Jobs arrive together with CPU bursts ${bursts.join(', ')} ms and run first-come first-served in that order. Average waiting time, in ms?`, qty(wait / bursts.length, 'ms', 0.01, sig(wait / bursts.length)), `Each job waits for all earlier bursts: total ${wait} ms over ${bursts.length} jobs = ${sig(wait / bursts.length)} ms. Shortest-job-first would minimize this.`, 'Job k waits for the sum of bursts before it.');
    }
    const q = pick(r, [2, 3]);
    const rem = [...bursts];
    const done = Array(rem.length).fill(0);
    let t = 0;
    while (rem.some((x) => x > 0)) for (let i = 0; i < rem.length; i++) if (rem[i] > 0) { const s = Math.min(q, rem[i]); t += s; rem[i] -= s; if (!rem[i]) done[i] = t; }
    const j = between(r, 0, bursts.length - 1);
    return ask(`Round-robin with a ${q} ms quantum, jobs J0..J${bursts.length - 1} arrive together with bursts ${bursts.join(', ')} ms (queue order J0 first). When does J${j} finish, in ms?`, num(done[j]), `Simulate the queue in ${q} ms slices: completion times ${done.map((x, i) => `J${i}=${x}`).join(', ')}.`, 'Cycle through the jobs, each running at most one quantum per turn.');
  },
  (r, d) => {
    const p = pick(r, tier(d, [0.5, 0.9], [0.9, 0.95, 0.75], [0.99, 0.95, 0.8])), n = pick(r, tier(d, [2, 4], [8, 16], [64, 1000]));
    const s = 1 / (1 - p + p / n);
    return ask(`${p * 100}% of a program parallelizes perfectly; the rest is serial. Speedup on ${n} cores (Amdahl)?`, qty(s, 'x', 0.02, sig(s)), `1/((1 - ${p}) + ${p}/${n}) = ${sig(s)}×. The limit, with infinite cores, is 1/(1 - ${p}) = ${sig(1 / (1 - p))}×.`, 'Speedup = 1 / (serial + parallel/n).');
  },
  (r) => {
    const qs = [
      ['Two threads each run `counter++` 1000 times with no lock. Final value?', 'Anywhere from about 1000 to 2000, because read-modify-write steps interleave (a race)', ['Always 2000', 'Always 1000', 'The program crashes']],
      ['Thread 1 locks A then B; thread 2 locks B then A. Risk?', 'Deadlock: each can hold one lock and wait forever for the other', ['Starvation only', 'A race on A', 'Nothing, locks are safe']],
      ['A high-priority task waits on a lock held by a low-priority task, which a medium task keeps preempting. Name and fix?', 'Priority inversion; fix with priority inheritance', ['Deadlock; add more locks', 'Thrashing; add RAM', 'A race; use volatile']],
      ['When is a spinlock better than a sleeping mutex?', 'On multicore systems when the lock is held for a very short time', ['Always', 'On single-core systems', 'When the lock is held for seconds']],
      ['What does a page fault on a valid but non-resident page cause?', 'The OS loads the page from disk, updates the page table, and restarts the instruction', ['A crash', 'The process is killed', 'Nothing']],
      ['Moving 10 Gb/s of network data into memory: which I/O method?', 'DMA with interrupts (coalesced), so the CPU is not copying bytes', ['Programmed I/O in a loop', 'Polling every byte', 'Printing each packet']],
    ] as const;
    const [q, right, wrong] = pick(r, qs);
    return mcs(r, q, right, wrong, `${right}.`);
  },
  (r, d) => {
    const period = pick(r, [10, 50, 100]), cost = pick(r, [0.5, 1, 2]);
    if (d < 3) return ask(`A driver polls a device every ${period} µs; each poll costs ${cost} µs of CPU. What % of the CPU does polling burn?`, qty((cost / period) * 100, '%', 0.01, sig((cost / period) * 100)), `${cost}/${period} = ${sig((cost / period) * 100)}%, even when nothing happens. Interrupts cost nothing while idle but have per-event overhead.`, 'Cost per poll / poll period.');
    const rate = pick(r, [1e4, 1e5, 1e6]), ov = pick(r, [2, 5]);
    return ask(`A device raises ${rate.toLocaleString('en-US')} interrupts per second, each costing ${ov} µs of handler time. What % of one CPU goes to interrupt handling?`, qty(rate * ov * 1e-4, '%', 0.01, sig(rate * ov * 1e-4)), `${rate} × ${ov} µs = ${sig(rate * ov * 1e-6)} s per second = ${sig(rate * ov * 1e-4)}%. At high rates, coalescing or polling (NAPI) wins.`, 'Interrupts per second × seconds each.');
  },
]);

export const SYSTEMS_PRACTICE = [cPractice, cppPractice, dsaPractice, asmPractice, osPractice];

// ------------------------------------------------------------------ bosses

export const cBoss = boss({
  id: 'boss-c',
  title: 'The Driver That Hangs',
  concept: 'debug a real device driver: volatile, layout, bits and integer rules',
  xp: 170,
  steps: [
    say('Boss fight, {name}. The bring-up team says the UART driver hangs on first silicon, but works in simulation with the debug build. Here is the code. Exam rules.', 'concerned'),
    art(`typedef struct {
    uint8_t  ctrl;      /* bit 0: enable, bits 3:2: parity */
    uint32_t baud_div;
    uint8_t  status;    /* bit 7: tx_ready */
    uint16_t data;
} uart_regs_t;

uart_regs_t *u = (uart_regs_t *)0x40001000;

void putc(char c) {
    while (!(u->status & 0x80)) {}   /* wait for tx_ready */
    u->data = c;
}`),
    { t: 'gen', make: () => ask('The hardware puts ctrl at offset 0, baud_div at 4, status at 8, data at 10. With natural alignment, at what offset does the compiler put `data`?', num(10), 'ctrl@0, pad to 4, baud_div@4..7, status@8, pad 1, data@10. It matches this time, but register maps should never rely on implicit padding: use explicit offsets or static asserts.') },
    mc('Why does putc hang only in the optimized build?', ['`u` is not declared volatile, so the optimizer reads status once and spins forever on a stale value', 'The baud rate is wrong', 'uint8_t is too small', 'The while loop has no body'], 0, 'Declare the register block `volatile uart_regs_t *u`. The debug build (-O0) happened to reload memory each iteration.'),
    { t: 'gen', make: (r) => { const par = between(r, 0, 3); const start = between(r, 0, 255); const v = (start & ~0x0c) | (par << 2) | 1; return ask(`ctrl currently reads ${hex(start)}. Firmware must set parity = ${par} (bits 3:2) and enable = 1, leaving other bits alone. What value is written (hex)?`, hexa(v & 0xff, 2), `(ctrl & ~0x0C) | (${par} << 2) | 0x01 = ${hex(v & 0xff)}. Clear the field, then OR in the new value.`); } },
    { t: 'gen', make: (r) => { const clk = pick(r, [48e6, 100e6]), baud = pick(r, [115200, 921600]); const div = Math.round(clk / (16 * baud)); return ask(`baud_div = clk / (16 × baud), rounded. With a ${clk / 1e6} MHz clock and ${baud} baud, what is baud_div?`, num(div), `${clk} / (16 × ${baud}) = ${sig(clk / (16 * baud), 5)} → ${div}. Rounding error here is why some baud rates are unreliable on some clocks.`); } },
    { t: 'gen', make: (r) => { const a = between(r, 200, 250); return ask(`A timeout counter is \`uint8_t tries = ${a};\` and the loop does \`tries += 10;\` then \`if (tries < ${a}) give_up();\`. What is tries after one iteration?`, num((a + 10) & 255), `${a} + 10 = ${a + 10} wraps to ${(a + 10) & 255} in a uint8_t, so the driver "gives up" instantly. Use a wider type for counters.`); } },
    mc('The data register is 16 bits but a char is written to it. On this bus, a 16-bit store to offset 10 becomes one bus write. What else could go wrong if data were at an odd offset?', ['A misaligned access: some buses fault or split it into two writes, with side effects on the register', 'Nothing', 'The char is sign-extended into the parity bits', 'The compiler refuses'], 0, 'Device registers must be naturally aligned and accessed at their true width.'),
  ],
  recap: ['volatile for hardware registers.', 'Layout and padding must match the hardware map.', 'Read-modify-write fields with masks.', 'Integer width and wrap-around.'],
});

export const cppBoss = boss({
  id: 'boss-cpp',
  title: 'The Leaky Model',
  concept: 'fix the object model of a C++ transaction-level simulator',
  xp: 170,
  steps: [
    say('Boss fight. The architecture team\'s C++ performance model leaks memory, prints the wrong transaction types, and is too slow. It is yours now. Exam rules.', 'thinking'),
    art(`struct Txn        { std::string kind() const { return "Txn"; } ~Txn() {} };
struct ReadTxn : Txn { std::string kind() const { return "Read"; }
                     std::vector<uint8_t> data; };

std::vector<Txn*> q;
q.push_back(new ReadTxn);
std::cout << q[0]->kind();
delete q[0];`),
    { t: 'gen', make: () => ask('What does `q[0]->kind()` print?', exact('Txn'), 'kind() is not virtual, so the static type Txn decides: "Txn". Make it virtual.') },
    mc('`delete q[0]` runs which destructor(s)?', ['Only ~Txn: ReadTxn\'s vector is never freed (undefined behaviour and a leak), because ~Txn is not virtual', 'Both, in the right order', 'None', 'Only ~ReadTxn'], 0, 'Any class meant to be deleted through a base pointer needs a virtual destructor.'),
    mc('The cleanest way to stop leaking every Txn in the queue?', ['std::vector<std::unique_ptr<Txn>>, so ownership is explicit and destruction automatic (RAII)', 'Call delete in more places', 'Use std::shared_ptr everywhere by default', 'Never free memory; the OS will'], 0, 'unique_ptr expresses single ownership at zero cost.'),
    { t: 'gen', make: (r) => { const k = between(r, 2, 4); return ask(`A scoreboard stores \`std::shared_ptr<Txn> t\`; ${k} checkers each keep a copy, and the queue holds one more. After the queue pops it, what is use_count()?`, num(k + 1), `The original t plus ${k} checker copies: ${k + 1}. (The queue's copy is gone.)`); } },
    mc('Profiling shows 40% of time in std::map<uint64_t, Line> lookups for the cache model, never iterated in order. Fix?', ['Switch to std::unordered_map (O(1) average) or a direct-mapped array indexed by set', 'Use std::list', 'Add more threads', 'Sort the map more often'], 0, 'Tree lookups are O(log n) with pointer chasing; hashing or indexing by set bits is far faster.'),
    { t: 'gen', make: (r) => { const perm = shuffle(r, ['Clock', 'Bus', 'Cache']); return ask(`The model's Top class declares members in the order ${perm.join(', ')}. Cache's constructor needs Bus to exist. In what order are they constructed? (names separated by spaces)`, exact(perm.join(' ')), `Declaration order: ${perm.join(' ')}. ${perm.indexOf('Cache') < perm.indexOf('Bus') ? 'Cache is built before Bus: a use-before-construction bug. Reorder the declarations.' : 'Bus comes first, so it works.'}`); } },
  ],
  recap: ['virtual functions and virtual destructors.', 'unique_ptr for ownership; shared_ptr when shared.', 'Container choice decides performance.', 'Members construct in declaration order.'],
});

export const dsaBoss = boss({
  id: 'boss-dsa',
  title: 'Timing a Billion Gates',
  concept: 'algorithms that make EDA tools scale',
  xp: 170,
  steps: [
    say('Boss fight. You are an EDA engineer. The in-house timing tool takes 3 days on the new chip. Management wants it overnight. Exam rules.', 'thinking'),
    mc('The tool finds the worst path by enumerating every path from inputs to outputs. Why is that hopeless?', ['The number of paths grows exponentially with depth; a longest-path pass in topological order is linear', 'Paths cannot be enumerated', 'It uses too little memory', 'It only works on small chips'], 0, 'A chain of 60 reconvergent stages can have 2⁶⁰ paths. Dynamic programming visits each edge once.'),
    { t: 'gen', make: (r) => { const { edges, at } = dag(r, 6); const names = 'ABCDEF'.split(''); return ask(`Compute the latest arrival at F:${code(edges.map(([u, v, w]) => `${names[u]} -> ${names[v]}  ${w}`).join('\n'))}`, num(at[5]), `Topological order, max over inputs: ${names.map((x, i) => `${x}=${at[i]}`).join(', ')}.`); } },
    { t: 'gen', make: (r) => { const n = pick(r, [1e9, 4e9]); return ask(`The netlist has ${n / 1e9} billion pins. An O(n log n) sort of them does about how many comparisons (n·log2 n), in billions?`, qty((n * Math.log2(n)) / 1e9, '', 0.03, sig((n * Math.log2(n)) / 1e9)), `${n / 1e9}e9 × log2(${n / 1e9}e9) ≈ ${sig((n * Math.log2(n)) / 1e9)} billion. Fine. O(n²) would be ${sig((n * n) / 1e18)}e18: never finishes.`); } },
    mc('After an ECO changes 100 gates, the tool re-times the whole chip. What is the standard fix?', ['Incremental timing: propagate changes only through the fan-out cone of the modified gates', 'Buy a bigger server', 'Skip timing after ECOs', 'Randomly sample paths'], 0, 'Incremental algorithms (with dirty flags in topological order) make interactive closure possible.'),
    { t: 'gen', make: (r) => { const n = 8; const parent = Array.from({ length: n }, (_, i) => i); const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]))); const us = Array.from({ length: 5 }, () => pair(r, 8)); for (const [a, b] of us) parent[find(a)] = find(b); const c = new Set(Array.from({ length: n }, (_, i) => find(i))).size; return ask(`Clock-domain grouping: 8 flops, and these pairs share a clock: ${us.map(([a, b]) => `${a}-${b}`).join(', ')}. How many clock groups?`, num(c), `Union-find: ${c} groups.`); } },
    mc('The tool runs on 64 cores but only gets 5× faster. The profile shows 15% serial code. Is that expected?', ['Yes: Amdahl caps the speedup near 1/(0.15 + 0.85/64) ≈ 5.9×', 'No, it should be 64×', 'No, it should be slower', 'Only with hyperthreading'], 0, 'Parallelizing the serial 15% (levelized parallel propagation) is the only way forward.'),
  ],
  recap: ['Longest path in a DAG is linear.', 'Complexity decides feasibility at billions.', 'Incremental algorithms; union-find; Amdahl.'],
});

export const asmBoss = boss({
  id: 'boss-asm',
  title: 'The Crash Dump',
  concept: 'read RISC-V assembly and registers to find a firmware crash',
  xp: 170,
  steps: [
    say('Boss fight. The boot ROM crashes on some chips. You have a register dump and a disassembly. No source, no debugger. Exam rules.', 'concerned'),
    { t: 'gen', make: (r) => { const { lines, regs } = runAsm(r, 5); return ask(`The checksum routine starts with:${code(lines.join('\n'))}What is t2 afterwards (signed decimal)?`, num(regs.t2), `Traced: t0 = ${regs.t0}, t1 = ${regs.t1}, t2 = ${regs.t2}.`); } },
    { t: 'gen', make: (r) => { const c = (between(r, 0x40000, 0x7ffff) << 12) | between(r, 0x800, 0xfff); const hi = ((c + 0x800) >>> 12) & 0xfffff; return ask(`The ROM loads the peripheral base ${hex(c >>> 0, 8)} with lui + addi. The dump shows lui used X = ${hex(hi - 1, 5)}. What should X be (hex)?`, hexa(hi, 5), `Bit 11 is set, so addi adds a negative number; lui must be rounded up to ${hex(hi, 5)}. A hand-written constant got this wrong: the ROM talks to the wrong address.`); } },
    { t: 'gen', make: (r) => { const w = between(r, 0x80000000, 0xffffffff) >>> 0; const b = w & 0xff; return ask(`A status word ${hex(w, 8)} is stored at 0(a0). The code does \`lb t0, 0(a0)\` then \`bltz t0, error\`. What is t0?`, num(b >= 128 ? b - 256 : b), `Little-endian: byte 0 is ${hex(b)}. lb sign-extends${b >= 128 ? ', so it is negative and the branch to error is taken. The code should have used lbu.' : '; it is positive, so no error branch.'}`); } },
    mc('The dump shows `ra` pointing into the middle of a data table. What most likely happened?', ['A function overwrote its saved return address on the stack (a buffer overflow), then returned into garbage', 'The CPU is broken', 'ra is always random', 'A cache miss'], 0, 'Corrupted saved ra is the signature of stack smashing.'),
    mc('Which registers can you trust to still hold the caller\'s values after a call returns?', ['s0-s11 and sp (callee-saved)', 't0-t6', 'a0-a7', 'All of them'], 0, 'Temporaries and argument registers may be clobbered by the callee.'),
    { t: 'gen', make: (r) => { const ic = pick(r, [2e6, 5e6]), cpi = pick(r, [1.4, 2]), f = pick(r, [100e6, 200e6]); return ask(`The ROM runs ${ic / 1e6}M instructions at CPI ${cpi} on a ${f / 1e6} MHz boot clock. Boot time, in ms?`, qty(((ic * cpi) / f) * 1000, 'ms', 0.02), `${ic} × ${cpi} / ${f} = ${sig(((ic * cpi) / f) * 1000)} ms.`); } },
  ],
  recap: ['Trace registers by hand.', 'lui/addi rounding.', 'lb vs lbu sign extension.', 'Stack corruption shows up as a bad ra.'],
});

export const osBoss = boss({
  id: 'boss-os',
  title: 'The Boot That Froze',
  concept: 'virtual memory, scheduling and concurrency on a new SoC',
  xp: 170,
  steps: [
    say('Boss fight. Linux boots on the new SoC, then freezes under load. The kernel team needs a hardware-aware engineer. Exam rules.', 'concerned'),
    { t: 'gen', make: (r) => { const va = between(r, 0x10000000, 0x7fffffff); return ask(`A fault is reported at virtual address ${hex(va, 8)} with 4 KB pages. What is the virtual page number (hex)?`, hexa(va >>> 12), `VA >> 12 = ${hex(va >>> 12, 1)}.`); } },
    { t: 'gen', make: (r) => { const h = pick(r, [0.95, 0.98]); const eat = h * 101 + (1 - h) * (1 + 4 * 100); return ask(`TLB hit rate ${h * 100}%, TLB 1 ns, DRAM 100 ns, 3-level page walk on a miss. Effective access time, in ns?`, qty(eat, 'ns', 0.02), `${h}·101 + ${sig(1 - h)}·401 = ${sig(eat)} ns. The new SoC's TLB is too small: huge pages would help.`); } },
    mc('Two cores freeze. Core 0 holds the UART lock and waits for the DMA lock; core 1 holds the DMA lock and waits for the UART lock. Fix?', ['Impose a global lock order (always UART before DMA), or merge the locks', 'Add a third lock', 'Make the locks recursive', 'Lower the clock frequency'], 0, 'Deadlock needs a cycle of waits; a fixed acquisition order makes cycles impossible.'),
    { t: 'gen', make: (r) => { const rate = pick(r, [2e5, 5e5]); return ask(`The network driver takes ${rate.toLocaleString('en-US')} interrupts/s at 3 µs each. What % of one core is spent in interrupt handlers?`, qty(rate * 3e-4, '%', 0.01, sig(rate * 3e-4)), `${rate} × 3 µs = ${sig(rate * 3e-6)} s/s = ${sig(rate * 3e-4)}%. Switch to interrupt coalescing or NAPI polling under load.`); } },
    mc('A driver reads a DMA buffer the device just wrote, but sees stale data. The SoC has non-coherent DMA. Why?', ['The CPU cache still holds old lines; the driver must invalidate the buffer\'s cache lines (or map it uncached) before reading', 'The DMA engine is broken', 'volatile was missing', 'The page is swapped out'], 0, 'Without hardware coherence, software cache maintenance is mandatory around DMA.'),
    { t: 'gen', make: (r) => { const p = pick(r, [0.9, 0.95]); return ask(`The boot's parallel init is ${p * 100}% parallel. Speedup on the SoC's 8 cores (Amdahl)?`, qty(1 / (1 - p + p / 8), 'x', 0.02, sig(1 / (1 - p + p / 8))), `1/(${sig(1 - p)} + ${p}/8) = ${sig(1 / (1 - p + p / 8))}×.`); } },
  ],
  recap: ['VPN = VA >> page bits; TLB misses cost page walks.', 'Lock ordering prevents deadlock.', 'Interrupt load; cache maintenance for non-coherent DMA.'],
});

export const SYSTEMS_BOSSES = [cBoss, cppBoss, dsaBoss, asmBoss, osBoss];

// Practice banks and bosses for systems software: C, C++, algorithms, assembly and operating systems.
import { bin, hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, show, sim, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, exact, hex, mcs, shuffle, sig } from './util';

const code = (s: string) => '\n```\n' + s + '\n```\n';

// ------------------------------------------------------------------ C

const CTYPES = [['char', 1], ['short', 2], ['int', 4], ['double', 8], ['char *', 8], ['uint16_t', 2], ['uint32_t', 4], ['uint64_t', 8]] as const;
function structLayout(fields: (typeof CTYPES)[number][]) {
  let off = 0, align = 1;
  for (const [, s] of fields) { off = Math.ceil(off / s) * s; off += s; align = Math.max(align, s); }
  return Math.ceil(off / align) * align;
}

/** C bug spotting: [code, what is wrong, method, idea, [step question, right, wrong]]. */
const C_BUGS = [
  ['int *make(void) { int x = 5; return &x; }', 'Returns a pointer to a local variable, which dies when the function returns', 'lifetime of local variables', 'A local variable lives in the function\'s stack frame, which is reclaimed the moment the function returns. A pointer to it then points at memory that will be reused by the next call: a dangling pointer.', ['After make() returns, what happens to x?', 'Its stack space is reused, so the pointer dangles', ['It stays alive forever', 'It is moved to the heap']]],
  ['uint32_t *status = (uint32_t *)0x40000000;\nwhile (*status == 0) {}', 'Missing volatile: the compiler may read the register once and loop forever', 'volatile and hardware registers', 'A compiler assumes memory only changes when your code changes it, so it may read *status once and keep the value in a register. A hardware status register can change at any time; volatile tells the compiler to re-read it on every access.', ['Nothing in the loop writes *status. A compiler may therefore:', 'Read it once and never re-read it', ['Re-read it every pass', 'Refuse to compile']]],
  ['char buf[8];\nstrcpy(buf, "overflowing");', 'Buffer overflow: the string needs 12 bytes including the terminator', 'buffer sizes and the terminator', 'A C string is its characters plus a final zero byte. strcpy copies until it finds that zero and never checks the destination size, so a longer source runs off the end and corrupts whatever comes next.', ['"overflowing" has 11 letters. With the terminating zero it needs:', '12 bytes, but buf holds 8', ['11 bytes, which fits', '8 bytes, which fits']]],
  ['for (int i = 0; i <= 10; i++) a[i] = 0;  /* int a[10] */', 'Off-by-one: writes a[10], one past the end', 'array bounds', 'An array of 10 has valid indexes 0 to 9. A loop with <= 10 also runs i = 10, writing one element past the end.', ['For int a[10], the last valid index is:', '9', ['10', '11']]],
  ['free(p);\nprintf("%d", p->len);', 'Use after free', 'use after free', 'free(p) gives the memory back to the allocator; p still holds the old address, but the memory may be reused or unmapped. Reading through p afterwards gives garbage or a crash.', ['After free(p), is *p still valid to read?', 'No: the memory has been handed back', ['Yes, until the program ends', 'Yes, but only for ints']]],
  ['if (x & 1 == 0) even();', 'Precedence: == binds tighter than &, so this is x & (1 == 0), always 0', 'operator precedence', 'In C, comparison operators like == bind TIGHTER than bitwise &. So x & 1 == 0 means x & (1 == 0), i.e. x & 0, which is always 0. Parenthesise: (x & 1) == 0.', ['Which binds tighter in C, == or &?', '==', ['&', 'They are equal']]],
] as const;

export const cPractice = practice('practice-c', 'C Drills', 'pointers, struct layout, bit idioms, integer rules, endianness', [
  (r, d) => {
    const n = tier(d, 2, 3, 4);
    const fields = Array.from({ length: n }, () => pick(r, CTYPES));
    const size = structLayout(fields);
    let off = 0, align = 1;
    const starts = fields.map(([, s]) => { off = Math.ceil(off / s) * s; const at = off; off += s; align = Math.max(align, s); return at; });
    return walk(ask(`On a 64-bit machine with natural alignment:${code(`struct s {\n${fields.map(([t], i) => `    ${t} f${i};`).join('\n')}\n};`)}What is sizeof(struct s)?`, num(size), `Each field starts at a multiple of its own size, and the struct is padded to a multiple of its largest member. Total: ${size} bytes. Ordering fields from largest to smallest minimizes padding, which matters for register maps and packet formats.`, 'Place fields one by one, padding each to its alignment, then pad the end.'),
      'struct layout and padding', 'The CPU wants each value at an address that is a multiple of its own size (alignment). So the compiler leaves gaps (padding): each field starts at the next offset that is a multiple of its size. The whole struct is then padded at the end to a multiple of its LARGEST field\'s alignment, so that arrays of the struct stay aligned.',
      ...fields.map(([t, s], i) => count(`f${i} is a ${t} (${s} byte${s > 1 ? 's' : ''}). It starts at the first multiple of ${s} at or after offset ${i === 0 ? 0 : starts[i - 1] + fields[i - 1][1]}:`, `offset of f${i}`, starts[i])),
      count(`The last field ends at offset ${starts[n - 1] + fields[n - 1][1]}. Now round up to a multiple of the largest alignment (${align}). Total size:`, `round up ${starts[n - 1] + fields[n - 1][1]} to a multiple of ${align}`, size));
  },
  (r, d) => {
    if (d < 3) {
      const a = Array.from({ length: 6 }, () => between(r, 1, 99));
      const i = between(r, 0, 3), j = between(r, 0, 2);
      const k2 = i + j >= 5 ? 0 : i + j + 1;
      const e = d === 1 ? `*(p + ${j})` : `p[${j}] + *(a + ${k2})`;
      const v = d === 1 ? a[i + j] : a[i + j] + a[k2];
      return walk(ask(`${code(`int a[6] = {${a.join(', ')}};\nint *p = a + ${i};\nprintf("%d", ${e});`)}Output?`, num(v), `p points at a[${i}], so p[k] and *(p + k) are a[${i} + k]. Answer: ${v}.`, 'Pointer + k moves k elements, not k bytes.'),
        'pointer arithmetic', 'Adding k to a pointer moves it k ELEMENTS (not bytes), so p + k points at the element k places further on. *(p + k) and p[k] mean the same thing: the element k after p. And a + n (an array name) points at element n.',
        show(a.map((x, n) => `a[${n}] = ${x}`).join('\n'), 'the array'),
        count(`p = a + ${i}, so p points at a[${i}]. p[${j}] (same as *(p + ${j})) is a[${i} + ${j}], index:`, `${i} + ${j}`, i + j),
        ...(d === 2 ? [count(`*(a + ${k2}) is a[${k2}]. Add the two values (a[${i + j}] + a[${k2}]):`, `${a[i + j]} + ${a[k2]}`, v)] : [count(`The value of a[${i + j}]:`, `a[${i + j}]`, v)]));
    }
    const row = between(r, 0, 2), col = between(r, 0, 3), k = row * 4 + col;
    return walk(ask(`${code(`int m[3][4];  /* m[r][c] = 10*r + c */\nint *p = &m[0][0];\nprintf("%d", p[${k}]);`)}Output?`, num(10 * row + col), `C arrays are row-major: p[${k}] is m[${k} / 4][${k} % 4] = m[${row}][${col}] = ${10 * row + col}.`, 'Row-major: index = r × columns + c.'),
      'row-major layout', 'A 2-D array in C is stored as one flat run, row after row (row-major). With 4 columns, the row r starts at flat index 4r, and m[r][c] sits at flat index 4r + c. Going backwards from a flat index: the row is index ÷ 4 (rounded down) and the column is the remainder.',
      count(`Flat index ${k}: the row is ${k} ÷ 4, rounded down:`, `${k} / 4`, row),
      count(`The column is the remainder of ${k} ÷ 4:`, `${k} % 4`, col),
      count(`m[${row}][${col}] = 10 × r + c:`, `10 × ${row} + ${col}`, 10 * row + col));
  },
  (r, d) => {
    let v = between(r, 0, 255);
    const start = v;
    const ops: string[] = [];
    const vals: number[] = [];
    const steps = tier(d, 1, 2, 3);
    const bitsAt: number[] = [];
    for (let s = 0; s < steps; s++) {
      const b = between(r, 0, 7);
      bitsAt.push(b);
      const k = pick(r, [0, 1, 2]);
      if (k === 0) { v |= 1 << b; ops.push(`reg |= (1u << ${b});`); }
      else if (k === 1) { v &= ~(1 << b) & 0xff; ops.push(`reg &= ~(1u << ${b});`); }
      else { v ^= 1 << b; ops.push(`reg ^= (1u << ${b});`); }
      vals.push(v);
    }
    return walk(ask(`${code(`uint8_t reg = ${hex(start)};\n${ops.join('\n')}`)}Final value of reg (hex)?`, hexa(v, 2), `Set (|=), clear (&= ~) and toggle (^=) bits one at a time: ${hex(start)} → ${hex(v)}. These three idioms are half of every device driver.`, 'Work in binary, one line at a time.'),
      'set, clear and toggle bits', 'Three idioms change single bits. 1u << n is a mask with only bit n set. reg |= mask SETS that bit (OR with 1). reg &= ~mask CLEARS it (AND with a mask that is 0 at that bit and 1 elsewhere). reg ^= mask TOGGLES it (XOR with 1 flips). Work in binary, bit 0 on the right.',
      show(`${hex(start)} = ${start.toString(2).padStart(8, '0')}`, 'the starting value'),
      ...ops.flatMap((op, i) => [
        step(`\`${op}\` uses the mask 1u << ${bitsAt[i]}. Write that mask in 8-bit binary:`, bin(1 << bitsAt[i], 8), `Bit ${bitsAt[i]} counted from 0 on the right.`),
        step(`After \`${op}\`: write reg in hex`, hexa(vals[i], 2)),
      ]));
  },
  (r, d) => {
    const a = between(r, 150, 250), b = between(r, 60, 200);
    const x5 = a % 20 + 7, y6 = b % 100;
    const variants = [
      [1, `uint8_t x = ${a};\nx = x + ${b};\nprintf("%u", x);`, (a + b) & 255, `uint8_t wraps modulo 256: ${a + b} → ${(a + b) & 255}.`, 'wrap-around of unsigned types', 'An unsigned type with N bits holds 0 to 2^N - 1. If a result is bigger, it wraps: only the low N bits are kept, which is the same as taking the result modulo 2^N. For uint8_t that is modulo 256.', [
        count('The true sum:', `${a} + ${b}`, a + b),
        count('Keep only what fits in 8 bits (take it modulo 256):', `${a + b} mod 256`, (a + b) & 255)]],
      [1, `printf("%d", -${x5} / 2);`, Math.trunc(-x5 / 2), `C integer division truncates toward zero: ${Math.trunc(-x5 / 2)} (Python would give ${Math.floor(-x5 / 2)}).`, 'integer division in C', 'Dividing two ints in C gives an int: the fractional part is thrown away, truncating toward ZERO (so -3.5 becomes -3, not -4).', [
        calc('The exact quotient:', `-${x5} / 2`, -x5 / 2, '', String(-x5 / 2), 0.001),
        choice('C drops the fraction by going toward:', 'Zero', ['Minus infinity', 'The nearest even number']),
        count('So the result is:', `trunc(${-x5 / 2})`, Math.trunc(-x5 / 2))]],
      [2, `printf("%d", -${x5} % 3);`, -(x5 % 3), `In C the remainder takes the sign of the dividend: ${-(x5 % 3)} (Python: ${(((-x5) % 3) + 3) % 3}).`, 'remainder in C', 'In C, a % b is defined so that (a / b) * b + a % b == a, where a / b truncates toward zero. So the remainder always has the SAME SIGN as the dividend a: -7 % 3 is -1.', [
        count('-x / 3 truncated toward zero:', `-${x5} / 3`, Math.trunc(-x5 / 3)),
        count('Remainder = x - (quotient × 3):', `-${x5} - (${Math.trunc(-x5 / 3)} × 3)`, -(x5 % 3))]],
      [2, `uint8_t x = ${a}, y = ${b};\nint z = x + y;\nprintf("%d", z);`, a + b, `Integer promotion: uint8_t operands are promoted to int before adding, so no wrap: ${a + b}. Only storing back into a uint8_t would truncate.`, 'integer promotion', 'In C, arithmetic on anything smaller than int is done in int: both uint8_t values are promoted to int BEFORE the add, so the sum can exceed 255 without wrapping. A wrap only happens if the result is stored back into an 8-bit variable.', [
        choice('Before x + y is computed, the uint8_t values are promoted to:', 'int, so the sum does not wrap', ['uint8_t, so the sum wraps at 256', 'float']),
        count('The sum:', `${a} + ${b}`, a + b)]],
      [3, `uint8_t x = ${y6 + 5};\nuint8_t y = ${y6 + 10};\nprintf("%d", x - y);`, -5, 'Both promote to int, so x - y = -5, not 251. Classic surprise in firmware.', 'promotion with subtraction', 'Small unsigned types are promoted to (signed) int before arithmetic, so a subtraction that goes below zero gives a real negative number. It would only look like 251 if the result were stored back into a uint8_t.', [
        choice('Are x and y promoted to int before the subtraction?', 'Yes, so a negative result is possible', ['No, it stays unsigned 8-bit', 'Only y is promoted']),
        count('The difference:', `${y6 + 5} - ${y6 + 10}`, -5)]],
      [3, `uint32_t x = 0;\nx = x - 1;\nprintf("%u", x >> 28);`, 15, 'Unsigned arithmetic wraps: 0 - 1 = 0xFFFFFFFF, and >> 28 leaves 0xF = 15. (Signed overflow, by contrast, is undefined behaviour.)', 'unsigned wrap and shifts', 'Unsigned arithmetic wraps around: going below 0 comes out at the top of the range, so 0 - 1 is all ones. A right shift by 28 of a 32-bit value keeps just its top 4 bits.', [
        step('0 - 1 wraps. In uint32_t, x is (hex, 8 digits):', hexa(0xffffffff, 8)),
        count('>> 28 leaves the top 4 bits, 1111, as a decimal number:', '0b1111', 15)]],
    ] as const;
    const [, src, v, why, method, idea, beats] = pick(r, variants.filter((x) => x[0] === d));
    return walk(ask(`${code(src)}Output?`, num(v), why, 'Watch the types: width, signedness and promotion.'), method, idea, ...beats);
  },
  (r, d) => {
    const v = between(r, 0x10000000, 0x7fffffff);
    const k = between(r, 0, 3);
    const little = d < 3 || r() < 0.5;
    const byte = little ? (v >>> (8 * k)) & 0xff : (v >>> (8 * (3 - k))) & 0xff;
    const bytes = [24, 16, 8, 0].map((s) => (v >>> s) & 0xff);
    return walk(ask(`The 32-bit value ${hex(v, 8)} is stored at address 0x1000 on a ${little ? 'little' : 'big'}-endian machine. What byte is at address 0x100${k}? (hex)`, hexa(byte, 2), `${little ? 'Little-endian stores the least significant byte first' : 'Big-endian stores the most significant byte first'}: byte ${k} is ${hex(byte)}. Network protocols are big-endian; x86, ARM and RISC-V are little-endian.`, little ? 'Address + 0 holds the lowest byte.' : 'Address + 0 holds the highest byte.'),
      'byte order (endianness)', 'A 32-bit value occupies four consecutive byte addresses. Big-endian puts the most significant byte at the lowest address; little-endian puts the LEAST significant byte there. The value is the same; only the order in memory differs.',
      show(`most significant → least significant:\n${bytes.map((b) => hex(b, 2)).join('  ')}`, `${hex(v, 8)} split into bytes`),
      choice('Which byte does a little-endian machine put at the lowest address (+0)?', 'The least significant byte (the rightmost one)', ['The most significant byte (the leftmost one)', 'The middle bytes first']),
      step(`On this ${little ? 'little' : 'big'}-endian machine, the byte at address +${k} is (hex):`, hexa(byte, 2)));
  },
  (r) => {
    const i = between(r, 0, C_BUGS.length - 1);
    const others = shuffle(r, C_BUGS.filter((_, j) => j !== i).map((b) => b[1])).slice(0, 3);
    const [src, bug, method, idea, [sq, sr, sw]] = C_BUGS[i];
    return walk(mcs(r, `What is wrong with this C?${code(src)}`, bug, others, `${bug}. Every one of these has shipped in real firmware.`), method, idea, choice(sq, sr, sw));
  },
]);

// ------------------------------------------------------------------ C++

export const cppPractice = practice('practice-cpp', 'C++ Drills', 'virtual dispatch, object lifetime, smart pointers, templates, containers', [
  (r, d) => {
    const virt = d === 1 ? true : r() < 0.6;
    const how = d === 3 ? pick(r, ['pointer', 'value', 'reference']) : 'pointer';
    const call = how === 'pointer' ? 'Base *b = new Derived; std::cout << b->name();' : how === 'reference' ? 'Derived d; Base &b = d; std::cout << b.name();' : 'Derived d; Base b = d; std::cout << b.name();';
    const out = virt && how !== 'value' ? 'Derived' : 'Base';
    return walk(ask(`${code(`struct Base    { ${virt ? 'virtual ' : ''}std::string name() const { return "Base"; } };\nstruct Derived : Base { std::string name() const ${virt ? 'override ' : ''}{ return "Derived"; } };\n\n${call}`)}What is printed?`, exact(out), !virt ? 'name() is not virtual, so the call is bound at compile time by the static type Base: "Base".' : how === 'value' ? 'Copying a Derived into a Base object slices it: only the Base part survives, so "Base" even with virtual.' : 'A virtual call through a pointer or reference dispatches on the dynamic type: "Derived".', 'Is the function virtual? Is the call through a pointer/reference or a copy?'),
      'virtual dispatch', 'A call is resolved in one of two ways. If the function is virtual AND you call it through a pointer or reference, C++ looks at the real object at run time and runs ITS version (dynamic dispatch). Otherwise the compiler picks the version from the declared type of the variable (static dispatch). A by-value copy into a Base object slices off the Derived part, so it is really a Base.',
      choice('Is name() declared virtual in Base?', virt ? 'Yes' : 'No: the call is bound by the declared type', virt ? ['No: the call is bound by the declared type'] : ['Yes']),
      choice('How is it called?', how === 'value' ? 'On a Base copy (slicing): the object really is a Base' : `Through a ${how}, so the real object is seen`, [how === 'value' ? 'Through a pointer, so the real object is seen' : 'On a Base copy (slicing): the object really is a Base']),
      step('So what is printed?', exact(out)));
  },
  (r, d) => {
    const extra = between(r, 1, 3), inner = between(r, 0, 2);
    const lines = ['auto a = std::make_shared<Txn>();', ...Array.from({ length: extra }, (_, i) => `auto b${i} = a;`), '{', ...Array.from({ length: inner }, (_, i) => `    auto c${i} = a;`), '}'];
    if (d === 3) lines.push('b0.reset();');
    const cnt = 1 + extra - (d === 3 ? 1 : 0);
    return walk(ask(`${code(`${lines.join('\n')}\nstd::cout << a.use_count();`)}Output?`, num(cnt), `Each shared_ptr copy adds one owner; copies inside the braces die at the closing brace${d === 3 ? '; reset() drops b0\'s ownership' : ''}. Count: ${cnt}. The object is freed when the count reaches 0.`, 'Count the live shared_ptr copies at the print.'),
      'shared_ptr reference counts', 'A shared_ptr keeps a count of how many shared_ptr copies point at the same object (use_count). Copying adds one; a copy going away (leaving its scope, or reset()) subtracts one. The object is deleted when the count reaches zero. At the print, count the copies still alive.',
      inner > 0 && 'The copies made inside the braces { } are destroyed at the closing brace, so they no longer count by the time of the print.',
      d === 3 ? count(`The original a, plus the ${extra} cop${extra > 1 ? 'ies' : 'y'} made outside the braces, is ${1 + extra} owners. Then b0.reset() makes b0 let go of the object. Owners left:`, `${1 + extra} - 1`, cnt)
        : count(`The original a, plus the ${extra} cop${extra > 1 ? 'ies' : 'y'} made outside the braces:`, `1 + ${extra}`, cnt));
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
    const q = ask(`${code(src)}Output? (computed entirely at compile time)`, num(v), `The compiler instantiates F<N> recursively until the specialization stops it: ${useFib ? `Fibonacci(${n + 3})` : `${n}!`} = ${v}. Template metaprogramming like this generates lookup tables in hardware models.`, 'Unroll the recursion by hand.');
    if (useFib) return walk(q, 'recursive templates: Fibonacci', 'A template like F<N> is a recipe the compiler fills in for each N it meets, at compile time. Here F<N>::v is defined by F<N-1> and F<N-2>, and the specializations F<0> and F<1> are the stopping points. Work up from the bottom: each value is the sum of the two before it.',
      'The specializations give F<0> = 0 and F<1> = 1. Build upward:',
      ...Array.from({ length: n + 2 }, (_, i) => count(`F<${i + 2}>::v = F<${i + 1}> + F<${i}>:`, `${fib(i + 1)} + ${fib(i)}`, fib(i + 2))));
    return walk(q, 'recursive templates: factorial', 'A template like F<N> is a recipe the compiler fills in for each N it meets, at compile time. Here F<N>::v = N × F<N-1>::v, and the specialization F<0> = 1 is the stopping point. Start at the bottom and multiply your way up.',
      'The specialization gives F<0>::v = 1. Build upward:',
      ...Array.from({ length: n }, (_, i) => count(`F<${i + 1}>::v = ${i + 1} × F<${i}>::v:`, `${i + 1} × ${fact(i)}`, fact(i + 1))));
  },
  (r) => {
    const perm = shuffle(r, ['A', 'B', 'C']);
    const dtor = pick(r, [true, false]);
    const out = dtor ? [...perm].reverse().map((x) => x.toLowerCase()).join('') : perm.join('');
    return walk(ask(`Each member prints its letter in its constructor (capital) and destructor (lower case).${code(`struct Top {\n${perm.map((m) => `    ${m} ${m.toLowerCase()}_;`).join('\n')}\n};\n{ Top t; }   // construct, then destroy`)}What do the ${dtor ? 'destructors' : 'constructors'} print, in order?`, exact(out), `Members are constructed in declaration order (${perm.join('')}) and destroyed in reverse (${[...perm].reverse().map((x) => x.toLowerCase()).join('')}), regardless of the initializer list order. RAII relies on this.`, 'Declaration order, then reversed.'),
      'construction and destruction order', 'Members are constructed in the order they are DECLARED in the class, top to bottom, and destroyed in exactly the reverse order. That way something built later, which may depend on something built earlier, is always torn down first. (It has nothing to do with the order in an initializer list.)',
      `The members are declared in the order ${perm.join(', ')}.`,
      choice(dtor ? 'Destructors run in:' : 'Constructors run in:', dtor ? 'The reverse of the declaration order' : 'The declaration order, top to bottom', [dtor ? 'The declaration order, top to bottom' : 'The reverse of the declaration order', 'Alphabetical order']),
      step(`Write the letters that get printed by the ${dtor ? 'destructors' : 'constructors'}, in order:`, exact(out)));
  },
  (r) => concept(r, [
    ['Look up cells by name millions of times; order never matters. Best container?', 'std::unordered_map (hash table, O(1) average)', ['std::map (red-black tree, O(log n) with ordered traversal)', 'std::vector with a linear search (contiguous, simple, O(n) each)', 'std::list with a linear search (linked, O(n) per lookup, slow)'], 'choosing a container: lookups', 'A hash table turns a key into a slot number and jumps straight there, so a lookup takes about the same time however big the map is (O(1) on average). An ordered tree (std::map) needs O(log n) steps but keeps the keys sorted; a vector search is O(n). If you never need the order, hash wins.', ['You never need the keys in order. What does that let you use?', 'A hash table: constant-time lookup', ['A sorted tree only', 'A linked list']]],
    ['A simulator needs "give me the earliest pending event" repeatedly. Best container?', 'std::priority_queue (a binary heap)', ['std::vector sorted after every insert', 'std::unordered_set', 'std::stack'], 'choosing a container: the next event', 'A priority queue (a heap) keeps the smallest (or largest) item ready at the top, and inserts and removals cost only O(log n). That is exactly "always hand me the earliest event next".', ['What do you need to do repeatedly?', 'Take the smallest item and add new ones', ['Look up a random key', 'Keep everything in insertion order']]],
    ['Store a million transactions and iterate them in order, appending at the end. Best container?', 'std::vector (contiguous, cache-friendly)', ['std::list (a linked list', 'std::map (a tree', 'std::deque of deques (a chunked list, with an extra level of pointers)'], 'choosing a container: sequences', 'A vector keeps its elements in one contiguous block, so walking through it is fast (the CPU cache loves it) and appending at the end is cheap on average. A linked list scatters its nodes across memory and is slow to traverse.', ['Iterating in order over a million items is fastest when they sit:', 'Next to each other in memory', ['Scattered in separate nodes', 'In a sorted tree']], 'std::vector (contiguous, cache-friendly, amortized O(1) push_back)'],
    ['Keep coverage bins sorted by name so reports print in order. Best container?', 'std::map (ordered by key)', ['std::unordered_map (hash table, which keeps no ordering at all)', 'std::stack (last in, first out, with no lookup by name)', 'std::priority_queue (a heap, which only orders the largest first)'], 'choosing a container: sorted keys', 'std::map is a balanced tree: it keeps the keys in sorted order automatically, so iterating gives them alphabetically. A hash map has no order at all.', ['Which container hands keys back in sorted order?', 'std::map', ['std::unordered_map', 'std::vector that is never sorted']]],
    ['Which smart pointer for a single, exclusive owner?', 'std::unique_ptr (zero overhead, move-only)', ['std::shared_ptr (reference counted', 'A raw pointer with a delete on every path out of the function', 'std::weak_ptr (a non-owning observer of a shared_ptr object)'], 'smart pointer ownership', 'A smart pointer frees its object automatically. unique_ptr means exactly one owner: it cannot be copied, only moved, and it costs nothing extra. shared_ptr allows many owners but pays for a reference count. Pick the cheapest one that matches the ownership you actually have.', ['One owner only. Which ownership model is that?', 'Exclusive ownership: unique_ptr', ['Shared ownership: shared_ptr', 'No ownership: a raw pointer']]],
    ['What does std::move(v) actually do?', 'Casts v to an rvalue so a move constructor can steal its buffer', ['Copies v into a new object, then marks the old one as empty', 'Deletes v, and returns the storage it was using to the heap', 'Moves v to the heap, so that the stack is kept free of it'], 'move semantics', 'std::move does not move anything. It is only a cast that says "I am done with v, you may steal from it". A move constructor or assignment that receives such an rvalue can then take over v\'s internal buffer instead of copying it, leaving v empty.', ['By itself, std::move(v):', 'Only casts: the actual stealing happens in a move constructor', ['Copies every element', 'Frees the memory']], 'Casts v to an rvalue so a move constructor can steal its buffer; it moves nothing by itself'],
  ], (why) => `${why}.`),
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
    return walk(ask(`Binary search over ${n.toLocaleString('en-US')} sorted items: worst-case number of comparisons?`, num(k), `floor(log2(${n})) + 1 = ${k}. A billion items in about 30 steps: that is the power of O(log n).`, 'Each comparison halves the range.'),
      'binary search cost', 'Binary search compares with the middle item and throws away the half that cannot contain the target, so each comparison halves the range. The number of halvings until one item is left is about log2(n); in the worst case you also make one final comparison: floor(log2 n) + 1.',
      calc('log2 of the number of items:', `log2(${n})`, Math.log2(n), '', sig(Math.log2(n), 5), 0.002),
      count('Round down, then add 1 for the last comparison:', `floor(${sig(Math.log2(n), 5)}) + 1`, k));
  },
  (r, d) => {
    const n = tier(d, 4, 5, 7);
    const { edges, at } = dag(r, n);
    const names = 'ABCDEFGH'.slice(0, n).split('');
    return walk(ask(`A timing graph (edge delays in ps):${code(edges.map(([u, v, w]) => `${names[u]} -> ${names[v]}  ${w}`).join('\n'))}Arrival at A is 0. Latest arrival time at ${names[n - 1]}?`, num(at[n - 1]), `Process nodes in topological order, taking the max over incoming edges: ${names.map((x, i) => `${x}=${at[i]}`).join(', ')}. Linear time in the graph size, with no path enumeration: this is how STA works.`, 'Longest path in a DAG: max over predecessors, in topological order.'),
      'longest path in a DAG', 'To find the latest arrival at each node, do not list every path. Visit nodes in an order where all of a node\'s inputs are done first (topological order; here alphabetical). The arrival at a node is the LARGEST of (arrival at each predecessor + the edge delay). Start from A = 0 and work down. This is exactly how static timing analysis works.',
      ...Array.from({ length: n - 1 }, (_, i) => {
        const v = i + 1;
        const ins = edges.filter((e) => e[1] === v);
        return count(`${names[v]}: the largest of ${ins.map(([u, , w]) => `(${names[u]} + ${w})`).join(' and ')}. Arrival at ${names[v]}:`, ins.map(([u, , w]) => `${names[u]}(${at[u]}) + ${w}`).join(', max of these'), at[v]);
      }));
  },
  (r, d) => {
    const n = pick(r, tier(d, [10, 100], [1000, 50], [1e4, 2000]));
    const variants = [
      [1, `for (i = 0; i < n; i++)\n  for (j = 0; j < n; j++)\n    work();`, n * n],
      [2, `for (i = 0; i < n; i++)\n  for (j = 0; j < i; j++)\n    work();`, (n * (n - 1)) / 2],
      [3, `for (i = 1; i < n; i *= 2)\n  for (j = 0; j < n; j++)\n    work();`, Math.ceil(Math.log2(n)) * n],
    ] as const;
    const [, src, v] = pick(r, variants.filter((x) => x[0] === d));
    const q = ask(`With n = ${n}, how many times is work() called?${code(src)}`, num(v), d === 1 ? `Two nested loops of n each: n² = ${v}. O(n²).` : d === 2 ? `0 + 1 + … + (n-1) = n(n-1)/2 = ${v}: still O(n²).` : `The outer loop runs ceil(log2 n) = ${Math.ceil(Math.log2(n))} times: ${v} calls, O(n log n).`, 'Count the outer iterations, then the inner work per iteration.');
    if (d === 1) return walk(q, 'counting nested loops', 'To count how many times the innermost line runs, multiply: (how many times the outer loop runs) × (how many times the inner loop runs per outer pass). If the inner count depends on the outer variable, add it up pass by pass instead.',
      count('The outer loop runs i = 0 .. n-1. Passes:', `n = ${n}`, n),
      count('Each pass the inner loop runs j = 0 .. n-1. Calls per pass:', `n = ${n}`, n),
      count('Total calls:', `${n} × ${n}`, v));
    if (d === 2) return walk(q, 'counting triangular loops', 'When the inner loop\'s length depends on the outer variable, add the lengths up: for i = 0, 1, 2, … the inner loop runs i times, so the total is 0 + 1 + 2 + … + (n-1). That sum has a shortcut: n(n-1)/2.',
      count('On pass i the inner loop runs i times, for i = 0 to n-1. The sum 0 + 1 + … + (n-1) has the shortcut n(n-1)/2:', `${n} × ${n - 1} / 2`, v));
    return walk(q, 'counting loops that double', 'A loop where the variable doubles (i = 1, 2, 4, 8, …) runs only about log2(n) times, because it covers the range n in leaps. Multiply that by the work done on each pass of it.',
      count(`i takes the values 1, 2, 4, … while i < ${n}. How many passes is that? (ceil of log2 ${n})`, `ceil(log2(${n}))`, Math.ceil(Math.log2(n))),
      count(`Each pass the inner loop runs n = ${n} times. Total calls:`, `${Math.ceil(Math.log2(n))} × ${n}`, v));
  },
  (r, d) => {
    const x = between(r, 1, tier(d, 255, 4095, 65535));
    const pc = x.toString(2).split('').filter((c) => c === '1').length;
    const bits = x.toString(2);
    const variants = [
      [1, `popcount(${hex(x, 1)}) (number of 1 bits)`, pc, `${x.toString(2)} has ${pc} ones.`],
      [2, `${hex(x, 1)} & (${hex(x, 1)} - 1)`, x & (x - 1), `x & (x-1) clears the lowest set bit: ${x.toString(2)} → ${(x & (x - 1)).toString(2)} = ${x & (x - 1)}. x & (x-1) == 0 tests for a power of two.`],
      [3, `${hex(x, 1)} & -${hex(x, 1)}  (two's complement)`, x & -x, `x & -x isolates the lowest set bit: ${x & -x}. Priority arbiters in RTL use the same trick.`],
    ] as const;
    const [, e, v, why] = pick(r, variants.filter((q) => q[0] === d));
    const q = ask(`What is ${e}, in decimal?`, num(v), why, 'Write it in binary.');
    if (d === 1) return walk(q, 'counting set bits', 'Population count is just "how many 1s does the number have in binary". Write it in binary (hex converts digit by digit: each hex digit is 4 bits) and count the ones.',
      step('Write the number in binary:', exact(bits)),
      count('Count the 1 digits:', `ones in ${bits}`, pc));
    if (d === 2) return walk(q, 'the x & (x - 1) trick', 'Subtracting 1 from a number flips its lowest 1 to 0 and turns all the zeros below it into 1s. ANDing with the original then keeps everything above that point and zeros the rest: the lowest set bit is gone. (If the result is 0, x had only one bit set: a power of two.)',
      step('x in binary:', exact(bits)),
      step('x - 1 in binary (the lowest 1 becomes 0, the zeros below it become 1s):', exact((x - 1).toString(2))),
      count('AND the two bit by bit, then read the result in decimal:', `${bits} AND ${(x - 1).toString(2)}`, v));
    return walk(q, 'isolating the lowest set bit', 'In two\'s complement, -x is "invert every bit, then add 1". That flips everything above the lowest 1 and leaves the lowest 1 and the zeros below it unchanged. ANDing x with -x therefore keeps ONLY the lowest set bit. The answer is that bit\'s value (a power of two).',
      step('x in binary:', exact(bits)),
      count('The lowest set bit is the rightmost 1. Its value as a decimal number (a power of two):', `rightmost 1 in ${bits}`, v));
  },
  (r, d) => {
    const n = tier(d, 5, 7, 9);
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const unions = Array.from({ length: tier(d, 2, 4, 6) }, () => pair(r, n));
    const groups: number[] = [];
    let g = n;
    for (const [a, b] of unions) { if (find(a) !== find(b)) { parent[find(a)] = find(b); g--; } groups.push(g); }
    const comps = new Set(Array.from({ length: n }, (_, i) => find(i))).size;
    return walk(ask(`${n} nets, numbered 0-${n - 1}. These pairs are shorted together: ${unions.map(([a, b]) => `${a}-${b}`).join(', ')}. How many electrically separate groups remain?`, num(comps), `Union-find merges each pair's groups: ${comps} groups. LVS and short-checking tools use exactly this structure on billions of shapes.`, 'Merge sets pair by pair; count the survivors.'),
      'merging groups (union-find)', `Start with every net alone in its own group (${n} groups). Shorting two nets joins their groups into one, so the group count drops by 1, but ONLY if they were in different groups. If they were already connected, nothing changes. Process the pairs one at a time.`,
      ...unions.map(([a, b], i) => count(`After ${a}-${b}: groups left (were ${i === 0 ? n : groups[i - 1]})?`, 'groups before, minus 1 if the two were in different groups', groups[i])));
  },
  (r) => concept(r, [
    ['Detect a combinational loop in a netlist. Algorithm?', 'Depth-first search for a back edge', ['Dijkstra\'s algorithm, to find the shortest path between gates', 'Binary search over the sorted list of nets in the netlist', 'Quicksort of the gates, by the number of their fan-out nets'], 'cycle detection', 'A netlist is a graph: gates are nodes, wires are edges. A loop means you can follow the edges and come back to where you started. A depth-first search follows one path as far as it goes; if it runs into a node already on its current path (a back edge), there is a cycle.', ['A loop in a graph means:', 'Following edges can lead back to the start', ['Every node has two inputs', 'The graph has no edges']], 'Depth-first search looking for a back edge (or a failed topological sort)'],
    ['Route a wire through a grid with obstacles by shortest path. Classic algorithm?', 'BFS (Lee) maze routing, or A*', ['Bubble sort of the free cells, by their distance to the target', 'Union-find over the cells of the grid, to join the pin pairs', 'Huffman coding of the path, to make the net shorter to store'], 'shortest paths on a grid', 'Breadth-first search spreads outwards from the source one step at a time, like a ripple, so the first time it touches the target it has found a shortest path (Lee\'s maze router). A* does the same but is guided toward the target.', ['Breadth-first search explores nodes in order of:', 'Their distance from the start', ['Their alphabetical name', 'Random order']], 'BFS / Lee maze routing (or A* with a heuristic)'],
    ['Merge identical gates during logic synthesis. Data structure?', 'A hash table keyed by (gate type, inputs): structural hashing', ['A linked list of the gates, scanned once for each new gate', 'A stack of the gates, popped when a duplicate one is found', 'A priority queue of the gates, ordered by their logic depth'], 'hashing to find duplicates', 'Two gates of the same type with the same inputs are duplicates. A hash table keyed by (type, inputs) finds that in constant time: before creating a gate, look up its key; if it is already there, reuse it.', ['Two gates have the same type and the same inputs. They are:', 'Duplicates that can be merged', ['Always different', 'Illegal']], 'A hash table keyed by (gate type, inputs): structural hashing'],
    ['An event-driven simulator must always process the earliest event next. Data structure?', 'A priority queue (heap) or a timing wheel', ['A FIFO only, in the order in which the events were scheduled', 'A sorted array that is re-sorted again after each new insertion', 'A hash set of the events'], 'the event queue', 'The simulator needs the smallest timestamp next, while new events keep arriving with arbitrary times. A heap gives the minimum in O(log n) and inserts in O(log n); re-sorting an array each time costs far more.', ['The operation needed over and over is:', 'Remove the smallest timestamp', ['Find a value by key', 'Remove the newest item']]],
    ['T(n) = 2T(n/2) + n solves to?', 'O(n log n)', ['O(n), since each level of the recursion halves the work done', 'O(n²), as the two sub-problems are solved from scratch each time', 'O(log n), because the problem size halves at each of the levels'], 'solving recurrences', 'T(n) = 2T(n/2) + n means: split into two halves, solve each, and do n work to combine. The halving gives log2 n levels, and every level does n work in total, so the total is n × log n (merge sort).', ['How many times can n be halved before reaching 1?', 'About log2 n times', ['n times', 'Twice']]],
    ['Which problem is NP-complete, so EDA uses heuristics for it?', 'Optimal placement or graph partitioning', ['Sorting the cells by their coordinates, for the legalizer', 'Shortest path with positive weights', 'Topological sort of the netlist'], 'hard versus easy problems', 'Sorting, shortest paths and topological sort all have fast exact algorithms. Optimal placement and partitioning are NP-complete: no fast exact algorithm is known, so EDA tools use heuristics that find good, not perfect, answers.', ['Which of these has a fast exact algorithm?', 'Sorting', ['Optimal placement', 'Optimal partitioning']], 'Optimal placement / graph partitioning'],
  ], (why) => `${why}.`),
]);

// ------------------------------------------------------------------ RISC-V assembly

const R = ['t0', 't1', 't2'];
function runAsm(r: Rng, len: number) {
  const regs: Record<string, number> = { t0: between(r, 1, 20), t1: between(r, 1, 20), t2: 0 };
  const lines = [`li t0, ${regs.t0}`, `li t1, ${regs.t1}`];
  const trace: { line: string; rd: string; val: number }[] = [];
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
    const line = ['add', 'sub'].includes(op) ? `${op} ${rd}, ${rs}, ${rt}` : `${op} ${rd}, ${rs}, ${imm}`;
    lines.push(line);
    trace.push({ line, rd, val: regs[rd] });
  }
  return { lines, regs, trace };
}

export const asmPractice = practice('practice-asm', 'RISC-V Drills', 'execute RV32I by hand, immediates, loads, calling convention', [
  (r, d) => {
    const { lines, regs, trace } = runAsm(r, tier(d, 2, 4, 6));
    const reg = pick(r, R);
    return walk(ask(`${code(lines.join('\n'))}Final value of ${reg} (signed decimal)?`, num(regs[reg]), `Step through it: t0 = ${regs.t0}, t1 = ${regs.t1}, t2 = ${regs.t2}. andi/ori/xori sign-extend their 12-bit immediate; srai keeps the sign.`, 'Track all three registers line by line.'),
      'executing RISC-V by hand', 'Each instruction reads registers and writes the FIRST register named (the destination). add/sub combine two registers; addi/andi/ori/xori use a constant; slli shifts left (times 2^n); srai shifts right keeping the sign (divides by 2^n, rounding down). Keep a little table of t0, t1 and t2 and update it line by line.',
      'Registers start as: t2 is 0, and the two li lines load t0 and t1 with the values you see.',
      ...trace.map((t) => count(`After \`${t.line}\`, ${t.rd} becomes:`, `${t.rd}`, t.val)),
      count(`So ${reg} at the end is:`, reg, regs[reg]));
  },
  (r, d) => {
    const n = between(r, 2, tier(d, 5, 10, 20)), k = between(r, 1, 5);
    const src = d < 3 ? `    li   t0, ${n}\n    li   t1, 0\nloop:\n    addi t1, t1, ${k}\n    addi t0, t0, -1\n    bnez t0, loop` : `    li   t0, 0\n    li   t1, 0\n    li   t2, ${n}\nloop:\n    add  t1, t1, t0\n    addi t0, t0, 1\n    blt  t0, t2, loop`;
    const v = d < 3 ? n * k : (n * (n - 1)) / 2;
    return walk(ask(`${code(src)}Value of t1 after the loop?`, num(v), d < 3 ? `The loop runs ${n} times, adding ${k} each time: ${v}.` : `t1 = 0 + 1 + … + ${n - 1} = ${v}.`, 'How many iterations, and what does each add?'),
      'reading an assembly loop', 'A loop in assembly is a label plus a branch back to it. Work out (1) how many times the body runs, from the counter and the branch condition, and (2) what each pass adds to the result. Then combine them.',
      ...(d < 3 ? [
        count('t0 starts at n and drops by 1 each pass; bnez loops while t0 is not zero. Passes:', `t0 starts at ${n}`, n),
        count(`Each pass adds ${k} to t1. Final t1:`, `${n} × ${k}`, v)]
        : [
          count(`t0 counts 0, 1, 2, …; blt loops while t0 < ${n}. The body runs for t0 = 0 up to ${n - 1}. Passes:`, `${n} passes`, n),
          count(`Each pass adds the current t0 to t1, so t1 = 0 + 1 + … + ${n - 1}. Final t1:`, `${n} × ${n - 1} / 2`, v)]));
  },
  (r, d) => {
    const c = d === 1 ? between(r, 1, 0xfffff) << 12 : d === 2 ? (between(r, 0x10000, 0x7ffff) << 12) | between(r, 0, 0x7ff) : (between(r, 0x10000, 0x7ffff) << 12) | between(r, 0x800, 0xfff);
    const hi = ((c + 0x800) >>> 12) & 0xfffff;
    const lo = c - (hi << 12);
    return walk(ask(`To load ${hex(c >>> 0, 8)} into a0 you write \`lui a0, X\` then \`addi a0, a0, Y\`. What is X (hex)?`, hexa(hi, 5), `addi sign-extends its 12-bit immediate. Low 12 bits = ${hex(c & 0xfff, 3)}${(c & 0x800) ? `, which is negative as a 12-bit value (${lo}), so lui must add one: X = ${hex(hi, 5)}` : `, positive, so X is just the upper 20 bits: ${hex(hi, 5)}`}, Y = ${lo}. The assembler's \`li\` does this for you, but every toolchain bug hunter learns it.`, 'Is bit 11 of the constant set? If so, round the upper part up.'),
      'building a 32-bit constant with lui + addi', 'An instruction is only 32 bits, so a constant is built in two steps: lui X sets the UPPER 20 bits, and addi Y adds a 12-bit signed number to fill the LOW 12 bits. The catch: addi sign-extends, so if bit 11 of the low part is 1, Y is negative and subtracts from the upper part. To compensate, lui must be loaded with the upper 20 bits PLUS ONE.',
      step('The low 12 bits of the constant (hex, 3 digits):', hexa(c & 0xfff, 3)),
      choice('Is bit 11 set (is the low part 0x800 or more)?', (c & 0x800) ? 'Yes: addi will treat it as negative, so X must be one more' : 'No: addi is positive, so X is just the upper 20 bits', [(c & 0x800) ? 'No: addi is positive, so X is just the upper 20 bits' : 'Yes: addi will treat it as negative, so X must be one more']),
      step('So X (hex, 5 digits):', hexa(hi, 5)));
  },
  (r, d) => {
    const w = between(r, 0x10000000, 0xffffffff) >>> 0;
    const off = between(r, 0, 3);
    const byte = (w >>> (8 * off)) & 0xff;
    const half = (() => { const h = (w >>> (8 * (off & 2))) & 0xffff; return h >= 0x8000 ? h - 0x10000 : h; })();
    const hraw = (w >>> (8 * (off & 2))) & 0xffff;
    const variants = [
      [1, `lbu t1, ${off}(sp)`, byte, 'lbu zero-extends the byte.'],
      [2, `lb  t1, ${off}(sp)`, byte >= 128 ? byte - 256 : byte, 'lb sign-extends: a byte ≥ 0x80 becomes negative.'],
      [3, `lh  t1, ${off & 2}(sp)`, half, 'lh loads 16 bits little-endian and sign-extends.'],
    ] as const;
    const [, ins, v, why] = pick(r, variants.filter((x) => x[0] === d));
    const bytes = [0, 1, 2, 3].map((i) => `sp+${i}: ${hex((w >>> (8 * i)) & 0xff, 2)}`).join('\n');
    const q = ask(`${code(`li  t0, ${hex(w, 8)}\nsw  t0, 0(sp)\n${ins}`)}Value of t1 (signed decimal)? RISC-V is little-endian.`, num(v), `Byte 0 is the least significant. ${why} t1 = ${v}.`, 'Find the byte(s) at that offset, then extend.');
    const idea = 'sw stores the 32-bit register into four consecutive bytes, least significant byte at the LOWEST address (little-endian). A load then reads back one byte (lb / lbu) or two (lh) from a chosen address. The unsigned load (lbu) fills the top of the register with zeros; the signed loads (lb, lh) copy the top bit of the loaded value into all the upper bits (sign extension), so a value with its top bit set becomes negative.';
    if (d === 1) return walk(q, 'loading a byte: lbu', idea,
      show(bytes, 'memory after the sw'),
      step(`The byte at sp+${off} (hex):`, hexa(byte, 2)),
      count('lbu zero-extends it, so the value is that byte in decimal:', `0x${byte.toString(16)}`, byte));
    if (d === 2) return walk(q, 'loading a byte: lb (sign-extended)', idea,
      show(bytes, 'memory after the sw'),
      step(`The byte at sp+${off} (hex):`, hexa(byte, 2)),
      choice('Is its top bit set (is the byte 0x80 or more)?', byte >= 128 ? 'Yes: lb treats it as negative' : 'No: it stays positive', [byte >= 128 ? 'No: it stays positive' : 'Yes: lb treats it as negative']),
      count(byte >= 128 ? 'Signed value = byte - 256:' : 'Signed value = the byte as is:', byte >= 128 ? `${byte} - 256` : `${byte}`, v));
    return walk(q, 'loading a halfword: lh (sign-extended)', idea,
      show(bytes, 'memory after the sw'),
      step(`lh reads two bytes at sp+${off & 2}. The HIGHER address is the more significant byte. Write the 16-bit value (hex, 4 digits):`, hexa(hraw, 4)),
      choice('Is bit 15 set (is it 0x8000 or more)?', hraw >= 0x8000 ? 'Yes: lh treats it as negative' : 'No: it stays positive', [hraw >= 0x8000 ? 'No: it stays positive' : 'Yes: lh treats it as negative']),
      count(hraw >= 0x8000 ? 'Signed value = value - 65536:' : 'Signed value = the value as is:', hraw >= 0x8000 ? `${hraw} - 65536` : `${hraw}`, v));
  },
  (r) => concept(r, [
    ['In the RISC-V calling convention, where do the first arguments and the return value go?', 'a0-a7 for arguments; a0 (and a1) for the return value', ['t0-t6 for arguments, with the return value left in t0 as well', 's0-s11 for arguments, so that the callee does not have to save', 'On the stack only, with the return value left on the stack as well'], 'the calling convention', 'A calling convention is an agreement so separately compiled code can call each other. RISC-V passes the first eight arguments in registers a0-a7 and returns the result in a0 (a1 too if it needs two). The "a" stands for argument.', ['What does the "a" in a0-a7 stand for?', 'Argument (and result)', ['Address', 'Always zero']]],
    ['Which registers must a function restore before returning if it uses them?', 's0-s11 (callee-saved) and sp', ['t0-t6 (temporaries), which the caller expects to be preserved', 'a0-a7 (arguments)', 'None of them, as the caller already saved every register before'], 'saved versus temporary registers', 'Registers are split in two groups. Temporaries (t) and arguments (a) may be overwritten freely by the function you call, so the caller must save them if it needs them. Saved registers (s) are the function\'s promise: if it uses them, it must put the old values back before returning.', ['A function wants to use s1. Before returning it must:', 'Restore the old value of s1', ['Clear s1 to zero', 'Nothing']]],
    ['What does `jal ra, func` do?', 'Jumps to func and saves pc + 4 in ra', ['Jumps to func without any way for the code to return', 'Loads the address of func into ra', 'Calls the operating system'], 'calls and returns', 'To call a function you need to remember where to come back to. jal (jump and link) jumps to the target and, at the same time, stores the address of the NEXT instruction (pc + 4) in the link register ra. The function returns with jr ra.', ['Where does a function return to?', 'The address saved in ra', ['Address 0', 'The start of the program']], 'Jumps to func and saves the return address (pc + 4) in ra'],
    ['What is x0 in RISC-V?', 'A register hard-wired to zero; writes are ignored', ['The program counter', 'The stack pointer', 'The return address, which jal writes at each function call'], 'the zero register', 'x0 always reads as 0 and ignores writes. It looks odd, but it gives many instructions for free: mv is addi rd, rs, 0, "load 5" is addi rd, x0, 5, and a jump without linking is jal x0, target.', ['What does addi t0, x0, 5 put in t0?', '5, since x0 is always 0', ['Zero', 'An error']], 'A register hard-wired to zero; writes to it are ignored'],
    ['Why does RISC-V split big constants into lui + addi?', 'Instructions are 32 bits, so immediates are only 20 or 12 bits', ['It is faster than loading the constant from memory, which is slow', 'To save registers, since lui and addi share the same destination', 'Memory is 12 bits wide, so a constant has to be loaded in pieces'], 'why constants are split', 'Every instruction is 32 bits wide and must also hold the opcode and registers, so it cannot carry a whole 32-bit constant: lui carries 20 bits and addi 12. Two instructions together can build any 32-bit value.', ['An instruction has to fit in how many bits?', '32, including the opcode and registers', ['64', '12']], 'Instructions are 32 bits, so an immediate holds at most 20 (lui) or 12 (addi) bits'],
  ], (why) => `${why}.`),
  (r, d) => {
    const ic = pick(r, [1e9, 2e9, 5e8]), cpi = pick(r, tier(d, [1, 2], [1.2, 1.5, 0.8], [0.6, 1.8, 2.5])), f = pick(r, [1e9, 2e9, 3e9]);
    const t = (ic * cpi) / f;
    return walk(ask(`A program runs ${ic.toExponential(0).replace('e+', 'e')} instructions at CPI = ${cpi} on a ${f / 1e9} GHz core. Run time, in ms?`, qty(t * 1000, 'ms', 0.02), `time = IC × CPI / f = ${sig(t * 1000)} ms. The "iron law": every architecture trick attacks one of these three terms.`, 'time = instructions × CPI / frequency.'),
      'the iron law of performance', 'Run time = (instructions) × (cycles per instruction, CPI) ÷ (clock frequency). Instructions × CPI is the total number of clock cycles; dividing by the cycles per second gives seconds. Every speed-up trick attacks one of the three terms.',
      calc('Total cycles = instructions × CPI:', `${ic} × ${cpi}`, ic * cpi, '', sig(ic * cpi, 4), 0.005),
      calc('Seconds = cycles ÷ frequency, then ×1000 for ms:', `${sig(ic * cpi, 4)} / ${f} × 1000`, t * 1000, 'ms', sig(t * 1000), 0.02));
  },
]);

// ------------------------------------------------------------------ operating systems

export const osPractice = practice('practice-os', 'OS Drills', 'paging, TLBs, scheduling, concurrency, I/O', [
  (r, d) => {
    const pageBits = pick(r, tier(d, [12], [12, 14, 16], [12, 21]));
    const va = between(r, 0x10000000, 0x7fffffff);
    const vpn = va >>> pageBits, off = va & ((1 << pageBits) - 1);
    const which = d === 1 ? 'offset' : pick(r, ['page number', 'offset']);
    return walk(ask(`Page size ${2 ** pageBits >= 1 << 20 ? `${2 ** (pageBits - 20)} MB` : `${2 ** (pageBits - 10)} KB`}. For virtual address ${hex(va, 8)}, what is the ${which} (hex)?`, hexa(which === 'offset' ? off : vpn), `${2 ** pageBits} bytes per page → ${pageBits} offset bits. Offset = VA & ${hex((1 << pageBits) - 1, 1)} = ${hex(off, 1)}; page number = VA >> ${pageBits} = ${hex(vpn, 1)}.`, `Low ${pageBits} bits are the offset.`),
      `finding the ${which} of an address`, 'Memory is divided into pages. A virtual address splits in two: the LOW bits say where you are inside the page (the offset), and the HIGH bits say which page (the page number). A page of 2^k bytes needs k offset bits. One hex digit is 4 bits.',
      count(`The page has ${2 ** pageBits} bytes, which is 2 to the power of how many? That many low bits are the offset:`, `log2(${2 ** pageBits})`, pageBits),
      step(which === 'offset' ? `Keep only the low ${pageBits} bits of ${hex(va, 8)} (hex):` : `Drop the low ${pageBits} bits of ${hex(va, 8)}, shifting right by ${pageBits} (hex):`, hexa(which === 'offset' ? off : vpn)));
  },
  (r, d) => {
    if (d < 3) {
      const vaBits = pick(r, [32, 36]), pageBits = 12, pte = 4;
      const mb = (2 ** (vaBits - pageBits) * pte) / 2 ** 20;
      return walk(ask(`${vaBits}-bit virtual addresses, 4 KB pages, 4-byte page table entries, one flat table. Page table size per process, in MB?`, qty(mb, '', 0.01, String(mb)), `2^(${vaBits}-12) entries × 4 B = ${mb} MB per process, mostly empty. That waste is why page tables are multi-level.`, 'Entries = 2^(VA bits - offset bits).'),
        'size of a flat page table', 'A flat page table has one entry for every possible virtual page. The number of pages is 2 to the power of (address bits - offset bits), because the offset bits do not choose a page. Multiply by the entry size for the table size.',
        count('4 KB pages need 12 offset bits. Entries = 2 ^ (address bits - 12). Number of entries:', `2^(${vaBits} - 12)`, 2 ** (vaBits - pageBits)),
        calc('Table size in MB: entries × 4 bytes, divided by 2^20 bytes per MB:', `${2 ** (vaBits - pageBits)} × 4 / 2^20`, mb, '', String(mb), 0.01));
    }
    const h = pick(r, [0.9, 0.98, 0.99]), tlb = 1, mem = pick(r, [50, 100]), levels = pick(r, [1, 2, 4]);
    const eat = h * (tlb + mem) + (1 - h) * (tlb + (levels + 1) * mem);
    return walk(ask(`TLB hit rate ${h * 100}%, TLB lookup 1 ns, memory access ${mem} ns, ${levels}-level page table walked on a miss. Effective memory access time, in ns?`, qty(eat, 'ns', 0.02), `hit: 1 + ${mem}; miss: 1 + ${levels} walk accesses + 1 data access = 1 + ${(levels + 1) * mem}. EAT = ${sig(eat)} ns. Page-walk caches and huge pages exist to shrink the miss term.`, 'Weight the hit and miss costs by their probabilities.'),
      'effective access time with a TLB', 'Every memory access first looks in the TLB (a small cache of translations). On a HIT the translation is ready: cost = TLB lookup + one memory access for the data. On a MISS the page table must be walked first, one memory access per level, and then the data is fetched. The average is each cost weighted by how often it happens.',
      calc('Hit cost (TLB + 1 memory access), in ns:', `${tlb} + ${mem}`, tlb + mem, 'ns'),
      calc(`Miss cost (TLB + ${levels} walk accesses + 1 data access), in ns:`, `${tlb} + ${levels + 1} × ${mem}`, tlb + (levels + 1) * mem, 'ns'),
      calc('Weight by probability, in ns:', `${h} × ${tlb + mem} + ${sig(1 - h)} × ${tlb + (levels + 1) * mem}`, eat, 'ns', sig(eat, 4), 0.02));
  },
  (r, d) => {
    const bursts = Array.from({ length: tier(d, 3, 4, 4) }, () => between(r, 1, 9));
    if (d < 3) {
      let t = 0, wait = 0;
      const waits: number[] = [];
      for (const b of bursts) { waits.push(t); wait += t; t += b; }
      return walk(ask(`Jobs arrive together with CPU bursts ${bursts.join(', ')} ms and run first-come first-served in that order. Average waiting time, in ms?`, qty(wait / bursts.length, 'ms', 0.01, sig(wait / bursts.length)), `Each job waits for all earlier bursts: total ${wait} ms over ${bursts.length} jobs = ${sig(wait / bursts.length)} ms. Shortest-job-first would minimize this.`, 'Job k waits for the sum of bursts before it.'),
        'first-come first-served waiting time', 'In FCFS the jobs run one after another in arrival order. A job\'s waiting time is how long it sat in line: the sum of the bursts of all jobs ahead of it. The first job waits 0. The average waiting time is the total of everyone\'s waits divided by the number of jobs.',
        ...bursts.map((_, i) => count(`Job ${i} waits for all the jobs before it (${i === 0 ? 'none' : bursts.slice(0, i).join(' + ')}):`, i === 0 ? '0' : bursts.slice(0, i).join(' + '), waits[i])),
        calc('Average = total wait ÷ number of jobs:', `${waits.join(' + ')} / ${bursts.length}`, wait / bursts.length, 'ms', sig(wait / bursts.length), 0.01));
    }
    const q = pick(r, [2, 3]);
    const rem = [...bursts];
    const done = Array(rem.length).fill(0);
    let t = 0;
    const slices: { t0: number; t1: number; i: number; left: number }[] = [];
    while (rem.some((x) => x > 0)) for (let i = 0; i < rem.length; i++) if (rem[i] > 0) { const s = Math.min(q, rem[i]); slices.push({ t0: t, t1: t + s, i, left: rem[i] - s }); t += s; rem[i] -= s; if (!rem[i]) done[i] = t; }
    const j = between(r, 0, bursts.length - 1);
    return walk(ask(`Round-robin with a ${q} ms quantum, jobs J0..J${bursts.length - 1} arrive together with bursts ${bursts.join(', ')} ms (queue order J0 first). When does J${j} finish, in ms?`, num(done[j]), `Simulate the queue in ${q} ms slices: completion times ${done.map((x, i) => `J${i}=${x}`).join(', ')}.`, 'Cycle through the jobs, each running at most one quantum per turn.'),
      'round-robin scheduling', `Round-robin gives every job a turn of at most ${q} ms, in order, then goes back to the start of the queue. A job that still has work left after its turn waits for its next turn; a job that finishes leaves the queue. Keep a running clock and each job's remaining time.`,
      ...sim(slices.map((sl, k) => ({ beats: [count(`Slice ${k + 1}: the clock is at ${sl.t0} and J${sl.i} runs for up to ${q} ms. What is the clock when its turn ends?`, `${sl.t0} + min(${q}, J${sl.i}'s remaining time)`, sl.t1)], row: `${sl.t0}-${sl.t1}: J${sl.i}${sl.left === 0 ? ' (done)' : ''}` })), 3, 'the schedule, slice by slice'),
      count(`The slice where J${j} runs its last piece ends at the clock time:`, `end of J${j}'s last slice`, done[j]));
  },
  (r, d) => {
    const p = pick(r, tier(d, [0.5, 0.9], [0.9, 0.95, 0.75], [0.99, 0.95, 0.8])), n = pick(r, tier(d, [2, 4], [8, 16], [64, 1000]));
    const s = 1 / (1 - p + p / n);
    return walk(ask(`${p * 100}% of a program parallelizes perfectly; the rest is serial. Speedup on ${n} cores (Amdahl)?`, qty(s, 'x', 0.02, sig(s)), `1/((1 - ${p}) + ${p}/${n}) = ${sig(s)}×. The limit, with infinite cores, is 1/(1 - ${p}) = ${sig(1 / (1 - p))}×.`, 'Speedup = 1 / (serial + parallel/n).'),
      "Amdahl's law", 'The serial part of a program does not get faster with more cores; only the parallel part shrinks, to 1/n of its time. New run time (as a fraction of the old) = serial + parallel/n. Speedup is the old time (1) divided by the new time.',
      calc('The serial fraction:', `1 - ${p}`, 1 - p, '', sig(1 - p), 0.001),
      calc(`The parallel part on ${n} cores:`, `${p} / ${n}`, p / n, '', sig(p / n, 4), 0.005),
      calc('Speedup = 1 / (serial + parallel part):', `1 / (${sig(1 - p)} + ${sig(p / n, 4)})`, s, 'x', sig(s), 0.02));
  },
  (r) => concept(r, [
    ['Two threads each run `counter++` 1000 times with no lock. Final value?', 'Anywhere from about 1000 to 2000, because the steps interleave', ['Always 2000, since each increment is a single machine instruction', 'Always 1000, because only one of the two threads gets to run', 'The program crashes, as the two threads write the same variable'], 'race conditions', 'counter++ is really three steps: read the value, add 1, write it back. If two threads interleave those steps, both can read the same old value and both write the same new one, so one increment is lost. The result depends on timing: a race.', ['counter++ compiles to:', 'Three steps: read, add, write', ['One indivisible step', 'Two locks']], 'Anywhere from about 1000 to 2000, because read-modify-write steps interleave (a race)'],
    ['Thread 1 locks A then B; thread 2 locks B then A. Risk?', 'Deadlock: each holds one lock and waits for the other', ['Starvation only, where one thread runs and the other never does', 'A race on A, where the two threads read stale copies of it', 'Nothing at all, since locks are safe in whatever order they are taken'], 'deadlock', 'Thread 1 holds A and waits for B; thread 2 holds B and waits for A. Neither can ever continue. Deadlock needs a circular wait; the classic cure is for every thread to take locks in the same global order.', ['Thread 1 holds A and wants B; thread 2 holds B and wants A. Who can proceed?', 'Neither: each waits for the other', ['Thread 1', 'Both']], 'Deadlock: each can hold one lock and wait forever for the other'],
    ['A high-priority task waits on a lock held by a low-priority task, which a medium task keeps preempting. Name and fix?', 'Priority inversion; fix it with priority inheritance', ['Deadlock, which is fixed by adding more locks to the system', 'Thrashing, which is fixed by adding more RAM to the board', 'A race, which is fixed by marking the shared flag as volatile'], 'priority inversion', 'The high-priority task is stuck behind the low one (which holds the lock), and the medium task keeps stopping the low one from finishing. So a medium task effectively outranks a high one. Priority inheritance temporarily boosts the lock holder to the waiter\'s priority so it can finish and release the lock.', ['To let the lock holder finish quickly, priority inheritance:', 'Temporarily raises its priority to the waiter\'s', ['Kills the medium task', 'Removes the lock']], 'Priority inversion; fix with priority inheritance'],
    ['When is a spinlock better than a sleeping mutex?', 'On multicore, when the lock is held very briefly', ['Always, because a spinlock never has to wait for another thread', 'On single-core systems', 'When the lock is held for seconds'], 'spinlock versus mutex', 'A spinlock makes the waiting thread burn CPU in a tight loop until the lock frees. A mutex puts the thread to sleep, which costs a slow context switch. If the lock is held only for a few nanoseconds on another core, spinning is cheaper than sleeping; for long holds it just wastes the CPU.', ['Waiting for a lock that will free in a few nanoseconds: what is cheaper?', 'Spinning: sleeping costs more than the wait', ['Sleeping for seconds', 'Killing the thread']], 'On multicore systems when the lock is held for a very short time'],
    ['What does a page fault on a valid but non-resident page cause?', 'The OS loads the page, updates the table, restarts the instruction', ['A crash of the whole system, with a kernel panic and a dump', 'The process is killed by the OS, with a segmentation fault message', 'Nothing at all, since the hardware fetches the page by itself'], 'page faults', 'A page can be valid (the process may use it) but not currently in RAM. The CPU then raises a page fault; the OS fetches the page from disk, fixes the page table, and restarts the very instruction that faulted, which now succeeds. The program never notices, except for the delay.', ['After the OS handles the fault, the faulting instruction is:', 'Restarted, and now succeeds', ['Skipped', 'Replaced by a crash']], 'The OS loads the page from disk, updates the page table, and restarts the instruction'],
    ['Moving 10 Gb/s of network data into memory: which I/O method?', 'DMA with coalesced interrupts, so the CPU does not copy bytes', ['Programmed I/O in a tight loop, with the CPU copying each word', 'Polling every byte of each packet, with the CPU kept at full load', 'Printing each packet to a console, then copying it by hand'], 'direct memory access (DMA)', 'Copying bytes with the CPU would use it up completely at 10 Gb/s. With DMA (direct memory access), the device writes straight into memory by itself, and the CPU is told only when a whole batch is ready (an interrupt, often coalesced).', ['Who moves the bytes into memory with DMA?', 'The device itself', ['The CPU, one byte at a time', 'The keyboard']], 'DMA with interrupts (coalesced), so the CPU is not copying bytes'],
  ], (why) => `${why}.`),
  (r, d) => {
    const period = pick(r, [10, 50, 100]), cost = pick(r, [0.5, 1, 2]);
    if (d < 3) return walk(ask(`A driver polls a device every ${period} µs; each poll costs ${cost} µs of CPU. What % of the CPU does polling burn?`, qty((cost / period) * 100, '%', 0.01, sig((cost / period) * 100)), `${cost}/${period} = ${sig((cost / period) * 100)}%, even when nothing happens. Interrupts cost nothing while idle but have per-event overhead.`, 'Cost per poll / poll period.'),
      'CPU cost of polling', 'Polling checks the device on a timer whether or not anything happened. The fraction of the CPU it uses is the time spent per poll divided by the time between polls.',
      calc('Fraction of time spent polling, cost ÷ period:', `${cost} / ${period}`, cost / period, '', sig(cost / period, 4), 0.005),
      calc('As a percentage (× 100):', `${sig(cost / period, 4)} × 100`, (cost / period) * 100, '%', sig((cost / period) * 100), 0.01));
    const rate = pick(r, [1e4, 1e5, 1e6]), ov = pick(r, [2, 5]);
    return walk(ask(`A device raises ${rate.toLocaleString('en-US')} interrupts per second, each costing ${ov} µs of handler time. What % of one CPU goes to interrupt handling?`, qty(rate * ov * 1e-4, '%', 0.01, sig(rate * ov * 1e-4)), `${rate} × ${ov} µs = ${sig(rate * ov * 1e-6)} s per second = ${sig(rate * ov * 1e-4)}%. At high rates, coalescing or polling (NAPI) wins.`, 'Interrupts per second × seconds each.'),
      'CPU cost of interrupts', 'Each interrupt costs some handler time. In one second the handler runs (interrupts per second) × (time each) of that second; that busy time as a fraction of one second is the CPU share. Convert µs to seconds (× 10⁻⁶) first.',
      calc('Handler time per second, in seconds:', `${rate} × ${ov} × 10⁻⁶`, rate * ov * 1e-6, '', sig(rate * ov * 1e-6), 0.005),
      calc('As a percentage of the second (× 100):', `${sig(rate * ov * 1e-6)} × 100`, rate * ov * 1e-4, '%', sig(rate * ov * 1e-4), 0.01));
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
    mc('Why does putc hang only in the optimized build?', ['`u` is not declared volatile, so the optimizer reads status once and spins forever on a stale value', 'The baud rate divisor is wrong, and only the faster optimized code exposes it', 'uint8_t is too small to hold the status bits once the compiler inlines the call', 'The while loop has an empty body, so the optimizer is free to delete the loop'], 0, 'The optimizer reads status once and spins forever on a stale value. Declare the register block `volatile uart_regs_t *u`. The debug build (-O0) happened to reload memory each iteration.'),
    { t: 'gen', make: (r) => { const par = between(r, 0, 3); const start = between(r, 0, 255); const v = (start & ~0x0c) | (par << 2) | 1; return ask(`ctrl currently reads ${hex(start)}. Firmware must set parity = ${par} (bits 3:2) and enable = 1, leaving other bits alone. What value is written (hex)?`, hexa(v & 0xff, 2), `(ctrl & ~0x0C) | (${par} << 2) | 0x01 = ${hex(v & 0xff)}. Clear the field, then OR in the new value.`); } },
    { t: 'gen', make: (r) => { const clk = pick(r, [48e6, 100e6]), baud = pick(r, [115200, 921600]); const div = Math.round(clk / (16 * baud)); return ask(`baud_div = clk / (16 × baud), rounded. With a ${clk / 1e6} MHz clock and ${baud} baud, what is baud_div?`, num(div), `${clk} / (16 × ${baud}) = ${sig(clk / (16 * baud), 5)} → ${div}. Rounding error here is why some baud rates are unreliable on some clocks.`); } },
    { t: 'gen', make: (r) => { const a = between(r, 200, 250); return ask(`A timeout counter is \`uint8_t tries = ${a};\` and the loop does \`tries += 10;\` then \`if (tries < ${a}) give_up();\`. What is tries after one iteration?`, num((a + 10) & 255), `${a} + 10 = ${a + 10} wraps to ${(a + 10) & 255} in a uint8_t, so the driver "gives up" instantly. Use a wider type for counters.`); } },
    mc('The data register is 16 bits but a char is written to it. On this bus, a 16-bit store to offset 10 becomes one bus write. What else could go wrong if data were at an odd offset?', ['A misaligned access: some buses fault, or split it into two writes', 'Nothing: a narrower store is always widened to the register size safely', 'The char is sign-extended into the parity bits, corrupting the frame', 'The compiler refuses to build a store to a register of that width'], 0, 'Splitting it has side effects on the register. Device registers must be naturally aligned and accessed at their true width.'),
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
    mc('`delete q[0]` runs which destructor(s)?', ['Only ~Txn, since ~Txn is not virtual', 'Both destructors, derived first and then the base, in the right order', 'Neither: delete on a base pointer only releases the raw memory', 'Only ~ReadTxn, because the dynamic type decides which one runs'], 0, 'ReadTxn\'s vector is never freed: undefined behaviour and a leak. Any class meant to be deleted through a base pointer needs a virtual destructor.'),
    mc('The cleanest way to stop leaking every Txn in the queue?', ['std::vector<std::unique_ptr<Txn>>, with RAII ownership', 'Call delete by hand at every place that removes a Txn from the queue', 'Use std::shared_ptr for everything by default, so counts are always safe', 'Never free memory in the model; the OS reclaims it when the run ends'], 0, 'Ownership is explicit and destruction is automatic. unique_ptr expresses single ownership at zero cost.'),
    { t: 'gen', make: (r) => { const k = between(r, 2, 4); return ask(`A scoreboard stores \`std::shared_ptr<Txn> t\`; ${k} checkers each keep a copy, and the queue holds one more. After the queue pops it, what is use_count()?`, num(k + 1), `The original t plus ${k} checker copies: ${k + 1}. (The queue's copy is gone.)`); } },
    mc('Profiling shows 40% of time in std::map<uint64_t, Line> lookups for the cache model, never iterated in order. Fix?', ['Switch to std::unordered_map, or a direct-mapped array by set', 'Switch to std::list so that the lines are kept in insertion order', 'Add more threads and let each of them walk part of the tree', 'Sort the map more often so that the lookups find lines sooner'], 0, 'Average O(1) lookups, or indexing by the set bits directly. Tree lookups are O(log n) with pointer chasing; hashing or indexing by set bits is far faster.'),
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
    mc('The tool finds the worst path by enumerating every path from inputs to outputs. Why is that hopeless?', ['The number of paths grows exponentially with depth; a longest-path pass in topological order is linear', 'Paths cannot be enumerated at all, because the netlist graph contains cycles', 'Enumeration uses too little memory to be able to keep every arrival time', 'It only works on small chips, since large chips have wires that cross a lot'], 0, 'A chain of 60 reconvergent stages can have 2⁶⁰ paths. Dynamic programming visits each edge once.'),
    { t: 'gen', make: (r) => { const { edges, at } = dag(r, 6); const names = 'ABCDEF'.split(''); return ask(`Compute the latest arrival at F:${code(edges.map(([u, v, w]) => `${names[u]} -> ${names[v]}  ${w}`).join('\n'))}`, num(at[5]), `Topological order, max over inputs: ${names.map((x, i) => `${x}=${at[i]}`).join(', ')}.`); } },
    { t: 'gen', make: (r) => { const n = pick(r, [1e9, 4e9]); return ask(`The netlist has ${n / 1e9} billion pins. An O(n log n) sort of them does about how many comparisons (n·log2 n), in billions?`, qty((n * Math.log2(n)) / 1e9, '', 0.03, sig((n * Math.log2(n)) / 1e9)), `${n / 1e9}e9 × log2(${n / 1e9}e9) ≈ ${sig((n * Math.log2(n)) / 1e9)} billion. Fine. O(n²) would be ${sig((n * n) / 1e18)}e18: never finishes.`); } },
    mc('After an ECO changes 100 gates, the tool re-times the whole chip. What is the standard fix?', ['Incremental timing, through the fan-out cone of the changed gates', 'Buy a much bigger server and re-time the whole chip every single time', 'Skip timing after ECOs, and only run it again at the final signoff step', 'Randomly sample paths from the design and re-time just those few paths'], 0, 'Propagate changes only through the fan-out cone of the modified gates. Incremental algorithms (with dirty flags in topological order) make interactive closure possible.'),
    { t: 'gen', make: (r) => { const n = 8; const parent = Array.from({ length: n }, (_, i) => i); const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]))); const us = Array.from({ length: 5 }, () => pair(r, 8)); for (const [a, b] of us) parent[find(a)] = find(b); const c = new Set(Array.from({ length: n }, (_, i) => find(i))).size; return ask(`Clock-domain grouping: 8 flops, and these pairs share a clock: ${us.map(([a, b]) => `${a}-${b}`).join(', ')}. How many clock groups?`, num(c), `Union-find: ${c} groups.`); } },
    mc('The tool runs on 64 cores but only gets 5× faster. The profile shows 15% serial code. Is that expected?', ['Yes: Amdahl caps it near 1/(0.15 + 0.85/64) ≈ 5.9×', 'No: with 64 cores it ought to be close to 64× faster in practice', 'No: an extra core ought to make the tool slower', 'Only with hyperthreading'], 0, 'Parallelizing the serial 15% (levelized parallel propagation) is the only way forward.'),
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
    mc('The dump shows `ra` pointing into the middle of a data table. What most likely happened?', ['A function overwrote its saved return address (a stack overflow)', 'The CPU is broken, and has started to corrupt its own register file', 'ra is always random after a trap, and it carries no real information', 'A cache miss left ra half-loaded when the exception was taken'], 0, 'It then returned into garbage: a corrupted saved ra is the signature of stack smashing. Corrupted saved ra is the signature of stack smashing.'),
    mc('Which registers can you trust to still hold the caller\'s values after a call returns?', ['s0-s11 and sp (callee-saved)', 't0-t6 and ra, the temporaries and the return address', 'a0-a7 and t0-t6', 'Every register except the zero register, which only ever reads as zero'], 0, 'Temporaries and argument registers may be clobbered by the callee.'),
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
    mc('Two cores freeze. Core 0 holds the UART lock and waits for the DMA lock; core 1 holds the DMA lock and waits for the UART lock. Fix?', ['Impose a global lock order (UART before DMA), or merge the locks', 'Add a third lock that guards the pair, taken only by the cores here', 'Make both of the locks recursive so a core can retake its own', 'Lower the clock frequency so that the two cores no longer collide'], 0, 'Deadlock needs a cycle of waits; a fixed acquisition order makes cycles impossible.'),
    { t: 'gen', make: (r) => { const rate = pick(r, [2e5, 5e5]); return ask(`The network driver takes ${rate.toLocaleString('en-US')} interrupts/s at 3 µs each. What % of one core is spent in interrupt handlers?`, qty(rate * 3e-4, '%', 0.01, sig(rate * 3e-4)), `${rate} × 3 µs = ${sig(rate * 3e-6)} s/s = ${sig(rate * 3e-4)}%. Switch to interrupt coalescing or NAPI polling under load.`); } },
    mc('A driver reads a DMA buffer the device just wrote, but sees stale data. The SoC has non-coherent DMA. Why?', ['The CPU cache holds old lines; invalidate the buffer, or map it uncached', 'The DMA engine is broken, and its writes never reach main memory at all', 'volatile was missing on the buffer pointer, so reads were reordered early', 'The page has been swapped out, and the read returns zeros from the disk'], 0, 'The driver must do this before reading. Without hardware coherence, software cache maintenance is mandatory around DMA.'),
    { t: 'gen', make: (r) => { const p = pick(r, [0.9, 0.95]); return ask(`The boot's parallel init is ${p * 100}% parallel. Speedup on the SoC's 8 cores (Amdahl)?`, qty(1 / (1 - p + p / 8), 'x', 0.02, sig(1 / (1 - p + p / 8))), `1/(${sig(1 - p)} + ${p}/8) = ${sig(1 / (1 - p + p / 8))}×.`); } },
  ],
  recap: ['VPN = VA >> page bits; TLB misses cost page walks.', 'Lock ordering prevents deadlock.', 'Interrupt load; cache maintenance for non-coherent DMA.'],
});

export const SYSTEMS_BOSSES = [cBoss, cppBoss, dsaBoss, asmBoss, osBoss];

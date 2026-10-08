// Act II - Computer science & systems programming: C, C++, data structures & algorithms,
// the hardware/software interface, and operating systems.
import { hexa, num, qty, words } from './answers';
import { art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const clang: Lesson = {
  id: 'c',
  title: 'C: Close to the Metal',
  concept: 'pointers, memory, bit manipulation, volatile',
  xp: 90,
  steps: [
    say('Hardware engineers write a lot more software than people expect: firmware, device drivers, test programs that run on the chip, reference models called from SystemVerilog through **DPI-C**, and the insides of every EDA tool. The language for all of it is **C**.'),
    say('C\'s superpower is the **pointer**: a variable that holds a memory address. Hardware registers live at addresses, so pointers are how software touches silicon.'),
    art(`
  int  x = 5;
  int *p = &x;     // p holds the address of x
  *p = 7;          // write through the pointer: x is now 7`),
    mc('After `int a[4] = {10, 20, 30, 40}; int *p = a; p += 2;` what is `*p`?', ['10', '20', '30', '40'], 2, 'p starts at a[0]. Pointer arithmetic moves in whole elements, so p + 2 points at a[2] = 30.'),
    gen((r) => {
      const [t, sz] = pick(r, [['uint8_t', 1], ['uint16_t', 2], ['uint32_t', 4], ['uint64_t', 8]] as const);
      const base = pick(r, [0x1000, 0x4000, 0x8000]);
      const n = between(r, 2, 5);
      const addr = base + n * sz;
      return ask(`\`${t} *p = (${t} *)0x${base.toString(16).toUpperCase()};\` What address does \`p + ${n}\` point to? (hex)`, hexa(addr), `Each step is sizeof(${t}) = ${sz} byte${sz > 1 ? 's' : ''}: 0x${base.toString(16).toUpperCase()} + ${n} × ${sz} = 0x${addr.toString(16).toUpperCase()}.`, 'Pointer + n advances by n × sizeof(the pointed-to type).');
    }),
    say('Drivers spend their lives setting, clearing and testing bits in registers. You need these idioms cold:'),
    art(`
  reg |=  (1u << n);        // set bit n
  reg &= ~(1u << n);        // clear bit n
  reg ^=  (1u << n);        // toggle bit n
  bit = (reg >> n) & 1u;    // test bit n
  field = (reg >> 4) & 0xF; // extract bits [7:4]`),
    say('Shifts need care. A 32-bit hardware shifter, like a Verilog shift, uses only the low 5 bits of the shift amount, so a shift by 33 is a shift by 1. **C does not mask**: shifting by a negative amount, or by the width of the type or more, is undefined behaviour, and so is shifting a negative value left. Hardware is forgiving here; C is not.'),
    gen((r) => {
      const v = between(r, 0x10, 0xef);
      const s = between(r, 0, 7);
      const set = [0, 1, 2, 3, 4, 5, 6, 7].filter((b) => b !== s && (v >> b) & 1);
      const c = set.length ? pick(r, set) : (s + 1) % 8;
      const res = (v | (1 << s)) & ~(1 << c) & 0xff;
      return ask(`\`uint8_t r = 0x${v.toString(16).toUpperCase()}; r |= (1u << ${s}); r &= ~(1u << ${c});\` What is r? (hex)`, hexa(res, 2), `Set bit ${s}, then clear bit ${c}: 0x${res.toString(16).toUpperCase().padStart(2, '0')}.`, 'Write 0x' + v.toString(16).toUpperCase() + ' in binary, set one bit, clear the other.');
    }),
    mc('Why must a pointer to a hardware status register be declared `volatile`?', ['So the compiler keeps it in a fast register', 'So the compiler re-reads it on every access', 'So reads and writes to it become atomic', 'So other cores see writes in program order'], 1, 'The hardware can change the value behind the program\'s back, so the compiler must not cache it in a register. Without volatile, `while (*status == 0);` may be optimized into an infinite loop that reads once. Note volatile does NOT give atomicity or ordering between cores; that needs barriers.'),
    say('C gives you raw memory and no safety net. Local variables live on the **stack** and vanish when the function returns. `malloc` memory lives on the **heap** until you `free` it.'),
    mc('Which of these is a bug?', ['Returning a pointer to a local array from a function', 'Passing a pointer to a local array into a helper function', 'Calling free() on a heap pointer exactly once', 'Using sizeof on a struct to size a malloc call'], 0, 'The local array dies when the function returns, so the caller gets a dangling pointer. Memory bugs like this are why firmware teams run static analyzers and sanitizers.'),
    ask('On a typical 32/64-bit ABI, what is `sizeof(struct { char a; int b; })`?', num(8), 'The int must be 4-byte aligned, so the compiler inserts 3 bytes of padding after `a`: 1 + 3 + 4 = 8. Register maps in drivers use exact-width types and packing rules for exactly this reason.', 'Think about alignment: where can a 4-byte int start?'),
    mc('`int x = INT_MAX; x = x + 1;` What does the C standard say happens?', ['x wraps around to INT_MIN', 'x saturates at INT_MAX', 'The behavior is undefined', 'It raises a runtime overflow trap'], 2, 'Signed overflow is undefined behavior in C (unsigned wraps): the compiler may assume it never happens. Hardware wraps, but the optimizer is allowed to assume it never happens. A subtle difference between modelling and silicon.'),
    say('Firmware adds three more habits. First, **volatile** is not a lock: it stops the compiler caching a variable that an interrupt handler or a device changes, but it does not make a wide access indivisible and it does not order anything against other cores. When main code and an **ISR** share a multi-word value, mask the interrupt around the read, or use the read-twice-and-compare trick. The Code Lab has a mission on exactly this tear.'),
    mc('Main code reads a 32-bit tick counter that an interrupt handler also writes, on a core with 16-bit loads. What stops a torn read?', ['Declaring the counter volatile, which makes it indivisible', 'Declaring the counter static, which gives it a fixed address', 'Masking the interrupt around the read, or re-reading to check', 'Declaring the counter const, since the handler is the only writer'], 2, 'volatile only forces each access to happen; it does not join two 16-bit loads into one step. Either keep the interrupt out for the two loads, or read twice and retry until both reads agree.'),
    say('Second, the compiler is allowed to assume that two pointers of unrelated types do not point at the same object: the **strict aliasing** rule. Reading a float\'s bits through `*(uint32_t *)&f` breaks it, and optimisation may then produce nonsense. Copy the bytes with `memcpy` (compilers turn it into one move) instead. For a register map, pin the layout with `static_assert(sizeof(struct regs) == 0x20)` and `offsetof`, so padding surprises fail the build.'),
    say('Third, let the tools nag you. Build with `-Wall -Wextra` and treat warnings as errors; run the tests under **AddressSanitizer** (out-of-bounds, use after free, leaks) and **UndefinedBehaviorSanitizer** (signed overflow, bad shifts). Safety-critical code goes further: fixed-size buffers rather than the heap after start-up, no recursion, every loop bounded, every return value checked, so memory use and timing can be worked out in advance.'),
  ],
  recap: ['Pointers hold addresses; pointer + n moves n × sizeof(type).', 'Bit idioms: |= set, &= ~ clear, ^= toggle, >> & test.', 'volatile for memory-mapped registers and ISR-shared flags (not for atomicity: mask the interrupt around wide reads).', 'Strict aliasing: use memcpy, not pointer casts; static_assert the register map; build with -Wall -Wextra and sanitizers.', 'Stack vs heap; dangling pointers; struct padding.', 'Signed overflow is undefined behavior in C.'],
};

export const cpp: Lesson = {
  id: 'cpp',
  title: 'C++ and Objects',
  concept: 'classes, virtual dispatch, RAII, templates',
  xp: 90,
  steps: [
    say('C++ adds **objects**, **generics** and **automatic resource management** to C. It is the language of performance models (gem5), SystemC/TLM virtual prototypes, Verilator\'s generated simulators, and EDA tools. And its object model is the direct ancestor of SystemVerilog classes and UVM.'),
    art(`
  class Transaction {                 // encapsulation: data + behaviour
   public:
    Transaction(uint32_t a) : addr_(a) {}
    virtual std::string name() const { return "txn"; }
    virtual ~Transaction() = default;
   protected:
    uint32_t addr_;
  };
  class WriteTxn : public Transaction {   // inheritance
   public:
    using Transaction::Transaction;
    std::string name() const override { return "write"; }
  };`),
    mc('`Transaction *t = new WriteTxn(0x10); t->name();` returns?', ['"txn"', '"write"', 'Compile error', 'Undefined'], 1, 'name() is virtual, so the call dispatches on the object\'s real (dynamic) type through the vtable. Without `virtual`, it would bind to Transaction::name at compile time and return "txn".'),
    mc('Why does the base class above declare a **virtual destructor**?', ['C++ requires every destructor to be virtual', 'So `delete t` through a base pointer runs WriteTxn\'s destructor', 'So the class becomes abstract and cannot be created', 'So the destructor is resolved at compile time'], 1, 'Without it, `delete t` through a base pointer is undefined behavior and WriteTxn\'s destructor does not run. Any class meant to be deleted polymorphically needs a virtual destructor. UVM has the same idea: the factory creates derived objects that you handle through base handles.'),
    say('The most important C++ idea is **RAII**: resource acquisition is initialization. Tie every resource (memory, a file, a lock) to an object whose destructor releases it. Then cleanup happens automatically, even on early returns and exceptions.'),
    art(`
  {
    std::lock_guard<std::mutex> g(m);      // lock taken
    auto buf = std::make_unique<Packet>(); // heap object owned by buf
    if (bad) return;                       // both released automatically
  }                                        // ...and here too`),
    mc('`unique_ptr` vs `shared_ptr`?', ['They are the same type under two different names', 'unique_ptr has one owner; shared_ptr is reference-counted', 'unique_ptr is reference-counted; shared_ptr has one owner', 'unique_ptr can be copied; shared_ptr can only be moved'], 1, 'unique_ptr is move-only with zero overhead; shared_ptr frees the object when the last owner goes. Prefer unique_ptr. Use shared_ptr only when ownership is genuinely shared. Raw `new`/`delete` in modern C++ is a code smell.'),
    say('**Templates** generate code for any type at compile time, like Verilog parameters but far more powerful. The Standard Library\'s containers are templates: `std::vector<T>`, `std::unordered_map<K, V>`, `std::map<K, V>`.'),
    mc('You need to look up cells by name, millions of times, and never need them in sorted order. Which container?', ['std::vector, kept sorted, with binary search (O(log n))', 'std::map (balanced tree, O(log n))', 'std::unordered_map (hash table, O(1) average)', 'std::list (linked list, O(n) search)'], 2, 'Hash map for pure lookup. Use std::map only when you need ordered iteration or range queries.'),
    mc('What does `std::move(v)` do?', ['Copies v into a new temporary', 'Casts v to an rvalue reference', 'Frees v\'s memory immediately', 'Relocates v from the stack onto the heap'], 1, 'It is only a cast: it lets a move constructor steal v\'s resources instead of deep-copying them. Move semantics turn expensive copies of big buffers into pointer swaps. After a move, v is valid but unspecified (usually empty).'),
    ask('Which C++ keyword marks a method that must re-implement a base-class virtual function, so the compiler errors if the signature does not match?', words('override'), '`override` catches typos in signatures that would otherwise silently create a new, unrelated function.', 'SystemVerilog does not have it, which is why UVM callbacks sometimes silently never get called.'),
    say('Interviews love the **rule of zero, three and five**. If your members manage themselves (`vector`, `string`, `unique_ptr`), write no special member functions at all: the defaults are right. If you hold a raw resource and write a destructor, you almost certainly need a copy constructor and copy assignment too (three), and move versions for speed (five), or the default copy will leave two objects freeing one block.'),
    mc('A class has a hand-written destructor that frees a raw pointer member. Why is the default copy constructor dangerous?', ['It copies the pointer, so two objects free one block', 'It copies the whole block, which wastes memory for each', 'It calls the destructor twice before the copy completes', 'It refuses to compile when a destructor has been written'], 0, 'The default copy is member-wise: it copies the address, not what it points at. Both objects then believe they own the block, and the second delete is a double free.'),
    say('Threads add two more topics. A plain `int` shared between threads is a **data race** (undefined behaviour), and `counter++` is read, add, write, so updates vanish. `std::atomic<int>` makes it indivisible. Atomics also take a **memory order**: the default `seq_cst` is the safe one; `relaxed` gives atomicity but no ordering; a flag stored with `release` and loaded with `acquire` publishes everything written before the store. And `constexpr` asks the compiler to evaluate a function at compile time when its arguments are constants, which is how lookup tables and array sizes get computed for free.'),
    mc('Which pair publishes a buffer to another thread through an atomic flag?', ['Store the flag relaxed, load the flag relaxed', 'Store the flag release, load the flag acquire', 'Store the flag acquire, load the flag release', 'Store the flag with no order, then load it twice'], 1, 'The release store makes earlier writes visible to a thread whose acquire load sees the flag. Relaxed would let the reader see the flag but stale data.'),
  ],
  recap: ['Classes, inheritance, virtual dispatch via vtables (the root of SV/UVM classes).', 'Virtual destructors for polymorphic bases.', 'RAII: destructors release resources; prefer unique_ptr.', 'Templates and the STL: vector, unordered_map (O(1)), map (O(log n)).', 'Move semantics avoid deep copies.', 'Rule of zero / three / five; std::atomic and memory order for threads; constexpr for compile-time work.'],
};

export const dsa: Lesson = {
  id: 'dsa',
  title: 'Data Structures and Algorithms',
  concept: 'Big-O, hash tables, trees, graphs',
  xp: 90,
  steps: [
    say('Every EDA tool is an algorithm running on a data structure the size of a chip. A netlist is a **graph** with billions of edges. If the algorithm is O(n²), the tool never finishes. So Big-O is not an interview formality here, it is survival.'),
    art(`
   structure         index   search      insert/delete
   array             O(1)    O(n)        O(n)
   sorted array      O(1)    O(log n)    O(n)
   linked list       O(n)    O(n)        O(1) at a known node
   hash table        -       O(1) avg    O(1) avg
   balanced BST      -       O(log n)    O(log n)
   heap              -       O(1) min    O(log n)`),
    gen((r) => {
      const k = pick(r, [10, 16, 20, 24, 30]);
      return ask(`Binary search over 2^${k} sorted items takes how many comparisons in the worst case? (floor(log2 n) + 1)`, num(k + 1), `Each comparison halves the range: log2(2^${k}) = ${k} halvings, plus one final comparison on the last item left: floor(log2 n) + 1 = ${k + 1}.`, 'How many times can you halve 2^' + k + ' before reaching 1, plus one more comparison?');
    }),
    mc('A placement checker compares every cell with every other cell for overlaps. For 10 million cells that is too slow. Its complexity and the fix?', ['O(n), so only the constant factor can improve', 'O(n²); bin the die into a grid of tiles', 'O(log n); keep the cells in a heap', 'O(n²); run the same loop on more cores'], 1, 'All-pairs is O(n²) = 1e14 checks. Binning the die into a grid (spatial hashing) so each cell only checks its neighbours, or a spatial tree (R-tree, quadtree), brings it to about O(n). More cores only divide the constant.'),
    say('**Graphs** are the core of EDA. Nodes are pins or gates, edges are wires. The classic algorithms appear everywhere:'),
    art(`
   BFS / Lee maze routing ........ shortest route for a wire on a grid
   Dijkstra / A* ................. weighted routing, path finding
   topological sort .............. static timing analysis on a DAG
   union-find .................... connectivity (the board lab's net checker)
   min-cut partitioning .......... splitting a design for placement
   DFS / strongly connected ...... finding combinational loops`),
    mc('How does STA find the worst arrival time at every node **without enumerating paths** (there can be exponentially many)?', ['It samples random paths and keeps the worst', 'One forward pass over the graph in topological order', 'It runs a timing simulation with random vectors', 'It enumerates paths, pruning ones with positive slack'], 1, 'Topologically sort the timing graph and propagate max arrival times forward once: O(V + E). Dynamic programming on a DAG: each node\'s arrival time is the max over its fan-in of (arrival + edge delay). One pass, linear time.'),
    mc('Which algorithm finds a combinational loop in a netlist?', ['Binary search over the sorted gate list', 'Depth-first search for a back edge', 'Breadth-first search for the shortest path', 'Structural hashing of identical gates'], 1, 'A back edge in DFS means a cycle. The simulator in this game reports "combinational loop" exactly this way.'),
    say('**Hash tables** are the other workhorse: symbol tables in compilers, structural hashing in logic synthesis (identical gates get merged automatically), and caches of expensive results.'),
    mc('A hash table\'s lookups slow down to O(n). What is the most likely cause?', ['The table has too many empty buckets', 'Most keys land in the same bucket', 'The keys are long strings', 'The table was resized to double its size'], 1, 'A bad hash function (or an adversarial input) sends most keys to the same bucket, so each lookup walks one long chain. Hash tables are O(1) on average only if keys spread evenly. Resize when the load factor grows and use a good hash.'),
    gen((r) => {
      const n = pick(r, [1000, 1000000]);
      const [name, f, label] = pick(r, [['O(n log n)', (x: number) => x * Math.log2(x), 'n·log2 n'], ['O(n²)', (x: number) => x * x, 'n²']] as const);
      const ops = f(n);
      const t = ops / 1e9;
      return ask(`An ${name} algorithm on n = ${n.toLocaleString('en-US')} at 1e9 simple operations per second takes roughly how many **seconds**? (${label} operations)`, qty(t, 's', 0.1), `${label} ≈ ${ops.toExponential(2)} operations ÷ 1e9/s ≈ ${t.toPrecision(2)} s.`, `Compute ${label}, then divide by 1e9.`);
    }),
  ],
  recap: ['Know the Big-O of arrays, lists, hash tables, trees, heaps.', 'Netlists are graphs: BFS/A* routing, topo-sort STA, union-find connectivity, DFS loop detection.', 'Avoid O(n²) at chip scale: spatial hashing, trees.', 'Hash tables are O(1) average only with a good hash and load factor.'],
};

export const asm: Lesson = {
  id: 'asm',
  title: 'Where Software Meets Silicon',
  concept: 'assembly, compilers, linkers, loaders',
  xp: 90,
  steps: [
    say('The **instruction set architecture** (ISA) is the contract between hardware and software. Chip designers implement it; compilers target it. Let us use **RISC-V**, the open ISA that has taken over teaching and a lot of industry.'),
    art(`
   addi x1, x0, 5      # x1 = 0 + 5     (x0 is hard-wired to zero)
   addi x2, x0, 7      # x2 = 7
   add  x3, x1, x2     # x3 = x1 + x2
   sw   x3, 0(x10)     # memory[x10 + 0] = x3
   lw   x4, 4(x10)     # x4 = memory[x10 + 4]
   beq  x3, x4, done   # branch if equal`),
    gen((r) => {
      const a = between(r, 2, 9), b = between(r, 2, 9), s = between(r, 1, 3);
      const res = ((a + b) << s) - a;
      return ask(`After \`addi x1, x0, ${a}\`, \`addi x2, x0, ${b}\`, \`add x3, x1, x2\`, \`slli x3, x3, ${s}\`, \`sub x3, x3, x1\`, what is x3? (decimal)`, num(res), `x3 = (${a} + ${b}) << ${s} = ${(a + b) << s}, minus ${a} = ${res}.`, 'slli shifts left: multiply by 2^' + s + '.');
    }),
    say('How does C become those instructions? The compiler pipeline. This game\'s own Verilog simulator uses the first half of it.'),
    art(`
   source ─► preprocess ─► LEX (characters → tokens)
          ─► PARSE (tokens → abstract syntax tree)
          ─► semantic analysis (types, scopes)
          ─► IR + optimize (SSA, constant folding, inlining...)
          ─► CODEGEN (instruction selection, register allocation, scheduling)
          ─► assemble ─► object file (.o)
          ─► LINK ─► executable ─► LOAD ─► run`),
    mc('Which stage turns `x = y + 42;` into the sequence IDENT, EQUALS, IDENT, PLUS, NUMBER, SEMI?', ['Parser', 'Lexer', 'Linker', 'Loader'], 1, 'The lexer groups characters into tokens; the parser then builds a tree from the tokens according to the grammar.'),
    mc('You get `undefined reference to \'uart_init\'`. Which tool is complaining?', ['The preprocessor', 'The compiler', 'The linker', 'The loader'], 2, 'Each .c file compiled fine on its own; the linker could not find a definition for the symbol when combining object files. Usually a missing source file or library on the link line.'),
    say('The **linker** combines object files, resolves symbols, and patches addresses (relocations). The **loader** maps the program into memory, sets up the stack, and jumps to the entry point. On a bare-metal chip, **you** write the linker script that says where code, data and stack live in the chip\'s memory map.'),
    mc('Which of these is decided by the **calling convention** (the ABI)?', ['How each instruction is encoded in binary', 'Which registers pass arguments and results', 'How far the stack and heap may grow', 'Which instructions the pipeline may reorder'], 1, 'The ABI fixes which registers hold arguments and return values, and which ones a function must preserve. RISC-V passes arguments in a0-a7, returns in a0 (a0-a1 for two-word values), and splits registers into caller-saved and callee-saved. Compilers and hand-written assembly must agree on it.'),
    say('Assembly has **pseudo-instructions**: friendly spellings that the assembler expands into real ones. `mv a0, a1` is `addi a0, a1, 0`, and `ret` is `jalr x0, ra, 0`. The practice lab keeps `call` and `la` short for simplicity, but real toolchains expand them like this:'),
    art(`
   call f   →  auipc ra, hi(f)      # upper 20 bits of the PC-relative offset
               jalr  ra, lo(f)(ra)  # reaches any address within about ±2 GiB
               (marked relaxable: if f is within ±1 MiB the linker shrinks it to one jal)
   tail f   →  auipc t1, hi(f)
               jr    t1             # a jump that discards the return address
   la a0, x →  auipc a0, hi(x)      # non-PIC: PC-relative address of x
               addi  a0, a0, lo(x)`),
    say('Real RISC-V cores run in **privilege modes**: **M** (machine: always present, full control, where firmware boots), **S** (supervisor: where an OS kernel runs) and **U** (user: ordinary programs). A program asks the next mode up for help with `ecall`; the hardware switches mode and jumps to a handler. The labs here stay in machine mode.'),
    say('Every jump to a handler is a **trap**. An **exception** is caused by the instruction itself (an illegal opcode, a bad address, `ecall`). An **interrupt** comes from outside, a timer or a device, and is taken between instructions. Either way the hardware records where to resume in `mepc`, why in `mcause` (the top bit marks an interrupt), clears the global interrupt-enable bit in `mstatus`, and jumps to the address in `mtvec`. The handler ends with `mret`. Those registers are **CSRs**, read and written with `csrr`, `csrw` and `csrrw`.'),
    mc('A trap handler has been entered. Which CSR says why?', ['mepc', 'mcause', 'mtvec', 'mscratch'], 1, '`mcause` holds the reason: 2 is an illegal instruction, 11 is `ecall` from machine mode, and a value with the top bit set is an interrupt (0x80000007 is the machine timer). `mepc` is where to resume, `mtvec` is where the handler lives, and `mscratch` is a free register for the handler to start with.'),
    mc('An exception handler for an illegal instruction wants to continue after it. What must it do with `mepc` before `mret`?', ['Leave it alone, since mret skips the faulting instruction itself', 'Add 4, because mepc points at the faulting instruction', 'Zero it, so that execution restarts from the first address', 'Copy it to ra, because mret returns through the ra register'], 1, 'For an exception `mepc` is the address of the instruction that trapped, so returning without changing it runs the same instruction and traps forever. Adding 4 steps over it. (An interrupt is different: `mepc` is the next instruction, so the handler leaves it alone.)'),
    say('Three more words you will meet. **fence** orders memory accesses: a driver puts one between filling a buffer and writing the device\'s doorbell register, so the device can never see the doorbell before the data. The **A** extension adds atomics (`lr`/`sc` and `amoadd`) so cores can share locks safely. The **C** extension adds 16-bit encodings of common instructions for denser code, which is why real cores accept an instruction at any even address. And **RV64** keeps the same instructions with 64-bit registers and addresses.'),
    say('Last detail that trips everyone: **endianness**. Little-endian machines (x86, most ARM and RISC-V systems) store the **least** significant byte at the lowest address.'),
    gen((r) => {
      const v = (between(r, 0x10, 0xfe) << 24) | (between(r, 0x10, 0xfe) << 16) | (between(r, 0x10, 0xfe) << 8) | between(r, 0x10, 0xfe);
      const k = between(r, 0, 3);
      const byte = (v >>> (8 * k)) & 0xff;
      const hex = (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
      return ask(`A little-endian CPU stores the 32-bit word 0x${hex} at address 0x100. What byte is at address 0x10${k}? (hex)`, hexa(byte, 2), `Little-endian puts the least significant byte first: 0x100=${hex.slice(6, 8)}, 0x101=${hex.slice(4, 6)}, 0x102=${hex.slice(2, 4)}, 0x103=${hex.slice(0, 2)}.`, 'The lowest address holds the lowest-order byte (the last two hex digits).');
    }),
  ],
  recap: ['The ISA is the HW/SW contract; RISC-V is the open one.', 'Traps: mepc (where), mcause (why), mtvec (handler), mret; modes M, S, U.', 'Compiler: lex → parse → semantic → IR/optimize → codegen → assemble.', 'Linker resolves symbols/relocations; loader maps and starts the program.', 'ABI: argument registers, caller/callee-saved.', 'Little-endian: least significant byte at the lowest address.'],
};

export const os: Lesson = {
  id: 'os',
  title: 'Operating Systems',
  concept: 'scheduling, virtual memory, concurrency, I/O',
  xp: 100,
  steps: [
    say('An operating system shares one chip among many programs. Almost every OS feature leans on hardware you might design: timers for scheduling, the MMU for virtual memory, atomic instructions for locks, interrupt controllers and DMA engines for I/O.'),
    say('**Scheduling** first. The OS uses a timer interrupt to take the CPU away from one process and give it to another: a **context switch**. Policies trade throughput against response time.'),
    gen((r) => {
      const b = [between(r, 2, 9), between(r, 2, 9), between(r, 2, 9)];
      const waits = [0, b[0], b[0] + b[1]];
      const avg = (waits[0] + waits[1] + waits[2]) / 3;
      return ask(`Three jobs arrive at t = 0 in order with CPU bursts ${b.join(', ')} ms. Under first-come-first-served, what is the **average waiting time** in ms?`, qty(avg, 'ms', 0.02, avg.toFixed(2)), `Waits are 0, ${b[0]}, ${b[0] + b[1]}; average = ${avg.toFixed(2)} ms. Running the shortest job first would minimize it: that is SJF.`, 'Each job waits for the bursts of all jobs before it.');
    }),
    say('**Virtual memory**: each process sees its own private address space. The MMU translates virtual pages to physical frames using a page table the OS maintains. Pages are usually **4 KiB**, so the low 12 bits are the offset within the page.'),
    art(`
   virtual address 0x0000_3ABC  (4 KiB pages)
      VPN = 0x3   offset = 0xABC
   page table[0x3] = frame 0x7
      physical address = 0x7ABC`),
    gen((r) => {
      const vpn = between(r, 1, 9), off = between(r, 0x100, 0xfff), pfn = between(r, 0x10, 0x3f);
      const va = (vpn << 12) | off, pa = (pfn << 12) | off;
      return ask(`4 KiB pages. The page table maps VPN 0x${vpn.toString(16).toUpperCase()} → frame 0x${pfn.toString(16).toUpperCase()}. Translate virtual address 0x${va.toString(16).toUpperCase()}. (hex)`, hexa(pa), `Offset = low 12 bits = 0x${off.toString(16).toUpperCase()}; VPN = 0x${vpn.toString(16).toUpperCase()} → frame 0x${pfn.toString(16).toUpperCase()}; PA = 0x${pa.toString(16).toUpperCase()}.`, 'Keep the last three hex digits, replace the rest with the frame number.');
    }),
    mc('A program touches a page that is not in physical memory. What happens?', ['The CPU halts with a machine check', 'A page fault traps to the OS', 'The load silently returns zero', 'The TLB loads it from disk by itself'], 1, 'The OS loads the page (from disk or by allocating it), updates the page table and retries the instruction. Page faults are how demand paging, copy-on-write and memory-mapped files work. Too many of them is "thrashing".'),
    say('**Concurrency**: threads share memory, which is powerful and dangerous.'),
    art(`
   counter++   is really   load r, counter
                            add  r, r, 1
                            store r, counter

   two threads can both load 5, both store 6: an increment is lost`),
    mc('Two threads each run `counter++` 1000 times with no lock, starting at 0. What is the final value?', ['Exactly 2000, since each ++ is one instruction', 'Exactly 1000', 'Anything up to 2000; often less', 'A crash from the conflicting writes'], 2, 'It is a race: read-modify-write sequences interleave and increments get lost. Fix it with a mutex or an atomic instruction (RISC-V amoadd, x86 lock xadd), which the hardware implements using cache coherence.'),
    mc('Thread 1 locks A then B. Thread 2 locks B then A. What can happen?', ['Nothing, as long as both locks are mutexes', 'Deadlock: each waits forever for the other', 'Livelock, but never a true deadlock', 'The OS detects the cycle and breaks it'], 1, 'Each thread holds one lock and waits for the other. Deadlock needs mutual exclusion, hold-and-wait, no preemption and a circular wait. The standard fix is a global lock order. Hardware has the same problem: NoC and bus deadlocks come from cyclic dependencies too.'),
    say('Finally **I/O**. Three ways for a CPU to talk to a device, in increasing sophistication:'),
    art(`
   polling    CPU loops reading a status register      simple, burns CPU
   interrupt  device signals the CPU when it is ready    CPU free meanwhile
   DMA        device copies data to memory by itself    CPU only sets it up`),
    mc('A network card receives 10 Gb/s of packets. Best approach?', ['Polling the status register for each byte', 'An interrupt for every byte received', 'DMA into ring buffers, with batched interrupts', 'An interrupt per packet, with the CPU copying the data'], 2, 'At high rates, per-byte work would swamp the CPU. DMA engines plus descriptor rings are how every high-speed device works, and designing them is a hardware job.'),
  ],
  recap: ['Timer interrupts enable preemptive scheduling; FCFS vs SJF vs round-robin.', 'Virtual memory: page tables, 4 KiB pages → 12-bit offset, page faults.', 'Races lose updates; use mutexes or atomics. Deadlock from circular waits.', 'I/O: polling < interrupts < DMA.'],
};

export const SYSTEMS_LESSONS = [clang, cpp, dsa, asm, os];

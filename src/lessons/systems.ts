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
    gen((r) => {
      const v = between(r, 0x10, 0xef);
      const s = between(r, 0, 7);
      const set = [0, 1, 2, 3, 4, 5, 6, 7].filter((b) => b !== s && (v >> b) & 1);
      const c = set.length ? pick(r, set) : (s + 1) % 8;
      const res = (v | (1 << s)) & ~(1 << c) & 0xff;
      return ask(`\`uint8_t r = 0x${v.toString(16).toUpperCase()}; r |= (1u << ${s}); r &= ~(1u << ${c});\` What is r? (hex)`, hexa(res, 2), `Set bit ${s}, then clear bit ${c}: 0x${res.toString(16).toUpperCase().padStart(2, '0')}.`, 'Write 0x' + v.toString(16).toUpperCase() + ' in binary, set one bit, clear the other.');
    }),
    mc('Why must a pointer to a hardware status register be declared `volatile`?', ['To make it faster, since volatile accesses skip the cache', 'So the compiler re-reads it each time, as hardware can change it', 'To make it read-only, so software cannot write to the register', 'Volatile makes it thread-safe, so two cores can share the register'], 1, 'It does not cache the value in a register, as the hardware can change it behind the program\'s back. Without volatile, `while (*status == 0);` may be optimized into an infinite loop that reads once. Note volatile does NOT give atomicity or ordering between cores; that needs barriers.'),
    say('C gives you raw memory and no safety net. Local variables live on the **stack** and vanish when the function returns. `malloc` memory lives on the **heap** until you `free` it.'),
    mc('Which of these is a bug?', ['Returning a pointer to a local array from a function', 'Passing a pointer to a local array into a function that it calls', 'Freeing a block of heap memory exactly once when it is done', 'Using sizeof on a struct to get the number of bytes it takes'], 0, 'The local array dies when the function returns, so the caller gets a dangling pointer. Memory bugs like this are why firmware teams run static analyzers and sanitizers.'),
    ask('On a typical 32/64-bit ABI, what is `sizeof(struct { char a; int b; })`?', num(8), 'The int must be 4-byte aligned, so the compiler inserts 3 bytes of padding after `a`: 1 + 3 + 4 = 8. Register maps in drivers use exact-width types and packing rules for exactly this reason.', 'Think about alignment: where can a 4-byte int start?'),
    mc('`int x = INT_MAX; x = x + 1;` What does the C standard say happens?', ['x stays INT_MAX, since the addition saturates in hardware', 'Undefined behavior', 'x becomes INT_MIN, since two\'s complement wraps around', 'A runtime exception, which the C library turns into an abort'], 2, 'Signed overflow is undefined behavior in C (unsigned wraps). Hardware wraps, but the optimizer is allowed to assume it never happens. A subtle difference between modelling and silicon.'),
  ],
  recap: ['Pointers hold addresses; pointer + n moves n × sizeof(type).', 'Bit idioms: |= set, &= ~ clear, ^= toggle, >> & test.', 'volatile for memory-mapped registers (not for atomicity).', 'Stack vs heap; dangling pointers; struct padding.', 'Signed overflow is undefined behavior in C.'],
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
    mc('Why does the base class above declare a **virtual destructor**?', ['Style only, as the compiler generates the same code either way', 'So deleting through a base pointer runs the derived destructor', 'Destructors must always be virtual, whatever the class is for', 'To make the class abstract, so that it cannot be instantiated'], 1, 'Otherwise it is undefined behavior. Any class meant to be deleted polymorphically needs a virtual destructor. UVM has the same idea: the factory creates derived objects that you handle through base handles.'),
    say('The most important C++ idea is **RAII**: resource acquisition is initialization. Tie every resource (memory, a file, a lock) to an object whose destructor releases it. Then cleanup happens automatically, even on early returns and exceptions.'),
    art(`
  {
    std::lock_guard<std::mutex> g(m);      // lock taken
    auto buf = std::make_unique<Packet>(); // heap object owned by buf
    if (bad) return;                       // both released automatically
  }                                        // ...and here too`),
    mc('`unique_ptr` vs `shared_ptr`?', ['They are identical, apart from the name used in the headers', 'unique_ptr has one owner; shared_ptr is reference-counted', 'shared_ptr is faster than unique_ptr, as it skips the delete', 'unique_ptr can be copied freely, like any other pointer type'], 1, 'unique_ptr is move-only with zero overhead; shared_ptr frees the object when the last owner goes. Prefer unique_ptr. Use shared_ptr only when ownership is genuinely shared. Raw `new`/`delete` in modern C++ is a code smell.'),
    say('**Templates** generate code for any type at compile time, like Verilog parameters but far more powerful. The Standard Library\'s containers are templates: `std::vector<T>`, `std::unordered_map<K, V>`, `std::map<K, V>`.'),
    mc('You need to look up cells by name, millions of times, and never need them in sorted order. Which container?', ['std::vector with a linear search through all of the names', 'std::map (balanced tree, with O(log n) for each lookup)', 'std::unordered_map (hash table, O(1) average)', 'std::list, which keeps the cells in the order that they came'], 2, 'Hash map for pure lookup. Use std::map only when you need ordered iteration or range queries.'),
    mc('What does `std::move(v)` do?', ['Copies v into the destination', 'Casts v to an rvalue, so a move can steal its resources', 'Deletes v, and frees the memory that it was holding on to', 'Moves v to the heap'], 1, 'It is used instead of a deep copy. Move semantics turn expensive copies of big buffers into pointer swaps. After a move, v is valid but unspecified (usually empty).'),
    ask('Which C++ keyword marks a method that must re-implement a base-class virtual function, so the compiler errors if the signature does not match?', words('override'), '`override` catches typos in signatures that would otherwise silently create a new, unrelated function.', 'SystemVerilog does not have it, which is why UVM callbacks sometimes silently never get called.'),
  ],
  recap: ['Classes, inheritance, virtual dispatch via vtables (the root of SV/UVM classes).', 'Virtual destructors for polymorphic bases.', 'RAII: destructors release resources; prefer unique_ptr.', 'Templates and the STL: vector, unordered_map (O(1)), map (O(log n)).', 'Move semantics avoid deep copies.'],
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
      return ask(`Binary search over 2^${k} sorted items takes at most about how many comparisons?`, num(k), `Each comparison halves the range: log2(2^${k}) = ${k}.`, 'How many times can you halve 2^' + k + ' before reaching 1?');
    }),
    mc('A placement checker compares every cell with every other cell for overlaps. For 10 million cells that is too slow. Its complexity and the fix?', ['O(n), so nothing needs to be fixed in the way that it works', 'O(n²); bin the die into a grid so cells check only neighbours', 'O(log n); use a heap, so that the closest cell is checked first', 'O(n!); give up, since no better way to do the check is known'], 1, 'Spatial hashing: each cell only checks its neighbours. All-pairs is O(n²) = 1e14 checks. A grid or a spatial tree (R-tree, quadtree) brings it to about O(n).'),
    say('**Graphs** are the core of EDA. Nodes are pins or gates, edges are wires. The classic algorithms appear everywhere:'),
    art(`
   BFS / Lee maze routing ........ shortest route for a wire on a grid
   Dijkstra / A* ................. weighted routing, path finding
   topological sort .............. static timing analysis on a DAG
   union-find .................... connectivity (the board lab's net checker)
   min-cut partitioning .......... splitting a design for placement
   DFS / strongly connected ...... finding combinational loops`),
    mc('How does STA find the worst arrival time at every node **without enumerating paths** (there can be exponentially many)?', ['It samples random paths, and takes the worst one that it found', 'Sort the timing graph, then propagate max arrivals once: O(V + E)', 'It uses a hash table of every path, which is keyed by its endpoints', 'It runs a simulation of the netlist with random input vectors'], 1, 'Dynamic programming on a DAG: each node\'s arrival time is the max over its fan-in of (arrival + edge delay). One pass, linear time.'),
    mc('Which algorithm finds a combinational loop in a netlist?', ['Binary search over the nets, sorted by their logic depth', 'Depth-first search for a back edge (a cycle)', 'Quicksort of the gates', 'Hashing of the gates'], 1, 'A back edge in DFS means a cycle. The simulator in this game reports "combinational loop" exactly this way.'),
    say('**Hash tables** are the other workhorse: symbol tables in compilers, structural hashing in logic synthesis (identical gates get merged automatically), and caches of expensive results.'),
    mc('A hash table\'s lookups slow down to O(n). What is the most likely cause?', ['The table is too empty, so each lookup has to scan all slots', 'A bad hash function sends most keys to the same bucket', 'The keys are strings, which cannot be hashed in constant time', 'The table uses too much memory, so it is swapped out to disk'], 1, 'An adversarial input can do the same. Hash tables are O(1) on average only if keys spread evenly. Resize when the load factor grows and use a good hash.'),
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
    mc('Which of these is decided by the **calling convention** (the ABI)?', ['The clock frequency at which the processor core is running', 'Which registers hold arguments and which a function preserves', 'The size of the cache, in kilobytes, at each level of it', 'The instruction encoding, which is fixed by the hardware design'], 1, 'RISC-V passes arguments in a0-a7, returns in a0, and splits registers into caller-saved and callee-saved. Compilers and hand-written assembly must agree on it.'),
    say('Last detail that trips everyone: **endianness**. Little-endian machines (x86, most ARM and RISC-V systems) store the **least** significant byte at the lowest address.'),
    gen((r) => {
      const v = (between(r, 0x10, 0xfe) << 24) | (between(r, 0x10, 0xfe) << 16) | (between(r, 0x10, 0xfe) << 8) | between(r, 0x10, 0xfe);
      const k = between(r, 0, 3);
      const byte = (v >>> (8 * k)) & 0xff;
      const hex = (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
      return ask(`A little-endian CPU stores the 32-bit word 0x${hex} at address 0x100. What byte is at address 0x10${k}? (hex)`, hexa(byte, 2), `Little-endian puts the least significant byte first: 0x100=${hex.slice(6, 8)}, 0x101=${hex.slice(4, 6)}, 0x102=${hex.slice(2, 4)}, 0x103=${hex.slice(0, 2)}.`, 'The lowest address holds the lowest-order byte (the last two hex digits).');
    }),
  ],
  recap: ['The ISA is the HW/SW contract; RISC-V is the open one.', 'Compiler: lex → parse → semantic → IR/optimize → codegen → assemble.', 'Linker resolves symbols/relocations; loader maps and starts the program.', 'ABI: argument registers, caller/callee-saved.', 'Little-endian: least significant byte at the lowest address.'],
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
    mc('A program touches a page that is not in physical memory. What happens?', ['The CPU crashes', 'A page fault: the OS loads the page and retries', 'The access returns zero, and the program carries on running', 'The TLB fixes it, by loading the page from memory by itself'], 1, 'The page comes from disk, or by allocating a new one. Page faults are how demand paging, copy-on-write and memory-mapped files work. Too many of them is "thrashing".'),
    say('**Concurrency**: threads share memory, which is powerful and dangerous.'),
    art(`
   counter++   is really   load r, counter
                            add  r, r, 1
                            store r, counter

   two threads can both load 5, both store 6: an increment is lost`),
    mc('Two threads each run `counter++` 1000 times with no lock, starting at 0. What is the final value?', ['Exactly 2000, since each increment is a single indivisible step', 'Exactly 1000, since only one of the threads can run at a time', 'Anything up to 2000; often less', 'Always 0, since the threads undo each other at the end of the run'], 2, 'It is a race: read-modify-write sequences interleave and increments get lost. Fix it with a mutex or an atomic instruction (RISC-V amoadd, x86 lock xadd), which the hardware implements using cache coherence.'),
    mc('Thread 1 locks A then B. Thread 2 locks B then A. What can happen?', ['Nothing: the locks are safe', 'Deadlock: each holds one lock and waits for the other', 'Livelock only, with both threads busy and neither of them stuck', 'The OS merges the two locks into one'], 1, 'Deadlock needs mutual exclusion, hold-and-wait, no preemption and a circular wait. The standard fix is a global lock order. Hardware has the same problem: NoC and bus deadlocks come from cyclic dependencies too.'),
    say('Finally **I/O**. Three ways for a CPU to talk to a device, in increasing sophistication:'),
    art(`
   polling    CPU loops reading a status register      simple, burns CPU
   interrupt  device signals the CPU when it is ready    CPU free meanwhile
   DMA        device copies data to memory by itself    CPU only sets it up`),
    mc('A network card receives 10 Gb/s of packets. Best approach?', ['Polling each byte, in a loop, with the CPU copying them by hand', 'An interrupt for each byte, so that every byte is seen at once', 'DMA into ring buffers, with interrupts batched per group', 'Disable I/O during bursts'], 2, 'At high rates, per-byte work would swamp the CPU. DMA engines plus descriptor rings are how every high-speed device works, and designing them is a hardware job.'),
  ],
  recap: ['Timer interrupts enable preemptive scheduling; FCFS vs SJF vs round-robin.', 'Virtual memory: page tables, 4 KiB pages → 12-bit offset, page faults.', 'Races lose updates; use mutexes or atomics. Deadlock from circular waits.', 'I/O: polling < interrupts < DMA.'],
};

export const SYSTEMS_LESSONS = [clang, cpp, dsa, asm, os];

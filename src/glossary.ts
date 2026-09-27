// TAPEOUT's built-in knowledge base: `define <term>` / `what is <term>` in the terminal.
// Each entry: [term, aliases..., definition, lesson id to learn more].

type Entry = { terms: string[]; def: string; lesson?: string };

const E = (terms: string, def: string, lesson?: string): Entry => ({ terms: terms.split('|'), def, lesson });

export const GLOSSARY: Entry[] = [
  E('bit|binary', 'A single binary digit, 0 or 1: one wire, high or low. Binary counts in powers of two.', 'bits'),
  E('hex|hexadecimal|nibble', 'Base 16. One hex digit = 4 bits (a nibble), so a byte is two hex digits: 0xD6 = 1101 0110.', 'bits'),
  E("two's complement|twos complement|signed", 'The standard way to store signed integers: the top bit has negative weight. Negate by inverting all bits and adding 1.', 'twos'),
  E('overflow', 'A result that does not fit in the available bits. Signed overflow: adding two numbers of the same sign gives a result of the other sign.', 'twos'),
  E('sign extension', 'Widening a signed number by copying its top bit into the new bits, so its value is preserved.', 'twos'),
  E("ohm's law|ohms law", 'V = I × R. Voltage across a resistor equals current times resistance.', 'ohm'),
  E('voltage divider|divider', 'Two series resistors that output a fraction of the input: Vout = Vin × R2 / (R1 + R2).', 'ohm'),
  E('time constant|tau|rc', 'τ = R × C: the time an RC circuit takes to reach ~63% of a step. After 5τ it is ~99% settled.', 'rc'),
  E('decoupling capacitor|decap|bypass capacitor', 'A capacitor placed right next to a chip\'s power pins as a local charge reservoir for fast current spikes.', 'rc'),
  E('partial derivative|gradient', 'The rate of change with respect to one variable, others held fixed. The gradient stacks all partials and points uphill.', 'calc'),
  E('divergence|curl|stokes', 'Divergence measures how much a field spreads from a point; curl how much it circulates. Stokes: circulation around a loop = flux of curl through it.', 'calc'),
  E('lagrange multiplier|lagrange', 'A method to optimize f subject to a constraint g = 0: at the optimum ∇f = λ∇g.', 'calc'),
  E('eigenvalue|eigenvector', 'A·x = λ·x: directions a matrix only stretches. In dx/dt = Ax, eigenvalues with negative real parts mean a stable system.', 'linalg'),
  E('lu decomposition|lu', 'Factoring A = L·U into triangular matrices to solve linear systems. SPICE does this at every step.', 'linalg'),
  E('svd|singular value decomposition', 'A = U·Σ·Vᵀ. Keeping the largest singular values gives the best low-rank approximation (model reduction, PCA).', 'linalg'),
  E('ode|differential equation', 'An equation relating a function to its derivatives. An RC circuit is first order; an RLC circuit is second order.', 'ode'),
  E('damping ratio|zeta|underdamped|overdamped', 'ζ for a second-order system: < 1 rings, = 1 is critically damped, > 1 is sluggish.', 'ode'),
  E('band gap|bandgap', 'The energy gap between the valence and conduction bands. Silicon: 1.12 eV. Large gap = insulator.', 'semi'),
  E('doping|n-type|p-type|donor|acceptor', 'Adding impurities to silicon: donors (P, As) give electrons (n-type), acceptors (B) give holes (p-type).', 'semi'),
  E('pn junction|diode|depletion region', 'p-type next to n-type: a depletion region with a built-in field. Forward current grows ~10× per 60 mV.', 'semi'),
  E('threshold voltage|vt|vth', 'The gate voltage at which a MOSFET forms a conducting channel. Lower Vt = faster but leakier.', 'mosphys'),
  E('dibl|short channel effect|short-channel effects|velocity saturation', 'Effects of very short transistors: velocity saturation, DIBL (drain lowers the barrier, so Vt drops), Vt roll-off, channel-length modulation.', 'mosphys'),
  E('leakage|subthreshold', 'Current through an "off" transistor: subthreshold (≥60 mV/decade), gate tunneling, GIDL, junction. Worse when hot.', 'mosphys'),
  E('finfet|gaa|gate all around|nanosheet', 'Transistors whose gate wraps around the channel for better electrostatic control and lower leakage.', 'mosphys'),
  E('nmos|pmos|mosfet|transistor', 'MOSFETs are voltage-controlled switches. NMOS conducts with gate = 1 and pulls down; PMOS conducts with gate = 0 and pulls up.', 'mos'),
  E('cmos', 'Complementary MOS: a PMOS pull-up network and a dual NMOS pull-down network. No static current flows.', 'mos'),
  E('pointer', 'A variable holding a memory address. pointer + n moves by n × sizeof(type).', 'c'),
  E('volatile', 'C qualifier telling the compiler a value can change behind its back (a hardware register), so it must be re-read every time.', 'c'),
  E('raii|smart pointer|unique_ptr|shared_ptr', 'C++: tie resources to object lifetimes so destructors release them. unique_ptr has one owner; shared_ptr is reference-counted.', 'cpp'),
  E('virtual function|vtable|polymorphism', 'A method dispatched on the object\'s runtime type through a table of function pointers.', 'cpp'),
  E('big o|big-o|complexity', 'How an algorithm\'s cost grows with input size: O(1), O(log n), O(n), O(n log n), O(n²)...', 'dsa'),
  E('hash table|hash map', 'Key-value store with O(1) average lookup via a hash function. Degrades with bad hashes or a high load factor.', 'dsa'),
  E('topological sort', 'Ordering a DAG so every edge goes forward. STA uses it to propagate arrival times in one pass.', 'dsa'),
  E('union find|union-find|disjoint set', 'A structure that merges sets and answers "same set?" nearly in O(1). Used for connectivity checks.', 'dsa'),
  E('isa|instruction set', 'The instruction set architecture: the contract between hardware and software (x86, ARM, RISC-V).', 'asm'),
  E('risc-v|riscv', 'An open, modular ISA widely used in teaching, embedded cores and increasingly everywhere.', 'asm'),
  E('lexer|parser|compiler', 'Compiler front end: the lexer turns characters into tokens, the parser turns tokens into a syntax tree.', 'asm'),
  E('linker|loader', 'The linker combines object files and resolves symbols; the loader maps the program into memory and starts it.', 'asm'),
  E('endianness|little endian|big endian', 'Byte order in memory. Little-endian stores the least significant byte at the lowest address.', 'asm'),
  E('virtual memory|page table|paging|page fault', 'Each process gets a private address space; the MMU translates pages via page tables. Missing pages trap as page faults.', 'os'),
  E('mutex|race condition|deadlock', 'A race: interleaved accesses give wrong results. A mutex serializes them. Deadlock: a cycle of threads each waiting on the next.', 'os'),
  E('dma|interrupt|polling', 'Ways to do I/O: polling (CPU checks), interrupts (device signals), DMA (device moves data itself).', 'os'),
  E('de morgan|demorgan', '!(A & B) = !A | !B and !(A | B) = !A & !B. Push an inversion through a gate by flipping AND/OR.', 'bool'),
  E('nand|nor|universal gate', 'NAND and NOR are universal: any logic function can be built from either alone.', 'bool'),
  E('mux|multiplexer', 'Selects one of several inputs with select bits: N inputs need log2(N) selects.', 'comb'),
  E('full adder|half adder|ripple carry', 'A half adder adds two bits (sum = a^b, carry = a&b). Full adders also take a carry-in and chain into ripple-carry adders.', 'comb'),
  E('latch', 'A level-sensitive storage element: transparent while enabled. In RTL, an unintended latch comes from an incomplete combinational assignment.', 'seq'),
  E('flip-flop|flip flop|dff|register', 'An edge-triggered storage element: captures D on the clock edge.', 'seq'),
  E('setup time|hold time|setup|hold', 'Setup: data stable before the clock edge. Hold: data stable after it. Violations can cause metastability.', 'sta'),
  E('fsm|state machine|mealy|moore', 'Finite state machine. Moore outputs depend on state only; Mealy outputs also depend on inputs.', 'fsm'),
  E('one-hot|one hot', 'State encoding with one flip-flop per state: more flops, simpler and faster logic.', 'fsm'),
  E('verilog|systemverilog|rtl', 'Hardware description languages. RTL (register-transfer level) describes registers and the logic between them.', 'verilog'),
  E('non-blocking|nonblocking|blocking assignment|<=', 'In Verilog, <= (non-blocking) updates after all right-hand sides are sampled: use it in clocked blocks. = is blocking: use it in combinational blocks.', 'verilog'),
  E('carry lookahead|kogge-stone|prefix adder', 'Fast adders that compute carries with generate/propagate signals in log2(n) levels.', 'alu'),
  E('booth|wallace tree|multiplier', 'Multipliers: Booth recoding halves the partial products; Wallace/Dadda trees reduce them in O(log n) levels.', 'alu'),
  E('metastability|synchronizer|cdc|clock domain crossing', 'A flop sampling an asynchronous change can hang between 0 and 1. Synchronizer flops make failure exponentially unlikely.', 'clk'),
  E('gray code', 'A code where consecutive values differ in exactly one bit: gray = b ^ (b >> 1). Used for async FIFO pointers.', 'clk'),
  E('async fifo|asynchronous fifo', 'A FIFO with separate read and write clocks; Gray-coded pointers cross the domains to compute full and empty.', 'clk'),
  E('skew|jitter|clock tree|cts', 'Skew: the same edge arriving at different flops at different times. Jitter: period variation. CTS builds a low-skew clock tree.', 'clk'),
  E('reset synchronizer', 'Asserts reset asynchronously but releases it on a clock edge, avoiding recovery/removal violations.', 'clk'),
  E('sta|static timing analysis|slack|wns|tns', 'Checking every path meets setup and hold without simulation. Slack = required - arrival; WNS = worst slack, TNS = sum of negative slacks.', 'sta'),
  E('false path|multicycle path|sdc', 'SDC timing exceptions: false paths are never timed; multicycle paths get N cycles.', 'sta'),
  E('corner|pvt|ocv', 'Process-voltage-temperature corners; OCV derates variation within one die.', 'sta'),
  E('noise margin|vtc', 'The voltage transfer curve of a gate; noise margins NM_H = V_OH - V_IH and NM_L = V_IL - V_OL.', 'vlsi'),
  E('elmore delay|elmore', 'An RC tree delay estimate: sum of each capacitance times the resistance upstream of it.', 'vlsi'),
  E('logical effort|fo4', 'Gate delay d = g·h + p. Best stage effort is ~4, hence FO4 as a unit of delay.', 'vlsi'),
  E('drc|lvs|extraction|pex', 'Physical verification: design rule checks, layout vs schematic, and parasitic extraction.', 'vlsi'),
  E('dynamic power|switching power', 'P = α·C·V²·f. Voltage is the strongest lever.', 'power'),
  E('clock gating|icg', 'Stopping the clock to idle registers with a latch-based integrated clock gate (glitch-free).', 'power'),
  E('power gating|isolation cell|retention', 'Cutting the supply to idle blocks; needs isolation cells, retention flops and rush-current control.', 'power'),
  E('level shifter|multi-voltage|upf', 'Level shifters translate signals between voltage domains; UPF describes the power intent.', 'power'),
  E('dvfs', 'Dynamic voltage and frequency scaling: lower V and f together when load is light.', 'power'),
  E('impedance|transmission line|characteristic impedance', 'Traces behave as transmission lines when fast; their impedance (e.g. 50 Ω) must be controlled to avoid reflections.', 'pcb'),
  E('differential pair|diff pair', 'Two traces carrying opposite signals; noise common to both cancels. Must be length-matched.', 'pcb'),
  E('return path|ground plane', 'Return current flows right under a fast trace in the reference plane. Never route fast nets over plane gaps.', 'pcb'),
  E('pdn|target impedance|power integrity', 'The power delivery network must keep impedance below ΔV/ΔI across frequency.', 'pcb'),
  E('testbench|dut|scoreboard', 'A testbench drives the DUT and checks results; the scoreboard compares actual against expected.', 'dv'),
  E('constrained random|dist|randomization', 'Random stimulus shaped by constraints and dist weights to hit legal, interesting cases.', 'crv'),
  E('functional coverage|covergroup|coverpoint|bins|cross', 'A model of what must be exercised; bins count hits; crosses multiply combinations.', 'crv'),
  E('uvm|agent|driver|monitor|sequencer|sequence', 'The Universal Verification Methodology: sequences make transactions, drivers drive pins, monitors observe, all inside agents.', 'uvm'),
  E('objection|run_phase|phases', 'UVM phases: build (top-down), connect, run_phase (time passes), report. Objections keep run_phase alive.', 'uvm'),
  E('sva|assertion|property', 'SystemVerilog Assertions: temporal rules like `req |-> ##[1:3] gnt` checked every cycle.', 'sva'),
  E('vacuous|vacuity', 'A property whose trigger never happened passes vacuously. Use cover properties to prove triggers occur.', 'sva'),
  E('formal verification|model checking|bmc', 'Proving properties for all inputs mathematically. BMC checks all traces up to depth k.', 'formal'),
  E('lec|equivalence checking', 'Logic equivalence checking: proving RTL and netlist implement the same function.', 'formal'),
  E('dft|scan|scan chain|atpg', 'Design for test: scan chains make flops controllable/observable; ATPG generates patterns to detect faults.', 'dft'),
  E('stuck-at|stuck at|fault coverage', 'A fault model where a node acts as tied to 0 or 1. Coverage = fraction of modelled faults detected.', 'dft'),
  E('bist|mbist|lbist', 'Built-in self-test: MBIST runs March tests on memories; LBIST uses LFSR patterns and a MISR signature.', 'dft'),
  E('jtag|tap|boundary scan', 'IEEE 1149.1: TCK/TMS/TDI/TDO and a 16-state TAP controller; boundary scan tests board connections.', 'dft'),
  E('cpi|ipc|iron law', 'Time = instructions × CPI × clock period. IPC = 1/CPI.', 'pipe'),
  E('hazard|forwarding|bypassing|stall', 'Hazards stall pipelines: structural, data (fixed mostly by forwarding) and control.', 'pipe'),
  E('out-of-order|out of order|ooo|superscalar|rob|reorder buffer', 'Executing instructions when their operands are ready, retiring in order through a reorder buffer.', 'ooo'),
  E('register renaming|renaming', 'Mapping architectural to physical registers to remove WAR and WAW dependences.', 'ooo'),
  E('branch prediction|branch predictor|tage|gshare', 'Guessing branch outcomes early. 2-bit counters, gshare and TAGE reach 95-99% accuracy.', 'ooo'),
  E('speculative execution|spectre', 'Running ahead on predictions and squashing on mispredicts; Spectre leaks data through cache side effects.', 'ooo'),
  E('cache|amat|associativity', 'Small fast memories exploiting locality. AMAT = hit time + miss rate × miss penalty.', 'cache'),
  E('tlb', 'Translation lookaside buffer: a cache of page table entries. Reach = entries × page size.', 'cache'),
  E('mesi|moesi|cache coherence|coherence', 'Protocols keeping private caches consistent per line: Modified, (Owned), Exclusive, Shared, Invalid.', 'coherence'),
  E('memory consistency|consistency model|tso|fence', 'The rules for ordering memory operations to different addresses. SC, TSO (x86), weak (ARM/RISC-V) + fences.', 'coherence'),
  E('false sharing', 'Different cores writing different data in the same cache line, causing the line to ping-pong.', 'coherence'),
  E('dram|ddr5|row buffer|refresh', 'Dynamic RAM: 1T1C cells in banks of rows; row buffer hits are fast; needs periodic refresh.', 'dram'),
  E('hbm', 'High bandwidth memory: stacked DRAM on an interposer with a 1024-bit interface per stack.', 'dram'),
  E('axi|amba|valid ready|handshake', 'AMBA AXI: five channels with VALID/READY handshakes; a transfer happens when both are high.', 'bus'),
  E('credit|flow control|backpressure', 'Flow control: VALID/READY backpressure or credits (one per free receiver buffer).', 'bus'),
  E('noc|network on chip|mesh|flit|wormhole', 'On-chip networks of routers and links carrying packets split into flits; wormhole switching pipelines them.', 'noc'),
  E('serdes|pcie|cxl|pam4|8b/10b|128b/130b', 'High-speed serial links: SerDes with embedded clocks; PCIe and CXL protocols; encodings like 128b/130b and PAM4.', 'serdes'),
  E('gem5|discrete event simulation|performance model', 'Architecture simulators; gem5 offers Atomic/Timing/Minor/O3 CPU models and SE/FS modes.', 'perf'),
  E("amdahl|amdahl's law|roofline|little's law|littles law", 'Speedup limits (Amdahl), in-flight requests = throughput × latency (Little), and compute vs bandwidth bounds (roofline).', 'perf'),
  E('tapeout|tape out|gds|gdsii', 'Sending the final layout (GDSII/OASIS) to the fab. Named after the magnetic tapes it used to go out on.'),
  E('tiny tapeout', 'A project that lets anyone put a small design on a real shared chip for a low price: tinytapeout.com.'),
  E('synthesis', 'Turning RTL into a gate-level netlist of standard cells, optimized for timing, area and power.'),
  E('place and route|pnr|p&r', 'Physical design: placing cells, building the clock tree and routing wires, then fixing timing.'),
];

const norm = (s: string) => s.toLowerCase().replace(/[?.!]/g, '').replace(/^(what|who)('s| is| are)\s+/, '').replace(/^(a|an|the)\s+/, '').trim();

function dist(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** Look up a term; tolerates plurals, "what is a...", and small typos. */
export function lookup(query: string): Entry | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const variants = [q, q.replace(/s$/, ''), q.replace(/es$/, '')];
  for (const e of GLOSSARY) if (e.terms.some((t) => variants.includes(t))) return e;
  for (const e of GLOSSARY) if (e.terms.some((t) => t.length > 3 && (q.includes(t) || (q.length > 3 && t.includes(q))))) return e;
  let best: Entry | undefined, bd = Infinity;
  for (const e of GLOSSARY) for (const t of e.terms) {
    const dd = dist(q, t);
    if (dd < bd) { bd = dd; best = e; }
  }
  return bd <= Math.max(1, Math.floor(q.length / 5)) ? best : undefined;
}

// What each lesson sets out to teach, written as things the player will be able to do by the end. Each goal is the
// rest of the sentence "By the end you will be able to ...", starts with an observable verb, and names something the
// lesson's own questions check (goals.test.ts holds them to that). Early lessons use short, plain words.

/** Verbs a goal may start with: each one names something a learner can be seen to do. */
export const GOAL_VERBS = [
  'add', 'apply', 'build', 'check', 'choose', 'compare', 'compute', 'convert', 'count', 'debug', 'decide', 'derive',
  'describe', 'draw', 'estimate', 'explain', 'find', 'identify', 'name', 'predict', 'prove', 'read', 'sketch', 'solve',
  'spot', 'tell', 'trace', 'use', 'wire', 'write', 'size', 'rank', 'translate', 'simplify', 'flip', 'pick', 'turn',
  'multiply', 'parse', 'decode', 'combine', 'show',
] as const;

/** Verbs that describe a state of mind, not something you can see a learner do. */
export const BANNED_GOAL_VERBS = ['understand', 'know', 'learn', 'appreciate', 'grasp', 'be aware', 'realize', 'feel', 'see'] as const;

export const GOALS: Record<string, string[]> = {
  // ACT 1: your first chip
  bits: [
    'tell if a switch that is up or down means 1 or 0',
    'read a row of lamps as a number by adding the lamps that are on',
    'write a number with lamps worth 8, 4, 2 and 1',
    'count how many patterns four lamps can make',
  ],
  bitadd: [
    'add 1 + 1 in one lamp column and carry the 1',
    'add two 4-lamp numbers one column at a time, from the right',
    'tell which two inputs turn on the half adder carry light',
  ],
  hex: [
    'count the 1s in a long row of lamps',
    'turn a group of four lamps into its hex nickname, 0 to F',
    'write a byte (eight lamps) as two hex digits',
    'explain why people use hex and the chip does not',
  ],
  twos: [
    'read a 4-lamp number where the left lamp is worth -8',
    'write a negative number by flipping every lamp and adding 1',
    'spot overflow when a sum is too big and wraps around',
    'write a number in more lamps by copying the left lamp',
  ],
  bool: [
    'predict what AND, OR and NOT gates output for any inputs',
    'name the gate that gives 1 only when its inputs differ (XOR)',
    'predict the output of a XOR gate',
  ],
  demorgan: [
    'simplify a NOT of NOTs with De Morgan to the fewest operators',
    'write an expression that is 1 when two inputs are equal',
    'explain why NAND is a universal gate',
  ],
  electricity: [
    'tell what moves in a wire when electricity flows',
    'convert amps to milliamps',
    'explain voltage as the push, using the water picture',
    'predict that a lamp stays off when its loop is broken',
  ],
  resistance: [
    'compute current from voltage and resistance',
    'compute power in watts from voltage and current',
    'predict what more resistance does to the current',
    'tell where the power a chip uses ends up',
  ],
  mux: [
    'predict a mux output from its two inputs and its select switch',
    'count how many select switches a mux needs to pick one of many signals',
  ],
  decoder: [
    'tell which output a decoder lights for its input switches',
    'count the outputs that n input switches can pick (2 to the n)',
    'count the address switches a memory needs to pick one place',
  ],
  adder: [
    'find the sum and carry out of a full adder',
    'explain why a long ripple-carry adder is slow',
    'compute the worst carry delay through a ripple adder',
  ],
  compare: [
    'tell which light a 1-bit comparator turns on: same or bigger',
    'name the gates that say two bits are the same (XOR then NOT)',
    'check if one 2-lamp number is bigger than another',
  ],
  seq: [
    'tell which things remember what they were told',
    'predict what a flip-flop holds before and after a clock tick',
    'explain why designs use flip-flops instead of latches',
  ],
  fsm: [
    'trace a state machine, like a turnstile, from state to state',
    'tell a Moore machine from a Mealy machine',
    'count the flip-flops for binary and one-hot state encoding',
    'pick the next state that keeps an overlapping pattern detector working',
  ],
  verilog: [
    'read an assign line and tell which gates it builds',
    'predict the output of an assign line for given inputs',
    'turn an AND into an OR by changing & to |',
    'count the bits in a joined value like {4\'b1010, 2\'b11}',
  ],
  'verilog-seq': [
    'tell that always @(posedge clk) with <= builds a flip-flop',
    'predict what two chained flops hold one clock later',
    'spot a latch made by an always @(*) block with a missing else',
  ],

  // Theory: circuits
  ohm: [
    "compute current, voltage and power with Ohm's law",
    'add resistors in series and combine them in parallel',
    'compute the output Vout of a voltage divider',
  ],
  rc: [
    'compute an RC time constant and a low-pass cutoff frequency',
    'choose how to make a gate drive a long wire faster',
    'decide where a decoupling capacitor belongs',
  ],
  mos: [
    'tell when an NMOS or PMOS transistor is on',
    'explain why idle CMOS burns almost no power',
    'count the transistors in a CMOS NAND2',
    'explain why a single CMOS stage is always inverting',
  ],
  psc: [
    'apply the passive sign convention to tell if a part absorbs or delivers power',
    'compute the power a part absorbs, with the right sign',
    'use power balance to find a missing power',
    'explain what a negative current means',
  ],
  mesh: [
    'write KVL round each mesh and solve two mesh equations',
    'find the current in a shared resistor from two mesh currents',
    'choose between mesh and nodal analysis by counting equations',
  ],
  deltawye: [
    'convert a delta to an equivalent wye, and a wye to a delta',
    'compute the corner resistor of a wye from an unequal delta',
    'solve an unbalanced bridge for its total resistance',
  ],
  complex: [
    'add and multiply complex numbers by their real and j parts',
    'compute the magnitude and angle of a complex number',
    'multiply numbers in polar form by multiplying lengths and adding angles',
  ],
  phasor: [
    "use Euler's formula to write e^(jθ) as a complex number",
    'convert a cosine wave into its phasor',
    'add same-frequency sine waves as phasor arrows to find the amplitude',
    'explain why a phasor can drop the ωt',
  ],
  deriv: [
    'compute a rate of change as change over time',
    'find the derivative of a polynomial at a given time',
    'compute the peak slope of a sine wave and compare two frequencies',
  ],
  integral: [
    'compute charge as the area under a current curve',
    'apply the fundamental theorem to evaluate a definite integral',
    'find the average of sin² and the rms value of a sine wave',
  ],
  storage: [
    'compute capacitor current from i = C dv/dt and inductor voltage from v = L di/dt',
    'compute the energy stored in an inductor',
    'estimate the kickback spike when an inductor is switched off',
    'choose which way a flyback diode must point',
  ],
  fourier: [
    'use orthogonality to find the integral over one period of a product of sines',
    'compute the Fourier coefficients of a square wave',
    'name which harmonics a square wave contains and how big they are',
  ],
  fields: [
    "compute the force between two charges with Coulomb's law",
    'predict how the force changes with distance',
    'compute the field and potential of a point charge, and the field between plates',
  ],
  gauss: [
    "explain the symmetry argument behind Gauss's law on a sphere",
    'compute the capacitance of parallel plates and of a gate oxide',
    'predict how gate capacitance changes with oxide thickness',
  ],
  opamp: [
    'apply the golden rules of an op-amp with negative feedback',
    'compute the output of inverting, non-inverting and summing amplifiers',
    'compute the output of a binary-weighted DAC and explain why R-2R ladders are used',
  ],

  // Theory: maths, statistics and computing
  calc: [
    'compute partial derivatives like ∂P/∂V and a divergence ∇·F',
    'compute a current from a current density',
    'find the minimum of a function and choose Lagrange multipliers for constraints',
    'explain why current loops are kept small',
  ],
  linalg: [
    'solve a 2×2 nodal system G·v = i',
    'explain a singular-matrix error as a floating node',
    'find eigenvalues and use them to decide stability',
    'check vectors for linear independence',
  ],
  ode: [
    'compute an RC step response and an LC resonant frequency',
    'predict an RLC step response from its damping ratio',
    'explain why SPICE uses implicit integration',
    'decide when a wire must be treated as a transmission line',
  ],
  prob: [
    'compute yield from independent probabilities and the Poisson model',
    'compute how many tries give a 99% chance of hitting a rare event',
    'use the normal distribution and sigma to estimate fractions and fail counts',
    "apply Bayes' rule to a failing test",
  ],
  numerics: [
    'explain why floats round and why == fails',
    'compute machine epsilon and a fixed-point LSB',
    "apply bisection and Newton's method to find a root",
    'compute the largest stable forward-Euler step and how error scales with step size',
  ],
  kcl: [
    'apply KCL and KVL to find a missing current or voltage',
    'compute a current divider and a node voltage by nodal analysis',
    'find a Thevenin resistance and the maximum power to a load',
    'tell how to turn off a voltage source for superposition',
  ],
  ac: [
    'compute the impedance of a capacitor and of an R-L series pair',
    'estimate a low-pass filter gain in dB far above cutoff',
    'convert a voltage gain to dB and compute a resonator bandwidth from Q',
    'compute rms voltage and real power with a phase angle',
  ],
  electronics: [
    'compute how diode voltage rises with current',
    'compute the transconductance of a BJT and a MOSFET',
    'compute a current mirror output and an intrinsic gain',
    'identify the role of ESD diodes, bandgaps, followers and differential pairs',
  ],
  signals: [
    'compute a convolution sample by hand',
    'find harmonic frequencies and the bandwidth of a rise time',
    'decide whether a system is stable from its poles',
    'predict the alias frequency of an undersampled tone',
  ],
  dsp: [
    'compute the output of an FIR moving average and an IIR filter',
    'compute FFT bin spacing and the speedup of an FFT over a DFT',
    'identify spectral leakage and how a window reduces it',
    'estimate the multiply-accumulate rate of a hardware FIR filter',
  ],
  control: [
    'compute closed-loop gain and how feedback divides drift',
    'compute the steady-state error of a proportional controller',
    'predict a step response from the phase margin',
    'compute bandwidth from GBW and phase lag from a loop delay',
  ],
  em: [
    'compute the capacitance of a parallel-plate structure',
    'compute signal speed in a dielectric and the impedance of a trace',
    'find an impedance from a TDR reflection',
    'predict what a split ground plane does to the return current',
  ],
  semi: [
    'explain insulators, doping types and carrier mobility',
    'compute the minority carrier concentration with n·p = n_i²',
    'estimate how diode current grows with voltage',
  ],
  mosphys: [
    'predict how drive current scales with overdrive and width',
    'explain what DIBL does to Vt and leakage',
    'compute how much a lower Vt raises subthreshold leakage',
    'explain why FinFETs and nanosheets replaced planar transistors',
  ],
  shell: [
    'choose the command that follows a growing log file',
    'write a grep command that counts matching lines',
    'tell > from >> when redirecting output',
    'write regular expressions for hex numbers and line starts',
  ],
  git: [
    'explain what the staging area holds',
    'write the command that commits staged changes',
    'tell merge from rebase',
    'compute how many git bisect runs find a bad commit',
  ],
  python: [
    'predict what short Python expressions and comprehensions print',
    'read list indexing and dict .get counting',
    'parse a log line with split and strip',
    'trace a small reference-model function',
  ],
  flows: [
    'predict what make reruns after a file changes',
    'debug the "missing separator" error in a Makefile',
    'predict what short TCL scripts print',
    'identify SDC timing constraints in a synthesis script',
  ],
  c: [
    'trace pointer arithmetic in C',
    'compute a register value after |= set and &= ~ clear bit idioms',
    'explain why a hardware register pointer must be volatile',
    'spot dangling pointers, struct padding and signed overflow',
  ],
  cpp: [
    'predict which method virtual dispatch calls',
    'explain why a polymorphic base needs a virtual destructor',
    'choose between unique_ptr and shared_ptr, and between containers',
    'use std::move and override correctly',
  ],
  dsa: [
    'compute how many steps binary search and an O(n²) loop take',
    'choose an algorithm for timing graphs and loop detection',
    'spot why a hash table slows down',
  ],
  asm: [
    'trace addi, add, slli and sub instructions to find a register value',
    'identify which tool (lexer, linker, ABI) handles each job',
    'find a byte in little-endian memory',
  ],
  os: [
    'compute the average waiting time under first-come-first-served',
    'translate a virtual address with a page table',
    'predict races and deadlocks in threaded code',
    'choose DMA for fast I/O',
  ],

  // Chips: design, verification, architecture
  alu: [
    'find which ALU flags an addition sets',
    'compute prefix-adder levels and multiplier result widths',
    'compute pipeline cycles for n instructions',
    'explain why Booth encoding helps and why very deep pipelines do not',
  ],
  clk: [
    'tell clock skew from jitter and spot a CDC bug',
    'explain why reset release must be synchronized',
    'estimate how a synchronizer flop improves MTBF',
    'convert binary to Gray code and size a FIFO for a burst',
  ],
  sta: [
    'compute setup and hold slack from path delays',
    'predict how clock skew affects setup and hold',
    'compute fmax and the time a multicycle path gets',
    'read WNS and TNS to tell one bad path from many',
  ],
  vlsi: [
    'compute a noise margin from an inverter VTC',
    'compute Elmore delay and logical-effort delay',
    'predict how wire delay grows with length',
    'explain why NOR2 is slower than NAND2 and why PMOS is wider',
  ],
  power: [
    'compute dynamic power from αCV²f',
    'compute how DVFS scales power',
    'explain what clock gating, power gating and level shifters need',
    'decide when racing to idle saves more energy',
  ],
  pcb: [
    'compute the flight time of a board trace',
    'explain why fast signals need a continuous return path',
    'compute a PDN target impedance',
    'explain why links use differential pairs',
  ],
  dv: [
    'describe what a scoreboard does',
    'debug a failure from the first wrong input',
    'identify a sim/synth mismatch',
  ],
  crv: [
    'compute the chance of a value under a dist constraint',
    'count the bins in a coverage cross',
    'explain why code coverage alone does not prove a design works',
  ],
  uvm: [
    'name the UVM component that drives pins',
    'explain why the monitor is separate from the driver',
    'name the phase that consumes time and debug a test that ends at time 0',
  ],
  sva: [
    'tell |-> from |=> in an assertion',
    'check an assertion against a waveform trace',
    'spot an assertion that passes vacuously',
  ],
  formal: [
    'count the states that n flip-flops can hold',
    'explain what a bounded proof guarantees',
    'spot over-constraining assumptions',
    'name what equivalence checking compares and what a CEX is',
  ],
  dft: [
    'choose a vector that detects a stuck-at fault',
    'compute scan shift cycles for a set of chains',
    'explain why memories use MBIST',
    'describe the JTAG TAP and what boundary scan can test',
  ],
  pipe: [
    'compute runtime with the iron law',
    'compute CPI with stall events',
    'explain the load-use stall and the cost of deep pipelines',
  ],
  ooo: [
    'identify RAW, WAR and WAW dependences and which renaming removes',
    'explain why a reorder buffer retires in order',
    'count mispredictions of a 2-bit branch predictor',
    'explain how Spectre leaks through the cache',
  ],
  cache: [
    'compute the tag bits of a cache address',
    'compute AMAT for a two-level cache',
    'describe what a write hit does in a write-back cache',
    'compute TLB reach',
  ],
  coherence: [
    'predict MESI states after a remote read',
    'spot false sharing',
    'tell sequential consistency from TSO and name what restores order',
  ],
  dram: [
    'compute DRAM latency for a row conflict',
    'compute peak bandwidth for DDR5 and HBM',
    'explain why HBM sits on an interposer',
  ],
  bus: [
    'explain why VALID must not wait for READY',
    'compute the credits a link needs for full throughput',
    'compute the peak bandwidth of an AXI data channel',
  ],
  noc: [
    'compute the diameter of a mesh and XY routing hops',
    'explain why XY routing is deadlock-free',
    'compute wormhole latency',
    'describe what virtual channels are for',
  ],
  serdes: [
    'explain how a receiver recovers the clock from the data',
    'compute the usable bandwidth of a PCIe link',
    'describe what happens to a TLP with a bad LCRC',
    'identify uses of CXL.mem and of a DFE',
  ],
  perf: [
    'describe discrete-event simulation and choose a gem5 setup',
    'compute geometric-mean and Amdahl speedups',
    "apply Little's law and the roofline model",
  ],

  // Roles
  analog: [
    'compute the gain of inverting and common-source amplifiers',
    'predict the response of a loop with a small phase margin',
    'compute kT/C noise, ADC SNR and ENOB',
    'apply Pelgrom matching and the PLL output formula',
  ],
  rf: [
    'convert power to dBm and frequency to wavelength',
    'compute a reflection coefficient and the noise figure of a chain',
    'identify S21 and how a phased array steers a beam',
  ],
  pmic: [
    'compute the heat an LDO wastes',
    'compute buck converter duty cycle and ripple current',
    'explain why GaN and SiC are taking over',
    'explain what holds the voltage up during a fast load step',
  ],
  sipi: [
    'compute IR drop and L·di/dt spikes',
    'compute a target impedance',
    'predict reflections on an unterminated line and find a Nyquist frequency',
    'identify crosstalk',
  ],
  openflow: [
    'read a Yosys stat report and count the flip-flops it built',
    'convert an OpenLane clock period into a frequency',
    'rank the flow steps in order: place, clock tree, route',
    'tell which check, DRC or LVS, finds a layout fault',
  ],
  celllayout: [
    'identify an NMOS or PMOS transistor from its layers',
    'compute the smallest width that meets a spacing or enclosure rule',
    'compute a cell area from its sites and row height',
    'tell an open from a short in an LVS report',
  ],
  pnr: [
    'explain why clock tree synthesis comes between placement and routing',
    'compute utilization, wire delay growth and clock tree depth',
    'tell DRC from LVS and identify electromigration',
    'choose an ECO for a late timing fix',
  ],
  sram: [
    'count the transistors in an SRAM bitcell and size the cells for an array',
    'explain read stability and why sense amps are needed',
    'compute a DRAM bit-line bump and the levels a NAND flash cell needs',
    'explain how spare rows and columns repair a memory',
  ],
  fab: [
    'compute lithography resolution',
    'compute Poisson yield and dies per wafer',
    'read process corner names like FS',
    'identify an aging mechanism',
  ],
  pkg: [
    'compute chiplet yield and hybrid-bond connection counts',
    'compute junction temperature from θja',
    'explain why HBM sits on an interposer and what causes warpage',
  ],
  postsi: [
    'estimate how long simulation takes to cover one second of silicon',
    'choose the right bring-up order for first silicon',
    'identify a speed path from a shmoo pattern',
    'describe what helps debug silicon and what a metal fix stepping is',
  ],
  ate: [
    'tell wafer sort from final test',
    'compute test cost per die and DPPM',
    'explain speed binning and burn-in',
  ],
  emu: [
    'compute the bits in a LUT and the time to boot on an emulator',
    'rank simulation, emulation and FPGA prototypes by speed',
    'explain what happens to gated clocks on an FPGA and what co-emulation is',
  ],
  npu: [
    'count the MACs in a matrix multiply and compute peak TOPS',
    'explain why systolic arrays win through data reuse',
    'compute model weight memory and the token rate set by bandwidth',
  ],
  hwsec: [
    'compute how many guesses a timing attack needs',
    'identify power analysis and fault injection attacks',
    'describe roots of trust, PUFs and how Spectre leaks',
  ],
  fusa: [
    'identify the strictest ASIL and tell random from systematic faults',
    'compute expected fleet failures from a FIT rate',
    'count SECDED check bits',
    'describe lockstep and how fault injection proves coverage',
  ],
  photonics: [
    'compute the cutoff wavelength from a band gap',
    'explain why silicon makes a poor laser and why ring modulators drift',
    'compute WDM bandwidth, I/O power and a link budget',
  ],
  qubit: [
    'predict the result of measuring a qubit in superposition',
    'count the amplitudes for n qubits and estimate circuit success from fidelity',
    'compute the temperature a qubit needs and the qubits a surface code needs',
    'explain the role of the Josephson junction and compare qubit platforms',
  ],
  qctrl: [
    'compute the drive frequency from LO and IF, and a π pulse length',
    'explain the attenuators on drive lines and the amplifier order in readout',
    'compute how many qubits a cryo heat budget supports',
    'explain why the decoder must keep up in real time',
  ],
  eda: [
    'compute half-perimeter wirelength for a net',
    'compare n² and n·log n algorithm costs',
    'explain why SAT solvers work on real chips and why BDD variable order matters',
  ],
  libchar: [
    'compute a delay by interpolating a Liberty table',
    'apply the 10% push-out rule to find setup time',
    'count PVT corners and explain why setup uses the slow corner',
    'describe what CCS adds over NLDM',
  ],
  'io-esd': [
    'compute HBM peak current and the clamp width it needs',
    'compute simultaneous switching noise',
    'explain why I/O cells need level shifters and careful power sequencing',
  ],
  'soc-int': [
    'decode an address with an address map',
    'compute the address bits a block decodes and a bus bandwidth',
    'debug a hang from a missing clock or reset',
    'explain why registers are generated from one source',
  ],
  clocking: [
    'compute PLL and ring oscillator frequencies',
    'compute rms jitter from phase noise',
    'tell a DLL from a PLL and explain why supply noise matters',
  ],
  sensors: [
    'compute the electrons a pixel collects and its shot-noise SNR',
    'compute dynamic range and readout rate',
    'explain the skew a rolling shutter causes',
  ],
  mems: [
    'compute the resonance and deflection of a spring-mass sensor',
    'compute a capacitive change and a bandwidth from Q',
    'explain why gyros are packaged in a vacuum',
  ],
  neuro: [
    'compute the current of a crossbar column and the energy of in-memory MACs',
    'compute when a leaky integrate-and-fire neuron fires',
    'identify what limits analog precision and which work suits neuromorphic chips',
  ],
  emerging: [
    'compute decades of leakage from subthreshold swing',
    'compute a cell area from pitches and an MRAM resistance from TMR',
    'explain why 2D channels and backside power are promising',
  ],
  'ae-tpm': [
    'choose a first debug step for a customer board',
    'compute a project critical path',
    'compute cost per good die and all-in unit cost',
    'decide how to raise a late risk with stakeholders',
  ],
};

// The skill matrix: every row of docs/CURRICULUM-AUDIT.md, as data, with the modules that take it to each level.
//   level 1 · Aware      = every `learn` module done
//   level 2 · Practised  = every `practice` module done
//   level 3 · Job-ready  = every `boss` module done
// A tier with no modules yet is still in development; Skills.app says so honestly.
import { levelRecord } from '../state';

export type RoleId =
  | 'rtl' | 'dv' | 'pd' | 'circuit' | 'analog' | 'rf' | 'pmic' | 'board' | 'memory' | 'process' | 'pkg' | 'dft'
  | 'test' | 'postsi' | 'fpga' | 'arch' | 'ai' | 'security' | 'fusa' | 'photonics' | 'quantum' | 'firmware'
  | 'eda' | 'libchar' | 'io' | 'soc' | 'clocking' | 'sensors' | 'mems' | 'neuro' | 'emerging' | 'ae';

export interface Role { id: RoleId; name: string; icon: string; blurb: string }

export const ROLES: Role[] = [
  { id: 'rtl', name: 'RTL design engineer', icon: '{}', blurb: 'Writes the Verilog/SystemVerilog that becomes the chip.' },
  { id: 'dv', name: 'Design verification engineer', icon: '⚑', blurb: 'Proves the RTL works before silicon: testbenches, UVM, coverage, formal.' },
  { id: 'pd', name: 'Physical design & timing engineer', icon: '▦', blurb: 'Turns netlists into layout and closes timing, power and signoff.' },
  { id: 'circuit', name: 'Circuit / custom design engineer', icon: '⊥', blurb: 'Transistor-level digital circuits, standard cells, custom layout.' },
  { id: 'analog', name: 'Analog & mixed-signal designer', icon: '∿', blurb: 'Amplifiers, data converters, PLLs, references.' },
  { id: 'rf', name: 'RF engineer', icon: '≈', blurb: 'Radios: LNAs, mixers, PAs, antennas and matching.' },
  { id: 'pmic', name: 'Power electronics engineer', icon: '⚡', blurb: 'Regulators, PMICs and power delivery.' },
  { id: 'board', name: 'Board & SI/PI engineer', icon: '▭', blurb: 'PCBs, high-speed channels and power integrity.' },
  { id: 'memory', name: 'Memory design engineer', icon: '▤', blurb: 'SRAM, DRAM and flash arrays.' },
  { id: 'process', name: 'Process, device & yield engineer', icon: '⚗', blurb: 'Builds the transistors in the fab and pushes yield up.' },
  { id: 'pkg', name: 'Packaging engineer', icon: '⬚', blurb: 'Chiplets, interposers, 3D stacking and thermals.' },
  { id: 'dft', name: 'DFT engineer', icon: '⛓', blurb: 'Scan, ATPG, BIST and JTAG: making chips testable.' },
  { id: 'test', name: 'Test & product engineer', icon: '⊞', blurb: 'Production test programs, yield data, binning and quality.' },
  { id: 'postsi', name: 'Post-silicon validation engineer', icon: '⌕', blurb: 'Brings up first silicon and hunts escaped bugs.' },
  { id: 'fpga', name: 'FPGA & emulation engineer', icon: '⊡', blurb: 'Prototypes and emulators, and products built on FPGAs.' },
  { id: 'arch', name: 'Computer architect', icon: '◈', blurb: 'Defines cores, caches and interconnect, and models their performance.' },
  { id: 'ai', name: 'AI hardware engineer', icon: '✦', blurb: 'Accelerators for neural networks: dataflows, number formats, HBM.' },
  { id: 'security', name: 'Hardware security engineer', icon: '⚿', blurb: 'Roots of trust, side channels, fault injection.' },
  { id: 'fusa', name: 'Functional safety engineer', icon: '⛨', blurb: 'ISO 26262: chips for cars, planes and medical devices.' },
  { id: 'photonics', name: 'Photonics engineer', icon: '☼', blurb: 'Moving data with light: silicon photonics and optical I/O.' },
  { id: 'quantum', name: 'Quantum hardware engineer', icon: '⚛', blurb: 'Qubits and the control electronics that drive them.' },
  { id: 'firmware', name: 'Firmware / embedded engineer', icon: '›_', blurb: 'Boot code, drivers and the software closest to the silicon.' },
  { id: 'eda', name: 'EDA / CAD engineer', icon: '⚙', blurb: 'Builds the tools and flows every other engineer uses.' },
  { id: 'libchar', name: 'Library characterization engineer', icon: '▥', blurb: 'Standard cells and their Liberty timing models.' },
  { id: 'io', name: 'I/O & ESD engineer', icon: '⏚', blurb: 'The pads, drivers and protection at the chip boundary.' },
  { id: 'soc', name: 'SoC integration engineer', icon: '⊕', blurb: 'Assembles hundreds of IP blocks into one chip.' },
  { id: 'clocking', name: 'Clocking / PLL engineer', icon: '⏱', blurb: 'PLLs, clock distribution and jitter.' },
  { id: 'sensors', name: 'Image sensor & display engineer', icon: '▣', blurb: 'Pixels, readout chains and display drivers.' },
  { id: 'mems', name: 'MEMS & sensors engineer', icon: '≋', blurb: 'Accelerometers, gyros, microphones: machines on silicon.' },
  { id: 'neuro', name: 'Neuromorphic / in-memory computing', icon: '⋈', blurb: 'Brain-inspired and compute-in-memory hardware.' },
  { id: 'emerging', name: 'Emerging devices researcher', icon: '✧', blurb: 'CFETs, 2D materials, spintronics: what comes after today\'s transistors.' },
  { id: 'ae', name: 'Applications engineer / TPM', icon: '☎', blurb: 'Helps customers succeed and keeps chip programs on track.' },
];

export interface Skill {
  id: string;
  area: string;
  name: string;
  /** Roles that need this skill. `all` means every role. */
  roles: RoleId[] | 'all';
  learn: string[];
  practice: string[];
  boss: string[];
  /** Short description of the planned mechanic for tiers that are not built yet. */
  plan?: string;
}

const S = (id: string, area: string, name: string, roles: RoleId[] | 'all', learn: string[], practice: string[], boss: string[], plan?: string): Skill =>
  ({ id, area, name, roles, learn, practice, boss, plan });

export const SKILLS: Skill[] = [
  // ------------------------------------------------ core engineering knowledge
  S('numbers', 'Digital foundations', 'Binary, hex, bit manipulation, signed numbers', 'all', ['bits', 'twos'], ['practice-bits', 'practice-twos'], ['boss-numbers']),
  S('calc', 'Math', 'Multivariable calculus and optimization', ['analog', 'circuit', 'rf', 'process', 'quantum', 'eda', 'arch'], ['calc'], ['practice-calc'], ['boss-calc']),
  S('linalg', 'Math', 'Linear algebra (LU, eigen, SVD)', ['analog', 'circuit', 'ai', 'quantum', 'eda', 'rf'], ['linalg'], ['practice-linalg'], ['boss-linalg']),
  S('ode', 'Math', 'ODEs and PDEs', ['analog', 'pmic', 'board', 'rf', 'circuit', 'process'], ['ode'], ['practice-ode'], ['boss-ode']),
  S('prob', 'Math', 'Probability and statistics', ['dv', 'process', 'test', 'analog', 'memory', 'ai', 'quantum', 'fusa', 'circuit', 'arch'], ['prob'], ['practice-prob'], ['boss-prob']),
  S('numerics', 'Math', 'Numerical methods', ['eda', 'analog', 'circuit', 'arch'], ['numerics'], ['practice-numerics'], ['boss-numerics']),
  S('ohm', 'Circuits', "Ohm's law, dividers, RC", ['analog', 'circuit', 'pmic', 'board', 'rf', 'io', 'sensors', 'firmware'], ['ohm', 'rc'], ['practice-ohm', 'practice-rc'], ['boss-circuits1']),
  S('kcl', 'Circuits', 'KCL/KVL, nodal and mesh analysis, Thevenin/Norton', ['analog', 'circuit', 'pmic', 'board', 'rf', 'io'], ['kcl'], ['practice-kcl'], ['boss-kcl']),
  S('ac', 'Circuits', 'AC analysis, phasors, impedance, Bode plots', ['analog', 'rf', 'pmic', 'board', 'clocking', 'sensors'], ['ac'], ['practice-ac'], ['boss-ac']),
  S('signals', 'Signals', 'Signals and systems, sampling, filters, DSP', ['analog', 'rf', 'board', 'ai', 'sensors', 'clocking', 'quantum'], ['signals', 'dsp'], ['practice-signals', 'practice-dsp'], ['boss-signals']),
  S('control', 'Signals', 'Feedback control, stability, PID, loop gain', ['analog', 'pmic', 'clocking', 'quantum'], ['control'], ['practice-control'], ['boss-control']),
  S('em', 'Physics', 'Electromagnetics, waves, transmission lines', ['rf', 'board', 'io', 'photonics', 'pkg'], ['em'], ['practice-em'], ['boss-em']),
  S('devices', 'Physics', 'Semiconductor devices: band gap, PN, MOSFET, short-channel effects, BJT', ['circuit', 'analog', 'process', 'memory', 'io', 'emerging', 'libchar', 'sensors'], ['semi', 'mosphys', 'mos'], ['practice-semi', 'practice-mosphys', 'practice-mos'], ['boss-devices']),
  S('electronics', 'Circuits', 'Diode and transistor circuits, biasing, small signal', ['analog', 'rf', 'pmic', 'io', 'sensors'], ['electronics'], ['practice-electronics'], ['boss-electronics']),
  S('logic', 'Digital design', 'Boolean algebra, combinational and sequential logic, FSMs', 'all', ['bool', 'comb', 'seq', 'fsm'], ['practice-bool', 'practice-comb', 'practice-seq', 'practice-fsm', 'logic-full', 'logic-counter'], ['boss-logic']),
  S('hdl', 'Digital design', 'Verilog RTL', ['rtl', 'dv', 'fpga', 'soc', 'arch', 'ai'], ['verilog'], ['mux4', 'shift', 'seqdet', 'fifo', 'practice-verilog'], ['boss-hdl']),
  S('sv-design', 'Digital design', 'SystemVerilog design constructs (interfaces, packages, structs, generate)', ['rtl', 'dv', 'soc'], [], [], [], 'SV Lab'),
  S('uarch', 'Digital design', 'Microarchitecture: ALUs, fast adders, multipliers, pipelines', ['rtl', 'arch', 'ai', 'circuit'], ['alu'], ['adder4', 'practice-alu'], ['boss-uarch']),
  S('cdc', 'Digital design', 'Clocks, resets, CDC, synchronizers, async FIFOs', ['rtl', 'dv', 'soc', 'fpga', 'clocking'], ['clk'], ['gray', 'fifo', 'practice-clk'], ['boss-cdc']),
  S('c', 'Software', 'C programming', ['firmware', 'dv', 'eda', 'arch', 'postsi'], ['c'], ['practice-c'], ['boss-c']),
  S('cpp', 'Software', 'C++ programming', ['eda', 'arch', 'dv'], ['cpp'], ['practice-cpp'], ['boss-cpp']),
  S('dsa', 'Software', 'Data structures and algorithms', ['eda', 'arch', 'dv', 'firmware'], ['dsa'], ['practice-dsa'], ['boss-dsa']),
  S('asm', 'Software', 'Assembly and the hardware/software interface', ['firmware', 'arch', 'rtl', 'dv', 'postsi'], ['asm'], ['practice-asm'], ['boss-asm']),
  S('os', 'Software', 'Operating systems', ['firmware', 'arch', 'postsi'], ['os'], ['practice-os'], ['boss-os']),
  S('shell', 'Tooling', 'Linux shell, pipes and regular expressions', 'all', ['shell'], ['practice-shell'], ['boss-shell']),
  S('git', 'Tooling', 'Version control with git', 'all', ['git'], ['practice-git'], ['boss-git']),
  S('python', 'Tooling', 'Python scripting', 'all', ['python'], ['practice-python'], ['boss-python']),
  S('flows', 'Tooling', 'TCL, Make and EDA flow scripting', ['pd', 'dv', 'rtl', 'eda', 'dft', 'soc', 'libchar'], ['flows'], ['practice-flows'], ['boss-flows']),

  // ------------------------------------------------ design verification
  S('tb-arch', 'Verification', 'Testbench architecture, scoreboards, reference models', ['dv'], ['dv'], ['practice-dv'], ['boss-tb']),
  S('debug', 'Verification', 'Debug from waveforms back to the root cause', ['dv', 'rtl', 'postsi', 'fpga'], ['dv'], ['bug-nba', 'bug-latch', 'bug-width', 'bug-reset', 'bug-sens', 'bug-fsm', 'bug-mod10', 'practice-dv'], ['boss-debug']),
  S('sv-oop', 'Verification', 'SystemVerilog OOP: classes, inheritance, polymorphism', ['dv'], [], [], [], 'SV Lab'),
  S('crv', 'Verification', 'Constrained-random stimulus', ['dv'], ['crv'], ['practice-crv'], ['boss-crv']),
  S('coverage', 'Verification', 'Functional coverage and closure', ['dv'], ['crv'], ['cov-alu', 'cov-fifo', 'practice-cov'], ['boss-coverage']),
  S('sv-if', 'Verification', 'Interfaces, modports, clocking blocks, virtual interfaces', ['dv', 'rtl'], [], [], [], 'SV Lab'),
  S('uvm', 'Verification', 'UVM structure, phasing and objections', ['dv'], ['uvm'], ['uvm-arch', 'uvm-phases', 'uvm-code', 'practice-uvm'], ['boss-uvm']),
  S('uvm-factory', 'Verification', 'UVM factory, overrides and config_db', ['dv'], [], [], [], 'SV Lab mini-UVM'),
  S('uvm-seq', 'Verification', 'Sequences, virtual sequences, TLM', ['dv'], [], [], [], 'SV Lab mini-UVM'),
  S('uvm-ral', 'Verification', 'UVM register abstraction layer (RAL)', ['dv', 'soc'], [], [], [], 'SV Lab mini-UVM'),
  S('sva', 'Verification', 'SystemVerilog assertions', ['dv', 'rtl'], ['sva'], ['practice-sva'], ['boss-sva']),
  S('formal', 'Verification', 'Formal verification and formal apps (CDC, X-prop, connectivity)', ['dv'], ['formal'], ['practice-formal'], ['boss-formal']),
  S('testplan', 'Verification', 'Test planning and sign-off', ['dv'], [], [], [], 'test-plan project'),
  S('regress', 'Verification', 'Regressions, seeds and failure triage', ['dv', 'rtl'], [], [], [], 'Shell Lab triage game'),
  S('gls', 'Verification', 'Gate-level simulation, SDF, X-propagation', ['dv'], [], [], [], 'SV Lab 4-state mode'),
  S('upf', 'Verification', 'Low-power design and UPF verification', ['dv', 'rtl', 'pd', 'soc'], ['power'], ['practice-power'], ['boss-upf']),
  S('protocols', 'Verification', 'Protocols: AXI, CHI, PCIe, DDR', ['dv', 'rtl', 'soc', 'arch'], ['bus', 'serdes', 'dram'], ['practice-bus', 'practice-serdes', 'practice-dram'], ['boss-protocols']),
  S('refmodel', 'Verification', 'Reference models in C/C++/Python, DPI-C', ['dv'], [], [], [], 'Code Lab + SV Lab'),
  S('cocotb', 'Verification', 'cocotb (Python testbenches)', ['dv', 'rtl', 'fpga'], [], [], [], 'Code Lab driving the simulator'),

  // ------------------------------------------------ roles
  S('rtl-craft', 'Design craft', 'RTL craft: synthesis, PPA trade-offs, design reviews', ['rtl', 'soc', 'ai'], [], [], [], 'RV32I core project'),
  S('cpu-arch', 'Architecture', 'Cores: pipelines, superscalar, OoO, branch prediction', ['arch', 'rtl', 'dv', 'postsi'], ['pipe', 'ooo'], ['practice-pipe', 'practice-ooo'], ['boss-cpu']),
  S('mem-hier', 'Architecture', 'Caches, coherence, consistency, DRAM', ['arch', 'rtl', 'dv', 'memory'], ['cache', 'coherence', 'dram'], ['practice-cache', 'practice-coherence', 'practice-dram'], ['boss-mem']),
  S('interconnect', 'Architecture', 'Buses, NoCs, SerDes, PCIe/CXL', ['arch', 'soc', 'rtl', 'dv', 'board'], ['bus', 'noc', 'serdes'], ['practice-bus', 'practice-noc', 'practice-serdes'], ['boss-interconnect']),
  S('perf', 'Architecture', 'Performance modeling (gem5, roofline)', ['arch', 'ai'], ['perf'], ['practice-perf'], ['boss-perf']),
  S('sta', 'Implementation', 'Static timing analysis', ['pd', 'rtl', 'circuit', 'libchar'], ['sta'], ['sta-slack', 'sta-battles', 'sta-hold', 'sta-skew', 'sta-pipeline', 'practice-sta'], ['boss-sta']),
  S('pd', 'Implementation', 'Physical design: floorplan, place, CTS, route, signoff', ['pd'], ['pnr'], ['practice-pnr'], ['boss-pd'], 'placement & CTS labs'),
  S('circuit', 'Implementation', 'Transistor-level circuit design and layout', ['circuit', 'libchar', 'memory', 'io'], ['vlsi', 'mos'], ['cmos-inv', 'cmos-nand', 'cmos-nor', 'cmos-and', 'cmos-aoi', 'practice-vlsi'], ['boss-circuit']),
  S('lowpower', 'Implementation', 'Low-power design: gating, voltage domains, DVFS', ['rtl', 'pd', 'soc', 'circuit'], ['power'], ['practice-power'], ['boss-lowpower']),
  S('board', 'Implementation', 'Board design, SI and PI', ['board', 'pkg', 'io'], ['pcb', 'sipi'], ['pcb-first-light', 'pcb-crossing', 'pcb-decouple', 'pcb-return-path', 'pcb-diff-pair', 'practice-pcb'], ['boss-board']),
  S('dft', 'Test', 'DFT: scan, ATPG, BIST, JTAG', ['dft', 'test', 'rtl', 'soc'], ['dft'], ['practice-dft'], ['boss-dft']),
  S('test-eng', 'Test', 'Test and product engineering', ['test', 'dft'], ['ate'], ['practice-ate'], ['boss-test'], 'incident'),
  S('postsi', 'Test', 'Post-silicon validation and debug', ['postsi', 'dv'], ['postsi'], ['practice-postsi'], ['boss-postsi'], 'incident'),
  S('analog', 'Specialties', 'Analog and mixed-signal design', ['analog', 'clocking', 'sensors'], ['analog'], ['practice-analog'], ['boss-analog'], 'Circuit Lab'),
  S('rf', 'Specialties', 'RF design', ['rf'], ['rf'], ['practice-rf'], ['boss-rf'], 'Smith chart lab'),
  S('pmic', 'Specialties', 'Power electronics and PMICs', ['pmic'], ['pmic'], ['practice-pmic'], ['boss-pmic'], 'Circuit Lab buck converter'),
  S('memory', 'Specialties', 'Memory design (SRAM, DRAM, flash)', ['memory'], ['sram'], ['practice-sram'], ['boss-memory'], 'SRAM margin lab'),
  S('process', 'Specialties', 'Process, devices and yield', ['process', 'emerging'], ['fab'], ['practice-fab'], ['boss-process'], 'yield incident'),
  S('pkg', 'Specialties', 'Packaging, chiplets and thermals', ['pkg'], ['pkg'], ['practice-pkg'], ['boss-pkg'], 'incident'),
  S('fpga', 'Specialties', 'FPGAs, prototyping and emulation', ['fpga', 'dv'], ['emu'], ['practice-emu'], ['boss-fpga'], 'FPGA mapping lab'),
  S('ai-hw', 'Specialties', 'AI accelerators', ['ai', 'arch'], ['npu'], ['practice-npu'], ['boss-ai'], 'tiling puzzle'),
  S('hwsec', 'Specialties', 'Hardware security', ['security', 'dv', 'arch'], ['hwsec'], ['practice-hwsec'], ['boss-hwsec'], 'DPA side-channel game'),
  S('fusa', 'Specialties', 'Functional safety (ISO 26262)', ['fusa', 'dv'], ['fusa'], ['practice-fusa'], ['boss-fusa'], 'FMEDA + fault campaign'),
  S('photonics', 'Specialties', 'Silicon photonics', ['photonics'], ['photonics'], ['practice-photonics'], ['boss-photonics'], 'link designer'),
  S('quantum-hw', 'Specialties', 'Quantum hardware', ['quantum'], ['qubit'], ['practice-qubit'], ['boss-qubit'], 'qubit simulator'),
  S('quantum-ctrl', 'Specialties', 'Quantum control and cryo-electronics', ['quantum'], ['qctrl'], ['practice-qctrl'], ['boss-qctrl'], 'pulse lab'),

  // ------------------------------------------------ roles not yet covered
  S('eda', 'Emerging roles', 'EDA algorithms: placement, routing, SAT/BDDs', ['eda'], [], [], [], 'Code Lab'),
  S('libchar', 'Emerging roles', 'Standard-cell libraries and Liberty characterization', ['libchar', 'circuit'], [], [], [], 'lesson + characterization lab'),
  S('io-esd', 'Emerging roles', 'I/O and ESD design', ['io'], [], [], [], 'lesson + incident'),
  S('soc-int', 'Emerging roles', 'SoC integration', ['soc'], [], [], [], 'lesson + integration incident'),
  S('clocking', 'Emerging roles', 'Clocking and PLL design', ['clocking', 'analog'], [], [], [], 'lesson + PLL lab'),
  S('sensors', 'Emerging roles', 'Image sensors and displays', ['sensors'], [], [], [], 'lesson + incident'),
  S('mems', 'Emerging roles', 'MEMS and sensors', ['mems'], [], [], [], 'lesson'),
  S('neuro', 'Emerging roles', 'Neuromorphic and in-memory computing', ['neuro', 'ai'], [], [], [], 'lesson'),
  S('emerging', 'Emerging roles', 'Emerging devices: CFETs, 2D materials, spintronics', ['emerging', 'process'], [], [], [], 'lesson'),
  S('ae-tpm', 'Emerging roles', 'Applications engineering and program management', ['ae'], [], [], [], 'lesson + customer incident'),
];

export const findSkill = (id: string) => SKILLS.find((s) => s.id === id);
export const findRole = (id: string) => ROLES.find((r) => r.id === id);

const tierDone = (ids: string[]) => ids.length > 0 && ids.every((id) => !!levelRecord(id));

/** 0 = not started, 1 = aware, 2 = practised, 3 = job-ready. Higher tiers count even if lower ones were skipped. */
export function skillLevel(s: Skill): number {
  if (tierDone(s.boss)) return 3;
  if (tierDone(s.practice)) return 2;
  if (tierDone(s.learn)) return 1;
  return 0;
}

/** The highest level this skill can reach with the modules built so far. */
export function skillCeiling(s: Skill): number {
  return s.boss.length ? 3 : s.practice.length ? 2 : s.learn.length ? 1 : 0;
}

export const skillsFor = (role: RoleId) => SKILLS.filter((s) => s.roles === 'all' || s.roles.includes(role));

/** 0..1: how close the player is to job-ready in this role. */
export function roleReadiness(role: RoleId): number {
  const ss = skillsFor(role);
  return ss.reduce((a, s) => a + skillLevel(s), 0) / (3 * ss.length);
}

export const AREAS = [...new Set(SKILLS.map((s) => s.area))];

export const LEVEL_NAME = ['Not started', 'Aware', 'Practised', 'Job-ready'];

/** Which module the player should do next for this skill. */
export function nextStep(s: Skill): { tier: 'learn' | 'practice' | 'boss'; id: string } | undefined {
  for (const tier of ['learn', 'practice', 'boss'] as const) {
    const id = s[tier].find((m) => !levelRecord(m));
    if (id) return { tier, id };
  }
  return undefined;
}

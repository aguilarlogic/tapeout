// What every lesson needs, as data. The Curriculum Order Plan's rule: every lesson comes after everything it
// depends on, and one main subject is taught at a time. prereqs.test.ts checks both against PLAY_ORDER (the order a
// beginner meets the curriculum): a need that comes later, a cycle, a lesson with no entry, or a chapter that mixes
// subjects all fail the build.

/** The main subject a lesson teaches. A chapter teaches one subject; see GROUP for what an act may mix. */
export type Subject =
  | 'digital' | 'architecture' | 'cmos' | 'flow' | 'verification'
  | 'electricity' | 'circuits' | 'analog'
  | 'fields' | 'devices'
  | 'math' | 'signals' | 'software' | 'role';

/** The three families the engineer's review said must never share an act: digital design, circuit theory, device physics. */
export const GROUP: Partial<Record<Subject, 'digital' | 'circuit' | 'physics'>> = {
  digital: 'digital', architecture: 'digital', cmos: 'digital', flow: 'digital', verification: 'digital',
  electricity: 'circuit', circuits: 'circuit', analog: 'circuit',
  fields: 'physics', devices: 'physics',
};

export interface Prereq { subject: Subject; needs: string[] }

const P = (subject: Subject, ...needs: string[]): Prereq => ({ subject, needs });

export const PREREQS: Record<string, Prereq> = {
  // S1: digital basics (ADA-1)
  bits: P('digital'),
  bool: P('digital', 'bits'),
  // S2: the electricity primer, an ADA-1 side step
  electricity: P('electricity'),
  resistance: P('electricity', 'electricity'),
  bitadd: P('digital', 'bits', 'bool'),
  twos: P('digital', 'bitadd'),
  demorgan: P('digital', 'bool'),
  mux: P('digital', 'bool'),
  decoder: P('digital', 'bits', 'bool'),
  adder: P('digital', 'bitadd', 'bool'),
  compare: P('digital', 'bits', 'bool'),
  // S3: memory and state, then Verilog
  seq: P('digital', 'bool'),
  fsm: P('digital', 'seq'),
  verilog: P('digital', 'bool', 'mux', 'adder'),
  'verilog-seq': P('digital', 'verilog', 'seq'),
  hex: P('digital', 'bits'),
  // ADA-2 and its software detours
  c: P('software', 'twos', 'hex'),
  asm: P('architecture', 'twos', 'hex'),
  shell: P('software'),
  git: P('software'),
  alu: P('architecture', 'adder', 'mux', 'verilog'),
  clk: P('digital', 'seq', 'fsm'),
  dsa: P('software', 'c'),
  pipe: P('architecture', 'alu', 'asm'),
  // S4: DC circuit theory
  ohm: P('circuits', 'resistance'),
  psc: P('circuits', 'ohm'),
  kcl: P('circuits', 'ohm', 'psc'),
  mesh: P('circuits', 'kcl'),
  deltawye: P('circuits', 'ohm', 'kcl'),
  // S5: math for AC
  complex: P('math'),
  phasor: P('math', 'complex'),
  // S6: calculus
  deriv: P('math', 'electricity'),
  integral: P('math', 'deriv'),
  // S7: energy storage, then multivariable calculus, linear algebra and differential equations
  storage: P('circuits', 'ohm', 'deriv'),
  rc: P('circuits', 'storage'),
  calc: P('math', 'deriv', 'integral', 'storage'),
  linalg: P('math', 'kcl', 'deriv', 'storage'),
  ode: P('math', 'storage', 'rc', 'integral'),
  // S8: AC, then Fourier series
  ac: P('circuits', 'phasor', 'storage', 'rc'),
  fourier: P('signals', 'integral', 'phasor'),
  // S9: fields
  fields: P('fields', 'integral', 'storage'),
  gauss: P('fields', 'fields'),
  em: P('fields', 'gauss', 'storage', 'ac', 'calc'),
  // S10: semiconductor devices
  semi: P('devices', 'fields', 'storage'),
  mosphys: P('devices', 'semi', 'gauss'),
  // S11: analog building blocks
  opamp: P('analog', 'kcl', 'semi'),
  electronics: P('analog', 'semi', 'mosphys', 'opamp'),
  // S12: CMOS and the chip flow (ADA-3)
  mos: P('cmos', 'bool', 'mosphys'),
  vlsi: P('cmos', 'mos', 'rc'),
  python: P('software'),
  flows: P('software', 'shell'),
  sta: P('flow', 'seq', 'rc', 'vlsi'),
  power: P('flow', 'vlsi', 'ohm'),
  dft: P('flow', 'seq', 'fsm'),
  signals: P('signals', 'fourier', 'ac'),
  dsp: P('signals', 'signals'),
  control: P('signals', 'signals', 'ode'),
  pcb: P('flow', 'ac', 'em'),
  // ADA-4 and its detours
  cpp: P('software', 'c'),
  dv: P('verification', 'verilog'),
  prob: P('math'),
  numerics: P('math', 'twos', 'integral'),
  crv: P('verification', 'dv', 'prob'),
  uvm: P('verification', 'crv', 'cpp'),
  sva: P('verification', 'dv'),
  formal: P('verification', 'sva'),
  ooo: P('architecture', 'pipe'),
  os: P('software', 'c'),
  cache: P('architecture', 'pipe'),
  coherence: P('architecture', 'cache'),
  dram: P('architecture', 'cache'),
  bus: P('architecture', 'fsm'),
  noc: P('architecture', 'bus'),
  serdes: P('architecture', 'bus', 'signals'),
  perf: P('architecture', 'cache', 'ooo'),
  // Specializations: each role builds on the core it uses
  analog: P('role', 'opamp', 'control'),
  rf: P('role', 'ac', 'em'),
  pmic: P('role', 'storage', 'control'),
  sipi: P('role', 'pcb', 'storage'),
  pnr: P('role', 'sta'),
  sram: P('role', 'vlsi'),
  fab: P('role', 'semi'),
  pkg: P('role', 'pcb'),
  postsi: P('role', 'dv'),
  ate: P('role', 'dft'),
  emu: P('role', 'verilog'),
  npu: P('role', 'alu'),
  hwsec: P('role', 'power'),
  fusa: P('role', 'dft'),
  photonics: P('role', 'semi'),
  qubit: P('role', 'complex'),
  qctrl: P('role', 'qubit'),
  eda: P('role', 'dsa', 'sta'),
  libchar: P('role', 'vlsi', 'sta'),
  clocking: P('role', 'control'),
  'io-esd': P('role', 'semi'),
  'soc-int': P('role', 'bus'),
  'ae-tpm': P('role'),
  sensors: P('role', 'semi'),
  mems: P('role', 'storage'),
  neuro: P('role', 'analog'),
  emerging: P('role', 'mosphys'),
};

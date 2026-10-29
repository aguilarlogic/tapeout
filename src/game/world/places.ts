// The place map (Phase 3 Spec, section 3): the 62 places of the full map, in play order, one per curriculum chapter.
// Each row says where a place sits in the story (its number, ADA region, what opens it, which incidents it fights) and
// which chapter's modules it teaches. The curriculum stays the source for chapters, modules and incidents.
import { ACTS, type Chapter, findModule } from '../../curriculum';
import type { PlaceDef } from './types';

/** The full map, in play order (the design doc's "full map, in play order" table). */
export const PLACES: PlaceDef[] = [
  { n: '1', id: 'bit-zero', name: 'Bit Zero', chapter: 'Your first chip', kind: 'main', act: 1, region: 'Keeper ALU bit 0', after: [], bosses: ['inc-demo-board'] },
  { n: 'S1', id: 'volts-and-amps', name: 'Volts and Amps', chapter: 'Electricity', kind: 'study', act: 1, region: 'Keeper power rail', after: ['bit-zero'], bosses: [] },
  { n: '2', id: 'lamp-board', name: 'The Lamp Board', chapter: 'Numbers', kind: 'main', act: 1, region: 'Keeper number unit', after: ['volts-and-amps'], bosses: ['inc-lamp-board'] },
  { n: '3', id: 'inverted-hall', name: 'The Inverted Hall', chapter: 'Logic', kind: 'main', act: 1, region: 'Keeper logic unit', after: ['lamp-board'], bosses: ['inc-logic'] },
  { n: '4', id: 'carry-chain', name: 'Carry Chain', chapter: 'Building blocks', kind: 'main', act: 1, region: 'Keeper ALU', after: ['inverted-hall'], bosses: ['inc-adder'] },
  { n: '5', id: 'clockwork', name: 'Clockwork', chapter: 'Memory & state', kind: 'main', act: 1, region: 'Keeper registers and controller', after: ['carry-chain'], bosses: ['inc-controller'] },
  { n: '6', id: 'boot-rom', name: 'Boot ROM', chapter: 'Verilog', kind: 'main', act: 1, region: 'Keeper CPU', after: ['clockwork'], bosses: ['inc-numbers', 'inc-rtl'] },
  { n: 'D1', id: 'firmware-pit', name: 'Firmware Pit', chapter: 'C', kind: 'deep', act: 2, region: 'Core firmware', after: ['boot-rom'], bosses: [] },
  { n: '7', id: 'instruction-memory', name: 'Instruction Memory', chapter: 'Hardware/software interface', kind: 'main', act: 2, region: 'Core instruction memory', after: ['firmware-pit'], bosses: ['inc-isa'] },
  { n: 'D2', id: 'debug-shell', name: 'Debug Shell', chapter: 'The shell', kind: 'deep', act: 2, region: 'Core debug port', after: ['instruction-memory'], bosses: [] },
  { n: 'D3', id: 'version-vault', name: 'Version Vault', chapter: 'Git', kind: 'deep', act: 2, region: 'Core version store', after: ['debug-shell'], bosses: [] },
  { n: '8', id: 'datapath', name: 'Datapath', chapter: 'Microarchitecture', kind: 'main', act: 2, region: 'Core datapath', after: ['version-vault'], bosses: ['inc-datapath'] },
  { n: '9', id: 'clock-bridge', name: 'Clock Bridge', chapter: 'Clocks & resets', kind: 'main', act: 2, region: 'Core clock crossings', after: ['datapath'], bosses: ['inc-crossing'] },
  { n: 'D4', id: 'router-tables', name: 'Router Tables', chapter: 'Algorithms', kind: 'deep', act: 2, region: 'Core branch tables', after: ['clock-bridge'], bosses: [] },
  { n: '10', id: 'pipeline', name: 'The Pipeline', chapter: 'Pipelines', kind: 'main', act: 2, region: 'Core pipeline', after: ['router-tables'], bosses: ['inc-pipeline'] },
  { n: 'D5', id: 'power-grid', name: 'Power Grid', chapter: 'DC circuits', kind: 'deep', act: 5, region: 'Power grid mesh', after: ['pipeline'], bosses: [] },
  { n: 'S2', id: 'rotations', name: 'Rotations', chapter: 'Complex numbers', kind: 'study', act: 5, region: 'Phase reference', after: ['power-grid'], bosses: [] },
  { n: 'S3', id: 'change-and-area', name: 'Change and Area', chapter: 'Calculus', kind: 'study', act: 5, region: 'Charge pump', after: ['rotations'], bosses: [] },
  { n: 'D6', id: 'capacitor-bank', name: 'Capacitor Bank', chapter: 'Energy storage', kind: 'deep', act: 5, region: 'Decoupling and inductors', after: ['change-and-area'], bosses: [] },
  { n: 'S4', id: 'slopes-and-fields', name: 'Slopes and Fields', chapter: 'Multivariable calculus', kind: 'study', act: 5, region: 'Field map', after: ['capacitor-bank'], bosses: [] },
  { n: 'S5', id: 'matrices', name: 'Matrices', chapter: 'Linear algebra', kind: 'study', act: 5, region: 'Transform unit', after: ['slopes-and-fields'], bosses: [] },
  { n: 'D7', id: 'ringing-supply', name: 'Ringing Supply', chapter: 'Differential equations', kind: 'deep', act: 5, region: 'Damped supply', after: ['matrices'], bosses: [] },
  { n: 'D8', id: 'ac-filters', name: 'AC Filters', chapter: 'AC circuits', kind: 'deep', act: 5, region: 'Clock filters', after: ['ringing-supply'], bosses: [] },
  { n: 'S6', id: 'frequencies', name: 'Frequencies', chapter: 'Fourier series', kind: 'study', act: 5, region: 'Spectrum monitor', after: ['ac-filters'], bosses: [] },
  { n: 'S7', id: 'fields-and-flux', name: 'Fields and Flux', chapter: 'Fields', kind: 'study', act: 5, region: 'Shielding', after: ['frequencies'], bosses: [] },
  { n: 'D9', id: 'junction-depths', name: 'Junction Depths', chapter: 'Semiconductor devices', kind: 'deep', act: 5, region: 'Diodes and wells', after: ['fields-and-flux'], bosses: [] },
  { n: 'D10', id: 'op-amp-array', name: 'Op-amp Array', chapter: 'Op-amps', kind: 'deep', act: 5, region: 'DAC', after: ['junction-depths'], bosses: [] },
  { n: 'D11', id: 'bias-network', name: 'Bias Network', chapter: 'Transistor amplifiers', kind: 'deep', act: 5, region: 'Bias network', after: ['op-amp-array'], bosses: [] },
  { n: '11', id: 'cell-library', name: 'Cell Library', chapter: 'Transistors', kind: 'main', act: 3, region: 'Standard cells', after: ['bias-network'], bosses: ['inc-cell'] },
  { n: '12', id: 'bypass-bus', name: 'Bypass Bus', chapter: 'Circuit design', kind: 'main', act: 3, region: 'Critical drivers', after: ['cell-library'], bosses: ['inc-bypass'] },
  { n: 'D12', id: 'script-works', name: 'Script Works', chapter: 'Python', kind: 'deep', act: 3, region: 'Test scripts', after: ['bypass-bus'], bosses: [] },
  { n: 'D13', id: 'build-flow', name: 'Build Flow', chapter: 'Flows & scripting', kind: 'deep', act: 3, region: 'Build flow', after: ['script-works'], bosses: [] },
  { n: '13', id: 'critical-path', name: 'Critical Path', chapter: 'Static timing', kind: 'main', act: 3, region: 'Timing paths', after: ['build-flow'], bosses: ['inc-sta'] },
  { n: '14', id: 'metal-stack', name: 'Metal Stack', chapter: 'Layout', kind: 'main', act: 3, region: 'Metal layers', after: ['critical-path'], bosses: ['inc-drc'] },
  { n: '15', id: 'floorplan', name: 'Floorplan', chapter: 'Physical design', kind: 'main', act: 3, region: 'Placement and clock tree', after: ['metal-stack'], bosses: ['inc-pdcore'] },
  { n: '16', id: 'sleep-domains', name: 'Sleep Domains', chapter: 'Low power', kind: 'main', act: 3, region: 'Power domains', after: ['floorplan'], bosses: ['inc-wake'] },
  { n: '17', id: 'scan-chain', name: 'Scan Chain', chapter: 'Design for test', kind: 'main', act: 3, region: 'Scan chains', after: ['sleep-domains'], bosses: ['inc-dft'] },
  { n: 'D14', id: 'sample-lab', name: 'Sample Lab', chapter: 'Signals & DSP', kind: 'deep', act: 3, region: 'ADC front end', after: ['scan-chain'], bosses: [] },
  { n: 'D15', id: 'control-loop', name: 'Control Loop', chapter: 'Feedback & control', kind: 'deep', act: 3, region: 'Regulator loop', after: ['sample-lab'], bosses: [] },
  { n: '18', id: 'board', name: 'The Board', chapter: 'Board', kind: 'main', act: 3, region: 'Package and board', after: ['control-loop'], bosses: ['inc-link'] },
  { n: 'S8', id: 'simulator-core', name: 'Simulator Core', chapter: 'C++', kind: 'study', act: 4, region: 'Simulator', after: ['board'], bosses: [] },
  { n: '19', id: 'testbench', name: 'Testbench', chapter: 'Testbenches & debug', kind: 'main', act: 4, region: 'Cluster testbench', after: ['simulator-core'], bosses: ['inc-tb'] },
  { n: 'D16', id: 'dice-room', name: 'Dice Room', chapter: 'Probability', kind: 'deep', act: 4, region: 'Random test unit', after: ['testbench'], bosses: [] },
  { n: 'D17', id: 'solver', name: 'Solver', chapter: 'Numerical methods', kind: 'deep', act: 4, region: 'Solver', after: ['dice-room'], bosses: [] },
  { n: '20', id: 'coverage-holes', name: 'Coverage Holes', chapter: 'Random & coverage', kind: 'main', act: 4, region: 'Coverage database', after: ['solver'], bosses: ['inc-cov'] },
  { n: '21', id: 'environment', name: 'Environment', chapter: 'UVM', kind: 'main', act: 4, region: 'UVM environment', after: ['coverage-holes'], bosses: ['inc-uvm'] },
  { n: '22', id: 'proof-engine', name: 'Proof Engine', chapter: 'Assertions & formal', kind: 'main', act: 4, region: 'Formal properties', after: ['environment'], bosses: ['inc-formal'] },
  { n: '23', id: 'reorder-window', name: 'Reorder Window', chapter: 'Out-of-order', kind: 'main', act: 4, region: 'Out-of-order cores', after: ['proof-engine'], bosses: ['inc-ooo'] },
  { n: 'D18', id: 'kernel', name: 'Kernel', chapter: 'Operating systems', kind: 'deep', act: 4, region: 'Kernel', after: ['reorder-window'], bosses: [] },
  { n: '24', id: 'cache-hierarchy', name: 'Cache Hierarchy', chapter: 'Memory hierarchy', kind: 'main', act: 4, region: 'Caches and coherence', after: ['kernel'], bosses: ['inc-memhier'] },
  { n: '25', id: 'mesh', name: 'The Mesh', chapter: 'Interconnect', kind: 'main', act: 4, region: 'Network on chip', after: ['cache-hierarchy'], bosses: ['inc-noc'] },
  { n: '26', id: 'model-room', name: 'Model Room', chapter: 'Modelling', kind: 'main', act: 4, region: 'Performance model', after: ['mesh'], bosses: ['inc-model'] },
  { n: '27', id: 'tapeout', name: 'Tapeout', chapter: 'Tapeout', kind: 'main', act: 4, region: 'Sign-off', after: ['model-room'], bosses: [] },
  { n: 'W1', id: 'analog-wing', name: 'Analog Wing', chapter: 'Circuits & signals', kind: 'wing', act: 6, region: 'Fab: analog and RF', after: ['tapeout'], bosses: ['inc-radio', 'inc-rail'] },
  { n: 'W2', id: 'fab-floor', name: 'Fab Floor', chapter: 'Silicon & manufacturing', kind: 'wing', act: 6, region: 'Fab: memory, process, package', after: ['tapeout'], bosses: ['inc-bitflip', 'inc-wafer', 'inc-package'] },
  { n: 'W3', id: 'bring-up-lab', name: 'Bring-up Lab', chapter: 'Bring-up & production', kind: 'wing', act: 6, region: 'Fab: lab and test floor', after: ['tapeout'], bosses: ['inc-hang', 'inc-finaltest'] },
  { n: 'W4', id: 'domain-wing', name: 'Domain Wing', chapter: 'Domain chips', kind: 'wing', act: 6, region: 'Fab: AI, security, safety, photonics', after: ['tapeout'], bosses: ['inc-key', 'inc-limp', 'inc-optical'] },
  { n: 'W5', id: 'cold-lab', name: 'Cold Lab', chapter: 'Quantum', kind: 'wing', act: 6, region: 'Fab: cryostat', after: ['tapeout'], bosses: ['inc-qubit'] },
  { n: 'W6', id: 'tool-shop', name: 'Tool Shop', chapter: 'Design tools & clocking', kind: 'wing', act: 6, region: 'Fab: EDA and PLL', after: ['tapeout'], bosses: [] },
  { n: 'W7', id: 'integration-bay', name: 'Integration Bay', chapter: 'Chip integration', kind: 'wing', act: 6, region: 'Fab: I/O and SoC', after: ['tapeout'], bosses: ['inc-esd', 'inc-soc', 'inc-customer'] },
  { n: 'W8', id: 'sensor-wing', name: 'Sensor Wing', chapter: 'Sensors & frontier', kind: 'wing', act: 6, region: 'Fab: sensors and frontier', after: ['tapeout'], bosses: ['inc-pixel'] },
  { n: 'H', id: 'hiring-hall', name: 'Hiring Hall', chapter: 'Hiring panels', kind: 'hall', act: 6, region: 'Fab: offices', after: ['tapeout'], bosses: [] },
];

/** The place with this id, if there is one. */
export function placeById(id: string): PlaceDef | undefined {
  return PLACES.find((p) => p.id === id);
}

/** The curriculum chapter a place teaches. Throws when the place names a chapter the curriculum does not have. */
export function chapterOf(place: PlaceDef): Chapter {
  const chapter = ACTS.flatMap((a) => a.chapters).find((c) => c.name === place.chapter);
  if (!chapter) throw new Error(`no chapter "${place.chapter}" for place ${place.id}`);
  return chapter;
}

/** The place whose chapter holds this module, if the module exists. */
export function placeOf(moduleId: string): PlaceDef | undefined {
  const name = findModule(moduleId)?.chapter.name;
  if (!name) return undefined;
  return PLACES.find((p) => p.chapter === name);
}

/**
 * Is the place finished? Every module of its chapter is done, except optional challenges and practice sets, which
 * never gate a place.
 */
export function placeDone(place: PlaceDef, done: (id: string) => boolean): boolean {
  return chapterOf(place).modules.every((m) => m.optional || m.kind === 'practice' || done(m.id));
}

/**
 * The places open to this player, in PLACES order: those whose `after` places are all finished, and those where any
 * module is already done. The pro entry rule (startAct()) is applied by the caller, not here.
 */
export function openPlaces(done: (id: string) => boolean): PlaceDef[] {
  return PLACES.filter((p) => chapterOf(p).modules.some((m) => done(m.id))
    || p.after.every((id) => {
      const prior = placeById(id);
      return !!prior && placeDone(prior, done);
    }));
}

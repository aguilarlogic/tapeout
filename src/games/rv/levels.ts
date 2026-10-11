// RV32 core project: five missions that grow one single-cycle core, ending in a bring-up boss with hidden bugs.
import { type Rng } from '../../lessons/types';
import { referenceCore, STARTER_STAGE1, type Stage } from './core';
import type { ProgramSpec } from './harness';
import { FIXED, genProgram } from './programs';

export interface RvInstance { brief: string; hints: string[]; starter: string; solution: string; programs: ProgramSpec[] }
export interface RvLevel { id: string; title: string; concept: string; xp: number; tier: 'guided' | 'boss'; ticket: string; stage: Stage; build: (r: Rng) => RvInstance }

const FORMATS = `<table class="rv-fmt"><thead><tr><th>type</th><th>31…25</th><th>24…20</th><th>19…15</th><th>14…12</th><th>11…7</th><th>6…0</th></tr></thead><tbody>
<tr><td>R</td><td>f7</td><td>rs2</td><td>rs1</td><td>f3</td><td>rd</td><td>opcode</td></tr>
<tr><td>I</td><td colspan="2">imm[11:0]</td><td>rs1</td><td>f3</td><td>rd</td><td>opcode</td></tr>
<tr><td>S</td><td>imm[11:5]</td><td>rs2</td><td>rs1</td><td>f3</td><td>imm[4:0]</td><td>opcode</td></tr></tbody></table>`;

const IFACE = `<p><b>The interface is fixed</b> (the testbench plays the memory). <code>imem_addr</code> is the pc; <code>imem_rdata</code> is the instruction word at that address, available in the same cycle (no memory latency). For a load the core puts the address on <code>dmem_addr</code> and gets the aligned word back on <code>dmem_rdata</code> in the same cycle; a store drives <code>dmem_wdata</code> with the data already in the right byte lanes and <code>dmem_we</code> (one bit per byte) high. <code>rst</code> sets the pc to 0 and must change no other state. <code>ecall</code> and anything unknown simply advance the pc and change nothing. One instruction completes per clock cycle.</p>`;

function progs(stage: Stage | 5, r: Rng, hiddenN = 3, size = 40): ProgramSpec[] {
  const out: ProgramSpec[] = [];
  const size2 = stage === 5 ? 60 : size;
  for (let i = 0; i < 2; i++) out.push({ name: `random ${i + 1}`, src: genProgram(stage, r, size2), hidden: false });
  if (stage >= 2) for (const [k, v] of Object.entries(FIXED)) out.push({ name: k, src: v, hidden: false });
  for (let i = 0; i < hiddenN; i++) out.push({ name: `hidden ${i + 1}`, src: genProgram(stage, r, size2 + 20), hidden: true });
  return out;
}

const alu: RvLevel = {
  id: 'rv-alu', title: 'Core 1: arithmetic and memory', concept: 'single-cycle datapath: decode, ALU, register file, load/store', xp: 220, tier: 'guided', stage: 1,
  ticket: 'Tape-out of the first CPU starts with a core that can add. Fetch, decode and the register file are done: the ALU, memory and write-back are yours.',
  build: (r) => ({
    brief: `<p>You are building a <b>single-cycle RV32I core</b> over five missions. Each cycle it fetches the instruction at <code>pc</code>, decodes it, reads two registers, computes, accesses memory and writes the result back, and sets the next pc. In this first mission the core needs <b>arithmetic, <code>lui</code>/<code>auipc</code> and word loads and stores</b>; there are no branches yet (the pc just increments).</p>
${IFACE}
<p>Instruction encodings (the immediates are already decoded for you as <code>immI</code>, <code>immS</code>, <code>immU</code>):</p>${FORMATS}
<ul><li><b>R-type</b> (opcode 0110011) and <b>I-type</b> arithmetic (0010011): f3 chooses add/sub (000), sll (001), slt (010), sltu (011), xor (100), srl/sra (101), or (110), and (111). For R-type with <code>f7[5]</code> set, 000 is <b>sub</b> and 101 is <b>sra</b>. The second operand is <code>rv2</code> (R) or <code>immI</code> (I). Shift amounts are the low 5 bits.</li>
<li><b>lui</b> writes <code>immU</code>; <b>auipc</b> writes <code>pc + immU</code>. <b>lw</b> reads <code>dmem_rdata</code> at <code>rv1 + immI</code>; <b>sw</b> writes <code>rv2</code> at <code>rv1 + immS</code>.</li>
<li><b>x0 is hardwired to zero</b>: writes to it are discarded.</li></ul>
<p><b>This simulator has no signed arithmetic</b> (everything is unsigned), so <code>slt</code> and <code>sra</code> must be built by hand: for a signed compare, if the sign bits differ the negative one is smaller, otherwise an unsigned compare gives the right answer. An arithmetic right shift of a negative number is <code>~((~x) &gt;&gt; n)</code>.</p>
<p>Run the three TODOs, then <b>Check</b> compares your core's stream of stores with the ISA simulator's on random programs.</p>`,
    hints: ['Start with the write-back (TODO 3) and <code>addi</code> alone: <code>rf[rd] &lt;= alu</code> inside the clocked block when <code>rd != 0</code>. Then add operations one by one and watch the first failing store.', 'Use <code>case (f3)</code> inside <code>always @*</code> with a default assignment, so no latch is inferred.', 'When the failure message names an instruction like <code>sra a1, a2, a3</code>, check that one operation in isolation: what are its inputs and what should the result be?'],
    starter: STARTER_STAGE1, solution: referenceCore(1), programs: progs(1, r),
  }),
};

const branch: RvLevel = {
  id: 'rv-branch', title: 'Core 2: branches and jumps', concept: 'control flow: pc selection, branch comparators, jal/jalr and link registers', xp: 220, tier: 'guided', stage: 2,
  ticket: 'A CPU without control flow is a calculator. Add the comparators and the next-pc mux.',
  build: (r) => ({
    brief: `<p>Your core from the last mission is the starting point. Now teach it to <b>change the pc</b>.</p>
<ul><li><b>Branches</b> (opcode 1100011, B-type immediate <code>immB</code>): <code>beq</code> (f3=000), <code>bne</code> (001), <code>blt</code> (100), <code>bge</code> (101), <code>bltu</code> (110), <code>bgeu</code> (111) compare <code>rv1</code> with <code>rv2</code>; when taken the next pc is <code>pc + immB</code>, otherwise <code>pc + 4</code>. The signed compares need the same hand-built signed less-than as <code>slt</code>.</li>
<li><b>jal</b> (1101111): <code>rd ← pc + 4</code>, next pc = <code>pc + immJ</code>.</li>
<li><b>jalr</b> (1100111): <code>rd ← pc + 4</code>, next pc = <code>(rv1 + immI)</code> with <b>bit 0 cleared</b>.</li></ul>
<p>The link value <code>pc + 4</code> becomes the write-back result for jumps. Careful about ordering: the link register is written <i>and</i> the pc changes in the same clock edge, and a jump may use the very register it overwrites (<code>jalr ra, 0(ra)</code>). Since every value is read before the edge, this works naturally.</p>
<p>When your core goes wrong in control flow the message tells you the first cycle where the pc differs from the reference: look at the instruction executed just before it.</p>${IFACE}`,
    hints: ['Compute <code>taken</code> in an <code>always @*</code> with a <code>case (f3)</code>, then <code>next_pc = isJal ? pc + immJ : isJalr ? target : (isBranch &amp; taken) ? pc + immB : pc + 4</code>.', 'bge is the opposite of blt, bgeu the opposite of bltu: negate the comparator.', 'For jalr, clear bit 0: AND the sum with <code>32\'hFFFFFFFE</code>.'],
    starter: referenceCore(1), solution: referenceCore(2), programs: progs(2, r),
  }),
};

const mem: RvLevel = {
  id: 'rv-mem', title: 'Core 3: bytes and halfwords', concept: 'byte lanes, sign extension and alignment in the load/store unit', xp: 220, tier: 'guided', stage: 3,
  ticket: 'Real software uses chars and shorts. The memory interface only moves aligned words, so the core must pick bytes out of them and place them back.',
  build: (r) => ({
    brief: `<p>Extend the load/store unit. The memory is little-endian and word-wide: <code>dmem_rdata</code> is always the aligned word containing <code>dmem_addr</code> (address bits [1:0] select the <b>lane</b>).</p>
<ul><li><b>Loads</b> (f3): <code>lb</code> 000 (sign-extend the byte), <code>lh</code> 001 (sign-extend the halfword), <code>lw</code> 010, <code>lbu</code> 100, <code>lhu</code> 101 (zero-extend). Shift the word right by <code>8 × lane</code> bits first, then extend.</li>
<li><b>Stores</b> (f3): <code>sb</code> 000, <code>sh</code> 001, <code>sw</code> 010. The store data must be <b>replicated into the lanes</b> being written and the matching bits of <code>dmem_we</code> raised: <code>sb</code> → the byte in all four lanes, <code>we = 1 &lt;&lt; lane</code>; <code>sh</code> → the halfword twice, <code>we = 0011</code> or <code>1100</code>; <code>sw</code> → <code>we = 1111</code>.</li></ul>
<p>Addresses of halfword and word accesses are always aligned in the test programs (misaligned accesses trap in a real core; yours does not need to).</p>${IFACE}`,
    hints: ['Replacing the single <code>assign</code>s with an <code>always @*</code> block with a <code>case (f3[1:0])</code> for the store keeps it readable. Give every output a default.', 'A byte at lane 2 sits in bits [23:16] of the word. After shifting right by 16 it is in bits [7:0], ready to be sign- or zero-extended.', 'Sign extension: <code>{{24{b[7]}}, b[7:0]}</code>.'],
    starter: referenceCore(2), solution: referenceCore(3), programs: progs(3, r),
  }),
};

const mext: RvLevel = {
  id: 'rv-mext', title: 'Core 4: multiply and divide', concept: 'the M extension: signed/unsigned products and the division corner cases', xp: 240, tier: 'guided', stage: 4,
  ticket: 'Software wants multiplication. The architecture spec says the base core gets the M extension, including its awkward corner cases.',
  build: (r) => ({
    brief: `<p>Add the <b>M extension</b>: R-type with <code>f7 = 0000001</code>, so the same opcode (0110011) now means multiply or divide. f3 selects: <code>mul</code> 000 (low 32 bits of the product), <code>mulh</code> 001 (high 32 bits, signed × signed), <code>mulhsu</code> 010 (signed × unsigned), <code>mulhu</code> 011 (unsigned × unsigned), <code>div</code> 100, <code>divu</code> 101, <code>rem</code> 110, <code>remu</code> 111.</p>
<p>Without signed arithmetic, get the high half from the <b>unsigned 64-bit product</b> and correct it: if <code>rv1</code> is negative, subtract <code>rv2</code> from the high half; if <code>rv2</code> is negative (for mulh), subtract <code>rv1</code>. A product wire declared 64 bits wide makes <code>rv1 * rv2</code> evaluate at 64 bits.</p>
<p>Division follows the RISC-V rules: <b>division by zero</b> gives <code>div/divu = 0xFFFFFFFF</code> and <code>rem/remu = dividend</code> (no trap); signed overflow (<code>-2³¹ / -1</code>) gives <code>div = -2³¹</code> and <code>rem = 0</code>; the remainder has the sign of the dividend and the quotient is rounded toward zero. Divide absolute values, then fix the signs.</p>${IFACE}`,
    hints: ['Write the unsigned core first (<code>mul</code>, <code>mulhu</code>, <code>divu</code>, <code>remu</code>), then the signed variants as sign corrections.', 'For signed division: <code>ua = rv1[31] ? 0 - rv1 : rv1</code> and the same for the divisor, divide, then negate the quotient if the signs differ and the remainder if the dividend was negative. INT_MIN / -1 works out by itself in the 32-bit unsigned arithmetic.', 'The result mux: when <code>f7 == 7\'b0000001</code> on an R-type, pick the M-extension result instead of the ALU.'],
    starter: referenceCore(3), solution: referenceCore(4), programs: progs(4, r),
  }),
};

// ---- the boss: a core that already "works" but carries bugs found in bring-up
interface Bug { id: string; from: string; to: string; what: string }
const BUGS: Bug[] = [
  { id: 'sra', from: 'wire [31:0] sra  = rv1[31] ? ~((~rv1) >> sh) : (rv1 >> sh);', to: 'wire [31:0] sra  = rv1 >> sh;', what: 'arithmetic right shifts behave like logical shifts' },
  { id: 'slt', from: 'wire        lt_s = (rv1[31] != aluB[31]) ? rv1[31] : (rv1 < aluB);', to: 'wire        lt_s = rv1 < aluB;', what: 'slt/slti compare as unsigned' },
  { id: 'blt', from: 'wire        blt = (rv1[31] != rv2[31]) ? rv1[31] : (rv1 < rv2);', to: 'wire        blt = rv1 < rv2;', what: 'blt/bge compare as unsigned' },
  { id: 'jalr', from: "wire [31:0] jalr_target = (rv1 + immI) & 32'hFFFFFFFE;", to: 'wire [31:0] jalr_target = rv1 + immI;', what: 'jalr keeps bit 0 of its target' },
  { id: 'lh', from: '3\'b001: loadval = {{16{shifted[15]}}, shifted[15:0]};', to: "3'b001: loadval = {16'd0, shifted[15:0]};", what: 'lh does not sign-extend' },
  { id: 'lane', from: 'wire [31:0] shifted = dmem_rdata >> {lane, 3\'b000};', to: "wire [31:0] shifted = dmem_rdata >> {1'b0, lane[0], 3'b000};", what: 'loads from byte lanes 2 and 3 read the wrong byte' },
  { id: 'sb', from: '2\'b00: begin wdata = {rv2[7:0], rv2[7:0], rv2[7:0], rv2[7:0]}; we = 4\'b0001 << lane; end', to: "2'b00: begin wdata = rv2; we = 4'b0001 << lane; end", what: 'sb does not replicate the byte into its lane' },
  { id: 'sh', from: "2'b01: begin wdata = {rv2[15:0], rv2[15:0]}; we = lane[1] ? 4'b1100 : 4'b0011; end", to: "2'b01: begin wdata = {rv2[15:0], rv2[15:0]}; we = 4'b0011; end", what: 'sh to the upper halfword enables the wrong lanes' },
  { id: 'mulh', from: 'wire [31:0] mulh_ss  = prod[63:32] - (rv1[31] ? rv2 : 32\'d0) - (rv2[31] ? rv1 : 32\'d0);', to: "wire [31:0] mulh_ss  = prod[63:32] - (rv1[31] ? rv2 : 32'd0);", what: 'mulh is wrong when the second operand is negative' },
  { id: 'rem', from: "wire [31:0] rem_s    = dz ? rv1 : (rv1[31] ? (32'd0 - ur) : ur);", to: "wire [31:0] rem_s    = dz ? 32'd0 : (rv1[31] ? (32'd0 - ur) : ur);", what: 'rem by zero returns zero instead of the dividend' },
  { id: 'auipc', from: 'isAuipc ? (pc + immU) :', to: 'isAuipc ? (pc4 + immU) :', what: 'auipc adds to pc + 4' },
  { id: 'bimm', from: "wire [31:0] immB = {{19{instr[31]}}, instr[31], instr[7], instr[30:25], instr[11:8], 1'b0};", to: "wire [31:0] immB = {19'd0, instr[31], instr[7], instr[30:25], instr[11:8], 1'b0};", what: 'branch offsets lose their sign: backward branches go the wrong way' },
  { id: 'x0', from: "wire [31:0] rv1 = (rs1 == 5'd0) ? 32'd0 : rf[rs1];", to: 'wire [31:0] rv1 = rf[rs1];', what: 'writes to x0 become visible (x0 is not hardwired)' },
];
const buggyCore = (ids: string[]): string => {
  let src = referenceCore(4);
  for (const id of ids) {
    const b = BUGS.find((x) => x.id === id)!;
    if (!src.includes(b.from)) throw new Error(`bug ${id} does not apply`);
    src = src.replace(b.from, b.to);
    if (id === 'x0') src = src.replace("wire [31:0] rv2 = (rs2 == 5'd0) ? 32'd0 : rf[rs2];", 'wire [31:0] rv2 = rf[rs2];').replace('if (writes && rd != 5\'d0) rf[rd] <= result;', 'if (writes) rf[rd] <= result;');
  }
  return src;
};
export const BUG_IDS = BUGS.map((b) => b.id);
export const buggyCoreFor = buggyCore;

const boss: RvLevel = {
  id: 'rv-boss', title: 'Boss: bring-up of the first silicon model', concept: 'debugging a full RV32IM core from failing programs (bugs chosen by seed)', xp: 480, tier: 'boss', stage: 4,
  ticket: 'The RTL passes the unit tests and fails real programs. Three bugs slipped in. Find them from the failures: no hints.',
  build: (r) => {
    const ids = [...BUG_IDS];
    const chosen: string[] = [];
    while (chosen.length < 3) chosen.push(ids.splice(Math.floor(r() * ids.length), 1)[0]);
    return {
      brief: `<p>The full RV32IM core below (a single-cycle design like the one you built) fails the validation programs. <b>Three independent bugs</b> were introduced in the last RTL drop. Use the failing-program messages (the first differing store, the instruction that produced it, the cycle window) to localise each one, fix it, and get every program passing, including the hidden ones.</p>
<p>The programs mix arithmetic, jumps, branches, byte and halfword accesses and multiplies/divides; the bugs can be anywhere in the datapath. Remember that this simulator has no signed arithmetic and that x0 must read as zero.</p>${IFACE}`,
      hints: [], starter: buggyCore(chosen), solution: referenceCore(4), programs: progs(5, r, 4),
    };
  },
};

export const RV_LEVELS: RvLevel[] = [alu, branch, mem, mext, boss];
export const findRvLevel = (id: string) => RV_LEVELS.find((l) => l.id === id);

// Reference RV32I(M) single-cycle core in the simulator's Verilog subset (2-state, unsigned arithmetic, one module).
// The stage argument selects what the core implements; the project missions grow the same core step by step.

export type Stage = 1 | 2 | 3 | 4;

export const PORTS = [
  { name: 'clk', dir: 'input', width: 1 }, { name: 'rst', dir: 'input', width: 1 },
  { name: 'imem_addr', dir: 'output', width: 32 }, { name: 'imem_rdata', dir: 'input', width: 32 },
  { name: 'dmem_addr', dir: 'output', width: 32 }, { name: 'dmem_wdata', dir: 'output', width: 32 }, { name: 'dmem_we', dir: 'output', width: 4 }, { name: 'dmem_rdata', dir: 'input', width: 32 },
] as const;

const HEADER = `module rv32_core (
  input clk,
  input rst,
  output [31:0] imem_addr,   // instruction address (the pc)
  input  [31:0] imem_rdata,  // instruction word, available in the same cycle
  output [31:0] dmem_addr,   // byte address of the load or store
  output [31:0] dmem_wdata,  // store data, already placed in the right byte lanes
  output [3:0]  dmem_we,     // byte write enables (0 = no store)
  input  [31:0] dmem_rdata   // the aligned word at dmem_addr, same cycle
);
`;

const DECODE = `  // ---------- fetch
  logic [31:0] pc;
  assign imem_addr = pc;
  wire [31:0] instr = imem_rdata;

  // ---------- decode
  wire [6:0] opcode = instr[6:0];
  wire [4:0] rd     = instr[11:7];
  wire [2:0] f3     = instr[14:12];
  wire [4:0] rs1    = instr[19:15];
  wire [4:0] rs2    = instr[24:20];
  wire [6:0] f7     = instr[31:25];
  wire [31:0] immI = {{20{instr[31]}}, instr[31:20]};
  wire [31:0] immS = {{20{instr[31]}}, instr[31:25], instr[11:7]};
  wire [31:0] immB = {{19{instr[31]}}, instr[31], instr[7], instr[30:25], instr[11:8], 1'b0};
  wire [31:0] immU = {instr[31:12], 12'b0};
  wire [31:0] immJ = {{11{instr[31]}}, instr[31], instr[19:12], instr[20], instr[30:21], 1'b0};
  wire isOp     = opcode == 7'b0110011;
  wire isOpImm  = opcode == 7'b0010011;
  wire isLoad   = opcode == 7'b0000011;
  wire isStore  = opcode == 7'b0100011;
  wire isBranch = opcode == 7'b1100011;
  wire isJal    = opcode == 7'b1101111;
  wire isJalr   = opcode == 7'b1100111;
  wire isLui    = opcode == 7'b0110111;
  wire isAuipc  = opcode == 7'b0010111;

  // ---------- register file: x0 always reads as zero
  logic [31:0] rf [0:31];
  wire [31:0] rv1 = (rs1 == 5'd0) ? 32'd0 : rf[rs1];
  wire [31:0] rv2 = (rs2 == 5'd0) ? 32'd0 : rf[rs2];
`;

const ALU = `
  // ---------- ALU (no signed arithmetic in this simulator: signed compare and arithmetic shift are built by hand)
  wire [31:0] aluB = isOp ? rv2 : immI;
  wire [4:0]  sh   = aluB[4:0];
  wire        lt_s = (rv1[31] != aluB[31]) ? rv1[31] : (rv1 < aluB);
  wire        lt_u = rv1 < aluB;
  wire        sub  = isOp & f7[5];
  wire [31:0] sra  = rv1[31] ? ~((~rv1) >> sh) : (rv1 >> sh);
  logic [31:0] alu;
  always_comb begin
    alu = 32'd0;
    case (f3)
      3'b000: alu = sub ? (rv1 - aluB) : (rv1 + aluB);
      3'b001: alu = rv1 << sh;
      3'b010: alu = {31'd0, lt_s};
      3'b011: alu = {31'd0, lt_u};
      3'b100: alu = rv1 ^ aluB;
      3'b101: alu = f7[5] ? sra : (rv1 >> sh);
      3'b110: alu = rv1 | aluB;
      3'b111: alu = rv1 & aluB;
    endcase
  end
`;

const MUL = `
  // ---------- M extension
  wire isM = isOp & (f7 == 7'b0000001);
  wire [63:0] prod = rv1 * rv2;
  wire [31:0] mulh_ss  = prod[63:32] - (rv1[31] ? rv2 : 32'd0) - (rv2[31] ? rv1 : 32'd0);
  wire [31:0] mulh_su  = prod[63:32] - (rv1[31] ? rv2 : 32'd0);
  wire        dz       = rv2 == 32'd0;
  wire [31:0] ua       = rv1[31] ? (32'd0 - rv1) : rv1;
  wire [31:0] ub       = rv2[31] ? (32'd0 - rv2) : rv2;
  wire [31:0] uq       = dz ? 32'd0 : (ua / ub);
  wire [31:0] ur       = dz ? 32'd0 : (ua % ub);
  wire [31:0] div_s    = dz ? 32'hFFFFFFFF : ((rv1[31] ^ rv2[31]) ? (32'd0 - uq) : uq);
  wire [31:0] rem_s    = dz ? rv1 : (rv1[31] ? (32'd0 - ur) : ur);
  wire [31:0] div_u    = dz ? 32'hFFFFFFFF : (rv1 / rv2);
  wire [31:0] rem_u    = dz ? rv1 : (rv1 % rv2);
  logic [31:0] mres;
  always_comb begin
    mres = 32'd0;
    case (f3)
      3'b000: mres = prod[31:0];
      3'b001: mres = mulh_ss;
      3'b010: mres = mulh_su;
      3'b011: mres = prod[63:32];
      3'b100: mres = div_s;
      3'b101: mres = div_u;
      3'b110: mres = rem_s;
      3'b111: mres = rem_u;
    endcase
  end
`;

const BRANCH = `
  // ---------- branches
  wire        blt = (rv1[31] != rv2[31]) ? rv1[31] : (rv1 < rv2);
  wire        bltu = rv1 < rv2;
  logic taken;
  always_comb begin
    taken = 1'b0;
    case (f3)
      3'b000: taken = rv1 == rv2;
      3'b001: taken = rv1 != rv2;
      3'b100: taken = blt;
      3'b101: taken = !blt;
      3'b110: taken = bltu;
      3'b111: taken = !bltu;
    endcase
  end
`;

const MEM_WORD = `
  // ---------- data memory (word accesses only)
  wire [31:0] daddr = rv1 + (isStore ? immS : immI);
  assign dmem_addr  = daddr;
  assign dmem_wdata = rv2;
  assign dmem_we    = (isStore & !rst) ? 4'b1111 : 4'b0000;
  wire [31:0] loadval = dmem_rdata;
`;

const MEM_SUB = `
  // ---------- data memory: byte, half and word accesses
  wire [31:0] daddr = rv1 + (isStore ? immS : immI);
  assign dmem_addr  = daddr;
  wire [1:0]  lane  = daddr[1:0];
  logic [31:0] wdata;
  logic [3:0]  we;
  always_comb begin
    wdata = rv2;
    we = 4'b0000;
    if (isStore & !rst) begin
      case (f3[1:0])
        2'b00: begin wdata = {rv2[7:0], rv2[7:0], rv2[7:0], rv2[7:0]}; we = 4'b0001 << lane; end
        2'b01: begin wdata = {rv2[15:0], rv2[15:0]}; we = lane[1] ? 4'b1100 : 4'b0011; end
        default: begin wdata = rv2; we = 4'b1111; end
      endcase
    end
  end
  assign dmem_wdata = wdata;
  assign dmem_we    = we;
  wire [31:0] shifted = dmem_rdata >> {lane, 3'b000};
  logic [31:0] loadval;
  always_comb begin
    case (f3)
      3'b000: loadval = {{24{shifted[7]}}, shifted[7:0]};
      3'b001: loadval = {{16{shifted[15]}}, shifted[15:0]};
      3'b100: loadval = {24'd0, shifted[7:0]};
      3'b101: loadval = {16'd0, shifted[15:0]};
      default: loadval = dmem_rdata;
    endcase
  end
`;

function writeback(stage: Stage): string {
  const jumps = stage >= 2;
  return `
  // ---------- write-back and next pc
  wire [31:0] pc4 = pc + 32'd4;
  wire [31:0] result =
      isLui   ? immU :
      isAuipc ? (pc + immU) :
${jumps ? '      (isJal | isJalr) ? pc4 :\n' : ''}      isLoad  ? loadval :
${stage >= 4 ? '      isM     ? mres :\n' : ''}      alu;
  wire writes = isOp | isOpImm | isLui | isAuipc | isLoad${jumps ? ' | isJal | isJalr' : ''};
${jumps ? `  wire [31:0] jalr_target = (rv1 + immI) & 32'hFFFFFFFE;
  wire [31:0] next_pc =
      isJal ? (pc + immJ) :
      isJalr ? jalr_target :
      (isBranch & taken) ? (pc + immB) :
      pc4;
` : '  wire [31:0] next_pc = pc4;\n'}
  always_ff @(posedge clk) begin
    if (rst) pc <= 32'd0;
    else begin
      pc <= next_pc;
      if (writes && rd != 5'd0) rf[rd] <= result;
    end
  end
endmodule
`;
}

export function referenceCore(stage: Stage): string {
  return HEADER + '\n' + DECODE + ALU + (stage >= 4 ? MUL : '') + (stage >= 2 ? BRANCH : '') + (stage >= 3 ? MEM_SUB : MEM_WORD) + writeback(stage);
}

/** What the learner starts the first mission with: fetch, decode and the register file are given. */
export const STARTER_STAGE1 = HEADER + '\n' + DECODE + `
  // ---------- TODO 1: the ALU
  // R-type (opcode 0110011) and I-type (0010011) arithmetic: add, sub, sll, slt, sltu, xor, srl, sra, or, and.
  // The second operand is rv2 for R-type and immI for I-type; f3 picks the operation and f7[5] picks sub / sra.
  wire [31:0] alu = 32'd0;

  // ---------- TODO 2: data memory (word loads and stores)
  // address = rv1 + immI for loads, rv1 + immS for stores. A store drives dmem_we = 4'b1111 and dmem_wdata = rv2
  // (but never while rst is high). A load just uses dmem_rdata.
  assign dmem_addr  = 32'd0;
  assign dmem_wdata = 32'd0;
  assign dmem_we    = 4'b0000;

  // ---------- TODO 3: write-back
  // Pick the result (lui: immU, auipc: pc + immU, load: dmem_rdata, otherwise alu) and write it to rf[rd]
  // unless rd is x0. Remember that everything happens on the clock edge.
  always_ff @(posedge clk) begin
    if (rst) pc <= 32'd0;
    else pc <= pc + 32'd4;
  end
endmodule
`;

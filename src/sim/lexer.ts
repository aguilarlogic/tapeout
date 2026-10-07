// Tokenizer for the synthesizable Verilog / SystemVerilog subset Tapeout simulates.

export type TokKind = 'id' | 'kw' | 'num' | 'op' | 'eof';

export interface NumLit {
  value: bigint;
  width: number; // 32 for unsized literals
  sized: boolean;
  dcMask: bigint; // bits written as ?, z or x (don't-care in casez)
  signed?: boolean; // plain decimal literals like 42 are signed in Verilog
  fill?: boolean; // SystemVerilog '1: all ones at whatever width the context needs
}

export interface Token {
  kind: TokKind;
  text: string;
  line: number;
  num?: NumLit;
}

export class VerilogError extends Error {
  constructor(message: string, public line: number) {
    super(line > 0 ? `line ${line}: ${message}` : message);
  }
}

const KEYWORDS = new Set([
  'module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'logic', 'integer', 'int',
  'assign', 'always', 'always_comb', 'always_ff', 'always_latch', 'posedge', 'negedge', 'or',
  'begin', 'end', 'if', 'else', 'case', 'casez', 'casex', 'endcase', 'default', 'for',
  'parameter', 'localparam', 'initial', 'function', 'task', 'generate', 'genvar', 'signed', 'unique', 'priority', 'typedef', 'enum',
]);

// Longest operators first so the scanner is greedy.
const OPS = [
  '<<<', '>>>', '===', '!==',
  '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '~&', '~|', '~^', '^~', '+:', '-:', '**',
  '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '<', '>', '=', '?', ':', ';', ',', '.',
  '(', ')', '[', ']', '{', '}', '@', '#',
];

export function tokenize(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2;
      continue;
    }
    if (c === '`') throw new VerilogError('compiler directives (`define, `include, ...) are not supported yet', line);

    // Identifiers / keywords / system tasks
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const text = src.slice(i, j);
      toks.push({ kind: KEYWORDS.has(text) ? 'kw' : 'id', text, line });
      i = j;
      continue;
    }

    // SystemVerilog fill literals: '0 '1 'x 'z
    if (c === "'" && /[01xXzZ]/.test(src[i + 1] ?? '') && !/[A-Za-z0-9_]/.test(src[i + 2] ?? '')) {
      const ones = src[i + 1] === '1';
      toks.push({ kind: 'num', text: src.slice(i, i + 2), line, num: { value: ones ? 1n : 0n, width: 1, sized: false, dcMask: 0n, fill: ones } });
      i += 2;
      continue;
    }

    // Numbers: 8'hFF, 'b1010, 4'd9, 42, 1_000
    if (/[0-9]/.test(c) || (c === "'" && /[sSbBoOdDhH]/.test(src[i + 1] ?? ''))) {
      const start = i;
      let sizeText = '';
      while (i < n && /[0-9_]/.test(src[i])) sizeText += src[i++];
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
      if (src[j] === "'" && /[sSbBoOdDhH]/.test(src[j + 1] ?? '')) {
        i = j + 1;
        if (src[i] === 's' || src[i] === 'S') i++;
        const base = src[i++].toLowerCase();
        while (i < n && (src[i] === ' ' || src[i] === '\t')) i++;
        let digits = '';
        while (i < n && /[0-9a-fA-FxXzZ?_]/.test(src[i])) digits += src[i++];
        digits = digits.replace(/_/g, '');
        if (!digits) throw new VerilogError(`malformed number '${src.slice(start, i)}'`, line);
        const sized = sizeText.length > 0;
        const width = sized ? parseInt(sizeText.replace(/_/g, ''), 10) : 32;
        if (sized && (width < 1 || width > 1024)) throw new VerilogError(`unsupported literal width ${width}`, line);
        const num = parseBased(base, digits, width, line);
        toks.push({ kind: 'num', text: src.slice(start, i), line, num: { ...num, width, sized } });
        continue;
      }
      const clean = sizeText.replace(/_/g, '');
      toks.push({ kind: 'num', text: sizeText, line, num: { value: BigInt(clean), width: 32, sized: false, dcMask: 0n, signed: true } });
      continue;
    }

    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      toks.push({ kind: 'op', text: op, line });
      i += op.length;
      continue;
    }
    throw new VerilogError(`unexpected character '${c}'`, line);
  }
  toks.push({ kind: 'eof', text: '<end of file>', line });
  return toks;
}

function parseBased(base: string, digits: string, width: number, line: number): { value: bigint; dcMask: bigint } {
  const bitsPer = base === 'b' ? 1 : base === 'o' ? 3 : base === 'h' ? 4 : 0;
  const mask = (1n << BigInt(width)) - 1n;
  if (bitsPer === 0) {
    if (/^[xz?]$/i.test(digits)) return { value: 0n, dcMask: mask };
    if (!/^[0-9]+$/.test(digits)) throw new VerilogError(`bad decimal digits '${digits}'`, line);
    return { value: BigInt(digits) & mask, dcMask: 0n };
  }
  let value = 0n;
  let dc = 0n;
  const radix = 1 << bitsPer;
  const digitMask = BigInt(radix - 1);
  for (const ch of digits) {
    value <<= BigInt(bitsPer);
    dc <<= BigInt(bitsPer);
    if (/[xXzZ?]/.test(ch)) { dc |= digitMask; continue; }
    const d = parseInt(ch, 16);
    if (Number.isNaN(d) || d >= radix) throw new VerilogError(`digit '${ch}' is not valid in base ${base}`, line);
    value |= BigInt(d);
  }
  return { value: value & mask, dcMask: dc & mask };
}

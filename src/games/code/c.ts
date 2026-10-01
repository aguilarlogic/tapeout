// A tree-walking interpreter for the C subset used in the Code Lab, with a byte-addressed little-endian memory.
// Memory errors are reported the way AddressSanitizer would: null dereference, heap/stack/global overflow,
// use after free, use after return, double free, writes to string literals.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { alignOf, CNode, CSyntaxError, CType, parseC, Program, sizeOf, StructDef, T_CHAR, T_DOUBLE, T_INT, T_LONG, T_ULONG, T_UINT, typeStr } from './cparse';

export { CSyntaxError };

export class CError extends Error {
  constructor(msg: string, public line: number, public kind: 'segv' | 'asan' | 'fpe' | 'abort' | 'timeout' | 'runtime' = 'runtime') { super(msg); }
}
class ExitSignal { constructor(public code: number) {} }

type V = { ty: CType; v: bigint | number };
type Signal = { k: 'ret'; v: V | undefined } | { k: 'brk' } | { k: 'cont' } | undefined;
interface Var { addr: number; ty: CType }
interface FuncDef { name: string; ty: Extract<CType, { k: 'func' }>; body: CNode }
type Builtin = (args: V[], line: number) => V | undefined;

const MEM = 0x400000, DATA_BASE = 0x1000, HEAP_BASE = 0x100000, HEAP_END = 0x2f0000, STACK_LIMIT = 0x300000, STACK_TOP = MEM;
const FUNC_BASE = 0x70000000n;
const S_OK = 1, S_FREED = 2, S_DEAD = 3, S_RED = 4, S_RO = 5;

const isInt = (t: CType): t is Extract<CType, { k: 'int' }> => t.k === 'int';
const isFloat = (t: CType): t is Extract<CType, { k: 'float' }> => t.k === 'float';
const isPtr = (t: CType): t is Extract<CType, { k: 'ptr' }> => t.k === 'ptr';
const ptrTo = (to: CType): CType => ({ k: 'ptr', to });
const hex = (n: number | bigint) => '0x' + n.toString(16);

export interface COptions { stdin?: string; maxSteps?: number; seed?: number; maxOutput?: number }

export class CInterp {
  buf = new ArrayBuffer(MEM);
  dv = new DataView(this.buf);
  u8 = new Uint8Array(this.buf);
  shadow = new Uint8Array(MEM);
  out: string[] = [];
  err: string[] = [];
  outLen = 0;
  steps = 0;
  maxSteps: number;
  line = 0;
  prog!: Program;

  dataTop = DATA_BASE;
  heapTop = HEAP_BASE;
  sp = STACK_TOP;
  blocks = new Map<number, { size: number; live: boolean }>();
  quarantine: number[] = [];
  globals = new Map<string, Var>();
  funcs = new Map<string, FuncDef>();
  funcList: (FuncDef | string)[] = [];
  scopes: Map<string, Var>[] = [];
  strs = new Map<CNode, number>();
  statics = new Map<CNode, Var>();
  stdin: string;
  stdinPos = 0;
  seed: number;
  depth = 0;
  private maxOutput: number;
  private builtins = new Map<string, Builtin>();
  private inits: { addr: number; ty: CType; init: CNode | null }[] = [];

  constructor(src: string, opts: COptions = {}) {
    this.maxSteps = opts.maxSteps ?? 5_000_000;
    this.stdin = opts.stdin ?? '';
    this.seed = (opts.seed ?? 1) >>> 0;
    this.maxOutput = opts.maxOutput ?? 100_000;
    this.installBuiltins();
    this.prog = parseC(src);
    this.link();
  }

  get stdout() { return this.out.join(''); }
  get stderr() { return this.err.join(''); }

  // ------------------------------------------------------------------ memory

  private fault(addr: number, size: number, write: boolean): never {
    const what = `${write ? 'write' : 'read'} of ${size} byte${size === 1 ? '' : 's'} at ${hex(addr)}`;
    if (addr >= 0 && addr < DATA_BASE) throw new CError(`Segmentation fault: ${write ? 'write to' : 'read from'} a null pointer (address ${hex(addr)})`, this.line, 'segv');
    if (addr < 0 || addr + size > MEM) throw new CError(`Segmentation fault: ${what} is outside the program's memory`, this.line, 'segv');
    const s = this.shadow[addr];
    if (s === S_RO && write) throw new CError(`Segmentation fault: ${what}. String literals live in read-only memory; copy it into an array first.`, this.line, 'segv');
    if (s === S_FREED) throw new CError(`AddressSanitizer: heap-use-after-free: ${what}. This memory was already released with free().`, this.line, 'asan');
    if (s === S_DEAD) throw new CError(`AddressSanitizer: stack-use-after-return: ${what}. A pointer to a local variable outlived the function that owned it.`, this.line, 'asan');
    if (addr >= STACK_LIMIT) throw new CError(`AddressSanitizer: stack-buffer-overflow: ${what}, past the end of a local variable.`, this.line, 'asan');
    if (addr >= HEAP_BASE && addr < HEAP_END) {
      let best: [number, { size: number }] | null = null;
      for (const [a, b] of this.blocks) if (a <= addr && (!best || a > best[0])) best = [a, b];
      const where = best ? (addr >= best[0] + best[1].size ? `${addr - (best[0] + best[1].size)} byte${addr - (best[0] + best[1].size) === 1 ? '' : 's'} past the end of a ${best[1].size}-byte block` : 'inside a block') : 'outside any block';
      throw new CError(`AddressSanitizer: heap-buffer-overflow: ${what}, ${where}.`, this.line, 'asan');
    }
    if (addr >= DATA_BASE && addr < HEAP_BASE) throw new CError(`AddressSanitizer: global-buffer-overflow: ${what}, past the end of a global or string.`, this.line, 'asan');
    throw new CError(`Segmentation fault: ${what}`, this.line, 'segv');
  }

  check(addr: number, size: number, write: boolean) {
    if (addr < DATA_BASE || addr + size > MEM) this.fault(addr, size, write);
    for (let i = 0; i < size; i++) {
      const s = this.shadow[addr + i];
      if (s !== S_OK && !(s === S_RO && !write)) this.fault(addr + i, size, write);
    }
  }

  private mark(addr: number, size: number, val: number) { this.shadow.fill(val, addr, addr + size); }

  allocData(size: number, align: number, readonly = false): number {
    const a = Math.ceil(this.dataTop / Math.max(align, 8)) * Math.max(align, 8);
    if (a + size + 16 >= HEAP_BASE) throw new CError('out of static memory', this.line);
    this.mark(a, size, readonly ? S_RO : S_OK);
    this.mark(a + size, 8, S_RED);
    this.dataTop = a + size + 8;
    return a;
  }

  malloc(size: number): number {
    if (size < 0 || size > HEAP_END - HEAP_BASE) return 0;
    const need = Math.max(size, 1);
    // first-fit reuse of a freed block that has left the quarantine
    for (const [a, b] of this.blocks) {
      if (!b.live && b.size >= need && b.size <= need * 2 + 32 && !this.quarantine.includes(a)) { b.live = true; this.mark(a, b.size, S_OK); this.u8.fill(0xbe, a, a + b.size); return a; }
    }
    const a = Math.ceil(this.heapTop / 16) * 16;
    if (a + need + 16 > HEAP_END) return 0;
    this.heapTop = a + need + 16;
    this.blocks.set(a, { size: need, live: true });
    this.mark(a, need, S_OK);
    this.mark(a + need, 16, S_RED);
    this.u8.fill(0xbe, a, a + need);
    return a;
  }

  free(addr: number) {
    if (addr === 0) return;
    const b = this.blocks.get(addr);
    if (!b) throw new CError(`AddressSanitizer: attempting free on address ${hex(addr)} which was not returned by malloc()`, this.line, 'asan');
    if (!b.live) throw new CError(`AddressSanitizer: double-free of ${hex(addr)}. This block was already freed.`, this.line, 'asan');
    b.live = false;
    this.mark(addr, b.size, S_FREED);
    this.quarantine.push(addr);
    if (this.quarantine.length > 4) this.quarantine.shift();
  }

  stackAlloc(size: number, align: number): number {
    const rz = 8;
    let a = this.sp - rz - Math.max(size, 1);
    a -= a % Math.max(align, 1);
    if (a < STACK_LIMIT) throw new CError('Segmentation fault: stack overflow (infinite recursion?)', this.line, 'segv');
    this.mark(a - 0, size, S_OK);
    this.mark(a + size, Math.min(rz, this.sp - (a + size)), S_RED);
    this.u8.fill(0xcd, a, a + size);
    this.sp = a;
    return a;
  }

  releaseStack(to: number) {
    if (to > this.sp) this.mark(this.sp, to - this.sp, S_DEAD);
    this.sp = to;
  }

  // ---- typed loads and stores
  load(addr: number, ty: CType): V {
    switch (ty.k) {
      case 'int': {
        const sz = ty.bits / 8;
        this.check(addr, sz, false);
        switch (ty.bits) {
          case 8: return { ty, v: BigInt(ty.signed ? this.dv.getInt8(addr) : this.dv.getUint8(addr)) };
          case 16: return { ty, v: BigInt(ty.signed ? this.dv.getInt16(addr, true) : this.dv.getUint16(addr, true)) };
          case 32: return { ty, v: BigInt(ty.signed ? this.dv.getInt32(addr, true) : this.dv.getUint32(addr, true)) };
          default: return { ty, v: ty.signed ? this.dv.getBigInt64(addr, true) : this.dv.getBigUint64(addr, true) };
        }
      }
      case 'float': this.check(addr, ty.bits / 8, false); return { ty, v: ty.bits === 32 ? this.dv.getFloat32(addr, true) : this.dv.getFloat64(addr, true) };
      case 'ptr': this.check(addr, 8, false); return { ty, v: this.dv.getBigUint64(addr, true) };
      case 'struct': return { ty, v: BigInt(addr) };
      case 'array': return { ty: ptrTo(ty.of), v: BigInt(addr) };
      default: throw new CError(`cannot load a value of type ${typeStr(ty)}`, this.line);
    }
  }

  store(addr: number, ty: CType, val: V) {
    switch (ty.k) {
      case 'int': {
        this.check(addr, ty.bits / 8, true);
        const x = val.v as bigint;
        switch (ty.bits) {
          case 8: this.dv.setUint8(addr, Number(BigInt.asUintN(8, x))); break;
          case 16: this.dv.setUint16(addr, Number(BigInt.asUintN(16, x)), true); break;
          case 32: this.dv.setUint32(addr, Number(BigInt.asUintN(32, x)), true); break;
          default: this.dv.setBigUint64(addr, BigInt.asUintN(64, x), true);
        }
        return;
      }
      case 'float': this.check(addr, ty.bits / 8, true); if (ty.bits === 32) this.dv.setFloat32(addr, val.v as number, true); else this.dv.setFloat64(addr, val.v as number, true); return;
      case 'ptr': this.check(addr, 8, true); this.dv.setBigUint64(addr, BigInt.asUintN(64, val.v as bigint), true); return;
      case 'struct': {
        const n = sizeOf(ty), src = Number(val.v);
        this.check(src, n, false);
        this.check(addr, n, true);
        this.u8.copyWithin(addr, src, src + n);
        return;
      }
      default: throw new CError(`cannot store a value of type ${typeStr(ty)}`, this.line);
    }
  }

  cstring(addr: number, max = 1 << 20): string {
    let s = '';
    for (let i = 0; i < max; i++) {
      this.check(addr + i, 1, false);
      const c = this.u8[addr + i];
      if (c === 0) return s;
      s += String.fromCharCode(c);
    }
    return s;
  }

  strLiteral(n: CNode): number {
    let a = this.strs.get(n);
    if (a === undefined) {
      const s: string = n.v;
      a = this.allocData(s.length + 1, 1, true);
      for (let i = 0; i < s.length; i++) this.u8[a + i] = s.charCodeAt(i) & 255;
      this.u8[a + s.length] = 0;
      this.strs.set(n, a);
    }
    return a;
  }

  // ------------------------------------------------------------------ linking and running

  private link() {
    // functions first, so global initialisers can take their addresses
    for (const d of this.prog.decls) {
      if (d.t === 'func') { this.funcs.set(d.name, { name: d.name, ty: d.ty, body: d.body }); }
    }
    const fid = (name: string) => { let i = this.funcList.findIndex((f) => (typeof f === 'string' ? f : f.name) === name); if (i < 0) { i = this.funcList.length; this.funcList.push(this.funcs.get(name) ?? name); } return i; };
    this.fid = fid;
    for (const d of this.prog.decls) {
      if (d.t === 'gvar') {
        if (this.globals.has(d.name)) throw new CError(`redefinition of '${d.name}'`, d.line);
        const addr = this.allocData(Math.max(sizeOf(d.ty), 1), alignOf(d.ty));
        this.globals.set(d.name, { addr, ty: d.ty });
        this.inits.push({ addr, ty: d.ty, init: d.init });
        this.line = d.line;
      }
    }
    for (const [n, v] of [['stdin', 3n], ['stdout', 1n], ['stderr', 2n]] as const) {
      const a = this.allocData(8, 8);
      this.dv.setBigUint64(a, v, true);
      this.globals.set(n, { addr: a, ty: ptrTo(T_CHAR) });
    }
  }
  fid!: (name: string) => number;

  /** Run global initialisers, then `main`. */
  runMain(args: V[] = []): number {
    this.scopes = [new Map()];
    for (const i of this.inits) { if (i.init) this.initVar(i.addr, i.ty, i.init); }
    const main = this.funcs.get('main');
    if (!main) throw new CError("undefined reference to `main'", 0);
    const r = this.callFunc(main, args.slice(0, main.ty.params.length));
    return r ? Number(BigInt.asIntN(32, r.v as bigint)) : 0;
  }

  /** Call a function by name with integer or double arguments; returns the result as a JS number or bigint. */
  callByName(name: string, args: (bigint | number)[]): bigint | number | undefined {
    if (!this.scopes.length) { this.scopes = [new Map()]; for (const i of this.inits) if (i.init) this.initVar(i.addr, i.ty, i.init); }
    const f = this.funcs.get(name);
    if (!f) throw new CError(`undefined reference to \`${name}'`, 0);
    const vs = args.map((a, i) => this.conv({ ty: typeof a === 'number' ? T_DOUBLE : T_LONG, v: a }, f.ty.params[i] ?? T_LONG));
    return this.callFunc(f, vs)?.v;
  }

  static run(src: string, opts: COptions = {}): { stdout: string; stderr: string; exit: number | null; error?: string; line?: number; kind?: string; interp?: CInterp } {
    let it: CInterp;
    try { it = new CInterp(src, opts); } catch (e) {
      if (e instanceof CSyntaxError) return { stdout: '', stderr: '', exit: null, error: `error: ${e.message}`, line: e.line, kind: 'compile' };
      if (e instanceof CError) return { stdout: '', stderr: '', exit: null, error: e.message, line: e.line, kind: e.kind };
      throw e;
    }
    try {
      const code = it.runMain();
      return { stdout: it.stdout, stderr: it.stderr, exit: code, interp: it };
    } catch (e) {
      if (e instanceof ExitSignal) return { stdout: it.stdout, stderr: it.stderr, exit: e.code, interp: it };
      if (e instanceof RangeError) return { stdout: it.stdout, stderr: it.stderr, exit: null, error: 'Segmentation fault: stack overflow (infinite recursion?)', line: it.line, kind: 'segv', interp: it };
      if (e instanceof CError) return { stdout: it.stdout, stderr: it.stderr, exit: null, error: e.message, line: e.line, kind: e.kind, interp: it };
      if (e instanceof CSyntaxError) return { stdout: it.stdout, stderr: it.stderr, exit: null, error: `error: ${e.message}`, line: e.line, kind: 'compile', interp: it };
      throw e;
    }
  }

  private tick() { if (++this.steps > this.maxSteps) throw new CError('Timed out: the program ran too long (infinite loop?)', this.line, 'timeout'); }

  write(s: string, err = false) {
    if (err) { this.err.push(s); return; }
    this.outLen += s.length;
    if (this.outLen > this.maxOutput) { if (this.outLen - s.length <= this.maxOutput) this.out.push('\n... output truncated ...\n'); return; }
    this.out.push(s);
  }

  // ------------------------------------------------------------------ conversions

  conv(v: V, to: CType): V {
    const from = v.ty;
    switch (to.k) {
      case 'int': {
        let x: bigint;
        if (typeof v.v === 'number') x = Number.isFinite(v.v) ? BigInt(Math.trunc(v.v)) : 0n;
        else x = v.v;
        if (to.name === '_Bool' || to.name === 'bool') return { ty: to, v: (typeof v.v === 'number' ? v.v !== 0 : x !== 0n) ? 1n : 0n };
        return { ty: to, v: to.signed ? BigInt.asIntN(to.bits, x) : BigInt.asUintN(to.bits, x) };
      }
      case 'float': {
        const n = typeof v.v === 'number' ? v.v : Number(v.v);
        return { ty: to, v: to.bits === 32 ? Math.fround(n) : n };
      }
      case 'ptr': {
        if (typeof v.v === 'number') throw new CError('cannot convert a floating-point value to a pointer', this.line);
        return { ty: to, v: BigInt.asUintN(64, v.v) };
      }
      case 'void': return { ty: to, v: 0n };
      case 'struct':
        if (from.k !== 'struct' || from.def !== to.def) throw new CError(`incompatible types when assigning to type '${typeStr(to)}' from type '${typeStr(from)}'`, this.line);
        return v;
      default: throw new CError(`cannot convert to ${typeStr(to)}`, this.line);
    }
  }

  truthy(v: V): boolean {
    if (typeof v.v === 'number') return v.v !== 0;
    if (v.ty.k === 'struct') throw new CError('used struct type value where scalar is required', this.line);
    return v.v !== 0n;
  }

  private promote(t: CType): CType { return isInt(t) && t.bits < 32 ? T_INT : t; }
  private common(a: CType, b: CType): CType {
    if (isFloat(a) || isFloat(b)) return isFloat(a) && isFloat(b) ? (a.bits >= b.bits ? a : b) : isFloat(a) ? a : b;
    const pa = this.promote(a) as Extract<CType, { k: 'int' }>, pb = this.promote(b) as Extract<CType, { k: 'int' }>;
    if (pa.bits > pb.bits) return pa;
    if (pb.bits > pa.bits) return pb;
    if (!pa.signed) return pa;
    if (!pb.signed) return pb;
    return pa;
  }

  // ------------------------------------------------------------------ declarations and initialisers

  private zero(addr: number, size: number) { this.check(addr, size, true); this.u8.fill(0, addr, addr + size); }

  initVar(addr: number, ty: CType, init: CNode) {
    if (init.t === 'init') {
      this.zero(addr, sizeOf(ty));
      this.initAggregate(addr, ty, init);
      return;
    }
    if (ty.k === 'array' && ty.of.k === 'int' && ty.of.bits === 8 && init.t === 'str') {
      const s: string = init.v;
      if (s.length > ty.n) throw new CError(`initializer-string for array of ${ty.n} chars is too long`, init.line);
      this.zero(addr, ty.n);
      for (let i = 0; i < s.length; i++) this.u8[addr + i] = s.charCodeAt(i) & 255;
      return;
    }
    if (ty.k === 'array') throw new CError('invalid initializer for an array', init.line);
    const v = this.rv(init);
    if (ty.k === 'struct') { this.store(addr, ty, this.conv(v, ty)); return; }
    this.store(addr, ty, this.conv(v, ty));
  }

  private initAggregate(addr: number, ty: CType, init: CNode) {
    const items = init.items as { desig?: { field?: string; idx?: number }; e: CNode }[];
    if (ty.k === 'array') {
      const es = sizeOf(ty.of);
      let i = 0;
      for (const it of items) {
        if (it.desig?.idx !== undefined) i = it.desig.idx;
        if (i >= ty.n) throw new CError('excess elements in array initializer', init.line);
        this.initElem(addr + i * es, ty.of, it.e);
        i++;
      }
    } else if (ty.k === 'struct') {
      let fi = 0;
      for (const it of items) {
        if (it.desig?.field !== undefined) { fi = ty.def.fields.findIndex((f) => f.name === it.desig!.field); if (fi < 0) throw new CError(`unknown field '${it.desig.field}' specified in initializer`, init.line); }
        const f = ty.def.fields[fi];
        if (!f) throw new CError('excess elements in struct initializer', init.line);
        this.initElem(addr + f.off, f.ty, it.e);
        fi++;
        if (ty.def.union) break;
      }
    } else {
      if (items.length !== 1) throw new CError('excess elements in scalar initializer', init.line);
      this.initElem(addr, ty, items[0].e);
    }
  }

  private initElem(addr: number, ty: CType, e: CNode) {
    if (e.t === 'init') { if (ty.k === 'array' || ty.k === 'struct') this.initAggregate(addr, ty, e); else this.initElem(addr, ty, e.items[0].e); return; }
    this.initVar(addr, ty, e);
  }

  declare(items: CNode[]) {
    const scope = this.scopes[this.scopes.length - 1];
    for (const d of items) {
      if (d.t === 'proto') continue;
      this.line = d.line;
      if (d.isStatic) {
        let v = this.statics.get(d);
        if (!v) {
          const addr = this.allocData(Math.max(sizeOf(d.ty), 1), alignOf(d.ty));
          v = { addr, ty: d.ty };
          this.statics.set(d, v);
          if (d.init) this.initVar(addr, d.ty, d.init);
        }
        scope.set(d.name, v);
        continue;
      }
      if (d.ty.k === 'struct' && !d.ty.def.complete) throw new CError(`variable '${d.name}' has initializer but incomplete type`, d.line);
      const addr = this.stackAlloc(sizeOf(d.ty), alignOf(d.ty));
      scope.set(d.name, { addr, ty: d.ty });
      if (d.init) this.initVar(addr, d.ty, d.init);
    }
  }

  // ------------------------------------------------------------------ statements

  callFunc(f: FuncDef, args: V[]): V | undefined {
    this.tick();
    if (++this.depth > 4000) { this.depth = 0; throw new CError('Segmentation fault: stack overflow (infinite recursion?)', this.line, 'segv'); }
    const sp0 = this.sp, saved = this.scopes;
    let keepSp = false;
    try {
      this.scopes = [new Map()];
      f.ty.params.forEach((pt, i) => {
        const name = f.ty.names[i];
        const addr = this.stackAlloc(sizeOf(pt), alignOf(pt));
        if (i < args.length) this.store(addr, pt, this.conv(args[i], pt));
        else throw new CError(`too few arguments to function '${f.name}'`, this.line);
        if (name) this.scopes[0].set(name, { addr, ty: pt });
      });
      const r = this.execBlockBody(f.body.body);
      let ret: V | undefined = r && r.k === 'ret' ? r.v : undefined;
      if (ret && f.ty.ret.k !== 'void') {
        ret = this.conv(ret, f.ty.ret);
        if (ret.ty.k === 'struct') {
          // copy the struct out of the dying frame
          const n = sizeOf(ret.ty), tmp = this.u8.slice(Number(ret.v), Number(ret.v) + n);
          this.releaseStack(sp0);
          this.scopes = saved;
          const a = this.stackAlloc(n, alignOf(ret.ty));
          keepSp = true;
          this.u8.set(tmp, a);
          return { ty: ret.ty, v: BigInt(a) };
        }
      }
      return f.ty.ret.k === 'void' ? undefined : ret ?? (f.name === 'main' ? { ty: T_INT, v: 0n } : undefined);
    } finally {
      this.depth--;
      if (!keepSp && this.sp < sp0) this.releaseStack(sp0);
      this.scopes = saved;
    }
  }

  private execBlockBody(body: CNode[]): Signal {
    for (const s of body) {
      const r = this.exec(s);
      if (r) return r;
    }
    return undefined;
  }

  private scoped<T>(fn: () => T): T {
    const sp0 = this.sp;
    this.scopes.push(new Map());
    try { return fn(); } finally { this.scopes.pop(); if (this.sp < sp0) this.releaseStack(sp0); }
  }

  exec(n: CNode): Signal {
    this.tick();
    this.line = n.line;
    switch (n.t) {
      case 'block': return this.scoped(() => this.execBlockBody(n.body));
      case 'decl': this.declare(n.items); return;
      case 'expr': this.rv(n.e); return;
      case 'empty': return;
      case 'if': return this.truthy(this.rv(n.test)) ? this.exec(n.then) : n.orelse ? this.exec(n.orelse) : undefined;
      case 'while':
        while (this.truthy(this.rv(n.test))) {
          this.tick();
          const r = this.exec(n.body);
          if (r) { if (r.k === 'brk') break; if (r.k === 'ret') return r; }
        }
        return;
      case 'dowhile':
        do {
          this.tick();
          const r = this.exec(n.body);
          if (r) { if (r.k === 'brk') break; if (r.k === 'ret') return r; }
        } while (this.truthy(this.rv(n.test)));
        return;
      case 'for':
        return this.scoped(() => {
          if (n.init) this.exec(n.init);
          while (!n.test || this.truthy(this.rv(n.test))) {
            this.tick();
            const r = this.exec(n.body);
            if (r) { if (r.k === 'brk') break; if (r.k === 'ret') return r; }
            if (n.step) this.rv(n.step);
          }
          return undefined;
        });
      case 'return': {
        if (!n.e) return { k: 'ret', v: undefined };
        return { k: 'ret', v: this.rv(n.e) };
      }
      case 'break': return { k: 'brk' };
      case 'continue': return { k: 'cont' };
      case 'switch': {
        const val = this.rv(n.e);
        if (!isInt(val.ty)) throw new CError('switch quantity not an integer', n.line);
        const body: CNode[] = n.body.t === 'block' ? n.body.body : [n.body];
        let start = body.findIndex((s) => s.t === 'case' && s.v === (val.v as bigint));
        if (start < 0) start = body.findIndex((s) => s.t === 'default');
        if (start < 0) return;
        return this.scoped(() => {
          for (let i = start; i < body.length; i++) {
            const s = body[i];
            if (s.t === 'case' || s.t === 'default') continue;
            const r = this.exec(s);
            if (r) { if (r.k === 'brk') return undefined; return r; }
          }
          return undefined;
        });
      }
      case 'case': case 'default': return;
      default: throw new CError(`unsupported statement ${n.t}`, n.line);
    }
  }

  // ------------------------------------------------------------------ expressions

  private lookup(name: string): Var | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) { const v = this.scopes[i].get(name); if (v) return v; }
    return this.globals.get(name);
  }

  private funcPtr(name: string): V {
    return { ty: ptrTo({ k: 'func', ret: T_INT, params: [], names: [], variadic: true }), v: FUNC_BASE + BigInt(this.fid(name)) * 8n };
  }

  /** Address and type of an lvalue. */
  lv(e: CNode): Var {
    switch (e.t) {
      case 'id': {
        const v = this.lookup(e.name);
        if (v) return v;
        throw new CError(`'${e.name}' undeclared (first use in this function)`, e.line);
      }
      case 'unary':
        if (e.op === '*') {
          const p = this.rv(e.e);
          if (!isPtr(p.ty)) throw new CError('invalid type argument of unary \'*\'', e.line);
          if (p.ty.to.k === 'void') throw new CError("dereferencing 'void *' pointer", e.line);
          return { addr: Number(p.v), ty: p.ty.to };
        }
        break;
      case 'index': {
        const base = this.rv(e.e), idx = this.rv(e.idx);
        let p = base, i = idx;
        if (!isPtr(p.ty) && isPtr(i.ty)) [p, i] = [i, p];
        if (!isPtr(p.ty) || !isInt(i.ty)) throw new CError('subscripted value is neither array nor pointer', e.line);
        const es = sizeOf(p.ty.to);
        return { addr: Number(BigInt.asUintN(64, (p.v as bigint) + (i.v as bigint) * BigInt(es))), ty: p.ty.to };
      }
      case 'member': {
        let base: Var;
        if (e.arrow) {
          const p = this.rv(e.e);
          if (!isPtr(p.ty) || p.ty.to.k !== 'struct') throw new CError(`invalid type argument of '->' (have '${typeStr(p.ty)}')`, e.line);
          base = { addr: Number(p.v), ty: p.ty.to };
        } else base = this.lv(e.e);
        if (base.ty.k !== 'struct') throw new CError(`request for member '${e.name}' in something not a structure or union`, e.line);
        const f = base.ty.def.fields.find((x) => x.name === e.name);
        if (!f) throw new CError(`'${typeStr(base.ty)}' has no member named '${e.name}'`, e.line);
        return { addr: base.addr + f.off, ty: f.ty };
      }
      case 'str': return { addr: this.strLiteral(e), ty: { k: 'array', of: T_CHAR, n: e.v.length + 1 } };
      case 'call': { const v = this.rv(e); if (v.ty.k === 'struct') return { addr: Number(v.v), ty: v.ty }; break; }
      case 'assign': { const v = this.rv(e); if (v.ty.k === 'struct') return this.lv(e.l); break; }
      case 'comma': this.rv(e.l); return this.lv(e.r);
      case 'cond': return this.truthy(this.rv(e.test)) ? this.lv(e.a) : this.lv(e.b);
    }
    throw new CError('lvalue required as left operand of assignment', e.line);
  }

  /** Static type of an expression, for sizeof. */
  private typeOf(e: CNode): CType {
    switch (e.t) {
      case 'id': { const v = this.lookup(e.name); if (v) return v.ty; const f = this.funcs.get(e.name); if (f) return f.ty; break; }
      case 'str': return { k: 'array', of: T_CHAR, n: e.v.length + 1 };
      case 'unary': if (e.op === '*') { const t = this.typeOf(e.e); if (t.k === 'ptr' || t.k === 'array') return t.k === 'ptr' ? t.to : t.of; } if (e.op === '&') return ptrTo(this.typeOf(e.e)); break;
      case 'index': { const t = this.typeOf(e.e); if (t.k === 'ptr') return t.to; if (t.k === 'array') return t.of; break; }
      case 'member': { let t = this.typeOf(e.e); if (t.k === 'ptr') t = t.to; if (t.k === 'struct') { const f = t.def.fields.find((x) => x.name === e.name); if (f) return f.ty; } break; }
      case 'cast': return e.ty;
      case 'call': { if (e.f.t === 'id') { const f = this.funcs.get(e.f.name); if (f) return f.ty.ret; } break; }
    }
    return this.rv(e).ty;
  }

  rv(e: CNode): V {
    switch (e.t) {
      case 'num': {
        const v: bigint = e.v, suf: string = e.suffix;
        const u = suf.includes('u'), l = suf.includes('l');
        let ty: CType;
        if (!l && !u && v >= -(2n ** 31n) && v < 2n ** 31n) ty = T_INT;
        else if (!l && (u || !e.dec) && v >= 0n && v < 2n ** 32n) ty = T_UINT;
        else if (!u && v < 2n ** 63n) ty = T_LONG;
        else ty = T_ULONG;
        if (e.chr) ty = T_INT;
        return { ty, v: ty.k === 'int' && ty.signed ? BigInt.asIntN(ty.bits, v) : BigInt.asUintN(64, v) };
      }
      case 'fnum': return { ty: e.float ? { k: 'float', bits: 32 } : T_DOUBLE, v: e.float ? Math.fround(e.v) : e.v };
      case 'str': return { ty: ptrTo(T_CHAR), v: BigInt(this.strLiteral(e)) };
      case 'id': {
        const v = this.lookup(e.name);
        if (v) return this.load(v.addr, v.ty);
        if (this.funcs.has(e.name) || this.builtins.has(e.name)) return this.funcPtr(e.name);
        throw new CError(`'${e.name}' undeclared (first use in this function)`, e.line);
      }
      case 'comma': this.rv(e.l); return this.rv(e.r);
      case 'cond': return this.truthy(this.rv(e.test)) ? this.rv(e.a) : this.rv(e.b);
      case 'sizeof': return { ty: T_ULONG, v: BigInt(sizeOf(e.ty ?? this.typeOf(e.e))) };
      case 'cast': { const v = this.rv(e.e); return e.ty.k === 'void' ? { ty: e.ty, v: 0n } : this.conv(v, e.ty); }
      case 'assert': {
        this.line = e.line;
        if (!this.truthy(this.rv(e.e))) throw new CError(`Assertion failed: ${e.text}`, e.line, 'abort');
        return { ty: { k: 'void' }, v: 0n };
      }
      case 'unary': return this.unary(e);
      case 'bin': return this.binary(e);
      case 'assign': return this.assignExpr(e);
      case 'incdec': {
        const l = this.lv(e.e);
        const old = this.load(l.addr, l.ty);
        const one: V = { ty: T_INT, v: 1n };
        const nv = this.arith(e.op === '++' ? '+' : '-', old, one, e.line);
        const stored = this.conv(nv, l.ty);
        this.store(l.addr, l.ty, stored);
        return e.prefix ? stored : old;
      }
      case 'index': case 'member': { const l = this.lv(e); return this.load(l.addr, l.ty); }
      case 'call': return this.call(e);
      default: throw new CError(`unsupported expression ${e.t}`, e.line);
    }
  }

  private unary(e: CNode): V {
    switch (e.op) {
      case '&': {
        if (e.e.t === 'id' && !this.lookup(e.e.name) && (this.funcs.has(e.e.name) || this.builtins.has(e.e.name))) return this.funcPtr(e.e.name);
        const l = this.lv(e.e);
        return { ty: ptrTo(l.ty), v: BigInt(l.addr) };
      }
      case '*': {
        const p = this.rv(e.e);
        if (isPtr(p.ty) && p.ty.to.k === 'func') return p;
        if (!isPtr(p.ty)) throw new CError("invalid type argument of unary '*'", e.line);
        if (p.ty.to.k === 'void') throw new CError("dereferencing 'void *' pointer", e.line);
        return this.load(Number(p.v), p.ty.to);
      }
      case '!': return { ty: T_INT, v: this.truthy(this.rv(e.e)) ? 0n : 1n };
      case '-': {
        const v = this.rv(e.e);
        if (isFloat(v.ty)) return { ty: v.ty, v: -(v.v as number) };
        if (!isInt(v.ty)) throw new CError(`wrong type argument to unary minus`, e.line);
        const t = this.promote(v.ty) as Extract<CType, { k: 'int' }>;
        return this.conv({ ty: t, v: -(v.v as bigint) }, t);
      }
      case '+': { const v = this.rv(e.e); return isInt(v.ty) ? this.conv(v, this.promote(v.ty)) : v; }
      case '~': {
        const v = this.rv(e.e);
        if (!isInt(v.ty)) throw new CError('wrong type argument to bit-complement', e.line);
        const t = this.promote(v.ty) as Extract<CType, { k: 'int' }>;
        return this.conv({ ty: t, v: ~(v.v as bigint) }, t);
      }
    }
    throw new CError(`bad unary operator ${e.op}`, e.line);
  }

  private binary(e: CNode): V {
    if (e.op === '&&') return { ty: T_INT, v: this.truthy(this.rv(e.l)) && this.truthy(this.rv(e.r)) ? 1n : 0n };
    if (e.op === '||') return { ty: T_INT, v: this.truthy(this.rv(e.l)) || this.truthy(this.rv(e.r)) ? 1n : 0n };
    const a = this.rv(e.l), b = this.rv(e.r);
    return this.arith(e.op, a, b, e.line);
  }

  arith(op: string, a: V, b: V, line: number): V {
    const cmp = ['<', '>', '<=', '>=', '==', '!='].includes(op);
    // pointers
    if (isPtr(a.ty) || isPtr(b.ty)) {
      if (cmp) {
        const x = isPtr(a.ty) || isInt(a.ty) ? (a.v as bigint) : 0n, y = isPtr(b.ty) || isInt(b.ty) ? (b.v as bigint) : 0n;
        const ux = BigInt.asUintN(64, x), uy = BigInt.asUintN(64, y);
        return { ty: T_INT, v: (op === '<' ? ux < uy : op === '>' ? ux > uy : op === '<=' ? ux <= uy : op === '>=' ? ux >= uy : op === '==' ? ux === uy : ux !== uy) ? 1n : 0n };
      }
      if ((op === '+' || op === '-') && isPtr(a.ty) && isInt(b.ty)) {
        if (a.ty.to.k === 'void') throw new CError('arithmetic on a pointer to void is not allowed in this C subset', line);
        const d = (b.v as bigint) * BigInt(sizeOf(a.ty.to));
        return { ty: a.ty, v: BigInt.asUintN(64, op === '+' ? (a.v as bigint) + d : (a.v as bigint) - d) };
      }
      if (op === '+' && isInt(a.ty) && isPtr(b.ty)) return this.arith('+', b, a, line);
      if (op === '-' && isPtr(a.ty) && isPtr(b.ty)) {
        const sz = BigInt(Math.max(sizeOf(a.ty.to), 1));
        return { ty: T_LONG, v: BigInt.asIntN(64, ((a.v as bigint) - (b.v as bigint)) / sz) };
      }
      throw new CError(`invalid operands to binary ${op} (have '${typeStr(a.ty)}' and '${typeStr(b.ty)}')`, line);
    }
    if (a.ty.k === 'struct' || b.ty.k === 'struct') throw new CError(`invalid operands to binary ${op} (have '${typeStr(a.ty)}' and '${typeStr(b.ty)}')`, line);
    const ct = this.common(a.ty, b.ty);
    if (isFloat(ct)) {
      const x = typeof a.v === 'number' ? a.v : Number(a.v), y = typeof b.v === 'number' ? b.v : Number(b.v);
      const r = (n: number): V => ({ ty: ct, v: ct.bits === 32 ? Math.fround(n) : n });
      switch (op) {
        case '+': return r(x + y); case '-': return r(x - y); case '*': return r(x * y); case '/': return r(x / y);
        case '<': return { ty: T_INT, v: x < y ? 1n : 0n }; case '>': return { ty: T_INT, v: x > y ? 1n : 0n };
        case '<=': return { ty: T_INT, v: x <= y ? 1n : 0n }; case '>=': return { ty: T_INT, v: x >= y ? 1n : 0n };
        case '==': return { ty: T_INT, v: x === y ? 1n : 0n }; case '!=': return { ty: T_INT, v: x !== y ? 1n : 0n };
      }
      throw new CError(`invalid operands to binary ${op} (have '${typeStr(a.ty)}' and '${typeStr(b.ty)}')`, line);
    }
    const it = ct as Extract<CType, { k: 'int' }>;
    const wrap = (n: bigint): V => ({ ty: it, v: it.signed ? BigInt.asIntN(it.bits, n) : BigInt.asUintN(it.bits, n) });
    const x = this.conv(a, it).v as bigint, y = this.conv(b, it).v as bigint;
    switch (op) {
      case '+': return wrap(x + y);
      case '-': return wrap(x - y);
      case '*': return wrap(x * y);
      case '/': if (y === 0n) throw new CError('Floating point exception: integer division by zero', line, 'fpe'); return wrap(x / y);
      case '%': if (y === 0n) throw new CError('Floating point exception: integer modulo by zero', line, 'fpe'); return wrap(x % y);
      case '&': return wrap(x & y);
      case '|': return wrap(x | y);
      case '^': return wrap(x ^ y);
      case '<<': case '>>': {
        // the result has the promoted type of the left operand only
        const lt = this.promote(a.ty) as Extract<CType, { k: 'int' }>;
        const lx = this.conv(a, lt).v as bigint;
        const cnt = BigInt(Number(BigInt.asUintN(64, b.v as bigint)) & (lt.bits - 1));
        const r = op === '<<' ? lx << cnt : lx >> cnt;
        return { ty: lt, v: lt.signed ? BigInt.asIntN(lt.bits, r) : BigInt.asUintN(lt.bits, r) };
      }
      case '<': return { ty: T_INT, v: x < y ? 1n : 0n };
      case '>': return { ty: T_INT, v: x > y ? 1n : 0n };
      case '<=': return { ty: T_INT, v: x <= y ? 1n : 0n };
      case '>=': return { ty: T_INT, v: x >= y ? 1n : 0n };
      case '==': return { ty: T_INT, v: x === y ? 1n : 0n };
      case '!=': return { ty: T_INT, v: x !== y ? 1n : 0n };
    }
    throw new CError(`bad operator ${op}`, line);
  }

  private assignExpr(e: CNode): V {
    const l = this.lv(e.l);
    if (l.ty.k === 'array') throw new CError('assignment to expression with array type', e.line);
    let val: V;
    if (e.op === '') val = this.rv(e.r);
    else {
      const old = this.load(l.addr, l.ty);
      val = this.arith(e.op, old, this.rv(e.r), e.line);
    }
    const c = this.conv(val, l.ty);
    this.store(l.addr, l.ty, c);
    return l.ty.k === 'struct' ? { ty: l.ty, v: BigInt(l.addr) } : c;
  }

  private call(e: CNode): V {
    this.line = e.line;
    let f: FuncDef | undefined;
    let bi: Builtin | undefined;
    let name = '';
    if (e.f.t === 'id' && !this.lookup(e.f.name)) {
      name = e.f.name;
      f = this.funcs.get(name);
      if (!f) bi = this.builtins.get(name);
      if (!f && !bi) throw new CError(`undefined reference to \`${name}'`, e.line);
    } else {
      const p = this.rv(e.f.t === 'unary' && e.f.op === '*' ? e.f.e : e.f);
      if (!isPtr(p.ty)) throw new CError('called object is not a function or function pointer', e.line);
      const idx = Number((p.v as bigint) - FUNC_BASE);
      if (p.v < FUNC_BASE || idx % 8 !== 0 || !this.funcList[idx / 8]) throw new CError(`Segmentation fault: call through an invalid function pointer (${hex(p.v as bigint)})`, e.line, 'segv');
      const target = this.funcList[idx / 8];
      if (typeof target === 'string') { name = target; f = this.funcs.get(target); if (!f) bi = this.builtins.get(target); } else f = target;
    }
    const args = e.args.map((a: CNode) => this.rv(a));
    this.line = e.line;
    if (f) {
      if (args.length < f.ty.params.length) throw new CError(`too few arguments to function '${f.name}'`, e.line);
      if (args.length > f.ty.params.length && !f.ty.variadic) throw new CError(`too many arguments to function '${f.name}'`, e.line);
      const r = this.callFunc(f, args);
      return r ?? { ty: { k: 'void' }, v: 0n };
    }
    const r = bi!(args, e.line);
    return r ?? { ty: { k: 'void' }, v: 0n };
  }

  // ------------------------------------------------------------------ the C library

  private int(v: V): bigint { return typeof v.v === 'number' ? BigInt(Math.trunc(v.v)) : v.v; }
  private num(v: V): number { return Number(v.v); }
  private ret(x: bigint | number, ty: CType = T_INT): V { return this.conv({ ty: typeof x === 'number' ? T_DOUBLE : T_LONG, v: x }, ty); }

  formatPrintf(fmt: string, args: V[]): string {
    let ai = 0;
    const next = (): V => { if (ai >= args.length) throw new CError('too few arguments for format string', this.line); return args[ai++]; };
    return fmt.replace(/%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+))?(hh|h|ll|l|z|j|t|L)?([diouxXeEfFgGcspn%])/g, (_m, flags: string, width: string | undefined, prec: string | undefined, len: string | undefined, conv: string) => {
      if (conv === '%') return '%';
      let w = width === '*' ? Number(this.int(next())) : width ? parseInt(width, 10) : 0;
      const p = prec === '*' ? Number(this.int(next())) : prec !== undefined ? parseInt(prec, 10) : -1;
      let left = flags.includes('-');
      if (w < 0) { left = true; w = -w; }
      const zero = flags.includes('0') && !left;
      const pad = (s: string, numeric = false) => {
        if (s.length >= w) return s;
        if (left) return s + ' '.repeat(w - s.length);
        if (zero && numeric) { const m = /^([+\- ]|0[xX])?/.exec(s)![0]; return m + '0'.repeat(w - s.length) + s.slice(m.length); }
        return ' '.repeat(w - s.length) + s;
      };
      const signed = (neg: boolean) => (neg ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '');
      switch (conv) {
        case 'd': case 'i': {
          const a = next();
          const bits = len === 'l' || len === 'll' || len === 'z' || len === 'j' || len === 't' ? 64 : len === 'hh' ? 8 : len === 'h' ? 16 : 32;
          const x = BigInt.asIntN(bits, this.int(a));
          let digits = (x < 0n ? -x : x).toString();
          if (p >= 0) digits = digits.padStart(p, '0');
          return pad(signed(x < 0n) + digits, p < 0);
        }
        case 'u': case 'o': case 'x': case 'X': {
          const a = next();
          const bits = len === 'l' || len === 'll' || len === 'z' || len === 'j' || len === 't' ? 64 : len === 'hh' ? 8 : len === 'h' ? 16 : 32;
          const x = BigInt.asUintN(bits, this.int(a));
          let digits = conv === 'u' ? x.toString() : conv === 'o' ? x.toString(8) : x.toString(16);
          if (conv === 'X') digits = digits.toUpperCase();
          if (p >= 0) digits = digits.padStart(p, '0');
          const prefix = flags.includes('#') && x !== 0n ? (conv === 'x' ? '0x' : conv === 'X' ? '0X' : conv === 'o' ? '0' : '') : '';
          return pad(prefix + digits, p < 0);
        }
        case 'c': return pad(String.fromCharCode(Number(BigInt.asUintN(8, this.int(next())))));
        case 's': {
          const a = next();
          let s = Number(a.v) === 0 ? '(null)' : this.cstring(Number(a.v));
          if (p >= 0) s = s.slice(0, p);
          return pad(s);
        }
        case 'p': { const a = next(); return pad(a.v === 0n ? '(nil)' : '0x' + (a.v as bigint).toString(16)); }
        case 'n': return '';
        default: {
          const x = this.num(next());
          const neg = x < 0 || Object.is(x, -0);
          const ax = Math.abs(x);
          const pp = p < 0 ? 6 : p;
          let body: string;
          if (!Number.isFinite(ax)) body = Number.isNaN(ax) ? 'nan' : 'inf';
          else if (conv === 'f' || conv === 'F') body = ax.toFixed(pp);
          else if (conv === 'e' || conv === 'E') { body = ax.toExponential(pp).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') body = body.toUpperCase(); }
          else {
            const q = pp === 0 ? 1 : pp;
            const exp = ax === 0 ? 0 : Math.floor(Math.log10(ax));
            if (exp < -4 || exp >= q) body = ax.toExponential(q - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2');
            else { body = ax.toFixed(Math.max(0, q - 1 - exp)); if (body.includes('.') && !flags.includes('#')) body = body.replace(/\.?0+$/, ''); }
            if (conv === 'G') body = body.toUpperCase();
          }
          return pad(signed(neg) + body, Number.isFinite(ax));
        }
      }
    });
  }

  private installBuiltins() {
    const b = (name: string, f: Builtin) => this.builtins.set(name, f);
    const ptr = (v: V) => Number(v.v);
    const sz = (v: V) => Number(this.int(v));
    const rint = (x: bigint | number) => this.ret(x, T_INT);
    const rptr = (a: number): V => ({ ty: ptrTo({ k: 'void' }), v: BigInt(a) });
    const rsize = (x: number): V => ({ ty: T_ULONG, v: BigInt(x) });
    const dbl = (v: V) => (typeof v.v === 'number' ? v.v : Number(v.v));
    const m1 = (name: string, f: (x: number) => number) => b(name, (a) => ({ ty: T_DOUBLE, v: f(dbl(a[0])) }));

    b('printf', (a) => { const fmt = this.cstring(ptr(a[0])); const s = this.formatPrintf(fmt, a.slice(1)); this.write(s); return rint(s.length); });
    b('fprintf', (a) => { const fmt = this.cstring(ptr(a[1])); const s = this.formatPrintf(fmt, a.slice(2)); this.write(s, a[0].v === 2n); return rint(s.length); });
    b('sprintf', (a) => { const s = this.formatPrintf(this.cstring(ptr(a[1])), a.slice(2)); this.writeStr(ptr(a[0]), s, s.length + 1); return rint(s.length); });
    b('snprintf', (a) => { const s = this.formatPrintf(this.cstring(ptr(a[2])), a.slice(3)); const n = sz(a[1]); if (n > 0) this.writeStr(ptr(a[0]), s.slice(0, n - 1), n); return rint(s.length); });
    b('puts', (a) => { this.write(this.cstring(ptr(a[0])) + '\n'); return rint(1); });
    b('fputs', (a) => { this.write(this.cstring(ptr(a[0])), a[1].v === 2n); return rint(1); });
    b('putchar', (a) => { this.write(String.fromCharCode(Number(BigInt.asUintN(8, this.int(a[0]))))); return rint(this.int(a[0])); });
    b('fputc', (a) => { this.write(String.fromCharCode(Number(BigInt.asUintN(8, this.int(a[0])))), a[1].v === 2n); return rint(this.int(a[0])); });
    b('fflush', () => rint(0));
    b('getchar', () => (this.stdinPos < this.stdin.length ? rint(this.stdin.charCodeAt(this.stdinPos++)) : rint(-1)));
    b('scanf', (a) => {
      const fmt = this.cstring(ptr(a[0]));
      let n = 0, ai = 1;
      for (const m of fmt.matchAll(/%(l{0,2}|h{0,2})([dfsc])/g)) {
        while (this.stdinPos < this.stdin.length && /\s/.test(this.stdin[this.stdinPos]) && m[2] !== 'c') this.stdinPos++;
        if (this.stdinPos >= this.stdin.length) return rint(n === 0 ? -1 : n);
        const rest = this.stdin.slice(this.stdinPos);
        const target = ptr(a[ai++]);
        if (m[2] === 'd') { const t = /^[+-]?\d+/.exec(rest); if (!t) break; this.stdinPos += t[0].length; const ty = m[1].startsWith('l') ? T_LONG : T_INT; this.store(target, ty, this.conv({ ty: T_LONG, v: BigInt(t[0]) }, ty)); }
        else if (m[2] === 'f') { const t = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest); if (!t) break; this.stdinPos += t[0].length; const ty: CType = m[1].startsWith('l') ? T_DOUBLE : { k: 'float', bits: 32 }; this.store(target, ty, this.conv({ ty: T_DOUBLE, v: parseFloat(t[0]) }, ty)); }
        else if (m[2] === 's') { const t = /^\S+/.exec(rest); if (!t) break; this.stdinPos += t[0].length; this.writeStr(target, t[0], t[0].length + 1); }
        else { this.store(target, T_CHAR, { ty: T_INT, v: BigInt(rest.charCodeAt(0)) }); this.stdinPos++; }
        n++;
      }
      return rint(n);
    });
    b('malloc', (a) => rptr(this.malloc(sz(a[0]))));
    b('calloc', (a) => { const n = sz(a[0]) * sz(a[1]); const p = this.malloc(n); if (p) this.u8.fill(0, p, p + n); return rptr(p); });
    b('realloc', (a) => {
      const old = ptr(a[0]), n = sz(a[1]);
      if (old === 0) return rptr(this.malloc(n));
      const blk = this.blocks.get(old);
      if (!blk || !blk.live) throw new CError(`AddressSanitizer: realloc of invalid pointer ${hex(old)}`, this.line, 'asan');
      const p = this.malloc(n);
      if (p) { this.u8.copyWithin(p, old, old + Math.min(n, blk.size)); this.free(old); }
      return rptr(p);
    });
    b('free', (a) => { this.free(ptr(a[0])); return undefined; });
    b('memcpy', (a) => { const d = ptr(a[0]), s = ptr(a[1]), n = sz(a[2]); if (n) { this.check(s, n, false); this.check(d, n, true); this.u8.copyWithin(d, s, s + n); } return a[0]; });
    b('memmove', (a) => { const d = ptr(a[0]), s = ptr(a[1]), n = sz(a[2]); if (n) { this.check(s, n, false); this.check(d, n, true); this.u8.copyWithin(d, s, s + n); } return a[0]; });
    b('memset', (a) => { const d = ptr(a[0]), n = sz(a[2]); if (n) { this.check(d, n, true); this.u8.fill(Number(BigInt.asUintN(8, this.int(a[1]))), d, d + n); } return a[0]; });
    b('memcmp', (a) => { const x = ptr(a[0]), y = ptr(a[1]), n = sz(a[2]); this.check(x, n, false); this.check(y, n, false); for (let i = 0; i < n; i++) if (this.u8[x + i] !== this.u8[y + i]) return rint(this.u8[x + i] - this.u8[y + i]); return rint(0); });
    b('strlen', (a) => rsize(this.cstring(ptr(a[0])).length));
    b('strcpy', (a) => { const s = this.cstring(ptr(a[1])); this.writeStr(ptr(a[0]), s, s.length + 1); return a[0]; });
    b('strncpy', (a) => { const n = sz(a[2]); const s = this.cstring(ptr(a[1])).slice(0, n); this.check(ptr(a[0]), n, true); this.u8.fill(0, ptr(a[0]), ptr(a[0]) + n); for (let i = 0; i < s.length; i++) this.u8[ptr(a[0]) + i] = s.charCodeAt(i); return a[0]; });
    b('strcat', (a) => { const d = this.cstring(ptr(a[0])), s = this.cstring(ptr(a[1])); this.writeStr(ptr(a[0]) + d.length, s, s.length + 1); return a[0]; });
    b('strcmp', (a) => { const x = this.cstring(ptr(a[0])), y = this.cstring(ptr(a[1])); return rint(x < y ? -1 : x > y ? 1 : 0); });
    b('strncmp', (a) => { const n = sz(a[2]); const x = this.cstring(ptr(a[0])).slice(0, n), y = this.cstring(ptr(a[1])).slice(0, n); return rint(x < y ? -1 : x > y ? 1 : 0); });
    b('strchr', (a) => { const s = this.cstring(ptr(a[0])); const c = String.fromCharCode(Number(BigInt.asUintN(8, this.int(a[1])))); const i = c === '\0' ? s.length : s.indexOf(c); return { ty: ptrTo(T_CHAR), v: i < 0 ? 0n : BigInt(ptr(a[0]) + i) }; });
    b('strrchr', (a) => { const s = this.cstring(ptr(a[0])); const i = s.lastIndexOf(String.fromCharCode(Number(this.int(a[1])))); return { ty: ptrTo(T_CHAR), v: i < 0 ? 0n : BigInt(ptr(a[0]) + i) }; });
    b('strstr', (a) => { const s = this.cstring(ptr(a[0])), t = this.cstring(ptr(a[1])); const i = s.indexOf(t); return { ty: ptrTo(T_CHAR), v: i < 0 ? 0n : BigInt(ptr(a[0]) + i) }; });
    b('abs', (a) => { const x = BigInt.asIntN(32, this.int(a[0])); return rint(x < 0n ? -x : x); });
    b('labs', (a) => this.ret(this.int(a[0]) < 0n ? -this.int(a[0]) : this.int(a[0]), T_LONG));
    b('atoi', (a) => { const m = /^\s*[+-]?\d+/.exec(this.cstring(ptr(a[0]))); return rint(m ? BigInt(m[0].trim()) : 0n); });
    b('atol', (a) => { const m = /^\s*[+-]?\d+/.exec(this.cstring(ptr(a[0]))); return this.ret(m ? BigInt(m[0].trim()) : 0n, T_LONG); });
    b('atof', (a) => ({ ty: T_DOUBLE, v: parseFloat(this.cstring(ptr(a[0]))) || 0 }));
    b('rand', () => { this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0; return rint((this.seed >>> 16) & 0x7fff); });
    b('srand', (a) => { this.seed = Number(BigInt.asUintN(32, this.int(a[0]))); return undefined; });
    b('exit', (a) => { throw new ExitSignal(Number(BigInt.asIntN(32, this.int(a[0])))); });
    b('abort', () => { throw new CError('Aborted (core dumped)', this.line, 'abort'); });
    b('toupper', (a) => { const c = Number(this.int(a[0])); return rint(c >= 97 && c <= 122 ? c - 32 : c); });
    b('tolower', (a) => { const c = Number(this.int(a[0])); return rint(c >= 65 && c <= 90 ? c + 32 : c); });
    const cls = (name: string, re: RegExp) => b(name, (a) => { const c = Number(this.int(a[0])); return rint(c >= 0 && c < 128 && re.test(String.fromCharCode(c)) ? 1 : 0); });
    cls('isdigit', /\d/); cls('isalpha', /[A-Za-z]/); cls('isalnum', /[A-Za-z0-9]/); cls('isspace', /\s/); cls('isupper', /[A-Z]/); cls('islower', /[a-z]/); cls('ispunct', /[!-/:-@[-`{-~]/);
    m1('sqrt', Math.sqrt); m1('fabs', Math.abs); m1('floor', Math.floor); m1('ceil', Math.ceil); m1('sin', Math.sin); m1('cos', Math.cos); m1('tan', Math.tan); m1('exp', Math.exp); m1('log', Math.log); m1('log2', Math.log2); m1('log10', Math.log10); m1('round', (x) => (x < 0 ? -Math.round(-x) : Math.round(x))); m1('trunc', Math.trunc); m1('atan', Math.atan); m1('asin', Math.asin); m1('acos', Math.acos);
    b('pow', (a) => ({ ty: T_DOUBLE, v: Math.pow(dbl(a[0]), dbl(a[1])) }));
    b('atan2', (a) => ({ ty: T_DOUBLE, v: Math.atan2(dbl(a[0]), dbl(a[1])) }));
    b('fmod', (a) => ({ ty: T_DOUBLE, v: dbl(a[0]) % dbl(a[1]) }));
    b('qsort', (a) => {
      const base = ptr(a[0]), n = sz(a[1]), size = sz(a[2]);
      const cmpPtr = a[3];
      const idx = Number((cmpPtr.v as bigint) - FUNC_BASE) / 8;
      const target = this.funcList[idx];
      const f = typeof target === 'string' ? this.funcs.get(target) : target;
      if (!f) throw new CError('Segmentation fault: qsort called with an invalid comparison function', this.line, 'segv');
      this.check(base, n * size, true);
      const items: Uint8Array[] = [];
      for (let i = 0; i < n; i++) items.push(this.u8.slice(base + i * size, base + (i + 1) * size));
      const tmp = this.allocData(size * 2, 8);
      items.sort((x, y) => {
        this.u8.set(x, tmp); this.u8.set(y, tmp + size);
        const r = this.callFunc(f, [{ ty: ptrTo({ k: 'void' }), v: BigInt(tmp) }, { ty: ptrTo({ k: 'void' }), v: BigInt(tmp + size) }]);
        return Number(BigInt.asIntN(32, r ? (r.v as bigint) : 0n));
      });
      items.forEach((it, i) => this.u8.set(it, base + i * size));
      return undefined;
    });
  }

  private writeStr(addr: number, s: string, room: number) {
    if (s.length + 1 > room + 0 && room < s.length + 1) { /* snprintf truncation already applied */ }
    this.check(addr, s.length + 1, true);
    for (let i = 0; i < s.length; i++) this.u8[addr + i] = s.charCodeAt(i) & 255;
    this.u8[addr + s.length] = 0;
  }
}

export type { StructDef };

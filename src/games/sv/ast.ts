export type Dim = { k: 'fixed'; lo?: E; hi: E } | { k: 'dyn' } | { k: 'queue' } | { k: 'assoc'; key: string };
export interface TypeSpec {
  name: string;
  /** packed range [msb:lsb] */
  range?: [E, E];
  signed?: boolean;
  params?: TypeSpec[];
  virtual?: boolean;
  /** package or class scope, e.g. uvm_pkg::uvm_object */
  scope?: string[];
  enumVals?: { n: string; v?: E }[];
  fields?: Decl[];
  packedStruct?: boolean;
  union?: boolean;
}
export interface Decl { type: TypeSpec; name: string; dims: Dim[]; init?: E; line: number; quals: string[] }

export type CI =
  | { k: 'expr'; e: E }
  | { k: 'if'; c: E; t: CI[]; f?: CI[] }
  | { k: 'imp'; c: E; body: CI[] }
  | { k: 'solve'; before: string[]; after: string[] }
  | { k: 'soft'; e: E }
  | { k: 'unique'; es: E[] }
  | { k: 'foreach'; arr: E; vars: string[]; body: CI[] };

export type E =
  | { k: 'num'; v: bigint; w?: number; fill?: string; signed?: boolean }
  | { k: 'real'; v: number }
  | { k: 'str'; v: string }
  | { k: 'null' } | { k: 'this' } | { k: 'super' }
  | { k: 'id'; n: string; line: number }
  | { k: 'member'; o: E; n: string; line: number }
  | { k: 'scope'; cls: string; n: string; line: number }
  | { k: 'index'; o: E; i: E; line: number }
  | { k: 'slice'; o: E; hi: E; lo: E; mode: ':' | '+:' | '-:'; line: number }
  | { k: 'call'; f: E; args: { name?: string; e?: E }[]; line: number; withC?: CI[]; withE?: E }
  | { k: 'sys'; n: string; args: E[]; line: number }
  | { k: 'new'; cls?: string; args: { name?: string; e?: E }[]; size?: E; line: number }
  | { k: 'un'; op: string; e: E }
  | { k: 'bin'; op: string; l: E; r: E; line: number }
  | { k: 'tern'; c: E; t: E; f: E }
  | { k: 'assign'; op: string; l: E; r: E; line: number }
  | { k: 'incdec'; op: '++' | '--'; pre: boolean; e: E }
  | { k: 'concat'; parts: E[] }
  | { k: 'repl'; n: E; parts: E[] }
  | { k: 'lit'; items: { key?: E; e: E }[] }
  | { k: 'inside'; e: E; set: ({ lo: E; hi: E } | E)[] }
  | { k: 'dist'; e: E; set: { lo: E; hi?: E; w: E; each: boolean }[] }
  | { k: 'cast'; type: TypeSpec | string; e: E }
  | { k: 'imp'; l: E; r: E };

export type EventSpec = { edge: 'pos' | 'neg' | 'any'; e: E }[];

export type S =
  | { k: 'block'; body: S[]; name?: string }
  | { k: 'decl'; decls: Decl[] }
  | { k: 'expr'; e: E; line: number }
  | { k: 'if'; c: E; t: S; f?: S }
  | { k: 'case'; kind: string; sel: E; items: { labels: E[]; body: S }[]; dflt?: S }
  | { k: 'for'; init: S[]; cond?: E; step: E[]; body: S }
  | { k: 'foreach'; arr: E; vars: string[]; body: S }
  | { k: 'while'; c: E; body: S }
  | { k: 'do'; c: E; body: S }
  | { k: 'repeat'; n: E; body: S }
  | { k: 'forever'; body: S }
  | { k: 'return'; e?: E }
  | { k: 'break' } | { k: 'continue' } | { k: 'nop' }
  | { k: 'delay'; d: E; body?: S }
  | { k: 'at'; ev: EventSpec | 'star'; body?: S }
  | { k: 'wait'; c: E; body?: S }
  | { k: 'fork'; join: 'join' | 'join_any' | 'join_none'; body: S[] }
  | { k: 'trigger'; e: E }
  | { k: 'assert'; c: E; pass?: S; fail?: S; line: number };

export interface Arg { name: string; type: TypeSpec; dir: 'input' | 'output' | 'inout' | 'ref'; dims: Dim[]; def?: E }
export interface Func { name: string; isTask: boolean; ret: TypeSpec; args: Arg[]; body: S[]; quals: string[]; line: number }

export interface Bin { name: string; each: boolean; count?: E; values: ({ lo: E; hi: E } | E)[]; dflt?: boolean; kind: 'bins' | 'ignore' | 'illegal'; trans?: E[][] }
export interface CoverPoint { name: string; e: E; iff?: E; bins: Bin[]; line: number }
export interface CoverCross { name: string; points: string[]; bins: { kind: 'bins' | 'ignore' | 'illegal'; name: string; sel: { cp: string; values: ({ lo: E; hi: E } | E)[] }[] }[] }
export interface CoverGroup { name: string; args: Arg[]; ev?: EventSpec; points: CoverPoint[]; crosses: CoverCross[]; options: Record<string, E>; line: number }

export interface ClassDecl {
  name: string; ext?: string; extType?: TypeSpec; extArgs?: { name?: string; e?: E }[]; virtual: boolean;
  fields: Decl[]; methods: Func[]; constraints: { name: string; items: CI[] }[]; groups: CoverGroup[]; params: string[]; line: number;
}

export interface Conn { port: string; e?: E }
export interface Instance { mod: string; name: string; params: { name?: string; e: E }[]; conns: Conn[]; wild: boolean; line: number }
export interface Always { kind: 'always' | 'comb' | 'ff' | 'latch'; ev?: EventSpec | 'star'; body: S; line: number }
export interface ModuleDecl {
  name: string; isInterface: boolean;
  ports: { name: string; dir: string; type: TypeSpec; dims: Dim[] }[];
  params: { name: string; e?: E }[];
  decls: Decl[]; assigns: { l: E; r: E; line: number }[]; always: Always[]; initial: S[];
  funcs: Func[]; instances: Instance[]; classes: ClassDecl[]; groups: CoverGroup[];
  clocking: { name: string; ev: EventSpec; sigs: string[] }[];
  line: number;
}
export interface Typedef { name: string; type: TypeSpec; dims: Dim[]; enumVals?: { n: string; v?: E }[] }
export interface Program {
  classes: ClassDecl[]; modules: ModuleDecl[]; funcs: Func[]; typedefs: Typedef[]; decls: Decl[]; groups: CoverGroup[];
}

import type { NumLit } from './lexer';

export type Expr =
  | { k: 'num'; lit: NumLit; line: number }
  | { k: 'id'; name: string; line: number }
  | { k: 'index'; name: string; index: Expr; line: number } // a[i] (bit select or memory word)
  | { k: 'memBit'; name: string; index: Expr; bit: Expr; line: number } // mem[i][b]
  | { k: 'range'; name: string; msb: Expr; lsb: Expr; line: number } // a[7:4]
  | { k: 'irange'; name: string; base: Expr; width: Expr; dir: '+' | '-'; line: number } // a[i +: 4]
  | { k: 'concat'; parts: Expr[]; line: number }
  | { k: 'repl'; count: Expr; parts: Expr[]; line: number }
  | { k: 'unary'; op: string; arg: Expr; line: number }
  | { k: 'binary'; op: string; l: Expr; r: Expr; line: number }
  | { k: 'ternary'; cond: Expr; t: Expr; f: Expr; line: number };

export type Stmt =
  | { k: 'block'; body: Stmt[]; line: number }
  | { k: 'if'; cond: Expr; then: Stmt; else?: Stmt; line: number }
  | { k: 'case'; kind: 'case' | 'casez' | 'casex'; sel: Expr; items: CaseItem[]; dflt?: Stmt; line: number }
  | { k: 'assign'; lhs: Expr; rhs: Expr; nonblocking: boolean; line: number }
  | { k: 'for'; init: Stmt; cond: Expr; step: Stmt; body: Stmt; line: number }
  | { k: 'nop'; line: number };

export interface CaseItem {
  labels: Expr[];
  body: Stmt;
}

export type NetKind = 'wire' | 'reg' | 'logic' | 'integer';

export interface Decl {
  name: string;
  kind: NetKind;
  msb?: Expr;
  lsb?: Expr;
  arrLo?: Expr;
  arrHi?: Expr;
  dir?: 'input' | 'output';
  line: number;
}

export type Sensitivity =
  | { k: 'comb'; list?: string[] } // list: explicit @(a or b); undefined means @* / always_comb
  | { k: 'edge'; edges: { edge: 'posedge' | 'negedge'; sig: string }[] };

export interface AlwaysBlock {
  sens: Sensitivity;
  flavor: 'always' | 'always_comb' | 'always_ff' | 'always_latch';
  body: Stmt;
  line: number;
}

export interface ModuleAst {
  name: string;
  params: { name: string; value: Expr; local: boolean; line: number }[];
  ports: string[]; // declared order
  decls: Decl[];
  assigns: { lhs: Expr; rhs: Expr; line: number; init?: boolean }[]; // init: `reg q = 0;` start value
  always: AlwaysBlock[];
  line: number;
}

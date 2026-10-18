// Runs a player's design and a golden reference side by side on the same stimulus
// and reports every output mismatch, like a self-checking testbench with a scoreboard.

import { mulberry32 } from '../lib/rng';
import { Design, Lint } from './simulator';
import { VerilogError } from './lexer';

export type Vector = Record<string, number | bigint | boolean>;

export interface Stimulus {
  clock?: string; // name of the clock input for sequential designs
  vectors: Vector[]; // one entry per clock cycle (or per sample for combinational designs)
  /** Outputs whose value doesn't matter this cycle (e.g. FIFO data while empty), given the golden outputs. */
  ignore?: (expected: Record<string, bigint>) => string[];
}

export interface TraceSignal {
  name: string;
  width: number;
  role: 'clock' | 'input' | 'output' | 'internal';
}

export interface Mismatch {
  step: number;
  signal: string;
  got: bigint;
  expected: bigint;
}

export interface RunResult {
  ok: boolean;
  error?: { line: number; message: string; phase: 'compile' | 'ports' | 'runtime' };
  lints: Lint[];
  /** Compile warnings that cost nothing (x/z literals in the 2-state simulator). */
  warnings: Lint[];
  signals: TraceSignal[];
  /** Values checked each step. For clocked designs: inputs applied, logic settled, just before the rising edge. */
  samples: Record<string, bigint>[];
  /** Clocked designs only: values just after the rising edge (for drawing accurate waveforms). */
  post: Record<string, bigint>[];
  expected: Record<string, bigint>[];
  expectedPost: Record<string, bigint>[];
  ignored: Set<string>[];
  mismatches: Mismatch[];
}

function errInfo(e: unknown): { line: number; message: string } {
  if (e instanceof VerilogError) return { line: e.line, message: e.message.replace(/^line \d+: /, '') };
  return { line: 0, message: e instanceof Error ? e.message : String(e) };
}

export function checkPorts(user: Design, golden: Design): string | null {
  for (const gp of golden.ports) {
    const up = user.ports.find((p) => p.name === gp.name);
    if (!up) return `missing ${gp.dir} port '${gp.name}' (${gp.width} bit${gp.width > 1 ? 's' : ''})`;
    if (up.dir !== gp.dir) return `port '${gp.name}' should be an ${gp.dir}`;
    if (up.width !== gp.width) return `port '${gp.name}' should be ${gp.width} bit${gp.width > 1 ? 's' : ''} wide, but yours is ${up.width}`;
  }
  for (const up of user.ports) {
    if (!golden.ports.find((p) => p.name === up.name)) return `unexpected port '${up.name}' - the spec doesn't have it`;
  }
  return null;
}

export function run(userSrc: string, goldenSrc: string, stim: Stimulus): RunResult {
  const res: RunResult = { ok: false, lints: [], warnings: [], signals: [], samples: [], post: [], expected: [], expectedPost: [], ignored: [], mismatches: [] };
  let user: Design;
  try {
    user = new Design(userSrc);
  } catch (e) {
    res.error = { ...errInfo(e), phase: 'compile' };
    return res;
  }
  res.lints = user.lints;
  res.warnings = user.warnings;
  const golden = new Design(goldenSrc);
  const portErr = checkPorts(user, golden);
  if (portErr) {
    res.error = { line: 0, message: portErr, phase: 'ports' };
    return res;
  }

  const clk = stim.clock;
  const inputs = golden.ports.filter((p) => p.dir === 'input');
  const outputs = golden.ports.filter((p) => p.dir === 'output');
  res.signals = [
    ...inputs.map((p) => ({ name: p.name, width: p.width, role: (p.name === clk ? 'clock' : 'input') as TraceSignal['role'] })),
    ...outputs.map((p) => ({ name: p.name, width: p.width, role: 'output' as const })),
    ...user.internals().map((s) => ({ name: s.name, width: s.width, role: 'internal' as const })),
  ];

  try {
    const snap = () => {
      const s: Record<string, bigint> = {};
      for (const sig of res.signals) s[sig.name] = user.get(sig.name);
      return s;
    };
    for (let step = 0; step < stim.vectors.length; step++) {
      const v = stim.vectors[step];
      // Drive inputs while the clock is low, then compare just before the rising edge,
      // exactly where a downstream flip-flop would capture the outputs.
      user.apply(clk ? { ...v, [clk]: 0 } : v);
      golden.apply(clk ? { ...v, [clk]: 0 } : v);
      const sample = snap();
      const exp: Record<string, bigint> = {};
      for (const o of outputs) exp[o.name] = golden.get(o.name);
      const ignored = new Set(stim.ignore?.(exp) ?? []);
      for (const o of outputs) {
        if (!ignored.has(o.name) && sample[o.name] !== exp[o.name]) {
          res.mismatches.push({ step, signal: o.name, got: sample[o.name], expected: exp[o.name] });
        }
      }
      res.samples.push(sample);
      res.expected.push(exp);
      res.ignored.push(ignored);
      if (clk) {
        user.apply({ [clk]: 1 });
        golden.apply({ [clk]: 1 });
        res.post.push(snap());
        res.expectedPost.push(Object.fromEntries(outputs.map((o) => [o.name, golden.get(o.name)])));
      }
    }
  } catch (e) {
    res.error = { ...errInfo(e), phase: 'runtime' };
    return res;
  }
  res.ok = res.mismatches.length === 0;
  return res;
}

/** Small deterministic PRNG so every run of a level uses the same "random" stimulus. */
export const rng = mulberry32;

export function randInt(r: () => number, maxExclusive: number): number {
  return Math.floor(r() * maxExclusive);
}

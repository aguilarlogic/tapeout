// World wire runs (Level 1 spec, puzzle rules): the player carries wire ends between terminals on the floor; the
// circuit is today's Logic Lab level (its starter switches and lamps) plus the gate fixed on the wall plus the
// player's wires, checked by today's verify. Pure: no DOM, no clock.
import { Builder, type Circuit, type Verdict, starsFor, verify } from '../../games/logic/circuit';
import { findLogicLevel, type LogicLevel, starter } from '../../games/logic/levels';
import type { WireRun } from './types';

export type Wire = [string, string];

export function levelOf(run: WireRun): LogicLevel {
  const l = findLogicLevel(run.level);
  if (!l) throw new Error(`no logic level ${run.level}`);
  return l;
}

/** The circuit the run's terminals and the player's wires make. Terminal pins: "in:<name>" is a switch's output,
 * "out:<name>" a lamp's input, "g.<pin>" the wall gate's pin. */
export function circuitFor(run: WireRun, wires: readonly Wire[]): Circuit {
  const b = new Builder(starter(levelOf(run)));
  const g = run.gate ? b.add(run.gate.kind, 340, 200) : '';
  const ref = (pin: string) => (pin.startsWith('in:') ? `${b.io(pin.slice(3))}.y` : pin.startsWith('out:') ? `${b.io(pin.slice(4))}.a` : `${g}.${pin.slice(2)}`);
  for (const [a, c] of wires) b.wire(ref(a), ref(c));
  return b.build();
}

export type Check =
  | { state: 'open' } // an output is not wired yet, or something it needs is still floating
  | { state: 'pass'; verdict: Verdict }
  | { state: 'fail'; verdict: Verdict; row: number }; // the first truth-table row that came out wrong

/** Judge the wiring the way the safety strip does: nothing is tested until every output is wired and settles to a 0
 * or a 1 in every row; then every row must match the level's table. A short (two drivers on one wire) is a fail. */
export function check(run: WireRun, wires: readonly Wire[]): Check {
  const level = levelOf(run);
  const outs = level.outputs.map((o) => `out:${o}`);
  if (!outs.every((o) => wires.some((w) => w.includes(o)))) return { state: 'open' };
  const v = verify(circuitFor(run, wires), level.inputs, level.outputs, level.spec);
  if (v.ok) return { state: 'pass', verdict: v };
  const shorted = v.errors.some((e) => e.startsWith('Short'));
  const unsettled = v.rows.some((r) => Object.values(r.got).some((x) => x === 'x' || x === 'z'));
  if (unsettled && !shorted) return { state: 'open' };
  return { state: 'fail', verdict: v, row: Math.max(0, v.rows.findIndex((r) => !r.ok)) };
}

/** Stars for a pass, as the Logic Lab gives them: par stars, less one per hint taken (never below 1). */
export function runStars(run: WireRun, v: Verdict, hints: number): number {
  return Math.max(1, starsFor(v, levelOf(run).par) - hints);
}

/** The level's reference wiring in terminal pins, for tests and the ghost-wire hint. */
export function solution(run: WireRun): Wire[] {
  const l = levelOf(run);
  const ins = l.inputs.map((n) => `in:${n}`), out = `out:${l.outputs[0]}`;
  if (!run.gate) return [[ins[0], out]];
  if (run.gate.kind === 'NOT') return [[ins[0], 'g.a'], ['g.y', out]];
  return [[ins[0], 'g.a'], [ins[1], 'g.b'], ['g.y', out]];
}

/** The next correct wire the player has not made yet (the third hint draws it as a ghost). */
export function nextWire(run: WireRun, wires: readonly Wire[]): Wire | undefined {
  const has = (w: Wire) => wires.some(([a, b]) => (a === w[0] && b === w[1]) || (a === w[1] && b === w[0]));
  return solution(run).find((w) => !has(w));
}

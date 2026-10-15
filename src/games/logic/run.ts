// "Test it": the game flips the switches through every row of the lab's table (or steps its clock sequence), one
// frame per row, and stops at the first row the circuit gets wrong. Problems are told in plain words and point at the
// part to look at. Nothing here is shown before the player asks for a run, so a lab never opens in an error state.
import { Bits, Circuit, combos, PINS, Row, Sim, Spec, V, verify } from './circuit';
import { KIND_NAME } from './parts';

export interface Problem { text: string; part?: string }
export interface Frame { inputs: Bits; pins: Record<string, V>; row: Row; ok: boolean; problem?: Problem }
export interface RunResult { frames: Frame[]; stopAt: number; ok: boolean; problem?: Problem }

interface LabSpec { inputs: string[]; outputs: string[]; spec: Spec }

const said = (v: V) => (v === 1 ? 'lit up' : v === 0 ? 'stayed off' : v === 'x' ? 'flickered, because it got a 1 and a 0 at once' : 'stayed dark, because nothing reaches it');
const should = (v: V) => (v === 1 ? 'light up' : 'stay off');
const words = (ins: Bits) => Object.entries(ins).map(([k, v]) => `${k} ${v ? 'on' : 'off'}`).join(', ');
const pinWord = (pin: string, n: number) => {
  if (pin === 'y' || pin === 'q') return 'output';
  if (pin === 'g') return 'gate';
  if (n === 1 || pin === 'd') return 'input';
  return pin === 'a' ? 'top input' : 'bottom input';
};

/** What is wrong in this frame, in plain words, pointing at the part to look at. */
function diagnose(c: Circuit, sim: Sim, lab: LabSpec, row: Row, when: string): Problem | undefined {
  const lamp = (o: string) => c.parts.find((p) => p.kind === 'OUT' && p.label === o);
  // A lamp with no wire at all.
  for (const o of lab.outputs) {
    const p = lamp(o);
    if (p && row.got[o] === 'z' && !sim.connected(`${p.id}.a`)) return { text: `Lamp ${o} isn't connected to anything yet.`, part: p.id };
  }
  // A gate wired up but with a pin left loose. (A gate with no wires at all is a spare part, not the problem.)
  for (const p of c.parts) {
    if (p.fixed || p.kind === 'VDD' || p.kind === 'GND') continue;
    const loose = PINS[p.kind].filter((d) => !sim.connected(`${p.id}.${d.name}`));
    if (loose.length && loose.length < PINS[p.kind].length) {
      const ins_ = PINS[p.kind].filter((d) => d.dir !== 'out').length;
      const name = KIND_NAME[p.kind];
      return { text: `This ${name}${p.kind === 'DFF' || p.kind === 'NMOS' || p.kind === 'PMOS' ? '' : ' gate'}'s ${pinWord(loose[0].name, ins_)} isn't connected to anything yet.`, part: p.id };
    }
  }
  if (sim.shorts.size) {
    const p = c.parts.find((q) => PINS[q.kind].some((d) => sim.shorts.has(sim.net(`${q.id}.${d.name}`))));
    return { text: `${when}, two outputs fight over one wire: one says 1 and the other says 0. A wire may only have one output on it.`, part: p?.id };
  }
  if (sim.oscillating) return { text: `${when}, the loop never settles: the signal keeps flipping between 0 and 1.` };
  for (const o of lab.outputs) {
    if (row.got[o] === 'z') { const p = lamp(o); return { text: `Lamp ${o}'s wire doesn't reach a switch or a gate's output yet.`, part: p?.id }; }
  }
  const bad = lab.outputs.find((o) => row.got[o] !== row.expected[o]);
  if (bad) return { text: `${when}, lamp ${bad} ${said(row.got[bad])}. It should ${should(row.expected[bad])}.`, part: lamp(bad)?.id };
  return undefined;
}

const snapshot = (c: Circuit, sim: Sim) => {
  const pins: Record<string, V> = {};
  for (const p of c.parts) for (const d of PINS[p.kind]) pins[`${p.id}.${d.name}`] = sim.pin(`${p.id}.${d.name}`);
  return pins;
};

/** Every frame of a test run, the first failing one, and whether the circuit passes (the same verdict as verify). */
export function testRun(c: Circuit, lab: LabSpec): RunResult {
  const frames: Frame[] = [];
  const check = (sim: Sim, ins: Bits, expected: Bits, when: string, extra: Partial<Row> = {}) => {
    const got: Record<string, V> = {};
    for (const o of lab.outputs) got[o] = sim.output(o);
    const row: Row = { inputs: { ...ins }, expected, got, ok: lab.outputs.every((o) => got[o] === expected[o]), ...extra };
    const ok = row.ok && !sim.shorts.size && !sim.oscillating;
    frames.push({ inputs: { ...ins }, pins: snapshot(c, sim), row, ok, problem: ok ? undefined : diagnose(c, sim, lab, row, when) });
  };
  if (lab.spec.kind === 'table') {
    for (const ins of combos(lab.inputs)) {
      const sim = new Sim(c);
      sim.settle(ins);
      check(sim, ins, lab.spec.fn(ins), lab.inputs.length ? `With ${words(ins)}` : 'At the start');
    }
  } else {
    const sim = new Sim(c);
    const ins: Bits = Object.fromEntries(lab.inputs.map((n) => [n, 0]));
    lab.spec.steps.forEach((st, i) => {
      Object.assign(ins, st.set ?? {});
      sim.settle(ins);
      if (st.tick) { sim.tick(); sim.settle(ins); }
      check(sim, ins, st.expect, `At step ${i + 1}${st.tick ? ', after the clock ticks' : ''}`, { note: st.note, tick: st.tick });
    });
  }
  const stopAt = frames.findIndex((f) => !f.ok);
  const v = verify(c, lab.inputs, lab.outputs, lab.spec);
  return { frames, stopAt, ok: stopAt < 0 && v.ok, problem: stopAt >= 0 ? frames[stopAt].problem : undefined };
}

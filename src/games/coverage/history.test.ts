import { describe, expect, it } from 'vitest';
import { defaultPhase, SCENARIOS } from './scenarios';
import { builderHistory, copyOf, snapOf } from './history';

const sc = SCENARIOS[0];
const knob = sc.knobs[0];
const opt = knob.options[0].id;

describe('coverage builder undo (U54)', () => {
  it('removing a phase can be taken back, with its weights', () => {
    const hist = builderHistory();
    const phases = [defaultPhase(sc, 40), defaultPhase(sc, 60)];
    hist.record(snapOf(phases, 7), 'remove-1', 0); // Remove on phase 2
    phases.splice(1, 1);
    const back = copyOf(hist.undo()!);
    expect(back.phases.map((p) => p.count)).toEqual([40, 60]);
    expect(back.seed).toBe(7);
  });

  it('a slider drag is one undo step back to the weights it started from', () => {
    const hist = builderHistory();
    const phases = [defaultPhase(sc, 50)];
    const start = phases[0].weights[knob.id][opt];
    for (let v = 0; v < 10; v++) {
      hist.record(snapOf(phases, 1), `w-0-${knob.id}-${opt}`, v * 30);
      phases[0].weights[knob.id][opt] = v;
    }
    expect(hist.size).toBe(1);
    expect(copyOf(hist.undo()!).phases[0].weights[knob.id][opt]).toBe(start);
  });

  it('a restored copy is independent of the saved step', () => {
    const hist = builderHistory();
    const phases = [defaultPhase(sc, 50)];
    hist.record(snapOf(phases, 1), 'count-0', 0);
    const back = copyOf(hist.undo()!);
    back.phases[0].count = 999;
    expect(hist.size).toBe(0);
    expect(copyOf(snapOf(phases, 1)).phases[0].count).toBe(50);
  });
});

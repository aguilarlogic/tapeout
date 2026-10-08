import { describe, expect, it } from 'vitest';
import { rng } from '../../sim/harness';
import { CInterp } from './c';
import { C_LEVELS } from './levels-c';
import { runCode } from './run';

describe('C interpreter interrupts', () => {
  it('runs the handler between statements, and holds it while masked', () => {
    const src = `volatile int n;
void h(void) { n++; }
int main(void) {
  int a = 0; a = 1; a = 2; a = 3; a = 4;
  printf("%d\\n", n);
  irq_disable();
  a = 1; a = 2; a = 3; a = 4;
  printf("%d\\n", n);
  irq_enable();
  a = 5;
  printf("%d\\n", n);
  return 0;
}`;
    const r = CInterp.run(src, { isr: { fn: 'h', every: 2 } });
    const [x, y, z] = r.stdout.trim().split('\n').map(Number);
    expect(x).toBeGreaterThan(0);
    expect(y - x).toBeLessThanOrEqual(1); // masked: at most one request is latched
    expect(z).toBeGreaterThan(y);
    expect(CInterp.run(src, {}).stdout.trim()).toBe('0\n0\n0');
  });
});

describe('code-c-isr', () => {
  const level = C_LEVELS.find((l) => l.id === 'code-c-isr')!;
  const inst = level.build(rng(1));
  const run = (body: string) => runCode('c', inst, body);
  it('the torn read is caught', () => {
    const r = run(inst.starter);
    expect(r.results.filter((c) => !c.ok).length).toBeGreaterThan(0);
  });
  it('masking only one read does not pass', () => {
    const weak = inst.solution.replace('irq_disable();\n    unsigned s = sec;\n    unsigned m = ms;', 'irq_disable();\n    unsigned s = sec;\n    irq_enable();\n    unsigned m = ms;').replace('    irq_enable();\n    return', '    return');
    expect(run(weak).passed).toBe(false);
  });
  it('dropping volatile fails the rule', () => {
    const r = run(inst.solution.replace('volatile ', ''));
    expect(r.rules.some((x) => !x.ok)).toBe(true);
  });
});

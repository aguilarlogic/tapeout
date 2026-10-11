import { describe, expect, it } from 'vitest';
import { fmtValue, lab, parseNetlist, parseValue, SpiceError, sourceAt } from './spice';

const near = (a: number, b: number, rel = 0.01) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(Math.abs(b) * rel + 1e-12);

describe('values', () => {
  it('parses engineering notation', () => {
    expect(parseValue('4.7k')).toBe(4700);
    expect(parseValue('1meg')).toBe(1e6);
    expect(parseValue('100n')).toBeCloseTo(1e-7, 15);
    expect(parseValue('10uF')).toBeCloseTo(1e-5, 15);
    expect(parseValue('2.2M')).toBeCloseTo(2.2e-3, 15); // SPICE: M is milli
    expect(parseValue('1e-9')).toBe(1e-9);
    expect(parseValue('abc')).toBeNull();
  });
  it('formats back', () => {
    expect(fmtValue(4700)).toBe('4.7k');
    expect(fmtValue(1e-7)).toBe('100n');
    expect(fmtValue(0.0033)).toBe('3.3m');
  });
  it('evaluates waveforms', () => {
    const p = { dc: 0, ac: 0, phase: 0, wave: { kind: 'pulse' as const, v1: 0, v2: 5, td: 1, tr: 1, tf: 1, pw: 2, per: 10 } };
    expect(sourceAt(p, 0.5)).toBe(0);
    expect(sourceAt(p, 1.5)).toBeCloseTo(2.5);
    expect(sourceAt(p, 3)).toBe(5);
    expect(sourceAt(p, 4.5)).toBeCloseTo(2.5);
    expect(sourceAt(p, 8)).toBe(0);
    expect(sourceAt(p, 12)).toBe(5);
  });
});

describe('netlist errors speak plainly', () => {
  it('reports the line', () => {
    expect(() => parseNetlist('V1 in 0 5\nR1 in out\n')).toThrow(/line 2.*resistor/);
    expect(() => parseNetlist('V1 in 0 5\nZ1 in 0 1k\n')).toThrow(/line 2.*unknown element/);
    expect(() => parseNetlist('V1 in 0 5\nR1 in 0 0\n')).toThrow(/greater than zero/);
    expect(() => parseNetlist('R1 a b 1k\n')).toThrow(/ground/);
    expect(() => parseNetlist('V1 a 0 1\nV1 b 0 1\n')).toThrow(/two elements are named/);
    expect(() => parseNetlist('V1 a 0 1\nD1 a 0 nosuch\n')).toThrow(/unknown model/);
  });
  it('detects a singular circuit', () => {
    const l = lab('V1 a 0 5\nV2 a 0 3\n');
    expect(() => l.op()).toThrow(SpiceError);
    expect(() => l.op()).toThrow(/no unique solution/);
  });
});

describe('DC operating point', () => {
  it('solves a divider', () => {
    const op = lab('V1 in 0 10\nR1 in out 1k\nR2 out 0 3k\n').op();
    near(op.v.out, 7.5);
    near(op.i.r1, 2.5e-3);
    near(op.p.r2, 7.5 * 2.5e-3);
  });
  it('supports continuation lines, comments and node name "gnd"', () => {
    const op = lab('* a divider\nV1 in gnd\n+ 10\nR1 in out 1k ; top\nR2 out gnd 1k\n').op();
    near(op.v.out, 5);
  });
  it('treats inductors as shorts and capacitors as open', () => {
    const op = lab('V1 in 0 5\nL1 in a 1m\nR1 a b 1k\nC1 b 0 1u\nR2 b 0 4k\n').op();
    near(op.v.b, 4);
    near(op.i.l1, 1e-3);
  });
  it('current sources', () => {
    const op = lab('I1 0 a 2m\nR1 a 0 1k\n').op();
    near(op.v.a, 2);
  });
  it('controlled sources', () => {
    const op = lab('V1 a 0 1\nR1 a 0 1k\nE1 b 0 a 0 10\nR2 b 0 1k\nG1 0 c a 0 2m\nR3 c 0 1k\n').op();
    near(op.v.b, 10);
    near(op.v.c, 2);
  });
  it('a diode settles near 0.6-0.8 V and obeys the Shockley law', () => {
    const op = lab('V1 in 0 5\nR1 in a 1k\nD1 a 0\n').op();
    expect(op.v.a).toBeGreaterThan(0.55);
    expect(op.v.a).toBeLessThan(0.8);
    near(op.i.r1, (5 - op.v.a) / 1000);
    near(op.i.d1, op.i.r1, 1e-4);
    // I = Is (e^(V/Vt) - 1)
    near(op.i.d1, 1e-14 * (Math.exp(op.v.a / 0.025852) - 1), 0.001);
  });
  it('a reverse-biased diode blocks', () => {
    const op = lab('V1 in 0 -5\nR1 in a 1k\nD1 a 0\n').op();
    expect(Math.abs(op.i.r1)).toBeLessThan(1e-9);
  });
  it('an LED model drops about 2 V', () => {
    const op = lab('.model led D(is=1e-18 n=2)\nV1 in 0 5\nR1 in a 300\nD1 a 0 led\n').op();
    expect(op.v.a).toBeGreaterThan(1.7);
    expect(op.v.a).toBeLessThan(2.3);
  });
  it('NMOS in saturation follows the square law', () => {
    // vgs = 1.0, vt = 0.5, beta = kp*W/L = 200u * 10 = 2m; id = 0.5 * 2m * 0.25 = 250 uA (lambda 0)
    const op = lab('.model n1 NMOS(vto=0.5 kp=200u lambda=0)\nVdd d 0 3\nVg g 0 1\nM1 d g 0 0 n1 W=10u L=1u\n').op();
    near(op.i.vdd, -250e-6, 0.001);
  });
  it('NMOS in triode', () => {
    // vgs=2, vt=0.5, vds=0.2 -> id = beta*((1.5)(0.2) - 0.02) = 2m*0.28 = 560 uA
    const op = lab('.model n1 NMOS(vto=0.5 kp=200u lambda=0)\nVd d 0 0.2\nVg g 0 2\nM1 d g 0 0 n1 W=10u L=1u\n').op();
    near(op.i.vd, -560e-6, 0.001);
  });
  it('PMOS conducts with a negative vgs', () => {
    const op = lab('.model p1 PMOS(vto=0.5 kp=100u lambda=0)\nVdd s 0 3\nVg g 0 2\nM1 d g s s p1 W=20u L=1u\nR1 d 0 1k\n').op();
    // vsg = 1, vov = .5, beta = 2m, id = 0.5*2m*.25 = 250uA if saturated: vd = 0.25 V, vsd = 2.75 > vov
    near(op.v.d, 0.25, 0.01);
  });
  it('BJT bias: collector current is beta times base current', () => {
    const op = lab('Vcc vcc 0 10\nVb b 0 0.65\nRc vcc c 1k\nQ1 c b 0 npn\n').op();
    const ic = op.i.rc, ib = -op.i.vb;
    expect(ic).toBeGreaterThan(0);
    near(ic / ib, 100, 0.12);
  });
  it('BJT in saturation does not blow up', () => {
    const op = lab('Vcc vcc 0 5\nVb b 0 0.9\nRc vcc c 1k\nQ1 c b 0 npn\n').op();
    expect(op.v.c).toBeLessThan(0.5);
  });
  it('an inverting op-amp amplifies by -Rf/Rin', () => {
    const op = lab('V1 in 0 0.1\nR1 in n 1k\nRf n out 10k\nU1 out 0 n\n').op();
    near(op.v.out, -1, 0.001);
  });
  it('a clipped op-amp stays inside its rails', () => {
    const op = lab('V1 in 0 1\nR1 in n 1k\nRf n out 10k\nU1 out 0 n vmax=5\n').op();
    expect(op.v.out).toBeGreaterThan(-5.01);
    expect(op.v.out).toBeLessThan(-4.5);
  });
  it('a switch conducts above its threshold', () => {
    const on = lab('V1 in 0 5\nVc c 0 5\nS1 in out c 0 vt=2.5\nR1 out 0 1k\n').op();
    const off = lab('V1 in 0 5\nVc c 0 0\nS1 in out c 0 vt=2.5\nR1 out 0 1k\n').op();
    near(on.v.out, 5, 0.01);
    expect(off.v.out).toBeLessThan(0.01);
  });
});

describe('DC sweep', () => {
  it('sweeps a source and follows a diode curve', () => {
    const r = lab('V1 in 0 0\nR1 in a 100\nD1 a 0\n').dc({ type: 'dc', src: 'v1', start: 0, stop: 5, step: 0.5 });
    expect(r.x.length).toBe(11);
    expect(r.v.a[0]).toBeCloseTo(0, 6);
    expect(r.v.a[10]).toBeGreaterThan(0.7);
    expect(r.v.a[10]).toBeLessThan(0.95);
  });
  it('an unknown source is an error', () => {
    expect(() => lab('V1 a 0 1\nR1 a 0 1k\n').dc({ type: 'dc', src: 'v9', start: 0, stop: 1, step: 0.1 })).toThrow(/no source named/);
  });
});

describe('AC analysis', () => {
  const mag = (re: number, im: number) => Math.hypot(re, im);
  it('an RC low-pass is -3 dB at 1/(2 pi R C)', () => {
    const fc = 1 / (2 * Math.PI * 1e3 * 159.155e-9); // ~1 kHz
    const r = lab('V1 in 0 AC 1\nR1 in out 1k\nC1 out 0 159.155n\n').ac({ sweep: 'lin', points: 2, fstart: fc, fstop: fc * 1.0001 });
    const [re, im] = r.v.out[0];
    near(mag(re, im), Math.SQRT1_2, 0.001);
    near((Math.atan2(im, re) * 180) / Math.PI, -45, 0.01);
  });
  it('a decade sweep has the right points', () => {
    const r = lab('V1 in 0 AC 1\nR1 in out 1k\nC1 out 0 1u\n').ac({ sweep: 'dec', points: 10, fstart: 10, fstop: 1e5 });
    expect(r.f.length).toBe(41);
    near(r.f[0], 10);
    near(r.f[40], 1e5);
  });
  it('a series RLC peaks at resonance with Q = (1/R) sqrt(L/C)', () => {
    // L=1m, C=1u -> f0 = 5.03 kHz; R = 10 -> Q = 3.16
    const f0 = 1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-6));
    const r = lab('V1 in 0 AC 1\nR1 in a 10\nL1 a out 1m\nC1 out 0 1u\n').ac({ sweep: 'lin', points: 2, fstart: f0, fstop: f0 * 1.00001 });
    const [re, im] = r.v.out[0];
    near(mag(re, im), Math.sqrt(1e-3 / 1e-6) / 10, 0.01);
  });
  it('an op-amp with a gain-bandwidth product rolls off', () => {
    // inverting gain -10, GBW 1 MHz -> closed-loop bandwidth about 1MHz/11 = 91 kHz
    const net = 'V1 in 0 AC 1\nR1 in n 1k\nRf n out 10k\nU1 out 0 n a0=1e5 gbw=1meg\n';
    const r = lab(net).ac({ sweep: 'dec', points: 200, fstart: 100, fstop: 1e7 });
    const g = r.v.out.map(([a, b]) => Math.hypot(a, b));
    near(g[0], 10, 0.01);
    const i3 = g.findIndex((x) => x < 10 / Math.SQRT2);
    near(r.f[i3], 91e3, 0.03);
  });
  it('small-signal gain of a common-source amplifier matches -gm Rd', () => {
    const net = '.model n1 NMOS(vto=0.5 kp=200u lambda=0)\nVdd vdd 0 3\nVg g 0 DC 0.9 AC 1\nRd vdd d 5k\nM1 d g 0 0 n1 W=10u L=1u\n';
    const l = lab(net);
    // gm = beta*vov = 2m * 0.4 = 0.8 mS  -> gain = -4
    const r = l.ac({ sweep: 'lin', points: 2, fstart: 1000, fstop: 2000 });
    near(r.v.d[0][0], -4, 0.02);
  });
});

describe('transient analysis', () => {
  it('an RC step reaches 63.2% after one time constant', () => {
    const t = lab('V1 in 0 PULSE(0 5 0 1n 1n 1 2)\nR1 in out 1k\nC1 out 0 1u\n').tran({ step: 1e-5, stop: 5e-3 });
    const k = t.t.findIndex((x) => x >= 1e-3);
    near(t.v.out[k], 5 * (1 - Math.exp(-1)), 0.01);
    near(t.v.out[t.t.length - 1], 5, 0.02);
  });
  it('an RLC step overshoots like the second-order formula', () => {
    // L=1m C=1u R=10 -> zeta = R/2 sqrt(C/L) = 0.158 -> overshoot exp(-pi z / sqrt(1-z^2)) = 0.6
    const t = lab('V1 in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in a 10\nL1 a out 1m\nC1 out 0 1u\n').tran({ step: 1e-7, stop: 2e-3 });
    const peak = Math.max(...t.v.out);
    const z = (10 / 2) * Math.sqrt(1e-6 / 1e-3);
    near(peak - 1, Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)), 0.03);
  });
  it('a sine through a resistor divider keeps its amplitude ratio', () => {
    const t = lab('V1 in 0 SIN(0 2 1k)\nR1 in out 1k\nR2 out 0 1k\n').tran({ step: 1e-5, stop: 2e-3 });
    near(Math.max(...t.v.out), 1, 0.01);
  });
  it('a half-wave rectifier clips the negative half', () => {
    const t = lab('V1 in 0 SIN(0 5 1k)\nD1 in out\nR1 out 0 1k\n').tran({ step: 1e-5, stop: 2e-3 });
    expect(Math.min(...t.v.out)).toBeGreaterThan(-0.01);
    expect(Math.max(...t.v.out)).toBeGreaterThan(4.2);
  });
  it('an inductor current ramps at V/L', () => {
    const t = lab('V1 in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in a 1m\nL1 a 0 1m\n').tran({ step: 1e-6, stop: 1e-3 });
    const k = t.t.findIndex((x) => x >= 5e-4);
    near(t.i.l1[k], (1 / 1e-3) * 5e-4, 0.01);
  });
  it('refuses runs that would take too many steps', () => {
    expect(() => lab('V1 in 0 5\nR1 in 0 1k\n').tran({ step: 1e-9, stop: 1 })).toThrow(/too many steps/);
  });
});

describe('buck converter', () => {
  it('steps 12 V down by the duty cycle', () => {
    const net = [
      'Vin in 0 12',
      'Vg g 0 PULSE(0 5 0 10n 10n 4u 10u)',
      'S1 in sw g 0 vt=2.5 ron=0.02',
      'D1 0 sw',
      'L1 sw out 47u',
      'C1 out 0 100u',
      'R1 out 0 5',
    ].join('\n');
    const t = lab(net).tran({ step: 2e-7, stop: 1.5e-3 });
    const n = t.t.length, tail = t.v.out.slice(Math.floor(n * 0.8));
    const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
    near(avg, 12 * 0.4, 0.1);
  });
});

describe('realistic parts', () => {
  it('a capacitor with ESL and ESR resonates where expected', () => {
    // 1u with 1 nH -> f = 1/(2 pi sqrt(1n * 1u)) = 5.03 MHz: impedance dips to the ESR there
    const f0 = 1 / (2 * Math.PI * Math.sqrt(1e-9 * 1e-6));
    const r = lab('I1 0 a AC 1\nC1 a 0 1u esr=20m esl=1n\n').ac({ sweep: 'lin', points: 2, fstart: f0, fstop: f0 * 1.00001 });
    near(Math.hypot(...r.v.a[0]), 0.02, 0.02);
  });
  it('internal helper nodes are not reported as dangling', () => {
    const c = parseNetlist('V1 a 0 1\nC1 a 0 1u esr=20m esl=1n\n');
    expect(c.warnings).toEqual([]);
  });
  it('longer channels have less channel-length modulation', () => {
    const run = (l: string) => lab(`.model n1 NMOS(vto=0.5 kp=200u lambda=0.05)\nVdd d 0 3\nVg g 0 1\nM1 d g 0 0 n1 W=10u L=${l}\n`).op().i.vdd * -1;
    // the longer device has a smaller current (beta is lower) but a flatter I-V curve
    const flat = (l: string) => {
      const r = lab(`.model n1 NMOS(vto=0.5 kp=200u lambda=0.05)\nVdd d 0 1\nVg g 0 1\nM1 d g 0 0 n1 W=${l === '1u' ? '10u' : '40u'} L=${l}\n`).dc({ type: 'dc', src: 'vdd', start: 1, stop: 3, step: 2 });
      return r.i.vdd[1] / r.i.vdd[0]; // same sign either way, so the ratio is the current growth with Vds
    };
    expect(run('4u')).toBeGreaterThan(0);
    expect(run('4u')).toBeLessThan(run('1u') / 4 * 1.1); // beta falls with 1/L
    expect(flat('4u')).toBeLessThan(flat('1u'));
  });
});

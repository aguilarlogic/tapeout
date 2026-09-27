import { describe, expect, it } from 'vitest';
import { analyze, BoardState, emptyBoard, Layer, moveComp, PcbLevel, placeVia, route } from './board';
import { PCB_LEVELS } from './levels';

const lvl = (id: string) => PCB_LEVELS.find((l) => l.id === id)!;

function hline(y: number, x0: number, x1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
  return out;
}
function vline(x: number, y0: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) out.push([x, y]);
  return out;
}

function draw(level: PcbLevel, st: BoardState, layer: Layer, net: string, cells: [number, number][]) {
  for (const [x, y] of cells) {
    const r = route(level, st, layer, x, y, net);
    if (!r.ok) throw new Error(`(${x},${y}) ${r.reason}`);
  }
}
function via(level: PcbLevel, st: BoardState, x: number, y: number, net: string) {
  const r = placeVia(level, st, x, y, net);
  if (!r.ok) throw new Error(`via (${x},${y}) ${r.reason}`);
}

const solutions: Record<string, (l: PcbLevel, st: BoardState) => void> = {
  'pcb-first-light': (l, st) => {
    draw(l, st, 0, 'VIN', hline(3, 2, 5));
    draw(l, st, 0, 'LED_A', hline(3, 10, 12));
    draw(l, st, 0, 'GND', hline(6, 2, 12));
  },
  'pcb-crossing': (l, st) => {
    draw(l, st, 0, 'SDA', [...hline(2, 1, 6), ...vline(6, 3, 6), ...hline(6, 7, 12)]);
    draw(l, st, 0, 'SCL', hline(6, 1, 2));
    via(l, st, 3, 6, 'SCL');
    draw(l, st, 1, 'SCL', [...vline(3, 3, 5), ...hline(3, 4, 9)]);
    via(l, st, 10, 3, 'SCL');
    draw(l, st, 0, 'SCL', [...hline(3, 11, 12), [12, 2]]);
  },
  'pcb-decouple': (l, st) => {
    const r = moveComp(l, st, 'C1', 4, -6);
    if (!r.ok) throw new Error(r.reason);
    draw(l, st, 0, 'VDD', hline(3, 1, 7));
    via(l, st, 9, 2, 'GND');
    via(l, st, 7, 6, 'GND');
  },
  'pcb-return-path': (l, st) => {
    draw(l, st, 0, 'CLK', hline(5, 2, 12));
    draw(l, st, 0, 'DATA', [...hline(8, 6, 14), ...vline(14, 3, 7)]);
    via(l, st, 12, 6, 'GND');
  },
  'pcb-diff-pair': (l, st) => {
    draw(l, st, 0, 'USB_DP', [...hline(3, 1, 11), ...vline(11, 4, 8)]);
    draw(l, st, 0, 'USB_DN', [[1, 4], [2, 4], [2, 5], [3, 5], [3, 4], ...hline(4, 4, 10), ...vline(10, 5, 8)]);
  },
};

describe('every PCB level is solvable with 3 stars', () => {
  for (const level of PCB_LEVELS) {
    it(level.id, () => {
      const st = emptyBoard();
      expect(analyze(level, st).passed).toBe(false);
      solutions[level.id](level, st);
      const a = analyze(level, st);
      expect(a.issues).toEqual([]);
      expect(a.passed).toBe(true);
      expect(a.stars).toBe(3);
    });
  }
});

describe('DRC catches layout mistakes', () => {
  it('refuses to short two nets', () => {
    const l = lvl('pcb-first-light');
    const st = emptyBoard();
    draw(l, st, 0, 'GND', hline(6, 2, 12));
    expect(route(l, st, 0, 5, 6, 'VIN').ok).toBe(false);
  });

  it('flags a fast net crossing a plane slot', () => {
    const l = lvl('pcb-return-path');
    const st = emptyBoard();
    draw(l, st, 0, 'CLK', hline(5, 2, 12));
    draw(l, st, 0, 'DATA', vline(6, 6, 8));
    via(l, st, 6, 6, 'DATA');
    draw(l, st, 1, 'DATA', [...vline(6, 3, 5)]);
    via(l, st, 6, 2, 'DATA');
    draw(l, st, 0, 'DATA', [...hline(2, 7, 13)]);
    draw(l, st, 0, 'DATA', [[13, 2]]);
    via(l, st, 12, 6, 'GND');
    const a = analyze(l, st);
    expect(a.routed.DATA).toBe(true);
    expect(a.passed).toBe(false);
    expect(a.issues.some((i) => /CLK crosses a slot/.test(i.message))).toBe(true);
  });

  it('flags diff-pair skew and a far decoupling cap', () => {
    const dp = lvl('pcb-diff-pair');
    const st = emptyBoard();
    draw(dp, st, 0, 'USB_DP', [...hline(3, 1, 11), ...vline(11, 4, 8)]);
    draw(dp, st, 0, 'USB_DN', [...hline(4, 1, 10), ...vline(10, 5, 8)]);
    expect(analyze(dp, st).issues.some((i) => /length mismatch is 2/.test(i.message))).toBe(true);

    const dc = lvl('pcb-decouple');
    const s2 = emptyBoard();
    draw(dc, s2, 0, 'VDD', [...hline(3, 1, 7), ...vline(3, 4, 7)]);
    via(dc, s2, 5, 8, 'GND');
    via(dc, s2, 7, 6, 'GND');
    const a = analyze(dc, s2);
    expect(a.routed.VDD).toBe(true);
    expect(a.issues.some((i) => /C1.1 is \d+ steps of copper from U1.VDD/.test(i.message))).toBe(true);
  });

  it('flags SMD ground pads with no via', () => {
    const l = lvl('pcb-return-path');
    const st = emptyBoard();
    const a = analyze(l, st);
    expect(a.issues.some((i) => /U1.GND not connected to the ground plane/.test(i.message))).toBe(true);
  });
});

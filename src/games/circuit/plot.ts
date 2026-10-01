// A small line-plot widget for the Circuit Lab: linear or log x axis, several traces, a hover read-out.
import { h, svg } from '../../ui/dom';
import { fmtValue } from './spice';

export interface Trace { name: string; x: number[]; y: number[] }

export interface PlotOptions {
  title: string;
  xlabel: string;
  ylabel: string;
  traces: Trace[];
  xlog?: boolean;
  height?: number;
  /** Traces that start hidden; click a name in the legend to show them. */
  hidden?: string[];
}

const COLORS = ['#4ade80', '#38bdf8', '#fbbf24', '#f0abfc', '#fb7185', '#a78bfa', '#2dd4bf', '#f97316'];
const W = 640, PAD = { l: 58, r: 14, t: 12, b: 36 };

/** Round-number ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 6): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

/** Keep the first, lowest, highest and last point of each pixel column, so ripple survives drawing 60,000 points in 560 pixels. */
function decimate(x: number[], y: number[], px: (v: number) => number): [number, number][] {
  if (x.length < 1400) return x.map((v, i) => [v, y[i]] as [number, number]);
  const pts: [number, number][] = [];
  let col = NaN, first = 0, lo = 0, hi = 0, last = 0;
  const emit = () => [...new Set([first, lo, hi, last])].sort((a, b) => a - b).forEach((k) => pts.push([x[k], y[k]]));
  for (let i = 0; i < x.length; i++) {
    const c = Math.round(px(x[i]));
    if (c !== col) { if (i > 0) emit(); col = c; first = lo = hi = last = i; }
    else { last = i; if (y[i] < y[lo]) lo = i; if (y[i] > y[hi]) hi = i; }
  }
  emit();
  return pts;
}

export function plot(o: PlotOptions): HTMLElement {
  const H = o.height ?? 230;
  const hidden = new Set<string>(o.hidden ?? []);
  const host = h('div', { class: 'cplot' });
  const readout = h('div', { class: 'cplot-read dim' }, 'Hover over the plot to read values.');

  const draw = () => {
    const shown = o.traces.filter((t) => !hidden.has(t.name) && t.x.length);
    const all = shown.length ? shown : o.traces;
    const xs = all.flatMap((t) => t.x), ys = all.flatMap((t) => t.y).filter(Number.isFinite);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (!(y1 > y0)) { y0 -= 1; y1 += 1; }
    const padY = (y1 - y0) * 0.06;
    y0 -= padY; y1 += padY;
    const lx = (v: number) => (o.xlog ? Math.log10(Math.max(v, 1e-30)) : v);
    const ax0 = lx(x0), ax1 = lx(x1) === ax0 ? ax0 + 1 : lx(x1);
    const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const sx = (v: number) => PAD.l + ((lx(v) - ax0) / (ax1 - ax0)) * pw;
    const sy = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * ph;

    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cplot-svg', role: 'img', 'aria-label': o.title });
    // grid and ticks
    const yt = niceTicks(y0, y1, 5);
    for (const v of yt) {
      root.append(svg('line', { x1: PAD.l, x2: W - PAD.r, y1: sy(v), y2: sy(v), class: 'grid' }));
      root.append(svg('text', { x: PAD.l - 6, y: sy(v) + 4, class: 'tick', 'text-anchor': 'end' }, fmtValue(v, 3)));
    }
    const xt = o.xlog
      ? Array.from({ length: Math.max(0, Math.floor(ax1) - Math.ceil(ax0) + 1) }, (_, i) => Math.pow(10, Math.ceil(ax0) + i))
      : niceTicks(x0, x1, 6);
    for (const v of xt) {
      root.append(svg('line', { x1: sx(v), x2: sx(v), y1: PAD.t, y2: H - PAD.b, class: 'grid' }));
      root.append(svg('text', { x: sx(v), y: H - PAD.b + 14, class: 'tick', 'text-anchor': 'middle' }, fmtValue(v, 3)));
    }
    root.append(svg('rect', { x: PAD.l, y: PAD.t, width: pw, height: ph, class: 'frame' }));
    root.append(svg('text', { x: PAD.l + pw / 2, y: H - 4, class: 'axis', 'text-anchor': 'middle' }, o.xlabel));
    root.append(svg('text', { x: 12, y: PAD.t + ph / 2, class: 'axis', 'text-anchor': 'middle', transform: `rotate(-90 12 ${PAD.t + ph / 2})` }, o.ylabel));
    // zero line
    if (y0 < 0 && y1 > 0) root.append(svg('line', { x1: PAD.l, x2: W - PAD.r, y1: sy(0), y2: sy(0), class: 'zero' }));
    // traces
    o.traces.forEach((t, k) => {
      if (hidden.has(t.name) || !t.x.length) return;
      const pts = decimate(t.x, t.y, sx);
      const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(Math.max(y0, Math.min(y1, y))).toFixed(1)}`).join('');
      root.append(svg('path', { d, class: 'trace', stroke: COLORS[k % COLORS.length] }));
    });
    // hover
    const cursor = svg('line', { x1: 0, x2: 0, y1: PAD.t, y2: H - PAD.b, class: 'cursor', visibility: 'hidden' });
    root.append(cursor);
    root.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      if (px < PAD.l || px > W - PAD.r) return;
      const frac = (px - PAD.l) / pw, xv = o.xlog ? Math.pow(10, ax0 + frac * (ax1 - ax0)) : ax0 + frac * (ax1 - ax0);
      cursor.setAttribute('x1', String(px)); cursor.setAttribute('x2', String(px)); cursor.setAttribute('visibility', 'visible');
      const vals = shown.map((t) => {
        let lo = 0, hi = t.x.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.x[m] <= xv) lo = m; else hi = m; }
        const i = Math.abs(t.x[lo] - xv) < Math.abs(t.x[hi] - xv) ? lo : hi;
        return `${t.name} = ${fmtValue(t.y[i], 4)}`;
      });
      readout.textContent = `${o.xlabel.split(' ')[0]} = ${fmtValue(xv, 4)}   ${vals.join('   ')}`;
    });
    root.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); });
    const legend = h('div', { class: 'cplot-legend' }, ...o.traces.map((t, k) => h('button', {
      class: `chip${hidden.has(t.name) ? ' off' : ''}`, style: `--c:${COLORS[k % COLORS.length]}`, title: 'Click to show or hide this trace',
      onclick: () => { if (hidden.has(t.name)) hidden.delete(t.name); else hidden.add(t.name); draw(); },
    }, t.name)));
    host.replaceChildren(h('div', { class: 'cplot-title' }, o.title), legend, root, readout);
  };
  draw();
  return host;
}

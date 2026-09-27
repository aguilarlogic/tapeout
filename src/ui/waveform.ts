// Canvas waveform viewer in the spirit of GTKWave / Verdi: one row per signal, buses as
// hex "eyes", mismatching output cycles in red, and the golden model's expected trace
// drawn right under any output that diverged.

import type { RunResult, TraceSignal } from '../sim/harness';
import { h, hex } from './dom';

interface Row {
  label: string;
  width: number;
  kind: TraceSignal['role'] | 'expected';
  slots: (bigint | null)[]; // null = don't care
  bad: Set<number>; // slot indices that mismatch
}

const ROW_H = 26;
const RULER_H = 20;

export function waveform(res: RunResult, clockName: string | undefined, showInternals: boolean): HTMLElement {
  const clocked = !!clockName;
  const nSteps = res.samples.length;
  const nSlots = clocked ? nSteps * 2 : nSteps;
  const slotW = clocked ? 18 : 34;

  const badSteps = new Map<string, Set<number>>();
  for (const m of res.mismatches) {
    if (!badSteps.has(m.signal)) badSteps.set(m.signal, new Set());
    badSteps.get(m.signal)!.add(m.step);
  }

  const valueAt = (name: string, slot: number, expected = false): bigint | null => {
    const step = clocked ? slot >> 1 : slot;
    const post = clocked && slot % 2 === 1;
    if (expected) {
      if (res.ignored[step]?.has(name)) return null;
      return (post ? res.expectedPost[step] : res.expected[step])[name];
    }
    return (post ? res.post[step] : res.samples[step])[name];
  };

  const rows: Row[] = [];
  for (const sig of res.signals) {
    if (sig.role === 'internal' && !showInternals) continue;
    const slots = Array.from({ length: nSlots }, (_, i) => {
      if (sig.role === 'clock') return BigInt(clocked ? i % 2 : 0);
      return valueAt(sig.name, i);
    });
    const bad = new Set<number>();
    for (const st of badSteps.get(sig.name) ?? []) {
      bad.add(clocked ? st * 2 : st);
    }
    rows.push({ label: sig.name, width: sig.width, kind: sig.role, slots, bad });
    if (sig.role === 'output' && badSteps.has(sig.name)) {
      rows.push({
        label: `${sig.name} (expected)`,
        width: sig.width,
        kind: 'expected',
        slots: Array.from({ length: nSlots }, (_, i) => valueAt(sig.name, i, true)),
        bad: new Set(),
      });
    }
  }

  const names = h('div', { class: 'wave-names' }, h('div', { class: 'wave-ruler-pad', style: `height:${RULER_H}px` }, clocked ? 'cycle' : 'sample'));
  const values = h('div', { class: 'wave-values' }, h('div', { class: 'wave-ruler-pad', style: `height:${RULER_H}px` }, 'value'));
  const valueCells: HTMLElement[] = [];
  for (const r of rows) {
    names.append(h('div', { class: `wave-name wave-${r.kind}`, style: `height:${ROW_H}px`, title: `${r.label} [${r.width} bit${r.width > 1 ? 's' : ''}]` }, r.label));
    const cell = h('div', { class: `wave-val wave-${r.kind}`, style: `height:${ROW_H}px` });
    valueCells.push(cell);
    values.append(cell);
  }

  const canvas = h('canvas', { class: 'wave-canvas' });
  const scroller = h('div', { class: 'wave-scroll' }, canvas);
  const root = h('div', { class: 'wave' }, names, values, scroller);

  const cssW = nSlots * slotW + 40;
  const cssH = RULER_H + rows.length * ROW_H + 4;
  let cursor = firstBadSlot(rows);

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(root);
    const col = (v: string) => css.getPropertyValue(v).trim() || '#888';
    const C = {
      grid: col('--wave-grid'),
      text: col('--text-dim'),
      bit: col('--wave-bit'),
      bus: col('--wave-bus'),
      clk: col('--wave-clk'),
      exp: col('--wave-exp'),
      bad: col('--err'),
      cursor: col('--accent'),
      internal: col('--wave-internal'),
    };
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';

    // ruler + grid
    const perStep = clocked ? 2 : 1;
    for (let s = 0; s < nSteps; s++) {
      const x = s * perStep * slotW;
      ctx.fillStyle = C.grid;
      ctx.fillRect(x, RULER_H, 1, cssH - RULER_H);
      if (s % 5 === 0) {
        ctx.fillStyle = C.text;
        ctx.fillText(String(s), x + 2, RULER_H / 2);
      }
    }

    rows.forEach((r, ri) => {
      const top = RULER_H + ri * ROW_H;
      const hi = top + 5, lo = top + ROW_H - 6, mid = (hi + lo) / 2;
      const color = r.kind === 'clock' ? C.clk : r.kind === 'expected' ? C.exp : r.kind === 'internal' ? C.internal : r.width === 1 ? C.bit : C.bus;

      for (const b of r.bad) {
        ctx.fillStyle = C.bad;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(b * slotW, top + 1, slotW * (clocked ? 2 : 1), ROW_H - 2);
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      if (r.width === 1) {
        ctx.beginPath();
        let prevY: number | null = null;
        r.slots.forEach((v, i) => {
          const x0 = i * slotW, x1 = x0 + slotW;
          if (v === null) { prevY = null; drawDontCare(ctx, x0, x1, hi, lo); return; }
          const y = v ? hi : lo;
          if (prevY === null) ctx.moveTo(x0, y);
          else if (prevY !== y) ctx.lineTo(x0, y);
          ctx.lineTo(x1, y);
          prevY = y;
        });
        ctx.stroke();
      } else {
        let i = 0;
        while (i < r.slots.length) {
          let j = i + 1;
          while (j < r.slots.length && r.slots[j] === r.slots[i]) j++;
          const x0 = i * slotW, x1 = j * slotW;
          const v = r.slots[i];
          if (v === null) {
            drawDontCare(ctx, x0, x1, hi, lo);
          } else {
            const e = Math.min(3, (x1 - x0) / 2);
            ctx.beginPath();
            ctx.moveTo(x0, mid);
            ctx.lineTo(x0 + e, hi); ctx.lineTo(x1 - e, hi); ctx.lineTo(x1, mid);
            ctx.lineTo(x1 - e, lo); ctx.lineTo(x0 + e, lo); ctx.closePath();
            ctx.stroke();
            const label = hex(v, r.width);
            if (ctx.measureText(label).width < x1 - x0 - 6) {
              ctx.fillStyle = color;
              ctx.fillText(label, x0 + (x1 - x0 - ctx.measureText(label).width) / 2, mid + 1);
            }
          }
          i = j;
        }
      }
    });

    if (cursor !== null) {
      ctx.fillStyle = C.cursor;
      ctx.fillRect(cursor * slotW + slotW / 2, RULER_H, 1.5, cssH - RULER_H);
    }
  };

  const showValues = (slot: number | null) => {
    rows.forEach((r, i) => {
      const v = slot === null ? undefined : r.slots[slot];
      valueCells[i].textContent = v === undefined ? '' : v === null ? '-' : r.width === 1 ? v.toString() : `${r.width}'h${hex(v, r.width)}`;
      valueCells[i].classList.toggle('bad', slot !== null && r.bad.has(clocked ? slot & ~1 : slot));
    });
  };

  const slotAt = (ev: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const s = Math.floor((ev.clientX - rect.left) / slotW);
    return s >= 0 && s < nSlots ? s : null;
  };
  canvas.addEventListener('mousemove', (ev) => showValues(slotAt(ev)));
  canvas.addEventListener('mouseleave', () => showValues(cursor));
  canvas.addEventListener('click', (ev) => {
    cursor = slotAt(ev);
    draw();
    showValues(cursor);
  });

  requestAnimationFrame(() => {
    draw();
    showValues(cursor);
    if (cursor !== null) scroller.scrollLeft = Math.max(0, cursor * slotW - 160);
  });
  return root;
}

function firstBadSlot(rows: Row[]): number | null {
  let best: number | null = null;
  for (const r of rows) for (const b of r.bad) if (best === null || b < best) best = b;
  return best;
}

function drawDontCare(ctx: CanvasRenderingContext2D, x0: number, x1: number, hi: number, lo: number) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let x = x0; x < x1; x += 5) {
    ctx.moveTo(x, lo);
    ctx.lineTo(Math.min(x + 5, x1), hi);
  }
  ctx.stroke();
  ctx.restore();
}

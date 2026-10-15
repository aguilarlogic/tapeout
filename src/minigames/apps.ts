// TAPEOUT's minigames. Each one renders into a desktop window, runs a few rounds and reports a score.
import type { Mood, Rng } from '../lessons/types';
import { h, svg } from '../ui/dom';
import {
  bpNext, bpPredict, BP_STATES, bpStream, CACHE, cacheRun, cacheStream, CAP_VALUES, DIV_TARGETS, DIV_TOL, divOut, ffRound,
  hsRound, int, Mesi, mesiOps, mesiStep, RC_TARGETS, RC_TOL, rcMetric, RES_VALUES, rows, TRUTH_ROUNDS,
} from './logic';

export interface GameCtx {
  host: HTMLElement;
  r: Rng;
  rounds: number;
  finish: (score: number, max: number) => void;
  say: (text: string, mood?: Mood) => void;
}

export interface MiniGame {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  lesson: string;
  rounds: number;
  play: (ctx: GameCtx) => void;
}

const fmtR = (r: number) => (r >= 1000 ? `${+(r / 1000).toPrecision(3)}k` : `${r}`) + 'Ω';
const fmtC = (c: number) => (c >= 1e-6 ? `${+(c * 1e6).toPrecision(3)}µ` : `${+(c * 1e9).toPrecision(3)}n`) + 'F';
const fmtT = (t: number) => (t >= 1e-3 ? `${+(t * 1e3).toPrecision(3)} ms` : `${+(t * 1e6).toPrecision(3)} µs`);
const fmtF = (f: number) => (f >= 1000 ? `${+(f / 1000).toPrecision(3)} kHz` : `${+f.toPrecision(3)} Hz`);

/** Shared chrome: round counter, score, a stage for the round, and a footer for buttons/feedback. */
function frame(ctx: GameCtx, max: number) {
  const round = h('span', null);
  const scoreEl = h('span', { class: 'mg-score' });
  const stage = h('div', { class: 'mg-stage' });
  const feedback = h('div', { class: 'mg-feedback' });
  const actions = h('div', { class: 'mg-actions' });
  ctx.host.replaceChildren(h('div', { class: 'mg' }, h('div', { class: 'mg-head' }, round, scoreEl), stage, feedback, actions));
  let score = 0;
  const api = {
    stage, feedback, actions,
    set round(n: number) { round.textContent = `Round ${n + 1} of ${ctx.rounds}`; },
    point() { score++; scoreEl.textContent = `score ${score}/${max}`; },
    get score() { return score; },
    note(text: string, kind: 'ok' | 'err' | '' = '') { feedback.className = `mg-feedback ${kind}`; feedback.textContent = text; },
    buttons(...b: HTMLElement[]) { actions.replaceChildren(...b); },
    done() { ctx.finish(score, max); },
  };
  scoreEl.textContent = `score 0/${max}`;
  return api;
}

const btn = (label: string, onclick: () => void, cls = 'btn small') => h('button', { class: cls, onclick }, label);

// ---------------------------------------------------------------- lamps (the gentle first bit game)
const lamps: MiniGame = {
  id: 'lamps', title: 'Lamps', icon: '01', lesson: 'bits', rounds: 4,
  blurb: 'Click the lamps to make the target number. No clock, no pressure.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    let n = 0;
    const next = () => {
      if (n >= ctx.rounds) return f.done();
      f.round = n;
      // Round 1 uses three lamps (0-7); the rest use four (0-15). The running sum is always on screen.
      const width = n === 0 ? 3 : 4;
      const target = int(ctx.r, 1, (1 << width) - 1);
      let v = 0;
      let slips = 0;
      const bits = Array.from({ length: width }, (_, i) => width - 1 - i);
      const cells = bits.map((b) => h('button', { class: 'bit', onclick: () => { v ^= 1 << b; render(); } }));
      const readout = h('div', { class: 'mg-readout' });
      const render = () => {
        cells.forEach((c, i) => { const on = (v >> bits[i]) & 1; c.textContent = on ? '1' : '0'; c.classList.toggle('on', !!on); });
        const parts = bits.filter((b) => (v >> b) & 1).map((b) => String(1 << b));
        readout.textContent = parts.length ? `${parts.join(' + ')} = ${v}` : 'all lamps off = 0';
        if (v === target) {
          if (slips <= 3) f.point();
          f.note('That is it. Lamps that are on add up to the target.', 'ok');
          cells.forEach((c) => ((c as HTMLButtonElement).disabled = true));
          n++;
          setTimeout(next, 1100);
        } else if (v > target) { slips++; f.note('Too big. Turn off the largest lamp and try a smaller one.'); }
        else f.note('Add up the lamps that are on. Keep going until you reach the target.');
      };
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, 'make ', h('b', null, String(target))),
        h('div', { class: 'bits' }, ...bits.map((b, i) => h('div', { class: 'bitcol' }, h('small', null, `worth ${1 << b}`), cells[i]))),
        readout,
      );
      f.buttons();
      render();
    };
    next();
  },
};

// ---------------------------------------------------------------- bit flipper
const bitflip: MiniGame = {
  id: 'bitflip', title: 'Bit Flipper', icon: '01', lesson: 'hex', rounds: 5,
  blurb: 'Flip the switches until the byte matches the target. Beat the clock for points.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    let n = 0;
    const next = () => {
      if (n >= ctx.rounds) return f.done();
      f.round = n;
      const target = int(ctx.r, 1, 255);
      const asHex = n % 2 === 1;
      let v = 0;
      const t0 = performance.now();
      const bits = Array.from({ length: 8 }, (_, i) => 7 - i);
      const cells = bits.map((b) => h('button', { class: 'bit', onclick: () => { v ^= 1 << b; render(); } }));
      const readout = h('div', { class: 'mg-readout' });
      const render = () => {
        cells.forEach((c, i) => { const on = (v >> bits[i]) & 1; c.textContent = String(on); c.classList.toggle('on', !!on); });
        readout.textContent = `= ${v}  ·  0x${v.toString(16).toUpperCase().padStart(2, '0')}`;
        if (v === target) {
          const secs = (performance.now() - t0) / 1000;
          const fast = secs < 15;
          if (fast) f.point();
          f.note(fast ? `Match in ${secs.toFixed(1)} s!` : `Match, but ${secs.toFixed(1)} s. Under 15 s scores.`, fast ? 'ok' : '');
          cells.forEach((c) => ((c as HTMLButtonElement).disabled = true));
          n++;
          setTimeout(next, 900);
        }
      };
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, 'target ', h('b', null, asHex ? `0x${target.toString(16).toUpperCase().padStart(2, '0')}` : String(target))),
        h('div', { class: 'bits' }, ...bits.map((b, i) => h('div', { class: 'bitcol' }, h('small', null, String(1 << b)), cells[i]))),
        readout,
      );
      f.note(asHex ? 'Hex: each digit is a nibble (4 bits).' : 'Decimal: add up the weights of the 1s.');
      f.buttons();
      render();
    };
    next();
  },
};

// ---------------------------------------------------------------- truth tables
const truth: MiniGame = {
  id: 'truth', title: 'Truth Table', icon: 'TT', lesson: 'demorgan', rounds: 4,
  blurb: 'Fill in the output column for each expression. First try scores.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const pool = [...TRUTH_ROUNDS].sort(() => ctx.r() - 0.5).sort((a, b) => a.vars.length - b.vars.length).slice(0, ctx.rounds);
    let n = 0;
    const next = () => {
      if (n >= pool.length) return f.done();
      f.round = n;
      const tr = pool[n];
      const rs = rows(tr.vars.length);
      const ans = rs.map(() => -1);
      let tries = 0;
      const outs = rs.map((_, i) => h('button', { class: 'tt-out', onclick: () => { ans[i] = ans[i] === 1 ? 0 : 1; outs[i].textContent = String(ans[i]); outs[i].className = 'tt-out'; } }, '?'));
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, 'y = ', h('code', null, tr.label)),
        h('table', { class: 'tt' },
          h('tr', null, ...tr.vars.map((v) => h('th', null, v)), h('th', null, 'y')),
          ...rs.map((row, i) => h('tr', null, ...row.map((b) => h('td', null, String(b))), h('td', null, outs[i])))),
      );
      f.note('Click the output cells to set them.');
      const check = () => {
        if (ans.includes(-1)) return f.note('Fill in every row first.', 'err');
        tries++;
        let ok = true;
        rs.forEach((row, i) => { const good = tr.fn(row) === ans[i]; outs[i].className = `tt-out ${good ? 'right' : 'wrong'}`; ok &&= good; });
        if (ok) {
          if (tries === 1) f.point();
          f.note(tries === 1 ? 'Perfect.' : 'Correct now.', 'ok');
          n++;
          f.buttons(btn(n < pool.length ? 'Next →' : 'Finish', next, 'btn small primary'));
        } else f.note('Some rows are wrong (red). Fix them and check again.', 'err');
      };
      f.buttons(btn('Check', check, 'btn small primary'));
    };
    next();
  },
};

// ---------------------------------------------------------------- voltage divider
const divider: MiniGame = {
  id: 'divider', title: 'Divider Designer', icon: 'R', lesson: 'ohm', rounds: 3,
  blurb: 'Pick standard E12 resistors to hit a target voltage within 2%.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const targets = [...DIV_TARGETS].sort(() => ctx.r() - 0.5).slice(0, ctx.rounds);
    let n = 0;
    const next = () => {
      if (n >= targets.length) return f.done();
      f.round = n;
      const t = targets[n];
      const sel = (init: number) => h('select', { class: 'mg-select' }, ...RES_VALUES.map((v) => h('option', { value: String(v), selected: v === init }, fmtR(v))));
      const s1 = sel(10000), s2 = sel(10000);
      const out = h('div', { class: 'mg-readout' });
      const draw = h('div', { class: 'mg-schem' });
      const val = () => [+s1.value, +s2.value];
      const update = () => {
        const [r1, r2] = val();
        const vo = divOut(t.vin, r1, r2);
        const err = (vo - t.vout) / t.vout;
        out.textContent = `Vout = ${vo.toFixed(3)} V (${err >= 0 ? '+' : ''}${(err * 100).toFixed(1)}%)   ·   I = ${((t.vin / (r1 + r2)) * 1000).toFixed(3)} mA`;
        draw.replaceChildren(schematic(t.vin, fmtR(r1), fmtR(r2), vo));
      };
      s1.addEventListener('change', update);
      s2.addEventListener('change', update);
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, `Vin = ${t.vin} V → target `, h('b', null, `${t.vout} V`), h('span', { class: 'dim' }, ` (${t.why})`)),
        h('div', { class: 'mg-row' }, draw, h('div', { class: 'mg-col' }, h('label', null, 'R1 (top) ', s1), h('label', null, 'R2 (bottom) ', s2), out)),
      );
      f.note('Keep R1 + R2 between 1 kΩ and 110 kΩ: too low wastes current, too high is noisy.');
      update();
      f.buttons(btn('Check', () => {
        const [r1, r2] = val();
        const err = Math.abs(divOut(t.vin, r1, r2) - t.vout) / t.vout;
        if (r1 + r2 < 1000 || r1 + r2 > 110000) return f.note('Total resistance out of range (1 kΩ to 110 kΩ).', 'err');
        if (err > DIV_TOL) return f.note(`${(err * 100).toFixed(1)}% off. Get within 2%.`, 'err');
        f.point();
        f.note(`Within ${(err * 100).toFixed(2)}%. Nice design.`, 'ok');
        n++;
        f.buttons(btn(n < targets.length ? 'Next →' : 'Finish', next, 'btn small primary'));
      }, 'btn small primary'));
    };
    next();
  },
};

function schematic(vin: number, r1: string, r2: string, vo: number): SVGSVGElement {
  const s = svg('svg', { viewBox: '0 0 150 190', class: 'mg-svg', width: 150 });
  const res = (y: number, label: string) => {
    s.append(svg('rect', { x: 62, y, width: 16, height: 40, class: 'sch-part' }), svg('text', { x: 86, y: y + 24, class: 'sch-t' }, label));
  };
  s.append(svg('text', { x: 50, y: 14, class: 'sch-t' }, `${vin} V`), svg('line', { x1: 70, y1: 20, x2: 70, y2: 30, class: 'sch-w' }));
  res(30, r1);
  s.append(svg('line', { x1: 70, y1: 70, x2: 70, y2: 110, class: 'sch-w' }), svg('line', { x1: 70, y1: 90, x2: 20, y2: 90, class: 'sch-w' }),
    svg('circle', { cx: 20, cy: 90, r: 3, class: 'sch-dot' }), svg('text', { x: 2, y: 82, class: 'sch-t acc' }, `${vo.toFixed(2)}V`));
  res(110, r2);
  s.append(svg('line', { x1: 70, y1: 150, x2: 70, y2: 170, class: 'sch-w' }), svg('line', { x1: 58, y1: 170, x2: 82, y2: 170, class: 'sch-w' }),
    svg('line', { x1: 63, y1: 176, x2: 77, y2: 176, class: 'sch-w' }), svg('line', { x1: 68, y1: 182, x2: 72, y2: 182, class: 'sch-w' }));
  return s;
}

// ---------------------------------------------------------------- RC scope
const rcscope: MiniGame = {
  id: 'rcscope', title: 'RC Scope', icon: '∿', lesson: 'rc', rounds: 3,
  blurb: 'Choose R and C so the step response hits the spec. The dashed trace is the target.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const targets = [...RC_TARGETS].sort(() => ctx.r() - 0.5).slice(0, ctx.rounds);
    let n = 0;
    const next = () => {
      if (n >= targets.length) return f.done();
      f.round = n;
      const t = targets[n];
      const tauT = t.kind === 'tau' ? t.value : t.kind === 'fc' ? 1 / (2 * Math.PI * t.value) : t.value / Math.log(10);
      const sr = h('select', { class: 'mg-select' }, ...RES_VALUES.map((v) => h('option', { value: String(v), selected: v === 1000 }, fmtR(v))));
      const sc = h('select', { class: 'mg-select' }, ...CAP_VALUES.map((v) => h('option', { value: String(v), selected: v === 1e-7 }, fmtC(v))));
      const out = h('div', { class: 'mg-readout' });
      const plotHost = h('div', null);
      const update = () => {
        const R = +sr.value, C = +sc.value, tau = R * C;
        out.textContent = `τ = ${fmtT(tau)} · fc = ${fmtF(1 / (2 * Math.PI * tau))} · t90 = ${fmtT(tau * Math.log(10))}`;
        plotHost.replaceChildren(scope(tauT, tau));
      };
      sr.addEventListener('change', update);
      sc.addEventListener('change', update);
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, 'spec: ', h('b', null, t.text)),
        plotHost,
        h('div', { class: 'mg-row' }, h('label', null, 'R ', sr), h('label', null, 'C ', sc)),
        out,
      );
      f.note('Only standard values exist, so aim for within 6%.');
      update();
      f.buttons(btn('Check', () => {
        const got = rcMetric(t.kind, +sr.value, +sc.value);
        const err = Math.abs(got - t.value) / t.value;
        if (err > RC_TOL) return f.note(`${(err * 100).toFixed(0)}% off spec.`, 'err');
        f.point();
        f.note(`In spec (${(err * 100).toFixed(1)}% off).`, 'ok');
        n++;
        f.buttons(btn(n < targets.length ? 'Next →' : 'Finish', next, 'btn small primary'));
      }, 'btn small primary'));
    };
    next();
  },
};

function scope(tauTarget: number, tau: number): SVGSVGElement {
  const W = 420, H = 170, P = 26;
  const span = tauTarget * 5;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mg-scope' });
  for (let i = 0; i <= 5; i++) {
    const x = P + ((W - 2 * P) * i) / 5;
    s.append(svg('line', { x1: x, y1: 10, x2: x, y2: H - P, class: 'grid' }), svg('text', { x: x - 6, y: H - 8, class: 'sch-t' }, `${i}τ*`));
  }
  for (const v of [0, 0.63, 0.9, 1]) {
    const y = H - P - (H - P - 10) * v;
    s.append(svg('line', { x1: P, y1: y, x2: W - P, y2: y, class: 'grid' }), svg('text', { x: 2, y: y + 3, class: 'sch-t' }, `${Math.round(v * 100)}%`));
  }
  const path = (tt: number) => Array.from({ length: 101 }, (_, i) => {
    const t = (span * i) / 100;
    const v = 1 - Math.exp(-t / tt);
    return `${i ? 'L' : 'M'}${(P + ((W - 2 * P) * i) / 100).toFixed(1)},${(H - P - (H - P - 10) * v).toFixed(1)}`;
  }).join('');
  s.append(svg('path', { d: path(tauTarget), class: 'trace target' }), svg('path', { d: path(tau), class: 'trace' }));
  return s;
}

// ---------------------------------------------------------------- flip-flop trace
const fftrace: MiniGame = {
  id: 'fftrace', title: 'Flip-Flop Trace', icon: 'FF', lesson: 'seq', rounds: 4,
  blurb: 'Predict Q after every rising clock edge. Click Q\'s segments to set them.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const kinds = ['dff', 'dff', 'enable', 'reset', 'enable'] as const;
    let n = 0;
    const next = () => {
      if (n >= ctx.rounds) return f.done();
      f.round = n;
      const kind = kinds[n % kinds.length];
      const rd = ffRound(ctx.r, kind);
      const guess = rd.q.map(() => 0);
      let tries = 0;
      const host = h('div', { class: 'mg-wave' });
      const draw = (marks?: boolean[]) => host.replaceChildren(timing(rd, guess, (i) => { guess[i] ^= 1; draw(); }, marks));
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, kind === 'dff' ? 'A plain D flip-flop.' : kind === 'enable' ? 'A D flip-flop with enable: it only captures when en = 1.' : 'A D flip-flop with synchronous reset: rst = 1 at an edge forces Q to 0.'),
        host,
      );
      f.note('Q starts at 0. Each flop samples its inputs at the rising edge (the dashed lines).');
      draw();
      f.buttons(btn('Check', () => {
        tries++;
        const marks = rd.q.map((q, i) => q === guess[i]);
        draw(marks);
        if (marks.every(Boolean)) {
          if (tries === 1) f.point();
          f.note(tries === 1 ? 'Every edge right.' : 'Correct now.', 'ok');
          n++;
          f.buttons(btn(n < ctx.rounds ? 'Next →' : 'Finish', next, 'btn small primary'));
        } else f.note('Red segments are wrong. Look at what D (and en/rst) were just before that edge.', 'err');
      }, 'btn small primary'));
    };
    next();
  },
};

function timing(rd: ReturnType<typeof ffRound>, guess: number[], toggle: (i: number) => void, marks?: boolean[]): SVGSVGElement {
  const U = 44, L = 44, RH = 34;
  const names = ['clk', 'd', ...(rd.kind === 'enable' ? ['en'] : []), ...(rd.kind === 'reset' ? ['rst'] : []), 'q'];
  const W = L + U * (rd.cycles + 1.5), H = names.length * RH + 8;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mg-timing' });
  const yOf = (row: number, v: number) => row * RH + 8 + (v ? 4 : RH - 12);
  names.forEach((nm, i) => s.append(svg('text', { x: 4, y: i * RH + 26, class: 'sch-t' }, nm)));
  for (let e = 1; e <= rd.cycles; e++) s.append(svg('line', { x1: L + e * U, y1: 0, x2: L + e * U, y2: H, class: 'edge' }));
  // clock: rising edges at integer t, high for half a period
  let d = `M${L},${yOf(0, 0)}`;
  for (let t = 0; t < rd.cycles + 1.5; t += 0.5) {
    const v = Math.round(t * 2) % 2 === 0 ? 1 : 0;
    const x = L + t * U;
    d += ` L${x},${yOf(0, v)} L${x + U / 2},${yOf(0, v)}`;
  }
  s.append(svg('path', { d, class: 'sig clk' }));
  const sigRow = (row: number, vals: number[]) => {
    let p = `M${L},${yOf(row, 0)}`;
    let prev = 0;
    vals.forEach((v, i) => {
      const x = L + (i + 0.35) * U;
      p += ` L${x},${yOf(row, prev)} L${x},${yOf(row, v)}`;
      prev = v;
    });
    p += ` L${L + (rd.cycles + 1.5) * U},${yOf(row, prev)}`;
    s.append(svg('path', { d: p, class: 'sig' }));
  };
  sigRow(1, rd.d);
  let row = 2;
  if (rd.kind === 'enable') sigRow(row++, rd.en);
  if (rd.kind === 'reset') sigRow(row++, rd.rst);
  // q: initial segment, then one clickable segment per edge
  s.append(svg('line', { x1: L, y1: yOf(row, 0), x2: L + U, y2: yOf(row, 0), class: 'sig' }));
  guess.forEach((g, i) => {
    const x = L + (i + 1) * U;
    const cls = marks ? (marks[i] ? 'qseg right' : 'qseg wrong') : 'qseg';
    const grp = svg('g', { class: cls, onclick: () => toggle(i) });
    grp.append(svg('rect', { x: x + 1, y: row * RH + 4, width: U - 2, height: RH - 6, class: 'hit' }),
      svg('line', { x1: x, y1: yOf(row, g), x2: x + U, y2: yOf(row, g), class: 'sig q' }));
    s.append(grp);
    const prev = i ? guess[i - 1] : 0;
    if (prev !== g) s.append(svg('line', { x1: x, y1: yOf(row, prev), x2: x, y2: yOf(row, g), class: 'sig q' }));
  });
  return s;
}

// ---------------------------------------------------------------- cache
const cache: MiniGame = {
  id: 'cache', title: 'Cache Sim', icon: '$', lesson: 'cache', rounds: 8,
  blurb: 'A 4-line direct-mapped cache with 16-byte lines. Call every access: hit or miss?',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const addrs = cacheStream(ctx.r, ctx.rounds);
    const acc = cacheRun(addrs);
    const tags: (number | undefined)[] = Array(CACHE.lines).fill(undefined);
    let n = 0;
    const table = () => h('table', { class: 'tt cache-t' },
      h('tr', null, h('th', null, 'set'), h('th', null, 'valid'), h('th', null, 'tag')),
      ...tags.map((t, i) => h('tr', { class: n < acc.length && acc[n].set === i ? 'cur' : '' }, h('td', null, String(i)), h('td', null, t === undefined ? '0' : '1'), h('td', null, t === undefined ? '-' : `0x${t.toString(16).toUpperCase()}`))));
    const hex = (a: number) => `0x${a.toString(16).toUpperCase().padStart(2, '0')}`;
    const show = () => {
      if (n >= acc.length) return f.done();
      f.round = n;
      const a = acc[n];
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, 'access ', h('b', null, hex(a.addr)), h('span', { class: 'dim' }, '   8-bit address = tag[7:6] | set[5:4] | offset[3:0]')),
        h('div', { class: 'mg-row' }, table(), h('div', { class: 'mg-col small' }, 'stream: ', ...addrs.map((x, i) => h('code', { class: i === n ? 'cur' : i < n ? 'dim' : '' }, hex(x))))),
      );
      f.note('');
      const answer = (hit: boolean) => {
        const right = hit === a.hit;
        if (right) f.point();
        f.note(`${hex(a.addr)} → set ${a.set}, tag 0x${a.tag.toString(16).toUpperCase()}: ${a.hit ? 'HIT' : a.evicted !== undefined ? `MISS (evicts tag 0x${a.evicted.toString(16).toUpperCase()}: a conflict)` : 'MISS (cold)'}.`, right ? 'ok' : 'err');
        tags[a.set] = a.tag;
        n++;
        f.buttons(btn(n < acc.length ? 'Next access →' : 'Finish', show, 'btn small primary'));
      };
      f.buttons(btn('HIT', () => answer(true), 'btn small primary'), btn('MISS', () => answer(false), 'btn small'));
    };
    show();
  },
};

// ---------------------------------------------------------------- branch predictor
const branch: MiniGame = {
  id: 'branch', title: 'Branch Predictor', icon: 'BP', lesson: 'ooo', rounds: 6,
  blurb: 'Step a 2-bit saturating counter. After each branch resolves, click the counter\'s new state.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const stream = bpStream(ctx.r, ctx.rounds);
    let st = 2, n = 0, miss = 0;
    const show = () => {
      if (n >= stream.length) {
        ctx.say(`The predictor mispredicted ${miss} of ${stream.length} branches on that pattern.`, 'thinking');
        return f.done();
      }
      f.round = n;
      const taken = stream[n];
      const pred = bpPredict(st);
      const boxes = BP_STATES.map((name, i) => h('button', { class: `bp-state${i === st ? ' cur' : ''}`, onclick: () => answer(i) }, h('b', null, ['00', '01', '10', '11'][i]), h('small', null, name)));
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, 'counter predicts ', h('b', null, pred ? 'TAKEN' : 'NOT TAKEN'), ' · branch was ', h('b', { class: taken === pred ? 'okc' : 'errc' }, taken ? 'TAKEN' : 'NOT TAKEN')),
        h('div', { class: 'bp-row' }, ...boxes),
        h('div', { class: 'small dim' }, 'history: ', stream.slice(0, n).map((t) => (t ? 'T' : 'N')).join(' ') || '(none)'),
      );
      f.note('Taken moves the counter right, not-taken moves it left. It saturates at the ends. Click the new state.');
      f.buttons();
      const answer = (i: number) => {
        const nx = bpNext(st, taken);
        if (pred !== taken) miss++;
        if (i === nx) f.point();
        f.note(i === nx ? `Yes: ${BP_STATES[nx]}.` : `No: from ${BP_STATES[st]} a ${taken ? 'taken' : 'not-taken'} branch goes to ${BP_STATES[nx]}.`, i === nx ? 'ok' : 'err');
        st = nx;
        n++;
        boxes.forEach((b) => ((b as HTMLButtonElement).disabled = true));
        f.buttons(btn(n < stream.length ? 'Next branch →' : 'Finish', show, 'btn small primary'));
      };
    };
    show();
  },
};

// ---------------------------------------------------------------- MESI
const mesi: MiniGame = {
  id: 'mesi', title: 'Coherence Lab', icon: 'M', lesson: 'coherence', rounds: 6,
  blurb: 'Two cores share one cache line. After each access, set both caches\' MESI states.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    const ops = mesiOps(ctx.r, ctx.rounds);
    let st: [Mesi, Mesi] = ['I', 'I'];
    let n = 0;
    const show = () => {
      if (n >= ops.length) return f.done();
      f.round = n;
      const o = ops[n];
      const pickd: [Mesi | null, Mesi | null] = [null, null];
      const col = (core: 0 | 1) => h('div', { class: 'mesi-core' }, h('b', null, `Core ${core}`), h('div', { class: 'dim small' }, `now: ${st[core]}`),
        h('div', { class: 'mesi-btns' }, ...(['M', 'E', 'S', 'I'] as Mesi[]).map((s) => {
          const b = h('button', { class: 'chip', onclick: () => { pickd[core] = s; b.parentElement!.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); b.classList.add('on'); } }, s);
          return b;
        })));
      f.stage.replaceChildren(
        h('div', { class: 'mg-target' }, h('b', null, `Core ${o.core} ${o.op}s`), ' the line.'),
        h('div', { class: 'mesi' }, col(0), col(1)),
      );
      f.note('M = modified (dirty, only copy) · E = exclusive clean · S = shared · I = invalid');
      f.buttons(btn('Submit', () => {
        if (!pickd[0] || !pickd[1]) return f.note('Pick a state for both cores.', 'err');
        const nx = mesiStep(st, o);
        const ok = pickd[0] === nx[0] && pickd[1] === nx[1];
        if (ok) f.point();
        f.note(ok ? `Right: ${nx[0]} / ${nx[1]}.` : `Not quite: it becomes Core 0 = ${nx[0]}, Core 1 = ${nx[1]}. ${o.op === 'write' ? 'A write needs the only copy, so the other cache is invalidated.' : st[o.core] !== 'I' ? 'A read hit changes nothing.' : st[1 - o.core] === 'I' ? 'Nobody else has it, so the reader gets it Exclusive.' : 'Another cache has it, so both end up Shared (a Modified copy is written back first).'}`, ok ? 'ok' : 'err');
        st = nx;
        n++;
        f.buttons(btn(n < ops.length ? 'Next access →' : 'Finish', show, 'btn small primary'));
      }, 'btn small primary'));
    };
    show();
  },
};

// ---------------------------------------------------------------- VALID/READY
const handshake: MiniGame = {
  id: 'handshake', title: 'Handshake', icon: '⇄', lesson: 'bus', rounds: 4,
  blurb: 'Click every clock cycle where a VALID/READY transfer happens.',
  play(ctx) {
    const f = frame(ctx, ctx.rounds);
    let n = 0;
    const next = () => {
      if (n >= ctx.rounds) return f.done();
      f.round = n;
      const hs = hsRound(ctx.r);
      const marked = hs.fire.map(() => 0);
      let tries = 0;
      const host = h('div', { class: 'mg-wave' });
      const draw = (res?: boolean[]) => host.replaceChildren(hsWave(hs, marked, (i) => { marked[i] ^= 1; draw(); }, res));
      f.stage.replaceChildren(h('div', { class: 'mg-target' }, 'A transfer happens at a rising edge where ', h('b', null, 'VALID && READY'), '.'), host);
      f.note('Click the cycles (columns) where data moves.');
      draw();
      f.buttons(btn('Check', () => {
        tries++;
        const res = hs.fire.map((x, i) => x === marked[i]);
        draw(res);
        if (res.every(Boolean)) {
          if (tries === 1) f.point();
          f.note(`${hs.fire.filter(Boolean).length} transfers. ${tries === 1 ? 'Spot on.' : 'Correct now.'}`, 'ok');
          n++;
          f.buttons(btn(n < ctx.rounds ? 'Next →' : 'Finish', next, 'btn small primary'));
        } else f.note('Red columns are wrong. Both signals must be high in the same cycle.', 'err');
      }, 'btn small primary'));
    };
    next();
  },
};

function hsWave(hs: ReturnType<typeof hsRound>, marked: number[], toggle: (i: number) => void, res?: boolean[]): SVGSVGElement {
  const U = 34, L = 58, RH = 30, n = hs.valid.length;
  const W = L + U * n + 10, H = RH * 4 + 10;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mg-timing' });
  const y = (row: number, v: number) => row * RH + 8 + (v ? 3 : RH - 10);
  ['clk', 'VALID', 'READY', 'DATA'].forEach((nm, i) => s.append(svg('text', { x: 4, y: i * RH + 24, class: 'sch-t' }, nm)));
  for (let i = 0; i < n; i++) {
    const x = L + i * U;
    const cls = `hs-col${marked[i] ? ' on' : ''}${res ? (res[i] ? ' right' : ' wrong') : ''}`;
    s.append(svg('rect', { x: x + 1, y: 2, width: U - 2, height: H - 4, class: cls, onclick: () => toggle(i) }));
    s.append(svg('path', { d: `M${x},${y(0, 0)} L${x},${y(0, 1)} L${x + U / 2},${y(0, 1)} L${x + U / 2},${y(0, 0)} L${x + U},${y(0, 0)}`, class: 'sig clk' }));
  }
  const row = (r: number, vals: number[]) => {
    let d = '';
    vals.forEach((v, i) => {
      const x = L + i * U - U * 0.35; // signals change a little after the previous edge
      d += `${i ? 'L' : 'M'}${Math.max(L, x)},${y(r, i ? vals[i - 1] : v)} L${Math.max(L, x)},${y(r, v)} L${x + U},${y(r, v)} `;
    });
    s.append(svg('path', { d, class: 'sig' }));
  };
  row(1, hs.valid);
  row(2, hs.ready);
  let k = 0;
  hs.valid.forEach((v, i) => {
    const x = L + i * U;
    if (v) s.append(svg('text', { x: x + 6, y: 3 * RH + 24, class: 'sch-t acc' }, `D${k}`));
    if (hs.fire[i]) k++;
  });
  return s;
}

export const MINIGAMES: MiniGame[] = [lamps, bitflip, truth, divider, rcscope, fftrace, cache, branch, mesi, handshake];
export const findGame = (id: string) => MINIGAMES.find((g) => g.id === id);

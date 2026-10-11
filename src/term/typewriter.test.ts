import { describe, expect, it } from 'vitest';
import { animate, type Clock, duration, heldKey, INSTANT, Output, paceFor, PACES, revealSteps, timeline, type Token, typeText, visibleAt } from './typewriter';

/** A clock that only moves when the test says so. */
function manualClock() {
  let t = 0;
  let q: (() => void)[] = [];
  const clock: Clock & { advance(ms: number): void; waiting(): number } = {
    now: () => t,
    frame: (cb) => { q.push(cb); },
    advance(ms) { t += ms; const cbs = q; q = []; cbs.forEach((c) => c()); },
    waiting: () => q.length,
  };
  return clock;
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const normal = PACES.normal;

describe('pace', () => {
  it('instant and reduced motion turn every effect off', () => {
    expect(paceFor('instant')).toBe(INSTANT);
    expect(paceFor('normal', true)).toBe(INSTANT);
    expect(INSTANT.think + INSTANT.load + INSTANT.beat + INSTANT.line).toBe(0);
  });
  it('speeds are ordered', () => {
    expect(PACES.slow.cps).toBeLessThan(PACES.normal.cps);
    expect(PACES.normal.cps).toBeLessThan(PACES.fast.cps);
    // A comfortable default: slow enough to read along, fast enough not to drag.
    expect(PACES.normal.cps).toBeGreaterThanOrEqual(30);
    expect(PACES.normal.cps).toBeLessThanOrEqual(60);
  });
  it('every loading effect stays around a second or less', () => {
    for (const p of Object.values(PACES)) expect(p.load).toBeLessThanOrEqual(1000);
  });
});

describe('timeline', () => {
  it('is all zeros when instant', () => {
    expect(timeline('Hello there.', INSTANT)).toEqual(new Array(12).fill(0));
  });
  it('types one character per step and grows monotonically', () => {
    const tl = timeline('abcdef', normal);
    expect(tl).toHaveLength(6);
    expect(tl[0]).toBeCloseTo(1000 / normal.cps);
    for (let i = 1; i < tl.length; i++) expect(tl[i]).toBeGreaterThan(tl[i - 1]);
  });
  it('pauses after a sentence, not inside "e.g." or a decimal', () => {
    const step = 1000 / normal.cps;
    const gap = (s: string, i: number) => { const tl = timeline(s, normal); return tl[i + 1] - tl[i]; };
    expect(gap('Done. Next', 4)).toBeCloseTo(step + normal.sentence);
    expect(gap('Why? Because', 3)).toBeCloseTo(step + normal.sentence);
    expect(gap('e.g. this', 3)).toBeCloseTo(step);
    expect(gap('0.5 s', 1)).toBeCloseTo(step);
    expect(gap('a, b', 1)).toBeCloseTo(step + normal.clause);
  });
  it('rate speeds it up proportionally', () => {
    expect(duration(timeline('Hello. World', normal, 2))).toBeCloseTo(duration(timeline('Hello. World', normal)) / 2);
  });
  it('visibleAt counts characters shown so far', () => {
    const tl = [10, 20, 30];
    expect(visibleAt(tl, 0)).toBe(0);
    expect(visibleAt(tl, 10)).toBe(1);
    expect(visibleAt(tl, 25)).toBe(2);
    expect(visibleAt(tl, 99)).toBe(3);
  });
});

describe('animate and skip', () => {
  it('runs to the end on its own', async () => {
    const c = manualClock();
    const seen: number[] = [];
    let done = false;
    void animate(100, (ms) => seen.push(ms), { skip: false }, c).then(() => (done = true));
    c.advance(40);
    c.advance(40);
    await flush();
    expect(done).toBe(false);
    c.advance(40);
    await flush();
    expect(done).toBe(true);
    expect(seen.at(-1)).toBe(100);
  });
  it('a skip finishes it on the next frame', async () => {
    const c = manualClock();
    const tk: Token = { skip: false };
    let last = -1, done = false;
    void animate(10_000, (ms) => (last = ms), tk, c).then(() => (done = true));
    c.advance(16);
    expect(last).toBe(16);
    tk.skip = true;
    c.advance(16);
    await flush();
    expect(last).toBe(10_000);
    expect(done).toBe(true);
  });
  it('an already-skipped token completes synchronously', async () => {
    let last = -1;
    await animate(500, (ms) => (last = ms), { skip: true }, manualClock());
    expect(last).toBe(500);
  });
});

describe('typeText', () => {
  it('reveals text across several pieces in order, and skipping shows everything', async () => {
    const c = manualClock();
    const a = { data: 'Hello ' }, b = { data: 'world' };
    const tk: Token = { skip: false };
    const p = typeText([{ node: a, full: 'Hello ' }, { node: b, full: 'world' }], normal, tk, { clock: c });
    expect(a.data + b.data).toBe(''); // blanked before the first frame
    c.advance((1000 / normal.cps) * 3 + 1);
    expect(a.data).toBe('Hel');
    expect(b.data).toBe('');
    tk.skip = true;
    c.advance(1);
    await p;
    expect(a.data + b.data).toBe('Hello world');
  });
  it('is immediate at instant speed', async () => {
    const a = { data: 'x' };
    await typeText([{ node: a, full: 'Everything at once.' }], INSTANT, { skip: false }, { clock: manualClock() });
    expect(a.data).toBe('Everything at once.');
  });
});

describe('revealSteps', () => {
  it('shows the first line at once, then one line per interval', async () => {
    const c = manualClock();
    let k = 0;
    const p = revealSteps(4, 50, (n) => (k = n), { skip: false }, c);
    expect(k).toBe(1);
    c.advance(50);
    expect(k).toBe(2);
    c.advance(100);
    await p;
    expect(k).toBe(4);
  });

  it('shows everything at once at instant pace and never shows a NaN count', async () => {
    const c = manualClock();
    const seen: number[] = [];
    await revealSteps(5, INSTANT.line, (n) => seen.push(n), { skip: false }, c);
    c.advance(100);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((n) => n === 5)).toBe(true);
  });
});

describe('Output queue', () => {
  it('plays messages one after another', async () => {
    const order: string[] = [];
    const q = new Output();
    void q.push(async () => { await flush(); order.push('a'); });
    void q.push(() => { order.push('b'); });
    await q.idle();
    expect(order).toEqual(['a', 'b']);
  });

  it('a key press finishes only the current message; the next one types normally', async () => {
    const c = manualClock();
    const q = new Output();
    const tokens: Token[] = [];
    const msg = () => q.push((tk) => { tokens.push(tk); return animate(1000, () => {}, tk, c); });
    const first = msg(), second = msg();
    await flush();
    c.advance(10);
    q.skip(); // the player presses a key
    c.advance(10);
    await first;
    await flush();
    expect(tokens).toHaveLength(2);
    expect(tokens[0].skip).toBe(true);
    expect(tokens[1].skip).toBe(false); // "a second press moves on": the next message is not pre-skipped
    q.skip();
    c.advance(10);
    await second;
  });

  it('skipAll flushes everything already queued, then later messages type again', async () => {
    const c = manualClock();
    const q = new Output();
    const tokens: Token[] = [];
    for (let i = 0; i < 3; i++) void q.push((tk) => { tokens.push(tk); return animate(1000, () => {}, tk, c); });
    await flush();
    q.skipAll();
    // The player navigated to a new lesson: its output is queued before the old output has drained.
    void q.push((tk) => { tokens.push(tk); });
    c.advance(1);
    await q.idle();
    expect(tokens.map((t) => t.skip)).toEqual([true, true, true, false]);
  });

  it('reports busy while anything is queued', async () => {
    const states: boolean[] = [];
    const q = new Output((b) => states.push(b));
    void q.push(() => {});
    void q.push(() => {});
    expect(q.busy).toBe(true);
    await q.idle();
    expect(q.busy).toBe(false);
    expect(states).toEqual([true, false]);
  });

  it('renders instantly when the terminal is not on screen', async () => {
    const q = new Output(() => {}, () => true);
    let skipped = false;
    await q.push((tk) => { skipped = tk.skip; });
    expect(skipped).toBe(true);
  });

  it('a failing message does not jam the queue', async () => {
    const q = new Output();
    const err = console.error;
    console.error = () => {};
    let ran = false;
    void q.push(() => { throw new Error('boom'); });
    await q.push(() => { ran = true; });
    console.error = err;
    expect(ran).toBe(true);
  });
});

describe('keys while TAPEOUT is typing', () => {
  it('keeps characters typed early instead of losing them', () => {
    expect(heldKey('4', {}, '')).toEqual({ skip: true, value: '4', prevent: true });
    expect(heldKey('2', {}, '4')?.value).toBe('42');
    expect(heldKey('Backspace', {}, '42')?.value).toBe('4');
  });
  it('Enter only finishes the message; it never submits', () => {
    expect(heldKey('Enter', {}, '42')).toEqual({ skip: true, value: '42', prevent: true });
  });
  it('a leading space is just a skip, not part of the answer', () => {
    expect(heldKey(' ', {}, '')?.value).toBe('');
    expect(heldKey(' ', {}, 'a')?.value).toBe('a ');
  });
  it('leaves modifiers and shortcuts alone (copying text still works)', () => {
    expect(heldKey('Shift', {}, '')).toBeNull();
    expect(heldKey('c', { ctrl: true }, '')).toBeNull();
    expect(heldKey('c', { meta: true }, '')).toBeNull();
  });
});

// The typewriter: how TAPEOUT's words, code, menus and loading screens appear over time.
// The timing and skip logic is pure (clock injected) so it can be tested without a browser.

export type Speed = 'slow' | 'normal' | 'fast' | 'instant';

/** Everything time-related, in characters per second and milliseconds. */
export interface Pace {
  cps: number;
  /** Pause after a sentence. */
  sentence: number;
  /** Pause after a comma, semicolon, colon or line break. */
  clause: number;
  /** Delay between lines of code, diagrams and menu rows. */
  line: number;
  /** Pause before a question and before the answer prompt. */
  beat: number;
  /** "thinking…" before a reply to the player. */
  think: number;
  /** Spinners, progress bars and level intros. */
  load: number;
}

export const PACES: Record<Exclude<Speed, 'instant'>, Pace> = {
  slow: { cps: 22, sentence: 420, clause: 140, line: 110, beat: 450, think: 750, load: 1000 },
  normal: { cps: 40, sentence: 260, clause: 90, line: 65, beat: 320, think: 550, load: 750 },
  fast: { cps: 90, sentence: 120, clause: 40, line: 30, beat: 160, think: 300, load: 400 },
};
export const INSTANT: Pace = { cps: Infinity, sentence: 0, clause: 0, line: 0, beat: 0, think: 0, load: 0 };

export function paceFor(speed: Speed, reducedMotion = false): Pace {
  if (reducedMotion || speed === 'instant') return INSTANT;
  return PACES[speed] ?? PACES.normal;
}

/** The Settings.app override wins over the system's reduced-motion flag (set on <html> by applyDisplayPrefs). */
export const prefersReducedMotion = () => {
  const o = typeof document !== 'undefined' ? document.documentElement.dataset.motion : undefined;
  if (o) return o === 'reduce';
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const SENTENCE_START = /[A-Z0-9"'(*`[{]/;

/**
 * When each character of `text` becomes visible (ms from the start). Sentence ends and clause breaks add pauses;
 * a period followed by a lowercase word ("e.g. this", "0.5 s") does not. `rate` speeds everything up (system text).
 */
export function timeline(text: string, p: Pace, rate = 1): number[] {
  const n = text.length;
  if (!Number.isFinite(p.cps)) return new Array<number>(n).fill(0);
  const step = 1000 / (p.cps * rate);
  const out = new Array<number>(n);
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += step;
    out[i] = t;
    const c = text[i], next = text[i + 1];
    if (next === undefined) break;
    if (c === '\n') { t += p.clause / rate; continue; }
    if (!/\s/.test(next)) continue;
    if (c === '!' || c === '?') t += p.sentence / rate;
    else if (c === '.') {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      if (j >= n || SENTENCE_START.test(text[j])) t += p.sentence / rate;
    } else if (c === ',' || c === ';' || c === ':') t += p.clause / rate;
  }
  return out;
}

/** How many characters are visible `ms` into a timeline. */
export function visibleAt(tl: number[], ms: number): number {
  let lo = 0, hi = tl.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tl[mid] <= ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const duration = (tl: number[]) => (tl.length ? tl[tl.length - 1] : 0);

// ---------------------------------------------------------------- animation with skip

/** One message's skip switch: a key press or click sets it, and the message finishes instantly. */
export interface Token { skip: boolean }

export interface Clock { now(): number; frame(cb: () => void): void }

export const realClock: Clock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  frame: (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => cb()) : setTimeout(cb, 16)),
};

/** Call `step(elapsed)` every frame for `total` ms. Skipping jumps straight to `step(total)`. */
export function animate(total: number, step: (ms: number) => void, tk: Token, clock: Clock = realClock): Promise<void> {
  if (tk.skip || !(total > 0)) { step(Math.max(0, total)); return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = clock.now();
    const tick = () => {
      const ms = tk.skip ? total : Math.min(total, clock.now() - t0);
      step(ms);
      if (ms >= total) resolve();
      else clock.frame(tick);
    };
    clock.frame(tick);
  });
}

export const wait = (ms: number, tk: Token, clock: Clock = realClock) => animate(ms, () => {}, tk, clock);

/** Anything with a mutable `data` string: a DOM Text node, or a plain object in tests. */
export interface TextSink { data: string }

/** Type text into a list of sinks in order, as one continuous message. */
export function typeText(targets: { node: TextSink; full: string }[], p: Pace, tk: Token, opts: { rate?: number; clock?: Clock; onStep?: (shown: number) => void } = {}): Promise<void> {
  const tl = timeline(targets.map((t) => t.full).join(''), p, opts.rate ?? 1);
  for (const t of targets) t.node.data = '';
  return animate(duration(tl), (ms) => {
    const shown = visibleAt(tl, ms);
    let n = shown;
    for (const t of targets) {
      const k = Math.max(0, Math.min(t.full.length, n));
      if (t.node.data.length !== k) t.node.data = t.full.slice(0, k);
      n -= t.full.length;
    }
    opts.onStep?.(shown);
  }, tk, opts.clock);
}

/** Reveal `count` items one per `interval` ms (lines of code, menu rows). `show(k)` shows the first k. */
export function revealSteps(count: number, interval: number, show: (k: number) => void, tk: Token, clock?: Clock): Promise<void> {
  // Instant (or skipped): show everything now. Stopping here matters: with interval 0, step(0) would be 0/0 = NaN.
  if (tk.skip || interval <= 0) { show(count); return Promise.resolve(); }
  show(Math.min(count, 1));
  if (count <= 1) return Promise.resolve();
  return animate((count - 1) * interval, (ms) => show(Math.min(count, 1 + Math.floor(ms / interval))), tk, clock);
}

// ---------------------------------------------------------------- the output queue

/**
 * Messages play one after another. `skip()` finishes only the message playing now (the next one then types
 * normally); `skipAll()` flushes everything already queued (used when the player navigates away).
 */
export class Output {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private current: Token | null = null;
  private seq = 0;
  /** Messages numbered up to this one play instantly (they were queued before a skipAll). */
  private flushTo = 0;

  constructor(private onBusy: (busy: boolean) => void = () => {}, private instant: () => boolean = () => false) {}

  get busy() { return this.pending > 0; }

  push(task: (tk: Token) => Promise<void> | void): Promise<void> {
    if (++this.pending === 1) this.onBusy(true);
    const id = ++this.seq;
    const run = async () => {
      const tk: Token = { skip: id <= this.flushTo || this.instant() };
      this.current = tk;
      try { await task(tk); } catch (e) { console.error(e); } finally {
        this.current = null;
        if (--this.pending === 0) this.onBusy(false);
      }
    };
    const p = this.tail.then(run);
    this.tail = p;
    return p;
  }

  skip() { if (this.current) this.current.skip = true; }

  /** Finish everything queued so far at once. Messages pushed afterwards type normally. */
  skipAll() {
    this.flushTo = this.seq;
    this.skip();
  }

  /** Resolves once everything queued so far has played. */
  idle(): Promise<void> { return this.tail; }
}

// ---------------------------------------------------------------- keys while TAPEOUT is typing

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'NumLock', 'ScrollLock']);

/**
 * What a key press does while the answer input is locked (TAPEOUT is still typing). Any real key finishes the
 * current message. Printable characters are kept for the answer (nothing typed early is lost), Backspace edits
 * them, and Enter never submits. Returns null for keys that should be left alone (modifiers, shortcuts).
 */
export function heldKey(key: string, mods: { ctrl?: boolean; meta?: boolean; alt?: boolean }, value: string): { skip: true; value: string; prevent: boolean } | null {
  if (mods.ctrl || mods.meta || mods.alt || MODIFIER_KEYS.has(key)) return null;
  if (key === 'Backspace') return { skip: true, value: value.slice(0, -1), prevent: true };
  if (key.length === 1 && !(key === ' ' && !value)) return { skip: true, value: value + key, prevent: true };
  return { skip: true, value, prevent: key === 'Enter' || key === ' ' || key === 'Escape' };
}

// ---------------------------------------------------------------- DOM helpers

/** Every text node under `root`, in reading order, with its full text. */
export function textTargets(root: Node): { node: Text; full: string }[] {
  const out: { node: Text; full: string }[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push({ node: n as Text, full: (n as Text).data });
  return out;
}

/** Items that stay hidden until the typing reaches their first character (so options never show as empty boxes). */
const ITEMS = 'li, tr, .choice, .term-opt';

/** Type every piece of text inside an element. Buttons inside stay unclickable until it finishes. */
/** A finished line as a screen reader should hear it: no spinner or bar glyphs, single spaces. */
export const spokenLine = (text: string) => text.replace(/[⠀-⣿█░]/g, '').replace(/\s+/g, ' ').trim();

export async function typeInto(el: HTMLElement, p: Pace, tk: Token, opts: { rate?: number; onStep?: () => void } = {}) {
  const targets = textTargets(el);
  const starts: number[] = [];
  targets.reduce((at, t) => (starts.push(at), at + t.full.length), 0);
  const items = [...el.querySelectorAll<HTMLElement>(ITEMS)].map((item) => {
    const i = targets.findIndex((t) => item.contains(t.node));
    return { item, start: i < 0 ? 0 : starts[i] };
  }).filter((x) => x.start > 0);
  items.forEach((x) => x.item.classList.add('tw-hide'));
  el.classList.add('tw-live');
  // The animated copy is hidden from screen readers while it types; the finished line is announced once instead.
  el.setAttribute('aria-hidden', 'true');
  try {
    await typeText(targets, p, tk, {
      rate: opts.rate,
      onStep: (shown) => {
        for (const x of items) if (shown > x.start) x.item.classList.remove('tw-hide');
        opts.onStep?.();
      },
    });
  } finally {
    items.forEach((x) => x.item.classList.remove('tw-hide'));
    el.classList.remove('tw-live');
    el.removeAttribute('aria-hidden');
  }
}

/** Reveal rows (table rows, list items, menu entries) one at a time. */
export async function revealRows(rows: HTMLElement[], p: Pace, tk: Token, onStep?: () => void) {
  rows.forEach((r) => r.classList.add('tw-hide'));
  await revealSteps(rows.length, p.line, (k) => { rows.slice(0, k).forEach((r) => r.classList.remove('tw-hide')); onStep?.(); }, tk);
}

/** Reveal a <pre> (code, logs, schematics) line by line. */
export async function revealPre(pre: HTMLElement, p: Pace, tk: Token, onStep?: () => void) {
  const lines = (pre.textContent ?? '').split('\n');
  await revealSteps(lines.length, p.line, (k) => { pre.textContent = lines.slice(0, k).join('\n'); onStep?.(); }, tk);
}

/** A stand-alone typing job for pages outside the terminal: any key or click on `surface` finishes it. */
export function typeOnPage(el: HTMLElement, p: Pace, surface: HTMLElement, opts: { rate?: number } = {}): Promise<void> {
  const tk: Token = { skip: false };
  const skip = (e: Event) => {
    if (e instanceof KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab' || e.key === 'Shift') return;
      // Keys only count when this page's window is the one in front.
      const win = surface.closest('.win');
      if (win && !win.classList.contains('focused')) return;
    }
    tk.skip = true;
    if (e.type === 'click') { e.preventDefault(); e.stopPropagation(); }
  };
  surface.addEventListener('click', skip, true);
  window.addEventListener('keydown', skip, true);
  return typeInto(el, p, tk, opts).finally(() => {
    surface.removeEventListener('click', skip, true);
    window.removeEventListener('keydown', skip, true);
  });
}

/** Braille spinner frames. */
export const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
export const spinFrame = (ms: number) => SPIN[Math.floor(ms / 80) % SPIN.length];
export const progressBar = (frac: number, n = 16) => '█'.repeat(Math.round(Math.min(1, Math.max(0, frac)) * n)).padEnd(n, '░');

// A terminal widget with an async API, so conversations read top to bottom:
//   await term.say('Hello'); const name = await term.ask({ prompt: 'name>' });
// Everything printed goes through one output queue and is typed out (see typewriter.ts). A key press or a click
// finishes the message being typed; the answer input only unlocks once the question has finished typing.
import type { Mood } from '../lessons/types';
import { setMood, setTalking } from '../os/avatar';
import { playerName, prefs } from '../state';
import { h } from '../ui/dom';
import { animate, heldKey, INSTANT, Output, type Pace, paceFor, prefersReducedMotion, progressBar, revealPre, revealRows, spinFrame, spokenLine, type Token, typeInto, wait } from './typewriter';

export class Interrupted extends Error {
  constructor() { super('interrupted'); }
}

/** The player typed a command at a menu instead of picking an option; the shell runs it next. */
export class Redirect extends Interrupted {}

/** While a lesson is replayed up to a resume point (U29), everything prints at once: no typing, no pauses. */
let fastForward = false;
export const setFastForward = (on: boolean) => { fastForward = on; };
export const pace = (): Pace => (fastForward ? INSTANT : paceFor(prefs().speed, prefersReducedMotion()));

export interface Span { kind: 'text' | 'b' | 'code'; text: string }

/**
 * Splits TAPEOUT's markup (**bold**, `code`, {name}) into spans. Markup is parsed first and the name is put in last,
 * so a name with `$&`, `**` or backticks shows exactly as typed.
 */
export function richSpans(text: string, name: string): Span[] {
  const out: Span[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { kind: 'b', text: m[1] } : { kind: 'code', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out.map((s) => ({ ...s, text: s.text.split('{name}').join(name) }));
}

/** Inline markup for TAPEOUT's lines, as DOM nodes. */
export function rich(text: string): Node[] {
  return richSpans(text, playerName()).map((s) => (s.kind === 'text' ? document.createTextNode(s.text) : h(s.kind, null, s.text)));
}

export interface AskOpts { prompt?: string; chips?: (string | { label: string; value: string })[]; placeholder?: string }

/** How a block appears: typed character by character, revealed row by row, or at once. */
export type BlockMode = 'type' | 'rows' | 'instant';

/** Rows for row-by-row reveal: table rows, list items and menu entries, else the block's children. */
function rowsOf(node: HTMLElement): HTMLElement[] {
  const rows = [...node.querySelectorAll<HTMLElement>('tr, li, .term-mod, .term-act, .term-ch > .dim')];
  return rows.length ? rows : [...node.children] as HTMLElement[];
}

export class Terminal {
  el: HTMLElement;
  private out: HTMLElement;
  private live: HTMLElement;
  private input: HTMLInputElement;
  private promptEl: HTMLElement;
  private chipsEl: HTMLElement;
  private resolver: ((v: string) => void) | null = null;
  private rejecter: ((e: Error) => void) | null = null;
  private askGen = 0;
  /** An interrupt arrived while nothing was waiting for input: the next ask() gives way at once. */
  private interruptPending = false;
  private accepting = false;
  /** The next thing TAPEOUT says is a reply to the player: show "thinking…" first. */
  private afterInput = false;
  /** TAPEOUT has output something since the last prompt: pause for a beat before the next one. */
  private spoke = false;
  private history: string[] = [];
  private hIndex = 0;
  private q: Output;

  constructor() {
    // The visible transcript is typed a character at a time, so it is not live: screen readers would hear fragments.
    // Each finished line is written once to the visually hidden log instead (see announce).
    this.out = h('div', { class: 'term-out', role: 'log', 'aria-live': 'off' });
    this.live = h('div', { class: 'sr-only', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    this.promptEl = h('span', { class: 'term-prompt' });
    this.input = h('input', { class: 'term-input', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Terminal input', autocapitalize: 'off' }) as HTMLInputElement;
    this.input.readOnly = true;
    this.chipsEl = h('div', { class: 'term-chips' });
    const line = h('div', { class: 'term-line' }, this.promptEl, this.input);
    this.el = h('div', { class: 'term', tabindex: '-1' }, this.out, line, this.chipsEl, this.live);
    this.q = new Output((busy) => this.onBusy(busy), () => !this.el.isConnected);
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      if (window.getSelection()?.toString()) return;
      this.q.skip();
      this.focus();
    });
    this.el.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Focus the input if a question is waiting; otherwise the terminal itself, so key presses still skip. */
  focus() {
    (this.accepting ? this.input : this.el).focus({ preventScroll: true });
  }

  /** True while TAPEOUT is typing something. */
  get typing() { return this.q.busy; }

  private onBusy(busy: boolean) {
    this.el.classList.toggle('typing', busy);
    if (busy && !this.accepting) {
      if (document.activeElement === this.input) this.el.focus({ preventScroll: true });
      if (!this.input.value) this.input.placeholder = 'any key or click finishes the line';
    } else if (!busy && !this.accepting && this.input.placeholder === 'any key or click finishes the line') this.input.placeholder = '';
  }

  private onKey(e: KeyboardEvent) {
    if (this.accepting && e.target === this.input) return this.onInputKey(e);
    // TAPEOUT is typing (or busy elsewhere): a key finishes the current message. Typed characters are kept for the
    // answer, and Enter never submits.
    const act = heldKey(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey }, this.input.value);
    if (!act) return;
    this.q.skip();
    if (act.prevent) e.preventDefault();
    if (act.value !== this.input.value) { this.input.value = act.value; this.input.placeholder = ''; }
  }

  private onInputKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submit(this.input.value);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!this.history.length) return;
      e.preventDefault();
      this.hIndex = Math.max(0, Math.min(this.history.length, this.hIndex + (e.key === 'ArrowUp' ? -1 : 1)));
      this.input.value = this.history[this.hIndex] ?? '';
    } else if (e.key === 'Tab') {
      const first = this.chipsEl.querySelector('button');
      if (first && !this.input.value) { e.preventDefault(); (first as HTMLButtonElement).click(); }
    }
  }

  private submit(v: string) {
    const res = this.resolver;
    if (!res || !this.accepting) return;
    this.resolver = this.rejecter = null;
    this.accepting = false;
    this.input.readOnly = true;
    this.el.classList.remove('waiting');
    const echo = h('div', { class: 'tl' }, h('span', { class: 'term-prompt' }, this.promptEl.textContent ?? ''), h('span', { class: 'you' }, ` ${v}`));
    this.append(echo);
    if (v.trim()) { this.history.push(v); this.hIndex = this.history.length; this.announce(echo); }
    this.input.value = '';
    this.input.placeholder = '';
    this.chipsEl.replaceChildren();
    this.afterInput = true;
    res(v);
  }

  private scroll() {
    requestAnimationFrame(() => (this.out.scrollTop = this.out.scrollHeight));
  }

  private append(node: Node) {
    this.out.append(node);
    this.scroll();
  }

  private readonly step = () => this.scroll();

  private push(task: (tk: Token) => Promise<void> | void): Promise<void> {
    this.spoke = true;
    return this.q.push(async (tk) => {
      const last = this.out.lastElementChild;
      try { await task(tk); } finally { this.announceSince(last); }
    });
  }

  /** Every line that appeared after `last` is written to the hidden log, once, now that it is finished. */
  private announceSince(last: Element | null) {
    for (let n = last ? last.nextElementSibling : this.out.firstElementChild; n; n = n.nextElementSibling) this.announce(n as HTMLElement);
  }

  private announce(node: HTMLElement) {
    const text = spokenLine(node.innerText || node.textContent || '');
    if (!text) return;
    this.live.append(h('div', null, text));
    // The log is for a session's worth of reading, not an archive.
    while (this.live.childElementCount > 300) this.live.firstElementChild?.remove();
  }

  // ---------------------------------------------------------------- output (all queued, all typed)

  /** A line of arbitrary content (buttons, chips), shown as soon as its turn comes. */
  line(...content: (Node | string)[]): Promise<void> {
    return this.push(() => this.append(h('div', { class: 'tl' }, ...content)));
  }

  /** System output, typed faster than TAPEOUT's speech. */
  print(text: string, cls = 'sys'): Promise<void> {
    return this.push(async (tk) => {
      const span = h('span', { class: cls }, ...rich(text));
      this.append(h('div', { class: 'tl' }, span));
      await typeInto(span, pace(), tk, { rate: cls === 'ai-aside' ? 1 : 2.5, onStep: this.step });
    });
  }

  /** A block of UI. Menus and tables appear row by row; banners and cards are typed. */
  block(node: HTMLElement, mode: BlockMode = 'rows', rate = 2): Promise<void> {
    return this.push(async (tk) => {
      this.afterInput = false;
      this.append(node);
      if (mode === 'type') await typeInto(node, pace(), tk, { rate, onStep: this.step });
      else if (mode === 'rows') await revealRows(rowsOf(node), pace(), tk, this.step);
    });
  }

  /** Code, logs and diagrams: revealed line by line. */
  art(text: string, caption?: string): Promise<void> {
    return this.push(async (tk) => {
      const pre = h('pre', null, text);
      const cap = caption ? h('figcaption', null, caption) : null;
      this.append(h('figure', { class: 'term-art' }, pre, cap));
      await revealPre(pre, pace(), tk, this.step);
      if (cap) await typeInto(cap, pace(), tk, { rate: 2, onStep: this.step });
    });
  }

  clear(): Promise<void> {
    return this.q.push(() => this.out.replaceChildren());
  }

  /** A pause (before a question, between beats of a story). Skippable like everything else. */
  beat(ms?: number): Promise<void> {
    return this.q.push((tk) => wait(ms ?? pace().beat, tk));
  }

  /** A line from TAPEOUT, typed out. A reply to the player starts with a short "thinking…". */
  say(text: string, mood: Mood = 'neutral'): Promise<void> {
    return this.push(async (tk) => {
      const p = pace();
      setMood(mood);
      const body = h('span', { class: 'ai-text' });
      this.append(h('div', { class: 'tl' }, h('span', { class: 'ai-name' }, 'tapeout'), h('span', { class: 'ai-sep' }, '› '), body));
      if (this.afterInput && p.think > 0) {
        const dots = h('span', { class: 'ai-think' }, 'thinking');
        body.append(dots);
        await animate(p.think, (ms) => (dots.textContent = `thinking${'.'.repeat(1 + (Math.floor(ms / 180) % 3))}`), tk);
        dots.remove();
      }
      this.afterInput = false;
      const nodes = rich(text);
      body.append(...nodes);
      setTalking(true);
      try { await typeInto(body, p, tk, { onStep: this.step }); } finally { setTalking(false); }
    });
  }

  /** A spinner and progress bar ("generating problems", "loading level"). */
  progress(label: string): Promise<void> {
    return this.push(async (tk) => {
      this.afterInput = false;
      const p = pace();
      const spin = h('span', { class: 'spin' }, spinFrame(0));
      const barEl = h('span', { class: 'pbar' }, progressBar(0));
      this.append(h('div', { class: 'tl term-progress' }, spin, ' ', h('span', { class: 'dim' }, label), ' ', barEl));
      await animate(p.load, (ms) => { spin.textContent = spinFrame(ms); barEl.textContent = progressBar(p.load ? ms / p.load : 1); }, tk);
      spin.textContent = '✓';
      spin.classList.add('ok');
      barEl.textContent = progressBar(1);
    });
  }

  /** The TAPE-OS "entering boss" sequence. */
  bossIntro(title: string): Promise<void> {
    return this.push(async (tk) => {
      this.afterInput = false;
      const p = pace();
      const rows = ['loading boss.ko ............ ok', 'hints ...................... disabled', 'second attempts ............ disabled', 'grader ..................... armed']
        .map((t) => h('div', null, `> ${t}`));
      const enter = h('div', { class: 'enter' }, `ENTERING BOSS: ${title.toUpperCase()}`);
      const box = h('div', { class: 'boss-intro' }, ...rows, enter);
      this.append(box);
      await revealRows([...rows, enter], { ...p, line: p.load / 5 }, tk, this.step);
      if (!tk.skip && p.load) enter.classList.add('flash');
      await wait(p.load / 3, tk);
    });
  }

  // ---------------------------------------------------------------- input

  /** Wait for one line of input. The prompt unlocks after everything queued before it has been typed. */
  ask(opts: AskOpts = {}): Promise<string> {
    const gen = ++this.askGen;
    const spoke = this.spoke;
    this.spoke = false;
    if (this.interruptPending) { this.interruptPending = false; return Promise.reject(new Interrupted()); }
    return new Promise<string>((res, rej) => {
      this.resolver = res;
      this.rejecter = (e) => { this.accepting = false; this.input.readOnly = true; this.el.classList.remove('waiting'); this.askGen++; rej(e); };
      if (spoke) void this.q.push((tk) => wait(pace().beat, tk));
      void this.q.push(() => {
        if (gen !== this.askGen || !this.resolver) return;
        this.promptEl.textContent = opts.prompt ?? '>';
        this.input.placeholder = opts.placeholder ?? '';
        this.chipsEl.replaceChildren(...(opts.chips ?? []).map((c) => {
          const { label, value } = typeof c === 'string' ? { label: c, value: c } : c;
          return h('button', { class: 'term-chip', onclick: () => this.submit(value) }, label);
        }));
        this.accepting = true;
        this.input.readOnly = false;
        this.el.classList.add('waiting');
        const a = document.activeElement;
        if (a === document.body || a === null || this.el.contains(a)) {
          this.input.focus({ preventScroll: true });
          this.input.setSelectionRange(this.input.value.length, this.input.value.length);
        }
      });
    });
  }

  /** Numbered choices, typed out; answer by number, by clicking, or by typing the option text. */
  /**
   * `passthrough`: called with anything typed that is not an option (then the menu is abandoned via Redirect).
   * `other`: answers typed text that is not an option. Returns true if it did; otherwise the player gets "Pick 1-N".
   */
  async choose(options: string[], prompt = 'choose>', passthrough?: (text: string) => void, mode: BlockMode = 'type', other?: (text: string) => Promise<boolean>): Promise<number> {
    const list = h('ol', { class: 'term-choices' }, ...options.map((o, i) => h('li', null, h('button', { class: 'term-opt', onclick: () => this.submit(String(i + 1)) }, ...rich(o)))));
    void this.block(list, mode, 1.6);
    for (;;) {
      const v = (await this.ask({ prompt, placeholder: `1-${options.length}` })).trim().toLowerCase();
      const n = parseInt(v, 10);
      let idx = n >= 1 && n <= options.length && String(n) === v ? n - 1 : -1;
      if (idx < 0 && /^[a-z]$/.test(v)) idx = v.charCodeAt(0) - 97 < options.length ? v.charCodeAt(0) - 97 : -1;
      if (idx < 0) idx = options.findIndex((o) => o.toLowerCase().replace(/[*`]/g, '') === v);
      if (idx >= 0) {
        list.querySelectorAll('button').forEach((b, i) => { (b as HTMLButtonElement).disabled = true; if (i === idx) b.classList.add('picked'); });
        return idx;
      }
      if (['quit', 'exit', 'q'].includes(v)) throw new Interrupted();
      if (passthrough && v.length > 1 && !/^\d+$/.test(v)) {
        list.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
        passthrough(v);
        throw new Redirect();
      }
      if (other && await other(v)) continue;
      void this.print(`Pick 1-${options.length}.`, 'dim');
    }
  }

  /** Wait for Enter (or a click on "continue"). */
  async pause() {
    await this.ask({ prompt: '↵', chips: [{ label: 'continue ↵', value: '' }] });
    this.out.lastElementChild?.remove(); // drop the empty echo line
    this.afterInput = false;
    this.spoke = false;
  }

  /**
   * A lesson waits on a window (a minigame) for a while. The answer line is greyed out, so it does not look typeable,
   * and a status line with two buttons says what the lesson is waiting for. Clears itself when `done` settles.
   */
  async waitOn<T>(label: string, done: Promise<T>, actions: { open: () => void; skip: () => void }): Promise<T> {
    this.el.classList.add('paused');
    this.promptEl.textContent = '…';
    this.input.placeholder = `waiting for ${label}`;
    this.chipsEl.replaceChildren(h('div', { class: 'term-wait', role: 'status' },
      h('span', { class: 'dim' }, `waiting for ${label} · `),
      h('button', { class: 'term-chip inline', onclick: actions.open }, 'open it'), ' ',
      h('button', { class: 'term-chip inline', onclick: actions.skip }, 'skip the game')));
    try { return await done; } finally {
      this.el.classList.remove('paused');
      this.promptEl.textContent = '';
      this.input.placeholder = '';
      this.chipsEl.replaceChildren();
    }
  }

  /** Abort whatever the terminal is waiting for (used when the player navigates elsewhere). */
  /**
   * An interrupt that arrived while nothing was waiting is kept for the next question. A route that arrives during the
   * boot greeting leaves one behind, and it would knock out the lesson's first question. The shell calls this when it
   * starts a queued command, so a stale interrupt never reaches the new work.
   */
  dropPendingInterrupt() {
    this.interruptPending = false;
  }

  interrupt() {
    this.q.skipAll();
    const rej = this.rejecter;
    this.resolver = this.rejecter = null;
    this.chipsEl.replaceChildren();
    // Nobody is waiting yet (TAPEOUT is mid-sentence): make the next question give way instead.
    if (rej) rej(new Interrupted());
    else this.interruptPending = true;
  }
}

export type { Token };

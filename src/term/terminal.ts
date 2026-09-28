// A terminal widget with an async API, so conversations read top to bottom:
//   await term.say('Hello'); const name = await term.ask({ prompt: 'name>' });
import type { Mood } from '../lessons/types';
import { setMood, setTalking } from '../os/avatar';
import { playerName, prefs } from '../state';
import { h } from '../ui/dom';

export class Interrupted extends Error {
  constructor() { super('interrupted'); }
}

/** The player typed a command at a menu instead of picking an option; the shell runs it next. */
export class Redirect extends Interrupted {}

const SPEED: Record<string, number> = { slow: 0.035, normal: 0.08, fast: 0.22, instant: Infinity }; // chars per ms
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Inline markup for TAPEOUT's lines: **bold**, `code`, {name}. */
export function rich(text: string): Node[] {
  const t = text.replace(/\{name\}/g, playerName());
  const out: Node[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(document.createTextNode(t.slice(last, m.index)));
    out.push(m[1] !== undefined ? h('b', null, m[1]) : h('code', null, m[2]));
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push(document.createTextNode(t.slice(last)));
  return out;
}

export interface AskOpts { prompt?: string; chips?: (string | { label: string; value: string })[]; placeholder?: string }

export class Terminal {
  el: HTMLElement;
  private out: HTMLElement;
  private input: HTMLInputElement;
  private promptEl: HTMLElement;
  private chipsEl: HTMLElement;
  private resolver: ((v: string) => void) | null = null;
  private rejecter: ((e: Error) => void) | null = null;
  private skipTyping = false;
  private history: string[] = [];
  private hIndex = 0;

  constructor() {
    this.out = h('div', { class: 'term-out', role: 'log', 'aria-live': 'polite' });
    this.promptEl = h('span', { class: 'term-prompt' });
    this.input = h('input', { class: 'term-input', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Terminal input', autocapitalize: 'off' }) as HTMLInputElement;
    this.chipsEl = h('div', { class: 'term-chips' });
    const line = h('div', { class: 'term-line' }, this.promptEl, this.input);
    this.el = h('div', { class: 'term' }, this.out, line, this.chipsEl);
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      if (window.getSelection()?.toString()) return;
      this.skipTyping = true;
      this.focus();
    });
    this.input.addEventListener('keydown', (e) => this.onKey(e));
  }

  focus() {
    this.input.focus({ preventScroll: true });
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = this.input.value;
      if (!this.resolver) { this.skipTyping = true; return; }
      this.submit(v);
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
    if (!res) return;
    this.resolver = this.rejecter = null;
    this.echo(v);
    if (v.trim()) { this.history.push(v); this.hIndex = this.history.length; }
    this.input.value = '';
    this.chipsEl.replaceChildren();
    res(v);
  }

  private echo(v: string) {
    this.line(h('span', { class: 'term-prompt' }, this.promptEl.textContent ?? ''), h('span', { class: 'you' }, ` ${v}`));
  }

  private scroll() {
    requestAnimationFrame(() => (this.out.scrollTop = this.out.scrollHeight));
  }

  line(...content: (Node | string)[]): HTMLElement {
    const l = h('div', { class: 'tl' }, ...content);
    this.out.append(l);
    this.scroll();
    return l;
  }

  print(text: string, cls = 'sys') {
    return this.line(h('span', { class: cls }, ...rich(text)));
  }

  block(node: Node) {
    this.out.append(node);
    this.scroll();
  }

  art(text: string, caption?: string) {
    this.block(h('figure', { class: 'term-art' }, h('pre', null, text), caption ? h('figcaption', null, caption) : null));
  }

  clear() {
    this.out.replaceChildren();
  }

  /** A line from TAPEOUT, typed out. Enter or a click finishes it instantly. */
  async say(text: string, mood: Mood = 'neutral') {
    setMood(mood);
    const body = h('span', { class: 'ai-text' });
    this.line(h('span', { class: 'ai-name' }, 'tapeout'), h('span', { class: 'ai-sep' }, '› '), body);
    const nodes = rich(text);
    const speed = reducedMotion() ? Infinity : SPEED[prefs().speed] ?? SPEED.normal;
    if (speed === Infinity) { body.append(...nodes); this.scroll(); return; }
    // Build the DOM with empty text, then reveal characters over time.
    const targets: { node: Text; full: string }[] = [];
    for (const n of nodes) {
      if (n instanceof Text) { const t = document.createTextNode(''); body.append(t); targets.push({ node: t, full: n.data }); }
      else { const el = n as HTMLElement; const full = el.textContent ?? ''; el.textContent = ''; const t = document.createTextNode(''); el.append(t); body.append(el); targets.push({ node: t, full }); }
    }
    const total = targets.reduce((a, t) => a + t.full.length, 0);
    this.skipTyping = false;
    setTalking(true);
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        let budget = this.skipTyping || !this.el.isConnected ? total : Math.floor((now - t0) * speed);
        for (const t of targets) {
          const n = Math.min(t.full.length, Math.max(0, budget));
          if (t.node.data.length !== n) t.node.data = t.full.slice(0, n);
          budget -= t.full.length;
        }
        this.scroll();
        if (budget >= 0) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    setTalking(false);
  }

  /** Wait for one line of input. Chips are clickable shortcuts that submit their value. */
  ask(opts: AskOpts = {}): Promise<string> {
    this.promptEl.textContent = opts.prompt ?? '>';
    this.input.placeholder = opts.placeholder ?? '';
    this.chipsEl.replaceChildren(...(opts.chips ?? []).map((c) => {
      const { label, value } = typeof c === 'string' ? { label: c, value: c } : c;
      return h('button', { class: 'term-chip', onclick: () => this.submit(value) }, label);
    }));
    this.el.classList.add('waiting');
    return new Promise<string>((res, rej) => {
      this.resolver = (v) => { this.el.classList.remove('waiting'); res(v); };
      this.rejecter = (e) => { this.el.classList.remove('waiting'); rej(e); };
      if (document.activeElement === document.body || this.el.contains(document.activeElement)) this.focus();
    });
  }

  /** Numbered choices; answer by number, by clicking, or by typing the option text. */
  /** `passthrough`: called with anything typed that is not an option (then the menu is abandoned via Redirect). */
  async choose(options: string[], prompt = 'choose>', passthrough?: (text: string) => void): Promise<number> {
    const list = h('ol', { class: 'term-choices' }, ...options.map((o, i) => h('li', null, h('button', { class: 'term-opt', onclick: () => this.submit(String(i + 1)) }, ...rich(o)))));
    this.block(list);
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
      this.print(`Pick 1-${options.length}.`, 'dim');
    }
  }

  /** Wait for Enter (or a click on "continue"). */
  async pause() {
    await this.ask({ prompt: '↵', chips: [{ label: 'continue ↵', value: '' }] });
    this.out.lastElementChild?.remove(); // drop the empty echo line
  }

  /** Abort whatever the terminal is waiting for (used when the player navigates elsewhere). */
  interrupt() {
    this.skipTyping = true;
    const rej = this.rejecter;
    this.resolver = this.rejecter = null;
    this.chipsEl.replaceChildren();
    rej?.(new Interrupted());
  }
}

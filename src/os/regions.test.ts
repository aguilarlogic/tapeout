import { beforeAll, describe, expect, it, vi } from 'vitest';

// jsdom is not installed in this project, so this test brings a small DOM stand-in: just enough for h(), the window
// manager and the speech bubble to build a tree and report where each element sits. Layout (sizes, overlaps) is
// checked in a real browser instead; this test pins the structure: which region each window and bubble lives in.
vi.hoisted(() => {
  class FakeEl {
    readonly tag: string;
    parentElement: FakeEl | null = null;
    children: FakeEl[] = [];
    attrs = new Map<string, string>();
    style: Record<string, string> = {};
    dataset: Record<string, string> = {};
    clientWidth = 1280;
    clientHeight = 800;
    offsetLeft = 0;
    offsetTop = 0;
    offsetWidth = 0;
    scrollTop = 0;
    isText = false;
    text = '';
    private cls = new Set<string>();
    private handlers = new Map<string, Array<(e: unknown) => void>>();
    readonly classList: { add(...c: string[]): void; remove(...c: string[]): void; contains(c: string): boolean; toggle(c: string, force?: boolean): boolean };

    constructor(tag: string) {
      this.tag = tag;
      this.classList = {
        add: (...c) => c.forEach((x) => this.cls.add(x)),
        remove: (...c) => c.forEach((x) => this.cls.delete(x)),
        contains: (c) => this.cls.has(c),
        toggle: (c, force) => {
          const on = force ?? !this.cls.has(c);
          if (on) this.cls.add(c);
          else this.cls.delete(c);
          return on;
        },
      };
    }

    get className(): string { return [...this.cls].join(' '); }
    set className(v: string) { this.cls = new Set(v.split(/\s+/).filter(Boolean)); }
    get id(): string { return this.attrs.get('id') ?? ''; }
    get textContent(): string { return this.isText ? this.text : this.children.map((c) => c.textContent).join(''); }
    set textContent(v: string) { this.children = []; this.append(String(v)); }
    get isConnected(): boolean {
      let n: FakeEl = this;
      while (n.parentElement) n = n.parentElement;
      return n === (globalThis as unknown as { document: { body: FakeEl } }).document.body;
    }
    setAttribute(k: string, v: string) { this.attrs.set(k, v); if (k === 'class') this.className = v; }
    getAttribute(k: string) { return this.attrs.get(k) ?? null; }
    addEventListener(type: string, fn: (e: unknown) => void) { this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]); }
    removeEventListener(type: string, fn: (e: unknown) => void) { this.handlers.set(type, (this.handlers.get(type) ?? []).filter((f) => f !== fn)); }
    append(...nodes: Array<FakeEl | string>) {
      for (const n of nodes) {
        const c = typeof n === 'string' ? makeText(n) : n;
        c.remove();
        c.parentElement = this;
        this.children.push(c);
      }
    }
    replaceChildren(...nodes: Array<FakeEl | string>) {
      for (const c of this.children) c.parentElement = null;
      this.children = [];
      this.append(...nodes);
    }
    remove() {
      const p = this.parentElement;
      if (p) p.children = p.children.filter((c) => c !== this);
      this.parentElement = null;
    }
    contains(n: unknown): boolean {
      let x = n as FakeEl | null;
      while (x) {
        if (x === this) return true;
        x = x.parentElement;
      }
      return false;
    }
    closest(sel: string): FakeEl | null {
      let x: FakeEl | null = this;
      while (x) {
        if (matches(x, sel)) return x;
        x = x.parentElement;
      }
      return null;
    }
    querySelectorAll(sel: string): FakeEl[] {
      const out: FakeEl[] = [];
      const walk = (n: FakeEl) => {
        for (const c of n.children) {
          if (c.isText) continue;
          if (matches(c, sel)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel: string): FakeEl | null { return this.querySelectorAll(sel)[0] ?? null; }
    focus() { /* no focus model needed */ }
    setPointerCapture() { /* no pointer model needed */ }
  }

  // Compound selectors only (tag, .class, #id, [attr] or [attr='value']), which is all the code under test uses.
  function matches(el: FakeEl, sel: string): boolean {
    const parts = sel.match(/\.[\w-]+|#[\w-]+|\[[\w-]+(?:='[^']*')?\]|^[a-z][\w-]*/gi) ?? [];
    return parts.every((p) => {
      if (p.startsWith('.')) return el.classList.contains(p.slice(1));
      if (p.startsWith('#')) return el.id === p.slice(1);
      if (p.startsWith('[')) {
        const [k, v] = p.slice(1, -1).split('=');
        return v === undefined ? el.attrs.has(k) : el.attrs.get(k) === v.replace(/'/g, '');
      }
      return el.tag === p.toLowerCase();
    });
  }

  function makeText(s: string): FakeEl {
    const t = new FakeEl('#text');
    t.isText = true;
    t.text = s;
    return t;
  }

  const body = new FakeEl('body');
  const doc = {
    body,
    createElement: (tag: string) => new FakeEl(tag),
    createElementNS: (_ns: string, tag: string) => new FakeEl(tag),
    createTextNode: makeText,
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    addEventListener: () => {},
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.Node = FakeEl;
  g.document = doc;
  g.window = globalThis;
});

vi.mock('../term/terminal', () => ({
  pace: () => ({ load: 0, cps: 0, sentence: 0, clause: 0 }),
  rich: (text: string) => [document.createTextNode(text)],
}));
vi.mock('../term/typewriter', () => ({
  typeInto: () => Promise.resolve(),
  animate: () => Promise.resolve(),
  progressBar: () => '',
  spinFrame: () => '',
}));

import { buildRegions } from './regions';
import { mentorSay } from './mentor';
import { getWindow, initWM, openWindow } from './wm';

describe('desktop regions', () => {
  // The desktop is built once and shared: window and bubble state persists across these checks, in this order.
  const tasks = document.createElement('div');
  const shell = buildRegions();
  let term: HTMLElement;
  let lab: HTMLElement;

  beforeAll(() => {
    document.body.append(shell.desktop);
    initWM(tasks);
    term = openWindow({ id: 'term', title: 'tapeout — mentor', region: 'mentor', content: document.createElement('div') }).el;
    lab = openWindow({ id: 'lab', title: 'Logic — Half adder', content: document.createElement('div'), maximized: true }).el;
    mentorSay('Hello, {name}.');
  });

  it('has a mentor region and a workspace region side by side in the desktop', () => {
    const mentor = shell.desktop.querySelector("[data-region='mentor']");
    const workspace = shell.desktop.querySelector("[data-region='workspace']");
    expect(mentor).toBe(shell.mentor);
    expect(workspace).toBe(shell.workspace);
    expect(shell.mentor.parentElement).toBe(shell.desktop);
    expect(shell.workspace.parentElement).toBe(shell.desktop);
    expect(shell.desktop.children).toEqual([shell.mentor, shell.workspace]);
  });

  it('docks the terminal in the mentor region, where it has no window controls', () => {
    expect(term.parentElement).toBe(shell.mentor);
    expect(term.classList.contains('docked')).toBe(true);
    // Floating sizes and positions are left to the stylesheet, which fills the column.
    expect(term.style.left).toBeUndefined();
    expect(term.style.width).toBeUndefined();
    // Minimizing the docked terminal is a no-op: the mentor column stays on screen.
    getWindow('term')!.minimize();
    expect(term.classList.contains('min')).toBe(false);
  });

  it('opens a lab in the workspace region, never in the mentor region', () => {
    expect(lab.parentElement).toBe(shell.workspace);
    expect(lab.classList.contains('docked')).toBe(false);
    expect(lab.classList.contains('max')).toBe(true);
    expect(Array.from(shell.mentor.querySelectorAll('.win'), (w) => w.getAttribute('aria-label'))).toEqual(['tapeout — mentor']);
    expect(shell.workspace.querySelectorAll('.win.docked').length).toBe(0);
  });

  it('makes the mentor bubble a child of the mentor region, not of the workspace or the body', () => {
    const bubble = shell.mentor.querySelector('.mentor-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble!.parentElement).toBe(shell.mentor);
    expect(shell.workspace.querySelector('.mentor-bubble')).toBeNull();
    expect(Array.from(document.body.children).includes(bubble!)).toBe(false);
  });
});

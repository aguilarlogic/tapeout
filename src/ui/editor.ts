// A small code editor: a transparent textarea over a syntax-highlighted <pre>,
// with a line-number gutter and error-line marking.

import { h } from './dom';

const KW = /\b(module|endmodule|input|output|wire|reg|logic|integer|int|assign|always|always_comb|always_ff|always_latch|posedge|negedge|or|begin|end|if|else|case|casez|casex|endcase|default|for|parameter|localparam|unique|priority)\b/;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlight(src: string): string {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\b\d*'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ?_]+|\b\d[\d_]*\b|'[01xz]\b)|([A-Za-z_$][\w$]*)/g;
  let out = '';
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += `<span class="tk-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-num">${esc(m[2])}</span>`;
    else if (KW.test(m[3]) && m[3].match(KW)![0] === m[3]) out += `<span class="tk-kw">${m[3]}</span>`;
    else if (m[3].startsWith('$')) out += `<span class="tk-sys">${m[3]}</span>`;
    else out += esc(m[3]);
    last = re.lastIndex;
  }
  return out + esc(src.slice(last)) + '\n';
}

export interface Editor {
  el: HTMLElement;
  get value(): string;
  set value(v: string);
  markLines(errors: number[], warnings: number[]): void;
  focus(): void;
}

export function editor(initial: string, onChange: (v: string) => void, onRun: () => void): Editor {
  const gutter = h('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
  const pre = h('pre', { class: 'ed-hl', 'aria-hidden': 'true' });
  const ta = h('textarea', { class: 'ed-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Verilog source' });
  ta.value = initial;
  const body = h('div', { class: 'ed-body' }, pre, ta);
  const el = h('div', { class: 'editor' }, gutter, body);
  let marks = { err: new Set<number>(), warn: new Set<number>() };

  const render = () => {
    pre.innerHTML = highlight(ta.value);
    const n = ta.value.split('\n').length;
    gutter.innerHTML = Array.from({ length: n }, (_, i) => {
      const ln = i + 1;
      const cls = marks.err.has(ln) ? 'ln err' : marks.warn.has(ln) ? 'ln warn' : 'ln';
      return `<div class="${cls}">${ln}</div>`;
    }).join('');
  };
  const sync = () => {
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
    gutter.scrollTop = ta.scrollTop;
  };

  ta.addEventListener('input', () => {
    marks = { err: new Set(), warn: new Set() };
    render();
    sync();
    onChange(ta.value);
  });
  ta.addEventListener('scroll', sync);
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t } = ta;
      ta.setRangeText('  ', s, t, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      // keep indentation
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const indent = /^\s*/.exec(ta.value.slice(lineStart, s))![0];
      const extra = /\b(begin|case[zx]?)\s*$|\($/.test(ta.value.slice(lineStart, s)) ? '  ' : '';
      e.preventDefault();
      ta.setRangeText('\n' + indent + extra, s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
  render();

  return {
    el,
    get value() { return ta.value; },
    set value(v: string) { ta.value = v; marks = { err: new Set(), warn: new Set() }; render(); onChange(v); },
    markLines(errors, warnings) {
      marks = { err: new Set(errors), warn: new Set(warnings) };
      render();
      sync();
    },
    focus() { ta.focus(); },
  };
}

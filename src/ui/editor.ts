// A small code editor: a transparent textarea over a syntax-highlighted <pre>,
// with a line-number gutter and error-line marking.

import { h } from './dom';

const KW = /\b(module|endmodule|input|output|wire|reg|logic|integer|int|assign|always|always_comb|always_ff|always_latch|posedge|negedge|or|begin|end|if|else|case|casez|casex|endcase|default|for|parameter|localparam|unique|priority)\b/;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Syntax colours for a SPICE netlist: comments, directives, element names, numbers. */
export function highlightSpice(src: string): string {
  const num = /(?<![\w.])([+-]?\d+\.?\d*(?:e[+-]?\d+)?(?:meg|[tgkmunpf])?[a-zµ]*)(?![\w])/gi;
  return src.split('\n').map((line) => {
    if (line.trimStart().startsWith('*')) return `<span class="tk-com">${esc(line)}</span>`;
    const [, lead, head, rest] = /^(\s*)(\S*)(.*)$/.exec(line)!;
    const body = esc(rest).replace(num, '<span class="tk-num">$1</span>');
    return `${lead}<span class="${head.startsWith('.') ? 'tk-kw' : 'tk-sys'}">${esc(head)}</span>${body}`;
  }).join('\n') + '\n';
}

const PY_KW = new Set(['def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'pass', 'break', 'continue', 'class', 'lambda', 'try', 'except', 'finally', 'raise', 'assert', 'del', 'global', 'nonlocal', 'import', 'from', 'as']);
const C_KW = new Set(['if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default', 'struct', 'union', 'enum', 'typedef', 'sizeof', 'static', 'const', 'extern', 'void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'NULL']);

/** Colours comments, strings, numbers and keywords for a C-like or Python-like language. */
function highlightWords(src: string, kw: Set<string>, comment: string, strs: string): string {
  const re = new RegExp(`(${comment})|(${strs})|(\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?[uUlLfF]*\\b)|([A-Za-z_]\\w*)`, 'gm');
  let out = '', last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += `<span class="tk-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-num">${esc(m[3])}</span>`;
    else if (kw.has(m[4])) out += `<span class="tk-kw">${m[4]}</span>`;
    else out += esc(m[4]);
    last = re.lastIndex;
  }
  return out + esc(src.slice(last)) + '\n';
}

const STR = `"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'`;
export const highlightPy = (src: string) => highlightWords(src, PY_KW, '#[^\\n]*', `"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|${STR}`);
const TCL_KW = new Set(['set', 'puts', 'proc', 'if', 'elseif', 'else', 'while', 'for', 'foreach', 'return', 'break', 'continue', 'expr', 'catch', 'error', 'switch', 'incr', 'lappend', 'global', 'upvar', 'dict', 'regexp', 'regsub', 'string', 'lindex', 'llength', 'lsort', 'foreach_in_collection', 'get_cells', 'get_pins', 'get_attribute']);
export const highlightTcl = (src: string) => highlightWords(src, TCL_KW, '(?<=^|;)[ \\t]*#[^\\n]*', '"(?:\\\\[\\s\\S]|[^"\\\\])*"');
export const highlightC = (src: string) => highlightWords(src, C_KW, '//[^\\n]*|/\\*[\\s\\S]*?\\*/|^[ \\t]*#[^\\n]*', STR);

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

export interface EditorOptions { highlight?: (src: string) => string; label?: string }

export function editor(initial: string, onChange: (v: string) => void, onRun: () => void, opts: EditorOptions = {}): Editor {
  const gutter = h('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
  const pre = h('pre', { class: 'ed-hl', 'aria-hidden': 'true' });
  const ta = h('textarea', { class: 'ed-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': opts.label ?? 'Verilog source' });
  ta.value = initial;
  const body = h('div', { class: 'ed-body' }, pre, ta);
  const el = h('div', { class: 'editor' }, gutter, body);
  let marks = { err: new Set<number>(), warn: new Set<number>() };

  const render = () => {
    pre.innerHTML = (opts.highlight ?? highlight)(ta.value);
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

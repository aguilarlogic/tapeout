// POSIX regular expressions (basic and extended) translated to JavaScript, for grep, sed and awk.

const CLASSES: Record<string, string> = {
  alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z', lower: 'a-z', space: ' \\t\\n\\r\\f\\v', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: 'A-Za-z0-9_',
};

export class RegexError extends Error {}

/** Translate a POSIX pattern. In basic mode ( ) { } + ? | are literal and their backslashed forms are special (GNU behaviour). */
export function posixToJs(pat: string, extended: boolean): string {
  let out = '';
  let i = 0;
  const special = (c: string) => (extended ? '(){}+?|'.includes(c) : false);
  while (i < pat.length) {
    const c = pat[i];
    if (c === '\\') {
      const n = pat[i + 1];
      if (n === undefined) throw new RegexError('Trailing backslash');
      if ('(){}+?|'.includes(n)) out += extended ? '\\' + n : n;
      else if (n === '<' || n === '>') out += '\\b';
      else if (n === 'w' || n === 'W' || n === 's' || n === 'S' || n === 'b' || n === 'B' || n === 'd') out += '\\' + n;
      else if (/[1-9]/.test(n)) out += '\\' + n;
      else out += '\\' + n;
      i += 2;
      continue;
    }
    if (c === '[') {
      let j = i + 1;
      let cls = '[';
      if (pat[j] === '^') { cls += '^'; j++; }
      if (pat[j] === ']') { cls += '\\]'; j++; }
      for (; j < pat.length && pat[j] !== ']'; j++) {
        if (pat[j] === '[' && pat[j + 1] === ':') {
          const end = pat.indexOf(':]', j + 2);
          if (end < 0) throw new RegexError('Unmatched [');
          const name = pat.slice(j + 2, end);
          if (!(name in CLASSES)) throw new RegexError('Invalid character class name');
          cls += CLASSES[name];
          j = end + 1;
        } else if (pat[j] === '\\') cls += '\\\\';
        else if (pat[j] === '[') cls += '\\[';
        else cls += pat[j];
      }
      if (j >= pat.length) throw new RegexError('Unmatched [, [^, [:, [., or [=');
      out += cls + ']';
      i = j + 1;
      continue;
    }
    if ('(){}+?|'.includes(c)) { out += special(c) ? c : '\\' + c; i++; continue; }
    if (c === '*' && (i === 0 || (!extended && (pat[i - 1] === '(' && pat[i - 2] === '\\')))) { out += '\\*'; i++; continue; }
    if (c === '^' && !extended && i > 0 && !(pat[i - 1] === '(' && pat[i - 2] === '\\')) { out += '\\^'; i++; continue; }
    if (c === '$' && !extended && i < pat.length - 1 && !(pat[i + 1] === '\\' && (pat[i + 2] === ')' || pat[i + 2] === '|'))) { out += '\\$'; i++; continue; }
    if (c === '/') { out += '\\/'; i++; continue; }
    out += c;
    i++;
  }
  return out;
}

export function makeRegex(pat: string, opts: { extended?: boolean; ignoreCase?: boolean; global?: boolean; word?: boolean; fixed?: boolean } = {}): RegExp {
  let src = opts.fixed ? pat.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') : posixToJs(pat, !!opts.extended);
  if (opts.word) src = `\\b(?:${src})\\b`;
  try { return new RegExp(src, `${opts.ignoreCase ? 'i' : ''}${opts.global ? 'g' : ''}m`.replace('m', '')); } catch { throw new RegexError(`Invalid regular expression: ${pat}`); }
}

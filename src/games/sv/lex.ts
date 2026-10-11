// SystemVerilog testbench lexer with a small preprocessor (`define with arguments, `ifdef, `include of known files is not supported).
export class SvError extends Error { constructor(msg: string, public line: number) { super(msg); } }

export interface Tok { t: 'id' | 'num' | 'real' | 'str' | 'op' | 'eof'; v: string; line: number; /** sized literal parts */ w?: number; base?: string }

const OPS3 = ['<<<', '>>>', '===', '!==', '==?', '!=?', '<->', '->>', '::=', '|->', '|=>', '**=', '<<=', '>>=', "'{"];
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '->', '::', ':=', ':/', '##', '~&', '~|', '~^', '^~', '**', '.*', '@*'];

/** Expand `define macros (with and without arguments) and conditional blocks. */
export function preprocess(src: string, predefined: Record<string, string> = {}, macros = ''): string {
  const skip = macros ? macros.split('\n').length : 0;
  if (macros) src = macros + '\n' + src;
  const defs = new Map<string, { params: string[] | null; body: string }>();
  for (const [k, v] of Object.entries(predefined)) defs.set(k, { params: null, body: v });
  const lines = src.split('\n');
  const out: string[] = [];
  const stack: boolean[] = [];
  const active = () => stack.every(Boolean);
  const expand = (text: string, depth = 0): string => {
    if (depth > 20) throw new SvError('macro expansion too deep', 0);
    let result = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '"') { const e = text.indexOf('"', i + 1); const end = e < 0 ? text.length : e + 1; result += text.slice(i, end); i = end; continue; }
      if (text[i] === '`') {
        const m = /^`([A-Za-z_]\w*)/.exec(text.slice(i));
        if (m && defs.has(m[1])) {
          const d = defs.get(m[1])!;
          i += m[0].length;
          if (d.params) {
            while (text[i] === ' ') i++;
            if (text[i] !== '(') throw new SvError(`macro ${m[1]} needs arguments`, 0);
            // split arguments at top-level commas
            let depthP = 0, cur = '', j = i + 1;
            const args: string[] = [];
            for (; j < text.length; j++) {
              const c = text[j];
              if (c === '"') { const e = text.indexOf('"', j + 1); cur += text.slice(j, e + 1); j = e; continue; }
              if (c === '(' || c === '[' || c === '{') depthP++;
              if (c === ')' || c === ']' || c === '}') { if (depthP === 0 && c === ')') break; depthP--; }
              if (c === ',' && depthP === 0) { args.push(cur.trim()); cur = ''; } else cur += c;
            }
            args.push(cur.trim());
            i = j + 1;
            let body = d.body;
            d.params.forEach((p, k) => { body = body.replace(new RegExp(`\\b${p}\\b`, 'g'), () => args[k] ?? ''); });
            result += expand(body, depth + 1);
          } else result += expand(d.body, depth + 1);
          continue;
        }
      }
      result += text[i++];
    }
    return result;
  };
  for (let n = 0; n < lines.length; n++) {
    let line = lines[n];
    const m = /^\s*`(define|undef|ifdef|ifndef|else|endif|include|timescale)\b(.*)$/.exec(line);
    if (m) {
      const [, dir, rest] = m;
      if (dir === 'ifdef') stack.push(defs.has(rest.trim()));
      else if (dir === 'ifndef') stack.push(!defs.has(rest.trim()));
      else if (dir === 'else') stack[stack.length - 1] = !stack[stack.length - 1];
      else if (dir === 'endif') stack.pop();
      else if (active()) {
        if (dir === 'define') {
          // allow continuation lines ending in backslash
          let body = rest;
          while (body.trimEnd().endsWith('\\') && n + 1 < lines.length) { body = body.trimEnd().slice(0, -1) + ' ' + lines[++n]; out.push(''); }
          const dm = /^\s*([A-Za-z_]\w*)(\(([^)]*)\))?\s*(.*)$/.exec(body);
          if (!dm) throw new SvError('bad `define', n + 1);
          defs.set(dm[1], { params: dm[2] ? dm[3].split(',').map((x) => x.trim()).filter(Boolean) : null, body: dm[4] });
        } else if (dir === 'undef') defs.delete(rest.trim());
        else if (dir === 'include') { /* ignored: the library is built in */ }
      }
      out.push('');
      continue;
    }
    out.push(active() ? expand(line) : '');
  }
  return out.slice(skip).join('\n');
}

export function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (src.startsWith('//', i)) { while (i < n && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); const chunk = src.slice(i, e < 0 ? n : e + 2); line += (chunk.match(/\n/g) ?? []).length; i += chunk.length; continue; }
    if (c === '"') {
      let s = '';
      i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') {
          const e = src[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === '"' ? '"' : e === '%' ? '%%' : '\\' + e;
          i += 2;
        } else { if (src[i] === '\n') line++; s += src[i++]; }
      }
      if (i >= n) throw new SvError('unterminated string', line);
      i++;
      out.push({ t: 'str', v: s, line });
      continue;
    }
    // numbers: 12, 8'hFF, 'h1F, '0, '1, 1.5, 1e3, 10ns
    const sized = /^(\d[\d_]*)?'([sS])?([bBoOdDhH])\s*([0-9a-fA-FxXzZ_?]+)/.exec(src.slice(i));
    if (sized) { out.push({ t: 'num', v: sized[4].replace(/_/g, ''), w: sized[1] ? parseInt(sized[1].replace(/_/g, ''), 10) : undefined, base: sized[3].toLowerCase(), line }); i += sized[0].length; continue; }
    const fill = /^'([01xXzZ])(?![\w'])/.exec(src.slice(i));
    if (fill) { out.push({ t: 'num', v: fill[1], base: 'fill', line }); i += fill[0].length; continue; }
    const real = /^\d[\d_]*\.\d[\d_]*([eE][-+]?\d+)?|^\d[\d_]*[eE][-+]?\d+/.exec(src.slice(i));
    if (real) { out.push({ t: 'real', v: real[0].replace(/_/g, ''), line }); i += real[0].length; continue; }
    const dec = /^\d[\d_]*/.exec(src.slice(i));
    if (dec) {
      i += dec[0].length;
      const unit = /^(fs|ps|ns|us|ms|s)\b/.exec(src.slice(i));
      if (unit) { i += unit[0].length; out.push({ t: 'num', v: dec[0].replace(/_/g, ''), base: 'time', w: { fs: 0, ps: 0, ns: 1, us: 1000, ms: 1000000, s: 1000000000 }[unit[1]], line }); continue; }
      out.push({ t: 'num', v: dec[0].replace(/_/g, ''), base: 'd', line });
      continue;
    }
    const id = /^[`$]?[A-Za-z_][\w$]*/.exec(src.slice(i));
    if (id) { out.push({ t: 'id', v: id[0], line }); i += id[0].length; continue; }
    const op3 = OPS3.find((o) => src.startsWith(o, i));
    if (op3) { out.push({ t: 'op', v: op3, line }); i += op3.length; continue; }
    const op2 = OPS2.find((o) => src.startsWith(o, i));
    if (op2) { out.push({ t: 'op', v: op2, line }); i += 2; continue; }
    out.push({ t: 'op', v: c, line });
    i++;
  }
  out.push({ t: 'eof', v: '', line });
  return out;
}

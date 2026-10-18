import { describe, expect, it } from 'vitest';
import { RULES, type Rule } from './standards';

// Raw source text of every module, read at build time (so the test needs no file-system access).
const RAW = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Player-facing source: lessons, practice, incidents, glossary, mastery, terminal text, and the lab level files. */
const PLAYER = [
  /^src\/(lessons|practice|incidents|mastery|term)\/[^/]+\.ts$/,
  /^src\/glossary\.ts$/,
  /^src\/games\/.*\/levels[^/]*\.ts$/,
  /^src\/games\/uvm\/puzzles\.ts$/,
  /^src\/games\/coverage\/scenarios\.ts$/,
  /^src\/games\/spec\/[^/]+\.ts$/,
  /^src\/games\/[^/]+\/page\.ts$/,
];
const isCommentLine = (l: string) => { const t = l.trim(); return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'); };

export interface Finding { rule: string; file: string; line: number; text: string }

/** Run the rules over named sources. Exported for the self-tests below. */
export function lint(sources: { file: string; text: string }[], rules: Rule[]): Finding[] {
  const out: Finding[] = [];
  for (const r of rules) {
    const files = sources.filter((s) => !r.files || r.files.test(s.file));
    if (r.ban) {
      for (const s of files) s.text.split('\n').forEach((line, i) => {
        if (isCommentLine(line)) return;
        if (r.ban!.test(line) && !(r.unless && r.unless.test(line))) out.push({ rule: r.id, file: s.file, line: i + 1, text: line.trim().slice(0, 140) });
      });
    }
    if (r.require) {
      const cands = sources.filter((s) => r.require!.file.test(s.file));
      const ok = cands.some((s) => s.text.split('\n').some((l) => !isCommentLine(l) && r.require!.re.test(l)));
      if (!ok) out.push({ rule: r.id, file: cands[0]?.file ?? String(r.require.file), line: 0, text: `required text not found: ${r.require.re}` });
    }
  }
  return out;
}

describe('content lint: standards plan rules', () => {
  const sources = Object.entries(RAW)
    .map(([path, text]) => ({ file: path.replace(/^\//, ''), text }))
    .filter(({ file }) => !file.endsWith('.test.ts') && PLAYER.some((re) => re.test(file)));

  it('scans the player-facing files', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(sources.some((s) => s.file === 'src/glossary.ts')).toBe(true);
  });

  it('every rule has an id, a reason and something to check; ids are unique', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) { expect(r.why.length, r.id).toBeGreaterThan(3); expect(!!(r.ban || r.require), r.id).toBe(true); }
  });

  it('no rule fires on the current text', () => {
    const found = lint(sources, RULES);
    expect(found.map((f) => `${f.rule} ${f.file}:${f.line}  ${f.text}`), 'content lint findings').toEqual([]);
  });
});

describe('content lint: the checker itself', () => {
  const src = [{ file: 'src/lessons/a.ts', text: 'say: HBM is 1024-bit\n// 1024-bit in a comment\nsay: through HBM3E it is 1024-bit' }];
  it('a ban rule fires on a line, skips comments, and an unless exempts', () => {
    const rule: Rule = { id: 't', why: 'test rule', ban: /1024-bit/ };
    expect(lint(src, [rule]).map((f) => f.line)).toEqual([1, 3]);
    expect(lint(src, [{ ...rule, unless: /HBM3E/ }]).map((f) => f.line)).toEqual([1]);
    expect(lint(src, [{ ...rule, files: /practice/ }])).toEqual([]);
  });
  it('a require rule fires when the fact is missing and passes when present', () => {
    const need = (re: RegExp): Rule => ({ id: 'q', why: 'test rule', require: { file: /lessons\/a\.ts$/, re } });
    expect(lint(src, [need(/HBM4/)]).length).toBe(1);
    expect(lint(src, [need(/HBM3E/)])).toEqual([]);
  });
});

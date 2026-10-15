// A rough reading-grade estimate (Flesch-Kincaid) for the words the game speaks to a beginner. It is a guide, not a
// verdict: short sentences and short words lower it. Code, diagrams and markup are stripped first.

const strip = (t: string) => t
  .replace(/`[^`]*`/g, ' ')
  .replace(/\*\*|__|\*|_/g, '')
  .replace(/\{name\}/g, 'friend')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/[()\[\]{}]/g, ' ');

export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export interface Reading { words: number; sentences: number; grade: number; longest: string }

export function reading(texts: string[]): Reading {
  let words = 0, sentences = 0, syl = 0, longest = '', longestN = 0;
  for (const raw of texts) {
    for (const sent of strip(raw).split(/(?<=[.!?:])\s+|\n+/)) {
      const ws = sent.split(/\s+/).filter((w) => /[a-z]/i.test(w));
      if (ws.length < 2) continue;
      sentences++;
      words += ws.length;
      for (const w of ws) syl += syllables(w);
      if (ws.length > longestN) { longestN = ws.length; longest = sent.trim(); }
    }
  }
  if (!words || !sentences) return { words, sentences, grade: 0, longest };
  const grade = 0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59;
  return { words, sentences, grade: Math.round(grade * 10) / 10, longest };
}

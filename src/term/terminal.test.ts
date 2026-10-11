import { describe, expect, it } from 'vitest';
import { richSpans } from './terminal';

// The player's name is text, never markup or a replacement pattern: these names used to break TAPEOUT's lines.
describe('richSpans: player names', () => {
  it('inserts a name containing $ patterns literally', () => {
    expect(richSpans('Hello {name}.', '$&')).toEqual([{ kind: 'text', text: 'Hello $&.' }]);
    expect(richSpans('Hello {name}.', "$`x$'")).toEqual([{ kind: 'text', text: "Hello $`x$'." }]);
    expect(richSpans('Hello {name}.', '$$ $1')).toEqual([{ kind: 'text', text: 'Hello $$ $1.' }]);
  });
  it('does not read a name with ** or backticks as markup', () => {
    expect(richSpans('Hi {name}!', '**x**')).toEqual([{ kind: 'text', text: 'Hi **x**!' }]);
    expect(richSpans('Hi {name}!', '`rm`')).toEqual([{ kind: 'text', text: 'Hi `rm`!' }]);
  });
  it('does not expand a {name} that sits inside a name', () => {
    expect(richSpans('{name}', '{name}')).toEqual([{ kind: 'text', text: '{name}' }]);
  });
  it('keeps the name inside bold or code when the template puts it there', () => {
    expect(richSpans('**{name}**', 'Ada')).toEqual([{ kind: 'b', text: 'Ada' }]);
    expect(richSpans('**{name}**', '**')).toEqual([{ kind: 'b', text: '**' }]);
    expect(richSpans('`{name}`', 'Ada')).toEqual([{ kind: 'code', text: 'Ada' }]);
  });
});

describe('richSpans: markup', () => {
  it('still parses bold and code in TAPEOUT\'s own text', () => {
    expect(richSpans('Use **bold** and `code` now.', 'Ada')).toEqual([
      { kind: 'text', text: 'Use ' },
      { kind: 'b', text: 'bold' },
      { kind: 'text', text: ' and ' },
      { kind: 'code', text: 'code' },
      { kind: 'text', text: ' now.' },
    ]);
  });
  it('returns nothing for empty text', () => {
    expect(richSpans('', 'Ada')).toEqual([]);
  });
});

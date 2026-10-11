import { describe, expect, it } from 'vitest';
import { evalIn, Interp } from './py';

const out = (src: string, opts = {}) => {
  const r = Interp.run(src, opts);
  if (r.error) throw new Error(`${r.error} (line ${r.line})`);
  return r.stdout;
};
const val = (src: string, expr: string) => {
  const r = evalIn(src, expr);
  if (r.error) throw new Error(r.error);
  return r.value;
};
const err = (src: string) => Interp.run(src).error;

describe('python subset: expressions and printing', () => {
  it('does integer and float arithmetic like Python', () => {
    expect(out('print(7 // 2, -7 // 2, 7 % 3, -7 % 3, 7 / 2, 2 ** 10, 2 ** -1, 10 / 4)')).toBe('3 -4 1 2 3.5 1024 0.5 2.5\n');
    expect(out('print(7.5 // 2, -7.5 % 2, 1e3, 1.0, 3.14, 1/3)')).toBe('3.0 0.5 1000.0 1.0 3.14 0.3333333333333333\n');
    expect(out('print(2 ** 100)')).toBe('1267650600228229401496703205376\n');
    expect(out('print(True + True, 5 > 3, 1 < 2 < 3, 3 < 2 < 1)')).toBe('2 True True False\n');
  });
  it('prints floats in repr form', () => {
    expect(out('print(0.1 + 0.2, 1e16, 1e-5, 123456789.0, float("inf"), -0.0)')).toBe('0.30000000000000004 1e+16 1e-05 123456789.0 inf -0.0\n');
  });
  it('formats strings in the ways engineers use', () => {
    expect(out('x = 3.14159\nprint(f"{x:.2f} {x:8.3f}|{42:05d}|{255:x}|{255:#b}|{1234567:,}|{0.25:.1%}")')).toBe('3.14    3.142|00042|ff|0b11111111|1,234,567|25.0%\n');
    expect(out('print("{} and {:>4}|{:<4}|{:^5}|".format("a", "b", "c", "d"))')).toBe('a and    b|c   |  d  |\n');
    expect(out('print("%d items, %s, %5.2f, %x" % (3, "ok", 2.5, 255))')).toBe('3 items, ok,  2.50, ff\n');
    expect(out('n = "w"\nprint(f"{n!r} {n=}" if False else f"{n!r}")')).toBe("'w'\n");
    expect(out('print(f"{{literal}} {1+2}")')).toBe('{literal} 3\n');
  });
  it('slices and indexes', () => {
    const s = 'a = [0, 1, 2, 3, 4, 5]\ns = "hello"\n';
    expect(val(s, 'a[1:4]')).toBe('[1, 2, 3]');
    expect(val(s, 'a[::-1]')).toBe('[5, 4, 3, 2, 1, 0]');
    expect(val(s, 'a[-2:]')).toBe('[4, 5]');
    expect(val(s, 'a[::2]')).toBe('[0, 2, 4]');
    expect(val(s, 'a[10:]')).toBe('[]');
    expect(val(s, 's[1:-1]')).toBe("'ell'");
    expect(val(s, 's[::-1]')).toBe("'olleh'");
    expect(val(s, 'a[-1]')).toBe('5');
  });
  it('supports comprehensions, lambdas and conditional expressions', () => {
    expect(val('', '[x * x for x in range(5) if x % 2 == 0]')).toBe('[0, 4, 16]');
    expect(val('', '{x: x + 1 for x in range(3)}')).toBe('{0: 1, 1: 2, 2: 3}');
    expect(val('', 'sorted({x % 3 for x in range(10)})')).toBe('[0, 1, 2]');
    expect(val('', '[(i, j) for i in range(2) for j in range(2)]')).toBe('[(0, 0), (0, 1), (1, 0), (1, 1)]');
    expect(val('f = lambda x, y=2: x * y', 'f(3) + f(3, 3)')).toBe('15');
    expect(val('', '"yes" if 3 > 2 else "no"')).toBe("'yes'");
    expect(val('', 'sum(x for x in range(101))')).toBe('5050');
  });
});

describe('python subset: statements and functions', () => {
  it('runs loops with break, continue and else', () => {
    expect(out('for i in range(5):\n    if i == 1: continue\n    if i == 4: break\n    print(i)\nelse:\n    print("no")')).toBe('0\n2\n3\n');
    expect(out('i = 0\nwhile i < 3:\n    i += 1\nelse:\n    print("done", i)')).toBe('done 3\n');
  });
  it('unpacks tuples, including star targets and swaps', () => {
    expect(out('a, b = 1, 2\na, b = b, a\nprint(a, b)\nfirst, *rest = [1, 2, 3]\nprint(first, rest)\n*h, t = "abc"\nprint(h, t)')).toBe("2 1\n1 [2, 3]\n['a', 'b'] c\n");
    expect(out('for i, (a, b) in enumerate([(1, 2), (3, 4)]):\n    print(i, a + b)')).toBe('0 3\n1 7\n');
  });
  it('handles recursion, defaults, *args and **kwargs', () => {
    expect(val('def fib(n):\n    return n if n < 2 else fib(n-1) + fib(n-2)', 'fib(15)')).toBe('610');
    expect(val('def f(a, b=2, *args, **kw):\n    return (a, b, args, sorted(kw.items()))', 'f(1, 3, 4, 5, x=6, y=7)')).toBe("(1, 3, (4, 5), [('x', 6), ('y', 7)])");
    expect(val('def f(a, b): return a - b', 'f(b=1, a=5)')).toBe('4');
    expect(val('def f(*a): return sum(a)', 'f(*[1, 2, 3])')).toBe('6');
  });
  it('supports closures, nonlocal and global', () => {
    expect(out('def counter():\n    n = 0\n    def inc():\n        nonlocal n\n        n += 1\n        return n\n    return inc\nc = counter()\nc(); c()\nprint(c())')).toBe('3\n');
    expect(out('x = 1\ndef f():\n    global x\n    x = 5\nf()\nprint(x)')).toBe('5\n');
  });
  it('handles exceptions', () => {
    expect(out('try:\n    1/0\nexcept ZeroDivisionError as e:\n    print("caught", e)\nfinally:\n    print("fin")')).toBe('caught division by zero\nfin\n');
    expect(out('try:\n    [][1]\nexcept (KeyError, IndexError) as e:\n    print(type(e).__name__, e)')).toBe('IndexError list index out of range\n');
    expect(out('class E(Exception): pass\ntry:\n    raise E("boom")\nexcept Exception as e:\n    print(e, isinstance(e, E))')).toBe('boom True\n');
    expect(out('d = {}\ntry:\n    d["k"]\nexcept KeyError as e:\n    print(repr(e), e)')).toBe("KeyError('k') 'k'\n");
    expect(out('def f():\n    try:\n        return 1\n    finally:\n        print("cleanup")\nprint(f())')).toBe('cleanup\n1\n');
  });
  it('reports uncaught errors with the line', () => {
    const r = Interp.run('x = 1\ny = [1, 2]\nprint(y[5])');
    expect(r.error).toBe('IndexError: list index out of range');
    expect(r.line).toBe(3);
    expect(err('print(undefined_name)')).toBe("NameError: name 'undefined_name' is not defined");
    expect(err('"a" + 1')).toBe("TypeError: unsupported operand type(s) for +: 'str' and 'int'");
    expect(err('int("abc")')).toBe("ValueError: invalid literal for int() with base 10: 'abc'");
    expect(err('assert 1 == 2, "nope"')).toBe('AssertionError: nope');
    expect(err('def f(a): pass\nf()')).toBe("TypeError: f() missing 1 required positional argument: 'a'");
  });
  it('reports syntax errors with a line number', () => {
    const r = Interp.run('x = 1\nif x ==\n    pass');
    expect(r.error).toMatch(/^SyntaxError/);
    expect(r.line).toBe(2);
    expect(err('def f(:\n  pass')).toMatch(/SyntaxError/);
    expect(err('x = (1,\n')).toMatch(/SyntaxError|unexpected/);
  });
  it('stops runaway programs', () => {
    expect(Interp.run('while True: pass', { maxSteps: 10000 }).error).toMatch(/ran too long/);
    expect(Interp.run('def f(): return f()\nf()').error).toMatch(/RecursionError/);
  });
});

describe('python subset: data structures', () => {
  it('works with lists', () => {
    expect(val('a = [3, 1, 2]\na.append(5)\na.sort()\na.reverse()\na.insert(1, 9)\nb = a.pop()', '(a, b)')).toBe('([5, 9, 3, 2], 1)');
    expect(val('a = [1, 2, 3]\nb = a\nb += [4]\nc = a + [5]', '(a, c)')).toBe('([1, 2, 3, 4], [1, 2, 3, 4, 5])');
    expect(val('', 'sorted([("b", 2), ("a", 2), ("c", 1)], key=lambda t: (t[1], t[0]))')).toBe("[('c', 1), ('a', 2), ('b', 2)]");
    expect(val('', 'sorted([3, 1, 2], reverse=True)')).toBe('[3, 2, 1]');
    expect(val('a = [1, 2, 3, 4]\na[1:3] = [9]\ndel a[0]', 'a')).toBe('[9, 4]');
    expect(val('', '[[0] * 2 for _ in range(2)]')).toBe('[[0, 0], [0, 0]]');
  });
  it('works with dicts and sets', () => {
    expect(val('d = {"a": 1}\nd["b"] = 2\nd.setdefault("c", 3)\nx = d.pop("a")', '(d, x, list(d.items()))')).toBe("({'b': 2, 'c': 3}, 1, [('b', 2), ('c', 3)])");
    expect(val('d = {}\nfor w in "abca": d[w] = d.get(w, 0) + 1', 'd')).toBe("{'a': 2, 'b': 1, 'c': 1}");
    expect(val('s = {1, 2, 3}\nt = {3, 4}', '(sorted(s & t), sorted(s | t), sorted(s - t), 2 in s)')).toBe('([3], [1, 2, 3, 4], [1, 2], True)');
    expect(val('d = {(1, 2): "p"}', 'd[(1, 2)]')).toBe("'p'");
    expect(val('', '1 == 1.0 and {1: "a"}[1.0] == "a"')).toBe('True');
    expect(err('{[1]: 2}')).toBe("TypeError: unhashable type: 'list'");
  });
  it('works with strings', () => {
    expect(val('', '"a,b,,c".split(",")')).toBe("['a', 'b', '', 'c']");
    expect(val('', '"  a  b ".split()')).toBe("['a', 'b']");
    expect(val('', '"-".join(["a", "b"]) + "x".upper() + " pad ".strip()')).toBe("'a-bXpad'");
    expect(val('', '"hello world".title() + "ab".zfill(4) + "x".center(5, "*")')).toBe("'Hello World00ab**x**'");
    expect(val('', '("abc".find("c"), "abc".count("b"), "abc".replace("b", "X"), "a" in "cat", "abc".startswith("ab"))')).toBe("(2, 1, 'aXc', True, True)");
    expect(val('', '(ord("A"), chr(98), "abc"[::-1], "ab" * 2, "x".isalpha(), "12".isdigit())')).toBe("(65, 'b', 'cba', 'abab', True, True)");
  });
  it('has the standard library bits that DSA code uses', () => {
    expect(val('from collections import Counter, defaultdict, deque\nc = Counter("aabbbc")\ng = defaultdict(list)\ng["x"].append(1)\nq = deque([1, 2])\nq.appendleft(0)\nq.pop()', '(c.most_common(1), dict(g), list(q), len(q))')).toBe("([('b', 3)], {'x': [1]}, [0, 1], 2)");
    expect(val('import heapq\nh = []\nfor x in [5, 1, 3]: heapq.heappush(h, x)', '[heapq.heappop(h) for _ in range(3)]')).toBe('[1, 3, 5]');
    expect(val('import math', '(math.sqrt(16), math.gcd(12, 18), math.floor(2.7), math.factorial(5), math.pi > 3.14, math.isqrt(17))')).toBe('(4.0, 6, 2, 120, True, 4)');
    expect(val('from functools import lru_cache\n@lru_cache(maxsize=None)\ndef f(n): return n if n < 2 else f(n-1) + f(n-2)', 'f(60)')).toBe('1548008755920');
    expect(val('import bisect', 'bisect.bisect_left([1, 3, 5], 3)')).toBe('1');
    expect(val('import random\nrandom.seed(1)\na = random.random()\nrandom.seed(1)\nb = random.random()', 'a == b and 0 <= a < 1')).toBe('True');
    expect(val('import itertools', 'len(list(itertools.permutations([1, 2, 3])))')).toBe('6');
  });
  it('has the built-in functions', () => {
    expect(val('', '(max([1, 5, 2]), min(3, 1, 2), max(["bb", "a"], key=len), sum([1.5, 2]), abs(-3), round(2.5), round(3.5), round(2.675, 2))')).toBe('(5, 1, \'bb\', 3.5, 3, 2, 4, 2.67)');
    expect(val('', 'list(zip([1, 2], "ab"))')).toBe("[(1, 'a'), (2, 'b')]");
    expect(val('', '(any([0, 1]), all([]), list(map(str, [1, 2])), list(filter(None, [0, 1, 2])), divmod(-7, 2))')).toBe("(True, True, ['1', '2'], [1, 2], (-4, 1))");
    expect(val('', '(int("ff", 16), int(3.9), float("2.5"), bin(5), hex(255), str(None), bool([]), list(range(10, 0, -3)))')).toBe("(255, 3, 2.5, '0b101', '0xff', 'None', False, [10, 7, 4, 1])");
    expect(val('', '(isinstance(3, int), isinstance(True, int), isinstance("a", (int, str)), type(3.0).__name__)')).toBe("(True, True, True, 'float')");
  });
});

describe('python subset: classes', () => {
  const shape = `
class Shape:
    count = 0
    def __init__(self, name):
        self.name = name
        Shape.count += 1
    def area(self): return 0
    def __repr__(self): return f"{self.name}({self.area()})"
class Rect(Shape):
    def __init__(self, w, h):
        super().__init__("rect")
        self.w, self.h = w, h
    def area(self): return self.w * self.h
    @property
    def diag2(self): return self.w ** 2 + self.h ** 2
    @staticmethod
    def unit(): return Rect(1, 1)
    @classmethod
    def square(cls, s): return cls(s, s)
    def __eq__(self, o): return self.w == o.w and self.h == o.h
    def __lt__(self, o): return self.area() < o.area()
    def __add__(self, o): return Rect(self.w + o.w, self.h + o.h)
`;
  it('supports inheritance, super, properties and class methods', () => {
    expect(val(shape, 'Rect(2, 3)')).toBe('rect(6)');
    expect(val(shape, 'Rect(3, 4).diag2')).toBe('25');
    expect(val(shape, 'Rect.square(3).area() + Rect.unit().area()')).toBe('10');
    expect(val(shape, 'Shape.count')).toBe('0');
    expect(val(shape + 'a = Rect(1, 2); b = Rect(1, 2)', '(a == b, a < Rect(5, 5), sorted([Rect(3, 3), a]), a + b, Shape.count)')).toBe('(True, True, [rect(2), rect(9)], rect(8), 5)');
  });
  it('supports dunder protocols for containers and iteration', () => {
    const src = `
class Stack:
    def __init__(self): self.items = []
    def push(self, x): self.items.append(x)
    def __len__(self): return len(self.items)
    def __iter__(self): return iter(self.items)
    def __getitem__(self, i): return self.items[i]
    def __contains__(self, x): return x in self.items
s = Stack()
s.push(1); s.push(2)
`;
    expect(val(src, '(len(s), list(s), s[1], 2 in s, bool(s))')).toBe('(2, [1, 2], 2, True, True)');
    expect(val('class A:\n    def __init__(self): self.n = 0\n    def __iter__(self): return self\n    def __next__(self):\n        self.n += 1\n        if self.n > 3: raise StopIteration\n        return self.n', 'list(A())')).toBe('[1, 2, 3]');
  });
  it('raises AttributeError for missing attributes', () => {
    expect(err('class A: pass\nA().x')).toBe("AttributeError: 'A' object has no attribute 'x'");
  });
});

describe('python subset: input and output', () => {
  it('reads stdin', () => {
    expect(out('n = int(input())\nprint(n * 2)', { stdin: ['21'] })).toBe('42\n');
  });
  it('supports print options', () => {
    expect(out('print(1, 2, sep="-", end="!")\nprint()')).toBe('1-2!\n');
  });
  it('truncates huge output', () => {
    const r = Interp.run('for i in range(100000): print("xxxxxxxxxx")', { maxOutput: 1000 });
    expect(r.stdout.length).toBeLessThan(1100);
  });
});

import { describe, expect, it } from 'vitest';
import { CInterp } from './c';

const run = (src: string, opts = {}) => CInterp.run(src, opts);
const out = (src: string, opts = {}) => {
  const r = run(src, opts);
  if (r.error) throw new Error(`${r.error} (line ${r.line})`);
  return r.stdout;
};
const main = (body: string, pre = '') => `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n${pre}\nint main(void) {\n${body}\nreturn 0;\n}\n`;

describe('c subset: arithmetic and types', () => {
  it('prints with printf', () => {
    expect(out(main('printf("%d %5d|%-5d|%05d %x %X %o %c %s %5.2f %e %%\\n", 42, 42, 42, 42, 255, 255, 8, 65, "hi", 3.14159, 1234.5);'))).toBe('42    42|42   |00042 ff FF 10 A hi  3.14 1.234500e+03 %\n');
    expect(out(main('printf("%ld %lu %lld %u\\n", 1L << 40, 18446744073709551615UL, -5LL, -1);'))).toBe('1099511627776 18446744073709551615 -5 4294967295\n');
  });
  it('follows C integer rules: unsigned wraparound, promotion, truncating division', () => {
    expect(out(main('unsigned int u = 0; u--; printf("%u\\n", u);'))).toBe('4294967295\n');
    expect(out(main('printf("%d %d %d %d\\n", 7 / 2, -7 / 2, 7 % 3, -7 % 3);'))).toBe('3 -3 1 -1\n');
    expect(out(main('unsigned char c = 200; c += 100; printf("%d\\n", c);'))).toBe('44\n');
    expect(out(main('char c = 127; c++; printf("%d\\n", c);'))).toBe('-128\n');
    expect(out(main('int i = -1; unsigned u = 1; printf("%d\\n", i < u);'))).toBe('0\n');
    expect(out(main('printf("%d %d\\n", 1 << 3, -16 >> 2);'))).toBe('8 -4\n');
    expect(out(main('printf("%f %f %d\\n", 7 / 2.0, (double)7 / 2, (int)3.99);'))).toBe('3.500000 3.500000 3\n');
  });
  it('signed overflow is undefined behaviour', () => {
    // the old test expected INT_MAX + 1 to print -2147483648; real C leaves it undefined and UBSan reports it
    const ub = (body: string) => run(main(body));
    for (const body of [
      'int a = 2147483647; a = a + 1; printf("%d\\n", a);',
      'int a = -2147483647 - 1; a = a - 1; printf("%d\\n", a);',
      'int a = 46341; printf("%d\\n", a * 46341);',
      'int a = -2147483647 - 1; printf("%d\\n", -a);',
      'int a = 2147483647; a += 1;',
      'int a = 2147483647; a++;',
      'int a = -2147483647 - 1; --a;',
      'long a = 9223372036854775807L; a = a * 2;',
    ]) {
      const r = ub(body);
      expect(r.kind, body).toBe('ubsan');
      expect(r.error).toContain('signed integer overflow');
    }
    expect(ub('int a = 2147483647; a = a + 1;').error).toContain("cannot be represented in type 'int'");
    expect(out(main('int a = 2147483647; printf("%d %d\\n", a - 1, -(a - 5));'))).toBe('2147483646 -2147483642\n');
  });
  it('knows sizes', () => {
    expect(out(main('printf("%zu %zu %zu %zu %zu %zu\\n", sizeof(char), sizeof(short), sizeof(int), sizeof(long), sizeof(char *), sizeof(double));'))).toBe('1 2 4 8 8 8\n');
    expect(out(main('int a[10]; printf("%zu %zu\\n", sizeof a, sizeof(a) / sizeof(a[0]));'))).toBe('40 10\n');
  });
  it('lays structs out with alignment and padding', () => {
    expect(out(main('printf("%zu %zu %zu\\n", sizeof(struct A), sizeof(struct B), sizeof(union U));', 'struct A { char c; int i; char d; };\nstruct B { int i; char c; char d; };\nunion U { int i; char c[8]; };'))).toBe('12 8 8\n');
  });
  it('handles control flow', () => {
    expect(out(main('int s = 0; for (int i = 0; i < 10; i++) { if (i % 2) continue; if (i > 6) break; s += i; } printf("%d\\n", s);'))).toBe('12\n');
    expect(out(main('int i = 0; do { i += 3; } while (i < 10); while (i > 0) i -= 4; printf("%d\\n", i);'))).toBe('0\n');
    expect(out(main('for (int i = 0; i < 4; i++) { switch (i) { case 0: printf("zero "); break; case 1: case 2: printf("small "); default: printf("fall "); } } printf("\\n");'))).toBe('zero small fall small fall fall \n');
    expect(out(main('int x = 5; printf("%d %d\\n", x > 3 ? 10 : 20, (x++, x));'))).toBe('10 6\n');
  });
});

describe('c subset: pointers, arrays and strings', () => {
  it('uses pointer arithmetic and arrays', () => {
    expect(out(main('int a[5] = {1, 2, 3, 4, 5}; int *p = a; p += 2; printf("%d %d %d %ld\\n", *p, p[1], *(a + 4), p - a);'))).toBe('3 4 5 2\n');
    expect(out(main('int m[2][3] = {{1, 2, 3}, {4, 5, 6}}; printf("%d %d %zu\\n", m[1][2], *(*(m + 1) + 1), sizeof m);'))).toBe('6 5 24\n');
    expect(out(main('int x = 7, *p = &x, **pp = &p; **pp = 9; printf("%d\\n", x);'))).toBe('9\n');
  });
  it('swaps through pointers and calls functions', () => {
    expect(out(main('int a = 1, b = 2; swap(&a, &b); printf("%d %d %d\\n", a, b, fact(10));', 'void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }\nint fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }'))).toBe('2 1 3628800\n');
  });
  it('handles strings and string.h', () => {
    expect(out(main('char s[20] = "hello"; strcat(s, " world"); printf("%s %zu %d %c\\n", s, strlen(s), strcmp("a", "b"), s[1]);'))).toBe('hello world 11 -1 e\n');
    expect(out(main('const char *p = "abc"; int n = 0; while (*p++) n++; printf("%d\\n", n);'))).toBe('3\n');
    expect(out(main('char buf[32]; sprintf(buf, "%d-%s", 7, "x"); puts(buf); char *c = strchr(buf, \'-\'); printf("%s\\n", c + 1);'))).toBe('7-x\nx\n');
  });
  it('allocates and frees on the heap', () => {
    expect(out(main('int *a = malloc(5 * sizeof(int)); for (int i = 0; i < 5; i++) a[i] = i * i; int s = 0; for (int i = 0; i < 5; i++) s += a[i]; free(a); printf("%d\\n", s);'))).toBe('30\n');
    expect(out(main('int *z = calloc(4, sizeof(int)); printf("%d %d\\n", z[0], z[3]); z = realloc(z, 8 * sizeof(int)); z[7] = 5; printf("%d %d\\n", z[0], z[7]); free(z);'))).toBe('0 0\n0 5\n');
  });
  it('builds linked lists with structs', () => {
    const pre = 'struct node { int v; struct node *next; };\nstruct node *push(struct node *h, int v) { struct node *n = malloc(sizeof *n); n->v = v; n->next = h; return n; }';
    expect(out(main('struct node *h = NULL; for (int i = 1; i <= 3; i++) h = push(h, i); for (struct node *p = h; p; p = p->next) printf("%d ", p->v); printf("\\n");', pre))).toBe('3 2 1 \n');
  });
  it('supports typedef, enum, function pointers and struct values', () => {
    const pre = 'typedef struct { int x, y; } Pt;\nenum color { RED, GREEN = 5, BLUE };\nPt add(Pt a, Pt b) { Pt r = { a.x + b.x, a.y + b.y }; return r; }\nint twice(int v) { return 2 * v; }\nint apply(int (*f)(int), int v) { return f(v); }';
    expect(out(main('Pt a = {1, 2}, b = {3, 4}; Pt p = add(a, b); printf("%d %d %d %d %d\\n", p.x, p.y, BLUE, apply(twice, 21), (*twice)(4));', pre))).toBe('4 6 6 42 8\n');
  });
  it('supports designated initialisers and qsort', () => {
    expect(out(main('int a[] = {5, 2, 9, 1}; qsort(a, 4, sizeof(int), cmp); for (int i = 0; i < 4; i++) printf("%d ", a[i]); struct P q = { .y = 3 }; printf("%d %d\\n", q.x, q.y);', 'struct P { int x, y; };\nint cmp(const void *a, const void *b) { return *(const int *)a - *(const int *)b; }'))).toBe('1 2 5 9 0 3\n');
  });
  it('expands macros', () => {
    expect(out(main('printf("%d %d %d\\n", MAX(3, 7), SQ(2 + 1), N);', '#define N 10\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\n#define SQ(x) ((x) * (x))\n#ifdef N\n#else\n#error nope\n#endif'))).toBe('7 9 10\n');
  });
  it('reads stdin', () => {
    expect(out(main('int a, b; scanf("%d %d", &a, &b); printf("%d\\n", a + b);'), { stdin: '3 4\n' })).toBe('7\n');
  });
  it('returns the exit code', () => {
    expect(run('int main() { return 7; }').exit).toBe(7);
    expect(run('#include <stdlib.h>\nint main() { exit(3); return 0; }').exit).toBe(3);
  });
});

describe('c subset: memory errors', () => {
  const err = (body: string, pre = '') => run(main(body, pre));
  it('catches a null dereference', () => {
    const r = err('int *p = NULL; *p = 1;');
    expect(r.error).toMatch(/Segmentation fault.*null pointer/);
    expect(r.line).toBe(6);
  });
  it('catches a heap buffer overflow', () => {
    const r = err('int *a = malloc(4 * sizeof(int)); a[4] = 1;');
    expect(r.error).toMatch(/heap-buffer-overflow.*write of 4 bytes.*0 bytes past the end of a 16-byte block/);
  });
  it('catches a stack buffer overflow', () => {
    expect(err('int a[4]; for (int i = 0; i <= 4; i++) a[i] = 0;').error).toMatch(/stack-buffer-overflow/);
  });
  it('catches use after free and double free', () => {
    expect(err('int *a = malloc(8); free(a); printf("%d", *a);').error).toMatch(/heap-use-after-free/);
    expect(err('int *a = malloc(8); free(a); free(a);').error).toMatch(/double-free/);
    expect(err('int x; free(&x);').error).toMatch(/not returned by malloc/);
  });
  it('catches a dangling pointer to a local', () => {
    expect(err('int *p = f(); printf("%d", *p);', 'int *f(void) { int x = 5; return &x; }').error).toMatch(/stack-use-after-return/);
  });
  it('catches writes to string literals', () => {
    expect(err('char *s = "abc"; s[0] = \'x\';').error).toMatch(/read-only/);
  });
  it('catches a global buffer overflow', () => {
    expect(err('g[5] = 1;', 'int g[5];').error).toMatch(/global-buffer-overflow/);
  });
  it('catches division by zero and infinite recursion', () => {
    expect(err('int z = 0; printf("%d", 1 / z);').error).toMatch(/Floating point exception/);
    expect(err('r(1);', 'int r(int n) { return r(n + 1) + 1; }').error).toMatch(/stack overflow/);
  });
  it('catches assertion failures and runaway loops', () => {
    expect(err('assert(1 == 2);', '#include <assert.h>').error).toMatch(/Assertion failed: 1 == 2/);
    expect(run('int main() { while (1) {} }', { maxSteps: 10000 }).error).toMatch(/ran too long/);
  });
  it('exposes uninitialised locals as garbage rather than zero', () => {
    expect(out(main('int x; printf("%d\\n", x == 0);'))).toBe('0\n');
  });
  it('reports compile errors with a line', () => {
    const r = run('int main() {\n  int x = ;\n  return 0;\n}');
    expect(r.error).toMatch(/expected an expression/);
    expect(r.line).toBe(2);
    expect(run('int main() { return y; }').error).toMatch(/'y' undeclared/);
  });
});

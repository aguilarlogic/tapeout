// Code Lab missions in C: pointers, memory, structs, bit manipulation, and finding bugs from sanitizer reports.
import { between, pick, type Rng } from '../../lessons/types';
import type { CodeLevel } from './types';

const swap: CodeLevel = {
  id: 'code-c-swap', title: 'Swap through pointers', concept: 'pointers as out-parameters', xp: 80, tier: 'guided', lang: 'c',
  ticket: 'Your sort routine needs to rearrange values owned by its caller. C passes by value, so hand it addresses.',
  build: () => ({
    brief: `<p>Write <code>void swap(int *a, int *b)</code> to exchange the two ints the pointers point at, and <code>void sort3(int *a, int *b, int *c)</code> to leave <code>*a &lt;= *b &lt;= *c</code>. Do not write a <code>main</code>: the test harness has one.</p>`,
    starter: 'void swap(int *a, int *b) {\n    /* exchange *a and *b */\n}\n\nvoid sort3(int *a, int *b, int *c) {\n    /* order the three values */\n}\n',
    hints: ['A function gets copies of its arguments, but a copy of a pointer still points at the original.', 'int t = *a; *a = *b; *b = t;', 'Sorting three: compare-and-swap (a,b), then (b,c), then (a,b) again.'],
    solution: `void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }
void sort3(int *a, int *b, int *c) {
    if (*a > *b) swap(a, b);
    if (*b > *c) swap(b, c);
    if (*a > *b) swap(a, b);
}
`,
    cases: [
      { pre: 'int x = 1, y = 2; swap(&x, &y);', call: 'x, y', fmt: '%d %d' },
      { pre: 'int x = 3, y = 1, z = 2; sort3(&x, &y, &z);', call: 'x, y, z', fmt: '%d %d %d' },
      { pre: 'int x = 9, y = 9, z = 1; sort3(&x, &y, &z);', call: 'x, y, z', fmt: '%d %d %d', hidden: true },
      { pre: 'int x = 5, y = 4, z = 3; sort3(&x, &y, &z);', call: 'x, y, z', fmt: '%d %d %d', hidden: true },
      { pre: 'int x = 1, y = 2, z = 3; sort3(&x, &y, &z);', call: 'x, y, z', fmt: '%d %d %d', hidden: true },
    ],
  }),
};

const strings: CodeLevel = {
  id: 'code-c-strings', title: 'Strings are char arrays', concept: 'NUL termination and walking a pointer', xp: 100, tier: 'guided', lang: 'c',
  ticket: 'The bootloader has no libc. Rebuild the three string helpers it needs.',
  build: () => ({
    brief: `<p>Write these without calling the library versions:</p><pre>size_t my_strlen(const char *s);          // length, not counting the NUL
char  *my_strcpy(char *dst, const char *src); // copy including the NUL, return dst
int    count_char(const char *s, char c);     // how many times c appears</pre>`,
    starter: 'size_t my_strlen(const char *s) {\n    return 0;\n}\n\nchar *my_strcpy(char *dst, const char *src) {\n    return dst;\n}\n\nint count_char(const char *s, char c) {\n    return 0;\n}\n',
    hints: ['A C string ends at the first byte that is 0. Loop until *s == 0.', 'strcpy: copy bytes until you have copied the NUL as well.', 'You can advance the pointer itself: while (*s) { ...; s++; }'],
    rules: [{ label: 'Does not call strlen/strcpy from the library', ok: (s) => !/(^|[^\w])(strlen|strcpy|strcat|strncpy)\s*\(/.test(s) }],
    solution: `size_t my_strlen(const char *s) {
    size_t n = 0;
    while (s[n]) n++;
    return n;
}
char *my_strcpy(char *dst, const char *src) {
    char *d = dst;
    while ((*d++ = *src++)) { }
    return dst;
}
int count_char(const char *s, char c) {
    int n = 0;
    for (; *s; s++) if (*s == c) n++;
    return n;
}
`,
    cases: [
      { call: 'my_strlen("hello")', fmt: '%zu' },
      { pre: 'char buf[16]; my_strcpy(buf, "abc");', call: 'buf', fmt: '%s' },
      { call: 'count_char("mississippi", \'s\')' },
      { call: 'my_strlen("")', fmt: '%zu', hidden: true },
      { pre: 'char buf[16] = "zzzzzzzz"; my_strcpy(buf, "");', call: 'buf[0] == 0 && buf[1] == \'z\'', hidden: true },
      { pre: 'char buf[8]; char *r = my_strcpy(buf, "xy");', call: 'r == buf', hidden: true },
      { call: 'count_char("aaa", \'b\')', hidden: true },
    ],
  }),
};

const array: CodeLevel = {
  id: 'code-c-array', title: 'Arrays and indices', concept: 'array parameters decay to pointers; the length travels separately', xp: 100, tier: 'guided', lang: 'c',
  ticket: 'A sample buffer arrives backwards and you need its peak. An array parameter does not know its own length, so you are told n.',
  build: () => ({
    brief: `<p>Write <code>void reverse(int *a, int n)</code> to reverse the array in place, and <code>int max_index(const int *a, int n)</code> returning the index of the first largest element (<code>n &gt;= 1</code>).</p>`,
    starter: 'void reverse(int *a, int n) {\n}\n\nint max_index(const int *a, int n) {\n    return 0;\n}\n',
    hints: ['Swap a[i] with a[n - 1 - i] for the first half only. Swapping the whole array undoes itself.', 'Keep the best index so far; replace it only if the new element is strictly greater, so the first one wins ties.'],
    solution: `void reverse(int *a, int n) {
    for (int i = 0; i < n / 2; i++) { int t = a[i]; a[i] = a[n - 1 - i]; a[n - 1 - i] = t; }
}
int max_index(const int *a, int n) {
    int best = 0;
    for (int i = 1; i < n; i++) if (a[i] > a[best]) best = i;
    return best;
}
`,
    cases: [
      { pre: 'int a[] = {1, 2, 3, 4, 5}; reverse(a, 5);', call: 'a[0], a[1], a[2], a[3], a[4]', fmt: '%d %d %d %d %d' },
      { pre: 'int a[] = {3, 9, 2, 9, 1};', call: 'max_index(a, 5)' },
      { pre: 'int a[] = {1, 2, 3, 4}; reverse(a, 4);', call: 'a[0], a[3]', fmt: '%d %d', hidden: true },
      { pre: 'int a[] = {7}; reverse(a, 1);', call: 'a[0]', hidden: true },
      { pre: 'int a[] = {-5, -2, -9};', call: 'max_index(a, 3)', hidden: true },
    ],
  }),
};

const bits: CodeLevel = {
  id: 'code-c-bits', title: 'Register fields in C', concept: 'masks, shifts and unsigned arithmetic', xp: 120, tier: 'guided', lang: 'c',
  ticket: 'Every driver has these three functions. Write them once, correctly.',
  build: () => ({
    brief: `<p>Fields live inside 32-bit registers. Write:</p><pre>uint32_t get_field(uint32_t reg, int lo, int width);
uint32_t set_field(uint32_t reg, int lo, int width, uint32_t val);  // other bits untouched; val is masked to width
int      popcount(uint32_t x);</pre><p><code>1 &lt;&lt; 32</code> is undefined in C, so <code>width</code> may be 32: mind your shifts.</p>`,
    starter: '#include <stdint.h>\n\nuint32_t get_field(uint32_t reg, int lo, int width) {\n    return 0;\n}\n\nuint32_t set_field(uint32_t reg, int lo, int width, uint32_t val) {\n    return reg;\n}\n\nint popcount(uint32_t x) {\n    return 0;\n}\n',
    hints: ['mask = (1u << width) - 1, but handle width == 32 separately.', 'set_field: clear the field with reg & ~(mask << lo), then OR in (val & mask) << lo.', 'popcount: while (x) { n += x & 1; x >>= 1; }'],
    solution: `#include <stdint.h>
static uint32_t mask(int width) { return width >= 32 ? 0xFFFFFFFFu : ((1u << width) - 1u); }
uint32_t get_field(uint32_t reg, int lo, int width) { return (reg >> lo) & mask(width); }
uint32_t set_field(uint32_t reg, int lo, int width, uint32_t val) {
    uint32_t m = mask(width) << lo;
    return (reg & ~m) | ((val << lo) & m);
}
int popcount(uint32_t x) { int n = 0; while (x) { n += x & 1; x >>= 1; } return n; }
`,
    cases: [
      { call: 'get_field(0xABCD1234u, 8, 8)', fmt: '%x' },
      { call: 'set_field(0xFFFFFFFFu, 4, 8, 0x12)', fmt: '%x' },
      { call: 'popcount(0xF0F0u)' },
      { call: 'get_field(0xDEADBEEFu, 0, 32)', fmt: '%x', hidden: true },
      { call: 'set_field(0, 28, 4, 0x1F)', fmt: '%x', hidden: true },
      { call: 'popcount(0xFFFFFFFFu)', hidden: true },
      { call: 'set_field(0x12345678u, 0, 32, 7)', fmt: '%x', hidden: true },
      { call: 'get_field(0x80000000u, 31, 1)', fmt: '%u', hidden: true },
    ],
  }),
};

const layout: CodeLevel = {
  id: 'code-c-layout', title: 'Shrink the struct', concept: 'alignment, padding and field order', xp: 100, tier: 'guided', lang: 'c',
  ticket: 'A million of these packets sit in a trace buffer. The compiler pads them; the layout is yours to fix.',
  build: () => ({
    brief: `<p>This struct wastes memory on padding. Reorder its fields (keep all five, keep their types) so that <code>sizeof(struct packet)</code> is <b>16</b> bytes. Compute where each field lands: each field is aligned to its own size, and the struct is padded to its largest alignment.</p>`,
    starter: 'struct packet {\n    char   type;\n    double ts;\n    char   flags;\n    int    len;\n    char   id;\n};\n',
    hints: ['Put the 8-byte field first, then the 4-byte one, then the three single bytes.', 'Largest alignment first leaves the smallest gaps. 8 + 4 + 1 + 1 + 1 = 15, padded to 16.'],
    rules: ['type', 'ts', 'flags', 'len', 'id'].map((f) => ({ label: `Still has the field "${f}"`, ok: (s: string) => new RegExp(`\\b${f}\\s*;`).test(s) })),
    solution: 'struct packet {\n    double ts;\n    int    len;\n    char   type;\n    char   flags;\n    char   id;\n};\n',
    cases: [
      { call: 'sizeof(struct packet)', fmt: '%zu' },
      { pre: 'struct packet p; p.type = 1; p.ts = 2.5; p.flags = 3; p.len = 4; p.id = 5;', call: 'p.type + p.flags + p.len + p.id, p.ts', fmt: '%d %.1f', hidden: true },
    ],
  }),
};

const list: CodeLevel = {
  id: 'code-c-list', title: 'Linked list surgery', concept: 'pointers to structs, malloc and free', xp: 140, tier: 'guided', lang: 'c',
  ticket: 'The event queue is a singly linked list. Reverse it in place and remove entries without leaking.',
  build: () => ({
    brief: `<p>The harness builds lists of <code>struct node</code> for you. Write:</p><pre>struct node *reverse(struct node *head);              // in place, no allocation
int          list_sum(const struct node *head);
struct node *remove_value(struct node *head, int v);  // remove every node whose v matches; free() them</pre><p>Leaking a node fails the test.</p>`,
    starter: 'struct node {\n    int v;\n    struct node *next;\n};\n\nstruct node *reverse(struct node *head) {\n    return head;\n}\n\nint list_sum(const struct node *head) {\n    return 0;\n}\n\nstruct node *remove_value(struct node *head, int v) {\n    return head;\n}\n',
    hints: ['reverse: walk with prev and cur. Save cur->next before you overwrite it.', 'remove_value: handle the head separately, or keep a pointer to the pointer you will update (struct node **pp).', 'Every node you unlink must be freed exactly once.'],
    leaks: true,
    harness: `static struct node *build(const int *vals, int n) {
    struct node *h = 0, **t = &h;
    for (int i = 0; i < n; i++) { *t = malloc(sizeof **t); (*t)->v = vals[i]; (*t)->next = 0; t = &(*t)->next; }
    return h;
}
static void print_list(const struct node *h) { while (h) { printf("%d ", h->v); h = h->next; } }
static void free_list(struct node *h) { while (h) { struct node *n = h->next; free(h); h = n; } }
`,
    solution: `struct node { int v; struct node *next; };
struct node *reverse(struct node *head) {
    struct node *prev = 0;
    while (head) { struct node *nx = head->next; head->next = prev; prev = head; head = nx; }
    return prev;
}
int list_sum(const struct node *head) { int s = 0; for (; head; head = head->next) s += head->v; return s; }
struct node *remove_value(struct node *head, int v) {
    struct node **pp = &head;
    while (*pp) {
        if ((*pp)->v == v) { struct node *dead = *pp; *pp = dead->next; free(dead); }
        else pp = &(*pp)->next;
    }
    return head;
}
`,
    cases: [
      { pre: 'int v[] = {1, 2, 3, 4}; struct node *h = build(v, 4); h = reverse(h); print_list(h);', call: 'list_sum(h)', post: 'free_list(h);' },
      { pre: 'int v[] = {5, 2, 5, 7, 5}; struct node *h = build(v, 5); h = remove_value(h, 5); print_list(h);', call: 'list_sum(h)', post: 'free_list(h);' },
      { pre: 'struct node *h = build(0, 0); h = reverse(h);', call: 'h == 0', hidden: true },
      { pre: 'int v[] = {3, 3, 3}; struct node *h = build(v, 3); h = remove_value(h, 3);', call: 'h == 0', hidden: true },
      { pre: 'int v[] = {1, 2}; struct node *h = build(v, 2); h = remove_value(h, 9); print_list(h);', call: 'list_sum(h)', post: 'free_list(h);', hidden: true },
      { pre: 'int v[] = {1, 2, 3, 4, 5, 6}; struct node *h = build(v, 6); h = remove_value(reverse(h), 4); print_list(h);', call: 'list_sum(h)', post: 'free_list(h);', hidden: true },
    ],
  }),
};

const vec: CodeLevel = {
  id: 'code-c-vec', title: 'A growable array', concept: 'realloc, capacity doubling and ownership', xp: 140, tier: 'guided', lang: 'c',
  ticket: 'The trace collector does not know how many events it will see. Give it a vector.',
  build: () => ({
    brief: `<p>Implement a growable array of ints with the functions below. Start with no allocation; when full, grow the capacity (doubling is the usual choice, starting from 4). <code>vec_free</code> must release everything. Leaks fail the test.</p><pre>struct vec { int *data; size_t len, cap; };
void vec_init(struct vec *v);
void vec_push(struct vec *v, int x);
void vec_free(struct vec *v);</pre>`,
    starter: 'struct vec {\n    int *data;\n    size_t len, cap;\n};\n\nvoid vec_init(struct vec *v) {\n}\n\nvoid vec_push(struct vec *v, int x) {\n}\n\nvoid vec_free(struct vec *v) {\n}\n',
    hints: ['realloc(NULL, n) behaves like malloc(n), so you can start with data = NULL.', 'Grow when len == cap: new_cap = cap ? cap * 2 : 4. Multiply by sizeof(int)!', 'vec_free: free(v->data), then reset the fields so a double free is harmless.'],
    leaks: true,
    solution: `struct vec { int *data; size_t len, cap; };
void vec_init(struct vec *v) { v->data = NULL; v->len = 0; v->cap = 0; }
void vec_push(struct vec *v, int x) {
    if (v->len == v->cap) {
        size_t nc = v->cap ? v->cap * 2 : 4;
        v->data = realloc(v->data, nc * sizeof(int));
        v->cap = nc;
    }
    v->data[v->len++] = x;
}
void vec_free(struct vec *v) { free(v->data); v->data = NULL; v->len = 0; v->cap = 0; }
`,
    cases: [
      { pre: 'struct vec v; vec_init(&v); for (int i = 0; i < 10; i++) vec_push(&v, i * 2);', call: 'v.len, v.data[9]', fmt: '%zu %d', post: 'vec_free(&v);' },
      { pre: 'struct vec v; vec_init(&v);', call: 'v.len, v.data == 0', fmt: '%zu %d', post: 'vec_free(&v);' },
      { pre: 'struct vec v; vec_init(&v); for (int i = 0; i < 1000; i++) vec_push(&v, i);', call: 'v.len, v.data[0], v.data[999], v.cap >= 1000', fmt: '%zu %d %d %d', post: 'vec_free(&v);', hidden: true },
      { pre: 'struct vec v; vec_init(&v); vec_push(&v, 5); vec_push(&v, 6); vec_push(&v, 7); vec_push(&v, 8); vec_push(&v, 9);', call: 'v.data[0] + v.data[4], v.len', fmt: '%d %zu', post: 'vec_free(&v);', hidden: true },
    ],
  }),
};

// ------------------------------------------------------------------ bug hunts: the sanitizer tells you what happened

const bugOverflow: CodeLevel = {
  id: 'code-c-bug-overflow', title: 'Bug hunt: one past the end', concept: 'off-by-one and stack buffer overflow', xp: 100, tier: 'debug', lang: 'c',
  ticket: 'It passes with short inputs and crashes with longer ones. The sanitizer log is below; read it, then fix the code.',
  build: () => ({
    brief: `<p><code>checksum</code> sums the first up-to-8 values of its input. With 10 values the program is flagged by the sanitizer. Run it, read the report, and fix the bug. The behaviour must otherwise stay the same.</p>`,
    starter: `int checksum(const int *src, int n) {
    int buf[8];
    for (int i = 0; i <= 8 && i < n; i++)
        buf[i] = src[i];
    int s = 0;
    for (int i = 0; i < n && i < 8; i++)
        s += buf[i];
    return s;
}
`,
    hints: ['A buffer of 8 ints has valid indices 0 to 7. Which index does the loop reach?', 'Change <= to <.', 'Rule of thumb: for (i = 0; i < N; i++) for an array of N.'],
    solution: `int checksum(const int *src, int n) {
    int buf[8];
    for (int i = 0; i < 8 && i < n; i++)
        buf[i] = src[i];
    int s = 0;
    for (int i = 0; i < n && i < 8; i++)
        s += buf[i];
    return s;
}
`,
    cases: [
      { pre: 'int a[] = {1, 2, 3, 4, 5};', call: 'checksum(a, 5)' },
      { pre: 'int a[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};', call: 'checksum(a, 10)' },
      { pre: 'int a[] = {1, 2, 3, 4, 5, 6, 7, 8};', call: 'checksum(a, 8)', hidden: true },
    ],
  }),
};

const bugUaf: CodeLevel = {
  id: 'code-c-bug-uaf', title: 'Bug hunt: use after free', concept: 'reading a node after releasing it', xp: 100, tier: 'debug', lang: 'c',
  ticket: 'This worked for years because freed memory still held the old bytes. Then the allocator changed.',
  build: () => ({
    brief: `<p><code>drain</code> frees every node in a list and returns the sum of their values. The sanitizer reports a use-after-free. Fix it.</p>`,
    starter: `struct node { int v; struct node *next; };

int drain(struct node *h) {
    int s = 0;
    for (struct node *p = h; p; p = p->next) {
        s += p->v;
        free(p);
    }
    return s;
}
`,
    hints: ['The for loop evaluates p->next after the body, and the body just freed p.', 'Save p->next in a local before calling free.'],
    leaks: true,
    harness: 'static struct node *build(const int *vals, int n) {\n    struct node *h = 0, **t = &h;\n    for (int i = 0; i < n; i++) { *t = malloc(sizeof **t); (*t)->v = vals[i]; (*t)->next = 0; t = &(*t)->next; }\n    return h;\n}\n',
    solution: `struct node { int v; struct node *next; };
int drain(struct node *h) {
    int s = 0;
    while (h) {
        struct node *next = h->next;
        s += h->v;
        free(h);
        h = next;
    }
    return s;
}
`,
    cases: [
      { pre: 'int v[] = {1, 2, 3, 4}; struct node *h = build(v, 4);', call: 'drain(h)' },
      { pre: 'struct node *h = build(0, 0);', call: 'drain(h)', hidden: true },
      { pre: 'int v[] = {10}; struct node *h = build(v, 1);', call: 'drain(h)', hidden: true },
    ],
  }),
};

const bugLeak: CodeLevel = {
  id: 'code-c-bug-leak', title: 'Bug hunt: the slow leak', concept: 'ownership: who frees what', xp: 120, tier: 'debug', lang: 'c',
  ticket: 'The long-running daemon grows by a few kilobytes an hour. The leak checker shows where the bytes go.',
  build: () => ({
    brief: `<p><code>longest</code> returns a freshly allocated copy of the longest string in the array; the <b>caller</b> frees it. The answer is right, but the leak checker reports lost memory. Find where, and fix it.</p>`,
    starter: `char *dup(const char *s) {
    char *p = malloc(strlen(s) + 1);
    strcpy(p, s);
    return p;
}

char *longest(const char **words, int n) {
    char *best = dup("");
    for (int i = 0; i < n; i++) {
        if (strlen(words[i]) > strlen(best)) {
            best = dup(words[i]);
        }
    }
    return best;
}
`,
    hints: ['Count the mallocs and the frees. Each dup() is an allocation somebody must free.', 'When best is replaced, what happens to the old block it pointed at?', 'free(best) before assigning the new copy.'],
    leaks: true,
    solution: `char *dup(const char *s) {
    char *p = malloc(strlen(s) + 1);
    strcpy(p, s);
    return p;
}
char *longest(const char **words, int n) {
    char *best = dup("");
    for (int i = 0; i < n; i++) {
        if (strlen(words[i]) > strlen(best)) {
            free(best);
            best = dup(words[i]);
        }
    }
    return best;
}
`,
    cases: [
      { pre: 'const char *w[] = {"ab", "abcd", "abc", "abcdef"}; char *r = longest(w, 4);', call: 'r', fmt: '%s', post: 'free(r);' },
      { pre: 'const char *w[] = {"x"}; char *r = longest(w, 1);', call: 'r', fmt: '%s', post: 'free(r);', hidden: true },
      { pre: 'const char *w[] = {"a", "bb", "cc"}; char *r = longest(w, 3);', call: 'r', fmt: '%s', post: 'free(r);', hidden: true },
    ],
  }),
};

const bugDangling: CodeLevel = {
  id: 'code-c-bug-dangling', title: 'Bug hunt: a pointer to nowhere', concept: 'lifetime of local variables', xp: 120, tier: 'debug', lang: 'c',
  ticket: 'It printed the right thing on the developer\'s laptop. In production it prints garbage.',
  build: () => ({
    brief: `<p><code>label(id)</code> builds a name like <code>unit_7</code> and returns it. Each call must return its <b>own</b> string, which the caller frees. The sanitizer reports a stack-use-after-return. Fix <code>label</code>.</p>`,
    starter: `char *label(int id) {
    char buf[16];
    sprintf(buf, "unit_%d", id);
    return buf;
}
`,
    hints: ['buf lives in label\'s stack frame. When label returns, that memory is reused.', 'A static buffer would survive, but then two calls share the same bytes.', 'malloc a buffer: it lives until somebody frees it.'],
    leaks: true,
    solution: `char *label(int id) {
    char *buf = malloc(16);
    sprintf(buf, "unit_%d", id);
    return buf;
}
`,
    cases: [
      { pre: 'char *a = label(1); char *b = label(2);', call: 'a, b', fmt: '%s %s', post: 'free(a); free(b);' },
      { pre: 'char *a = label(1234567);', call: 'a', fmt: '%s', post: 'free(a);', hidden: true },
    ],
  }),
};

const bugUninit: CodeLevel = {
  id: 'code-c-bug-uninit', title: 'Bug hunt: the unset accumulator', concept: 'uninitialised locals hold garbage', xp: 80, tier: 'debug', lang: 'c',
  ticket: 'Unit test says -842150449, and nobody can explain it.',
  build: () => ({
    brief: `<p><code>count_neg</code> should count the negative values. It returns a huge strange number. Why?</p>`,
    starter: `int count_neg(const int *a, int n) {
    int count;
    for (int i = 0; i < n; i++)
        if (a[i] < 0)
            count++;
    return count;
}
`,
    hints: ['In C a local variable has no initial value; it holds whatever the stack held before.', '-842150451 is 0xCDCDCDCD: the debug allocator\'s "uninitialised" pattern. Initialise count.'],
    solution: 'int count_neg(const int *a, int n) {\n    int count = 0;\n    for (int i = 0; i < n; i++)\n        if (a[i] < 0)\n            count++;\n    return count;\n}\n',
    cases: [
      { pre: 'int a[] = {1, -2, 3, -4};', call: 'count_neg(a, 4)' },
      { pre: 'int a[] = {1, 2};', call: 'count_neg(a, 2)', hidden: true },
      { pre: 'int a[] = {-1};', call: 'count_neg(a, 1)', hidden: true },
    ],
  }),
};

// ------------------------------------------------------------------ boss missions (randomized)

const bossRing: CodeLevel = {
  id: 'code-boss-c-ring', title: 'Boss: the ring buffer', concept: 'a bounded FIFO with struct state and heap storage', xp: 360, tier: 'boss', lang: 'c',
  ticket: 'The UART driver needs a ring buffer between the interrupt handler and the main loop. No hints.',
  build: (r: Rng) => {
    const mk = (cap: number, nOps: number) => {
      const lines: string[] = [];
      for (let i = 0; i < nOps; i++) {
        if (r() < 0.55) lines.push(`h = h * 31 + ring_push(&r, ${between(r, 1, 99)});`);
        else lines.push('h = h * 31 + (ring_pop(&r, &out) == 0 ? out : -1);');
      }
      return { pre: `struct ring r; ring_init(&r, ${cap}); int out = 0; long h = 7;\n${lines.join('\n')}`, call: 'h', fmt: '%ld', post: 'ring_free(&r);' };
    };
    return {
      brief: `<p>Write a FIFO of ints with a fixed capacity, stored on the heap:</p><pre>struct ring;                                  // you define it
int  ring_init(struct ring *r, int cap);      // 0 on success
int  ring_push(struct ring *r, int v);        // 0 on success, -1 if full
int  ring_pop(struct ring *r, int *out);      // 0 on success, -1 if empty
void ring_free(struct ring *r);</pre>
<p>Values come out in the order they went in. Pushing to a full ring and popping from an empty one must fail without changing anything. No leaks.</p>`,
      starter: 'struct ring {\n    int dummy;\n};\n\nint ring_init(struct ring *r, int cap) { return -1; }\nint ring_push(struct ring *r, int v) { return -1; }\nint ring_pop(struct ring *r, int *out) { return -1; }\nvoid ring_free(struct ring *r) { }\n',
      hints: [],
      leaks: true,
      solution: `struct ring { int *buf; int cap, head, count; };
int ring_init(struct ring *r, int cap) { r->buf = malloc(cap * sizeof(int)); if (!r->buf) return -1; r->cap = cap; r->head = 0; r->count = 0; return 0; }
int ring_push(struct ring *r, int v) { if (r->count == r->cap) return -1; r->buf[(r->head + r->count) % r->cap] = v; r->count++; return 0; }
int ring_pop(struct ring *r, int *out) { if (r->count == 0) return -1; *out = r->buf[r->head]; r->head = (r->head + 1) % r->cap; r->count--; return 0; }
void ring_free(struct ring *r) { free(r->buf); r->buf = NULL; }
`,
      cases: [mk(3, 12), mk(2, 20), mk(5, 40), mk(1, 15), mk(4, 60)].map((c, i) => ({ ...c, hidden: i > 0 })),
    };
  },
};

const bossSplit: CodeLevel = {
  id: 'code-boss-c-split', title: 'Boss: split in place', concept: 'pointer walking and modifying a string in place', xp: 340, tier: 'boss', lang: 'c',
  ticket: 'The command parser has no heap and no libc. Tokenize the line where it sits. No hints.',
  build: (r: Rng) => {
    const words = ['read', 'write', '0x40', 'reg', 'ctrl', 'on', 'off', 'a1', 'zz', 'dma', 'irq7'];
    const mk = () => {
      const delim = pick(r, [',', ' ', ';', ':']);
      const n = between(r, 0, 6);
      let s = '';
      if (r() < 0.4) s += delim;
      for (let i = 0; i < n; i++) { s += pick(r, words); s += delim.repeat(between(r, 1, 2)); }
      if (r() < 0.5) s = s.slice(0, -1);
      return { s, delim, max: between(r, 2, 5) };
    };
    const mkCase = (c: { s: string; delim: string; max: number }, hidden: boolean) => ({
      pre: `char s[64] = ${JSON.stringify(c.s)}; char *tok[8]; int n = split(s, '${c.delim}', tok, ${c.max}); char *t0 = n > 0 ? tok[0] : "-"; char *t1 = n > 1 ? tok[1] : "-"; char *tl = n > 0 ? tok[n - 1] : "-";`,
      call: 'n, t0, t1, tl', fmt: '%d [%s] [%s] [%s]', hidden,
    });
    return {
      brief: `<p>Write <code>int split(char *s, char delim, char **out, int max)</code>. It splits <code>s</code> <b>in place</b>: overwrite delimiters with NUL, store a pointer to each token in <code>out</code>, and return the token count. Empty tokens (two delimiters in a row, or a leading or trailing delimiter) are skipped. Store at most <code>max</code> tokens. Allocate nothing, and call no library functions.</p>`,
      starter: 'int split(char *s, char delim, char **out, int max) {\n    return 0;\n}\n',
      hints: [],
      rules: [{ label: 'Does not call malloc or string.h', ok: (s) => !/(^|[^\w])(malloc|calloc|strtok|strlen|strcpy|strchr|strdup)\s*\(/.test(s) }],
      solution: `int split(char *s, char delim, char **out, int max) {
    int n = 0;
    char *p = s;
    while (*p && n < max) {
        while (*p == delim) p++;
        if (!*p) break;
        out[n++] = p;
        while (*p && *p != delim) p++;
        if (*p) *p++ = '\\0';
    }
    return n;
}
`,
      cases: [mk(), mk(), mk(), mk(), mk()].map((c, i) => mkCase(c, i > 0)).concat([mkCase({ s: '', delim: ',', max: 3 }, true), mkCase({ s: ',,,', delim: ',', max: 3 }, true)]),
    };
  },
};

const bossCrc: CodeLevel = {
  id: 'code-boss-c-crc', title: 'Boss: CRC-8', concept: 'bitwise algorithms on bytes', xp: 340, tier: 'boss', lang: 'c',
  ticket: 'The link layer needs a CRC. The spec is three lines long and the polynomial changes per product. No hints.',
  build: (r: Rng) => {
    const polys = ['0x07', '0x31', '0x1D', '0xD5', '0x9B'];
    const mk = (hidden: boolean) => {
      const n = between(r, 1, 12);
      const data = Array.from({ length: n }, () => `0x${between(r, 0, 255).toString(16).toUpperCase().padStart(2, '0')}`);
      return { pre: `uint8_t d[] = {${data.join(', ')}};`, call: `crc8(d, ${n}, ${pick(r, polys)})`, fmt: '%u', hidden };
    };
    return {
      brief: `<p>Write <code>uint8_t crc8(const uint8_t *data, size_t n, uint8_t poly)</code>.</p>
<p>The CRC starts at 0. For each byte: XOR it into the CRC, then do eight times: if the top bit of the CRC is set, shift left by one and XOR with <code>poly</code>; otherwise just shift left. The result is the final CRC (no reflection, no final XOR). All arithmetic is 8 bits wide.</p>`,
      starter: '#include <stdint.h>\n\nuint8_t crc8(const uint8_t *data, size_t n, uint8_t poly) {\n    return 0;\n}\n',
      hints: [],
      solution: `#include <stdint.h>
uint8_t crc8(const uint8_t *data, size_t n, uint8_t poly) {
    uint8_t crc = 0;
    for (size_t i = 0; i < n; i++) {
        crc ^= data[i];
        for (int b = 0; b < 8; b++)
            crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ poly) : (uint8_t)(crc << 1);
    }
    return crc;
}
`,
      cases: [mk(false), mk(false), mk(true), mk(true), mk(true), mk(true)],
    };
  },
};

export const C_LEVELS: CodeLevel[] = [swap, strings, array, bits, layout, list, vec, bugOverflow, bugUaf, bugLeak, bugDangling, bugUninit, bossRing, bossSplit, bossCrc];

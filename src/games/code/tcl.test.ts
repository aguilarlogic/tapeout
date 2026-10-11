import { describe, expect, it } from 'vitest';
import { tclScripts } from '../../practice/tooling';
import { rng } from '../../sim/harness';
import { TCL_LEVELS } from './levels-tcl';
import { runCode } from './run';
import { TclInterp } from './tcl';

const out = (src: string, opts = {}) => {
  const r = TclInterp.run(src, opts);
  if (r.error) throw new Error(`${r.error} (line ${r.line})`);
  return r.stdout;
};
const val = (src: string, call: string) => { const it = new TclInterp(); it.load(src); return it.evalTop(call); };
const err = (src: string) => TclInterp.run(src).error;

describe('tcl subset: substitution', () => {
  it('substitutes variables and commands, but not inside braces', () => {
    expect(out('set n 3\nputs "n is $n"\nputs {n is $n}\nputs [expr {$n * 2}]')).toBe('n is 3\nn is $n\n6\n');
    expect(out('set a 1\nset b [expr {$a + 1}]\nputs "$a $b [expr {$b * 10}]"')).toBe('1 2 20\n');
    expect(out('set x 4\nset y $x\nset x 9\nputs $y')).toBe('4\n');
  });
  it('handles braces in variable names, escapes and semicolons', () => {
    expect(out('set clk_period 5\nputs ${clk_period}ns')).toBe('5ns\n');
    expect(out('puts "a\\tb\\\\c \\$x \\[y\\]"')).toBe('a\tb\\c $x [y]\n');
    expect(out('set a 1; set b 2; puts $a$b')).toBe('12\n');
    expect(out('puts "line one\\\n   continued"')).toBe('line one continued\n');
  });
  it('substitutes twice where Tcl does: expr evaluates its arguments again', () => {
    expect(out('set x 4\nset y {$x}\nputs [expr $y + 3]')).toBe('7\n');
    expect(out('set clk_period 2\nset which clk\nputs [expr {[set ${which}_period] * 3}]')).toBe('6\n');
  });
  it('reads array elements', () => {
    expect(out('set a(x) 5\nset k x\nputs $a($k)\nputs [array size a]\nset a(y) 1\nputs [lsort [array names a]]')).toBe('5\n1\nx y\n');
  });
  it('expands {*} arguments', () => {
    expect(out('proc add3 {a b c} {expr {$a+$b+$c}}\nputs [add3 {*}{1 2 3}]')).toBe('6\n');
  });
  it('ignores comments', () => {
    expect(out('# hello\nset a 1 ;# trailing\nputs $a')).toBe('1\n');
  });
});

describe('tcl subset: expr', () => {
  const e = (x: string) => val('', `expr {${x}}`);
  it('does integer and float arithmetic like Tcl', () => {
    expect(e('7 / 2')).toBe('3');
    expect(e('-7 / 2')).toBe('-4');
    expect(e('-7 % 3')).toBe('2');
    expect(e('7 / 2.0')).toBe('3.5');
    expect(e('2 ** 10')).toBe('1024');
    expect(e('10 / 4.0')).toBe('2.5');
    expect(e('1.0 * 2')).toBe('2.0');
    expect(e('0x1F + 1')).toBe('32');
    expect(e('1 << 4 | 3')).toBe('19');
  });
  it('compares, combines and branches', () => {
    expect(e('3 < 5 && 2 >= 2')).toBe('1');
    expect(e('"abc" eq "abc"')).toBe('1');
    expect(e('"a" ne "a"')).toBe('0');
    expect(e('1 ? 10 : 20')).toBe('10');
    expect(e('!0')).toBe('1');
    expect(e('5 in {1 5 9}')).toBe('1');
    expect(e('10 == 10.0')).toBe('1');
    expect(e('"10" == "10.0"')).toBe('1');
  });
  it('has the common functions', () => {
    expect(e('abs(-3) + max(1, 7, 4) + min(2, 9)')).toBe('12');
    expect(e('int(7.9)')).toBe('7');
    expect(e('round(2.5)')).toBe('3');
    expect(e('sqrt(16)')).toBe('4.0');
    expect(e('double(3)')).toBe('3.0');
  });
  it('reports errors in Tcl words', () => {
    expect(err('expr {1 / 0}')).toBe('divide by zero');
    expect(err('expr {"abc" + 1}')).toBe(`can't use non-numeric string as operand of "+"`);
    expect(err('set')).toBe(`wrong # args: should be "set varName ?newValue?"`);
    expect(err('puts $nope')).toBe(`can't read "nope": no such variable`);
    expect(err('frobnicate 1')).toBe('invalid command name "frobnicate"');
  });
});

describe('tcl subset: control flow and procs', () => {
  it('runs if, while, for and foreach with break and continue', () => {
    expect(out('foreach i {1 2 3 4 5} {\n if {$i == 2} continue\n if {$i == 5} break\n puts $i\n}')).toBe('1\n3\n4\n');
    expect(out('set i 0\nwhile {$i < 3} {incr i}\nputs $i')).toBe('3\n');
    expect(out('for {set i 0} {$i < 3} {incr i} {puts $i}')).toBe('0\n1\n2\n');
    expect(out('if {0} {puts a} elseif {1} {puts b} else {puts c}')).toBe('b\n');
    expect(out('foreach {k v} {a 1 b 2} {puts "$k=$v"}')).toBe('a=1\nb=2\n');
    expect(out('foreach a {1 2} b {x y z} {puts "$a$b"}')).toBe('1x\n2y\nz\n');
  });
  it('defines procs with defaults, args and recursion', () => {
    expect(out('proc f {a {b 10}} {expr {$a + $b}}\nputs [f 1]\nputs [f 1 2]')).toBe('11\n3\n');
    expect(out('proc n {args} {llength $args}\nputs [n a b c]')).toBe('3\n');
    expect(out('proc fact {n} {if {$n <= 1} {return 1}\nexpr {$n * [fact [expr {$n - 1}]]}}\nputs [fact 10]')).toBe('3628800\n');
    expect(err('proc f {a b} {}\nf 1')).toBe('wrong # args: should be "f a b"');
  });
  it('scopes variables, with global and upvar', () => {
    expect(out('set g 1\nproc f {} {global g\nincr g}\nf\nputs $g')).toBe('2\n');
    expect(out('proc bump {name} {upvar 1 $name v\nincr v}\nset c 5\nbump c\nputs $c')).toBe('6\n');
    expect(err('proc f {} {puts $outside}\nset outside 1\nf')).toBe(`can't read "outside": no such variable`);
  });
  it('switch matches exact, glob and default', () => {
    expect(out('switch -glob u_alu/x {\n  u_fifo* {puts fifo}\n  u_alu* {puts alu}\n  default {puts other}\n}')).toBe('alu\n');
    expect(out('switch b {a {puts 1} b - c {puts 2} default {puts 3}}')).toBe('2\n');
  });
  it('catch returns 0 or 1 and keeps the message', () => {
    expect(out('puts [catch {expr {1 / 0}} msg]\nputs $msg')).toBe('1\ndivide by zero\n');
    expect(out('puts [catch {expr {6 * 7}} r]\nputs $r')).toBe('0\n42\n');
    expect(out('proc chk {x} {if {$x > 3} {error "too big: $x"}\nreturn ok}\nset rc [catch {chk 9} m]\nputs "$rc $m"')).toBe('1 too big: 9\n');
    expect(out('puts "[catch {expr {2 * 3}} res] $res"')).toBe('0 6\n');
    expect(out('puts [catch {set nope} m]\nputs $m')).toBe(`1\ncan't read "nope": no such variable\n`);
    expect(err('error boom')).toBe('boom');
  });
  it('stops runaway scripts', () => {
    expect(TclInterp.run('while {1} {}', { maxSteps: 10_000 }).error).toMatch(/ran too long/);
    expect(err('proc f {} {f}\nf')).toMatch(/too many nested evaluations/);
  });
});

describe('tcl subset: lists, strings, dicts', () => {
  it('builds and indexes lists', () => {
    expect(out('set l {a b c}\nlappend l d\nputs "[llength $l] [lindex $l end] [lindex $l 1] [lrange $l 1 2]"')).toBe('4 d b b c\n');
    expect(val('', 'list a {b c} d')).toBe('a {b c} d');
    expect(val('', 'lindex {a {b c} d} 1')).toBe('b c');
    expect(val('', 'lsearch {a b c} c')).toBe('2');
    expect(val('', 'lsearch -glob {u_alu u_fifo x} u_*')).toBe('0');
    expect(val('', 'lsort -integer -decreasing {3 10 2}')).toBe('10 3 2');
    expect(val('', 'lsort {pear apple fig}')).toBe('apple fig pear');
    expect(val('', 'join {a b c} ,')).toBe('a,b,c');
    expect(val('', 'split a,b,,c ,')).toBe('a b {} c');
    expect(val('', 'concat {a b} {c d}')).toBe('a b c d');
    expect(val('', 'lreplace {a b c d} 1 2 X')).toBe('a X d');
    expect(val('', 'linsert {a b} 1 X')).toBe('a X b');
    expect(val('', 'lreverse {1 2 3}')).toBe('3 2 1');
    expect(val('', 'lmap x {1 2 3} {expr {$x * $x}}')).toBe('1 4 9');
  });
  it('does strings and format', () => {
    expect(val('', 'string length hello')).toBe('5');
    expect(val('', 'string toupper abc')).toBe('ABC');
    expect(val('', 'string range hello 1 3')).toBe('ell');
    expect(val('', 'string match {u_*/D} u_alu/D')).toBe('1');
    expect(val('', 'string map {a 1 b 2} abcab')).toBe('12c12');
    expect(val('', 'string trim "  x  "')).toBe('x');
    expect(val('', 'string is integer 42')).toBe('1');
    expect(val('', 'format "%5.2f|%-4d|%04d|%x|%s" 3.14159 7 42 255 hi')).toBe(' 3.14|7   |0042|ff|hi');
  });
  it('keeps dicts as lists of key and value', () => {
    const s = 'dict set d clk 2.0\ndict set d rst 5\ndict incr d rst\ndict set n a b 1\n';
    expect(val(s, 'dict get $d rst')).toBe('6');
    expect(val(s, 'dict keys $d')).toBe('clk rst');
    expect(val(s, 'dict get $n a b')).toBe('1');
    expect(val(s, 'dict exists $d clk')).toBe('1');
    expect(val(s, 'dict exists $d nope')).toBe('0');
    expect(val(s, 'set d')).toBe('clk 2.0 rst 6');
    expect(out(s + 'dict for {k v} $d {puts "$k:$v"}')).toBe('clk:2.0\nrst:6\n');
    expect(err('dict get {a 1} b')).toBe('key "b" not known in dictionary');
  });
  it('matches regular expressions with capture variables', () => {
    expect(out('regexp {u_(\\w+)/(\\d+)} "u_alu/7" m name idx\nputs "$m $name $idx"')).toBe('u_alu/7 alu 7\n');
    expect(val('', 'regexp {^\\d+$} abc')).toBe('0');
    expect(val('', 'regexp -all {\\d} a1b22c')).toBe('3');
    expect(val('', 'regexp -inline -all {\\d+} a1b22c')).toBe('1 22');
    expect(val('', 'regsub -all {a} banana X')).toBe('bXnXnX');
    expect(val('', 'regsub {(\\w+)@(\\w+)} me@home {\\2 at \\1}')).toBe('home at me');
    expect(out('puts [regsub -all {_} a_b_c - r]\nputs $r')).toBe('2\na-b-c\n');
    expect(val('', 'regexp -nocase {^dff} DFF_X1')).toBe('1');
  });
});

describe('tcl subset: the toy netlist', () => {
  const design = 'read_netlist {u_core/r1 DFF_X1 u_core/r2 DFFR_X1 u_core/g1 NAND2_X1 u_io/b1 BUF_X2 u_io/r3 DFF_X2}\n';
  it('selects cells and pins with patterns and filters', () => {
    expect(val(design, 'sizeof_collection [get_cells *]')).toBe('5');
    expect(val(design, 'sizeof_collection [get_cells u_core/*]')).toBe('3');
    expect(val(design, 'sizeof_collection [get_cells -hier -filter "ref_name =~ DFF*"]')).toBe('3');
    expect(val(design, 'sizeof_collection [get_cells -filter "ref_name =~ DFF* and ref_name != DFF_X1"]')).toBe('2');
    expect(val(design, 'sizeof_collection [get_cells -filter "is_sequential == true"]')).toBe('3');
    expect(val(design, 'sizeof_collection [get_pins */D]')).toBe('3');
    expect(val(design, 'sizeof_collection [get_pins -of_objects [get_cells u_core/g1]]')).toBe('3');
    expect(val(design, 'sizeof_collection [get_pins -filter "direction == out"]')).toBe('5');
    expect(val(design, 'sizeof_collection [get_cells nothing*]')).toBe('0');
    expect(val(design, 'sizeof_collection [all_registers]')).toBe('3');
  });
  it('loops over a collection and reads attributes', () => {
    const s = design + 'set names {}\nforeach_in_collection c [get_cells -filter "ref_name =~ DFF*"] {\n  lappend names [get_attribute $c full_name]\n}\n';
    expect(val(s, 'set names')).toBe('u_core/r1 u_core/r2 u_io/r3');
    expect(val(design, 'get_attribute [index_collection [get_cells *] 3] ref_name')).toBe('BUF_X2');
    expect(val(design, 'get_object_name [filter_collection [get_cells *] {ref_name == NAND2_X1}]')).toBe('u_core/g1');
    expect(val(design, 'get_object_name [add_to_collection [get_cells u_io/b1] [get_cells u_io/r3]]')).toBe('u_io/b1 u_io/r3');
    expect(val(design, 'get_object_name [sort_collection -descending [get_cells *] pin_count]')).toBe('u_core/r2 u_core/r1 u_core/g1 u_io/r3 u_io/b1');
    expect(err(design + 'get_attribute [get_cells u_io/b1] nope')).toBe(`Error: attribute 'nope' does not exist`);
    expect(err(design + 'get_attribute [get_cells u_io/*] ref_name')).toMatch(/exactly one object/);
  });
});

describe('tcl subset: error positions', () => {
  it('reports the line of the failing command, also inside bodies and procs', () => {
    expect(TclInterp.run('set a 1\nset b 2\nputs $c').line).toBe(3);
    expect(TclInterp.run('set a 1\nforeach i {1} {\n  set b 2\n  puts $zzz\n}').line).toBe(4);
    expect(TclInterp.run('proc f {} {\n  nope\n}\nset x 1\nf').line).toBe(2);
    expect(TclInterp.run('set a [expr {1 +\n}]').error).toMatch(/SyntaxError/);
    expect(TclInterp.run('set a {abc').error).toBe('SyntaxError: missing close-brace');
  });
});

describe('the Tcl drills in the flows practice set agree with this interpreter', () => {
  it('prints what each script says it prints', () => {
    const seen = new Set<string>();
    for (const [a, b] of [[2, 3], [5, 9], [9, 4], [12, 6], [3, 7], [8, 8]]) {
      for (const t of tclScripts(a, b)) {
        seen.add(t.method);
        const r = TclInterp.run(t.src);
        expect(r.error, t.src).toBeUndefined();
        expect(r.stdout.trim(), t.src).toBe(t.out);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
});

describe('tcl subset: fidelity fixes from the standards audit', () => {
  it('puts takes a channel: stdout works, stderr is kept apart, anything else is an error', () => {
    expect(out('puts stdout hi')).toBe('hi\n');
    expect(out('puts stderr oops\nputs ok')).toBe('ok\n');
    expect(TclInterp.run('puts stderr oops\nputs -nonewline stderr !').interp.stderr).toBe('oops\n!');
    expect(err('puts hello world')).toMatch(/can not find channel named "hello"/);
  });
  it('array and info exists see through global and upvar links', () => {
    expect(out('set a(x) 1\nset a(y) 2\nproc f {} { global a; return [array size a] }\nputs [f]')).toBe('2\n');
    expect(out('set a(x) 1\nproc g {n} { upvar $n arr; return [lsort [array names arr]] }\nputs [g a]')).toBe('x\n');
    expect(out('set a(x) 1\nputs [info exists a]\nputs [info exists a(x)]\nputs [info exists a(q)]')).toBe('1\n1\n0\n');
  });
  it('linsert counts end as the slot after the last element', () => {
    expect(out('puts [linsert {a b c} end X]\nputs [linsert {a b c} end-1 X]\nputs [linsert {a b c} 0 X]')).toBe('a b c X\na b X c\nX a b c\n');
  });
  it('string compare -nocase reads its option before the strings', () => {
    expect(out('puts [string compare -nocase b A]\nputs [string compare -nocase abc ABC]\nputs [string compare a b]')).toBe('1\n0\n-1\n');
  });
  it('unary minus binds tighter than **, as in Tcl', () => {
    expect(out('puts [expr {-2**2}]\nputs [expr {-(2**2)}]')).toBe('4\n-4\n');
  });
  it('allows recursion several hundred levels deep', () => {
    expect(out('proc d {n} { if {$n == 0} { return 0 }; return [expr {1 + [d [expr {$n - 1}]]}] }\nputs [d 300]')).toBe('300\n');
  });
  it('format %d refuses a fraction', () => {
    expect(err('format %d 3.5')).toMatch(/expected integer/);
  });
});

describe('tcl subset: array set through a link', () => {
  it('writes into the linked array', () => {
    expect(out('proc f {} { global cfg; array set cfg {a 1 b 2} }\nf\nputs [lsort [array names cfg]] \nputs $cfg(b)')).toBe('a b\n2\n');
  });
});

describe('code-tcl-netlist rejects near misses', () => {
  const inst = TCL_LEVELS.find((l) => l.id === 'code-tcl-netlist')!.build(rng(1));
  const run = (src: string) => runCode('tcl', inst, src);
  it('accepts the solution', () => expect(run(inst.solution).passed).toBe(true));
  it('needs the sort', () => expect(run(inst.solution.replace('return [lsort $names]', 'return $names')).passed).toBe(false));
  it('needs the DFF filter, not every sequential cell', () => expect(run(inst.solution.replace('-filter "ref_name =~ DFF*"', '-filter "is_sequential == true"')).passed).toBe(false));
});

describe('tcl subset: numbers as Tcl 8.6 reads them (as EDA tools embed it)', () => {
  it('a leading 0 means octal, and 08 is an error', () => {
    expect(out('puts [expr {010 + 1}]\nputs [expr {0o10}]\nputs [expr {0 + 00}]\nputs [expr {0x10 + 0b11}]')).toBe('9\n8\n0\n19\n');
    expect(err('expr {08 + 1}')).toMatch(/invalid octal number/);
    expect(err('set h 09\nexpr {$h + 1}')).toMatch(/invalid octal number/);
    expect(out('scan 09 %d h\nputs [expr {$h + 1}]')).toBe('10\n');
  });
  it('rejects a bare word in an expression, but keeps the boolean words', () => {
    expect(err('expr {abc eq abc}')).toMatch(/invalid bareword "abc"/);
    expect(out('puts [expr {"abc" eq {abc}}]\nif {yes} { puts y }\nputs [expr {true && !off}]')).toBe('1\ny\n1\n');
  });
});

describe('tcl subset: regexp -indices and lsort -command / -indices', () => {
  it('regexp -indices stores first and last character positions', () => {
    expect(out('regexp -indices {b+} abbbc m\nputs $m')).toBe('1 3\n');
    expect(out('regexp -indices {(a)(x)?(b)} zab all g1 g2 g3\nputs "$all|$g1|$g2|$g3"')).toBe('1 2|1 1|-1 -1|2 2\n');
    expect(out('puts [regexp -indices -inline {c(d)} abcd]')).toBe('{2 3} {3 3}\n');
  });
  it('lsort -command sorts with your comparison proc', () => {
    expect(out('proc bylen {a b} { expr {[string length $a] - [string length $b]} }\nputs [lsort -command bylen {ccc a bb}]\nputs [lsort -decreasing -command bylen {ccc a bb}]')).toBe('a bb ccc\nccc bb a\n');
  });
  it('lsort -indices returns the positions in sorted order', () => {
    expect(out('puts [lsort -indices {c a b}]\nputs [lsort -indices -integer -decreasing {5 10 7}]')).toBe('1 2 0\n1 2 0\n');
  });
});

describe('the Tcl lab console shows puts stderr', () => {
  it('marks stderr lines and still checks only the return value', () => {
    const inst = TCL_LEVELS[0].build(rng(1));
    const src = inst.solution.replace(/^proc (\S+) \{([^}]*)\} \{\n/m, (m) => `${m}    puts stderr "debug: called"\n`);
    expect(src).not.toBe(inst.solution);
    const rep = runCode('tcl', inst, src);
    expect(rep.passed).toBe(true);
    expect(rep.stdout).toContain('stderr: debug: called');
  });
});

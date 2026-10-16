// Tcl missions: the scripting language of every EDA shell. Substitution, dicts, regexp, netlist collections, catch, and a report-triage boss.
import { between, pick, type Rng } from '../../lessons/types';
import type { CodeLevel } from './types';

const DESIGN = 'read_netlist {u_core/r1 DFF_X1 u_core/r2 DFFR_X1 u_core/g1 NAND2_X1 u_core/g2 NOR2_X1 u_io/b1 BUF_X2 u_io/r3 DFF_X2 u_io/r4 DFF_X1}';

const subst: CodeLevel = {
  id: 'code-tcl-subst', title: 'Substitution and proc', concept: 'quotes substitute, braces do not; [expr] inside a string', xp: 120, tier: 'guided', lang: 'tcl',
  ticket: 'The constraints script prints a one-line summary for every clock. Write the helper that builds it.',
  build: () => ({
    brief: `<p>Write a <code>proc describe_clock {name mhz}</code> that <b>returns</b> a string such as <code>clk: 100 MHz, period 10.0 ns</code>. The period in ns is 1000.0 divided by the frequency, so keep the <code>.0</code> in 1000.0: <code>expr</code> does integer division when both numbers are integers.</p>
<p>Remember: <code>"..."</code> substitutes <code>$name</code> and <code>[cmd]</code>; <code>{...}</code> does not.</p>`,
    starter: 'proc describe_clock {name mhz} {\n    return "name: mhz MHz"\n}\n',
    hints: ['Put $name and $mhz in a double-quoted string so they are replaced by their values.', 'The period is a command substitution inside the string: [expr {1000.0 / $mhz}].'],
    solution: 'proc describe_clock {name mhz} {\n    return "$name: $mhz MHz, period [expr {1000.0 / $mhz}] ns"\n}\n',
    cases: [
      { call: 'describe_clock clk 100' },
      { call: 'describe_clock core_clk 400' },
      { call: 'describe_clock ref 250', hidden: true },
      { call: 'describe_clock pll_out 800', hidden: true },
    ],
  }),
};

const census: CodeLevel = {
  id: 'code-tcl-dict', title: 'Cell census', concept: 'lists, foreach and dict: count what the netlist contains', xp: 130, tier: 'guided', lang: 'tcl',
  ticket: 'Before sign-off the lead wants a census of library cells: how many of each, in the order they first appear.',
  build: () => ({
    brief: `<p>Write <code>proc census {refs}</code> where <code>refs</code> is a list of library cell names. Return a <b>dict</b> mapping each name to how many times it occurs, with the keys in order of first appearance. For <code>{DFF NAND DFF INV NAND DFF}</code> the result is <code>DFF 3 NAND 2 INV 1</code>.</p>`,
    starter: 'proc census {refs} {\n    return {}\n}\n',
    hints: ['Loop with foreach over $refs and keep a dict in a variable (start with set counts {}).', 'dict incr counts $r adds one and creates the key if it is missing. Finish with return $counts.'],
    solution: 'proc census {refs} {\n    set counts {}\n    foreach r $refs {\n        dict incr counts $r\n    }\n    return $counts\n}\n',
    cases: [
      { call: 'census {DFF NAND DFF INV NAND DFF}' },
      { call: 'census {INV}' },
      { call: 'census {}', hidden: true },
      { call: 'census {BUF BUF BUF NOR BUF NOR XOR}', hidden: true },
    ],
  }),
};

const slackParse: CodeLevel = {
  id: 'code-tcl-regexp', title: 'Read a timing report', concept: 'split, regexp with capture variables, comparing numbers with expr', xp: 150, tier: 'guided', lang: 'tcl',
  ticket: 'The STA report is text. Pull the worst endpoint out of it before the meeting.',
  build: () => ({
    brief: `<p>Each report line looks like <code>u_core/r1/D slack -0.12</code>: an endpoint, the word <code>slack</code>, and a number. Other lines (headings, blanks) must be ignored. Write <code>proc worst_endpoint {report}</code> returning <code>endpoint:slack</code> for the line with the <b>smallest</b> slack, for example <code>u_io/r3/D:-0.31</code>. If no line matches, return <code>none</code>.</p>`,
    starter: 'proc worst_endpoint {report} {\n    return none\n}\n',
    hints: ['split $report "\\n" gives a list of lines; foreach walks over them.', 'regexp {^(\\S+) slack (-?[0-9.]+)$} $line -> ep sl sets the endpoint and the slack when the line matches.', 'Track the best so far; compare slacks with expr, never as strings. A variable that does not exist yet can be tested with info exists.'],
    solution: `proc worst_endpoint {report} {
    set best none
    set low 0
    foreach line [split $report "\\n"] {
        if {[regexp {^(\\S+) slack (-?[0-9.]+)$} $line -> ep sl]} {
            if {$best eq "none" || $sl < $low} {
                set best "$ep:$sl"
                set low $sl
            }
        }
    }
    return $best
}
`,
    cases: [
      { call: 'worst_endpoint {Timing report\nu_core/r1/D slack 0.10\nu_io/r3/D slack -0.31\nu_core/r2/D slack -0.05\n}' },
      { call: 'worst_endpoint {u_a/D slack 0.40\nu_b/D slack 0.12}' },
      { call: 'worst_endpoint {no paths here}', hidden: true },
      { call: 'worst_endpoint {a/D slack -0.9\nb/D slack -0.10\nc/D slack -1.2\n}', hidden: true },
    ],
  }),
};

const flops: CodeLevel = {
  id: 'code-tcl-netlist', title: 'Collections', concept: 'get_cells with a filter, foreach_in_collection, get_attribute', xp: 160, tier: 'guided', lang: 'tcl',
  ticket: 'The CTS engineer wants every flop in one block, by name. Your shell already has the netlist loaded.',
  build: () => ({
    brief: `<p>The design is loaded with <code>read_netlist</code>. Cells are fetched with <code>get_cells</code> (a pattern, and <code>-filter "ref_name =~ DFF*"</code> to select by library cell). The result is a <b>collection</b>, an opaque handle: loop over it with <code>foreach_in_collection c $coll { ... }</code> and read one object at a time with <code>get_attribute $c full_name</code>. <code>sizeof_collection</code> counts.</p>
<p>Write <code>proc flop_names {block}</code> returning the full names of the flops (ref name starting with DFF) inside <code>$block</code>, sorted alphabetically, as a list. A block with no flops returns an empty list.</p>`,
    starter: 'proc flop_names {block} {\n    return {}\n}\n',
    hints: ['get_cells "$block/*" -filter "ref_name =~ DFF*" selects the right cells. Use double quotes so $block is substituted.', 'An empty result is an empty collection: foreach_in_collection then simply does nothing.', 'lappend names [get_attribute $c full_name] inside the loop, then return [lsort $names].'],
    solution: `proc flop_names {block} {
    set names {}
    foreach_in_collection c [get_cells "$block/*" -filter "ref_name =~ DFF*"] {
        lappend names [get_attribute $c full_name]
    }
    return [lsort $names]
}
`,
    cases: [
      { pre: DESIGN, call: 'flop_names u_core' },
      { pre: DESIGN, call: 'flop_names u_io' },
      { pre: DESIGN, call: 'flop_names u_none', hidden: true },
      { pre: 'read_netlist {u_x/a1 INV_X1 u_x/f1 DFF_X4}', call: 'flop_names u_x', hidden: true },
      { pre: 'read_netlist {u_x/z9 DFF_X1 u_x/b1 DFF_X2 u_x/a3 LAT_X1 u_x/m1 DFFR_X1}', call: 'flop_names u_x', hidden: true },
    ],
  }),
};

const catchLvl: CodeLevel = {
  id: 'code-tcl-catch', title: 'Bug hunt: the script that dies', concept: 'catch turns an error into a return code and a message', xp: 170, tier: 'debug', lang: 'tcl',
  ticket: 'The report script stops at the first missing object and the nightly flow dies with it. Make it carry on.',
  build: () => ({
    brief: `<p><code>attr_or {name attr default}</code> should return attribute <code>attr</code> of the cell called <code>name</code>, or <code>default</code> when it cannot (no such cell, or no such attribute). At the moment any such problem is an error that kills the script. Fix it so it never raises.</p>
<p>In Tcl an error is not an exception object: <code>catch {script} result</code> returns <code>0</code> if the script worked (the value is in <code>result</code>) or <code>1</code> if it failed (the message is in <code>result</code>).</p>`,
    starter: 'proc attr_or {name attr default} {\n    return [get_attribute [get_cells $name] $attr]\n}\n',
    hints: ['Run the risky command inside catch and keep its value: if {[catch {get_attribute ... } value]} { ... }.', 'When catch returns 1 the variable holds an error message, not the value: return $default then.'],
    solution: `proc attr_or {name attr default} {
    if {[catch {get_attribute [get_cells $name] $attr} value]} {
        return $default
    }
    return $value
}
`,
    cases: [
      { pre: DESIGN, call: 'attr_or u_core/r1 ref_name none' },
      { pre: DESIGN, call: 'attr_or ghost/r9 ref_name n/a' },
      { pre: DESIGN, call: 'attr_or u_io/b1 vt_class lvt' },
      { pre: DESIGN, call: 'attr_or u_io/r3 is_sequential no', hidden: true },
      { pre: DESIGN, call: 'attr_or u_core/* ref_name many', hidden: true },
    ],
  }),
};

// ---------------------------------------------------------------- boss: violations by block

const reportText = (r: Rng, lines: number) => {
  const blocks = ['u_alu', 'u_fifo', 'u_ctrl', 'u_dma'];
  const rows: string[] = ['Timing report: setup, worst paths'];
  for (let i = 0; i < lines; i++) {
    const s = between(r, -40, 60) / 100;
    rows.push(`${pick(r, blocks)}/r${between(r, 1, 9)}/D slack ${s.toFixed(2)}`);
    if (i % 4 === 2) rows.push('');
  }
  return rows.join('\n');
};

const boss: CodeLevel = {
  id: 'code-tcl-boss', title: 'Boss: violations by block', concept: 'parse, group and sort a slack report', xp: 360, tier: 'boss', lang: 'tcl',
  ticket: 'The morning timing summary: how many endpoints fail in each block. Three reports of growing size. No hints.',
  build: (r: Rng) => {
    const a = reportText(r, 6), b = reportText(r, 14), c = reportText(r, 30), d = reportText(r, 40);
    return {
      brief: `<p>A report line looks like <code>u_alu/r3/D slack -0.12</code>; other lines (headings, blanks) are ignored. The <b>block</b> is the text before the first <code>/</code>. An endpoint <b>violates</b> when its slack is below zero (zero passes).</p>
<p>Write <code>proc violations {report}</code> returning a dict from block to its number of violating endpoints. Include only blocks with at least one violation, with the keys sorted alphabetically. If nothing fails, return an empty string.</p>`,
      starter: 'proc violations {report} {\n    return {}\n}\n',
      hints: [],
      solution: `proc violations {report} {
    set counts {}
    foreach line [split $report "\\n"] {
        if {[regexp {^([^/]+)/\\S+ slack (-?[0-9.]+)$} $line -> block sl] && $sl < 0} {
            dict incr counts $block
        }
    }
    set out {}
    foreach block [lsort [dict keys $counts]] {
        dict set out $block [dict get $counts $block]
    }
    return $out
}
`,
      cases: [
        { call: `violations {${a}}` },
        { call: `violations {${b}}` },
        { call: `violations {${c}}`, hidden: true },
        { call: `violations {${d}}`, hidden: true },
        { call: 'violations {u_alu/r1/D slack 0.00\nu_alu/r2/D slack 0.10}', hidden: true },
      ],
    };
  },
};

export const TCL_LEVELS: CodeLevel[] = [subst, census, slackParse, flops, catchLvl, boss];

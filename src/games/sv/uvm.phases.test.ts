import { describe, expect, it } from 'vitest';
import { runSv } from './run';

// E9: build and final run top-down; connect, end_of_elaboration, start_of_simulation, extract, check, report run bottom-up.
const PH = ['build', 'connect', 'end_of_elaboration', 'start_of_simulation', 'extract', 'check', 'report', 'final'] as const;
const fn = (p: string) => `function void ${p}_phase(uvm_phase phase); \`uvm_info("ORD", $sformatf("${p} %s", get_name()), UVM_LOW) endfunction`;
const SRC = `
import uvm_pkg::*;
\`include "uvm_macros.svh"
class leaf extends uvm_component;
  \`uvm_component_utils(leaf)
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  ${PH.filter((p) => p !== 'build').map(fn).join('\n  ')}
endclass
class mid extends uvm_component;
  \`uvm_component_utils(mid)
  leaf l1, l2;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    \`uvm_info("ORD", "build mid", UVM_LOW)
    l1 = leaf::type_id::create("l1", this);
    l2 = leaf::type_id::create("l2", this);
  endfunction
  ${PH.filter((p) => p !== 'build').map(fn).join('\n  ')}
endclass
class test extends uvm_test;
  \`uvm_component_utils(test)
  mid m;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    \`uvm_info("ORD", "build test", UVM_LOW)
    m = mid::type_id::create("m", this);
  endfunction
  ${PH.filter((p) => p !== 'build').map(fn).join('\n  ')}
endclass
module top; initial run_test("test"); endmodule
`;

const order = (ph: string) => {
  const r = runSv(SRC, { maxTime: 1000, uvm: true });
  if (r.parseError) throw new Error(`parse error line ${r.parseError.line}: ${r.parseError.msg}`);
  expect(r.error).toBeUndefined();
  return r.log.filter((l) => l.includes('[ORD]') && l.includes(` ${ph} `)).map((l) => l.split(`${ph} `)[1].trim());
};

describe('mini UVM phase order (E9)', () => {
  it('build and final go top-down', () => {
    expect(order('build')).toEqual(['test', 'mid']); // leaves are created in mid.build, which has no print of its own
    expect(order('final')).toEqual(['uvm_test_top', 'm', 'l1', 'l2']);
  });
  it.each(['connect', 'end_of_elaboration', 'start_of_simulation', 'extract', 'check', 'report'])('%s goes bottom-up', (p) => {
    expect(order(p)).toEqual(['l1', 'l2', 'm', 'uvm_test_top']);
  });
});

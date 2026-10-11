// UVM puzzles: assemble a testbench, order the phases, complete real UVM code.

export interface Slot {
  id: string;
  answer: string;
  x: number; // % positions inside the diagram
  y: number;
  w: number;
  h: number;
  parent?: string;
}

export interface ArchPuzzle {
  kind: 'arch';
  id: string;
  title: string;
  concept: string;
  xp: number;
  brief: string;
  palette: { id: string; label: string; tip: string }[];
  slots: Slot[];
  wires: { from: string; to: string; label: string }[];
}

export interface OrderPuzzle {
  kind: 'order';
  id: string;
  title: string;
  concept: string;
  xp: number;
  brief: string;
  items: { id: string; label: string; note: string }[]; // correct order
}

export interface Blank {
  options: string[];
  answer: string;
  why: string;
}

export interface CodePuzzle {
  kind: 'code';
  id: string;
  title: string;
  concept: string;
  xp: number;
  brief: string;
  /** Code with {{n}} placeholders referring to blanks[n]. */
  code: string;
  blanks: Blank[];
}

export type UvmPuzzle = ArchPuzzle | OrderPuzzle | CodePuzzle;

export const UVM_PUZZLES: UvmPuzzle[] = [
  {
    kind: 'arch',
    id: 'uvm-arch',
    title: 'Assemble the Testbench',
    concept: 'UVM component hierarchy',
    xp: 200,
    brief: `
      <p>UVM testbenches have the same skeleton everywhere, which is why engineers can move between projects (and why
      interviewers ask you to draw it on a whiteboard).</p>
      <ul><li><b>Agent</b> = everything for one interface: sequencer, driver, monitor.</li>
      <li><b>Driver</b> turns transactions into pin wiggles; <b>monitor</b> turns pin wiggles back into transactions.</li>
      <li><b>Scoreboard</b> checks results; a <b>subscriber</b> collects functional coverage.</li>
      <li><b>Env</b> holds agents and checkers; the <b>test</b> configures the env and starts sequences.</li></ul>
      <p>Select a component in the palette, then click the slot where it belongs.</p>`,
    palette: [
      { id: 'test', label: 'uvm_test', tip: 'Top of the class hierarchy: configures the env, starts sequences' },
      { id: 'env', label: 'uvm_env', tip: 'Container for agents, scoreboards and coverage' },
      { id: 'agent', label: 'uvm_agent', tip: 'Bundle of sequencer + driver + monitor for one interface' },
      { id: 'sqr', label: 'uvm_sequencer', tip: 'Arbitrates between sequences and hands items to the driver' },
      { id: 'drv', label: 'uvm_driver', tip: 'Pulls sequence items and drives DUT pins' },
      { id: 'mon', label: 'uvm_monitor', tip: 'Passively samples pins and broadcasts transactions' },
      { id: 'scb', label: 'uvm_scoreboard', tip: 'Compares DUT behaviour against a reference model' },
      { id: 'cov', label: 'uvm_subscriber', tip: 'Samples covergroups from monitored transactions' },
      { id: 'seq', label: 'uvm_sequence', tip: 'Generates transactions (not a component - an object!)' },
      { id: 'dut', label: 'DUT + interface', tip: 'The RTL, connected through a virtual interface' },
    ],
    slots: [
      { id: 's-test', answer: 'test', x: 2, y: 2, w: 96, h: 80 },
      { id: 's-seq', answer: 'seq', x: 6, y: 9, w: 22, h: 9, parent: 's-test' },
      { id: 's-env', answer: 'env', x: 5, y: 22, w: 90, h: 57, parent: 's-test' },
      { id: 's-agent', answer: 'agent', x: 8, y: 29, w: 52, h: 46, parent: 's-env' },
      { id: 's-sqr', answer: 'sqr', x: 11, y: 37, w: 22, h: 10, parent: 's-agent' },
      { id: 's-drv', answer: 'drv', x: 11, y: 60, w: 22, h: 10, parent: 's-agent' },
      { id: 's-mon', answer: 'mon', x: 36, y: 60, w: 21, h: 10, parent: 's-agent' },
      { id: 's-scb', answer: 'scb', x: 66, y: 34, w: 26, h: 11, parent: 's-env' },
      { id: 's-cov', answer: 'cov', x: 66, y: 58, w: 26, h: 11, parent: 's-env' },
      { id: 's-dut', answer: 'dut', x: 18, y: 88, w: 40, h: 10 },
    ],
    wires: [
      { from: 's-seq', to: 's-sqr', label: 'seq.start(sqr)' },
      { from: 's-sqr', to: 's-drv', label: 'seq_item_export ↔ seq_item_port' },
      { from: 's-drv', to: 's-dut', label: 'vif' },
      { from: 's-dut', to: 's-mon', label: 'vif' },
      { from: 's-mon', to: 's-scb', label: 'analysis_port' },
      { from: 's-mon', to: 's-cov', label: 'analysis_port' },
    ],
  },
  {
    kind: 'order',
    id: 'uvm-phases',
    title: 'Phase Shift',
    concept: 'UVM phasing',
    xp: 150,
    brief: `
      <p>Every UVM component goes through the same <b>phases</b>, in lockstep. Knowing the order (and which ones consume
      simulation time) is a guaranteed interview question.</p>
      <ul><li><b>build</b> runs <i>top-down</i> (a parent must exist before it creates its children).</li>
      <li><b>connect</b> runs <i>bottom-up</i> once everything is built.</li>
      <li><b>run</b> is the only one here that's a <code>task</code> and consumes time; the rest are functions.</li></ul>
      <p>Click the phases in the order they execute.</p>`,
    items: [
      { id: 'build', label: 'build_phase', note: 'create child components, get config_db settings (top-down)' },
      { id: 'connect', label: 'connect_phase', note: 'hook up TLM ports and exports (bottom-up)' },
      { id: 'eoe', label: 'end_of_elaboration_phase', note: 'topology is final; print it, tweak it' },
      { id: 'sos', label: 'start_of_simulation_phase', note: 'last chance before time starts: banners, config checks' },
      { id: 'run', label: 'run_phase', note: 'the only time-consuming phase here: drive stimulus (a task)' },
      { id: 'extract', label: 'extract_phase', note: 'gather results from scoreboards and coverage' },
      { id: 'check', label: 'check_phase', note: 'check for leftover expected items, final state' },
      { id: 'report', label: 'report_phase', note: 'print pass/fail summary' },
      { id: 'final', label: 'final_phase', note: 'close files, tidy up' },
    ],
  },
  {
    kind: 'code',
    id: 'uvm-code',
    title: 'Drive It Home',
    concept: 'driver, sequence & objections',
    xp: 250,
    brief: `
      <p>Time to read real UVM. The driver and sequencer talk through a handshake:
      the sequence calls <code>start_item</code>/<code>finish_item</code>, the driver calls
      <code>get_next_item</code>/<code>item_done</code>. The test keeps the simulation alive with an <b>objection</b>
      &mdash; forget it and the run phase ends at time 0 with zero transactions (a classic!).</p>
      <p>Pick the right word for every blank.</p>`,
    code: `class alu_driver extends {{0}} #(alu_txn);
  \`uvm_component_utils(alu_driver)
  virtual alu_if vif;

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::{{1}}(this, "", "vif", vif))
      \`uvm_fatal("NOVIF", "virtual interface not set")
  endfunction

  {{2}} run_phase(uvm_phase phase);
    forever begin
      seq_item_port.{{3}}(req);
      @(posedge vif.clk);
      vif.op <= req.op;  vif.a <= req.a;  vif.b <= req.b;
      seq_item_port.{{4}}();
    end
  end{{2}}
endclass

class alu_seq extends uvm_sequence #(alu_txn);
  \`uvm_object_utils(alu_seq)
  task body();
    repeat (100) begin
      req = alu_txn::type_id::{{5}}("req");
      {{6}}(req);
      if (!req.randomize() with { op inside {ADD, SUB}; })
        \`uvm_error("RAND", "randomization failed")
      {{7}}(req);
    end
  endtask
endclass

class alu_test extends uvm_test;
  alu_env env;
  task run_phase(uvm_phase phase);
    alu_seq seq = alu_seq::type_id::create("seq");
    phase.{{8}}(this);
    seq.start(env.agent.{{9}});
    phase.drop_objection(this);
  endtask
endclass`,
    blanks: [
      { options: ['uvm_driver', 'uvm_component', 'uvm_object'], answer: 'uvm_driver', why: 'uvm_driver is parameterized by the item type and gives you seq_item_port and req.' },
      { options: ['get', 'set', 'exists'], answer: 'get', why: 'The top module calls set() to publish the interface; components call get() to retrieve it.' },
      { options: ['task', 'function'], answer: 'task', why: 'run_phase consumes simulation time, so it must be a task.' },
      { options: ['get_next_item', 'try_next_item', 'put'], answer: 'get_next_item', why: 'get_next_item blocks until the sequencer has an item. try_next_item returns null immediately if there is none.' },
      { options: ['item_done', 'finish_item', 'put_response'], answer: 'item_done', why: 'item_done completes the handshake and unblocks finish_item in the sequence.' },
      { options: ['create', 'new', 'build'], answer: 'create', why: 'Always use the factory (type_id::create) so tests can override the type.' },
      { options: ['start_item', 'get_next_item', 'send'], answer: 'start_item', why: 'start_item waits for the sequencer to grant access. Randomize after it, so late constraints can be applied.' },
      { options: ['finish_item', 'item_done', 'end_item'], answer: 'finish_item', why: 'finish_item sends the item to the driver and waits for item_done.' },
      { options: ['raise_objection', 'drop_objection', 'wait_for'], answer: 'raise_objection', why: 'Without a raised objection, the run phase ends immediately at time 0.' },
      { options: ['sqr', 'drv', 'mon'], answer: 'sqr', why: 'Sequences run on a sequencer.' },
    ],
  },
  {
    kind: 'code',
    id: 'uvm-config',
    title: 'Hand Me the Config',
    concept: 'uvm_config_db set and get',
    xp: 200,
    brief: `
      <p>Tests tune components without touching them. The test <b>publishes</b> a value into the <b>config_db</b>, and a
      component <b>retrieves</b> it by name. Two rules catch most mistakes: the parent must set the value <i>before</i> it
      creates the child, and the type must match exactly on both sides.</p>
      <p>The search starts at the <i>context</i> you pass in, and the instance name is relative to it. If the get fails,
      the component quietly keeps its default, so this bug is easy to miss.</p>
      <p>Pick the right word for every blank.</p>`,
    code: `class alu_test extends uvm_test;
  \`uvm_component_utils(alu_test)
  alu_env env;

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    uvm_config_db#(int unsigned)::{{0}}(this, "env*", "num_txns", 250);
    env = alu_env::type_id::create("env", this);
  endfunction
endclass

class alu_env extends uvm_env;
  \`uvm_component_utils(alu_env)
  int unsigned num_txns = 100;

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(int unsigned)::{{1}}({{2}}, "", "num_txns", num_txns))
      \`uvm_info("CFG", "num_txns not set, using 100", UVM_LOW)
  endfunction
endclass`,
    blanks: [
      { options: ['set', 'get', 'exists'], answer: 'set', why: 'The parent publishes the value with set(). The test calls it before it creates the env, so the value is waiting when the env builds.' },
      { options: ['get', 'set', 'exists'], answer: 'get', why: 'The child fetches the value with get(). If nothing matches, get() returns 0 and the default of 100 stays.' },
      { options: ['this', 'null', 'get_parent()'], answer: 'this', why: 'The search starts at env, so the empty instance name matches the "env*" pattern set by the test. null starts at the top of the tree, and get_parent() is the test itself, so both miss.' },
    ],
  },
  {
    kind: 'code',
    id: 'uvm-override',
    title: 'Swap the Driver',
    concept: 'uvm_factory type overrides',
    xp: 200,
    brief: `
      <p>The factory lets a test change a component without editing the environment. Components never call <code>new</code>
      for a driver: they ask <code>type_id::create</code>. A test registers an <b>override</b> first, and every later create
      of the original type builds the replacement instead.</p>
      <ul><li><b>set_type_override</b> swaps every instance of a type.</li>
      <li><b>set_inst_override</b> swaps only the instance found at one path.</li></ul>
      <p>Register the override in the test's <code>build_phase</code>, before the env is created. The replacement must
      extend the original, so the environment still gets a driver it can use.</p>
      <p>Pick the right word for every blank.</p>`,
    code: `class err_driver extends alu_driver;
  \`uvm_component_utils(err_driver)
  // same handshake as alu_driver, but it corrupts one operand on the pins
endclass

class alu_test extends uvm_test;
  \`uvm_component_utils(alu_test)
  alu_env env;

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    {{0}}::type_id::{{1}}({{2}}::get_type());
    env = alu_env::type_id::create("env", this);
  endfunction
endclass`,
    blanks: [
      { options: ['alu_driver', 'alu_monitor', 'alu_env'], answer: 'alu_driver', why: 'You name the type being replaced. After this, every create of alu_driver builds the override instead.' },
      { options: ['set_inst_override', 'set_type_override', 'create'], answer: 'set_type_override', why: 'set_type_override swaps every instance of the type. set_inst_override only changes one instance, found by its path. create builds an object and changes nothing.' },
      { options: ['alu_driver', 'err_driver', 'alu_monitor'], answer: 'err_driver', why: 'The override is the replacement. It extends alu_driver, so it has the same ports and handshake.' },
    ],
  },
];

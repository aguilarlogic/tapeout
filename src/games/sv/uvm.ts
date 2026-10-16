// A compact UVM library written in the SV subset this interpreter understands.
// It follows the real library's structure (phases, objections, factory, config_db, sequences) without the automation macros.

export const UVM_MACROS = [
  '`define uvm_info(ID, MSG, VERB) $uvm_report("INFO", ID, MSG, VERB);',
  '`define uvm_warning(ID, MSG) $uvm_report("WARNING", ID, MSG, 0);',
  '`define uvm_error(ID, MSG) $uvm_report("ERROR", ID, MSG, 0);',
  '`define uvm_fatal(ID, MSG) $uvm_report("FATAL", ID, MSG, 0);',
  '`define uvm_component_utils(T)',
  '`define uvm_object_utils(T)',
  '`define uvm_component_param_utils(T)',
  '`define uvm_object_param_utils(T)',
  '`define uvm_component_utils_begin(T)',
  '`define uvm_component_utils_end',
  '`define uvm_object_utils_begin(T)',
  '`define uvm_object_utils_end',
  '`define uvm_field_int(A, F)',
  '`define uvm_field_string(A, F)',
  '`define uvm_field_object(A, F)',
  '`define uvm_field_real(A, F)',
  '`define uvm_field_enum(T, A, F)',
  '`define uvm_field_queue_int(A, F)',
  '`define uvm_field_array_int(A, F)',
  '`define uvm_declare_p_sequencer(SEQR) SEQR p_sequencer;',
  '`define uvm_create(ITEM) ITEM = $new_like(ITEM);',
  '`define uvm_do(ITEM) begin `uvm_create(ITEM) start_item(ITEM); void\'(ITEM.randomize()); finish_item(ITEM); end',
  '`define uvm_do_with(ITEM, C) begin `uvm_create(ITEM) start_item(ITEM); void\'(ITEM.randomize() with C); finish_item(ITEM); end',
  '`define uvm_send(ITEM) begin start_item(ITEM); finish_item(ITEM); end',
  '`define uvm_rand_send(ITEM) begin start_item(ITEM); void\'(ITEM.randomize()); finish_item(ITEM); end',
].join('\n');

export const UVM_PRELUDE = `
typedef enum int { UVM_NONE = 0, UVM_LOW = 100, UVM_MEDIUM = 200, UVM_HIGH = 300, UVM_FULL = 400, UVM_DEBUG = 500 } uvm_verbosity;
typedef enum { UVM_ACTIVE, UVM_PASSIVE } uvm_active_passive_enum;

class uvm_object;
  string m_name;
  string m_full;
  function new(string name = "");
    m_name = name;
    m_full = name;
  endfunction
  virtual function string get_name(); return m_name; endfunction
  virtual function void set_name(string n); m_name = n; endfunction
  virtual function string get_full_name(); return m_full; endfunction
  virtual function string get_type_name(); return $classname(this); endfunction
  virtual function string convert2string(); return ""; endfunction
  virtual function void print(); $display("%s", convert2string()); endfunction
  virtual function string sprint(); return convert2string(); endfunction
  virtual function void do_copy(uvm_object rhs); endfunction
  virtual function bit do_compare(uvm_object rhs); return 1; endfunction
  function void copy(uvm_object rhs); do_copy(rhs); endfunction
  function bit compare(uvm_object rhs); return do_compare(rhs); endfunction
  virtual function uvm_object clone();
    uvm_object c = $uvm_shallow_copy(this);
    return c;
  endfunction
endclass

class uvm_transaction extends uvm_object;
  function new(string name = ""); super.new(name); endfunction
endclass

class uvm_phase;
  int m_objections = 0;
  string m_name;
  function new(string name = ""); m_name = name; endfunction
  function string get_name(); return m_name; endfunction
  function void raise_objection(uvm_object obj = null, string description = "", int count = 1);
    m_objections += count;
  endfunction
  function void drop_objection(uvm_object obj = null, string description = "", int count = 1);
    m_objections -= count;
  endfunction
endclass

class uvm_component extends uvm_object;
  uvm_component m_parent;
  uvm_component m_children[$];
  function new(string name, uvm_component parent = null);
    super.new(name);
    m_parent = parent;
    if (parent != null) begin
      m_full = {parent.m_full, ".", name};
      parent.m_children.push_back(this);
    end else m_full = name;
  endfunction
  virtual function uvm_component get_parent(); return m_parent; endfunction
  function int get_num_children(); return m_children.size(); endfunction
  virtual function void build_phase(uvm_phase phase); endfunction
  virtual function void connect_phase(uvm_phase phase); endfunction
  virtual function void end_of_elaboration_phase(uvm_phase phase); endfunction
  virtual function void start_of_simulation_phase(uvm_phase phase); endfunction
  virtual task run_phase(uvm_phase phase); endtask
  virtual function void extract_phase(uvm_phase phase); endfunction
  virtual function void check_phase(uvm_phase phase); endfunction
  virtual function void report_phase(uvm_phase phase); endfunction
  virtual function void final_phase(uvm_phase phase); endfunction
endclass

class uvm_test extends uvm_component;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
endclass
class uvm_env extends uvm_component;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
endclass
class uvm_agent extends uvm_component;
  uvm_active_passive_enum is_active = UVM_ACTIVE;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
  virtual function uvm_active_passive_enum get_is_active(); return is_active; endfunction
endclass
class uvm_monitor extends uvm_component;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
endclass
class uvm_scoreboard extends uvm_component;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
endclass

// ── analysis ports ──
class uvm_analysis_port extends uvm_object;
  uvm_analysis_port m_subs[$];
  uvm_component m_owner;
  function new(string name, uvm_component parent = null);
    super.new(name);
    m_owner = parent;
  endfunction
  function void connect(uvm_analysis_port other); m_subs.push_back(other); endfunction
  virtual function void write(uvm_object t);
    foreach (m_subs[i]) m_subs[i].write(t);
  endfunction
endclass
class uvm_analysis_export extends uvm_analysis_port;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
endclass
class uvm_analysis_imp extends uvm_analysis_port;
  function new(string name, uvm_component parent = null); super.new(name, parent); endfunction
  virtual function void write(uvm_object t); m_owner.write(t); endfunction
endclass

class uvm_subscriber extends uvm_component;
  uvm_analysis_imp analysis_export;
  function new(string name, uvm_component parent = null);
    super.new(name, parent);
    analysis_export = new("analysis_export", this);
  endfunction
  pure virtual function void write(uvm_object t);
endclass

class uvm_tlm_analysis_fifo extends uvm_component;
  mailbox #(uvm_object) m_mb;
  uvm_analysis_imp analysis_export;
  function new(string name, uvm_component parent = null);
    super.new(name, parent);
    m_mb = new();
    analysis_export = new("analysis_export", this);
  endfunction
  function void write(uvm_object t); m_mb.put(t); endfunction
  task get(output uvm_object t); m_mb.get(t); endtask
  task peek(output uvm_object t); m_mb.peek(t); endtask
  function bit try_get(output uvm_object t); return m_mb.try_get(t); endfunction
  function int used(); return m_mb.num(); endfunction
  function bit is_empty(); return m_mb.num() == 0; endfunction
endclass

// ── sequences ──
class uvm_sequence_item extends uvm_transaction;
  uvm_component m_sequencer_c;
  bit m_finished;
  function new(string name = ""); super.new(name); endfunction
  function uvm_component get_sequencer(); return m_sequencer_c; endfunction
endclass

class uvm_sequencer extends uvm_component;
  mailbox #(uvm_sequence_item) m_q;
  uvm_sequence_item m_cur;
  function new(string name, uvm_component parent = null);
    super.new(name, parent);
    m_q = new();
  endfunction
  task get_next_item(output uvm_sequence_item item);
    m_q.get(item);
    m_cur = item;
  endtask
  function bit try_next_item(output uvm_sequence_item item);
    if (!m_q.try_get(item)) return 0;
    m_cur = item;
    return 1;
  endfunction
  function void item_done(uvm_sequence_item rsp = null);
    m_cur.m_finished = 1;
  endfunction
  task send_request(uvm_sequence_item item);
    m_q.put(item);
    wait (item.m_finished == 1);
  endtask
endclass

class uvm_seq_item_pull_port extends uvm_object;
  uvm_sequencer m_sqr;
  function new(string name, uvm_component parent = null); super.new(name); endfunction
  function void connect(uvm_sequencer s); m_sqr = s; endfunction
  task get_next_item(output uvm_sequence_item item);
    if (m_sqr == null) $uvm_report("FATAL", "NOSQR", "seq_item_port is not connected to a sequencer (connect_phase?)", 0);
    m_sqr.get_next_item(item);
  endtask
  function bit try_next_item(output uvm_sequence_item item); return m_sqr.try_next_item(item); endfunction
  function void item_done(uvm_sequence_item rsp = null); m_sqr.item_done(rsp); endfunction
endclass

class uvm_driver extends uvm_component;
  uvm_sequence_item req;
  uvm_seq_item_pull_port seq_item_port;
  function new(string name, uvm_component parent = null);
    super.new(name, parent);
    seq_item_port = new("seq_item_port", this);
  endfunction
endclass

class uvm_sequence extends uvm_sequence_item;
  uvm_sequencer m_sequencer;
  uvm_sequence_item req;
  function new(string name = ""); super.new(name); endfunction
  virtual task pre_body(); endtask
  virtual task body(); endtask
  virtual task post_body(); endtask
  task start(uvm_sequencer sqr, uvm_sequence parent = null);
    m_sequencer = sqr;
    $uvm_set_field(this, "p_sequencer", sqr);
    pre_body();
    body();
    post_body();
  endtask
  function uvm_sequencer get_sequencer(); return m_sequencer; endfunction
  task start_item(uvm_sequence_item item);
    item.m_finished = 0;
    item.m_sequencer_c = m_sequencer;
  endtask
  task finish_item(uvm_sequence_item item);
    m_sequencer.send_request(item);
  endtask
endclass

// ── configuration database ──
class uvm_config_entry;
  string path;
  string field;
  var value;
  int depth;
endclass

class uvm_config_db;
  static uvm_config_entry m_db[$];
  static function void set(uvm_component cntxt, string inst_name, string field_name, var value);
    uvm_config_entry e = new;
    string base = "";
    if (cntxt != null) base = cntxt.get_full_name();
    if (base == "") e.path = inst_name;
    else if (inst_name == "") e.path = base;
    else e.path = {base, ".", inst_name};
    e.field = field_name;
    e.value = value;
    e.depth = (cntxt == null) ? 0 : cntxt.get_full_name().len();
    m_db.push_back(e);
  endfunction
  static function bit get(uvm_component cntxt, string inst_name, string field_name, inout var value);
    string base = "";
    string target;
    int best = -1;
    if (cntxt != null) base = cntxt.get_full_name();
    if (base == "") target = inst_name;
    else if (inst_name == "") target = base;
    else target = {base, ".", inst_name};
    foreach (m_db[i]) begin
      if (m_db[i].field == field_name && $uvm_glob(m_db[i].path, target)) begin
        if (best < 0 || m_db[i].depth <= m_db[best].depth) best = i;
      end
    end
    if (best < 0) return 0;
    value = m_db[best].value;
    return 1;
  endfunction
endclass

// ── factory ──
class uvm_factory;
  static uvm_factory m_inst;
  static function uvm_factory get();
    if (m_inst == null) m_inst = new;
    return m_inst;
  endfunction
  function void set_type_override_by_type(string orig, string over, bit replace = 1); $uvm_set_type_override(orig, over); endfunction
  function void set_type_override_by_name(string orig, string over, bit replace = 1); $uvm_set_type_override(orig, over); endfunction
  function void set_inst_override_by_type(string orig, string over, string path); $uvm_set_inst_override(orig, over, path); endfunction
  function void set_inst_override_by_name(string orig, string over, string path); $uvm_set_inst_override(orig, over, path); endfunction
  function void print(); endfunction
endclass

class uvm_root extends uvm_component;
  function new(string name = "uvm_top"); super.new(name, null); endfunction
  function void set_report_verbosity_level_hier(int v); $uvm_set_verbosity(v); endfunction
  function void set_report_verbosity_level(int v); $uvm_set_verbosity(v); endfunction
  function void set_timeout(time t, bit overridable = 1); endfunction
endclass

uvm_factory factory = uvm_factory::get();
uvm_root uvm_top = new("uvm_top");
uvm_component uvm_test_top;

function void uvm_report_info(string id, string msg, int verbosity = 200); $uvm_report("INFO", id, msg, verbosity); endfunction
function void uvm_report_warning(string id, string msg); $uvm_report("WARNING", id, msg, 0); endfunction
function void uvm_report_error(string id, string msg); $uvm_report("ERROR", id, msg, 0); endfunction
function void uvm_report_fatal(string id, string msg); $uvm_report("FATAL", id, msg, 0); endfunction

function void uvm_collect(uvm_component c, ref uvm_component all[$]);
  all.push_back(c);
  foreach (c.m_children[i]) uvm_collect(c.m_children[i], all);
endfunction

// children before parents: the order of the bottom-up function phases
function void uvm_collect_up(uvm_component c, ref uvm_component all[$]);
  foreach (c.m_children[i]) uvm_collect_up(c.m_children[i], all);
  all.push_back(c);
endfunction

function void uvm_do_build(uvm_component c, uvm_phase ph);
  c.build_phase(ph);
  foreach (c.m_children[i]) uvm_do_build(c.m_children[i], ph);
endfunction

function void uvm_do_connect(uvm_component c, uvm_phase ph);
  foreach (c.m_children[i]) uvm_do_connect(c.m_children[i], ph);
  c.connect_phase(ph);
endfunction

task run_test(string test_name = "");
  uvm_component all[$], up[$];
  uvm_phase ph = new("run");
  uvm_component top;
  if (test_name == "") $uvm_report("FATAL", "NOTEST", "run_test() needs a test name", 0);
  top = $new_by_name(test_name, "uvm_test_top", null);
  uvm_test_top = top;
  uvm_do_build(top, ph);
  uvm_do_connect(top, ph);
  uvm_collect(top, all);
  uvm_collect_up(top, up);
  foreach (up[i]) up[i].end_of_elaboration_phase(ph);
  foreach (up[i]) up[i].start_of_simulation_phase(ph);
  foreach (all[i]) begin
    automatic uvm_component c = all[i];
    fork c.run_phase(ph); join_none
  end
  #0;
  #0;
  wait (ph.m_objections == 0);
  foreach (up[i]) up[i].extract_phase(ph);
  foreach (up[i]) up[i].check_phase(ph);
  foreach (up[i]) up[i].report_phase(ph);
  foreach (all[i]) all[i].final_phase(ph); // final is top-down
  $display("--- UVM Report Summary ---");
  $display("UVM_INFO    : %0d", $uvm_count("info"));
  $display("UVM_WARNING : %0d", $uvm_count("warning"));
  $display("UVM_ERROR   : %0d", $uvm_count("error"));
  $display("UVM_FATAL   : %0d", $uvm_count("fatal"));
  $finish;
endtask
`;

// Chapter-boss incidents for Act 5, Verification and Test. The chip is ADA-4 (the multicore SoC), or ADA-3's core for DFT.
// Each cause is a fault in the player's own verification environment or test logic, not in the design it checks.
import type { Incident } from './types';
import { table } from './util';

// ------------------------------------------------------------------ 1. Testbenches & debug: a regression that passes a broken design

export const tbIncident: Incident = {
  id: 'inc-tb',
  title: 'The Pass That Checked Nothing',
  concept: 'a testbench passes a broken design. Find why its checks let the bug through, and which check it is.',
  xp: 320,
  budget: 100,
  pager: 'PAGER · SEV-2 · The ADA-4 crossbar regression is green on every seed, but the bring-up lab sees wrong data on some paths through the crossbar. The testbench is the directed and random env you wrote this chapter. You have 100 minutes on the simulator farm.',
  causes: [
    {
      id: 'scb', name: 'The scoreboard compares the input word, not the DUT output',
      fix: 'Compare the expected value with the DUT output, not the input',
      story: 'The scoreboard compared the expected value with the monitor\'s copy of the input word, so it checked the wrong bus. The crossbar\'s outputs were never compared, and the report still said 0 errors.',
    },
    {
      id: 'race', name: 'Driver and monitor both sample on the same clock edge, with no skew',
      fix: 'Move the driver onto a clocking block with an input skew',
      story: 'The driver changed the inputs with blocking assignments on the clock edge, and the monitor sampled on that same edge with no skew. The monitor saw the new value or the old one, depending on the simulator\'s event order. Reversing the order changed the transfer count.',
    },
    {
      id: 'tmo', name: 'The test waits on done with no timeout, and no check counts compares',
      fix: 'Put a timeout on wait(done) and fail on zero compares',
      story: 'The base test waited on done with no timeout. Only a global watchdog ended the run, so the test body never finished. The summary printed 0 errors and 0 compares. Nothing compared means nothing failed, so the run passed.',
    },
    {
      id: 'xprop', name: 'The scoreboard copies the output into a 2-state variable, so X becomes 0',
      fix: 'Keep the output 4-state (logic), so an X fails the compare',
      story: 'The scoreboard copied dut.out into a bit vector. Assigning a 4-state value to a 2-state variable turns every X into 0. An X output matched an expected 0, and the compare passed. The raw output shows the X.',
    },
    {
      id: 'enb', name: 'A check_en flag gates the compare, and random tests leave it at 0',
      fix: 'Set check_en to 1 in the base config, so every test checks',
      story: 'The compare ran only when cfg.check_en was set. The directed test set it, but the random tests inherited the default of 0. Random traffic was never compared, so the run reported 0 errors and 0 compares.',
    },
  ],
  bandaids: [
    {
      text: 'Add more random seeds to the regression and rerun it',
      why: 'Each seed runs the same blind spot. More seeds only adds more green results, and the check that never runs still never runs.',
    },
    {
      text: 'Put a #1 delay before every compare so the values settle',
      why: 'A delay changes when the compare runs, not what it compares. The scoreboard still checks the wrong bus, or does not check at all.',
    },
  ],
  instruments: [
    {
      cmd: 'summary', cost: 15, what: 'the summary of the random test that failed, one seed',
      read: (w) => {
        if (w.cause === 'tmo') return 'test_xbar_rand, seed 7\ncompares 0 · errors 0 · PASS\nsim ended by the global limit (100 us), test body still running';
        if (w.cause === 'enb') return 'test_xbar_rand, seed 7\ncompares 0 · errors 0 · PASS\nsim ended after the test body';
        return 'test_xbar_rand, seed 7\ncompares 1000 · errors 0 · PASS';
      },
    },
    {
      cmd: 'dut', cost: 30, what: 'the raw crossbar output against the golden model, 1000 vectors, no testbench checks',
      read: (w) => `raw DUT output vs golden model, 1000 vectors\nmismatches: 31 · ${w.cause === 'xprop' ? 'of which 4 are X (unknown)' : 'none are X'}`,
    },
    {
      cmd: 'order', cost: 30, what: 'the directed test, run in two simulator event orders',
      read: (w) => {
        if (w.cause === 'tmo') return 'directed test, event order A: compares 0\ndirected test, event order B: compares 0\nidentical';
        if (w.cause === 'race') return 'directed test, event order A: compares 1000 · errors 0\ndirected test, event order B: compares 968 · errors 0\ndiffers between orders';
        return 'directed test, event order A: compares 1000 · errors 0\ndirected test, event order B: compares 1000 · errors 0\nidentical';
      },
    },
    {
      cmd: 'cfg', cost: 15, what: 'the settings the random test ran with',
      read: (w) => {
        if (w.cause === 'enb') return 'test_xbar_rand settings\ncheck_en: 0 (set by directed_test only)\ntest timeout: 50 us';
        if (w.cause === 'tmo') return 'test_xbar_rand settings\ncheck_en: 1\ntest timeout: none (wait(done) has no limit)';
        return 'test_xbar_rand settings\ncheck_en: 1\ntest timeout: 50 us';
      },
    },
    {
      cmd: 'src', args: ['compare', 'drive'], cost: 25, what: 'one part of the testbench as written: the compare, or the driver and monitor timing',
      read: (w, arg) => {
        if (arg === 'drive') {
          return w.cause === 'race'
            ? 'driver:  vif.din = item.din, on @(posedge clk), blocking\nmonitor: samples vif.dout on @(posedge clk), no skew'
            : 'driver:  clocking cb, drives 1 ns after the edge\nmonitor: clocking cb, samples at the edge';
        }
        if (w.cause === 'scb') return 'scoreboard compare, as written\nif (exp != tr.in_data) errors++;';
        if (w.cause === 'xprop') return 'scoreboard compare, as written\nbit [7:0] got = dut.out;\nif (exp != got) errors++;';
        if (w.cause === 'enb') return 'scoreboard compare, as written\nif (cfg.check_en) if (exp != dut.out) errors++;';
        return 'scoreboard compare, as written\nif (exp != dut.out) errors++;';
      },
    },
  ],
};

// ------------------------------------------------------------------ 2. Random & coverage: the bins that never close

export const covIncident: Incident = {
  id: 'inc-cov',
  title: 'Stuck at 94 Percent',
  concept: 'functional coverage will not close. Find which bins can never be hit, and why.',
  xp: 340,
  budget: 100,
  pager: 'PAGER · SEV-3 · Functional coverage on the ADA-4 crossbar has sat at 94% for three nightly runs. The bins that never close are the last ones the coverage sign-off needs. You have 100 minutes on the regression farm.',
  causes: [
    {
      id: 'over', name: 'The length constraint caps len at 8 beats, so the long bin is never drawn',
      fix: 'Widen the len constraint to the spec\'s 1 to 16 beats',
      story: 'c_len said len inside 1 to 8. The bus allows 1 to 16 beats, so the solver never drew a value in the 9-to-16 bin. The bin was reachable, and the constraint was too tight. The cross bins for the long bin were empty too.',
    },
    {
      id: 'dist', name: 'The len dist gives the long bin only about 1 draw in 1,000',
      fix: 'Reweight the len dist so the long bin gets a fair share of draws',
      story: 'The dist gave each value from 1 to 8 a weight of 1,000, and each value from 9 to 16 a weight of 1. The long bin got about 6 hits in 10,000 transactions, under its goal of 10. The range was right; the weights starved the bin.',
    },
    {
      id: 'sample', name: 'The response covergroup is never sampled, because its event never fires',
      fix: 'Trigger ev_resp in the response monitor so cg_resp samples',
      story: 'cg_resp samples on @(ev_resp). The response monitor no longer triggers that event (the -> line was lost in a refactor), so the covergroup took zero samples. Its four response bins stayed empty, and every other group was fine.',
    },
    {
      id: 'cross', name: 'The burst x len cross includes WRAP with one beat, which is illegal',
      fix: 'Exclude WRAP x one beat from the cross with ignore_bins',
      story: 'The burst x len cross had no ignore_bins. WRAP bursts need 2 to 16 beats, so the WRAP x one-beat bin could never be hit. The constraint was legal; the cross definition was wrong, and the other eleven bins closed.',
    },
    {
      id: 'idbin', name: 'An id bin for 16 to 31 sits on a 4-bit field, so it can never be hit',
      fix: 'Delete the id bin for 16 to 31, outside the 4-bit range',
      story: 'id_top was written as [16:31], but id is 4 bits wide, so its values run 0 to 15. No stimulus can reach the bin. The bin is the bug, and deleting it lets the group close.',
    },
  ],
  bandaids: [
    {
      text: 'Lower the coverage goal from 100% to 90% and sign off',
      why: 'The goal is the sign-off rule. A lower goal hides the empty bins, and the holes in the coverage are still there.',
    },
    {
      text: 'Run the regression ten times as long, in the hope the bins fill',
      why: 'Longer runs help only a bin that can be hit. A bin that can never be hit stays empty, however long you run.',
    },
  ],
  instruments: [
    {
      cmd: 'cov', cost: 15, what: 'the coverage summary from the last nightly run: covergroups below goal',
      read: (w) => {
        const below = w.cause === 'sample' ? 'cg_resp'
          : w.cause === 'cross' ? 'cross'
            : w.cause === 'idbin' ? 'cg_id'
              : 'cg_len\ncross';
        return `covergroups below goal (goal 100%)\n${below}`;
      },
    },
    {
      cmd: 'bins', args: ['len', 'resp', 'cross', 'id'], cost: 25, what: 'hit counts for every bin of one covergroup',
      read: (w, arg) => {
        if (arg === 'len') {
          const long = w.cause === 'over' ? ['long (9-16)', '0']
            : w.cause === 'dist' ? ['long (9-16), goal 10', '6']
              : ['long (9-16)', '1,905'];
          return `cg_len, hits per bin\n${table([['bin', 'hits'], ['one (1)', '1,870'], ['short (2-4)', '3,911'], ['mid (5-8)', '2,702'], long])}`;
        }
        if (arg === 'resp') {
          const rows = w.cause === 'sample'
            ? [['okay', '0'], ['slverr', '0'], ['decerr', '0'], ['exokay', '0']]
            : [['okay', '2,140'], ['slverr', '96'], ['decerr', '41'], ['exokay', '12']];
          return `cg_resp, hits per bin\n${table([['bin', 'hits'], ...rows])}`;
        }
        if (arg === 'cross') {
          const cells: Record<string, string[]> = {
            FIXED: ['610', '1,302', '905', '640'],
            INCR: ['720', '1,410', '980', '655'],
            WRAP: ['ign', '611', '455', '330'],
          };
          if (w.cause === 'over') { cells.FIXED[3] = '0'; cells.INCR[3] = '0'; cells.WRAP[3] = '0'; }
          if (w.cause === 'dist') { cells.FIXED[3] = '0'; cells.INCR[3] = '2'; cells.WRAP[3] = '4'; }
          if (w.cause === 'cross') cells.WRAP[0] = '0';
          const rows = Object.entries(cells).map(([burst, c]) => [burst, ...c]);
          return `burst x len, hits per bin (ign = ignored bin)\n${table([['burst', 'one', 'short', 'mid', 'long'], ...rows])}`;
        }
        const rows: (string | number)[][] = [['bin', 'hits'], ['id_lo (0-7)', '1,980'], ['id_hi (8-15)', '2,004']];
        if (w.cause === 'idbin') rows.push(['id_top (16-31)', '0']);
        return `cg_id (id is a 4-bit field), hits per bin\n${table(rows)}`;
      },
    },
    {
      cmd: 'constr', args: ['len', 'burst'], cost: 30, what: 'a constraint block of the sequence item, as written',
      read: (w, arg) => {
        if (arg === 'burst') return 'constraint c_wrap { burst == WRAP -> len >= 2; }\nspec: a wrap burst needs 2 to 16 beats';
        if (w.cause === 'over') return 'constraint c_len { len inside {[1:8]}; }\nspec: 1 to 16 beats';
        if (w.cause === 'dist') return 'constraint c_len { len dist { [1:8] := 1000, [9:16] := 1 }; }\nspec: 1 to 16 beats';
        return 'constraint c_len { len inside {[1:16]}; }\nspec: 1 to 16 beats';
      },
    },
    {
      cmd: 'sample', cost: 35, what: 'where each covergroup is sampled, as written in the env',
      read: (w) => {
        const resp = w.cause === 'sample'
          ? 'cg_resp  @(ev_resp), ev_resp triggered in resp_mon: 0 places'
          : 'cg_resp  @(ev_resp), ev_resp triggered in resp_mon: on every response';
        return `covergroup sampling, as written\ncg_len   @(posedge clk iff vld)\ncg_burst @(posedge clk iff vld)\n${resp}\ncg_id    @(posedge clk iff vld)`;
      },
    },
  ],
};

// ------------------------------------------------------------------ 3. UVM: an environment that misbehaves

export const uvmIncident: Incident = {
  id: 'inc-uvm',
  title: 'The Misbehaving Environment',
  concept: 'the UVM environment reports the wrong things. Find which part of the env is wrong, and how.',
  xp: 360,
  budget: 110,
  pager: 'PAGER · SEV-2 · The UVM environment for ADA-4\'s peripheral bus misbehaves: the error-injection test never sees an error, the latency checker fires on fine responses, the scoreboard flags reads that are correct, one agent never gets traffic, and some runs end short of their plan. The env is yours. You have 110 minutes on the regression farm.',
  causes: [
    {
      id: 'factory', name: 'The factory override names the monitor, not the driver',
      fix: 'Point the factory override at the driver, not the monitor',
      story: 'The test called set_type_override_by_type with the monitor\'s type, so the monitor was swapped for its error version. The driver stayed the plain one and never injected an error. The test still passed, because no error was injected and so none was reported.',
    },
    {
      id: 'cfgkey', name: 'The monitor reads the latency limit under a misspelled config key',
      fix: 'Fix the monitor\'s config_db key so it matches max_latency',
      story: 'The test set max_latency to 12. The monitor read \'max_latnecy\', which was not found, and it silently fell back to its default of 4 cycles. Responses of 5 to 12 cycles, which the test allowed, were reported as latency errors.',
    },
    {
      id: 'seqr', name: 'The sequence runs on agent_b\'s sequencer, so agent_a gets no traffic',
      fix: 'Start the sequence on agent_a\'s sequencer, as the plan says',
      story: 'The test started its traffic on agent_b.sqr. agent_b got all 1,000 items, and agent_a\'s sequencer sat idle. The scoreboard checked what ran, so it passed, and agent_a\'s path was never exercised at all.',
    },
    {
      id: 'early', name: 'The monitor writes each transfer before its response is valid',
      fix: 'Move the monitor\'s write to after the response is valid',
      story: 'The monitor wrote each transaction at the address phase, before the response existed. The scoreboard compared an unset resp field, and 37 correct reads failed. The trace shows the write landing before the response.',
    },
    {
      id: 'objection', name: 'The test drops its objection after 50 ns, not when traffic ends',
      fix: 'Drop the objection only after the sequence has finished',
      story: 'The test dropped its objection after a fixed 50 ns wait, while the sequences were still running. UVM ended the run phase and cut the traffic off at 22 items per agent. Nothing checked the count, so the test passed.',
    },
  ],
  bandaids: [
    {
      text: 'Raise every latency limit to 20 cycles so the errors stop',
      why: 'That silences the latency errors for all traffic. The misspelled key is still there, so the monitor never reads the limit the test set.',
    },
    {
      text: 'Add a 200 ns wait before the objection is dropped',
      why: 'A longer fixed wait is still a guess. The objection is still dropped on a timer, and the other faults are untouched.',
    },
  ],
  instruments: [
    {
      cmd: 'report', cost: 20, what: 'the UVM report summary at the end of the error-injection test',
      read: (w) => {
        if (w.cause === 'cfgkey') return 'uvm report summary, end of test\nUVM_ERROR 412 · first id: LATENCY\ntest_err_inject: FAILED';
        if (w.cause === 'early') return 'uvm report summary, end of test\nUVM_ERROR 37 · first id: SCBD\ntest_err_inject: FAILED';
        return 'uvm report summary, end of test\nUVM_ERROR 0 · UVM_FATAL 0\ntest_err_inject: PASSED';
      },
    },
    {
      cmd: 'factory', cost: 30, what: 'the factory overrides in effect, and the type each component was built as',
      read: (w) => (w.cause === 'factory'
        ? 'overrides in effect\n  axi_monitor -> axi_mon_err (by type)\nbuilt as: driver axi_driver (no override) · monitor axi_mon_err'
        : 'overrides in effect\n  axi_driver -> axi_drv_err (by type)\nbuilt as: driver axi_drv_err · monitor axi_monitor (no override)'),
    },
    {
      cmd: 'config', cost: 30, what: 'the config_db set and get for the monitor\'s latency limit',
      read: (w) => (w.cause === 'cfgkey'
        ? 'set by test: max_latency = 12\nread by agent_mon: \'max_latnecy\' · not found, default 4 used'
        : 'set by test: max_latency = 12\nread by agent_mon: max_latency = 12'),
    },
    {
      cmd: 'sqr', cost: 25, what: 'items sent per agent sequencer (plan: 500 each)',
      read: (w) => {
        if (w.cause === 'seqr') return 'items sent per agent\nagent_a  0\nagent_b  1,000';
        if (w.cause === 'objection') return 'items sent per agent\nagent_a  22\nagent_b  22 · run ended at 50 ns';
        return 'items sent per agent\nagent_a  500\nagent_b  500';
      },
    },
    {
      cmd: 'score', cost: 35, what: 'scoreboard: items compared and mismatches (plan: 1,000)',
      read: (w) => {
        if (w.cause === 'early') return 'scoreboard\ncompared 1,000 · mismatches 37 (field: resp)';
        if (w.cause === 'objection') return 'scoreboard\ncompared 44 of 1,000 planned · mismatches 0';
        return 'scoreboard\ncompared 1,000 · mismatches 0';
      },
    },
    {
      cmd: 'trace', cost: 40, what: 'one read transfer on the bus, against when the monitor writes it',
      read: (w) => (w.cause === 'early'
        ? 'read at addr accepted t = 120 ns\nanalysis write   t = 120 ns\nresp valid       t = 140 ns\n-> the monitor wrote before the response was valid'
        : 'read at addr accepted t = 120 ns\nresp valid       t = 140 ns\nanalysis write   t = 140 ns\n-> the monitor wrote after the response was valid'),
    },
  ],
};

// ------------------------------------------------------------------ 4. Assertions & formal: a proof that proves less than it claims

export const formalIncident: Incident = {
  id: 'inc-formal',
  title: 'Proved, Mostly',
  concept: 'a formal sign-off looks clean but proves less than it claims, or fails for the wrong reason. Find which part of the setup is wrong.',
  xp: 380,
  budget: 110,
  pager: 'PAGER · SEV-2 · Formal sign-off for ADA-4\'s bus arbiter does not match the design review. The review expects a starvation risk to show up as a failure, and the tool gives a result that does not fit. The properties and the formal setup are yours. You have 110 minutes on the formal farm.',
  causes: [
    {
      id: 'vacuous', name: 'The back-to-back property\'s antecedent is tied off in the wrapper',
      fix: 'Connect busy_req in the formal wrapper to the arbiter\'s port',
      story: 'The formal wrapper bound busy_req to 1\'b0, so the property\'s antecedent never held. The property passed without checking anything: a vacuous pass. The arbiter still drops back-to-back requests, and the property was the only check that would have caught it.',
    },
    {
      id: 'assume', name: 'An assume caps addr below 4 KB, so the high-bank bug is excluded',
      fix: 'Widen the addr assume to the spec\'s full 64 KB range',
      story: 'The assume said addr < 0x1000. The bus spans 64 KB, and the arbiter starves requests to the high banks. With the assume in place, no trace can reach a high address, so the proof came back clean while the bug was there.',
    },
    {
      id: 'depth', name: 'The proof is bounded at 10 cycles, but the failure needs 14',
      fix: 'Set the proof bound to 20 cycles, past the 14-cycle failure',
      story: 'The proof ran to a depth of 10 cycles, so it only covered 10 cycles of traffic. The arbiter\'s 4-bit credit counter wraps on the 12th request, and master 1 starves from cycle 14. A bounded proof says only what it checked.',
    },
    {
      id: 'reset', name: 'The grant property is not disabled during reset, so it fails there',
      fix: 'Add disable iff (!rst_n) to the grant property itself',
      story: 'The grant property has no disable iff (!rst_n). During reset the request lines are not yet valid, so the property fails on cycle 1, before the arbiter can respond. The arbiter is fine; the property was checked where it does not apply.',
    },
    {
      id: 'fair', name: 'The starvation check has no fairness assumption, so a loop fails it',
      fix: 'Add a fairness assumption that each master drops its request',
      story: 'Nothing stopped master 0 from holding its request forever, and the liveness property had no fairness assumption. The tool found a loop where master 1 waits forever. The arbiter is not at fault; the environment was too free.',
    },
  ],
  bandaids: [
    {
      text: 'Weaken the grant property to ##[1:8] so the tool stops failing',
      why: 'A looser bound moves the failure, it does not remove it. The reset failure and the looping trace are still there, and the property now checks less.',
    },
    {
      text: 'Mark the failing property as an assume, so the tool trusts it',
      why: 'An assume is taken as true and never checked. Real starvation would pass silently, and the reset failure would be hidden.',
    },
  ],
  instruments: [
    {
      cmd: 'prove', cost: 20, what: 'the formal sign-off results for the arbiter properties',
      read: (w) => {
        const head = w.cause === 'depth' ? 'formal, arbiter (bounded, depth 10)' : 'formal, arbiter (unbounded)';
        const grant = w.cause === 'reset' ? 'FAIL at cycle 1 (in reset)' : 'PASS';
        const starve = w.cause === 'depth' ? 'not checked (liveness needs an unbounded run)'
          : w.cause === 'fair' ? 'FAIL (lasso: master 1 never granted)'
            : 'PASS';
        return `${head}\nmutex        PASS\ngrant_lat    ${grant}\nb2b_grant    PASS\nstarve_free  ${starve}`;
      },
    },
    {
      cmd: 'cover', cost: 25, what: 'cover points: how often each interesting state is reached',
      read: (w) => {
        const b2b = w.cause === 'vacuous' ? '0 hits, unreachable' : '1,204 hits';
        const high = w.cause === 'assume' ? '0 hits, unreachable' : '311 hits';
        const deep = w.cause === 'depth' ? 'not reached within bound 10' : 'reached at cycle 13';
        return `cover points\nb2b_req    (request while busy): ${b2b}\naddr_high  (addr >= 0x1000): ${high}\ndeep_req   (12 requests in a row): ${deep}`;
      },
    },
    {
      cmd: 'assume', cost: 25, what: 'the assumptions in force for the formal run',
      read: (w) => {
        if (w.cause === 'assume') return 'assume addr < 0x1000   (spec: addr up to 0xFFFF)\nfairness: each req drops within 8 cycles';
        if (w.cause === 'fair') return 'assume addr <= 0xFFFF   (spec)\nfairness: none';
        return 'assume addr <= 0xFFFF   (spec)\nfairness: each req drops within 8 cycles';
      },
    },
    {
      cmd: 'bmc', args: ['10', '20'], cost: 30, what: 'bounded model check at the given depth (safety properties)',
      read: (w, arg) => {
        const head = `bounded model check, depth ${arg}`;
        if (w.cause === 'reset') return `${head}\nFAIL: grant_lat at cycle 1 (in reset)`;
        if (w.cause === 'depth' && arg === '20') return `${head}\nFAIL: grant_lat at cycle 14`;
        return `${head}\nPASS: no counterexample (safety properties only)`;
      },
    },
    {
      cmd: 'trace', cost: 40, what: 'the counterexample for the failing property, cycle by cycle',
      read: (w) => {
        if (w.cause === 'reset') return 'grant_lat, rst_n held low on cycles 0 to 2\ncycle 1: rst_n = 0, req0 = 1, gnt0 = 0 · property fails with no grant';
        if (w.cause === 'fair') return 'starve_free, lasso: loop from cycle 4 back to cycle 9\nreq0 = 1, gnt0 = 1 on every cycle of the loop\nreq1 = 1, gnt1 = 0 on every cycle: master 1 never granted';
        if (w.cause === 'depth') return 'grant_lat, depth-20 run, counterexample at cycle 14\nmaster 1 waits from cycle 3 · credit counter wraps on the 12th request';
        return 'no counterexample: every explored trace satisfies the checked properties';
      },
    },
    {
      cmd: 'bind', cost: 15, what: 'how the formal wrapper connects the arbiter\'s ports',
      read: (w) => `formal wrapper, port bindings\n${w.cause === 'vacuous' ? 'busy_req = 1\'b0   (tied off)' : 'busy_req = req1 & busy'}\nreq0, req1, gnt0, gnt1, rst_n: bound to arbiter ports`,
    },
  ],
};

// ------------------------------------------------------------------ 5. Design for test: scan, clock gates, reset and X

export const dftIncident: Incident = {
  id: 'inc-dft',
  title: 'The Chain That Would Not Shift',
  concept: 'the core fails scan test or misses its coverage target. Find which test structure is at fault, and how.',
  xp: 400,
  budget: 100,
  pager: 'PAGER · SEV-2 · ADA-3\'s silicon core is short of the 95% ATPG coverage target, and its scan-test flow is not signed off. The scan chains, clock gates, reset tree and memory wrappers are the test logic you built this chapter. Test sign-off is Friday. You have 100 minutes on the DFT tools.',
  causes: [
    {
      id: 'open', name: 'Scan flop 412\'s scan input is open, so the chain stops there',
      fix: 'Reconnect the scan input of flop 412 to the Q of flop 411',
      story: 'The scan input of flop 412 was left open, so the chain broke there. Scan data from the flops before 412 never reached the output, which read X from that point on. ATPG could not load the flops past the break, so its coverage was not measured.',
    },
    {
      id: 'gate', name: 'Clock gate u_cg2 has no test-mode term, so its flops hold during shift',
      fix: 'OR the test enable into the enable of clock gate u_cg2',
      story: 'The enable of clock gate u_cg2 was the functional enable alone. In test mode the gate stayed shut, so the flops it clocks did not shift. Their values repeated along the chain, and their faults were never tested.',
    },
    {
      id: 'reset', name: 'The core reset comes from logic that scan cannot control',
      fix: 'Route rst_core to the scan-controllable reset pin in test mode',
      story: 'rst_core came from an internal reset synchronizer, with no path from a scan-controllable pin in test mode. ATPG could not put 2,304 flops into a known state, so they captured X. Shifting still worked, and coverage fell to 84.6%.',
    },
    {
      id: 'xsrc', name: 'SRAM outputs are unknown in test mode and leak X into scan capture',
      fix: 'Add an X-blocking wrapper on the SRAM outputs for test mode',
      story: 'The SRAM was a black box with no test model, so its read data was X during ATPG. The X reached scan capture and masked the faults behind it. Coverage sat at 89.0%. Once the X is blocked, those faults can be detected.',
    },
    {
      id: 'redund', name: 'A duplicated term in u_dec is redundant, so its faults are untestable',
      fix: 'Remove the redundant duplicate term from the u_dec logic',
      story: 'The u_dec equation had a term that could never change the output, because the other term absorbed it. Stuck-at faults on that term are untestable by definition. The coverage shortfall was all inside u_dec.',
    },
  ],
  bandaids: [
    {
      text: 'Lower the ATPG coverage target from 95% to 85% and ship',
      why: 'The target is the test sign-off rule. A lower target hides real holes, such as a broken chain or a flop that never clocks.',
    },
    {
      text: 'Run ten times more random patterns in ATPG and rerun it',
      why: 'Random patterns cannot test a broken chain or a flop that never clocks, and redundant faults stay untestable however many you add.',
    },
  ],
  instruments: [
    {
      cmd: 'shift', cost: 20, what: 'scan shift test: a 0101 pattern through each chain, with the first bad bit',
      read: (w) => {
        const chain2 = w.cause === 'open' ? 'chain 2  FAIL at bit 412, output X'
          : w.cause === 'gate' ? 'chain 2  FAIL at bit 205, output repeats (values hold)'
            : 'chain 2  pass';
        return `scan shift test, 0101 through each chain\nchain 0  pass\nchain 1  pass\n${chain2}\nchain 3  pass`;
      },
    },
    {
      cmd: 'atpg', cost: 25, what: 'the ATPG run summary for the core',
      read: (w) => {
        if (w.cause === 'open') return 'ATPG run\nchain test: FAIL (chain 2)\ncoverage: not measured';
        if (w.cause === 'gate') return 'ATPG run\nchain test: FAIL (chain 2)\ncoverage: 88.1%';
        if (w.cause === 'reset') return 'ATPG run\nchain test: pass\ncoverage: 84.6%';
        return 'ATPG run\nchain test: pass\ncoverage: 89.0%';
      },
    },
    {
      cmd: 'gate', cost: 30, what: 'the enable term of each clock gate in test mode (TE = test enable)',
      read: (w) => `clock gates, enable as drawn\nu_cg0  EN = en0 | TE\nu_cg1  EN = en1 | TE\nu_cg2  EN = ${w.cause === 'gate' ? 'en2   (no TE term)' : 'en2 | TE'}\nu_cg3  EN = en3 | TE`,
    },
    {
      cmd: 'netlist', args: ['reset', 'sram', 'dec'], cost: 15, what: 'one block as drawn in the netlist',
      read: (w, arg) => {
        if (arg === 'reset') return w.cause === 'reset'
          ? 'rst_core driver, as drawn\nrst_core = rst_sync_q   (internal synchronizer, no scan path)'
          : 'rst_core driver, as drawn\nrst_core = rst_pin   (scan-controllable in test mode)';
        if (arg === 'sram') return w.cause === 'xsrc'
          ? 'u_sram0 read data, as drawn\nQ -> scan capture   (black box, no test model)'
          : 'u_sram0 read data, as drawn\nQ -> X-block wrapper (forced 0 in test) -> scan capture';
        return w.cause === 'redund'
          ? 'u_dec, as drawn\ny = (a & b) | (a & b & c)'
          : 'u_dec, as drawn\ny = (a & b) | (c & d)';
      },
    },
  ],
};

export const VERIF_INCIDENTS: Incident[] = [tbIncident, covIncident, uvmIncident, formalIncident, dftIncident];

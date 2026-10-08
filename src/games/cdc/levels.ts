// Clock-domain-crossing missions. Each is judged two ways: structural CDC rules (what a lint tool reports) and a stress
// simulation where the two clocks have unrelated periods and phases and the capture flops go metastable on close calls.
import { between, type Rng } from '../../lessons/types';
import type { CdcSpec } from './analyze';
import type { Bench, Io, Scenario } from './dsim';
import type { CdcInstance, CdcLevel } from './types';

/** n scenarios with unrelated clock periods; `fast` names the domain that must be the faster one, if any */
function scenarios(r: Rng, n: number, doms: [string, string], cycles: number, fast?: string): Scenario[] {
  const out: Scenario[] = [];
  for (let i = 0; i < n; i++) {
    let a = between(r, 7, 13);
    let b = between(r, 17, 53) | 1;
    if (i % 2 === 1 && !fast) [a, b] = [b, a];
    out.push({
      periods: { [doms[0]]: fast === doms[1] ? b : a, [doms[1]]: fast === doms[1] ? a : b },
      phases: { [doms[0]]: 0, [doms[1]]: between(r, 1, 9) },
      seed: between(r, 1, 1e6),
      cycles,
    });
  }
  return out;
}

const bit = (io: Io, n: string) => Number(io.get(n)) & 1;

// ===================================================================== 1. synchronize a flag
class SyncBench implements Bench {
  hist: [number, number][] = [[0, 0]];
  last = 0;
  en = [1, 1];
  fails: string[] = [];
  seen = 0;
  constructor(private pa: number, private pb: number) {}
  init(io: Io) { io.set('rst_n', 1); io.set('d', 0); io.set('en_b', 1); }
  drive(dom: string, io: Io) {
    if (dom === 'A') {
      if (io.time - this.last > 10 * Math.max(this.pa, this.pb) && io.rnd() < 0.25) {
        const v = 1 - this.hist[this.hist.length - 1][1];
        io.set('d', v);
        this.hist.push([io.time, v]);
        this.last = io.time;
      }
    } else {
      this.en = [this.en[1], io.rnd() < 0.15 ? 0 : 1];
      io.set('en_b', this.en[1]);
    }
  }
  sample(dom: string, io: Io) {
    if (dom !== 'B' || this.fails.length) return;
    const q = bit(io, 'q');
    if (this.en[0] === 0) { if (q !== 0) this.fails.push(`q was ${q} although en_b was low`); return; }
    const L = 5 * this.pb + 2 * this.pa;
    const allowed = new Set<number>();
    for (let i = this.hist.length - 1; i >= 0; i--) { allowed.add(this.hist[i][1]); if (this.hist[i][0] <= io.time - L) break; }
    if (!allowed.has(q)) this.fails.push(`q was ${q} at t=${io.time} although d had not been ${q} for the last ${L} time units`);
    if (io.time - this.last > L + 3 * this.pb && q !== this.hist[this.hist.length - 1][1]) this.fails.push(`q did not follow d after it was stable at t=${io.time}`);
    this.seen++;
  }
  finish() { if (!this.fails.length && this.hist.length < 4) this.fails.push('d never toggled enough to judge'); return this.fails; }
}
const SYNC_SPEC: CdcSpec = { clocks: { clka: 'A', clkb: 'B' }, inputs: { rst_n: '*', d: 'A', en_b: 'B' } };
const SYNC_STARTER = `// A flag from domain A (clka) must reach domain B (clkb), where q follows it while en_b (a domain B signal) is high.
module flag_xfer(input clka, input clkb, input rst_n, input d, input en_b, output reg q);
  reg a_q;

  // domain A: register the flag
  always @(posedge clka or negedge rst_n) begin
    if (!rst_n) a_q <= 1'b0;
    else a_q <= d;
  end

  // domain B: use it
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;
    else q <= a_q & en_b;
  end
endmodule
`;
const SYNC_SOL = `module flag_xfer(input clka, input clkb, input rst_n, input d, input en_b, output reg q);
  reg a_q;
  reg s1, s2;

  always @(posedge clka or negedge rst_n) begin
    if (!rst_n) a_q <= 1'b0;
    else a_q <= d;
  end

  // two flops in the destination domain: s1 may go metastable, s2 is clean
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin
      s1 <= 1'b0;
      s2 <= 1'b0;
      q <= 1'b0;
    end else begin
      s1 <= a_q;
      s2 <= s1;
      q <= s2 & en_b;
    end
  end
endmodule
`;
const cdcSync: CdcLevel = {
  id: 'cdc-sync', title: 'Never use it straight away', concept: 'metastability, the two-flop synchronizer', xp: 110, tier: 'guided',
  ticket: 'Silicon bring-up hangs about one boot in thirty. Static timing is clean. The flag that crosses from the A clock to the B clock goes straight into logic.',
  build: (r) => {
    const sc = scenarios(r, 4, ['A', 'B'], 160);
    return {
      mode: 'fix',
      spec: SYNC_SPEC, ports: ['clka', 'clkb', 'rst_n', 'd', 'en_b', 'q'], scenarios: sc,
      bench: (s) => new SyncBench(s.periods.A, s.periods.B),
      checks: 'q follows d (any value q takes was recent, and it settles) across clock ratios',
      brief: `<p>Two clocks with no fixed relationship: a flip-flop in domain B that samples a signal from domain A may catch it <b>mid-transition</b>. It then sits at an in-between voltage (<b>metastable</b>) for an unpredictable time before it falls to 0 or 1. If that undecided value fans out to logic, different gates may read it as different things.</p>
<p>The cure is a <b>two-flop synchronizer</b>: the first flop in the destination domain may go metastable but drives <i>only</i> a second flop, which has a whole clock period to let it settle. The first flop's output must not feed any logic, any enable, or an output.</p>
<p>Below, <code>a_q</code> (domain A) goes straight into <code>a_q &amp; en_b</code> in domain B. Fix the crossing so the CDC check passes and <code>q</code> still follows the flag (while <code>en_b</code> is high). The simulation gives the capture flop random bad luck: look at the crossing list to see how the analysis judges your design.</p>`,
      hints: ['Add two registers clocked by <code>clkb</code>: <code>s1 &lt;= a_q; s2 &lt;= s1;</code> and use <code>s2</code> where the code used <code>a_q</code>.', 'Keep the logic (<code>&amp; en_b</code>) <i>after</i> the second flop, never between the crossing and the first flop.'],
      starter: SYNC_STARTER, solution: SYNC_SOL,
    };
  },
};

// ===================================================================== 2. pulse across
class PulseBench implements Bench {
  sent = 0; recv = 0; wait = 0; prev = 0; fails: string[] = []; pulsing = false;
  constructor(private pa: number, private pb: number, private count: number) {}
  init(io: Io) { io.set('rst_n', 1); io.set('pulse_a', 0); }
  drive(dom: string, io: Io) {
    if (dom !== 'A') return;
    if (this.pulsing) { io.set('pulse_a', 0); this.pulsing = false; return; }
    if (this.wait > 0) { this.wait--; return; }
    if (this.sent < this.count) {
      io.set('pulse_a', 1);
      this.pulsing = true;
      this.sent++;
      this.wait = Math.ceil((4 * this.pb) / this.pa) + Math.floor(io.rnd() * 6);
    }
  }
  sample(dom: string, io: Io) {
    if (dom !== 'B') return;
    const v = bit(io, 'pulse_b');
    if (v && this.prev && !this.fails.length) this.fails.push(`pulse_b stayed high for two clkb cycles (t=${io.time}): it must be exactly one cycle wide`);
    if (v && !this.prev) this.recv++;
    this.prev = v;
  }
  finish() {
    if (!this.fails.length && this.sent < this.count) this.fails.push(`only ${this.sent} pulses were sent in the time available`);
    else if (!this.fails.length && this.recv !== this.sent) this.fails.push(`${this.sent} pulses went in but ${this.recv} came out`);
    return this.fails;
  }
}
const PULSE_SPEC: CdcSpec = { clocks: { clka: 'A', clkb: 'B' }, inputs: { rst_n: '*', pulse_a: 'A' } };
const PULSE_STARTER = `// pulse_a is a one-cycle pulse in the fast domain A. Produce exactly one one-cycle pulse on pulse_b in the slow domain B.
module pulse_xfer(input clka, input clkb, input rst_n, input pulse_a, output pulse_b);
  // TODO
  // This attempt synchronizes the pulse like a level. A short pulse can fall entirely between two clkb edges.
  reg p1, p2;
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin p1 <= 1'b0; p2 <= 1'b0; end
    else begin p1 <= pulse_a; p2 <= p1; end
  end
  assign pulse_b = p2;
endmodule
`;
const PULSE_SOL = `module pulse_xfer(input clka, input clkb, input rst_n, input pulse_a, output pulse_b);
  reg tog;
  reg s1, s2, s3;

  // domain A: turn each pulse into a level change that stays until the next pulse
  always @(posedge clka or negedge rst_n) begin
    if (!rst_n) tog <= 1'b0;
    else if (pulse_a) tog <= ~tog;
  end

  // domain B: synchronize the level, then detect its change
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin s1 <= 1'b0; s2 <= 1'b0; s3 <= 1'b0; end
    else begin s1 <= tog; s2 <= s1; s3 <= s2; end
  end
  assign pulse_b = s2 ^ s3;
endmodule
`;
const cdcPulse: CdcLevel = {
  id: 'cdc-pulse', title: 'A pulse that can be missed', concept: 'toggle synchronizer, pulses between unrelated clocks', xp: 130, tier: 'guided',
  ticket: 'Interrupt events from the fast core occasionally never reach the slow peripheral. Waveforms look fine on the fast side.',
  build: (r) => {
    const sc = scenarios(r, 4, ['A', 'B'], 150, 'A');
    return {
      mode: 'write', spec: PULSE_SPEC, ports: ['clka', 'clkb', 'rst_n', 'pulse_a', 'pulse_b'], scenarios: sc,
      bench: (s) => new PulseBench(s.periods.A, s.periods.B, 20),
      checks: 'every pulse sent from A appears exactly once, one cycle wide, in B',
      brief: `<p>A synchronizer only works on signals that stay put for at least about <b>1.5 destination clock periods</b> (three destination edges). A one-cycle pulse from a fast clock is narrower than a slow clock period, so the slow clock may never see it, whatever you do after the capture.</p>
<p>The standard fix is a <b>toggle synchronizer</b>: in the source domain, turn each pulse into a <b>level change</b> (a flop that flips on every pulse). A level change is long-lived, so the two-flop synchronizer in the destination domain catches it. A third flop plus an XOR then turns each level change back into a one-cycle pulse.</p>
<p>The bench sends 20 pulses, each at least four slow cycles apart, with clock ratios that change per run. The starter synchronizes the pulse as if it were a level: see how many it loses. (A structural lint passes it, because a two-flop synchronizer really is there. Only simulation shows the loss.)</p>`,
      hints: ['Source domain: <code>if (pulse_a) tog &lt;= ~tog;</code>. Destination: <code>s1 &lt;= tog; s2 &lt;= s1; s3 &lt;= s2;</code>', 'The output pulse is <code>assign pulse_b = s2 ^ s3;</code>: high for one cycle after the toggle arrives.'],
      starter: PULSE_STARTER, solution: PULSE_SOL,
    };
  },
};

// ===================================================================== 3. gray code counter
const bin = (n: number) => n & 15;
class GrayBench implements Bench {
  hist: [number, number][] = [[0, 0]];
  model = 0; inc = 0; fails: string[] = []; lastGot = 0; stopAt: number;
  constructor(private pa: number, private pb: number, horizon: number) { this.stopAt = 0.75 * horizon; }
  init(io: Io) { io.set('rst_n', 1); io.set('inc', 0); }
  drive(dom: string, io: Io) {
    if (dom !== 'A') return;
    this.inc = io.time < this.stopAt && io.rnd() < 0.6 ? 1 : 0;
    io.set('inc', this.inc);
  }
  sample(dom: string, io: Io) {
    if (dom === 'A') {
      if (this.inc) { this.model = bin(this.model + 1); this.hist.push([io.time, this.model]); }
      return;
    }
    const got = Number(io.get('cnt_b'));
    this.lastGot = got;
    if (this.fails.length) return;
    const L = 4 * this.pb + 3 * this.pa;
    const allowed = new Set<number>();
    for (let i = this.hist.length - 1; i >= 0; i--) { allowed.add(this.hist[i][1]); if (this.hist[i][0] <= io.time - L) break; }
    if (!allowed.has(got)) this.fails.push(`cnt_b read ${got} at t=${io.time}, but the counter was only ${[...allowed].sort((a, b) => a - b).join('/')} in the last ${L} time units: a mixed-up value`);
  }
  finish() {
    if (!this.fails.length && this.hist.length < 30) this.fails.push('the counter hardly moved');
    if (!this.fails.length && this.lastGot !== this.model) this.fails.push(`at the end cnt_b is ${this.lastGot} but the counter is ${this.model}`);
    return this.fails;
  }
}
const GRAY_SPEC: CdcSpec = { clocks: { clka: 'A', clkb: 'B' }, inputs: { rst_n: '*', inc: 'A' } };
const GRAY_STARTER = `// A 4-bit counter in domain A. Domain B needs to read its value as cnt_b (binary, a little late is fine,
// but it must always be a value the counter really had).
module gray_xfer(input clka, input clkb, input rst_n, input inc, output [3:0] cnt_b);
  reg [3:0] cnt;                         // binary counter, domain A (given)
  always @(posedge clka or negedge rst_n) begin
    if (!rst_n) cnt <= 4'd0;
    else if (inc) cnt <= cnt + 4'd1;
  end

  // TODO: this just copies the binary count across. Going from 0111 to 1000 changes four bits at once.
  reg [3:0] c1, c2;
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin c1 <= 4'd0; c2 <= 4'd0; end
    else begin c1 <= cnt; c2 <= c1; end
  end
  assign cnt_b = c2;
endmodule
`;
const GRAY_SOL = `module gray_xfer(input clka, input clkb, input rst_n, input inc, output [3:0] cnt_b);
  reg [3:0] cnt;
  reg [3:0] g;                           // Gray-coded copy, registered in domain A
  reg [3:0] c1, c2;
  always @(posedge clka or negedge rst_n) begin
    if (!rst_n) begin cnt <= 4'd0; g <= 4'd0; end
    else begin
      if (inc) cnt <= cnt + 4'd1;
      g <= cnt ^ (cnt >> 1);
    end
  end
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin c1 <= 4'd0; c2 <= 4'd0; end
    else begin c1 <= g; c2 <= c1; end
  end
  // Gray to binary
  assign cnt_b = {c2[3], c2[3] ^ c2[2], c2[3] ^ c2[2] ^ c2[1], c2[3] ^ c2[2] ^ c2[1] ^ c2[0]};
endmodule
`;
const cdcGray: CdcLevel = {
  id: 'cdc-gray', title: 'Counting across clocks', concept: 'multi-bit crossings, Gray code', xp: 140, tier: 'guided',
  ticket: 'A status counter read from the other clock occasionally returns nonsense: 8 when it should be 7, 0 when it should be 15.',
  build: (r) => {
    const sc = scenarios(r, 5, ['A', 'B'], 220);
    return {
      mode: 'fix', spec: GRAY_SPEC, ports: ['clka', 'clkb', 'rst_n', 'inc', 'cnt_b'], scenarios: sc,
      bench: (s) => new GrayBench(s.periods.A, s.periods.B, 220 * Math.max(s.periods.A, s.periods.B)),
      checks: 'cnt_b is always a value the counter recently had, and ends equal to it',
      brief: `<p>Synchronizing each bit of a bus separately is <b>not</b> synchronizing the bus. If several bits change at once, the destination may catch some of them before the edge and some after, and read a value that never existed: <code>0111 → 1000</code> can be sampled as <code>1111</code>, <code>0000</code> or anything between.</p>
<p><b>Gray code</b> fixes it for counters: consecutive values differ in exactly <b>one</b> bit, so a sample taken mid-change is either the old value or the new value. Convert in the source domain, register the Gray value there, synchronize the Gray bits with two flops, and convert back to binary in the destination: <code>g = b ^ (b &gt;&gt; 1)</code>, and the inverse is a running XOR from the top bit down.</p>
<p>The starter copies the binary count over. Run it to see the corrupted readings, then fix it.</p>`,
      hints: ['In domain A add <code>reg [3:0] g;</code> and <code>g &lt;= cnt ^ (cnt &gt;&gt; 1);</code>. Cross <code>g</code>, not <code>cnt</code>.', 'Binary from Gray, bit by bit: <code>b[3] = g[3]; b[2] = b[3] ^ g[2]; b[1] = b[2] ^ g[1]; b[0] = b[1] ^ g[0];</code>'],
      starter: GRAY_STARTER, solution: GRAY_SOL,
    };
  },
};

// ===================================================================== 4. handshake
class HsBench implements Bench {
  sent: number[] = []; recv: number[] = []; fails: string[] = []; waitBusy = 0; cool = 0; prev = 0;
  constructor(private total: number) {}
  init(io: Io) { io.set('rst_n', 1); io.set('send', 0); io.set('din', 0); }
  drive(dom: string, io: Io) {
    if (dom !== 'A') return;
    const garbage = Math.floor(io.rnd() * 256);
    if (this.cool > 0) { this.cool--; io.set('send', 0); io.set('din', garbage); return; }
    const busy = bit(io, 'busy');
    if (this.waitBusy > 0) { this.waitBusy--; io.set('send', 0); io.set('din', garbage); return; }
    if (!busy && this.sent.length < this.total && io.rnd() < 0.5) {
      io.set('send', 1);
      io.set('din', garbage);
      this.sent.push(garbage);
      this.waitBusy = 2;
    } else { io.set('send', 0); io.set('din', garbage); }
  }
  sample(dom: string, io: Io) {
    if (dom !== 'B') return;
    const v = bit(io, 'valid');
    if (v && this.prev && !this.fails.length) this.fails.push(`valid stayed high for two clkb cycles (t=${io.time})`);
    if (v && !this.prev) this.recv.push(Number(io.get('dout')));
    this.prev = v;
  }
  finish() {
    if (this.fails.length) return this.fails;
    if (this.sent.length < this.total) return [`only ${this.sent.length} of ${this.total} transfers could be started: busy never dropped`];
    if (this.recv.length !== this.sent.length) return [`${this.sent.length} words were sent but valid pulsed ${this.recv.length} times`];
    const i = this.sent.findIndex((x, k) => x !== this.recv[k]);
    if (i >= 0) return [`word ${i + 1}: sent ${this.sent[i]}, dout was ${this.recv[i]}`];
    return [];
  }
}
const HS_SPEC: CdcSpec = { clocks: { clka: 'A', clkb: 'B' }, inputs: { rst_n: '*', send: 'A', din: 'A' } };
const HS_STARTER = `// Send an 8-bit word from domain A to domain B.
//   Domain A: when send is high and busy is low, din holds the word (din changes every cycle otherwise).
//   Domain B: valid pulses for one clkb cycle, and dout holds that word in the same cycle.
//   busy must be high from the cycle after send until the transfer is complete, so the next send waits.
module hs_xfer(input clka, input clkb, input rst_n, input send, input [7:0] din, output busy, output reg valid, output reg [7:0] dout);
  // TODO: This version samples din in domain B with no handshake at all.
  assign busy = 1'b0;
  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin valid <= 1'b0; dout <= 8'd0; end
    else begin valid <= send; dout <= din; end
  end
endmodule
`;
const HS_SOL = `module hs_xfer(input clka, input clkb, input rst_n, input send, input [7:0] din, output busy, output reg valid, output reg [7:0] dout);
  reg req;               // A: request, stays high until acknowledged
  reg [7:0] data_a;      // A: the word, held steady while req is high
  reg a1, a2;            // A: acknowledge synchronizer
  reg r1, r2, r3;        // B: request synchronizer (r3 for edge detection)
  reg ack;               // B: acknowledge, follows the synchronized request
  assign busy = req | a2;

  always @(posedge clka or negedge rst_n) begin
    if (!rst_n) begin req <= 1'b0; data_a <= 8'd0; a1 <= 1'b0; a2 <= 1'b0; end
    else begin
      a1 <= ack;
      a2 <= a1;
      if (send && !busy) begin
        data_a <= din;
        req <= 1'b1;
      end else if (a2) req <= 1'b0;
    end
  end

  always @(posedge clkb or negedge rst_n) begin
    if (!rst_n) begin r1 <= 1'b0; r2 <= 1'b0; r3 <= 1'b0; ack <= 1'b0; valid <= 1'b0; dout <= 8'd0; end
    else begin
      r1 <= req;
      r2 <= r1;
      r3 <= r2;
      ack <= r2;
      valid <= r2 & ~r3;
      if (r2 && !r3) dout <= data_a;     // data_a has been stable for several cycles by now
    end
  end
endmodule
`;
const cdcHandshake: CdcLevel = {
  id: 'cdc-handshake', title: 'Four-phase handshake', concept: 'req/ack handshake, data qualified by a synchronized control', xp: 160, tier: 'guided',
  ticket: 'A configuration word crosses between clocks as eight parallel wires. It arrives corrupted about once per few hundred writes.',
  build: (r) => {
    const sc = scenarios(r, 5, ['A', 'B'], 260);
    return {
      mode: 'write', spec: HS_SPEC, ports: ['clka', 'clkb', 'rst_n', 'send', 'din', 'busy', 'valid', 'dout'], scenarios: sc,
      bench: () => new HsBench(12),
      checks: 'every word sent arrives exactly once, intact and in order',
      brief: `<p>Wide data that is not a counter cannot use Gray code. Instead, send the data across <b>without synchronizing it at all</b>, and send a <b>one-bit control</b> through a real synchronizer that tells the other side when the data is guaranteed stable. This is a <b>req/ack handshake</b>:</p>
<ol><li>A latches the word into <code>data_a</code> and raises <code>req</code>. Neither changes until acknowledged.</li><li>B synchronizes <code>req</code> (two flops). When it arrives, the data has long been stable: B captures <code>data_a</code> and raises <code>ack</code>.</li><li>A synchronizes <code>ack</code>, then drops <code>req</code>. B sees <code>req</code> drop and drops <code>ack</code>. A sees that, and is free for the next word.</li></ol>
<p>The CDC check calls the capture of <code>data_a</code> a <i>qualified bus</i> crossing when it happens under a synchronized control. The bench changes <code>din</code> every cycle, so a design that captures it without latching will fail.</p>`,
      hints: ['Domain A: <code>if (send &amp;&amp; !busy) begin data_a &lt;= din; req &lt;= 1; end else if (a2) req &lt;= 0;</code> with <code>assign busy = req | a2;</code>', 'Domain B: <code>r1 &lt;= req; r2 &lt;= r1; r3 &lt;= r2; ack &lt;= r2;</code> and <code>if (r2 &amp;&amp; !r3) dout &lt;= data_a;</code> with <code>valid &lt;= r2 &amp; ~r3;</code>', 'The acknowledge crosses back to A through its own two-flop synchronizer: <code>a1 &lt;= ack; a2 &lt;= a1;</code>'],
      starter: HS_STARTER, solution: HS_SOL,
    };
  },
};

// ===================================================================== 4b. reset-domain crossing
// One clock, two asynchronous resets. A request flop is cleared by the subsystem reset; the controller that reads it is
// cleared only by the system reset. The bench asserts the subsystem reset at a random instant just before a clock edge, so
// the request changes inside the controller's capture window and the controller's two flags resolve independently.
class RdcBench implements Bench {
  n = 0; hold = 0; asserts = 0; fails: string[] = [];
  init(io: Io) { io.set('go', 0); io.set('rstA_n', 0); io.set('rstB_n', 0); }
  sample(_dom: string, io: Io) {
    this.n++;
    if (this.n > 6 && !this.fails.length) {
      const idle = bit(io, 'idle'), busy = bit(io, 'busy');
      if (idle === busy) this.fails.push(`the controller flags were idle=${idle} busy=${busy} at t=${io.time}: it must be in exactly one state, whatever happens to the subsystem reset`);
    }
    if (this.n > 12 && this.hold === 0 && io.rnd() < 0.2) { io.asyncSet('rstA_n', 0); this.hold = 3; this.asserts++; }
  }
  drive(_dom: string, io: Io) {
    if (this.n === 4) { io.set('rstB_n', 1); io.set('rstA_n', 1); }
    if (this.n === 8) io.set('go', 1);
    if (this.hold > 0 && --this.hold === 0) io.set('rstA_n', 1);
  }
  finish() { if (!this.fails.length && this.asserts < 5) this.fails.push('the subsystem reset was hardly exercised'); return this.fails; }
}
const RDC_SPEC: CdcSpec = { clocks: { clk: 'A' }, inputs: { rstA_n: '*', rstB_n: '*', go: 'A' }, resets: { rstA_n: 'SUB', rstB_n: 'SYS' } };
const RDC_STARTER = `// One clock. The subsystem raises req after go; it is cleared by its own reset rstA_n, which can assert at any time.
// The controller reads req and keeps two flags, of which exactly one must be high: idle or busy.
module req_ctl(input clk, input rstA_n, input rstB_n, input go, output reg idle, output reg busy);
  reg req;

  // subsystem, in reset domain A
  always @(posedge clk or negedge rstA_n) begin
    if (!rstA_n) req <= 1'b0;
    else if (go) req <= 1'b1;
  end

  // controller, in reset domain B only
  always @(posedge clk or negedge rstB_n) begin
    if (!rstB_n) begin
      idle <= 1'b1;
      busy <= 1'b0;
    end else begin
      idle <= ~req;
      busy <= req;
    end
  end
endmodule
`;
const RDC_SOL = `module req_ctl(input clk, input rstA_n, input rstB_n, input go, output reg idle, output reg busy);
  reg req;

  always @(posedge clk or negedge rstA_n) begin
    if (!rstA_n) req <= 1'b0;
    else if (go) req <= 1'b1;
  end

  // the controller is cleared by BOTH resets: while the subsystem reset is asserted it is held, so it never captures req
  always @(posedge clk or negedge rstA_n or negedge rstB_n) begin
    if (!rstA_n || !rstB_n) begin
      idle <= 1'b1;
      busy <= 1'b0;
    end else begin
      idle <= ~req;
      busy <= req;
    end
  end
endmodule
`;
const cdcRdc: CdcLevel = {
  id: 'cdc-rdc', title: 'The reset that crosses', concept: 'reset-domain crossings: an asynchronous reset in one domain corrupts a flop in another', xp: 140, tier: 'guided',
  ticket: 'Resetting the subsystem while the chip is running sometimes leaves the controller with both flags low or both high. It never happens when the whole chip resets, and every clock crossing is clean.',
  build: () => {
    const sc: Scenario[] = [[10, 11], [7, 29], [13, 47], [9, 83]].map(([p, seed]) => ({ periods: { A: p }, phases: { A: 0 }, seed, cycles: 150 }));
    return {
      mode: 'fix', spec: RDC_SPEC, ports: ['clk', 'rstA_n', 'rstB_n', 'go', 'idle', 'busy'], scenarios: sc,
      bench: () => new RdcBench(),
      checks: 'the controller is always in exactly one of idle or busy, even when the subsystem reset asserts at a random instant',
      brief: `<p>There is only <b>one clock</b> here, and still a crossing. The flop <code>req</code> is cleared by the subsystem reset <code>rstA_n</code>. The controller that reads it is cleared by a different reset, <code>rstB_n</code>. That is a <b>reset-domain crossing</b>: an asynchronous reset can assert <i>at any moment</i>, so <code>req</code> snaps to 0 in the middle of the controller's cycle, inside its setup window. The controller's flops go metastable, and <code>idle</code> and <code>busy</code> can settle to <i>different</i> answers: both low, or both high, a state the spec says cannot exist.</p>
<p>The simulation asserts <code>rstA_n</code> at random instants just before a clock edge, and gives a flop that sees a changing input a random mix of old and new, as the clock-crossing missions do. The crossing list shows how the analysis judges your design.</p>
<p>There are two standard cures. Make the controller <b>part of the same reset domain</b> as the thing it reads, so that while that reset is asserted the controller is held and captures nothing. Or make the source's reset <b>synchronous</b>, so that <code>req</code> can only change on a clock edge. Gating the data with the reset signal does not help: the gated value still changes at the wrong time.</p>`,
      hints: ['Add <code>or negedge rstA_n</code> to the controller\'s sensitivity list and test <code>if (!rstA_n || !rstB_n)</code> for the reset branch.', 'The other cure: drop <code>or negedge rstA_n</code> from the source\'s sensitivity list, so <code>req</code> clears only on a clock edge.'],
      starter: RDC_STARTER, solution: RDC_SOL,
    };
  },
};

// ===================================================================== 5. boss: async FIFO
class FifoBench implements Bench {
  acc: number[] = []; got: number[] = []; fails: string[] = []; full = 0; empty = 0; stopAt: number;
  constructor(private wp: number, private rp: number, horizon: number) { this.stopAt = 0.7 * horizon; }
  init(io: Io) { io.set('rst_n', 1); io.set('wr_en', 0); io.set('wdata', 0); io.set('rd_en', 0); }
  drive(dom: string, io: Io) {
    if (dom === 'W') {
      io.set('wr_en', io.time < this.stopAt && io.rnd() < this.wp ? 1 : 0);
      io.set('wdata', Math.floor(io.rnd() * 256));
    } else io.set('rd_en', io.rnd() < this.rp ? 1 : 0);
  }
  sample(dom: string, io: Io) {
    if (dom === 'W') {
      const f = bit(io, 'full');
      if (f) this.full++;
      if (bit(io, 'wr_en') && !f) this.acc.push(Number(io.get('wdata')));
    } else {
      const e = bit(io, 'empty');
      if (e) this.empty++;
      if (bit(io, 'rd_en') && !e) {
        const v = Number(io.get('rdata'));
        const k = this.got.length;
        this.got.push(v);
        if (!this.fails.length) {
          if (k >= this.acc.length) this.fails.push(`word ${k + 1} was read at t=${io.time} but only ${this.acc.length} had been written: empty was wrong`);
          else if (this.acc[k] !== v) this.fails.push(`word ${k + 1}: wrote ${this.acc[k]}, read ${v} (t=${io.time})`);
        }
      }
    }
  }
  finish() {
    if (this.fails.length) return this.fails;
    if (this.acc.length < 30) return [`only ${this.acc.length} words were accepted: the FIFO is too reluctant (full stuck high?)`];
    if (this.got.length !== this.acc.length) return [`${this.acc.length} words written, ${this.got.length} read back: words were lost`];
    return [];
  }
}
const FIFO_SPEC: CdcSpec = { clocks: { wclk: 'W', rclk: 'R' }, inputs: { rst_n: '*', wr_en: 'W', wdata: 'W', rd_en: 'R' }, exempt: ['mem'] };
const FIFO_STARTER = `// A 4-word, 8-bit asynchronous FIFO. Write side: wclk, wr_en, wdata, full. Read side: rclk, rd_en, rdata, empty.
//   * a write is accepted when wr_en is high and full is low; a read pops when rd_en is high and empty is low
//   * rdata always shows the oldest word (first-word fall-through), so it is valid whenever empty is low
//   * the memory is a dual-port array: it may be read in rclk's domain, which the CDC check allows for 'mem'
//     because a word is only read after the (synchronized) write pointer says it is complete
// Pointers need one extra bit to tell full from empty. Cross them in Gray code through two-flop synchronizers.
module async_fifo(input wclk, input rclk, input rst_n, input wr_en, input [7:0] wdata, output full,
                  input rd_en, output [7:0] rdata, output empty);
  reg [7:0] mem [0:3];
  // TODO
  assign full = 1'b0;
  assign empty = 1'b1;
  assign rdata = 8'd0;
endmodule
`;
const FIFO_SOL = `module async_fifo(input wclk, input rclk, input rst_n, input wr_en, input [7:0] wdata, output full,
                  input rd_en, output [7:0] rdata, output empty);
  reg [7:0] mem [0:3];
  reg [2:0] wbin, wgray, rbin, rgray;
  reg [2:0] rg1, rg2;                    // read pointer, synchronized into the write domain
  reg [2:0] wg1, wg2;                    // write pointer, synchronized into the read domain
  wire [2:0] wbin_n;
  wire [2:0] rbin_n;
  assign wbin_n = wbin + 3'd1;
  assign rbin_n = rbin + 3'd1;
  assign full = (wgray == {~rg2[2:1], rg2[0]});
  assign empty = (rgray == wg2);
  assign rdata = mem[rbin[1:0]];

  always @(posedge wclk or negedge rst_n) begin
    if (!rst_n) begin wbin <= 3'd0; wgray <= 3'd0; rg1 <= 3'd0; rg2 <= 3'd0; end
    else begin
      rg1 <= rgray;
      rg2 <= rg1;
      if (wr_en && !full) begin
        mem[wbin[1:0]] <= wdata;
        wbin <= wbin_n;
        wgray <= wbin_n ^ (wbin_n >> 1);
      end
    end
  end

  always @(posedge rclk or negedge rst_n) begin
    if (!rst_n) begin rbin <= 3'd0; rgray <= 3'd0; wg1 <= 3'd0; wg2 <= 3'd0; end
    else begin
      wg1 <= wgray;
      wg2 <= wg1;
      if (rd_en && !empty) begin
        rbin <= rbin_n;
        rgray <= rbin_n ^ (rbin_n >> 1);
      end
    end
  end
endmodule
`;
const cdcFifo: CdcLevel = {
  id: 'cdc-fifo', title: 'Boss: the asynchronous FIFO', concept: 'Gray pointers, two-flop synchronizers, full and empty, dual-port memory', xp: 400, tier: 'boss',
  ticket: 'The clock-domain bridge between the CPU and the peripheral subsystem is a FIFO. The last one lost words under load. Build the proper one.',
  build: (r) => {
    const sc = scenarios(r, 6, ['W', 'R'], 340);
    const mix: [number, number][] = [[0.9, 0.35], [0.35, 0.9], [0.6, 0.6], [1, 1], [0.5, 0.8], [0.8, 0.5]];
    return {
      mode: 'write', spec: FIFO_SPEC, ports: ['wclk', 'rclk', 'rst_n', 'wr_en', 'wdata', 'full', 'rd_en', 'rdata', 'empty'], scenarios: sc,
      bench: (s) => {
        const i = sc.findIndex((x) => x.seed === s.seed);
        return new FifoBench(mix[i % mix.length][0], mix[i % mix.length][1], 340 * Math.max(s.periods.W, s.periods.R));
      },
      checks: 'every word accepted is read back, in order and intact, under write-heavy, read-heavy and balanced traffic',
      brief: `<p>The classic asynchronous FIFO (Cummings' design): a small dual-port memory, a <b>write pointer</b> that lives in the write clock domain and a <b>read pointer</b> in the read domain. Each side needs the other's pointer to decide <code>full</code> and <code>empty</code>, so pointers must cross, as <b>Gray code</b> (one bit changes per step), through <b>two-flop synchronizers</b>.</p>
<ul><li><b>empty</b> (read domain): the read pointer equals the synchronized write pointer.</li><li><b>full</b> (write domain): the write pointer equals the synchronized read pointer with its top two bits inverted (it has wrapped once more).</li><li>Pointers have one extra bit beyond the address, so a full FIFO can be told from an empty one.</li><li>Synchronizing makes each side's view of the other pointer <i>stale</i>: <code>full</code> and <code>empty</code> are conservative (they may stay asserted a little too long) but never wrong the other way. That is what keeps data safe.</li></ul>
<p>You write the whole module (starter lists the interface). The memory <code>mem</code> is exempt from the crossing rules, as in a real design. The bench runs six clock-ratio and traffic combinations and checks that every accepted word comes back out, in order.</p>`,
      hints: [],
      starter: FIFO_STARTER, solution: FIFO_SOL,
    };
  },
};

export const CDC_LEVELS: CdcLevel[] = [cdcSync, cdcPulse, cdcGray, cdcHandshake, cdcRdc, cdcFifo];
export const findCdcLevel = (id: string) => CDC_LEVELS.find((l) => l.id === id);
export type { CdcInstance };

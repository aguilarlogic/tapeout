import type { TimingLevel } from './sta';

const ff = (id: string, label: string, x: number, y: number, extra: Partial<TimingLevel['nodes'][0]> = {}) => ({ id, kind: 'ff' as const, label, x, y, ...extra });
const gate = (id: string, label: string, delay: number, x: number, y: number) => ({ id, kind: 'gate' as const, label, delay, x, y });
const chain = (...ids: string[]) => ids.slice(1).map((to, i) => ({ from: ids[i], to }));

export const TIMING_LEVELS: TimingLevel[] = [
  {
    id: 'sta-slack',
    title: 'Negative Slack',
    concept: 'setup timing & gate sizing',
    xp: 200,
    brief: `
      <p>Data launched by one flop must reach the next flop <b>before the next clock edge</b>, minus its setup time:</p>
      <pre>arrival  = clock latency + clk-&gt;Q + logic delay
required = capture latency + period - setup
slack    = required - arrival   (must be &ge; 0)</pre>
      <p>The worst slack on the chip is the <b>WNS</b>. Click a gate to <b>upsize</b> it (more drive strength = faster, but
      bigger, and it loads the gate before it) or swap it to a <b>low-Vt</b> cell (faster, but leaks ~4x more power).</p>
      <h4>Goal</h4><ul><li>Close timing at 555 MHz (1.8 ns) within the area and leakage budget.</li>
      <li>3 stars: use as little area as possible.</li></ul>`,
    period: 1.8, clkToQ: 0.15, setup: 0.1, hold: 0.05,
    nodes: [
      ff('A', 'reg_a', 0, 1),
      gate('G1', 'ADD8', 0.9, 1, 1),
      gate('G2', 'MUX2', 0.5, 2, 1),
      gate('G3', 'AND2', 0.4, 3, 1),
      ff('B', 'reg_b', 4, 1),
    ],
    edges: chain('A', 'G1', 'G2', 'G3', 'B'),
    budget: { area: 8, leakage: 10 },
    allow: { size: true, vt: true },
    par: { area: 5 },
  },
  {
    id: 'sta-battles',
    title: 'Pick Your Battles',
    concept: 'fixing shared critical paths',
    xp: 250,
    brief: `
      <p>Real designs have thousands of failing paths, but many share the same few gates. Fix the gates that sit on
      <b>several</b> violating paths first, and leave paths with positive slack alone &mdash; speeding them up just burns area
      and leakage.</p>
      <p>Watch the <b>TNS</b> (total negative slack): it tells you how much work is left across all paths.</p>
      <h4>Goal</h4><ul><li>Close timing at 1.6 ns with a tight leakage budget.</li></ul>`,
    period: 1.6, clkToQ: 0.15, setup: 0.1, hold: 0.05,
    nodes: [
      ff('A', 'reg_a', 0, 0),
      ff('D', 'reg_d', 0, 2),
      gate('G1', 'XOR2', 0.6, 1, 0),
      gate('G6', 'OAI21', 0.7, 1, 2),
      gate('G2', 'ADD4', 0.6, 2, 1),
      gate('G3', 'MUX2', 0.5, 3, 1),
      ff('B', 'reg_b', 4, 1),
      gate('G4', 'NAND2', 0.3, 2, 3),
      gate('G5', 'INV', 0.3, 3, 3),
      ff('C', 'reg_c', 4, 3),
    ],
    edges: [...chain('A', 'G1', 'G2', 'G3', 'B'), ...chain('D', 'G6', 'G2'), ...chain('D', 'G4', 'G5', 'C')],
    budget: { area: 14, leakage: 16 },
    allow: { size: true, vt: true },
    par: { area: 12 },
  },
  {
    id: 'sta-hold',
    title: 'Hold the Line',
    concept: 'hold violations & clock skew',
    xp: 250,
    brief: `
      <p>Setup asks "does data arrive in time?". <b>Hold</b> asks "does new data arrive <i>too early</i> and overwrite the
      value the capture flop is still latching?"</p>
      <pre>hold slack = min arrival - (capture latency + hold)</pre>
      <p>Notice the clock period doesn't appear: <b>you can't fix hold by slowing the clock</b>, which is why hold
      violations found after tapeout are very expensive (a respin). Here the clock tree reaches <code>reg_b</code> 0.25 ns late, so the short
      path from <code>reg_a</code> races through. Hold is checked at the fast corner (delays &times; 0.7).</p>
      <p>Click a wire to insert <b>delay buffers</b>. Careful: they also slow down setup on that wire.</p>
      <h4>Goal</h4><ul><li>Fix every hold violation without breaking setup.</li></ul>`,
    period: 1.5, clkToQ: 0.15, setup: 0.1, hold: 0.05,
    nodes: [
      ff('A', 'reg_a', 0, 0),
      ff('C', 'reg_c', 0, 2),
      gate('G1', 'BUF', 0.02, 1, 0),
      gate('G2', 'ADD8', 1.2, 1, 2),
      gate('G3', 'MUX2', 0.08, 2, 1),
      ff('B', 'reg_b', 3, 1, { latency: 0.25, fixed: true }),
    ],
    edges: [...chain('A', 'G1', 'G3', 'B'), ...chain('C', 'G2', 'G3')],
    budget: { area: 8, leakage: 8 },
    allow: { buffer: true },
    par: { area: 5 },
  },
  {
    id: 'sta-skew',
    title: 'Borrowing Time',
    concept: 'useful skew',
    xp: 300,
    brief: `
      <p>Stage 1 is too slow and every gate is already as big as the power budget allows. But stage 2 has slack to spare.
      <b>Useful skew</b> delays the clock to <code>reg_b</code>: stage 1 gets more time, stage 2 gets less.</p>
      <p>There's no free lunch: delaying <code>reg_b</code>'s clock also makes <b>hold</b> harder for any short path that
      ends there.</p>
      <h4>Goal</h4><ul><li>Close setup and hold at 1.8 ns by tuning clock latencies (&plusmn;0.5 ns) and buffers only.</li></ul>`,
    period: 1.8, clkToQ: 0.15, setup: 0.1, hold: 0.05,
    nodes: [
      ff('A', 'reg_a', 0, 0, { fixed: true }),
      ff('X', 'reg_x', 0, 2, { fixed: true }),
      gate('G1', 'MUL4', 1.2, 1, 0),
      gate('G2', 'ADD8', 0.7, 2, 0),
      gate('G5', 'INV', 0.1, 2, 2),
      ff('B', 'reg_b', 3, 1),
      gate('G3', 'AND2', 0.3, 4, 1),
      gate('G4', 'OR2', 0.3, 5, 1),
      ff('C', 'reg_c', 6, 1, { fixed: true }),
    ],
    edges: [...chain('A', 'G1', 'G2', 'B'), ...chain('X', 'G5', 'B'), ...chain('B', 'G3', 'G4', 'C')],
    budget: { area: 12, leakage: 12 },
    allow: { skew: true, buffer: true },
    maxSkew: 0.5,
    par: { area: 8 },
  },
  {
    id: 'sta-pipeline',
    title: 'Pipeline It',
    concept: 'pipelining & latency balance',
    xp: 350,
    brief: `
      <p>When a path is fundamentally too long, no amount of sizing will save it: <b>add a pipeline stage</b>. The
      multiply-accumulate below is allowed <b>one extra cycle</b> of latency.</p>
      <p>Click a wire to insert a register. But every input to a gate must come from the <b>same</b> pipeline stage,
      or you'd be adding this cycle's product to last cycle's operand. Cut the logic cleanly.</p>
      <h4>Goal</h4><ul><li>Run the MAC at 1.5 ns (667 MHz) with at most 1 cycle of added latency.</li></ul>`,
    period: 1.5, clkToQ: 0.15, setup: 0.1, hold: 0.05,
    nodes: [
      ff('A', 'reg_a', 0, 0),
      ff('B', 'reg_b', 0, 1),
      ff('C', 'reg_acc', 0, 3),
      gate('M', 'MUL8', 1.1, 1, 0.5),
      gate('P', 'PREADD', 0.3, 1, 3),
      gate('S', 'ADD16', 0.8, 2, 2),
      gate('R', 'ROUND', 0.2, 3, 2),
      ff('Y', 'reg_y', 4, 2),
    ],
    edges: [
      { from: 'A', to: 'M' }, { from: 'B', to: 'M' },
      { from: 'M', to: 'S' },
      { from: 'C', to: 'P' }, { from: 'P', to: 'S' },
      { from: 'S', to: 'R' }, { from: 'R', to: 'Y' },
    ],
    budget: { area: 20, leakage: 16 },
    allow: { pipeline: true, size: true, vt: true },
    latencyBudget: 1,
    par: { area: 13 },
  },
];

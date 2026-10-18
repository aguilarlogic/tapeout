// The theory chapters added by the Curriculum Order Plan, one subject each, in the order a learner meets them:
//   S2  electricity primer (kid-level)       electricity, resistance
//   S4  DC hand analysis                     psc, mesh, deltawye
//   S5  math for AC                          complex, phasor
//   S6  calculus for circuits                deriv, integral
//   S7  energy storage                       storage
//   S8b Fourier series                       fourier
//   S9  fields                               fields, gauss
//   S11 analog building blocks               opamp
// House style (PR #8): one new idea per step, a worked example before the first question, then questions with a hint
// and, where there is a method to follow, a walkthrough.
import { num, qty, words } from './answers';
import { calc, choice, show, walk } from './teach';
import { art, ask, between, gen, Lesson, mc, pick, say } from './types';

const r3 = (x: number) => +x.toPrecision(3);

// ------------------------------------------------------------------ S2: the electricity primer

export const electricity: Lesson = {
  id: 'electricity',
  title: 'What Is Electricity?',
  concept: 'charge, current, voltage, closed loops',
  xp: 40,
  steps: [
    say('Your lamps need electricity to light up. So what is it? No hard math today. Just a few pictures.'),
    say('**Why this matters:** every part of your chip runs on it. Later chapters build on these words.'),
    say('Everything is made of tiny **atoms**. Inside them are even tinier bits called **electrons**. Each electron carries a little bit of **charge**.'),
    say('In a metal wire, some electrons are free to move. When they all drift the same way, charge flows along the wire.'),
    mc('What moves along a metal wire when electricity flows?', ['Electrons', 'The atoms themselves', 'Air'], 0, 'Free electrons drift along the wire. The atoms stay where they are.'),
    say('One catch. Electrons carry negative charge, so they drift from - to +. Engineers still draw current going from + round to -, as if positive charge moved. This is called **conventional current**, and every circuit drawing uses it.'),
    say('That flow of charge is called **current**. Think of water flowing in a pipe. We count current in **amps**, written A.'),
    say('One amp is a lot for small parts. So we often use **milliamps** (mA). There are 1000 mA in 1 A, just like 1000 mm in 1 m.'),
    art(`
   1 A   =  1000 mA
   a phone charger      about 2 A
   a small lamp (LED)   about 10 mA`, 'how big is an amp?'),
    ask('How many milliamps are in 2 A?', num(2000), '1 A is 1000 mA, so 2 A is 2 x 1000 = 2000 mA.', 'Each amp is 1000 milliamps.'),
    say('What makes the charge flow? A **push**. We call that push **voltage**, and we count it in **volts**, written V. Voltage is always measured **between two points**, like the two ends of a battery.'),
    say('A battery is like a pump. It pushes charge out of one end and pulls it back in at the other end. A bigger voltage is a stronger push.'),
    art(`
   water                    electricity
   pump                     battery
   pipe                     wire
   how hard it pushes       voltage (volts, V)
   how much water flows     current (amps, A)`, 'the water picture'),
    mc('In the water picture, what is voltage like?', ['The push from the pump', 'The amount of water that flows', 'The pipe itself'], 0, 'Voltage is the push. Current is the flow that the push makes.'),
    say('A small AA battery pushes with 1.5 V. A car battery pushes with 12 V. The chip you are building runs on about 1 V.'),
    say('Here is the most important rule. Charge only flows if it can go **all the way round**, out of the battery and back in. That round trip is a **loop**, or a **circuit**.'),
    art(`
   closed loop: lamp ON            open loop: lamp OFF
   +---[lamp]---+                  +---[lamp]---+
   |            |                  |            /   <- switch open
   +--[battery]-+                  +--[battery]-+`, 'a loop must be closed'),
    say('Break the loop anywhere and the flow stops everywhere at once. That is exactly what a switch does.'),
    mc('A lamp is wired to a battery, but one wire has a cut in it. What happens?', ['The lamp stays off: the loop is broken', 'The lamp still glows, but only at half its brightness', 'The lamp stays on'], 0, 'With a gap in the loop, no charge can go round, so no current flows anywhere.'),
    mc('Your first switch lit a lamp. What did closing the switch do?', ['It closed the loop so current could flow', 'It made a brand new battery inside the board', 'It made the wire longer'], 0, 'Closing the switch finished the loop. Charge could go round, so the lamp lit.'),
    gen((r) => {
      const each = pick(r, [10, 20, 50, 100, 250]);
      return walk(
        ask(`Each lamp uses ${each} mA. How many lamps can a 1 A supply light at once?`, num(1000 / each), `1 A is 1000 mA. 1000 / ${each} = ${1000 / each} lamps.`, 'Turn 1 A into milliamps first.'),
        'share out a current', 'A supply can give a total current. Each lamp takes its share. Divide the total by one share.',
        { t: 'do', q: 'How many mA is 1 A?', a: num(1000) },
        { t: 'do', q: `How many shares of ${each} mA fit in 1000 mA?`, a: num(1000 / each) },
      );
    }),
    say('That is electricity: charge, a flow (current, in amps) and a push (voltage, in volts), all going round a loop. Next: what slows the flow down.', 'proud'),
  ],
  recap: ['Current is charge flowing. It is counted in amps (A); 1 A = 1000 mA.', 'Voltage is the push that makes it flow. It is counted in volts (V).', 'Current only flows round a closed loop. A switch opens or closes the loop.'],
};

export const resistance: Lesson = {
  id: 'resistance',
  title: 'Resistance and Power',
  concept: 'resistance, current = voltage / resistance, power',
  xp: 40,
  steps: [
    say('Some things let charge through easily. Others fight it. That fight is called **resistance**.'),
    say('**Why this matters:** every wire in your chip has a little resistance, and it slows the chip down.'),
    say('We count resistance in **ohms**, written with the Greek letter **Ω**. A copper wire has almost none. A lamp has some. Rubber has so much that nothing gets through.'),
    say('Back to water. Resistance is like a narrow bit of pipe. The narrower it is, the less water gets through for the same push.'),
    mc('You keep the same battery but swap in a lamp with **more** resistance. What happens to the current?', ['It goes down', 'It goes up', 'It stays the same'], 0, 'More resistance fights the flow harder, so less current flows for the same push.'),
    say('Push and resistance together decide the flow. The rule is: **current = voltage / resistance**.'),
    art(`
   6 V battery, 3 Ω lamp:
   current = 6 / 3 = 2 A`, 'worked example'),
    ask('A 9 V battery drives a 3 Ω lamp. How many amps flow?', qty(3, 'A', 0.01), 'current = voltage / resistance = 9 / 3 = 3 A.', 'Divide the volts by the ohms.'),
    gen((r) => {
      const R = pick(r, [2, 4, 5, 6]);
      const I = pick(r, [1, 2, 3]);
      const V = R * I;
      return ask(`A ${V} V battery drives a ${R} Ω lamp. How many amps flow?`, qty(I, 'A', 0.01), `${V} / ${R} = ${I} A.`, 'current = voltage / resistance.');
    }),
    say('Last idea: **power**. Power is how fast energy gets used. We count it in **watts**, written W.'),
    say('The rule is: **power = voltage x current**.'),
    art(`
   5 V and 2 A:
   power = 5 x 2 = 10 W`, 'worked example'),
    ask('A lamp has 12 V across it and 2 A through it. How many watts does it use?', qty(24, 'W', 0.01), 'power = voltage x current = 12 x 2 = 24 W.', 'Multiply the volts by the amps.'),
    mc('Which uses more power?', ['5 V at 2 A', '5 V at 1 A'], 0, '5 x 2 = 10 W is more than 5 x 1 = 5 W.'),
    say('Power turns into light and heat. Your chip uses power too, and that is why a phone gets warm.'),
    mc('Where does the power a chip uses end up?', ['Mostly as heat', 'Stored in the chip for later', 'Sent back to the battery'], 0, 'A chip turns almost all of its power into heat. That is why chips have heat sinks and fans.'),
    say('Now you know volts, amps, ohms and watts. Every engineer uses these four words every day.', 'proud'),
  ],
  recap: ['Resistance fights the flow. It is counted in ohms (Ω).', 'current = voltage / resistance.', 'Power is how fast energy is used, in watts (W): power = voltage x current.', 'Power ends up as heat.'],
};

// ------------------------------------------------------------------ S4: DC hand analysis

export const psc: Lesson = {
  id: 'psc',
  title: 'Which Way Is Plus?',
  concept: 'the passive sign convention and power balance',
  xp: 60,
  steps: [
    say('Hand analysis lives or dies on signs. Before any method, you pick a direction for every current and a + and - for every voltage. One rule ties the two together.'),
    say('The **passive sign convention**: draw each part\'s current arrow so it **enters the + end** of that part.'),
    art(`
         +    v    -
     ──►──[  part  ]────        i enters the + end`, 'the passive sign convention'),
    say('With that rule, **p = v × i** is the power the part **absorbs**. A positive p means the part takes energy in (a resistor, a battery being charged). A negative p means it gives energy out (a source).'),
    art(`
   A 9 V battery. 2 A flows OUT of its + end.
   Current entering + is therefore -2 A.
   p = v × i = 9 × (-2) = -18 W
   Negative: the battery delivers 18 W.`, 'worked example'),
    mc('A part has v = 5 V and a current of 2 A entering its + end. What does it do?', ['Absorbs 10 W', 'Delivers 10 W', 'Absorbs 2.5 W'], 0, 'The current enters +, so p = 5 × 2 = +10 W: the part absorbs 10 W.'),
    gen((r) => {
      const v = pick(r, [2, 3, 5, 12]);
      const i = pick(r, [0.5, 1, 2, 3]);
      const enters = pick(r, [true, false]);
      const p = v * (enters ? i : -i);
      return walk(
        ask(`A part has ${v} V across it, + on the left. A current of ${i} A flows through it from ${enters ? 'left to right' : 'right to left'}. What power does it absorb, in W? (Negative means it delivers.)`, qty(p, 'W', 0.01), `${enters ? 'Left to right enters the + end' : 'Right to left leaves the + end'}, so i = ${enters ? '' : '-'}${i} A and p = ${v} × ${enters ? i : -i} = ${p} W.`, 'Does the current enter the + end? If not, it counts as negative.'),
        'passive sign convention', 'Write the current as the amount entering the + end, then multiply by the voltage.',
        choice(`The + end is on the left. Does a current flowing ${enters ? 'left to right' : 'right to left'} enter the + end?`, enters ? 'Yes' : 'No', [enters ? 'No' : 'Yes']),
        calc('Power absorbed:', `${v} × ${enters ? i : -i}`, p, 'W'),
      );
    }),
    say('Why bother? Energy is never lost. So in any circuit, **the absorbed powers of all parts add up to zero**. That is a free check on every answer you work out.'),
    gen((r) => {
      const vs = pick(r, [6, 9, 12]);
      const i = pick(r, [1, 2, 3]);
      const p1 = pick(r, [vs * i / 3, vs * i / 4, vs * i / 2]);
      const p2 = vs * i - p1;
      return walk(
        ask(`A ${vs} V source delivers ${i} A to two resistors. R1 absorbs ${r3(p1)} W. How much does R2 absorb, in W?`, qty(p2, 'W', 0.01, String(r3(p2))), `The source absorbs ${-vs * i} W (it delivers ${vs * i} W). All absorbed powers add to zero: -${vs * i} + ${r3(p1)} + P2 = 0, so P2 = ${r3(p2)} W.`, 'Everything the source delivers, the resistors absorb.'),
        'power balance', 'Add every part\'s absorbed power. The total must be zero.',
        calc('Power the source delivers:', `${vs} × ${i}`, vs * i, 'W'),
        calc('What is left for R2:', `${vs * i} - ${r3(p1)}`, p2, 'W'),
      );
    }),
    say('One more freedom: you may draw a current arrow either way. Guess wrong and the math simply gives a negative number. The sign tells you the true direction.'),
    mc('You draw a current pointing right and solve to get i = -0.5 A. What is really happening?', ['0.5 A flows to the left', '0.5 A flows to the right', 'The circuit has no solution'], 0, 'A negative answer means the current flows against your arrow: 0.5 A to the left.'),
    say('Good. Every method from here, nodal and mesh alike, uses this rule.', 'happy'),
  ],
  recap: ['Passive sign convention: the current arrow enters the + end.', 'Then p = v × i is the power absorbed; negative means delivered.', 'All absorbed powers in a circuit add to zero.', 'A negative current means it flows against your arrow.'],
};

/** Mesh currents of the two-mesh circuit in the lesson: R1 left, R2 shared, R3 right, V1 left (+ up), V2 right (+ up). */
function twoMesh(r1: number, r2: number, r3_: number, v1: number, v2: number) {
  // (R1 + R2) I1 - R2 I2 = V1 ;  -R2 I1 + (R2 + R3) I2 = -V2
  const a = r1 + r2, b = -r2, c = -r2, d = r2 + r3_;
  const det = a * d - b * c;
  return { i1: (v1 * d - b * -v2) / det, i2: (a * -v2 - c * v1) / det, a, d, det };
}

export const mesh: Lesson = {
  id: 'mesh',
  title: 'Mesh Current Analysis',
  concept: 'KVL around each mesh, shared resistors, two equations by hand',
  xp: 90,
  steps: [
    say('Nodal analysis writes KCL at every node. **Mesh analysis** is its twin: it writes KVL around every window of the circuit.'),
    say('A **mesh** is a window: a loop with nothing inside it. Give each mesh its own current that circulates around it, clockwise. These are **mesh currents**.'),
    art(`
        R1 = 1 kΩ        R3 = 1 kΩ
     ┌───/\\/\\/───┬───/\\/\\/───┐
     │           │           │
   + V1 = 10 V  R2 = 2 kΩ   + V2 = 5 V
     │    ↻ I1   │    ↻ I2   │
     └───────────┴───────────┘`, 'two meshes, both currents clockwise'),
    say('A resistor on the edge of one mesh carries that mesh\'s current. A resistor **shared** by two meshes carries the **difference**. R2 carries I1 - I2 downward.'),
    say('Now KVL around each mesh. Going round with the current, a source you climb from - to + is a rise; every resistor is a drop of R × (its current).'),
    art(`
   Left mesh:   V1 = R1·I1 + R2·(I1 - I2)
                10 = 1·I1 + 2·(I1 - I2)   →   3·I1 - 2·I2 = 10

   Right mesh:  0 = R3·I2 + V2 + R2·(I2 - I1)     (V2 is crossed + to -: a drop)
                0 = 1·I2 + 5 + 2·(I2 - I1)    →  -2·I1 + 3·I2 = -5

   Work in kΩ, V and mA. Solve:
   from the first, I1 = (10 + 2·I2) / 3
   put it in the second: -2(10 + 2·I2)/3 + 3·I2 = -5  →  I2 = 1 mA
   then I1 = (10 + 2) / 3 = 4 mA
   R2 carries I1 - I2 = 3 mA down.`, 'worked example'),
    mc('In that circuit, which way does the current in R2 really flow, and how much?', ['3 mA down', '5 mA down', '3 mA up'], 0, 'R2 carries I1 - I2 = 4 - 1 = 3 mA, in the direction of I1: down.'),
    say('Check it with the sign convention: V1 delivers 10 × 4 = 40 mW. V2 absorbs 5 × 1 = 5 mW (I2 enters its + end). The resistors absorb 1·4² + 2·3² + 1·1² = 16 + 18 + 1 = 35 mW. 40 = 5 + 35. It balances.'),
    gen((r) => {
      const r1 = pick(r, [1, 2]), r2 = pick(r, [1, 2, 3]), rr3 = pick(r, [1, 2]);
      const v1 = pick(r, [6, 10, 12]), v2 = pick(r, [2, 3, 4]);
      const m = twoMesh(r1, r2, rr3, v1, v2);
      return walk(
        ask(`Same layout with R1 = ${r1} kΩ, R2 = ${r2} kΩ, R3 = ${rr3} kΩ, V1 = ${v1} V and V2 = ${v2} V. What is the mesh current I1, in mA?`, qty(m.i1, 'mA', 0.02, String(r3(m.i1))), `Left: ${m.a}·I1 - ${r2}·I2 = ${v1}. Right: -${r2}·I1 + ${m.d}·I2 = -${v2}. Solving gives I1 = ${r3(m.i1)} mA and I2 = ${r3(m.i2)} mA.`, 'Write KVL for both meshes, then remove I2.'),
        'mesh analysis', 'One clockwise current per mesh. KVL around each mesh gives one equation per mesh. Two equations, two unknowns.',
        calc('Left mesh, the factor on I1 is R1 + R2:', `${r1} + ${r2}`, m.a, ''),
        calc('Right mesh, the factor on I2 is R2 + R3:', `${r2} + ${rr3}`, m.d, ''),
        show(`${m.a}·I1 - ${r2}·I2 = ${v1}\n-${r2}·I1 + ${m.d}·I2 = -${v2}`, 'the two mesh equations'),
        'Cramer\'s rule solves two equations at once: the determinant is (first factor × second factor) - (shared R)².',
        calc('Determinant:', `${m.a} × ${m.d} - ${r2}²`, m.det, ''),
        calc('I1 = (V1 × (R2 + R3) - R2 × V2) / determinant:', `(${v1} × ${m.d} - ${r2} × ${v2}) / ${m.det}`, m.i1, 'mA'),
      );
    }),
    gen((r) => {
      const r1 = pick(r, [1, 2]), r2 = pick(r, [2, 3]), rr3 = pick(r, [1, 2]);
      const v1 = pick(r, [9, 12]), v2 = pick(r, [3, 6]);
      const m = twoMesh(r1, r2, rr3, v1, v2);
      const d = m.i1 - m.i2;
      return ask(`R1 = ${r1} kΩ, R2 = ${r2} kΩ, R3 = ${rr3} kΩ, V1 = ${v1} V, V2 = ${v2} V. The mesh currents are I1 = ${r3(m.i1)} mA and I2 = ${r3(m.i2)} mA. What current flows down through R2, in mA?`, qty(d, 'mA', 0.02, String(r3(d))), `The shared resistor carries the difference: ${r3(m.i1)} - ${r3(m.i2)} = ${r3(d)} mA.`, 'A shared resistor carries I1 - I2.');
    }),
    mc('Mesh analysis needs a circuit you can draw how?', ['Flat, with no wires crossing', 'With only one source', 'With every resistor the same'], 0, 'Meshes are the windows of a flat (planar) drawing. If wires must cross, there are no clean windows; use nodal analysis instead.'),
    mc('A circuit has 6 nodes and 2 meshes. Which method gives fewer equations?', ['Mesh: 2 equations', 'Nodal: 2 equations', 'They always give the same number'], 0, 'Nodal needs one equation per node except ground (5 here). Mesh needs one per mesh (2). Pick the method with fewer unknowns.'),
    say('Next you predict the mesh currents of a new circuit by hand, then let the simulator check you.', 'excited'),
  ],
  recap: ['A mesh current circulates round one window, clockwise.', 'A shared resistor carries the difference of the two mesh currents.', 'KVL round each mesh gives one equation per mesh.', 'Use mesh on flat circuits with few windows; nodal when there are few nodes.'],
};

export const deltawye: Lesson = {
  id: 'deltawye',
  title: 'Delta and Wye',
  concept: 'delta-wye conversion, derived, and the unbalanced bridge',
  xp: 80,
  steps: [
    say('Some resistor networks are neither series nor parallel. An **unbalanced bridge** is the classic case: no two resistors simply add.'),
    say('The fix is a swap. Three resistors joined in a triangle are a **delta** (Δ). Three resistors meeting at a centre point are a **wye** (Y), or star. From the three corners, the right wye behaves exactly like the delta.'),
    art(`
        a                      a
        ●                      ●
      Rca\\  /Rab               │ Ra
         \\/                    ●  centre
     c ●──Rbc──● b           /   \\
                           Rc     Rb
                          c ●     ● b
        delta (Δ)              wye (Y)`, 'the same three corners, two networks'),
    say('**The derivation.** Two networks are the same if the resistance between every pair of corners matches, with the third corner left unconnected. Between a and b, the wye gives Ra + Rb. The delta gives Rab in parallel with (Rbc + Rca).'),
    art(`
   Let S = Rab + Rbc + Rca.
   a to b:   Ra + Rb = Rab·(Rbc + Rca) / S
   a to c:   Ra + Rc = Rca·(Rab + Rbc) / S
   b to c:   Rb + Rc = Rbc·(Rab + Rca) / S

   Add the first two and subtract the third. Rb and Rc cancel on the left:
   2·Ra = [Rab·Rbc + Rab·Rca + Rca·Rab + Rca·Rbc - Rbc·Rab - Rbc·Rca] / S
        = 2·Rab·Rca / S
   so   Ra = Rab·Rca / S`, 'deriving the wye resistor at corner a'),
    say('The rule in words: **each wye resistor = the product of the two delta resistors touching its corner, divided by the sum of all three.**'),
    art(`
   Delta of 3 kΩ, 3 kΩ, 3 kΩ:   S = 9 kΩ
   Ra = 3 × 3 / 9 = 1 kΩ, and the same for Rb and Rc.
   An equal delta becomes an equal wye of one third the size.`, 'worked example'),
    ask('A delta has three 30 Ω resistors. What is each resistor of the equivalent wye, in Ω?', qty(10, 'Ω', 0.01), 'Equal delta: R_Y = R_Δ / 3 = 30 / 3 = 10 Ω.', 'Product of two over the sum of three: 30 × 30 / 90.'),
    gen((r) => {
      const rab = pick(r, [10, 20, 30]), rbc = pick(r, [10, 40, 50]), rca = pick(r, [20, 30, 60]);
      const S = rab + rbc + rca;
      const ra = (rab * rca) / S;
      return walk(
        ask(`A delta has Rab = ${rab} Ω, Rbc = ${rbc} Ω and Rca = ${rca} Ω. What is the wye resistor Ra at corner a, in Ω?`, qty(ra, 'Ω', 0.02, String(r3(ra))), `Ra = Rab·Rca / S = ${rab} × ${rca} / ${S} = ${r3(ra)} Ω.`, 'Corner a touches Rab and Rca.'),
        'delta to wye', 'Each wye resistor is the product of the two delta resistors that touch its corner, over the sum of all three.',
        choice('Which two delta resistors touch corner a?', 'Rab and Rca', ['Rab and Rbc', 'Rbc and Rca']),
        calc('Sum of all three:', `${rab} + ${rbc} + ${rca}`, S, 'Ω'),
        calc('Ra:', `${rab} × ${rca} / ${S}`, ra, 'Ω'),
      );
    }),
    say('The swap also runs backwards, wye to delta: **each delta resistor = (Ra·Rb + Rb·Rc + Rc·Ra) divided by the wye resistor opposite it**.'),
    ask('A wye has three 10 Ω resistors. What is each resistor of the equivalent delta, in Ω?', qty(30, 'Ω', 0.01), '(10·10 + 10·10 + 10·10) / 10 = 300 / 10 = 30 Ω. It is the first example run backwards.', 'An equal wye becomes an equal delta three times as big.'),
    say('Now the bridge. Convert the top triangle of the bridge into a wye, and what is left is plain series and parallel.'),
    art(`
   Bridge from top T to bottom B, middle nodes A and C:
   T-A = 20 Ω, T-C = 20 Ω, A-C = 10 Ω (the bridge), A-B = 6 Ω, C-B = 16 Ω.

   Top delta (T, A, C): S = 20 + 20 + 10 = 50 Ω
     R_T = 20·20/50 = 8 Ω,  R_A = 20·10/50 = 4 Ω,  R_C = 20·10/50 = 4 Ω
   Now: 8 Ω in series with ( (4 + 6) ∥ (4 + 16) ) = 8 + (10 ∥ 20) = 8 + 6.67
   Total from T to B = 14.7 Ω`, 'worked example: an unbalanced bridge'),
    gen((r) => {
      const ab = pick(r, [6, 8, 12]), cb = pick(r, [16, 20, 24]);
      const left = 4 + ab, right = 4 + cb;
      const tot = 8 + (left * right) / (left + right);
      return walk(
        ask(`Same top triangle (20 Ω, 20 Ω and a 10 Ω bridge), but now A-B = ${ab} Ω and C-B = ${cb} Ω. What is the total resistance from T to B, in Ω?`, qty(tot, 'Ω', 0.02, String(r3(tot))), `The top wye is 8, 4 and 4 Ω. Legs: 4 + ${ab} = ${left} Ω and 4 + ${cb} = ${right} Ω, in parallel = ${r3((left * right) / (left + right))} Ω. Plus 8 Ω: ${r3(tot)} Ω.`, 'Reuse the wye from the example: 8, 4 and 4 Ω.'),
        'delta to wye, then series and parallel', 'Convert the triangle, then add series parts and combine parallel ones.',
        calc('Left leg, R_A plus A-B:', `4 + ${ab}`, left, 'Ω'),
        calc('Right leg, R_C plus C-B:', `4 + ${cb}`, right, 'Ω'),
        calc('The two legs in parallel:', `${left} × ${right} / (${left} + ${right})`, (left * right) / (left + right), 'Ω'),
        calc('Add R_T:', `8 + ${r3((left * right) / (left + right))}`, tot, 'Ω'),
      );
    }),
    say('Delta-wye shows up again in three-phase power and in RF matching networks. In chips, it is a fast way to reduce a resistor mesh by hand before you trust a tool.', 'happy'),
  ],
  recap: ['Delta to wye: R_corner = (product of the two delta resistors at that corner) / (sum of all three).', 'Wye to delta: R_side = (RaRb + RbRc + RcRa) / (the wye resistor opposite).', 'Equal: R_Y = R_Δ / 3.', 'Derived by matching the resistance between every pair of corners.'],
};

// ------------------------------------------------------------------ S5: math for AC

export const complex: Lesson = {
  id: 'complex',
  title: 'Complex Numbers',
  concept: 'j, real and imaginary parts, magnitude and angle',
  xp: 70,
  steps: [
    say('Some equations have no ordinary answer. Try x × x = -1: no ordinary number squares to a negative.'),
    say('So engineers invent one. Call it **j**, with **j × j = -1**. Mathematicians write i, but in circuits i already means current, so we use j.'),
    say('A **complex number** has an ordinary part and a j part, like **3 + 4j**. The ordinary part is the **real** part (3). The j part is the **imaginary** part (4).'),
    say('Picture it as a point on a map: 3 steps right along the real axis, 4 steps up the imaginary axis. Or as an arrow from the centre to that point.'),
    art(`
     imag
      4 ┤        ● 3 + 4j
        │      ／
        │    ／
        │  ／
        └──┴───┴───┴── real
           1   2   3`, 'the complex plane'),
    say('**Adding**: add the real parts, and add the imaginary parts. Worked example: (3 + 4j) + (1 - 2j) = 4 + 2j.'),
    gen((r) => {
      const a = between(r, 1, 6), b = between(r, 1, 6), c = between(r, 1, 6), d = -between(r, 1, 4);
      return ask(`What is the real part of (${a} + ${b}j) + (${c} - ${-d}j)?`, num(a + c), `Real parts: ${a} + ${c} = ${a + c}. (The imaginary part is ${b} - ${-d} = ${b + d}.)`, 'Add only the ordinary parts.');
    }),
    say('**Multiplying**: multiply out like ordinary algebra, then replace every j × j with -1.'),
    art(`
   (1 + 2j)(3 + j) = 1·3 + 1·j + 2j·3 + 2j·j
                   = 3 + j + 6j + 2j²
                   = 3 + 7j - 2          (j² = -1)
                   = 1 + 7j`, 'worked example'),
    ask('What is (2 + j)(2 - j)? It comes out as an ordinary number.', num(5), '(2 + j)(2 - j) = 4 - 2j + 2j - j² = 4 - (-1) = 5.', 'Multiply out; the j terms cancel and j² = -1.'),
    say('Every arrow has a **magnitude** (its length) and an **angle** (measured anticlockwise from the real axis). For a + bj: magnitude = √(a² + b²), angle = atan(b / a) when a > 0.'),
    art(`
   3 + 4j:  magnitude = √(9 + 16) = 5
            angle = atan(4/3) = 53.1°
   We write it 5∠53.1°.`, 'worked example'),
    gen((r) => {
      const [a, b, m] = pick(r, [[6, 8, 10], [5, 12, 13], [8, 6, 10], [9, 12, 15]] as const);
      return walk(
        ask(`What is the magnitude of ${a} + ${b}j?`, qty(m, '', 0.01, String(m)), `√(${a}² + ${b}²) = √${a * a + b * b} = ${m}.`, 'Pythagoras: √(a² + b²).'),
        'magnitude', 'The arrow and its two parts make a right triangle, so its length comes from Pythagoras.',
        calc('Square the parts and add:', `${a}² + ${b}²`, a * a + b * b, ''),
        calc('Square root:', `√${a * a + b * b}`, m, ''),
      );
    }),
    ask('What is the angle of 1 + 1j, in degrees?', qty(45, '', 0.02, '45'), 'atan(1/1) = 45°. The arrow points exactly halfway between the two axes.', 'atan(imaginary / real).'),
    say('Here is the magic. **Multiplying multiplies the lengths and adds the angles.** Worked example: (2∠30°) × (3∠60°) = 6∠90°, an arrow 6 long pointing straight up: 6j.'),
    mc('What does multiplying an arrow by j do? (j itself is 1∠90°.)', ['Turns it 90° anticlockwise', 'Doubles its length', 'Flips it to point the other way'], 0, 'j has length 1 and angle 90°, so multiplying by j keeps the length and adds 90°.'),
    gen((r) => {
      const m1 = pick(r, [2, 3, 4]), a1 = pick(r, [10, 20, 30]), m2 = pick(r, [2, 5]), a2 = pick(r, [40, 50, 60]);
      return ask(`Multiply ${m1}∠${a1}° by ${m2}∠${a2}°. What is the angle of the result, in degrees?`, qty(a1 + a2, '', 0.01, String(a1 + a2)), `Angles add: ${a1} + ${a2} = ${a1 + a2}°. (The length is ${m1} × ${m2} = ${m1 * m2}.)`, 'Multiplying adds the angles.');
    }),
    say('That rotation rule is why AC circuits use complex numbers. Next: the formula behind it.', 'proud'),
  ],
  recap: ['j × j = -1.', 'a + bj: real part a, imaginary part b; a point or arrow on the plane.', 'Add part by part; multiply out and use j² = -1.', 'Magnitude √(a² + b²), angle atan(b/a).', 'Multiplying: lengths multiply, angles add.'],
};

export const phasor: Lesson = {
  id: 'phasor',
  title: "Euler's Formula and Phasors",
  concept: "Euler's formula, polar form, phasors for sine waves",
  xp: 80,
  steps: [
    say('Behind the rotation rule is one of the most famous lines in math, **Euler\'s formula**:'),
    art(`
   e^(jθ) = cos θ + j·sin θ`, "Euler's formula"),
    say('Read it as an arrow of length 1 at angle θ. Its real part is cos θ and its imaginary part is sin θ.'),
    say('**Why is it true?** Write e^x as its power series, then put x = jθ. The powers of j repeat: j, -1, -j, 1, j, ...'),
    art(`
   e^x = 1 + x + x²/2! + x³/3! + x⁴/4! + x⁵/5! + ...

   x = jθ:
   e^(jθ) = 1 + jθ - θ²/2! - jθ³/3! + θ⁴/4! + jθ⁵/5! - ...

   real terms:  1 - θ²/2! + θ⁴/4! - ...   = cos θ
   j terms:     θ - θ³/3! + θ⁵/5! - ...   = sin θ`, 'why Euler\'s formula holds'),
    mc('What is e^(jπ)? (π radians is 180°.)', ['-1', '1', 'j', '0'], 0, 'cos π + j sin π = -1 + 0j = -1. The arrow of length 1 points straight left.'),
    ask('Write e^(jπ/2) as a complex number. (π/2 is 90°.)', words('j', '1j', '0+j', '0+1j', 'i'), 'cos 90° + j sin 90° = 0 + j = j: the arrow points straight up.', 'cos 90° = 0 and sin 90° = 1.'),
    say('So any arrow can be written **r·e^(jθ)**: length r, angle θ. Multiplying two of them is just r1·r2·e^(j(θ1 + θ2)), because exponents add. That is the rule from last lesson, proved.'),
    say('Now the big idea. A sine wave **A·cos(ωt + φ)** is the real part of an arrow **A·e^(j(ωt + φ))** that spins round at speed ω. In a linear circuit driven by one sine wave, once it settles, every voltage and current spins at that same ω.'),
    say('So we drop the spin and keep only the starting arrow, **A·e^(jφ)**, written **A∠φ**. That arrow is the **phasor**. It holds the two things that differ between signals: size and phase.'),
    art(`
   5·cos(ωt + 30°)   →   phasor 5∠30°
                     =   5·cos 30° + j·5·sin 30°
                     =   4.33 + 2.5j`, 'worked example'),
    gen((r) => {
      const A = pick(r, [2, 4, 10]), ph = pick(r, [0, 30, 60, 90]);
      const c = A * Math.cos((ph * Math.PI) / 180), re = Math.abs(c) < 1e-9 ? 0 : c; // cos 90° is 6e-17 in floating point, not 0
      return walk(
        ask(`What is the real part of the phasor for ${A}·cos(ωt + ${ph}°)?`, qty(re, '', 0.02, String(r3(re))), `Phasor ${A}∠${ph}°. Real part = ${A}·cos ${ph}° = ${r3(re)}.`, 'Real part = A·cos φ.'),
        'phasor', 'Drop the ωt. The phasor is A∠φ; its real part is A·cos φ and its imaginary part A·sin φ.',
        show(`${A}·cos(ωt + ${ph}°)  →  ${A}∠${ph}°`),
        calc('Real part:', `${A} × cos ${ph}°`, re, ''),
      );
    }),
    say('Adding two sine waves of the same frequency is now just adding arrows. Worked example: 3·cos(ωt) + 4·cos(ωt + 90°) is 3∠0° + 4∠90° = 3 + 4j = 5∠53.1°. So the sum is 5·cos(ωt + 53.1°).'),
    gen((r) => {
      const [a, b, m] = pick(r, [[6, 8, 10], [5, 12, 13], [9, 12, 15]] as const);
      return ask(`What is the amplitude of ${a}·cos(ωt) + ${b}·cos(ωt + 90°)?`, qty(m, '', 0.01, String(m)), `${a}∠0° + ${b}∠90° = ${a} + ${b}j, with length √(${a}² + ${b}²) = ${m}.`, 'Add the phasors as arrows, then take the length.');
    }),
    mc('Why can a phasor drop the ωt?', ['Every signal in the circuit spins at the same ω', 'ω is always zero in a circuit', 'Phasors only work for DC'], 0, 'A linear circuit driven at one frequency makes every voltage and current spin at that frequency. Only size and phase differ.'),
    say('With phasors, AC circuits become algebra. You will use them for impedance after the calculus and energy-storage chapters.', 'proud'),
  ],
  recap: ["Euler: e^(jθ) = cos θ + j sin θ.", 'Polar form r·e^(jθ) = r∠θ; multiplying adds angles because exponents add.', 'A·cos(ωt + φ) → phasor A∠φ.', 'Same-frequency sine waves add as arrows.'],
};

// ------------------------------------------------------------------ S6: calculus for circuits

export const deriv: Lesson = {
  id: 'deriv',
  title: 'Rate of Change',
  concept: 'rate of change, slope, the derivative and its rules',
  xp: 70,
  steps: [
    say('Voltages in a chip change all the time. **How fast** they change matters as much as their value: it decides how fast a chip can switch and how much noise lands on its supply.'),
    say('The **rate of change** is how much something changes per second. Worked example: a node goes from 1 V to 3 V in 2 ms. Rate = (3 - 1) / 0.002 s = 1000 V/s.'),
    ask('A node goes from 0 V to 5 V in 1 µs. How fast is it changing, in V/µs?', qty(5, '', 0.01, '5'), '5 V in 1 µs is 5 V/µs, which is 5,000,000 V/s.', 'Change divided by time.'),
    say('On a graph of v against t, the rate of change is the **slope**: rise over run. A steep line changes fast. A flat line does not change at all.'),
    art(`
    v │          ╱  steep: changing fast
      │        ╱
      │──────╱      flat part: rate = 0
      └─────────────── t`, 'slope = rate of change'),
    say('For a curve, the slope keeps changing. Zoom in on one instant until the curve looks straight. The slope there is the **derivative**, written **dv/dt**.'),
    say('A few rules give you almost every derivative a circuit needs:'),
    art(`
   d/dt (constant) = 0
   d/dt (t)        = 1
   d/dt (tⁿ)       = n·tⁿ⁻¹
   d/dt (a·f + g)  = a·df/dt + dg/dt

   v = 3t² + 2t   →   dv/dt = 6t + 2
   at t = 1:  dv/dt = 8`, 'the rules, with a worked example'),
    gen((r) => {
      const a = between(r, 1, 5), b = between(r, 1, 6), t = between(r, 1, 4);
      const d = 2 * a * t + b;
      return walk(
        ask(`v = ${a}t² + ${b}t. What is dv/dt at t = ${t}?`, num(d), `dv/dt = ${2 * a}t + ${b}. At t = ${t}: ${2 * a} × ${t} + ${b} = ${d}.`, 'Bring the power down: t² becomes 2t; t becomes 1.'),
        'power rule', 'Differentiate term by term: a·tⁿ becomes a·n·tⁿ⁻¹. Then put in the time.',
        { t: 'do', q: `The derivative of ${a}t² is (?)·t:`, a: num(2 * a) },
        { t: 'do', q: `The derivative of ${b}t is:`, a: num(b) },
        calc('At this time:', `${2 * a} × ${t} + ${b}`, d, ''),
      );
    }),
    say('Two more you will use constantly. For a sine wave, **d/dt sin(ωt) = ω·cos(ωt)**: the faster it wiggles, the steeper it gets. For a decay, **d/dt e^(-t/τ) = -(1/τ)·e^(-t/τ)**.'),
    art(`
   v = 2·sin(1000t)
   dv/dt = 2 × 1000 × cos(1000t)
   peak slope = 2000 V/s`, 'worked example'),
    gen((r) => {
      const A = pick(r, [1, 2, 3]), w = pick(r, [100, 500, 1000]);
      return ask(`v = ${A}·sin(${w}t). What is the peak value of dv/dt, in V/s?`, qty(A * w, '', 0.01, String(A * w)), `dv/dt = ${A} × ${w} × cos(${w}t), which peaks at ${A * w} V/s.`, 'Multiply the amplitude by ω.');
    }),
    mc('A 1 V sine at 1 kHz and a 1 V sine at 1 MHz. Which has the steeper peak slope?', ['The 1 MHz one, 1000 times steeper', 'The 1 kHz one', 'They are the same, both are 1 V'], 0, 'Peak slope is A·ω, and ω is 1000 times bigger at 1 MHz.'),
    say('Next: running the derivative backwards, to add up a change over time.', 'happy'),
  ],
  recap: ['Rate of change = change / time; on a graph it is the slope.', 'The derivative dv/dt is the slope at one instant.', 'd/dt tⁿ = n·tⁿ⁻¹; constants factor out; sums go term by term.', 'd/dt sin(ωt) = ω cos(ωt); d/dt e^(-t/τ) = -(1/τ) e^(-t/τ).'],
};

export const integral: Lesson = {
  id: 'integral',
  title: 'Area Under a Curve',
  concept: 'the integral as area, the fundamental theorem, averages',
  xp: 70,
  steps: [
    say('The derivative asks **how fast**. The **integral** asks **how much in total**: it adds up a rate over time.'),
    say('Current is charge per second. So the total charge that flows is the **area under the current-versus-time graph**.'),
    art(`
    i │
   2mA├────────┐
      │ area   │     2 mA for 3 ms:
      │        │     charge = 2 mA × 3 ms = 6 µC
      └────────┴──── t
               3 ms`, 'worked example: a rectangle'),
    ask('A steady 5 mA flows for 4 ms. How much charge flows, in µC?', qty(20, '', 0.01, '20'), '5 mA × 4 ms = 20 µC (milli times milli is micro).', 'Height times width.'),
    say('A ramp makes a triangle, and a triangle\'s area is half base times height. Worked example: current rising evenly from 0 to 4 mA over 2 ms gives ½ × 2 ms × 4 mA = 4 µC.'),
    gen((r) => {
      const peak = pick(r, [2, 6, 10]), ms = pick(r, [1, 3, 4]);
      return ask(`Current rises evenly from 0 to ${peak} mA over ${ms} ms. How much charge flows, in µC?`, qty((peak * ms) / 2, '', 0.01, String((peak * ms) / 2)), `A triangle: ½ × ${ms} ms × ${peak} mA = ${(peak * ms) / 2} µC.`, 'Half base times height.');
    }),
    say('The integral is written **∫ from a to b of f(t) dt**: the area under f between t = a and t = b.'),
    say('Here is the shortcut, the **fundamental theorem of calculus**: find any F whose derivative is f. Then the area is just **F(b) - F(a)**. Integrating runs the derivative backwards.'),
    art(`
   ∫ from 0 to 3 of 2t dt
   F = t²  (because d/dt t² = 2t)
   area = F(3) - F(0) = 9 - 0 = 9

   check: 2t is a triangle with base 3 and height 6,
   and ½ × 3 × 6 = 9.  ✓`, 'worked example'),
    gen((r) => {
      const c = pick(r, [2, 4, 6]), b = pick(r, [2, 3, 5]);
      const area = (c * b * b) / 2;
      return walk(
        ask(`What is ∫ from 0 to ${b} of ${c}t dt?`, qty(area, '', 0.01, String(area)), `F = ${c / 2}t² (its derivative is ${c}t). F(${b}) - F(0) = ${c / 2} × ${b * b} = ${area}.`, 'Find F whose derivative is the inside; then F(end) - F(start).'),
        'fundamental theorem of calculus', 'Undo the derivative: tⁿ came from tⁿ⁺¹/(n+1). Then subtract the value at the start from the value at the end.',
        { t: 'do', q: `${c}t is the derivative of (?)·t²:`, a: num(c / 2) },
        calc('F at the end:', `${c / 2} × ${b}²`, area, ''),
        calc('Minus F at the start (t = 0):', `${area} - 0`, area, ''),
      );
    }),
    say('Two integrals come back again and again. Over one whole period T, **∫ sin(ωt) dt = 0**: as much area above the axis as below. And **∫ sin²(ωt) dt = T/2**.'),
    say('Why T/2? Because sin² + cos² = 1 at every instant, so over a period their integrals add to T. Over a whole period the two look the same, just shifted, so each gets half.'),
    mc('What is the integral of sin(ωt) over one full period?', ['0', 'T/2', '1', 'T'], 0, 'The positive half and the negative half have equal areas and cancel.'),
    ask('What is the average value of sin²(ωt) over a full period?', qty(0.5, '', 0.01, '0.5'), 'Average = (1/T) ∫ sin² dt = (1/T)(T/2) = 1/2.', 'The integral over a period is T/2. Divide by T.'),
    say('That last one is why a sine wave\'s **rms** value is its peak over √2: rms is the square root of the average of v², and the average of sin² is ½.'),
    gen((r) => {
      const pk = pick(r, [1, 2, 10, 170]);
      return ask(`A sine wave peaks at ${pk} V. What is its rms value, in V?`, qty(pk / Math.SQRT2, 'V', 0.02, String(r3(pk / Math.SQRT2))), `rms = √(average of v²) = √(${pk}² × ½) = ${pk}/√2 = ${r3(pk / Math.SQRT2)} V.`, 'Peak divided by √2.');
    }),
    say('Derivatives and integrals are the two tools every later chapter leans on: parts that store energy, waves and fields. You have both now.', 'proud'),
  ],
  recap: ['The integral is the area under a curve: total charge = ∫ i dt.', 'Fundamental theorem: ∫ from a to b of f dt = F(b) - F(a), where dF/dt = f.', '∫ sin over a period = 0; ∫ sin² over a period = T/2.', 'rms of a sine = peak / √2.'],
};

// ------------------------------------------------------------------ S7: energy storage

export const storage: Lesson = {
  id: 'storage',
  title: 'Capacitors, Inductors and Kickback',
  concept: 'i = C dv/dt, v = L di/dt, stored energy, inductor kickback, the flyback diode',
  xp: 90,
  steps: [
    say('A resistor\'s current depends on its voltage right now. Two other parts care about **change**: the capacitor and the inductor. They store energy, so circuits with them have a memory.'),
    say('A **capacitor** is two conducting plates with a thin gap. Push charge onto one plate and an equal, opposite charge gathers on the other: **q = C·v** (q is the charge on either plate). C is the **capacitance**, in farads (F). Charge q is counted in **coulombs** (C): one amp is one coulomb flowing past every second.'),
    say('Current is how fast charge arrives, so take the derivative of q = C·v: **i = C·dv/dt**. A capacitor\'s current depends on how fast its voltage changes.'),
    art(`
   1 µF, voltage rising at 1000 V/s:
   i = C·dv/dt = 1×10⁻⁶ × 1000 = 1 mA`, 'worked example'),
    gen((r) => {
      const C = pick(r, [10, 47, 100]), dv = pick(r, [1, 2, 5]), dt = pick(r, [1, 10]);
      const i = (C * 1e-9 * dv) / (dt * 1e-6);
      return walk(
        ask(`A ${C} nF capacitor's voltage ramps up by ${dv} V in ${dt} µs. What current flows into it, in mA?`, qty(i * 1000, 'mA', 0.02, String(r3(i * 1000))), `dv/dt = ${dv} V / ${dt} µs = ${r3(dv / (dt * 1e-6))} V/s. i = ${C} nF × that = ${r3(i * 1000)} mA.`, 'i = C × dv/dt.'),
        'capacitor law', 'Find the rate of change of the voltage, then multiply by the capacitance.',
        calc('dv/dt, in V/s:', `${dv} / ${dt}e-6`, dv / (dt * 1e-6), 'V/s'),
        calc('i = C·dv/dt, in mA:', `${C}e-9 × ${r3(dv / (dt * 1e-6))} × 1000`, i * 1000, 'mA'),
      );
    }),
    say('Two consequences. A capacitor\'s voltage **cannot jump** in zero time: that would need infinite current. And at steady DC, dv/dt = 0, so **no current flows**: it acts like an open circuit.'),
    mc('Long after a DC supply is connected, how much current flows into a capacitor?', ['None', 'As much as the supply can give', 'It keeps rising forever'], 0, 'Once the voltage stops changing, dv/dt = 0 and i = C·dv/dt = 0.'),
    say('An **inductor** is a coil of wire. Current through it builds a magnetic field, and the field fights any **change** in that current: **v = L·di/dt**. L is the **inductance**, in henries (H).'),
    art(`
   10 mH, current rising by 2 A every millisecond:
   di/dt = 2 / 0.001 = 2000 A/s
   v = L·di/dt = 0.01 × 2000 = 20 V`, 'worked example'),
    gen((r) => {
      const L = pick(r, [1, 5, 10]), di = pick(r, [1, 2, 4]), ms = pick(r, [1, 2]);
      const v = (L * 1e-3 * di) / (ms * 1e-3);
      return ask(`A ${L} mH inductor's current rises by ${di} A in ${ms} ms. What voltage appears across it, in V?`, qty(v, 'V', 0.02, String(r3(v))), `di/dt = ${di} / ${ms} ms = ${(di / ms) * 1000} A/s. v = ${L} mH × that = ${r3(v)} V.`, 'v = L × di/dt.');
    }),
    say('The inductor is the capacitor\'s mirror. Its **current** cannot jump, and at steady DC it is just a wire (di/dt = 0, so v = 0).'),
    say('Both store energy. A capacitor holds **½·C·v²** in the charge held apart on its two plates. An inductor holds **½·L·i²** in its magnetic field. Worked example: 100 µF at 10 V holds ½ × 100×10⁻⁶ × 100 = 5 mJ.'),
    gen((r) => {
      const L = pick(r, [10, 50, 100]), i = pick(r, [0.1, 0.2, 0.5]);
      const e = 0.5 * L * 1e-3 * i * i * 1000;
      return ask(`A ${L} mH coil carries ${i} A. How much energy does it store, in mJ?`, qty(e, '', 0.02, String(r3(e))), `½ × ${L} mH × ${i}² = ${r3(e)} mJ.`, '½ L i².');
    }),
    say('Now the danger. A relay coil carries current. A transistor switch turns it off very fast. The coil\'s current must stop, so di/dt is huge, and so is v = L·di/dt. That spike is **inductor kickback**.'),
    art(`
   50 mH relay coil carrying 100 mA, switched off in 1 µs:
   di/dt = -0.1 A / 1 µs = -100,000 A/s
   v = L·di/dt = 0.05 × -100,000 = -5000 V   (across the coil)
   The switch sees thousands of volts and breaks down.`, 'worked example'),
    gen((r) => {
      const L = pick(r, [10, 20, 50]), I = pick(r, [50, 100, 200]), us = pick(r, [1, 2, 10]);
      const v = (L * 1e-3 * I * 1e-3) / (us * 1e-6);
      return walk(
        ask(`A ${L} mH coil carrying ${I} mA is switched off in ${us} µs. How big is the kickback spike, in V?`, qty(v, 'V', 0.02, String(r3(v))), `|di/dt| = ${I} mA / ${us} µs = ${r3((I * 1e-3) / (us * 1e-6))} A/s. v = ${L} mH × that = ${r3(v)} V.`, 'v = L × (current change) / (time).'),
        'inductor kickback', 'The coil keeps its current flowing for an instant. Stopping it fast makes a big di/dt, and v = L·di/dt.',
        calc('|di/dt|, in A/s:', `${I}e-3 / ${us}e-6`, (I * 1e-3) / (us * 1e-6), 'A/s'),
        calc('Spike, in V:', `${L}e-3 × ${r3((I * 1e-3) / (us * 1e-6))}`, v, 'V'),
      );
    }),
    say('The fix is a **flyback diode** across the coil. A **diode** is a one-way valve for current: it lets current through in one direction and blocks the other. (The semiconductor chapter explains how it does that.)'),
    art(`
      +12 V ──┬───────┐
              │       │
            coil    diode  (points up: blocks the 12 V while the switch is on)
              │       │
       sw ────┴───────┘
              │
           switch
              │
             GND`, 'a flyback diode across a relay coil'),
    say('While the switch is on, the diode faces the wrong way and does nothing. When the switch opens, the coil\'s current keeps going round through the diode and dies away gently. The spike is clamped to about one diode drop above the supply.'),
    mc('Which way must the flyback diode point?', ['So it blocks the supply while the switch is on, and carries the coil\'s current when it opens', 'So it carries the supply current while the switch is on', 'Either way, a diode works both ways'], 0, 'Pointed the wrong way it would short the supply through the switch. Pointed the right way it only conducts when the coil drives sw above the supply.'),
    say('Next, in the Circuit Lab, you make the kickback spike yourself and then tame it.', 'excited'),
  ],
  recap: ['Capacitor: q = Cv, i = C dv/dt; its voltage cannot jump; open at DC.', 'Inductor: v = L di/dt; its current cannot jump; a wire at DC.', 'Stored energy: ½CV² and ½LI².', 'Switching off an inductor fast makes a kickback spike; a flyback diode gives the current a path and clamps it.'],
};

// ------------------------------------------------------------------ S8b: Fourier series

export const fourier: Lesson = {
  id: 'fourier',
  title: 'Fourier Series',
  concept: 'orthogonality, the coefficient integrals derived, the square wave',
  xp: 90,
  steps: [
    say('Fourier\'s claim: **any repeating signal is a sum of sine and cosine waves**. If it repeats every T seconds, the waves are at 1/T, 2/T, 3/T and so on: the fundamental and its **harmonics**.'),
    art(`
   f(t) = a₀ + Σ [ aₙ·cos(nωt) + bₙ·sin(nωt) ],   n = 1, 2, 3, ...
   ω = 2π/T`, 'the Fourier series'),
    say('The question is how to find each coefficient aₙ and bₙ. The answer is an integral, and here is why it works.'),
    say('**Orthogonality.** Over one period, the integral of sin(nωt)·sin(mωt) is **0 when n ≠ m**, and **T/2 when n = m**. The same holds for cos·cos. And sin·cos always integrates to 0.'),
    art(`
   Proof for sin·sin. Use  sin A·sin B = ½[cos(A - B) - cos(A + B)].

   n ≠ m:  ∫ over T of ½cos((n-m)ωt) - ½cos((n+m)ωt) dt
           both are cosines that fit whole cycles into T, so each integrates to 0.
           Total: 0.

   n = m:  ½cos(0) - ½cos(2nωt) = ½ - ½cos(2nωt)
           ∫ over T = T/2 - 0 = T/2.`, 'proof of orthogonality'),
    ask('What is ∫ over one period of sin(3ωt)·sin(5ωt) dt?', num(0), 'Different harmonics are orthogonal: n = 3 and m = 5 differ, so the integral is 0.', 'n ≠ m.'),
    ask('∫ over one period of sin²(2ωt) dt is how many times T?', qty(0.5, '', 0.01, '0.5'), 'n = m = 2, so the integral is T/2: half of T.', 'n = m gives T/2.'),
    say('**The derivation.** Multiply both sides of the series by sin(mωt) and integrate over one period. By orthogonality, every term on the right dies except one: bₘ·T/2.'),
    art(`
   ∫ f(t)·sin(mωt) dt = a₀·0 + Σ aₙ·0 + Σ bₙ·(0 if n ≠ m, T/2 if n = m)
                      = bₘ·T/2

   so:   bₘ = (2/T) ∫ over T of f(t)·sin(mωt) dt
   and, multiplying by cos(mωt) instead:
         aₘ = (2/T) ∫ over T of f(t)·cos(mωt) dt
   and integrating f itself:
         a₀ = (1/T) ∫ over T of f(t) dt     (the average)`, 'the coefficient integrals, derived'),
    say('Each coefficient asks: how much does f look like this one wave? The integral measures the match, and orthogonality keeps every other wave out of the answer.'),
    say('**Worked example: a square wave** of height ±1: +1 for the first half period, -1 for the second.'),
    art(`
   a₀ = average = 0.   aₙ = 0 (the wave is odd: it has no cosine part).

   bₙ = (2/T) [ ∫ from 0 to T/2 of sin(nωt) dt  -  ∫ from T/2 to T of sin(nωt) dt ]

   ∫ from 0 to T/2 of sin(nωt) dt = (1 - cos nπ) / (nω)
   ∫ from T/2 to T of sin(nωt) dt = (cos nπ - 1) / (nω)

   bₙ = (2/T) × 2(1 - cos nπ)/(nω) = 2(1 - cos nπ)/(nπ)      (ωT = 2π)

   n odd:  cos nπ = -1  →  bₙ = 4/(nπ)
   n even: cos nπ = +1  →  bₙ = 0`, 'worked example: the square wave'),
    ask('For that ±1 square wave, what is b₁, the size of the fundamental? (2 decimal places)', qty(4 / Math.PI, '', 0.01, '1.27'), 'b₁ = 4/(1·π) = 1.27. The fundamental is a bit taller than the square wave itself.', 'bₙ = 4/(nπ) for odd n.'),
    gen((r) => {
      const A = pick(r, [1, 2, 5]), n = pick(r, [3, 5, 7]);
      const b = (4 * A) / (n * Math.PI);
      return walk(
        ask(`A square wave swings ±${A} V. What is the amplitude of its harmonic n = ${n}, in V?`, qty(b, 'V', 0.02, String(r3(b))), `bₙ = 4A/(nπ) = 4 × ${A}/(${n}π) = ${r3(b)} V.`, 'Scale 4/(nπ) by the height A.'),
        'square-wave harmonics', 'A square wave of height ±A has only odd harmonics, with amplitude 4A/(nπ).',
        choice(`Is n = ${n} odd or even?`, 'Odd, so this harmonic is there', ['Even, so it is zero']),
        calc('Amplitude:', `4 × ${A} / (${n} × π)`, b, 'V'),
      );
    }),
    mc('Which harmonics does a square wave contain?', ['Only the odd ones: 1, 3, 5, ...', 'Only the even ones', 'All of them equally'], 0, 'bₙ = 0 for even n, and 4/(nπ) for odd n.'),
    ask('How big is a square wave\'s third harmonic compared with its fundamental? (as a fraction)', qty(1 / 3, '', 0.02, '0.333'), 'b₃/b₁ = (4/3π)/(4/π) = 1/3.', 'bₙ falls as 1/n.'),
    say('This is why a clock with fast edges is noisy: its harmonics reach far up in frequency, and the faster the edges, the higher they reach before dying away. They radiate. The signals chapter later picks this up as bandwidth and EMI.', 'proud'),
  ],
  recap: ['Any periodic f(t) = a₀ + Σ aₙ cos(nωt) + bₙ sin(nωt).', 'Orthogonality: ∫ sin(nωt) sin(mωt) dt over T is 0 if n ≠ m, T/2 if n = m.', 'aₙ, bₙ = (2/T) ∫ f·cos, f·sin; a₀ = average.', 'Square wave ±A: odd harmonics only, 4A/(nπ).'],
};

// ------------------------------------------------------------------ S9: fields

const K = 8.99e9;
const EPS0 = 8.854e-12;

export const fields: Lesson = {
  id: 'fields',
  title: 'Charge, Field and Potential',
  concept: "Coulomb's law, the electric field, potential derived by integration",
  xp: 80,
  steps: [
    say('Capacitors store energy in an **electric field**, and a transistor gate is a capacitor. To understand it from the ground up, start with two charges.'),
    say("**Coulomb's law**: two point charges q₁ and q₂, a distance r apart, push or pull with force F = k·q₁·q₂ / r², where k = 8.99×10⁹ N·m²/C². Like charges repel; opposite charges attract."),
    art(`
   Two 1 µC charges, 10 cm apart:
   F = 8.99×10⁹ × (1×10⁻⁶)² / (0.1)²
     = 8.99×10⁹ × 10⁻¹² / 0.01
     = 0.899 N   (about the weight of a small apple)`, 'worked example'),
    gen((r) => {
      const q1 = pick(r, [1, 2, 5]), q2 = pick(r, [1, 3]), cm = pick(r, [5, 10, 20]);
      const F = (K * q1 * 1e-6 * q2 * 1e-6) / (cm / 100) ** 2;
      return walk(
        ask(`Charges of ${q1} µC and ${q2} µC sit ${cm} cm apart. What force acts between them, in N?`, qty(F, 'N', 0.02, String(r3(F))), `F = 8.99×10⁹ × ${q1}×10⁻⁶ × ${q2}×10⁻⁶ / ${cm / 100}² = ${r3(F)} N.`, 'Convert to coulombs and metres first.'),
        "Coulomb's law", 'Put everything in SI units (coulombs, metres), multiply the charges by k, and divide by the distance squared.',
        calc('The product q₁·q₂, in C²:', `${q1}e-6 × ${q2}e-6`, q1 * q2 * 1e-12, ''),
        calc('The distance squared, in m²:', `${cm / 100}²`, (cm / 100) ** 2, ''),
        calc('F:', `8.99e9 × ${q1 * q2}e-12 / ${(cm / 100) ** 2}`, F, 'N'),
      );
    }),
    mc('You double the distance between two charges. What happens to the force?', ['It drops to a quarter', 'It halves', 'It stays the same'], 0, 'F goes as 1/r², so doubling r divides F by 2² = 4.'),
    say('The **electric field** E is the force per coulomb that a small test charge would feel: **E = F/q**. Around a point charge, E = k·q / r², pointing away from a positive charge. Its unit is N/C, which is the same as **V/m**.'),
    ask('What is the field 1 m from a 1 nC charge, in V/m?', qty(8.99, '', 0.02, '8.99'), 'E = kq/r² = 8.99×10⁹ × 10⁻⁹ / 1² = 8.99 V/m.', 'E = k·q / r².'),
    say('The **potential** V at a point is the work per coulomb needed to bring a charge there from very far away. Work is force times distance, added up along the path: an integral.'),
    art(`
   V(r) = -∫ from ∞ to r of E dr'
        = -∫ from ∞ to r of k·q / r'² dr'
        = -[ -k·q / r' ] from ∞ to r
        = k·q / r - 0
   V(r) = k·q / r`, 'deriving the potential of a point charge'),
    gen((r) => {
      const q = pick(r, [1, 2, 4]), d = pick(r, [0.5, 1, 2]);
      const V = (K * q * 1e-9) / d;
      return ask(`What is the potential ${d} m from a ${q} nC charge, in V?`, qty(V, 'V', 0.02, String(r3(V))), `V = kq/r = 8.99×10⁹ × ${q}×10⁻⁹ / ${d} = ${r3(V)} V.`, 'V = k·q / r (one power of r, not two).');
    }),
    say('Going the other way: the field is how fast the potential falls with distance, **E = -dV/dx**. Between two flat plates the field is uniform, so **E = V/d**.'),
    art(`
   A transistor gate: 1 V across a 1 nm oxide.
   E = V/d = 1 / 1×10⁻⁹ = 1×10⁹ V/m = 1000 MV/m
   Silicon dioxide breaks down near 1000 MV/m. That is why gate voltages had to fall as oxides thinned.`, 'worked example'),
    gen((r) => {
      const v = pick(r, [0.8, 1.2, 1.8]), nm = pick(r, [1.5, 2, 3]);
      const e = v / (nm * 1e-9) / 1e6;
      return ask(`${v} V sits across a ${nm} nm oxide. What is the field, in MV/m?`, qty(e, '', 0.02, String(r3(e))), `E = V/d = ${v} / ${nm}×10⁻⁹ = ${r3(e)}×10⁶ V/m = ${r3(e)} MV/m.`, 'E = V / d, then divide by a million.');
    }),
    say('Next: a shortcut that turns symmetry into fields and gives you the capacitor formula by proof.', 'happy'),
  ],
  recap: ["Coulomb: F = k q₁q₂ / r², k = 8.99×10⁹.", 'Field E = F/q; point charge E = kq/r²; units V/m.', 'Potential V = -∫E dr; point charge V = kq/r.', 'Between plates E = V/d.'],
};

export const gauss: Lesson = {
  id: 'gauss',
  title: "Gauss's Law and the Capacitor",
  concept: "flux, Gauss's law, proofs for the sphere, sheet and parallel plates",
  xp: 90,
  steps: [
    say('Coulomb\'s law adds charges up one at a time. When there is symmetry, **Gauss\'s law** is much faster.'),
    say('First, **flux**: how much field passes through a surface. For a uniform field E crossing an area A head-on, the flux is **E × A**. If it only grazes the surface, the flux is zero.'),
    say("**Gauss's law**: the total flux out of any closed surface equals the charge inside divided by ε₀:  **∮ E·dA = Q_inside / ε₀**, with ε₀ = 8.854×10⁻¹² F/m."),
    say('**Proof 1: a point charge.** Draw a sphere of radius r around a charge q. By symmetry, E has the same size everywhere on the sphere and points straight out. So the flux is just E times the sphere\'s area.'),
    art(`
   flux = E × 4πr²          (E is the same everywhere on the sphere)
   Gauss:   E × 4πr² = q / ε₀
   so       E = q / (4π ε₀ r²) = k·q / r²      with k = 1/(4π ε₀)`, "proof 1: Gauss's law gives Coulomb's law back"),
    mc('Why could E come out of the integral on the sphere?', ['By symmetry it has the same size everywhere on the sphere and is perpendicular to it', 'Because E is zero on the sphere', 'Because the sphere has no charge inside'], 0, 'Symmetry makes E the same size at every point and always perpendicular to the surface, so ∮E·dA = E × area.'),
    ask('Check the constant: what is 1/(4π ε₀), to 3 significant figures, in units of 10⁹?', qty(8.99, '', 0.01, '8.99'), '1/(4π × 8.854×10⁻¹²) = 8.99×10⁹. It is the k from Coulomb\'s law.', '4π × 8.854×10⁻¹² ≈ 1.113×10⁻¹⁰.'),
    say('**Proof 2: a flat sheet of charge**, σ coulombs per square metre. Use a short pillbox that pokes through the sheet, with end faces of area A.'),
    art(`
          ↑ E
      ┌───────┐   end face, area A
   ───┼───────┼─── sheet, charge σ per m²
      └───────┘   end face, area A
          ↓ E

   The field is perpendicular to the sheet, so the sides of the box carry no flux.
   flux = E·A (top) + E·A (bottom) = 2EA
   charge inside = σA
   Gauss:  2EA = σA/ε₀   →   E = σ / (2ε₀)`, 'proof 2: a sheet of charge'),
    say('**Proof 3: the parallel-plate capacitor.** One plate holds +σ, the other -σ. Between the plates, the two sheets\' fields point the same way and add. Outside, they point opposite ways and cancel.'),
    art(`
   between:  E = σ/(2ε₀) + σ/(2ε₀) = σ/ε₀        outside: 0
   plates of area A holding charge Q:   σ = Q/A,  so  E = Q / (ε₀ A)
   gap d, uniform field:   V = E·d = Q·d / (ε₀ A)
   capacitance:   C = Q / V = ε₀ A / d
   with an insulator of relative permittivity εr between:   C = ε₀ εr A / d`, 'proof 3: the capacitor formula'),
    gen((r) => {
      const cm2 = pick(r, [1, 2, 4]), mm = pick(r, [0.5, 1, 2]);
      const C = (EPS0 * cm2 * 1e-4) / (mm * 1e-3);
      return walk(
        ask(`Two plates of ${cm2} cm² each sit ${mm} mm apart in air. What is the capacitance, in pF?`, qty(C * 1e12, 'pF', 0.02, String(r3(C * 1e12))), `C = ε₀A/d = 8.854×10⁻¹² × ${cm2}×10⁻⁴ / ${mm}×10⁻³ = ${r3(C * 1e12)} pF.`, 'Convert cm² to m² (×10⁻⁴) and mm to m (×10⁻³).'),
        'parallel-plate capacitance', 'C = ε₀·A/d in SI units.',
        calc('Area, in m²:', `${cm2} × 1e-4`, cm2 * 1e-4, ''),
        calc('Gap, in m:', `${mm} × 1e-3`, mm * 1e-3, ''),
        calc('C, in pF:', `8.854e-12 × ${cm2 * 1e-4} / ${mm * 1e-3} × 1e12`, C * 1e12, 'pF'),
      );
    }),
    say('A transistor gate is exactly this capacitor: the gate is one plate, the channel the other, and a few nanometres of oxide (εr = 3.9 for SiO₂) in between. Engineers quote it per area.'),
    gen((r) => {
      const tox = pick(r, [1.2, 1.5, 2, 3]);
      const c = ((3.9 * EPS0) / (tox * 1e-9)) * 1e3;
      return ask(`A gate oxide of SiO₂ (εr = 3.9) is ${tox} nm thick. What is its capacitance per area, in fF/µm²? (1 F/m² = 1000 fF/µm²)`, qty(c, '', 0.02, String(r3(c))), `C/A = ε₀εr/t = 3.9 × 8.854×10⁻¹² / ${tox}×10⁻⁹ = ${r3(c / 1e3)} F/m² = ${r3(c)} fF/µm².`, 'C/A = ε₀ εr / thickness.');
    }),
    mc('You halve the oxide thickness. What happens to the gate capacitance?', ['It doubles', 'It halves', 'It stays the same'], 0, 'C = ε₀εrA/d, so halving d doubles C. More gate capacitance means more charge in the channel, and a stronger transistor.'),
    say('Field, potential and capacitance, all proved from one law. Next chapter: the semiconductor under that gate.', 'proud'),
  ],
  recap: ["Gauss: ∮E·dA = Q_inside/ε₀.", 'Sphere → E = kq/r² (Coulomb). Sheet → E = σ/2ε₀.', 'Parallel plates: E = σ/ε₀ inside, 0 outside; C = ε₀εrA/d.', 'Thinner gate oxide → more capacitance.'],
};

// ------------------------------------------------------------------ S11: op-amps

export const opamp: Lesson = {
  id: 'opamp',
  title: 'Op-Amps, Summing and the DAC',
  concept: 'the golden rules, inverting and non-inverting gain, the summing amplifier, a binary-weighted DAC',
  xp: 90,
  steps: [
    say('An **op-amp** (operational amplifier) is a block with two inputs, + and -, one output, and an enormous gain: often 100,000 or more. Its output is A × (v₊ - v₋).'),
    say('Huge gain alone is useless: a difference of a few hundred microvolts would slam the output into the rail. But wire the output back to the **- input** (negative feedback) and two **golden rules** hold:'),
    art(`
   1. The inputs draw no current.
   2. The output does whatever it takes to make v₋ = v₊.`, 'the golden rules (with negative feedback)'),
    mc('With negative feedback, what does the op-amp\'s output do?', ['Whatever makes the two inputs equal', 'Always sits at 0 V', 'Swings to the highest rail'], 0, 'The feedback lets the huge gain correct any difference, so v₋ is driven to equal v₊.'),
    say('**The inverting amplifier.** Ground the + input. Rule 2 holds the - input at 0 V too: a **virtual ground**. The input current vin/R1 cannot enter the op-amp (rule 1), so it all flows through Rf.'),
    art(`
           R1          Rf
   vin ──/\\/\\/──●──/\\/\\/──┐
                │         │
                └──(-)    │
                   op-amp ├── vout
           GND ────(+)    │

   current through R1 = vin / R1 = current through Rf = (0 - vout) / Rf
   vout = -(Rf / R1) × vin

   R1 = 1 kΩ, Rf = 10 kΩ, vin = 0.2 V:   vout = -10 × 0.2 = -2 V`, 'worked example'),
    gen((r) => {
      const r1 = pick(r, [1, 2, 5]), g = pick(r, [2, 4, 10]), vin = pick(r, [0.1, 0.2, 0.5]);
      const rf = r1 * g;
      return walk(
        ask(`An inverting amplifier has R1 = ${r1} kΩ and Rf = ${rf} kΩ. The input is ${vin} V. What is vout, in V?`, qty(-g * vin, 'V', 0.02, String(r3(-g * vin))), `vout = -(Rf/R1) × vin = -(${rf}/${r1}) × ${vin} = ${r3(-g * vin)} V.`, 'vout = -(Rf/R1) × vin. Mind the minus sign.'),
        'inverting amplifier', 'The - input is a virtual ground. The same current flows through R1 and Rf.',
        calc('Current in R1, in mA:', `${vin} / ${r1}`, vin / r1, 'mA'),
        calc('The same current makes vout = -I × Rf, in V:', `-${r3(vin / r1)} × ${rf}`, -g * vin, 'V'),
      );
    }),
    say('**The non-inverting amplifier.** Put the signal on the + input. Feed back a fraction of the output with a divider. Rule 2 says that fraction equals vin, so **gain = 1 + Rf/R1**, and the gain is positive.'),
    ask('A non-inverting amplifier has R1 = 1 kΩ and Rf = 9 kΩ. What is its gain?', qty(10, '', 0.01, '10'), 'gain = 1 + Rf/R1 = 1 + 9 = 10.', 'Gain = 1 + Rf/R1.'),
    say('**The summing amplifier.** Give the virtual ground several inputs, each through its own resistor. Their currents add at the - input, and all of them flow through Rf:'),
    art(`
   vout = -Rf × (v1/R1 + v2/R2 + v3/R3 + ...)

   Rf = 10 kΩ, R1 = R2 = 10 kΩ, v1 = 1 V, v2 = 2 V:
   vout = -10k × (1/10k + 2/10k) = -(1 + 2) = -3 V`, 'worked example'),
    gen((r) => {
      const v1 = pick(r, [0.5, 1, 2]), v2 = pick(r, [1, 3]), r1 = pick(r, [10, 20]), r2 = 10, rf = 10;
      const out = -rf * (v1 / r1 + v2 / r2);
      return walk(
        ask(`A summing amplifier has Rf = ${rf} kΩ. Input 1 is ${v1} V through ${r1} kΩ; input 2 is ${v2} V through ${r2} kΩ. What is vout, in V?`, qty(out, 'V', 0.02, String(r3(out))), `vout = -${rf}k × (${v1}/${r1}k + ${v2}/${r2}k) = ${r3(out)} V.`, 'Add the input currents, then multiply by -Rf.'),
        'summing amplifier', 'Each input sends v/R into the virtual ground. The currents add, and all of it flows through Rf.',
        calc('Input 1 current, in mA:', `${v1} / ${r1}`, v1 / r1, 'mA'),
        calc('Input 2 current, in mA:', `${v2} / ${r2}`, v2 / r2, 'mA'),
        calc('vout = -(sum) × Rf, in V:', `-(${r3(v1 / r1)} + ${r3(v2 / r2)}) × ${rf}`, out, 'V'),
      );
    }),
    say('Now make the input resistors **binary-weighted**: R for the top bit, 2R for the next, 4R, then 8R. Each bit\'s source is either 0 V or Vref. The output becomes a voltage proportional to the binary number. That is a **DAC**, a digital-to-analog converter.'),
    art(`
   bit 3 ──  R ──┐
   bit 2 ── 2R ──┤
   bit 1 ── 4R ──┼──(-) op-amp ── vout,  Rf from vout back to (-)
   bit 0 ── 8R ──┘

   vout = -(Rf/R) × Vref × (b3 + b2/2 + b1/4 + b0/8)

   Vref = 1 V, R = Rf = 10 kΩ, code 1010:
   vout = -(1 + 0 + 1/4 + 0) = -1.25 V`, 'a 4-bit DAC from a summing amplifier'),
    gen((r) => {
      const code = between(r, 1, 15);
      const v = -code / 8;
      const b = code.toString(2).padStart(4, '0');
      return walk(
        ask(`The DAC above has Vref = 1 V and R = Rf = 10 kΩ. What is vout for code ${b}, in V?`, qty(v, 'V', 0.01, String(r3(v))), `vout = -(${b.split('').map((x, i) => `${x}/${[1, 2, 4, 8][i]}`).join(' + ')}) = ${r3(v)} V. In general vout = -code/8 V.`, 'Weights are 1, ½, ¼ and ⅛ for bits 3 to 0.'),
        'binary-weighted DAC', 'Each bit that is 1 adds its weight: 1, ½, ¼, ⅛. The output is minus the total, in volts.',
        { t: 'do', q: `Code ${b} as a number from 0 to 15:`, a: num(code) },
        calc('vout = -code / 8:', `-${code} / 8`, v, 'V'),
      );
    }),
    mc('Why do real DACs usually use an R-2R ladder instead of binary weights?', ['Binary weights need a huge spread of precise resistor values', 'Binary-weighted DACs cannot make negative voltages', 'Op-amps cannot sum more than two inputs'], 0, 'A 12-bit binary-weighted DAC needs resistors from R to 2048R, all matched precisely. An R-2R ladder uses only two values.'),
    say('Your turn in the Circuit Lab: first a gain stage, then a 4-bit DAC built from a summing amplifier.', 'excited'),
  ],
  recap: ['Golden rules with negative feedback: no input current; v₋ = v₊.', 'Inverting: vout = -(Rf/R1)·vin. Non-inverting: gain = 1 + Rf/R1.', 'Summing: vout = -Rf·Σ(v/R).', 'Binary-weighted inputs make a DAC: vout ∝ -code.'],
};

export const THEORY_LESSONS: Lesson[] = [electricity, resistance, psc, mesh, deltawye, complex, phasor, deriv, integral, storage, fourier, fields, gauss, opamp];

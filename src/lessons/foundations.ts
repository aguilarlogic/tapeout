// Act I - Foundations: numbers, logic, electricity, transistors.
import { bin, expr, hexa, num, qty } from './answers';
import { app, art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const bits: Lesson = {
  id: 'bits',
  title: 'Switches and Lamps',
  concept: 'a bit is a switch; counting with lamps',
  xp: 50,
  steps: [
    say("Hi {name}. Let's start with the smallest idea in every computer: a **switch**. It is either **on** or **off**. Nothing in between."),
    art(`
   switch UP    ->  lamp ON     =  1
   switch DOWN  ->  lamp OFF    =  0`, 'one switch = one bit'),
    say('A chip is made of a huge number of tiny switches. We write **on** as `1` and **off** as `0`. One switch holding a 0 or a 1 is called a **bit**.'),
    mc('A switch is down. What does its bit say?', ['0', '1'], 0, 'Down means off, and off is 0.'),
    say('One bit can only say two things. To say bigger things, we put **more switches in a row**. Each lamp is worth a number, and every lamp is worth **double** the one to its right.'),
    art(`
   lamp:      [ ]    [ ]    [ ]
   worth:      4      2      1`, 'three lamps, worth 4, 2 and 1'),
    say('To make a number, add up the lamps that are **on**. Watch me make 5:'),
    art(`
   Make 5:     [ON]   [off]   [ON]
                4       2       1
                4   +   0   +   1   =  5

   written down:  1       0       1      ->  101`, 'worked example'),
    say('The 4-lamp is on and the 1-lamp is on. 4 + 1 = 5. We write the lamps left to right as `101`. That is **binary**.'),
    ask('Your turn. The lamps read `011`. Which number is that?', num(3), '011: the 2-lamp and the 1-lamp are on, so 2 + 1 = 3.', 'Only add the lamps that show 1. Skip the 0s.'),
    app('lamps', "Let's practice with real lamps. Click them to make each target number. There is no clock.", 4),
    gen((r) => {
      const v = between(r, 1, 7);
      return ask(`Now backwards. Show **${v}** with three lamps (worth 4, 2, 1). Type the lamps, like 101.`, bin(v, 3), `${v} = ${[4, 2, 1].filter((w) => v & w).join(' + ')}, so the lamps read ${v.toString(2).padStart(3, '0')}.`, 'Start with the biggest lamp, 4. Does it fit in the number? Then try 2, then 1.');
    }),
    mc('You have 3 lamps. How many different patterns can they make (all-off counts)?', ['3', '6', '8', '9'], 2, 'Each lamp is on or off, and every extra lamp doubles the choices: 2 x 2 x 2 = 8. They show the numbers 0 to 7.'),
    ask('Add a fourth lamp, worth 8. What is the biggest number four lamps can show?', num(15), '8 + 4 + 2 + 1 = 15, with every lamp on.', 'Turn every lamp on and add them up.'),
    say('Why do chips use only on and off? A wire is easy to make **high or low**. It is very hard to make it hold "a little bit in between" reliably. Two states means almost no mistakes.'),
    say('You can already read binary. Next you will make switches decide things, which is what a **logic gate** does.', 'proud'),
  ],
  recap: ['A bit is a switch: 1 is on, 0 is off.', 'Each lamp is worth double the one to its right: 1, 2, 4, 8...', 'Add up the lamps that are on to get the number.', 'n lamps make 2^n patterns: 3 lamps show 0 to 7, 4 lamps show 0 to 15.'],
};

export const hex: Lesson = {
  id: 'hex',
  title: 'Bytes and Hex',
  concept: 'bytes, 8-bit numbers, hex',
  xp: 60,
  steps: [
    say('You can count with lamps already, {name}. Real chips use **eight** lamps at a time. Eight bits in a row is called a **byte**, and it is about the size of one letter on your screen.'),
    art(`
  bit:     7    6    5    4    3    2    1    0
  weight: 128   64   32   16    8    4    2    1

  0b1011  =  8 + 0 + 2 + 1  =  11`, 'place values of an 8-bit number'),
    say('Same idea as before: every lamp is worth double the one to its right, there are just more of them.'),
    ask('What is binary `0110` in decimal?', num(6), '0110 = 4 + 2 = 6.', 'Add the weights of the columns with a 1: 8, 4, 2, 1 from the left.'),
    gen((r) => {
      const v = between(r, 9, 31);
      return ask(`Your turn in reverse: write **${v}** in binary.`, bin(v), `${v} = ${[16, 8, 4, 2, 1].filter((w) => v & w).join(' + ')}, so ${v.toString(2)}.`, 'Take out the biggest power of two that fits (16, 8, 4, 2, 1) and repeat with what is left.');
    }),
    say('Eight 1s and 0s are hard to read at a glance. So engineers use a shorter way to write them, called **hexadecimal** (hex for short): one hex digit stands for exactly four bits (a nibble). Digits go 0-9 then A-F for 10-15.'),
    art(`
  1101 0110   (binary)
     D    6   (hex)   ->  0xD6  =  214`),
    app('bitflip', 'Here is a toy. Flip the eight switches to match the number. Some targets are written in hex, so use the nibble trick.', 4),
    gen((r) => {
      const v = between(r, 0x1a, 0xfe);
      return ask(`Convert binary \`${v.toString(2).padStart(8, '0').replace(/(....)(....)/, '$1 $2')}\` to hex.`, hexa(v, 2), `Each nibble maps to one hex digit: ${v.toString(16).toUpperCase().padStart(2, '0')}.`, 'Split it into two groups of four and convert each group on its own.');
    }),
    mc('How many different values can **8 bits** represent?', ['8', '255', '256', '512'], 2, '2^8 = 256 values: 0 through 255. The max value is 255, but there are 256 of them, a classic off-by-one.'),
    ask('How many bits do you need to count from 0 to 1000?', num(10), '2^9 = 512 is too few, 2^10 = 1024 covers it. In Verilog you would write `$clog2(1001)`.', 'Find the smallest power of two that is bigger than 1000.'),
    say('Nice. Now you can read the numbers engineers write every day.', 'proud'),
  ],
  recap: ['Eight bits make a byte.', 'One hex digit = 4 bits; two = one byte.', 'n bits hold 2^n values: 0 to 2^n - 1.', 'Bits needed for N values = ceil(log2 N).'],
};

export const twos: Lesson = {
  id: 'twos',
  title: 'Negative Numbers',
  concept: "two's complement, overflow, sign extension",
  xp: 70,
  steps: [
    say('Hardware has no minus sign. So how does a chip store -5? The answer is a trick called **two\'s complement**, and every CPU uses it.'),
    say('The idea: the top bit is worth a **negative** amount. In 4 bits the weights are -8, 4, 2, 1.'),
    art(`
  weights:  -8   4   2   1
   0111  =        4 + 2 + 1  =  +7   (largest)
   1000  =  -8               =  -8   (smallest)
   1111  =  -8 + 4 + 2 + 1   =  -1`),
    ask('In 4-bit two\'s complement, what is `1110`?', num(-2), '-8 + 4 + 2 = -2.', 'The top bit is worth -8 and the rest are normal.'),
    say('To **negate** a number: invert every bit, then add 1. That is why it is called the two\'s complement.'),
    art(`
   +5  =  0101
  invert: 1010
   + 1 :  1011  =  -8 + 2 + 1  =  -5  ✓`),
    gen((r) => {
      const v = between(r, 2, 7);
      const neg = (16 - v) & 15;
      return ask(`Write **-${v}** in 4-bit two's complement.`, bin(neg, 4), `+${v} = ${v.toString(2).padStart(4, '0')}; invert and add 1 -> ${neg.toString(2).padStart(4, '0')}.`, 'Write the positive value, flip every bit, add 1.');
    }),
    mc('What range fits in an **8-bit signed** number?', ['0 to 255', '-127 to +127', '-128 to +127', '-256 to +255'], 2, 'n bits signed = -2^(n-1) to 2^(n-1) - 1. There is one more negative number than positive because zero takes a slot on the positive side.'),
    say('The beautiful part: an adder does not care. The same circuit that adds unsigned numbers adds signed ones. The only difference is how you **read** the result, and how you detect **overflow**.'),
    mc('In 4-bit signed math, what is `0111 + 0001` (7 + 1)?', ['1000 = +8, no overflow', '1000 = -8, overflow', '0000 with a carry out', '0111, it saturates'], 1, '+8 does not fit in 4-bit signed, so the result wraps to -8. Signed overflow happens when two numbers of the same sign produce a result with the other sign.'),
    say('Last trick: to widen a signed number, copy the top bit into the new bits. That is **sign extension**. Zero-extending a negative number would turn it into a big positive one.'),
    ask('Sign-extend 4-bit `1010` to 8 bits.', bin(0b11111010, 8), '1010 is negative (top bit 1), so the four new bits are all 1: 1111 1010. Both mean -6.', 'Copy the top bit into the four new positions.'),
    say('That is the whole secret of signed arithmetic, {name}. In Verilog, forgetting it is one of the most common bugs you will ever see in code review.', 'wink'),
  ],
  recap: ['Two\'s complement: the MSB has negative weight.', 'Negate = invert all bits, add 1.', 'n-bit signed range: -2^(n-1) .. 2^(n-1)-1.', 'Widen signed values with sign extension, not zero extension.'],
};

export const bool: Lesson = {
  id: 'bool',
  title: 'Gates: Switches That Decide',
  concept: 'AND, OR, NOT, XOR in plain words',
  xp: 60,
  steps: [
    say('A single switch just sits there. A **logic gate** is a tiny part that looks at its input switches and **decides** what its output lamp does. There are only a few kinds, and we will meet them one at a time.'),
    say('First, **AND**. Think of a door that opens only if you have the key **and** you know the code. You need both.'),
    art(`
   key  code | door (AND)
    0    0   |   0
    0    1   |   0
    1    0   |   0
    1    1   |   1      <- only when BOTH are 1`, 'AND: the output is 1 only if both inputs are 1'),
    mc('An AND gate gets inputs 1 and 0. What does it output?', ['0', '1'], 0, 'AND needs both inputs to be 1. One of them is 0, so the output is 0.'),
    say('Second, **OR**. Think of a hallway light with two switches. The light turns on if **either** switch is on, or both.'),
    art(`
   A B | OR
   0 0 |  0
   0 1 |  1
   1 0 |  1
   1 1 |  1      <- 1 if AT LEAST ONE input is 1`, 'OR: the output is 1 if either input is 1'),
    mc('An OR gate gets inputs 0 and 1. What does it output?', ['0', '1'], 1, 'OR only needs one input to be 1. B is 1, so the output is 1.'),
    say('Third, **NOT**. It has one input and it simply **flips** it. 1 becomes 0, and 0 becomes 1.'),
    mc('A NOT gate gets a 0. What does it output?', ['0', '1'], 1, 'NOT flips its input, so 0 becomes 1.'),
    say('Last, **XOR**, said "ex-or". It lights up when the two inputs are **different**.'),
    art(`
   A B | XOR
   0 0 |  0     same -> 0
   0 1 |  1     different -> 1
   1 0 |  1     different -> 1
   1 1 |  0     same -> 0`, 'XOR: 1 when the inputs differ'),
    mc('Which gate outputs 1 only when its two inputs **differ**?', ['AND', 'OR', 'XOR', 'NOT'], 2, 'XOR is the "difference detector". You will use it to build an adder in a moment.'),
    gen((r) => {
      const g = pick(r, [
        { n: 'AND', f: (x: number, y: number) => x & y },
        { n: 'OR', f: (x: number, y: number) => x | y },
        { n: 'XOR', f: (x: number, y: number) => x ^ y },
      ]);
      const x = between(r, 0, 1), y = between(r, 0, 1);
      return ask(`A ${g.n} gate gets A = ${x} and B = ${y}. What is its output?`, num(g.f(x, y)), `${g.n}(${x}, ${y}) = ${g.f(x, y)}.`, 'Say the rule out loud: AND wants both, OR wants either, XOR wants different.');
    }),
    say('Four gates, and you can already read any of them. Now you get to wire them up yourself.', 'excited'),
  ],
  recap: ['AND: 1 only if both inputs are 1.', 'OR: 1 if at least one input is 1.', 'NOT: flips its input.', 'XOR: 1 when the two inputs are different.'],
};

export const demorgan: Lesson = {
  id: 'demorgan',
  title: 'NAND, NOR and De Morgan',
  concept: 'NAND, NOR, De Morgan, universal gates',
  xp: 70,
  steps: [
    say('You know AND, OR, NOT and XOR. Two more gates come up all the time: **NAND** is AND with its output flipped, and **NOR** is OR with its output flipped.'),
    art(`
   A B | AND  OR  XOR  NAND  NOR
   0 0 |  0    0   0     1    1
   0 1 |  0    1   1     1    0
   1 0 |  0    1   1     1    0
   1 1 |  1    1   0     0    0`, 'the gates you will use every day'),
    app('truth', 'Fill in some truth tables for me. Click an output cell to flip it.', 3),
    say('Now the most useful law in digital design, **De Morgan\'s**. To push an inversion through a gate, flip the gate: AND becomes OR and vice versa.'),
    art(`
   !(A & B)  ==  !A | !B       NAND = OR of inverted inputs
   !(A | B)  ==  !A & !B       NOR  = AND of inverted inputs`),
    ask('Simplify `!(!A | !B)` to the fewest operators.', expr('A&B', ['a', 'b'], (v) => v.a && v.b), 'De Morgan: !(!A | !B) = !!A & !!B = A & B.', 'Apply De Morgan, then the double inversions cancel.'),
    say('You can type boolean expressions with `&`, `|`, `^`, `!` (or `+` for OR, `A\'` for NOT). I check them with a truth table, so any correct form works.'),
    gen((r) => {
      const f = pick(r, [
        { q: 'Write an expression that is 1 when **exactly one** of A and B is 1.', c: 'A^B', fn: (v: Record<string, boolean>) => v.a !== v.b, why: 'That is XOR: A^B, or (A&!B)|(!A&B).' },
        { q: 'Write an expression that is 1 when A and B are **equal**.', c: '!(A^B)', fn: (v: Record<string, boolean>) => v.a === v.b, why: 'Equality is XNOR: !(A^B), or (A&B)|(!A&!B).' },
        { q: 'Write an expression that is 1 when **at least two** of A, B, C are 1 (a majority vote).', c: 'A&B | A&C | B&C', fn: (v: Record<string, boolean>) => +v.a + +v.b + +v.c >= 2, why: 'Majority = AB + AC + BC. It is also the carry-out of a full adder, you will build one soon.' },
      ]);
      return ask(f.q, expr(f.c, ['a', 'b', 'c'], f.fn), f.why, 'Think about which rows of the truth table must be 1, then OR together a term for each.');
    }),
    mc('Why do chip designers love **NAND**?', ['It switches faster than any other gate', 'Any logic function can be built from it', 'It needs fewer transistors than NOT', 'Synthesis tools can only map to NAND gates'], 1, 'Any logic function can be built from NANDs alone: NAND (and NOR) are universal. In CMOS a NAND is also cheap: 4 transistors. Next, you will prove it by building other gates from NANDs.'),
    say('Enough theory. Time to build.', 'excited'),
  ],
  recap: ['NAND = AND flipped, NOR = OR flipped.', 'NAND and NOR are universal gates.', 'De Morgan: !(A&B) = !A|!B and !(A|B) = !A&!B.', 'Any truth table can be written as an OR of AND terms (sum of products).'],
};

export const ohm: Lesson = {
  id: 'ohm',
  title: 'Voltage, Current, Resistance',
  concept: "Ohm's law, dividers, power",
  xp: 70,
  steps: [
    say('Chips are digital on the inside, but they live in an analog world. Before we go further, you need three quantities in your bones.'),
    art(`
   V  voltage     "pressure"    volts   (V)
   I  current     "flow"        amps    (A)
   R  resistance  "narrowness"  ohms    (Ω)

          V = I × R          P = V × I`, "Ohm's law and power"),
    gen((r) => {
      const R = pick(r, [100, 220, 330, 470, 1000]);
      const V = pick(r, [3.3, 5, 12]);
      const I = V / R;
      return ask(`A ${R} Ω resistor sits across a ${V} V supply. How much current flows, in **mA**?`, qty(I * 1000, 'mA'), `I = V/R = ${V}/${R} = ${(I * 1000).toPrecision(3)} mA.`, 'I = V / R, then multiply amps by 1000 to get mA.');
    }),
    say('Resistors in **series** add: R = R1 + R2. In **parallel** they combine as R1·R2/(R1+R2). Parallel is always smaller than the smallest one.'),
    ask('What is 1 kΩ in parallel with 1 kΩ?', qty(500, 'Ω'), 'Two equal resistors in parallel give half: 1k·1k/(2k) = 500 Ω.', 'Two equal resistors in parallel = half of one.'),
    say('Now the most useful circuit in electronics: the **voltage divider**. Two resistors in series split the voltage in proportion to their size.'),
    art(`
   Vin ──┬──
         R1
         ├─── Vout = Vin × R2 / (R1 + R2)
         R2
   GND ──┴──`),
    gen((r) => {
      const [R1, R2] = pick(r, [[10000, 10000], [10000, 20000], [2000, 3000], [4700, 10000], [1000, 2200]] as const);
      const Vin = pick(r, [5, 12, 3.3]);
      const Vout = (Vin * R2) / (R1 + R2);
      return ask(`Vin = ${Vin} V, R1 = ${R1 / 1000} kΩ, R2 = ${R2 / 1000} kΩ. What is Vout?`, qty(Vout, 'V', 0.02), `Vout = ${Vin} × ${R2 / 1000}/(${R1 / 1000}+${R2 / 1000}) = ${Vout.toPrecision(3)} V.`, 'Vout = Vin × R2 / (R1 + R2).');
    }),
    app('divider', 'Your turn to design one. Pick standard resistor values to hit each target voltage. Real parts only come in certain values (the E12 series), so you will have to get creative.', 3),
    say('Last: power. Every milliwatt in a chip turns into heat. P = V × I, or with Ohm\'s law, P = V²/R = I²R.'),
    ask('A chip draws 2 A from a 0.9 V core supply. How many watts is that?', qty(1.8, 'W'), 'P = V × I = 0.9 × 2 = 1.8 W. Modern GPUs draw hundreds of amps at under 1 V, which is why their power delivery is so hard.', 'P = V × I'),
    say('Good. You will use V = IR for the rest of your career, {name}. Even STA engineers do, for IR drop.', 'happy'),
  ],
  recap: ['V = I × R; P = V × I.', 'Series resistors add; parallel ones combine to less than the smallest.', 'Divider: Vout = Vin × R2/(R1+R2).', 'Real resistors come in standard series (E12, E24, E96).'],
};

export const rc: Lesson = {
  id: 'rc',
  title: 'Capacitors and Time',
  concept: 'RC time constant, filters, decoupling',
  xp: 70,
  steps: [
    say('Resistors decide how much current flows. **Capacitors** decide how fast things happen. And in a chip, speed is everything.'),
    say('A capacitor stores charge, like a small bucket. Charging it through a resistor takes time, and that time is set by the product **τ = R × C**, the time constant.'),
    art(`
  V ▲                          after 1τ : 63%
    │           ___________    after 3τ : 95%
    │       _.-'               after 5τ : ~99% ("done")
    │    .-'
    │  /
    │ /
    └──────────────────────► t
      τ   2τ  3τ  4τ  5τ`, 'an RC circuit charging after a step'),
    gen((r) => {
      const R = pick(r, [1000, 2200, 4700, 10000]);
      const C = pick(r, [1e-9, 10e-9, 100e-9]);
      const tau = R * C * 1e6;
      return ask(`R = ${R / 1000} kΩ, C = ${C * 1e9} nF. What is τ in **µs**?`, qty(tau, 'us'), `τ = RC = ${R} × ${C * 1e9}e-9 = ${tau.toPrecision(3)} µs.`, 'Multiply R in ohms by C in farads to get seconds, then convert to µs.');
    }),
    say('Why does a chip designer care? Every wire in a chip has resistance, and every gate input is a tiny capacitor. **Every signal is an RC circuit.** That delay is what timing analysis measures.'),
    mc('A gate drives a long wire to 10 inputs. How do you make it switch **faster**?', ['Use a smaller driver, it switches faster', 'Use a stronger, lower-resistance driver', 'Add a capacitor at the far end', 'Lower the clock frequency'], 1, 'Delay ≈ R_driver × C_load. A bigger driver (lower R) or less capacitance (shorter wire, fewer loads) both help. You will do exactly this in the timing lab.'),
    say('An RC also makes a **low-pass filter**: slow signals get through, fast ones are smoothed away. The corner frequency is f = 1 / (2πRC).'),
    gen((r) => {
      const R = pick(r, [1000, 1600, 10000]);
      const C = pick(r, [100e-9, 10e-9]);
      const f = 1 / (2 * Math.PI * R * C);
      return ask(`What is the cutoff frequency of R = ${R / 1000} kΩ, C = ${C * 1e9} nF, in **Hz**?`, qty(f, 'Hz', 0.03), `f = 1/(2π × ${R} × ${C * 1e9}e-9) ≈ ${f.toPrecision(3)} Hz.`, 'f = 1 / (2πRC). You can answer with a prefix, like 1.6k.');
    }),
    app('rcscope', 'I will open the scope. Tune R and C until the waveform matches what I ask for.', 3),
    say('One more thing: when millions of gates switch at once, they gulp current from the supply in nanoseconds. The wires to the power supply are too slow (inductance!), so we park **decoupling capacitors** right next to the chip as local charge reservoirs.'),
    mc('Where should a decoupling capacitor go?', ['Anywhere on the same power net', 'Right next to the chip\'s power pin', 'Next to the board\'s power connector', 'Between the regulator and the connector'], 1, 'As close as possible to the pin. The loop between the cap and the pin should be as short as possible: shorter loop, less inductance, faster charge delivery. You will route this yourself in the board lab.'),
  ],
  recap: ['τ = RC; ~63% after 1τ, ~99% after 5τ.', 'Gate delay ≈ R_driver × C_load: every wire is an RC.', 'Low-pass corner: f = 1/(2πRC).', 'Decoupling caps are local charge reservoirs: keep them close.'],
};

export const mos: Lesson = {
  id: 'mos',
  title: 'The Transistor is a Switch',
  concept: 'NMOS, PMOS, CMOS logic',
  xp: 80,
  steps: [
    say('Here is the secret nobody tells you in the first week: a gate like NAND is not a magic box. It is **four switches**. The switches are MOSFETs, transistors, and a modern chip has tens of billions of them.'),
    art(`
      NMOS                    PMOS
       drain                   source (to VDD)
        │                       │
  gate ─┤  ON when gate = 1   ○─┤  ON when gate = 0
        │                       │
       source (to GND)         drain`),
    say('An **NMOS** conducts when its gate is high and is good at pulling a node **down** to 0. A **PMOS** conducts when its gate is low and is good at pulling **up** to 1.'),
    mc('A PMOS transistor has its gate at 0 V. Is it on or off?', ['On', 'Off'], 0, 'PMOS turns on with a low gate (the bubble on its symbol is the hint). NMOS is the opposite.'),
    say('**CMOS** = complementary MOS. Every gate has a pull-up network of PMOS to VDD and a pull-down network of NMOS to GND. For any input, exactly one of them conducts.'),
    art(`
        VDD
         │
      ○─┤ PMOS      A=0: PMOS on, NMOS off -> Y = 1
   A ─┤  ├──── Y     A=1: PMOS off, NMOS on -> Y = 0
      └─┤ NMOS
         │
        GND          the CMOS inverter`),
    mc('Why does a CMOS gate burn almost no power when it is **not switching**?', ['The transistors are too small to conduct', 'There is no DC path from VDD to GND', 'The clock is gated off when idle', 'Capacitors hold the output for free'], 1, 'In steady state one network is always off, so no DC current flows. Power is mostly spent charging capacitances when things switch, which is why P ≈ αCV²f.'),
    say('The rules for building a gate: in the pull-down, NMOS in **series** make AND, in **parallel** make OR. The pull-up is the **dual**: swap series and parallel.'),
    art(`
   NAND2:  pull-down = two NMOS in series   (both on -> Y pulled to 0)
           pull-up   = two PMOS in parallel (either on -> Y pulled to 1)`),
    ask('How many transistors are in a CMOS **NAND2**?', num(4), 'Two NMOS in series and two PMOS in parallel: 4 transistors.', 'One NMOS and one PMOS per input.'),
    mc('Why is there no 4-transistor CMOS **AND** gate?', ['There is one, but it is rarely used', 'A single CMOS stage is always inverting', 'PMOS transistors cannot sit in series', 'AND needs a clock to hold its output'], 1, 'NMOS pull down, PMOS pull up, so a single stage can only produce inverting functions (NAND, NOR, AOI...). AND needs a NAND followed by an inverter: 4 + 2 = 6 transistors. That is why standard cell libraries are full of inverting gates.'),
    say('Enough talk. I have a transistor-level lab ready for you, {name}. Let us see if you can build these by hand.', 'excited'),
  ],
  recap: ['NMOS: on with gate=1, pulls down. PMOS: on with gate=0, pulls up.', 'CMOS: complementary pull-up/pull-down; no static current.', 'Series in pull-down = parallel in pull-up (duality).', 'Single CMOS stages are inverting: NAND2 = 4T, AND2 = 6T.'],
};

export const FOUNDATION_LESSONS = [bits, hex, twos, bool, demorgan, ohm, rc, mos];

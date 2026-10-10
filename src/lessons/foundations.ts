// Act I - Foundations: numbers, logic, electricity, transistors.
import { bin, expr, hexa, num, qty } from './answers';
import { app, art, ask, between, gen, Lesson, mc, pick, say } from './types';
import { calc, choice, count, step, walk } from './teach';

export const bits: Lesson = {
  id: 'bits',
  title: 'Ones and Zeros',
  concept: 'binary, bits, bytes, hex',
  xp: 60,
  steps: [
    say("Let's start at the very bottom, {name}. Every chip ever made, from a calculator to a GPU, is billions of wires that are either **high** or **low**."),
    say('We call high `1` and low `0`. One wire holds one **bit**. Line bits up and you can count, just like decimal, except each column is worth **twice** the one to its right instead of ten times.'),
    art(`
  bit:     7    6    5    4    3    2    1    0
  weight: 128   64   32   16    8    4    2    1

  0b1011  =  8 + 0 + 2 + 1  =  11`, 'place values of an 8-bit number'),
    walk(ask('What is binary `0110` in decimal?', num(6), '0110 = 4 + 2 = 6.', 'Add the weights of the columns with a 1: 8, 4, 2, 1 from the left.'), 'reading binary place values', 'Each column of a binary number is worth twice the column to its right: 1, 2, 4, 8 and so on, counting from the right. A 1 switches its weight on, and a 0 leaves it off. The value is the sum of the weights that are on.', choice('In 0110, which column weights are switched on (the 1s)?', '4 and 2', ['8 and 4', '8 and 1', '2 and 1'], 'The 1s sit in the 4 and 2 columns. The 0s, in the 8 and 1 columns, add nothing.'), count('Add the weights that are on:', '4 + 2', 6)),
    gen((r) => {
      const v = between(r, 9, 31);
      return walk(ask(`Your turn in reverse: write **${v}** in binary.`, bin(v), `${v} = ${[16, 8, 4, 2, 1].filter((w) => v & w).join(' + ')}, so ${v.toString(2)}.`, 'Take out the biggest power of two that fits (16, 8, 4, 2, 1) and repeat with what is left.'), 'binary by taking out powers of two', 'Work down the columns 16, 8, 4, 2, 1. A column gets a 1 if its weight still fits in what is left, and then you take that weight away. Otherwise it gets a 0.', ...[16, 8, 4, 2, 1].map((w) => { const rem = v % (2 * w), fits = rem >= w; return choice(`Does ${w} fit into ${rem}?`, fits ? 'Yes: write a 1' : 'No: write a 0', [fits ? 'No: write a 0' : 'Yes: write a 1'], fits ? `${rem} − ${w} = ${rem - w} is left over.` : `${w} is more than ${rem}, so this column is 0.`); }), step('Read the column bits from 16 down to 1:', bin(v), 'Those are the bits, most significant first.'));
    }),
    say('Binary strings get long fast, so engineers write them in **hexadecimal**: one hex digit is exactly four bits (a nibble). Digits go 0-9 then A-F for 10-15.'),
    art(`
  1101 0110   (binary)
     D    6   (hex)   ->  0xD6  =  214`),
    app('bitflip', "Let me pull up a little toy I made. Flip the switches to match the number. Get quick at this and every hex dump you ever read gets easier.", 5),
    gen((r) => {
      const v = between(r, 0x1a, 0xfe);
      return walk(ask(`Convert binary \`${v.toString(2).padStart(8, '0').replace(/(....)(....)/, '$1 $2')}\` to hex.`, hexa(v, 2), `Each nibble maps to one hex digit: ${v.toString(16).toUpperCase().padStart(2, '0')}.`, 'Split it into two groups of four and convert each group on its own.'), 'binary to hex, one nibble at a time', 'One hex digit stands for exactly four bits, a nibble, because 16 different values need four bits (2 to the power 4). Split the byte into two nibbles and convert each on its own: 0 to 9 stay as they are, and 10 to 15 become A to F.', choice('How many bits does one hex digit stand for?', 'Four', ['Two', 'Eight', 'Sixteen'], '16 values need four bits: 2^4 = 16.'), count('The left nibble, in decimal:', (v >> 4).toString(2).padStart(4, '0'), v >> 4), count('The right nibble, in decimal:', (v & 15).toString(2).padStart(4, '0'), v & 15), step('Write the left digit (A to F for 10 to 15):', hexa(v >> 4, 1), `${v >> 4} is ${(v >> 4).toString(16).toUpperCase()} in hex.`), step('Write the right digit:', hexa(v & 15, 1), `${v & 15} is ${(v & 15).toString(16).toUpperCase()} in hex.`), step('Put the two digits together:', hexa(v, 2), 'Two hex digits make one byte.'));
    }),
    mc('How many different values can **8 bits** represent?', ['8', '255', '256', '512'], 2, '2^8 = 256 values: 0 through 255. The max value is 255, but there are 256 of them, a classic off-by-one.'),
    walk(ask('How many bits do you need to count from 0 to 1000?', num(10), '2^9 = 512 is too few, 2^10 = 1024 covers it. In Verilog you would write `$clog2(1001)`.', 'Find the smallest power of two that is bigger than 1000.'), 'bits needed for N values', 'n bits make 2^n different patterns, so they can count from 0 up to 2^n − 1. To count N different values you need the smallest n with 2^n at least N. Counting from 0 to 1000 is 1001 values.', count('Patterns with 9 bits:', '2^9', 512), choice('Is that enough for 1001 values?', 'No: 512 is too few', ['Yes: 512 is enough'], '512 is less than 1001, so you need one more bit.'), count('Patterns with 10 bits:', '2^10', 1024), count('Bits needed, rounding up:', 'ceil(log2(1001))', 10)),
    say('One more number format, because every GPU, DSP and Python script uses it: **floating point**, which is scientific notation in binary. A 32-bit float (binary32) has **1 sign bit, 8 exponent bits and 23 fraction bits**, and the exponent is stored with a **bias** of 127.'),
    art(`
  binary32:   s | eeeeeeee | fffffffffffffffffffffff
              1       8               23

  e = 1..254   normal:    (-1)^s × 1.f × 2^(e - 127)     the leading 1 is implied
  e = 0        f = 0: zero (+0 and -0).   f ≠ 0: SUBNORMAL, 0.f × 2^-126 (no implied 1)
  e = 255      f = 0: infinity.           f ≠ 0: NaN (not a number)`, 'the special exponent fields are what make 0, ∞ and NaN possible'),
    gen((r) => {
      const s = r() < 0.3 ? 1 : 0, e = between(r, 124, 131), m = between(r, 1, 7);
      const v = (s ? -1 : 1) * (1 + m / 8) * 2 ** (e - 127);
      const h = (((s << 31) | (e << 23) | (m << 20)) >>> 0).toString(16).toUpperCase().padStart(8, '0');
      return walk(ask(`Decode the binary32 pattern \`0x${h}\`. What number is it? (decimal)`, qty(v, '', 0.001, String(v)), `Sign ${s}, exponent field ${e} (${e} - 127 = ${e - 127}), fraction ${m}/8: ${s ? '-' : ''}(1 + ${m}/8) × 2^${e - 127} = ${v}.`, 'Split it into 1, 8 and 23 bits. Subtract the bias from the exponent field and put the implied 1 in front of the fraction.'), 'decoding a binary32 float', 'A 32-bit float is (−1)^sign × (1 + fraction) × 2^(exponent − 127). The sign bit gives the sign, the exponent field minus the bias 127 gives the power of two, and the fraction bits add the digits after the implied leading 1. Here the top three fraction bits make m/8.', choice(`The sign bit is ${s}. Is the number positive or negative?`, s ? 'Negative' : 'Positive', [s ? 'Positive' : 'Negative'], 'A sign bit of 1 means negative, and 0 means positive.'), count('The exponent field minus the bias 127:', `${e} - 127`, e - 127), calc('The mantissa, 1 + fraction, where fraction = m/8:', `1 + ${m} / 8`, 1 + m / 8, ''), calc('The number: sign × mantissa × 2^exponent:', `${s ? '-' : ''}(1 + ${m} / 8) * 2^${e - 127}`, v, '', String(v), 0.001));
    }),
    walk(ask('What is the stored 8-bit exponent field of **1.0** in binary32? (decimal)', num(127), '1.0 = 1.0 × 2^0, so the field is 0 + the bias 127 (0x3F800000 as a whole word).', 'Add the bias to the real exponent.'), 'the stored exponent with bias', 'The stored exponent is the real exponent plus the bias 127, so tiny and huge exponents both fit in an unsigned 8-bit field. For 1.0 = 1.0 × 2^0, the real exponent is 0.', '1.0 = 1.0 × 2⁰, so the real exponent is 0.', count('Add the bias 127:', '0 + 127', 127)),
    say('The limits follow from the layout. Smallest normal number: 2⁻¹²⁶ ≈ 1.18 × 10⁻³⁸. Largest: about 3.4 × 10³⁸. Machine epsilon (the gap above 1.0): 2⁻²³ ≈ 1.19 × 10⁻⁷. **Subnormals** fill the gap between zero and the smallest normal number, so tiny results fade out gradually instead of snapping to zero. Results are rounded to the nearest representable number, and an exact tie goes to the one with an **even** last bit.'),
    mc('A float `x` holds NaN. What does the comparison `x == x` give?', ['True: every value equals itself, NaN included', 'False: NaN compares unequal to everything, itself too', 'A trap: comparing a NaN raises a hardware exception', 'It depends on the bit pattern of the NaN payload'], 1, 'NaN is unordered, so even NaN == NaN is false. That is also the standard way to test for it (`x != x`). Likewise +0 == -0 is true, although their bit patterns differ in the sign bit.'),
    mc('The exponent field is all ones and the fraction is zero. What is the value?', ['NaN, because all ones is the invalid pattern', 'A subnormal number just above zero', 'Infinity, with the sign given by the sign bit', 'The largest finite number of the format'], 2, 'All-ones exponent with a zero fraction is ±∞ (overflow, or 1/0). With a non-zero fraction it is NaN. All-zeros exponent is zero or a subnormal. The largest finite number uses exponent field 254.'),
    say('Nice. You now speak the native language of every chip on Earth.', 'proud'),
  ],
  recap: ['Each bit position is worth twice the one to its right.', 'One hex digit = 4 bits; two = one byte.', 'n bits hold 2^n values: 0 to 2^n - 1.', 'Bits needed for N values = ceil(log2 N).', 'binary32 = 1 sign, 8 exponent (bias 127), 23 fraction bits; the implied 1 is dropped for normals.', 'Exponent 0 = zero or subnormal; exponent all ones = infinity or NaN. NaN ≠ NaN, +0 == -0.'],
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
    walk(ask('In 4-bit two\'s complement, what is `1110`?', num(-2), '-8 + 4 + 2 = -2.', 'The top bit is worth -8 and the rest are normal.'), "reading two's complement", "In two's complement the top bit is worth minus its place value, and the other bits count as normal. A 4-bit number has weights −8, 4, 2 and 1. Add up the weights that are on.", count('The top bit (1) is worth:', '-8', -8), count('The other bits that are on, 4 and 2:', '4 + 2', 6), count('Total:', '-8 + 6', -2)),
    say('To **negate** a number: invert every bit, then add 1. That is why it is called the two\'s complement.'),
    art(`
   +5  =  0101
  invert: 1010
   + 1 :  1011  =  -8 + 2 + 1  =  -5  ✓`),
    gen((r) => {
      const v = between(r, 2, 7);
      const neg = (16 - v) & 15;
      return walk(ask(`Write **-${v}** in 4-bit two's complement.`, bin(neg, 4), `+${v} = ${v.toString(2).padStart(4, '0')}; invert and add 1 -> ${neg.toString(2).padStart(4, '0')}.`, 'Write the positive value, flip every bit, add 1.'), "negating a number in two's complement", "To write −v in two's complement, write +v, flip every bit, then add 1. The top bit then carries the −8 weight, so the pattern reads as −v.", step(`Write +${v} in 4 bits:`, bin(v, 4), 'Four bits: the top bit is the −8 place, so v must be less than 8.'), step('Flip every bit:', bin(15 - v, 4), 'Every 0 becomes 1 and every 1 becomes 0.'), step('Add 1 and write the 4 bits:', bin(neg, 4), `${15 - v} + 1 = ${neg}.`));
    }),
    mc('What range fits in an **8-bit signed** number?', ['0 to 255', '-127 to +127', '-128 to +127', '-256 to +255'], 2, 'n bits signed = -2^(n-1) to 2^(n-1) - 1. There is one more negative number than positive because zero takes a slot on the positive side.'),
    say('The beautiful part: an adder does not care. The same circuit that adds unsigned numbers adds signed ones. The only difference is how you **read** the result, and how you detect **overflow**.'),
    mc('In 4-bit signed math, what is `0111 + 0001` (7 + 1)?', ['1000 = +8, since the sum fits in four bits', '1000 = -8, overflow', '0000, with a carry out of the top bit of the sum', 'The adder refuses, as the result is not representable'], 1, '+8 does not fit in 4-bit signed, so the result wraps to -8. Signed overflow happens when two numbers of the same sign produce a result with the other sign.'),
    say('Last trick: to widen a signed number, copy the top bit into the new bits. That is **sign extension**. Zero-extending a negative number would turn it into a big positive one.'),
    walk(ask('Sign-extend 4-bit `1010` to 8 bits.', bin(0b11111010, 8), '1010 is negative (top bit 1), so the four new bits are all 1: 1111 1010. Both mean -6.', 'Copy the top bit into the four new positions.'), 'sign extension', 'To make a signed number wider, copy its top bit into every new place. The value stays the same. Filling with zeros would turn a negative number into a positive one.', choice('The top bit of 1010 is 1. What sign does that give?', 'Negative', ['Positive'], "In two's complement a 1 in the top bit means negative."), step('Copy that 1 into the four new places and write all 8 bits:', bin(0b11111010, 8), 'The four new bits are 1, so the result is 1111 1010.')),
    say('That is the whole secret of signed arithmetic, {name}. In Verilog, forgetting it is one of the most common bugs you will ever see in code review.', 'wink'),
  ],
  recap: ['Two\'s complement: the MSB has negative weight.', 'Negate = invert all bits, add 1.', 'n-bit signed range: -2^(n-1) .. 2^(n-1)-1.', 'Widen signed values with sign extension, not zero extension.'],
};

export const bool: Lesson = {
  id: 'bool',
  title: 'Thinking in Logic',
  concept: 'gates, truth tables, De Morgan',
  xp: 70,
  steps: [
    say('Bits are the nouns. **Logic gates** are the verbs. There are only a handful, and every digital circuit is built from them.'),
    art(`
   A B | AND  OR  XOR  NAND  NOR       NOT A
   0 0 |  0    0   0     1    1          1
   0 1 |  0    1   1     1    0
   1 0 |  0    1   1     1    0          0
   1 1 |  1    1   0     0    0`, 'the gates you will use every day'),
    say('Read them as sentences. AND: "both". OR: "either". XOR: "different". NAND and NOR are just AND and OR with the output inverted.'),
    mc('Which gate outputs 1 only when its two inputs **differ**?', ['AND', 'OR', 'XOR', 'NOR'], 2, 'XOR is the "difference detector". It is the heart of adders, parity and comparators.'),
    app('truth', 'Here, fill in some truth tables for me. Click an output cell to flip it.', 4),
    say('Now the most useful law in digital design, **De Morgan\'s**. To push an inversion through a gate, flip the gate: AND becomes OR and vice versa.'),
    art(`
   !(A & B)  ==  !A | !B       NAND = OR of inverted inputs
   !(A | B)  ==  !A & !B       NOR  = AND of inverted inputs`),
    walk(ask('Simplify `!(!A | !B)` to the fewest operators.', expr('A&B', ['a', 'b'], (v) => v.a && v.b), 'De Morgan: !(!A | !B) = !!A & !!B = A & B.', 'Apply De Morgan, then the double inversions cancel.'), "De Morgan's law", "De Morgan: NOT (X OR Y) = (NOT X) AND (NOT Y), and NOT (X AND Y) = (NOT X) OR (NOT Y). Push the outer NOT inside by flipping the operator, and each inner NOT then cancels with the NOT in front of it.", choice('Applied to !(X | Y) with X = !A and Y = !B, the outer NOT turns the OR into:', 'AND', ['OR', 'XOR'], 'NOT (X OR Y) = (NOT X) AND (NOT Y).'), step('Now cancel the double NOTs and write the simplest form:', expr('A&B', ['a', 'b'], (v) => v.a && v.b), 'NOT NOT A is A, so !!A & !!B = A & B.')),
    say('You can type boolean expressions with `&`, `|`, `^`, `!` (or `+` for OR, `A\'` for NOT). I check them with a truth table, so any correct form works.'),
    gen((r) => {
      const f = pick(r, [
        { q: 'Write an expression that is 1 when **exactly one** of A and B is 1.', c: 'A^B', fn: (v: Record<string, boolean>) => v.a !== v.b, why: 'That is XOR: A^B, or (A&!B)|(!A&B).', m: 'XOR as a sum of products', idea: 'XOR is 1 when its inputs differ. Write one AND term for each row that gives 1, then OR the terms together. Here the rows are A=1,B=0 and A=0,B=1.', beat: choice('For XOR, which rows give 1?', 'A=1,B=0 and A=0,B=1 (the inputs differ)', ['A=1,B=1 and A=0,B=0 (the inputs match)', 'A=1,B=1 only', 'Every row'], 'XOR is 1 exactly when the inputs differ.') },
        { q: 'Write an expression that is 1 when A and B are **equal**.', c: '!(A^B)', fn: (v: Record<string, boolean>) => v.a === v.b, why: 'Equality is XNOR: !(A^B), or (A&B)|(!A&!B).', m: 'XNOR as a sum of products', idea: 'XNOR is 1 when its inputs match. Write one AND term for each matching row and OR them together. The matching rows are A=0,B=0 and A=1,B=1.', beat: choice('For equality, which rows give 1?', 'A=0,B=0 and A=1,B=1 (the inputs match)', ['A=1,B=0 and A=0,B=1 (the inputs differ)', 'A=1,B=1 only', 'Every row'], 'Equal inputs make the output 1.') },
        { q: 'Write an expression that is 1 when **at least two** of A, B, C are 1 (a majority vote).', c: 'A&B | A&C | B&C', fn: (v: Record<string, boolean>) => +v.a + +v.b + +v.c >= 2, why: 'Majority = AB + AC + BC. It is also the carry-out of a full adder, you will build one soon.', m: 'majority vote as a sum of products', idea: 'A majority vote is 1 when at least two inputs are 1. Each pair of inputs that are both 1 gives one AND term, and the output is the OR of the three pair terms.', beat: choice('Which input combinations make the majority 1?', 'Any two inputs that are both 1', ['All three inputs at once only', 'A alone', 'Only A and B'], 'Any pair is enough, and the third input can be anything.') },
      ]);
      return walk(ask(f.q, expr(f.c, ['a', 'b', 'c'], f.fn), f.why, 'Think about which rows of the truth table must be 1, then OR together a term for each.'), f.m, f.idea, f.beat, step('Write the whole sum of products (any form that matches the table):', expr(f.c, ['a', 'b', 'c'], f.fn), f.why));
    }),
    mc('Why do chip designers love **NAND**?', ['It is the fastest gate in the library, whatever its inputs are', 'Any logic function can be built from NANDs alone', 'It uses no power, since no current flows in either of its states', 'It is required by Verilog, which cannot describe any other gate'], 1, 'NAND (and NOR) are universal. In CMOS a NAND is also cheap: 4 transistors. Next, you will prove it by building other gates from NANDs.'),
    say('Enough theory. Time to build.', 'excited'),
  ],
  recap: ['AND = both, OR = either, XOR = different.', 'NAND and NOR are universal gates.', 'De Morgan: !(A&B) = !A|!B and !(A|B) = !A&!B.', 'Any truth table can be written as an OR of AND terms (sum of products).'],
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
   I  current     "flow"        amperes (A)
   R  resistance  "narrowness"  ohms    (Ω)

          V = I × R          P = V × I`, "Ohm's law and power"),
    gen((r) => {
      const R = pick(r, [100, 220, 330, 470, 1000]);
      const V = pick(r, [3.3, 5, 12]);
      const I = V / R;
      return walk(ask(`A ${R} Ω resistor sits across a ${V} V supply. How much current flows, in **mA**?`, qty(I * 1000, 'mA'), `I = V/R = ${V}/${R} = ${(I * 1000).toPrecision(3)} mA.`, 'I = V / R, then multiply amps by 1000 to get mA.'), "Ohm's law for one resistor", "Ohm's law says V = I × R, so I = V / R. Divide the volts by the ohms to get amps, then multiply by 1000 to get milliamps.", calc('The current in amps, I = V / R:', `${V} / ${R}`, I, 'A'), calc('In mA (× 1000):', `${V} / ${R} * 1000`, I * 1000, 'mA'));
    }),
    say('Resistors in **series** add: R = R1 + R2. In **parallel** they combine as R1·R2/(R1+R2). Parallel is always smaller than the smallest one.'),
    walk(ask('What is 1 kΩ in parallel with 1 kΩ?', qty(500, 'Ω'), 'Two equal resistors in parallel give half: 1k·1k/(2k) = 500 Ω.', 'Two equal resistors in parallel = half of one.'), 'two resistors in parallel', 'In parallel the same voltage falls across both, so their currents add. The total is always smaller than the smallest resistor: R = R1 × R2 / (R1 + R2). For two equal resistors, that is half of one.', choice('Is the parallel total bigger or smaller than the smallest resistor?', 'Smaller', ['Bigger', 'Exactly the sum'], 'More paths for the current means less resistance.'), calc('R1 × R2 / (R1 + R2), in ohms:', '1000 * 1000 / (1000 + 1000)', 500, 'Ω')),
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
      return walk(ask(`Vin = ${Vin} V, R1 = ${R1 / 1000} kΩ, R2 = ${R2 / 1000} kΩ. What is Vout?`, qty(Vout, 'V', 0.02), `Vout = ${Vin} × ${R2 / 1000}/(${R1 / 1000}+${R2 / 1000}) = ${Vout.toPrecision(3)} V.`, 'Vout = Vin × R2 / (R1 + R2).'), 'the voltage divider', 'The two resistors are in series, so the same current flows through both, and each takes a share of the supply in proportion to its resistance. Vout is taken across R2: Vout = Vin × R2 / (R1 + R2).', calc('The total resistance, in ohms:', `${R1} + ${R2}`, R1 + R2, ''), calc('Vout = Vin × R2 / total, in volts:', `${Vin} * ${R2} / ${R1 + R2}`, Vout, 'V', undefined, 0.02));
    }),
    app('divider', 'Your turn to design one. Pick standard resistor values to hit each target voltage. Real parts only come in certain values (the E12 series), so you will have to get creative.', 3),
    say('Last: power. Every milliwatt in a chip turns into heat. P = V × I, or with Ohm\'s law, P = V²/R = I²R.'),
    walk(ask('A chip draws 2 A from a 0.9 V core supply. How many watts is that?', qty(1.8, 'W'), 'P = V × I = 0.9 × 2 = 1.8 W. Modern GPUs draw hundreds of amperes at under 1 V, which is why their power delivery is so hard.', 'P = V × I'), 'power from voltage and current', 'Power is the rate of using energy: P = V × I. Volts times amps gives watts, and every watt a chip draws ends up as heat.', calc('P = V × I, in watts:', '0.9 * 2', 1.8, 'W')),
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
      return walk(ask(`R = ${R / 1000} kΩ, C = ${C * 1e9} nF. What is τ in **µs**?`, qty(tau, 'us'), `τ = RC = ${R} × ${C * 1e9}e-9 = ${tau.toPrecision(3)} µs.`, 'Multiply R in ohms by C in farads to get seconds, then convert to µs.'), 'the RC time constant', 'τ = R × C is the time for the voltage to reach about 63% of its final value. Multiply ohms by farads to get seconds, then convert to microseconds: 1 µs = 10⁻⁶ s.', calc('τ in seconds, R × C:', `${R} * ${C}`, R * C, ''), calc('τ in µs (× 10⁶):', `${R} * ${C} * 1e6`, tau, 'us'));
    }),
    say('Why does a chip designer care? Every wire in a chip has resistance, and every gate input is a tiny capacitor. **Every signal is an RC circuit.** The delay to the 50% point is about 0.69·R·C. That delay is what timing analysis measures.'),
    mc('A gate drives a long wire to 10 inputs. How do you make it switch **faster**?', ['Add more loads, so that the signal is spread over more branches', 'Use a stronger (lower-resistance) driver', 'Make the wire longer, so the signal has more time to settle on it', 'Lower the clock frequency, so the delay becomes smaller in itself'], 1, 'Delay ≈ R_driver × C_load. A bigger driver (lower R) or less capacitance (shorter wire, fewer loads) both help. You will do exactly this in the timing lab.'),
    say('An RC also makes a **low-pass filter**: slow signals get through, fast ones are smoothed away. The corner frequency is f = 1 / (2πRC).'),
    gen((r) => {
      const R = pick(r, [1000, 1600, 10000]);
      const C = pick(r, [100e-9, 10e-9]);
      const f = 1 / (2 * Math.PI * R * C);
      return walk(ask(`What is the cutoff frequency of R = ${R / 1000} kΩ, C = ${C * 1e9} nF, in **Hz**?`, qty(f, 'Hz', 0.03), `f = 1/(2π × ${R} × ${C * 1e9}e-9) ≈ ${f.toPrecision(3)} Hz.`, 'f = 1 / (2πRC). You can answer with a prefix, like 1.6k.'), 'the RC cutoff frequency', 'The corner frequency, f = 1 / (2π × R × C), is where a low-pass filter starts to cut the signal. Find RC in seconds first, then multiply by 2π and take the reciprocal. Prefixes such as k or M are fine.', calc('RC, in seconds:', `${R} * ${C}`, R * C, ''), calc('f = 1 / (2π × RC), in hertz:', `1 / (2 * 3.14159 * ${R} * ${C})`, f, 'Hz'));
    }),
    app('rcscope', 'I will open the scope. Tune R and C until the waveform matches what I ask for.', 3),
    say('One more thing: when millions of gates switch at once, they gulp current from the supply in nanoseconds. The wires to the power supply are too slow (inductance!), so we park **decoupling capacitors** right next to the chip as local charge reservoirs.'),
    mc('Where should a decoupling capacitor go?', ['Anywhere on the board, since a capacitor acts on the whole rail', 'As close as possible to the chip\'s power pin', 'Next to the power connector, where the supply enters the board', 'On a separate board'], 1, 'The loop between the cap and the pin should be as short as possible: shorter loop, less inductance, faster charge delivery. You will route this yourself in the board lab.'),
  ],
  recap: ['τ = RC; ~63% after 1τ, ~99% after 5τ.', 'Gate delay ≈ 0.69·R_driver·C_load to the 50% point: every wire is an RC.', 'Low-pass corner: f = 1/(2πRC).', 'Decoupling caps are local charge reservoirs: keep them close.'],
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
    mc('Why does a CMOS gate burn almost no power when it is **not switching**?', ['The transistors are too small to leak at all when they are off', 'In steady state there is never a conducting path from VDD to GND', 'The clock is off', 'Capacitors store the power'], 1, 'One network is always off, so there is no static current apart from leakage. Power is mostly spent charging capacitances when things switch, which is why P ≈ αCV²f.'),
    say('The rules for building a gate: in the pull-down, NMOS in **series** make AND, in **parallel** make OR. The pull-up is the **dual**: swap series and parallel.'),
    art(`
   NAND2:  pull-down = two NMOS in series   (both on -> Y pulled to 0)
           pull-up   = two PMOS in parallel (either on -> Y pulled to 1)`),
    walk(ask('How many transistors are in a CMOS **NAND2**?', num(4), 'Two NMOS in series and two PMOS in parallel: 4 transistors.', 'One NMOS and one PMOS per input.'), 'counting transistors in a CMOS gate', 'A CMOS gate has one NMOS per input in its pull-down network and one PMOS per input in its pull-up network, so an n-input gate has 2n transistors. A NAND2 has two inputs.', choice('How many NMOS does the pull-down of a NAND2 need?', 'Two, one per input, in series', ['One, for the whole gate', 'Four'], 'Each input needs its own transistor.'), count('PMOS in the pull-up, one per input (in parallel):', '2', 2), count('Total transistors:', '2 + 2', 4)),
    mc('Why is there no 4-transistor CMOS **AND** gate?', ['There is one, but it is rare, and not found in the usual libraries', 'A single stage inverts, so AND is NAND plus an inverter: 6', 'AND needs a clock, to decide when the two inputs are both high', 'PMOS cannot be placed in series, so only an OR can be built'], 1, 'NMOS pull down, PMOS pull up, so a single stage can only produce inverting functions (NAND, NOR, AOI...). AND needs a NAND followed by an inverter. That is why standard cell libraries are full of inverting gates.'),
    say('Enough talk. I have a transistor-level lab ready for you, {name}. Let us see if you can build these by hand.', 'excited'),
  ],
  recap: ['NMOS: on with gate=1, pulls down. PMOS: on with gate=0, pulls up.', 'CMOS: complementary pull-up/pull-down; no static current apart from leakage.', 'Series in pull-down = parallel in pull-up (duality).', 'Single CMOS stages are inverting: NAND2 = 4T, AND2 = 6T.'],
};

export const FOUNDATION_LESSONS = [bits, twos, bool, ohm, rc, mos];

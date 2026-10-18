// Act I - Foundations: numbers, logic, electricity, transistors.
import { bin, expr, hexa, num, qty } from './answers';
import { calc, walk } from './teach';
import { app, art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const bits: Lesson = {
  id: 'bits',
  title: 'Switches and Lamps',
  concept: 'a bit is a switch; counting with lamps',
  xp: 50,
  steps: [
    // 1. One lamp.
    say("Hi {name}. Let's start with the smallest idea in every computer: a **switch**. It is either **on** or **off**. Nothing in between."),
    say('**Why this matters:** every wire inside the chip you are about to build carries one of these on/off values.'),
    art(`
   switch UP    ->  lamp ON   = 1
   switch DOWN  ->  lamp OFF  = 0`, 'one switch = one bit'),
    say('A chip is made of a huge number of tiny switches. We write **on** as `1` and **off** as `0`. One switch holding a 0 or a 1 is called a **bit**.'),
    mc('A switch is down. What does its bit say?', ['0', '1'], 0, 'Down means off, and off is 0.'),
    // 2. Two lamps count 0 to 3.
    say('One lamp can only say two things. Put **two lamps** side by side and they can say four: 0, 1, 2 and 3. The left lamp is worth **2**, the right lamp is worth **1**. Add up the lamps that are on.'),
    art(`
   worth:     2     1
            [off] [off]  = 0
            [off] [ON ]  = 1
            [ON ] [off]  = 2
            [ON ] [ON ]  = 2 + 1 = 3`, 'two lamps count 0 to 3'),
    mc('Two lamps: the left one (worth 2) is on, the right one (worth 1) is off. Which number is that?', ['1', '2', '3'], 1, 'Only the 2-lamp is on, so the number is 2.'),
    ask('Your turn. The lamps read `11`. Which number is that?', num(3), 'Both lamps are on: 2 + 1 = 3.', 'Add the worth of each lamp that shows 1.'),
    gen((r) => {
      const v = between(r, 0, 3);
      return ask(`Now backwards. Show **${v}** with two lamps (worth 2 and 1). Type the lamps, like 10.`, bin(v, 2), `${v} = ${[2, 1].filter((w) => v & w).join(' + ') || '0'}, so the lamps read ${v.toString(2).padStart(2, '0')}.`, 'Is the 2-lamp needed? Then is the 1-lamp needed?');
    }),
    // 3. Four lamps count 0 to 15, next to the decimal columns they know.
    say('Now four lamps. You already count with columns: in the number 1000 the columns are worth 1, 10, 100 and 1000, and **each column is worth ten times the one to its right**. Lamps work the same way, but each lamp is worth **two times** the one to its right.'),
    art(`
   columns you know:
     1000   100   10   1    (x10 each)
   lamps:
        8     4    2   1    (x2 each)`, 'decimal columns next to lamp columns'),
    say('To make a number, add up the lamps that are on. Watch me make 13:'),
    art(`
   Make 13:  [ON ] [ON ] [off] [ON ]
               8     4     2     1
             8 + 4 + 0 + 1 = 13

   written:    1     1     0     1
                  so: 1101`, 'worked example'),
    mc('To make 13 we used the 8-lamp and the 1-lamp. Which other lamp was on?', ['The 2-lamp', 'The 4-lamp'], 1, '8 + 4 + 1 = 13. The 2-lamp stays off.'),
    ask('Your turn. The lamps read `0110`. Which number is that?', num(6), '0110: the 4-lamp and the 2-lamp are on, so 4 + 2 = 6.', 'Only add the lamps that show 1. Skip the 0s.'),
    app('lamps', "Let's practice with real lamps. Click them to make each target number. There is no clock.", 4),
    gen((r) => {
      const v = between(r, 1, 15);
      return ask(`Now backwards. Show **${v}** with four lamps (worth 8, 4, 2, 1). Type the lamps, like 1010.`, bin(v, 4), `${v} = ${[8, 4, 2, 1].filter((w) => v & w).join(' + ')}, so the lamps read ${v.toString(2).padStart(4, '0')}.`, 'Start with the biggest lamp, 8. Does it fit in the number? Then try 4, then 2, then 1.');
    }),
    mc('You have 4 lamps. How many different patterns can they make (all-off counts)?', ['4', '8', '15', '16'], 3, 'Each lamp is on or off, and every extra lamp doubles the choices: 2 x 2 x 2 x 2 = 16. They show the numbers 0 to 15.'),
    say('Why do chips use only on and off? A wire is easy to make **high or low**. It is very hard to make it hold "a little bit in between" reliably. Two states means almost no mistakes.'),
    say('You can already read binary. Next you will make switches decide things, which is what a **logic gate** does.', 'proud'),
  ],
  recap: ['A bit is a switch: 1 is on, 0 is off.', 'Each lamp is worth double the one to its right: 1, 2, 4, 8.', 'Add up the lamps that are on to get the number.', 'Four lamps show 0 to 15.'],
};

export const bitadd: Lesson = {
  id: 'bitadd',
  title: 'Adding with Lamps',
  concept: 'adding binary numbers, carry',
  xp: 60,
  steps: [
    say('You can already add numbers with columns. When a column gets too full, you **carry** to the next one. Lamps work the same way, and the half adder you built does exactly this.'),
    say('**Why this matters:** the adder in your chip is just this, done by gates, millions of times a second.'),
    art(`
   decimal:  9 + 1 = 10
     a column is full at 10:
     write 0, carry 1

   lamps:    1 + 1 = 10
     a column is full at 2:
     write 0, carry 1`, 'a column carries when it is full'),
    say('In decimal a column holds 0 to 9. A lamp column holds only 0 or 1. So **1 + 1 is already full**: write 0 and carry 1. Watch me add 3 + 1:'),
    art(`
   carries:    1  1
   3 =       0  0  1  1
   1 =     + 0  0  0  1
             ---------
   4 =       0  1  0  0

   1st: 1 + 1 = 10, write 0, carry 1
   2nd: 1 + 0 + carry = 10, write 0,
        carry 1
   3rd: 0 + 0 + carry = 1, write 1`, 'worked example: 0011 + 0001'),
    mc('In the right-hand lamp column, 1 + 1 gives what?', ['Write 2, carry nothing', 'Write 0, carry 1', 'Write 1, carry 1'], 1, 'A lamp column is full at 2. So 1 + 1 = 10: write 0 and carry the 1.'),
    ask('Your turn. Add `0010` and `0001`. Type the answer in lamps.', bin(3, 4), '0010 is 2 and 0001 is 1. 2 + 1 = 3, which is 0011. No lamp column got full, so nothing carried.', 'The right column is 0 + 1. The next column is 1 + 0.'),
    gen((r) => {
      const a = between(r, 1, 7), b = between(r, 1, 7);
      return ask(`Add \`${a.toString(2).padStart(4, '0')}\` and \`${b.toString(2).padStart(4, '0')}\`. Type the answer in lamps (4 lamps).`, bin(a + b, 4), `${a} + ${b} = ${a + b}, which is ${(a + b).toString(2).padStart(4, '0')} in lamps. Carry from the right whenever a column is full.`, 'Go one column at a time from the right. Carry a 1 whenever a column adds up to 2.');
    }),
    mc('Which two inputs make the half adder\'s **carry** light come on?', ['Only A on', 'Only B on', 'Both A and B on'], 2, 'The carry is 1 only when 1 + 1 fills the column. That means both inputs are on.'),
    say('You just did what the half adder does: the sum lamp is the column you write, and the carry lamp is the 1 you carry.', 'proud'),
  ],
  recap: ['A lamp column is full at 2, so 1 + 1 = 10.', 'Write the right-hand digit and carry the left-hand digit.', 'Work one column at a time, from the right.', 'The half adder\'s sum and carry are exactly this.'],
};

export const hex: Lesson = {
  id: 'hex',
  title: 'Hex: Nicknames for Four Lamps',
  concept: 'hexadecimal as nicknames for groups of four lamps',
  xp: 70,
  steps: [
    say('Here is a problem. You have to read this row of sixteen lamps out loud to a friend:'),
    art(`
   1 0 1 1 0 0 1 1 1 1 1 0 0 1 0 1`, 'sixteen lamps in a row'),
    ask('How many 1s are in that row? Take your time and count.', num(10), 'There are 10 ones. That was slow and easy to get wrong, and engineers read rows like this all day.', 'Count the 1s one by one. Try touching each one.'),
    say('Long rows of lamps are painful. Here is the fix: **cut the row into groups of four**. Four lamps count 0 to 15, so each group is one number from 0 to 15.'),
    art(`
   1011  0011  1110  0101
    11     3    14     5
   four groups, each a number 0-15`),
    say('Two of those numbers need two digits (11 and 14). That is awkward. We ran out of digits after 9! So for 10 to 15 we borrow letters: **A = 10, B = 11, C = 12, D = 13, E = 14, F = 15**. This is **hexadecimal**, or **hex**: a nickname for each group of four lamps.'),
    art(`
   0000 = 0     1000 = 8
   0001 = 1     1001 = 9
   0010 = 2     1010 = A
   0011 = 3     1011 = B
   0100 = 4     1100 = C
   0101 = 5     1101 = D
   0110 = 6     1110 = E
   0111 = 7     1111 = F`, 'the chart: four lamps and their nickname'),
    say('Watch me: the group `1011` is 8 + 2 + 1 = 11, and 11 is **B**. So `1011` has the nickname B.'),
    mc('Look at the chart. What is the nickname for `1010`?', ['9', 'A', 'B', 'C'], 1, '1010 is 8 + 2 = 10, and 10 is the letter A.'),
    ask('Your turn, with the chart above. What is the hex nickname for `1101`?', hexa(13, 1), '1101 is 8 + 4 + 1 = 13, and 13 is D.', 'Add up the lamps (8, 4, 2, 1), then look the number up: 10 is A, 11 is B, 12 is C, 13 is D.'),
    gen((r) => {
      const v = between(r, 10, 15);
      return ask(`What is the hex nickname for \`${v.toString(2)}\` (4 lamps)?`, hexa(v, 1), `${v.toString(2)} is ${v}, and ${v} is ${v.toString(16).toUpperCase()}.`, 'Add up the lamps, then use the letters: 10 is A, 11 is B, 12 is C, 13 is D, 14 is E, 15 is F.');
    }),
    say('Now the chart goes away. You will use it less each time, and it is okay to peek with a hint.'),
    gen((r) => {
      const v = between(r, 1, 15);
      return ask(`No chart this time. What is the hex nickname for \`${v.toString(2).padStart(4, '0')}\`?`, hexa(v, 1), `${v.toString(2).padStart(4, '0')} is ${v}, so its nickname is ${v.toString(16).toUpperCase()}.`, 'Add up the lamps (8, 4, 2, 1). From 10 up, use A to F.');
    }),
    say('A byte is eight lamps: **two groups of four, so two hex digits**. Each group gets its own nickname. In Verilog you write a hex number as `8\'hD6`, which means "an 8-lamp number, hex, D6".'),
    art(`
   1101 0110   eight lamps (a byte)
     D    6    two hex digits: D6
   Verilog writes it: 8'hD6`, 'a byte is two hex digits'),
    gen((r) => {
      const v = between(r, 0x1a, 0xfe);
      return ask(`Write this byte as two hex digits: \`${v.toString(2).padStart(8, '0').replace(/(....)(....)/, '$1 $2')}\``, hexa(v, 2), `Each group of four is one nickname: ${v.toString(16).toUpperCase().padStart(2, '0')}.`, 'Do the left group of four, then the right group of four, one at a time.');
    }),
    app('bitflip', 'Here is a toy. Flip the eight lamps to match the number. Some targets are written in hex, so use the groups-of-four trick.', 4),
    mc('Why do engineers use hex?', ['It is a short way to write long rows of lamps', 'Chips store numbers in letters', 'It is faster for the chip to add'], 0, 'Hex is only a shorthand for people. The chip still works with 1s and 0s. Four lamps become one hex digit, so long rows become short.'),
    say('Now you can read the numbers engineers write every day.', 'proud'),
  ],
  recap: ['A group of four lamps is a number from 0 to 15.', 'Hex gives each group a one-character nickname: 0-9, then A to F for 10 to 15.', 'A byte (eight lamps) is two hex digits.', 'Hex is only a shorthand for people; the chip uses 1s and 0s.'],
};

export const twos: Lesson = {
  id: 'twos',
  title: 'Negative Numbers',
  concept: "two's complement, overflow, sign extension",
  xp: 70,
  steps: [
    say('So far our lamps only count up from 0. But a chip also needs numbers **below zero**, like a temperature of -5. It has no minus sign, so it uses a trick with the lamps.'),
    say('**Why this matters:** every CPU stores negative numbers this way. You will see it when your chip subtracts.'),
    say('**Step 1: one lamp is worth less than zero.** With 4 lamps the weights were 8, 4, 2, 1. Now we change just the left one to **-8**. The weights are -8, 4, 2, 1.'),
    art(`
  weights:  -8   4   2   1
   0111  =        4 + 2 + 1  =  +7
   1000  =  -8               =  -8
   1111  =  -8 + 4 + 2 + 1   =  -1`, 'the left lamp counts as minus'),
    mc('In 4 lamps with weights -8, 4, 2, 1, what is `1000`?', ['8', '-8'], 1, 'Only the left lamp is on, and it is worth -8.'),
    ask('What is `1110`? Add up the weights that are on: -8 + 4 + 2.', num(-2), '-8 + 4 + 2 = -2.', 'Add the weights where the lamp is on. The left one is -8.'),
    say('**Step 2: flipping the sign.** To turn +5 into -5: flip every lamp, then add 1. Here is one done for you.'),
    art(`
   +5  =  0101
  flip :  1010
   + 1 :  1011  =  -8 + 2 + 1  =  -5  ok`, 'worked example: make -5'),
    mc('To turn +3 (`0011`) into -3, you first flip every lamp. What do you get?', ['1100', '0011', '1101'], 0, 'Flipping 0011 gives 1100. Then you add 1 to get 1101, which is -3.'),
    gen((r) => {
      const v = between(r, 2, 7);
      const neg = (16 - v) & 15;
      return ask(`Write **-${v}** in 4 lamps. Start with +${v}, flip every lamp, then add 1.`, bin(neg, 4), `+${v} = ${v.toString(2).padStart(4, '0')}; flip and add 1 -> ${neg.toString(2).padStart(4, '0')}.`, 'Write the positive value, flip every lamp, add 1.');
    }),
    say('**Step 3: how far can it go?** 4 lamps can show -8 up to +7. There is one more negative number than positive, because zero uses up one slot on the positive side.'),
    mc('What is the biggest number 4 lamps can show this way?', ['+7', '+8', '+15'], 0, '0111 is 4 + 2 + 1 = 7. Adding one more would need a lamp worth 8, and that lamp is now -8.'),
    say('**Step 4: going over the edge.** The adder does not care about signs. It just adds. So if the answer is too big, it **wraps around**, like an odometer. This is called **overflow**.'),
    art(`
    0111   (+7)
  + 0001   (+1)
  ------
    1000   (-8)   <- too big, wrapped round`, 'worked example: overflow'),
    mc('4 lamps: 0111 + 0001 gives 1000. Why is it -8 and not +8?', ['+8 does not fit, so it wrapped around to -8', 'The adder is broken'], 0, 'The biggest number is +7. One more wraps around to the smallest, -8.'),
    say('**Step 5: making a number longer.** To go from 4 lamps to 8, copy the left lamp into all the new lamps. This is called **sign extension**. It keeps the same value.'),
    art(`
   4 lamps:   1010   (-6)
   8 lamps: 1111 1010   (still -6)
            ^^^^ copies of the left lamp`, 'worked example: sign extension'),
    ask('Make `0101` (+5) into 8 lamps by copying the left lamp.', bin(0b00000101, 8), 'The left lamp is 0, so the four new lamps are 0: 0000 0101. Still +5.', 'Copy the left lamp four times in front.'),
    ask('Make `1010` (-6) into 8 lamps by copying the left lamp.', bin(0b11111010, 8), 'The left lamp is 1, so the four new lamps are 1: 1111 1010. Still -6.', 'Copy the left lamp four times in front.'),
    say('That is all of it, {name}. Forgetting sign extension is one of the most common bugs in real chip code.', 'wink'),
  ],
  recap: ['The left lamp is worth minus its weight (-8 for 4 lamps).', 'To flip the sign: flip every lamp, add 1.', 'Too big a number wraps around: overflow.', 'To make a number longer, copy the left lamp: sign extension.'],
};

export const bool: Lesson = {
  id: 'bool',
  title: 'Gates: Switches That Decide',
  concept: 'AND, OR, NOT, XOR in plain words',
  xp: 60,
  steps: [
    say('A single switch just sits there. A **logic gate** is a tiny part that looks at its input switches and **decides** what its output lamp does. There are only a few kinds, and we will meet them one at a time.'),
    say('**Why this matters:** gates are the parts your chip\'s adder is made of.'),
    say('First, **AND**. Think of a door that opens only if you have the key **and** you know the code. You need both.'),
    art(`
   key  code | door (AND)
    0    0   |   0
    0    1   |   0
    1    0   |   0
    1    1   |   1      <- only when BOTH are 1`, 'AND: the output is 1 only if both inputs are 1'),
    mc('An AND gate gets inputs 1 and 0. What does it output?', ['0', '1'], 0, 'AND needs both inputs to be 1. One of them is 0, so the output is 0.'),
    say('Second, **OR**. Think of a doorbell with a button at the front door and one at the back. It rings if **either** button is pressed, or both.'),
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
    mc('Why do chip designers love **NAND**?', ['It switches faster than any other gate', 'Any logic function can be built from it', 'It needs fewer transistors than NOT', 'Synthesis tools can only map to NAND gates'], 1, 'Any logic function can be built from NANDs alone: NAND (and NOR) are universal. In CMOS a NAND is also cheap: 4 transistors. If you like a challenge, you can try building other gates from NANDs.'),
    say('Enough theory. Time to build.', 'excited'),
  ],
  recap: ['NAND = AND flipped, NOR = OR flipped.', 'NAND and NOR are universal gates.', 'De Morgan: !(A&B) = !A|!B and !(A|B) = !A&!B.', 'Any truth table can be written as an OR of AND terms (sum of products).'],
};

export const ohm: Lesson = {
  id: 'ohm',
  title: "Ohm's Law at Work",
  concept: "Ohm's law, series and parallel, dividers, power",
  xp: 70,
  steps: [
    say("In the electricity primer you met one rule: current = voltage / resistance. Engineers write it the other way round, **V = I × R**, and call it **Ohm's law**. It is the first tool of every hand analysis."),
    art(`
   V  voltage      the push      volts   (V)
   I  current      the flow      amperes (A)
   R  resistance   the fight     ohms    (Ω)

   V = I × R      I = V / R      R = V / I`, "Ohm's law, three ways round"),
    say('Watch one first. A 5 V supply across a 1 kΩ resistor: I = V / R = 5 / 1000 = 0.005 A. Multiply by 1000 to get milliamps: **5 mA**.'),
    gen((r) => {
      const R = pick(r, [100, 220, 330, 470, 1000]);
      const V = pick(r, [3.3, 5, 12]);
      const I = V / R;
      return walk(
        ask(`A ${R} Ω resistor sits across a ${V} V supply. How much current flows, in **mA**?`, qty(I * 1000, 'mA'), `I = V/R = ${V}/${R} = ${(I * 1000).toPrecision(3)} mA.`, 'I = V / R, then multiply amps by 1000 to get mA.'),
        "Ohm's law", 'Divide the voltage by the resistance to get amps, then turn amps into milliamps.',
        calc('Current in amps:', `${V} / ${R}`, I, 'A'),
        calc('In milliamps:', `${I.toPrecision(3)} × 1000`, I * 1000, 'mA'),
      );
    }),
    say('Resistors in a row are in **series**. The current has to go through both, so their resistances **add**. Worked example: 1 kΩ then 2 kΩ is 3 kΩ.'),
    ask('A 470 Ω resistor is in series with a 330 Ω resistor. What is the total, in Ω?', qty(800, 'Ω', 0.01), '470 + 330 = 800 Ω. In series, resistances add.', 'Add them.'),
    say('Resistors side by side are in **parallel**. The current gets two paths, so the total is **less than either one**. For two resistors: R1 × R2 / (R1 + R2). Worked example: 1 kΩ with 1 kΩ is 1 × 1 / 2 = 0.5 kΩ.'),
    ask('What is 1 kΩ in parallel with 1 kΩ, in Ω?', qty(500, 'Ω'), 'Two equal resistors in parallel give half: 1k·1k/(2k) = 500 Ω.', 'Two equal resistors in parallel = half of one.'),
    gen((r) => {
      const [a, b] = pick(r, [[2, 2], [3, 6], [4, 12], [6, 3]] as const);
      const p = (a * b) / (a + b);
      return ask(`What is ${a} kΩ in parallel with ${b} kΩ, in kΩ?`, qty(p, 'kΩ', 0.01), `${a} × ${b} / (${a} + ${b}) = ${a * b}/${a + b} = ${p} kΩ. Smaller than either one.`, 'Product over sum.');
    }),
    say('Now the most useful circuit in electronics: the **voltage divider**. Two resistors in series share the voltage in proportion to their size.'),
    art(`
   Vin ──┬──
         R1
         ├─── Vout = Vin × R2 / (R1 + R2)
         R2
   GND ──┴──

   Vin = 10 V, R1 = 1 kΩ, R2 = 4 kΩ:
   Vout = 10 × 4 / (1 + 4) = 8 V`, 'the divider, with a worked example'),
    gen((r) => {
      const [R1, R2] = pick(r, [[10000, 10000], [10000, 20000], [2000, 3000], [4700, 10000], [1000, 2200]] as const);
      const Vin = pick(r, [5, 12, 3.3]);
      const Vout = (Vin * R2) / (R1 + R2);
      return ask(`Vin = ${Vin} V, R1 = ${R1 / 1000} kΩ, R2 = ${R2 / 1000} kΩ. What is Vout?`, qty(Vout, 'V', 0.02), `Vout = ${Vin} × ${R2 / 1000}/(${R1 / 1000}+${R2 / 1000}) = ${Vout.toPrecision(3)} V.`, 'Vout = Vin × R2 / (R1 + R2).');
    }),
    app('divider', 'Your turn to design one. Pick standard resistor values to hit each target voltage. Real parts only come in certain values (the E12 series), so you will have to get creative.', 3),
    say("Last: power. You know P = V × I. Put Ohm's law into it and you get two more forms: **P = V² / R** and **P = I² × R**. Worked example: 10 V across 100 Ω is 100 / 100 = 1 W."),
    ask('A chip draws 2 A from a 0.9 V core supply. How many watts is that?', qty(1.8, 'W'), 'P = V × I = 0.9 × 2 = 1.8 W. Modern GPUs draw hundreds of amperes at under 1 V, which is why their power delivery is so hard.', 'P = V × I'),
    ask('20 mA flows through a 1 kΩ resistor. How much power does it turn into heat, in mW?', qty(400, 'mW', 0.01), 'P = I² × R = 0.02² × 1000 = 0.4 W = 400 mW.', 'P = I² × R, with I in amps.'),
    say('Good. You will use V = IR for the rest of your career, {name}. Even timing engineers do, for IR drop.', 'happy'),
  ],
  recap: ['V = I × R; P = V × I = V²/R = I²R.', 'Series resistors add; parallel ones combine to less than the smallest.', 'Divider: Vout = Vin × R2/(R1+R2).', 'Real resistors come in standard series (E12, E24, E96).'],
};

export const rc: Lesson = {
  id: 'rc',
  title: 'Capacitors and Time',
  concept: 'RC time constant, filters, decoupling',
  xp: 70,
  steps: [
    say('Resistors decide how much current flows. **Capacitors** decide how fast things happen. And in a chip, speed is everything.'),
    say('A capacitor stores energy by holding charge apart on its two plates, a bit like a small bucket that fills up. Charging it through a resistor takes time, and that time is set by the product **τ = R × C**, the time constant.'),
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
    say('Why does a chip designer care? Every wire in a chip has resistance, and every gate input is a tiny capacitor. **Every signal is an RC circuit.** The delay to the 50% point is about 0.69·R·C. That delay is what timing analysis measures.'),
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
    mc('Why does a CMOS gate burn almost no power when it is **not switching**?', ['The transistors are too small to conduct', 'There is no DC path from VDD to GND', 'The clock is gated off when idle', 'Capacitors hold the output for free'], 1, 'In steady state one network is always off, so there is no static current apart from leakage. Power is mostly spent charging capacitances when things switch, which is why P ≈ αCV²f.'),
    say('The rules for building a gate: in the pull-down, NMOS in **series** make AND, in **parallel** make OR. The pull-up is the **dual**: swap series and parallel.'),
    art(`
   NAND2:  pull-down = two NMOS in series   (both on -> Y pulled to 0)
           pull-up   = two PMOS in parallel (either on -> Y pulled to 1)`),
    ask('How many transistors are in a CMOS **NAND2**?', num(4), 'Two NMOS in series and two PMOS in parallel: 4 transistors.', 'One NMOS and one PMOS per input.'),
    mc('Why is there no 4-transistor CMOS **AND** gate?', ['There is one, but it is rarely used', 'A single CMOS stage is always inverting', 'PMOS transistors cannot sit in series', 'AND needs a clock to hold its output'], 1, 'NMOS pull down, PMOS pull up, so a single stage can only produce inverting functions (NAND, NOR, AOI...). AND needs a NAND followed by an inverter: 4 + 2 = 6 transistors. That is why standard cell libraries are full of inverting gates.'),
    say('Enough talk. I have a transistor-level lab ready for you, {name}. Let us see if you can build these by hand.', 'excited'),
  ],
  recap: ['NMOS: on with gate=1, pulls down. PMOS: on with gate=0, pulls up.', 'CMOS: complementary pull-up/pull-down; no static current apart from leakage.', 'Series in pull-down = parallel in pull-up (duality).', 'Single CMOS stages are inverting: NAND2 = 4T, AND2 = 6T.'],
};

export const FOUNDATION_LESSONS = [bits, bitadd, hex, twos, bool, demorgan, ohm, rc, mos];

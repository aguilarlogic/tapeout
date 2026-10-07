// Act I - Physics of semiconductors: band gaps, doping, PN junctions, MOSFET physics, short-channel effects, leakage.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

export const semi: Lesson = {
  id: 'semi',
  title: 'Why Silicon?',
  concept: 'band gap, doping, carriers, PN junctions',
  xp: 90,
  steps: [
    say('Time to go below the transistor, {name}, down to the atoms. Why is silicon special? It comes down to **energy bands**.'),
    art(`
   energy
     ▲   ███ conduction band ███      ███ conduction ███
     │                                                     metal: bands overlap,
     │        band gap Eg                 Eg = 9 eV        always conducts
     │                                   (insulator)
     │   ███ valence band ███         ███ valence ███
          semiconductor, Si: 1.12 eV       SiO2`),
    say('Electrons in the full **valence band** cannot carry current. Give one enough energy to jump the **band gap** into the conduction band and it can move, leaving behind a **hole** that also moves, as a positive carrier. Silicon\'s 1.12 eV gap is small enough to engineer and big enough to switch off.'),
    mc('Why are insulators like SiO2 insulators?', ['They contain no electrons at all', 'Their band gap is too wide for electrons to cross', 'Their electrons are too heavy to move', 'Their atoms are packed too tightly'], 1, 'Almost no electrons reach the conduction band. At room temperature thermal energy is about 26 meV. Crossing 9 eV essentially never happens, while crossing 1.12 eV happens just enough to give pure silicon a small intrinsic carrier density, n_i ≈ 1e10 per cm³.'),
    say('Pure silicon barely conducts. We **dope** it. Add phosphorus or arsenic (5 valence electrons) and you get spare electrons: **n-type**. Add boron (3 valence electrons) and you get holes: **p-type**.'),
    mc('Boron is added to silicon. What type does the silicon become?', ['n-type', 'p-type', 'intrinsic', 'metallic'], 1, 'Boron has 3 valence electrons, one short of silicon\'s 4, so each boron atom accepts an electron and creates a hole. It is an acceptor, so the silicon becomes p-type.'),
    say('One law ties the carriers together in equilibrium: the **mass-action law**, n · p = n_i² (n_i ≈ 1e10 cm⁻³ for silicon at 300 K is the round figure the game uses; a revised value is 9.65e9). Dope heavily with electrons and the holes almost vanish.'),
    gen((r) => {
      const e = pick(r, [15, 16, 17, 18]);
      const p = 20 - e;
      return ask(`n_i = 1e10 cm⁻³. Silicon is doped n-type with N_D = 1e${e} cm⁻³. What is the hole concentration? (answer like 1e${p})`, qty(10 ** p, '', 0.05, `1e${p}`), `n ≈ N_D = 1e${e}, so p = n_i²/n = 1e20/1e${e} = 1e${p} cm⁻³. The electrons are the majority carriers; the holes are a tiny minority.`, 'p = n_i² / n, and n_i² = 1e20.');
    }),
    say('Put p-type next to n-type and you get a **PN junction**. Carriers diffuse across and recombine, leaving a **depletion region** with no free carriers and a built-in electric field. Its built-in potential is roughly 0.6–0.9 V depending on doping (V_bi = V_T·ln(N_A·N_D/n_i²); very heavy doping pushes it towards 1 V), not the same as the ~0.7 V forward drop.'),
    art(`
      p-type  │ depletion │  n-type
     + + + +  │  - - │+ + │  - - - -
     holes    │  fixed ions│  electrons
              │ ◄── E field│

   forward bias (p +): barrier shrinks, current flows exponentially
   reverse bias (p -): barrier grows, only a tiny leakage current`),
    say('The diode current follows I = I_s · (e^(V/V_T) - 1), with the thermal voltage V_T = kT/q ≈ 26 mV at room temperature. Each extra 60 mV (V_T × ln 10) of forward bias multiplies the current by **10**.'),
    gen((r) => {
      const n = pick(r, [1, 2, 3]);
      return ask(`A forward-biased diode's voltage rises by ${n * 60} mV. By what factor does its current increase?`, num(10 ** n), `Every 60 mV is one decade: ${n} decade${n > 1 ? 's' : ''} = ${10 ** n}×. Exponentials like this are why leakage and temperature matter so much in chips.`, 'One decade per ~60 mV at room temperature.');
    }),
    mc('Electrons in silicon are about 2 to 3× more **mobile** than holes. What does that mean for CMOS design?', ['NMOS and PMOS are always drawn the same size', 'PMOS is made wider to match NMOS drive', 'PMOS is faster, so it is used for critical paths', 'It only matters in analog circuits'], 1, 'Lower hole mobility means a PMOS of the same size conducts less. Designers widen PMOS (classically about 2×) to get balanced rise and fall times.'),
  ],
  recap: ['Band gap separates insulators, semiconductors and metals (Si: 1.12 eV).', 'Donors (P, As) make n-type; acceptors (B) make p-type.', 'Mass action: n·p = n_i².', 'PN junction: depletion region, exponential forward current, ~60 mV per decade.', 'Electrons are more mobile than holes, so PMOS is sized wider.'],
};

export const mosphys: Lesson = {
  id: 'mosphys',
  title: 'Inside the MOSFET',
  concept: 'threshold, square law, short-channel effects, leakage',
  xp: 100,
  steps: [
    say('Now let us open up the MOSFET properly. A metal gate, a thin insulating oxide, and a silicon channel between the source and drain. The gate is one plate of a capacitor; the channel is the other.'),
    art(`
            gate
        ┌─────────────┐
        │  metal/poly │
   ─────┴─────────────┴─────  thin gate oxide
    n+ │   p substrate   │ n+
  source│ ~~~channel~~~   │drain    NMOS: raise the gate, attract
        └─────────────────┘         electrons, form an n channel`),
    say('Raise the gate voltage past the **threshold voltage** V_t and enough electrons gather under the oxide to form a conducting channel (**inversion**). Below V_t the transistor is (mostly) off.'),
    art(`
   regions (NMOS, Vov = Vgs - Vt):
     cutoff      Vgs < Vt                 Id ≈ 0  (only leakage)
     linear      Vds < Vov                behaves like a resistor
     saturation  Vds ≥ Vov                Id ≈ ½·µCox·(W/L)·Vov²   (long channel)`),
    gen((r) => {
      const k = pick(r, [2, 3]);
      return ask(`In the long-channel square law, if the overdrive (Vgs - Vt) is multiplied by ${k}, by what factor does the saturation current change?`, num(k * k), `Id ∝ Vov², so ×${k} overdrive gives ×${k * k} current.`, 'Id is proportional to the square of the overdrive.');
    }),
    mc('Doubling the transistor **width W** (same L) does what to its drive current?', ['Halves it', 'Doubles it', 'Quadruples it', 'Nothing'], 1, 'Id ∝ W/L. Wider is stronger (and has more capacitance). This is exactly what X1/X2/X4 cell sizes are in the timing lab.'),
    say('Modern transistors are **short-channel**: the gate length is only a few tens of atoms. The simple square law breaks down and new effects appear.'),
    art(`
   velocity saturation   carriers hit a speed limit; Id grows ~linearly with Vov, not squared
   DIBL                  drain voltage lowers the source barrier, so Vt drops as Vds rises
   Vt roll-off           shorter L gives lower Vt; small L variation becomes big Vt variation
   channel-length mod.   Id keeps rising with Vds in saturation (finite output resistance)
   hot carriers          high fields damage the oxide over time (a reliability issue)`),
    mc('What does **DIBL** (drain-induced barrier lowering) do?', ['Raises Vt as Vds rises, so the device leaks less', 'Lowers Vt as Vds rises, so leakage grows', 'Raises mobility in short channels', 'Lowers Vt as the temperature rises'], 1, 'In a short channel, the drain\'s field reaches the source and helps pull the barrier down. The gate loses control, so off-current rises with drain voltage.'),
    say('Which brings us to the enemy of modern chips: **leakage**. A transistor that is "off" still conducts a little, and a billion of them add up to watts.'),
    art(`
   subthreshold   exponential in -Vt/(n·V_T): the biggest one
   gate           electrons tunnel through a few-atom-thick oxide (reduced by high-k dielectrics)
   GIDL           gate-induced drain leakage at high gate-drain fields
   junction       reverse-biased PN junction leakage`),
    say('Subthreshold current drops by 10× for every **S** millivolts of Vt, where S, the subthreshold swing, can never beat about 60 mV/decade at room temperature (it is the same kT/q physics as the diode). Real devices manage 70 to 90.'),
    gen((r) => {
      const S = pick(r, [70, 80, 90]);
      const k = pick(r, [1, 2, 3]);
      return ask(`A process has S = ${S} mV/decade. You swap a cell to a low-Vt flavour with Vt ${S * k} mV lower. By what factor does its subthreshold leakage increase?`, num(10 ** k), `${S * k} mV / ${S} mV per decade = ${k} decade${k > 1 ? 's' : ''} = ${10 ** k}×. That is why LVT cells are used sparingly, only on critical paths: exactly the trade-off in the timing lab.`, 'Divide the Vt change by S to get decades.');
    }),
    mc('Leakage gets **worse** at high temperature. Why does that matter?', ['It only matters at cold corners', 'It can feed back into thermal runaway', 'It makes the chip cool itself down', 'It only matters when idle'], 1, 'More leakage heats the chip, which increases leakage again. Subthreshold leakage grows roughly exponentially with temperature. Power and thermal signoff happen at hot corners for that reason.'),
    mc('Why did the industry move from planar transistors to **FinFETs** and now **gate-all-around** nanosheets?', ['They are cheaper to make per transistor', 'The wrapped gate controls the channel better', 'They raise carrier mobility far above planar silicon', 'They switch without needing a gate oxide'], 1, 'Wrapping the gate around the channel gives better electrostatic control: less DIBL, steeper swing, lower leakage. The more of the channel the gate surrounds, the more it dominates over the drain. Short-channel effects shrink and the transistor turns off properly again.'),
    ask('Room-temperature thermal voltage kT/q is about how many **mV**?', qty(26, 'mV', 0.08), 'kT/q ≈ 25.9 mV at 300 K. It sets the 60 mV/decade limits for both diodes and subthreshold swing (26 mV × ln 10 ≈ 60 mV).', 'About a quarter of a tenth of a volt.'),
  ],
  recap: ['Vt: the gate voltage that forms the channel (inversion).', 'Long channel: Id ∝ (W/L)·Vov² in saturation; short channel: closer to linear.', 'Short-channel effects: velocity saturation, DIBL, Vt roll-off, CLM.', 'Leakage: subthreshold (≥60 mV/decade), gate tunneling, GIDL, junction; worse when hot.', 'FinFET/GAA restore gate control.'],
};

export const PHYSICS_LESSONS = [semi, mosphys];

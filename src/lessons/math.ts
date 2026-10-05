// Act I - Mathematical foundations: multivariable calculus, linear algebra, differential equations.
// Every concept is tied to where a chip engineer actually meets it.
import { num, qty } from './answers';
import { art, ask, between, gen, Lesson, mc, pick, say } from './types';

export const calc: Lesson = {
  id: 'calc',
  title: 'Calculus in Many Dimensions',
  concept: 'partials, gradients, integrals, div/curl/Stokes, optimization',
  xp: 90,
  steps: [
    say('Real engineering quantities depend on many variables at once. Chip power depends on capacitance, voltage and frequency. Delay depends on sizing, load and wire length. **Multivariable calculus** is how we reason about all of them together.'),
    say('A **partial derivative** asks: if I nudge one variable and hold the rest fixed, how fast does the output change? It is the math of **sensitivity**.'),
    art(`
   P(C, V, f) = C · V² · f            dynamic power

   ∂P/∂V = 2·C·V·f      ∂P/∂f = C·V²      ∂P/∂C = V²·f`),
    gen((r) => {
      const C = pick(r, [0.5, 1, 2]);
      const V = pick(r, [0.7, 0.8, 0.9, 1.0]);
      const f = pick(r, [1, 2, 3]);
      const d = 2 * C * V * f;
      return ask(`With C = ${C} nF, f = ${f} GHz and V = ${V} V, what is ∂P/∂V in **W/V**? (nF × GHz cancels to 1)`, qty(d, 'W/V', 0.02, `${+d.toFixed(3)} W/V`), `∂P/∂V = 2CVf = 2 × ${C} × ${V} × ${f} = ${+d.toFixed(3)} W/V. So raising the supply by 10 mV costs about ${+(d * 10).toFixed(1)} mW. Voltage is the strongest knob on power.`, 'Differentiate V² to 2V and keep C and f as constants.');
    }),
    say('Stack all the partials into a vector and you get the **gradient** ∇f, which points uphill in the steepest direction. Optimizers walk **against** it. Analytical placers do exactly this: they minimize a smooth wirelength function by gradient descent over millions of cell coordinates.'),
    gen((r) => {
      const a = between(r, 1, 4), b = between(r, 1, 4), x = between(r, 1, 3), y = between(r, 1, 3);
      // f = a x^2 + b x y ; df/dx = 2 a x + b y ; df/dy = b x
      const gx = 2 * a * x + b * y;
      return ask(`f(x, y) = ${a}x² + ${b}xy. What is ∂f/∂x at (x, y) = (${x}, ${y})?`, num(gx), `∂f/∂x = ${2 * a}x + ${b}y = ${2 * a}·${x} + ${b}·${y} = ${gx}. (The full gradient there is (${gx}, ${b * x}).)`, 'Treat y as a constant: d/dx of x² is 2x, of xy is y.');
    }),
    say('**Multiple integrals** add things up over areas and volumes: total charge from a charge density, total current through a wire\'s cross-section from current density, total heat from a power map.'),
    ask('Current density J = 2 mA/µm² flows uniformly through a wire 0.5 µm wide and 0.2 µm thick. What is the current in **mA**?', qty(0.2, 'mA'), 'I = ∬ J dA = J × area = 2 × (0.5 × 0.2) = 0.2 mA. Too much current density moves metal atoms over time, called electromigration, and it is a real signoff check.', 'For a uniform density the double integral is just density × area.'),
    say('Now **vector calculus**, the language of Maxwell\'s equations. **Divergence** ∇·F measures how much a field spreads out of a point (sources). **Curl** ∇×F measures how much it circulates.'),
    gen((r) => {
      const a = between(r, 1, 5), b = between(r, 1, 5), c = between(r, 1, 5);
      const sb = pick(r, [1, -1]);
      return ask(`F(x, y, z) = (${a}x, ${sb * b}y, ${c}z). What is ∇·F?`, num(a + sb * b + c), `∇·F = ∂(${a}x)/∂x + ∂(${sb * b}y)/∂y + ∂(${c}z)/∂z = ${a} ${sb > 0 ? '+' : '-'} ${b} + ${c} = ${a + sb * b + c}.`, 'Sum ∂Fx/∂x + ∂Fy/∂y + ∂Fz/∂z.');
    }),
    say('**Stokes\' theorem** says the circulation around a loop equals the flux of the curl through any surface bounded by it. Pair it with Faraday\'s law, ∇×E = -∂B/∂t, and you get: the voltage induced around a loop is proportional to the changing magnetic flux through the **area** of that loop.'),
    mc('Why do board designers obsess over keeping current loops (like a decoupling cap to its chip pin) **small**?', ['Smaller loops use less copper, which keeps the board cost down', 'Noise and inductance scale with loop area (Faraday, Stokes)', 'Large loops violate DRC', 'Small loops have lower resistance, and that is the only effect'], 1, 'Circulation of E around the loop = rate of change of flux through its area. Small area means low inductance and less coupled noise. It is the same reason the return-path level in the board lab punishes slots in the ground plane.'),
    say('Finally, **optimization**. Setting the gradient to zero finds minima. A classic chip example: sizing a chain of buffers to drive a big load.'),
    gen((r) => {
      const F = pick(r, [16, 36, 64, 100, 144]);
      const x = Math.sqrt(F);
      return ask(`Two inverter stages drive a load ${F}× larger than the first input. The delay is proportional to x + ${F}/x, where x is the size of the middle stage. What x minimizes it?`, num(x), `d/dx (x + ${F}/x) = 1 - ${F}/x² = 0, so x = √${F} = ${x}. Each stage then has the same "effort" of ${x}. This is the core of logical effort, which you will meet in the VLSI chapter.`, 'Differentiate and set to zero.');
    }),
    mc('You want to minimize power subject to a delay constraint. Which tool is designed for "optimize f subject to g = 0"?', ['Taylor series', 'Lagrange multipliers', 'Fourier transform', 'Integration by parts'], 1, 'Lagrange: ∇f = λ∇g at the optimum. Gate sizing, voltage selection and even placement are constrained optimization problems.'),
  ],
  recap: ['Partial derivatives = sensitivities; ∂P/∂V = 2CVf.', 'Gradients drive optimizers such as analytical placement.', 'Integrals total up densities (charge, current, heat).', 'Divergence = sources, curl = circulation; Stokes + Faraday: induced voltage ∝ loop area.', 'Optimum where the gradient is zero; Lagrange multipliers for constraints.'],
};

export const linalg: Lesson = {
  id: 'linalg',
  title: 'Linear Algebra',
  concept: 'matrices, eigenvalues, LU, SVD',
  xp: 90,
  steps: [
    say('Every circuit simulator, from SPICE to the power grid analyzer, is secretly a **linear algebra** engine. Write Kirchhoff\'s current law at every node and you get a matrix equation.'),
    art(`
   nodal analysis:   G · v = i

   G = conductance matrix (1/R between nodes)
   v = unknown node voltages
   i = currents injected by sources

   ┌  3  -1 ┐ ┌v1┐   ┌ 5 ┐
   └ -1   2 ┘ └v2┘ = └ 0 ┘   ->  v1 = 2, v2 = 1`),
    gen((r) => {
      const v1 = between(r, 1, 4), v2 = between(r, 1, 4);
      const a = between(r, 2, 4), c = between(r, 2, 4);
      const b = -1;
      const i1 = a * v1 + b * v2, i2 = b * v1 + c * v2;
      return ask(`Solve G·v = i with G = [[${a}, -1], [-1, ${c}]] and i = [${i1}, ${i2}]. What is v1?`, num(v1), `From the second row, v1 = ${c}·v2 - ${i2}. Substituting into the first gives v2 = ${v2} and v1 = ${v1}. Check: ${a}·${v1} - ${v2} = ${i1}. ✓`, 'Use the second equation to express v1 in terms of v2, then substitute.');
    }),
    say('A matrix is a **transformation**: it stretches, rotates and shears space. The **determinant** tells you how much it scales area. Determinant zero means it squashes space flat, so there is no unique solution.'),
    mc('SPICE stops with "singular matrix". In circuit terms, what usually happened?', ['The circuit is too big for the matrix to be stored in memory', 'A node has no DC path to ground, so its voltage is undefined', 'The resistors are too small, so the conductances underflow', 'The clock is missing, so the transient run cannot start up'], 1, 'It floats. A floating node adds a row of G that is not independent of the others: det(G) = 0, and there is no unique solution. Add a path to ground or fix the connection.'),
    say('How does SPICE solve G·v = i for a million nodes? Not by inverting G. It uses **LU decomposition**: factor G = L·U (lower and upper triangular), then solve two easy triangular systems. The factorization can be reused for many right-hand sides, and G is **sparse**, so it is fast.'),
    mc('Why is LU preferred over computing G⁻¹?', ['It is the only method that works for a conductance matrix', 'Factorizing is cheaper, more stable, and keeps sparsity', 'It uses less memory, but only for the small matrices here', 'The inverse does not exist for a matrix that has this form'], 1, 'The inverse of a sparse matrix is dense. Never invert a matrix you only need to solve with. The inverse of a sparse G is dense, which for a million nodes would need terabytes.'),
    say('**Eigenvectors** are directions a matrix only stretches, never rotates: A·x = λ·x. The **eigenvalues** λ tell you the stretch. In a linear system dx/dt = A·x, the eigenvalues decide stability: all negative real parts means it settles; any positive one means it blows up.'),
    gen((r) => {
      const a = between(r, 2, 6), b = between(r, 1, a - 1);
      return ask(`What is the **largest** eigenvalue of [[${a}, ${b}], [${b}, ${a}]]?`, num(a + b), `For [[a, b], [b, a]] the eigenvectors are (1, 1) and (1, -1), with eigenvalues a + b = ${a + b} and a - b = ${a - b}.`, 'Try multiplying the matrix by (1, 1).');
    }),
    mc('A feedback loop (a PLL, a voltage regulator) is modelled as dx/dt = A·x. When is it stable?', ['When det(A) is positive, whatever the eigenvalues turn out to be', 'When every eigenvalue of A has a negative real part', 'When A is symmetric, since all its eigenvalues are then real', 'When the eigenvalues are complex, since they make it oscillate'], 1, 'Each mode evolves like e^(λt). A negative real part decays; a positive one grows. Complex eigenvalues mean ringing, which is fine as long as it decays.'),
    say('The **SVD** writes any matrix as A = U·Σ·Vᵀ: a rotation, a scaling by the singular values, another rotation. Keep only the largest singular values and you get the best low-rank approximation of A.'),
    mc('Where would a chip engineer use the SVD?', ['Counting transistors in a block, from the layout database', 'Model order reduction, or finding the dominant variation directions', 'Routing wires between blocks, over a grid of the whole chip', 'Writing Verilog for the datapath, by generating it from the matrix'], 1, 'Examples: compressing a huge extracted RC network, or PCA of process variation. Low-rank structure is everywhere: parasitic networks, variation models, even ML accelerators compress weight matrices with it.'),
    mc('Are (1, 2, 3), (2, 4, 6) and (0, 1, 0) linearly independent?', ['Yes', 'No'], 1, '(2, 4, 6) = 2 × (1, 2, 3), so the set spans only a 2-D subspace. In circuit terms: a redundant equation, and a singular matrix.'),
  ],
  recap: ['Circuits become G·v = i (nodal analysis).', 'det = 0 means singular: a floating node in SPICE.', 'Solve with sparse LU, never by inverting.', 'Eigenvalues decide stability of linear systems.', 'SVD gives the best low-rank approximation: model reduction and PCA.'],
};

export const ode: Lesson = {
  id: 'ode',
  title: 'Differential Equations',
  concept: 'first/second-order ODEs, transients, PDEs',
  xp: 90,
  steps: [
    say('Whenever something changes over time, like a node charging, a supply ringing, or heat spreading, you are looking at a **differential equation**. Circuits are the friendliest place to learn them.'),
    art(`
   RC circuit (KCL at the capacitor):

      C · dv/dt = (Vin - v) / R

   solution for a step at t = 0:

      v(t) = Vin · (1 - e^(-t/RC))`),
    gen((r) => {
      const k = pick(r, [1, 2, 3]);
      const Vin = pick(r, [1, 1.8, 3.3]);
      const v = Vin * (1 - Math.exp(-k));
      return ask(`Vin = ${Vin} V, RC = 1 ns. What is v at t = ${k} ns?`, qty(v, 'V', 0.02), `v = ${Vin}·(1 - e^-${k}) = ${v.toFixed(3)} V.`, 'Plug t/RC into 1 - e^(-t/RC).');
    }),
    say('Add an inductor and you get a **second-order** equation. The package pins and board traces of every chip have inductance, and together with the decoupling capacitance they form an RLC circuit.'),
    art(`
   L·C·v'' + R·C·v' + v = Vin

   natural frequency   ω0 = 1/√(LC)       f0 = ω0 / 2π
   damping ratio       ζ  = (R/2)·√(C/L)

   ζ < 1  underdamped: rings        ζ = 1  critically damped
   ζ > 1  overdamped: slow, no overshoot`),
    gen((r) => {
      const L = pick(r, [0.5, 1, 2]); // nH
      const C = pick(r, [10, 100, 1000]); // nF
      const f = 1 / (2 * Math.PI * Math.sqrt(L * 1e-9 * C * 1e-9)) / 1e6;
      return ask(`A package has ${L} nH of inductance and the chip has ${C} nF of decoupling. What is the resonant frequency, in **MHz**?`, qty(f, 'MHz', 0.03), `f0 = 1/(2π√(LC)) = 1/(2π√(${L}e-9 × ${C}e-9)) ≈ ${f.toPrecision(3)} MHz. Power-delivery engineers work hard to damp this resonance, because the supply noise peaks there.`, 'f0 = 1 / (2π √(L·C)), with L in henries and C in farads.');
    }),
    gen((r) => {
      const z = pick(r, [0.2, 0.5, 1, 2.5]);
      return mc(`An RLC supply network has ζ = ${z}. What does its step response look like?`, ['Rings with overshoot', 'Fastest response with no overshoot', 'Slow, no overshoot'], z < 1 ? 0 : z === 1 ? 1 : 2, `ζ = ${z} is ${z < 1 ? 'underdamped, so it rings' : z === 1 ? 'critically damped' : 'overdamped, so it is sluggish'}.`);
    }),
    say('Simulators solve these numerically by stepping through time. **Forward Euler** is simple but goes unstable if the step is too big for the fastest time constant. SPICE uses **implicit** methods (backward Euler, trapezoidal) that stay stable on "stiff" circuits mixing picosecond and millisecond time constants.'),
    mc('Why does SPICE use implicit integration methods?', ['They are easier to code than the explicit methods are for it', 'Circuits are stiff: explicit steps would be tiny to stay stable', 'Implicit methods are exact, so the answer has no error in it', 'They avoid matrix solves, which are the slowest step of SPICE'], 1, 'Each implicit step needs a matrix solve (the LU from linear algebra), but it can take big steps without blowing up.'),
    say('When a quantity varies in **space** as well as time, you get a **partial** differential equation. Three you will meet: the **diffusion** equation (dopants diffusing into silicon, heat spreading across a die), the **wave** equation, and the **telegrapher\'s** equations (signals on a transmission line).'),
    art(`
   diffusion:   ∂u/∂t = D · ∂²u/∂x²      characteristic length  L ≈ √(D·t)`),
    mc('A dopant anneal runs **4× longer**. Roughly how much deeper do the dopants diffuse?', ['4× deeper', '2× deeper', '16× deeper', 'The same'], 1, 'Diffusion length ∝ √(D·t), so 4× the time gives √4 = 2× the depth. Heat spreading on a die follows the same square-root law.'),
    mc('On a PCB, when must you treat a wire as a **transmission line** (telegrapher\'s equations) instead of a simple node?', ['Always, since every wire behaves as a line at any frequency', 'When the rise time is short compared with the travel time', 'Only above 1 GHz of clock frequency', 'Only for power nets'], 1, 'Rule of thumb: if the trace delay is more than about 1/6 of the rise time, reflections matter, so you need controlled impedance and termination. It is the rise time that matters, not the clock frequency.'),
  ],
  recap: ['RC: first order, v = Vin(1 - e^(-t/RC)).', 'RLC: f0 = 1/(2π√LC); ζ decides ringing.', 'SPICE uses implicit integration for stiff circuits.', 'PDEs: diffusion (L ∝ √Dt), wave and telegrapher equations for transmission lines.'],
};

export const MATH_LESSONS = [calc, linalg, ode];

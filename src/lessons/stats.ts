// Act I - more math: probability & statistics, and numerical methods. Both sit under yield, Monte Carlo,
// random verification, reliability and every simulator a chip engineer uses.
import { num, qty } from './answers';
import { art, ask, gen, Lesson, mc, pick, say } from './types';

const pct = (x: number) => +(x * 100).toFixed(2);

export const prob: Lesson = {
  id: 'prob',
  title: 'Dice, Defects and Distributions',
  concept: 'probability, distributions, sigma, Monte Carlo, Bayes',
  xp: 100,
  steps: [
    say('Chips are built from billions of transistors that are all slightly different, tested with random stimulus, and shipped by the million. So chip engineering is secretly a **probability** job. Yield, noise, mismatch, random verification and reliability all run on the ideas in this lesson. No formulas to memorize up front; we will build them one at a time.'),
    say('Start simple. If two things are **independent**, the chance that both happen is the product of their chances. A chip works only if every block works, so the yields multiply.'),
    gen((r) => {
      const n = pick(r, [3, 4, 5]);
      const y = pick(r, [0.95, 0.98, 0.99]);
      return ask(`A chip has ${n} independent blocks, each with ${y * 100}% yield. What fraction of chips have every block working, in %?`, qty(y ** n * 100, '%', 0.01, pct(y ** n).toString()), `${y}^${n} = ${pct(y ** n)}%. Multiplying probabilities is why big chips need very high per-block yields.`, 'Multiply the probabilities together.');
    }),
    say('The opposite trick is just as useful: P(at least once) = 1 - P(never). This is the heart of **random verification**. If one random test hits a rare bug with probability p, then n tests hit it at least once with probability 1 - (1 - p)^n.'),
    gen((r) => {
      const p = pick(r, [1e-3, 1e-4]);
      const target = pick(r, [0.9, 0.95, 0.99]);
      const n = Math.ceil(Math.log(1 - target) / Math.log(1 - p));
      return ask(`A corner-case bug is hit by a random test with probability ${p}. How many random tests do you need for a ${target * 100}% chance of hitting it at least once?`, qty(n, '', 0.02, String(n)), `Solve 1 - (1 - p)^n ≥ ${target}: n = ln(${+(1 - target).toFixed(2)}) / ln(1 - ${p}) ≈ ${n}. Rare bugs need huge regressions, or better constraints that make them less rare. That is exactly what coverage-driven verification is for.`, 'n = ln(1 - target) / ln(1 - p).');
    }),
    say('Measure anything many times (a transistor\'s threshold voltage, a path delay, a clock period) and the values spread out in a bell curve: the **normal (Gaussian) distribution**, described by its mean μ and standard deviation σ.'),
    art(`
          ▁▃▆█▆▃▁
        ▁▃███████▃▁            within ±1σ: 68.3%
      ▁▃███████████▃▁          within ±2σ: 95.4%
   ─────┼───┼───┼───┼─────     within ±3σ: 99.73%
       -2σ   μ   +2σ           beyond ±6σ: about 2 per billion`),
    gen((r) => {
      const mu = pick(r, [350, 400, 450]);
      const s = pick(r, [10, 15, 20]);
      const k = pick(r, [1, 2, 3]);
      const inside = [68.27, 95.45, 99.73][k - 1];
      return ask(`Threshold voltage is normal with μ = ${mu} mV and σ = ${s} mV. What percentage of transistors fall between ${mu - k * s} and ${mu + k * s} mV?`, qty(inside, '%', 0.01), `That range is ±${k}σ, which holds ${inside}% of a normal distribution.`, 'Count how many σ the range spans, then use 68 / 95 / 99.7.');
    }),
    mc('A 32 MB cache has about 268 million bitcells. Why do SRAM designers verify their cell to about **6σ**, not 3σ?', ['Tradition: the 6σ figure was chosen long ago and then kept on', 'At 3σ hundreds of thousands fail; at 6σ about 2 per billion', 'Because σ is small, so the tail of the distribution hardly counts', 'Because Monte Carlo is cheap, so the runs can go out to 6σ easily'], 1, 'At 3σ, about 0.27% of cells fail, hundreds of thousands per cache. At 6σ it is about 2 per billion, which redundancy can fix. When you have billions of copies, rare tails become certainties. This is the most important statistical idea in memory and circuit design.'),
    say('When independent random effects add together, their **variances** add (σ²), not their σ values. So combined random jitter or mismatch is σ_total = √(σ₁² + σ₂² + ...).'),
    gen((r) => {
      const a = pick(r, [3, 6, 9]);
      const b = pick(r, [4, 8, 12]);
      const t = Math.sqrt(a * a + b * b);
      return ask(`A clock has ${a} ps rms of random jitter from its PLL and ${b} ps rms from the clock tree, independent. What is the total rms jitter, in ps?`, qty(t, 'ps', 0.02, t.toFixed(1)), `√(${a}² + ${b}²) = ${t.toFixed(1)} ps. Not ${a + b}: independent random sources add in quadrature. (Deterministic effects do add linearly.)`, 'Square, add, square root.');
    }),
    say('**Rare events in big populations** follow the **Poisson** distribution. If defects land randomly with an average of λ per die, the chance of zero defects is e^(-λ). That is the yield model from the fab lesson.'),
    gen((r) => {
      const lam = pick(r, [0.1, 0.25, 0.5, 1]);
      return ask(`Defects average λ = ${lam} per die. What fraction of dies have **zero** defects, in %?`, qty(Math.exp(-lam) * 100, '%', 0.01, pct(Math.exp(-lam)).toString()), `P(0) = e^(-${lam}) = ${pct(Math.exp(-lam))}%.`, 'P(0) = e^(-λ).');
    }),
    say('**Monte Carlo** means answering a question by simulating thousands of random cases. Its precision improves with the square root of the number of runs: the standard error of an average is σ/√n.'),
    gen((r) => {
      const k = pick(r, [2, 3, 4, 10]);
      return ask(`Your Monte Carlo estimate is too noisy. How many times more runs do you need to make its error ${k}× smaller?`, num(k * k), `Error ∝ 1/√n, so ${k}× smaller error needs ${k}² = ${k * k}× more runs. Brute force gets expensive fast; that is why advanced methods (importance sampling) exist for 6σ analysis.`, 'Error scales with 1/√n.');
    }),
    say('Last idea, and the one that surprises everyone: **conditional probability** and **Bayes\' rule**. P(A|B) is the chance of A given that B happened. Product engineers use it every day to judge what a failing test really means.'),
    art(`
   P(bad | failed) = P(failed | bad) · P(bad) / P(failed)`),
    gen((r) => {
      const prior = pick(r, [0.01, 0.02]);
      const det = 0.99;
      const fa = pick(r, [0.02, 0.05]);
      const post = (det * prior) / (det * prior + fa * (1 - prior));
      return ask(`${prior * 100}% of parts are truly bad. A test catches 99% of bad parts but also fails ${fa * 100}% of good parts. A part fails the test. What is the chance it is truly bad, in %?`, qty(post * 100, '%', 0.03, pct(post).toString()), `P(fail) = 0.99 × ${prior} + ${fa} × ${1 - prior} = ${(det * prior + fa * (1 - prior)).toFixed(4)}. P(bad | fail) = ${(det * prior).toFixed(4)} / ${(det * prior + fa * (1 - prior)).toFixed(4)} = ${pct(post)}%. Most failures are good parts! That is why failing parts get retested before they are scrapped.`, 'Bayes: P(fail | bad) × P(bad) / P(fail).');
    }),
  ],
  recap: ['Independent events multiply; P(at least once) = 1 - (1 - p)^n.', 'Normal: 68 / 95 / 99.7% within 1 / 2 / 3σ; billions of copies need ~6σ.', 'Independent variances add: σ = √(σ₁² + σ₂²).', 'Poisson: P(0) = e^(-λ) is the yield model.', 'Monte Carlo error ∝ 1/√n.', 'Bayes: a failing test does not mean a bad part.'],
};

export const numerics: Lesson = {
  id: 'numerics',
  title: 'Numbers That Lie',
  concept: 'floating point, fixed point, root finding, integration, stability',
  xp: 100,
  steps: [
    say('Every simulator you will ever use (SPICE, timing engines, performance models, your own Python scripts) computes with approximate numbers and approximate methods. **Numerical methods** is the art of knowing when those approximations are fine, and when they quietly lie to you.'),
    say('Computers store real numbers in **floating point**: a sign, an exponent and a fraction, like scientific notation in binary. A 32-bit float has 1 sign bit, 8 exponent bits and 23 fraction bits (24 bits of precision with the hidden leading 1).'),
    mc('In Python, `0.1 + 0.2 == 0.3` is `False`. Why?', ['Python has a bug in the way that it adds two floating-point numbers', 'They cannot be represented exactly in binary, so each is rounded', 'Floats are only eight bits wide, so they cannot hold these values', 'The + operator is approximate on purpose, to keep its speed high'], 1, 'The rounding errors do not cancel. 0.1 in binary is a repeating fraction, like 1/3 in decimal. Never compare floats with ==; compare with a tolerance: abs(a - b) < 1e-9.'),
    gen((r) => {
      const bits = pick(r, [24, 53]);
      const eps = 2 ** -(bits - 1);
      return ask(`A float format has ${bits} bits of precision (${bits === 24 ? 'single' : 'double'}). What is machine epsilon, the gap between 1.0 and the next number, as a power of two? Answer as a decimal (e.g. 1.2e-7).`, qty(eps, '', 0.02, eps.toExponential(3)), `ε = 2^-(${bits} - 1) = ${eps.toExponential(3)}. Any result is only accurate to about that relative error.`, 'ε = 2^-(precision - 1).');
    }),
    mc('You compute the tiny difference between two nearly equal 32-bit floats, like 1.0000123 - 1.0000120. What is the danger?', ['Overflow, since the difference of two floats can exceed their range', 'Catastrophic cancellation: the leading digits cancel, leaving noise', 'Nothing: floats subtract exactly when the two numbers are this close', 'Underflow to zero, which always happens for very small differences'], 1, 'Only the rounding noise is left, so the result has very few correct digits. Rearrange formulas to avoid subtracting nearly equal numbers, or use more precision. It is the classic numerical bug.'),
    say('Hardware usually avoids floating point and uses **fixed point**: an integer with an implied binary point. Q1.15 means 1 integer (sign) bit and 15 fraction bits in 16 bits total.'),
    gen((r) => {
      const f = pick(r, [7, 15, 31]);
      return ask(`In Q1.${f} fixed point, what is the value of one LSB (the resolution)? Answer as a decimal.`, qty(2 ** -f, '', 0.01, (2 ** -f).toExponential(3)), `One LSB = 2^-${f} = ${(2 ** -f).toExponential(3)}. DSP datapaths are sized by exactly this kind of calculation: enough fraction bits for accuracy, no more.`, '2 to the minus number of fraction bits.');
    }),
    say('Many equations have no closed-form solution, so we **iterate**. **Bisection** keeps halving an interval that contains the root: slow but guaranteed. **Newton\'s method** follows the tangent line, x_next = x - f(x)/f\'(x): very fast near the root, but it can wander off if you start badly.'),
    gen((r) => {
      const range = pick(r, [1, 2, 10]);
      const tol = pick(r, [1e-3, 1e-6]);
      const n = Math.ceil(Math.log2(range / tol));
      return ask(`Bisection starts with an interval ${range} wide. How many halvings until the interval is below ${tol}?`, num(n), `Each step halves it: you need 2^n ≥ ${range}/${tol}, so n = ceil(log2(${range / tol})) = ${n}.`, 'n = ceil(log2(width / tolerance)).');
    }),
    gen((r) => {
      const a = pick(r, [2, 3, 5, 10]);
      const x0 = pick(r, [1, 2, 3].filter((x) => x * x !== a));
      const x1 = x0 - (x0 * x0 - a) / (2 * x0);
      return ask(`Use Newton's method to find √${a}, i.e. solve f(x) = x² - ${a} = 0. Starting at x₀ = ${x0}, what is x₁?`, qty(x1, '', 0.005, x1.toFixed(4)), `x₁ = x₀ - f(x₀)/f'(x₀) = ${x0} - (${x0 * x0} - ${a})/(2·${x0}) = ${x1.toFixed(4)}. (√${a} = ${Math.sqrt(a).toFixed(4)}.) Newton roughly doubles the number of correct digits each step. SPICE uses it at every time point to solve the nonlinear diode and transistor equations.`, 'x₁ = x₀ - (x₀² - a) / (2x₀).');
    }),
    mc('SPICE prints "timestep too small" or "no convergence". What is the most likely cause, in numerical terms?', ['The netlist is too long', 'Newton\'s method failed to converge, often at a discontinuity', 'Too much memory is in use, so the time step has to be reduced', 'The clock is too fast'], 1, 'Fixes: better initial conditions, smoother models, relaxed tolerances (carefully), or ramping sources instead of ideal steps.'),
    say('To simulate over time we step through it. **Forward Euler**: y(t + h) = y(t) + h·f(y(t)). Simple, but on dy/dt = -y/τ it blows up if the step h is larger than 2τ.'),
    gen((r) => {
      const tau = pick(r, [1, 10, 100]);
      return ask(`A circuit node has a time constant of ${tau} ps. What is the largest stable forward-Euler time step, in ps?`, qty(2 * tau, 'ps', 0.01), `Forward Euler on dy/dt = -y/τ multiplies y by (1 - h/τ) each step; |1 - h/τ| < 1 needs h < 2τ = ${2 * tau} ps. One tiny parasitic time constant forces tiny steps across the whole simulation. That is "stiffness", and why SPICE uses implicit methods (backward Euler, trapezoidal) that are stable at any step.`, 'Stability needs |1 - h/τ| < 1.');
    }),
    gen((r) => {
      const k = pick(r, [2, 4, 10]);
      const order = pick(r, [1, 2]);
      return ask(`A method has error proportional to h^${order}${order === 1 ? ' (like Euler)' : ' (like trapezoidal)'}. If you make the step ${k}× smaller, how many times smaller does the error get?`, num(k ** order), `Error ∝ h^${order}, so ${k}× smaller h gives ${k}^${order} = ${k ** order}× smaller error. Higher-order methods buy accuracy much more cheaply.`, 'Raise the step ratio to the method\'s order.');
    }),
  ],
  recap: ['Floats round: never compare with ==, beware cancellation.', 'Fixed point Qm.n: LSB = 2^-n.', 'Bisection is safe, Newton is fast (SPICE uses Newton).', 'Forward Euler is stable only for h < 2τ; stiff circuits need implicit methods.', 'Error ∝ h^order.'],
};

export const STATS_LESSONS = [prob, numerics];

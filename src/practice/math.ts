// Practice banks and bosses for engineering math: calculus, linear algebra, ODEs, probability, numerics.
// Every problem is dressed as something a chip engineer actually computes.
import { hexa, num, qty } from '../lessons/answers';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { choose, eng, mcs, sig, tail } from './util';

// ------------------------------------------------------------------ calculus

export const calcPractice = practice('practice-calc', 'Sensitivity Drills', 'partials, gradients, integrals, optimization', [
  (r, d) => {
    if (d === 1) {
      const a = between(r, 1, 5), b = between(r, 1, 5), x = between(r, 1, 4), y = between(r, 1, 4);
      return ask(`f(x, y) = ${a}x² + ${b}y. What is ∂f/∂x at (${x}, ${y})?`, num(2 * a * x), `∂f/∂x = ${2 * a}x (y is held constant, so ${b}y differentiates to 0) = ${2 * a * x}.`, 'Treat y as a constant.');
    }
    if (d === 2) {
      const a = between(r, 1, 4), b = between(r, 1, 4), x = between(r, 1, 3), y = between(r, 1, 3);
      return ask(`f(x, y) = ${a}x²y + ${b}y². What is ∂f/∂y at (${x}, ${y})?`, num(a * x * x + 2 * b * y), `∂f/∂y = ${a}x² + ${2 * b}y = ${a * x * x} + ${2 * b * y} = ${a * x * x + 2 * b * y}.`, 'Now x is the constant.');
    }
    const dv = between(r, 1, 5), df = between(r, 1, 8), dc = pick(r, [0, 2, -3]);
    const tot = 2 * dv + df + dc;
    return ask(`Dynamic power P = C·V²·f. A new design point has V up ${dv}%, f up ${df}%${dc ? ` and switched capacitance ${dc > 0 ? 'up' : 'down'} ${Math.abs(dc)}%` : ''}. To first order, by what % does power rise?`, qty(tot, '%', 0.02, `${tot}%`), `Relative sensitivities add, weighted by exponents: dP/P = dC/C + 2·dV/V + df/f = ${dc} + 2×${dv} + ${df} = ${tot}%. Log-differentiation turns products of powers into weighted sums.`, 'Take ln of both sides and differentiate: exponents become weights.');
  },
  (r, d) => {
    const a = between(r, 2, 5), b = between(r, 2, 5), x = between(r, -3, 3) || 1, y = between(r, -3, 3) || 2;
    const gx = 2 * a * x, gy = 2 * b * y;
    if (d === 1) return ask(`f(x, y) = ${a}x² + ${b}y². What is the x-component of ∇f at (${x}, ${y})?`, num(gx), `∇f = (2·${a}x, 2·${b}y) = (${gx}, ${gy}).`, '∇f = (∂f/∂x, ∂f/∂y).');
    if (d === 2) return ask(`f(x, y) = ${a}x² + ${b}y². What is |∇f| at (${x}, ${y})? (3 significant figures)`, qty(Math.hypot(gx, gy), '', 0.01, sig(Math.hypot(gx, gy))), `∇f = (${gx}, ${gy}); its length is √((${gx})² + (${gy})²) = ${sig(Math.hypot(gx, gy))}. The gradient points uphill; its length is how steep.`, 'Compute both partials, then the Euclidean length.');
    const eta = pick(r, [0.1, 0.05, 0.2]);
    const nx = x - eta * gx;
    return ask(`An analytical placer minimizes f(x, y) = ${a}x² + ${b}y² by gradient descent with step η = ${eta}. A cell sits at x = ${x}, y = ${y}. What is its new x after one step?`, qty(nx, '', 0.005, sig(nx, 4)), `x ← x - η·∂f/∂x = ${x} - ${eta}·${gx} = ${sig(nx, 4)}. Too large an η and the cell would overshoot the minimum and oscillate.`, 'x_new = x - η · ∂f/∂x.');
  },
  (r, d) => {
    if (d === 1) {
      const I = pick(r, [2, 5, 10, 20]), t = pick(r, [3, 10, 50]);
      return ask(`A constant ${I} mA flows into a capacitor for ${t} µs. How much charge arrives, in nC?`, qty(I * t, 'nC', 0.01), `Q = ∫ i dt = ${I} mA × ${t} µs = ${I * t} nC.`, 'Charge is the integral of current over time.');
    }
    if (d === 2) {
      const Ip = pick(r, [10, 40, 100]), t = pick(r, [2, 4, 10]);
      return ask(`A supply current ramps linearly from 0 to ${Ip} mA over ${t} ns, then stops. How much charge was drawn, in pC?`, qty((Ip * t) / 2, 'pC', 0.01), `The area of a triangle: ½ × ${Ip} mA × ${t} ns = ${(Ip * t) / 2} pC.`, 'The integral of a linear ramp is the triangle under it.');
    }
    const I0 = pick(r, [5, 20, 50]), tau = pick(r, [2, 3, 8]);
    return ask(`A discharge current decays as i(t) = ${I0} mA · e^(-t/${tau} ns). How much total charge flows from t = 0 to ∞, in pC?`, qty(I0 * tau, 'pC', 0.01), `∫₀^∞ I₀e^(-t/τ) dt = I₀·τ = ${I0} mA × ${tau} ns = ${I0 * tau} pC. The capacitor held exactly this charge before it discharged.`, '∫ e^(-t/τ) dt from 0 to ∞ is τ.');
  },
  (r, d) => {
    if (d < 3) {
      const a = pick(r, [1, 2, 4]), b = pick(r, tier(d, [16, 36, 64], [8, 18, 50], [8, 18, 50]));
      const x = Math.sqrt(b / a);
      return ask(`Stage delay is modelled as ${a === 1 ? '' : a}x + ${b}/x, where x is a buffer size. Which x minimizes it?`, qty(x, '', 0.01, sig(x)), `d/dx = ${a} - ${b}/x² = 0 → x = √(${b}/${a}) = ${sig(x)}. The minimum delay there is 2√(${a}·${b}) = ${sig(2 * Math.sqrt(a * b))}.`, 'Set the derivative to zero.');
    }
    const k = pick(r, [16, 36, 100, 144]), a = pick(r, [1, 2, 4]), b = pick(r, [1, 4, 9]);
    const x = Math.sqrt((b * k) / a);
    return ask(`Minimize cost ${a}x + ${b}y subject to x·y = ${k} (for example, width × length at fixed area). What x is optimal?`, qty(x, '', 0.01, sig(x)), `Lagrange: ∇(${a}x + ${b}y) = λ∇(xy) → ${a} = λy, ${b} = λx, so ${a}x = ${b}y. With xy = ${k}: x = √(${b}·${k}/${a}) = ${sig(x)}.`, 'At the optimum the gradients of cost and constraint are parallel.');
  },
  (r, d) => {
    const a = between(r, 1, 5), b = between(r, 1, 5), c = between(r, 1, 5);
    if (d === 1) return ask(`F = (${a}x, ${b}y, ${c}z). What is ∇·F?`, num(a + b + c), `∇·F = ${a} + ${b} + ${c} = ${a + b + c}.`, 'Sum ∂Fx/∂x + ∂Fy/∂y + ∂Fz/∂z.');
    if (d === 2) return ask(`F = (${a}y, ${b}x, 0). What is the z-component of ∇×F?`, num(b - a), `(∇×F)_z = ∂Fy/∂x - ∂Fx/∂y = ${b} - ${a} = ${b - a}.`, '(∇×F)z = ∂Fy/∂x - ∂Fx/∂y.');
    const L = between(r, 1, 3);
    return ask(`F = (${a}x, ${b}y, ${c}z). By the divergence theorem, what is the total outward flux of F through the surface of a cube of side ${L} (any position)?`, num((a + b + c) * L ** 3), `∯F·dA = ∭(∇·F) dV = ${a + b + c} × ${L}³ = ${(a + b + c) * L ** 3}. Gauss's law for charge works exactly this way.`, 'Flux out = integral of the divergence over the volume.');
  },
  (r, d) => {
    if (d === 1) {
      const x = pick(r, [0.01, 0.02, 0.05]);
      return ask(`Linearize: e^(-x) ≈ 1 - x for small x. Estimate e^(-${x}) to 3 decimals.`, qty(1 - x, '', 0.001, String(1 - x)), `e^(-${x}) ≈ 1 - ${x} = ${1 - x} (true: ${Math.exp(-x).toFixed(5)}). First-order Taylor expansions are how engineers do mental math.`, 'Drop the x² term.');
    }
    const V = pick(r, [0.8, 0.9, 1.0]), vt = 0.3, a = 1.3, dv = pick(r, [-0.05, 0.05, -0.03]);
    // delay ∝ V / (V - Vt)^a ; d ln(delay)/dV = 1/V - a/(V - Vt)
    const s = 1 / V - a / (V - vt);
    const pct = s * dv * 100;
    return ask(`Gate delay ∝ V/(V - ${vt})^${a}. At V = ${V} V, the supply ${dv < 0 ? 'drops' : 'rises'} by ${Math.abs(dv * 1000)} mV. To first order, by what % does delay change? (negative = faster)`, qty(pct, '%', 0.04, `${pct.toFixed(1)}%`), `d(ln delay)/dV = 1/V - ${a}/(V - ${vt}) = ${s.toFixed(3)} per volt; × ${dv} V = ${pct.toFixed(1)}%. This sensitivity is why IR drop shows up directly as timing loss.`, 'Log-differentiate: 1/V - α/(V - Vt), times ΔV.');
  },
]);

// ------------------------------------------------------------------ linear algebra

const mat = (m: number[][]) => '[' + m.map((row) => '[' + row.join(', ') + ']').join(', ') + ']';
const rank3 = (m: number[][]) => {
  if (det3(m) !== 0) return 3;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const [k, l] of [[0, 1], [0, 2], [1, 2]]) if (m[i][k] * m[j][l] - m[i][l] * m[j][k] !== 0) return 2;
  return m.some((row) => row.some((x) => x !== 0)) ? 1 : 0;
};
const det3 = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

export const linalgPractice = practice('practice-linalg', 'Matrix Drills', 'nodal matrices, determinants, eigenvalues, rank', [
  (r, d) => {
    const v1 = between(r, -3, 4), v2 = between(r, -3, 4);
    const a = between(r, 2, tier(d, 3, 5, 7)), c = between(r, 2, tier(d, 3, 5, 7)), b = -between(r, 1, tier(d, 1, 2, 2));
    const i1 = a * v1 + b * v2, i2 = b * v1 + c * v2;
    const which = pick(r, [1, 2]);
    return ask(`Solve G·v = i with G = ${mat([[a, b], [b, c]])} and i = [${i1}, ${i2}]. What is v${which}?`, num(which === 1 ? v1 : v2), `Cramer: det = ${a}·${c} - ${b * b} = ${a * c - b * b}; v1 = (${i1}·${c} - ${b}·${i2})/det = ${v1}, v2 = (${a}·${i2} - ${b}·${i1})/det = ${v2}.`, 'Cramer\'s rule, or eliminate one unknown.');
  },
  (r, d) => {
    if (d === 1) {
      const m = [[between(r, -4, 6), between(r, -4, 6)], [between(r, -4, 6), between(r, -4, 6)]];
      return ask(`det ${mat(m)} = ?`, num(m[0][0] * m[1][1] - m[0][1] * m[1][0]), `ad - bc = ${m[0][0]}·${m[1][1]} - ${m[0][1]}·${m[1][0]} = ${m[0][0] * m[1][1] - m[0][1] * m[1][0]}.`, 'ad - bc.');
    }
    if (d === 2) {
      const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => between(r, -2, 3)));
      return ask(`det ${mat(m)} = ?`, num(det3(m)), `Expand along the first row: ${m[0][0]}·(${m[1][1] * m[2][2] - m[1][2] * m[2][1]}) - ${m[0][1]}·(${m[1][0] * m[2][2] - m[1][2] * m[2][0]}) + ${m[0][2]}·(${m[1][0] * m[2][1] - m[1][1] * m[2][0]}) = ${det3(m)}.`, 'Cofactor expansion along row 1.');
    }
    const a = between(r, 2, 6), b = between(r, 1, 4), c = between(r, 1, 4);
    // det [[a, b], [c, k]] = 0 → k = b c / a ; pick values so it is an integer
    const k = b * c;
    return ask(`For which k is [[${a}, ${a * b}], [${c}, k]] singular (a SPICE "singular matrix")?`, num(k), `det = ${a}·k - ${b * a}·${c} = 0 → k = ${b * a * c}/${a} = ${k}. Then row 2 is a multiple of row 1: the equations are not independent.`, 'Set the determinant to zero and solve for k.');
  },
  (r, d) => {
    if (d === 1) {
      const a = between(r, -5, 6), b = between(r, -5, 6), c = between(r, -3, 3);
      return ask(`What is the largest eigenvalue of the triangular matrix ${mat([[a, c], [0, b]])}?`, num(Math.max(a, b)), `A triangular matrix has its eigenvalues on the diagonal: ${a} and ${b}.`, 'Look at the diagonal.');
    }
    if (d === 2) {
      const a = between(r, 2, 7), b = between(r, 1, a - 1);
      return ask(`What is the smallest eigenvalue of ${mat([[a, b], [b, a]])}?`, num(a - b), `Eigenvectors (1, 1) and (1, -1): λ = ${a} ± ${b}, so ${a + b} and ${a - b}.`, 'Try (1, 1) and (1, -1).');
    }
    // A = P D P^-1 with P = [[1,1],[1,2]], P^-1 = [[2,-1],[-1,1]]
    const l1 = between(r, -4, 5), l2 = between(r, -4, 5);
    const A = [[2 * l1 - l2, -l1 + l2], [2 * l1 - 2 * l2, -l1 + 2 * l2]];
    return ask(`What is the largest eigenvalue of ${mat(A)}?`, num(Math.max(l1, l2)), `trace = ${l1 + l2}, det = ${l1 * l2}, so λ² - ${l1 + l2}λ + ${l1 * l2} = 0 → λ = ${l1}, ${l2}.`, 'λ² - (trace)λ + det = 0.');
  },
  (r, d) => {
    const R1 = pick(r, [1, 2, 4, 5]), R2 = pick(r, [1, 2, 4, 5]), R3 = pick(r, [1, 2, 5, 10]);
    const g = (x: number) => 1 / x;
    if (d === 1) return ask(`Node 1 connects to ground through ${R1} kΩ and to node 2 through ${R2} kΩ. In nodal analysis, what is G₁₁ (the diagonal entry for node 1), in mS?`, qty(g(R1) + g(R2), 'mS', 0.01), `G₁₁ is the sum of all conductances touching node 1: 1/${R1} + 1/${R2} = ${sig(g(R1) + g(R2))} mS.`, 'Diagonal = sum of conductances at that node.');
    if (d === 2) return ask(`Node 1 connects to ground through ${R1} kΩ and to node 2 through ${R2} kΩ; node 2 connects to ground through ${R3} kΩ. What is G₁₂, in mS?`, qty(-g(R2), 'mS', 0.01), `Off-diagonal entries are minus the conductance between the two nodes: -1/${R2} = ${sig(-g(R2))} mS. G is symmetric for resistor networks.`, 'Off-diagonal = minus the conductance joining the nodes.');
    const I = pick(r, [1, 2, 3]);
    const G = [[g(R1) + g(R2), -g(R2)], [-g(R2), g(R2) + g(R3)]];
    const dt = G[0][0] * G[1][1] - G[0][1] * G[1][0];
    const v1 = (I * G[1][1]) / dt;
    return ask(`${I} mA is injected into node 1. Node 1 → ground: ${R1} kΩ; node 1 → node 2: ${R2} kΩ; node 2 → ground: ${R3} kΩ. Build G and solve: V1 in volts?`, qty(v1, 'V', 0.01), `G = ${mat(G.map((row) => row.map((x) => +x.toFixed(3))))} mS, i = [${I}, 0] mA. V1 = ${I}·G₂₂/det = ${sig(v1)} V. (Check: ${R1} ∥ (${R2} + ${R3}) kΩ × ${I} mA = ${sig((I * R1 * (R2 + R3)) / (R1 + R2 + R3))} V.)`, 'Stamp each resistor, then solve the 2×2 system.');
  },
  (r, d) => {
    const r1 = [between(r, 1, 3), between(r, -2, 3), between(r, 0, 3)];
    const r2 = [between(r, -2, 2), between(r, 1, 3), between(r, -1, 3)];
    const kind = d === 1 ? pick(r, [1, 3]) : pick(r, [1, 2, 3]);
    const a = between(r, 1, 3), b = between(r, -2, 2) || 1;
    let rows: number[][];
    if (kind === 1) rows = [r1, r1.map((x) => 2 * x), r1.map((x) => -x)];
    else if (kind === 2) rows = [r1, r2, r1.map((x, i) => a * x + b * r2[i])];
    else rows = [[2, 1, 0], [0, 3, 1], [1, 0, between(r, 2, 4)]];
    const rk = rank3(rows);
    return ask(`What is the rank of ${mat(rows)}?`, num(rk), rk === 1 ? 'Every row is a multiple of one row: rank 1.' : rk === 2 ? `det = 0 but two rows are independent${kind === 2 ? ` (row 3 = ${a}·row1 ${b < 0 ? '-' : '+'} ${Math.abs(b)}·row2)` : ''}: rank 2.` : `det = ${det3(rows)} ≠ 0, so all three rows are independent: rank 3.`, 'Look for rows that are combinations of others, or compute the determinant.');
  },
  (r, d) => {
    const n = tier(d, 2, 2, 3);
    const eig = Array.from({ length: n }, () => pick(r, [-3, -2, -1, -0.5, 0.5, 1, 2]));
    const stable = eig.every((x) => x < 0);
    const A = n === 2 ? [[eig[0], between(r, -3, 3)], [0, eig[1]]] : [[eig[0], 1, between(r, -2, 2)], [0, eig[1], 2], [0, 0, eig[2]]];
    return mc(`A regulator loop is modelled as dx/dt = A·x with A = ${mat(A)}. Is it stable?`, ['Stable: every mode decays', 'Unstable: some mode grows'], stable ? 0 : 1, `A is triangular, so its eigenvalues are the diagonal: ${eig.join(', ')}. ${stable ? 'All negative: every mode e^(λt) decays.' : 'A positive eigenvalue means a mode e^(λt) grows without bound.'}`);
  },
]);

// ------------------------------------------------------------------ differential equations

export const odePractice = practice('practice-ode', 'Transient Drills', 'RC/RLC transients, damping, diffusion', [
  (r, d) => {
    const Vf = pick(r, [1, 1.8, 3.3]), tau = pick(r, [1, 2, 5]);
    const t = d === 1 ? tau * pick(r, [1, 2, 3]) : +(tau * pick(r, [0.3, 0.7, 1.5, 2.2])).toFixed(2);
    const V0 = d === 3 ? pick(r, [0.5, -0.5, Vf * 1.5]) : 0;
    const v = Vf + (V0 - Vf) * Math.exp(-t / tau);
    return ask(`A first-order node with τ = ${tau} ns starts at ${V0} V and heads toward ${Vf} V. What is v at t = ${t} ns?`, qty(v, 'V', 0.02, sig(v)), `v(t) = V∞ + (V₀ - V∞)e^(-t/τ) = ${Vf} + (${V0} - ${Vf})·e^(-${t}/${tau}) = ${sig(v)} V.`, 'v(t) = final + (initial - final)·e^(-t/τ).');
  },
  (r, d) => {
    const Vf = pick(r, [1, 1.2, 3.3]), tau = pick(r, [1, 4, 10]);
    const th = +(Vf * pick(r, [0.5, 0.9, 0.3])).toFixed(3);
    const V0 = d === 3 ? +(Vf * 0.2).toFixed(3) : 0;
    const t = tau * Math.log((Vf - V0) / (Vf - th));
    return ask(`A ${tau} ns RC node charges from ${V0} V toward ${Vf} V. The next gate switches at ${th} V. How long until it switches, in ns?`, qty(t, 'ns', 0.02), `t = τ·ln((V∞ - V₀)/(V∞ - Vth)) = ${tau}·ln(${sig(Vf - V0)}/${sig(Vf - th)}) = ${sig(t)} ns.${th === +(Vf * 0.5).toFixed(3) && !V0 ? ' The 50% point is at 0.69τ: that is where "delay = 0.69RC" comes from.' : ''}`, 'Solve the exponential for t, with a natural log.');
  },
  (r, d) => {
    const L = pick(r, [0.2, 0.5, 1, 2]) * 1e-9, C = pick(r, [10, 100, 470]) * 1e-9;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    if (d === 1) return ask(`L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. Resonant frequency f₀, in MHz?`, qty(f0 / 1e6, 'MHz'), `f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}.`, 'f₀ = 1/(2π√(LC)).');
    const R = pick(r, [0.01, 0.05, 0.2, 1]);
    const z = (R / 2) * Math.sqrt(C / L);
    if (d === 2) return ask(`Series RLC: R = ${R * 1000} mΩ, L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. What is the damping ratio ζ?`, qty(z, '', 0.02, sig(z)), `ζ = (R/2)·√(C/L) = ${sig(z)}. ${z < 1 ? 'Underdamped: the rail will ring.' : 'Overdamped: no ringing.'}`, 'ζ = (R/2)√(C/L).');
    const Rc = 2 * Math.sqrt(L / C);
    return ask(`L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. What series R makes the network critically damped (ζ = 1), in mΩ?`, qty(Rc * 1000, 'mΩ', 0.02), `ζ = 1 → R = 2√(L/C) = ${eng(Rc, 'Ω')}. This is the "target impedance" idea: damp the PDN to √(L/C).`, 'Solve ζ = (R/2)√(C/L) = 1 for R.');
  },
  (r, d) => {
    if (d === 1) {
      const z = pick(r, [0.1, 0.3, 0.7, 1, 1.5, 4]);
      return mcs(r, `A second-order step response has ζ = ${z}. What does it look like?`, z < 1 ? 'Overshoots and rings' : z === 1 ? 'Fastest rise with no overshoot' : 'Slow rise, no overshoot', ['Overshoots and rings', 'Fastest rise with no overshoot', 'Slow rise, no overshoot'].filter((o) => o !== (z < 1 ? 'Overshoots and rings' : z === 1 ? 'Fastest rise with no overshoot' : 'Slow rise, no overshoot')), `ζ < 1 rings, ζ = 1 is critical, ζ > 1 is sluggish. Here ζ = ${z}.`);
    }
    if (d === 2) {
      const p1 = between(r, 1, 5), p2 = between(r, p1 + 1, 8);
      return ask(`The characteristic equation is s² + ${p1 + p2}s + ${p1 * p2} = 0. What is the slowest (least negative) root?`, num(-p1), `(s + ${p1})(s + ${p2}) = 0 → s = -${p1}, -${p2}. The slowest mode, e^(-${p1}t), sets the settling time.`, 'Factor the quadratic.');
    }
    const z = pick(r, [0.1, 0.2, 0.3, 0.5, 0.7]);
    const os = Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) * 100;
    return ask(`A supply loop has ζ = ${z}. What is the percent overshoot of its step response?`, qty(os, '%', 0.03, `${os.toFixed(1)}%`), `%OS = e^(-πζ/√(1-ζ²)) = ${os.toFixed(1)}%. (Q = 1/(2ζ) = ${sig(1 / (2 * z))}.)`, '%OS = exp(-πζ / √(1 - ζ²)).');
  },
  (r, d) => {
    if (d < 3) {
      const k = pick(r, tier(d, [4, 9, 16], [2, 3, 10], [2, 3, 10]));
      return ask(`A diffusion step runs ${k}× longer. How many times deeper do the dopants go?`, qty(Math.sqrt(k), '', 0.01, sig(Math.sqrt(k))), `L ∝ √(Dt): √${k} = ${sig(Math.sqrt(k))}×.`, 'Diffusion length ∝ √(D·t).');
    }
    const D = pick(r, [1e-14, 4e-14, 1e-13]), t = pick(r, [600, 1800, 3600]);
    const L = Math.sqrt(D * t) * 1e7; // cm → nm
    return ask(`Boron with D = ${D} cm²/s anneals for ${t / 60} min. What is the diffusion length √(Dt), in nm?`, qty(L, 'nm', 0.02), `√(${D} × ${t}) = ${(Math.sqrt(D * t)).toExponential(2)} cm = ${sig(L)} nm. (1 cm = 10⁷ nm.)`, 'Compute √(D·t) in cm, then convert.');
  },
  (r, d) => {
    const tau = pick(r, [1, 2, 5]);
    const e = pick(r, tier(d, [0.1], [0.01, 0.02], [0.001, 0.0001]));
    const t = tau * Math.log(1 / e);
    return ask(`An exponential with τ = ${tau} µs must settle to within ${e * 100}% of its final value. How long, in µs?`, qty(t, 'us', 0.02), `e^(-t/τ) = ${e} → t = τ·ln(${1 / e}) = ${sig(t)} µs (${sig(Math.log(1 / e))} time constants). Data converters live by this: an N-bit ADC needs about (N+1)·ln2 time constants.`, 't = τ · ln(1/error).');
  },
]);

// ------------------------------------------------------------------ probability

export const probPractice = practice('practice-prob', 'Probability Drills', 'yield, sigma, Poisson, Bayes, coverage', [
  (r, d) => {
    if (d === 1) {
      const y = pick(r, [0.9, 0.95, 0.99]), n = between(r, 2, 6);
      return ask(`${n} independent blocks each yield ${y * 100}%. Chip yield, in %?`, qty(y ** n * 100, '%', 0.01, `${(y ** n * 100).toFixed(2)}%`), `${y}^${n} = ${(y ** n * 100).toFixed(2)}%.`, 'Independent: multiply.');
    }
    if (d === 2) {
      const p = pick(r, [0.01, 0.001]), n = pick(r, [100, 500, 1000]);
      const q = 1 - (1 - p) ** n;
      return ask(`A glitch occurs on ${p * 100}% of power-ups. Over ${n} power-ups, what is the chance of seeing it at least once, in %?`, qty(q * 100, '%', 0.01, `${(q * 100).toFixed(1)}%`), `1 - (1 - ${p})^${n} = ${(q * 100).toFixed(1)}%.`, 'P(at least once) = 1 - P(never).');
    }
    const n = pick(r, [64, 128, 256]), p = pick(r, [1e-3, 5e-3, 1e-2]);
    const p0 = (1 - p) ** n, p1 = n * p * (1 - p) ** (n - 1);
    return ask(`A memory row has ${n} cells, each failing independently with p = ${p}. One spare cell can repair a single failure. What is the row's yield with repair, in %?`, qty((p0 + p1) * 100, '%', 0.01, `${((p0 + p1) * 100).toFixed(2)}%`), `P(0 fails) + P(1 fail) = (1-p)^${n} + ${n}p(1-p)^${n - 1} = ${(p0 * 100).toFixed(2)}% + ${(p1 * 100).toFixed(2)}% = ${((p0 + p1) * 100).toFixed(2)}%. Without the spare it would be only ${(p0 * 100).toFixed(2)}%: redundancy is how big memories yield.`, 'Binomial: add the probabilities of 0 and exactly 1 failures.');
  },
  (r, d) => {
    if (d === 1) {
      const k = pick(r, [1, 2, 3]);
      return ask(`What fraction of a normal distribution lies within ±${k}σ of the mean, in %?`, qty([68.27, 95.45, 99.73][k - 1], '%', 0.005), `68.27 / 95.45 / 99.73% for 1 / 2 / 3σ.`, 'The 68-95-99.7 rule.');
    }
    const mu = pick(r, [400, 500, 800]), s = pick(r, [10, 20, 25]);
    const z = d === 2 ? pick(r, [1, 2, 3]) : pick(r, [1.5, 2.5, 3.5, 4]);
    const tl = tail(z) * 100;
    return ask(`Path delay is normal with μ = ${mu} ps, σ = ${s} ps. The clock allows ${mu + z * s} ps. What % of chips fail timing?`, qty(tl, '%', 0.03, `${sig(tl)}%`), `The limit is (${mu + z * s} - ${mu})/${s} = ${z}σ above the mean. One-sided tail: 1 - Φ(${z}) = ${sig(tl)}%.`, 'Compute z = (limit - μ)/σ, then the one-sided tail.');
  },
  (r, d) => {
    const srcs = Array.from({ length: tier(d, 2, 3, 3) }, () => pick(r, [2, 3, 4, 5, 6, 8, 12]));
    const rss = Math.sqrt(srcs.reduce((a, x) => a + x * x, 0));
    if (d < 3) return ask(`Independent random jitter sources of ${srcs.join(', ')} ps rms. Total rms jitter, in ps?`, qty(rss, 'ps', 0.02, sig(rss)), `√(${srcs.map((x) => `${x}²`).join(' + ')}) = ${sig(rss)} ps.`, 'Independent variances add.');
    const dj = pick(r, [5, 10, 20]), ber = pick(r, [[14.07, '1e-12'], [12.72, '1e-10']] as const);
    const tj = dj + ber[0] * rss;
    return ask(`A SerDes link has ${dj} ps of deterministic jitter and random sources of ${srcs.join(', ')} ps rms. At a BER of ${ber[1]} the random part counts as ${ber[0]}σ. Total jitter, in ps?`, qty(tj, 'ps', 0.02), `RJ = √(${srcs.map((x) => `${x}²`).join(' + ')}) = ${sig(rss)} ps. TJ = DJ + ${ber[0]}·RJ = ${dj} + ${sig(ber[0] * rss)} = ${sig(tj)} ps. Deterministic jitter adds linearly; random adds in quadrature.`, 'TJ = DJ + Q·RJ, where RJ is the root-sum-square.');
  },
  (r, d) => {
    if (d === 1) {
      const lam = pick(r, [0.1, 0.2, 0.5]);
      return ask(`λ = ${lam} defects per die on average. Yield (zero defects), in %?`, qty(Math.exp(-lam) * 100, '%', 0.01, `${(Math.exp(-lam) * 100).toFixed(1)}%`), `e^(-${lam}) = ${(Math.exp(-lam) * 100).toFixed(1)}%.`, 'Poisson: P(0) = e^(-λ).');
    }
    const D0 = pick(r, [0.05, 0.1, 0.2]); // per cm²
    if (d === 2) {
      const A = pick(r, [1, 2, 4, 6]);
      return ask(`Defect density D₀ = ${D0}/cm². A die is ${A} cm². Poisson yield, in %?`, qty(Math.exp(-D0 * A) * 100, '%', 0.01, `${(Math.exp(-D0 * A) * 100).toFixed(1)}%`), `λ = D₀·A = ${sig(D0 * A)}; Y = e^(-λ) = ${(Math.exp(-D0 * A) * 100).toFixed(1)}%. Bigger dies yield worse, exponentially: one reason for chiplets.`, 'λ = D₀ × area.');
    }
    const Y = pick(r, [0.8, 0.9, 0.7]);
    const A = -Math.log(Y) / D0;
    return ask(`D₀ = ${D0}/cm². What is the largest die area that still yields ${Y * 100}%, in cm²?`, qty(A, 'cm²', 0.02, sig(A)), `e^(-D₀A) = ${Y} → A = -ln(${Y})/${D0} = ${sig(A)} cm² (${sig(A * 100)} mm²).`, 'Solve e^(-D₀A) = Y for A.');
  },
  (r, d) => {
    const prior = pick(r, tier(d, [0.1, 0.2], [0.01, 0.05], [0.001, 0.005])), det = pick(r, [0.9, 0.99]), fa = pick(r, [0.01, 0.05]);
    const post = (det * prior) / (det * prior + fa * (1 - prior));
    return ask(`${prior * 100}% of dies have a latent defect. A stress test flags ${det * 100}% of defective dies and ${fa * 100}% of good ones. A die is flagged. Chance it is defective, in %?`, qty(post * 100, '%', 0.03, `${sig(post * 100)}%`), `P(flag) = ${det}·${prior} + ${fa}·${sig(1 - prior)} = ${sig(det * prior + fa * (1 - prior))}; P(defect | flag) = ${sig(det * prior)}/${sig(det * prior + fa * (1 - prior))} = ${sig(post * 100)}%. When the prior is small, false alarms dominate.`, 'Bayes: P(defect)·P(flag|defect) / P(flag).');
  },
  (r, d) => {
    const N = pick(r, tier(d, [2, 3, 4], [8, 10, 16], [32, 50, 100]));
    let H = 0;
    for (let k = 1; k <= N; k++) H += 1 / k;
    return ask(`A coverage point has ${N} equally likely bins. Purely random tests each hit one bin. On average, how many tests until every bin is hit?`, qty(N * H, '', 0.03, sig(N * H)), `Coupon collector: N·(1 + 1/2 + … + 1/N) = ${N} × ${sig(H)} ≈ ${sig(N * H)}. The last few bins take the longest, which is why DV engineers write directed tests or constraints to close coverage.`, 'Expected tests = N × H(N), the harmonic number.');
  },
  (r, d) => {
    const s = pick(r, [10, 20, 50]), n = pick(r, tier(d, [100, 400], [25, 2500], [10000, 1600]));
    if (d < 3) return ask(`Monte Carlo on a delay with σ = ${s} ps, ${n} runs. Standard error of the mean, in ps?`, qty(s / Math.sqrt(n), 'ps', 0.01), `σ/√n = ${s}/${Math.sqrt(n)} = ${sig(s / Math.sqrt(n))} ps.`, 'Standard error = σ/√n.');
    const p = pick(r, [1e-3, 1e-4]), rel = pick(r, [0.1, 0.2]);
    const need = (1 - p) / (p * rel * rel);
    return ask(`You estimate a failure probability of about ${p} by plain Monte Carlo and want ±${rel * 100}% relative error (1σ). About how many runs?`, qty(need, '', 0.05, String(Math.round(need))), `Relative error of a proportion ≈ √((1-p)/(np)); set it to ${rel}: n ≈ (1-p)/(p·${rel}²) ≈ ${sig(need)}. Rare events need huge sample counts; this is why high-sigma SRAM analysis uses importance sampling.`, 'Relative std of a proportion is √((1-p)/(n·p)).');
  },
]);

// ------------------------------------------------------------------ numerics

export const numericsPractice = practice('practice-numerics', 'Numerics Drills', 'floats, fixed point, iterations, time stepping', [
  (r, d) => {
    if (d === 1) {
      const b = pick(r, [24, 53]);
      return ask(`A float format has ${b} bits of precision. Machine epsilon (gap from 1.0 to the next number)? Decimal answer.`, qty(2 ** -(b - 1), '', 0.02, (2 ** -(b - 1)).toExponential(3)), `ε = 2^-${b - 1} = ${(2 ** -(b - 1)).toExponential(3)}.`, 'ε = 2^-(p - 1).');
    }
    if (d === 2) {
      const k = pick(r, [10, 20, 30]);
      const ulp = 2 ** (k - 23);
      return ask(`In float32 (24-bit precision), what is the spacing between adjacent numbers near 2^${k} (${eng(2 ** k, '')})?`, qty(ulp, '', 0.01, String(ulp)), `Spacing = 2^(${k} - 23) = ${ulp}. Floats are relative-precision: the bigger the number, the bigger the gaps.`, 'ULP near 2^k is 2^(k - 23) for float32.');
    }
    const b = pick(r, [24, 11]);
    return ask(`A ${b === 24 ? 'float32' : 'float16'} counter does x = x + 1 in a loop. Past what value does x + 1 == x (it stops counting)?`, num(2 ** b), `Above 2^${b} = ${2 ** b}, the spacing between ${b === 24 ? 'float32' : 'float16'} numbers is 2, so adding 1 rounds away. Performance-model cycle counters in float32 silently freeze here: use integers or doubles.`, 'Where does the spacing between floats become 2?');
  },
  (r, d) => {
    const f = pick(r, [7, 11, 15]);
    if (d === 1) return ask(`Q1.${f} fixed point: value of one LSB? Decimal answer.`, qty(2 ** -f, '', 0.01, (2 ** -f).toExponential(3)), `2^-${f} = ${(2 ** -f).toExponential(3)}.`, 'LSB = 2^-(fraction bits).');
    if (d === 2) {
      const x = pick(r, [0.5, 0.25, 0.75, -0.5, 0.1, -0.3]);
      const q = Math.round(x * 2 ** 15);
      const enc = (q + 65536) % 65536;
      return ask(`Encode ${x} in Q1.15 (16-bit two's complement). What 16-bit hex word, rounding to nearest?`, hexa(enc, 4), `round(${x} × 2^15) = ${q}${q < 0 ? ` → 2^16 ${q} = ${enc}` : ''} = 0x${enc.toString(16).toUpperCase().padStart(4, '0')}.`, 'Multiply by 2^15, round, then two\'s complement if negative.');
    }
    const [a, b, c, e] = [pick(r, [1, 2, 4]), pick(r, [7, 11, 15]), pick(r, [1, 2]), pick(r, [7, 15])];
    return ask(`Multiplying a Q${a}.${b} value by a Q${c}.${e} value gives an exact product with how many fraction bits?`, num(b + e), `Fraction bits add: ${b} + ${e} = ${b + e} (integer bits add too: Q${a + c}.${b + e}, ${a + b + c + e} bits total). The datapath then rounds and saturates back down.`, 'Multiplying scales by 2^-b × 2^-e.');
  },
  (r, d) => {
    const w = pick(r, tier(d, [1, 2], [1, 10], [0.5, 3, 100])), tol = pick(r, tier(d, [0.01, 0.1], [1e-3, 1e-4], [1e-6, 1e-9]));
    const n = Math.ceil(Math.log2(w / tol));
    return ask(`Bisection, starting interval ${w} wide. Iterations until the interval is below ${tol}?`, num(n), `2^n ≥ ${w}/${tol} → n = ceil(log2(${sig(w / tol)})) = ${n}.`, 'Each iteration halves the interval.');
  },
  (r, d) => {
    if (d < 3) {
      const a = pick(r, [2, 3, 5, 7, 10]), x0 = pick(r, [1, 2, 3].filter((x) => x * x !== a));
      const x1 = x0 - (x0 * x0 - a) / (2 * x0);
      const x2 = x1 - (x1 * x1 - a) / (2 * x1);
      const v = d === 1 ? x1 : x2;
      return ask(`Newton on f(x) = x² - ${a}, from x₀ = ${x0}. What is x${d === 1 ? '₁' : '₂'}? (4 decimals)`, qty(v, '', 0.001, v.toFixed(4)), `x₁ = ${x0} - (${x0 * x0} - ${a})/${2 * x0} = ${x1.toFixed(4)}${d === 2 ? `; x₂ = ${x2.toFixed(4)}` : ''}. √${a} = ${Math.sqrt(a).toFixed(4)}: Newton roughly doubles the correct digits each step.`, 'x_{n+1} = x_n - f(x_n)/f\'(x_n).');
    }
    // Diode node: solve Is·(e^(v/Vt) - 1) = I for v by one Newton step from v0.
    const Is = 1e-14, Vt = 0.02585, I = pick(r, [1e-3, 1e-4]), v0 = pick(r, [0.6, 0.65, 0.7]);
    const f = Is * (Math.exp(v0 / Vt) - 1) - I, fp = (Is / Vt) * Math.exp(v0 / Vt);
    const v1 = v0 - f / fp;
    return ask(`SPICE solves a diode Is(e^(v/Vt) - 1) = ${eng(I, 'A')} (Is = 1e-14 A, Vt = 25.85 mV) with Newton. From v₀ = ${v0} V, what is v₁, in V? (4 decimals)`, qty(v1, 'V', 0.002, v1.toFixed(4)), `f(v₀) = ${eng(f, 'A')}, f'(v₀) = ${eng(fp, 'S')}; v₁ = v₀ - f/f' = ${v1.toFixed(4)} V. (Exact: ${(Vt * Math.log(I / Is + 1)).toFixed(4)} V.) From a bad start the exponential makes Newton leap wildly, so SPICE limits each voltage step.`, 'f(v) = Is(e^(v/Vt) - 1) - I; f\'(v) = (Is/Vt)e^(v/Vt).');
  },
  (r, d) => {
    const taus = Array.from({ length: tier(d, 1, 2, 3) }, () => pick(r, [0.5, 1, 5, 20, 100]));
    const lim = 2 * Math.min(...taus);
    return ask(`${taus.length === 1 ? `A node with τ = ${taus[0]} ps` : `A circuit with time constants ${taus.join(', ')} ps`} is simulated with forward Euler. Largest stable time step, in ps?`, qty(lim, 'ps', 0.01), `Stability needs h < 2τ for every mode; the fastest one (${Math.min(...taus)} ps) sets the limit: ${lim} ps${taus.length > 1 ? ', even though you only care about the slow behaviour. That is stiffness, and why SPICE uses implicit methods' : ''}.`, 'h < 2τ, for the smallest τ.');
  },
  (r, d) => {
    if (d === 1) {
      const k = pick(r, [2, 4, 10]), p = pick(r, [1, 2, 4]);
      return ask(`A method's error ∝ h^${p}. Make h ${k}× smaller: how many times smaller is the error?`, num(k ** p), `Error ∝ h^${p}, so ${k}× smaller h gives ${k}^${p} = ${k ** p}× smaller error (at ${k}× the cost).`, 'Error scales as h^order.');
    }
    if (d === 2) {
      const ys = Array.from({ length: 3 }, () => between(r, 0, 8)), h = pick(r, [1, 2, 0.5]);
      const I = (h / 2) * (ys[0] + 2 * ys[1] + ys[2]);
      return ask(`Samples of current (mA) at t = 0, ${h}, ${2 * h} ns: ${ys.join(', ')}. Trapezoidal-rule charge, in pC?`, qty(I, 'pC', 0.01, sig(I)), `h/2·(y₀ + 2y₁ + y₂) = ${h}/2·(${ys[0]} + ${2 * ys[1]} + ${ys[2]}) = ${sig(I)} pC.`, 'Trapezoid: h/2 × (first + 2×middle + last).');
    }
    const k = pick(r, [3, 5, 8, 12]);
    return ask(`A matrix has condition number 10^${k}. Solving with double precision (≈16 digits), about how many correct significant digits can you expect?`, num(16 - k), `You lose about log10(κ) = ${k} digits: 16 - ${k} = ${16 - k}. Ill-conditioned matrices come from wildly different conductances (1 mΩ next to 1 GΩ), which is why SPICE adds GMIN.`, 'Digits lost ≈ log10(condition number).');
  },
]);

export const MATH_PRACTICE = [calcPractice, linalgPractice, odePractice, probPractice, numericsPractice];

// ------------------------------------------------------------------ bosses

export const calcBoss = boss({
  id: 'boss-calc',
  title: 'The Power Budget',
  concept: 'sensitivities, integrals and constrained optimization on a real design',
  xp: 160,
  steps: [
    say('Boss fight, {name}. Marketing promised a phone chip that runs 20% faster in the same battery life. The architect hands you the power model and leaves for a week. Exam rules: no hints, one try each.', 'thinking'),
    art(`  P_dyn  = α · C · V² · f        α = 0.15, C = 2 nF
  delay  ∝ V / (V - 0.3)^1.3
  energy per task = ∫ P dt`),
    { t: 'gen', make: (r) => { const V = pick(r, [0.75, 0.8, 0.85]), f = pick(r, [2, 2.5, 3]); const d = 2 * 0.15 * 2 * V * f; return ask(`At V = ${V} V and f = ${f} GHz, what is ∂P/∂V, in W/V?`, qty(d, 'W/V', 0.02), `∂P/∂V = 2αCVf = 2 × 0.15 × 2 nF × ${V} × ${f} GHz = ${sig(d)} W/V.`); } },
    { t: 'gen', make: (r) => { const s = pick(r, [5, 10, 15]); const drop = (1 - (1 - s / 100) ** 3) * 100; return ask(`DVFS lowers V and f together by ${s}% each (exactly, not first order). By what % does dynamic power fall?`, qty(drop, '%', 0.02, `${drop.toFixed(1)}%`), `P ∝ V²f → (1 - ${s / 100})³ = ${sig((1 - s / 100) ** 3)}, a ${drop.toFixed(1)}% drop. Cubic savings are why every phone scales voltage with frequency.`); } },
    { t: 'gen', make: (r) => { const V = pick(r, [0.8, 0.9]); const s = 1 / V - 1.3 / (V - 0.3); const mv = -200 / s; return ask(`At V = ${V} V, how much must V rise (first order, in mV) to make gates 20% faster? Use delay ∝ V/(V - 0.3)^1.3.`, qty(mv, 'mV', 0.05, `${sig(mv)} mV`), `d(ln delay)/dV = 1/${V} - 1.3/${sig(V - 0.3)} = ${s.toFixed(3)} /V. For -20%: ΔV = -0.20/${s.toFixed(3)} V = ${sig(mv)} mV. (First order; the real answer needs a few Newton steps.)`); } },
    { t: 'gen', make: (r) => { const P0 = pick(r, [2, 3, 4]), T = pick(r, [10, 20]); return ask(`A burst's power ramps linearly from ${P0} W down to 0 over ${T} ms. Energy used, in mJ?`, qty((P0 * T) / 2, 'mJ', 0.01), `E = ∫P dt = ½ × ${P0} W × ${T} ms = ${(P0 * T) / 2} mJ.`); } },
    { t: 'gen', make: (r) => { const F = pick(r, [64, 256, 1024]); const N = Math.log(F) / Math.log(4); return ask(`The output pad load is ${F}× the first inverter's input capacitance. Each stage's delay ∝ its effort, total ∝ N·F^(1/N). The classic result is a stage effort of about 4. How many stages is that?`, qty(N, '', 0.02, sig(N)), `F^(1/N) = 4 → N = ln ${F}/ln 4 = ${sig(N)}. Minimizing N·F^(1/N) over N gives an effort of e ≈ 2.7 for ideal gates; real parasitics push it to 3.6-4.`); } },
    { t: 'gen', make: (r) => { const k = pick(r, [36, 64, 100]); return ask(`Two blocks share a fixed area budget: width × height = ${k} µm². Wire cost is 2·width + 2·height. What is the minimum perimeter, in µm?`, qty(4 * Math.sqrt(k), 'um', 0.01), `Lagrange (or AM-GM): the optimum is a square, √${k} = ${Math.sqrt(k)} µm per side, perimeter ${4 * Math.sqrt(k)} µm.`); } },
    mc('Your gradient-descent sizing script oscillates wildly and never converges. The most likely fix?', ['Reduce the step size (learning rate)', 'Use more variables', 'Remove the constraint', 'Increase the step size'], 0, 'A step larger than 2/curvature overshoots the minimum each iteration. Shrink η, or use a line search / Newton step.'),
  ],
  recap: ['Log-differentiate to get % sensitivities.', 'DVFS: P ∝ V³ at constant V/f ratio.', 'Integrals give energy and charge.', 'Constrained optima come from Lagrange: gradients parallel.'],
});

export const linalgBoss = boss({
  id: 'boss-linalg',
  title: 'The Matrix Won\'t Solve',
  concept: 'build and solve nodal equations, then diagnose singular and unstable systems',
  xp: 160,
  steps: [
    say('Boss fight. Your homemade circuit solver (a Python script, the kind every analog team has) gives nonsense on a bias network. You have to be the solver.', 'thinking'),
    art(`      I_in
       │
   n1 ─┼── Ra ── n2 ── Rc ── gnd
       │         │
       Rb        Rd
       │         │
      gnd       gnd`),
    { t: 'gen', make: (r) => { const Ra = pick(r, [1, 2]), Rb = pick(r, [2, 4]); return ask(`Ra = ${Ra} kΩ, Rb = ${Rb} kΩ. What is G₁₁ in mS?`, qty(1 / Ra + 1 / Rb, 'mS', 0.01), `Sum of conductances at n1: 1/${Ra} + 1/${Rb} = ${sig(1 / Ra + 1 / Rb)} mS.`); } },
    { t: 'gen', make: (r) => { const Ra = pick(r, [1, 2]), Rc = pick(r, [2, 4]), Rd = pick(r, [4, 5]); return ask(`Ra = ${Ra} kΩ, Rc = ${Rc} kΩ, Rd = ${Rd} kΩ. What is G₂₂ in mS?`, qty(1 / Ra + 1 / Rc + 1 / Rd, 'mS', 0.01), `1/${Ra} + 1/${Rc} + 1/${Rd} = ${sig(1 / Ra + 1 / Rc + 1 / Rd)} mS.`); } },
    { t: 'gen', make: (r) => { const Ra = 1, Rb = 2, Rc = pick(r, [2, 4]), Rd = 4, I = pick(r, [1, 3]); const G = [[1 / Ra + 1 / Rb, -1 / Ra], [-1 / Ra, 1 / Ra + 1 / Rc + 1 / Rd]]; const dt = G[0][0] * G[1][1] - G[0][1] ** 2; const v2 = (-G[1][0] * I) / dt; return ask(`Ra = 1 kΩ, Rb = 2 kΩ, Rc = ${Rc} kΩ, Rd = 4 kΩ, I_in = ${I} mA into n1. Solve for V(n2), in V.`, qty(v2, 'V', 0.02), `G = [[1.5, -1], [-1, ${sig(G[1][1])}]] mS, det = ${sig(dt)}. V2 = (1 × ${I})/det = ${sig(v2)} V.`); } },
    mc('Someone deletes Rb, Rc and Rd but leaves a capacitor from n2 to ground. The DC solve fails with "singular matrix". Why?', ['Capacitors are open at DC, so n1 and n2 have no DC path to ground: G has a zero eigenvalue', 'Capacitors short at DC', 'The current source is too large', 'Ra is too small'], 0, 'At DC a capacitor is an open circuit. The floating subnetwork makes G singular. SPICE adds a tiny GMIN conductance to ground for exactly this reason.'),
    { t: 'gen', make: (r) => { const l1 = -between(r, 1, 4), l2 = pick(r, [-5, 2, 3]); const A = [[2 * l1 - l2, -l1 + l2], [2 * l1 - 2 * l2, -l1 + 2 * l2]]; return mc(`The linearized regulator model is dx/dt = ${mat(A)}·x. Stable?`, ['Stable', 'Unstable'], l2 < 0 ? 0 : 1, `trace = ${l1 + l2}, det = ${l1 * l2}: eigenvalues ${l1} and ${l2}. ${l2 < 0 ? 'Both negative: stable.' : `${l2} > 0: a growing mode. Unstable.`}`); } },
    { t: 'gen', make: (r) => { const s = [pick(r, [10, 12]), pick(r, [3, 4]), 1, 0.5]; const tot = s.reduce((a, x) => a + x * x, 0); return ask(`An extracted RC network's transfer matrix has singular values ${s.join(', ')}. Keeping only the largest, what % of the energy (sum of σ²) do you keep?`, qty((s[0] ** 2 / tot) * 100, '%', 0.01, `${((s[0] ** 2 / tot) * 100).toFixed(1)}%`), `${s[0]}² / (${s.map((x) => `${x}²`).join(' + ')}) = ${((s[0] ** 2 / tot) * 100).toFixed(1)}%. That is model order reduction: a rank-1 model that captures almost everything.`); } },
    mc('The solver is slow on a 2-million-node power grid. Your colleague inverts G once and multiplies. What do you say?', ['Great idea', 'Use a sparse LU (or an iterative solver like conjugate gradient); G⁻¹ is dense and would need terabytes', 'Use a bigger computer', 'Transpose it first'], 1, 'G has a few nonzeros per row; its inverse has 4×10¹² entries. Sparse factorization or preconditioned CG is how grid analyzers work.'),
  ],
  recap: ['Stamp conductances: diagonal sums, off-diagonal minus.', 'Floating nodes → singular G; GMIN fixes it.', 'Eigenvalues decide stability.', 'SVD energy tells you how much a reduced model keeps.'],
});

export const odeBoss = boss({
  id: 'boss-ode',
  title: 'The Ringing Rail',
  concept: 'second-order transients in a power delivery network',
  xp: 160,
  steps: [
    say('Boss fight. First silicon: the core supply rings every time the CPU wakes up, and a few parts crash. The package has inductance, the die has decoupling. Find the problem with differential equations.', 'concerned'),
    art(`  VRM ── R_pkg ── L_pkg ──┬── die (C_die, load current steps)
                          ═╧═
                          gnd`),
    { t: 'gen', make: (r) => { const L = pick(r, [0.1, 0.2, 0.5]) * 1e-9, C = pick(r, [50, 100, 200]) * 1e-9; const f = 1 / (2 * Math.PI * Math.sqrt(L * C)); return ask(`L_pkg = ${eng(L, 'H')}, C_die = ${eng(C, 'F')}. At what frequency does the rail ring, in MHz?`, qty(f / 1e6, 'MHz'), `f₀ = 1/(2π√LC) = ${eng(f, 'Hz')}. Supply noise peaks here; the load's current spectrum near f₀ is what hurts.`); } },
    { t: 'gen', make: (r) => { const L = 0.2e-9, C = 100e-9, R = pick(r, [2, 5, 10]) * 1e-3; const z = (R / 2) * Math.sqrt(C / L); return ask(`L = 0.2 nH, C = 100 nF, R_pkg = ${R * 1000} mΩ. Damping ratio ζ?`, qty(z, '', 0.02, sig(z)), `ζ = (R/2)√(C/L) = ${sig(z)}. Badly underdamped.`); } },
    { t: 'gen', make: (r) => { const z = pick(r, [0.05, 0.1, 0.15]); const os = Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) * 100; return ask(`With ζ = ${z}, what is the overshoot of the rail's step response, in %?`, qty(os, '%', 0.03, `${os.toFixed(0)}%`), `e^(-πζ/√(1-ζ²)) = ${os.toFixed(1)}%. Nearly the whole droop bounces back as overshoot.`); } },
    { t: 'gen', make: (r) => { const L = pick(r, [0.2, 0.5]) * 1e-9, C = 100e-9; const Z = Math.sqrt(L / C); return ask(`What R would critically damp L = ${eng(L, 'H')} with C = 100 nF, in mΩ?`, qty(2 * Z * 1000, 'mΩ', 0.02), `ζ = 1 → R = 2√(L/C) = ${sig(2 * Z * 1000)} mΩ. Designers add lossy decaps (with ESR) to get here, rather than resistance in the main path.`); } },
    { t: 'gen', make: (r) => { const L = 0.2e-9, R = pick(r, [2, 4]) * 1e-3; const tau = (2 * L) / R; return ask(`Underdamped RLC ringing decays with envelope e^(-t/τ), τ = 2L/R. With L = 0.2 nH and R = ${R * 1000} mΩ, how long until the ringing falls to 2%, in ns?`, qty(tau * Math.log(50) * 1e9, 'ns', 0.03), `τ = 2L/R = ${sig(tau * 1e9)} ns; to 2% takes ln(50) ≈ 3.9τ = ${sig(tau * Math.log(50) * 1e9)} ns.`); } },
    { t: 'gen', make: (r) => { const dI = pick(r, [1, 2, 5]), L = 0.2e-9, C = 100e-9; const dv = dI * Math.sqrt(L / C); return ask(`The CPU wakes and its current jumps by ${dI} A instantly. For an undamped LC, the first droop is about ΔI·√(L/C). How big, in mV?`, qty(dv * 1000, 'mV', 0.02), `√(L/C) = √(0.2 nH/100 nF) = ${sig(Math.sqrt(L / C) * 1000)} mΩ, × ${dI} A = ${sig(dv * 1000)} mV. Against a 750 mV supply with a 5% budget, that is the crash.`); } },
    mc('Which fix attacks the root cause most directly?', ['Stagger the wake-up so current ramps over many cycles, and add damped decoupling near f₀', 'Raise the clock frequency', 'Lower the capacitance', 'Increase L_pkg'], 0, 'A slower di/dt puts less energy near f₀, and damping (ESR, or on-die resistive decaps) kills the ringing. This is standard power-management practice.'),
  ],
  recap: ['f₀ = 1/(2π√LC); ζ = (R/2)√(C/L).', 'Overshoot from ζ; decay τ = 2L/R.', 'Droop ≈ ΔI·√(L/C): the target-impedance idea.'],
});

export const probBoss = boss({
  id: 'boss-prob',
  title: 'The Yield Review',
  concept: 'yield, sigma, redundancy and Bayes in one product meeting',
  xp: 160,
  steps: [
    say('Boss fight. It is the quarterly yield review, and the VP wants numbers, not feelings. The new AI chip is big, its SRAM is huge, and test is throwing away good parts. Exam rules.', 'thinking'),
    { t: 'gen', make: (r) => { const D0 = pick(r, [0.08, 0.1, 0.12]), A = pick(r, [6, 8]); return ask(`D₀ = ${D0}/cm², die = ${A} cm². Poisson yield, in %?`, qty(Math.exp(-D0 * A) * 100, '%', 0.02, `${(Math.exp(-D0 * A) * 100).toFixed(1)}%`), `e^(-${sig(D0 * A)}) = ${(Math.exp(-D0 * A) * 100).toFixed(1)}%.`); } },
    { t: 'gen', make: (r) => { const D0 = 0.1, A = pick(r, [6, 8]); const y1 = Math.exp(-D0 * A), y4 = Math.exp((-D0 * A) / 4); return ask(`Split the ${A} cm² die into 4 chiplets that are tested before assembly. Each chiplet's yield, in %?`, qty(y4 * 100, '%', 0.02, `${(y4 * 100).toFixed(1)}%`), `e^(-${sig((D0 * A) / 4)}) = ${(y4 * 100).toFixed(1)}%, versus ${(y1 * 100).toFixed(1)}% for the monolithic die. Known-good-die testing means you only throw away the bad quarter.`); } },
    { t: 'gen', make: (r) => { const z = pick(r, [5, 5.5, 6]); const p = tail(z); const N = 256e6; return ask(`Each SRAM bitcell fails when its margin is beyond ${z}σ (one-sided). The chip has 256 Mbit. Expected failing cells per chip?`, qty(p * N, '', 0.05, sig(p * N)), `P = 1 - Φ(${z}) = ${p.toExponential(2)}; × 2.56e8 = ${sig(p * N)} cells. Row/column redundancy repairs that many; at ${z}σ it is ${p * N < 50 ? 'comfortable' : 'a lot of repair'}.`); } },
    { t: 'gen', make: (r) => { const prior = pick(r, [0.02, 0.03]), fa = pick(r, [0.04, 0.06]); const post = (0.98 * prior) / (0.98 * prior + fa * (1 - prior)); return ask(`${prior * 100}% of parts are truly bad. The final test catches 98% of bad parts but also fails ${fa * 100}% of good ones. Of the parts it rejects, what % are truly bad?`, qty(post * 100, '%', 0.03, `${sig(post * 100)}%`), `Bayes: ${sig(0.98 * prior)} / (${sig(0.98 * prior)} + ${sig(fa * (1 - prior))}) = ${sig(post * 100)}%. Most rejects are good parts: overkill. That is the "test is throwing away good parts" problem.`); } },
    { t: 'gen', make: (r) => { const s = pick(r, [8, 10]), n = pick(r, [4, 9]); return ask(`Speed binning: one Fmax measurement has ${s} MHz of random noise (σ). You measure each die ${n} times and average. What is the noise of the average, in MHz?`, qty(s / Math.sqrt(n), 'MHz', 0.01), `σ/√n = ${s}/${Math.sqrt(n)} = ${sig(s / Math.sqrt(n))} MHz.`); } },
    { t: 'gen', make: (r) => { const n = pick(r, [128, 256]), p = pick(r, [2e-3, 4e-3]); const p0 = (1 - p) ** n, p1 = n * p * (1 - p) ** (n - 1), p2 = choose(n, 2) * p * p * (1 - p) ** (n - 2); return ask(`A memory column of ${n} cells (p = ${p} each) has 2 spare cells. Probability the column is repairable, in %?`, qty((p0 + p1 + p2) * 100, '%', 0.01, `${((p0 + p1 + p2) * 100).toFixed(2)}%`), `P(0) + P(1) + P(2) = ${(p0 * 100).toFixed(2)} + ${(p1 * 100).toFixed(2)} + ${(p2 * 100).toFixed(2)} = ${((p0 + p1 + p2) * 100).toFixed(2)}%.`); } },
    mc('The VP asks: "Can we just run 10× more Monte Carlo to get SRAM failure rates at 6σ?" Your answer?', ['Yes, 10× is plenty', 'No: 6σ events are ~1e-9, so plain Monte Carlo needs ~1e10+ samples; use importance sampling or extrapolation', 'Monte Carlo cannot model SRAM', 'Only if we use a bigger σ'], 1, 'To see a 1e-9 event even a few times you need billions of runs. High-sigma methods bias the sampling toward the failure region and re-weight.'),
  ],
  recap: ['Poisson yield e^(-D₀A); chiplets + KGD.', 'High-sigma: tail × count = expected fails.', 'Bayes explains overkill.', 'Averaging reduces noise by √n.'],
});

export const numericsBoss = boss({
  id: 'boss-numerics',
  title: 'The Simulator That Lied',
  concept: 'floating point, stiffness and convergence bugs in a real tool',
  xp: 160,
  steps: [
    say('Boss fight. The performance-modelling team\'s simulator reports that a 20-million-cycle benchmark finished in 16,777,216 cycles, every time. Their transient solver also explodes on some circuits. You are the numerics expert they call.', 'thinking'),
    mc('The cycle counter is a float32 incremented by 1.0 each cycle. What happened?', ['Integer overflow', 'At 2^24 = 16,777,216 the float32 spacing becomes 2, so +1 rounds away and the counter freezes', 'The benchmark really took that long', 'Denormals'], 1, 'Float32 has 24 bits of precision. Counters must be integers (or at least doubles).'),
    { t: 'gen', make: (r) => { const taus = [pick(r, [0.5, 1, 2]), pick(r, [100, 1000])]; return ask(`Their forward-Euler transient solver simulates a circuit with time constants ${taus[0]} ps and ${taus[1]} ps. Largest stable step, in ps?`, qty(2 * taus[0], 'ps', 0.01), `2 × ${taus[0]} ps. The fast parasitic forces tiny steps across the whole run: a stiff system. Switch to backward Euler or trapezoidal.`); } },
    { t: 'gen', make: (r) => { const tau = pick(r, [1, 2]), h = pick(r, [3, 5]) * tau; const g = 1 - h / tau; return ask(`With τ = ${tau} ps and step h = ${h} ps, forward Euler multiplies the error by (1 - h/τ) each step. By what factor does it grow per step (magnitude)?`, qty(Math.abs(g), '', 0.01, String(Math.abs(g))), `|1 - ${h}/${tau}| = ${Math.abs(g)} > 1: it grows ${Math.abs(g)}× every step, with alternating sign. That is the "explosion".`); } },
    { t: 'gen', make: (r) => { const x0 = pick(r, [1, 2]); const a = 5; const x1 = x0 - (x0 ** 3 - a) / (3 * x0 * x0); return ask(`Their bias solver uses Newton on f(x) = x³ - ${a}. From x₀ = ${x0}, what is x₁? (4 decimals)`, qty(x1, '', 0.002, x1.toFixed(4)), `x₁ = ${x0} - (${x0 ** 3} - ${a})/(3·${x0 * x0}) = ${x1.toFixed(4)}. (∛${a} = ${Math.cbrt(a).toFixed(4)}.)`); } },
    { t: 'gen', make: (r) => { const tol = pick(r, [1e-6, 1e-9]); const n = Math.ceil(Math.log2(1 / tol)); return ask(`As a fallback they use bisection on a [0, 1] V interval. Iterations to reach ${tol} V?`, num(n), `ceil(log2(1/${tol})) = ${n}. Slow but guaranteed: good fallback when Newton diverges.`); } },
    { t: 'gen', make: (r) => { const f = pick(r, [11, 15]); const x = pick(r, [0.3, 0.7]); const q = Math.round(x * 2 ** f) / 2 ** f; return ask(`Their DSP model stores coefficient ${x} in Q1.${f}. What is the stored value's absolute rounding error? (scientific notation fine)`, qty(Math.abs(q - x), '', 0.05, Math.abs(q - x).toExponential(2)), `round(${x} × 2^${f}) / 2^${f} = ${q}; error = ${Math.abs(q - x).toExponential(2)}, at most half an LSB (${(2 ** -(f + 1)).toExponential(2)}).`); } },
    mc('Their energy estimate sums 10⁹ tiny per-cycle values into one float32 total, and the result is 30% low. Best fix?', ['Use pairwise or Kahan summation, or a double accumulator', 'Sum in random order', 'Divide by 10⁹ first', 'Use float16'], 0, 'Once the total is large, each tiny addend is below half an ULP and rounds away. Compensated (Kahan) or pairwise summation, or a wider accumulator, fixes it.'),
  ],
  recap: ['Float32 counters freeze at 2^24.', 'Stiff systems need implicit integration.', 'Newton fast, bisection safe.', 'Accumulate small numbers carefully.'],
});

export const MATH_BOSSES = [calcBoss, linalgBoss, odeBoss, probBoss, numericsBoss];

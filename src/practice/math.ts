// Practice banks and bosses for engineering math: calculus, linear algebra, ODEs, probability, numerics.
// Every problem is dressed as something a chip engineer actually computes.
import { hexa, num, qty } from '../lessons/answers';
import { calc, choice, count, show, step, walk } from '../lessons/teach';
import { art, ask, between, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { choose, eng, mcs, sig, tail } from './util';

// ------------------------------------------------------------------ calculus

export const calcPractice = practice('practice-calc', 'Sensitivity Drills', 'partials, gradients, integrals, optimization', [
  (r, d) => {
    const partial = 'A partial derivative ∂f/∂x asks how f changes when ONLY x moves: treat every other variable as a fixed number and differentiate as usual. Rules you need: d(x²)/dx = 2x, d(constant)/dx = 0, and a constant factor stays in front.';
    if (d === 1) {
      const a = between(r, 1, 5), b = between(r, 1, 5), x = between(r, 1, 4), y = between(r, 1, 4);
      return walk(ask(`f(x, y) = ${a}x² + ${b}y. What is ∂f/∂x at (${x}, ${y})?`, num(2 * a * x), `∂f/∂x = ${2 * a}x (y is held constant, so ${b}y differentiates to 0) = ${2 * a * x}.`, 'Treat y as a constant.'),
        'partial derivatives', partial,
        choice(`Holding y fixed, what does the ${b}y term differentiate to (with respect to x)?`, '0: it does not change when x moves', [`${b}`, `${b}y`]),
        choice(`And ${a}x² differentiates to:`, `${2 * a}x`, [`${a}x`, `${a}x²`]),
        count(`Now plug in x = ${x}:`, `${2 * a} × ${x}`, 2 * a * x));
    }
    if (d === 2) {
      const a = between(r, 1, 4), b = between(r, 1, 4), x = between(r, 1, 3), y = between(r, 1, 3);
      return walk(ask(`f(x, y) = ${a}x²y + ${b}y². What is ∂f/∂y at (${x}, ${y})?`, num(a * x * x + 2 * b * y), `∂f/∂y = ${a}x² + ${2 * b}y = ${a * x * x} + ${2 * b * y} = ${a * x * x + 2 * b * y}.`, 'Now x is the constant.'),
        'partial derivatives', partial,
        choice(`Holding x fixed, ${a}x²·y is (a constant) × y. It differentiates to:`, `${a}x²`, [`${2 * a}xy`, '0']),
        choice(`And ${b}y² differentiates to:`, `${2 * b}y`, [`${b}y`, `${b}y²`]),
        count(`So ∂f/∂y = ${a}x² + ${2 * b}y. Plug in x = ${x}, y = ${y}:`, `${a}×${x}² + ${2 * b}×${y}`, a * x * x + 2 * b * y));
    }
    const dv = between(r, 1, 5), df = between(r, 1, 8), dc = pick(r, [0, 2, -3]);
    const tot = 2 * dv + df + dc;
    return walk(ask(`Dynamic power P = C·V²·f. A new design point has V up ${dv}%, f up ${df}%${dc ? ` and switched capacitance ${dc > 0 ? 'up' : 'down'} ${Math.abs(dc)}%` : ''}. To first order, by what % does power rise?`, qty(tot, '%', 0.02, `${tot}%`), `Relative sensitivities add, weighted by exponents: dP/P = dC/C + 2·dV/V + df/f = ${dc} + 2×${dv} + ${df} = ${tot}%. Log-differentiation turns products of powers into weighted sums.`, 'Take ln of both sides and differentiate: exponents become weights.'),
      'relative sensitivity', 'For a product of powers like P = C·V²·f, small PERCENT changes simply add, each multiplied by its exponent: %P ≈ 1×%C + 2×%V + 1×%f. (Take ln of both sides: ln P = ln C + 2 ln V + ln f, and d(ln x) = dx/x is the relative change.)',
      count(`V has exponent 2, so its ${dv}% counts twice:`, `2 × ${dv}`, 2 * dv),
      count('Add all the weighted changes (C, V, f):', `${dc} + ${2 * dv} + ${df}`, tot));
  },
  (r, d) => {
    const a = between(r, 2, 5), b = between(r, 2, 5), x = between(r, -3, 3) || 1, y = between(r, -3, 3) || 2;
    const gx = 2 * a * x, gy = 2 * b * y;
    const idea = 'The gradient ∇f = (∂f/∂x, ∂f/∂y) is a vector pointing in the direction f increases fastest; its length says how steep. For f = a·x² + b·y², ∂f/∂x = 2a·x and ∂f/∂y = 2b·y. Gradient DESCENT steps the other way: x_new = x - η·∂f/∂x.';
    if (d === 1) return walk(ask(`f(x, y) = ${a}x² + ${b}y². What is the x-component of ∇f at (${x}, ${y})?`, num(gx), `∇f = (2·${a}x, 2·${b}y) = (${gx}, ${gy}).`, '∇f = (∂f/∂x, ∂f/∂y).'),
      'the gradient', idea,
      count(`∂f/∂x = 2·${a}·x at x = ${x}:`, `2 × ${a} × ${x}`, gx));
    if (d === 2) return walk(ask(`f(x, y) = ${a}x² + ${b}y². What is |∇f| at (${x}, ${y})? (3 significant figures)`, qty(Math.hypot(gx, gy), '', 0.01, sig(Math.hypot(gx, gy))), `∇f = (${gx}, ${gy}); its length is √((${gx})² + (${gy})²) = ${sig(Math.hypot(gx, gy))}. The gradient points uphill; its length is how steep.`, 'Compute both partials, then the Euclidean length.'),
      'gradient magnitude', idea,
      count('∂f/∂x = 2a·x:', `2 × ${a} × ${x}`, gx),
      count('∂f/∂y = 2b·y:', `2 × ${b} × ${y}`, gy),
      calc('The length, √(gx² + gy²):', `√(${gx}² + ${gy}²)`, Math.hypot(gx, gy), '', sig(Math.hypot(gx, gy)), 0.01));
    const eta = pick(r, [0.1, 0.05, 0.2]);
    const nx = x - eta * gx;
    return walk(ask(`An analytical placer minimizes f(x, y) = ${a}x² + ${b}y² by gradient descent with step η = ${eta}. A cell sits at x = ${x}, y = ${y}. What is its new x after one step?`, qty(nx, '', 0.005, sig(nx, 4)), `x ← x - η·∂f/∂x = ${x} - ${eta}·${gx} = ${sig(nx, 4)}. Too large an η and the cell would overshoot the minimum and oscillate.`, 'x_new = x - η · ∂f/∂x.'),
      'gradient descent', idea,
      count('The slope in x, ∂f/∂x = 2a·x:', `2 × ${a} × ${x}`, gx),
      calc('Step downhill: x - η × slope:', `${x} - ${eta} × ${gx}`, nx, '', sig(nx, 4), 0.005));
  },
  (r, d) => {
    const idea = 'Current is charge per time, so the charge delivered is the AREA under the current-versus-time curve (the integral). Constant current: a rectangle, I × t. A linear ramp: a triangle, ½ × peak × t. A decaying exponential I₀·e^(-t/τ): its total area from 0 to ∞ is I₀ × τ. Units: mA × µs = nC, mA × ns = pC.';
    if (d === 1) {
      const I = pick(r, [2, 5, 10, 20]), t = pick(r, [3, 10, 50]);
      return walk(ask(`A constant ${I} mA flows into a capacitor for ${t} µs. How much charge arrives, in nC?`, qty(I * t, 'nC', 0.01), `Q = ∫ i dt = ${I} mA × ${t} µs = ${I * t} nC.`, 'Charge is the integral of current over time.'),
        'charge = area under the current', idea,
        calc('A rectangle: current × time (mA × µs = nC):', `${I} × ${t}`, I * t, 'nC', String(I * t), 0.01));
    }
    if (d === 2) {
      const Ip = pick(r, [10, 40, 100]), t = pick(r, [2, 4, 10]);
      return walk(ask(`A supply current ramps linearly from 0 to ${Ip} mA over ${t} ns, then stops. How much charge was drawn, in pC?`, qty((Ip * t) / 2, 'pC', 0.01), `The area of a triangle: ½ × ${Ip} mA × ${t} ns = ${(Ip * t) / 2} pC.`, 'The integral of a linear ramp is the triangle under it.'),
        'charge = area under the current', idea,
        choice('The current rises in a straight line from 0. The shape under it is:', 'A triangle', ['A rectangle', 'A semicircle']),
        calc('Triangle area, ½ × height × base (mA × ns = pC):', `0.5 × ${Ip} × ${t}`, (Ip * t) / 2, 'pC', String((Ip * t) / 2), 0.01));
    }
    const I0 = pick(r, [5, 20, 50]), tau = pick(r, [2, 3, 8]);
    return walk(ask(`A discharge current decays as i(t) = ${I0} mA · e^(-t/${tau} ns). How much total charge flows from t = 0 to ∞, in pC?`, qty(I0 * tau, 'pC', 0.01), `∫₀^∞ I₀e^(-t/τ) dt = I₀·τ = ${I0} mA × ${tau} ns = ${I0 * tau} pC. The capacitor held exactly this charge before it discharged.`, '∫ e^(-t/τ) dt from 0 to ∞ is τ.'),
      'integral of an exponential', idea,
      choice('∫₀^∞ e^(-t/τ) dt equals:', 'τ', ['1', '1/τ']),
      calc('So the charge is I₀ × τ (mA × ns = pC):', `${I0} × ${tau}`, I0 * tau, 'pC', String(I0 * tau), 0.01));
  },
  (r, d) => {
    const idea = 'At a minimum the slope is zero. Differentiate, set the derivative to 0, and solve. For a·x + b/x, the derivative is a - b/x², which is zero at x = √(b/a). With a constraint (like x·y fixed), substitute it in first or use a Lagrange multiplier: at the optimum, the gradients of cost and constraint are parallel.';
    if (d < 3) {
      const a = pick(r, [1, 2, 4]), b = pick(r, tier(d, [16, 36, 64], [8, 18, 50], [8, 18, 50]));
      const x = Math.sqrt(b / a);
      return walk(ask(`Stage delay is modelled as ${a === 1 ? '' : a}x + ${b}/x, where x is a buffer size. Which x minimizes it?`, qty(x, '', 0.01, sig(x)), `d/dx = ${a} - ${b}/x² = 0 → x = √(${b}/${a}) = ${sig(x)}. The minimum delay there is 2√(${a}·${b}) = ${sig(2 * Math.sqrt(a * b))}.`, 'Set the derivative to zero.'),
        'set the derivative to zero', idea,
        choice(`The derivative of ${a === 1 ? '' : a}x + ${b}/x is:`, `${a} - ${b}/x²`, [`${a} + ${b}/x²`, `${a}x - ${b}`]),
        calc(`Set it to zero: x² = ${b}/${a}. Compute ${b}/${a}:`, `${b} / ${a}`, b / a, '', sig(b / a), 0.01),
        calc('Take the square root:', `√${sig(b / a)}`, x, '', sig(x), 0.01));
    }
    const k = pick(r, [16, 36, 100, 144]), a = pick(r, [1, 2, 4]), b = pick(r, [1, 4, 9]);
    const x = Math.sqrt((b * k) / a);
    return walk(ask(`Minimize cost ${a}x + ${b}y subject to x·y = ${k} (for example, width × length at fixed area). What x is optimal?`, qty(x, '', 0.01, sig(x)), `Lagrange: ∇(${a}x + ${b}y) = λ∇(xy) → ${a} = λy, ${b} = λx, so ${a}x = ${b}y. With xy = ${k}: x = √(${b}·${k}/${a}) = ${sig(x)}.`, 'At the optimum the gradients of cost and constraint are parallel.'),
      'optimize under a constraint', idea,
      choice(`Substitute y = ${k}/x. The cost becomes ${a}x + ${b * k}/x. Setting its derivative to 0 gives x² =`, `${b * k}/${a}`, [`${a}/${b * k}`, `${k}`]),
      calc(`Compute ${b}·${k}/${a}:`, `${b * k} / ${a}`, (b * k) / a, '', sig((b * k) / a), 0.01),
      calc('Square root:', `√${sig((b * k) / a)}`, x, '', sig(x), 0.01));
  },
  (r, d) => {
    const a = between(r, 1, 5), b = between(r, 1, 5), c = between(r, 1, 5);
    const idea = 'Divergence ∇·F = ∂Fx/∂x + ∂Fy/∂y + ∂Fz/∂z measures how much a field spreads out from a point. Curl measures rotation; its z-part is ∂Fy/∂x - ∂Fx/∂y. The divergence theorem says the total flux out of a closed surface equals the divergence integrated over the volume inside.';
    if (d === 1) return walk(ask(`F = (${a}x, ${b}y, ${c}z). What is ∇·F?`, num(a + b + c), `∇·F = ${a} + ${b} + ${c} = ${a + b + c}.`, 'Sum ∂Fx/∂x + ∂Fy/∂y + ∂Fz/∂z.'),
      'divergence', idea,
      count(`∂(${a}x)/∂x =`, `d/dx of ${a}x`, a),
      count('Add the three partials:', `${a} + ${b} + ${c}`, a + b + c));
    if (d === 2) return walk(ask(`F = (${a}y, ${b}x, 0). What is the z-component of ∇×F?`, num(b - a), `(∇×F)_z = ∂Fy/∂x - ∂Fx/∂y = ${b} - ${a} = ${b - a}.`, '(∇×F)z = ∂Fy/∂x - ∂Fx/∂y.'),
      'curl', idea,
      count(`∂Fy/∂x = ∂(${b}x)/∂x =`, `d/dx of ${b}x`, b),
      count(`∂Fx/∂y = ∂(${a}y)/∂y =`, `d/dy of ${a}y`, a),
      count('Subtract:', `${b} - ${a}`, b - a));
    const L = between(r, 1, 3);
    return walk(ask(`F = (${a}x, ${b}y, ${c}z). By the divergence theorem, what is the total outward flux of F through the surface of a cube of side ${L} (any position)?`, num((a + b + c) * L ** 3), `∯F·dA = ∭(∇·F) dV = ${a + b + c} × ${L}³ = ${(a + b + c) * L ** 3}. Gauss's law for charge works exactly this way.`, 'Flux out = integral of the divergence over the volume.'),
      'the divergence theorem', idea,
      count('∇·F:', `${a} + ${b} + ${c}`, a + b + c),
      count('It is constant, so integrating over the cube is divergence × volume:', `${a + b + c} × ${L}³`, (a + b + c) * L ** 3));
  },
  (r, d) => {
    if (d === 1) {
      const x = pick(r, [0.01, 0.02, 0.05]);
      return walk(ask(`Linearize: e^(-x) ≈ 1 - x for small x. Estimate e^(-${x}) to 3 decimals.`, qty(1 - x, '', 0.001, String(1 - x)), `e^(-${x}) ≈ 1 - ${x} = ${1 - x} (true: ${Math.exp(-x).toFixed(5)}). First-order Taylor expansions are how engineers do mental math.`, 'Drop the x² term.'),
        'first-order Taylor expansion', 'Near a point, any smooth function looks like a straight line: f(x) ≈ f(0) + f\'(0)·x. For e^(-x), f(0) = 1 and the slope is -1, so e^(-x) ≈ 1 - x. The error is about x²/2, tiny for small x.',
        calc('Plug in:', `1 - ${x}`, 1 - x, '', String(1 - x), 0.001));
    }
    const V = pick(r, [0.8, 0.9, 1.0]), vt = 0.3, a = 1.3, dv = pick(r, [-0.05, 0.05, -0.03]);
    // delay ∝ V / (V - Vt)^a ; d ln(delay)/dV = 1/V - a/(V - Vt)
    const s = 1 / V - a / (V - vt);
    const pct = s * dv * 100;
    return walk(ask(`Gate delay ∝ V/(V - ${vt})^${a}. At V = ${V} V, the supply ${dv < 0 ? 'drops' : 'rises'} by ${Math.abs(dv * 1000)} mV. To first order, by what % does delay change? (negative = faster)`, qty(pct, '%', 0.04, `${pct.toFixed(1)}%`), `d(ln delay)/dV = 1/V - ${a}/(V - ${vt}) = ${s.toFixed(3)} per volt; × ${dv} V = ${pct.toFixed(1)}%. This sensitivity is why IR drop shows up directly as timing loss.`, 'Log-differentiate: 1/V - α/(V - Vt), times ΔV.'),
      'log-differentiation', 'For a product of powers, the RELATIVE change is easiest: take ln and differentiate. ln(delay) = ln V - α·ln(V - Vt), so d(ln delay)/dV = 1/V - α/(V - Vt). Multiply that sensitivity by ΔV (in volts) to get the relative change; × 100 for percent.',
      calc('First term, 1/V:', `1 / ${V}`, 1 / V, '', sig(1 / V, 4), 0.005),
      calc(`Second term, α/(V - Vt):`, `${a} / (${V} - ${vt})`, a / (V - vt), '', sig(a / (V - vt), 4), 0.005),
      calc('The sensitivity, first minus second (per volt):', `${sig(1 / V, 4)} - ${sig(a / (V - vt), 4)}`, s, '', sig(s, 4), 0.005),
      calc('Times ΔV, times 100 for %:', `${sig(s, 4)} × ${dv} × 100`, pct, '%', pct.toFixed(1), 0.04));
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
    const det = a * c - b * b;
    return walk(ask(`Solve G·v = i with G = ${mat([[a, b], [b, c]])} and i = [${i1}, ${i2}]. What is v${which}?`, num(which === 1 ? v1 : v2), `Cramer: det = ${a}·${c} - ${b * b} = ${a * c - b * b}; v1 = (${i1}·${c} - ${b}·${i2})/det = ${v1}, v2 = (${a}·${i2} - ${b}·${i1})/det = ${v2}.`, 'Cramer\'s rule, or eliminate one unknown.'),
      "Cramer's rule", `For a 2×2 system [[a, b], [c, d]]·v = [p, q], the solution is v1 = (p·d - b·q)/det and v2 = (a·q - p·c)/det, where det = a·d - b·c. You replace the column of the unknown you want with the right-hand side, take that determinant, and divide.`,
      count('The determinant, a·d - b·c:', `${a}×${c} - (${b})×(${b})`, det),
      which === 1
        ? count('Replace column 1 with i and take the determinant:', `${i1}×${c} - (${b})×${i2}`, i1 * c - b * i2)
        : count('Replace column 2 with i and take the determinant:', `${a}×${i2} - ${i1}×(${b})`, a * i2 - i1 * b),
      count('Divide by det:', `${which === 1 ? i1 * c - b * i2 : a * i2 - i1 * b} / ${det}`, which === 1 ? v1 : v2));
  },
  (r, d) => {
    if (d === 1) {
      const m = [[between(r, -4, 6), between(r, -4, 6)], [between(r, -4, 6), between(r, -4, 6)]];
      return walk(ask(`det ${mat(m)} = ?`, num(m[0][0] * m[1][1] - m[0][1] * m[1][0]), `ad - bc = ${m[0][0]}·${m[1][1]} - ${m[0][1]}·${m[1][0]} = ${m[0][0] * m[1][1] - m[0][1] * m[1][0]}.`, 'ad - bc.'),
        '2×2 determinant', 'For [[a, b], [c, d]] the determinant is a·d - b·c: the main diagonal product minus the other diagonal product.',
        count('Main diagonal, a·d:', `${m[0][0]} × ${m[1][1]}`, m[0][0] * m[1][1]),
        count('Other diagonal, b·c:', `${m[0][1]} × ${m[1][0]}`, m[0][1] * m[1][0]),
        count('Subtract:', `${m[0][0] * m[1][1]} - (${m[0][1] * m[1][0]})`, m[0][0] * m[1][1] - m[0][1] * m[1][0]));
    }
    if (d === 2) {
      const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => between(r, -2, 3)));
      const c0 = m[1][1] * m[2][2] - m[1][2] * m[2][1], c1 = m[1][0] * m[2][2] - m[1][2] * m[2][0], c2 = m[1][0] * m[2][1] - m[1][1] * m[2][0];
      return walk(ask(`det ${mat(m)} = ?`, num(det3(m)), `Expand along the first row: ${m[0][0]}·(${c0}) - ${m[0][1]}·(${c1}) + ${m[0][2]}·(${c2}) = ${det3(m)}.`, 'Cofactor expansion along row 1.'),
        'cofactor expansion', 'Expand along the first row: each entry times the 2×2 determinant left when you delete its row and column, with signs + - +. det = a·(ei - fh) - b·(di - fg) + c·(dh - eg) for [[a,b,c],[d,e,f],[g,h,i]].',
        count(`Minor for ${m[0][0]} (delete row 1, column 1):`, `${m[1][1]}×${m[2][2]} - ${m[1][2]}×${m[2][1]}`, c0),
        count(`Minor for ${m[0][1]} (delete row 1, column 2):`, `${m[1][0]}×${m[2][2]} - ${m[1][2]}×${m[2][0]}`, c1),
        count(`Minor for ${m[0][2]} (delete row 1, column 3):`, `${m[1][0]}×${m[2][1]} - ${m[1][1]}×${m[2][0]}`, c2),
        count('Combine with signs + - +:', `${m[0][0]}×${c0} - ${m[0][1]}×${c1} + ${m[0][2]}×${c2}`, det3(m)));
    }
    const a = between(r, 2, 6), b = between(r, 1, 4), c = between(r, 1, 4);
    // det [[a, b], [c, k]] = 0 → k = b c / a ; pick values so it is an integer
    const k = b * c;
    return walk(ask(`For which k is [[${a}, ${a * b}], [${c}, k]] singular (a SPICE "singular matrix")?`, num(k), `det = ${a}·k - ${b * a}·${c} = 0 → k = ${b * a * c}/${a} = ${k}. Then row 2 is a multiple of row 1: the equations are not independent.`, 'Set the determinant to zero and solve for k.'),
      'singular means determinant zero', 'A matrix is singular (no unique solution) exactly when its determinant is 0. Write the determinant with the unknown in it, set it to zero, and solve.',
      count(`det = ${a}·k - ${a * b}·${c}. The constant part, ${a * b}×${c}:`, `${a * b} × ${c}`, a * b * c),
      count(`Set ${a}·k - ${a * b * c} = 0 and solve for k:`, `${a * b * c} / ${a}`, k));
  },
  (r, d) => {
    const idea = 'An eigenvalue λ of A is a number with A·v = λ·v for some vector v. Shortcuts: a triangular matrix has its eigenvalues on the diagonal. For any 2×2 matrix, the eigenvalues add up to the trace (sum of the diagonal) and multiply to the determinant, so they solve λ² - trace·λ + det = 0.';
    if (d === 1) {
      const a = between(r, -5, 6), b = between(r, -5, 6), c = between(r, -3, 3);
      return walk(ask(`What is the largest eigenvalue of the triangular matrix ${mat([[a, c], [0, b]])}?`, num(Math.max(a, b)), `A triangular matrix has its eigenvalues on the diagonal: ${a} and ${b}.`, 'Look at the diagonal.'),
        'eigenvalues of a triangular matrix', idea,
        choice('The eigenvalues of a triangular matrix are:', 'The diagonal entries', ['The off-diagonal entries', 'The row sums']),
        step(`The diagonal is ${a} and ${b}. The largest:`, num(Math.max(a, b))));
    }
    if (d === 2) {
      const a = between(r, 2, 7), b = between(r, 1, a - 1);
      return walk(ask(`What is the smallest eigenvalue of ${mat([[a, b], [b, a]])}?`, num(a - b), `Eigenvectors (1, 1) and (1, -1): λ = ${a} ± ${b}, so ${a + b} and ${a - b}.`, 'Try (1, 1) and (1, -1).'),
        'eigenvalues from trace and determinant', idea,
        count('The trace (sum of the diagonal):', `${a} + ${a}`, 2 * a),
        count('The determinant:', `${a}×${a} - ${b}×${b}`, a * a - b * b),
        `Two numbers that add to ${2 * a} and multiply to ${a * a - b * b}: ${a + b} and ${a - b}. (For this symmetric pattern they are always a ± b.)`,
        step('The smallest eigenvalue:', num(a - b)));
    }
    // A = P D P^-1 with P = [[1,1],[1,2]], P^-1 = [[2,-1],[-1,1]]
    const l1 = between(r, -4, 5), l2 = between(r, -4, 5);
    const A = [[2 * l1 - l2, -l1 + l2], [2 * l1 - 2 * l2, -l1 + 2 * l2]];
    return walk(ask(`What is the largest eigenvalue of ${mat(A)}?`, num(Math.max(l1, l2)), `trace = ${l1 + l2}, det = ${l1 * l2}, so λ² - ${l1 + l2}λ + ${l1 * l2} = 0 → λ = ${l1}, ${l2}.`, 'λ² - (trace)λ + det = 0.'),
      'eigenvalues from trace and determinant', idea,
      count('The trace (sum of the diagonal):', `${A[0][0]} + ${A[1][1]}`, l1 + l2),
      count('The determinant, a·d - b·c:', `${A[0][0]}×${A[1][1]} - ${A[0][1]}×${A[1][0]}`, l1 * l2),
      `Find two numbers that add to ${l1 + l2} and multiply to ${l1 * l2} (or use the quadratic formula on λ² - ${l1 + l2}λ + ${l1 * l2} = 0).`,
      step('The larger of the two:', num(Math.max(l1, l2))));
  },
  (r, d) => {
    const R1 = pick(r, [1, 2, 4, 5]), R2 = pick(r, [1, 2, 4, 5]), R3 = pick(r, [1, 2, 5, 10]);
    const g = (x: number) => 1 / x;
    const idea = 'Nodal analysis writes G·v = i. Each resistor is "stamped" into G: its conductance 1/R is ADDED to the diagonal entry of each node it touches, and SUBTRACTED from the off-diagonal entry linking its two nodes. A resistor to ground only touches one diagonal. With R in kΩ, conductances are in mS.';
    if (d === 1) return walk(ask(`Node 1 connects to ground through ${R1} kΩ and to node 2 through ${R2} kΩ. In nodal analysis, what is G₁₁ (the diagonal entry for node 1), in mS?`, qty(g(R1) + g(R2), 'mS', 0.01), `G₁₁ is the sum of all conductances touching node 1: 1/${R1} + 1/${R2} = ${sig(g(R1) + g(R2))} mS.`, 'Diagonal = sum of conductances at that node.'),
      'stamping a conductance matrix', idea,
      calc('Add the conductances of every resistor touching node 1 (mS):', `1/${R1} + 1/${R2}`, g(R1) + g(R2), 'mS', sig(g(R1) + g(R2)), 0.01));
    if (d === 2) return walk(ask(`Node 1 connects to ground through ${R1} kΩ and to node 2 through ${R2} kΩ; node 2 connects to ground through ${R3} kΩ. What is G₁₂, in mS?`, qty(-g(R2), 'mS', 0.01), `Off-diagonal entries are minus the conductance between the two nodes: -1/${R2} = ${sig(-g(R2))} mS. G is symmetric for resistor networks.`, 'Off-diagonal = minus the conductance joining the nodes.'),
      'stamping a conductance matrix', idea,
      choice('Which resistor links node 1 and node 2?', `The ${R2} kΩ between node 1 and node 2`, [`The ${R1} kΩ from node 1 to ground`, `The ${R3} kΩ from node 2 to ground`]),
      calc('G₁₂ is minus its conductance (mS):', `-1/${R2}`, -g(R2), 'mS', sig(-g(R2)), 0.01));
    const I = pick(r, [1, 2, 3]);
    const G = [[g(R1) + g(R2), -g(R2)], [-g(R2), g(R2) + g(R3)]];
    const dt = G[0][0] * G[1][1] - G[0][1] * G[1][0];
    const v1 = (I * G[1][1]) / dt;
    return walk(ask(`${I} mA is injected into node 1. Node 1 → ground: ${R1} kΩ; node 1 → node 2: ${R2} kΩ; node 2 → ground: ${R3} kΩ. Build G and solve: V1 in volts?`, qty(v1, 'V', 0.01), `G = ${mat(G.map((row) => row.map((x) => +x.toFixed(3))))} mS, i = [${I}, 0] mA. V1 = ${I}·G₂₂/det = ${sig(v1)} V. (Check: ${R1} ∥ (${R2} + ${R3}) kΩ × ${I} mA = ${sig((I * R1 * (R2 + R3)) / (R1 + R2 + R3))} V.)`, 'Stamp each resistor, then solve the 2×2 system.'),
      'build G, then solve', idea,
      calc('G₁₁ = 1/R1 + 1/R2 (mS):', `1/${R1} + 1/${R2}`, G[0][0], 'mS', sig(G[0][0], 4), 0.005),
      calc('G₂₂ = 1/R2 + 1/R3 (mS):', `1/${R2} + 1/${R3}`, G[1][1], 'mS', sig(G[1][1], 4), 0.005),
      calc('det = G₁₁·G₂₂ - G₁₂² (with G₁₂ = -1/R2):', `${sig(G[0][0], 4)}×${sig(G[1][1], 4)} - (1/${R2})²`, dt, '', sig(dt, 4), 0.005),
      calc(`With i = [${I}, 0], Cramer gives V1 = I·G₂₂ / det:`, `${I} × ${sig(G[1][1], 4)} / ${sig(dt, 4)}`, v1, 'V', sig(v1), 0.01));
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
    return walk(ask(`What is the rank of ${mat(rows)}?`, num(rk), rk === 1 ? 'Every row is a multiple of one row: rank 1.' : rk === 2 ? `det = 0 but two rows are independent${kind === 2 ? ` (row 3 = ${a}·row1 ${b < 0 ? '-' : '+'} ${Math.abs(b)}·row2)` : ''}: rank 2.` : `det = ${det3(rows)} ≠ 0, so all three rows are independent: rank 3.`, 'Look for rows that are combinations of others, or compute the determinant.'),
      'count the independent rows', 'The rank is the number of rows that are not combinations of the others. Test: if the 3×3 determinant is not 0, all three rows are independent (rank 3). If it is 0, check whether all rows are multiples of one row (rank 1) or not (rank 2).',
      count('The determinant (cofactor expansion along row 1):', 'det', det3(rows)),
      det3(rows) === 0 && choice('det = 0, so the rank is below 3. Are all the rows multiples of a single row?', rk === 1 ? 'Yes' : 'No', [rk === 1 ? 'No' : 'Yes'], kind === 2 ? `Row 3 = ${a}·row1 ${b < 0 ? '-' : '+'} ${Math.abs(b)}·row2, but rows 1 and 2 are independent.` : kind === 1 ? 'Row 2 = 2 × row 1 and row 3 = -1 × row 1.' : undefined),
      step('So the rank is:', num(rk)));
  },
  (r, d) => {
    const n = tier(d, 2, 2, 3);
    const eig = Array.from({ length: n }, () => pick(r, [-3, -2, -1, -0.5, 0.5, 1, 2]));
    const stable = eig.every((x) => x < 0);
    const A = n === 2 ? [[eig[0], between(r, -3, 3)], [0, eig[1]]] : [[eig[0], 1, between(r, -2, 2)], [0, eig[1], 2], [0, 0, eig[2]]];
    return walk(mc(`A regulator loop is modelled as dx/dt = A·x with A = ${mat(A)}. Is it stable?`, ['Stable: every mode decays', 'Unstable: some mode grows'], stable ? 0 : 1, `A is triangular, so its eigenvalues are the diagonal: ${eig.join(', ')}. ${stable ? 'All negative: every mode e^(λt) decays.' : 'A positive eigenvalue means a mode e^(λt) grows without bound.'}`),
      'stability from eigenvalues', 'The solution of dx/dt = A·x is a mix of modes e^(λt), one per eigenvalue λ of A. A negative λ decays to zero; a positive λ grows forever. The system is stable only if EVERY eigenvalue is negative. A is triangular here, so the eigenvalues are just its diagonal.',
      choice('Where are the eigenvalues of this triangular A?', 'On the diagonal', ['In the first row', 'In the last column']),
      choice(`The diagonal is ${eig.join(', ')}. Are they all negative?`, stable ? 'Yes' : 'No', [stable ? 'No' : 'Yes']));
  },
]);

// ------------------------------------------------------------------ differential equations

const firstOrder = 'Every first-order circuit (one R, one C, or one L) moves exponentially from where it starts toward where it is heading: v(t) = V_final + (V_start - V_final)·e^(-t/τ). The term e^(-t/τ) is the fraction of the gap still left after time t.';

export const odePractice = practice('practice-ode', 'Transient Drills', 'RC/RLC transients, damping, diffusion', [
  (r, d) => {
    const Vf = pick(r, [1, 1.8, 3.3]), tau = pick(r, [1, 2, 5]);
    const t = d === 1 ? tau * pick(r, [1, 2, 3]) : +(tau * pick(r, [0.3, 0.7, 1.5, 2.2])).toFixed(2);
    const V0 = d === 3 ? pick(r, [0.5, -0.5, Vf * 1.5]) : 0;
    const e = Math.exp(-t / tau);
    const v = Vf + (V0 - Vf) * e;
    return walk(ask(`A first-order node with τ = ${tau} ns starts at ${V0} V and heads toward ${Vf} V. What is v at t = ${t} ns?`, qty(v, 'V', 0.02, sig(v)), `v(t) = V∞ + (V₀ - V∞)e^(-t/τ) = ${Vf} + (${V0} - ${Vf})·e^(-${t}/${tau}) = ${sig(v)} V.`, 'v(t) = final + (initial - final)·e^(-t/τ).'),
      'the first-order step response', firstOrder,
      calc('The gap at the start, V_start - V_final:', `${V0} - ${Vf}`, V0 - Vf, 'V', sig(V0 - Vf), 0.01),
      calc('The fraction of the gap left at t, e^(-t/τ):', `e^(-${t}/${tau})`, e, '', sig(e)),
      calc('v = V_final + gap × fraction:', `${Vf} + (${sig(V0 - Vf)}) × ${sig(e)}`, v, 'V', sig(v), 0.02));
  },
  (r, d) => {
    const Vf = pick(r, [1, 1.2, 3.3]), tau = pick(r, [1, 4, 10]);
    const th = +(Vf * pick(r, [0.5, 0.9, 0.3])).toFixed(3);
    const V0 = d === 3 ? +(Vf * 0.2).toFixed(3) : 0;
    const ratio = (Vf - V0) / (Vf - th);
    const t = tau * Math.log(ratio);
    return walk(ask(`A ${tau} ns RC node charges from ${V0} V toward ${Vf} V. The next gate switches at ${th} V. How long until it switches, in ns?`, qty(t, 'ns', 0.02), `t = τ·ln((V∞ - V₀)/(V∞ - Vth)) = ${tau}·ln(${sig(Vf - V0)}/${sig(Vf - th)}) = ${sig(t)} ns.${th === +(Vf * 0.5).toFixed(3) && !V0 ? ' The 50% point is at 0.69τ: that is where "delay = 0.69RC" comes from.' : ''}`, 'Solve the exponential for t, with a natural log.'),
      'solve the step response for time', `${firstOrder} To find WHEN it crosses a level, compare the gap at the start with the gap remaining at that level: e^(-t/τ) = gap_then / gap_start, so t = τ·ln(gap_start / gap_then).`,
      calc('The gap at the start, V_final - V_start:', `${Vf} - ${V0}`, Vf - V0, 'V', sig(Vf - V0, 4), 0.005),
      calc('The gap left when it switches, V_final - V_threshold:', `${Vf} - ${th}`, Vf - th, 'V', sig(Vf - th, 4), 0.005),
      calc('ln of their ratio:', `ln(${sig(Vf - V0, 4)} / ${sig(Vf - th, 4)})`, Math.log(ratio), '', sig(Math.log(ratio))),
      calc('Times τ:', `${tau} × ${sig(Math.log(ratio))}`, t, 'ns', undefined, 0.02));
  },
  (r, d) => {
    const L = pick(r, [0.2, 0.5, 1, 2]) * 1e-9, C = pick(r, [10, 100, 470]) * 1e-9;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const idea = 'An RLC network is second order: it can ring. It resonates at f₀ = 1/(2π√(LC)), and its damping ratio for a series R is ζ = (R/2)·√(C/L). ζ < 1 rings, ζ = 1 is critically damped (fastest with no ringing), ζ > 1 is sluggish. √(L/C) is the network\'s characteristic impedance.';
    if (d === 1) return walk(ask(`L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. Resonant frequency f₀, in MHz?`, qty(f0 / 1e6, 'MHz'), `f₀ = 1/(2π√LC) = ${eng(f0, 'Hz')}.`, 'f₀ = 1/(2π√(LC)).'),
      'LC resonance', idea,
      calc('L × C:', `${L} × ${C}`, L * C, '', sig(L * C)),
      calc('2π × √(LC):', `2π × √${sig(L * C)}`, 2 * Math.PI * Math.sqrt(L * C), '', sig(2 * Math.PI * Math.sqrt(L * C))),
      calc('f₀ = 1 / that, in MHz:', `1 / ${sig(2 * Math.PI * Math.sqrt(L * C))} / 10^6`, f0 / 1e6, 'MHz'));
    const R = pick(r, [0.01, 0.05, 0.2, 1]);
    const z = (R / 2) * Math.sqrt(C / L);
    if (d === 2) return walk(ask(`Series RLC: R = ${R * 1000} mΩ, L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. What is the damping ratio ζ?`, qty(z, '', 0.02, sig(z)), `ζ = (R/2)·√(C/L) = ${sig(z)}. ${z < 1 ? 'Underdamped: the rail will ring.' : 'Overdamped: no ringing.'}`, 'ζ = (R/2)√(C/L).'),
      'damping ratio', idea,
      calc('√(C/L):', `√(${C} / ${L})`, Math.sqrt(C / L), '', sig(Math.sqrt(C / L))),
      calc(`ζ = (R/2) × that, with R = ${R} Ω:`, `${R / 2} × ${sig(Math.sqrt(C / L))}`, z, '', sig(z), 0.02));
    const Rc = 2 * Math.sqrt(L / C);
    return walk(ask(`L = ${eng(L, 'H')}, C = ${eng(C, 'F')}. What series R makes the network critically damped (ζ = 1), in mΩ?`, qty(Rc * 1000, 'mΩ', 0.02), `ζ = 1 → R = 2√(L/C) = ${eng(Rc, 'Ω')}. PDN designers often damp to R ≈ √(L/C) (Q ≈ 1) and size the network against Z_target = ΔV/ΔI.`, 'Solve ζ = (R/2)√(C/L) = 1 for R.'),
      'critical damping', idea,
      calc('Set ζ = 1 and solve: R = 2√(L/C). First √(L/C), in ohms:', `√(${L} / ${C})`, Math.sqrt(L / C), 'Ω', sig(Math.sqrt(L / C))),
      calc('R = 2 × that, in mΩ:', `2 × ${sig(Math.sqrt(L / C))} × 1000`, Rc * 1000, 'mΩ', undefined, 0.02));
  },
  (r, d) => {
    const idea = 'A second-order system\'s step response depends on its damping ratio ζ: below 1 it overshoots and rings (percent overshoot = e^(-πζ/√(1-ζ²))), exactly 1 is the fastest response without overshoot, above 1 it creeps up slowly. Its characteristic equation s² + a·s + b = 0 has roots that are the decay rates of its modes.';
    if (d === 1) {
      const z = pick(r, [0.1, 0.3, 0.7, 1, 1.5, 4]);
      const right = z < 1 ? 'Overshoots and rings' : z === 1 ? 'Fastest rise with no overshoot' : 'Slow rise, no overshoot';
      return walk(mcs(r, `A second-order step response has ζ = ${z}. What does it look like?`, right, ['Overshoots and rings', 'Fastest rise with no overshoot', 'Slow rise, no overshoot'].filter((o) => o !== right), `ζ < 1 rings, ζ = 1 is critical, ζ > 1 is sluggish. Here ζ = ${z}.`),
        'damping ratio', idea,
        choice(`Compare ζ = ${z} with 1:`, z < 1 ? 'Less than 1' : z === 1 ? 'Exactly 1' : 'More than 1', [z < 1 ? 'Exactly 1' : 'Less than 1', z > 1 ? 'Exactly 1' : 'More than 1']));
    }
    if (d === 2) {
      const p1 = between(r, 1, 5), p2 = between(r, p1 + 1, 8);
      return walk(ask(`The characteristic equation is s² + ${p1 + p2}s + ${p1 * p2} = 0. What is the slowest (least negative) root?`, num(-p1), `(s + ${p1})(s + ${p2}) = 0 → s = -${p1}, -${p2}. The slowest mode, e^(-${p1}t), sets the settling time.`, 'Factor the quadratic.'),
        'factor the characteristic equation', `${idea} To factor s² + a·s + b, find two numbers that multiply to b and add to a: (s + p)(s + q) = 0 gives roots -p and -q.`,
        `Look for two numbers that multiply to ${p1 * p2} and add to ${p1 + p2}.`,
        count('The smaller of the two numbers:', `p × q = ${p1 * p2}, p + q = ${p1 + p2}`, p1),
        step(`So the roots are -${p1} and -${p2}. The least negative (slowest) root:`, num(-p1)));
    }
    const z = pick(r, [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const ex = (-Math.PI * z) / Math.sqrt(1 - z * z);
    const os = Math.exp(ex) * 100;
    return walk(ask(`A supply loop has ζ = ${z}. What is the percent overshoot of its step response?`, qty(os, '%', 0.03, `${os.toFixed(1)}%`), `%OS = e^(-πζ/√(1-ζ²)) = ${os.toFixed(1)}%. (Q = 1/(2ζ) = ${sig(1 / (2 * z))}.)`, '%OS = exp(-πζ / √(1 - ζ²)).'),
      'percent overshoot', idea,
      calc('√(1 - ζ²):', `√(1 - ${z}²)`, Math.sqrt(1 - z * z), '', sig(Math.sqrt(1 - z * z), 4), 0.005),
      calc('The exponent, -π·ζ / that:', `-π × ${z} / ${sig(Math.sqrt(1 - z * z), 4)}`, ex, '', sig(ex, 4), 0.005),
      calc('e^(exponent) × 100 %:', `e^(${sig(ex, 4)}) × 100`, os, '%', os.toFixed(1), 0.03));
  },
  (r, d) => {
    const idea = 'Diffusion spreads things out with the square root of time: the typical distance travelled is the diffusion length L = √(D·t). Run twice as long and you go only √2 ≈ 1.41× as far.';
    if (d < 3) {
      const k = pick(r, tier(d, [4, 9, 16], [2, 3, 10], [2, 3, 10]));
      return walk(ask(`A diffusion step runs ${k}× longer. How many times deeper do the dopants go?`, qty(Math.sqrt(k), '', 0.01, sig(Math.sqrt(k))), `L ∝ √(Dt): √${k} = ${sig(Math.sqrt(k))}×.`, 'Diffusion length ∝ √(D·t).'),
        'diffusion length', idea,
        calc(`Depth scales as √(time), so the factor is √${k}:`, `√${k}`, Math.sqrt(k), '', sig(Math.sqrt(k)), 0.01));
    }
    const D = pick(r, [1e-14, 4e-14, 1e-13]), t = pick(r, [600, 1800, 3600]);
    const L = Math.sqrt(D * t) * 1e7; // cm → nm
    return walk(ask(`Boron with D = ${D} cm²/s anneals for ${t / 60} min. What is the diffusion length √(Dt), in nm?`, qty(L, 'nm', 0.02), `√(${D} × ${t}) = ${(Math.sqrt(D * t)).toExponential(2)} cm = ${sig(L)} nm. (1 cm = 10⁷ nm.)`, 'Compute √(D·t) in cm, then convert.'),
      'diffusion length', `${idea} With D in cm²/s and t in seconds, L comes out in cm; 1 cm = 10⁷ nm.`,
      count(`The time in seconds (${t / 60} min × 60):`, `${t / 60} × 60`, t),
      calc('D × t (cm²):', `${D} × ${t}`, D * t, '', sig(D * t)),
      calc('Square root, in cm:', `√${sig(D * t)}`, Math.sqrt(D * t), '', sig(Math.sqrt(D * t))),
      calc('Convert to nm (× 10⁷):', `${sig(Math.sqrt(D * t))} × 10^7`, L, 'nm', undefined, 0.02));
  },
  (r, d) => {
    const tau = pick(r, [1, 2, 5]);
    const e = pick(r, tier(d, [0.1], [0.01, 0.02], [0.001, 0.0001]));
    const t = tau * Math.log(1 / e);
    return walk(ask(`An exponential with τ = ${tau} µs must settle to within ${e * 100}% of its final value. How long, in µs?`, qty(t, 'us', 0.02), `e^(-t/τ) = ${e} → t = τ·ln(${1 / e}) = ${sig(t)} µs (${sig(Math.log(1 / e))} time constants). Data converters live by this: an N-bit ADC needs about (N+1)·ln2 time constants.`, 't = τ · ln(1/error).'),
      'settling time', `${firstOrder} Settled "within x%" means the remaining fraction e^(-t/τ) has fallen to x/100, so t = τ·ln(1/fraction).`,
      calc(`The allowed remaining fraction is ${e}. 1 / fraction:`, `1 / ${e}`, 1 / e, '', sig(1 / e), 0.001),
      calc('ln of that (the number of time constants):', `ln(${sig(1 / e)})`, Math.log(1 / e), '', sig(Math.log(1 / e))),
      calc('Times τ:', `${tau} × ${sig(Math.log(1 / e))}`, t, 'us', undefined, 0.02));
  },
]);

// ------------------------------------------------------------------ probability

const pct = (x: number, n = 2) => `${(x * 100).toFixed(n)}`;

export const probPractice = practice('practice-prob', 'Probability Drills', 'yield, sigma, Poisson, Bayes, coverage', [
  (r, d) => {
    const idea = 'Independent events multiply: the chance that ALL of them happen is the product of their chances. The chance something happens AT LEAST ONCE is easiest backwards: 1 - P(it never happens). "Exactly k out of n" uses the binomial: C(n, k)·p^k·(1-p)^(n-k).';
    if (d === 1) {
      const y = pick(r, [0.9, 0.95, 0.99]), n = between(r, 2, 6);
      return walk(ask(`${n} independent blocks each yield ${y * 100}%. Chip yield, in %?`, qty(y ** n * 100, '%', 0.01, `${(y ** n * 100).toFixed(2)}%`), `${y}^${n} = ${(y ** n * 100).toFixed(2)}%.`, 'Independent: multiply.'),
        'independent events multiply', idea,
        choice('The chip works only if every block works. With independent blocks you:', 'Multiply the yields', ['Add the yields', 'Take the smallest yield']),
        calc(`${y} multiplied by itself ${n} times, as a %:`, `${y}^${n} × 100`, y ** n * 100, '%', pct(y ** n), 0.01));
    }
    if (d === 2) {
      const p = pick(r, [0.01, 0.001]), n = pick(r, [100, 500, 1000]);
      const q = 1 - (1 - p) ** n;
      return walk(ask(`A glitch occurs on ${p * 100}% of power-ups. Over ${n} power-ups, what is the chance of seeing it at least once, in %?`, qty(q * 100, '%', 0.01, `${(q * 100).toFixed(1)}%`), `1 - (1 - ${p})^${n} = ${(q * 100).toFixed(1)}%.`, 'P(at least once) = 1 - P(never).'),
        'at least once = 1 - never', idea,
        calc('Chance it does NOT happen on one power-up:', `1 - ${p}`, 1 - p, '', String(1 - p), 0.0001),
        calc(`Chance it never happens in ${n} tries (multiply ${n} times):`, `${1 - p}^${n}`, (1 - p) ** n, '', sig((1 - p) ** n, 4), 0.005),
        calc('At least once = 1 - never, as a %:', `(1 - ${sig((1 - p) ** n, 4)}) × 100`, q * 100, '%', pct(q, 1), 0.01));
    }
    const n = pick(r, [64, 128, 256]), p = pick(r, [1e-3, 5e-3, 1e-2]);
    const p0 = (1 - p) ** n, p1 = n * p * (1 - p) ** (n - 1);
    return walk(ask(`A memory row has ${n} cells, each failing independently with p = ${p}. One spare cell can repair a single failure. What is the row's yield with repair, in %?`, qty((p0 + p1) * 100, '%', 0.01, `${((p0 + p1) * 100).toFixed(2)}%`), `P(0 fails) + P(1 fail) = (1-p)^${n} + ${n}p(1-p)^${n - 1} = ${(p0 * 100).toFixed(2)}% + ${(p1 * 100).toFixed(2)}% = ${((p0 + p1) * 100).toFixed(2)}%. Without the spare it would be only ${(p0 * 100).toFixed(2)}%: redundancy is how big memories yield.`, 'Binomial: add the probabilities of 0 and exactly 1 failures.'),
      'the binomial distribution', `${idea} With one spare, the row is good if 0 OR exactly 1 cell fails: add those two probabilities.`,
      calc('P(no failures) = (1-p)^n, as a %:', `(1 - ${p})^${n} × 100`, p0 * 100, '%', pct(p0), 0.005),
      calc(`P(exactly one) = n·p·(1-p)^(n-1): ${n} choices of which cell fails, as a %:`, `${n} × ${p} × (1 - ${p})^${n - 1} × 100`, p1 * 100, '%', pct(p1), 0.005),
      calc('Add them:', `${pct(p0)} + ${pct(p1)}`, (p0 + p1) * 100, '%', pct(p0 + p1), 0.01));
  },
  (r, d) => {
    const idea = 'A normal (Gaussian) distribution is described by its mean μ and spread σ. Distances are measured in σ: z = (x - μ)/σ. Useful facts: ±1σ holds 68.27%, ±2σ 95.45%, ±3σ 99.73%. The one-sided tail beyond +z (the fraction ABOVE a limit) is 1 - Φ(z), which you read from a table.';
    if (d === 1) {
      const k = pick(r, [1, 2, 3]);
      const v = [68.27, 95.45, 99.73][k - 1];
      return walk(ask(`What fraction of a normal distribution lies within ±${k}σ of the mean, in %?`, qty(v, '%', 0.005), `68.27 / 95.45 / 99.73% for 1 / 2 / 3σ.`, 'The 68-95-99.7 rule.'),
        'the 68-95-99.7 rule', idea,
        show('±1σ: 68.27%\n±2σ: 95.45%\n±3σ: 99.73%', 'worth memorizing'),
        calc(`So for ±${k}σ:`, `within ±${k}σ`, v, '%', String(v), 0.005));
    }
    const mu = pick(r, [400, 500, 800]), s = pick(r, [10, 20, 25]);
    const z = d === 2 ? pick(r, [1, 2, 3]) : pick(r, [1.5, 2.5, 3.5, 4]);
    const tl = tail(z) * 100;
    return walk(ask(`Path delay is normal with μ = ${mu} ps, σ = ${s} ps. The clock allows ${mu + z * s} ps. What % of chips fail timing?`, qty(tl, '%', 0.03, `${sig(tl)}%`), `The limit is (${mu + z * s} - ${mu})/${s} = ${z}σ above the mean. One-sided tail: 1 - Φ(${z}) = ${sig(tl)}%.`, 'Compute z = (limit - μ)/σ, then the one-sided tail.'),
      'z-score and tail', idea,
      calc('How many σ above the mean is the limit? z = (limit - μ)/σ:', `(${mu + z * s} - ${mu}) / ${s}`, z, '', String(z), 0.001),
      choice('Chips fail when they are SLOWER than the limit. Which part of the distribution is that?', 'The tail above +z (one side only)', ['Everything within ±z', 'The tail below -z', 'Both tails together'], 'Slower than the limit means above it, and only one side counts.'),
      show([1, 1.5, 2, 2.5, 3, 3.5, 4].map((x) => `z = ${x}: ${sig(tail(x) * 100)}%`).join('\n'), 'one-sided tail above +z'),
      calc(`Only chips slower than the limit fail, so read the one-sided tail at z = ${z}:`, `tail(${z})`, tl, '%', sig(tl), 0.03));
  },
  (r, d) => {
    const srcs = Array.from({ length: tier(d, 2, 3, 3) }, () => pick(r, [2, 3, 4, 5, 6, 8, 12]));
    const sq = srcs.reduce((a, x) => a + x * x, 0);
    const rss = Math.sqrt(sq);
    const idea = 'Independent random effects do not add directly: their VARIANCES (σ²) add. So the total rms is the root-sum-square, √(σ₁² + σ₂² + ...). Deterministic (bounded, non-random) effects add linearly. For a bit error rate target, random jitter counts as Q × σ, with Q ≈ 14 at 1e-12.';
    const rssSteps = [
      count('Square each source and add:', srcs.map((x) => `${x}²`).join(' + '), sq),
      calc('Square root:', `√${sq}`, rss, 'ps', sig(rss), 0.02),
    ];
    if (d < 3) return walk(ask(`Independent random jitter sources of ${srcs.join(', ')} ps rms. Total rms jitter, in ps?`, qty(rss, 'ps', 0.02, sig(rss)), `√(${srcs.map((x) => `${x}²`).join(' + ')}) = ${sig(rss)} ps.`, 'Independent variances add.'),
      'root-sum-square', idea, ...rssSteps);
    const dj = pick(r, [5, 10, 20]), ber = pick(r, [[14.07, '1e-12'], [12.72, '1e-10']] as const);
    const tj = dj + ber[0] * rss;
    return walk(ask(`A SerDes link has ${dj} ps of deterministic jitter and random sources of ${srcs.join(', ')} ps rms. At a BER of ${ber[1]} the random part counts as ${ber[0]}σ. Total jitter, in ps?`, qty(tj, 'ps', 0.02), `RJ = √(${srcs.map((x) => `${x}²`).join(' + ')}) = ${sig(rss)} ps. TJ = DJ + ${ber[0]}·RJ = ${dj} + ${sig(ber[0] * rss)} = ${sig(tj)} ps. Deterministic jitter adds linearly; random adds in quadrature.`, 'TJ = DJ + Q·RJ, where RJ is the root-sum-square.'),
      'total jitter', idea, ...rssSteps,
      calc(`The random part at this BER, ${ber[0]} × RJ:`, `${ber[0]} × ${sig(rss)}`, ber[0] * rss, 'ps'),
      calc('Add the deterministic part:', `${dj} + ${sig(ber[0] * rss)}`, tj, 'ps', undefined, 0.02));
  },
  (r, d) => {
    const idea = 'Random, independent defects landing on a die follow a Poisson distribution: if λ defects are expected per die, the chance of ZERO defects (a working die) is e^(-λ). λ is defect density × area. Going backwards, the area for a target yield Y is A = -ln(Y)/D₀.';
    if (d === 1) {
      const lam = pick(r, [0.1, 0.2, 0.5]);
      return walk(ask(`λ = ${lam} defects per die on average. Yield (zero defects), in %?`, qty(Math.exp(-lam) * 100, '%', 0.01, `${(Math.exp(-lam) * 100).toFixed(1)}%`), `e^(-${lam}) = ${(Math.exp(-lam) * 100).toFixed(1)}%.`, 'Poisson: P(0) = e^(-λ).'),
        'Poisson yield', idea,
        calc('P(0 defects) = e^(-λ), as a %:', `e^(-${lam}) × 100`, Math.exp(-lam) * 100, '%', pct(Math.exp(-lam), 1), 0.01));
    }
    const D0 = pick(r, [0.05, 0.1, 0.2]); // per cm²
    if (d === 2) {
      const A = pick(r, [1, 2, 4, 6]);
      return walk(ask(`Defect density D₀ = ${D0}/cm². A die is ${A} cm². Poisson yield, in %?`, qty(Math.exp(-D0 * A) * 100, '%', 0.01, `${(Math.exp(-D0 * A) * 100).toFixed(1)}%`), `λ = D₀·A = ${sig(D0 * A)}; Y = e^(-λ) = ${(Math.exp(-D0 * A) * 100).toFixed(1)}%. Bigger dies yield worse, exponentially: one reason for chiplets.`, 'λ = D₀ × area.'),
        'Poisson yield', idea,
        calc('Expected defects per die, λ = D₀ × A:', `${D0} × ${A}`, D0 * A, '', sig(D0 * A), 0.001),
        calc('Yield = e^(-λ), as a %:', `e^(-${sig(D0 * A)}) × 100`, Math.exp(-D0 * A) * 100, '%', pct(Math.exp(-D0 * A), 1), 0.01));
    }
    const Y = pick(r, [0.8, 0.9, 0.7]);
    const A = -Math.log(Y) / D0;
    return walk(ask(`D₀ = ${D0}/cm². What is the largest die area that still yields ${Y * 100}%, in cm²?`, qty(A, 'cm²', 0.02, sig(A)), `e^(-D₀A) = ${Y} → A = -ln(${Y})/${D0} = ${sig(A)} cm² (${sig(A * 100)} mm²).`, 'Solve e^(-D₀A) = Y for A.'),
      'solve Poisson yield for area', idea,
      calc(`-ln(${Y}):`, `-ln(${Y})`, -Math.log(Y), '', sig(-Math.log(Y))),
      calc('Divide by D₀ to get the area (cm²):', `${sig(-Math.log(Y))} / ${D0}`, A, '', sig(A), 0.02));
  },
  (r, d) => {
    const prior = pick(r, tier(d, [0.1, 0.2], [0.01, 0.05], [0.001, 0.005])), det = pick(r, [0.9, 0.99]), fa = pick(r, [0.01, 0.05]);
    const tp = det * prior, fp = fa * (1 - prior);
    const post = tp / (tp + fp);
    return walk(ask(`${prior * 100}% of dies have a latent defect. A stress test flags ${det * 100}% of defective dies and ${fa * 100}% of good ones. A die is flagged. Chance it is defective, in %?`, qty(post * 100, '%', 0.03, `${sig(post * 100)}%`), `P(flag) = ${det}·${prior} + ${fa}·${sig(1 - prior)} = ${sig(det * prior + fa * (1 - prior))}; P(defect | flag) = ${sig(det * prior)}/${sig(det * prior + fa * (1 - prior))} = ${sig(post * 100)}%. When the prior is small, false alarms dominate.`, 'Bayes: P(defect)·P(flag|defect) / P(flag).'),
      "Bayes' rule", 'Among all FLAGGED dies, what share is really defective? Flags come from two groups: defective dies that are caught (true alarms) and good dies flagged by mistake (false alarms). The answer is true alarms / all alarms. Thinking of 1,000,000 dies makes it concrete.',
      calc('True alarms: fraction defective × detection rate:', `${prior} × ${det}`, tp, '', sig(tp, 4), 0.005),
      calc('False alarms: fraction good × false-alarm rate:', `${sig(1 - prior, 4)} × ${fa}`, fp, '', sig(fp, 4), 0.005),
      calc('Share of flagged dies that are defective, true / (true + false), as a %:', `${sig(tp, 4)} / (${sig(tp, 4)} + ${sig(fp, 4)}) × 100`, post * 100, '%', sig(post * 100), 0.03));
  },
  (r, d) => {
    const N = pick(r, tier(d, [2, 3, 4], [8, 10, 16], [32, 50, 100, 24, 40, 64, 75, 128, 200]));
    let H = 0;
    for (let k = 1; k <= N; k++) H += 1 / k;
    return walk(ask(`A coverage point has ${N} equally likely bins. Purely random tests each hit one bin. On average, how many tests until every bin is hit?`, qty(N * H, '', 0.03, sig(N * H)), `Coupon collector: N·(1 + 1/2 + … + 1/N) = ${N} × ${sig(H)} ≈ ${sig(N * H)}. The last few bins take the longest, which is why DV engineers write directed tests or constraints to close coverage.`, 'Expected tests = N × H(N), the harmonic number.'),
      'the coupon collector', `The first new bin is instant. When k bins are still missing, each test hits a new one with chance k/N, so on average it takes N/k tests. Add those up for k = N, N-1, ..., 1: N × (1 + 1/2 + ... + 1/N). That sum is the harmonic number H(N), roughly ln(N) + 0.577.`,
      N <= 4 ? calc('The harmonic number, 1 + 1/2 + ... + 1/N:', Array.from({ length: N }, (_, i) => `1/${i + 1}`).join(' + '), H, '', sig(H, 4), 0.01)
        : calc(`The harmonic number H(${N}) ≈ ln(${N}) + 0.577 + 1/(2×${N}):`, `ln(${N}) + 0.577 + 1/${2 * N}`, H, '', sig(H, 4), 0.01),
      calc('Expected tests = N × H(N):', `${N} × ${sig(H, 4)}`, N * H, '', sig(N * H), 0.03));
  },
  (r, d) => {
    const s = pick(r, [10, 20, 50]), n = pick(r, tier(d, [100, 400], [25, 2500], [10000, 1600, 2500, 4900, 6400, 40000, 900]));
    const idea = 'Averaging n independent samples shrinks the random error by √n: the standard error of the mean is σ/√n. For estimating a probability p from n runs, the relative error is about √((1-p)/(n·p)), so rare events need enormous n.';
    if (d < 3) return walk(ask(`Monte Carlo on a delay with σ = ${s} ps, ${n} runs. Standard error of the mean, in ps?`, qty(s / Math.sqrt(n), 'ps', 0.01), `σ/√n = ${s}/${Math.sqrt(n)} = ${sig(s / Math.sqrt(n))} ps.`, 'Standard error = σ/√n.'),
      'standard error', idea,
      count(`√${n}:`, `√${n}`, Math.sqrt(n)),
      calc('σ / √n:', `${s} / ${Math.sqrt(n)}`, s / Math.sqrt(n), 'ps', sig(s / Math.sqrt(n)), 0.01));
    const p = pick(r, [1e-2, 1e-3, 1e-4, 1e-5, 1e-6]), rel = pick(r, [0.05, 0.1, 0.2, 0.25]);
    const need = (1 - p) / (p * rel * rel);
    return walk(ask(`You estimate a failure probability of about ${p} by plain Monte Carlo and want ±${rel * 100}% relative error (1σ). About how many runs?`, qty(need, '', 0.05, String(Math.round(need))), `Relative error of a proportion ≈ √((1-p)/(np)); set it to ${rel}: n ≈ (1-p)/(p·${rel}²) ≈ ${sig(need)}. Rare events need huge sample counts; this is why high-sigma SRAM analysis uses importance sampling.`, 'Relative std of a proportion is √((1-p)/(n·p)).'),
      'sample size for a rare event', idea,
      calc(`Set √((1-p)/(n·p)) = ${rel} and solve: n = (1-p)/(p·rel²). First p × rel²:`, `${p} × ${rel}²`, p * rel * rel, '', sig(p * rel * rel)),
      calc('n = (1 - p) / that:', `${1 - p} / ${sig(p * rel * rel)}`, need, '', String(Math.round(need)), 0.05));
  },
]);

// ------------------------------------------------------------------ numerics

export const numericsPractice = practice('practice-numerics', 'Numerics Drills', 'floats, fixed point, iterations, time stepping', [
  (r, d) => {
    const idea = 'A floating-point number stores p significant bits and an exponent. Near 1.0, the smallest step is 2^-(p-1) (machine epsilon). Near 2^k the step is 2^k times bigger: 2^(k-(p-1)). For float32, p = 24; for float16, p = 11; for double, p = 53.';
    if (d === 1) {
      const b = pick(r, [24, 53]);
      return walk(ask(`A float format has ${b} bits of precision. Machine epsilon (gap from 1.0 to the next number)? Decimal answer.`, qty(2 ** -(b - 1), '', 0.02, (2 ** -(b - 1)).toExponential(3)), `ε = 2^-${b - 1} = ${(2 ** -(b - 1)).toExponential(3)}.`, 'ε = 2^-(p - 1).'),
        'machine epsilon', idea,
        count('The exponent, p - 1:', `${b} - 1`, b - 1),
        calc(`ε = 2^-${b - 1}:`, `2^-${b - 1}`, 2 ** -(b - 1), '', (2 ** -(b - 1)).toExponential(3), 0.02));
    }
    if (d === 2) {
      const k = pick(r, [10, 20, 30]);
      const ulp = 2 ** (k - 23);
      return walk(ask(`In float32 (24-bit precision), what is the spacing between adjacent numbers near 2^${k} (${eng(2 ** k, '')})?`, qty(ulp, '', 0.01, String(ulp)), `Spacing = 2^(${k} - 23) = ${ulp}. Floats are relative-precision: the bigger the number, the bigger the gaps.`, 'ULP near 2^k is 2^(k - 23) for float32.'),
        'the spacing between floats', idea,
        count('The exponent of the spacing, k - 23:', `${k} - 23`, k - 23),
        calc(`2^${k - 23}:`, `2^${k - 23}`, ulp, '', String(ulp), 0.01));
    }
    const b = pick(r, [24, 11, 53, 8, 10, 12, 16, 20, 32]);
    return walk(ask(`A ${({ 24: 'float32', 11: 'float16', 53: 'float64', 8: 'bfloat16' } as Record<number, string>)[b] ?? `${b}-bit-precision float`} counter does x = x + 1 in a loop. Past what value does x + 1 == x (it stops counting)?`, num(2 ** b), `Above 2^${b} = ${2 ** b}, the spacing between ${b === 24 ? 'float32' : 'float16'} numbers is 2, so adding 1 rounds away. Performance-model cycle counters in float32 silently freeze here: use integers or doubles.`, 'Where does the spacing between floats become 2?'),
      'when floats stop counting', idea,
      choice('Adding 1 stops working when the spacing between numbers becomes:', '2 (so x + 1 rounds back to x)', ['1', '0.5']),
      count(`The spacing near 2^k is 2^(k - ${b - 1}). It equals 2 when k = ${b}. So counting stops at 2^${b}:`, `2^${b}`, 2 ** b));
  },
  (r, d) => {
    const f = pick(r, [7, 11, 15]);
    const idea = 'Fixed point Qm.n stores a number as an integer scaled by 2^-n: n fraction bits, so one LSB is 2^-n. To encode x, multiply by 2^n and round; negatives use two\'s complement. Multiplying two fixed-point numbers multiplies their scales, so the fraction bits add.';
    if (d === 1) return walk(ask(`Q1.${f} fixed point: value of one LSB? Decimal answer.`, qty(2 ** -f, '', 0.01, (2 ** -f).toExponential(3)), `2^-${f} = ${(2 ** -f).toExponential(3)}.`, 'LSB = 2^-(fraction bits).'),
      'fixed-point resolution', idea,
      calc(`One LSB is 2^-${f}:`, `2^-${f}`, 2 ** -f, '', (2 ** -f).toExponential(3), 0.01));
    if (d === 2) {
      const x = pick(r, [0.5, 0.25, 0.75, -0.5, 0.1, -0.3]);
      const q = Math.round(x * 2 ** 15);
      const enc = (q + 65536) % 65536;
      return walk(ask(`Encode ${x} in Q1.15 (16-bit two's complement). What 16-bit hex word, rounding to nearest?`, hexa(enc, 4), `round(${x} × 2^15) = ${q}${q < 0 ? ` → 2^16 ${q} = ${enc}` : ''} = 0x${enc.toString(16).toUpperCase().padStart(4, '0')}.`, 'Multiply by 2^15, round, then two\'s complement if negative.'),
        'encoding fixed point', idea,
        count(`Scale by 2^15 = 32768 and round to the nearest integer:`, `round(${x} × 32768)`, q),
        q < 0 && count("It is negative, so store 2^16 + q (two's complement):", `65536 + (${q})`, enc),
        step('As 4 hex digits:', hexa(enc, 4)));
    }
    const [a, b, c, e] = [pick(r, [1, 2, 4]), pick(r, [7, 11, 15]), pick(r, [1, 2]), pick(r, [7, 15])];
    return walk(ask(`Multiplying a Q${a}.${b} value by a Q${c}.${e} value gives an exact product with how many fraction bits?`, num(b + e), `Fraction bits add: ${b} + ${e} = ${b + e} (integer bits add too: Q${a + c}.${b + e}, ${a + b + c + e} bits total). The datapath then rounds and saturates back down.`, 'Multiplying scales by 2^-b × 2^-e.'),
      'fixed-point multiplication', idea,
      choice(`The scales are 2^-${b} and 2^-${e}. Their product is:`, `2^-${b + e}`, [`2^-${Math.max(b, e)}`, `2^-${b * e}`]),
      count('So the fraction bits of the product:', `${b} + ${e}`, b + e));
  },
  (r, d) => {
    const w = pick(r, tier(d, [1, 2], [1, 10], [0.5, 3, 100])), tol = pick(r, tier(d, [0.01, 0.1], [1e-3, 1e-4], [1e-6, 1e-9]));
    const n = Math.ceil(Math.log2(w / tol));
    return walk(ask(`Bisection, starting interval ${w} wide. Iterations until the interval is below ${tol}?`, num(n), `2^n ≥ ${w}/${tol} → n = ceil(log2(${sig(w / tol)})) = ${n}.`, 'Each iteration halves the interval.'),
      'bisection halves the interval', 'Bisection keeps the half of the interval where the root must be, so after n steps the width is w / 2^n. You need 2^n ≥ w / tolerance, so n = ceil(log2(w / tolerance)). log2(x) = ln(x)/ln(2), and 2^10 ≈ 1000 is a handy anchor.',
      calc('How many times must the width shrink? w / tolerance:', `${w} / ${tol}`, w / tol, '', sig(w / tol), 0.001),
      calc('log2 of that:', `log2(${sig(w / tol)})`, Math.log2(w / tol), '', sig(Math.log2(w / tol), 4), 0.005),
      step('Round UP to a whole number of iterations:', num(n)));
  },
  (r, d) => {
    const idea = "Newton's method improves a guess for a root of f(x) = 0 by following the tangent line down to zero: x_next = x - f(x)/f'(x). Close to the root it roughly doubles the number of correct digits each step.";
    if (d < 3) {
      const a = pick(r, [2, 3, 5, 7, 10]), x0 = pick(r, [1, 2, 3].filter((x) => x * x !== a));
      const x1 = x0 - (x0 * x0 - a) / (2 * x0);
      const x2 = x1 - (x1 * x1 - a) / (2 * x1);
      const v = d === 1 ? x1 : x2;
      return walk(ask(`Newton on f(x) = x² - ${a}, from x₀ = ${x0}. What is x${d === 1 ? '₁' : '₂'}? (4 decimals)`, qty(v, '', 0.001, v.toFixed(4)), `x₁ = ${x0} - (${x0 * x0} - ${a})/${2 * x0} = ${x1.toFixed(4)}${d === 2 ? `; x₂ = ${x2.toFixed(4)}` : ''}. √${a} = ${Math.sqrt(a).toFixed(4)}: Newton roughly doubles the correct digits each step.`, 'x_{n+1} = x_n - f(x_n)/f\'(x_n).'),
        "Newton's method", `${idea} Here f(x) = x² - ${a}, so f'(x) = 2x.`,
        count(`f(x₀) = x₀² - ${a}:`, `${x0}² - ${a}`, x0 * x0 - a),
        count("f'(x₀) = 2·x₀:", `2 × ${x0}`, 2 * x0),
        calc('x₁ = x₀ - f/f\':', `${x0} - (${x0 * x0 - a}) / ${2 * x0}`, x1, '', x1.toFixed(4), 0.001),
        d === 2 && calc("Repeat once more: x₂ = x₁ - (x₁² - a)/(2x₁):", `${x1.toFixed(4)} - (${x1.toFixed(4)}² - ${a}) / (2 × ${x1.toFixed(4)})`, x2, '', x2.toFixed(4), 0.001));
    }
    // Diode node: solve Is·(e^(v/Vt) - 1) = I for v by one Newton step from v0.
    const Is = 1e-14, Vt = 0.02585, I = pick(r, [1e-3, 1e-4]), v0 = pick(r, [0.6, 0.65, 0.7]);
    const f = Is * (Math.exp(v0 / Vt) - 1) - I, fp = (Is / Vt) * Math.exp(v0 / Vt);
    const v1 = v0 - f / fp;
    return walk(ask(`SPICE solves a diode Is(e^(v/Vt) - 1) = ${eng(I, 'A')} (Is = 1e-14 A, Vt = 25.85 mV) with Newton. From v₀ = ${v0} V, what is v₁, in V? (4 decimals)`, qty(v1, 'V', 0.002, v1.toFixed(4)), `f(v₀) = ${eng(f, 'A')}, f'(v₀) = ${eng(fp, 'S')}; v₁ = v₀ - f/f' = ${v1.toFixed(4)} V. (Exact: ${(Vt * Math.log(I / Is + 1)).toFixed(4)} V.) From a bad start the exponential makes Newton leap wildly, so SPICE limits each voltage step.`, 'f(v) = Is(e^(v/Vt) - 1) - I; f\'(v) = (Is/Vt)e^(v/Vt).'),
      "Newton's method in SPICE", `${idea} Here f(v) = Is·(e^(v/Vt) - 1) - I and f'(v) = (Is/Vt)·e^(v/Vt).`,
      calc('f(v₀), in amps:', `1e-14 × (e^(${v0}/0.02585) - 1) - ${I}`, f, 'A', sig(f, 4), 0.005),
      calc("f'(v₀), in A/V:", `(1e-14 / 0.02585) × e^(${v0}/0.02585)`, fp, '', sig(fp, 4), 0.005),
      calc("v₁ = v₀ - f/f':", `${v0} - ${sig(f, 4)} / ${sig(fp, 4)}`, v1, 'V', v1.toFixed(4), 0.002));
  },
  (r, d) => {
    const taus = Array.from({ length: tier(d, 1, 2, 3) }, () => pick(r, [0.5, 1, 5, 20, 100]));
    const lim = 2 * Math.min(...taus);
    return walk(ask(`${taus.length === 1 ? `A node with τ = ${taus[0]} ps` : `A circuit with time constants ${taus.join(', ')} ps`} is simulated with forward Euler. Largest stable time step, in ps?`, qty(lim, 'ps', 0.01), `Stability needs h < 2τ for every mode; the fastest one (${Math.min(...taus)} ps) sets the limit: ${lim} ps${taus.length > 1 ? ', even though you only care about the slow behaviour. That is stiffness, and why SPICE uses implicit methods' : ''}.`, 'h < 2τ, for the smallest τ.'),
      'explicit stability limit', 'Forward Euler steps x_next = x + h·f(x). On a decaying mode with time constant τ, each step multiplies the error by (1 - h/τ). If h > 2τ that factor is below -1 and the error grows each step: the simulation explodes. Every mode must satisfy it, so the FASTEST (smallest τ) mode sets the limit.',
      calc('The smallest time constant:', `min(${taus.join(', ')})`, Math.min(...taus), 'ps', String(Math.min(...taus)), 0.001),
      calc('Largest stable step, 2 × τ_min:', `2 × ${Math.min(...taus)}`, lim, 'ps', String(lim), 0.01));
  },
  (r, d) => {
    if (d === 1) {
      const k = pick(r, [2, 4, 10]), p = pick(r, [1, 2, 4]);
      return walk(ask(`A method's error ∝ h^${p}. Make h ${k}× smaller: how many times smaller is the error?`, num(k ** p), `Error ∝ h^${p}, so ${k}× smaller h gives ${k}^${p} = ${k ** p}× smaller error (at ${k}× the cost).`, 'Error scales as h^order.'),
        'order of accuracy', 'A method of order p has error proportional to h^p (h = step size). Shrinking h by k shrinks the error by k^p. Higher order means much faster improvement.',
        count(`${k}^${p}:`, `${k}^${p}`, k ** p));
    }
    if (d === 2) {
      const ys = Array.from({ length: 3 }, () => between(r, 0, 8)), h = pick(r, [1, 2, 0.5]);
      const I = (h / 2) * (ys[0] + 2 * ys[1] + ys[2]);
      return walk(ask(`Samples of current (mA) at t = 0, ${h}, ${2 * h} ns: ${ys.join(', ')}. Trapezoidal-rule charge, in pC?`, qty(I, 'pC', 0.01, sig(I)), `h/2·(y₀ + 2y₁ + y₂) = ${h}/2·(${ys[0]} + ${2 * ys[1]} + ${ys[2]}) = ${sig(I)} pC.`, 'Trapezoid: h/2 × (first + 2×middle + last).'),
        'the trapezoidal rule', 'To integrate sampled data, connect the samples with straight lines and add the trapezoid areas. Each trapezoid is h × (left + right)/2. Adding them, every inner sample is counted twice: h/2 × (y₀ + 2y₁ + ... + y_n). mA × ns = pC.',
        count('First + 2 × middle + last:', `${ys[0]} + 2×${ys[1]} + ${ys[2]}`, ys[0] + 2 * ys[1] + ys[2]),
        calc('Times h/2:', `${h}/2 × ${ys[0] + 2 * ys[1] + ys[2]}`, I, 'pC', sig(I), 0.01));
    }
    const k = pick(r, [3, 4, 5, 6, 8, 10, 12, 16]);
    return walk(ask(`A matrix has condition number 10^${k}. Solving with double precision (≈16 digits), about how many correct significant digits can you expect?`, num(16 - k), `You lose about log10(κ) = ${k} digits: 16 - ${k} = ${16 - k}. Ill-conditioned matrices come from wildly different conductances (1 mΩ next to 1 GΩ), which is why SPICE adds GMIN.`, 'Digits lost ≈ log10(condition number).'),
      'condition number', 'The condition number κ of a matrix says how much it can amplify tiny rounding errors in the input. You lose roughly log10(κ) decimal digits of accuracy. Double precision starts with about 16.',
      count('Digits lost, log10(κ):', `log10(10^${k})`, k),
      count('Digits left:', `16 - ${k}`, 16 - k));
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
    mc('Your gradient-descent sizing script oscillates wildly and never converges. The most likely fix?', ['Reduce the step size (learning rate)', 'Use more variables', 'Remove the constraint', 'Increase the step size, to damp the oscillation faster'], 0, 'A step larger than 2/curvature overshoots the minimum each iteration. Shrink η, or use a line search / Newton step.'),
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
    mc('Someone deletes Rb, Rc and Rd but leaves a capacitor from n2 to ground. The DC solve fails with "singular matrix". Why?', ['Capacitors are open at DC: n1 and n2 have no path to ground', 'Capacitors short out at DC, so the solver divides by zero', 'The current source is too large for the conductance matrix left', 'Ra is now too small, so G is numerically close to singular'], 0, 'G has a zero eigenvalue, so the DC solve fails. At DC a capacitor is an open circuit. The floating subnetwork makes G singular. SPICE adds a tiny GMIN conductance to ground for exactly this reason.'),
    { t: 'gen', make: (r) => { const l1 = -between(r, 1, 4), l2 = pick(r, [-5, 2, 3]); const A = [[2 * l1 - l2, -l1 + l2], [2 * l1 - 2 * l2, -l1 + 2 * l2]]; return mc(`The linearized regulator model is dx/dt = ${mat(A)}·x. Stable?`, ['Stable', 'Unstable'], l2 < 0 ? 0 : 1, `trace = ${l1 + l2}, det = ${l1 * l2}: eigenvalues ${l1} and ${l2}. ${l2 < 0 ? 'Both negative: stable.' : `${l2} > 0: a growing mode. Unstable.`}`); } },
    { t: 'gen', make: (r) => { const s = [pick(r, [10, 12]), pick(r, [3, 4]), 1, 0.5]; const tot = s.reduce((a, x) => a + x * x, 0); return ask(`An extracted RC network's transfer matrix has singular values ${s.join(', ')}. Keeping only the largest, what % of the energy (sum of σ²) do you keep?`, qty((s[0] ** 2 / tot) * 100, '%', 0.01, `${((s[0] ** 2 / tot) * 100).toFixed(1)}%`), `${s[0]}² / (${s.map((x) => `${x}²`).join(' + ')}) = ${((s[0] ** 2 / tot) * 100).toFixed(1)}%. That is model order reduction: a rank-1 model that captures almost everything.`); } },
    mc('The solver is slow on a 2-million-node power grid. Your colleague inverts G once and multiplies. What do you say?', ['Great idea: the inverse is computed just once and reused everywhere', 'Use a sparse LU, or an iterative solver like conjugate gradient', 'Use a bigger computer, with more memory for the inverse', 'Transpose G first, since that makes the multiplication much cheaper'], 1, 'G⁻¹ is dense and would need terabytes. G has a few nonzeros per row; its inverse has 4×10¹² entries. Sparse factorization or preconditioned CG is how grid analyzers work.'),
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
    mc('Which fix attacks the root cause most directly?', ['Stagger the wake-up, and add damped decoupling near f₀', 'Raise the clock frequency', 'Lower the on-die capacitance, so that the resonance gets sharper', 'Increase L_pkg'], 0, 'A slower current ramp over many cycles puts less energy near f₀. A slower di/dt puts less energy near f₀, and damping (ESR, or on-die resistive decaps) kills the ringing. This is standard power-management practice.'),
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
    mc('The VP asks: "Can we just run 10× more Monte Carlo to get SRAM failure rates at 6σ?" Your answer?', ['Yes: ten times as many runs is plenty for a 6σ failure rate', 'No: 6σ is ~1e-9, so plain Monte Carlo needs ~1e10 samples', 'No: Monte Carlo cannot model an SRAM cell in any useful way', 'Only if we use a larger σ'], 1, 'Use importance sampling or extrapolation instead. To see a 1e-9 event even a few times you need billions of runs. High-sigma methods bias the sampling toward the failure region and re-weight.'),
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
    mc('The cycle counter is a float32 incremented by 1.0 each cycle. What happened?', ['Integer overflow', 'At 2^24 the float32 spacing becomes 2, so +1 rounds away', 'The benchmark really did take that many cycles to complete', 'Denormals, which flush the small increment to zero in hardware'], 1, 'At 2^24 = 16,777,216 the counter freezes. Float32 has 24 bits of precision. Counters must be integers (or at least doubles).'),
    { t: 'gen', make: (r) => { const taus = [pick(r, [0.5, 1, 2]), pick(r, [100, 1000])]; return ask(`Their forward-Euler transient solver simulates a circuit with time constants ${taus[0]} ps and ${taus[1]} ps. Largest stable step, in ps?`, qty(2 * taus[0], 'ps', 0.01), `2 × ${taus[0]} ps. The fast parasitic forces tiny steps across the whole run: a stiff system. Switch to backward Euler or trapezoidal.`); } },
    { t: 'gen', make: (r) => { const tau = pick(r, [1, 2]), h = pick(r, [3, 5]) * tau; const g = 1 - h / tau; return ask(`With τ = ${tau} ps and step h = ${h} ps, forward Euler multiplies the error by (1 - h/τ) each step. By what factor does it grow per step (magnitude)?`, qty(Math.abs(g), '', 0.01, String(Math.abs(g))), `|1 - ${h}/${tau}| = ${Math.abs(g)} > 1: it grows ${Math.abs(g)}× every step, with alternating sign. That is the "explosion".`); } },
    { t: 'gen', make: (r) => { const x0 = pick(r, [1, 2]); const a = 5; const x1 = x0 - (x0 ** 3 - a) / (3 * x0 * x0); return ask(`Their bias solver uses Newton on f(x) = x³ - ${a}. From x₀ = ${x0}, what is x₁? (4 decimals)`, qty(x1, '', 0.002, x1.toFixed(4)), `x₁ = ${x0} - (${x0 ** 3} - ${a})/(3·${x0 * x0}) = ${x1.toFixed(4)}. (∛${a} = ${Math.cbrt(a).toFixed(4)}.)`); } },
    { t: 'gen', make: (r) => { const tol = pick(r, [1e-6, 1e-9]); const n = Math.ceil(Math.log2(1 / tol)); return ask(`As a fallback they use bisection on a [0, 1] V interval. Iterations to reach ${tol} V?`, num(n), `ceil(log2(1/${tol})) = ${n}. Slow but guaranteed: good fallback when Newton diverges.`); } },
    { t: 'gen', make: (r) => { const f = pick(r, [11, 15]); const x = pick(r, [0.3, 0.7]); const q = Math.round(x * 2 ** f) / 2 ** f; return ask(`Their DSP model stores coefficient ${x} in Q1.${f}. What is the stored value's absolute rounding error? (scientific notation fine)`, qty(Math.abs(q - x), '', 0.05, Math.abs(q - x).toExponential(2)), `round(${x} × 2^${f}) / 2^${f} = ${q}; error = ${Math.abs(q - x).toExponential(2)}, at most half an LSB (${(2 ** -(f + 1)).toExponential(2)}).`); } },
    mc('Their energy estimate sums 10⁹ tiny per-cycle values into one float32 total, and the result is 30% low. Best fix?', ['Use pairwise or Kahan summation, or a double accumulator', 'Sum the per-cycle values in random order, to average out the error', 'Divide every value by 10⁹ first, and multiply back at the end', 'Use float16, which rounds the tiny values with less bias'], 0, 'Once the total is large, each tiny addend is below half an ULP and rounds away. Compensated (Kahan) or pairwise summation, or a wider accumulator, fixes it.'),
  ],
  recap: ['Float32 counters freeze at 2^24.', 'Stiff systems need implicit integration.', 'Newton fast, bisection safe.', 'Accumulate small numbers carefully.'],
});

export const MATH_BOSSES = [calcBoss, linalgBoss, odeBoss, probBoss, numericsBoss];

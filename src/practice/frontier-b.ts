// Practice banks and bosses for the frontier roles, part two: image sensors, MEMS, neuromorphic computing, emerging
// devices, and applications engineering and program management.
import { qty } from '../lessons/answers';
import { calc, choice, count, walk } from '../lessons/teach';
import { ask, gen, mc, pick, say } from '../lessons/types';
import { boss, practice, tier, type PracticeSet } from './types';
import { concept, sig } from './util';

const hard = (set: PracticeSet, i: number) => gen((r) => ({ ...set.gens[i](r, 3), teach: undefined }));
const bossOf = (set: PracticeSet, id: string, title: string, concept: string, xp: number, intro: string, picks: number[], extra: ReturnType<typeof mc>[]) =>
  boss({ id, title, concept, xp, steps: [say(intro, 'thinking'), ...picks.map((i) => hard(set, i)), ...extra], recap: [concept] });
const db20 = (x: number) => 20 * Math.log10(x);

// ------------------------------------------------------------------ image sensors

export const sensorsPractice = practice('practice-sensors', 'Image Sensor Drills', 'electrons from photons, shot noise, dynamic range, readout rate', [
  (r, d) => {
    const qe = pick(r, [50, 70, 90]);
    if (d === 1) {
      const ph = pick(r, [1000, 5000, 20000]), e = (ph * qe) / 100;
      return walk(ask(`${ph} photons land on a pixel with ${qe}% quantum efficiency. How many electrons are collected?`, qty(e, '', 0.001, String(e)), `${ph} × ${qe / 100} = ${e}.`, 'Photons times QE.'),
        'quantum efficiency', 'Not every photon makes an electron. Quantum efficiency is the fraction that does, so the collected charge is the photon count times QE.',
        calc('Electrons = photons × QE:', `${ph} × ${qe / 100}`, e, '', String(e), 0.001));
    }
    const flux = pick(r, [200, 500, 1000]), area = pick(r, [1, 2, 4]), t = pick(r, [10, 20, 33]) / 1000;
    const e = flux * area * t * 1000 * (qe / 100);
    return walk(ask(`Light delivers ${flux} photons per µm² per ms to a ${area} µm² pixel exposed for ${t * 1000} ms, with ${qe}% QE. How many electrons?`, qty(e, '', 0.02, sig(e)), `${flux} × ${area} × ${t * 1000} × ${qe / 100} = ${sig(e)} e⁻.`, 'Flux × area × time × QE.'),
      'electrons from an exposure', 'The number of photons collected is the flux times the pixel area times the exposure time. QE then turns a fraction of them into electrons.',
      calc('Photons = flux × area × exposure (ms):', `${flux} × ${area} × ${t * 1000}`, flux * area * t * 1000, '', sig(flux * area * t * 1000), 0.01),
      calc('Electrons = photons × QE:', `${sig(flux * area * t * 1000)} × ${qe / 100}`, e, '', sig(e), 0.02));
  },
  (r, d) => {
    const n = pick(r, [100, 400, 2500, 10000, 40000]);
    if (d === 1) {
      const s = db20(Math.sqrt(n));
      return walk(ask(`A pixel holds ${n} electrons. What is its shot-noise-limited SNR, in dB?`, qty(s, 'dB', 0.03, sig(s)), `Noise = √${n} = ${Math.sqrt(n)}, SNR = ${Math.sqrt(n)} → ${sig(s)} dB.`, 'SNR = √N, then 20·log10.'),
        'shot-noise SNR', 'Light arrives in discrete photons, so the electron count fluctuates by the square root of its mean. The best possible SNR is the signal over that noise, which is √N, expressed in dB as 20·log10.',
        calc('Noise = √N:', `√${n}`, Math.sqrt(n), 'e', sig(Math.sqrt(n)), 0.01), calc('SNR in dB = 20 · log10(N / noise):', `20 × log10(${sig(Math.sqrt(n))})`, s, 'dB', sig(s), 0.03));
    }
    const rn = pick(r, [3, 5, 10]), dark = d === 3 ? pick(r, [25, 50, 100]) : 0;
    const variance = n + dark + rn * rn;
    const snr = db20(n / Math.sqrt(variance));
    return walk(ask(`A pixel holds ${n} signal electrons with ${rn} e⁻ of read noise${dark ? ` and ${dark} dark-current electrons (their shot noise has variance ${dark})` : ''}. Independent noise adds as variances: σ² = N${dark ? ' + N_dark' : ''} + read². What is the SNR, in dB?`, qty(snr, 'dB', 0.03, sig(snr)), `σ² = ${variance}, σ = ${sig(Math.sqrt(variance))}; SNR = ${n} / ${sig(Math.sqrt(variance))} → ${sig(snr)} dB.`, 'Add the variances, take the square root, divide.'),
      'combining noise sources', 'Independent noise sources add in power: their variances sum. Shot noise has variance N, read noise has variance rn², and dark current adds its own shot noise. The SNR is the signal divided by the square root of the total variance.',
      calc('Total variance:', `${n}${dark ? ` + ${dark}` : ''} + ${rn}²`, variance, '', String(variance), 0.005),
      calc('SNR in dB = 20 · log10(N / √variance):', `20 × log10(${n} / √${variance})`, snr, 'dB', sig(snr), 0.03));
  },
  (r, d) => {
    const fw = pick(r, [5000, 10000, 20000, 60000]), rn = pick(r, [2, 5, 10]);
    const dr = db20(fw / rn);
    if (d < 3) return walk(ask(`A pixel has a full well of ${fw} e⁻ and read noise of ${rn} e⁻. What is its dynamic range, in dB?`, qty(dr, 'dB', 0.02, sig(dr)), `20·log10(${fw} / ${rn}) = ${sig(dr)} dB.`, '20·log10(full well / read noise).'),
      'dynamic range', 'Dynamic range is the ratio of the brightest signal the pixel can hold (full well) to the faintest it can resolve (the read noise floor), expressed in dB.',
      calc('Ratio = full well ÷ read noise:', `${fw} / ${rn}`, fw / rn, '', sig(fw / rn), 0.01), calc('DR = 20 · log10(ratio):', `20 × log10(${sig(fw / rn)})`, dr, 'dB', sig(dr), 0.02));
    const bits = Math.ceil(Math.log2(fw / rn));
    return walk(ask(`To digitize a pixel with full well ${fw} e⁻ and read noise ${rn} e⁻ without losing its dynamic range, how many ADC bits does it need at minimum? (smallest n with 2ⁿ ≥ full well / read noise)`, qty(bits, '', 0.001, String(bits)), `${fw} / ${rn} = ${sig(fw / rn)}; log₂ = ${sig(Math.log2(fw / rn))} → ${bits} bits.`, 'log2 of the ratio, rounded up.'),
      'ADC resolution for a pixel', 'The ADC must distinguish levels as small as the read noise across the whole well, so the number of levels is the full-well-to-noise ratio. Bits = the logarithm base two of that, rounded up.',
      calc('Levels needed = full well ÷ read noise:', `${fw} / ${rn}`, fw / rn, '', sig(fw / rn), 0.01), count('Smallest n with 2^n ≥ levels:', `⌈log2(${sig(fw / rn)})⌉`, bits));
  },
  (r, d) => {
    const [w, h, fps] = pick(r, [[1920, 1080, 60], [3840, 2160, 30], [4000, 3000, 30], [8000, 6000, 30]] as const);
    const gp = (w * h * fps) / 1e9, bits = pick(r, [10, 12]), ch = pick(r, [4, 8, 16]);
    if (d === 1) return walk(ask(`A ${w} × ${h} sensor runs at ${fps} fps. How many megapixels per second?`, qty((w * h * fps) / 1e6, 'Mpix/s', 0.02, sig((w * h * fps) / 1e6)), `${w} × ${h} × ${fps} = ${sig((w * h * fps) / 1e6)} Mpix/s.`, 'Pixels × frame rate.'),
      'pixel rate', 'The readout must deliver every pixel of every frame: the pixel rate is the pixels per frame times the frames per second.',
      count('Pixels per frame:', `${w} × ${h}`, w * h), calc('Pixels per second, in millions:', `${w * h} × ${fps} / 1e6`, (w * h * fps) / 1e6, 'Mpix/s', sig((w * h * fps) / 1e6), 0.02));
    const rate = (gp * bits) / ch;
    return walk(ask(`The same ${w} × ${h} × ${fps} fps stream at ${bits} bits per pixel is split over ${ch} serial lanes. What data rate per lane, in Gb/s (ignore coding overhead)?`, qty(rate, 'Gb/s', 0.03, sig(rate)), `${sig(gp)} Gpix/s × ${bits} bits ÷ ${ch} lanes = ${sig(rate)} Gb/s per lane.`, 'Pixel rate × bits ÷ lanes.'),
      'sensor interface rate', 'Multiply the pixel rate by the bits per pixel to get the total bit rate, then divide by the number of parallel lanes. The result tells you whether a standard serial standard can carry it.',
      calc('Total bit rate in Gb/s = Gpix/s × bits:', `${sig(gp)} × ${bits}`, gp * bits, 'Gb/s', sig(gp * bits), 0.02),
      calc('Per lane:', `${sig(gp * bits)} / ${ch}`, rate, 'Gb/s', sig(rate), 0.03));
  },
  (r, d) => {
    // G2.6: PRNU grows with the signal, shot noise only as its square root: they cross at S = (1/PRNU)².
    const prnu = pick(r, [0.25, 0.4, 0.5, 0.8, 1, 1.25, 2, 2.5]), s = (100 / prnu) ** 2;
    const idea = 'Photo-response non-uniformity (PRNU) is a gain error between pixels, so the fixed-pattern noise it makes is a fixed fraction of the signal: PRNU × S. Shot noise is only √S. They are equal when PRNU × S = √S, so S = (1 ÷ PRNU)², with PRNU as a fraction. Above that signal, gain differences dominate over photon noise.';
    if (d === 1) return walk(ask(`A pixel holds ${s} electrons. Its shot noise is √N. What is that, in electrons?`, qty(Math.sqrt(s), '', 0.01, sig(Math.sqrt(s))), `√${s} = ${sig(Math.sqrt(s))} e⁻.`, 'Square root.'),
      'shot noise', 'Shot noise is the square root of the number of electrons collected.',
      calc('Noise = √N:', `√${s}`, Math.sqrt(s), '', sig(Math.sqrt(s)), 0.01));
    if (d === 2) return walk(ask(`A sensor has a PRNU of ${prnu}%. At a signal of ${s} e⁻, what is the fixed-pattern noise (PRNU × signal), in electrons?`, qty((prnu / 100) * s, '', 0.02, sig((prnu / 100) * s)), `${prnu / 100} × ${s} = ${sig((prnu / 100) * s)} e⁻, equal to the shot noise √${s} = ${sig(Math.sqrt(s))} e⁻.`, 'PRNU as a fraction, times the signal.'),
      'fixed-pattern noise from PRNU', idea,
      calc('PRNU as a fraction:', `${prnu} / 100`, prnu / 100, '', String(prnu / 100), 0.005),
      calc('FPN = fraction × signal, in e⁻:', `${prnu / 100} × ${s}`, (prnu / 100) * s, '', sig((prnu / 100) * s), 0.02));
    return walk(ask(`A sensor has a PRNU of ${prnu}%. At what signal does its fixed-pattern noise equal its shot noise, in electrons? (PRNU × S = √S)`, qty(s, '', 0.02, String(s)), `S = (1 / ${prnu / 100})² = ${s.toLocaleString('en-US')} e⁻. Beyond that, the picture is limited by gain differences, so flat-field correction matters.`, 'S = (1 / PRNU)².'),
      'where gain error overtakes shot noise', idea,
      calc('1 ÷ PRNU (PRNU as a fraction):', `1 / ${prnu / 100}`, 100 / prnu, '', sig(100 / prnu), 0.005),
      calc('S = (1 ÷ PRNU)², in e⁻:', `${sig(100 / prnu)}²`, s, '', String(s), 0.02));
  },
  (r) => concept(r, [
    ['What does correlated double sampling remove in a pinned-photodiode pixel?', 'Reset (kT/C) noise and the pixel offset', ['Photon shot noise from the scene', 'Gain differences between pixels, as a fixed pattern', 'Rolling-shutter skew in fast-moving scenes'], 'correlated double sampling', 'The reset level is read first, then the charge is transferred and the signal level is read. Both samples carry the same reset noise and offset, so subtracting them cancels both. It needs a pixel with a transfer gate (a 4-transistor pinned-photodiode pixel).',
      ['The two samples are taken from the:', 'Same pixel', ['Same row of the chip only', 'Same column of the chip only']]],
    ['Which fixed-pattern noise is an offset that shows even in the dark?', 'DSNU, the dark-signal non-uniformity', ['Photo-response non-uniformity, the gain error', 'Shot noise', 'Quantisation noise from the converter'], 'DSNU versus PRNU', 'Fixed-pattern noise has two parts. DSNU is the offset difference between pixels and shows in the dark; a dark frame removes it. PRNU is the gain difference, quoted in % of the signal, and a flat-field frame removes it.',
      ['An offset is present in the:', 'Dark', ['Bright areas only', 'Colour channel only']]],
    ['What does PRNU, quoted in %, describe?', 'A gain difference between pixels, growing with signal', ['An offset difference between pixels, seen in the dark', 'Photon noise, which grows as the root of the signal', 'Read noise added by the column amplifier'], 'PRNU', 'Photo-response non-uniformity is a gain error, so its fixed-pattern noise is a fixed fraction of the signal. Shot noise grows only as the square root, so at high signal the gain error dominates.',
      ['A gain error scales with the:', 'Signal', ['Temperature only', 'Frame number']]],
    ['Why can saturation capacity be lower than the full well?', 'The readout chain can clip before the well is full', ['Some photons are reflected before reaching the well', 'Shot noise removes part of the stored charge', 'Reset drains a little charge at random'], 'saturation versus full well', 'The full well is what the photodiode can hold; the saturation capacity is the signal at which the output clips. If the amplifier or converter runs out of range first, saturation is the lower number, and it is the one that sets dynamic range.',
      ['Dynamic range is quoted at:', 'Saturation', ['Zero signal', 'The dark frame']]],
    ['Which shutter exposes every row at the same instant?', 'Global shutter, at some cost in pixel area', ['Rolling shutter, which exposes and reads rows one after another', 'Both, since exposure time is the same for each', 'Neither; row timing is set by the lens'], 'rolling versus global shutter', 'A rolling shutter reads rows in turn, so a fast-moving object skews. A global shutter exposes all rows together and stores the charge in each pixel until readout, which costs area.',
      ['Skew in fast video comes from the:', 'Rolling shutter', ['Global shutter', 'Lens cap']]],
    ['Why can a 4T pinned-photodiode pixel do CDS when a 3T hard-reset pixel cannot?', 'A transfer gate lets it read the reset level first', ['It has a bigger photodiode', 'It uses a rolling shutter instead of a global one', 'It resets more slowly, which averages out the noise'], 'why 4T pixels allow CDS', 'The transfer gate keeps the charge on the photodiode while the floating node is reset and read. Then the charge is moved and read again, so the reset noise in both samples is the same. A hard-reset 3T pixel has no such separation.',
      ['The transfer gate separates the:', 'Photodiode from the sense node', ['Chip from the package', 'Lens from the sensor']]],
  ], (why) => `${why}.`),
]);

export const sensorsBoss = bossOf(sensorsPractice, 'boss-sensors', 'The Camera Spec Review', 'collected charge, SNR, dynamic range and readout rate', 200,
  'Boss fight, {name}. A phone maker wants a new camera sensor. Charge, noise, dynamic range and the interface they need. Exam rules.', [0, 1, 2, 3],
  [mc('A fast-moving object looks skewed in video from a phone. What is the cause?', ['Lens distortion only, which bends straight lines near the edge', 'Rolling shutter: each row is exposed at a slightly different time', 'Too many megapixels, since small pixels read out more slowly', 'A noisy ADC, which shifts rows sideways by a few pixels at random'], 1, 'Rows are exposed and read one after another; a global shutter exposes all rows together. Rolling shutter is smaller and quieter; global shutter costs pixel area for a storage node.')]);

// ------------------------------------------------------------------ MEMS

export const memsPractice = practice('practice-mems', 'MEMS Drills', 'resonance, deflection, capacitive sensing, Q and ringdown', [
  (r, d) => {
    const k = pick(r, [1, 2, 5, 10, 20]), m = pick(r, [1, 2, 5, 10]);
    const f = Math.sqrt(k / (m * 1e-9)) / (2 * Math.PI);
    if (d < 3) return walk(ask(`A proof mass of ${m} µg hangs on springs totalling ${k} N/m. What is the resonant frequency, in kHz? (f = √(k/m) / 2π)`, qty(f / 1000, 'kHz', 0.03, sig(f / 1000)), `√(${k} / ${m}e-9) / 2π = ${sig(f / 1000)} kHz.`, 'Square-root of k over m, divided by 2π.'),
      'spring-mass resonance', 'A mass on a spring oscillates at ω = √(k/m) radians per second; dividing by 2π gives hertz. Stiffer springs or a lighter mass raise the frequency.',
      calc('k / m in s⁻² (m in kg: µg × 1e-9):', `${k} / (${m} × 1e-9)`, k / (m * 1e-9), '', sig(k / (m * 1e-9)), 0.01),
      calc('f = √(k/m) ÷ 2π, in kHz:', `√${sig(k / (m * 1e-9))} / (2π) / 1000`, f / 1000, 'kHz', sig(f / 1000), 0.03));
    const target = pick(r, [5, 10, 20]) * 1e3;
    const kk = (2 * Math.PI * target) ** 2 * m * 1e-9;
    return walk(ask(`A ${m} µg proof mass must resonate at ${target / 1000} kHz. What spring constant is needed, in N/m? (k = m·(2πf)²)`, qty(kk, 'N/m', 0.03, sig(kk)), `k = ${m}e-9 × (2π × ${target})² = ${sig(kk)} N/m.`, 'Invert the resonance formula.'),
      'sizing a spring', 'Rearranging f = √(k/m)/2π gives k = m·(2πf)². Choose the spring stiffness from the mass and the frequency you need.',
      calc('ω = 2π f, in rad/s:', `2π × ${target}`, 2 * Math.PI * target, 'rad/s', sig(2 * Math.PI * target), 0.01),
      calc('k = m × ω², in N/m:', `${m}e-9 × ${sig(2 * Math.PI * target)}²`, kk, 'N/m', sig(kk), 0.03));
  },
  (r, d) => {
    const f = pick(r, [5, 10, 20]) * 1e3, a = d === 1 ? 9.81 : pick(r, [0.98, 9.81, 49]);
    const x = (a / (2 * Math.PI * f) ** 2) * 1e9;
    return walk(ask(`A spring-mass accelerometer resonates at ${f / 1000} kHz. An acceleration of ${a} m/s² deflects the mass by x = a/ω². How many nm?`, qty(x, 'nm', 0.03, sig(x)), `x = ${a} / (2π × ${f})² = ${sig(x)} nm.`, 'a divided by ω squared.'),
      'accelerometer deflection', 'Below resonance the mass follows the acceleration: x = a / ω², with ω = 2π·f. High-frequency sensors are stiff, so their deflection is tiny: nanometres.',
      calc('ω² = (2π f)²:', `(2π × ${f})²`, (2 * Math.PI * f) ** 2, '', sig((2 * Math.PI * f) ** 2), 0.01),
      calc('x = a ÷ ω², in nm:', `${a} / ${sig((2 * Math.PI * f) ** 2)} × 1e9`, x, 'nm', sig(x), 0.03));
  },
  (r, d) => {
    const c0 = pick(r, [0.5, 1, 2]), gap = pick(r, [1, 2, 3]), dx = pick(r, [1, 2, 5, 10]);
    const dc = (c0 * (dx / 1000)) / gap * 1000;
    if (d < 3) return walk(ask(`A capacitive sensor has C₀ = ${c0} pF and a ${gap} µm gap. A deflection of ${dx} nm changes the capacitance by ΔC = C₀ · Δx / gap. How many fF?`, qty(dc, 'fF', 0.03, sig(dc)), `ΔC = ${c0} pF × ${dx / 1000} µm / ${gap} µm = ${sig(dc)} fF.`, 'C0 times the fraction of the gap.'),
      'capacitive sensing', 'A small move of a plate changes the gap and therefore the capacitance in proportion: the fractional change in C is about the fractional change in gap.',
      calc('Fraction of the gap: Δx ÷ gap:', `${dx / 1000} / ${gap}`, dx / 1000 / gap, '', sig(dx / 1000 / gap), 0.01),
      calc('ΔC = C₀ × fraction, in fF:', `${c0} × ${sig(dx / 1000 / gap)} × 1000`, dc, 'fF', sig(dc), 0.03));
    const cf = pick(r, [0.1, 0.2, 0.5]), vb = pick(r, [1, 1.8, 3.3]);
    const dv = (vb * dc * 2) / (cf * 1000) * 1000;
    return walk(ask(`A differential pair gives 2·ΔC = ${sig(2 * dc)} fF. A charge amplifier with a ${cf} pF feedback capacitor and a ${vb} V excitation outputs ΔV = V · 2ΔC / C_f. How many mV?`, qty(dv, 'mV', 0.03, sig(dv)), `ΔV = ${vb} × ${sig(2 * dc)} fF / ${cf * 1000} fF = ${sig(dv / 1000)} V = ${sig(dv)} mV.`, 'Excitation × capacitance ratio.'),
      'charge-amplifier readout', 'The charge amplifier turns a capacitance change into a voltage: the output is the excitation voltage times the ratio of the signal capacitance change to the feedback capacitor.',
      calc('Ratio 2ΔC ÷ C_f (both in fF):', `${sig(2 * dc)} / ${cf * 1000}`, (2 * dc) / (cf * 1000), '', sig((2 * dc) / (cf * 1000)), 0.02),
      calc('ΔV = V × ratio, in mV:', `${vb} × ${sig((2 * dc) / (cf * 1000))} × 1000`, dv, 'mV', sig(dv), 0.03));
  },
  (r, d) => {
    const f = pick(r, [10, 20, 50]) * 1e3, q = pick(r, [500, 5000, 20000, 100000]);
    if (d < 3) { const bw = f / q; return walk(ask(`A resonator at ${f / 1000} kHz has Q = ${q}. What is its half-power bandwidth, in Hz? (BW = f / Q)`, qty(bw, 'Hz', 0.03, sig(bw)), `${f} / ${q} = ${sig(bw)} Hz.`, 'Frequency over Q.'),
      'quality factor and bandwidth', 'Q measures how sharp a resonance is: the bandwidth is the centre frequency divided by Q. A high-Q resonator rings for a long time and responds in a very narrow band.',
      calc('BW = f ÷ Q, in Hz:', `${f} / ${q}`, bw, 'Hz', sig(bw), 0.03)); }
    const tau = (q / (Math.PI * f)) * 1000;
    return walk(ask(`After a drive stops, a ${f / 1000} kHz resonator with Q = ${q} rings down with a time constant τ = Q / (π f). How many ms?`, qty(tau, 'ms', 0.03, sig(tau)), `τ = ${q} / (π × ${f}) = ${sig(tau)} ms. High-Q gyroscopes take tens of milliseconds to settle after power-up, which is why start-up time is a spec.`, 'Q over π f.'),
      'ringdown time', 'The amplitude of a resonator decays exponentially with time constant Q/(πf) after the drive is removed, so the same high Q that makes a gyroscope sensitive makes it slow to settle.',
      calc('π × f:', `π × ${f}`, Math.PI * f, 'rad/s', sig(Math.PI * f), 0.01),
      calc('τ = Q ÷ (π f), in ms:', `${q} / ${sig(Math.PI * f)} × 1000`, tau, 'ms', sig(tau), 0.03));
  },
  (r, d) => {
    // G2.6: angle random walk (°/√h) = rate noise density (°/s/√Hz) × 60.
    const dens = pick(r, [0.005, 0.01, 0.02, 0.05]), arw = dens * 60;
    const idea = 'A gyro\'s white rate noise, in °/s per √Hz, integrates into an angle error that grows as the square root of time: the angle random walk. One hour is 3600 s and √3600 = 60, so ARW in °/√h is the noise density times 60.';
    if (d === 1) return walk(ask(`A gyro has a rate noise density of ${dens} °/s/√Hz. What is its angle random walk, in °/√h? (multiply by 60)`, qty(arw, '', 0.02, sig(arw)), `${dens} × 60 = ${sig(arw)} °/√h.`, 'Times 60.'),
      'angle random walk', idea,
      calc('ARW = density × 60:', `${dens} × 60`, arw, '', sig(arw), 0.02));
    if (d === 2) return walk(ask(`A gyro data sheet gives an angle random walk of ${sig(arw)} °/√h. What is the rate noise density, in °/s/√Hz?`, qty(dens, '', 0.03, String(dens)), `${sig(arw)} / 60 = ${dens} °/s/√Hz.`, 'Divide by 60.'),
      'angle random walk', idea,
      calc('Density = ARW ÷ 60:', `${sig(arw)} / 60`, dens, '', String(dens), 0.03));
    const hrs = pick(r, [1, 4, 9, 16]), err = arw * Math.sqrt(hrs);
    return walk(ask(`A gyro with an angle random walk of ${sig(arw)} °/√h integrates for ${hrs} hours with no other correction. What is the typical (1σ) angle error from white noise alone, in degrees? (ARW × √hours)`, qty(err, '', 0.03, sig(err)), `${sig(arw)} × √${hrs} = ${sig(err)}°. The error grows with the square root of time, which is why a gyro alone cannot hold a heading and is combined with other sensors.`, 'ARW times the square root of the hours.'),
      'drift from angle random walk', idea,
      calc('√hours:', `√${hrs}`, Math.sqrt(hrs), '', sig(Math.sqrt(hrs)), 0.01),
      calc('Error = ARW × √hours, in degrees:', `${sig(arw)} × ${sig(Math.sqrt(hrs))}`, err, '', sig(err), 0.03));
  },
  (r) => concept(r, [
    ['On an Allan deviation plot, what does the flat bottom of the curve show?', 'Bias instability, the sensor\'s best stability', ['White noise, which keeps averaging away with longer τ', 'Rate random walk, which grows with τ', 'The resonant frequency of the proof mass'], 'reading an Allan plot', 'The plot shows how the noise averages as the averaging time τ grows. A slope of -1/2 is white noise (angle random walk, read at τ = 1 s). The curve then flattens where slow drift takes over: that floor is the bias instability. At long τ a slope of +1/2 is rate random walk.',
      ['The flat floor is the sensor\'s:', 'Best stability', ['Resonance', 'Supply voltage']]],
    ['What does a -1/2 slope on an Allan plot mean?', 'White noise, which averages down as τ grows', ['Bias instability, the flat floor of the curve', 'Rate random walk, which grows with τ', 'A resonance in the proof mass'], 'Allan slopes', 'White noise averages away as 1/√τ, which is a slope of -1/2 on a log-log plot. Bias instability is the flat bottom, and rate random walk is the +1/2 slope at long τ.',
      ['White noise averages away with longer:', 'Averaging time', ['Cables', 'Mass']]],
    ['What makes a MEMS accelerometer\'s Brownian noise floor lower?', 'A heavier proof mass and a higher Q', ['A lighter proof mass and a lower Q', 'A higher operating temperature', 'A lower resonant frequency alone, with no other change'], 'Brownian noise', 'The thermal-mechanical noise floor is a_n = √(4kTω₀ ÷ (mQ)): it falls with a larger mass and a higher Q, and rises with temperature and with resonant frequency.',
      ['In a_n, the mass m sits:', 'Under the root, in the denominator', ['In the numerator', 'Nowhere']]],
    ['Why is the angle random walk conversion "density × 60"?', 'Because an hour is 3600 s and its square root is 60', ['Because a minute has 60 seconds in it, and ARW is per minute', 'Because most gyros are sampled at 60 Hz in their readout ASIC', 'Because 60 is a constant of the Allan plot'], 'angle random walk units', 'The noise density is per √Hz and per second. Integrating white rate noise gives an angle error growing as √time. Expressed per √hour, the √3600 s = 60 factor converts the units.',
      ['The square root of 3600 is:', '60', ['36', '600']]],
    ['Why does a MEMS gyroscope want a vacuum package?', 'Less gas damping means a higher Q', ['To keep the device cool in operation', 'To make the proof mass lighter', 'To stop the capacitive plates from touching'], 'vacuum for gyros', 'Gas damping lowers Q and adds noise. A vacuum cavity raises Q, so the drive mode moves more for the same drive power.',
      ['A higher Q means:', 'Less damping', ['More gas', 'Lower mass']]],
    ['Why do accelerometers trap gas on purpose?', 'To damp the ringing after a shock', ['To raise the quality factor for sensitivity', 'To keep the proof mass heavier in use', 'To cool the readout ASIC down'], 'damping in accelerometers', 'An accelerometer that rings after a shock reads wrongly for a while, so its gas damping is set near critical. Gyros want the opposite: a high Q.',
      ['Near-critical damping stops:', 'Ringing', ['Gravity', 'Capacitance']]],
  ], (why) => `${why}.`),
]);

export const memsBoss = bossOf(memsPractice, 'boss-mems', 'The Sensor Teardown', 'resonance, deflection, capacitive readout and Q', 200,
  'Boss fight, {name}. Teardown of a competitor\'s MEMS accelerometer. What is it, and how does its readout work? Exam rules.', [0, 1, 2, 3],
  [mc('Why do MEMS gyroscopes sit in a vacuum cavity while accelerometers often do not?', ['A vacuum is cheaper and simpler to package than a gas-filled cavity is', 'A gyroscope wants a high Q; an accelerometer wants near-critical damping', 'They need different wafer sizes, so the two cannot share one cavity design', 'The vacuum cools the proof mass, which also lowers the thermal noise a lot'], 1, 'The accelerometer must not ring after a shock; the gas in the cavity sets the damping. Damping is a design choice: gas in the cavity sets it.')]);

// ------------------------------------------------------------------ neuromorphic

export const neuroPractice = practice('practice-neuro', 'Neuromorphic Drills', 'crossbar currents, energy per MAC, integrate-and-fire, conductance levels', [
  (r, d) => {
    const rows = tier(d, 2, 3, 4);
    const v = Array.from({ length: rows }, () => pick(r, [0.1, 0.2, 0.3])), g = Array.from({ length: rows }, () => pick(r, [10, 20, 40, 50]));
    const i = v.reduce((s, x, k) => s + x * g[k], 0);
    const parts = v.map((x, k) => ({ x, gk: g[k], p: x * g[k] }));
    return walk(ask(`A crossbar column has inputs ${v.join(', ')} V on conductances ${g.join(', ')} µS. What is the column current, in µA? (I = Σ V·G)`, qty(i, 'µA', 0.02, sig(i)), `${parts.map((p) => `${p.x}×${p.gk}`).join(' + ')} = ${sig(i)} µA.`, 'Sum voltage times conductance.'),
      'a crossbar as a dot product', 'Each memory cell passes a current V·G (Ohm\'s law) and the currents on a column wire add (Kirchhoff). So the column current is the dot product of the input voltages with the stored conductances, computed in one analog step.',
      ...parts.slice(0, -1).map((p) => calc(`Cell current V × G (${p.x} V × ${p.gk} µS):`, `${p.x} × ${p.gk}`, p.p, 'µA', sig(p.p), 0.01)),
      calc('Add every cell current, in µA:', parts.map((p) => sig(p.p)).join(' + '), i, 'µA', sig(i), 0.02));
  },
  (r, d) => {
    const e = pick(r, [10, 20, 50]), n = pick(r, [100, 500, 2000]) * 1e6, dig = pick(r, [1, 2, 5]);
    if (d < 3) { const uj = e * n * 1e-15 * 1e6; return walk(ask(`In-memory MACs cost ${e} fJ each. A network does ${n / 1e6} million MACs per inference. Energy per inference, in µJ?`, qty(uj, 'µJ', 0.03, sig(uj)), `${e} fJ × ${n / 1e6}e6 = ${sig(uj)} µJ.`, 'Energy × count.'),
      'energy per inference', 'Total energy is the energy of one operation times the number of operations. Femtojoules times millions of operations lands in microjoules.',
      calc('Energy in J: fJ × 1e-15 × count:', `${e}e-15 × ${n}`, e * 1e-15 * n, 'J', sig(e * 1e-15 * n), 0.03), calc('Convert J to µJ (× 1e6):', `${sig(e * 1e-15 * n)} × 1e6`, uj, 'µJ', sig(uj), 0.03)); }
    const ratio = (dig * 1000) / e;
    return walk(ask(`A digital accelerator spends ${dig} pJ per MAC including data movement; an in-memory array spends ${e} fJ. How many times more energy does the digital one use?`, qty(ratio, '', 0.03, sig(ratio)), `${dig * 1000} fJ ÷ ${e} fJ = ${sig(ratio)}×. This gap is the entire motivation, before accounting for the ADCs and the precision limits of analog.`, 'Convert pJ to fJ, then divide.'),
      'comparing energy per operation', 'Put both energies in the same unit before dividing. 1 pJ is 1000 fJ.',
      calc('Digital energy in fJ:', `${dig} × 1000`, dig * 1000, 'fJ', String(dig * 1000), 0.005), calc('Ratio digital ÷ in-memory:', `${dig * 1000} / ${e}`, ratio, '', sig(ratio), 0.03));
  },
  (r, d) => {
    const tau = pick(r, [10, 20, 50]), vth = pick(r, [0.5, 0.63]), vin = pick(r, [1.0, 1.5, 2.0]);
    const t = -tau * Math.log(1 - vth / vin);
    if (d < 3) return walk(ask(`An LIF neuron (τ = ${tau} ms) is driven toward ${vin} V and fires at ${vth} V. After how many ms does it fire? (V(t) = V∞(1 − e^(−t/τ)))`, qty(t, 'ms', 0.03, sig(t)), `t = −${tau} · ln(1 − ${vth}/${vin}) = ${sig(t)} ms.`, 'Solve the exponential for t.'),
      'time to fire', 'The membrane charges exponentially toward the input level. It fires when it reaches the threshold, so solve V∞(1 − e^(−t/τ)) = V_th: t = −τ·ln(1 − V_th/V∞).',
      calc('Fraction 1 − Vth/V∞:', `1 − ${vth}/${vin}`, 1 - vth / vin, '', sig(1 - vth / vin), 0.005),
      calc('t = −τ × ln(fraction), in ms:', `−${tau} × ln(${sig(1 - vth / vin)})`, t, 'ms', sig(t), 0.03));
    const ref = pick(r, [2, 5]);
    const rate = 1000 / (t + ref);
    return walk(ask(`The same neuron (fires after ${sig(t)} ms of charging) has a ${ref} ms refractory period after each spike. What is its firing rate, in Hz?`, qty(rate, 'Hz', 0.03, sig(rate)), `Period = ${sig(t)} + ${ref} = ${sig(t + ref)} ms → ${sig(rate)} Hz.`, 'One over the total period.'),
      'firing rate', 'Each cycle is charging time plus the refractory period during which the neuron cannot fire. The rate is one over that period.',
      calc('Period in ms:', `${sig(t)} + ${ref}`, t + ref, 'ms', sig(t + ref), 0.01), calc('Rate = 1000 ÷ period (ms), in Hz:', `1000 / ${sig(t + ref)}`, rate, 'Hz', sig(rate), 0.03));
  },
  (r, d) => {
    const bits = tier(d, 3, 4, 6), gmax = pick(r, [20, 25, 50, 80, 100, 120, 200]), levels = 2 ** bits;
    if (d < 3) return walk(ask(`A memristor cell stores ${bits} bits. How many distinct conductance levels must it hold, reliably?`, qty(levels, '', 0.001, String(levels)), `2^${bits} = ${levels} levels. A cell with ${levels} reliably distinguishable states stores ${bits} bits.`, 'Two to the number of bits.'),
      'conductance levels', 'A cell that stores n bits must distinguish 2^n separate conductance values. Noise, drift and variability limit how many a real device can hold, which is why analog weights are often 4 bits or fewer per cell.',
      count(`2^${bits}:`, `2^${bits}`, levels));
    const step = gmax / (levels - 1);
    return walk(ask(`${levels} equally spaced conductance levels span 0 to ${gmax} µS. What is the spacing between adjacent levels, in µS?`, qty(step, 'µS', 0.02, sig(step)), `${gmax} / (${levels} − 1) = ${sig(step)} µS. If the cell noise is a large fraction of this step, neighbouring levels get confused.`, 'Range over (levels − 1).'),
      'level spacing', 'N levels have N − 1 gaps between them. The spacing is the range divided by the number of gaps; comparing it with the conductance noise shows whether the levels are usable.',
      count('Gaps = levels − 1:', `${levels} − 1`, levels - 1), calc('Spacing = range ÷ gaps, in µS:', `${gmax} / ${levels - 1}`, step, 'µS', sig(step), 0.02));
  },
]);

export const neuroBoss = bossOf(neuroPractice, 'boss-neuro', 'The In-Memory Accelerator', 'crossbar currents, energy, LIF neurons and conductance levels', 200,
  'Boss fight, {name}. A startup pitches an analog in-memory inference chip. Check their numbers. Exam rules.', [0, 1, 2, 3],
  [mc('Which limits the usable precision of an analog crossbar most?', ['The package, which decides how many pins the array can offer', 'Device variability, drift, read noise, IR drop and ADC resolution', 'The clock only, because a slow clock makes every column noisier', 'The number of columns only, since the sums get less exact with more'], 1, 'Networks are trained with that noise in the loop to tolerate it. Noise-aware training makes networks robust to analog errors.')]);

// ------------------------------------------------------------------ emerging devices

export const emergingPractice = practice('practice-emerging', 'Emerging Device Drills', 'subthreshold swing, leakage decades, tunnel magnetoresistance, scaling', [
  (r, d) => {
    const vt = pick(r, [300, 400, 500]), ss = pick(r, [60, 70, 80]);
    const dec = vt / ss;
    if (d < 3) return walk(ask(`A transistor has Vt = ${vt} mV and a subthreshold swing of ${ss} mV/decade. How many decades below its threshold current is the off current (gate at 0 V)?`, qty(dec, '', 0.03, sig(dec)), `${vt} / ${ss} = ${sig(dec)} decades.`, 'Vt divided by SS.'),
      'leakage decades', 'Below threshold the current falls by a factor of 10 for every SS millivolts of gate voltage. From Vt down to 0 V that is Vt divided by SS decades.',
      calc('Decades = Vt ÷ SS:', `${vt} / ${ss}`, dec, '', sig(dec), 0.03));
    const ss2 = ss + 20;
    const factor = 10 ** (vt / ss - vt / ss2);
    return walk(ask(`Two transistors share Vt = ${vt} mV; one has SS = ${ss} mV/dec and the other ${ss2} mV/dec. How many times more off-current does the worse one have?`, qty(factor, '', 0.05, sig(factor)), `10^(${vt}/${ss} − ${vt}/${ss2}) = 10^${sig(vt / ss - vt / ss2)} = ${sig(factor)}×.`, 'Compare decades, then take 10 to the difference.'),
      'swing versus leakage', 'Each device is Vt/SS decades below its threshold current at 0 V. The ratio of their off-currents is 10 raised to the difference in decades.',
      calc(`Decades for SS = ${ss}:`, `${vt} / ${ss}`, vt / ss, '', sig(vt / ss), 0.01), calc(`Decades for SS = ${ss2}:`, `${vt} / ${ss2}`, vt / ss2, '', sig(vt / ss2), 0.01),
      calc('Ratio = 10^(difference):', `10^(${sig(vt / ss - vt / ss2)})`, factor, '', sig(factor), 0.05));
  },
  (r, d) => {
    const rp = pick(r, [2, 3, 5]), tmr = pick(r, [100, 150, 200]);
    const rap = rp * (1 + tmr / 100);
    if (d === 1) return walk(ask(`An MRAM cell: R_P = ${rp} kΩ and TMR = ${tmr}%. What is R_AP, in kΩ? (TMR = (R_AP − R_P)/R_P)`, qty(rap, 'kΩ', 0.02, sig(rap)), `${rp} × (1 + ${tmr / 100}) = ${sig(rap)} kΩ.`, 'R_P × (1 + TMR).'),
      'tunnel magnetoresistance', 'TMR is the relative resistance difference between the anti-parallel and parallel states. Solving for R_AP: R_AP = R_P·(1 + TMR).',
      calc('1 + TMR:', `1 + ${tmr}/100`, 1 + tmr / 100, '', String(1 + tmr / 100), 0.005), calc('R_AP = R_P × (1 + TMR), in kΩ:', `${rp} × ${1 + tmr / 100}`, rap, 'kΩ', sig(rap), 0.02));
    const iread = pick(r, [10, 20]);
    return walk(ask(`A read current of ${iread} µA flows through an MRAM cell with R_P = ${rp} kΩ and R_AP = ${sig(rap)} kΩ. What voltage difference between the two states, in mV?`, qty(iread * (rap - rp), 'mV', 0.03, sig(iread * (rap - rp))), `ΔV = ${iread} µA × (${sig(rap)} − ${rp}) kΩ = ${sig(iread * (rap - rp))} mV. The sense amplifier compares against a reference between the two levels.`, 'Current × resistance difference.'),
      'MRAM read margin', 'A fixed read current develops a different voltage across each state. The difference is the signal the sense amplifier must resolve: current times the difference of the resistances (µA × kΩ = mV).',
      calc('R_AP − R_P, in kΩ:', `${sig(rap)} − ${rp}`, rap - rp, 'kΩ', sig(rap - rp), 0.02),
      calc('ΔV = I × ΔR, in mV (µA × kΩ):', `${iread} × ${sig(rap - rp)}`, iread * (rap - rp), 'mV', sig(iread * (rap - rp)), 0.03));
  },
  (r, d) => {
    const cpp = pick(r, [42, 45, 48, 54, 57, 60]), th = pick(r, [4, 5, 6, 7]), w = pick(r, [2, 3, 4, 5]);
    const area = w * cpp * th * 28;
    if (d === 1) return walk(ask(`A logic cell is ${w} contact pitches wide (CPP = ${cpp} nm) and ${th} metal tracks tall (28 nm pitch). What is its area, in nm²?`, qty(area, 'nm²', 0.01, String(area)), `${w} × ${cpp} × ${th} × 28 = ${area} nm².`, 'Width times height.'),
      'standard-cell area', 'A cell\'s width is its number of contact pitches times the CPP; its height is the number of tracks times the track pitch. Area is the product.',
      count('Width in nm:', `${w} × ${cpp}`, w * cpp), count('Height in nm:', `${th} × 28`, th * 28), count('Area in nm²:', `${w * cpp} × ${th * 28}`, area));
    const th2 = th - 1;
    const sav = (1 - th2 / th) * 100;
    return walk(ask(`A cell is ${w} contact pitches wide (CPP = ${cpp} nm). Stacking NMOS over PMOS (a CFET) cuts the cell height from ${th} tracks to ${th2}. What percentage of area does that save? (same width)`, qty(sav, '%', 0.03, sig(sav)), `1 − ${th2}/${th} = ${sig(sav)}%.`, 'One minus the height ratio.'),
      'CFET area benefit', 'The cell width stays the same, so the area scales with the height in tracks. The saving is one minus the new height over the old height.',
      calc('Height ratio:', `${th2} / ${th}`, th2 / th, '', sig(th2 / th), 0.01), calc('Saving in %:', `(1 − ${sig(th2 / th)}) × 100`, sav, '%', sig(sav), 0.03));
  },
  (r) => {
    const n0 = pick(r, [10, 20, 50]), t = pick(r, [2, 3]), yrs = pick(r, [6, 10, 12]);
    const f = 2 ** (yrs / t);
    const n = n0 * f;
    return walk(ask(`A process offers ${n0} billion transistors per chip. If density doubles every ${t} years, how many billions after ${yrs} years?`, qty(n, 'B', 0.03, sig(n)), `${n0} × 2^(${yrs}/${t}) = ${sig(n)} billion.`, 'Count the doublings.'),
      'exponential scaling', 'If a quantity doubles every T years, after Y years it has doubled Y/T times. Multiply the starting value by 2 to that power.',
      calc('Doublings = years ÷ period:', `${yrs} / ${t}`, yrs / t, '', sig(yrs / t), 0.01), calc('Count = start × 2^doublings:', `${n0} × 2^${sig(yrs / t)}`, n, 'B', sig(n), 0.03));
  },
  (r, d) => {
    // G2.9: cell height = tracks × metal pitch; node names are labels, so compare drawn dimensions.
    const tracks = pick(r, [5, 6, 7]), mp = pick(r, [24, 28, 30, 32]);
    const idea = 'A standard cell is a fixed number of metal tracks tall, so its height is the tracks times the metal pitch. Node names such as "2 nm" are labels, so cells and nodes are compared by drawn dimensions: contacted gate pitch, metal pitch, cell height in tracks and SRAM bit-cell area.';
    if (d === 1) return walk(ask(`A standard cell is ${tracks} tracks tall with a ${mp} nm metal pitch. What is its height, in nm?`, qty(tracks * mp, 'nm', 0.01, String(tracks * mp)), `${tracks} × ${mp} = ${tracks * mp} nm.`, 'Tracks times pitch.'),
      'cell height', idea,
      count('Height in nm = tracks × pitch:', `${tracks} × ${mp}`, tracks * mp));
    const h = tracks * mp;
    if (d === 2) return walk(ask(`A cell is ${h} nm tall and the metal pitch is ${mp} nm. How many tracks tall is it?`, qty(tracks, '', 0.001, String(tracks)), `${h} / ${mp} = ${tracks} tracks.`, 'Height over pitch.'),
      'cell height in tracks', idea,
      count('Tracks = height ÷ pitch:', `${h} / ${mp}`, tracks));
    const cpp = pick(r, [45, 48, 54]), w = pick(r, [2, 3, 4]), area = h * cpp * w;
    return walk(ask(`A ${w}-CPP-wide cell (CPP = ${cpp} nm) is ${tracks} tracks tall at a ${mp} nm metal pitch. What is its area, in nm²?`, qty(area, 'nm²', 0.01, String(area)), `Height ${tracks} × ${mp} = ${h} nm; width ${w} × ${cpp} = ${w * cpp} nm; area ${area.toLocaleString('en-US')} nm². Compare nodes by this kind of number, not by their names.`, 'Height times width.'),
      'cell area', idea,
      count('Height in nm:', `${tracks} × ${mp}`, h), count('Width in nm:', `${w} × ${cpp}`, w * cpp), count('Area in nm²:', `${h} × ${w * cpp}`, area));
  },
  (r) => concept(r, [
    ['Which metric would you compare across two foundries\' "2 nm" nodes?', 'Density, or the gate and metal pitches', ['The node name, since it is the gate length', 'The date each node was announced', 'The wafer diameter'], 'comparing nodes', 'Node names are labels and no longer measure any feature. What is physically drawn can be compared: contacted gate pitch, metal pitch, cell height in tracks, SRAM bit-cell area, and the transistor density they give.',
      ['A node name such as "2 nm" is a:', 'Label', ['Gate length', 'Wire width']]],
    ['What does the industry roadmap expect after gate-all-around?', 'Stacked CFETs, from about the early 2030s', ['2D channels in volume, within a few years', 'A return to planar transistors', 'Vacuum tubes on silicon'], 'the device roadmap', 'Gate-all-around nanosheets are expected to carry logic through the late 2020s. Stacked complementary FETs (N over P) follow from about the early 2030s. 2D-material channels are still in research.',
      ['A CFET stacks N over:', 'P', ['N', 'Metal']]],
    ['Where are 2D-material channels on the roadmap?', 'Still in research, with few products yet', ['In volume production at the latest nodes', 'Already replacing nanosheets entirely', 'Abandoned, since contacts cannot be made'], 'status of 2D channels', 'Two-dimensional channels give excellent gate control, but low-resistance contacts and large uniform films are unsolved, so they remain in research.',
      ['The main obstacle is the:', 'Contacts', ['Gate oxide colour', 'Package']]],
    ['How is standard-cell height found from its tracks?', 'Tracks multiplied by the metal pitch', ['Tracks multiplied by the contacted gate pitch', 'Tracks divided by the metal pitch', 'Metal pitch divided by the SRAM bit-cell area'], 'cell height', 'A cell is a fixed number of metal tracks tall, and each track is one metal pitch, so height = tracks × metal pitch.',
      ['Each track is one:', 'Metal pitch', ['Gate pitch', 'Via']]],
    ['What is the benefit of backside power delivery?', 'It frees the front metal for signal routing', ['It makes the package cheaper to assemble', 'It removes the need for power rails', 'It lowers the transistors\' threshold voltage'], 'backside power', 'Power rails move behind the transistors, so the front-side metal is left for signals. That cuts congestion and IR drop, at the cost of a harder thermal path and process.',
      ['Rails move to the wafer\'s:', 'Back', ['Edge', 'Top']]],
    ['Why is SRAM bit-cell area a useful metric?', 'It reflects the drawn pitches of the process', ['It is set directly by the marketing name of the node', 'It counts the metal layers the process has', 'It measures the standby leakage of each bit cell'], 'SRAM bit-cell area', 'The SRAM cell is drawn at the tightest pitches a process offers, so its area shows how dense the process really is, whatever it is called.',
      ['SRAM is drawn at the process\'s:', 'Tightest pitches', ['Loosest pitches', 'Widest wires']]],
  ], (why) => `${why}.`),
]);

export const emergingBoss = bossOf(emergingPractice, 'boss-emerging', 'The Roadmap Review', 'subthreshold leakage, MRAM margins, cell area and scaling', 200,
  'Boss fight, {name}. The technology roadmap meeting: leakage, memory margin, area and density claims. Exam rules.', [0, 1, 2, 3],
  [mc('Why can a 2D semiconductor channel keep good gate control at very short channel lengths?', ['It is a better conductor than silicon, so it needs less gate drive', 'It is a few atoms thick, so the gate controls the whole channel', 'It needs no gate at all, because the carriers stay confined anyway', 'It runs cooler than a bulk channel, which reduces leakage current'], 1, 'Short-channel leakage is suppressed. Contacts, defects and wafer-scale growth remain the open problems. Electrostatic control scales with channel thickness.')]);

// ------------------------------------------------------------------ applications engineering & TPM

export const aetpmPractice = practice('practice-ae-tpm', 'AE & TPM Drills', 'critical path, cost per good die, NRE amortization, schedule slip', [
  (r, d) => {
    const a = pick(r, [10, 15, 20]), b = pick(r, [20, 30, 40]), c = pick(r, [15, 25, 35]), e = pick(r, [10, 20]), f = pick(r, [5, 10, 15]);
    if (d < 3) {
      const p1 = a + b + e, p2 = a + c + e;
      return walk(ask(`Task A (${a} d) feeds both B (${b} d) and C (${c} d), and D (${e} d) needs both B and C. What is the minimum project length, in days?`, qty(Math.max(p1, p2), 'd', 0.001, String(Math.max(p1, p2))), `A→B→D = ${p1}, A→C→D = ${p2}; the longer path is ${Math.max(p1, p2)} days.`, 'Longest path.'),
        'the critical path', 'When tasks depend on each other, the project cannot finish before its longest chain of dependent tasks. That chain is the critical path; shortening anything else does not help.',
        count('Path A→B→D:', `${a} + ${b} + ${e}`, p1), count('Path A→C→D:', `${a} + ${c} + ${e}`, p2), count('Project length = the longer one:', `max(${p1}, ${p2})`, Math.max(p1, p2)));
    }
    const p1 = a + b + e + f, p2 = a + c + e + f;
    const slack = Math.abs(p1 - p2);
    return walk(ask(`A (${a} d) feeds B (${b} d) and C (${c} d); D (${e} d) needs both B and C; E (${f} d) follows D. How many days of slack does the non-critical branch (B or C, whichever is shorter) have?`, qty(Math.abs(b - c), 'd', 0.001, String(Math.abs(b - c))), `The branches differ by |${b} − ${c}| = ${Math.abs(b - c)} days: the shorter one can slip that long without delaying the project (paths ${p1} vs ${p2}; slack ${slack}).`, 'Difference of the two parallel branches.'),
      'schedule slack', 'Slack is how long a task can slip before it delays the project. For two parallel branches, the shorter has slack equal to the difference between them; the longer has none.',
      count('Longer branch:', `max(${b}, ${c})`, Math.max(b, c)), count('Shorter branch:', `min(${b}, ${c})`, Math.min(b, c)), count('Slack = difference:', `${Math.max(b, c)} − ${Math.min(b, c)}`, Math.abs(b - c)));
  },
  (r, d) => {
    const wafer = pick(r, [8000, 12000, 17000]), dies = pick(r, [300, 500, 700]), y = pick(r, [60, 70, 80, 90]);
    const c = wafer / ((dies * y) / 100);
    if (d === 1) return walk(ask(`A wafer costs $${wafer} and carries ${dies} dies at ${y}% yield. Cost per good die, in dollars?`, qty(c, '$', 0.02, sig(c)), `$${wafer} ÷ (${dies} × ${y / 100}) = $${sig(c)}.`, 'Wafer cost over good dies.'),
      'cost per good die', 'You pay for the whole wafer but only the good dies can be sold, so the cost of one good die is the wafer cost divided by the number of good dies.',
      calc('Good dies = dies × yield:', `${dies} × ${y / 100}`, (dies * y) / 100, '', sig((dies * y) / 100), 0.005), calc('Cost per good die, in $:', `${wafer} / ${sig((dies * y) / 100)}`, c, '$', sig(c), 0.02));
    const pk = pick(r, [2, 4]), tst = pick(r, [1, 2]);
    const tot = c + pk + tst;
    return walk(ask(`A good die costs $${sig(c)} (wafer $${wafer}, ${dies} dies, ${y}% yield). Packaging adds $${pk} and test adds $${tst}. What is the unit cost, in dollars?`, qty(tot, '$', 0.02, sig(tot)), `$${sig(c)} + $${pk} + $${tst} = $${sig(tot)}.`, 'Add every step.'),
      'unit cost', 'The cost of a shipped chip is the cost of the good die plus every later step: packaging and testing, each paid on every unit.',
      calc('Cost per good die:', `${wafer} / (${dies} × ${y / 100})`, c, '$', sig(c), 0.02), calc('Add package and test:', `${sig(c)} + ${pk} + ${tst}`, tot, '$', sig(tot), 0.02));
  },
  (r, d) => {
    const nre = pick(r, [5, 10, 20, 40]) * 1e6, unit = pick(r, [4, 8, 12]), vol = pick(r, [1, 2, 5, 10]) * 1e6;
    const c = nre / vol + unit;
    if (d < 3) return walk(ask(`A chip has $${nre / 1e6} M of NRE (masks, design) and costs $${unit} per unit. At ${vol / 1e6} M units, what is the all-in cost per unit?`, qty(c, '$', 0.02, sig(c)), `$${nre / 1e6}M ÷ ${vol / 1e6}M = $${sig(nre / vol)}, plus $${unit} = $${sig(c)}.`, 'NRE over volume, plus the unit cost.'),
      'amortizing NRE', 'One-time costs are spread over every unit sold. The per-unit share is NRE divided by volume; add the variable cost of making each unit.',
      calc('NRE per unit = NRE ÷ volume:', `${nre / 1e6}e6 / ${vol / 1e6}e6`, nre / vol, '$', sig(nre / vol), 0.02), calc('All-in unit cost:', `${sig(nre / vol)} + ${unit}`, c, '$', sig(c), 0.02));
    const price = unit * 2;
    const be = nre / (price - unit);
    return walk(ask(`The chip sells for $${price} and costs $${unit} to make. With $${nre / 1e6} M of NRE, how many million units must be sold to break even?`, qty(be / 1e6, 'M', 0.03, sig(be / 1e6)), `Margin per unit = $${price - unit}; $${nre / 1e6}M ÷ $${price - unit} = ${sig(be / 1e6)} M units.`, 'NRE over margin per unit.'),
      'break-even volume', 'Each unit sold contributes its price minus its variable cost toward paying back the NRE. Break-even is when the accumulated contribution equals the NRE.',
      calc('Margin per unit = price − cost:', `${price} − ${unit}`, price - unit, '$', String(price - unit), 0.005), calc('Units = NRE ÷ margin, in millions:', `${nre / 1e6}e6 / ${price - unit} / 1e6`, be / 1e6, 'M', sig(be / 1e6), 0.03));
  },
  (r) => {
    const slackD = pick(r, [5, 10, 15]), slip = slackD + pick(r, [-3, 4, 10]);
    const delay = Math.max(0, slip - slackD);
    return walk(ask(`A task off the critical path has ${slackD} days of slack. It slips by ${slip} days. By how many days does the project end date move?`, qty(delay, 'd', 0.001, String(delay)), `${slip} − ${slackD} = ${slip - slackD}; the project only moves by the part of the slip that exceeds the slack: ${delay} days.`, 'Slip beyond the slack.'),
      'slip and slack', 'Slack absorbs slip: a delay on a non-critical task changes nothing until it uses up all its slack, and only the excess delays the project.',
      count('Slip minus slack:', `${slip} − ${slackD}`, slip - slackD),
      choice('If that number is zero or negative, the project end date', 'does not move: the slack absorbed the slip', ['moves by the full slip', 'moves by the slack']),
      count('Project delay = max(0, slip − slack):', `max(0, ${slip - slackD})`, delay));
  },
]);

export const aetpmBoss = bossOf(aetpmPractice, 'boss-ae-tpm', 'The Launch Review', 'critical path, die cost, NRE and slip', 200,
  'Boss fight, {name}. The launch review with the VP: schedule, cost and risk. Exam rules.', [0, 1, 2, 3],
  [mc('A customer reports that your chip does not boot on their board. What is the best first step?', ['Replace the chip, in case this one unit is faulty from the batch they received', 'Ask for their schematic and power-up scope captures to compare with the eval board', 'Escalate the issue to the design team immediately, as a field failure that needs them', 'Update the firmware on the part to the latest released version, then retry the boot'], 1, 'Supplies, reset, clock and boot straps. The known-good evaluation board is your control experiment; most boot failures are board-level. The known-good evaluation board is your control experiment; most boot failures are board-level.')]);

export const FRONTIER_PRACTICE_B = [sensorsPractice, memsPractice, neuroPractice, emergingPractice, aetpmPractice];
export const FRONTIER_BOSSES_B = [sensorsBoss, memsBoss, neuroBoss, emergingBoss, aetpmBoss];

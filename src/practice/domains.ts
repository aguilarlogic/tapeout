// Practice banks and bosses for the domain chips of Act 7: AI accelerators, hardware security, functional
// safety, silicon photonics, qubits and quantum control electronics.
import { num, qty } from '../lessons/answers';
import { art, ask, mc, pick, say, type Rng } from '../lessons/types';
import { boss, practice, tier } from './types';
import { hex, mcs, sig } from './util';

/** A concept question: [question, right answer, wrong answers, why the answer is right]. */
const concept = (r: Rng, qs: readonly (readonly [string, string, readonly string[], string])[]) => {
  const [q, right, wrong, why] = pick(r, qs);
  return mcs(r, q, right, wrong, `${right}. ${why}`);
};
const popcount = (x: number) => { let n = 0; for (; x; x >>= 1) n += x & 1; return n; };
const H = 6.626e-34, KB = 1.38e-23;

// ------------------------------------------------------------------ AI accelerators

export const npuPractice = practice('practice-npu', 'AI Hardware Drills', 'MAC counts, TOPS, array utilization, memory footprints, roofline, LLM decode', [
  (r, d) => {
    if (d < 3) {
      const m = pick(r, [64, 128, 512]), k = pick(r, [256, 1024, 4096]), n = pick(r, [64, 256, 1024]);
      return ask(`How many MACs does a (${m}×${k}) × (${k}×${n}) matrix multiply need?`, qty(m * n * k, '', 0.01, String(m * n * k)), `M × N × K = ${m} × ${n} × ${k} = ${(m * n * k).toLocaleString('en-US')}. Every output needs a K-long dot product.`, 'One K-long dot product per output element.');
    }
    const h = pick(r, [14, 28, 56]), ci = pick(r, [64, 128, 256]), co = pick(r, [64, 128, 256]), k = 3, macs = h * h * ci * co * k * k;
    return ask(`A 3×3 convolution produces a ${h}×${h}×${co} output from ${ci} input channels. How many MACs?`, qty(macs, '', 0.01, String(macs)), `Outputs ${h}×${h}×${co}, each a sum over ${ci} × 3 × 3 = ${ci * 9} products: ${macs.toLocaleString('en-US')} MACs.`, 'Outputs × (input channels × kernel area).');
  },
  (r, d) => {
    const n = pick(r, [64, 128, 256]), f = pick(r, [1, 1.5, 2]), tops = (2 * n * n * f) / 1000;
    if (d === 1) return ask(`A ${n}×${n} systolic array of MACs runs at ${f} GHz. Peak throughput, in TOPS (2 ops per MAC)?`, qty(tops, 'TOPS', 0.02, sig(tops)), `${n}² × 2 × ${f}e9 = ${sig(tops)} TOPS.`, 'MACs per cycle × 2 × frequency.');
    const cols = pick(r, [100, 200, 300, 520]), tiles = Math.ceil(cols / n), u = (cols / (tiles * n)) * 100;
    if (d === 2) return ask(`A ${n}-wide array processes a layer with ${cols} output columns, in tiles of ${n}. What fraction of the array does useful work, in %?`, qty(u, '%', 0.02, sig(u)), `${tiles} tiles × ${n} = ${tiles * n} columns of hardware for ${cols} of work: ${sig(u)}%. Layer shapes that do not match the array waste peak TOPS.`, 'Round the tile count up.');
    const rows = pick(r, [70, 150, 300]), rt = Math.ceil(rows / n), u2 = ((cols * rows) / (tiles * n * rt * n)) * 100;
    return ask(`A ${n}×${n} array runs a ${rows}×${cols} weight matrix in ${n}×${n} tiles. Utilization, in %?`, qty(u2, '%', 0.02, sig(u2)), `${rt} × ${tiles} tiles = ${rt * tiles} × ${n * n} slots for ${rows * cols} weights: ${sig(u2)}%.`, 'Tiles in each dimension, rounded up.');
  },
  (r, d) => {
    const b = pick(r, [7, 13, 70]), fmt = pick(r, [['FP16', 2], ['INT8', 1], ['INT4', 0.5]] as const), gb = b * fmt[1];
    if (d < 3) return ask(`How much memory do the weights of a ${b}B-parameter model take in ${fmt[0]}, in GB?`, qty(gb, 'GB', 0.02, sig(gb)), `${b}e9 × ${fmt[1]} bytes = ${sig(gb)} GB. Quantizing to fewer bits is the cheapest way to fit a model on fewer chips.`, 'Parameters × bytes per parameter.');
    const layers = pick(r, [32, 40, 80]), dm = pick(r, [4096, 5120, 8192]), tok = pick(r, [4096, 32768]), kv = (2 * layers * dm * tok * 2) / 1e9;
    return ask(`KV cache: ${layers} layers, model width ${dm}, ${tok} tokens of context, FP16. Size, in GB? (2 × layers × width × tokens × 2 bytes)`, qty(kv, 'GB', 0.02, sig(kv)), `2 (K and V) × ${layers} × ${dm} × ${tok} × 2 bytes = ${sig(kv)} GB per sequence. Long contexts can need more memory than the weights.`, 'Keys and values, per layer, per token.');
  },
  (r, d) => {
    const bw = pick(r, [1, 2, 3.35]), b = pick(r, [7, 13, 70]), bytes = pick(r, [1, 2]), t = (bw * 1000) / (b * bytes);
    if (d < 3) return ask(`Each generated token reads every weight once (batch 1). ${bw} TB/s of HBM, a ${b}B-parameter model in ${bytes === 1 ? 'INT8' : 'FP16'}. Maximum tokens per second?`, qty(t, '', 0.03, sig(t)), `${bw * 1000} GB/s / ${b * bytes} GB = ${sig(t)} tokens/s. Decode is memory-bound: extra compute does not help.`, 'Bandwidth / bytes read per token.');
    const bs = pick(r, [8, 32]);
    return ask(`Same setup (${bw} TB/s, ${b}B params in ${bytes === 1 ? 'INT8' : 'FP16'}), but ${bs} users are batched: one pass over the weights produces one token for each. Tokens per second across all users (still memory-bound)?`, qty(t * bs, '', 0.03, sig(t * bs)), `${sig(t)} × ${bs} = ${sig(t * bs)}. Batching reuses each weight fetch ${bs} times, which is why serving is cheap per user but hard on latency.`, 'One weight pass now serves the whole batch.');
  },
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [256, 1024, 4096]), i = n / 3;
      return ask(`An N×N×N FP16 matmul (N = ${n}) does 2N³ FLOPs and moves 3N² values of 2 bytes. Arithmetic intensity, in FLOP/byte?`, qty(i, '', 0.02, sig(i)), `2N³ / (6N²) = N/3 = ${sig(i)}. Big matmuls reuse data a lot; that is why they run near peak.`, 'FLOPs / bytes.');
    }
    const peak = pick(r, [400, 1000, 2000]), bw = pick(r, [2, 3.35, 8]), ridge = peak / bw;
    if (d === 2) return ask(`A chip has ${peak} TFLOP/s and ${bw} TB/s. Ridge point of its roofline, in FLOP/byte?`, qty(ridge, '', 0.02, sig(ridge)), `${peak} / ${bw} = ${sig(ridge)} FLOP/byte. Kernels below that are memory-bound.`, 'Peak compute / bandwidth.');
    const i = pick(r, [10, 50, 200, 1000]), att = Math.min(peak, bw * i);
    return ask(`${peak} TFLOP/s peak, ${bw} TB/s. A kernel has intensity ${i} FLOP/byte. Attainable TFLOP/s?`, qty(att, 'TFLOP/s', 0.02, sig(att)), `min(${peak}, ${bw} × ${i}) = ${sig(att)}: ${att < peak ? 'memory-bound' : 'compute-bound'}.`, 'The roofline: min(peak, BW × intensity).');
  },
  (r) => concept(r, [
    ['Why do systolic arrays beat CPUs on matrix math?', 'Massive data reuse: each operand fetched from memory feeds many MACs as it flows through the array', ['Higher clock frequency', 'Bigger caches', 'Better branch prediction'], 'Moving data costs more energy than the multiply. Reuse inside the array amortizes each fetch over many operations.'],
    ['What does "weight stationary" mean in a dataflow?', 'Weights are loaded into the PEs once and stay there while activations stream past', ['Weights never change during training', 'Weights are stored in flash', 'Activations stay fixed'], 'Keeping one operand in place removes its traffic entirely; which one to keep depends on the layer\'s shape.'],
    ['Why train in BF16 rather than FP16?', 'BF16 keeps FP32\'s exponent range, so gradients rarely overflow or underflow, at half the bits', ['BF16 is more precise', 'FP16 cannot be multiplied', 'BF16 uses less power per bit'], 'FP16 has 5 exponent bits and overflows easily; BF16\'s 8 match FP32, so it needs no loss scaling.'],
    ['What does 2:4 structured sparsity give hardware?', 'Two of every four weights are zero in a fixed pattern, so the hardware can skip them and double effective throughput', ['Random zeros anywhere', 'Smaller activations', 'Fewer layers'], 'A fixed pattern is easy for hardware to index, unlike random sparsity, which needs complex gather logic.'],
  ]),
]);

export const aiBoss = boss({
  id: 'boss-ai',
  title: 'The LLM Serving Chip',
  concept: 'size an accelerator for serving a large language model',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A customer wants to serve a 70B-parameter model at 30 tokens/s per user on one card. Your accelerator has 1000 TFLOP/s, 3.35 TB/s and 80 GB of HBM. Can it? Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('Weights in FP16, in GB?', qty(140, 'GB', 0.02, '140'), '70e9 × 2 = 140 GB: it does not fit in 80 GB.') },
    { t: 'gen', make: () => ask('Quantized to INT8, in GB?', qty(70, 'GB', 0.02, '70'), '70 GB fits, with 10 GB left for the KV cache.') },
    { t: 'gen', make: () => ask('Batch 1, INT8. Maximum tokens per second (every weight read once per token)?', qty(3350 / 70, '', 0.03, sig(3350 / 70)), `3350 / 70 = ${sig(3350 / 70)} tokens/s. It meets 30 tokens/s for one user.`) },
    { t: 'gen', make: () => { const kv = (2 * 80 * 8192 * 4096 * 1) / 1e9; return ask('KV cache: 80 layers, width 8192, 4096 tokens, INT8 (1 byte). Size per user, in GB?', qty(kv, 'GB', 0.02, sig(kv)), `2 × 80 × 8192 × 4096 × 1 = ${sig(kv)} GB. Only ${Math.floor(10 / kv)} user${Math.floor(10 / kv) === 1 ? '' : 's'} fit in the remaining 10 GB.`); } },
    { t: 'gen', make: () => ask('Decode intensity at batch 1 is about 2 FLOP per byte of weights. Ridge point of this chip, in FLOP/byte?', qty(1000 / 3.35, '', 0.02, sig(1000 / 3.35)), `1000 / 3.35 = ${sig(1000 / 3.35)}. At 2 FLOP/byte, decode uses under 1% of peak compute.`) },
    mc('To serve many users at 30 tokens/s each, what matters most?', ['More memory capacity and bandwidth (more HBM, or split the model across cards), and a smaller KV cache (grouped-query attention, quantized cache)', 'More TFLOP/s', 'A higher clock', 'Bigger on-chip caches only'], 0, 'LLM decode is memory-bound in both bandwidth and capacity. Compute is not the bottleneck.'),
  ],
  recap: ['Weight and KV-cache footprints.', 'Decode is memory-bound.', 'Roofline ridge point.', 'Quantization.'],
});

// ------------------------------------------------------------------ hardware security

export const hwsecPractice = practice('practice-hwsec', 'Security Drills', 'brute force, timing leaks, power models, fault injection odds', [
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [4, 6, 8]);
      return ask(`A ${n}-digit PIN is checked all at once. Worst-case guesses to brute force it?`, num(10 ** n), `10^${n} = ${(10 ** n).toLocaleString('en-US')}.`, 'Every combination.');
    }
    const n = pick(r, [4, 8, 16]);
    if (d === 2) return ask(`A ${n}-byte password is checked byte by byte with an early exit, and the response time reveals how many bytes matched. Worst-case guesses?`, num(n * 256), `Attack one byte at a time: ${n} × 256 = ${n * 256}, instead of 256^${n}. Constant-time comparison closes the leak.`, 'Each byte can be solved on its own.');
    const [bits, rate] = pick(r, [[40, 1e9], [56, 1e12], [64, 1e12]] as const), s = 2 ** bits / rate, hrs = s / 3600;
    return ask(`A ${bits}-bit key, and an attacker can try ${rate === 1e9 ? 'a billion' : 'a trillion'} keys per second. Worst-case time, in hours?`, qty(hrs, 'h', 0.03, sig(hrs)), `2^${bits} / ${rate} = ${sig(s)} s = ${sig(hrs)} h. Every extra bit doubles it; at 128 bits the answer is longer than the age of the universe.`, 'Keys / rate.');
  },
  (r, d) => {
    const v = Math.floor(r() * 256);
    if (d === 1) return ask(`Power leaks roughly with the Hamming weight of the data. What is the Hamming weight of ${hex(v)}?`, num(popcount(v)), `${hex(v)} = ${v.toString(2).padStart(8, '0')}: ${popcount(v)} ones.`, 'Count the 1 bits.');
    const w = Math.floor(r() * 256);
    if (d === 2) return ask(`A register changes from ${hex(v)} to ${hex(w)}. Hamming distance (the number of bits that toggle)?`, num(popcount(v ^ w)), `${hex(v)} XOR ${hex(w)} = ${hex(v ^ w)}, which has ${popcount(v ^ w)} ones. Toggling bits draw current, so this is what a power probe sees.`, 'XOR, then count ones.');
    return ask(`The first AES step computes data XOR key. The data byte is ${hex(v)} and you guess the key byte is ${hex(w)}. What Hamming weight does your model predict?`, num(popcount(v ^ w)), `${hex(v)} ⊕ ${hex(w)} = ${hex(v ^ w)} → weight ${popcount(v ^ w)}. DPA repeats this for all 256 guesses over thousands of traces; the guess whose predictions correlate with the power is the key.`, 'XOR the guess with the data.');
  },
  (r, d) => {
    const n = pick(r, [1000, 5000, 20000]), k = tier(d, 2, pick(r, [4, 10]), pick(r, [10, 30])), need = n * k * k;
    return ask(`A DPA attack needs ${n} traces. A countermeasure cuts the leaking signal by ${k}× (noise unchanged). About how many traces does the attack need now?`, qty(need, '', 0.02, String(need)), `Traces needed scale with 1/SNR²: ${n} × ${k}² = ${need.toLocaleString('en-US')}. Masking and noise raise the bar; they rarely make an attack impossible.`, 'Signal down k× → traces up k²×.');
  },
  (r, d) => {
    const p = pick(r, [0.001, 0.01, 0.05]), rate = pick(r, [1, 10]);
    if (d === 1) return ask(`Each voltage glitch skips the signature check with probability ${p}. Expected attempts until the first success?`, qty(1 / p, '', 0.01, String(1 / p)), `1 / ${p} = ${1 / p}.`, 'Geometric distribution: 1/p.');
    if (d === 2) return ask(`Each glitch works with probability ${p}, and the attacker can try ${rate} per second (reset included). Expected time to success, in s?`, qty(1 / p / rate, 's', 0.02, sig(1 / p / rate)), `${1 / p} attempts / ${rate} per second = ${sig(1 / p / rate)} s. Cheap glitching rigs make "unlikely" faults practical.`, 'Attempts / rate.');
    const n = pick(r, [100, 500]), pr = (1 - (1 - p) ** n) * 100;
    return ask(`Each glitch works with probability ${p}. Chance of at least one success in ${n} tries, in %?`, qty(pr, '%', 0.02, sig(pr)), `1 - (1 - ${p})^${n} = ${sig(pr)}%. Countermeasures: glitch detectors, redundant checks, random delays, and failing closed.`, '1 - P(all fail).');
  },
  (r) => concept(r, [
    ['What is a hardware root of trust?', 'A small, isolated, immutable block (boot ROM, fused keys, crypto) that verifies the first code, which verifies the next', ['The first transistor', 'The operating system', 'A password manager'], 'Each stage checks the next before running it. The root is trusted because it cannot be changed.'],
    ['How did Spectre leak secrets?', 'Speculatively executed instructions that were later cancelled still left traces in the cache that could be timed', ['It printed memory', 'It broke AES', 'It glitched the voltage'], 'The architectural state was rolled back, but the microarchitectural state (the cache) was not.'],
    ['What is a PUF?', 'A circuit that turns random manufacturing variation into a device-unique key that is never stored', ['A cheap cipher', 'A fuse bank', 'A random number from software'], 'Nothing is stored in fuses to read out; the key is re-derived from the physics each time, with error correction.'],
    ['Why do secure chips run crypto in constant time?', 'So execution time never depends on secret data, closing timing side channels', ['To save power', 'To make the clock simpler', 'Because it is faster'], 'Any branch or memory access that depends on a secret can show up in timing, cache state or power.'],
    ['What does a secure boot chain check at each stage?', 'A signature of the next image, using a key anchored in the root of trust', ['The file size', 'The CPU temperature', 'That the image is compressed'], 'A signature proves the image came from the key holder and was not modified. A size or checksum proves neither.'],
  ]),
]);

export const hwsecBoss = boss({
  id: 'boss-hwsec',
  title: 'The Glitched Boot',
  concept: 'break and then harden a secure boot chip',
  xp: 220,
  steps: [
    say('Boss fight, {name}. Red team exercise: a smart-lock chip stores a 64-bit key and checks its firmware signature at boot. Find the weak spots, then fix them. Exam rules.', 'wink'),
    art(`boot_rom:
  if (!verify(fw, sig, pubkey))   // one branch decides everything
      halt();
  jump(fw);

pin_check:
  for (i = 0; i < 8; i++)
      if (in[i] != pin[i]) return FAIL;   // early exit
  return OK;`),
    { t: 'gen', make: () => ask('The 8-character PIN check exits early and its timing is measurable. Worst-case guesses if each character has 256 values?', num(8 * 256), '8 × 256 = 2048, instead of 256⁸.') },
    { t: 'gen', make: () => ask('A glitch skips the verify branch with probability 0.002, at 5 tries per second. Expected time to success, in s?', qty(100, 's', 0.02, '100'), '1/0.002 = 500 tries, / 5 per second = 100 s.') },
    mc('Best hardening for the boot branch?', ['Redundant checks with complementary encodings, random delays, glitch detectors that reset the chip, and fail closed', 'A faster CPU', 'A longer key', 'Obfuscating the boot ROM'], 0, 'One branch is one point of failure; make the attacker win several unlikely coin flips at once.'),
    { t: 'gen', make: () => ask('A DPA attack on the key needs 2000 traces. Masking cuts the leak 20×. Traces needed now?', qty(800000, '', 0.02, '800000'), '2000 × 20² = 800,000.') },
    { t: 'gen', make: () => { const h = 2 ** 64 / 1e12 / 3600; return ask('Brute force of the 64-bit key at 10¹² keys/s, worst case, in hours?', qty(h, 'h', 0.03, sig(h)), `2⁶⁴ / 1e12 = ${sig(2 ** 64 / 1e12)} s = ${sig(h)} h. Use 128-bit keys.`); } },
  ],
  recap: ['Timing leaks.', 'Fault-injection odds.', 'DPA scaling.', 'Key lengths.'],
});

// ------------------------------------------------------------------ functional safety

export const fusaPractice = practice('practice-fusa', 'Functional Safety Drills', 'FIT rates, MTTF, ECC bits, SPFM and PMHF', [
  (r, d) => {
    const fit = pick(r, [10, 50, 100]);
    if (d === 1) {
      const cars = pick(r, [100000, 1000000]), hrs = pick(r, [300, 500]), f = (fit * cars * hrs) / 1e9;
      return ask(`A chip is rated ${fit} FIT (failures per 10⁹ hours). ${cars.toLocaleString('en-US')} cars each run it ${hrs} hours a year. Expected failures per year across the fleet?`, qty(f, '', 0.02, sig(f)), `${fit} × ${cars} × ${hrs} / 1e9 = ${sig(f)}.`, 'FIT × device-hours / 10⁹.');
    }
    if (d === 2) {
      const y = 1e9 / fit / 8760;
      return ask(`A part is rated ${fit} FIT. MTTF, in years?`, qty(y, 'years', 0.02, sig(y)), `1e9 / ${fit} = ${sig(1e9 / fit)} hours = ${sig(y)} years. A huge MTTF per part still means many failures across millions of cars.`, '10⁹ / FIT hours.');
    }
    const n = pick(r, [1000, 2000]), h = pick(r, [1000, 2000]), fails = pick(r, [1, 2, 3]), f = (fails / (n * h)) * 1e9;
    return ask(`A reliability test runs ${n} parts for ${h} hours and sees ${fails} failure${fails > 1 ? 's' : ''}. Point estimate of the FIT rate?`, qty(f, '', 0.02, sig(f)), `${fails} / (${n} × ${h}) × 1e9 = ${sig(f)} FIT. Real qualification uses a confidence bound, which is higher.`, 'Failures per 10⁹ device-hours.');
  },
  (r, d) => {
    const k = pick(r, [8, 16, 32, 64, 128]);
    let rr = 1;
    while (2 ** rr < k + rr + 1) rr++;
    if (d === 1) return ask(`How many check bits does a Hamming single-error-correcting (SEC) code need for ${k} data bits?`, num(rr), `Smallest r with 2^r ≥ k + r + 1: r = ${rr}.`, '2^r must name every bit position plus "no error".');
    if (d === 2) return ask(`How many check bits does SECDED (single-correct, double-detect) need for ${k} data bits?`, num(rr + 1), `SEC needs ${rr}; one overall parity bit adds double detection: ${rr + 1}.`, 'SEC plus one parity bit.');
    return ask(`SECDED on ${k}-bit words. Storage overhead, in %?`, qty(((rr + 1) / k) * 100, '%', 0.02, sig(((rr + 1) / k) * 100)), `${rr + 1} / ${k} = ${sig(((rr + 1) / k) * 100)}%. Wider words amortize the check bits better.`, 'Check bits / data bits.');
  },
  (r, d) => {
    const safe = pick(r, [0.3, 0.4, 0.5]);
    if (d < 3) {
      const dc = pick(r, [0.9, 0.97, 0.99]), spfm = (1 - (1 - safe) * (1 - dc)) * 100;
      return ask(`${safe * 100}% of a block's faults are safe. A safety mechanism detects ${dc * 100}% of the rest (the others are residual faults). SPFM (1 - residual / total), in %?`, qty(spfm, '%', 0.002, sig(spfm, 4)), `Residual = ${sig(1 - safe)} × ${sig(1 - dc)} = ${sig((1 - safe) * (1 - dc))} of all faults. SPFM = ${sig(spfm, 4)}%. ASIL D needs ≥ 99%.`, 'Only undetected dangerous faults count against you.');
    }
    const dc = (1 - 0.01 / (1 - safe)) * 100;
    return ask(`${safe * 100}% of faults are safe. What diagnostic coverage of the rest reaches exactly SPFM = 99% (ASIL D), in %?`, qty(dc, '%', 0.002, sig(dc, 4)), `Residual must be 1% of all faults: (1 - ${safe}) × (1 - DC) = 0.01 → DC = ${sig(dc, 4)}%.`, 'Solve (1 - safe)(1 - DC) = 0.01.');
  },
  (r, d) => {
    const parts = tier(d, [['CPU', 20], ['RAM', 30]], [['CPU', 40], ['RAM', 60], ['bus', 10]], [['CPU', 80], ['RAM', 120], ['bus', 20], ['clock', 5]]) as [string, number][];
    const dc = pick(r, [0.9, 0.95, 0.99]), res = parts.reduce((a, [, f]) => a + f * (1 - dc), 0);
    return ask(`Raw dangerous FIT: ${parts.map(([n, f]) => `${n} ${f}`).join(', ')}. Every part has ${dc * 100}% diagnostic coverage. Residual FIT (PMHF contribution)?`, qty(res, '', 0.02, sig(res)), `(${parts.map(([, f]) => f).join(' + ')}) × ${sig(1 - dc)} = ${sig(res)} FIT. ASIL D requires under 10 FIT for the whole item${res >= 10 ? ', so this fails' : ''}.`, 'Sum × (1 - coverage).');
  },
  (r) => concept(r, [
    ['ISO 26262 grades risk ASIL A to D. Which needs the most rigor?', 'ASIL D, for example braking and steering', ['ASIL A', 'QM', 'They are equal'], 'ASIL comes from severity, exposure and controllability. Losing the brakes scores the worst on all three.'],
    ['Which is a random hardware fault rather than a systematic one?', 'An alpha particle flips a bit in SRAM', ['A bug in the RTL', 'A wrong requirement', 'A missing timing constraint'], 'Random faults come from physics and are handled by safety mechanisms; systematic faults come from process mistakes and are handled by better process.'],
    ['Two identical cores run a couple of cycles apart and compare outputs every cycle. What is it?', 'Dual-core lockstep: it detects random faults in either core', ['Hyperthreading', 'Speculation', 'Cache coherence'], 'The delay makes one transient event unlikely to corrupt both cores the same way, so any mismatch reveals a fault.'],
    ['How do you show a safety mechanism reaches its claimed coverage?', 'Fault-injection campaigns: force faults in simulation or emulation and count how many are detected', ['Ask the designer', 'Run the normal regression', 'Measure power'], 'Coverage is measured, not assumed: inject faults and count how many the mechanism catches.'],
    ['Why does a watchdog timer exist in a safety system?', 'To detect software or clock lock-ups: if it is not serviced in time, it forces a safe state', ['To count cars', 'To speed up boot', 'To encrypt data'], 'It is an independent timer; a hung system stops servicing it and gets reset into a safe state.'],
  ]),
]);

export const fusaBoss = boss({
  id: 'boss-fusa',
  title: 'The Braking Controller',
  concept: 'take a microcontroller to ASIL D',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A brake-by-wire controller must reach ASIL D. The assessor is coming next month. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('What minimum single-point fault metric (SPFM) does ASIL D require, in %?', qty(99, '%', 0.001, '99'), 'ASIL D: SPFM ≥ 99%, LFM ≥ 90%, PMHF < 10 FIT.') },
    { t: 'gen', make: () => { const res = (200 + 300 + 50) * 0.02; return ask('Dangerous FIT: CPU 200, SRAM 300, interconnect 50. Every block has 98% diagnostic coverage. Residual FIT?', qty(res, '', 0.02, sig(res)), `550 × 0.02 = ${sig(res)} FIT: over the 10 FIT limit.`); } },
    mc('Which single change cuts residual FIT the most?', ['Raise the SRAM\'s coverage with SECDED ECC and the CPU\'s with lockstep, since they carry most of the raw FIT', 'Faster clocks', 'Bigger caches', 'More software tests'], 0, 'Attack the biggest contributors first; ECC and lockstep give 99%+ coverage.'),
    { t: 'gen', make: () => { const res = 200 * 0.01 + 300 * 0.001 + 50 * 0.02; return ask('Now CPU 99% (lockstep), SRAM 99.9% (ECC), interconnect still 98%. Residual FIT?', qty(res, '', 0.02, sig(res)), `200 × 0.01 + 300 × 0.001 + 50 × 0.02 = ${sig(res)} FIT: under 10.`); } },
    { t: 'gen', make: () => ask('SECDED on 64-bit SRAM words: how many check bits?', num(8), 'SEC needs 7 (2⁷ = 128 ≥ 64 + 7 + 1), plus 1 for double detection: 8. The classic 72-bit ECC word.') },
    { t: 'gen', make: () => { const f = (3.3 * 5e6 * 500) / 1e9; return ask('At 3.3 FIT residual, a fleet of 5 million cars running 500 hours a year. Expected dangerous failures per year?', qty(f, '', 0.02, sig(f)), `3.3 × 5e6 × 500 / 1e9 = ${sig(f)}. That is why the target is so strict.`); } },
  ],
  recap: ['ASIL D targets.', 'Residual FIT.', 'ECC and lockstep.', 'Fleet-scale failures.'],
});

// ------------------------------------------------------------------ silicon photonics

export const photonicsPractice = practice('practice-photonics', 'Photonics Drills', 'band gaps, WDM, energy per bit, link budgets, photodetectors', [
  (r, d) => {
    const m = pick(r, [['Silicon', 1.12], ['Germanium', 0.66], ['InP', 1.34], ['GaAs', 1.42]] as const);
    if (d < 3) return ask(`${m[0]} has a band gap of ${m[1]} eV. Longest wavelength it absorbs, in µm? (λ = 1.24/Eg)`, qty(1.24 / m[1], 'um', 0.02, sig(1.24 / m[1])), `1.24 / ${m[1]} = ${sig(1.24 / m[1])} µm. Silicon is transparent at 1.31 and 1.55 µm, which is why it makes good waveguides and needs germanium to detect light.`, 'Photon energy must exceed the band gap.');
    const lam = pick(r, [1.31, 1.55]), e = 1.24 / lam;
    return ask(`What is the energy of a ${lam} µm photon, in eV?`, qty(e, 'eV', 0.02, sig(e)), `1.24 / ${lam} = ${sig(e)} eV: below silicon's 1.12 eV band gap, so silicon cannot absorb it.`, 'E = 1.24/λ with λ in µm.');
  },
  (r, d) => {
    const ch = tier(d, pick(r, [4, 8]), pick(r, [8, 16]), pick(r, [16, 32])), rate = pick(r, [25, 50, 100, 200]), t = (ch * rate) / 1000;
    return ask(`WDM puts ${ch} wavelengths on one fibre at ${rate} Gb/s each. Total, in Tb/s?`, qty(t, 'Tb/s', 0.02, sig(t)), `${ch} × ${rate} = ${ch * rate} Gb/s = ${sig(t)} Tb/s. One fibre, many colours.`, 'Channels × rate.');
  },
  (r, d) => {
    const tb = pick(r, [12.8, 25.6, 51.2]), pj = tier(d, pick(r, [10, 15]), pick(r, [5, 10]), pick(r, [1, 3])), w = tb * pj;
    return ask(`A ${tb} Tb/s switch spends ${pj} pJ/bit on its I/O. I/O power, in W?`, qty(w, 'W', 0.02, sig(w)), `${tb}e12 × ${pj}e-12 = ${sig(w)} W. Co-packaged optics aims at a few pJ/bit to keep this from dominating the chip.`, 'Bits per second × joules per bit.');
  },
  (r, d) => {
    const las = pick(r, [0, 3, 6, 10]), cpl = pick(r, [1.5, 2, 3]), mod = pick(r, [3, 5, 6]), wg = pick(r, [1, 2]), rx = las - 2 * cpl - mod - wg;
    if (d < 3) return ask(`Laser ${las} dBm. Two couplers of ${cpl} dB, a modulator of ${mod} dB, ${wg} dB of waveguide loss. Power at the photodetector, in dBm?`, qty(rx, 'dBm', 0.02, sig(rx)), `${las} - ${2 * cpl} - ${mod} - ${wg} = ${sig(rx)} dBm.`, 'Subtract every loss.');
    const sens = pick(r, [-12, -10, -8]), m = rx - sens;
    return ask(`Laser ${las} dBm, losses: 2 × ${cpl} dB couplers, ${mod} dB modulator, ${wg} dB waveguide. Receiver sensitivity ${sens} dBm. Link margin, in dB?`, qty(m, 'dB', 0.03, sig(m)), `Received ${sig(rx)} dBm. Margin = ${sig(rx)} - (${sens}) = ${sig(m)} dB.${m < 3 ? ' Too thin: aging and temperature eat a few dB.' : ''}`, 'Received power minus sensitivity.');
  },
  (r, d) => {
    const resp = pick(r, [0.8, 0.9, 1.0]);
    if (d === 1) {
      const p = pick(r, [0.1, 0.5, 1]);
      return ask(`A photodetector with responsivity ${resp} A/W receives ${p} mW. Photocurrent, in mA?`, qty(resp * p, 'mA', 0.02, sig(resp * p)), `I = R × P = ${resp} × ${p} = ${sig(resp * p)} mA.`, 'I = R·P.');
    }
    if (d === 2) {
      const dbm = pick(r, [-10, -6, -3]), p = 10 ** (dbm / 10), i = resp * p * 1000;
      return ask(`A ${resp} A/W photodetector receives ${dbm} dBm. Photocurrent, in µA?`, qty(i, 'uA', 0.02, sig(i)), `${dbm} dBm = ${sig(p)} mW; × ${resp} A/W = ${sig(i)} µA.`, 'Convert dBm to mW first.');
    }
    const lam = pick(r, [1.31, 1.55]), eta = pick(r, [0.7, 0.8, 0.9]), rr = (lam * eta) / 1.24;
    return ask(`A detector at ${lam} µm has ${eta * 100}% quantum efficiency. Responsivity, in A/W? (R = η·λ/1.24, λ in µm)`, qty(rr, 'A/W', 0.02, sig(rr)), `${eta} × ${lam} / 1.24 = ${sig(rr)} A/W. Longer wavelengths give more electrons per watt because each photon carries less energy.`, 'Electrons per photon × photons per joule.');
  },
  (r) => concept(r, [
    ['Why can\'t you easily make a laser out of silicon?', 'Its indirect band gap makes electrons and holes rarely recombine by emitting light; lasers use III-V materials bonded or attached', ['Silicon is too expensive', 'Silicon absorbs all light', 'Silicon melts'], 'An indirect band gap needs a phonon for each light-emitting recombination, which is rare.'],
    ['What is the classic problem with ring modulators?', 'Their resonance drifts strongly with temperature, so each needs a heater and control loop', ['They only work in red light', 'They are too big', 'They need no power'], 'Silicon\'s refractive index changes with temperature, shifting the ring\'s resonant wavelength.'],
    ['Why move optics into the package (co-packaged optics)?', 'Electrical traces to the front panel burn too much power at high rates; optics near the switch cuts pJ/bit', ['Fibres are cheaper than copper', 'It removes lasers', 'It makes the chip smaller'], 'Driving long copper traces at 200 Gb/s takes power-hungry SerDes; short reach to on-package optics saves most of it.'],
    ['What does a Mach-Zehnder modulator do?', 'Splits light into two arms, shifts the phase of one, and recombines them so interference turns phase into intensity', ['Makes light', 'Detects light', 'Amplifies light'], 'Interference turns a phase difference into intensity: in phase adds up, 180° cancels.'],
  ]),
]);

export const photonicsBoss = boss({
  id: 'boss-photonics',
  title: 'The Optical Link',
  concept: 'design a co-packaged optical link for a switch chip',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A 51.2 Tb/s switch is moving to co-packaged optics. Design the link. Exam rules.', 'excited'),
    { t: 'gen', make: () => ask('Electrical I/O at 15 pJ/bit. Power at 51.2 Tb/s, in W?', qty(768, 'W', 0.02, '768'), '51.2e12 × 15e-12 = 768 W: impossible to cool alongside the switch.') },
    { t: 'gen', make: () => ask('Co-packaged optics at 5 pJ/bit. Power, in W?', qty(256, 'W', 0.02, '256'), '51.2 × 5 = 256 W.') },
    { t: 'gen', make: () => ask('Each fibre carries 8 wavelengths at 200 Gb/s. How many fibres for 51.2 Tb/s?', num(32), '8 × 200 = 1.6 Tb/s per fibre; 51.2 / 1.6 = 32.') },
    { t: 'gen', make: () => ask('Laser 6 dBm, two couplers of 2 dB, modulator 5 dB, waveguide 1 dB. Received power, in dBm?', qty(-4, 'dBm', 0.02, '-4'), '6 - 4 - 5 - 1 = -4 dBm.') },
    { t: 'gen', make: () => ask('The receiver needs -9 dBm. Margin, in dB?', qty(5, 'dB', 0.02, '5'), '-4 - (-9) = 5 dB.') },
    mc('In the field, one wavelength fails as the switch heats up. Likely cause?', ['A ring modulator drifted off resonance because its heater control could not track the temperature', 'The fibre broke', 'The laser is too strong', 'Germanium stopped absorbing'], 0, 'Rings move about 0.1 nm/K; thermal tuning must track it.'),
  ],
  recap: ['pJ/bit.', 'WDM.', 'Link budget.', 'Ring thermal tuning.'],
});

// ------------------------------------------------------------------ qubits

export const qubitPractice = practice('practice-qubit', 'Qubit Drills', 'state size, measurement, gate fidelity, T1 decay, temperatures, surface codes', [
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [3, 10, 20, 50]);
      return ask(`How many complex amplitudes describe the state of ${n} entangled qubits?`, qty(2 ** n, '', 0.01, String(2 ** n)), `2^${n} = ${(2 ** n).toLocaleString('en-US')}: one amplitude per bit pattern.`, 'Every bit pattern gets an amplitude.');
    }
    if (d === 2) {
      const n = pick(r, [30, 34, 40]), gb = (16 * 2 ** n) / 1e9;
      return ask(`A classical simulator stores ${n} qubits as 16-byte complex amplitudes. Memory, in GB?`, qty(gb, 'GB', 0.02, sig(gb)), `16 × 2^${n} = ${sig(gb)} GB. Each extra qubit doubles it.`, '16 × 2^n bytes.');
    }
    const tb = pick(r, [1, 100]), n = Math.floor(Math.log2((tb * 1e12) / 16));
    return ask(`How many qubits can a full state-vector simulation hold in ${tb} TB (16 bytes per amplitude)?`, num(n), `2^n × 16 ≤ ${tb}e12 → n = ${n}. A hundred times the memory buys only ${Math.round(Math.log2(100))} more qubits.`, 'log2(memory / 16), rounded down.');
  },
  (r, d) => {
    if (d === 1) return ask('A qubit in |0⟩ goes through a Hadamard gate and is measured. Probability of reading 1, in %?', qty(50, '%', 0.01, '50'), 'H makes (|0⟩ + |1⟩)/√2, and each outcome has probability (1/√2)² = 50%.', 'Square the amplitude.');
    if (d === 2) {
      const [a, b] = pick(r, [[0.6, 0.8], [0.8, 0.6], [0.28, 0.96]] as const);
      return ask(`A qubit is in ${a}|0⟩ + ${b}|1⟩. Probability of measuring 1, in %?`, qty(b * b * 100, '%', 0.01, sig(b * b * 100)), `|${b}|² = ${sig(b * b)} → ${sig(b * b * 100)}%. Probabilities are squared amplitudes, and they add to 1.`, 'Born rule.');
    }
    const th = pick(r, [30, 60, 90, 120]), p = Math.sin(((th / 2) * Math.PI) / 180) ** 2 * 100;
    return ask(`A qubit in |0⟩ is rotated by θ = ${th}° about the X axis, giving cos(θ/2)|0⟩ - i·sin(θ/2)|1⟩. Probability of measuring 1, in %?`, qty(p, '%', 0.02, sig(p)), `sin²(${th / 2}°) = ${sig(p)}%. A π rotation (180°) flips the qubit completely.`, 'sin²(θ/2).');
  },
  (r, d) => {
    const f = pick(r, [0.99, 0.995, 0.999]);
    if (d < 3) {
      const n = pick(r, [50, 100, 500]), p = f ** n * 100;
      return ask(`Every gate has ${f * 100}% fidelity. What fraction of runs of a ${n}-gate circuit finish with no error, in %?`, qty(p, '%', 0.03, sig(p)), `${f}^${n} = ${sig(p)}%. Errors compound.`, 'Multiply the per-gate success.');
    }
    const n = Math.log(0.5) / Math.log(f);
    return ask(`At ${f * 100}% gate fidelity, after how many gates does the chance of an error-free run fall to 50%?`, qty(n, '', 0.03, String(Math.round(n))), `ln(0.5) / ln(${f}) ≈ ${Math.round(n)} gates. Useful algorithms need millions: error correction is mandatory.`, 'Solve f^n = 0.5.');
  },
  (r, d) => {
    const t1 = pick(r, [50, 100, 300]), t = pick(r, [10, 20, 50]);
    if (d < 3) return ask(`A qubit has T1 = ${t1} µs. Probability it is still excited after ${t} µs, in %?`, qty(Math.exp(-t / t1) * 100, '%', 0.02, sig(Math.exp(-t / t1) * 100)), `e^(-${t}/${t1}) = ${sig(Math.exp(-t / t1) * 100)}%.`, 'Exponential decay.');
    const g = pick(r, [20, 40, 100]), n = (t1 * 1000) / g;
    return ask(`T1 = ${t1} µs and each gate takes ${g} ns. Roughly how many gates fit in one T1?`, qty(n, '', 0.02, String(Math.round(n))), `${t1 * 1000} / ${g} = ${Math.round(n)}. The ratio of coherence time to gate time is what matters, not either alone.`, 'Same units first.');
  },
  (r, d) => {
    if (d < 3) {
      const f = pick(r, [4, 5, 6, 8]), t = ((H * f * 1e9) / KB) * 1000;
      return ask(`At what temperature does thermal energy kT equal one photon at ${f} GHz, in mK? (T = h·f/k)`, qty(t, 'mK', 0.03, String(Math.round(t))), `6.626e-34 × ${f}e9 / 1.38e-23 = ${Math.round(t)} mK. Qubits run at ~10 mK, far below that, so thermal photons rarely excite them.`, 'T = h·f/k.');
    }
    const dd = pick(r, [3, 5, 7, 11, 17, 25]), l = pick(r, [100, 1000]);
    return ask(`A distance-${dd} surface code uses 2d² - 1 physical qubits per logical qubit. How many physical qubits for ${l} logical qubits?`, qty(l * (2 * dd * dd - 1), '', 0.01, String(l * (2 * dd * dd - 1))), `2 × ${dd}² - 1 = ${2 * dd * dd - 1} per logical qubit, × ${l} = ${(l * (2 * dd * dd - 1)).toLocaleString('en-US')}.`, 'Per-logical cost × logical count.');
  },
  (r) => concept(r, [
    ['Why does a transmon need a Josephson junction?', 'It is a nonlinear inductor, so the energy levels are unevenly spaced and the lowest two can be addressed alone', ['To connect it to ground', 'To make it superconduct', 'To cool it'], 'A linear LC circuit has evenly spaced levels, so a pulse meant for 0↔1 would also drive 1↔2.'],
    ['Trapped ions vs superconducting qubits: which pairing is right?', 'Ions: long coherence and high fidelity but slow gates; superconducting: fast gates but shorter coherence', ['Ions are faster', 'Superconducting qubits need no fridge', 'They are identical'], 'Every platform trades speed against coherence and connectivity; none has won yet.'],
    ['What is the difference between T1 and T2?', 'T1 is energy relaxation (|1⟩ decays to |0⟩); T2 is loss of phase coherence, and T2 ≤ 2·T1', ['They are the same', 'T2 is always longer than T1', 'T1 is gate time'], 'Relaxation always destroys phase too, so T2 cannot exceed 2·T1; extra dephasing noise pushes it lower.'],
    ['Why can\'t you copy an unknown qubit to protect it?', 'The no-cloning theorem forbids it, so error correction spreads information across entangled qubits instead', ['Qubits are too small', 'It would be too slow', 'Copying is allowed but expensive'], 'Measuring collapses the state, and no-cloning forbids copying, so parity checks detect errors without learning the data.'],
  ]),
]);

export const qubitBoss = boss({
  id: 'boss-qubit',
  title: 'The Decohering Chip',
  concept: 'decide whether a quantum processor can run a real circuit',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A startup claims its 50-qubit chip can run a 1000-gate chemistry circuit. The investors ask you to check. Exam rules.', 'thinking'),
    { t: 'gen', make: () => ask('To simulate 50 qubits classically (16 bytes per amplitude), how much memory, in PB?', qty((16 * 2 ** 50) / 1e15, 'PB', 0.02, sig((16 * 2 ** 50) / 1e15)), `16 × 2⁵⁰ = ${sig((16 * 2 ** 50) / 1e15)} PB.`) },
    { t: 'gen', make: () => ask('Two-qubit gates are 99.5% fidelity. Error-free probability of a 1000-gate circuit, in %?', qty(0.995 ** 1000 * 100, '%', 0.03, sig(0.995 ** 1000 * 100)), `0.995¹⁰⁰⁰ = ${sig(0.995 ** 1000 * 100)}%: almost always wrong.`) },
    { t: 'gen', make: () => ask('T1 = 100 µs and the circuit is 1000 gates deep at 50 ns per layer. Probability a qubit has not relaxed by the end, in %?', qty(Math.exp(-50 / 100) * 100, '%', 0.02, sig(Math.exp(-50 / 100) * 100)), `1000 × 50 ns = 50 µs; e^(-0.5) = ${sig(Math.exp(-0.5) * 100)}%.`) },
    mc('What would make the claim credible?', ['Error correction: encode logical qubits in many physical ones, with gates below the code threshold', 'More qubits of the same quality', 'A faster classical computer', 'Running the circuit many times'], 0, 'Repetition cannot fix a signal that is almost all noise; only error correction scales.'),
    { t: 'gen', make: () => ask('With a distance-7 surface code (2d² - 1 each), how many physical qubits for 50 logical qubits?', num(50 * 97), '2 × 49 - 1 = 97 per logical qubit; × 50 = 4850.') },
    { t: 'gen', make: () => ask('The qubits are at 6 GHz. Temperature where kT equals one photon, in mK?', qty(((H * 6e9) / KB) * 1000, 'mK', 0.03, String(Math.round(((H * 6e9) / KB) * 1000))), `h·f/k = ${Math.round(((H * 6e9) / KB) * 1000)} mK. The fridge at 10 mK keeps them cold enough.`) },
  ],
  recap: ['Exponential state size.', 'Compounding gate errors.', 'Coherence budgets.', 'Surface-code overhead.'],
});

// ------------------------------------------------------------------ quantum control

export const qctrlPractice = practice('practice-qctrl', 'Quantum Control Drills', 'upconversion, pulse timing, attenuation and noise temperature, cryo power budgets', [
  (r, d) => {
    const lo = pick(r, [4.5, 5, 6]), iff = pick(r, [50, 100, 150]), up = d !== 3;
    const f = up ? lo * 1000 + iff : lo * 1000 - iff;
    return ask(`The LO is ${lo} GHz and the IF is ${iff} MHz. You want the ${up ? 'upper' : 'lower'} sideband. Frequency at the qubit, in MHz?`, qty(f, 'MHz', 0.0005, String(f)), `${lo * 1000} ${up ? '+' : '-'} ${iff} = ${f} MHz. The other sideband and the LO leak through too, and must be cancelled by IQ calibration.`, `${up ? 'Add' : 'Subtract'} the IF.`);
  },
  (r, d) => {
    const fr = pick(r, [5, 10, 20, 25]), pi = 1000 / (2 * fr);
    if (d === 1) return ask(`The qubit Rabi-oscillates at ${fr} MHz. Length of a π pulse (half a Rabi period), in ns?`, qty(pi, 'ns', 0.02, sig(pi)), `Period = ${sig(1000 / fr)} ns; half = ${sig(pi)} ns.`, 'A full oscillation is |0⟩ → |1⟩ → |0⟩.');
    if (d === 2) return ask(`The qubit Rabi-oscillates at ${fr} MHz. Length of a π/2 pulse, in ns?`, qty(pi / 2, 'ns', 0.02, sig(pi / 2)), `A quarter period: ${sig(pi / 2)} ns. It makes an equal superposition.`, 'Half of a π pulse.');
    const t0 = pick(r, [20, 40, 50]), s = pick(r, [0.5, 0.8, 1.25]), t = t0 / s;
    return ask(`A π pulse takes ${t0} ns at amplitude A. The amplitude is changed to ${s}·A with the same pulse shape. New π-pulse length, in ns?`, qty(t, 'ns', 0.02, sig(t)), `Rabi frequency is proportional to amplitude, so time scales as 1/${s}: ${sig(t)} ns.`, 'Rotation angle ∝ amplitude × time.');
  },
  (r, d) => {
    const a = pick(r, [10, 20, 30]), al = 10 ** (a / 10);
    if (d === 1) return ask(`A ${a} dB attenuator passes what fraction of the input power? (answer as 1/N: give N)`, qty(al, '', 0.01, String(al)), `10^(${a}/10) = ${al}: only 1/${al} gets through.`, 'Undo the dB.');
    const tin = pick(r, [300, 50]), ts = pick(r, [4, 0.8]), tout = tin / al + ts * (1 - 1 / al);
    if (d === 2) return ask(`${tin} K of thermal noise enters a ${a} dB attenuator sitting at ${ts} K. Effective noise temperature at its output, in K?`, qty(tout, 'K', 0.02, sig(tout)), `T = ${tin}/${al} + ${ts} × (1 - 1/${al}) = ${sig(tout)} K. An attenuator at T emits noise at T, so each stage can only cool the noise to near its own temperature.`, 'Attenuated input plus the attenuator\'s own noise.');
    const t1 = 300 / 100 + 4 * (1 - 1 / 100), t2 = t1 / 100 + 0.1 * (1 - 1 / 100), t3 = t2 / al + 0.01 * (1 - 1 / al);
    return ask(`300 K noise passes 20 dB at 4 K, 20 dB at 0.1 K, then ${a} dB at 10 mK. Noise temperature at the qubit, in mK?`, qty(t3 * 1000, 'mK', 0.03, sig(t3 * 1000)), `After 4 K: ${sig(t1)} K. After 0.1 K: ${sig(t2)} K. After 10 mK: ${sig(t3 * 1000)} mK. Attenuation spread over several stages is how drive lines stay quiet.`, 'Apply the formula stage by stage.');
  },
  (r, d) => {
    const budget = pick(r, [1, 1.5, 2]);
    if (d < 3) {
      const per = pick(r, [1, 2, 5]), n = Math.floor((budget * 1000) / per);
      return ask(`The 4 K stage can remove ${budget} W. A cryo-CMOS controller uses ${per} mW per qubit. How many qubits?`, num(n), `${budget * 1000} / ${per} = ${n}. A million qubits would need µW per qubit.`, 'Budget / per-qubit power.');
    }
    const lines = pick(r, [2, 3]), heat = pick(r, [0.5, 1]), n = Math.floor((budget * 1000) / (lines * heat));
    return ask(`Room-temperature control instead: each qubit needs ${lines} coax lines, and each line leaks ${heat} mW of heat into the 4 K stage (${budget} W budget). How many qubits?`, num(n), `${budget * 1000} / (${lines} × ${heat}) = ${n}. Wiring, not qubits, limits the size of today's machines.`, 'Budget / (lines × heat per line).');
  },
  (r, d) => {
    const fs = pick(r, [1, 2, 4]);
    if (d === 1) return ask(`An AWG samples at ${fs} GS/s. Highest frequency it can generate directly (Nyquist), in MHz?`, qty(fs * 500, 'MHz', 0.01, String(fs * 500)), `fs / 2 = ${fs * 500} MHz. Higher frequencies come from mixing with an LO.`, 'Half the sample rate.');
    const t = pick(r, [20, 40, 100]);
    if (d === 2) return ask(`A ${t} ns pulse at ${fs} GS/s is how many samples?`, num(t * fs), `${t} × ${fs} = ${t * fs}.`, 'Duration × rate.');
    const q = pick(r, [100, 1000]), ch = 2, bits = 16, bw = (q * ch * fs * 1e9 * bits) / 8 / 1e9;
    return ask(`${q} qubits each need 2 channels (I and Q) of ${bits}-bit samples at ${fs} GS/s. Total waveform data rate, in GB/s?`, qty(bw, 'GB/s', 0.02, sig(bw)), `${q} × 2 × ${fs}e9 × 2 bytes = ${sig(bw)} GB/s. Controllers store pulse libraries and play them by name rather than streaming raw samples.`, 'Channels × rate × bytes.');
  },
  (r) => concept(r, [
    ['Why do drive lines have attenuators at several cold stages?', 'A room-temperature source sends thermal noise down the line; attenuating at cold stages replaces it with colder noise', ['To save power', 'To slow the pulses', 'Because the qubits need weak signals only'], 'An attenuator replaces incoming noise with noise at its own temperature, so the last stage should be the coldest.'],
    ['Why is a quantum-limited amplifier (JPA or TWPA) placed first in the readout chain?', 'Friis: the first stage dominates the noise, and these add close to the minimum quantum noise', ['It is cheaper', 'It filters the drive', 'It cools the qubit'], 'Readout signals are a few photons; any noise added before the first gain stage is fatal.'],
    ['Why must the error-correction decoder be fast?', 'Syndromes arrive about every microsecond; if decoding falls behind, the backlog grows without bound', ['It does not have to be', 'To save power', 'Because qubits are fast'], 'Logical operations wait on the decoder\'s answer, so its speed limits the whole machine.'],
    ['What does DRAG pulse shaping fix?', 'Leakage into the transmon\'s third level, by adding a derivative component on the quadrature channel', ['LO leakage', 'Thermal noise', 'Readout crosstalk'], 'The transmon\'s 1↔2 transition is close in frequency; the derivative term cancels the drive\'s spectral content there.'],
  ]),
]);

export const qctrlBoss = boss({
  id: 'boss-qctrl',
  title: 'The Million-Qubit Fridge',
  concept: 'plan the control electronics for a large quantum computer',
  xp: 220,
  steps: [
    say('Boss fight, {name}. The roadmap says 1000 qubits next year and a million later. The control electronics are your problem. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('The LO is 5 GHz and the IF is 120 MHz, upper sideband. Qubit frequency, in MHz?', qty(5120, 'MHz', 0.0005, '5120'), '5000 + 120 = 5120 MHz.') },
    { t: 'gen', make: () => ask('Rabi frequency is 12.5 MHz. π pulse length, in ns?', qty(40, 'ns', 0.02, '40'), 'Half of 80 ns = 40 ns.') },
    { t: 'gen', make: () => { const t = 300 / 100 + 4 * 0.99; return ask('300 K noise passes a 20 dB attenuator at 4 K. Output noise temperature, in K?', qty(t, 'K', 0.02, sig(t)), `3 + 3.96 = ${sig(t)} K. More attenuation at colder stages follows.`); } },
    { t: 'gen', make: () => ask('With coax from room temperature, 3 lines per qubit at 1 mW each, and a 1.5 W budget at 4 K: how many qubits?', num(500), '1500 / 3 = 500: not enough for 1000.') },
    { t: 'gen', make: () => ask('Cryo-CMOS controllers at 4 K use 1 mW per qubit with a 1.5 W budget. How many qubits?', num(1500), '1500. Better, but a million qubits needs about 1.5 µW each, or much bigger fridges.') },
    mc('What else must scale with the qubit count?', ['The real-time decoder: it must keep up with syndrome data from every logical qubit every microsecond', 'Nothing else', 'Only the fridge size', 'The LO frequency'], 0, 'Control, readout, wiring and decoding all scale together; any one can cap the machine.'),
  ],
  recap: ['Upconversion.', 'Pulse timing.', 'Attenuator noise.', 'Cryo heat budgets.', 'Decoder throughput.'],
});

export const DOMAIN_PRACTICE = [npuPractice, hwsecPractice, fusaPractice, photonicsPractice, qubitPractice, qctrlPractice];
export const DOMAIN_BOSSES = [aiBoss, hwsecBoss, fusaBoss, photonicsBoss, qubitBoss, qctrlBoss];

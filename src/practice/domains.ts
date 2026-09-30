// Practice banks and bosses for the domain chips of Act 7: AI accelerators, hardware security, functional
// safety, silicon photonics, qubits and quantum control electronics.
import { num, qty } from '../lessons/answers';
import { calc, choice, count, show, step, walk } from '../lessons/teach';
import { art, ask, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { concept, exact, hex, sci, sig } from './util';

const popcount = (x: number) => { let n = 0; for (; x; x >>= 1) n += x & 1; return n; };
const H = 6.626e-34, KB = 1.38e-23;

// ------------------------------------------------------------------ AI accelerators

export const npuPractice = practice('practice-npu', 'AI Hardware Drills', 'MAC counts, TOPS, array utilization, memory footprints, roofline, LLM decode', [
  (r, d) => {
    const idea = 'A MAC is one multiply-accumulate: multiply two numbers and add the result to a running sum. Neural network layers are made of dot products, and every output value needs one MAC for each pair of numbers in its dot product. So MACs = (number of outputs) × (length of each dot product).';
    if (d < 3) {
      const m = pick(r, [64, 128, 512]), k = pick(r, [256, 1024, 4096]), n = pick(r, [64, 256, 1024]);
      return walk(ask(`How many MACs does a (${m}×${k}) × (${k}×${n}) matrix multiply need?`, qty(m * n * k, '', 0.01, String(m * n * k)), `M × N × K = ${m} × ${n} × ${k} = ${(m * n * k).toLocaleString('en-US')}. Every output needs a K-long dot product.`, 'One K-long dot product per output element.'),
        'counting MACs in a matrix multiply', `${idea} Multiplying an M×K matrix by a K×N matrix gives an M×N output. Each output element is a dot product of a row (K values) and a column (K values): K MACs.`,
        count(`The output matrix is ${m}×${n}: number of output elements:`, `${m} × ${n}`, m * n),
        count(`Each output is a dot product of length K = ${k}. Total MACs:`, `${m * n} × ${k}`, m * n * k));
    }
    const h = pick(r, [14, 28, 56]), ci = pick(r, [64, 128, 256]), co = pick(r, [64, 128, 256]), k = 3, macs = h * h * ci * co * k * k;
    return walk(ask(`A 3×3 convolution produces a ${h}×${h}×${co} output from ${ci} input channels. How many MACs?`, qty(macs, '', 0.01, String(macs)), `Outputs ${h}×${h}×${co}, each a sum over ${ci} × 3 × 3 = ${ci * 9} products: ${macs.toLocaleString('en-US')} MACs.`, 'Outputs × (input channels × kernel area).'),
      'counting MACs in a convolution', `${idea} In a convolution, each output value comes from a 3×3 window over all the input channels: a dot product of length (input channels × 3 × 3).`,
      count(`Output values = ${h} × ${h} × ${co}:`, `${h} × ${h} × ${co}`, h * h * co),
      count(`Each needs a dot product of length ${ci} channels × 3 × 3:`, `${ci} × 9`, ci * 9),
      count('Total MACs = outputs × dot product length:', `${h * h * co} × ${ci * 9}`, macs));
  },
  (r, d) => {
    const n = pick(r, [64, 128, 256]), f = pick(r, [1, 1.5, 2]), tops = (2 * n * n * f) / 1000;
    const idea = 'A systolic array is a grid of multiply-accumulate units (MACs). Every MAC does one multiply and one add per cycle, which counts as 2 operations. Peak throughput in TOPS (tera-operations per second) = MACs × 2 × clock frequency. Real layers rarely fill the array perfectly: when a matrix does not divide evenly into array-sized tiles, the last tile is partly empty and some MACs idle.';
    if (d === 1) return walk(ask(`A ${n}×${n} systolic array of MACs runs at ${f} GHz. Peak throughput, in TOPS (2 ops per MAC)?`, qty(tops, 'TOPS', 0.02, sig(tops)), `${n}² × 2 × ${f}e9 = ${sig(tops)} TOPS.`, 'MACs per cycle × 2 × frequency.'),
      'peak TOPS of an array', idea,
      count(`MACs in a ${n}×${n} array:`, `${n} × ${n}`, n * n),
      calc('Operations per second in billions (GOPS) = MACs × 2 ops × GHz:', `${n * n} × 2 × ${f}`, 2 * n * n * f, '', sig(2 * n * n * f, 5), 0.005),
      calc('Convert GOPS to TOPS (÷ 1000):', `${sig(2 * n * n * f, 5)} / 1000`, tops, 'TOPS', sig(tops), 0.02));
    const cols = pick(r, [100, 200, 300, 520]), tiles = Math.ceil(cols / n), u = (cols / (tiles * n)) * 100;
    if (d === 2) return walk(ask(`A ${n}-wide array processes a layer with ${cols} output columns, in tiles of ${n}. What fraction of the array does useful work, in %?`, qty(u, '%', 0.02, sig(u)), `${tiles} tiles × ${n} = ${tiles * n} columns of hardware for ${cols} of work: ${sig(u)}%. Layer shapes that do not match the array waste peak TOPS.`, 'Round the tile count up.'),
      'array utilization', `${idea} The array is ${n} columns wide, so the layer is processed in tiles of ${n} columns; a partly filled last tile still takes a whole pass. Utilization = useful columns ÷ columns the hardware occupies.`,
      calc('Tiles needed = columns ÷ array width:', `${cols} / ${n}`, cols / n, '', sig(cols / n, 4), 0.005),
      count('Round up to whole tiles:', `ceil(${sig(cols / n, 4)})`, tiles),
      calc('Utilization = useful columns ÷ (tiles × array width), as a %:', `${cols} / (${tiles} × ${n}) × 100`, u, '%', sig(u), 0.02));
    const rows = pick(r, [70, 150, 300]), rt = Math.ceil(rows / n), u2 = ((cols * rows) / (tiles * n * rt * n)) * 100;
    return walk(ask(`A ${n}×${n} array runs a ${rows}×${cols} weight matrix in ${n}×${n} tiles. Utilization, in %?`, qty(u2, '%', 0.02, sig(u2)), `${rt} × ${tiles} tiles = ${rt * tiles} × ${n * n} slots for ${rows * cols} weights: ${sig(u2)}%.`, 'Tiles in each dimension, rounded up.'),
      'two-dimensional tiling', `${idea} A matrix is cut into ${n}×${n} tiles in BOTH dimensions, and each dimension's count is rounded up. Utilization = weights actually used ÷ weight slots in all the tiles.`,
      count(`Tiles along the ${rows} rows, rounded up (${rows} ÷ ${n}):`, `ceil(${rows} / ${n})`, rt),
      count(`Tiles along the ${cols} columns, rounded up (${cols} ÷ ${n}):`, `ceil(${cols} / ${n})`, tiles),
      count(`Weight slots in all the tiles = tiles × tiles × ${n} × ${n}:`, `${rt} × ${tiles} × ${n * n}`, rt * tiles * n * n),
      calc(`Utilization = ${rows * cols} weights ÷ that many slots, as a %:`, `${rows * cols} / ${rt * tiles * n * n} × 100`, u2, '%', sig(u2), 0.02));
  },
  (r, d) => {
    const b = pick(r, [7, 13, 70]), fmt = pick(r, [['FP16', 2], ['INT8', 1], ['INT4', 0.5]] as const), gb = b * fmt[1];
    if (d < 3) return walk(ask(`How much memory do the weights of a ${b}B-parameter model take in ${fmt[0]}, in GB?`, qty(gb, 'GB', 0.02, sig(gb)), `${b}e9 × ${fmt[1]} bytes = ${sig(gb)} GB. Quantizing to fewer bits is the cheapest way to fit a model on fewer chips.`, 'Parameters × bytes per parameter.'),
      'model weight memory', 'A model is a long list of numbers (parameters). Each one is stored in some number of bytes depending on its format: FP16 uses 2 bytes, INT8 uses 1, INT4 uses half a byte. Memory = number of parameters × bytes per parameter. With parameters in billions (B), the result comes out directly in gigabytes.',
      choice(`${fmt[0]} stores each parameter in how many bytes?`, String(fmt[1]), ['2', '1', '0.5', '4'].filter((x) => x !== String(fmt[1])).slice(0, 2)),
      calc('Memory in GB = billions of parameters × bytes per parameter:', `${b} × ${fmt[1]}`, gb, 'GB', sig(gb), 0.02));
    const layers = pick(r, [32, 40, 80]), dm = pick(r, [4096, 5120, 8192]), tok = pick(r, [4096, 32768]), kv = (2 * layers * dm * tok * 2) / 1e9;
    return walk(ask(`KV cache: ${layers} layers, model width ${dm}, ${tok} tokens of context, FP16. Size, in GB? (2 × layers × width × tokens × 2 bytes)`, qty(kv, 'GB', 0.02, sig(kv)), `2 (K and V) × ${layers} × ${dm} × ${tok} × 2 bytes = ${sig(kv)} GB per sequence. Long contexts can need more memory than the weights.`, 'Keys and values, per layer, per token.'),
      'the KV cache', 'While generating text, a transformer keeps the "key" and "value" vectors of every earlier token in every layer, so it does not have to recompute them: the KV cache. Per token and per layer it stores 2 vectors (K and V) of the model width, each number in 2 bytes (FP16). So its size = 2 × layers × width × tokens × 2 bytes.',
      calc('Values stored per token = 2 (K and V) × layers × width:', `2 × ${layers} × ${dm}`, 2 * layers * dm, '', String(2 * layers * dm), 0.001),
      calc('Bytes = values per token × tokens × 2 bytes each:', `${2 * layers * dm} × ${tok} × 2`, 2 * layers * dm * tok * 2, '', sci(2 * layers * dm * tok * 2, 3), 0.01),
      calc('In GB (÷ 1e9):', `${sci(2 * layers * dm * tok * 2, 3)} / 1e9`, kv, 'GB', sig(kv), 0.02));
  },
  (r, d) => {
    const bw = pick(r, [1, 2, 3.35]), b = pick(r, [7, 13, 70]), bytes = pick(r, [1, 2]), t = (bw * 1000) / (b * bytes);
    const idea = 'To generate each new token, the chip must read every weight of the model from memory once (at batch 1). If memory can deliver B GB/s and the model is W GB, at most B ÷ W tokens per second can be generated, however fast the arithmetic is: decode is memory-bound. With a batch of several users, one pass over the weights serves them all at once.';
    if (d < 3) return walk(ask(`Each generated token reads every weight once (batch 1). ${bw} TB/s of HBM, a ${b}B-parameter model in ${bytes === 1 ? 'INT8' : 'FP16'}. Maximum tokens per second?`, qty(t, '', 0.03, sig(t)), `${bw * 1000} GB/s / ${b * bytes} GB = ${sig(t)} tokens/s. Decode is memory-bound: extra compute does not help.`, 'Bandwidth / bytes read per token.'),
      'memory-bound decode', idea,
      calc('Model size in GB = billions of parameters × bytes each:', `${b} × ${bytes}`, b * bytes, 'GB', String(b * bytes), 0.001),
      calc('Tokens per second = bandwidth in GB/s (TB/s × 1000) ÷ model size:', `${bw * 1000} / ${b * bytes}`, t, '', sig(t), 0.03));
    const bs = pick(r, [8, 32]);
    return walk(ask(`Same setup (${bw} TB/s, ${b}B params in ${bytes === 1 ? 'INT8' : 'FP16'}), but ${bs} users are batched: one pass over the weights produces one token for each. Tokens per second across all users (still memory-bound)?`, qty(t * bs, '', 0.03, sig(t * bs)), `${sig(t)} × ${bs} = ${sig(t * bs)}. Batching reuses each weight fetch ${bs} times, which is why serving is cheap per user but hard on latency.`, 'One weight pass now serves the whole batch.'),
      'batching', idea,
      calc('Passes per second = bandwidth ÷ model size in GB:', `${bw * 1000} / ${b * bytes}`, t, '', sig(t, 4), 0.005),
      calc(`Each pass gives a token to each of the ${bs} users, so tokens per second:`, `${sig(t, 4)} × ${bs}`, t * bs, '', sig(t * bs), 0.03));
  },
  (r, d) => {
    if (d === 1) {
      const n = pick(r, [256, 1024, 4096]), i = n / 3;
      return walk(ask(`An N×N×N FP16 matmul (N = ${n}) does 2N³ FLOPs and moves 3N² values of 2 bytes. Arithmetic intensity, in FLOP/byte?`, qty(i, '', 0.02, sig(i)), `2N³ / (6N²) = N/3 = ${sig(i)}. Big matmuls reuse data a lot; that is why they run near peak.`, 'FLOPs / bytes.'),
        'arithmetic intensity', 'Arithmetic intensity is how many floating-point operations (FLOPs) a kernel does for each byte it moves to or from memory. High intensity means lots of reuse, so the chip spends its time computing; low intensity means it waits on memory.',
        calc('FLOPs = 2 × N³:', `2 × ${n}^3`, 2 * n ** 3, '', sci(2 * n ** 3, 3), 0.01),
        calc('Bytes moved = 3 × N² values × 2 bytes each:', `3 × ${n}^2 × 2`, 6 * n * n, '', sci(6 * n * n, 3), 0.01),
        calc('Intensity = FLOPs ÷ bytes:', `${sci(2 * n ** 3, 3)} / ${sci(6 * n * n, 3)}`, i, '', sig(i), 0.02));
    }
    const peak = pick(r, [400, 1000, 2000]), bw = pick(r, [2, 3.35, 8]), ridge = peak / bw;
    const idea = 'The roofline model: a kernel is limited either by compute (the chip\'s peak TFLOP/s) or by memory (bandwidth × the kernel\'s arithmetic intensity). The ridge point is the intensity where the two limits meet: peak ÷ bandwidth. Kernels below it are memory-bound; above it, compute-bound.';
    if (d === 2) return walk(ask(`A chip has ${peak} TFLOP/s and ${bw} TB/s. Ridge point of its roofline, in FLOP/byte?`, qty(ridge, '', 0.02, sig(ridge)), `${peak} / ${bw} = ${sig(ridge)} FLOP/byte. Kernels below that are memory-bound.`, 'Peak compute / bandwidth.'),
      'the ridge point', idea,
      calc('Ridge point = peak TFLOP/s ÷ TB/s (the tera prefixes cancel):', `${peak} / ${bw}`, ridge, '', sig(ridge), 0.02));
    const i = pick(r, [10, 50, 200, 1000]), att = Math.min(peak, bw * i);
    return walk(ask(`${peak} TFLOP/s peak, ${bw} TB/s. A kernel has intensity ${i} FLOP/byte. Attainable TFLOP/s?`, qty(att, 'TFLOP/s', 0.02, sig(att)), `min(${peak}, ${bw} × ${i}) = ${sig(att)}: ${att < peak ? 'memory-bound' : 'compute-bound'}.`, 'The roofline: min(peak, BW × intensity).'),
      'attainable performance', idea,
      calc('What memory can feed = bandwidth × intensity, in TFLOP/s:', `${bw} × ${i}`, bw * i, 'TFLOP/s', sig(bw * i, 4), 0.005),
      calc(`The attainable rate is the smaller of that and the peak ${peak}:`, `min(${sig(bw * i, 4)}, ${peak})`, att, 'TFLOP/s', sig(att), 0.02));
  },
  (r) => concept(r, [
    ['Why do systolic arrays beat CPUs on matrix math?', 'Massive data reuse: each operand fetched from memory feeds many MACs as it flows through the array', ['Higher clock frequency', 'Bigger caches', 'Better branch prediction'], 'data reuse in a systolic array', 'Moving a number from memory costs far more energy than multiplying it. In a systolic array each value passes from one MAC to the next, so a single fetch is used in many multiplications.', ['Reuse makes the chip efficient because fetching data costs:', 'More energy than the arithmetic', ['Less energy than the arithmetic', 'Nothing']]],
    ['What does "weight stationary" mean in a dataflow?', 'Weights are loaded into the PEs once and stay there while activations stream past', ['Weights never change during training', 'Weights are stored in flash', 'Activations stay fixed'], 'dataflows', 'A dataflow decides which operand stays put in each processing element (PE). Weight stationary loads the weights once and keeps them there, streaming the activations through, so the weights need no further memory traffic. Which operand to keep depends on the shape of the layer.', ['Weight stationary keeps which operand in place?', 'The weights', ['The activations', 'The outputs']]],
    ['Why train in BF16 rather than FP16?', 'BF16 keeps FP32\'s exponent range, so gradients rarely overflow or underflow, at half the bits', ['BF16 is more precise', 'FP16 cannot be multiplied', 'BF16 uses less power per bit'], 'BF16 versus FP16', 'A floating-point number has an exponent (its range) and a mantissa (its precision). FP16 has only 5 exponent bits, so very large or small gradients overflow or vanish. BF16 has 8 exponent bits like FP32, so the range matches, and only precision is lost.', ['More exponent bits give a number format more:', 'Range', ['Precision', 'Zeros']]],
    ['What does 2:4 structured sparsity give hardware?', 'Two of every four weights are zero in a fixed pattern, so the hardware can skip them and double effective throughput', ['Random zeros anywhere', 'Smaller activations', 'Fewer layers'], 'structured sparsity', 'Skipping multiplications by zero saves work, but finding random zeros is expensive. A fixed pattern (2 of every 4 are zero) is easy for hardware to index, so it can skip half the multiplications cheaply.', ['A fixed sparsity pattern is easier for hardware than random zeros because it is:', 'Easy to index', ['Random', 'Bigger']]],
  ], (why) => `${why}.`),
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
      return walk(ask(`A ${n}-digit PIN is checked all at once. Worst-case guesses to brute force it?`, num(10 ** n), `10^${n} = ${(10 ** n).toLocaleString('en-US')}.`, 'Every combination.'),
        'brute force', 'Brute force means trying every possible secret until one works. The worst case is the last one tried, so the number of guesses equals the number of possible secrets. Each digit has 10 values, and the choices for every digit multiply.',
        count(`${n} digits, 10 values each: combinations = 10 multiplied by itself ${n} times:`, `10^${n}`, 10 ** n));
    }
    const n = pick(r, [4, 8, 16]);
    if (d === 2) return walk(ask(`A ${n}-byte password is checked byte by byte with an early exit, and the response time reveals how many bytes matched. Worst-case guesses?`, num(n * 256), `Attack one byte at a time: ${n} × 256 = ${n * 256}, instead of 256^${n}. Constant-time comparison closes the leak.`, 'Each byte can be solved on its own.'),
      'a timing side channel', 'If the check stops at the first wrong byte, it takes longer when more of the start is right. An attacker can try all 256 values for the first byte and pick the one that takes longest; that byte is now known, so repeat for the next. Each byte is solved separately, so the work ADDS up instead of multiplying.',
      count('Worst case for ONE byte, trying every value:', '2^8', 256),
      count(`Do that for each of the ${n} bytes in turn:`, `${n} × 256`, n * 256));
    const [bits, rate] = pick(r, [[40, 1e9], [56, 1e12], [64, 1e12]] as const), s = 2 ** bits / rate, hrs = s / 3600;
    return walk(ask(`A ${bits}-bit key, and an attacker can try ${rate === 1e9 ? 'a billion' : 'a trillion'} keys per second. Worst-case time, in hours?`, qty(hrs, 'h', 0.03, sig(hrs)), `2^${bits} / ${rate} = ${sig(s)} s = ${sig(hrs)} h. Every extra bit doubles it; at 128 bits the answer is longer than the age of the universe.`, 'Keys / rate.'),
      'time to brute force a key', 'A key of N bits has 2^N possible values. The attacker tries them at some rate per second, so the worst-case time is (number of keys) ÷ (keys per second). Divide by 3600 to turn seconds into hours.',
      calc(`Number of keys = 2^${bits}:`, `2^${bits}`, 2 ** bits, '', sci(2 ** bits, 3), 0.01),
      calc(`Seconds = keys ÷ rate (${rate === 1e9 ? '1e9' : '1e12'} per second):`, `${sci(2 ** bits, 3)} / ${rate === 1e9 ? '1e9' : '1e12'}`, s, 's', sci(s, 3), 0.01),
      calc('Hours = seconds ÷ 3600:', `${sci(s, 3)} / 3600`, hrs, 'h', sig(hrs), 0.03));
  },
  (r, d) => {
    const v = Math.floor(r() * 256);
    const b8 = (x: number) => x.toString(2).padStart(8, '0');
    const idea = 'Transistors that switch draw current, so a chip\'s power use leaks information about the data it handles. A simple model: power depends on the Hamming WEIGHT of a value (how many of its bits are 1), or on the Hamming DISTANCE between a register\'s old and new value (how many bits change, which is the weight of old XOR new).';
    if (d === 1) return walk(ask(`Power leaks roughly with the Hamming weight of the data. What is the Hamming weight of ${hex(v)}?`, num(popcount(v)), `${hex(v)} = ${b8(v)}: ${popcount(v)} ones.`, 'Count the 1 bits.'),
      'Hamming weight', idea,
      step(`Write ${hex(v)} as 8 binary digits:`, exact(b8(v))),
      count('Count the 1s in it:', 'number of ones', popcount(v)));
    const w = Math.floor(r() * 256);
    if (d === 2) return walk(ask(`A register changes from ${hex(v)} to ${hex(w)}. Hamming distance (the number of bits that toggle)?`, num(popcount(v ^ w)), `${hex(v)} XOR ${hex(w)} = ${hex(v ^ w)}, which has ${popcount(v ^ w)} ones. Toggling bits draw current, so this is what a power probe sees.`, 'XOR, then count ones.'),
      'Hamming distance', idea,
      step(`${hex(v)} in binary (8 digits):`, exact(b8(v))),
      step(`${hex(w)} in binary (8 digits):`, exact(b8(w))),
      step('XOR the two: a bit is 1 where they differ:', exact(b8(v ^ w))),
      count('Count the 1s (the bits that toggle):', 'number of ones', popcount(v ^ w)));
    return walk(ask(`The first AES step computes data XOR key. The data byte is ${hex(v)} and you guess the key byte is ${hex(w)}. What Hamming weight does your model predict?`, num(popcount(v ^ w)), `${hex(v)} ⊕ ${hex(w)} = ${hex(v ^ w)} → weight ${popcount(v ^ w)}. DPA repeats this for all 256 guesses over thousands of traces; the guess whose predictions correlate with the power is the key.`, 'XOR the guess with the data.'),
      'a power-analysis prediction', `${idea} In a DPA attack, you guess a key byte, predict the intermediate value (data XOR key) and its Hamming weight, and check whether the real power traces rise and fall with your predictions. Only the right key guess will correlate.`,
      step(`${hex(v)} in binary:`, exact(b8(v))),
      step(`Your guess ${hex(w)} in binary:`, exact(b8(w))),
      step('data XOR guess:', exact(b8(v ^ w))),
      count('The predicted Hamming weight (number of 1s):', 'number of ones', popcount(v ^ w)));
  },
  (r, d) => {
    const n = pick(r, [1000, 5000, 20000]), k = tier(d, 2, pick(r, [4, 10]), pick(r, [10, 30])), need = n * k * k;
    return walk(ask(`A DPA attack needs ${n} traces. A countermeasure cuts the leaking signal by ${k}× (noise unchanged). About how many traces does the attack need now?`, qty(need, '', 0.02, String(need)), `Traces needed scale with 1/SNR²: ${n} × ${k}² = ${need.toLocaleString('en-US')}. Masking and noise raise the bar; they rarely make an attack impossible.`, 'Signal down k× → traces up k²×.'),
      'how countermeasures scale DPA', 'Noise can be averaged away by using more traces: averaging N traces improves the signal-to-noise ratio by √N. If a countermeasure makes the signal k times weaker, the SNR drops k times, and to make it up you need k² times as many traces (since √(k²) = k).',
      count(`The signal is ${k}× weaker, so the traces needed grow by ${k} × ${k}:`, `${k}²`, k * k),
      count('Traces needed now:', `${n} × ${k * k}`, need));
  },
  (r, d) => {
    const p = pick(r, [0.001, 0.01, 0.05]), rate = pick(r, [1, 10]);
    const idea = 'A fault-injection attack (for example a voltage glitch) succeeds only occasionally, with probability p on each attempt. But attempts are cheap and can be repeated. The expected number of attempts until the first success is 1 ÷ p, and the chance of at least one success in n tries is 1 - (chance all fail) = 1 - (1 - p)^n.';
    if (d === 1) return walk(ask(`Each voltage glitch skips the signature check with probability ${p}. Expected attempts until the first success?`, qty(1 / p, '', 0.01, String(1 / p)), `1 / ${p} = ${1 / p}.`, 'Geometric distribution: 1/p.'),
      'expected attempts', idea,
      calc('Expected attempts = 1 ÷ p:', `1 / ${p}`, 1 / p, '', String(1 / p), 0.01));
    if (d === 2) return walk(ask(`Each glitch works with probability ${p}, and the attacker can try ${rate} per second (reset included). Expected time to success, in s?`, qty(1 / p / rate, 's', 0.02, sig(1 / p / rate)), `${1 / p} attempts / ${rate} per second = ${sig(1 / p / rate)} s. Cheap glitching rigs make "unlikely" faults practical.`, 'Attempts / rate.'),
      'time to a successful glitch', idea,
      calc('Expected attempts = 1 ÷ p:', `1 / ${p}`, 1 / p, '', String(1 / p), 0.01),
      calc('Time = attempts ÷ attempts per second, in s:', `${1 / p} / ${rate}`, 1 / p / rate, 's', sig(1 / p / rate), 0.02));
    const n = pick(r, [100, 500]), pr = (1 - (1 - p) ** n) * 100;
    return walk(ask(`Each glitch works with probability ${p}. Chance of at least one success in ${n} tries, in %?`, qty(pr, '%', 0.02, sig(pr)), `1 - (1 - ${p})^${n} = ${sig(pr)}%. Countermeasures: glitch detectors, redundant checks, random delays, and failing closed.`, '1 - P(all fail).'),
      'the chance of at least one success', idea,
      calc('The chance of failing once, 1 - p:', `1 - ${p}`, 1 - p, '', sig(1 - p, 5), 0.0005),
      calc(`All ${n} must fail: (1 - p)^${n}:`, `${sig(1 - p, 5)}^${n}`, (1 - p) ** n, '', sig((1 - p) ** n, 4), 0.01),
      calc('At least one success = 1 minus that, as a %:', `(1 - ${sig((1 - p) ** n, 4)}) × 100`, pr, '%', sig(pr), 0.02));
  },
  (r) => concept(r, [
    ['What is a hardware root of trust?', 'A small, isolated, immutable block (boot ROM, fused keys, crypto) that verifies the first code, which verifies the next', ['The first transistor', 'The operating system', 'A password manager'], 'the root of trust', 'Security starts from something that cannot be changed: a small block with code in ROM and keys in fuses. It checks the first piece of software before it runs, which then checks the next, forming a chain. The root is trusted because nothing can alter it.', ['The root of trust can be trusted because it:', 'Cannot be modified', ['Is the largest block', 'Runs the fastest']]],
    ['How did Spectre leak secrets?', 'Speculatively executed instructions that were later cancelled still left traces in the cache that could be timed', ['It printed memory', 'It broke AES', 'It glitched the voltage'], 'speculative execution attacks', 'A CPU guesses ahead and runs instructions speculatively; if the guess was wrong, it undoes their architectural effects. But the cache still holds data those instructions touched, and an attacker can time memory accesses to learn what was touched.', ['A cancelled speculative instruction can still leave a trace in:', 'The cache', ['The registers', 'The program counter']]],
    ['What is a PUF?', 'A circuit that turns random manufacturing variation into a device-unique key that is never stored', ['A cheap cipher', 'A fuse bank', 'A random number from software'], 'physically unclonable functions', 'No two chips are exactly alike at the atomic scale. A PUF measures those tiny random differences (for example which of two identical circuits is faster) and turns them into a key that is unique to the chip. The key is re-derived each time, so there is nothing stored to steal.', ['A PUF key comes from:', 'Random manufacturing variation', ['A stored fuse value', 'Software']]],
    ['Why do secure chips run crypto in constant time?', 'So execution time never depends on secret data, closing timing side channels', ['To save power', 'To make the clock simpler', 'Because it is faster'], 'constant-time code', 'If the time taken (or which memory gets touched) depends on a secret, anyone who measures it learns something about the secret. Constant-time code does the same work in the same time whatever the secret is.', ['If timing never depends on the secret, timing reveals:', 'Nothing about the secret', ['The whole secret', 'The key size only']]],
    ['What does a secure boot chain check at each stage?', 'A signature of the next image, using a key anchored in the root of trust', ['The file size', 'The CPU temperature', 'That the image is compressed'], 'secure boot', 'Before running the next piece of code, each stage verifies its digital signature, using a public key that traces back to the root of trust. A valid signature proves the code came from the key holder and has not been altered.', ['A digital signature proves the image:', 'Came from the key holder and was not modified', ['Is small', 'Is compressed']]],
  ], (why) => `${why}.`),
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
    const idea = 'FIT is the unit of failure rate: one FIT is one failure per 10⁹ device-hours. So the expected number of failures = FIT × (total device-hours) ÷ 10⁹. The mean time to failure (MTTF) of a single device is the reverse: 10⁹ ÷ FIT hours.';
    if (d === 1) {
      const cars = pick(r, [100000, 1000000]), hrs = pick(r, [300, 500]), f = (fit * cars * hrs) / 1e9;
      return walk(ask(`A chip is rated ${fit} FIT (failures per 10⁹ hours). ${cars.toLocaleString('en-US')} cars each run it ${hrs} hours a year. Expected failures per year across the fleet?`, qty(f, '', 0.02, sig(f)), `${fit} × ${cars} × ${hrs} / 1e9 = ${sig(f)}.`, 'FIT × device-hours / 10⁹.'),
        'fleet failures from a FIT rate', idea,
        calc('Total device-hours = cars × hours each:', `${cars} × ${hrs}`, cars * hrs, '', sci(cars * hrs, 2), 0.01),
        calc('Failures = FIT × device-hours ÷ 10⁹:', `${fit} × ${sci(cars * hrs, 2)} / 1e9`, f, '', sig(f), 0.02));
    }
    if (d === 2) {
      const y = 1e9 / fit / 8760;
      return walk(ask(`A part is rated ${fit} FIT. MTTF, in years?`, qty(y, 'years', 0.02, sig(y)), `1e9 / ${fit} = ${sig(1e9 / fit)} hours = ${sig(y)} years. A huge MTTF per part still means many failures across millions of cars.`, '10⁹ / FIT hours.'),
        'MTTF from FIT', idea,
        calc('MTTF in hours = 10⁹ ÷ FIT:', `1e9 / ${fit}`, 1e9 / fit, 'h', sci(1e9 / fit, 2), 0.01),
        calc('In years (÷ 8760 hours per year):', `${sci(1e9 / fit, 2)} / 8760`, y, 'years', sig(y), 0.02));
    }
    const n = pick(r, [1000, 2000]), h = pick(r, [1000, 2000]), fails = pick(r, [1, 2, 3]), f = (fails / (n * h)) * 1e9;
    return walk(ask(`A reliability test runs ${n} parts for ${h} hours and sees ${fails} failure${fails > 1 ? 's' : ''}. Point estimate of the FIT rate?`, qty(f, '', 0.02, sig(f)), `${fails} / (${n} × ${h}) × 1e9 = ${sig(f)} FIT. Real qualification uses a confidence bound, which is higher.`, 'Failures per 10⁹ device-hours.'),
      'estimating FIT from a test', `${idea} To estimate FIT from a test, turn it around: FIT = failures ÷ device-hours × 10⁹.`,
      count('Device-hours = parts × hours each:', `${n} × ${h}`, n * h),
      calc('FIT = failures ÷ device-hours × 10⁹:', `${fails} / ${n * h} × 1e9`, f, '', sig(f), 0.02));
  },
  (r, d) => {
    const k = pick(r, [8, 16, 32, 64, 128]);
    let rr = 1;
    while (2 ** rr < k + rr + 1) rr++;
    const idea = 'A Hamming code adds r check bits to k data bits so that one flipped bit can be located and fixed. The r check bits must be able to say which of the k + r bit positions is wrong, or that none is: 2^r ≥ k + r + 1. SECDED adds one more overall parity bit, so a double-bit error is detected too (but not corrected).';
    const table = show(Array.from({ length: rr }, (_, i) => `r = ${i + 1}: 2^${i + 1} = ${2 ** (i + 1)}  vs  k + r + 1 = ${k + i + 2}  ${2 ** (i + 1) >= k + i + 2 ? '✓ enough' : '✗ too small'}`).join('\n'), `try r = 1, 2, 3… for k = ${k}`);
    if (d === 1) return walk(ask(`How many check bits does a Hamming single-error-correcting (SEC) code need for ${k} data bits?`, num(rr), `Smallest r with 2^r ≥ k + r + 1: r = ${rr}.`, '2^r must name every bit position plus "no error".'),
      'Hamming check bits', idea, table,
      count('The smallest r that is enough:', 'first ✓', rr));
    if (d === 2) return walk(ask(`How many check bits does SECDED (single-correct, double-detect) need for ${k} data bits?`, num(rr + 1), `SEC needs ${rr}; one overall parity bit adds double detection: ${rr + 1}.`, 'SEC plus one parity bit.'),
      'SECDED check bits', idea, table,
      count('SEC needs this many check bits (first ✓):', 'first ✓', rr),
      count('SECDED adds one overall parity bit:', `${rr} + 1`, rr + 1));
    return walk(ask(`SECDED on ${k}-bit words. Storage overhead, in %?`, qty(((rr + 1) / k) * 100, '%', 0.02, sig(((rr + 1) / k) * 100)), `${rr + 1} / ${k} = ${sig(((rr + 1) / k) * 100)}%. Wider words amortize the check bits better.`, 'Check bits / data bits.'),
      'ECC storage overhead', idea, table,
      count('SECDED check bits = SEC bits + 1:', `${rr} + 1`, rr + 1),
      calc('Overhead = check bits ÷ data bits, as a %:', `${rr + 1} / ${k} × 100`, ((rr + 1) / k) * 100, '%', sig(((rr + 1) / k) * 100), 0.02));
  },
  (r, d) => {
    const safe = pick(r, [0.3, 0.4, 0.5]);
    const idea = 'Faults can be SAFE (they cannot cause a dangerous failure) or dangerous. A safety mechanism detects a fraction DC (diagnostic coverage) of the dangerous faults. The rest are RESIDUAL faults: dangerous and undetected. The single-point fault metric SPFM = 1 - (residual faults ÷ all faults). So residual = (1 - safe) × (1 - DC), as a fraction of ALL faults. ASIL D needs SPFM ≥ 99%.';
    if (d < 3) {
      const dc = pick(r, [0.9, 0.97, 0.99]), spfm = (1 - (1 - safe) * (1 - dc)) * 100;
      const res = (1 - safe) * (1 - dc);
      return walk(ask(`${safe * 100}% of a block's faults are safe. A safety mechanism detects ${dc * 100}% of the rest (the others are residual faults). SPFM (1 - residual / total), in %?`, qty(spfm, '%', 0.002, sig(spfm, 4)), `Residual = ${sig(1 - safe)} × ${sig(1 - dc)} = ${sig((1 - safe) * (1 - dc))} of all faults. SPFM = ${sig(spfm, 4)}%. ASIL D needs ≥ 99%.`, 'Only undetected dangerous faults count against you.'),
        'the single-point fault metric', idea,
        calc('The fraction of faults that are dangerous, 1 - safe:', `1 - ${safe}`, 1 - safe, '', sig(1 - safe, 4), 0.002),
        calc('The fraction of those that are NOT detected, 1 - DC:', `1 - ${dc}`, 1 - dc, '', sig(1 - dc, 4), 0.002),
        calc('Residual = dangerous × undetected (as a fraction of all faults):', `${sig(1 - safe, 4)} × ${sig(1 - dc, 4)}`, res, '', sig(res, 5), 0.002),
        calc('SPFM = 1 - residual, as a %:', `(1 - ${sig(res, 5)}) × 100`, spfm, '%', sig(spfm, 4), 0.002));
    }
    const dc = (1 - 0.01 / (1 - safe)) * 100;
    return walk(ask(`${safe * 100}% of faults are safe. What diagnostic coverage of the rest reaches exactly SPFM = 99% (ASIL D), in %?`, qty(dc, '%', 0.002, sig(dc, 4)), `Residual must be 1% of all faults: (1 - ${safe}) × (1 - DC) = 0.01 → DC = ${sig(dc, 4)}%.`, 'Solve (1 - safe)(1 - DC) = 0.01.'),
      'the coverage an SPFM target needs', `${idea} Here SPFM is the target (99%), so the residual must be at most 1% = 0.01 of all faults. Solve (1 - safe) × (1 - DC) = 0.01 for DC.`,
      calc('The undetected fraction needed, 1 - DC = 0.01 ÷ (1 - safe):', `0.01 / (1 - ${safe})`, 0.01 / (1 - safe), '', sig(0.01 / (1 - safe), 5), 0.002),
      calc('DC = 1 minus that, as a %:', `(1 - ${sig(0.01 / (1 - safe), 5)}) × 100`, dc, '%', sig(dc, 4), 0.002));
  },
  (r, d) => {
    const parts = tier(d, [['CPU', 20], ['RAM', 30]], [['CPU', 40], ['RAM', 60], ['bus', 10]], [['CPU', 80], ['RAM', 120], ['bus', 20], ['clock', 5]]) as [string, number][];
    const dc = pick(r, [0.9, 0.95, 0.99]), total = parts.reduce((a, [, f]) => a + f, 0), res = total * (1 - dc);
    return walk(ask(`Raw dangerous FIT: ${parts.map(([n, f]) => `${n} ${f}`).join(', ')}. Every part has ${dc * 100}% diagnostic coverage. Residual FIT (PMHF contribution)?`, qty(res, '', 0.02, sig(res)), `(${parts.map(([, f]) => f).join(' + ')}) × ${sig(1 - dc)} = ${sig(res)} FIT. ASIL D requires under 10 FIT for the whole item${res >= 10 ? ', so this fails' : ''}.`, 'Sum × (1 - coverage).'),
      'residual FIT (PMHF)', 'The probabilistic metric for random hardware failures (PMHF) adds up the failure rate (in FIT) of all the dangerous faults that are NOT caught by a safety mechanism. For each block the undetected part is FIT × (1 - coverage). When all blocks have the same coverage, add the raw FITs first and multiply once.',
      calc('Total raw dangerous FIT = the sum:', parts.map(([, f]) => f).join(' + '), total, '', String(total), 0.001),
      calc('The undetected fraction, 1 - coverage:', `1 - ${dc}`, 1 - dc, '', sig(1 - dc, 4), 0.002),
      calc('Residual FIT = total × undetected fraction:', `${total} × ${sig(1 - dc, 4)}`, res, '', sig(res), 0.02));
  },
  (r) => concept(r, [
    ['ISO 26262 grades risk ASIL A to D. Which needs the most rigor?', 'ASIL D, for example braking and steering', ['ASIL A', 'QM', 'They are equal'], 'ASIL levels', 'The automotive safety integrity level is set by three things: how severe the harm would be, how often the situation occurs, and how controllable it is for the driver. Losing the brakes is worst on all three, so it is ASIL D, with the strictest requirements.', ['Losing braking is graded:', 'ASIL D, the highest', ['ASIL A', 'No rating']]],
    ['Which is a random hardware fault rather than a systematic one?', 'An alpha particle flips a bit in SRAM', ['A bug in the RTL', 'A wrong requirement', 'A missing timing constraint'], 'random versus systematic faults', 'Random faults come from physics and happen by chance in working hardware (a particle, wear); safety mechanisms handle them. Systematic faults come from mistakes in the design or the requirements, which are built into every unit and are prevented by a good process.', ['A bug in the RTL is:', 'A systematic fault', ['A random fault', 'A particle']]],
    ['Two identical cores run a couple of cycles apart and compare outputs every cycle. What is it?', 'Dual-core lockstep: it detects random faults in either core', ['Hyperthreading', 'Speculation', 'Cache coherence'], 'lockstep cores', 'Two cores run the same program and a checker compares their outputs. If a random fault upsets only one, the outputs differ and the fault is caught. A small delay between them makes it unlikely that one event corrupts both the same way.', ['A mismatch between the two cores means:', 'A fault happened in one of them', ['Everything is fine', 'The program is long']]],
    ['How do you show a safety mechanism reaches its claimed coverage?', 'Fault-injection campaigns: force faults in simulation or emulation and count how many are detected', ['Ask the designer', 'Run the normal regression', 'Measure power'], 'measuring coverage', 'Coverage is a measured number, not a promise. You deliberately inject many faults (flip bits, stick signals) in simulation or emulation and count how many the safety mechanism catches.', ['Diagnostic coverage is measured by:', 'Injecting faults and counting detections', ['Reading the spec', 'Counting lines of code']]],
    ['Why does a watchdog timer exist in a safety system?', 'To detect software or clock lock-ups: if it is not serviced in time, it forces a safe state', ['To count cars', 'To speed up boot', 'To encrypt data'], 'watchdog timers', 'A watchdog is an independent timer that counts down. Healthy software "kicks" it regularly to restart the count. If the software hangs, it stops kicking, the timer runs out, and the watchdog forces a reset into a safe state.', ['A hung program stops kicking the watchdog, so it:', 'Expires and forces a safe reset', ['Keeps counting up', 'Is never noticed']]],
  ], (why) => `${why}.`),
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
    const idea = 'Light comes in particles called photons, and each photon of wavelength λ carries energy E = h·c ÷ λ. In convenient units: E (in eV) = 1.24 ÷ λ (in µm). A semiconductor can absorb a photon only if its energy is at least the material\'s band gap Eg. So the LONGEST wavelength a material absorbs is where the photon energy equals the band gap: λ = 1.24 ÷ Eg.';
    if (d < 3) return walk(ask(`${m[0]} has a band gap of ${m[1]} eV. Longest wavelength it absorbs, in µm? (λ = 1.24/Eg)`, qty(1.24 / m[1], 'um', 0.02, sig(1.24 / m[1])), `1.24 / ${m[1]} = ${sig(1.24 / m[1])} µm. Silicon is transparent at 1.31 and 1.55 µm, which is why it makes good waveguides and needs germanium to detect light.`, 'Photon energy must exceed the band gap.'),
      'the absorption edge', idea,
      choice('A photon can be absorbed only if its energy is:', 'At least the band gap', ['Below the band gap', 'Exactly zero']),
      calc('λ = 1.24 ÷ Eg, in µm:', `1.24 / ${m[1]}`, 1.24 / m[1], 'um', sig(1.24 / m[1]), 0.02));
    const lam = pick(r, [1.31, 1.55]), e = 1.24 / lam;
    return walk(ask(`What is the energy of a ${lam} µm photon, in eV?`, qty(e, 'eV', 0.02, sig(e)), `1.24 / ${lam} = ${sig(e)} eV: below silicon's 1.12 eV band gap, so silicon cannot absorb it.`, 'E = 1.24/λ with λ in µm.'),
      'photon energy', idea,
      calc('E = 1.24 ÷ λ, in eV:', `1.24 / ${lam}`, e, 'eV', sig(e), 0.02));
  },
  (r, d) => {
    const ch = tier(d, pick(r, [4, 8]), pick(r, [8, 16]), pick(r, [16, 32])), rate = pick(r, [25, 50, 100, 200]), t = (ch * rate) / 1000;
    return walk(ask(`WDM puts ${ch} wavelengths on one fibre at ${rate} Gb/s each. Total, in Tb/s?`, qty(t, 'Tb/s', 0.02, sig(t)), `${ch} × ${rate} = ${ch * rate} Gb/s = ${sig(t)} Tb/s. One fibre, many colours.`, 'Channels × rate.'),
      'wavelength-division multiplexing', 'Different colours (wavelengths) of light do not interfere with each other, so one fibre can carry many separate data streams at once, one per wavelength: wavelength-division multiplexing (WDM). The total data rate is the number of wavelengths times the rate of each.',
      count('Total in Gb/s = channels × rate per channel:', `${ch} × ${rate}`, ch * rate),
      calc('Convert Gb/s to Tb/s (÷ 1000):', `${ch * rate} / 1000`, t, 'Tb/s', sig(t), 0.02));
  },
  (r, d) => {
    const tb = pick(r, [12.8, 25.6, 51.2]), pj = tier(d, pick(r, [10, 15]), pick(r, [5, 10]), pick(r, [1, 3])), w = tb * pj;
    return walk(ask(`A ${tb} Tb/s switch spends ${pj} pJ/bit on its I/O. I/O power, in W?`, qty(w, 'W', 0.02, sig(w)), `${tb}e12 × ${pj}e-12 = ${sig(w)} W. Co-packaged optics aims at a few pJ/bit to keep this from dominating the chip.`, 'Bits per second × joules per bit.'),
      'power from energy per bit', 'Power is energy per second. If each bit costs a certain energy (pJ per bit) and the link moves a number of bits per second, then power = (bits per second) × (joules per bit). Tera (10¹²) and pico (10⁻¹²) cancel exactly, so Tb/s × pJ/bit gives watts directly.',
      calc('Bits per second × energy per bit; 10¹² × 10⁻¹² = 1, so just multiply the numbers, in W:', `${tb} × ${pj}`, w, 'W', sig(w), 0.02));
  },
  (r, d) => {
    const las = pick(r, [0, 3, 6, 10]), cpl = pick(r, [1.5, 2, 3]), mod = pick(r, [3, 5, 6]), wg = pick(r, [1, 2]), rx = las - 2 * cpl - mod - wg;
    const idea = 'An optical link budget works in dB, just like radio. Start with the laser power (in dBm) and subtract every loss on the way: each coupler, the modulator, the waveguide. What arrives at the photodetector is the received power. The link margin is how many dB this is above the receiver\'s sensitivity: the extra room for aging and temperature.';
    if (d < 3) return walk(ask(`Laser ${las} dBm. Two couplers of ${cpl} dB, a modulator of ${mod} dB, ${wg} dB of waveguide loss. Power at the photodetector, in dBm?`, qty(rx, 'dBm', 0.02, sig(rx)), `${las} - ${2 * cpl} - ${mod} - ${wg} = ${sig(rx)} dBm.`, 'Subtract every loss.'),
      'an optical loss budget', idea,
      calc(`Total loss = two couplers (2 × ${cpl}) + modulator + waveguide, in dB:`, `2 × ${cpl} + ${mod} + ${wg}`, 2 * cpl + mod + wg, 'dB', sig(2 * cpl + mod + wg, 4), 0.005),
      calc('Received power = laser power minus the total loss, in dBm:', `${las} - ${sig(2 * cpl + mod + wg, 4)}`, rx, 'dBm', sig(rx), 0.02));
    const sens = pick(r, [-12, -10, -8]), m = rx - sens;
    return walk(ask(`Laser ${las} dBm, losses: 2 × ${cpl} dB couplers, ${mod} dB modulator, ${wg} dB waveguide. Receiver sensitivity ${sens} dBm. Link margin, in dB?`, qty(m, 'dB', 0.03, sig(m)), `Received ${sig(rx)} dBm. Margin = ${sig(rx)} - (${sens}) = ${sig(m)} dB.${m < 3 ? ' Too thin: aging and temperature eat a few dB.' : ''}`, 'Received power minus sensitivity.'),
      'optical link margin', idea,
      calc('Total loss, in dB:', `2 × ${cpl} + ${mod} + ${wg}`, 2 * cpl + mod + wg, 'dB', sig(2 * cpl + mod + wg, 4), 0.005),
      calc('Received power = laser minus loss, in dBm:', `${las} - ${sig(2 * cpl + mod + wg, 4)}`, rx, 'dBm', sig(rx, 4), 0.005),
      calc('Margin = received power minus sensitivity, in dB:', `${sig(rx, 4)} - (${sens})`, m, 'dB', sig(m), 0.03));
  },
  (r, d) => {
    const resp = pick(r, [0.8, 0.9, 1.0]);
    const idea = 'A photodetector turns light into current. Its responsivity R (in amperes per watt) says how much current flows per watt of light: I = R × P. If the power is given in dBm, convert it to milliwatts first: P(mW) = 10^(dBm ÷ 10).';
    if (d === 1) {
      const p = pick(r, [0.1, 0.5, 1]);
      return walk(ask(`A photodetector with responsivity ${resp} A/W receives ${p} mW. Photocurrent, in mA?`, qty(resp * p, 'mA', 0.02, sig(resp * p)), `I = R × P = ${resp} × ${p} = ${sig(resp * p)} mA.`, 'I = R·P.'),
        'photocurrent', idea,
        calc('I = R × P. A/W × mW gives mA:', `${resp} × ${p}`, resp * p, 'mA', sig(resp * p), 0.02));
    }
    if (d === 2) {
      const dbm = pick(r, [-10, -6, -3]), p = 10 ** (dbm / 10), i = resp * p * 1000;
      return walk(ask(`A ${resp} A/W photodetector receives ${dbm} dBm. Photocurrent, in µA?`, qty(i, 'uA', 0.02, sig(i)), `${dbm} dBm = ${sig(p)} mW; × ${resp} A/W = ${sig(i)} µA.`, 'Convert dBm to mW first.'),
        'photocurrent from dBm', idea,
        calc('Power in mW = 10^(dBm ÷ 10):', `10^(${dbm} / 10)`, p, 'mW', sig(p, 4), 0.005),
        calc('I = R × P in mA, then × 1000 for µA:', `${resp} × ${sig(p, 4)} × 1000`, i, 'uA', sig(i), 0.02));
    }
    const lam = pick(r, [1.31, 1.55]), eta = pick(r, [0.7, 0.8, 0.9]), rr = (lam * eta) / 1.24;
    return walk(ask(`A detector at ${lam} µm has ${eta * 100}% quantum efficiency. Responsivity, in A/W? (R = η·λ/1.24, λ in µm)`, qty(rr, 'A/W', 0.02, sig(rr)), `${eta} × ${lam} / 1.24 = ${sig(rr)} A/W. Longer wavelengths give more electrons per watt because each photon carries less energy.`, 'Electrons per photon × photons per joule.'),
      'responsivity from quantum efficiency', 'Each absorbed photon can release at most one electron. The quantum efficiency η is the fraction of photons that do. A watt of light at a longer wavelength contains MORE photons (each carries less energy), so it releases more electrons. The result: R = η × λ ÷ 1.24, with λ in µm, in A/W.',
      calc('λ × η (micrometres × efficiency):', `${lam} × ${eta}`, lam * eta, '', sig(lam * eta, 4), 0.005),
      calc('R = that ÷ 1.24, in A/W:', `${sig(lam * eta, 4)} / 1.24`, rr, 'A/W', sig(rr), 0.02));
  },
  (r) => concept(r, [
    ['Why can\'t you easily make a laser out of silicon?', 'Its indirect band gap makes electrons and holes rarely recombine by emitting light; lasers use III-V materials bonded or attached', ['Silicon is too expensive', 'Silicon absorbs all light', 'Silicon melts'], 'direct versus indirect band gaps', 'In a direct band-gap material, an electron and a hole recombine by emitting a photon easily. Silicon has an indirect band gap: recombination also needs a lattice vibration (a phonon), which makes light emission rare and inefficient. So lasers are made of III-V materials such as InP and attached to the silicon.', ['Silicon emits light poorly because its band gap is:', 'Indirect', ['Direct', 'Too wide']]],
    ['What is the classic problem with ring modulators?', 'Their resonance drifts strongly with temperature, so each needs a heater and control loop', ['They only work in red light', 'They are too big', 'They need no power'], 'ring resonators', 'A ring modulator works only for wavelengths that fit the ring exactly (its resonance). Silicon\'s refractive index changes with temperature, which shifts the resonant wavelength (about 0.1 nm per kelvin), so a heater and feedback loop must hold it in place.', ['If the ring heats up, its resonant wavelength:', 'Shifts', ['Stays the same', 'Disappears']]],
    ['Why move optics into the package (co-packaged optics)?', 'Electrical traces to the front panel burn too much power at high rates; optics near the switch cuts pJ/bit', ['Fibres are cheaper than copper', 'It removes lasers', 'It makes the chip smaller'], 'co-packaged optics', 'Driving 200 Gb/s over long copper traces on a board needs power-hungry equalizing circuits. If the optical engine sits right next to the switch chip, the electrical path is only a few millimetres, which needs much less power per bit.', ['A shorter electrical path needs:', 'Less power per bit', ['More power per bit', 'No power']]],
    ['What does a Mach-Zehnder modulator do?', 'Splits light into two arms, shifts the phase of one, and recombines them so interference turns phase into intensity', ['Makes light', 'Detects light', 'Amplifies light'], 'Mach-Zehnder modulators', 'The light is split into two paths. A voltage changes the phase of light in one arm. When the paths recombine, waves in phase add up (bright) and waves 180° apart cancel (dark), so the voltage controls the output intensity.', ['Two waves 180° out of phase, when combined:', 'Cancel', ['Add up', 'Double in frequency']]],
  ], (why) => `${why}.`),
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
    const idea = 'A single qubit is described by 2 amplitudes (one for 0, one for 1). Two qubits need 4 (00, 01, 10, 11). Every extra qubit DOUBLES the number of bit patterns, and entangled qubits need one complex amplitude for every pattern: n qubits need 2^n amplitudes. That is why simulating quantum computers classically becomes impossible so quickly.';
    if (d === 1) {
      const n = pick(r, [3, 10, 20, 50]);
      return walk(ask(`How many complex amplitudes describe the state of ${n} entangled qubits?`, qty(2 ** n, '', 0.01, String(2 ** n)), `2^${n} = ${(2 ** n).toLocaleString('en-US')}: one amplitude per bit pattern.`, 'Every bit pattern gets an amplitude.'),
        'the size of a quantum state', idea,
        choice('Each extra qubit makes the number of amplitudes:', 'Twice as big', ['One bigger', 'Ten times bigger']),
        calc(`${n} qubits: 2 multiplied by itself ${n} times:`, `2^${n}`, 2 ** n, '', n <= 20 ? String(2 ** n) : sci(2 ** n, 3), 0.01));
    }
    if (d === 2) {
      const n = pick(r, [30, 34, 40]), gb = (16 * 2 ** n) / 1e9;
      return walk(ask(`A classical simulator stores ${n} qubits as 16-byte complex amplitudes. Memory, in GB?`, qty(gb, 'GB', 0.02, sig(gb)), `16 × 2^${n} = ${sig(gb)} GB. Each extra qubit doubles it.`, '16 × 2^n bytes.'),
        'memory to simulate qubits', `${idea} A simulator stores each amplitude as a complex number of 16 bytes.`,
        calc('Number of amplitudes, 2^n:', `2^${n}`, 2 ** n, '', sci(2 ** n, 3), 0.01),
        calc('GB = amplitudes × 16 bytes ÷ 1e9:', `${sci(2 ** n, 3)} × 16 / 1e9`, gb, 'GB', sig(gb), 0.02));
    }
    const tb = pick(r, [1, 100]), n = Math.floor(Math.log2((tb * 1e12) / 16));
    return walk(ask(`How many qubits can a full state-vector simulation hold in ${tb} TB (16 bytes per amplitude)?`, num(n), `2^n × 16 ≤ ${tb}e12 → n = ${n}. A hundred times the memory buys only ${Math.round(Math.log2(100))} more qubits.`, 'log2(memory / 16), rounded down.'),
      'how many qubits fit in memory', `${idea} To find how many qubits fit, ask how many amplitudes the memory can hold, then how many times 2 doubles to that (log base 2), rounded down.`,
      calc('Amplitudes that fit = memory in bytes ÷ 16:', `${tb}e12 / 16`, (tb * 1e12) / 16, '', sci((tb * 1e12) / 16, 3), 0.01),
      calc('How many doublings: log2 of that:', `log2(${sci((tb * 1e12) / 16, 3)})`, Math.log2((tb * 1e12) / 16), '', sig(Math.log2((tb * 1e12) / 16), 4), 0.003),
      count('Round down to a whole number of qubits:', `floor(${sig(Math.log2((tb * 1e12) / 16), 4)})`, n));
  },
  (r, d) => {
    const idea = 'Measuring a qubit gives 0 or 1 at random. If the qubit is in the state a|0⟩ + b|1⟩, the probability of reading 1 is b², the SQUARE of its amplitude (the Born rule); reading 0 has probability a², and the two add up to 1.';
    if (d === 1) return walk(ask('A qubit in |0⟩ goes through a Hadamard gate and is measured. Probability of reading 1, in %?', qty(50, '%', 0.01, '50'), 'H makes (|0⟩ + |1⟩)/√2, and each outcome has probability (1/√2)² = 50%.', 'Square the amplitude.'),
      'the Born rule after a Hadamard', `${idea} The Hadamard gate turns |0⟩ into (|0⟩ + |1⟩) ÷ √2: both amplitudes are 1 ÷ √2.`,
      calc('Probability of 1 = (1 ÷ √2) squared, as a %:', '(1 / sqrt(2))^2 × 100', 50, '%', '50', 0.01));
    if (d === 2) {
      const [a, b] = pick(r, [[0.6, 0.8], [0.8, 0.6], [0.28, 0.96]] as const);
      return walk(ask(`A qubit is in ${a}|0⟩ + ${b}|1⟩. Probability of measuring 1, in %?`, qty(b * b * 100, '%', 0.01, sig(b * b * 100)), `|${b}|² = ${sig(b * b)} → ${sig(b * b * 100)}%. Probabilities are squared amplitudes, and they add to 1.`, 'Born rule.'),
        'the Born rule', idea,
        choice('The amplitude of |1⟩ is ' + b + '. The probability of reading 1 is the amplitude:', 'Squared', ['Itself', 'Doubled']),
        calc('Probability = amplitude squared, as a % (× 100):', `${b}^2 × 100`, b * b * 100, '%', sig(b * b * 100), 0.01));
    }
    const th = pick(r, [30, 60, 90, 120]), p = Math.sin(((th / 2) * Math.PI) / 180) ** 2 * 100;
    return walk(ask(`A qubit in |0⟩ is rotated by θ = ${th}° about the X axis, giving cos(θ/2)|0⟩ - i·sin(θ/2)|1⟩. Probability of measuring 1, in %?`, qty(p, '%', 0.02, sig(p)), `sin²(${th / 2}°) = ${sig(p)}%. A π rotation (180°) flips the qubit completely.`, 'sin²(θ/2).'),
      'the Born rule after a rotation', `${idea} After the rotation, the amplitude of |1⟩ is sin(θ/2) (the factor -i only changes its phase, not its size). So the probability of 1 is sin²(θ/2).`,
      calc('Half the angle, θ/2, in degrees:', `${th} / 2`, th / 2, '', String(th / 2), 0.001),
      calc('The amplitude sin(θ/2) (calculator in degree mode):', `sin(${th / 2})`, Math.sin(((th / 2) * Math.PI) / 180), '', sig(Math.sin(((th / 2) * Math.PI) / 180), 4), 0.005),
      calc('Probability = amplitude squared, as a %:', `${sig(Math.sin(((th / 2) * Math.PI) / 180), 4)}^2 × 100`, p, '%', sig(p), 0.02));
  },
  (r, d) => {
    const f = pick(r, [0.99, 0.995, 0.999]);
    const idea = 'If each gate succeeds with probability f (its fidelity), and errors are independent, then a circuit of n gates runs error-free with probability f^n: the chances multiply. Even very good gates compound into a poor result over many operations.';
    if (d < 3) {
      const n = pick(r, [50, 100, 500]), p = f ** n * 100;
      return walk(ask(`Every gate has ${f * 100}% fidelity. What fraction of runs of a ${n}-gate circuit finish with no error, in %?`, qty(p, '%', 0.03, sig(p)), `${f}^${n} = ${sig(p)}%. Errors compound.`, 'Multiply the per-gate success.'),
        'errors compounding', idea,
        calc(`All ${n} gates must succeed: f^n, as a % (× 100):`, `${f}^${n} × 100`, p, '%', sig(p), 0.03));
    }
    const n = Math.log(0.5) / Math.log(f);
    return walk(ask(`At ${f * 100}% gate fidelity, after how many gates does the chance of an error-free run fall to 50%?`, qty(n, '', 0.03, String(Math.round(n))), `ln(0.5) / ln(${f}) ≈ ${Math.round(n)} gates. Useful algorithms need millions: error correction is mandatory.`, 'Solve f^n = 0.5.'),
      'gates until a coin flip', `${idea} To find n where f^n = 0.5, take the natural log of both sides: n × ln(f) = ln(0.5), so n = ln(0.5) ÷ ln(f). Both logs are negative, so the result is positive.`,
      calc('ln(0.5):', 'ln(0.5)', Math.log(0.5), '', sig(Math.log(0.5), 4), 0.003),
      calc(`ln(${f}):`, `ln(${f})`, Math.log(f), '', sig(Math.log(f), 4), 0.003),
      calc('n = the first divided by the second:', `${sig(Math.log(0.5), 4)} / ${sig(Math.log(f), 4)}`, n, '', String(Math.round(n)), 0.03));
  },
  (r, d) => {
    const t1 = pick(r, [50, 100, 300]), t = pick(r, [10, 20, 50]);
    if (d < 3) return walk(ask(`A qubit has T1 = ${t1} µs. Probability it is still excited after ${t} µs, in %?`, qty(Math.exp(-t / t1) * 100, '%', 0.02, sig(Math.exp(-t / t1) * 100)), `e^(-${t}/${t1}) = ${sig(Math.exp(-t / t1) * 100)}%.`, 'Exponential decay.'),
      'T1 decay', 'An excited qubit falls back to its ground state at random. T1 is the time constant of that decay: the chance it is still excited after a time t is e^(-t ÷ T1). After one T1, about 37% remain.',
      calc('The ratio t ÷ T1:', `${t} / ${t1}`, t / t1, '', sig(t / t1, 4), 0.005),
      calc('Probability = e^(-ratio), as a %:', `e^(-${sig(t / t1, 4)}) × 100`, Math.exp(-t / t1) * 100, '%', sig(Math.exp(-t / t1) * 100), 0.02));
    const g = pick(r, [20, 40, 100]), n = (t1 * 1000) / g;
    return walk(ask(`T1 = ${t1} µs and each gate takes ${g} ns. Roughly how many gates fit in one T1?`, qty(n, '', 0.02, String(Math.round(n))), `${t1 * 1000} / ${g} = ${Math.round(n)}. The ratio of coherence time to gate time is what matters, not either alone.`, 'Same units first.'),
      'gates per coherence time', 'What matters for a quantum computer is how many operations fit in the time a qubit stays coherent. Divide T1 by the gate time, after putting both in the same unit (1 µs = 1000 ns).',
      calc('T1 in ns:', `${t1} × 1000`, t1 * 1000, 'ns', String(t1 * 1000), 0.001),
      calc('Gates = T1 ÷ gate time:', `${t1 * 1000} / ${g}`, n, '', String(Math.round(n)), 0.02));
  },
  (r, d) => {
    if (d < 3) {
      const f = pick(r, [4, 5, 6, 8]), t = ((H * f * 1e9) / KB) * 1000;
      return walk(ask(`At what temperature does thermal energy kT equal one photon at ${f} GHz, in mK? (T = h·f/k)`, qty(t, 'mK', 0.03, String(Math.round(t))), `6.626e-34 × ${f}e9 / 1.38e-23 = ${Math.round(t)} mK. Qubits run at ~10 mK, far below that, so thermal photons rarely excite them.`, 'T = h·f/k.'),
        'the temperature of a photon', 'A photon of frequency f has energy h × f (h is Planck\'s constant, 6.626e-34 J·s). Heat gives each mode an average energy of about k × T (k is Boltzmann\'s constant, 1.38e-23 J/K). Setting them equal gives T = h·f ÷ k. If the fridge is much colder than that, thermal photons almost never excite the qubit.',
        calc('Photon energy h × f, in joules (f in Hz):', `6.626e-34 × ${f}e9`, H * f * 1e9, '', sci(H * f * 1e9, 3), 0.01),
        calc('T = energy ÷ k, in kelvin:', `${sci(H * f * 1e9, 3)} / 1.38e-23`, (H * f * 1e9) / KB, 'K', sig((H * f * 1e9) / KB, 4), 0.005),
        calc('Convert kelvin to millikelvin (× 1000):', `${sig((H * f * 1e9) / KB, 4)} × 1000`, t, 'mK', String(Math.round(t)), 0.03));
    }
    const dd = pick(r, [3, 5, 7, 11, 17, 25]), l = pick(r, [100, 1000]), per = 2 * dd * dd - 1;
    return walk(ask(`A distance-${dd} surface code uses 2d² - 1 physical qubits per logical qubit. How many physical qubits for ${l} logical qubits?`, qty(l * per, '', 0.01, String(l * per)), `2 × ${dd}² - 1 = ${per} per logical qubit, × ${l} = ${(l * per).toLocaleString('en-US')}.`, 'Per-logical cost × logical count.'),
      'surface-code overhead', 'Error correction spreads one logical qubit over many physical ones. In a surface code of distance d, a logical qubit costs about 2d² - 1 physical qubits (data plus measurement qubits). A larger distance corrects more errors but costs quadratically more. The total is the cost per logical qubit times the number of logical qubits.',
      count(`Physical qubits per logical one, 2 × d² - 1 with d = ${dd}:`, `2 × ${dd}^2 - 1`, per),
      count(`For ${l} logical qubits:`, `${per} × ${l}`, l * per));
  },
  (r) => concept(r, [
    ['Why does a transmon need a Josephson junction?', 'It is a nonlinear inductor, so the energy levels are unevenly spaced and the lowest two can be addressed alone', ['To connect it to ground', 'To make it superconduct', 'To cool it'], 'the Josephson junction', 'A plain LC circuit has evenly spaced energy levels, so a pulse meant to drive 0↔1 would also drive 1↔2. A Josephson junction acts as a nonlinear inductor, making the spacing uneven so that the qubit\'s two lowest levels can be addressed on their own.', ['Unevenly spaced levels let a pulse drive:', 'Only the 0↔1 transition', ['Every transition equally', 'No transition']]],
    ['Trapped ions vs superconducting qubits: which pairing is right?', 'Ions: long coherence and high fidelity but slow gates; superconducting: fast gates but shorter coherence', ['Ions are faster', 'Superconducting qubits need no fridge', 'They are identical'], 'qubit platforms', 'Each platform is a trade-off. Trapped ions are identical atoms isolated in vacuum: very long coherence and accurate gates, but slow. Superconducting circuits are made with chip technology and have fast gates, but the qubits decohere sooner.', ['Fast gates but shorter coherence describes:', 'Superconducting qubits', ['Trapped ions', 'Neither']]],
    ['What is the difference between T1 and T2?', 'T1 is energy relaxation (|1⟩ decays to |0⟩); T2 is loss of phase coherence, and T2 ≤ 2·T1', ['They are the same', 'T2 is always longer than T1', 'T1 is gate time'], 'T1 and T2', 'T1 measures how fast the qubit loses energy (falls from |1⟩ to |0⟩). T2 measures how fast it loses the phase relationship of a superposition. Energy loss always destroys the phase too, so T2 can never be more than 2 × T1; other noise shortens it further.', ['Losing energy also destroys phase, so T2 is at most:', '2 × T1', ['T1 ÷ 2', '10 × T1']]],
    ['Why can\'t you copy an unknown qubit to protect it?', 'The no-cloning theorem forbids it, so error correction spreads information across entangled qubits instead', ['Qubits are too small', 'It would be too slow', 'Copying is allowed but expensive'], 'no cloning', 'A law of quantum mechanics (no-cloning) forbids making a perfect copy of an unknown quantum state, and measuring it destroys the superposition. So quantum error correction encodes the data across entangled qubits and uses parity checks that find errors without learning the data.', ['Quantum error correction spreads the information across:', 'Many entangled qubits', ['Copies of the qubit', 'Classical bits']]],
  ], (why) => `${why}.`),
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
    return walk(ask(`The LO is ${lo} GHz and the IF is ${iff} MHz. You want the ${up ? 'upper' : 'lower'} sideband. Frequency at the qubit, in MHz?`, qty(f, 'MHz', 0.0005, String(f)), `${lo * 1000} ${up ? '+' : '-'} ${iff} = ${f} MHz. The other sideband and the LO leak through too, and must be cancelled by IQ calibration.`, `${up ? 'Add' : 'Subtract'} the IF.`),
      'upconversion with a mixer', 'The control electronics make a low-frequency signal (the IF, intermediate frequency) and a mixer multiplies it with a high-frequency local oscillator (LO). The output has TWO copies of the signal: one at LO + IF (the upper sideband) and one at LO - IF (the lower). Pick the one you want and cancel the other. Watch the units: put the LO in MHz first (1 GHz = 1000 MHz).',
      calc('The LO in MHz:', `${lo} × 1000`, lo * 1000, 'MHz', String(lo * 1000), 0.0005),
      calc(`The ${up ? 'upper sideband = LO + IF' : 'lower sideband = LO - IF'}, in MHz:`, `${lo * 1000} ${up ? '+' : '-'} ${iff}`, f, 'MHz', String(f), 0.0005));
  },
  (r, d) => {
    const fr = pick(r, [5, 10, 20, 25]), pi = 1000 / (2 * fr);
    const idea = 'To flip a qubit, the control pulse makes its state rotate (a Rabi oscillation) at the Rabi frequency. A full oscillation takes one period = 1 ÷ frequency and carries the qubit from |0⟩ to |1⟩ and back. So a π pulse (a flip, |0⟩ → |1⟩) is half a period, and a π/2 pulse (an equal superposition) is a quarter of one. With the frequency in MHz, the period in nanoseconds is 1000 ÷ frequency.';
    if (d === 1) return walk(ask(`The qubit Rabi-oscillates at ${fr} MHz. Length of a π pulse (half a Rabi period), in ns?`, qty(pi, 'ns', 0.02, sig(pi)), `Period = ${sig(1000 / fr)} ns; half = ${sig(pi)} ns.`, 'A full oscillation is |0⟩ → |1⟩ → |0⟩.'),
      'the π pulse', idea,
      calc('The period in ns = 1000 ÷ frequency (MHz):', `1000 / ${fr}`, 1000 / fr, 'ns', sig(1000 / fr, 4), 0.005),
      calc('A π pulse is half of it:', `${sig(1000 / fr, 4)} / 2`, pi, 'ns', sig(pi), 0.02));
    if (d === 2) return walk(ask(`The qubit Rabi-oscillates at ${fr} MHz. Length of a π/2 pulse, in ns?`, qty(pi / 2, 'ns', 0.02, sig(pi / 2)), `A quarter period: ${sig(pi / 2)} ns. It makes an equal superposition.`, 'Half of a π pulse.'),
      'the π/2 pulse', idea,
      calc('The period in ns = 1000 ÷ frequency (MHz):', `1000 / ${fr}`, 1000 / fr, 'ns', sig(1000 / fr, 4), 0.005),
      calc('A π/2 pulse is a quarter of it:', `${sig(1000 / fr, 4)} / 4`, pi / 2, 'ns', sig(pi / 2), 0.02));
    const t0 = pick(r, [20, 40, 50]), s = pick(r, [0.5, 0.8, 1.25]), t = t0 / s;
    return walk(ask(`A π pulse takes ${t0} ns at amplitude A. The amplitude is changed to ${s}·A with the same pulse shape. New π-pulse length, in ns?`, qty(t, 'ns', 0.02, sig(t)), `Rabi frequency is proportional to amplitude, so time scales as 1/${s}: ${sig(t)} ns.`, 'Rotation angle ∝ amplitude × time.'),
      'pulse amplitude versus length', 'The rotation angle a pulse produces is proportional to (amplitude × time). A π pulse needs a fixed angle, so if the amplitude gets bigger, the time needed gets shorter by the same factor, and vice versa: new time = old time ÷ amplitude scale.',
      calc('New length = old length ÷ amplitude scale, in ns:', `${t0} / ${s}`, t, 'ns', sig(t), 0.02));
  },
  (r, d) => {
    const a = pick(r, [10, 20, 30]), al = 10 ** (a / 10);
    const idea = 'An attenuator of A dB lets through only 1 ÷ 10^(A/10) of the power. It also adds its own thermal noise, at the temperature it sits at. So the noise temperature at its output is (noise in ÷ attenuation) + (its own temperature × (1 - 1/attenuation)). The hot noise from room temperature is reduced at each cold stage, but never below that stage\'s own temperature.';
    if (d === 1) return walk(ask(`A ${a} dB attenuator passes what fraction of the input power? (answer as 1/N: give N)`, qty(al, '', 0.01, String(al)), `10^(${a}/10) = ${al}: only 1/${al} gets through.`, 'Undo the dB.'),
      'attenuation in dB', idea,
      calc('N = 10^(dB ÷ 10):', `10^(${a} / 10)`, al, '', String(al), 0.01));
    const tin = pick(r, [300, 50]), ts = pick(r, [4, 0.8]), tout = tin / al + ts * (1 - 1 / al);
    if (d === 2) return walk(ask(`${tin} K of thermal noise enters a ${a} dB attenuator sitting at ${ts} K. Effective noise temperature at its output, in K?`, qty(tout, 'K', 0.02, sig(tout)), `T = ${tin}/${al} + ${ts} × (1 - 1/${al}) = ${sig(tout)} K. An attenuator at T emits noise at T, so each stage can only cool the noise to near its own temperature.`, 'Attenuated input plus the attenuator\'s own noise.'),
      'noise through an attenuator', idea,
      calc('The attenuation N = 10^(dB ÷ 10):', `10^(${a} / 10)`, al, '', String(al), 0.01),
      calc('The incoming noise, reduced: T in ÷ N, in K:', `${tin} / ${al}`, tin / al, 'K', sig(tin / al, 4), 0.005),
      calc('The attenuator\'s own noise: T stage × (1 - 1/N), in K:', `${ts} × (1 - 1/${al})`, ts * (1 - 1 / al), 'K', sig(ts * (1 - 1 / al), 4), 0.005),
      calc('Add them, in K:', `${sig(tin / al, 4)} + ${sig(ts * (1 - 1 / al), 4)}`, tout, 'K', sig(tout), 0.02));
    const t1 = 300 / 100 + 4 * (1 - 1 / 100), t2 = t1 / 100 + 0.1 * (1 - 1 / 100), t3 = t2 / al + 0.01 * (1 - 1 / al);
    return walk(ask(`300 K noise passes 20 dB at 4 K, 20 dB at 0.1 K, then ${a} dB at 10 mK. Noise temperature at the qubit, in mK?`, qty(t3 * 1000, 'mK', 0.03, sig(t3 * 1000)), `After 4 K: ${sig(t1)} K. After 0.1 K: ${sig(t2)} K. After 10 mK: ${sig(t3 * 1000)} mK. Attenuation spread over several stages is how drive lines stay quiet.`, 'Apply the formula stage by stage.'),
      'attenuators through the fridge stages', `${idea} Apply the same formula at each stage in turn. A 20 dB attenuator has N = 100.`,
      calc('After the 20 dB stage at 4 K: 300 ÷ 100 + 4 × (1 - 1/100), in K:', '300 / 100 + 4 × (1 - 1/100)', t1, 'K', sig(t1, 4), 0.005),
      calc('After the 20 dB stage at 0.1 K: previous ÷ 100 + 0.1 × (1 - 1/100), in K:', `${sig(t1, 4)} / 100 + 0.1 × (1 - 1/100)`, t2, 'K', sig(t2, 4), 0.005),
      calc(`After the ${a} dB stage at 10 mK (N = ${al}), in mK (× 1000 at the end):`, `(${sig(t2, 4)} / ${al} + 0.01 × (1 - 1/${al})) × 1000`, t3 * 1000, 'mK', sig(t3 * 1000), 0.03));
  },
  (r, d) => {
    const budget = pick(r, [1, 1.5, 2]);
    if (d < 3) {
      const per = pick(r, [1, 2, 5]), n = Math.floor((budget * 1000) / per);
      return walk(ask(`The 4 K stage can remove ${budget} W. A cryo-CMOS controller uses ${per} mW per qubit. How many qubits?`, num(n), `${budget * 1000} / ${per} = ${n}. A million qubits would need µW per qubit.`, 'Budget / per-qubit power.'),
        'a cryogenic power budget', 'The cold stage of a fridge can only remove a limited amount of heat (its cooling power). Every watt the electronics dissipate there must fit inside that. So the number of qubits is the budget divided by the power per qubit, rounded down. Convert watts to milliwatts (× 1000) first.',
        calc('The budget in mW:', `${budget} × 1000`, budget * 1000, 'mW', String(budget * 1000), 0.001),
        calc('Budget ÷ power per qubit:', `${budget * 1000} / ${per}`, (budget * 1000) / per, '', String((budget * 1000) / per), 0.001),
        count('Round down to whole qubits:', `floor(${(budget * 1000) / per})`, n));
    }
    const lines = pick(r, [2, 3]), heat = pick(r, [0.5, 1]), n = Math.floor((budget * 1000) / (lines * heat));
    return walk(ask(`Room-temperature control instead: each qubit needs ${lines} coax lines, and each line leaks ${heat} mW of heat into the 4 K stage (${budget} W budget). How many qubits?`, num(n), `${budget * 1000} / (${lines} × ${heat}) = ${n}. Wiring, not qubits, limits the size of today's machines.`, 'Budget / (lines × heat per line).'),
      'the wiring heat limit', 'With control electronics at room temperature, every qubit needs its own cables into the fridge, and every cable conducts some heat into the cold stage. Heat per qubit = (lines per qubit) × (heat per line). The number of qubits is the budget divided by that, rounded down.',
      calc('Heat per qubit = lines × heat per line, in mW:', `${lines} × ${heat}`, lines * heat, 'mW', sig(lines * heat, 4), 0.005),
      calc('Budget in mW ÷ heat per qubit:', `${budget * 1000} / ${sig(lines * heat, 4)}`, (budget * 1000) / (lines * heat), '', sig((budget * 1000) / (lines * heat), 6), 0.001),
      count('Round down to whole qubits:', `floor(${sig((budget * 1000) / (lines * heat), 6)})`, n));
  },
  (r, d) => {
    const fs = pick(r, [1, 2, 4]);
    const idea = 'An arbitrary waveform generator (AWG) makes a signal by playing out samples at a fixed rate fs (in gigasamples per second). By Nyquist, it can only make frequencies up to half the sample rate.';
    if (d === 1) return walk(ask(`An AWG samples at ${fs} GS/s. Highest frequency it can generate directly (Nyquist), in MHz?`, qty(fs * 500, 'MHz', 0.01, String(fs * 500)), `fs / 2 = ${fs * 500} MHz. Higher frequencies come from mixing with an LO.`, 'Half the sample rate.'),
      'the Nyquist limit', idea,
      calc('fs ÷ 2, with fs in MHz (GS/s × 1000):', `${fs} × 1000 / 2`, fs * 500, 'MHz', String(fs * 500), 0.01));
    const t = pick(r, [20, 40, 100]);
    if (d === 2) return walk(ask(`A ${t} ns pulse at ${fs} GS/s is how many samples?`, num(t * fs), `${t} × ${fs} = ${t * fs}.`, 'Duration × rate.'),
      'samples in a pulse', `${idea} A rate of 1 GS/s means 1 sample every nanosecond, so a pulse of t ns needs t × fs samples (fs in GS/s).`,
      count(`${fs} sample${fs > 1 ? 's' : ''} per ns × ${t} ns:`, `${fs} × ${t}`, t * fs));
    const q = pick(r, [100, 1000]), ch = 2, bits = 16, bw = (q * ch * fs * 1e9 * bits) / 8 / 1e9;
    return walk(ask(`${q} qubits each need 2 channels (I and Q) of ${bits}-bit samples at ${fs} GS/s. Total waveform data rate, in GB/s?`, qty(bw, 'GB/s', 0.02, sig(bw)), `${q} × 2 × ${fs}e9 × 2 bytes = ${sig(bw)} GB/s. Controllers store pulse libraries and play them by name rather than streaming raw samples.`, 'Channels × rate × bytes.'),
      'waveform data rate', `${idea} The data rate of one channel is the samples per second times the bytes per sample (16 bits = 2 bytes). Each qubit needs 2 channels (I and Q).`,
      count('Channels in total = qubits × 2:', `${q} × 2`, q * 2),
      calc('One channel: fs GS/s × 2 bytes per sample, in GB/s:', `${fs} × 2`, fs * 2, 'GB/s', String(fs * 2), 0.001),
      calc('Total = channels × that, in GB/s:', `${q * 2} × ${fs * 2}`, bw, 'GB/s', sig(bw), 0.02));
  },
  (r) => concept(r, [
    ['Why do drive lines have attenuators at several cold stages?', 'A room-temperature source sends thermal noise down the line; attenuating at cold stages replaces it with colder noise', ['To save power', 'To slow the pulses', 'Because the qubits need weak signals only'], 'attenuators in the fridge', 'A room-temperature cable carries 300 K thermal noise. An attenuator reduces the signal AND the noise by the same factor, then adds its own (colder) noise at its own temperature. Several stages step the noise down toward the coldest temperature, where the last attenuator sits.', ['The last attenuator should be at:', 'The coldest stage', ['Room temperature', 'The 4 K stage']]],
    ['Why is a quantum-limited amplifier (JPA or TWPA) placed first in the readout chain?', 'Friis: the first stage dominates the noise, and these add close to the minimum quantum noise', ['It is cheaper', 'It filters the drive', 'It cools the qubit'], 'first-stage amplifiers', 'From the Friis formula, the noise of a chain is dominated by its first stage. A readout signal is only a few photons, so any noise added before the first gain stage ruins it. Quantum-limited amplifiers add almost no noise beyond the quantum minimum.', ['The noise of an amplifier chain is dominated by:', 'The first stage', ['The last stage', 'The cables']]],
    ['Why must the error-correction decoder be fast?', 'Syndromes arrive about every microsecond; if decoding falls behind, the backlog grows without bound', ['It does not have to be', 'To save power', 'Because qubits are fast'], 'real-time decoding', 'Error correction produces a new set of parity measurements (a syndrome) about every microsecond. A classical decoder must work out the corrections from each one. If it is slower than the arrival rate, the queue grows forever, and logical operations that wait on it stall.', ['If decoding is slower than syndromes arrive, the backlog:', 'Grows without bound', ['Shrinks', 'Stays constant']]],
    ['What does DRAG pulse shaping fix?', 'Leakage into the transmon\'s third level, by adding a derivative component on the quadrature channel', ['LO leakage', 'Thermal noise', 'Readout crosstalk'], 'DRAG pulses', 'A short pulse has a wide frequency spread, and a transmon\'s 1↔2 transition is close to its 0↔1 transition, so the pulse can accidentally excite the third level (leakage). DRAG adds a derivative of the pulse on the quadrature channel, which cancels the unwanted frequencies.', ['DRAG cancels frequency content that would excite:', 'The third level (leakage)', ['The LO', 'The fridge']]],
  ], (why) => `${why}.`),
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

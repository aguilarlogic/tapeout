// Practice banks and bosses for the domain chips of Act 7: AI accelerators, hardware security, functional
// safety, silicon photonics, qubits and quantum control electronics.
import { num, qty, words } from '../lessons/answers';
import { calc, choice, count, sim, step, walk } from '../lessons/teach';
import { art, ask, mc, pick, say } from '../lessons/types';
import { boss, practice, tier } from './types';
import { AES_SBOX } from './aes';
import { atLevel, concept, exact, hex, sci, sig } from './util';

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
    // KV width = KV heads x head dimension: equal to the model width only for multi-head attention.
    const layers = pick(r, [32, 40, 80]), dm = pick(r, [1024, 4096, 5120, 8192]), tok = pick(r, [4096, 32768]), kv = (2 * layers * dm * tok * 2) / 1e9;
    const gqaIdea = 'With multi-head attention the KV width equals the model width. Grouped-query attention shares each K/V head across several query heads, so the KV width is much smaller: a 70B-class model with 8 KV heads of 128 dims stores 1024 numbers per token per layer for K, and again for V.';
    if (d === 3) {
      const mha = pick(r, [4096, 8192]), g = pick(r, [512, 1024, 2048]), ratio = mha / g;
      return walk(ask(`A model uses grouped-query attention with KV width ${g}. The same model without it (multi-head attention, KV width ${mha}) needs how many times more KV-cache memory?`, num(ratio), `The cache is proportional to the KV width: ${mha} / ${g} = ${ratio}.`, 'Cache size scales with KV width; everything else is the same.'),
        'KV width and grouped-query attention', gqaIdea,
        calc('Everything else is equal, so the ratio is the ratio of KV widths:', `${mha} / ${g}`, ratio, '', String(ratio), 0.001));
    }
    return walk(ask(`KV cache: ${layers} layers, KV width ${dm} (KV heads × head dimension), ${tok} tokens of context, FP16. Size, in GB? (2 × layers × KV width × tokens × 2 bytes)`, qty(kv, 'GB', 0.02, sig(kv)), `2 (K and V) × ${layers} × ${dm} × ${tok} × 2 bytes = ${sig(kv)} GB per sequence. Long contexts can need more memory than the weights.`, 'Keys and values, per layer, per token.'),
      'the KV cache', `While generating text, a transformer keeps the "key" and "value" vectors of every earlier token in every layer, so it does not have to recompute them: the KV cache. Per token and per layer it stores 2 vectors (K and V) of the KV width, each number in 2 bytes (FP16). So its size = 2 × layers × KV width × tokens × 2 bytes. ${gqaIdea}`,
      calc('Values stored per token = 2 (K and V) × layers × KV width:', `2 × ${layers} × ${dm}`, 2 * layers * dm, '', String(2 * layers * dm), 0.001),
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
  (r, d) => {
    // Block-scaled (microscaling) formats: element bits plus the shared scale spread over the block.
    const [el, blk, sc, name] = pick(r, [[4, 32, 8, 'MXFP4'], [4, 16, 8, 'an NVFP4-style format'], [8, 32, 8, 'an 8-bit block-scaled format'], [6, 32, 8, 'a 6-bit block-scaled format']] as const);
    const bits = el + sc / blk;
    const idea = 'Below 8 bits, one scale for a whole tensor is too coarse, so block-scaled (microscaling) formats give each small block of elements its own shared scale. The scale is stored once per block, so each element pays only its share: element bits + scale bits ÷ block size.';
    if (d === 1) return walk(ask(`${el}-bit elements share one ${sc}-bit scale per block of ${blk}. Average bits per element?`, qty(bits, '', 0.005, String(bits)), `${el} + ${sc}/${blk} = ${bits} bits per element.`, 'Element bits plus scale bits divided by the block size.'),
      'bits per element of a block-scaled format', idea,
      calc('Each element pays its share of the scale: scale bits ÷ block size =', `${sc} / ${blk}`, sc / blk, '', String(sc / blk), 0.005),
      calc('Add the element width:', `${el} + ${sc / blk}`, bits, '', String(bits), 0.005));
    const b = pick(r, [7, 13, 70]), gb = (b * bits) / 8;
    if (d === 2) return walk(ask(`Blocks of ${blk} ${el}-bit elements share an ${sc}-bit scale. How many bytes does one block occupy?`, qty((blk * el + sc) / 8, '', 0.005, String((blk * el + sc) / 8)), `${blk} × ${el} + ${sc} = ${blk * el + sc} bits = ${(blk * el + sc) / 8} bytes.`, 'Bits of all elements plus one scale, divided by 8.'),
      'storage of one scaled block', idea,
      count('Bits taken by the elements:', `${blk} × ${el}`, blk * el),
      count('Add the shared scale:', `${blk * el} + ${sc}`, blk * el + sc),
      calc('Bytes = bits ÷ 8:', `${blk * el + sc} / 8`, (blk * el + sc) / 8, '', String((blk * el + sc) / 8), 0.005));
    return walk(ask(`A ${b}B-parameter model is stored in ${name} (${el}-bit elements, ${sc}-bit scale per ${blk}). Memory for the weights, in GB?`, qty(gb, 'GB', 0.02, sig(gb)), `${b}e9 × ${bits} bits ÷ 8 = ${sig(gb)} GB. Plain FP16 would need ${b * 2} GB, so block scaling saves about ${sig((1 - bits / 16) * 100, 2)}%.`, 'Parameters × bits per element ÷ 8.'),
      'memory in a block-scaled format', idea,
      calc('Bits per element:', `${el} + ${sc}/${blk}`, bits, '', String(bits), 0.005),
      calc('Memory in GB = billions of parameters × bits ÷ 8:', `${b} × ${bits} / 8`, gb, 'GB', sig(gb), 0.02));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Why do systolic arrays beat CPUs on matrix math?', 'Each fetched operand feeds many MACs', ['They run at a higher clock', 'They have bigger caches', 'They predict branches better'], 'data reuse in a systolic array', 'Moving a number from memory costs far more energy than multiplying it. In a systolic array each value passes from one MAC to the next, so a single fetch is used in many multiplications.', ['Reuse makes the chip efficient because fetching data costs:', 'More energy than the arithmetic', ['Less energy than the arithmetic', 'Nothing']], 'Data reuse: each operand fetched from memory feeds many MACs as it flows through the array.'],
    ['What does "weight stationary" mean in a dataflow?', 'Weights stay in the PEs; activations stream past', ['Weights never change at all during training', 'Weights are stored in flash next to the array', 'Activations stay fixed while weights stream past'], 'dataflows', 'A dataflow decides which operand stays put in each processing element (PE). Weight stationary loads the weights once and keeps them there, streaming the activations through, so the weights need no further memory traffic. Which operand to keep depends on the shape of the layer.', ['Weight stationary keeps which operand in place?', 'The weights', ['The activations', 'The outputs']], 'The weights are loaded once, so they need no further memory traffic.'],
    ['Why train in BF16 rather than FP16?', 'It keeps FP32\'s exponent range', ['BF16 has more mantissa bits, so it is more precise', 'FP16 values cannot be multiplied in a tensor core', 'BF16 is the IEEE standard'], 'BF16 versus FP16', 'A floating-point number has an exponent (its range) and a mantissa (its precision). FP16 has only 5 exponent bits, so very large or small gradients overflow or vanish. BF16 has 8 exponent bits like FP32, so the range matches, and only precision is lost.', ['More exponent bits give a number format more:', 'Range', ['Precision', 'Zeros']], 'So gradients rarely overflow or underflow, at half the bits of FP32.'],
    ['What does 2:4 structured sparsity give hardware?', 'A fixed zero pattern it can skip cheaply', ['Random zeros anywhere in the weight matrix', 'Smaller activations stored in half the memory', 'Fewer layers, so the network finishes sooner'], 'structured sparsity', 'Skipping multiplications by zero saves work, but finding random zeros is expensive. A fixed pattern (2 of every 4 are zero) is easy for hardware to index, so it can skip half the multiplications cheaply (up to 2×, since real speed-ups depend on the rest of the pipeline).', ['A fixed sparsity pattern is easier for hardware than random zeros because it is:', 'Easy to index', ['More random', 'Bigger in memory']], 'Two of every four weights are zero, so the hardware can skip half the multiplications for up to 2× throughput.'],
  ]),
    ...atLevel(1, [['What does a MAC unit compute?', 'A multiply, then an add into a sum', ['A comparison of two wide bit vectors bit by bit', 'A division and a remainder', 'A shift of a value by one bit'], 'MAC units', 'A multiply-accumulate unit multiplies two numbers and adds the product to a running sum. Neural network layers are mostly long chains of these operations.', ['A MAC unit adds its product to:', 'A running sum', ['A new register each time']]]]),
    ...atLevel(2, [['What does quantizing a network to INT8 trade?', 'Some accuracy for smaller, faster arithmetic', ['Speed for more memory', 'Power for more accuracy', 'Accuracy for a lot more memory and clock cycles'], 'INT8 quantization', 'Eight-bit integers need less memory and cheaper arithmetic than floating point. The rounding costs a little accuracy, which is usually small after calibration or retraining.', ['INT8 arithmetic is cheaper than FP32 mainly because:', 'The operands are smaller', ['The clock is faster', 'It skips the adder']]]]),
    ...atLevel(3, [['Why is on-chip data reuse important for an NPU?', 'Off-chip bandwidth is the usual bottleneck', ['On-chip memory is always slower than off-chip DRAM access', 'It removes the need for any clock', 'It makes every MAC run in one cycle'], 'data reuse', 'A MAC array can compute faster than off-chip memory can feed it. Keeping weights or activations in on-chip SRAM and reusing them many times is what keeps the array busy.', ['Reusing data on chip mainly saves:', 'Off-chip bandwidth', ['Clock cycles only']]]]),
    ...atLevel(3, [
      ['Which format has the largest range at 16 bits?', 'BF16: it keeps the 8 exponent bits of FP32', ['FP16: 10 fraction bits give it more range', 'INT16: it has no exponent to overflow', 'Q1.15 fixed point: its steps are the finest'],
        'range versus precision', 'In a floating-point format the exponent bits set the range and the fraction bits set the precision. BF16 keeps the 8 exponent bits of FP32 and gives up fraction bits (7); FP16 has 5 exponent bits, so its largest value is only 65,504.',
        ['More exponent bits give a format more:', 'Range', ['Precision', 'Sign bits']], 'BF16: it keeps the 8 exponent bits of FP32, so it has the range, at the cost of precision'],
      ['FP8 E4M3 or E5M2 for the activations of a forward pass?', 'E4M3: the extra fraction bit buys precision', ['E5M2: the extra exponent bit is what activations need', 'Either, as the two formats are identical in range', 'Neither: activations need at least 16 bits'],
        'choosing an FP8 format', 'E4M3 has 4 exponent and 3 fraction bits (largest value 448, no infinities); E5M2 has 5 and 2 (largest 57,344, keeps infinities). Activations sit in a narrow range, so precision matters more. Gradients span many orders of magnitude, so E5M2 is used for them.',
        ['Gradients are usually kept in E5M2 because they need more:', 'Range', ['Precision', 'Sign bits']], 'E4M3: the extra fraction bit gives precision, and activations do not need E5M2\'s range'],
    ]),
  ], (why) => `${why}.`, d),
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
    { t: 'gen', make: () => ask('Weights in a block-scaled 4-bit format (MXFP4: 32 elements share an 8-bit scale), in GB?', qty((70 * 4.25) / 8, 'GB', 0.02, sig((70 * 4.25) / 8)), `4 + 8/32 = 4.25 bits per element; 70e9 × 4.25 / 8 = ${sig((70 * 4.25) / 8)} GB. Half of INT8's footprint, at some accuracy risk.`) },
    mc('Which FP8 format is the usual choice for the gradients in training?', ['E4M3, for its extra fraction bit', 'E5M2, for its larger range', 'Neither: gradients must stay FP32', 'Both, since they have equal range'], 1, 'Gradients span many orders of magnitude, so range matters more than precision: E5M2 (largest value 57,344, keeps infinities). E4M3 (largest value 448) suits activations and weights.'),
    { t: 'gen', make: () => { const kv = (2 * 80 * 1024 * 4096 * 1) / 1e9; return ask('KV cache: 80 layers, KV width 1024 (grouped-query attention), 4096 tokens, INT8 (1 byte). Size per user, in GB?', qty(kv, 'GB', 0.02, sig(kv)), `2 × 80 × 1024 × 4096 × 1 = ${sig(kv)} GB. Only ${Math.floor(10 / kv)} user${Math.floor(10 / kv) === 1 ? '' : 's'} fit in the remaining 10 GB.`); } },
    { t: 'gen', make: () => ask('Decode intensity at batch 1 is about 2 FLOP per byte of weights. Ridge point of this chip, in FLOP/byte?', qty(1000 / 3.35, '', 0.02, sig(1000 / 3.35)), `1000 / 3.35 = ${sig(1000 / 3.35)}. At 2 FLOP/byte, decode uses under 1% of peak compute.`) },
    mc('To serve many users at 30 tokens/s each, what matters most?', ['More HBM bandwidth and capacity, and a smaller KV cache', 'More TFLOP/s of matrix compute per card', 'A higher clock on the tensor cores', 'Bigger on-chip SRAM caches while keeping the same HBM stack'], 0, 'Add HBM or split the model across cards. Grouped-query attention is already applied here, so the next levers on the cache are KV quantization, paging and a shorter context. LLM decode is memory-bound in both bandwidth and capacity. Compute is not the bottleneck.'),
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
    const [bits, rate] = pick(r, [[40, 1e9], [56, 1e12], [64, 1e12], [32, 1e9], [48, 1e12], [80, 1e12]] as const), s = 2 ** bits / rate, hrs = s / 3600;
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
    const sb = AES_SBOX[v ^ w];
    return walk(ask(`A power-analysis attack predicts the Hamming weight of the first S-box output, Sbox(data ⊕ key). The data byte is ${hex(v)} and your key guess is ${hex(w)}. Sbox(${hex(v ^ w)}) = ${hex(sb)}. What Hamming weight does your model predict?`, num(popcount(sb)), `${hex(v)} ⊕ ${hex(w)} = ${hex(v ^ w)}; the S-box maps that to ${hex(sb)}, which has ${popcount(sb)} ones. Attacks target the S-box output, not the XOR. XOR is linear, so a key guess and its bitwise complement produce perfectly anti-correlated predictions and cannot be told apart. The S-box's non-linearity makes only the right guess correlate.`, 'XOR, look up the S-box value given, then count its ones.'),
      'a power-analysis prediction', `${idea} In a DPA attack, you guess a key byte, predict the Hamming weight of the first S-box output, Sbox(data ⊕ key), and check whether the real power traces rise and fall with your predictions. Attacks target the S-box output, not the XOR. XOR is linear, so a key guess and its bitwise complement produce perfectly anti-correlated predictions and cannot be told apart. The S-box's non-linearity makes only the right guess correlate.`,
      step(`${hex(v)} in binary:`, exact(b8(v))),
      step(`Your guess ${hex(w)} in binary:`, exact(b8(w))),
      step('data XOR guess:', exact(b8(v ^ w))),
      step(`Look up the S-box (it gives ${hex(sb)}); in binary:`, exact(b8(sb))),
      count('The predicted Hamming weight of the S-box output (number of 1s):', 'number of ones', popcount(sb)));
  },
  (r, d) => {
    const n = pick(r, [1000, 5000, 20000]), k = tier(d, 2, pick(r, [4, 10]), pick(r, [10, 30])), need = n * k * k;
    return walk(ask(`A DPA attack needs ${n} traces. A countermeasure cuts the leaking signal by ${k}× (noise unchanged). About how many traces does the attack need now?`, qty(need, '', 0.02, String(need)), `Traces needed scale as 1/ρ² (ρ is the correlation): a k× weaker signal needs k² times the traces. ${n} × ${k}² = ${need.toLocaleString('en-US')}. Hiding (noise, shuffling, balanced logic) slows an attack quadratically; it rarely makes one impossible.`, 'Signal down k× → traces up k²×.'),
      'how countermeasures scale DPA', 'Noise can be averaged away by using more traces. What an attacker measures is the correlation ρ between the predicted weight and the power, and ρ scales with the size of the leaking signal. The traces needed grow as 1/ρ², so a countermeasure that makes the signal k times weaker needs k² times as many traces to make up for it.',
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
  (r, d) => {
    // Grover: a quadratic speed-up halves the exponent of the key space. The steps run in series, so it stays impractical.
    const idea = 'Grover\'s algorithm searches N possibilities in about √N steps instead of N. A key of k bits has 2^k possibilities, so the search needs about √(2^k) = 2^(k/2) steps: the exponent is halved. Those steps must run one after another, which keeps it impractical, but long-term guidance still asks for AES-256.';
    if (d < 3) {
      const k = d === 1 ? 128 : pick(r, [192, 256]);
      return walk(ask(`Grover's search is quadratically faster. In theory, about how many steps recover an AES-${k} key, as a power of 2? (give the exponent)`, num(k / 2), `√(2^${k}) = 2^${k / 2}. The serial depth makes it impractical, but guidance prefers AES-256 anyway.`, 'Halve the exponent.'),
        'Grover on a symmetric key', idea,
        choice('A quadratic speed-up takes the square root of the search space. The exponent of 2 is then:', 'Halved', ['Doubled', 'Unchanged']),
        count(`Exponent for a ${k}-bit key:`, `${k} / 2`, k / 2));
    }
    const x = pick(r, [32, 40, 48, 56, 64, 72, 80, 96, 112, 128]);
    return walk(ask(`A key search by Grover's algorithm needs about 2^${x} serial steps. How many bits long is the key?`, num(2 * x), `2^${x} = √(2^${2 * x}), so the key has ${2 * x} bits.`, 'Double the exponent.'),
      'working Grover backwards', idea,
      count(`The steps are the square root of the key space, so the key space is the square of 2^${x}: exponent`, `${x} × 2`, 2 * x));
  },
  (r, d) => {
    // Welch's t for a fixed-versus-random leakage test, with equal counts and variances in the first two levels.
    const idea = 'To test a design for leakage, collect traces for one fixed input and for random inputs and compare them at each time point with Welch\'s t: t = (mean_fixed - mean_random) / √(var_fixed/n_fixed + var_random/n_random). If |t| is above 4.5 the point leaks, but the result is only believed when the same point exceeds 4.5 with the same sign in two independent trace sets.';
    if (d === 3) {
      const t1 = pick(r, [5.1, 6.4, 9.8, 12.3]), kind = pick(r, ['same', 'low', 'flip']);
      const t2 = kind === 'same' ? pick(r, [5.6, 7.2, 10.4]) : kind === 'low' ? pick(r, [1.2, 2.8, 3.9]) : -pick(r, [5.3, 6.9, 8.8]);
      const ok = kind === 'same';
      return walk(ask(`At one time point, the first trace set gives t = +${t1} and a second, independent set gives t = ${t2 > 0 ? '+' : '−'}${Math.abs(t2)}. Is leakage confirmed there? (yes or no)`, words(ok ? 'yes' : 'no'), `${ok ? 'Both exceed 4.5 with the same sign: confirmed.' : kind === 'low' ? 'The second set stays below 4.5, so the first was probably noise.' : 'The signs differ, so it is not a repeatable leak.'} One set alone is not enough: with thousands of points, a few cross the line by chance.`, 'Both sets must exceed 4.5, with the same sign.'),
        'confirming a leakage result', idea,
        choice('How many independent trace sets must agree?', 'Two', ['One', 'Three']),
        step('Does the second set exceed 4.5 in the same direction as the first? (yes or no)', words(ok ? 'yes' : 'no')));
    }
    const n = pick(r, [1000, 5000, 20000, 50000]), v = pick(r, [1, 4, 9]);
    let dm = pick(r, [0.02, 0.05, 0.1, 0.2, 0.5]), t = dm / Math.sqrt((2 * v) / n);
    // keep clear of the threshold so a rounded answer still decides the same way
    while (Math.abs(t - 4.5) < 0.6) { dm *= 2; t = dm / Math.sqrt((2 * v) / n); }
    const se = Math.sqrt((2 * v) / n);
    if (d === 1) return walk(ask(`Fixed-versus-random test at one point: the means differ by ${dm}, both variances are ${v} and each set has ${n} traces. What is Welch's t?`, qty(t, '', 0.03, sig(t)), `t = ${dm} / √(${v}/${n} + ${v}/${n}) = ${dm} / ${sig(se)} = ${sig(t)}.`, 'Difference of the means over √(var/n + var/n).'),
      "Welch's t-test", idea,
      calc('The denominator, √(var/n + var/n):', `sqrt(${v} / ${n} + ${v} / ${n})`, se, '', sig(se, 4), 0.01),
      calc('t = difference ÷ denominator:', `${dm} / ${sig(se, 4)}`, t, '', sig(t), 0.03));
    return walk(ask(`Fixed-versus-random test at one point: the means differ by ${dm}, both variances are ${v} and each set has ${n} traces. Is |t| above 4.5? (yes or no)`, words(Math.abs(t) > 4.5 ? 'yes' : 'no'), `t = ${dm} / ${sig(se)} = ${sig(t)}, which is ${t > 4.5 ? 'above' : 'below'} 4.5. A real assessment repeats it on a second, independent set before believing the result.`, 'Compute t, then compare with 4.5.'),
      "Welch's t-test and the threshold", idea,
      calc('The denominator, √(var/n + var/n):', `sqrt(${v} / ${n} + ${v} / ${n})`, se, '', sig(se, 4), 0.01),
      calc('t = difference ÷ denominator:', `${dm} / ${sig(se, 4)}`, t, '', sig(t), 0.03),
      step('Is |t| above 4.5? (yes or no)', words(Math.abs(t) > 4.5 ? 'yes' : 'no')));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['What is a hardware root of trust?', 'An unchangeable first stage that checks the first code', ['The first transistor powered up on the die', 'The OS kernel and its signed drivers', 'A password manager stored in on-chip flash'], 'the root of trust', 'Security starts from something that cannot be changed: a small first stage with code in ROM and keys in fuses. It checks the first piece of software before it runs, which then checks the next, forming a chain. That first stage is immutable; later root-of-trust firmware is measured or verified by it and can be updated.', ['The root of trust can be trusted because its first stage:', 'Cannot be modified', ['Is the largest block', 'Runs the fastest']], 'It is small and isolated, its first stage (boot ROM, fused keys, crypto) is immutable, and the code it verifies then verifies the next stage.'],
    ['How did Spectre leak secrets?', 'Cancelled speculative work left timeable cache traces', ['It printed protected memory through a debug port', 'It broke AES by solving its key schedule directly from output', 'It glitched the supply voltage to skip a check'], 'speculative execution attacks', 'A CPU guesses ahead and runs instructions speculatively; if the guess was wrong, it undoes their architectural effects. But the cache still holds data those instructions touched, and an attacker can time memory accesses to learn what was touched.', ['A cancelled speculative instruction can still leave a trace in:', 'The cache', ['The registers', 'The program counter']]],
    ['What is a PUF?', 'A circuit deriving a unique key at power-up', ['A cheap cipher for low-power devices', 'A fuse bank programmed with a key', 'A random number generated in software at every boot'], 'physically unclonable functions', 'No two chips are exactly alike at the atomic scale. A PUF measures those tiny random differences (for example which of two identical circuits is faster) and turns them into a key that is unique to the chip. The key is re-derived at every power-up from the chip\'s physical randomness, using stored helper data that is not secret. No key is stored, so there is none to steal.', ['A PUF key comes from:', 'Random manufacturing variation', ['A key programmed into fuses at test', 'Software']], 'It turns random manufacturing variation into a device-unique key, re-derived each time.'],
    ['Why do secure chips run crypto in constant time?', 'So timing never depends on secret data', ['To save power during long crypto runs', 'To make the clock tree simpler to build', 'Because constant-time code is always faster'], 'constant-time code', 'If the time taken (or which memory gets touched) depends on a secret, anyone who measures it learns something about the secret. Constant-time code does the same work in the same time whatever the secret is.', ['If timing never depends on the secret, timing reveals:', 'Nothing about the secret', ['The whole secret', 'The secret, one bit at a time']], 'This closes timing side channels.'],
    ['What does a secure boot chain check at each stage?', 'The next image\'s signature', ['The image\'s file size', 'The CPU die temperature', 'That the image is compressed'], 'secure boot', 'Before running the next piece of code, each stage verifies its digital signature, using a public key that traces back to the root of trust. A valid signature proves the code came from the key holder and has not been altered.', ['A digital signature proves the image:', 'Is authentic and unmodified', ['Is encrypted so nobody can read it', 'Is compressed']], 'A valid signature proves the image came from the key holder and was not modified, using a key anchored in the root of trust.'],
  ]),
    ...atLevel(1, [['What does a TPM or secure element do?', 'Stores keys and runs crypto in isolation', ['Speeds up the processor by caching code in a fast tier', 'Holds the operating system kernel', 'Stores the user\'s video files'], 'secure elements', 'A TPM or secure element holds keys and performs cryptographic operations inside its own boundary. Software outside can ask for a signature, but cannot read the key.', ['Keys in a secure element can be read by:', 'Nothing outside it', ['Any application', 'The user']]]]),
    ...atLevel(3, [['What does a side-channel attack use?', 'Timing, power, or radiated emissions', ['A flaw in the encryption math alone', 'Stolen passwords from a phishing email', 'A bug in the operating system only'], 'side channels', 'A side-channel attack measures something the device leaks while it computes: how long an operation takes, how much power it draws, or what it radiates. The secret is recovered from the physical behaviour, not from a broken formula.', ['A timing attack measures:', 'How long an operation takes', ['The cipher name', 'The key size']]],
    ...atLevel(3, [
    ['Which post-quantum algorithm replaces ECDH key exchange?', 'ML-KEM', ['ML-DSA', 'SLH-DSA', 'AES-256'],
      'post-quantum replacements', 'Shor\'s algorithm breaks RSA and elliptic-curve cryptography, so key exchange and signatures need new schemes. ML-KEM is the key-exchange one; ML-DSA and SLH-DSA are the signature ones. Symmetric ciphers survive with longer keys.',
      ['A signature scheme proves who sent something. A key-exchange scheme:', 'Agrees a shared secret', ['Hashes a message', 'Encrypts bulk data']], 'ML-KEM is the key-encapsulation scheme that replaces elliptic-curve key exchange; ML-DSA and SLH-DSA replace signatures'],
    ['Why must long-lived secrets move to post-quantum cryptography already?', 'Recorded data can be decrypted later', ['Quantum computers already break AES-256', 'Post-quantum schemes are always faster', 'Live connections are the only target'],
      'harvest now, decrypt later', 'An attacker can record encrypted traffic today and wait. Once a large quantum computer exists, the recording gives up its secrets, so data that must stay secret for decades needs protection from the start.',
      ['An attacker who records traffic today and decrypts it years later is:', 'Harvesting now and decrypting later', ['Using a side channel', 'Glitching the clock']], '"Harvest now, decrypt later": recorded traffic can be decrypted once a quantum computer exists, so long-lived data needs post-quantum protection today'],
    ['A device derives its identity from the previous layer\'s secret plus a hash of the next layer\'s code. What happens when the firmware is modified?', 'The derived identity changes', ['The identity stays the same', 'The chip erases its fuses', 'The boot ROM rewrites the firmware'],
      'layered device identity', 'Each layer\'s secret depends on the hash of the code that follows it. Different code gives a different hash, so a different secret: modified firmware can not pose as the original.',
      ['Modified code has a different hash, so its derived secret is:', 'Different', ['The same', 'Zero']], 'The hash of the changed code goes into the derivation, so the identity is different and the original can not be impersonated'],
    ['An attacker glitches the clock during the signature check. Best countermeasure?', 'Redundant checks, plus glitch detectors', ['Use a longer signature that takes longer to check', 'Hide the boot ROM contents from outside readers', 'Raise the clock so a glitch has no time to act'],
      'fault-injection countermeasures', 'A single check is a single point of failure. Doing it twice and comparing in a redundant way, with sensors that notice glitches and reset the chip, forces the attacker to land several unlikely glitches at once.',
      ['A glitch skips one instruction. Computing the check twice means the attacker must:', 'Skip both, in the same way', ['Skip only one', 'Skip neither']], 'Redundant checks plus glitch detectors, so one glitch is not enough'],
    ]),
      ['First-order masking splits each secret into two random shares. What does an attack now need?', 'A second-order attack on two points per trace', ['The same attack, with about twice the traces', 'Nothing extra: masking only hides the timing', 'A new key schedule, since shares replace the key'],
        'masking', 'Masking does not weaken the leak, it changes what leaks: each share alone is random, so a single point of the trace is independent of the secret. Only the combination of both shares depends on it, so the attacker must combine two points per trace (a second-order attack).',
        ['With one share alone, a single trace point is:', 'Independent of the secret', ['Equal to the secret itself', 'Always zero, in every trace']], 'A second-order attack combining two points per trace is needed, and it needs far more traces (growing roughly exponentially with the masking order in noisy devices)'],
      ['Why do CPA attacks on AES model the S-box output, not data ⊕ key?', 'XOR is linear: the key\'s complement fits as well', ['The S-box output is computed first, so leaks most', 'The XOR step draws no current, so never shows up', 'The S-box output has fewer bits, so ranks faster'],
        'power-analysis models', 'The model must separate the right key guess from the wrong ones. XOR with a key guess and with its complement give outputs that are bit-for-bit opposite, so their Hamming weights are perfectly anti-correlated and the two guesses look equally good. The S-box is non-linear, so only the right guess lines up with the real power.',
        ['A key guess and its bitwise complement give XOR results that are:', 'Bitwise opposites', ['Identical in every bit', 'Unrelated to each other']], 'XOR is linear, so wrong guesses (such as the key\'s complement) correlate as strongly as the right one; the S-box\'s non-linearity breaks that tie']]),
  ], (why) => `${why}.`, d),
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
    mc('Best hardening for the boot branch?', ['Redundant checks, random delays and glitch detectors', 'A longer key for the boot signature', 'Obfuscating the boot ROM code', 'Encrypting the boot ROM so attackers cannot read the branch'], 0, 'Use complementary encodings for the redundant checks, glitch detectors that reset the chip, and fail closed. One branch is one point of failure; make the attacker win several unlikely coin flips at once.'),
    { t: 'gen', make: () => ask('A DPA attack needs 2000 traces. Noise injection cuts the leaking signal to 1/20 of its amplitude (noise unchanged). Traces needed now?', qty(800000, '', 0.02, '800000'), 'The number of traces grows with 1/ρ², where ρ is the correlation, and ρ scales with signal amplitude: 2000 × 20² = 800,000. Hiding (noise, shuffling, balanced logic) slows an attack quadratically.') },
    { t: 'gen', make: () => { const h = 2 ** 64 / 1e12 / 3600; return ask('Brute force of the 64-bit key at 10¹² keys/s, worst case, in hours?', qty(h, 'h', 0.03, sig(h)), `2⁶⁴ / 1e12 = ${sig(2 ** 64 / 1e12)} s = ${sig(h)} h. Use 128-bit keys.`); } },
    mc('Which post-quantum algorithm replaces the ECDH key exchange in the next generation of the lock?', ['ML-KEM', 'ML-DSA', 'SLH-DSA', 'AES-256'], 0, 'ML-KEM does key exchange. ML-DSA and SLH-DSA are signatures (they would protect the firmware image), and AES-256 is a symmetric cipher that stays.'),
    { t: 'gen', make: () => ask('Grover\'s search is quadratically faster. In theory, about how many steps recover a 128-bit AES key, as a power of 2?', num(64), '√(2¹²⁸) = 2⁶⁴. The steps must run in series, so it is impractical, but guidance asks for AES-256 anyway.') },
    { t: 'gen', make: () => { const t = 0.1 / Math.sqrt((2 * 4) / 20000); return ask('Leakage test of the crypto engine: fixed-versus-random means differ by 0.1, both variances are 4 and each set has 20000 traces. Welch\'s t?', qty(t, '', 0.03, sig(t)), `t = 0.1 / √(4/20000 + 4/20000) = 0.1 / ${sig(Math.sqrt(8 / 20000))} = ${sig(t)}. Above 4.5, so the point leaks, once a second independent set agrees.`); } },
  ],
  recap: ['Timing leaks.', 'Fault-injection odds.', 'DPA scaling.', 'Key lengths.', 'Post-quantum schemes and Grover.', 'Leakage testing.'],
});

// ------------------------------------------------------------------ functional safety

export const fusaPractice = practice('practice-fusa', 'Functional Safety Drills', 'FIT rates, MTTF, ECC bits, SPFM and PMHF', [
  (r, d) => {
    const fit = pick(r, [10, 50, 100]);
    const idea = 'FIT is the unit of failure rate: one FIT is one failure per 10⁹ device-hours. So the expected number of failures = FIT × (total device-hours) ÷ 10⁹. The mean time to failure (MTTF) of a single device is the reverse: 10⁹ ÷ FIT hours (constant failure rate assumed).';
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
    const k = pick(r, tier(d, [8, 16, 32, 64, 128], [8, 16, 32, 64, 128], [4, 8, 11, 16, 26, 32, 64, 128]));
    let rr = 1;
    while (2 ** rr < k + rr + 1) rr++;
    const idea = 'A Hamming code adds r check bits to k data bits so that one flipped bit can be located and fixed. The r check bits must be able to say which of the k + r bit positions is wrong, or that none is: 2^r ≥ k + r + 1. SECDED adds one more overall parity bit, so a double-bit error is detected too (but not corrected).';
    const table = sim(Array.from({ length: rr }, (_, i) => { const ok = 2 ** (i + 1) >= k + i + 2; return { beats: [choice(`Try r = ${i + 1}: 2^${i + 1} = ${2 ** (i + 1)} against k + r + 1 = ${k} + ${i + 1} + 1 = ${k + i + 2}. Enough check bits?`, ok ? 'Yes: 2^r is at least k + r + 1' : 'No: too small', [ok ? 'No: too small' : 'Yes: 2^r is at least k + r + 1'])], row: `r = ${i + 1}: 2^${i + 1} = ${2 ** (i + 1)}  vs  k + r + 1 = ${k + i + 2}  ${ok ? '✓ enough' : '✗ too small'}` }; }), 3, `try r = 1, 2, 3… for k = ${k}`);
    if (d === 1) return walk(ask(`How many check bits does a Hamming single-error-correcting (SEC) code need for ${k} data bits?`, num(rr), `Smallest r with 2^r ≥ k + r + 1: r = ${rr}.`, '2^r must name every bit position plus "no error".'),
      'Hamming check bits', idea, ...table,
      count('The smallest r that is enough:', 'first ✓', rr));
    if (d === 2) return walk(ask(`How many check bits does SECDED (single-correct, double-detect) need for ${k} data bits?`, num(rr + 1), `SEC needs ${rr}; one overall parity bit adds double detection: ${rr + 1}.`, 'SEC plus one parity bit.'),
      'SECDED check bits', idea, ...table,
      count('SEC needs this many check bits (first ✓):', 'first ✓', rr),
      count('SECDED adds one overall parity bit:', `${rr} + 1`, rr + 1));
    return walk(ask(`SECDED on ${k}-bit words. Storage overhead, in %?`, qty(((rr + 1) / k) * 100, '%', 0.02, sig(((rr + 1) / k) * 100)), `${rr + 1} / ${k} = ${sig(((rr + 1) / k) * 100)}%. Wider words amortize the check bits better.`, 'Check bits / data bits.'),
      'ECC storage overhead', idea, ...table,
      count('SECDED check bits = SEC bits + 1:', `${rr} + 1`, rr + 1),
      calc('Overhead = check bits ÷ data bits, as a %:', `${rr + 1} / ${k} × 100`, ((rr + 1) / k) * 100, '%', sig(((rr + 1) / k) * 100), 0.02));
  },
  (r, d) => {
    const safe = pick(r, [0.3, 0.4, 0.5, 0.2, 0.6, 0.25]);
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
    const dc = pick(r, [0.9, 0.95, 0.99, 0.6, 0.8, 0.5]), total = parts.reduce((a, [, f]) => a + f, 0), res = total * (1 - dc);
    return walk(ask(`Raw dangerous FIT: ${parts.map(([n, f]) => `${n} ${f}`).join(', ')}. Every part has ${dc * 100}% diagnostic coverage. Residual FIT (PMHF contribution)?`, qty(res, '', 0.02, sig(res)), `(${parts.map(([, f]) => f).join(' + ')}) × ${sig(1 - dc)} = ${sig(res)} FIT. ASIL D allows under 10 FIT for the whole item, shared by every block and chip in it, so one chip gets only a share${res >= 10 ? '; this total alone uses the whole item budget' : ''}.`, 'Sum × (1 - coverage).'),
      'residual FIT (PMHF)', 'The probabilistic metric for random hardware failures (PMHF) is roughly the sum of the single-point and residual FIT plus a small latent dual-point contribution. Here we add up the failure rate (in FIT) of all the dangerous faults that are NOT caught by a safety mechanism. For each block the undetected part is FIT × (1 - coverage). When all blocks have the same coverage, add the raw FITs first and multiply once.',
      calc('Total raw dangerous FIT = the sum:', parts.map(([, f]) => f).join(' + '), total, '', String(total), 0.001),
      calc('The undetected fraction, 1 - coverage:', `1 - ${dc}`, 1 - dc, '', sig(1 - dc, 4), 0.002),
      calc('Residual FIT = total × undetected fraction:', `${total} × ${sig(1 - dc, 4)}`, res, '', sig(res), 0.02));
  },
  (r, d) => {
    const idea = 'Each hazardous event is rated on three scales: severity S (0 to 3), exposure E (0 to 4) and controllability C (0 to 3). If any of them is class 0 the event is QM and needs no safety goal. Otherwise add the three class numbers: 10 is ASIL D, 9 is C, 8 is B, 7 is A, and 6 or less is QM.';
    let sec: number[];
    if (d === 1) sec = pick(r, [[3, 4, 3], [1, 1, 1], [3, 4, 1], [1, 4, 3], [3, 1, 1], [2, 2, 2]]);
    else if (d === 2) sec = [pick(r, [1, 2, 3]), pick(r, [1, 2, 3, 4]), pick(r, [1, 2, 3])];
    else { sec = [pick(r, [1, 2, 3]), pick(r, [1, 2, 3, 4]), pick(r, [1, 2, 3])]; sec[pick(r, [0, 1, 2])] = 0; }
    const [s, e, c] = sec, t = s + e + c, zero = sec.includes(0);
    const a = zero ? 'QM' : t >= 10 ? 'D' : t === 9 ? 'C' : t === 8 ? 'B' : t === 7 ? 'A' : 'QM';
    return walk(ask(`A hazardous event is rated severity S${s}, exposure E${e}, controllability C${c}. Which ASIL is it? (A, B, C, D or QM)`, words(a, `ASIL ${a}`), zero ? `A class 0 makes it QM, whatever the other two say (the sum would have been ${t}).` : `${s} + ${e} + ${c} = ${t}, so ${a === 'QM' ? 'QM' : `ASIL ${a}`}.`, 'Add the class numbers, unless one is 0.'),
      'looking up an ASIL', idea,
      ...(zero ? [choice('A class 0 anywhere means the event is:', 'QM', ['ASIL A', 'ASIL D'])] : [count('S + E + C:', `${s} + ${e} + ${c}`, t)]),
      step('Which ASIL is that? (A, B, C, D or QM)', words(a, `ASIL ${a}`)));
  },
  (r, d) => {
    const idea = 'A fault can cause harm if it lasts longer than the fault-tolerant time interval (FTTI) of the safety goal. The system has to detect the fault and then reach the safe state inside that interval, so detection time plus reaction time must fit. The margin is what is left over.';
    // The FTTI always leaves some margin, so the d1 answer is never negative.
    const rea = pick(r, [3, 5, 6, 10]), det = pick(r, [2, 4, 5, 8]), ftti = Math.max(pick(r, [15, 20, 30, 50]), det + rea + 2);
    if (d === 1) return walk(ask(`The FTTI is ${ftti} ms. A fault is detected in ${det} ms and the reaction takes ${rea} ms. How many ms of margin are left?`, qty(ftti - det - rea, 'ms', 0.001, String(ftti - det - rea)), `${ftti} - ${det} - ${rea} = ${ftti - det - rea} ms.`, 'FTTI minus detection minus reaction.'),
      'the FTTI budget', idea,
      calc('Time used = detection + reaction, in ms:', `${det} + ${rea}`, det + rea, 'ms', String(det + rea), 0.001),
      calc('Margin = FTTI - time used, in ms:', `${ftti} - ${det + rea}`, ftti - det - rea, 'ms', String(ftti - det - rea), 0.001));
    const per = pick(r, [1, 2, 3]);
    if (d === 2) return walk(ask(`The FTTI is ${ftti + 5} ms. The self-test runs every ${per} ms (a fault can wait that long for the next run), evaluating takes ${det} ms and the reaction takes ${rea} ms. Margin, in ms?`, qty(ftti + 5 - per - det - rea, 'ms', 0.001, String(ftti + 5 - per - det - rea)), `${ftti + 5} - ${per} - ${det} - ${rea} = ${ftti + 5 - per - det - rea} ms. The test interval counts as detection time.`, 'Wait for the test + evaluate + react.'),
      'the FTTI budget with a test interval', `${idea} If detection is a periodic test, a fault may appear just after a run and wait a whole interval before the next one.`,
      calc('Detection time = wait + evaluation, in ms:', `${per} + ${det}`, per + det, 'ms', String(per + det), 0.001),
      calc('Margin = FTTI - detection - reaction, in ms:', `${ftti + 5} - ${per + det} - ${rea}`, ftti + 5 - per - det - rea, 'ms', String(ftti + 5 - per - det - rea), 0.001));
    const f2 = pick(r, [20, 30, 40, 50]), det2 = pick(r, [2, 4, 6]), allowed = 0.8 * f2 - det2;
    return walk(ask(`Design rule: detection plus reaction may use at most 80% of the ${f2} ms FTTI. Detection takes ${det2} ms. What is the longest reaction time allowed, in ms?`, qty(allowed, 'ms', 0.01, sig(allowed)), `0.8 × ${f2} = ${sig(0.8 * f2)} ms in all; minus ${det2} ms for detection leaves ${sig(allowed)} ms.`, 'Take 80% of the FTTI, then subtract the detection time.'),
      'the reaction time that fits', idea,
      calc('The time budget, 80% of the FTTI, in ms:', `0.8 × ${f2}`, 0.8 * f2, 'ms', sig(0.8 * f2, 4), 0.005),
      calc('Reaction allowed = budget - detection, in ms:', `${sig(0.8 * f2, 4)} - ${det2}`, allowed, 'ms', sig(allowed), 0.01));
  },
  (r, d) => {
    const T = { B: [90, 60, 100], C: [97, 80, 100], D: [99, 90, 10] } as const;
    const idea = 'Hardware metrics have targets for each ASIL. Single-point fault metric (SPFM): 90% for B, 97% for C, 99% for D. Latent fault metric (LFM): 60%, 80%, 90%. Random-failure budget (PMHF): under 100, 100 and 10 FIT. A design reaches an ASIL only if it meets every target of that level. For ASIL B they are recommended; for C and D they are required.';
    if (d === 1) {
      const lv = pick(r, ['B', 'C', 'D'] as const), m = pick(r, [['SPFM', 0], ['LFM', 1]] as const);
      return walk(ask(`What minimum ${m[0]} does ASIL ${lv} aim for, in %?`, qty(T[lv][m[1]], '%', 0.001, String(T[lv][m[1]])), `${m[0]} for ASIL ${lv}: ${T[lv][m[1]]}%.`, 'B, C, D: SPFM 90, 97, 99; LFM 60, 80, 90.'),
        'the metric targets', idea,
        choice(`${m[0]} targets rise with the level:`, 'Yes: D is the strictest', ['No: they are the same for B, C and D', 'No: D is the most relaxed']),
        step(`The ${m[0]} target for ASIL ${lv}, in %:`, qty(T[lv][m[1]], '%', 0.001, String(T[lv][m[1]]))));
    }
    const spfm = pick(r, [88, 91, 96, 97.5, 98.5, 99.4]), lfm = pick(r, [55, 62, 78, 85, 92]), pm = d === 3 ? pick(r, [8, 40, 150]) : 0;
    const meets = (lv: 'B' | 'C' | 'D') => spfm >= T[lv][0] && lfm >= T[lv][1] && (d < 3 || pm < T[lv][2]);
    const best = meets('D') ? 'D' : meets('C') ? 'C' : meets('B') ? 'B' : 'none';
    return walk(ask(`A design has SPFM ${spfm}%, LFM ${lfm}%${d === 3 ? ` and PMHF ${pm} FIT` : ''}. What is the highest ASIL whose targets it meets? (B, C, D or none)`, words(best, `ASIL ${best}`), `${best === 'none' ? 'Not even ASIL B: SPFM needs 90% and LFM 60%' + (d === 3 ? ', PMHF under 100 FIT' : '') + '.' : `It meets ASIL ${best}.`} Every target of the level has to be met, not just one.`, 'Check each level from D down; all targets must pass.'),
      'matching metrics to an ASIL', idea,
      choice('To reach a level, the design must meet:', 'Every target of that level', ['Any one target of that level', 'Only the SPFM target']),
      step('Highest ASIL met (B, C, D or none):', words(best, `ASIL ${best}`)));
  },
  (r, d) => concept(r, [...atLevel(2, [
    ['Automotive safety grades risk ASIL A to D. Which needs the most rigor?', 'ASIL D', ['ASIL A', 'QM', 'All equal'], 'ASIL levels', 'The automotive safety integrity level is set by three things: how severe the harm would be, how often the situation occurs, and how controllable it is for the driver. An ASIL belongs to a hazardous event (and the safety goal that covers it). A brake failure that is severe, common and out of the driver\'s control reaches ASIL D, the strictest grade; not every braking function is ASIL D.', ['A severe, common, uncontrollable hazard is graded:', 'ASIL D, the highest', ['ASIL A, the highest', 'QM, no ASIL needed']], 'It is for a hazard that is severe, common and hard for the driver to control.'],
    ['Which is a random hardware fault rather than a systematic one?', 'An alpha particle flips an SRAM bit', ['A bug in the RTL of the controller', 'A wrong requirement in the spec', 'A missing timing constraint on a path'], 'random versus systematic faults', 'Random faults come from physics and happen by chance in working hardware (a particle, wear); safety mechanisms handle them. Systematic faults come from mistakes in the design or the requirements, which are built into every unit and are prevented by a good process.', ['A bug in the RTL is:', 'A systematic fault', ['A random hardware fault', 'A transient soft error']]],
    ['Two identical cores run a couple of cycles apart and compare outputs every cycle. What is it?', 'Dual-core lockstep', ['Hyperthreading', 'Speculation', 'Cache coherence protocol'], 'lockstep cores', 'Two cores run the same program and a checker compares their outputs. If a random fault upsets only one, the outputs differ and the fault is caught. A small delay between them makes it unlikely that one event corrupts both the same way.', ['A mismatch between the two cores means:', 'A fault happened in one of them', ['Both cores failed in the same way', 'The program has a software bug']], 'It detects random faults in either core.'],
    ['How do you show a safety mechanism reaches its claimed coverage?', 'Inject faults and count detections', ['Ask the designer to sign a statement', 'Run the normal regression one more time', 'Measure the power with the mechanism on'], 'measuring coverage', 'Claimed coverage needs evidence. You deliberately inject many faults (flip bits, stick signals) in simulation or emulation and count how many the safety mechanism catches: fault injection is the main evidence for the coverage you claim. Early FMEDAs can start from typical values for each kind of safety mechanism.', ['Diagnostic coverage is measured by:', 'Injecting faults and counting detections', ['Counting the lines of safety code reviewed', 'Reading the safety spec']], 'Fault-injection campaigns force faults in simulation or emulation and count how many are detected.'],
    ['Why does a watchdog timer exist in a safety system?', 'To catch lock-ups and force a safe state', ['To count cars passing the sensor', 'To speed up the boot after a reset', 'To encrypt data on the CAN bus'], 'watchdog timers', 'A watchdog is an independent timer that counts down. Healthy software "kicks" it regularly to restart the count. If the software hangs, it stops kicking, the timer runs out, and the watchdog forces a reset into a safe state.', ['A hung program stops kicking the watchdog, so it:', 'Expires and forces a safe reset', ['Keeps counting with no action', 'Waits for the code to recover']], 'If it is not serviced in time, it forces a safe state.'],
  ]),
    ...atLevel(1, [['What does ECC memory do?', 'Detects and corrects bit errors in stored data', ['Makes the memory run faster', 'Stores a backup copy of the whole OS', 'Encrypts the stored data so it cannot be read'], 'ECC codes', 'Error-correcting code adds check bits to each word. A single flipped bit can be located and fixed, and a double flip is detected, which protects against soft errors from radiation.', ['ECC can correct how many flipped bits per word?', 'One', ['Zero', 'Any number']]]]),
    ...atLevel(3, [['What does a safe state mean for a safety system?', 'A state where a fault cannot lead to harm', ['A state where the chip is fully fast', 'A state with all clocks running', 'A state where the chip reboots itself every second'], 'safe state', 'A safe state is a defined state the system can enter on a fault, where the fault can no longer cause a hazard. Examples are shutting off an actuator or holding it in a known position.', ['A safe state is one where:', 'A fault cannot cause harm', ['The system runs at full speed']]]]),
    ...atLevel(3, [
    ['Which decomposition of an ASIL D requirement is valid?', 'B(D) + B(D)', ['A(D) + A(D)', 'A(D) + B(D)', 'B(D) + QM(D)'],
      'ASIL decomposition', 'A requirement can be split between two independent elements, each built to a lower level. The valid splits of D are C(D) + A(D), B(D) + B(D) and D(D) + QM(D). The two elements must be truly independent, which dependent-failure analysis checks.',
      ['Decomposition only works if the two elements are:', 'Independent', ['Identical', 'Faster']], 'The valid splits of D are C(D) + A(D), B(D) + B(D) and D(D) + QM(D), and only for independent elements'],
    ['For which ASIL are the numeric hardware metric targets only recommended, not required?', 'ASIL B', ['ASIL C', 'ASIL D', 'ASIL C and D'],
      'which targets are mandatory', 'The SPFM, LFM and PMHF targets are recommended for ASIL B and required for C and D. Decomposing a requirement does not relax them, and they apply per item and per safety goal.',
      ['At ASIL D the metric targets are:', 'Required', ['Optional', 'Waived by decomposition']], 'Recommended for B, required for C and D'],
    ['Two channels take their clock from the same oscillator. What does the shared clock threaten?', 'Independence: one common cause can fail both', ['Speed: the channels run too slowly together', 'Area: the oscillator takes room on the die', 'Nothing, as long as both channels agree'],
      'dependent failures', 'Redundancy only helps if one fault can not take out both copies. A shared clock, supply or layout region is a common cause, and dependent-failure analysis looks for exactly these.',
      ['A fault in a shared clock can hit:', 'Both channels at once', ['Only one channel', 'Neither channel']], 'A common-cause failure: one fault in the shared clock defeats the redundancy'],
    ]),
  ], (why) => `${why}.`, d),
]);

export const fusaBoss = boss({
  id: 'boss-fusa',
  title: 'The Braking Controller',
  concept: 'take a microcontroller to ASIL D',
  xp: 220,
  steps: [
    say('Boss fight, {name}. A brake-by-wire controller must reach ASIL D. The whole item has under 10 FIT to spend, and this chip is allocated 5 FIT of it. The assessor is coming next month. Exam rules.', 'concerned'),
    { t: 'gen', make: () => ask('What minimum single-point fault metric (SPFM) does ASIL D require, in %?', qty(99, '%', 0.001, '99'), 'ASIL D: SPFM ≥ 99%, LFM ≥ 90%, PMHF < 10 FIT for the whole item, of which this chip is allocated 5 FIT.') },
    { t: 'gen', make: () => { const res = (200 + 300 + 50) * 0.02; return ask('Dangerous FIT: CPU 200, SRAM 300, interconnect 50. Every block has 98% diagnostic coverage. Residual FIT?', qty(res, '', 0.02, sig(res)), `550 × 0.02 = ${sig(res)} FIT: over the chip\'s 5 FIT budget.`); } },
    mc('Which single change cuts residual FIT the most?', ['ECC on the SRAM and lockstep on the CPU', 'More software self-tests at boot', 'Bigger caches to cut DRAM traffic', 'A watchdog on the CPU and parity on the bus'], 0, 'SECDED ECC and lockstep raise the coverage of the two blocks that carry most of the raw FIT. Attack the biggest contributors first; ECC and lockstep give 99%+ coverage.'),
    { t: 'gen', make: () => { const res = 200 * 0.01 + 300 * 0.001 + 50 * 0.02; return ask('Now CPU 99% (lockstep), SRAM 99.9% (ECC), interconnect still 98%. Residual FIT?', qty(res, '', 0.02, sig(res)), `200 × 0.01 + 300 × 0.001 + 50 × 0.02 = ${sig(res)} FIT: under the chip\'s 5 FIT budget.`); } },
    { t: 'gen', make: () => ask('SECDED on 64-bit SRAM words: how many check bits?', num(8), 'SEC needs 7 (2⁷ = 128 ≥ 64 + 7 + 1), plus 1 for double detection: 8. The classic 72-bit ECC word.') },
    { t: 'gen', make: () => { const f = (3.3 * 5e6 * 500) / 1e9; return ask('At 3.3 FIT residual, a fleet of 5 million cars running 500 hours a year. Expected dangerous failures per year?', qty(f, '', 0.02, sig(f)), `3.3 × 5e6 × 500 / 1e9 = ${sig(f)}. That is why the target is so strict.`); } },
    { t: 'gen', make: () => ask('The hazard analysis rates unintended full braking at speed S3, E3, C3. Which ASIL? (A, B, C, D or QM)', words('C', 'ASIL C'), '3 + 3 + 3 = 9, which is ASIL C. Only S3 + E4 + C3 = 10 reaches D.') },
    mc('The team wants to split an ASIL D requirement across two independent channels. Which split is valid?', ['A(D) + A(D)', 'B(D) + B(D)', 'A(D) + B(D)', 'B(D) + QM(D)'], 1, 'The valid splits are C(D) + A(D), B(D) + B(D) and D(D) + QM(D). The channels must be independent, and the metric targets do not get easier.'),
    { t: 'gen', make: () => ask('The FTTI is 20 ms. Detection takes 4 ms and the reaction 6 ms. Margin, in ms?', qty(10, 'ms', 0.001, '10'), '20 - 4 - 6 = 10 ms of margin.') },
  ],
  recap: ['ASIL D targets.', 'Residual FIT.', 'ECC and lockstep.', 'Fleet-scale failures.', 'S + E + C lookup.', 'Decomposition and FTTI.'],
});

// ------------------------------------------------------------------ silicon photonics

export const photonicsPractice = practice('practice-photonics', 'Photonics Drills', 'band gaps, WDM, energy per bit, link budgets, photodetectors', [
  (r, d) => {
    const m = pick(r, [['Silicon', 1.12], ['Germanium', 0.66], ['InP', 1.34], ['GaAs', 1.42], ['GaN', 3.4], ['InGaAs', 0.75]] as const);
    const idea = 'Light comes in particles called photons, and each photon of wavelength λ carries energy E = h·c ÷ λ. In convenient units: E (in eV) = 1.24 ÷ λ (in µm). A semiconductor can absorb a photon only if its energy is at least the material\'s band gap Eg. So the LONGEST wavelength a material absorbs is where the photon energy equals the band gap: λ = 1.24 ÷ Eg.';
    if (d < 3) return walk(ask(`${m[0]} has a band gap of ${m[1]} eV. Longest wavelength it absorbs, in µm? (λ = 1.24/Eg)`, qty(1.24 / m[1], 'um', 0.02, sig(1.24 / m[1])), `1.24 / ${m[1]} = ${sig(1.24 / m[1])} µm. Silicon is transparent at 1.31 and 1.55 µm, which is why it makes good waveguides and needs germanium to detect light.${m[0] === 'Germanium' ? ' Germanium\'s 0.66 eV is its indirect gap; useful absorption fades beyond about 1.55–1.6 µm, set by its 0.8 eV direct gap.' : ''}`, 'Photon energy must exceed the band gap.'),
      'the absorption edge', idea,
      choice('A photon can be absorbed only if its energy is:', 'At least the band gap', ['Below the band gap', 'Exactly zero']),
      calc('λ = 1.24 ÷ Eg, in µm:', `1.24 / ${m[1]}`, 1.24 / m[1], 'um', sig(1.24 / m[1]), 0.02));
    const lam = pick(r, [1.31, 1.55, 1.06, 0.98, 0.85, 1.7]), e = 1.24 / lam;
    return walk(ask(`What is the energy of a ${lam} µm photon, in eV?`, qty(e, 'eV', 0.02, sig(e)), `1.24 / ${lam} = ${sig(e)} eV: ${e < 1.12 ? "below silicon's 1.12 eV band gap, so silicon cannot absorb it" : "above silicon's 1.12 eV band gap, so silicon absorbs it"}.`, 'E = 1.24/λ with λ in µm.'),
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Why can\'t you easily make a laser out of silicon?', 'Its band gap is indirect', ['Silicon is too expensive', 'Silicon absorbs all light', 'Silicon melts when pumped'], 'direct versus indirect band gaps', 'In a direct band-gap material, an electron and a hole recombine by emitting a photon easily. Silicon has an indirect band gap: recombination also needs a lattice vibration (a phonon), which makes light emission rare and inefficient. So lasers are made of III-V materials such as InP and attached to the silicon.', ['Silicon emits light poorly because its band gap is:', 'Indirect', ['Direct', 'Too wide']], 'Electrons and holes rarely recombine by emitting light, so lasers use III-V materials bonded or attached.'],
    ['What is the classic problem with ring modulators?', 'Resonance drifts with temperature', ['They only work in red light', 'They are too big for a chip', 'They need no power, so cannot be tuned'], 'ring resonators', 'A ring modulator works only for wavelengths that fit the ring exactly (its resonance). Silicon\'s refractive index changes with temperature, which shifts the resonant wavelength (about 0.08 nm per kelvin as measured; textbooks round to about 0.1), so a heater and feedback loop must hold it in place.', ['If the ring heats up, its resonant wavelength:', 'Shifts', ['Stays the same', 'Disappears']], 'Each needs a heater and control loop.'],
    ['Why move optics into the package (co-packaged optics)?', 'Short electrical paths cut pJ/bit', ['Fibres are cheaper than copper', 'It removes the need for lasers', 'It makes the switch die smaller and cheaper'], 'co-packaged optics', 'Driving 200 Gb/s over long copper traces on a board needs power-hungry equalizing circuits. If the optical engine sits right next to the switch chip, the electrical path is only a few millimetres, which needs much less power per bit.', ['A shorter electrical path needs:', 'Less power per bit', ['More power per bit', 'No power']], 'Electrical traces to the front panel burn too much power at high rates.'],
    ['What does a Mach-Zehnder modulator do?', 'Interference turns a phase shift into intensity', ['It generates light by stimulated emission', 'It detects light as a photocurrent', 'It amplifies light by pumping a doped fibre'], 'Mach-Zehnder modulators', 'The light is split into two paths. A voltage changes the phase of light in one arm. When the paths recombine, waves in phase add up (bright) and waves 180° apart cancel (dark), so the voltage controls the output intensity.', ['Two waves 180° out of phase, when combined:', 'Cancel', ['Add up', 'Double in frequency']], 'It splits light into two arms, shifts the phase of one, and recombines them.'],
  ]),
    ...atLevel(1, [['What does a waveguide do for light?', 'Guides light by total internal reflection', ['Amplifies light with a laser gain medium inside it', 'Stores light for a long time', 'Converts light into electrical current'], 'waveguides', 'A waveguide is a core of high-index material surrounded by lower-index cladding. Light stays confined in the core by total internal reflection, so it can be routed around a chip like a wire.', ['Light stays in a waveguide because of:', 'Total internal reflection', ['Gravity', 'A magnetic field']]]]),
    ...atLevel(2, [['What does a photodiode do?', 'Turns incoming light into a current', ['Turns a current into light for the fibre link', 'Guides light between two chips', 'Splits one beam into two'], 'photodiodes', 'A photodiode absorbs photons and produces an electrical current proportional to the light power. It is the receiving end of an optical link.', ['A photodiode produces:', 'A current from light', ['Light from a current']]]]),
    ...atLevel(3, [['Why is a silicon photonic modulator sensitive to temperature?', 'Its refractive index shifts with heat', ['Silicon has no band gap at room heat', 'Heat makes light travel slower in air', 'Temperature changes the laser colour only'], 'thermal drift', 'Silicon\'s refractive index rises slightly with temperature, which shifts a ring resonator\'s wavelength. Designs add heaters or tuning circuits to keep the ring locked to the laser.', ['Heating a silicon ring makes its resonance:', 'Shift to a longer wavelength', ['Disappear', 'Stay exactly fixed']]]]),
  ], (why) => `${why}.`, d),
  (r, d) => {
    // G2.7: dense wavelength grid anchored at 193.1 THz; spacing to wavelength by Δλ = λ²Δf/c.
    const sp = pick(r, [100, 50, 25, 12.5] as const);
    const idea = 'The dense wavelength grid is anchored at 193.1 THz, and channel n sits at 193.1 THz + n × spacing, with spacings of 100, 50, 25 or 12.5 GHz. To turn a frequency spacing into a wavelength spacing, use Δλ = λ² × Δf ÷ c (about 0.8 nm for 100 GHz at 1550 nm).';
    if (d === 1) { const n = pick(r, [1, 2, 5, 12]), f = 193.1 + (n * 100) / 1000;
      return walk(ask(`On the dense grid with 100 GHz spacing, what is the frequency of channel n = ${n}, counted up from the 193.1 THz anchor, in THz?`, qty(f, 'THz', 0.00003, String(+f.toFixed(3))), `193.1 + ${n} × 0.1 = ${+f.toFixed(3)} THz.`, 'Anchor plus n × 0.1 THz.'),
        'the dense grid', idea,
        calc('Offset = n × 0.1 THz:', `${n} × 0.1`, n * 0.1, 'THz', String(+(n * 0.1).toFixed(2)), 0.005),
        calc('Frequency = 193.1 + offset, in THz:', `193.1 + ${+(n * 0.1).toFixed(2)}`, f, 'THz', String(+f.toFixed(3)), 0.00003)); }
    if (d === 2) { const n = pick(r, [3, 6, 10, 16]), f = 193.1 + (n * sp) / 1000;
      return walk(ask(`On the dense grid with ${sp} GHz spacing, what is the frequency of channel n = ${n}, in THz?`, qty(f, 'THz', 0.00003, String(+f.toFixed(4))), `193.1 + ${n} × ${sp / 1000} = ${+f.toFixed(4)} THz.`, 'Anchor plus n × spacing.'),
        'the dense grid', idea,
        calc('Offset = n × spacing, in THz:', `${n} × ${sp / 1000}`, (n * sp) / 1000, 'THz', String((n * sp) / 1000), 0.005),
        calc('Frequency = 193.1 + offset, in THz:', `193.1 + ${(n * sp) / 1000}`, f, 'THz', String(+f.toFixed(4)), 0.00003)); }
    const lam = pick(r, [1550, 1310]), dl = (lam ** 2 / 3e8) * sp;
    return walk(ask(`At ${lam} nm, what wavelength spacing does a ${sp} GHz channel spacing correspond to, in nm? (Δλ = λ²·Δf / c, c = 3×10⁸ m/s)`, qty(dl, 'nm', 0.03, sig(dl)), `(${lam} nm)² × ${sp} GHz / c = ${sig(dl)} nm.`, 'λ² times Δf over c.'),
      'frequency spacing to wavelength', idea,
      calc('λ² ÷ c, which comes to this many nm per GHz when λ is in nm and c = 3×10⁸:', `${lam}² / 300000000`, (lam ** 2) / 3e8, '', sig((lam ** 2) / 3e8, 4), 0.03),
      calc('Δλ = that × Δf, in nm:', `${sig((lam ** 2) / 3e8, 4)} × ${sp}`, dl, 'nm', sig(dl), 0.03));
  },
  (r, d) => {
    // G2.7: lanes × rate for a port, and PAM4's two bits per symbol.
    const [n, rate] = pick(r, [[8, 100], [4, 200], [8, 200], [4, 100], [2, 200], [2, 100]] as const), t = n * rate;
    if (d === 1) return walk(ask(`A port has ${n} lanes at ${rate} Gb/s each. What is its total rate, in Gb/s?`, qty(t, 'Gb/s', 0.01, String(t)), `${n} × ${rate} = ${t} Gb/s.`, 'Lanes times rate.'),
      'lanes times rate', 'A port\'s rate is its number of lanes times the rate of each lane: 800G is 8 × 100G or 4 × 200G, and 1.6T is 8 × 200G.',
      count('Total in Gb/s = lanes × rate:', `${n} × ${rate}`, t));
    if (d === 2) return walk(ask(`A PAM4 lane carries ${rate} Gb/s. PAM4 sends two bits per symbol. What is the symbol rate, in GBd (ignoring coding overhead)?`, qty(rate / 2, 'GBd', 0.02, String(rate / 2)), `${rate} / 2 = ${rate / 2} GBd.`, 'Bits per second over bits per symbol.'),
      'PAM4 symbol rate', 'PAM4 has four amplitude levels, so each symbol carries two bits. The symbol rate is half the bit rate (before any coding overhead).',
      calc('Symbol rate = bit rate ÷ 2, in GBd:', `${rate} / 2`, rate / 2, 'GBd', String(rate / 2), 0.02));
    return walk(ask(`A switch port must carry ${t} Gb/s using PAM4 lanes of ${rate} Gb/s. How many lanes does it need?`, num(n), `${t} / ${rate} = ${n} lanes (each running at ${rate / 2} GBd of PAM4 symbols).`, 'Port rate over lane rate.'),
      'lanes for a port', 'Divide the port rate by the lane rate to count lanes. Each PAM4 lane runs at half its bit rate in symbols per second.',
      count('Lanes = port rate ÷ lane rate:', `${t} / ${rate}`, n));
  },
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
    mc('In the field, one wavelength fails as the switch heats up. Likely cause?', ['A ring modulator drifted off resonance', 'The fibre connector loosened', 'The laser power is too high at that wavelength', 'The germanium detector stopped absorbing'], 0, 'Its heater control could not track the temperature. Rings move about 0.08 nm/K; thermal tuning must track it.'),
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
    const tb = pick(r, [1, 100, 10, 1000, 4, 16]), n = Math.floor(Math.log2((tb * 1e12) / 16));
    return walk(ask(`How many qubits can a full state-vector simulation hold in ${tb} TB (16 bytes per amplitude)?`, num(n), `2^n × 16 ≤ ${tb}e12 → n = ${n}. A hundred times the memory buys only ${Math.round(Math.log2(100))} more qubits.`, 'log2(memory / 16), rounded down.'),
      'how many qubits fit in memory', `${idea} To find how many qubits fit, ask how many amplitudes the memory can hold, then how many times 2 doubles to that (log base 2), rounded down.`,
      calc('Amplitudes that fit = memory in bytes ÷ 16:', `${tb}e12 / 16`, (tb * 1e12) / 16, '', sci((tb * 1e12) / 16, 3), 0.01),
      calc('How many doublings: log2 of that:', `log2(${sci((tb * 1e12) / 16, 3)})`, Math.log2((tb * 1e12) / 16), '', sig(Math.log2((tb * 1e12) / 16), 4), 0.003),
      count('Round down to a whole number of qubits:', `floor(${sig(Math.log2((tb * 1e12) / 16), 4)})`, n));
  },
  (r, d) => {
    const idea = 'Measuring a qubit gives 0 or 1 at random. If the qubit is in the state a|0⟩ + b|1⟩, the probability of reading 1 is |b|², the squared magnitude of its amplitude (the Born rule); reading 0 has probability |a|², and the two add up to 1. The amplitudes can be complex numbers, and |b|² = (real part)² + (imaginary part)².';
    if (d === 1) return walk(ask('A qubit in |0⟩ goes through a Hadamard gate and is measured. Probability of reading 1, in %?', qty(50, '%', 0.01, '50'), 'H makes (|0⟩ + |1⟩)/√2, and each outcome has probability (1/√2)² = 50%.', 'Square the amplitude.'),
      'the Born rule after a Hadamard', `${idea} The Hadamard gate turns |0⟩ into (|0⟩ + |1⟩) ÷ √2: both amplitudes are 1 ÷ √2.`,
      calc('Probability of 1 = (1 ÷ √2) squared, as a %:', '(1 / sqrt(2))^2 × 100', 50, '%', '50', 0.01));
    if (d === 2) {
      const [a, b] = pick(r, [[0.6, 0.8], [0.8, 0.6], [0.28, 0.96]] as const);
      return walk(ask(`A qubit is in ${a}|0⟩ + ${b}|1⟩. Probability of measuring 1, in %?`, qty(b * b * 100, '%', 0.01, sig(b * b * 100)), `|${b}|² = ${sig(b * b)} → ${sig(b * b * 100)}%. Probabilities are squared amplitudes, and they add to 1.`, 'Born rule.'),
        'the Born rule', idea,
        choice('The amplitude of |1⟩ is ' + b + '. The probability of reading 1 is the amplitude:', 'Squared in magnitude', ['Itself', 'Doubled']),
        calc('Probability = amplitude squared, as a % (× 100):', `${b}^2 × 100`, b * b * 100, '%', sig(b * b * 100), 0.01));
    }
    if (pick(r, [0, 1]) === 1) {
      const [re, im] = pick(r, [[0.5, 0.5], [0.6, 0.8], [0, 1], [0.3, 0.4]] as const), pc = (re * re + im * im), amp = `(${re} + ${im}i)`;
      return walk(ask(`A qubit's amplitude for |1⟩ is b = ${amp}. Probability of measuring 1 is |b|² (the squared magnitude, not b²). Give |b|², as a number?`, qty(pc, '', 0.01, sig(pc)), `|b|² = ${re}² + ${im}² = ${sig(pc)}. Squaring a complex amplitude directly (b²) would give a complex number, not a probability.`, '|b|² = real² + imaginary².'),
        'the Born rule with complex amplitudes', idea,
        calc('Real part squared:', `${re}^2`, re * re, '', sig(re * re), 0.001),
        calc('Imaginary part squared:', `${im}^2`, im * im, '', sig(im * im), 0.001),
        calc('|b|² = sum of the two:', `${sig(re * re)} + ${sig(im * im)}`, pc, '', sig(pc), 0.01));
    }
    const th = pick(r, [30, 60, 90, 120, 150, 180]), p = Math.sin(((th / 2) * Math.PI) / 180) ** 2 * 100;
    return walk(ask(`A qubit in |0⟩ is rotated by θ = ${th}° about the X axis, giving cos(θ/2)|0⟩ - i·sin(θ/2)|1⟩. Probability of measuring 1, in %?`, qty(p, '%', 0.02, sig(p)), `sin²(${th / 2}°) = ${sig(p)}%. A π rotation (180°) flips the qubit completely.`, 'sin²(θ/2).'),
      'the Born rule after a rotation', `${idea} After the rotation, the amplitude of |1⟩ is sin(θ/2) (the factor -i only changes its phase, not its size). So the probability of 1 is sin²(θ/2).`,
      calc('Half the angle, θ/2, in degrees:', `${th} / 2`, th / 2, '', String(th / 2), 0.001),
      calc('The amplitude sin(θ/2) (calculator in degree mode):', `sin(${th / 2})`, Math.sin(((th / 2) * Math.PI) / 180), '', sig(Math.sin(((th / 2) * Math.PI) / 180), 4), 0.005),
      calc('Probability = amplitude squared, as a %:', `${sig(Math.sin(((th / 2) * Math.PI) / 180), 4)}^2 × 100`, p, '%', sig(p), 0.02));
  },
  (r, d) => {
    const f = pick(r, [0.99, 0.995, 0.999, 0.9965, 0.998, 0.9985]);
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Why does a transmon need a Josephson junction?', 'Its nonlinearity unevens the energy levels', ['To connect the qubit to ground through a resistor', 'To make the aluminium film superconduct', 'To cool the qubit below the fridge temperature'], 'the Josephson junction', 'A plain LC circuit has evenly spaced energy levels, so a pulse meant to drive 0↔1 would also drive 1↔2. A Josephson junction acts as a nonlinear inductor, making the spacing uneven so that the qubit\'s two lowest levels can be addressed on their own.', ['Unevenly spaced levels let a pulse drive:', 'Only the 0↔1 transition', ['Every transition equally', 'No transition']], 'It is a nonlinear inductor, so the lowest two levels can be addressed alone.'],
    ['Trapped ions vs superconducting qubits: which pairing is right?', 'Ions: slow, high fidelity. SC: fast, shorter coherence', ['Ions: fast, lower fidelity. SC: slow, longer coherence', 'Both: fast gates, but only SC needs a vacuum chamber', 'Both: identical speed, coherence and gate fidelity'], 'qubit platforms', 'Each platform is a trade-off. Trapped ions are identical atoms isolated in vacuum: very long coherence and accurate gates, but slow. Superconducting circuits are made with chip technology and have fast gates, but the qubits decohere sooner.', ['Fast gates but shorter coherence describes:', 'Superconducting qubits', ['Trapped ions held in a vacuum', 'Neither type']]],
    ['What is the difference between T1 and T2?', 'T1: energy relaxation. T2: phase coherence', ['T1 and T2 are two names for the same time', 'T2 is always longer than 2·T1', 'T1 is the gate time; T2 the readout time'], 'T1 and T2', 'T1 measures how fast the qubit loses energy (falls from |1⟩ to |0⟩). T2 measures how fast it loses the phase relationship of a superposition. Energy loss always destroys the phase too, so T2 can never be more than 2 × T1; other noise shortens it further.', ['Losing energy also destroys phase, so T2 is at most:', '2 × T1', ['T1 ÷ 2', '10 × T1']], 'T2 ≤ 2·T1, because losing energy also destroys the phase.'],
    ['Why can\'t you copy an unknown qubit to protect it?', 'The no-cloning theorem forbids it', ['Qubits are too small to duplicate', 'Copying would be far too slow', 'It is allowed, but very expensive'], 'no cloning', 'A law of quantum mechanics (no-cloning) forbids making a perfect copy of an unknown quantum state, and measuring it destroys the superposition. So quantum error correction encodes the data across entangled qubits and uses parity checks that find errors without learning the data.', ['Quantum error correction spreads the information across:', 'Many entangled qubits', ['Many copies of the same qubit', 'Classical bits']], 'So error correction spreads information across entangled qubits instead.'],
  ]),
    ...atLevel(1, [['What is a qubit?', 'A two-level quantum system in superposition', ['A classical bit stored in a leaky capacitor cell', 'A logic gate with two inputs', 'A laser pulse of fixed length'], 'qubits', 'A qubit is a quantum system with two basis states, |0⟩ and |1⟩, that can be in a superposition of both. Measurement gives 0 or 1 with probabilities set by the amplitudes.', ['A qubit can be in:', 'A superposition of 0 and 1', ['Only 0', 'Only 1']]]]),
    ...atLevel(2, [['What does a single-qubit gate do?', 'A unitary operation on the qubit state', ['A measurement that collapses the state', 'A copy of the state into another qubit', 'A reset to the ground state only'], 'quantum gates', 'Gates are reversible, unitary operations that rotate the state vector. Measurement is different: it is not unitary and gives a random outcome.', ['Quantum gates (other than measurement) are:', 'Reversible', ['Irreversible', 'Random']]]]),
    ...atLevel(3, [['Why is the no-cloning theorem a problem for error correction?', 'You cannot copy a qubit to check it', ['Copies would slow the gates down', 'Measuring always destroys the qubit forever', 'Qubits cannot hold more than one bit'], 'no-cloning', 'No-cloning forbids making an unknown quantum state copy. Classical error correction copies bits to compare them, so quantum codes must spread the information over several qubits and measure parities instead.', ['No-cloning means an unknown qubit state:', 'Cannot be copied', ['Can be copied freely']]]]),
    ...atLevel(3, [
    ['How do T2* and T2 echo compare for one qubit?', 'T2* is the shorter, as an echo refocuses slow noise', ['They are always equal, both being dephasing times', 'T2* is the longer, because an echo pulse adds noise to it', 'T2 echo can exceed 2·T1 with a well-designed pulse train'], 'T2* versus T2 echo', 'A Ramsey experiment gives T2*, which includes slow drifts. An echo pulse cancels the slow part and gives the longer T2 echo. Neither can pass 2·T1, since energy relaxation also destroys phase: T2* ≤ T2 ≤ 2·T1.',
      ['An echo pulse refocuses:', 'Slow noise', ['Energy relaxation', 'The readout']]],
    ['Which of these is one of DiVincenzo\'s five criteria?', 'Coherence times much longer than the gate time', ['A dilution refrigerator colder than ten millikelvin', 'At least a million physical qubits in total', 'A control clock running above one gigahertz'], 'DiVincenzo\'s criteria', 'The five are: scalable well-characterised qubits, initialisation to a simple state, long coherence compared with gate time, a universal gate set, and qubit-specific measurement.',
      ['Gates must be fast compared with:', 'Coherence time', ['The supply voltage', 'The cable length']]],
    ['What does quantum volume report?', '2^n for the largest n-qubit, depth-n circuit that passes', ['The number of physical qubits fitted on the chip', 'The cooling power of the refrigerator at its coldest stage', 'The clock speed of the control electronics in GHz'], 'quantum volume', 'Quantum volume folds qubit count, gate fidelity and connectivity into one number: a machine that can pass an n-qubit, depth-n random circuit has quantum volume 2^n. Layer fidelity instead reports the error of a whole layer of two-qubit gates.',
      ['A passing 6-qubit, depth-6 circuit gives a volume of:', '64', ['6', '36']]],
    ]),
  ], (why) => `${why}.`, d),
  (r, d) => {
    // G2.8: below threshold, each step d -> d + 2 divides the logical error by Λ.
    const lam = pick(r, [2, 3, 4]), e = pick(r, [0.4, 0.6, 1.2, 2.4, 4.8]);
    const idea = 'Below the surface-code threshold (near 1% physical error), each step up in code distance, d to d + 2, divides the logical error rate by a factor Λ. A 2024 experiment measured Λ about 2.1. After k steps the error is the starting error divided by Λ to the power k.';
    if (d === 1) return walk(ask(`A surface code has Λ = ${lam}. One step up in distance (d to d + 2) takes a logical error of ${e}% per cycle to what, in %?`, qty(e / lam, '%', 0.02, sig(e / lam)), `${e} / ${lam} = ${sig(e / lam)}%.`, 'Divide by Λ once.'),
      'the error suppression factor', idea,
      calc('New error = old ÷ Λ, in %:', `${e} / ${lam}`, e / lam, '%', sig(e / lam), 0.02));
    const k = d === 2 ? 2 : pick(r, [2, 3]), d0 = pick(r, [3, 5]), d1 = d0 + 2 * k;
    const out = e / lam ** k;
    return walk(ask(`A surface code has Λ = ${lam}. At distance ${d0} its logical error is ${e}% per cycle. What is it at distance ${d1}, in %?`, qty(out, '%', 0.03, sig(out)), `From ${d0} to ${d1} is ${k} steps of +2: ${e} / ${lam}^${k} = ${sig(out)}%.`, 'Count the +2 steps, divide by Λ each time.'),
      'the error suppression factor', idea,
      count('Steps of +2 from the first distance to the second:', `(${d1} - ${d0}) / 2`, k),
      calc('Error = start ÷ Λ^steps, in %:', `${e} / ${lam}^${k}`, out, '%', sig(out), 0.03));
  },
  (r, d) => {
    // G2.8: randomized benchmarking, r = (1 - p)(dim - 1)/dim, with dim = 2^n qubits.
    const p = pick(r, [0.99, 0.992, 0.995, 0.998, 0.999, 0.9995]);
    const idea = 'Randomized benchmarking runs random gate sequences of growing length and fits how the fidelity decays, giving a decay parameter p. The average error per gate is r = (1 - p) × (dim - 1) ÷ dim, where dim = 2 for one qubit and 4 for two.';
    if (d === 1) return walk(ask(`A single-qubit benchmarking decay has p = ${p}. What is the average error per gate r = (1 - p)/2, in %?`, qty(((1 - p) / 2) * 100, '%', 0.03, sig(((1 - p) / 2) * 100)), `(1 - ${p}) / 2 = ${sig((1 - p) / 2)}, which is ${sig(((1 - p) / 2) * 100)}%.`, 'Half of (1 - p).'),
      'randomized benchmarking', idea,
      calc('1 - p:', `1 - ${p}`, 1 - p, '', String(+(1 - p).toFixed(4)), 0.005),
      calc('r = (1 - p) ÷ 2, in %:', `${+(1 - p).toFixed(4)} / 2 × 100`, ((1 - p) / 2) * 100, '%', sig(((1 - p) / 2) * 100), 0.03));
    if (d === 2) return walk(ask(`A single-qubit benchmarking run decays with p = ${p}. What is the average error per gate, in %? (r = (1 - p)(d - 1)/d, d = 2)`, qty(((1 - p) / 2) * 100, '%', 0.03, sig(((1 - p) / 2) * 100)), `(1 - ${p}) × 1 / 2 = ${sig((1 - p) / 2)} = ${sig(((1 - p) / 2) * 100)}%.`, 'The factor (d - 1)/d is 1/2.'),
      'randomized benchmarking', idea,
      calc('r = (1 - p) × (2 - 1) ÷ 2, in %:', `${+(1 - p).toFixed(4)} × 1 / 2 × 100`, ((1 - p) / 2) * 100, '%', sig(((1 - p) / 2) * 100), 0.03));
    return walk(ask(`A two-qubit benchmarking run decays with p = ${p}. What is the average error per gate, in %? (r = (1 - p)(d - 1)/d, with d = 4 for two qubits)`, qty(((1 - p) * 3 / 4) * 100, '%', 0.03, sig(((1 - p) * 3 / 4) * 100)), `(1 - ${p}) × 3 / 4 = ${sig((1 - p) * 0.75)} = ${sig(((1 - p) * 3 / 4) * 100)}%.`, 'The factor (d - 1)/d is 3/4.'),
      'randomized benchmarking', idea,
      calc('r = (1 - p) × (4 - 1) ÷ 4, in %:', `${+(1 - p).toFixed(4)} × 3 / 4 × 100`, ((1 - p) * 3 / 4) * 100, '%', sig(((1 - p) * 3 / 4) * 100), 0.03));
  },
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
    mc('What would make the claim credible?', ['Error correction with gates below threshold', 'More qubits of the same quality', 'A faster classical control computer', 'Running the circuit many more times and averaging'], 0, 'Encode logical qubits in many physical ones, with gates below the code threshold (physical error rates below about 1% for the surface code, as Willow showed in 2024). Repetition cannot fix a signal that is almost all noise; only error correction scales.'),
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
    const a = pick(r, d === 3 ? [10, 15, 20, 25, 30, 40] : [10, 20, 30]), al = 10 ** (a / 10);
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
  (r, d) => concept(r, [...atLevel(2, [
    ['Why do drive lines have attenuators at several cold stages?', 'To replace room-temperature noise with colder noise', ['To save power in the room-temperature control electronics', 'To slow the pulses so the qubits can follow them', 'Because the qubits need only weak signals to work'], 'attenuators in the fridge', 'A room-temperature cable carries 300 K thermal noise. An attenuator reduces the signal AND the noise by the same factor, then adds its own (colder) noise at its own temperature. Several stages step the noise down toward the coldest temperature, where the last attenuator sits.', ['The last attenuator should be at:', 'The coldest stage', ['Room temperature, at the source', 'The 4 K stage']], 'A room-temperature source sends thermal noise down the line; each cold attenuator cuts it and adds only its own, colder noise.'],
    ['Why is a quantum-limited amplifier (JPA or TWPA) placed first in the readout chain?', 'The first stage dominates the noise', ['It is the cheapest amplifier', 'It filters the drive pulses', 'It cools the qubit during readout'], 'first-stage amplifiers', 'From the Friis formula, the noise of a chain is dominated by its first stage. A readout signal is only a few photons, so any noise added before the first gain stage ruins it. Quantum-limited amplifiers add almost no noise beyond the quantum minimum.', ['The noise of an amplifier chain is dominated by:', 'The first stage', ['The last, highest-gain stage', 'The cables']], 'By Friis, the first stage dominates, and these add close to the minimum quantum noise.'],
    ['Why must the error-correction decoder be fast?', 'Otherwise its syndrome backlog grows without bound', ['It does not have to be: it can decode everything afterwards', 'To save power in the room-temperature controller', 'Because qubits are fast, so everything must be'], 'real-time decoding', 'Error correction produces a new set of parity measurements (a syndrome) about every microsecond. A classical decoder must work out the corrections from each one. If it is slower than the arrival rate, the queue grows forever, and logical operations that wait on it stall.', ['If decoding is slower than syndromes arrive, the backlog:', 'Grows without bound', ['Shrinks', 'Stays constant']], 'Syndromes arrive about every microsecond.'],
    ['What does DRAG pulse shaping fix?', 'Leakage into the third level', ['LO leakage in the IQ mixer', 'Thermal noise on the drive line', 'Crosstalk between readout resonators'], 'DRAG pulses', 'A short pulse has a wide frequency spread, and a transmon\'s 1↔2 transition is close to its 0↔1 transition, so the pulse can accidentally excite the third level (leakage). DRAG adds a derivative of the pulse on the quadrature channel, which cancels the unwanted frequencies.', ['DRAG cancels frequency content that would excite:', 'The third level (leakage)', ['The readout resonator', 'The 0↔1 transition itself']], 'It adds a derivative component on the quadrature channel.'],
  ]),
    ...atLevel(1, [['What does a cryostat do for a qubit chip?', 'Keeps the chip cold to protect its quantum states', ['Cools the room for the operators', 'Holds the classical control PCB', 'Stores the qubit data permanently on a cold server'], 'cryostats', 'Superconducting qubits work only near absolute zero, where thermal noise is small enough that the quantum states survive long enough to be used.', ['Superconducting qubits need:', 'Temperatures near absolute zero', ['Room temperature']]]]),
    ...atLevel(2, [['What does a readout resonator do?', 'Couples a qubit to a line for readout', ['Stores the qubit state for later use', 'Generates the microwave clock for the chip', 'Filters out all heat from the chip'], 'readout resonators', 'A readout resonator is a microwave resonator whose frequency depends on the qubit state. A probe tone sent along the line picks up that shift, which tells the state apart.', ['The readout frequency depends on:', 'The qubit state', ['The room temperature']]]]),
    ...atLevel(3, [['Why does a qubit control pulse need a precise shape?', 'Wrong shapes leak into other levels', ['Shapes set the qubit\'s final frequency', 'Pulses without shape cannot reach the chip', 'Square pulses are always illegal'], 'pulse shaping', 'A sharp pulse has spectral content at other transmon levels, so population leaks out of the qubit subspace. Shaped pulses such as DRAG keep the error small.', ['Leakage means population moves to:', 'Other energy levels', ['The ground state only']]]]),
  ], (why) => `${why}.`, d),
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
    mc('What else must scale with the qubit count?', ['The real-time error-correction decoder', 'Nothing beyond the fridge size', 'The qubits\' own T1 coherence time', 'The local oscillator frequency of each drive line'], 0, 'The decoder must keep up with syndrome data from every logical qubit every microsecond. Control, readout, wiring and decoding all scale together; any one can cap the machine.'),
  ],
  recap: ['Upconversion.', 'Pulse timing.', 'Attenuator noise.', 'Cryo heat budgets.', 'Decoder throughput.'],
});

export const DOMAIN_PRACTICE = [npuPractice, hwsecPractice, fusaPractice, photonicsPractice, qubitPractice, qctrlPractice];
export const DOMAIN_BOSSES = [aiBoss, hwsecBoss, fusaBoss, photonicsBoss, qubitBoss, qctrlBoss];

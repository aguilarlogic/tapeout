/** The AES S-box (8-bit), computed from its definition: multiplicative inverse in GF(2^8), then the affine map.
 *  The sec-dpa lab's own SBOX is a 4-bit table for 16-value nibbles, so the byte-wide drills need this one. */
const gmul = (a: number, b: number) => { let p = 0; for (; b; b >>= 1) { if (b & 1) p ^= a; a = (a << 1) ^ (a & 0x80 ? 0x11b : 0); a &= 0xff; } return p; };
const rotl = (x: number, n: number) => ((x << n) | (x >> (8 - n))) & 0xff;
export const AES_SBOX: readonly number[] = Array.from({ length: 256 }, (_, x) => {
  let inv = 0;
  if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv = y; break; }
  return inv ^ rotl(inv, 1) ^ rotl(inv, 2) ^ rotl(inv, 3) ^ rotl(inv, 4) ^ 0x63;
});

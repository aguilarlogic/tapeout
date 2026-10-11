// C2: the power-model drill must attack the S-box output, Sbox(data ^ key), not the linear XOR.
import { describe, expect, it } from 'vitest';
import { rng } from '../sim/harness';
import { AES_SBOX } from './aes';
import { PRACTICE } from '.';

const pop = (x: number) => { let n = 0; for (; x; x >>= 1) n += x & 1; return n; };
describe('C2: side-channel drill', () => {
  it('computes the real AES S-box', () => {
    expect([AES_SBOX[0], AES_SBOX[1], AES_SBOX[0x53], AES_SBOX[0xff]]).toEqual([0x63, 0x7c, 0xed, 0x16]);
    expect(new Set(AES_SBOX).size).toBe(256);
  });
  it('d3 asks for the Hamming weight of the S-box output and the answer checks out', () => {
    const set = PRACTICE.find((p) => p.id === 'practice-hwsec')!;
    let seen = 0;
    for (let k = 1; k <= 60; k++) for (const g of set.gens) {
      const q = g(rng(k), 3);
      if (q.t !== 'ask' || !/S-box/.test(q.q)) continue;
      seen++;
      const m = /data byte is 0x([0-9A-F]+) and your key guess is 0x([0-9A-F]+)\. Sbox\(0x([0-9A-F]+)\) = 0x([0-9A-F]+)/.exec(q.q)!;
      const [v, w] = [parseInt(m[1], 16), parseInt(m[2], 16)];
      expect(parseInt(m[3], 16)).toBe(v ^ w);
      expect(parseInt(m[4], 16)).toBe(AES_SBOX[v ^ w]);
      expect(q.a.check(String(pop(AES_SBOX[v ^ w])))).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  });
});

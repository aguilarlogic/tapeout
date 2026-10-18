import { describe, expect, it } from 'vitest';
import { crc32, zip } from './zip';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

/** An independent reader: walks the central directory from the end record, then checks each local header. */
function unzip(buf: Uint8Array): { name: string; data: Uint8Array; crc: number }[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocd = buf.length - 22;
  expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
  const n = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOff = dv.getUint32(eocd + 16, true);
  expect(cdOff + cdSize).toBe(eocd);
  const out: { name: string; data: Uint8Array; crc: number }[] = [];
  let p = cdOff;
  for (let i = 0; i < n; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    expect(dv.getUint16(p + 10, true)).toBe(0); // stored
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 20, true);
    expect(dv.getUint32(p + 24, true)).toBe(size);
    const nameLen = dv.getUint16(p + 28, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen;
    expect(dv.getUint32(local, true)).toBe(0x04034b50);
    expect(dv.getUint32(local + 14, true)).toBe(crc);
    expect(dec(buf.subarray(local + 30, local + 30 + nameLen))).toBe(name);
    const start = local + 30 + nameLen + dv.getUint16(local + 28, true);
    out.push({ name, crc, data: buf.subarray(start, start + size) });
  }
  expect(p).toBe(eocd);
  return out;
}

describe('crc32', () => {
  it('matches the standard check values', () => {
    expect(crc32(enc('123456789'))).toBe(0xcbf43926);
    expect(crc32(enc(''))).toBe(0);
    expect(crc32(enc('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

describe('zip', () => {
  it('writes an archive whose headers, directory and CRCs read back', () => {
    const files = [
      { path: 'rtl/adder.sv', data: 'module adder(input a, output y);\n  assign y = a;\nendmodule\n' },
      { path: 'README.md', data: '# Café ✓\n' },
      { path: 'empty.txt', data: '' },
    ];
    const buf = zip(files);
    const back = unzip(buf);
    expect(back.map((f) => f.name)).toEqual(files.map((f) => f.path));
    back.forEach((f, i) => {
      expect(dec(f.data)).toBe(files[i].data);
      expect(f.crc).toBe(crc32(enc(files[i].data)));
    });
    expect(back[0].crc).toBe(crc32(enc(files[0].data)));
  });

  it('stores a known string with its known CRC', () => {
    const [f] = unzip(zip([{ path: 'check.txt', data: '123456789' }]));
    expect(f.crc).toBe(0xcbf43926);
    expect(dec(f.data)).toBe('123456789');
  });

  it('is reproducible', () => {
    const a = zip([{ path: 'a', data: 'x' }]), b = zip([{ path: 'a', data: 'x' }]);
    expect([...a]).toEqual([...b]);
  });
});

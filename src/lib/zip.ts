// A minimal store-only (no compression) ZIP writer, enough to hand the player a project folder as one download.
// Format: PKWARE APPNOTE 4.3.x. Every entry is a local file header + the raw bytes; a central directory and an
// end-of-central-directory record follow. Names are UTF-8 (general purpose flag bit 11).

export interface ZipEntry { path: string; data: string | Uint8Array }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE 802.3, the one ZIP and gzip use). crc32("123456789") = 0xCBF43926. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** DOS date and time for the entries: a fixed stamp keeps the output reproducible (2026-01-01 00:00). */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** Build a .zip archive holding `entries`, stored without compression. */
export function zip(entries: ZipEntry[]): Uint8Array {
  const files = entries.map((e) => {
    const name = utf8(e.path.replace(/^\/+/, ''));
    const data = typeof e.data === 'string' ? utf8(e.data) : e.data;
    return { name, data, crc: crc32(data) };
  });
  const localSize = files.reduce((n, f) => n + 30 + f.name.length + f.data.length, 0);
  const centralSize = files.reduce((n, f) => n + 46 + f.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const dv = new DataView(out.buffer);
  let p = 0;
  const u16 = (v: number) => { dv.setUint16(p, v, true); p += 2; };
  const u32 = (v: number) => { dv.setUint32(p, v >>> 0, true); p += 4; };
  const bytes = (b: Uint8Array) => { out.set(b, p); p += b.length; };

  const offsets: number[] = [];
  for (const f of files) {
    offsets.push(p);
    u32(0x04034b50); // local file header signature
    u16(20); // version needed to extract (2.0)
    u16(0x0800); // flags: UTF-8 names
    u16(0); // method: stored
    u16(DOS_TIME); u16(DOS_DATE);
    u32(f.crc); u32(f.data.length); u32(f.data.length);
    u16(f.name.length); u16(0); // name length, extra length
    bytes(f.name);
    bytes(f.data);
  }
  const cdStart = p;
  files.forEach((f, i) => {
    u32(0x02014b50); // central directory header signature
    u16(20); u16(20); // version made by, version needed
    u16(0x0800); u16(0);
    u16(DOS_TIME); u16(DOS_DATE);
    u32(f.crc); u32(f.data.length); u32(f.data.length);
    u16(f.name.length); u16(0); u16(0); // name, extra, comment lengths
    u16(0); u16(0); // disk number start, internal attributes
    u32(0); // external attributes
    u32(offsets[i]);
    bytes(f.name);
  });
  u32(0x06054b50); // end of central directory record
  u16(0); u16(0); // this disk, disk where the central directory starts
  u16(files.length); u16(files.length); // entries on this disk, entries in total
  u32(centralSize); u32(cdStart); // central directory size and offset
  u16(0); // comment length
  return out;
}

/** Offer `bytes` to the browser as a file download. */
export function download(name: string, bytes: Uint8Array, type = 'application/zip'): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

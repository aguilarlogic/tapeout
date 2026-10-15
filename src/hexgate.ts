// Hexadecimal is taught late, on purpose: it is a shorthand for long binary, so the player meets it when the chip first
// needs it (the 7-segment decoder level), not in hour one. Until then nothing the player sees may use it, and the
// hex tiers of the practice sets wait for a spaced gap after the lesson instead of following it straight away.
import { levelRecord } from './state';

/** The lesson that teaches hexadecimal. */
export const HEX_LESSON = 'hex';

/** Hex in any form a beginner would trip on: 0x1F, Verilog 8'h1F, the word hex/hexadecimal, a nibble. */
export const HEX_PATTERN = /\b0x[0-9a-f]+\b|\d*'s?h[0-9a-f_]+|\bhex(adecimal)?\b|\bnibbles?\b/i;

/** Hex practice waits this long after the lesson, so the table is recalled rather than just repeated. */
export const HEX_GAP_MS = 12 * 60 * 60 * 1000;

/** Every string reachable from a value (functions are skipped), so nothing a player can read is missed. */
export function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

export const usesHex = (v: unknown): boolean => strings(v).some((t) => HEX_PATTERN.test(t));

/** The hex lesson is done: hex shows up in minigames and later lessons. */
export const hexTaught = (): boolean => !!levelRecord(HEX_LESSON);

/** The lesson is done and the gap has passed: practice sets may use hex. */
export function hexUnlocked(now = Date.now()): boolean {
  const rec = levelRecord(HEX_LESSON);
  return !!rec && now - rec.at >= HEX_GAP_MS;
}

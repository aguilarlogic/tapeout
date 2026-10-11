// A wrong placement says where the part's role points, in one line, without giving the slot away (U55).
import { describe, expect, it } from 'vitest';
import { misplacedMessage, PART_HINTS, UVM_PUZZLES } from './puzzles';

describe('UVM Builder placement hints', () => {
  const parts = UVM_PUZZLES.flatMap((p) => (p.kind === 'arch' ? p.palette.map((c) => ({ puzzle: p.id, ...c })) : []));

  it('every part type has one hint line', () => {
    expect(parts.length).toBeGreaterThan(0);
    for (const c of parts) {
      const hint = PART_HINTS[c.id];
      expect(hint, `${c.puzzle}: ${c.id} needs a hint`).toBeTruthy();
      expect(hint.includes('\n'), `${c.id}: one line`).toBe(false);
      expect(hint.endsWith('.'), `${c.id}: a sentence`).toBe(true);
      expect(hint.length, `${c.id}: short enough to read in a toast`).toBeLessThanOrEqual(200);
    }
  });

  it('the miss message names the part and carries its hint', () => {
    const msg = misplacedMessage('uvm_monitor', 'mon');
    expect(msg.startsWith("uvm_monitor doesn't belong here. ")).toBe(true);
    expect(msg).toContain(PART_HINTS.mon);
  });

  it('a hint does not name the slot it belongs in', () => {
    for (const c of parts) expect(PART_HINTS[c.id]).not.toMatch(/\bs-[a-z]+\b/);
  });
});

// C1: the crv-boss drill claims `len inside {[64:1500]}` on an 8-bit len is unsatisfiable. It is satisfiable (64..255);
// this runs the exact class through the game's SV engine so the drill can never drift from the engine again.
import { describe, expect, it } from 'vitest';
import { runSv } from '../games/sv/run';
import { crvBoss } from './verification';

describe('C1: constraint drill', () => {
  it('randomize() succeeds with 64 <= len <= 255 and short_pkt == 0 over 50 seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = runSv(`
class pkt;
  rand bit [7:0] len;
  rand bit       short_pkt;
  constraint c_short { short_pkt -> len < 4; }
  constraint c_eth { len inside {[64:1500]}; }
endclass
module tb;
  initial begin
    pkt p = new;
    $display("%0d %0d %0d", p.randomize(), p.len, p.short_pkt);
    $finish;
  end
endmodule`, { maxTime: 1000, seed });
      expect(r.parseError).toBeUndefined();
      const [ok, len, sp] = r.log[0].split(' ').map(Number);
      expect(ok, `seed ${seed}`).toBe(1);
      expect(len).toBeGreaterThanOrEqual(64);
      expect(len).toBeLessThanOrEqual(255);
      expect(sp).toBe(0);
    }
  });

  it('the drill teaches the satisfiable answer', () => {
    const q = crvBoss.steps.find((s) => s.t === 'mc' && /c_eth/.test(s.q));
    expect(q && q.t === 'mc' && q.options[q.a]).toMatch(/succeeds/);
  });
});

// Every rule that changes a minigame's score must be stated to the player before they play.
import { describe, expect, it } from 'vitest';
import { BITFLIP_LIMIT_S, MINIGAMES } from './apps';

const blurb = (id: string) => MINIGAMES.find((g) => g.id === id)!.blurb;

describe('minigame scoring rules are on screen', () => {
  it('every game says what earns a point', () => {
    for (const g of MINIGAMES) expect(g.blurb, g.id).toMatch(/point|scores?\b/i);
  });

  it('Bit Flipper names its clock (and the clock is drawn on screen during a round)', () => {
    expect(BITFLIP_LIMIT_S).toBe(15);
    expect(blurb('bitflip')).toContain(`${BITFLIP_LIMIT_S} seconds`);
  });

  it('games that only score on the first check say so', () => {
    for (const id of ['truth', 'fftrace', 'handshake']) expect(blurb(id), id).toMatch(/first (try|check|time)/i);
  });
});

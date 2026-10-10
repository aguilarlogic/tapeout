import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../../state';
import { CARDS, DECKS } from './cards';
import { deckRows, deckStats } from './stats';

const NOW = Date.UTC(2026, 9, 10);
const DAY = 86400000;
const seen = (id: string, due: number, box = 1): Record<string, CardRecord> => ({ [id]: { box, due, seen: 1, correct: 1 } });

describe('flashcard counts', () => {
  it('a fresh profile has no due cards: every card is new', () => {
    const s = deckStats(CARDS, {}, NOW);
    expect(s).toEqual({ total: CARDS.length, seen: 0, fresh: CARDS.length, due: 0, mastered: 0 });
  });

  it('a card with a record is due only once its time has passed', () => {
    expect(deckStats(CARDS, seen(CARDS[0].id, NOW + DAY), NOW).due).toBe(0);
    expect(deckStats(CARDS, seen(CARDS[0].id, NOW - 1), NOW).due).toBe(1);
  });

  it('a seen card leaves the new count, and three right in a row (box 3) counts as mastered', () => {
    const s = deckStats(CARDS, seen(CARDS[0].id, NOW + DAY, 3), NOW);
    expect(s.fresh).toBe(CARDS.length - 1);
    expect(s.mastered).toBe(1);
  });
});

describe('deck order', () => {
  it('lists decks the player has studied first, and marks the rest as previews', () => {
    expect(deckRows(DECKS, () => false).every((r) => r.preview)).toBe(true);
    const arch = DECKS.find((d) => d.id === 'arch')!.id;
    const rows = deckRows(DECKS, (id) => id === arch);
    expect(rows[0].d.id).toBe(arch);
    expect(rows[0].preview).toBe(false);
    expect(rows.slice(1).every((r) => r.preview)).toBe(true);
    expect(rows.map((r) => r.d.id).sort()).toEqual(DECKS.map((d) => d.id).sort());
  });
});

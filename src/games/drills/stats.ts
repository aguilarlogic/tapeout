// Flashcard counts and deck order for the Interview Gauntlet. Pure, so the rules can be tested without the page.
import type { CardRecord } from '../../state';
import type { Card } from './cards';

/** A card with no record has never been shown: it is new, not due. Only seen cards can be due. */
export function deckStats(cards: Card[], records: Record<string, CardRecord>, now: number) {
  const seen = cards.filter((c) => !!records[c.id]);
  return {
    total: cards.length,
    seen: seen.length,
    fresh: cards.length - seen.length,
    due: seen.filter((c) => records[c.id].due <= now).length,
    mastered: cards.filter((c) => (records[c.id]?.box ?? 0) >= 3).length,
  };
}

/** Decks the player has studied come first, in their order; decks for topics not met yet follow, as previews. */
export function deckRows<D extends { id: string }>(decks: D[], studied: (id: string) => boolean) {
  return decks.map((d) => ({ d, preview: !studied(d.id) })).sort((a, b) => Number(a.preview) - Number(b.preview));
}

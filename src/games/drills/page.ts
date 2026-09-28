import { complete, load, updateCard } from '../../state';
import { mentorSay } from '../../os/mentor';
import { pace } from '../../term/terminal';
import { typeOnPage } from '../../term/typewriter';
import { h } from '../../ui/dom';
import { Card, CARDS, DECKS } from './cards';

const SESSION = 10;

export function drillsPage(deckParam?: string): HTMLElement {
  const root = h('div', { class: 'level drills' });

  const mastery = (deck?: string) => {
    const p = load();
    const cards = CARDS.filter((c) => !deck || c.deck === deck);
    const mastered = cards.filter((c) => (p.cards[c.id]?.box ?? 0) >= 3).length;
    const due = cards.filter((c) => (p.cards[c.id]?.due ?? 0) <= Date.now()).length;
    return { total: cards.length, mastered, due };
  };

  const home = () => {
    const all = mastery();
    root.replaceChildren(
      h('header', { class: 'level-head' },
        h('nav', { class: 'crumbs' }, h('a', { href: '#/map' }, 'Map'), ' / Interview Prep'),
        h('div', { class: 'title-row' }, h('h2', null, 'Interview Prep'))),
      h('p', { class: 'lede' }, 'Spaced repetition: cards you miss come back in a minute, cards you know come back in 1, 3, 7, then 21 days. A card counts as mastered after three correct answers in a row.'),
      h('div', { class: 'deck-grid' },
        deckCard('Mixed session', `${all.due} due · ${all.mastered}/${all.total} mastered`, all.mastered / all.total, () => start()),
        ...DECKS.map((d) => {
          const m = mastery(d.id);
          return deckCard(d.name, `${m.due} due · ${m.mastered}/${m.total} mastered`, m.mastered / m.total, () => start(d.id));
        })),
    );
  };

  const deckCard = (name: string, sub: string, frac: number, onclick: () => void) =>
    h('button', { class: 'deck', onclick },
      h('b', null, name), h('span', { class: 'dim' }, sub),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${Math.round(frac * 100)}%` })));

  const start = (deck?: string) => {
    const p = load();
    const now = Date.now();
    const pool = CARDS.filter((c) => !deck || c.deck === deck);
    const ranked = [...pool].sort((a, b) => {
      const ra = p.cards[a.id], rb = p.cards[b.id];
      const ka = ra ? (ra.due <= now ? 0 : 2) : 1, kb = rb ? (rb.due <= now ? 0 : 2) : 1;
      if (ka !== kb) return ka - kb;
      return (ra?.due ?? 0) - (rb?.due ?? 0) || Math.random() - 0.5;
    });
    const session = ranked.slice(0, SESSION);
    let i = 0, right = 0;
    const show = () => {
      if (i >= session.length) return summary();
      ask(session[i], (ok) => { if (ok) right++; i++; show(); }, i, session.length, deck);
    };
    const summary = () => {
      const frac = right / session.length;
      const gained = complete('drills', 150, frac >= 0.9 ? 3 : frac >= 0.7 ? 2 : 1);
      mentorSay(frac >= 0.9 ? `${right} of ${session.length}. Interviewers would be impressed, {name}.` : `${right} of ${session.length}. The misses come back soon: that is how they stick.`, frac >= 0.9 ? 'proud' : 'happy');
      root.replaceChildren(
        h('header', { class: 'level-head' }, h('nav', { class: 'crumbs' }, h('a', { href: '#/map' }, 'Map'), ' / ', h('a', { href: '#/drills', onclick: (e: Event) => { e.preventDefault(); home(); } }, 'Interview Prep')),
          h('div', { class: 'title-row' }, h('h2', null, 'Session complete'))),
        h('div', { class: 'panel center' },
          h('p', { class: 'big' }, `${right} / ${session.length} correct`),
          h('p', { class: 'dim' }, right === session.length ? 'Flawless. Those cards move up a box.' : 'Missed cards will come back soon - that is the point.'),
          gained ? h('p', { class: 'gain' }, `+${gained} XP`) : null,
          h('div', { class: 'modal-actions' },
            h('button', { class: 'btn ghost', onclick: home }, 'All decks'),
            h('button', { class: 'btn primary', onclick: () => start(deck) }, 'Another round'))),
      );
    };
    show();
  };

  const ask = (card: Card, done: (ok: boolean) => void, n: number, total: number, deck?: string) => {
    const order = card.c.map((_, j) => j).sort(() => Math.random() - 0.5);
    const deckName = DECKS.find((d) => d.id === card.deck)!.name;
    const explain = h('div', { class: 'explain' });
    const nextBtn = h('button', { class: 'btn primary', style: 'display:none' }, n + 1 < total ? 'Next question →' : 'Finish');
    let answered = false;
    const buttons = order.map((j) => h('button', {
      class: 'choice',
      onclick: () => {
        if (answered) return;
        answered = true;
        const ok = j === card.a;
        updateCard(card.id, ok);
        buttons.forEach((b, k) => {
          const idx = order[k];
          if (idx === card.a) b.classList.add('right');
          else if (idx === j) b.classList.add('wrong');
          (b as HTMLButtonElement).disabled = true;
        });
        explain.replaceChildren(h('p', null, h('b', null, ok ? 'Correct. ' : 'Not quite. '), card.why));
        nextBtn.onclick = () => done(ok);
        // The explanation types out first; "Next" appears once it has (any key or click finishes it).
        void typeOnPage(explain, pace(), root).then(() => {
          nextBtn.style.display = '';
          nextBtn.focus();
        });
      },
    }, card.c[j]));
    // The question and its options type out; clicks meanwhile only finish the typing, never answer.
    const posed = h('div', null, h('p', { class: 'q' }, card.q), h('div', { class: 'choices' }, ...buttons));
    root.replaceChildren(
      h('header', { class: 'level-head' },
        h('nav', { class: 'crumbs' }, h('a', { href: '#/map' }, 'Map'), ' / ', h('a', { href: '#/drills', onclick: (e: Event) => { e.preventDefault(); home(); } }, 'Interview Prep'), ` / ${deck ? DECKS.find((d) => d.id === deck)!.name : 'Mixed'}`),
        h('div', { class: 'title-row' }, h('h2', null, `Question ${n + 1} of ${total}`), h('span', { class: 'tag' }, deckName))),
      h('div', { class: 'panel card-q' }, posed, explain, h('div', { class: 'modal-actions' }, nextBtn)),
    );
    void typeOnPage(posed, pace(), root);
  };

  if (deckParam && DECKS.some((d) => d.id === deckParam)) start(deckParam);
  else home();
  return root;
}

import { rank, totalXp } from '../state';
import { findLevel } from '../tracks';
import { h, stars as starEls } from './dom';

export function nextHref(levelId: string): string {
  const f = findLevel(levelId);
  if (!f) return '#/';
  const next = f.track.levels[f.index + 1];
  return next ? next.route : `#/track/${f.track.id}`;
}

export function levelHeader(title: string, levelId: string, stars: number, xp: number): HTMLElement {
  const f = findLevel(levelId);
  const prev = f && f.track.levels[f.index - 1];
  const next = f && f.track.levels[f.index + 1];
  return h('header', { class: 'level-head' },
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/' }, 'Home'), ' / ',
      f ? h('a', { href: `#/track/${f.track.id}` }, f.track.name) : null,
      f ? ` / ${f.index + 1} of ${f.track.levels.length}` : null),
    h('div', { class: 'title-row' },
      h('h2', null, title),
      starEls(stars),
      h('span', { class: 'xp-chip' }, `${xp} XP`),
      h('span', { class: 'spacer' }),
      prev ? h('a', { class: 'btn ghost small', href: prev.route }, '← Prev') : null,
      next ? h('a', { class: 'btn ghost small', href: next.route }, 'Next →') : null),
  );
}

export function celebrate(stars: number, gained: number, notes: string[], nextRoute: string) {
  const before = rank(totalXp() - gained);
  const after = rank();
  const promoted = after.index > before.index;
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'modal-bg', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Level complete' },
      h('div', { class: 'modal-kicker' }, 'Signoff passed'),
      starEls(stars),
      h('p', { class: 'gain' }, gained > 0 ? `+${gained} XP` : 'No new XP (you already have a better result)'),
      promoted ? h('p', { class: 'promo' }, `Promoted to ${after.title}!`) : null,
      ...notes.map((n) => h('p', { class: 'dim' }, n)),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: close }, 'Stay here'),
        h('a', { class: 'btn primary', href: nextRoute, onclick: close }, 'Continue →')),
    ),
  );
  document.body.append(overlay);
  (overlay.querySelector('a.btn') as HTMLElement)?.focus();
}

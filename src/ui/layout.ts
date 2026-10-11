import { findModule, KIND_LABEL, neighbours } from '../curriculum';
import { avatar, setMood } from '../os/avatar';
import { type Promotion, promotionLine } from '../mastery/promotion';
import { mentorSay } from '../os/mentor';
import { playerName } from '../state';
import { h, stars as starEls } from './dom';
import { playCue } from './sound';

export function nextHref(levelId: string): string {
  return neighbours(levelId).next?.route ?? '#/map';
}

export function levelHeader(title: string, levelId: string, stars: number, xp: number): HTMLElement {
  const f = findModule(levelId);
  const { prev, next } = neighbours(levelId);
  return h('header', { class: 'level-head' },
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/map' }, 'Map'),
      f ? ` / Act ${f.act.n} · ${f.act.name} / ${f.chapter.name} · ${KIND_LABEL[f.module.kind]}` : null),
    h('div', { class: 'title-row' },
      h('h2', null, title),
      starEls(stars),
      h('span', { class: 'xp-chip' }, `${xp} XP`),
      h('span', { class: 'spacer' }),
      prev ? h('a', { class: 'btn ghost small', href: prev.route, title: prev.title }, '← Prev') : null,
      next ? h('a', { class: 'btn ghost small', href: next.route, title: next.title }, 'Next →') : null),
  );
}

const PRAISE: Record<number, string[]> = {
  3: ['Three stars. I could not have done it better myself. (I could have, but still.)', 'Clean signoff. Ship it.'],
  2: ['Signed off. There is a star left on the table if you want to come back for it.', 'Good work, {name}. Solid pass.'],
  1: ['It passes, and passing is what tapes out. Come back for more stars once it clicks.', 'Done! Replay it later to polish it.'],
};
// Three-star praise matched to how hard the level is (its base XP): a first wire is not senior-engineer work.
const PRAISE_EASY = ['Clean, {name}. First try, no hints.', 'That is exactly how it works. Nicely done.'];
const PRAISE_HARD = ['Flawless, {name}. That is senior-engineer work.', 'Three stars on that one. Real engineers miss what you just caught.'];

export function praise(stars: number, baseXp?: number): string[] {
  if (stars === 3 && baseXp !== undefined && baseXp < 100) return PRAISE_EASY;
  if (stars === 3 && baseXp !== undefined && baseXp >= 250) return PRAISE_HARD;
  return PRAISE[stars] ?? PRAISE[1];
}

export function celebrate(stars: number, gained: number, notes: string[], nextRoute: string, promoted?: Promotion, baseXp?: number) {
  const lines = praise(stars, baseXp);
  const line = lines[Math.floor(Math.random() * lines.length)].replace(/\{name\}/g, playerName());
  setMood(stars === 3 ? 'proud' : 'happy');
  playCue(promoted ? 'promote' : 'pass');
  mentorSay(promoted ? `${line} ${promotionLine(promoted)}` : line, promoted ? 'excited' : stars === 3 ? 'proud' : 'happy');
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'modal-bg', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Level complete' },
      h('div', { class: 'modal-av' }, avatar(64)),
      h('div', { class: 'modal-kicker' }, 'Signoff passed'),
      starEls(stars),
      h('p', { class: 'modal-say' }, line),
      h('p', { class: 'gain' }, gained > 0 ? `+${gained} XP` : 'No new XP (you already have a better result)'),
      promoted ? h('p', { class: 'promo' }, `Promoted to ${promoted.title}!`) : null,
      ...notes.map((n) => h('p', { class: 'dim' }, n)),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: close }, 'Stay here'),
        h('a', { class: 'btn primary', href: nextRoute, onclick: close }, 'Continue →')),
    ),
  );
  document.body.append(overlay);
  (overlay.querySelector('a.btn') as HTMLElement)?.focus();
}

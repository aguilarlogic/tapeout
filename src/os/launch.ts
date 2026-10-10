// Opening minigame windows. Lessons await the result; the arcade just lets you play.
import { award, promotionLine } from '../mastery/promotion';
import { findGame, MINIGAMES, STARS_AT } from '../minigames/apps';
import { recordBest } from '../state';
import { h, stars } from '../ui/dom';
import { mentorSay } from './mentor';
import { openWindow } from './wm';

export const MINI_XP = 40;

export interface GameResult { score: number; max: number }

export function launchGame(id: string, opts: { rounds?: number; fromLesson?: boolean } = {}): Promise<GameResult | null> {
  const game = findGame(id);
  if (!game) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    let last: GameResult | null = null;
    const settle = (r: GameResult | null) => { if (!settled) { settled = true; resolve(r); } };
    const host = h('div', { class: 'mg-host' });
    const content = h('div', { class: 'mg-window' },
      h('div', { class: 'mg-intro' }, h('span', { class: 'mg-icon' }, game.icon), h('div', null, h('b', null, game.title), h('p', { class: 'dim' }, game.blurb))),
      host);
    const win = openWindow({
      id: 'mini', title: `${game.title}.app`, icon: game.icon, content, w: 620, h: 600, loading: `${game.title}.app`,
      onClose: () => settle(last),
    });
    const run = () => game.play({
      host,
      r: Math.random,
      rounds: opts.rounds ?? game.rounds,
      say: (t, m) => mentorSay(t, m),
      finish: (score, max) => {
        last = { score, max };
        const frac = max ? score / max : 0;
        const st = frac >= STARS_AT.three ? 3 : frac >= STARS_AT.two ? 2 : 1;
        const aw = award(`mini.${game.id}`, MINI_XP, st);
        const gained = aw.gained;
        const best = recordBest(game.id, Math.round(frac * 100));
        mentorSay(frac >= 0.9 ? `${score} out of ${max}. You are getting dangerous, {name}.` : frac >= 0.6 ? `${score} out of ${max}. Solid. A couple more rounds and it will be automatic.` : `${score} out of ${max}. That is how everyone starts. Try it again sometime.`, frac >= 0.9 ? 'excited' : frac >= 0.6 ? 'happy' : 'concerned');
        if (aw.promotedTo) mentorSay(promotionLine(aw.promotedTo), 'excited');
        host.replaceChildren(h('div', { class: 'mg-result' },
          h('div', { class: 'big' }, `${score} / ${max}`),
          stars(st),
          h('p', null, gained ? `+${gained} XP` : 'No new XP (you already did better)', best ? ' · new personal best!' : ''),
          h('div', { class: 'modal-actions' },
            h('button', { class: 'btn ghost', onclick: run }, 'Play again'),
            h('button', { class: 'btn primary', onclick: () => { win.close(); settle({ score, max }); } }, opts.fromLesson ? 'Back to the lesson →' : 'Close'))));
        if (!opts.fromLesson) settle({ score, max });
      },
    });
    run();
  });
}

export function randomGame(): string {
  return MINIGAMES[Math.floor(Math.random() * MINIGAMES.length)].id;
}

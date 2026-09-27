// TAPEOUT's face: a little chip with LED eyes. Every avatar on screen shares one mood.
import type { Mood } from '../lessons/types';
import { svg } from '../ui/dom';

let mood: Mood = 'neutral';
let talking = false;
// Renderers return false once their avatar has left the page, so they can be dropped.
const instances = new Set<(m: Mood, t: boolean) => boolean>();
const update = () => instances.forEach((f) => { if (!f(mood, talking)) instances.delete(f); });

export function setMood(m: Mood) {
  mood = m;
  update();
}
export function setTalking(t: boolean) {
  if (t === talking) return;
  talking = t;
  update();
}
export const currentMood = () => mood;

// Eye and mouth shapes per mood, drawn on a 64x64 chip body at (18, 18).
const EYES: Record<Mood, string> = {
  neutral: 'M36 40h7v9h-7z M57 40h7v9h-7z',
  happy: 'M35 47q4.5-8 9 0 M56 47q4.5-8 9 0',
  excited: 'M34 38h10v12h-10z M55 38h10v12h-10z',
  thinking: 'M36 44h8v3h-8z M57 40h7v9h-7z',
  concerned: 'M36 42h7v8h-7z M57 42h7v8h-7z M34 38l9 2 M66 38l-9 2',
  proud: 'M35 45q4.5 5 9 0 M56 45q4.5 5 9 0',
  wink: 'M36 40h7v9h-7z M56 46h9',
};
const MOUTH: Record<Mood, string> = {
  neutral: 'M43 60h14',
  happy: 'M41 58q9 8 18 0',
  excited: 'M42 57q8 10 16 0z',
  thinking: 'M45 61q5-3 10 0',
  concerned: 'M42 62q8-6 16 0',
  proud: 'M40 57q10 9 20 0',
  wink: 'M42 58q8 6 16 0',
};

export function avatar(size = 72, label = 'TAPEOUT, your mentor'): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 100 100', width: size, height: size, class: 'avatar', role: 'img', 'aria-label': label });
  const pins = svg('g', { class: 'av-pins' });
  for (let i = 0; i < 4; i++) {
    const o = 26 + i * 14;
    pins.append(
      svg('rect', { x: o, y: 8, width: 6, height: 10, rx: 1 }), svg('rect', { x: o, y: 82, width: 6, height: 10, rx: 1 }),
      svg('rect', { x: 8, y: o, width: 10, height: 6, rx: 1 }), svg('rect', { x: 82, y: o, width: 10, height: 6, rx: 1 }),
    );
  }
  const body = svg('rect', { x: 18, y: 18, width: 64, height: 64, rx: 9, class: 'av-body' });
  const notch = svg('circle', { cx: 28, cy: 28, r: 3, class: 'av-notch' });
  const eyes = svg('path', { class: 'av-eyes' });
  const mouth = svg('path', { class: 'av-mouth' });
  root.append(pins, body, notch, eyes, mouth);
  let seen = false;
  const render = (m: Mood, t: boolean) => {
    if (root.isConnected) seen = true;
    else if (seen) return false;
    eyes.setAttribute('d', EYES[m]);
    mouth.setAttribute('d', MOUTH[m]);
    root.classList.toggle('talking', t);
    root.dataset.mood = m;
    return true;
  };
  render(mood, talking);
  instances.add(render);
  return root;
}

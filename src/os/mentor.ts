// TAPEOUT speaking from anywhere: a speech bubble in the corner of the desktop, mirrored into the terminal log.
import type { Mood } from '../lessons/types';
import { rich } from '../term/terminal';
import { h } from '../ui/dom';
import { avatar, setMood } from './avatar';
import { focusedWindow } from './wm';

let log: ((text: string) => void) | null = null;
let bubble: HTMLElement | null = null;
let timer = 0;

export function bindMentorLog(fn: (text: string) => void) {
  log = fn;
}

export function mentorSay(text: string, mood: Mood = 'neutral') {
  setMood(mood);
  log?.(text);
  if (focusedWindow() === 'term') return; // the player is already looking at the terminal
  bubble?.remove();
  clearTimeout(timer);
  const close = () => { bubble?.classList.add('bye'); setTimeout(() => bubble?.remove(), 250); };
  bubble = h('div', { class: 'mentor-bubble', role: 'status', onclick: close },
    avatar(44),
    h('div', { class: 'mb-text' }, h('b', null, 'tapeout'), h('span', null, ...rich(text))));
  document.body.append(bubble);
  timer = window.setTimeout(close, Math.max(5000, text.length * 55));
}

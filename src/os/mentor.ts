// TAPEOUT speaking from anywhere: a speech bubble in the corner of the desktop, mirrored into the terminal log.
import type { Mood } from '../lessons/types';
import { pace, rich } from '../term/terminal';
import { type Token, typeInto } from '../term/typewriter';
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
  const me = h('div', { class: 'mentor-bubble', role: 'status' });
  const close = () => { me.classList.add('bye'); setTimeout(() => me.remove(), 250); };
  // The first click finishes the typing; the next one closes the bubble.
  const tk: Token = { skip: false };
  let typing = true;
  me.addEventListener('click', () => (typing ? (tk.skip = true) : close()));
  const body = h('span', null, ...rich(text));
  me.append(avatar(44), h('div', { class: 'mb-text' }, h('b', null, 'tapeout'), body));
  bubble = me;
  document.body.append(me);
  void typeInto(body, pace(), tk).then(() => {
    typing = false;
    if (bubble === me) timer = window.setTimeout(close, Math.max(5000, text.length * 55));
  });
}

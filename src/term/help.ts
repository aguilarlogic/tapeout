// What `help` lists: the commands, and the window keys that work outside the terminal (kept in step with os/keys.ts).
import { GLOSSARY } from '../glossary';
import { PRACTICE_COUNT } from '../practice/types';

export const HELP_ROWS: [string, string][] = [
  ['next', 'continue where TAPEOUT recommends'],
  ['map', 'open the campaign map'],
  ['ls [act]', 'list the curriculum (e.g. `ls 3`)'],
  ['learn <name>', 'open any lesson or lab (e.g. `learn cache`)'],
  ['resume', 'pick up a lesson that a reload interrupted'],
  ['play [game]', 'the arcade: minigames TAPEOUT built'],
  ['quiz', 'a quick interview question'],
  ['practice [skill]', `${PRACTICE_COUNT} scored problems per set; no argument = a daily mix; --endless keeps going`],
  ['skills [role]', 'your skill matrix: every topic, levels 0-3'],
  ['roles [role]', 'job readiness for every role (DV, PD, quantum…)'],
  ['goal <role>', 'steer your path and Skills.app towards a role, e.g. `goal dv`'],
  ['boss [name]', 'list or start boss fights (no hints)'],
  ['incidents [name]', 'on-call investigations: find the root cause against the clock'],
  ['what is <term>', `look up any of ${GLOSSARY.length} terms`],
  ['status', 'your rank, XP and progress'],
  ['career', 'your rank story, the roles you are hired for, the next hiring panel'],
  ['speed <s>', 'how fast I type: slow | normal | fast | instant'],
  ['settings', 'open Settings.app: typing speed, text size, motion, backups'],
  ['name <n>', 'change your name'],
  ['clear', 'clear the screen'],
];

/** Keys that work in the windows. Settings.app lists the full set. */
export const HELP_KEYS: [string, string][] = [
  ['Escape', 'close the focused window (not while you are typing in the terminal or a field)'],
  ['Alt + `', 'cycle through the open windows; add Shift to go back'],
];

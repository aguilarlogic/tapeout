import { ARCH_LESSONS } from './arch';
import { CIRCUIT_LESSONS } from './circuits';
import { SIGNAL_LESSONS } from './signals';
import { STATS_LESSONS } from './stats';
import { TOOLING_LESSONS } from './tooling';
import { DIGITAL_LESSONS } from './digital';
import { FOUNDATION_LESSONS } from './foundations';
import { FRONTIER_LESSONS } from './frontier';
import { MATH_LESSONS } from './math';
import { PHYSICS_LESSONS } from './physics';
import { QUANTUM_LESSONS } from './quantum';
import { ROLE_LESSONS } from './roles';
import { SYSTEMS_LESSONS } from './systems';
import { Lesson, Question, Rng, Step } from './types';
import { VERIF_LESSONS } from './verification';
import { VLSI_LESSONS } from './vlsi';

/** Acts 1-6: the path every chip engineer walks. The final review draws from these. */
export const CORE_LESSONS: Lesson[] = [
  ...FOUNDATION_LESSONS, ...MATH_LESSONS, ...STATS_LESSONS, ...CIRCUIT_LESSONS, ...SIGNAL_LESSONS, ...PHYSICS_LESSONS,
  ...TOOLING_LESSONS, ...SYSTEMS_LESSONS, ...DIGITAL_LESSONS, ...VLSI_LESSONS, ...VERIF_LESSONS, ...ARCH_LESSONS,
];

export const LESSONS: Lesson[] = [...CORE_LESSONS, ...ROLE_LESSONS, ...QUANTUM_LESSONS, ...FRONTIER_LESSONS];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** Every question a lesson can ask, materialized with the given RNG. */
export function questionsOf(l: Lesson, r: Rng): Question[] {
  return l.steps.flatMap((s): Question[] => (s.t === 'ask' || s.t === 'mc' ? [s] : s.t === 'gen' ? [s.make(r)] : []));
}

export const FINAL_ID = 'final';
export const FINAL_XP = 400;
export const FINAL_COUNT = 15;

/** The final review: one question from each of FINAL_COUNT different lessons, spread across the whole curriculum. */
export function finalExam(r: Rng): Lesson {
  const pool = [...CORE_LESSONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, FINAL_COUNT).sort((a, b) => CORE_LESSONS.indexOf(a) - CORE_LESSONS.indexOf(b));
  const steps: Step[] = [
    { t: 'say', text: 'Final review, {name}. Fifteen questions, one from each corner of the stack, in order from electrons to architecture. No hints this time. Take your time.', mood: 'thinking' },
  ];
  for (const l of chosen) {
    const qs = questionsOf(l, r);
    const q = qs[Math.floor(r() * qs.length)];
    steps.push({ t: 'say', text: `**${l.title}**` }, { ...q, ...(q.t === 'ask' ? { hint: undefined } : {}) });
  }
  steps.push({ t: 'say', text: 'That is the last one. Let me grade it.', mood: 'neutral' });
  return { id: FINAL_ID, title: 'Tapeout Review', concept: 'everything', xp: FINAL_XP, steps, recap: [] };
}

// Role capstones: the hiring panel for each role. Every question is drawn fresh, at the hard level, from the role's own
// material (its practice sets, then the boss exams of its skills, then the foundations), so the exam differs on every
// attempt and cannot be memorised.
import { gen, say, type AskStep, type McStep, type Question, type Rng, type Step } from '../lessons/types';
import { ROLES, SKILLS, type Role } from '../mastery/skills';
import { findBoss } from './index';
import { boss, type Boss, type PracticeSet } from './types';
import { shuffle } from './util';

const PANEL = 12;
/** A role with fewer own practice sets than this is thin: its panel is padded from its boss exams. */
const THIN = 4;
/** A thin role's panel asks this many questions from its own sets; the rest come from its boss exams. */
const THIN_OWN = 6;
/** At most this many questions of a thin role's panel come from the foundations ('all') sets. */
const FOUNDATIONS = 2;

/** A padding item from a boss exam: a generator as it stands, or one fixed question (ask or mc) from the boss. */
type BossItem = Extract<Step, { t: 'gen' }> | AskStep | McStep;

/** One question of a panel before it is drawn: a practice set to generate from, or a boss exam item. */
export type Slot = { kind: 'set'; set: PracticeSet; foundation: boolean } | { kind: 'boss'; item: BossItem };

const mineOf = (role: Role) => SKILLS.filter((s) => s.roles !== 'all' && s.roles.includes(role.id));

/** The practice sets a role's panel can draw from: its own, and the foundations it may fall back on. */
function setsFor(role: Role, practice: PracticeSet[]) {
  const byId = new Map(practice.map((p) => [p.id, p]));
  const setsOf = (ids: string[]) => [...new Set(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])))];
  const own = setsOf(mineOf(role).flatMap((s) => s.practice));
  const foundation = setsOf(SKILLS.filter((s) => s.roles === 'all').flatMap((s) => s.practice)).filter((p) => !own.includes(p));
  return { own, foundation };
}

/** Every boss exam item a role can be padded with, each fixed question once (by its text). Looked up at exam time. */
function bossItemsFor(role: Role): BossItem[] {
  const ids = [...new Set(mineOf(role).flatMap((s) => s.boss).filter((id) => id.startsWith('boss-')))];
  const seen = new Set<string>();
  return ids.flatMap((id) => findBoss(id)?.steps ?? []).flatMap((s): BossItem[] => {
    if (s.t === 'gen') return [s];
    if (s.t !== 'ask' && s.t !== 'mc') return [];
    if (seen.has(s.q)) return [];
    seen.add(s.q);
    return [s];
  });
}

/**
 * Deal one attempt's panel: which practice sets and which boss exam items its questions come from. The run's RNG
 * decides everything. Own sets are shuffled once and taken round-robin, so every set is reachable and none repeats
 * before all have appeared. A thin role is padded from its boss exams first, then the foundations (at most 2).
 */
export function panelPlan(role: Role, practice: PracticeSet[], r: Rng): Slot[] {
  const { own, foundation } = setsFor(role, practice);
  const bossItems = shuffle(r, bossItemsFor(role));
  const target = own.length === 0 ? 0 : own.length < THIN ? THIN_OWN : PANEL;
  const bossSlots = Math.min(PANEL - target, bossItems.length);
  const foundationSlots = foundation.length ? Math.min(own.length ? FOUNDATIONS : PANEL, PANEL - target - bossSlots) : 0;
  // any slots nobody else can fill go back to the role's own sets
  const ownSlots = PANEL - bossSlots - foundationSlots;
  const ownOrder = shuffle(r, own), foundationOrder = shuffle(r, foundation);
  const slots: Slot[] = [
    ...(own.length ? Array.from({ length: ownSlots }, (_, i) => ({ kind: 'set' as const, set: ownOrder[i % own.length], foundation: false })) : []),
    ...Array.from({ length: foundationSlots }, (_, i) => ({ kind: 'set' as const, set: foundationOrder[i % foundation.length], foundation: true })),
    ...bossItems.slice(0, bossSlots).map((item) => ({ kind: 'boss' as const, item })),
  ];
  return shuffle(r, slots);
}

/** Turn one slot into a question for the exam: no hints and no teaching beats, as in every other exam. */
function realize(slot: Slot, r: Rng): Question {
  if (slot.kind === 'set') return { ...slot.set.gens[Math.floor(r() * slot.set.gens.length)](r, 3), teach: undefined };
  const it = slot.item;
  if (it.t === 'gen') return { ...it.make(r), teach: undefined };
  return it.t === 'ask' ? { ...it, hint: undefined, teach: undefined } : { ...it, teach: undefined };
}

/** The panel's makeup in words, for the description. Must match what panelPlan deals (see career.test.ts). */
function makeupOf(own: number): string {
  if (own === 0) return `${PANEL} hard questions from the boss exams for your skills`;
  if (own < THIN) return `${PANEL} hard questions: ${THIN_OWN} from your ${own === 1 ? '1 skill set' : `${own} skill sets`}, the other ${PANEL - THIN_OWN} from your boss exams (at most ${FOUNDATIONS} from the foundations)`;
  if (own > PANEL) return `${PANEL} hard questions from ${PANEL} of your ${own} skill sets`;
  return `${PANEL} hard questions across your ${own} skill sets`;
}

export function makeCapstones(practice: PracticeSet[]): Boss[] {
  return ROLES.map((role) => {
    const { own } = setsFor(role, practice);
    // The terminal plays a panel's steps in order, one attempt at a time: the first step deals the whole panel from
    // the run's RNG and every later step plays its own slot of that deal.
    let plan: Slot[] = [];
    const steps = Array.from({ length: PANEL }, (_, k) => gen((r) => {
      if (k === 0 || !plan[k]) plan = panelPlan(role, practice, r);
      return realize(plan[k], r);
    }));
    const thin = own.length > 0 && own.length < THIN;
    return boss({
      id: `cap-${role.id}`,
      title: `Capstone: ${role.name}`,
      concept: makeupOf(own.length),
      xp: 300,
      pass: 0.75,
      steps: [say(`This is the hiring panel for a ${role.name.toLowerCase()}. ${PANEL} questions, hard level, drawn from everything the role needs. No hints, one attempt each, and ${Math.round(0.75 * PANEL)} right gets you the job.`, 'thinking'), ...steps],
      recap: [role.blurb, `${own.length === 1 ? '1 skill set' : `${own.length} skill sets`} examined at the hard level${thin ? ', padded from the boss exams for them' : ''}.`],
    });
  });
}

// Role capstones: the hiring panel for each role. Every question is drawn fresh, at the hard level, from the practice
// sets of the skills that role needs, so the exam differs on every attempt and cannot be memorised.
import { gen, say, type Question, type Rng, type Step } from '../lessons/types';
import { ROLES, SKILLS } from '../mastery/skills';
import { boss, type Boss, type PracticeSet } from './types';

const PANEL = 12;
/** At most this many questions in a panel may come from the shared Act 1 foundations. */
const FOUNDATION_CAP = 2;
/** A role with fewer own practice sets than this is padded from its boss lessons. */
const THIN = 4;

/** What each panel slot was drawn from on the latest attempt, by boss id ("set:id", "boss:id", "static:id#i", "all:id"). For tests. */
export const CAPSTONE_TRACE = new Map<string, string[]>();

interface Source { id: string; kind: 'set' | 'boss' | 'static' | 'all'; draw: (r: Rng) => Question; once: boolean }

const noTeach = (q: Question): Question => ({ ...q, teach: undefined });
const shuffled = <T>(xs: T[], r: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export function makeCapstones(practice: PracticeSet[], bosses: Boss[] = []): Boss[] {
  const byId = new Map(practice.map((p) => [p.id, p]));
  const bossById = new Map(bosses.map((b) => [b.id, b]));
  const setsOf = (ids: string[]) => [...new Set(ids)].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const setSource = (kind: Source['kind']) => (p: PracticeSet): Source => ({ id: `${kind}:${p.id}`, kind, once: false, draw: (r) => noTeach(p.gens[Math.floor(r() * p.gens.length)](r, 3)) });
  return ROLES.map((role) => {
    const skills = SKILLS.filter((s) => s.roles !== 'all' && s.roles.includes(role.id));
    const own = setsOf(skills.flatMap((s) => s.practice));
    const common = setsOf(SKILLS.filter((s) => s.roles === 'all').flatMap((s) => s.practice));
    const bossSteps: Source[] = [...new Set(skills.flatMap((s) => s.boss).filter((id) => id.startsWith('boss-')))].flatMap((id) => (bossById.get(id)?.steps ?? []).flatMap((st: Step, i): Source[] => {
      if (st.t === 'gen') { const make = st.make; return [{ id: `boss:${id}#${i}`, kind: 'boss', once: false, draw: (r) => noTeach(make(r)) }]; }
      if (st.t === 'ask' || st.t === 'mc') { const q = st; return [{ id: `static:${id}#${i}`, kind: 'static', once: true, draw: () => noTeach(q) }]; }
      return [];
    }));
    const thin = own.length < THIN;
    const base: Source[] = [...own.map(setSource('set')), ...(thin ? bossSteps : [])];
    const foundations = thin && base.length < THIN ? common.map(setSource('all')) : [];

    /** One attempt's plan: the sources shuffled once, then dealt round-robin so none repeats before every one has appeared. */
    const plan = (r: Rng): Source[] => {
      const pool = shuffled(base, r);
      const slots: Source[] = [];
      const used = new Set<string>();
      for (let progress = true; slots.length < PANEL && progress;) {
        progress = false;
        for (const src of pool) {
          if (slots.length >= PANEL) break;
          if (src.once && used.has(src.id)) continue; // a fixed question is asked at most once per panel
          used.add(src.id);
          slots.push(src);
          progress = true;
        }
      }
      // Foundations only ever fill the tail, capped, and only for roles with too little material of their own.
      shuffled(foundations, r).slice(0, FOUNDATION_CAP).forEach((f, i) => { slots[slots.length - 1 - i] = f; });
      return shuffled(slots, r);
    };

    let current: Source[] | undefined;
    const trace: string[] = [];
    CAPSTONE_TRACE.set(`cap-${role.id}`, trace);
    const steps = Array.from({ length: PANEL }, (_, k) => gen((r) => {
      // Step 0 starts a new attempt: deal the whole panel now, so the later steps just draw from it.
      if (k === 0 || !current) { current = plan(r); trace.length = 0; }
      const s = current[k];
      trace[k] = s.id;
      return s.draw(r);
    }));
    const sourceCount = new Set([...base, ...foundations.slice(0, FOUNDATION_CAP)].map((s) => s.id.replace(/#\d+$/, ''))).size;
    return boss({
      id: `cap-${role.id}`,
      title: `Capstone: ${role.name}`,
      concept: `the hiring panel for a ${role.name.toLowerCase()}: ${PANEL} hard questions drawn from ${thin ? `${own.length} practice set${own.length === 1 ? '' : 's'} and the role's boss exams` : `${own.length} skill sets`}`,
      xp: 300,
      pass: 0.75,
      steps: [say(`This is the hiring panel for a ${role.name.toLowerCase()}. ${PANEL} questions, hard level, drawn from everything the role needs. No hints, one attempt each, and ${Math.round(0.75 * PANEL)} right gets you the job.`, 'thinking'), ...steps],
      recap: [role.blurb, `${PANEL} questions at the hard level, from ${sourceCount} areas of the role.`],
    });
  });
}

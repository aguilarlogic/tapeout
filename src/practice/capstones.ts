// Role capstones: the hiring panel for each role. Every question is drawn fresh, at the hard level, from the practice
// sets of the skills that role needs, so the exam differs on every attempt and cannot be memorised.
import { gen, say } from '../lessons/types';
import { ROLES, SKILLS } from '../mastery/skills';
import { boss, type Boss, type PracticeSet } from './types';

const PANEL = 12;

export function makeCapstones(practice: PracticeSet[]): Boss[] {
  const byId = new Map(practice.map((p) => [p.id, p]));
  const setsOf = (ids: string[]) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  return ROLES.map((role) => {
    const own = setsOf(SKILLS.filter((s) => s.roles !== 'all' && s.roles.includes(role.id)).flatMap((s) => s.practice));
    const common = setsOf(SKILLS.filter((s) => s.roles === 'all').flatMap((s) => s.practice));
    const sets = [...new Set(own.length >= 4 ? own : [...own, ...common.slice(0, 4 - own.length)])];
    // spread the questions evenly over the sets, wrapping round when there are fewer sets than questions
    const steps = Array.from({ length: PANEL }, (_, k) => {
      const set = sets[k % sets.length];
      return gen((r) => ({ ...set.gens[Math.floor(r() * set.gens.length)](r, 3), teach: undefined }));
    });
    return boss({
      id: `cap-${role.id}`,
      title: `Capstone: ${role.name}`,
      concept: `the hiring panel for a ${role.name.toLowerCase()}: ${PANEL} hard questions across ${sets.length} skills`,
      xp: 300,
      pass: 0.75,
      steps: [say(`This is the hiring panel for a ${role.name.toLowerCase()}. ${PANEL} questions, hard level, drawn from everything the role needs. No hints, one attempt each, and ${Math.round(0.75 * PANEL)} right gets you the job.`, 'thinking'), ...steps],
      recap: [role.blurb, `${sets.length} skills examined at the hard level.`],
    });
  });
}

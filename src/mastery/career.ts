// The career story: what each rank means, which roles you have been hired for, and what to aim at next.
import { levelRecord, rank, totalXp } from '../state';
import { findRole, roleReadiness, ROLES, type Role, type RoleId } from './skills';

/** One beat of the story per rank, shown when the player is promoted into it. */
export const STORY: { scope: string; line: string }[] = [
  { scope: 'Learning where everything is', line: 'You have a badge, a workstation and a mentor who lives in the terminal. Nobody expects you to know anything yet.' },
  { scope: 'Your first real tickets', line: 'People now hand you small, real tasks and trust you to ask when stuck. You can read a datasheet without panicking.' },
  { scope: 'Owning a block', line: 'A block is yours: you design it, you debug it, you answer for it in the review. Your name is on the commit.' },
  { scope: 'Owning a result', line: 'You are the person others bring the strange failures to. You can say what is wrong and what it will cost to fix.' },
  { scope: 'Owning a roadmap', line: 'You decide which problems are worth solving, and you can do it in more than one discipline. Reviews wait for you.' },
  { scope: 'Owning a product', line: 'You set direction for a chip, from the spec to the tapeout to the first customer. Your calls cost or save months.' },
  { scope: 'Shaping the field', line: 'People outside the company know your name. You have seen enough failures to recognise new ones before they happen.' },
];

export const capstoneId = (role: Role | string) => `cap-${typeof role === 'string' ? role : role.id}`;
export const isHired = (role: Role | string) => !!levelRecord(capstoneId(role));
export const hiredRoles = () => ROLES.filter(isHired);

export interface Career {
  title: string;
  scope: string;
  story: string;
  xp: number;
  next?: { title: string; need: number };
  progress: number;
  hired: Role[];
  /** Roles you are closest to being hired for, best first. The goal role, if not hired yet, leads the list. */
  closest: { role: Role; readiness: number }[];
  /** The role the player is steering towards (`goal <role>`), if they have one and are not hired for it yet. */
  goal?: { role: Role; readiness: number };
}

export function career(goalRole?: RoleId): Career {
  const xp = totalXp(), r = rank(xp), st = STORY[Math.min(r.index, STORY.length - 1)];
  const ranked = ROLES.filter((x) => !isHired(x)).map((x) => ({ role: x, readiness: roleReadiness(x.id) })).sort((a, b) => b.readiness - a.readiness);
  const goal = goalRole ? ranked.find((c) => c.role.id === goalRole) : undefined;
  return {
    title: r.title, scope: st.scope, story: st.line, xp,
    next: r.next ? { title: r.next.title, need: r.next.xp - xp } : undefined, progress: r.progress,
    hired: hiredRoles(),
    closest: goal ? [goal, ...ranked.filter((c) => c !== goal)].slice(0, 3) : ranked.slice(0, 3),
    goal,
  };
}

export const roleOfCapstone = (id: string) => (id.startsWith('cap-') ? findRole(id.slice(4)) : undefined);

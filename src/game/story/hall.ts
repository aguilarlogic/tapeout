// The Hiring Hall's panels (Phase 8 Spec, section 4): one per role, on that role's cap-* module. A panel opens when the
// role is 60% ready, the desktop's rule, or once it has a record. The drone wears a badge for each panel passed.
import { capstoneId, isHired } from '../../mastery/career';
import { ROLES, roleReadiness, type Role } from '../../mastery/skills';
import { STORY } from '../world/story';

/** The readiness a panel wants: the desktop offers the hiring panel at the same mark. */
export const PANEL_READY = 0.6;

export interface Panel { role: Role; ready: number; open: boolean; passed: boolean }

/** The panel on a cap-* module, or undefined for any other module. */
export function panelOf(module: string): Panel | undefined {
  const role = ROLES.find((r) => capstoneId(r) === module);
  if (!role) return undefined;
  const ready = roleReadiness(role.id), passed = isHired(role);
  return { role, ready, open: passed || ready >= PANEL_READY, passed };
}

/** What TAPEOUT says at a shut panel. */
export const notYet = (p: Panel) => STORY.hall.notYet.replace('{role}', p.role.name).replace('{pct}', `${Math.floor(100 * p.ready)}`);

/** Panels passed: one badge each. */
export const badges = () => ROLES.filter(isHired).length;

/** A line with {n} filled in with the panels passed (the Hall's exit). */
export const withCount = (line: string) => line.replace('{n}', `${badges()}`);

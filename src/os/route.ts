// Checks a URL route (#/<section>/<id>) before a window opens for it. A bad id gets a suggestion, not an empty window.
import { ALL_MODULES, findModule } from '../curriculum';
import { findSkill } from '../mastery/skills';
import { findPractice, PRACTICE } from '../practice';
import { closestMatches, type Candidate } from './suggest';

export type RouteCheck = { ok: true } | { ok: false; kind: 'module' | 'practice'; bad: string; suggestions: string[] };

const MODULE_CANDIDATES: Candidate[] = ALL_MODULES.map((m) => ({ id: m.id, title: m.title }));
// Players type the practice id without its `practice-` prefix, and `practice <id>` accepts either form.
const PRACTICE_CANDIDATES: Candidate[] = PRACTICE.map((p) => ({ id: p.id.replace(/^practice-/, ''), title: p.title }));

/** `isLab`: the section opens a lab window for a module id. Other sections are not checked here. */
export function checkRoute(section: string, id: string, isLab: boolean): RouteCheck {
  if (isLab && id && !findModule(id)) return { ok: false, kind: 'module', bad: id, suggestions: closestMatches(id, MODULE_CANDIDATES) };
  if (section === 'practice' && id && !findPractice(id) && !findPractice(`practice-${id}`) && !findSkill(id)) {
    return { ok: false, kind: 'practice', bad: id, suggestions: closestMatches(id, PRACTICE_CANDIDATES) };
  }
  return { ok: true };
}

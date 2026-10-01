// Skills.app: the curriculum audit as a live screen. Every skill, your level in it (0-3), and what to do next.
import { findModule, KIND_LABEL } from '../curriculum';
import { levelRecord, profile } from '../state';
import { capstoneId, isHired } from './career';
import { h } from '../ui/dom';
import { AREAS, findRole, LEVEL_NAME, nextStep, roleReadiness, ROLES, SKILLS, skillCeiling, skillLevel, skillsFor, type RoleId, type Skill } from './skills';

const GOAL_ROLE: Record<string, RoleId | undefined> = { design: 'rtl', verif: 'dv', pd: 'pd', board: 'board', arch: 'arch' };

const pips = (lv: number, ceil: number) => h('span', { class: 'pips', title: `${LEVEL_NAME[lv]}${ceil < 3 ? ` · levels above ${ceil} in development` : ''}` },
  ...[1, 2, 3].map((i) => h('span', { class: `pip${i <= lv ? ' on' : ''}${i > ceil ? ' wip' : ''}` })));

function tierButton(s: Skill, tier: 'learn' | 'practice' | 'boss', label: string): HTMLElement {
  const ids = s[tier];
  if (!ids.length) return h('span', { class: 'tier wip', title: s.plan ? `In development: ${s.plan}` : 'In development' }, label);
  const done = ids.every((id) => !!levelRecord(id));
  const target = ids.find((id) => !levelRecord(id)) ?? ids[0];
  const f = findModule(target);
  const count = ids.length > 1 ? ` ${ids.filter((id) => !!levelRecord(id)).length}/${ids.length}` : '';
  return h('a', { class: `tier${done ? ' done' : ''}`, href: f?.module.route ?? '#/', title: f ? `${KIND_LABEL[f.module.kind]}: ${f.module.title}` : target }, `${done ? '✓ ' : ''}${label}${count}`);
}

export function skillsApp(focus?: string): HTMLElement {
  const role = focus ? findRole(focus) : GOAL_ROLE[profile()?.goal ?? ''] ? findRole(GOAL_ROLE[profile()!.goal]!) : undefined;
  const list = role ? skillsFor(role.id) : SKILLS;
  const counts = [0, 0, 0, 0];
  list.forEach((s) => counts[skillLevel(s)]++);
  const built = list.filter((s) => skillCeiling(s) === 3).length;

  // the most useful next step: lowest level first, then curriculum order
  const suggestion = [...list].map((s) => ({ s, lv: skillLevel(s), nx: nextStep(s) })).filter((x) => x.nx).sort((a, b) => a.lv - b.lv)[0];

  const select = h('select', { class: 'role-select', 'aria-label': 'Show skills for a role', onchange: (e: Event) => { location.hash = (e.target as HTMLSelectElement).value ? `#/skills/${(e.target as HTMLSelectElement).value}` : '#/skills'; } },
    h('option', { value: '' }, 'Every skill'),
    ...ROLES.map((r) => h('option', { value: r.id, selected: role?.id === r.id }, `${r.icon} ${r.name}`)));

  const head = h('div', { class: 'skills-head' },
    h('div', null,
      h('p', { class: 'kicker' }, role ? `${role.name} · ${Math.round(roleReadiness(role.id) * 100)}% job-ready${isHired(role) ? ' · hired ✓' : ''}` : `${SKILLS.length} skills · the curriculum audit, live`),
      h('h2', null, role ? role.name : 'Your skill matrix'),
      h('p', { class: 'dim' }, role ? role.blurb : 'Every row is a skill from the curriculum audit. Level 1 · Aware: you did the lesson. Level 2 · Practised: you passed the practice. Level 3 · Job-ready: you beat the boss, with no hints.'),
      h('div', { class: 'skills-counts' },
        ...[3, 2, 1, 0].map((lv) => h('span', { class: `cnt l${lv}` }, h('b', null, String(counts[lv])), ` ${LEVEL_NAME[lv].toLowerCase()}`)),
        h('span', { class: 'cnt dim' }, `${built}/${list.length} skills fully built`)),
      role && !isHired(role) && roleReadiness(role.id) >= 0.6 ? h('a', { class: 'btn', href: `#/learn/${capstoneId(role)}` }, '♛ Take the hiring panel') : null,
      suggestion ? h('a', { class: 'btn primary', href: findModule(suggestion.nx!.id)?.module.route ?? '#/' }, `▶ Next: ${findModule(suggestion.nx!.id)?.module.title ?? suggestion.nx!.id}`) : null),
    h('div', { class: 'skills-role' }, h('label', { class: 'dim' }, 'Show skills for'), select));

  const areas = AREAS.filter((a) => list.some((s) => s.area === a)).map((area) => h('section', { class: 'skill-area' },
    h('h3', null, area),
    h('table', { class: 'skill-table' }, ...list.filter((s) => s.area === area).map((s) => {
      const lv = skillLevel(s), ceil = skillCeiling(s);
      return h('tr', { class: `lv${lv}` },
        h('td', { class: 'sk-name' }, h('span', null, s.name), ceil < 3 ? h('span', { class: 'wip-note' }, ` · ${s.plan ?? 'in development'}`) : null),
        h('td', null, pips(lv, ceil)),
        h('td', { class: 'tiers' }, tierButton(s, 'learn', 'Learn'), tierButton(s, 'practice', 'Practice'), tierButton(s, 'boss', 'Boss')));
    }))));

  const roles = h('aside', { class: 'role-list' },
    h('h3', null, 'Job readiness'),
    ...[...ROLES].sort((a, b) => roleReadiness(b.id) - roleReadiness(a.id)).map((r) => {
      const pct = Math.round(roleReadiness(r.id) * 100);
      return h('a', { class: `role-row${role?.id === r.id ? ' on' : ''}`, href: `#/skills/${r.id}` },
        h('span', { class: 'ri' }, r.icon), h('span', { class: 'rn' }, isHired(r) ? `${r.name} ✓` : r.name),
        h('span', { class: 'track small' }, h('span', { class: 'fill', style: `width:${pct}%` })), h('span', { class: 'rp' }, `${pct}%`));
    }));

  return h('div', { class: 'skills' }, head, h('div', { class: 'skills-body' }, h('div', { class: 'skills-main' }, ...areas), roles));
}

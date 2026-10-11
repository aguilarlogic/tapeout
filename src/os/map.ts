// Map.app: the campaign as a chip. Each act is a block of the die; every module is a node on a trace.
// Acts fold away (the current one stays open), a search box and filters find modules, and "▶ Next" stays pinned.
import { ACTS, Act, actProgress, CORE_ACTS, goalRole, KIND_LABEL, Module, ModKind, readiness, recommended } from '../curriculum';
import { SKILLS, type RoleId } from '../mastery/skills';
import { levelRecord, rank, RANKS, totalXp } from '../state';
import { h, stars } from '../ui/dom';
import { die } from './die';

const ICON: Record<ModKind, string> = {
  lesson: '›_', practice: '∞', boss: '♛', incident: '☎', logic: '⊼', cmos: '⊥', rtl: '{}', debug: '⚑', cov: '◎', uvm: '⧉', clab: '∿', code: '</>', shell: '$_', sva: '|->', tb: 'tb', cdc: '⇄', isa: 'rv', arch: '▤', rv: '⌬', dft: '⊘', pd: '▥', sta2: '⏱', layout: '▤', sig: '∿', spec: '◈', sta: '⏱', pcb: '▦', drills: '?!', final: '★',
};


/** The four kinds of module a player filters by. */
export type KindGroup = 'lesson' | 'lab' | 'boss' | 'incident';
export const GROUP_LABEL: Record<KindGroup, string> = { lesson: 'Lessons', lab: 'Labs', boss: 'Bosses', incident: 'Incidents' };
export function groupOf(k: ModKind): KindGroup {
  if (k === 'boss' || k === 'incident') return k;
  return k === 'lesson' || k === 'practice' || k === 'drills' || k === 'final' ? 'lesson' : 'lab';
}

/** Module ids a role needs: the modules of its skills, the shared basics every role needs, and its hiring panel. */
export function roleModuleIds(role: RoleId): Set<string> {
  const ids = new Set<string>([`cap-${role}`]);
  for (const s of SKILLS) if (s.roles === 'all' || s.roles.includes(role)) for (const id of [...s.learn, ...s.practice, ...s.boss]) ids.add(id);
  return ids;
}

export interface MapFilter { query: string; group: KindGroup | 'all'; role?: Set<string> }

/** Does a module pass the filter? Every word of the query must appear in its title or concept. */
export function matchesFilter(m: Module, f: MapFilter): boolean {
  if (f.group !== 'all' && groupOf(m.kind) !== f.group) return false;
  if (f.role && !f.role.has(m.id)) return false;
  const words = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${m.title} ${m.concept}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The act holding the player's next module (-1 when everything is done). Open by default. */
export function currentAct(): number {
  const next = recommended();
  return next ? ACTS.findIndex((a) => a.chapters.some((c) => c.modules.some((m) => m.id === next.id))) : -1;
}

/** Map.app's view, kept between renders: progress changes rebuild the page, and the player's place should survive. */
const view: { query: string; group: KindGroup | 'all'; mine: boolean; open: Map<number, boolean>; focus?: number } = { query: '', group: 'all', mine: false, open: new Map() };

/** Open Map.app on one act (by index into ACTS), clearing any filter that would hide it. The next render scrolls to it. */
export function showAct(index: number) {
  view.query = ''; view.group = 'all'; view.mine = false;
  view.open.set(index, true);
  view.focus = index;
}

export function mapApp(): HTMLElement {
  const xp = totalXp(), r = rank(xp), next = recommended();
  const role = goalRole();
  const roleIds = role ? roleModuleIds(role) : undefined;
  const root = h('div', { class: 'map' });
  const list = h('div', { class: 'map-acts' });
  const count = h('p', { class: 'map-count dim', 'aria-live': 'polite' });
  const chips = h('div', { class: 'map-filters', role: 'group', 'aria-label': 'Filter modules' });

  const filter = (): MapFilter | undefined => {
    const mine = view.mine && roleIds ? roleIds : undefined;
    return view.query.trim() || view.group !== 'all' || mine ? { query: view.query, group: view.group, role: mine } : undefined;
  };

  const actSection = (a: Act, i: number, f: MapFilter | undefined): { el?: HTMLElement; shown: number } => {
    const chapters = a.chapters.map((c) => ({ c, ms: c.modules.filter((m) => !f || matchesFilter(m, f)) })).filter((x) => x.ms.length);
    const shown = chapters.reduce((n, x) => n + x.ms.length, 0);
    if (f && !shown) return { shown };
    const p = actProgress(a);
    // While filtering, every act with a hit opens; otherwise the player's own folds (or the current act) decide.
    const open = f ? true : view.open.get(i) ?? i === currentAct();
    const el = h('details', { class: 'act', id: `act-${a.n}`, open: open ? true : undefined },
      h('summary', { class: 'act-head' },
        h('span', { class: 'act-n' }, `ACT ${a.n}`),
        h('div', null, h('h3', null, a.name), h('p', { class: 'dim' }, a.tagline)),
        h('span', { class: 'spacer' }),
        h('span', { class: 'dim' }, `${p.done}/${p.total}`),
        h('div', { class: 'track small' }, h('div', { class: 'fill', style: `width:${Math.round(p.frac * 100)}%` }))),
      ...chapters.map(({ c, ms }) => h('div', { class: 'chapter' },
        h('div', { class: 'ch-name' }, c.name),
        h('div', { class: 'nodes' }, ...ms.map((m) => {
          const rec = levelRecord(m.id);
          return h('a', { class: `node k-${m.kind}${rec ? ' done' : ''}${next?.id === m.id ? ' next' : ''}`, href: m.route, title: `${KIND_LABEL[m.kind]}: ${m.concept}` },
            h('span', { class: 'node-icon', 'aria-hidden': 'true' }, ICON[m.kind]),
            h('span', { class: 'node-title' }, m.title),
            h('span', { class: 'node-kind' }, KIND_LABEL[m.kind]),
            rec ? stars(rec.stars) : h('span', { class: 'node-xp' }, `${m.xp} XP`));
        })))));
    // A player's fold is remembered, but not while a filter is opening acts for them.
    if (!f) el.addEventListener('toggle', () => view.open.set(i, el.open));
    return { el, shown };
  };

  const renderList = () => {
    const f = filter();
    const sections = ACTS.map((a, i) => actSection(a, i, f));
    const shown = sections.reduce((n, s) => n + s.shown, 0);
    list.replaceChildren(...sections.flatMap((s) => (s.el ? [s.el] : [])), ...(shown || !f ? [] : [h('p', { class: 'map-empty dim' }, 'No module matches. Clear the search or a filter.')]));
    const total = ACTS.reduce((n, a) => n + a.chapters.reduce((k, c) => k + c.modules.length, 0), 0);
    count.textContent = f ? `${shown} of ${total} modules` : `${total} modules across ${ACTS.length} acts. Search, filter, or open an act.`;
  };

  const renderChips = () => {
    const groups: [KindGroup | 'all', string][] = [['all', 'All'], ['lesson', GROUP_LABEL.lesson], ['lab', GROUP_LABEL.lab], ['boss', GROUP_LABEL.boss], ['incident', GROUP_LABEL.incident]];
    const pick = (g: KindGroup | 'all') => { view.group = g; renderChips(); renderList(); };
    chips.replaceChildren(
      ...groups.map(([g, label]) => h('button', { class: 'filter', 'aria-pressed': view.group === g ? 'true' : 'false', onclick: () => pick(g) }, label)),
      h('button', {
        class: 'filter mine', 'aria-pressed': view.mine && roleIds ? 'true' : 'false', disabled: !roleIds,
        title: roleIds ? 'Only the modules your goal role needs' : 'Set a goal role first with `goal <role>`',
        onclick: () => { view.mine = !view.mine; renderChips(); renderList(); },
      }, 'My role'));
  };

  // Jumping from the die opens the act, clearing any filter that would hide it.
  const jumpTo = (a: Act) => {
    view.query = ''; view.group = 'all'; view.mine = false;
    search.value = '';
    view.open.set(ACTS.indexOf(a), true);
    renderChips(); renderList();
    const el = root.querySelector<HTMLDetailsElement>(`#act-${a.n}`);
    if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  const search = h('input', {
    class: 'map-search', type: 'search', placeholder: 'Search titles and concepts, e.g. "cache" or "uvm"', 'aria-label': 'Search modules',
    value: view.query, autocomplete: 'off',
    oninput: (e: Event) => { view.query = (e.target as HTMLInputElement).value; renderList(); },
  });

  // "▶ Next" and the search and filters stay at the top of the scroll as the acts go by.
  root.append(
    h('div', { class: 'map-bar' },
      next ? h('a', { class: 'btn primary map-next', href: next.route }, `▶ Next: ${next.title}`) : h('p', { class: 'promo' }, 'Everything signed off. Your chip is ready to tape out.'),
      h('div', { class: 'map-tools' }, search, chips)),
    h('div', { class: 'map-top' },
      h('div', { class: 'map-die' }, die(jumpTo)),
      h('div', { class: 'map-summary' },
        h('p', { class: 'kicker' }, `Tapeout readiness ${readiness()}%`),
        h('h2', null, 'From electrons to architecture'),
        h('p', { class: 'dim' }, `${CORE_ACTS.length} core acts and a block of specialist roles, each a region of your chip. Lessons run in the terminal with TAPEOUT; labs open their own windows. Everything is open: skip ahead whenever you like.`),
        h('div', { class: 'ranks' }, ...RANKS.map((rk, i) => h('span', { class: `rank${i === r.index ? ' on' : i < r.index ? ' past' : ''}`, title: `${rk.xp} XP` }, rk.title))))),
    count,
    list,
  );
  renderChips();
  renderList();
  // A jump from the desktop die asks for one act: bring it into view once the page is in the DOM.
  if (view.focus !== undefined) {
    const el = root.querySelector<HTMLElement>(`#act-${ACTS[view.focus].n}`);
    view.focus = undefined;
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }
  return root;
}

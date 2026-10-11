// The incident runner: a pager goes off, the player takes readings that cost lab time, crosses causes off,
// diagnoses the root cause and picks the fix. The first incident a player sees comes with a coach.
import { INCIDENTS } from '../incidents';
import { Investigation, key } from '../incidents/engine';
import { HINT_COST, type Incident, type Instrument, WRONG_COST } from '../incidents/types';
import { levelRecord } from '../state';
import { award, promotionLine, type Award } from '../mastery/promotion';
import { h, stars as starEls } from '../ui/dom';
import { Interrupted, rich, type Terminal } from './terminal';

/** Lab minutes as "3h20m" or "45m". */
export const hm = (m: number) => {
  const a = Math.max(0, Math.round(m));
  return a >= 60 ? `${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}m` : `${a}m`;
};

const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;

export interface IncidentHooks {
  /** Look up a glossary term (`what is ...` works mid-incident). */
  define: (q: string) => Promise<void>;
}

export interface IncidentResult { solved: boolean; stars: number }

const COMMANDS: [string, string][] = [
  ['<instrument> [arg]', 'take a reading (costs lab time; repeats are free)'],
  ['causes', 'the candidate root causes, with the ones you crossed off'],
  ['x <n>', 'cross cause n off (or back on) in your notebook'],
  ['notes', 'every reading you have taken so far'],
  ['ask', `ask a senior engineer what to measure next (${HINT_COST} min)`],
  ['diagnose [n]', `name the root cause (a wrong call costs ${WRONG_COST} min)`],
  ['tools · time · quit', 'instrument list · budget left · leave the lab'],
];

export async function runIncident(t: Terminal, inc: Incident, hooks: IncidentHooks, seed = Math.floor(Math.random() * 2 ** 31)): Promise<IncidentResult> {
  const inv = new Investigation(inc, seed);
  const coach = !INCIDENTS.some((i) => levelRecord(i.id));
  const struck = new Set<string>();
  const causeName = (id: string) => inc.causes.find((c) => c.id === id)!.name;

  // ---- the page
  const [tag, sev, ...body] = inc.pager.split(' · ');
  void t.block(h('div', { class: 'incident-page' },
    h('div', { class: 'hdr' }, `☎ ${tag} · ${sev} · ${new Date().toTimeString().slice(0, 5)}`),
    h('div', null, body.join(' · '))), 'type', 2);
  void t.block(h('div', { class: 'term-banner incident' },
    h('span', { class: 'dim' }, `INCIDENT · ${hm(inc.budget)} of lab time · wrong calls cost ${WRONG_COST} min`),
    h('b', null, inc.title), h('span', { class: 'dim' }, inc.concept)), 'type', 2.5);

  if (coach) {
    await t.say('This is an **incident**. It is not a quiz: something real is broken, and nobody knows why yet. That includes me.', 'thinking');
    await t.say('You have **instruments**. Each reading costs lab time. You also have a list of **candidate causes**: one of them is the real one, picked at random, so every replay is a new case.');
    await t.say('The method is the one real engineers use: pick the reading that splits the candidates best, cross off whatever it rules out, repeat. When one cause fits all the evidence, `diagnose` it, then choose the fix. A cheap reading that splits the list in half beats an expensive one that confirms what you already know.');
    await t.say('This first time I will cross causes off for you after each reading, so you can see the logic. After this one, the notebook is yours.', 'wink');
  } else {
    await t.say('Your lab, your call. `tools` lists the instruments, `causes` the suspects, `ask` gets you a senior engineer for a price.', 'thinking');
  }
  printTools(t, inc);
  printCauses(t, inv, struck);

  const chips = () => [...inc.instruments.map((i) => i.cmd), 'causes', 'notes', 'ask', 'diagnose'];

  for (;;) {
    if (inv.over) return escalate(t, inv);
    const raw = (await t.ask({ prompt: `lab ${hm(inv.left)}>`, chips: chips(), placeholder: 'an instrument, or causes · notes · ask · diagnose' })).trim();
    if (!raw) continue;
    const [c0, ...rest] = raw.split(/\s+/);
    const cmd = c0.toLowerCase(), arg = rest.join(' ');
    const ins = inv.find(cmd);
    if (ins) {
      const a = await pickArg(t, ins, arg);
      if (a === undefined) continue;
      const before = inv.byEvidence();
      const m = inv.measure(ins, a);
      void t.art(m.text, m.repeat ? `${key(ins.cmd, a)} · from your notebook, no time spent` : `${key(ins.cmd, a)} · ${ins.cost} min · ${hm(inv.left)} left`);
      if (coach && !m.repeat) await coachReading(t, inv, before, struck, causeName);
      continue;
    }
    switch (cmd) {
      case 'help': case '?': case 'tools': case 'instruments':
        printTools(t, inc);
        if (cmd !== 'tools' && cmd !== 'instruments') printCommands(t);
        break;
      case 'causes': case 'suspects': case 'list':
        printCauses(t, inv, struck);
        break;
      case 'x': case 'strike': case 'cross': case 'rule': {
        const n = parseInt(arg.replace(/^out\s+/, ''), 10);
        const c = inc.causes[n - 1];
        if (!c) { void t.print(`usage: x <1-${inc.causes.length}>, from the \`causes\` list`, 'dim'); break; }
        if (struck.has(c.id)) struck.delete(c.id); else struck.add(c.id);
        void t.print(`${struck.has(c.id) ? '✗ crossed off' : '↺ back on the list'}: ${c.name}`, 'dim');
        break;
      }
      case 'notes': case 'notebook': case 'log':
        if (!inv.notes.size) { void t.print('Your notebook is empty. Take a reading first.', 'dim'); break; }
        for (const [k, text] of inv.notes) void t.art(text, k);
        break;
      case 'time': case 'budget':
        void t.print(`${hm(inv.left)} left of ${hm(inc.budget)} · ${inv.notes.size} readings · ${inv.mistakes} wrong calls`, 'dim');
        break;
      case 'ask': case 'hint': case 'senior': {
        const nx = inv.hint();
        void t.print(`(senior engineer · ${HINT_COST} min · ${hm(inv.left)} left)`, 'dim');
        if (!nx) await t.say('"Honestly? Everything you have points one way. Diagnose it."', 'wink');
        else if (inv.notes.has(key(nx.ins.cmd, nx.arg))) await t.say('"Read your notes again. The answer is already in them."', 'thinking');
        else await t.say(`"I would take \`${key(nx.ins.cmd, nx.arg)}\` next. ${nx.ins.what.charAt(0).toUpperCase() + nx.ins.what.slice(1)}: whatever it shows, it splits what is left."`, 'thinking');
        break;
      }
      case 'diagnose': case 'd': case 'solve': case 'fix': case 'blame': {
        const r = await diagnose(t, inv, arg, struck);
        if (r) return r;
        break;
      }
      case 'quit': case 'exit': case 'q':
        throw new Interrupted();
      default:
        if (/^(what|who|define|explain)\b/i.test(raw)) { await hooks.define(raw.replace(/^(define|explain)\s+/i, '')); break; }
        void t.print(`No instrument called \`${cmd}\` in this lab. Type \`tools\` for the bench, \`help\` for commands.`, 'err');
    }
  }
}

function printTools(t: Terminal, inc: Incident) {
  void t.block(h('table', { class: 'term-table incident-tools' },
    h('tr', null, h('th', null, 'instrument'), h('th', null, 'min'), h('th', null, 'what it shows')),
    ...inc.instruments.map((i) => h('tr', null,
      h('td', null, h('code', null, i.cmd), i.args?.length ? h('span', { class: 'dim' }, ` ${i.args.join('|')}`) : null),
      h('td', { class: 'num' }, String(i.cost)),
      h('td', null, ...rich(i.what))))));
}

function printCommands(t: Terminal) {
  void t.block(h('table', { class: 'term-table' }, ...COMMANDS.map(([c, d]) => h('tr', null, h('td', null, h('code', null, c)), h('td', null, ...rich(d))))));
}

function printCauses(t: Terminal, inv: Investigation, struck: Set<string>) {
  void t.block(h('ol', { class: 'incident-causes' }, ...inv.inc.causes.map((c) => {
    const out = inv.ruledOut.has(c.id) ? 'wrong call' : struck.has(c.id) ? 'crossed off' : '';
    return h('li', { class: out ? 'out' : '' }, c.name, out ? h('span', { class: 'dim' }, `\u00a0\u00a0(${out})`) : null);
  })));
}

/** Resolve an instrument's argument: typed, or picked from a menu. */
async function pickArg(t: Terminal, ins: Instrument, arg: string): Promise<string | undefined> {
  if (!ins.args?.length) return '';
  const hit = ins.args.find((a) => a.toLowerCase() === arg.toLowerCase());
  if (hit) return hit;
  if (arg) void t.print(`\`${ins.cmd}\` takes one of: ${ins.args.join(', ')}`, 'dim');
  const i = await t.choose(ins.args.map((a) => `\`${ins.cmd} ${a}\``), `${ins.cmd}>`);
  return ins.args[i];
}

/** Training wheels for the first incident: say what the reading ruled out. */
async function coachReading(t: Terminal, inv: Investigation, before: string[], struck: Set<string>, name: (id: string) => string) {
  // Readings only, the same rule `diagnose` judges by: a wrong call crosses a cause off but proves nothing.
  const now = inv.byEvidence();
  const gone = before.filter((c) => !now.includes(c));
  gone.forEach((c) => struck.add(c));
  if (!gone.length) await t.say('That reading fits every cause still on the list, so it told us nothing new. Look for a reading where the causes would disagree.', 'thinking');
  else await t.say(`That rules out ${gone.map((c) => `**${name(c)}**`).join(', ')}: ${gone.length > 1 ? 'none of them could' : 'it could not'} produce this reading.${now.length > 1 ? ` ${now.length} causes left.` : ''}`, 'happy');
  if (now.length === 1) await t.say(`Only **${name(now[0])}** fits everything you have seen. Type \`diagnose\`.`, 'excited');
}

async function diagnose(t: Terminal, inv: Investigation, arg: string, struck: Set<string>): Promise<IncidentResult | undefined> {
  const inc = inv.inc;
  const open = inc.causes.filter((c) => !inv.ruledOut.has(c.id));
  let pick = inc.causes[parseInt(arg, 10) - 1];
  if (!pick || inv.ruledOut.has(pick.id)) {
    const i = await t.choose(open.map((c) => (struck.has(c.id) ? `${c.name} (crossed off)` : c.name)), 'root cause>');
    pick = open[i];
  }
  // Committing while the readings still leave several causes standing is a guess, and a guess cannot close an incident.
  const live = inv.byEvidence();
  if (live.length > 1) {
    const nm = (id: string) => `**${inc.causes.find((c) => c.id === id)!.name}**`;
    await t.say(live.length <= 3 ? `${live.length === 2 ? 'Two causes' : 'Three causes'} still fit everything you have seen: ${live.map(nm).join(' and ')}. Diagnose anyway?`
      : `${live.length} causes still fit everything you have seen. Diagnose anyway?`, 'concerned');
    const go = await t.choose(['Take another reading', 'Diagnose anyway'], 'sure?');
    if (go === 0) return undefined;
  }
  if (!inv.diagnose(pick.id)) {
    void t.print(`✗ −${WRONG_COST} min · ${hm(inv.left)} left`, 'err');
    await t.say(`You roll out a fix for **${pick.name.charAt(0).toLowerCase() + pick.name.slice(1)}**. Two days later the failure is back, exactly as before. That cause is off the list, and the clock kept running.`, 'concerned');
    return undefined;
  }
  void t.print('✓ root cause confirmed', 'ok');
  await t.say(`Yes: **${pick.name}**. Now the part that matters to the customer: which fix goes in?`, 'excited');
  const opts = inv.fixOptions(Math.random);
  for (;;) {
    const i = await t.choose(opts.map((o) => o.text), 'fix>');
    const o = opts[i];
    if (inv.applyFix(o)) break;
    void t.print(`✗ −${WRONG_COST} min · ${hm(inv.left)} left`, 'err');
    await t.say(`Not that one. ${o.why}`, 'concerned');
    opts.splice(i, 1);
    if (inv.left <= 0) return escalate(t, inv);
  }
  return finish(t, inv);
}

/** What a careful expert would have spent on the same case: the benchmark in the debrief. */
function expertMinutes(inv: Investigation): number {
  const ex = new Investigation(inv.inc, inv.world.seed, inv.world.cause);
  for (let g = 0; g < 50; g++) { const nx = ex.bestNext(); if (!nx) break; ex.measure(nx.ins, nx.arg); }
  return ex.spent;
}

async function finish(t: Terminal, inv: Investigation): Promise<IncidentResult> {
  if (inv.guessed && !inv.over && inv.left >= 0) {
    const nx = inv.guessHint;
    void t.block(h('div', { class: 'term-done' },
      h('div', null, h('b', null, 'RIGHT ANSWER, NOT PROVEN'), ' ', starEls(0)),
      h('div', { class: 'dim' }, `${n(inv.notes.size, 'reading')} · ${n(inv.mistakes, 'wrong call')} · no new XP`),
      h('ul', { class: 'recap' },
        h('li', null, ...rich(`**What happened:** ${inv.cause.story}`)),
        h('li', null, ...rich(`**The fix:** ${inv.cause.fix}`)))), 'type', 1.6);
    await t.say(`Right answer, but the evidence did not single it out yet. A review board would send this back.${nx ? ` \`${key(nx.ins.cmd, nx.arg)}\` would have separated what was left.` : ''} Replay it; the root cause will be different.`, 'concerned');
    return { solved: false, stars: 0 };
  }
  const st = inv.stars();
  const aw = st ? award(inv.inc.id, inv.inc.xp, st) : { gained: 0 } as Award;
  const gained = aw.gained;
  const expert = expertMinutes(inv);
  void t.block(h('div', { class: 'term-done' },
    h('div', null, h('b', null, st ? 'INCIDENT RESOLVED' : 'RESOLVED, BUT LATE'), ' ', st ? starEls(st) : null),
    h('div', { class: 'dim' }, `${hm(inv.spent)} used of ${hm(inv.inc.budget)} · ${n(inv.notes.size, 'reading')} · ${n(inv.mistakes, 'wrong call')} · ${n(inv.hints, 'hint')} · a careful expert: ~${hm(expert)} · ${gained ? `+${gained} XP` : 'no new XP'}`),
    h('ul', { class: 'recap' },
      h('li', null, ...rich(`**What happened:** ${inv.cause.story}`)),
      h('li', null, ...rich(`**The fix:** ${inv.cause.fix}`)),
      h('li', null, ...rich(`**Your path:** ${[...inv.notes.keys()].map((k) => `\`${k}\``).join(' → ') || 'straight to a diagnosis'}`)))), 'type', 1.6);
  if (aw.promotedTo) await t.say(promotionLine(aw.promotedTo), 'excited');
  await t.say(st === 3 ? 'Clean and quick: that is how a senior engineer works an incident. The customer never knew how close it was.'
    : st === 2 ? 'Solved. One slip, which is normal under a pager. Replay it: the root cause will be different next time.'
      : st === 1 ? 'Solved, the hard way. Every wrong call cost real time; next time, let one more reading settle it before you commit.'
        : 'Fixed, but past the deadline: the escalation already happened. Replay it; the cause will be different.', st >= 2 ? 'proud' : 'thinking');
  return { solved: true, stars: st };
}

async function escalate(t: Terminal, inv: Investigation): Promise<IncidentResult> {
  void t.print('⚠ out of lab time · the incident has been escalated', 'err');
  void t.block(h('div', { class: 'term-done' },
    h('div', null, h('b', null, 'ESCALATED')),
    h('div', { class: 'dim' }, `${n(inv.notes.size, 'reading')} · ${n(inv.mistakes, 'wrong call')}`),
    h('ul', { class: 'recap' },
      h('li', null, ...rich(`**It was:** ${inv.cause.name}`)),
      h('li', null, ...rich(`**What happened:** ${inv.cause.story}`)),
      h('li', null, ...rich(`**The fix:** ${inv.cause.fix}`)))), 'type', 1.6);
  await t.say('This one got away. Read the debrief: it shows which reading would have given it away. Replay it and the root cause will be different.', 'concerned');
  return { solved: false, stars: 0 };
}

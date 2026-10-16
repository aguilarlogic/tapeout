// TAPEOUT's brain: onboarding, the command shell, and the lesson runner.
import { ACTS, actProgress, ALL_MODULES, findModule, KIND_APP, KIND_LABEL, Module, neighbours, readiness, recommended, startAct } from '../curriculum';
import { CARDS, DECKS } from '../games/drills/cards';
import { GLOSSARY, lookup } from '../glossary';
import { findIncident, INCIDENTS } from '../incidents';
import { finalExam, FINAL_ID, findLesson } from '../lessons';
import type { Lesson, Mood, Question } from '../lessons/types';
import { career, capstoneId } from '../mastery/career';
import { findSkill, LEVEL_NAME, nextStep, roleReadiness, ROLES, SKILLS, skillCeiling, skillLevel, type RoleId } from '../mastery/skills';
import { MINIGAMES } from '../minigames/apps';
import { BOSSES, findBoss, findPractice, PRACTICE, problem } from '../practice';
import { gradePractice, PRACTICE_COUNT, PRACTICE_HARD, PRACTICE_PASS, PRACTICE_START, rampStep, type Boss, type Difficulty, type PracticeSet } from '../practice/types';
import { setMood } from '../os/avatar';
import { launchGame, randomGame } from '../os/launch';
import { best, dailyGoal, levelRecord, load, onChange, playerName, prefs, Prefs, Profile, profile, rank, RANKS, recordBest, resetAll, setPrefs, setProfile, totalXp, updateCard } from '../state';
import { h, stars as starEls } from '../ui/dom';
import { runIncident } from './incident';
import { Interrupted, Redirect, rich, Terminal } from './terminal';
import { award, promotionLine, type Promotion } from '../mastery/promotion';
import { finishGoal, type GoalResult } from '../daily';
import { dayKey, MILESTONE_XP, MIX_RECORD, streakLine } from '../streak';
import { signsOff } from './stakes';
import { pick as pickRecall, pool as poolRecall, record as recordRecall } from '../recall';
import { readableReport, recordQuit, recordStep } from '../steplog';
import { GOAL_CHOICES, progressReport, runWrap, wrapDue } from './wrap';
import { printGoals } from './goals-banner';

const pickOne = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const PRAISE = ['Correct.', 'Yes.', 'Exactly.', 'Nice.', 'Right on.', 'That\'s it.'];
/** What a player types (or the chip sends) to have a problem taught instead of hinted. */
const TEACH_WORDS = /^(teach( me)?( how)?|how|how\?|how do i (do|solve) (this|it)\??|show me how|walk( me through( it)?)?|explain( it| this)?|i don'?t know how|help me)$/;
const TEACH_OPTION = '🛟 I do not know how to solve this: teach me';
const bar = (frac: number, n = 16) => '█'.repeat(Math.round(frac * n)) + '░'.repeat(n - Math.round(frac * n));

export class Shell {
  private queue: string[] = [];
  private busy = false;
  /** Set by `question()` when the player was walked through the problem instead of solving it. */
  private taught = false;
  /** Set by `question()` when the player skipped the problem and did not walk through it. */
  private skipped = false;
  /** Hints given on the current question (the hint ladder), and whether the player ended up shown the answer. */
  private rung = 0;
  private revealed = false;
  /** The lesson step the player is on, so a quit can be logged. */
  private at: { id: string; step: number } | null = null;
  /** The shell is idle, waiting at its prompt. */
  private atPrompt = false;

  constructor(public term: Terminal, private go: (route: string) => void) {
    // The chapter can end in another window (the Verilog lab) while the shell waits at its prompt: wake it, so the wrap
    // shows up right away. Only at the prompt: never cut a lesson or practice run short.
    // Clear the flag at once: one save often follows another (the level, then the rank), and a second interrupt would
    // cut the wrap's first question short.
    onChange(() => { if (this.atPrompt && wrapDue()) { this.atPrompt = false; this.term.interrupt(); } });
  }

  /** Ask the shell to run a command as soon as it can, interrupting whatever it is waiting for. */
  run(cmd: string) {
    this.queue.push(cmd);
    this.term.interrupt();
  }

  async start() {
    try { await this.boot(); } catch (e) {
      // The player navigated away mid-onboarding: carry on with whatever they asked for.
      if (!(e instanceof Interrupted)) throw e;
    }
    for (;;) {
      try {
        // The wrap goes before anything queued: the chapter's end card, then whatever the player picked next.
        if (wrapDue()) await runWrap(this.term, (v) => this.queue.push(v));
        const cmd = this.queue.shift() ?? (await this.prompt());
        await this.exec(cmd);
      } catch (e) {
        if (!(e instanceof Interrupted)) {
          console.error(e);
          this.term.print(`kernel panic: ${(e as Error).message}. TAPEOUT recovered.`, 'err');
        }
      }
    }
  }

  private async prompt(): Promise<string> {
    this.atPrompt = true;
    try {
      return await this.term.ask({ prompt: `${playerName().toLowerCase().replace(/\s+/g, '')}@tapeout:~$`, chips: this.idleChips() });
    } finally {
      this.atPrompt = false;
    }
  }

  private idleChips() {
    const next = recommended();
    return [
      ...(next ? [{ label: `▶ next: ${next.title}`, value: 'next' }] : []),
      { label: 'map', value: 'map' },
      { label: 'skills', value: 'skills' },
      { label: 'practice mix', value: 'practice' },
      { label: 'play a game', value: 'play' },
      { label: 'quiz me', value: 'quiz' },
      { label: 'help', value: 'help' },
    ];
  }

  // ---------------------------------------------------------------- boot & onboarding

  private async boot() {
    const t = this.term;
    const p = profile();
    t.print('TAPE-OS 1.0 · fab.local · tty1', 'dim');
    if (!p) return this.onboard();
    const xp = totalXp(), r = rank(xp);
    const next = recommended();
    await t.say(pickOne([`Welcome back, {name}.`, `Hey, {name}. Good to see you again.`, `{name}! I kept your workstation warm.`]), 'happy');
    t.print(`rank: **${r.title}** · ${xp} XP · tapeout readiness ${readiness()}%${r.next ? ` · ${r.next.xp - xp} XP to ${r.next.title}` : ''}`);
    await this.recall();
    if (next) await t.say(`Next up: **${next.title}** (${KIND_LABEL[next.kind].toLowerCase()}, ${findModule(next.id)!.act.name}). Type \`next\` or click below. Or ask me anything, like \`what is a latch\`.`);
    else await t.say('You have finished everything. Every block of your chip is signed off. Want to replay something for stars, or run the arcade?', 'proud');
  }

  /** On return: up to three quick questions from lessons already finished, on a spaced schedule. Skippable. */
  private async recall() {
    const t = this.term;
    const items = pickRecall(poolRecall());
    if (!items.length) return;
    const go = await t.choose(['Warm up with 3 quick questions', 'Skip, take me to my next step'], 'warm-up>');
    if (go !== 0) return;
    await t.say('Quick warm-up. These come from things you already did. No hints, no score.', 'happy');
    let right = 0;
    for (const it of items) {
      await t.say(it.q.q, 'thinking');
      const order = this.order(it.q.options);
      const pick = await t.choose(order.map((j) => it.q.options[j]), 'answer>');
      const ok = order[pick] === it.q.a;
      recordRecall(it.key, ok);
      if (ok) right++;
      else await t.say(`Not quite. ${it.q.why} It will come back soon.`, 'concerned');
    }
    await t.say(right === items.length ? 'All right. Nice memory.' : `${right} of ${items.length}. Good, now it will stick better.`, right === items.length ? 'proud' : 'happy');
  }

  /** Four quick questions that decide whether to skip ahead. Returns how many were right. No hints, no pressure. */
  private async placement(): Promise<number> {
    const t = this.term;
    const qs: [string, string[], number][] = [
      ['A row of three lamps reads on, off, on. Each lamp is worth 4, 2 and 1. Which number is that?', ['3', '5', '6', '7'], 1],
      ['An AND gate gets a 1 on one input and a 0 on the other. What does it output?', ['0', '1', 'It depends on the gate size'], 0],
      ['A half adder adds two bits. What are its two outputs?', ['sum and carry', 'clock and reset', 'read and write'], 0],
      ['In Verilog, what does `assign y = a & b;` describe?', ['An AND gate that is always connected', 'A line that runs once at the start', 'A value stored in memory'], 0],
    ];
    let right = 0;
    for (let i = 0; i < qs.length; i++) {
      const [q, opts, a] = qs[i];
      await t.say(`**Question ${i + 1} of ${qs.length}.** ${q}`, 'thinking');
      const order = this.order(opts);
      const pick = await t.choose([...order.map((j) => opts[j]), "I don't know"], 'answer>');
      if (pick < order.length && order[pick] === a) right++;
    }
    t.print(`${right} of ${qs.length} right`, 'dim');
    return right;
  }

  private async onboard() {
    const t = this.term;
    for (const line of ['memory check ........ 640K ought to be enough', 'mounting /pdk/sky130 ........ ok', 'loading mentor.ko ........ ok', 'starting tapeout-ai ........ ok']) t.print(line, 'dim');
    await t.say('Hello. My name is **TAPEOUT**.', 'happy');
    await t.say('I am the AI that lives in this workstation. I was built for one job: training chip engineers, the people who design the processors in your phone, your car, and the data centres that run the internet.');
    await t.say("What's your name?");
    let name = '';
    while (!name) {
      name = (await t.ask({ prompt: 'name>', placeholder: 'type your name and press Enter' })).trim().replace(/[<>]/g, '').slice(0, 24);
      if (!name) await t.say('Even an intern has a name. What should I call you?', 'thinking');
    }
    const prof: Profile = { name, background: 'new', goal: 'unsure', since: Date.now() };
    setProfile(prof);
    await t.say(`Nice to meet you, ${name}.`, 'wink');
    // No self-rating: a beginner starts from zero, and anyone who wants to skip ahead proves it with four quick
    // questions. Self-ratings are unreliable, so the answers decide the path, not the player's description of themselves.
    await t.say('How do you want to start?');
    if ((await t.choose(['Start me from zero.', 'Let me skip ahead. Ask me four quick questions.'])) === 0) {
      await t.say('Perfect. Zero is a great place to start, and you will not read a chapter first. In the next hour you build the first piece of your own chip. We start by lighting a lamp.', 'excited');
      this.queue.push('next');
      return;
    }
    const right = await this.placement();
    if (right < 3) {
      await t.say(right === 0 ? 'No problem at all. Those were meant to be tricky if you have not seen them. We will start from zero, and it goes fast.' : 'You know a little. We will start from the beginning and you will move quickly through the parts you know.', 'happy');
      this.queue.push('next');
      return;
    }
    prof.background = 'student';
    await t.say('You clearly know the basics. We can move fast and fill the gaps. You can jump anywhere any time with `ls` and `learn <name>`.', 'happy');
    await t.say('And what do you want to become?');
    const goal = await t.choose(GOAL_CHOICES.map(([label]) => label));
    prof.goal = GOAL_CHOICES[goal][1];
    setProfile(prof);
    await t.say('Here is the plan. You build four chips, from a single wire up to a multicore processor. Whenever a chip needs some theory, a short detour teaches it first, one subject at a time. The last act covers the specialist roles, from analog and RF to quantum computers:');
    this.printActs();
    const act = ACTS[startAct()];
    const first = recommended()!;
    await t.say(`Based on what you told me, start at **Act ${act.n}: ${act.name}**. You can jump anywhere, any time. First up: **${first.title}**.`);
    await t.say('As we go I will open windows for you: labs, simulators, little games. Everything you finish lights up part of your chip on the map. If you get stuck, type `help`, or just ask me what something means, like `what is a flip-flop`.', 'excited');
    const go = await t.choose(["Let's go.", 'Show me the map first.']);
    this.queue.push(go === 0 ? 'next' : 'map');
  }

  // ---------------------------------------------------------------- commands

  async exec(raw: string) {
    const t = this.term;
    const line = raw.trim();
    if (!line) return;
    // Hidden on purpose (not in help): the playtest report.
    if (line.toLowerCase().split(/\s+/).join(' ') === 'log export') return this.logExport();
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd.toLowerCase()) {
      case 'help': case '?': case 'man':
        return this.help();
      case 'next': case 'n': case 'continue': case 'c': case 'start': case 'go': {
        const m = recommended();
        if (!m) return t.say('Nothing left to do. Replay anything from `map`, or try `play`.', 'proud');
        return this.openModule(m);
      }
      case 'map':
        t.print('opening Map.app ...', 'dim');
        await t.beat(0);
        return this.go('#/map');
      case 'ls': case 'lessons': case 'acts': case 'curriculum':
        return arg ? this.printAct(arg) : this.printActs();
      case 'learn': case 'open': case 'cd': case 'run': case 'lesson': {
        const m = this.findModuleByText(arg);
        if (!m) return t.print(`No module called "${arg}". Try \`ls\`.`, 'err');
        return this.openModule(m);
      }
      case 'play': case 'arcade': case 'game': case 'games': {
        if (!arg) this.printGames();
        const g = arg ? MINIGAMES.find((x) => x.id === arg.toLowerCase() || x.title.toLowerCase().includes(arg.toLowerCase())) : MINIGAMES.find((x) => x.id === randomGame());
        if (!g) return t.print(`No game called "${arg}".`, 'err');
        await t.say(pickOne([`Opening **${g.title}**.`, `Let us play **${g.title}**.`, `**${g.title}**, coming right up.`]), 'excited');
        void launchGame(g.id);
        return;
      }
      case 'quiz': case 'drill': case 'interview':
        return this.quiz();
      case 'practice': case 'train': case 'mix': case 'daily':
        return this.practiceCmd(arg);
      case 'endless':
        return this.practiceCmd(arg, true);
      case 'skills': case 'skill': case 'matrix': case 'audit':
        return this.skillsCmd(arg);
      case 'career': case 'promotion': case 'rank':
        return this.careerCmd();
      case 'roles': case 'role': case 'careers': case 'jobs':
        return this.rolesCmd(arg);
      case 'checkpoint': case 'checkpoints': case 'boss': case 'bosses': {
        if (!arg) return this.printBosses();
        const b = findBoss(arg) ?? findBoss(`boss-${arg}`);
        if (!b) return t.print(`No checkpoint "${arg}". Type \`checkpoints\` to list them.`, 'err');
        return this.runLesson(b.id);
      }
      case 'incident': case 'incidents': case 'pager': case 'oncall': {
        if (!arg) return this.printIncidents();
        const inc = findIncident(arg) ?? findIncident(`inc-${arg}`);
        if (!inc) return t.print(`No incident "${arg}". Type \`incidents\` to list them.`, 'err');
        return this.incident(inc.id);
      }
      case 'define': case 'explain': case 'whatis': case 'what': case 'who':
        return this.define(cmd.toLowerCase() === 'what' || cmd.toLowerCase() === 'who' ? line : arg);
      case 'status': case 'whoami': case 'stats': case 'progress':
        return this.status();
      case 'name':
        if (!arg) return t.print('usage: name <new name>', 'dim');
        setProfile({ ...(profile() ?? { background: 'new', goal: 'unsure', since: Date.now() }), name: arg.slice(0, 24) });
        return t.say(`Okay, ${arg.slice(0, 24)} it is.`, 'wink');
      case 'speed': {
        const v = arg as Prefs['speed'];
        if (!['slow', 'normal', 'fast', 'instant'].includes(v)) return t.print(`usage: speed slow|normal|fast|instant (now: ${prefs().speed}), or open Settings.app with \`settings\``, 'dim');
        setPrefs({ speed: v });
        return t.say(`Typing speed set to ${v}. You can change it any time in **Settings.app** too.`);
      }
      case 'settings': case 'prefs': case 'options': case 'config':
        void t.print('opening Settings.app ...', 'dim');
        await t.beat(0);
        return this.go('#/settings');
      case 'clear': case 'cls':
        return t.clear();
      case 'reset':
        t.print('This erases all progress. Type `reset --yes` to confirm.', 'warn');
        if (arg === '--yes') { resetAll(); location.hash = '#/'; location.reload(); }
        return;
      case 'sudo':
        return t.say(pickOne(['Nice try. Even Fellows do not get root on the fab.', `${playerName()} is not in the sudoers file. This incident will be reported to your manager.`]), 'wink');
      case 'make':
        return t.print("make: *** No rule to make target 'chip'. Stop. (try `next`)", 'err');
      case 'vim': case 'vi': case 'emacs': case 'nano':
        return t.say('Editor wars are above my pay grade. Every lab here has its own editor.', 'wink');
      case 'exit': case 'logout': case 'quit':
        return t.say('There is no escape from learning, {name}. But you can close this window any time; I will be here.', 'wink');
      case 'hello': case 'hi': case 'hey':
        return t.say(pickOne(['Hello, {name}!', 'Hi! Ready to build something?', 'Hey. What are we learning today?']), 'happy');
      case 'thanks': case 'thank': case 'ty':
        return t.say('Any time. That is literally what I was built for.', 'happy');
      case 'date':
        return t.print(new Date().toString(), 'dim');
      case 'echo':
        return t.print(arg, 'you');
      case 'pwd':
        return t.print('/home/' + playerName().toLowerCase().replace(/\s+/g, ''), 'dim');
      default: {
        const m = this.findModuleByText(line);
        if (m && line.length > 2) return this.openModule(m);
        const e = lookup(line);
        if (e) return this.define(line);
        return t.say(pickOne([`I do not know \`${cmd}\` yet. Type \`help\` to see what I can do.`, `Command not found: \`${cmd}\`. Try \`help\`, or ask me \`what is <something>\`.`]), 'thinking');
      }
    }
  }

  /** `log export`: the progress report as JSON, copied to the clipboard when the browser allows it, else shown. */
  private async logExport() {
    const t = this.term;
    const text = `${readableReport()}\n\n--- progress (JSON) ---\n${JSON.stringify(progressReport(), null, 2)}`;
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { /* no clipboard here: show it below */ }
    if (copied) return t.print(`Copied your playtest log (per-step summary and progress) to the clipboard (${text.length} characters).`, 'dim');
    void t.block(h('figure', { class: 'term-art' }, h('pre', null, text)), 'instant');
    t.print('The clipboard is not available here. Copy the log above.', 'dim');
  }

  private help() {
    const rows: [string, string][] = [
      ['next', 'continue where TAPEOUT recommends'],
      ['map', 'open the campaign map'],
      ['ls [act]', 'list the curriculum (e.g. `ls 3`)'],
      ['learn <name>', 'open any lesson or lab (e.g. `learn cache`)'],
      ['play [game]', 'the arcade: minigames TAPEOUT built'],
      ['quiz', 'a quick interview question'],
      ['practice [skill]', 'endless generated problems; no argument = a daily mix'],
      ['skills [role]', 'your skill matrix: every topic, levels 0-3'],
      ['roles [role]', 'job readiness for every role (DV, PD, quantum…)'],
      ['checkpoint [name]', 'list or start checkpoint quizzes (no hints)'],
      ['incidents [name]', 'on-call investigations: find the root cause against the clock'],
      ['what is <term>', `look up any of ${GLOSSARY.length} terms`],
      ['status', 'your rank, XP and progress'],
      ['career', 'your rank story, the roles you are hired for, the next hiring panel'],
      ['speed <s>', 'how fast I type: slow | normal | fast | instant'],
      ['settings', 'open Settings.app (typing speed, with a preview)'],
      ['name <n>', 'change your name'],
      ['clear', 'clear the screen'],
    ];
    this.term.block(h('table', { class: 'term-table' }, ...rows.map(([c, d]) => h('tr', null, h('td', null, h('code', null, c)), h('td', null, ...rich(d))))));
    this.term.print('During lessons: `hint`, `skip` (reveal the answer), `quit`.', 'dim');
  }

  private printActs() {
    this.term.block(h('div', { class: 'term-acts' }, ...ACTS.map((a) => {
      const p = actProgress(a);
      return h('button', { class: 'term-act', onclick: () => this.run(`ls ${a.n}`) },
        h('span', { class: 'n' }, `ACT ${a.n}`), h('b', null, a.name), h('span', { class: 'bar' }, bar(p.frac, 12)), h('span', { class: 'dim' }, `${p.done}/${p.total}`),
        h('span', { class: 'dim tagline' }, a.tagline));
    })));
  }

  private printAct(arg: string) {
    const a = ACTS.find((x) => String(x.n) === arg || x.id === arg.toLowerCase() || x.name.toLowerCase().startsWith(arg.toLowerCase()));
    if (!a) return this.term.print(`No act "${arg}". Acts are 1-${ACTS.length}.`, 'err');
    this.term.print(`ACT ${a.n} · ${a.name.toUpperCase()}`, 'hl');
    for (const c of a.chapters) {
      this.term.block(h('div', { class: 'term-ch' }, h('div', { class: 'dim' }, `  ${c.name}`), ...c.modules.map((m) => {
        const rec = levelRecord(m.id);
        return h('button', { class: `term-mod${rec ? ' done' : ''}`, onclick: () => this.run(`learn ${m.id}`) },
          h('span', { class: 'chk' }, rec ? '✓' : '·'), h('span', null, m.title), h('span', { class: 'dim' }, ` ${KIND_LABEL[m.kind].toLowerCase()}`), rec ? starEls(rec.stars) : null);
      })));
    }
  }

  private printGames() {
    this.term.block(h('div', { class: 'term-ch' }, ...MINIGAMES.map((g) => h('button', { class: 'term-mod', onclick: () => this.run(`play ${g.id}`) },
      h('span', { class: 'chk' }, g.icon), h('span', null, g.title), h('span', { class: 'dim' }, ` ${g.blurb}`)))));
  }

  private findModuleByText(s: string): Module | undefined {
    const q = s.toLowerCase().trim();
    if (!q) return undefined;
    return ALL_MODULES.find((m) => m.id === q) ?? ALL_MODULES.find((m) => m.title.toLowerCase() === q)
      ?? ALL_MODULES.find((m) => m.kind === 'lesson' && (m.title.toLowerCase().includes(q) || m.concept.toLowerCase().split(/[ ,/]+/).includes(q)));
  }

  async openModule(m: Module): Promise<void> {
    if (m.kind === 'lesson' || m.kind === 'final' || m.kind === 'boss') { await this.runLesson(m.id); return; }
    if (m.kind === 'practice') return this.practiceCmd(m.id);
    if (m.kind === 'incident') return this.incident(m.id);
    await this.term.say(pickOne([`Opening **${KIND_APP[m.kind]}** for **${m.title}**.`, `Let me pull up **${KIND_APP[m.kind]}**. This one is **${m.title}**.`, `**${m.title}**. I will open ${KIND_APP[m.kind]} for you.`]), 'excited');
    this.go(m.route);
  }

  private status() {
    const p = profile(), xp = totalXp(), r = rank(xp);
    const t = this.term;
    t.print(`**${p?.name ?? 'unknown'}** · ${r.title} · ${xp} XP`, 'hl');
    t.print(`career: ${RANKS.map((x, i) => (i === r.index ? `[${x.title}]` : x.title)).join(' → ')}`, 'dim');
    t.print(`readiness ${bar(readiness() / 100)} ${readiness()}%`);
    for (const a of ACTS) { const pr = actProgress(a); t.print(`act ${a.n} ${bar(pr.frac, 12)} ${pr.done}/${pr.total}  ${a.name}`, 'mono'); }
    const mastered = CARDS.filter((c) => (load().cards[c.id]?.box ?? 0) >= 3).length;
    t.print(`interview cards mastered: ${mastered}/${CARDS.length}`, 'dim');
  }

  private async define(q: string) {
    const e = lookup(q);
    if (!e) return this.term.say(`I do not have "${q.replace(/^what (is|are) /i, '')}" in my memory banks yet. Try a related term, or \`ls\` for everything I teach.`, 'thinking');
    const term = e.terms[0].length <= 4 ? e.terms[0].toUpperCase() : e.terms[0][0].toUpperCase() + e.terms[0].slice(1);
    await this.term.say(`**${term}**: ${e.def}`, 'thinking');
    const l = e.lesson && findLesson(e.lesson);
    if (l) this.term.line(h('button', { class: 'term-chip inline', onclick: () => this.run(`learn ${l.id}`) }, `learn more: ${l.title} →`));
  }

  private async quiz() {
    const p = load();
    const now = Date.now();
    const due = CARDS.filter((c) => (p.cards[c.id]?.due ?? 0) <= now);
    const card = pickOne(due.length ? due : CARDS);
    const deck = DECKS.find((d) => d.id === card.deck)!.name;
    await this.term.say(`Interview question (${deck}): ${card.q}`, 'thinking');
    const order = card.c.map((_, i) => i).sort(() => Math.random() - 0.5);
    const i = await this.term.choose(order.map((j) => card.c[j]), 'answer>');
    const ok = order[i] === card.a;
    updateCard(card.id, ok);
    await this.term.say(`${ok ? pickOne(PRAISE) : `Not quite. It is: **${card.c[card.a]}**.`} ${card.why}`, ok ? 'happy' : 'concerned');
    this.term.print('Type `quiz` for another, or open the Interview Gauntlet on the map for a full session.', 'dim');
  }

  // ---------------------------------------------------------------- mastery: practice, skills, roles, bosses

  private async practiceCmd(arg: string, endless = false): Promise<void> {
    const t = this.term;
    const q = arg.trim().toLowerCase().replace(/^--?endless\s*/, '');
    if (/--?endless/.test(arg)) endless = true;
    if (!q || q === 'mix' || q === 'daily') {
      const learned = PRACTICE.filter((p) => SKILLS.some((s) => s.practice.includes(p.id) && (skillLevel(s) >= 1 || !!levelRecord(p.id))));
      if (!learned.length) return t.say('The daily mix draws from topics you have already learned. Finish a lesson first (try `next`), then come back.', 'thinking');
      // One record for every Daily Mix: it keeps the best result. The daily goal and its streak are shown up front.
      if (!endless) t.print(streakLine(dailyGoal(), dayKey()), 'dim');
      return this.guarded(() => this.practiceRun(learned, { id: MIX_RECORD, title: 'Daily Mix', concept: `${learned.length} topics you have learned`, xp: 40, endless, mix: true }));
    }
    const skill = findSkill(q);
    const set = findPractice(q) ?? findPractice(`practice-${q}`) ?? (skill ? skill.practice.map(findPractice).find(Boolean) : undefined);
    if (!set) {
      const lab = skill?.practice[0];
      if (lab) { const m = findModule(lab); if (m) return this.openModule(m.module); }
      return t.say(`I have no practice set for "${arg}" yet. Type \`skills\` to see what exists, or \`practice\` for a mix.`, 'thinking');
    }
    return this.guarded(() => this.practiceRun([set], { id: set.id, title: set.title, concept: set.concept, xp: set.xp, endless }));
  }

  private async guarded(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } catch (e) {
      if (e instanceof Interrupted) { if (!(e instanceof Redirect)) this.term.print('(paused, run it again any time)', 'dim'); }
      else throw e;
    } finally { this.busy = false; setMood('neutral'); }
  }

  private async practiceRun(sets: PracticeSet[], o: { id: string; title: string; concept: string; xp: number; endless: boolean; mix?: boolean }) {
    const t = this.term;
    void t.progress(o.endless ? 'spinning up endless practice' : `generating ${PRACTICE_COUNT} problems`);
    void t.block(h('div', { class: 'term-banner practice' },
      h('span', { class: 'dim' }, o.endless ? 'ENDLESS PRACTICE · type quit to stop' : `PRACTICE · ${PRACTICE_COUNT} problems · difficulty climbs as you get them right`),
      h('b', null, o.title), h('span', { class: 'dim' }, o.concept)), 'type', 2.5);
    if (!o.endless) t.print(`To pass: ${PRACTICE_PASS}/${PRACTICE_COUNT} right on the first try, with at least ${PRACTICE_HARD} at ◆◆◆ hard.`, 'dim');
    let d: Difficulty = o.endless ? 1 : PRACTICE_START, run = 0, streak = 0, bestStreak = 0, lastSet = -1, lastGen = -1;
    /** After a walkthrough, the next problem is "your turn": the same kind, at the same difficulty. */
    let yourTurn: { si: number; gen: number; d: Difficulty; method?: string } | undefined;
    const results: { ok: boolean; d: Difficulty }[] = [];
    try {
      for (let i = 0; o.endless || i < PRACTICE_COUNT || yourTurn; i++) {
        // A walkthrough on the last problem still gets its "your turn", as an unscored bonus.
        const bonus = !o.endless && i >= PRACTICE_COUNT;
        let si: number, q: Question, gen: number;
        if (yourTurn) {
          ({ si, gen } = yourTurn);
          d = yourTurn.d;
          // Redraw until the new problem uses the method just taught (generators mix several variants).
          q = sets[si].gens[gen](Math.random, d);
          for (let k = 0; k < 30 && q.teach?.method !== yourTurn.method; k++) q = sets[si].gens[gen](Math.random, d);
          yourTurn = undefined;
          await t.say(pickOne(['Your turn. Same kind of problem, new numbers: use the same steps.', 'Now you try one like it, on your own. Same method, different numbers.', 'Your turn: same method, fresh numbers. Take it one step at a time.']), 'excited');
        } else {
          si = Math.floor(Math.random() * sets.length);
          ({ q, gen } = problem(sets[si], Math.random, d, si === lastSet ? lastGen : -1));
        }
        lastSet = si; lastGen = gen;
        t.print(`${o.endless ? `#${i + 1}` : bonus ? '[bonus, unscored]' : `[${i + 1}/${PRACTICE_COUNT}]`}  ${'◆'.repeat(d)}${'◇'.repeat(3 - d)} ${['warm-up', 'standard', 'hard'][d - 1]}${o.mix ? ` · ${sets[si].title}` : ''}${o.endless ? ` · streak ${streak}` : ''}`, 'dim');
        const ok = await this.question(q, false);
        if (this.taught && !bonus) yourTurn = { si, gen, d, method: q.teach?.method };
        if (bonus) continue;
        results.push({ ok, d });
        streak = ok ? streak + 1 : 0;
        bestStreak = Math.max(bestStreak, streak);
        if (o.endless && streak > 0 && streak % 5 === 0) await t.say(pickOne([`${streak} in a row!`, `Streak of ${streak}. You are on fire, {name}.`, `${streak} straight. The simulator is scared of you.`]), 'excited');
        const nx = rampStep(d, run, ok);
        if (nx.d > d) t.print(`▲ difficulty up: ${['warm-up', 'standard', 'hard'][nx.d - 1]}`, 'ok');
        ({ d, run } = nx);
      }
    } catch (e) {
      if (!(e instanceof Interrupted) || !o.endless) throw e;
    }
    const ok = results.filter((x) => x.ok).length, hard = results.filter((x) => x.ok && x.d === 3).length;
    if (o.endless) {
      const prev = best()[`streak.${o.id}`] ?? 0;
      recordBest(`streak.${o.id}`, bestStreak);
      void t.block(h('div', { class: 'term-done' }, h('div', null, h('b', null, 'ENDLESS RUN OVER')),
        h('div', { class: 'dim' }, `${ok}/${results.length} first try · best streak ${bestStreak}${bestStreak > prev ? ' (new record!)' : ` (record ${prev})`}`)), 'type', 2);
      return;
    }
    const grade = gradePractice(results);
    // A Daily Mix finishes the day's goal (the streak, and milestone bonuses) and banks its best result; other sets use award().
    let gained = 0, promotedTo: Promotion | undefined, goal: GoalResult | undefined;
    if (o.mix) {
      goal = finishGoal(grade ? { xp: o.xp, stars: grade } : undefined);
      ({ gained, promotedTo } = goal);
    } else if (grade) ({ gained, promotedTo } = award(o.id, o.xp, grade));
    void t.block(h('div', { class: 'term-done' },
      h('div', null, h('b', null, grade ? 'PRACTICE PASSED' : 'PRACTICE RUN COMPLETE'), ' ', grade ? starEls(grade) : null),
      h('div', { class: 'dim' }, `${ok}/${PRACTICE_COUNT} first try · ${hard} at hard${grade ? ` · ${gained ? `+${gained} XP` : 'no new XP'}` : ` · need ${PRACTICE_PASS} with ${PRACTICE_HARD} hard to pass`}`)), 'type', 2);
    if (goal) {
      t.print(streakLine(dailyGoal(), dayKey()), 'dim');
      for (const m of goal.reached) await t.say(`**${m} days played.** That is a milestone: +${MILESTONE_XP} XP, paid once.`, 'proud');
    }
    if (promotedTo) await t.say(promotionLine(promotedTo), 'excited');
    await t.say(grade === 3 ? 'Near perfect at full difficulty. This topic is yours.' : grade ? 'Passed. That is practised, not just aware: it counts toward your skill level.' : ok >= 6 ? 'Close. The hard ones are where it counts; run it again.' : 'Keep at it. Every miss came with an explanation; a second run always goes better.', grade ? 'proud' : 'thinking');
    const next = grade && !o.mix ? neighbours(o.id).next : undefined;
    const opts = [...(next ? [`Continue: **${next.title}** (${KIND_LABEL[next.kind].toLowerCase()})`] : []), 'Run it again', 'Endless mode', 'Back to the shell'];
    const pick = await t.choose(opts, 'next>', (v) => this.queue.push(v));
    const k = opts[pick];
    if (next && pick === 0) this.queue.push(`learn ${next.id}`);
    else if (k === 'Run it again') this.queue.push(o.mix ? 'practice' : `practice ${o.id}`);
    else if (k === 'Endless mode') this.queue.push(o.mix ? 'endless mix' : `endless ${o.id}`);
  }

  private async skillsCmd(arg: string) {
    const t = this.term;
    const q = arg.trim().toLowerCase();
    const skill = q ? findSkill(q) ?? SKILLS.find((s) => s.name.toLowerCase().includes(q)) : undefined;
    if (skill) return this.printSkill(skill.id);
    const role = q ? ROLES.find((r) => r.id === q || r.name.toLowerCase().includes(q)) : undefined;
    this.go(role ? `#/skills/${role.id}` : '#/skills');
    const lv = [0, 0, 0, 0];
    SKILLS.forEach((s) => lv[skillLevel(s)]++);
    t.print(`${SKILLS.length} skills · ${lv[3]} job-ready · ${lv[2]} practised · ${lv[1]} aware · ${lv[0]} not started`, 'hl');
    await t.say('Opening **Skills.app**: every row of the curriculum audit, with your level in each. Level 3 means job-ready. Type `skill <name>` for one skill\'s ladder, or `roles` to see how ready you are for each job.', 'happy');
  }

  private printSkill(id: string) {
    const t = this.term;
    const s = findSkill(id)!;
    const lv = skillLevel(s);
    t.print(`SKILL · ${s.name}`, 'hl');
    t.print(`level ${lv}/3 ${'●'.repeat(lv)}${'○'.repeat(3 - lv)} ${LEVEL_NAME[lv]}${skillCeiling(s) < 3 ? ` · levels above ${skillCeiling(s)} are still being built (${s.plan ?? 'planned'})` : ''}`, 'dim');
    const tiers: ['learn' | 'practice' | 'boss', string][] = [['learn', '1 · Learn'], ['practice', '2 · Practice'], ['boss', '3 · Checkpoint']];
    for (const [k, label] of tiers) {
      const ids = s[k];
      this.term.block(h('div', { class: 'term-ch' }, h('div', { class: 'dim' }, `  ${label}`), ...(ids.length ? ids.map((mid) => {
        const f = findModule(mid), rec = levelRecord(mid);
        return h('button', { class: `term-mod${rec ? ' done' : ''}`, onclick: () => this.run(`learn ${mid}`) },
          h('span', { class: 'chk' }, rec ? '✓' : '·'), h('span', null, f?.module.title ?? mid), h('span', { class: 'dim' }, f ? ` ${KIND_LABEL[f.module.kind].toLowerCase()}` : ''), rec ? starEls(rec.stars) : null);
      }) : [h('div', { class: 'dim' }, `    in development: ${s.plan ?? 'coming soon'}`)])));
    }
    const nx = nextStep(s);
    if (nx) t.line(h('button', { class: 'term-chip inline', onclick: () => this.run(`learn ${nx.id}`) }, `next step: ${findModule(nx.id)?.module.title ?? nx.id} →`));
  }

  private async careerCmd() {
    const t = this.term, c = career();
    t.print(`CAREER · ${c.title} · ${c.xp} XP`, 'hl');
    t.print(`${c.scope}: ${c.story}`, 'dim');
    t.print(`${RANKS.map((x) => (x.title === c.title ? `[${x.title}]` : x.title)).join(' → ')}`, 'dim');
    if (c.next) t.print(`${bar(c.progress, 20)} ${c.next.need} XP to ${c.next.title}`, 'mono');
    else t.print('You have reached the top of the ladder. The rest is for the love of it.', 'dim');
    if (c.hired.length) t.print(`Hired as: ${c.hired.map((r) => r.name).join(', ')}`, 'hl');
    else t.print('Not hired yet. Each role ends in a hiring panel: 12 hard questions, no hints.', 'dim');
    if (c.closest.length) {
      t.print('Closest to a hiring panel:', 'dim');
      this.term.block(h('div', { class: 'term-ch' }, ...c.closest.map(({ role, readiness }) =>
        h('button', { class: 'term-mod', onclick: () => this.run(`learn ${capstoneId(role)}`) },
          h('span', { class: 'chk' }, role.icon), h('span', { class: 'mono' }, `${bar(readiness, 10)} ${String(Math.round(readiness * 100)).padStart(3)}%  `), h('span', null, role.name)))));
    }
  }

  private async rolesCmd(arg: string) {
    const t = this.term;
    const q = arg.trim().toLowerCase();
    const role = q ? ROLES.find((r) => r.id === q || r.name.toLowerCase().includes(q)) : undefined;
    if (q && !role) return t.print(`No role "${arg}". Type \`roles\` to list them.`, 'err');
    if (!role) {
      t.print('JOB READINESS · every role in the industry', 'hl');
      this.term.block(h('div', { class: 'term-ch' }, ...ROLES.map((r) => {
        const pct = roleReadiness(r.id);
        return h('button', { class: 'term-mod', onclick: () => this.run(`roles ${r.id}`) },
          h('span', { class: 'chk' }, r.icon), h('span', { class: 'mono' }, `${bar(pct, 10)} ${String(Math.round(pct * 100)).padStart(3)}%  `), h('span', null, r.name));
      })));
      return t.print('Click a role, or `roles dv`, for the skills it needs.', 'dim');
    }
    const ss = SKILLS.filter((s) => s.roles === 'all' || s.roles.includes(role.id as RoleId));
    t.print(`${role.icon} ${role.name.toUpperCase()} · ${Math.round(roleReadiness(role.id) * 100)}% job-ready`, 'hl');
    t.print(role.blurb, 'dim');
    this.term.block(h('div', { class: 'term-ch' }, ...ss.map((s) => {
      const lv = skillLevel(s);
      return h('button', { class: `term-mod${lv === 3 ? ' done' : ''}`, onclick: () => this.run(`skill ${s.id}`) },
        h('span', { class: 'chk mono' }, `${'●'.repeat(lv)}${'○'.repeat(3 - lv)}`), h('span', null, s.name), h('span', { class: 'dim' }, ` ${s.area.toLowerCase()}`));
    })));
    this.go(`#/skills/${role.id}`);
  }

  private printBosses() {
    this.term.print('CHECKPOINTS · realistic tasks, no hints, one attempt per question', 'hl');
    this.term.block(h('div', { class: 'term-ch' }, ...BOSSES.map((b) => {
      const rec = levelRecord(b.id);
      return h('button', { class: `term-mod${rec ? ' done' : ''}`, onclick: () => this.run(`learn ${b.id}`) },
        h('span', { class: 'chk' }, rec ? '♛' : '·'), h('span', null, b.title), h('span', { class: 'dim' }, ` ${b.concept}`), rec ? starEls(rec.stars) : null);
    })));
  }

  private printIncidents() {
    this.term.print('INCIDENTS · a pager goes off; instruments cost lab time; the root cause is different every run', 'hl');
    this.term.block(h('div', { class: 'term-ch' }, ...INCIDENTS.map((i) => {
      const rec = levelRecord(i.id);
      return h('button', { class: `term-mod${rec ? ' done' : ''}`, onclick: () => this.run(`learn ${i.id}`) },
        h('span', { class: 'chk' }, rec ? '✓' : '☎'), h('span', null, i.title), h('span', { class: 'dim' }, ` ${i.concept}`), rec ? starEls(rec.stars) : null);
    })));
  }

  private async incident(id: string): Promise<void> {
    const inc = findIncident(id)!;
    const t = this.term;
    return this.guarded(async () => {
      void t.progress(`paging you in: ${inc.title}`);
      const res = await runIncident(t, inc, { define: (q) => this.define(q) });
      if (res.checkpoint) { this.queue.push(`learn ${res.checkpoint}`); return; }
      const next = res.solved ? neighbours(id).next : undefined;
      const opts = [...(next ? [`Continue: **${next.title}** (${KIND_LABEL[next.kind].toLowerCase()})`] : []), res.solved ? 'Replay (a different root cause)' : 'Try again (a different root cause)', 'Back to the shell'];
      const pick = await t.choose(opts, 'next>', (v) => this.queue.push(v));
      if (next && pick === 0) this.queue.push(`learn ${next.id}`);
      else if (opts[pick].startsWith('Replay') || opts[pick].startsWith('Try')) this.queue.push(`incident ${id}`);
    });
  }

  // ---------------------------------------------------------------- lessons

  async runLesson(id: string) {
    if (findIncident(id)) return this.incident(id);
    const exam = id === FINAL_ID;
    const bossDef = findBoss(id);
    const lesson: Lesson | undefined = exam ? finalExam(Math.random) : bossDef ?? findLesson(id);
    if (!lesson) return this.term.print(`unknown lesson ${id}`, 'err');
    if (this.busy) return;
    this.busy = true;
    try {
      await this.lesson(lesson, exam ? 'final' : bossDef ? 'boss' : 'lesson');
    } catch (e) {
      if (e instanceof Interrupted) { if (this.at) recordQuit(this.at.id, this.at.step); if (!(e instanceof Redirect)) this.term.print('(lesson paused, run it again any time)', 'dim'); }
      else throw e;
    } finally {
      this.busy = false;
      this.at = null;
      setMood('neutral');
    }
  }

  private async lesson(l: Lesson, mode: 'lesson' | 'final' | 'boss') {
    const t = this.term;
    const f = findModule(l.id);
    const exam = mode !== 'lesson';
    const bossDef = mode === 'boss' ? (l as Boss) : undefined;
    if (bossDef) void t.bossIntro(l.title);
    else void t.progress(mode === 'final' ? 'assembling the tapeout review' : `loading level: ${l.title}`);
    void t.block(h('div', { class: `term-banner${bossDef ? ' boss' : ''}` },
      h('span', { class: 'dim' }, bossDef ? `${l.id.startsWith('cap-') ? 'HIRING PANEL' : 'CHECKPOINT'} · no hints · one attempt per question · ${Math.round(bossDef.pass * 100)}% to win` : f ? `ACT ${f.act.n} · ${f.chapter.name.toUpperCase()}` : 'LESSON'),
      h('b', null, l.title), h('span', { class: 'dim' }, l.concept)), 'type', 2.5);
    if (!exam) printGoals(t, l.id);
    const rnd = Math.random;
    let asked = 0, firstTry = 0;
    const skippedQs: { n: number; q: Question }[] = [];
    const comeBack: Question[] = [];
    for (let i = 0; i < l.steps.length; i++) {
      const s = l.steps[i];
      const nextIsQuestion = (() => { const n = l.steps[i + 1]; return !n || n.t === 'ask' || n.t === 'mc' || n.t === 'gen' || n.t === 'app' || n.t === 'art'; })();
      if (s.t === 'say') {
        await t.say(s.text, s.mood);
        if (!nextIsQuestion) await t.pause();
      } else if (s.t === 'art') {
        void t.art(s.text, s.caption);
        if (!nextIsQuestion) await t.pause();
      } else if (s.t === 'app') {
        await t.say(s.text, 'excited');
        t.print(`▣ opening ${s.game}.app ...`, 'dim');
        const res = await launchGame(s.game, { rounds: s.rounds, fromLesson: true });
        await t.say(res ? `Back to it. (${res.score}/${res.max} in the game.)` : 'Skipped the game? No problem, you can play it later with `play`.', res ? 'happy' : 'neutral');
      } else {
        const q = s.t === 'gen' ? s.make(rnd) : s;
        asked++;
        this.at = { id: l.id, step: i };
        const t0 = Date.now();
        this.rung = 0;
        this.revealed = false;
        const ok = await this.question(q, exam);
        if (mode === 'lesson') recordStep(l.id, i, q.q, { firstTry: ok && this.rung === 0, hints: this.rung, secs: (Date.now() - t0) / 1000, skipped: this.skipped });
        if (ok) firstTry++;
        else if (this.skipped) skippedQs.push({ n: asked, q });
        if (!ok && this.revealed && !this.skipped && mode === 'lesson') comeBack.push(q);
      }
    }
    // Hint ladder, last rung: a question the player was shown the answer to comes back once, near the end.
    if (comeBack.length) {
      await t.say('One more look at ' + (comeBack.length === 1 ? 'a question' : 'some questions') + ' from earlier. You have seen how it works now.', 'happy');
      for (const q of comeBack) { this.rung = 0; this.revealed = false; await this.question(q, false); }
    }
    // A lesson skipped by more than half stays unsigned: no level record, no XP, nothing lights on the chip.
    if (mode === 'lesson' && !signsOff(asked, skippedQs.length)) return this.unsigned(l, asked, skippedQs);
    // grading
    const misses = asked - firstTry;
    let st: number;
    if (bossDef) {
      const pct = asked ? firstTry / asked : 0;
      st = pct >= 0.95 ? 3 : pct >= bossDef.pass - 1e-9 ? 2 : 0;
      t.print(`score: ${firstTry}/${asked} (${Math.round(pct * 100)}%) · need ${Math.round(bossDef.pass * 100)}%`, 'hl');
      if (!st) {
        await t.say(pickOne(['The checkpoint wins this round. Every miss above tells you exactly what to practise; come back when you are ready.', 'Not this time. That is normal for a checkpoint: go run the practice sets, then come back and take it down.']), 'concerned');
        return;
      }
    } else if (exam) {
      const pct = asked ? firstTry / asked : 0;
      st = pct >= 0.9 ? 3 : pct >= 0.75 ? 2 : pct >= 0.6 ? 1 : 0;
      t.print(`score: ${firstTry}/${asked} (${Math.round(pct * 100)}%)`, 'hl');
      if (!st) { await t.say('Not quite enough to sign off yet: you need 60%. Every question you missed points at a lesson worth revisiting. Try again whenever you are ready.', 'concerned'); return; }
    } else st = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
    const { gained, promotedTo } = award(l.id, l.xp, st);
    const card = h('div', { class: 'term-done' },
      h('div', null, h('b', null, bossDef ? (l.id.startsWith('cap-') ? 'PANEL PASSED' : 'CHECKPOINT PASSED') : exam ? 'TAPEOUT REVIEW PASSED' : 'LESSON COMPLETE'), ' ', starEls(st)),
      h('div', { class: 'dim' }, `${firstTry}/${asked} first try · ${gained ? `+${gained} XP` : 'no new XP (you already did better)'}`),
      l.recap.length ? h('ul', { class: 'recap' }, ...l.recap.map((r) => h('li', null, ...rich(r)))) : null);
    void t.block(card, 'type', 1.6);
    const mood: Mood = st === 3 ? 'proud' : st === 2 ? 'happy' : 'neutral';
    if (promotedTo) await t.say(promotionLine(promotedTo), 'excited');
    if (bossDef) await t.say(pickOne(['Checkpoint passed. That is job-level work, {name}: no hints, no second tries.', 'Defeated. Somewhere a senior engineer just nodded approvingly.', 'That is the real thing. You earned that level.']), 'proud');
    else if (mode === 'final') await t.say('That is it. Every block signed off, every question answered. Your chip is ready for tapeout. For real next steps: put a design on silicon with Tiny Tapeout, and bring these answers to your interviews. I am proud of you, {name}.', 'proud');
    else await t.say(st === 3 ? pickOne(['Flawless. Onward.', 'Perfect run. You make this look easy.', 'Every question first try. Nice.']) : st === 2 ? 'Good work. A couple of stumbles, which is exactly how learning is supposed to feel.' : 'Done. This one was tough; come back and replay it for more stars later.', mood);
    const nx = neighbours(l.id).next;
    if (nx && mode !== 'final') {
      const pick = await t.choose([`Continue: **${nx.title}** (${KIND_LABEL[nx.kind].toLowerCase()})`, 'Back to the shell'], 'next>', (v) => this.queue.push(v));
      if (pick === 0) this.queue.push(`learn ${nx.id}`);
    }
  }

  /** The sign-off card for a lesson skipped by more than half: how many were skipped, and a walkthrough for each one. */
  private async unsigned(l: Lesson, asked: number, skipped: { n: number; q: Question }[]) {
    const t = this.term;
    void t.block(h('div', { class: 'term-done' },
      h('div', null, h('b', null, 'LESSON NOT SIGNED OFF')),
      h('div', { class: 'dim' }, `${skipped.length} of ${asked} questions skipped. Skipping more than half does not sign a lesson off: no level, no XP yet.`)), 'type', 1.6);
    await t.say('Skipping is fine, but I cannot count a lesson you mostly skipped. Walk through the questions you skipped, then try it again.', 'concerned');
    const open = skipped.filter((x) => x.q.teach);
    for (const x of skipped.filter((y) => !y.q.teach)) t.print(`Question ${x.n} has no walkthrough. Its answer was shown when you skipped it.`, 'dim');
    for (;;) {
      const opts = [...open.map((x) => `Walk me through question ${x.n}`), 'Try this lesson again', 'Back to the shell'];
      const pick = await t.choose(opts, 'next>', (v) => this.queue.push(v));
      if (pick < open.length) { const [x] = open.splice(pick, 1); await this.walkThrough(x.q); continue; }
      if (opts[pick] === 'Try this lesson again') this.queue.push(`learn ${l.id}`);
      return;
    }
  }

  /** Say a question; a ```fenced``` part is shown as a code block (logs, source, schematics). */
  private async pose(text: string) {
    void this.term.beat();
    const parts = text.split('```');
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].replace(/^\n+|\n+$/g, '');
      if (!p) continue;
      if (i % 2) void this.term.art(p);
      else await this.term.say(p, 'thinking');
    }
  }

  /** Ask one question. Returns true if answered correctly on the first attempt. Sets `taught` if it was walked through. */
  private async question(q: Question, exam: boolean): Promise<boolean> {
    const t = this.term;
    this.taught = false;
    this.skipped = false;
    const teach = !exam && q.teach ? q.teach : undefined;
    if (q.t === 'mc') {
      await this.pose(q.q);
      // Shuffle the display order so the answer's position gives nothing away (unless options refer to each other).
      const order = this.order(q.options);
      const labels = order.map((j) => q.options[j]);
      const i = await t.choose(teach ? [...labels, TEACH_OPTION] : labels, 'answer>');
      if (teach && i === labels.length) { await this.walkThrough(q); return false; }
      const ok = order[i] === q.a;
      if (exam) { t.print(ok ? '✓' : `✗ answer: ${q.options[q.a]}`, ok ? 'ok' : 'err'); return ok; }
      await t.say(`${ok ? pickOne(PRAISE) : `Not quite: it is **${q.options[q.a]}**.`} ${q.why}`, ok ? 'happy' : 'concerned');
      if (!ok && teach) await this.offerWalk(q);
      return ok;
    }
    await this.pose(q.q);
    const tries = exam ? 1 : 4;
    let first = true, gaveUp = false;
    for (let k = 0; k < tries; k++) {
      const v = (await t.ask({ prompt: 'answer>', chips: exam ? [] : ['hint', ...(teach ? [{ label: 'teach me how', value: 'teach me' }] : []), 'skip'] })).trim();
      const lc = v.toLowerCase();
      if (teach && TEACH_WORDS.test(lc)) { this.rung = Math.max(this.rung, 3); await this.walkThrough(q); return false; }
      if (!exam && (lc === 'hint' || lc === 'h' || lc === '?')) {
        first = false;
        await t.say(this.ladder(q, !!teach), 'thinking');
        k--;
        continue;
      }
      if (['quit', 'exit'].includes(lc)) throw new Interrupted();
      if (!exam && /^(what|who|define|explain|help)\b/.test(lc)) {
        // A question back to TAPEOUT, not an answer: look it up and ask again.
        if (lc === 'help') this.term.print(`Type your answer, or \`hint\`,${teach ? ' `teach me`,' : ''} \`skip\`, \`quit\`. You can also ask me \`what is <term>\`.`, 'dim');
        else await this.define(v.replace(/^(define|explain)\s+/i, ''));
        k--;
        continue;
      }
      if (!exam && ['skip', 'idk', "i don't know", 'pass', 'give up'].includes(lc)) { gaveUp = true; break; }
      if (!v) { k--; continue; }
      if (q.a.check(v)) {
        if (exam) t.print('✓', 'ok');
        else await t.say(`${pickOne(PRAISE)} ${q.why}`, 'happy');
        return first;
      }
      first = false;
      if (exam) break;
      // A miss climbs the hint ladder: a nudge, then a bigger hint, then a worked example, then the answer.
      if (k < tries - 1) await t.say(`Not quite. ${this.ladder(q, !!teach)}`, 'concerned');
    }
    if (exam) { t.print(`✗ answer: ${q.a.canonical}`, 'err'); return false; }
    if (teach) { await this.offerWalk(q); if (this.taught) return false; }
    this.skipped = gaveUp;
    this.revealed = true;
    await t.say(`The answer is **${q.a.canonical}**. ${q.why} We will come back to this one in a moment.`, 'concerned');
    return false;
  }

  /**
   * The hint ladder for a typed answer. Each call goes one rung up: a nudge, a bigger hint (the shape of the answer,
   * or the walk-through if the question has one), then a worked example. After that, the answer is shown and the
   * question comes back later.
   */
  private ladder(q: Question, teach: boolean): string {
    const rung = this.rung++;
    if (rung === 0) return q.t === 'ask' && q.hint ? `Nudge: ${q.hint}${teach ? ' (Still stuck? Type `teach me` and I will walk you through it.)' : ''}` : 'Nudge: read the question again, and try the smallest piece of it first.';
    if (rung === 1) {
      const c = q.t === 'ask' ? q.a.canonical : '';
      const shape = /^-?\d+$/.test(c) ? `The answer is a whole number with ${c.replace('-', '').length} digit${c.replace('-', '').length === 1 ? '' : 's'}.`
        : /^[01]+$/.test(c) ? `The answer is ${c.length} bits long, only 0s and 1s.`
          : c ? `The answer starts with "${c[0]}".` : 'Think about what each choice would do.';
      return `Bigger hint: ${shape}${teach ? ' Or type `teach me` for a walk-through.' : ''}`;
    }
    if (rung === 2) return `Worked example: ${q.why} Now type the answer yourself.`;
    return 'That is every hint I have. Type `skip` and I will show the answer and bring it back later.';
  }

  /** Display order for options: shuffled, unless the options refer to each other ("both of the above"). */
  private order(options: string[]): number[] {
    const order = options.map((_, i) => i);
    if (!options.some((o) => /\babove\b|\bbelow\b|^(both|neither|none|all) /i.test(o))) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return order;
  }

  /** After a miss: learn the method now, or move on. */
  private async offerWalk(q: Question) {
    const pick = await this.term.choose(['Walk me through how to solve it', q.t === 'ask' ? 'Just show me the answer' : 'Got it, next problem'], 'next>');
    if (pick === 0) await this.walkThrough(q);
  }

  /** Teach the method on this very problem, one small step at a time. The player does each step. */
  private async walkThrough(q: Question) {
    const t = this.term, w = q.teach!;
    this.taught = true;
    await t.say(`Let us work it out together. **The method: ${w.method}.** ${w.idea}`, 'thinking');
    let n = 0;
    for (const b of w.beats) {
      if (b.t === 'tell') { await t.say(b.text); continue; }
      if (b.t === 'show') { void t.art(b.text, b.caption); continue; }
      n++;
      if (b.t === 'pick') {
        await this.pose(`**Step ${n}.** ${b.q}`);
        const order = this.order(b.options);
        const i = await t.choose(order.map((j) => b.options[j]), `step ${n}>`);
        const ok = order[i] === b.a;
        await t.say(`${ok ? pickOne(PRAISE) : `Not that one: it is **${b.options[b.a]}**.`}${b.why ? ` ${b.why}` : ''}`, ok ? 'happy' : 'thinking');
        continue;
      }
      await this.pose(`**Step ${n}.** ${b.q}`);
      let done = false;
      for (let k = 0; k < 2 && !done; k++) {
        const v = (await t.ask({ prompt: `step ${n}>`, chips: [{ label: 'show me this step', value: 'show' }] })).trim();
        const lc = v.toLowerCase();
        if (['quit', 'exit'].includes(lc)) throw new Interrupted();
        if (!v) { k--; continue; }
        if (/^(what|who|define)\b/.test(lc)) { await this.define(v.replace(/^define\s+/i, '')); k--; continue; }
        if (['show', 'show me', 'skip', 'idk', "i don't know", 'hint', 'help'].includes(lc)) break;
        if (b.a.check(v)) { done = true; await t.say(`${pickOne(PRAISE)}${b.why ? ` ${b.why}` : ''}`, 'happy'); }
        else if (k === 0) await t.say(b.hint ? `Not quite. ${b.hint}` : /^[-+0-9.]/.test(b.a.canonical) ? 'Not quite. Check the arithmetic and try once more.' : 'Not quite. Read the step again and try once more.', 'thinking');
      }
      if (!done) await t.say(`It comes to **${b.a.canonical}**.${b.why ? ` ${b.why}` : ''}`, 'thinking');
    }
    if (q.t === 'ask') {
      await t.say(`And that is the answer: **${q.a.canonical}**. ${q.why}`, 'happy');
    } else {
      await t.say('Now, with that worked out: which option is it?', 'thinking');
      const order = this.order(q.options);
      const i = await t.choose(order.map((j) => q.options[j]), 'answer>');
      const ok = order[i] === q.a;
      await t.say(`${ok ? pickOne(PRAISE) : `It is **${q.options[q.a]}**.`} ${q.why}`, ok ? 'happy' : 'thinking');
    }
  }
}

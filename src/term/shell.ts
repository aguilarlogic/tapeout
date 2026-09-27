// TAPEOUT's brain: onboarding, the command shell, and the lesson runner.
import { ACTS, actProgress, ALL_MODULES, findModule, KIND_APP, KIND_LABEL, Module, neighbours, readiness, recommended, startAct } from '../curriculum';
import { CARDS, DECKS } from '../games/drills/cards';
import { GLOSSARY, lookup } from '../glossary';
import { finalExam, FINAL_ID, findLesson } from '../lessons';
import type { Lesson, Mood, Question } from '../lessons/types';
import { MINIGAMES } from '../minigames/apps';
import { setMood } from '../os/avatar';
import { launchGame, randomGame } from '../os/launch';
import { complete, levelRecord, load, playerName, prefs, Prefs, Profile, profile, rank, RANKS, resetAll, setPrefs, setProfile, totalXp, updateCard } from '../state';
import { h, stars as starEls } from '../ui/dom';
import { Interrupted, rich, Terminal } from './terminal';

const pickOne = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const PRAISE = ['Correct.', 'Yes.', 'Exactly.', 'Nice.', 'Right on.', 'That\'s it.'];
const bar = (frac: number, n = 16) => '█'.repeat(Math.round(frac * n)) + '░'.repeat(n - Math.round(frac * n));

export class Shell {
  private queue: string[] = [];
  private busy = false;

  constructor(public term: Terminal, private go: (route: string) => void) {}

  /** Ask the shell to run a command as soon as it can, interrupting whatever it is waiting for. */
  run(cmd: string) {
    this.queue.push(cmd);
    this.term.interrupt();
  }

  async start() {
    await this.boot();
    for (;;) {
      try {
        const cmd = this.queue.shift() ?? (await this.term.ask({ prompt: `${playerName().toLowerCase().replace(/\s+/g, '')}@tapeout:~$`, chips: this.idleChips() }));
        await this.exec(cmd);
      } catch (e) {
        if (!(e instanceof Interrupted)) {
          console.error(e);
          this.term.print(`kernel panic: ${(e as Error).message}. TAPEOUT recovered.`, 'err');
        }
      }
    }
  }

  private idleChips() {
    const next = recommended();
    return [
      ...(next ? [{ label: `▶ next: ${next.title}`, value: 'next' }] : []),
      { label: 'map', value: 'map' },
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
    if (next) await t.say(`Next up: **${next.title}** (${KIND_LABEL[next.kind].toLowerCase()}, ${findModule(next.id)!.act.name}). Type \`next\` or click below. Or ask me anything, like \`what is a latch\`.`);
    else await t.say('You have finished everything. Every block of your chip is signed off. Want to replay something for stars, or run the arcade?', 'proud');
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
    await t.say('How much do you already know about electronics and computers?');
    const bg = await t.choose(['Nothing yet. Start me from zero.', "Some. I'm studying EE, CE or CS.", 'A lot. I work in (or near) the industry.']);
    prof.background = (['new', 'student', 'pro'] as const)[bg];
    await t.say(['Perfect. Everybody starts somewhere, and zero is a great place to start.', 'Great, then you know the basics. We can move fast and fill the gaps.', 'Excellent. Then I will skip the pleasantries and aim for the hard stuff.'][bg], 'happy');
    await t.say('And what do you want to become?');
    const goal = await t.choose(['Digital design engineer (RTL)', 'Verification engineer (DV)', 'Physical design / timing engineer', 'Hardware / board engineer', 'Computer architect', 'A specialist: analog, RF, memory, AI chips, security, quantum...', 'Not sure yet, show me everything']);
    prof.goal = (['design', 'verif', 'pd', 'board', 'arch', 'special', 'unsure'] as const)[goal];
    setProfile(prof);
    await t.say('Here is the plan. Six core acts take you from electrons all the way up to out-of-order cores, and a seventh covers the specialist roles, from analog and RF to quantum computers:');
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
        if (!['slow', 'normal', 'fast', 'instant'].includes(v)) return t.print(`usage: speed slow|normal|fast|instant (now: ${prefs().speed})`, 'dim');
        setPrefs({ speed: v });
        return t.say(`Talking speed set to ${v}.`);
      }
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

  private help() {
    const rows: [string, string][] = [
      ['next', 'continue where TAPEOUT recommends'],
      ['map', 'open the campaign map'],
      ['ls [act]', 'list the curriculum (e.g. `ls 3`)'],
      ['learn <name>', 'open any lesson or lab (e.g. `learn cache`)'],
      ['play [game]', 'the arcade: minigames TAPEOUT built'],
      ['quiz', 'a quick interview question'],
      ['what is <term>', `look up any of ${GLOSSARY.length} terms`],
      ['status', 'your rank, XP and progress'],
      ['speed <s>', 'how fast I talk: slow | normal | fast | instant'],
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

  async openModule(m: Module) {
    if (m.kind === 'lesson' || m.kind === 'final') return this.runLesson(m.id);
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

  // ---------------------------------------------------------------- lessons

  async runLesson(id: string) {
    const exam = id === FINAL_ID;
    const lesson: Lesson | undefined = exam ? finalExam(Math.random) : findLesson(id);
    if (!lesson) return this.term.print(`unknown lesson ${id}`, 'err');
    if (this.busy) return;
    this.busy = true;
    try {
      await this.lesson(lesson, exam);
    } catch (e) {
      if (e instanceof Interrupted) this.term.print('(lesson paused, run it again any time)', 'dim');
      else throw e;
    } finally {
      this.busy = false;
      setMood('neutral');
    }
  }

  private async lesson(l: Lesson, exam: boolean) {
    const t = this.term;
    const f = findModule(l.id);
    t.block(h('div', { class: 'term-banner' },
      h('span', { class: 'dim' }, f ? `ACT ${f.act.n} · ${f.chapter.name.toUpperCase()}` : 'LESSON'),
      h('b', null, l.title), h('span', { class: 'dim' }, l.concept)));
    const rnd = Math.random;
    let asked = 0, firstTry = 0;
    for (let i = 0; i < l.steps.length; i++) {
      const s = l.steps[i];
      const nextIsQuestion = (() => { const n = l.steps[i + 1]; return !n || n.t === 'ask' || n.t === 'mc' || n.t === 'gen' || n.t === 'app' || n.t === 'art'; })();
      if (s.t === 'say') {
        await t.say(s.text, s.mood);
        if (!nextIsQuestion) await t.pause();
      } else if (s.t === 'art') {
        t.art(s.text, s.caption);
        if (!nextIsQuestion) await t.pause();
      } else if (s.t === 'app') {
        await t.say(s.text, 'excited');
        t.print(`▣ opening ${s.game}.app ...`, 'dim');
        const res = await launchGame(s.game, { rounds: s.rounds, fromLesson: true });
        await t.say(res ? `Back to it. (${res.score}/${res.max} in the game.)` : 'Skipped the game? No problem, you can play it later with `play`.', res ? 'happy' : 'neutral');
      } else {
        const q = s.t === 'gen' ? s.make(rnd) : s;
        asked++;
        if (await this.question(q, exam)) firstTry++;
      }
    }
    // grading
    const misses = asked - firstTry;
    let st: number;
    if (exam) {
      const pct = asked ? firstTry / asked : 0;
      st = pct >= 0.9 ? 3 : pct >= 0.75 ? 2 : pct >= 0.6 ? 1 : 0;
      t.print(`score: ${firstTry}/${asked} (${Math.round(pct * 100)}%)`, 'hl');
      if (!st) { await t.say('Not quite enough to sign off yet: you need 60%. Every question you missed points at a lesson worth revisiting. Try again whenever you are ready.', 'concerned'); return; }
    } else st = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
    const before = rank().index;
    const gained = complete(l.id, l.xp, st);
    const after = rank();
    const card = h('div', { class: 'term-done' },
      h('div', null, h('b', null, exam ? 'TAPEOUT REVIEW PASSED' : 'LESSON COMPLETE'), ' ', starEls(st)),
      h('div', { class: 'dim' }, `${firstTry}/${asked} first try · ${gained ? `+${gained} XP` : 'no new XP (you already did better)'}`),
      l.recap.length ? h('ul', { class: 'recap' }, ...l.recap.map((r) => h('li', null, ...rich(r)))) : null);
    t.block(card);
    const mood: Mood = st === 3 ? 'proud' : st === 2 ? 'happy' : 'neutral';
    if (after.index > before) await t.say(`And that means a promotion. You are now a **${after.title}**, {name}!`, 'excited');
    if (exam) await t.say('That is it. Every block signed off, every question answered. Your chip is ready for tapeout. For real next steps: put a design on silicon with Tiny Tapeout, and bring these answers to your interviews. I am proud of you, {name}.', 'proud');
    else await t.say(st === 3 ? pickOne(['Flawless. Onward.', 'Perfect run. You make this look easy.', 'Every question first try. Nice.']) : st === 2 ? 'Good work. A couple of stumbles, which is exactly how learning is supposed to feel.' : 'Done. This one was tough; come back and replay it for more stars later.', mood);
    const nx = neighbours(l.id).next;
    if (nx && !exam) {
      const pick = await t.choose([`Continue: **${nx.title}** (${KIND_LABEL[nx.kind].toLowerCase()})`, 'Back to the shell'], 'next>');
      if (pick === 0) this.queue.push(`learn ${nx.id}`);
    }
  }

  /** Ask one question. Returns true if answered correctly on the first attempt. */
  private async question(q: Question, exam: boolean): Promise<boolean> {
    const t = this.term;
    if (q.t === 'mc') {
      await t.say(q.q, 'thinking');
      const order = q.options.map((_, i) => i);
      const i = await t.choose(order.map((j) => q.options[j]), 'answer>');
      const ok = order[i] === q.a;
      if (exam) { t.print(ok ? '✓' : `✗ answer: ${q.options[q.a]}`, ok ? 'ok' : 'err'); return ok; }
      await t.say(`${ok ? pickOne(PRAISE) : `Not quite: it is **${q.options[q.a]}**.`} ${q.why}`, ok ? 'happy' : 'concerned');
      return ok;
    }
    await t.say(q.q, 'thinking');
    const tries = exam ? 1 : 3;
    let first = true;
    for (let k = 0; k < tries; k++) {
      const v = (await t.ask({ prompt: 'answer>', chips: exam ? [] : [...(q.hint ? ['hint'] : []), 'skip'] })).trim();
      const lc = v.toLowerCase();
      if (!exam && (lc === 'hint' || lc === 'h' || lc === '?')) {
        first = false;
        await t.say(q.hint ? `Hint: ${q.hint}` : 'No hint for this one, sorry. Give it your best guess.', 'thinking');
        k--;
        continue;
      }
      if (['quit', 'exit'].includes(lc)) throw new Interrupted();
      if (!exam && /^(what|who|define|explain|help)\b/.test(lc)) {
        // A question back to TAPEOUT, not an answer: look it up and ask again.
        if (lc === 'help') this.term.print('Type your answer, or `hint`, `skip`, `quit`. You can also ask me `what is <term>`.', 'dim');
        else await this.define(v.replace(/^(define|explain)\s+/i, ''));
        k--;
        continue;
      }
      if (!exam && ['skip', 'idk', "i don't know", 'pass', 'give up'].includes(lc)) break;
      if (!v) { k--; continue; }
      if (q.a.check(v)) {
        if (exam) t.print('✓', 'ok');
        else await t.say(`${pickOne(PRAISE)} ${q.why}`, 'happy');
        return first;
      }
      first = false;
      if (exam) break;
      if (k < tries - 1) await t.say(k === 0 ? `Not quite.${q.hint ? ` ${q.hint}` : ' Try again.'}` : 'Still not it. One more try.', 'concerned');
    }
    if (exam) t.print(`✗ answer: ${q.a.canonical}`, 'err');
    else await t.say(`The answer is **${q.a.canonical}**. ${q.why}`, 'concerned');
    return false;
  }
}

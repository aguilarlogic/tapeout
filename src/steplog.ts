// A local, per-step record of how lessons go: first-try success, hints used, time on the step, and where a player
// quit. It lives in this browser only (its own storage key) and nothing here is ever sent anywhere. The hidden
// `log export` command turns it into a readable summary so a playtest round can be tuned toward ~85% first-try success.

export interface StepAttempt {
  /** Answered correctly on the first try with no hint. */
  firstTry: boolean;
  /** Hints and walk-throughs asked for (typed hint, ladder rungs, "teach me"). */
  hints: number;
  /** Seconds spent on the step. */
  secs: number;
  /** Gave up or skipped. */
  skipped: boolean;
}

export interface StepRecord {
  lesson: string;
  step: number;
  /** Start of the question text, so the summary can say which step it is. */
  label: string;
  tries: number;
  firstTry: number;
  hints: number;
  secs: number;
  skipped: number;
}

export interface StepLog {
  steps: Record<string, StepRecord>;
  /** Where players left a lesson part-way: lesson id, step index, count. */
  quits: Record<string, number>;
  /** Logic Lab plays, by lab id. */
  labs: Record<string, LabRecord>;
}

/** How a Logic Lab goes: how long until the first wire, how many "Test it" runs, and whether the first run passed. */
export interface LabRecord {
  /** Times the lab was opened and a first wire was made. */
  wired: number;
  /** Seconds from opening the lab to the first wire, summed over `wired`. */
  firstWireSecs: number;
  /** "Test it" runs. */
  tests: number;
  /** Runs that passed. */
  wins: number;
  /** Wins that came on the first run of a visit. */
  firstTryWins: number;
}

/** Steps below this first-try rate get split or get a worked example (the tuning rule for the beginner chapters). */
export const SPLIT_BELOW = 0.7;
/** The target first-try success rate (Wilson et al. 2019). */
export const TARGET_RATE = 0.85;

const KEY = 'tapeout.steplog.v1';
let cache: StepLog | null = null;

const blank = (): StepLog => ({ steps: {}, quits: {}, labs: {} });

export function loadLog(): StepLog {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    cache = blank();
  }
  return cache!;
}

function saveLog() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode: the log just does not persist */ }
}

/** Forget the cached copy (tests use this after clearing storage). */
export function resetLog() {
  cache = null;
}

export function recordStep(lesson: string, step: number, label: string, a: StepAttempt) {
  const log = loadLog();
  const key = `${lesson}#${step}`;
  const r = log.steps[key] ?? { lesson, step, label: label.replace(/\s+/g, ' ').slice(0, 70), tries: 0, firstTry: 0, hints: 0, secs: 0, skipped: 0 };
  r.tries++;
  if (a.firstTry) r.firstTry++;
  r.hints += a.hints;
  r.secs += a.secs;
  if (a.skipped) r.skipped++;
  log.steps[key] = r;
  saveLog();
}

export function recordQuit(lesson: string, step: number) {
  const log = loadLog();
  const key = `${lesson}#${step}`;
  log.quits[key] = (log.quits[key] ?? 0) + 1;
  saveLog();
}

const blankLab = (): LabRecord => ({ wired: 0, firstWireSecs: 0, tests: 0, wins: 0, firstTryWins: 0 });

/** The first wire of a lab visit, `secs` after the lab opened. */
export function recordLabFirstWire(lab: string, secs: number) {
  const log = loadLog();
  const r = (log.labs[lab] ??= blankLab());
  r.wired++;
  r.firstWireSecs += secs;
  saveLog();
}

/** One "Test it" run. `attempt` counts the runs in this visit, starting at 1. */
export function recordLabTest(lab: string, passed: boolean, attempt: number) {
  const log = loadLog();
  const r = (log.labs[lab] ??= blankLab());
  r.tests++;
  if (passed) { r.wins++; if (attempt === 1) r.firstTryWins++; }
  saveLog();
}

export interface StepSummary extends StepRecord {
  rate: number;
  avgHints: number;
  avgSecs: number;
  quits: number;
  flagged: boolean;
}

export function summarize(log: StepLog = loadLog()): StepSummary[] {
  return Object.entries(log.steps)
    .map(([key, r]) => ({
      ...r,
      rate: r.tries ? r.firstTry / r.tries : 0,
      avgHints: r.tries ? r.hints / r.tries : 0,
      avgSecs: r.tries ? r.secs / r.tries : 0,
      quits: log.quits[key] ?? 0,
      flagged: r.tries >= 1 && r.firstTry / r.tries < SPLIT_BELOW,
    }))
    .sort((a, b) => a.lesson.localeCompare(b.lesson) || a.step - b.step);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A readable per-step report: overall rate against the target, then each lesson's steps, flagged ones marked. */
export function readableReport(log: StepLog = loadLog()): string {
  const rows = summarize(log);
  const quits = Object.entries(log.quits).sort((a, b) => b[1] - a[1]);
  const labs = Object.entries(log.labs ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (!rows.length && !quits.length && !labs.length) return 'No step data yet. Play a lesson, then run this again.';
  const tries = rows.reduce((n, r) => n + r.tries, 0);
  const ok = rows.reduce((n, r) => n + r.firstTry, 0);
  const out: string[] = [
    `STEP LOG · ${rows.length} steps · ${tries} answers · first-try ${tries ? pct(ok / tries) : '-'} (target ${pct(TARGET_RATE)}, split a step below ${pct(SPLIT_BELOW)})`,
    '',
  ];
  let cur = '';
  for (const r of rows) {
    if (r.lesson !== cur) { cur = r.lesson; out.push(`[${cur}]`); }
    out.push(`  step ${String(r.step + 1).padStart(2)}  ${pct(r.rate).padStart(4)} first-try  ${r.avgHints.toFixed(1)} hints  ${Math.round(r.avgSecs)}s  ${r.skipped ? `${r.skipped} skipped  ` : ''}${r.quits ? `${r.quits} quit  ` : ''}${r.flagged ? '<< SPLIT OR ADD A WORKED EXAMPLE  ' : ''}${r.label}`);
  }
  if (quits.length) {
    out.push('', 'QUIT POINTS (lesson#step, times)');
    for (const [k, n] of quits) out.push(`  ${k}  x${n}`);
  }
  if (labs.length) {
    out.push('', 'LOGIC LABS (lab, avg time to first wire, Test it runs per win, first-try wins)');
    for (const [id, r] of labs) {
      const wire = r.wired ? `${Math.round(r.firstWireSecs / r.wired)}s to first wire` : 'no wire yet';
      const per = r.wins ? (r.tests / r.wins).toFixed(1) : '-';
      out.push(`  ${id.padEnd(14)} ${wire.padEnd(20)} ${r.tests} runs, ${r.wins} wins (${per} runs per win)  first-try ${r.wins ? pct(r.firstTryWins / r.wins) : '-'}`);
    }
  }
  const flagged = rows.filter((r) => r.flagged);
  out.push('', flagged.length ? `${flagged.length} step(s) under ${pct(SPLIT_BELOW)}: ${flagged.map((r) => `${r.lesson}#${r.step + 1}`).join(', ')}` : `No step is under ${pct(SPLIT_BELOW)}.`);
  return out.join('\n');
}

// Two-clock simulation with metastability. Clocks have different periods and a random phase. When a flip-flop samples a signal
// from another domain within a window of that signal changing, it captures a random mix of the old and new value, and each
// register resolves independently. A correct synchronizer hides this; a broken one corrupts data or loses events.
import { rng } from '../../sim/harness';
import { Design, type DesignState } from '../../sim/simulator';
import type { ModuleAst } from '../../sim/ast';
import type { CdcReport } from './analyze';

export interface Scenario {
  periods: Record<string, number>;
  phases: Record<string, number>;
  seed: number;
  /** edges of the slowest clock to simulate */
  cycles: number;
  /** capture window as a fraction of the capturing clock's period */
  window?: number;
}

export interface Io {
  set(name: string, v: number | bigint): void;
  get(name: string): bigint;
  rnd(): number;
  time: number;
}

export interface Bench {
  /** before the first edge */
  init?(io: Io): void;
  /** just before the rising edge of `dom`: read outputs */
  sample(dom: string, io: Io): void;
  /** just after the rising edge of `dom`: drive that domain's inputs */
  drive(dom: string, io: Io): void;
  finish(io: Io): string[];
}

export interface SimOutcome {
  failures: string[];
  /** most bits of a crossing bus that changed in one edge */
  maxFlips: Map<string, number>;
  mixes: number;
  error?: string;
}

const popcount = (x: bigint) => { let n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

export function simulateCdc(
  report: CdcReport & { design?: Design; ast?: ModuleAst },
  clocks: Record<string, string>,
  bench: Bench,
  scen: Scenario,
): SimOutcome {
  const out: SimOutcome = { failures: [], maxFlips: new Map(), mixes: 0 };
  if (!report.ast) { out.error = 'the design did not compile'; return out; }
  const d = new Design(report.ast);
  const r = rng(scen.seed);
  const window = scen.window ?? 0.35;
  const domClock = Object.fromEntries(Object.entries(clocks).map(([c, dm]) => [dm, c]));
  const doms = Object.keys(domClock);
  const srcs = [...new Set(report.crossings.map((c) => c.src))];
  const last = new Map<string, { t: number; old: bigint }>();
  const prev = new Map<string, bigint>();
  let now = 0;
  const io: Io = {
    set: (n, v) => d.apply({ [n]: v }),
    get: (n) => d.get(n),
    rnd: r,
    get time() { return now; },
  } as Io;
  try {
    d.apply({ ...Object.fromEntries(Object.values(domClock).map((c) => [c, 0])) });
    bench.init?.(io);
    for (const s of srcs) prev.set(s, d.get(s));
    const next = new Map(doms.map((dm) => [dm, scen.phases[dm] ?? 0]));
    const horizon = scen.cycles * Math.max(...doms.map((dm) => scen.periods[dm]));
    const track = (dm: string) => {
      for (const s of srcs) {
        const cur = d.get(s);
        const was = prev.get(s)!;
        if (cur !== was) {
          last.set(s, { t: now, old: was });
          const f = popcount(cur ^ was);
          if (f > (out.maxFlips.get(s) ?? 0)) out.maxFlips.set(s, f);
          prev.set(s, cur);
        }
      }
      void dm;
    };
    for (;;) {
      let dm = doms[0];
      for (const x of doms) if (next.get(x)! < next.get(dm)!) dm = x;
      now = next.get(dm)!;
      if (now > horizon) break;
      next.set(dm, now + scen.periods[dm]);
      const clk = domClock[dm];
      bench.sample(dm, io);
      // sources captured by this domain that changed inside the window
      const hot = report.crossings.filter((c) => c.domain === dm && last.has(c.src) && now - last.get(c.src)!.t < window * scen.periods[dm]).map((c) => c.src);
      if (hot.length) {
        out.mixes++;
        const pre = d.saveState();
        const regs = report.flopRegs.get(dm) ?? new Set<string>();
        const posts: DesignState[] = [];
        for (let k = 0; k < 3; k++) {
          const st: DesignState = { values: new Map(pre.values), mems: new Map(pre.mems), seen: pre.seen };
          for (const s of new Set(hot)) {
            const cur = pre.values.get(s)!;
            const old = last.get(s)!.old;
            let v = 0n;
            const w = d.signals.get(s)?.width ?? 1;
            for (let b = 0; b < w; b++) v |= ((r() < 0.5 ? cur : old) >> BigInt(b) & 1n) << BigInt(b);
            st.values.set(s, v);
          }
          d.loadState(st);
          d.apply({ [clk]: 1 });
          posts.push(d.saveState());
          d.loadState(pre);
        }
        const fin: DesignState = { values: new Map(posts[0].values), mems: new Map(posts[0].mems), seen: posts[0].seen };
        for (const reg of regs) {
          const k = Math.floor(r() * posts.length);
          if (posts[k].values.has(reg) && fin.values.has(reg)) fin.values.set(reg, posts[k].values.get(reg)!);
          if (posts[k].mems.has(reg)) fin.mems.set(reg, posts[k].mems.get(reg)!.slice());
        }
        for (const s of new Set(hot)) fin.values.set(s, pre.values.get(s)!);
        d.loadState(fin);
        d.settle();
      } else d.apply({ [clk]: 1 });
      bench.drive(dm, io);
      d.apply({ [clk]: 0 });
      track(dm);
    }
    out.failures = bench.finish(io);
  } catch (e) {
    out.error = (e as Error).message;
  }
  return out;
}

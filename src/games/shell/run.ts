// Shell Lab runtime: boot a machine for a mission, run the learner's commands, and check the goals.
import { createShell } from './index';
import type { Shell } from './sh';
import type { ShellEntry, ShellInstance } from './types';

export interface Machine { sh: Shell; hist: ShellEntry[] }

export function boot(inst: ShellInstance): Machine {
  const sh = createShell(inst.files, inst.cwd);
  for (const c of inst.setup ?? []) sh.run(c);
  return { sh, hist: [] };
}

export function exec(m: Machine, cmd: string): ShellEntry {
  const r = m.sh.run(cmd);
  const e = { cmd, out: r.chunks.map((c) => c.text).join(''), status: r.status };
  m.hist.push(e);
  return e;
}

export function evaluate(m: Machine, inst: ShellInstance): { label: string; ok: boolean }[] {
  return inst.goals.map((g) => {
    let ok = false;
    try { ok = g.ok(m.sh, m.hist); } catch { ok = false; }
    return { label: g.label, ok };
  });
}

export const passed = (rs: { ok: boolean }[]) => rs.length > 0 && rs.every((r) => r.ok);

/** Replay a saved command history on a fresh machine. */
export function replay(inst: ShellInstance, cmds: string[]): Machine {
  const m = boot(inst);
  for (const c of cmds) exec(m, c);
  return m;
}

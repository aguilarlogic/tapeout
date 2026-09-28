// Incidents: investigations in the terminal. A pager goes off; the player has instruments that cost lab time,
// a list of candidate root causes, and a budget. The root cause is picked at random each run, so replays differ.
import type { Rng } from '../lessons/types';

export interface Cause {
  id: string;
  /** One line, shown in the diagnosis menu. */
  name: string;
  /** The right fix for this cause, offered in the fix menu. */
  fix: string;
  /** Debrief: how this cause produced the evidence. */
  story: string;
}

/** A tempting fix that only treats the symptom. */
export interface Bandaid { text: string; why: string }

/** Everything random about one run. `v` is chosen before the cause, so it never depends on it. */
export interface World { cause: string; seed: number; v: Record<string, number> }

export interface Instrument {
  /** The command the player types, e.g. `scope`. */
  cmd: string;
  /** Allowed arguments (rails, lanes, temperatures…). Omitted when the instrument takes none. */
  args?: string[];
  /** Lab minutes per use. */
  cost: number;
  /** One line of help. */
  what: string;
  /** The reading. `r` is seeded by (run, command, argument), so noise is identical whatever the cause. */
  read: (w: World, arg: string, r: Rng) => string;
}

export interface Incident {
  id: string;
  title: string;
  concept: string;
  xp: number;
  /** Who is paging and why. TAPEOUT reads it out when the incident starts. */
  pager: string;
  /** Lab minutes available before the escalation. */
  budget: number;
  causes: Cause[];
  instruments: Instrument[];
  bandaids: Bandaid[];
  /** Per-run random values (a failing lane, a bad lot…). Must not depend on the cause. */
  setup?: (r: Rng) => Record<string, number>;
  /** Causes that can be the real one. Defaults to all of them. */
  pool?: string[];
}

/** Minutes lost to a wrong diagnosis or a wrong fix. */
export const WRONG_COST = 45;
/** Minutes a senior engineer's advice costs. */
export const HINT_COST = 30;

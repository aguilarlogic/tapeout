// Undo history for a lab: a stack of the states that changes replaced, capped, with a burst of changes to one control merged into one step.
// Pure (no DOM), so the rules are tested directly; the lab decides what a state is and how to put one back.

/** Steps kept per lab. Older steps are dropped. */
export const UNDO_CAP = 100;
/** Changes to the same control closer together than this are one step (a slider drag, or fast typing). */
export const BURST_MS = 600;

export class UndoHistory<T> {
  private steps: T[] = [];
  private burst: { key: string; at: number } | undefined;

  constructor(private readonly cap = UNDO_CAP, private readonly gapMs = BURST_MS) {}

  get size() { return this.steps.length; }

  /**
   * Remember the state a change is about to replace. A change to the same key within the gap continues the burst,
   * so the state from before the burst's first change is the one kept.
   */
  record(before: T, key: string, now = Date.now()): void {
    const continuing = this.burst !== undefined && this.burst.key === key && now - this.burst.at <= this.gapMs;
    if (!continuing) {
      this.steps.push(before);
      if (this.steps.length > this.cap) this.steps.shift();
    }
    this.burst = { key, at: now };
  }

  /** Take back the newest step. Ends any burst, so the next change starts a new step. */
  undo(): T | undefined {
    this.burst = undefined;
    return this.steps.pop();
  }

  clear(): void {
    this.steps = [];
    this.burst = undefined;
  }
}

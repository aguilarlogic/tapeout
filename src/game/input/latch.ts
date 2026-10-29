// Phase 10 Spec, section 2.5: hold or toggle. A pure latch for the toggle preference: a press flips an action's latch, and
// a latched action counts as held until the next press, so the player need not keep the key down. Only the actions in
// `kinds` latch; every other action passes through as the device sent it. No DOM, so it tests in node.
import type { Action } from './bindings';

/** The result of one step: the latches to keep for the next step, and the held set the sim should see. */
export interface LatchResult { latched: Set<Action>; held: Set<Action> }

/** The actions that latch under the toggle preference. Field and map always latch; fire latches only while the charged
 * weapon is in hand (press to start charging, press again to release). */
export function LATCH_KINDS(chargedInHand: boolean): ReadonlySet<Action> {
  return new Set<Action>(chargedInHand ? ['field', 'fire', 'map'] : ['field', 'map']);
}

/** One step of the latch. For each action in `kinds`, a press flips its latch: a latched action stays latched until pressed
 * again, and an unlatched one latches on the press. The returned held is the input held with every kinds action removed
 * and every latched action added, so a latch is held with no key down, and a press on a latched fire releases it this
 * step (the charged shot then fires on release). Actions in prev that are no longer in kinds are dropped. The inputs are
 * not changed. */
export function latch(
  prev: ReadonlySet<Action>,
  held: ReadonlySet<Action>,
  pressed: ReadonlySet<Action>,
  kinds: ReadonlySet<Action>,
): LatchResult {
  const latched = new Set<Action>();
  for (const a of kinds) {
    // a press flips the latch: on when it was off, off when it was on
    if (prev.has(a) !== pressed.has(a)) latched.add(a);
  }
  const out = new Set<Action>();
  for (const a of held) if (!kinds.has(a)) out.add(a);
  for (const a of latched) out.add(a);
  return { latched, held: out };
}

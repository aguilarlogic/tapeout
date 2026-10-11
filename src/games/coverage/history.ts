// Undo for the coverage lab's regression builder (U54): phases added, removed or edited, and the seed.
// The page keeps its own history; this module only says what a state is and how to copy it back.
import { UndoHistory } from '../../ui/undo';
import type { Phase } from './scenarios';

/** The builder's state as one undo step. Phases are copied, so later edits cannot reach a saved step. */
export interface BuilderSnap { phases: Phase[]; seed: number }

export const snapOf = (phases: Phase[], seed: number): BuilderSnap => ({ phases: JSON.parse(JSON.stringify(phases)) as Phase[], seed });

/** A fresh copy of a saved step, to put back into the page's state. */
export const copyOf = (s: BuilderSnap): BuilderSnap => snapOf(s.phases, s.seed);

export const builderHistory = () => new UndoHistory<BuilderSnap>();

// The generic overlay opener (Phase 3 Spec, section 2): any module, opened at a station by its kind. Lessons,
// checkpoints and the final run at the port terminal; practice banks run there too, framed as calibration; logic and
// transistor labs open the patch panel; every other lab kind opens its desktop page on a bench.
import { findModule, KIND_APP, type ModKind } from '../../curriculum';
import { drillsPage } from '../../games/drills/page';
import { LABS } from '../../os/labs';
import { openLab, openPort, type OverlayHost } from './overlay';

const TERMINAL: ReadonlySet<ModKind> = new Set(['lesson', 'boss', 'final', 'practice']);

/** The frame label a module's station shows. */
export function stationLabel(kind: ModKind): string {
  if (kind === 'boss') return 'GATE TERMINAL';
  if (kind === 'practice') return 'CALIBRATION';
  if (TERMINAL.has(kind)) return 'PORT';
  if (kind === 'logic' || kind === 'cmos') return 'PATCH PANEL';
  if (kind === 'clab') return 'CIRCUIT BENCH';
  if (kind === 'drills') return 'INTERVIEW DESK';
  return 'WORKBENCH';
}

/** Whether openModule can open this module (incidents are boss fights; the Interview flashcards open on a desk). */
export const opens = (id: string): boolean => {
  const m = findModule(id)?.module;
  return !!m && (TERMINAL.has(m.kind) || m.kind === 'drills' || !!LABS[m.route.split('/')[1]]);
};

/**
 * Open module `id` at a station. `onAnswer` hears each terminal answer (the drone's screen reacts); `onClose(passed)`
 * is true when the module's record appeared or improved while it was open.
 */
export function openModule(host: OverlayHost, id: string, onAnswer: (ok: boolean) => void, onClose: (passed: boolean) => void) {
  const m = findModule(id)?.module;
  if (!m) return onClose(false);
  const label = stationLabel(m.kind);
  if (TERMINAL.has(m.kind)) return openPort(host, id, onAnswer, onClose, { label, practice: m.kind === 'practice' });
  // Level 27's Interview Room (Phase 7 Spec, section 2): the desktop's Interview flashcards, inside the game
  if (m.kind === 'drills') return openLab(host, 'bench', id, onClose, { page: () => drillsPage(), label, sub: KIND_APP[m.kind] });
  const page = LABS[m.route.split('/')[1]];
  if (!page) return onClose(false);
  const panel = m.kind === 'logic' || m.kind === 'cmos';
  openLab(host, panel ? 'panel' : 'bench', id, onClose, { page, label, sub: KIND_APP[m.kind] });
}

// The desktop's two fixed regions. TAPEOUT's mentor column (the terminal and its speech bubble) docks on the left;
// the workspace (labs, maps, the desktop icons and the wallpaper) fills the rest. On phone widths the mentor column
// stacks on top of the workspace instead. Windows and bubbles are placed inside a region, so a bubble can never
// cover a lab's result panel: the two regions never overlap.
import { h } from '../ui/dom';

export type Region = 'mentor' | 'workspace';

export interface DeskRegions {
  desktop: HTMLElement;
  mentor: HTMLElement;
  workspace: HTMLElement;
}

let current: DeskRegions | null = null;

/** Builds the empty desktop with its two regions and remembers them for window placement. */
export function buildRegions(): DeskRegions {
  const mentor = h('section', { class: 'mentor-region', 'data-region': 'mentor', 'aria-label': 'TAPEOUT, your mentor' });
  const workspace = h('section', { class: 'workspace', 'data-region': 'workspace', 'aria-label': 'Workspace' });
  const desktop = h('main', { id: 'desktop', class: 'desktop' }, mentor, workspace);
  current = { desktop, mentor, workspace };
  return current;
}

/** The element a window or bubble of this region lives in, once `buildRegions` has run. */
export function regionEl(region: Region): HTMLElement | undefined {
  return current?.[region];
}

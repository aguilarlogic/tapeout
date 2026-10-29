// Every lab app by its route section (#/rtl/fifo opens rtlPage('fifo')). The desktop routes through it, and the story
// game opens the same pages inside its benches (story/open.ts).
import { archPage } from '../games/arch/page';
import { cdcPage } from '../games/cdc/page';
import { circuitPage } from '../games/circuit/page';
import { codePage } from '../games/code/page';
import { coveragePage } from '../games/coverage/page';
import { isaPage } from '../games/isa/page';
import { logicPage } from '../games/logic/page';
import { pcbPage } from '../games/pcb/page';
import { rtlPage } from '../games/rtl/page';
import { rvPage } from '../games/rv/page';
import { shellPage } from '../games/shell/page';
import { svPage } from '../games/sv/page';
import { svaPage } from '../games/sva/page';
import { timingPage } from '../games/timing/page';
import { uvmPage } from '../games/uvm/page';

export const LABS: Record<string, (id: string) => HTMLElement> = {
  logic: logicPage, rtl: rtlPage, pcb: pcbPage, sta: timingPage, cov: coveragePage, uvm: uvmPage, clab: circuitPage, code: codePage, shell: shellPage, sva: svaPage, tb: svPage, cdc: cdcPage, isa: isaPage, arch: archPage, rv: rvPage, dft: archPage, pd: archPage, sta2: archPage, layout: archPage, sig: archPage, spec: archPage,
};

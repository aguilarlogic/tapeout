// Discovery beat 'scan', Scan Chain (Phase 6 Spec, section 4): five flop lamps in a row, shown as "?" while SCAN is
// off. A wall sign shows the target 1 0 1 1 0, flop 1 to flop 5. Lever SCAN turns shift mode on. Lever IN sets the
// bit at the chain's input. Pad CLK, stepped on or pressed with E, shifts the chain one place right: each flop takes
// its left neighbour's bit and flop 1 takes IN. In shift mode the lamps show their bits. The door opens when the flops
// match the target with SCAN off, and the beat is solved once the drone is past it. The first five bits in, 0, 1, 1,
// 0, 1, are the only run of five that matches. The hidden start is chosen so that no shorter run of shifts matches.
import type { Rect } from '../../level/room';
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The number of flops in the chain. Flop 1 is the left lamp and takes IN; flop 5 is the far end. */
const FLOPS = 5;
/** The target bits, flop 1 to flop 5, and the hidden bits the chain holds at the start. The first three hidden bits
 * are 1, 1, 1: a shift pushes them toward the far end, and no run shorter than five can leave the target in place. */
const TARGET = [true, false, true, true, false];
const HIDDEN = [true, true, true, false, true];
/** Flop lamp centres, left to right; the lamp's side, and its top edge. */
const FLOP_X = [820, 920, 1020, 1120, 1220];
const LAMP = 56, LAMP_TOP = 400;
/** The levers on the floor: SCAN, IN, and the lever that stands on the CLK pad. */
const SCAN_X = 420, IN_X = 520, CLK_X = 620;
/** The CLK pad: a copper plate on the floor under the CLK lever, 80 px wide. */
const PAD = { x: CLK_X - 40, w: 80 };
/** The wall sign with the target, centred at SIGN.x and SIGN.y. */
const SIGN = { x: 1020, y: 250, w: 340, h: 56 };
/** Past this x the drone has passed the door (the door is 48 px wide, its right edge at W - 152). */
const PASS_X = W - 152;

/** TAPEOUT's lines. */
const TOLD_LINE = 'CLK only shifts in shift mode. Turn SCAN on first.';
const OPEN_LINE = 'Scan turns flops into a shift register. The first bit in ends up furthest.';
const SOLVE_LINE = 'Shifting sets hidden state. Scanning reads it back.';

export interface ScanState {
  /** SCAN is on: CLK shifts the chain, and the lamps show their bits. */
  shift: boolean;
  /** The IN lever's bit. */
  bit: boolean;
  /** The flops, flop 1 first (the left lamp). */
  flops: boolean[];
  /** The drone stood on the CLK pad on the last step, so stepping on it counts once. */
  onPad: boolean;
  /** CLK was pressed while SCAN was off; the hint is said once. */
  told: boolean;
  /** The flops matched the target with SCAN off. The door stays open after that. */
  open: boolean;
  solved: boolean;
}

const bitText = (b: boolean) => (b ? '1' : '0');

function scanRoom(): StoryRoom {
  return {
    id: 'discovery-scan', name: 'The Scan Chain', role: 'discovery', mechanic: 'scan', w: W, h: H, music: 'silicon',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, F - 200)],
    oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
    traces: [trace(0, 700, 420), trace(1300, W, 420)],
    stations: [
      { id: 'scan', kind: 'lever', x: SCAN_X, y: F, label: 'SCAN' },
      { id: 'in', kind: 'lever', x: IN_X, y: F, label: 'IN' },
      { id: 'clk', kind: 'lever', x: CLK_X, y: F, label: 'CLK' },
    ],
    triggers: [],
    gates: [{ id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) }],
    exit: { x: W - 40 },
  };
}

/** The drone stands on a floor rect: grounded, within its width, feet on its top. */
function standing(c: MechCtx, rect: Rect): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > rect.x && cx < rect.x + rect.w && Math.abs(d.y + d.h - rect.y) <= 2;
}

/** The CLK pad as a floor rect: its top is the floor. */
const PAD_RECT: Rect = { x: PAD.x, y: F, w: PAD.w, h: 0 };

/** One shift: each flop takes its left neighbour's bit, and flop 1 takes IN. */
function shift(s: ScanState) {
  for (let i = FLOPS - 1; i > 0; i--) s.flops[i] = s.flops[i - 1];
  s.flops[0] = s.bit;
}

/** The flops hold the target, flop 1 to flop 5. */
const matches = (s: ScanState) => s.flops.every((b, i) => b === TARGET[i]);

export const SCAN: MechanicDef<ScanState> = {
  kind: 'scan',
  room: scanRoom,
  init: () => ({ shift: false, bit: false, flops: [...HIDDEN], onPad: false, told: false, open: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    if (c.used === 'scan') {
      s.shift = !s.shift;
      c.sfx('lever');
    }
    if (c.used === 'in') {
      s.bit = !s.bit;
      c.sfx('lever');
    }
    // CLK fires on a press of its lever, or on the step onto its pad (one shift even if both happen in one step)
    const onPad = standing(c, PAD_RECT);
    const clk = c.used === 'clk' || (onPad && !s.onPad);
    s.onPad = onPad;
    if (clk && s.shift) {
      shift(s);
      c.sfx('rowTick');
    } else if (clk) {
      c.sfx('lever');
      if (!s.told) {
        s.told = true;
        c.say(TOLD_LINE);
      }
    }
    // the door opens on a match with SCAN off, and stays open
    if (!s.open && !s.shift && matches(s)) {
      s.open = true;
      c.sfx('door');
      c.open('exit');
      c.say(OPEN_LINE);
    }
    if (s.open && c.drone.x + c.drone.w / 2 > PASS_X) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    // the wall sign with the target
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2, SIGN.w, SIGN.h);
    g.strokeRect(SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2, SIGN.w, SIGN.h);
    g.fillStyle = PAL.text;
    g.font = `24px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`TARGET ${TARGET.map(bitText).join(' ')}`, SIGN.x, SIGN.y);
    // the shelf the chain sits on, and an arrow between each pair of flops: the bits move right
    g.strokeStyle = PAL.idle;
    g.beginPath();
    g.moveTo(IN_X, LAMP_TOP + LAMP + 14);
    g.lineTo(FLOP_X[FLOPS - 1] + LAMP / 2, LAMP_TOP + LAMP + 14);
    g.stroke();
    const mid = LAMP_TOP + LAMP / 2;
    for (let i = 0; i < FLOPS - 1; i++) {
      const x0 = FLOP_X[i] + LAMP / 2 + 6, x1 = FLOP_X[i + 1] - LAMP / 2 - 6;
      g.beginPath();
      g.moveTo(x0, mid);
      g.lineTo(x1, mid);
      g.moveTo(x1 - 6, mid - 5);
      g.lineTo(x1, mid);
      g.lineTo(x1 - 6, mid + 5);
      g.stroke();
    }
    // the five flop lamps: "?" while SCAN is off, the bit in shift mode (lit amber when it is 1)
    g.font = `26px ${FONT}`;
    FLOP_X.forEach((x, i) => {
      const lit = s.shift && s.flops[i];
      const top = LAMP_TOP;
      g.fillStyle = PAL.fill;
      if (lit) {
        g.fillStyle = PAL.amber;
        g.shadowColor = PAL.amber;
        g.shadowBlur = 12;
      }
      g.fillRect(x - LAMP / 2, top, LAMP, LAMP);
      g.shadowBlur = 0;
      g.strokeStyle = s.shift ? PAL.line : PAL.idle;
      if (!s.shift) g.setLineDash([6, 6]);
      g.strokeRect(x - LAMP / 2, top, LAMP, LAMP);
      g.setLineDash([]);
      g.fillStyle = lit ? PAL.bgDeep : PAL.text;
      g.fillText(s.shift ? bitText(s.flops[i]) : '?', x, top + LAMP / 2);
      g.fillStyle = PAL.idle;
      g.font = `14px ${FONT}`;
      g.fillText(`FLOP ${i + 1}`, x, top - 16);
      g.font = `26px ${FONT}`;
    });
    // the mode and the IN bit, in words
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.fillText(s.shift ? 'SHIFT ON' : 'SHIFT OFF', FLOP_X[2], LAMP_TOP - 40);
    g.fillText(`IN = ${bitText(s.bit)}`, IN_X, F - 128);
    // the CLK pad: a copper plate under its lever, with four pin dots
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.amber;
    g.fillRect(PAD.x, F - 6, PAD.w, 6);
    g.strokeRect(PAD.x, F - 6, PAD.w, 6);
    for (const dx of [12, 28, 52, 68]) {
      g.beginPath();
      g.arc(PAD.x + dx, F - 3, 1.5, 0, Math.PI * 2);
      g.fillStyle = PAL.amber;
      g.fill();
    }
    g.restore();
  },
  nudge: 'Turn SCAN on. Set IN, press CLK, five times. Then turn SCAN off.',
};

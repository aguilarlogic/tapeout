// Discovery beat 5, The Bit Sign (Phase 3 Spec, section 6): four levers, MSB at the left, read a 4-bit number, and the
// sign above them says 4'b1010. Each E press flips one switch; the switches reading 1, 0, 1, 0 solves the beat.
import { FONT, LINE, PAL } from '../../render/palette';
import type { Station, StoryRoom } from '../../story/types';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef } from '../types';

const W = 1600, H = 720, F = floorY(H);
const IDS = ['b3', 'b2', 'b1', 'b0'];
/** Switch x positions, left to right (bit 3 to bit 0). */
const X = [800, 880, 960, 1040];
/** The bits that solve the beat, left to right: 1, 0, 1, 0. */
const TARGET = [true, false, true, false];
const SIGN = { x: 920, y: 250 };

export interface PatternState { bits: boolean[]; solved: boolean }

const none = { oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [], triggers: [], gates: [] };

function patternRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-pattern', name: 'The Bit Sign', role: 'discovery', mechanic: 'pattern', w: W, h: H, music: 'keeper', modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, F - 200)],
    gates: [{ id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) }],
    stations: IDS.map((id, i): Station => ({ id, kind: 'lever', x: X[i], y: F, label: `BIT ${3 - i}` })),
    traces: [trace(0, 700, 420), trace(1100, W, 420)],
    exit: { x: W - 40 },
  };
}

export const PATTERN: MechanicDef<PatternState> = {
  kind: 'pattern',
  room: patternRoom,
  init: () => ({ bits: [false, false, false, false], solved: false }),
  step(s, c) {
    if (s.solved) return;
    const i = c.used ? IDS.indexOf(c.used) : -1;
    if (i >= 0) {
      s.bits[i] = !s.bits[i];
      c.sfx('lever');
    }
    if (s.bits.every((on, k) => on === TARGET[k])) {
      s.solved = true;
      c.say('1010. Four bits, one number.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(SIGN.x - 120, SIGN.y - 26, 240, 52);
    g.strokeRect(SIGN.x - 120, SIGN.y - 26, 240, 52);
    g.fillStyle = PAL.text;
    g.font = `28px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText("4'b1010", SIGN.x, SIGN.y);
    X.forEach((x, i) => {
      const on = s.bits[i];
      const armX = x + (on ? 16 : -16);
      g.strokeStyle = PAL.line;
      g.beginPath();
      g.moveTo(x, F);
      g.lineTo(x, F - 44);
      g.stroke();
      g.strokeStyle = on ? PAL.amber : PAL.idle;
      g.beginPath();
      g.moveTo(x, F - 44);
      g.lineTo(armX, F - 62);
      g.stroke();
      g.fillStyle = PAL.text;
      g.font = `22px ${FONT}`;
      g.fillText(on ? '1' : '0', x, F - 96);
    });
    g.restore();
  },
  nudge: "Read it left to right. Four bits: 1, 0, 1, 0.",
};

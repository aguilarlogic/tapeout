// Discovery beat, Vias (Phase 6 Spec, section 4): three metal layers, each a long floor. M1 is the floor, M2's top is at
// y 440 and M3's at y 240. Each layer's slab is solid across the room, so its underside is a ceiling and the drone cannot
// jump between layers. VIA (E) on M1 carries the drone up to M2. The M2 to M3 via has an empty socket: a via block (a
// crate) pushed into it lets VIA carry the drone up to M3. A metal wire on M2 keeps crates 20 px away: a crate that comes
// closer sparks and TAPEOUT says it is too close (no damage). Solved on M3's exit ledge.
import type { Rect } from '../../level/room';
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames } from '../../tuning';
import { floorY, r, shell, spawnAt } from '../templates/kit';
import type { MechanicDef } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The layers' walking tops: M1 is the floor (F), M2 is at 440 and M3 at 240. */
const M2 = 440, M3 = 240;
/** A slab is 24 px thick; its underside is the ceiling of the layer below. */
const SLAB = 24;
/** The drone's half height, px: its centre sits this far above a layer's top. */
const HALF = 24;
/** The via stations. VIA on M1 carries the drone to M2. VIA on M2 carries it to M3, once the socket holds a block. */
const VIA12 = { id: 'via12', x: 240 };
const VIA23 = { id: 'via23', x: 984 };
/** The empty via socket on M2, 48 px wide and centred on VIA23. */
const SOCKET = { x: 960, w: 48 };
/** The M2 wire: a metal run from x 560 to 740. A crate on M2 within KEEP px of it sparks. */
const WIRE = { x0: 560, x1: 740 };
const KEEP = 20;
/** Sparks last 0.5 s. */
const SPARK = frames(500);
/** The via block: a mass 1 crate, starting on M2 clear of the wire. */
const BLOCK_MASS = 1, BLOCK_X = 820;
/** The exit ledge on M3: standing grounded past this x solves the beat. */
const LEDGE_X = 1300;
/** The exit door on M3, with the wall solid above it. */
const EXIT = r(W - 200, M3 - 200, 48, 200);
const EXIT_WALL = r(EXIT.x, 0, EXIT.w, EXIT.y);
/** Each layer's colour: M1 trace, M2 neon, M3 amber. Shape and labels carry the layer too. */
const LAYER_COLOUR = { 1: PAL.trace, 2: PAL.neon, 3: PAL.amber } as const;
/** Lines TAPEOUT says. */
const TOO_CLOSE = 'Too close. Metal needs space.';
const SOCKET_LINE = 'The socket is empty. A via block fits it.';
const SOLVE_LINE = 'Metal layers stack, and vias join them.';

export interface ViasState {
  /** The step count, for the draw. */
  t: number;
  /** Steps left in the spark burst at the wire. */
  sparks: number;
  /** The wire end the sparks come from. */
  sparkX: number;
  /** A crate was too close to the wire last step. */
  near: boolean;
  /** A crate sits in the M2 socket. */
  filled: boolean;
  /** The socket hint has been said. */
  told: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [],
  triggers: [],
};

function viasRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-vias', name: 'Vias', role: 'discovery', mechanic: 'vias', w: W, h: H, music: 'silicon', modules: [],
    spawn: spawnAt(60, F),
    solids: [...shell(W, H), r(0, M2, W, SLAB), r(0, M3, W, SLAB), EXIT_WALL],
    gates: [{ id: 'exit', kind: 'door', rect: EXIT }],
    stations: [
      { id: VIA12.id, kind: 'lever', x: VIA12.x, y: F, label: 'VIA' },
      { id: VIA23.id, kind: 'lever', x: VIA23.x, y: M2, label: 'VIA' },
    ],
    props: [{ kind: 'crate', mass: BLOCK_MASS, x: BLOCK_X, y: M2 - crateSide(BLOCK_MASS) / 2 - 1 }],
    exit: { x: W - 40 },
  };
}

/** A drone's feet, or a crate's bottom, rest on a layer's top (within 2 px). */
const onLayer = (feet: number, top: number) => Math.abs(feet - top) <= 2;
const restsOnM2 = (p: Rect) => onLayer(p.y + p.h, M2);

/** A crate on M2 is too close when the gap from its nearest side to the wire is KEEP px or less. */
function tooClose(p: Rect): boolean {
  if (!restsOnM2(p)) return false;
  const gap = Math.max(WIRE.x0 - (p.x + p.w), p.x - WIRE.x1);
  return gap <= KEEP;
}

/** A crate fits the socket when it rests on M2 with its centre over the socket. */
function inSocket(p: Rect): boolean {
  const cx = p.x + p.w / 2;
  return restsOnM2(p) && cx >= SOCKET.x && cx <= SOCKET.x + SOCKET.w;
}

/** One layer: a glowing line on its walking top, with its label. */
function layer(g: CanvasRenderingContext2D, n: 1 | 2 | 3, top: number) {
  const colour = LAYER_COLOUR[n];
  g.strokeStyle = colour;
  g.lineWidth = LINE.world;
  g.shadowColor = colour;
  g.shadowBlur = LINE.traceGlow;
  g.beginPath();
  g.moveTo(0, top);
  g.lineTo(W, top);
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = colour;
  g.font = `14px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'bottom';
  g.fillText(`M${n}`, 16, top - 6);
}

/** A via: a dashed arrow up from one layer to the next. An empty socket's via is dashed, a filled one solid. */
function viaArrow(g: CanvasRenderingContext2D, x: number, from: number, to: number, colour: string, solid: boolean) {
  g.strokeStyle = colour;
  g.lineWidth = LINE.world;
  g.setLineDash(solid ? [] : [4, 6]);
  g.beginPath();
  g.moveTo(x, from);
  g.lineTo(x, to);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.moveTo(x - 6, to + 10);
  g.lineTo(x, to);
  g.lineTo(x + 6, to + 10);
  g.stroke();
}

export const VIAS: MechanicDef<ViasState> = {
  kind: 'vias',
  room: viasRoom,
  init: () => ({ t: 0, sparks: 0, sparkX: WIRE.x1, near: false, filled: false, told: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    s.t = c.t;
    const d = c.drone, feet = d.y + d.h, cx = d.x + d.w / 2;
    // the socket reads the blocks on the ground; a block within KEEP px of the wire sparks, once per approach
    s.filled = c.props.some(inSocket);
    const near = c.props.find(tooClose);
    if (near && !s.near) {
      s.sparks = SPARK;
      s.sparkX = near.x + near.w / 2 < (WIRE.x0 + WIRE.x1) / 2 ? WIRE.x0 : WIRE.x1;
      c.say(TOO_CLOSE);
    }
    s.near = near !== undefined;
    if (s.sparks > 0) s.sparks -= 1;
    // VIA on M1 carries the drone up to M2
    if (c.used === VIA12.id && onLayer(feet, F)) {
      c.warp(VIA12.x, M2 - HALF);
      c.sfx('liftHum');
    }
    // VIA on M2 carries it up to M3, but only with a block in the socket
    if (c.used === VIA23.id && onLayer(feet, M2)) {
      if (s.filled) {
        c.warp(VIA23.x, M3 - HALF);
        c.sfx('liftHum');
      } else if (!s.told) {
        s.told = true;
        c.say(SOCKET_LINE);
      }
    }
    // the M3 exit ledge: standing grounded past LEDGE_X
    if (c.grounded && onLayer(feet, M3) && cx > LEDGE_X) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    layer(g, 1, F);
    layer(g, 2, M2);
    layer(g, 3, M3);
    // the M2 wire, its keep-out zone dashed around it, and the sparks at its end
    const zone = { x: WIRE.x0 - KEEP, x1: WIRE.x1 + KEEP, top: M2 - 40 };
    g.strokeStyle = PAL.hostile;
    g.lineWidth = LINE.world;
    g.setLineDash([4, 6]);
    g.strokeRect(zone.x, zone.top, zone.x1 - zone.x, M2 - zone.top);
    g.setLineDash([]);
    g.fillStyle = PAL.neon;
    g.fillRect(WIRE.x0, M2 - 4, WIRE.x1 - WIRE.x0, 4);
    g.fillStyle = PAL.hostile;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('WIRE, KEEP 20 px', (zone.x + zone.x1) / 2, zone.top - 6);
    if (s.sparks > 0) {
      g.strokeStyle = PAL.gold;
      g.lineWidth = LINE.hud;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.6 + s.sparks * 0.4;
        g.beginPath();
        g.moveTo(s.sparkX, M2 - 4);
        g.lineTo(s.sparkX + Math.cos(a) * 12, M2 - 4 + Math.sin(a) * 12);
        g.stroke();
      }
    }
    // the socket: a dashed notch when empty, a solid one when a block fits it, with its state in words
    const socketY = M2 - 10;
    if (s.filled) {
      g.fillStyle = PAL.amber;
      g.fillRect(SOCKET.x, socketY, SOCKET.w, 10);
    } else {
      g.strokeStyle = PAL.idle;
      g.lineWidth = LINE.hud;
      g.setLineDash([3, 3]);
      g.strokeRect(SOCKET.x, socketY, SOCKET.w, 10);
      g.setLineDash([]);
    }
    g.fillStyle = PAL.text;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText(s.filled ? 'SOCKET FILLED' : 'SOCKET EMPTY', SOCKET.x + SOCKET.w / 2, socketY - 6);
    // the two vias: M1 to M2 always, M2 to M3 solid once its socket is filled
    viaArrow(g, VIA12.x, F, M2, LAYER_COLOUR[1], true);
    viaArrow(g, VIA23.x, M2, M3, s.filled ? PAL.amber : PAL.idle, s.filled);
    g.restore();
  },
  nudge: 'Push the via block into the empty socket on M2, then use VIA.',
};

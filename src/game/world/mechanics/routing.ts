// Discovery beat, The Routers (Phase 7 Spec, section 4): three router pads in an L on islands over a pit, SRC, R1 and
// DEST. The packet is the crate on SRC. A packet waits 0.6 s at each router, then hops along that router's arrow to the
// next router. R1's arrow starts pointing back at SRC, so the packet bounces forever (a livelock) and the hop counter
// climbs. E at R1 turns its arrow (west, north, east, south). North sends the packet to DEST, which opens the door.
// Solved past the door. Falling in the pit puts the drone back at the start with no damage.
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames } from '../../tuning';
import { floorY, r, shell, spawnAt } from '../templates/kit';
import type { MechanicDef } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The routers' indices in ROUTERS. */
const SRC = 0, R1 = 1, DEST = 2;
/** The three router islands: each a 24 px slab whose top is `top`, from x0 to x1. */
const ROUTERS = [
  { name: 'SRC', x0: 400, x1: 520, top: 540 },
  { name: 'R1', x0: 680, x1: 800, top: 540 },
  { name: 'DEST', x0: 900, x1: 1020, top: 400 },
] as const;
const ISLAND_H = 24;
/** The arrow of R1: its word, the router it points at (-1 for none), and the step it adds. */
const ARROWS = [
  { word: 'west, back to SRC', to: SRC, dx: -1, dy: 0 },
  { word: 'north, to DEST', to: DEST, dx: 0, dy: -1 },
  { word: 'east, to no router', to: -1, dx: 1, dy: 0 },
  { word: 'south, to no router', to: -1, dx: 0, dy: 1 },
] as const;
/** SRC's arrow is fixed: east, to R1. */
const SRC_ARROW = { dx: 1, dy: 0 } as const;
/** A packet waits this long at each router before it hops (0.6 s). */
const DWELL = frames(600);
/** The hop count at which TAPEOUT notices the bounce. */
const BOUNCE_HOPS = 4;
/** The pit: the floor is missing from PIT_X0 to PIT_X1. A drone whose top passes FALL_Y is back at the start. */
const PIT_X0 = 360, PIT_X1 = 1180;
const FALL_Y = F + 20;
/** The left and right floors, and the exit door at the right with the wall solid above it. */
const LEFT_FLOOR = r(0, F, PIT_X0, 80);
const RIGHT_FLOOR = r(PIT_X1, F, W - PIT_X1, 80);
const DOOR = r(W - 200, F - 200, 48, 200);
const DOOR_WALL = r(W - 200, 0, 48, F - 200);
/** The drone's start, and the crate that is the packet, on the left floor. */
const SPAWN = spawnAt(140, F);
const CRATE_X = 260, CRATE_MASS = 1;
/** Packets are drawn this far above a router's top. */
const PKT_LIFT = 60, PKT_HALF = 7;
/** Lines TAPEOUT says. */
const LOST = 'No router that way. The packet is dropped.';
const BOUNCE = 'It keeps bouncing. R1 points back at SRC.';
const DELIVERED = 'DEST has the packet. The door is open.';
const PIT_LINE = 'Nothing under the routers. You are back at the start.';
const SOLVE_LINE = 'Routers pass packets hop by hop. No loops, so every packet gets home.';

/** The packet: the router it sits at, the steps it has waited there, and the hops it has made. */
export interface Packet { at: number; dwell: number; hops: number }

export interface RoutingState {
  t: number;
  /** R1's arrow, as an index into ARROWS. It starts pointing west, back at SRC. */
  arrow: number;
  /** The packet in the network, or null when none is in flight. */
  packet: Packet | null;
  /** A crate was on SRC last step, so a new arrival there is a new packet. */
  armed: boolean;
  /** The door is open: the packet reached DEST. */
  open: boolean;
  bounceSaid: boolean;
  toldPit: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [], traces: [],
  triggers: [],
};

function routingRoom(): StoryRoom {
  return {
    ...none,
    id: 'discovery-routing', name: 'The Routers', role: 'discovery', mechanic: 'routing', w: W, h: H, music: 'cluster',
    modules: [],
    spawn: SPAWN,
    solids: [
      ...shell(W, H, { floor: false }), LEFT_FLOOR, RIGHT_FLOOR, DOOR_WALL,
      ...ROUTERS.map((q) => r(q.x0, q.top, q.x1 - q.x0, ISLAND_H)),
    ],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [{ id: 'arrow', kind: 'lever', x: (ROUTERS[R1].x0 + ROUTERS[R1].x1) / 2, y: ROUTERS[R1].top, label: 'ARROW' }],
    props: [{ kind: 'crate', mass: CRATE_MASS, x: CRATE_X, y: F - crateSide(CRATE_MASS) / 2 - 1 }],
    exit: { x: W - 40 },
  };
}

/** The crate counts as on SRC when its centre is over the island and its bottom rests on the island's top (within 2 px). */
function onSource(p: { x: number; y: number; w: number; h: number }): boolean {
  const q = ROUTERS[SRC], cx = p.x + p.w / 2;
  return cx >= q.x0 && cx <= q.x1 && Math.abs(p.y + p.h - q.top) <= 2;
}

/** The router a packet hops to from `at`, or -1 when the arrow points at none. DEST has no arrow: it keeps the packet. */
function nextHop(at: number, arrow: number): number {
  if (at === SRC) return R1;
  if (at === R1) return ARROWS[arrow].to;
  return -1;
}

/** The centre of a router's pad. */
const centreOf = (i: number) => ({ x: (ROUTERS[i].x0 + ROUTERS[i].x1) / 2, y: ROUTERS[i].top });

/** One router: a glowing pad on its island, its name under the island, and its arrow (DEST is a sink, a dot). */
function drawRouter(g: CanvasRenderingContext2D, i: number, arrow: number) {
  const q = ROUTERS[i], c = centreOf(i);
  g.strokeStyle = PAL.trace;
  g.shadowColor = PAL.trace;
  g.shadowBlur = LINE.traceGlow;
  g.beginPath();
  g.moveTo(q.x0, q.top - 2);
  g.lineTo(q.x1, q.top - 2);
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = PAL.text;
  g.font = `13px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(q.name, c.x, q.top + ISLAND_H + 10);
  const ay = q.top - 24;
  if (i === DEST) {
    g.fillStyle = PAL.trace;
    g.beginPath();
    g.arc(c.x, ay, 4, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const dir = i === SRC ? SRC_ARROW : ARROWS[arrow];
  const half = 18;
  const sx = c.x - dir.dx * half, sy = ay - dir.dy * half;
  const ex = c.x + dir.dx * half, ey = ay + dir.dy * half;
  g.strokeStyle = PAL.trace;
  g.lineWidth = LINE.world;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(ex, ey);
  // the arrowhead: two short strokes back from the tip
  const hx = -dir.dx * 7, hy = -dir.dy * 7;
  g.moveTo(ex, ey);
  g.lineTo(ex + hx - dir.dy * 5, ey + hy + dir.dx * 5);
  g.moveTo(ex, ey);
  g.lineTo(ex + hx + dir.dy * 5, ey + hy - dir.dx * 5);
  g.stroke();
}

export const ROUTING: MechanicDef<RoutingState> = {
  kind: 'routing',
  room: routingRoom,
  init: () => ({ t: 0, arrow: 0, packet: null, armed: false, open: false, bounceSaid: false, toldPit: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    s.t = c.t;
    if (c.used === 'arrow') { s.arrow = (s.arrow + 1) % ARROWS.length; c.sfx('lever'); }
    // a crate that arrives on SRC is a new packet; a crate left sitting there is not sent again
    const onSrc = c.props.some(onSource);
    if (onSrc && !s.armed) { s.packet = { at: SRC, dwell: 0, hops: 0 }; c.sfx('plate'); }
    s.armed = onSrc;
    const p = s.packet;
    if (p && p.at !== DEST) {
      p.dwell += 1;
      if (p.dwell >= DWELL) {
        p.dwell = 0;
        const next = nextHop(p.at, s.arrow);
        if (next < 0) {
          s.packet = null;
          c.say(LOST);
        } else {
          p.at = next;
          p.hops += 1;
          c.sfx('rowTick');
          if (next === DEST) {
            s.open = true;
            c.open('exit');
            c.say(DELIVERED);
          } else if (p.hops >= BOUNCE_HOPS && !s.bounceSaid) {
            s.bounceSaid = true;
            c.say(BOUNCE);
          }
        }
      }
    }
    // the pit: a drone that drops below the islands is back at the start, with no damage
    if (c.drone.y > FALL_Y) {
      c.warp(SPAWN.x, SPAWN.y);
      if (!s.toldPit) { s.toldPit = true; c.say(PIT_LINE); }
    }
    // past the door, with the packet home
    if (s.open && c.drone.x > DOOR.x + DOOR.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    // the pit: a dashed hostile rule along the floor line, with its words, both above the floor line
    g.strokeStyle = PAL.hostile;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(PIT_X0, F - 2);
    g.lineTo(PIT_X1, F - 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = PAL.hostile;
    g.font = `13px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('! PIT: no floor. A fall sends you back.', (PIT_X0 + PIT_X1) / 2, F - 8);
    ROUTERS.forEach((_, i) => drawRouter(g, i, s.arrow));
    // the packet, as a small box above its router
    const p = s.packet;
    if (p) {
      const c = centreOf(p.at), y = c.y - PKT_LIFT;
      g.strokeStyle = PAL.amber;
      g.fillStyle = PAL.fill;
      g.fillRect(c.x - PKT_HALF, y - PKT_HALF, PKT_HALF * 2, PKT_HALF * 2);
      g.strokeRect(c.x - PKT_HALF, y - PKT_HALF, PKT_HALF * 2, PKT_HALF * 2);
      g.fillStyle = PAL.amber;
      g.font = `11px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText('PKT', c.x, y - PKT_HALF - 4);
    }
    // the door's word: the packet is home
    g.fillStyle = s.open ? PAL.ok : PAL.idle;
    g.font = `12px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText(s.open ? 'PACKET HOME' : 'WAITING', DOOR.x + DOOR.w / 2, DOOR.y - 8);
    // the readout: the hop count, R1's arrow, and a livelock warning once the packet bounces
    const hops = p ? p.hops : 0;
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(`Hops: ${hops}`, 40, 100);
    g.fillText(`R1 arrow: ${ARROWS[s.arrow].word}`, 40, 122);
    if (p && p.at !== DEST && hops >= BOUNCE_HOPS) {
      g.fillStyle = PAL.hostile;
      g.fillText('! LIVELOCK: the packet bounces forever', 40, 144);
    }
    g.restore();
  },
  nudge: 'Put the packet on SRC, then press ARROW on R1 to point it at DEST.',
};

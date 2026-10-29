// Room templates for the place engine (Phase 3 Spec, section 4): the eight room kinds a place is built from. Each
// template returns a Shell that compose.ts places and hangs its stations, gates and lifts on. Every room is h 720 with
// its floor at F = 640, closed on the left, and leaves through a doorway in the right wall. Layouts are picked by rng
// (port, panel) or sized by opts (annex, bench); built on kit.ts.
import type { Rect } from '../../level/room';
import type { Vec } from '../../physics/geom';
import { floorY, pick, r, shell, spawnAt, trace } from './kit';
import type { Shell, Template } from '../types';

const H = 720;
const F = floorY(H);

/** What a room adds to its outer shell (every field optional). */
interface Parts {
  /** Doorway height in the right wall; 0 closes it. Default 150. */
  door?: number;
  /** Solids beyond the shell's walls and floor. */
  solids?: Rect[];
  oneWay?: Rect[];
  /** The standing surfaces from spawn to exit, in order. Default: the floor. */
  footholds?: Rect[];
  spawn?: Vec;
  exit?: Shell['exit'];
  anchors?: Partial<Shell['anchors']>;
  signs?: Shell['signs'];
}

/** Two decorative traces on the back wall, kept between y 160 and 520. */
const wallTraces = (w: number): Vec[][] => [trace(0, w, 440), trace(200, w - 200, 300, -40)];

/** Assembles a w-wide room: the shell, then what the template adds. */
function room(w: number, p: Parts = {}): Shell {
  return {
    w,
    h: H,
    solids: [...shell(w, H, { door: p.door }), ...(p.solids ?? [])],
    oneWay: p.oneWay ?? [],
    hazards: [],
    plates: [],
    spawn: p.spawn ?? spawnAt(140, F),
    exit: p.exit ?? { x: w - 40 },
    anchors: { stations: [], enemies: [], props: [], ...p.anchors },
    footholds: p.footholds ?? [r(0, F, w, 80)],
    traces: wallTraces(w),
    signs: p.signs ?? [],
  };
}

/** A shut door of `height` on the floor at x, with the solid wall above it that seals the room. */
function sealDoor(x: number, height: number): { gate: Rect; above: Rect } {
  return { gate: r(x, F - height, 48, height), above: r(x, 0, 48, F - height) };
}

/** `n` stations on the floor, `gap` px apart from x0. */
const row = (n: number, x0: number, gap: number): Vec[] =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + gap * i, y: F }));

/** The landing: the lift the drone arrives on, with the place's name on the back wall. */
export const landing: Template = () =>
  room(1280, {
    solids: [r(140, F - 12, 160, 12)], // the lift deck
    spawn: spawnAt(220, F - 12), // standing on the deck
    anchors: { lift: { x: 220, y: F } },
    signs: [{ x: 640, y: 200, text: '' }],
  });

/** The port: where a module is plugged in. Three layouts: flat, a raised dais, or two steps up. */
export const port: Template = (rng) => {
  const layout = pick(rng, ['flat', 'dais', 'steps'] as const);
  if (layout === 'dais') {
    const w = 1600, d = sealDoor(w - 260, 200), dais = r(w / 2 - 160, F - 40, 320, 40);
    return room(w, {
      solids: [dais, d.above],
      footholds: [r(0, F, dais.x, 80), dais, r(dais.x + dais.w, F, w - dais.x - dais.w, 80)],
      anchors: { stations: [{ x: dais.x + dais.w / 2, y: dais.y }], gate: d.gate },
    });
  }
  if (layout === 'steps') {
    const w = 1800, d = sealDoor(w - 260, 200);
    const low = r(500, F - 40, 300, 40), high = r(800, F - 80, 400, 80);
    return room(w, {
      solids: [low, high, d.above],
      footholds: [r(0, F, low.x, 80), low, high, r(high.x + high.w, F, w - high.x - high.w, 80)],
      anchors: { stations: [{ x: high.x + high.w / 2, y: high.y }], gate: d.gate },
    });
  }
  const w = 1400, d = sealDoor(w - 260, 200);
  return room(w, { solids: [d.above], anchors: { stations: [{ x: w / 2, y: F }], gate: d.gate } });
};

/** The panel: one station in a chamber. The balcony variant adds a one-way ledge with a crate on it. */
export const panel: Template = (rng) => {
  const w = 1600, d = sealDoor(w - 200, 200);
  const balcony = pick(rng, [false, true]);
  return room(w, {
    solids: [d.above],
    oneWay: balcony ? [r(300, F - 150, 300, 16)] : [],
    anchors: {
      stations: [{ x: 800, y: F }],
      gate: d.gate,
      props: balcony ? [{ x: 450, y: F - 150 - 30 }] : [],
    },
  });
};

/** The annex: a row of optional stations on the floor. Its exit is open. */
export const annex: Template = (_rng, opts) => {
  const n = opts.stations ?? 1;
  return room(Math.max(1280, 400 + 240 * n), {
    anchors: { stations: row(n, 320, 240) },
    signs: [{ x: 200, y: 300, text: 'OPTIONAL · NAND ONLY' }],
  });
};

/** The bench: a row of stations under a rig, with a shut door on the far side. */
export const bench: Template = (_rng, opts) => {
  const n = opts.stations ?? 1;
  const w = Math.max(1280, 640 + 220 * n), d = sealDoor(w - 180, 200);
  const first = 420, last = first + 220 * (n - 1);
  return room(w, {
    solids: [d.above],
    anchors: { stations: row(n, first, 220), rig: { x: (first + last) / 2, y: 380 }, gate: d.gate },
  });
};

/** The gate: one station, then a shut door that the director opens. */
export const gate: Template = () => {
  const w = 1280, d = sealDoor(w - 180, 200);
  return room(w, { solids: [d.above], anchors: { stations: [{ x: 700, y: F }], gate: d.gate } });
};

/** The boss door: the gate, with a taller doorway (220 px) behind it. */
export const bossdoor: Template = () => {
  const w = 1280, d = sealDoor(w - 180, 220);
  return room(w, { door: 220, solids: [d.above], anchors: { stations: [{ x: 700, y: F }], gate: d.gate } });
};

/** The exit: the lift the drone leaves on. The right wall stays shut, and the lift takes the drone out. */
export const exit: Template = () =>
  room(1280, { door: 0, exit: { x: 99999 }, anchors: { lift: { x: 1100, y: F } } });

export const ROOMS = { landing, port, panel, annex, bench, gate, bossdoor, exit };

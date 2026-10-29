// Discovery beat 'clocks', the Clock Bridge (Phase 4 Spec, section 4). Two zones, each with three platforms that move
// 80 px up and down once per tick of its clock: clock A (1 Hz) on the left, clock B (1.6 Hz) on the right, both at 0.7
// of that on Story. A gap splits the zones at the zone line x 800. The drone may cross the line only standing on the
// SYNC pad: stand on it through two ticks of clock B and it rises onto zone B's first level, stays up
// two seconds, then drops back. A crossing off the pad drops the drone back to the spawn. Solved on the far ledge.
import type { Rect } from '../../level/room';
import { easeInOut, FONT, LINE, PAL, rgba } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { DAMAGE, frames, HZ } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The zone line: a crossing of x 800 is allowed only from the SYNC pad. */
const ZONE_X = 800;
/** Clock rates in milli-hertz: clock A 1 Hz, clock B 1.6 Hz. Story runs both at 0.7 of that. */
const RATE_A = 1000, RATE_B = 1600;
/** Milli-hertz per step: a clock at rate r ticks r / MILLI times a step. */
const MILLI = HZ * 1000;
/** A zone platform eases between its two places over this many steps (0.25 s). */
const MOVE = frames(250);
/** A clock lamp stays lit this many steps after its tick (0.12 s). */
const BLINK = frames(120);
/** How far a zone platform moves on each tick, in px. */
const SWING = 80;
/** A zone platform's thickness in px. */
const PLAT_H = 24;
/** A zone platform: its id, its left x, its width, the top of its low place, and the clock that moves it. */
interface Plat { id: string; x: number; w: number; low: number; rate: number }
const PLATS: Plat[] = [
  { id: 'a0', x: 240, w: 120, low: 560, rate: RATE_A },
  { id: 'a1', x: 420, w: 120, low: 500, rate: RATE_A },
  { id: 'a2', x: 600, w: 120, low: 440, rate: RATE_A },
  { id: 'b0', x: 880, w: 100, low: 340, rate: RATE_B },
  { id: 'b1', x: 1020, w: 100, low: 420, rate: RATE_B },
  { id: 'b2', x: 1160, w: 100, low: 500, rate: RATE_B },
];
/** The SYNC pad: its left x and width, its top in the pit at rest, and its top once it has lifted the drone. */
const PAD = { x: 750, w: 100, rest: 440, up: 260 };
/** Clock B ticks the drone must stand through on the pad before it lifts. */
const TICKS_TO_LIFT = 2;
/** The pad's rise and its fall (0.5 s each), and its time up (2 s). */
const LIFT = frames(500), HOLD = frames(2000);
/** The far ledge by the exit: solid, 40 px thick, its top 520 px down. */
const LEDGE = r(1300, 520, 90, 40);
const SPAWN = spawnAt(140, F);
/** The clock lamps and the square waves under them. Each colour is a getter, so it follows the live palette. */
const LAMP_Y = 96, LAMP_R = 22, WAVE_Y = 176, WAVE_AMP = 12;
const CLOCK_VIEW = [
  { name: 'A', rate: RATE_A, lampX: 400, x0: 40, x1: 760, get colour() { return PAL.trace; } },
  { name: 'B', rate: RATE_B, lampX: 1100, x0: 840, x1: 1380, get colour() { return PAL.ok; } },
];

type PadPhase = 'rest' | 'rise' | 'up' | 'fall';
/** The pad: its phase, the steps into that phase, and the clock B ticks counted while the drone stands on it. */
interface Pad { phase: PadPhase; k: number; count: number }

/** Steps each moving phase lasts. */
const DUR: Record<Exclude<PadPhase, 'rest'>, number> = { rise: LIFT, up: HOLD, fall: LIFT };

export interface ClocksState {
  /** The step count, for the draw. */
  t: number;
  /** Story difficulty (slower clocks), for the draw. */
  story: boolean;
  /** The drone's centre x on the last step, to see a crossing of the zone line. */
  x: number;
  pad: Pad;
  /** The zone-line warning has been said. */
  said: boolean;
  solved: boolean;
}

const none = {
  oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
  stations: [], triggers: [],
};

function clocksRoom(): StoryRoom {
  return {
    ...none,
    traces: [trace(0, 700, 420), trace(900, 1360, 420)],
    id: 'discovery-clocks', name: 'clocks', role: 'discovery', mechanic: 'clocks', w: W, h: H, music: 'core',
    modules: [],
    spawn: SPAWN,
    solids: [
      ...shell(W, H, { floor: false }), r(0, F, 700, 80), r(1448, F, 152, 80), LEDGE, r(W - 200, 0, 48, F - 200),
    ],
    gates: [
      ...PLATS.map((p) => ({ id: p.id, kind: 'lift' as const, rect: r(p.x, p.low, p.w, PLAT_H) })),
      { id: 'sync', kind: 'lift', rect: r(PAD.x, PAD.rest, PAD.w, PLAT_H) },
      { id: 'exit', kind: 'door', rect: r(W - 200, F - 200, 48, 200) },
    ],
    exit: { x: W - 40 },
  };
}

/** A clock's rate in milli-hertz on this difficulty: 0.7 of normal on Story. */
const rateOf = (story: boolean, base: number) => (story ? (base * 7) / 10 : base);
/** The number of ticks a clock at this rate has made by step t (tick n lands on step tickAt(n)). */
const ticks = (t: number, rate: number) => Math.floor((t * rate) / MILLI);
/** The step tick n lands on. */
const tickAt = (n: number, rate: number) => Math.ceil((n * MILLI) / rate);
/** The clock ticks on step t. */
const isTick = (t: number, rate: number) => t > 0 && ticks(t, rate) !== ticks(t - 1, rate);
/** The lamp is lit for BLINK steps after each tick. */
const lit = (t: number, rate: number) => {
  const n = ticks(t, rate);
  return n > 0 && t - tickAt(n, rate) < BLINK;
};

/** How far a zone platform has moved from its low place (0 to 1): one eased move per tick, at rest between. */
function swing(t: number, rate: number): number {
  const n = ticks(t, rate);
  if (n === 0) return 0;
  const now = n % 2, before = 1 - now;
  return before + (now - before) * easeInOut((t - tickAt(n, rate)) / MOVE);
}

/** The drone stands on a rect: grounded, within its width, feet on its top. */
function standing(c: MechCtx, rect: Rect): boolean {
  const d = c.drone, cx = d.x + d.w / 2;
  return c.grounded && cx > rect.x && cx < rect.x + rect.w && Math.abs(d.y + d.h - rect.y) <= 2;
}

/** Moves the pad's phase on one step. A fall that ends sends it back to rest with the count cleared. */
function advancePad(p: Pad) {
  if (p.phase === 'rest') return;
  p.k += 1;
  if (p.k < DUR[p.phase]) return;
  p.k = 0;
  if (p.phase === 'rise') p.phase = 'up';
  else if (p.phase === 'up') p.phase = 'fall';
  else { p.phase = 'rest'; p.count = 0; }
}

/** The pad's top in its current phase. */
function padTop(p: Pad): number {
  switch (p.phase) {
    case 'rest': return PAD.rest;
    case 'up': return PAD.up;
    case 'rise': return PAD.rest + (PAD.up - PAD.rest) * easeInOut(p.k / LIFT);
    case 'fall': return PAD.up + (PAD.rest - PAD.up) * easeInOut(p.k / LIFT);
  }
}

/** A clock lamp: a ring that lights on its tick. */
function clockLamp(g: CanvasRenderingContext2D, x: number, name: string, on: boolean) {
  g.beginPath();
  g.arc(x, LAMP_Y, LAMP_R, 0, Math.PI * 2);
  if (on) {
    g.fillStyle = PAL.amber;
    g.shadowColor = PAL.amber;
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([6, 6]);
    g.stroke();
    g.setLineDash([]);
  }
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(`CLOCK ${name}`, x, LAMP_Y + LAMP_R + 18);
}

/** A square wave in its clock's rhythm, one px a step and scrolling left: its level flips on every tick. */
function wave(g: CanvasRenderingContext2D, t: number, rate: number, x0: number, x1: number, colour: string) {
  const at = (n: number) => WAVE_Y - WAVE_AMP * (n % 2);
  const from = t - (x1 - x0);
  const n0 = Math.max(0, ticks(from, rate));
  g.strokeStyle = colour;
  g.lineWidth = LINE.trace;
  g.beginPath();
  g.moveTo(x0, at(n0));
  let k = n0 + 1;
  while (x0 + tickAt(k, rate) - from <= x1) {
    const x = x0 + tickAt(k, rate) - from;
    g.lineTo(x, at(k - 1));
    g.lineTo(x, at(k));
    k += 1;
  }
  g.lineTo(x1, at(k - 1));
  g.stroke();
}

export const CLOCKS: MechanicDef<ClocksState> = {
  kind: 'clocks',
  room: clocksRoom,
  init: () => ({ t: 0, story: false, x: SPAWN.x, pad: { phase: 'rest', k: 0, count: 0 }, said: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    s.t = c.t;
    s.story = c.story;
    const rateB = rateOf(s.story, RATE_B);
    const cx = c.drone.x + c.drone.w / 2;
    // the zone line: a crossing that is not on the SYNC pad drops the drone back to the spawn
    if (s.x < ZONE_X && cx >= ZONE_X && !standing(c, c.rect('sync'))) {
      if (!s.said) { s.said = true; c.say('The gap only lets through what stands on SYNC.'); }
      c.hurt(DAMAGE.pit);
      c.warp(SPAWN.x, SPAWN.y);
      s.x = SPAWN.x;
    } else {
      s.x = cx;
    }
    // SYNC: stood on through two ticks of clock B, it lifts the drone onto zone B's first level
    const pad = s.pad;
    if (pad.phase === 'rest') {
      if (!standing(c, c.rect('sync'))) {
        pad.count = 0;
      } else if (isTick(c.t, rateB)) {
        pad.count += 1;
        c.sfx('rowTick');
        if (pad.count >= TICKS_TO_LIFT) {
          pad.phase = 'rise';
          pad.k = 0;
          c.sfx('liftHum');
        }
      }
    }
    advancePad(pad);
    c.move('sync', PAD.x, padTop(pad));
    for (const p of PLATS) c.move(p.id, p.x, p.low - SWING * swing(c.t, rateOf(s.story, p.rate)));
    if (standing(c, LEDGE)) {
      s.solved = true;
      c.say('Two flops, two clocks. Both in step.');
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    // the zone line, a thin dashed magenta rule
    g.lineWidth = LINE.hud;
    g.strokeStyle = PAL.neon;
    g.setLineDash([4, 8]);
    g.beginPath();
    g.moveTo(ZONE_X, 0);
    g.lineTo(ZONE_X, F);
    g.stroke();
    g.setLineDash([]);
    g.lineWidth = LINE.world;
    for (const v of CLOCK_VIEW) {
      const rate = rateOf(s.story, v.rate);
      clockLamp(g, v.lampX, v.name, lit(s.t, rate));
      wave(g, s.t, rate, v.x0, v.x1, rgba(v.colour, 0.35));
    }
    // the SYNC pad, with two tick marks that fill as clock B ticks are counted on it
    const top = padTop(s.pad);
    g.lineWidth = LINE.world;
    g.strokeStyle = PAL.amber;
    g.strokeRect(PAD.x, top, PAD.w, PLAT_H);
    for (let i = 0; i < TICKS_TO_LIFT; i++) {
      const mx = PAD.x + 30 + i * 40;
      if (s.pad.count > i) {
        g.fillStyle = PAL.amber;
        g.shadowColor = PAL.amber;
        g.shadowBlur = 10;
        g.fillRect(mx, top - 16, 6, 12);
        g.shadowBlur = 0;
      } else {
        g.strokeStyle = PAL.idle;
        g.strokeRect(mx, top - 16, 6, 12);
        g.strokeStyle = PAL.amber;
      }
    }
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('SYNC', PAD.x + PAD.w / 2, top + PLAT_H + 18);
    g.restore();
  },
  nudge: 'Stand on SYNC and wait two ticks of clock B.',
};

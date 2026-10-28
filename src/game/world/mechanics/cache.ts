// Discovery beat, Cache Hierarchy (Phase 7 Spec, section 4): a KEY block sits on a MEMORY shelf at the far left, 1200 px
// from the door. Lever REQUEST by the door starts a 3 s timer, and the door opens if the KEY reaches its slot in time.
// A CACHE shelf stands 200 px from the door. Carry the KEY to the cache (no timer), press REQUEST, then move the KEY from
// the cache to its slot within 3 s. A REQUEST with the KEY still in memory misses: the timer runs out and resets, and the
// readout says "miss: 4.2 s", the trip to memory. Solved past the door.
import type { PropSpec, Rect } from '../../level/room';
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { crateSide, frames, HZ } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** Block side, px (a mass 2 crate), and the centre height of a block on the floor or on a shelf. */
const SIDE = crateSide(2), HALF = SIDE / 2;
/** The two shelves are 60 px ledges. The MEMORY shelf's centre is 1200 px from the door, the CACHE shelf's 200 px. */
const LEDGE_H = 60;
const LEDGE_TOP = F - LEDGE_H;
const LEDGE_CY = LEDGE_TOP - HALF - 1;
const MEMORY_SHELF = r(140, LEDGE_TOP, 120, LEDGE_H);
const CACHE_SHELF = r(1140, LEDGE_TOP, 120, LEDGE_H);
/** The KEY's slot on the floor, near the door, and the REQUEST lever by the door. */
const SLOT = r(1280, F - 6, 40, 6);
const REQUEST_X = 1360;
/** The REQUEST timer: 3 s from the press. The readout's miss shows for 2 s. */
const TIMER = frames(3000);
const MISS_SHOW = frames(2000);
/** The trip times the shelves show, in seconds. A miss costs the trip to memory. */
const MEMORY_S = 4.2, CACHE_S = 0.8;
/** The KEY's start, on the MEMORY shelf. */
const KEY_X = MEMORY_SHELF.x + MEMORY_SHELF.w / 2;
/** Lines TAPEOUT says when the KEY reaches its slot with no REQUEST, when a REQUEST misses, and when the beat is done. */
const HINT_LINE = 'Press REQUEST first. Then the KEY has 3 seconds.';
const MISS_LINE = 'That was a trip to memory. Keep the KEY in the cache.';
const SOLVE_LINE = 'Keep data you use often close by. A cache hit is fast.';

/** Where the KEY lies on the last step. */
export type KeyWhere = 'memory' | 'cache' | 'slot' | 'held';

export interface CacheState {
  /** Where the KEY lies on the last step. */
  where: KeyWhere;
  /** Steps left on the REQUEST timer; 0 when idle. */
  timer: number;
  /** Steps left on the miss readout. */
  miss: number;
  /** The KEY reached its slot in time: the door is open and stays open. */
  open: boolean;
  /** The no-REQUEST hint has been said. */
  told: boolean;
  /** The miss line has been said. */
  toldMiss: boolean;
  solved: boolean;
}

function cacheRoom(): StoryRoom {
  const props: PropSpec[] = [{ kind: 'crate', mass: 2, x: KEY_X, y: LEDGE_CY }];
  return {
    name: 'Cache Hierarchy', w: W, h: H, spawn: spawnAt(80, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y), MEMORY_SHELF, CACHE_SHELF, SLOT],
    oneWay: [], hazards: [], plates: [], props, enemies: [], floaters: [], spikes: [], emitters: [], signs: [],
    traces: [trace(0, 700, 420), trace(900, W, 420)],
    id: 'discovery-cache', role: 'discovery', mechanic: 'cache', music: 'cluster', modules: [],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }],
    stations: [{ id: 'request', kind: 'lever', x: REQUEST_X, y: F, label: 'REQUEST' }],
    triggers: [],
    exit: { x: W - 40 },
  };
}

/** Whether a loose prop's centre lies over a rect and its bottom sits on the rect's top (or the floor for the slot). */
const onTop = (p: Rect, zone: Rect, top: number): boolean => {
  const cx = p.x + p.w / 2, bottom = p.y + p.h;
  return cx >= zone.x && cx <= zone.x + zone.w && Math.abs(bottom - top) <= 3;
};

/** Where the KEY lies: the one loose prop, by its shelf or slot, else in memory; carried by the drone when none is loose. */
function locate(c: MechCtx): KeyWhere {
  const key = c.props[0];
  if (!key) return 'held';
  if (onTop(key, SLOT, F)) return 'slot';
  if (onTop(key, CACHE_SHELF, LEDGE_TOP)) return 'cache';
  return 'memory';
}

export const CACHE: MechanicDef<CacheState> = {
  kind: 'cache',
  room: cacheRoom,
  init: () => ({ where: 'memory', timer: 0, miss: 0, open: false, told: false, toldMiss: false, solved: false }),
  step(s, c) {
    if (s.solved) return;
    s.where = locate(c);
    // REQUEST starts the timer when it is idle; a press while it runs does nothing
    if (c.used === 'request' && s.timer === 0 && !s.open) {
      s.timer = TIMER;
      c.sfx('lever');
    }
    if (s.timer > 0 && !s.open && s.where === 'slot') {
      // in time: the KEY reached its slot before the timer ran out
      s.open = true;
      s.timer = 0;
      c.sfx('door');
      c.open('exit');
    } else if (s.timer > 0) {
      s.timer -= 1;
      if (s.timer === 0) {
        // ran out: the readout shows the trip to memory, and the timer is idle for the next press
        s.miss = MISS_SHOW;
        c.sfx('plate');
        if (!s.toldMiss) { s.toldMiss = true; c.say(MISS_LINE); }
      }
    } else if (!s.open && s.where === 'slot' && !s.told) {
      // the KEY reached its slot with no REQUEST running
      s.told = true;
      c.say(HINT_LINE);
    }
    if (s.miss > 0) s.miss -= 1;
    if (s.open && c.drone.x + c.drone.w / 2 > DOOR.x + DOOR.w) {
      s.solved = true;
      c.say(SOLVE_LINE);
      c.solve();
    }
  },
  draw(g, s) {
    g.save();
    g.lineWidth = LINE.world;
    g.fillStyle = PAL.text;
    g.font = `14px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // the two shelves' trip times, above the key's tag so the tag and the label never cross
    g.fillText(`MEMORY ${MEMORY_S} S`, MEMORY_SHELF.x + MEMORY_SHELF.w / 2, 470);
    g.fillText(`CACHE ${CACHE_S} S`, CACHE_SHELF.x + CACHE_SHELF.w / 2, 470);
    g.fillStyle = s.where === 'cache' ? PAL.ok : PAL.idle;
    g.font = `12px ${FONT}`;
    g.fillText(s.where === 'cache' ? 'CACHE HOLDS KEY' : 'CACHE', CACHE_SHELF.x + CACHE_SHELF.w / 2, 446);
    // the KEY's slot, on the floor, above the floor line
    g.fillStyle = s.where === 'slot' ? PAL.trace : PAL.idle;
    g.fillText('KEY SLOT', SLOT.x + SLOT.w / 2, F - 24);
    g.strokeStyle = s.where === 'slot' ? PAL.trace : PAL.idle;
    g.setLineDash(s.where === 'slot' ? [] : [4, 4]);
    g.strokeRect(SLOT.x - 4, SLOT.y - 2, SLOT.w + 8, SLOT.h + 2);
    g.setLineDash([]);
    // the timer, by the REQUEST lever: its time left, or READY
    g.font = `13px ${FONT}`;
    g.fillStyle = PAL.text;
    g.fillText(s.timer > 0 ? `REQUEST ${(s.timer / HZ).toFixed(1)} S LEFT` : 'REQUEST READY', REQUEST_X, F - 70);
    // the miss readout: a "!" and words, so it never rests on colour alone
    if (s.miss > 0) {
      g.fillStyle = PAL.hostile;
      g.fillText(`! miss: ${MEMORY_S} s`, REQUEST_X, F - 100);
    }
    g.restore();
  },
  nudge: 'Carry the KEY to the CACHE shelf first. Then press REQUEST.',
};

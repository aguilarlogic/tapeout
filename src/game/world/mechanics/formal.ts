// Discovery beat 'formal', Proof Engine (Phase 7 Spec, section 4): three corridors branch from a hub. A PROVER sweeps
// them one at a time, and each corridor it checks shows PROVED. The third corridor sits behind a solid ASSUME wall
// ("assume: no one enters"). While ASSUME is on, the prover trusts the wall and proves that corridor anyway, so all
// three lamps read PROVED and the door stays shut. Flip ASSUME off and the wall fades: the prover checks the corridor,
// and a red CEX block (a counterexample, 60 HP) appears in its corner. Shoot it: six hits of 10 damage each. The door
// opens, and the beat is solved past it. The door's sign reads "PROVED, MOSTLY".
import { FONT, LINE, PAL } from '../../render/palette';
import type { StoryRoom } from '../../story/types';
import { frames } from '../../tuning';
import { floorY, r, shell, spawnAt, trace } from '../templates/kit';
import type { MechanicDef, MechCtx } from '../types';

const W = 1600, H = 720, F = floorY(H);
/** The exit door: 48 x 200 at the right, with the wall solid above it. */
const DOOR = r(W - 200, F - 200, 48, 200);
/** Past this x the drone has passed the door (the door is 48 px wide, its right edge at W - 152). */
const PASS_X = W - 152;
/** The hub's ledge: a step the drone jumps onto, 140 px up, from which it aims into the third corridor. */
const LEDGE = r(180, 500, 220, 140);
/** The corridors' mouths on the hub side, and the far end of each. Interiors, top and bottom, per corridor. */
const MOUTH_X = 420, END_X = 1200;
const TUBES = [{ top: 150, bottom: 230 }, { top: 300, bottom: 380 }, { top: 460, bottom: 540 }];
/** The third corridor's solid walls: its top and bottom slabs and its far end. */
const TUBE3 = [
  r(MOUTH_X, 440, END_X - MOUTH_X, 20),
  r(MOUTH_X, 540, END_X - MOUTH_X, 20),
  r(END_X, 440, 16, 120),
];
/** The ASSUME wall: solid across the third corridor's mouth, from its top to its bottom edge. */
const WALL = r(MOUTH_X - 8, 460, 16, 80);
/** The CEX block in the far corner of the third corridor. Its centre is in the corridor's interior. */
const CEX = r(END_X - 80, 468, 36, 36);
/** The CEX block's hit points: 60, and each hit takes 10 (a pulse bolt), so six hits. */
const CEX_HITS = 6;
/** The lever ASSUME, on the floor, and the prover's sweep: one corridor takes this many steps (1.5 s). */
const LEVER_X = 560;
const SWEEP = frames(1500);
/** The prover's lamp: where its label sits, and the door sign's panel. */
const PROVER = { x: 300, y: 120 };
const SIGN = { x: 1234, y: 404, w: 120, h: 28 };

/** TAPEOUT's lines. */
const PROVED_LINE = 'Corridor 3 shows PROVED only because ASSUME says no one enters.';
const DROP_LINE = 'ASSUME is off. The prover must check the third corridor now.';
const FOUND_LINE = 'Counterexample: a real input breaks the rule. Shoot the CEX block.';
const REFUSE_LINE = 'Step out of the corridor before you turn ASSUME on.';
const SOLVE_LINE = 'A tight assumption hides bugs. Dropping it found this one.';

export interface FormalState {
  /** ASSUME is on: the wall stands and the prover trusts it. */
  assume: boolean;
  /** The corridor the prover is sweeping now, 0 to 2. */
  sweep: number;
  /** Steps into the current sweep. A sweep ends when the lamp reaches the corridor's far end. */
  pass: number;
  /** Each corridor's lamp reads PROVED. Corridor 3 reads PROVED only while ASSUME holds. */
  proved: boolean[];
  /** The CEX block is in corridor 3 (it appears once a sweep finds it, and stays until it is shot down). */
  cexUp: boolean;
  /** Hits the CEX block has taken, up to CEX_HITS. */
  cexHits: number;
  /** The door is open: the CEX block is down. */
  open: boolean;
  toldProved: boolean;
  toldDrop: boolean;
  toldFound: boolean;
  solved: boolean;
}

function formalRoom(): StoryRoom {
  return {
    id: 'discovery-formal', name: 'Proved, Mostly', role: 'discovery', mechanic: 'formal', w: W, h: H, music: 'cluster',
    modules: [],
    spawn: spawnAt(140, F),
    solids: [...shell(W, H), r(W - 200, 0, 48, DOOR.y), LEDGE, ...TUBE3],
    oneWay: [], hazards: [], plates: [], props: [], enemies: [], floaters: [], spikes: [], emitters: [],
    signs: [],
    traces: [trace(0, 380, 60), trace(1240, W, 60)],
    gates: [{ id: 'exit', kind: 'door', rect: DOOR }, { id: 'wall', kind: 'shutter', rect: WALL }],
    stations: [{ id: 'assume', kind: 'lever', x: LEVER_X, y: F, label: 'ASSUME' }],
    targets: [{ id: 'cex', rect: CEX }],
    triggers: [],
    exit: { x: W - 40 },
  };
}

/** Whether the drone's centre is inside the third corridor. */
function inCorridor3(c: MechCtx): boolean {
  const cx = c.drone.x + c.drone.w / 2, cy = c.drone.y + c.drone.h / 2;
  return cx > MOUTH_X && cx < END_X && cy > TUBES[2].top && cy < TUBES[2].bottom;
}

/** The lamp's words for corridor k: PROVED, NOT YET, CEX (with a "!") or CEX SHOT. */
function statusOf(s: FormalState, k: number): string {
  if (k < 2) return s.proved[k] ? 'PROVED' : 'NOT YET';
  if (s.cexHits >= CEX_HITS) return 'CEX SHOT';
  if (s.cexUp) return '! CEX';
  return s.proved[2] ? 'PROVED' : 'NOT YET';
}

/** The ASSUME lever: off drops the wall (the prover must check corridor 3); on closes it, unless the drone is inside. */
function lever(s: FormalState, c: MechCtx) {
  if (s.assume) {
    s.assume = false;
    s.proved[2] = false;
    c.sfx('lever');
    c.open('wall');
    if (!s.toldDrop) { s.toldDrop = true; c.say(DROP_LINE); }
    return;
  }
  c.sfx('lever');
  if (inCorridor3(c)) { c.say(REFUSE_LINE); return; }
  s.assume = true;
  c.close('wall');
}

/** The prover: each corridor's sweep ends at its far end, where the lamp marks it PROVED, or finds the CEX block. */
function sweep(s: FormalState, c: MechCtx) {
  s.pass += 1;
  if (s.pass < SWEEP) return;
  s.pass = 0;
  const k = s.sweep;
  s.sweep = (k + 1) % 3;
  if (k < 2) {
    s.proved[k] = true;
  } else if (s.assume) {
    s.proved[2] = true;
    if (!s.toldProved) { s.toldProved = true; c.say(PROVED_LINE); }
  } else if (!s.cexUp && s.cexHits < CEX_HITS) {
    s.cexUp = true;
    c.sfx('rowTick');
    if (!s.toldFound) { s.toldFound = true; c.say(FOUND_LINE); }
  }
}

/** A jagged outline round a rect: a zig-zag on each edge, so a hostile thing is never a plain box. */
function jagged(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const steps = 6;
  g.beginPath();
  g.moveTo(x, y);
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e], [bx, by] = corners[e + 1];
    const horizontal = ay === by;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      const off = i % 2 ? 3 : -3;
      if (i === steps) g.lineTo(bx, by);
      else if (horizontal) g.lineTo(px, py + off);
      else g.lineTo(px + off, py);
    }
  }
  g.closePath();
  g.stroke();
}

/** The three corridors, their lamps and the prover's sweep. */
function drawCorridors(g: CanvasRenderingContext2D, s: FormalState) {
  TUBES.forEach((tube, k) => {
    const mid = (tube.top + tube.bottom) / 2;
    g.strokeStyle = k < 2 ? PAL.idle : PAL.line;
    g.setLineDash(k < 2 ? [6, 6] : []);
    g.strokeRect(MOUTH_X, tube.top, END_X - MOUTH_X, tube.bottom - tube.top);
    g.setLineDash([]);
    g.font = `13px ${FONT}`;
    g.fillStyle = PAL.text;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText(`C${k + 1}`, MOUTH_X - 12, tube.top + 14);
    const status = statusOf(s, k);
    g.textAlign = 'left';
    g.fillStyle = status === 'PROVED' ? PAL.ok : status.includes('CEX') && status !== 'CEX SHOT' ? PAL.hostile : PAL.idle;
    g.fillText(status, END_X + 24, mid);
    if (s.sweep === k) {
      // the prover's lamp rides the corridor from its mouth to its far end during the sweep
      const x = MOUTH_X + (s.pass / SWEEP) * (END_X - MOUTH_X);
      g.beginPath();
      g.arc(x, mid, 7, 0, Math.PI * 2);
      g.fillStyle = PAL.amber;
      g.shadowColor = PAL.amber;
      g.shadowBlur = 12;
      g.fill();
      g.shadowBlur = 0;
    }
  });
  g.fillStyle = PAL.text;
  g.font = `14px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(`PROVER: C${s.sweep + 1}`, PROVER.x, PROVER.y);
}

/** The ASSUME wall: solid while ASSUME holds, dashed once dropped. Its label says which. */
function drawWall(g: CanvasRenderingContext2D, s: FormalState) {
  if (s.assume) {
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(WALL.x, WALL.y, WALL.w, WALL.h);
    g.strokeRect(WALL.x, WALL.y, WALL.w, WALL.h);
  } else {
    g.strokeStyle = PAL.idle;
    g.setLineDash([6, 6]);
    g.strokeRect(WALL.x, WALL.y, WALL.w, WALL.h);
    g.setLineDash([]);
  }
  g.fillStyle = PAL.text;
  g.font = `13px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(s.assume ? 'assume: no one enters' : 'assume dropped', 330, 448);
  g.fillText('HUB', 290, 484);
}

/** The CEX block: a red jagged box with a "!" and its hit points, while it stands. */
function drawCex(g: CanvasRenderingContext2D, s: FormalState) {
  if (!s.cexUp) return;
  const hp = Math.max(0, (CEX_HITS - s.cexHits) * 10);
  const cx = CEX.x + CEX.w / 2;
  if (s.cexHits >= CEX_HITS) {
    g.strokeStyle = PAL.idle;
    g.setLineDash([4, 4]);
    g.strokeRect(CEX.x, CEX.y, CEX.w, CEX.h);
    g.setLineDash([]);
    return;
  }
  g.fillStyle = PAL.fill;
  g.fillRect(CEX.x, CEX.y, CEX.w, CEX.h);
  g.strokeStyle = PAL.hostile;
  g.shadowColor = PAL.hostile;
  g.shadowBlur = 10;
  jagged(g, CEX.x, CEX.y, CEX.w, CEX.h);
  g.shadowBlur = 0;
  g.fillStyle = PAL.hostile;
  g.font = `12px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CEX', cx, CEX.y + CEX.h / 2);
  g.fillText(`${hp} HP`, cx, CEX.y + CEX.h + 12);
}

export const FORMAL: MechanicDef<FormalState> = {
  kind: 'formal',
  room: formalRoom,
  init: () => ({
    assume: true, sweep: 0, pass: 0, proved: [false, false, false], cexUp: false, cexHits: 0, open: false,
    toldProved: false, toldDrop: false, toldFound: false, solved: false,
  }),
  step(s, c) {
    if (s.solved) return;
    if (c.used === 'assume') lever(s, c);
    sweep(s, c);
    // a shot on the CEX block counts once per hit, and only once it is up
    if (s.cexUp && s.cexHits < CEX_HITS) {
      const n = c.hit.filter((id) => id === 'cex').length;
      if (n > 0) {
        s.cexHits = Math.min(CEX_HITS, s.cexHits + n);
        c.sfx('rowTick');
      }
    }
    if (!s.open && s.cexHits >= CEX_HITS) {
      s.open = true;
      c.sfx('door');
      c.open('exit');
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
    drawCorridors(g, s);
    drawWall(g, s);
    drawCex(g, s);
    // the lever's words, above it
    g.fillStyle = PAL.text;
    g.font = `13px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s.assume ? 'ASSUME ON' : 'ASSUME OFF', LEVER_X, F - 60);
    // the door's sign, beside the door
    g.fillStyle = PAL.fill;
    g.strokeStyle = PAL.line;
    g.fillRect(SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2, SIGN.w, SIGN.h);
    g.strokeRect(SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2, SIGN.w, SIGN.h);
    g.fillStyle = PAL.text;
    g.font = `12px ${FONT}`;
    g.fillText('PROVED, MOSTLY', SIGN.x, SIGN.y);
    g.restore();
  },
  nudge: 'Flip ASSUME off. Then the prover can check the third corridor.',
};

// Phase 8 Spec, section 5: the wing bosses' attacks for the Dark Channel (flare), the Qubit That Will Not Behave (phase) and
// the Dead USB Ports (zap). Each shows its telegraph first, in real steps (1.5x on Story, plus Model Lens's steps, as
// timed() gives), then acts on an active clock that advances `speed` per step, so the warning keeps its length. Shot speeds
// are px/s, as the act files give them. Hostile marks use PAL.hostile with a jagged edge or a "!", so the state is never
// colour alone. The ATTACKS table is in table.ts.
import type { Rect } from '../level/room';
import { overlaps } from '../physics/geom';
import { FONT, LINE, PAL, rgba } from '../render/palette';
import { frames } from '../tuning';
import { mid, pulse, tick, timed } from './attacks';
import type { G, Pt, Timed } from './attacks';
import { QUBIT_R, qubitBall } from './bodies-wings-d';
import type { Attack, AttackCtx } from './types';

/** A seeded shuffle of 0 to n-1, drawn from the attack's own generator. */
function shuffled(c: AttackCtx, n: number): number[] {
  const a = Array.from({ length: n }, (_, k) => k);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(c.rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A straight lane from x0 to x1 at height y, in `col` at alpha `a`, dashed or solid by `dash`. */
function lane(g: G, x0: number, x1: number, y: number, col: string, a: number, dash: number[]) {
  g.save();
  g.strokeStyle = col;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash(dash);
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.restore();
}

/** A hostile bar along x from 0 to len, centred on y = 0 and `h` px thick, with a jagged edge (its teeth are 2 px in,
 *  every 10 px). The caller moves and turns it into place. */
function jaggedBar(g: G, len: number, h: number) {
  const n = Math.ceil(len / 10);
  const xs = Array.from({ length: n + 1 }, (_, i) => Math.min(i * 10, len));
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = PAL.hostile;
  g.shadowBlur = LINE.enemyGlow;
  g.beginPath();
  xs.forEach((x, i) => {
    const y = -h / 2 + (i % 2 ? 2 : 0);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  });
  for (let i = n; i >= 0; i--) g.lineTo(xs[i], h / 2 - (i % 2 ? 2 : 0));
  g.closePath();
  g.fillStyle = rgba(PAL.hostile, 0.6);
  g.fill();
  g.restore();
}

// ---- flare (inc-optical, The Dark Channel) -------------------------------------------------------------------------

/** Eight channel lines at even heights, 120 px in from the arena's top and bottom. Four brighten and then flare, four go
 *  dark. Two rounds, with different picks. */
const CHANNELS = 8, BRIGHT = 4, FLARE_ROUNDS = 2, EDGE = 120;
/** The brighten is the telegraph: 0.8 s (real steps). */
const BRIGHTEN = frames(800);
/** A flare is a 10 px tall, full-width beam for 0.4 s (active steps). Each beam hurts the drone 12, once per round. */
const BEAM_H = 10, BEAM_LIFE = frames(400), BEAM_DMG = 12;
/** A channel's number sits 24 px in from the arena's left edge. A bright channel also shows a "!" 44 px in. */
const NUM_X = 24, BANG_X = 44;

interface Channel { y: number; label: number; bright: boolean; hit: boolean }
interface FlareRun extends Timed { arena: Rect; round: number; lines: Channel[] }

/** The beam for a channel at height y: the arena's full width, BEAM_H tall, centred on the line. */
const beamRect = (a: Rect, y: number): Rect => ({ x: a.x, y: y - BEAM_H / 2, w: a.w, h: BEAM_H });

/** The next round's bright channels: four picked at random, never the same four as `before`. */
function pickBright(c: AttackCtx, before: boolean[]): boolean[] {
  const order = shuffled(c, CHANNELS);
  const bright = Array.from({ length: CHANNELS }, () => false);
  for (let k = 0; k < BRIGHT; k++) bright[order[k]] = true;
  if (bright.every((v, k) => v === before[k])) {
    // the same four again: trade the first pick for the first dark one
    bright[order[0]] = false;
    bright[order[BRIGHT]] = true;
  }
  return bright;
}

/** Starts a round: new picks, and the brighten telegraph (0.8 s in real steps, longer on Story and with Model Lens). */
function flareRound(c: AttackCtx, run: FlareRun) {
  const bright = pickBright(c, run.lines.map((l) => l.bright));
  run.lines.forEach((l, k) => { l.bright = bright[k]; l.hit = false; });
  run.tele = timed(c, BRIGHTEN).tele;
  run.age = 0;
  run.t = 0;
}

/** Eight channels brighten or go dark over 0.8 s. The bright four then flare as full-width beams for 0.4 s, and hurt the
 *  drone 12 once each. Each channel carries its number, and a bright one a "!", so the state is not just colour. */
export const flare: Attack<FlareRun> = {
  id: 'flare',
  start(c) {
    const a = c.arena;
    const top = a.y + EDGE, bottom = a.y + a.h - EDGE;
    const lines = Array.from({ length: CHANNELS }, (_, k): Channel => ({
      y: top + (k * (bottom - top)) / (CHANNELS - 1), label: k + 1, bright: false, hit: false,
    }));
    const run: FlareRun = { ...timed(c, BRIGHTEN), arena: a, round: 0, lines };
    flareRound(c, run);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('laser');
    if (run.t >= BEAM_LIFE) {
      if (run.round + 1 >= FLARE_ROUNDS) return true;
      run.round++;
      flareRound(c, run);
      return false;
    }
    for (const l of run.lines) {
      if (!l.bright || l.hit) continue;
      const r = beamRect(run.arena, l.y);
      if (overlaps(c.drone, r)) {
        l.hit = true;
        c.hurt(r, BEAM_DMG);
      }
    }
    return false;
  },
  draw(g, run, _t) {
    const a = run.arena, x1 = a.x + a.w, tele = run.age <= run.tele, k = tele ? run.age / run.tele : 1;
    for (const l of run.lines) {
      if (!l.bright) lane(g, a.x, x1, l.y, PAL.idle, tele ? 0.5 - 0.4 * k : 0.1, [6, 6]);
      else if (tele) lane(g, a.x, x1, l.y, PAL.hostile, 0.2 + 0.8 * k, [6, 6]);
      else {
        g.save();
        g.translate(a.x, l.y);
        jaggedBar(g, a.w, BEAM_H);
        g.restore();
      }
      g.save();
      g.font = `12px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = PAL.text;
      g.fillText(String(l.label), a.x + NUM_X, l.y);
      if (l.bright) {
        g.fillStyle = PAL.hostile;
        g.fillText('!', a.x + BANG_X, l.y);
      }
      g.restore();
    }
  },
};

// ---- phase (inc-qubit, The Qubit That Will Not Behave) -------------------------------------------------------------

/** The two ghost copies of the qubit are labelled |0⟩ (left third of the arena) and |1⟩ (right third). */
export const GHOST_LABELS = ['|0⟩', '|1⟩'] as const;
const GHOSTS = 2, PHASE_ROUNDS = 3;
/** The ghosts show for 0.8 s (real steps). The label of the one about to fire flashes "!" for the last 0.3 s. */
const GHOST_WARN = frames(800), FLASH_LEN = frames(300);
/** The fan: 9 bolts at 380 px/s, 9 each, spread over 0.6 rad, the middle one aimed at the drone. */
const FAN = 9, FAN_SPREAD = 0.6, FAN_V = 380, FAN_DMG = 9;
/** After the fan, 0.5 s (active steps) before the next round's ghosts. */
const PHASE_GAP = frames(500);

interface PhaseRun extends Timed {
  round: number;
  /** The ghost centres: the left third and the right third of the arena. */
  spots: Pt[];
  /** The ghost about to fire this round: 0 for the left, 1 for the right. */
  pick: number;
  /** The ghost that fired in each round, in order. */
  picked: number[];
}

/** Starts a round: the ghosts show for 0.8 s and a random one is picked to fire. */
function aim(c: AttackCtx, run: PhaseRun) {
  run.tele = timed(c, GHOST_WARN).tele;
  run.age = 0;
  run.t = 0;
  run.pick = Math.floor(c.rand() * GHOSTS);
  run.picked.push(run.pick);
}

/** The picked ghost fires nine bolts in a fan at the drone (380 px/s, 9 each). */
function fan(c: AttackCtx, run: PhaseRun) {
  const o = run.spots[run.pick], d = mid(c.drone);
  const a0 = Math.atan2(d.y - o.y, d.x - o.x);
  for (let k = 0; k < FAN; k++) {
    const a = a0 + (k - (FAN - 1) / 2) * (FAN_SPREAD / (FAN - 1));
    c.shoot(o.x, o.y, Math.cos(a) * FAN_V, Math.sin(a) * FAN_V, FAN_DMG);
  }
}

/** Two ghost copies of the qubit show at the left and right thirds, labelled |0⟩ and |1⟩, for 0.8 s. One, picked at random,
 *  fires a fan of nine bolts at the drone. Three rounds. Its label gets a "!" for the last 0.3 s before it fires. */
export const phase: Attack<PhaseRun> = {
  id: 'phase',
  start(c) {
    const a = c.arena;
    const y = a.y + a.h * 0.4;
    const spots: Pt[] = [{ x: a.x + a.w / 6, y }, { x: a.x + (5 * a.w) / 6, y }];
    const run: PhaseRun = { ...timed(c, GHOST_WARN), round: 0, spots, pick: 0, picked: [] };
    aim(c, run);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') {
      c.sfx('turret');
      fan(c, run);
    }
    if (run.t < PHASE_GAP) return false;
    if (run.round + 1 >= PHASE_ROUNDS) return true;
    run.round++;
    aim(c, run);
    return false;
  },
  draw(g, run, t) {
    if (run.age > run.tele) return;
    const k = run.age / run.tele, warn = run.tele - run.age < FLASH_LEN;
    run.spots.forEach((p, i) => {
      g.save();
      g.globalAlpha = 0.3 + 0.5 * k;
      qubitBall(g, p.x, p.y, QUBIT_R, t);
      g.font = `14px ${FONT}`;
      g.fillStyle = PAL.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(GHOST_LABELS[i], p.x, p.y + QUBIT_R + 22);
      if (warn && i === run.pick) {
        g.fillStyle = PAL.hostile;
        g.globalAlpha = 0.4 + 0.6 * pulse(t);
        g.fillText('!', p.x + 40, p.y + QUBIT_R + 22);
      }
      g.restore();
    });
  },
};

// ---- zap (inc-esd, The Dead USB Ports) -----------------------------------------------------------------------------

/** Four charge nodes on the floors within 500 px of the drone, each 120 px or more from the next in x where it can be.
 *  Two rounds: a 0.6 s telegraph circle round each node, then three arcs (1 to 2, 2 to 3, 3 to 4). */
const ZAP_NODES = 4, ZAP_ROUNDS = 2, ARCS = 3, ZAP_REACH = 500, NODE_GAP = 120;
/** The telegraph is 0.6 s (real steps). Each arc is live for 0.3 s (active steps), and the arcs start 0.5 s apart. */
const ZAP_WARN = frames(600), ARC_LIFE = frames(300), ARC_GAP = frames(500);
/** Each arc is a hurt line 8 px thick, and it hurts 15 once. Its hurt rects are 8 px squares along the line. */
const ZAP_THICK = 8, ZAP_DMG = 15;
/** A node is a 16 px ring on the floor, and its telegraph circle is 30 px across its middle. */
const NODE_R = 16, RING_R = 30;

interface ZapRun extends Timed {
  round: number;
  /** The four nodes, in number order. */
  nodes: Pt[];
  /** The arc live now (0 to 2, arc k joins nodes k and k+1), or -1 between arcs. */
  arc: number;
  /** Whether each arc has hurt the drone this round. */
  hit: boolean[];
}

/** Four spots on floor tops, each within 500 px of the drone's centre. Picked at random, and spaced where the floors allow. */
function nodeSpots(c: AttackCtx): Pt[] {
  const d = mid(c.drone);
  const cands: Pt[] = [];
  for (const f of c.floors) {
    for (let x = Math.max(f.x, d.x - ZAP_REACH); x <= Math.min(f.x + f.w, d.x + ZAP_REACH); x += 20) {
      const p = { x, y: f.y - NODE_R };
      if (Math.hypot(p.x - d.x, p.y - d.y) <= ZAP_REACH) cands.push(p);
    }
  }
  const out: Pt[] = [];
  for (let tries = 0; tries < 60 && out.length < ZAP_NODES && cands.length; tries++) {
    const p = cands[Math.floor(c.rand() * cands.length)];
    if (out.every((q) => Math.abs(q.x - p.x) >= NODE_GAP)) out.push(p);
  }
  while (out.length < ZAP_NODES) {
    out.push(cands.length ? cands[Math.floor(c.rand() * cands.length)] : { x: d.x, y: d.y });
  }
  return out;
}

/** Starts a round: four new nodes near the drone, and the 0.6 s telegraph (longer on Story and with Model Lens). */
function zapRound(c: AttackCtx, run: ZapRun) {
  run.tele = timed(c, ZAP_WARN).tele;
  run.age = 0;
  run.t = 0;
  run.nodes = nodeSpots(c);
  run.arc = -1;
  run.hit = Array.from({ length: ARCS }, () => false);
  c.sfx('turret');
}

/** The small hurt rects along the arc from a to b: one 8 px square every 8 px, so the rects make up the 8 px line. */
function arcRects(a: Pt, b: Pt): Rect[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / ZAP_THICK));
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    return { x: x - ZAP_THICK / 2, y: y - ZAP_THICK / 2, w: ZAP_THICK, h: ZAP_THICK };
  });
}

/** A dashed PAL.hostile ring round a node, jagged at its edge: its 0.6 s telegraph circle. */
function telegraphRing(g: G, p: Pt, a: number) {
  g.save();
  g.strokeStyle = PAL.hostile;
  g.globalAlpha = a;
  g.lineWidth = LINE.world;
  g.setLineDash([6, 6]);
  g.beginPath();
  for (let k = 0; k <= 24; k++) {
    const r = k % 2 ? RING_R - 4 : RING_R, a = (k / 24) * Math.PI * 2;
    if (k) g.lineTo(p.x + r * Math.cos(a), p.y + r * Math.sin(a));
    else g.moveTo(p.x + r * Math.cos(a), p.y + r * Math.sin(a));
  }
  g.stroke();
  g.restore();
}

/** A charge node: a spiky PAL.hostile ring (its jagged edge) on a PAL.fill disc, with its number in the middle. */
function chargeNode(g: G, p: Pt, label: number) {
  g.save();
  g.beginPath();
  for (let k = 0; k < 12; k++) {
    const r = k % 2 ? NODE_R * 0.75 : NODE_R, a = (k / 12) * Math.PI * 2;
    if (k) g.lineTo(p.x + r * Math.cos(a), p.y + r * Math.sin(a));
    else g.moveTo(p.x + r * Math.cos(a), p.y + r * Math.sin(a));
  }
  g.closePath();
  g.fillStyle = PAL.fill;
  g.fill();
  g.strokeStyle = PAL.hostile;
  g.lineWidth = LINE.enemy;
  g.stroke();
  g.font = `12px ${FONT}`;
  g.fillStyle = PAL.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(label), p.x, p.y);
  g.restore();
}

/** The arc from a to b: a jagged hostile band 8 px thick, turned to lie along the line. */
function arcBand(g: G, a: Pt, b: Pt) {
  g.save();
  g.translate(a.x, a.y);
  g.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  jaggedBar(g, Math.hypot(b.x - a.x, b.y - a.y), ZAP_THICK);
  g.restore();
}

/** Four charge nodes land on the floors near the drone, each with a 0.6 s telegraph circle. Then the arcs run 1 to 2, 2 to 3
 *  and 3 to 4, 0.5 s apart. Each arc is an 8 px line that hurts 15 once. Two rounds, with new nodes each round. */
export const zap: Attack<ZapRun> = {
  id: 'zap',
  start(c) {
    const run: ZapRun = { ...timed(c, ZAP_WARN), round: 0, nodes: [], arc: -1, hit: [] };
    zapRound(c, run);
    return run;
  },
  step(run, c, speed) {
    const ph = tick(run, speed);
    if (ph === 'tele') return false;
    if (ph === 'start') c.sfx('chain');
    run.arc = -1;
    for (let k = 0; k < ARCS; k++) {
      const from = k * ARC_GAP;
      if (run.t < from || run.t >= from + ARC_LIFE) continue;
      run.arc = k;
      if (run.hit[k]) continue;
      const hit = arcRects(run.nodes[k], run.nodes[k + 1]).find((r) => overlaps(c.drone, r));
      if (hit) {
        run.hit[k] = true;
        c.hurt(hit, ZAP_DMG);
      }
    }
    if (run.t < (ARCS - 1) * ARC_GAP + ARC_LIFE) return false;
    if (run.round + 1 >= ZAP_ROUNDS) return true;
    run.round++;
    zapRound(c, run);
    return false;
  },
  draw(g, run, t) {
    const tele = run.age <= run.tele;
    run.nodes.forEach((p, i) => {
      if (tele) telegraphRing(g, p, 0.4 + 0.4 * pulse(t));
      chargeNode(g, p, i + 1);
    });
    if (!tele && run.arc >= 0) arcBand(g, run.nodes[run.arc], run.nodes[run.arc + 1]);
  },
};

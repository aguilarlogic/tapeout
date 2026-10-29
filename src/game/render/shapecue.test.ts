// Phase 10 Spec, section 2.2: state never relies on colour alone. With the Okabe-Ito palette on, the shape cues still draw:
// a hostile enemy keeps its jagged outline, and an unpowered wire is dashed. The draws run on a recording fake context
// that logs each call, so this runs in node. The draws go through the exported enemy registry and the pullnet mechanic.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ENEMY, type MakeCtx } from '../enemies/registry';
import '../enemies/thrash';
import { PULLNET } from '../world/mechanics/pullnet';
import { applyPalette } from './palette';

interface Call { name: string; args: unknown[] }

/** A 2D context that logs every call and paints nothing. It has only the members the cue draws touch. */
function recorder() {
  const calls: Call[] = [];
  const log = (name: string) => (...args: unknown[]) => { calls.push({ name, args }); };
  const ctx: Record<string, unknown> = {};
  for (const name of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'stroke', 'fill', 'fillRect',
    'strokeRect', 'fillText', 'setLineDash', 'translate', 'rotate']) {
    ctx[name] = log(name);
  }
  ctx.measureText = () => ({ width: 0 });
  ctx.createLinearGradient = () => ({ addColorStop: log('addColorStop') });
  ctx.createRadialGradient = () => ({ addColorStop: log('addColorStop') });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** The points a call list moves to or draws to, as [x, y] pairs. */
const points = (calls: Call[], name: 'moveTo' | 'lineTo') =>
  calls.filter((c) => c.name === name).map((c) => [c.args[0] as number, c.args[1] as number] as const);

describe('shape cues with the colour-blind palette', () => {
  beforeEach(() => applyPalette('okabe'));
  afterEach(() => applyPalette('standard'));

  it('a hostile enemy draws a jagged outline, not a plain square', () => {
    const entry = ENEMY.thrash;
    if (!entry) throw new Error('thrash is not registered');
    const k: MakeCtx = { gravity: 0, rand: () => 0.5, act: 1, story: false };
    const made = entry.make(400, 300, k);
    const enemy = Array.isArray(made) ? made[0] : made;
    const { ctx, calls } = recorder();
    entry.draw(ctx, enemy, 0);
    // the first outline: its path runs from the last beginPath to the first closePath
    const close = calls.findIndex((c) => c.name === 'closePath');
    const begin = calls.slice(0, close).map((c) => c.name).lastIndexOf('beginPath');
    const outline = calls.slice(begin, close);
    const pts = points(outline, 'lineTo');
    // a plain square has only its four corners; the jagged one has four more points pushed in or out along each axis
    // the corners sit on the diagonals (equal offsets on both axes); the edge points sit on an axis
    const diagonal = pts.filter(([x, y]) => Math.abs(x - 400) > 0.5 && Math.abs(Math.abs(x - 400) - Math.abs(y - 300)) < 0.5);
    const half = Math.max(...diagonal.map(([x]) => Math.abs(x - 400)));
    const corners = pts.filter(([x, y]) => Math.abs(Math.abs(x - 400) - half) < 0.5 && Math.abs(Math.abs(y - 300) - half) < 0.5);
    expect(points(outline, 'moveTo')).toHaveLength(1);
    expect(pts).toHaveLength(8);
    expect(pts.length - corners.length).toBe(4);
    expect(calls.some((c) => c.name === 'arc')).toBe(false);
  });

  it('an unpowered wire is dashed: setLineDash gets a non-empty pattern while its switch is open', () => {
    const s = PULLNET.init();
    s.input = 0;
    const { ctx, calls } = recorder();
    PULLNET.draw(ctx, s, 0);
    const patterns = calls.filter((c) => c.name === 'setLineDash').map((c) => c.args[0] as number[]);
    // the wire's dash is [4, 5] (pullnet.ts wire()); a solid stroke sets the empty pattern instead
    expect(patterns).toContainEqual([4, 5]);
  });
});

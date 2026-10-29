// Records a short close-up of the drone's legs: idle, walking both ways, backpedalling both ways, turning round
// mid-walk, a jump and a dash each way. Run `npm run build` first.
//   node scripts/record-legs.mjs <out-dir>
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/legs');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.locator('#os').waitFor();
await page.getByTestId('game').waitFor();
await page.waitForFunction(() => window.__tapeoutGame?.ready, null, { timeout: 15000 });
const tReady = Date.now();
await page.evaluate(() => {
  const g = window.__tapeoutGame;
  g.zoom = 2.5;
  // [steps, held actions, aim side (+1 right, -1 left)]
  // first walk out of the corner so the camera can centre the drone (it stops at the room's edge)
  const beats = [
    [200, ['right'], 1], [50, [], 1], [60, ['right'], 1], [60, ['left'], 1], [60, ['left'], -1], [60, ['right'], -1], [60, ['right'], 1],
    [40, [], 1], [1, ['jump'], 1], [60, ['jump'], 1], [30, [], 1], [1, ['dash'], 1], [40, [], 1], [1, ['dash'], -1], [60, [], -1],
  ];
  let i = 0, left = beats[0][0];
  g.drive = (sim) => {
    if (i >= beats.length) return { held: [], aim: { x: sim.drone.x - 400, y: sim.drone.y - 10 } };
    const [, held, side] = beats[i];
    if (--left <= 0 && ++i < beats.length) left = beats[i][0];
    return { held, aim: { x: sim.drone.x + 400 * side, y: sim.drone.y - 10 } };
  };
});
await page.waitForTimeout(16500);
const video = page.video();
await ctx.close();
await browser.close();
const raw = join(out, 'raw.webm');
renameSync(await video.path(), raw);
const ss = Math.max(0, (tReady - t0) / 1000 + 3.2).toFixed(2); // skip the walk out of the corner
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', ss, '-i', raw, '-t', '12', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', join(out, 'legs-closeup.mp4')]);
unlinkSync(raw);
console.log('ok');

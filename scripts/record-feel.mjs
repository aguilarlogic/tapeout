// Records the feel-pass demo of the story test room: a scripted run (walk, jump, shoot the dummy, dash, grab and throw,
// open the door, fight each enemy) as a 1280 x 720 video, plus stills. Run `npm run build` first.
//   node scripts/record-feel.mjs <out-dir>
// Set CHROMIUM_PATH to use a specific Chromium. The scripted player drives the real game through GameScreen.drive.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/feel');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const tPage = Date.now();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.locator('#os').waitFor();
const tClick = Date.now();
await page.getByTestId('story-preview').click();
await page.waitForTimeout(1600);
await page.screenshot({ path: join(out, '1-boot.png') });
await page.waitForFunction(() => window.__tapeoutGame?.ready, null, { timeout: 15000 });

// the scripted player: a small state machine over the sim, one call per 60 Hz step
await page.evaluate(() => {
  const g = window.__tapeoutGame;
  const st = { phase: 'run', t: 0, log: [] };
  window.__bot = st;
  const FLOOR = 1000;
  const go = (p) => { st.log.push(`${g.sim.steps} ${p} x=${g.sim.drone.x.toFixed(0)} y=${g.sim.drone.y.toFixed(0)}`); st.phase = p; st.t = 0; };
  // nearest enemy, Latches last: their armoured front soaks bolts, so they are left until the rest are down
  const nearest = (sim, d) => sim.enemies.filter((e) => e.alive).sort((a, b) => (a.kind === 'latch') - (b.kind === 'latch') || Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
  const logic = (sim, bit) => sim.world.props.find((p) => p.kind === 'logic' && p.bit === bit);
  g.drive = (sim) => {
    const d = sim.drone, held = [];
    let aim = { x: d.x + 400 * d.facing, y: d.y - 20 };
    st.t++;
    switch (st.phase) {
      case 'run': // up the three platforms
        held.push('right');
        aim = { x: d.x + 400, y: d.y - 120 };
        // floor -> platform 1 (top 920) -> platform 2 (840) -> platform 3 (740): jump just short of each edge
        if (d.grounded && ((d.x > 400 && d.x < 460 && d.y > 960) || (d.x > 700 && d.x < 760 && d.y < 910 && d.y > 880) || (st.shotDummy && d.x > 990 && d.x < 1040 && d.y < 830 && d.y > 800))) st.hold = 26;
        if (!st.shotDummy && d.grounded && d.x > 985 && d.y < 830 && d.y > 800) { st.shotDummy = true; go('dummy'); break; }
        if (st.hold > 0) { st.hold--; held.push('jump'); } // hold the whole rise: letting go early cuts it to a short hop
        if (d.x > 1170 && d.grounded && d.y < 730) go('leap');
        if (st.t > 420) go('leap');
        break;
      case 'dummy': // shoot the dummy from platform 2, under platform 3
        aim = { x: 1300, y: FLOOR - 62 };
        if (st.t > 6) held.push('fire');
        if (st.t > 66) go('run');
        break;
      case 'leap': // run off the platform and dash over the crate pile
        held.push('right');
        aim = { x: d.x + 400, y: d.y - 30 };
        if (d.x > 1290 && d.grounded) st.hold = 26;
        if (st.hold > 0) { st.hold--; held.push('jump'); }
        if (!d.grounded && d.x > 1340 && st.dashed !== true) { held.push('dash'); st.dashed = true; }
        if (d.x > 1690 && d.grounded) go('grab0');
        if (st.t > 200) go('grab0');
        break;
      case 'grab0': { // grab logic block 0, then throw it into the pile at full charge
        const p = logic(sim, 0);
        if (!p) { go('grab1'); break; }
        const pos = p.body.position;
        if (!(sim.field.on && sim.field.held)) {
          if (Math.abs(pos.x - d.x) > 60) held.push(pos.x > d.x ? 'right' : 'left');
          aim = { x: pos.x, y: pos.y };
          if (Math.abs(pos.x - d.x) < 110) held.push('field');
          if (st.t > 240) go('grab1');
        } else {
          held.push('field');
          aim = { x: d.x - 400, y: d.y - 150 };
          st.charge = (st.charge ?? 0) + 1;
          if (st.charge > 20 && st.charge < 72) held.push('fire');
          if (st.charge > 74) go('grab1');
        }
        break;
      }
      case 'grab1': { // carry logic block 1 to the plate and set it down
        const p = logic(sim, 1);
        if (!p) { go('arena'); break; }
        const pos = p.body.position;
        if (!(sim.field.on && sim.field.held)) {
          if (Math.abs(pos.x - d.x) > 60) held.push(pos.x > d.x ? 'right' : 'left');
          aim = { x: pos.x, y: pos.y };
          if (Math.abs(pos.x - d.x) < 110 && st.t > 20) held.push('field');
          if (st.t > 400) go('arena');
        } else {
          held.push('field');
          aim = { x: d.x + 300, y: d.y + 140 };
          if (d.x < 2040) held.push('right');
          else if (st.t > 10) { aim = { x: 2120, y: FLOOR - 10 }; if (Math.hypot(pos.x - 2120, pos.y - (FLOOR - 30)) < 40) held.pop(); }
          if (st.t > 360) go('arena');
        }
        if (sim.doorOpen > 0) go('wait');
        break;
      }
      case 'wait':
        aim = { x: 2400, y: FLOOR - 60 };
        if (sim.doorOpen >= 1 && st.t > 30) go('arena');
        break;
      case 'arena': { // fight: pulse at Glitches and Sparks, the Charged Probe at Latches, dash out of trouble
        const e = nearest(sim, d);
        if (!e) { go('done'); break; }
        if (d.x < 2330 && !st.inArena) {
          held.push('right');
          aim = { x: e.x, y: e.y - 20 };
          st.stuck = d.grounded && Math.abs(d.vx) < 0.5 ? (st.stuck ?? 0) + 1 : 0;
          if (st.stuck > 6) st.hold = 26; // something in the way: hop it
          if (st.hold > 0) { st.hold--; held.push('jump'); }
          if (d.x > 2300) st.inArena = true;
          break;
        }
        const dist = Math.hypot(e.x - d.x, e.y - d.y);
        aim = { x: e.x, y: e.y - 4 };
        st.stuck = d.grounded && Math.abs(d.vx) < 0.5 && held.length ? (st.stuck ?? 0) + 1 : 0;
        const want = e.kind === 'latch' ? 'charged' : 'pulse';
        if (sim.weapon !== want && st.t - (st.swapAt ?? -99) > 20) { held.push('weapon'); st.swapAt = st.t; }
        if (dist > 300) held.push(e.x > d.x ? 'right' : 'left');
        else if (dist < 160 && e.kind === 'latch') held.push(e.x > d.x ? 'left' : 'right');
        if (dist < 600) {
          if (sim.weapon === 'charged') { if (sim.charge < 1 || st.t % 50 < 48) held.push('fire'); }
          else held.push('fire');
        }
        if (dist < 90 && sim.vitals.energy > 20 && st.t - (st.dashAt ?? -99) > 70) { held.push('dash'); aim = { x: d.x - (e.x - d.x) * 4, y: d.y - 40 }; st.dashAt = st.t; }
        if (d.grounded && e.kind === 'spark' && dist < 300 && st.t % 90 === 0) st.hold = 20;
        if (st.hold > 0) { st.hold--; held.push('jump'); }
        break;
      }
      case 'done':
        aim = { x: d.x + 300, y: d.y - 60 };
        break;
    }
    return { held, aim };
  };
});

const shots = [[4500, '2-dummy.png'], [9500, '3-throw.png'], [16500, '4-fight.png']];
const t0 = Date.now();
for (const [at, name] of shots) {
  await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
  await page.screenshot({ path: join(out, name) });
}
await page.waitForTimeout(Math.max(0, 24000 - (Date.now() - t0)));
const bot = await page.evaluate(() => ({ log: window.__bot.log, phase: window.__bot.phase, alive: window.__tapeoutGame.sim.enemies.filter((e) => e.alive).length, stats: window.__tapeoutGame.frameStats() }));
console.log(JSON.stringify(bot, null, 1));
await page.screenshot({ path: join(out, '5-end.png') });
const video = page.video();
await ctx.close();
await browser.close();
const vp = await video.path();
// cut the desktop's own boot from the start: the clip opens on the click into the story game
const raw = join(out, 'raw.webm');
renameSync(vp, raw);
const cut = Math.max(0, (tClick - tPage) / 1000 - 0.3).toFixed(2);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', cut, '-i', raw, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', join(out, 'feel-pass.mp4')]);
unlinkSync(raw);
for (const f of readdirSync(out)) if (f.endsWith('.webm')) console.log('extra video', f);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors or warnings');

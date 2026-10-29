// The performance pass (Phase 10 Spec, section 4): every room of every place, at 1366 x 768 with the CPU throttled 4x
// through CDP (a stand-in for the design doc's 2018 laptop with Intel UHD 620 graphics). Run `npm run build` first.
//   node scripts/perf.mjs [places.json] [place ...]
// places.json lists the places in play order ({ id, modules }[]; dump it from PLACES and chapterOf). Rooms come from the
// director, so Bit Zero gets its hand-built eleven.
// Every module is signed off first through the `?record` hook, so the drone carries every upgrade and each room draws
// its heaviest effects. In each room the drone holds fire toward the nearest enemy: 10 s in fight, arena and boss rooms,
// 3 s elsewhere. Writes test-results/perf.md: update and render ms (average and p95), peak bodies, shots and particles,
// and the JS heap. Also measures start: navigation to the name field showing, ready for input.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUDGET = { update: 4, render: 6, bodies: 200, shots: 150, particles: 300, heapMb: 300, startMs: 3000 };
const LONG = new Set(['fight', 'arena', 'xarena', 'bossdoor']);
const places = JSON.parse(readFileSync(resolve(process.argv[2] ?? 'test-results/places.json'), 'utf8'));
const only = process.argv.slice(3);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const t0 = Date.now();
await page.goto(`${pathToFileURL(resolve('dist/index.html')).href}?record`);
await page.locator('.st-input').waitFor({ state: 'visible' });
const startMs = Date.now() - t0;
await page.locator('.st-input').fill('P');
await page.getByRole('button', { name: 'I am new to this' }).click();
await page.waitForFunction(() => window.__tapeoutGame?.ready, null, { timeout: 60000 });
await page.evaluate((ids) => {
  for (const id of ids) window.__tapeoutAward(id);
  const w = window.__tapeoutGame.story.world;
  if (!w.cutscenes.includes('ending')) w.cutscenes.push('ending');
  const g = window.__tapeoutGame;
  // hold fire at the nearest live enemy, or straight ahead
  g.drive = (sim) => {
    const d = sim.drone, e = sim.enemies.filter((x) => x.alive).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    return { held: ['fire'], aim: e ? { x: e.x, y: e.y } : { x: d.x + 400 * d.facing, y: d.y } };
  };
}, places.flatMap((p) => p.modules));

const rows = [];
const fmt = (n) => n.toFixed(2);
for (const p of places) {
  if (only.length && !only.includes(p.id)) continue;
  const roles = await page.evaluate((id) => window.__tapeoutGame.story.roomsFor(id).map((r) => r.role ?? r.id), p.id);
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    await page.evaluate(([id, k]) => { document.querySelectorAll('.gm-screen [role="dialog"]').forEach((d) => d.remove()); window.__tapeoutGame.story.warp(id, k); }, [p.id, i]);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__tapeoutGame.resetStats());
    const peak = { bodies: 0, shots: 0, particles: 0 };
    const until = Date.now() + (LONG.has(role) ? 10000 : 3000);
    while (Date.now() < until) {
      const s = await page.evaluate(() => window.__tapeoutGame.frameStats());
      peak.bodies = Math.max(peak.bodies, s.bodies);
      peak.shots = Math.max(peak.shots, s.shots);
      peak.particles = Math.max(peak.particles, s.particles);
      await page.waitForTimeout(250);
    }
    const s = await page.evaluate(() => ({ ...window.__tapeoutGame.frameStats(), heap: performance.memory?.usedJSHeapSize ?? 0, waiting: !!window.__tapeoutGame.story.waiting, room: window.__tapeoutGame.story.room.id }));
    const heapMb = s.heap / 2 ** 20;
    const over = [s.stepAvg > BUDGET.update && 'update', s.renderAvg > BUDGET.render && 'render', peak.bodies > BUDGET.bodies && 'bodies',
      peak.shots > BUDGET.shots && 'shots', peak.particles > BUDGET.particles && 'particles', heapMb > BUDGET.heapMb && 'heap'].filter(Boolean);
    rows.push({ place: p.id, i, role, room: s.room, ...s, peak, heapMb, over, waiting: s.waiting });
    console.log(`${p.id.padEnd(22)} ${String(i).padStart(2)} ${role.padEnd(9)} fps ${s.fps.toFixed(0).padStart(3)} upd ${fmt(s.stepAvg)}/${fmt(s.stepP95)} rnd ${fmt(s.renderAvg)}/${fmt(s.renderP95)} b${peak.bodies} s${peak.shots} p${peak.particles} ${heapMb.toFixed(0)}MB ${over.join(',')}${s.waiting ? ' (card up)' : ''}`);
  }
}
await browser.close();

mkdirSync('test-results', { recursive: true });
const worst = [...rows].sort((a, b) => (b.stepAvg + b.renderAvg) - (a.stepAvg + a.renderAvg));
const line = (r) => `| ${r.place} | ${r.i} | ${r.role} | ${r.fps.toFixed(0)} | ${fmt(r.stepAvg)} | ${fmt(r.stepP95)} | ${fmt(r.renderAvg)} | ${fmt(r.renderP95)} | ${r.peak.bodies} | ${r.peak.shots} | ${r.peak.particles} | ${r.heapMb.toFixed(0)} | ${r.over.join(', ') || 'ok'} |`;
const head = '| Place | Room | Role | fps | Update avg | Update p95 | Render avg | Render p95 | Bodies | Shots | Particles | Heap MB | Budget |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
writeFileSync('test-results/perf.md', [
  '# Performance pass', '',
  `Chromium at 1366 x 768, CPU throttled 4x. Start (navigation to the name field showing): ${startMs} ms (budget ${BUDGET.startMs}).`,
  `Rooms measured: ${rows.length}. Over budget: ${rows.filter((r) => r.over.length).length}. Console errors: ${errors.length}.`, '',
  '## Ten heaviest rooms', '', head, ...worst.slice(0, 10).map(line), '',
  '## Every room', '', head, ...rows.map(line), '',
  ...(errors.length ? ['## Errors', '', ...errors.map((e) => `- ${e.split('\n')[0]}`)] : []),
].join('\n'));
console.log(`start ${startMs} ms; ${rows.filter((r) => r.over.length).length} of ${rows.length} rooms over budget; errors ${errors.length}`);

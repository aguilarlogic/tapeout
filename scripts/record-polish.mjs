// Records Phase 10's video (Phase 10 Spec, section 9): the Accessibility panel driven by keys, text at 150% with
// TAPEOUT's bubbles and the boss bar, captions on as the boss changes phase, the Okabe-Ito palette in a fight, the
// Learning route opening a lesson, Skip this room, and the perf table. Run `npm run build` and scripts/perf.mjs first.
//   node scripts/record-polish.mjs <out-dir> [perf.md]
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/phase-10');
const perf = resolve(process.argv[3] ?? 'test-results/perf.md');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const errors = [];
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${s}`);
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const story = (fn, arg) => page.evaluate(fn, arg);
const PAUSED = '[role="dialog"][aria-label="Paused"]';
/** Presses Tab until the focused element's text starts with `label`, then Enter. */
async function tabTo(label) {
  for (let i = 0; i < 20; i++) {
    const text = await page.evaluate(() => (document.activeElement?.textContent ?? '').trim());
    if (text.startsWith(label)) { await wait(250); await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
    await wait(260);
  }
  throw new Error(`no focus stop "${label}"`);
}

await page.goto(`${pathToFileURL(resolve('dist/index.html')).href}?record`);
await page.getByTestId('story-profile').waitFor();
await wait(700);
await page.locator('.st-input').pressSequentially('Sam', { delay: 110 });
await wait(300);
await page.getByRole('button', { name: 'I am new to this' }).click();
await page.waitForFunction(() => window.__tapeoutGame?.ready, null, { timeout: 20000 });
await wait(2500);

// 1. the Accessibility panel, by keys alone: text 150%, Okabe-Ito colours, captions on
log('accessibility panel');
await page.keyboard.press('Escape');
await page.locator(PAUSED).waitFor();
await wait(600);
await tabTo('Accessibility');
await wait(700);
await page.keyboard.press('Tab'); // Text size
await wait(400);
await page.keyboard.press('ArrowDown'); await wait(500);
await page.keyboard.press('ArrowDown'); await wait(700);
await page.keyboard.press('Tab'); // Colours
await wait(400);
await page.keyboard.press('ArrowDown'); await wait(800);
await page.keyboard.press('Tab'); await wait(400); // Hold actions
await page.keyboard.press('Tab'); await wait(400); // Captions
await page.keyboard.press('Enter'); await wait(1200);
await page.keyboard.press('Escape');
await wait(600);

// 2. text at 150%: TAPEOUT's bubbles in the first room
log('bubbles at 150%');
await story(() => { const s = window.__tapeoutGame.story; s.say('Text is bigger now. Every line I say grows with it.', 'Signs on the walls stay as they are. They are part of the room.'); });
await wait(6500);

// 3. captions and the boss bar: the Dark Demo Board's pager, then the boss changes phase
log('boss phase with captions');
await story(() => { const s = window.__tapeoutGame.story; s.warp('bit-zero', s.roomsFor('bit-zero').findIndex((r) => r.id === 'arena')); });
await wait(1500);
await story(() => { const g = window.__tapeoutGame; g.drive = (sim) => ({ held: sim.drone.x < 700 ? ['right'] : [], aim: { x: sim.drone.x + 300, y: sim.drone.y } }); });
const card = page.getByTestId('story-card');
await card.waitFor({ timeout: 20000 }).catch(() => log('no pager card'));
await wait(2500);
if (await card.isVisible()) await card.getByRole('button').last().click();
await story(() => { window.__tapeoutGame.drive = null; });
await wait(5000);

// 4. the Okabe-Ito palette in a fight: hold fire at the nearest enemy
log('fight in Okabe-Ito');
await story(() => {
  const g = window.__tapeoutGame, s = g.story;
  s.warp('lamp-board', s.roomsFor('lamp-board').findIndex((r) => r.role === 'fight'));
  g.drive = (sim) => {
    const d = sim.drone, e = sim.enemies.filter((x) => x.alive).sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
    return { held: e ? ['fire', ...(Math.abs(e.x - d.x) > 360 ? [e.x > d.x ? 'right' : 'left'] : [])] : [], aim: e ? { x: e.x, y: e.y } : { x: d.x + 300, y: d.y } };
  };
});
await wait(9000);
await story(() => { window.__tapeoutGame.drive = null; });

// 5. the Learning route from the Loft's Chip Map, opening a lesson and coming back to the list
log('learning route');
await story(() => window.__tapeoutGame.story.warp('loft', 0));
await wait(1500);
await story(() => { const s = window.__tapeoutGame.story; s.useStation(s.room.stations.find((x) => x.kind === 'map')); });
const loft = page.getByTestId('story-loft');
await loft.waitFor();
await wait(1800);
await loft.getByRole('button', { name: 'Learning route' }).click();
const route = page.getByTestId('story-route');
await route.waitFor();
await wait(2200);
await route.locator('button.primary').first().click();
await wait(4500);
await page.keyboard.press('Escape');
await wait(2200);
await route.getByRole('button', { name: 'Back to the map' }).click().catch(() => {});
await wait(800);
await page.keyboard.press('Escape');
await wait(1000);

// 6. Skip this room: turn the assist on, then skip a traverse room from the pause menu
log('skip this room');
await story(() => { const s = window.__tapeoutGame.story; s.warp('lamp-board', s.roomsFor('lamp-board').findIndex((r) => r.role === 'traverse')); });
await wait(1500);
await page.keyboard.press('Escape');
await page.locator(PAUSED).waitFor();
await wait(500);
await page.locator(PAUSED).getByRole('button', { name: 'Difficulty and assists' }).click();
await wait(900);
await page.locator(PAUSED).getByRole('button', { name: /^Room skip/ }).click();
await wait(900);
await page.locator(PAUSED).getByRole('button', { name: 'Back' }).click();
await wait(900);
const before = await story(() => window.__tapeoutGame.story.room.id);
await page.locator(PAUSED).getByRole('button', { name: 'Skip this room' }).click();
await wait(2500);
log(`skipped ${before} -> ${await story(() => window.__tapeoutGame.story.room.id)}`);

// 7. the perf table
if (existsSync(perf)) {
  log('perf table');
  const md = readFileSync(perf, 'utf8').split('\n');
  const rows = md.slice(md.indexOf('## Ten heaviest rooms') + 2, md.indexOf('## Every room') - 1).filter((l) => l.startsWith('|'));
  const head = md.filter((l) => !l.startsWith('|') && l.trim() && !l.startsWith('#')).slice(0, 2);
  const cells = (l) => l.split('|').slice(1, -1).map((x) => x.trim());
  const html = `<body style="margin:0;background:#0B0A1A;color:#F4F3FF;font:15px ui-monospace,Menlo,monospace;padding:40px">
    <h2 style="color:#2EF2FF;letter-spacing:2px;margin:0 0 8px">PERFORMANCE PASS</h2>${head.map((h) => `<p style="color:#B8B5CC;margin:4px 0">${h}</p>`).join('')}
    <table style="border-collapse:collapse;margin-top:18px">${rows.filter((l) => !l.includes('---')).map((l, i) => `<tr>${cells(l).map((c) => `<${i ? 'td' : 'th'} style="padding:5px 10px;border-bottom:1px solid #2a2750;text-align:left;${i ? '' : 'color:#2EF2FF'}">${c}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></body>`;
  await page.setContent(html);
  await wait(7000);
}

await page.close();
await ctx.close();
await browser.close();
const vid = readdirSync(out).find((f) => f.endsWith('.webm'));
if (vid) renameSync(join(out, vid), join(out, 'phase-10-polish.webm'));
log(`errors: ${errors.length ? errors.join('\n') : 'none'}`);

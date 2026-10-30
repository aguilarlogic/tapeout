// Records the Dark Demo Board fix (Boss Fix Plan): the Boss Door, the whole boss fight played the way a careful beginner
// would (a reading that crosses nothing off, a shot into the shield, the guard, a wrong fix, the finish fight), the
// Workbench with its first card, and the exit lift home, as a 1280 x 720 video plus stills. Run `npm run build` first.
//   node scripts/record-boss.mjs <out-dir>
// Set CHROMIUM_PATH to use a specific Chromium. A scripted player drives the real game through GameScreen.drive.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/boss-fix');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const errors = [];
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${s}`);
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto(`${pathToFileURL(resolve('dist/index.html')).href}?record`);
await page.locator('#os').waitFor();
await page.waitForTimeout(800);
await page.getByTestId('game').waitFor();
await page.getByTestId('story-profile').waitFor();
await page.waitForTimeout(900);
await page.locator('.st-input').pressSequentially('Sam', { delay: 120 });
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'I am new to this' }).click();
await page.waitForFunction(() => window.__tapeoutGame?.ready, null, { timeout: 15000 });

// --- the scripted player: one command at a time, run by the game's drive hook each 60 Hz step ---
// INPUT=pad or INPUT=touch: the bot's actions go through a fake gamepad or fake fingers (Phase 9 Spec, section 9), so the
// run plays through the real pad or touch mapping, aim and aim assist; the bot never sets actions directly.
const INPUT = process.env.INPUT ?? 'keys';
await page.evaluate((INPUT) => {
  const g = window.__tapeoutGame;
  const B = { cmd: null };
  window.__bot = B;
  const near = (sim, d, r) => sim.enemies.filter((e) => e.alive && e.kind !== 'spike' && Math.hypot(e.x - d.x, e.y - d.y) < r).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
  const brain = (sim) => {
    const c = B.cmd, d = sim.drone;
    const held = [];
    let aim = { x: d.x + 400 * d.facing, y: d.y - 10 };
    if (!c || c.done) return { held, aim };
    // a command never carries over into the next room
    const room = g.story.room.id;
    if (c.room && c.room !== room) { c.done = true; return { held, aim }; }
    c.room = room;
    c.t = (c.t ?? 0) + 1;
    let busyAim = false;
    switch (c.type) {
      case 'walk': {
        if (g.story.waiting) { c.done = true; break; } // a card or overlay came up on the way
        const dx = c.x - d.x;
        if (Math.abs(dx) < (c.tol ?? 10)) { c.done = true; break; }
        held.push(dx > 0 ? 'right' : 'left');
        c.stuck = Math.abs(d.x - (c.lx ?? -1)) < 0.4 && d.grounded ? (c.stuck ?? 0) + 1 : 0;
        c.lx = d.x;
        // hop anything in the way, and every spike ahead
        const spike = sim.enemies.find((e) => e.kind === 'spike' && e.alive && Math.sign(e.x - d.x) === Math.sign(dx) && Math.abs(e.x - d.x) < 70);
        if ((c.stuck > 5 || spike) && d.grounded && !(c.hop > 0)) c.hop = 24;
        if (c.hop > 0) { c.hop--; held.push('jump'); }
        if (c.t > 1500) c.done = true;
        break;
      }
      case 'jumpTo': { // a jump toward x, holding the direction until above it
        const dx = c.x - d.x;
        if (c.t < 4) { /* settle */ } else if (c.t < 30) held.push('jump');
        if (Math.abs(dx) > 6 && c.t > 3) held.push(dx > 0 ? 'right' : 'left');
        if (c.t > 34 && d.grounded) c.done = true;
        if (c.t > 200) c.done = true;
        break;
      }
      case 'press': if (c.t > 2 && c.t < 6) held.push(c.a); if (c.t >= 8) c.done = true; break;
      case 'wait': if (c.until ? window.__botUntil(c.until) : c.t >= c.n) c.done = true; break;
      case 'fireAt': aim = c.p; busyAim = true; if (c.t > 4) held.push('fire'); if (c.t >= c.n) c.done = true; break;
      case 'grab': { // field on, aimed at the crate, until it is held
        const p = sim.world.props[c.i];
        aim = { x: p.body.position.x, y: p.body.position.y };
        busyAim = true;
        held.push('field');
        if (Math.abs(p.body.position.x - d.x) > 70) held.push(p.body.position.x > d.x ? 'right' : 'left');
        if (sim.field.held === p && c.t > 20) c.done = true;
        if (c.t > 400) c.done = true;
        break;
      }
      case 'carry': { // holding it, walk until the crate is over x, then let go
        busyAim = true;
        aim = { x: d.x + 300 * Math.sign(c.x - d.x || 1), y: d.y + 40 };
        const held0 = sim.field.held;
        const dx = c.x - (held0 ? held0.body.position.x : d.x);
        if (Math.abs(dx) > 8 && !c.arrived) { held.push('field', dx > 0 ? 'right' : 'left'); break; }
        c.arrived = true;
        if (c.t2 === undefined) c.t2 = 0;
        c.t2++;
        if (c.t2 < 10) held.push('field');
        if (c.t2 > 40) c.done = true;
        break;
      }
      case 'fight': { // clear every Glitch: close in, shoot, hop now and then
        const foes = sim.enemies.filter((e) => e.alive && e.kind === 'glitch');
        if (!foes.length || c.t > 3600) { c.done = true; break; }
        const f = foes.sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
        aim = { x: f.x, y: f.y };
        busyAim = true;
        if (Math.abs(f.x - d.x) > 260) held.push(f.x > d.x ? 'right' : 'left');
        if (Math.abs(f.x - d.x) < 120) held.push(f.x > d.x ? 'left' : 'right');
        held.push('fire');
        c.stuck = Math.abs(d.x - (c.lx ?? -1)) < 0.4 && d.grounded ? (c.stuck ?? 0) + 1 : 0;
        c.lx = d.x;
        if (c.stuck > 20 && d.grounded) { c.hop = 22; c.stuck = 0; }
        if (c.hop > 0) { c.hop--; held.push('jump'); }
        break;
      }
    }
    // shoot anything that comes close, unless the command needs the aim
    const foe = sim.kit.gun && !busyAim && !held.includes('field') ? near(sim, d, 380) : null;
    if (foe) { aim = { x: foe.x, y: foe.y }; held.push('fire'); }
    return { held, aim };
  };
  if (INPUT === 'keys') { g.drive = brain; return; }
  // the standard pad layout (src/game/input/padmap.ts): the button each action is on
  const PAD = { jump: 0, rewind: 1, interact: 2, weapon: 3, weaponPrev: 4, dash: 5, field: 6, fire: 7, map: 8, pause: 9, beam: 10, scan: 11, gadget: 12, gadgetNext: 14, pocket: 15 };
  const STICK = { x: 200, y: 560 };
  g.drive = (sim) => {
    const r = brain(sim), held = new Set(r.held), pv = sim.pivot();
    if (INPUT === 'pad') {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      for (const [a, i] of Object.entries(PAD)) if (held.has(a)) buttons[i] = { pressed: true, value: 1 };
      if (held.has('down')) buttons[13] = { pressed: true, value: 1 };
      const dx = r.aim.x - pv.x, dy = r.aim.y - pv.y, l = Math.hypot(dx, dy) || 1;
      const lx = held.has('left') ? -1 : held.has('right') ? 1 : 0;
      window.__tapeoutPad = { connected: true, mapping: 'standard', axes: [lx, 0, dx / l, dy / l], buttons };
      return null;
    }
    // touch: a resting thumb on the stick, a right-hand aim finger that lands on the right half then slides to the aim,
    // a second right finger for the field, and a finger on each button the bot holds
    const cam = g.cam, pts = [];
    const sx = held.has('left') ? -50 : held.has('right') ? 50 : 0, sy = held.has('jump') ? -60 : held.has('down') ? 60 : 0;
    pts.push({ id: 1, x: STICK.x + sx, y: STICK.y + sy });
    const prev = window.__tapeoutTouch ?? [];
    if (held.has('fire') || held.has('field')) {
      const down = prev.some((p) => p.id === 2);
      pts.push(down ? { id: 2, x: r.aim.x - cam.x, y: r.aim.y - cam.y } : { id: 2, x: 960, y: 360 });
      if (held.has('field') && down) pts.push({ id: 3, x: 1000, y: 240 });
    }
    const buttons = g.touchButtons();
    for (const [i, b] of buttons.entries()) if (held.has(b.action) && b.action !== 'pause') pts.push({ id: 10 + i, x: b.x, y: b.y });
    window.__tapeoutTouch = pts;
    return null;
  };
}, INPUT);
if (INPUT === 'touch') {
  // the first touch play offers game speed 75%: keep 100% so the run matches the others
  await page.waitForTimeout(800);
  if (await page.getByTestId('story-choice').count()) await page.getByTestId('story-choice').getByRole('button', { name: 'Keep 100%' }).click();
}

const run = async (cmd, timeout = 60000) => {
  await page.evaluate((c) => { window.__bot.cmd = c; }, cmd);
  await page.waitForFunction(() => window.__bot.cmd.done, null, { timeout });
};
const walk = (x, o = {}) => run({ type: 'walk', x, ...o });
const press = (a = 'interact') => run({ type: 'press', a });
const wait = (n) => run({ type: 'wait', n });
const fireAt = (p, n) => run({ type: 'fireAt', p, n });
const story = (f, a) => page.evaluate(f, a);
const roomId = () => story(() => window.__tapeoutGame.story.room.id);
const drone = () => story(() => ({ x: window.__tapeoutGame.sim.drone.x, y: window.__tapeoutGame.sim.drone.y, grounded: window.__tapeoutGame.sim.drone.grounded }));
const still = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); };
/** Click through a card when one is up (upgrade, pager, debrief), after giving it time on screen. */
const card = async (hold = 2200) => {
  const c = page.getByTestId('story-card');
  await c.waitFor({ timeout: 15000 });
  await page.waitForTimeout(hold);
  await c.getByRole('button').last().click();
  await page.waitForTimeout(400);
};
const nextRoom = async (id) => { await page.waitForFunction((id) => window.__tapeoutGame.story.room.id === id && !window.__tapeoutGame.story.fade, id, { timeout: 20000 }); await page.waitForTimeout(600); log(`room ${id}`); };
const wire = async (a, b) => {
  const xs = await story(() => Object.fromEntries(window.__tapeoutGame.story.room.wire.terminals.map((t) => [t.pin, t.x])));
  await walk(xs[a]); await press(); await walk(xs[b]); await press();
};
/** Show a station overlay for a while, sign it off, and close it the way a player would. */
const station = async (testid, id, show) => {
  await press();
  await page.getByTestId(testid).waitFor();
  await page.waitForTimeout(show);
  await story((id) => window.__tapeoutAward(id), id);
  await page.locator('.st-unplug').waitFor();
  await page.waitForTimeout(900);
  await page.locator('.st-unplug').click();
  await page.waitForTimeout(500);
};

// start at the Boss Door with Level 1's rooms before it signed off, so the kit matches a real run
await story(() => { for (const id of ['first-wire', 'bits', 'bool', 'first-not', 'first-and', 'logic-half']) window.__tapeoutAward(id); });
await story(() => window.__tapeoutGame.story.warp('bit-zero', 8));
const choose = async (name, hold = 1800) => {
  const c = page.getByTestId('story-choice');
  await c.waitFor();
  await page.waitForTimeout(hold);
  await c.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(300);
};
const nodeX = (arg) => story((a) => window.__tapeoutGame.story.room.stations.find((s) => s.arg === a).x, arg);
const read = async (arg, hold = 150) => { await walk(await nodeX(arg), { tol: 12 }); await press(); log(`read ${arg}`); await wait(hold); };
const boss = () => story(() => { const b = window.__tapeoutGame.story.boss; return { phase: b.phase, fits: b.fits(), left: b.inv.left, log: b.log.map((r) => r.key), next: (() => { const n = b.inv.bestNext(); return n ? `${n.ins.cmd}${n.arg ? ` ${n.arg}` : ''}` : null; })() }; });

try {
  await wait(60);
  await walk(1270);
  await nextRoom('arena');
  await page.waitForTimeout(800);
  await still('01-pager');
  await card(2600);
  await wait(120);
  await still('02-investigate');
  // a beginner's first reading: both switches off, which crosses nothing off
  await read('flip 00', 200);
  await still('03-first-reading');
  // a shot at the board while it is shielded
  await walk(820);
  await fireAt({ x: 960, y: 380 }, 40);
  await wait(10);
  await still('04-shielded');
  // then readings that count, until two suspects are left
  for (let g = 0; g < 8; g++) {
    const b = await boss();
    if (b.fits.length <= 2 || !b.next) break;
    await read(b.next, 170);
    if (g === 0) await still('05-crossed-off');
  }
  // the debug port with two left: the guard names them and the reading that tells them apart
  let b = await boss();
  if (b.fits.length === 2) {
    await walk(960);
    await press();
    const name = await story((id) => window.__tapeoutGame.story.boss.causes().find((c) => c.id === id).name, b.fits[0]);
    await choose(name, 1600);
    await page.getByTestId('story-choice').waitFor();
    await page.waitForTimeout(400);
    await still('06-guard');
    await page.waitForTimeout(2600);
    await page.getByTestId('story-choice').getByRole('button').first().click();
    await page.waitForTimeout(300);
    b = await boss();
    if (b.next) await read(b.next, 200);
  }
  await still('07-one-left');
  await walk(960);
  await press();
  const cause = await story(() => { const b = window.__tapeoutGame.story.boss; return b.causes().find((c) => c.id === b.fits()[0]).name; });
  await choose(cause, 2200);
  // a wrong fix first: the card says why it would not hold
  const wrongFix = await story(() => window.__tapeoutGame.story.boss.fixes().find((o) => !o.right && /board|Swap/.test(o.text))?.text ?? window.__tapeoutGame.story.boss.fixes().find((o) => !o.right).text);
  await choose(wrongFix, 2200);
  await page.getByTestId('story-choice').waitFor();
  await page.waitForTimeout(500);
  await still('08-wrong-fix');
  const fix = await story(() => window.__tapeoutGame.story.boss.fixes().find((o) => o.right).text);
  await choose(fix, 3200);
  await wait(40);
  await still('09-finish');
  // the finish: the board sparks at the drone and two Glitches come in; shoot the board, dodge, clear them
  for (let k = 0; k < 80; k++) {
    if (await story(() => window.__tapeoutGame.story.boss.phase === 'done')) break;
    const foe = await story(() => window.__tapeoutGame.sim.enemies.some((e) => e.alive && e.kind === 'glitch'));
    if (foe && k % 3 === 0) await run({ type: 'fight' }, 8000);
    await walk(k % 2 ? 760 : 1160);
    await fireAt({ x: 960, y: 380 }, 40);
    if (k === 2) await still('10-fight');
  }
  await card(6000);
  await still('11-board-lit');
  await walk(1910);
  await nextRoom('workbench');
  // the Workbench: its first card, then the two Verilog benches
  await walk(480);
  await press();
  await card(5000);
  await page.getByTestId('bench').waitFor();
  await page.waitForTimeout(3500);
  await still('12-bench');
  await story(() => window.__tapeoutAward('gates'));
  await page.locator('.st-unplug').waitFor();
  await page.waitForTimeout(900);
  await page.locator('.st-unplug').click();
  await page.waitForTimeout(500);
  await walk(760);
  await station('bench', 'half-adder-v', 2500);
  await card(2400);
  await walk(1140);
  await press();
  await wait(200);
  await page.waitForFunction(() => window.__tapeoutGame.story.place === 'loft' && !window.__tapeoutGame.story.fade, null, { timeout: 30000 });
  await wait(120);
  log('loft');
} catch (e) {
  log(`FAILED: ${e.message.split('\n')[0]}`);
  await still('zz-failed');
  console.log(await story(() => ({ room: window.__tapeoutGame.story.room.id, cmd: window.__bot.cmd, x: window.__tapeoutGame.sim.drone.x, y: window.__tapeoutGame.sim.drone.y, waiting: window.__tapeoutGame.story.waiting })));
  process.exitCode = 1;
}

const video = page.video();
await ctx.close();
await browser.close();
const raw = await video.path();
const target = join(out, 'boss-fix.webm');
renameSync(raw, target);
for (const f of readdirSync(out)) if (f.endsWith('.webm') && f !== 'boss-fix.webm') unlinkSync(join(out, f));
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', target, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', join(out, 'boss-fix.mp4')]);
  log('wrote boss-fix.mp4');
} catch { log('no ffmpeg: kept the webm only'); }
log(`errors: ${errors.length ? errors.join('\n') : 'none'}`);

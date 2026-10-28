// Records act 1's composed places (Phase 3): from the Loft's lift through a whole place, room by room, to its exit lift
// and home, as a 1280 x 720 video plus a still per room. Run `npm run build` first.
//   node scripts/record-act1.mjs <out-dir> [place ...]   (default: lamp-board)
// Set CHROMIUM_PATH to use a specific Chromium. A scripted player drives the real game through GameScreen.drive; the
// recorder clicks cards and overlays like a player. Lessons at wall ports and the labs are shown, then signed off
// through the `?record` hook (the recorder cannot answer them); every wire run, plate, lift, bridge, fight and the
// boss is played for real.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/act-1');
const places = process.argv.slice(3).length ? process.argv.slice(3) : ['lamp-board'];
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
await page.getByTestId('story-preview').click();
await page.getByTestId('story-profile').waitFor();
await page.waitForTimeout(900);
await page.locator('.st-input').pressSequentially('Sam', { delay: 120 });
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'I am new to this' }).click();
await page.waitForFunction(() => window.__tapeoutGame?.ready, null, { timeout: 15000 });

// --- the scripted player: one command at a time, run by the game's drive hook each 60 Hz step ---
await page.evaluate(() => {
  const g = window.__tapeoutGame;
  const B = { cmd: null };
  window.__bot = B;
  const near = (sim, d, r) => sim.enemies.filter((e) => e.alive && e.kind !== 'spike' && Math.hypot(e.x - d.x, e.y - d.y) < r).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
  g.drive = (sim) => {
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
      case 'fight': { // clear every bug: close in, shoot, hop now and then
        const foes = sim.enemies.filter((e) => e.alive && e.kind !== 'spike' && (!e.seen || e.seen > 0.5));
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
});

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
const roomNow = () => story(() => { const s = window.__tapeoutGame.story; return { id: s.room.id, role: s.room.role, index: s.index, place: s.place, exit: s.room.exit.x, stations: s.room.stations.map((x) => ({ kind: x.kind, x: x.x, y: x.y, module: x.module, arg: x.arg })) }; });
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


/** Open a composed station's module, show it, sign it off, and close it the way a player would. */
const moduleAt = async (st, show) => {
  await walk(st.x, { tol: 14 });
  await press();
  const win = page.locator('[data-testid=port],[data-testid=panel],[data-testid=bench]');
  await win.first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(show);
  await story((id) => window.__tapeoutAward(id), st.module);
  await page.waitForTimeout(900);
  if (await page.locator('.st-unplug').count()) await page.locator('.st-unplug').click();
  else if (await win.count()) await page.getByTestId('overlay-close').click();
  await page.waitForTimeout(500);
  if (await page.getByTestId('story-card').count()) await card(3200);
};
const leave = async (exit) => {
  const before = await story(() => window.__tapeoutGame.story.index);
  await walk(exit + 30);
  await page.waitForFunction((i) => window.__tapeoutGame.story.index !== i && !window.__tapeoutGame.story.fade, before, { timeout: 20000 });
  await page.waitForTimeout(500);
};

/** The arena: readings at the nodes until one cause fits, the debug port, the fix, then the finish. */
const arena = async (place) => {
  await card(3000);
  for (let g = 0; g < 14; g++) {
    const nx = await story(() => {
      const s = window.__tapeoutGame.story, b = s.boss;
      if (b.fits().length <= 1) return null;
      const n = b.inv.bestNext();
      const st = s.room.stations.find((x) => x.arg === n.ins.cmd);
      return { cmd: n.ins.cmd, arg: n.arg, x: st.x, y: st.y - 40 };
    });
    if (!nx) break;
    const before = await story(() => window.__tapeoutGame.story.boss.log.length);
    await walk(nx.x, { tol: 14 });
    await press();
    if (await page.getByTestId('story-choice').count()) {
      await page.waitForTimeout(900);
      await page.getByTestId('story-choice').getByRole('button', { name: nx.arg, exact: true }).click();
    }
    for (let k = 0; k < 4 && (await story(() => window.__tapeoutGame.story.boss.log.length)) <= before; k++) await fireAt({ x: nx.x, y: nx.y }, 20);
    log(`node ${nx.cmd} ${nx.arg ?? ''}: readings ${await story(() => window.__tapeoutGame.story.boss.log.length)}`);
    await wait(120);
    if (g === 1) await still(`${place}-arena-readings`);
  }
  const dbg = (await roomNow()).stations.find((x) => x.kind === 'debug');
  await walk(dbg.x, { tol: 14 });
  await press();
  const cause = await story(() => { const b = window.__tapeoutGame.story.boss; return b.causes().find((c) => c.id === b.fits()[0]).name; });
  await page.getByTestId('story-choice').waitFor();
  await page.waitForTimeout(1500);
  await page.getByTestId('story-choice').getByRole('button', { name: cause, exact: true }).click();
  const fix = await story(() => window.__tapeoutGame.story.boss.fixes().find((o) => o.right).text);
  await page.getByTestId('story-choice').getByRole('button', { name: fix }).waitFor();
  await page.waitForTimeout(1500);
  await page.getByTestId('story-choice').getByRole('button', { name: fix }).click();
  await wait(30);
  const rect = await story(() => window.__tapeoutGame.story.room.boss.rect);
  for (let k = 0; k < 80; k++) {
    if (await story(() => window.__tapeoutGame.story.boss.phase === 'done')) break;
    await fireAt({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, 30);
    if (k === 3) await still(`${place}-arena-finish`);
  }
  await card(5000);
};

try {
  // the run so far: Level 1 and the electricity primer are done, so the lift offers the next places
  await story(() => {
    for (const id of ['first-wire', 'bits', 'bool', 'first-not', 'first-and', 'logic-half', 'inc-demo-board', 'gates', 'half-adder-v']) window.__tapeoutAward(id);
  });
  await story(() => { const s = window.__tapeoutGame.story; for (const r of s.roomsFor('volts-and-amps')) void r; });
  await story(() => window.__tapeoutGame.story.warp('loft', 0));
  await wait(90);
  for (const place of places) {
    // prerequisites: every earlier place's modules, signed off
    await story((p) => {
      const g = window.__tapeoutGame.story;
      window.__tapeoutPrereq?.(p);
      void g;
    }, place);
    const lift = (await roomNow()).stations.find((x) => x.kind === 'lift');
    await walk(lift.x, { tol: 14 });
    await still(`${place}-00-loft`);
    await press();
    await page.getByTestId('story-choice').waitFor();
    await page.waitForTimeout(1800);
    const name = await story((p) => window.__tapeoutPlaceName(p), place);
    await page.getByTestId('story-choice').getByRole('button', { name: new RegExp(`^(Continue: )?${name}$`) }).first().click();
    await page.waitForFunction((p) => window.__tapeoutGame.story.place === p && !window.__tapeoutGame.story.fade, place, { timeout: 20000 });
    for (let guard = 0; guard < 40; guard++) {
      const r = await roomNow();
      if (r.place !== place) break;
      log(`${place} room ${r.index} ${r.role}`);
      await wait(60);
      await still(`${place}-${String(r.index + 1).padStart(2, '0')}-${r.role}`);
      if (r.role === 'exit') {
        const l = r.stations.find((x) => x.kind === 'lift');
        await walk(l.x, { tol: 14 });
        await press();
        await wait(200);
        await page.waitForFunction(() => window.__tapeoutGame.story.place === 'loft' && !window.__tapeoutGame.story.fade, null, { timeout: 30000 });
        await wait(120);
        break;
      }
      if (r.role === 'discovery') {
        // the puzzle on screen for a while, then solved through the test hook (the bot cannot read a puzzle)
        await walk(r.exit / 2);
        await wait(240);
        await story(() => { const s = window.__tapeoutGame.story; s.discover(`${s.place}:${s.room.mechanic}`); s.rs.mech.solved = true; s.openGate('exit'); });
        await wait(60);
      }
      if (r.role === 'fight') await run({ type: 'fight' }, 90000);
      if (r.role === 'arena') await arena(place);
      if (['port', 'panel', 'bench', 'gate', 'bossdoor'].includes(r.role)) {
        for (const st of r.stations.filter((x) => x.module)) {
          if (await story((id) => !!window.__tapeoutDone(id), st.module)) continue;
          await moduleAt(st, r.role === 'bench' ? 4500 : 3500);
        }
      }
      if (r.role === 'bossdoor') await wait(90);
      await leave(r.exit);
    }
  }
  // the chip map, back home
  const map = (await roomNow()).stations.find((x) => x.kind === 'map');
  await walk(map.x, { tol: 14 });
  await press();
  await page.getByTestId('story-loft').waitFor();
  await page.waitForTimeout(3000);
  await still('zz-chip-map');
  await page.getByRole('button', { name: 'Back to the Loft' }).click();
  await wait(90);
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
const target = join(out, 'act-1.webm');
renameSync(raw, target);
for (const f of readdirSync(out)) if (f.endsWith('.webm') && f !== 'act-1.webm') unlinkSync(join(out, f));
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', target, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', join(out, 'act-1.mp4')]);
  log('wrote act-1.mp4');
} catch { log('no ffmpeg: kept the webm only'); }
log(`errors: ${errors.length ? errors.join('\n') : 'none'}`);

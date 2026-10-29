// Records a full Level 1 playthrough (Bit Zero, cold boot to the Loft) as a 1280 x 720 video, plus a still per room.
// Run `npm run build` first.
//   node scripts/record-level1.mjs <out-dir> [--from <room index>]
// Set CHROMIUM_PATH to use a specific Chromium. A scripted player drives the real game through GameScreen.drive; the
// recorder clicks cards and overlays like a player. Lessons at wall ports and the labs are shown, then signed off
// through the `?record` hook (the recorder cannot answer them); every wire run, plate, lift, bridge, fight and the
// boss is played for real.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/level-1');
const fromArg = process.argv.indexOf('--from');
const from = fromArg > 0 ? Number(process.argv[fromArg + 1]) : 0;
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

if (from > 0) {
  // starting part-way: sign off the rooms before it, so the kit matches a real run
  const ROOM_MODULES = [['first-wire'], ['bits'], ['bool'], ['first-not'], [], ['first-and'], ['logic-half'], [], [], ['inc-demo-board'], []];
  await story((ids) => { for (const id of ids) window.__tapeoutAward(id); }, ROOM_MODULES.slice(0, from).flat());
  await story((i) => window.__tapeoutGame.story.warp('bit-zero', i), from);
}

try {
  // 1. Dark Bay: the first wire lights the room and turns on the probe; the X crust breaks to probe fire
  if (from <= 0) {
    await wait(120);
    await still('01-dark-bay');
    await wire('in:in', 'out:out');
    await card(2600);
    await still('01b-dark-bay-lit');
    await walk(1700);
    await fireAt({ x: 1824, y: 565 }, 150);
    await walk(1990);
    await nextRoom('bit-wall');
  }
  // 2. Bit Wall: the Field Coil comes online at the coil gate; the port lesson lights the eight lamps
  if (from <= 1) {
    await walk(330);
    await card(2400);
    await run({ type: 'grab', i: 0 });
    await run({ type: 'carry', x: 420 });
    await walk(1150);
    await still('02-bit-wall');
    await station('port', 'bits', 6500);
    await wait(90);
    await walk(1790);
    await nextRoom('gate-hall');
  }
  // 3. Gate Hall: a crate on one plate, the drone on the other; then the Boolean lesson at the port
  if (from <= 2) {
    await walk(400);
    await run({ type: 'grab', i: 0 });
    await run({ type: 'carry', x: 1000 });
    await walk(700);
    await page.waitForFunction(() => window.__tapeoutGame.story.rs.latched, null, { timeout: 8000 });
    await still('03-gate-hall');
    await wait(60);
    await walk(1550);
    await station('port', 'bool', 5000);
    await wait(60);
    await walk(2190);
    await nextRoom('lift-shaft');
  }
  // 4. Lift Shaft: straight past the NOT first (it sparks), then through it; the lift rides up
  if (from <= 3) {
    await wait(100);
    await wire('in:a', 'out:y');
    await wait(150);
    await wire('in:a', 'g.a');
    await wire('g.y', 'out:y');
    await card(2400);
    await still('04-lift-shaft');
    await walk(640);
    await page.waitForFunction(() => window.__tapeoutGame.story.rs.lift >= 1, null, { timeout: 10000 });
    await walk(1270);
    await nextRoom('floater-shaft');
  }
  // 5. Floater Shaft: up the one-way steps past the floaters
  if (from <= 4) {
    // each ledge as [left, top, width]; walk to the take-off edge, stop, then a running jump to the next one's middle
    const ledges = [[180, 1000, 260], [460, 870, 260], [740, 740, 260], [460, 610, 260], [180, 480, 260], [460, 350, 260], [740, 220, 860]];
    let cur = [0, 1100, 1600];
    for (const [x0, top, w] of ledges) {
      const mid = x0 + w / 2;
      for (let tries = 0; tries < 4; tries++) {
        await walk(Math.min(Math.max(mid, cur[0] + 30), cur[0] + cur[2] - 30));
        await wait(12);
        await run({ type: 'jumpTo', x: mid });
        const d = await drone();
        log(`ledge ${x0},${top} try ${tries}: drone ${d.x.toFixed(0)},${d.y.toFixed(0)}`);
        if (d.y < top) break;
      }
      if (top === 870) await still('05-floater-shaft');
      cur = [x0, top, w];
    }
    await walk(1590);
    await nextRoom('twin-motors');
  }
  // 6. Twin Motors: both levers into the AND, the AND to the bridge; both levers on
  if (from <= 5) {
    await wait(60);
    await wire('in:a', 'g.a');
    await wire('in:b', 'g.b');
    await wire('g.y', 'out:y');
    await card(2400);
    await walk(260); await press();
    await walk(360); await press();
    await page.waitForFunction(() => window.__tapeoutGame.story.rs.bridge >= 1, null, { timeout: 8000 });
    await still('06-twin-motors');
    await walk(1990);
    await nextRoom('bit0-chamber');
  }
  // 7. Bit 0 Chamber: the half adder on the patch panel lights ALU bit 0
  if (from <= 6) {
    await walk(800);
    await station('panel', 'logic-half', 6000);
    await card(2400);
    await still('07-bit0-chamber');
    await walk(1590);
    await nextRoom('first-fight');
  }
  // 8. First Fight
  if (from <= 7) {
    await walk(300);
    await run({ type: 'fight' }, 90000);
    await still('08-first-fight');
    await walk(2390);
    await nextRoom('boss-door');
  }
  // 9. Boss Door
  if (from <= 8) {
    await walk(1270);
    await nextRoom('arena');
  }
  // 10. The Dark Demo Board: readings at the nodes, the cause, the fix, then the board
  // the arena's node platforms are solid: climb beside them, ledge by ledge, then E at the node
  const ARENA_LEDGES = {
    left: [[240, 680, 140], [90, 540, 140], [240, 400, 140]],
    right: [[1540, 680, 140], [1690, 540, 140], [1540, 400, 140]],
  };
  const climb = async (path, side) => {
    let cur = null;
    for (const [x0, top, w] of path) {
      const mid = x0 + w / 2;
      for (let tries = 0; tries < 4; tries++) {
        // from the floor, take off beside the platform (never under it); from a ledge, at its edge nearest the next
        const off = cur ? Math.min(Math.max(mid, cur[0] + 25), cur[0] + cur[2] - 25) : side === 'left' ? x0 + w + 45 : x0 - 45;
        await walk(off);
        await wait(10);
        await run({ type: 'jumpTo', x: mid });
        const d = await drone();
        if (d.y < top) break;
        if (cur && d.y > cur[1]) cur = null; // fell back to the floor
      }
      cur = [x0, top, w];
    }
  };
  const toNode = async (nx) => {
    await walk(960); // back down to the floor first
    const side = nx.x < 960 ? 'left' : 'right';
    const floor = 820, rise = floor - (nx.y + 50);
    if (nx.x === 640 || nx.x === 1280) await climb([nx.x < 960 ? [560, 680, 160] : [1200, 680, 160]], side);
    else if (rise > 0) await climb(ARENA_LEDGES[side].slice(0, rise / 140), side);
    await walk(nx.x, { tol: 14 });
  };
  if (from <= 9) {
    await card(3000);
    for (let g = 0; g < 12; g++) {
      const nx = await story(() => {
        const b = window.__tapeoutGame.story.boss;
        if (b.fits().length <= 1) return null;
        const n = b.inv.bestNext();
        const arg = `${n.ins.cmd}${n.arg ? ` ${n.arg}` : ''}`;
        const st = window.__tapeoutGame.story.room.stations.find((s) => s.arg === arg);
        return { arg, x: st.x, y: st.y - 50 };
      });
      if (!nx) break;
      const before = await story(() => window.__tapeoutGame.story.boss.log.length);
      await toNode(nx);
      await press();
      for (let k = 0; k < 4 && (await story(() => window.__tapeoutGame.story.boss.log.length)) <= before; k++) {
        await fireAt({ x: nx.x, y: nx.y }, 20);
      }
      const d = await drone();
      log(`node ${nx.arg}: drone ${d.x.toFixed(0)},${d.y.toFixed(0)} readings ${await story(() => window.__tapeoutGame.story.boss.log.length)}`);
      await wait(150);
      if (g === 1) await still('10-arena-readings');
    }
    await walk(960);
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
    for (let k = 0; k < 40; k++) {
      if (await story(() => window.__tapeoutGame.story.boss.phase === 'done')) break;
      await fireAt({ x: 960, y: 380 }, 30);
      if (k === 3) await still('10b-arena-finish');
    }
    await card(5000);
    await walk(1910);
    await nextRoom('workbench');
  }
  // 11. Workbench: the two Verilog benches power the exit lift
  if (from <= 10) {
    await walk(480);
    await station('bench', 'gates', 4500);
    await walk(760);
    await station('bench', 'half-adder-v', 4500);
    await card(2400);
    await still('11-workbench');
    await walk(1140);
    await press();
    await wait(200);
    await still('11b-exit-lift');
    await page.waitForFunction(() => window.__tapeoutGame.story.place === 'loft' && !window.__tapeoutGame.story.fade, null, { timeout: 30000 });
    log('loft');
  }
  // The Loft
  await wait(120);
  await walk(1200);
  await still('12-loft');
  await press();
  await page.getByTestId('story-loft').waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Back to the Loft' }).click();
  await wait(60);
  await walk(900);
  await wait(120);
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
const target = join(out, 'level-1.webm');
renameSync(raw, target);
for (const f of readdirSync(out)) if (f.endsWith('.webm') && f !== 'level-1.webm') unlinkSync(join(out, f));
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', target, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', join(out, 'level-1.mp4')]);
  log('wrote level-1.mp4');
} catch { log('no ffmpeg: kept the webm only'); }
log(`errors: ${errors.length ? errors.join('\n') : 'none'}`);

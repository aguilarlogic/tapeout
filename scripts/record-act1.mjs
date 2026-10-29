// Records act 1's composed places (Phase 3): from the Loft's lift through a whole place, room by room, to its exit lift
// and home, as a 1280 x 720 video plus a still per room. Run `npm run build` first.
//   node scripts/record-act1.mjs <out-dir> [place ...]   (default: lamp-board)
// Set CHROMIUM_PATH to use a specific Chromium. A scripted player drives the real game through GameScreen.drive; the
// recorder clicks cards and overlays like a player. Lessons at wall ports and the labs are shown, then signed off
// through the `?record` hook (the recorder cannot answer them); every wire run, plate, lift, bridge, fight and the
// boss is played for real.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'test-results/act-1');
const places = process.argv.slice(3).length ? process.argv.slice(3) : ['lamp-board'];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
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
        if (Math.abs(dx) > 6 && c.t > (c.late ?? 3)) held.push(dx > 0 ? 'right' : 'left');
        if (c.t > 34 && d.grounded) c.done = true;
        if (c.t > 200) c.done = true;
        break;
      }
      case 'leap': { // a running jump: run at the edge, jump at x0, steer to land, done once down again
        const dir = c.land > c.x0 ? 1 : -1;
        if (!c.up && (d.x - c.x0) * dir >= 0 && d.grounded) { c.up = 1; }
        if (c.up && c.up < 28) { held.push('jump'); c.up++; }
        if (!c.up || Math.abs(c.land - d.x) > 12) held.push(dir > 0 ? 'right' : 'left');
        if (c.up >= 28 && d.grounded) c.done = true;
        if (c.t > 300) c.done = true;
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
  // an arcade app a lesson launched can open over the card: close it first
  const closes = page.getByTestId('overlay-close');
  for (let i = 0; i < 3 && (await closes.count()); i++) { await closes.last().click(); await page.waitForTimeout(300); }
  await c.getByRole('button').last().click();
  await page.waitForTimeout(400);
};
const nextRoom = async (id) => { await page.waitForFunction((id) => window.__tapeoutGame.story.room.id === id && !window.__tapeoutGame.story.fade, id, { timeout: 20000 }); await page.waitForTimeout(600); log(`room ${id}`); };
const roomNow = () => story(() => { const s = window.__tapeoutGame.story; return { id: s.room.id, role: s.room.role, index: s.index, place: s.place, exit: s.room.exit.x, stations: s.room.stations.map((x) => ({ kind: x.kind, x: x.x, y: x.y, module: x.module, arg: x.arg })), enemies: s.room.enemies.length }; });
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


/** Each act 1 place's scored modules, in order (from world/places.ts), and the names the lift shows. */
const MODULES = {"bit-zero": ["first-wire", "bits", "bool", "first-not", "first-and", "logic-half", "inc-demo-board", "gates", "half-adder-v"], "volts-and-amps": ["electricity", "resistance"], "lamp-board": ["bitadd", "twos", "inc-lamp-board"], "inverted-hall": ["demorgan", "inc-logic"], "carry-chain": ["mux", "logic-enable", "logic-mux", "decoder", "logic-dec", "adder", "logic-full", "compare", "logic-cmp", "inc-adder"], "clockwork": ["seq", "logic-dff", "logic-toggle", "logic-counter", "fsm", "boss-logic", "inc-controller"], "boot-rom": ["verilog", "full-adder-v", "mux2", "adder4", "verilog-seq", "mux4", "prio", "hex", "seg7", "reg8", "bcd", "shift", "edge", "seqdet", "popcount", "gray", "fifo", "adder8", "alu8", "regfile4", "pc8", "cpu-decode", "cpu-tiny", "boss-numbers", "inc-numbers", "boss-hdl", "inc-rtl"]};
const NAMES = {"lamp-board": "The Lamp Board", "inverted-hall": "The Inverted Hall", "carry-chain": "Carry Chain", "clockwork": "Clockwork", "boot-rom": "Boot ROM"};
// MODS=<json file> adds later acts' places ({ MODULES, NAMES }, in play order) to the tables above
if (process.env.MODS) {
  const extra = JSON.parse(readFileSync(process.env.MODS, 'utf8'));
  for (const [k, v] of Object.entries(extra.MODULES)) MODULES[k] ??= v;
  for (const [k, v] of Object.entries(extra.NAMES)) NAMES[k] ??= v;
}
const ORDER = Object.keys(MODULES);
const seenRoles = {};


/** Platforms of the room the drone can stand on (tops of solids and one-way ledges; tall thin walls left out). */
const platforms = () => story(() => {
  const r = window.__tapeoutGame.story.room;
  return [...r.solids.map((p) => ({ ...p, one: false })), ...r.oneWay.map((p) => ({ ...p, one: true }))].filter((p) => p.w >= 60 && !(p.h > 200 && p.w < 100));
});
const RISE = 150, GAP = 230;
/** A route of platforms from the one under the drone to one the exit can be walked to from: breadth first. */
const route = (ps, d, exit) => {
  const under = ps.filter((p) => d.x >= p.x - 22 && d.x <= p.x + p.w + 22 && p.y >= d.y - 10).sort((a, b) => a.y - b.y)[0];
  const goal = (p) => p.x + p.w >= exit.x - 60 && (exit.y === undefined || p.y <= exit.y + 4);
  const gap = (a, b) => Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const prev = new Map([[under, null]]), q = [under];
  while (q.length) {
    const p = q.shift();
    if (goal(p)) { const out = []; for (let k = p; k && k !== under; k = prev.get(k)) out.unshift(k); out.under = under; return out; }
    for (const n of ps) if (!prev.has(n) && n !== p && p.y - n.y <= RISE && gap(p, n) <= GAP && !(n.y > p.y + 500)) { prev.set(n, p); q.push(n); }
  }
  return null;
};
/** Leave the room the way a player would: up and across its platforms to the exit, then through it. */
const traverse = async (exit) => {
  for (let tries = 0; tries < 12; tries++) {
    const d = await drone();
    if (exit.y === undefined || d.y <= exit.y + 4) {
      const ps = await platforms(), path = route(ps, d, exit);
      if (!path || path.length === 0) return;
    }
    const ps = await platforms(), path = route(ps, await drone(), exit);
    if (!path) { log('no route'); return; }
    if (!path.length) return;
    const n = path[0], cur = await drone();
    log(`  climb: at ${Math.round(cur.x)},${Math.round(cur.y)} → ${n.x},${n.y} ${n.w}w ${n.one ? 'one-way' : 'solid'} (${path.length} to go)`);
    const rising = n.y < cur.y - 10, P = path.under;
    const right = n.x + n.w / 2 > cur.x;
    const overlap = P && Math.min(P.x + P.w, n.x + n.w) - Math.max(P.x, n.x) > 40;
    // take off beside a solid ledge (never under it); under a one-way ledge is fine; across a gap, from the edge
    let off;
    if (!overlap && P) off = right ? P.x + P.w - 18 : P.x + 18;
    else if (!rising) off = right ? n.x - 30 : n.x + n.w + 30;
    else if (n.one) off = Math.min(Math.max(cur.x, n.x + 30), n.x + n.w - 30);
    else off = right ? n.x - 50 : n.x + n.w + 50;
    const land = right ? Math.min(n.x + 70, n.x + n.w / 2) : Math.max(n.x + n.w - 70, n.x + n.w / 2);
    if (!overlap && P && rising && cur.y - n.y > 90) {
      // a tall step up beside a solid ledge: from the edge, straight up first, then steer over it
      await walk(off, { tol: 8 });
      await wait(6);
      await run({ type: 'jumpTo', x: land, late: 14 });
    } else if (!overlap && P) {
      // a running start from well back on this platform
      await walk(right ? Math.max(P.x + 20, off - 120) : Math.min(P.x + P.w - 20, off + 120), { tol: 12 });
      await run({ type: 'leap', x0: off, land });
    } else {
      await walk(off, { tol: 12 });
      await wait(6);
      if (rising) await run({ type: 'jumpTo', x: land });
    }
  }
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
  // an arcade app opened from a station sits on top of it, with its own close button: close the top windows first
  const closes = page.getByTestId('overlay-close');
  while ((await closes.count()) > 1) { await closes.last().click(); await page.waitForTimeout(300); }
  if (await page.locator('.st-unplug').count()) await page.locator('.st-unplug').click();
  else if (await page.getByTestId('overlay-close').count()) await page.getByTestId('overlay-close').click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // a lesson can launch its arcade app as it closes: close anything still open over the card
  for (let i = 0; i < 3 && (await closes.count()); i++) { await closes.last().click(); await page.waitForTimeout(300); }
  if (await page.getByTestId('story-card').count()) await card(3200);
};
const leave = async () => {
  const before = await story(() => window.__tapeoutGame.story.index);
  const exit = await story(() => window.__tapeoutGame.story.room.exit);
  // most rooms are walked out of; climb only when the exit is up high or the walk got stuck
  if (exit.y === undefined) await walk(exit.x + 30);
  if ((await story(() => window.__tapeoutGame.story.index)) === before && !(await story(() => window.__tapeoutGame.story.fade))) {
    await traverse(exit);
    await walk(exit.x + 30);
  }
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
      return { cmd: n.ins.cmd, arg: n.arg, x: st.x, y: st.y - 40, foot: st.y };
    });
    if (!nx) break;
    const before = await story(() => window.__tapeoutGame.story.boss.log.length);
    // a node up on a ledge: climb to it the way the exit climb does
    if ((await drone()).y > nx.foot + 30) await traverse({ x: nx.x, y: nx.foot });
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

/** An X arena (Phase 7): a straight fight, cut short once it has been on screen a while; after the fourth form the
 * bot walks into the bit. The recording is a showcase, so the drone takes no damage here. */
const xfight = async (place) => {
  const rect = await story(() => window.__tapeoutGame.story.room.boss.rect);
  const n = await story(() => window.__tapeoutGame.story.xn);
  await story(() => { window.__tapeoutGame.sim.assist.damageScale = 0; });
  for (let k = 0; k < 40; k++) {
    if (!(await story(() => window.__tapeoutGame.story.xn))) break;
    await fireAt({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, 30);
    if (k === 3) await still(`${place}-x${n}`);
    if (k === 7) await story(() => { const b = window.__tapeoutGame.story.boss; b.hp = Math.min(b.hp, 30); });
  }
  await wait(90);
  if (n === 4) {
    await page.waitForFunction(() => window.__tapeoutGame.story.bit && window.__tapeoutGame.story.bit.vy === 0, null, { timeout: 10000 });
    await still(`${place}-bit`);
    const b = await story(() => window.__tapeoutGame.story.bit);
    await walk(b.x, { tol: 6 });
    await page.waitForFunction(() => window.__tapeoutGame.story.room.role === 'ending', null, { timeout: 20000 });
  }
};
/** The ending (Phase 7): watched to the end, with a still per step, then the card back to the Loft. */
const ending = async () => {
  for (const k of [0, 2, 3, 4, 5]) {
    await page.waitForFunction((i) => (window.__tapeoutGame.story.ending?.step ?? 9) >= i && window.__tapeoutGame.story.ending.t > 80, k, { timeout: 40000 });
    await still(`tapeout-ending-${k}`);
  }
  await page.getByTestId('story-card').waitFor({ timeout: 40000 });
  await card(4000);
  await page.waitForFunction(() => window.__tapeoutGame.story.place === 'loft' && !window.__tapeoutGame.story.fade, null, { timeout: 20000 });
  await wait(90);
};

try {
  // the run so far: every place before the first one recorded is signed off, so the lift offers it
  const first = ORDER.indexOf(places[0]);
  await story((ids) => { for (const id of ids) window.__tapeoutAward(id); }, ORDER.slice(0, first).flatMap((p) => MODULES[p]));
  await story(() => window.__tapeoutGame.story.warp('loft', 0));
  await wait(90);
  // ENDED=1: the ending has been seen, so the Loft lift lists the wings and the Hiring Hall (Phase 8)
  if (process.env.ENDED) await story(() => { const w = window.__tapeoutGame.story.world; if (!w.cutscenes.includes('ending')) w.cutscenes.push('ending'); });
  for (const place of places) {
    if (process.env.WARP) {
      // for working on one room: straight there (WARP=<room index>)
      await story(([p, k]) => window.__tapeoutGame.story.warp(p, k), [place, Number(process.env.WARP)]);
      await wait(30);
    } else {
      // places between the recorded ones (a Deep Layer not on the list) are signed off, so the lift opens the next
      await story((ids) => { for (const id of ids) window.__tapeoutAward(id); }, ORDER.slice(0, ORDER.indexOf(place)).filter((p) => !places.includes(p)).flatMap((p) => MODULES[p] ?? []));
      const lift = (await roomNow()).stations.find((x) => x.kind === 'lift');
      await walk(lift.x, { tol: 14 });
      await still(`${place}-00-loft`);
      await press();
      await page.getByTestId('story-choice').waitFor();
      await page.waitForTimeout(1800);
      const name = NAMES[place].replace(/[()]/g, '\\$&');
      await page.getByTestId('story-choice').getByRole('button', { name: new RegExp(`^(Continue: )?${name}( \\([^)]*\\))?$`) }).first().click();
      await page.waitForFunction((p) => window.__tapeoutGame.story.place === p && !window.__tapeoutGame.story.fade, place, { timeout: 20000 });
    }
    for (let guard = 0; guard < 40; guard++) {
      const r = await roomNow();
      if (r.place !== place) break;
      // highlights (every place after the first): the puzzle, the first fight, a bench, the boss and the way out are
      // played; the other rooms are signed off and skipped
      const seen = (seenRoles[place] ??= new Set());
      const rail = r.role === 'traverse' && r.stations.some((x) => x.kind === 'rail') && (await story(() => !!window.__tapeoutGame.sim.kit.rail));
      // a Deep Layer shows its landing and its first room with bugs in it
      const bugs = r.role === 'traverse' && r.enemies > 0 && !seen.has('bugs');
      const keep = (place === places[0] && process.env.HIGHLIGHTS !== 'all') || ['xarena', 'ending'].includes(r.role) || (place === 'tapeout' && r.role === 'port') || (['discovery', 'arena', 'exit', 'landing'].includes(r.role) || (['fight', 'bench'].includes(r.role) && !seen.has(r.role))) || (rail && !seen.has('rail')) || bugs || (r.role === 'offices' && !seen.has('offices'));
      seen.add(r.role);
      if (bugs) seen.add('bugs');
      if (rail && keep) seen.add('rail');
      if (!keep) {
        // a skipped Hiring Hall office is walked past, not passed: its panels keep their state
        const mods = r.role === 'offices' ? [] : (await story(() => window.__tapeoutGame.story.room.modules));
        await story((ids) => { for (const id of ids) window.__tapeoutAward(id); }, mods);
        await story((i) => { const s = window.__tapeoutGame.story; s.warp(s.place, i); }, r.index + 1);
        await wait(20);
        continue;
      }
      log(`${place} room ${r.index} ${r.role}`);
      await wait(60);
      // a card on arrival (the Underlayers): read it, then close it
      if (r.role !== 'arena' && (await page.getByTestId('story-card').count())) await card(3500);
      await still(`${place}-${String(r.index + 1).padStart(2, '0')}-${r.role}`);
      if (r.role === 'ending') { await ending(); break; }
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
        await story(() => { const s = window.__tapeoutGame.story; s.discover(`${s.place}:${s.room.mechanic}`); s.rs.mech.solved = true; for (const id of s.rs.gates.keys()) s.openGate(id); });
        await wait(60);
      }
      if (rail) {
        // a bus rail: clip on and ride it across
        const st = r.stations.find((x) => x.kind === 'rail');
        await walk(st.x, { tol: 14 });
        await press();
        await wait(30);
        await page.waitForFunction(() => !window.__tapeoutGame.sim.riding, null, { timeout: 20000 });
        await wait(30);
      }
      if (r.role === 'fight' || bugs) await run({ type: 'fight' }, 90000);
      if (r.role === 'arena') await arena(place);
      if (r.role === 'xarena') { await xfight(place); if (r.index === (await story(() => window.__tapeoutGame.story.roomsFor('tapeout').length)) - 2) continue; }
      if (['port', 'panel', 'bench', 'gate', 'bossdoor'].includes(r.role)) {
        for (const st of r.stations.filter((x) => x.module)) {
          if (await story((id) => window.__tapeoutGame.story.kitDone(id), st.module)) continue;
          await moduleAt(st, r.role === 'bench' ? 4500 : 3500);
        }
      }
      if (r.role === 'offices') {
        // the first office: walk to a hiring panel and take it, then on along the row
        const st = r.stations.find((x) => x.kind === 'hire');
        try { await moduleAt(st, 3500); } catch { log(`${place}: the panel stayed shut`); await wait(120); }
      }
      if (r.role === 'bossdoor') await wait(90);
      // a room the bot cannot cross (a moving-platform pit, a programmed lift) is cut, not failed: on to the next room
      try { await leave(); } catch (e) {
        log(`${place} room ${r.index}: bot could not cross (${e.message.split('\n')[0]}), cut to the next room`);
        await story(() => { window.__bot.cmd = { type: 'wait', n: 0, t: 0, done: true }; });
        await story((i) => { const s = window.__tapeoutGame.story; s.warp(s.place, i); }, r.index + 1);
        await wait(40);
      }
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
  log(`FAILED: ${e.message.split('\n')[0]}\n${(e.stack ?? '').split('\n').filter((l) => l.includes('record-act1')).join('\n')}`);
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

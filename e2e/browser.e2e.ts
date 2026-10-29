// Opens the built Tapeout.html. The test room (#/story/test): plays a few seconds and checks the frame budget (60 fps:
// the work of one frame, steps plus drawing, must fit in 16.7 ms). Level 1: starts the story from the desktop button,
// closes the first wire loop with the keyboard, opens and closes a wall port, and reaches the Loft.
import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

type Station = { kind: string; module?: string };
type Story = { room: { id: string; role?: string; stations: Station[] }; rs: { passed: boolean; carrying: string | null }; waiting: boolean; warp(place: string, i: number): void; place: string; index: number; fade: unknown; roomsFor(place: string): { role?: string }[]; boss: { phase: string } | null; useStation(st: Station): void };
type G = { story: Story | null; drive: unknown; ready: boolean; sim: { drone: { x: number; y: number; grounded: boolean }; steps: number }; isPaused: boolean; resetStats(): void; stressTest(): void; frameStats(): { fps: number; workAvg: number; workP95: number; stepP95: number; frames: number; particles: number; enemies: number; props: number } };
declare global { interface Window { __tapeoutGame?: G } }

test('the test room plays within the frame budget', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.evaluate(() => (location.hash = '#/story/test'));
  await expect(page.getByTestId('game')).toBeVisible();
  await page.waitForFunction(() => window.__tapeoutGame && window.__tapeoutGame.ready, null, { timeout: 15000 });

  const x0 = await page.evaluate(() => window.__tapeoutGame!.sim.drone.x);
  await page.mouse.move(1100, 400);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  const x1 = await page.evaluate(() => window.__tapeoutGame!.sim.drone.x);
  expect(x1 - x0).toBeGreaterThan(200);

  // fire and use the field for a while, then read the frame statistics
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await page.mouse.up();
  const stats = await page.evaluate(() => window.__tapeoutGame!.frameStats());
  console.log(`frame stats: ${JSON.stringify(stats)}`);
  expect(stats.frames).toBeGreaterThan(100);
  expect(stats.workP95).toBeLessThan(16.7);

  // the stress scene (decision 28): 30 enemies, 50 props, a full particle pool, firing; still inside the budget
  await page.evaluate(() => { window.__tapeoutGame!.stressTest(); window.__tapeoutGame!.resetStats(); });
  await page.mouse.down();
  await page.waitForTimeout(3000);
  await page.mouse.up();
  const stress = await page.evaluate(() => window.__tapeoutGame!.frameStats());
  console.log(`stress stats: ${JSON.stringify(stress)}`);
  expect(stress.enemies).toBeGreaterThanOrEqual(20);
  expect(stress.workP95).toBeLessThan(16.7);

  // pause, open Settings and Controls, back out, then quit to the title
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const menu = page.getByRole('dialog', { name: 'Paused' });
  await menu.getByRole('button', { name: 'Settings' }).click();
  await menu.getByRole('button', { name: /Reduce screen shake/ }).click();
  await expect(menu.getByRole('button', { name: 'Reduce screen shake: On' })).toBeVisible();
  await menu.getByRole('button', { name: 'Controls' }).click();
  await expect(menu.getByRole('heading', { name: 'Controls' })).toBeVisible();
  await menu.getByRole('button', { name: 'Done' }).click();
  await menu.getByRole('button', { name: 'Back', exact: true }).click();
  await menu.getByRole('button', { name: 'Quit to title' }).click();
  await expect(page.getByTestId('game')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Level 1: the first wire, a wall port, and the Loft', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('story-preview').click();
  await expect(page.getByTestId('game')).toBeVisible();
  // a new player names themselves first
  await expect(page.getByTestId('story-profile')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Sam');
  await page.getByRole('button', { name: 'I am new to this' }).click();
  await page.waitForFunction(() => window.__tapeoutGame?.ready && !window.__tapeoutGame.story!.waiting, null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__tapeoutGame!.story!.room.id)).toBe('dark-bay');

  // walk to the switch with the keyboard, pick up the wire, carry it to the lamp, plug it in
  const droneX = () => page.evaluate(() => window.__tapeoutGame!.sim.drone.x);
  const walkTo = async (x: number) => {
    let last = await droneX(), stuck = 0;
    const key = x > last ? 'KeyD' : 'KeyA';
    await page.keyboard.down(key);
    for (let i = 0; i < 200; i++) {
      await page.waitForTimeout(40);
      const now = await droneX();
      if (Math.abs(x - now) < 20 || (key === 'KeyD') !== x > now) break;
      if (await page.evaluate(() => window.__tapeoutGame!.story!.waiting)) break; // a card came up
      stuck = Math.abs(now - last) < 1 ? stuck + 1 : 0;
      last = now;
      // hop whatever is in the way
      if (stuck > 2) { await page.keyboard.down('Space'); await page.waitForTimeout(300); await page.keyboard.up('Space'); stuck = 0; }
    }
    await page.keyboard.up(key);
    await page.waitForTimeout(250);
  };
  await walkTo(900);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__tapeoutGame!.story!.rs.carrying === 'in:in');
  await walkTo(1300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__tapeoutGame!.story!.rs.passed, null, { timeout: 5000 });
  // the upgrade card
  await expect(page.getByTestId('story-card')).toBeVisible();
  const darkStats = await page.evaluate(() => window.__tapeoutGame!.frameStats());
  console.log(`dark bay stats: ${JSON.stringify(darkStats)}`);
  expect(darkStats.workP95).toBeLessThan(16.7);
  await page.getByTestId('story-card').getByRole('button').click();

  // the Bit Wall's port opens TAPEOUT's terminal over the game; Esc unplugs
  await page.evaluate(() => window.__tapeoutGame!.story!.warp('bit-zero', 1));
  // the coil gate brings the Field Coil online on the way
  await walkTo(400);
  await expect(page.getByTestId('story-card')).toContainText('FIELD COIL ONLINE');
  await page.getByTestId('story-card').getByRole('button').click();
  await walkTo(1150);
  await page.keyboard.press('KeyE');
  await expect(page.getByTestId('port')).toBeVisible();
  await expect(page.getByTestId('port').locator('.term-out')).not.toBeEmpty({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('port')).toHaveCount(0);
  await page.waitForFunction(() => !window.__tapeoutGame!.story!.waiting);

  // the Loft
  await page.evaluate(() => window.__tapeoutGame!.story!.warp('loft', 0));
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__tapeoutGame!.story!.place)).toBe('loft');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Difficulty and assists' }).click();
  await expect(page.getByRole('button', { name: /Difficulty: Story/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Quit to title' }).click();
  await expect(page.getByTestId('game')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Act 1 places: a port, a fight, an arena that fights back, and the chip map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('story-preview').click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Sam');
  await page.getByRole('button', { name: 'I am new to this' }).click();
  await page.waitForFunction(() => window.__tapeoutGame?.ready && !window.__tapeoutGame.story!.waiting, null, { timeout: 15000 });
  const roomOf = (role: string) => page.evaluate((r) => window.__tapeoutGame!.story!.roomsFor('lamp-board').findIndex((x) => x.role === r), role);

  // a port room: its station opens the module's terminal
  const port = await roomOf('port');
  await page.evaluate((i) => window.__tapeoutGame!.story!.warp('lamp-board', i), port);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.module)!); });
  await expect(page.getByTestId('port')).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('port')).toHaveCount(0);

  // a fight room runs
  await page.evaluate((i) => window.__tapeoutGame!.story!.warp('lamp-board', i), await roomOf('fight'));
  await page.waitForTimeout(1500);

  // the arena: the pager, then the body attacks
  await page.evaluate((i) => window.__tapeoutGame!.story!.warp('lamp-board', i), await roomOf('arena'));
  await expect(page.getByTestId('story-card')).toContainText('PAGER');
  await page.getByTestId('story-card').getByRole('button').click();
  expect(await page.evaluate(() => window.__tapeoutGame!.story!.boss!.phase)).toBe('investigate');
  await page.waitForTimeout(4000);

  // the Loft's chip map
  await page.evaluate(() => window.__tapeoutGame!.story!.warp('loft', 0));
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.kind === 'map')!); });
  await expect(page.getByTestId('story-loft')).toContainText('THE CHIP MAP');
  await page.getByTestId('story-loft').getByRole('button', { name: 'Back to the Loft' }).click();
  await expect(page.getByTestId('story-loft')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Act 2: down a Deep Layer hatch and back, and an act 2 arena that fights back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  // ?record exposes the award hook, so a hatch's place can be opened (Phase 5 Spec, section 3: locked hatches stay shut)
  await page.goto(`${pathToFileURL(resolve('dist/index.html')).href}?record`);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('story-preview').click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Sam');
  await page.getByRole('button', { name: 'I am new to this' }).click();
  await page.waitForFunction(() => window.__tapeoutGame?.ready && !window.__tapeoutGame.story!.waiting, null, { timeout: 15000 });
  const where = () => page.evaluate(() => [window.__tapeoutGame!.story!.place, window.__tapeoutGame!.story!.index]);

  // the Boot ROM's exit has a hatch down to the Firmware Pit; its landing has one back up
  const exit = await page.evaluate(() => window.__tapeoutGame!.story!.roomsFor('boot-rom').length - 1);
  await page.evaluate((i) => window.__tapeoutGame!.story!.warp('boot-rom', i), exit);
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as unknown as { __tapeoutAward(id: string): void }).__tapeoutAward('code-c-swap'));
  await page.evaluate(() => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.kind === 'hatch')!); });
  await page.waitForFunction(() => window.__tapeoutGame!.story!.place === 'firmware-pit' && !window.__tapeoutGame!.story!.fade, null, { timeout: 10000 });
  expect(await where()).toEqual(['firmware-pit', 0]);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.kind === 'hatch')!); });
  await page.waitForFunction(() => window.__tapeoutGame!.story!.place === 'boot-rom' && !window.__tapeoutGame!.story!.fade, null, { timeout: 10000 });
  expect(await where()).toEqual(['boot-rom', exit]);

  // the Bridge Between Clocks: the pager, then its two halves fire on their own clocks
  const arena = await page.evaluate(() => window.__tapeoutGame!.story!.roomsFor('clock-bridge').findIndex((x) => x.role === 'arena'));
  await page.evaluate((i) => window.__tapeoutGame!.story!.warp('clock-bridge', i), arena);
  await expect(page.getByTestId('story-card')).toContainText('PAGER');
  await page.getByTestId('story-card').getByRole('button').click();
  expect(await page.evaluate(() => window.__tapeoutGame!.story!.boss!.phase)).toBe('investigate');
  await page.waitForTimeout(6000);
  expect(errors).toEqual([]);
});

test('The Underlayers: the Pipeline hatch stays shut until D5 opens, then drops in with the arrival card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(`${pathToFileURL(resolve('dist/index.html')).href}?record`);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('story-preview').click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Sam');
  await page.getByRole('button', { name: 'I am new to this' }).click();
  await page.waitForFunction(() => window.__tapeoutGame?.ready && !window.__tapeoutGame.story!.waiting, null, { timeout: 15000 });
  const exit = await page.evaluate(() => window.__tapeoutGame!.story!.roomsFor('pipeline').length - 1);
  await page.evaluate((i) => window.__tapeoutGame!.story!.warp('pipeline', i), exit);
  await page.waitForTimeout(600);
  const hatch = () => page.evaluate(() => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.kind === 'hatch')!); });
  await hatch();
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__tapeoutGame!.story!.place)).toBe('pipeline');
  await page.evaluate(() => (window as unknown as { __tapeoutAward(id: string): void }).__tapeoutAward('ohm'));
  await hatch();
  await page.waitForFunction(() => window.__tapeoutGame!.story!.place === 'power-grid' && !window.__tapeoutGame!.story!.fade, null, { timeout: 10000 });
  await expect(page.getByTestId('story-card')).toContainText('THE UNDERLAYERS');
  await page.getByTestId('story-card').getByRole('button', { name: 'Go down' }).click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

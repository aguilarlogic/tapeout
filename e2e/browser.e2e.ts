// Opens the built Tapeout.html, starts the story preview from the desktop, plays a few seconds of the test room, and
// checks the frame budget (60 fps: the work of one frame, steps plus drawing, must fit in 16.7 ms).
import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

type G = { ready: boolean; sim: { drone: { x: number; y: number; grounded: boolean }; steps: number }; isPaused: boolean; resetStats(): void; stressTest(): void; frameStats(): { fps: number; workAvg: number; workP95: number; stepP95: number; frames: number; particles: number; enemies: number; props: number } };
declare global { interface Window { __tapeoutGame?: G } }

test('the desktop opens the story preview, and the test room plays within the frame budget', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('story-preview').click();
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

// Opens the built Tapeout.html, starts the story preview from the desktop, plays a few seconds of the test room, and
// checks the frame budget (60 fps: the work of one frame, steps plus drawing, must fit in 16.7 ms).
import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

type G = { sim: { drone: { x: number; y: number; grounded: boolean }; steps: number }; isPaused: boolean; frameStats(): { fps: number; workAvg: number; workP95: number; stepP95: number; frames: number } };
declare global { interface Window { __tapeoutGame?: G } }

test('the desktop opens the story preview, and the test room plays within the frame budget', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('story-preview').click();
  await expect(page.getByTestId('game')).toBeVisible();
  await page.waitForFunction(() => window.__tapeoutGame && window.__tapeoutGame.sim.steps > 30);

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

  // pause, open Controls, back out, then return to the desktop
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.getByRole('heading', { name: 'Controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Back to desktop' }).click();
  await expect(page.getByTestId('game')).toHaveCount(0);
  expect(errors).toEqual([]);
});

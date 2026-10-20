// Smoke test of the packaged desktop app: launches the unpacked exe (release/win-unpacked/Tapeout.exe, or the path in
// TAPEOUT_EXE), checks the window title and that the title screen draws within 10 s, then opens the story preview.
import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const exe = process.env.TAPEOUT_EXE ?? resolve(process.platform === 'win32' ? 'release/win-unpacked/Tapeout.exe' : 'release/linux-unpacked/tapeout');

test('the desktop app opens on the title screen and starts the story preview', async () => {
  const app = await electron.launch({ executablePath: exe, args: process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless'] : [] });
  try {
    const win = await app.firstWindow();
    await expect(win.locator('#os')).not.toBeEmpty({ timeout: 10_000 });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toBe('Tapeout');
    // the page has no Node and no way out of the sandbox
    expect(await win.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined');
    await win.getByTestId('story-preview').click();
    await expect(win.getByTestId('game')).toBeVisible();
    // a fresh save starts the story by naming the player
    await win.getByRole('textbox', { name: 'Your name' }).fill('Sam');
    await win.getByRole('button', { name: 'I am new to this' }).click();
    await win.waitForFunction(() => ((window as unknown as { __tapeoutGame?: { sim: { steps: number } } }).__tapeoutGame?.sim.steps ?? 0) > 30);
  } finally {
    await app.close();
  }
});

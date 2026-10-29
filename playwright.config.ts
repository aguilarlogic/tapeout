// Browser smoke test of the built single-file game (dist/index.html). Run `npm run build` first.
// The Electron smoke test (e2e/electron.e2e.ts) runs on Windows CI against the unpacked exe.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  reporter: 'list',
  projects: [
    { name: 'browser', testMatch: /(browser|a11y)\.e2e\.ts/, use: { browserName: 'chromium', viewport: { width: 1280, height: 720 }, launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} } },
    { name: 'electron', testMatch: 'electron.e2e.ts' },
  ],
});

// Renders build/icon.svg to build/icon.png (512 × 512) with Playwright's Chromium. Run `npm run icon` after editing
// the SVG and commit both files. Set CHROMIUM_PATH to use an already-installed Chromium.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('build/icon.svg', 'utf8');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.locator('svg').screenshot({ path: 'build/icon.png', omitBackground: true });
await browser.close();
console.log('wrote build/icon.png');

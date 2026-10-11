// Startup profile: load time at 1x and 4x CPU throttle for a built page. Usage: node scripts/profile-startup.cjs [dist/index.html | dist-hosted/index.html]
// Needs playwright (npm i -D playwright, or a global install with NODE_PATH set).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'dist/index.html');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const rate of [1, 4]) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext(); const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const t0 = Date.now();
      await page.goto('file://' + file, { waitUntil: 'load' });
      await page.waitForSelector('#desktop', { timeout: 60000 });
      runs.push(Date.now() - t0);
      await ctx.close();
    }
    runs.sort((a, b) => a - b);
    console.log(`${path.basename(path.dirname(file))}/${path.basename(file)}  ${rate}x CPU: median ${runs[1]} ms (runs ${runs.join(', ')})`);
  }
  await browser.close();
})();

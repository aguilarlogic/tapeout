// Main-thread responsiveness of the heavy lab checks. Opens each lab with its reference solution in the editor, clicks
// Check at 4x CPU throttle, and reports the longest gap between animation frames while the check runs.
//   node scripts/perf-labs.cjs solutions.json [dist/index.html]
// solutions.json maps "<draft prefix>.<level id>" to the solution source, e.g. {"rv.rv-boss": "module rv32_core..."}.
// Dump it from the level definitions with a throwaway vitest file (inst.solution of rv-boss, tb-boss-env, sva-valid-ready).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const sols = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const file = path.resolve(process.argv[3] || 'dist/index.html');
const ROUTE = { rv: 'rv', tb: 'tb', sva: 'sva' };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
  let worst = 0;
  for (const [key, src] of Object.entries(sols)) {
    const [pre, ...rest] = key.split('.'); const id = rest.join('.');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(([pre, id, src]) => {
      localStorage.setItem('tapeout.progress.v1', JSON.stringify({ levels: {}, cards: {}, profile: { name: 'T', background: 'pro', goal: 'design', since: 1 }, prefs: { speed: 'instant' }, best: {} }));
      localStorage.setItem(`tapeout.draft.${pre}.${id}.seed`, '1');
      localStorage.setItem(`tapeout.draft.${pre}.${id}.1`, JSON.stringify(src));
    }, [pre, id, src]);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto('file://' + file); await page.waitForTimeout(1500);
    await page.evaluate((h) => { location.hash = h; }, `#/${ROUTE[pre]}/${id}`); await page.waitForTimeout(2000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); }; window.__raf = requestAnimationFrame(tick); });
    const t0 = Date.now();
    await page.getByRole('button', { name: /Check|Run/ }).first().click();
    await page.waitForFunction(() => { const s = document.querySelector('.status'); return s && !/Running|Simulating/.test(s.textContent || ''); }, null, { timeout: 120000 }).catch(() => {});
    const took = Date.now() - t0;
    const gaps = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__gaps; });
    const max = Math.round(Math.max(0, ...gaps));
    worst = Math.max(worst, max);
    const final = (await page.locator('.status').first().innerText()).replace(/\s+/g, ' ').slice(0, 90);
    console.log(`${key}: check took ${took} ms, longest gap between frames ${max} ms, result: ${final}`);
    await ctx.close();
  }
  await browser.close();
  console.log(worst <= 200 ? `ok: no freeze above 200 ms (worst ${worst} ms)` : `freeze above 200 ms (worst ${worst} ms)`);
})();

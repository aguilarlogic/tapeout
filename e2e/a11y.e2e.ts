// Phase 10 Spec, section 3: the WCAG 2.2 AA audit. axe-core (pinned at 4.10.2 in package.json) runs on each of the screens
// the spec lists, against the built single-file game (dist/index.html; run `npm run build` first), and every screen must
// report no violations. Reuses the setup and window hooks of browser.e2e.ts. A screen that cannot be opened is a
// test.fixme with the reason in its title, so the run says exactly which screens were not audited.
import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

type Station = { kind: string; module?: string };
type Story = { room: { id: string; role?: string; stations: Station[] }; rs: { passed: boolean; carrying: string | null }; waiting: boolean; warp(place: string, i: number): void; place: string; index: number; fade: unknown; roomsFor(place: string): { role?: string; stations: Station[] }[]; useStation(st: Station): void };
type G = { story: Story | null; ready: boolean; sim: { drone: { x: number } } };
declare global { interface Window { __tapeoutGame?: G; __tapeoutTouch?: unknown } }

/** The shape of axe.run's result that the audit reads. */
type AxeApi = { run(context: Element, options: unknown): Promise<{ violations: { id: string; impact?: string | null; nodes: { target: unknown[]; failureSummary?: string }[] }[] }> };
type Violation = { id: string; impact: string; nodes: { target: string; summary: string }[] };

const require = createRequire(import.meta.url);
/** The axe build the audit injects (axe-core 4.10.2, exact, as package.json pins it). */
const AXE_PATH = require.resolve('axe-core/axe.min.js');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Dialogs ease in over 180 ms: axe waits past that so half-faded frames do not count as contrast failures. */
const SETTLE_MS = 400;
const FILE = pathToFileURL(resolve('dist/index.html')).href;
const PAUSED = '[role="dialog"][aria-label="Paused"]';
const LEARNING_ROUTE = '[role="dialog"][aria-label="Learning route"]';

/** Runs axe on the element that matches `root` and returns the violations as plain data. */
async function audit(page: Page, root: string): Promise<Violation[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE_PATH });
  await page.waitForTimeout(SETTLE_MS);
  return page.evaluate(async ({ root, tags }) => {
    const el = document.querySelector(root);
    if (!el) throw new Error(`nothing matches ${root}, so the screen did not open`);
    const axe = (window as unknown as { axe: AxeApi }).axe;
    const out = await axe.run(el, { runOnly: { type: 'tag', values: tags } });
    return out.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? 'none',
      nodes: v.nodes.map((n) => ({ target: n.target.map(String).join(' '), summary: n.failureSummary ?? '' })),
    }));
  }, { root, tags: TAGS });
}

/** Expects no violations on the screen. A failure lists id, impact, target and failureSummary for each node. */
async function expectClean(page: Page, name: string, root: string) {
  const violations = await audit(page, root);
  const lines = violations.flatMap((v) => v.nodes.map((n) => `${v.id} | ${v.impact} | ${n.target} | ${n.summary.replace(/\s+/g, ' ').trim()}`));
  console.log(`axe ${name}: ${violations.length} rule(s) failed, ${lines.length} node(s)`);
  expect(lines, `axe violations on ${name} (id | impact | target | failureSummary)`).toEqual([]);
}

/** A new player: names themselves and starts the story at the first room (as browser.e2e.ts does). */
async function newPlayer(page: Page) {
  await page.goto(FILE);
  await expect(page.locator('#os')).not.toBeEmpty();
  await page.getByTestId('game').waitFor();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Sam');
  await page.getByRole('button', { name: 'I am new to this' }).click();
  await page.waitForFunction(() => window.__tapeoutGame?.ready && !window.__tapeoutGame.story!.waiting, null, { timeout: 15000 });
}

/** Opens the pause menu with Escape and returns it. */
async function pause(page: Page) {
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Paused' });
  await expect(menu).toBeVisible();
  return menu;
}

/** Warps the story to a room and waits for it to settle. */
async function warp(page: Page, place: string, index: number) {
  await page.evaluate(([p, i]) => window.__tapeoutGame!.story!.warp(p, i), [place, index] as const);
  await page.waitForTimeout(600);
}

/** The first room of a place with a station of this kind, or -1. */
async function roomWith(page: Page, place: string, kind: string): Promise<number> {
  return page.evaluate(([p, k]) => window.__tapeoutGame!.story!.roomsFor(p).findIndex((r) => r.stations.some((s) => s.kind === k)), [place, kind] as const);
}

/** Uses the first station of a kind in the current room (the same call the drone's E makes). */
async function useKind(page: Page, kind: string) {
  await page.evaluate((k) => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.kind === k)!); }, kind);
}

/** Walks the drone to x with the keyboard, hopping what is in the way (browser.e2e.ts, Level 1). */
async function walkTo(page: Page, x: number) {
  const droneX = () => page.evaluate(() => window.__tapeoutGame!.sim.drone.x);
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
    if (stuck > 2) { await page.keyboard.down('Space'); await page.waitForTimeout(300); await page.keyboard.up('Space'); stuck = 0; }
  }
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
}

// 1. The profile card: the first screen of a new game.
test('1 Profile card', async ({ page }) => {
  await page.goto(FILE);
  await page.getByTestId('game').waitFor();
  await expect(page.getByTestId('story-profile')).toBeVisible();
  await expectClean(page, 'Profile card', '[data-testid="story-profile"]');
});

// 2. The pause menu.
test('2 Pause menu', async ({ page }) => {
  await newPlayer(page);
  await pause(page);
  await expectClean(page, 'Pause menu', PAUSED);
});

// 3. Settings (from the pause menu).
test('3 Settings', async ({ page }) => {
  await newPlayer(page);
  const menu = await pause(page);
  await menu.getByRole('button', { name: 'Settings' }).click();
  await expect(menu.getByRole('button', { name: /Reduce screen shake/ })).toBeVisible();
  await expectClean(page, 'Settings', PAUSED);
});

// 4. Accessibility (Phase 10 Spec, section 2): the panel the pause menu's Accessibility button opens.
test('4 Accessibility', async ({ page }) => {
  await newPlayer(page);
  const menu = await pause(page);
  await menu.getByRole('button', { name: 'Accessibility', exact: true }).click();
  await expect(menu.getByRole('heading', { name: 'Accessibility' })).toBeVisible();
  await expectClean(page, 'Accessibility', PAUSED);
});

// 5. Difficulty and assists.
test('5 Difficulty and assists', async ({ page }) => {
  await newPlayer(page);
  const menu = await pause(page);
  await menu.getByRole('button', { name: 'Difficulty and assists' }).click();
  await expect(menu.getByRole('heading', { name: 'Difficulty' })).toBeVisible();
  await expectClean(page, 'Difficulty and assists', PAUSED);
});

// 6. Controls: the key table, the gamepad table and the touch notes.
test('6 Controls', async ({ page }) => {
  await newPlayer(page);
  const menu = await pause(page);
  await menu.getByRole('button', { name: 'Settings' }).click();
  await menu.getByRole('button', { name: 'Controls' }).click();
  await expect(menu.getByRole('heading', { name: 'Controls' })).toBeVisible();
  await expectClean(page, 'Controls', PAUSED);
});

// 7. An upgrade card: the Field Coil comes online on the way through Bit Zero (the first wire room).
test('7 Upgrade card', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'bit-zero', 1);
  await walkTo(page, 400);
  await expect(page.getByTestId('story-card')).toContainText('FIELD COIL ONLINE');
  await expectClean(page, 'Upgrade card', '[data-testid="story-card"]');
});

// 8. The lift choice list (the Loft's lift).
test('8 Lift choice list', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'loft', 0);
  await useKind(page, 'lift');
  await expect(page.getByTestId('story-choice')).toContainText('THE LIFT');
  await expectClean(page, 'Lift choice list', '[data-testid="story-choice"]');
});

// 9. The touch speed card: the first play by touch offers 75% game speed.
test('9 Touch speed card', async ({ page }) => {
  await newPlayer(page);
  await page.evaluate(() => { window.__tapeoutTouch = [{ id: 1, x: 200, y: 560 }]; });
  await expect(page.getByTestId('story-choice')).toContainText('PLAYING BY TOUCH?');
  await expectClean(page, 'Touch speed card', '[data-testid="story-choice"]');
});

// 10. The Loft's overlays. Each opens from its station in the Loft.
test('10 Loft: Chip Map', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'loft', 0);
  await useKind(page, 'map');
  await expect(page.getByTestId('story-loft')).toContainText('THE CHIP MAP');
  await expectClean(page, 'Loft: Chip Map', '[data-testid="story-loft"]');
});

test('10 Loft: Learning route', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'loft', 0);
  await useKind(page, 'map');
  await page.getByTestId('story-loft').getByRole('button', { name: 'Learning route' }).click();
  await expect(page.locator(LEARNING_ROUTE)).toBeVisible();
  await expectClean(page, 'Loft: Learning route', LEARNING_ROUTE);
});

test('10 Loft: Study (the chalkboard station)', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'loft', 0);
  await useKind(page, 'board');
  await expect(page.getByTestId('story-loft')).toContainText('THE CHALKBOARD');
  await expectClean(page, 'Loft: Study', '[data-testid="story-loft"]');
});

// The spec's list names a Workshop overlay; the Loft has no Workshop station (story/level1.ts LOFT), so there is none to audit.

test('10 Loft: Archive', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'loft', 0);
  await useKind(page, 'archive');
  await expect(page.getByTestId('story-loft')).toContainText('THE ARCHIVE');
  await expectClean(page, 'Loft: Archive', '[data-testid="story-loft"]');
});

test('10 Loft: Arcade', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'loft', 0);
  await useKind(page, 'arcade');
  await expect(page.getByTestId('story-loft')).toContainText('THE ARCADE');
  await expectClean(page, 'Loft: Arcade', '[data-testid="story-loft"]');
});

// 11. A port lesson: the terminal running a lesson (the Act 1 room with a port, as browser.e2e.ts uses).
test('11 Port lesson', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'lamp-board', await page.evaluate(() => window.__tapeoutGame!.story!.roomsFor('lamp-board').findIndex((r) => r.role === 'port')));
  await page.evaluate(() => { const s = window.__tapeoutGame!.story!; s.useStation(s.room.stations.find((x) => x.module)!); });
  await expect(page.getByTestId('port')).toBeVisible();
  await expect(page.getByTestId('port').locator('.term-out')).not.toBeEmpty({ timeout: 10000 });
  await expectClean(page, 'Port lesson', '[data-testid="port"]');
});

// 12. A Patch Panel lab (the Logic Lab window).
test('12 Patch Panel lab', async ({ page }) => {
  await newPlayer(page);
  const i = await roomWith(page, 'bit-zero', 'panel');
  expect(i, 'a Level 1 room with a panel station').toBeGreaterThanOrEqual(0);
  await warp(page, 'bit-zero', i);
  await useKind(page, 'panel');
  await expect(page.getByTestId('panel')).toBeVisible();
  await expectClean(page, 'Patch Panel lab', '[data-testid="panel"]');
});

// 13. A Workbench (Verilog) lab: the first room of an early place that has a bench station.
test('13 Workbench (Verilog) lab', async ({ page }) => {
  await newPlayer(page);
  let place = 'bit-zero', i = -1;
  for (const p of ['bit-zero', 'lamp-board', 'inverted-hall', 'carry-chain', 'clockwork', 'boot-rom']) {
    i = await roomWith(page, p, 'bench');
    if (i >= 0) { place = p; break; }
  }
  expect(i, 'an early room with a bench station').toBeGreaterThanOrEqual(0);
  await warp(page, place, i);
  await useKind(page, 'bench');
  await expect(page.getByTestId('bench')).toBeVisible();
  await expectClean(page, 'Workbench (Verilog) lab', '[data-testid="bench"]');
});

// 14. The incident report card.
// 14. The incident report: the director's own debrief card (story/director.ts, the boss beaten path), with lines shaped
// like a real report. Solving an incident by hand to reach it would take minutes per run.
test('14 Incident report card', async ({ page }) => {
  await newPlayer(page);
  await page.evaluate(() => {
    const s = window.__tapeoutGame!.story! as unknown as { card(kind: string, title: string, lines: string[], stars: number): void };
    s.card('debrief', 'INCIDENT RESOLVED', ['1h 10m used of 2h 00m · 4 readings · 1 wrong calls · a careful expert: about 0h 50m · +120 XP',
      'What happened: the reset reached one flop late.', 'The fix: synchronise the reset release.', 'Your path: clock → reset → timing',
      'Upgrade: +10 integrity. Repaired: the core.'], 2);
  });
  await expect(page.getByTestId('story-card')).toContainText('INCIDENT RESOLVED');
  await expectClean(page, 'Incident report card', '[data-testid="story-card"]');
});

// 15. A Hiring Hall panel and the Interview desk.
// 15. A Hiring Hall panel: what its station opens once the role is ready (story/director.ts useStation, 'hire'). A new
// player's panels are shut, so the test opens the panel's module the way the station does after that check.
test('15 Hiring Hall panel', async ({ page }) => {
  await newPlayer(page);
  await warp(page, 'hiring-hall', 0);
  await page.evaluate(() => {
    const s = window.__tapeoutGame!.story! as unknown as Story & { out: unknown[] };
    const st = s.roomsFor('hiring-hall').flatMap((r) => r.stations).find((x) => x.kind === 'hire' && x.module);
    if (!st) throw new Error('no hire station in the Hiring Hall');
    s.out.push({ t: 'sfx', name: 'portOpen' }, { t: 'overlay', kind: 'module', module: st.module });
    s.waiting = true;
  });
  const dialog = page.locator('[role="dialog"]').last();
  await expect(dialog).toBeVisible();
  await expectClean(page, 'Hiring Hall panel', '.st-overlay:last-of-type [role="dialog"]');
});

// 15. The Interview desk: the Interview Room's flashcards (module 'drills'), opened in the game as its desk opens them.
test('15 Interview desk', async ({ page }) => {
  await newPlayer(page);
  await page.evaluate(() => {
    const s = window.__tapeoutGame!.story! as unknown as Story & { out: unknown[] };
    s.out.push({ t: 'overlay', kind: 'module', module: 'drills' });
    s.waiting = true;
  });
  const dialog = page.locator('.st-overlay:last-of-type [role="dialog"]');
  await expect(dialog).toBeVisible();
  await expectClean(page, 'Interview desk', '.st-overlay:last-of-type [role="dialog"]');
});

// 16. The ending card: the ENDING sequence runs, then its card. Key presses skip the steps once the minimum time passes.
test('16 Ending card', async ({ page }) => {
  await newPlayer(page);
  const last = await page.evaluate(() => window.__tapeoutGame!.story!.roomsFor('tapeout').length - 1);
  await warp(page, 'tapeout', last);
  const card = page.getByTestId('story-card');
  // press only while no card shows: a press on the card itself would close it
  await expect.poll(async () => { if (await card.isVisible()) return true; await page.keyboard.press('Space'); return false; }, { timeout: 120000, intervals: [500] }).toBe(true);
  await expectClean(page, 'Ending card', '[data-testid="story-card"]');
});

// 17. The Classic Desktop: reached from the pause menu, as in browser.e2e.ts.
test('17 Classic Desktop', async ({ page }) => {
  await newPlayer(page);
  const menu = await pause(page);
  await menu.getByRole('button', { name: 'Classic desktop' }).click();
  await expect(page.getByTestId('game')).toHaveCount(0);
  await expect(page.getByTestId('story-preview')).toBeVisible();
  await expectClean(page, 'Classic Desktop', 'body');
});

// Manual check "Dialogs" (spec section 3), kept as a test: Tab never leaves an open dialog, and every stop shows a ring.
test('Dialogs keep focus: Tab wraps inside the Accessibility panel, and each stop shows a ring', async ({ page }) => {
  await newPlayer(page);
  const menu = await pause(page);
  await menu.getByRole('button', { name: 'Accessibility' }).click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      const cs = e ? getComputedStyle(e) : null;
      return { inside: !!e?.closest('[role="dialog"][aria-label="Paused"]'), ring: !!cs && (cs.outlineStyle !== 'none' || cs.boxShadow !== 'none') };
    });
    expect(stop).toEqual({ inside: true, ring: true });
  }
});

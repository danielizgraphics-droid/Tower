// Touch placement QA: drag a tower from the build bar, tap-to-ghost + drag + confirm, desktop mouse drag.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const URL = 'http://localhost:5173/?screen=game&biome=' + (process.env.BIOME ?? 'meadow') + '&seed=12345';

async function touchDrag(cdp, from, to, steps = 12, release = true) {
  const pt = (p) => [{ x: p.x, y: p.y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }),
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const state = (page) =>
  page.evaluate(() => ({
    towers: window.__game.game.towers.map((t) => `${t.def?.id ?? t.id}@${t.x},${t.y}`),
    ghost: window.__game.renderer.view.ghost,
  }));

for (const [name, vp] of [
  ['portrait', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__game.game.gold = 2000));
  const cdp = await ctx.newCDPSession(page);
  const card = await page.locator('.tcard:not(.locked)').first().boundingBox();
  const start = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
  // 1) Drag from card onto the map, hold (screenshot), release.
  const target = await page.evaluate(() => {
    const g = window.__game;
    const b = g.game.board;
    for (let y = 2; y < b.height; y++)
      for (let x = 3; x < b.width; x++) if (g.game.canBuildAt(x, y) && b.isWalkable(x, y + 1)) return g.renderer.toScreen(x + 0.5, y + 0.5, 0.18);
  });
  await touchDrag(cdp, start, { x: target.x, y: target.y + 72 }, 14, false);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `screenshots/p-${name}-1-dragging.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  console.log(name, 'after card drag', JSON.stringify(await state(page)));
  // 2) Tap a card: ghost appears with confirm buttons.
  await page.tap('.tcard:not(.locked) >> nth=1');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/p-${name}-2-ghost.png` });
  console.log(name, 'after card tap', JSON.stringify(await state(page)));
  // 3) Drag the ghost a few cells, then confirm.
  const gpos = await page.evaluate(() => {
    const gh = window.__game.renderer.view.ghost;
    return window.__game.renderer.toScreen(gh.x + 0.5, gh.y + 0.5, 0.6);
  });
  await touchDrag(cdp, gpos, { x: gpos.x + 90, y: gpos.y - 40 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/p-${name}-3-moved.png` });
  console.log(name, 'after ghost drag', JSON.stringify(await state(page)));
  if (await page.locator('.pc-btn.ok').isVisible()) await page.tap('.pc-btn.ok');
  await page.waitForTimeout(300);
  console.log(name, 'after confirm', JSON.stringify(await state(page)));
  await page.screenshot({ path: `screenshots/p-${name}-4-built.png` });
  // 4) Horizontal swipe on the bar should scroll, not drag.
  await touchDrag(cdp, start, { x: start.x - 150, y: start.y });
  await page.waitForTimeout(200);
  console.log(name, 'after bar swipe', JSON.stringify(await state(page)), await page.evaluate(() => document.querySelector('.build-bar').scrollLeft));
  if (errors.length) console.log(name, 'ERRORS:\n' + errors.join('\n'));
  await ctx.close();
}

// Desktop mouse drag from card.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__game.game.gold = 2000));
  const card = await page.locator('.tcard:not(.locked)').first().boundingBox();
  const t = await page.evaluate(() => {
    const g = window.__game;
    const b = g.game.board;
    for (let y = 3; y < b.height; y++)
      for (let x = 4; x < b.width; x++) if (g.game.canBuildAt(x, y) && b.isWalkable(x + 1, y)) return g.renderer.toScreen(x + 0.5, y + 0.5, 0.18);
  });
  await page.mouse.move(card.x + 30, card.y + 30);
  await page.mouse.down();
  await page.mouse.move(t.x, t.y, { steps: 15 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `screenshots/p-desktop-dragging.png` });
  await page.mouse.up();
  await page.waitForTimeout(200);
  console.log('desktop', JSON.stringify(await state(page)));
  await ctx.close();
}
await browser.close();

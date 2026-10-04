import { chromium, devices } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [name, vp] of [
  ['portrait', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const screen of ['menu', 'game', 'talents', 'maps']) {
    await page.goto(`http://localhost:5173/?screen=${screen}`);
    await page.waitForTimeout(1500);
    if (screen === 'game') {
      // Tap archer card then tap a tile twice, then select it.
      await page.evaluate(() => {
        window.__game.game.gold = 2000;
      });
      await page.tap('.tcard:not(.locked)');
      const [x, y] = await page.evaluate(() => {
        const p = window.__game.renderer.toScreen(6.5, 2.5, 0.22);
        return [p.x, p.y];
      });
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(200);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(300);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `screenshots/m-${name}-${screen}.png` });
  }
  if (errors.length) console.log(name, 'ERRORS:\n' + errors.join('\n'));
  await ctx.close();
}
await browser.close();

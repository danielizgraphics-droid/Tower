// Screenshots of the menu screens on desktop and phone (screenshots/s-*.png).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [name, vp, mobile] of [
  ['desk', { width: 1440, height: 900 }, false],
  ['phone', { width: 390, height: 844 }, true],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  for (const screen of ['maps', 'codex', 'talents']) {
    await page.goto(`http://localhost:5173/?screen=${screen}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `screenshots/s-${name}-${screen}.png` });
  }
  await ctx.close();
}
await browser.close();

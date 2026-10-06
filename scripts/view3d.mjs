// Default 3D view on desktop and phone (screenshots/view-*.png).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [name, vp, mobile] of [
  ['desk', { width: 1440, height: 900 }, false],
  ['phone', { width: 844, height: 390 }, true],
  ['portrait', { width: 390, height: 844 }, true],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.goto(`http://localhost:5173/?screen=game&biome=${process.env.BIOME ?? 'meadow'}&seed=4242`);
  await page.waitForTimeout(10000);
  await page.evaluate(() => {
    document.querySelector('.hint')?.remove();
    const g = window.__game.game;
    for (const [i, id] of ['knight', 'wolf', 'bat', 'goblin', 'slime', 'orc'].entries()) g.spawnEnemy(id, 1, 2 + i * 1.2).age = 3;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `screenshots/view-${name}.png` });
  await ctx.close();
}
await browser.close();

// UI screenshots on desktop and phone (screenshots/ui-*.png).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const only = process.argv[2];
for (const [name, vp, mobile] of [
  ['desk', { width: 1440, height: 900 }, false],
  ['phone', { width: 390, height: 844 }, true],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  const shot = (s) => page.screenshot({ path: `screenshots/ui-${name}-${s}.png` });
  for (const screen of ['menu', 'maps', 'talents', 'codex']) {
    if (only && only !== screen) continue;
    await page.goto(`http://localhost:5173/?screen=${screen}`);
    await page.waitForTimeout(screen === 'menu' ? 9000 : 6000);
    await shot(screen);
  }
  if (!only || only === 'game') {
    await page.goto('http://localhost:5173/?screen=game&biome=meadow&seed=4242');
    await page.waitForTimeout(9000);
    await page.evaluate(() => {
      document.querySelector('.hint')?.remove();
      const { game } = window.__game;
      game.gold = 3000;
      for (let y = 0; y < game.board.height; y++)
        for (let x = 0; x < game.board.width; x++)
          if (game.board.isBuildable(x, y) && game.towers.length < 3) game.build(['archer', 'cannon', 'arcane'][game.towers.length], x, y);
      window.__game.select?.(game.towers[1]);
    });
    await page.waitForTimeout(1500);
    await shot('game');
    await page.evaluate(() => window.__game.game.setPhase('victory'));
    await page.waitForTimeout(1500);
    await shot('results');
  }
  await ctx.close();
}
await browser.close();

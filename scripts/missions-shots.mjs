// Screenshots of the missions feature: screens/missions-*.png
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const shot = async (name, url, vp, fn) => {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, ...(vp.width < 600 ? { hasTouch: true, isMobile: true } : {}) });
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.addInitScript(() => {
    const save = JSON.parse(localStorage.getItem('bastion-arcano.save') ?? 'null');
    if (!save)
      localStorage.setItem(
        'bastion-arcano.save',
        JSON.stringify({ tutorialDone: true, stars: 40, missions: { archers: { done: true } }, regions: [] }),
      );
  });
  await page.goto(url);
  await page.waitForTimeout(4000);
  if (fn) await fn(page);
  await page.screenshot({ path: `screenshots/missions-${name}.png` });
  await page.close();
};
await shot('list', 'http://localhost:5173/?screen=missions', { width: 1280, height: 800 });
await shot('list-phone', 'http://localhost:5173/?screen=missions', { width: 390, height: 844 });
await shot('menu', 'http://localhost:5173/', { width: 1280, height: 800 });
await shot('game', 'http://localhost:5173/?screen=game&biome=meadow&seed=2203&mission=few', { width: 1280, height: 800 }, async (p) =>
  p.waitForTimeout(4000),
);
await shot(
  'win',
  'http://localhost:5173/?screen=game&biome=autumn&seed=3307&difficulty=easy&mission=nomagic',
  { width: 1280, height: 800 },
  async (p) => {
    await p.evaluate(() => {
      const g = window.__game.game;
      g.wavesCleared = g.totalWaves;
      g.setPhase('victory');
    });
    await p.waitForTimeout(2500);
  },
);
await browser.close();

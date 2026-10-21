// Screenshots of expert mode: screenshots/expert-*.png  (node scripts/expert-shots.mjs [ids])
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const shot = async (name, url, vp, fn) => {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, ...(vp.width < 600 ? { hasTouch: true, isMobile: true } : {}) });
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      'bastion-arcano.save',
      JSON.stringify({
        epoch: 2,
        tutorialDone: true,
        stars: 40,
        maps: { meadow: { bestWave: 22, cleared: {} } },
        towers: { harbor: { unlocked: true, xp: 0, talents: {} } },
      }),
    );
  });
  await page.goto(url);
  await page.waitForTimeout(5000);
  if (fn) await fn(page);
  await page.screenshot({ path: `screenshots/expert-${name}.png` });
  await page.close();
};
const only = process.argv[2]?.split(',');
const maps = {
  'x-crossroads': 'meadow',
  'x-forks': 'autumn',
  'x-sky': 'sky',
  'x-sea': 'coast',
  'x-three': 'canyon',
  'x-ash': 'volcano',
  'x-frost': 'snow',
  'x-chaos': 'dusk',
};
if (!only || only.includes('menu')) {
  await shot('menu', 'http://localhost:5173/', { width: 1280, height: 800 });
  await shot('screen', 'http://localhost:5173/?screen=expert', { width: 1280, height: 800 });
  await shot('screen-phone', 'http://localhost:5173/?screen=expert', { width: 390, height: 844 });
}
for (const [id, biome] of Object.entries(maps)) {
  if (only && !only.includes(id)) continue;
  await shot(id, `http://localhost:5173/?screen=game&biome=${biome}&seed=1&difficulty=hard&expert=${id}`, { width: 1280, height: 800 }, async (p) => {
    await p.evaluate(() => {
      const g = window.__game.game;
      g.speed = 3;
      g.startNextWave();
    });
    await p.waitForTimeout(6000);
  });
}
await browser.close();

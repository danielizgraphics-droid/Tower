// Screenshots of the Torre infinita: screenshots/climb-*.png
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const save = {
  epoch: 2,
  tutorialDone: true,
  stars: 40,
  maps: { meadow: { bestWave: 22, cleared: {} } },
  towers: { cannon: { unlocked: true, xp: 0, talents: {} }, arcane: { unlocked: true, xp: 0, talents: {} } },
  climb: { best: 7, runs: 3, nick: 'Daniel' },
};
const shot = async (name, url, vp, fn, climb) => {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, ...(vp.width < 600 ? { hasTouch: true, isMobile: true } : {}) });
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.addInitScript(
    ([s, c]) => {
      localStorage.setItem('bastion-arcano.save', JSON.stringify(s));
      if (c) localStorage.setItem('bastion-arcano.climb', JSON.stringify(c));
      else localStorage.removeItem('bastion-arcano.climb');
    },
    [save, climb],
  );
  await page.goto(url);
  await page.waitForTimeout(4500);
  if (fn) await fn(page);
  await page.screenshot({ path: `screenshots/climb-${name}.png` });
  await page.close();
};
const run = { v: 1, epoch: 2, seed: 99, floor: 4, lives: 15, blessings: ['sharp', 'embers'], towers: ['archer', 'cannon', 'arcane'], goldBonus: 60, kills: 120, offer: null };
await shot('menu', 'http://localhost:5173/', { width: 1280, height: 800 });
await shot('screen', 'http://localhost:5173/?screen=climb', { width: 1280, height: 800 });
await shot('screen-run', 'http://localhost:5173/?screen=climb', { width: 1280, height: 800 }, null, run);
await shot('screen-phone', 'http://localhost:5173/?screen=climb', { width: 390, height: 844 }, null, run);
await shot(
  'floor',
  'http://localhost:5173/?screen=game&climb=1',
  { width: 1280, height: 800 },
  async (p) => {
    await p.evaluate(() => window.__game.game.startNextWave());
    await p.waitForTimeout(3000);
  },
  run,
);
await shot(
  'won',
  'http://localhost:5173/?screen=game&climb=1',
  { width: 1280, height: 800 },
  async (p) => {
    await p.evaluate(() => {
      const g = window.__game.game;
      g.wavesCleared = g.totalWaves;
      g.setPhase('victory');
    });
    await p.waitForTimeout(2000);
  },
  run,
);
await shot(
  'lost',
  'http://localhost:5173/?screen=game&climb=1',
  { width: 1280, height: 800 },
  async (p) => {
    await p.evaluate(() => window.__game.game.setPhase('defeat'));
    await p.waitForTimeout(2500);
  },
  run,
);
await browser.close();

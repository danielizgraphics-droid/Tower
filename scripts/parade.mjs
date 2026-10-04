// Spawns every enemy type along the path and screenshots the battlefield (screenshots/parade-*.png).
import { chromium } from 'playwright-core';
const biome = process.env.BIOME ?? 'meadow';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://localhost:5173/?screen=game&biome=${biome}&seed=777`);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { game } = window.__game;
  const ids = Object.keys(window.__enemies ?? {});
  const list = ids.length
    ? ids
    : [
        'goblin',
        'bandit',
        'wolf',
        'bat',
        'knight',
        'slime',
        'runeguard',
        'shaman',
        'troll',
        'skeleton',
        'golem',
        'wraith',
        'wyvern',
        'spider',
        'orc',
        'necromancer',
        'harpy',
        'ram',
        'imp',
        'scorpion',
        'mummy',
        'triton',
        'yeti',
        'salamander',
        'witch',
        'warlord',
        'lich',
        'dragon',
        'hydra',
        'colossus',
        'scorpionKing',
      ];
  list.forEach((id, i) => {
    const e = game.spawnEnemy(id, 1, 1.5 + i * 1.05);
    e.age = 5;
  });
  game.update(0.016);
  game.paused = true;
});
await page.waitForTimeout(400);
await page.screenshot({ path: `screenshots/parade-${biome}.png` });
if (process.env.ZOOM) {
  await page.evaluate(() => window.__game.renderer.setZoom(2.4, 720, 450));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screenshots/parade-${biome}-zoom.png` });
}
await browser.close();

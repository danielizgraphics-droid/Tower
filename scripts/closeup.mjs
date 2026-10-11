// Close-up of rigged characters walking (checks merged meshes / gear). Usage: node scripts/closeup.mjs out.png
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'screenshots/closeup.png';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:5173/?screen=game&biome=meadow&seed=4242');
await page.waitForTimeout(6000);
await page.evaluate(() => {
  const { game } = window.__game;
  document.querySelector('.hint')?.remove();
  const ids = (window.__ids = ['goblin', 'bandit', 'knight', 'shaman', 'witch', 'orc', 'skeleton', 'necromancer', 'mummy', 'bat', 'dragon', 'harpy']);
  ids.forEach((id, i) => {
    const e = game.spawnEnemy(id, 1, 1 + i * 0.7);
    e.age = 3;
    e.hp = e.maxHp = 1e9;
  });
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const { game, renderer } = window.__game;
  game.speed = 0;
  const e = game.enemies[5];
  const p = renderer.toScreen(e.x, e.y, 0);
  renderer.setZoom(5, p.x, p.y);
});
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();

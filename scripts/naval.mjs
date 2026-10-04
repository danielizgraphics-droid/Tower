// Builds naval towers (all branches) on a coast map and screenshots them (screenshots/naval*.png).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:5173/?screen=game&biome=coast&seed=4242');
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const { game } = window.__game;
  game.gold = 99999;
  if (!game.unlockedTowers.includes('tide')) game.unlockedTowers.push('tide');
  const b = game.board;
  const spots = [];
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (game.canBuildAt(x, y, 'harbor')) spots.push({ x, y, near: [-1, 0, 1].some((d) => b.isWalkable(x + d, y) || b.isWalkable(x, y + d)) });
  spots.sort((a, b) => Number(b.near) - Number(a.near));
  const plan = [
    ['harbor', -1, 1],
    ['harbor', 0, 5],
    ['harbor', 1, 5],
    ['harbor', 2, 5],
    ['tide', -1, 2],
    ['tide', 0, 5],
    ['tide', 1, 5],
    ['tide', 2, 5],
  ];
  const built = [];
  plan.forEach(([id, br, tier], i) => {
    const sp = spots[i * 2] ?? spots[i];
    if (!sp) return;
    const t = game.build(id, sp.x, sp.y);
    if (!t) return;
    while (t.tier < tier) game.upgrade(t, br < 0 ? -1 : br);
    built.push(`${id}/${br}/${t.tier}@${sp.x},${sp.y}`);
  });
  for (const id of ['goblin', 'triton', 'knight', 'wolf', 'orc']) for (let i = 0; i < 3; i++) game.spawnEnemy(id, 1, 2 + Math.random() * 20);
  game.startNextWave?.();
  return built;
});
console.log(info.join('\n'));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/naval.png' });
await browser.close();

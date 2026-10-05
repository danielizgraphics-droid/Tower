// 3D renderer QA: battle screenshot with ?r=3d (screenshots/3d-*.png).
import { chromium } from 'playwright-core';
const biome = process.env.BIOME ?? 'meadow';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(m.type(), m.text().slice(0, 200)));
await page.goto(`http://localhost:5173/?screen=game&biome=${biome}&seed=4242&r=3d`);
await page.waitForTimeout(9000);
await page.evaluate(() => {
  const { game } = window.__game;
  document.querySelector('.hint')?.remove();
  const ids = ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk'];
  game.unlockedTowers.push(...ids.filter((i) => !game.unlockedTowers.includes(i)));
  game.gold = 1e6;
  const b = game.board;
  const spots = [];
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (
        game.canBuildAt(x, y) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))
      )
        spots.push([x, y]);
  spots.slice(0, 14).forEach(([x, y], i) => {
    const t = game.build(ids[(i * 3) % 10], x, y);
    if (t) for (let k = 0; k < i % 5; k++) game.upgrade(t, i % 3);
  });
  for (const [i, id] of [
    'knight',
    'goblin',
    'bandit',
    'skeleton',
    'orc',
    'shaman',
    'runeguard',
    'warlord',
    'necromancer',
    'troll',
    'witch',
    'mummy',
  ].entries())
    game.spawnEnemy(id, 1, 1.5 + i * 1.6).age = 3;
});
await page.waitForTimeout(3000);
await page.screenshot({ path: `screenshots/3d-${biome}.png` });
await page.evaluate(() => {
  const r = window.__game.renderer;
  const t = window.__game.game.towers[3];
  const p = r.toScreen(t.x, t.y, 0);
  r.setZoom(2.4, p.x, p.y);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `screenshots/3d-${biome}-zoom.png` });
await browser.close();

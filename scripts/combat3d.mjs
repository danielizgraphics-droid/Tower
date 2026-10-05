// 3D combat QA: monsters + towers firing, screenshots over time (screenshots/c3d-*.png).
import { chromium } from 'playwright-core';
const biome = process.env.BIOME ?? 'meadow';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.log('console', m.text().slice(0, 200)));
await page.goto(`http://localhost:5173/?screen=game&biome=${biome}&seed=4242`);
await page.waitForTimeout(9000);
await page.evaluate((list) => {
  const { game, renderer } = window.__game;
  document.querySelector('.hint')?.remove();
  const ids = ['archer', 'cannon', 'ballista', 'arcane', 'archer', 'storm', 'frost', 'cannon', 'sanctum', 'obelisk', 'alchemist', 'pyre'];
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
  const pick = spots.filter((_, i) => i % 3 === 0).slice(0, 12);
  pick.forEach(([x, y], i) => {
    const t = game.build(ids[i], x, y);
    if (t) for (let k = 0; k < (i % 3) + 1; k++) game.upgrade(t, i % 3);
  });
  list.split(',').forEach((id, i) => (game.spawnEnemy(id, 3, 2 + i * 1.3).age = 3));
  const p = renderer.toScreen(pick[2][0], pick[2][1], 0);
  renderer.setZoom(2.2, p.x, p.y);
}, process.env.ENEMIES ?? 'bat,wolf,slime,spider,troll,golem,wraith,harpy,imp,wyvern,yeti,scorpion,salamander,triton,ram,hydra,dragon,colossus,knight,goblin');
for (const t of [1500, 1500, 1500]) {
  await page.waitForTimeout(t);
  await page.screenshot({ path: `screenshots/c3d-${biome}-${t}-${Date.now() % 1000}.png` });
}
await browser.close();

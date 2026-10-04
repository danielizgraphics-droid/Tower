// Mid-battle close-up for visual QA.
import { chromium } from 'playwright-core';
const [out = 'screenshots/battle.png', zoom = '2', fx = '0.5', fy = '0.5', wave = '12'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/?screen=game&biome=' + (process.argv[8] ?? 'meadow') + '&seed=4242&t=' + (process.argv[7] ?? '22'));
await page.waitForTimeout(600);
await page.evaluate(
  ([zoom, fx, fy, wave]) => {
    const { game, renderer } = window.__game;
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
    spots.sort(() => 0.5 - ((spots.length * 7919) % 13) / 13);
    spots.splice(16);
    spots.forEach(([x, y], i) => {
      const t = game.build(ids[(i * 3) % 10], x, y);
      if (t) for (let k = 0; k < i % 5; k++) game.upgrade(t, i % 3);
    });
    document.querySelector('.hint')?.remove();
    game.wave = Number(wave) - 1;
    game.startNextWave();
    for (let s = 0; s < 60 * Number(new URLSearchParams(location.search).get('t') ?? 22); s++) game.step(1 / 60);
    renderer.setZoom(Number(zoom), innerWidth * Number(fx), innerHeight * Number(fy));
  },
  [zoom, fx, fy, wave],
);
await page.waitForTimeout(700);
await page.evaluate(() => {
  window.__game.game.paused = true;
});
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();

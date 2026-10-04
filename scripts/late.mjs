// Late-game stress scene: many specialised towers, a big wave. Measures render cost.
import { chromium } from 'playwright-core';
const [out = 'screenshots/late.png', w = '1600', h = '900', zoom = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/?screen=game&map=meadow');
await page.waitForTimeout(600);
const res = await page.evaluate(async (zoom) => {
  const { game, renderer } = window.__game;
  const ids = ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk'];
  game.unlockedTowers.push(...ids.filter((i) => !game.unlockedTowers.includes(i)));
  game.gold = 1e6;
  const spots = [];
  const b = game.board;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) {
      if (!b.isBuildable(x, y)) continue;
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy));
      if (near) spots.push([x, y]);
    }
  let i = 0;
  for (const [x, y] of spots.slice(0, 34)) {
    const id = ids[i % ids.length];
    const t = game.build(id, x, y);
    const br = Math.floor(i / ids.length) % 3;
    for (let k = 0; k < 4; k++) game.upgrade(t, br);
    i++;
  }
  game.tutorialDone = true;
  game.wave = 21;
  game.startNextWave();
  for (let s = 0; s < 60 * 14; s++) game.step(1 / 60);
  if (zoom !== '1') renderer.setZoom(Number(zoom), innerWidth * 0.45, innerHeight * 0.5);
  // Measure render time
  const t0 = performance.now();
  let frames = 0;
  while (performance.now() - t0 < 1500) {
    game.step(1 / 60);
    renderer.render(1 / 60);
    frames++;
  }
  const ms = (performance.now() - t0) / frames;
  return {
    ms,
    enemies: game.enemies.length,
    towers: game.towers.length,
    projectiles: game.projectiles.length,
    particles: renderer.fx.particles.length,
  };
}, zoom);
console.log(JSON.stringify(res));
await page.evaluate(() => {
  const { game } = window.__game;
  game.paused = true;
});
await page.waitForTimeout(300);
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();

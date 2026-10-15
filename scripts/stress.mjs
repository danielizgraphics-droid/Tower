// Memory stress: a long heavy endless fight; prints JS heap and GPU resource counts over time.
// Usage: node scripts/stress.mjs [seconds]
import { chromium } from 'playwright-core';
const secs = +(process.argv[2] ?? 60);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript((churn) => (window.__churn = churn), !!process.env.CHURN);
await page.addInitScript(() => localStorage.setItem('bastion-arcano.save', JSON.stringify({ epoch: 2, tutorialDone: true })));
await page.goto('http://localhost:5173/?screen=game&biome=meadow&seed=1&endless=1');
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const { game } = window.__game;
  game.gold = 1e9;
  game.lives = 1e9;
  const ids = ['archer', 'cannon', 'arcane', 'frost', 'storm', 'alchemist', 'pyre', 'sanctum', 'obelisk', 'ballista', 'quake', 'falconer'];
  game.unlockedTowers.push(...ids);
  const b = game.board;
  let i = 0;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (
        i < 45 &&
        game.canBuildAt(x, y) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))
      ) {
        const t = game.build(ids[i % ids.length], x, y);
        if (t) for (let k = 0; k < 4; k++) game.upgrade(t, i % 3);
        i++;
      }
  game.wave = 40;
  // CHURN: enemies die almost at once (exercises model recycling).
  if (window.__churn) {
    const spawn = game.spawnEnemy.bind(game);
    game.spawnEnemy = (...a) => {
      const e = spawn(...a);
      e.hp = e.maxHp = 5;
      e.armor = e.maxArmor = 0;
      e.shield = e.maxShield = 0;
      return e;
    };
  }
  game.speed = 3;
  window.__spawn = setInterval(() => {
    if (game.canStartWave()) game.startNextWave();
  }, 2000);
});
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) {
  await page.waitForTimeout(5000);
  const m = await page.evaluate(() => {
    const pooled = window.__game.renderer.scene3d?.pooled;
    const { game, renderer } = window.__game;
    const s3 = renderer.scene3d;
    const info = s3?.renderer.info;
    let objs = 0;
    s3?.scene.traverse(() => objs++);
    return {
      t: Math.round(performance.now() / 1000),
      heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6),
      enemies: game.enemies.length,
      e3d: s3?.enemies.size,
      proj: game.projectiles.length,
      p3d: s3?.projectiles.size,
      fx: renderer.fx.particles?.length,
      texts: renderer.fx.texts?.length,
      geos: info?.memory.geometries,
      tex: info?.memory.textures,
      objs,
      wave: game.wave,
      pooled,
      kills: game.kills,
    };
  });
  console.log(JSON.stringify(m));
}
await browser.close();

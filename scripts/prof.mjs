import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5173/?screen=game&biome=meadow&seed=1');
await page.waitForTimeout(600);
const res = await page.evaluate(() => {
  const { game, renderer } = window.__game;
  const ids = ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk'];
  game.unlockedTowers.push(...ids.filter((i) => !game.unlockedTowers.includes(i)));
  game.gold = 1e6;
  const b = game.board;
  let i = 0;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) {
      if (!b.isBuildable(x, y) || i >= 34) continue;
      if (
        ![
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))
      )
        continue;
      const t = game.build(ids[i % 10], x, y);
      for (let k = 0; k < 4; k++) game.upgrade(t, i % 3);
      i++;
    }
  const time = (label, fn) => {
    const t0 = performance.now();
    let n = 0;
    while (performance.now() - t0 < 800) {
      fn();
      n++;
    }
    return label + ':' + ((performance.now() - t0) / n).toFixed(2);
  };
  const out = [];
  const cvs = document.querySelectorAll('canvas.stage');
  const cv = cvs[cvs.length - 1];
  const cx2 = cv.getContext('2d');
  const flush = () => cx2.getImageData(0, 0, 1, 1);
  // Warm sprite caches first so steady-state cost is measured.
  for (let i = 0; i < 30; i++) renderer.render(1 / 60);
  out.push(
    time('render', () => {
      renderer.render(1 / 60);
      flush();
    }),
  );
  const towers = game.towers;
  game.towers = [];
  out.push(
    time('noTowers', () => {
      renderer.render(1 / 60);
      flush();
    }),
  );
  game.towers = towers;
  out.push(time('step', () => game.step(1 / 60)));
  return out.join(' ');
});
console.log(res);
await browser.close();
const page2 = await (
  await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
).newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page2.goto('http://localhost:5173/?screen=game&biome=meadow&seed=1');
await page2.waitForTimeout(600);
console.log(
  await page2.evaluate(() => {
    const { game, renderer } = window.__game;
    const cvs = document.querySelectorAll('canvas.stage');
    const cx2 = cvs[cvs.length - 1].getContext('2d');
    const ids = ['goblin', 'bandit', 'wolf', 'knight', 'runeguard', 'bat', 'troll', 'slime', 'shaman', 'golem', 'skeleton', 'wraith', 'wyvern'];
    for (let i = 0; i < 120; i++) {
      const e = game.spawnEnemy(ids[i % ids.length], 15, i * 0.4);
    }
    for (let s = 0; s < 30; s++) game.step(1 / 60);
    const t0 = performance.now();
    let n = 0;
    while (performance.now() - t0 < 1000) {
      renderer.render(1 / 60);
      cx2.getImageData(0, 0, 1, 1);
      n++;
    }
    return '120 enemies render: ' + ((performance.now() - t0) / n).toFixed(2) + 'ms';
  }),
);
process.exit(0);

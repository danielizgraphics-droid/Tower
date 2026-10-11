// Late endless stress: ~40 upgraded towers and a big wave. Prints frame cost split
// and renderer counters. Usage: node scripts/perf.mjs [enemies]
import { chromium } from 'playwright-core';
const n = +(process.argv[2] ?? 150);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: process.env.MOBILE ? { width: 844, height: 390 } : { width: 900, height: 600 },
  deviceScaleFactor: 1,
  ...(process.env.MOBILE ? { hasTouch: true, isMobile: true } : {}),
});
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript((z) => (window.__zoom = z), process.env.ZOOM ?? '1');
await page.goto('http://localhost:5173/?screen=game&map=meadow');
await page.waitForTimeout(4000);
const res = await page.evaluate(async (n) => {
  const { game, renderer } = window.__game;
  const ids = ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk', 'quake', 'falconer'];
  game.unlockedTowers.push(...ids.filter((i) => !game.unlockedTowers.includes(i)));
  game.gold = 1e9;
  game.lives = 1e9;
  const b = game.board;
  let i = 0;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) {
      if (!b.isBuildable(x, y) || i >= 40) continue;
      if (
        ![
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))
      )
        continue;
      const t = game.build(ids[i % ids.length], x, y);
      if (t) for (let k = 0; k < 4; k++) game.upgrade(t, i % 3);
      i++;
    }
  const kinds = ['goblin', 'bandit', 'wolf', 'knight', 'bat', 'troll', 'slime', 'shaman', 'golem', 'skeleton', 'wraith', 'wyvern'];
  for (let k = 0; k < n; k++) {
    const e = game.spawnEnemy(kinds[k % kinds.length], 60, (k / n) * (b.length - 2));
    e.hp = e.maxHp = 1e12;
  }
  // let models load / warm up
  for (let f = 0; f < 30; f++) {
    game.step(1 / 60);
    renderer.render(1 / 60);
    await new Promise((r) => setTimeout(r, 5));
  }
  if (+(window.__zoom ?? 1) !== 1) renderer.setZoom(+window.__zoom, innerWidth / 2, innerHeight / 2);
  for (let f = 0; f < 3; f++) renderer.render(1 / 60);
  const s3 = renderer.scene3d;
  const gl = s3.renderer;
  const orig = s3.render.bind(s3);
  let t3 = 0;
  s3.render = (dt) => {
    const a = performance.now();
    orig(dt);
    gl.getContext().finish();
    t3 += performance.now() - a;
  };
  let tSim = 0,
    tAll = 0,
    frames = 0;
  const t0 = performance.now();
  while (frames < 8) {
    const a = performance.now();
    game.step(1 / 60);
    tSim += performance.now() - a;
    renderer.render(1 / 60);
    tAll += performance.now() - a;
    frames++;
  }
  const info = gl.info;
  const full = { calls: info.render.calls, tris: info.render.triangles };
  gl.shadowMap.autoUpdate = false;
  renderer.render(1 / 60);
  const noShadow = { calls: info.render.calls, tris: info.render.triangles };
  gl.shadowMap.autoUpdate = true;
  let objs = 0,
    skinned = 0,
    casters = 0;
  s3.scene.traverse((o) => {
    if (o.isMesh && o.visible) {
      objs++;
      if (o.isSkinnedMesh) skinned++;
      if (o.castShadow) casters++;
    }
  });
  return {
    frames,
    enemies: game.enemies.length,
    sim: (tSim / frames).toFixed(2),
    total: (tAll / frames).toFixed(2),
    gl3d: (t3 / frames).toFixed(2),
    full,
    noShadow,
    programs: info.programs.length,
    geos: info.memory.geometries,
    tex: info.memory.textures,
    meshes: objs,
    skinned,
    casters,
    fx: renderer.fx.particles?.length,
    groundMeshes: (() => {
      let n = 0;
      s3.ground?.traverse((o) => o.isMesh && n++);
      return n;
    })(),
    towerMeshes: (() => {
      let n = 0;
      for (const t of s3.towers.values()) t.root.traverse((o) => o.isMesh && o.visible && n++);
      return n;
    })(),
    towers: s3.towers.size,
    groundTris: (() => {
      let n = 0;
      s3.ground?.traverse((o) => o.isMesh && (n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3));
      return n;
    })(),
    towerTris: (() => {
      let n = 0;
      for (const t of s3.towers.values())
        t.root.traverse((o) => o.isMesh && o.visible && (n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3));
      return n;
    })(),
  };
}, n);
console.log(JSON.stringify(res));
await browser.close();

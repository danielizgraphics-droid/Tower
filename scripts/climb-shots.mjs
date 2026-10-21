// Screenshots of the Torre infinita: screenshots/climb-*.png
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const save = {
  epoch: 2,
  tutorialDone: true,
  stars: 40,
  maps: { meadow: { bestWave: 22, cleared: {} } },
  towers: {
    cannon: { unlocked: true, xp: 0, talents: {} },
    arcane: { unlocked: true, xp: 0, talents: {} },
    frost: { unlocked: true, xp: 0, talents: {} },
  },
  climb: { best: 12, runs: 3, nick: 'Daniel', total: 40, achievements: ['flawless', 'edge'] },
};
const base = {
  v: 2,
  epoch: 2,
  seed: 99,
  floor: 7,
  lives: 15,
  maxLives: 20,
  blessings: ['sharp', 'embers'],
  towers: ['archer', 'cannon', 'arcane'],
  goldBonus: 60,
  kills: 120,
  stage: 'ready',
  offer: null,
  picks: 0,
  doors: null,
  room: null,
  next: { mod: null, loot: false },
  stats: { flawless: 1, bestFlawless: 3, bosses: 1, recruits: 0, modFloors: 2, rooms: ['fountain'], pacts: 0, edge: false },
  startBest: 12,
};
const shot = async (name, url, vp, fn, climb) => {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, ...(vp.width < 600 ? { hasTouch: true, isMobile: true } : {}) });
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.addInitScript(
    ([s, c]) => {
      localStorage.setItem('bastion-arcano.save', JSON.stringify(s));
      if (c) localStorage.setItem('bastion-arcano.climb', JSON.stringify(c));
      else localStorage.removeItem('bastion-arcano.climb');
    },
    [save, climb],
  );
  await page.goto(url);
  await page.waitForTimeout(5000);
  if (fn) await fn(page);
  await page.screenshot({ path: `screenshots/climb-${name}.png` });
  await page.close();
};
const only = process.argv[2]?.split(',');
const want = (n) => !only || only.includes(n);
if (want('screen')) await shot('screen', 'http://localhost:5173/?screen=climb', { width: 1280, height: 900 });
if (want('doors'))
  await shot('doors', 'http://localhost:5173/?screen=climb', { width: 1280, height: 800 }, null, {
    ...base,
    stage: 'doors',
    doors: [
      { kind: 'battle', mod: null, loot: false },
      { kind: 'battle', mod: 'horde', loot: true },
    ],
  });
if (want('altar'))
  await shot('altar', 'http://localhost:5173/?screen=climb', { width: 1280, height: 800 }, null, {
    ...base,
    stage: 'room',
    room: {
      kind: 'altar',
      choices: [
        { cost: 5, reward: { kind: 'blessing', id: 'sharp' } },
        { cost: 3, reward: { kind: 'tower', tower: 'frost' } },
        { cost: 0, reward: null },
      ],
    },
  });
if (want('floor'))
  await shot(
    'floor',
    'http://localhost:5173/?screen=game&climb=1',
    { width: 1280, height: 800 },
    async (p) => {
      await p.evaluate(() => window.__game.game.startNextWave());
      await p.waitForTimeout(4000);
    },
    { ...base, floor: 9, next: { mod: 'horde', loot: true } },
  );
if (want('won'))
  await shot(
    'won',
    'http://localhost:5173/?screen=game&climb=1',
    { width: 1280, height: 800 },
    async (p) => {
      await p.evaluate(() => {
        const g = window.__game.game;
        g.wavesCleared = g.totalWaves;
        g.setPhase('victory');
      });
      await p.waitForTimeout(5000);
    },
    { ...base, floor: 12, next: { mod: 'elite', loot: true } },
  );
if (want('phone'))
  await shot('phone', 'http://localhost:5173/?screen=climb', { width: 390, height: 844 }, null, {
    ...base,
    stage: 'doors',
    doors: [
      { kind: 'battle', mod: 'fog', loot: true },
      { kind: 'room', room: 'treasure' },
    ],
  });
if (want('heroes')) await shot('heroes', 'http://localhost:5173/?screen=heroes', { width: 1280, height: 800 }, async (p) => p.mouse.wheel(0, 2000));
await browser.close();

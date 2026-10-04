import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/?screen=game&map=meadow');
await page.waitForTimeout(700);
await page.evaluate(() => {
  const { game } = window.__game;
  game.wavesCleared = 30;
  game.wave = 30;
  game.kills = 812;
  game.towerXp = { archer: 220, cannon: 130, arcane: 90 };
  game.setPhase('victory');
});
await page.waitForTimeout(1600);
await page.screenshot({ path: 'screenshots/results.png' });
// Talents with resources
await page.evaluate(() => {
  const a = window.__app;
  a.profile.stars = 23;
  a.profile.towers.archer.xp = 260;
  a.profile.general.treasury = 2;
  a.profile.general.walls = 1;
  a.go({ name: 'talents' });
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/talents-general.png' });
await page.click('.tab:nth-child(2)');
await page.waitForTimeout(500);
await page.click('.node.available');
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/talents-archer.png' });
// Pause modal
await page.evaluate(() => window.__app.go({ name: 'game', biome: 'autumn', seed: 77, difficulty: 'hard', endless: true }));
await page.waitForTimeout(900);
await page.keyboard.press('p');
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/pause.png' });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();

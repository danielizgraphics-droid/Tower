// Scripted play-through for visual QA. Usage: node scripts/play.mjs <outPrefix> [w] [h]
import { chromium } from 'playwright-core';
const [prefix = 'screenshots/play', w = '1600', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: false });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/?screen=game&map=meadow');
await page.waitForTimeout(800);
const tileXY = (x, y) => page.evaluate(([x, y]) => { const r = window.__game.renderer; const p = r.toScreen(x + 0.5, y + 0.5, 0.22); return [p.x, p.y]; }, [x, y]);
async function build(key, x, y) {
  await page.keyboard.press(key);
  const [sx, sy] = await tileXY(x, y);
  await page.mouse.move(sx, sy);
  await page.mouse.click(sx, sy);
}
await page.evaluate(() => { window.__game.game.gold = 5000; });
await build('1', 6, 2);
await build('2', 8, 6);
await build('3', 8, 2);
await build('4', 6, 8);
await build('1', 11, 2);
const [sx, sy] = await tileXY(6, 2);
await page.mouse.click(sx, sy);
await page.waitForTimeout(300);
await page.screenshot({ path: `${prefix}-1.png` });
// Upgrade twice to reach branch choice
await page.keyboard.press('u');
await page.waitForTimeout(100);
await page.keyboard.press('u');
await page.waitForTimeout(400);
await page.screenshot({ path: `${prefix}-2.png` });
await page.keyboard.press('Escape');
await page.keyboard.press('Space');
await page.evaluate(() => { window.__game.game.speed = 3; });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${prefix}-3.png` });
// Skip ahead to wave 5 augments
await page.evaluate(() => { const g = window.__game.game; for (let i = 0; i < 60 * 200 && g.phase !== 'augment'; i++) { if (g.phase === 'build') g.startNextWave(); g.step(1/60); } });
await page.waitForTimeout(800);
await page.screenshot({ path: `${prefix}-4.png` });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();

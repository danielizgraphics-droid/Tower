// Renders dev/models.html for a list of model paths: node scripts/models.mjs out.png path1,path2,...
import { chromium } from 'playwright-core';
const [out, list] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1250, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log(m.text().slice(0, 200)));
await page.goto(`http://localhost:5173/dev/models.html?list=${list}`);
await page.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();

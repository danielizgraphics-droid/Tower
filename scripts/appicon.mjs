// Renders the home-screen icons (dev/appicon.html) into public/: apple-touch-icon.png, icon-192.png, icon-512.png.
// Needs the dev server on :5173.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:5173/dev/appicon.html');
await page.waitForFunction(() => document.title === 'ready');
for (const [file, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  const url = await page.evaluate((s) => window.renderAppIcon(s), size);
  writeFileSync(`public/${file}`, Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
console.log('icons written');

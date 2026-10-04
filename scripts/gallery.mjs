// Renders dev/gallery.html to screenshots/gallery.png. Usage: node scripts/gallery.mjs [query]
import { chromium } from 'playwright-core';
const query = process.argv[2] ?? '';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://localhost:5173/dev/gallery.html?${query}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.OUT ?? 'screenshots/gallery.png', fullPage: true });
await browser.close();

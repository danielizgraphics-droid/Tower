// Enemy-only gallery screenshot: screenshots/enemies.png
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await page.goto('http://localhost:5173/dev/gallery.html');
await page.waitForTimeout(3000);
const el = await page.$('.row.e');
await el.screenshot({ path: 'screenshots/enemies.png' });
await browser.close();

// One 3D screenshot per biome (screenshots/b3d-<biome>.png).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const list = process.argv.slice(2).length ? process.argv.slice(2) : ['meadow', 'coast', 'autumn', 'desert', 'swamp', 'snow', 'volcano', 'dusk'];
for (const biome of list) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log(biome, 'ERR', e.message));
  await page.goto(`http://localhost:5173/?screen=game&biome=${biome}&seed=4242`);
  await page.waitForTimeout(12000);
  await page.evaluate(() => {
    document.querySelector('.hint')?.remove();
    window.__game.renderer.setZoom(1);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `screenshots/b3d-${biome}.png` });
  await page.close();
}
await browser.close();

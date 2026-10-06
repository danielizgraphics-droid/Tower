// Prepares a multi-file Artifact from dist/: page body + JS/CSS/fonts + only the models in use.
// Usage: npx vite build && npx vite-node scripts/used-models.ts > /tmp/models.txt && node scripts/artifact3d.mjs OUTDIR /tmp/models.txt
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const [out, listFile] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/(src|href)="\.\//g, '$1="');
const title = keep.match(/<title>[\s\S]*?<\/title>/)[0];
writeFileSync(join(out, 'index.html'), `${title}\n<script src="models.js"></script>\n${keep.replace(title, '').trim()}\n${body.trim()}\n`);
const files = {};
for (const f of readdirSync('dist/assets')) {
  if (f.endsWith('.woff')) continue;
  cpSync(join('dist/assets', f), join(out, 'assets', f));
  files[`assets/${f}`] = join(out, 'assets', f);
}
// Models travel as one base64 data script (Artifacts don't serve .glb files).
const models = {};
for (const m of readFileSync(listFile, 'utf8').split('\n').filter(Boolean)) models[m] = readFileSync(join('dist/models', m)).toString('base64');
// UI icons travel the same way.
const icons = {};
for (const f of readdirSync('dist/icons')) icons[f.replace(/\.webp$/, '')] = readFileSync(join('dist/icons', f)).toString('base64');
writeFileSync(join(out, 'models.js'), `window.__MODELS=${JSON.stringify(models)};window.__ICONS=${JSON.stringify(icons)};`);
files['models.js'] = join(out, 'models.js');
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 1));
console.log(Object.keys(files).length, 'files');

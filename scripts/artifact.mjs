// Converts the single-file build into an Artifact page body (no doctype/html/head/body tags).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head.replace(/<meta charset[^>]*>/i, '').replace(/<meta name="viewport"[^>]*>/i, '');
const titleMatch = keep.match(/<title>[\s\S]*?<\/title>/);
const rest = keep.replace(titleMatch[0], '');
writeFileSync('dist-single/artifact.html', `${titleMatch[0]}\n${rest.trim()}\n${body.trim()}\n`);
console.log('artifact.html', (readFileSync('dist-single/artifact.html').length / 1024).toFixed(0) + 'KB');

#!/usr/bin/env node
/* Собирает автономный staratel.html: инлайнит css/style.css и все js-файлы.
 * Запуск: node tools/build-single.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="css\/style\.css">\s*/,
  '<style>\n/* inlined: css/style.css */\n' + readFileSync(join(ROOT, 'css/style.css'), 'utf8') + '\n</style>\n');

const scriptRe = /<script src="(js\/[^"]+)"><\/script>\n?/g;
html = html.replace(scriptRe, (_, file) => {
  const code = readFileSync(join(ROOT, file), 'utf8');
  return '<script>\n/* inlined: ' + file + ' */\n' + code + '\n</script>\n';
});

if (/<script src=|<link rel="stylesheet"/.test(html)) {
  throw new Error('Остались внешние ссылки — сборка неполная');
}
const out = join(ROOT, 'staratel.html');
writeFileSync(out, html);
console.log('→', out, (html.length / 1024).toFixed(1) + ' KiB');

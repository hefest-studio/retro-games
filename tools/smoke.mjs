#!/usr/bin/env node
// smoke.mjs — быстрый смоук-тест всех игр аркады (без браузера).
// Для каждой игры: (1) index.html существует и содержит <canvas>;
// (2) ВЕСЬ JS (внешние js/*.js + инлайновые <script>) синтаксически валиден —
// компилируется через vm.Script (парс без выполнения), ловит SyntaxError,
// тот самый класс бага, что ронял игру в чёрный экран (апостроф в строке и т.п.).
// Запуск:  node tools/smoke.mjs      Код возврата 0 — всё чисто, 1 — есть провалы.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'index.html')))
  .map(d => d.name).sort();

let failed = 0, checkedJs = 0;
const rows = [];
for (const g of games) {
  const dir = path.join(ROOT, g);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const problems = [];
  if (!/<canvas[\s>]/i.test(html)) problems.push('нет <canvas>');

  // внешние скрипты
  const srcs = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)].map(m => m[1])
    .filter(s => !/^https?:/i.test(s));            // внешних URL быть не должно
  const ext = [...html.matchAll(/<script[^>]*\ssrc=["'](https?:[^"']+)["']/gi)];
  if (ext.length) problems.push('внешний src: ' + ext.map(m => m[1]).join(', '));

  for (const s of srcs) {
    const f = path.join(dir, s.replace(/^\.?\//, ''));
    if (!fs.existsSync(f)) { problems.push('нет файла ' + s); continue; }
    try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); checkedJs++; }
    catch (e) { problems.push(`${s}: ${e.message.split('\n')[0]}`); }
  }
  // инлайновые <script> без src (кроме не-JS типов: application/ld+json и т.п.)
  const inline = [...html.matchAll(/<script((?![^>]*\ssrc=)[^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => { const t = (/\stype=["']([^"']+)["']/i.exec(m[1]) || [])[1]; return !t || /(text|application)\/(java|ecma)script|module/i.test(t); })
    .map(m => m[2]);
  inline.forEach((code, i) => {
    if (!code.trim()) return;
    try { new vm.Script(code, { filename: `${g}/index.html#inline${i}` }); checkedJs++; }
    catch (e) { problems.push(`inline#${i}: ${e.message.split('\n')[0]}`); }
  });

  const ok = problems.length === 0;
  if (!ok) failed++;
  rows.push(`${ok ? 'PASS' : 'FAIL'}  ${g.padEnd(12)} ${problems.join(' | ')}`);
}

console.log(rows.join('\n'));
console.log(`\nИтого: игр ${games.length}, JS-блоков проверено ${checkedJs}, провалов ${failed}`);
process.exit(failed ? 1 : 0);

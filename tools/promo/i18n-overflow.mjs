#!/usr/bin/env node
/* tools/promo/i18n-overflow.mjs — проверка «тексты не вылезают за холст» на всех языках игры (RU/EN/TR/ES/PT), телефон портрет 390×844
   и ландшафт 844×390 (тач, DPR 2). Дополняет _shared/tests/platform-builds.browser.mjs (там — только сцены движка: меню, пауза,
   финалы, лидеры): здесь проба fillText на главном canvas ловит строки ЛЮБОЙ сцены — заставка, игра (HUD, подсказки, тосты),
   пауза, а также сцены, которые игра просит показать через window.__i18nScenes (необязательно).
   Сценарий на язык и экран: заставка 1,2 с → Enter (старт) → 2,5 с игры → P (пауза) → Esc/P → финал gameover → заставка.
   Ширина строки — measureText с учётом выравнивания и текущей матрицы; переполнение — край строки дальше 2 px за краем холста.
   Запуск: node tools/promo/i18n-overflow.mjs <slug> [slug …] [--port 8451] [--langs ru,en,tr,es,pt]
   Вывод: строка на игру (0 переполнений — ok) и список переполнений (язык, экран, сцена, строка, координаты). Код выхода 1 — есть. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2); let port = 8451, langs = ['ru', 'en', 'tr', 'es', 'pt']; const slugs = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--port') port = +args[++i]; else if (args[i] === '--langs') langs = args[++i].split(','); else slugs.push(args[i].replace(/\/+$/, '')); }
if (!slugs.length) { console.error('использование: node tools/promo/i18n-overflow.mjs <slug> [slug …] [--port 8451]'); process.exit(2); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const srv = http.createServer((q, s) => { let u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(ROOT, u); if (!f.startsWith(ROOT)) { s.writeHead(403); s.end(); return; }
  if (u.endsWith('/')) f = path.join(f, 'index.html'); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise((r) => srv.listen(port, '127.0.0.1', r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const probe = () => {
  window.__over = [];
  const ft = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (s, x, y, mw) {
    try { const c = this.canvas, g = window.Arcade && window.Arcade.last; if (g && c === g.canvas && String(s).trim()) {
      let w = this.measureText(String(s)).width; if (mw != null && w > mw) w = mw;
      const al = this.textAlign, t = this.getTransform(); const l = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x;
      const L = t.a * l + t.e, R = t.a * (l + w) + t.e;
      if (L < -2 || R > c.width + 2) { const k = (g._sceneName || '?') + '|' + s; if (!window.__over.some((o) => o.k === k)) window.__over.push({ k, scene: g._sceneName, s: String(s), L: Math.round(L), R: Math.round(R), W: c.width }); } } } catch (e) {}
    return ft.call(this, s, x, y, mw);
  };
};
const browser = await chromium.launch(); let bad = 0;
try {
  for (const slug of slugs) {
    const found = [], errs = [];
    for (const lang of langs) for (const [w, h] of [[390, 844], [844, 390]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await ctx.newPage();
      page.on('pageerror', (e) => errs.push(lang + ' ' + w + '×' + h + ': ' + e.message));
      await page.addInitScript(() => { try { localStorage.setItem('arcade.sound', '0'); } catch (e) {} });
      await page.addInitScript(probe);
      await page.goto(`http://127.0.0.1:${port}/${slug}/?lang=${lang}`); await wait(1200);
      await page.keyboard.press('Enter'); await wait(2500);
      await page.keyboard.press('KeyP'); await wait(400);
      await page.evaluate(() => { const g = Arcade.last; try { g.goto('gameover'); } catch (e) {} }); await wait(300);
      await page.evaluate(() => { const g = Arcade.last; try { g.goto('title'); } catch (e) {} }); await wait(300);
      const extra = await page.evaluate(async () => { const g = Arcade.last, list = window.__i18nScenes || []; for (const sc of list) { try { g.goto(sc); } catch (e) {} await new Promise((r) => setTimeout(r, 250)); } return list.length; });
      const over = await page.evaluate(() => window.__over);
      over.forEach((o) => found.push(`${lang} ${w}×${h} [${o.scene}] «${o.s}» ${o.L}…${o.R} / ${o.W}`));
      await ctx.close();
    }
    if (found.length || errs.length) bad++;
    console.log((found.length || errs.length ? 'FAIL ' : 'ok   ') + slug + ': переполнений ' + found.length + ', ошибок страницы ' + errs.length);
    found.forEach((f) => console.log('     ' + f)); errs.slice(0, 5).forEach((e) => console.log('     ! ' + e));
  }
} finally { await browser.close(); srv.close(); }
process.exit(bad ? 1 : 0);

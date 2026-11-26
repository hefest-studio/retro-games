/* _shared/tests/touch-autopause.browser.mjs — браузерная проверка движка v2.10 (Playwright, Chromium headless).
   Запуск: node _shared/tests/touch-autopause.browser.mjs [slug …] [--shared] [--input 6]
     slug — игры (по умолчанию — 10 игр из QA-отчёта с «неотменяемым касанием» + skok);
     --shared — отдавать _shared/engine.js вместо <игра>/engine.js (до bash build.sh); --input — секунд случайных касаний.
   Свой статический сервер на свободном порту (корень — репо). Один браузер на весь прогон.
   Касания (телефон 390×844, isMobile+hasTouch): тап по «Играть»; для каждой тач-кнопки (button, [data-d], [data-act]) — тап на 3 px
   выше её края (Chrome шлёт такое касание НЕотменяемым: точка вне блокирующего обработчика, цель подбирает touch adjustment) и тап
   по центру; затем N с случайных касаний (кнопки 60 % / холст), как tools/qa-run.mjs. Ждём: 0 «Ignored attempt to cancel a touch…»
   в консоли, 0 вызовов preventDefault у неотменяемых касаний, 0 pageerror; у кнопок тач-дпада [data-d] — ровно одно нажатие на касание
   (эмуляция мыши второго не даёт); страница не прокрутилась и не зумится (scrollY = 0, visualViewport.scale = 1).
   Автопауза (десктоп 1280×720): сайт — blur окна паузу не ставит; скрытая вкладка в play → pause (g.awayPaused), видимая — экран паузы
   остаётся, Enter («Продолжить») → play; без сцены pause — заморозка цикла (g.time стоит), видимая — цикл идёт;
   «площадка» (в index.html подставлен ../_shared/platform.js → Platform web) — прежний путь: blur → пауза, скрытая вкладка → пауза. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const av = process.argv.slice(2), SHARED = av.includes('--shared');
const ii = av.indexOf('--input'), INPUT = ii >= 0 ? +av[ii + 1] : 6;
const DEF = ['dospeh', 'lednik', 'otsek', 'sborka', 'priisk', 'porubezhye', 'volok', 'otgon', 'poluustav', 'kamerton', 'skok'];
const SLUGS = av.filter((a, i) => !a.startsWith('--') && av[i - 1] !== '--input'); if (!SLUGS.length) SLUGS.push(...DEF);
const ENG = fs.readFileSync(path.join(ROOT, '_shared/engine.js'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const server = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, path.normalize(u)); if (!f.startsWith(ROOT)) { s.writeHead(403); return s.end(); }
  if (SHARED && /\/engine\.js$/.test(u) && !u.startsWith('/_shared/')) { s.writeHead(200, { 'content-type': TYPES['.js'] }); return s.end(ENG); }
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(b); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
async function test(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + String(e && e.message || e).split('\n')[0]); } }

const INSTR = () => {
  const S = window.__t = { bad: [], emits: 0 };
  const pd = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    if (!this.cancelable && /^touch/.test(this.type) && S.bad.length < 10) S.bad.push(this.type + ' ' + ((new Error().stack || '').split('\n')[2] || '').trim().replace(location.origin, ''));
    return pd.call(this);
  };
};
const scene = (p) => p.evaluate(() => window.Arcade && Arcade.last ? Arcade.last._sceneName : null).catch(() => null);
const browser = await chromium.launch();

for (const slug of SLUGS) {
  await test(`${slug}: касания — 0 предупреждений Chrome, preventDefault только у отменяемых, одно касание — одно нажатие, без прокрутки/зума`, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(), warn = [], perr = [];
    p.on('console', (m) => { if (/Ignored attempt to cancel a touch/.test(m.text())) warn.push(m.text().slice(0, 80)); });
    p.on('pageerror', (e) => perr.push(String(e.message).slice(0, 160)));
    await p.addInitScript(INSTR);
    try {
      await p.goto(`${BASE}/${slug}/`, { waitUntil: 'load' }); await sleep(1200);
      ok(await p.evaluate(() => Arcade.version) === '2.10.0', 'движок 2.10.0 (запусти bash build.sh или --shared)');
      const pt = await p.evaluate(() => { const g = Arcade.last, r = g.canvas.getBoundingClientRect(), m = g.current && g.current._menu; const it = m && m.items && (m.items.find((x) => x.key === 'play') || m.items[0]); return { x: r.left + r.width / 2, y: it && it._y != null ? r.top + (it._y - 6) * r.height / g.H : r.top + r.height / 2 }; });
      await p.touchscreen.tap(pt.x, pt.y); await sleep(700);
      for (let k = 0; k < 2; k++) { const sc = await scene(p); if (sc === 'play') break; await p.keyboard.press('Enter'); await sleep(400); }
      await p.evaluate(() => { const i = Arcade.last.input, o = i._emit; i._emit = function (a) { window.__t.emits++; return o.call(this, a); }; });
      const btns = await p.evaluate(() => [...document.querySelectorAll('button, [data-d], [data-act]')].map((el) => { const r = el.getBoundingClientRect(); return { d: el.getAttribute('data-d'), x: r.left + r.width / 2, top: r.top, y: r.top + r.height / 2, w: r.width, h: r.height }; })
        .filter((b) => b.w > 4 && b.h > 4 && b.top > 4 && b.top < innerHeight));
      const doubles = [];
      for (const b of btns) for (const y of [b.top - 3, b.y]) {
        const sc = await scene(p); if (sc !== 'play') { if (sc === 'pause') await p.evaluate(() => Arcade.last.goto('play', { resume: true })); else break; }
        const e0 = await p.evaluate(() => window.__t.emits);
        await p.touchscreen.tap(b.x, y); await sleep(120);
        const e1 = await p.evaluate(() => window.__t.emits);
        if (b.d && y === b.y && e1 - e0 > 1) doubles.push(`${b.d}: ${e1 - e0}`);
      }
      const cr = await p.evaluate(() => { const r = Arcade.last.canvas.getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(innerWidth, r.right) - Math.max(0, r.left), h: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) }; });
      let rnd = 12345 + slug.length * 7919; const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const end = Date.now() + INPUT * 1000;
      while (Date.now() < end) {
        const q = btns.length && rand() < 0.6 ? btns[Math.floor(rand() * btns.length)] : { x: cr.x + 10 + rand() * Math.max(1, cr.w - 20), y: cr.y + 10 + rand() * Math.max(1, cr.h - 20) };
        await p.touchscreen.tap(q.x, q.y).catch(() => {}); await sleep(40 + rand() * 120);
        if (!p.url().startsWith(`${BASE}/${slug}/`)) { await p.goBack().catch(() => {}); break; }
      }
      const st = await p.evaluate(() => ({ bad: window.__t.bad, sy: scrollY, sx: scrollX, scale: visualViewport ? visualViewport.scale : 1 }));
      ok(!warn.length, `предупреждений Chrome: ${warn.length}`);
      ok(!st.bad.length, 'preventDefault у неотменяемого касания: ' + st.bad.slice(0, 2).join(' | '));
      ok(!perr.length, 'pageerror: ' + perr.slice(0, 2).join(' | '));
      ok(!doubles.length, 'двойное нажатие от одного касания: ' + doubles.join(', '));
      ok(st.sy === 0 && Math.abs(st.scale - 1) < 0.01, `прокрутка/зум: scrollY=${st.sy}, scale=${st.scale}`);
    } finally { await ctx.close(); }
  });
}

// ---------- автопауза ----------
const AP = SLUGS.slice(0, 3);
async function startDesk(p, slug, url) {
  await p.goto(url || `${BASE}/${slug}/`, { waitUntil: 'load' }); await sleep(1200);
  await p.keyboard.press('Enter'); await sleep(600);
  for (let k = 0; k < 4; k++) { const sc = await scene(p); if (sc === 'play') break; await p.keyboard.press('Enter'); await sleep(500); }
  await sleep(500); return scene(p);
}
const hide = (p, h) => p.evaluate((h) => { if (h) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); } else { delete document.hidden; delete document.visibilityState; } document.dispatchEvent(new Event('visibilitychange')); }, h);
for (const slug of AP) {
  await test(`${slug}: сайт — blur без паузы; скрытая вкладка → пауза, видимая — экран паузы, Enter → игра; без сцены pause — заморозка цикла`, async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(), perr = [];
    p.on('pageerror', (e) => perr.push(String(e.message).slice(0, 160)));
    try {
      ok(await startDesk(p, slug) === 'play', 'старт');
      ok(await p.evaluate(() => Arcade.last.platform === null), 'без площадки');
      await p.evaluate(() => { window.dispatchEvent(new Event('blur')); }); await sleep(200); ok(await scene(p) === 'play', 'blur на сайте — без паузы');
      await p.evaluate(() => window.dispatchEvent(new Event('focus')));
      await hide(p, true); await sleep(200);
      ok(await scene(p) === 'pause' && await p.evaluate(() => Arcade.last.awayPaused), 'hidden → пауза');
      await hide(p, false); await sleep(400); ok(await scene(p) === 'pause', 'вкладка видна — экран паузы');
      await p.keyboard.press('Enter'); await sleep(400); ok(await scene(p) === 'play', '«Продолжить» → play');
      // игра без сцены pause: убираем сцену — только заморозка цикла
      await p.evaluate(() => { const g = Arcade.last; g._savedPause = g.scenes.pause; delete g.scenes.pause; });
      await hide(p, true); await sleep(100);
      const t0 = await p.evaluate(() => [Arcade.last._sceneName, Arcade.last._hiddenFreeze, Arcade.last.time]);
      await sleep(400); const t1 = await p.evaluate(() => Arcade.last.time);
      ok(t0[0] === 'play' && t0[1] && t1 === t0[2], `заморозка: ${JSON.stringify(t0)} → ${t1}`);
      await hide(p, false); await sleep(300); const t2 = await p.evaluate(() => [Arcade.last._hiddenFreeze, Arcade.last.time]);
      ok(!t2[0] && t2[1] > t1 && t2[1] - t1 < 0.6, `после возврата цикл идёт без скачка: ${t1} → ${t2[1]}`);
      await p.evaluate(() => { const g = Arcade.last; g.scenes.pause = g._savedPause; });
      ok(!perr.length, 'pageerror: ' + perr.join(' | '));
    } finally { await ctx.close(); }
  });
  await test(`${slug}: «площадка» (platform.js) — прежний путь: blur → пауза, скрытая вкладка → пауза`, async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(), perr = [];
    p.on('pageerror', (e) => perr.push(String(e.message).slice(0, 160)));
    await p.route(`${BASE}/${slug}/`, async (r) => { const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8').replace(/<script src="\.\/engine\.js"><\/script>/, '<script src="../_shared/platform.js"></script>$&'); await r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' }); });
    try {
      ok(await startDesk(p, slug) === 'play', 'старт');
      ok(await p.evaluate(() => !!Arcade.last.platform), 'площадка подключена');
      await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await sleep(200); ok(await scene(p) === 'pause', 'blur → пауза');
      await p.evaluate(() => { window.dispatchEvent(new Event('focus')); Arcade.last.goto('play', { resume: true }); }); await sleep(200);
      await hide(p, true); await sleep(200); ok(await scene(p) === 'pause', 'hidden → пауза'); await hide(p, false);
      ok(!perr.length, 'pageerror: ' + perr.join(' | '));
    } finally { await ctx.close(); }
  });
}
await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

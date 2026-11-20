/* _shared/tests/platform-builds.browser.mjs — headless-проверка сборок под площадки (tools/platform-build.mjs) с мок-SDK.
   Запуск: node _shared/tests/platform-builds.browser.mjs <папка-сборок> [slug-platform[-16x9] …]   (по умолчанию — все сборки)
   Для каждой сборки: свой статический сервер с корнем в папке игры (как на площадке); /sdk.js → мок Яндекс SDK;
   https://gamepush.com/sdk/… → мок GamePush (плейсхолдеры ID в index.html подменяются на тестовые только при отдаче);
   любые другие внешние запросы блокируются и считаются ошибкой. Проверяет (десктоп 1280×720):
   0 pageerror / console error; площадка определена, SDK инициализирован, ready() — после init; язык площадки (мок: en) применён
   ДО первого экрана меню, <title> — название на этом языке; ссылок наружу нет; Enter → игра (gameplayStart), P → пауза (stop);
   полноэкранная — частота по адаптеру; ролик за награду через движок: «ещё один шанс» на gameover — во время показа цикл стоит и
   AudioContext не играет, награда ровно одна, игра продолжается; второй раз за партию экрана нет; пропуск ролика — без награды;
   скрытая вкладка → пауза; потеря фокуса (blur) → пауза и тишина, focus → звук (v2.7, Яндекс 1.3); адаптер 1.2 — лидерборд, флаги,
   серверное время, покупки, свои игры через мок-SDK; контекстное меню и выделение подавлены; облачное сохранение; канвас нарисован.
   Телефон (портрет 390×844 и ландшафт 844×390) и планшет (768×1024, 1024×768), тач: нет прокрутки страницы, canvas целиком в окне.
   Сборки *-16x9 (--aspect 16:9): 1280×720, 1920×1080, 1024×768 — canvas внутри сцены 16:9, без искажений и прокрутки.
   Один браузер на все сборки, закрывается в конце. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2]; if (!DIR) { console.error('использование: node _shared/tests/platform-builds.browser.mjs <папка-сборок> [slug-platform …]'); process.exit(2); }
const only = process.argv.slice(3);
const RE = /^([a-z0-9-]+?)-(yandex|gamepush|web)(-(\d+)x(\d+))?$/;
const builds = fs.readdirSync(DIR, { withFileTypes: true }).filter(d => d.isDirectory() && RE.test(d.name) && fs.existsSync(path.join(DIR, d.name, 'index.html')))
  .map(d => d.name).filter(n => !only.length || only.includes(n)).sort();
const MOCK_Y = fs.readFileSync(path.join(HERE, 'mocks/yandex-sdk.js'), 'utf8'), MOCK_GP = fs.readFileSync(path.join(HERE, 'mocks/gamepush-sdk.js'), 'utf8');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const wait = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

function serve(root, platform) {
  const srv = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/sdk.js' && platform === 'yandex') { s.writeHead(200, { 'content-type': 'text/javascript' }); s.end(MOCK_Y); return; }
    let f = path.join(root, u); if (!f.startsWith(root)) { s.writeHead(403); s.end(); return; } if (u.endsWith('/')) f = path.join(f, 'index.html');
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; }
      if (u.endsWith('/') && platform === 'gamepush') d = Buffer.from(String(d).replace('content="GP_PROJECT_ID"', 'content="mock-project"').replace('content="GP_PUBLIC_TOKEN"', 'content="mock-token"'));
      s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
async function openPage(browser, base, platform, ctxOpts, errors, external, mock) {
  const ctx = await browser.newContext(ctxOpts), page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (platform === 'gamepush' && url.startsWith('https://gamepush.com/sdk/')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_GP });
    external.push(url); return route.abort();
  });
  await page.addInitScript((m) => {
    window.__sdkMock = m; window.__sdkLog = [];
    // журнал сцен с первого кадра: какая сцена и какой язык были на первом экране меню
    window.__firstMenu = null;
    const t = setInterval(() => { const g = window.Arcade && window.Arcade.last; if (g && g._sceneName && g._sceneName !== 'loading') { window.__firstMenu = { scene: g._sceneName, lang: g.i18n.lang, inited: !!(window.Platform && window.Platform.inited) }; clearInterval(t); } }, 1);
  }, mock);
  await page.goto(base); await wait(700);
  return { ctx, page };
}
const layoutProbe = () => {
  const se = document.scrollingElement || document.documentElement, cs = [...document.querySelectorAll('canvas')].filter(c => c.id !== 'arcade-aspect-bg');
  const c = cs.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
  const r = c.getBoundingClientRect();
  return { sw: se.scrollWidth, sh: se.scrollHeight, iw: innerWidth, ih: innerHeight, c: { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom, ratioCss: r.width / r.height, ratio: c.width / c.height },
    stage: window.ArcadeAspect ? window.ArcadeAspect.stage() : null, scene: window.Arcade && window.Arcade.last && window.Arcade.last._sceneName };
};

const browser = await chromium.launch();
try {
  for (const b of builds) {
    const [, slug, platform, , aw, ah] = RE.exec(b), root = path.join(DIR, b), aspect = aw ? +aw / +ah : null;
    let names = null; try { names = JSON.parse(fs.readFileSync(path.join(DIR, b + '.build.json'), 'utf8')).names; } catch (e) {}
    const srv = await serve(root, platform), base = `http://127.0.0.1:${srv.address().port}/`;
    const errors = [], external = [];
    try {
      // ---------- десктоп: SDK, язык, реклама, пауза ----------
      const { ctx, page } = await openPage(browser, base, platform, { viewport: { width: 1280, height: 720 } }, errors, external, { adMs: 150, lang: 'en' });
      const st = () => page.evaluate(() => ({ name: Platform.name, inited: Platform.inited, sdk: !!Platform.sdk, errors: Platform.errors, log: window.__sdkLog.slice(), title: document.title, lang: Arcade.last.i18n.lang, scene: Arcade.last._sceneName,
        links: [...document.querySelectorAll('a[href]')].filter(a => getComputedStyle(a).display !== 'none' && !/^#/.test(a.getAttribute('href'))).map(a => a.getAttribute('href')) }));
      const s0 = await st();
      ok(s0.name === platform, 'площадка ' + s0.name); ok(s0.inited && s0.sdk, 'SDK не поднялся: ' + JSON.stringify(s0.errors));
      ok(s0.log.includes('init') && s0.log.includes('ready') && s0.log.indexOf('ready') > s0.log.indexOf('init'), 'init → ready: ' + s0.log.join(','));
      const fm = await page.evaluate(() => window.__firstMenu);
      ok(fm && fm.scene === 'title' && fm.lang === 'en' && fm.inited, 'язык площадки до первого экрана меню (2.14): ' + JSON.stringify(fm));
      if (names && names.en) ok(s0.title === names.en, '<title> на EN: ' + s0.title);
      ok(!s0.links.length, 'видимые ссылки: ' + s0.links.join(', '));
      ok(await page.evaluate(() => !document.querySelector('[data-catalog-back]')), '«← Каталог» остался в разметке');
      const cm = await page.evaluate(() => { const c = document.querySelector('canvas'), e1 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }), e2 = new Event('selectstart', { bubbles: true, cancelable: true }); c.dispatchEvent(e1); document.body.dispatchEvent(e2); return [e1.defaultPrevented, e2.defaultPrevented, getComputedStyle(document.body).userSelect]; });
      ok(cm[0] && cm[1] && cm[2] === 'none', 'контекстное меню/выделение: ' + cm);
      await page.keyboard.press('Enter'); await wait(400);
      const s1 = await st(); ok(s1.scene === 'play', 'Enter → не play: ' + s1.scene); ok(s1.log.lastIndexOf('start') > s1.log.indexOf('ready'), 'Enter → нет gameplayStart: ' + s1.log.join(','));
      // полноэкранная (как в паузе между уровнями) — через движок; вторая подряд — отказ (частотное ограничение адаптера)
      const ad1 = await page.evaluate(async () => { const g = Arcade.last, p = g.adBreak(); await new Promise(r => setTimeout(r, 40)); const mid = g._adPause; return { mid, r: await p, after: g._adPause }; });
      ok(ad1.mid && ad1.r === true && !ad1.after, 'adBreak: ' + JSON.stringify(ad1));
      ok(await page.evaluate(() => Arcade.last.adBreak()) === false, 'вторая межстраничная подряд не должна показаться');
      const s1b = await st(); ok(s1b.log.lastIndexOf('start') > s1b.log.lastIndexOf('stop'), 'после рекламы геймплей не возобновлён: ' + s1b.log.slice(-4).join(','));
      // «ещё один шанс» за рекламу: на gameover экран continue; во время ролика цикл стоит, звук спит; награда одна; игра продолжается
      const rw = await page.evaluate(async () => {
        const g = Arcade.last; g.audio.unlocked = true; const ac = g.audio._ctx(); g.gameover(); const sc0 = g._sceneName;
        const t0 = g.time; g._selectMenu(); await new Promise(r => setTimeout(r, 60));
        const mid = { pause: g._adPause, pf: Platform.paused, ac: ac && ac.state, t: g.time }; await new Promise(r => setTimeout(r, 60)); const midT2 = g.time;
        g._selectMenu(); // повторное нажатие во время показа — не должно дать второй ролик
        await new Promise(r => setTimeout(r, 250));
        const after = { scene: g._sceneName, used: g._contUsed, ads: window.__sdkLog.filter(x => x === 'rewarded').length };
        g.gameover(); const second = g._sceneName;
        return { sc0, mid, frozen: midT2 === mid.t, after, second };
      });
      ok(rw.sc0 === 'continue', 'нет экрана «ещё один шанс»: ' + rw.sc0);
      ok(rw.mid.pause && rw.mid.pf && rw.frozen && rw.mid.ac !== 'running', 'во время ролика игра не на паузе/звук не выключен: ' + JSON.stringify(rw));
      ok(rw.after.scene === 'play' && rw.after.used && rw.after.ads === 1, 'после ролика: ' + JSON.stringify(rw.after));
      ok(rw.second === 'gameover', 'второй раз за партию — сразу gameover: ' + rw.second);
      const skip = await page.evaluate(async () => { const g = Arcade.last; window.__sdkMock.rewarded = 'skip'; g.goto('title'); g.scenes.title._menu.items[0].onSelect.call(g); g.gameover(); const sc = g._sceneName; g._selectMenu();
        await new Promise(r => setTimeout(r, 260)); const res = { sc, used: g._contUsed, scene: g._sceneName }; window.__sdkMock.rewarded = 'ok'; return res; });
      ok(skip.sc === 'continue' && !skip.used && skip.scene !== 'play', 'пропуск ролика не должен продолжать игру: ' + JSON.stringify(skip));
      // скрытая вкладка → пауза
      const hid = await page.evaluate(async () => { const g = Arcade.last; g.goto('title'); g.scenes.title._menu.items[0].onSelect.call(g); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange')); const s = g._sceneName; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); return s; });
      ok(hid === 'pause', 'скрытая вкладка → не пауза: ' + hid);
      // v2.7 / Яндекс 1.3: любая потеря фокуса (blur окна — клик по странице площадки вокруг iframe, другое окно) → тишина и пауза; focus → звук можно вернуть
      const bl = await page.evaluate(async () => { const g = Arcade.last; g.goto('play', { resume: true }); g.audio.unlocked = true; const ac = g.audio._ctx(); try { await ac.resume(); } catch (e) {}
        window.dispatchEvent(new Event('blur')); await new Promise(r => setTimeout(r, 80)); const s = { scene: g._sceneName, ac: ac && ac.state, away: g.audio._away() };
        window.dispatchEvent(new Event('focus')); await new Promise(r => setTimeout(r, 80)); return { s, away: g.audio._away() }; });
      ok(bl.s.scene === 'pause' && bl.s.ac !== 'running' && bl.s.away && !bl.away, 'blur → пауза и тишина, focus → звук снова разрешён: ' + JSON.stringify(bl));
      // v1.2: лидерборд, флаги, серверное время, покупки, свои игры — методы SDK (мок) доступны через адаптер; движок 2.7
      const v12 = await page.evaluate(async () => ({ ver: Arcade.version, pf: Platform.version, lb: Platform.leaderboard.available, top: Array.isArray((await Platform.leaderboard.top()).entries),
        flags: Object.keys(await Arcade.last.flags.ready).length, st: Platform.serverTime(), pay: Platform.payments.available, games: (await Platform.games.list()).games.length }));
      ok(v12.ver === '2.7.0' && v12.pf === '1.2.0' && v12.lb && v12.top && v12.flags >= 5 && v12.st > 0 && v12.pay && v12.games >= 1, 'v1.2: ' + JSON.stringify(v12));
      await page.evaluate(() => Arcade.last.goto('play', { resume: true })); await wait(100);
      await page.keyboard.press('KeyP'); await wait(200);
      const s2 = await st(); ok(s2.log.lastIndexOf('stop') > s2.log.lastIndexOf('start'), 'P → нет gameplayStop: ' + s2.log.slice(-4).join(','));
      await page.evaluate(() => Platform.save('probe', { v: 1 })); await wait(1700);
      const s3 = await st(); ok(s3.log.includes(platform === 'yandex' ? 'setData' : 'sync'), 'облачное сохранение: ' + s3.log.join(','));
      const drawn = await page.evaluate(() => { const c = document.querySelector('canvas:not(#arcade-aspect-bg)'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 4 * 97) if (x[i] + x[i + 1] + x[i + 2] > 40) n++; return n; });
      ok(drawn > 20, 'канвас пуст');
      if (!aspect) for (const [w, h] of [[1280, 720], [1920, 1080], [1366, 768]]) {   // десктоп: без прокрутки, canvas целиком в окне (Яндекс 1.10, 1.6.2.1)
        await page.setViewportSize({ width: w, height: h }); await wait(200); const L = await page.evaluate(layoutProbe);
        ok(L.sh <= L.ih + 1 && L.sw <= L.iw + 1 && L.c.b <= L.ih + 1 && L.c.y >= -1, `${w}×${h}: прокрутка/обрезка ` + JSON.stringify(L));
      }
      if (aspect) {
        for (const [w, h] of [[1280, 720], [1920, 1080], [1024, 768]]) {
          await page.setViewportSize({ width: w, height: h }); await wait(250);
          const L = await page.evaluate(layoutProbe), sg = L.stage;
          ok(sg && Math.abs(sg.w / sg.h - aspect) < 0.01, `${w}×${h}: сцена не ${aw}:${ah}: ` + JSON.stringify(sg));
          ok(L.c.y >= sg.y - 1 && L.c.b <= sg.y + sg.h + 1 && L.c.x >= sg.x - 1 && L.c.r <= sg.x + sg.w + 1, `${w}×${h}: canvas вне сцены ` + JSON.stringify(L));
          ok(Math.abs(L.c.ratioCss - L.c.ratio) < 0.02, `${w}×${h}: искажение пропорций ` + JSON.stringify(L.c));
          ok(L.sh <= L.ih + 1 && L.sw <= L.iw + 1, `${w}×${h}: прокрутка ` + JSON.stringify(L));
        }
      }
      await ctx.close();
      // ---------- телефон и планшет: портрет и ландшафт ----------
      const phones = [];
      for (const [w, h] of [[390, 844], [844, 390], [768, 1024], [1024, 768]]) {   // телефон портрет/ландшафт, планшет портрет/ландшафт
        const P = await openPage(browser, base, platform, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, errors, external, { adMs: 50, lang: 'ru' });
        const L0 = await P.page.evaluate(layoutProbe);
        await P.page.evaluate(() => { const g = Arcade.last; g.scenes.title._menu.items[0].onSelect.call(g); }); await wait(300);
        const L1 = await P.page.evaluate(layoutProbe);
        for (const L of [L0, L1]) {
          ok(L.sh <= L.ih + 1 && L.sw <= L.iw + 1, `${w}×${h}: прокрутка страницы ` + JSON.stringify(L));
          ok(L.c.x >= -1 && L.c.y >= -1 && L.c.r <= L.iw + 1 && L.c.b <= L.ih + 1, `${w}×${h}: canvas не целиком в окне ` + JSON.stringify(L.c));
          ok(Math.abs(L.c.ratioCss - L.c.ratio) < 0.02, `${w}×${h}: искажение ` + JSON.stringify(L.c));
        }
        ok(L0.scene === 'title' && L1.scene === 'play', 'сцены на телефоне: ' + L0.scene + '/' + L1.scene);
        phones.push(`${w}×${h} canvas ${Math.round(L1.c.w)}×${Math.round(L1.c.h)}`);
        await P.ctx.close();
      }
      ok(!external.length, 'внешние запросы: ' + external.join(', '));
      ok(!errors.length, errors.join(' | '));
      passed++; console.log('ok   ' + b + ` (SDK: ${s3.log.filter((x, i, a) => a.indexOf(x) === i).join(',')}; ${phones.join('; ')})`);
    } catch (e) { failed++; console.log('FAIL ' + b + ' — ' + e.message + (errors.length ? ' | ' + errors.join(' | ') : '')); }
    srv.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} прошло, ${failed} упало (сборок: ${builds.length})`);
process.exit(failed || !builds.length ? 1 : 0);

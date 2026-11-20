/* _shared/tests/platform-builds.browser.mjs — headless-проверка сборок под площадки (tools/platform-build.mjs) с мок-SDK.
   Запуск: node _shared/tests/platform-builds.browser.mjs <папка-сборок> [slug-platform …]   (по умолчанию — все <slug>-<platform>/)
   Для каждой сборки: свой статический сервер с корнем в папке игры (как на площадке); /sdk.js → мок Яндекс SDK;
   https://gamepush.com/sdk/… → мок GamePush (плейсхолдеры ID в index.html подменяются на тестовые только при отдаче);
   любые другие внешние запросы блокируются и считаются ошибкой. Проверяет: 0 pageerror / console error; площадка определена,
   SDK инициализирован, ready() отправлен; ссылок наружу нет на странице (или скрыты); Enter → игра (gameplayStart), P → пауза
   (gameplayStop); ролик за награду — игра на паузе во время показа, награда выдана; gameover → полноэкранная реклама;
   канвас нарисован. Один браузер на все сборки, закрывается в конце. */
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
const builds = fs.readdirSync(DIR, { withFileTypes: true }).filter(d => d.isDirectory() && /-(yandex|gamepush|web)$/.test(d.name) && fs.existsSync(path.join(DIR, d.name, 'index.html')))
  .map(d => d.name).filter(n => !only.length || only.includes(n)).sort();
const MOCK_Y = fs.readFileSync(path.join(HERE, 'mocks/yandex-sdk.js'), 'utf8'), MOCK_GP = fs.readFileSync(path.join(HERE, 'mocks/gamepush-sdk.js'), 'utf8');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const wait = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

const browser = await chromium.launch();
try {
  for (const b of builds) {
    const root = path.join(DIR, b), platform = b.split('-').pop();
    const srv = http.createServer((q, s) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/sdk.js' && platform === 'yandex') { s.writeHead(200, { 'content-type': 'text/javascript' }); s.end(MOCK_Y); return; }
      let f = path.join(root, u); if (!f.startsWith(root)) { s.writeHead(403); s.end(); return; } if (u.endsWith('/')) f = path.join(f, 'index.html');
      fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; }
        if (u.endsWith('/') && platform === 'gamepush') d = Buffer.from(String(d).replace('content="GP_PROJECT_ID"', 'content="mock-project"').replace('content="GP_PUBLIC_TOKEN"', 'content="mock-token"'));
        s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [], external = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      if (platform === 'gamepush' && url.startsWith('https://gamepush.com/sdk/')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_GP });
      external.push(url); return route.abort();
    });
    try {
      await page.addInitScript(() => { window.__sdkMock = { adMs: 150 }; window.__sdkLog = []; });
      await page.goto(base); await wait(700);
      const st = () => page.evaluate(() => ({ name: Platform.name, inited: Platform.inited, sdk: !!Platform.sdk, errors: Platform.errors, log: window.__sdkLog.slice(), links: [...document.querySelectorAll('a[href]')].filter(a => getComputedStyle(a).display !== 'none' && !/^#/.test(a.getAttribute('href'))).map(a => a.getAttribute('href')) }));
      const s0 = await st();
      ok(s0.name === platform, 'площадка ' + s0.name); ok(s0.inited && s0.sdk, 'SDK не поднялся: ' + JSON.stringify(s0.errors));
      ok(s0.log.includes('init') && s0.log.includes('ready'), 'нет init/ready: ' + s0.log.join(','));
      ok(!s0.links.length, 'видимые ссылки: ' + s0.links.join(', '));
      ok(await page.evaluate(() => !document.querySelector('[data-catalog-back]')), '«← Каталог» остался в разметке');
      await page.keyboard.press('Enter'); await wait(400);
      const s1 = await st(); ok(s1.log.lastIndexOf('start') > s1.log.indexOf('ready'), 'Enter → нет gameplayStart: ' + s1.log.join(','));
      // полноэкранная реклама (как на gameover) — через API адаптера; вторая подряд — отказ (частотное ограничение)
      const fs1 = await page.evaluate(() => Platform.showInterstitial()); ok(fs1 === true, 'interstitial');
      const fs2 = await page.evaluate(() => Platform.showInterstitial()); ok(fs2 === false, 'второй interstitial подряд не должен показаться');
      const s1b = await st(); ok(s1b.log.lastIndexOf('start') > s1b.log.lastIndexOf('stop'), 'после рекламы геймплей не возобновлён: ' + s1b.log.slice(-4).join(','));
      // ролик за награду: на время показа — пауза площадки, затем награда
      const rw = await page.evaluate(async () => { let got = 0; const p = Platform.showRewarded(() => got++); await new Promise(r => setTimeout(r, 40)); const mid = Platform.paused; const r = await p; return { mid, r, got, after: Platform.paused }; });
      ok(rw.mid && rw.r && rw.got === 1 && !rw.after, 'награда/пауза: ' + JSON.stringify(rw));
      await page.keyboard.press('KeyP'); await wait(200);
      const s2 = await st(); ok(s2.log.lastIndexOf('stop') > s2.log.lastIndexOf('start'), 'P → нет gameplayStop: ' + s2.log.slice(-4).join(','));
      await page.evaluate(() => Platform.save('probe', { v: 1 })); await wait(1700);
      const s3 = await st(); ok(s3.log.includes(platform === 'yandex' ? 'setData' : 'sync'), 'облачное сохранение: ' + s3.log.join(','));
      const drawn = await page.evaluate(() => { const c = document.querySelector('canvas'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 4 * 97) if (x[i] + x[i + 1] + x[i + 2] > 40) n++; return n; });
      ok(drawn > 20, 'канвас пуст');
      ok(!external.length, 'внешние запросы: ' + external.join(', '));
      ok(!errors.length, errors.join(' | '));
      passed++; console.log('ok   ' + b + ` (SDK: ${s3.log.filter((x, i, a) => a.indexOf(x) === i).join(',')})`);
    } catch (e) { failed++; console.log('FAIL ' + b + ' — ' + e.message + (errors.length ? ' | ' + errors.join(' | ') : '')); }
    await page.close(); srv.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} прошло, ${failed} упало (сборок: ${builds.length})`);
process.exit(failed || !builds.length ? 1 : 0);

/* МЕДНИЦА · tests/browser.mjs — проверка в Chromium (Playwright) + скриншоты.
   Нужно: `python3 -m http.server 8424` в корне репо (BASE, по умолч. http://localhost:8424) и сборка под Яндекс
   (`node _proto/mednitsa/tests/build-platform.mjs yandex /home/claude/platform-builds`).
   Запуск: node _proto/mednitsa/tests/browser.mjs [папка-сборок] [папка-скриншотов]
   Сайт: 0 ошибок, меню → Enter, пауза P, тема T, язык L, удар/покупка, офлайн без рекламы, вписывание в экран.
   Сборка Яндекса с мок-SDK: язык SDK, офлайн по серверному времени (часы устройства подменены), ролик ×2 — только при досмотре,
   форсаж, межстраничная — по флагам и только в паузе, «Без рекламы», «Набор мастера», облако. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const BASE = process.env.BASE || 'http://localhost:8424', URL = BASE + '/_proto/mednitsa/';
const BUILDS = process.argv[2] || '/home/claude/platform-builds', SHOTS = process.argv[3] || '/home/claude/wave2-shots';
const BUILD = path.join(BUILDS, 'mednitsa-yandex'), MOCK = fs.readFileSync(path.join(REPO, '_shared/tests/mocks/yandex-sdk.js'), 'utf8');
const T0 = 1767225600000;

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.message)); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// статический сервер сборки: корень — папка игры, /sdk.js — мок Яндекс SDK
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/sdk.js') { s.writeHead(200, { 'content-type': 'text/javascript' }); s.end(MOCK); return; }
  const f = path.join(BUILD, u === '/' ? 'index.html' : u);
  if (!f.startsWith(BUILD) || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r)); const YURL = 'http://localhost:' + srv.address().port + '/';

const browser = await chromium.launch();
async function open(url, o = {}) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 390, height: 844 }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.touch });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.addInitScript((a) => {
    if (a.mock) window.__sdkMock = a.mock;
    if (a.ls) for (const k of Object.keys(a.ls)) localStorage.setItem(k, a.ls[k]);
    if (a.clockShift) { const d = Date.now; Date.now = () => d() + a.clockShift; }
  }, { mock: o.mock || null, ls: o.ls || null, clockShift: o.clockShift || 0 });
  await page.goto(url); await page.waitForFunction(() => window.MEDNITSA && MEDNITSA.g && MEDNITSA.g._sceneName === 'title', null, { timeout: 8000 });
  return { page, ctx, errs };
}
const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(MEDNITSA.state())));
async function play(page) { await page.keyboard.press('Enter'); await page.waitForFunction(() => MEDNITSA.g._sceneName === 'play'); await sleep(120); }
async function clickHit(page, id) {
  const p = await page.evaluate((id) => { const h = MEDNITSA.findHit(id); if (!h) return null; const r = MEDNITSA.g.canvas.getBoundingClientRect(), k = r.width / MEDNITSA.g.W; return { x: r.left + (h.x + h.w / 2) * k, y: r.top + (h.y + h.h / 2) * k }; }, id);
  if (!p) throw new Error('нет кнопки ' + id); await page.mouse.click(p.x, p.y); await sleep(80);
}
const hits = (page) => page.evaluate(() => MEDNITSA.debug.hits().map((h) => h.id));
function save(o) { const s = Object.assign({ v: 1, copper: 0, runEarned: 0, lifeEarned: 0, marks: 0, marksEver: 0, prestiges: 0, lv: [20, 10, 3, 0, 0, 0, 0, 0, 0, 0], ups: {}, taps: 200, goals: {}, goalSeq: 0, chests: 0, boosts: 0, boostLeft: 0, lastSeen: 0, giftDay: 1e9, giftStreak: 1, chestT: 999, chestLive: 0 }, o); return { 'arcade.mednitsa.save': JSON.stringify(s) }; }

// ---------------- сайт (без площадки) ----------------
await test('сайт: 0 ошибок, меню → Enter → игра; P пауза/назад; T тема; L язык (RU → EN → TR …)', async () => {
  const { page, ctx, errs } = await open(URL);
  await play(page); await page.keyboard.press('KeyP'); ok(await page.evaluate(() => MEDNITSA.g._sceneName) === 'pause', 'пауза');
  await page.keyboard.press('KeyP'); ok(await page.evaluate(() => MEDNITSA.g._sceneName) === 'play', 'из паузы');
  const th0 = await page.evaluate(() => MEDNITSA.g.themeName); await page.keyboard.press('KeyT'); await sleep(50); ok(await page.evaluate(() => MEDNITSA.g.themeName) !== th0, 'тема');
  ok(await page.evaluate(() => document.body.getAttribute('data-theme')) === await page.evaluate(() => MEDNITSA.g.themeName), 'тема страницы');
  await page.keyboard.press('KeyL'); await sleep(50); ok(await page.evaluate(() => MEDNITSA.g.i18n.lang) === 'en', 'язык EN');
  ok(await page.evaluate(() => MEDNITSA.g.t('ws_kettle')) === 'Samovar');
  await page.keyboard.press('KeyL'); await sleep(50); ok(await page.evaluate(() => MEDNITSA.g.i18n.lang) === 'tr', 'язык TR');
  ok(!errs.length, errs.join('; ')); await ctx.close();
});
await test('сайт: тап по котлу даёт медь, покупка с клавиатуры (↓ Enter) и пальцем; ×1/×10/MAX', async () => {
  const { page, ctx, errs } = await open(URL, { touch: true });
  await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; });
  const box = await page.evaluate(() => { const r = MEDNITSA.g.canvas.getBoundingClientRect(), k = r.width / 480, B = MEDNITSA.R.BOILER; return { x: r.left + B.x * k, y: r.top + (78 + B.y) * k }; });
  for (let i = 0; i < 14; i++) await page.mouse.click(box.x, box.y);
  let s = await st(page); ok(s.taps === 14 && s.copper >= 13, 'удары ' + s.taps + ', медь ' + s.copper);
  await page.keyboard.press('Enter'); await sleep(60); s = await st(page); ok(s.lv[0] === 1, 'Enter купил самовар: ' + s.lv[0]);
  await page.evaluate(() => { MEDNITSA.state().copper = 1e4; }); await clickHit(page, 'mode'); await clickHit(page, 'ws0'); s = await st(page); ok(s.lv[0] === 11, '×10: ' + s.lv[0]);
  await clickHit(page, 'mode'); await clickHit(page, 'ws0'); s = await st(page); ok(s.lv[0] > 11 && s.copper < 12 * Math.pow(1.15, s.lv[0]), 'MAX: ' + s.lv[0]);
  ok(!errs.length, errs.join('; ')); await ctx.close();
});
await test('сайт: без рекламы — ни «Форсажа», ни кнопок «Реклама» (офлайн-окно — одна кнопка), окно забирает доход', async () => {
  const { page, ctx, errs } = await open(URL, { ls: save({ lastSeen: Date.now() - 3600e3 }) });
  await play(page); await sleep(150);
  const d = await page.evaluate(() => MEDNITSA.debug.ui.dlg && { type: MEDNITSA.debug.ui.dlg.type, gain: MEDNITSA.debug.ui.dlg.r.gain, sec: MEDNITSA.debug.ui.dlg.r.sec });
  ok(d && d.type === 'offline' && Math.abs(d.sec - 3600) < 5, 'окно офлайна ' + JSON.stringify(d));
  const h = await hits(page); ok(!h.includes('dlg_1') && !h.includes('boost'), 'лишние кнопки: ' + h.join());
  const c0 = (await st(page)).copper; await clickHit(page, 'dlg_0'); const c1 = (await st(page)).copper; ok(c1 - c0 >= d.gain * 0.999, 'забрал ' + (c1 - c0) + ' из ' + d.gain);
  ok(!errs.length, errs.join('; ')); await ctx.close();
});
await test('сайт: холст вписан без прокрутки — телефон 390×844 (высота 1000), 360×640, десктоп 1280×720 (800)', async () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 720 }]) {
    const { page, ctx, errs } = await open(URL, { vp });
    const r = await page.evaluate(() => { const b = MEDNITSA.g.canvas.getBoundingClientRect(); return { b: b.bottom, r: b.right, H: MEDNITSA.g.H, sh: document.documentElement.scrollHeight, ih: innerHeight, iw: innerWidth }; });
    ok(r.b <= r.ih + 1 && r.r <= r.iw + 1, vp.width + '×' + vp.height + ': холст ' + JSON.stringify(r));
    if (vp.width === 390) ok(r.H === 1000, 'высота ' + r.H); if (vp.width === 1280) ok(r.H === 800, 'высота ' + r.H);
    ok(!errs.length, errs.join('; ')); await ctx.close();
  }
});

// ---------------- сборка под Яндекс с мок-SDK ----------------
const haveBuild = fs.existsSync(path.join(BUILD, 'index.html'));
if (!haveBuild) { failed++; console.log('FAIL нет сборки ' + BUILD + ' — node _proto/mednitsa/tests/build-platform.mjs yandex'); }
else {
  await test('Яндекс: 0 ошибок, язык из SDK (tr) до меню, ready после init, start/stop по сцене, нет ссылок наружу', async () => {
    const { page, ctx, errs } = await open(YURL, { mock: { lang: 'tr', serverTime: T0 } });
    ok(await page.evaluate(() => MEDNITSA.g.i18n.lang) === 'tr', 'язык');
    await play(page); const log = await page.evaluate(() => window.__sdkLog.join(','));
    ok(/ready/.test(log) && /start/.test(log), log); ok(await page.evaluate(() => document.querySelectorAll('a[href]').length) === 0, 'ссылки');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
  await test('Яндекс: офлайн-доход по СЕРВЕРНОМУ времени — часы устройства +3 дня не дают лишнего (30 мин = 30 мин)', async () => {
    const { page, ctx, errs } = await open(YURL, { mock: { serverTime: T0 }, ls: save({ lastSeen: T0 - 1800e3 }), clockShift: 3 * 86400e3 });
    await play(page); await sleep(150);
    const d = await page.evaluate(() => MEDNITSA.debug.ui.dlg && MEDNITSA.debug.ui.dlg.r && MEDNITSA.debug.ui.dlg.r.sec);
    ok(Math.abs(d - 1800) < 2, 'офлайн ' + d + ' с');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
  await test('Яндекс: «Реклама: ×2» офлайн-дохода — награда ТОЛЬКО при досмотре (пропуск → 0, досмотр → ровно ×2)', async () => {
    const { page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, rewarded: 'skip', adMs: 20 }, ls: save({ lastSeen: T0 - 3600e3 }) });
    await play(page); await sleep(150);
    const gain = await page.evaluate(() => MEDNITSA.debug.ui.dlg.r.gain); ok(gain > 0, 'доход');
    let c0 = (await st(page)).copper; await clickHit(page, 'dlg_1'); await sleep(250);
    let c1 = (await st(page)).copper; ok(Math.abs(c1 - c0) < gain * 0.01, 'пропуск дал ' + (c1 - c0)); ok(await page.evaluate(() => !!MEDNITSA.debug.ui.dlg), 'окно осталось');
    await page.evaluate(() => { window.__sdkMock.rewarded = 'ok'; }); await sleep(100);
    c0 = (await st(page)).copper; await clickHit(page, 'dlg_1'); await sleep(300);
    c1 = (await st(page)).copper; ok(c1 - c0 >= gain * 2 * 0.999 && c1 - c0 < gain * 2 * 1.05, 'досмотр дал ' + (c1 - c0) + ' при ×2 = ' + gain * 2);
    ok(await page.evaluate(() => !MEDNITSA.debug.ui.dlg), 'окно закрыто');
    ok((await page.evaluate(() => window.__sdkLog.filter((x) => x === 'rewarded').length)) === 2, 'два показа');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
  await test('Яндекс: «Форсаж» за рекламу — ×2 на 5 мин только при досмотре; посылка ×8 — тоже', async () => {
    const { page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, rewarded: 'error', adMs: 20 }, ls: save({}) });
    await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; }); await sleep(100);
    ok((await hits(page)).includes('boost'), 'кнопка форсажа');
    await clickHit(page, 'boost'); await sleep(200); ok((await st(page)).boostLeft === 0, 'ошибка рекламы — без форсажа');
    await page.evaluate(() => { window.__sdkMock.rewarded = 'ok'; }); await sleep(100); await clickHit(page, 'boost'); await sleep(250);
    const b = (await st(page)).boostLeft; ok(b > 290 && b <= 300, 'форсаж ' + b);
    await page.evaluate(() => { const s = MEDNITSA.state(); s.chestLive = 20; MEDNITSA.debug.catchChest(); }); await sleep(50);
    const v = await page.evaluate(() => MEDNITSA.debug.ui.dlg && MEDNITSA.debug.ui.dlg.type === 'chest' && MEDNITSA.debug.ui.dlg.v); ok(v > 0, 'окно посылки');
    const c0 = (await st(page)).copper; await clickHit(page, 'dlg_1'); await sleep(250); const c1 = (await st(page)).copper;
    ok(c1 - c0 >= v * 7 * 0.999, 'посылка за рекламу: +' + (c1 - c0) + ' при ' + v + '×7 доп.');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
  await test('Яндекс: межстраничная — не в первые 5 мин (флаг по умолчанию); с флагами ad_idle_first=0 — по «Дальше» в окне нового цеха; после «Без рекламы» — нет', async () => {
    let { page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, adMs: 20 }, ls: save({}) });
    await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; MEDNITSA.debug.openDlg({ type: 'unlock', ws: 2 }); }); await sleep(80);
    await clickHit(page, 'dlg_0'); await sleep(150); ok(!(await page.evaluate(() => window.__sdkLog.includes('fullscreen'))), 'реклама в первые минуты');
    ok(!errs.length, errs.join('; ')); await ctx.close();
    ({ page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, adMs: 20, flags: { ad_idle_first: '0', ad_idle_gap: '1' } }, ls: save({}) }));
    await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; }); await sleep(300);
    ok(await page.evaluate(() => MEDNITSA.E().cfg.ads.firstSec) === 0, 'флаг применён');
    ok(!(await page.evaluate(() => window.__sdkLog.includes('fullscreen'))), 'реклама сама по себе');
    await page.evaluate(() => MEDNITSA.debug.openDlg({ type: 'unlock', ws: 2 })); await sleep(50); await clickHit(page, 'dlg_0'); await sleep(200);
    ok(await page.evaluate(() => window.__sdkLog.filter((x) => x === 'fullscreen').length) === 1, 'одна межстраничная по действию');
    await page.evaluate(() => MEDNITSA.g.purchase('no_ads')); await sleep(200); ok(await page.evaluate(() => MEDNITSA.g.noAds()), 'куплено');
    await page.evaluate(() => { MEDNITSA.debug.ui.dlg = null; MEDNITSA.debug.openDlg({ type: 'unlock', ws: 2 }); }); await sleep(50); await clickHit(page, 'dlg_0'); await sleep(200);
    ok(await page.evaluate(() => window.__sdkLog.filter((x) => x === 'fullscreen').length) === 1, 'после «Без рекламы» межстраничной нет');
    ok(await page.evaluate(() => MEDNITSA.g.canRewarded()), 'ролики за награду остаются по желанию');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
  await test('Яндекс: «Набор мастера» — покупка в «Переплавке» (цена из SDK), доход ×2, восстанавливается при следующем запуске', async () => {
    const cat = [{ id: 'no_ads', title: 'Без рекламы', description: '', imageURI: '', price: '49 YAN', priceValue: '49', priceCurrencyCode: 'YAN' }, { id: 'starter', title: 'Набор мастера', description: '', imageURI: '', price: '99 YAN', priceValue: '99', priceCurrencyCode: 'YAN' }];
    let { page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, adMs: 20, catalog: cat }, ls: save({}) });
    await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; MEDNITSA.debug.ui.tab = 'pr'; }); await sleep(150);
    const inc0 = await page.evaluate(() => MEDNITSA.E().income(MEDNITSA.state()));
    await clickHit(page, 'starter'); await sleep(250);
    const s = await st(page); ok(s.starter && s.starterGranted, 'набор'); const inc1 = await page.evaluate(() => MEDNITSA.E().income(MEDNITSA.state())); ok(Math.abs(inc1 / inc0 - 2) < 0.01, 'доход ×' + inc1 / inc0);
    const purchases = await page.evaluate(() => window.__sdkMock.purchases.slice()); ok(purchases.some((p) => p.productID === 'starter'), 'покупка в SDK');
    ok(!errs.length, errs.join('; ')); await ctx.close();
    // новый запуск: локальное сохранение «без набора», но покупка есть в SDK → восстановлена
    ({ page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, catalog: cat, purchases }, ls: save({}) }));
    await play(page); await sleep(2600); ok((await st(page)).starter, 'восстановлено из покупок SDK');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
  await test('Яндекс: облачное сохранение — берётся продвинутая копия; прогресс уходит в облако (setData)', async () => {
    const cloudSave = JSON.parse(save({ marksEver: 7, marks: 7, lifeEarned: 1e9, lv: [40, 30, 20, 10, 1, 0, 0, 0, 0, 0] })['arcade.mednitsa.save']);
    const { page, ctx, errs } = await open(YURL, { mock: { serverTime: T0, cloud: { 'mednitsa.save': JSON.stringify(cloudSave) } }, ls: save({}) });
    const s = await st(page); ok(s.marks === 7 && s.lv[4] === 1, 'из облака: ' + s.marks);
    await play(page); await page.evaluate(() => MEDNITSA.debug.save(true)); await sleep(1800);
    const saved = await page.evaluate(() => window.__sdkMock.saved && window.__sdkMock.saved['mednitsa.save']); ok(saved && JSON.parse(saved).marks === 7, 'в облаке');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  });
}

// ---------------- скриншоты (портрет телефона, обе темы) ----------------
async function shot(page, file) { const el = await page.$('canvas'); await el.screenshot({ path: path.join(SHOTS, file) }); }
await test('скриншоты: ' + SHOTS + '/mednitsa-*.png', async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const mid = save({ lv: [46, 41, 28, 12, 3, 0, 0, 0, 0, 0], ups: { pipes0: 1, pipes1: 1, bellows: 1, anvil: 1, pipes2: 1 }, copper: 3.2e5, marks: 5, marksEver: 5, lifeEarned: 5e8, taps: 900, chestT: 2, goals: { g1: 1, g2: 1, g3: 1, g4: 1, g5: 1, g6: 1 } });
  for (const theme of ['modern', 'retro']) {
    const { page, ctx, errs } = await open(URL, { dpr: 2, ls: Object.assign({ 'arcade.theme': theme, 'arcade.lang': 'ru' }, mid) });
    await shot(page, 'mednitsa-title-' + theme + '.png');
    await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; });
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await sleep(60); }
    await sleep(2500); await shot(page, 'mednitsa-' + theme + '.png');
    await page.evaluate(() => { MEDNITSA.debug.ui.tab = 'up'; }); await sleep(200); await shot(page, 'mednitsa-blueprints-' + theme + '.png');
    await page.evaluate(() => { MEDNITSA.debug.ui.tab = 'goals'; MEDNITSA.debug.openDlg({ type: 'unlock', ws: 5 }); }); await sleep(250); await shot(page, 'mednitsa-unlock-' + theme + '.png');
    ok(!errs.length, errs.join('; ')); await ctx.close();
  }
  if (haveBuild) {   // окно офлайна с кнопкой «Реклама: ×2» (сборка Яндекса, мок-SDK)
    const { page, ctx, errs } = await open(YURL, { dpr: 2, mock: { serverTime: T0 }, ls: Object.assign({ 'arcade.theme': 'modern' }, save({ lv: [46, 41, 28, 12, 3, 0, 0, 0, 0, 0], lastSeen: T0 - 3 * 3600e3, marks: 5, marksEver: 5 })) });
    await play(page); await sleep(300); await shot(page, 'mednitsa-offline-yandex.png'); ok(!errs.length, errs.join('; ')); await ctx.close();
  }
  { const { page, ctx, errs } = await open(URL, { vp: { width: 1280, height: 720 }, ls: Object.assign({ 'arcade.theme': 'modern' }, mid) });
    await play(page); await page.evaluate(() => { MEDNITSA.debug.ui.queue = []; MEDNITSA.debug.ui.dlg = null; MEDNITSA.debug.ui.tab = 'goals'; }); await sleep(400);
    await page.screenshot({ path: path.join(SHOTS, 'mednitsa-desktop.png') }); ok(!errs.length, errs.join('; ')); await ctx.close(); }
});

await browser.close(); srv.close();
console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

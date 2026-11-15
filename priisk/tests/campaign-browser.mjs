/* ПРИИСК · tests/campaign-browser.mjs — кампания ДЕМО в браузере (Playwright), мышью: меню → «Кампания» → карта кампании
   (миссии 2–10 под замком «В полной версии», карточка с «Узнать больше») → брифинг → миссия 1 (Котельная и Плавильня кнопками
   панели и призраком, цели переключаются) → ночь → победа → итог → «Далее» → экран «Продолжение — в полной версии»
   («На карту кампании», «Узнать больше» → ../). ?mission=m2 игнорируется; сборка с флагом full без файла m2 не падает.
   0 ошибок консоли. Скриншоты обеих тем: priisk-m1-{map,locked,brief,day,night}-…, priisk-demo-{result,edition}-{modern,retro}.png.
   Тесты миссии 2 — в полной сборке (arcade-full/priisk/tests/campaign-full-browser.mjs).
   Запуск из корня репо: node priisk/tests/campaign-browser.mjs [папка-для-скриншотов]
   Сервер: http.server на PORT (по умолчанию 8353), если не отвечает — поднимается свой статический. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const PORT = +(process.env.PORT || 8353), URL0 = `http://localhost:${PORT}/priisk/`;
const SHOTS = process.argv[2] || null;
let srv = null;
async function up() { try { const r = await fetch(URL0); return r.ok; } catch { return false; } }
if (!(await up())) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  srv = http.createServer((q, s) => { let f = path.join(REPO, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
  await new Promise(r => srv.listen(PORT, r));
}
let passed = 0, failed = 0; const errors = [];
async function test(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL0 + '?lang=ru'); await wait(400);
  await page.evaluate(() => { PRIISK.g.setTheme('modern'); });
  const cv = (x, y) => page.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), k = r.width / 960; return { x: r.left + x * k, y: r.top + y * k }; }, [x, y]);
  const scr = (x, y) => page.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), S = PRIISK.S, k = r.width / 960; return { x: r.left + (x * 24 - S.cam.x) * k, y: r.top + (y * 24 - S.cam.y) * k }; }, [x, y]);
  const click = async (x, y, o) => { const p = await cv(x, y); await page.mouse.move(p.x, p.y); await wait(40); await page.mouse.click(p.x, p.y, o); await wait(120); };
  const scene = () => page.evaluate(() => PRIISK.g._sceneName);
  const objs = () => page.evaluate(() => Object.fromEntries(PRIISK.S.W.mission.objs.map(o => [o.id, o.state])));
  const shot = async name => {
    if (!SHOTS) return;
    const box = await page.evaluate(() => { const r = PRIISK.g.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    for (const th of ['retro', 'modern']) { await page.evaluate(t => PRIISK.g.setTheme(t), th); await wait(260); await page.screenshot({ path: path.join(SHOTS, `priisk-${name}-${th}.png`), clip: box }); }
  };
  const ff = (sec, until) => page.evaluate(([sec, until]) => { const W = PRIISK.S.W, f = until ? new Function('W', 'return ' + until) : null; for (let i = 0; i < sec * 60; i++) { PRIISK.campaign.tick(W, 1 / 60); if (f && f(W)) return true; } return false; }, [sec, until || null]);

  await test('меню: пункты «Скирмиш» и «Кампания»; клик мышью по «Кампания» → карта кампании', async () => {
    const items = await page.evaluate(() => PRIISK.g.menu.items('title')); ok(items[0] === 'play' && items.includes('campaign'), 'меню: ' + items);
    const y = await page.evaluate(() => { const m = PRIISK.g.menu.get('title'); return m.items[m.indexOf('campaign')]._y; });
    await click(480, y - 6); ok(await scene() === 'camp', 'сцена ' + await scene());
    const nodes = await page.evaluate(() => PRIISK.campUI._test.missionList().map(m => m.n + ':' + !!m.def)); ok(nodes.length === 10 && nodes[0] === '1:true' && nodes.slice(1).every(n => /:false$/.test(n)), 'узлы ' + nodes);
    const st = await page.evaluate(() => PRIISK.campUI._test.missionList().map(m => PRIISK.campUI._test.nodeState(m)).join()); ok(st === 'open,' + Array(9).fill('later').join(), 'состояния ' + st);
    await shot('m1-map');
  });
  await test('карта кампании: узел 2 — замок «В полной версии» и «Узнать больше», брифинг не открывается; узел 1 → брифинг миссии 1', async () => {
    const n = await page.evaluate(() => PRIISK.campUI._test.nodes);
    await click(n[1][0], n[1][1]); await shot('m1-locked');
    const hot = await page.evaluate(() => PRIISK.campUI._test.hot().length); ok(hot >= 13, 'нет кнопки «Узнать больше» на карточке: ' + hot);
    await click(n[1][0], n[1][1]); ok(await scene() === 'camp', 'закрытая миссия открылась (двойной клик)');
    await click(n[0][0], n[0][1]); await click(790, 450); ok(await scene() === 'brief', 'сцена ' + await scene());
    await shot('m1-brief');
  });
  await test('брифинг → «Начать»: миссия 1, Варвара и 2 стрелка, первая цель — Котельная', async () => {
    await click(660, 492); ok(await scene() === 'play'); const o = await objs(); ok(o.boiler === 'active' && o.smelter === 'hidden', JSON.stringify(o));
    const us = await page.evaluate(() => PRIISK.S.W.units.filter(u => u.owner === 0).map(u => u.type).sort().join(',')); ok(us === 'rifleman,rifleman,varvara', us);
    ok(await page.evaluate(() => !!PRIISK.S.hudOverlay && PRIISK.S.btnAllowed({ type: 'boiler' }) && !PRIISK.S.btnAllowed({ type: 'works' })), 'нет HUD кампании / разрешений');
  });
  async function buildByMouse(type) {
    const b = await page.evaluate(t => { const B = PRIISK.render.BTNS.find(b => b.type === t); return { x: B.x + 30, y: B.y + 20 }; }, type);
    await click(b.x, b.y); ok(await page.evaluate(t => PRIISK.S.W.players[0].build && PRIISK.S.W.players[0].build.type === t, type), 'заказ не принят: ' + type);
    await ff(40, 'W.players[0].build && W.players[0].build.ready'); await wait(250);
    ok(await page.evaluate(() => !!PRIISK.S.placing), 'нет призрака');
    const spot = await page.evaluate(t => { const L = PRIISK.logic, W = PRIISK.S.W, h = L.has(W, 0, 'hq'); const s = L.aiSpot(W, 0, t, h); return s; }, type);
    const d = await page.evaluate(t => PRIISK.logic.BLDS[t], type);
    const p = await scr(spot.i + d.w / 2, spot.j + d.h / 2); await page.mouse.move(p.x, p.y, { steps: 3 }); await wait(80); await page.mouse.click(p.x, p.y); await wait(200);
    ok(await page.evaluate(t => !!PRIISK.logic.has(PRIISK.S.W, 0, t), type), 'не поставлено: ' + type);
  }
  await test('миссия 1: Котельная мышью → цель выполнена, следующая — Плавильня; Плавильня → рудовоз; медь → Барак', async () => {
    await buildByMouse('boiler'); await ff(1); let o = await objs(); ok(o.boiler === 'done' && o.smelter === 'active', JSON.stringify(o));
    await buildByMouse('smelter'); await ff(1); o = await objs(); ok(o.smelter === 'done' && o.haul === 'active', JSON.stringify(o));
    ok(await page.evaluate(() => PRIISK.S.W.units.some(u => u.owner === 0 && u.type === 'hauler')), 'нет рудовоза');
    ok(await ff(120, 'W.mission.byObj.haul.state === "done"'), 'медь не привезли'); await ff(1); await wait(250);
    o = await objs(); ok(o.bunk === 'active', JSON.stringify(o));
    ok(await page.evaluate(() => PRIISK.S.say || PRIISK.S.sayQ.length), 'нет реплики Варвары');
    // кадр: камера на базу
    await page.evaluate(() => { const S = PRIISK.S, h = PRIISK.logic.has(S.W, 0, 'hq'); S.cam.x = Math.max(0, h.tx * 24 - 260); S.cam.y = Math.max(0, h.ty * 24 - 230); S.sel = new Set(S.W.units.filter(u => u.owner === 0 && u.type === 'varvara').map(u => u.id)); });
    await wait(200); await shot('m1-day');
  });
  await test('миссия 1: ночь по готовности — проверка Сизых приходит; Q — Клич Варвары', async () => {
    await page.evaluate(() => { const L = PRIISK.logic, W = PRIISK.S.W, h = L.has(W, 0, 'hq'); const s = L.aiSpot(W, 0, 'bunk', h); L.addBuilding(W, 0, 'bunk', s.i, s.j); for (let k = 0; k < 4; k++) { const u = L.addUnit(W, 0, 'rifleman', h.tx + 5 + k % 2, h.ty - 1 + (k >> 1)); } W.players[0].trained.rifleman = 4; });
    ok(await ff(60, 'W.units.some(u => u.tag === "check")'), 'проверка не пришла');
    ok(await page.evaluate(() => PRIISK.S.W.mission.night && PRIISK.S.W.sightMul < 0.7), 'не ночь');
    await ff(60, 'W.units.some(u => u.tag === "check" && W.units.some(m => m.owner === 0 && m.type !== "hauler" && Math.hypot(m.x - u.x, m.y - u.y) < 5))'); await ff(1.5);
    await page.keyboard.press('KeyQ'); await wait(100); ok(await page.evaluate(() => PRIISK.S.W.units.find(u => u.type === 'varvara').abOn > 0), 'Клич не сработал');
    await page.evaluate(() => { const S = PRIISK.S, W = S.W, h = PRIISK.logic.has(W, 0, 'hq'), e = W.units.find(u => u.tag === 'check') || { x: h.tx + 8, y: h.ty }, cx = (e.x + h.tx + 1.5) / 2, cy = (e.y + h.ty + 1.5) / 2; S.cam.x = Math.max(0, Math.min(W.w * 24 - 960, cx * 24 - 480)); S.cam.y = Math.max(0, Math.min(W.h * 24 - 428, cy * 24 - 214)); });
    await wait(300); await shot('m1-night');
  });
  await test('пауза: «Заново» есть; Esc → пауза → «В меню»', async () => {
    await page.keyboard.press('KeyP'); await wait(250); ok(await scene() === 'pause'); ok((await page.evaluate(() => PRIISK.g.menu.items('pause'))).includes('restart'));
    const y = await page.evaluate(() => { const m = PRIISK.g.menu.get('pause'); return m.items[m.indexOf('menu')]._y; }); await click(480, y - 6); ok(await scene() === 'title', await scene());
  });
  await test('?mission=m2 в демо игнорируется: брифинга миссии 2 нет', async () => {
    const p2 = await ctx.newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message));
    await p2.goto(URL0 + '?mission=m2'); await wait(400);
    ok(await p2.evaluate(() => PRIISK.g._sceneName) === 'title', 'сцена ' + await p2.evaluate(() => PRIISK.g._sceneName));
    ok(await p2.evaluate(() => !PRIISK.campaign.byId('m2') && PRIISK.MISSIONS.length === 1), 'm2 загружена в демо');
    ok(!errs.length, errs.join(' | ')); await p2.close();
  });
  await test('сборка с флагом full без файла m2 (404) не ломается: миссия 1 и скирмиш на месте, узел 2 — «скоро»', async () => {
    const p2 = await ctx.newPage(); const errs = [];
    p2.on('pageerror', e => errs.push(e.message)); p2.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p2.route('**/priisk/js/edition.js', async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("var PRIISK_EDITION = 'demo';", "var PRIISK_EDITION = 'full';") }); });
    await p2.goto(URL0); await wait(500);
    const st = await p2.evaluate(() => ({ b: PRIISK.Edition.BUILD, miss: PRIISK.missionMissing.join(), ids: PRIISK.MISSIONS.map(m => m.id).join(), sc: PRIISK.g._sceneName }));
    ok(st.b === 'full' && st.miss === 'm2,m3,m4' && st.ids === 'm1' && st.sc === 'title', JSON.stringify(st));
    await p2.evaluate(() => PRIISK.g.goto('camp')); await wait(200);
    ok(await p2.evaluate(() => PRIISK.campUI._test.missionList()[1].def === null && PRIISK.Edition.stub(PRIISK.EDITION) === 'soon'), 'узел 2');
    ok(!errs.length, errs.join(' | ')); await p2.close();
  });
  await test('победа в миссии 1 → итог → «Далее» → «Продолжение — в полной версии»; «На карту кампании» и «Узнать больше» → ../', async () => {
    await page.evaluate(() => PRIISK.campaign.reset(localStorage));
    const y = await page.evaluate(() => { const m = PRIISK.g.menu.get('title'); return m.items[m.indexOf('campaign')]._y; }); await click(480, y - 6);
    const n = await page.evaluate(() => PRIISK.campUI._test.nodes); await click(n[0][0], n[0][1]); await click(790, 450); await click(660, 492);
    ok(await scene() === 'play' && await page.evaluate(() => PRIISK.S.W.mission.id === 'm1'), 'миссия 1 не началась');
    await page.evaluate(() => { const W = PRIISK.S.W; W.mission.winAt = W.time; });
    for (let i = 0; i < 40 && await scene() !== 'result'; i++) await wait(150);
    ok(await scene() === 'result', 'нет экрана итога: ' + await scene());
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('arcade.priisk.campaign')).missions.m1), 'победа не сохранена');
    await shot('demo-result');
    await click(480 - 250 + 120, 478); ok(await scene() === 'edition', '«Далее» → ' + await scene());
    const txt = await page.evaluate(() => PRIISK.g.t('demoTitle')); ok(/полной версии/.test(txt), txt);
    await shot('demo-edition');
    const hot = await page.evaluate(() => PRIISK.campUI._test.hot().map(b => [b.x + b.w / 2, b.y + b.h / 2]));
    ok(hot.length === 2, 'кнопок: ' + hot.length);
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }), click(hot[1][0], hot[1][1])]);
    await pop.waitForLoadState().catch(() => {}); ok(new URL(pop.url()).pathname === '/', '«Узнать больше» → ' + pop.url()); await pop.close();
    ok(await scene() === 'edition', 'после «Узнать больше» ушли с экрана');
    await click(hot[0][0], hot[0][1]); ok(await scene() === 'camp', '«На карту кампании» → ' + await scene());
    ok(await page.evaluate(() => PRIISK.campUI._test.nodeState(PRIISK.campUI._test.missionList()[0])) === 'done', 'узел 1 не «пройдено»');
    // клавиатура: Esc на экране демо → карта
    await page.evaluate(() => PRIISK.g.goto('edition')); await wait(100); await page.keyboard.press('Escape'); await wait(150); ok(await scene() === 'camp', 'Esc → ' + await scene());
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
  await ctx.close();
} finally {
  await browser.close(); if (srv) srv.close();
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

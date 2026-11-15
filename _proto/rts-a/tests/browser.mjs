/* ПРИИСК · tests/browser.mjs — проверка в браузере (Playwright) настоящей мышью и тачем + скриншоты.
   Запуск из корня репо: node _proto/rts-a/tests/browser.mjs [папка-для-скриншотов]
   Сервер: если на :8351 уже отвечает http.server — используется он, иначе поднимается свой статический на :8351.
   Проверяет: старт по Enter; рамка мышью выделяет 4 стартовых юнита; Shift+клик снимает; двойной клик — все стрелки;
   ПКМ — приказ идти (юниты сдвинулись); Ctrl+1 / 1 — группа; заказ Котельной кнопкой панели и постановка призраком;
   курсор «нельзя» над скалой и «атака» над врагом; средняя кнопка, колесо, клик по мини-карте двигают камеру;
   тач (CDP): тап — выбор, долгий тап — приказ, два пальца — камера; P пауза, T тема, L язык; 0 ошибок консоли. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const PORT = 8351, URL0 = `http://localhost:${PORT}/_proto/rts-a/`;
const SHOTS = process.argv[2] || null;
let srv = null;
async function up() { try { const r = await fetch(URL0); return r.ok; } catch { return false; } }
if (!(await up())) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
  srv = http.createServer((q, s) => { let f = path.join(REPO, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
  await new Promise(r => srv.listen(PORT, r));
}

let passed = 0, failed = 0; const errors = [];
async function test(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL0 + '?seed=5'); await wait(400);
  // мир → экран (CSS-пиксели страницы)
  const scr = (x, y) => page.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), S = PRIISK.S, k = r.width / 960; return { x: r.left + (x * 24 - S.cam.x) * k, y: r.top + (y * 24 - S.cam.y) * k }; }, [x, y]);
  const cv = (x, y) => page.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), k = r.width / 960; return { x: r.left + x * k, y: r.top + y * k }; }, [x, y]);
  const st = () => page.evaluate(() => { const S = PRIISK.S; return { scene: PRIISK.g._sceneName, sel: [...S.sel], cam: { ...S.cam }, cursor: PRIISK.g.canvas.style.cursor, placing: !!S.placing, theme: PRIISK.g.themeName, lang: PRIISK.g.i18n.lang }; });
  const units0 = () => page.evaluate(() => PRIISK.S.W.units.filter(u => u.owner === 0).map(u => ({ id: u.id, type: u.type, x: u.x, y: u.y, o: u.order.t })));

  await test('меню → старт по Enter', async () => { await page.keyboard.press('Enter'); await wait(300); ok((await st()).scene === 'play'); });
  await page.evaluate(() => { PRIISK.S.W.ai = null; }); // ИИ не мешает проверкам ввода

  await test('рамка мышью (page.mouse) выделяет 4 стартовых юнита', async () => {
    const us = await units0(); const xs = us.map(u => u.x), ys = us.map(u => u.y);
    const a = await scr(Math.min(...xs) - 1, Math.min(...ys) - 1), b = await scr(Math.max(...xs) + 1, Math.max(...ys) + 1);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    const s = await st(); ok(s.sel.length === 4, 'выделено ' + s.sel.length);
  });
  await test('Shift+клик снимает юнит с выделения; двойной клик — все стрелки на экране', async () => {
    const us = await units0(), c = us.find(u => u.type === 'crawler'), r = us.find(u => u.type === 'rifleman');
    const p = await scr(c.x, c.y); await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
    ok((await st()).sel.length === 3, 'Shift+клик'); await wait(400);
    const q = await scr(r.x, r.y); await page.mouse.dblclick(q.x, q.y);
    const s = await st(); ok(s.sel.length === 3 && us.filter(u => s.sel.includes(u.id)).every(u => u.type === 'rifleman'), 'двойной клик: ' + s.sel.length);
  });
  await test('ПКМ по земле — приказ идти, юниты двигаются', async () => {
    const before = await units0(), hq = await page.evaluate(() => { const h = PRIISK.logic.has(PRIISK.S.W, 0, 'hq'); return { x: h.tx, y: h.ty }; });
    const t = await scr(hq.x + 9, hq.y - 3); await page.mouse.click(t.x, t.y, { button: 'right' }); await wait(1200);
    const after = await units0(), sel = (await st()).sel;
    const moved = after.filter(u => sel.includes(u.id)).filter(u => { const b = before.find(z => z.id === u.id); return Math.hypot(u.x - b.x, u.y - b.y) > 0.8; });
    ok(moved.length === sel.length, 'сдвинулись ' + moved.length + ' из ' + sel.length);
  });
  await test('группы: Ctrl+1 запоминает, клик по пустому сбрасывает, 1 — возвращает', async () => {
    const sel = (await st()).sel; await page.keyboard.press('Control+Digit1');
    const e = await cv(480, 60); await page.mouse.click(e.x, e.y); ok((await st()).sel.length === 0, 'не сбросилось');
    await page.keyboard.press('Digit1'); const s = await st(); ok(JSON.stringify(s.sel.sort()) === JSON.stringify(sel.sort()), 'группа не вернулась');
  });
  await test('курсор: «нельзя» над скалой, «атака» над врагом', async () => {
    const rock = await page.evaluate(() => { const W = PRIISK.S.W, S = PRIISK.S; for (let j = Math.ceil(S.cam.y / 24); j < (S.cam.y + 400) / 24; j++) for (let i = Math.ceil(S.cam.x / 24); i < (S.cam.x + 940) / 24; i++) if (W.t[j * W.w + i] === 1 && W.vis[j * W.w + i]) return { x: i + 0.5, y: j + 0.5 }; return null; });
    ok(rock, 'скалы на экране нет'); const p = await scr(rock.x, rock.y); await page.mouse.move(p.x, p.y); await wait(80);
    ok((await st()).cursor === 'not-allowed', 'курсор над скалой: ' + (await st()).cursor);
    const en = await page.evaluate(() => { const S = PRIISK.S, L = PRIISK.logic, f = S.W.byId[[...S.sel][0]], u = L.addUnit(S.W, 1, 'rifleman', f.x + 2.5, f.y + 0.5); L.updateVis(S.W); return { x: u.x, y: u.y }; });
    const q = await scr(en.x, en.y); await page.mouse.move(q.x, q.y); await wait(80);
    ok(/ff5a4e|crosshair/.test((await st()).cursor), 'курсор над врагом: ' + (await st()).cursor.slice(0, 40));
    await page.mouse.click(q.x, q.y, { button: 'right' }); await wait(100);
    const ord = await page.evaluate(() => [...PRIISK.S.sel].map(id => PRIISK.S.W.byId[id] && PRIISK.S.W.byId[id].order.t));
    ok(ord.every(o => o === 'attack'), 'ПКМ по врагу — не атака: ' + ord);
  });
  await test('панель: заказ Котельной кнопкой, постройка призраком по сетке (занятое — нельзя)', async () => {
    const b = await page.evaluate(() => { const B = PRIISK.render.BTNS[0]; return { x: B.x + 30, y: B.y + 20 }; });
    const p = await cv(b.x, b.y); await page.mouse.click(p.x, p.y);
    ok(await page.evaluate(() => !!PRIISK.S.W.players[0].build), 'стройка не началась');
    await page.evaluate(() => { const W = PRIISK.S.W; for (let i = 0; i < 700; i++) PRIISK.logic.step(W, 1 / 60); }); await wait(200);
    ok((await st()).placing, 'не перешли в режим постановки');
    const hq = await page.evaluate(() => { const h = PRIISK.logic.has(PRIISK.S.W, 0, 'hq'); return { x: h.tx, y: h.ty }; });
    const bad = await scr(hq.x + 1.5, hq.y + 1.5); await page.mouse.move(bad.x, bad.y); await page.mouse.click(bad.x, bad.y);
    ok((await st()).placing, 'поставили на контору');
    let placed = false;
    for (const [dx, dy] of [[5, 1], [5, -2], [1, -3], [-2, 1], [4, 4]]) {
      const g = await scr(hq.x + dx, hq.y + dy); await page.mouse.move(g.x, g.y); await wait(50);
      if (await page.evaluate(() => PRIISK.S.placing && PRIISK.S.placing.ok)) { await page.mouse.click(g.x, g.y); placed = true; break; }
    }
    ok(placed && !(await st()).placing && await page.evaluate(() => !!PRIISK.logic.has(PRIISK.S.W, 0, 'boiler')), 'котельная не поставлена');
  });
  await test('камера: средняя кнопка, колесо, стрелки, клик по мини-карте', async () => {
    const c0 = (await st()).cam; const m = await cv(480, 200);
    await page.mouse.move(m.x, m.y); await page.mouse.down({ button: 'middle' }); await page.mouse.move(m.x - 150, m.y - 100, { steps: 5 }); await page.mouse.up({ button: 'middle' });
    const c1 = (await st()).cam; ok(c1.x > c0.x + 50 || c1.y < c0.y - 50 || c1.y > c0.y + 50, 'средняя кнопка: ' + JSON.stringify([c0, c1]));
    await page.mouse.wheel(0, -300); await wait(50); const c2 = (await st()).cam; ok(c2.y < c1.y || c1.y === 0, 'колесо');
    await page.keyboard.down('ArrowRight'); await wait(300); await page.keyboard.up('ArrowRight'); ok((await st()).cam.x > c2.x, 'стрелка');
    const mm = await page.evaluate(() => PRIISK.render.LAYOUT.MM); const t = await cv(mm.x + 30 * mm.s, mm.y + 10 * mm.s);
    await page.mouse.click(t.x, t.y); const c3 = (await st()).cam; ok(Math.abs(c3.x - (30 * 24 - 480)) < 30 && Math.abs(c3.y - Math.max(0, 10 * 24 - 214)) < 30, 'мини-карта: ' + JSON.stringify(c3));
    await page.keyboard.press('KeyH');
  });
  await test('клавиши движка: P пауза и обратно, T тема, L язык', async () => {
    await page.keyboard.press('KeyP'); ok((await st()).scene === 'pause'); await page.keyboard.press('Enter'); await wait(100); ok((await st()).scene === 'play', 'не вернулись');
    const t0 = (await st()).theme; await page.keyboard.press('KeyT'); ok((await st()).theme !== t0); await page.keyboard.press('KeyT');
    await page.keyboard.press('KeyL'); ok((await st()).lang === 'en'); await page.keyboard.press('KeyL'); ok((await st()).lang === 'ru');
  });
  await page.close();

  // ---------- тач (CDP, настоящие touch-события) ----------
  await test('тач: тап — выбор, долгий тап — приказ, протяжка — рамка, два пальца — камера', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, isMobile: false });
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push('pageerror(touch): ' + e.message));
    await p.goto(URL0 + '?seed=5'); await wait(300); await p.keyboard.press('Enter'); await wait(300);
    await p.evaluate(() => { PRIISK.S.W.ai = null; });
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: q.id == null ? i : q.id })) });
    const scrT = (x, y) => p.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), S = PRIISK.S, k = r.width / 960; return { x: r.left + (x * 24 - S.cam.x) * k, y: r.top + (y * 24 - S.cam.y) * k }; }, [x, y]);
    const u = await p.evaluate(() => { const c = PRIISK.S.W.units.find(u => u.owner === 0 && u.type === 'crawler'); return { id: c.id, x: c.x, y: c.y }; });
    const a = await scrT(u.x, u.y); await touch('touchStart', [a]); await wait(60); await touch('touchEnd', []); await wait(80);
    ok(await p.evaluate(id => PRIISK.S.sel.has(id) && PRIISK.S.sel.size === 1, u.id), 'тап не выбрал');
    const t = await scrT(u.x + 6, u.y - 3); await touch('touchStart', [t]); await wait(650); await touch('touchEnd', []); await wait(100);
    ok(await p.evaluate(id => PRIISK.S.W.byId[id].order.t === 'move', u.id), 'долгий тап не дал приказ');
    const us = await p.evaluate(() => PRIISK.S.W.units.filter(u => u.owner === 0).map(u => [u.x, u.y]));
    const x0 = Math.min(...us.map(q => q[0])) - 1, y0 = Math.min(...us.map(q => q[1])) - 1, x1 = Math.max(...us.map(q => q[0])) + 1, y1 = Math.max(...us.map(q => q[1])) + 1;
    const b0 = await scrT(x0, y0), b1 = await scrT(x1, y1);
    await touch('touchStart', [b0]); for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ x: b0.x + (b1.x - b0.x) * k / 5, y: b0.y + (b1.y - b0.y) * k / 5 }]); await wait(16); } await touch('touchEnd', []); await wait(80);
    ok(await p.evaluate(() => PRIISK.S.sel.size === 4), 'протяжка не выделила 4: ' + await p.evaluate(() => PRIISK.S.sel.size));
    const c0 = await p.evaluate(() => ({ ...PRIISK.S.cam }));
    const m1 = { x: 500, y: 250, id: 1 }, m2 = { x: 700, y: 250, id: 2 };
    await touch('touchStart', [m1, m2]); for (let k = 1; k <= 6; k++) { await touch('touchMove', [{ x: m1.x - k * 25, y: m1.y - k * 15, id: 1 }, { x: m2.x - k * 25, y: m2.y - k * 15, id: 2 }]); await wait(16); } await touch('touchEnd', []); await wait(80);
    const c1 = await p.evaluate(() => ({ ...PRIISK.S.cam }));
    ok(c1.x > c0.x + 40 || c1.y > c0.y + 40, 'два пальца не двигают камеру: ' + JSON.stringify([c0, c1]));
    ok(await p.evaluate(() => PRIISK.S.sel.size === 4), 'два пальца сбили выделение');
    await ctx.close();
  });

  // ---------- скриншоты: партия «на автопилоте» на 6-й минуте, обе темы ----------
  if (SHOTS) await test('скриншоты retro/modern (1280×720, кроп по canvas)', async () => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', e => errors.push('pageerror(shots): ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console(shots): ' + m.text()); });
    await p.goto(URL0 + '?seed=3'); await wait(300); await p.keyboard.press('Enter'); await wait(300);
    await p.evaluate(() => {
      const L = PRIISK.logic, S = PRIISK.S, W = S.W, A0 = L.newAI(W, 0);
      const hq0 = L.has(W, 0, 'hq'); let fightT = -1;
      for (let i = 0; i < 20 * 600 && W.winner < 0; i++) { // до первой стычки у базы игрока (+4 с), но не дольше 10 минут
        L.aiStep(W, 1 / 20, A0); L.step(W, 1 / 20);
        if (fightT < 0 && W.time > 200 && W.units.some(u => u.owner === 1 && W.vis[Math.floor(u.y) * W.w + Math.floor(u.x)] === 2 && Math.hypot(u.x - hq0.tx, u.y - hq0.ty) < 16)) fightT = W.time;
        if (fightT > 0 && W.time > fightT + 4) break;
      }
      W.events.length = 0; S.msgs.length = 0;
      // камера — туда, где у игрока больше всего своих и чужих рядом (бой), иначе на базу
      let best = null, bs = -1;
      W.units.filter(u => u.owner === 0).forEach(u => { const s = W.units.filter(e => Math.hypot(e.x - u.x, e.y - u.y) < 9).length + (W.units.some(e => e.owner === 1 && Math.hypot(e.x - u.x, e.y - u.y) < 8) ? 6 : 0); if (s > bs) { bs = s; best = u; } });
      const hq = L.has(W, 0, 'hq'); const c = best || { x: hq.tx, y: hq.ty };
      S.cam.x = c.x * 24 - 480; S.cam.y = c.y * 24 - 214; S.cam.x = Math.max(0, Math.min(W.w * 24 - 960, S.cam.x)); S.cam.y = Math.max(0, Math.min(W.h * 24 - 428, S.cam.y));
      S.sel = new Set(W.units.filter(u => u.owner === 0 && u.type !== 'hauler' && Math.hypot(u.x - c.x, u.y - c.y) < 6).map(u => u.id));
    });
    const box = await p.evaluate(() => { const r = PRIISK.g.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    for (const th of ['retro', 'modern']) {
      await p.evaluate(t => PRIISK.g.setTheme(t), th); await wait(250);
      await p.screenshot({ path: path.join(SHOTS, `rts-a-${th}.png`), clip: box });
    }
    await p.close();
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); if (srv) srv.close();
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

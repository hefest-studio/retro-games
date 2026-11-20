/* ПРИИСК · tests/campaign-sizye-browser.mjs — Артель Сизого Перевала в браузере (Playwright, ДЕМО): пункт меню «Сторона»,
   скирмиш за Сизых (свои кнопки, ветер на панели, ветряк мышью — кнопка и призрак на гребне, канатка с люльками, ИИ Медного
   Ключа), точка сбора у Зимовья и Верфи мышью, пункт «Соседи» и скирмиш против ИИ-Сизых (ветряки, канатка, забои), карта
   кампаний (вкладки; «Долг перевала» в демо — под замком), ?mission=s1 в демо игнорируется, 0 ошибок.
   Скриншоты: priisk-skirmish-sizye-*, priisk-ai-sizye-*, priisk-sizye-map-* (обе темы). Миссии С1–С5 — в полной сборке (arcade-full).
   Запуск из корня репо: node priisk/tests/campaign-sizye-browser.mjs [папка-для-скриншотов] (сервер — PORT, по умолчанию 8392) */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const PORT = +(process.env.PORT || 8392), URL0 = `http://localhost:${PORT}/priisk/`;
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
  const cv = (x, y) => page.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), k = r.width / 960; return { x: r.left + x * k, y: r.top + y * k }; }, [x, y]);
  const scr = (x, y) => page.evaluate(([x, y]) => { const r = PRIISK.g.canvas.getBoundingClientRect(), S = PRIISK.S, k = r.width / 960; return { x: r.left + (x * 24 - S.cam.x) * k, y: r.top + (y * 24 - S.cam.y) * k }; }, [x, y]);
  const click = async (x, y, o) => { const p = await cv(x, y); await page.mouse.move(p.x, p.y); await wait(40); await page.mouse.click(p.x, p.y, o); await wait(120); };
  const clickW = async (x, y, o) => { const p = await scr(x, y); await page.mouse.move(p.x, p.y); await wait(60); await page.mouse.click(p.x, p.y, o); await wait(120); };
  const scene = () => page.evaluate(() => PRIISK.g._sceneName);
  const look = (x, y) => page.evaluate(([x, y]) => { const S = PRIISK.S, W = S.W; S.cam.x = Math.max(0, Math.min(W.w * 24 - 960, x * 24 - 480)); S.cam.y = Math.max(0, Math.min(W.h * 24 - 428, y * 24 - 214)); }, [x, y]);
  const shot = async name => {
    if (!SHOTS) return;
    const box = await page.evaluate(() => { const r = PRIISK.g.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    for (const th of ['retro', 'modern']) { await page.evaluate(t => PRIISK.g.setTheme(t), th); await wait(300); await page.screenshot({ path: path.join(SHOTS, `priisk-${name}-${th}.png`), clip: box }); }
  };

  await page.goto(URL0 + '?lang=ru'); await wait(400);
  await page.evaluate(() => { PRIISK.g.setTheme('modern'); try { localStorage.removeItem('arcade.priisk.side'); } catch (e) {} });

  await test('меню: пункт «Сторона» между «Скирмиш» и «Кампания»; выбор переключает Медный Ключ ↔ Сизый Перевал (и помнит)', async () => {
    const keys = await page.evaluate(() => PRIISK.g.menu.items()); const i = keys.indexOf('side');
    ok(i > keys.indexOf('play') && i < keys.indexOf('campaign'), 'порядок ' + keys.join());
    const r = await page.evaluate(() => { const m = PRIISK.g.menu.get(), it = m.items[m.indexOf('side')], a = it.label(); it.onSelect(); const b = it.label(); return { a, b, side: PRIISK.SKIRMISH_SIDE, ls: localStorage.getItem('arcade.priisk.side') }; });
    ok(/Медный Ключ/.test(r.a) && /Сизый Перевал/.test(r.b) && r.side === 'sizye' && r.ls === 'sizye', JSON.stringify(r));
  });
  await test('скирмиш за Сизых: свои кнопки, изба-контора, ветер на панели; ветряк — кнопкой и призраком мышью (только на гребне)', async () => {
    await page.evaluate(() => { PRIISK.g.goto('play'); }); await wait(500);
    const st = await page.evaluate(() => { const W = PRIISK.S.W; return { fac: W.fac, btn: PRIISK.render.BTNS.map(b => b.type).join(), look: PRIISK.logic.has(W, 0, 'hq').look, wind: !!W.wind }; });
    ok(st.fac && st.fac[0] === 'sizye' && st.btn === 'mill,pylon,hut,station,face,sail,ranger,skiff,harpoon' && st.look === 'sizye' && st.wind, JSON.stringify(st));
    const b = await page.evaluate(() => PRIISK.render.BTNS.find(b => b.type === 'mill'));
    await click(b.x + 20, b.y + 20); await page.evaluate(() => { PRIISK.S.W.players[0].build.p = 0.999; }); await wait(200);
    await click(b.x + 20, b.y + 20); ok(await page.evaluate(() => !!PRIISK.S.placing), 'нет призрака');
    const sp = await page.evaluate(() => { const L = PRIISK.logic, W = PRIISK.S.W, hq = L.has(W, 0, 'hq'); for (let r = 2; r < 9; r++) for (let j = hq.ty - r; j <= hq.ty + r; j++) for (let i = hq.tx - r; i <= hq.tx + r; i++) if (L.canPlace(W, 0, 'mill', i, j)) return { i, j }; return null; });
    ok(sp, 'нет гребня у базы'); await look(sp.i, sp.j); await wait(100); await clickW(sp.i + 1, sp.j + 1);
    ok(await page.evaluate(() => PRIISK.S.W.blds.some(b => b.type === 'mill' && b.owner === 0)), 'ветряк не встал');
  });
  await test('скирмиш за Сизых: канатка возит медь люльками; ИИ Медного Ключа строит базу (латунь); скриншоты обеих тем', async () => {
    const r = await page.evaluate(() => { const L = PRIISK.logic, W = PRIISK.S.W, hq = L.has(W, 0, 'hq'), pl = W.players[0]; pl.copper = 9000;
      const put = (t, x, y, rr = 9) => { for (let r = 0; r < rr; r++) for (let j = Math.round(y) - r; j <= Math.round(y) + r; j++) for (let i = Math.round(x) - r; i <= Math.round(x) + r; i++) if (L.canPlace(W, 0, t, i, j)) return L.addBuilding(W, 0, t, i, j); return null; };
      put('mill', hq.tx, hq.ty - 4); put('station', hq.tx + 4, hq.ty - 1); put('hut', hq.tx - 1, hq.ty - 4); put('sail', hq.tx + 1, hq.ty - 7);
      let ore = null, bd = 1e9; for (let k = 0; k < W.w * W.h; k++) if (W.ore[k] > 0) { const d = Math.hypot(k % W.w - hq.tx, Math.floor(k / W.w) - hq.ty); if (d < bd) { bd = d; ore = { x: k % W.w, y: Math.floor(k / W.w) }; } }
      for (let n = 0; n < 4 && !put('face', ore.x, ore.y, 4); n++) { let best = null, b2 = 1e9; L.cableNodes(W, 0).forEach(nd => { const c = L.center(nd); for (let j = Math.floor(c.y - 7); j <= c.y + 7; j++) for (let i = Math.floor(c.x - 7); i <= c.x + 7; i++) if (Math.hypot(i + .5 - c.x, j + .5 - c.y) <= 7.2 && L.canPlace(W, 0, 'pylon', i, j)) { const d = Math.hypot(i - ore.x, j - ore.y); if (d < b2) { b2 = d; best = { i, j }; } } }); if (best) L.addBuilding(W, 0, 'pylon', best.i, best.j); }
      L.calcPower(W); L.addUnit(W, 0, 'harpoon', hq.tx + 4.5, hq.ty + 4.5); L.addUnit(W, 0, 'skiff', hq.tx + 6.5, hq.ty + 3.5);
      return { face: W.blds.some(b => b.type === 'face' && b.owner === 0), ore }; });
    ok(r.face, 'забой не встал');
    for (let t = 0; t < 40; t++) { await wait(250); if (await page.evaluate(() => PRIISK.S.W.cars.length > 0)) break; }
    ok(await page.evaluate(() => PRIISK.S.W.cars.length > 0), 'люлек нет');
    await page.evaluate(() => { const W = PRIISK.S.W, L = PRIISK.logic, hq = L.has(W, 0, 'hq'), S = PRIISK.S; S.cam.x = Math.max(0, hq.tx * 24 - 330); S.cam.y = Math.max(0, Math.min(W.h * 24 - 428, hq.ty * 24 - 270)); });
    await shot('skirmish-sizye');
    const ai = await page.evaluate(() => { const W = PRIISK.S.W; return { pi: PRIISK.logic.has(W, 1, 'hq').pi, ai: !!W.ai }; }); ok(ai.pi === 0 && ai.ai, JSON.stringify(ai));
  });
  await test('точка сбора у Зимовья и Верфи: выбрать здание ЛКМ, ПКМ по земле — флажок; новый стрелок идёт туда', async () => {
    for (const t of ['hut', 'sail']) {
      const b = await page.evaluate(t => { const W = PRIISK.S.W, b = W.blds.find(x => x.owner === 0 && x.type === t); return b && { tx: b.tx, ty: b.ty, w: b.w, h: b.h }; }, t); ok(b, 'нет ' + t);
      await look(b.tx + 1, b.ty + 1); await wait(100); await clickW(b.tx + b.w / 2, b.ty + b.h / 2);
      ok(await page.evaluate(t => { const S = PRIISK.S, e = S.W.byId[[...S.sel][0]]; return S.sel.size === 1 && e && e.type === t; }, t), t + ' не выбрано');
      const tgt = await page.evaluate(([x, y]) => { const L = PRIISK.logic, W = PRIISK.S.W, np = L.nearestPassable(W, x, y, 6); return { x: np.i + 0.5, y: np.j + 0.5 }; }, [b.tx + b.w + 3, b.ty + b.h + 2]);
      await clickW(tgt.x, tgt.y, { button: 'right' });
      const r = await page.evaluate(t => { const W = PRIISK.S.W, b = W.blds.find(x => x.owner === 0 && x.type === t); return b.rally; }, t); ok(r && Math.hypot(r.x - tgt.x, r.y - tgt.y) < 0.8, t + ': точка сбора ' + JSON.stringify(r));
      if (t === 'hut') { await page.evaluate(() => { const L = PRIISK.logic, W = PRIISK.S.W; W.players[0].inf = []; W.players[0].infP = 0.99; L.queueUnit(W, 0, 'ranger'); }); await wait(900);
        ok(await page.evaluate(([x, y]) => PRIISK.S.W.units.some(u => u.owner === 0 && u.type === 'ranger' && u.order.t === 'move' && Math.hypot(u.order.x - x, u.order.y - y) < 2.5), [tgt.x, tgt.y]), 'стрелок не пошёл к точке сбора'); }
    }
  });
  await test('скирмиш против ИИ-Сизых: пункт «Соседи» (котельные / ветряки и канатка); ИИ ставит ветряки на гребнях, канатку, забои, верфь; скриншоты', async () => {
    const keys = await page.evaluate(() => PRIISK.g.menu.items()); ok(keys.indexOf('foe') === keys.indexOf('side') + 1, 'порядок ' + keys.join());
    const r = await page.evaluate(() => { const m = PRIISK.g.menu.get(), side = m.items[m.indexOf('side')], foe = m.items[m.indexOf('foe')]; if (PRIISK.SKIRMISH_SIDE === 'sizye') side.onSelect(); const a = foe.label(); foe.onSelect(); return { a, b: foe.label(), foe: PRIISK.SKIRMISH_FOE, ls: localStorage.getItem('arcade.priisk.foe') }; });
    ok(/котельных/.test(r.a) && /ветряки/.test(r.b) && r.foe === 'sizye' && r.ls === 'sizye', JSON.stringify(r));
    await page.evaluate(() => { PRIISK.S.W = null; PRIISK.g.goto('play'); }); await wait(500);
    const st = await page.evaluate(() => { const W = PRIISK.S.W; return { fac: W.fac, sz: !!W.ai.sz, btn: PRIISK.render.BTNS.map(b => b.type).join() }; });
    ok(st.fac && st.fac[0] === 'copper' && st.fac[1] === 'sizye' && st.sz && st.btn === 'boiler,bunk,smelter,works,rifleman,crawler,ironwagon,hauler', JSON.stringify(st));
    const g = await page.evaluate(() => { const L = PRIISK.logic, W = PRIISK.S.W; for (let i = 0; i < 2400; i++) L.step(W, 0.1); W.events.length = 0; L.updateVis(W);
      const n = t => W.blds.filter(b => b.owner === 1 && b.type === t).length; return { mill: n('mill'), on: W.blds.filter(b => b.owner === 1 && b.type === 'mill' && b.pw > 0).length, st: n('station'), face: W.blds.filter(b => b.owner === 1 && b.type === 'face' && b.link).length, sail: n('sail'), mined: W.players[1].mined, cars: W.cars.length }; });
    ok(g.on >= 2 && g.st && g.face >= 2 && g.sail && g.mined > 1500, JSON.stringify(g));
    await page.evaluate(() => { const W = PRIISK.S.W, L = PRIISK.logic, hq = L.has(W, 1, 'hq'); for (let j = 0; j < W.h; j++) for (let i = Math.max(0, hq.tx - 34); i < W.w; i++) if (j < hq.ty + 16) W.vis[j * W.w + i] = 2; const S = PRIISK.S; S.cam.x = Math.max(0, Math.min(W.w * 24 - 960, (hq.tx - 9) * 24)); S.cam.y = 0; });
    for (let t = 0; t < 20; t++) { await wait(150); if (await page.evaluate(() => PRIISK.S.W.cars.length > 0)) break; }
    await shot('ai-sizye');
    await page.evaluate(() => { const m = PRIISK.g.menu.get(), foe = m.items[m.indexOf('foe')]; foe.onSelect(); });
  });
  await test('кампания в демо: вкладки Медный Ключ / Сизый Перевал; «Долг перевала» целиком под замком «В полной версии»; ?mission=s1 игнорируется', async () => {
    await page.evaluate(() => PRIISK.g.goto('camp')); await wait(300);
    await click(560, 43); ok(await page.evaluate(() => PRIISK.campUI._test.camp()) === 'sizye', 'вкладка не переключилась');
    const ns = await page.evaluate(() => PRIISK.campUI._test.missionList().map(m => m.n + ':' + PRIISK.campUI._test.nodeState(m)).join());
    ok(ns === [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => n + ':later').join(), ns);
    const n0 = await page.evaluate(() => PRIISK.campUI._test.nodesS[0]); await click(n0[0], n0[1]); await wait(150); await shot('sizye-map');
    await click(n0[0], n0[1]); ok(await scene() === 'camp', 'замок открыл брифинг');
    await click(400, 43); ok(await page.evaluate(() => PRIISK.campUI._test.camp()) === 'copper');
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('p2: ' + e.message));
    await p2.goto(URL0 + '?mission=s1'); await wait(400); ok(await p2.evaluate(() => PRIISK.g._sceneName) !== 'brief', 'брифинг s1 в демо'); await p2.close();
  });
  await test('ошибок в браузере нет', async () => { ok(!errors.length, errors.slice(0, 5).join(' | ')); });
} finally { await browser.close(); if (srv) srv.close(); }
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

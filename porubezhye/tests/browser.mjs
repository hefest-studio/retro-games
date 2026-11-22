/* ПОРУБЕЖЬЕ · tests/browser.mjs — демо в браузере (Playwright): движок кампании подключён, но миссий нет; меню (Играть, Раса, «Кампания · в полной версии»), экран
   «Кампания — в полной версии» («Вернуться в меню», «Узнать больше» → ../), старт по Enter, пауза P, тема T, язык L,
   третья раса (Курганный род) в скирмише демо, пункты скирмиша «Соперник» / «ИИ» / «Карта» (по кругу, сохраняются, старт с выбором), 0 ошибок консоли. Скриншоты (если указана папка): porubezhye-{retro,modern}.png — геймплей рас-соперников
   (партия на автопилоте у игрока, ~5-я минута, кроп по canvas 1280×720), porubezhye-barrow-{retro,modern}.png — то же за Курганный род,
   porubezhye-edition-{retro,modern}.png, выбор в меню porubezhye-menu-{map,ai}-* и карты porubezhye-map-{pass,wide,grove}-*.
   Запуск из корня репо: node porubezhye/tests/browser.mjs [папка-для-скриншотов]
   Сервер: если на PORT (по умолчанию 8352) уже отвечает http.server над репо — используется он, иначе поднимается свой. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const PORT = +(process.env.PORT || 8352), URL0 = `http://localhost:${PORT}/porubezhye/`;
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
  await page.goto(URL0 + '?lang=ru'); await wait(500);
  const scene = () => page.evaluate(() => PORUB.g._sceneName);
  const box = () => page.evaluate(() => { const r = PORUB.g.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  const shot = async name => { if (!SHOTS) return; const b = await box(); for (const th of ['retro', 'modern']) { await page.evaluate(t => PORUB.g.setTheme(t), th); await wait(260); await page.screenshot({ path: path.join(SHOTS, `porubezhye${name}-${th}.png`), clip: b }); } };
  const label = key => page.evaluate(k => { const m = PORUB.g.menu.get('title'), it = m.items[m.indexOf(k)]; return typeof it.label === 'function' ? it.label() : it.label; }, key);

  await test('издание демо: реестр миссий пуст, флаг demo; меню: Играть, Раса, «Кампания · в полной версии»', async () => {
    ok(await page.evaluate(() => PORUB.Edition.BUILD === 'demo' && PORUB.EDITION === 'demo' && PORUB.MISSIONS.length === 0), 'издание');
    ok(await page.evaluate(() => !!PORUB.campUI && !PORUB.campUI.available() && !!PORUB.g.scenes.camp), 'движок кампании подключён, миссий в демо нет');
    const items = await page.evaluate(() => PORUB.g.menu.items('title'));
    ok(items[0] === 'play' && items[1] === 'race' && items[2] === 'campaign' && items.slice(3, 6).join() === 'foe,ailvl,map', 'меню: ' + items);
    ok(/Соперник: случайно/.test(await label('foe')) && /ИИ: Обычный/.test(await label('ailvl')) && /Карта: Генерируемая/.test(await label('map')), 'по умолчанию: ' + [await label('foe'), await label('ailvl'), await label('map')]);
    const l = await label('campaign'); ok(/Кампания · в полной версии/.test(l), l);
  });
  await test('«Кампания» (клавиатура) → экран «Кампания — в полной версии»; «Узнать больше» → ../ в новой вкладке; Esc → меню', async () => {
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await wait(80); await page.keyboard.press('Enter'); await wait(250);
    ok(await scene() === 'edition', 'сцена ' + await scene());
    ok(await page.evaluate(() => PORUB.g.scenes.edition._menu.items.map(i => i.key).join()) === 'toMenu,more', 'кнопки');
    await shot('-edition');
    await page.keyboard.press('ArrowDown'); await wait(60);
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }), page.keyboard.press('Enter')]);
    await pop.waitForLoadState().catch(() => {}); ok(new URL(pop.url()).pathname === '/', '«Узнать больше» → ' + pop.url()); await pop.close();
    ok(await scene() === 'edition', 'после «Узнать больше» ушли с экрана');
    await page.keyboard.press('Escape'); await wait(200); ok(await scene() === 'title', 'Esc → ' + await scene());
  });
  await test('«Кампания» мышью → экран; «Вернуться в меню» мышью → меню', async () => {
    const y = await page.evaluate(() => { const m = PORUB.g.menu.get('title'); return m.items[m.indexOf('campaign')]._y; });
    const b = await box(), k = b.width / 1280;
    await page.mouse.click(b.x + 640 * k, b.y + (y - 6) * k); await wait(250); ok(await scene() === 'edition', 'сцена ' + await scene());
    const y2 = await page.evaluate(() => PORUB.g.scenes.edition._menu.items[0]._y);
    await page.mouse.click(b.x + 640 * k, b.y + (y2 - 6) * k); await wait(250); ok(await scene() === 'title', 'сцена ' + await scene());
  });
  await test('язык L: пункт «Campaign · in the full version»; обратно', async () => {
    await page.keyboard.press('KeyL'); await wait(100); const l = await label('campaign'); ok(/Campaign · in the full version/.test(l), l);
    await page.keyboard.press('KeyL'); await wait(100); ok(/Кампания/.test(await label('campaign')));
  });
  await test('старт по Enter → игра; пауза P, «Продолжить»; тема T', async () => {
    await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = 0; }); await page.keyboard.press('Enter'); await wait(400);
    ok(await scene() === 'play', 'сцена ' + await scene());
    await page.keyboard.press('KeyP'); await wait(200); ok(await scene() === 'pause', 'пауза: ' + await scene());
    await page.keyboard.press('Enter'); await wait(200); ok(await scene() === 'play', '«Продолжить»: ' + await scene());
    const t0 = await page.evaluate(() => PORUB.g.themeName); await page.keyboard.press('KeyT'); await wait(100);
    ok(await page.evaluate(() => PORUB.g.themeName) !== t0, 'тема не сменилась'); await page.keyboard.press('KeyT');
  });
  if (SHOTS) await test('скриншоты геймплея retro/modern (1280×720, кроп по canvas)', async () => {
    await page.evaluate(() => {
      const D = PORUB.debug, G = D.game, A0 = new PORUB.AI(G, 0); let fightT = -1;
      for (let t = 0; t < 600; t += 0.05) { // до первой стычки (+3 с), но не дольше 10 минут
        A0.update(0.05); G.update(0.05);
        if (fightT < 0 && t > 200 && G.ents.some(e => !e.dead && e.kind === 'u' && e.owner === 1 && G.ents.some(m => !m.dead && m.owner === 0 && Math.hypot(m.x - e.x, m.y - e.y) < 160))) fightT = t;
        if (fightT > 0 && t > fightT + 3) break;
      }
      // камера — на гущу своих и чужих
      let best = null, bs = -1;
      G.ents.filter(e => !e.dead && e.owner === 0 && e.kind === 'u').forEach(u => { const s = G.ents.filter(e => !e.dead && Math.hypot(e.x - u.x, e.y - u.y) < 220).length + (G.ents.some(e => !e.dead && e.owner === 1 && Math.hypot(e.x - u.x, e.y - u.y) < 200) ? 8 : 0); if (s > bs) { bs = s; best = u; } });
      const c = best || G.ents.find(e => !e.dead && e.owner === 0);
      D.cam.x = c.x - D.view.w / 2; D.cam.y = c.y - D.view.h / 2;
    });
    await wait(400); ok(await scene() === 'play', 'партия закончилась до кадра: ' + await scene());
    await shot('');
  });
  await test('третья раса в скирмише демо: «Раса» по кругу — Мастеровые → Живая чаща → Курганный род; старт — курган и 5 каменщиков, камень и руда у базы', async () => {
    await page.evaluate(() => PORUB.g.goto('title')); await wait(200);
    const lab = () => label('race');
    for (let i = 0; i < 3 && !/Курганный род/.test(await lab()); i++) { await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = m.indexOf('race'); }); await page.keyboard.press('Enter'); await wait(120); }
    ok(/Раса: Курганный род/.test(await lab()), await lab());
    await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = 0; }); await page.keyboard.press('Enter'); await wait(400); ok(await scene() === 'play', 'сцена ' + await scene());
    const st = await page.evaluate(() => { const G = PORUB.debug.game; return { r: G.races.join(), k: G.ents.filter(e => e.owner === 0 && e.type === 'kurgan').length, m: G.ents.filter(e => e.owner === 0 && e.type === 'mason').length, stone: G.ents.filter(e => e.type === 'stone').length, ore: G.ents.filter(e => e.type === 'ore').length }; });
    ok(/^barrow,(wright|thicket|barrow)$/.test(st.r) && st.k === 1 && st.m === 5 && st.stone === (st.r === 'barrow,barrow' ? 20 : 10) && st.ore === (st.r === 'barrow,barrow' ? 4 : 2), JSON.stringify(st));
    if (SHOTS) {
      await page.evaluate(() => {
        const D = PORUB.debug, G = D.game, A0 = new PORUB.AI(G, 0); let fightT = -1;
        for (let t = 0; t < 600; t += 0.05) { A0.update(0.05); G.update(0.05); if (fightT < 0 && t > 200 && G.ents.some(e => !e.dead && e.kind === 'u' && e.owner === 1 && G.ents.some(m => !m.dead && m.owner === 0 && Math.hypot(m.x - e.x, m.y - e.y) < 160))) fightT = t; if (fightT > 0 && t > fightT + 3) break; }
        let best = null, bs = -1; G.ents.filter(e => !e.dead && e.owner === 0 && e.kind === 'u').forEach(u => { const s = G.ents.filter(e => !e.dead && Math.hypot(e.x - u.x, e.y - u.y) < 220).length + (G.ents.some(e => !e.dead && e.owner === 1 && Math.hypot(e.x - u.x, e.y - u.y) < 200) ? 8 : 0); if (s > bs) { bs = s; best = u; } });
        const c = best || G.ents.find(e => !e.dead && e.owner === 0); D.cam.x = c.x - D.view.w / 2; D.cam.y = c.y - D.view.h / 2;
      });
      await wait(400); ok(await scene() === 'play', 'партия закончилась до кадра'); await shot('-barrow');
    }
  });
  await test('скирмиш: «Соперник», «ИИ», «Карта» — по кругу (Enter), сохраняются после перезагрузки, подсказка о выбранном пункте; скриншоты выбора', async () => {
    await page.evaluate(() => PORUB.g.goto('title')); await wait(200);
    const pick = async (key, re) => { for (let i = 0; i < 6 && !re.test(await label(key)); i++) { await page.evaluate(k => { const m = PORUB.g.menu.get('title'); m.sel = m.indexOf(k); }, key); await page.keyboard.press('Enter'); await wait(100); } ok(re.test(await label(key)), key + ': ' + await label(key)); };
    const seen = { foe: [], ailvl: [], map: [] };
    for (const k of Object.keys(seen)) for (let i = 0; i < 5; i++) { seen[k].push(await label(k)); await page.evaluate(kk => { const m = PORUB.g.menu.get('title'); m.sel = m.indexOf(kk); }, k); await page.keyboard.press('Enter'); await wait(60); }
    ok(new Set(seen.foe).size === 4 && new Set(seen.ailvl).size === 3 && new Set(seen.map).size === 4, JSON.stringify(seen));
    await pick('foe', /Соперник: Курганный род/); await pick('ailvl', /ИИ: Трудный/); await pick('map', /Карта: Ледяной перевал/);
    const hint = await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = m.indexOf('map'); return PORUB.g.menu._hints.title()[0]; });
    ok(/брод/.test(hint), 'подсказка карты: ' + hint);
    await wait(150); await shot('-menu-map');
    await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = m.indexOf('ailvl'); }); await wait(150); await shot('-menu-ai');
    await page.reload(); await wait(600);
    ok(/Курганный род/.test(await label('foe')) && /Трудный/.test(await label('ailvl')) && /Ледяной перевал/.test(await label('map')), 'после перезагрузки: ' + [await label('foe'), await label('ailvl'), await label('map')]);
    ok(await page.evaluate(() => JSON.stringify(PORUB.debug.skirm)) === '{"foe":"barrow","ai":"hard","map":"pass"}', 'настройки');
  });
  await test('старт с выбором: соперник — Курганный род, ИИ «Трудный», карта «Ледяной перевал»; затем «Раздолье» 88×66; скриншоты карт', async () => {
    await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = 0; }); await page.keyboard.press('Enter'); await wait(500); ok(await scene() === 'play', 'сцена ' + await scene());
    const st = await page.evaluate(() => { const G = PORUB.debug.game; return { foe: G.races[1], lvl: G.ai.level, map: G.mapId, w: G.MW, h: G.MH }; });
    ok(st.foe === 'barrow' && st.lvl === 'hard' && st.map === 'pass' && st.w === 64, JSON.stringify(st));
    // автопилот у игрока sec секунд; для кадра — туман снят, камера на характерное место карты (брод, просека)
    const auto = (sec, fx, fy) => page.evaluate(([s, x, y]) => { const D = PORUB.debug, G = D.game, A0 = new PORUB.AI(G, 0); for (let t = 0; t < s && G.winner < 0; t += 0.1) { A0.update(0.1); G.update(0.1); }
      G.fogOff = true; D.cam.x = Math.max(0, Math.min(G.MW * 32 - D.view.w, x * 32 - D.view.w / 2)); D.cam.y = Math.max(0, Math.min(G.MH * 32 - D.view.h, y * 32 - D.view.h / 2)); }, [sec, fx, fy]);
    await auto(150, 24, 21); await wait(300); await shot('-map-pass');
    await page.evaluate(() => PORUB.g.goto('title')); await wait(200);
    for (let i = 0; i < 4 && !/Раздолье/.test(await label('map')); i++) { await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = m.indexOf('map'); }); await page.keyboard.press('Enter'); await wait(80); }
    await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = 0; }); await page.keyboard.press('Enter'); await wait(500);
    const st2 = await page.evaluate(() => { const G = PORUB.debug.game; return { map: G.mapId, w: G.MW, h: G.MH }; }); ok(st2.map === 'wide' && st2.w === 88 && st2.h === 66, JSON.stringify(st2));
    await auto(60, 44, 30); await wait(300); await shot('-map-wide');
    for (let i = 0; i < 4 && !/Лесная чаща/.test(await label('map')); i++) { await page.evaluate(() => { PORUB.g.goto('title'); const m = PORUB.g.menu.get('title'); m.sel = m.indexOf('map'); }); await wait(100); await page.keyboard.press('Enter'); await wait(80); }
    await page.evaluate(() => { const m = PORUB.g.menu.get('title'); m.sel = 0; }); await page.keyboard.press('Enter'); await wait(500);
    ok(await page.evaluate(() => PORUB.debug.game.mapId) === 'grove', 'чаща'); await auto(150, 22, 18); await wait(300); await shot('-map-grove');
    // вернуть настройки по умолчанию (случайный соперник, «Обычный», генерируемая карта)
    await page.evaluate(() => { ['porubezhye.foe', 'porubezhye.ai', 'porubezhye.map'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); });
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
  await ctx.close();
} finally {
  await browser.close(); if (srv) srv.close();
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

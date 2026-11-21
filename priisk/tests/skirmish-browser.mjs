/* ПРИИСК · tests/skirmish-browser.mjs — выбор сложности и карты скирмиша в браузере (Playwright, демо).
   Меню: пункты «Сложность» и «Карта» между «Соседи» и «Кампания»; клавишами (стрелки + Enter) переключаются по кругу и
   запоминаются (localStorage arcade.priisk.level / .map; после партии на плато — «Плато · №сид» в списке, сид — .seed);
   после перезагрузки — те же. Скирмиш на каждой карте (плато, перевал, острова, четыре жилы) и на каждом уровне: мир той карты
   и размера, ИИ нужного уровня, мини-карта влезает в панель, камера ходит по всей карте, ИИ за минуту строит и добывает;
   «Плато · №сид» — та же карта, что в прошлой партии; ?level= и ?map= для проверки; победа — достижения на сайте no-op
   (P.achieve.log пишет, хука издания нет), учёт карт — в arcade.priisk.skirmish. 0 ошибок консоли.
   Скриншоты (с папкой): priisk-map-{gen,pass,isles,veins}-{retro,modern}.png, priisk-menu-skirmish-{retro,modern}.png.
   Запуск из корня репо: node priisk/tests/skirmish-browser.mjs [папка-для-скриншотов] (сервер — PORT, по умолчанию 8461) */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const PORT = +(process.env.PORT || 8461), URL0 = `http://localhost:${PORT}/priisk/`;
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
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const scene = () => page.evaluate(() => PRIISK.g._sceneName);
  const label = key => page.evaluate(k => { const it = PRIISK.g.menu.get('title').items.find(i => i.key === k); return it ? it.label() : null; }, key);
  async function select(key) { // стрелками до пункта и Enter — как игрок
    const i = await page.evaluate(k => PRIISK.g.menu.items('title').indexOf(k), key); ok(i >= 0, 'нет пункта ' + key);
    const cur = await page.evaluate(() => PRIISK.g.menu.get('title').sel);
    for (let n = cur; n < i; n++) { await page.keyboard.press('ArrowDown'); await wait(50); }
    for (let n = cur; n > i; n--) { await page.keyboard.press('ArrowUp'); await wait(50); }
    eq(await page.evaluate(() => { const m = PRIISK.g.menu.get('title'); return m.items[m.sel].key; }), key, 'выбор');
    await page.keyboard.press('Enter'); await wait(150);
  }
  const shot = async name => {
    if (!SHOTS) return;
    const box = await page.evaluate(() => { const r = PRIISK.g.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    for (const th of ['retro', 'modern']) { await page.evaluate(t => PRIISK.g.setTheme(t), th); await wait(350); await page.screenshot({ path: path.join(SHOTS, `priisk-${name}-${th}.png`), clip: box }); }
    await page.evaluate(() => PRIISK.g.setTheme('modern'));
  };
  const toTitle = async () => { if (await scene() === 'play') { await page.keyboard.press('KeyP'); await wait(250); } await page.evaluate(() => PRIISK.g.goto('title')); await wait(250); };

  await page.goto(URL0 + '?lang=ru'); await wait(500);
  await page.evaluate(() => { PRIISK.g.setTheme('modern'); ['level', 'map', 'seed', 'skirmish', 'side', 'foe'].forEach(k => { try { localStorage.removeItem('arcade.priisk.' + k); } catch (e) {} }); });
  await page.reload(); await wait(500);

  await test('меню: «Сложность» и «Карта» после «Соседи», до «Кампании»; по умолчанию — обычная и «Плато · случайное»', async () => {
    const keys = await page.evaluate(() => PRIISK.g.menu.items('title'));
    ok(keys.indexOf('foe') < keys.indexOf('level') && keys.indexOf('level') < keys.indexOf('map') && keys.indexOf('map') < keys.indexOf('campaign'), 'порядок ' + keys);
    eq(await label('level'), 'Сложность: обычная'); eq(await label('map'), 'Карта: Плато · случайное');
    await page.evaluate(() => { const m = PRIISK.g.menu.get('title'); m.sel = m.items.findIndex(i => i.key === 'level'); }); await wait(200);
    await shot('menu-skirmish');
  });
  await test('«Сложность» клавишами: обычная → трудная → лёгкая → обычная; запоминается (localStorage и после перезагрузки)', async () => {
    await select('level'); eq(await label('level'), 'Сложность: трудная');
    await select('level'); eq(await label('level'), 'Сложность: лёгкая'); eq(await page.evaluate(() => localStorage.getItem('arcade.priisk.level')), 'easy');
    await page.reload(); await wait(500); eq(await label('level'), 'Сложность: лёгкая', 'после перезагрузки');
    await select('level'); eq(await label('level'), 'Сложность: обычная');
  });
  await test('«Карта» клавишами: Плато · случайное → Перевал → Острова → Четыре жилы → Плато; запоминается', async () => {
    const seen = []; for (let i = 0; i < 4; i++) { await select('map'); seen.push(await label('map')); }
    eq(seen, ['Карта: Перевал', 'Карта: Острова', 'Карта: Четыре жилы', 'Карта: Плато · случайное']);
    await select('map'); await page.reload(); await wait(500); eq(await label('map'), 'Карта: Перевал', 'после перезагрузки');
    await page.evaluate(() => { localStorage.setItem('arcade.priisk.map', 'gen'); }); await page.reload(); await wait(500);
  });
  const MAPS = { gen: [64, 48, 'Плато · случайное'], pass: [64, 48, 'Перевал'], isles: [64, 48, 'Острова'], veins: [96, 64, 'Четыре жилы'] };
  let genSeed = 0, genT = '';
  for (const [map, lvl] of [['gen', 'normal'], ['pass', 'hard'], ['isles', 'easy'], ['veins', 'hard']]) {
    await test(`скирмиш: карта ${MAPS[map][2]}, сложность ${lvl} — мир ${MAPS[map][0]}×${MAPS[map][1]}, ИИ уровня, мини-карта в панели, камера по всей карте; за минуту ИИ строит и добывает`, async () => {
      await page.evaluate(([m, l]) => { localStorage.setItem('arcade.priisk.map', m); localStorage.setItem('arcade.priisk.level', l); }, [map, lvl]);
      await page.reload(); await wait(500);
      await select('play'); await wait(600); eq(await scene(), 'play');
      const s = await page.evaluate(() => { const W = PRIISK.S.W, M = PRIISK.render.fitMinimap(W); return { w: W.w, h: W.h, map: W.map || 'gen', lvl: W.ai.lvl || 'normal', hard: !!W.ai.hard, mm: [M.x, M.y, Math.round(W.w * M.s), Math.round(W.h * M.s), M.w, M.h], seed: PRIISK.S.sk.seed, t: Array.from(W.t).join('') }; });
      eq([s.w, s.h, s.map, s.lvl], [MAPS[map][0], MAPS[map][1], map, lvl]); eq(s.hard, lvl === 'hard', 'ИИ «Трудного»');
      ok(s.mm[2] <= s.mm[4] + 1 && s.mm[3] <= s.mm[5] + 1, 'мини-карта не влезает: ' + s.mm);
      if (map === 'gen') { genSeed = s.seed; genT = s.t; }
      // камера: дальний угол карты (End-позиция) и обратно
      const cam = await page.evaluate(() => { const S = PRIISK.S, W = S.W; S.cam.x = 1e6; S.cam.y = 1e6; const R = PRIISK.render, LY = R.LAYOUT; return { x: S.cam.x, y: S.cam.y, mx: W.w * R.TILE - LY.W, my: W.h * R.TILE - LY.VIEW_H }; });
      await wait(150); const cam2 = await page.evaluate(() => [PRIISK.S.cam.x, PRIISK.S.cam.y]);
      ok(cam2[0] === cam.mx && cam2[1] === cam.my, 'камера не упирается в край карты: ' + cam2 + ' / ' + [cam.mx, cam.my]);
      // минута игрового времени ускоренно (тот же шаг, что у игры)
      const r = await page.evaluate(() => { const L = PRIISK.logic, W = PRIISK.S.W; for (let i = 0; i < 60 * 60; i++) L.step(W, 1 / 60); return { b: W.blds.filter(b => b.owner === 1).length, m: W.players[1].mined, win: W.winner }; });
      ok(r.b >= 3 && r.win < 0, 'ИИ не строится: ' + JSON.stringify(r));
      const own = await page.evaluate(() => { const W = PRIISK.S.W, h = PRIISK.logic.has(W, 0, 'hq'); return h ? [h.tx, h.ty] : null; });
      await page.evaluate(([x, y]) => { const S = PRIISK.S; S.cam.x = x * 24 - 300; S.cam.y = y * 24 - 250; }, own); await wait(400);
      await shot('map-' + map);
      await toTitle();
    });
  }
  await test('«Плато · №сид»: после партии на плато в списке карт — сид той партии; выбор — та же карта', async () => {
    await page.reload(); await wait(500);
    eq(await page.evaluate(() => +localStorage.getItem('arcade.priisk.seed')), genSeed, 'сид не запомнен');
    await page.evaluate(() => localStorage.setItem('arcade.priisk.map', 'gen')); await page.reload(); await wait(500);
    await select('map'); eq(await label('map'), 'Карта: Плато · №' + genSeed);
    await select('play'); await wait(600);
    const s = await page.evaluate(() => ({ seed: PRIISK.S.sk.seed, t: Array.from(PRIISK.S.W.t).join('') }));
    eq(s.seed, genSeed); ok(s.t === genT, 'карта другая');
    await toTitle(); await select('map'); eq(await label('map'), 'Карта: Перевал');
  });
  await test('?level=hard&map=isles — для проверки (поверх сохранённого); EN-подписи', async () => {
    await page.goto(URL0 + '?lang=en&level=hard&map=isles'); await wait(500);
    eq(await label('level'), 'Difficulty: hard'); eq(await label('map'), 'Map: The Isles');
    await select('play'); await wait(500); eq(await page.evaluate(() => [PRIISK.S.W.map, PRIISK.S.W.ai.lvl]), ['isles', 'hard']);
  });
  await test('победа в скирмише на сайте: достижения — no-op (хука издания нет, журнал пишет), учёт карты в arcade.priisk.skirmish; экран победы', async () => {
    ok(await page.evaluate(() => !PRIISK.Edition.achieve), 'на сайте есть хук achieve');
    await page.evaluate(() => { const W = PRIISK.S.W; W.winner = 0; }); await wait(3000);
    eq(await scene(), 'win');
    const r = await page.evaluate(() => ({ log: PRIISK.achieve.log.slice(), rec: JSON.parse(localStorage.getItem('arcade.priisk.skirmish')) }));
    ok(r.log.includes('ACH_SK_COPPER') && r.log.includes('ACH_SK_HARD') && r.log.includes('ACH_SK_FAST'), 'журнал: ' + r.log);
    eq(r.rec.maps, { isles: 1 });
  });
  await test('консоль: 0 ошибок', async () => { eq(errors, []); });
} finally {
  await browser.close();
  if (srv) srv.close();
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

/* ПОРУБЕЖЬЕ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей и браузера).
   Запуск: node porubezhye/tests/engine.test.mjs. game.js грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Array, Map, Set, Object, JSON, Uint8Array, Int32Array, Float32Array };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const P = sandbox.PORUB, T = P.T, MW = P.MW;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
const run = (g, sec, h = 0.05) => { for (let t = 0; t < sec; t += h) g.update(h); };
const mk = (race = 'wright', o = {}) => P.create(Object.assign({ seed: 1, playerRace: race, noAI: true, fogOff: true }, o));
const my = (g, p, kind, type) => g.ents.filter(e => !e.dead && e.owner === p && e.kind === kind && (!type || e.type === type));
const nodes = (g, type) => g.ents.filter(e => e.kind === 'n' && e.type === type);
const nearest = (list, x, y) => list.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];

// ---------- A* ----------
test('A*: путь в обход препятствия, все клетки проходимы, без срезания углов', () => {
  const g = mk();
  for (let y = 12; y < 32; y++) for (let x = 14; x < 28; x++) g.terr[y * MW + x] = P.TERR.GRASS;
  // стена 1×9 (обходится сверху или снизу)
  for (let y = 18; y < 27; y++) g.terr[y * MW + 20] = P.TERR.ROCK;
  const path = g.pathToTile(17, 22, 23, 22);
  ok(path && path.found, 'путь не найден'); eq(path[0].join(), '17,22'); eq(path[path.length - 1].join(), '23,22');
  for (let i = 0; i < path.length; i++) { const [x, y] = path[i]; ok(g.passable(x, y), 'клетка ' + x + ',' + y + ' непроходима');
    if (i) { const [px, py] = path[i - 1]; ok(Math.abs(x - px) <= 1 && Math.abs(y - py) <= 1, 'скачок');
      if (x !== px && y !== py) ok(g.passable(px, y) && g.passable(x, py), 'срезан угол у ' + x + ',' + y); } }
  ok(path.length >= 10, 'путь слишком короткий — прошёл сквозь стену? ' + path.length);
});
test('A*: оптимальная длина на пустом поле (диагональ) и частичный путь к недостижимой цели', () => {
  const g = mk();
  const p1 = g.findPath(30, 20, (x, y) => x === 34 && y === 24, (x, y) => Math.max(Math.abs(x - 34), Math.abs(y - 24)));
  ok(p1.found); eq(p1.length, 5, 'диагональ 4 шага → 5 клеток');
  // цель внутри озера/леса — путь к ближайшей достижимой клетке, found=false
  let wx = -1, wy = -1; for (let i = 0; i < g.terr.length; i++) if (g.terr[i] === P.TERR.WATER) { wx = i % MW; wy = (i / MW) | 0; break; }
  ok(wx >= 0, 'нет воды на карте');
  const p2 = g.pathToTile(10, 20, wx, wy); ok(p2 && !p2.found, 'путь в воду «найден»');
  const end = p2[p2.length - 1]; ok(g.passable(end[0], end[1]));
});
test('карта: центрально-симметрична (честный старт) и связна', () => {
  const g = mk();
  for (let y = 0; y < P.MH; y++) for (let x = 0; x < MW; x++) eq(g.terr[y * MW + x], g.terr[(P.MH - 1 - y) * MW + (MW - 1 - x)], 'асимметрия ' + x + ',' + y);
  const a = my(g, 0, 'b')[0], b = my(g, 1, 'b')[0];
  const path = g.pathToRect(Math.floor(a.x / T), a.ty + a.s, b, 1); ok(path && path.found, 'базы не связаны');
});

// ---------- Рамка ----------
test('рамка выбирает только свои юниты, задетые рамкой; здания — только если юнитов нет', () => {
  const g = mk();
  const ws = my(g, 0, 'u'); const a = ws[0], b = ws[1];
  a.x = 600; a.y = 600; b.x = 700; b.y = 600; ws.slice(2).forEach((u, i) => { u.x = 900 + i * 30; u.y = 900; });
  const en = g._addUnit(1, g.race(1).worker, 650, 610);  // чужой в рамке
  const sel = g.selectRect(0, 580, 580, 710, 620);
  eq(sel.slice().sort().join(), [a.id, b.id].sort().join(), 'выбраны не те');
  ok(!sel.includes(en.id), 'выбран чужой');
  // рамка в обратную сторону (справа-снизу налево-вверх) — то же
  eq(g.selectRect(0, 710, 620, 580, 580).length, 2);
  // юнит, лишь чиркнутый краем рамки дальше 0.7 радиуса — не выбран
  eq(g.selectRect(0, a.x + a.r * 0.8, a.y - 5, a.x + 40, a.y + 5).includes(a.id), false);
  // только здание в рамке → выбирается одно здание
  const hall = my(g, 0, 'b')[0]; const s2 = g.selectRect(0, hall.x - 10, hall.y - 10, hall.x + 10, hall.y + 10);
  eq(s2.join(), String(hall.id));
  // клик: entAt предпочитает юнит зданию
  eq(g.entAt(a.x + 2, a.y, 0).id, a.id);
});

// ---------- Экономика ----------
function econ(race) {
  const g = mk(race); const ws = my(g, 0, 'u'); const R = g.race(0);
  const am = nearest(nodes(g, 'amber'), ws[0].x, ws[0].y), rs = nearest(nodes(g, 'resin'), ws[0].x, ws[0].y);
  g.cmd(0, { t: 'gather', ids: ws.slice(0, 3).map(u => u.id), target: am.id });
  g.cmd(0, { t: 'gather', ids: ws.slice(3).map(u => u.id), target: rs.id });
  const a0 = g.res[0].a, r0 = g.res[0].r, left0 = am.amt;
  run(g, 60);
  ok(g.res[0].a - a0 >= 60, race + ': янтаря за минуту мало: ' + (g.res[0].a - a0));
  ok(g.res[0].r - r0 >= 20, race + ': смолы за минуту мало: ' + (g.res[0].r - r0));
  ok(am.amt < left0, 'россыпь не убывает');
  eq(g.res[0].a - a0 + (g.res[0].r - r0) <= g.stats[0].gathered, true);
  return g;
}
test('экономика Мастеровых: подмастерья носят янтарь и смолу в острог', () => { econ('wright'); });
test('экономика Чащи: короеды носят янтарь и смолу в Пень-матерь', () => { econ('thicket'); });
test('Мастеровые: обучение в очереди здания, стоимость списывается, юнит выходит через time', () => {
  const g = mk('wright'); const hall = my(g, 0, 'b')[0]; g.res[0].a = 200;
  ok(g.cmd(0, { t: 'train', id: hall.id, type: 'worker' })); ok(g.cmd(0, { t: 'train', id: hall.id, type: 'worker' }));
  eq(g.res[0].a, 100); eq(hall.queue.length, 2);
  run(g, P.RACES.wright.units.worker.time + 0.2); eq(my(g, 0, 'u').length, 6, 'первый не вышел'); eq(hall.queue.length, 1, 'очередь последовательная');
  ok(g.cmd(0, { t: 'cancel', id: hall.id })); eq(g.res[0].a, 150, 'отмена вернула стоимость');
});
test('Чаща: юниты — из личинок Пня (параллельно), личинки восстанавливаются', () => {
  const g = mk('thicket'); const st = my(g, 0, 'b')[0]; g.res[0].a = 500;
  eq(st.larva, P.consts.LARVA_MAX);
  for (let i = 0; i < 3; i++) ok(g.cmd(0, { t: 'train', id: st.id, type: 'beetle' }), 'кокон ' + i);
  eq(st.larva, 0); eq(g.trainBlock(0, st, 'beetle'), 'larva', 'без личинок нельзя');
  eq(g.trainBlock(0, st, 'stinger'), 'req', 'жалильщик без жальника');
  run(g, P.RACES.thicket.units.beetle.time + 0.2); eq(my(g, 0, 'u').length, 8, 'три кокона вылупились одновременно');
  ok(st.larva >= 1, 'личинка не восстановилась');
});
test('провизия: сверх лимита обучать нельзя; изба/дупло поднимают лимит', () => {
  for (const race of ['wright', 'thicket']) {
    const g = mk(race); const main = my(g, 0, 'b')[0], R = g.race(0); g.res[0].a = 5000; g.res[0].r = 5000;
    let s = g.supply(0); eq(s.used, 5); eq(s.cap, 10);
    for (let i = 0; i < 4; i++) { main.larva = 3; ok(g.cmd(0, { t: 'train', id: main.id, type: R.worker }), race + ' юнит ' + i); }
    g._addUnit(0, R.worker, main.x, main.y + 80); main.larva = 3; eq(g.supply(0).used, 10); eq(g.trainBlock(0, main, R.worker), 'supply', race + ': лимит не держит');
    const sup = g._addBuilding(0, R.supply, 12, 20, true); eq(g.supply(0).cap, 18, race + ': дом не дал +8');
    eq(g.trainBlock(0, main, R.worker), null);
    sup.hp = 0; g._kill(sup, null); eq(g.supply(0).cap, 10, 'снос дома не уменьшил лимит');
    // общий потолок
    for (let i = 0; i < 8; i++) g._addBuilding(0, R.supply, 20 + (i % 4) * 3, 24 + ((i / 4) | 0) * 3, true);
    eq(g.supply(0).cap, P.consts.SUP_MAX, 'потолок провизии');
  }
});
test('грибница: Чаща сажает только на грибнице; Пень — где угодно; у Мастеровых грибницы нет', () => {
  const g = mk('thicket', { fogOff: true }); g.res[0].a = 1000;
  const st = my(g, 0, 'b')[0];
  ok(g.myc[0][(st.ty + 1) * MW + st.tx + st.s + 1], 'нет грибницы у Пня');
  // найдём проходимое место вне грибницы и внутри
  let out = null, inn = null;
  for (let y = 2; y < 30 && (!out || !inn); y++) for (let x = 2; x < 40; x++) {
    let allIn = true, anyIn = false, free = true;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = (y + dy) * MW + x + dx; if (!g.passable(x + dx, y + dy)) free = false; if (g.myc[0][i]) anyIn = true; else allIn = false; }
    if (!free) continue; if (!anyIn && !out && Math.hypot(x - st.tx, y - st.ty) > 10) out = [x, y]; if (allIn && !inn) inn = [x, y];
  }
  ok(out && inn, 'не нашли места для проверки');
  eq(g.canPlace(0, 'hollow', out[0], out[1]).why, 'myc', 'вне грибницы разрешили');
  ok(g.canPlace(0, 'hollow', inn[0], inn[1]).ok, 'на грибнице запретили');
  const beetle = my(g, 0, 'u')[0];
  eq(g.cmd(0, { t: 'build', ids: [beetle.id], type: 'hollow', tx: out[0], ty: out[1] }), false, 'приказ вне грибницы прошёл');
  // Пень-матерь — можно и вне грибницы (если место свободно)
  let sx = -1, sy = -1; for (let y = 24; y < 40 && sx < 0; y++) for (let x = 4; x < 30; x++) { let f = true; for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) if (!g.passable(x + dx, y + dy)) f = false; if (f) { sx = x; sy = y; break; } }
  ok(g.canPlace(0, 'stump', sx, sy).ok, 'Пень вне грибницы запрещён');
  // росток растёт сам после посадки, жук свободен; грибница расширяется
  const before = g.myc[0].reduce((a, b) => a + b, 0);
  const sp = g.cmd(0, { t: 'build', ids: [beetle.id], type: 'hollow', tx: inn[0], ty: inn[1] }); ok(sp, 'посадка не прошла');
  run(g, 8); ok(sp.planted, 'жук не посадил'); ok(beetle.ord.t !== 'plant', 'жук не освободился');
  run(g, P.RACES.thicket.buildings.hollow.time + 1); ok(sp.done, 'не выросло'); ok(g.myc[0].reduce((a, b) => a + b, 0) > before, 'грибница не расширилась');
  const gw = mk('wright'); eq(gw.myc[0].reduce((a, b) => a + b, 0), 0, 'у Мастеровых есть грибница');
});
test('Мастеровые: здание строится только пока рядом рабочий; ремонт; Чаща заживает сама', () => {
  const g = mk('wright'); g.res[0].a = 1000; const w = my(g, 0, 'u')[0];
  const b = g.cmd(0, { t: 'build', ids: [w.id], type: 'house', tx: 12, ty: 18 }); ok(b, 'не поставили');
  run(g, 3); const p1 = b.prog; g.cmd(0, { t: 'stop', ids: [w.id] }); run(g, 5); eq(b.prog, p1, 'строится без рабочего');
  g.cmd(0, { t: 'smart', ids: [w.id], target: b.id, x: b.x, y: b.y }); run(g, P.RACES.wright.buildings.house.time + 4); ok(b.done, 'не достроили'); ok(b.hp > b.maxhp - 1, 'прочность после стройки ' + b.hp);
  b.hp = 100; g.cmd(0, { t: 'smart', ids: [w.id], target: b.id, x: b.x, y: b.y }); eq(w.ord.t, 'repair', 'ПКМ по повреждённому — не ремонт');
  run(g, 10); ok(b.hp > 200, 'ремонт не идёт: ' + b.hp);
  const gt = mk('thicket'); const u = my(gt, 0, 'u')[0]; u.hp = 10; const st = my(gt, 0, 'b')[0]; st.hp = 500; run(gt, 10);
  ok(u.hp > 13 && st.hp > 520, 'Чаща не заживает'); ok(my(g, 0, 'u')[1].hp === 40, 'Мастеровые не должны заживать сами');
});
test('бой: стрелок сам открывает огонь по врагу в обзоре; ПКМ по врагу — атака; урон с бронёй', () => {
  const g = mk('wright'); const s = g._addUnit(0, 'shooter', 30 * T, 20 * T), e = g._addUnit(1, 'beetle', 34 * T, 20 * T);
  run(g, 3); ok(e.hp < e.maxhp, 'стрелок не стреляет');
  const sh = g._addUnit(1, 'shell', 31 * T, 23 * T), hp0 = sh.hp;
  g.cmd(0, { t: 'smart', ids: [s.id], target: sh.id, x: sh.x, y: sh.y }); eq(s.ord.t, 'attack');
  run(g, 1.3); ok(hp0 - sh.hp <= (P.RACES.wright.units.shooter.dmg - 3) * 2 + 4, 'броня не учитывается');
});
test('победа: когда у стороны не осталось зданий', () => {
  const g = mk('wright'); let end = null; g.onEvent = (t, d) => { if (t === 'end') end = d; };
  my(g, 1, 'b').forEach(b => g._kill(b, null)); run(g, 0.1);
  eq(g.winner, 0); ok(end && end.winner === 0);
});
test('туман: дальняя часть карты не разведана, вражеский юнит вне обзора невидим', () => {
  const g = P.create({ seed: 1, playerRace: 'wright', noAI: true });
  eq(g.vis[0][(P.MH - 3) * MW + MW - 3], 0, 'угол врага разведан');
  const en = my(g, 1, 'u')[0]; eq(g.visibleTo(en, 0), false);
  eq(g.entAt(en.x, en.y, 0), null, 'кликом можно выбрать невидимого');
  const hall = my(g, 0, 'b')[0]; eq(g.vis[0][(hall.ty + 1) * MW + hall.tx + 1], 2, 'своя база не видна');
  // разведчик подошёл — враг виден
  const sc = g._addUnit(0, 'shooter', en.x - 3 * T, en.y); run(g, 0.3); eq(g.visibleTo(en, 0), true);
});
test('расталкивание: юниты в одной точке разъезжаются и не залезают в препятствия', () => {
  const g = mk('wright'); const us = []; for (let i = 0; i < 6; i++) us.push(g._addUnit(0, 'shooter', 30 * T + 16, 22 * T + 16));
  run(g, 1);
  for (let i = 0; i < us.length; i++) { ok(g.walkPx(us[i].x, us[i].y), 'в стене'); for (let j = i + 1; j < us.length; j++) ok(Math.hypot(us[i].x - us[j].x, us[i].y - us[j].y) > 8, 'слиплись ' + i + ',' + j); }
});
test('групповой приказ: каждый идёт в свою клетку и доходит', () => {
  const g = mk('wright'); const us = []; for (let i = 0; i < 8; i++) us.push(g._addUnit(0, 'shooter', 14 * T + (i % 4) * 20, 20 * T + ((i / 4) | 0) * 20));
  g.cmd(0, { t: 'move', ids: us.map(u => u.id), x: 30 * T, y: 24 * T });
  const tiles = new Set(us.map(u => u.ord.tx + ',' + u.ord.ty)); eq(tiles.size, 8, 'клетки назначения совпадают');
  run(g, 20); ok(us.every(u => u.ord.t === 'idle' && Math.hypot(u.x - 30 * T, u.y - 24 * T) < 4 * T), 'не дошли: ' + us.map(u => u.ord.t + '@' + Math.round(u.x / T) + ',' + Math.round(u.y / T)).join(' '));
});

// ---------- ИИ ----------
for (const race of ['thicket', 'wright']) test('ИИ (' + race + ') за 5 игровых минут строит не меньше 3 зданий и собирает армию', () => {
  const g = P.create({ seed: 2, playerRace: race === 'wright' ? 'thicket' : 'wright' });
  const b0 = my(g, 1, 'b').length; run(g, 300);
  const built = my(g, 1, 'b').length - b0, army = my(g, 1, 'u').filter(u => !g.def(u).worker).length;
  console.log('     ИИ ' + race + ': зданий +' + built + ' [' + g.ai.log.map(l => l[0] + 'с ' + l[1]).join(', ') + '], армия ' + army + ', всего юнитов ' + my(g, 1, 'u').length);
  ok(built >= 3, 'построено ' + built); ok(army >= 3, 'армия ' + army);
});
test('ИИ нападает волнами: к 7-й минуте ушла хотя бы одна волна', () => {
  const g = P.create({ seed: 3, playerRace: 'wright' }); let waves = 0; g.onEvent = (t) => { if (t === 'wave') waves++; };
  run(g, 420); ok(waves >= 1, 'волн ' + waves);
});
test('партия ИИ против ИИ заканчивается победой за 6–16 минут (длительность партии)', () => {
  const g = P.create({ seed: 1, playerRace: 'wright', aiBoth: true });
  for (let t = 0; t < 16 * 60 && g.winner < 0; t += 1) run(g, 1);
  console.log('     победитель ' + (g.winner >= 0 ? g.races[g.winner] : '—') + ' за ' + Math.round(g.t / 60 * 10) / 10 + ' мин');
  ok(g.winner >= 0 && g.t >= 6 * 60, 'итог ' + g.winner + ' за ' + g.t);
});

// ---------- Страница и правило имён ----------
test('страница: порядок скриптов, ссылка на каталог, engine.js — копия _shared', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order.join(), 'engine.js,js/music.js,js/i18n.js,js/edition.js,js/missions/index.js,js/game.js,js/scenario.js,js/campaign.js,js/render.js,js/mouse.js,js/campaign-ui.js,js/main.js');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), '«← Каталог» должен вести на ../');
  ok(/class="back"[^>]*data-en="← Catalog"/.test(html), 'нет «← Каталог»');
  ok(/rel="icon"/.test(html), 'нет фавикона');
  ok(!/(src|href)="https?:\/\//.test(html), 'внешние ссылки');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  for (const f of order) new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
});
test('издание: флаг сборки PORUB_EDITION = demo, ?demo / ?edition, пункт «Кампания» с пометкой, экран кампании, реестр миссий пуст', () => {
  // в публичном дереве — demo; в полной сборке arcade-full (метка .arcade-full-build уровнем выше) — full
  const FULLBUILD = fs.existsSync(path.join(ROOT, '..', '.arcade-full-build')), BUILD = FULLBUILD ? 'full' : 'demo';
  const src = fs.readFileSync(path.join(ROOT, 'js/edition.js'), 'utf8'); ok(src.includes("var PORUB_EDITION = '" + BUILD + "';"), 'флаг сборки должен быть ' + BUILD);
  const sb = { location: { search: '' } }; sb.window = sb; vm.createContext(sb);
  for (const f of ['js/i18n.js', 'js/edition.js', 'js/missions/index.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb);
  const E = sb.PORUB.Edition, S = sb.PORUB.STR;
  eq(E.BUILD, BUILD); eq(sb.PORUB.EDITION, BUILD); eq(E.MORE_URL, '../');
  eq(E.resolve('', 'full'), 'full'); eq(E.resolve('?demo', 'full'), 'demo'); eq(E.resolve('?edition=full', 'demo'), 'full'); eq(E.resolve('?demolition', 'full'), 'full');
  eq(E.campTag('demo', 0), 'campFull'); eq(E.campTag('full', 0), 'campSoon'); eq(E.campTag('full', 2), null);
  eq(E.finale('demo').items.join(), 'toMenu,more'); eq(E.finale('full').items.join(), 'toMenu');
  ok(/полной верси/.test(S.ru.campFull) && /full version/.test(S.en.campFull) && /полной верси/.test(S.ru.demoTitle) && /full version/.test(S.en.demoTitle), 'тексты');
  for (const k of ['campaign', 'campFull', 'campSoon', 'demoTitle', 'demoSub', 'soonTitle', 'soonSub', 'toMenu', 'more']) { ok(S.ru[k] && S.en[k], k); ok(!/[а-яё]/i.test(S.en[k]), 'кириллица в EN: ' + k); }
  eq(JSON.stringify(sb.PORUB.MISSION_FILES.demo), '[]'); eq(JSON.stringify(sb.PORUB.missionFiles('demo')), '[]'); eq(sb.PORUB.MISSIONS.length, 0);
  ok(sb.PORUB.missionFiles('full').length >= 3, 'в полной сборке — файлы кампании'); eq(JSON.stringify(sb.PORUB.missionFiles('platform')), JSON.stringify(sb.PORUB.missionFiles('full')), 'издание площадок без флага — как full');
  sb.PORUB.registerMission({ id: 'x2', n: 2 }); sb.PORUB.registerMission({ id: 'x1', n: 1 }); eq(sb.PORUB.MISSIONS.map(m => m.id).join(), 'x1,x2', 'реестр');
  if (!FULLBUILD) eq(fs.readdirSync(path.join(ROOT, 'js/missions')).join(), 'index.js', 'в публичном дереве нет файлов миссий');
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'); ok(/key: 'campaign'/.test(main) && /g\.scene\('edition'/.test(main), 'нет пункта «Кампания» / экрана издания');
});
test('i18n: у RU и EN одинаковый набор ключей', () => {
  const sb = { window: null }; sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'), sb);
  const S = sb.PORUB.STR, a = Object.keys(S.ru).sort(), b = Object.keys(S.en).sort();
  eq(a.join(), b.join());
  for (const r of ['wright', 'thicket']) { const R = P.RACES[r]; Object.keys(R.units).forEach(k => ok(S.ru['u_' + k] && S.en['d_' + k], k)); Object.keys(R.buildings).forEach(k => ok(S.ru['b_' + k] && S.en['d_' + k], k)); }
});
test('правило имён: в папке прототипа нет чужих названий игр/компаний/рас/юнитов (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список + известные RTS, их расы и юниты)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgnxjb21tYW5kb3zQutC+0LzQvNCw0L3QtNC+fGlrYXJpfNC40LrQsNGA0Lh8XGJtZXJjc1xifHNob2NrID90cm9vcGVyc3xcYmphY2thbFxifGhlYXZ5ID9iYXJyZWx8Z3VlcnI/aWxsYSA/d2FyfHJhbWJvfNGA0Y3QvNCx0L580YDQtdC80LHQvnx0aW1lID9zb2xkaWVyc3xmcm9udCA/bGluZXx3aG8gP2RhcmVzID93aW5zfGxhbmRpbmcgP3BhcnR5fHN0b3JtY2xvYWt8emFybml0c2F80LfQsNGA0L3QuNGGfG1ldGFsID9zbHVnfGNhbm5vbiA/Zm9kZGVyfGd1blwuPyA/c21va2V8YWxpZW4gP3N5bmRyb21lfGhhbG9cYnxjYWxsID9vZiA/ZHV0eXxzdGFyY3JhZnR80YHRgtCw0YDQutGA0LDRhNGCfHdhcmNyYWZ0fNCy0LDRgNC60YDQsNGE0YJ8XGJ6ZXJnfNC30LXRgNCzfHByb3Rvc3N80L/RgNC+0YLQvtGB0YF8XGJ0ZXJyYW580YLQtdGA0YDQsNC9fNC/0LjQu9C+0L18XGJweWxvbnM/XGJ80LfQuNC70L7Rgnx6ZWFsb3R80LzQvtGA0L/QtdGFfFxibWFyaW5lcz9cYnx6ZXJnbGluZ3xoeWRyYWxpc2t80LPQuNC00YDQsNC70LjRgdC6fG11dGFsaXNrfNC80YPRgtCw0LvQuNGB0Lp8dWx0cmFsaXNrfNGD0LvRjNGC0YDQsNC70LjRgdC6fG92ZXJsb3JkfGhhdGNoZXJ5fFxic2N2XGJ8c2llZ2UgP3Rhbmt8c3VwcGx5ID9kZXBvdHxmb290bWFufFxicGVvbnM/XGJ8YmxpenphcmR80LHQu9C40LfQt9Cw0YDQtHx3ZXN0d29vZHzQstC10YHRgtCy0YPQtHxjb21tYW5kID8oJnxhbmQpID9jb25xdWVyfHJlZCA/YWxlcnR8XGJkdW5lXGJ8dG90YWwgP2FubmloaWxhdGlvbnxzdXByZW1lID9jb21tYW5kZXJ8Y29tcGFueSA/b2YgP2hlcm9lc3xkYXduID9vZiA/d2FyfHdhcmhhbW1lcnxhZ2UgP29mID8oZW1waXJlc3xteXRob2xvZ3kpfHJpc2UgP29mID9uYXRpb25zfHN0cm9uZ2hvbGR8c2V0dGxlcnN8bm9ydGhnYXJkfHRoZXkgP2FyZSA/YmlsbGlvbnN8aXJvbiA/aGFydmVzdHxob21ld29ybGR8XGJra25kXGJ8d2Fyem9uZSA/MjEwMHzQutCw0LfQsNC60LgoPyFb0LAt0Y/RkV0pfGNvc3NhY2tzfNCx0LvQuNGG0LrRgNC40LN8YmxpdHprcmllZ3zQsiDRgtGL0LvRgyDQstGA0LDQs9CwfG1lbiA/b2YgP3dhcnxzcGVsbGZvcmNlfGJhdHRsZSA/cmVhbG1zfFxibXl0aFxifGVuc2VtYmxlID9zdHVkaW9zfHJlbGljID9lbnRlcnRhaW5tZW50fG5pZ2h0ID9lbGZ80L3QvtGH0L1b0LAt0Y9dKyDRjdC70YzRhHxcYm5leHVzXGJ8d2FycCA/Z2F0ZQ==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 9, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ["U3RhckNyYWZ0", "V2FyY3JhZnQgSUlJ", "WmVyZw==", "UHJvdG9zcw==", "VGVycmFu", "UHlsb24=", "WmVyZ2xpbmc=", "Q29tbWFuZCAmIENvbnF1ZXI=", "QWdlIG9mIEVtcGlyZXM=", "V2FyaGFtbWVy", "0KHRgtCw0YDQutGA0LDRhNGC", "0JfQtdGA0LM=", "0LzQvtGA0L/QtdGF", "0JrQsNC30LDQutC4", "Tm9ydGhnYXJk", "Q29udHJh"].forEach(b => ok(BAD.test(u(b)), 'стоп-лист не ловит ' + u(b)));
  ['ПОРУБЕЖЬЕ', 'PORUBEZHYE', 'Мастеровые', 'Живая чаща', 'Короед', 'Жалильщик', 'Панцирник', 'Топотун', 'Острог', 'Пень-матерь', 'грибница', 'личинки', 'Гефест', 'terrain', 'Stockade', 'Gunhouse', 'CONTRACT.md'].forEach(w => ok(!BAD.test(w), 'ложное срабатывание: ' + w));
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

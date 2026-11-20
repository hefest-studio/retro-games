/* ПРИИСК · tests/campaign-sizye.test.mjs — вторая сторона, Артель Сизого Перевала (общий движок, публично):
   ветряки на гребнях и ветер, канатная дорога (опоры, забой, люльки, сбитая опора), производство зимовья/верфи, герои Сизых
   (Агафья — переброска по канату, Митяй — уговор поста, Корней — ярость при обороне), скирмиш за обе стороны (ИИ Медного Ключа
   против игрока-Сизых — строит, добывает, шлёт волну; Сизые-бот добывают медь канаткой), точка сбора у любого здания, что
   выпускает юнитов (зимовьё, верфь), ИИ Сизых на их механике (Медный Ключ против ИИ-Сизых: 3 сида против ИИ Медного Ключа и
   3 против бота-игрока, партия 10–20 мин; без гребней у избы — опоры к дальнему гребню), две кампании — два сохранения,
   связка кампаний (флаги чужой кампании), реестр (s1–s5 — только полная версия), демо: кампания Сизых — под замком.
   Запуск: node priisk/tests/campaign-sizye.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadGame, test, eq, ok, runAll, memStore, helpers } from './lib.mjs';
import { sizyeHelpers } from './campaign-sizye-lib.mjs';

const G = loadGame();
const { P, L, C, STR } = G;
const { tickN, tiny } = helpers(G);
const SZ = sizyeHelpers(L);
const run = (W, sec, dt = 1 / 20, until) => { for (let i = 0; i < sec / dt; i++) { L.step(W, dt); W.events.length = 0; if (until && until()) return true; } return false; };
const open = (w, h) => Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => (i === 0 || j === 0 || i === w - 1 || j === h - 1) ? '#' : '.').join(''));
function szWorld(rows) { const W = L.worldFromMap(rows); L.setSides(W, ['sizye', 'copper']); return W; }

// ---------- сторона ----------
test('сторона Сизых: свои здания и юниты (не перекраска), лёгкая быстрая техника тоньше бронёй, списки кнопок', () => {
  const sl = L.sideLists('sizye'), cl = L.sideLists('copper');
  eq(sl.b, ['mill', 'pylon', 'hut', 'station', 'face', 'sail']); eq(sl.u, ['ranger', 'skiff', 'harpoon']);
  ok(!sl.b.some(t => cl.b.includes(t)) && !sl.u.some(t => cl.u.includes(t)), 'пересечение со списками Медного Ключа');
  ok(!L.BUILD_LIST.includes('mill') && !L.UNIT_LIST.includes('skiff'), 'попало в классический скирмиш');
  const U = L.UNITS;
  ok(U.skiff.speed > U.crawler.speed && U.skiff.hp < U.crawler.hp, 'ветроход: быстрее и тоньше самохода');
  ok(U.harpoon.hp < U.ironwagon.hp && U.harpoon.range > U.ironwagon.range, 'самострел: тоньше броневоза, бьёт дальше');
  ok(U.ranger.hp < U.rifleman.hp && U.ranger.speed > U.rifleman.speed, 'горный стрелок: легче');
  [...sl.b, ...sl.u, 'korney', 'agafya', 'mityay', 'hqS', 'steamS', 'abRage', 'abCable', 'abTalk', 'campMapS', 'sideSizye', 'workS'].forEach(k => ok(STR.ru[k] && STR.en[k], 'нет RU/EN: ' + k));
});
test('скирмиш за Сизых: стороны и палитра (сирень у игрока), стартовый отряд Сизых, гряды у базы под ветряки, ветер', () => {
  const W = L.newWorld({ seed: 5, side: 'sizye', ai: false });
  eq(W.fac, ['sizye', 'copper']); eq(L.has(W, 0, 'hq').pi, 1); eq(L.has(W, 1, 'hq').pi, 0); eq(L.has(W, 0, 'hq').look, 'sizye');
  eq(W.units.filter(u => u.owner === 0).map(u => u.type).sort(), ['ranger', 'ranger', 'ranger', 'skiff']);
  eq(W.units.filter(u => u.owner === 1).map(u => u.type).sort(), ['crawler', 'rifleman', 'rifleman', 'rifleman']);
  const hq = L.has(W, 0, 'hq'); ok(SZ.millSpot(W, 0, hq.tx + 1, hq.ty + 1, 8), 'у базы нет места под ветряк');
  ok(W.wind && W.wind.s > 0, 'нет ветра');
  const W0 = L.newWorld({ seed: 5, ai: false }); eq(W0.fac, null, 'без стороны — классика'); eq(L.has(W0, 0, 'hq').look, undefined);
});

// ---------- ветер ----------
test('ветряк: только на гребне (у скал); выработка = сила ветра; в тени скал (ветер со стороны гряды) — меньше', () => {
  const rows = open(24, 12); rows[3] = '#..######..............#'; const W = szWorld(rows);
  L.addBuilding(W, 0, 'hq', 7, 6);
  ok(L.canPlace(W, 0, 'mill', 4, 4), 'у гряды — можно'); ok(!L.canPlace(W, 0, 'mill', 11, 8), 'в чистом поле — нельзя'); ok(L.canPlace(W, 0, 'hut', 11, 8), 'зимовье там же — можно');
  L.setWind(W, { dir: 'S', s: 1, now: true, lock: true }); const m = L.addBuilding(W, 0, 'mill', 4, 4);
  eq(m.pw, L.MILL.power, 'ветер с юга, гряда с севера — полная выработка'); ok(!L.sheltered(W, m));
  L.setWind(W, { dir: 'N', s: 1, now: true }); L.calcPower(W); ok(L.sheltered(W, m), 'ветер с севера — гряда закрывает');
  eq(m.pw, Math.round(L.MILL.power * L.MILL.shelter));
  L.setWind(W, { dir: 'S', s: 0.5, now: true }); L.calcPower(W); eq(m.pw, Math.round(L.MILL.power * 0.5), 'слабый ветер');
  eq(W.players[0].pOut, 10 + m.pw, 'контора + ветряк');
});
test('ветер в скирмише сам меняет направление и силу; сценарий может зафиксировать (lock)', () => {
  const W = L.newWorld({ seed: 9, side: 'sizye', ai: false }), a0 = W.wind.a, s0 = W.wind.s;
  run(W, 240, 1 / 10); ok(Math.abs(W.wind.a - a0) > 0.05 || Math.abs(W.wind.s - s0) > 0.05, 'ветер не меняется');
  L.setWind(W, { dir: 'E', s: 1.2, now: true, lock: true }); run(W, 300, 1 / 10); eq(+W.wind.s.toFixed(2), 1.2); eq(+W.wind.a.toFixed(2), 0);
});

// ---------- канатка ----------
test('канатка: опора — в пролёте от своего узла; забой — только у жилы; пролёты — дерево, а не паутина', () => {
  const rows = open(40, 14); for (let j = 4; j <= 8; j++) rows[j] = rows[j].slice(0, 30) + 'ooo' + rows[j].slice(33);
  const W = szWorld(rows); L.addBuilding(W, 0, 'hq', 2, 5); L.addBuilding(W, 0, 'station', 6, 5);
  ok(L.canPlace(W, 0, 'pylon', 14, 6), 'в пролёте'); ok(!L.canPlace(W, 0, 'pylon', 21, 6), 'дальше пролёта');
  ok(!L.canPlace(W, 0, 'face', 10, 2), 'забой не у жилы');
  const p1 = L.addBuilding(W, 0, 'pylon', 14, 6), p2 = L.addBuilding(W, 0, 'pylon', 21, 6), p3 = L.addBuilding(W, 0, 'pylon', 15, 3);
  ok(L.canPlace(W, 0, 'face', 27, 6), 'забой у жилы в пролёте'); const f = L.addBuilding(W, 0, 'face', 27, 6);
  const links = L.cableLinks(W, 0); eq(links.length, L.cableNodes(W, 0).length - 1, 'дерево: рёбер = узлов − 1');
  const rt = L.cableRoute(W, f, b => b.type === 'station'); eq(rt[rt.length - 1].type, 'station'); ok(rt.length >= 3 && rt.slice(0, -1).every(b => b.type === 'pylon'), 'маршрут ' + rt.map(b => b.type));
  ok(!L.canPlace(W, 0, 'hut', 21, 8), 'обычные здания от опор не ставятся (только ветряки)');
  ok(p1 && p2 && p3);
});
test('канатка: забой копит медь, люльки везут её на Станцию; сбитая опора — люлька падает, медь не приходит', () => {
  const rows = open(40, 14); for (let j = 4; j <= 8; j++) rows[j] = rows[j].slice(0, 30) + 'ooo' + rows[j].slice(33);
  const W = szWorld(rows); L.addBuilding(W, 0, 'hq', 2, 5); L.addBuilding(W, 0, 'station', 6, 5);
  const a = L.addBuilding(W, 0, 'pylon', 14, 6), b = L.addBuilding(W, 0, 'pylon', 21, 6), f = L.addBuilding(W, 0, 'face', 27, 6);
  L.addBuilding(W, 0, 'mill', 10, 1); L.setWind(W, { dir: 'S', s: 1, now: true, lock: true }); L.calcPower(W); ok(L.powerFactor(W, 0) === 1, 'ветра не хватает');
  const pl = W.players[0]; pl.copper = 0;
  let falls = 0; for (let i = 0; i < 60 * 20; i++) { L.step(W, 1 / 20); W.events.forEach(e => { if (e.t === 'carFall') falls++; }); W.events.length = 0; }
  ok(pl.mined >= 120, 'за минуту по канату пришло ' + pl.mined); eq(pl.copper, pl.mined); eq(falls, 0);
  ok(f.link === true);
  // ждём люльку в пути и сбиваем опору под ней
  run(W, 30, 1 / 20, () => W.cars.some(c => c.k <= 2)); ok(W.cars.length > 0, 'нет люльки в пути');
  const before = pl.mined; b.hp = 0;
  for (let i = 0; i < 20 * 20; i++) { L.step(W, 1 / 20); W.events.forEach(e => { if (e.t === 'carFall') falls++; }); W.events.length = 0; }
  ok(falls >= 1, 'люлька не упала'); eq(pl.mined, before, 'медь пришла по сбитому канату'); eq(f.link, false, 'забой без связи');
  ok(a.hp > 0);
});
test('производство Сизых: зимовье → горный стрелок, верфь → ветроход и самострел (свои очереди, требования)', () => {
  const W = szWorld(open(40, 20)); L.addBuilding(W, 0, 'hq', 2, 2); const pl = W.players[0]; pl.copper = 5000;
  ok(!L.queueUnit(W, 0, 'ranger'), 'без зимовья'); ok(!L.reqMet(W, 0, 'hut'), 'зимовье без ветряка');
  L.addBuilding(W, 0, 'hut', 7, 2); L.addBuilding(W, 0, 'sail', 12, 2); L.calcPower(W);
  ok(L.queueUnit(W, 0, 'ranger') && L.queueUnit(W, 0, 'skiff') && L.queueUnit(W, 0, 'harpoon'));
  eq(pl.inf, ['ranger']); eq(pl.veh, ['skiff', 'harpoon']); ok(L.dequeueUnit(W, 0, 'harpoon')); eq(pl.veh, ['skiff']);
  run(W, 30, 1 / 20); const tys = W.units.filter(u => u.owner === 0).map(u => u.type).sort(); eq(tys, ['ranger', 'skiff']);
});

// ---------- герои ----------
test('Агафья, «Переброска»: отряд рядом садится в люльки и едет по канату через пропасть; в пути его не достать', () => {
  const rows = open(36, 12); for (let j = 1; j <= 10; j++) rows[j] = rows[j].slice(0, 15) + '~~~~~' + rows[j].slice(20);
  const W = szWorld(rows); L.addBuilding(W, 0, 'pylon', 12, 5); L.addBuilding(W, 0, 'pylon', 18, 5); L.addBuilding(W, 0, 'pylon', 23, 5);
  const ag = L.addUnit(W, 0, 'agafya', 11.5, 6.5), r1 = L.addUnit(W, 0, 'ranger', 10.5, 6.5), r2 = L.addUnit(W, 0, 'ranger', 11.5, 7.5), far = L.addUnit(W, 0, 'ranger', 3.5, 3.5);
  const foe = L.addUnit(W, 1, 'rifleman', 17.2, 9.5); foe.calm = true; // стоит на краю, мирный — проверим, что едущих не бьют
  ok(L.findPath(W, 11.5, 6.5, 26.5, 6.5).length === 0 || Math.hypot(L.findPath(W, 11.5, 6.5, 26.5, 6.5).slice(-1)[0].x - 26.5, 0) > 3, 'пропасть проходима пешком');
  eq(L.ability(W, ag, 30, 30), 'far', 'к узлу у точки'); eq(L.ability(W, ag, 23.5, 5.5), 'ok');
  ok(ag.riding && r1.riding && r2.riding && !far.riding, 'сели не те');
  const hp = r1.hp; ok(run(W, 8, 1 / 20, () => !ag.riding && !r1.riding && !r2.riding), 'не доехали');
  [ag, r1, r2].forEach(u => ok(u.x > 20 && W.t[Math.floor(u.y) * W.w + Math.floor(u.x)] !== L.WATER, 'высадка ' + u.type + ' ' + u.x.toFixed(1)));
  ok(ag.abT > 0); eq(r1.hp, hp);
  const W2 = szWorld(open(20, 10)), a2 = L.addUnit(W2, 0, 'agafya', 5.5, 5.5); eq(L.ability(W2, a2, 10, 5), 'nonode', 'без опор рядом');
});
test('Митяй, «Уговор»: стоит у поста 4 с — пост становится мирным (talked); обстрелян — уговор срывается', () => {
  const W = szWorld(open(24, 12)); const m = L.addUnit(W, 0, 'mityay', 5.5, 5.5);
  const posts = [L.addUnit(W, 2, 'rifleman', 7.5, 5.5), L.addUnit(W, 2, 'rifleman', 7.5, 6.5)]; posts.forEach(u => { u.tag = 'p1'; u.talk = true; u.calm = true; });
  eq(L.ability(W, L.addUnit(W, 0, 'mityay', 20.5, 9.5)), 'far', 'далеко от поста');
  eq(L.ability(W, m), 'ok'); let talked = null;
  for (let i = 0; i < 6 * 20; i++) { L.step(W, 1 / 20); W.events.forEach(e => { if (e.t === 'talked') talked = e.tag; }); W.events.length = 0; }
  eq(talked, 'p1'); ok(posts.every(u => u.talked && u.calm && !u.talk));
  const W3 = szWorld(open(24, 12)), m3 = L.addUnit(W3, 0, 'mityay', 5.5, 5.5), p3 = L.addUnit(W3, 2, 'rifleman', 7.5, 5.5); p3.tag = 'p'; p3.talk = true; p3.calm = true;
  L.ability(W3, m3); run(W3, 1.5); let fail = false; m3.hitT = W3.time; for (let i = 0; i < 20; i++) { L.step(W3, 1 / 20); W3.events.forEach(e => { if (e.t === 'talkFail') fail = true; }); W3.events.length = 0; }
  ok(fail && !m3.talking && !p3.talked, 'не сорвалось');
});
test('Корней: ярость — союзной пехоте у своих зданий (оборона); в поле — только по кличу Q', () => {
  const W = szWorld(open(40, 16)); L.addBuilding(W, 0, 'hut', 3, 3);
  const k = L.addUnit(W, 0, 'korney', 6.5, 4.5), r = L.addUnit(W, 0, 'ranger', 7.5, 4.5);
  L.step(W, 0.05); ok(r.bD > 1, 'у зимовья — нет ярости');
  k.x = r.x = 30.5; r.x = 31.5; L.step(W, 0.05); eq(r.bD, 1, 'в поле — ярость без клича');
  eq(L.ability(W, k), 'ok'); L.step(W, 0.05); ok(r.bD >= L.HEROES.korney.cryDmg, 'клич');
});

// ---------- скирмиш за обе стороны ----------
// бот Сизых: ветряки на гребнях, станция, канатка к ближайшей жиле, забой, зимовье и стрелки (без реакции — это проверка ИИ, а не человека)
function sizyeBot(W) {
  const o = 0, hq = L.has(W, 0, 'hq'), pl = W.players[0], c = L.center(hq); let ore = null, bd = 1e9;
  for (let k = 0; k < W.w * W.h; k++) if (W.ore[k] > 0) { const x = k % W.w + 0.5, y = Math.floor(k / W.w) + 0.5, d = Math.hypot(x - c.x, y - c.y); if (d < bd) { bd = d; ore = { x, y }; } }
  return () => {
    if (!hq || hq.hp <= 0) return;
    const n = t => W.blds.filter(b => b.owner === o && b.type === t).length;
    const faces = W.blds.filter(b => b.owner === o && b.type === 'face'), linked = faces.some(f => L.cableRoute(W, f, b => b.type === 'station').length);
    let want = n('mill') < 1 ? 'mill' : !n('station') ? 'station' : !linked ? null : n('hut') < 1 ? 'hut' : pl.pOut < pl.pUse + 6 ? 'mill' : n('sail') < 1 ? 'sail' : n('face') < 2 ? 'face' : 'mill';
    if (!want) { // тянем канат к жиле: забой, если дотягиваемся, иначе опора
      want = SZ.faceSpot(W, o, ore.x, ore.y) ? 'face' : 'pylon';
    }
    const spot = want === 'mill' ? SZ.millSpot(W, o, c.x, c.y, 12) : want === 'pylon' ? SZ.pylonToward(W, o, ore.x, ore.y) : want === 'face' ? SZ.faceSpot(W, o, ore.x, ore.y) : SZ.spotNear(W, o, want, c.x, c.y, 10);
    if (pl.build && pl.build.ready) { const sp2 = pl.build.type === 'mill' ? SZ.millSpot(W, o, c.x, c.y, 12) : pl.build.type === 'pylon' ? SZ.pylonToward(W, o, ore.x, ore.y) : pl.build.type === 'face' ? SZ.faceSpot(W, o, ore.x, ore.y) : SZ.spotNear(W, o, pl.build.type, c.x, c.y, 10); if (!sp2 || !L.placeBuild(W, o, sp2.i, sp2.j)) L.cancelBuild(W, o); }
    else if (!pl.build && spot && pl.copper >= L.BLDS[want].cost) L.startBuild(W, o, want);
    if (n('hut') && pl.inf.length < 2 && pl.copper > 300) L.queueUnit(W, o, 'ranger');
    if (n('sail') && pl.veh.length < 1 && pl.copper > 900) L.queueUnit(W, o, Math.random() < 0.5 ? 'skiff' : 'harpoon');
    // армия у базы: все свободные — к конторе (ИИ сам нападёт)
    W.units.filter(u => u.owner === o && u.order.t === 'idle' && Math.hypot(u.x - c.x, u.y - c.y) > 8).forEach(u => L.commandMove(W, [u.id], c.x + 3, c.y - 2, true));
  };
}
test('скирмиш за Сизых против ИИ Медного Ключа: ИИ строит и добывает, шлёт волну к избе; Сизые-бот возят медь канаткой (3 сида)', () => {
  for (const seed of [2, 5, 8]) {
    const W = L.newWorld({ seed, side: 'sizye' }), hq = L.has(W, 0, 'hq'), b = sizyeBot(W);
    let near = false, t = 0, spun = 0;
    for (let i = 0; i < 420 * 10; i++) { if (i % 5 === 0) b(); L.step(W, 0.1); W.events.length = 0; if (W.units.some(u => u.owner === 1 && u.wave && Math.hypot(u.x - hq.tx, u.y - hq.ty) < 12)) near = true; spun = Math.max(spun, W.players[0].pOut - 10); }
    const ai = W.blds.filter(x => x.owner === 1 && x.type !== 'hq');
    ok(ai.some(x => x.type === 'smelter') && W.players[1].mined > 0, 'сид ' + seed + ': ИИ не добывает');
    ok(W.ai.waves >= 1 && near, 'сид ' + seed + ': волна не дошла до Сизых');
    ok(W.players[0].mined >= 200, 'сид ' + seed + ': канаткой привезено ' + W.players[0].mined);
    ok(spun > 0, 'сид ' + seed + ': ветряки не крутятся');
    t = Math.round(W.time); console.log('     сид ' + seed + ': Сизые ' + W.players[0].mined + ' меди канаткой (ветер до +' + spun + '), ИИ — ' + W.players[1].mined + ', волн ' + W.ai.waves + ', ' + t + ' с, победитель ' + W.winner);
  }
});
test('скирмиш за Медный Ключ — классика без изменений: ИИ (Сизые, сирень) строит котельные и плавильню', () => {
  const W = L.newWorld({ seed: 1, side: 'copper' }); eq(W.fac, null); run(W, 200, 1 / 20);
  ok(W.blds.some(b => b.owner === 1 && b.type === 'boiler'), 'ИИ не строит котельную'); eq(L.has(W, 1, 'hq').pi, 1);
});

// ---------- точка сбора ----------
test('точка сбора: любое здание, что выпускает юнитов (барак, мастерская, зимовьё, верфь), а не только Барак и Мастерская', () => {
  ['bunk', 'works', 'hut', 'sail'].forEach(t => ok(L.producer(t), t)); ['hq', 'mill', 'pylon', 'station', 'face', 'boiler', 'smelter', 'tower'].forEach(t => ok(!L.producer(t), t));
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'); ok(/L\.producer\(sb\.type\)/.test(src) && !/sb\.type === 'bunk' \|\| sb\.type === 'works'/.test(src), 'main.js: точка сбора по списку типов');
  for (const [t, u] of [['hut', 'ranger'], ['sail', 'skiff']]) { // зимовьё и верфь: новый юнит идёт к точке сбора
    const W = szWorld(open(24, 16)); const hq = L.addBuilding(W, 0, 'hq', 2, 2), mill = L.addBuilding(W, 0, 'mill', 6, 2), st = L.addBuilding(W, 0, 'station', 2, 8), b = L.addBuilding(W, 0, t, 7, 7);
    W.players[0].copper = 2000; b.rally = { x: 19.5, y: 12.5 }; ok(L.queueUnit(W, 0, u), u); run(W, 40, 1 / 20);
    const v = W.units.find(x => x.type === u); ok(v && Math.hypot(v.x - 19.5, v.y - 12.5) < 2, t + ': ' + u + ' не дошёл до точки сбора (' + (v && v.x.toFixed(1)) + ',' + (v && v.y.toFixed(1)) + ')');
  }
});

// ---------- ИИ Сизых на их механике (скирмиш: Медный Ключ против ИИ-Сизых) ----------
// бот-игрок Медного Ключа: реакция 150–250 мс, одно действие за раз (стройка по списку, стрелки и машины, оборона, атака с 10-й минуты)
function copperPlan(W) {
  const hq = L.has(W, 0, 'hq'), c = L.center(hq), order = ['boiler', 'smelter', 'bunk', 'boiler', 'works', 'boiler', 'boiler']; let attackAt = 600, flip = 0;
  return () => {
    const pl = W.players[0], n = t => W.blds.filter(b => b.owner === 0 && b.type === t).length; if (!L.has(W, 0, 'hq')) return null;
    if (pl.build && pl.build.ready) { const sp = L.aiSpot(W, 0, pl.build.type, hq); return () => { if (!sp || !L.placeBuild(W, 0, sp.i, sp.j)) L.cancelBuild(W, 0); }; }
    const built = order.filter((t, i) => order.slice(0, i + 1).filter(x => x === t).length <= n(t)).length, want = built < order.length ? order[built] : (pl.pUse + 10 > pl.pOut ? 'boiler' : null);
    if (!pl.build && want && L.reqMet(W, 0, want) && pl.copper >= L.BLDS[want].cost) return () => L.startBuild(W, 0, want);
    const army = W.units.filter(u => u.owner === 0 && u.type !== 'hauler');
    if (n('bunk') && pl.inf.length < 1 && army.filter(u => u.type === 'rifleman').length < 6 && pl.copper >= 300) return () => L.queueUnit(W, 0, 'rifleman');
    if (n('works') && pl.veh.length < 1 && pl.copper >= 900) return () => L.queueUnit(W, 0, flip++ % 3 === 2 ? 'ironwagon' : 'crawler');
    const foe = W.units.find(e => e.owner === 1 && e.hp > 0 && Math.hypot(e.x - c.x, e.y - c.y) < 14), idle = army.filter(u => u.order.t === 'idle');
    if (foe && idle.length) return () => L.commandMove(W, idle.map(u => u.id), foe.x, foe.y, true);
    if (W.time > attackAt && idle.length >= 10) { const t = L.has(W, 1, 'hq'); if (t) { attackAt = W.time + 120; return () => L.commandMove(W, idle.map(u => u.id), t.tx + 1, t.ty + 1, true); } }
    return null;
  };
}
// партия до конца (не дольше 25 мин); что делал ИИ Сизых
function szMatch(seed, vs, opt = {}) {
  const W = L.newWorld(Object.assign({ seed, foe: 'sizye' }, opt)), A0 = vs === 'ai' ? L.newAI(W, 0) : null, b = vs === 'bot' ? H.bot(W, copperPlan(W), seed) : null;
  const st = { millOn: 0, linked: 0, built: new Set(), maxFaces: 0, waveHit: false, pylons: 0 };
  for (let i = 0; i < 25 * 60 * 10 && W.winner < 0; i++) {
    if (A0) L.aiStep(W, 0.1, A0); if (b) b.step(); L.step(W, 0.1); W.events.length = 0;
    if (i % 50 === 0) {
      W.blds.filter(x => x.owner === 1).forEach(x => st.built.add(x.type));
      st.millOn = Math.max(st.millOn, W.blds.filter(x => x.owner === 1 && x.type === 'mill' && x.pw > 0).length);
      st.maxFaces = Math.max(st.maxFaces, W.blds.filter(x => x.owner === 1 && x.type === 'face' && x.link).length);
      st.pylons = Math.max(st.pylons, W.blds.filter(x => x.owner === 1 && x.type === 'pylon').length);
      const h0 = L.has(W, 0, 'hq'); if (h0 && W.units.some(u => u.owner === 1 && u.wave && Math.hypot(u.x - h0.tx, u.y - h0.ty) < 14)) st.waveHit = true;
    }
  }
  return { W, st };
}
const H = helpers(G);
test('скирмиш против ИИ-Сизых: стороны (Медный Ключ — латунь, ИИ — Сизые на ветряках), у их базы — гряды, ИИ на своей механике; без foe — классика', () => {
  const W = L.newWorld({ seed: 3, foe: 'sizye' }); eq(W.fac, ['copper', 'sizye']); ok(W.ai.sz, 'ИИ не Сизых'); ok(W.wind, 'нет ветра'); eq(L.has(W, 1, 'hq').look, 'sizye');
  eq(W.units.filter(u => u.owner === 1).map(u => u.type).sort(), ['ranger', 'ranger', 'ranger', 'skiff']);
  const hq = L.has(W, 1, 'hq'); let rock = 0; for (let j = hq.ty - 2; j <= hq.ty + 8; j++) for (let i = hq.tx - 7; i <= hq.tx + 4; i++) if (W.t[j * W.w + i] === L.ROCK) rock++; ok(rock >= 8, 'нет гряд у базы Сизых');
  run(W, 120, 1 / 20); ok(!W.blds.some(b => b.owner === 1 && ['boiler', 'smelter', 'bunk', 'works'].includes(b.type)), 'ИИ Сизых строит котельные');
  ok(L.newWorld({ seed: 3 }).ai.sz !== true && L.newWorld({ seed: 3, side: 'copper' }).fac === null, 'классика задета');
  ok(L.newWorld({ seed: 3, side: 'sizye', foe: 'sizye' }).fac[1] === 'copper', 'за Сизых соседи — всегда Медный Ключ');
  const ui = fs.readFileSync(path.join(ROOT, 'js/campaign-ui.js'), 'utf8'); ok(/key: 'foe'/.test(ui) && /arcade\.priisk\.foe/.test(ui) && /SKIRMISH_FOE/.test(ui), 'пункт меню «Соседи»');
  ok(STR.ru.foeSizye && STR.en.foeSizye && STR.ru.foeClassic, 'тексты пункта меню');
});
for (const vs of ['ai', 'bot']) {
  test('скирмиш против ИИ-Сизых (' + (vs === 'ai' ? 'против ИИ Медного Ключа' : 'против бота-игрока Медного Ключа, реакция 150–250 мс') + '): ветряки на гребнях, канатка, забои, армия, волна; партия 10–20 мин (3 сида)', () => {
    for (const seed of [1, 3, 7]) {
      const { W, st } = szMatch(seed, vs), m = (W.time / 60).toFixed(1);
      ['mill', 'station', 'face', 'hut', 'sail'].forEach(t => ok(st.built.has(t), 'сид ' + seed + ': ИИ не поставил ' + t));
      ok(st.millOn >= 2, 'сид ' + seed + ': ветряки не крутятся'); ok(st.maxFaces >= 2, 'сид ' + seed + ': забоев с канатом ' + st.maxFaces);
      ok(W.players[1].mined >= 3000, 'сид ' + seed + ': ИИ добыл ' + W.players[1].mined); ok((W.players[1].trained.skiff || 0) + (W.players[1].trained.harpoon || 0) >= 4, 'сид ' + seed + ': мало машин');
      ok(W.ai.waves >= 1 && st.waveHit, 'сид ' + seed + ': ИИ не атаковал'); ok(W.winner >= 0 && W.time >= 600 && W.time <= 1200, 'сид ' + seed + ': партия ' + m + ' мин, победитель ' + W.winner);
      console.log('     сид ' + seed + ': ' + m + ' мин, победитель ' + (W.winner === 1 ? 'ИИ Сизых' : 'Медный Ключ') + ', ИИ Сизых: добыл ' + W.players[1].mined + ', ветряков в работе до ' + st.millOn + ', забоев до ' + st.maxFaces + ', волн ' + W.ai.waves + ', обучено ' + JSON.stringify(W.players[1].trained));
    }
  });
}
test('ИИ-Сизых: гребней у базы нет — тянет опоры к дальнему гребню и ставит ветряки там; без ветра — запас (лишних потребителей нет), добыча идёт', () => {
  // открытое поле 44×34: изба в середине, жила рядом, ближайшие скалы — края карты (11+ клеток)
  const rows = open(44, 34).map((r, j) => j >= 18 && j <= 20 ? r.slice(0, 26) + 'ooo' + r.slice(29) : r), W = L.worldFromMap(rows);
  L.setSides(W, ['copper', 'sizye']); L.setWind(W, { dir: 'N', s: 1, lock: true, now: true });
  const hq = L.addBuilding(W, 1, 'hq', 20, 15), c = L.center(hq); W.players[1].copper = 2500; W.ai = L.newSzAI(W, 1);
  ok(!L.szMillSpot(W, 1, c), 'у избы нашёлся гребень — проверка не о том');
  run(W, 480, 1 / 10);
  const mills = W.blds.filter(b => b.owner === 1 && b.type === 'mill'), on = mills.filter(b => b.pw > 0);
  ok(W.ai.farPy > 0 && W.blds.some(b => b.owner === 1 && b.type === 'pylon'), 'опоры к дальнему гребню не тянул');
  ok(on.length >= 1 && on.every(b => Math.hypot(b.tx + 1 - c.x, b.ty + 1 - c.y) >= 8), 'ветряков на дальнем гребне: ' + on.length);
  ok(W.players[1].mined >= 600, 'добыча ' + W.players[1].mined); ok(W.players[1].pUse <= W.players[1].pOut + 20, 'потребителей больше, чем ветра: ' + W.players[1].pOut + '/' + W.players[1].pUse);
  console.log('     без гребней у избы: ветряков ' + mills.length + ' (крутятся ' + on.length + '), опор к гребню ' + W.ai.farPy + ', добыто ' + W.players[1].mined + ', ветер/расход ' + W.players[1].pOut + '/' + W.players[1].pUse);
});

// ---------- две кампании ----------
test('две кампании: свои списки (P.MISSIONS — Медный Ключ, P.MISSIONS_S — Сизые), свои сохранения и сброс', () => {
  ok(P.MISSIONS.every(m => C.campOf(m) === 'copper') && P.MISSIONS_S.every(m => C.campOf(m) === 'sizye'));
  const st = memStore(), a = C.newSave(), b = C.newSave('sizye');
  a.flags.alliance = 'help'; b.flags.debt = 'paid'; b.unlocked = 3; C.save(st, a); C.save(st, b);
  ok(st.m.has(C.KEYS.copper) && st.m.has(C.KEYS.sizye) && C.KEYS.copper === 'arcade.priisk.campaign');
  eq(C.load(st, 'sizye').unlocked, 3); eq(C.load(st).flags, { alliance: 'help' }); eq(C.load(st, 'sizye').camp, 'sizye');
  C.reset(st, 'sizye'); ok(!st.m.has(C.KEYS.sizye) && st.m.has(C.KEYS.copper), 'сброс задел чужую кампанию');
});
test('связка кампаний: флаги Медного Ключа (если пройден) попадают в миссию Сизых как copper.*; без сохранения — нет', () => {
  const def = tiny({ id: 'sx', camp: 'sizye', side: 'sizye', xcarry: { copper: ['alliance', 'convoy'] },
    player: { copper: 0, start: [{ type: 'ranger', at: 'S', n: 1 }, { type: 'skiff', at: 'S', when: { t: 'flag', key: 'copper.alliance', value: 'help' } }] } });
  const cs = C.newSave(); cs.flags.alliance = 'help'; cs.missions.m1 = { stars: [true] }; cs.missions.m7 = { stars: [true] };
  const W = C.build(def, { xsave: { copper: cs } });
  eq(W.mission.flags['copper.alliance'], 'help'); eq(W.mission.flags['copper.done'], 2); eq(W.mission.flags['copper.convoy'], undefined);
  eq(W.units.filter(u => u.owner === 0).map(u => u.type).sort(), ['ranger', 'skiff'], 'стартовые силы по чужому флагу');
  const W2 = C.build(def, { xsave: { copper: null } }); eq(W2.mission.flags['copper.alliance'], undefined); eq(W2.units.filter(u => u.owner === 0).length, 1);
  eq(W.fac, ['sizye', 'copper']); eq(W.units[0].pi, 1);
  const st = memStore(); C.save(st, cs); P.campaign.store = st; const W3 = C.build(def); eq(W3.mission.flags['copper.alliance'], 'help', 'чтение из хранилища'); delete P.campaign.store;
});
test('действия и условия Сизых: wind, talked, cabled, linked, wind gte/lte', () => {
  const def = tiny({ id: 'sy', camp: 'sizye', side: 'sizye', wind: { dir: 'W', s: 0.4, lock: true } });
  const W = C.build(def), MS = W.mission;
  ok(C.cond(W, { t: 'wind', lte: 0.45 }) && !C.cond(W, { t: 'wind', gte: 0.6 }));
  C.act(W, { a: 'wind', s: 1.1, now: true }); ok(C.cond(W, { t: 'wind', gte: 1 }));
  ok(!C.cond(W, { t: 'linked' })); ok(!C.cond(W, { t: 'talked', tag: 'p' })); ok(!C.cond(W, { t: 'cabled' }));
  W.events.push({ t: 'talked', owner: 0, tag: 'p' }, { t: 'cableIn', owner: 0, id: 1 }); C.step(W, 0.01);
  ok(C.cond(W, { t: 'talked', tag: 'p' }) && C.cond(W, { t: 'cabled', gte: 1 }));
});

// ---------- издание и реестр ----------
test('реестр: s1–s3 — только в полной версии (файлов в публичном дереве нет); демо — кампания Сизых под замком', () => {
  ['s1', 's2', 's3'].forEach(id => { ok(P.MISSION_FILES.full.includes(id), id); ok(!P.MISSION_FILES.demo.includes(id)); ok(!fs.existsSync(path.join(ROOT, 'js/missions/' + id + '.js')), 'файл ' + id + ' в публичном дереве'); ok(!P.Edition.playable('demo', id)); });
  ['s4', 's5'].forEach(id => { ok(P.MISSION_FILES.full.includes(id), id + ' в реестре full'); ok(!fs.existsSync(path.join(ROOT, 'js/missions/' + id + '.js')), 'файл ' + id + ' в публичном дереве'); ok(!P.Edition.playable('demo', id)); });
  ok(!P.MISSION_FILES.full.some(id => /^s[6-9]$/.test(id)), 's6–s9 ещё не готовы — в реестре их нет');
  const src = fs.readFileSync(path.join(ROOT, 'js/campaign-ui.js'), 'utf8');
  ok(/LATER_S = \[/.test(src) && ['Ночная проверка', 'Ветер с перевала', 'Горящий рудник', 'Заводчик', 'Канатка над пропастью', 'Последний перевал'].every(t => src.includes(t)), 'заготовки s4–s9 на карте');
  ok(/lockedFullSubS/.test(src) && STR.ru.lockedFullSubS.includes('скирмиш'), 'текст замка кампании Сизых');
});

runAll();

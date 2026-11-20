/* ПРИИСК · tests/engine.test.mjs — автотесты логики, модуля мыши и правила имён (Node, без зависимостей).
   Запуск: node priisk/tests/engine.test.mjs
   Покрытие: A* (путь, обход стены через проход, без срезания углов, недостижимая цель), рамка выделения (свои/чужие,
   рудовозы, тот же тип), разведение отряда по клеткам и расталкивание, экономика (рудовоз привозит медь на плавильню),
   стройка (сетка, занято, далеко от базы, медь вперёд, отмена), пар (нехватка замедляет), производство юнитов,
   бой и победа (снос конторы), туман (видно/видели), ИИ (за 5 игровых минут ≥3 зданий и первая волна),
   ArcadeMouse — общий _shared/mouse.js (копия, клик, двойной клик, рамка, ПКМ на отпускании, UI-зона, колесо, средняя кнопка, тач: долгий тап, протяжка, два пальца),
   i18n, правило имён (стоп-лист в base64). Браузерная проверка мышью — tests/browser.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, setTimeout, clearTimeout, Date };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/i18n.js', 'js/game.js', 'js/mouse.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const L = sandbox.PRIISK.logic, STR = sandbox.PRIISK.STR, AM = sandbox.ArcadeMouse;

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function run(W, sec, dt = 1 / 30, until) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { L.step(W, dt); if (until && until()) return i * dt; } return -1; }
const open = (w, h) => Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => (i === 0 || j === 0 || i === w - 1 || j === h - 1) ? '#' : '.').join(''));

// ---------- A* ----------
test('A*: находит путь по открытому полю, все точки проходимы, конец — в цели', () => {
  const W = L.worldFromMap(open(20, 12));
  const p = L.findPath(W, 2.5, 2.5, 16.5, 9.5);
  ok(p.length > 0, 'пути нет');
  const end = p[p.length - 1]; eq([Math.floor(end.x), Math.floor(end.y)], [16, 9]);
  p.forEach(q => ok(L.passable(W, Math.floor(q.x), Math.floor(q.y)), 'точка в препятствии ' + JSON.stringify(q)));
});
test('A*: обходит стену через единственный проход и не режет её', () => {
  const rows = [
    '####################',
    '#........#.........#',
    '#........#.........#',
    '#........#.........#',
    '#........#.........#',
    '#........#.........#',
    '#..................#', // проход в строке 6
    '#........#.........#',
    '#........#.........#',
    '####################'];
  const W = L.worldFromMap(rows);
  const p = L.findPath(W, 2.5, 2.5, 17.5, 2.5);
  ok(p.length > 0, 'пути нет');
  const all = [{ x: 2.5, y: 2.5 }, ...p];
  let viaGap = false;
  for (let k = 1; k < all.length; k++) {
    const a = all[k - 1], b = all[k], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 8);
    for (let s = 0; s <= n; s++) { const x = a.x + (b.x - a.x) * s / n, y = a.y + (b.y - a.y) * s / n; ok(L.passable(W, Math.floor(x), Math.floor(y)), 'отрезок пути проходит сквозь стену в ' + x.toFixed(2) + ',' + y.toFixed(2)); if (Math.floor(x) === 9) { eq(Math.floor(y), 6, 'стену пересекли не в проходе'); viaGap = true; } }
  }
  ok(viaGap, 'путь не прошёл через проход');
});
test('A*: не срезает угол между двумя диагональными препятствиями', () => {
  const rows = ['#####', '#.#.#', '##..#', '#...#', '#####'];
  const W = L.worldFromMap(rows);
  const p = L.findPath(W, 1.5, 1.5, 3.5, 1.5);
  // из (1,1) никуда не выйти: справа стена, снизу стена, по диагонали (2,2) — срез угла запрещён
  ok(p.length === 0 || Math.floor(p[p.length - 1].x) === 1, 'прошли через угол: ' + JSON.stringify(p));
});
test('A*: недостижимая цель — идём к ближайшей достижимой точке; цель в скале — к соседней свободной', () => {
  const rows = ['##########', '#...#....#', '#...#....#', '#...#....#', '##########'];
  const W = L.worldFromMap(rows);
  const p = L.findPath(W, 1.5, 2.5, 7.5, 2.5);
  ok(p.length > 0, 'совсем пусто'); ok(Math.floor(p[p.length - 1].x) === 3, 'ближайшая точка у стены, получили ' + JSON.stringify(p[p.length - 1]));
  const q = L.findPath(W, 1.5, 1.5, 4.5, 2.5);
  ok(q.length > 0 && L.passable(W, Math.floor(q[q.length - 1].x), Math.floor(q[q.length - 1].y)));
});
test('A*: на карте плато путь от конторы до конторы есть (5 сидов), быстро', () => {
  for (let s = 1; s <= 5; s++) {
    const W = L.newWorld({ seed: s, ai: false }), a = L.has(W, 0, 'hq'), b = L.has(W, 1, 'hq');
    const t0 = Date.now(), p = L.findPath(W, a.tx + 1.5, a.ty + 3.5, b.tx + 1.5, b.ty + 3.5);
    ok(p.length > 3, 'сид ' + s); const e = p[p.length - 1]; ok(Math.hypot(e.x - (b.tx + 1.5), e.y - (b.ty + 3.5)) < 1.5, 'не дошли, сид ' + s);
    ok(Date.now() - t0 < 200, 'медленно');
  }
});

// ---------- Выделение ----------
test('рамка: выбирает только свои юниты внутри прямоугольника', () => {
  const W = L.worldFromMap(open(30, 20));
  const a = L.addUnit(W, 0, 'rifleman', 5.5, 5.5), b = L.addUnit(W, 0, 'crawler', 8.5, 7.5), c = L.addUnit(W, 0, 'rifleman', 15.5, 5.5);
  const e = L.addUnit(W, 1, 'rifleman', 6.5, 6.5);
  eq(L.boxSelect(W, 0, { x0: 4, y0: 4, x1: 10, y1: 9 }).sort(), [a.id, b.id].sort());
  eq(L.boxSelect(W, 0, { x0: 10, y0: 9, x1: 4, y1: 4 }).sort(), [a.id, b.id].sort(), 'рамка «справа налево»');
  ok(!L.boxSelect(W, 0, { x0: 0, y0: 0, x1: 30, y1: 20 }).includes(e.id), 'чужой в выделении');
  eq(L.boxSelect(W, 0, { x0: 20, y0: 0, x1: 29, y1: 19 }), [], 'пустая рамка');
  eq(L.boxSelect(W, 0, { x0: 0, y0: 0, x1: 30, y1: 20 }).length, 3);
  ok(c.id);
});
test('рамка: рудовозы не попадают, если в рамке есть боевые; только рудовозы — выбираются', () => {
  const W = L.worldFromMap(open(30, 20));
  const h = L.addUnit(W, 0, 'hauler', 5.5, 5.5), r = L.addUnit(W, 0, 'rifleman', 6.5, 5.5);
  eq(L.boxSelect(W, 0, { x0: 4, y0: 4, x1: 8, y1: 8 }), [r.id]);
  eq(L.boxSelect(W, 0, { x0: 4, y0: 4, x1: 6, y1: 6 }), [h.id]);
});
test('двойной клик: все свои того же типа в прямоугольнике экрана; клик — юнит, затем здание', () => {
  const W = L.worldFromMap(open(30, 20));
  const r1 = L.addUnit(W, 0, 'rifleman', 3.5, 3.5), r2 = L.addUnit(W, 0, 'rifleman', 9.5, 9.5); L.addUnit(W, 0, 'rifleman', 25.5, 5.5); L.addUnit(W, 0, 'crawler', 5.5, 5.5);
  eq(L.sameTypeIn(W, 0, 'rifleman', { x0: 0, y0: 0, x1: 20, y1: 20 }).sort(), [r1.id, r2.id].sort());
  const b = L.addBuilding(W, 0, 'boiler', 12, 12);
  eq(L.pickAt(W, 3.6, 3.4).id, r1.id); eq(L.pickAt(W, 13.2, 13.9).id, b.id); eq(L.pickAt(W, 20.5, 2.5), null);
});

// ---------- Движение и расталкивание ----------
test('приказ группе: разные клетки назначения, все доходят, не слипаются', () => {
  const W = L.worldFromMap(open(30, 20));
  const ids = [];
  for (let k = 0; k < 6; k++) ids.push(L.addUnit(W, 0, k % 2 ? 'crawler' : 'rifleman', 3.5 + (k % 3), 3.5 + (k / 3 | 0)).id);
  L.commandMove(W, ids, 22.5, 14.5);
  const goals = ids.map(id => W.byId[id].order.x + ',' + W.byId[id].order.y);
  eq(new Set(goals).size, 6, 'цели совпадают');
  run(W, 20);
  const us = ids.map(id => W.byId[id]);
  us.forEach(u => ok(Math.hypot(u.x - 22.5, u.y - 14.5) < 3.2, 'не дошёл: ' + u.x.toFixed(1) + ',' + u.y.toFixed(1)));
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
    const d = Math.hypot(us[i].x - us[j].x, us[i].y - us[j].y), need = (L.UNITS[us[i].type].r + L.UNITS[us[j].type].r) * 0.7;
    ok(d >= need, 'слиплись ' + i + ',' + j + ' d=' + d.toFixed(2));
  }
});

// ---------- Экономика ----------
function ecoWorld() {
  const rows = open(30, 18).map((r, j) => j >= 3 && j <= 6 ? r.slice(0, 20) + 'oooo' + r.slice(24) : r);
  const W = L.worldFromMap(rows);
  L.addBuilding(W, 0, 'hq', 3, 8); L.addBuilding(W, 0, 'boiler', 7, 8);
  return W;
}
test('экономика: плавильня даёт рудовоз, он копает медь и привозит её — медь на счёте растёт ровно на добытое', () => {
  const W = ecoWorld(), pl = W.players[0]; pl.copper = 0;
  const oreBefore = W.ore.reduce((a, b) => a + b, 0);
  const s = L.addBuilding(W, 0, 'smelter', 4, 12);
  const h = W.units.find(u => u.type === 'hauler' && u.owner === 0); ok(h, 'рудовоза нет'); eq(h.order.t, 'harvest');
  const t = run(W, 90, 1 / 30, () => pl.copper > 0);
  ok(t > 0, 'за 90 с меди не привезли (груз ' + h.carry + ', состояние ' + h.order.s + ')');
  eq(pl.copper, L.UNITS.hauler.cap, 'первая ходка — полный кузов');
  run(W, 60);
  const oreAfter = W.ore.reduce((a, b) => a + b, 0);
  eq(pl.copper + h.carry, oreBefore - oreAfter, 'медь ≠ добыто'); eq(pl.mined, pl.copper);
  ok(pl.copper >= 2 * L.UNITS.hauler.cap, 'за 2.5 мин меньше двух ходок: ' + pl.copper);
  ok(s.id);
});
test('экономика: ПКМ по отвалу — рудовоз едет туда; без плавильни — встаёт с грузом', () => {
  const W = ecoWorld(); L.addBuilding(W, 0, 'smelter', 4, 12);
  const h = W.units.find(u => u.type === 'hauler');
  L.commandSmart(W, 0, [h.id], 23.5, 6.5, null);
  eq(h.order.t, 'harvest'); eq([h.order.px, h.order.py], [23, 6]);
  run(W, 25); ok(h.carry > 0 || W.players[0].mined > 0, 'не копает');
  W.blds.filter(b => b.type === 'smelter').forEach(b => { b.hp = 0; }); run(W, 40);
  ok(['idle'].includes(h.order.t) || h.order.s === 'seek' || h.order.s === 'dig', 'странное состояние ' + JSON.stringify(h.order));
});

// ---------- Стройка, пар, производство ----------
test('стройка: медь списывается вперёд, отмена возвращает; требования зданий', () => {
  const W = L.worldFromMap(open(30, 20)); L.addBuilding(W, 0, 'hq', 3, 3); const pl = W.players[0]; pl.copper = 1000;
  ok(!L.startBuild(W, 0, 'bunk'), 'барак без котельной'); ok(!L.startBuild(W, 0, 'works'), 'мастерская без плавильни');
  ok(L.startBuild(W, 0, 'boiler')); eq(pl.copper, 700); ok(!L.startBuild(W, 0, 'boiler'), 'вторая стройка одновременно');
  ok(L.cancelBuild(W, 0)); eq(pl.copper, 1000); eq(pl.build, null);
  pl.copper = 100; ok(!L.startBuild(W, 0, 'boiler'), 'без меди');
});
test('стройка по сетке: нельзя на занятое, на скалу, на медь, на юнитов и далеко от базы', () => {
  const rows = open(40, 24); rows[10] = rows[10].slice(0, 12) + '#' + rows[10].slice(13); rows[4] = rows[4].slice(0, 12) + 'o' + rows[4].slice(13);
  const W = L.worldFromMap(rows); L.addBuilding(W, 0, 'hq', 3, 3);
  ok(L.canPlace(W, 0, 'boiler', 7, 3), 'рядом с конторой — можно');
  ok(!L.canPlace(W, 0, 'boiler', 4, 4), 'на контору'); ok(!L.canPlace(W, 0, 'boiler', 30, 15), 'далеко от базы');
  ok(!L.canPlace(W, 0, 'boiler', 11, 9), 'на скалу'); ok(!L.canPlace(W, 0, 'boiler', 12, 3), 'на медь');
  ok(!L.canPlace(W, 1, 'boiler', 7, 3), 'у чужой базы'); ok(!L.canPlace(W, 0, 'boiler', 0, 3), 'за краем');
  L.addUnit(W, 0, 'rifleman', 8, 4); ok(!L.canPlace(W, 0, 'boiler', 7, 3), 'на юнита');
  const pl = W.players[0]; pl.copper = 500; L.startBuild(W, 0, 'boiler'); eq(L.placeBuild(W, 0, 7, 7), null, 'не готово');
  run(W, 11); ok(pl.build.ready, 'не достроилось за 11 с');
  ok(!L.placeBuild(W, 0, 30, 15)); const b = L.placeBuild(W, 0, 7, 7); ok(b && b.type === 'boiler'); eq(pl.build, null);
  eq(W.occ[7 * W.w + 7], b.id); ok(!L.passable(W, 8, 8), 'здание проходимо');
});
test('пар: при нехватке стройка медленнее (×0.4), котельная возвращает скорость', () => {
  const W = L.worldFromMap(open(40, 24)); L.addBuilding(W, 0, 'hq', 3, 3); L.addBuilding(W, 0, 'boiler', 7, 3);
  L.addBuilding(W, 0, 'smelter', 3, 8); L.addBuilding(W, 0, 'bunk', 10, 3); // 30 пара, 15 расход
  const pl = W.players[0]; pl.copper = 5000; eq(L.powerFactor(W, 0), 1);
  L.addBuilding(W, 0, 'works', 7, 8); L.addBuilding(W, 0, 'works', 12, 8); // +30 расход → 45 > 30
  ok(pl.pUse > pl.pOut); eq(L.powerFactor(W, 0), 0.4);
  L.startBuild(W, 0, 'boiler'); run(W, 5); const slow = pl.build.p;
  L.cancelBuild(W, 0); L.addBuilding(W, 0, 'boiler', 16, 3); eq(L.powerFactor(W, 0), 1);
  L.startBuild(W, 0, 'boiler'); run(W, 5); const fast = pl.build.p;
  ok(Math.abs(slow / fast - 0.4) < 0.02, 'отношение ' + (slow / fast).toFixed(3));
});
test('производство: стрелок из барака выходит у здания и идёт на точку сбора; отмена очереди возвращает медь', () => {
  const W = L.worldFromMap(open(40, 24)); L.addBuilding(W, 0, 'hq', 3, 3); L.addBuilding(W, 0, 'boiler', 7, 3); const bk = L.addBuilding(W, 0, 'bunk', 10, 3);
  bk.rally = { x: 20.5, y: 12.5 };
  const pl = W.players[0]; pl.copper = 300;
  ok(!L.queueUnit(W, 0, 'crawler'), 'самоход без мастерской');
  ok(L.queueUnit(W, 0, 'rifleman')); ok(L.queueUnit(W, 0, 'rifleman')); eq(pl.copper, 100);
  ok(L.dequeueUnit(W, 0, 'rifleman')); eq(pl.copper, 200); eq(pl.inf.length, 1);
  const n0 = W.units.length; run(W, 5.5); eq(W.units.length, n0 + 1, 'не вышел');
  const u = W.units[W.units.length - 1]; eq(u.type, 'rifleman'); ok(Math.abs(u.y - (bk.ty + bk.h + 0.5)) < 1.5, 'вышел не у барака');
  run(W, 12); ok(Math.hypot(u.x - 20.5, u.y - 12.5) < 2, 'не дошёл до точки сбора');
});

// ---------- Бой, победа, туман ----------
test('бой: самоход по приказу уничтожает чужого стрелка; стрелок сам отвечает на угрозу рядом', () => {
  const W = L.worldFromMap(open(30, 20));
  const c = L.addUnit(W, 0, 'crawler', 4.5, 4.5), e = L.addUnit(W, 1, 'rifleman', 14.5, 10.5);
  L.commandAttack(W, [c.id], e.id); run(W, 30, 1 / 30, () => !W.byId[e.id]);
  ok(!W.byId[e.id], 'цель жива: ' + e.hp); eq(W.players[0].kills, 1); ok(W.players[0].score > 0);
  const r = L.addUnit(W, 1, 'rifleman', c.x + 3, c.y); run(W, 2);
  eq(r.order.t, 'attack', 'стоящий стрелок не открыл огонь по соседу'); eq(r.order.target, c.id);
});
test('победа: снос чужой конторы — winner 0; своей — winner 1', () => {
  const W = L.worldFromMap(open(40, 24)); L.addBuilding(W, 0, 'hq', 3, 3); const hq1 = L.addBuilding(W, 1, 'hq', 30, 15);
  const ids = [L.addUnit(W, 0, 'ironwagon', 26.5, 12.5).id, L.addUnit(W, 0, 'crawler', 27.5, 12.5).id];
  L.commandAttack(W, ids, hq1.id); run(W, 120, 1 / 30, () => W.winner >= 0);
  eq(W.winner, 0); ok(!L.has(W, 1, 'hq')); ok(W.players[0].score >= 1000, 'без бонуса за победу');
  const W2 = L.worldFromMap(open(40, 24)); const h0 = L.addBuilding(W2, 0, 'hq', 3, 3); L.addBuilding(W2, 1, 'hq', 30, 15); h0.hp = 0; L.step(W2, 0.05); eq(W2.winner, 1);
});
test('туман: вокруг своих видно, ушли — «видели», чужие юниты в тумане не видны', () => {
  const W = L.worldFromMap(open(40, 24)); const u = L.addUnit(W, 0, 'rifleman', 5.5, 5.5), e = L.addUnit(W, 1, 'rifleman', 30.5, 15.5);
  L.updateVis(W); eq(W.vis[5 * W.w + 5], 2); eq(W.vis[15 * W.w + 30], 0); ok(!L.visibleTo0(W, e));
  u.x = 25.5; u.y = 15.5; L.updateVis(W); eq(W.vis[5 * W.w + 5], 1, 'было видно — стало «видели»'); ok(L.visibleTo0(W, e), 'враг рядом — виден');
});

// ---------- ИИ ----------
test('ИИ: за 5 игровых минут строит хотя бы 3 здания, добывает медь и выставляет армию (3 сида)', () => {
  for (const seed of [1, 2, 3]) {
    const W = L.newWorld({ seed });
    run(W, 300, 1 / 20);
    const blds = W.blds.filter(b => b.owner === 1 && b.type !== 'hq');
    ok(blds.length >= 3, 'сид ' + seed + ': зданий ' + blds.length);
    ok(blds.some(b => b.type === 'smelter') && W.players[1].mined > 0, 'сид ' + seed + ': не добывает');
    ok(W.units.filter(u => u.owner === 1 && u.type !== 'hauler').length + W.players[1].lost >= 6, 'сид ' + seed + ': мало армии');
  }
});
test('ИИ: присылает волну атаки к конторе игрока (до 7-й минуты)', () => {
  const W = L.newWorld({ seed: 4 }); const hq = L.has(W, 0, 'hq');
  let near = false; run(W, 420, 1 / 20, () => { near = W.units.some(u => u.owner === 1 && Math.hypot(u.x - hq.tx, u.y - hq.ty) < 10); return near; });
  ok(W.ai.waves >= 1, 'волн нет'); ok(near, 'волна не дошла до базы игрока');
});
test('партия «ИИ против ИИ» заканчивается победой одной из сторон за 25 минут (игра не зависает в ничьей)', () => {
  const W = L.newWorld({ seed: 7 }); const A0 = L.newAI(W, 0);
  for (let i = 0; i < 25 * 60 * 20 && W.winner < 0; i++) { L.aiStep(W, 1 / 20, A0); L.step(W, 1 / 20); }
  ok(W.winner >= 0, 'за 25 минут нет победителя; зданий ' + W.blds.length + ', юнитов ' + W.units.length);
  console.log('     победитель ' + W.winner + ' на ' + Math.round(W.time / 60) + '-й минуте');
});

// ---------- ArcadeMouse (общий модуль _shared/mouse.js; полное покрытие — _shared/tests/mouse.test.mjs) ----------
// Модуль слушает pointermove/up на window — в песочнице window = sandbox, даём ему шину событий.
const winLs = {};
sandbox.addEventListener = (t, f) => { (winLs[t] = winLs[t] || []).push(f); };
sandbox.removeEventListener = (t, f) => { winLs[t] = (winLs[t] || []).filter(x => x !== f); };
function fakeCanvas() {
  const ls = {};
  return { width: 960, height: 540, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }),
    addEventListener: (t, f) => { (ls[t] = ls[t] || []).push(f); }, removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
    fire(t, e) { e = Object.assign({ pointerId: 1, pointerType: 'mouse', button: 0, preventDefault() {}, type: t }, e); (ls[t] || []).concat(winLs[t] || []).forEach(f => f(e)); } };
}
function mouseLog(extra = {}) {
  for (const k in winLs) winLs[k] = [];
  const log = []; const cv = fakeCanvas();
  const m = AM.attach(cv, Object.assign({ W: 960, H: 540, onClick: (p, i) => log.push(['click', p.x, p.y, i.double, i.shift]),
    onBoxEnd: (b, i) => { const r = AM.normBox(b); log.push(['box', r.x0, r.y0, r.x1, r.y1, i.shift]); },
    onRight: (p, i) => log.push(['cmd', p.x, p.y, !!i.touch]), onPan: (dx, dy) => log.push(['pan', dx, dy]), onWheel: (dx, dy) => log.push(['wheel', dx, dy]) }, extra));
  return { log, cv, m };
}
test('ArcadeMouse: js/mouse.js — копия _shared/mouse.js (метка источника для build.sh)', () => {
  const src = fs.readFileSync(path.join(ROOT, '../_shared/mouse.js'), 'utf8');
  ok(src.includes('Источник — _shared/mouse.js'), 'нет метки');
  eq(fs.readFileSync(path.join(ROOT, 'js/mouse.js'), 'utf8') === src, true, 'js/mouse.js рассинхронизирован (bash build.sh)');
});
test('ArcadeMouse: клик, двойной клик, рамка (с Shift), ПКМ (на отпускании) — в координатах canvas', () => {
  const { log, cv } = mouseLog();
  cv.fire('pointerdown', { clientX: 50, clientY: 40 }); cv.fire('pointerup', { clientX: 50, clientY: 40 });
  cv.fire('pointerdown', { clientX: 51, clientY: 40 }); cv.fire('pointerup', { clientX: 51, clientY: 40 });
  eq(log[0], ['click', 100, 80, false, false]); eq(log[1], ['click', 102, 80, true, false]);
  cv.fire('pointerdown', { clientX: 200, clientY: 150, shiftKey: true }); cv.fire('pointermove', { clientX: 120, clientY: 100, shiftKey: true }); cv.fire('pointerup', { clientX: 120, clientY: 100, shiftKey: true });
  eq(log[2], ['box', 240, 200, 400, 300, true]);
  cv.fire('pointerdown', { clientX: 10, clientY: 20, button: 2 }); eq(log.length, 3, 'ПКМ сработал на нажатии');
  cv.fire('pointerup', { clientX: 10, clientY: 20, button: 2 }); eq(log[3], ['cmd', 20, 40, false]);
});
test('ArcadeMouse: UI-зона (панель/мини-карта/кнопки групп) — без рамки; средняя кнопка и колесо; край экрана', () => {
  const ui = []; const { log, cv, m } = mouseLog({ hitUI: p => p.y > 400, onUi: (ph, p, i) => ui.push([ph, p.y, i.btn, !!(i.mods && i.mods.ctrl)]) });
  cv.fire('pointerdown', { clientX: 100, clientY: 220, ctrlKey: true }); cv.fire('pointermove', { clientX: 140, clientY: 230 }); cv.fire('pointerup', { clientX: 140, clientY: 230 });
  eq(log.length, 0, 'жест в UI-зоне дал рамку/клик'); eq(ui.map(u => u[0]), ['down', 'move', 'up']); eq(ui[0], ['down', 440, 0, true]);
  cv.fire('pointerdown', { clientX: 100, clientY: 100, button: 1 }); cv.fire('pointermove', { clientX: 90, clientY: 105 }); cv.fire('pointerup', { clientX: 90, clientY: 105, button: 1 });
  eq(log[0], ['pan', -20, 10], 'сдвиг указателя (камера: cam -= d)');
  cv.fire('wheel', { deltaX: 0, deltaY: 120, deltaMode: 0 }); eq(log[1], ['wheel', 0, 120]);
  cv.fire('wheel', { deltaX: 0, deltaY: 50, deltaMode: 0, shiftKey: true }); eq(log[2], ['wheel', 50, 0]);
  cv.fire('pointermove', { clientX: 2, clientY: 135 }); eq(m.edge(14), { x: -1, y: 0 });
  cv.fire('pointermove', { clientX: 479, clientY: 269 }); eq(m.edge(14), { x: 1, y: 1 });
  cv.fire('pointerleave', {}); eq(m.edge(14), { x: 0, y: 0 });
});
test('ArcadeMouse: тач — тап = выбор, протяжка = рамка, долгий тап = приказ, два пальца = камера', async () => {
  const { log, cv } = mouseLog({ longPress: 60 });
  const T = (t, id, x, y) => cv.fire(t, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y });
  T('pointerdown', 5, 50, 50); T('pointerup', 5, 50, 50); eq(log.pop(), ['click', 100, 100, false, false]);
  T('pointerdown', 5, 50, 50); T('pointermove', 5, 90, 80); T('pointerup', 5, 90, 80); eq(log.pop(), ['box', 100, 100, 180, 160, false]);
  T('pointerdown', 5, 60, 60); await new Promise(r => setTimeout(r, 100)); T('pointerup', 5, 60, 60);
  eq(log.pop(), ['cmd', 120, 120, true]); eq(log.length, 0, 'после долгого тапа лишний клик');
  T('pointerdown', 6, 100, 100); T('pointerdown', 7, 200, 100); T('pointermove', 6, 90, 100); T('pointermove', 7, 190, 100); T('pointerup', 6, 90, 100); T('pointerup', 7, 190, 100);
  ok(log.length >= 1 && log.every(e => e[0] === 'pan'), 'двумя пальцами не камера: ' + JSON.stringify(log));
  eq(log.reduce((s, e) => s + e[1], 0), -20, 'сдвиг указателя');
});
test('ArcadeMouse: enabled()=false — события игнорируются', () => {
  let on = false; const { log, cv } = mouseLog({ enabled: () => on });
  cv.fire('pointerdown', { clientX: 5, clientY: 5 }); cv.fire('pointerup', { clientX: 5, clientY: 5 }); eq(log.length, 0);
  on = true; cv.fire('pointerdown', { clientX: 5, clientY: 5 }); cv.fire('pointerup', { clientX: 5, clientY: 5 }); eq(log.length, 1);
});

// ---------- i18n, страница ----------
test('i18n: у RU и EN одинаковые ключи, имена юнитов и зданий есть', () => {
  eq(Object.keys(STR.ru).sort(), Object.keys(STR.en).sort());
  [...L.BUILD_LIST, ...L.UNIT_LIST, 'hq'].forEach(k => ok(STR.ru[k] && STR.en[k], k));
});
test('страница: ссылка «← Каталог», фавикон студии, engine.js — копия _shared, скрипты на месте', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/class="back"[^>]*data-catalog-back="1"[^>]*data-en="← Catalog"/.test(html), 'нет ссылки «← Каталог»');
  ok(/class="back" id="backLink" href="\.\.\/"/.test(html), "«← Каталог» должен вести на ../");
  ok(/<link rel="icon" type="image\/svg\+xml"/.test(html), 'нет фавикона');
  [...html.matchAll(/<script src="\.\/([^"]+)"/g)].forEach(m => ok(fs.existsSync(path.join(ROOT, m[1])), 'нет ' + m[1]));
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '../_shared/engine.js'), 'utf8'), 'engine.js рассинхронизирован');
});

// ---------- Правило имён ----------
test('правило имён: нет чужих игр, студий, фракций и юнитов известных стратегий (стоп-лист в base64)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория: общий список аркады + стратегии реального времени
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGNhbm5vbiA/Zm9kZGVyfHNlbnNpYmxlID9zb2Z0fNC6W9GN0LBd0L3QvT/QvtC9ID/RhNC+0LTQtD/QtdGAfNGE0L7QtNC0P9C10YB80YHQtdC90YHQuNCx0Lt8XGJqb29sc1xifNC00LbRg9C70YF80L/Rg9GI0LXRh9C9W9CwLdGP0ZFdKiA/0LzRj9GBfGNvbW1hbmQgPygmfGFuZHxuKSA/Y29ucXVlcnxcYmMgPyYgP2NcYnzQutC+0LzQsNC90LTRg9C5ID/QuCA/0LfQsNCy0L58dGliZXJpfNGC0LjQsdC10YDQuHxyZWQgP2FsZXJ0fNC60YDQsNGB0L1b0LAt0Y/RkV0qID/RgtGA0LXQstC+0LN8d2VzdHdvb2R80LLQtdGB0YLQstGD0LR8ZHVuZSA/KDJ8aWkpXGJ8aGFya29ubmVufNGF0LDRgNC60L7QvdC90LXQvXxhdHJlaWRlc3zQsNGC0YDQtdC50LTQtdGBfFxib3Jkb3NcYnzQvtGA0LTQvtGBfHdhcmNyYWZ0fNCy0LDRgNC60YDQsNGE0YJ8c3RhcmNyYWZ0fNGB0YLQsNGA0LrRgNCw0YTRgnxibGl6emFyZHzQsdC70LjQt9C30LDRgNC0fHRvdGFsID9hbm5paGlsYXRpb258YWdlID9vZiA/ZW1waXJlc3xcYmtrbmRcYnx3YXJ6b25lID8yMTAwfGVhcnRoID8yMTUwfFxiZ2RpXGJ8YnJvdGhlcmhvb2QgP29mID9ub2R8XGJub2RcYnxraXJvdnzQutC40YDQvtCyfHRlc2xhfNGC0LXRgdC70LB8XGJ5dXJpXGJ80Y7RgNC4KD8hW9CwLdGP0ZFdKXxjaHJvbm8gP3NwaGVyZXzRhdGA0L7QvdC+0YHRhNC10YB8Y29uc3RydWN0aW9uID95YXJkfHdhciA/ZmFjdG9yeXxcYm1jdlxifG1lbGFuZ2V80LzQtdC70LDQvdC2fGFycmFraXN80LDRgNGA0LDQutC40YF8ZWxlY3Ryb25pYyA/YXJ0c3xzdXByZW1lID9jb21tYW5kZXJ8Y29tcGFueSA/b2YgP2hlcm9lc3xzb3ZpZXR80YHQvtCy0LXRgtGB0Lp8XGJ1c3NyXGJ80YHRgdGB0YA=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 8, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['Q29tbWFuZCAmIENvbnF1ZXI=', 'UmVkIEFsZXJ0', 'V2VzdHdvb2Q=', 'U3RhckNyYWZ0', '0KLQuNCx0LXRgNC40Lk=', '0KXQsNGA0LrQvtC90L3QtdC9', 'T3Jkb3M=']
    .forEach(b => ok(BAD.test(u(b)), 'стоп-лист не ловит ' + b));
  ['ПРИИСК', 'Гефест', 'Контора', 'Котельная', 'Плавильня', 'Мастерская', 'Барак', 'Стрелок', 'Самоход', 'Броневоз', 'Рудовоз', 'артель', 'Lodge', 'Steamworks', 'Crawler', 'Ironwagon', 'Ore Hauler', 'Smelter', 'Boiler House', 'Bunkhouse', 'CONTRACT.md']
    .forEach(s => ok(!BAD.test(s), 'ложное срабатывание: ' + s));
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

/* ЛЕНТОВОД · tests/engine.test.mjs — автотесты логики, ввода, текстов, музыки и правила имён (Node, без зависимостей).
   Запуск: node _proto/fabrika/tests/engine.test.mjs
   Покрытие: лента переносит предметы и не теряет их (цепочка и замкнутая петля), поворот ленты, развилка (поровну на 3 выхода),
   сортировщик (фильтр вперёд, остальное вбок), мост через ленту, рецепты (плавильня, стекольня, шестерённая, сборочный цех),
   турель стреляет только при подаче слитков, волна по таймеру и путь Ржави до Мастерской по A* (обход скал, прогрызание частокола),
   армия: «вперёд» сносит курган (победа), падение Мастерской (поражение), правила стройки и снос с возвратом,
   линия протяжки, карта по умолчанию (проходимость) и демо-мастерская, производительность (500 предметов + 40 буров),
   FabPointer на фейковом canvas, тексты RU/EN, музыка (секвенсор движка), правило имён (стоп-лист в base64).
   Браузерная проверка мышью и тачем — tests/browser.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, Object, Array, JSON };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/i18n.js', 'js/sim.js', 'js/pointer.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const S = sandbox.LENTOVOD.sim, STR = sandbox.LENTOVOD.STR, FP = sandbox.FabPointer;

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
const F = { free: true };
function world(w, h, o) { return S.newWorld(Object.assign({ empty: true, w, h, ingot: 999, waves: false }, o || {})); }
function run(W, sec, until) { const n = Math.round(sec / S.TICK); for (let i = 0; i < n; i++) { S.step(W); if (until && until()) return i * S.TICK; } return -1; }
function ore(W, x, y, t) { W.ore[y * W.w + x] = t; }
function line(W, x0, y0, x1, y1, type = 'belt') { return S.placeLine(W, type, S.lineCells(x0, y0, x1, y1), F); }
function items(W, x, y) { const b = S.bAt(W, x, y); return b && b.items ? b.items.map(i => i.t) : []; }
function beltItems(W, cells) { return cells.reduce((a, [x, y]) => a.concat(items(W, x, y)), []); }
function count(W) { return S.itemsInTransit(W); }

// ---------- ленты ----------
test('лента: бур → 19 клеток → Мастерская; ни один предмет не теряется (добыто = на складе + в пути)', () => {
  const W = world(30, 8); ore(W, 1, 3, 1);
  S.place(W, 'drill', 1, 3, 0, F); line(W, 2, 3, 20, 3); S.placeFixed(W, 'hall', 21, 2);
  run(W, 40);
  ok(W.stock.cu >= 15, 'доехало ' + W.stock.cu);
  eq(W.made.cu, W.stock.cu + count(W), 'баланс');
  // предметы держат зазор и не обгоняют
  W.blds.filter(b => b.type === 'belt').forEach(b => { for (let i = 1; i < b.items.length; i++) ok(b.items[i - 1].p - b.items[i].p >= S.BELT_SP - 1e-9, 'зазор'); ok(b.items.length <= S.BELT_CAP); });
});
test('лента: замкнутая петля — 120 предметов ездят по кругу 60 с, число не меняется, предметы двигаются', () => {
  const W = world(30, 12);
  line(W, 2, 2, 26, 2); line(W, 27, 2, 27, 8); line(W, 27, 9, 3, 9); line(W, 2, 9, 2, 3);
  const belts = W.blds.filter(b => b.type === 'belt'); ok(belts.length === 64, 'лент ' + belts.length);
  ok(S.bAt(W, 26, 2).dir === 0 && S.bAt(W, 27, 2).dir === 1 && S.bAt(W, 27, 9).dir === 2 && S.bAt(W, 2, 9).dir === 3, 'направления петли');
  let n = 0; belts.forEach((b, i) => { if (n < 120) { b.items.push({ t: i % 2 ? 'cu' : 'coal', p: 0.5, m: -1 }); n++; if (n < 120) { b.items.push({ t: 'sand', p: 0, m: -1 }); n++; } } });
  const kinds = () => { const m = {}; belts.forEach(b => b.items.forEach(it => { m[it.t] = (m[it.t] || 0) + 1; })); return Object.keys(m).sort().map(k => k + m[k]).join(','); };
  const snap = () => belts.map(b => b.items.map(i => i.t).join('+'));
  const k0 = kinds(), a = snap(); run(W, 60);
  eq(count(W), 120, 'количество'); eq(kinds(), k0, 'состав по видам');
  ok(snap().filter((s, i) => s !== a[i]).length > 20, 'предметы стоят');
});
test('лента: поворот — линия «Г» доставляет за угол, вход сбоку принимается, со своего выхода — нет', () => {
  const W = world(14, 10); ore(W, 1, 1, 2);
  S.place(W, 'drill', 1, 1, 0, F); S.placeLine(W, 'belt', S.lineCells(2, 1, 7, 5), F); S.placeFixed(W, 'hall', 6, 6);
  ok(S.bAt(W, 7, 1).dir === 1 && S.bAt(W, 6, 1).dir === 0, 'угол смотрит вниз');
  run(W, 20); ok(W.stock.coal >= 5, 'за угол доехало ' + W.stock.coal);
  const W2 = world(8, 4); S.place(W2, 'belt', 3, 1, 0, F);
  ok(S.accept(W2, S.bAt(W2, 3, 1), 'cu', 3, 0), 'вход сбоку'); ok(!S.accept(W2, S.bAt(W2, 3, 1), 'cu', 4, 1), 'вход с выхода');
});

// ---------- развилка, сортировщик, мост ----------
test('развилка: вход сзади, предметы по очереди вперёд/влево/вправо (поровну ±2)', () => {
  const W = world(14, 12); ore(W, 0, 5, 1);
  S.place(W, 'drill', 0, 5, 0, F); line(W, 1, 5, 4, 5); S.place(W, 'splitter', 5, 5, 0, F);
  line(W, 6, 5, 10, 5); line(W, 5, 4, 5, 0); line(W, 5, 6, 5, 10);
  run(W, 36);
  const fr = beltItems(W, [[6, 5], [7, 5], [8, 5], [9, 5], [10, 5]]).length, le = beltItems(W, [[5, 4], [5, 3], [5, 2], [5, 1], [5, 0]]).length, ri = beltItems(W, [[5, 6], [5, 7], [5, 8], [5, 9], [5, 10]]).length;
  ok(fr >= 7 && le >= 7 && ri >= 7, `вперёд ${fr}, влево ${le}, вправо ${ri}`);
  ok(Math.max(fr, le, ri) - Math.min(fr, le, ri) <= 2, `неровно ${fr}/${le}/${ri}`);
  eq(W.made.cu, count(W), 'баланс');
  ok(!S.accept(W, S.bAt(W, 5, 5), 'cu', 5, 4), 'сбоку развилка не берёт');
});
test('сортировщик: фильтр «медь» — медь только вперёд, уголь только вбок', () => {
  const W = world(14, 12); ore(W, 0, 5, 1); ore(W, 2, 4, 2);
  S.place(W, 'drill', 0, 5, 0, F); S.place(W, 'drill', 2, 4, 1, F); line(W, 1, 5, 4, 5);
  const so = S.place(W, 'sorter', 5, 5, 0, F); so.filter = 'cu';
  line(W, 6, 5, 10, 5); line(W, 5, 4, 5, 0); line(W, 5, 6, 5, 10);
  run(W, 25);
  const fr = beltItems(W, [[6, 5], [7, 5], [8, 5], [9, 5], [10, 5]]), side = beltItems(W, [[5, 4], [5, 3], [5, 2], [5, 1], [5, 0], [5, 6], [5, 7], [5, 8], [5, 9], [5, 10]]);
  ok(fr.length >= 5 && fr.every(t => t === 'cu'), 'вперёд: ' + fr.join(','));
  ok(side.length >= 5 && side.every(t => t === 'coal'), 'вбок: ' + side.join(','));
});
test('мост: пара мостов перекидывает медь через поперечную ленту с углём, потоки не смешиваются', () => {
  const W = world(12, 9); ore(W, 0, 3, 1); ore(W, 3, 0, 2);
  S.place(W, 'drill', 0, 3, 0, F); S.place(W, 'belt', 1, 3, 0, F);
  const a = S.place(W, 'bridge', 2, 3, 0, F), b = S.place(W, 'bridge', 5, 3, 0, F); line(W, 6, 3, 10, 3);
  S.place(W, 'drill', 3, 0, 1, F); line(W, 3, 1, 3, 8);
  ok(S.partner(W, a) === b && !S.partner(W, b), 'пара');
  run(W, 20);
  const after = beltItems(W, [[6, 3], [7, 3], [8, 3], [9, 3], [10, 3]]), cross = beltItems(W, [1, 2, 3, 4, 5, 6, 7, 8].map(y => [3, y]));
  ok(after.length >= 5 && after.every(t => t === 'cu'), 'за мостом: ' + after.join(','));
  ok(cross.length >= 5 && cross.every(t => t === 'coal'), 'поперёк: ' + cross.join(','));
  eq(W.made.cu + W.made.coal, count(W), 'баланс');
  // без пары мост не принимает
  S.remove(W, 5, 3); ok(!S.partner(W, a) && !S.accept(W, a, 'cu', 1, 3), 'одиночный мост');
});

// ---------- станки ----------
test('рецепт: плавильня — только медь не плавится; медь + уголь → слиток, выход на ленту наружу', () => {
  const W = world(12, 8); const sm = S.place(W, 'smelter', 3, 2, 0, F); S.place(W, 'belt', 5, 2, 0, F); S.place(W, 'belt', 2, 2, 0, F);
  ok(S.accept(W, sm, 'cu', 2, 2) && S.accept(W, sm, 'cu', 2, 2), 'медь принята'); ok(!S.accept(W, sm, 'sand', 2, 2), 'песок не нужен');
  run(W, 5); eq(W.made.ingot, 0, 'без угля');
  S.accept(W, sm, 'coal', 2, 2); run(W, 2.2);
  eq(W.made.ingot, 1, 'слиток'); eq(sm.inb.cu, 1); eq(sm.inb.coal, 0);
  run(W, 0.5); eq(items(W, 5, 2), ['ingot'], 'на выходной ленте'); eq(items(W, 2, 2), [], 'входная лента (смотрит в станок) не получает');
});
test('рецепты: стекольня (2 песка + уголь), шестерённая (2 слитка), сборочный цех собирает клёпаного', () => {
  const W = world(16, 10); W.rally = { x: 2.5, y: 8.5 };
  const gw = S.place(W, 'glassworks', 1, 1, 0, F), gm = S.place(W, 'gearmill', 5, 1, 0, F), as = S.place(W, 'assembly', 10, 1, 0, F);
  S.accept(W, gw, 'sand', 0, 1); S.accept(W, gw, 'coal', 0, 1); run(W, 3); eq(W.made.glass, 0, 'один песок');
  S.accept(W, gw, 'sand', 0, 1); run(W, 2.7); eq(W.made.glass, 1, 'стекло');
  S.accept(W, gm, 'ingot', 4, 1); S.accept(W, gm, 'ingot', 4, 1); run(W, 2.2); eq(W.made.gear, 1, 'шестерня');
  ['ingot', 'ingot', 'ingot', 'gear', 'gear', 'glass'].forEach(t => ok(S.accept(W, as, t, 9, 1), t));
  run(W, 6.3); eq(W.units.length, 1, 'клёпаный'); eq(W.made.mech, 1);
  run(W, 12); const u = W.units[0]; ok(Math.hypot(u.x - 2.5, u.y - 8.5) < 1.2, 'дошёл до точки сбора: ' + JSON.stringify(u).slice(0, 300));
});

// ---------- оборона ----------
test('турель: без слитков молчит; лента подаёт слитки → стреляет и сбивает; уголь как боеприпас не берёт', () => {
  const W = world(14, 9);
  const tu = S.place(W, 'turret', 5, 4, 0, F); line(W, 1, 4, 4, 4);
  W.enemies.push({ kind: 'crawler', x: 9.5, y: 4.5, hp: 40, maxhp: 40, cd: 0, path: null, pi: 0, pv: -1 });
  run(W, 4); eq(W.enemies[0].hp, 40, 'выстрелил без боеприпаса'); eq(tu.shots, 0);
  S.bAt(W, 1, 4).items.push({ t: 'coal', p: 0, m: -1 }); run(W, 3);
  eq(items(W, 4, 4), ['coal'], 'уголь застрял перед турелью'); eq(W.enemies[0].hp, 40);
  S.bAt(W, 4, 4).items.length = 0; S.bAt(W, 1, 4).items.push({ t: 'ingot', p: 0.5, m: -1 }, { t: 'ingot', p: 0, m: -1 });
  run(W, 5);
  ok(W.enemies.length === 0 && W.kills === 1, 'не сбил: ' + JSON.stringify(W.enemies.map(e => e.hp)));
  eq(tu.shots, 2 * S.BLD.turret.shotsPer - 4, 'слиток = ' + S.BLD.turret.shotsPer + ' выстрела, на ржавника ушло 4');
});
test('волна: по таймеру выходит из кургана и по A* через проход в скалах доходит до Мастерской', () => {
  const W = world(32, 14, { waves: true, firstWave: 3 });
  for (let y = 0; y < 14; y++) if (y !== 11) W.t[y * W.w + 15] = S.ROCK;
  S.placeFixed(W, 'hall', 2, 5); S.placeFixed(W, 'mound', 27, 5);
  run(W, 3.2); eq(W.wave, 1, 'волна не вышла');
  ok(W.spawnQ.length + W.enemies.length === S.waveSize(1).crawler + S.waveSize(1).brute, 'размер волны');
  run(W, 3); const e = W.enemies[0]; ok(e && e.path && e.path.length > 10, 'нет пути');
  ok(e.path.some(c => c.x === 15 && c.y === 11), 'путь не через проход');
  e.path.forEach(c => ok(S.cellCost(W, c.x, c.y, 'foe') > 0, 'путь через скалу'));
  const hp0 = W.hall.hp; const t = run(W, 60, () => W.hall.hp < hp0);
  ok(t >= 0, 'Ржавь не дошла до Мастерской');
});
test('A*: обход скалы, недостижимая цель → null, Ржавь прогрызает частокол вокруг Мастерской', () => {
  const W = world(20, 9); for (let y = 0; y < 8; y++) W.t[y * W.w + 10] = S.ROCK;
  const p = S.findPath(W, 2, 2, { x: 17, y: 2, w: 1, h: 1 }, 'foe'); ok(p && p.some(c => c.y === 8), 'обход снизу');
  W.t[8 * W.w + 10] = S.ROCK; eq(S.findPath(W, 2, 2, { x: 17, y: 2, w: 1, h: 1 }, 'foe'), null, 'стена сплошная');
  const W2 = world(24, 12); const hall = S.placeFixed(W2, 'hall', 3, 4);
  for (let x = 2; x <= 6; x++) { S.place(W2, 'wall', x, 3, 0, F); S.place(W2, 'wall', x, 7, 0, F); }
  for (let y = 4; y <= 6; y++) { S.place(W2, 'wall', 2, y, 0, F); S.place(W2, 'wall', 6, y, 0, F); }
  const walls = W2.blds.filter(b => b.type === 'wall').length; eq(walls, 16);
  W2.enemies.push({ kind: 'brute', x: 18.5, y: 5.5, hp: 999, maxhp: 999, cd: 0, path: null, pi: 0, pv: -1 });
  const t = run(W2, 90, () => hall.hp < hall.maxhp);
  ok(t >= 0, 'не прогрыз'); ok(W2.blds.filter(b => b.type === 'wall').length < walls, 'частокол цел');
});

// ---------- армия, победа/поражение ----------
test('армия: «вперёд» — 10 клёпаных идут по A* к кургану и сносят его → победа', () => {
  const W = world(40, 14); S.placeFixed(W, 'hall', 2, 5); const m = S.placeFixed(W, 'mound', 34, 5); m.hp = 900;
  for (let i = 0; i < 10; i++) W.units.push({ x: 8.5 + (i % 3), y: 5.5 + Math.floor(i / 3), hp: 120, maxhp: 120, cd: 0, mode: 'rally', path: null, pi: 0, pv: -1, gk: '' });
  W.rally = { x: 8.5, y: 6.5 };
  eq(S.orderAttack(W), 10);
  const t = run(W, 120, () => W.winner >= 0);
  ok(t >= 0 && W.winner === 0, 'победы нет, курган ' + (W.mound && W.mound.hp)); ok(W.score >= 1000, 'очки за победу');
});
test('поражение: Ржавь ломает Мастерскую → winner = 1, шаги дальше не идут', () => {
  const W = world(16, 8); const h = S.placeFixed(W, 'hall', 2, 2); h.hp = 20;
  W.enemies.push({ kind: 'crawler', x: 6.5, y: 3.5, hp: 40, maxhp: 40, cd: 0, path: null, pi: 0, pv: -1 });
  run(W, 10); eq(W.winner, 1); ok(!W.hall); const tk = W.tick; S.step(W); eq(W.tick, tk, 'мир идёт после конца');
});

// ---------- стройка ----------
test('стройка: бур — только на жилу, занято, скала/роща, край, рядом с курганом, стоимость; снос возвращает', () => {
  const W = world(30, 10, { ingot: 10 }); ore(W, 3, 3, 1); W.t[4 * W.w + 4] = S.TREE; S.placeFixed(W, 'mound', 25, 3);
  eq(S.canPlace(W, 'drill', 2, 3), 'ore'); eq(S.canPlace(W, 'drill', 3, 3), '');
  eq(S.canPlace(W, 'belt', 4, 4), 'terrain'); eq(S.canPlace(W, 'smelter', 29, 3), 'bounds'); eq(S.canPlace(W, 'wall', 21, 4), 'enemy');
  S.place(W, 'drill', 3, 3, 0); eq(W.stock.ingot, 6); eq(S.canPlace(W, 'belt', 3, 3), 'busy');
  eq(S.canPlace(W, 'smelter', 8, 2), 'cost'); ok(!S.place(W, 'smelter', 8, 2, 0), 'поставили в долг');
  ok(S.remove(W, 3, 3)); eq(W.stock.ingot, 10, 'возврат'); ok(!S.remove(W, 25, 3), 'курган не сносится');
});
test('линия протяжки: сначала по длинной оси, угол смотрит вдоль второго отрезка; на своих лентах — только поворот', () => {
  eq(S.lineCells(0, 0, 3, 2).map(c => [c.x, c.y, c.dir]), [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 1], [3, 1, 1], [3, 2, 1]]);
  eq(S.lineCells(5, 5, 5, 1).map(c => c.dir), [3, 3, 3, 3, 3]);
  eq(S.lineCells(4, 4, 4, 4, 2), [{ x: 4, y: 4, dir: 2 }]);
  const W = world(10, 4, { ingot: 20 }); S.placeLine(W, 'belt', S.lineCells(1, 1, 5, 1)); eq(W.stock.ingot, 15);
  eq(S.placeLine(W, 'belt', S.lineCells(5, 1, 1, 1)), 0); eq(W.stock.ingot, 15, 'перекладка бесплатна'); eq(S.bAt(W, 3, 1).dir, 2);
});

// ---------- карта и демо ----------
test('карта по умолчанию: Ржавь доходит от кургана до Мастерской, клёпаные — от Мастерской до кургана; жилы трёх видов у старта', () => {
  const W = S.newWorld({ seed: 7 });
  ok(W.hall && W.mound, 'нет баз');
  ok(S.findPath(W, W.mound.x - 1, W.mound.y + 1, W.hall, 'foe'), 'путь Ржави');
  ok(S.findPath(W, W.hall.x + 4, W.hall.y + 1, W.mound, 'mech'), 'путь армии');
  const kinds = new Set(); for (let y = 8; y < 33; y++) for (let x = 9; x < 25; x++) if (W.ore[y * W.w + x]) kinds.add(W.ore[y * W.w + x]);
  eq([...kinds].sort(), [1, 2, 3], 'жилы у старта');
});
test('демо-мастерская: за минуту плавильня даёт слитки и они доезжают до Мастерской', () => {
  const W = S.newWorld({ seed: 7, firstWave: 999 }); S.demoLayout(W); const s0 = W.stock.ingot;
  run(W, 60); ok(W.made.ingot >= 20, 'слитков ' + W.made.ingot); ok(W.stock.ingot - s0 >= 15, 'доехало ' + (W.stock.ingot - s0));
});
test('производительность: 500 предметов на петлях + 40 буров, 2000 тиков (100 с игры) — быстро и без потерь', () => {
  const W = world(80, 46);
  line(W, 2, 2, 76, 2); line(W, 77, 2, 77, 36); line(W, 77, 37, 3, 37); line(W, 2, 37, 2, 3);
  line(W, 5, 5, 73, 5); line(W, 74, 5, 74, 33); line(W, 74, 34, 6, 34); line(W, 5, 34, 5, 6);
  let n = 0; W.blds.forEach(b => { if (b.type === 'belt' && n < 500) { b.items.push({ t: 'cu', p: 0.6, m: -1 }); n++; if (n < 500 && b.x % 3 === 0) { b.items.push({ t: 'coal', p: 0.1, m: -1 }); n++; } } });
  eq(n, 500, 'предметов');
  for (let x = 2; x < 42; x++) { ore(W, x, 43, 1 + x % 3); S.place(W, 'drill', x, 43, 3, F); }
  line(W, 2, 42, 58, 42); S.placeFixed(W, 'hall', 59, 41);
  const t0 = process.hrtime.bigint(); run(W, 100); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const loopItems = W.blds.filter(b => b.type === 'belt' && b.y < 40).reduce((a, b) => a + b.items.length, 0);
  eq(loopItems, 500, 'петли потеряли предметы');
  const mined = W.made.cu + W.made.coal + W.made.sand; ok(mined > 450, 'буры добыли ' + mined); // упор — пропускная способность одной ленты (~5.9 предм./с)
  eq(mined, W.stock.cu + W.stock.coal + W.stock.sand + count(W) - 500, 'баланс добычи');
  console.log(`     … 2000 тиков: ${ms.toFixed(0)} мс (${(ms / 2000).toFixed(3)} мс/тик), лент ${W.blds.filter(b => b.type === 'belt').length}, в пути ${count(W)}`);
  ok(ms < 2500, 'медленно: ' + ms.toFixed(0) + ' мс');
});

// ---------- FabPointer на фейковом canvas ----------
function fakeCanvas() {
  const h = {}; return { width: 960, height: 540, style: {}, h, addEventListener(t, f) { (h[t] = h[t] || []).push(f); }, removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), fire(t, e) { (h[t] || []).forEach(f => f(Object.assign({ preventDefault() {}, pointerType: 'mouse', pointerId: 1, button: 0 }, e))); } };
}
test('FabPointer: ЛКМ-протяжка (onDrag/onUp moved), клик, ПКМ down/drag/up, колесо, средняя кнопка, два пальца — панорама и щипок', () => {
  const cv = fakeCanvas(), log = [];
  const p = FP.attach(cv, { onDown: q => log.push('down'), onDrag: (a, b) => log.push('drag ' + b.x), onUp: (a, b, m) => log.push('up ' + m), onRight: (a, b, ph) => log.push('r ' + ph),
    onPan: (dx, dy) => log.push('pan ' + Math.round(dx)), onZoom: k => log.push('zoom ' + (k > 1 ? 'in' : 'out')), onHover: () => log.push('hover') });
  cv.fire('pointerdown', { clientX: 10, clientY: 10 }); cv.fire('pointermove', { clientX: 11, clientY: 10 }); cv.fire('pointermove', { clientX: 30, clientY: 10 }); cv.fire('pointerup', { clientX: 30, clientY: 10 });
  eq(log.splice(0), ['down', 'drag 60', 'up true'], 'протяжка (координаты canvas ×2)');
  cv.fire('pointerdown', { clientX: 10, clientY: 10 }); cv.fire('pointerup', { clientX: 10, clientY: 10 }); eq(log.splice(0), ['down', 'up false'], 'клик');
  cv.fire('pointerdown', { button: 2, clientX: 5, clientY: 5 }); cv.fire('pointermove', { clientX: 25, clientY: 5 }); cv.fire('pointerup', { clientX: 25, clientY: 5 }); eq(log.splice(0), ['r down', 'r drag', 'r up'], 'ПКМ');
  cv.fire('wheel', { deltaY: -100, deltaMode: 0, clientX: 5, clientY: 5 }); cv.fire('wheel', { deltaY: 100, deltaMode: 0, clientX: 5, clientY: 5 }); eq(log.splice(0), ['zoom in', 'zoom out'], 'колесо');
  cv.fire('pointerdown', { button: 1, clientX: 50, clientY: 50 }); cv.fire('pointermove', { clientX: 40, clientY: 50 }); cv.fire('pointerup', { clientX: 40, clientY: 50 }); eq(log.splice(0), ['pan 20'], 'средняя кнопка');
  cv.fire('pointermove', { clientX: 60, clientY: 60 }); eq(log.splice(0), ['hover'], 'наведение');
  const T = (t, id, x, y) => cv.fire(t, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y });
  T('pointerdown', 7, 100, 100); T('pointerdown', 8, 140, 100); T('pointermove', 7, 90, 100); T('pointermove', 8, 160, 100); T('pointerup', 7, 90, 100); T('pointerup', 8, 160, 100);
  ok(log.includes('pan 10') || log.some(s => s.startsWith('pan')), 'два пальца — нет панорамы: ' + log.join(',')); ok(log.includes('zoom in'), 'щипок');
  ok(!log.includes('up true') && !log.includes('up false'), 'второй палец не отменил жест');
  ok(typeof p.cancel === 'function');
});

// ---------- тексты ----------
test('i18n: ключи RU и EN совпадают; у всех построек есть имя и описание; заголовок не пустой', () => {
  const ru = Object.keys(STR.ru).sort(), en = Object.keys(STR.en).sort(); eq(ru, en);
  S.ORDER.concat(['demolish', 'rally', 'charge', 'rotate']).forEach(k => { ok(STR.ru[k] && STR.en[k], 'имя ' + k); ok(STR.ru['d_' + k] && STR.en['d_' + k], 'описание ' + k); });
  S.ITEMS.concat(['mech', 'crawler', 'brute', 'hall', 'mound']).forEach(k => ok(STR.ru[k] && STR.en[k], k));
  ok(STR.ru.title === 'ЛЕНТОВОД' && STR.en.title === 'LENTOVOD');
});

// ---------- музыка (по образцу _shared/tests/music.test.mjs) ----------
test('музыка: js/music.js парсится секвенсором движка, 8–16 тактов, голоса кратны, ноты в диапазоне, играет без ошибок', () => {
  const timers = [], listeners = {};
  class FakeAC { constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
    createOscillator() { return nd(); } createGain() { return nd(); } createBiquadFilter() { return nd(); } createBufferSource() { return nd(); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } resume() {} suspend() {} }
  function prm() { return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ≤0'); }, setTargetAtTime() {} }; }
  function nd() { return { connect() {}, disconnect() {}, start() {}, stop() {}, frequency: prm(), detune: prm(), gain: prm(), Q: prm(), type: '' }; }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt, AudioContext: FakeAC, performance: { now: () => 0 },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }, setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval(id) { timers[id - 1] = null; },
    setTimeout() { return 0; }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {} };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), win);
  const A = win.Arcade, t = A.tracks.lentovod; ok(t, 'нет Arcade.tracks.lentovod');
  const c = A.parseTrack(t), bars = c.melody.length / (c.div * 4);
  ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тактов ' + bars);
  ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'голоса не кратны');
  [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, 'нота ' + e.f));
  const g = A.createGame({ canvas: '#c', gameId: 'lentovod' }); g.useStandardScreens(); g.scene('play', {});
  (listeners.keydown || []).forEach(f => f({ code: 'Enter', preventDefault() {} })); g.goto('play');
  for (let i = 0; i < 200; i++) { g.audio.ac.currentTime += 0.05; timers.forEach(f => f && f()); }
  const st = g.audio.music.stats; ok(st.scheduled > 30 && st.errors === 0, JSON.stringify(st));
});

// ---------- Правило имён ----------
test('правило имён: нет чужих игр, студий и терминов известных игр (общий список + «фабрика/автоматизация»), стоп-лист в base64', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgnxjb21tYW5kb3zQutC+0LzQvNCw0L3QtNC+fGlrYXJpfNC40LrQsNGA0Lh8XGJtZXJjc1xifHNob2NrID90cm9vcGVyc3xcYmphY2thbFxifGhlYXZ5ID9iYXJyZWx8Z3VlcnI/aWxsYSA/d2FyfHJhbWJvfNGA0Y3QvNCx0L580YDQtdC80LHQvnx0aW1lID9zb2xkaWVyc3xmcm9udCA/bGluZXx3aG8gP2RhcmVzID93aW5zfGxhbmRpbmcgP3BhcnR5fHN0b3JtY2xvYWt8emFybml0c2F80LfQsNGA0L3QuNGGfG1ldGFsID9zbHVnfGNhbm5vbiA/Zm9kZGVyfGd1blwuPyA/c21va2V8YWxpZW4gP3N5bmRyb21lfGhhbG9cYnxjYWxsID9vZiA/ZHV0eXxzdGFyY3JhZnR80YHRgtCw0YDQutGA0LDRhNGCfHdhcmNyYWZ0fNCy0LDRgNC60YDQsNGE0YJ8XGJ6ZXJnfNC30LXRgNCzfHByb3Rvc3N80L/RgNC+0YLQvtGB0YF8XGJ0ZXJyYW580YLQtdGA0YDQsNC9fNC/0LjQu9C+0L18XGJweWxvbnM/XGJ80LfQuNC70L7Rgnx6ZWFsb3R80LzQvtGA0L/QtdGFfFxibWFyaW5lcz9cYnx6ZXJnbGluZ3xoeWRyYWxpc2t80LPQuNC00YDQsNC70LjRgdC6fG11dGFsaXNrfNC80YPRgtCw0LvQuNGB0Lp8dWx0cmFsaXNrfNGD0LvRjNGC0YDQsNC70LjRgdC6fG92ZXJsb3JkfGhhdGNoZXJ5fFxic2N2XGJ8c2llZ2UgP3Rhbmt8c3VwcGx5ID9kZXBvdHxmb290bWFufFxicGVvbnM/XGJ8YmxpenphcmR80LHQu9C40LfQt9Cw0YDQtHx3ZXN0d29vZHzQstC10YHRgtCy0YPQtHxjb21tYW5kID8oJnxhbmQpID9jb25xdWVyfHJlZCA/YWxlcnR8XGJkdW5lXGJ8dG90YWwgP2FubmloaWxhdGlvbnxzdXByZW1lID9jb21tYW5kZXJ8Y29tcGFueSA/b2YgP2hlcm9lc3xkYXduID9vZiA/d2FyfHdhcmhhbW1lcnxhZ2UgP29mID8oZW1waXJlc3xteXRob2xvZ3kpfHJpc2UgP29mID9uYXRpb25zfHN0cm9uZ2hvbGR8c2V0dGxlcnN8bm9ydGhnYXJkfHRoZXkgP2FyZSA/YmlsbGlvbnN8aXJvbiA/aGFydmVzdHxob21ld29ybGR8XGJra25kXGJ8d2Fyem9uZSA/MjEwMHzQutCw0LfQsNC60LgoPyFb0LAt0Y/RkV0pfGNvc3NhY2tzfNCx0LvQuNGG0LrRgNC40LN8YmxpdHprcmllZ3zQsiDRgtGL0LvRgyDQstGA0LDQs9CwfG1lbiA/b2YgP3dhcnxzcGVsbGZvcmNlfGJhdHRsZSA/cmVhbG1zfFxibXl0aFxifGVuc2VtYmxlID9zdHVkaW9zfHJlbGljID9lbnRlcnRhaW5tZW50fG5pZ2h0ID9lbGZ80L3QvtGH0L1b0LAt0Y9dKyDRjdC70YzRhHxcYm5leHVzXGJ8d2FycCA/Z2F0ZXxmYWN0b3Jpb3zRhNCw0LrRgtC+0YDQuNC+fG1pbmR1c3RyeXzQvNC40L3QtNCw0YHRgtGA0Lh8c2F0aXNmYWN0b3J5fNGB0LDRgtC40YHRhNCw0LrRgtC+0YDQuHxzaGFwZXp80YjQtdC50L/Qt3xkeXNvbiA/c3BoZXJlfGluZmluaWZhY3Rvcnl8b3B1cyA/bWFnbnVtfHNwYWNlY2hlbXxjYXB0YWluID9vZiA/aW5kdXN0cnl8dGVjaHRvbmljYXxkZXN5bmNlZHxhdXRvbmF1dHN8b3h5Z2VuID9ub3QgP2luY2x1ZGVkfFxid3ViZVxifGFudWtlfGNvZmZlZSA/c3RhaW58emFjaHRyb25pY3N8YmVsdG1hdGljfGJlbGx3cmlnaHR8YmlnID9waGFybWF8cHJvZHVjdGlvbiA/bGluZXxmYWN0b3J5ID90b3dufHJpZnRicmVha2VyfGNvcmUgP3NoYXJkfHRpbWJlcmJvcm58aW5kdXN0cmllcyA/b2YgP3RpdGFufFxiYW5ubyA/KDF8MilcZHszfVxifGNyZWVwZXIgP3dvcmxkfGZvdW5kcnkgPyh2dHR8Z2FtZSl8aXNsYW5kZXJzfGNvbnZleW9yID90eWNvb24=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 9, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['RmFjdG9yaW8=', 'TWluZHVzdHJ5', 'U2F0aXNmYWN0b3J5', 'c2hhcGV6Lmlv', 'RHlzb24gU3BoZXJlIFByb2dyYW0=', 'Q29yZSBTaGFyZA==', '0KTQsNC60YLQvtGA0LjQvg==', 'U3RhckNyYWZ0', 'VGV0cmlz']
    .forEach(b => ok(BAD.test(u(b)), 'стоп-лист не ловит ' + b));
  ['ЛЕНТОВОД', 'LENTOVOD', 'Гефест', 'Мастерская', 'Workshop', 'Ржавый курган', 'Rust Mound', 'Клёпаный', 'Riveter', 'Ржавник', 'Rustling', 'Плавильня', 'Smelter',
    'Стекольня', 'Glassworks', 'Шестерённая', 'Gear mill', 'Сборочный цех', 'Assembly shop', 'Паровая пушка', 'Steam gun', 'Частокол', 'Palisade', 'Развилка', 'Splitter', 'Сортировщик', 'Sorter', 'fabrika']
    .forEach(s => ok(!BAD.test(s), 'ложное срабатывание: ' + s));
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

/* ВЗВОД · tests/engine.test.mjs — автотесты логики и кампании (Node, без зависимостей).
   Запуск: node vzvod/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js, js/campaign.js) — в node:vm с шимом window.
   Покрытие: A* (8 сторон без срезания углов), колонна «гуськом» в узких проходах (без застревания и выхода в стены),
   деление/сбор/переключение групп, огонь в точку, шестерни/ракеты против ульев (паяльник улей не берёт), транспорт
   (вагонетка по суше, самоход по жиже, посадка/высадка), сопровождение, удержание точки, ящик снабжения (нет тупика без
   боеприпасов), генератор 18 миссий (детерминизм, достижимость всех целей, хватает боеприпасов), кампания (опыт, ранги,
   ремонт через миссию при наличии фонда, пополнение, нет дедлока «отряд кончился навсегда», конец кампании), сохранение,
   i18n, музыка, страница, правило имён; проходимость и баланс — ботом-командиром с реакцией 150–250 мс (tests/bot.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/game.js', 'js/campaign.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const V = sandbox.VZVOD, L = V.logic, Camp = V.Camp, T = L.T;
const { playMission, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn && fn(i) === false) return i; game.update(1 / 60); } return -1; }
function squadOf(n, rank = 0){ return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'b' + i, rank })); }
// Своя карта из строк: '#' стена, '~' жижа, 'c' ящик-укрытие, '.' земля, 'S' — высадка
function mapFrom(rows, extra = {}){
  const h = rows.length, w = rows[0].length, t = new Uint8Array(w * h); let st = [1, 1];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { t[y * w + x] = ch === '#' ? T.WALL : ch === '~' ? T.LIQ : ch === 'c' ? T.CRATE : T.GROUND; if (ch === 'S') st = [x, y]; }));
  return Object.assign({ w, h, t, biome: 'factory', start: { x: st[0] * 16 + 8, y: st[1] * 16 + 8 }, startTile: st, hives: [], enemies: [], pickups: [], vehicles: [], vip: null, exit: null, zone: null, spawns: [], seed: 0 }, extra);
}
const QUIET = Object.assign({}, L.mission(0, 0), { obj: 'hold', hives: 0, drones: 0, id: 't' });   // без ульев и врагов, цель не выполняется сама

// ---------- Поиск пути ----------
test('A*: путь по клеткам без срезания углов; недостижимая клетка → null; путь в пикселях ведёт к точке клика', () => {
  const M = mapFrom([
    '##########',
    '#S...#...#',
    '#.##.#.#.#',
    '#..#...#.#',
    '##.#####.#',
    '#........#',
    '##########']);
  const p = L.astar(M, 1, 1, 8, 1, L.footPass); ok(p, 'путь есть');
  eq(p[0], [1, 1]); eq(p[p.length - 1], [8, 1]);
  for (let i = 1; i < p.length; i++){
    const [x0, y0] = p[i - 1], [x1, y1] = p[i]; ok(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) === 1, 'шаг в соседнюю клетку');
    ok(!L.solidFoot(L.tget(M, x1, y1)), 'клетка проходима');
    if (x1 !== x0 && y1 !== y0) ok(!L.solidFoot(L.tget(M, x1, y0)) && !L.solidFoot(L.tget(M, x0, y1)), 'диагональ не срезает угол стены');
  }
  const M2 = mapFrom(['#####', '#S#.#', '#####']); ok(L.astar(M2, 1, 1, 3, 1, L.footPass) === null, 'замкнутая комната');
  const px = L.findPath(M, 24, 24, 136, 24, 'foot'); ok(px && px.length, 'пиксельный путь');
  eq([px[px.length - 1].x, px[px.length - 1].y], [136, 24], 'конец пути — точка клика');
  let ax = 24, ay = 24; px.forEach(q => { ok(L.walkable(M, ax, ay, q.x, q.y, L.footPass, 3), 'сглаженный отрезок проходим'); ax = q.x; ay = q.y; });
  ok(L.astar(mapFrom(['#####', '#S~.#', '#####']), 1, 1, 3, 1, L.footPass) === null && L.astar(mapFrom(['#####', '#S~.#', '#####']), 1, 1, 3, 1, L.hoverPass), 'жижа: пешком нельзя, самоходу можно');
});
test('колонна: 6 болванчиков гуськом проходят змейку из проходов шириной в клетку — без застревания и заходов в стены', () => {
  const M = mapFrom([
    '##############################',
    '#S.......................#...#',
    '########################.#.#.#',
    '#........................#.#.#',
    '#.########################.#.#',
    '#..........................#.#',
    '############################.#',
    '#............................#',
    '##############################']);
  const game = V.Game({ spec: QUIET, map: M, squad: squadOf(6), rng: mulberry32(1) }).start(), S = game.state();
  ok(game.moveTo(1 * 16 + 8, 7 * 16 + 8), 'приказ принят');
  let bad = 0, maxGap = 0;
  const t = run(game, 90, () => {
    S.units.forEach(u => { if (L.solidFoot(L.tileAt(M, u.x, u.y))) bad++; });
    const o = S.groups[0].order; for (let i = 1; i < o.length; i++) maxGap = Math.max(maxGap, D(S.units.find(u => u.id === o[i]), S.units.find(u => u.id === o[i - 1])));
    const ld = game.leader(0); if (D(ld, { x: 24, y: 120 }) < 1 && S.units.every(u => !u.moving)) return false;
  });
  ok(t > 0, 'колонна дошла за 90 с');
  eq(bad, 0, 'никто не заходил в стены');
  const o = S.groups[0].order.map(id => S.units.find(u => u.id === id));
  ok(D(o[0], { x: 24, y: 120 }) < 1, 'лидер на точке');
  for (let i = 1; i < o.length; i++) ok(D(o[i], o[i - 1]) < 16, 'ведомый ' + i + ' рядом с предшественником: ' + D(o[i], o[i - 1]).toFixed(1));
  ok(maxGap < 70, 'колонна не растягивается: ' + maxGap.toFixed(0));
  console.log('     змейка: ' + (t / 60).toFixed(1) + ' с, макс. разрыв ' + maxGap.toFixed(0) + ' px');
});
test('колонна: разворот назад и проход через дверь шириной в клетку (здание) — все проходят внутрь', () => {
  const M = mapFrom([
    '####################',
    '#S.................#',
    '#......########....#',
    '#......#......#....#',
    '#......#......#....#',
    '#......#......#....#',
    '#......####.###....#',
    '#..................#',
    '####################']);
  const game = V.Game({ spec: QUIET, map: M, squad: squadOf(5), rng: mulberry32(2) }).start(), S = game.state();
  game.moveTo(17 * 16, 7 * 16 + 8); run(game, 6);
  game.moveTo(8 * 16 + 8, 3 * 16 + 8);
  let bad = 0; run(game, 40, () => { S.units.forEach(u => { if (L.solidFoot(L.tileAt(M, u.x, u.y))) bad++; }); });
  eq(bad, 0);
  S.units.forEach(u => ok(u.x > 8 * 16 && u.x < 14 * 16 && u.y > 3 * 16 && u.y < 6 * 16, 'внутри здания: ' + u.x.toFixed(0) + ',' + u.y.toFixed(0)));
});

// ---------- Группы, огонь, взрывы ----------
const OPEN = () => mapFrom(Array.from({ length: 20 }, (_, y) => y === 0 || y === 19 ? '#'.repeat(30) : '#' + (y === 17 ? 'S' : '.') + '.'.repeat(27) + '#'));
test('группы: деление пополам, раздельные приказы, переключение Tab, сбор; неактивная группа отстреливается сама', () => {
  const game = V.Game({ spec: QUIET, map: OPEN(), squad: squadOf(5), rng: mulberry32(3) }).start(), S = game.state();
  ok(game.split(), 'делится'); eq([S.groups[0].order.length, S.groups[1].order.length], [3, 2]);
  ok(!game.split(), 'второй раз не делится');
  game.moveTo(400, 60); run(game, 8);
  ok(D(game.leader(0), { x: 400, y: 60 }) < 2, 'группа А пришла'); ok(D(game.leader(1), { x: 400, y: 60 }) > 200, 'группа Б стоит');
  ok(game.switchGroup() && S.active === 1, 'Tab');
  game.moveTo(100, 200); run(game, 6); ok(D(game.leader(1), { x: 100, y: 200 }) < 2, 'Б пришла');
  // враг рядом с неактивной группой А
  const a = game.leader(0), e = game._spawn('drone', a.x + 60, a.y + 30, null); e.cd = 99;
  run(game, 3); ok(e.dead, 'неактивная группа сама разобрала механизм');
  ok(game.merge() && S.groups[1 - S.active].order.length === 0 && S.groups[S.active].order.length === 5, 'собрались');
  run(game, 20); const o = S.groups[S.active].order.map(id => S.units.find(u => u.id === id));
  for (let i = 1; i < o.length; i++) ok(D(o[i], o[i - 1]) < 16, 'после сбора — снова колонна');
});
test('огонь: активная группа стреляет только по команде и в точку курсора; ранг повышает скорость и точность', () => {
  const game = V.Game({ spec: QUIET, map: OPEN(), squad: squadOf(4), rng: mulberry32(4) }).start(), S = game.state();
  const e = game._spawn('turret', 160, 190, null); e.cd = 99; e.hp = 99; e.max = 99;
  run(game, 1); eq(S.bullets.length, 0, 'без команды не стреляет');
  game.fire(true, 160, 190); run(game, 2); ok(e.hp < 99, 'попадания есть'); game.fire(false); run(game, 1); eq(S.bullets.length, 0);
  const s0 = L.stats(0), s5 = L.stats(5); ok(s5.speed > s0.speed && s5.cd < s0.cd && s5.spread < s0.spread && s5.range > s0.range, 'ранг 5 лучше 0');
  eq([0, 3, 4, 9, 10, 44, 45, 999].map(L.rankOf), [0, 0, 1, 1, 2, 4, 5, 5], 'пороги рангов');
});
test('ульи: паяльник их не берёт, шестерня/ракета — да; улей рождает механизмы, пока отряд рядом; взрыв ломает и своих рядом', () => {
  const spec = L.mission(0, 0), game = V.Game({ spec, seed: 3, squad: squadOf(4), rng: mulberry32(5) }).start(), S = game.state();
  const h = S.hives[0]; S.enemies.forEach(e => { e.dead = true; });
  const Dst = L.bfs(S.map, S.src.startTile[0], S.src.startTile[1], L.footPass);
  ok(L.hiveRing(S.map, Dst, h).length, 'к улью можно подойти');
  let spot = null; for (let ty = 1; ty < S.map.h - 1 && !spot; ty++) for (let tx = 1; tx < S.map.w - 1 && !spot; tx++){ const c = { x: tx * 16 + 8, y: ty * 16 + 8 }, d = D(c, h); if (d > 64 && d < 100 && Dst[ty * S.map.w + tx] >= 0) spot = c; }
  S.units.forEach(u => { u.x = spot.x; u.y = spot.y; u.q = []; u.crumbs = []; }); game._resetFollowers(0);
  game.fire(true, h.x, h.y); run(game, 3); game.fire(false); eq(h.hp, spec.hiveHp, 'пули не берут улей');
  let spawned = S.enemies.filter(e => !e.dead && e.from === h.id).length; S.invuln = true; run(game, 9); spawned = S.enemies.filter(e => !e.dead && e.from === h.id).length; ok(spawned >= 1, 'улей рождает механизмы: ' + spawned); S.invuln = false;
  S.enemies.forEach(e => { e.dead = true; });
  const g0 = S.ammo.gear; ok(game.gear(h.x, h.y), 'бросок'); eq(S.ammo.gear, g0 - 1);
  run(game, 2); ok(h.dead, 'шестерня взорвала улей (hp 1)');
  ok(!L.solidFoot(L.tget(S.map, h.tx, h.ty)), 'на месте улья — проходимые обломки');
  S.ammo.gear = 0; ok(!game.gear(h.x, h.y), 'без шестерней — нельзя');
  const u = S.units.find(q => q.alive); game._explode(u.x + 5, u.y, 30, -1); ok(!u.alive, 'взрыв вплотную ломает своего');
});
test('ракета: летит прямо, взрывается о стену/улей, бьёт по площади', () => {
  const spec = Object.assign({}, L.mission(1, 0)), game = V.Game({ spec, seed: 2, squad: squadOf(4), rng: mulberry32(6) }).start(), S = game.state();
  S.enemies.forEach(e => { e.dead = true; }); S.invuln = true;
  const h = S.hives[0]; h.hp = 1;
  // найти точку с видимостью на край улья
  let spot = null; for (let r = 60; r < 150 && !spot; r += 8) for (let a = 0; a < 6.28 && !spot; a += 0.2){ const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r; if (!L.solidFoot(L.tileAt(S.map, x, y)) && L.los(S.map, x, y, h.x - Math.cos(a) * -18, h.y - Math.sin(a) * -18)) spot = { x, y }; }
  ok(spot, 'есть позиция'); const ld = game.leader(0); ld.x = spot.x; ld.y = spot.y;
  S.ammo.rocket = 1; ok(game.rocket(h.x, h.y)); run(game, 1.5); ok(h.dead, 'ракета взорвала улей');
});

// ---------- Транспорт, сопровождение, удержание, снабжение ----------
test('транспорт: клик по вагонетке — группа садится; машина ездит и стреляет снарядами; F — высадка', () => {
  const M = OPEN(); const game = V.Game({ spec: QUIET, map: Object.assign(M, { vehicles: [{ type: 'cart', x: 200, y: 280 }] }), squad: squadOf(4), rng: mulberry32(7) }).start(), S = game.state();
  const v = S.vehicles[0]; game.moveTo(v.x + 3, v.y); run(game, 8);
  eq(S.groups[0].vehicle, v.id, 'сели'); ok(S.units.every(u => u.inV === v.id), 'все внутри');
  game.moveTo(400, 100); run(game, 8); ok(D(v, { x: 400, y: 100 }) < 3, 'вагонетка доехала'); ok(S.units.every(u => D(u, v) < 1), 'экипаж едет с машиной');
  const e = game._spawn('heavy', 400, 200, null); e.cd = 99; game.fire(true, 400, 200); run(game, 4); game.fire(false); ok(e.dead, 'снаряды вагонетки');
  ok(game.exitVehicle(), 'F'); ok(S.units.every(u => u.inV == null) && S.groups[0].vehicle == null && v.crew == null, 'вышли');
  game.moveTo(100, 100); run(game, 6); ok(D(v, { x: 400, y: 100 }) < 3, 'пустая машина стоит');
});
test('самоход: идёт по жиже (пешком нельзя), высадка над жижей запрещена; разбитая машина высаживает экипаж', () => {
  const rows = Array.from({ length: 16 }, (_, y) => y === 0 || y === 15 ? '#'.repeat(30) : '#' + (y === 13 ? 'S' : '.') + '.........' + '~~~~~~~~~~' + '........' + '#');
  const M = mapFrom(rows, { vehicles: [{ type: 'skimmer', x: 9 * 16 + 8, y: 8 * 16 + 8 }] });
  const game = V.Game({ spec: QUIET, map: M, squad: squadOf(3), rng: mulberry32(8) }).start(), S = game.state(), v = S.vehicles[0];
  ok(L.findPath(M, 24, 24, 15 * 16, 24, 'foot').length > 0, 'пешком до края жижи можно'); ok(L.solidFoot(T.LIQ) && !L.solidHover(T.LIQ));
  game.moveTo(v.x, v.y); run(game, 10); eq(S.groups[0].vehicle, v.id, 'сели в самоход');
  game.moveTo(15 * 16 + 8, 8 * 16 + 8); run(game, 4); eq(L.tileAt(M, v.x, v.y), T.LIQ, 'самоход над жижей');
  ok(!game.exitVehicle(), 'над жижей не выйти');
  game.moveTo(24 * 16 + 8, 8 * 16 + 8); run(game, 4); ok(v.x > 21 * 16, 'переправились');
  S.vehicles[0].hp = 1; const e = game._spawn('rusher', v.x + 20, v.y, null); e.alertT = 9; run(game, 3);
  ok(v.dead, 'машина разбита'); ok(S.units.every(u => u.alive && u.inV == null && !L.solidFoot(L.tileAt(M, u.x, u.y))), 'экипаж цел и на суше');
});
test('сопровождение: наладчик стоит, пока рядом никого; идёт к выходу рядом с отрядом; дошёл — миссия выполнена', () => {
  const spec = L.mission(1, 1), game = V.Game({ spec, seed: 4, squad: squadOf(4), rng: mulberry32(9) }).start(), S = game.state();
  S.enemies.forEach(e => { e.dead = true; }); S.hives.forEach(h => { h.dead = true; }); S.invuln = true;
  S.units.forEach(u => { u.x = S.vip.x + 200; u.y = S.vip.y; }); const v0 = { x: S.vip.x, y: S.vip.y };
  run(game, 3); ok(D(S.vip, v0) < 1, 'один не идёт');
  const t = run(game, 200, () => { const vp = S.vip; S.units.forEach((u, i) => { u.x = vp.x + 10 + i; u.y = vp.y; u.q = []; }); if (S.phase !== 'play') return false; });
  ok(t > 0 && S.phase === 'won', 'дошёл: ' + S.phase + ' ' + (S.obj.prog * 100 | 0) + '%');
  const g2 = V.Game({ spec, seed: 4, squad: squadOf(4), rng: mulberry32(9) }).start(); g2.state().vip.hp = 1; g2._explode(g2.state().vip.x, g2.state().vip.y, 30, -1); g2.update(0.02);
  eq(g2.state().phase, 'lost'); eq(g2.state().reason, 'vip');
});
test('удержание: время идёт только пока кто-то из отряда в круге; набрал — миссия выполнена; волны идут к точке', () => {
  const spec = L.mission(1, 2), game = V.Game({ spec, seed: 5, squad: squadOf(4), rng: mulberry32(10) }).start(), S = game.state();
  S.invuln = true; S.enemies.forEach(e => { e.dead = true; });
  run(game, 2); eq(S.obj.prog, 0);
  const z = S.zone, u = game.leader(0); u.x = z.x; u.y = z.y; u.q = [];
  run(game, 5); ok(Math.abs(S.obj.prog - 5) < 0.1 && S.obj.started, 'идёт: ' + S.obj.prog);
  S.units.forEach(q => { q.x = z.x + z.r + 80; q.y = z.y; q.q = []; q.crumbs = []; }); game._resetFollowers(0); run(game, 3); ok(Math.abs(S.obj.prog - 5) < 0.2, 'стоит, когда вышли');
  ok(S.enemies.some(e => !e.dead && e.alertT > 0), 'волна механизмов');
  const t = run(game, 80, () => { S.units.forEach(q => { q.x = z.x; q.y = z.y; q.q = []; }); if (S.phase !== 'play') return false; }); ok(t > 0 && S.phase === 'won');
});
test('снабжение: ульи остались, боеприпасов и ящиков нет — через 8 с мастерская присылает ящик шестерней (нет тупика)', () => {
  const spec = L.mission(0, 0), game = V.Game({ spec, seed: 6, squad: squadOf(4), rng: mulberry32(11) }).start(), S = game.state();
  S.invuln = true; S.enemies.forEach(e => { e.dead = true; }); S.ammo.gear = 0; S.ammo.rocket = 0; S.pickups.forEach(p => { p.taken = true; });
  run(game, 7); ok(!S.pickups.some(p => p.supply), 'не сразу');
  run(game, 2); const p = S.pickups.find(q => q.supply); ok(p, 'ящик пришёл');
  ok(L.findPath(S.map, game.leader(0).x, game.leader(0).y, p.x, p.y, 'foot').length > 0 || D(game.leader(0), p) < 20, 'ящик достижим');
});
test('поражение: все болванчики сломаны → «отряд выбыл»; в итоге — кто сломан и сколько разобрал', () => {
  const game = V.Game({ spec: QUIET, map: OPEN(), squad: squadOf(3), rng: mulberry32(12) }).start(), S = game.state();
  S.units[0].kills = 2; S.units.forEach(u => game._break(u)); game.update(0.02);
  eq(S.phase, 'lost'); eq(S.result.units.map(u => u.alive), [false, false, false]); eq(S.result.units[0].kills, 2);
});

// ---------- Миссии ----------
test('миссии: 6 операций × 2–4 миссии (18), отряд 2–6, все виды целей и местностей, транспорт обоих видов', () => {
  eq(L.OPS.length, 6); L.OPS.forEach(op => ok(op.missions.length >= 2 && op.missions.length <= 4 && op.squad >= 2 && op.squad <= 6));
  const all = L.OPS.flatMap(o => o.missions); eq(all.length, 18);
  ['hives', 'clear', 'escort', 'hold'].forEach(k => ok(all.some(m => m.obj === k), 'цель ' + k));
  ['factory', 'snow', 'swamp'].forEach(k => ok(all.some(m => m.biome === k), 'местность ' + k));
  ok(all.some(m => m.veh.includes('cart')) && all.some(m => m.veh.includes('skimmer')), 'вагонетка и самоход');
});
test('миссии: карты детерминированы по сиду; все цели достижимы пешком от высадки; боеприпасов хватает на ульи (×10 сидов)', () => {
  let n = 0, tries = 0;
  L.OPS.forEach((op, oi) => op.missions.forEach((m, mi) => {
    for (let s = 1; s <= 10; s++){
      const M = L.genMission(m, s), c = L.checkMission(m, M); n++; tries += M.tries;
      ok(c.ok, m.id + ' сид ' + s + ': ' + c.errs.join(', '));
      eq(M.hives.length, m.hives); eq(M.enemies.length, m.drones + m.rushers + m.turrets + m.heavies);
      eq(M.vehicles.map(v => v.type), m.veh);
    }
    eq(Buffer.from(L.genMission(m, 7).t).toString('base64'), Buffer.from(L.genMission(m, 7).t).toString('base64'), 'детерминизм ' + m.id);
  }));
  ok(Buffer.from(L.genMission(L.mission(0, 0), 1).t).toString('base64') !== Buffer.from(L.genMission(L.mission(0, 0), 2).t).toString('base64'), 'сид меняет карту');
  console.log('     карт: ' + n + ', попыток генератора в среднем ' + (tries / n).toFixed(2));
});

// ---------- Кампания ----------
function memStore(){ const m = {}; return { get: (k, d) => (k in m ? m[k] : d), set: (k, v) => { m[k] = String(v); }, m }; }
const RES = (won, units, o = {}) => Object.assign({ won, score: won ? 1000 : 100, kills: 0, hives: won ? 2 : 0, units }, o);
test('кампания: старт — 4 болванчика; опыт за миссию и разборку, новый ранг; победа ведёт к следующей миссии и операции', () => {
  const C = Camp.newCampaign(); eq(C.roster.length, 4); eq([C.op, C.mi], [0, 0]);
  Camp.prepare(C); const sq = Camp.squadFor(C).map(b => b.id); eq(sq.length, 4);
  const rep = Camp.apply(C, RES(true, sq.map((id, i) => ({ id, alive: true, kills: i === 0 ? 3 : 0 }))), sq);
  eq(C.roster[0].xp, 5); eq(C.roster[0].rank, 1); ok(rep.promos.includes(1)); eq([C.op, C.mi], [0, 1]);
  Camp.apply(C, RES(true, sq.map(id => ({ id, alive: true, kills: 0 }))), sq); eq([C.op, C.mi], [1, 0], 'операция 2');
  ok(C.roster.length >= 6, 'пополнение после побед: ' + C.roster.length);
});
test('ремонт: сломанный пропускает следующую миссию и возвращается после неё, если в фонде есть ' + Camp.REPAIR_COST + '; без фонда — ждёт', () => {
  const C = Camp.newCampaign(); C.fund = 0;
  Camp.prepare(C); let sq = Camp.squadFor(C).map(b => b.id);
  Camp.apply(C, RES(false, sq.map((id, i) => ({ id, alive: i !== 0, kills: 0 }))), sq);
  const b1 = C.roster.find(b => b.id === 1); eq([b1.state, b1.wait], ['repair', 1]);
  eq(C.fund, 1);
  Camp.prepare(C); eq(b1.state, 'repair', 'пропускает следующую'); sq = Camp.squadFor(C).map(b => b.id); ok(!sq.includes(1));
  Camp.apply(C, RES(false, sq.map(id => ({ id, alive: true, kills: 0 }))), sq); eq(b1.wait, 0); eq(C.fund, 2);
  const f0 = C.fund; const p = Camp.prepare(C); eq(b1.state, 'ready', 'вернулся'); ok(p.repaired.includes(1)); eq(C.fund, f0 - Camp.REPAIR_COST);
  // нет фонда — ждёт
  const C2 = Camp.newCampaign(); C2.fund = 0; Camp.prepare(C2); let s2 = Camp.squadFor(C2).map(b => b.id);
  Camp.apply(C2, RES(false, s2.map((id, i) => ({ id, alive: i !== 0 }))), s2); C2.fund = 0;
  Camp.prepare(C2); s2 = Camp.squadFor(C2).map(b => b.id); Camp.apply(C2, RES(false, s2.map(id => ({ id, alive: true }))), s2); C2.fund = 0;
  const p2 = Camp.prepare(C2); eq(C2.roster[0].state, 'repair'); ok(p2.waiting.includes(1), 'ждёт фонд');
});
test('нет дедлока: 300 провалов подряд, отряд ломается целиком — в строю всегда ≥ 2, мастерская не раздувается, ремонт идёт', () => {
  const C = Camp.newCampaign(); let minSq = 99, repaired = 0;
  for (let k = 0; k < 300; k++){
    const p = Camp.prepare(C); repaired += p.repaired.length;
    const sq = Camp.squadFor(C).map(b => b.id); minSq = Math.min(minSq, sq.length);
    ok(sq.length >= Camp.MIN_SQUAD, 'миссия ' + k + ': отряд ' + sq.length);
    Camp.apply(C, RES(false, sq.map(id => ({ id, alive: false }))), sq);
    ok(C.roster.length <= Camp.ROSTER_MAX + 4, 'мастерская: ' + C.roster.length);
  }
  ok(repaired > 50, 'ремонтов: ' + repaired); ok(C.fund >= 0);
  // после серии провалов кампанию можно продолжить и пройти
  for (let k = 0; k < 18; k++){ Camp.prepare(C); const sq = Camp.squadFor(C).map(b => b.id); Camp.apply(C, RES(true, sq.map(id => ({ id, alive: true, kills: 1 }))), sq); }
  ok(C.done, 'кампания пройдена после серии провалов');
  console.log('     мин. отряд ' + minSq + ', ремонтов ' + repaired + ', фонд ' + C.fund);
});
test('кампания: 18 побед подряд → конец; отряд растёт до 6 к последней операции', () => {
  const C = Camp.newCampaign(); let sizes = [];
  for (let k = 0; k < 18; k++){ ok(!C.done); Camp.prepare(C); const sq = Camp.squadFor(C).map(b => b.id); sizes.push(sq.length); Camp.apply(C, RES(true, sq.map(id => ({ id, alive: true, kills: 2 }))), sq); }
  ok(C.done); eq(C.wins, 18); eq(sizes[0], 4); eq(sizes[17], 6, 'отряды: ' + sizes.join(','));
});
test('сохранение: кампания сохраняется и восстанавливается; битые данные, чужая версия и пройденная кампания — не грузятся', () => {
  const S = memStore(), C = Camp.newCampaign(); C.seed = 77;
  Camp.prepare(C); const sq = Camp.squadFor(C).map(b => b.id); Camp.apply(C, RES(true, sq.map(id => ({ id, alive: id !== 2, kills: 1 }))), sq);
  Camp.save(S, C); ok(S.m[Camp.KEY], 'ключ ' + Camp.KEY);
  const C2 = Camp.load(S); eq(JSON.stringify(C2), JSON.stringify(C));
  S.set(Camp.KEY, '{oops'); eq(Camp.load(S), null);
  S.set(Camp.KEY, JSON.stringify(Object.assign({}, C, { v: 99 }))); eq(Camp.load(S), null);
  S.set(Camp.KEY, JSON.stringify(Object.assign({}, C, { op: 9 }))); eq(Camp.load(S), null);
  S.set(Camp.KEY, JSON.stringify(Object.assign({}, C, { done: true }))); eq(Camp.load(S), null);
  Camp.clear(S); eq(Camp.load(S), null);
  ok(/^arcade\.vzvod\./.test(Camp.KEY), 'ключ в пространстве arcade.vzvod');
});

// ---------- i18n, музыка, страница, имена ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть операции, миссии, цели, ранги, имена', () => {
  const ru = Object.keys(V.STR.ru).sort(), en = Object.keys(V.STR.en).sort(); eq(ru, en);
  ru.forEach(k => ok(String(V.STR.ru[k]).trim() && String(V.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score', 'tapstart'].forEach(k => ok(V.STR.ru[k], 'ключ движка ' + k));
  L.OPS.forEach((op, oi) => { ok(V.STR.ru['op_' + (oi + 1)]); op.missions.forEach((m, mi) => ok(V.STR.ru['m_' + (oi + 1) + '_' + (mi + 1)], 'миссия ' + m.id)); });
  ['hives', 'clear', 'escort', 'hold'].forEach(k => ok(V.STR.ru['o_' + k] && V.STR.ru['os_' + k]));
  for (let r = 0; r <= 5; r++) ok(V.STR.ru['r_' + r]);
  for (let i = 0; i < Camp.NAMES_N; i++) ok(V.STR.ru['n_' + i] && V.STR.en['n_' + i], 'имя ' + i);
  eq(V.STR.ru.title, 'ВЗВОД');
});
test('музыка: трек vzvod разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.vzvod; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas 640×512, скрипты по порядку, тач-кнопки и пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="640" height="512"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/campaign.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ['fire', 'gear', 'rocket', 'split', 'group', 'exit'].forEach(a => ok(html.includes('data-act="' + a + '"'), 'кнопка ' + a));
  ok(/data-pause/.test(html));
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ + оригинал жанра и его авторы)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGNhbm5vbiA/Zm9kZGVyfHNlbnNpYmxlID9zb2Z0fNC6W9GN0LBd0L3QvT/QvtC9ID/RhNC+0LTQtD/QtdGAfNGE0L7QtNC0P9C10YB80YHQtdC90YHQuNCx0Lt8XGJqb29sc1xifNC00LbRg9C70YF80L/Rg9GI0LXRh9C9W9CwLdGP0ZFdKiA/0LzRj9GB', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('Q2Fubm9uIEZvZGRlcg==')) && BAD.test(u('U2Vuc2libGUgU29mdHdhcmU=')) && BAD.test(u('0JrQsNC90L3QvtC9INCk0L7QtNC00LXRgA==')), 'стоп-лист ловит оригинал жанра и авторов (и транслит)');
  ok(!BAD.test('ВЗВОД') && !BAD.test('Гефест') && !BAD.test('болванчик') && !BAD.test('CONTRACT.md') && !BAD.test('пушка') && !BAD.test('ракета'), 'без ложных срабатываний');
});

// ---------- Бот-командир: проходимость и баланс (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без урона проходит каждую из 18 миссий (3 сида) в настоящей физике', () => {
  const bad = [];
  L.OPS.forEach((op, oi) => op.missions.forEach((m, mi) => { for (let s = 1; s <= 3; s++){ const r = playMission(V, oi, mi, s, { invuln: true }); if (!r.won) bad.push(m.id + '/' + s + ':' + (r.reason || 'время')); } }));
  ok(!bad.length, 'не пройдены: ' + bad.join(' '));
});
const N1 = 24, B1 = []; for (let s = 1; s <= N1; s++) B1.push(playMission(V, 0, 0, s));
test('баланс: бот (реакция 150–250 мс, отряд новичков) проходит миссию 1 в ≥ 75% партий, без зависаний', () => {
  const w = B1.filter(r => r.won).length, br = B1.reduce((a, r) => a + r.broken, 0) / N1;
  console.log('     миссия 1-1: ' + w + '/' + N1 + ', сломано в среднем ' + br.toFixed(1) + ' из 4, время побед ' + Math.min(...B1.filter(r => r.won).map(r => r.time)).toFixed(0) + '–' + Math.max(...B1.filter(r => r.won).map(r => r.time)).toFixed(0) + ' с');
  ok(w >= 0.75 * N1, 'слишком сложно: ' + w + '/' + N1); ok(br > 0.2, 'слишком легко: никто не ломается'); ok(!B1.some(r => r.stuck), 'зависание');
});
test('баланс: вся кампания ботом через настоящие правила кампании (ремонт, пополнение, ранги) проходится за разумное число попыток', () => {
  const stats = [];
  for (const cs of [1, 2]){
    const C = Camp.newCampaign(); let att = 0;
    while (!C.done && att < 160){
      Camp.prepare(C); const sq = Camp.squadFor(C), spec = Camp.spec(C);
      ok(sq.length >= 2, 'отряд ≥ 2');
      const r = playMission(V, spec.op, spec.mi, cs * 1000 + att, { squad: sq.map(b => ({ id: b.id, name: 'b' + b.id, rank: b.rank })) });
      Camp.apply(C, r.result || { won: false, score: 0, units: [] }, sq.map(b => b.id)); att++;
    }
    ok(C.done, 'кампания ' + cs + ' не пройдена за ' + att + ' попыток (застряла на ' + Camp.spec(C).id + ')');
    stats.push(att + ' попыток, лучшие ранги ' + C.roster.map(b => b.rank).sort((a, b) => b - a).slice(0, 6).join(''));
  }
  console.log('     кампания ботом: ' + stats.join('; '));
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

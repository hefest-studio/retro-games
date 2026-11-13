/* ДОЗОР · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node dozor/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: этапы и достижимость их конца, езда в 8 сторон, пулемёт только вверх, гранаты/ракеты/самонаводка
   (над стенами, по курсу машины, ступени), бараки и пленные (вместимость 8, площадка, разбегание при гибели,
   мастер → ступень оружия), враги (пехота под колёсами, турели, танки, катера, вертолёты, бронепоезд),
   разрушаемые постройки, крепость-босс и фазы, продолжения, жизни, камера и кооп, i18n, музыка, страница,
   правило имён; баланс и проходимость — «человеческим» ботом (tests/bot.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/game.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const D = sandbox.DOZOR, L = D.logic, T = L.T, C = L.CELL;
const { playDozor, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Пустое поле H строк (края — скалы), старт в строке H−3 по центру. cells: [[col, row, ch]]
function field(h = 40, cells = []){
  const rows = []; for (let r = 0; r < h; r++) rows.push('o' + '.'.repeat(18) + 'o');
  const put = (c, r, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };
  put(9, h - 3, 'S'); cells.forEach(([c, r, ch]) => put(c, r, ch));
  return rows;
}
function setup(map, opts = {}){
  const events = [];
  const game = D.Game(Object.assign({ map, rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S; S.banner = 0; S.heroes.forEach(h => { h.inv = 0; });
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
const cx = c => c * T + T / 2;

// ---------- Этапы и достижимость ----------
test('этапы: 6 штук; в каждом старт, бараки (один меченый), площадка, крепость с пушками; враги всех типов; генератор детерминирован', () => {
  eq(L.STAGES.length, 6);
  const types = new Set(); let helis = 0, rails = 0, water = 0;
  L.STAGES.forEach((M, i) => {
    const n = i + 1, m = L.genStage(n), Lv = L.parseMap(m.rows);
    ok(Lv.start, 'нет старта ' + n); ok(Lv.core, 'нет крепости ' + n);
    ok(Lv.barracks.length >= 2 && Lv.barracks.filter(b => b.flag).length === 1, 'бараки этапа ' + n);
    ok(Lv.pads.length >= 2, 'площадки этапа ' + n);
    eq(Lv.cannons.length, M.cannons.length, 'пушки этапа ' + n);
    ok(m.rows.length > 100, 'этап ' + n + ' короткий: ' + m.rows.length);
    Lv.enemies.forEach(e => types.add(e.type)); helis += Lv.helis.length; rails += Lv.rails.length;
    water += Lv.grid.filter(t => t === C.WATER).length;
    ok(D.STR.ru['s_' + m.name] && D.STR.en['s_' + m.name] && D.STR.ru['b_' + m.boss] && D.STR.en['b_' + m.boss], 'нет названий этапа/крепости ' + n);
  });
  eq([...types].sort(), ['boat', 'infantry', 'tank', 'turret']);
  ok(helis >= 3 && rails >= 5 && water > 100, 'вертолёты/рельсы/реки: ' + [helis, rails, water]);
  eq(JSON.stringify(L.genStage(3)), JSON.stringify(L.genStage(3)), 'генератор детерминирован');
  ok(new Set([1, 2, 3, 4, 5, 6].map(n => L.genStage(n).rows.join(''))).size === 6, 'этапы различаются');
  let err = null; try { L.parseMap(field(10).map((r, i) => i === 5 ? r.slice(1) : r)); } catch (e) { err = e; } ok(err, 'рваная строка — ошибка');
  err = null; try { L.parseMap(field(10, [[5, 5, 'Ж']])); } catch (e) { err = e; } ok(err, 'неизвестный символ — ошибка');
});
test('достижимость: из старта каждого этапа машина доезжает до арены крепости; все бараки и площадки доступны', () => {
  for (let n = 1; n <= 6; n++){ const r = L.solveMap(L.genStage(n).rows); ok(r.ok, 'этап ' + n + ' обрывается на строке ' + r.top); ok(r.pads && r.barracks, 'этап ' + n + ': площадка/барак отрезаны'); }
  const wall = field(40); wall[20] = 'o' + '#'.repeat(18) + 'o'; ok(!L.solveMap(wall).ok, 'сплошная стена — тупик');
  const river = field(40); river[20] = '~'.repeat(20); ok(!L.solveMap(river).ok, 'река без моста — тупик');
  const trees = field(40); trees[20] = 'o' + 't'.repeat(18) + 'o'; ok(L.solveMap(trees).ok, 'лес пробивается гранатами');
});

// ---------- Машина и оружие ----------
test('езда: 8 направлений, по диагонали не быстрее; стены, вода и скалы держат; мост проходим', () => {
  const { game, S } = setup(field(40, [[9, 30, '#'], [10, 30, '#']]));
  const h = S.heroes[0], x0 = h.x, y0 = h.y;
  game.setDir(0, 1, 0); run(game, 0.5); near(h.x - x0, L.SPEED * 0.5, 2, 'вправо');
  game.setDir(0, 1, 1); const x1 = h.x, y1 = h.y; run(game, 0.2); near(Math.hypot(h.x - x1, h.y - y1), L.SPEED * 0.2, 2, 'диагональ');
  h.x = cx(9) + 4; h.y = cx(33); game.setDir(0, 0, -1); run(game, 1.5); ok(h.y > 31 * T, 'проехал сквозь стену');
  const w = setup(field(40, Array.from({ length: 18 }, (_, k) => [k + 1, 30, k === 9 ? '=' : '~'])));
  const g = w.S.heroes[0]; g.x = cx(4); g.y = cx(32); w.game.setDir(0, 0, -1); run(w.game, 1.5); ok(g.y > 31 * T - 2, 'заехал в воду');
  g.x = cx(10); w.game.setDir(0, 0, -1); run(w.game, 1.5); ok(g.y < 30 * T, 'мост не пустил');
});
test('пулемёт: стреляет всегда вверх (куда бы ни смотрела машина), держи — очередь; стена гасит пули', () => {
  const { game, S } = setup(field(40, [[5, 30, '#']]));
  const h = S.heroes[0];
  game.setDir(0, 1, 1); game.update(1 / 60); game.setDir(0, 0, 0);
  ok(h.face.x > 0 && h.face.y > 0, 'машина развернулась вниз-вправо');
  game.setFire(0, true); run(game, 0.6); game.setFire(0, false);
  ok(S.bullets.length >= 4, 'очередь: ' + S.bullets.length); ok(S.bullets.every(b => b.vy < 0), 'пули не вверх');
  S.bullets = []; h.x = cx(5); h.y = cx(33); game.setFire(0, true); run(game, 0.12); game.setFire(0, false); run(game, 0.4);
  eq(S.bullets.length, 0, 'пули прошли стену');
});
test('гранаты: летят по курсу машины, перелетают стену, рвутся в конце полёта; не больше 2 в воздухе', () => {
  const { game, S, has } = setup(field(40, [[9, 31, '#'], [10, 31, '#'], [8, 31, '#']]));
  const h = S.heroes[0]; h.x = cx(9) + T / 2; h.y = cx(33);
  game.setDir(0, 0, -1); game.update(1 / 60); game.setDir(0, 0, 0);
  const e = game._spawn('infantry', h.x, h.y - L.SEC[1].range - 12); e.active = true; e.cd = 99;
  ok(game.sec(0), 'не бросил'); h.scd = 0; ok(game.sec(0), 'вторая'); h.scd = 0; ok(!game.sec(0), 'третья в воздухе');
  run(game, 1); ok(has('boom'), 'нет взрыва'); ok(e.dead, 'пехота за стеной не задета');
  // по курсу: вправо
  game.setDir(0, 1, 0); game.update(1 / 60); game.setDir(0, 0, 0); h.scd = 0; S.shots = [];
  game.sec(0); ok(S.shots[0].vx > 0 && S.shots[0].vy === 0, 'граната не вправо');
});
test('ракеты и самонаводка: 2-я ступень рвётся о цель раньше дальности, 3-я доворачивает на цель; вертолёт гранатой не взять', () => {
  const { game, S } = setup(field(40));
  const h = S.heroes[0]; h.tier = 2;
  const e = game._spawn('tank', h.x, h.y - 80); e.active = true; e.cd = 99; const hp = e.hp;
  game.sec(0); run(game, 0.4); ok(e.hp < hp, 'ракета не попала в танк');
  e.dead = true; h.tier = 3; h.scd = 0; S.shots = [];
  const t2 = game._spawn('turret', h.x + 110, h.y - 120); t2.active = true; t2.cd = 99; const hp2 = t2.hp;
  game.sec(0); run(game, 0.9); ok(t2.hp < hp2, 'самонаводка не довернула');
  t2.dead = true; h.tier = 1; h.scd = 0; S.shots = [];
  const hl = game._spawn('heli', h.x, h.y - L.SEC[1].range); hl.active = true; hl.hover = 0; hl.cd = 99; const hp3 = hl.hp;
  game._blast(hl.x, hl.y, 30, 3, { air: false, pi: 0 }); eq(hl.hp, hp3, 'граната задела вертолёт');
  game._blast(hl.x, hl.y, 30, 3, { air: true, pi: 0 }); ok(hl.hp < hp3, 'ракета не задела вертолёт');
});
test('разрушаемое: дома, деревья и мешки — гранатами (пулемёт их не берёт), скалы и бетон — нет', () => {
  const { game, S, has } = setup(field(40, [[5, 20, 'X'], [6, 20, 't'], [7, 20, 's'], [8, 20, 'o'], [9, 20, '#']]));
  const i = c => 20 * L.COLS + c;
  S.bullets.push({ x: cx(5), y: cx(21), vy: -400, pi: 0 }); run(game, 0.2); eq(S.grid[i(5)], C.BLD, 'пулемёт снёс дом');
  for (let k = 0; k < 3; k++) game._blast(cx(6), cx(20), 30, 3, { pi: 0 });
  eq([S.grid[i(5)], S.grid[i(6)], S.grid[i(7)], S.grid[i(8)], S.grid[i(9)]], [C.RUBBLE, C.RUBBLE, C.RUBBLE, C.ROCK, C.WALL]);
  ok(has('block'));
});

// ---------- Пленные ----------
test('бараки: пулемёт не ломает, гранаты — да; выходят пленные, подбор +очки; мастер из меченого барака поднимает ступень оружия', () => {
  const { game, S, has, count } = setup(field(40, [[8, 20, 'F'], [9, 20, 'h'], [8, 21, 'h'], [9, 21, 'h']]));
  const b = S.barracks[0], h = S.heroes[0];
  ok(b.flag && !game._boxFree(b.x, b.y, 4), 'барак не стоит');
  S.bullets.push({ x: b.x, y: b.y + 30, vy: -400, pi: 0 }); run(game, 0.2); eq(b.hp, b.max, 'пулемёт поцарапал барак');
  while (!b.dead) game._blast(b.x, b.y, 30, 3, { pi: 0 });
  ok(has('barracks') && S.pows.length === b.pows && S.pows.filter(p => p.master).length === 1, 'пленные не вышли');
  ok(game._boxFree(b.x, b.y, 8), 'руины не проходимы');
  h.x = b.x; h.y = b.y + 60; run(game, 3);
  eq(S.pows.length, 0, 'не все подобраны'); eq(h.carried, b.pows); eq(h.tier, 2, 'мастер не поднял ступень'); ok(has('upgrade'));
  eq(count('pow'), b.pows);
});
test('вместимость 8; на площадке высадка по одному (+1000 каждый), счётчик «спасено»', () => {
  const { game, S, count } = setup(field(40, [[8, 10, 'P'], [9, 10, 'p'], [10, 10, 'p'], [8, 11, 'p'], [9, 11, 'p'], [10, 11, 'p'], [8, 12, 'p'], [9, 12, 'p'], [10, 12, 'p']]));
  const h = S.heroes[0]; h.x = cx(4); h.y = cx(30);
  for (let k = 0; k < 11; k++) S.pows.push({ x: h.x + (k % 3) * 3, y: h.y - 4, vx: 0, vy: 0, gone: false, master: false, t: 0, wander: 0 });
  run(game, 0.5); eq(h.carried, L.CAPACITY, 'вместимость'); eq(S.pows.length, 3, 'лишние остались на земле');
  const s0 = S.score; h.x = S.pads[0].x; h.y = S.pads[0].y; S.camY = h.y - 300; S.pows = [];
  run(game, 2.6); eq(h.carried, 0); eq(S.rescued, 8); eq(count('deliver'), 8); ok(S.score - s0 >= 8 * L.SCORE.deliver, 'очки за спасённых');
  ok(S.pads[0].heliT > 0, 'вертолёт «Гефеста» не прилетел');
});
test('гибель: пленные разбегаются и их можно подобрать снова; ступень оружия падает; −жизнь, возрождение с неуязвимостью', () => {
  const { game, S, has } = setup(field(40));
  const h = S.heroes[0]; h.carried = 5; h.tier = 3; const lives = h.lives;
  game._kill(h, 'test');
  ok(!h.alive && has('scatter') && S.pows.length === 5, 'пленные не разбежались'); eq(h.carried, 0); eq(h.tier, 2); eq(h.lives, lives - 1);
  run(game, L.CONTINUES ? 1.7 : 0); ok(h.alive && h.inv > 0, 'не возродился');
  run(game, 4); ok(h.carried > 0, 'разбежавшихся не подобрать');
});
test('пленный, оставшийся за нижним краем кадра, отстаёт (потерян)', () => {
  const { game, S, has } = setup(field(80));
  S.pows.push({ x: 40, y: S.camY + 560, vx: 0, vy: 0, gone: false, master: false, t: 0, wander: 0 });
  const h = S.heroes[0]; h.x = 400; game.setDir(0, 0, -1); run(game, 5);
  ok(has('powLost') && S.lost === 1, 'не потерян');
});

// ---------- Враги ----------
test('пехота: под колёсами гибнет; стреляет после вспышки-предупреждения; вплотную не стреляет', () => {
  const { game, S, has, count } = setup(field(40));
  const h = S.heroes[0];
  const e = game._spawn('infantry', h.x + 12, h.y - 6); e.active = true; game.update(1 / 60); ok(e.dead && has('kill'), 'не раздавлен');
  const f = game._spawn('infantry', h.x, h.y - 200); f.active = true; f.cd = 0.01; f.dirT = 99; f.vx = f.vy = 0;
  run(game, 0.2); ok(f.warn > 0 && S.ebullets.length === 0, 'нет предупреждения'); run(game, 0.4); ok(count('eshot') === 1, 'не выстрелил');
  const g2 = game._spawn('infantry', h.x + 40, h.y); g2.active = true; g2.cd = 0.01; g2.dirT = 99; g2.vx = g2.vy = 0; S.ebullets = [];
  run(game, 0.3); ok(!(g2.warn > 0), 'стреляет в упор');
});
test('турель — очередь по одной точке; танк и турель твёрдые (выталкивают); катер ходит только по воде', () => {
  const { game, S, count } = setup(field(40, Array.from({ length: 20 }, (_, k) => [k, 10, '~'])));
  const h = S.heroes[0];
  const t = game._spawn('turret', h.x, h.y - 150); t.active = true; t.cd = 0.01; S.ebullets = [];
  run(game, 1.0); ok(count('eshot') >= 2, 'очередь');
  const tk = game._spawn('tank', h.x, h.y - 30); tk.active = true; tk.cd = 99; game.setDir(0, 0, -1); run(game, 0.6); game.setDir(0, 0, 0);
  ok(Math.hypot(tk.x - h.x, tk.y - h.y) >= tk.r + L.HB - 1, 'проехал сквозь танк');
  const b = game._spawn('boat', 200, cx(10)); b.active = true; b.cd = 99; S.camY = cx(10) - 300;
  for (let k = 0; k < 600; k++){ game.update(1 / 60); ok(game._cell(b.x, b.y) === C.WATER, 'катер на суше'); }
});
test('вертолёт: вылетает по метке, зависает в кадре, пулемёт его берёт; улетает сам', () => {
  const { game, S, has } = setup(field(100, [[10, 60, 'g']]));
  const h = S.heroes[0]; game.setDir(0, 0, -1); run(game, 8.5); game.setDir(0, 0, 0);
  ok(has('heli'), 'не вылетел'); const e = S.enemies.find(x => x.type === 'heli'); ok(e && e.y > S.camY && e.y < S.camY + 300, 'не в кадре');
  const hp = e.hp; S.bullets.push({ x: e.x, y: e.y + 20, vy: -400, pi: 0 }); run(game, 0.1); ok(e.hp < hp, 'пулемёт не берёт');
  e.cd = 99; e.warn = 0; h.inv = 99; run(game, 14); ok(e.dead, 'не улетел');
});
test('бронепоезд: гудок и сигнал, затем проход; касание — гибель; вагоны разрушаемы; ушёл — возвращается', () => {
  const { game, S, has } = setup(field(60, Array.from({ length: 20 }, (_, k) => [k, 40, 'r'])));
  const tr = S.trains[0]; ok(tr, 'рельсы не распознаны');
  const h = S.heroes[0]; h.y = tr.y + 120; S.camY = tr.y - 300;
  run(game, 0.2); eq(tr.state, 'warn'); ok(has('trainWarn'));
  run(game, 1.5); eq(tr.state, 'run'); ok(tr.cars.length >= 3);
  h.x = 240; h.y = tr.y; h.inv = 0; run(game, 4); ok(has('heroDie') && S.heroes[0].lives === L.LIVES - 1, 'поезд не сбил');
  h.inv = 99; S.camY = tr.y - 300;
  const car = tr.cars.find(c => !c.dead && c.x > 0 && c.x < 480) || tr.cars[0];
  while (!car.dead) game._blast(car.x, tr.y, 30, 4, { pi: 0 }); ok(has('kill'));
  run(game, 12); ok(tr.runs >= 1 || tr.done, 'не вернулся');
});

// ---------- Крепость, итог, продолжения ----------
test('крепость: просыпается у верха карты, ядро — только гранатами/ракетами (пулемёт держит стена), фазы, пушки на стене; пала — итог этапа и следующий', () => {
  const { game, S, has } = setup(null, { stage: 1, maxStage: 2 });
  const B = S.boss; ok(B && !B.active);
  S.heroes[0].x = B.x; S.heroes[0].y = B.y1 + 120; S.camY = 0; S.heroes[0].inv = 999;
  game.update(1 / 60); ok(B.active && has('bossIntro'), 'не проснулась');
  run(game, 1.7);
  const hp0 = B.hp; S.bullets.push({ x: B.x, y: B.y1 + 40, vy: -400, pi: 0 }); run(game, 0.2); eq(B.hp, hp0, 'пулемёт пробил стену крепости'); eq(S.bullets.length, 0);
  game._blast(B.x, B.y1 - 10, 30, 3, { pi: 0 }); ok(B.hp < hp0, 'граната по ядру');
  ok(S.enemies.filter(e => e.type === 'cannon').length === L.STAGES[0].cannons.length, 'пушки');
  let phases = 0; while (!B.dead){ B.shift = 0; game._hurtBoss(5); if (has('phase')) phases = 1; }
  ok(phases && has('bossDie'), 'нет фаз/гибели'); run(game, 2.4); eq(S.phase, 'clear'); ok(has('clear'));
  run(game, 4); eq(S.stage, 2, 'не перешли на этап 2'); ok(has('stage'));
});
test('итог этапа: пленные на борту засчитываются; последний этап — победа', () => {
  const { game, S, has } = setup(null, { stage: 6, maxStage: 6 });
  S.heroes[0].carried = 3; game._clear(); eq(S.rescued, 3); eq(S.heroes[0].carried, 0);
  run(game, 4); ok(has('win') && S.won, 'нет победы');
});
test('продолжения: все выбыли — «Продолжить?» 10 с; cont() — снова 3 жизни; без ответа или без продолжений — конец', () => {
  const a = setup(field(40)); const h = a.S.heroes[0];
  for (let k = 0; k < L.LIVES; k++){ h.inv = 0; h.alive = true; a.game._kill(h, 'test'); }
  eq(a.S.phase, 'cont'); ok(a.has('contAsk'));
  ok(a.game.cont(), 'не продолжили'); eq(a.S.phase, 'play'); eq(h.lives, L.LIVES); ok(h.alive); eq(a.S.continues, L.CONTINUES - 1);
  for (let k = 0; k < L.LIVES; k++){ h.inv = 0; h.alive = true; a.game._kill(h, 'test'); }
  run(a.game, L.CONT_T + 2); ok(a.has('gameover'), 'без ответа — конец');
  const b = setup(field(40), { continues: 0 }); const g = b.S.heroes[0];
  for (let k = 0; k < L.LIVES; k++){ g.inv = 0; g.alive = true; b.game._kill(g, 'test'); }
  eq(b.S.phase, 'over'); run(b.game, 2); ok(b.has('gameover'));
});
test('жизни: +1 каждые 27000 очков; миномёт крепости бьёт по метке', () => {
  const { game, S, has } = setup(field(40)); const h = S.heroes[0], l0 = h.lives;
  S.score = L.EXTRA_LIFE - 50; game._kill; S.enemies = []; const e = game._spawn('infantry', h.x + 12, h.y); e.active = true; game.update(1 / 60);
  eq(h.lives, l0 + 1); ok(has('extraLife'));
  S.marks.push({ x: h.x, y: h.y, t: 0.1, max: 1.3 }); run(game, 0.2); ok(has('heroDie'), 'метка не взорвалась');
});

// ---------- Камера и кооп ----------
test('камера: едет только вверх; машина не уходит за нижний край', () => {
  const { game, S } = setup(field(120)); const h = S.heroes[0];
  game.setDir(0, 0, -1); run(game, 4); const c1 = S.camY; ok(c1 < (120 * T - L.VIEW_H) - 100, 'камера стоит');
  game.setDir(0, 0, 1); run(game, 4); eq(S.camY, c1, 'камера поехала назад'); ok(h.y <= S.camY + L.VIEW_H - 15, 'ушёл за край');
});
test('кооп: ввод игроков независим; камера держит обоих (нижний не теряется), раздельные жизни', () => {
  const { game, S } = setup(field(120), { players: 2 });
  const [a, b] = S.heroes; const bx = b.x, by = b.y;
  game.setDir(0, 0, -1); game.setFire(0, true); run(game, 3); game.setFire(0, false);
  eq([b.x, b.y], [bx, by], 'И2 сдвинулся от ввода И1'); ok(S.bullets.every(x => x.pi === 0));
  ok(b.y <= S.camY + L.VIEW_H - 15 && a.y >= S.camY + 15, 'кто-то вне кадра'); ok(a.y > S.camY + 10, 'И1 вылез вверх');
  game.setDir(1, 1, 0); run(game, 0.5); ok(b.x > bx + 30, 'И2 не поехал');
  b.inv = 0; game._kill(b, 'test'); ok(a.alive && b.lives === L.LIVES - 1 && a.lives === L.LIVES, 'жизни общие');
  b.scd = 0; run(game, 2); ok(b.alive, 'И2 не возродился'); ok(Math.abs(b.x - a.x) < 120, 'возродился не рядом с напарником');
  b.scd = 0; game.sec(1); ok(S.shots.length === 1 && S.shots[0].pi === 1);
});
test('кооп: ввод движка по игрокам — раскладки без конфликтов, И1 стрелки / И2 WASD, огонь/граната по игрокам, в одиночке обе ведут И1', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), Lst = {};
  let t = 1000;
  const win = { Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (Lst[ev] = Lst[ev] || []).push(fn); }, removeEventListener() {}, setInterval() { return 1; }, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => t }, matchMedia: () => ({ matches: false }) };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {} }; win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(src, win, { filename: 'engine.js' });
  const A = win.Arcade;
  eq(A.checkBindings(L.BIND, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }).length, 0, 'конфликты раскладки');
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'dz' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  g.usePlayers({ bind: L.BIND, actions: ['fire', 'sec'] });
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'KeyW'); key('keydown', 'KeyF');
  ok(P2.pressed('up') && P2.pressed('fire') && !P1.pressed('up') && !P1.pressed('fire'), 'WASD/F ушли не тому');
  key('keydown', 'ArrowLeft'); key('keydown', 'Space'); key('keydown', 'Period'); key('keydown', 'KeyG');
  ok(P1.pressed('left') && P1.pressed('fire') && !P2.pressed('left'), 'стрелки ушли не тому');
  eq(got, ['2fire', '1fire', '1sec', '2sec'], 'нажатия по игрокам');
  ['KeyW', 'KeyF', 'ArrowLeft', 'Space', 'Period', 'KeyG'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyD'); key('keydown', 'KeyX');
  ok(P1.pressed('right') && P1.pressed('fire') && !P2.pressed('right'), 'в одиночке WASD/X не ведут И1');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть оружие, этапы, крепости, герои', () => {
  const ru = Object.keys(D.STR.ru).sort(), en = Object.keys(D.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(D.STR.ru[k]).trim() && String(D.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(D.STR.ru[k], 'нет ключа движка ' + k));
  [1, 2, 3].forEach(n => ok(D.STR.ru['w_' + n] && D.STR.en['w_' + n], 'оружие ' + n));
  eq(D.STR.ru.title, 'ДОЗОР');
});
test('музыка: трек dozor разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.dozor; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas, скрипты по порядку, тач-кнопки огня/гранаты/паузы; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="480" height="640"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ok(/data-sec/.test(html) && /data-pause/.test(html) && /data-d="A"/.test(html), 'тач-кнопки');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ + оригинал жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGphY2thbHzQtNC2W9C10Y3QsF3QutCw0Lt8dG9wID9ndW5uZXJ8ZmluYWwgP2NvbW1hbmQ=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('amFja2Fs')) && BAD.test(u('0JTQttC10LrQsNC7')), 'стоп-лист ловит оригинал жанра');
  ok(!BAD.test('ДОЗОР') && !BAD.test('Гефест') && !BAD.test('декаль') && !BAD.test('CONTRACT.md') && !BAD.test('бронепоезд'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
// Исполнимость в настоящей физике: неуязвимый бот проходит каждый этап от старта до крепости и ломает её.
const EXE = []; for (let s = 1; s <= 6; s++) EXE.push(playDozor(D, s, { startStage: s, stages: 1, invuln: true }));
test('исполнимость: каждый из 6 этапов проходится до конца (бот без урона, настоящая физика)', () => {
  console.log('     время, с: ' + EXE.map((r, i) => (i + 1) + ':' + r.time.toFixed(0)).join(' '));
  EXE.forEach((r, i) => ok(r.won && !r.stuck, 'этап ' + (i + 1) + ' не пройден'));
});
// «Человеческий» бот: реакция 150–250 мс, видит только кадр, пули замечает не сразу (зевок 42% на взгляд).
const NB = 40, BAL = []; for (let s = 1; s <= NB; s++) BAL.push(playDozor(D, s));
const reach = {}; BAL.forEach(r => { reach[r.passed] = (reach[r.passed] || 0) + 1; });
const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
console.log('     бот (1 игрок, ' + NB + ' партий): этап 1 — ' + BAL.filter(r => r.passed >= 1).length + '/' + NB + ', вся игра — ' + BAL.filter(r => r.won).length + '/' + NB + ', пройдено этапов → партий: ' + JSON.stringify(reach) + '; гибели: ' + JSON.stringify(why));
const first = BAL.filter(r => r.clears.length && r.clears[0].stage === 1 && r.conts === 0 || r.passed >= 1).length;
test('баланс: этап 1 проходят ≥ 90% партий бота', () => ok(BAL.filter(r => r.passed >= 1).length >= 0.9 * NB, 'этап 1: ' + BAL.filter(r => r.passed >= 1).length + '/' + NB));
test('баланс: всю игру (6 этапов, 3 жизни + 2 продолжения) проходят ~20–50%', () => { const w = BAL.filter(r => r.won).length / NB; ok(w >= 0.2 && w <= 0.5, 'вся игра: ' + w); });
test('баланс: бот нигде не застревает (тайм-аут этапа 420 с)', () => eq(BAL.filter(r => r.stuck).map(r => r.seed), []));
const CO = []; for (let s = 1; s <= 12; s++) CO.push(playDozor(D, s, { players: 2 }));
const cw = CO.filter(r => r.won).length / CO.length;
console.log('     бот (кооп, 12 партий): этап 1 — ' + CO.filter(r => r.passed >= 1).length + '/12, вся игра — ' + CO.filter(r => r.won).length + '/12, спасено в среднем ' + (CO.reduce((a, r) => a + r.rescued, 0) / 12).toFixed(0));
test('кооп-партия: этап 1 — все, всю игру — не «на халяву» (≤ 85%), не застревает', () => { ok(CO.every(r => r.passed >= 1), 'кооп падает на 1-м'); ok(cw <= 0.85, 'кооп слишком лёгок: ' + cw); ok(!CO.some(r => r.stuck), 'зависание'); });

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

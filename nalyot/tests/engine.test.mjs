/* НАЛЁТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node nalyot/tests/engine.test.mjs. Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: миссии и проходимость, стрельба в 8 направлениях, ближний удар, гранаты, оружие-подборы
   и патроны, пленники, «Котёл» (посадка/огонь/высадка/взрыв), разрушаемые укрытия и постройки, враги,
   «фартук» и жизни, ямы, кооп (ввод, поводок, камера держит обоих, выбывание), 6 боссов и их фазы,
   победа/поражение, i18n, музыка, правило имён; баланс и проходимость — «человеческим» ботом. */
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
const N = sandbox.NALYOT, L = N.logic, T = L.T, ROWS = L.ROWS;
const { playNalyot, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Ровная площадка W клеток: земля 3 клетки (верх — строка GR), старт в колонке 3. cells: [[col, row, ch]]
const GR = ROWS - 3, FLOOR = GR * T;
function flat(w, cells = [], sx = 3){
  const rows = []; for (let r = 0; r < ROWS; r++) rows.push((r >= GR ? '#' : '.').repeat(w));
  const put = (c, r, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };
  put(sx, GR - 1, 'S'); cells.forEach(([c, r, ch]) => put(c, r, ch));
  return rows;
}
function setup(map, opts = {}){
  const events = [];
  const game = N.Game(Object.assign({ map, rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S; S.banner = 0;
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
const col = c => c * T + T / 2;

// ---------- Миссии и проходимость ----------
test('миссии: 6 штук, каждая со стартом, ареной босса, пленниками, оружием, укрытиями; «Котёл» — со 2-й; враги всех типов', () => {
  eq(L.MISSIONS.length, 6);
  const types = new Set();
  L.MISSIONS.forEach((M, i) => {
    const n = i + 1, m = L.genMission(n), Lv = L.parseMap(m.rows);
    eq(m.rows.length, ROWS); ok(m.arena > 100 && m.arena < Lv.W - 30, 'арена ' + n);
    ok(L.BOSSES[m.boss], 'босс миссии ' + n);
    ok(Lv.hostages.length >= 3, 'пленников < 3 в миссии ' + n);
    ok(Lv.pickups.some(p => p.kind === 'w'), 'нет оружия в миссии ' + n);
    ok(Lv.blocks.some(b => b.kind === 'crate') && Lv.blocks.some(b => b.kind === 'bldg'), 'нет укрытий/построек в миссии ' + n);
    eq(Lv.vehicles.length, n >= 2 ? 1 : 0, '«Котёл» в миссии ' + n);
    Lv.enemies.forEach(e => types.add(e.type));
    for (let c = m.arena; c < Lv.W; c++) ok(Lv.grid[(ROWS - 3) * Lv.W + c] === 1 && Lv.grid[(ROWS - 4) * Lv.W + c] === 0, 'арена неровная, миссия ' + n);
    ok(N.STR.ru['m_' + m.name] && N.STR.en['m_' + m.name] && N.STR.ru['b_' + m.boss] && N.STR.en['b_' + m.boss], 'нет названий миссии/босса ' + n);
  });
  eq([...types].sort(), ['bomber', 'drone', 'raider', 'turret', 'wagon']);
  eq(JSON.stringify(L.genMission(3)), JSON.stringify(L.genMission(3)), 'генератор детерминирован');
  ok(new Set(L.MISSIONS.map((M, i) => L.genMission(i + 1).rows.join(''))).size === 6, 'миссии различаются');
  let err = null; try { L.parseMap(flat(10).map((r, i) => i === 5 ? r.slice(1) : r)); } catch (e) { err = e; } ok(err, 'рваная строка — ошибка');
  err = null; try { L.parseMap(flat(10, [[5, 5, 'Ж']])); } catch (e) { err = e; } ok(err, 'неизвестный символ — ошибка');
});
test('проходимость: в каждой миссии до арены босса можно дойти прыжками (ямы ≤ 3 клеток, ступени ≤ 2, мосты-платформы)', () => {
  for (let n = 1; n <= 6; n++){ const m = L.genMission(n), r = L.solveMap(m.rows, m.arena); ok(r.ok, 'миссия ' + n + ' обрывается на колонке ' + r.far); }
  const bad = flat(60); for (let r = GR; r < ROWS; r++) bad[r] = bad[r].slice(0, 20) + '.'.repeat(8) + bad[r].slice(28);
  ok(!L.solveMap(bad, 50).ok, 'яма в 8 клеток — тупик');
  const wall = flat(60, Array.from({ length: 6 }, (_, k) => [25, GR - 1 - k, '#'])); ok(!L.solveMap(wall, 50).ok, 'стена в 6 клеток — тупик');
});

// ---------- Движение и стрельба ----------
test('бег и прыжок: прыжок выше 4 клеток, буфер прыжка (нажал до приземления — прыгнет), стена держит', () => {
  const { game, S } = setup(flat(40, [[12, GR - 1, '#'], [12, GR - 2, '#'], [12, GR - 3, '#'], [12, GR - 4, '#'], [12, GR - 5, '#'], [12, GR - 6, '#']]));
  const h = S.heroes[0], y0 = h.y; let top = y0;
  game.jump(0); run(game, 0.5, () => { top = Math.min(top, h.y); });
  ok(y0 - top > 4 * T && y0 - top < 5 * T, 'высота прыжка ' + (y0 - top));
  run(game, 0.3); ok(h.onGround, 'не приземлился');
  game.jump(0); run(game, 0.6); game.jump(0); let air = 0; run(game, 0.5, () => { if (!h.onGround) air++; });
  ok(air > 15, 'буферный прыжок не сработал');
  game.setDir(0, 1, 0); run(game, 3); ok(h.x < 12 * T, 'прошёл сквозь стену'); ok(h.x > 11 * T, 'не дошёл до стены');
});
test('стрельба в 8 направлениях: в прыжке — все 8; на земле — вверх, диагонали, присед (низко и горизонтально)', () => {
  const { game, S } = setup(flat(60, [], 20));
  const h = S.heroes[0], dirs = new Set();
  const fireOnce = () => { h.cd = 0; game.setFire(0, true); game.update(1 / 60); game.setFire(0, false); const b = S.bullets[S.bullets.length - 1]; return b ? Math.round(Math.atan2(b.vy, b.vx) / (Math.PI / 4)) : null; };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]){
    h.y = 150; h.vy = -200; h.onGround = false; S.bullets = [];
    game.setDir(0, dx, dy); const a = fireOnce(); ok(a !== null, 'нет выстрела ' + dx + ',' + dy); dirs.add((a + 8) % 8);
    run(game, 1.2);
  }
  eq(dirs.size, 8, 'направлений');
  // на земле
  game.setDir(0, 0, 0); run(game, 1); ok(h.onGround);
  game.setDir(0, 0, -1); S.bullets = []; let a = fireOnce(); eq(a, -2, 'вверх');
  game.setDir(0, 1, 1); S.bullets = []; a = fireOnce(); eq(a, 1, 'вниз-вправо на бегу');
  game.setDir(0, 0, 1); game.update(1 / 60); ok(h.crouch && h.hh === L.CROUCH_H, 'не присел');
  const x0 = h.x; S.bullets = []; a = fireOnce(); eq(a, 0, 'из приседа — горизонтально');
  ok(S.bullets[0].y > h.y - 14, 'из приседа — низко'); run(game, 0.3); near(h.x, x0, 0.01, 'в приседе не идёт');
});
test('ближний удар: враг вплотную — удар ключом (урон 4, без пули), чуть дальше — выстрел', () => {
  const { game, S, has, last } = setup(flat(40, [], 5));
  const h = S.heroes[0]; S.enemies = [];
  const e = game._spawn('turret', h.x + 22, h.y); e.active = true; e.hp = 6;
  h.face = 1; h.cd = 0; game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  ok(has('melee'), 'нет удара'); eq(S.bullets.length, 0, 'вылетела пуля'); near(e.hp, 2, 1e-9, 'урон удара');
  e.x = h.x + 120; h.cd = 0; game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  eq(S.bullets.length, 1, 'дальше — выстрел');
});
test('гранаты: ограничены, летят дугой, взрыв бьёт врагов по радиусу и ломает ящик; без гранат — не бросить', () => {
  const { game, S, has, count } = setup(flat(40, [[13, GR - 1, 'C']], 5));
  const h = S.heroes[0]; S.enemies = [];
  const near1 = game._spawn('raider', col(12), FLOOR), far1 = game._spawn('raider', col(30), FLOOR);
  near1.active = far1.active = true; near1.cd = far1.cd = 99;
  eq(h.grenades, L.GREN0);
  ok(game.grenade(0), 'не бросил'); eq(h.grenades, L.GREN0 - 1);
  const g0 = S.grenades[0]; ok(g0 && g0.vy < 0, 'граната не вверх-вперёд');
  run(game, 1.6);
  ok(has('boom') && near1.dead, 'ближний мародёр не погиб'); ok(!far1.dead, 'дальний задет');
  const crate = S.blocks[0]; ok(crate.hp < crate.max, 'ящик не задет');
  h.grenades = 0; ok(!game.grenade(0), 'бросил без гранат'); eq(count('grenade'), 1);
});
test('оружие-подборы: у каждого свои патроны и характер; кончились — возврат к клепальнику; тот же — патроны складываются', () => {
  const { game, S, has } = setup(flat(60, [], 5));
  const h = S.heroes[0]; S.enemies = [];
  for (const w of L.WEAPON_KEYS){
    S.pickups = []; game._pickup('w', w, h.x, h.y); game.update(1 / 60);
    eq(h.weapon, w, 'не взял ' + w); eq(h.ammo, L.WEAPONS[w].ammo);
    S.bullets = []; h.cd = 0; game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
    eq(S.bullets.length, L.WEAPONS[w].pellets || 1, 'дробь ' + w); eq(h.ammo, L.WEAPONS[w].ammo - 1);
    if (w === 'spark') ok(S.bullets[0].pierce && S.bullets[0].dmg === 3, 'искровик пробивает');
    if (w === 'torch') ok(S.bullets[0].life < 0.5, 'паяльник — короткая струя');
  }
  game._pickup('w', 'scoop', h.x, h.y); game.update(1 / 60); eq(h.ammo, 2 * L.WEAPONS.scoop.ammo - 1, 'патроны не сложились');
  h.ammo = 1; h.cd = 0; game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  eq(h.weapon, 'rivet'); ok(has('weaponOut'));
  const g0 = h.grenades; game._pickup('gren', null, h.x, h.y); game.update(1 / 60); eq(h.grenades, g0 + 5);
  h.grenades = L.GREN_MAX - 1; game._pickup('gren', null, h.x, h.y); game.update(1 / 60); eq(h.grenades, L.GREN_MAX, 'потолок гранат');
  const l0 = h.lives; game._pickup('life', null, h.x, h.y); game.update(1 / 60); eq(h.lives, l0 + 1);
  const s0 = S.score; game._pickup('medal', null, h.x, h.y); game.update(1 / 60); eq(S.score, s0 + L.SCORE.medal);
});
test('пленники: касание или пуля освобождают; выпадает бонус, очки; бонусы миссий — оружие/гранаты/жизнь', () => {
  const { game, S, has, count } = setup(flat(60, [[9, GR - 1, 'h'], [30, GR - 1, 'h']], 5));
  const h = S.heroes[0];
  game.setDir(0, 1, 0); run(game, 1.6); game.setDir(0, 0, 0);
  ok(S.hostages[0].freed && has('rescue'), 'касание не освободило'); eq(S.rescued, 1);
  ok(S.score >= L.SCORE.hostage, 'нет очков');
  run(game, 1); ok(count('pickup') >= 1, 'бонус не подобран');
  h.x = col(14); h.face = 1; h.cd = 0; game.setFire(0, true); run(game, 2); game.setFire(0, false);
  ok(S.hostages[1].freed, 'пуля не освободила');
  const bon = []; for (let m = 1; m <= 6; m++){ const g2 = N.Game({ mission: m, rng: mulberry32(1) }).start(); g2._S.hostages.forEach(hs => bon.push(hs.bonus)); }
  ok(bon.some(b => b.startsWith('w:')) && bon.includes('gren') && bon.includes('life'), 'набор бонусов: ' + [...new Set(bon)]);
});

// ---------- «Котёл» ----------
test('«Котёл»: посадка (вниз), своя пушка и снаряд (гранаты не тратит), давит мародёров, высадка — вниз+прыжок', () => {
  const { game, S, has } = setup(flat(60, [[8, GR - 1, 'k']], 5));
  const h = S.heroes[0], v = S.vehicles[0]; S.enemies = [];
  game.setDir(0, 1, 0); run(game, 0.6); game.setDir(0, 0, 1); run(game, 0.2);
  ok(h.ride === v && v.rider === 0 && has('board'), 'не сел');
  game.setDir(0, 1, 0); const vx0 = v.x; run(game, 0.5); ok(v.x > vx0 + 40 && Math.abs(h.x - v.x) < 1, 'не едет / герой не внутри');
  game.setDir(0, 0, 0); S.bullets = []; h.cd = v.cd = 0; game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  ok(S.bullets.length === 1 && S.bullets[0].kind === 'kotel', 'пушка');
  const g0 = h.grenades; ok(game.grenade(0) && S.grenades[0].shell, 'снаряд'); eq(h.grenades, g0, 'снаряд потратил гранату');
  ok(!game.grenade(0), 'снаряд без перезарядки');
  const r = game._spawn('raider', v.x + 30, FLOOR); r.active = true; r.cd = 99;
  game.setDir(0, 1, 0); run(game, 0.6); ok(r.dead, 'не раздавил');
  // пули врагов бьют по броне «Котла», а не по герою
  const hp0 = v.hp; S.ebullets.push({ x: v.x + 30, y: v.y - 20, vx: -300, vy: 0, t: 0, dmg: 3, kind: 'bolt', r: 3.5, from: 'test' }); run(game, 0.3);
  ok(v.hp < hp0 && h.alive && h.lives === L.LIVES, 'урон не по броне');
  game.setDir(0, 0, 1); game.jump(0); game.update(1 / 60); game.setDir(0, 0, 0);
  ok(!h.ride && v.rider < 0 && has('eject') && h.vy < 0, 'не выпрыгнул');
  run(game, 1); ok(h.alive && h.onGround, 'после высадки');
});
test('«Котёл»: броня 0 → горит и взрывается; водитель внутри теряет жизнь, выпрыгнувший — цел, взрыв бьёт врагов', () => {
  for (const jumpOut of [false, true]){
    const { game, S, has } = setup(flat(60, [[8, GR - 1, 'k']], 7));
    const h = S.heroes[0], v = S.vehicles[0]; S.enemies = []; h.x = v.x;
    game.setDir(0, 0, 1); run(game, 0.2); ok(h.ride === v, 'не сел');
    game.setDir(0, 0, 0);
    const r = game._spawn('turret', v.x + 60, FLOOR); r.active = true; r.cd = 99;
    S.ebullets.push({ x: v.x + 25, y: v.y - 20, vx: -300, vy: 0, t: 0, dmg: 99, kind: 'bolt', r: 3.5, from: 'test' }); run(game, 0.2);
    ok(v.boom > 0 && has('kotelCrit'), 'не загорелся');
    if (jumpOut){ game.setDir(0, -1, 0); game.jump(0); run(game, 0.5); game.setDir(0, 0, 0); ok(!h.ride, 'не выпрыгнул'); }
    run(game, L.KOTEL.boom + 0.3);
    ok(has('kotelBoom') && !S.vehicles.length, 'не взорвался'); ok(r.dead, 'взрыв не задел врага');
    if (jumpOut) ok(h.alive && h.lives === L.LIVES, 'выпрыгнувший пострадал');
    else ok(!h.alive && h.lives === L.LIVES - 1, 'водитель уцелел во взрыве');
  }
});

// ---------- Разрушаемость ----------
test('укрытия: ящик держит пули и рушится; постройка — стена, после разрушения проход; враг с крыши падает', () => {
  const cells = [[10, GR - 1, 'C']];
  for (let x = 20; x < 24; x++) for (let y = 1; y <= 4; y++) cells.push([x, GR - y, 'X']);
  cells.push([21, GR - 5, 'r']);
  const { game, S, has, count } = setup(flat(60, cells, 5));
  const h = S.heroes[0], crate = S.blocks.find(b => b.kind === 'crate'), bl = S.blocks.find(b => b.kind === 'bldg'), roof = S.enemies[0];
  roof.cd = 99;
  h.face = 1; game.setFire(0, true); run(game, 0.4); ok(crate.hp < crate.max && !crate.dead, 'ящик не принял пулю');
  run(game, 2); ok(crate.dead && has('block'), 'ящик не разрушен'); game.setFire(0, false);
  game.setDir(0, 1, 0); run(game, 4); game.setDir(0, 0, 0);
  ok(h.x < 20 * T, 'прошёл сквозь постройку');
  roof.active = true; const ry = roof.y;
  game.setFire(0, true); run(game, 6, () => { roof.cd = 99; }); game.setFire(0, false);
  ok(bl.dead, 'постройка цела, hp ' + bl.hp); ok(count('block') === 2, 'нет события');
  ok(roof.dead || roof.y > ry + T, 'враг не упал с разрушенной крыши');
  game.setDir(0, 1, 0); run(game, 3); ok(h.x > 24 * T, 'после разрушения не пройти');
});
test('враги: мародёр стреляет с предупреждением, метатель бросает болт дугой, турель — очередью, броневагон — снарядом на уровне груди (присед спасает), дрон — бомбой сверху', () => {
  const fire = (type, sec) => {
    const { game, S, events } = setup(flat(80, [], 5)); const h = S.heroes[0]; h.inv = 99; S.enemies = [];
    const e = game._spawn(type, h.x + (type === 'drone' ? 0 : 200), type === 'drone' ? 200 : FLOOR); e.cd = 0.5;
    let warned = false; run(game, sec, () => { if (e.warn) warned = true; });
    return { S, events, warned, e };
  };
  let r = fire('raider', 2); ok(r.warned && r.events.some(x => x[0] === 'eshot'), 'мародёр');
  r = fire('bomber', 2); ok(r.events.some(x => x[0] === 'throw') && r.events.some(x => x[0] === 'boom'), 'метатель');
  r = fire('turret', 2); ok(r.events.filter(x => x[0] === 'eshot').length >= 3, 'турель очередью');
  r = fire('drone', 3); ok(r.events.some(x => x[0] === 'drop'), 'дрон');
  // снаряд броневагона проходит над присевшим
  const { game, S } = setup(flat(80, [], 5)); const h = S.heroes[0]; S.enemies = [];
  const w = game._spawn('wagon', h.x + 300, FLOOR); w.active = true; w.cd = 0.1;
  game.setDir(0, 0, 1); run(game, 2.5); ok(h.alive && h.armor === 1, 'присед не спас от снаряда');
  game.setDir(0, 0, 0); w.cd = 0.1; run(game, 2.5); ok(h.armor === 0 || !h.alive, 'стоя снаряд не попал');
});

// ---------- Жизни ----------
test('жизни: 3 на игрока, «фартук» гасит первое попадание; гибель → возрождение с неуязвимостью и клепальником; 0 жизней → конец', () => {
  const { game, S, has } = setup(flat(60, [], 5));
  const h = S.heroes[0]; eq(h.lives, L.LIVES); eq(h.armor, 1);
  const shoot = () => S.ebullets.push({ x: h.x + 40, y: h.y - 20, vx: -400, vy: 0, t: 0, dmg: 3, kind: 'bolt', r: 3.5, from: 'test' });
  shoot(); run(game, 0.2); ok(h.alive && h.armor === 0 && has('armor'), 'фартук'); ok(h.inv > 0, 'нет неуязвимости после фартука');
  run(game, 1.3); h.weapon = 'nail'; h.ammo = 50; shoot(); run(game, 0.2); ok(!h.alive && h.lives === L.LIVES - 1, 'не погиб');
  run(game, 1.5); ok(h.alive && has('respawn') && h.inv > 1 && h.armor === 1 && h.weapon === 'rivet', 'возрождение');
  run(game, 1.5); ok(h.onGround, 'не приземлился после возрождения');
  h.lives = 1; h.armor = 0; h.inv = 0; shoot(); run(game, 0.2); ok(h.out, 'не выбыл');
  run(game, 2); ok(S.over && has('gameover') && !S.won, 'нет конца игры');
});
test('яма: падение — жизнь, «фартук» не спасает; возрождение над землёй', () => {
  const m = flat(60); for (let r = GR; r < ROWS; r++) m[r] = m[r].slice(0, 10) + '...' + m[r].slice(13);
  const { game, S } = setup(m);
  const h = S.heroes[0]; game.setDir(0, 1, 0); run(game, 2); game.setDir(0, 0, 0);
  ok(h.lives === L.LIVES - 1, 'яма не забрала жизнь');
  run(game, 3); ok(h.alive && h.onGround && h.y === FLOOR, 'возродился не на земле');
});
test('доп. жизнь каждые 20000 очков', () => {
  const { game, S, has } = setup(flat(40));
  S.score = L.EXTRA_LIFE - 1; game.update(1 / 60); eq(S.heroes[0].lives, L.LIVES);
  S.score = L.EXTRA_LIFE + 5; game.update(1 / 60); eq(S.heroes[0].lives, L.LIVES + 1); ok(has('extraLife'));
  game.update(1 / 60); eq(S.heroes[0].lives, L.LIVES + 1, 'дважды');
});

// ---------- Кооп ----------
test('кооп: ввод игроков независим (логика) — бег/огонь/прыжок/граната И1 не двигают И2', () => {
  const { game, S } = setup(flat(60, [], 5), { players: 2 });
  const [a, b] = S.heroes, bx = b.x, by = b.y, ax = a.x;
  game.setDir(0, 1, 0); game.jump(0); run(game, 0.5);
  ok(a.x > ax + 40, 'И1 не пошёл'); eq([b.x, b.y], [bx, by], 'И2 сдвинулся от ввода И1');
  game.setDir(0, 0, 0); game.setDir(1, 1, 0); run(game, 0.5); ok(b.x > bx + 40, 'И2 не пошёл');
  S.bullets = []; b.cd = 0; game.setFire(1, true); game.update(1 / 60); game.setFire(1, false);
  ok(S.bullets.length === 1 && S.bullets[0].pi === 1, 'выстрел не от И2');
  const g0 = a.grenades; game.grenade(1); eq(a.grenades, g0, 'граната И2 списалась у И1'); eq(b.grenades, L.GREN0 - 1);
});
test('кооп: ввод движка по игрокам — раскладки без конфликтов, И1 стрелки / И2 WASD раздельно, прыжки/гранаты по игрокам, в одиночке обе ведут И1', () => {
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
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'nn' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  g.usePlayers({ bind: L.BIND, actions: ['jump', 'grenade'] });
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'KeyW'); key('keydown', 'KeyX');
  ok(P2.pressed('up') && P2.pressed('fire') && !P1.pressed('up') && !P1.pressed('fire'), 'WASD/X ушли не тому');
  key('keydown', 'ArrowLeft'); key('keydown', 'Slash'); key('keydown', 'Space'); key('keydown', 'Comma'); key('keydown', 'KeyZ'); key('keydown', 'KeyC');
  ok(P1.pressed('left') && P1.pressed('fire') && !P2.pressed('left'), 'стрелки ушли не тому');
  eq(got, ['1jump', '1grenade', '2jump', '2grenade'], 'прыжки/гранаты по игрокам');
  ['KeyW', 'KeyX', 'ArrowLeft', 'Slash', 'Space', 'Comma', 'KeyZ', 'KeyC'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyD'); key('keydown', 'KeyX');
  ok(P1.pressed('right') && P1.pressed('fire') && !P2.pressed('right'), 'в одиночке WASD/X не ведут И1');
});
test('кооп: «поводок» и камера — оба героя всегда в кадре, когда разбегаются; камера идёт только вперёд', () => {
  const { game, S } = setup(flat(400, [], 60), { players: 2 });
  S.heroes.forEach(h => { h.lives = 99; h.inv = 1e9; });
  const rng = mulberry32(5); let minPad = 1e9, leashed = 0, camBack = 0, lastCam = S.cam.x, maxGap = 0;
  for (let k = 0; k < 60; k++){
    const d0 = rng() < 0.6 ? 1 : -1, d1 = rng() < 0.5 ? -d0 : d0;
    game.setDir(0, d0, 0); game.setDir(1, d1, 0);
    if (rng() < 0.3) game.jump(0); if (rng() < 0.3) game.jump(1);
    run(game, 0.8, () => {
      S.heroes.forEach(h => { minPad = Math.min(minPad, h.x - S.cam.x, S.cam.x + L.VIEW_W - h.x); if (h.leashed) leashed++; });
      if (S.cam.x < lastCam - 1e-6) camBack++; lastCam = S.cam.x;
      maxGap = Math.max(maxGap, Math.abs(S.heroes[0].x - S.heroes[1].x));
    });
  }
  ok(minPad >= L.LEASH_PAD - 1, 'герой ушёл к краю/из кадра: запас ' + minPad.toFixed(1));
  ok(maxGap > L.VIEW_W * 0.75, 'разбегались слабо: ' + maxGap);
  ok(leashed > 0, 'поводок ни разу не сработал'); eq(camBack, 0, 'камера шла назад'); ok(S.cam.x > 1000, 'камера не шла вперёд');
});
test('кооп: раздельные жизни, общий счёт; выбыл один — игра идёт, возрождение рядом с напарником; выбыли оба — конец', () => {
  const { game, S, has } = setup(flat(80, [], 5), { players: 2 });
  const [a, b] = S.heroes;
  b.lives = 1; b.armor = 0; S.ebullets.push({ x: b.x + 30, y: b.y - 20, vx: -400, vy: 0, t: 0, dmg: 3, kind: 'bolt', r: 3.5, from: 'test' });
  run(game, 2); ok(b.out && !b.alive && a.alive && S.phase === 'play' && has('out'), 'кооп оборвался от выбывания одного');
  a.armor = 0; a.lives = 2; S.ebullets.push({ x: a.x + 30, y: a.y - 20, vx: -400, vy: 0, t: 0, dmg: 3, kind: 'bolt', r: 3.5, from: 'test' });
  run(game, 0.2); ok(!a.alive && a.lives === 1); run(game, 1.5); ok(a.alive, 'не возродился');
  a.lives = 1; a.armor = 0; a.inv = 0; S.ebullets.push({ x: a.x + 30, y: a.y - 20, vx: -400, vy: 0, t: 0, dmg: 3, kind: 'bolt', r: 3.5, from: 'test' });
  run(game, 2.5); ok(S.over && has('gameover'), 'нет конца при выбывании обоих');
  // общий счёт
  const c2 = setup(flat(60, [], 5), { players: 2 }); c2.S.enemies = [];
  const e = c2.game._spawn('turret', c2.S.heroes[1].x + 20, FLOOR); e.active = true; e.hp = 1; e.cd = 99;
  c2.S.heroes[1].face = 1; c2.S.heroes[1].cd = 0; c2.game.setFire(1, true); c2.game.update(1 / 60);
  eq(c2.S.score, L.ENEMIES.turret.score, 'общий счёт');
});

// ---------- Боссы ----------
test('боссы: у каждого из 6 — фазы по порогам здоровья, неуязвимость при смене фазы, свои приёмы; гибель → миссия выполнена', () => {
  const patSeen = new Set();
  L.MISSIONS.forEach((M, i) => {
    const m = i + 1, ev = [];
    const g2 = N.Game({ mission: m, maxMission: m, rng: mulberry32(9), onEvent: (t, d) => ev.push([t, d]) }).start(), S = g2._S;
    S.heroes[0].lives = 99; S.heroes[0].inv = 1e9; S.heroes[0].x = S.arenaX + 60; S.cam.x = S.arenaX;
    run(g2, 0.1); ok(S.locked && S.boss && ev.some(e => e[0] === 'bossIntro'), 'босс ' + m + ' не появился');
    const B = S.boss, D = L.BOSSES[B.key]; eq(B.key, M.boss); eq(B.phases.length, D.phases.length);
    run(g2, 2); ok(!g2._damageBoss(0) || true);
    const nph = B.phases.length;
    for (let ph = 0; ph < nph; ph++){
      eq(B.phase, ph, 'фаза ' + m);
      // приёмы фазы
      const before = ev.length; S.heroes[0].inv = 1e9; run(g2, 9);
      const evs = ev.slice(before).map(e => e[0]);
      B.phases[ph].forEach(p => {
        const sign = { spread: 'eshot', mortar: 'mortar', drones: 'drones', stomp: 'stomp', laser: 'laserWarn', rain: 'rain' }[p];
        ok(evs.includes(sign), 'босс ' + B.key + ' фаза ' + (ph + 1) + ': нет приёма ' + p); patSeen.add(p);
      });
      if (ph < nph - 1){
        const thr = B.max * (1 - (ph + 1) / nph);
        B.hp = thr + 1; ok(g2._damageBoss(2), 'урон не прошёл'); eq(B.phase, ph + 1, 'нет смены фазы ' + B.key);
        ok(B.shift > 0 && ev.some(e => e[0] === 'phase'), 'нет паузы смены фазы');
        const hp0 = B.hp; ok(!g2._damageBoss(5) && B.hp === hp0, 'урон в неуязвимости');
        run(g2, 1.1);
      }
    }
    B.hp = 1; g2._damageBoss(5); ok(B.dead && ev.some(e => e[0] === 'bossDie'), 'не пал ' + B.key);
    run(g2, 3); ok(ev.some(e => e[0] === 'clear'), 'нет «миссия выполнена» ' + m);
    run(g2, 3.2); ok(S.won && ev.some(e => e[0] === 'win'), 'нет победы при maxMission');
  });
  eq([...patSeen].sort(), ['drones', 'laser', 'mortar', 'rain', 'spread', 'stomp'], 'все приёмы');
});
test('боссы: волна по земле — перепрыгнуть; лазер низкий — перепрыгнуть, высокий — присесть; кооп — босс толще', () => {
  const mk = () => { const g2 = N.Game({ mission: 4, rng: mulberry32(2) }).start(), S = g2._S; S.cam.x = S.arenaX; S.heroes[0].x = S.arenaX + 200; run(g2, 0.1); S.boss.intro = 0; S.boss.cds = { x: 99 }; S.boss.phases = [['x']]; S.boss.phase = 0; return { g2, S }; };
  let { g2, S } = mk(); let h = S.heroes[0]; h.armor = 0; run(g2, 1);
  S.waves.push({ x: h.x + 120, y: S.boss.groundY, vx: -250, h: 18, t: 0 });
  run(g2, 0.25); g2.jump(0); run(g2, 0.8); ok(h.alive, 'волна задела в прыжке');
  S.waves.push({ x: h.x + 60, y: S.boss.groundY, vx: -250, h: 18, t: 0 }); run(g2, 0.6); ok(!h.alive, 'волна не бьёт стоящего');
  ({ g2, S } = mk()); h = S.heroes[0]; h.armor = 0; run(g2, 1);
  S.lasers.push({ y: S.boss.groundY - 27, low: false, warn: 0.3, fire: 0.45, x0: S.arenaX, x1: S.boss.x });
  g2.setDir(0, 0, 1); run(g2, 0.9); ok(h.alive, 'высокий лазер задел присевшего');
  g2.setDir(0, 0, 0); S.lasers.push({ y: S.boss.groundY - 11, low: true, warn: 0.3, fire: 0.45, x0: S.arenaX, x1: S.boss.x });
  run(g2, 0.2); g2.jump(0); run(g2, 0.7); ok(h.alive, 'низкий лазер задел в прыжке');
  S.lasers.push({ y: S.boss.groundY - 11, low: true, warn: 0.1, fire: 0.45, x0: S.arenaX, x1: S.boss.x }); g2.setDir(0, 0, 1); run(g2, 0.4); ok(!h.alive, 'низкий лазер не бьёт присевшего');
  const s1 = N.Game({ mission: 1 }).start(), s2 = N.Game({ mission: 1, players: 2 }).start();
  [s1, s2].forEach(gg => { const S2 = gg._S; S2.cam.x = S2.arenaX; S2.heroes[0].x = S2.arenaX + 100; if (S2.heroes[1]) S2.heroes[1].x = S2.arenaX + 140; run(gg, 0.1); });
  ok(s2._S.boss.max > s1._S.boss.max * 1.4, 'кооп-босс не толще');
});
test('ход игры: 6 миссий подряд, жизни/оружие/гранаты переходят; после 6-й — победа', () => {
  const ev = [], g2 = N.Game({ rng: mulberry32(4), onEvent: t => ev.push(t) }).start(), S = g2._S;
  const h = S.heroes[0];
  for (let m = 1; m <= 6; m++){
    eq(S.mission, m); h.weapon = 'nail'; h.ammo = 77; h.grenades = 11;
    S.heroes[0].x = S.arenaX + 80; S.cam.x = S.arenaX; run(g2, 0.1);
    ok(S.boss, 'нет босса ' + m); S.boss.intro = 0; S.boss.hp = 1; h.inv = 1e9; g2._damageBoss(5);
    run(g2, 6);
    if (m < 6) { eq(S.mission, m + 1); eq([h.weapon, h.ammo, h.grenades], ['nail', 77, 11], 'снаряжение не перешло'); ok(!S.boss && S.cam.x === 0, 'новая миссия'); }
  }
  ok(S.won && ev.includes('win') && ev.filter(t => t === 'clear').length === 6, 'нет победы');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть названия оружия, миссий, боссов, героев', () => {
  const ru = Object.keys(N.STR.ru).sort(), en = Object.keys(N.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(N.STR.ru[k]).trim() && String(N.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(N.STR.ru[k], 'нет ключа движка ' + k));
  Object.keys(L.WEAPONS).concat(['kotel']).forEach(w => ok(N.STR.ru['w_' + w], 'нет оружия ' + w));
  eq(N.STR.ru.w_nail, 'Гвоздомёт'); eq(N.STR.ru.w_spark, 'Искровик'); eq(N.STR.ru.w_torch, 'Паяльник'); eq(N.STR.ru.w_scoop, 'Дробовой ковш');
});
test('музыка: трек nalyot разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.nalyot; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas, скрипты по порядку, тач-кнопки прыжка/гранаты/паузы; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="520"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/ui.js', 'js/modern.js', 'js/classic.js', 'js/main.js']);
  ok(/data-jump/.test(html) && /data-gren/.test(html) && /data-pause/.test(html) && /data-d="A"/.test(html), 'тач-кнопки');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('правило имён: нет чужих игр, компаний, героев run-and-gun, реального оружия (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('aW52YWRlcnM/fNC40L3QslvQtdCwXdC50LTQtdGAfHRhaXRvfNGC0LDQudGC0L58Z2FsYWd80LPQsNC70LDQs3xnYWxheGlhbnzQs9Cw0LvQsNC60YHQuNCw0L18XGJwaG9lbml4XGJ80YTQtdC90LjQutGBfG5pc2hpa2Fkb3zQvdC40YHQuNC60LDQtNC+fGRlbW9uID9hdHRhY2t8XGJnb3JmXGJ8bW9vbiA/Y3Jlc3RhfGNlbnR1cml8YW1zdGFyfHBhYy0/bWFufNC/0LDQutC80LDQvXx0ZXRyaXN80YLQtdGC0YDQuNGBfFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxrb25hbWl80LrQvtC90LDQvNC4fG5hbWNvfNC90LDQvNC60L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fHNlZ2FcYnzRgdC10LPQsCg/IVvQsC3Rj9GRXSl8dGVjbW98ZGl6enl8ZGVlcHNlZWt8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofHJpdmVyID9yYWlkfGV4b2xvbnzRjdC60YHQvtC70L7QvXx2aXRvcmN80LLQuNGC0L7RgNC6fGxvc3QgP3Zpa2luZ3N8ZG91YmxlID9kcmFnb258YmF0dGxldG9hZHN8c2lsa3dvcm18XGJyLT90eXBlXGJ80YAtP9GC0LDQudC/fFxiaXJlbVxifNCw0LnRgNC10Lx8XGJieWRvXGJ80LHQuNC00L4oPyFb0LAt0Y/RkV0pfGdyYWRpdXN80LPRgNCw0LTQuNGD0YF8bmVtZXNpc3zQvdC10LzQtdC30LjQtHx2aWMgP3ZpcGVyfFxiZm9yY2VcYnzRhNC+0YDRgSg/IVvQsC3Rj9GRXSl8ZGFyaXVzfNC00LDRgNC40YPRgXxzYWxhbWFuZGVyfNGB0LDQu9Cw0LzQsNC90LTRgHxtZXRhbCA/c2x1Z3zQvNC10YLQsNC7ID/RgdC70LDQs3xwcm9ib3RlY3RvcnzQv9GA0L7QsdC+0YLQtdC60YLQvtGAfGd1bnN0YXJ80LPQsNC90YHRgtCw0YB8Y3VwaGVhZHzQutCw0L/RhdC10LR8cmFtYm980YDQsNC80LHQvnxcYmNvbW1hbmRvXGJ80LrQvtC80LzQsNC90LTQvnxpa2FyaXzQuNC60LDRgNC4fHNob2NrID90cm9vcGVyc3xoYXJkID9jb3Jwc3xicm9mb3JjZXxibGF6aW5nID9jaHJvbWV8aHVudGRvd258dHVycmljYW580YLRg9GA0YDQuNC60LDQvXxtaWRuaWdodCA/cmVzaXN0YW5jZXxyb2xsaW5nID90aHVuZGVyfG1lZ2EgP21hbnzQvNC10LPQsNC80LXQvXxyb2NrbWFufGFsaWVuID9zb2xkaWVyfGJpbGwgP3JpemVyfNCx0LjQu9C7ID/RgNCw0LnQt9C10YB8bGFuY2UgP2JlYW58bWFyY28gP3Jvc3NpfNC80LDRgNC60L4gP9GA0L7RgdGB0Lh8dGFybWF80YLQsNGA0LzQsCg/IVvQsC3Rj9GRXSl8XGJtb3JkZW5cYnzQvNC+0YDQtNC10L18XGJzbmtcYnxuYXpjYXxzdW5zb2Z0fGRhdGEgP2Vhc3R8YWstPzQ3fNCw0LotPzQ3fGthbGFzaG5pa292fNC60LDQu9Cw0YjQvdC40Lp8XGJtLT8xNlxifFxibS0/NjBcYnxcYnV6aVxifCg/PCFb0LAt0Y/RkV0p0YPQt9C4KD8hW9CwLdGP0ZFdKXxiYXpvb2thfNCx0LDQt9GD0Lp8Z2F0bGluZ3zQs9Cw0YLQu9C40L3Qs3xtaW5pZ3VufNC80LjQvdC40LPQsNC9fGRlc2VydCA/ZWFnbGV8Z2xvY2t80LPQu9C+0LooPyFb0LAt0Y/RkV0pfGJlcmV0dGF80LHQtdGA0LXRgtGCfFxiY29sdFxifNC60L7Qu9GM0YIoPyFb0LAt0Y/RkV0pfHRob21wc29ufNGC0L7QvNC/0YHQvtC9fG1hdXNlcnzQvNCw0YPQt9C10YB8bHVnZXJ80LvRjtCz0LXRgHxicm93bmluZ3zQsdGA0LDRg9C90LjQvdCzfFxicnBnLT83fNGA0L/Qsy0/N3xwYW56ZXJmYXVzdHzRhNCw0YPRgdGC0L/QsNGC0YDQvtC9', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('Q09OVFJB')) && BAD.test(u('0LzQtdGC0LDQuyDRgdC70LDQsw==')) && BAD.test(u('YWstNDc=')) && BAD.test(u('0YDQsNC80LHQvg==')), 'стоп-лист работает');
  ok(!BAD.test('налёт') && !BAD.test('Гвоздомёт') && !BAD.test('контрастный') && !BAD.test('Котёл') && !BAD.test('узел') && !BAD.test('рамка'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
// «Собранный» бот (реакция 0.12–0.2 с, редкие зевки) проходит каждую миссию с нуля (3 жизни) хотя бы в 2 из 3 партий.
const PASS = [];
for (let m = 1; m <= 6; m++) for (const s of [1, 2, 3]) PASS.push({ m, r: playNalyot(N, s, { startMission: m, missions: 1, miss: 0.1, react: [0.12, 0.2] }) });
test('проходимость: каждая из 6 миссий проходится «собранным» ботом (≥ 2 из 3)', () => {
  console.log('     время, с: ' + PASS.map(p => p.m + ':' + p.r.time.toFixed(0) + (p.r.won ? '' : '✗')).join(' '));
  const bad = []; for (let m = 1; m <= 6; m++) if (PASS.filter(p => p.m === m && p.r.won).length < 2) bad.push(m);
  ok(!bad.length, 'не пройдены: ' + bad.join(', ')); ok(!PASS.some(p => p.r.stuck), 'зависание');
});
// «Человеческий» бот (tests/bot.mjs): реакция 160–260 мс, видит только кадр, пули замечает не сразу (зевок 45% на взгляд).
const NB = 40, BAL = []; for (let s = 1; s <= NB; s++) BAL.push(playNalyot(N, s));
const reach = {}; BAL.forEach(r => { reach[r.passed] = (reach[r.passed] || 0) + 1; });
console.log('     бот (1 игрок, ' + NB + ' партий): миссия 1 — ' + BAL.filter(r => r.passed >= 1).length + '/' + NB + ', вся игра — ' + BAL.filter(r => r.won).length + '/' + NB + ', пройдено миссий → партий: ' + JSON.stringify(reach));
test('баланс: миссию 1 проходят ≥ 90% партий бота', () => ok(BAL.filter(r => r.passed >= 1).length >= 0.9 * NB, 'миссия 1: ' + BAL.filter(r => r.passed >= 1).length + '/' + NB));
test('баланс: всю игру (6 миссий) проходят ~20–40% (допуск 15–45%)', () => { const w = BAL.filter(r => r.won).length / NB; ok(w >= 0.15 && w <= 0.45, 'вся игра: ' + w); });
test('баланс: бот нигде не застревает (тайм-аут миссии 420 с)', () => eq(BAL.filter(r => r.stuck).length, 0));
const CO = []; for (let s = 1; s <= 12; s++) CO.push(playNalyot(N, s, { players: 2 }));
const cw = CO.filter(r => r.won).length / CO.length;
console.log('     бот (кооп, 12 партий): миссия 1 — ' + CO.filter(r => r.passed >= 1).length + '/12, вся игра — ' + CO.filter(r => r.won).length + '/12');
test('баланс кооп: миссия 1 — все, всю игру — не «на халяву» (≤ 85%)', () => { ok(CO.every(r => r.passed >= 1), 'кооп падает на 1-й'); ok(cw <= 0.85, 'кооп слишком лёгок: ' + cw); });

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

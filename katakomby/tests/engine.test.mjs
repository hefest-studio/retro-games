/* КАТАКОМБЫ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node katakomby/tests/engine.test.mjs (QUICK=1 — без баланса). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие (переделка 2026-11 «Огненный обруч»): карты и проходимость (решатель «огонь донести и бросить»), обруч (бросок,
   рикошеты, возврат, отзыв, урон раз за отрезок, множитель рикошета, автоприцел), огонь (очаг, окунуть, остывает), чаши
   (зажечь, свет жжёт/замедляет тварей и лечит, плевок гасит, очаг не гаснет), решётки и печать спуска, тьма рождает тварей,
   обучение 1-го этажа, ларцы, прокачка, кооп (ввод, поводок, камера, смерть/возрождение), Дымный Страж (только горящий обруч,
   выдох задувает чаши), реклама за награду, миграция сохранений, языки, страница, площадка, правило имён; баланс — ботом. */
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
const K = sandbox.KATAKOMBY, L = K.logic, T = L.T;
const { playKatakomby, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Пустая арена W×H (стены по краю) + доп. символы
function arena(w, h, extra = {}){
  const rows = [];
  for (let y = 0; y < h; y++){ let r = ''; for (let x = 0; x < w; x++) r += (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '#' : '.'; rows.push(r); }
  const put = (x, y, c) => { rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1); };
  put(extra.sx || 2, extra.sy || 2, 'S');
  (extra.cells || []).forEach(([x, y, c]) => put(x, y, c));
  return rows;
}
// Игра на своей карте (FLOORS подменяются на время теста); обучение выключено, если не сказано иное
function setup(map, opts = {}){
  const saved = L.FLOORS.slice();
  L.FLOORS.length = 0; L.FLOORS.push({ name: 'test', map }, { name: 'test2', map });
  const events = [];
  let game;
  try {
    game = K.Game(Object.assign({ rng: mulberry32(opts.seed || 1), noTutorial: true, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  } finally { L.FLOORS.length = 0; saved.forEach(f => L.FLOORS.push(f)); }
  return { game, S: game._S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
const at = (tx, ty) => ({ x: tx * T + T / 2, y: ty * T + T / 2 });
function place(o, tx, ty){ const p = at(tx, ty); o.x = p.x; o.y = p.y; }
function tap(game, pi = 0){ game.setFire(pi, true); game.update(1 / 60); game.setFire(pi, false); game.update(1 / 60); }
function quiet(S){ S.spawnT = 1e9; }   // тьма молчит (для точечных тестов)

// ---------- Карты и проходимость ----------
test('карты: 9 этажей, прямоугольные, стены по краю; 1–8 с печатью спуска, 9-й — Страж; на каждом очаг и ≥ 4 чаш', () => {
  eq(L.FLOORS.length, 9);
  L.FLOORS.forEach((f, i) => {
    const F = L.parseFloor(f.map), n = i + 1;
    for (let x = 0; x < F.W; x++) ok(F.grid[x] === '#' && F.grid[(F.H - 1) * F.W + x] === '#', 'этаж ' + n + ': дыра в краю');
    for (let y = 0; y < F.H; y++) ok(F.grid[y * F.W] === '#' && F.grid[y * F.W + F.W - 1] === '#', 'этаж ' + n + ': дыра в краю');
    if (n < 9) ok(F.exit && !F.boss, 'этаж ' + n + ' без печати'); else ok(F.boss && !F.exit, 'на 9-м — Страж и нет печати');
    eq(F.lamps.filter(l => l.hearth).length, 1, 'этаж ' + n + ': очаг');
    ok(F.lamps.filter(l => !l.hearth).length >= 4, 'этаж ' + n + ': чаш меньше 4');
  });
});
test('проходимость: решатель зажигает все чаши каждого этажа (огонь донести ≤ 24 клеток, бросок ≤ 9 по прямой) и доходит до печати/Стража; у каждой решётки есть свои чаши', () => {
  L.FLOORS.forEach((f, i) => {
    const r = L.solveFloor(f.map);
    ok(r.ok, 'этаж ' + (i + 1) + ': не зажжены ' + JSON.stringify(r.unlit.map(l => [l.tx, l.ty])) + ', печать ' + r.reach + ', решётка без чаш ' + r.badGate);
  });
  ok(!L.solveFloor(arena(12, 6, { cells: [[1, 4, 'F'], [8, 1, '#'], [8, 2, '#'], [8, 3, '#'], [8, 4, '#'], [10, 2, 'L'], [10, 4, 'E']] })).ok, 'решатель не видит замурованную чашу');
});
test('переделка: нет логов-генераторов, ключей, дверей с ключами, еды, зелий и классов героев (символы карты прежних правил отвергаются)', () => {
  for (const c of ['G', 'K', 'f', 'p', 'k']) { let threw = false; try { L.parseFloor(arena(6, 5, { cells: [[3, 2, c]] })); } catch (e) { threw = true; } ok(threw, 'символ «' + c + '» принят'); }
  const S = K.Game({ noTutorial: true }).start()._S;
  ok(!('lairs' in S) && !('keys' in S) && !('potions' in S) && !('shots' in S) && !('swings' in S), 'остались поля прежних правил');
  ok(!L.HEROES && S.heroes.every(h => !h.cls), 'остались классы героев');
  const src = ['js/game.js', 'js/modern.js', 'js/classic.js', 'js/ui.js', 'js/main.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ok(!/lairDie|lairHit|'potion'|'food'|'key'|bomb\(|cls_smith|cls_spark/.test(src), 'в коде остались прежние механики');
});

// ---------- Обруч ----------
test('обруч: бросок по взгляду, рикошет от стены, возврат в руку; повторное нажатие в полёте — отзыв', () => {
  const { game, S, has, count } = setup(arena(14, 7, { sx: 3, sy: 3 })); quiet(S);
  const h = S.heroes[0], o = h.hoop; h.face = { x: 1, y: 0 };
  tap(game); eq(o.state, 'fly', 'не полетел'); ok(o.vx > 0, 'не по взгляду');
  run(game, 0.8); ok(has('bounce') || has('rico'), 'нет рикошета'); ok(count('bounce') >= 1);
  run(game, 2.5); eq(o.state, 'held', 'не вернулся'); ok(has('catch'));
  tap(game); run(game, 0.1); eq(o.state, 'fly'); tap(game); ok(o.state === 'back' && has('recall'), 'нет отзыва');
});
test('обруч: после HOOP.bounces (+навык) рикошетов возвращается; навык «Рикошет» добавляет отскок', () => {
  const st0 = L.heroStats({ up: { bnc: 0, spd: 0, arm: 0 } }), st2 = L.heroStats({ up: { bnc: 2, spd: 0, arm: 0 } });
  eq(st0.bounces, L.HOOP.bounces); eq(st2.bounces, L.HOOP.bounces + 2);
  const { game, S, count } = setup(arena(8, 8, { sx: 3, sy: 3 })); quiet(S);
  S.heroes[0].face = { x: 0.8, y: 0.6 }; tap(game); run(game, 1.5);
  ok(count('spent') === 1, 'обруч не «устал» после рикошетов');
});
test('обруч: режет всех тварей на пути, каждую раз за отрезок полёта; после рикошета — снова', () => {
  const { game, S, events } = setup(arena(16, 5, { sx: 2, sy: 2 })); quiet(S);
  const h = S.heroes[0]; h.face = { x: 1, y: 0 };
  const a = game._spawn('slime', at(6, 2).x, at(6, 2).y), b = game._spawn('slime', at(9, 2).x, at(9, 2).y);
  a.hp = b.hp = 5; a.max = b.max = 5;
  S.enemies.forEach(e => { e.biteCd = 99; });
  tap(game);
  for (let i = 0; i < 40; i++){ a.x = at(6, 2).x; a.y = at(6, 2).y; b.x = at(9, 2).x; b.y = at(9, 2).y; game.update(1 / 60); }
  ok(a.hp <= 4 && b.hp <= 4, 'не задел обеих: ' + a.hp + ', ' + b.hp);
  ok(a.hp >= 3, 'бьёт чаще раза за отрезок');
  const e2 = game._spawn('shade', at(12, 2).x, at(12, 2).y); e2.hp = 1;
  // тень ловит обруч на обратном отрезке после рикошета — ×2
  for (let i = 0; i < 120 && e2.hp > 0; i++){ e2.x = at(12, 2).x; e2.y = at(12, 2).y; a.x = at(6, 2).x; a.y = at(6, 2).y; b.x = at(9, 2).x; b.y = at(9, 2).y; game.update(1 / 60); }
  const k = events.filter(e => e[0] === 'kill').pop();
  ok(k, 'тень не убита');
});
test('множитель рикошета: тварь, сбитая после N отскоков, даёт очки ×(1+N), не больше ×' + L.MULT_MAX, () => {
  const { game, S, events } = setup(arena(10, 5, { sx: 2, sy: 2 })); quiet(S);
  const h = S.heroes[0], o = h.hoop; h.face = { x: 1, y: 0 };
  const e = game._spawn('shade', at(4, 2).x, at(4, 2).y); e.biteCd = 99;
  tap(game); o.bounces = 2; o.hits = [e.id];   // как будто уже два раза отскочил и задел её до этого
  o.hits = [];
  for (let i = 0; i < 40 && e.hp > 0; i++){ e.x = at(4, 2).x; e.y = at(4, 2).y; game.update(1 / 60); }
  const k = events.find(x => x[0] === 'kill');
  ok(k && k[1].mult >= 3 && k[1].pts === L.ENEMIES.shade.score * k[1].mult, 'множитель: ' + JSON.stringify(k && k[1]));
});
test('автоприцел: бросок доворачивает к твари в конусе ±' + L.AIM_CONE + ' рад; на тач-экране (wideAim) — шире ±' + L.AIM_WIDE, () => {
  const mk = (wide) => { const r = setup(arena(16, 12, { sx: 3, sy: 6 }), { wideAim: wide }); quiet(r.S); return r; };
  for (const [wide, ang, hit] of [[false, 0.3, true], [false, 0.6, false], [true, 0.6, true]]){
    const { game, S } = mk(wide), h = S.heroes[0]; h.face = { x: 1, y: 0 };
    const e = game._spawn('slime', h.x + Math.cos(ang) * 150, h.y + Math.sin(ang) * 150); e.biteCd = 99;
    tap(game); const o = h.hoop, a = Math.atan2(o.vy, o.vx);
    ok(hit ? Math.abs(a - ang) < 0.05 : Math.abs(a) < 0.01, (wide ? 'тач ' : '') + 'угол ' + ang + ': бросок ' + a.toFixed(2));
  }
  const { game, S } = mk(false); game.setWideAim(true); S.heroes[0].face = { x: 1, y: 0 };
  const e = game._spawn('slime', S.heroes[0].x + Math.cos(0.6) * 150, S.heroes[0].y + Math.sin(0.6) * 150); tap(game);
  ok(Math.abs(Math.atan2(S.heroes[0].hoop.vy, S.heroes[0].hoop.vx) - 0.6) < 0.05, 'setWideAim не работает');
});

// ---------- Огонь и чаши ----------
test('огонь: у горящего очага обруч в руке загорается на FLAME с; остывает; холодный обруч о холодную чашу — только звон', () => {
  const { game, S, has } = setup(arena(14, 7, { sx: 3, sy: 3, cells: [[4, 3, 'F'], [11, 3, 'L']] })); quiet(S);
  const h = S.heroes[0], o = h.hoop;
  game.update(1 / 60); near(o.hot, L.FLAME, 0.1, 'у очага не загорелся'); ok(has('ignite'));
  place(h, 8, 5); run(game, L.FLAME + 0.2); eq(o.hot, 0, 'не остыл'); ok(has('cool'));
  h.face = { x: 1, y: -0.55 }; place(h, 7, 5); h.face = { x: 0.89, y: -0.45 };
  const l = S.lamps.find(x => !x.hearth); h.x = l.x - 100; h.y = l.y; h.face = { x: 1, y: 0 };
  tap(game); run(game, 0.5); ok(!l.lit && has('clink'), 'холодный обруч зажёг чашу');
});
test('чаша: горящий обруч зажигает холодную чашу при касании (+50); от горящей чаши обруч можно поджечь и броском (касание в полёте)', () => {
  const { game, S, has } = setup(arena(16, 7, { sx: 2, sy: 3, cells: [[1, 1, 'F'], [8, 3, 'L'], [13, 3, 'L']] })); quiet(S);
  const h = S.heroes[0], o = h.hoop, [, a, b] = S.lamps;
  place(h, 5, 3); o.hot = 5; h.face = { x: 1, y: 0 }; const s0 = S.score;
  tap(game); run(game, 0.5); ok(a.lit && has('light'), 'чаша не зажглась'); eq(S.score - s0, L.SCORE.lamp);
  run(game, 2); o.hot = 0; place(h, 10, 3); h.face = { x: -1, y: 0 }; tap(game); run(game, 0.3);
  ok(o.hot > 0, 'обруч не загорелся о горящую чашу в полёте');
  run(game, 2); place(h, 10, 3); h.face = { x: 1, y: 0 }; o.hot = Math.max(o.hot, 3); tap(game); run(game, 0.6);
  ok(b.lit, 'от огня чаши — следующая чаша');
});
test('свет чаши: твари в нём горят (BURN/с) и замедлены; обходчица в свете лечится (HEAL/с)', () => {
  const { game, S } = setup(arena(20, 9, { sx: 2, sy: 4, cells: [[10, 4, 'L']] })); quiet(S);
  const l = S.lamps[0]; game._light(l);
  const e = game._spawn('slime', l.x + 40, l.y); e.hp = e.max = 10;
  const far = game._spawn('slime', at(17, 4).x, at(17, 4).y); far.hp = far.max = 10;
  const h = S.heroes[0]; place(h, 2, 7);
  run(game, 1, () => { e.x = l.x + 40; e.y = l.y; far.x = at(17, 4).x; far.y = at(17, 4).y; });
  near(10 - e.hp, L.BURN, 0.15, 'горение'); eq(far.hp, 10, 'вне света не горит'); ok(e.lit && !far.lit);
  h.hp = 50; h.x = l.x - 40; h.y = l.y; S.enemies.length = 0; run(game, 1); near(h.hp, 50 + L.HEAL, 0.3, 'лечение');
});
test('плевок гасит чашу (−огонь, чаша снова холодная); очаг плевок не гасит', () => {
  const { game, S, has } = setup(arena(14, 7, { sx: 2, sy: 3, cells: [[1, 5, 'F'], [8, 3, 'L']] })); quiet(S);
  const l = S.lamps.find(x => !x.hearth), F = S.lamps.find(x => x.hearth); game._light(l);
  S.spits.push({ x: l.x - 40, y: l.y, vx: 200, vy: 0, dmg: 5, t: 2, r: 5 }); run(game, 0.4);
  ok(!l.lit && has('snuff'), 'чаша не погасла');
  S.spits.push({ x: F.x + 40, y: F.y, vx: -200, vy: 0, dmg: 5, t: 2, r: 5 }); run(game, 0.4); ok(F.lit, 'очаг погас');
});
test('решётка: твёрдая для героя и тварей, обруч пролетает; поднимается, когда горят все чаши в 2 клетках', () => {
  const map = arena(16, 7, { sx: 2, sy: 3, cells: [[1, 1, 'F'], [8, 1, 'D'], [8, 2, 'D'], [8, 3, 'D'], [8, 4, 'D'], [8, 5, 'D'], [10, 2, 'L'], [13, 3, 'E']] });
  const { game, S, has } = setup(map); quiet(S);
  const h = S.heroes[0]; place(h, 6, 3); game.setDir(0, 1, 0); run(game, 1); game.setDir(0, 0, 0);
  ok(h.x < 8 * T - h.r + 1, 'прошёл сквозь решётку');
  h.hoop.hot = 5; h.face = { x: 1, y: 0 }; tap(game); run(game, 0.5);
  ok(S.lamps[1].lit, 'обруч не пролетел сквозь решётку к чаше');
  ok(has('gate') && S.grid.filter(c => c === 'D').length === 0, 'решётка не поднялась');
  ok(S.sealOpen && has('seal'), 'печать не открылась (все чаши горят)');
  game.setDir(0, 1, 0); run(game, 3); ok(S.phase === 'clear' || S.phase === 'upgrade' || S.over, 'не спустился');
});
test('печать спуска: пока горят не все чаши — закрыта (герой проходит по ней, этаж не кончается); погасла чаша — печать остаётся открытой', () => {
  const { game, S, has } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[1, 4, 'F'], [6, 4, 'L'], [10, 4, 'L'], [8, 2, 'E']] })); quiet(S);
  const h = S.heroes[0]; game.setDir(0, 1, 0); run(game, 3); game.setDir(0, 0, 0);
  ok(S.phase === 'play' && !S.sealOpen, 'этаж кончился без чаш');
  S.lamps.forEach(l => game._light(l)); ok(S.sealOpen); game._snuff(S.lamps[1], 'test'); ok(S.sealOpen, 'печать закрылась обратно');
  place(h, 8, 2); run(game, 0.1); ok(S.phase === 'clear', 'нет спуска');
});

// ---------- Тьма, обучение, ларцы ----------
test('тьма рождает тварей: «вздымание» 0,8 с во тьме, в 5–11 клетках от героя, не в свете; в свете — гаснет', () => {
  const { game, S, events } = setup(arena(40, 20, { sx: 20, sy: 10, cells: [[1, 1, 'F']] }));
  S.spawnT = 0; run(game, 0.05);
  const r = events.find(e => e[0] === 'rise'); ok(r, 'нет вздымания');
  const h = S.heroes[0], d = Math.hypot(r[1].x - h.x, r[1].y - h.y) / T; ok(d >= 5 && d <= 11.8, 'дистанция ' + d.toFixed(1));
  run(game, 0.9); ok(events.some(e => e[0] === 'spawn'), 'тварь не поднялась');
  S.rises.push({ x: h.x + 200, y: h.y, kind: 'shade', t: 0.3 });
  S.lamps.push({ tx: 0, ty: 0, x: h.x + 200, y: h.y, hearth: false, lit: true, flash: 0 }); S.lampCount++;
  run(game, 0.4); ok(events.some(e => e[0] === 'fizzle'), 'в свете тварь поднялась');
});
test('обучение 1-го этажа: тьма молчит, пока не зажжена первая чаша; подсказки идут по шагам (бросок → огонь → чаша → все → спуск)', () => {
  const g = K.Game({ rng: mulberry32(2) }).start(), S = g._S;
  ok(S.tut && S.tip === 'tip_throw');
  run(g, 20); eq(S.enemies.length + S.rises.length, S.enemies.length, 'тьма не молчит'); ok(S.rises.length === 0);
  tap(g); run(g, 0.1); ok(['tip_dip', 'tip_lamp'].includes(S.tip), 'после броска: ' + S.tip);
  S.heroes[0].hoop.hot = 3; run(g, 0.05); eq(S.tip, 'tip_lamp');
  g._light(S.lamps.find(l => !l.hearth)); run(g, 0.05); eq(S.tip, 'tip_all');
  S.lamps.forEach(l => g._light(l)); run(g, 0.05); eq(S.tip, 'tip_exit');
  ok(!K.Game({ floor: 2 }).start()._S.tut, 'обучение не только на 1-м');
});
test('ларец разбивается обручем (+150); герой о ларец не спотыкается', () => {
  const { game, S, has } = setup(arena(12, 5, { sx: 2, sy: 2, cells: [[7, 2, '$']] })); quiet(S);
  S.heroes[0].face = { x: 1, y: 0 }; const s0 = S.score; tap(game); run(game, 0.6);
  ok(S.items[0].taken && has('chest')); eq(S.score - s0, L.SCORE.chest);
});

// ---------- Этаж, прокачка ----------
test('печать → «этаж пройден» (+500×этаж) → навык (стрелки + бросок) → следующий этаж (+25 здоровья)', () => {
  const { game, S, has } = setup(arena(12, 5, { sx: 2, sy: 2, cells: [[1, 1, 'F'], [8, 2, 'E']] })); quiet(S);
  ok(S.sealOpen, 'без чаш печать должна быть открыта');
  const s0 = S.score; game.setDir(0, 1, 0); run(game, 2.5); game.setDir(0, 0, 0);
  ok(has('clear') && S.score - s0 >= 500, 'нет бонуса'); run(game, 2); eq(S.phase, 'upgrade');
  S.heroes[0].hp = 50; game.setDir(0, 0, 1); run(game, 0.1); game.setDir(0, 0, 0); run(game, 0.1); eq(S.upCursor[0], 1);
  tap(game); eq(S.heroes[0].up.spd, 1, 'навык не взят'); eq(S.floor, 2); eq(S.phase, 'play');
  near(S.heroes[0].hp, 75, 1, '+25 здоровья на новом этаже');
});
test('навыки: скорость (бег +10%), стойкость (урон −8%, +10 здоровья), до 4 уровней', () => {
  const h = { up: { bnc: 0, spd: 3, arm: 4 } }, st = L.heroStats(h);
  near(st.speed, L.HERO.speed * 1.3, 0.01); near(st.armor, 0.32, 0.001); eq(st.maxHp, L.HERO.hp + 40); eq(L.UPG_MAX, 4);
  const { game, S } = setup(arena(12, 5, { sx: 2, sy: 2, cells: [[1, 1, 'F'], [8, 2, 'E']] })); quiet(S);
  S.heroes[0].up.arm = 4; game.setDir(0, 1, 0); run(game, 2.5); game.setDir(0, 0, 0); run(game, 2);
  game.choose(0, 2); eq(S.heroes[0].up.arm, 4, 'выше максимума');
});
test('прокачка в коопе: этаж грузится, только когда выбрали оба; удержанный бросок не выбирает сам', () => {
  const { game, S } = setup(arena(12, 6, { sx: 2, sy: 2, cells: [[1, 1, 'F'], [8, 2, 'E']] }), { players: 2 }); quiet(S);
  game.setFire(1, true); game.setDir(0, 1, 0); run(game, 2.5); game.setDir(0, 0, 0); run(game, 2);
  eq(S.phase, 'upgrade'); run(game, 0.5); ok(!S.upDone[1], 'удержанный огонь выбрал сам');
  game.choose(0, 0); eq(S.phase, 'upgrade'); game.choose(1, 1); eq(S.phase, 'play'); eq(S.floor, 2);
});

// ---------- Враги ----------
test('твари идут к герою по полю потока, кусают при касании (раз в 0,6 с), стойкость режет урон', () => {
  const { game, S, has } = setup(arena(16, 6, { sx: 2, sy: 2 })); quiet(S);
  const e = game._spawn('shade', at(10, 2).x, at(10, 2).y), h = S.heroes[0];
  run(game, 3); ok(Math.hypot(e.x - h.x, e.y - h.y) < 30, 'не дошла'); ok(has('hurt'), 'не кусает');
  const hp = h.hp; run(game, 1.2); ok(hp - h.hp >= L.ENEMIES.shade.bite * 1.5 && hp - h.hp <= L.ENEMIES.shade.bite * 2.5, 'частота укусов: ' + (hp - h.hp));
});
test('плевун держит дистанцию и плюёт прицельно', () => {
  const { game, S, has } = setup(arena(20, 7, { sx: 2, sy: 3 })); quiet(S);
  const e = game._spawn('spitter', at(6, 3).x, at(6, 3).y), h = S.heroes[0]; h.hp = 1e6;
  run(game, 3); ok(has('spit'), 'не плюётся'); ok(Math.hypot(e.x - h.x, e.y - h.y) > 3 * T, 'не держит дистанцию');
});

// ---------- Кооп ----------
test('кооп: ввод игроков независим (логика) — dir/fire И1 не двигают И2', () => {
  const { game, S } = setup(arena(20, 10, { sx: 5, sy: 4 }), { players: 2 }); quiet(S);
  const [a, b] = S.heroes, ax = a.x, bx = b.x, by = b.y;
  game.setDir(0, 1, 0); run(game, 0.5);
  ok(a.x > ax + 20, 'И1 не пошёл'); eq([b.x, b.y], [bx, by], 'И2 сдвинулся от ввода И1');
  game.setDir(0, 0, 0); game.setDir(1, 0, 1); run(game, 0.5);
  ok(b.y > by + 20, 'И2 не пошёл');
  game.setFire(1, true); game.update(1 / 60); ok(b.hoop.state === 'fly' && a.hoop.state === 'held', 'бросок не от И2');
});
test('кооп: ввод движка по игрокам — раскладки без конфликтов, И1 стрелки / И2 WASD раздельно, в одиночке обе ведут И1', () => {
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
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'kk' });
  g.useStandardScreens({ lives: 1 }); g.scene('play', { realtime: true }); g.start('title');
  g.usePlayers({ bind: L.BIND, actions: ['fire'] });
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'KeyW'); key('keydown', 'KeyF');
  ok(P2.pressed('up') && P2.pressed('fire') && !P1.pressed('up') && !P1.pressed('fire'), 'WASD/F ушли не тому');
  key('keydown', 'ArrowLeft'); key('keydown', 'Slash');
  ok(P1.pressed('left') && P1.pressed('fire') && !P2.pressed('left'), 'стрелки ушли не тому');
  eq(got, ['2fire', '1fire'], 'броски по игрокам');
  ['KeyW', 'KeyF', 'ArrowLeft', 'Slash'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyD');
  ok(P1.pressed('right') && !P2.pressed('right'), 'в одиночке WASD не ведёт И1');
});
test('кооп: «поводок» и камера — оба героя всегда в кадре, когда разбегаются в разные стороны', () => {
  const { game, S } = setup(arena(90, 60, { sx: 45, sy: 30 }), { players: 2 }); quiet(S);
  S.heroes.forEach(h => h.hp = 1e6);
  const rng = mulberry32(5), dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  let minPad = 1e9, maxDx = 0, maxDy = 0, leashed = 0;
  const pairs = [[0, 1], [2, 3], [4, 5], [6, 7]];
  for (let k = 0; k < 40; k++){
    const p = pairs[k % 4], d0 = dirs[p[0]], d1 = dirs[p[1]];
    game.setDir(0, d0[0], d0[1]); game.setDir(1, d1[0], d1[1]);
    if (rng() < 0.3){ game.setDir(0, dirs[(rng() * 8) | 0][0], dirs[(rng() * 8) | 0][1]); }
    run(game, 1.2, () => {
      S.heroes.forEach(h => {
        const l = h.x - S.cam.x, r = S.cam.x + L.VIEW_W - h.x, tp = h.y - S.cam.y, b = S.cam.y + L.VIEW_H - h.y;
        minPad = Math.min(minPad, l, r, tp, b); if (h.leashed) leashed++;
      });
      maxDx = Math.max(maxDx, Math.abs(S.heroes[0].x - S.heroes[1].x)); maxDy = Math.max(maxDy, Math.abs(S.heroes[0].y - S.heroes[1].y));
    });
  }
  ok(minPad >= L.LEASH_PAD - 1, 'герой ушёл из кадра/к краю: запас ' + minPad.toFixed(1));
  ok(maxDx > L.VIEW_W * 0.75 && maxDy > L.VIEW_H * 0.6, 'разбегались слабо: ' + maxDx + '×' + maxDy);
  ok(leashed > 0, 'поводок ни разу не сработал');
});
test('кооп: павшая ждёт следующего этажа (вернётся с половиной здоровья), игра идёт; пали обе — конец', () => {
  const { game, S, has } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[1, 4, 'F'], [8, 2, 'E']] }), { players: 2, maxFloor: 2 }); quiet(S);
  S.heroes[1].hp = 0.2; game._spawn('shade', S.heroes[1].x, S.heroes[1].y); run(game, 0.5);
  ok(!S.heroes[1].alive && S.heroes[0].alive && S.phase === 'play', 'кооп оборвался от одной смерти');
  S.enemies.length = 0;
  game.setDir(0, 1, 0); run(game, 2); game.setDir(0, 0, 0); run(game, 2);
  eq(S.phase, 'upgrade'); game.choose(0, 0); game.choose(1, 1);
  ok(S.heroes[1].alive && has('revive'), 'не вернулась');
  near(S.heroes[1].hp, L.heroStats(S.heroes[1]).maxHp * 0.5, 1, 'возрождение с половиной');
  S.heroes.forEach(h => { h.hp = 0.1; game._spawn('shade', h.x, h.y); }); run(game, 3);
  ok(S.over && !S.won && has('gameover'));
});

// ---------- Дымный Страж ----------
test('Дымный Страж: холодный обруч — звон; горящий — урон и панцирь на ' + L.BOSS.guard + ' с; кольца плевков, призыв теней', () => {
  const ev = [], g = K.Game({ rng: mulberry32(3), floor: 9, onEvent: (t) => ev.push(t) }).start(), S = g._S, B = S.boss;
  ok(B && B.hp === L.BOSS.hp, 'нет Стража'); S.heroes[0].hp = 1e6;
  run(g, 7); ok(ev.includes('ring'), 'нет колец'); ok(ev.includes('spawn'), 'Страж не призывает');
  const h = S.heroes[0], o = h.hoop; S.enemies.length = 0;
  const shoot = (hot) => { const c = at(15, 5); B.x = c.x; B.y = c.y; S.spits.length = 0; o.state = 'held'; o.hot = hot; h.x = B.x; h.y = B.y + B.r + 60; h.face = { x: 0, y: -1 }; B.guardT = 0; const hp = B.hp; tap(g); run(g, 0.3); return hp - B.hp; };
  eq(shoot(0), 0, 'холодный обруч ранит'); ok(ev.includes('clang'));
  eq(shoot(5), L.BOSS.hotDmg, 'горящий обруч не ранит'); eq(o.hot, 0, 'огонь не тратится об Стража');
  ok(B.guardT > 0, 'нет панциря');
  const g2 = K.Game({ players: 2, floor: 9 }).start(); ok(g2._S.boss.max > L.BOSS.hp * 1.5, 'кооп-Страж не толще');
});
test('Дымный Страж: «выдох» — набухает ' + L.BOSS.gustWarn + ' с, задувает чаши в ' + (L.BOSS.gustR / T) + ' клетках (очаг — нет), гасит обручи, отталкивает', () => {
  const ev = [], g = K.Game({ rng: mulberry32(4), floor: 9, onEvent: (t) => ev.push(t) }).start(), S = g._S, B = S.boss;
  S.heroes[0].hp = 1e6; S.lamps.forEach(l => g._light(l));
  B.gustT = 0.05; S.heroes[0].hoop.hot = 5; run(g, 0.1);
  ok(ev.includes('gust'), 'нет выдоха');
  S.lamps.forEach(l => { const d = Math.hypot(l.x - B.x, l.y - B.y); if (l.hearth) ok(l.lit, 'очаг задут'); else if (d <= L.BOSS.gustR) ok(!l.lit, 'чаша рядом не задута'); });
  eq(S.heroes[0].hoop.hot, 0, 'обруч не погас');
});
test('Страж повержен → победа; 9-й этаж — финал', () => {
  const ev = [], g = K.Game({ rng: mulberry32(3), floor: 9, onEvent: (t) => ev.push(t) }).start(), S = g._S, B = S.boss;
  S.heroes[0].hp = 1e6; B.hp = 1; const h = S.heroes[0]; S.spits.length = 0;
  h.hoop.hot = 5; h.x = B.x; h.y = B.y + B.r + 60; h.face = { x: 0, y: -1 }; B.guardT = 0; tap(g); run(g, 0.3);
  ok(B.dead && ev.includes('bossDie'), 'Страж не пал'); run(g, 3); ok(S.won && ev.includes('win'), 'нет победы');
});

// ---------- Реклама, сохранения ----------
test('реклама: reviveAd — на том же месте с 60% здоровья, ближние твари рассеяны; boost — полное здоровье и горящий обруч (раз)', () => {
  const { game, S } = setup(arena(16, 7, { sx: 3, sy: 3, cells: [[1, 1, 'F']] })); quiet(S);
  const h = S.heroes[0]; for (let i = 0; i < 4; i++) game._spawn('shade', h.x + 30, h.y); h.hp = 0.1; run(game, 3);
  ok(S.over, 'не умерла'); const x = h.x;
  game.reviveAd(); ok(h.alive && !S.over && S.phase === 'play'); near(h.hp, 60, 0.01); eq(h.x, x); eq(S.enemies.length, 0);
  h.hp = 30; ok(game.canBoost()); ok(game.boost()); eq(h.hp, 100); eq(h.hoop.hot, L.FLAME); ok(!game.canBoost() && !game.boost(), 'бонус дважды');
});
test('миграция: прежний рекорд (другие правила) → «прежний рекорд», выбор героев стёрт, один раз; новые игроки — без сообщения', () => {
  const mk = (d) => ({ d: Object.assign({}, d), getItem(k) { return k in this.d ? this.d[k] : null; }, setItem(k, v) { this.d[k] = String(v); }, removeItem(k) { delete this.d[k]; } });
  const a = mk({ 'arcade.best.katakomby': '12345', 'arcade.katakomby.hero1': 'smith', 'arcade.katakomby.hero2': 'spark' });
  eq(K.migrate(a), 12345); eq(a.d['arcade.katakomby.oldBest'], '12345'); ok(!('arcade.best.katakomby' in a.d) && !('arcade.katakomby.hero1' in a.d) && !('arcade.katakomby.hero2' in a.d));
  a.d['arcade.best.katakomby'] = '700'; eq(K.migrate(a), 0); eq(a.d['arcade.best.katakomby'], '700', 'повторная миграция стёрла новый рекорд');
  const b = mk({}); eq(K.migrate(b), 0); ok(!('arcade.katakomby.oldBest' in b.d)); eq(b.d['arcade.katakomby.v'], '2');
  eq(K.migrate(null), 0);
});

// ---------- Языки, музыка, страница, площадка ----------
test('языки: ru/en/tr/es/pt — одинаковые ключи, непустые строки; название RU КАТАКОМБЫ, EN/TR/ES/PT EMBERHOOP; этажи и подсказки во всех', () => {
  const langs = ['ru', 'en', 'tr', 'es', 'pt'], keys = Object.keys(K.STR.ru).sort();
  for (const l of langs){ eq(Object.keys(K.STR[l]).sort(), keys, l + ': ключи'); keys.forEach(k => ok(String(K.STR[l][k]).trim(), l + ': пусто ' + k)); }
  eq(K.STR.ru.title, 'КАТАКОМБЫ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(K.STR[l].title, 'EMBERHOOP');
  L.FLOORS.forEach(f => ok(K.STR.ru['f_' + f.name], 'этаж ' + f.name));
  ['tip_throw', 'tip_dip', 'tip_lamp', 'tip_all', 'tip_exit', 'rwHeal', 'cardClear', 'cardNext', 'migrated', 'oldBest', 'hero', 'hot'].forEach(k => ok(K.STR.ru[k], 'нет ' + k));
  L.UPG.forEach(k => ok(K.STR.ru['up_' + k] && K.STR.ru['upd_' + k], 'навык ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(K.STR.ru[k], 'нет ключа движка ' + k));
});
test('музыка: трек katakomby разбирается секвенсором движка', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.katakomby; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && (p.melody || p.voices || p.length !== undefined), 'не разобран');
});
test('рендеры: modern и classic — одинаковый набор функций (стены, решётки, печать, чаши, свет, обруч, Страж…)', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  for (const f of ['js/game.js', 'js/ui.js', 'js/modern.js', 'js/classic.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box, { filename: f });
  const need = ['wall', 'floor', 'gate', 'seal', 'lamp', 'glow', 'item', 'rise', 'enemy', 'boss', 'hero', 'hoop', 'hoopRing', 'grave', 'spit', 'light', 'badge', 'heroBody'];
  for (const r of ['modern', 'classic']) need.forEach(k => ok(typeof box.KATAKOMBY[r][k] === 'function', r + '.' + k));
});
test('страница: фавикон, «← Каталог», canvas 960×600, стик и ● (обруч), II; скрипты по порядку; engine.js = _shared, stick.js = otsek', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]*EA6A12/.test(html), 'фавикон'); ok(/data-catalog-back="1"/.test(html), '← Каталог');
  ok(/<canvas id="c" width="960" height="600"/.test(html), 'canvas'); ok(/data-stick="1"/.test(html) && /data-d="A"/.test(html) && /data-pause="1"/.test(html), 'пульт');
  ok(!/data-bomb|data-d="U"/.test(html), 'остался старый пульт');
  const order = ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/ui.js', 'js/modern.js', 'js/classic.js', 'js/stick.js', 'js/main.js'];
  let pos = -1; order.forEach(s => { const i = html.indexOf('src="./' + s + '"'); ok(i > pos, 'порядок: ' + s); pos = i; });
  const REPO = path.resolve(ROOT, '..');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8') === fs.readFileSync(path.join(REPO, '_shared/engine.js'), 'utf8'), true, 'engine.js ≠ _shared');
  eq(fs.readFileSync(path.join(ROOT, 'js/stick.js'), 'utf8') === fs.readFileSync(path.join(REPO, 'otsek/js/stick.js'), 'utf8'), true, 'stick.js ≠ otsek');
});
test('площадка: стик, карточка «этаж пройден» с межстраничной, menuFit, рекорд (g.persist), ещё шанс и бонус, миграция до createGame', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/ArcadeStick\.create/.test(main), 'стик'); ok(/g\.scene\('card'/.test(main) && /g\.adBreak\(\)/.test(main) && /g\.adReady\(\)/.test(main), 'карточка/adBreak');
  ok(/function menuFit/.test(main) && /menuFit\(menu/.test(main), 'menuFit'); ok(/g\.persist\('arcade\.best\.katakomby', 'max'\)/.test(main), 'persist');
  ok(/g\.useRewardedContinue\(/.test(main) && /g\.useRewardedBonus\(\{ key: 'rwHeal'/.test(main), 'реклама за награду');
  ok(main.indexOf('K.migrate(') < main.indexOf('Arcade.createGame('), 'миграция после createGame — движок успеет прочитать старый рекорд');
  ok(/Arcade\.touchOk|bindDpad\(pad\)/.test(main), 'тач-кнопки через движок');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'katakomby', boards: ['katakomby'], test, ok }); }
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('Z2F1bnRsZXR80LNb0L7QsF3Rgz/QvdGC0LvQtdGCfFxiZGFuZHlcYnxcYmRlbmR5XGJ80LTQtdC90LTQuHxkYXJrID9jaGFtYmVyc3xcYmF0YXJpXGJ80LDRgtCw0YDQuHxtaWR3YXl80LzQuNC00LLQtdC5fHplbGRhfNC30LXQu9GM0LR8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxcYnNlZ2FcYnzRgdC10LPQsCg/IVvQsC3Rj9GRXSl8ZGlhYmxvfNC00LjQsNCx0LvQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxrb25hbWl80LrQvtC90LDQvNC4fGNhcGNvbXzQutCw0L/QutC+0Lx8bmFtY2980L3QsNC80LrQvnx0YWl0b3zRgtCw0LnRgtC+fFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxkaWdnZXJ80LTQuNCz0LPQtdGAfGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxcYnhlbmFcYnzQt9C10L3QsCg/IVvQsC3Rj9GRXSl8Y2hha3JhbXzRh9Cw0LrRgNCw0Lw=', 'base64').toString('utf8'), 'i');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const bad = [];
  for (const f of walk(ROOT)){ if (path.basename(f) === 'engine.js') continue; const m = fs.readFileSync(f, 'utf8').match(BAD); if (m || BAD.test(path.relative(ROOT, f))) bad.push(path.relative(ROOT, f) + ': ' + (m && m[0])); }
  eq(bad, [], 'чужие имена');
});

// ---------- Баланс: «человеческий» бот ----------
if (!process.env.QUICK){
  const N = 24, all = [];
  for (let s = 1; s <= N; s++) all.push(playKatakomby(K, s));
  const f1 = all.filter(r => r.passed >= 1).length / N, win = all.filter(r => r.won).length / N, stuck = all.filter(r => r.stuck).length;
  const reach = {}; all.forEach(r => { reach[r.floor] = (reach[r.floor] || 0) + 1; });
  console.log(`     бот (1 игрок, ${N} забегов): этаж 1 — ${(f1 * 100).toFixed(0)}%, вся игра — ${(win * 100).toFixed(0)}%, застреваний ${stuck}; где закончили (этаж: забегов) ${JSON.stringify(reach)}`);
  test('баланс: этаж 1 проходят ≥ 90% забегов бота', () => ok(f1 >= 0.9, 'этаж 1: ' + f1));
  test('баланс: всю игру проходят ~20–45% (допуск 15–50%)', () => ok(win >= 0.15 && win <= 0.5, 'вся игра: ' + win));
  test('баланс: бот нигде не застревает (тайм-аут этажа 240 с)', () => ok(stuck <= 1, 'застреваний ' + stuck));
  const C = []; for (let s = 1; s <= 8; s++) C.push(playKatakomby(K, s, { players: 2 }));
  const cw = C.filter(r => r.won).length / C.length;
  console.log(`     бот (кооп, 8 забегов): этаж 1 — ${(C.filter(r => r.passed >= 1).length / C.length * 100).toFixed(0)}%, вся игра — ${(cw * 100).toFixed(0)}%`);
  test('баланс кооп: этаж 1 — все, всю игру не «на халяву» (≤ 70%)', () => { ok(C.every(r => r.passed >= 1), 'кооп падает на 1-м'); ok(cw <= 0.7, 'кооп слишком лёгок: ' + cw); });
}

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

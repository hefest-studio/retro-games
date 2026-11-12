/* КАТАКОМБЫ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node katakomby/tests/engine.test.mjs. Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: карты и проходимость (все порядки открывания дверей), бой (молот, искра, автоприцел),
   логова-генераторы, ключи и двери, еда и таяние здоровья, зелья-бомбы, прокачка, кооп (ввод, поводок,
   камера держит обоих, смерть/возрождение), Страж Глубин, i18n, музыка; баланс — «человеческим» ботом. */
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

// Пустая арена W×H (стены по краю) + доп. символы: setup(['#####','#S..#',...])
function arena(w, h, extra = {}){
  const rows = [];
  for (let y = 0; y < h; y++){ let r = ''; for (let x = 0; x < w; x++) r += (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '#' : '.'; rows.push(r); }
  const put = (x, y, c) => { rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1); };
  put(extra.sx || 2, extra.sy || 2, 'S');
  (extra.cells || []).forEach(([x, y, c]) => put(x, y, c));
  return rows;
}
// Игра на своей карте (FLOORS подменяются на время теста)
function setup(map, opts = {}){
  const saved = L.FLOORS.slice();
  L.FLOORS.length = 0; L.FLOORS.push({ name: 'test', map }, { name: 'test2', map });
  const events = [];
  let game;
  try {
    game = K.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  } finally { L.FLOORS.length = 0; saved.forEach(f => L.FLOORS.push(f)); }
  return { game, S: game._S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
const at = (tx, ty) => ({ x: tx * T + T / 2, y: ty * T + T / 2 });
function place(o, tx, ty){ const p = at(tx, ty); o.x = p.x; o.y = p.y; }

// ---------- Карты и проходимость ----------
test('карты: 9 этажей, прямоугольные, стены по краю; 1–8 с выходом, 9-й — логово Стража без выхода', () => {
  eq(L.FLOORS.length, 9);
  L.FLOORS.forEach((f, i) => {
    const F = L.parseFloor(f.map), n = i + 1;
    for (let x = 0; x < F.W; x++) ok(F.grid[x] === '#' && F.grid[(F.H - 1) * F.W + x] === '#', 'этаж ' + n + ': дыра в краю');
    for (let y = 0; y < F.H; y++) ok(F.grid[y * F.W] === '#' && F.grid[y * F.W + F.W - 1] === '#', 'этаж ' + n + ': дыра в краю');
    if (n < 9) ok(F.exit && !F.boss, 'этаж ' + n + ' без выхода'); else ok(F.boss && !F.exit, 'на 9-м — Страж и нет выхода');
    if (n < 9) ok(F.lairs.length >= 2, 'этаж ' + n + ': логов меньше двух');
    ok(F.items.some(it => it.kind === 'food'), 'этаж ' + n + ' без еды');
    ok(K.STR.ru['f_' + f.name] && K.STR.en['f_' + f.name], 'нет названия этажа ' + f.name);
  });
  ok(new Set(L.FLOORS.map(f => f.map.join('|'))).size === 9, 'карты различаются');
  let err = null; try { L.parseFloor(['###', '#S', '###']); } catch (e) { err = e; } ok(err, 'рваная строка — ошибка');
  err = null; try { L.parseFloor(['###', '#Z#', '###']); } catch (e) { err = e; } ok(err, 'неизвестный символ — ошибка');
});

test('проходимость: выход (или Страж) достижим при ЛЮБОМ порядке открывания дверей ключами', () => {
  L.FLOORS.forEach((f, i) => {
    const r = L.solveFloor(f.map);
    ok(r.ok, 'этаж ' + (i + 1) + ' (' + f.name + '): тупиковые наборы дверей ' + JSON.stringify(r.fails.slice(0, 2)));
  });
  // хотя бы на части этажей выход действительно заперт (ключи нужны)
  const locked = L.FLOORS.filter(f => { const F = L.parseFloor(f.map), G = L.doorGroups(F); return G.count > 0 && !L.solveFloor(f.map.map(r => r.replace(/k/g, '.'))).ok; });
  ok(locked.length >= 4, 'запертых без ключей этажей: ' + locked.length);
  // и решатель ловит тупик
  const bad = arena(10, 6, { cells: [[6, 1, '#'], [6, 2, 'D'], [6, 3, '#'], [6, 4, '#'], [8, 2, 'E']] });
  ok(!L.solveFloor(bad).ok, 'выход за дверью без ключа — тупик');
  const two = arena(12, 6, { cells: [[5, 1, '#'], [5, 2, 'D'], [5, 3, '#'], [5, 4, '#'], [8, 1, '#'], [8, 2, 'D'], [8, 3, '#'], [8, 4, '#'], [3, 3, 'k'], [10, 2, 'E']] });
  ok(!L.solveFloor(two).ok, 'один ключ на две двери подряд — тупик');
});

test('все предметы, враги и логова этажей достижимы (при открытых дверях)', () => {
  L.FLOORS.forEach((f, i) => {
    const F = L.parseFloor(f.map), W = F.W, lair = new Set(F.lairs.map(l => l.ty * W + l.tx));
    const seen = new Set([F.start.ty * W + F.start.tx]), st = [...seen];
    while (st.length){ const j = st.pop(), x = j % W, y = (j / W) | 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const k = (y + dy) * W + x + dx; if (seen.has(k) || F.grid[k] === '#' || lair.has(k)) continue; seen.add(k); st.push(k); } }
    F.items.forEach(it => ok(seen.has(it.ty * W + it.tx), 'этаж ' + (i + 1) + ': недостижим ' + it.kind + ' ' + it.tx + ',' + it.ty));
    F.enemies.forEach(e => ok(seen.has(e.ty * W + e.tx), 'этаж ' + (i + 1) + ': недостижим враг'));
    F.lairs.forEach(l => ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => seen.has((l.ty + dy) * W + l.tx + dx)), 'этаж ' + (i + 1) + ': логово в замурованной комнате ' + l.tx + ',' + l.ty));
  });
});

// ---------- Бой ----------
test('Кузнец: удар молотом по ходу — тень впереди гибнет, сзади — цела; очки за врага', () => {
  const { game, S, has } = setup(arena(14, 8, { sx: 6, sy: 4 }), { heroes: ['smith'] });
  S.enemies = []; const front = game._spawn('shade', 0, 0, null), back = game._spawn('shade', 0, 0, null);
  const h = S.heroes[0]; front.x = h.x + 30; front.y = h.y; back.x = h.x - 34; back.y = h.y;
  game.setDir(0, 1, 0); game.update(1 / 60); game.setDir(0, 0, 0); h.x = front.x - 30;   // взгляд вправо
  h.cd = 0; game.setFire(0, true); game.update(1 / 60);
  ok(front.hp <= 0 || !S.enemies.includes(front), 'тень впереди не убита');
  ok(back.hp > 0, 'тень сзади задета');
  ok(has('swing') && has('kill'), 'нет событий swing/kill');
  eq(S.score, L.ENEMIES.shade.score);
});

test('Искорка: искра летит по взгляду, бьёт врага; стена её гасит; автоприцел доворачивает до ±24°', () => {
  const { game, S, has } = setup(arena(20, 9, { sx: 3, sy: 4 }), { heroes: ['spark'] });
  S.enemies = []; const h = S.heroes[0];
  const e = game._spawn('slime', h.x + 160, h.y + 50, null);   // ~17° ниже луча вправо
  h.face = { x: 1, y: 0 }; h.cd = 0;
  game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  const s = S.shots[0]; ok(s, 'нет выстрела');
  ok(s.vy > 0 && Math.abs(Math.atan2(s.vy, s.vx) - Math.atan2(50, 160)) < 0.05, 'автоприцел не довернул');
  const hp0 = e.hp; run(game, 0.6);
  ok(e.hp < hp0 && has('hit'), 'искра не попала');
  // цель за 40° — без доворота
  e.x = h.x + 100; e.y = h.y + 100; game.update(0.5);
  game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  const s2 = S.shots[S.shots.length - 1]; near(s2.vy, 0, 1e-9, 'вне конуса — строго по взгляду');
  // в стену
  S.enemies = []; S.shots = []; h.face = { x: -1, y: 0 };
  game.update(0.5); game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  run(game, 0.5); eq(S.shots.length, 0, 'искра пролетела сквозь стену'); ok(has('wall'));
});

test('Искорка держит направление выстрела, пока зажат огонь (стреляет пятясь); Кузнец бьёт по ходу', () => {
  const { game, S } = setup(arena(20, 9, { sx: 10, sy: 4 }), { heroes: ['spark', 'smith'], players: 2 });
  const sp = S.heroes[0], sm = S.heroes[1];
  sp.face = { x: 1, y: 0 }; sm.face = { x: 1, y: 0 };
  game.setFire(0, true); game.setFire(1, true); game.setDir(0, -1, 0); game.setDir(1, -1, 0);
  run(game, 0.3);
  eq([sp.face.x, sp.face.y], [1, 0], 'искорка развернулась'); ok(sp.x < at(10, 4).x, 'искорка не пятилась');
  eq([sm.face.x, sm.face.y], [-1, 0], 'кузнец не повернулся');
});

test('враги идут к герою по полю потока, кусают при касании (с перезарядкой), броня режет урон', () => {
  const { game, S, has } = setup(arena(16, 10, { sx: 2, sy: 2, cells: [[6, 1, '#'], [6, 2, '#'], [6, 3, '#'], [6, 4, '#'], [6, 5, '#'], [6, 6, '#']] }), { heroes: ['smith'] });
  S.enemies = []; const e = game._spawn('shade', at(9, 3).x, at(9, 3).y, null);
  const h = S.heroes[0], d0 = Math.hypot(e.x - h.x, e.y - h.y);
  run(game, 7);
  ok(Math.hypot(e.x - h.x, e.y - h.y) < 30, 'тень не обошла стену к герою (было ' + d0 + ')');
  ok(has('hurt'), 'нет укуса');
  // урон: тень 6 × (1 − броня 0.25)
  const st = L.heroStats(h); near(st.armor, L.HEROES.smith.armor, 1e-9);
  const before = h.hp; e.biteCd = 0; e.x = h.x + 10; e.y = h.y; game.update(1 / 60);
  ok(before - h.hp >= L.ENEMIES.shade.bite * (1 - st.armor) - 1e-6, 'урон с бронёй');
  ok(before - h.hp < L.ENEMIES.shade.bite + 0.1, 'броня не сработала');
});

// ---------- Логова-генераторы ----------
test('логово: плодит врагов, только когда герой рядом; лимит на логово; разрушается ударами → очки и тишина', () => {
  const map = arena(30, 8, { sx: 2, sy: 4, cells: [[27, 4, 'G']] });
  const far = setup(map, { heroes: ['smith'] });
  run(far.game, 8); eq(far.S.enemies.length, 0, 'далёкое логово плодит');
  const { game, S, has, count } = setup(arena(14, 8, { sx: 3, sy: 4, cells: [[9, 4, 'G']] }), { heroes: ['smith'] });
  const h = S.heroes[0], l = S.lairs[0];
  h.hp = 1e6;                                     // бессмертный для подсчёта
  run(game, 40);
  ok(count('spawn') >= 3, 'логово не плодит: ' + count('spawn'));
  ok(S.enemies.filter(e => e.lair === l).length <= 6, 'превышен лимит логова');
  // ломаем: молотом вплотную
  S.enemies = []; place(h, 8, 4); h.face = { x: 1, y: 0 }; const sc = S.score;
  game.setFire(0, true); run(game, 3); game.setFire(0, false);
  ok(l.hp <= 0 && has('lairDie'), 'логово не разрушено (hp ' + l.hp + ')');
  ok(S.score - sc >= L.SCORE.lair, 'нет очков за логово');
  const n = count('spawn'); h.hp = 1e6; run(game, 10); eq(count('spawn'), n, 'разрушенное логово плодит');
});

test('логово твёрдое: герой не проходит сквозь живое, проходит через руины', () => {
  const { game, S } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[6, 2, 'H']] }), { heroes: ['spark'] });
  const h = S.heroes[0]; h.hp = 1e6; S.lairs[0].t = 1e9;
  game.setDir(0, 1, 0); run(game, 1.5);
  ok(h.x < 6 * T - h.r + 1, 'прошёл сквозь логово');
  S.lairs[0].hp = 0; run(game, 1.5); ok(h.x > 7 * T, 'не прошёл через руины');
});

// ---------- Ключи и двери ----------
test('двери: без ключа — стена; с ключом — открывается вся связная группа, ключ тратится', () => {
  const map = arena(14, 8, { sx: 2, sy: 3, cells: [[7, 1, 'D'], [7, 2, 'D'], [7, 3, 'D'], [7, 4, '#'], [7, 5, '#'], [7, 6, '#'], [4, 5, 'k']] });
  const { game, S, has } = setup(map, { heroes: ['spark'] });
  const h = S.heroes[0]; h.hp = 1e6;
  game.setDir(0, 1, 0); run(game, 2);
  ok(h.x < 7 * T, 'прошёл закрытую дверь'); eq(S.keys, 0);
  game.setDir(0, 0, 0); place(h, 4, 5); run(game, 0.1);
  eq(S.keys, 1, 'ключ не подобран'); ok(has('key'));
  place(h, 5, 3); game.setDir(0, 1, 0); run(game, 2);
  ok(h.x > 8 * T, 'не прошёл открытую дверь'); eq(S.keys, 0, 'ключ не потрачен'); ok(has('door'));
  eq([1, 2, 3].map(y => S.grid[y * S.W + 7]), ['.', '.', '.'], 'открылась не вся группа');
});

// ---------- Еда, таяние здоровья, сундуки ----------
test('здоровье тает DRAIN/с; еда +40 (не выше максимума); сытый еду не берёт; сундук +150', () => {
  const { game, S, has } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[6, 2, 'f'], [8, 2, 'f'], [10, 2, '$']] }), { heroes: ['smith'] });
  const h = S.heroes[0], max = L.heroStats(h).maxHp;
  eq(h.hp, max); run(game, 10);
  near(h.hp, max - 10 * L.DRAIN, 0.2, 'таяние');
  // сытый — не берёт
  h.hp = max; place(h, 6, 2); run(game, 0.05); ok(!S.items[0].taken, 'сытый съел');
  h.hp = 30; run(game, 0.05); ok(S.items[0].taken && has('food'), 'еда не взята'); near(h.hp, 30 + L.FOOD_HP, 0.2);
  h.hp = max - 5; place(h, 8, 2); run(game, 0.05); ok(h.hp <= max, 'выше максимума');
  const sc = S.score; place(h, 10, 2); run(game, 0.05); eq(S.score - sc, L.SCORE.chest); ok(has('chest'));
  // голод убивает
  h.hp = 0.5; run(game, 1); ok(!h.alive && has('heroDie'));
  run(game, 2); ok(S.over && has('gameover'), 'нет конца игры');
});

// ---------- Зелья ----------
test('зелье-бомба: без зелий — нет; с зельем — урон всем врагам в кадре, логовам −3, плевки гасит; вне кадра — цело', () => {
  const { game, S, has } = setup(arena(60, 10, { sx: 2, sy: 4, cells: [[5, 4, 'p']] }), { heroes: ['smith'] });
  const h = S.heroes[0];
  eq(game.bomb(0), false, 'бомба без зелья');
  run(game, 0.6); ok(S.potions === 0, 'зелье поднято раньше времени');
  place(h, 5, 4); run(game, 0.05); eq(S.potions, 1);
  S.enemies = [];
  const inView = [game._spawn('slime', at(10, 4).x, at(10, 4).y, null), game._spawn('spitter', at(20, 2).x, at(20, 2).y, null)];
  const out = game._spawn('shade', at(50, 4).x, at(50, 4).y, null);
  S.spits.push({ x: h.x + 100, y: h.y, vx: -100, vy: 0, dmg: 5, t: 3, r: 5 });
  game._cam();
  eq(game.bomb(0), true); eq(S.potions, 0);
  ok(inView.every(e => e.hp <= 0), 'враги в кадре живы');
  ok(out.hp > 0, 'задет враг вне кадра');
  eq(S.spits.length, 0, 'плевки не погашены'); ok(has('bomb'));
});

// ---------- Прокачка ----------
test('выход → «этаж пройден» (+500×этаж) → прокачка (стрелки + огонь) → следующий этаж; сила/скорость/броня работают', () => {
  const { game, S, has } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[5, 2, 'E']] }), { heroes: ['smith'], maxFloor: 2 });
  const h = S.heroes[0], st0 = L.heroStats(h);
  game.setDir(0, 1, 0); run(game, 1); game.setDir(0, 0, 0);
  eq(S.phase, 'clear'); eq(S.score, L.SCORE.floor);
  run(game, 2); eq(S.phase, 'upgrade');
  // курсор вниз дважды (сила → скорость → броня), огонь — взять
  game.setDir(0, 0, 1); game.update(1 / 60); game.setDir(0, 0, 0); game.update(1 / 60);
  game.setDir(0, 0, 1); game.update(1 / 60); game.setDir(0, 0, 0); game.update(1 / 60);
  eq(S.upCursor[0], 2);
  game.setFire(0, true); game.update(1 / 60); game.setFire(0, false);
  eq(h.up.arm, 1, 'броня не взята'); ok(has('upgrade')); eq(S.floor, 2); eq(S.phase, 'play');
  const st1 = L.heroStats(h);
  near(st1.armor, st0.armor + 0.08, 1e-9); eq(st1.maxHp, st0.maxHp + 10);
  h.up.str = 2; h.up.spd = 1; const st2 = L.heroStats(h);
  near(st2.dmg, st0.dmg * 1.7, 1e-9, 'сила'); near(st2.speed, st0.speed * 1.1, 1e-9, 'скорость'); ok(st2.cd < st0.cd, 'темп');
  h.up.arm = 9; ok(L.heroStats(h).armor <= 0.65, 'броня без потолка');
});

test('прокачка в коопе: этаж грузится, только когда выбрали оба; удержанный огонь не выбирает сам', () => {
  const { game, S } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[6, 2, 'E']] }), { heroes: ['smith', 'spark'], players: 2, maxFloor: 2 });
  game.setFire(0, true); game.setFire(1, true);
  game.setDir(0, 1, 0); run(game, 1.5); game.setDir(0, 0, 0); run(game, 2);
  eq(S.phase, 'upgrade'); run(game, 0.5); eq(S.upDone, [false, false], 'зажатый огонь выбрал сам');
  game.setFire(0, false); game.setFire(1, false); game.update(1 / 60);
  game.choose(0, 0); eq(S.phase, 'upgrade', 'ушли без второго'); eq(S.heroes[0].up.str, 1);
  game.setDir(1, 0, -1); game.update(1 / 60); game.setDir(1, 0, 0); game.update(1 / 60);   // вверх: сила → броня
  eq(S.upCursor[1], 2);
  game.setFire(1, true); game.update(1 / 60);
  eq(S.heroes[1].up.arm, 1); eq(S.floor, 2);
});

// ---------- Кооп ----------
test('кооп: ввод игроков независим (логика) — dir/fire И1 не двигают И2', () => {
  const { game, S } = setup(arena(20, 10, { sx: 5, sy: 4 }), { heroes: ['smith', 'spark'], players: 2 });
  const [a, b] = S.heroes, ax = a.x, bx = b.x, by = b.y;
  game.setDir(0, 1, 0); run(game, 0.5);
  ok(a.x > ax + 20, 'И1 не пошёл'); eq([b.x, b.y], [bx, by], 'И2 сдвинулся от ввода И1');
  game.setDir(0, 0, 0); game.setDir(1, 0, 1); run(game, 0.5);
  ok(b.y > by + 20, 'И2 не пошёл');
  game.setFire(1, true); game.update(1 / 60); ok(S.shots.length === 1 && S.shots[0].pi === 1, 'выстрел не от И2');
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
  g.usePlayers({ bind: L.BIND, actions: ['bomb'] });
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'KeyW'); key('keydown', 'KeyF');
  ok(P2.pressed('up') && P2.pressed('fire') && !P1.pressed('up') && !P1.pressed('fire'), 'WASD/F ушли не тому');
  key('keydown', 'ArrowLeft'); key('keydown', 'Comma'); key('keydown', 'KeyG');
  ok(P1.pressed('left') && !P2.pressed('left'), 'стрелки ушли не тому');
  eq(got, ['1bomb', '2bomb'], 'зелья по игрокам');
  ['KeyW', 'KeyF', 'ArrowLeft', 'Comma', 'KeyG'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyD');
  ok(P1.pressed('right') && !P2.pressed('right'), 'в одиночке WASD не ведёт И1');
});

test('кооп: «поводок» и камера — оба героя всегда в кадре, когда разбегаются в разные стороны', () => {
  const { game, S } = setup(arena(90, 60, { sx: 45, sy: 30 }), { heroes: ['spark', 'smith'], players: 2 });
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

test('кооп: павший ждёт следующего этажа (вернётся с половиной здоровья), игра идёт; пали оба — конец', () => {
  const { game, S, has } = setup(arena(14, 6, { sx: 2, sy: 2, cells: [[8, 2, 'E']] }), { heroes: ['smith', 'spark'], players: 2, maxFloor: 2 });
  S.heroes[1].hp = 0.2; run(game, 0.5);
  ok(!S.heroes[1].alive && S.heroes[0].alive && S.phase === 'play', 'кооп оборвался от одной смерти');
  game.setDir(0, 1, 0); run(game, 2); game.setDir(0, 0, 0); run(game, 2);
  eq(S.phase, 'upgrade'); game.choose(0, 0); game.choose(1, 1);
  ok(S.heroes[1].alive && has('revive'), 'не вернулся');
  near(S.heroes[1].hp, L.heroStats(S.heroes[1]).maxHp * 0.5, 1, 'возрождение с половиной');
  S.heroes.forEach(h => h.hp = 0.1); run(game, 3);
  ok(S.over && !S.won && has('gameover'));
});

// ---------- Страж Глубин ----------
test('Страж Глубин: кольца плевков с «набуханием», призыв теней, ярость с половины; смерть → победа', () => {
  const g = K.Game({ rng: mulberry32(3), floor: 9, onEvent: (t) => ev.push(t) }), ev = [];
  g.start(); const S = g._S, B = S.boss;
  ok(B && B.hp === L.BOSS.hp, 'нет Стража');
  S.heroes[0].hp = 1e6;
  run(g, 7);
  ok(ev.includes('ring') && S.spits.length + ev.filter(x => x === 'hurt').length > 0, 'нет колец');
  ok(ev.includes('spawn'), 'Страж не призывает');
  B.hp = B.max / 2 - 1; const n0 = ev.filter(x => x === 'spit').length; run(g, 5);
  ok(ev.filter(x => x === 'spit').length > n0, 'нет прицельных плевков в ярости');
  B.hp = 1; S.heroes[0].face = { x: 0, y: -1 }; S.heroes[0].x = B.x; S.heroes[0].y = B.y + B.r + 14;
  g.setFire(0, true); run(g, 0.5);
  ok(B.dead && ev.includes('bossDie'), 'Страж не пал');
  run(g, 3); ok(S.won && ev.includes('win'), 'нет победы');
  // кооп: Страж толще
  const g2 = K.Game({ players: 2, floor: 9 }).start(); ok(g2._S.boss.max > L.BOSS.hp * 1.5, 'кооп-Страж не толще');
});

test('9 этажей подряд: финал только на Страже; maxFloor ограничивает игру', () => {
  const { game, S, has } = setup(arena(10, 5, { sx: 2, sy: 2, cells: [[4, 2, 'E']] }), { heroes: ['smith'], maxFloor: 1 });
  game.setDir(0, 1, 0); run(game, 3); ok(S.won && has('win'), 'выход последнего этажа — не победа');
});

// ---------- i18n, музыка ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки', () => {
  const ru = Object.keys(K.STR.ru).sort(), en = Object.keys(K.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(K.STR.ru[k]).trim() && String(K.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(K.STR.ru[k], 'нет ключа движка ' + k));
});
test('музыка: трек katakomby разбирается секвенсором движка', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.katakomby; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && (p.melody || p.voices || p.length !== undefined), 'не разобран');
});

// ---------- Баланс: «человеческий» бот ----------
const N = 30, R = { smith: [], spark: [] };
for (const cls of ['smith', 'spark']) for (let s = 1; s <= N; s++) R[cls].push(playKatakomby(K, s, { heroes: [cls] }));
const all = R.smith.concat(R.spark);
const f1 = all.filter(r => r.passed >= 1).length / all.length, win = all.filter(r => r.won).length / all.length;
const stuck = all.filter(r => r.stuck).length;
console.log(`     бот (1 игрок, ${N}×2 героя): этаж 1 — ${(f1 * 100).toFixed(0)}%, вся игра — ${(win * 100).toFixed(0)}% (Кузнец ${R.smith.filter(r => r.won).length}/${N}, Искорка ${R.spark.filter(r => r.won).length}/${N}), застреваний ${stuck}`);
const reach = {}; all.forEach(r => { reach[r.floor] = (reach[r.floor] || 0) + 1; });
console.log('     где закончили (этаж: забегов): ' + JSON.stringify(reach));
test('баланс: этаж 1 проходят ≥ 90% забегов бота', () => ok(f1 >= 0.9, 'этаж 1: ' + f1));
test('баланс: всю игру проходят ~20–40% (допуск 15–50%)', () => ok(win >= 0.15 && win <= 0.5, 'вся игра: ' + win));
test('баланс: бот нигде не застревает (тайм-аут этажа 240 с)', () => eq(stuck, 0));
const C = []; for (let s = 1; s <= 12; s++) C.push(playKatakomby(K, s, { players: 2, heroes: s % 2 ? ['smith', 'spark'] : ['spark', 'smith'] }));
const cw = C.filter(r => r.won).length / C.length;
console.log(`     бот (кооп, 12 забегов): этаж 1 — ${(C.filter(r => r.passed >= 1).length / C.length * 100).toFixed(0)}%, вся игра — ${(cw * 100).toFixed(0)}%`);
test('баланс кооп: этаж 1 — все, всю игру не «на халяву» (≤ 70%)', () => { ok(C.every(r => r.passed >= 1), 'кооп падает на 1-м'); ok(cw <= 0.7, 'кооп слишком лёгок: ' + cw); });

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

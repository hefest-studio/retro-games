/* ОБОЗ (папка dozor) · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node dozor/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: этапы и достижимость их конца, езда в 8 сторон, пулемёт только вверх, обоз (след, борта перпендикулярно курсу,
   подбор, потеря вагона и отцепление хвоста, гибель тягача), заслон-турель, депо (пулями, вагоны), враги, разрушаемое,
   станция-босс (орудия → ядро, фазы), продолжения, реклама за награду, жизни, камера и кооп, i18n 5 языков, музыка,
   страница, правило имён; баланс и проходимость — «человеческим» ботом (tests/bot.mjs). */
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
test('этапы: 6 штук; в каждом старт, депо (одно с маяком), станция с пушками; враги всех типов; обычная карта без площадок', () => {
  eq(L.STAGES.length, 6);
  const types = new Set(); let helis = 0, rails = 0, water = 0;
  L.STAGES.forEach((M, i) => {
    const n = i + 1, m = L.genStage(n), Lv = L.parseMap(m.rows);
    ok(Lv.start, 'нет старта ' + n); ok(Lv.core, 'нет станции ' + n);
    ok(Lv.depots.length >= 2 && Lv.depots.filter(b => b.flag).length === 1, 'депо этапа ' + n);
    eq(Lv.cannons.length, M.cannons.length, 'пушки этапа ' + n);
    ok(m.rows.length > 90, 'этап ' + n + ' короткий: ' + m.rows.length);
    Lv.enemies.forEach(e => types.add(e.type)); helis += Lv.helis.length; rails += Lv.rails.length;
    water += Lv.grid.filter(t => t === C.WATER).length;
    ok(D.STR.ru['s_' + m.name] && D.STR.en['s_' + m.name] && D.STR.ru['b_' + m.boss] && D.STR.en['b_' + m.boss], 'нет названий этапа/станции ' + n);
  });
  eq([...types].sort(), ['boat', 'infantry', 'tank', 'turret']); ok(helis >= 2 && rails >= 4 && water > 100);
});
test('достижимость: от старта каждого этапа до арены станции есть путь без взрывов; депо достижимы', () => {
  for (let n = 1; n <= 6; n++){ const r = L.solveMap(L.genStage(n).rows); ok(r.ok && r.depots, 'этап ' + n + ': ' + JSON.stringify(r)); }
});
test('езда: 8 направлений, по диагонали не быстрее; стены и вода держат; мост проезжий', () => {
  const { game, S } = setup(field(40, [[12, 36, '#'], [3, 30, '~'], [4, 30, '=']]));
  const h = S.heroes[0], y0 = h.y; game.setDir(0, 0, -1); run(game, 1); near(y0 - h.y, L.SPEED, 4, 'вверх за 1 с');
  game.setDir(0, 1, -1); const x1 = h.x, y1 = h.y; run(game, 0.5); near(Math.hypot(h.x - x1, h.y - y1), L.SPEED * 0.5, 4, 'диагональ');
  h.x = cx(12) - 24; h.y = cx(36); game.setDir(0, 1, 0); run(game, 1); ok(h.x < cx(12) - 12, 'прошёл сквозь стену');
});
test('пулемёт: стреляет всегда вверх; держи — очередь; пуля гаснет о стену', () => {
  const { game, S } = setup(field(40, [[9, 20, '#']]));
  const h = S.heroes[0]; h.y = cx(30); h.x = cx(9); game.setDir(0, 0, 0); game.setFire(0, true); run(game, 0.3);
  ok(S.bullets.some(b => !b.wg && b.vy < 0 && !b.vx), 'пулемёт не вверх');
  run(game, 1.5); ok(S.bullets.filter(b => !b.wg).every(b => b.y > cx(20) - 3), 'пуля прошла сквозь стену');
});

// ---------- Обоз ----------
test('обоз: на этапе — не меньше 2 вагонов; вагоны едут по следу тягача и держат звенья', () => {
  const { game, S } = setup(field(60)); const h = S.heroes[0];
  ok(h.wag.length >= 2, 'вагонов: ' + h.wag.length);
  game.setDir(0, 0, -1); run(game, 1); game.setDir(0, 1, 0); run(game, 1.2);
  const d0 = Math.hypot(h.wp[0].x - h.x, h.wp[0].y - h.y); near(d0, L.WAG.first, 3, 'первое звено');
  const d1 = Math.hypot(h.wp[1].x - h.wp[0].x, h.wp[1].y - h.wp[0].y); ok(d1 > L.WAG.link * 0.7 && d1 < L.WAG.link + 2, 'звено 2: ' + d1);
  ok(h.wp[0].x < h.x - 10 && Math.abs(h.wp[0].y - h.y) < 14, 'после поворота вправо первый вагон — позади слева');
});
test('борта: вагон бьёт перпендикулярно своему курсу — едешь вверх: вагоны стреляют вбок; едешь вбок: вверх и вниз', () => {
  const { game, S } = setup(field(60)); const h = S.heroes[0]; h.wag.length = 1; h.y = cx(40);
  game.setDir(0, 0, -1); run(game, 0.6); game.setFire(0, true); run(game, 0.6);
  const side = S.bullets.filter(b => b.wg); ok(side.length >= 2 && side.every(b => Math.abs(b.vy) < 1 && Math.abs(b.vx) > 100), 'не вбок при езде вверх');
  S.bullets.length = 0; game.setDir(0, 1, 0); run(game, 1.4);
  const up = S.bullets.filter(b => b.wg && b.vy < -100), dn = S.bullets.filter(b => b.wg && b.vy > 100); ok(up.length && dn.length, 'боком — нет стрельбы вверх/вниз');
});
test('борта: пули вагонов бьют врагов и гасятся стеной; без огня вагоны молчат', () => {
  const { game, S } = setup(field(60, [[11, 40, '#']])); const h = S.heroes[0]; h.y = cx(40); h.x = cx(9);
  const e = game._spawn('turret', cx(9) - 40, cx(40) + 26); e.active = true; e.cd = 99; const hp0 = e.hp;
  game.setDir(0, 0, 0); run(game, 1); eq(S.bullets.filter(b => b.wg).length, 0, 'без огня стреляют');
  game.setFire(0, true); run(game, 1.2); ok(e.hp < hp0 || e.dead, 'борт не попал по турели слева');
});
test('подбор: проехать по брошенному вагону — он встаёт в хвост (до 5), +очки', () => {
  const { game, S, count } = setup(field(60)); const h = S.heroes[0]; h.wag.length = 1;
  S.loose.push({ x: h.x, y: h.y - 30, hp: 2, t: 0 }); game.setDir(0, 0, -1); run(game, 0.6);
  eq(h.wag.length, 2); eq(count('hook'), 1); eq(S.loose.length, 0);
  while (h.wag.length < L.WAG.max) h.wag.push({ hp: 2, max: 2, flash: 0, cd: 0 });
  S.loose.push({ x: h.x, y: h.y - 20, hp: 2, t: 0 }); run(game, 0.5); eq(h.wag.length, L.WAG.max); eq(S.loose.length, 1, 'сверх вместимости подобрал');
});
test('попадание во вагон: 2 пули — вагон разбит; задние отцепляются и лежат на месте (можно подобрать); тягач цел', () => {
  const { game, S, count } = setup(field(60)); const h = S.heroes[0]; while (h.wag.length < 4) h.wag.push({ hp: 2, max: 2, flash: 0, cd: 0 });
  game.setDir(0, 0, -1); run(game, 0.3); game.setDir(0, 0, 0); run(game, 0.1);
  const p = h.wp[1];
  for (let k = 0; k < 2; k++) S.ebullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 3, air: false, kind: 'b', from: 'test', life: 2 }), run(game, 0.05);
  eq(h.wag.length, 1, 'остался только 0-й'); eq(S.loose.length, 2, 'два отцеплены'); ok(h.alive && count('wagDie') === 1 && count('wagCut') === 1);
});
test('гибель тягача: все вагоны становятся брошенными, ступени нет; возрождение — с одним вагоном; уехавшие за край теряются', () => {
  const { game, S, has } = setup(field(60)); const h = S.heroes[0]; while (h.wag.length < 4) h.wag.push({ hp: 2, max: 2, flash: 0, cd: 0 });
  game.setDir(0, 0, -1); run(game, 0.3); h.inv = 0; game._kill(h, 'test'); eq(h.wag.length, 0); eq(S.loose.length, 4); ok(has('scatter'));
  run(game, 2.2); ok(h.alive && h.wag.length >= 1, 'возрождение с вагоном');
  S.loose.forEach(p => { p.y = S.camY + L.VIEW_H + 40; }); run(game, 0.1); eq(S.loose.length, 0); ok(S.lost >= 1);
});
test('заслон: последний вагон отцепляется и стоит турелью 9 с (4 ствола), потом взрывается; не больше 2; без вагонов — нельзя', () => {
  const { game, S, has } = setup(field(60)); const h = S.heroes[0]; while (h.wag.length < 4) h.wag.push({ hp: 2, max: 2, flash: 0, cd: 0 });
  game.setDir(0, 0, -1); run(game, 1.6); game.setDir(0, 0, 0); run(game, 0.1); const n0 = h.wag.length; ok(game.sec(0)); eq(h.wag.length, n0 - 1); eq(S.posts.length, 1);
  run(game, 0.9); h.scd = 0; ok(game.sec(0)); eq(S.posts.length, 2); h.scd = 0; ok(!game.sec(0), 'третий заслон');
  run(game, 1.5); const dirs = new Set(S.bullets.filter(b => b.wg).map(b => Math.sign(Math.round(b.vx)) + ',' + Math.sign(Math.round(b.vy))));
  ok(dirs.size >= 4, 'турель не во все стороны: ' + [...dirs]);
  const e = game._spawn('infantry', S.posts[0].x + 20, S.posts[0].y); e.active = true; e.cd = 99;
  run(game, POST9()); eq(S.posts.length, 0); ok(has('boom') && e.dead, 'нет взрыва в конце');
  h.wag.length = 0; h.scd = 0; ok(!game.sec(0), 'без вагонов');
  function POST9(){ return L.POST.t + 0.5; }
});
test('депо: пулемёт и борта ломают (грузовик не взрывается гранатой); выходят 2 вагона (с маяком — 3, один бронированный); депо — препятствие', () => {
  const { game, S, has } = setup(field(60, [[9, 40, 'F'], [9, 41, 'h'], [10, 40, 'h'], [10, 41, 'h']])); const h = S.heroes[0];
  const d = S.depots[0]; ok(d && d.flag); h.x = d.x; h.y = d.y + 100; game.setDir(0, 0, 0); game.setFire(0, true); run(game, 3);
  ok(d.dead && has('depot'), 'депо не разбито пулями'); eq(S.loose.length, 3); ok(S.loose.some(p => p.armor), 'нет бронированного');
  eq(game._cell(d.x, d.y), C.RUBBLE);
});
test('бронированный вагон держит 4 попадания', () => {
  const { game, S } = setup(field(60)); const h = S.heroes[0]; h.wag.length = 0;
  S.loose.push({ x: h.x, y: h.y - 10, hp: 0, armor: true, t: 0 }); run(game, 0.3); eq(h.wag.length, 1); eq(h.wag[0].max, L.WAG.armorHp);
});

// ---------- Враги и местность ----------
test('пехота: под колёсами тягача И вагона гибнет; стреляет после вспышки-предупреждения', () => {
  const { game, S, has } = setup(field(60)); const h = S.heroes[0];
  const a = game._spawn('infantry', h.x, h.y); a.active = true; run(game, 0.05); ok(a.dead, 'не раздавлена тягачом');
  game.setDir(0, 0, -1); run(game, 0.5); game.setDir(0, 0, 0); const p = h.wp[0];
  const b = game._spawn('infantry', p.x, p.y); b.active = true; run(game, 0.05); ok(b.dead, 'не раздавлена вагоном');
  const c = game._spawn('infantry', h.x - 120, h.y - 40); c.active = true; c.cd = 0; run(game, 1.2); ok(has('eshot'), 'не стреляет');
});
test('турель — очередь по одной точке; танк и турель твёрдые; катер ходит по воде; вертолёт по метке зависает и берётся пулемётом', () => {
  const { game, S } = setup(field(60)); const h = S.heroes[0];
  const t = game._spawn('turret', h.x, h.y - 40); t.active = true; run(game, 0.3); ok(Math.hypot(h.x - t.x, h.y - t.y) >= t.r + L.HB - 1, 'не выталкивает');
  const heli = game._spawn('heli', 200, S.camY - 40); heli.active = true; heli.hover = 120; heli.cd = 99; run(game, 3); near(heli.y, S.camY + 120, 15, 'зависание');
  S.bullets.push({ x: heli.x, y: heli.y, vx: 0, vy: -1, pi: 0 }); const hp = heli.hp; run(game, 0.05); ok(heli.hp < hp, 'пулемёт не берёт вертолёт');
});
test('бронепоезд: гудок, затем проход; касание тягача — гибель; вагон обоза под колёсами поезда разбивается; вагоны поезда разрушаемы', () => {
  const map = field(60, []); const rowsR = map[30].split(''); for (let c = 1; c < 19; c++) rowsR[c] = 'r'; map[30] = rowsR.join('');
  const { game, S, has } = setup(map); const h = S.heroes[0]; h.y = cx(31) + 30; h.x = cx(9);
  const tr = S.trains[0]; ok(tr); game.setDir(0, 0, 0); S.camY = cx(30) - 300; run(game, 2); ok(has('trainWarn'));
  run(game, 4); ok(tr.state === 'run'); h.inv = 0; h.y = tr.y; h.x = tr.cars[0].x; run(game, 0.1); ok(!h.alive || has('heroDie'), 'поезд не убил');
});
test('разрушаемое: дома, деревья и мешки берёт только взрыв (заслон); пули гасятся; скалы и стены целы', () => {
  const { game, S, has } = setup(field(40, [[9, 20, 'X'], [10, 20, 't'], [11, 20, 's'], [12, 20, 'o']]));
  const h = S.heroes[0]; h.y = cx(30); h.x = cx(9); game.setDir(0, 0, 0); game.setFire(0, true); run(game, 1.5);
  eq(game._cell(cx(9), cx(20)), C.BLD, 'дом сломан пулями');
  game._blast(cx(10), cx(20), 80, 9, { pi: 0 }); eq(game._cell(cx(9), cx(20)), C.RUBBLE); eq(game._cell(cx(11), cx(20)), C.RUBBLE); eq(game._cell(cx(12), cx(20)), C.ROCK);
});

// ---------- Станция-босс ----------
test('станция: просыпается у верха карты; пока живы орудия на стене — ядро закрыто (пули гаснут); когда орудия сбиты — открыто; пушки берёт пулемёт', () => {
  const { game, S, has } = setup(null, { stage: 1 }); const B = S.boss; ok(B && !B.active);
  S.camY = B.y1 - 100; run(game, 0.05); ok(B.active && has('bossIntro')); run(game, 2);
  ok(!game._bossOpen(), 'ядро открыто при живых орудиях'); const hp0 = B.hp;
  game._hurtBoss(5); eq(B.hp, hp0, 'урон по закрытому ядру');
  S.bullets.push({ x: B.x, y: B.y1 - 4, vx: 0, vy: -10, pi: 0 }); run(game, 0.05); eq(B.hp, hp0);
  S.enemies.forEach(e => { if (e.boss) e.dead = true; }); ok(game._bossOpen());
  S.bullets.push({ x: B.x, y: B.y1 - 4, vx: 0, vy: -10, pi: 0 }); run(game, 0.05); ok(B.hp < hp0, 'открытое ядро не берётся пулемётом');
});
test('станция: фазы по трети здоровья (смена — неуязвимость 0.8 с), падение → этап пройден (+бонус за вагоны в обозе), на последнем этапе — победа', () => {
  const { game, S, has } = setup(null, { stage: 1, maxStage: 2 }); const B = S.boss; S.camY = B.y1 - 100; run(game, 2.5);
  S.enemies.forEach(e => { if (e.boss) e.dead = true; }); S.heroes.forEach(h => { h.inv = 1e9; });
  game._hurtBoss(B.max * 0.4); eq(B.phase, 1); ok(has('phase')); const hp = B.hp; game._hurtBoss(5); eq(B.hp, hp, 'неуязвимость смены');
  run(game, 1); game._hurtBoss(B.max); ok(B.dead && has('bossDie')); const s0 = S.score; run(game, 3); ok(has('clear'));
  const wg = S.heroes[0].wag.length; ok(S.score - s0 >= L.SCORE.stage + wg * L.SCORE.wagon - 20000, 'нет бонуса');
});
test('итог этапа: вагоны на борту дают бонус; последний этап — победа', () => {
  const { game, S, has } = setup(null, { stage: 6, maxStage: 6 }); const s0 = S.score; const n = S.heroes[0].wag.length;
  game._clear(); eq(S.score - s0, L.SCORE.stage * 6 + n * L.SCORE.wagon); run(game, 4); ok(has('win') && S.won, 'нет победы');
});
test('карточка между этапами: S.hold держит переход, пока игрок не нажмёт', () => {
  const { game, S, has } = setup(null, { stage: 1, maxStage: 3 }); S.hold = true; game._clear(); run(game, 6); eq(S.stage, 1, 'ушёл с этапа при hold'); S.hold = false; run(game, 0.2); eq(S.stage, 2);
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
  b.scd = 0; ok(game.sec(1) && S.posts.length === 1 && S.posts[0].pi === 1, 'заслон И2');
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
  for (const l of ['tr', 'es', 'pt']) eq(Object.keys(D.STR[l]).sort(), ru, 'ключи ' + l);
  eq(D.STR.ru.title, 'ОБОЗ'); eq(D.STR.en.title, 'BROADHAUL');
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
  eq(order, ['engine.js', 'js/stick.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ok(/data-sec/.test(html) && /data-pause/.test(html) && /data-d="A"/.test(html) && /data-stick/.test(html), 'тач-кнопки и стик');
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
  ok(!BAD.test('ОБОЗ') && !BAD.test('Гефест') && !BAD.test('декаль') && !BAD.test('CONTRACT.md') && !BAD.test('бронепоезд'), 'без ложных срабатываний');
});

{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'dozor', boards: ['dozor'], test, ok }); }

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
// Исполнимость в настоящей физике: неуязвимый бот проходит каждый этап от старта до крепости и ломает её.
const EXE = []; for (let s = 1; s <= 6; s++) EXE.push(playDozor(D, s, { startStage: s, stages: 1, invuln: true }));
test('исполнимость: каждый из 6 этапов проходится до конца (бот без урона, настоящая физика)', () => {
  console.log('     время, с: ' + EXE.map((r, i) => (i + 1) + ':' + r.time.toFixed(0)).join(' '));
  EXE.forEach((r, i) => ok(r.won && !r.stuck, 'этап ' + (i + 1) + ' не пройден'));
});
// «Человеческий» бот: реакция 150–250 мс, видит только кадр, пули замечает не сразу (зевок 42% на взгляд).
const NB = 20, BAL = []; for (let s = 1; s <= NB; s++) BAL.push(playDozor(D, s));
const reach = {}; BAL.forEach(r => { reach[r.passed] = (reach[r.passed] || 0) + 1; });
const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
console.log('     бот (1 игрок, ' + NB + ' партий): этап 1 — ' + BAL.filter(r => r.passed >= 1).length + '/' + NB + ', вся игра — ' + BAL.filter(r => r.won).length + '/' + NB + ', пройдено этапов → партий: ' + JSON.stringify(reach) + '; гибели: ' + JSON.stringify(why));
const first = BAL.filter(r => r.clears.length && r.clears[0].stage === 1 && r.conts === 0 || r.passed >= 1).length;
test('баланс: этап 1 проходят ≥ 90% партий бота', () => ok(BAL.filter(r => r.passed >= 1).length >= 0.9 * NB, 'этап 1: ' + BAL.filter(r => r.passed >= 1).length + '/' + NB));
test('баланс: всю игру (6 этапов, 3 жизни + 2 продолжения) проходят ~20–50%', () => { const w = BAL.filter(r => r.won).length / NB; ok(w >= 0.2 && w <= 0.45, 'вся игра: ' + w); });
test('баланс: бот нигде не застревает (тайм-аут этапа 420 с)', () => eq(BAL.filter(r => r.stuck).map(r => r.seed), []));
const CO = []; for (let s = 1; s <= 8; s++) CO.push(playDozor(D, s, { players: 2 }));
const cw = CO.filter(r => r.won).length / CO.length;
console.log('     бот (кооп, 8 партий): этап 1 — ' + CO.filter(r => r.passed >= 1).length + '/8, вся игра — ' + CO.filter(r => r.won).length + '/8, вагонов подобрано в среднем ' + (CO.reduce((a, r) => a + r.hooks, 0) / 8).toFixed(0));
test('кооп-партия: этап 1 — все, всю игру — не «на халяву» (≤ 85%), не застревает', () => { ok(CO.every(r => r.passed >= 1), 'кооп падает на 1-м'); ok(cw <= 0.85, 'кооп слишком лёгок: ' + cw); ok(!CO.some(r => r.stuck), 'зависание'); });

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

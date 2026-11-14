/* ЛАЗУТЧИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node lazutchik/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, setTimeout };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/map.js', 'js/game.js', 'js/audio.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const LZ = sandbox.LZ, M = LZ.MAP, L = LZ.logic, K = L.K, T = M.T, C = M.C, dt = 1 / 60;
const B = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, tol, m){ if (Math.abs(a - b) > tol) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

function mk(diff = 1, opts = {}){
  const ev = [];
  const game = LZ.Game(Object.assign({ diff, rng: B.mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state(); if (!opts.keepFoes) S.enemies = [];
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, clear: () => ev.length = 0 };
}
function run(game, sec, dx = 0, dy = 0, runK = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, runK); game.update(dt); } }
const cx = (X, c) => (X * 20 + c) * T + 16, fy = Y => (Y * 10 + 9) * T;

// ---------- комплекс ----------
test('комплекс: 62 экрана сетки 12×6, все 11 зон, двери трёх цветов, лифт, люки, дрезина', () => {
  eq(M.count(), 62); const m = M.build(1);
  eq(new Set(m.screens.filter(Boolean).map(s => s.zone)).size, 11);
  eq(m.doors.map(d => d.color).sort().join(','), 'blue,red,yellow');
  ['red', 'blue', 'yellow'].forEach(c => ok(m.items.some(i => i.k === 'card' && i.color === c), 'карта ' + c));
  ok(m.items.some(i => i.k === 'matrix'), 'матрица'); eq(m.lifts.length, 1); eq(m.hatches.length, 2); eq(m.grates.length, 1); ok(m.shutters.length >= 3);
  ok(m.items.filter(i => i.k === 'thermos').length >= 8, 'термосы'); ok(m.items.filter(i => L.ITEMS[i.k]).length >= 20, 'метательные предметы');
  ok(m.shadows.length >= 60, 'укрытия с тенью: ' + m.shadows.length);
});
test('генерация детерминирована; геометрия одинакова на всех сложностях', () => {
  const A = M.build(3), Bm = M.build(3), D5 = M.build(5);
  eq(Buffer.from(A.t).toString('base64'), Buffer.from(Bm.t).toString('base64')); eq(JSON.stringify(A.guards), JSON.stringify(Bm.guards));
  eq(Buffer.from(A.t).toString('base64'), Buffer.from(D5.t).toString('base64'));
});
test('сложности: больше стражи, короче завод будильника, меньше попыток; с «Лазутчика» — изменённые маршруты', () => {
  const n = [1, 2, 3, 4, 5].map(d => M.build(d).guards.length);
  for (let i = 1; i < 5; i++) ok(n[i] > n[i - 1], 'стража: ' + n.join(','));
  ok(n[0] >= 12 && n[4] >= 50, 'стража: ' + n.join(','));
  const D = L.DIFF; for (let i = 1; i < 5; i++){ ok(D[i].timer < D[i - 1].timer, 'таймер'); ok(D[i].lives <= D[i - 1].lives || i === 4, 'попытки'); ok(D[i].see >= D[i - 1].see && D[i].dmg >= D[i - 1].dmg); }
  const g2 = M.build(2).guards, g3 = M.build(3).guards; let moved = 0;
  g2.forEach(a => { const b = g3.find(x => x.id === a.id); if (b && (Math.abs(b.x - a.x) > 64 || b.p1 - b.p0 > a.p1 - a.p0 + 32)) moved++; });
  ok(moved >= g2.length * 0.5, 'маршрутов изменено: ' + moved + '/' + g2.length);
});

// ---------- физика героя ----------
test('ходьба ≈86 px/с тихо; бег ≈170 px/с, тратит энергию и шумит; присед — крадётся ≈46 px/с', () => {
  let h = mk(); h.game._place(cx(0, 6), fy(5), 1); const x0 = h.S.hero.x; run(h.game, 1, 1);
  near(h.S.hero.x - x0, 86, 4, 'шаг'); ok(!h.has('step'), 'ходьба без шума');
  h = mk(); h.game._place(cx(0, 6), fy(5), 1); run(h.game, 1, 1, 0, true);
  near(h.S.hero.x - cx(0, 6), 170, 8, 'бег'); ok(h.has('step') && h.has('noise'), 'бег шумит'); ok(h.S.hero.en < 95, 'энергия');
  h = mk(); h.game._place(cx(0, 6), fy(5), 1); run(h.game, 1, 1, 1);
  near(h.S.hero.x - cx(0, 6), 46, 4, 'присед'); ok(h.S.hero.crouch);
});
test('лестница сквозь перекрытие: из канализации наверх в шахту и обратно', () => {
  const h = mk(); h.game._place(cx(1, 4), fy(5), 1);
  run(h.game, 5, 0, -1); ok(h.S.hero.ground && !h.S.hero.climb, 'стоит'); eq(h.S.hero.y, fy(4), 'этаж выше');
  run(h.game, 0.3, 1, 0); ok(h.S.hero.x > cx(1, 4) + 10, 'сошёл с лестницы вбок');
  h.game._place(cx(1, 4), fy(4), 1); run(h.game, 5, 0, 1); eq(h.S.hero.y, fy(5), 'обратно вниз');
});
test('люк: присел на люке — открыл и спрыгнул этажом ниже (без урона); люк сам захлопывается', () => {
  const h = mk(), hx = M.build(1).hatches.find(q => Math.floor(q.tx / 20) === 8);
  h.game._place(hx.tx * T + 16, hx.ty * T, 1); const hp = h.S.hero.hp;
  run(h.game, 2.5, 0, 1); ok(h.has('hatch'), 'открыт'); eq(h.S.hero.y, fy(5), 'внизу'); eq(h.S.hero.hp, hp, 'без урона');
  run(h.game, 2, 0, 0); eq(h.S.wd.open[hx.ty * h.S.wd.W + hx.tx], 0, 'захлопнулся');
});
test('лифт: площадки на трёх этажах, ↑/↓ — поездка; выше верхней остановки — нельзя', () => {
  const h = mk(), lf = h.S.map.lifts[0], x = lf.x;
  h.game._place(x, lf.stops[2] * T, 1);
  run(h.game, 0.05, 0, -1); run(h.game, 3, 0, 0); eq(h.S.hero.y, lf.stops[1] * T, '2-я остановка');
  run(h.game, 0.05, 0, -1); run(h.game, 3, 0, 0); eq(h.S.hero.y, lf.stops[0] * T, 'верх');
  h.clear(); run(h.game, 0.05, 0, -1); run(h.game, 1, 0, 0); eq(h.S.hero.y, lf.stops[0] * T); ok(h.has('liftEnd'));
  run(h.game, 0.05, 0, 1); run(h.game, 3, 0, 0); eq(h.S.hero.y, lf.stops[1] * T, 'вниз');
});
test('дрезина: с восточной станции до западной за ~10 с; на пустой станции — вызов', () => {
  const h = mk(), c = h.S.map.cart;
  h.game._place(c.b, c.y, -1); run(h.game, 0.05, 0, -1); ok(h.S.hero.ride, 'едет'); run(h.game, 11, 0, 0);
  near(h.S.hero.x, c.a, 1, 'приехал'); ok(!h.S.hero.ride);
  h.game._place(c.b, c.y, -1); h.clear(); run(h.game, 0.05, 0, -1); ok(h.has('cartCall'), 'вызов'); run(h.game, 11, 0, 0); near(h.S.wd.cart.x, c.b, 1, 'дрезина пришла');
});
test('цветная дверь: без карты — «нужна карта», с картой открывается навсегда', () => {
  const h = mk(), d = h.S.map.doors.find(q => q.color === 'red'), y = (d.r1 + 1) * T;
  h.game._place(d.tx * T - 30, y, 1); run(h.game, 1, 1); ok(h.S.hero.x < d.tx * T, 'упёрся'); ok(h.has('locked'));
  h.game._give('red'); run(h.game, 1, 1); ok(h.S.hero.x > (d.tx + 1) * T, 'прошёл'); ok(h.has('door'));
  run(h.game, 1, -1); ok(h.S.hero.x < d.tx * T, 'и обратно');
});
test('решётка: с запада заперта; рычаг (↑) — только с восточной стороны', () => {
  const h = mk(), g = h.S.map.grates[0], y = (g.r1 + 1) * T;
  h.game._place(g.tx * T - 30, y, 1); run(h.game, 1, 1); ok(h.S.hero.x < g.tx * T); ok(h.has('grateLocked'));
  run(h.game, 0.05, 0, -1); run(h.game, 0.1); ok(!h.S.wd.open[g.r0 * h.S.wd.W + g.tx], 'с запада не открыть');
  h.game._place((g.tx + 1) * T + 16, y, -1); run(h.game, 0.05, 0, -1); run(h.game, 0.1); ok(h.has('grate')); run(h.game, 1, -1); ok(h.S.hero.x < g.tx * T, 'прошёл на запад');
});

// ---------- граф проходимости ----------
const MAP1 = M.build(1), NAV = B.navFor(LZ, MAP1), G = B.stateGraph(NAV), FW = B.forward(G), WIN = B.canWinSet(G, FW);
test('граф по физике: все 62 экрана достижимы, рёбер всех видов достаточно', () => {
  ok(NAV.nodes.size > 1000, 'узлов ' + NAV.nodes.size);
  const scr = new Set(); for (const s of FW){ const n = NAV.nodes.get(Math.floor(s / 64)); scr.add(Math.floor(n.x / 20) + ',' + Math.floor((n.r - 1) / 10)); }
  eq(scr.size, 62, 'экранов достижимо');
  const k = {}; for (const n of NAV.nodes.values()) for (const e of n.out) k[e.k] = (k[e.k] || 0) + 1;
  ok(k.U >= 20 && k.D >= 20 && k.H === 2 && k.LU >= 2 && k.LD >= 2 && k.C === 2, JSON.stringify(k));
});
test('нет софтлоков: из любого достижимого состояния (узел × ключи × фаза) победа ещё возможна', () => {
  ok(G.won && FW.size > 5000, 'состояний ' + FW.size);
  const bad = [...FW].filter(s => !WIN.has(s));
  eq(bad.length, 0, 'тупиковых состояний');
  ok(WIN.has(G.startState), 'старт выигрышен');
});
test('ключи до дверей: красная → синяя → жёлтая → матрица (обойти дверь нельзя)', () => {
  for (const s of FW){
    const m = s % 64;
    if (m & B.BIT.blue) ok(m & B.BIT.red, 'синяя без красной');
    if (m & B.BIT.yellow) ok(m & B.BIT.blue, 'жёлтая без синей');
    if (m & B.BIT.matrix) ok(m & B.BIT.yellow, 'матрица без жёлтой');
    if (m & B.BIT.planted) ok(m & B.BIT.matrix, 'будильник без матрицы');
  }
});
test('успевание к выходу: таймер каждой сложности ≥ 1,5× кратчайшего пути шагом; на «Стороже» и «Обходчике» — успеть и без люка', () => {
  const plant = [...NAV.plant][0], s0 = plant * 64 + (B.BIT.red | B.BIT.blue | B.BIT.yellow | B.BIT.matrix | B.BIT.planted);
  const tf = B.fastest(G, s0) / 60, tl = B.fastest(B.stateGraph(NAV, { noHatch: true }), s0) / 60;
  console.log('     бегство шагом: через люк и дрезину ' + tf.toFixed(1) + ' с, без люка ' + tl.toFixed(1) + ' с; таймеры: ' + L.DIFF.map(d => d.timer).join(', '));
  ok(tf < tl * 0.7, 'люк — заметно короче');
  L.DIFF.forEach((d, i) => ok(d.timer >= 1.5 * tf, 'сложность ' + (i + 1) + ': ' + d.timer + ' < 1.5×' + tf.toFixed(1)));
  ok(L.DIFF[0].timer >= 1.25 * tl && L.DIFF[1].timer >= 1.25 * tl, 'без люка на 1–2');
  ok(L.DIFF[4].timer <= 3 * tf, '«Призрак» напряжён');
});

// ---------- зрение, тень, шум ----------
function guardAt(S, X, Y, k, x, face){ const g = { k, x, y: fy(Y), p0: x - 64, p1: x + 64, b0: X * 20 * T + 40, b1: (X + 1) * 20 * T - 40, sleep: false, face, X, Y, id: 999 }; const e = LZ.Game({ diff: S.diff }).start().state().enemies[0]; return Object.assign(e, { k, x, y: g.y, face, st: 'patrol', sleep: false, out: false, down: 0, stun: 0, p0: g.p0, p1: g.p1, b0: g.b0, b1: g.b1, susp: 0, sx: x }); }
test('конус взгляда (светлый цех): видит спереди в пределах дальности, не видит сзади и дальше', () => {
  const h = mk(3), S = h.S, ex = cx(5, 3), e = guardAt(S, 5, 2, 'boxer', ex, 1);
  h.game._place(ex + 5 * T, fy(2), -1); ok(L.canSee(S, e, S.hero), '5 клеток спереди');
  h.game._place(ex - 3 * T, fy(2), 1); ok(!L.canSee(S, e, S.hero), 'сзади');
  h.game._place(ex + L.sightRange(S, e, S.hero) + 20, fy(2), -1); ok(!L.canSee(S, e, S.hero), 'за дальностью');
});
test('тень укрытий: присел в тени — невидим даже вблизи; стоя в тени — виден', () => {
  const h = mk(3), S = h.S, sh = S.map.shadows.find(s => { const sc = L.screenAt(S.map, s.x0 + 20, s.y); return sc && !sc.dark; });
  const hx = (sh.x0 + sh.x1) / 2, X = Math.floor(hx / (20 * T)), Y = Math.floor((sh.y - 1) / (10 * T));
  const e = guardAt(S, X, Y, 'boxer', hx + 3 * T > (X + 1) * 640 - 40 ? hx - 3 * T : hx + 3 * T, 0); e.face = hx > e.x ? 1 : -1;
  h.game._place(hx, sh.y, 1); ok(L.canSee(S, e, S.hero), 'стоит — виден');
  S.hero.crouch = true; ok(L.hidden(S.map, S.hero), 'в тени'); ok(!L.canSee(S, e, S.hero), 'присел — невидим');
});
test('темнота: в тёмном экране видят ближе; фонарик-прищепка делает заметным; лампа — островок света', () => {
  const h = mk(3), S = h.S, X = 3, Y = 5, scr = S.map.screens[Y * 12 + X]; ok(scr.dark, 'канализация тёмная');
  ok(S.map.pools.length > 0 && S.map.pools.every(p => L.isLit(S.map, { x: (p.x0 + p.x1) / 2, y: p.y, flash: false })), 'лампы светят');
  const inPool = x => S.map.pools.some(p => x >= p.x0 && x <= p.x1 && Math.floor(p.x0 / 640) === X && Math.floor((p.y - 1) / 320) === Y);
  let hx = null; for (let c = 5; c < 18 && hx == null; c++){ const x = cx(X, c); if (!inPool(x) && !inPool(x - 2 * T)) hx = x; }
  if (hx == null){ S.map.pools = []; hx = cx(X, 12); }
  const e = guardAt(S, X, Y, 'boxer', hx - 4 * T, 1);
  h.game._place(hx, fy(Y), -1); ok(!L.isLit(S.map, S.hero), 'темно'); ok(!L.canSee(S, e, S.hero), '4 клетки в темноте — не видит');
  S.hero.x = hx - 2 * T; ok(L.canSee(S, e, S.hero), '2 клетки — видит');
  S.hero.x = hx; S.hero.flash = true; ok(L.canSee(S, e, S.hero), 'с фонариком — видит');
});
test('другой этаж и другой экран не видны; пёс-автомат видит ближе', () => {
  const h = mk(3), S = h.S, cat = S.map.cats.find(c => !S.map.screens[c.Y * 12 + c.X].dark);
  const ex = cx(cat.X, cat.a + 1), e = guardAt(S, cat.X, cat.Y, 'boxer', ex - 3 * T, 1);
  h.game._place(ex, cat.ty * T, 1); ok(!L.canSee(S, e, S.hero), 'на мостках над стражем');
  const e2 = guardAt(S, 5, 2, 'boxer', cx(5, 18), 1); h.game._place(cx(6, 2), fy(2), 1); ok(!L.canSee(S, e2, S.hero), 'соседний экран');
  const d = guardAt(S, 5, 2, 'dog', cx(5, 3), 1), b = guardAt(S, 5, 2, 'boxer', cx(5, 3), 1);
  ok(L.sightRange(S, d, S.hero) < L.sightRange(S, b, S.hero) * 0.7);
});
test('шум: бег рядом поднимает стража проверить; шаг — нет; спящего будит шум', () => {
  let h = mk(1, { keepFoes: true }); const S = h.S;
  const e = S.enemies.find(q => q.st === 'patrol' && !L.screenAt(S.map, q.x, q.y).dark);
  const X = Math.floor(e.x / 640); e.face = 1; e.p0 = e.p1 = e.x; e.wait = 99;
  const sx = e.x - 130 < X * 640 + 50 ? e.x + 130 : e.x - 130;
  S.enemies = [e]; h.game._place(sx, e.y, sx < e.x ? -1 : 1); e.face = sx < e.x ? 1 : -1;
  run(h.game, 0.6, sx < e.x ? 1 : -1, 0, false); eq(e.st, 'patrol', 'шаг тихий');
  h.game._place(sx, e.y, 1); run(h.game, 0.5, sx < e.x ? 1 : -1, 0, true); eq(e.st, 'look', 'бег услышан');
  h = mk(1, { keepFoes: true }); const sl = h.S.enemies.find(q => q.sleep); ok(sl, 'есть спящий');
  h.S.enemies = [sl]; h.game._place(sl.x - 120, sl.y, 1); run(h.game, 0.6, 1, 0, true); ok(!sl.sleep && h.has('wake'), 'проснулся');
});
test('брошенный предмет: шум в месте падения отвлекает стража', () => {
  const h = mk(1, { keepFoes: true }), S = h.S, e = S.enemies.find(q => q.st === 'patrol');
  S.enemies = [e]; e.face = -1; e.p0 = e.p1 = e.x; e.wait = 99;
  const X = Math.floor(e.x / 640); h.game._place(e.x - 250 < X * 640 + 40 ? e.x + 250 : e.x - 250, e.y, 1);
  S.hero.face = S.hero.x < e.x ? 1 : -1; S.hero.held = 'brick';   // кирпич летит дугой и падает, не долетев до стража
  h.game.press('item'); run(h.game, 1.5); ok(h.has('toss') && h.has('clang'), 'бросок и удар о стену'); ok(e.st === 'look' || e.st === 'chase', 'страж пошёл на шум: ' + e.st);
  ok(S.items.some(i => i.k === 'brick' && !i.taken && Math.abs(i.y - e.y) < 2), 'кирпич лежит на полу');
});

// ---------- бой ----------
function duel(k, opts = {}){
  const h = mk(opts.diff || 1, { keepFoes: true }), S = h.S;
  const e = S.enemies.find(q => !L.screenAt(S.map, q.x, q.y).dark && q.st === 'patrol' && [-60, -20, 0, 30, 60, 130].every(o => S.wd.tile(Math.floor((q.x + o) / T), Math.round(q.y / T)) === C.S) && [-60, -20, 0, 30, 60, 130].every(o => S.wd.tile(Math.floor((q.x - o) / T), Math.round(q.y / T)) === C.S));
  S.enemies = [e]; Object.assign(e, { k, hp: opts.hp || 5, max: 5, face: opts.eFace || -1, p0: e.x, p1: e.x, wait: 99, st: opts.st || 'patrol', seenT: 0 });
  h.game._place(e.x + (opts.dx || 30) * (opts.side || 1), e.y, -(opts.side || 1));
  return { h, S, e };
}
test('тихий нокаут: удар сзади по ничего не подозревающему стражу', () => {
  const { h, S, e } = duel('boxer', { eFace: -1, side: 1, dx: 26 });   // страж смотрит влево, герой справа — сзади
  h.game.press('punch'); run(h.game, 0.3); ok(e.out, 'в нокауте'); eq(S.takedowns, 1); eq(S.alarmT, 0, 'без тревоги');
});
test('стили стражи: вахтёр бьёт высоко (присед — уклон), пёс низкий (рука стоя — мимо, нога — попадает), кочегара не бросить', () => {
  let d = duel('boxer', { st: 'chase', eFace: 1, side: 1, dx: 30 }); d.S.hero.hp = 10;
  d.h.game.setInput(0, 1, false); for (let i = 0; i < 90; i++){ d.h.game.setInput(0, 1); d.h.game.update(dt); }
  ok(d.h.has('duck'), 'уклон'); eq(d.S.hero.hp, 10, 'не задело');
  d = duel('dog', { st: 'chase', eFace: 1, side: 1, dx: 28 }); d.e.cd = 9;
  d.h.game.press('punch'); run(d.h.game, 0.35); ok(d.h.has('whiff'), 'рука над псом'); const hp0 = d.e.hp;
  d.h.game.press('kick'); run(d.h.game, 0.5); ok(d.e.hp < hp0 || d.e.out, 'нога попала');
  d = duel('heavy', { st: 'chase', eFace: 1, side: 1, dx: 24 }); d.e.cd = 9;
  d.h.game.setInput(0, -1); d.h.game.press('punch'); run(d.h.game, 0.6, 0, -1); ok(d.h.has('tooHeavy'), 'не поднять');
  d = duel('heavy', { st: 'chase', eFace: 1, side: 1, dx: 30 }); d.e.cd = 9;
  d.h.game.setInput(0, 1); d.h.game.press('kick'); run(d.h.game, 0.25, 0, 1); ok(d.e.down > 0, 'подсечка роняет');
});
test('метательный предмет попадает в стража; одно в руке', () => {
  const { h, S, e } = duel('boxer', { st: 'chase', eFace: 1, side: 1, dx: 120 }); e.cd = 9; e.hp = 9;
  const it = S.items.find(i => i.k === 'wrench'); h.game._place(it.x, it.y, 1);
  h.game.press('item'); eq(S.hero.held, 'wrench'); h.game.press('item'); ok(S.hero.held === 'wrench', 'второе не взять, пока в руке');
  h.game._place(e.x + 120, e.y, -1); h.game.press('item'); run(h.game, 1); ok(e.hp < 9, 'попал'); eq(S.hero.held, null);
});
test('урон, гибель, попытки, контрольная точка у входа в экран', () => {
  const h = mk(1), S = h.S; h.game._place(cx(0, 8), fy(5), 1); run(h.game, 0.2);
  S.hero.hp = 0.1; S.hero.inv = 0; const lv = S.lives;
  S.enemies = [Object.assign(guardAt(S, 0, 5, 'boxer', cx(0, 9), -1), { st: 'chase', cd: 0 })];
  run(h.game, 3); ok(h.has('die'), 'погиб'); eq(S.lives, lv - 1); eq(S.hero.hp, K.HP, 'здоровье восстановлено'); ok(!S.hero.dead);
});

// ---------- тревога, цель, финал ----------
test('тревога: заметили — створки закрываются; спрятался — через время тревоги всё стихает', () => {
  const h = mk(3, { keepFoes: true }), S = h.S, e = S.enemies.find(q => q.X === 5 && q.Y === 2 && q.k === 'heavy');
  S.enemies = [e]; e.face = 1; e.p0 = e.p1 = e.x; e.wait = 99; e.x = Math.min(e.x, cx(5, 10));
  h.game._place(e.x + 3 * T, e.y, -1); run(h.game, 2); ok(S.alarmT > 0 && h.has('alarm'), 'тревога'); ok(S.wd.shut, 'створки закрыты');
  h.game._place(cx(1, 8), fy(4), 1); run(h.game, S.D.alarm + 1); eq(S.alarmT, 0); ok(!S.wd.shut, 'створки открыты'); ok(h.has('calm'));
});
test('будильник: без матрицы не заложить; заложил — пошёл таймер; выход у водостока — победа', () => {
  const h = mk(2), S = h.S, p = S.map.plant;
  h.game._place(p.x, p.y, 1); run(h.game, 2, 0, -1); ok(!S.planted && h.has('needMatrix'));
  h.game._give('matrix'); run(h.game, 1.5, 0, -1); ok(S.planted && h.has('planted')); near(S.bombT, L.DIFF[1].timer, 1);
  h.game._place(S.map.exit.x1 + 40, S.map.exit.y, -1); run(h.game, 1, -1); ok(S.won && h.has('win')); ok(S.score > 0);
});
test('будильник прозвенел раньше выхода — поражение; без будильника выход не засчитывается', () => {
  let h = mk(5); h.game._place(h.S.map.exit.x1 - 20, h.S.map.exit.y, -1); run(h.game, 0.5); ok(!h.S.won, 'без будильника');
  h = mk(5); h.game._plant(); run(h.game, L.DIFF[4].timer + 1); ok(h.S.over && !h.S.won); eq(h.S.lose, 'ring');
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек lazutchik подключается по gameId', () => {
  const Tr = sandbox.Arcade.tracks.lazutchik; ok(Tr && Tr.bpm > 0 && Tr.melody && Tr.bass && Tr.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(Tr.melody) % 8, 0); eq(n(Tr.bass) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; есть названия всех зон, сложностей, предметов', () => {
  const ru = Object.keys(LZ.STR.ru).sort(), en = Object.keys(LZ.STR.en).sort(); eq(ru.join(','), en.join(','));
  Object.values(M.ZONES).forEach(z => ok(LZ.STR.ru['z_' + z] && LZ.STR.en['z_' + z], z));
  for (let d = 1; d <= 5; d++) ok(LZ.STR.ru['d' + d] && LZ.STR.en['d' + d]);
  Object.keys(L.ITEMS).forEach(k => ok(LZ.STR.ru['i_' + k], k));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGNhbm5vbiA/Zm9kZGVyfHNlbnNpYmxlID9zb2Z0fNC6W9GN0LBd0L3QvT/QvtC9ID/RhNC+0LTQtD/QtdGAfNGE0L7QtNC0P9C10YB80YHQtdC90YHQuNCx0Lt8XGJqb29sc1xifNC00LbRg9C70YF80L/Rg9GI0LXRh9C9W9CwLdGP0ZFdKiA/0LzRj9GBfG5ldGhlciA/ZWFydGh8YXJndXMgP3ByZXNzfNC9W9C10Y1d0Ldb0LXRjV3RgCA/W9C10ZHRjV3RgNGCfNC9W9C10Y1d0YJb0LXRjV3RgCA/W9C10ZFd0YDRgnzQsNGA0LPRg9GBID/Qv9GA0LXRgdGBfHNhYm90ZXVyfNGB0LDQsdC+0YJb0LXRkV3RgHxkdXJlbGx80LTRjNGO0YDQtdC70Lt80LTRjtGA0LXQu9C7fGNsaXZlID90b3duc2VuZHzQutC70LDQudCyID/RgtCw0YPQvdGB0LXQvdC0fHRvd25zZW5kfNGC0LDRg9C90YHQtdC90LR8YXZlbmdpbmcgP2FuZ2Vs', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('лазутчик') && !BAD.test('Филин') && !BAD.test('сабо') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест') && !BAD.test('телогрейка'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибки момента нажатий, часть угроз замечает поздно; дерётся, не прячется.
const N = 12, RES = {};
for (const d of [1, 3, 5]){
  const nav = d === 1 ? NAV : B.navFor(LZ, M.build(d)), cache = {};
  RES[d] = []; for (let s = 1; s <= N; s++) RES[d].push(B.playLaz(LZ, s, { diff: d, nav, distCache: cache }));
}
const wins = d => RES[d].filter(r => r.won).length;
test('бот проходит «Сторож» часто (≥ 60% партий), без зависаний', () => {
  const r = RES[1]; console.log('     «Сторож»: побед ' + wins(1) + '/' + N + '; время побед, с: ' + r.filter(x => x.won).map(x => x.time.toFixed(0)).join(' '));
  ok(wins(1) >= 0.6 * N, 'слишком сложно: ' + wins(1) + '/' + N);
  ok(r.every(x => x.won || x.lose), 'бот завис: ' + r.filter(x => !x.won && !x.lose).map(x => x.seed + ':' + x.phase).join(','));
});
test('сложность ощутима: «Лазутчик» ≤ «Сторож», «Призрак» заметно труднее (бот без скрытности)', () => {
  console.log('     побед бота: «Сторож» ' + wins(1) + ', «Лазутчик» ' + wins(3) + ', «Призрак» ' + wins(5) + ' из ' + N + '; гибелей в среднем: ' + [1, 3, 5].map(d => (RES[d].reduce((a, x) => a + x.deaths, 0) / N).toFixed(1)).join(' / '));
  ok(wins(3) <= wins(1) && wins(5) < wins(1), 'порядок сложностей');
  ok(wins(5) <= 0.5 * N, '«Призрак» слишком лёгкий');
  const dd = d => RES[d].reduce((a, x) => a + x.deaths, 0); ok(dd(5) > dd(3) && dd(3) >= dd(1), 'гибелей больше на высокой сложности');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

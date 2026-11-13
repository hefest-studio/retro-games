/* УДАЛЕЦ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node udalets/tests/engine.test.mjs (QUICK=1 — без партий «человеческого» бота).
   Логика (js/levels.js + js/game.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const U = sandbox.UDALETS, L = U.logic, COLS = L.COLS, ROWS = L.ROWS, DT = 1 / 60;
const { playUdalets, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// игра без обитателей (если не сказано иначе); ev — журнал событий
function mk(level = 1, opts = {}){
  const ev = [];
  const game = U.Game(Object.assign({ rng: mulberry32(1), level, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state(); if (!opts.keepEnemies) S.enemies = [];
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0, jump = false, keep = false){
  for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(DT); if (!keep) game.state().enemies = []; }
  game.setInput(0, 0, false);
}
const LVS = U.LEVELS.map((d, i) => L.build(d, i + 1));
const count = (LV, k) => LV.items.filter(i => i.k === k).length;
const kinds = LV => new Set(LV.spawns.map(s => s.k));

// ---------- уровни ----------
test('10 уровней, экраны 26×15, по 2–3 экрана; в каждом старт, дверь и ровно один Кубок', () => {
  eq(U.LEVELS.length, 10);
  LVS.forEach((LV, i) => {
    const n = U.LEVELS[i].rooms.length; ok(n >= 2 && n <= 3, 'экранов ' + n);
    ok(LV.start && LV.exit, 'старт/дверь ' + (i + 1)); eq(count(LV, 'K'), 1, 'Кубков на уровне ' + (i + 1));
    U.LEVELS[i].rooms.forEach(r => { eq(r.length, ROWS); r.forEach(s => eq(s.length, COLS)); });
  });
});
test('прогрессия: ружьё впервые на уровне 3, ранец — с 6-го и на каждом дальше, плевуны — только с 7-го', () => {
  LVS.forEach((LV, i) => {
    const n = i + 1;
    if (n < 3) eq(count(LV, 'G'), 0, 'ружьё рано на ' + n);
    if (n < 6) eq(count(LV, 'J'), 0, 'ранец рано на ' + n); else eq(count(LV, 'J'), 1, 'ранец на ' + n);
    if (n < 7) ok(!kinds(LV).has('s'), 'плевун рано на ' + n);
  });
  eq(count(LVS[2], 'G'), 1); ok(LVS.slice(6).every(LV => kinds(LV).has('s')), 'плевуны на 7–10');
  ok(LVS.every(LV => LV.spawns.length > 0 || LV.idx === 1), 'обитатели есть со 2-го уровня');
  ok(LVS.filter(LV => count(LV, 'A') > 0).length >= 5, 'патроны на поздних уровнях');
});
test('опасности всех трёх видов, тайники за ложными стенами, входы на бонус-уровень', () => {
  const all = LVS.map(LV => LV.t.join('')).join('');
  ok(all.includes('^') && all.includes('~') && all.includes('a'), 'шипы/огонь/кислота');
  ok(LVS.filter(LV => LV.t.includes('%')).length >= 4, 'тайников мало');
  ok(LVS.filter(LV => count(LV, 'W') > 0).length >= 3, 'входов на бонус мало'); eq(count(LVS[5], '+'), 1, 'лишняя жизнь в тайнике 6-го');
  const B = L.build(U.BONUS, 0); ok(B.bonus && !B.cup && count(B, 'R') >= 6);
});

// ---------- физика ----------
test('физика: бег 6 кл/с, прыжок ≈ 3,3 клетки вверх и ≈ 4 вперёд, стены и потолок держат', () => {
  const { game, S } = mk(1); game._place(6, 14);
  run(game, 0.5, 1); ok(Math.abs(S.hero.x - 9.5) < 0.05, 'бег: ' + S.hero.x);
  game._place(6, 14); let top = 14; game.setInput(0, 0, true);
  for (let i = 0; i < 60; i++){ game.update(DT); game.setInput(0, 0, false); top = Math.min(top, S.hero.y); }
  ok(14 - top > 3.1 && 14 - top < 3.5, 'высота ' + (14 - top).toFixed(2)); ok(S.hero.ground);
  game._place(1, 14); run(game, 1, -1); ok(S.hero.x >= 1 + L.HW, 'стена слева');
});
test('шипы, огонь и кислота — гибель; потеря жизни и возврат к началу экрана с неуязвимостью', () => {
  for (const [lv, ch] of [[1, '^'], [2, '~'], [4, 'a']]){
    const { game, S, has, ev } = mk(lv), LV = S.LV;
    let c = -1, r = -1; for (let k = 0; k < LV.t.length && c < 0; k++) if (LV.t[k] === ch && L.isSolid(LV, k % LV.w, Math.floor(k / LV.w) + 1)){ c = k % LV.w; r = Math.floor(k / LV.w); }
    ok(c >= 0, 'нет ' + ch); game._place(c - 1, r + 1); run(game, 0.5, 1);
    ok(has('die'), 'гибель от ' + ch); eq(S.lives, 2); eq(ev.find(e => e.t === 'die').d.why, { '^': 'spike', '~': 'fire', a: 'acid' }[ch]);
    run(game, 1.5); eq(S.phase, 'play'); ok(S.inv > 0, 'неуязвимость'); ok(!L.hazardHit(LV, S.hero), 'вернулся в безопасное место');
  }
});
test('3 жизни — конец игры; лишняя жизнь за каждые 20 000 очков (не больше 5)', () => {
  const { game, S, has } = mk(1);
  for (let k = 0; k < 3; k++){ game._die('spike'); run(game, 1.5); }
  ok(S.over, 'конец'); ok(has('gameover'));
  const b = mk(1); b.S.score = 19990; b.game._place(14, 8); run(b.game, 0.2);
  b.S.score = 19990; const it = b.S.LV.items.find(i => i.k === 'g'); b.game._place(it.c, it.r + 1); run(b.game, 0.1);
  eq(b.S.lives, 4, 'лишняя жизнь'); ok(b.has('life'));
});

// ---------- Кубок и дверь ----------
test('дверь закрыта без Кубка; Кубок открывает её; дверь — уровень пройден, бонус за время, следующий уровень', () => {
  const { game, S, has, ev } = mk(1), LV = S.LV;
  game._place(LV.exit.c, LV.exit.r); run(game, 0.3); ok(!has('clear'), 'без Кубка не пускает'); eq(S.level, 1);
  game._place(LV.cup.c, LV.cup.r + 1); run(game, 0.1); ok(S.cup && has('cup')); eq(S.score, L.PTS.K);
  game._place(LV.exit.c, LV.exit.r); run(game, 0.1); ok(has('clear')); ok(ev.find(e => e.t === 'clear').d.bonus >= L.PTS.exit);
  run(game, 2); eq(S.level, 2); ok(!S.cup, 'на новом уровне Кубка нет'); eq(S.phase, 'play');
});
test('после 10-го уровня — победа', () => {
  const { game, S, has } = mk(10), LV = S.LV;
  game._place(LV.cup.c, LV.cup.r + 1); run(game, 0.1); game._place(LV.exit.c, LV.exit.r); run(game, 2);
  ok(S.won && has('win'));
});

// ---------- ружьё, ранец ----------
test('ружьё: без него не стреляет; подбор даёт 8 зарядов, выстрел тратит заряд и сносит обитателя', () => {
  const { game, S, has } = mk(3); ok(!game.fire(), 'без ружья');
  const G = S.LV.items.find(i => i.k === 'G'); game._place(G.c, G.r + 1); run(game, 0.1);
  ok(S.gun); eq(S.ammo, L.AMMO_GUN);
  game._place(3, 14); S.hero.face = 1;
  S.enemies = [{ id: 99, k: 'f', room: 0, alive: true, dir: -1, t: 0, cd: 9, x: 9.5, y: 13.1, y0: 13.1, ph: 0 }];
  ok(game.fire()); eq(S.ammo, L.AMMO_GUN - 1);
  for (let i = 0; i < 40; i++){ game.setInput(0, 0, false); game.update(DT); if (S.enemies[0].x < 4.5) break; }
  ok(has('kill'), 'попал'); eq(S.kills, 1); ok(!S.enemies[0].alive);
  S.ammo = 0; run(game, 0.5, 0, 0, false, true); ok(!game.fire()); ok(has('empty'));
});
test('ранец: взлёт, полёт по стрелкам без гравитации, топливо тратится; кончилось — падение', () => {
  const { game, S, has } = mk(6), J = S.LV.items.find(i => i.k === 'J');
  ok(!game.jet(), 'без ранца не взлетает');
  game._place(J.c, J.r + 1); run(game, 0.1); ok(S.jetOwned); eq(S.fuel, L.FUEL_MAX);
  ok(game.jet()); ok(S.hero.jet); const y0 = S.hero.y; run(game, 0.25, 0, -1); ok(Math.abs(y0 - S.hero.y - 0.25 * L.JS) < 0.05, 'вверх: ' + (y0 - S.hero.y));
  const y1 = S.hero.y; run(game, 0.5); ok(Math.abs(S.hero.y - y1) < 1e-6, 'висит');
  ok(Math.abs(S.fuel - (L.FUEL_MAX - 0.75 * L.FUEL_DRAIN)) < 0.2, 'топливо: ' + S.fuel);
  S.fuel = 0.05; run(game, 0.2); ok(!S.hero.jet && has('fuelOut')); run(game, 1); ok(S.hero.ground, 'упал');
});

// ---------- тайники и бонус-уровень ----------
test('ложная стена проходима; вход в тайник ведёт на бонус-уровень и обратно на то же место', () => {
  const { game, S, has } = mk(2), LV = S.LV, W = LV.items.find(i => i.k === 'W');
  ok(L.tile(LV, 5, 1) === '%' && !L.isSolid(LV, 5, 1), 'ложная стена');
  game._place(7, 3); run(game, 0.6, -1); ok(S.hero.x < 5.5, 'прошёл сквозь: ' + S.hero.x);
  game._place(W.c, W.r + 1); run(game, 0.05);
  ok(S.inBonus && has('warp')); ok(S.LV.bonus); ok(Math.abs(S.bonusT - L.BONUS_TIME) < 0.1);
  const sc = S.score; const g = S.LV.items.find(i => i.k === 'R'); game._place(g.c, g.r + 1); run(game, 0.05); ok(S.score > sc, 'самоцветы бонуса');
  game._place(S.LV.exit.c, S.LV.exit.r); run(game, 0.05);
  ok(!S.inBonus && has('bonusEnd')); eq(S.LV, LV, 'вернулся на уровень'); ok(S.got[W.id], 'вход закрыт');
  const b = mk(2); b.game._place(W.c, W.r + 1); run(b.game, 0.05); run(b.game, L.BONUS_TIME + 0.5); ok(!b.S.inBonus, 'по таймеру — назад');
});
test('«Заново уровень»: −1 жизнь, уровень с начала, очки сохраняются', () => {
  const { game, S } = mk(4); S.score = 1234; game._place(30, 14); game.restartLevel();
  eq(S.lives, 2); eq(S.level, 4); eq(S.score, 1234); eq(S.hero.x, S.LV.start.c + 0.5);
});

// ---------- обитатели ----------
test('обитатели: ходок разворачивается у края, плевун стреляет в героя, касание и пуля — гибель', () => {
  const { game, S, has } = mk(3, { keepEnemies: true });
  const w = S.enemies.find(e => e.k === 'w'); ok(w);
  const t0 = mk(7, { keepEnemies: true }), s = t0.S.enemies.find(e => e.k === 's');
  t0.game._place(s.room * COLS + 3, 5); for (let i = 0; i < 60 * 4 && !t0.has('eshoot'); i++){ t0.game.setInput(0, 0, false); t0.game.update(DT); }
  ok(t0.has('eshoot'), 'плевун выстрелил');
  const t1 = mk(1); t1.S.enemies = [{ id: 1, k: 'w', room: 0, alive: true, dir: -1, t: 0, cd: 9, x: 5.9, y: 14 }];
  t1.game._place(5, 14); t1.S.inv = 0; t1.game.update(DT); ok(t1.has('die'), 'касание ходока');
  // ходок не сходит с платформы
  const LV = S.LV, e = { k: 'w', room: 0, x: 14.5, y: 8, dir: 1, t: 0 }; for (let i = 0; i < 600; i++) L.enemyStep(LV, e, DT, null, null);
  ok(L.isSolid(LV, Math.floor(e.x), 8), 'ходок на опоре');
});

// ---------- проходимость (граф: узлы «стою на клетке», рёбра — настоящая физика; ранец — перелёты) ----------
const NAVS = LVS.map(LV => L.Nav(LV));
function stateGraph(i){
  const LV = LVS[i], nav = NAVS[i], W = LV.w, J = LV.items.find(it => it.k === 'J'), jN = J ? nav.itemNode(J) : -1;
  const start = LV.start.r * W + LV.start.c, R = nav.reach(start, 0, jN);
  return { LV, nav, W, jN, start, R, cup: nav.itemNode(LV.cup), exit: LV.exit.r * W + LV.exit.c };
}
const GR = LVS.map((_, i) => stateGraph(i));
test('проходимость: на каждом уровне Кубок и дверь достижимы; уровни 1–5 — без ранца, 6–10 — с ранцем', () => {
  GR.forEach((G, i) => {
    const has = k => G.R[k + ':0'] || G.R[k + ':1'];
    ok(G.cup != null && has(G.cup), 'Кубок L' + (i + 1)); ok(has(G.exit), 'дверь L' + (i + 1));
    const R0 = G.nav.reach(G.start, 0, -1);
    if (i < 5) ok(R0[G.cup + ':0'] && R0[G.exit + ':0'], 'без ранца L' + (i + 1));
    else ok(G.jN != null && has(G.jN) && !R0[G.cup + ':0'], 'нужен ранец L' + (i + 1));
  });
});
test('нет тупиков: из любого достижимого места можно дойти до двери', () => {
  GR.forEach((G, i) => {
    const rev = new Map(), keys = Object.keys(G.R);
    keys.forEach(k => { const [n, j] = k.split(':').map(Number);
      const list = G.nav.edges(n).concat(j ? G.nav.flights(n) : []);
      list.forEach(e => { const to = e.to + ':' + (j || e.to === G.jN ? 1 : 0); if (!rev.has(to)) rev.set(to, []); rev.get(to).push(k); }); });
    const back = new Set(), q = [G.exit + ':0', G.exit + ':1'].filter(k => G.R[k]); q.forEach(k => back.add(k));
    while (q.length){ const k = q.pop(); for (const m of rev.get(k) || []) if (!back.has(m)){ back.add(m); q.push(m); } }
    const bad = keys.filter(k => !back.has(k));
    eq(bad.length, 0, 'тупики L' + (i + 1) + ': ' + bad.slice(0, 3).map(k => { const n = +k.split(':')[0]; return (n % G.W) + ',' + Math.floor(n / G.W); }).join(' '));
  });
});
test('граф совпадает с физикой игры: по 40 случайных рёбер каждого уровня воспроизводятся в Game', () => {
  const rng = mulberry32(42); let checked = 0;
  GR.forEach((G, i) => {
    const nodes = Object.keys(G.R).map(k => +k.split(':')[0]);
    for (let k = 0; k < 40; k++){
      const n = nodes[Math.floor(rng() * nodes.length)], es = G.nav.edges(n); if (!es.length) continue;
      const e = es[Math.floor(rng() * es.length)], a = L.ACTS[e.a];
      const { game, S } = mk(i + 1); S.LV.items.forEach(it => { if (it.k === 'W' || it.k === 'K') S.got[it.id] = true; });
      game._place(n % G.W, Math.floor(n / G.W)); const X0 = S.hero.x; let t = 0, f = null;
      for (let s = 0; s < 240 && !f; s++){ const inp = L.drive(a, t, S.hero, X0); game.setInput(inp.dx, inp.dy, inp.jump); game.update(DT); S.enemies = []; t += DT; f = L.finished(a, t, S.hero, { X0 }); }
      eq(f, 'ok', 'L' + (i + 1) + ' ребро'); eq(S.phase, 'play', 'L' + (i + 1) + ' без гибели'); eq(L.nodeOf(S.LV, S.hero), e.to, 'L' + (i + 1) + ' узел'); checked++;
    }
  });
  ok(checked >= 380, 'проверено ' + checked);
});
test('исполнимость: бот без ошибок (обитатели не трогают) проходит каждый уровень в настоящей физике без гибели', () => {
  for (let lv = 1; lv <= 10; lv++){
    const r = playUdalets(U, 1, { perfect: true, god: true, level: lv, only: true, maxT: 300 });
    eq(r.cleared, 1, 'уровень ' + lv); eq(r.deaths, 0, 'гибель на ' + lv + ': ' + r.log.join(','));
  }
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек udalets подключается по gameId, длины кратны такту', () => {
  const T = sandbox.Arcade.tracks.udalets; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0); ok(n(T.melody) >= 64, '8+ тактов');
});
test('i18n: у RU и EN одинаковые ключи; есть названия всех уровней и бонуса', () => {
  const ru = Object.keys(U.STR.ru).sort(), en = Object.keys(U.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let k = 0; k <= 10; k++) ok(U.STR.ru['lv' + k] && U.STR.en['lv' + k], 'lv' + k);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список аркады + оригинал жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8') + '|' + Buffer.from('ZGFuZ2Vyb3VzID9kYXZlfFxiZGF2ZVxifNC0W9GN0LVd0LnQsg==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('rocket pack') && !BAD.test('daredevil') && !BAD.test('Гефест') && !BAD.test('Удалец') && !BAD.test('CONTRACT.md'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии «человеческого» бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// tests/bot.mjs: реакция 150–250 мс, ошибки времени нажатий, часть обитателей замечает с опозданием, терпение ~5 с.
// 40 партий (сиды 1..40). Цели: 1-й уровень ≥ 90%, вся игра (10 уровней на 3 жизнях + лишние) ≈ 25–65%.
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playUdalets(U, s));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.cleared >= 1 || r.won).length; console.log('     1-й уровень: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: вся игра — 25–65% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(11).fill(0); BAL.forEach(r => dist[r.won ? 10 : r.level - 1]++);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const wt = BAL.filter(r => r.won).map(r => r.time);
  console.log('     победы: ' + n + '/' + N + '; конец на уровнях 1..10/победа: ' + dist.join(',') + '; гибели: ' + JSON.stringify(why) + '; время побед, с: ' + (wt.length ? Math.min(...wt).toFixed(0) + '–' + Math.max(...wt).toFixed(0) : '—'));
  ok(n >= 0.25 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.65 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => !r.won && !r.over), 'бот «завис»: сиды ' + BAL.filter(r => !r.won && !r.over).map(r => r.seed).join(','));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

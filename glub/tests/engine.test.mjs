/* ГЛУБЬ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node glub/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/ui.js', 'js/modern.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const Gb = sandbox.GLUB, L = Gb.logic, W = L.world(), NK = L.NK, COLS = L.COLS, ROWS = L.ROWS;
const { playGlub, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Игра без обитателей; ev — журнал событий
function mk(opts = {}){
  const ev = [];
  const game = Gb.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
const room = k => W.at[k];
function place(game, rm, c, r){ game._place(rm.i, c, r == null ? rm.f[c] : r); game.state().enemies = []; }
function run(game, sec, dx = 0, dy = 0, jump = false){
  for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(1 / 60); const S = game.state(); if (S.enemies.length && !S._keepEnemies) S.enemies = []; }
  game.setInput(0, 0, false);
}
const find = pred => W.rooms.find(pred);

// ---------- мир ----------
test('мир: 72 экрана (9×8, в пределах 60–80), у каждого есть связь, все связи парные', () => {
  eq(W.rooms.length, 72); ok(W.rooms.length >= 60 && W.rooms.length <= 80);
  const opp = { L: 'R', R: 'L', U: 'D', D: 'U' };
  for (const rm of W.rooms){
    ok(['L', 'R', 'U', 'D'].some(d => rm.c[d]), 'экран без связей ' + rm.x + ',' + rm.y);
    for (const d of ['L', 'R', 'U', 'D']) if (rm.c[d]){ const nb = W.rooms[rm.c[d].to], back = nb.c[opp[d]]; ok(back && back.to === rm.i && back.k === rm.c[d].k, 'связь ' + d + ' ' + rm.x + ',' + rm.y); }
  }
});
test('мир: двери на одной высоте с обеих сторон, лестницы и провалы совпадают по столбцу', () => {
  for (const rm of W.rooms){
    if (rm.c.R){ const nb = W.rooms[rm.c.R.to], h = rm.c.R.h;
      for (let y = h - 3; y < h; y++){ ok(rm.t[y * COLS + COLS - 1] !== L.R && nb.t[y * COLS] !== L.R, 'дверь ' + rm.x + ',' + rm.y + ' ряд ' + y); }
      eq(rm.t[h * COLS + COLS - 1], L.R, 'порог слева'); eq(nb.t[h * COLS], L.R, 'порог справа'); }
    if (rm.c.D){ const nb = W.rooms[rm.c.D.to], c = rm.c.D.col;
      if (rm.c.D.k === 'drop'){ for (const q of [c, c + 1]){ eq(rm.t[(ROWS - 1) * COLS + q], L.E); eq(nb.t[q], L.E); } }
      else { eq(rm.t[(ROWS - 1) * COLS + c], L.LD, 'низ лестницы ' + rm.x + ',' + rm.y); eq(nb.t[c], L.LD, 'верх лестницы'); } }
  }
});
test('мир фиксирован: повторная сборка даёт те же экраны', () => {
  const W2 = L.buildWorld();
  for (let i = 0; i < W.rooms.length; i++) eq(Array.from(W2.rooms[i].t).join(''), Array.from(W.rooms[i].t).join(''), 'экран ' + i);
});
test('кристаллы: 8 разных, по одному в экранах «1»…«8»; старт и маяки; Сердце — за Печатью', () => {
  eq(W.crystals.length, 8); eq(W.crystals.map(c => c.cid).join(''), '12345678');
  W.crystals.forEach(c => eq(W.rooms[c.room].kind, String(c.cid)));
  ok(W.start && W.rooms[W.start.room].kind === 'S'); ok(W.beacons.length >= 5, 'маяков ' + W.beacons.length);
  ok(W.heart && W.rooms[W.heart.room].kind === 'H');
  ok(W.rooms.some(rm => rm.c.R && rm.c.R.k === 'gate'), 'есть Печать');
  ok(W.nGroups >= 10, 'мягких стен/пробок: ' + W.nGroups);
});

// ---------- переходы, лестницы, падения ----------
test('переход по краю экрана: дверь влево и вправо, экран отмечается на карте', () => {
  const { game, S } = mk(), st = room('4,0');
  place(game, st, 2); run(game, 1.2, -1);
  eq(S.room, st.c.L.to, 'ушёл влево'); ok(S.hero.x > 17, 'x с другой стороны: ' + S.hero.x.toFixed(2));
  ok(S.visited[st.i] && S.visited[st.c.L.to]);
  run(game, 1.2, 1); eq(S.room, st.i, 'вернулся вправо');
});
test('лестница: подъём в экран выше и спуск обратно', () => {
  const { game, S } = mk(), up = room('4,0'), lo = W.rooms[up.c.D.to], c = up.c.D.col;
  place(game, lo, c); run(game, 6, 0, -1);
  eq(S.room, up.i, 'поднялся'); ok(S.hero.ground && !S.hero.climb); eq(Math.round(S.hero.y), up.f[c]);
  run(game, 6, 0, 1); eq(S.room, lo.i, 'спустился'); ok(S.hero.ground, 'стоит внизу');
});
test('провал: падение в экран ниже — оглушение, а не смерть; оглушённый не двигается', () => {
  const { game, S, has, ev } = mk(), rm = find(r => r.c.D && r.c.D.k === 'drop' && !r.c.U), c = rm.c.D.col;
  place(game, rm, c - 1); run(game, 0.3, 1);
  let stunned = false, x0 = null;
  for (let i = 0; i < 240 && !stunned; i++){ game.setInput(1, 0, false); game.update(1 / 60); S.enemies = []; if (S.hero.stun > 0){ stunned = true; x0 = S.hero.x; } }
  ok(stunned, 'оглушение'); eq(S.room, rm.c.D.to, 'в экране ниже'); ok(has('stun'));
  eq(S.energy, L.EMAX, 'энергия цела'); eq(S.lives, 3); eq(S.phase, 'play');
  ok(ev.find(e => e.t === 'stun').d.fall >= L.STUN_FALL);
  run(game, 0.5, 1); eq(S.hero.x, x0, 'не двигается'); run(game, 1.5, 1); ok(S.hero.x !== x0, 'очнулся');
});
test('обычный прыжок не оглушает', () => {
  const { game, S, has } = mk(); place(game, room('4,0'), 9);
  run(game, 0.1, 0, 0, true); run(game, 1.2); ok(!has('stun')); ok(S.hero.ground);
});

// ---------- крот и мягкие стены ----------
test('мягкая дверь закрыта, пока Бурик её не прогрыз; группа общая для обоих экранов', () => {
  const { game, S, has } = mk(), rm = find(r => r.c.L && r.c.L.k === 'soft'), nb = W.rooms[rm.c.L.to], h = rm.c.L.h;
  place(game, rm, 3); run(game, 1.5, -1); eq(S.room, rm.i, 'стена держит');
  S.hero.face = -1; ok(game.mole()); eq(S.mole.state, 'out');
  run(game, 2.5); ok(has('dug'), 'прогрыз');
  const gid = rm.g[(h - 1) * COLS]; ok(S.dug[gid]);
  eq(L.tileAt(S, rm, 0, h - 1), L.E); eq(L.tileAt(S, nb, COLS - 1, h - 1), L.E, 'и в соседнем экране');
  run(game, 3); eq(S.mole.state, 'home', 'вернулся'); ok(has('moleHome'));
  run(game, 1.5, -1); eq(S.room, nb.i, 'проход открыт');
});
test('Бурик копает вниз пробку лестницы; по твёрдой породе — «звяк»', () => {
  const { game, S, has } = mk(), rm = find(r => r.c.D && r.c.D.k === 'softladder'), c = rm.c.D.col;
  place(game, rm, c); run(game, 0.5, 0, 1); eq(S.room, rm.i, 'пробка держит');
  ok(game.mole('D')); run(game, 1.5); ok(has('dug')); eq(L.tileAt(S, rm, c, rm.f[c]), L.LD, 'под пробкой — лестница');
  run(game, 6, 0, 1); eq(S.room, rm.c.D.to, 'спустился');
  const g2 = mk(); place(g2.game, room('4,0'), 9); ok(g2.game.mole('D')); run(g2.game, 1); ok(g2.has('clank')); ok(!g2.has('dug'));
});
test('Бурик прогрызает пробку снизу, с лестницы (вверх)', () => {
  const { game, S, has } = mk(), lo = find(r => r.c.U && r.c.U.k === 'softladder'), c = lo.c.U.col;
  place(game, lo, c); run(game, 4, 0, -1); ok(S.hero.climb, 'висит на лестнице'); const rr = S.room;
  game.setInput(0, -1, false); ok(game.mole('U')); run(game, 1.2, 0, 0); ok(has('dug'), 'прогрыз снизу');
  run(game, 6, 0, -1); eq(S.room, lo.c.U.to, 'поднялся'); ok(rr !== undefined);
});
test('Бурик сносит ржавня на своём пути', () => {
  const { game, S, has } = mk(), rm = room('4,0'); place(game, rm, 4);
  S.enemies = [{ type: 'crawler', x: 9.5, y: rm.f[9], dir: -1, v: 0, alive: true }]; S._keepEnemies = true;
  S.hero.face = 1; game.mole(); for (let i = 0; i < 60; i++) game.update(1 / 60);
  ok(has('kill')); eq(S.kills, 1); ok(!S.enemies[0].alive); eq(S.score, L.PTS.kill);
});

// ---------- энергия, жизни, маяки ----------
test('энергия: касание отнимает, после удара — неуязвимость; копотник рядом жалит', () => {
  const { game, S, count } = mk(); place(game, room('4,0'), 9);
  game._hurt(10, 5, 'moth'); game._hurt(10, 5, 'moth'); eq(S.energy, L.EMAX - 10); eq(count('hurt'), 1);
  run(game, 1.5);
  S.enemies = [{ type: 'moth', mode: 'h', x: S.hero.x, y: S.hero.y - 0.8, x0: 2, x1: 18, y0: S.hero.y - 0.8, vx: 0, ph: 0, alive: true }]; S._keepEnemies = true;
  const e0 = S.energy; game.update(1 / 60); eq(S.energy, e0 - L.DMG.moth, 'жалит');
});
test('энергия 0 — минус жизнь и возврат к маяку с полной энергией; 3 жизни — конец игры', () => {
  const { game, S, has, count } = mk(); place(game, room('5,0'), 9);
  S.energy = 3; game._hurt(10, 5, 'moth'); eq(S.phase, 'dead'); eq(S.lives, 2); ok(has('die'));
  run(game, 2); eq(S.phase, 'play'); eq(S.room, W.start.room, 'у стартового маяка'); eq(S.energy, L.EMAX); ok(has('respawn'));
  for (let k = 0; k < 2; k++){ run(game, 2.5); S.energy = 1; game._hurt(5, 0, 'slag'); run(game, 2); }
  ok(S.over, 'конец'); ok(has('gameover')); eq(count('die'), 3);
});
test('маяк: касание — новая контрольная точка и полная энергия; после гибели — возврат к нему', () => {
  const { game, S, has } = mk(), rm = find(r => r.kind === 'b'), b = rm.items.find(i => i.k === 'beacon');
  place(game, rm, b.c - 2, b.r); S.energy = 40; run(game, 0.6, 1);
  ok(has('beacon')); eq(S.cp.id, b.id); eq(S.energy, L.EMAX); ok(S.score >= L.PTS.beacon);
  S.energy = 1; game._hurt(5, 0, 'moth'); run(game, 2); eq(S.room, rm.i, 'вернулся к маяку'); ok(Math.abs(S.hero.x - (b.c + 0.5)) < 0.01);
});

// ---------- кристаллы, Печать, финал ----------
test('кристалл: сбор по касанию, счёт; восемь — Печать открывается', () => {
  const { game, S, has } = mk(), cr = W.crystals[0], rm = W.rooms[cr.room];
  place(game, rm, cr.c, cr.r); game.update(1 / 60);
  eq(S.crystals.join(), '1'); ok(has('crystal')); eq(S.score, L.PTS.crystal); ok(!S.gate);
  const G = find(r => r.c.R && r.c.R.k === 'gate'), h = G.c.R.h;
  ok(L.isSolid(L.tileAt(S, G, COLS - 1, h - 1)), 'Печать закрыта');
  game._giveCrystals(8); ok(S.gate); eq(L.tileAt(S, G, COLS - 1, h - 1), L.E, 'Печать открыта');
  const g2 = mk(); W.crystals.forEach(c => { place(g2.game, W.rooms[c.room], c.c, c.r); g2.game.update(1 / 60); });
  eq(g2.S.crystals.length, 8); ok(g2.has('gateOpen'), 'событие открытия');
});
test('Сердце Горна: без Печати не срабатывает, с открытой — победа и бонус', () => {
  const { game, S, has } = mk(), hr = W.heart;
  place(game, W.rooms[hr.room], hr.c, hr.r); game.update(1 / 60); ok(!has('win'));
  game._giveCrystals(8); game.update(1 / 60); ok(has('win')); ok(S.won); ok(S.finalBonus >= L.PTS.heart);
});
test('мини-карта: посещённые экраны, «?» у неоткрытых соседей, отметки кристаллов', () => {
  const { game, S } = mk(); place(game, room('3,0'), 9); place(game, room('2,0'), 9);
  eq(Object.keys(S.visited).length, 3);
  const texts = [], calls = { fill: 0 };
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.fill++; }, set: (o, k, v) => { o[k] = v; return true; } });
  const g = { W: 640, H: 420, t: k => k, text: s => texts.push(String(s)) };
  Gb.ui.mapOverlay(g, ctx, S, Gb.modern.P, Gb.modern);
  ok(texts.includes('map')); const q = texts.filter(s => s === '?').length;
  const adj = new Set(); Object.keys(S.visited).forEach(i => { const r = W.rooms[i]; ['L', 'R', 'U', 'D'].forEach(d => { if (r.c[d] && !S.visited[r.c[d].to]) adj.add(r.c[d].to); }); });
  eq(q, adj.size, 'знаки «?»'); ok(texts.some(s => s.startsWith('0/8')), 'счётчик кристаллов');
});

// ---------- проходимость (граф с учётом крота) ----------
const nav = L.Nav(W), SOL = nav.solve();
test('проходимость: все 8 кристаллов и Сердце достижимы с учётом крота; все мягкие стены прогрызаемы', () => {
  eq(SOL.crystals, 8); ok(SOL.heart, 'Сердце');
  eq(SOL.digs.length, W.nGroups, 'прогрызено групп');
  const rooms = new Set([...SOL.reach].map(n => Math.floor(n / NK))); eq(rooms.size, W.rooms.length, 'все экраны');
});
test('без крота кристаллы не собрать, без 8 кристаллов Сердце закрыто', () => {
  const R0 = nav.reach({ dug: {}, gate: false }, W.start.node);
  const n0 = W.crystals.filter(c => R0.has(c.node)).length; ok(n0 < 8, 'без крота: ' + n0);
  const R1 = nav.reach(Object.assign({}, SOL.st, { gate: false }), W.start.node); ok(!R1.has(W.heart.node));
  console.log('     без крота доступно кристаллов: ' + n0 + '/8');
});
test('нет тупиков: из любого достижимого места можно дойти до Сердца (провалы односторонние)', () => {
  const rev = new Map(); SOL.reach.forEach(n => nav.edges(SOL.st, n).forEach(e => { if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push(n); }));
  const back = new Set([W.heart.node]), q = [W.heart.node];
  while (q.length){ const n = q.pop(); for (const m of rev.get(n) || []) if (!back.has(m)){ back.add(m); q.push(m); } }
  const bad = [...SOL.reach].filter(n => !back.has(n)); eq(bad.length, 0, 'тупики: ' + bad.slice(0, 3).map(n => W.rooms[Math.floor(n / NK)].x + ',' + W.rooms[Math.floor(n / NK)].y));
});
test('граф совпадает с физикой игры: 300 случайных рёбер воспроизводятся в Game', () => {
  const nodes = [...SOL.reach], rng = mulberry32(42); let checked = 0;
  for (let k = 0; k < 300; k++){
    const n = nodes[Math.floor(rng() * nodes.length)], es = nav.edges(SOL.st, n); if (!es.length) continue;
    const e = es[Math.floor(rng() * es.length)], a = L.ACTS[e.a], rm = W.rooms[Math.floor(n / NK)], rc = n % NK;
    if (rm.i === W.heart.room || Math.floor(e.to / NK) === W.heart.room) continue;   // там касание Сердца завершает игру
    const { game, S } = mk(); Object.assign(S.dug, SOL.st.dug); S.gate = true;
    place(game, rm, rc % COLS, Math.floor(rc / COLS));
    const m = { X0: L.absX(W, S.hero), left: false, climbed: false }; let t = 0, f = null;
    for (let i = 0; i < 600 && !f; i++){ const inp = L.drive(W, a, t, S.hero, m.X0); game.setInput(inp.dx, inp.dy, inp.jump); game.update(1 / 60); S.enemies = []; t += 1 / 60; f = L.finished(W, a, t, S.hero, m); }
    eq(f, 'ok', 'ребро ' + n + '→' + e.to);
    const to = S.hero.room * NK + Math.round(S.hero.y) * COLS + Math.floor(S.hero.x);
    ok(to === e.to || Math.abs(to - e.to) === 1, 'ребро ' + n + ' → ' + e.to + ', в игре ' + to); checked++;
  }
  ok(checked > 250);
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек glub подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.glub; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; есть имена всех кристаллов и зон', () => {
  const ru = Object.keys(Gb.STR.ru).sort(), en = Object.keys(Gb.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let k = 1; k <= 8; k++) ok(Gb.STR.ru['c' + k] && Gb.STR.en['c' + k]);
  L.ZONES.forEach(z => ok(Gb.STR.ru['z_' + z] && Gb.STR.en['z_' + z], z));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('mole(force)') && !BAD.test('digStart') && !BAD.test('монитор') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без урона проходит всю игру в настоящей физике (крот, Печать, Сердце)', () => {
  for (const s of [1, 2, 3]){ const r = playGlub(Gb, s, { dmgMul: 0, maxT: 900 }); ok(r.won, 'сид ' + s + ': кристаллов ' + r.crystals); }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибки времени нажатий, не замечает часть обитателей.
// 40 партий (сиды 1..40). Цели: 1-й кристалл ≥ 90%, вся игра ≈ 20–40% (допуск 20–45%).
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playGlub(Gb, s));
test('баланс: бот берёт 1-й кристалл в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.firstAt != null).length; console.log('     1-й кристалл: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: вся игра (8 кристаллов + Сердце) — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(9).fill(0); BAL.forEach(r => dist[r.crystals]++);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const wt = BAL.filter(r => r.won).map(r => r.time); const st = BAL.reduce((a, r) => a + r.stuns, 0);
  console.log('     победы: ' + n + '/' + N + '; кристаллов 0..8: ' + dist.join(',') + '; удары: ' + JSON.stringify(why) + '; оглушений: ' + st + '; время побед, с: ' + (wt.length ? Math.min(...wt).toFixed(0) + '–' + Math.max(...wt).toFixed(0) : '—'));
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял: сиды ' + BAL.filter(r => r.stuck).map(r => r.seed).join(','));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

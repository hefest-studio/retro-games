/* УГОЛЁК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node ugolyok/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) в node:vm с шимом window. */
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
const U = sandbox.UGOLYOK, L = U.logic, W = L.world(), NK = L.NK, COLS = L.COLS, ROWS = L.ROWS;
const { playUgolyok, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Игра; safe — ловушки не убивают (кроме тестов ловушек); ev — журнал событий
function mk(opts = {}){
  const ev = [];
  const game = U.Game(Object.assign({ safe: true, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
const room = k => W.at[k];
function place(game, rm, c, r){ game._place(rm.i, c, r == null ? rm.f[c] : r); }
function run(game, sec, dx = 0, dy = 0, jump = false){
  for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(1 / 60); }
  game.setInput(0, 0, false);
}
const find = pred => W.rooms.find(pred);
const sum = k => W.rooms.reduce((a, r) => a + r.hz[k].length, 0);
// чистая комната без ловушек и обитателей для тестов физики
function quiet(rm){ return !rm.hz.presses.length && !rm.hz.drips.length && !rm.hz.carts.length && !rm.hz.enemies.length; }

// ---------- мир ----------
test('мир: 48 экранов (8×6, в пределах 40–60), у каждого есть связь, все связи парные', () => {
  eq(W.rooms.length, 48); ok(W.rooms.length >= 40 && W.rooms.length <= 60);
  const opp = { L: 'R', R: 'L', U: 'D', D: 'U' };
  for (const rm of W.rooms){
    ok(['L', 'R', 'U', 'D'].some(d => rm.c[d]), 'экран без связей ' + rm.x + ',' + rm.y);
    for (const d of ['L', 'R', 'U', 'D']) if (rm.c[d]){ const nb = W.rooms[rm.c[d].to], back = nb.c[opp[d]]; ok(back && back.to === rm.i && back.k === rm.c[d].k, 'связь ' + d + ' ' + rm.x + ',' + rm.y); }
  }
});
test('мир: двери на одной высоте с обеих сторон, лестницы и верёвки совпадают по столбцу', () => {
  for (const rm of W.rooms){
    if (rm.c.R){ const nb = W.rooms[rm.c.R.to], h = rm.c.R.h;
      for (let y = h - 3; y < h; y++){ ok(rm.t[y * COLS + COLS - 1] !== L.R && nb.t[y * COLS] !== L.R, 'дверь ' + rm.x + ',' + rm.y + ' ряд ' + y); }
      eq(rm.t[h * COLS + COLS - 1], L.R, 'порог слева'); eq(nb.t[h * COLS], L.R, 'порог справа'); }
    if (rm.c.D){ const nb = W.rooms[rm.c.D.to], c = rm.c.D.col;
      eq(rm.t[(ROWS - 1) * COLS + c], L.LD, 'низ лестницы ' + rm.x + ',' + rm.y); eq(nb.t[c], L.LD, 'верх лестницы');
      eq(!!rm.rope[c], !!rm.c.D.rope); }
  }
  ok(W.rooms.some(rm => rm.c.D && rm.c.D.rope), 'есть верёвки'); ok(W.rooms.some(rm => rm.c.D && !rm.c.D.rope), 'есть лестницы');
});
test('мир фиксирован: повторная сборка даёт те же экраны, предметы и ловушки', () => {
  const W2 = L.buildWorld();
  for (let i = 0; i < W.rooms.length; i++){
    eq(Array.from(W2.rooms[i].t).join(''), Array.from(W.rooms[i].t).join(''), 'экран ' + i);
    eq(JSON.stringify(W2.rooms[i].items), JSON.stringify(W.rooms[i].items), 'предметы ' + i);
    eq(JSON.stringify(W2.rooms[i].hz), JSON.stringify(W.rooms[i].hz), 'ловушки ' + i);
  }
});
test('наполнение: уголь ≥ 100, три ключа и три двери, Горн в стартовом экране, маяки, каски; все виды ловушек и обитателей', () => {
  ok(W.totalCoal >= 100, 'угля ' + W.totalCoal);
  eq(W.keys.map(k => k.key).join(''), '123'); W.keys.forEach(k => eq(W.rooms[k.room].kind, String(k.key)));
  const doors = new Set(); W.rooms.forEach(rm => { if (rm.c.R && rm.c.R.key) doors.add(rm.c.R.key); }); eq([...doors].sort().join(''), '123');
  ok(W.forge && W.rooms[W.forge.room].kind === 'S' && W.forge.room === W.start.room, 'Горн');
  ok(W.beacons.length >= 8, 'маяков ' + W.beacons.length); ok(W.helmets.length >= 3, 'касок ' + W.helmets.length);
  const fl = W.rooms.reduce((a, r) => a + r.hz.enemies.filter(e => e.type === 'flyer').length, 0), cr = sum('enemies') - fl;
  console.log('     уголь ' + W.totalCoal + ', прессы ' + sum('presses') + ', капли ' + sum('drips') + ', вагонетки ' + sum('carts') + ', конвейеры ' + sum('belts') + ', обрывы ' + sum('pits') + ', сажники ' + fl + ', окалыши ' + cr);
  ok(sum('presses') >= 8 && sum('drips') >= 10 && sum('carts') >= 5 && sum('belts') >= 10 && sum('pits') >= 5, 'ловушки');
  ok(fl >= 15 && cr >= 8, 'обитатели');
});

// ---------- переходы, лестницы, падения ----------
test('переход по краю экрана: дверь влево и вправо, экран отмечается на карте', () => {
  const flatL = r => r.c.L && r.c.L.k === 'open' && [0, 1, 2, 3, 4, 5].every(x => r.f[x] === r.c.L.h && r.t[r.f[x] * COLS + x] === L.R);
  const st = find(r => flatL(r) && (nb => [14, 15, 16, 17, 18, 19].every(x => nb.f[x] === r.c.L.h && nb.t[nb.f[x] * COLS + x] === L.R))(W.rooms[r.c.L.to]));
  ok(st, 'есть ровный проход'); const { game, S } = mk();
  place(game, st, 2); run(game, 1.2, -1);
  eq(S.room, st.c.L.to, 'ушёл влево'); ok(S.hero.x > 12, 'x с другой стороны: ' + S.hero.x.toFixed(2));
  ok(S.visited[st.i] && S.visited[st.c.L.to]);
  run(game, 1.2, 1); eq(S.room, st.i, 'вернулся вправо');
});
test('лестница и верёвка: подъём в экран выше и спуск обратно', () => {
  for (const rope of [false, true]){
    const { game, S } = mk(), up = find(r => r.c.D && !!r.c.D.rope === rope), lo = W.rooms[up.c.D.to], c = up.c.D.col;
    place(game, lo, c); run(game, 6, 0, -1);
    eq(S.room, up.i, 'поднялся (верёвка: ' + rope + ')'); ok(S.hero.ground && !S.hero.climb); eq(Math.round(S.hero.y), up.f[c]);
    run(game, 6, 0, 1); eq(S.room, lo.i, 'спустился'); ok(S.hero.ground, 'стоит внизу');
  }
});
test('падение: с высоты ≥ 7,5 клетки — гибель; обычный прыжок и шаг с уступа — нет', () => {
  const { game, S, has } = mk(), rm = find(r => quiet(r) && r.f[9] >= 9 && r.t[(r.f[9] - 8) * COLS + 9] === L.E && [...Array(8).keys()].every(k => r.t[(r.f[9] - 1 - k) * COLS + 9] === L.E));
  ok(rm, 'есть высокий зал');
  place(game, rm, 9, rm.f[9] - 8); S.hero.ground = false; S.hero.apex = rm.y * ROWS + rm.f[9] - 8;
  run(game, 1.5); ok(has('die'), 'разбился'); eq(S.why.fall, 1);
  const g2 = mk(); place(g2.game, room('1,0'), 9); run(g2.game, 0.1, 0, 0, true); run(g2.game, 1.2); ok(!g2.has('die')); ok(g2.S.hero.ground);
});
test('конвейер несёт стоящего героя; против ленты можно идти', () => {
  const rm = find(r => r.hz.belts.length && quiet(r)) || find(r => r.hz.belts.length), b = rm.hz.belts[0], c = Math.floor((b.s + b.e) / 2);
  const { game, S } = mk(); place(game, rm, c, b.y); const x0 = S.hero.x;
  run(game, 0.3); ok((S.hero.x - x0) * b.dir > 0.4, 'сдвинуло на ' + (S.hero.x - x0).toFixed(2));
  place(game, rm, c, b.y); const x1 = S.hero.x; run(game, 0.3, -b.dir); ok((S.hero.x - x1) * -b.dir > 0.5, 'идёт против ленты');
});
test('обрыв: падение на шипы — гибель', () => {
  const rm = find(r => r.hz.pits.length), p = rm.hz.pits[0];
  const { game, S, has } = mk(); place(game, rm, p.x - 1, p.y); run(game, 1.2, 1);
  ok(has('die'), 'погиб'); eq(S.why.spikes, 1);
});

// ---------- ловушки по такту (safe: false) ----------
function unsafe(){ return mk({ safe: false }); }
test('пресс: наверху безопасен (окно ≥ 1,4 с), при ударе давит', () => {
  const rm = find(r => r.hz.presses.length), p = rm.hz.presses[0];
  let upT = 0; for (let t = 0; t < p.per; t += 0.01) if (L.pressAt(p, t).st === 'up') upT += 0.01;
  ok(upT >= 1.4, 'окно ' + upT.toFixed(2));
  const { game, S, has } = unsafe(); place(game, rm, p.x, p.bot);
  let t0 = 0; while (L.pressAt(p, t0).st !== 'up' || L.pressAt(p, t0).k > 0.1) t0 += 0.01;
  S.time = t0; S.hero.inv = 0; game.update(1 / 60); ok(!has('die'), 'под поднятым прессом живой');
  for (let i = 0; i < 300 && !has('die'); i++) game.update(1 / 60);
  ok(has('die')); eq(S.why.press, 1); ok(['slam', 'down'].includes(L.pressAt(p, S.time).st));
});
test('капля: падая на героя — гибель; набухающая у потолка безопасна', () => {
  const rm = find(r => r.hz.drips.length && r.t[r.hz.drips[0].y1 * COLS + r.hz.drips[0].x] !== L.PF), d = rm.hz.drips[0];
  const { game, S, has } = unsafe(); place(game, rm, d.x, d.y1);
  S.time = 0; S.hero.inv = 0;
  for (let i = 0; i < 400 && !has('die'); i++) game.update(1 / 60);
  ok(has('die')); eq(S.why.drip, 1); eq(L.dripAt(d, S.time).st, 'fall');
});
test('вагонетка: касание — гибель; рельсы далеко от дверей', () => {
  W.rooms.forEach(r => r.hz.carts.forEach(c => ok(c.s >= 3 && c.e <= COLS - 4, 'рельсы у двери ' + r.x + ',' + r.y)));
  const rm = find(r => r.hz.carts.length), cr = rm.hz.carts[0];
  const { game, S, has } = unsafe(); place(game, rm, cr.s + 2, cr.y); S.hero.inv = 0;
  for (let i = 0; i < 900 && !has('die'); i++) game.update(1 / 60);
  ok(has('die')); eq(S.why.cart, 1);
});
test('обитатели: касание — гибель; каска защищает 10 с и снимается', () => {
  const rm = find(r => r.hz.enemies.some(e => e.type === 'crawler')), e = rm.hz.enemies.find(q => q.type === 'crawler');
  const a = mk({ safe: false }); place(a.game, rm, Math.floor(e.x0), e.y); a.S.hero.inv = 0;
  for (let i = 0; i < 1200 && !a.has('die'); i++) a.game.update(1 / 60);
  ok(a.has('die'), 'окалыш'); eq(a.S.why.crawler, 1);
  const b = mk({ safe: false }), hm = W.helmets[0], hr = W.rooms[hm.room], it = hr.items.find(q => q.k === 'helmet');
  place(b.game, hr, it.c, it.r); b.S.hero.inv = 1; b.game.update(1 / 60); ok(b.has('helmet'), 'каска подобрана'); ok(b.S.helmet > 9);
  place(b.game, rm, Math.floor(e.x0), e.y); b.S.hero.inv = 0;
  for (let i = 0; i < 9 * 60; i++) b.game.update(1 / 60);
  ok(!b.has('die'), 'в каске жив'); for (let i = 0; i < 1300 && !b.has('die'); i++) b.game.update(1 / 60);
  ok(b.has('helmetEnd'), 'каска снялась'); ok(b.has('die'), 'без каски — гибель');
});
test('сажники летают так, что не задевают просто стоящего героя (опасны прыжкам и лазанию)', () => {
  let n = 0;
  for (const rm of W.rooms){
    const fl = rm.hz.enemies.filter(e => e.type === 'flyer'); if (!fl.length) continue;
    const st = { keys: { 1: true, 2: true, 3: true }, gate: true }, stands = [];
    for (let r = 2; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (L.isStand(st, rm, c, r) && L.tileAt(st, rm, c, r) !== L.LD) stands.push({ x: c + 0.5, y: r });
    for (let t = 0; t < 30; t += 0.05) for (const e of fl){
      const p = L.enemyAt(e, t), box = { x0: p.x - 0.38, x1: p.x + 0.38, y0: p.y - 0.32, y1: p.y + 0.32 };
      for (const s of stands) ok(!L.overlap(L.heroBox({ x: s.x, y: s.y }), box), 'экран ' + rm.x + ',' + rm.y + ' клетка ' + s.x + ',' + s.y);
      n++;
    }
  }
  ok(n > 1000);
});
test('опасности — чистые функции времени: одинаковое t → одинаковые области', () => {
  for (const rm of W.rooms) for (const t of [0, 1.234, 77.7]) eq(JSON.stringify(L.hazards(rm, t).map(h => [h.x0, h.x1, h.y0, h.y1])), JSON.stringify(L.hazards(rm, t).map(h => [h.x0, h.x1, h.y0, h.y1])));
});

// ---------- ключи, уголь, жизни, маяки, Горн ----------
test('дверь заперта без ключа; ключ — событие и проход', () => {
  const rm = find(r => r.c.R && r.c.R.key === 1), h = rm.c.R.h;
  const { game, S, has } = mk(); place(game, rm, COLS - 3, h); run(game, 1.5, 1); eq(S.room, rm.i, 'дверь держит');
  const k = W.keys[0], kr = W.rooms[k.room]; place(game, kr, k.c, k.r); game.update(1 / 60); ok(has('key')); ok(S.keys[1]);
  place(game, rm, COLS - 3, h); run(game, 1.5, 1); eq(S.room, rm.c.R.to, 'проход открыт');
});
test('уголь: сбор, счёт, бонус «экран чист», жизнь за очки', () => {
  const { game, S, has, count } = mk(), rm = W.rooms.find(r => r.coal >= 2);
  const cs = rm.items.filter(i => i.k === 'coal');
  cs.forEach(c => { place(game, rm, c.c, c.r); game.update(1 / 60); });
  eq(S.coal, cs.length); ok(has('roomClear')); eq(count('roomClear'), 1);
  eq(S.score, cs.length * L.PTS.coal + L.PTS.room);
  const lives = S.lives; W.coal.forEach(c => { if (!S.got[c.id]){ place(game, W.rooms[c.room], c.c, c.r); game.update(1 / 60); } });
  eq(S.coal, S.total); ok(has('life')); ok(S.lives > lives, 'жизни ' + S.lives);
});
test('заслонка Горна закрыта, пока не собран весь уголь; Горн — победа и бонус', () => {
  const { game, S, has } = mk(), st = W.rooms[W.start.room];
  const gx = 3, gy = W.forge.r - 1;
  ok(L.isSolid(L.tileAt(S, st, gx, gy)), 'заслонка закрыта');
  place(game, st, 5, W.forge.r); run(game, 1.5, -1); ok(S.hero.x > 4, 'не пройти'); ok(!has('win'));
  game._giveCoal(S.total - 1); ok(!S.gate);
  const last = W.coal.find(c => !S.got[c.id]); place(game, W.rooms[last.room], last.c, last.r); game.update(1 / 60);
  ok(S.gate && has('gateOpen')); eq(L.tileAt(S, st, gx, gy), L.E, 'заслонка открыта');
  place(game, st, 5, W.forge.r); run(game, 1.5, -1); ok(has('win')); ok(S.won); ok(S.finalBonus >= L.PTS.forge);
});
test('гибель — минус жизнь и возврат к маяку; 3 жизни — конец игры', () => {
  const { game, S, has, count } = mk(), rm = find(r => r.kind === 'b'), b = rm.items.find(i => i.k === 'beacon');
  place(game, rm, b.c, b.r); game.update(1 / 60); ok(has('beacon'), 'маяк'); eq(S.cp.id, b.id); ok(S.score >= L.PTS.beacon);
  place(game, room('1,0'), 9); game._die('flyer'); eq(S.phase, 'dead'); eq(S.lives, 2);
  run(game, 2); eq(S.phase, 'play'); eq(S.room, rm.i, 'у маяка'); ok(Math.abs(S.hero.x - (b.c + 0.5)) < 0.01); ok(S.hero.inv > 0, 'неуязвим после возврата');
  for (let k = 0; k < 2; k++){ run(game, 2.5); game._die('drip'); run(game, 2); }
  ok(S.over, 'конец'); ok(has('gameover')); eq(count('die'), 3);
});
test('карта шахты: посещённые экраны, «?» у неоткрытых соседей, счётчик угля', () => {
  const { game, S } = mk(); place(game, room('1,0'), 9); place(game, room('2,0'), 9);
  eq(Object.keys(S.visited).length, 3);
  const texts = [];
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
  const g = { W: 640, H: 420, t: k => k, text: s => texts.push(String(s)) };
  U.ui.mapOverlay(g, ctx, S, U.modern.P, U.modern, game);
  ok(texts.includes('map')); const q = texts.filter(s => s === '?').length;
  const adj = new Set(); Object.keys(S.visited).forEach(i => { const r = W.rooms[i]; ['L', 'R', 'U', 'D'].forEach(d => { if (r.c[d] && !S.visited[r.c[d].to]) adj.add(r.c[d].to); }); });
  eq(q, adj.size, 'знаки «?»'); ok(texts.some(s => s.startsWith('coal 0/' + W.totalCoal)), 'счётчик угля');
});

// ---------- проходимость (граф с учётом ключей и заслонки) ----------
const nav = L.Nav(W), SOL = nav.solve();
test('проходимость: весь уголь, все ключи и Горн достижимы; ключи по порядку 1 → 2 → 3', () => {
  eq(SOL.coal, W.totalCoal); ok(SOL.forge, 'Горн'); eq(SOL.keyOrder.join(''), '123');
  const rooms = new Set([...SOL.reach].map(n => Math.floor(n / NK))); eq(rooms.size, W.rooms.length, 'все экраны');
});
test('двери важны: без ключей часть угля недоступна; без всего угля Горн закрыт', () => {
  const R0 = nav.reach({ keys: {}, gate: false }, W.start.node);
  const n0 = W.coal.filter(c => R0.has(c.node)).length; ok(n0 < W.totalCoal * 0.7, 'без ключей: ' + n0);
  const R1 = nav.reach(Object.assign({}, SOL.st, { gate: false }), W.start.node); ok(!R1.has(W.forge.node));
  console.log('     без ключей доступно угля: ' + n0 + '/' + W.totalCoal);
});
test('нет тупиков: из любого достижимого места можно дойти до Горна', () => {
  const rev = new Map(); SOL.reach.forEach(n => nav.edges(SOL.st, n).forEach(e => { if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push(n); }));
  const back = new Set([W.forge.node]), q = [W.forge.node];
  while (q.length){ const n = q.pop(); for (const m of rev.get(n) || []) if (!back.has(m)){ back.add(m); q.push(m); } }
  const bad = [...SOL.reach].filter(n => !back.has(n)); eq(bad.length, 0, 'тупики: ' + bad.slice(0, 3).map(n => W.rooms[Math.floor(n / NK)].x + ',' + W.rooms[Math.floor(n / NK)].y));
});
test('граф совпадает с физикой игры: 300 случайных рёбер воспроизводятся в Game', () => {
  const nodes = [...SOL.reach], rng = mulberry32(42); let checked = 0;
  for (let k = 0; k < 300; k++){
    const n = nodes[Math.floor(rng() * nodes.length)], es = nav.edges(SOL.st, n); if (!es.length) continue;
    const e = es[Math.floor(rng() * es.length)], a = L.ACTS[e.a], rm = W.rooms[Math.floor(n / NK)], rc = n % NK;
    const { game, S } = mk(); Object.assign(S.keys, SOL.st.keys); S.gate = true;
    place(game, rm, rc % COLS, Math.floor(rc / COLS));
    const m = { X0: L.absX(W, S.hero), left: false, climbed: false }; let t = 0, f = null;
    for (let i = 0; i < 600 && !f && S.phase === 'play'; i++){ const inp = L.drive(W, a, t, S.hero, m.X0); game.setInput(inp.dx, inp.dy, inp.jump); game.update(1 / 60); t += 1 / 60; f = L.finished(W, a, t, S.hero, m); }
    if (S.won) { checked++; continue; }   // касание Горна завершает игру
    eq(f, 'ok', 'ребро ' + n + '→' + e.to);
    const to = S.hero.room * NK + Math.round(S.hero.y) * COLS + Math.floor(S.hero.x);
    ok(to === e.to || Math.abs(to - e.to) === 1, 'ребро ' + n + ' → ' + e.to + ', в игре ' + to); checked++;
  }
  ok(checked > 250);
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек ugolyok подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.ugolyok; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; есть имена всех ярусов, ключей и причин гибели', () => {
  const ru = Object.keys(U.STR.ru).sort(), en = Object.keys(U.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let k = 1; k <= 3; k++) ok(U.STR.ru['k' + k] && U.STR.en['k' + k]);
  L.ZONES.forEach(z => ok(U.STR.ru['z_' + z] && U.STR.en['z_' + z], z));
  ['press', 'drip', 'cart', 'flyer', 'crawler', 'fall', 'spikes'].forEach(w => ok(U.STR.ru['why_' + w] && U.STR.en['why_' + w], w));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Уголёк') && !BAD.test('ugolyok') && !BAD.test('сажник') && !BAD.test('окалыш') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без гибели от ловушек собирает весь уголь и раздувает Горн в настоящей физике', () => {
  for (const s of [1, 2]){ const r = playUgolyok(U, s, { safe: true, maxT: 1500 }); ok(r.won, 'сид ' + s + ': угля ' + r.coal + '/' + r.total); }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибки времени нажатий, не замечает часть обитателей,
// ждёт у ловушек лишь несколько секунд. 30 партий (сиды 1..30). Цели: первый экран ≥ 90%, вся игра ≈ 25–60%.
const N = 30, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playUgolyok(U, s));
test('баланс: бот собирает уголь стартового экрана в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.firstRoom).length; console.log('     первый экран: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: вся игра (весь уголь + Горн) — 25–65% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length;
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const wt = BAL.filter(r => r.won).map(r => r.time), avg = BAL.reduce((a, r) => a + r.coal / r.total, 0) / N;
  console.log('     победы: ' + n + '/' + N + '; средняя доля угля: ' + Math.round(avg * 100) + '%; гибели: ' + JSON.stringify(why) + '; время побед, с: ' + (wt.length ? Math.min(...wt).toFixed(0) + '–' + Math.max(...wt).toFixed(0) : '—'));
  ok(n >= 0.25 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.65 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял: сиды ' + BAL.filter(r => r.stuck).map(r => r.seed).join(','));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

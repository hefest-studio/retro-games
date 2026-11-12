/* ЮЗ · tests/engine.test.mjs — автотесты логики и обвязки (Node, без зависимостей).
   Запуск: node yuz/tests/engine.test.mjs
   Логика (js/game.js) — в node:vm с шимом window; ввод двух игроков — через движок (engine.js) с фейковым DOM.
   Бот (tests/bot.mjs) — «человеческий» игрок для баланса: трасса 1 — 1-е/2-е место ≥ 90 %, чемпионат 1-м местом ~20–40 %. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/game.js'), sandbox, { filename: 'game.js' });
vm.runInContext(read('js/i18n.js'), sandbox, { filename: 'i18n.js' });
const Y = sandbox.YUZ, L = Y.logic;
const { playYuz, makeHuman, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

const h = L.STEP;
// Заезд в фазе race: только нужные машинки (остальные «выбыли» и не мешают), бонусы убраны
function race(opts = {}){
  const events = [];
  const game = Y.Game(Object.assign({ players: 1, rng: mulberry32(1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  S.phase = 'race'; S.phaseT = 5; S.raceT = 5;
  if (!opts.keepItems) S.items = [];
  return { game, S, events };
}
function solo(opts){ const r = race(Object.assign({ elim: false }, opts)); r.S.cars.forEach((c, i) => { if (i) { c.out = true; c.x = c.y = -999; } }); return r; }
function put(S, c, si, lat = 0, a){ const p = S.track.smp[si]; c.x = p.x + p.nx * lat; c.y = p.y + p.ny * lat; c.si = si; c.vx = c.vy = 0; c.a = a == null ? p.ang : a; c.air = 0; c.z = 0; }
function steps(game, n, fn){ for (let i = 0; i < n; i++){ if (fn) fn(i); game._tick(h); } }
const spd = c => Math.hypot(c.vx, c.vy);
// найти на трассе клетку покрытия s (центр) → индекс выборки осевой
function sampleOn(T, surf){ for (let i = 0; i < T.n; i++){ const p = T.smp[i]; if (L.surfAt(T, p.x, p.y) === surf) return i; } return -1; }
function inWall(T, c){ return L.surfAt(T, c.x, c.y) === L.WALL; }

// ---------- трассы ----------
test('трассы: 8 трасс в 4 «комнатах» (по 2), названия RU/EN, все покрытия и оба бонуса встречаются', () => {
  eq(L.TRACKS.length, 8);
  const rooms = {}; L.TRACKS.forEach(t => { rooms[t.room] = (rooms[t.room] || 0) + 1; ok(Y.STR.ru['tr_' + t.id] && Y.STR.en['tr_' + t.id], 'нет названия ' + t.id); });
  eq(rooms, { desk: 2, bench: 2, kitchen: 2, garden: 2 });
  const surf = new Set(), items = new Set();
  L.TRACKS.forEach(t => { t.patches.forEach(p => surf.add(p.s)); t.items.forEach(i => items.add(i.k)); });
  eq([...surf].sort(), ['ice', 'jump', 'oil', 'sand', 'water']);
  eq([...items].sort(), ['boost', 'shield']);
});

test('геометрия: дальние участки трассы не сливаются (между ними стена ≥ 16 px) — срезать нельзя; полотно связно', () => {
  for (let ti = 0; ti < 8; ti++){
    const T = L.buildTrack(ti), n = T.n;
    let mg = 1e9;
    for (let i = 0; i < n; i += 2) for (let j = i + 1; j < n; j += 2){
      if (Math.min(j - i, n - (j - i)) * T.ds < T.hw * 4) continue;
      mg = Math.min(mg, Math.hypot(T.smp[i].x - T.smp[j].x, T.smp[i].y - T.smp[j].y));
    }
    ok(mg >= 2 * T.hw + 16, `${T.id}: участки ближе ${mg | 0} px`);
    // связность клеток полотна
    const G = T.grid, seen = new Uint8Array(G.length); let total = 0, start = -1;
    for (let k = 0; k < G.length; k++) if (G[k] !== L.WALL){ total++; if (start < 0) start = k; }
    const q = [start]; seen[start] = 1;
    for (let k = 0; k < q.length; k++){ const id = q[k], x = id % T.cols, y = (id / T.cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= T.cols || ny >= T.rows) continue; const ni = ny * T.cols + nx; if (!seen[ni] && G[ni] !== L.WALL){ seen[ni] = 1; q.push(ni); } } }
    eq(q.length, total, T.id + ': полотно несвязно');
    ok(T.len > 2000 && T.len < 6000, T.id + ': длина ' + T.len);
  }
});

test('старт: решётка 2×2 за линией старта, машинки на полотне и не перекрываются; кругов 2–3', () => {
  const { S } = race({ players: 2 });
  for (let ti = 0; ti < 8; ti++){
    const g2 = Y.Game({ players: 2, track: ti, tracks: ti + 1 }).start(), S2 = g2.state();
    ok(S2.laps === 2 || S2.laps === 3, 'кругов ' + S2.laps);
    S2.cars.forEach(c => { ok(!inWall(S2.track, c), S2.track.id + ': машинка в стене'); ok(L.clearAt(S2.track, c.x, c.y) >= L.CAR.r, S2.track.id + ': у самой стены'); });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok(Math.hypot(S2.cars[i].x - S2.cars[j].x, S2.cars[i].y - S2.cars[j].y) > L.CAR.r * 2, 'перекрытие');
  }
  eq(S.cars.length, 4);
});

// ---------- физика ----------
test('физика: разгон до ~190 px/с на асфальте, тормоз останавливает, задний ход медленный', () => {
  const { game, S } = solo(), c = S.cars[0];
  put(S, c, 2);
  c.inp = { steer: 0, gas: 1, brake: 0, drift: 0 };
  const T = S.track; let maxV = 0;
  for (let i = 0; i < 150; i++){ c.inp.gas = 1; L.CAR && game._physics(c, h); maxV = Math.max(maxV, spd(c)); c.x = T.smp[40].x; c.y = T.smp[40].y; }   // «бесконечная прямая»
  ok(maxV > 175 && maxV < 200, 'макс. скорость ' + maxV.toFixed(1));
  c.inp = { steer: 0, gas: 0, brake: 1, drift: 0 }; let t = 0;
  while (c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a) > 1 && t < 200){ game._physics(c, h); c.x = T.smp[40].x; c.y = T.smp[40].y; t++; }
  ok(t < 40, 'тормозной путь ' + t + ' шагов');
  for (let i = 0; i < 200; i++){ game._physics(c, h); c.x = T.smp[40].x; c.y = T.smp[40].y; }
  const back = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
  ok(back < -40 && back > -L.CAR.rev - 1, 'задний ход ' + back.toFixed(1));
});

// разгон на «бесконечной» клетке покрытия surf и проверка скольжения в повороте
function onSurface(surf, opt = {}){
  const ti = surf === L.ASPH ? 0 : L.TRACKS.findIndex((t, i) => L.buildTrack(i).grid.includes(surf));
  const { game, S } = solo({ track: ti, tracks: ti + 1 }), c = S.cars[0], T = S.track;
  let sx = 0, sy = 0;
  if (surf !== L.ASPH){ for (let i = 0; i < T.grid.length; i++) if (T.grid[i] === surf){ sx = (i % T.cols) * L.CELL + 4; sy = ((i / T.cols) | 0) * L.CELL + 4; break; } }
  else { sx = T.smp[40].x; sy = T.smp[40].y; }
  ok(sx, 'нет покрытия ' + surf);
  if (opt.shield) c.shield = 99;
  c.a = 0; c.vx = c.vy = 0; c.inp = { steer: 0, gas: 1, brake: 0, drift: 0 };
  let top = 0; for (let i = 0; i < 360; i++){ game._physics(c, h); c.x = sx; c.y = sy; top = Math.max(top, spd(c)); }
  // занос: 0,4 с руля на скорости 150 и замер бокового скольжения
  c.vx = 150; c.vy = 0; c.a = 0; c.inp = { steer: 1, gas: 1, brake: 0, drift: opt.drift ? 1 : 0 };
  let slip = 0; for (let i = 0; i < 24; i++){ game._physics(c, h); c.x = sx; c.y = sy; slip = Math.max(slip, c.slip); }
  return { top, slip };
}
test('покрытия: песок замедляет, лёд/вода/масло — скользко (занос сильнее), щит гасит масло', () => {
  const asp = onSurface(L.ASPH), sand = onSurface(L.SAND), ice = onSurface(L.ICE), water = onSurface(L.WATER), oil = onSurface(L.OIL), oilS = onSurface(L.OIL, { shield: true });
  console.log('     предел, px/с: асфальт ' + asp.top.toFixed(0) + ', песок ' + sand.top.toFixed(0) + ', вода ' + water.top.toFixed(0) + ', лёд ' + ice.top.toFixed(0) + '; скольжение: асфальт ' + asp.slip.toFixed(0) + ', лёд ' + ice.slip.toFixed(0) + ', масло ' + oil.slip.toFixed(0));
  ok(sand.top < asp.top * 0.6, `песок: ${sand.top.toFixed(0)} vs асфальт ${asp.top.toFixed(0)}`);
  ok(water.top < asp.top * 0.8, 'вода замедляет: ' + water.top.toFixed(0));
  ok(ice.slip > asp.slip * 2.5, `лёд скользит: ${ice.slip.toFixed(1)} vs ${asp.slip.toFixed(1)}`);
  ok(water.slip > asp.slip * 2, 'вода скользит');
  ok(oil.slip > ice.slip, 'масло — скользче льда');
  ok(Math.abs(oilS.slip - asp.slip) < 1 && Math.abs(oilS.top - asp.top) < 2, 'щит: масло как асфальт');
});

test('занос (дрифт): с кнопкой заноса на скорости боковое скольжение и поворот сильнее', () => {
  const plain = onSurface(L.ASPH), drift = onSurface(L.ASPH, { drift: true });
  ok(drift.slip > plain.slip * 2, `скольжение ${plain.slip.toFixed(1)} → ${drift.slip.toFixed(1)}`);
  // инерция: отпустил газ — машинка катится
  const { game, S } = solo(), c = S.cars[0]; put(S, c, 2); c.vx = Math.cos(c.a) * 150; c.vy = Math.sin(c.a) * 150; c.inp = { steer: 0, gas: 0, brake: 0, drift: 0 };
  const x0 = c.x, y0 = c.y; for (let i = 0; i < 30; i++) game._physics(c, h);
  ok(Math.hypot(c.x - x0, c.y - y0) > 50, 'накат по инерции');
});

test('трамплин: на скорости машинка взлетает, пролетает масло без заноса и приземляется; медленно — не прыгает', () => {
  const T = L.buildTrack(1), ji = sampleOn(T, L.JUMP); ok(ji >= 0, 'нет трамплина');
  const { game, S, events } = solo({ track: 1, tracks: 2 }), c = S.cars[0];
  put(S, c, ji - 8); const v = 185; c.vx = Math.cos(c.a) * v; c.vy = Math.sin(c.a) * v;
  let air = 0, oilTouched = false, airHit = 0;
  steps(game, 90, () => { c.inp = { steer: 0, gas: 1, brake: 0, drift: 0 }; if (c.air > 0){ air++; if (L.surfAt(T, c.x, c.y) === L.OIL) oilTouched = true; airHit = events.filter(e => e[0] === 'wall').length; } });
  ok(events.some(e => e[0] === 'jump') && events.some(e => e[0] === 'land'), 'прыжок и приземление');
  ok(air > 20, 'в воздухе ' + air + ' шагов');
  ok(oilTouched, 'под машинкой было масло');
  eq(airHit, 0, 'в полёте без ударов');
  ok(c.surf !== L.OIL || c.slip < 30, 'после приземления не на масле');
  const r2 = solo({ track: 1, tracks: 2 }), c2 = r2.S.cars[0];
  put(r2.S, c2, ji - 3); c2.vx = Math.cos(c2.a) * 50; c2.vy = Math.sin(c2.a) * 50;
  steps(r2.game, 20, () => { c2.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; });
  ok(!r2.events.some(e => e[0] === 'jump'), 'на 50 px/с не взлетает');
});

test('стены: сквозь стену не проехать — 1000 шагов газ + случайный руль на всех трассах, центр всегда на полотне', () => {
  const rnd = mulberry32(9);
  for (let ti = 0; ti < 8; ti++){
    const { game, S, events } = solo({ track: ti, tracks: ti + 1 }), c = S.cars[0];
    let st = 0, bad = 0;
    steps(game, 1000, i => { if (i % 20 === 0) st = rnd() < 0.5 ? (rnd() < 0.5 ? -1 : 1) : 0; c.inp = { steer: st, gas: 1, brake: 0, drift: rnd() < 0.2 ? 1 : 0 }; c.air = 0; });
    for (let i = 0; i < 100; i++){ game._tick(h); if (inWall(S.track, c)) bad++; }
    eq(bad, 0, S.track.id + ': в стене');
    ok(events.some(e => e[0] === 'wall'), S.track.id + ': были удары о стены');
  }
  // лобовой удар: скорость гаснет, машинку отбрасывает
  const { game, S, events } = solo(), c = S.cars[0], p = S.track.smp[20];
  c.x = p.x; c.y = p.y; c.si = 20; c.a = p.ang + Math.PI / 2; c.vx = Math.cos(c.a) * 180; c.vy = Math.sin(c.a) * 180;
  steps(game, 40, () => { c.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; });
  ok(events.some(e => e[0] === 'wall'), 'удар');
  ok(!inWall(S.track, c) && spd(c) < 100, 'отскок, скорость ' + spd(c).toFixed(0));
});

test('столкновения машинок: не проходят друг сквозь друга, импульс передаётся; щит «тяжелее»', () => {
  const { game, S, events } = race({ elim: false }), [a, b] = S.cars;
  S.cars.slice(2).forEach(c => { c.out = true; });
  put(S, a, 40, 0); put(S, b, 46, 0);
  const ang = S.track.smp[40].ang; a.vx = Math.cos(ang) * 150; a.vy = Math.sin(ang) * 150; a.a = b.a = ang;
  let minD = 1e9;
  steps(game, 40, () => { a.inp = b.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; minD = Math.min(minD, Math.hypot(a.x - b.x, a.y - b.y)); });
  ok(events.some(e => e[0] === 'bump'), 'удар');
  ok(minD > L.CAR.r * 2 - 2, 'перекрытие ' + minD.toFixed(1));
  ok(spd(b) > 60, 'передний получил импульс: ' + spd(b).toFixed(0));
  // щит: машинка со щитом почти не теряет скорость
  const r = race({ elim: false }), [s1, s2] = r.S.cars; r.S.cars.slice(2).forEach(c => { c.out = true; });
  put(r.S, s1, 40, 0); put(r.S, s2, 46, 0); s1.shield = 9; s1.vx = Math.cos(ang) * 150; s1.vy = Math.sin(ang) * 150;
  steps(r.game, 40, () => { s1.inp = s2.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; });
  ok(spd(s1) > spd(a) * 1.6, `со щитом ${spd(s1).toFixed(0)} vs без ${spd(a).toFixed(0)}`);
});

// ---------- круги и чекпоинты ----------
function glide(game, S, c, from, to, step = 4){   // провести машинку по осевой от выборки from до to (вперёд/назад)
  const n = S.track.n, dir = to >= from ? 1 : -1;
  for (let i = from; dir > 0 ? i <= to : i >= to; i += dir * step){ const j = ((i % n) + n) % n, p = S.track.smp[j]; c.x = p.x; c.y = p.y; c.vx = c.vy = 0; game._progress(c); }
}
test('круги: засчитываются только при проезде всех чекпоинтов по порядку; финиш после последнего круга', () => {
  const { game, S, events } = solo(), c = S.cars[0], n = S.track.n;
  eq([c.lap, c.cp], [0, 0]);
  glide(game, S, c, c.si, n + 2);
  eq(c.lap, 1, 'пересёк старт — 1-й круг');
  glide(game, S, c, 2, n + 2); eq(c.lap, 2, 'полный круг');
  glide(game, S, c, 2, n * 2 + 2); eq(c.lap, 3);   // 3-й круг (на этой трассе 3)
  eq(S.laps, 3);
  glide(game, S, c, 2, n + 2);
  ok(c.finished && c.place === 1, 'финиш');
  ok(events.some(e => e[0] === 'finish'));
});

test('чекпоинты: срезать нельзя — «прыжок» через часть круга и проезд финиша задним ходом круг не засчитывают', () => {
  const { game, S } = solo(), c = S.cars[0], n = S.track.n;
  glide(game, S, c, c.si, n + 2); eq(c.lap, 1);
  const cp0 = c.cp;
  // телепорт: с 10 % круга сразу на 90 % (минуя чекпоинты) и через финиш
  glide(game, S, c, 2, Math.round(n * 0.1));
  const far = Math.round(n * 0.9); c.si = far; glide(game, S, c, far, n + 2);
  eq(c.lap, 1, 'срез не засчитан');
  ok(c.cp - cp0 <= 1, 'чекпоинты за срез не даются: ' + (c.cp - cp0));
  // задним ходом через линию старта и обратно — круг не растёт
  const { game: g2, S: S2 } = solo(), c2 = S2.cars[0];
  glide(g2, S2, c2, c2.si, S2.track.n + 10); eq(c2.lap, 1);
  glide(g2, S2, c2, S2.track.n + 10, S2.track.n - 40); glide(g2, S2, c2, S2.track.n - 40, S2.track.n + 10);
  eq(c2.lap, 1, 'туда-обратно через старт');
});

test('выбывание: вне экрана дольше OUT_T — выбыл; вернулся раньше — нет; выбывшие внизу таблицы, заезд кончается', () => {
  const { game, S, events } = race(), [p1, b1, b2] = S.cars;
  S.cars[3] && (S.cars[3].out = true);
  // лидер — бот, камера на нём; игрока уносим далеко назад
  b1.cp = b2.cp = 20; p1.cp = 1;
  const far = S.track.smp[Math.round(S.track.n * 0.5)];
  steps(game, 4, () => {});
  p1.x = far.x; p1.y = far.y; p1.si = Math.round(S.track.n * 0.5); p1.vx = p1.vy = 0;
  const before = p1.out;
  steps(game, Math.round(L.OUT_T * 60) - 10, () => { p1.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; p1.x = far.x; p1.y = far.y; b1.cp = b2.cp = 20; });
  ok(!before && !p1.out, 'ещё не выбыл');
  steps(game, 20, () => { p1.x = far.x; p1.y = far.y; b1.cp = b2.cp = 20; });
  ok(p1.out, 'выбыл');
  ok(events.some(e => e[0] === 'out' && e[1].id === 'p1'));
  // игрок выбыл → заезд окончен, игрок на последнем месте
  steps(game, 120);
  eq(S.phase, 'results');
  eq(S.results[S.results.length - 1].id, 'p1');
  eq(S.results.map(r => r.pts), L.PTS.slice(0, S.results.length));
  // вернулся на экран вовремя — остаётся в гонке
  const r = race(), q = r.S.cars[0]; r.S.cars.slice(1).forEach(c => { c.cp = 20; });
  steps(r.game, 4);
  const pos = { x: q.x, y: q.y };
  q.x += 2000; steps(r.game, 20, () => {}); q.x = r.S.cam.x; q.y = r.S.cam.y;
  steps(r.game, 10); ok(!q.out, 'вернулся — не выбыл');
  ok(pos.x !== undefined);
});

test('чемпионат: очки 5/3/2/1 за места, сумма по трассам; после 8-й — победа только за 1-е место', () => {
  const events = [];
  const game = Y.Game({ players: 1, onEvent: (t, d) => events.push([t, d]) }).start(), S = game._S;
  const order = [['p1', 'pin', 'bun'], ['pin', 'p1', 'bun'], ['p1', 'bun', 'pin'], ['bun', 'pin', 'p1'], ['p1', 'pin', 'bun'], ['p1', 'pin', 'bun'], ['pin', 'bun', 'p1'], ['p1', 'bun', 'pin']];
  for (let ti = 0; ti < 8; ti++){
    eq(S.ti, ti);
    // финиш по заданному порядку
    S.phase = 'race'; S.phaseT = 0;
    order[ti].forEach((id, k) => { const c = game.car(id); c.finished = true; c.place = k + 1; });
    S.finishN = 3; S.raceT = 20;
    steps(game, 120);
    eq(S.phase, 'results', 'итоги заезда ' + ti);
    eq(S.results.map(r => [r.id, r.pts]), order[ti].map((id, k) => [id, L.PTS[k]]));
    game.next();
  }
  // p1: 5+3+5+2+5+5+2+5 = 32; pin: 3+5+2+3+3+3+5+2 = 26; bun: 2+2+3+5+2+2+3+3 = 22
  eq(S.standings.map(r => [r.id, r.pts]), [['p1', 32], ['pin', 26], ['bun', 22]]);
  ok(S.over && S.won && S.place === 1, 'чемпион');
  ok(events.some(e => e[0] === 'win'));
  eq(S.score, 32 * 100);
  // проигрыш: 2-е место → gameover с местом
  const ev2 = [], g2 = Y.Game({ players: 1, onEvent: (t, d) => ev2.push([t, d]) }).start(), S2 = g2._S;
  for (let ti = 0; ti < 8; ti++){
    S2.phase = 'race'; ['pin', 'p1', 'bun'].forEach((id, k) => { const c = g2.car(id); c.finished = true; c.place = k + 1; }); S2.finishN = 3; S2.raceT = 20;
    steps(g2, 120); g2.next();
  }
  ok(S2.over && !S2.won && S2.place === 2, 'место 2');
  ok(ev2.some(e => e[0] === 'gameover' && e[1].place === 2));
});

test('бонусы: ТУРБО — быстрее предела, ЩИТ — на время; бонус появляется снова через 6 с', () => {
  const { game, S, events } = solo({ keepItems: true }), c = S.cars[0], it = S.items.find(i => i.k === 'boost');
  ok(it, 'нет ТУРБО на трассе 1');
  c.x = it.x; c.y = it.y; c.a = 0; c.vx = 150; c.vy = 0;
  game._tick(h);
  ok(events.some(e => e[0] === 'pickup' && e[1].k === 'boost') && c.boost > 0 && it.t > 0, 'подобран');
  const T = S.track; let top = 0;
  for (let i = 0; i < 80; i++){ c.inp = { steer: 0, gas: 1, brake: 0, drift: 0 }; game._physics(c, h); c.x = T.smp[40].x; c.y = T.smp[40].y; top = Math.max(top, spd(c)); }
  ok(top > 200, 'турбо: ' + top.toFixed(0));
  const park = T.smp[Math.round(T.n * 0.3)];
  steps(game, Math.round(6.1 * 60), () => { c.x = park.x; c.y = park.y; c.vx = c.vy = 0; c.inp = { steer: 0, gas: 0, brake: 0, drift: 0 }; });
  ok(it.t <= 0, 'бонус вернулся');
  const sh = S.items.find(i => i.k === 'shield'); c.x = sh.x; c.y = sh.y; c.vx = c.vy = 0; game._tick(h);
  ok(c.shield > L.CAR.shieldT - 0.1, 'щит');
  ok(S.pickups === 2 && S.score === 0, 'учёт подборов (очки — по итогам заезда)');
});

// ---------- боты ----------
test('боты: проезжают все 8 трасс без застревания и не заезжают в стены (без выбывания)', () => {
  for (let ti = 0; ti < 8; ti++){
    const ev = [], game = Y.Game({ players: 0, bots: 2, track: ti, tracks: ti + 1, elim: false, rng: mulberry32(ti + 1), onEvent: (t, d) => ev.push(t) }).start(), S = game._S;
    let inw = 0, guard = 0;
    while (S.phase !== 'results' && guard++ < 60 * 200){ game._tick(h); S.cars.forEach(c => { if (inWall(S.track, c)) inw++; }); }
    eq(S.phase, 'results', S.track.id + ': заезд не закончился');
    ok(S.cars.every(c => c.finished), S.track.id + ': не все финишировали');
    ok(S.raceT < 140, S.track.id + ': долго ' + S.raceT.toFixed(0) + ' с');
    eq(inw, 0, S.track.id + ': в стене');
    ok(ev.filter(t => t === 'wall').length < 8, S.track.id + ': бьются о стены');
  }
});

test('боты: разный характер — «Шпилька» быстрее, «Бублик» объезжает покрытия; сложность растёт по трассам', () => {
  ok(L.DIFF.length === 8 && L.DIFF[7] > L.DIFF[0] && L.DIFF.every(d => d > 0.8 && d <= 1), 'кривая сложности');
  const [pin, bun] = L.BOTS;
  ok(pin.pace > bun.pace && pin.care < bun.care && pin.lane !== bun.lane, 'характеры различаются');
  let pinWins = 0;
  for (let ti = 0; ti < 8; ti++){
    const game = Y.Game({ players: 0, track: ti, tracks: ti + 1, elim: false }).start(), S = game._S;
    let g = 0; while (S.phase !== 'results' && g++ < 60 * 200) game._tick(h);
    if (S.results[0].id === 'pin') pinWins++;
  }
  ok(pinWins >= 5, 'Шпилька выигрывает у Бублика: ' + pinWins + '/8');
});

test('2 игрока (логика): две машинки управляются независимо', () => {
  const { game, S } = race({ players: 2, elim: false }), [a, b] = S.cars;
  S.cars.slice(2).forEach(c => { c.out = true; c.x = c.y = -999; });
  eq([a.id, b.id], ['p1', 'p2']);
  const a0 = a.a, b0 = b.a;
  steps(game, 40, i => { game.setInput(0, { steer: i < 15 ? -1 : 0, gas: 1 }); game.setInput(1, { steer: 1, gas: 0 }); });
  ok(spd(a) > 80 && spd(b) < 5, 'газ только у И1');
  ok(L.wrapA(a.a - a0) < -0.15 && Math.abs(L.wrapA(b.a - b0)) < 0.01, 'руль И1 влево; И2 без скорости не поворачивает');
  steps(game, 40, i => { game.setInput(0, { steer: 0, brake: 1 }); game.setInput(1, { steer: i > 15 && i < 30 ? 1 : 0, gas: 1 }); });
  ok(spd(b) > 60 && L.wrapA(b.a - b0) > 0.15, 'И2 едет и рулит вправо');
  ok(a.vx * Math.cos(a.a) + a.vy * Math.sin(a.a) < 20, 'И1 тормозит');
});

// ---------- ввод через движок (два игрока за одной клавиатурой) ----------
function makeEnv(){
  const Lst = { cap: {}, bub: {} }; let t = 1000;
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, Uint8Array, Int16Array, parseInt, parseFloat, Date,
    console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    addEventListener(ev, fn, opt) { const b = (opt === true || (opt && opt.capture)) ? Lst.cap : Lst.bub; (b[ev] = b[ev] || []).push(fn); },
    removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => t }, matchMedia: () => ({ matches: false })
  };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true, fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(read('engine.js'), win, { filename: 'engine.js' });
  vm.runInContext(read('js/game.js'), win, { filename: 'game.js' });
  const key = (type, code) => { const e = { type, code, repeat: false, preventDefault() {}, stopPropagation() {} }; (Lst.cap[type] || []).forEach(f => f(e)); (Lst.bub[type] || []).forEach(f => f(e)); };
  return { win, A: win.Arcade, key, tick: ms => { t += ms; }, store: win.localStorage._d };
}
test('ввод: раскладки без конфликтов; в режиме 2 игроков машинки И1 и И2 управляются независимо; 1 игрок — обе раскладки ведут И1', () => {
  const env = makeEnv(), A = env.A, B = env.win.YUZ.logic.BIND;
  eq(A.checkBindings(B, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }), [], 'конфликты раскладок');
  const g = A.createGame({ canvas: '#c', width: 640, height: 440, gameId: 'yuz' });
  g.useStandardScreens({ lives: 1 });
  g.usePlayers({ bind: B, actions: ['drift'], repeat: [] });
  g.scene('play', { realtime: true }); g.start('title');
  ok(g.menu.items('title').indexOf('players') === 1, 'пункт «Игроки» после «Играть»');
  env.key('keydown', 'Digit2'); env.key('keyup', 'Digit2'); eq(g.input.playerCount, 2);
  g.goto('play'); env.tick(200);
  const Y2 = env.win.YUZ, game = Y2.Game({ players: 2, rng: mulberry32(1), elim: false }).start(), S = game._S;
  S.phase = 'race'; S.items = []; S.cars.slice(2).forEach(c => { c.out = true; c.x = c.y = -999; });
  const feed = () => { for (let pi = 0; pi < 2; pi++){ const I = g.input.player(pi), d = I.dir; game.setInput(pi, { steer: d.x, gas: d.y < 0, brake: d.y > 0, drift: I.pressed('drift') }); } };
  const [a, b] = S.cars, a0 = a.a;
  env.key('keydown', 'ArrowUp'); env.key('keydown', 'KeyF');
  for (let i = 0; i < 40; i++){ feed(); game._tick(h); }
  env.key('keydown', 'ArrowLeft'); for (let i = 0; i < 12; i++){ feed(); game._tick(h); }
  eq([a.inp.gas, a.inp.steer, b.inp.gas, b.inp.drift], [1, -1, 0, 1], 'клавиши И1 → машинка И1, F → занос И2');
  ok(spd(a) > 60 && spd(b) < 1, 'едет только И1');
  env.key('keyup', 'ArrowUp'); env.key('keyup', 'ArrowLeft'); env.key('keyup', 'KeyF');
  env.key('keydown', 'KeyW'); for (let i = 0; i < 40; i++){ feed(); game._tick(h); }
  env.key('keydown', 'KeyD'); for (let i = 0; i < 10; i++){ feed(); game._tick(h); }
  eq([a.inp.gas, b.inp.gas, b.inp.steer], [0, 1, 1]);
  ok(spd(b) > 60, 'И2 поехал');
  env.key('keyup', 'KeyW'); env.key('keyup', 'KeyD');
  ok(L.wrapA(a.a - a0) < -0.1, 'И1 повернул влево');
  // один игрок: WASD тоже ведёт И1
  g.goto('title'); env.key('keydown', 'Digit1'); env.key('keyup', 'Digit1'); eq(g.input.playerCount, 1);
  g.goto('play'); env.tick(200);
  env.key('keydown', 'KeyW'); eq(g.input.player(0).dir, { x: 0, y: -1 }); eq(g.input.player(1).dir, { x: 0, y: 0 }); env.key('keyup', 'KeyW');
  eq(env.store['arcade.players.yuz'], '1', 'выбор хранится');
});

// ---------- музыка, строки, имена ----------
test('музыка: трек разбирается секвенсором движка, голоса кратны тактам', () => {
  const env = makeEnv();
  vm.runInContext(read('js/music.js'), env.win, { filename: 'music.js' });
  const tr = env.A.tracks.yuz; ok(tr, 'трек зарегистрирован по gameId');
  const c = env.A.parseTrack(tr);
  eq(c.melody.length, 64); eq(c.bass.length, 32); eq(c.drums.length, 16);
});

test('строки: RU/EN — одинаковый набор ключей, названы трассы, комнаты, боты, бонусы', () => {
  eq(Object.keys(Y.STR.ru).sort(), Object.keys(Y.STR.en).sort());
  L.TRACKS.forEach(t => ok(Y.STR.ru['room_' + t.room] && Y.STR.en['room_' + t.room], 'комната ' + t.room));
  L.BOTS.forEach(b => ok(Y.STR.ru['bot_' + b.id] && Y.STR.en['bot_' + b.id], 'бот ' + b.id));
  ['boost', 'shield'].forEach(k => ok(Y.STR.ru['pk_' + k] && Y.STR.en['pk_' + k]));
  eq([Y.ordinal('ru', 1), Y.ordinal('en', 1), Y.ordinal('en', 2), Y.ordinal('en', 3), Y.ordinal('en', 4), Y.ordinal('en', 11)], ['1-е', '1st', '2nd', '3rd', '4th', '11th']);
});

test('правило имён: в папке игры нет чужих названий игр/компаний/трасс (регистронезависимо, с транслитом)', () => {
  // стоп-лист чужих названий хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('bWljcm8gP21hY2hpbmVzfNC80LjQutGA0L4gP9C80LDRiNC40L18Y29kZW1hc3RlcnN80LrQvtC00LzQsNGB0YLQtdGAfGhvdCA/d2hlZWxzfNGF0L7RgiA/0LLQuNC70YF8bWF0Y2hib3h80LzQsNGC0YfQsdC+0LrRgXxtYXJpbyA/a2FydHzQvNCw0YDQuNC+fHJlLT92b2x0fNGA0LXQstC+0LvRjNGCfHJjID9wcm98c3VwZXIgP3NwcmludHzRgdGD0L/QtdGAID/RgdC/0YDQuNC90YJ8bmFzY2FyfNC90LDRgdC60LDRgHxmb3JtdWxhID8xfNGE0L7RgNC80YPQu9CwID8xfGZlcnJhcml80YTQtdGA0YDQsNGA0Lh8cG9yc2NoZXzQv9C+0YDRiNC1fGxhbWJvcmdoaW5pfNC70LDQvNCx0L7RgNCz0LjQvdC4fG1vbmFjb3zQvNC+0L3QsNC60L58cGFjLT9tYW580L/QsNC60LzQsNC9fHRldHJpc3zRgtC10YLRgNC40YF8XGJjb250cmFcYnzQutC+0L3RgtGA0LAoPyFb0LAt0Y/RkV0pfGtvbmFtaXzQutC+0L3QsNC80Lh8bmFtY2980L3QsNC80LrQvnx0YWl0b3zRgtCw0LnRgtC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVr', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md)$/.test(f));
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
});

// ---------- баланс («человеческий» бот) ----------
test('бот-игрок: трасса 1 — 1-е или 2-е место ≥ 90 % (100 заездов)', () => {
  const N = 100; let top = 0;
  for (let s = 1; s <= N; s++){ const r = playYuz(Y, 1000 + s, { tracks: 1 }); if (r.places[0] <= 2) top++; }
  console.log(`     трасса 1: 1–2 место ${(100 * top / N).toFixed(0)} %`);
  ok(top / N >= 0.9, 'трасса 1: ' + top / N);
});

test('бот-игрок: чемпионат 1-м местом ~20–40 % (40 чемпионатов), без застреваний', () => {
  const N = 40; let won = 0, stuck = 0; const pl = [0, 0, 0, 0], first = Array(8).fill(0);
  for (let s = 1; s <= N; s++){ const r = playYuz(Y, s); if (r.won) won++; if (r.stuck) stuck++; pl[r.place - 1]++; r.places.forEach((p, i) => { if (p === 1) first[i]++; }); }
  console.log(`     чемпионат: 1-е ${(100 * won / N).toFixed(0)} %, места ${pl.join('/')}, застреваний ${stuck}; побед по трассам: ${first.join(' ')}`);
  ok(first[0] + first[1] > (first[6] + first[7]) * 1.5, 'сложность растёт: первые трассы выигрываются чаще последних');
  eq(stuck, 0);
  ok(won / N >= 0.18 && won / N <= 0.42, 'чемпионат: ' + won / N);
});

test('бот-игроки вдвоём: оба доезжают, игра не ломается в режиме 2 игроков', () => {
  let fin = 0;
  for (let s = 1; s <= 4; s++){ const r = playYuz(Y, 300 + s, { players: 2, tracks: 2 }); ok(r.places.length === 2, 'две трассы'); if (r.places.every(p => p <= 3)) fin++; }
  ok(fin >= 3, 'кооп: ' + fin + '/4');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

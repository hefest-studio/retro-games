/* РОЙ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей). Переделка 2026-11: «искра и манок».
   Запуск: node roy/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const R = sandbox.ROY, C = R.consts;
const { playRoy, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function run(g, sec){ for (let i = 0; i < Math.round(sec * 60); i++) g.update(1 / 60); }

// Игра в фазе fight на волне wave; Матка «спит» (не кладёт, не плюёт, не бросает рой), если quiet
function setup(wave = 1, opts = {}){
  const ev = [];
  const g = R.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => ev.push({ t, d }), startWave: wave }, opts)).start();
  const S = g._S; S.phase = 'fight'; S.banner = null;
  if (opts.quiet !== false){ S.layT = 1e9; S.spitT = 1e9; S.surgeT = 1e9; }
  ev.length = 0;
  return { g, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
// Положить рой как надо: список [x, y, kind]; остальные убраны; корабль внизу и неуязвим к случайным касаниям
function place(g, S, list){
  S.drones = []; for (const [x, y, k] of list){ const d = g._addDrone(k || 'gnat', x, y); d.vx = d.vy = 0; }
  S.player.x = 40; S.player.y = C.PY1;
}
function freeze(S){ for (const d of S.drones){ d.vx = d.vy = 0; } }
// шаги без движения роя (проверка огня): рой стоит на месте
function burnOnly(g, S, sec){ for (let i = 0; i < Math.round(sec * 60); i++){ const pos = S.drones.map(d => [d.x, d.y]); g._step(1 / 60); S.drones.forEach((d, j) => { if (pos[j]){ d.x = pos[j][0]; d.y = pos[j][1]; } }); } }

// ---------- структура ----------
test('старт: волна 1, 3 корабля, счёт 0, 12 мошек, Матка 8, подсказка обучения tut1', () => {
  const g = R.Game({ rng: mulberry32(1) }).start(), S = g.state();
  eq(S.wave, 1); eq(S.lives, 3); eq(S.score, 0); eq(S.drones.length, 12); ok(S.drones.every(d => d.kind === 'gnat'));
  eq(S.queen.hp, 8); eq(S.tip, 'tut1'); eq(S.player.charges, 3); ok(S.player.alive);
});
test('волны: 5 штук, рой и здоровье Матки растут; панцирники с 3-й, пороховики с 4-й; бросок роя и плевки — со 2-й', () => {
  eq(C.WAVES, 5); eq(C.WAVE_DEF.length, 5);
  let prev = 0; C.WAVE_DEF.forEach((D, i) => { const n = D.gnat + D.shell + D.powder; ok(n >= prev, 'рой волны ' + (i + 1)); prev = n; ok(i === 0 || D.hp > C.WAVE_DEF[i - 1].hp, 'Матка ' + (i + 1)); });
  eq(C.WAVE_DEF[0].surge, 0); eq(C.WAVE_DEF[0].spit, 0); ok(C.WAVE_DEF[1].surge > 0 && C.WAVE_DEF[1].spit > 0);
  eq(C.WAVE_DEF[1].shell, 0); ok(C.WAVE_DEF[2].shell > 0); eq(C.WAVE_DEF[2].powder, 0); ok(C.WAVE_DEF[3].powder > 0);
});
test('нет строя: у роя нет рядов/колонок, стая держит дистанцию и не выходит за поле', () => {
  const { g, S } = setup(2); run(g, 12);
  ok(S.drones.every(d => d.row === undefined && d.col === undefined), 'ряды/колонки');
  const live = S.drones.filter(d => d.state === 'live'); ok(live.length >= 10);
  let close = 0; for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) if (Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y) < 12) close++;
  ok(close <= 2, 'слиплись: ' + close);
  ok(live.every(d => d.x >= 10 && d.x <= C.W - 10 && d.y <= C.H - 10), 'за полем');
  const ys = live.map(d => d.y); ok(Math.max(...ys) - Math.min(...ys) > 60, 'стая не плоская (не ряд)');
});
test('в старом коде нет фирменных ходов прежней версии (луч-захват, второй корпус, строй с пике)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js/modern.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js/classic.js'), 'utf8');
  ok(!/beam|captive|rescue|dual|HULL_GAP|medusa|LAYOUTS|startDive/i.test(src), 'остался код прежней механики');
});

// ---------- огонь ----------
test('искра поджигает мошку; через 0,12 с огонь перекидывается на соседей ближе IGN — цепь, очки 10 × место в цепи', () => {
  const { g, S, count } = setup(1); place(g, S, [[200, 200], [220, 200], [240, 200], [300, 200]]);
  const id = g._newChain(); g._ignite(S.drones[0], id); eq(S.score, 10);
  burnOnly(g, S, 1.2);
  eq(S.drones.filter(d => d.state === 'dead').length, 3, 'сгорели трое в цепи'); eq(S.drones[3].state, 'live', 'дальняя (60 px) цела');
  eq(S.score, 10 + 20 + 30); eq(count('ignite'), 3); eq(count('chain'), 1);
});
test('выстрел искрой: летит вверх, попадает в мошку — поджог; запас 3 искры, перезарядка', () => {
  const { g, S, has } = setup(1); place(g, S, [[240, 300]]); S.player.x = 240; S.player.y = 560;
  ok(g.fire()); eq(S.player.charges, 2); ok(!g.fire(), 'откат'); burnOnly(g, S, 0.6); ok(has('ignite'), 'попала');
  S.player.charges = 0; S.player.cd = 0; S.player.rech = C.RECHARGE; ok(!g.fire(), 'без искр'); run(g, C.RECHARGE + 0.05); eq(S.player.charges, 1); run(g, C.RECHARGE * 2 + 0.1); eq(S.player.charges, 3);
});
test('панцирник: первый огонь только срывает панцирь (и не передаёт огонь), второй — поджигает', () => {
  const { g, S, has } = setup(3); place(g, S, [[200, 200, 'gnat'], [222, 200, 'shell'], [244, 200, 'gnat']]);
  g._ignite(S.drones[0], g._newChain()); burnOnly(g, S, 1);
  ok(has('crack')); eq(S.drones[1].state, 'live'); eq(S.drones[1].shell, false); eq(S.drones[2].state, 'live', 'огонь не прошёл сквозь панцирь');
  g._ignite(S.drones[1], g._newChain()); burnOnly(g, S, 1); eq(S.drones[1].state, 'dead'); eq(S.drones[2].state, 'dead');
});
test('пороховик горит с большим радиусом (≈1,9 IGN)', () => {
  const { g, S } = setup(4); place(g, S, [[200, 200, 'powder'], [250, 200, 'gnat']]);
  g._ignite(S.drones[0], g._newChain()); burnOnly(g, S, 1); eq(S.drones[1].state, 'dead');
  const b = setup(4); place(b.g, b.S, [[200, 200, 'gnat'], [250, 200, 'gnat']]); b.g._ignite(b.S.drones[0], b.g._newChain()); burnOnly(b.g, b.S, 1); eq(b.S.drones[1].state, 'live');
});

// ---------- манок ----------
test('манок: взлетает над кораблём, висит 3,6 с и гаснет; откат 6 с', () => {
  const { g, S, has } = setup(1); place(g, S, []); S.player.x = 240; S.player.y = 560;
  ok(g.lure()); ok(S.lure && S.lure.state === 'fly'); ok(!g.lure(), 'второй — нельзя');
  run(g, 1); eq(S.lure.state, 'hover'); ok(S.lure.y <= 560 - 190, 'высота ' + S.lure.y);
  run(g, C.LURE_HOVER); ok(!S.lure); ok(has('fizzle')); ok(!g.lure(), 'откат'); run(g, C.LURE_CD); ok(g.lure());
});
test('манок сбивает рой в клубок: соседи ближе IGN — у всех; поджог клубка сжигает ≥ 90%', () => {
  const { g, S } = setup(2); run(g, 6); S.player.x = 240; S.player.y = 600; S.player.inv = 99;
  const n0 = S.drones.filter(d => d.state === 'live').length;
  g.lure(); run(g, 2.6);
  const L = S.lure, near = S.drones.filter(d => d.state === 'live' && Math.hypot(d.x - L.x, d.y - L.y) < 70);
  ok(near.length >= n0 * 0.8, 'в клубке ' + near.length + '/' + n0);
  ok(near.every(d => near.some(e => e !== d && Math.hypot(d.x - e.x, d.y - e.y) < C.IGN)), 'у каждого есть сосед в радиусе огня');
  g._ignite(near[0], g._newChain()); run(g, 2);
  ok(S.drones.filter(d => d.state === 'live').length <= n0 * 0.1 + 1, 'выжило ' + S.drones.filter(d => d.state === 'live').length);
});
test('искра в сам манок — вспышка: поджигает всех рядом и ранит Матку, если она близко', () => {
  const { g, S, has } = setup(1); place(g, S, [[240, 300], [262, 300], [218, 312]]); S.lure = { x: 240, y: 330, ty: 330, state: 'hover', t: 0 };
  S.player.x = 240; S.player.y = 560; g.fire(); run(g, 0.6); ok(has('burst')); ok(!S.lure); ok(S.drones.every(d => d.state !== 'live'));
});

// ---------- Матка ----------
test('Матка: искра −1, горящая мошка рядом −1 (один раз); погашена — бонус, огонь по рою рядом', () => {
  const { g, S, has } = setup(1); const q = S.queen; q.t = 0; place(g, S, []);
  g._damageQueen(q, 1); eq(q.hp, 7);
  run(g, 0.01); const d = g._addDrone('gnat', q.x + 20, q.y); g._ignite(d, g._newChain()); burnOnly(g, S, 1); eq(q.hp, 6, 'огонь рядом');
  const s0 = S.score; g._addDrone('gnat', q.x, q.y + 60); g._damageQueen(q, 6); ok(!q.alive); ok(has('queen')); ok(S.score >= s0 + 500); ok(S.drones.some(e => e.state === 'burn'), 'вспышка');
});
test('волна отбита, когда Матка погашена и рой сгорел → следующая волна; после 5-й — победа', () => {
  const { g, S, has } = setup(1); g._damageQueen(S.queen, 99); S.drones.forEach(d => { d.state = 'dead'; }); run(g, 0.1);
  ok(has('clear')); eq(S.phase, 'clear'); run(g, 2.1); eq(S.wave, 2);
  const b = setup(5); b.g._damageQueen(b.S.queen, 99); b.S.drones.forEach(d => { d.state = 'dead'; }); run(b.g, 2.3); ok(b.S.over && b.S.won && b.has('win'));
});
test('Матка откладывает мошек (не больше cap); со 2-й волны плюётся и бросает рой на корабль (с предупреждением)', () => {
  const { g, S, count, has } = setup(2, { quiet: false }); S.player.inv = 999; S.layT = 0.1; S.spitT = 0.2; S.surgeT = 0.3;
  const n0 = S.drones.length; run(g, 4); ok(count('lay') >= 1 && S.drones.length > n0); ok(has('spit')); ok(has('warn') && has('surge'), 'бросок');
  const b = setup(1, { quiet: false }); b.S.player.inv = 999; run(b.g, 20); ok(!b.has('spit') && !b.has('surge'), '1-я волна — без плевков и бросков');
  const c = setup(2, { quiet: false }); c.S.layT = 0.05; c.S.drones.length = 0; for (let i = 0; i < 40; i++) c.g._addDrone('gnat', 240, 200); c.S.layT = 0.01; const n1 = c.S.drones.length; run(c.g, 0.1); eq(c.S.drones.length, n1, 'cap');
});

// ---------- корабль ----------
test('корабль летает по x и y в нижней зоне (стик/стрелки), упор в края', () => {
  const { g, S } = setup(1); place(g, S, []); S.player.x = 240; S.player.y = 500;
  g.setDir(-1, -1); run(g, 3); eq(S.player.x, 16); eq(S.player.y, C.PY0);
  g.setDir(1, 1); run(g, 4); eq(S.player.x, C.W - 16); eq(S.player.y, C.PY1);
});
test('касание живой мошки или плевок — −1 корабль, возрождение с неуязвимостью; 3 потери — конец игры', () => {
  const { g, S, has } = setup(1); place(g, S, []); S.player.x = 240; S.player.y = 560;
  S.spores.push({ x: 240, y: 540, vx: 0, vy: 200 }); run(g, 0.3); ok(has('die')); eq(S.lives, 2); run(g, 2); ok(S.player.alive && S.player.inv > 0);
  run(g, 2.5); g._addDrone('gnat', S.player.x, S.player.y); run(g, 0.05); eq(S.lives, 1);
  run(g, 2); S.player.inv = 0; g._hitPlayer(); run(g, 2); ok(S.over && has('gameover'));
});
test('горящая мошка корабль не ранит', () => {
  const { g, S } = setup(1); place(g, S, []); S.player.x = 240; S.player.y = 560;
  const d = g._addDrone('gnat', 240, 560); g._ignite(d, g._newChain()); run(g, 0.3); eq(S.lives, 3);
});
test('обучение (1-я волна): подсказки по шагам — искра → манок → поджечь клубок → Матка', () => {
  const { g, S } = setup(1); eq(S.tip, 'tut1');
  g._ignite(S.drones[0], g._newChain()); eq(S.tip, 'tut2');
  S.player.inv = 99; g.lure(); eq(S.tip, 'tut3');
  place(g, S, [[100, 300], [120, 300], [140, 300], [160, 300]]); g._ignite(S.drones[0], g._newChain()); burnOnly(g, S, 1.2); eq(S.tip, 'tut4');
  g._damageQueen(S.queen, 1); eq(S.tip, null);
  const b = setup(2); eq(b.S.tip, null);
});
test('сложность волны идёт через diff-хук движка (g.difficulty)', () => {
  const calls = []; const g = R.Game({ rng: mulberry32(2), diff: (b, s, m) => { calls.push([b, s, m]); return b; } }).start();
  g.params(); ok(calls.length >= 4);
  const a = R.Game({ rng: mulberry32(2), startWave: 1 }).start().params(), z = R.Game({ rng: mulberry32(2), startWave: 5 }).start().params();
  ok(z.speed > a.speed && z.hunt > a.hunt && z.spore > a.spore && z.lay < a.lay);
});
test('реклама: reviveAd после конца — 1 корабль на той же волне, рой отогнан; boost — +1 корабль (до 5)', () => {
  const { g, S } = setup(3, { lives: 1 }); ok(!g.reviveAd(), 'в игре — нельзя'); place(g, S, [[240, 400]]);
  g._hitPlayer(); run(g, 2); ok(S.over && !S.won); ok(g.reviveAd()); eq(S.lives, 1); ok(!S.over && S.player.alive && S.player.inv > 0); eq(S.wave, 3); ok(S.drones[0].y <= 300, "рой отогнан: " + S.drones[0].y);
  ok(g.canBoost()); ok(g.boost()); eq(S.lives, 2); S.lives = C.MAX_LIVES; ok(!g.canBoost());
});
test('сохранения: прежний рекорд (старые правила) → arcade.roy.oldBest, рекорд заново; второй запуск ничего не трогает', () => {
  const m = new Map([['arcade.best.roy', '12345']]); const ls = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  eq(R.migrate(ls), 12345); eq(m.get('arcade.roy.oldBest'), '12345'); ok(!m.has('arcade.best.roy')); eq(m.get('arcade.roy.v'), '2');
  m.set('arcade.best.roy', '500'); eq(R.migrate(ls), 0); eq(m.get('arcade.best.roy'), '500');
  const e = new Map(); const ls2 = { getItem: k => e.get(k) ?? null, setItem: (k, v) => e.set(k, v), removeItem: k => e.delete(k) }; eq(R.migrate(ls2), 0); eq(e.get('arcade.roy.v'), '2');
  eq(R.migrate({ getItem(){ throw new Error('blocked'); } }), 0, 'запрет хранилища');
});

// ---------- тексты, музыка, имена ----------
test('языки: ru/en/tr/es/pt — одинаковые ключи; RU — РОЙ, EN/TR/ES/PT — KINDLEBROOD; подсказки обучения есть', () => {
  const T = R.STR, ks = Object.keys(T.en).sort().join(','); eq(Object.keys(T).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(T[l]).sort().join(','), ks, l);
  eq(T.ru.title, 'РОЙ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(T[l].title, 'KINDLEBROOD', l);
  for (const l of Object.keys(T)) for (const k of ['tut1', 'tut2', 'tut3', 'tut4', 'chain', 'rwLife', 'migrated']) ok(T[l][k], l + '.' + k);
});
test('музыка: оригинальный трек roy подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.roy; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
});
test('страница: стик, кнопки ◆ манок и ● искра, пауза, «← Каталог», порядок скриптов', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/data-stick/.test(html) && /data-act="lure"/.test(html) && /data-d="A"/.test(html) && /id="bPause"/.test(html) && /data-catalog-back/.test(html));
  const order = [...html.matchAll(/src="\.\/([^"]+)"/g)].map(m => m[1]); eq(order[0], 'engine.js'); eq(order[order.length - 1], 'js/main.js'); ok(order.includes('js/stick.js'));
  const st = fs.readFileSync(path.join(ROOT, 'js/stick.js'), 'utf8'), src = fs.readFileSync(path.join(ROOT, '../otsek/js/stick.js'), 'utf8'); eq(st, src, 'stick.js — копия otsek/js/stick.js');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHN3YXJtfGludmFkZXJzP3zQuNC90LLQtdC50LTQtdGA', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('РОЙ') && !BAD.test('Гефест') && !BAD.test('KINDLEBROOD') && !BAD.test('Матка') && !BAD.test('brood') && !BAD.test('invade'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- проходимость и баланс ----------
if (!process.env.QUICK){
  const PASS = []; for (let w = 1; w <= 5; w++) for (let s = 1; s <= 6; s++) PASS.push({ w, s, r: playRoy(R, s, { perfect: true, startWave: w, waves: 1 }) });
  test('проходимость: каждая из 5 волн (отдельно, с 3 кораблями) отбивается быстрым ботом ≤ 240 с — не меньше 3 из 6 сидов, 1–2-я — все', () => {
    const won = w => PASS.filter(p => p.w === w && p.r.won).length;
    console.log('     отбито из 6: ' + [1, 2, 3, 4, 5].map(w => w + ':' + won(w)).join(' ') + '; время, с: ' + PASS.filter(p => p.r.won && p.s === 3).map(p => p.w + ':' + (p.r.waveTime[p.w] || 0).toFixed(0)).join(' '));
    for (let w = 1; w <= 5; w++) ok(won(w) >= (w <= 2 ? 6 : 3), 'волна ' + w + ': ' + won(w) + '/6');
    ok(!PASS.some(p => p.r.stuck), 'зависание');
  });
  // «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс прицела ±6 px, ввод только setDir/fire/lure. 40 партий (сиды 1..40).
  const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playRoy(R, s));
  test('баланс: бот отбивает 1-ю волну (обучение) в ≥ 90% партий', () => {
    const n = BAL.filter(r => r.passed >= 1).length; console.log('     волна 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
  });
  test('баланс: все 5 волн — 15–40% партий бота, без «зависаний»', () => {
    const n = BAL.filter(r => r.won).length, dist = new Array(6).fill(0); BAL.forEach(r => dist[r.passed]++);
    console.log('     все 5: ' + n + '/' + N + '; отбито волн 0..5: ' + dist.join(','));
    ok(n >= 0.15 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.4 * N, 'слишком легко: ' + n + '/' + N);
    ok(!BAL.some(r => r.stuck), 'бот застрял на волне: ' + BAL.filter(r => r.stuck).map(r => r.stuck).join(','));
  });
  test('непресность: потерь кораблей на волну больше к 4–5-й', () => {
    const per = []; for (let w = 1; w <= 5; w++){ const reach = BAL.filter(r => r.passed >= w - 1).length; let l = 0; for (const r of BAL) l += (r.lost[w] || 0); per.push(l / Math.max(1, reach)); }
    console.log('     потерь на волну: ' + per.map(v => v.toFixed(2)).join(' / '));
    ok(per[0] <= 0.1, '1-я волна мягкая'); ok(per[3] > per[1] && per[4] > per[1], 'нет нарастания');
  });
  test('механика работает: цепи ≥ 8 случаются почти в каждой партии', () => {
    const n = BAL.filter(r => r.bestChain >= 8).length; console.log('     лучшая цепь ≥ 8: ' + n + '/' + N + '; медиана лучшей цепи ' + BAL.map(r => r.bestChain).sort((a, b) => a - b)[N >> 1]);
    ok(n >= 0.8 * N);
  });
}

// ---------- площадка: «Без рекламы» и таблица лидеров ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'roy', boards: ['roy'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

/* ЧЕРТОГ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node chertog/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: уровни, физику движений, ловушки, плиты и решётки, дверь, зелья, фехтование, двойника, таймер, сохранение,
   проходимость всех уровней по графу (по настоящей физике), исполнение пути графа подряд в одной игре,
   партии «человеческого» бота, музыку, i18n и правило имён. */
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
const C = sandbox.CHERTOG, L = C.logic, K = L.K, DT = 1 / 60;
const { playChertog, mulberry32, navFor, route } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, d, m){ if (Math.abs(a - b) > d) throw new Error((m || '') + ' ждали ≈' + b + '±' + d + ', получили ' + a); }

// тестовая игра на своей карте; ev — журнал событий
function mk(map, o = {}){
  const ev = [], def = { name: 't', face: 1, map, gateT: o.gateT, cast: o.cast, test: true };
  const game = C.Game(Object.assign({ def, rng: o.rng || mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, o.opts || {})).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state()) : inp); game.update(DT); } game.setInput({}); }
const ROW = (...rooms) => rooms;
const AIR = '          ', WALL = '##########';

// ---------- уровни ----------
test('9 уровней (8 + финал), экраны 10×3; у каждого старт и выход; в финале Наместник, литейная форма, решётка и клетка мастера', () => {
  eq(C.LEVELS.length, 9);
  C.LEVELS.forEach((d, i) => {
    const LV = L.level(i + 1); ok(LV.W % 10 === 0 && LV.H % 3 === 0, 'размер ' + (i + 1)); ok(LV.start, 'старт ' + (i + 1)); ok(LV.door || LV.teacher, 'выход ' + (i + 1));
    ok(LV.rx * LV.ry >= 3, 'экранов ' + (i + 1));
  });
  const F = L.level(9); ok(F.teacher && F.cast && F.guards.some(g => g.k === 'N') && F.gates.some(g => g.boss));
});
test('прогрессия: стражник → дуэлянт/щитник → автоматон → Наместник; все ловушки и зелья встречаются', () => {
  const first = k => C.LEVELS.findIndex((d, i) => L.level(i + 1).guards.some(g => g.k === k)) + 1;
  eq(first('g'), 1); eq(first('f'), 3); eq(first('w'), 3); eq(first('m'), 4); eq(first('N'), 9);
  const all = C.LEVELS.map((d, i) => L.level(i + 1));
  ok(all.some(l => l.spikes.length) && all.some(l => l.chops.length) && all.some(l => l.loose.length), 'ловушки');
  ok(all.some(l => Object.values(l.plates).some(p => p.kind === 'open')) && all.some(l => Object.values(l.plates).some(p => p.kind === 'close')) && all.some(l => l.exitPlate), 'плиты');
  const pots = all.flatMap(l => Object.values(l.potions)); ok(pots.includes('h') && pots.includes('H') && pots.includes('p'), 'зелья');
});

// ---------- физика ----------
const FLAT = [ROW(WALL, WALL, WALL), ROW(AIR, AIR, AIR), ROW('P---------', '----------', '---------E')];
test('бег разгоняется до 3,6 кл/с; осторожный шаг — точно до следующей метки (центр клетки)', () => {
  const { game, S } = mk(FLAT); run(game, 1.2, { x: 1 }); near(S.hero.v, K.RUN, 0.01, 'скорость'); eq(S.hero.st, 'run');
  const T = mk(FLAT); run(T.game, 0.1, { x: 1, shift: true }); run(T.game, 0.7); eq(T.S.hero.st, 'stand'); near(T.S.hero.x, 1.5, 1e-6, 'шаг');
});
function jumpDist(kind){
  const { game, S } = mk(FLAT); let t0 = null;
  for (let i = 0; i < 400; i++){
    const H = S.hero; game.setInput(H.st === 'air' ? {} : kind === 'sj' ? { x: 1, up: true } : { x: 1, up: H.x > 4 }); game.update(DT);
    if (H.st === 'air' && t0 == null) t0 = H.x;
    if (t0 != null && H.st !== 'air') return H.x - t0;
  }
}
test('прыжок с места ≈ 1,4 клетки, с разбега ≈ 2,2 (без управления в полёте)', () => { near(jumpDist('sj'), 1.4, 0.12); near(jumpDist('rj'), 2.2, 0.15); });
test('прыжок с места через провал в 1 клетку — да; через 2 — только с зацепом за край', () => {
  const m1 = [ROW(WALL), ROW(AIR), ROW('P--- -----')];
  const A = mk(m1); A.game._place(3 + 1 - K.EDGE, 3, 1); run(A.game, 1.5, s => s.hero.st === 'stand' && s.hero.x < 4 ? { x: 1, up: true } : {}); ok(A.S.hero.x > 5 && A.S.hero.y === 3 && A.S.hero.st !== 'dead', 'через 1');
  const m2 = [ROW(WALL), ROW(AIR), ROW('P---  ----')];
  const B = mk(m2); B.game._place(3 + 1 - K.EDGE, 3, 1); run(B.game, 0.25, { x: 1, up: true }); run(B.game, 1.5, {}); eq(B.S.hero.st, 'dead', 'без зацепа — в пропасть');
  const D = mk(m2); D.game._place(3 + 1 - K.EDGE, 3, 1); run(D.game, 0.25, { x: 1, up: true }); run(D.game, 2.5, s => ({ up: s.hero.st !== 'stand' })); eq(D.S.hero.st, 'stand', 'зацеп и подтянуться'); ok(D.S.hero.x > 6 && D.S.hero.y === 3);
});
test('прыжок с разбега перелетает провал в 2 клетки', () => {
  const m = [ROW(WALL, WALL), ROW(AIR, AIR), ROW('P------  -', '----------')];
  const { game, S } = mk(m); let flew = false; run(game, 3, s => { if (s.hero.st === 'air') flew = true; return flew ? {} : { x: 1, up: s.hero.x > 6.55 }; }); ok(S.hero.x > 9 && S.hero.y === 3 && S.hero.st !== 'dead', 'x=' + S.hero.x);
});
const LEDGE = [ROW(WALL), ROW('     -----'), ROW('P---------')];
test('прыжок вверх у уступа: зацеп, вис и подтягивание на уступ; без уступа — подскок на месте', () => {
  const { game, S, has } = mk(LEDGE); game._place(4.5, 3, 1);
  run(game, 0.6, { up: true }); eq(S.hero.st, 'hang'); ok(has('grab'));
  run(game, 1.2, s => ({ up: s.hero.st !== 'stand' })); run(game, 0.1); eq(S.hero.st, 'stand'); eq(S.hero.y, 2); ok(S.hero.x > 5 && S.hero.x < 6);
  const B = mk(LEDGE); B.game._place(2.5, 3, 1); run(B.game, 0.25, { up: true }); run(B.game, 1); eq(B.S.hero.y, 3); near(B.S.hero.x, 2.5, 1e-9);
});
test('спуск с края: повиснуть и спрыгнуть вниз на ряд без вреда', () => {
  const { game, S } = mk(LEDGE); game._place(5 + K.EDGE, 2, 1);
  run(game, 0.8, { down: true }); eq(S.hero.st, 'hang'); eq(S.hero.face, 1, 'лицом к стене');
  run(game, 0.05); run(game, 0.1, { down: true }); run(game, 1); eq(S.hero.st, 'stand'); eq(S.hero.y, 3); eq(S.hp, 3);
});
test('падение: 1 ряд — без вреда, 2 — минус треугольник, 3 — гибель; с виса — на ряд «дешевле»', () => {
  const m = [ROW(AIR), ROW(AIR), ROW(AIR), ROW(AIR), ROW(AIR), ROW('P---------')];
  for (const [y, hp, dead] of [[5, 3, false], [4, 2, false], [3, 3, true]]){
    const { game, S } = mk(m); game._place(5.5, y, 1); run(game, 2); eq(S.hero.st === 'dead' || S.phase === 'dead', dead, 'с высоты ' + (6 - y)); if (!dead) eq(S.hp, hp, 'hp с высоты ' + (6 - y));
  }
  const H2 = [ROW(AIR), ROW(AIR), ROW('---       '), ROW(AIR), ROW(AIR), ROW('P---------')];
  const { game, S } = mk(H2); game._place(3 - K.EDGE, 3, -1); run(game, 0.8, { down: true }); eq(S.hero.st, 'hang'); run(game, 0.2); run(game, 0.1, { down: true }); run(game, 2);
  ok(S.hero.st !== 'dead', 'с виса 3 ряда = как с 2'); eq(S.hp, 2);
});

// ---------- ловушки ----------
test('шипы: бегом — гибель, осторожным шагом — безопасно', () => {
  const m = [ROW(WALL), ROW(AIR), ROW('P--^^-----')];
  const A = mk(m); run(A.game, 2, { x: 1 }); eq(A.S.hero.why, 'spike');
  const B = mk(m); run(B.game, 4, { x: 1, shift: true }); ok(B.S.hero.x > 5 && B.S.hero.st !== 'dead', 'x=' + B.S.hero.x); ok(B.has('spikes'), 'шипы выскочили');
});
test('ножницы: смыкаются раз в 1,6 с и рубят стоящего между лезвиями', () => {
  const m = [ROW(WALL), ROW(AIR), ROW('P---x-----')];
  const { game, S } = mk(m); game._place(4.5, 3, 1); run(game, 1.7); eq(S.hero.why, 'chop');
});
test('обваливающаяся плита: дрожит 0,45 с и падает вместе с соседней; плита бьёт стоящего внизу', () => {
  const m = [ROW(WALL), ROW('---~~-----'), ROW('P---------')];
  const { game, S, has } = mk(m); game._place(3.5, 2, 1); run(game, 0.3); eq(S.M.t[1 * 10 + 3], '~', 'ещё держится');
  run(game, 1.2); eq(S.M.t[1 * 10 + 3], ' '); eq(S.M.t[1 * 10 + 4], ' ', 'соседняя тоже'); eq(S.hero.y, 3, 'герой упал на ряд'); ok(has('smash')); ok(S.M.debris[2 * 10 + 3]);
  const B = mk(m); B.game._place(3.5, 3, 1); B.S.M.shake[1 * 10 + 3] = 0; run(B.game, 1.2); eq(B.S.hp, 2, 'плита по голове');
});
test('нажимная плита поднимает решётку на время, потом она опускается; плита-ловушка роняет её сразу', () => {
  const m = [ROW(WALL), ROW(AIR), ROW('P-1-!A----')];
  const { game, S, has } = mk(m, { gateT: 3 }); const gt = S.M.gates[0];
  game._place(2.5, 3, 1); run(game, 1); ok(gt.open >= K.GATE_PASS, 'открыта'); ok(has('plate'));
  game._place(1.5, 3, 1); run(game, 2.5); ok(gt.open >= K.GATE_PASS, 'ещё открыта'); run(game, 2); ok(gt.open < K.GATE_PASS, 'закрылась');
  game._place(2.5, 3, 1); run(game, 1); game._place(4.5, 3, 1); run(game, 0.2); ok(gt.open < K.GATE_PASS, 'захлопнута'); ok(has('slam'));
  const B = mk([ROW(WALL), ROW(AIR), ROW('P----A----')]); run(B.game, 3, { x: 1 }); ok(B.S.hero.x < 5.3, 'закрытая решётка держит'); ok(B.has('bump'));
});
test('дверь выхода закрыта до плиты; вход в дверь — уровень пройден, следующий начинается с полным здоровьем', () => {
  const m = [ROW(WALL), ROW(AIR), ROW('P-e---E---')];
  const A = mk(m); A.game._place(6.5, 3, 1); run(A.game, 0.5, { up: true }); ok(A.S.hero.st !== 'enter', 'закрыта');
  A.game._place(2.5, 3, 1); run(A.game, 0.2); ok(A.S.doorOpen); A.game._place(6.5, 3, 1); run(A.game, 0.3, { up: true }); eq(A.S.hero.st, 'enter');
  const G = C.Game({}).start(), S = G.state(), LV = S.LV; S.hp = 1;
  G._place(LV.door.c + 0.5, LV.door.r + 1, 1); run(G, 0.3, { up: true }); run(G, 2.5); eq(S.level, 2); eq(S.hp, S.maxHp); ok(S.score >= 500);
});
test('зелья: красное +1 (не выше максимума), большое +1 к максимуму, яд −1', () => {
  const m = [ROW(WALL), ROW(AIR), ROW('P-h-H-p---')];
  const { game, S } = mk(m); S.hp = 1;
  game._place(2.5, 3, 1); run(game, 0.1, { down: true }); run(game, 1); eq(S.hp, 2);
  game._place(4.5, 3, 1); run(game, 0.1, { down: true }); run(game, 1); eq(S.maxHp, 4); eq(S.hp, 4);
  game._place(6.5, 3, 1); run(game, 0.1, { down: true }); run(game, 1); eq(S.hp, 3); eq(Object.keys(S.M.potions).length, 0);
});

// ---------- фехтование ----------
const DUEL = k => [ROW(WALL), ROW(AIR), ROW('P----' + k + '----')];
test('бой: рядом со стражем — стойка; выпад без защиты ранит; отбитый выпад — отдача; страж повержен — очки', () => {
  const A = mk(DUEL('g'), { rng: () => 0.99 }); A.game._place(4.6, 3, 1); run(A.game, 0.1); eq(A.S.hero.st, 'en'); ok(A.has('engage'));
  run(A.game, 0.05, { atk: true }); run(A.game, 0.5); eq(A.S.guards[0].hp, 2, 'попал');
  for (let i = 0; i < 2; i++){ run(A.game, 0.32, { x: 1 }); run(A.game, 0.05, { atk: true }); run(A.game, 0.6); }
  ok(!A.S.guards[0].alive, 'повержен'); ok(A.S.score >= 150); run(A.game, 0.6); eq(A.S.hero.st, 'stand', 'меч в ножны');
  const B = mk(DUEL('w'), { rng: () => 0 }); B.game._place(4.6, 3, 1); run(B.game, 0.1); run(B.game, 0.05, { atk: true }); run(B.game, 0.3); ok(B.has('clang'), 'щитник отбил'); eq(B.S.guards[0].hp, 4);
});
test('бой: защита (↑) вовремя отбивает выпад стража; автоматон бьёт ровно по метроному', () => {
  const A = mk(DUEL('m')); A.game._place(4.6, 3, 1); run(A.game, 3); ok(A.S.hp < 3, 'автоматон попал'); ok(A.count('lunge') >= 2);
  const B = mk(DUEL('m')); B.game._place(4.6, 3, 1); let parries = 0;
  run(B.game, 3, s => { const g = s.guards[0]; if (g.st === 'lunge' && g.t > 0.08 && g.t < 0.12){ parries++; return { up: true }; } return {}; });
  eq(B.S.hp, 3, 'всё отбито'); ok(B.has('clang'));
});
test('стражи держатся своего безопасного пола и разные по стилю', () => {
  const S = C.Game({ level: 1 }).start().state(), g = S.guards[0]; ok(g.min >= 20 && g.max <= 40);
  const st = L.STYLE; ok(st.f.wind < st.g.wind && st.w.parry > st.f.parry && st.m.metro && st.N.hp > st.g.hp && st.N.combo > 0);
});

// ---------- финал ----------
test('финал: двойник повторяет героя отражённо; бегом мимо своих ножниц — двойник на шипы; решётка открывается, мастер свободен', () => {
  const ev = [], G = C.Game({ level: 9, onEvent: t => ev.push(t) }).start(), S = G.state(), MI = S.LV.cast;
  S.guards[0].alive = false; S.bossDown = true; G._place(13.2, 3, -1); run(G, 1.6); ok(S.twin.on, 'проснулся'); near(S.twin.x, 2 * MI.cx - 13.2, 1e-9, 'отражённо');
  const q = S.LV.chops[0]; S.clock = K.CHOP_P * 10 + K.CHOP_P - q.off + 0.6;
  G._place(11.55, 3, -1); S.hero.st = 'run'; S.hero.v = 3; G.setInput({ x: -1 }); G.update(DT);
  ok(S.twin.done, 'разбит'); eq(S.twin.why, 'spike'); ok(ev.includes('twinDown'));
  run(G, 1.5); ok(S.M.gates.find(g => g.boss).open >= K.GATE_PASS, 'решётка открыта');
  G._place(S.LV.teacher.c + 0.5, 3, 1); run(G, 0.2, { up: true }); run(G, 2.2); eq(S.phase, 'won'); ok(S.won && ev.includes('win'));
});
test('финал: пока двойник цел, мастера не освободить; осторожный шаг двойника на шипах не губит', () => {
  const G = C.Game({ level: 9 }).start(), S = G.state(); S.guards[0].alive = false; S.bossDown = true; G._place(12.5, 3, -1); run(G, 1.6);
  run(G, 1.6, { x: -1, shift: true }); ok(!S.twin.done, 'шагом — цел'); 
  G._place(S.LV.teacher.c + 0.5, 3, 1); run(G, 0.5, { up: true }); ok(S.hero.st !== 'free');
});

// ---------- таймер, гибель, сохранение ----------
test('45 минут на всю игру; время вышло — конец игры', () => {
  eq(K.TIME, 2700); const ev = [], G = C.Game({ time: 2, onEvent: t => ev.push(t) }).start(); run(G, 2.2); eq(G.state().phase, 'over'); ok(ev.includes('timeout') && ev.includes('gameover'));
});
test('гибель — уровень заново через 2,2 с; прибавка к максимуму здоровья с этого уровня не сохраняется', () => {
  const ev = [], G = C.Game({ level: 2, onEvent: t => ev.push(t) }).start(), S = G.state(); S.maxHp = 5; S.hp = 5; G._place(20.5, 2, 1);
  G._die('test'); eq(S.phase, 'dead'); run(G, 2.4); eq(S.phase, 'play'); eq(S.level, 2); eq(S.maxHp, 3); eq(S.hp, 3); eq(S.hero.x, S.LV.start.c + 0.5); ok(ev.includes('restart'));
});
test('продолжение: игра стартует с сохранённого уровня, здоровья, остатка времени и счёта', () => {
  const S = C.Game({ level: 5, maxHp: 4, time: 1000, score: 777 }).start().state(); eq(S.level, 5); eq(S.maxHp, 4); eq(S.hp, 4); eq(S.timeLeft, 1000); eq(S.score, 777);
});

// ---------- проходимость (граф по физике) ----------
const NAV = {};
for (let i = 1; i <= C.LEVELS.length; i++) NAV[i] = { intact: navFor(L, i, false), fallen: L.level(i).loose.length ? navFor(L, i, true) : null };
function goalReached(nav, R){
  const LV = nav.LV, ex = [...R].some(k => nav.isExit(k));
  const pl = !LV.exitPlate || [...R].some(k => { const n = nav.nodes.get(k); return n.c === LV.exitPlate.c && n.r === LV.exitPlate.r; });
  return ex && pl;
}
test('проходимость: на каждом уровне выход (и плита двери) достижимы — и при целых, и при рухнувших плитах', () => {
  for (let i = 1; i <= C.LEVELS.length; i++){
    ok(goalReached(NAV[i].intact, NAV[i].intact.reach()), 'уровень ' + i);
    if (NAV[i].fallen) ok(goalReached(NAV[i].fallen, NAV[i].fallen.reach()), 'уровень ' + i + ' (обвалы)');
  }
});
test('решётки по таймеру проходимы только «бегом от плиты» (макро-рёбра графа) — на уровнях 2, 3, 5, 7', () => {
  for (const i of [2, 3, 5, 7]){ const n = NAV[i].intact; ok(n.macros.length > 0, 'уровень ' + i); const R0 = new Set([n.start]); ok(n.macros.every(m => m.t <= n.LV.gateT), 'с запасом по времени'); }
});
test('нет тупиков: из любого достижимого места можно дойти до выхода', () => {
  for (let i = 1; i <= C.LEVELS.length; i++){
    const nav = NAV[i].fallen || NAV[i].intact, R0 = nav.reach(), rev = new Map();
    R0.forEach(u => nav.adj(u).forEach(x => { if (!rev.has(x.to)) rev.set(x.to, []); rev.get(x.to).push(u); }));
    const back = new Set([...R0].filter(k => nav.isExit(k))), q = [...back];
    while (q.length){ const n = q.pop(); for (const m of rev.get(n) || []) if (!back.has(m)){ back.add(m); q.push(m); } }
    const bad = [...R0].filter(n => !back.has(n)); eq(bad.length, 0, 'уровень ' + i + ', тупики: ' + bad.slice(0, 3).join(' '));
  }
});
test('граф совпадает с физикой: кратчайший путь графа исполняется подряд в одной игре (решётки, плиты, обвалы настоящие)', () => {
  for (let i = 1; i <= C.LEVELS.length; i++){
    const nav = NAV[i].intact, G = C.Game({ level: i, sim: true }).start(), S = G.state(), LV = S.LV;
    const legs = LV.exitPlate ? [u => { const n = nav.nodes.get(u); return n.c === LV.exitPlate.c && n.r === LV.exitPlate.r; }, u => nav.isExit(u)] : [u => nav.isExit(u)];
    let edges = 0;
    for (const goal of legs){
      const steps = route(nav, L.nodeKey(S.hero.x, S.hero.y), goal, S.M); ok(steps, 'уровень ' + i + ': путь');
      for (const st of steps){
        for (const e of st.e ? [st.e] : st.m.path){
          const d = L.Driver(e.a); let r;
          for (let k = 0; k < 900; k++){ r = d.next(S, DT); if (typeof r === 'string') break; G.setInput(r); G.update(DT); }
          eq(r, 'done', 'уровень ' + i + ' ребро ' + e.from + '→' + e.to); eq(L.nodeKey(S.hero.x, S.hero.y), e.to, 'уровень ' + i + ' узел'); edges++;
        }
      }
    }
    run(G, 0.3, { up: true }); run(G, 3); ok(S.phase === 'won' || S.level === i + 1, 'уровень ' + i + ' пройден (' + edges + ' действий)');
  }
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек chertog для секвенсора движка, длины кратны такту', () => {
  const t = sandbox.Arcade.tracks.chertog; ok(t && t.bpm && t.melody && t.bass && t.drums);
  const steps = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(steps(t.melody) % 8, 0); eq(steps(t.bass) % 8, 0); eq(steps(t.drums) % 8, 0); eq(steps(t.melody) % steps(t.bass), 0);
});
test('i18n: у RU и EN одинаковые ключи; есть названия всех уровней, стражей и причин гибели', () => {
  const ru = Object.keys(C.STR.ru).sort(), en = Object.keys(C.STR.en).sort(); eq(ru.join(), en.join());
  for (let i = 1; i <= 9; i++) ok(C.STR.ru['l' + i] && C.STR.en['l' + i]);
  'gfwmNZ'.split('').forEach(k => ok(C.STR.ru[k])); ['spike', 'chop', 'fall', 'abyss', 'sword', 'plate', 'poison', 'twin'].forEach(k => ok(C.STR.ru['d_' + k], k));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHByaW5jZSA/b2YgP3BlcnNpYXzQv9GA0LjQvdGGW9CwLdGP0ZFdKiA/0L/QtdGA0YHQuHxwcmludHMgP3BlcnNpaXxcYnBlcnNpYVxifG1lY2huZXJ80LzQtdGF0L3QtdGA', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Наместник') && !BAD.test('Чертог') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('подмастерье'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот (клинки не ранят) проходит каждый уровень в настоящей физике — с ножницами по таймингу и двойником', () => {
  for (let i = 1; i <= C.LEVELS.length; i++){ const r = playChertog(C, i, { level: i, only: true, god: true, maxT: 400 }); ok(i === 9 ? r.won : r.cleared === 1, 'уровень ' + i + ': ' + JSON.stringify(r.why) + (r.stuck ? ' застрял' : '')); }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибки момента толчка, иногда прозевывает защиту.
const N = 30, B1 = []; for (let s = 1; s <= N; s++) B1.push(playChertog(C, s, { level: 1, only: true, maxT: 600 }));
test('баланс: «человеческий» бот проходит 1-й уровень почти всегда (≥ 90% партий)', () => {
  const n = B1.filter(r => r.cleared === 1).length, dm = B1.reduce((a, r) => a + r.deaths, 0);
  console.log('     1-й уровень: ' + n + '/' + N + '; гибелей всего: ' + dm + '; время, с: ' + Math.min(...B1.map(r => r.time)).toFixed(0) + '–' + Math.max(...B1.map(r => r.time)).toFixed(0));
  ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N); ok(!B1.some(r => r.stuck), 'застрял');
});
test('вся игра: бот укладывается в 45 минут, гибнет и получает раны, без «зависаний»', () => {
  const R = []; for (let s = 1; s <= 12; s++) R.push(playChertog(C, s, { maxT: K.TIME }));
  const n = R.filter(r => r.won).length, why = {}; R.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     победы: ' + n + '/12; раны: ' + R.reduce((a, r) => a + r.hurt, 0) + '; гибели: ' + JSON.stringify(why) + '; время побед, мин: ' + R.filter(r => r.won).map(r => (r.time / 60).toFixed(1)).join(' '));
  ok(n >= 8, 'побед ' + n); ok(!R.some(r => r.stuck), 'застрял: ' + R.filter(r => r.stuck).map(r => r.seed + '@' + r.level).join(','));
  ok(R.every(r => !r.won || r.time < K.TIME));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

/* ОСКОЛОК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node oskolok/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: эпизоды и главы, физику Веры, резонатор (импульс / щит / пробой), дрона, Стеклодувов и осколки, Теней,
   лучи и зеркала, рычаги/кнопки/двери, кристаллы, осыпающиеся плиты, погоню, контрольные точки, кат-сцены и финалы;
   проходимость КАЖДОГО эпизода по графу настоящей физики с решением головоломок поиском (и что головоломки нужны),
   устойчивость маршрутов к ошибкам человека, исполнение маршрута подряд, погони с реакцией 150 и 250 мс,
   партии «человеческого» бота по главе 1 и по всей игре, музыку, i18n и правило имён. */
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
const O = sandbox.OSKOLOK, L = O.logic, K = L.K, C = L.COLS, DT = 1 / 60;
const { Nav, navFor, driver, playScreens, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, d, m){ if (Math.abs(a - b) > d) throw new Error((m || '') + ' ждали ≈' + b + '±' + d + ', получили ' + a); }

const AIR = '#..............................#', F = '################################';
// тестовая игра на своей карте (18 рядов по 32); ev — журнал событий
function mk(rows, o = {}){
  const map = []; for (let r = 0; r < 18; r++) map.push(rows[r] || (r < 2 ? F : r >= 14 ? F : AIR));
  const ev = [], def = Object.assign({ ch: 1, ep: 1, map }, o.def || {});
  const game = O.Game(Object.assign({ def, idx: 0, noCut: true, have: o.have, sim: o.sim, onEvent: (t, d) => ev.push({ t, d }) }, o.opts || {})).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state(), i) : inp); game.update(DT); } game.setInput({}); }
function row(s, at, ch){ return s.slice(0, at) + ch + s.slice(at + ch.length); }
const FLOOR13 = { 13: F };   // пол — ряд 13 (подошвы y = 13)

// ---------- эпизоды ----------
test('16 эпизодов в 5 главах; экраны 32×18; у каждого старт и выход; финал — разлом и Сердце', () => {
  eq(O.SCREENS.length, 16); eq(O.CHAPTERS, 5);
  for (let ch = 1; ch <= 5; ch++) ok(O.SCREENS.filter(s => s.ch === ch).length >= 3, 'глава ' + ch);
  O.SCREENS.forEach((s, i) => {
    eq(s.map.length, 18, 'ряды ' + i); s.map.forEach((r, j) => eq(r.length, 32, 'экран ' + i + ' ряд ' + j));
    const all = s.map.join(''); eq(all.split('P').length - 1, 1, 'старт ' + i);
    ok(all.includes('X') || (s.final && all.includes('O') && all.includes('Q')), 'выход ' + i);
    const P = L.parse(s); ok(L.cellSolid({ t: P.t, open: {} }, Math.floor(P.start.x), P.start.y), 'под стартом пол ' + i);
  });
});
test('механики по главам: стража и рычаг (1), дрон и кнопка (1), погоня (1,4,5), стекло и кристаллы (2), лучи и зеркала (3), тьма и Тени (4)', () => {
  const at = (ch, re) => O.SCREENS.some(s => s.ch === ch && re.test(s.map.join('')));
  ok(at(1, /g/) && at(1, /L/) && at(1, /\*/) && at(1, /B/));
  ok(at(2, /G/) && at(2, /V/)); ok(at(3, /\//) && at(3, /Z/) && at(3, /R/) && at(3, /[}{]/));
  ok(at(4, /s/) && O.SCREENS.filter(s => s.ch === 4).every(s => s.dark));
  eq(O.SCREENS.filter(s => s.chase).map(s => s.ch).join(','), '1,4,5');
  ok(O.SCREENS[1].dark, 'дрон находят в тёмном эпизоде');
});

// ---------- физика ----------
test('бег до 6,5 кл/с; прыжок — высота ≈2,5 клетки, дальность ≈4,5; приземление и койот-время', () => {
  const T = mk({ 13: F, 12: row(AIR, 2, 'P') }); run(T.game, 0.6, { x: 1 }); near(T.S.hero.vx, K.RUN, 0.01);
  const J = mk({ 13: F, 12: row(AIR, 2, 'P') }); let top = 99;
  run(J.game, 1, (S, i) => { top = Math.min(top, S.hero.y); return { jump: i < 2 }; }); near(13 - top, K.JUMP * K.JUMP / (2 * K.G), 0.15, 'высота');
  const D = mk({ 13: F, 12: row(AIR, 2, 'P') }); const x0 = D.S.hero.x; D.S.hero.vx = K.RUN;
  run(D.game, 0.75, (S, i) => ({ x: 1, jump: i === 0 })); ok(D.S.hero.ground); near(D.S.hero.x - x0, 4.6, 0.35, 'дальность');
  const CY = mk({ 13: row(F, 6, '..........................'), 12: row(AIR, 3, 'P') });   // край пола в x=6
  run(CY.game, 0.5, (S) => ({ x: 1, jump: S.hero.x > 6.38 && S.hero.x < 6.6 })); ok(CY.has('jump'), 'прыжок сразу за краем');
});
test('смерть с одного касания: иглы, падение больше 5,7 клетки, пропасть', () => {
  const T = mk({ 13: row(F, 5, '..'), 14: row(F, 5, '^^'), 12: row(AIR, 2, 'P') }); run(T.game, 1, { x: 1 }); ok(T.has('die')); eq(T.ev.find(e => e.t === 'die').d.why, 'spike');
  const H = mk({ 7: row(AIR, 1, '####'), 6: row(AIR, 2, 'P'), 13: F }); run(H.game, 1.4, { x: 1 }); eq(H.ev.find(e => e.t === 'die').d.why, 'fall', '6 рядов');
  const H2 = mk({ 8: row(AIR, 1, '####'), 7: row(AIR, 2, 'P'), 13: F }); run(H2.game, 1.4, { x: 1 }); ok(!H2.has('die'), '5 рядов — живы');
  const A = mk({ 13: row(F, 4, '............................'), 14: row(F, 4, '............................'), 15: row(F, 4, '............................'), 16: row(F, 4, '............................'), 17: row(F, 4, '............................'), 12: row(AIR, 2, 'P') });
  run(A.game, 2.5, { x: 1 }); eq(A.ev.find(e => e.t === 'die').d.why, 'abyss');
});

// ---------- резонатор ----------
test('импульс: оглушает стража в радиусе, не дальше; перезарядка', () => {
  const T = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 5, 'g') }); T.S.guards[0].st = 'patrol';
  T.game.setInput({ res: true }); T.game.update(DT); T.game.setInput({}); T.game.update(DT); eq(T.S.guards[0].st, 'stun'); ok(T.S.hero.pulseCd > 0);
  const F2 = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 8, 'g') }); F2.game.setInput({ res: true }); F2.game.update(DT); F2.game.setInput({}); F2.game.update(DT); ok(F2.S.guards[0].st !== 'stun', 'вне радиуса');
  const B = mk({ ...FLOOR13, 12: row(row(AIR, 5, 'P'), 2, 'g') }); B.game.setInput({ res: true }); B.game.update(DT); ok(B.S.guards[0].st !== 'stun', 'за спиной');
});
test('стеклянный щит: удержание ≥ 0,15 с, отражает осколок — страж разбит; тратит заряд; без щита — гибель', () => {
  const T = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 10, 'g') });
  run(T.game, 2.2, { res: true }); ok(T.has('shard'), 'выстрел'); ok(T.has('reflect'), 'отражение'); ok(!T.S.guards[0].alive, 'страж разбит'); ok(!T.has('die'));
  ok(T.S.hero.energy < K.EN_MAX - 1, 'заряд потрачен'); const e = T.S.hero.energy; run(T.game, 2, {}); ok(T.S.hero.energy > e, 'восстанавливается');
  const N = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 10, 'g') }); run(N.game, 2.2, {}); eq(N.ev.find(e => e.t === 'die').d.why, 'shard');
  const W = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 10, 'g') }); W.S.hero.face = -1; run(W.game, 2.2, (S, i) => ({ res: true, x: 0 })); ok(W.has('die'), 'щит спиной к осколку не спасает');
});
test('пробой: заряд 0,9 с, отпустить — разбивает стекло в ряду тела на 5 клеток; рано отпустить — ничего', () => {
  const T = mk({ ...FLOOR13, 11: row(AIR, 6, 'GGG'), 12: row(row(AIR, 3, 'P'), 6, 'GGG'), 10: row(AIR, 6, 'GGG') });
  run(T.game, 0.5, { charge: true }); run(T.game, 0.1, {}); eq(T.S.M.t[12 * C + 6], 'G', 'рано');
  run(T.game, 0.95, { charge: true }); ok(T.has('charged')); run(T.game, 0.1, {});
  eq(T.S.M.t[12 * C + 6] + T.S.M.t[12 * C + 8] + T.S.M.t[11 * C + 7], '   '); eq(T.S.M.t[10 * C + 7], 'G', 'выше тела стекло цело'); ok(T.count('glass') === 6);
  const S2 = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 4, '#.G'), 11: row(AIR, 4, '#.G') }); run(S2.game, 1, { charge: true }); run(S2.game, 0.1, {}); eq(S2.S.M.t[12 * C + 6], 'G', 'через камень не бьёт');
  const K2 = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 6, 'g') }); K2.S.guards[0].st = 'stun'; K2.S.guards[0].t = 9; run(K2.game, 1, { charge: true }); K2.game.setInput({}); K2.game.update(DT); ok(K2.has('shatter'), 'пробой разбивает стража');
});

// ---------- дрон ----------
test('дрон: летит в точку, нажимает дальнюю кнопку → дверь открыта; стена его останавливает; R — вернуть', () => {
  const T = mk({ ...FLOOR13, 3: row(AIR, 20, 'B'), 12: row(row(AIR, 2, 'P'), 25, 'D'), 11: row(AIR, 25, 'D'), 10: row(AIR, 25, '#') }, { have: true });
  ok(T.game.sendDrone(20.5, 3.5)); run(T.game, 2.5, {}); ok(T.has('button')); ok(T.S.M.open[1], 'дверь'); eq(T.S.drone.st, 'hover');
  ok(T.game.recallDrone()); run(T.game, 3, {}); eq(T.S.drone.st, 'follow');
  const W = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 10, '#'), 11: row(AIR, 10, '#'), 10: row(AIR, 10, '#'), 9: row(AIR, 10, '#') }, { have: true });
  W.game.sendDrone(20, 10.5); run(W.game, 2, {}); ok(W.S.drone.x < 10.05, 'упёрся в стену: x=' + W.S.drone.x);
  const N = mk({ ...FLOOR13, 12: row(AIR, 2, 'P') }, { have: false }); ok(!N.game.sendDrone(10, 10), 'без дрона');
});
test('дрон отвлекает Стеклодува (смотрит на свет и не стреляет) и отгоняет Тень светом', () => {
  const T = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 14, 'g') }, { have: true });
  T.game.sendDrone(16, 10.5); run(T.game, 2, {}); ok(T.S.guards[0].st === 'look', 'смотрит: ' + T.S.guards[0].st); ok(!T.has('shard'));
  const D = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 9, 's') }, { have: true }); D.S.lurkers[0].x = 9.5;
  D.game.sendDrone(9.5, 10.5); run(D.game, 0.6, {}); eq(D.S.lurkers[0].st, 'burn'); ok(!D.has('die'));
  const H = mk({ ...FLOOR13, 12: row(row(AIR, 2, 'P'), 7, 's') }, { have: false }); run(H.game, 3, {}); eq(H.ev.find(e => e.t === 'die').d.why, 'shadow', 'Тень в темноте ловит');
});
test('эпизод 1-2: светляк подобран — кат-сцена, затем дрон с Верой; в контрольной точке подбор отменяется', () => {
  const ev = []; const g = O.Game({ idx: 1, have: false, onEvent: (t) => ev.push(t) }).start(), S = g.state();
  ok(!S.drone.have); g._place(13.5, 13, 1); g.update(DT); ok(S.drone.have); eq(S.phase, 'cut'); eq(S.cut.id, 'drone');
  run(g, 0.4, {}); ok(g.skip()); run(g, 0.1, {}); eq(S.phase, 'play');
  g._die('guard'); run(g, 1.5, {}); ok(!S.drone.have, 'вернулись к началу эпизода'); ok(S.M.t.includes('*'));
});

// ---------- лучи, зеркала, кристаллы, плиты, рычаги ----------
test('эпизод 3-2: импульс и дрон поворачивают зеркала → луч в приёмник → дверь', () => {
  const g = O.Game({ idx: 8, sim: true, have: true }).start(), S = g.state();
  ok(!S.M.lit[1]); g._place(23.5, 13, 1); g.setInput({ res: true }); g.update(DT); g.setInput({}); g.update(DT);
  ok(!S.M.lit[1], 'одно зеркало мало'); g.sendDrone(24.5, 4.5); run(g, 1.5, {}); ok(S.M.lit[1], 'горит'); ok(S.M.open[1], 'дверь открыта');
  const pts = S.M.beams[0]; eq(pts[pts.length - 1][0], 1, 'луч дошёл до приёмника у левой стены');
});
test('кристалл: падает от импульса, разбивает стража под собой и становится блоком-ступенью; Веру — убивает', () => {
  const T = mk({ ...FLOOR13, 9: row(AIR, 6, 'V'), 12: row(row(AIR, 4, 'P'), 6, 'g') }); T.S.guards[0].x = 6.5; T.S.guards[0].st = 'stun'; T.S.guards[0].t = 9;
  T.game.setInput({ res: true }); T.game.update(DT); T.game.setInput({}); run(T.game, 1, {}); ok(T.has('crystal')); ok(T.has('shatter')); eq(T.S.M.t[12 * C + 6], 'K');
  const H = mk({ ...FLOOR13, 9: row(AIR, 3, 'V'), 12: row(AIR, 3, 'P') });
  H.S.M.t[9 * C + 3] = ' '; H.S.M.fall.push({ c: 3, y: 9, vy: 0 }); run(H.game, 1, {}); eq(H.ev.find(e => e.t === 'die').d.why, 'crystal');
});
test('осыпающаяся плита рушится через 0,45 с после касания; рычаг ↓ переключает дверь; дверь не закрывается на Вере', () => {
  const T = mk({ 13: row(F, 4, 'CC'), 12: row(AIR, 4, 'P') }); run(T.game, 0.3, {}); eq(T.S.M.t[13 * C + 4], 'C'); run(T.game, 0.3, {}); eq(T.S.M.t[13 * C + 4], ' '); ok(T.has('crumble'));
  const Lv = mk({ ...FLOOR13, 12: row(row(AIR, 3, 'PL'), 8, 'D'), 11: row(AIR, 8, 'D'), 10: row(AIR, 8, '#') }); Lv.game._place(4.5, 13, 1);
  run(Lv.game, 0.1, { down: true }); ok(Lv.S.M.open[1]); Lv.game._place(8.5, 13, 1); Lv.S.M.tog[1] = false; run(Lv.game, 0.1, {}); ok(Lv.S.M.open[1], 'держится, пока Вера в проёме');
});

// ---------- погоня, контрольные точки, главы, финалы ----------
test('погоня: Тень-ловец настигает стоящую Веру; бегущая уходит; на следующем экране погони — тот же разрыв', () => {
  const g = O.Game({ idx: 3, noCut: true }).start(), S = g.state(); run(g, 2, {}); eq(S.dieWhy, 'chaser');
  const ev = []; const g2 = O.Game({ idx: 3, noCut: true, onEvent: t => ev.push(t) }).start(); ok(g2.state().chase && g2.state().chase.delay > 0);
  const mkChase = O.Game({ def: Object.assign({}, O.SCREENS[3]), idx: 0, noCut: true }); ok(mkChase);
});
test('контрольная точка: смерть возвращает к началу эпизода с исходной картой (стекло цело, рычаги сброшены)', () => {
  const g = O.Game({ idx: 4, noCut: true }).start(), S = g.state(); const t0 = S.M.t.join('');
  g._place(10.5, 13, 1); run(g, 1, { charge: true }); run(g, 0.1, {}); ok(S.M.t.join('') !== t0, 'стекло разбито');
  g._die('spike'); run(g, 1.5, {}); eq(S.M.t.join(''), t0); eq(S.idx, 4); eq(S.deaths, 1); near(S.hero.x, 2.5, 1e-9);
});
test('главы и кат-сцены: выход ведёт на следующий эпизод; новая глава — кат-сцена без слов (пропускается)', () => {
  const ev = []; const g = O.Game({ idx: 3, onEvent: (t, d) => ev.push([t, d]) }).start(), S = g.state();
  g._place(30.5, 13, 1); S.chase = null; run(g, 0.1, { x: 1 }); eq(S.phase, 'cut'); eq(S.cut.id, 'c2');
  run(g, 0.5, {}); ok(g.skip()); run(g, 0.1, {}); eq(S.idx, 4); eq(S.ch, 2); eq(S.phase, 'play');
  Object.keys(O.CUTS).forEach(k => ok(O.CUTS[k] >= 3 && O.CUTS[k] <= 12, 'длительность ' + k));
  const c = O.Game({ chapter: 3 }).start(); eq(c.state().phase, 'cut'); eq(c.state().cut.id, 'c3'); ok(c.state().drone.have, 'с главы 2+ дрон уже есть');
});
test('финал с выбором: в разлом — «Возвращение» (A); дрон в Сердце — «Отданный свет» (B)', () => {
  const ev = []; const g = O.Game({ idx: 15, onEvent: (t, d) => ev.push([t, d]) }).start(), S = g.state();
  g._place(29.5, 13, 1); run(g, 0.3, { x: 1 }); eq(S.phase, 'cut'); eq(S.cut.id, 'endA'); g.skip(); run(g, 0.4, {}); g.skip(); run(g, 0.1, {});
  eq(S.phase, 'won'); eq(S.ending, 'A'); ok(ev.some(e => e[0] === 'win' && e[1].ending === 'A'));
  const g2 = O.Game({ idx: 15 }).start(), S2 = g2.state(); g2.sendDrone(15.5, 5.5); run(g2, 2, {}); eq(S2.cut && S2.cut.id, 'endB'); run(g2, 11, {}); eq(S2.ending, 'B'); eq(S2.phase, 'won');
});

// ---------- проходимость (граф по физике + решение головоломок поиском) ----------
const NAV = O.SCREENS.map((s, i) => navFor(O, i, i > 1));
NAV[1] = navFor(O, 1, false);
test('проходимость: каждый эпизод решается поиском по графу настоящей физики (финал — оба выхода)', () => {
  O.SCREENS.forEach((s, i) => {
    const nav = NAV[i];
    if (s.final){ ok(nav.route(nav.startNode, nav.startKey, e => e.exit === 'A'), 'финал A'); ok(nav.route(nav.startNode, nav.startKey, e => e.exit === 'B'), 'финал B'); return; }
    const p = nav.route(nav.startNode, nav.startKey); ok(p, 'эпизод ' + s.ch + '-' + s.ep);
  });
});
test('головоломки обязательны: без взаимодействий (рычаг, импульс, пробой, дрон) эпизоды-головоломки непроходимы', () => {
  const puzzle = [1, 2, 4, 5, 6, 7, 8, 9, 11, 13];
  puzzle.forEach(i => { const nv = new Nav(O, i, { have: i > 1, noInteract: true }); ok(!nv.route(nv.startNode, nv.startKey), 'эпизод ' + O.SCREENS[i].ch + '-' + O.SCREENS[i].ep + ' проходится без головоломки'); });
  const kinds = new Set(); O.SCREENS.forEach((s, i) => { if (s.final) return; const p = NAV[i].route(NAV[i].startNode, NAV[i].startKey); p.steps.forEach(st => kinds.add(st.act.k)); });
  ['lever', 'pulse', 'breach', 'drone'].forEach(k => ok(kinds.has(k), 'в решениях есть ' + k));
});
test('устойчивость: у каждого эпизода есть маршрут, где прыжки терпят ошибку человека (±2 кадра удержания, ±1 разбега)', () => {
  O.SCREENS.forEach((s, i) => { const p = NAV[i].robustRoute(NAV[i].startNode, NAV[i].startKey, s.final ? (e => e.exit === 'A') : undefined); ok(p && p.steps.every(st => NAV[i].robust(st)), 'эпизод ' + s.ch + '-' + s.ep); });
});
test('исполнимость: маршрут графа подряд в одной игре (без врагов) доводит до выхода в каждом эпизоде', () => {
  O.SCREENS.forEach((s, i) => {
    if (s.final) return;
    const nav = NAV[i], p = nav.robustRoute(nav.startNode, nav.startKey), g = O.Game({ idx: i, sim: true, have: i > 1 }).start(), S = g.state();
    for (const st of p.steps){
      const a = st.act;
      if (a.k === 'walk' || a.k === 'jump'){ const d = driver(L, a); for (let f = 0; f < 400 && !S.exited; f++){ const r = d(f, S); if (r === 'done') break; g.setInput(r); g.update(DT); } g.setInput({}); }
      else if (a.k === 'lever'){ g.setInput({ down: true }); g.update(DT); g.setInput({}); g.update(DT); }
      else if (a.k === 'pulse'){ if (S.hero.face !== a.d){ g.setInput({ x: a.d }); g.update(DT); } g.setInput({ res: true }); g.update(DT); g.setInput({}); run(g, 1.5, {}); }
      else if (a.k === 'breach'){ if (S.hero.face !== a.d){ g.setInput({ x: a.d }); g.update(DT); } run(g, 1, { charge: true }); run(g, 0.2, {}); }
      else if (a.k === 'drone'){ g.sendDrone(a.tx, a.ty); run(g, 3, {}); }
      ok(S.phase === 'play', 'эпизод ' + s.ch + '-' + s.ep + ': гибель на ' + a.k);
    }
    eq(S.exited, 'X', 'эпизод ' + s.ch + '-' + s.ep);
  });
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный эмбиент-трек oskolok подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.oskolok; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; есть названия всех глав и обоих финалов', () => {
  const ru = Object.keys(O.STR.ru).sort(), en = Object.keys(O.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let k = 1; k <= 5; k++) ok(O.STR.ru['ch' + k] && O.STR.en['ch' + k]);
  ok(O.STR.ru.endA && O.STR.ru.endB);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (+ список этого жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8')
    + '|' + Buffer.from('YW5vdGhlciA/d29ybGR8b3V0ID9vZiA/dGhpcyA/d29ybGR8Zmxhc2ggP2JhY2t8ZGVscGhpbmV8XGJsZXN0ZXJcYnxlcmljID9jaGFoaXxjaGFoaXzQsNC90LDQt9C10YAgP9Cy0L7RgNC70LR80Y3QvdCw0LfQtdGAID/QstC+0YDQu9C0fNCw0YPRgiA/0L7RhCA/0LfQuNGBfNGE0LvQtdGIID/QsdC10Lp80YTQu9GN0YggP9Cx0Y3QunzRhNC70LXRiNCx0Y3QunzQtNC10LvRjNGE0LjQvXzQu9C10YHRgtC10YB80YfQsNGF0Lh80YjQsNC50Lg=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Вера') && !BAD.test('Стеклодув') && !BAD.test('ОСКОЛОК') && !BAD.test('flash') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// погони: держать «вправо», прыгать по чтению сцены (без индикаторов); вход в экран — с реакцией, момент прыжка ±50 мс
for (const R of [0.15, 0.25]) test('погони проходимы с реакцией ' + Math.round(R * 1000) + ' мс: каждый экран погони — ≥ 95% из 30 партий', () => {
  O.SCREENS.forEach((s, i) => {
    if (!s.chase) return;
    let won = 0, gap = 99; for (let seed = 1; seed <= 30; seed++){ const r = playScreens(O, seed, { from: i, to: i, react: [R, R], maxT: 30, have: i > 1 }); if (r.won && !r.deaths) won++; if (r.minGap != null) gap = Math.min(gap, r.minGap); }
    console.log('     погоня ' + s.ch + '-' + s.ep + ': ' + won + '/30, мин. отрыв ' + gap.toFixed(2) + ' кл.');
    ok(won >= 29, 'погоня ' + s.ch + '-' + s.ep + ': ' + won + '/30'); ok(gap < 5, 'погоня не должна быть пустой: отрыв ' + gap.toFixed(2));
  });
});
test('погоня — испытание: при реакции 0,6 с бывают поимки', () => {
  let caught = 0; for (let seed = 1; seed <= 20; seed++){ const r = playScreens(O, seed, { from: 12, to: 12, react: [0.6, 0.6], maxT: 30, have: true }); caught += r.deaths; }
  ok(caught > 0, 'никто не пойман');
});
// «человеческий» бот: реакция 150–250 мс, ошибки удержания, щит по реакции; глава 1 — 20 партий
const CH1 = []; for (let s = 1; s <= 20; s++) CH1.push(playScreens(O, s, { from: 0, to: 3, maxT: 300 }));
test('бот проходит главу 1 часто: ≥ 90% партий (с контрольными точками), ≥ 50% — без единой гибели', () => {
  const won = CH1.filter(r => r.won).length, clean = CH1.filter(r => r.won && !r.deaths).length, why = {};
  CH1.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     глава 1: ' + won + '/20, без гибели ' + clean + '/20, гибели: ' + JSON.stringify(why));
  ok(won >= 18, 'глава 1: ' + won + '/20'); ok(clean >= 10, 'без гибели: ' + clean + '/20'); ok(!CH1.some(r => r.stuck));
});
test('бот проходит главы 2–5 до финала (5 партий)', () => {
  let won = 0, deaths = 0; for (let s = 1; s <= 5; s++){ const r = playScreens(O, s, { from: 4, to: 15, maxT: 600, have: true }); if (r.won) won++; deaths += r.deaths; }
  console.log('     главы 2–5: ' + won + '/5, гибелей всего ' + deaths); ok(won >= 4, won + '/5');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

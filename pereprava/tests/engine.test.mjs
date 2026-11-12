/* ПЕРЕПРАВА · tests/engine.test.mjs — автотесты логики и обвязки (Node, без зависимостей).
   Запуск: node pereprava/tests/engine.test.mjs
   Логика (js/game.js) — в node:vm с шимом window. Бот (tests/bot.mjs): точный поиск пути —
   проходимость каждой смены; «человеческий» игрок — баланс (уровень 1 ≥ 90 %, вся игра ~20–40 %). */
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
vm.runInContext(read('js/music.js'), sandbox, { filename: 'music.js' });
const K = sandbox.PEREPRAVA, L = K.logic;
const { playPereprava, findPath, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
const FAST = !!process.env.FAST;   // FAST=1 — без долгих прогонов ботов (для отладки)
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, e, m){ if (Math.abs(a - b) > e) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

const h = 1 / 60;
// Игра на уровне level, без врагов/бонусов (их включают сами тесты)
function arena(level = 1, opts = {}){
  const events = [];
  const game = K.Game(Object.assign({ rng: mulberry32(opts.seed || 1), level, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  S.banner = 0; S.cfg.spiders = []; S.cfg.trap = false; S.cfg.prize = false; S.cfg.mate = false; S.mate = null;
  return { game, S, events };
}
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(h); }
const count = (ev, t) => ev.filter(e => e[0] === t).length;
const last = (ev, t) => { const f = ev.filter(e => e[0] === t); return f.length ? f[f.length - 1][1] : null; };
// пустая полоса (без объектов) и полоса из одного объекта, стоящего в x0 при t=0
function emptyLane(row, kind){ return L.makeLane(row, kind, '..........................', 0); }
function oneLane(row, kind, ch, len, v, x0){
  const lane = L.makeLane(row, kind, ch.repeat(len) + '.'.repeat(30), v);
  lane.objs[0].off = x0 + lane.M; return lane;     // objX(t=0) = x0
}
function hopUntilLanded(game, S){ for (let i = 0; i < 30 && S.hero.hop; i++) game.update(h); }

// ---------- уровни ----------
test('10 смен: полосы на месте (5 дорожных, 5 речных), шаблоны валидны, все виды транспорта и плавсредств', () => {
  const types = new Set();
  for (let n = 1; n <= 10; n++){
    const c = L.buildLevel(n);
    for (let r = L.RIVER0; r <= L.RIVER1; r++){ eq(c.lanes[r].kind, 'river', `ур.${n} ряд ${r}`); c.lanes[r].objs.forEach(o => types.add(o.type)); }
    for (let r = L.ROAD0; r <= L.ROAD1; r++){ eq(c.lanes[r].kind, 'road', `ур.${n} ряд ${r}`); c.lanes[r].objs.forEach(o => types.add(o.type)); }
    ok(!c.lanes[L.ROW_BAY] && !c.lanes[L.MEDIAN] && !c.lanes[L.START], 'берега без полос');
    for (const lane of c.lanes.filter(Boolean)) ok(lane.P >= L.W + 2 * Math.max(...lane.objs.map(o => o.len)), `ур.${n}: период полосы ${lane.row} короче экрана+объекта`);
  }
  eq([...types].sort(), ['cart', 'dive', 'fish', 'lift', 'log', 'moto', 'raft', 'roller', 'truck']);
  let bad = null; try { L.makeLane(1, 'river', 'll...l', 1); } catch (e) { bad = e; }
  ok(bad, 'объект, разрезанный краем шаблона, — ошибка');
});

test('ускорение и усложнение по уровням: скорость растёт, таймер короче, враги и бонусы появляются по плану', () => {
  const avg = n => { const c = L.buildLevel(n); return c.lanes.filter(Boolean).reduce((s, l) => s + Math.abs(l.v), 0) / 10; };
  for (let n = 2; n <= 10; n++) ok(avg(n) >= avg(n - 1) - 1e-9, `ур.${n} медленнее ур.${n - 1}`);
  ok(avg(10) > avg(1) * 1.4, 'к 10-му скорость выше в 1.4+ раза: ' + (avg(10) / avg(1)).toFixed(2));
  for (let n = 2; n <= 10; n++) ok(L.buildLevel(n).time < L.buildLevel(n - 1).time, 'таймер ур.' + n);
  eq([1, 2, 3, 4, 8].map(n => L.buildLevel(n).spiders.length), [0, 0, 1, 1, 2], 'пауки');
  eq([1, 3, 4, 10].map(n => L.buildLevel(n).trap), [false, false, true, true], 'капканы');
  eq([1, 2, 10].map(n => L.buildLevel(n).mate), [false, true, true], 'напарник');
  ok(!L.buildLevel(4).lanes.some(l => l && l.objs.some(o => o.type === 'fish')) && L.buildLevel(5).lanes.some(l => l && l.objs.some(o => o.type === 'fish')), 'сом — с 5-го');
  ok(L.buildLevel(9).dive.under > L.buildLevel(1).dive.under, 'поплавки дольше под водой');
});

// ---------- дорога ----------
test('столкновение с транспортом: машина на клетке героя — гибель «car», в зазоре — жив', () => {
  const c = L.buildLevel(1), r = L.ROAD0;
  c.lanes[r] = oneLane(r, 'road', 't', 2, 0, 200);      // фура 64 px стоит на x 200..264
  const hero = L.newHero(); hero.row = r; hero.x = 240;
  eq(L.stepHero(c, hero, 0, h), 'car');
  hero.x = 280 + L.HERO_HALF; eq(L.stepHero(c, hero, 0, h), null, 'в зазоре');
  hero.x = 200 - L.HERO_HALF + 2; eq(L.stepHero(c, hero, 0, h), null, 'касание края с допуском');
  // транспорт едет и сбивает стоящего
  c.lanes[r] = oneLane(r, 'road', 'c', 1, 3, 100);     // тележка 96 px/с слева
  hero.x = 176; let res = null, t = 0;
  for (let i = 0; i < 60 && !res; i++){ t += h; res = L.stepHero(c, hero, t, h); }
  eq(res, 'car', 'наезд');
});
test('на суше край экрана — стена (прыжок не начинается), на дороге x выравнивается по клеткам', () => {
  const c = L.buildLevel(1), hero = L.newHero();
  hero.x = L.colX(0); ok(!L.hopStart(c, hero, 'left'), 'влево у края');
  hero.x = L.colX(L.COLS - 1); ok(!L.hopStart(c, hero, 'right'), 'вправо у края');
  hero.x = L.colX(7); ok(!L.hopStart(c, hero, 'down'), 'назад со стартовой полосы');
  hero.row = L.MEDIAN; hero.x = 211;   // после плота x «нецелый»
  ok(L.hopStart(c, hero, 'down'));
  c.lanes[L.ROAD0] = emptyLane(L.ROAD0, 'road');
  let t = 0; while (hero.hop){ t += h; L.stepHero(c, hero, t, h); }
  eq(hero.x, L.snapX(211), 'выравнивание по столбцу');
});

// ---------- река ----------
test('течение переносит героя вместе с бревном (x += v·dt), спрыгнуть можно', () => {
  const c = L.buildLevel(1), r = 3;
  c.lanes[r] = oneLane(r, 'river', 'l', 4, 2, 100);    // 64 px/с
  const hero = L.newHero(); hero.row = r; hero.x = 160;
  let t = 0; for (let i = 0; i < 60; i++){ t += h; eq(L.stepHero(c, hero, t, h), null, 'на бревне жив'); }
  near(hero.x, 160 + 64, 0.01, 'за 1 с');
  const back = L.makeLane(r, 'river', 'l'.repeat(4) + '.'.repeat(30), -1.5);
  c.lanes[r] = back; back.objs[0].off = 100 + back.M + 1.5 * L.CW * t;   // плывёт влево, герой на нём
  hero.x = 150; const x0 = hero.x;
  for (let i = 0; i < 30; i++){ t += h; L.stepHero(c, hero, t, h); }
  near(hero.x, x0 - 1.5 * L.CW * 0.5, 0.01, 'встречное течение');
});
test('вода без опоры — гибель «water»; ныряющие поплавки под водой — не опора', () => {
  const c = L.buildLevel(1), r = 2;
  c.lanes[r] = emptyLane(r, 'river');
  const hero = L.newHero(); hero.row = r; hero.x = 240;
  eq(L.stepHero(c, hero, 0, h), 'water');
  // прыжок с насыпи в пустую воду
  const h2 = L.newHero(); h2.row = L.MEDIAN; c.lanes[L.RIVER1] = emptyLane(L.RIVER1, 'river');
  L.hopStart(c, h2, 'up'); let t = 0, res = null; while (!res && t < 1){ t += h; res = L.stepHero(c, h2, t, h); }
  eq(res, 'water', 'с насыпи в воду');
  // поплавки: найти моменты «на плаву» и «под водой»
  const lv = L.buildLevel(3); const lane = lv.lanes.find(l => l && l.objs.some(o => o.type === 'dive')), o = lane.objs.find(o => o.type === 'dive');
  let tUp = -1, tDown = -1;
  const onScreen = tt => { const x = L.objX(lane, o, tt); return x > 40 && x + o.len < L.W - 40; };
  for (let tt = 0; tt < 200 && (tUp < 0 || tDown < 0); tt += 0.01){ if (!onScreen(tt)) continue; const d = L.diveDepth(lv, o, tt); if (d === 0 && tUp < 0) tUp = tt; if (d === 1 && tDown < 0) tDown = tt; }
  ok(tUp >= 0 && tDown >= 0, 'есть оба состояния');
  const xm = t2 => L.objX(lane, o, t2) + o.len / 2;
  const a = L.newHero(); a.row = lane.row; a.x = xm(tUp); eq(L.stepHero(lv, a, tUp, h), null, 'на плаву — опора');
  const b = L.newHero(); b.row = lane.row; b.x = xm(tDown); eq(L.stepHero(lv, b, tDown, h), 'water', 'под водой — гибель');
});
test('унесло за край экрана — гибель «edge»; прыжок за край с воды — тоже', () => {
  const c = L.buildLevel(1), r = 4;
  c.lanes[r] = oneLane(r, 'river', 'l', 6, 3, 300);    // бревно уплывает вправо
  const hero = L.newHero(); hero.row = r; hero.x = 440;
  let t = 0, res = null; for (let i = 0; i < 120 && !res; i++){ t += h; res = L.stepHero(c, hero, t, h); }
  eq(res, 'edge');
  ok(hero.x > L.W - L.EDGE, 'у правого края');
  c.lanes[r] = oneLane(r, 'river', 'l', 6, 0, 0);
  const h2 = L.newHero(); h2.row = r; h2.x = 2 + L.EDGE;
  ok(L.hopStart(c, h2, 'left'), 'на воде прыжок к краю разрешён'); res = null; t = 0;
  while (!res && t < 1){ t += h; res = L.stepHero(c, h2, t, h); }
  eq(res, 'edge');
});
test('сом: спина — опора, голова (передняя клетка) — гибель «fish»', () => {
  const c = L.buildLevel(5), r = 3;
  c.lanes[r] = oneLane(r, 'river', 's', 3, 1, 160);    // плывёт вправо: голова 224..256
  const hero = L.newHero(); hero.row = r; hero.x = 180;
  eq(L.stepHero(c, hero, 0, h), null, 'на спине');
  hero.x = 240; eq(L.stepHero(c, hero, 0, h), 'fish', 'в пасти');
});
test('паук на насыпи ловит героя; ходит маятником в пределах экрана', () => {
  const c = L.buildLevel(3), sp = c.spiders[0];
  let lo = 1e9, hi = -1e9; for (let t = 0; t < 60; t += 0.05){ const x = L.spiderX(sp, t); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  ok(lo >= 0 && hi <= L.W && hi - lo > L.W * 0.8, 'маятник ' + lo + '..' + hi);
  const hero = L.newHero(); hero.row = L.MEDIAN; hero.x = L.spiderX(sp, 1);
  eq(L.stepHero(c, hero, 1, h), 'spider');
  hero.x = L.spiderX(sp, 1) + 60; eq(L.stepHero(c, hero, 1, h), null, 'в стороне');
});

// ---------- ячейки ----------
function toBay(game, S, i, opt = {}){
  S.hero.row = 1; S.hero.x = L.colX(L.BAY_COLS[i]) + (opt.dx || 0); S.hero.hop = null;
  S.cfg.lanes[1] = L.makeLane(1, 'river', 'l'.repeat(15) + '.'.repeat(30), 0); S.cfg.lanes[1].objs[0].off = S.cfg.lanes[1].M;
  ok(game.move('up'), 'прыжок в ячейку'); hopUntilLanded(game, S);
}
test('ячейка: прыжок в свободную — заполнена, очки за ячейку и остаток секунд, новый герой на старте', () => {
  const { game, S, events } = arena(1);
  S.timer = 12.6; const sc0 = S.score;
  toBay(game, S, 2, { dx: 15 });   // «примагничивание» в пределах допуска
  ok(S.bays[2].filled, 'заполнена'); eq(S.filled, 1);
  eq(last(events, 'bay').secs, 12);
  ok(S.score - sc0 >= L.PTS.bay + 12 * L.PTS.sec, 'очки: ' + (S.score - sc0));
  eq([S.hero.row, S.hero.x], [L.START, L.colX(L.START_COL)], 'новый герой');
  near(S.timer, S.cfg.time, 1e-9, 'таймер сброшен');
});
test('ячейка: занятая или стена между ячейками — гибель «wall»; капкан — «trap» (после предупреждения)', () => {
  let a = arena(1); a.S.bays[1].filled = true; toBay(a.game, a.S, 1); eq(a.S.death && a.S.death.reason, 'wall', 'занята');
  a = arena(1); a.S.hero.row = 1; a.S.cfg.lanes[1] = L.makeLane(1, 'river', 'l'.repeat(15) + '.'.repeat(30), 0); a.S.cfg.lanes[1].objs[0].off = a.S.cfg.lanes[1].M;
  a.S.hero.x = (L.colX(L.BAY_COLS[0]) + L.colX(L.BAY_COLS[1])) / 2; a.game.move('up'); hopUntilLanded(a.game, a.S);
  eq(a.S.death && a.S.death.reason, 'wall', 'между ячейками');
  a = arena(4); a.S.bays[3].warn = 0.5; a.S.bays[3].trap = 3; toBay(a.game, a.S, 3);
  ok(a.S.bays[3].filled && !a.S.death, 'во время предупреждения ячейка ещё свободна');
  a = arena(4); a.S.bays[3].warn = 0; a.S.bays[3].trap = 3; toBay(a.game, a.S, 3);
  eq(a.S.death && a.S.death.reason, 'trap');
});
test('5 ячеек заполнены — «clear», +1000, следующая смена; после 10-й — win', () => {
  const { game, S, events } = arena(1);
  for (let i = 0; i < 5; i++) toBay(game, S, i);
  eq(S.phase, 'clear'); eq(count(events, 'clear'), 1);
  run(game, L.CLEAR_T + 0.1);
  eq(S.level, 2); eq(S.filled, 0); ok(S.bays.every(b => !b.filled), 'ячейки пусты');
  const w = arena(10);
  for (let i = 0; i < 5; i++) toBay(w.game, w.S, i);
  run(w.game, L.CLEAR_T + 0.1);
  ok(w.S.won && count(w.events, 'win') === 1, 'победа после 10-й');
});

// ---------- таймер, жизни ----------
test('таймер переправы: истёк — гибель «time»; жизнь −1, герой и таймер заново', () => {
  const { game, S, events } = arena(2);
  S.timer = 0.5; run(game, 0.6);
  eq(last(events, 'die').reason, 'time'); eq(S.lives, 2); eq(S.phase, 'dead');
  run(game, L.DEAD_T + 0.05);
  eq(S.phase, 'play'); eq(S.hero.row, L.START); near(S.timer, S.cfg.time, 0.2);
});
test('3 жизни: третья гибель — gameover; очки за продвижение — только за новые ряды', () => {
  const { game, S, events } = arena(1);
  S.cfg.lanes[L.ROAD1] = emptyLane(L.ROAD1, 'road');
  const sc0 = S.score; game.move('up'); hopUntilLanded(game, S);
  eq(S.score - sc0, L.PTS.row, 'первый ряд');
  game.move('down'); hopUntilLanded(game, S); game.move('up'); hopUntilLanded(game, S);
  eq(S.score - sc0, L.PTS.row, 'повтор ряда не оплачивается');
  for (let i = 0; i < 3; i++){ S.timer = 0.01; run(game, L.DEAD_T + 0.1); }
  ok(S.over && count(events, 'gameover') === 1, 'gameover');
  eq(S.lives, 0);
});
test('доп. жизнь каждые 10000 очков (не больше 5)', () => {
  const { game, S, events } = arena(1);
  S.score = 9990; S.cfg.lanes[L.ROAD1] = emptyLane(L.ROAD1, 'road');
  game.move('up'); hopUntilLanded(game, S);
  eq(S.lives, 4); eq(count(events, 'extra'), 1);
});

// ---------- бонусы ----------
test('деталь-приз в ячейке: появляется со временем, +200 при доставке, гаснет через 6 с', () => {
  const { game, S, events } = arena(1);
  S.cfg.prize = true; S.prizeT = 0.1; S.timer = 99; S.hero.row = L.START;
  run(game, 0.2);
  const i = S.bays.findIndex(b => b.prize > 0); ok(i >= 0, 'приз появился');
  const sc0 = S.score; toBay(game, S, i);
  eq(count(events, 'prize'), 1); ok(S.score - sc0 >= L.PTS.bay + L.PTS.prize, 'очки приза');
  const b = arena(1); b.S.bays[0].prize = 6; b.S.timer = 99; run(b.game, 6.1); eq(b.S.bays[0].prize, 0, 'погас');
});
test('напарник Шайба: появляется на бревне, подбирается встав рядом, +200 при доставке, теряется при гибели', () => {
  const { game, S, events } = arena(2);
  S.cfg.mate = true; S.mateT = 0.01; S.timer = 999;
  let tries = 0; while (!S.mate && tries++ < 600) game.update(h);
  ok(S.mate, 'появился'); eq(S.cfg.lanes[S.mate.row].objs[S.mate.idx].type, 'log', 'на бревне');
  S.mate.life = 99;
  // поставить героя на то же бревно рядом с напарником
  S.hero.row = S.mate.row; S.hero.x = game.mateX(); S.hero.hop = null;
  game.update(h);
  ok(S.carry && !S.mate && count(events, 'pickup') === 1, 'подобран');
  const sc0 = S.score; toBay(game, S, 0);
  eq(count(events, 'mate'), 1); ok(S.bays[0].mate, 'напарник в ячейке'); ok(S.score - sc0 >= L.PTS.bay + L.PTS.mate, 'очки');
  const b = arena(2); b.S.carry = true; b.S.timer = 0.01; run(b.game, 0.1); ok(!b.S.carry, 'гибель — напарник потерян');
});

// ---------- проходимость ----------
test('проходимость: на каждом уровне есть безопасный путь со старта в каждую из 5 ячеек (в 2 момента)', () => {
  for (let n = 1; n <= 10; n++){
    const c = L.buildLevel(n);
    for (const t0 of [0, 4.3]) for (let bay = 0; bay < 5; bay++){
      const r = findPath(K, c, L.newHero(), t0, i => i === bay, c.time - 0.5, { mode: 'best' });
      ok(r && r.bay === bay, `ур.${n}, t0=${t0}: нет пути в ячейку ${bay + 1}`);
    }
  }
});
test('идеальный бот проходит все 10 смен (3 партии)', () => {
  if (FAST) return;
  for (const s of [1, 2, 3]){ const r = playPereprava(K, s, { perfect: true }); ok(r.won, `партия ${s}: дошёл до ${r.level}, ${JSON.stringify(r.causes)}`); }
});

// ---------- обвязка ----------
test('i18n: ключи RU/EN совпадают; есть причины гибели, названия смен, подсказки', () => {
  eq(Object.keys(K.STR.ru).sort(), Object.keys(K.STR.en).sort());
  for (const k of ['water', 'edge', 'car', 'spider', 'fish', 'wall', 'trap', 'time']) ok(K.STR.ru['d_' + k] && K.STR.en['d_' + k], 'd_' + k);
  for (let n = 1; n <= 10; n++) ok(K.STR.ru['lv_' + n] && K.STR.en['lv_' + n], 'lv_' + n);
  for (const k of ['play', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score']) ok(K.STR.ru[k] && K.STR.en[k], k);
});
test('музыка: оригинальный трек pereprava — мелодия/бас/ударные, ноты валидны', () => {
  const tr = sandbox.Arcade.tracks.pereprava; ok(tr && tr.bpm > 0, 'трек');
  const toks = s => [].concat(s).join(' ').split(/\s+/).filter(x => x && x !== '|');
  for (const tk of toks(tr.melody).concat(toks(tr.bass))) ok(/^(?:[A-G][#b]?\d|-|\.)$/.test(tk), 'нота ' + tk);
  for (const tk of toks(tr.drums)) ok(/^(?:[ksho]+|\.)$/.test(tk), 'удар ' + tk);
  eq(toks(tr.melody).length % 8, 0, 'целые такты');
});
test('страница: engine.js = _shared, фавикон, «← Каталог», тач-кнопки, порядок скриптов', () => {
  const html = read('index.html');
  eq(read('engine.js'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js');
  ok(/rel="icon"[^>]+EA6A12/.test(html), 'фавикон студии');
  ok(/data-catalog-back/.test(html) && /href="\.\.\/"/.test(html), 'ссылка в каталог');
  for (const d of ['U', 'D', 'L', 'R']) ok(html.includes(`data-d="${d}"`), 'кнопка ' + d);
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/ui.js', 'js/modern.js', 'js/classic.js', 'js/main.js']);
  ok(/gameId: 'pereprava'/.test(read('js/main.js')), 'gameId → рекорд arcade.best.pereprava');
});
test('Правило имён: в файлах игры нет чужих названий игр, компаний и персонажей', () => {
  // список чужих имён хранится в base64, чтобы сами имена не попадали в репозиторий открытым текстом
  const BAD = new RegExp(Buffer.from('ZnJvZ3zQu9GP0LPRg9GIfGNyb3NzeXxmcmVld2F5fGZyb2dnfFxia29uYW1pXGJ80LrQvtC90LDQvNC4fFxic2VnYVxifNGB0LXQs9CwKD8hW9CwLdGP0ZFdKXxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fG5hbWNvfNC90LDQvNC60L58dGFpdG980YLQsNC50YLQvnxjYXBjb2180LrQsNC/0LrQvtC8fHRlY21vfGFjdGl2aXNpb258YXRhcml80LDRgtCw0YDQuHxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxnYWxhZ3xnYWxheHx4b25peHzQutGB0L7QvdC40LrRgXxiYXR0bGUgP2NpdHl8bG9kZSA/cnVubmVyfGJvdWxkZXIgP2Rhc2h8ZGlnZ2VyfHJpdmVyID9yYWlkfFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxkaXp6eXxjaGlwID8nP24nPyA/ZGFsZXzQs9Cw0LnQutCwfNCy0LjQvdGC0LjQunzRiNC/0YPQvdGC0LjQunzQvdC10LfQvdCw0LnQunzRhNC40LrRgdC40Lp8ZGVlcHNlZWt8bWFyaW980LzQsNGA0LjQvnxzb25pY3zRgdC+0L3QuNC6', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md)$/.test(f));
  ok(files.length >= 12, 'файлов проверено: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
});

// ---------- баланс (бот) ----------
test('«человеческий» бот (реакция 150–250 мс): уровень 1 ≥ 90 %, вся игра ~20–40 % (40 партий)', () => {
  if (FAST) return;
  const N = 40; let l1 = 0, won = 0, stuck = 0;
  for (let s = 1; s <= N; s++){ const r = playPereprava(K, s); if (r.passed >= 1) l1++; if (r.won) won++; if (r.stuck) stuck++; }
  console.log(`     уровень 1: ${(100 * l1 / N).toFixed(0)} %, вся игра: ${(100 * won / N).toFixed(0)} %, зависаний: ${stuck}`);
  ok(l1 / N >= 0.9, 'уровень 1: ' + l1 / N);
  ok(won / N >= 0.15 && won / N <= 0.45, 'вся игра: ' + won / N);
  eq(stuck, 0, 'бот не зависает');
});

console.log(`\n${passed} ok, ${failed} fail`);
process.exit(failed ? 1 : 0);

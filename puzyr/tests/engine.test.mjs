/* ПУЗЫРЬ · tests/engine.test.mjs — автотесты логики и обвязки (Node, без зависимостей).
   Запуск: node puzyr/tests/engine.test.mjs (QUICK=1 — без баланса бота)
   Логика (js/game.js) — в node:vm с шимом window; кооп-ввод — через движок (engine.js) с фейковым DOM.
   Переделка 2026-11: пузырь на трубке (держи — раздуть, отпусти — хлопок), враги кувырком в ванны с расплавом.
   Бот (tests/bot.mjs) — «человеческий» игрок для баланса: уровень 1 ≥ 90 %, вся игра ~20–45 %. */
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
const Z = sandbox.PUZYR, L = Z.logic;
const { playPuzyr, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

const h = 1 / 60, FLOOR = L.ROWS - 1;
// Арена: уровень 1 (ванна в центре, колонки 15–16), фаза play, без врагов; «якорь» (враг в вечном появлении) держит уровень незаконченным
function arena(opts = {}){
  const events = [];
  const game = Z.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  S.phase = 'play'; S.phaseT = 0; S.enemies = [];
  S.players.forEach(p => { p.inv = 0; });
  if (!opts.noAnchor){ const a = game._mkEnemy('cog', 3, 4); a.spawnT = 1e9; a.anchor = true; S.enemies.push(a); }
  return { game, S, events };
}
function run(game, sec, each){ for (let i = 0; i < Math.round(sec * 60); i++){ if (each) each(i); game.update(h); } }
function put(p, x, y, face){ p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.alive = true; p.inv = 0; p.ground = true; if (face) p.face = face; }
function enemyAt(game, S, type, x, y){ const e = game._mkEnemy(type, x, y); e.spawnT = 0; e.think = 1e9; e.hopT = 1e9; e.shotCd = 1e9; e.speed = 0; e.ground = true; S.enemies.push(e); return e; }
const live = S => S.enemies.filter(e => !e.anchor);
const has = (events, t) => events.some(x => x[0] === t);

// ---------- уровни и проходимость ----------
test('уровни: 30 + Котёл 31-м, 6 ручных карт, 5 зон, все 4 врага, у каждого уровня 1–3 ванны, потолок сплошной', () => {
  eq(L.LEVELS, 30); eq(Object.keys(L.HAND).map(Number), [1, 6, 12, 18, 24, 30]);
  const types = new Set(), zones = new Set();
  for (let n = 1; n <= 30; n++){
    const lv = L.level(n); lv.enemies.forEach(t => types.add(t)); zones.add(lv.zone);
    ok(lv.enemies.length >= 3 && lv.enemies.length <= 8, 'врагов на ' + n);
    const v = L.vatsOf(lv.vats); ok(v.length >= 1 && v.length <= 3, 'ванн на ' + n);
    for (let x = 0; x < L.COLS; x++) ok(lv.grid[L.idx(x, 0)], 'потолок ' + n + ':' + x);
    for (const q of v) for (let c = q.c0; c <= q.c1; c++) ok(!lv.grid[L.idx(c, FLOOR)], 'ванна в полу ' + n);
  }
  eq([...types].sort(), ['cog', 'soot', 'spark', 'spring']); eq(zones.size, 5);
  ok(L.level(31).boss, 'Котёл 31-м');
  for (const k of L.ZONES) ok(Z.STR.ru['z_' + k] && Z.STR.en['z_' + k], 'зона ' + k);
});
test('проходимость: все 31 карта — граф платформ сильно связен (каждое ребро — прогон физики), под героями пол, есть места врагам', () => {
  for (let n = 1; n <= 31; n++){ const v = L.validate(L.level(n).grid); ok(v.ok, 'уровень ' + n + ': ' + v.why); }
});
test('враги ставятся на платформы (не в воздух и не в ванну)', () => {
  for (let n = 1; n <= 30; n++){
    const { S } = arena({ level: n, noAnchor: true }); const g2 = Z.Game({ level: n, rng: mulberry32(n) }).start(), S2 = g2.state();
    for (const e of S2.enemies){ ok(e.fly || L.segAt(S2.segs, e.x, Math.round(e.y)), 'ур. ' + n + ' враг ' + e.type + ' @' + e.x.toFixed(1) + ',' + e.y); }
  }
});
test('переделка: прежней механики нет — ни шаров-ловушек, ни букв, ни спецшаров, ни сквозного прохода, ни «спешки»', () => {
  const { game, S } = arena();
  for (const k of ['bubbles', 'letters', 'items', 'specials', 'wind', 'hurry', 'angryAll']) ok(!(k in S), 'поле ' + k);
  for (const k of ['_mkBubble', 'blow']) ok(!(k in game), 'API ' + k);
  const p = S.players[0]; put(p, 15.5, 20); p.ground = false; run(game, 1);
  ok(!p.alive && p.why === 'vat', 'упал в проём — гибель в расплаве, а не появление сверху');
});

// ---------- пузырь и хлопок ----------
test('пузырь: удержание раздувает (заряд растёт), отпускание — хлопок с силой по заряду; передержал — лопается сам на полной', () => {
  const { game, S, events } = arena(), p = S.players[0]; put(p, 6, FLOOR, 1);
  game.setInput(0, 0, false, true); run(game, 0.2);
  ok(p.charging && p.charge > 0.15, 'раздувается'); ok(!has(events, 'blast'), 'ещё не хлопнул');
  game.setInput(0, 0, false, false); run(game, h);
  const b1 = events.find(x => x[0] === 'blast'); ok(b1, 'хлопок'); ok(b1[1].power > L.P_MIN && b1[1].power < 1, 'сила по заряду: ' + b1[1].power);
  run(game, 0.5); events.length = 0;
  game.setInput(0, 0, false, true); run(game, L.CHARGE_AUTO + 0.1);
  const b2 = events.find(x => x[0] === 'blast'); ok(b2 && b2[1].power === 1, 'сам на полной');
  eq(L.power(0), L.P_MIN); eq(L.power(L.CHARGE_MAX), 1); ok(L.blastRange(1) > L.blastRange(L.P_MIN) + 2, 'сила = дальность волны');
});
test('пузырь: раздувая на земле, герой стоит, но может повернуться; перезарядка между хлопками', () => {
  const { game, S, events } = arena(), p = S.players[0]; put(p, 6, FLOOR, 1);
  game.setInput(0, -1, false, true); run(game, 0.3);
  ok(Math.abs(p.x - 6) < 0.01, 'стоит'); eq(p.face, -1, 'повернулся');
  game.setInput(0, 0, false, false); run(game, h); ok(game.blast(0, 1) === false, 'перезарядка');
  run(game, 0.4); ok(game.blast(0, 1) === true, 'после перезарядки');
});
test('хлопок сдувает врага кувырком по направлению взгляда; сильнее — дальше; сзади и выше полосы — не задевает', () => {
  const dist = pw => { const { game, S } = arena(), p = S.players[0]; put(p, 4, FLOOR, 1); const e = enemyAt(game, S, 'cog', 6, FLOOR); game.blast(0, pw); ok(e.mode === 'tumble', 'кувырок'); run(game, 3); return e.x - 6; };
  const d1 = dist(L.P_MIN), d2 = dist(1); ok(d1 > 0.5 && d2 > d1 + 2, 'дальность ' + d1.toFixed(1) + ' / ' + d2.toFixed(1));
  const { game, S } = arena(), p = S.players[0]; put(p, 8, FLOOR, 1);
  const back = enemyAt(game, S, 'cog', 6, FLOOR), high = enemyAt(game, S, 'cog', 10, 15);
  game.blast(0, 1); eq([back.mode, high.mode], ['walk', 'walk']);
});
test('ванна: сдутый в проём враг переплавляется — очки 500; уровень пройден, когда переплавлены все', () => {
  const { game, S, events } = arena({ noAnchor: true }), p = S.players[0]; put(p, 12, FLOOR, 1);
  const e = enemyAt(game, S, 'cog', 13.6, FLOOR); game.blast(0, 1); run(game, 2.5);
  ok(!S.enemies.includes(e), 'враг исчез'); const m = events.find(x => x[0] === 'melt'); ok(m && m[1].score === L.MELT_PTS, 'очки');
  ok(S.phase === 'clear' && has(events, 'clear'), 'уровень пройден'); ok(S.timeBonus > 0, 'бонус за время');
  run(game, 4); eq(S.level, 2, 'следующий уровень');
});
test('комбо: переплав подряд (≤ 2,5 с) — 500 × номер в серии (до ×5)', () => {
  const { game, S, events } = arena();
  for (let i = 0; i < 3; i++) game._melt(enemyAt(game, S, 'cog', 10, FLOOR), S.vats[0]);
  eq(events.filter(x => x[0] === 'melt').map(x => x[1].score), [500, 1000, 1500]);
  run(game, 3); game._melt(enemyAt(game, S, 'cog', 10, FLOOR), S.vats[0]);
  eq(events.filter(x => x[0] === 'melt').pop()[1].score, 500, 'серия сброшена');
});
test('кегли: кувыркающийся враг сбивает другого (+100), оба летят; кувырком и оглушённые — безвредны', () => {
  const { game, S, events } = arena(), p = S.players[0]; put(p, 4, FLOOR, 1);
  const a = enemyAt(game, S, 'cog', 6, FLOOR), b = enemyAt(game, S, 'cog', 11.5, FLOOR);
  game.blast(0, 1); ok(b.mode === 'walk', 'вне волны'); run(game, 0.5);
  ok(b.mode === 'tumble' && has(events, 'knock'), 'сбит'); ok(S.score >= L.KNOCK_PTS, 'очки');
  const q = arena(), pp = q.S.players[0]; put(pp, 10, FLOOR); const d = enemyAt(q.game, q.S, 'cog', 10.2, FLOOR); d.mode = 'daze'; d.daze = 2;
  run(q.game, 0.3); ok(pp.alive, 'оглушённый не ранит');
});
test('о стену — оглушение и отскок; с уступа — на пол с оглушением', () => {
  const { game, S, events } = arena(), p = S.players[0]; put(p, 6, FLOOR, -1);
  const e = enemyAt(game, S, 'cog', 4, FLOOR); game.blast(0, 0.6); run(game, 0.35);
  ok(has(events, 'bonk'), 'удар о стену'); run(game, 2); ok(e.mode === 'daze' && S.enemies.includes(e), 'оглушён: ' + e.mode); ok(e.x > L.WL + 1, 'отскочил');
  const q = arena(); const pl = q.S.players[0]; put(pl, 3.5, 19, 1); const f = enemyAt(q.game, q.S, 'cog', 6, 19);
  q.game.blast(0, 1); run(q.game, 1.5); ok(Math.round(f.y) > 19, 'слетел с уступа'); ok(q.events.some(x => x[0] === 'ledge'), 'событие «с уступа»');
});
test('враг на ходу ранит; падение сверху на врага — отскок и оглушение; снизу сквозь платформу — отброс без вреда', () => {
  const { game, S, events } = arena(), p = S.players[0]; put(p, 10, FLOOR); enemyAt(game, S, 'cog', 10.3, FLOOR);
  run(game, 0.1); ok(!p.alive && events.some(x => x[0] === 'die' && x[1].why === 'enemy'), 'касание убивает');
  const q = arena(), pp = q.S.players[0], e = enemyAt(q.game, q.S, 'cog', 10, FLOOR);
  put(pp, 10, FLOOR - 2.2); pp.ground = false; pp.vy = 6; run(q.game, 0.3);
  ok(pp.alive && q.events.some(x => x[0] === 'bop'), 'отскок'); ok(e.mode === 'daze', 'оглушён');
  const r = arena(), pr = r.S.players[0]; enemyAt(r.game, r.S, 'cog', 7, 19);
  put(pr, 7, 20.6); pr.ground = false; pr.vy = -12; run(r.game, 0.5);
  ok(pr.alive, 'снизу — без вреда');
});
test('копоть: хлопок сбивает её на платформу — лежит, её можно сдуть; искрун: искру хлопок отбивает обратно и оглушает', () => {
  const { game, S } = arena(), p = S.players[0]; put(p, 6, FLOOR, 1);
  const s = enemyAt(game, S, 'soot', 8, FLOOR - 0.5); s.ground = false;
  game.blast(0, 1); ok(s.downed && s.mode === 'tumble', 'сбита'); run(game, 2); ok(s.ground || !S.enemies.includes(s), 'на полу или в ванне');
  const q = arena(), pp = q.S.players[0]; put(pp, 8, FLOOR, 1);
  const sp = enemyAt(q.game, q.S, 'spark', 16.5, 19); sp.mode = 'walk';
  q.S.shots.push({ x: 10.5, y: FLOOR - 0.7, vx: -5.5, vy: 0, t: 3, kind: 'spark', back: false });
  q.game.blast(0, 0.6); ok(q.S.shots[0] && q.S.shots[0].back && q.S.shots[0].vx > 0, 'искра отбита'); ok(pp.alive, 'жив');
});
test('искрун: замах, затем искра по горизонтали — она ранит', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 10, FLOOR); const e = enemyAt(game, S, 'spark', 18, FLOOR); e.dir = -1; e.shotCd = 0;
  run(game, 0.2); ok(e.charge > 0 && S.shots.length === 0, 'замах');
  run(game, 0.6); ok(S.shots.length === 1, 'выстрел');
  run(game, 1.6); ok(!p.alive && events.some(x => x[0] === 'die' && x[1].why === 'spark'), 'искра ранила');
});

// ---------- жизни, кооп, реклама ----------
test('жизни: −1, возрождение на старте с неуязвимостью; 0 — выбыл; все выбыли — gameover; +1 жизнь каждые EXTRA_LIFE', () => {
  const { game, S, events } = arena({ lives: 1 }), p = S.players[0]; put(p, 10, FLOOR); enemyAt(game, S, 'cog', 10.2, FLOOR);
  run(game, 0.1); ok(p.out && S.over && has(events, 'gameover'), 'конец игры');
  const q = arena(), pq = q.S.players[0]; put(pq, 10, FLOOR); enemyAt(q.game, q.S, 'cog', 10.2, FLOOR); run(q.game, 2);
  ok(pq.alive && pq.inv > 0 && pq.lives === 2, 'возрождение');
  const r = arena(); const l0 = r.S.players[0].lives; for (let i = 0; i < 7; i++) r.game._melt(enemyAt(r.game, r.S, 'cog', 10, FLOOR), r.S.vats[0]);
  ok(r.S.score >= L.EXTRA_LIFE && r.S.players[0].lives === l0 + 1 && r.events.some(x => x[0] === 'life'), '+1 жизнь: ' + r.S.score);
});
test('кооп: общий счёт, раздельные жизни, вход «на лету» и возврат выбывшего; «ещё шанс» и +1 жизнь за рекламу', () => {
  const { game, S, events } = arena({ players: 2 });
  ok(S.players.length === 2, 'двое'); S.players[1].out = true; S.players[1].alive = false; S.players[1].lives = 0;
  ok(game.join(1) && !S.players[1].out && S.players[1].lives === L.LIVES, 'вернулся');
  const one = arena(); ok(one.game.join(1) && one.S.players.length === 2 && one.events.some(x => x[0] === 'join'), 'И2 вошёл посреди уровня');
  const d = arena({ lives: 1 }); put(d.S.players[0], 10, FLOOR); enemyAt(d.game, d.S, 'cog', 10.2, FLOOR); run(d.game, 0.1);
  ok(d.S.over, 'конец'); ok(d.game.revive() && !d.S.over && d.S.players[0].alive && d.S.players[0].lives === L.LIVES, 'ещё шанс');
  ok(d.game.canBoost(), 'бонус доступен'); const lv = d.S.players[0].lives; d.game.boost(); eq(d.S.players[0].lives, lv + 1);
});
test('между уровнями: waitAfter → фаза rest (карточка с межстраничной), proceed — дальше', () => {
  const { game, S } = arena({ noAnchor: true, waitAfter: () => true });
  game._melt(enemyAt(game, S, 'cog', 10, FLOOR), S.vats[0]); run(game, 0.1); eq(S.phase, 'clear'); run(game, 4);
  eq(S.phase, 'rest'); eq(S.level, 1); ok(game.proceed()); eq(S.level, 2);
});
test('Котёл: плюётся каплями; капля, отбитая хлопком, летит в Котёл (−1); на нуле — падает в ванну, победа', () => {
  const { game, S, events } = arena({ level: 31, noAnchor: true }), B = S.boss, p = S.players[0];
  ok(B && B.hp === L.BOSS.hp, 'Котёл'); B.spawnT = 0; B.spitT = 0; run(game, h); ok(S.shots.some(s => s.kind === 'drop'), 'капли');
  S.shots = []; put(p, 10, FLOOR, 1); B.x = 22; B.y = 10; B.vx = 0; B.vy = 0; B.spitT = 1e9;
  S.shots.push({ x: 11.5, y: FLOOR - 1, vx: -3, vy: 1, t: 5, kind: 'drop', back: false });
  game.blast(0, 0.6); ok(S.shots[0].back, 'отбита'); run(game, 2, () => { B.vx = 0; B.vy = 0; }); ok(B.hp === L.BOSS.hp - 1 && has(events, 'bossHit'), 'попала: ' + B.hp);
  B.hp = 1; S.shots.push({ x: B.x, y: B.y - 1, vx: 0, vy: 0, t: 5, kind: 'drop', back: true }); run(game, h);
  ok(B.dying && has(events, 'bossFall'), 'падает'); run(game, 9); ok(has(events, 'bossDie') && S.won && has(events, 'win'), 'победа');
});

// ---------- кооп-ввод через движок ----------
function makeEnv(){
  const Lst = { cap: {}, late: {} }; let t = 1000;
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, Uint8Array, Int16Array, parseInt, parseFloat, Date,
    console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn, opt) { const b = (opt === true || (opt && opt.capture)) ? Lst.cap : Lst.late; (b[ev] = b[ev] || []).push(fn); },
    removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => t }, matchMedia: () => ({ matches: false })
  };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true, fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(read('engine.js'), win, { filename: 'engine.js' });
  vm.runInContext(read('js/game.js'), win, { filename: 'game.js' });
  const key = (type, code) => { const e = { type, code, repeat: false, preventDefault() {}, stopPropagation() {} }; (Lst.cap[type] || []).forEach(f => f(e)); (Lst.late[type] || []).forEach(f => f(e)); };
  return { win, A: win.Arcade, key, tick: ms => { t += ms; }, store: win.localStorage._d };
}
test('кооп-ввод: раскладки без конфликтов; Колба и Реторта управляются независимо; 1 игрок — обе раскладки ведут И1', () => {
  const env = makeEnv(), A = env.A, B = env.win.PUZYR.logic.BIND;
  eq(A.checkBindings(B, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }), [], 'конфликты раскладок');
  const g = A.createGame({ canvas: '#c', width: 640, height: 520, gameId: 'puzyr' });
  g.useStandardScreens({ lives: 3 });
  g.usePlayers({ bind: B, actions: ['jump', 'blow'], repeat: [] });
  g.scene('play', { realtime: true }); g.start('title');
  ok(g.menu.items('title').indexOf('players') === 1, 'пункт «Игроки» после «Играть»');
  env.key('keydown', 'Digit2'); env.key('keyup', 'Digit2'); eq(g.input.playerCount, 2);
  g.goto('play'); env.tick(200);
  const P1 = g.input.player(0), P2 = g.input.player(1);
  env.key('keydown', 'ArrowRight'); env.key('keydown', 'KeyA');
  eq([P1.dir.x, P2.dir.x], [1, -1], 'направления раздельно');
  env.key('keydown', 'Space'); ok(P1.pressed('blow') && !P2.pressed('blow'), 'пузырь И1'); env.key('keyup', 'Space');
  env.key('keydown', 'KeyF'); ok(P2.pressed('blow') && !P1.pressed('blow'), 'пузырь И2'); env.key('keyup', 'KeyF');
  // логика под этим вводом: герои бегут в разные стороны, И2 раздувает пузырь
  const Z2 = env.win.PUZYR, game = Z2.Game({ players: 2, rng: mulberry32(1) }).start(), S = game.state();
  S.phase = 'play'; S.enemies = [];
  env.key('keydown', 'KeyF');
  for (let i = 0; i < 30; i++){ for (let pi = 0; pi < 2; pi++){ const I = g.input.player(pi); game.setInput(pi, I.dir.x, I.pressed('jump'), I.pressed('blow')); } game.update(h); }
  ok(S.players[0].x > L.SPAWNS[0].x + 1.5, 'Колба вправо'); ok(S.players[1].charging, 'Реторта раздувает');
  env.key('keyup', 'ArrowRight'); env.key('keyup', 'KeyA'); env.key('keyup', 'KeyF');
  g.goto('title'); env.key('keydown', 'Digit1'); env.key('keyup', 'Digit1'); eq(g.input.playerCount, 1);
  g.goto('play'); env.tick(200);
  env.key('keydown', 'KeyD'); eq(P1.dir.x, 1); eq(P2.dir.x, 0); env.key('keyup', 'KeyD');
  eq(env.store['arcade.players.puzyr'], '1', 'выбор хранится');
});

// ---------- музыка, строки, страница, площадка, имена ----------
test('музыка: трек разбирается секвенсором движка, голоса кратны тактам', () => {
  const env = makeEnv();
  vm.runInContext(read('js/music.js'), env.win, { filename: 'music.js' });
  const tr = env.A.tracks.puzyr; ok(tr, 'трек зарегистрирован по gameId');
  const c = env.A.parseTrack(tr);
  eq(c.melody.length, 64); eq(c.bass.length, 32); eq(c.drums.length, 16);
});
test('строки: RU/EN/TR/ES/PT — одинаковый набор ключей, без пустых; названы враги и зоны; EN-название GLASSGUST', () => {
  const langs = ['ru', 'en', 'tr', 'es', 'pt'], ref = Object.keys(Z.STR.ru).sort();
  eq(Object.keys(Z.STR).sort(), langs.slice().sort());
  for (const l of langs){ eq(Object.keys(Z.STR[l]).sort(), ref, 'ключи ' + l); for (const k of ref) ok(String(Z.STR[l][k]).trim(), l + '.' + k); }
  Object.keys(L.ENEMY).forEach(k => langs.forEach(l => ok(Z.STR[l]['en_' + k], 'враг ' + k + ' ' + l)));
  eq(Z.STR.ru.title, 'ПУЗЫРЬ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(Z.STR[l].title, 'GLASSGUST');
});
test('страница: engine.js — копия общего, фавикон студии, «← Каталог», тач-пульт (бег, прыжок, пузырь, пауза), без внешних ссылок', () => {
  const html = read('index.html');
  eq(read('engine.js'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(/<link rel="icon" type="image\/svg\+xml"/.test(html), 'фавикон'); ok(/data-catalog-back="1"/.test(html), 'каталог');
  for (const d of ['L', 'R', 'U', 'A']) ok(html.includes('data-d="' + d + '"'), 'кнопка ' + d); ok(/data-pause="1"/.test(html), 'пауза');
  ok(!/(src|href)="https?:\/\//.test(html), 'нет внешних ссылок');
});
test('площадка: карточка «уровень пройден» с межстраничной, menuFit, рекорд прежним ключом (g.persist), ещё шанс и бонус, геймпад A/B', () => {
  const main = read('js/main.js');
  ok(/g\.adBreak\(\)/.test(main) && /g\.adReady\(\)/.test(main) && /waitAfter/.test(main), 'межстраничная по нажатию на карточке между уровнями');
  ok(/menuFit/.test(main), 'menuFit'); ok(/g\.persist\('arcade\.best\.puzyr', 'max'\)/.test(main), 'рекорд прежним ключом');
  ok(/useRewardedContinue/.test(main) && /useRewardedBonus/.test(main), 'реклама за награду');
  ok(/gamepad\.configure\(\{ actions: \{ a: 'jump', b: 'blow' \} \}\)/.test(main), 'геймпад');
  ok(/gameId: 'puzyr'/.test(main) && /usePlayers/.test(main), 'ключи сохранений прежние (arcade.best.puzyr, arcade.players.puzyr)');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'puzyr', boards: ['puzyr'], test, ok }); }
test('правило имён: в папке игры нет чужих названий игр/компаний/героев (регистронезависимо, с транслитом)', () => {
  // список чужих имён хранится в base64, чтобы сами имена не попадали в репозиторий открытым текстом
  const BAD = new RegExp(Buffer.from('YnViYmxlID9ib2JibGV80LHQsNCx0LsgP9Cx0L7QsXxwdXp6bGUgP2JvYmJsZXxcYmJ1YlxifFxiYm9iXGJ80LHQsNCx0LHQu9GD0L18YnViYmx1bnxib2JibHVufHJhaW5ib3cgP2lzbGFuZHN8cGFyYXNvbCA/c3RhcnN8c25vdyA/YnJvc3x0dW1ibGVwb3B8cGFjLT9tYW580L/QsNC60LzQsNC9fHRldHJpc3zRgtC10YLRgNC40YF8Z2FsYWd8Z2FsYXh8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofGRpZ2dlcnxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fHRhaXRvfNGC0LDQudGC0L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fFxic2VnYVxifNGB0LXQs9CwKD8hW9CwLdGP0ZFdKXx0ZWNtb3xkaXp6eXxkZWVwc2Vla3xtYXJpb3zQvNCw0YDQuNC+fHNvbmljfNGB0L7QvdC40Lo=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
});

// ---------- проходимость и баланс (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log(`\n${passed} passed, ${failed} failed (без баланса)`); process.exit(failed ? 1 : 0); }
test('проходимость: бот проходит каждый уровень по отдельности (31 уровень, лучший из 3 сидов)', () => {
  const bad = [];
  for (let n = 1; n <= 31; n++){ let okLv = false; for (const s of [1, 2, 3]){ if (playPuzyr(Z, s, { startLevel: n, levels: 1 }).passed) { okLv = true; break; } } if (!okLv) bad.push(n); }
  ok(!bad.length, 'не пройдены: ' + bad.join(', '));
});
test('бот: уровень 1 проходится ≥ 90 %, вся игра — ~20–45 % (60 прогонов)', () => {
  const N = 60; let l1 = 0, won = 0, stuck = 0, melts = 0;
  for (let s = 1; s <= N; s++){ const r = playPuzyr(Z, s); if (r.passed >= 1) l1++; if (r.won) won++; if (r.stuck) stuck++; }
  console.log(`     уровень 1: ${(100 * l1 / N).toFixed(0)} %, вся игра: ${(100 * won / N).toFixed(0)} %, застреваний: ${stuck}`);
  ok(l1 / N >= 0.9, 'уровень 1: ' + l1 / N);
  ok(won / N >= 0.15 && won / N <= 0.5, 'вся игра: ' + won / N);
  ok(stuck <= 2, 'застреваний: ' + stuck);
});
test('бот: кооп вдвоём проходит первые уровни', () => {
  let l2 = 0;
  for (let s = 1; s <= 10; s++){ const r = playPuzyr(Z, 100 + s, { players: 2, levels: 3 }); if (r.passed >= 2) l2++; }
  ok(l2 >= 7, 'кооп: 2 уровня из 3 пройдены в ' + l2 + '/10');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

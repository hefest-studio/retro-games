/* ПУЗЫРЬ · tests/engine.test.mjs — автотесты логики и обвязки (Node, без зависимостей).
   Запуск: node puzyr/tests/engine.test.mjs
   Логика (js/game.js) — в node:vm с шимом window; кооп-ввод — через движок (engine.js) с фейковым DOM.
   Бот (tests/bot.mjs) — «человеческий» игрок для баланса: уровень 1 ≥ 90 %, вся игра ~20–40 %. */
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

const h = 1 / 60;
// Арена: уровень 1, фаза play, без врагов; «якорь» держит уровень незаконченным
function arena(opts = {}){
  const events = [];
  const game = Z.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  S.phase = 'play'; S.phaseT = 0; S.enemies = []; S.bubbles = []; S.specialT = 1e9; S.letterT = 1e9;
  S.players.forEach(p => { p.inv = 0; });
  const anchor = game._mkBubble({ x: 3, y: 2, kind: 'plain' }); anchor.enemy = { type: 'cog', angry: false }; anchor.trapT = 1e9; anchor.anchor = true;
  return { game, S, events };
}
function run(game, sec, each){ for (let i = 0; i < Math.round(sec * 60); i++){ if (each) each(i); game.update(h); } }
function put(p, x, y){ p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.alive = true; p.inv = 0; p.ground = true; }
function enemyAt(game, S, type, x, y){ const e = game._mkEnemy(type, x, y); e.spawnT = 0; e.think = 1e9; e.hopT = 1e9; e.shotCd = 1e9; S.enemies.push(e); return e; }
const nonAnchor = S => S.bubbles.filter(b => !b.anchor);
const count = (ev, t) => ev.filter(e => e[0] === t).length;

// ---------- уровни и проходимость ----------
test('уровни: 30 + Котёл 31-м, 6 ручных карт, зоны и спецшары, все 4 врага, названия RU/EN', () => {
  eq(L.LEVELS, 30);
  ok(L.level(31).boss && !Array.from({ length: 30 }, (_, i) => L.level(i + 1)).some(l => l.boss), 'босс только 31-м');
  eq(Object.keys(L.HAND).length, 6, 'ручных карт');
  const types = new Set(), sp = new Set(), zones = new Set();
  for (let n = 1; n <= 31; n++){ const lv = L.level(n); lv.enemies.forEach(t => types.add(t)); lv.specials.forEach(s => sp.add(s)); zones.add(lv.zone); }
  eq([...types].sort(), ['cog', 'soot', 'spark', 'spring']);
  eq([...sp].sort(), ['bolt', 'fire', 'water']);
  zones.forEach(z => ok(Z.STR.ru['z_' + z] && Z.STR.en['z_' + z], 'нет названия зоны ' + z));
  ok(L.level(1).enemies.length >= 3 && L.level(30).enemies.length > L.level(1).enemies.length, 'врагов больше к концу');
});

test('проходимость: все 31 карта — граф платформ сильно связен, проём перекрыт, верх под точкой сбора есть', () => {
  for (let n = 1; n <= 31; n++){
    const lv = L.level(n), v = L.validate(lv.grid, L.windOf(lv.wind).gather);
    ok(v.ok, `ур.${n}: ${v.why}`);
  }
});

test('проходимость: каждое ребро графа подтверждено прогоном физики; враги ставятся на достижимые платформы', () => {
  let edges = 0;
  for (let n = 1; n <= 31; n++){
    const lv = L.level(n), segs = L.buildGraph(lv.grid);
    for (const A of segs) for (const e of A.edges){ edges++; eq(L.simEdge(lv.grid, segs, A, e), e.to, `ур.${n} ребро ${e.type} из ряда ${A.row}`); }
    const game = Z.Game({ rng: mulberry32(n), level: n, maxLevel: 31 }).start(), S = game.state();
    const spawn = L.segAt(S.segs, L.SPAWNS[0].x, L.ROWS - 1), r = L.reach(S.segs, spawn.id);
    S.enemies.filter(e => !e.fly).forEach(e => { const s = L.segAt(S.segs, e.x, Math.round(e.y)); ok(s && r[s.id], `ур.${n}: враг вне достижимой платформы`); });
  }
  ok(edges > 500, 'рёбер ' + edges);
});

test('проходимость: бот проходит каждый уровень по отдельности (31 уровень, лучший из 3 сидов)', () => {
  const bad = [];
  for (let n = 1; n <= 31; n++){
    let okN = false;
    for (let s = 1; s <= 3 && !okN; s++){ const r = playPuzyr(Z, 500 + n * 7 + s, { startLevel: n, levels: 1, lives: 5 }); okN = r.passed >= 1; }
    if (!okN) bad.push(n);
  }
  eq(bad, [], 'непройденные уровни');
});

// ---------- шары ----------
test('выдув: шар летит горизонтально (≈ RANGE клеток), затем всплывает к потолку и дрейфует к точке сбора', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 6, 23); p.face = 1;
  ok(game.blow(0)); ok(!game.blow(0), 'перезарядка');
  const b = nonAnchor(S)[0]; eq(b.phase, 'shoot'); ok(count(events, 'blow') === 1);
  run(game, 0.2);
  ok(b.x > 6 + 2.5 && Math.abs(b.y - (23 - L.PH / 2)) < 0.01, 'летит по горизонтали: ' + b.x.toFixed(2));
  run(game, 0.3); eq(b.phase, 'float'); ok(Math.abs(b.x - (6.9 + L.RANGE)) < 0.6, 'дальность ' + b.x.toFixed(2));
  const y0 = b.y; run(game, 1); ok(b.y < y0 - 1.5, 'всплывает');
  run(game, 9); ok(b.y <= L.CEIL_Y + 0.05, 'под потолком: ' + b.y.toFixed(2));
  ok(Math.abs(b.x - S.wind.gather) < 1.5, 'дрейф к точке сбора ' + S.wind.gather + ': ' + b.x.toFixed(2));
  run(game, L.EMPTY_LIFE); ok(!S.bubbles.includes(b), 'пустой шар со временем лопается сам');
});

test('потоки воздуха: зона уровня сносит всплывающий шар вбок', () => {
  const { game, S } = arena();
  S.wind = L.windOf('split');
  const b = game._mkBubble({ x: 4, y: 12 }); run(game, 1.5);
  ok(b.x > 5, 'левая зона гонит вправо: ' + b.x.toFixed(2));
});

test('захват: шар в фазе полёта ловит врага; враг в «появлении» не ловится', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 6, 23); p.face = 1;
  const e = enemyAt(game, S, 'cog', 9, 23);
  game.blow(0); run(game, 0.15);
  ok(!S.enemies.includes(e), 'враг исчез с поля');
  const b = nonAnchor(S)[0]; ok(b.enemy && b.enemy.type === 'cog', 'враг внутри шара'); eq(b.phase, 'float');
  ok(count(events, 'trap') === 1);
  const e2 = enemyAt(game, S, 'cog', 9, 23); e2.spawnT = 1; p.blowCd = 0; game.blow(0); run(game, 0.15);
  ok(S.enemies.includes(e2), 'появляющийся враг не пойман');
});

test('лопание: касание шара с врагом — 1000 очков, враг превращается в бонус, бонус падает и подбирается', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 6, 23);
  const b = game._mkBubble({ x: 6, y: 22.2 }); b.enemy = { type: 'spring', angry: false }; b.trapT = 9; b.life = 1e9;
  run(game, h * 2);
  ok(!S.bubbles.includes(b), 'лопнул'); eq(S.score, 1000);
  ok(count(events, 'pop') === 1 && S.items.length === 1, 'бонус появился');
  const it = S.items[0]; eq(it.kind, 'apple');
  put(p, 20, 23);
  run(game, 2.5); ok(it.ground, 'бонус упал на платформу');
  put(p, it.x, it.y); run(game, h * 2);
  eq(S.items.length, 0); eq(S.score, 1000 + it.score, 'бонус подобран');
});

test('цепочка: касание лопает все соприкасающиеся шары; очки 1000/2000/4000, бонусы дороже', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 20, 23);
  const bs = [10, 11.8, 13.6].map(x => { const b = game._mkBubble({ x, y: 12 }); b.enemy = { type: 'cog', angry: false }; b.trapT = 9; b.life = 1e9; return b; });
  const lone = game._mkBubble({ x: 20, y: 12 }); lone.life = 1e9;
  game._pop(bs[0], 0);
  ok(bs.every(b => !S.bubbles.includes(b)), 'вся цепочка лопнула'); ok(S.bubbles.includes(lone), 'далёкий шар цел');
  eq(events.filter(e => e[0] === 'pop').map(e => e[1].score), [1000, 2000, 4000]);
  eq(S.score, 7000); eq(S.chainBest, 3);
  ok(S.items.every(i => i.kind === 'plum'), 'цепочка из 3 — сливы (дороже яблок)');
  ok(S.bubbles.some(b => b.kind === 'letter'), 'цепочка из 3+ приносит букву');
});

test('озлобление: не лопнул вовремя — враг вырывается разозлённым и быстрее; по таймеру уровня злятся все', () => {
  const { game, S, events } = arena();
  const b = game._mkBubble({ x: 16, y: 12 }); b.enemy = { type: 'cog', angry: false }; b.trapT = 0.5; b.life = 1e9;
  run(game, 0.6);
  ok(!S.bubbles.includes(b) && count(events, 'escape') === 1, 'вырвался');
  const e = S.enemies[0]; ok(e && e.angry, 'разозлён');
  run(game, 1.5, () => {}); e.think = 1e9;
  const sp = Math.abs(e.vx); ok(Math.abs(sp - e.speed * L.ANGRY_K) < 0.01 || Math.abs(sp - e.speed * L.ANGRY_K * 0.8) < 0.01, 'скорость ×' + L.ANGRY_K + ': ' + sp);
  const t2 = arena(); const e2 = enemyAt(t2.game, t2.S, 'cog', 10, 19);
  t2.S.levelT = L.ANGRY_T - 0.05; run(t2.game, 0.1);
  ok(e2.angry && t2.S.angryAll && t2.events.some(x => x[0] === 'angry') && t2.S.hurry, 'сквозняк → все злые');
});

test('прыжок на шарах: падая на шар с зажатым прыжком — отскок (шар цел); без прыжка — лопается', () => {
  const { game, S, events } = arena(), p = S.players[0];
  const b = game._mkBubble({ x: 10, y: 10 }); b.life = 1e9;
  put(p, 10, 8.95); p.ground = false; p.vy = 4;
  game.setInput(0, 0, true); p.prevJump = true;
  run(game, 0.08);
  ok(S.bubbles.includes(b), 'шар цел'); ok(p.vy < -10, 'отскок вверх: ' + p.vy.toFixed(1)); ok(count(events, 'bounce') === 1);
  const b2 = game._mkBubble({ x: 20, y: 10 }); b2.life = 1e9;
  put(p, 20, 8.95); p.ground = false; p.vy = 4; game.setInput(0, 0, false);
  run(game, 0.08); ok(!S.bubbles.includes(b2), 'без прыжка — лопнул');
  const b3 = game._mkBubble({ x: 24, y: 20 }); b3.life = 1e9;
  put(p, 24, 23); game.setInput(0, 0, true); p.prevJump = false; run(game, 0.3);
  ok(!S.bubbles.includes(b3), 'прыжком снизу — лопнул');
});

test('сквозной проход: упал в проём пола — появился сверху и приземлился на платформу', () => {
  const { game, S } = arena(), p = S.players[0];
  put(p, 16, 23); p.ground = false; p.y = 23.05; p.vy = 5;
  let wrapped = false, minY = 99;
  run(game, 2, () => { if (p.y < 5) wrapped = true; minY = Math.min(minY, p.y); });
  ok(wrapped, 'прошёл сквозь низ наверх'); ok(p.ground && p.y < 23, 'стоит на платформе: ' + p.y.toFixed(2));
  const lv = L.level(1); ok(L.segAt(L.buildGraph(lv.grid), p.x, Math.round(p.y)), 'на сегменте');
});

test('спецшары: ЖАР выжигает платформу, ЛИВЕНЬ смывает врагов по пути, ГРОЗА бьёт по горизонтали', () => {
  // ЖАР: падает на платформу под шаром, враги на ней гибнут → бонусы
  let t = arena(); const pl = t.S.players[0]; put(pl, 26, 23);
  const e1 = enemyAt(t.game, t.S, 'cog', 9, 19); e1.speed = 0;
  const f = t.game._mkBubble({ x: 8, y: 17, kind: 'fire' }); t.game._pop(f, 0);
  run(t.game, 1.2);
  ok(!t.S.enemies.includes(e1), 'жар сжёг врага'); ok(count(t.events, 'zap') === 1 && t.S.items.length === 1, 'бонус из врага');
  // ЛИВЕНЬ: поток по полу смывает врага
  t = arena(); put(t.S.players[0], 26, 23); t.S.players[0].face = 1;
  const e2 = enemyAt(t.game, t.S, 'cog', 9, 23); e2.speed = 0;
  const w = t.game._mkBubble({ x: 4, y: 21, kind: 'water' }); t.game._pop(w, 0);
  run(t.game, 1.5); ok(!t.S.enemies.includes(e2), 'ливень смыл врага');
  // ГРОЗА: молния летит в сторону взгляда и бьёт врага на своей высоте, дальнего по вертикали — нет
  t = arena(); const p3 = t.S.players[0]; put(p3, 26, 23); p3.face = -1;
  const e3 = enemyAt(t.game, t.S, 'soot', 8, 12.7); e3.speed = 0; const e4 = enemyAt(t.game, t.S, 'cog', 8, 19); e4.speed = 0;
  const bo = t.game._mkBubble({ x: 20, y: 12, kind: 'bolt' }); t.game._pop(bo, 0);
  run(t.game, 0.8); ok(!t.S.enemies.includes(e3) && t.S.enemies.includes(e4), 'молния — только по своей высоте');
});

test('буквы: шесть букв ГЕФЕСТ дают +1 жизнь лопнувшему и обнуляют слово', () => {
  const { game, S, events } = arena();
  eq(L.WORD_LEN, 6); eq(Z.STR.ru.word.length, 6); eq(Z.STR.en.word.length, 6);
  const lives = S.players[0].lives;
  for (let i = 0; i < 6; i++){ const b = game._mkBubble({ x: 6 + i * 3, y: 10, kind: 'letter', letter: i }); game._pop(b, 0); if (i < 5) ok(S.letters[i], 'буква ' + i); }
  eq(S.players[0].lives, lives + 1); ok(S.letters.every(v => !v), 'слово обнулено');
  ok(count(events, 'word') === 1 && count(events, 'letter') === 6);
  // буква в шаре не дублирует собранную
  S.letters = [true, true, true, true, true, false]; S.bubbles = []; game._spawnLetter();
  eq(S.bubbles.find(b => b.kind === 'letter').letter, 5);
});

test('касание врага убивает; жизнь −1, возрождение на старте с неуязвимостью; 0 жизней — выбыл, все выбыли — gameover', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 10, 23); enemyAt(game, S, 'cog', 10.3, 23);
  run(game, h * 2); ok(!p.alive && p.lives === 2, 'погиб');
  S.enemies = []; run(game, 2); ok(p.alive && p.inv > 0 && Math.abs(p.x - L.SPAWNS[0].x) < 0.01, 'возрождение');
  p.lives = 1; p.inv = 0; put(p, 10, 23); enemyAt(game, S, 'cog', 10.2, 23); run(game, h * 2);
  ok(p.out && S.over && count(events, 'gameover') === 1, 'gameover');
});

test('кооп: общий счёт, раздельные жизни; один выбыл — игра идёт', () => {
  const { game, S } = arena({ players: 2 }), [p1, p2] = S.players;
  put(p1, 6, 23); put(p2, 26, 23);
  const b1 = game._mkBubble({ x: 6, y: 22.2 }); b1.enemy = { type: 'cog', angry: false }; b1.trapT = 9; b1.life = 1e9;
  const b2 = game._mkBubble({ x: 26, y: 22.2 }); b2.enemy = { type: 'cog', angry: false }; b2.trapT = 9; b2.life = 1e9;
  run(game, h * 2); eq(S.score, 2000, 'общий счёт');
  p2.lives = 1; enemyAt(game, S, 'cog', 26, 23); run(game, h * 2);
  ok(p2.out && !S.over && p1.lives === 3, 'И2 выбыл, И1 играет');
});

test('вход «на лету»: И2 появляется посреди уровня; выбывший возвращается с полным запасом', () => {
  const { game, S, events } = arena();
  eq(S.players.length, 1);
  ok(game.join(1)); eq(S.players.length, 2); ok(count(events, 'join') === 1);
  const p2 = S.players[1]; ok(p2.alive && p2.lives === L.LIVES && p2.inv > 0 && Math.abs(p2.x - L.SPAWNS[1].x) < 0.01);
  ok(!game.join(1), 'уже в игре');
  p2.out = true; p2.alive = false; p2.lives = 0; ok(game.join(1) && !p2.out && p2.lives === L.LIVES, 'вернулся');
  // ввод независим: И2 бежит влево, И1 стоит
  put(S.players[0], 6, 23); put(p2, 26, 23); game.setInput(1, -1, false); game.setInput(0, 0, false);
  run(game, 0.3); ok(p2.x < 25 && Math.abs(S.players[0].x - 6) < 1e-6);
});

test('за каждые EXTRA_LIFE очков — +1 жизнь каждому, кто в игре', () => {
  const { game, S, events } = arena({ players: 2 });
  S.score = L.EXTRA_LIFE - 5; const b = game._mkBubble({ x: 16, y: 12 }); game._pop(b, 0);
  eq(S.players.map(p => p.lives), [4, 4]); ok(count(events, 'life') === 1);
});

test('уровень пройден, когда врагов нет ни снаружи, ни в шарах; затем следующий уровень', () => {
  const { game, S, events } = arena();
  S.bubbles = []; run(game, h);
  eq(S.phase, 'clear'); run(game, 4); eq(S.level, 2); eq(S.phase, 'ready');
  ok(count(events, 'clear') === 1 && count(events, 'level') === 2);
});

test('Котёл: бьют молнии ГРОЗЫ (в лоб) и шары; на нуле — в большом шаре, касание — победа и win', () => {
  const events = [];
  const game = Z.Game({ rng: mulberry32(3), level: 31, maxLevel: 31, onEvent: (t, d) => events.push([t, d]) }).start(), S = game.state();
  S.phase = 'play'; S.specialT = 1e9; S.letterT = 1e9;
  const B = S.boss; B.spawnT = 0; B.spitT = 1e9; B.vx = B.vy = 0; B.x = 16; B.y = 10;
  const p = S.players[0]; put(p, 4, 23); p.inv = 1e9;
  const hp0 = B.hp;
  const bo = game._mkBubble({ x: 6, y: 20, kind: 'bolt' }); game._pop(bo, 0); run(game, 1.0);
  eq(B.hp, hp0 - L.BOSS.boltDmg, 'молния летит в Котёл');
  const sb = game._mkBubble({ x: 11, y: 8, vx: 15, phase: 'shoot', owner: 0 }); run(game, 0.3);
  eq(B.hp, hp0 - L.BOSS.boltDmg - L.BOSS.bubbleDmg, 'шар бьёт слабее');
  ok(!S.bubbles.includes(sb));
  B.hp = 1; B.inv = 0; const bo2 = game._mkBubble({ x: 6, y: 20, kind: 'bolt' }); game._pop(bo2, 0); run(game, 0.6);
  ok(B.trapped && count(events, 'bossTrap') === 1, 'Котёл в шаре');
  put(p, B.x, B.y); p.inv = 0; run(game, h * 2);
  ok(!B.alive && count(events, 'bossDie') === 1, 'лопнул');
  run(game, 6); ok(S.won && S.over && count(events, 'win') === 1, 'победа');
});

test('Котёл плюётся расплавом; выдутый шар гасит каплю', () => {
  const game = Z.Game({ rng: mulberry32(3), level: 31, maxLevel: 31 }).start(), S = game.state();
  S.phase = 'play'; S.specialT = 1e9; const B = S.boss; B.spawnT = 0; B.spitT = 0.01; B.vx = B.vy = 0;
  S.players[0].inv = 1e9; run(game, h * 2);
  ok(S.shots.length >= 3 && S.shots.every(s => s.kind === 'drop'), 'веер капель');
  const s0 = S.shots[0]; const b = game._mkBubble({ x: s0.x, y: s0.y, phase: 'shoot', vx: 1, owner: 0 }); run(game, h);
  ok(!S.shots.includes(s0), 'капля погашена');
});

test('искрун: замах 0,45 с, затем искра по горизонтали — она убивает', () => {
  const { game, S, events } = arena(), p = S.players[0];
  put(p, 12, 23); const e = enemyAt(game, S, 'spark', 20, 23); e.dir = -1; e.shotCd = 0; e.speed = 0;
  run(game, 0.2); ok(e.charge > 0 && S.shots.length === 0, 'замах');
  run(game, 0.4); ok(S.shots.length === 1, 'выстрел');
  run(game, 1.5); ok(!p.alive && events.some(x => x[0] === 'die' && x[1].why === 'spark'), 'искра убила');
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
  g.usePlayers({ bind: B, actions: ['blow'], repeat: [] });
  g.scene('play', { realtime: true }); g.start('title');
  ok(g.menu.items('title').indexOf('players') === 1, 'пункт «Игроки» после «Играть»');
  env.key('keydown', 'Digit2'); env.key('keyup', 'Digit2'); eq(g.input.playerCount, 2);
  g.goto('play'); env.tick(200);
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  env.key('keydown', 'ArrowRight'); env.key('keydown', 'KeyA');
  eq([P1.dir.x, P2.dir.x], [1, -1], 'направления раздельно');
  env.key('keydown', 'ArrowUp'); ok(P1.pressed('jump') && !P2.pressed('jump'), 'прыжок И1'); env.key('keyup', 'ArrowUp');
  env.key('keydown', 'KeyW'); ok(P2.pressed('jump') && !P1.pressed('jump'), 'прыжок И2'); env.key('keyup', 'KeyW');
  env.key('keyup', 'ArrowRight'); env.key('keyup', 'KeyA');
  env.key('keydown', 'Space'); env.key('keyup', 'Space'); env.key('keydown', 'KeyF'); env.key('keyup', 'KeyF');
  eq(got, ['1blow', '2blow'], 'шар по игрокам');
  // логика под этим вводом: герои бегут в разные стороны
  const Z2 = env.win.PUZYR, game = Z2.Game({ players: 2, rng: mulberry32(1) }).start(), S = game.state();
  S.phase = 'play'; S.enemies = [];
  env.key('keydown', 'ArrowRight'); env.key('keydown', 'KeyA');
  for (let i = 0; i < 30; i++){ for (let pi = 0; pi < 2; pi++){ const I = g.input.player(pi); game.setInput(pi, I.dir.x, I.pressed('jump')); } game.update(h); }
  ok(S.players[0].x > L.SPAWNS[0].x + 1.5, 'Колба вправо'); ok(S.players[1].x < L.SPAWNS[1].x - 1.5, 'Реторта влево');
  env.key('keyup', 'ArrowRight'); env.key('keyup', 'KeyA');
  // один игрок: WASD тоже ведёт И1
  g.goto('title'); env.key('keydown', 'Digit1'); env.key('keyup', 'Digit1'); eq(g.input.playerCount, 1);
  g.goto('play'); env.tick(200);
  env.key('keydown', 'KeyD'); eq(P1.dir.x, 1); eq(P2.dir.x, 0); env.key('keyup', 'KeyD');
  eq(env.store['arcade.players.puzyr'], '1', 'выбор хранится');
});

// ---------- музыка, строки, имена ----------
test('музыка: трек разбирается секвенсором движка, голоса кратны тактам', () => {
  const env = makeEnv();
  vm.runInContext(read('js/music.js'), env.win, { filename: 'music.js' });
  const tr = env.A.tracks.puzyr; ok(tr, 'трек зарегистрирован по gameId');
  const c = env.A.parseTrack(tr);
  eq(c.melody.length, 64); eq(c.bass.length, 32); eq(c.drums.length, 16);
});

test('строки: RU/EN — одинаковый набор ключей, названы враги, спецшары и зоны', () => {
  eq(Object.keys(Z.STR.ru).sort(), Object.keys(Z.STR.en).sort());
  Object.keys(L.ENEMY).forEach(k => ok(Z.STR.ru['en_' + k] && Z.STR.en['en_' + k], 'враг ' + k));
  L.SPECIALS.forEach(k => ok(Z.STR.ru['sp_' + k] && Z.STR.en['sp_' + k], 'спецшар ' + k));
});

test('правило имён: в папке игры нет чужих названий игр/компаний/героев (регистронезависимо, с транслитом)', () => {
  // список чужих имён хранится в base64, чтобы сами имена не попадали в репозиторий открытым текстом
  const BAD = new RegExp(Buffer.from('YnViYmxlID9ib2JibGV80LHQsNCx0LsgP9Cx0L7QsXxwdXp6bGUgP2JvYmJsZXxcYmJ1YlxifFxiYm9iXGJ80LHQsNCx0LHQu9GD0L18YnViYmx1bnxib2JibHVufHJhaW5ib3cgP2lzbGFuZHN8cGFyYXNvbCA/c3RhcnN8c25vdyA/YnJvc3x0dW1ibGVwb3B8cGFjLT9tYW580L/QsNC60LzQsNC9fHRldHJpc3zRgtC10YLRgNC40YF8Z2FsYWd8Z2FsYXh8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofGRpZ2dlcnxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fHRhaXRvfNGC0LDQudGC0L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fFxic2VnYVxifNGB0LXQs9CwKD8hW9CwLdGP0ZFdKXx0ZWNtb3xkaXp6eXxkZWVwc2Vla3xtYXJpb3zQvNCw0YDQuNC+fHNvbmljfNGB0L7QvdC40Lo=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md)$/.test(f));
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
});

// ---------- баланс (бот) ----------
test('бот: уровень 1 проходится ≥ 90 %, вся игра — ~20–40 % (60 прогонов)', () => {
  const N = 60; let l1 = 0, won = 0, stuck = 0;
  for (let s = 1; s <= N; s++){ const r = playPuzyr(Z, s); if (r.passed >= 1) l1++; if (r.won) won++; if (r.stuck) stuck++; }
  console.log(`     уровень 1: ${(100 * l1 / N).toFixed(0)} %, вся игра: ${(100 * won / N).toFixed(0)} %, застреваний: ${stuck}`);
  ok(l1 / N >= 0.9, 'уровень 1: ' + l1 / N);
  ok(won / N >= 0.15 && won / N <= 0.45, 'вся игра: ' + won / N);
});

test('бот: кооп вдвоём проходит первые уровни', () => {
  let l2 = 0;
  for (let s = 1; s <= 10; s++){ const r = playPuzyr(Z, 100 + s, { players: 2, levels: 3 }); if (r.passed >= 2) l2++; }
  ok(l2 >= 7, 'кооп: 2 уровня из 3 пройдены в ' + l2 + '/10');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

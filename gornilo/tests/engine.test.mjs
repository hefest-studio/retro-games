/* ГОРНИЛО · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node gornilo/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: карта комнат (связность, ветки 2–3, длина пути), «два стика» (ходьба и огонь раздельно, 8 сторон),
   оружие на время (веер, горн, гранаты, диски, кольцо, молоты), враги (болванки, самоходки, турели, щитовики, катки),
   волны и зачистка, ворота-выходы и переход, босс с разрушаемыми узлами, жизни/продолжения/рекорд, кооп,
   производительность на пике толпы, раскладки без конфликтов, i18n, музыка, страница, правило имён;
   баланс и проходимость — «человеческим» ботом (tests/bot.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/game.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const G = sandbox.GORNILO, L = G.logic;
const { playGornilo, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Пустая арена без волн: комната «толпа» с планировкой layout, герои у южных ворот
function setup(opts = {}){
  const events = [];
  const room = { l: 1, c: 1, kind: opts.kind || 'crowd', reward: opts.reward || null, danger: 1, layout: opts.layout || 0, exits: opts.exits || { N: { l: 2, c: 1 }, W: { l: 2, c: 0 } } };
  const map = L.genStage(1, 1); map.layers[1][1] = Object.assign(map.layers[1][1] || {}, room);
  const game = G.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]), waves: opts.waves || (() => []) }, opts)).start();
  const S = game._S;
  game._loadRoom(map.layers[1][1], 'S'); S.map = map;
  S.banner = 0; S.heroes.forEach(h => { h.inv = 0; });
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
function fight(S){ S.roomState = 'fight'; S.roomT = 5; }

// ---------- Карта комнат ----------
test('карта: 3 круга × 8 слоёв по ≤ 3 комнаты + босс; из старта достижимы все комнаты и босс, из любой — босс; путь = 8 комнат + босс', () => {
  for (let n = 1; n <= 3; n++) for (let seed = 0; seed < 25; seed++){
    const M = L.genStage(n, seed), r = L.solveMap(M);
    ok(r.ok, 'круг ' + n + ', сид ' + seed + ': ' + JSON.stringify(r));
    eq([r.minLen, r.maxLen], [L.LAYERS, L.LAYERS], 'длина пути');
    eq(M.layers.length, L.LAYERS); ok(M.layers[0][1] && !M.layers[0][0] && !M.layers[0][2], 'старт один, по центру');
    M.layers.forEach((row, l) => row.forEach(rm => { if (rm){ const k = Object.keys(rm.exits); ok(k.length >= 1 && k.length <= 3, 'выходы ' + k); ok(k.every(g => ['W', 'N', 'E'].includes(g))); if (l === L.LAYERS - 1) eq(k, ['N'], 'последний слой — к боссу'); } }));
  }
  eq(JSON.stringify(L.genStage(2, 5)), JSON.stringify(L.genStage(2, 5)), 'генератор детерминирован');
  ok(JSON.stringify(L.genStage(2, 5)) !== JSON.stringify(L.genStage(2, 6)), 'сид меняет карту');
  const M = L.genStage(1, 3); M.layers.forEach(row => row.forEach(rm => { if (rm && rm.l === 3) rm.exits = {}; }));
  ok(!L.solveMap(M).ok, 'обрыв в слое 3 — карта несвязна');
});
test('карта: выбор пути — у большинства комнат 2–3 ветки, есть награды и разные виды комнат', () => {
  let rooms = 0, multi = 0; const kinds = new Set(), rewards = new Set();
  for (let n = 1; n <= 3; n++) for (let seed = 0; seed < 20; seed++){
    const M = L.genStage(n, seed);
    M.layers.forEach((row, l) => row.forEach(rm => { if (!rm) return; kinds.add(rm.kind); rewards.add(rm.reward); if (l < L.LAYERS - 1){ rooms++; if (Object.keys(rm.exits).length >= 2) multi++; } }));
  }
  ok(multi / rooms >= 0.85, 'веток мало: ' + multi + '/' + rooms);
  ['crowd', 'blast', 'turret', 'shield', 'roller', 'mixed', 'vault'].forEach(k => ok(kinds.has(k), 'нет вида ' + k));
  ['weapon', 'gold', 'life'].forEach(k => ok(rewards.has(k), 'нет награды ' + k));
});

// ---------- Два стика ----------
test('ходьба: 8 сторон, по диагонали не быстрее; стены и наковальни держат', () => {
  const { game, S } = setup({ layout: 3 });
  const h = S.heroes[0]; h.x = 200; h.y = 380; const x0 = h.x;
  game.setMove(0, 1, 0); run(game, 0.5); near(h.x - x0, L.SPEED * 0.5, 2, 'вправо');
  game.setMove(0, -1, -1); const x1 = h.x, y1 = h.y; run(game, 0.2); near(Math.hypot(h.x - x1, h.y - y1), L.SPEED * 0.2, 2, 'диагональ');
  game.setMove(0, 0, 1); run(game, 3); near(h.y, L.IY1 - L.HERO_R, 0.5, 'нижняя стена');
  h.x = 320; h.y = 330; game.setMove(0, 0, -1); run(game, 2); ok(h.y >= 276 + L.HERO_R - 0.5, 'прошёл сквозь наковальню: ' + h.y);
  game.setMove(0, 0, 0);
});
test('огонь раздельно: идём вправо — стреляем вверх; 8 направлений стрельбы; без «стика огня» — тишина', () => {
  const { game, S } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 300;
  game.setMove(0, 1, 0); game.setAim(0, 0, -1); run(game, 0.5);
  ok(S.bullets.length >= 3 && S.bullets.every(b => b.vy < 0 && Math.abs(b.vx) < 1), 'пули не вверх');
  ok(h.x > 360, 'не шёл вправо');
  for (const [ax, ay] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]){
    S.bullets = []; h.cd = 0; game.setAim(0, ax, ay); game.update(1 / 60);
    const b = S.bullets[0]; near(Math.atan2(b.vy, b.vx), Math.atan2(ay, ax), 0.01, 'направление ' + ax + ',' + ay);
  }
  S.bullets = []; game.setAim(0, 0, 0); game.setMove(0, 0, 0); run(game, 0.5); eq(S.bullets.length, 0, 'стреляет сам');
});

// ---------- Оружие ----------
test('оружие на время: веер (5 пуль), горн пробивает толпу, гранаты рвутся по площади, диски отскакивают; по таймеру — назад к клёпочнику', () => {
  const { game, S, has } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 400; fight(S);
  game._drop(h.x, h.y, 'fan'); game.update(1 / 60); eq(h.weapon, 'fan'); ok(has('power'));
  h.cd = 0; S.bullets = []; game.setAim(0, 0, -1); game.update(1 / 60); eq(S.bullets.length, 5, 'веер');
  game.setAim(0, 0, 0); h.weapon = 'flame'; h.wT = 5; S.bullets = [];
  const row = [0, 1, 2, 3].map(k => game._spawn('blank', 320, 370 - k * 18)); row.forEach(e => { e.speed = 0; });
  game.setAim(0, 0, -1); run(game, 0.6); game.setAim(0, 0, 0);
  ok(row.filter(e => e.dead).length >= 3, 'горн не пробил ряд: ' + row.filter(e => e.dead).length);
  h.weapon = 'grenade'; h.wT = 5; h.cd = 0; S.bullets = [];
  const pack = [0, 1, 2, 3, 4].map(k => game._spawn('shield', 300 + k * 10, 400 - L.GUN.grenade.range)); pack.forEach(e => { e.speed = 0; e.ang = Math.PI / 2; });
  game.setAim(0, 0, -1); game.update(1 / 60); game.setAim(0, 0, 0); run(game, 0.8);
  ok(pack.every(e => e.hp < e.max || e.dead), 'граната не накрыла группу (и щиты её не держат)'); ok(has('boom'));
  h.weapon = 'disc'; h.wT = 5; h.cd = 0; S.bullets = []; h.x = 320; h.y = 240;
  game.setAim(0, 1, 0); game.update(1 / 60); game.setAim(0, 0, 0);
  run(game, 0.8); ok(has('bounce') && S.bullets.length === 1 && S.bullets[0].vx < 0, 'диск не отскочил от стены');
  h.weapon = 'fan'; h.wT = 0.1; run(game, 0.2); eq(h.weapon, 'base', 'таймер оружия'); ok(has('powerEnd'));
});
test('кольцевой щит: пули гаснут, мелочь разбивается о кольцо, герой цел; молоты кружат и бьют', () => {
  const { game, S } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 300; fight(S);
  game._drop(h.x, h.y, 'ring'); game.update(1 / 60); ok(h.ring > 0);
  S.ebullets.push({ x: 320, y: 200, vx: 0, vy: 200, r: 4, kind: 'shot', life: 5 });
  const b = game._spawn('blank', 360, 300); const r = game._spawn('runner', 280, 300);
  run(game, 1); ok(h.alive, 'кольцо не спасло'); ok(b.dead && r.dead, 'мелочь цела'); eq(S.ebullets.length, 0);
  h.ring = 0; game._drop(h.x, h.y, 'hammers'); game.update(1 / 60); ok(h.hammers > 0);
  const t = game._spawn('turret', h.x + 46, h.y); t.rise = 0; t.cd = 99; const hp = t.hp;
  run(game, 1.5); ok(t.hp < hp || t.dead, 'молоты не бьют');
});

// ---------- Враги ----------
test('болванки идут на героя толпой и не слипаются; касание — гибель (−жизнь), возрождение у входа с неуязвимостью и «искрой»', () => {
  const { game, S, has, events } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 380; fight(S);
  const crowd = []; for (let k = 0; k < 20; k++) crowd.push(game._spawn('blank', 100 + (k % 10) * 44, 80 + Math.floor(k / 10) * 30));
  run(game, 1.2);
  ok(crowd.every(e => e.y > 80), 'не идут');
  let overlap = 0; for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) if (Math.hypot(crowd[i].x - crowd[j].x, crowd[i].y - crowd[j].y) < 8) overlap++;
  ok(overlap <= 2, 'слиплись: ' + overlap);
  let near0 = -1; run(game, 6, () => { if (near0 < 0 && has('respawn')) near0 = S.enemies.filter(e => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) < 80).length; });
  ok(has('heroDie') && h.lives < L.LIVES, 'касание не убило');
  ok(has('respawn') && h.alive, 'не возродился'); eq(near0, 0, 'искра не разметала мелочь у входа');
  const rp = events.find(e => e[0] === 'respawn'); ok(rp, 'нет события');
});
test('самоходка: рядом поджигает фитиль и рвётся (гибель героя); подстреленная рвётся сразу и цепляет соседей', () => {
  const a = setup(); const h = a.S.heroes[0]; h.x = 320; h.y = 300; fight(a.S);
  const r = a.game._spawn('runner', 320, 200); run(a.game, 1.3); ok(r.dead && a.has('fuse'), 'не рванула'); ok(a.has('heroDie') && a.last('heroDie').src === 'blast', 'взрыв не убил');
  const b = setup(); const h2 = b.S.heroes[0]; h2.x = 320; h2.y = 420; fight(b.S);
  const r1 = b.game._spawn('runner', 320, 140), bl = [0, 1, 2].map(k => b.game._spawn('blank', 300 + k * 20, 120));
  [r1, ...bl].forEach(e => { e.speed = 0; });
  b.game.setAim(0, 0, -1); run(b.game, 0.8); b.game.setAim(0, 0, 0);
  ok(r1.dead && bl.filter(e => e.dead).length >= 2, 'цепочка: ' + bl.filter(e => e.dead).length); ok(h2.alive, 'далеко — цел');
});
test('турель: встаёт из люка, вспышка-предупреждение, потом выстрел в героя; в люке неуязвима', () => {
  const { game, S, has } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 400; fight(S);
  const t = game._spawn('turret', 160, 128); t.cd = 0.1; const hp = t.hp;
  S.bullets.push({ k: 'b', pi: 0, x: 160, y: 160, vx: 0, vy: -500, dmg: 1, r: 3, life: 1 }); game.update(1 / 60); game.update(1 / 60);
  eq(t.hp, hp, 'попали в поднимающуюся');
  let warned = false; run(game, 2, () => { if (t.warn > 0 && !S.ebullets.length) warned = true; });
  ok(warned, 'нет предупреждения'); ok(has('eshot') && (S.ebullets.length || !h.alive), 'не стреляла');
});
test('щитовик: пули в щит гаснут, сзади — урон; касание не убивает, а отталкивает, после толчка щит «раскрыт»', () => {
  const { game, S, has } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 400; fight(S);
  const s = game._spawn('shield', 320, 250); s.speed = 0; s.ang = Math.PI / 2;
  game.setAim(0, 0, -1); run(game, 0.5); game.setAim(0, 0, 0);
  eq(s.hp, s.max, 'щит пробит в лоб'); ok(has('block'));
  S.bullets.push({ k: 'b', pi: 0, x: 320, y: 200, vx: 0, vy: 500, dmg: 1, r: 3, life: 1 }); run(game, 0.2);
  ok(s.hp < s.max, 'сзади не берёт');
  s.speed = 40; s.hp = 99; h.x = 320; h.y = 280; let opened = false; run(game, 1.2, () => { opened = opened || s.stun > 0; });
  ok(h.alive && has('shove'), 'толчок убил или не случился');
  ok(opened, 'не раскрылся');
});
test('каток: разгон с предупреждением, таран по прямой, удар о стену — оглушение; давит своих; касание — гибель', () => {
  const { game, S, has } = setup();
  const h = S.heroes[0]; h.x = 320; h.y = 400; h.inv = 99; fight(S);
  const r = game._spawn('roller', 320, 120); r.cd = 0.05;
  const victim = game._spawn('blank', 320, 220); victim.speed = 0;
  let wind = false, charge = false, stun = false;
  run(game, 3, () => { wind = wind || r.state === 'wind'; charge = charge || r.state === 'charge'; stun = stun || r.state === 'stun'; });
  ok(wind && charge && stun, 'фазы катка: ' + [wind, charge, stun]); ok(has('windup') && has('charge') && has('thud'));
  ok(victim.dead, 'не раздавил болванку');
  h.inv = 0; h.x = r.x; h.y = r.y + 10; game.update(1 / 60); ok(!h.alive, 'касание катка не убило');
});

// ---------- Комнаты, волны, ворота ----------
test('комната: волны из ворот, зачистка открывает выходы, награда выпадает; в закрытые ворота не выйти', () => {
  const { game, S, has } = setup({ waves: () => [[{ type: 'blank', n: 6, gate: 'all' }], [{ type: 'blank', n: 4, gate: 'N' }]], reward: 'weapon' });
  game._loadRoom(S.room, 'S'); S.heroes[0].inv = 99;
  const h = S.heroes[0];
  h.x = 320; h.y = L.IY0 + 12; game.setMove(0, 0, -1); run(game, 0.5); ok(h.y >= L.IY0 + L.HERO_R - 0.1, 'вышел в закрытые ворота');
  game.setMove(0, 0, 0); h.x = 320; h.y = 300;
  let max = 0;
  run(game, 30, i => { const a = S.enemies.filter(e => !e.dead).length; max = Math.max(max, a); if (i % 20 === 0) S.enemies.forEach(e => { if (!e.dead && !e.enter) game._blast(e.x, e.y, 4, 9, 0, false); }); });
  ok(has('wave') && max >= 6, 'волны не пришли');
  eq(S.roomState, 'cleared', 'не зачищена'); ok(has('roomClear'));
  ok(S.pickups.some(p => L.WEAPONS.includes(p.kind)) || has('power'), 'нет награды');
});
test('выход: в открытые ворота — карта (переход), затем новая комната с противоположных ворот; путь записан', () => {
  const { game, S, has } = setup();
  game._roomCleared(); eq(S.roomState, 'cleared');
  const h = S.heroes[0]; h.x = 60; h.y = 240; game.setMove(0, -1, 0); run(game, 0.6); game.setMove(0, 0, 0);
  eq(S.phase, 'trans', 'не вышел в W'); ok(has('exit'));
  run(game, 1.6); eq(S.phase, 'play'); eq([S.room.l, S.room.c], [2, 0]); eq(S.entry, 'E', 'вход не с востока');
  ok(h.x > 500, 'герой не у восточных ворот: ' + h.x); eq(S.path[S.path.length - 1], [2, 0]);
  ok(S.roomNo === 2 && S.roomState === 'enter');
});

// ---------- Босс ----------
test('босс: сердцевина под бронёй, пока целы узлы; узлы рушатся по одному; после — сердцевина, гибель → круг пройден → следующий', () => {
  const ev = [];
  const game = G.Game({ rng: mulberry32(3), seed: 3, onEvent: (t, d) => ev.push([t, d]), maxStage: 2 }).start();
  const S = game._S; S.heroes[0].inv = 999;
  game._loadRoom(L.roomAt(S.map, L.LAYERS, 1), 'S');
  const B = S.boss; ok(B && B.key === 'press' && B.parts.length === 4, 'нет пресса');
  run(game, 2); ok(B.intro <= 0);
  const hp = B.hp; S.bullets.push({ k: 'b', pi: 0, x: B.x, y: B.y + B.r + 6, vx: 0, vy: -500, dmg: 5, r: 3, life: 1 }); game.update(1 / 60);
  eq(B.hp, hp, 'броня пропустила'); ok(ev.some(e => e[0] === 'armor'));
  B.parts.slice(0, 3).forEach(p => { p.hp = 0.5; }); game._hurtBoss(1);
  ok(B.parts.filter(p => p.dead).length === 3 && B.armored, 'узлы/броня');
  game._hurtBoss(999); ok(!B.armored && ev.some(e => e[0] === 'coreOpen'), 'не открылась');
  game._hurtBoss(999); ok(B.dead && ev.some(e => e[0] === 'bossDie'));
  run(game, 3); eq(S.phase, 'clear'); run(game, 4); eq(S.stage, 2); eq(S.roomNo, 1); eq(S.bossKey, 'wheel');
  ['press', 'wheel', 'colossus'].forEach(k => ok(G.STR.ru['b_' + k] && G.STR.en['b_' + k], 'имя босса ' + k));
});
test('боссы всех кругов: у каждого есть разрушаемые узлы и приёмы, все стреляют/бьют за 12 с', () => {
  for (let st = 1; st <= 3; st++){
    const ev = []; const game = G.Game({ rng: mulberry32(st), stage: st, onEvent: t => ev.push(t) }).start(); const S = game._S;
    game._loadRoom(L.roomAt(S.map, L.LAYERS, 1), 'S'); S.heroes[0].inv = 999; S.heroes[0].x = 320; S.heroes[0].y = 420;
    run(game, 12); const B = S.boss;
    ok(B.parts.length >= 4 && new Set(B.parts.map(p => p.kind)).size >= 2, 'узлы ' + st);
    ok(ev.includes('eshot') || S.ebullets.length || ev.includes('slamWarn'), 'босс ' + st + ' молчит');
    ok(ev.includes('spawn'), 'нет подкрепления ' + st);
  }
});
test('финал: третий круг пройден → победа (win)', () => {
  const ev = []; const game = G.Game({ rng: mulberry32(1), stage: 3, onEvent: t => ev.push(t) }).start(); const S = game._S;
  game._loadRoom(L.roomAt(S.map, L.LAYERS, 1), 'S'); S.heroes[0].inv = 999; run(game, 2);
  game._hurtBoss(9999); game._hurtBoss(9999); run(game, 7); eq(S.phase, 'won'); ok(ev.includes('win'));
});

// ---------- Жизни, продолжения, кооп ----------
test('жизни: 3; +1 за очки; все выбыли → «Продолжить?» (cont — снова 3 жизни), без продолжений — gameover', () => {
  const { game, S, has } = setup({ continues: 1 });
  const h = S.heroes[0]; fight(S);
  const s0 = S.nextLife; S.score = s0 - 10; game._spawn('blank', 100, 100).hp = 1; S.enemies[0].dead = false;
  S.bullets.push({ k: 'b', pi: 0, x: 100, y: 130, vx: 0, vy: -500, dmg: 1, r: 3, life: 1 }); run(game, 0.2);
  ok(h.lives === L.LIVES + 1 && has('extraLife'), 'жизнь за очки');
  for (let k = 0; k < L.LIVES + 1; k++){ h.inv = 0; h.ring = 0; game._kill(h, 'test'); run(game, 1.6); }
  eq([S.phase, S.continues, h.lives], ['cont', 1, 0]); ok(game.cont()); eq(S.phase, 'play'); eq(h.lives, L.LIVES); ok(h.alive);
  for (let k = 0; k < L.LIVES; k++){ h.inv = 0; game._kill(h, 'test'); run(game, 1.6); }
  eq([S.phase, S.continues], ['over', 0], 'без продолжений — сразу конец'); ok(has('gameover')); ok(!game.cont());
  const b = setup({ continues: 1 }); const hb = b.S.heroes[0];
  for (let k = 0; k < L.LIVES; k++){ hb.inv = 0; b.game._kill(hb, 'test'); run(b.game, 1.6); }
  eq(b.S.phase, 'cont'); run(b.game, L.CONT_T + 0.5); eq(b.S.phase, 'over', 'отсчёт продолжения не истёк');
});
test('кооп: два героя независимы (ход и огонь), жизни раздельные, выбывший ждёт, пока жив напарник; вдвоём толпа больше', () => {
  const { game, S } = setup({ players: 2 });
  const [a, b] = S.heroes; eq(S.heroes.length, 2); a.x = 300; b.x = 340; a.y = b.y = 240;
  game.setMove(0, -1, 0); game.setMove(1, 1, 0); game.setAim(0, 0, -1); game.setAim(1, 0, 1); const ax = a.x, bx = b.x;
  run(game, 0.25); ok(a.x < ax && b.x > bx, 'ходят одинаково'); game.setMove(0, 0, 0); game.setMove(1, 0, 0);
  ok(S.bullets.some(q => q.pi === 0 && q.vy < 0) && S.bullets.some(q => q.pi === 1 && q.vy > 0), 'огонь не раздельный');
  for (let k = 0; k < L.LIVES; k++){ b.inv = 0; game._kill(b, 'test'); run(game, 1.6); }
  ok(b.out && a.alive && S.phase === 'play', 'игра остановилась при живом напарнике: ' + JSON.stringify([b.out, a.alive, a.lives, S.phase]));
  const room = { l: 4, c: 1, kind: 'crowd' };
  const n1 = L.makeWaves(2, room, 1, mulberry32(1)).flat().reduce((s, g) => s + g.n, 0), n2 = L.makeWaves(2, room, 2, mulberry32(1)).flat().reduce((s, g) => s + g.n, 0);
  ok(n2 > n1 * 1.3, 'вдвоём не больше: ' + n1 + '/' + n2);
});

// ---------- Производительность ----------
test('производительность: пик толпы (150 врагов, 120 пуль, 2 героя) — шаг логики в Node < 2.5 мс', () => {
  const { game, S } = setup({ players: 2, layout: 1 });
  fight(S); S.heroes.forEach(h => { h.inv = 1e9; });
  const r = mulberry32(5), types = ['blank', 'blank', 'blank', 'blank', 'runner', 'shield'];
  for (let k = 0; k < 150; k++) game._spawn(types[k % types.length], 50 + r() * 540, 50 + r() * 380);
  game.setAim(0, 1, -1); game.setAim(1, -1, 1); S.heroes[0].weapon = 'fan'; S.heroes[0].wT = 99;
  run(game, 0.5);
  for (let k = 0; k < 120; k++) S.ebullets.push({ x: 50 + r() * 540, y: 50 + r() * 380, vx: 0, vy: 0, r: 4, kind: 'shot', life: 99 });
  const N = 300, t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++){ if (S.enemies.filter(e => !e.dead).length < 120) for (let k = 0; k < 20; k++) game._spawn('blank', 50 + r() * 540, 50 + r() * 380); game.update(1 / 60); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log('     шаг логики на пике: ' + ms.toFixed(3) + ' мс (врагов ' + S.enemies.filter(e => !e.dead).length + ')');
  ok(ms < 2.5, 'медленно: ' + ms.toFixed(2) + ' мс');
});

// ---------- Ввод движка ----------
test('кооп-ввод: раскладки без конфликтов (checkBindings); И1 WASD+стрелки, И2 Home/Del/End/PgDn + цифр. блок; в одиночке обе ведут И1', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), Lst = {};
  let t = 1000;
  const win = { Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (Lst[ev] = Lst[ev] || []).push(fn); }, removeEventListener() {}, setInterval() { return 1; }, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => t }, matchMedia: () => ({ matches: false }) };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {} }; win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(src, win, { filename: 'engine.js' });
  const A = win.Arcade;
  eq(A.checkBindings(L.BIND, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }).length, 0, 'конфликты раскладки');
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'gr' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  eq(g.usePlayers({ bind: L.BIND, actions: ['aimL', 'aimR', 'aimU', 'aimD'] }).count(), 1);
  eq(g.input.conflicts.length, 0, 'usePlayers нашёл конфликты');
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1);
  key('keydown', 'KeyW'); key('keydown', 'ArrowLeft');
  ok(P1.pressed('up') && P1.pressed('aimL') && !P2.pressed('up') && !P2.pressed('aimL'), 'И1');
  key('keydown', 'Home'); key('keydown', 'Numpad6');
  ok(P2.pressed('up') && P2.pressed('aimR') && !P1.pressed('aimR'), 'И2');
  ['KeyW', 'ArrowLeft', 'Home', 'Numpad6'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'End'); key('keydown', 'Numpad8');
  ok(P1.pressed('down') && P1.pressed('aimU') && !P2.pressed('down'), 'в одиночке раскладка И2 не ведёт И1');
  ok(!Object.values(L.BIND).some(m => Object.values(m).flat().includes('KeyL')), 'L — горячая клавиша языка');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть оружие, круги, боссы, виды комнат', () => {
  const ru = Object.keys(G.STR.ru).sort(), en = Object.keys(G.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(G.STR.ru[k]).trim() && String(G.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(G.STR.ru[k], 'нет ключа движка ' + k));
  ['base'].concat(L.POWERS).forEach(w => ok(G.STR.ru['w_' + w] && G.STR.en['w_' + w], 'оружие ' + w));
  L.KINDS.concat(['boss']).forEach(k => ok(G.STR.ru['k_' + k], 'вид ' + k));
  [1, 2, 3].forEach(n => ok(G.STR.ru['s_' + n], 'круг ' + n));
  eq(G.STR.ru.title, 'ГОРНИЛО');
});
test('музыка: трек gornilo разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.gornilo; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas 640×512, скрипты по порядку, два тач-стика и пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="640" height="512"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ok(/data-stick="move"/.test(html) && /data-stick="aim"/.test(html) && /data-pause/.test(html), 'тач-стики');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ + оригиналы жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHNtYXNoID90dnxzbWFzaCA/dGVsZXZpc2lvbnzRgdC80Y3RiCA/0YLQuCA/0LLQuHzRgdC80LXRiCA/0YLQuCA/0LLQuHxyb2JvdHJvbnzRgNC+0LHQvtGC0YDQvtC9fHRvdGFsID9jYXJuYWdl', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('c21hc2ggdHY=')) && BAD.test(u('0YDQvtCx0L7RgtGA0L7QvQ==')), 'стоп-лист ловит оригиналы жанра');
  ok(!BAD.test('ГОРНИЛО') && !BAD.test('Гефест') && !BAD.test('заготовка') && !BAD.test('CONTRACT.md') && !BAD.test('робот') && !BAD.test('телевизор'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
// Исполнимость в настоящей физике: неуязвимый бот проходит каждый круг (8 комнат по своей ветке + босс).
const EXE = []; for (let s = 1; s <= 3; s++) EXE.push(playGornilo(G, s, { startStage: s, stages: 1, invuln: true }));
test('исполнимость: каждый из 3 кругов проходится до конца (бот без урона, настоящая физика)', () => {
  console.log('     время, с: ' + EXE.map((r, i) => (i + 1) + ':' + r.time.toFixed(0)).join(' ') + '; комнат: ' + EXE.map(r => r.rooms).join(','));
  EXE.forEach((r, i) => ok(r.won && !r.stuck && r.rooms === L.LAYERS, 'круг ' + (i + 1) + ' не пройден'));
});
// «Человеческий» бот: реакция 150–250 мс, огонь в 8 сторон, пули замечает не сразу (зевок 35% на взгляд).
const N1 = 20, ST1 = []; for (let s = 1; s <= N1; s++) ST1.push(playGornilo(G, 100 + s, { stages: 1 }));
test('баланс: круг 1 бот проходит часто (≥ 85% из ' + N1 + ', с продолжениями), без «зависаний»', () => {
  const n = ST1.filter(r => r.passed >= 1).length;
  console.log('     круг 1: ' + n + '/' + N1 + ', из них без продолжений: ' + ST1.filter(r => r.passed >= 1 && !r.conts).length);
  ok(n >= 0.85 * N1, 'круг 1: ' + n + '/' + N1); eq(ST1.filter(r => r.stuck).map(r => r.seed), []);
});
const NB = 14, BAL = []; for (let s = 1; s <= NB; s++) BAL.push(playGornilo(G, s));
const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
const peak = Math.max(...BAL.map(r => r.peak));
console.log('     бот (1 игрок, ' + NB + ' партий): вся игра — ' + BAL.filter(r => r.won).length + '/' + NB + ', кругов пройдено: ' + BAL.map(r => r.passed).join('') + '; пик толпы: ' + peak + '; гибели: ' + JSON.stringify(why));
test('баланс: всю игру (3 круга, 3 жизни + 2 продолжения) проходят ~20–65%; толпы — десятки врагов разом', () => {
  const w = BAL.filter(r => r.won).length / NB; ok(w >= 0.2 && w <= 0.65, 'вся игра: ' + w);
  ok(peak >= 40, 'толпа жидкая: ' + peak); eq(BAL.filter(r => r.stuck).map(r => r.seed), [], 'зависание');
});
const CO = []; for (let s = 1; s <= 6; s++) CO.push(playGornilo(G, s, { players: 2 }));
const cw = CO.filter(r => r.won).length / CO.length;
console.log('     бот (кооп, 6 партий): круг 1 — ' + CO.filter(r => r.passed >= 1).length + '/6, вся игра — ' + CO.filter(r => r.won).length + '/6, пик толпы ' + Math.max(...CO.map(r => r.peak)));
test('кооп-партия: круг 1 — все, всю игру — не «на халяву» (≤ 85%), не застревает', () => { ok(CO.every(r => r.passed >= 1), 'кооп падает на 1-м'); ok(cw <= 0.85, 'кооп слишком лёгок: ' + cw); ok(!CO.some(r => r.stuck), 'зависание'); });

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

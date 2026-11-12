/* ФИТИЛЬ · tests/engine.test.mjs — автотесты логики и обвязки (Node, без зависимостей).
   Запуск: node fitil/tests/engine.test.mjs
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
const F = sandbox.FITIL, L = F.logic;
const { playFitil, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

const { idx, FLOOR, WALL, CRATE, COLS, ROWS } = L;
const h = 1 / 60;
// Пустая арена: только рамка и колонны; без врагов; фаза play. map — массив строк 15×13 (# стена, + ящик, . пол)
function arena(opts = {}, map){
  const events = [];
  const game = F.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  if (map){ for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) S.grid[idx(x, y)] = map[y][x] === '#' ? WALL : map[y][x] === '+' ? CRATE : FLOOR; }
  else for (let i = 0; i < S.grid.length; i++) if (S.grid[i] === CRATE) S.grid[i] = FLOOR;
  S.enemies = []; S.hidden = {}; S.items = {}; S.boss = null; S.phase = 'play'; S.phaseT = 0; S.banner = 0;
  S.hatch = { x: 13, y: 1, open: false };
  S.enemies.push(game._mkEnemy('wander', 11, 11, 0));   // «якорь»: держит люк закрытым (скорость 0)
  S.enemies[0].speed = 0;
  return { game, S, events };
}
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(h); }
function bomb(S, x, y, r = 2, owner = 0, fuse = L.FUSE){ const b = { x, y, owner, fuse, relay: false, r, slide: null, t: 0 }; S.bombs.push(b); return b; }
function put(p, x, y){ p.x = x; p.y = y; p.alive = true; p.inv = 0; }
const MAP_OPEN = [
  '###############',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '###############'];

// ---------- поле и уровни ----------
test('уровни: 8 обычных + босс 9-м, названия RU/EN, у каждого свои враги/бонусы', () => {
  eq(L.LEVELS.length, 9);
  ok(L.LEVELS[8].boss && !L.LEVELS.slice(0, 8).some(l => l.boss), 'босс только на 9-м');
  L.LEVELS.forEach(lv => { ok(F.STR.ru['lv_' + lv.name] && F.STR.en['lv_' + lv.name], 'нет названия ' + lv.name); });
  const types = new Set(); L.LEVELS.forEach(lv => Object.keys(lv.enemies).forEach(k => types.add(k)));
  eq([...types].sort(), ['chaser', 'fast', 'ghost', 'wander'], 'все 4 вида врагов встречаются');
  const kinds = new Set(); L.LEVELS.forEach(lv => lv.items.forEach(k => kinds.add(k)));
  eq([...kinds].sort(), ['bomb', 'flame', 'kick', 'relay', 'speed'], 'все 5 бонусов выпадают');
});

test('проходимость: на 200 сидах × 9 уровней поле связно, люк и все враги достижимы, углы старта свободны', () => {
  for (let seed = 1; seed <= 200; seed++) for (let n = 1; n <= 9; n++){
    const lv = L.buildLevel(n, mulberry32(seed * 31 + n)), G = lv.grid;
    ok(L.connected(G), `сид ${seed} ур.${n}: поле несвязно`);
    const d = L.bfs(1, 1, (x, y) => G[idx(x, y)] !== WALL);
    ok(d[idx(lv.hatch.x, lv.hatch.y)] >= 0 && G[idx(lv.hatch.x, lv.hatch.y)] === FLOOR, `сид ${seed} ур.${n}: люк недостижим/под ящиком`);
    lv.enemies.forEach(e => ok(d[idx(e.x, e.y)] >= 0, `сид ${seed} ур.${n}: враг недостижим`));
    for (const [sx, sy] of L.SPAWNS) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]){
      const c = G[idx(sx + dx, sy + dy)]; ok(c !== CRATE, `сид ${seed} ур.${n}: ящик у точки старта`);
    }
    for (const [sx, sy] of L.SPAWNS) lv.enemies.forEach(e => ok(Math.abs(e.x - sx) + Math.abs(e.y - sy) >= 7, 'враг слишком близко к старту'));
    const total = Object.values(L.LEVELS[n - 1].enemies).reduce((a, b) => a + b, 0);
    eq(lv.enemies.length, total, `сид ${seed} ур.${n}: число врагов`);
    eq(Object.keys(lv.hidden).length, L.LEVELS[n - 1].items.length, `сид ${seed} ур.${n}: бонусы спрятаны не все`);
    Object.keys(lv.hidden).forEach(k => eq(G[k], CRATE, 'бонус не под ящиком'));
  }
});

test('доп. стены уровней не рвут связность (генератор пропускает «рвущие» клетки)', () => {
  const lv = L.buildLevel(4, mulberry32(5));   // «Подвал» — кольцо
  ok(L.connected(lv.grid));
  const n = L.WALLS.ring.filter(([x, y]) => lv.grid[idx(x, y)] === WALL).length;
  ok(n >= 6 && n < L.WALLS.ring.length, 'кольцо поставлено частично: ' + n);
});

// ---------- взрывы ----------
test('взрыв: крест радиуса r, стены гасят луч, клетка-центр в огне', () => {
  const cells = L.blast(L.buildLevel(1, mulberry32(1)).grid.map(c => c === CRATE ? FLOOR : c), 1, 1, 3);
  const set = new Set(cells.map(c => c.x + ',' + c.y));
  ok(set.has('1,1') && set.has('2,1') && set.has('3,1') && set.has('4,1') && set.has('1,4'), 'луч на 3 клетки');
  ok(!set.has('0,1') && !set.has('1,0'), 'рамка гасит');
  ok(!set.has('5,1'), 'дальше радиуса не идёт');
  const c2 = L.blast(Uint8Array.from(MAP_OPEN.join('').split('').map(ch => ch === '#' ? WALL : FLOOR)), 2, 1, 4);
  ok(!c2.some(c => c.x === 2 && c.y === 2), 'колонна (2,2) гасит луч вниз');
});

test('взрыв ломает первый ящик на луче и останавливается на нём; ящик даёт очки', () => {
  const m = MAP_OPEN.slice(); m[1] = '#...++........#';
  const { game, S, events } = arena({}, m);
  put(S.players[0], 9, 9);
  bomb(S, 1, 1, 5, 0, 0.01); run(game, 0.05);
  eq(S.grid[idx(4, 1)], FLOOR, 'ближний ящик сломан');
  eq(S.grid[idx(5, 1)], CRATE, 'дальний цел (луч остановился)');
  ok(S.flames[idx(4, 1)] && !S.flames[idx(5, 1)], 'пламя дошло до ящика и не дальше');
  eq(events.filter(e => e[0] === 'crate').length, 1);
  eq(S.score, 10);
});

test('цепной подрыв: бомба в кресте другой взрывается сразу (в тот же кадр)', () => {
  const { game, S, events } = arena({}, MAP_OPEN);
  put(S.players[0], 13, 11);
  const b1 = bomb(S, 1, 1, 3, 0, 0.01), b2 = bomb(S, 3, 1, 2, 0, 2.0), b3 = bomb(S, 3, 3, 2, 0, 2.0), far = bomb(S, 9, 9, 1, 0, 2.0);
  run(game, 0.05);
  ok(!S.bombs.includes(b1) && !S.bombs.includes(b2) && !S.bombs.includes(b3), 'вся цепочка взорвалась');
  ok(S.bombs.includes(far), 'дальняя бомба цела');
  eq(events.filter(e => e[0] === 'boom').length, 3);
  ok(events.filter(e => e[0] === 'boom' && e[1].chain).length === 2, 'две — цепные');
  ok(S.flames[idx(3, 5)], 'вторичный крест b3 (радиус 2) дотянулся до (3,5)');
});

test('пламя гаснет через FLAME_T; фитиль — FUSE', () => {
  const { game, S } = arena({}, MAP_OPEN);
  put(S.players[0], 13, 11);
  bomb(S, 5, 5, 1);
  run(game, L.FUSE - 0.1); ok(S.bombs.length === 1 && !Object.keys(S.flames).length, 'ещё горит фитиль');
  run(game, 0.2); ok(S.bombs.length === 0 && S.flames[idx(5, 5)], 'взрыв');
  run(game, L.FLAME_T + 0.05); eq(Object.keys(S.flames).length, 0, 'пламя погасло');
});

// ---------- бомбы игрока ----------
test('бомба: ставится под ноги, лимит по ЗАРЯДам, не две в одну клетку; с клетки бомбы можно уйти, назад — нельзя', () => {
  const { game, S } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 1, 1);
  ok(game.bomb(0)); ok(!game.bomb(0), 'вторая в ту же клетку'); eq(S.bombs.length, 1);
  game.setDir(0, 1, 0); run(game, 0.6); game.setDir(0, 0, 0);
  ok(p.x > 2.5, 'ушёл с бомбы: ' + p.x);
  ok(!game.bomb(0), 'лимит 1 бомба');
  p.bombs = 2; ok(game.bomb(0), 'с ЗАРЯДом — вторая');
  game.setDir(0, -1, 0); run(game, 0.6); game.setDir(0, 0, 0);
  ok(p.x >= 2 - 1e-6, 'бомба не пускает обратно: ' + p.x);
});

test('огонь убивает подрывника (свой тоже), жизнь −1, возрождение на старте с неуязвимостью', () => {
  const { game, S, events } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 5, 5); bomb(S, 5, 5, 2, 0, 0.01);
  run(game, 0.05);
  ok(!p.alive, 'погиб'); eq(p.lives, 2);
  ok(events.some(e => e[0] === 'die' && e[1].why === 'fire'));
  run(game, L.RESPAWN_T + 0.1);
  ok(p.alive && p.x === 1 && p.y === 1 && p.inv > 0, 'возродился');
});

// ---------- бонусы ----------
test('бонусы: спрятан под ящиком → открывается взрывом → подбирается и даёт силу', () => {
  const m = MAP_OPEN.slice(); m[1] = '#..+..........#';
  const { game, S, events } = arena({}, m), p = S.players[0];
  S.hidden[idx(3, 1)] = 'flame';
  put(p, 7, 7); bomb(S, 1, 1, 3, 0, 0.01); run(game, 0.05);
  eq(S.items[idx(3, 1)], 'flame', 'бонус открылся');
  ok(events.some(e => e[0] === 'reveal'));
  run(game, L.FLAME_T + 0.1);
  put(p, 3, 1); run(game, h * 2);
  eq(p.flame, 3, 'ЖАР +1 к радиусу'); ok(!S.items[idx(3, 1)], 'подобран');
  const apply = (k) => { S.items[idx(5, 5)] = k; put(p, 5, 5); run(game, h * 2); };
  apply('bomb'); eq(p.bombs, 2);
  apply('speed'); eq(p.speed, 1);
  apply('kick'); ok(p.kick);
  apply('relay'); ok(p.relay);
  ok(S.score >= 10 + 50 * 5, 'очки за бонусы');
});

test('ПРЫТЬ ускоряет, предел скорости и мощности соблюдается', () => {
  const { game, S } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 1, 1); game.setDir(0, 1, 0); run(game, 0.5); const d0 = p.x - 1;
  put(p, 1, 1); p.speed = 4; run(game, 0.5); const d1 = p.x - 1;
  ok(d1 > d0 * 1.4, `быстрее: ${d0.toFixed(2)} → ${d1.toFixed(2)}`);
  for (let i = 0; i < 12; i++){ S.items[idx(7, 7)] = 'flame'; put(p, 7, 7); run(game, h * 2); }
  eq(p.flame, L.POWERS.flame.max);
});

test('ТОЛЧОК: бомба катится до препятствия; без него — стоит', () => {
  const { game, S, events } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 1, 1); const b = bomb(S, 2, 1, 1, 0, 9);
  game.setDir(0, 1, 0); run(game, 0.3); game.setDir(0, 0, 0);
  ok(b.x === 2 && !b.slide, 'без ТОЛЧКА бомба стоит');
  p.kick = true; put(p, 1, 1); game.setDir(0, 1, 0); run(game, 0.1); game.setDir(0, 0, 0);
  ok(events.some(e => e[0] === 'kick'), 'пинок');
  run(game, 2);
  eq(b.x, 13, 'докатилась до рамки'); ok(!b.slide, 'остановилась');
});

test('РЕЛЕ: бомба ждёт подрыва (фитиль не горит), detonate — взрыв; гибель хозяина — фитиль загорается', () => {
  const { game, S } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 1, 1); p.relay = true; game.bomb(0);
  put(p, 7, 7); run(game, L.FUSE + 1);
  eq(S.bombs.length, 1, 'ждёт'); ok(S.bombs[0].relay);
  eq(game.detonate(0), 1); run(game, h);
  eq(S.bombs.length, 0, 'подорвана');
  run(game, 1);
  put(p, 1, 1); p.relay = true; game.bomb(0); put(p, 9, 9);
  S.enemies.push(game._mkEnemy('wander', 9, 9, 0)); S.enemies[1].speed = 0;
  run(game, h * 2); ok(!p.alive, 'хозяин погиб');
  ok(!S.bombs[0].relay, 'бомба перешла на фитиль'); run(game, L.FUSE + 0.1); eq(S.bombs.length, 0);
});

// ---------- враги ----------
test('враги гибнут в огне, дают очки по виду; касание врага убивает подрывника', () => {
  const { game, S, events } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 13, 11);
  const types = ['wander', 'chaser', 'ghost', 'fast'];
  types.forEach((t, i) => { const e = game._mkEnemy(t, 1 + i * 2, 1, 0); e.speed = 0; S.enemies.push(e); });
  bomb(S, 1, 1, 8, 0, 0.01); run(game, 0.05);
  eq(S.enemies.length, 1, 'остался только «якорь»');
  eq(S.score, 100 + 200 + 300 + 400);
  ok(events.filter(e => e[0] === 'kill').length === 4);
  const e = game._mkEnemy('wander', 13, 10, 0); e.speed = 0; S.enemies.push(e);
  put(p, 13, 10.45); run(game, h); ok(!p.alive, 'касание');
});

test('ИИ: шатун бродит и не заходит в стены/ящики/бомбы; мгла проходит сквозь ящики', () => {
  const m = MAP_OPEN.slice(); m[5] = '#.....+++.....#'; m[7] = '#.....+++.....#';
  const { game, S } = arena({ seed: 3 }, m);
  put(S.players[0], 1, 11); S.players[0].inv = 1e9;
  const w = game._mkEnemy('wander', 7, 3, 1);
  S.enemies.push(w);
  bomb(S, 9, 3, 1, 0, 1e9);
  const seenW = new Set();
  for (let i = 0; i < 60 * 40; i++){
    game.update(h);
    const c = idx(Math.round(w.x), Math.round(w.y)); seenW.add(c);
    ok(S.grid[c] !== WALL && S.grid[c] !== CRATE && !(Math.round(w.x) === 9 && Math.round(w.y) === 3), 'шатун в стене/ящике/бомбе');
  }
  ok(seenW.size >= 12, 'шатун бродит: ' + seenW.size);
  // карман из ящиков: шатун заперт, мгла выходит сквозь ящики
  const m2 = MAP_OPEN.slice(); m2[9] = '#..........+..#'; m2[11] = '#..........+..#';
  const t2 = arena({ seed: 5 }, m2); put(t2.S.players[0], 1, 1); t2.S.players[0].inv = 1e9;
  t2.S.grid[idx(12, 10)] = CRATE; t2.S.grid[idx(13, 9)] = CRATE; t2.S.grid[idx(13, 11)] = CRATE;
  const w2 = t2.game._mkEnemy('wander', 13, 10, 1), g2 = t2.game._mkEnemy('ghost', 13, 10, 1);
  t2.S.enemies = [w2, g2];
  let gOut = false, wIn = true, inCrate = false;
  for (let i = 0; i < 60 * 20; i++){
    t2.game.update(h);
    if (Math.round(w2.x) !== 13 || Math.round(w2.y) !== 10) wIn = false;
    if (t2.S.grid[idx(Math.round(g2.x), Math.round(g2.y))] === CRATE) inCrate = true;
    if (Math.abs(g2.x - 13) + Math.abs(g2.y - 10) >= 2) gOut = true;
  }
  ok(wIn, 'шатун не прошёл сквозь ящики'); ok(inCrate && gOut, 'мгла прошла сквозь ящики и вышла');
});

test('ИИ: ищейка идёт к подрывнику (в пределах чутья), юла быстрее остальных', () => {
  const { game, S } = arena({ seed: 2 }, MAP_OPEN), p = S.players[0];
  put(p, 1, 1); p.inv = 1e9;
  const c = game._mkEnemy('chaser', 5, 3, 1); S.enemies.push(c);
  const d0 = Math.abs(c.x - 1) + Math.abs(c.y - 1);
  run(game, 4);
  ok(Math.abs(c.x - 1) + Math.abs(c.y - 1) < d0 - 2, 'приблизилась');
  ok(L.ENEMY.fast.speed > L.ENEMY.chaser.speed && L.ENEMY.chaser.speed > L.ENEMY.wander.speed && L.ENEMY.wander.speed > L.ENEMY.ghost.speed);
  // бомба на пути — разворот, сквозь бомбу не идёт
  const { game: g2, S: S2 } = arena({ seed: 4 }, MAP_OPEN);
  put(S2.players[0], 13, 11); S2.players[0].inv = 1e9;
  const w = g2._mkEnemy('wander', 1, 5, 1); w.dir = [1, 0]; S2.enemies.push(w);
  bomb(S2, 3, 5, 1, 0, 1e9);
  for (let i = 0; i < 600; i++){ g2.update(h); ok(!(Math.round(w.x) === 3 && Math.round(w.y) === 5), 'прошёл сквозь бомбу'); }
});

test('люк: закрыт, пока есть враги; открывается, когда врагов нет; вход — переход на уровень', () => {
  const { game, S, events } = arena({}, MAP_OPEN), p = S.players[0];
  put(p, 13, 1); run(game, 0.1);
  ok(!S.hatch.open && S.phase === 'play', 'закрыт при враге');
  S.enemies = []; run(game, h);
  ok(S.hatch.open && events.some(e => e[0] === 'open'), 'открылся');
  run(game, h); eq(S.phase, 'clear');
  ok(S.clearBonus >= 500, 'бонус за уровень');
  run(game, 2.1); eq(S.level, 2); eq(S.phase, 'ready');
});

test('финал: Жернов — 10 попаданий, неуязвимость между ударами, призывает подручных, после — люк и win()', () => {
  const events = [];
  const game = F.Game({ rng: mulberry32(9), level: 9, onEvent: (t, d) => events.push([t, d]) }).start(), S = game._S;
  ok(S.boss && S.boss.alive && S.boss.hp === L.BOSS_HP, 'Жернов на месте');
  S.phase = 'play'; const p = S.players[0]; put(p, 1, 1); p.inv = 1e9;
  for (let i = 0; i < S.grid.length; i++) if (S.grid[i] === CRATE) S.grid[i] = FLOOR;
  run(game, 7); ok(events.some(e => e[0] === 'spawn'), 'призвал подручного');
  let hits = 0;
  for (let k = 0; k < 40 && S.boss.alive; k++){
    const B = S.boss; B.inv = 0; const b = bomb(S, Math.round(B.x), Math.round(B.y), 1, 0, 0.0); game._explode(b);
    game.update(h); hits++;
    if (S.boss.alive) { const hp = S.boss.hp; S.flames[idx(Math.round(S.boss.x), Math.round(S.boss.y))] = { t: 0.5, mask: 1 }; game.update(h); eq(S.boss.hp, hp, 'неуязвим сразу после удара'); }
    for (const kk in S.flames) delete S.flames[kk];
  }
  eq(hits, L.BOSS_HP); ok(!S.boss.alive && S.enemies.length === 0, 'Жернов расколот, подручные исчезли');
  ok(events.some(e => e[0] === 'bossDie'));
  run(game, h); ok(S.hatch.open);
  put(p, S.hatch.x, S.hatch.y); run(game, h); eq(S.phase, 'clear');
  run(game, 2.1); ok(S.over && S.won && events.some(e => e[0] === 'win'), 'победа');
});

// ---------- кооп ----------
test('кооп (логика): два подрывника двигаются и ставят бомбы независимо, счёт общий', () => {
  const { game, S } = arena({ players: 2 }, MAP_OPEN), [a, b] = S.players;
  eq(S.players.length, 2); eq([b.x, b.y], [13, 11]);
  game.setDir(0, 1, 0); game.setDir(1, 0, -1); run(game, 0.5);
  ok(a.x > 2 && a.y === 1 && b.x === 13 && b.y < 10, 'каждый по своей оси');
  ok(game.bomb(0) && game.bomb(1)); eq(S.bombs.map(x => x.owner).sort(), [0, 1]);
  a.bombs = 1; ok(!game.bomb(0), 'лимит считается по своим бомбам');
  const e1 = game._mkEnemy('wander', 5, 5, 0), e2 = game._mkEnemy('wander', 9, 9, 0); S.enemies.push(e1, e2);
  bomb(S, 5, 5, 1, 0, 0.01); bomb(S, 9, 9, 1, 1, 0.01); run(game, 0.05);
  eq(S.score, 200, 'очки обоих — в общий счёт');
});

test('кооп: у каждого свои жизни; один выбыл — игра идёт; оба — gameover', () => {
  const { game, S, events } = arena({ players: 2, lives: 1 }, MAP_OPEN), [a, b] = S.players;
  put(a, 5, 5); bomb(S, 5, 5, 1, 0, 0.01); run(game, 0.05);
  ok(a.out && !S.over && b.alive, 'И1 выбыл, И2 играет');
  put(b, 7, 7); bomb(S, 7, 7, 1, 1, 0.01); run(game, 0.05);
  ok(b.out && S.over && events.some(e => e[0] === 'gameover'), 'оба выбыли — конец');
});

test('огонь по своим: выкл (по умолчанию) — пламя напарника не ранит, своё ранит; вкл — ранит', () => {
  const { game, S } = arena({ players: 2 }, MAP_OPEN), [a, b] = S.players;
  ok(!S.ff, 'по умолчанию выкл');
  put(a, 5, 5); put(b, 9, 9);
  bomb(S, 5, 3, 3, 1, 0.01); run(game, 0.05);
  ok(a.alive, 'бомба И2 не тронула И1');
  run(game, 1);
  bomb(S, 5, 3, 3, 0, 0.01); run(game, 0.05);
  ok(!a.alive, 'своя бомба ранит');
  const t2 = arena({ players: 2, friendlyFire: true }, MAP_OPEN);
  ok(t2.S.ff); put(t2.S.players[0], 5, 5); put(t2.S.players[1], 9, 9);
  bomb(t2.S, 5, 3, 3, 1, 0.01); run(t2.game, 0.05);
  ok(!t2.S.players[0].alive, 'с огнём по своим — ранит');
  const t3 = arena({ players: 2 }, MAP_OPEN); t3.game.setFF(true); ok(t3.S.ff, 'setFF переключает на лету');
  // огонь Жернова ранит всех при любом режиме
  const t4 = arena({ players: 2 }, MAP_OPEN); put(t4.S.players[0], 5, 5); bomb(t4.S, 5, 5, 1, -1, 0.01); run(t4.game, 0.05);
  ok(!t4.S.players[0].alive, 'огонь Жернова ранит');
});

test('за каждые 10 000 очков — +1 жизнь каждому, кто в игре', () => {
  const { game, S, events } = arena({ players: 2 }, MAP_OPEN);
  S.score = L.EXTRA_LIFE - 5; run(game, h); eq(S.players.map(p => p.lives), [3, 3]);
  S.score += 10; run(game, h); eq(S.players.map(p => p.lives), [4, 4]);
  ok(events.some(e => e[0] === 'life'));
});

// ---------- кооп-ввод через движок (два игрока за одной клавиатурой) ----------
function makeEnv(){
  const Lst = { cap: {}, bub: {} }; let t = 1000;
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, Uint8Array, parseInt, parseFloat, Date,
    console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
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
test('кооп-ввод: раскладки без конфликтов; И1 и И2 управляются независимо; 1 игрок — обе раскладки ведут И1', () => {
  const env = makeEnv(), A = env.A, B = env.win.FITIL.logic.BIND;
  eq(A.checkBindings(B, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }), [], 'конфликты раскладок');
  const g = A.createGame({ canvas: '#c', width: 600, height: 568, gameId: 'fitil' });
  g.useStandardScreens({ lives: 3 });
  g.usePlayers({ bind: B, actions: ['bomb', 'det'], repeat: [] });
  g.scene('play', { realtime: true }); g.start('title');
  ok(g.menu.items('title').indexOf('players') === 1, 'пункт «Игроки» после «Играть»');
  env.key('keydown', 'Digit2'); env.key('keyup', 'Digit2'); eq(g.input.playerCount, 2);
  g.goto('play'); env.tick(200);
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  env.key('keydown', 'ArrowRight'); env.key('keydown', 'KeyW');
  eq([P1.dir, P2.dir], [{ x: 1, y: 0 }, { x: 0, y: -1 }], 'направления раздельно');
  env.key('keyup', 'ArrowRight'); env.key('keyup', 'KeyW');
  eq([P1.dir, P2.dir], [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  env.key('keydown', 'Space'); env.key('keyup', 'Space'); env.key('keydown', 'KeyF'); env.key('keyup', 'KeyF');
  env.key('keydown', 'Period'); env.key('keyup', 'Period'); env.key('keydown', 'KeyG'); env.key('keyup', 'KeyG');
  eq(got, ['1bomb', '2bomb', '1det', '2det'], 'бомба/подрыв по игрокам');
  // логика под этим вводом: два подрывника расходятся
  const F2 = env.win.FITIL, game = F2.Game({ players: 2, rng: mulberry32(1) }).start(), S = game.state();
  for (let i = 0; i < S.grid.length; i++) if (S.grid[i] === CRATE) S.grid[i] = FLOOR;
  S.phase = 'play';
  env.key('keydown', 'ArrowDown'); env.key('keydown', 'KeyA');
  for (let i = 0; i < 30; i++){ for (let pi = 0; pi < 2; pi++){ const d = g.input.player(pi).dir; game.setDir(pi, d.x, d.y); } game.update(h); }
  ok(S.players[0].y > 1.5 && S.players[0].x === 1, 'И1 вниз');
  ok(S.players[1].x < 12.5 && S.players[1].y === 11, 'И2 влево');
  env.key('keyup', 'ArrowDown'); env.key('keyup', 'KeyA');
  // один игрок: WASD тоже ведёт И1
  g.goto('title'); env.key('keydown', 'Digit1'); env.key('keyup', 'Digit1'); eq(g.input.playerCount, 1);
  g.goto('play'); env.tick(200);
  env.key('keydown', 'KeyD'); eq(P1.dir, { x: 1, y: 0 }); eq(P2.dir, { x: 0, y: 0 }); env.key('keyup', 'KeyD');
  eq(env.store['arcade.players.fitil'], '1', 'выбор хранится');
});

// ---------- музыка, строки, имена ----------
test('музыка: трек разбирается секвенсором движка, голоса кратны тактам', () => {
  const env = makeEnv();
  vm.runInContext(read('js/music.js'), env.win, { filename: 'music.js' });
  const tr = env.A.tracks.fitil; ok(tr, 'трек зарегистрирован по gameId');
  const c = env.A.parseTrack(tr);
  eq(c.melody.length, 64); eq(c.bass.length, 32); eq(c.drums.length, 16);
});

test('строки: RU/EN — одинаковый набор ключей, все бонусы и враги названы', () => {
  eq(Object.keys(F.STR.ru).sort(), Object.keys(F.STR.en).sort());
  Object.keys(L.POWERS).forEach(k => ok(F.STR.ru['pw_' + k] && F.STR.en['pw_' + k], 'бонус ' + k));
  Object.keys(L.ENEMY).forEach(k => ok(F.STR.ru['en_' + k] && F.STR.en['en_' + k], 'враг ' + k));
});

test('правило имён: в папке игры нет чужих названий игр/компаний (регистронезависимо, с транслитом)', () => {
  const BAD = /bomber|бомбер|dyna|дайна|pac-?man|пакман|tetris|тетрис|galag|galax|xonix|ксоникс|battle ?city|lode ?runner|boulder|digger|\bcontra\b|контра(?![а-яё])|konami|конами|namco|намко|taito|тайто|capcom|капком|nintendo|нинтендо|sega\b|сега(?![а-яё])|hudson|хадсон|tecmo|dizzy|deepseek/i;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md)$/.test(f));
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
});

// ---------- баланс (бот) ----------
test('бот: уровень 1 проходится ≥ 90 %, вся игра — ~20–40 % (60 прогонов)', () => {
  const N = 60; let l1 = 0, won = 0, stuck = 0;
  for (let s = 1; s <= N; s++){ const r = playFitil(F, s); if (r.passed >= 1) l1++; if (r.won) won++; if (r.stuck) stuck++; }
  console.log(`     уровень 1: ${(100 * l1 / N).toFixed(0)} %, вся игра: ${(100 * won / N).toFixed(0)} %, застреваний: ${stuck}`);
  ok(l1 / N >= 0.9, 'уровень 1: ' + l1 / N);
  ok(won / N >= 0.15 && won / N <= 0.45, 'вся игра: ' + won / N);
});

test('бот: кооп вдвоём (огонь по своим выкл) проходит первые уровни и не стреляет «в своих»', () => {
  let l2 = 0;
  for (let s = 1; s <= 10; s++){ const r = playFitil(F, 100 + s, { players: 2, levels: 3 }); if (r.passed >= 2) l2++; }
  ok(l2 >= 7, 'кооп: 2 уровня из 3 пройдены в ' + l2 + '/10');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

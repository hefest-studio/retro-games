/* КЛАДКА · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node kladka/tests/engine.test.mjs. Логика (js/game.js) в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'), sandbox, { filename: 'i18n.js' });
const K = sandbox.KLADKA, L = K.logic;
const { playKladka, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

const HOLD = 1000;
// Игра в фазе play с заданной кладкой (карта как в LEVELS) и без ядер
function setup(map, opts = {}){
  const game = K.Game(Object.assign({ rng: mulberry32(opts.seed || 1) }, opts)).start(); const S = game._S;
  if (map){
    S.bricks = L.parseMap(map); S.grid = new Array(L.COLS * 24); S.left = 0;
    for (const b of S.bricks){ S.grid[b.r * L.COLS + b.c] = b; if (!b.iron) S.left++; }
    S.boss = null;
  }
  S.left += HOLD;   // фиктивный остаток кладки: уровень не «проходится» сам посреди теста
  S.balls = []; S.banner = 0; S.served = true;
  if (opts.park !== false) park(S);
  return { game, S };
}
// «Запарковать» ядро на мастерке: держит раунд живым и само не стартует (только action())
function park(S){ S.balls.push({ x: S.paddle.x, y: L.PADDLE_Y - 6, vx: 0, vy: 0, stuck: true, off: 0, stuckT: -1e9, park: true }); }
function ball(S, x, y, vx, vy){ const b = { x, y, vx, vy, stuck: false, off: 0, stuckT: 0 }; S.balls.push(b); return b; }
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
const EMPTY = ['..............'];

test('карты: 10 уровней, строки по 14 клеток, есть что бить; 10-й — Плавильня', () => {
  eq(L.LEVELS.length, 10);
  L.LEVELS.forEach((lv, i) => {
    lv.map.forEach(r => eq(r.length, L.COLS, 'уровень ' + (i + 1)));
    const bricks = L.parseMap(lv.map);
    ok(bricks.some(b => !b.iron), 'уровень ' + (i + 1) + ' без разрушаемых блоков');
    ok(bricks.every(b => b.y + b.h < L.PADDLE_Y - 200), 'кладка слишком низко');
    ok(K.STR.ru['lv_' + lv.name] && K.STR.en['lv_' + lv.name], 'нет названия уровня ' + lv.name);
  });
  ok(L.LEVELS[9].boss && !L.LEVELS.slice(0, 9).some(l => l.boss), 'босс только на 10-м');
  ok(new Set(L.LEVELS.map(l => l.map.join('|'))).size === 10, 'раскладки различаются');
  let err = null; try { L.parseMap(['abc']); } catch (e) { err = e; } ok(err, 'короткая строка карты — ошибка');
});

test('угол отскока зависит от точки удара: центр — вверх, края — до ±62°, монотонно', () => {
  const sp = 300, c = L.paddleBounce(240, 240, 72, sp);
  near(c.vx, 0, 1e-9); near(c.vy, -sp, 1e-9);
  const r = L.paddleBounce(240 + 36, 240, 72, sp), l = L.paddleBounce(240 - 36, 240, 72, sp);
  near(Math.atan2(r.vx, -r.vy) * 180 / Math.PI, 62, 1e-6, 'правый край'); near(Math.atan2(l.vx, -l.vy) * 180 / Math.PI, -62, 1e-6, 'левый край');
  const far = L.paddleBounce(240 + 80, 240, 72, sp); near(far.vx, r.vx, 1e-9, 'за краем — как край');
  let prev = -Infinity; for (let x = 204; x <= 276; x += 6){ const v = L.paddleBounce(x, 240, 72, sp); ok(v.vx > prev, 'монотонность'); prev = v.vx; near(Math.hypot(v.vx, v.vy), sp, 1e-9, 'скорость'); ok(v.vy < 0, 'всегда вверх'); }
});

test('мастерок: ядро, падающее на правую часть, уходит вправо-вверх', () => {
  const { game, S } = setup(EMPTY); S.paddle.x = 240;
  const b = ball(S, 258, L.PADDLE_Y - 30, 0, 300);
  run(game, 0.15);
  ok(b.vy < 0 && b.vx > 0, 'направление ' + b.vx.toFixed(1) + ',' + b.vy.toFixed(1));
  const expect = L.paddleBounce(258, 240, S.paddle.w, 1);
  near(b.vx / Math.hypot(b.vx, b.vy), expect.vx, 0.02, 'угол по точке удара');
});

test('стены и потолок отражают ядро', () => {
  const { game, S } = setup(EMPTY);
  const a = ball(S, L.FX0 + 8, 400, -300, -120); run(game, 0.05); ok(a.vx > 0 && a.x >= L.FX0 + L.BALL_R, 'левая стена');
  const b = ball(S, L.FX1 - 8, 400, 300, -120); run(game, 0.05); ok(b.vx < 0 && b.x <= L.FX1 - L.BALL_R, 'правая стена');
  const c = ball(S, 240, L.FY0 + 8, 60, -300); run(game, 0.05); ok(c.vy > 0 && c.y >= L.FY0 + L.BALL_R, 'потолок');
});

test('блок снизу: отскок вниз, блок разбит, счёт и прогресс', () => {
  const map = ['..............', '......a.......']; const { game, S } = setup(map);
  const k = S.bricks[0], b = ball(S, k.x + 16, k.y + 40, 0, -300);
  const left = S.left, score = S.score; run(game, 0.2);
  ok(b.vy > 0, 'ядро должно отскочить вниз'); ok(k.dead, 'блок разбит'); eq(S.left, left - 1); ok(S.score > score, 'очки');
  eq(S.grid[k.r * L.COLS + k.c], null, 'клетка свободна');
});

test('блок сбоку: отражение по горизонтали', () => {
  const map = ['..............', '......2.......']; const { game, S } = setup(map);
  const k = S.bricks[0], b = ball(S, k.x - 20, k.y + 8, 300, 100);
  run(game, 0.1);
  ok(b.vx < 0, 'vx должен смениться на отрицательный'); eq(k.hp, 1, 'прочный блок потерял 1 единицу');
});

test('прочность: «2» — два удара, «3» — три, чугун не разбивается и не считается', () => {
  const { game, S } = setup(['23#...........']);
  const [b2, b3, iron] = S.bricks; eq(S.left - HOLD, 2, 'чугун не в счёте');
  game._damage(b2); ok(!b2.dead); game._damage(b2); ok(b2.dead, '«2» разбит вторым ударом');
  game._damage(b3); game._damage(b3); ok(!b3.dead); game._damage(b3); ok(b3.dead, '«3» разбит третьим');
  for (let i = 0; i < 20; i++) game._damage(iron); ok(!iron.dead, 'чугун цел'); eq(S.left - HOLD, 0);
});

test('ядро не проходит сквозь сплошную кладку (8000 шагов, разные углы)', () => {
  const { game, S } = setup(['..............', '..............', 'aaaaaaaaaaaaaa'.replace(/a/g, '#')], { park: false });
  const rowY = S.bricks[0].y;
  for (let k = 0; k < 8; k++) ball(S, 40 + k * 50, 400, Math.cos(-0.4 - k * 0.3) * 520, Math.sin(-0.4 - k * 0.3) * 520 - 200);
  S.paddle.w = 1000; S.paddle.x = 240;
  for (let i = 0; i < 8000; i++){ game.update(1 / 60); S.paddle.x = 240; S.paddle.w = 1000; for (const b of S.balls) ok(b.y - L.BALL_R >= rowY + 16 - 1, 'ядро пролетело кладку: y=' + b.y.toFixed(1)); }
  eq(S.balls.length, 8);
});

test('потеря ядра → минус жизнь, новая подача; три потери → конец игры', () => {
  const ev = []; const { game, S } = setup(EMPTY, { onEvent: t => ev.push(t), park: false });
  ball(S, 240, L.H - 2, 0, 300); run(game, 0.1);
  eq(S.lives, 2); eq(S.phase, 'dead'); run(game, 1.3); eq(S.phase, 'play'); ok(S.balls.length === 1 && S.balls[0].stuck, 'подача на мастерке');
  for (let k = 0; k < 2; k++){ S.balls = [{ x: 240, y: L.H + 20, vx: 0, vy: 300, stuck: false }]; run(game, 1.3); }
  eq(S.lives, 0); ok(S.over && !S.won); ok(ev.includes('gameover'));
});

test('подача: ядро держится на мастерке и стартует по action() или само через 3 с', () => {
  const g1 = K.Game({ rng: mulberry32(2) }).start(), S1 = g1._S;
  ok(S1.balls[0].stuck); g1.setDir(1); run(g1, 0.3); near(S1.balls[0].x, S1.paddle.x + S1.balls[0].off, 1e-6, 'едет с мастерком');
  g1.action(); ok(!S1.balls[0].stuck && S1.balls[0].vy < 0, 'пуск вверх');
  const g2 = K.Game({ rng: mulberry32(3) }).start(); run(g2, 3.2); ok(!g2._S.balls[0].stuck, 'автопуск');
});

test('бонусы: РАЗМАХ/ТЕСНОТА меняют ширину и гасят друг друга, ЗАПАС +1 (не выше 5)', () => {
  const { game, S } = setup(EMPTY);
  game._applyPower('wide'); run(game, 1); eq(S.paddle.w, L.PW_WIDE, 'широкий');
  game._applyPower('narrow'); eq(S.pow.wide, 0); run(game, 1); eq(S.paddle.w, L.PW_NARROW, 'узкий');
  run(game, L.POWERS.narrow.t + 1); eq(S.paddle.w, L.PW_BASE, 'вернулся к базовому');
  S.lives = 4; game._applyPower('life'); eq(S.lives, 5); game._applyPower('life'); eq(S.lives, 5, 'потолок');
});

test('бонусы: ТРОЙНЯ делит ядро на три, ОСТУДА замедляет', () => {
  const { game, S } = setup(EMPTY, { park: false });
  ball(S, 240, 300, 100, -280); game._applyPower('triple'); eq(S.balls.length, 3);
  const dirs = S.balls.map(b => Math.atan2(b.vy, b.vx).toFixed(2)); eq(new Set(dirs).size, 3, 'разные направления');
  S.speed = S.prm.speed * 1.3; run(game, 0.05); const fast = Math.hypot(S.balls[0].vx, S.balls[0].vy);
  game._applyPower('chill'); run(game, 0.05); const slow = Math.hypot(S.balls[0].vx, S.balls[0].vy);
  ok(slow < fast * 0.8, 'медленнее: ' + fast.toFixed(0) + ' → ' + slow.toFixed(0));
});

test('бонус СМОЛА: ядро прилипает к мастерку, пуск по action(), иначе само через 2 с', () => {
  const { game, S } = setup(EMPTY, { park: false }); S.paddle.x = 240; game._applyPower('glue');
  const b = ball(S, 250, L.PADDLE_Y - 20, 0, 300); run(game, 0.1);
  ok(b.stuck, 'прилипло'); near(b.off, 10, 2, 'в точке касания');
  game.setDir(-1); run(game, 0.2); game.setDir(0); near(b.x, S.paddle.x + b.off, 1e-6, 'едет с мастерком');
  game.action(); ok(!b.stuck && b.vy < 0 && b.vx > 0, 'пуск под углом точки касания');
  const b2 = S.balls[0]; for (let i = 0; i < 600 && !b2.stuck; i++){ game.setTarget(b2.x); game.update(1 / 60); }
  ok(b2.stuck, 'снова прилипло'); run(game, 2.1); ok(!b2.stuck, 'автопуск смолы');
});

test('бонус РЕЗАК: action() пускает пару лучей, они разбивают блоки, с откатом', () => {
  const { game, S } = setup(['..............', '..............', 'aaaaaaaaaaaaaa'], { park: false }); S.paddle.x = 240; S.paddle.w = 72;
  ball(S, 30, 500, 0, 0.0001); S.balls[0].vx = 1; S.balls[0].vy = 1; S.balls[0].y = 450;
  game.action(); eq(S.bolts.length, 0, 'без резака — не стреляет');
  game._applyPower('cutter'); game.action(); eq(S.bolts.length, 2, 'пара лучей'); game.action(); eq(S.bolts.length, 2, 'откат');
  const left = S.left; run(game, 1); eq(S.left, left - 2, 'два блока разбиты лучами');
});

test('слитки падают и ловятся мастерком; «подарок» роняет слиток всегда', () => {
  const ev = []; const { game, S } = setup(['......+.......'], { onEvent: (t, d) => ev.push([t, d]) });
  const k = S.bricks[0]; game._damage(k); eq(S.caps.length, 1, 'слиток выпал');
  game.setTarget(S.caps[0].x); run(game, 5);
  eq(S.caps.length, 0); ok(ev.some(e => e[0] === 'power'), 'бонус применён');
});

test('скорость ядра растёт от ударов по блокам до потолка; уровни быстрее', () => {
  const { game, S } = setup(EMPTY); const s0 = S.speed;
  const dummy = () => ({ iron: false, hp: 5, max: 5, r: 0, c: 0, x: 0, y: 0, w: 32, h: 16 });
  for (let i = 0; i < 400; i++) game._damage(dummy());
  ok(S.speed > s0, 'разгон'); near(S.speed, S.prm.maxSpeed, 1e-6, 'потолок');
  for (let lv = 1; lv < 10; lv++){ const a = L.params(lv), b = L.params(lv + 1); ok(b.speed > a.speed && b.maxSpeed > a.maxSpeed, 'уровень ' + lv); }
});

test('difficulty-хук движка: параметры берутся из переданной функции', () => {
  const calls = []; const game = K.Game({ rng: mulberry32(4), level: 3, difficulty: (lv, b, s, m) => { calls.push(lv); return b + (lv - 1) * s; } }).start();
  ok(calls.length > 0 && calls.every(v => v === 3)); eq(game._S.speed, 295 + 2 * 24, 'скорость по хуку');
});

test('уровень пройден → следующий; после 10-го — победа', () => {
  const ev = []; const game = K.Game({ rng: mulberry32(5), onEvent: t => ev.push(t) }).start(); const S = game._S;
  for (const b of S.bricks) if (!b.iron && !b.dead) game._damage(Object.assign(b, { hp: 1 }));
  game.update(1 / 60); eq(S.phase, 'clear'); ok(ev.includes('clear'));
  run(game, 2.2); eq(S.level, 2); eq(S.phase, 'play'); ok(S.balls[0].stuck, 'новая подача');
  const g10 = K.Game({ rng: mulberry32(6), level: 10, onEvent: t => ev.push(t) }).start();
  g10._S.boss.hp = 0; g10.update(1 / 60); run(g10, 2.2); ok(g10._S.won && g10._S.over, 'победа'); ok(ev.includes('win'));
});

test('Плавильня: ядро бьёт сердце (−1, откат), печь двигается и плюётся искрами, искра оглушает мастерок', () => {
  const ev = []; const game = K.Game({ rng: mulberry32(7), level: 10, onEvent: t => ev.push(t) }).start(); const S = game._S, B = S.boss;
  ok(B && B.hp === B.max && B.y === L.FY0, 'печь под потолком');
  S.balls = []; park(S); S.served = true; S.bricks.forEach(b => { b.dead = true; S.grid[b.r * L.COLS + b.c] = null; });
  const x0 = B.x; const b = ball(S, B.x, B.y + B.h + 30, 0, -320); run(game, 0.2);
  eq(B.hp, B.max - 1, 'попадание'); ok(b.vy > 0, 'отскок вниз'); ok(B.x !== x0, 'печь движется');
  run(game, 4); ok(ev.includes('spark'), 'искры');
  S.sparks = [{ x: S.paddle.x, y: L.PADDLE_Y - 10, vx: 0, vy: 200 }]; game.update(1 / 20);
  ok(S.paddle.stun > 0, 'оглушён'); const px = S.paddle.x; game.setDir(1); run(game, 0.3); eq(S.paddle.x, px, 'не двигается'); run(game, 0.8); ok(S.paddle.x > px, 'отошёл');
  const shots = S.sparks.length; void shots;
  B.hp = 1; B.hitCd = 0; S.balls = []; park(S); ball(S, B.x, B.y + B.h + 30, 0, -320); run(game, 0.2); eq(B.hp, 0); ok(ev.includes('bossDie')); eq(S.phase, 'clear');
});

test('лучи резака не ранят сердце Плавильни', () => {
  const game = K.Game({ rng: mulberry32(8), level: 10 }).start(), S = game._S, B = S.boss;
  S.bricks.forEach(b => { b.dead = true; S.grid[b.r * L.COLS + b.c] = null; });
  S.paddle.x = B.x; game.action(); game._applyPower('cutter'); B.vx = 0;
  for (let i = 0; i < 10; i++){ game.action(); run(game, 0.35); }
  eq(B.hp, B.max);
});

test('«тяга печи»: при ≤5 блоках ядро, летящее вверх, доворачивает к кладке', () => {
  const { game, S } = setup(['.............a']); S.left -= HOLD; S.sinceBreak = 10;
  const b = ball(S, 60, 500, -40, -300), a0 = Math.atan2(b.vy, b.vx); S.paddle.w = 1000;
  run(game, 0.3); ok(S.draft, 'тяга включена'); ok(Math.atan2(b.vy, b.vx) > a0, 'повернуло к блоку справа');
});

test('ввод: клавиши двигают мастерок, указатель — к точке; стены ограничивают', () => {
  const { game, S } = setup(EMPTY); S.paddle.x = 240;
  game.setDir(1); run(game, 0.25); near(S.paddle.x, 240 + 560 * 0.25, 1, 'вправо клавишами 560 px/с'); run(game, 2); eq(S.paddle.x, L.FX1 - S.paddle.w / 2, 'упор в стену');
  game.setDir(0); game.setTarget(100); run(game, 0.5); near(S.paddle.x, 100, 1e-6, 'к указателю');
  game.setDir(1); ok(true); run(game, 0.1); ok(S.paddle.x > 100, 'клавиши перебивают указатель');
});

// Проходимость: «идеальный» бот (без задержки и ошибок) разбирает каждый уровень за разумное время
const PASS = [];
for (let lv = 1; lv <= 10; lv++) for (const s of [1, 2]) PASS.push({ lv, s, r: playKladka(K, s, { perfect: true, startLevel: lv, levels: 1, maxLevelT: 300 }) });
test('проходимость: каждый из 10 уровней разбирается идеальным ботом ≤ 300 с', () => {
  const bad = PASS.filter(p => !p.r.won).map(p => p.lv + '/' + p.s);
  console.log('     время, с: ' + PASS.map(p => p.lv + ':' + (p.r.levelTime[p.lv] || 0).toFixed(0)).join(' '));
  ok(!bad.length, 'не пройдено: ' + bad.join(', '));
});

// Баланс: «человеческий» бот (tests/bot.mjs) — реакция 150–250 мс, оценка угла с ошибкой ~4.6°,
// рука до 800 px/с, рикошеты только от стен. Ввод только setTarget/action. 40 сидов, ~8 с.
// Цели: 1-й уровень ≥ 90%, все 10 уровней ≈ 20–40% (допуск 20–45% на 40 партиях).
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playKladka(K, s));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.passed >= 1).length; console.log('     уровень 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: все 10 уровней — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(11).fill(0); BAL.forEach(r => dist[r.passed]++);
  console.log('     все 10: ' + n + '/' + N + '; пройдено уровней 0..10: ' + dist.join(','));
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял на уровне: ' + BAL.filter(r => r.stuck).map(r => r.stuck).join(','));
});
test('непресность: потерь ядер на уровень больше во второй половине', () => {
  const per = []; for (let w = 1; w <= 10; w++){ const reach = BAL.filter(r => r.passed >= w - 1).length; let l = 0; for (const r of BAL) l += (r.lost[w] || 0); per.push(l / Math.max(1, reach)); }
  console.log('     потерь на уровень: ' + per.map(v => v.toFixed(2)).join(' / '));
  const a = per.slice(0, 5).reduce((x, y) => x + y) / 5, b = per.slice(5).reduce((x, y) => x + y) / 5;
  ok(b > a * 1.5, 'нет нарастания: ' + a.toFixed(2) + ' → ' + b.toFixed(2));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

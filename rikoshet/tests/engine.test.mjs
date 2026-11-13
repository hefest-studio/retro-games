/* РИКОШЕТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node rikoshet/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/levels.js + js/game.js) в node:vm с шимом window. */
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
const RIK = sandbox.RIK, L = RIK.logic, K = L.K;
const { playRik, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, d, m){ if (Math.abs(a - b) > d) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }
const E = '................';
// игра на своей стене; ev — журнал событий
function mk(rows, opts = {}){
  const ev = [];
  const game = RIK.Game(Object.assign({ rng: mulberry32(1), noPrizes: true, rowsFor: rows ? () => rows : undefined, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state();
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function steps(game, sec){ for (let i = 0; i < Math.round(sec / K.STEP); i++) game.tick(K.STEP); }
const brickAt = (S, r, c) => S.bricks.find(b => b.r === r && b.c === c);

// ---------- уровни ----------
test('уровни: 30 стен 16×≤16, только известные клетки; боссы на 10/20/30, ряды 0–6 им свободны', () => {
  eq(RIK.LEVELS.length, 30);
  RIK.LEVELS.forEach((lv, i) => {
    eq(lv.id, i + 1); ok(lv.rows.length <= K.ROWS, 'рядов ' + lv.rows.length);
    lv.rows.forEach((r, j) => { eq(r.length, 16, 'ур.' + (i + 1) + ' ряд ' + j); ok(/^[.a-f23#XMRKG]+$/.test(r), 'клетки ур.' + (i + 1)); });
    ok(lv.rows.some(r => /[a-f23XMRK]/.test(r)), 'есть разрушимые');
  });
  eq(RIK.LEVELS.filter(l => l.boss).map(l => l.id).join(), '10,20,30');
  RIK.LEVELS.filter(l => l.boss).forEach(l => ok(l.rows.slice(0, 7).every(r => r === E), 'место босса ' + l.id));
  const kinds = new Set(RIK.LEVELS.flatMap(l => l.rows.join('').split('')));
  for (const ch of 'abcdef23#XMRKG') ok(kinds.has(ch), 'в кампании есть блок «' + ch + '»');
});
test('уровни: раскладки уникальны (нет двух одинаковых стен)', () => {
  const seen = new Set(); RIK.LEVELS.forEach(l => { const k = l.rows.join('/'); ok(!seen.has(k), 'дубль ' + l.id); seen.add(k); });
});
test('достижимость: на всех 30 стенах каждый разрушаемый блок достижим (с учётом ключей и решёток)', () => {
  RIK.LEVELS.forEach(l => { const r = L.reach(l.rows); ok(r.ok, 'ур.' + l.id + ' недостижимы ' + JSON.stringify(r.bad.slice(0, 4))); });
});
test('достижимость: проверка ловит замурованный блок и ключ за решёткой', () => {
  ok(!L.reach([E, '..###...........', '..#a#...........', '..###...........']).ok, 'замурованный');
  ok(L.reach([E, '..#G#...........', '..#a#...........', '..###.......K...']).ok, 'ключ снаружи открывает');
  ok(!L.reach([E, '..#G#...........', '..#K#...........', '..###...........']).ok, 'ключ за своей решёткой — тупик');
});
test('«Бесконечный»: 60 сгенерированных стен — симметричные, 16 клеток, все достижимы', () => {
  for (let s = 1; s <= 6; s++){ const rng = mulberry32(s); for (let n = 1; n <= 10; n++){
    const rows = RIK.genLevel(n, rng); ok(rows.length >= 6 && rows.length <= K.ROWS);
    rows.forEach(r => { eq(r.length, 16); eq(r, r.split('').reverse().join(''), 'симметрия'); });
    ok(L.reach(rows).ok, 'сид ' + s + ' стена ' + n); ok(rows.some(r => /[a-f23XRM]/.test(r)));
  } }
});

// ---------- геометрия и физика ----------
test('CCD: касание грани и скруглённого угла прямоугольника', () => {
  let h = L.sweepRect(0, 0, 100, 0, 50, -10, 60, 10, 5); near(h.t, 0.45, 1e-9); eq(h.nx, -1);
  h = L.sweepRect(0, 30, 0, -100, -10, 0, 10, 10, 5); near(h.t, 0.15, 1e-9); eq(h.ny, 1);
  h = L.sweepRect(-20, -20, 40, 40, 0, 0, 10, 10, 5); ok(h && h.nx < 0 && h.ny < 0, 'угол'); near(Math.hypot(-20 + 40 * h.t, -20 + 40 * h.t), 5, 1e-6);
  ok(!L.sweepRect(0, 0, 10, 0, 50, -10, 60, 10, 5), 'не дотянулся'); ok(!L.sweepRect(0, 0, -100, 0, 50, -10, 60, 10, 5), 'летит прочь');
});
test('угол отскока зависит от точки удара по ракетке: центр — вверх, край — 60°, монотонно', () => {
  const { game, S } = mk([E, 'a...............']); const P = S.paddle; P.vx = 0;
  let prev = -Infinity;
  for (const off of [-1, -0.5, 0, 0.5, 1]){
    const b = game._ball(P.x + off * P.w / 2, K.PY - K.BR, 0, 400); P.vx = 0; game._paddleBounce(b);
    const a = Math.atan2(b.vx, -b.vy) * 180 / Math.PI; ok(b.vy < 0, 'вверх'); ok(a > prev, 'монотонно'); prev = a;
    if (off === 0) near(a, 0, 0.5, 'центр'); if (off === 1) near(a, 60, 1, 'край'); if (off === -1) near(a, -60, 1, 'край');
  }
});
test('закрут: скорость ракетки подкручивает шар по ходу движения, угол не круче 70°', () => {
  const { game, S } = mk([E, 'a...............']); const P = S.paddle;
  const b1 = game._ball(P.x, K.PY - K.BR, 0, 400); P.vx = 600; game._paddleBounce(b1); ok(b1.vx > 30, 'вправо: ' + b1.vx);
  const b2 = game._ball(P.x, K.PY - K.BR, 0, 400); P.vx = -600; game._paddleBounce(b2); ok(b2.vx < -30, 'влево');
  const b3 = game._ball(P.x + P.w / 2, K.PY - K.BR, 0, 400); P.vx = 3000; game._paddleBounce(b3);
  const s = Math.hypot(b3.vx, b3.vy); ok(-b3.vy >= K.MAX_ANG_COS * s - 1e-6, 'угол ограничен: ' + (Math.acos(-b3.vy / s) * 180 / Math.PI).toFixed(1));
});
test('скорость шара растёт со временем и упирается в потолок уровня', () => {
  const { game, S } = mk([E, '#........###....', '.........#a#....', '.........###....']);   // единственный обязательный блок замурован
  game.action(); S.fx.H = 1e9; const b = S.balls[0];
  steps(game, 1); const v1 = Math.hypot(b.vx, b.vy); steps(game, 10); const v2 = Math.hypot(b.vx, b.vy); steps(game, 80); const v3 = Math.hypot(b.vx, b.vy);
  ok(v2 > v1 + 40, v1 + ' → ' + v2); near(v3, S.cap, 0.5, 'потолок');
});
test('анти-петля: горизонтальный шар не остаётся горизонтальным (угол к горизонтали ≥ 15°)', () => {
  const { game, S } = mk([E, 'a...............']); S.balls = [];
  const b = game._ball(300, 300, 500, 0); S.fx.H = 1e9;
  for (let i = 0; i < 240; i++){ game._moveBall(b, K.STEP); }
  const s = Math.hypot(b.vx, b.vy); ok(Math.abs(b.vy) >= K.MIN_SIN * s - 1e-6, 'vy=' + b.vy.toFixed(1));
});
test('анти-петля: вертикальная «вечная» петля между барьером и неразрушимым потолком разрывается', () => {
  const rows = [E, E, E, E, E, '################', E, E, E, E, E, E, E, '..a.............'];
  const { game, S, has } = mk(rows); S.balls = []; S.fx.H = 1e9; S.paddle.x = 560;
  const b = game._ball(300, 300, 0, -400); b.t = 1;
  for (let i = 0; i < 40 * 120; i++){ S.fx.H = 1e9; game.tick(K.STEP); }
  ok(S.stats.nudges >= 1 && has('nudge'), 'подталкиваний: ' + S.stats.nudges); ok(Math.abs(b.vx) > 20, 'шар ушёл с вертикали: vx=' + b.vx.toFixed(1));
});
test('CCD: шар на любой скорости (до 30 000 px/с) не проходит сквозь сплошную стену', () => {
  const rows = [E, E, E, E, E, '################'];   // ряд 5: y 144…160
  const { game, S } = mk(rows); S.balls = []; const rng = mulberry32(5);
  for (let k = 0; k < 400; k++){
    const sp = 500 + rng() * 29500, a = (rng() - 0.5) * 2.4, b = game._ball(30 + rng() * 580, 200 + rng() * 200, Math.sin(a) * sp, -Math.cos(a) * sp);
    for (let i = 0; i < 6; i++){ game._moveBall(b, K.STEP); ok(b.y - K.BR >= 160 - 1e-6, 'прошёл сквозь: v=' + sp.toFixed(0) + ' y=' + b.y.toFixed(2)); }
    S.balls = [];
  }
});
test('CCD: быстрый шар бьёт ПЕРВЫЙ блок на пути, а не перепрыгивает к следующему', () => {
  const rows = [E, E, E, E, '3333333333333333', E, E, '3333333333333333'];
  const { game, S } = mk(rows); S.balls = [];
  const b = game._ball(200, 300, 0, -20000); game._moveBall(b, K.STEP);
  const hit = S.bricks.filter(q => q.hp < q.maxHp); eq(hit.length, 1); eq(hit[0].r, 7, 'нижний ряд'); ok(b.vy > 0, 'отскочил вниз');
});
test('шар не застревает внутри блоков: 3 мин игры на стене-лабиринте — ни разу центр не внутри живого блока', () => {
  const lv = RIK.LEVELS[17].rows, { game, S } = mk(lv, { lives: 99 }); let bad = 0;
  for (let i = 0; i < 180 * 120; i++){
    const b0 = S.balls.find(b => b.vy > 0) || S.balls[0]; if (b0) game.setPointer(b0.x + 10);
    if (S.balls.some(b => b.stuck != null)) game.action();
    game.tick(K.STEP);
    for (const b of S.balls) for (const q of S.bricks) if (q.alive && b.x > q.x + 0.5 && b.x < q.x + q.w - 0.5 && b.y > q.y + 0.5 && b.y < q.y + q.h - 0.5) bad++;
  }
  eq(bad, 0);
});

// ---------- блоки ----------
test('блоки: обычный — 1 удар, железо — 2, сталь — 3, неразрушимый — никогда', () => {
  const { game, S } = mk([E, 'a23#............']);
  const [a, s2, s3, u] = [0, 1, 2, 3].map(c => brickAt(S, 1, c));
  game._damage(a, 1); ok(!a.alive);
  game._damage(s2, 1); ok(s2.alive); game._damage(s2, 1); ok(!s2.alive);
  game._damage(s3, 1); game._damage(s3, 1); ok(s3.alive); game._damage(s3, 1); ok(!s3.alive);
  for (let i = 0; i < 20; i++) game._damage(u, 1); ok(u.alive, 'неразрушимый цел');
});
test('взрывные: цепная реакция по ряду бочонков сносит соседей, но не неразрушимые', () => {
  const { game, S, count } = mk([E, 'XXXXXXXX........', 'aaaaaaaaa#......', 'a...............']);
  game._damage(brickAt(S, 1, 0), 1); steps(game, 1);
  ok(S.bricks.filter(b => b.r === 1).every(b => !b.alive), 'вся цепь'); eq(count('boom'), 8);
  ok(S.bricks.filter(b => b.r === 2 && b.type === 'n').every(b => !b.alive), 'ряд под цепью'); ok(brickAt(S, 2, 9).alive, 'неразрушимый');
});
test('движущиеся: катятся по ряду и отскакивают от стен и блоков', () => {
  const { game, S } = mk([E, 'M.........a.....', 'a...............'], { autoLaunch: false }); const m = S.movers[0], x0 = m.x;
  steps(game, 1); ok(m.x !== x0, 'едет');
  let min = 1e9, max = -1e9; for (let i = 0; i < 20 * 120; i++){ game.tick(K.STEP); min = Math.min(min, m.x); max = Math.max(max, m.x + m.w); }
  ok(min >= K.FX0 - 1e-6, 'не за стеной'); ok(max <= brickAt(S, 1, 10).x + 1e-6, 'не въезжает в блок'); ok(max - min > K.BW * 6, 'ход ' + (max - min));
});
test('регенерирующие: отрастают через 7 с, пока есть другие обязательные блоки; последними — не отрастают', () => {
  const { game, S, has } = mk([E, 'R.a.............'], { autoLaunch: false }); const r = brickAt(S, 1, 0), a = brickAt(S, 1, 2);
  game._damage(r, 1); ok(!r.alive); steps(game, 6.5); ok(!r.alive); steps(game, 1); ok(r.alive && has('regrow'), 'отросла');
  game._damage(a, 1); game._damage(r, 1); steps(game, 1); ok(!r.alive, 'больше не отрастает'); ok(has('clear'), 'стена пройдена');
});
test('ключи: решётки неразрушимы, пока не разбиты ВСЕ ключи; потом исчезают', () => {
  const { game, S, has } = mk([E, 'GGGG.K..K.......', 'aaaa............']);
  const gate = brickAt(S, 1, 0); game._damage(gate, 1); ok(gate.alive, 'решётка держит');
  game._damage(brickAt(S, 1, 5), 1); ok(gate.alive, 'один ключ — мало'); eq(S.keysLeft, 1);
  game._damage(brickAt(S, 1, 8), 1); ok(!gate.alive && has('gates'), 'открыто');
  ok(S.bricks.filter(b => b.type === 'g').every(b => !b.alive));
});
test('стена пройдена, когда разбиты все обязательные блоки (неразрушимые и решётки не нужны)', () => {
  const { game, S, has } = mk([E, 'a#G2............']);
  eq(S.reqLeft, 2); game._damage(brickAt(S, 1, 0), 1); game._damage(brickAt(S, 1, 3), 2); steps(game, 0.1);
  eq(S.reqLeft, 0); ok(has('clear')); eq(S.phase, 'clear');
});

// ---------- призы ----------
test('призы: шире/уже, мульти-шар, медленнее/быстрее, +жизнь (не больше 6)', () => {
  const { game, S } = mk([E, 'aaaa............']); const P = S.paddle;
  game._apply('E'); eq(P.w, K.PADW[2]); game._apply('E'); game._apply('E'); eq(P.w, K.PADW[3]);
  game._apply('S'); eq(P.w, K.PADW[2]);
  game.action(); steps(game, 0.2); game._apply('B'); eq(S.balls.length, 3); game._apply('B'); eq(S.balls.length, K.MAXBALLS);
  const b = S.balls[0]; game._apply('W'); steps(game, 0.01); const vs = Math.hypot(b.vx, b.vy); game._apply('Q'); steps(game, 0.01); const vq = Math.hypot(b.vx, b.vy);
  ok(vq > vs * 1.7, 'быстрее/медленнее: ' + vs.toFixed(0) + ' / ' + vq.toFixed(0)); ok(S.fx.W === 0, 'взаимоисключение');
  for (let i = 0; i < 10; i++) game._apply('+'); eq(S.lives, K.MAXLIVES);
});
test('приз падает из блока и ловится ракеткой', () => {
  const { game, S, has } = mk([E, 'aaaaaaaaaaaaaaaa'], { noPrizes: false, prizeMul: 100 });
  game._damage(brickAt(S, 1, 7), 1); eq(S.prizes.length, 1); const p = S.prizes[0]; S.paddle.x = p.x; game.setPointer(p.x);
  steps(game, 4); eq(S.prizes.length, 0); ok(has('catch'));
});
test('лазеры: ракетка стреляет парой зарядов, заряд бьёт блок', () => {
  const { game, S, has } = mk([E, '2222222222222222']); game.action(); game._apply('L');
  game.setFire(true); steps(game, 0.05); ok(has('laser') && S.bolts.length >= 2);
  game.setFire(false); steps(game, 1); ok(S.bricks.some(b => b.hp < b.maxHp || !b.alive), 'попал');
});
test('липкая: шар прилипает к ракетке, действие отпускает; огненный шар проходит насквозь', () => {
  const { game, S } = mk([E, 'a...............']); game._apply('C');
  game.action(); const b = S.balls[0]; b.x = S.paddle.x + 10; b.y = K.PY - 30; b.vx = 0; b.vy = 300;
  steps(game, 0.2); ok(b.stuck != null, 'прилип'); game.action(); ok(b.stuck == null && b.vy < 0, 'отпущен');
  const g2 = mk([E, '..a.............', '..3.............', '..b.............', '..2.............']); g2.game._apply('F'); g2.S.balls = [];
  const fb = g2.game._ball(2 * K.BW + K.BX0 + 19, 200, 0, -500); for (let i = 0; i < 34; i++) g2.game._moveBall(fb, K.STEP);
  ok(g2.S.bricks.every(q => !q.alive), 'вся колонка разбита'); ok(fb.vy < 0, 'без отскока');
});
test('барьер: шар отскакивает от низа, пока действует; без него — минус жизнь', () => {
  const { game, S, has } = mk([E, 'a...............']); S.balls = []; S.paddle.x = 560; game._apply('H');
  const b = game._ball(100, 400, 0, 400); b.t = 1; steps(game, 0.6); ok(has('barrier') && S.balls.length === 1 && b.vy < 0, 'спас');
  S.fx.H = 0; b.x = 100; b.y = 450; b.vx = 0; b.vy = 400; steps(game, 0.3); ok(has('lose')); eq(S.lives, 2);
});

// ---------- жизни, боссы, кампания ----------
test('жизни: потеря всех шаров — минус жизнь и новый шар на ракетке; 0 жизней — конец', () => {
  const { game, S, has, count } = mk([E, 'a...............']);
  for (let k = 0; k < 3; k++){ game.action(); S.balls.forEach(b => { b.y = 470; b.vy = 400; b.vx = 0; }); S.paddle.x = 560; game.setPointer(560); steps(game, 1.3); }
  eq(count('lose'), 2); ok(has('gameover') && S.over); eq(S.lives, 0);
});
test('боссы: залп механизма оглушает и сужает ракетку; попадания снимают броню; гибель — стена пройдена', () => {
  for (const lv of [10, 20, 30]){
    const { game, S, has } = mk(null, { level: lv }); const B = S.boss;
    ok(B && B.kind === lv / 10, 'босс ' + lv); const w0 = S.paddle.w;
    S.shots.push({ x: S.paddle.x, y: K.PY - 2, vx: 0, vy: 100, r: 5 }); steps(game, 0.1);
    ok(has('zap') && S.paddle.stun > 0 && S.paddle.w < w0, 'залп ' + lv);
    const x = S.paddle.x; game.setPointer(100); steps(game, 0.3); eq(S.paddle.x, x, 'оглушённая не двигается');
    for (let i = 0; i < 100 && !B.dead; i++){ B.inv = 0; game._hitBoss(1); }
    ok(B.dead && has('bossDie')); steps(game, 1.5); ok(has('clear') || S.won, 'пройдено');
  }
});
test('кампания: после 30-й стены — победа с бонусом за жизни', () => {
  const { game, S, has } = mk(null, { level: 30 }); for (let i = 0; i < 100 && !S.boss.dead; i++){ S.boss.inv = 0; game._hitBoss(1); }
  steps(game, 1.5); ok(S.won && has('win'));
});
test('кампания: стены идут по порядку, жизни и счёт сохраняются между стенами', () => {
  const { game, S } = mk(null, { level: 1 }); S.score = 777; S.lives = 2;
  S.bricks.forEach(b => { if (b.req) game._damage(b, 99); }); steps(game, 2);
  eq(S.level, 2); eq(S.lives, 2); ok(S.score > 777); eq(S.phase, 'play'); eq(S.balls.length, 1); ok(S.balls[0].stuck != null);
});

// ---------- проходимость в настоящей физике ----------
test('проходимость: «идеальный» бот разбивает каждую из 30 стен кампании (без бесконечных петель)', () => {
  const slow = [];
  for (let l = 1; l <= 30; l++){ const r = playRik(RIK, l, { level: l, perfect: true, lives: 99, maxT: 700 }); ok(r.cleared === 1, 'стена ' + l + ' не пройдена за 700 с'); if (r.time > 300) slow.push(l + ':' + r.time); }
  if (slow.length) console.log('     долгие стены (с): ' + slow.join(', '));
});
test('проходимость: «Бесконечный» — идеальный бот проходит 5 стен подряд на 3 сидах', () => {
  for (const s of [1, 2, 3]){ const r = playRik(RIK, s, { mode: 'endless', perfect: true, lives: 99, levels: 5, maxT: 2400 }); eq(r.cleared, 5, 'сид ' + s); }
});

// ---------- музыка, i18n, рекорды, имена ----------
test('музыка: оригинальный трек rikoshet подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.rikoshet; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0);
  const NOTE = /^([A-G][#b]?\d|-|\.)$/; (Array.isArray(T.melody) ? T.melody.join(' ') : T.melody).replace(/\|/g, ' ').trim().split(/\s+/).concat(T.bass.replace(/\|/g, ' ').trim().split(/\s+/)).forEach(t => ok(NOTE.test(t), 'нота ' + t));
});
test('i18n: у RU и EN одинаковые ключи; названия всех 30 стен и призов', () => {
  const ru = Object.keys(RIK.STR.ru).sort(), en = Object.keys(RIK.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let k = 1; k <= 30; k++) ok(RIK.STR.ru['lv' + k] && RIK.STR.en['lv' + k]);
  L.PRIZES.forEach(p => ok(RIK.STR.ru['p_' + p.k] && RIK.STR.en['p_' + p.k], p.k));
});
test('рекорды: отдельный ключ на каждый режим (кампания — ключ движка, бесконечный — свой)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/'arcade\.best\.rikoshet' \+ \(\(m \|\| mode\) === 'endless' \? '\.endless' : ''\)/.test(src), 'bestKey');
  ok(/g\.saveBest = function/.test(src) && /g\.loadBest = function/.test(src), 'переопределены saveBest/loadBest');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий + оригиналы жанра «разбивание блоков»)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8') + '|' +
    Buffer.from('YXJrYW5vaWR80LDRgNC60LDQvdC+0LjQtHxhcmNhbm9pZHxicmVhay0/ID9vdXR80LHRgNC10LnQui0/ID/QsNGD0YJ8ZHgtPyA/YmFsbHzQtNGFLT8gP9Cx0L7Qu3zQtNC4LT/QuNC60YEtPyA/0LHQvtC7', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('rikoshet') && !BAD.test('РИКОШЕТ') && !BAD.test('разбивание блоков') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('ball'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- «человеческий» бот (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// tests/bot.mjs: реакция 150–250 мс, рука ≤ 1500 px/с, ошибка прицела. 40 партий (сиды 1..40), 3 жизни, лимит 6 мин.
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playRik(RIK, s, { level: 1, maxT: 360 }));
test('баланс: «человеческий» бот проходит 1-ю стену почти всегда (≥ 90% партий)', () => {
  const n = BAL.filter(r => r.cleared).length, lost = BAL.reduce((a, r) => a + r.lost, 0), tt = BAL.filter(r => r.cleared).map(r => r.time);
  console.log('     пройдено: ' + n + '/' + N + '; потеряно жизней всего: ' + lost + '; время, с: ' + Math.min(...tt).toFixed(0) + '–' + Math.max(...tt).toFixed(0));
  ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: боссы заметно сложнее — «человеческий» бот теряет на них жизни', () => {
  let lost = 0, zaps = 0; for (let s = 1; s <= 8; s++){ const r = playRik(RIK, s, { level: 10, maxT: 400 }); lost += r.lost; zaps += r.zaps; }
  console.log('     босс 1: потеряно жизней ' + lost + ', попаданий залпами ' + zaps + ' за 8 партий'); ok(zaps > 8, 'механизм почти не стреляет в цель');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

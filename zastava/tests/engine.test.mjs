/* ЗАСТАВА · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node zastava/tests/engine.test.mjs. Логика (js/game.js) в node:vm с шимом window. */
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
const Z = sandbox.ZASTAVA, L = Z.logic;
const { playZastava, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Игра в фазе play на заданной волне; ev — журнал событий
function setup(wave = 1, opts = {}){
  const ev = [];
  const game = Z.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game._S; if (wave !== 1) game._setupWave(wave);
  S.phase = 'play'; S.phaseT = 0; S.banner = 0; S.fireT = 1e9; S.probeT = 1e9; S.diveT = 1e9;
  if (S.boss) S.boss.fireT = 1e9;
  if (S.fleet) S.fleet.timer = 1e9;
  ev.length = 0;
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
function cells(S){ return S.bunkers.reduce((n, b) => n + b.cells.reduce((a, c) => a + c, 0), 0); }
// «Выстрел» из точки (x,y) вверх — как выстрел лафета, но с заданного места
function shootFrom(game, S, x, y){ S.shot = { x, y }; for (let i = 0; i < 120 && S.shot; i++) game.update(1 / 60); }
function killAll(S, keep){ S.fleet.aliens.forEach(a => { if (!keep || !keep(a)) { if (a.alive) S.fleet.alive--; a.alive = false; } }); }

// ---------- структура ----------
test('волны: 10 штук — сетка, коршуны на 3/6/9, матка на 5/10; у каждой есть название RU/EN', () => {
  eq(L.WAVES.length, 10);
  eq(L.WAVES.map(w => w.kind).join(','), 'grid,grid,birds,grid,boss,birds,grid,grid,birds,boss');
  L.WAVES.forEach(w => ok(Z.STR.ru['wv_' + w.name] && Z.STR.en['wv_' + w.name], 'нет названия ' + w.name));
  eq(new Set(L.WAVES.map(w => w.name)).size, 10, 'названия различаются');
});

test('строки: RU/EN — одинаковый набор ключей, подсказки ко всем видам волн', () => {
  eq(Object.keys(Z.STR.ru).sort().join(), Object.keys(Z.STR.en).sort().join());
  ['grid', 'birds', 'boss'].forEach(k => ok(Z.STR.ru['sub_' + k] && Z.STR.en['sub_' + k]));
});

test('строй: 10×5, три вида паразитов по рядам (сверло 30, шестерня 20, гайка-клещ 10)', () => {
  const { S } = setup(1);
  eq(S.fleet.aliens.length, 50); eq(S.fleet.alive, 50);
  eq(S.fleet.aliens.filter(a => a.r === 0).every(a => a.type === 'drill'), true);
  eq(S.fleet.aliens.filter(a => a.r === 4).every(a => a.type === 'tick'), true);
  eq(L.PTS.drill + L.PTS.gear + L.PTS.tick, 60);
});

// ---------- движение строя ----------
test('строй ходит шагом по горизонтали, у края — ступенька вниз и разворот', () => {
  const { game, S, has } = setup(1); const F = S.fleet;
  F.dir = 1; const x0 = F.x, y0 = F.y; game._march();
  eq(F.x, x0 + L.STEP, 'шаг вправо'); eq(F.y, y0, 'без снижения');
  const B = game._fleetBounds(); F.x += (L.FX1 - B.x1) - 2;   // до края меньше шага
  const xb = F.x; game._march();
  eq(F.y, y0 + L.DROP, 'ступенька вниз'); eq(F.x, xb, 'на ступеньке нет шага вбок'); eq(F.dir, -1, 'разворот'); ok(has('drop'));
  game._march(); eq(F.x, xb - L.STEP, 'дальше — влево'); eq(F.y, y0 + L.DROP);
  // у левого края — то же
  const B2 = game._fleetBounds(); F.x -= (B2.x0 - L.FX0) - 1; game._march(); eq(F.dir, 1); eq(F.y, y0 + 2 * L.DROP);
});

test('строй в игре: за 60 с — несколько ступенек вниз ровно по DROP, никто не выходит за поле', () => {
  const { game, S } = setup(1); const F = S.fleet; F.timer = 0.1;
  const ys = new Set([F.y]);
  for (let i = 0; i < 3600; i++){ game.update(1 / 60); ys.add(F.y); const B = game._fleetBounds(); ok(B.x0 >= L.FX0 && B.x1 <= L.FX1, 'за краем'); }
  ok(F.drops >= 2, 'ступенек: ' + F.drops);
  const sorted = [...ys].sort((a, b) => a - b); for (let i = 1; i < sorted.length; i++) eq(sorted[i] - sorted[i - 1], L.DROP);
});

test('крайние колонны выбиты — строй доходит дальше до края', () => {
  const { game, S } = setup(1); const F = S.fleet;
  const w0 = game._fleetBounds(); killAll(S, a => a.c !== 9);
  const w1 = game._fleetBounds(); eq(w0.x1 - w1.x1, L.CW, 'правая граница строя сдвинулась на колонну');
});

test('ускорение: чем меньше строй, тем короче интервал шага; последний — самый быстрый', () => {
  const { game, S } = setup(1); const F = S.fleet;
  const iv = []; for (const n of [50, 40, 25, 10, 3, 1]){ F.alive = n; iv.push(game._interval()); }
  for (let i = 1; i < iv.length; i++) ok(iv[i] < iv[i - 1], 'монотонно: ' + iv.map(v => v.toFixed(3)).join(' '));
  near(iv[0], S.prm.iMax, 1e-9, 'полный строй'); near(iv[5], S.prm.iMin, 1e-9, 'последний');
  ok(iv[0] / iv[5] > 10, 'последний быстрее в 10+ раз');
  // и в живой игре: шагов за 3 с у одиночки во много раз больше
  const steps = alive => { const t = setup(1); t.S.fleet.timer = 0; killAll(t.S, a => a.c * 5 + a.r < alive); run(t.game, 3); return t.count('march'); };
  const many = steps(50), one = steps(1); ok(one > many * 5, 'шагов: полный ' + many + ', один ' + one);
  // от волны к волне строй стартует быстрее и ниже
  const p1 = L.params(1), p8 = L.params(8); ok(p8.iMax < p1.iMax && p8.iMin < p1.iMin && p8.startY > p1.startY);
});

test('строй, дошедший до земли, — поражение даже при запасе жизней', () => {
  const { game, S, has } = setup(1); const F = S.fleet;
  eq(S.lives, 3);
  const B = game._fleetBounds(); F.y += (L.INVADE_Y - B.bottom) - L.DROP + 1;
  F.x += (L.FX1 - game._fleetBounds().x1) - 1; F.dir = 1;   // следующий шаг — ступенька
  game._march();
  ok(S.over && !S.won && S.invaded, 'конец игры'); ok(has('invade') && has('gameover')); eq(S.lives, 0);
});

// ---------- огонь строя ----------
test('стреляют только нижние в каждой колонне; выбит нижний — стреляет следующий', () => {
  const { game, S } = setup(1);
  let sh = game._shooters(); eq(sh.length, 10); ok(sh.every(a => a.r === 4));
  const a = S.fleet.aliens.find(x => x.c === 3 && x.r === 4); a.alive = false; S.fleet.alive--;
  sh = game._shooters(); eq(sh.find(x => x.c === 3).r, 3, 'колонна 3 — ряд 3');
  killAll(S, x => x.c !== 5); eq(game._shooters().length, 9, 'пустая колонна не стреляет');
});

test('пуля строя вылетает снизу стрелка; прицельный выстрел — из колонны над лафетом', () => {
  const { game, S } = setup(1);
  S.prm.aimProb = 1; const target = S.fleet.aliens.find(x => x.c === 7 && x.r === 4);
  S.player.x = game._alienPos(target).x + 3;
  game._gridFire(); eq(S.bullets.length, 1);
  const b = S.bullets[0], q = game._alienPos(target);
  near(b.x, q.x, 1e-9, 'из колонны 7'); near(b.y, q.y + L.AH / 2 + 2, 1e-9, 'снизу стрелка'); ok(b.vy > 0, 'вниз');
  // в живой игре все пули стартуют от нижних стрелков
  const t = setup(1, { seed: 4 }); t.S.fireT = 0; const starts = [];
  for (let i = 0; i < 600; i++){ const n = t.S.bullets.length; t.game.update(1 / 60); if (t.S.bullets.length > n) starts.push(t.S.bullets[t.S.bullets.length - 1]); }
  ok(starts.length >= 3, 'выстрелов: ' + starts.length);
  for (const s of starts){
    const sh = t.game._shooters().map(a => t.game._alienPos(a));
    ok(sh.some(p => Math.abs(p.x - s.x) < 8 && s.y > p.y), 'пуля не от нижнего стрелка: ' + s.x.toFixed(0));
  }
  ok(t.S.bullets.length <= t.S.prm.maxShots, 'лимит пуль');
});

test('выстрел лафета: один на экране; сбивает искру, а сверло пробивает выстрел', () => {
  const { game, S, has } = setup(1); S.player.x = 240;
  ok(game.action(), 'первый выстрел'); ok(!game.action(), 'второй — нельзя, пока летит первый'); eq(S.shots, 1);
  S.shot = null;
  S.bullets = [{ x: 100, y: 400, vx: 0, vy: 0, kind: 'spark', t: 0 }]; shootFrom(game, S, 100, 420);
  eq(S.bullets.length, 0, 'искра сбита'); ok(has('clash'));
  S.bullets = [{ x: 100, y: 400, vx: 0, vy: 0, kind: 'drill', t: 0 }]; shootFrom(game, S, 100, 420);
  eq(S.bullets.length, 1, 'сверло цело'); eq(S.shot, null, 'выстрел поглощён');
});

test('попадание в паразита: убит, очки по виду, строй редеет', () => {
  const { game, S } = setup(1); const a = S.fleet.aliens.find(x => x.c === 2 && x.r === 4), q = game._alienPos(a);
  shootFrom(game, S, q.x, q.y + 40); ok(!a.alive); eq(S.fleet.alive, 49); eq(S.score, L.PTS.tick);
  const d = S.fleet.aliens.find(x => x.c === 2 && x.r === 0); killAll(S, x => x.r === 0 && (x.c === 2 || x.c === 9)); S.score = 0;
  shootFrom(game, S, game._alienPos(d).x, game._alienPos(d).y + 40); eq(S.score, L.PTS.drill);
});

// ---------- укрытия ----------
test('укрытия-наковальни: 4 штуки по маске, рог шире шейки, выемка снизу', () => {
  const bs = L.makeBunkers(); eq(bs.length, 4);
  const row = r => { let n = 0; for (let c = 0; c < L.BK_C; c++) n += L.inAnvil(c, r) ? 1 : 0; return n; };
  ok(row(2) > row(6) * 2, 'наличь шире шейки'); ok(!L.inAnvil(11, L.BK_R - 1), 'выемка между лапами'); ok(L.inAnvil(3, L.BK_R - 1), 'лапа');
  for (let i = 1; i < 4; i++) ok(bs[i].x > bs[i - 1].x + L.BK_C * L.BK_S, 'не перекрываются');
});

test('укрытия разрушаются: выстрел снизу, пуля сверху, строй насквозь', () => {
  const { game, S } = setup(1); const b = S.bunkers[1], cx = b.x + 11 * L.BK_S + 1;
  let n0 = cells(S); shootFrom(game, S, cx, L.PLAYER_Y - 20);
  ok(cells(S) < n0, 'выстрел выбил клетки'); eq(S.shot, null, 'и поглощён'); eq(S.fleet.alive, 50, 'паразиты целы');
  n0 = cells(S); S.bullets = [{ x: b.x + 30, y: L.BK_Y - 20, vx: 0, vy: 220, kind: 'spark', t: 0 }]; run(game, 0.3);
  ok(cells(S) < n0, 'пуля выбила клетки'); eq(S.bullets.length, 0, 'и исчезла');
  // повторные выстрелы пробивают сквозную дыру
  for (let k = 0; k < 12; k++) shootFrom(game, S, cx, L.PLAYER_Y - 20);
  let hole = true; for (let y = L.BK_Y; y < L.BK_Y + L.BK_R * L.BK_S; y += 3) if (game._cellAt(cx, y)) hole = false;
  ok(hole, 'дыра насквозь');
  // строй, опустившийся к укрытиям, стирает их
  const F = S.fleet; n0 = cells(S); F.y = L.BK_Y - 4 * L.CH - 4; F.dir = 1; game._march();
  ok(cells(S) < n0 - 20, 'строй стёр клетки');
});

// ---------- зонд ----------
test('зонд-бонус: пролетает над строем, сбит — 50…300 очков; при малом строе не появляется', () => {
  const { game, S, has } = setup(1); S.probeT = 0; game.update(1 / 60);
  ok(S.probe, 'появился'); eq(S.probe.y, L.PROBE_Y); ok(S.probe.y < S.fleet.y, 'над строем'); ok(has('probe'));
  const x0 = S.probe.x; run(game, 0.5); ok(Math.abs(S.probe.x - x0) > 30, 'летит');
  const pts = S.probe.pts; ok(L.PROBE_PTS.includes(pts)); S.score = 0;
  shootFrom(game, S, S.probe.x + S.probe.vx * 0.12, L.PROBE_Y + 80); eq(S.probe, null); eq(S.score, pts); ok(has('probeKill'));
  // улетает за край
  S.probeT = 0; game.update(1 / 60); run(game, 7); eq(S.probe, null, 'улетел');
  const t = setup(1); killAll(t.S, a => a.c === 0 && a.r < 5); eq(t.S.fleet.alive, 5); t.S.probeT = 0; run(t.game, 1); eq(t.S.probe, null, 'при <6 не летает');
});

// ---------- лафет ----------
test('лафет: клавиши — 215 px/с, упор в стены; удержание огня — очередь', () => {
  const t = setup(1); t.S.player.x = 240; t.game.setDir(1); run(t.game, 0.5); near(t.S.player.x, 240 + L.PLAYER_V * 0.5, 1);
  run(t.game, 3); eq(t.S.player.x, L.FX1 - L.PW / 2, 'стена'); t.game.setDir(-1); run(t.game, 5); eq(t.S.player.x, L.FX0 + L.PW / 2);
  const u = setup(1); u.S.bunkers = []; u.game.setFire(true); run(u.game, 3); ok(u.S.shots >= 4, 'выстрелов за 3 с: ' + u.S.shots);
});

test('подбит лафет: −1 жизнь, пули убраны, возрождение; три попадания — конец игры', () => {
  const { game, S, has } = setup(1);
  S.bullets = [{ x: S.player.x, y: L.PLAYER_Y - 30, vx: 0, vy: 240, kind: 'spark', t: 0 }, { x: 50, y: 300, vx: 0, vy: 200, kind: 'drill', t: 0 }];
  run(game, 0.2); eq(S.lives, 2); eq(S.phase, 'dead'); eq(S.bullets.length, 0); ok(has('playerHit'));
  run(game, 1.8); eq(S.phase, 'play'); ok(!S.player.dead); ok(S.player.grace > 0, 'короткая неуязвимость');
  for (let k = 0; k < 2; k++){ S.player.grace = 0; game._playerHit(S.player.x, L.PLAYER_Y); run(game, 1.8); }
  ok(S.over && !S.won); eq(S.lives, 0); ok(has('gameover'));
});

test('бонусные лафеты: +1 за 5000 и за 10000 очков', () => {
  const { game, S, has } = setup(1); S.score = 4995;
  const a = S.fleet.aliens.find(x => x.c === 0 && x.r === 4), q = game._alienPos(a);
  shootFrom(game, S, q.x, q.y + 40); eq(S.lives, 4); ok(has('life'));
  S.score = 9990; const b2 = S.fleet.aliens.find(x => x.c === 1 && x.r === 4); shootFrom(game, S, game._alienPos(b2).x, game._alienPos(b2).y + 40); eq(S.lives, 5);
  S.score = 30000; const b3 = S.fleet.aliens.find(x => x.c === 2 && x.r === 4); shootFrom(game, S, game._alienPos(b3).x, game._alienPos(b3).y + 40); eq(S.lives, 5, 'больше нет');
});

// ---------- коршуны ----------
test('коршуны: волна 3 — 8 штук по 1 попаданию; волна 6 и 9 — 10/12 штук по 2', () => {
  const a = setup(3).S; eq(a.kind, 'birds'); eq(a.birds.length, 8); ok(a.birds.every(b => b.hp === 1)); eq(a.fleet, null);
  const b = setup(6).S; eq(b.birds.length, 10); ok(b.birds.every(x => x.hp === 2));
  eq(setup(9).S.birds.length, 12);
});

test('щит коршуна: закрытый отражает выстрел, раскрытый — пробивается', () => {
  const { game, S, has } = setup(3); const b = S.birds[0];
  b.shield = true; b.shT = 99; shootFrom(game, S, b.x, b.y + 60);
  ok(b.alive && b.hp === 1, 'щит держит'); ok(has('deflect'));
  b.shield = false; b.shT = 99; S.score = 0; shootFrom(game, S, b.x, b.y + 60);
  ok(!b.alive, 'сбит'); eq(S.score, 60);
  const t = setup(6); const c = t.S.birds[2]; c.shield = false; c.shT = 99;
  shootFrom(t.game, t.S, c.x, c.y + 60); ok(c.alive && c.hp === 1, 'прочный: 1 из 2'); c.flash = 0; shootFrom(t.game, t.S, c.x, c.y + 60); ok(!c.alive);
});

test('щит коршуна сам открывается и закрывается', () => {
  const { game, count } = setup(3); run(game, 6);
  ok(count('shieldOn') >= 3 && count('shieldOff') >= 3, 'переключений: ' + count('shieldOn') + '/' + count('shieldOff'));
});

test('нырок: коршун раскрывается, пикирует к лафету, роняет бомбы и возвращается в стаю', () => {
  const { game, S, has, count } = setup(3); S.diveT = 0; S.player.x = 120; game.update(1 / 60);
  const b = S.birds.find(x => x.state === 'dive'); ok(b, 'нырнул'); ok(!b.shield, 'без щита'); ok(has('birdDive'));
  S.player.x = 400;   // уехать, чтобы не столкнуться
  let low = 0; for (let i = 0; i < Math.round(b.dur * 60) - 2; i++){ game.update(1 / 60); low = Math.max(low, b.y); }
  ok(low > 400, 'глубина нырка ' + low.toFixed(0)); ok(count('bomb') >= 2, 'бомбы');
  run(game, 0.2); eq(b.state, 'form', 'вернулся'); ok(Math.abs(b.y - b.hy) < 8);
  // сбитый в нырке — 150 очков
  const t = setup(3); t.S.diveT = 0; t.game.update(1 / 60); const d = t.S.birds.find(x => x.state === 'dive'); t.S.player.x = 30;
  run(t.game, d.dur * 0.3); t.S.score = 0; shootFrom(t.game, t.S, d.x, d.y + 30);
  if (!d.alive) eq(t.S.score, 150);
});

test('нырнувший коршун таранит лафет', () => {
  const { game, S, has } = setup(3); const b = S.birds[0];
  b.state = 'dive'; b.s = 0.5; b.x0 = S.player.x; b.tx = S.player.x; b.y0 = b.hy; b.yLow = L.PLAYER_Y; b.dur = 2; b.bombs = 2;
  game.update(1 / 60); ok(!b.alive, 'коршун разбит'); eq(S.lives, 2); ok(has('playerHit'));
});

// ---------- матка ----------
test('матка: на 5-й — один пояс, на 10-й — два встречных; пояс вращается', () => {
  const a = setup(5).S; eq(a.kind, 'boss'); eq(a.boss.rings.length, 1); eq(a.boss.hp, 10);
  const b = setup(10); eq(b.S.boss.rings.length, 2); ok(b.S.boss.rings[0].spin * b.S.boss.rings[1].spin < 0, 'встречное вращение'); eq(b.S.boss.hp, 16);
  const r0 = b.S.boss.rings[0].rot; run(b.game, 0.5); ok(b.S.boss.rings[0].rot !== r0, 'крутится');
});

test('матка: пояс закрывает ядро — сначала бьются пластины, через пробоину — ядро', () => {
  const { game, S, has } = setup(5); const B = S.boss, g = B.rings[0];
  B.vx = 0; g.spin = 0; B.repairT = 1e9;
  const seg = game._ringAt(B.x, B.y + g.r2 - 1); ok(seg && seg.ring === g);
  const hp0 = g.hp[seg.idx];
  shootFrom(game, S, B.x, B.y + 80); eq(g.hp[seg.idx], hp0 - 1, 'пластина −1'); eq(B.hp, B.max, 'ядро цело'); ok(has('bossSeg'));
  shootFrom(game, S, B.x, B.y + 80); eq(g.hp[seg.idx], 0, 'пластина выбита'); eq(B.hp, B.max);
  shootFrom(game, S, B.x, B.y + 80); eq(B.hp, B.max - 1, 'через пробоину — в ядро'); ok(has('bossCore'));
  // пояс повернулся — пробоина ушла, ядро снова закрыто
  g.rot += Math.PI; const before = B.hp; shootFrom(game, S, B.x, B.y + 80); eq(B.hp, before, 'закрыто снова');
});

test('матка: корпус и гондолы — броня, конвейер чинит пластины, огонь по лафету', () => {
  const { game, S, has } = setup(5); const B = S.boss; B.vx = 0; B.rings[0].spin = 0;
  shootFrom(game, S, B.x + 80, B.y + 60); ok(has('clang'), 'гондола'); eq(B.hp, B.max);
  const g = B.rings[0]; g.hp = g.hp.map(() => 0); B.repairT = 0; game.update(1 / 60);
  eq(g.hp.filter(h => h > 0).length, 1, 'одна новая пластина'); ok(has('repair'));
  S.player.x = 400; B.x = 200; B.fireT = 0; game.update(1 / 60);
  const bolt = S.bullets.find(b => b.kind === 'bolt'); ok(bolt && bolt.vx > 0 && bolt.vy > 0, 'болт летит к лафету');
});

test('матка: ядро погашено — волна отбита; после 10-й — победа', () => {
  const { game, S, has } = setup(10); const B = S.boss;
  B.rings.forEach(g => { g.hp = g.hp.map(() => 0); }); B.repairT = 1e9; B.vx = 0; B.hp = 1;
  shootFrom(game, S, B.x, B.y + 80); ok(!B.alive); ok(has('bossDie'));
  run(game, 0.1); eq(S.phase, 'clear'); run(game, 2.1); ok(S.over && S.won, 'победа'); ok(has('win'));
});

test('волна отбита → следующая (бонус 100×номер), укрытия восстановлены', () => {
  const { game, S, has } = setup(1); S.bunkers[0].cells.fill(0); S.score = 0;
  killAll(S); run(game, 0.1); eq(S.phase, 'clear'); eq(S.score, 100); ok(has('clear'));
  run(game, 2.1); eq(S.wave, 2); eq(S.kind, 'grid'); ok(cells(S) === L.makeBunkers().reduce((n, b) => n + b.cells.reduce((a, c) => a + c, 0), 0), 'укрытия новые');
});

test('difficulty-хук движка: параметры волны берутся из переданной функции', () => {
  const calls = []; const game = Z.Game({ rng: mulberry32(1), difficulty: (lv, base, step, max) => { calls.push(lv); return base; } }).start();
  ok(calls.length > 5 && calls.every(l => l === 1)); eq(game._S.prm.bulletV, 185);
});

test('музыка: оригинальный трек zastava подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.zastava; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});

test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист чужих названий хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('aW52YWRlcnM/fNC40L3QslvQtdCwXdC50LTQtdGAfHRhaXRvfNGC0LDQudGC0L58Z2FsYWd80LPQsNC70LDQs3xnYWxheGlhbnzQs9Cw0LvQsNC60YHQuNCw0L18XGJwaG9lbml4XGJ80YTQtdC90LjQutGBfG5pc2hpa2Fkb3zQvdC40YHQuNC60LDQtNC+fGRlbW9uID9hdHRhY2t8XGJnb3JmXGJ8bW9vbiA/Y3Jlc3RhfGNlbnR1cml8YW1zdGFyfHBhYy0/bWFufNC/0LDQutC80LDQvXx0ZXRyaXN80YLQtdGC0YDQuNGBfFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxrb25hbWl80LrQvtC90LDQvNC4fG5hbWNvfNC90LDQvNC60L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fHNlZ2FcYnzRgdC10LPQsCg/IVvQsC3Rj9GRXSl8dGVjbW98ZGl6enl8ZGVlcHNlZWt8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofHJpdmVyID9yYWlkfGV4b2xvbnzRjdC60YHQvtC70L7QvXx2aXRvcmN80LLQuNGC0L7RgNC6fGxvc3QgP3Zpa2luZ3N8ZG91YmxlID9kcmFnb258YmF0dGxldG9hZHN8c2lsa3dvcm0=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  ok(BAD.test('x') === false && !BAD.test('invaded') && !BAD.test('контрастный'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- проходимость и баланс ----------
const PASS = [];
for (let w = 1; w <= 10; w++) for (const s of [1, 2]) PASS.push({ w, s, r: playZastava(Z, s, { perfect: true, startWave: w, waves: 1, maxWaveT: 240 }) });
test('проходимость: каждая из 10 волн отбивается «идеальным» ботом ≤ 240 с', () => {
  const bad = PASS.filter(p => !p.r.won).map(p => p.w + '/' + p.s);
  console.log('     время, с: ' + PASS.map(p => p.w + ':' + (p.r.waveTime[p.w] || 0).toFixed(0)).join(' '));
  ok(!bad.length, 'не пройдено: ' + bad.join(', '));
});

// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс прицела, пропускает часть пуль,
// ввод только setDir/action. 40 партий (сиды 1..40), ~15 с.
// Цели: 1-я волна ≥ 90%, все 10 ≈ 20–40% (допуск 20–45% на 40 партиях).
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playZastava(Z, s));
test('баланс: бот отбивает 1-ю волну в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.passed >= 1).length; console.log('     волна 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: все 10 волн — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(11).fill(0); BAL.forEach(r => dist[r.passed]++);
  console.log('     все 10: ' + n + '/' + N + '; отбито волн 0..10: ' + dist.join(',') + '; дошли до земли: ' + BAL.filter(r => r.invaded).length);
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял на волне: ' + BAL.filter(r => r.stuck).map(r => r.stuck).join(','));
});
test('непресность: потерь лафетов на волну больше во второй половине', () => {
  const per = []; for (let w = 1; w <= 10; w++){ const reach = BAL.filter(r => r.passed >= w - 1).length; let l = 0; for (const r of BAL) l += (r.lost[w] || 0); per.push(l / Math.max(1, reach)); }
  console.log('     потерь на волну: ' + per.map(v => v.toFixed(2)).join(' / '));
  const a = per.slice(0, 5).reduce((x, y) => x + y) / 5, b = per.slice(5).reduce((x, y) => x + y) / 5;
  ok(b > a * 1.5, 'нет нарастания: ' + a.toFixed(2) + ' → ' + b.toFixed(2));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

/* СПУТНИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node sputnik/tests/engine.test.mjs. Логика (js/game.js) в node:vm с шимом window. */
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
const Sp = sandbox.SPUTNIK, L = Sp.logic;
const { playSputnik, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Игра в фазе play на уровне lv; ev — журнал событий. quiet: убрать врагов и расписание.
function setup(lv = 1, opts = {}){
  const ev = [];
  const game = Sp.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game._S; if (lv !== 1) game._setupLevel(lv);
  S.phase = 'play'; S.phaseT = 0; S.banner = 0;
  if (opts.quiet !== false){ S.spawnIdx = S.lv.spawns.length; S.enemies = []; }
  ev.length = 0;
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
function freeze(S){ S.hold = true; }                         // камера стоит
function safe(game, S, x){ S.ship.x = x; S.ship.y = (game._ceilY(x) + game._floorY(x)) / 2; }

// ---------- уровни ----------
test('6 уровней, у каждого свой босс; рельеф детерминирован и везде проходим (просвет ≥ gap)', () => {
  eq(L.LEVELS.length, 6); eq(new Set(L.LEVELS.map(d => d.boss)).size, 6, 'боссы разные');
  for (let n = 1; n <= 6; n++){
    const a = L.buildLevel(n), b = L.buildLevel(n), def = L.LEVELS[n - 1];
    eq(JSON.stringify(a.ceil), JSON.stringify(b.ceil), 'детерминизм');
    let minGap = 1e9; for (let i = 0; i < a.N; i++) minGap = Math.min(minGap, (L.H - L.TOP) - a.ceil[i] - a.floor[i]);
    ok(minGap >= def.gap - 0.01, 'уровень ' + n + ': просвет ' + minGap.toFixed(1) + ' < ' + def.gap);
    eq(a.cps.length, 3, 'три контрольные точки'); ok(a.cps[0] === 0 && a.cps[1] > 0 && a.cps[2] === def.len);
    eq(a.spawns.filter(s => s.type === 'guard').length, 1, 'один полубосс');
    ok(a.spawns.some(s => s.type === 'pod'), 'есть носители капсул');
  }
});
test('механизмы: поршни и шестерни на уровнях 2–6, двигаются по такту', () => {
  for (let n = 2; n <= 6; n++) ok(L.buildLevel(n).mechs.length > 0, 'уровень ' + n);
  const { game, S } = setup(3); const m = S.lv.mechs.find(x => x.kind === 'piston');
  const a = game._mechRects(m), b = game._mechRects(m, 1.3);
  ok(Math.abs((a.y1 - a.y0) - (b.y1 - b.y0)) > 1, 'поршень ходит');
});

// ---------- дрон ----------
test('дрон: в начале пристыкован к носу и следует за кораблём', () => {
  const { game, S } = setup(1); freeze(S); run(game, 0.05);
  eq(S.drone.state, 'front'); near(S.drone.x, S.ship.x + L.DRONE_OFF, 0.01); near(S.drone.y, S.ship.y, 0.01);
  game.setDir(0, 1); run(game, 0.3); game.setDir(0, 0); near(S.drone.y, S.ship.y, 0.01, 'вертикаль');
});
test('дрон: отстёгивание с носа — летит вперёд и зависает; возврат — снова к носу', () => {
  const { game, S, has } = setup(1); freeze(S); safe(game, S, S.cx + 100); run(game, 0.05);
  ok(game.drone()); eq(S.drone.state, 'launch'); ok(has('droneLaunch'));
  const x0 = S.drone.x; run(game, 0.3); ok(S.drone.x > x0 + 60, 'летит вперёд');
  run(game, 2); eq(S.drone.state, 'free'); near(S.drone.x - S.cx, L.W - 70, 12, 'у правого края');
  game.drone(); eq(S.drone.state, 'return'); run(game, 3); eq(S.drone.state, 'front', 'подлетел спереди → нос'); ok(has('droneAttach'));
});
test('дрон: подлетел сзади — крепится к корме; с кормы отстёгивается назад', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 300);
  S.drone.state = 'free'; S.drone.homeSX = 40; S.drone.x = S.cx + 40; S.drone.y = S.ship.y;
  game.setDir(-1, 0); run(game, 2); game.setDir(0, 0);
  eq(S.drone.state, 'back', 'корабль сдал назад на дрон'); near(S.drone.x, S.ship.x - L.DRONE_OFF, 0.01);
  safe(game, S, S.cx + 300); run(game, 0.05); game.drone(); eq(S.drone.state, 'launch'); ok(S.drone.vx < 0, 'назад');
  run(game, 2); eq(S.drone.state, 'free'); near(S.drone.x - S.cx, 40, 12);
  game.drone(); run(game, 3); eq(S.drone.state, 'back', 'вернулся сзади → корма');
});
test('дрон: глотает вражеские пули (корабль цел), неуязвим', () => {
  const { game, S, count } = setup(1); freeze(S); safe(game, S, S.cx + 120); run(game, 0.02);
  const D = S.drone; for (let i = 0; i < 5; i++) game._bullet(D.x + 30, D.y, -300, 0);
  run(game, 0.3); eq(S.bullets.length, 0); eq(count('absorb'), 5); eq(S.absorbed, 5); ok(!S.ship.dead && S.lives === 3);
});
test('дрон: жжёт касанием — враг в шаре теряет прочность и гибнет', () => {
  const { game, S, has } = setup(1); freeze(S); safe(game, S, S.cx + 120); run(game, 0.02);
  const e = game._enemy('walker', S.drone.x + 4, S.drone.y, { vx: 0, fireT: 99 }); e.type = 'mine'; e.vx = 0;
  const hp0 = e.hp; run(game, 0.15); ok(e.hp < hp0, 'прочность падает'); run(game, 1); ok(!e.alive, 'сгорел'); ok(has('kill'));
});
test('оптики: до двух, сверху и снизу; тоже глотают пули; гибель — оптики теряются', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 120);
  game._pickup('O'); game._pickup('O'); game._pickup('O'); eq(S.optics.length, 2); run(game, 0.6);
  near(S.optics[0].y, S.ship.y - L.OPTIC_DY, 1); near(S.optics[1].y, S.ship.y + L.OPTIC_DY, 1);
  game._bullet(S.optics[0].x + 20, S.optics[0].y, -300, 0); run(game, 0.2); eq(S.bullets.length, 0); ok(!S.ship.dead);
  game._shipHit('test'); eq(S.optics.length, 0);
});

// ---------- лучи дрона ----------
test('капсулы: тип луча и уровень дрона (R/S/V), оптика', () => {
  const { game, S } = setup(1);
  eq(S.drone.kind, null); game._pickup('R'); eq(S.drone.kind, 'R'); eq(S.drone.lvl, 1);
  game._pickup('R'); eq(S.drone.lvl, 2); game._pickup('R'); eq(S.drone.lvl, 2, 'потолок 2');
  game._pickup('V'); eq(S.drone.kind, 'V'); eq(S.drone.lvl, 2, 'смена типа сохраняет уровень');
});
test('луч «рикошет»: 3 луча (прямо и наискосок), отражается от стен', () => {
  const { game, S, has } = setup(2); freeze(S); safe(game, S, S.cx + 120); game._pickup('R'); run(game, 0.02);
  game.tap(); const ric = S.shots.filter(s => s.kind === 'ric'); eq(ric.length, 3);
  ok(ric.some(s => s.vy < 0) && ric.some(s => s.vy > 0) && ric.some(s => s.vy === 0));
  const up = ric.find(s => s.vy < 0), vy0 = up.vy; run(game, 1.0);
  ok(has('ricochet'), 'отскок от рельефа'); ok(!S.shots.includes(up) || up.vy > 0 || up.bounces < 2, 'направление сменилось');
  ok(vy0 < 0);
});
test('луч «змейка»: падает на рельеф и ползёт по нему (пол и потолок)', () => {
  const { game, S } = setup(2); freeze(S); safe(game, S, S.cx + 120); game._pickup('S'); run(game, 0.02);
  game.tap(); const cr = S.shots.filter(s => s.kind === 'crawl'); eq(cr.length, 2);
  run(game, 0.5);
  const lo = cr.find(s => s.vside > 0), hi = cr.find(s => s.vside < 0);
  eq(lo.mode, 'crawl'); near(lo.y, game._floorY(lo.x) - 5, 0.5, 'по полу');
  eq(hi.mode, 'crawl'); near(hi.y, game._ceilY(hi.x) + 5, 0.5, 'по потолку');
  const x0 = lo.x; run(game, 0.1); ok(lo.x > x0 + 20, 'ползёт вперёд');
});
test('луч «веер»: 5 коротких лучей веером (7 на 2-м уровне), с кормы — назад', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 300); game._pickup('V'); run(game, 0.02);
  game.tap(); eq(S.shots.filter(s => s.kind === 'fan').length, 5);
  const ys = S.shots.filter(s => s.kind === 'fan').map(s => s.vy); ok(Math.min(...ys) < -150 && Math.max(...ys) > 150, 'веер');
  S.shots = []; game._pickup('V'); run(game, 0.2); game.tap(); eq(S.shots.filter(s => s.kind === 'fan').length, 7);
  S.shots = []; S.drone.state = 'back'; run(game, 0.2); game.tap(); ok(S.shots.filter(s => s.kind === 'fan').every(s => s.vx < 0), 'с кормы — назад');
});
test('отстёгнутый дрон стреляет прямо вперёд', () => {
  const { game, S } = setup(1); freeze(S); game._pickup('V'); S.drone.state = 'free'; S.drone.homeSX = 400; run(game, 0.05);
  game.tap(); const d = S.shots.filter(s => s.from === 'drone'); eq(d.length, 1); eq(d[0].kind, 'dshot'); ok(d[0].vx > 0 && d[0].vy === 0);
});

// ---------- огонь и заряд ----------
test('выстрел по нажатию; удержание копит заряд, отпускание — пробивной луч', () => {
  const { game, S, has } = setup(1); freeze(S); safe(game, S, S.cx + 120);
  game.setFire(true); run(game, 0.02); eq(S.shots.filter(s => s.kind === 'shot').length, 1, 'выстрел сразу');
  run(game, L.CHARGE_DELAY + L.CHARGE_TIME + 0.1); near(S.fire.charge, 1, 1e-9); ok(has('chargeFull'));
  game.setFire(false); run(game, 0.02);
  const b = S.shots.find(s => s.kind === 'beam'); ok(b, 'луч'); eq(b.dmg, 12); ok(has('beam')); eq(S.fire.charge, 0);
});
test('короткое нажатие — без луча; луч пробивает слабых врагов насквозь', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 100);
  game.setFire(true); run(game, 0.1); game.setFire(false); run(game, 0.02); ok(!S.shots.some(s => s.kind === 'beam'));
  S.shots = [];
  const y = S.ship.y, a = game._enemy('pod', S.ship.x + 120, y, { vx: 0, cap: 'O', fireT: 99 }), b = game._enemy('pod', S.ship.x + 200, y, { vx: 0, cap: 'O', fireT: 99 });
  game._beam(1); run(game, 0.5); ok(!a.alive && !b.alive, 'оба сбиты одним лучом');
});

// ---------- рельеф, гибель, контрольные точки ----------
test('столкновение корабля с рельефом — гибель (пол/потолок и поршень)', () => {
  const { game, S, ev } = setup(2); freeze(S); const x = S.cx + 200; S.ship.x = x; S.ship.y = game._floorY(x) - 4;
  run(game, 0.02); ok(S.ship.dead); eq(ev.find(e => e.t === 'playerHit').d.why, 'wall');
  const t2 = setup(3); freeze(t2.S); const m = t2.S.lv.mechs.find(q => q.kind === 'piston');
  t2.S.cx = m.x - 200; t2.S.time = 0; const g = t2.game._mechRects(m); t2.S.ship.x = m.x; t2.S.ship.y = m.side === 'c' ? g.y1 - 3 : g.y0 + 3;
  t2.game._S.time = 0; t2.S.ship.grace = 0; run(t2.game, 0.02); ok(t2.S.ship.dead, 'поршень');
});
test('гибель: −1 жизнь, через 1.6 с — возврат к контрольной точке с неуязвимостью', () => {
  const { game, S, has } = setup(1);
  game._pickup('R'); game._pickup('R');
  S.cx = S.lv.cps[1] - 1; safe(game, S, S.cx + 90); run(game, 0.1);   // пролетели первую контрольную точку
  eq(S.cpIdx, 1); ok(has('checkpoint')); const cp = S.cp; eq(cp, S.lv.cps[1]);
  S.ship.grace = 0; game._shipHit('test'); eq(S.lives, 2); eq(S.phase, 'dead'); eq(S.drone.lvl, 1, 'дрон слабеет');
  S.cp = cp; run(game, 1.62); eq(S.phase, 'play'); ok(S.cx - cp < 3, 'камера на контрольной точке'); ok(S.ship.grace > 0); ok(has('respawn'));
  ok(!game._terrainHit(S.ship.x, S.ship.y, L.SHIP_TW, L.SHIP_TH), 'возрождение в просвете');
});
test('пули врагов: попадание в корабль — гибель; стены пули гасят', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 120); S.drone.state = 'back'; run(game, 0.02);
  game._bullet(S.ship.x, S.ship.y - 60, 0, 300); run(game, 0.5); ok(S.ship.dead, 'сверху в корабль');
  const t = setup(2); freeze(t.S); const x = t.S.cx + 300; t.game._bullet(x, t.game._floorY(x) - 10, 0, 200); run(t.game, 0.2); eq(t.S.bullets.length, 0);
});
test('поражение: все корабли потеряны → gameover', () => {
  const { game, S, has } = setup(1); freeze(S);
  for (let i = 0; i < 3; i++){ S.ship.grace = 0; game._shipHit('test'); if (!S.over) run(game, 1.7); }
  ok(S.over && !S.won); ok(has('gameover'));
});

// ---------- полубосс ----------
test('полубосс: камера стоит, пока он жив; гибель — капсула и камера едет дальше', () => {
  const { game, S, has } = setup(1, { quiet: false });
  S.enemies = []; S.spawnIdx = S.lv.spawns.findIndex(s => s.type === 'guard'); S.cx = S.lv.midX - L.W - 1; safe(game, S, S.cx + 90);
  run(game, 0.1); ok(S.guard, 'появился'); ok(S.hold); ok(has('guard'));
  const cx = S.cx; S.ship.grace = 99; run(game, 1); eq(S.cx, cx, 'камера стоит');
  S.guard.hp = 0.5; game._beam(0.5); S.shots[S.shots.length - 1].y = S.guard.y; S.shots[S.shots.length - 1].x = S.guard.x - 40;
  run(game, 0.3); ok(!S.guard && has('guardDie')); ok(!S.hold); ok(S.caps.length >= 1, 'капсула');
  run(game, 0.5); ok(S.cx > cx, 'поехали');
});

// ---------- боссы и слабые места ----------
function bossSetup(lv){ const t = setup(lv); t.S.cx = t.S.lv.len; t.game._spawnBoss(); const B = t.S.boss; B.enter = 0; t.game._layoutBoss(B, 0); t.S.ship.grace = 99; B.fireT = 1e9; safe(t.game, t.S, t.S.cx + 60); t.S.drone.state = 'free'; t.S.drone.homeSX = 10; t.S.drone.x = t.S.cx - 400; return { ...t, B }; }
function hitAt(t, x, y, dmg = 1){ t.S.shots.push({ x: x - 4, y, vx: 600, vy: 0, kind: 'shot', dmg, t: 0, life: 2, r: 3 }); t.game.update(1 / 60); }
test('боссы: на каждом уровне свой, в конце уровня (арена, камера стоит)', () => {
  const names = [];
  for (let lv = 1; lv <= 6; lv++){ const t = setup(lv, { quiet: false }); t.S.enemies = []; t.S.spawnIdx = t.S.lv.spawns.length; t.S.guardDone = true; t.S.cx = t.S.lv.len - 1; t.S.ship.grace = 99; safe(t.game, t.S, t.S.cx + 80); run(t.game, 0.1); ok(t.S.boss, 'босс ' + lv); eq(t.S.cx, t.S.lv.len); names.push(t.S.boss.type); }
  eq(names.join(','), 'crucible,hammer,worm,hive,mirror,heart');
});
test('Горнило: пасть то закрыта (броня), то открыта (урон)', () => {
  const t = bossSetup(1), B = t.B; let sawOpen = false, sawClosed = false;
  for (let i = 0; i < 300; i++){ t.game.update(1 / 60); if (B.open) sawOpen = true; else sawClosed = true; }
  ok(sawOpen && sawClosed, 'цикл');
  while (B.open) t.game.update(1 / 60); const hp = B.hp; hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp, 'закрыто — не берёт'); ok(t.has('clang'));
  while (!B.open) t.game.update(1 / 60); hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1, 'открыто — урон'); ok(t.has('bossHit'));
});
test('Молот: глаз открыт, боёк — броня и таран', () => {
  const t = bossSetup(2), B = t.B; ok(B.open && B.head);
  const hp = B.hp; hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1);
  hitAt(t, B.head.x, B.head.y); eq(B.hp, hp - 1, 'боёк держит удар');
  t.S.ship.grace = 0; t.S.ship.x = B.head.x; t.S.ship.y = B.head.y; t.game.update(1 / 60); ok(t.S.ship.dead, 'таран');
});
test('Многоножка: сегменты — броня, уязвим только хвост', () => {
  const t = bossSetup(3), B = t.B; eq(B.segs.length, 10);
  const hp = B.hp; hitAt(t, B.segs[0].x, B.segs[0].y); hitAt(t, B.segs[4].x, B.segs[4].y); eq(B.hp, hp);
  const tl = B.segs[9]; near(B.weak.x, tl.x, 0.01); hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1);
});
test('Улей: ядро открыто, пока выпускает рой', () => {
  const t = bossSetup(4), B = t.B; B.fireT = 0;
  while (!B.open) t.game.update(1 / 60);
  B.fireT = 0; t.game.update(1 / 60); ok(t.S.enemies.some(e => e.type === 'moth' && e.hive), 'выпустил моль');
  t.S.enemies = []; B.fireT = 1e9; const hp = B.hp; hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1);
});
test('Зерцало: глаз открыт при накачке, затем луч через экран убивает на своей линии', () => {
  const t = bossSetup(5), B = t.B; let mode = null;
  while (B.mode !== 'charge') t.game.update(1 / 60);
  ok(B.open && t.S.laser && t.S.laser.h === 0, 'предупреждение'); const hp = B.hp; hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1);
  while (B.mode !== 'laser') t.game.update(1 / 60);
  ok(!B.open && t.S.laser.h > 0); t.S.ship.grace = 0; t.S.ship.y = t.S.laser.y; t.S.ship.x = t.S.cx + 100; t.game.update(1 / 60);
  ok(t.S.ship.dead, 'луч'); eq(t.ev.find(e => e.t === 'playerHit').d.why, 'laser');
});
test('Сердце Окалины: пушки-руки сбиваются отдельно, ядро со створками', () => {
  const t = bossSetup(6), B = t.B; eq(B.parts.length, 2);
  const p = B.parts[0]; for (let i = 0; i < 12; i++) hitAt(t, p.x, p.y); ok(!p.alive && t.has('partDie'));
  while (!B.open) t.game.update(1 / 60); const hp = B.hp; hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1);
  B.hp = 1; hitAt(t, B.weak.x, B.weak.y); ok(!B.alive && t.has('bossDie'));
});
test('дрон жжёт открытое слабое место босса касанием', () => {
  const t = bossSetup(3), B = t.B; const hp = B.hp;
  for (let i = 0; i < 30; i++){ t.S.drone.state = 'free'; t.S.drone.homeSX = B.weak.x - t.S.cx; t.S.drone.x = B.weak.x; t.S.drone.y = B.weak.y; t.game.update(1 / 60); t.S.drone.x = B.weak.x; t.S.drone.y = B.weak.y; }
  ok(B.hp < hp - 2, 'урон касанием: ' + (hp - B.hp).toFixed(2));
});
test('босс повержен → уровень пройден (бонус 1000×N) → следующий; после 6-го — победа', () => {
  const t = bossSetup(1); t.B.hp = 1; while (!t.B.open) t.game.update(1 / 60);
  hitAt(t, t.B.weak.x, t.B.weak.y); eq(t.S.phase, 'clear'); ok(t.has('clear')); eq(t.S.clearBonus, 1000);
  run(t.game, 2.7); eq(t.S.level, 2); eq(t.S.cx, 0); eq(t.S.phase, 'intro');
  const w = bossSetup(6); w.B.hp = 1; while (!w.B.open) w.game.update(1 / 60);
  hitAt(w, w.B.weak.x, w.B.weak.y); run(w.game, 2.7); ok(w.S.over && w.S.won); ok(w.has('win'));
});

// ---------- прочее ----------
test('difficulty-хук движка: параметры уровня берутся из переданной функции', () => {
  const calls = []; const game = Sp.Game({ rng: mulberry32(1), difficulty: (lv, base) => { calls.push(lv); return base; } }).start();
  ok(calls.length > 5 && calls.every(l => l === 1)); eq(game._S.prm.bulletV, 120);
  const p6 = L.params(6), p1 = L.params(1); ok(p6.bulletV > p1.bulletV && p6.fireMul < p1.fireMul, 'сложность растёт');
});
test('музыка: оригинальный трек sputnik подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.sputnik; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('i18n: у RU и EN одинаковый набор ключей, есть строки всех уровней, боссов и капсул', () => {
  const ru = Object.keys(Sp.STR.ru).sort(), en = Object.keys(Sp.STR.en).sort(); eq(ru.join(','), en.join(','));
  L.LEVELS.forEach(d => { ok(Sp.STR.ru['lv_' + d.name] && Sp.STR.ru['sub_' + d.name] && Sp.STR.ru['b_' + d.boss] && Sp.STR.ru['w_' + d.boss], d.name); });
  L.CAPS.forEach(c => ok(Sp.STR.en['cap_' + c]));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей/терминов (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('aW52YWRlcnM/fNC40L3QslvQtdCwXdC50LTQtdGAfHRhaXRvfNGC0LDQudGC0L58Z2FsYWd80LPQsNC70LDQs3xnYWxheGlhbnzQs9Cw0LvQsNC60YHQuNCw0L18XGJwaG9lbml4XGJ80YTQtdC90LjQutGBfG5pc2hpa2Fkb3zQvdC40YHQuNC60LDQtNC+fGRlbW9uID9hdHRhY2t8XGJnb3JmXGJ8bW9vbiA/Y3Jlc3RhfGNlbnR1cml8YW1zdGFyfHBhYy0/bWFufNC/0LDQutC80LDQvXx0ZXRyaXN80YLQtdGC0YDQuNGBfFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxrb25hbWl80LrQvtC90LDQvNC4fG5hbWNvfNC90LDQvNC60L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fHNlZ2FcYnzRgdC10LPQsCg/IVvQsC3Rj9GRXSl8dGVjbW98ZGl6enl8ZGVlcHNlZWt8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofHJpdmVyID9yYWlkfGV4b2xvbnzRjdC60YHQvtC70L7QvXx2aXRvcmN80LLQuNGC0L7RgNC6fGxvc3QgP3Zpa2luZ3N8ZG91YmxlID9kcmFnb258YmF0dGxldG9hZHN8c2lsa3dvcm18XGJyLT90eXBlXGJ80YAtP9GC0LDQudC/fFxiaXJlbVxifNCw0LnRgNC10Lx8XGJieWRvXGJ80LHQuNC00L4oPyFb0LAt0Y/RkV0pfGdyYWRpdXN80LPRgNCw0LTQuNGD0YF8bmVtZXNpc3zQvdC10LzQtdC30LjQtHx2aWMgP3ZpcGVyfFxiZm9yY2VcYnzRhNC+0YDRgSg/IVvQsC3Rj9GRXSl8ZGFyaXVzfNC00LDRgNC40YPRgXxzYWxhbWFuZGVyfNGB0LDQu9Cw0LzQsNC90LTRgA==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('контрольная точка') && !BAD.test('CONTRACT.md') && !BAD.test('форсаж') && !BAD.test('typeof') && !BAD.test('enforced'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- проходимость и баланс (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без баланса)'); process.exit(failed ? 1 : 0); }
const PASS = [];
for (let lv = 1; lv <= 6; lv++) for (const s of [1, 2]) PASS.push({ lv, s, r: playSputnik(Sp, s, { perfect: true, startLevel: lv, levels: 1, maxLevelT: 360 }) });
test('проходимость: каждый из 6 уровней проходится «идеальным» ботом (старт без лучей дрона) ≤ 360 с', () => {
  const bad = PASS.filter(p => !p.r.won).map(p => p.lv + '/' + p.s);
  console.log('     время, с: ' + PASS.map(p => p.lv + ':' + (p.r.levelTime[p.lv] || 0).toFixed(0)).join(' '));
  ok(!bad.length, 'не пройдено: ' + bad.join(', '));
});

// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс прицела, пропускает часть пуль,
// ввод только setDir/setFire/drone. 40 партий (сиды 1..40), ~50 с.
// Цели: 1-й уровень ≥ 90%, все 6 ≈ 20–40% (допуск 20–45% на 40 партиях).
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playSputnik(Sp, s));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.passed >= 1).length; console.log('     уровень 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: все 6 уровней — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(7).fill(0); BAL.forEach(r => dist[r.passed]++);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     все 6: ' + n + '/' + N + '; пройдено уровней 0..6: ' + dist.join(',') + '; причины гибели: ' + JSON.stringify(why));
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял на уровне: ' + BAL.filter(r => r.stuck).map(r => r.stuck).join(','));
});
test('непресность: потерь кораблей на уровень больше во второй половине', () => {
  const per = []; for (let lv = 1; lv <= 6; lv++){ const reach = BAL.filter(r => r.passed >= lv - 1).length; let l = 0; for (const r of BAL) l += (r.lost[lv] || 0); per.push(l / Math.max(1, reach)); }
  console.log('     потерь на уровень: ' + per.map(v => v.toFixed(2)).join(' / '));
  const a = per.slice(0, 3).reduce((x, y) => x + y) / 3, b = per.slice(3).reduce((x, y) => x + y) / 3;
  ok(b > a * 1.5, 'нет нарастания: ' + a.toFixed(2) + ' → ' + b.toFixed(2));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

/* СПУТНИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node sputnik/tests/engine.test.mjs (QUICK=1 — без баланса). Логика (js/game.js) в node:vm с шимом window.
   Переделка 2026-11: калильный жар (скольжение у кромки), ступени огня, закалка кольцом пара; площадки. */
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
    ok(a.spawns.some(s => s.type === 'ingot'), 'есть слитки (запас жара)');
  }
});
test('механизмы: поршни и шестерни на уровнях 2–6, двигаются по такту', () => {
  for (let n = 2; n <= 6; n++) ok(L.buildLevel(n).mechs.length > 0, 'уровень ' + n);
  const { game, S } = setup(3); const m = S.lv.mechs.find(x => x.kind === 'piston');
  const a = game._mechRects(m), b = game._mechRects(m, 1.3);
  ok(Math.abs((a.y1 - a.y0) - (b.y1 - b.y0)) > 1, 'поршень ходит');
});

// ---------- переделка: калильный жар и закалка ----------
test('переделка: нет дрона, оптик, капсул и заряженного луча (прежние признаки убраны из логики и рендеров)', () => {
  const { S, game } = setup(1);
  for (const k of ['drone', 'optics', 'caps', 'fire']) ok(!(k in S), 'S.' + k);
  for (const k of ['drone', 'tap', 'setFire', '_pickup', '_beam']) ok(!(k in game), 'api.' + k);
  ok(!('CAPS' in L) && !('DRONE_R' in L) && !('CHARGE_TIME' in L), 'константы');
  for (const f of ['js/game.js', 'js/modern.js', 'js/classic.js', 'js/ui.js', 'js/main.js', 'js/i18n.js', 'index.html'])
    ok(!/drone|optic|capsule|Наковальн|Anvil|рикошет|ricochet|змейк|chargeBeam|CHARGE_|wave ?cannon/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
});
test('жар: у кромки корабль накаляется (чем ближе — тем быстрее), вдали — держит 0.8 с и остывает', () => {
  const { game, S } = setup(2); freeze(S); const x = S.cx + 200;
  S.ship.x = x; S.ship.y = game._floorY(x) - L.SHIP_TH - 6; run(game, 1); const near1 = S.heat; ok(near1 > 25, 'у пола: ' + near1.toFixed(1)); ok(S.skim > 0.5);
  S.heat = 0; S.ship.y = game._floorY(x) - L.SHIP_TH - 20; run(game, 1); ok(S.heat > 3 && S.heat < near1, 'дальше — медленнее: ' + S.heat.toFixed(1));
  S.heat = 50; safe(game, S, x); run(game, 0.5); ok(S.heat > 49.9, 'держит'); run(game, 2); ok(S.heat < 45, 'остывает: ' + S.heat.toFixed(1)); eq(S.skim, 0);
  S.heat = 99; S.ship.y = game._floorY(x) - L.SHIP_TH - 4; run(game, 1); eq(S.heat, 100, 'потолок 100');
});
test('жар: потолок пещеры и механизмы тоже греют; на 1-м уровне потолка нет — греет только пол', () => {
  const { game, S } = setup(2); freeze(S); const x = S.cx + 200;
  S.ship.x = x; S.ship.y = game._ceilY(x) + L.SHIP_TH + 5; run(game, 0.5); ok(S.heat > 10 && S.skimSide === 'c', 'потолок');
  const lvG = [3, 2, 4, 5, 6].find(n => L.buildLevel(n).mechs.some(q => q.kind === 'gear')); const t3 = setup(lvG); freeze(t3.S); const m = t3.S.lv.mechs.find(q => q.kind === 'gear'); t3.S.cx = m.x - 300; t3.S.time = 0;
  const gm = t3.game._mechRects(m); t3.S.ship.x = m.x - gm.r - L.SHIP_TW - 6; t3.S.ship.y = gm.cy;
  const g0 = t3.game._skimGap(t3.S.ship.x, t3.S.ship.y); eq(g0.side, 'm'); ok(g0.d < 10, 'шестерня рядом: ' + g0.d.toFixed(1));
  const t1 = setup(1); freeze(t1.S); t1.S.ship.y = L.TOP + L.SHIP_TH + 2; t1.S.ship.x = t1.S.cx + 200; run(t1.game, 0.5); eq(t1.S.heat, 0, 'край HUD — не кромка');
});
test('ступени огня: тлеет — 1 выстрел, жар — 2 параллельных, белый жар — 2 калёных + 2 искры веером; огонь сам', () => {
  const { game, S, has } = setup(1); freeze(S); safe(game, S, S.cx + 100); S.ship.y = 150;
  run(game, 0.02); eq(S.shots.filter(s => s.kind === 'shot').length, 1, 'тлеет'); ok(has('shoot'));
  S.shots = []; game._heat(50); eq(S.tier, 1); run(game, L.FIRE_CD + 0.02); eq(S.shots.filter(s => s.kind === 'shot').length, 2, 'жар');
  S.shots = []; game._heat(90); eq(S.tier, 2); run(game, L.FIRE_CD + 0.02);
  eq(S.shots.filter(s => s.kind === 'hot').length, 2, 'белый жар'); const sp = S.shots.filter(s => s.kind === 'spark'); eq(sp.length, 2); ok(sp.some(s => s.vy < 0) && sp.some(s => s.vy > 0), 'веер');
  ok(S.shots.filter(s => s.kind === 'hot').every(s => s.dmg > 1), 'калёные сильнее');
});
test('сбитые враги греют корабль; слиток даёт много жара', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 100);
  const a = game._enemy('moth', S.ship.x + 60, S.ship.y, { y0: S.ship.y, amp: 0, ph: 0, vx: 0 }); run(game, 0.3); ok(!a.alive); near(S.heat, L.KILL_HEAT, 1, 'моль');
  const b = game._enemy('ingot', S.ship.x + 60, S.ship.y, { vx: 0, fireT: 99 }); run(game, 1.5); ok(!b.alive, 'слиток сбит'); ok(S.heat >= L.KILL_HEAT + L.INGOT_HEAT - 2, 'слиток: ' + S.heat.toFixed(1));
});
test('закалка: нужен жар ≥ 25; сбрасывает весь жар; кольцо гасит пули вокруг и бьёт врагов; шире при большем жаре', () => {
  const { game, S, has, count } = setup(1); freeze(S); safe(game, S, S.cx + 150); S.ship.y = 150; run(game, 0.02);
  game._heat(10); ok(!game.canQuench()); ok(!game.quench(), 'мало жара');
  game._heat(80); ok(game.canQuench()); ok(game.quench()); ok(has('quench')); eq(S.heat, 0); ok(S.ring);
  const R80 = S.ring.R; near(R80, L.RING_R0 + L.RING_PER * 80, 0.01);
  for (let i = 0; i < 6; i++) game._bullet(S.ship.x + 40 + i * 12, S.ship.y + (i % 2 ? 20 : -20), -100, 0);
  const far = game._bullet(S.ship.x + 400, S.ship.y, 0, 0);
  const e = game._enemy('walker', S.ship.x + 70, S.ship.y, { vx: 0, fireT: 99 }); e.type = 'mine'; e.hp = 3;
  run(game, 0.5); ok(!S.ring, 'кольцо отработало'); ok(S.bullets.length === 1 && S.bullets[0] === far, 'ближние пули погашены, дальняя — нет: ' + JSON.stringify(S.bullets.map(b => [Math.round(b.x - S.ship.x), Math.round(b.y)])));
  ok(S.doused >= 6 && has('douse')); ok(!e.alive, 'враг в кольце сбит'); ok(!S.ship.dead);
  ok(!game.quench(), 'перезарядка / нет жара'); game._heat(30); run(game, L.QUENCH_CD); ok(game.quench()); ok(S.ring.R < R80, 'меньше жара — уже кольцо'); eq(count('quench'), 2);
});
test('закалка бьёт открытое слабое место босса и пушки-руки', () => {
  const t = bossSetup(6), B = t.B; while (!B.open) t.game.update(1 / 60);
  t.S.ship.x = B.weak.x - 90; t.S.ship.y = B.weak.y; t.S.shots = [];
  const hp = B.hp, p0 = B.parts[0].hp; t.game._heat(100); ok(t.game.quench()); for (let i = 0; i < 30; i++){ t.S.shots = []; t.S.fireCd = 1; t.game.update(1 / 60); }
  ok(B.hp < hp - 5, 'ядро: ' + (hp - B.hp).toFixed(1)); ok(B.parts[0].hp < p0, 'рука');
});
test('1-й уровень — обучение: ровная кромка и без врагов первые 900 px; подсказка «закалка», когда жара хватает', () => {
  const LV = L.buildLevel(1); ok(LV.spawns.every(s => s.x >= 900), 'враги позже');
  for (let x = 200; x < 880; x += 8) ok(L.H - LV.floor[x / 8] > L.H - 30, 'пол низко');
  const { game, S, has } = setup(1); freeze(S); const x = S.cx + 150; S.ship.x = x; S.ship.y = game._floorY(x) - L.SHIP_TH - 5;
  run(game, 1.5); ok(S.tutor.quench && has('tutorQuench')); game.quench(); ok(S.tutor.quenched);
});
test('реклама: reviveAd после последнего корабля — 1 корабль у контрольной точки; boost — +1 корабль и полный жар (до 5)', () => {
  const a = setup(1); ok(!a.game.reviveAd(), 'в игре — нельзя');
  a.S.lives = 1; a.S.ship.grace = 0; a.game._shipHit('test'); ok(a.S.over && a.has('gameover'));
  ok(a.game.reviveAd()); eq(a.S.phase, 'play'); eq(a.S.lives, 1); ok(!a.S.over); ok(a.S.ship.grace > 2, 'неуязвимость'); ok(!a.S.ship.dead);
  ok(a.game.canBoost()); ok(a.game.boost()); eq(a.S.lives, 2); eq(a.S.heat, 100); a.S.lives = L.LIFE_MAX; ok(!a.game.canBoost());
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
  game._heat(60);
  S.cx = S.lv.cps[1] - 1; safe(game, S, S.cx + 90); run(game, 0.1);   // пролетели первую контрольную точку
  eq(S.cpIdx, 1); ok(has('checkpoint')); const cp = S.cp; eq(cp, S.lv.cps[1]);
  S.ship.grace = 0; game._shipHit('test'); eq(S.lives, 2); eq(S.phase, 'dead'); eq(S.heat, 0, 'жар остыл');
  S.cp = cp; run(game, 1.62); eq(S.phase, 'play'); ok(S.cx - cp < 3, 'камера на контрольной точке'); ok(S.ship.grace > 0); ok(has('respawn'));
  ok(!game._terrainHit(S.ship.x, S.ship.y, L.SHIP_TW, L.SHIP_TH), 'возрождение в просвете');
});
test('пули врагов: попадание в корабль — гибель; стены пули гасят', () => {
  const { game, S } = setup(1); freeze(S); safe(game, S, S.cx + 120); run(game, 0.02);
  game._bullet(S.ship.x, S.ship.y - 60, 0, 300); run(game, 0.5); ok(S.ship.dead, 'сверху в корабль');
  const t = setup(2); freeze(t.S); const x = t.S.cx + 300; t.game._bullet(x, t.game._floorY(x) - 10, 0, 200); run(t.game, 0.2); eq(t.S.bullets.length, 0);
});
test('поражение: все корабли потеряны → gameover', () => {
  const { game, S, has } = setup(1); freeze(S);
  for (let i = 0; i < 3; i++){ S.ship.grace = 0; game._shipHit('test'); if (!S.over) run(game, 1.7); }
  ok(S.over && !S.won); ok(has('gameover'));
});

// ---------- полубосс ----------
test('полубосс: камера стоит, пока он жив; гибель — жар и камера едет дальше', () => {
  const { game, S, has } = setup(1, { quiet: false });
  S.enemies = []; S.spawnIdx = S.lv.spawns.findIndex(s => s.type === 'guard'); S.cx = S.lv.midX - L.W - 1; safe(game, S, S.cx + 90);
  run(game, 0.1); ok(S.guard, 'появился'); ok(S.hold); ok(has('guard'));
  const cx = S.cx; S.ship.grace = 99; run(game, 1); eq(S.cx, cx, 'камера стоит');
  S.guard.hp = 0.5; S.ship.y = S.guard.y; const h0 = S.heat;
  run(game, 1.5); ok(!S.guard && has('guardDie'), 'полубосс сбит'); ok(!S.hold); ok(S.heat >= h0 + L.GUARD_HEAT - 3, 'жар за полубосса');
  run(game, 0.5); ok(S.cx > cx, 'поехали');
});

// ---------- боссы и слабые места ----------
function bossSetup(lv){ const t = setup(lv); t.S.cx = t.S.lv.len; t.game._spawnBoss(); const B = t.S.boss; B.enter = 0; t.game._layoutBoss(B, 0); t.S.ship.grace = 99; B.fireT = 1e9; safe(t.game, t.S, t.S.cx + 60); t.S.fireCd = 1e9; return { ...t, B }; }
function hitAt(t, x, y, dmg = 1){ t.S.fireCd = 1e9; t.S.shots.push({ x: x - 4, y, vx: 600, vy: 0, kind: 'shot', dmg, t: 0, life: 2, r: 3 }); t.game.update(1 / 60); }
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
test('Цепь: звенья — броня, уязвимо только раскалённое звено; оно бежит от хвоста к голове', () => {
  const t = bossSetup(3), B = t.B; eq(B.segs.length, 10); eq(B.hot, 9, 'сначала хвост');
  const hp = B.hp, other = B.hot === 4 ? 5 : 4; hitAt(t, B.segs[0].x, B.segs[0].y); hitAt(t, B.segs[other].x, B.segs[other].y); eq(B.hp, hp, 'холодные звенья держат');
  near(B.weak.x, B.segs[B.hot].x, 0.01); hitAt(t, B.weak.x, B.weak.y); eq(B.hp, hp - 1);
  const seen = new Set(); for (let i = 0; i < 600; i++){ t.game.update(1 / 60); seen.add(B.hot); } ok(seen.size >= 8 && !seen.has(0), 'звено бежит, голова не греется');
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
  ok(calls.length > 5 && calls.every(l => l === 1)); eq(game._S.prm.bulletV, 110);
  const p6 = L.params(6), p1 = L.params(1); ok(p6.bulletV > p1.bulletV && p6.fireMul < p1.fireMul, 'сложность растёт');
});
test('музыка: оригинальный трек sputnik подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.sputnik; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('языки: ru/en/tr/es/pt — одинаковые ключи, строки всех уровней и боссов; название RU СПУТНИК, EN/TR/ES/PT EMBERSKIM', () => {
  const S = Sp.STR, ks = Object.keys(S.ru).sort().join(','); eq(Object.keys(S).join(','), 'ru,en,tr,es,pt');
  for (const l of ['en', 'tr', 'es', 'pt']) eq(Object.keys(S[l]).sort().join(','), ks, l);
  for (const l in S) L.LEVELS.forEach(d => ok(S[l]['lv_' + d.name] && S[l]['sub_' + d.name] && S[l]['b_' + d.boss] && S[l]['w_' + d.boss], l + ' ' + d.name));
  eq(S.ru.title, 'СПУТНИК'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'EMBERSKIM', l);
});
test('страница: фавикон, «← Каталог», canvas 640×360, скрипты по порядку, стик и кнопка ◆, пауза; engine.js = _shared, stick.js = otsek', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон'); ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'каталог');
  ok(/<canvas id="c" width="640" height="360"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order.join(','), 'engine.js,js/music.js,js/i18n.js,js/game.js,js/audio.js,js/ui.js,js/modern.js,js/classic.js,js/stick.js,js/main.js');
  ok(/data-stick/.test(html) && /id="bQuench"/.test(html) && /id="bPause"/.test(html), 'тач');
  eq(fs.readFileSync(path.join(ROOT, 'js/stick.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', 'otsek', 'js', 'stick.js'), 'utf8'), 'stick.js — копия otsek');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\//.test(html), 'нет внешних ссылок');
});
test('площадка: стик, карточка «уровень пройден» с межстраничной, menuFit, рекорд прежним ключом (g.persist), ещё шанс и бонус', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/ArcadeStick\.create/.test(main) && /stick\.active/.test(main), 'стик');
  ok(/g\.adBreak\(\)/.test(main) && /g\.adReady\(\)/.test(main), 'межстраничная по нажатию на карточке');
  ok(/menuFit/.test(main), 'menuFit'); ok(/g\.persist\('arcade\.best\.sputnik', 'max'\)/.test(main), 'рекорд прежним ключом');
  ok(/useRewardedContinue/.test(main) && /useRewardedBonus/.test(main), 'реклама за награду');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'sputnik', boards: ['sputnik'], test, ok }); }
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
test('проходимость: каждый из 6 уровней проходится «идеальным» ботом (старт без жара) ≤ 360 с', () => {
  const bad = PASS.filter(p => !p.r.won).map(p => p.lv + '/' + p.s);
  console.log('     время, с: ' + PASS.map(p => p.lv + ':' + (p.r.levelTime[p.lv] || 0).toFixed(0)).join(' '));
  ok(!bad.length, 'не пройдено: ' + bad.join(', '));
});

// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс прицела, пропускает часть пуль,
// ввод только setDir/quench (огонь сам). 40 партий (сиды 1..40), ~60 с.
// Цели: 1-й уровень ≥ 90%, все 6 ≈ 20–40% (допуск 20–45% на 40 партиях).
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playSputnik(Sp, s));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.passed >= 1).length; console.log('     уровень 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: все 6 уровней — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(7).fill(0); BAL.forEach(r => dist[r.passed]++);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     все 6: ' + n + '/' + N + '; пройдено уровней 0..6: ' + dist.join(',') + '; причины гибели: ' + JSON.stringify(why) + '; закалок за партию: ' + (BAL.reduce((a, r) => a + r.quenches, 0) / N).toFixed(1) + ', средний жар: ' + (BAL.reduce((a, r) => a + r.heatAvg, 0) / N).toFixed(0));
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

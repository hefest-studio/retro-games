/* ЭСКАДРИЛЬЯ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node eskadrilya/tests/engine.test.mjs. Логика (js/game.js) в node:vm с шимом window. */
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
const E = sandbox.ESKADRILYA, L = E.logic;
const { playEskadrilya, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Игра на заданном перелёте с пустым сценарием (без налётов и наземных целей); ev — журнал событий
function setup(level = 1, opts = {}){
  const ev = [];
  const game = E.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game._S; if (level !== 1) game._setupLevel(level);
  if (!opts.keepScript){ S.script.air = []; S.script.ground = []; }
  S.player.grace = 0; S.banner = 0;
  ev.length = 0;
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
function bullet(S, x, y, vx = 0, vy = 200, kind = 'shot'){ const b = { x, y, vx, vy, kind, src: 'test' }; S.bullets.push(b); return b; }
// выстрел игрока из точки (x,y) вверх — один кадр
function shootAt(game, S, x, y){ S.shots.push({ x, y, vx: 0, vy: -L.SHOT_V }); game.update(1 / 60); }

// ---------- структура ----------
test('перелёты: 8 штук, у каждого имя и корабль-босс RU/EN, турелей 3→7', () => {
  eq(L.LEVELS.length, 8);
  L.LEVELS.forEach((lv, i) => {
    ok(E.STR.ru['lv_' + lv.name] && E.STR.en['lv_' + lv.name], 'нет имени ' + lv.name);
    ok(E.STR.ru['boss_' + (i + 1)] && E.STR.en['boss_' + (i + 1)], 'нет имени корабля ' + (i + 1));
  });
  eq(L.LEVELS.map(l => l.turrets).join(','), '3,3,4,4,5,5,6,7');
  eq(new Set(L.LEVELS.map(l => l.name)).size, 8);
});
test('строки: RU/EN — одинаковый набор ключей', () => {
  eq(Object.keys(E.STR.ru).sort().join(), Object.keys(E.STR.en).sort().join());
});
test('старт: 3 самолёта, энергия 100, 3 петли, без ведомых, огонь одиночный', () => {
  const { S } = setup(1);
  eq(S.lives, 3); eq(S.player.energy, L.EMAX); eq(S.player.loops, L.LOOPS); eq(S.player.wing.join(), 'false,false'); eq(S.player.power, 1);
});

// ---------- прокрутка и рельеф ----------
test('прокрутка: мир едет вниз со скоростью SCROLL, наземная цель смещается по экрану', () => {
  const { game, S } = setup(1);
  const g = game._spawnGround('flak', 240, S.dist + 400);
  const y0 = game._sy(g.wy), d0 = S.dist; run(game, 1);
  ok(Math.abs(S.dist - d0 - L.SCROLL) < 1, 'дистанция ' + (S.dist - d0)); ok(Math.abs(game._sy(g.wy) - y0 - L.SCROLL) < 1, 'цель сместилась');
});
test('рельеф: детерминирован; старт и подход к кораблю — открытое море; зенитки и склады на суше, катера на воде', () => {
  for (let lv = 1; lv <= 8; lv++){
    const T1 = L.makeTerrain(lv), T2 = L.makeTerrain(lv);
    eq(JSON.stringify(T1), JSON.stringify(T2), 'детерминизм ' + lv);
    ok(!L.isLand(T1, 240, 200) && !L.isLand(T1, 240, L.H), 'старт — море, ' + lv);
    for (let wy = T1.len + 100; wy < T1.len + 1000; wy += 50) ok(!L.isLand(T1, 240, wy), 'у корабля суша, ' + lv + ' @' + wy);
    const sc = L.makeScript(lv, T1, L.params(lv));
    sc.ground.forEach(o => ok(o.type === 'boat' ? !L.isLand(T1, o.x, o.wy) : L.isLand(T1, o.x, o.wy), o.type + ' не на своём месте, ' + lv));
    ok(sc.ground.some(o => o.type === 'flak'), 'нет зениток, ' + lv); ok(sc.ground.some(o => o.type === 'boat'), 'нет катеров, ' + lv);
    ok(sc.air.length > 12, 'мало налётов, ' + lv);
  }
});

// ---------- петля ----------
test('петля: неуязвимость к пулям и тарану, без стрельбы, длится LOOP_T', () => {
  const { game, S, has } = setup(1); const P = S.player;
  ok(game.loop(), 'петля'); eq(P.loops, L.LOOPS - 1); ok(has('loop'));
  bullet(S, P.x, P.y - 20, 0, 300);
  game._spawnAir('bird', P.x, P.y - 4, { pat: 'line' });
  run(game, 0.3);
  eq(P.energy, L.EMAX, 'энергия цела'); ok(!has('hurt'));
  eq(game.fire(), false, 'в петле не стреляет');
  run(game, L.LOOP_T); eq(P.loopT, 0); ok(has('loopEnd'));
  S.air = []; bullet(S, P.x, P.y - 20, 0, 300); run(game, 0.2); ok(P.energy < L.EMAX, 'после петли — снова уязвим');
});
test('петля: лимит за перелёт — после трёх нельзя, на новом перелёте снова 3', () => {
  const { game, S } = setup(1); const P = S.player;
  for (let i = 0; i < L.LOOPS; i++){ ok(game.loop(), 'петля ' + (i + 1)); run(game, L.LOOP_T + 0.05); }
  eq(P.loops, 0); eq(game.loop(), false, 'лимит'); eq(P.loopT, 0);
  ok(!game.loop(), 'и повторно нельзя');
  game._setupLevel(2); eq(P.loops, L.LOOPS);
  game._pickup('loop'); eq(P.loops, L.LOOPS + 1, 'бонус +петля');
  for (let i = 0; i < 5; i++) game._pickup('loop'); eq(P.loops, L.LOOP_MAX, 'не больше LOOP_MAX');
});
test('петля: во время петли нельзя начать вторую', () => {
  const { game, S } = setup(1); ok(game.loop()); run(game, 0.2); eq(game.loop(), false); eq(S.player.loops, L.LOOPS - 1);
});

// ---------- звено ----------
test('звено: подбор даёт двух ведомых по бокам, они стреляют вместе с ведущим', () => {
  const { game, S } = setup(1); const P = S.player;
  game._pickup('wing'); eq(P.wing.join(), 'true,true');
  run(game, 0.6);
  ok(Math.abs(P.wx[0] - (P.x - L.WING_DX)) < 2 && Math.abs(P.wx[1] - (P.x + L.WING_DX)) < 2, 'места ведомых');
  game.setFire(true); run(game, 0.5); game.setFire(false);
  ok(S.shots.some(s => s.wing), 'ведомые стреляют');
});
test('звено: пуля сбивает ведомого (энергия ведущего цела), таран — тоже', () => {
  const { game, S, has, count } = setup(1); const P = S.player;
  game._pickup('wing'); run(game, 0.6);
  bullet(S, P.wx[0], P.wy[0] - 15, 0, 300); run(game, 0.15);
  eq(P.wing[0], false); eq(P.wing[1], true); eq(P.energy, L.EMAX); ok(has('wingLost'));
  game._spawnAir('bird', P.wx[1], P.wy[1] - 3, { pat: 'line' }); run(game, 0.05);
  eq(P.wing[1], false, 'таран'); eq(count('wingLost'), 2);
});
test('звено: потеря самолёта — ведомые теряются; повторный подбор при полном звене — +500', () => {
  const { game, S } = setup(1); const P = S.player;
  game._pickup('wing'); const s0 = S.score; game._pickup('wing'); eq(S.score - s0, 600, '500 + 100 за подбор');
  P.energy = 5; game._hurt(20, P.x, P.y);
  eq(P.dead, true); eq(P.wing.join(), 'false,false');
});

// ---------- энергия и бонусы ----------
test('энергия: попадание снимает урон × dmgK, короткая неуязвимость не даёт «двойного» попадания', () => {
  const { game, S, has } = setup(1); const P = S.player;
  bullet(S, P.x, P.y - 12, 0, 300); bullet(S, P.x, P.y - 20, 0, 300); run(game, 0.12);
  eq(P.energy, L.EMAX - Math.round(L.DMG.shot * L.params(1).dmgK)); ok(has('hurt'));
  ok(L.params(8).dmgK > L.params(1).dmgK, 'урон растёт к 8-му');
});
test('энергия: топливо доливает +40 (не выше 100); склад уничтожен — выпадает топливо', () => {
  const { game, S } = setup(1); const P = S.player;
  P.energy = 30; game._pickup('fuel'); eq(P.energy, 70); game._pickup('fuel'); eq(P.energy, L.EMAX);
  const d = game._spawnGround('depot', 240, S.dist + 300);   // экран y = 340
  for (let i = 0; i < 2; i++) shootAt(game, S, 240, game._sy(d.wy) + 8);
  ok(!d.alive, 'склад уничтожен'); ok(S.pickups.some(q => q.kind === 'fuel'), 'топливо выпало');
  const q = S.pickups[0]; P.energy = 50; P.x = q.x; P.y = q.y + 10; run(game, 0.05);
  eq(P.energy, 90, 'подобрано'); eq(S.pickups.length, 0);
});
test('энергия на нуле — самолёт потерян; возрождение с полной энергией и неуязвимостью', () => {
  const { game, S, has } = setup(1); const P = S.player;
  P.energy = 10; bullet(S, P.x, P.y - 12, 0, 300); run(game, 0.1);
  ok(has('playerLost')); eq(S.lives, 2); eq(S.phase, 'dead'); eq(S.bullets.length, 0, 'пули убраны');
  run(game, 2); eq(S.phase, 'play'); eq(P.dead, false); eq(P.energy, L.EMAX); ok(P.grace > 0); ok(has('respawn'));
});
test('поражение: последний самолёт потерян — gameover', () => {
  const { game, S, has } = setup(1, { lives: 1 }); const P = S.player;
  P.energy = 1; game._hurt(20, P.x, P.y);
  ok(S.over && !S.won); ok(has('gameover')); eq(S.lives, 0);
});
test('стволы: 1 → 1 пуля, 2 → 2, 3 → 4 за залп; потеря самолёта — минус ступень', () => {
  const { game, S } = setup(1); const P = S.player;
  const volley = () => { S.shots = []; P.cool = 0; game.fire(); return S.shots.length; };
  eq(volley(), 1); game._pickup('power'); eq(volley(), 2); game._pickup('power'); eq(volley(), 4);
  game._pickup('power'); eq(P.power, L.POWER_MAX);
  P.energy = 1; game._hurt(20, P.x, P.y); eq(P.power, 2);
});

// ---------- наземные и морские цели ----------
test('зенитка: стреляет в самолёт, глохнет после 4 попаданий (+250)', () => {
  const { game, S, has } = setup(1);
  const f = game._spawnGround('flak', 240, S.dist + 440); f.fireT = 0;   // экран y = 200
  game.update(1 / 60);
  const b = S.bullets.find(x => x.src === 'flak'); ok(b, 'выстрел'); ok(b.vy > 0, 'вниз, к самолёту');
  S.bullets = []; const s0 = S.score;
  for (let i = 0; i < 4; i++) shootAt(game, S, 240, game._sy(f.wy) + 8);
  ok(!f.alive); eq(S.score - s0, L.PTS.flak); ok(has('groundKill'));
});
test('катер: идёт по воде, у края разворачивается; топится 3 попаданиями; сам не таранит', () => {
  const { game, S, has } = setup(1); const P = S.player;
  const b = game._spawnGround('boat', 60, S.dist + 300, -1); b.fireT = 99;
  run(game, 1.2); ok(b.vx > 0, 'развернулся у края');
  const x1 = b.x; run(game, 0.5); ok(b.x > x1, 'плывёт');
  P.x = b.x; P.y = game._sy(b.wy); run(game, 0.1); ok(!has('hurt'), 'самолёт над катером — не столкновение');
  for (let i = 0; i < 3; i++) shootAt(game, S, b.x, game._sy(b.wy) + 6);
  ok(!b.alive); ok(has('groundKill'));
});

// ---------- воздух ----------
test('«красная» стая: все пять сбиты — выпадает бонус; хоть одна ушла — бонуса нет', () => {
  const { game, S } = setup(1);
  game._runEvent({ pat: 'red', x: 240, seed: 5, side: 1 }); run(game, 2.2);
  const birds = S.air.filter(e => e.red); eq(birds.length, 5);
  birds.forEach(e => shootAt(game, S, e.x, e.y + 4));
  ok(S.pickups.some(q => q.kind === L.DROPS[0]), 'бонус ' + L.DROPS[0]);
  S.pickups = [];
  game._runEvent({ pat: 'red', x: 240, seed: 6, side: 1 }); run(game, 2.2);
  const b2 = S.air.filter(e => e.red); b2[0].y = L.H + 60; game.update(1 / 60);
  b2.slice(1).forEach(e => shootAt(game, S, e.x, e.y + 4));
  eq(S.pickups.length, 0, 'одна ушла — бонуса нет');
});
test('дирижабль: прочный, бьёт веером снарядов, сбит — выпадает бонус', () => {
  const { game, S, has } = setup(1);
  const e = game._spawnAir('blimp', 240, 160); eq(e.hp, L.params(1).blimpHp); e.fireT = 0;
  game.update(1 / 60); eq(S.bullets.filter(b => b.kind === 'shell').length, 3, 'веер');
  for (let i = 0; i < e.max; i++) shootAt(game, S, e.x, e.y + 14);
  ok(!e.alive); ok(has('kill')); ok(S.pickups.length === 1 && S.pickups[0].kind === 'wing', 'бонус');
});
test('стриж: летит прямо в точку, где был самолёт', () => {
  const { game, S } = setup(1); const P = S.player;
  const e = game._spawnAir('swift', 100, -20);
  const a1 = Math.atan2(e.vy, e.vx), a2 = Math.atan2(P.y + 20, P.x - 100);
  ok(Math.abs(a1 - a2) < 1e-9);
});

// ---------- крейсер-кузня ----------
function toBoss(game, S){ S.dist = S.terrain.len; game.update(1 / 60); for (let i = 0; i < 900 && !S.boss.anchored; i++) game.update(1 / 60); return S.boss; }
test('крейсер: подходит в конце маршрута, встаёт (прокрутка 0), турели под колпаками до остановки', () => {
  const { game, S, has } = setup(1);
  S.dist = S.terrain.len; game.update(1 / 60);
  const B = S.boss; ok(B && S.stage === 'boss'); ok(has('bossArrive')); ok(S.scroll > L.SCROLL, 'подход быстрее');
  B.y = 200; const tu = B.turrets[1]; const hp = tu.hp;
  S.shots.push({ x: B.x + tu.dx, y: B.y + tu.dy + 8, vx: 0, vy: -1 }); S.shots.push({ x: B.x + tu.dx, y: B.y + tu.dy + 8, vx: 0, vy: -1 });
  B.y = game._sy(B.wy); game.update(1 / 60);
  eq(tu.hp, hp, 'под колпаком');
  toBoss(game, S); ok(B.anchored); eq(S.scroll, 0); eq(B.y, L.BOSS_Y); ok(has('bossAnchor'));
  eq(B.turrets.length, 3); ok(B.turrets.every(t => t.hp === t.max && t.max === L.params(1).turretHp + (t.kind === 'twin' ? 4 : 0)));
});
test('крейсер: трубы глушат выстрелы снизу — носовую турель достать можно только из-за труб', () => {
  const { game, S, has } = setup(1); const B = toBoss(game, S); B.t = 0;
  B.turrets.forEach(t => { t.fireT = 99; });
  const bow = B.turrets[0], f = B.funnels[0];
  ok(bow.dx === f.dx && bow.dy < f.dy, 'нос за первой трубой');
  const bx = () => B.x + bow.dx, hp = bow.hp;
  shootAt(game, S, bx(), B.y + f.dy + f.h / 2 + 4); run(game, 0.1);
  eq(bow.hp, hp, 'снизу — в трубу'); ok(has('clang'));
  shootAt(game, S, bx(), B.y + bow.dy + 16);
  eq(bow.hp, hp - 1, 'над палубой, выше трубы — попадание');
  const side = B.turrets[1], hs = side.hp; shootAt(game, S, B.x + side.dx, B.y + 200); run(game, 0.5);
  ok(side.hp < hs, 'боковую турель видно снизу');
});
test('крейсер: турели стреляют в самолёт', () => {
  const { game, S } = setup(1); const B = toBoss(game, S);
  B.turrets.forEach(t => { t.fireT = 0; }); game.update(1 / 60);
  ok(S.bullets.filter(b => b.src === 'turret').length >= 3);
});
test('крейсер: все турели погашены — тонет, перелёт пройден (бонус), дальше — следующий', () => {
  const { game, S, has } = setup(1); const B = toBoss(game, S);
  B.turrets.forEach(t => { t.hp = 1; t.fireT = 99; });
  B.turrets.forEach(t => { S.shots.push({ x: B.x + t.dx, y: B.y + t.dy + 4, vx: 0, vy: -1 }); });
  game.update(1 / 60);
  ok(B.sinking); ok(has('bossSink'));
  run(game, 2.7); eq(S.phase, 'clear'); ok(has('clear')); ok(S.clearBonus >= L.EMAX * 10, 'бонус за энергию');
  run(game, 3); eq(S.level, 2); eq(S.stage, 'route'); eq(S.player.energy, L.EMAX); eq(S.player.loops, L.LOOPS);
});
test('победа: после 8-го перелёта (7 турелей) — win', () => {
  const { game, S, has } = setup(8); const B = toBoss(game, S);
  eq(B.turrets.length, 7);
  B.turrets.forEach(t => { t.hp = 1; t.fireT = 99; S.shots.push({ x: B.x + t.dx, y: B.y + t.dy + 4, vx: 0, vy: -1 }); });
  game.update(1 / 60); ok(B.sinking);
  run(game, 6); ok(S.over && S.won); ok(has('win'));
});

// ---------- прочее ----------
test('+1 самолёт за 40000 очков', () => {
  const { game, S, has } = setup(1); S.score = 39950; game._pickup('fuel'); eq(S.lives, 4); ok(has('life'));
});
test('детерминизм: одинаковый сид и ввод — одинаковая партия', () => {
  const play = () => { const g = E.Game({ rng: mulberry32(9) }).start(); g.setFire(true); for (let i = 0; i < 1800; i++){ g.setDir(Math.sin(i / 40), Math.cos(i / 55)); g.update(1 / 60); } const s = g.state(); return [s.score, s.player.energy, s.dist.toFixed(2), s.kills].join(); };
  eq(play(), play());
});
test('difficulty-хук движка: параметры перелёта берутся из переданной функции', () => {
  const calls = []; const game = E.Game({ rng: mulberry32(1), difficulty: (lv, base) => { calls.push(lv); return base; } }).start();
  ok(calls.length > 8 && calls.every(l => l === 1)); eq(game._S.prm.bulletV, 165);
});
test('музыка: оригинальный трек eskadrilya подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.eskadrilya; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('правило имён: нет чужих игр, компаний, реальных самолётов/кораблей/битв (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('aW52YWRlcnM/fNC40L3QslvQtdCwXdC50LTQtdGAfHRhaXRvfNGC0LDQudGC0L58Z2FsYWd80LPQsNC70LDQs3xnYWxheGlhbnzQs9Cw0LvQsNC60YHQuNCw0L18XGJwaG9lbml4XGJ80YTQtdC90LjQutGBfHBhYy0/bWFufNC/0LDQutC80LDQvXx0ZXRyaXN80YLQtdGC0YDQuNGBfFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxrb25hbWl80LrQvtC90LDQvNC4fG5hbWNvfNC90LDQvNC60L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fHNlZ2FcYnzRgdC10LPQsCg/IVvQsC3Rj9GRXSl8dGVjbW98ZGl6enl8ZGVlcHNlZWt8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofHJpdmVyID9yYWlkfNGA0LjQstC10YAgP9GA0LXQudC0fGV4b2xvbnzRjdC60YHQvtC70L7QvXx2aXRvcmN80LLQuNGC0L7RgNC6fGxvc3QgP3Zpa2luZ3N8ZG91YmxlID9kcmFnb258YmF0dGxldG9hZHN8c2lsa3dvcm18XGIxOTRbMC05XVxifFxiMTl4eFxifHNreSA/c2hhcmt8Zmx5aW5nID9zaGFya3x0aWdlci0/aGVsaXx0d2luID9jb2JyYXxyYWlkZW580YDQsNC50LTQtdC9fNGA0LXQudC00LXQvXx4ZXZpb3VzfNC60YHQtdCy0LjRg9GBfHN0cmlrZXJzfGFlcm8gP2ZpZ2h0ZXJzfHNvbmljID93aW5nc3x0cnV4dG9ufHRhdHN1amlufGJhdHN1Z3VufGlrYXJ1Z2F8dG9hcGxhbnxzZWlidXxwc2lreW98Z3VuXC4/c21va2V8c3BpdGZpcmV80YHQv9C40YLRhNCw0LnRgHxtZXNzZXJzY2htaXR0fNC80LXRgdGB0LXRgNGI0LzQuNGCfG11c3Rhbmd80LzRg9GB0YLQsNC90LN8aGVsbGNhdHxjb3JzYWlyfNC60L7RgNGB0LDRgHxzdHVrYXxqdW5rZXJzfNGO0L3QutC10YDRgXxmb2trZXJ80YTQvtC60LrQtdGAfHNvcHdpdGh80YHQvtC/0LLQuNGHfHJlZCA/YmFyb2580LrRgNCw0YHQvdGL0Lkg0LHQsNGA0L7QvXx6ZXBwZWxpbnzRhtC10L/Qv9C10LvQuNC9fHlhbWF0b3zRj9C80LDRgtC+fGJpc21hcmNrfNCx0LjRgdC80LDRgNC6fG1pZHdheXzQvNC40LTRg9GN0Ll8cGVhcmwgP2hhcmJvdT9yfNC/0LXRgNC7LT/RhdCw0YDQsdC+0YB8c3RhbGluZ3JhZHzRgdGC0LDQu9C40L3Qs9GA0LDQtHxub3JtYW5kfNC90L7RgNC80LDQvdC00Lh8bHVmdHdhZmZlfNC70Y7RhNGC0LLQsNGE0YTQtXxrYW1pa2F6ZXzQutCw0LzQuNC60LDQtNC30LV8dGl0YW5pY3zRgtC40YLQsNC90LjQunxcYnAtPygzOHw0N3w1MSlcYnxcYmJmLT8xMDl8XGJhNm18KD88IVvQsC3Rj9GRXSnQuNC7LT8yKD8hWzAtOV0pfCg/PCFb0LAt0Y/RkV0p0Y/Qui0/WzAtOV18KD88IVvQsC3Rj9GRXSnQvNC40LMtP1swLTld', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('0Y/Qui0z')) && BAD.test(u('WkVQUEVMSU4=')), 'стоп-лист работает');
  ok(!BAD.test('эскадрилья') && !BAD.test('дирижабль') && !BAD.test('паролёт') && !BAD.test('контрастный') && !BAD.test('стрела-5'), 'без ложных срабатываний');
});

// ---------- проходимость и баланс ----------
// «Собранный» бот (реакция 0.1 с, без зевков) с типичной к середине игры оснасткой (стволы 3, звено):
// каждый перелёт проходится хотя бы в 2 из 3 партий.
const PASS = [];
for (let lv = 1; lv <= 8; lv++) for (const s of [1, 2, 3]) PASS.push({ lv, s, r: playEskadrilya(E, s, { perfect: true, startLevel: lv, levels: 1, loadout: { power: 3, wing: true }, maxLevelT: 300 }) });
test('проходимость: каждый из 8 перелётов проходится «собранным» ботом (≥ 2 из 3, ≤ 300 с)', () => {
  console.log('     время, с: ' + PASS.map(p => p.lv + ':' + (p.r.levelTime[p.lv] || 0).toFixed(0) + (p.r.won ? '' : '✗')).join(' '));
  const bad = []; for (let lv = 1; lv <= 8; lv++) if (PASS.filter(p => p.lv === lv && p.r.won).length < 2) bad.push(lv);
  ok(!bad.length, 'не пройдены: ' + bad.join(', '));
  ok(!PASS.some(p => p.r.stuck), 'зависание');
});

// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, внимание на 6 ближайших пуль, ошибка оценки скорости,
// разброс прицела, зевки; ввод только setDir/setFire/loop. 40 партий (сиды 1..40).
// Цели: 1-й перелёт ≥ 90%, все 8 ≈ 20–40% (допуск 20–45% на 40 партиях).
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playEskadrilya(E, s));
test('баланс: бот проходит 1-й перелёт в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.passed >= 1).length; console.log('     перелёт 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: все 8 перелётов — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(9).fill(0); BAL.forEach(r => dist[r.passed]++);
  console.log('     все 8: ' + n + '/' + N + '; пройдено перелётов 0..8: ' + dist.join(','));
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял: ' + BAL.filter(r => r.stuck).map(r => r.stuck).join(','));
});
test('непресность: потерь самолётов на перелёт больше во второй половине', () => {
  const per = []; for (let l = 1; l <= 8; l++){ const reach = BAL.filter(r => r.passed >= l - 1).length; let x = 0; for (const r of BAL) x += (r.lost[l] || 0); per.push(x / Math.max(1, reach)); }
  console.log('     потерь на перелёт: ' + per.map(v => v.toFixed(2)).join(' / '));
  const a = per.slice(0, 4).reduce((x, y) => x + y) / 4, b = per.slice(4).reduce((x, y) => x + y) / 4;
  ok(b > a * 1.5, 'нет нарастания: ' + a.toFixed(2) + ' → ' + b.toFixed(2));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

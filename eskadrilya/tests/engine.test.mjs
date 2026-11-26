/* ЭСКАДРИЛЬЯ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей). Переделка 2026-11 «Наводка и завеса».
   Запуск: node eskadrilya/tests/engine.test.mjs (QUICK=1 — без баланса). Логика (js/game.js) в node:vm с шимом window. */
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
  const game = E.Game(Object.assign({ rng: mulberry32(opts.seed || 1), noTut: true, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game._S; if (level !== 1) game._setupLevel(level);
  if (!opts.keepScript){ S.script.air = []; S.script.ground = []; }
  S.player.grace = 0; S.banner = 0;
  if (!opts.fire) game.setFire(false);   // автоогонь мешает точечным проверкам
  ev.length = 0;
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec){ for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
function shootAt(game, S, x, y){ S.shots.push({ x, y, vx: 0, vy: -L.SHOT_V }); game.update(1 / 60); }
// клуб дыма в экранной точке (x,y), уже «выросший»
function puff(game, S, x, y){ const p = game._puff(x, y, 1, true); p.t = 0.6; p.wy = game._wy(y); return p; }
// неподвижная птица-стрелок в точке (x,y)
function sitter(game, x, y){ const e = game._spawnAir('bird', x, y, { pat: 'cross', vx: 0, calm: true }); e.y0 = y; e.fired = true; return e; }
function hold(e, x, y){ e.x = x; e.y = y; }

// ---------- структура ----------
test('перелёты: 8 штук, у каждого имя и Летучая кузня на 5 языках, гондол 3→7', () => {
  eq(L.LEVELS.length, 8);
  for (const l of ['ru', 'en', 'tr', 'es', 'pt']) L.LEVELS.forEach((lv, i) => ok(E.STR[l]['lv_' + lv.name] && E.STR[l]['boss_' + (i + 1)], l + ' ' + lv.name));
  eq(L.LEVELS.map(l => l.pods).join(','), '3,3,4,4,5,5,6,7');
  eq(new Set(L.LEVELS.map(l => l.name)).size, 8);
});
test('языки: ru/en/tr/es/pt — одинаковые ключи; название RU ЭСКАДРИЛЬЯ, EN/TR/ES/PT HAZEWING', () => {
  const S = E.STR, ks = Object.keys(S.ru).sort().join(','); eq(Object.keys(S).join(','), 'ru,en,tr,es,pt');
  for (const l of ['en', 'tr', 'es', 'pt']) eq(Object.keys(S[l]).sort().join(','), ks, l);
  eq(S.ru.title, 'ЭСКАДРИЛЬЯ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'HAZEWING', l);
});
test('старт: 3 самолёта, обшивка 3, полный запас дыма, одиночный огонь', () => {
  const { S } = setup(1);
  eq(S.lives, 3); eq(S.player.hull, L.HULL); eq(S.player.smoke, L.SMAX); eq(S.player.power, 1);
});
test('переделка: нет петли, звена ведомых, «красных» стай и энергии (прежние признаки убраны из логики, рендеров и строк)', () => {
  const { S, game } = setup(1);
  for (const k of ['loops', 'loopT', 'wing', 'energy']) ok(!(k in S.player), 'player.' + k);
  for (const k of ['loop', 'setWing']) ok(!(k in game), 'api.' + k);
  ok(!('LOOP_T' in L) && !('LOOPS' in L) && !('EMAX' in L) && !('WING_DX' in L), 'константы');
  for (const f of ['js/game.js', 'js/modern.js', 'js/classic.js', 'js/ui.js', 'js/main.js', 'js/i18n.js', 'index.html'])
    ok(!/loopT|LOOP_|\bwingmen?\b|ведом|петл|красн(ая|ой|ые) ста|\bred flock|\.wing\[/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
});

// ---------- прокрутка и рельеф ----------
test('прокрутка: мир едет вниз со скоростью SCROLL, наземная цель смещается по экрану', () => {
  const { game, S } = setup(1);
  const g = game._spawnGround('depot', 240, S.dist + 400);
  const y0 = game._sy(g.wy), d0 = S.dist; run(game, 1);
  ok(Math.abs(S.dist - d0 - L.SCROLL) < 1, 'дистанция ' + (S.dist - d0)); ok(Math.abs(game._sy(g.wy) - y0 - L.SCROLL) < 1, 'цель сместилась');
});
test('рельеф: детерминирован; старт и подход кузни — открытое море; зенитки и склады на суше, катера на воде', () => {
  for (let lv = 1; lv <= 8; lv++){
    const T1 = L.makeTerrain(lv), T2 = L.makeTerrain(lv);
    eq(JSON.stringify(T1), JSON.stringify(T2), 'детерминизм ' + lv);
    ok(!L.isLand(T1, 240, 200) && !L.isLand(T1, 240, L.H), 'старт — море, ' + lv);
    for (let wy = T1.len + 100; wy < T1.len + 1000; wy += 50) ok(!L.isLand(T1, 240, wy), 'у кузни суша, ' + lv + ' @' + wy);
    const sc = L.makeScript(lv, T1, L.params(lv));
    sc.ground.forEach(o => ok(o.type === 'boat' ? !L.isLand(T1, o.x, o.wy) : L.isLand(T1, o.x, o.wy), o.type + ' не на своём месте, ' + lv));
    ok(sc.ground.some(o => o.type === 'flak'), 'нет зениток, ' + lv); ok(sc.ground.some(o => o.type === 'boat'), 'нет катеров, ' + lv);
    ok(sc.air.length > 12, 'мало налётов, ' + lv);
  }
});

// ---------- наводка ----------
test('наводка: враг сначала тянет линию к самолёту (aimT по перелёту), выстрел — только после неё', () => {
  const { game, S, has } = setup(1); const P = S.player; P.x = 240; P.y = 540;
  const e = sitter(game, 240, 200);
  ok(game._startAim(e, e.x, e.y), 'наводка началась'); ok(has('aim'));
  game.update(1 / 60); hold(e, 240, 200);
  eq(S.aims.length, 1, 'линия видна'); eq(S.bullets.length, 0, 'до конца наводки выстрела нет');
  run(game, S.prm.aimT - 0.05); eq(S.bullets.length, 0, 'ещё целится');
  run(game, 0.12); ok(S.bullets.length >= 1, 'выстрел'); ok(S.bullets[0].vy > 0, 'в самолёт');
  ok(L.params(8).aimT < L.params(1).aimT, 'к 8-му перелёту наводка короче');
});
test('наводка: вблизи (< 80 px) и у кромок экрана не начинается', () => {
  const { game, S } = setup(1); const P = S.player; P.x = 240; P.y = 300;
  const e = sitter(game, 240, 250); ok(!game._startAim(e, e.x, e.y), 'вплотную');
  ok(!game._startAim(e, 240, L.TOP + 2), 'под HUD');
});

// ---------- дым ----------
test('дым: удержание тратит запас и выпускает клубы вперёд по курсу; отпустил — после паузы запас копится', () => {
  const { game, S, has } = setup(1); const P = S.player; P.x = 240; P.y = 540;
  game.setSmoke(true); run(game, 1);
  ok(P.smoke < L.SMAX - 40 && P.smoke > 0, 'запас ' + P.smoke.toFixed(1)); ok(S.puffs.length > 10, 'клубов ' + S.puffs.length); ok(has('smokeStart'));
  ok(S.puffs.every(p => game._sy(p.wy) < P.y), 'клубы впереди (выше) самолёта');
  const far = Math.min(...S.puffs.map(p => game._sy(p.wy))); ok(P.y - far > 40 && P.y - far < 200, 'завеса перед носом: ' + (P.y - far).toFixed(0));
  game.setSmoke(false); const s0 = P.smoke; run(game, L.SM_DELAY * 0.8); eq(P.smoke, s0, 'пауза перед подзарядкой');
  run(game, 2); ok(P.smoke > s0 + 3, 'подзарядка');
  P.smoke = 0; game.setSmoke(true); const n = S.puffs.length; run(game, 0.2); ok(S.puffs.length <= n, 'пустой котёл не дымит');
});
test('дым: клубы растут, тают за PUFF_LIFE и уплывают назад с миром', () => {
  const { game, S } = setup(1);
  const p = game._puff(240, 300, 1, true); const r0 = L.puffR(p); run(game, 0.5); ok(L.puffR(p) > r0, 'растёт');
  const y = game._sy(p.wy); run(game, 0.5); ok(game._sy(p.wy) > y + 20, 'уплывает вниз');
  run(game, L.PUFF_LIFE); ok(!S.puffs.includes(p), 'растаял');
});
test('срыв: клуб на линии наводки — выстрела нет, стрелок слепнет на BLIND_T, +25 очков (до BROKEN_CAP за перелёт)', () => {
  const { game, S, has } = setup(1); const P = S.player; P.x = 240; P.y = 540;
  const e = sitter(game, 240, 200); game._startAim(e, 240, 200);
  puff(game, S, 240, 380); const s0 = S.score;
  game.update(1 / 60); hold(e, 240, 200);
  ok(has('aimBroken')); eq(e.aimT, 0); ok(e.blindT > 0, 'ослеп'); eq(S.score - s0, L.BROKEN_PTS); eq(S.broken, 1);
  run(game, 1); eq(S.bullets.length, 0, 'выстрела не было');
  S.brokenHere = L.BROKEN_CAP; e.blindT = 0; e.fireT = 99; game._startAim(e, 240, 200); const s1 = S.score; game.update(1 / 60); hold(e, 240, 200);
  eq(S.broken, 2); eq(S.score - s1, 0, 'сверх BROKEN_CAP за перелёт очков нет');
  ok(!game._startAim(e, 240, 200) || e.blindT <= 0, 'слепой не целится сразу');
});
test('срыв: дым в стороне от линии не мешает; уже выпущенную пулю дым не гасит', () => {
  const { game, S, has } = setup(1); const P = S.player; P.x = 240; P.y = 540;
  const e = sitter(game, 240, 200); game._startAim(e, 240, 200);
  puff(game, S, 400, 380);
  for (let i = 0; i < 60 && !S.bullets.length; i++){ game.update(1 / 60); hold(e, 240, 200); }
  ok(!has('aimBroken') && S.bullets.length, 'выстрел состоялся');
  const b = S.bullets[0]; puff(game, S, 240, b.y + 30); run(game, 0.3); ok(S.bullets.includes(b) || has('hurt'), 'пуля летит сквозь дым');
});
test('копоть: враг внутри дыма не целится, теряет ход и при сбитии даёт ×2', () => {
  const { game, S, has } = setup(1); const P = S.player; P.x = 240; P.y = 560;
  const e = game._spawnAir('bird', 240, 200, { pat: 'sine', vy: 100, amp: 0, calm: true });
  puff(game, S, 240, 200); game.update(1 / 60);
  ok(has('sooted') && e.sootT > 0, 'закопчён'); eq(S.sooted, 1);
  ok(!game._startAim(e, e.x, e.y), 'не целится');
  const y0 = e.y; game.update(0.1); ok(e.y - y0 < 100 * 0.1 * 0.7, 'теряет ход');
  const s0 = S.score; shootAt(game, S, e.x, e.y + 6); ok(!e.alive); eq(S.score - s0, L.PTS.bird * 2);
});

// ---------- обшивка, самолёты, стволы, бонусы ----------
test('обшивка: попадание снимает 1 заплату, короткая неуязвимость; 0 — самолёт потерян, возрождение с полной обшивкой и полным дымом', () => {
  const { game, S, has } = setup(1); const P = S.player;
  ok(game._hurt(P.x, P.y)); eq(P.hull, 2); ok(!game._hurt(P.x, P.y), 'неуязвимость'); eq(P.hull, 2);
  P.grace = 0; game._hurt(P.x, P.y); P.grace = 0; game._hurt(P.x, P.y);
  ok(P.dead && has('playerLost')); eq(S.lives, 2);
  P.smoke = 5; run(game, 2); ok(!P.dead && has('respawn')); eq(P.hull, L.HULL); eq(P.smoke, L.SMAX); ok(P.grace > 0);
});
test('поражение: последний самолёт потерян — gameover', () => {
  const { game, S, has } = setup(1); S.lives = 1; const P = S.player;
  for (let i = 0; i < 3; i++){ P.grace = 0; game._hurt(P.x, P.y); }
  ok(S.over && !S.won && has('gameover'));
});
test('стволы: 1 → 1 пуля, 2 → 2, 3 → 4 за залп; потеря самолёта — минус ступень', () => {
  const { game, S } = setup(1); const P = S.player;
  for (const [pw, n] of [[1, 1], [2, 2], [3, 4]]){ P.power = pw; S.shots = []; P.cool = 0; game.fire(); eq(S.shots.length, n, 'стволы ' + pw); }
  P.power = 3; for (let i = 0; i < 3; i++){ P.grace = 0; game._hurt(P.x, P.y); } eq(P.power, 2);
});
test('бонусы: дым — полный запас; заплата +1 (при полной — +300); стволы до 3 (сверх — +500); склад даёт дым/заплату', () => {
  const { game, S } = setup(1); const P = S.player;
  P.smoke = 10; game._pickup('smoke'); eq(P.smoke, L.SMAX);
  P.hull = 1; game._pickup('patch'); eq(P.hull, 2); P.hull = 3; let s0 = S.score; game._pickup('patch'); eq(S.score - s0, 400);
  P.power = 3; s0 = S.score; game._pickup('power'); eq(P.power, 3); eq(S.score - s0, 600);
  const d = game._spawnGround('depot', 240, S.dist + 440);
  for (let i = 0; i < 2; i++) shootAt(game, S, 240, game._sy(d.wy) + 8);
  ok(!d.alive); ok(S.pickups.some(q => q.kind === 'smoke'), 'склад → дым');
});

// ---------- враги ----------
test('зенитка: наводка → выстрел в самолёт, глохнет после 4 попаданий (+250)', () => {
  const { game, S, has } = setup(1); S.player.x = 240; S.player.y = 560;
  const f = game._spawnGround('flak', 240, S.dist + 440); f.fireT = 0;
  game.update(1 / 60); ok(has('aim') && f.aimT > 0, 'наводка'); eq(S.bullets.length, 0);
  run(game, S.prm.aimT + 0.05);
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
test('дирижабль: прочный, после наводки бьёт веером из 3 снарядов, сбит — выпадает бонус', () => {
  const { game, S, has } = setup(2); S.player.x = 240; S.player.y = 560;
  const bl = game._spawnAir('blimp', 240, 160, { vy: 0 }); bl.fireT = 0;
  game.update(1 / 60); ok(bl.aimT > 0, 'наводка'); run(game, S.prm.aimT + 0.05);
  eq(S.bullets.filter(b => b.src === 'blimp').length, 3, 'веер'); S.bullets = [];
  ok(bl.hp > 10, 'прочный');
  for (let i = 0; i < 60 && bl.alive; i++){ bl.y = 160; shootAt(game, S, 240, 170); }
  ok(!bl.alive && has('kill')); ok(S.pickups.length === 1, 'бонус');
});
test('стриж: зависает и целится, потом пикирует в точку наводки; сорвали — уходит вниз мимо', () => {
  let { game, S } = setup(2); let P = S.player; P.x = 120; P.y = 540;
  let sw = game._spawnAir('swift', 360, 100, { stopY: 120 });
  run(game, 0.4); eq(sw.mode, 'lock'); ok(sw.aimT > 0);
  run(game, S.prm.aimT + 0.1); eq(sw.mode, 'dive'); ok(sw.vx < 0 && sw.vy > 0, 'к самолёту');
  ({ game, S } = setup(2)); P = S.player; P.x = 240; P.y = 540;
  sw = game._spawnAir('swift', 240, 100, { stopY: 120 }); run(game, 0.4); eq(sw.mode, 'lock');
  puff(game, S, 240, 330); run(game, 0.1);
  eq(sw.mode, 'dive'); ok(Math.abs(sw.vx) <= 30, 'сорванный уходит почти прямо');
});

// ---------- Летучая кузня ----------
function toBoss(level = 1){
  const t = setup(level); const { game, S } = t; game._spawnBoss(); let i = 0;
  while (!S.boss.anchored && i++ < 600) game.update(1 / 60);
  t.ev.length = 0; return t;
}
test('кузня: подходит в конце маршрута, встаёт (прокрутка 0); пока идёт — гондолы не берутся (звон)', () => {
  const { game, S, has } = setup(1); S.dist = S.terrain.len - 1; game.update(1 / 60);
  ok(S.boss && S.stage === 'boss' && has('bossArrive'));
  const B = S.boss, pd = B.pods[0]; run(game, 2.3); ok(!B.anchored, 'ещё идёт'); ok(B.y + pd.dy > L.TOP + 20, 'видна');
  const hp = pd.hp; shootAt(game, S, B.x + pd.dx, B.y + pd.dy + 4); eq(pd.hp, hp, 'под ходу не берётся'); ok(has('clang'));
  run(game, 4); ok(B.anchored && has('bossAnchor')); eq(S.scroll, 0);
  eq(B.pods.length, 3);
});
test('кузня: гондолы целятся и стреляют после наводки; дым у винтов съедается, посередине — держится', () => {
  const { game, S } = toBoss(1); const B = S.boss;
  B.pods.forEach(p => { p.fireT = 0; }); game.update(1 / 60);
  ok(B.pods.some(p => p.aimT > 0), 'наводка'); run(game, S.prm.aimT + 0.1); ok(S.bullets.some(b => b.src === 'pod'), 'выстрел');
  const f = L.FANS[0];
  const side = puff(game, S, B.x + f.dx + 40, B.y + f.dy + 30), mid = puff(game, S, B.x, B.y + 200);
  run(game, 0.8); ok(!S.puffs.includes(side), 'винт съел дым'); ok(S.puffs.includes(mid), 'посередине держится');
});
test('кузня: все гондолы сбиты — открыт горн; горн сбит — кузня падает, перелёт пройден с бонусом, дальше — следующий', () => {
  const { game, S, has } = toBoss(1); const B = S.boss;
  for (const pd of B.pods) for (let i = 0; i < 60 && pd.alive; i++){ S.bullets = []; shootAt(game, S, B.x + pd.dx, B.y + pd.dy + 4); }
  ok(B.pods.every(p => !p.alive)); ok(B.core.open && has('coreOpen'));
  for (let i = 0; i < 200 && !B.falling; i++){ S.bullets = []; shootAt(game, S, B.x, B.y); }
  ok(B.falling && has('bossDown'));
  run(game, 3); ok(S.phase === 'clear' && has('clear')); ok(S.clearBonus >= 1000, 'бонус без потерь');
  run(game, 3); eq(S.level, 2); eq(S.stage, 'route');
});
test('победа: после 8-го перелёта (7 гондол) — win', () => {
  const { game, S, has } = toBoss(8); eq(S.boss.pods.length, 7);
  game._finish(); run(game, 3); ok(S.over && S.won && has('win'));
});

// ---------- обучение, счёт, площадка, миграция ----------
test('обучение 1-го перелёта: полёт → линия наводки → «держи дым» → срыв → подсказка про ×2; первые налёты без огня', () => {
  const g = E.Game({ rng: mulberry32(1) }).start(), S = g.state(); g.setFire(false);
  eq(S.tip, 'tut1'); g.setDir(1, 0); run(g, 0.6); g.setDir(0, 0); ok(S.tip !== 'tut1', 'шаг 1');
  ok(S.script.air.filter(a => a.at < 900).every(a => a.calm), 'первые налёты не стреляют');
  const e = sitter(g, 240, 200); S.player.x = 240; S.player.y = 540; g._startAim(e, 240, 200); g.update(1 / 60); hold(e, 240, 200);
  eq(S.tip, 'tut2'); run(g, 3.4); eq(S.tip, 'tut3');
  e.blindT = 0; e.sootT = 0; g._startAim(e, 240, 200); puff(g, S, 240, 380); g.update(1 / 60); hold(e, 240, 200);
  eq(S.tip, 'tut4');
  ok(L.makeScript(1, L.makeTerrain(1), L.params(1)).ground.every(o => o.wy >= L.H + 900), 'наземные цели — после разминки');
});
test('+1 самолёт за 40000 очков', () => {
  const { game, S, has } = setup(1); S.score = 39950; game._pickup('smoke'); eq(S.lives, 4); ok(has('life'));
});
test('площадка: «ещё шанс» — 1 самолёт на том же перелёте с неуязвимостью; бонус в паузе +1 самолёт (до 5)', () => {
  const { game, S } = setup(3); S.lives = 1; const P = S.player;
  for (let i = 0; i < 3; i++){ P.grace = 0; game._hurt(P.x, P.y); } ok(S.over);
  ok(game.reviveAd()); ok(!S.over && !P.dead); eq(S.lives, 1); eq(S.level, 3); ok(P.grace > 2);
  ok(game.canBoost() && game.boost()); eq(S.lives, 2); S.lives = 5; ok(!game.canBoost());
});
test('миграция: прежний рекорд уходит в «прежний рекорд», рекорд начинается заново; повторно — ничего не трогает', () => {
  const m = new Map([['arcade.best.eskadrilya', '52000']]);
  const ls = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  eq(E.migrate(ls), 52000); ok(!m.has('arcade.best.eskadrilya')); eq(m.get('arcade.eskadrilya.oldBest'), '52000'); eq(m.get('arcade.eskadrilya.v'), '2');
  m.set('arcade.best.eskadrilya', '700'); eq(E.migrate(ls), 0); eq(m.get('arcade.best.eskadrilya'), '700', 'новый рекорд не трогается');
  const fresh = new Map(); const ls2 = { getItem: k => fresh.has(k) ? fresh.get(k) : null, setItem: (k, v) => fresh.set(k, v), removeItem: k => fresh.delete(k) };
  eq(E.migrate(ls2), 0); ok(!fresh.has('arcade.eskadrilya.oldBest'));
  eq(E.migrate(null), 0); eq(E.migrate({ getItem(){ throw new Error('x'); } }), 0);
});
test('детерминизм: одинаковый сид и ввод — одинаковая партия', () => {
  const play = () => { const g = E.Game({ rng: mulberry32(9) }).start(); for (let i = 0; i < 1800; i++){ g.setDir(Math.sin(i / 40), Math.cos(i / 55)); g.setSmoke(i % 90 < 30); g.update(1 / 60); } const s = g.state(); return [s.score, s.player.hull, s.player.smoke.toFixed(3), s.dist.toFixed(2), s.kills, s.broken].join(); };
  eq(play(), play());
});
test('difficulty-хук движка: параметры перелёта берутся из переданной функции', () => {
  const calls = []; const game = E.Game({ rng: mulberry32(1), difficulty: (lv, base) => { calls.push(lv); return base; } }).start();
  ok(calls.length > 8 && calls.every(l => l === 1)); eq(game._S.prm.bulletV, 190);
});
test('музыка: оригинальный трек eskadrilya подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.eskadrilya; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('страница: фавикон, «← Каталог», canvas 480×640, скрипты по порядку, стик и кнопка ☁, пауза; engine.js = _shared, stick.js = otsek', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон'); ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'каталог');
  ok(/<canvas id="c" width="480" height="640"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order.join(','), 'engine.js,js/music.js,js/i18n.js,js/game.js,js/audio.js,js/ui.js,js/modern.js,js/classic.js,js/stick.js,js/main.js');
  ok(/data-stick/.test(html) && /data-act="smoke"/.test(html) && /id="bPause"/.test(html), 'тач');
  eq(fs.readFileSync(path.join(ROOT, 'js/stick.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', 'otsek', 'js', 'stick.js'), 'utf8'), 'stick.js — копия otsek');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\//.test(html), 'нет внешних ссылок');
  const ui = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8'); ok((ui.match(/Arcade\.touchOk\(e\)/g) || []).length >= 3, 'кнопки — через Arcade.touchOk');
});
test('площадка: стик, карточка между перелётами с межстраничной, menuFit, g.persist, ещё шанс и бонус', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/ArcadeStick\.create/.test(main) && /stick\.active/.test(main), 'стик');
  ok(/g\.adBreak\(\)/.test(main) && /g\.adReady\(\)/.test(main), 'межстраничная по нажатию на карточке');
  ok(/menuFit/.test(main), 'menuFit'); ok(/g\.persist\('arcade\.best\.eskadrilya', 'max'\)/.test(main), 'рекорд в облако');
  ok(/useRewardedContinue/.test(main) && /useRewardedBonus/.test(main), 'реклама за награду');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'eskadrilya', boards: ['eskadrilya'], test, ok }); }
test('правило имён: нет чужих игр, компаний, реальных самолётов/кораблей/битв (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('aW52YWRlcnM/fNC40L3QslvQtdCwXdC50LTQtdGAfHRhaXRvfNGC0LDQudGC0L58Z2FsYWd80LPQsNC70LDQs3xnYWxheGlhbnzQs9Cw0LvQsNC60YHQuNCw0L18XGJwaG9lbml4XGJ80YTQtdC90LjQutGBfHBhYy0/bWFufNC/0LDQutC80LDQvXx0ZXRyaXN80YLQtdGC0YDQuNGBfFxiY29udHJhXGJ80LrQvtC90YLRgNCwKD8hW9CwLdGP0ZFdKXxrb25hbWl80LrQvtC90LDQvNC4fG5hbWNvfNC90LDQvNC60L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fHNlZ2FcYnzRgdC10LPQsCg/IVvQsC3Rj9GRXSl8dGVjbW98ZGl6enl8ZGVlcHNlZWt8eG9uaXh80LrRgdC+0L3QuNC60YF8YmF0dGxlID9jaXR5fGxvZGUgP3J1bm5lcnxib3VsZGVyID9kYXNofHJpdmVyID9yYWlkfNGA0LjQstC10YAgP9GA0LXQudC0fGV4b2xvbnzRjdC60YHQvtC70L7QvXx2aXRvcmN80LLQuNGC0L7RgNC6fGxvc3QgP3Zpa2luZ3N8ZG91YmxlID9kcmFnb258YmF0dGxldG9hZHN8c2lsa3dvcm18XGIxOTRbMC05XVxifFxiMTl4eFxifHNreSA/c2hhcmt8Zmx5aW5nID9zaGFya3x0aWdlci0/aGVsaXx0d2luID9jb2JyYXxyYWlkZW580YDQsNC50LTQtdC9fNGA0LXQudC00LXQvXx4ZXZpb3VzfNC60YHQtdCy0LjRg9GBfHN0cmlrZXJzfGFlcm8gP2ZpZ2h0ZXJzfHNvbmljID93aW5nc3x0cnV4dG9ufHRhdHN1amlufGJhdHN1Z3VufGlrYXJ1Z2F8dG9hcGxhbnxzZWlidXxwc2lreW98Z3VuXC4/c21va2V8c3BpdGZpcmV80YHQv9C40YLRhNCw0LnRgHxtZXNzZXJzY2htaXR0fNC80LXRgdGB0LXRgNGI0LzQuNGCfG11c3Rhbmd80LzRg9GB0YLQsNC90LN8aGVsbGNhdHxjb3JzYWlyfNC60L7RgNGB0LDRgHxzdHVrYXxqdW5rZXJzfNGO0L3QutC10YDRgXxmb2trZXJ80YTQvtC60LrQtdGAfHNvcHdpdGh80YHQvtC/0LLQuNGHfHJlZCA/YmFyb2580LrRgNCw0YHQvdGL0Lkg0LHQsNGA0L7QvXx6ZXBwZWxpbnzRhtC10L/Qv9C10LvQuNC9fHlhbWF0b3zRj9C80LDRgtC+fGJpc21hcmNrfNCx0LjRgdC80LDRgNC6fG1pZHdheXzQvNC40LTRg9GN0Ll8cGVhcmwgP2hhcmJvdT9yfNC/0LXRgNC7LT/RhdCw0YDQsdC+0YB8c3RhbGluZ3JhZHzRgdGC0LDQu9C40L3Qs9GA0LDQtHxub3JtYW5kfNC90L7RgNC80LDQvdC00Lh8bHVmdHdhZmZlfNC70Y7RhNGC0LLQsNGE0YTQtXxrYW1pa2F6ZXzQutCw0LzQuNC60LDQtNC30LV8dGl0YW5pY3zRgtC40YLQsNC90LjQunxcYnAtPygzOHw0N3w1MSlcYnxcYmJmLT8xMDl8XGJhNm18KD88IVvQsC3Rj9GRXSnQuNC7LT8yKD8hWzAtOV0pfCg/PCFb0LAt0Y/RkV0p0Y/Qui0/WzAtOV18KD88IVvQsC3Rj9GRXSnQvNC40LMtP1swLTld', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('0Y/Qui0z')) && BAD.test(u('WkVQUEVMSU4=')), 'стоп-лист работает');
  ok(!BAD.test('эскадрилья') && !BAD.test('дирижабль') && !BAD.test('паролёт') && !BAD.test('контрастный') && !BAD.test('стрела-5'), 'без ложных срабатываний');
});


// ---------- проходимость и баланс (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без баланса)'); process.exit(failed ? 1 : 0); }
// «Собранный» бот (реакция 0.1 с, без зевков) с типичной к середине игры оснасткой (стволы 3):
// каждый перелёт проходится хотя бы в 2 из 3 партий.
const PASS = [];
for (let lv = 1; lv <= 8; lv++) for (const s of [1, 2, 3]) PASS.push({ lv, s, r: playEskadrilya(E, s, { perfect: true, startLevel: lv, levels: 1, power: 3, maxLevelT: 300 }) });
test('проходимость: каждый из 8 перелётов проходится «собранным» ботом (≥ 2 из 3, ≤ 300 с)', () => {
  console.log('     время, с: ' + PASS.map(p => p.lv + ':' + (p.r.levelTime[p.lv] || 0).toFixed(0) + (p.r.won ? '' : '✗')).join(' '));
  const bad = []; for (let lv = 1; lv <= 8; lv++) if (PASS.filter(p => p.lv === lv && p.r.won).length < 2) bad.push(lv);
  ok(!bad.length, 'не пройдены: ' + bad.join(', '));
  ok(!PASS.some(p => p.r.stuck), 'зависание');
});

// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, внимание на 6 ближайших пуль, ошибка оценки скорости,
// разброс прицела, зевки; ввод только setDir/setSmoke (огонь сам). 40 партий (сиды 1..40).
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
test('механика в ходу: бот срывает наводку и коптит врагов; без дыма тот же бот проходит заметно меньше', () => {
  const br = BAL.reduce((s, r) => s + r.broken, 0) / N, so = BAL.reduce((s, r) => s + r.sooted, 0) / N;
  const NS = []; for (let s = 1; s <= 20; s++) NS.push(playEskadrilya(E, s, { noSmoke: true }));
  const pa = BAL.slice(0, 20).reduce((s, r) => s + r.passed, 0) / 20, pn = NS.reduce((s, r) => s + r.passed, 0) / 20;
  console.log('     срывов/партию ' + br.toFixed(1) + ', закопчено ' + so.toFixed(1) + '; перелётов: с дымом ' + pa.toFixed(2) + ', без дыма ' + pn.toFixed(2));
  ok(br > 10, 'мало срывов'); ok(pa > pn + 0.8, 'дым не помогает');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

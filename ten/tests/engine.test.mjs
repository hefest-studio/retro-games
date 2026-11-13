/* ТЕНЬ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node ten/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const calls = { n: 0 };
const fakeCtx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.n++; }, set: (o, k, v) => { o[k] = v; return true; } });
const sandbox = { console, Math, document: { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/story.js', 'js/levels.js', 'js/game.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const TEN = sandbox.TEN, L = TEN.logic, LVL = TEN.levels, K = L.K, T = L.T, C = L.C, dt = 1 / 60;
const { navFor, playTen, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// синтетическая карта: строки — '#' твердь, '=' мосток, '^' шипы, 'o' кольцо, '.' пусто
function mapLV(rows){
  const h = rows.length, w = rows[0].length, t = new Uint8Array(w * h), rings = [];
  rows.forEach((s, r) => [...s].forEach((ch, c) => { t[r * w + c] = ch === '#' ? C.S : ch === '=' ? C.P : ch === '^' ? C.X : C.E; if (ch === 'o') rings.push({ id: 'r' + rings.length, x: c * T + 8, y: r * T + 8 }); }));
  return { w, h, t, rings, enemies: [], lamps: [], lights: [], deco: [] };
}
function sim(LV, P, frames, inp){ for (let i = 0; i < frames; i++) L.heroStep(LV, P, typeof inp === 'function' ? inp(i, P) : inp, dt); return P; }
function mk(opts = {}){
  const ev = [];
  const game = TEN.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state(); if (!opts.keepFoes) S.enemies = [];
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(dt); } }

// ---------- структура ----------
test('6 актов × 3 сцены + арена босса: в каждой сцене есть колодец для прыжков от стены и пропасть с кольцами', () => {
  eq(LVL.ACTS, 6); eq(LVL.SCENES, 3);
  const bosses = new Set();
  for (let a = 1; a <= 6; a++){
    for (let s = 1; s <= 3; s++){
      const lv = LVL.build(a, s);
      ok(lv.exit && lv.exit.x > lv.w * T - 200, `${a}-${s}: выход в конце`);
      ok((lv.counts.chimney || 0) + (lv.counts.chasm || 0) >= 1, `${a}-${s}: колодец`);
      ok(lv.rings.length >= 1, `${a}-${s}: кольца`); ok(lv.time >= 120, `${a}-${s}: таймер`);
      ok(lv.w * T >= 2800, `${a}-${s}: длина ${lv.w * T}`);
      if (a > 1 || s > 1) ok(lv.lights.length >= 1 && lv.enemies.some(e => e.k === 'guard'), `${a}-${s}: страж с прожектором`);
    }
    const ar = LVL.build(a, 4); ok(ar.arena && !ar.exit, 'арена'); bosses.add(ar.arena.boss);
  }
  eq(bosses.size, 6, 'у каждого акта свой босс');
  ok(LVL.build(3, 1).counts.chasm >= 1, 'с 3-го акта — колодцы над пропастью');
});
test('генерация детерминирована', () => {
  for (const [a, s] of [[1, 1], [4, 2], [6, 3]]){ const A = LVL.build(a, s), B = LVL.build(a, s); eq(Buffer.from(A.t).toString('base64'), Buffer.from(B.t).toString('base64')); eq(JSON.stringify(A.rings), JSON.stringify(B.rings)); }
});
test('сложность растёт: врагов и препятствий в 6-м акте больше, чем в 1-м', () => {
  const n = a => [1, 2, 3].reduce((x, s) => x + LVL.build(a, s).enemies.length, 0);
  ok(n(6) > n(1) * 1.8, n(1) + ' → ' + n(6));
  ok(LVL.build(6, 1).counts.spikes >= 1 && !LVL.build(1, 1).counts.spikes, 'шипы — позже');
});

// ---------- физика ----------
const FLAT = mapLV(['#..................................#', '#..................................#', '#..................................#', '#..................................#', '#..................................#', '#..................................#', '#..................................#', '####################################', '####################################']);
test('бег 150 px/с, прыжок ≈ 4 клетки (переменная высота: короткое нажатие — ниже)', () => {
  const P = L.newHero(48, 7 * T); sim(FLAT, P, 40, { dx: 1 }); ok(Math.abs(P.vx - K.RUN) < 1, 'скорость ' + P.vx);
  const Q = L.newHero(200, 7 * T); let top = Q.y; sim(FLAT, Q, 60, (i, P) => { top = Math.min(top, P.y); return { jump: true, jumpP: i === 0 }; });
  const h = 7 * T - top; ok(h > 60 && h < 80, 'высота ' + h);
  const R = L.newHero(200, 7 * T); let top2 = R.y; sim(FLAT, R, 60, (i, P) => { top2 = Math.min(top2, P.y); return { jump: i < 4, jumpP: i === 0 }; });
  ok(7 * T - top2 < h - 20, 'короткий прыжок ' + (7 * T - top2));
});
const SHAFT = mapLV([
  '#############',
  '#...........#',
  '#...........#',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '###......####',
  '#############']);
test('цепляние за стену в полёте и цепочка прыжков от стены к стене поднимает на 12 клеток', () => {
  const P = L.newHero(5 * T, 15 * T); let clings = 0, wjs = 0, top = P.y;
  sim(SHAFT, P, 400, (i, P) => { top = Math.min(top, P.y); if (P.cling){ const I = { jumpP: P.t > (P._ct || 0) + 0.15, jump: true }; if (!P._was){ clings++; P._ct = P.t; } P._was = true; if (I.jumpP){ wjs++; P._was = false; } return I; } return { dx: P.ground ? 1 : (P.vx === 0 ? 1 : Math.sign(P.vx)), jumpP: P.ground && i < 5, jump: true }; });
  ok(clings >= 4 && wjs >= 4, 'цеплялась ' + clings + ', прыжков от стены ' + wjs);
  ok(top < 4 * T, 'поднялась до y=' + top);
});
test('висит без скольжения; ↓ — скольжение вниз; от стены — отпускание с задержкой', () => {
  const P = L.newHero(3 * T + K.HW + 0.5, 10 * T); P.ground = false; P.cling = -1;
  sim(SHAFT, P, 30, {}); eq(P.cling, -1); eq(P.y, 10 * T, 'держится');
  sim(SHAFT, P, 10, { dy: 1 }); ok(P.y > 10 * T + 15, 'скользит ' + P.y);
  sim(SHAFT, P, 5, { dx: 1 }); eq(P.cling, -1, 'не отпустила сразу'); sim(SHAFT, P, 12, { dx: 1 }); eq(P.cling, 0, 'отпустила');
});
test('подтягивание на край: у верха стены ↑ — встаёт на уступ', () => {
  const LV = mapLV(['#........#', '#........#', '#........#', '#....#####', '#....#####', '#....#####', '#....#####', '##########']);
  const P = L.newHero(5 * T - K.HW, 3 * T + 30); P.ground = false; P.cling = 1;
  ok(L.mantleSpot(LV, P), 'есть край'); sim(LV, P, 20, { dy: -1 });
  ok(P.ground && Math.abs(P.y - 3 * T) < 0.5 && P.x > 5 * T, 'на уступе ' + P.x + ',' + P.y);
  const Q = L.newHero(5 * T - K.HW, 7 * T - 2); Q.ground = false; Q.cling = 1; ok(!L.mantleSpot(LV, Q), 'снизу не дотянуться');
});
const PIT = mapLV([
  '#.......................................#',
  '#.......................................#',
  '#.......................................#',
  '#....................o..................#',
  '#.......................................#',
  '#.......................................#',
  '#.......................................#',
  '#.......................................#',
  '#.......................................#',
  '#.......................................#',
  '############.................############',
  '############.................############']);
test('крюк-трос: зацеп за кольцо, раскачка и бросок переносят через пропасть в 17 клеток; без крюка — падение', () => {
  const go = (hook) => { const P = L.newHero(4 * T, 10 * T); sim(PIT, P, 260, (i) => ({ dx: 1, jumpP: i === 48 || (hook && i === 114), jump: i < 64 || (hook && i > 114 && i < 130), hookP: hook && i === 68 })); return P; };
  const A = go(true); ok(!A.fell && A.ground && A.x > 29 * T, 'перелетела: x=' + Math.round(A.x / T) + ' fell=' + A.fell);
  const B = go(false); ok(B.fell || B.y > 11 * T, 'без крюка — вниз');
  const P = L.newHero(18 * T, 10 * T); P.ground = false; P.y = 7 * T; const r = L.findRing(PIT, P); ok(r, 'кольцо в радиусе');
  const Q = L.newHero(4 * T, 10 * T); ok(!L.findRing(PIT, Q), 'далеко — не достать');
});
test('трос: ↑ — короче, ↓ — длиннее', () => {
  const P = L.newHero(20 * T, 8 * T); P.ground = false; L.heroStep(PIT, P, { hookP: true }, dt); ok(P.hook, 'зацеп'); const l0 = P.hook.L;
  sim(PIT, P, 20, { dy: -1 }); ok(P.hook.L < l0 - 20, 'короче'); sim(PIT, P, 40, { dy: 1 }); ok(P.hook.L > l0, 'длиннее');
});
test('подкат: ↓ на бегу — проезжает лаз высотой в клетку; стоя — не пройти', () => {
  const LV = mapLV(['#..............#', '#..............#', '#..............#', '#.....######...#', '#.....######...#', '#..............#', '################']);
  const A = L.newHero(2 * T, 6 * T); sim(LV, A, 120, (i) => ({ dx: 1, dy: i > 20 ? 1 : 0 })); ok(A.x > 12 * T, 'проползла x=' + A.x);
  const B = L.newHero(2 * T, 6 * T); sim(LV, B, 120, { dx: 1 }); ok(B.x < 6 * T, 'упёрлась x=' + B.x);
});
test('мостки: прыжок снизу сквозь, стоит сверху; ↓ + прыжок — спрыгнуть', () => {
  const LV = mapLV(['#......#', '#......#', '#......#', '#..==..#', '#......#', '#......#', '########']);
  const P = L.newHero(3.5 * T, 6 * T); sim(LV, P, 60, (i) => ({ jumpP: i === 0, jump: true }));
  ok(P.ground && Math.abs(P.y - 3 * T) < 0.5, 'на мостке ' + P.y);
  sim(LV, P, 40, (i) => ({ dy: 1, jumpP: i === 2, jump: false })); ok(Math.abs(P.y - 6 * T) < 0.5, 'спрыгнула ' + P.y);
});
test('нет проваливания: на любом шаге не застревает в тверди (1000 случайных секунд ввода)', () => {
  const rnd = mulberry32(5), LV = L.getLV(2, 2);
  const P = L.newHero(LV.start.x, LV.start.y);
  let inp = {};
  for (let i = 0; i < 6000; i++){
    if (i % 12 === 0) inp = { dx: Math.floor(rnd() * 3) - 1, dy: rnd() < 0.15 ? 1 : rnd() < 0.1 ? -1 : 0, jump: rnd() < 0.6, jumpP: rnd() < 0.3, hookP: rnd() < 0.05 };
    else inp = Object.assign({}, inp, { jumpP: false, hookP: false });
    L.heroStep(LV, P, inp, dt);
    if (P.fell){ const Q = L.newHero(LV.start.x, LV.start.y); Object.assign(P, Q); continue; }
    ok(!P.mantle ? !L.boxHits(LV, P.x - K.HW + 0.5, P.y - L.heroH(P) + 0.5, P.x + K.HW - 0.5, P.y - 0.5) : true, 'в стене на шаге ' + i + ' ' + P.x + ',' + P.y);
  }
});

// ---------- правила партии ----------
test('шипы ранят и подбрасывают; пропасть и таймер — минус жизнь, сцена с начала', () => {
  const { game, S, has } = mk({ act: 5, scene: 1 });
  const sx = S.LV.t.findIndex(v => v === C.X); ok(sx >= 0, 'шипы есть');
  const c = sx % S.LV.w, r = Math.floor(sx / S.LV.w); game._place(c * T + 8, r * T + T); S.hero.ground = true;
  run(game, 0.1); ok(has('hurt') && S.hp < K.HP, 'ранена');
  const g2 = mk(); g2.S.hero.y = g2.S.LV.h * T + 100; g2.S.hero.fell = true; run(g2.game, 0.05); ok(g2.has('die')); run(g2.game, 2); eq(g2.S.lives, K.LIVES - 1); eq(g2.S.hero.x, g2.S.LV.start.x, 'с начала сцены');
  const g3 = mk(); g3.S.time = 0.02; run(g3.game, 0.1); ok(g3.ev.some(e => e.t === 'die' && e.d.why === 'time'), 'время вышло');
});
test('удар серпом: короткий, бьёт впереди; убитый враг возрождается только за экраном и не раньше 6 с', () => {
  const { game, S, has } = mk({ keepFoes: true });
  S.enemies = S.enemies.slice(0, 1); const e = S.enemies[0]; e.k = 'walker'; e.hp = 1; e.x = S.hero.x + 24; e.y = S.hero.y; e.sx = e.x; e.x0 = e.x - 40; e.x1 = e.x + 40; e.face = 1;
  S.hero.face = 1; game.press('strike'); run(game, 0.05); ok(e.dead && has('kill'), 'убит');
  run(game, 7); ok(e.dead, 'на экране — не возрождается');
  game._place(e.sx + 500, S.LV.start.y); S.hero.y = L.floorY(S.LV, S.hero.x, 0, S.LV.h * T) || S.hero.y; run(game, 0.1);
  ok(!e.dead && e.respawned, 'ушла с экрана — возродился');
  const g2 = mk({ keepFoes: true }); const e2 = g2.S.enemies[0]; e2.k = 'walker'; e2.x = g2.S.hero.x - 24; e2.y = g2.S.hero.y; g2.S.hero.face = 1; g2.game.press('strike'); run(g2.game, 0.05); ok(!e2.dead || e2.hp < 1 === false, 'сзади не бьёт');
});
test('прожектор стража: попала в луч — тревога (враги быстрее, подкрепление-дрон); дымовая шашка — невидимость 3 с', () => {
  const { game, S, has } = mk({ act: 1, scene: 2, keepFoes: true });
  const gd = S.enemies.find(e => e.k === 'guard'); ok(gd, 'страж');
  S.enemies = [gd]; gd.face = 1; gd.t = 0; game._place(gd.x + 70, gd.y); S.hero.ground = true;
  let n = 0; while (!has('alarm') && n++ < 240) run(game, 1 / 60);
  ok(has('alarm') && S.alarm > 0, 'тревога'); ok(S.enemies.some(e => e.k === 'drone' && e.extra), 'подкрепление');
  const g2 = mk({ act: 1, scene: 2, keepFoes: true }); const gd2 = g2.S.enemies.find(e => e.k === 'guard'); g2.S.enemies = [gd2]; gd2.face = 1;
  g2.S.special = 'smoke'; g2.S.charge = 20; g2.game.press('special'); run(g2.game, 0.05); ok(g2.S.smoke > 2.5, 'дым');
  g2.game._place(gd2.x + 70, gd2.y); run(g2.game, 2); ok(!g2.has('alarm'), 'в дыму не видят'); ok(!g2.has('hurt'), 'и не ранят');
  run(g2.game, 2); ok(g2.S.smoke === 0, 'дым рассеялся за 3 с');
});
test('приёмы тратят заряд: звезда летит и убивает, вихрь и огненная полоса бьют по 2; без заряда — ничего', () => {
  for (const [k, cost] of [['star', 3], ['whirl', 8], ['fire', 10], ['smoke', 10]]) eq(L.SPECIAL[k].cost, cost);
  const { game, S, has } = mk({ keepFoes: true }); S.enemies = S.enemies.slice(0, 1); const e = S.enemies[0];
  e.k = 'shooter'; e.hp = 2; e.x = S.hero.x + 150; e.y = S.hero.y; e.cd = 9;
  S.charge = 10; S.hero.face = 1; game.press('special'); run(game, 0.05); eq(S.charge, 7); run(game, 0.5); eq(e.hp, 1, 'звезда попала');
  game.setInput(0, -1, false); game.press('strike'); run(game, 0.02, 0, -1); eq(S.charge, 4, '↑ + серп = приём');
  S.special = 'whirl'; S.charge = 2; game.press('special'); run(game, 0.05); ok(has('noCharge') && S.whirl <= 0, 'мало заряда');
  const g2 = mk({ keepFoes: true }); const f = g2.S.enemies[0]; f.k = 'guard'; f.hp = 3; f.x = g2.S.hero.x + 60; f.y = g2.S.hero.y; f.x0 = f.x; f.x1 = f.x;
  g2.S.special = 'fire'; g2.S.charge = 30; g2.S.hero.face = 1; g2.game.press('special'); run(g2.game, 0.4); ok(f.hp <= 1, 'огонь: ' + f.hp);
});
test('фонари разбиваются серпом и роняют предметы; свиток приёма меняет приём', () => {
  const { game, S, has } = mk(); const l = S.lamps[0]; ok(l, 'фонарь'); l.item = 'sp:fire';
  game._place(l.x - 20, l.y + 30); S.hero.y = L.floorY(S.LV, S.hero.x, l.y, S.LV.h * T); S.hero.ground = true; S.hero.face = 1;
  game.press('strike'); run(game, 0.05); ok(l.broken && has('lamp'), 'разбит');
  run(game, 1.5, 1); ok(S.special === 'fire' || S.pickups.length === 1, 'подобран/лежит');
  if (S.special !== 'fire'){ const p = S.pickups[0]; game._place(p.x, p.y); S.hero.y = p.y + 1; run(game, 0.1); }
  eq(S.special, 'fire');
});
test('боссы: у каждого свой паттерн, урон только после представления, победа → кат-сцена → следующий акт; финал → победа', () => {
  for (let a = 1; a <= 6; a++){
    const { game, S, has, ev } = mk({ act: a, scene: 4 });
    ok(S.boss && S.boss.k === LVL.BOSSES[a - 1]); ok(!game._hitBoss(1), 'во время представления неуязвим');
    run(game, 2); ok(has('boss'), 'представлен');
    S.inv = 99; const x0 = S.boss.x, y0 = S.boss.y, c0 = S.boss.clawY; run(game, 3); S.inv = 0;
    ok(Math.abs(S.boss.x - x0) > 4 || Math.abs(S.boss.y - y0) > 4 || S.boss.clawY !== c0 || S.eshots.length || a === 5, 'босс ' + a + ' двигается/атакует');
    let n = 0; while (!S.boss.dead && n++ < 100){ S.boss.inv = 0; game._hitBoss(1); }
    ok(S.boss.dead && has('bossDown'), 'повержен');
    run(game, 5);
    if (a < 6){ ok(ev.some(e => e.t === 'cut' && e.d.after === a) && S.phase === 'cut', 'кат-сцена'); game.nextAct(); eq(S.act, a + 1); eq(S.scene, 1); }
    else ok(S.won && has('win'), 'победа');
  }
});
test('конец игры и продолжение: с начала той же сцены, жизни заново, счёт сброшен', () => {
  const { game, S, has } = mk({ act: 2, scene: 2 }); S.score = 5000;
  for (let i = 0; i < K.LIVES; i++){ game._die('pit'); run(game, 2); }
  ok(S.over && has('gameover'));
  game.continueGame(); ok(!S.over && S.phase === 'play'); eq(S.lives, K.LIVES); eq(S.score, 0); eq(S.act + '-' + S.scene, '2-2'); eq(S.continues, 1);
});
test('выход сцены: бонус за оставшееся время, переход к следующей сцене, после 3-й — арена', () => {
  const { game, S, has } = mk(); S.time = 50.2; game._place(S.LV.exit.x, S.LV.exit.y); run(game, 0.05);
  ok(has('clear')); eq(S.score, 510); run(game, 3); eq(S.scene, 2);
  S.scene = 3; game._go(1, 3); game._place(S.LV.exit.x, S.LV.exit.y); run(game, 3); eq(S.scene, 4); ok(S.boss);
});

// ---------- проходимость (граф по настоящей физике) ----------
const NAV = {};
test('проходимость: каждая из 18 сцен проходима от старта до выхода (стены, подтягивание, крюк, подкаты)', () => {
  const t0 = Date.now();
  for (let a = 1; a <= 6; a++) for (let s = 1; s <= 3; s++){
    const LV = L.getLV(a, s), nav = navFor(TEN, LV); NAV[a + '-' + s] = nav;
    ok(nav.goal, `${a}-${s}: выход недостижим, дальше всего x=${Math.round(nav.maxX / T)} из ${LV.w}`);
  }
  console.log('     граф 18 сцен: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
});
test('путь по графу в сцене 1-1 требует прыжков от стены и крюка; без колец сцена непроходима', () => {
  const nav = NAV['1-1'], p = nav.path(nav.start); ok(p, 'путь');
  ok(p.some(e => e.kind === 'sim' && e.m.kind === 'wj'), 'прыжок от стены'); ok(p.some(e => e.kind === 'sim' && e.m.hook), 'крюк');
  const LV = Object.assign({}, L.getLV(1, 1), { rings: [] }); ok(!navFor(TEN, LV).goal, 'без колец — не пройти');
});

// ---------- рендер, тексты, музыка, имена ----------
test('рендер: все сцены и арены в обеих темах, кат-сцены, титульные примитивы — без исключений', () => {
  const g = { themeName: 'modern', th: () => ({ ink: '#fff', muted: '#888', accent: '#6fd38c', bad: '#f66' }), t: k => TEN.STR.ru[k] || k, i18n: { lang: 'ru' }, text(){} };
  const before = calls.n;
  for (const th of ['modern', 'retro']){ g.themeName = th;
    for (let a = 1; a <= 6; a++) for (let s = 1; s <= 4; s++){
      const { S } = mk({ act: a, scene: s, keepFoes: true }); S.alarm = 1; S.whirl = 0.5; S.smoke = 1; S.atkT = 0.1;
      S.shots.push({ x: S.hero.x + 20, y: S.hero.y - 14, rot: 0 }); S.eshots.push({ k: 'bolt', x: S.hero.x + 40, y: S.hero.y - 14, r: 3 }, { k: 'wave', x: S.hero.x, y: S.hero.y, r: 7 }, { k: 'gear', x: 0, y: 0, r: 6 }, { k: 'harpoon', x: 0, y: 0, r: 4 }, { k: 'bomb', x: 0, y: 0, r: 5 });
      S.pickups.push({ x: S.hero.x, y: S.hero.y, item: 'sp:whirl', t: 5 }, { x: S.hero.x, y: S.hero.y, item: 'hp', t: 5 });
      if (S.boss) S.boss.state = 'move';
      const cam = {}; TEN.R.camera(cam, S, dt, true);
      TEN.render(g, fakeCtx(), S, { cam, toasts: [{ text: 'x', color: '#fff', x: 0, y: 0, t: 1, life: 1 }], banner: { title: 'a', sub: 'b', a: 1, dur: 2, lines: ['c'] }, tip: { text: 'd', a: 1 } });
      for (const st of ['idle', 'run', 'air', 'cling', 'slide', 'crouch', 'swing', 'pull']) TEN.R.hero(fakeCtx(), 0, 0, { state: st, rt: th === 'retro', atk: 0.5 });
    }
    TEN.STORY.forEach(list => list.forEach(p => TEN.R.art(fakeCtx(), p.art, 560, 236, 1, th === 'retro')));
  }
  ok(calls.n - before > 10000, 'рисование было: ' + (calls.n - before));
});
test('кат-сцены: вступление, 5 межактовых, финал; у каждой панели текст RU и EN', () => {
  eq(TEN.STORY.length, 7);
  TEN.STORY.forEach((list, i) => { ok(list.length >= 2, 'панелей ' + i); list.forEach(p => ok(p.art && p.ru && p.en && p.ru !== p.en, 'панель ' + i)); });
});
test('i18n: у RU и EN одинаковые ключи; есть названия актов, боссов и приёмов', () => {
  const ru = Object.keys(TEN.STR.ru).sort(), en = Object.keys(TEN.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let a = 1; a <= 6; a++) ok(TEN.STR.ru['a' + a] && TEN.STR.en['a' + a]);
  LVL.BOSSES.forEach(b => ok(TEN.STR.ru['b_' + b] && TEN.STR.en['b_' + b], b));
  Object.keys(L.SPECIAL).forEach(k => ok(TEN.STR.ru['sp_' + k] && TEN.STR.en['sp_' + k], k));
});
test('музыка: оригинальный трек ten подключается по gameId', () => {
  const Tr = sandbox.Arcade.tracks.ten; ok(Tr && Tr.bpm > 0 && Tr.melody && Tr.bass && Tr.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(Tr.melody) % 8, 0); eq(n(Tr.bass) % 8, 0);
});
test('рекорд: ключ localStorage — только arcade.best.ten (своё имя, миграция не нужна)', () => {
  const src = ['js/main.js', 'js/game.js', 'js/render.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ok(/gameId: 'ten'/.test(src)); ok(!/localStorage\.setItem/.test(src), 'игра сама в localStorage не пишет');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifG5pbmphID9nYWlkZW580L3QuNC90LTQt9GPID/Qs9Cw0LnQtNC10L18Z2FpZGVufNCz0LDQudC00LXQvXxyeXVrZW5kZW580YDRjtC60Y3QvdC00Y3QvXzRgNGO0LrQtdC90LTRjdC9fHNoYWRvdyA/b2YgP3RoZSA/bmluamF80YLQtdC90Lg/INC90LjQvdC00LfRj3xibHVlID9zaGFkb3d8aGF5YWJ1c2F80YXQsNGP0LHRg9GB0LB80YXQsNGP0LHRg2PQsHxcYnJ5dVxifCg/PCFb0LAt0Y/RkV0p0YDRjig/IVvQsC3Rj9GRXSl8c2hpbm9iaXzRgdC40L3QvtCx0Lh80YjQuNC90L7QsdC4fGpvZSA/bXVzYXNoaXxtdXNhc2hpfNC80YPRgdCw0YHQuHxoYXlhdGV80YXQsNGP0YLRjXzRhdCw0Y/RgtC1fGthZWRlfNC60LDRjdC00Y180LrQsNGN0LTQtXxuYXRzdW1lfNC90LDRhtGD0LzRjXzQvdCw0YbRg9C80LV8amFxdWlvfNC20LDQutC40L4=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Тень') && !BAD.test('SHADE') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('брюки') && !BAD.test('серп на тросе') && !BAD.test('Stronghold'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
const cache = {}; for (const k in NAV) cache[k] = NAV[k];
test('исполнимость: бот без урона проходит всю игру в настоящей физике (6 актов, 18 сцен, 6 боссов)', () => {
  const r = playTen(TEN, 1, { god: true, navCache: cache, untilAct: 6, maxT: 3000 });
  ok(r.won, 'дошёл до ' + r.act + '-' + r.scene + (r.stuckAt ? ' застрял: ' + r.stuckAt.slice(0, 120) : ''));
  console.log('     игровое время: ' + Math.round(r.time) + ' с, сцен: ' + r.scenes);
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибка момента ±35 мс, не замечает часть врагов, отвлекается.
// 20 партий (сиды 1..20) акта 1 (3 сцены + Бригадир, 3 жизни, без продолжений). Цель: акт 1 — часто (≥ 60%).
const N = 20, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playTen(TEN, s, { navCache: cache, untilAct: 1, maxT: 900 }));
test('баланс: «человеческий» бот проходит акт 1 часто (≥ 60% партий), без «зависаний»; враги при этом ранят', () => {
  const n = BAL.filter(r => r.act1).length, hurts = BAL.reduce((a, r) => a + r.hurts, 0) / N, deaths = BAL.reduce((a, r) => a + r.deaths, 0);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     акт 1 пройден: ' + n + '/' + N + '; ранений за партию: ' + hurts.toFixed(1) + '; гибелей: ' + deaths + ' ' + JSON.stringify(why) + '; тревог: ' + BAL.reduce((a, r) => a + r.alarms, 0));
  ok(n >= 0.6 * N, 'слишком сложно: ' + n + '/' + N);
  ok(hurts >= 2, 'враги не опасны: ' + hurts);
  ok(!BAL.some(r => r.stuck), 'бот застрял: сиды ' + BAL.filter(r => r.stuck).map(r => r.seed + ' ' + r.stuckAt).join('; '));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

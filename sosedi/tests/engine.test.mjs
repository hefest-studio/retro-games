/* СОСЕДИ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node sosedi/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// шим DOM для рендера: canvas с «пустым» 2D-контекстом (Proxy) — считаем вызовы рисования
const calls = { n: 0 };
const fakeCtx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.n++; }, set: (o, k, v) => { o[k] = v; return true; } });
const sandbox = { console, Math, setTimeout: () => 0, document: { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/audio.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const SO = sandbox.SOSEDI, L = SO.logic, LV = SO.levels, T = LV.T, K = L.K, TS = LV.TS, MW = LV.MW, MH = LV.MH, dt = 1 / 60;
const { playLevel, playGame, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function mk(level = 1, opts = {}){
  const ev = [];
  const game = SO.Game(Object.assign({ seed: 1, level, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  game._load(level);
  return { game, S: game.state(), M: game.level(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, last: t => [...ev].reverse().find(e => e.t === t) };
}
function run(game, sec, inp = {}, pi = 0){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(pi, inp); game.update(dt); } game.setInput(pi, {}); }
function quiet(S){ S.toys = []; S.spawners.forEach(s => { s.t = 1e9; }); if (S.boss) S.boss.dead = true; }
const cxy = t => t * TS + TS / 2;

// ---------- A* по клеткам с ключами и дверями ----------
// Состояние: (клетка, подобранные ключи — битовая маска, открытые двери — битовая маска). Ключ любой открывает любую дверь
// (одна дверь — один ключ). Трещины (C) — проходимы: их ломает фейерверк, запас которого есть на уровне.
function astar(M, from, goal){
  const keys = M.keys.map(k => k.y * MW + k.x), doors = M.doors.map(d => d.y * MW + d.x);
  const pc = m => { let n = 0; while (m){ n += m & 1; m >>= 1; } return n; };
  const h = k => Math.abs(k % MW - goal.x) + Math.abs(((k / MW) | 0) - goal.y);
  const start = { k: from.y * MW + from.x, km: 0, dm: 0, g: 0 };
  const ki = start.k; const k0 = keys.indexOf(ki); if (k0 >= 0) start.km |= 1 << k0;
  const open = [start], seen = new Set();
  while (open.length){
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].g + h(open[i].k) < open[bi].g + h(open[bi].k)) bi = i;
    const cur = open.splice(bi, 1)[0], id = cur.k + ':' + cur.km + ':' + cur.dm;
    if (seen.has(id)) continue; seen.add(id);
    if (cur.k === goal.y * MW + goal.x) return cur.g;
    const x = cur.k % MW, y = (cur.k / MW) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const nk = ny * MW + nx, c = M.t[nk]; let km = cur.km, dm = cur.dm;
      if (c === T.D){ const di = doors.indexOf(nk); if (!(dm & (1 << di))){ if (pc(km) <= pc(dm)) continue; dm |= 1 << di; } }
      else if (!LV.WALK[c] && c !== T.C) continue;
      const kk = keys.indexOf(nk); if (kk >= 0) km |= 1 << kk;
      open.push({ k: nk, km, dm, g: cur.g + 1 });
    }
  }
  return -1;
}

// ---------- структура ----------
test('20 уровней = 5 районов × 4; 4-й в районе — босс; стили и боссы разные', () => {
  eq(LV.COUNT, 20);
  const styles = new Set(), bosses = [];
  for (let n = 1; n <= 20; n++){ const M = LV.build(n); styles.add(M.style); eq(M.d, Math.ceil(n / 4)); if (n % 4 === 0){ eq(M.kind, 'boss'); bosses.push(M.boss); } else eq(M.kind, 'normal'); }
  eq(styles.size, 5); eq(bosses.join(','), 'bear,stilts,organ,strong,puppeteer');
});
test('карты фиксированы: повторная сборка даёт те же клетки', () => {
  for (let n = 1; n <= 20; n++) eq(Array.from(LV.build(n).t).join(''), Array.from(LV.build(n).t).join(''), 'уровень ' + n);
});
test('у каждого уровня: соседи 4–10, ключей столько же, сколько запертых дверей; тайные комнаты с трещиной на чётных', () => {
  for (let n = 1; n <= 20; n++){
    const M = LV.build(n), reg = M.neighbors.filter(q => !q.bonus);
    ok(reg.length >= 4 && reg.length <= 10, 'уровень ' + n + ': соседей ' + reg.length);
    eq(M.keys.length, M.doors.length, 'уровень ' + n + ' ключи/двери');
    for (const d of M.doors) eq(M.t[d.y * MW + d.x], T.D);
    if (n % 2 === 0 && M.kind === 'normal'){ ok(M.secret, 'нет тайной комнаты на ' + n); eq(M.t[M.secret.crack.y * MW + M.secret.crack.x], T.C); ok(M.pickups.some(p => p.kind === 'ticket') && M.pickups.some(p => p.kind === 'fire')); }
  }
  ok(LV.build(3).doors.length >= 1 && LV.build(19).doors.length >= 3, 'двери есть и их больше к концу');
});
test('достижимость (A* с ключами и дверями): все соседи, ключи и выход на всех 20 уровнях и 5 бонус-уровнях', () => {
  for (let n = 1; n <= 25; n++){
    const M = n <= 20 ? LV.build(n) : LV.buildBonus(n - 20), s = M.start;
    for (const nb of M.neighbors){ const g = astar(M, s, nb); ok(g > 0, 'уровень ' + n + ': сосед ' + nb.x + ',' + nb.y + ' недостижим'); }
    for (const k of M.keys) ok(astar(M, s, k) > 0, 'уровень ' + n + ': ключ недостижим');
    if (M.exit) ok(astar(M, s, M.exit) > 0, 'уровень ' + n + ': выход недостижим');
    for (const p of M.pickups) ok(astar(M, s, p) > 0, 'уровень ' + n + ': подарок ' + p.kind + ' недостижим');
  }
});
test('A* честен: без ключа запертый дом не пройти, а у ключей — снаружи, без дверей', () => {
  const M = LV.build(3), b = M.houses.find(h => h.locked), inside = { x: b.x + 2, y: b.y + 2 };
  const M2 = Object.assign({}, M, { keys: [] }); ok(astar(M2, M.start, inside) < 0, 'прошёл в запертый дом без ключа');
  ok(astar(M, M.start, inside) > 0);
  const d = LV.bfs(M.t, M.start.x, M.start.y, null); for (const k of M.keys) ok(d[k.y * MW + k.x] >= 0, 'ключ за дверью');
});

// ---------- герой и оружие ----------
test('ход, стена держит, взгляд — по направлению движения', () => {
  const { game, S, M } = mk(1); quiet(S); const h = S.heroes[0]; const x0 = h.x;
  run(game, 0.5, { x: 1, y: 0 }); ok(h.x > x0 + 30, 'ушёл вправо'); eq(h.fx, 1);
  run(game, 12, { x: 0, y: -1 }); ok(h.y >= TS + K.HERO_R - 0.01, 'не прошёл сквозь забор: ' + h.y);
});
test('водяной пистолет — бесконечный; остальное тратит запас и при нуле возвращает воду', () => {
  const { game, S } = mk(1); quiet(S); const h = S.heroes[0];
  run(game, 1, { fire: true }); ok(S.shots.length > 0 || h.cd > 0); eq(h.ammo.water, -1);
  game.select(0, 4); eq(L.WEAP[h.w], 'fire'); const f0 = h.ammo.fire;
  for (let i = 0; i < 10; i++) run(game, 0.9, { fire: true });
  eq(h.ammo.fire, 0); ok(f0 >= 1); eq(h.w, 0, 'вернулась вода');
  game.swap(0, 1); ok(L.WEAP[h.w] !== 'fire', 'пустое оружие пропускается');
});
test('вода: 3 попадания — клоун разобран, очки начислены', () => {
  const { game, S, has } = mk(1); quiet(S); const h = S.heroes[0];
  const o = game._spawnToy('clown', h.x + 50, h.y); o.stun = 99; h.fx = 1; h.fy = 0; const sc = S.score;
  run(game, 1.2, { fire: true }); ok(has('kill'), 'не убит'); ok(S.score >= sc + L.TY.clown.pts);
});
test('пузыри ловят мелких (гусь) сразу, крупного (медведь) — оглушают', () => {
  const { game, S, last } = mk(1); quiet(S); const h = S.heroes[0]; h.fx = 1; h.fy = 0; game.select(0, 3);
  const gs = game._spawnToy('goose', h.x + 40, h.y); gs.stun = 99;
  run(game, 0.6, { fire: true }); ok(last('kill') && last('kill').d.how === 'bubble', 'гусь не пойман');
  const b = game._spawnToy('bear', h.x + 40, h.y); b.stun = 0; b.cd = 99;
  run(game, 0.5, { fire: true }); ok(b.stun > 1 && !b.dead, 'медведь не оглушён');
});
test('краска — по дуге через прилавки, брызги задевают нескольких', () => {
  const { game, S, count } = mk(1); quiet(S); const h = S.heroes[0];
  const a = game._spawnToy('goose', h.x + 104, h.y + 6), b = game._spawnToy('goose', h.x + 100, h.y - 8); a.stun = b.stun = 99;
  game._landArc({ k: 'paint', tx: h.x + 104, ty: h.y, pi: 0 }); eq(count('kill'), 2);
});
test('пирожок-приманка: игрушки бегут к нему и едят, а не к соседу', () => {
  const { game, S } = mk(1); quiet(S); const nb = S.neighbors[0], h = S.heroes[0]; h.x = nb.x + 200 > MW * TS ? nb.x - 200 : nb.x + 200;
  const o = game._spawnToy('clown', nb.x + 60, nb.y); game._landArc({ k: 'pie', tx: nb.x + 100, ty: nb.y, pi: 0 });
  run(game, 3); eq(nb.state, 'wait', 'сосед уцелел'); ok(o.eat > 0.5, 'игрушка ест пирожок');
});
test('фейерверк рассеивает толпу и ломает трещину — открывается тайная комната с бонус-соседом', () => {
  const { game, S, M, has } = mk(2); quiet(S); const cr = M.secret.crack;
  const sec = S.neighbors.find(q => q.secret); ok(sec && sec.bonus);
  const ts = [0, 1, 2].map(i => game._spawnToy('clown', cxy(cr.x) + (i - 1) * 12, cxy(cr.y) + 30)); ts.forEach(o => { o.stun = 99; });
  game._landArc({ k: 'fire', tx: cxy(cr.x), ty: cxy(cr.y) + 20, pi: 0 });
  ok(has('crack'), 'трещина цела'); ok(M.t[cr.y * MW + cr.x] === T.O); ok(ts.every(o => o.hp < o.max), 'толпу не задело');
  ok(astar(M, M.start, { x: Math.floor(sec.x / TS), y: Math.floor(sec.y / TS) }) > 0);
});

// ---------- соседи как ресурс ----------
test('спасение: подошёл — сосед спасён, очки; спасённые сохраняются в запасе', () => {
  const { game, S, has } = mk(1); quiet(S); const nb = S.neighbors.find(q => !q.inside), h = S.heroes[0]; const p0 = S.pool;
  h.x = nb.x - 20; h.y = nb.y; run(game, 0.5, { x: 1, y: 0 });
  eq(nb.state, 'saved'); ok(has('saved')); eq(S.pool, p0, 'спасённый остаётся в запасе'); eq(S.savedTotal, 1);
});
test('игрушка хватает соседа и тащит K.GRAB с; подстрелил — сосед остаётся', () => {
  const { game, S } = mk(1); quiet(S); const nb = S.neighbors.find(q => !q.inside); const h = S.heroes[0]; h.x = nb.x + 300 > MW * TS - 20 ? nb.x - 300 : nb.x + 300;
  const o = game._spawnToy('clown', nb.x + 6, nb.y); run(game, K.GRAB * 0.5); ok(nb.grab > 0 && nb.state === 'wait', 'не схватил');
  game._killToy(o, 'test', 0); run(game, 1); eq(nb.state, 'wait'); ok(!nb.grab, 'хват сброшен');
});
test('счётчик соседей: утащили — запас −1; на следующем уровне соседей не больше запаса; 0 — конец игры', () => {
  const { game, S, has, last } = mk(1); quiet(S); S.heroes[0].x = 30; S.heroes[0].y = 30;
  const p0 = S.pool, nb = S.neighbors.find(q => !q.inside); game._spawnToy('mouse', nb.x + 3, nb.y);
  run(game, K.GRAB + 0.6); eq(nb.state, 'lost'); eq(S.pool, p0 - 1); ok(has('lost'));
  S.pool = 3; game._load(2); eq(S.neighbors.filter(q => !q.bonus).length, 3, 'на уровне = запас');
  quiet(S); S.heroes[0].x = 30; S.heroes[0].y = 30;
  S.neighbors.filter(q => !q.bonus).forEach(q => game._spawnToy('mouse', q.x + 3, q.y));
  run(game, K.GRAB + 1); eq(S.pool, 0); eq(S.phase, 'over'); eq(last('gameover').d.why, 'pool');
});
test('выход открывается, когда не осталось ждущих (тайный бонус-сосед не обязателен) и повержен босс', () => {
  const { game, S, M, has } = mk(2); quiet(S);
  S.neighbors.forEach(q => { if (!q.secret) q.state = 'saved'; }); run(game, 0.1); ok(S.exitOpen, 'выход закрыт'); ok(has('exitOpen'));
  const h = S.heroes[0]; h.x = cxy(M.exit.x); h.y = cxy(M.exit.y); run(game, 0.1); eq(S.phase, 'clear');
  const b = mk(4); b.S.toys = []; b.S.neighbors.forEach(q => { q.state = 'saved'; }); run(b.game, 0.1); ok(!b.S.exitOpen, 'выход открыт при живом боссе');
  b.game._damageBoss(999, 'test'); run(b.game, 0.1); ok(b.S.exitOpen); ok(b.has('bossDie'));
});
test('уровень без потерь: +1 к запасу («новый сосед въехал»); золотой билет ведёт на бонус-уровень', () => {
  const { game, S, M, last } = mk(2); quiet(S); const p0 = S.pool;
  S.neighbors.forEach(q => { if (!q.secret){ q.state = 'saved'; S.levelSaved++; } });
  S.ticket = true; game._clear(); ok(last('clear').d.moved); eq(S.pool, p0 + 1);
  game._next(); ok(S.inBonus, 'не бонус'); eq(game.level().kind, 'bonus'); eq(S.level, 2);
  quiet(S); S.phase = 'play'; const nb = S.neighbors[0], h = S.heroes[0], pb = S.pool; h.x = nb.x - 16; h.y = nb.y;
  run(game, 0.4, { x: 1, y: 0 }); eq(S.pool, pb + 1, 'гость бонуса — +1 к соседям');
  S.bonusT = 0.01; run(game, 0.1); eq(S.phase, 'clear'); game._next(); eq(S.level, 3); ok(!S.inBonus);
});
test('ключ и дверь: без ключа «нужен ключ», с ключом — открыта, игрушки идут по полю к соседу в доме только после', () => {
  const { game, S, M, has } = mk(3); quiet(S); const b = M.houses.find(q => q.locked), d = b.door, h = S.heroes[0];
  const dir = d.x === b.x ? [-1, 0] : d.x === b.x + b.w - 1 ? [1, 0] : d.y === b.y ? [0, -1] : [0, 1];
  h.x = cxy(d.x + dir[0] * 2); h.y = cxy(d.y + dir[1] * 2);
  run(game, 1, { x: -dir[0], y: -dir[1] }); ok(has('nokey')); eq(M.t[d.y * MW + d.x], T.D);
  const inNb = S.neighbors.find(q => Math.floor(q.x / TS) > b.x && Math.floor(q.x / TS) < b.x + b.w - 1 && Math.floor(q.y / TS) > b.y && Math.floor(q.y / TS) < b.y + b.h - 1);
  const inK = (d.y - dir[1]) * MW + d.x - dir[0];
  eq(game.fields().p[inK], 9999, 'игрушкам в запертый дом пути нет');
  S.keys = 1; run(game, 1, { x: -dir[0], y: -dir[1] }); ok(has('door')); eq(M.t[d.y * MW + d.x], T.O); eq(S.keys, 0);
  game._computeFields(); ok(game.fields().p[inK] < 9999, 'после двери путь есть'); ok(inNb, 'в запертом доме сосед');
});
test('герой: 3 удара — минус жизнь и возрождение; без жизней — выбыл; оба выбыли — конец игры', () => {
  const { game, S, last } = mk(1, { players: 2 }); quiet(S); const [a, b] = S.heroes;
  for (let i = 0; i < 3; i++){ a.inv = 0; game._hurtHero(a, 'test'); } ok(!a.alive); eq(a.lives, K.LIVES - 1);
  run(game, 2); ok(a.alive && a.hp === K.HP && a.inv > 0, 'возродился');
  for (const h of [a, b]){ h.lives = 1; h.inv = 0; h.hp = 1; game._hurtHero(h, 'test'); }
  ok(a.out && b.out); eq(S.phase, 'over'); eq(last('gameover').d.why, 'lives');
});
test('зонтик-щит не пускает урон; кроссовки ускоряют; мешок-портал переносит к соседу в опасности', () => {
  const { game, S } = mk(1); quiet(S); const h = S.heroes[0];
  h.shieldT = 5; h.inv = 0; ok(!game._hurtHero(h, 't')); eq(h.hp, K.HP);
  const x0 = h.x; h.shoesT = 5; run(game, 0.5, { x: -1, y: 0 }); ok(x0 - h.x > K.SPEED * 0.5 + 10, 'скорость ' + (x0 - h.x));
  const nb = S.neighbors.find(q => !q.inside); game._spawnToy('clown', nb.x + 30, nb.y).stun = 99;
  ok(game._portal(h)); ok(Math.hypot(h.x - nb.x, h.y - nb.y) < 20, 'не рядом с соседом');
});

// ---------- кооп ----------
test('кооп: два героя, свои вводы и оружие; не расходятся дальше кадра', () => {
  const { game, S } = mk(1, { players: 2 }); quiet(S); const [a, b] = S.heroes;
  eq(S.heroes.length, 2); ok(a.x !== b.x);
  game.select(1, 3); eq(a.w, 0); eq(L.WEAP[b.w], 'bubble');
  for (let i = 0; i < 600; i++){ game.setInput(0, { x: -1, y: 0 }); game.setInput(1, { x: 1, y: 0 }); game.update(dt); }
  ok(Math.abs(a.x - b.x) <= K.VIEW_W - 60 + 3, 'разошлись: ' + Math.abs(a.x - b.x));
  const sc = S.score, nb = S.neighbors.find(q => !q.inside); b.x = nb.x - 16; b.y = nb.y; run(game, 0.4, { x: 1, y: 0 }, 1);
  eq(nb.state, 'saved'); ok(b.saved >= 1); ok(S.score > sc);
});
test('кооп: у босса больше здоровья на двоих', () => {
  const a = mk(4), b = mk(4, { players: 2 }); ok(b.S.boss.max > a.S.boss.max);
});
test('боссы: у каждого своя атака (волна, кегли, ноты, разбег, нити) и подмога', () => {
  const want = { 4: 'drum', 8: 'throw', 12: 'organ', 16: 'charge', 20: 'strings' };
  for (const n of [4, 8, 12, 16, 20]){
    const { game, S, has } = mk(n); S.toys = []; const h = S.heroes[0]; h.lives = 99;
    for (let i = 0; i < 60 * 12; i++){ h.hp = 3; h.x = S.boss.x + 80; h.y = S.boss.y; game.update(dt); }
    ok(has(want[n]), 'уровень ' + n + ': нет ' + want[n]); ok(has('spawn'), 'уровень ' + n + ': без подмоги');
  }
});

// ---------- прочее ----------
test('музыка: оригинальные треки sosedi, sosedi:boss, sosedi:bonus', () => {
  const A = sandbox.Arcade.tracks; for (const k of ['sosedi', 'sosedi:boss', 'sosedi:bonus']) ok(A[k] && A[k].bpm > 0 && A[k].melody && A[k].bass && A[k].drums, k);
});
test('i18n: у RU и EN одинаковые ключи; есть имена всех уровней, соседей, игрушек, боссов, районов', () => {
  const ru = Object.keys(SO.STR.ru).sort(), en = Object.keys(SO.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let n = 1; n <= 20; n++) ok(SO.STR.ru['l' + n] && SO.STR.en['l' + n]);
  LV.NTYPES.forEach(k => ok(SO.STR.ru['n_' + k], k)); Object.keys(L.TY).forEach(k => ok(SO.STR.ru['t_' + k], k));
  LV.BOSSES.forEach(k => ok(SO.STR.ru['b_' + k] && SO.STR.ru['bs_' + k], k)); LV.STYLES.forEach(k => ok(SO.STR.ru['d_' + k], k));
});
test('рендер: обе темы рисуют мир, HUD, всех персонажей и боссов без исключений', () => {
  const g = { t: k => SO.STR.ru[k] || k, th: () => ({ ink: '#fff', muted: '#aaa', accent: '#fa0' }), state: { best: 10 } };
  for (const rt of [false, true]){
    SO.R.setRetro(rt); SO.R.invalidate();
    for (const n of [2, 4, 8, 12, 16, 20, 7]){
      const { game, S, M } = mk(n, { players: 2 }); Object.keys(L.TY).forEach((k, i) => game._spawnToy(k, S.heroes[0].x + 20 * i, S.heroes[0].y + 30));
      run(game, 1); const c0 = calls.n; SO.R.world(fakeCtx(), S, M, { x: 0, y: 0 }, 1); SO.R.hud(g, fakeCtx(), S, M); ok(calls.n > c0 + 300, 'мало рисования: ' + (calls.n - c0));
    }
  }
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHpvbWJ80LfQvtC80LF8YXRlID9teSA/bmVpZ2hib3U/cnN8bHVjYXMgP2FydHN80LvRg9C60LDRgSA/0LDRgNGC0YF8XGJ6ZWtlXGJ8KD88IVvQsC3Rj9GRXSnQt9C40LooPyFb0LAt0Y/RkV0pfFxianVsaWVcYnwoPzwhW9CwLdGP0ZFdKdC00LbRg9C70LgoPyFb0LAt0Y/RkV0p', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('mole(force)') && !BAD.test('digStart') && !BAD.test('монитор') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест'), 'стоп-лист без ложных срабатываний на наши слова');
  ok(!BAD.test('музыка') && !BAD.test('Соседи') && !BAD.test('neighbours') && !BAD.test('Заводной Цирк') && !BAD.test('Тимоша'), 'стоп-лист: наши слова проходят');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, часть игрушек не замечает, изредка засматривается.
test('баланс: бот проходит уровень 1 часто (≥ 80% из 30 партий) и теряет в среднем не больше 2 соседей', () => {
  const N = 30, R = []; for (let s = 1; s <= N; s++) R.push(playLevel(SO, s, { level: 1 }));
  const n = R.filter(r => r.cleared).length, lost = R.reduce((a, r) => a + r.lost, 0) / N;
  console.log('     уровень 1: пройден ' + n + '/' + N + ', потерь в среднем ' + lost.toFixed(2));
  ok(n >= 0.8 * N, 'слишком сложно: ' + n + '/' + N); ok(lost <= 2, 'потерь много: ' + lost);
});
test('исполнимость: бот без урона проходит каждый из 20 уровней (1 игрок и кооп)', () => {
  for (let lv = 1; lv <= 20; lv++) for (const pl of [1, 2]){ const r = playLevel(SO, lv + pl * 50, { level: lv, god: true, players: pl, maxT: 300 }); ok(r.cleared, 'уровень ' + lv + ' ×' + pl + ': ' + JSON.stringify(r)); }
});
test('кооп: двое ботов проходят уровень 1 не хуже одного', () => {
  const N = 12; let a = 0, b = 0; for (let s = 1; s <= N; s++){ if (playLevel(SO, s, { level: 1 }).cleared) a++; if (playLevel(SO, s, { level: 1, players: 2 }).cleared) b++; }
  console.log('     уровень 1: один ' + a + '/' + N + ', двое ' + b + '/' + N); ok(b >= a - 1 && b >= 0.8 * N);
});
test('вся игра: бот доходит дальше 1-го района, игры не «зависают»', () => {
  const R = []; for (let s = 1; s <= 8; s++) R.push(playGame(SO, s));
  console.log('     уровни: ' + R.map(r => r.level + (r.won ? '★' : '')).join(' ') + '; причины: ' + R.map(r => r.why || 'win').join(','));
  ok(R.every(r => r.why !== 'stuck'), 'завис'); ok(R.filter(r => r.level >= 4).length >= 4, 'слишком сложно для старта');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

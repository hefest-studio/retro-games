/* ГАТЬ · тесты логики (Node, без браузера и зависимостей): node _proto/rts-c/tests/engine.test.mjs
   Карта и A*, движение отряда строем, захват вехи, найм/улучшение/постройка, способности героя и рост уровня,
   бот (реакция 150–250 мс) проходит миссию 1 обоими героями, музыка (8–16 тактов, >30 нот), RU/EN,
   копия движка, страница, правило имён (стоп-лист в base64). Браузер — tests/browser.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '..');
const ROOT = path.resolve(DIR, '..', '..');
function load() {
  const ctx = { console, Math, Date }; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['missions.js', 'game.js', 'bot.js', 'i18n.js']) vm.runInContext(fs.readFileSync(path.join(DIR, 'js', f), 'utf8'), ctx, { filename: f });
  return ctx.GAT;
}
const GAT = load(), L = GAT.logic, TL = L.TILE;
let passed = 0, failed = 0;
function test(name, fn) { const t0 = Date.now(); try { fn(); passed++; console.log(`ok   ${name} (${Date.now() - t0} мс)`); } catch (e) { failed++; console.log(`FAIL ${name} — ${e.stack.split('\n').slice(0, 3).join(' | ')}`); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function run(S, sec, each) { const n = Math.round(sec * 30); for (let i = 0; i < n && !S.result; i++) { if (each) each(S); L.step(S, 1 / 30); S.events.length = 0; } }
function clearEnemies(S) { S.units.forEach(u => { if (u.side === 1) u.dead = true; }); S.units = S.units.filter(u => !u.dead); S.points.forEach(p => { if (p.nest) p.nest.dead = true; }); S.nextWave = 1e9; S.m = Object.assign({}, S.m, { boss: Object.assign({}, S.m.boss, { min: 1e9, time: 1e9 }) }); }
const sq = (S, type) => S.squads.find(s => s.type === type);

// ---------- карта и A* ----------
test('карты 3 миссий: размеры, вехи на суше, все вехи и омуты достижимы от сторожки (A* без частичных путей)', () => {
  GAT.missions.forEach((m, mi) => {
    const S = L.create(mi, 0, 1);
    ok(S.map.g.length === m.w * m.h, 'размер');
    ok(S.points.filter(p => p.home).length === 1, 'одна сторожка');
    ok(S.points.some(p => p.nest), 'есть гнёзда');
    [...S.points, ...S.spawns].forEach(p => {
      ok(L.passable(S.map, p.x, p.y), `точка ${p.id || 'омут'} не на суше`);
      const path = L.astar(S.map, S.home.x, S.home.y, p.x, p.y);
      ok(path.length && !path.partial, `м${mi + 1}: нет пути к ${p.id || 'омуту'}`);
    });
  });
});
test('A*: путь не проходит по воде/чаще, без срезания углов, к недостижимой цели — частичный путь', () => {
  const S = L.create(0, 0, 1), a = S.home, b = S.points[S.points.length - 1];
  const path = L.astar(S.map, a.x, a.y, b.x, b.y);
  let px = a.x, py = a.y;
  path.forEach(w => { ok(L.lineClear(S.map, px, py, w.x, w.y), `отрезок через непроходимое у ${w.x | 0},${w.y | 0}`); px = w.x; py = w.y; });
  ok(Math.hypot(px - b.x, py - b.y) < 2, 'путь не дошёл до цели');
  // искусственная карта: стена с дыркой по диагонали — углы не срезаются
  const map = { w: 5, h: 5, g: new Uint8Array(25).fill(L.T.LAND) };
  map.g[1 * 5 + 2] = L.T.WATER; map.g[2 * 5 + 1] = L.T.WATER; // клетки (2,1) и (1,2)
  const p2 = L.astar(map, 1.5 * TL, 1.5 * TL, 2.5 * TL, 2.5 * TL);
  ok(p2.length >= 1, 'путь есть'); let qx = 1.5 * TL, qy = 1.5 * TL;
  p2.forEach(w => { ok(L.lineClear(map, qx, qy, w.x, w.y), 'срезал угол'); qx = w.x; qy = w.y; });
  // остров без мостков — частичный путь к ближайшей точке
  const iso = { w: 8, h: 3, g: new Uint8Array(24).fill(L.T.LAND) }; for (let y = 0; y < 3; y++) iso.g[y * 8 + 4] = L.T.WATER;
  const p3 = L.astar(iso, 1.5 * TL, 1.5 * TL, 6.5 * TL, 1.5 * TL);
  ok(p3.partial === true, 'не помечен частичным'); ok(p3[p3.length - 1].x < 4 * TL, 'частичный путь ушёл за воду');
});
test('мель и камыш медленнее суши, гать быстрее: A* предпочитает мостки', () => {
  ok(L.passable({ w: 1, h: 1, g: new Uint8Array([L.T.GAT]) }, 5, 5), 'гать проходима');
  ok(!L.passable({ w: 1, h: 1, g: new Uint8Array([L.T.THICKET]) }, 5, 5), 'чаща непроходима');
  const map = { w: 10, h: 3, g: new Uint8Array(30).fill(L.T.SHALLOW) };
  for (let x = 0; x < 10; x++) map.g[2 * 10 + x] = L.T.GAT; // нижний ряд — гать
  const p = L.astar(map, 0.5 * TL, 0.5 * TL, 9.5 * TL, 0.5 * TL);
  ok(p.some(w => w.y > 2 * TL), 'путь не свернул на мостки');
});

// ---------- отряды строем ----------
test('отряд идёт строем: якорь доходит, бойцы на своих местах (разные, рядом), никто не стоит в воде', () => {
  const S = L.create(0, 0, 3); clearEnemies(S);
  const s = sq(S, 'shield'), dst = S.points[1];
  ok(L.order(S, [s.id], { k: 'move', x: dst.x, y: dst.y }) === 1, 'приказ не принят');
  let wet = 0;
  run(S, 40, () => { s.members.forEach(u => { if (!L.passable(S.map, u.x, u.y)) wet++; }); });
  ok(s.order.k === 'idle', 'не дошёл: ' + s.order.k);
  ok(Math.hypot(s.ax - dst.x, s.ay - dst.y) < 50, 'якорь далеко от цели');
  ok(wet === 0, 'бойцы на непроходимом: ' + wet);
  s.members.forEach(u => ok(Math.hypot(u.x - s.ax, u.y - s.ay) < 70, 'боец отстал'));
  for (let i = 0; i < s.members.length; i++) for (let j = i + 1; j < s.members.length; j++) ok(Math.hypot(s.members[i].x - s.members[j].x, s.members[i].y - s.members[j].y) > 8, 'бойцы слиплись');
  const slots = s.members.map((u, i) => L.slot(s, i, s.members.length));
  ok(new Set(slots.map(p => (p.x | 0) + ',' + (p.y | 0))).size === slots.length, 'места строя совпадают');
});
test('несколько отрядов получают разные точки назначения (веер), атака по цели доходит до врага', () => {
  const S = L.create(0, 0, 3); clearEnemies(S);
  const ids = S.squads.map(s => s.id); L.order(S, ids, { k: 'move', x: S.home.x + 200, y: S.home.y });
  const d = new Set(S.squads.map(s => (s.order.x | 0) + ',' + (s.order.y | 0))); ok(d.size === ids.length, 'точки совпали');
  const foe = { x: S.points[1].x, y: S.points[1].y };
  const u = (function () { const ctx = S; const k = L.KINDS.kochkar; const e = { id: 9999, side: 1, kind: 'kochkar', x: foe.x, y: foe.y, hp: k.hp, maxHp: k.hp, dmg: 0, range: 20, rate: 1, cd: 99, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x: foe.x, y: foe.y } }; ctx.units.push(e); return e; })();
  L.order(S, [sq(S, 'bow').id], { k: 'attack', tid: u.id }); run(S, 40);
  ok(u.dead, 'цель не убита');
});

// ---------- вехи ----------
test('захват вехи: отряд на ничьей вехе захватывает за ~5–6 с, +30 припаса, доход растёт; гнездо мешает захвату', () => {
  const S = L.create(0, 0, 5); clearEnemies(S);
  const p = S.points.find(q => q.owner === 0), s = sq(S, 'bow');
  s.ax = p.x; s.ay = p.y; s.order = { k: 'idle', x: p.x, y: p.y }; s.members.forEach(u => { u.x = p.x; u.y = p.y + 10; });
  const sup0 = S.supply; let t = 0, caps = 0;
  for (let i = 0; i < 30 * 10 && p.owner !== 1; i++) { L.step(S, 1 / 30); caps += S.events.filter(e => e.e === 'capture').length; S.events.length = 0; t += 1 / 30; }
  ok(p.owner === 1, 'не захвачено'); ok(t > 3 && t < 7, 'время захвата ' + t.toFixed(1)); ok(caps === 1, 'событие захвата');
  ok(S.supply >= sup0 + 30, 'нет награды');
  run(S, 1); ok(S.income > 0.8 - 1e-9, 'доход ' + S.income);
  // гнездо: пока цело — прогресса нет
  const S2 = L.create(0, 0, 5), np = S2.points.find(q => q.nest);
  S2.units.forEach(u => { if (u.side === 1 && u.kind !== 'nest') u.dead = true; }); S2.units = S2.units.filter(u => !u.dead);
  np.nest.dmg = 0; S2.nextWave = 1e9;
  const s2 = sq(S2, 'shield'); s2.ax = np.x + 30; s2.ay = np.y; s2.order = { k: 'idle', x: s2.ax, y: s2.ay }; s2.members.forEach(u => { u.x = np.x + 30; u.y = np.y; u.dmg = 0; });
  np.nest.spawnT = 1e9; run(S2, 6); ok(np.owner === -1 && np.prog === -1, 'гнездо захвачено, хотя цело');
  np.nest.hp = 1; s2.members.forEach(u => { u.dmg = 5; }); run(S2, 3); ok(np.nest.dead, 'гнездо не разорено');
  run(S2, 14); ok(np.owner === 1, 'после гнезда веха не захвачена: ' + np.owner + ' ' + np.prog.toFixed(2));
});
test('нечисть отбивает веху: при перевесе прогресс падает, постройка теряется, падение сторожки — поражение', () => {
  const S = L.create(0, 0, 5); clearEnemies(S);
  const p = S.home; p.building = 'barn';
  S.squads.forEach(s => s.members.forEach(u => { u.x = 50; u.y = 50; })); S.squads.forEach(s => { s.ax = 50; s.ay = 50; s.order = { k: 'idle', x: 50, y: 50 }; });
  S.hero.dead = true; S.hero.respawn = 1e9; S.units = S.units.filter(u => u !== S.hero);
  S.squads.forEach(s => s.members.forEach(u => { if (u !== S.hero) u.dead = true; }));
  for (let i = 0; i < 3; i++) { const k = L.KINDS.kochkar; S.units.push({ id: 900 + i, side: 1, kind: 'kochkar', x: p.x + i * 10, y: p.y, hp: k.hp, maxHp: k.hp, dmg: 0, range: 20, rate: 1, cd: 9, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x: p.x + i * 10, y: p.y } }); }
  run(S, 12);
  ok(p.owner !== 1 && p.building === null, 'сторожка не потеряна'); ok(S.result === 'lose', 'нет поражения');
});

// ---------- найм, улучшение, постройка ----------
test('найм отряда: стоимость, лимит 4 отряда, нехватка припаса, только на своей вехе', () => {
  const S = L.create(0, 0, 5); clearEnemies(S); S.supply = 1000;
  const n0 = L.armyCount(S), r1 = L.hire(S, S.home.id, 'cart');
  ok(r1.ok && L.armyCount(S) === n0 + 1 && S.supply === 1000 - L.SQUADS.cart.cost, 'найм не прошёл');
  ok(r1.squad.members.length === L.SQUADS.cart.n, 'бойцов в отряде');
  ok(L.hire(S, S.home.id, 'bow').ok, 'второй найм');
  const r3 = L.hire(S, S.home.id, 'bow'); ok(!r3.ok && r3.why === 'max', 'лимит отрядов: ' + r3.why);
  const S2 = L.create(0, 0, 5); S2.supply = 10; ok(L.hire(S2, S2.home.id, 'bow').why === 'supply', 'нехватка припаса');
  S2.supply = 999; const foreign = S2.points.find(q => q.owner !== 1); ok(L.hire(S2, foreign.id, 'bow').why === 'nopoint', 'найм на чужой вехе');
});
test('улучшение отряда на вехе: +уровень, бойцы пополнены, урон/здоровье выше, вдали — нельзя; постройка — одна на веху', () => {
  const S = L.create(0, 0, 5); clearEnemies(S); S.supply = 1000;
  const s = sq(S, 'bow'); s.members[0].dead = true; const hp0 = s.members[1].maxHp, dmg0 = s.members[1].dmg;
  s.ax = S.home.x; s.ay = S.home.y;
  const r = L.upgrade(S, S.home.id, s.id); ok(r.ok, 'улучшение: ' + r.why);
  ok(s.level === 2 && s.members.filter(u => !u.dead).length === L.SQUADS.bow.n, 'уровень/пополнение');
  ok(s.members[0].maxHp > hp0 && s.members[0].dmg > dmg0, 'статы не выросли');
  s.ax = 5000; ok(L.upgrade(S, S.home.id, s.id).why === 'far', 'улучшение вдали');
  ok(L.build(S, S.home.id, 'tower').ok, 'постройка'); ok(L.build(S, S.home.id, 'fire').why === 'built', 'вторая постройка');
});
test('вышка стреляет по нечисти, костёр пополняет отряд на вехе', () => {
  const S = L.create(0, 0, 5); clearEnemies(S); S.supply = 1000; L.build(S, S.home.id, 'tower');
  const k = L.KINDS.kochkar, e = { id: 777, side: 1, kind: 'kochkar', x: S.home.x + 120, y: S.home.y - 60, hp: k.hp, maxHp: k.hp, dmg: 0, range: 20, rate: 1, cd: 99, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x: S.home.x + 120, y: S.home.y - 60 } };
  S.units.push(e); S.squads.forEach(s => s.members.forEach(u => { u.dmg = 0; })); run(S, 8); ok(e.dead, 'вышка не убила');
  const S2 = L.create(0, 0, 5); clearEnemies(S2); S2.supply = 1000; L.build(S2, S2.home.id, 'fire');
  const s = sq(S2, 'shield'); s.members[0].dead = true; s.members[1].dead = true; run(S2, 9);
  ok(s.members.filter(u => !u.dead).length === L.SQUADS.shield.n, 'не пополнился: ' + s.members.filter(u => !u.dead).length);
});

// ---------- герой ----------
test('Ведана: залп бьёт по площади с задержкой и уходит на перезарядку, свет лечит своих рядом', () => {
  const S = L.create(0, 0, 5); clearEnemies(S); const h = S.hero;
  const mk = (x, y, id) => { const k = L.KINDS.kochkar; const e = { id, side: 1, kind: 'kochkar', x, y, hp: 200, maxHp: 200, dmg: 0, range: 20, rate: 1, cd: 99, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x, y } }; S.units.push(e); return e; };
  const a = mk(h.x + 250, h.y, 801), b = mk(h.x + 270, h.y + 20, 802), far = mk(h.x + 450, h.y, 803);
  h.dmg = 0; S.squads.forEach(s => s.members.forEach(u => { u.dmg = 0; }));
  ok(L.ability(S, 'q', a.x, a.y), 'залп не сработал'); ok(h.cdQ > 0, 'нет перезарядки'); ok(!L.ability(S, 'q', a.x, a.y), 'залп без перезарядки');
  ok(a.hp === 200, 'урон без задержки');
  run(S, 0.6);
  ok(a.hp < 200 && b.hp < 200, 'залп не задел цели'); ok(far.hp === 200, 'залп задел дальнего');
  // дальность залпа ограничена: точка дальше — сдвигается к герою
  const fx = S.fx.find(f => f.k === 'volley' || f.k === 'boom'); ok(!fx || Math.hypot(fx.x - h.x, fx.y - h.y) <= L.HEROES[0].q.range + 1, 'залп дальше дальности');
  const ally = sq(S, 'shield').members[0]; ally.hp = 10; ally.x = h.x + 30; ally.y = h.y;
  ok(L.ability(S, 'e'), 'свет'); ok(ally.hp > 10, 'не вылечил'); ok(!L.ability(S, 'e'), 'свет без перезарядки');
});
test('Ждан: рывок переносит героя и бьёт с отбросом, клич усиливает своих; рост уровня от опыта', () => {
  const S = L.create(0, 1, 5); clearEnemies(S); const h = S.hero;
  ok(h.kind === 'hero_z', 'герой выбран');
  const k = L.KINDS.kochkar, e = { id: 901, side: 1, kind: 'kochkar', x: h.x + 150, y: h.y, hp: 300, maxHp: 300, dmg: 0, range: 20, rate: 1, cd: 99, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x: h.x + 150, y: h.y } };
  S.units.push(e); const x0 = h.x;
  ok(L.ability(S, 'q', e.x, e.y), 'рывок'); run(S, 0.3);
  ok(h.x > x0 + 100, 'герой не переместился'); ok(e.hp < 300, 'рывок не ударил');
  const ally = sq(S, 'bow').members[0]; ally.x = h.x - 20; ally.y = h.y;
  ok(L.ability(S, 'e'), 'клич'); ok(ally.buff > 0, 'нет усиления');
  const lvl0 = h.lvl, hp0 = h.maxHp; e.hp = 1; e.x = h.x + 15; run(S, 2);
  for (let i = 0; i < 10; i++) S.units.push({ id: 950 + i, side: 1, kind: 'tinnik', x: h.x + 16, y: h.y, hp: 1, maxHp: 1, dmg: 0, range: 20, rate: 1, cd: 99, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x: h.x + 16, y: h.y } });
  run(S, 6);
  ok(h.lvl > lvl0 && h.maxHp > hp0, `уровень не вырос: ${h.lvl}, опыт ${h.xp}`);
});
test('гибель героя: возрождение на своей вехе через 10 с', () => {
  const S = L.create(0, 0, 5); clearEnemies(S); const h = S.hero;
  h.hp = 1; S.units.push({ id: 990, side: 1, kind: 'kochkar', x: h.x + 10, y: h.y, hp: 9999, maxHp: 9999, dmg: 50, range: 30, rate: 0.1, cd: 0, speed: 0, r: 9, armor: 0, splash: 0, dead: false, face: 0, hitT: 0, buff: 0, post: { x: h.x + 10, y: h.y } });
  run(S, 0.5); ok(h.dead && S.stats.heroDeaths === 1, 'герой не пал');
  S.units = S.units.filter(u => u.id !== 990);
  run(S, 10.5); ok(!h.dead && h.hp === h.maxHp, 'не возродился');
});

// ---------- бот ----------
for (const [hero, seed] of [[0, 7], [1, 11], [0, 23]]) {
  test(`бот (реакция 150–250 мс) проходит миссию 1: герой ${hero ? 'Ждан' : 'Ведана'}, сид ${seed}`, () => {
    const S = L.create(0, hero, seed), bot = GAT.makeBot(S, seed + 1);
    while (!S.result && S.t < 900) { bot.update(1 / 30); L.step(S, 1 / 30); S.events.length = 0; }
    ok(S.result === 'win', `итог ${S.result} на ${S.t | 0} с`);
    ok(S.t > 300 && S.t < 720, 'длительность ' + (S.t | 0) + ' с');
    const per = S.t / bot.decisions; ok(per >= 0.15 && per <= 0.25, 'среднее время реакции ' + per.toFixed(3));
    console.log(`     ${(S.t / 60).toFixed(1)} мин, звёзд ${L.stars(S)}, убито ${S.stats.kills}, потери ${S.stats.lost}`);
  });
}

// ---------- музыка ----------
test('музыка: трек gat парсится, 8–16 тактов, голоса кратны, >30 нот в окне 10 с, без ошибок', () => {
  const listeners = {}, timers = [];
  function param(v) { return { value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ramp ≤0'); }, setTargetAtTime() {} }; }
  function node(kind) { return { kind, connect() {}, disconnect() {}, start() {}, stop() {}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
  class FakeAC { constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; } createOscillator() { return node('osc'); } createGain() { return node('gain'); } createBiquadFilter() { return node('f'); } createBufferSource() { return node('n'); } createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } resume() {} suspend() {} }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt, AudioContext: FakeAC,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }, setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval(id) { timers[id - 1] = null; },
    setTimeout() { return 0; }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => 0 } };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'engine.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'js/music.js'), 'utf8'), win);
  const A = win.Arcade, tr = A.tracks.gat; ok(tr, 'нет Arcade.tracks.gat');
  const c = A.parseTrack(tr), perBar = c.div * 4, bars = c.melody.length / perBar;
  ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тактов ' + bars);
  ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'голоса не кратны');
  [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, 'нота вне диапазона'));
  const g = A.createGame({ canvas: '#c', gameId: 'gat' }); g.useStandardScreens(); g.scene('play', {});
  (listeners.keydown || []).forEach(f => f({ code: 'Enter', preventDefault() {} })); g.goto('play');
  for (let i = 0; i < 200; i++) { g.audio.ac.currentTime += 0.05; timers.forEach(t => t && t()); }
  const st = g.audio.music.stats; ok(st.scheduled > 30 && st.errors === 0, JSON.stringify(st));
});

// ---------- строки, страница, движок ----------
test('RU/EN: одинаковые ключи, все отряды/враги/постройки/миссии/герои переведены', () => {
  const ru = GAT.strings.ru, en = GAT.strings.en;
  const kr = Object.keys(ru).sort(), ke = Object.keys(en).sort(); ok(JSON.stringify(kr) === JSON.stringify(ke), 'ключи RU/EN различаются: ' + kr.filter(k => !en[k]).concat(ke.filter(k => !ru[k])).join(','));
  const need = [...Object.keys(L.SQUADS), ...Object.keys(L.KINDS).filter(k => !k.startsWith('hero')), ...Object.keys(L.BUILD), 'm1', 'm2', 'm3', 'hero_v', 'hero_z', 'q_v', 'e_v', 'q_z', 'e_z'];
  need.forEach(k => ok(ru[k] && en[k], 'нет строки ' + k));
  ok(!/[а-яё]/i.test(Object.values(en).join(' ')), 'кириллица в EN');
});
test('страница: «← Каталог» на ../../ с data-en, фавикон студии, скрипты на месте; engine.js — копия _shared', () => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  ok(/<a class="back"[^>]*href="\.\.\/\.\.\/"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/rel="icon"/.test(html), 'фавикон');
  [...html.matchAll(/<script src="\.\/([^"]+)"/g)].forEach(m => { const f = path.join(DIR, m[1]); ok(fs.existsSync(f), 'нет ' + m[1]); new vm.Script(fs.readFileSync(f, 'utf8'), { filename: m[1] }); });
  ok(fs.readFileSync(path.join(DIR, 'engine.js'), 'utf8') === fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8'), 'engine.js не совпадает с _shared/engine.js');
});
test('правило имён: нет чужих игр, студий, фракций (общий список аркады + стратегии + мобильные стратегии; стоп-лист в base64)', () => {
  // сами названия в репозиторий не попадают — только base64
  const BAD = new RegExp(Buffer.from('XGJjb250cmFcYnzQutC+0L3RgtGA0LAoPyFb0LAt0Y/RkV0pfGV4b2xvbnzRjdC60YHQvtC70L7QvXx2aXRvcmN80LLQuNGC0L7RgNC6fFxiZXJpa1xifGJhbGVvZ3xcYm9sYWZcYnxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfGxhc3QgP21pc3Npb258XGJkaWdnZXJcYnzQtNC40LPQs9C10YB8cml2ZXIgP3JhaWR8bG9kZSA/cnVubmVyfGJvdWxkZXIgP2Rhc2h8cGFjLT9tYW580L/QsNC60LzQsNC9fHRldHJpc3zRgtC10YLRgNC40YF8Z2FsYWd80LPQsNC70LDQs3xnYWxheGlhbnx4b25peHzQutGB0L7QvdC40LrRgXxiYXR0bGUgP2NpdHl8Y2hpcCA/Jz9uJz8gP2RhbGV8ZGFya3dpbmd8ZGl6enl8XGJiXC5vXC5iXGJ8dGVjbW98a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fHRhaXRvfNGC0LDQudGC0L58Y2FwY29tfNC60LDQv9C60L7QvHxuaW50ZW5kb3zQvdC40L3RgtC10L3QtNC+fFxic2VnYVxifNGB0LXQs9CwKD8hW9CwLdGP0ZFdKXxkZWVwc2Vla3xzdGFyY3JhZnR80YHRgtCw0YDQutGA0LDRhNGCfHdhcmNyYWZ0fNCy0LDRgNC60YDQsNGE0YJ8YmxpenphcmR80LHQu9C40LfQt9Cw0YDQtHxcYnplcmd80LfQtdGA0LN8cHJvdG9zc3zQv9GA0L7RgtC+0YHRgXxcYnRlcnJhbnzRgtC10YDRgNCw0L18Y29tbWFuZCA/KCZ8YW5kKSA/Y29ucXVlcnxyZWQgP2FsZXJ0fHdlc3R3b29kfNCy0LXRgdGC0LLRg9C0fFxiZHVuZVxifHRvdGFsID9hbm5paGlsYXRpb258c3VwcmVtZSA/Y29tbWFuZGVyfGNvbXBhbnkgP29mID9oZXJvZXN8ZGF3biA/b2YgP3dhcnx3YXJoYW1tZXJ8YWdlID9vZiA/KGVtcGlyZXN8bXl0aG9sb2d5KXxyaXNlID9vZiA/bmF0aW9uc3xzdHJvbmdob2xkfHNldHRsZXJzfHRoZXkgP2FyZSA/YmlsbGlvbnN8aXJvbiA/aGFydmVzdHxob21ld29ybGR8XGJra25kXGJ8d2Fyem9uZSA/MjEwMHzQutCw0LfQsNC60Lh8Y29zc2Fja3N8YmxpdHprcmllZ3xtZW4gP29mID93YXJ8bXl0aFxifHJlbGljID9lbnRlcnRhaW5tZW50fGVuc2VtYmxlID9zdHVkaW9zfHNwYWNlID9tYXJpbmVzP3zQutC+0YHQvNC+0LTQtdGB0LDQvdGCfHhlbm9tb3JwaHzQutGB0LXQvdC+0LzQvtGA0YR8Y2xhc2ggP29mID9jbGFuc3xjbGFzaCA/cm95YWxlfNC60Ltb0Y3QtV3RiCA/KNC+0YR80YDQvtGP0LvRjCl8c3VwZXJjZWxsfNGB0YPQv9C10YDRgdC10LvQu3xraW5nZG9tID9ydXNofNC60LjQvdCz0LTQvtC8ID/RgNCw0Yh8aXJvbmhpZGV8aXJvbiA/bWFyaW5lc3xiYWQgP25vcnRofHJ1c2ggP3JveWFsZXxsb3JkcyA/bW9iaWxlfHJpc2UgP29mID9raW5nZG9tc3xsaWxpdGh8YXJ0ID9vZiA/d2FyfGJvb20gP2JlYWNofGJyYXdsID9zdGFyc3x3YXJjcmFmdCA/cnVtYmxlfHBsYW50cyA/dnN8cG9wY2FwfGNhc3RsZSA/Y2xhc2h8aHVzdGxlID9jYXN0bGV80YXQsNGB0YLQu3x0aHJvbmUgP3J1c2h8bXVzaHJvb20gP3dhcnN8emlsbGlvbiA/d2hhbGVzfHJ1c3RlZCA/d2FyZmFyZXx0aW55ID90cm9vcGVyc3xlbXBpcmVzID8mID9wdXp6bGVzfHJhaWQ6PyA/c2hhZG93fHBsYXJpdW180L/Qu9Cw0YDQuNGD0Lx8c3Rvcm1mYWxsfHZpa2luZ3M6ID93YXJ8Zm9yZ2UgP29mID9lbXBpcmVzfGlubm9nYW1lc3xlbHZlbmFyfHBsYXlyaXh80L/Qu9C10LnRgNC40LrRgXxuZXh0ZXJzfNC90LXQutGB0YLQtdGA0YF8aGVybyA/d2Fyc3xcYmlnZ1xifGthYmFtfHRlbmNlbnR80YLQtdC90YHQtdC90YJ8bmV0ZWFzZXxtb29udG9ufG1vYmlsZSA/bGVnZW5kc3x2YWluZ2xvcnl8dG90YWwgP2JhdHRsZXx3YXJwYXRofFxidG9wID93YXJcYnxjYWxsID9vZiA/ZHJhZ29uc3xhZ2UgP29mID9vcmlnaW5zfHN0YXRlID9vZiA/c3Vydml2YWx8d2hpdGVvdXQgP3N1cnZpdmFsfFxibGFzdCA/d2FyXGJ8ZXZvbnl8bWFyY2ggP29mID9lbXBpcmVzfGdhbWVsb2Z0fHNwZWxsZm9yY2V8YmF0dGxlID9yZWFsbXN8bm9ydGhnYXJkfGtpbmdkb20gP3dhcnN8c2llZ2VjcmFmdHxsZWdpb24gP3RkfHJhbmRvbSA/ZGljZXxhcmtuaWdodHN8Ymxvb25zfG5pbmphID9raXdpfGRhd24gP29mID90aXRhbnN8bWlnaHR5ID9wYXJ0eXxhcnQgP29mID9jb25xdWVzdHxpbmZpbml0eSA/a2luZ2RvbXxkb21pbmF0aW9uc3xcYm5leG9uXGJ8enluZ2F8Z2F0ID9yYXR8dmF0bmlrfNCy0LDRgtC90LjQunxcYmdvcmRcYg==', 'base64').toString('utf8'), 'i');
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(js|mjs|html|css|md|json)$/.test(e.name)) files.push(f); } })(DIR);
  const hits = [];
  files.forEach(f => { const txt = fs.readFileSync(f, 'utf8'); txt.split('\n').forEach((ln, i) => { const m = BAD.exec(ln); if (m) hits.push(`${path.relative(DIR, f)}:${i + 1}: «${m[0]}»`); }); });
  const strs = JSON.stringify(GAT.strings); const m2 = BAD.exec(strs); if (m2) hits.push('строки: ' + m2[0]);
  ok(hits.length === 0, hits.slice(0, 8).join('; '));
  ok(BAD.test(Buffer.from('VGV0cmlz', 'base64').toString()), 'стоп-лист не работает');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

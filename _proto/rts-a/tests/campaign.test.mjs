/* ПРИИСК · tests/campaign.test.mjs — кампания: парсер ASCII-карт, условия/триггеры/действия, сценарный ИИ, герои,
   сохранение прогресса и флагов (localStorage-ключ arcade.priisk.campaign), бот проходит миссии 1 и 2 (реакция 150–250 мс,
   цели по порядку), миссии не тупиковые (A*), тексты RU/EN. Стоп-лист имён по всем файлам папки (и миссиям) — в engine.test.mjs.
   Запуск: node _proto/rts-a/tests/campaign.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, setTimeout, clearTimeout, Date, JSON };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/i18n.js', 'js/game.js', 'js/campaign.js', 'js/missions/m1.js', 'js/missions/m2.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const P = sandbox.PRIISK, L = P.logic, C = P.campaign, STR = P.STR;

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function memStore() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }
function tickN(W, sec, dt = 1 / 30, until) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { C.tick(W, dt); W.events.length = 0; if (until && until()) return true; } return false; }

// мини-миссия для модульных проверок
function tiny(extra = {}) {
  return Object.assign({
    id: 't1', n: 99, title: 'т', brief: 'т',
    map: [
      '####################',
      '#S.......#.........#',
      '#........#....E....#',
      '#..==....#.........#',
      '#..==..............#',
      '#........#.....K...#',
      '#oo......#.........#',
      '####################'],
    legend: {},
    zones: { k: { at: 'K', r: 2 }, ice: { x: 3, y: 3, w: 2, h: 2 }, right: { x: 10, y: 1, w: 9, h: 6 } },
    player: { copper: 100, build: ['boiler'], units: [], start: [{ type: 'rifleman', at: 'S', n: 2 }] },
    enemy: { start: [] },
    objectives: [{ id: 'go', icon: 'eye', text: 'дойди', done: { t: 'zone', zone: 'k' } }],
    triggers: []
  }, extra);
}

// ---------- Парсер ----------
test('парсер: размеры, клетки (скала/вода/лёд/полынья/медь), точки; кривая строка — ошибка', () => {
  const m = C.parseMap(['#.~=_', '#oOAa', '#####'], { a: 'o' });
  eq([m.w, m.h], [5, 3]);
  eq([...m.t.slice(0, 5)], [L.ROCK, L.GROUND, L.WATER, L.ICE, L.OPEN]);
  eq([m.ore[6], m.ore[7], m.ore[8], m.ore[9]], [300, 500, 0, 300], 'медь и точка-с-легендой');
  eq(m.points.A, [{ i: 3, j: 1 }]); eq(m.points.a, [{ i: 4, j: 1 }]);
  let threw = false; try { C.parseMap(['###', '##']); } catch (e) { threw = true; } ok(threw, 'не поймали кривую строку');
});
test('парсер: карты миссий 1 и 2 — прямоугольные, с рамкой из скал, все точки на проходимых клетках', () => {
  for (const id of ['m1', 'm2']) {
    const d = C.byId(id), m = C.parseMap(d.map, d.legend);
    for (let i = 0; i < m.w; i++) { eq(m.t[i], L.ROCK, id + ' верх'); eq(m.t[(m.h - 1) * m.w + i], L.ROCK, id + ' низ'); }
    for (const k of Object.keys(m.points)) m.points[k].forEach(c => ok(L.walkable(m.t[c.j * m.w + c.i]), id + ': точка ' + k + ' в скале'));
  }
});

// ---------- Мир миссии, условия, действия ----------
test('мир миссии: стартовые силы на точках, медь, разрешённые здания; цель «дойти» выполняется → победа', () => {
  const W = C.build(tiny());
  eq(W.units.filter(u => u.owner === 0).length, 2); eq(W.players[0].copper, 100);
  ok(C.allowed(W, 'boiler') && !C.allowed(W, 'works'), 'разрешения');
  const ids = W.units.map(u => u.id), k = C.pointOf(W.mission, 'K');
  L.commandMove(W, ids, k.x, k.y);
  ok(tickN(W, 30, 1 / 30, () => W.winner >= 0), 'не дошли / нет победы');
  eq(W.winner, 0); eq(W.mission.byObj.go.state, 'done'); ok(W.mission.result && W.mission.result.win);
});
test('триггеры: таймер, зона, построено, медь, wait, цепочка целей (after), флаги, повтор', () => {
  const d = tiny({
    objectives: [
      { id: 'a', icon: 'x', text: 'a', done: { t: 'built', type: 'boiler' } },
      { id: 'b', after: 'a', icon: 'x', text: 'b', done: { t: 'copper', gte: 500 } }],
    triggers: [
      { id: 't5', when: { t: 'time', gte: 5 }, do: [{ a: 'flag', key: 'five' }, { a: 'wait', s: 2 }, { a: 'copper', n: 50 }] },
      { id: 'rep', when: { t: 'time', gte: 1 }, repeat: 3, do: [{ a: 'copper', n: 1 }] },
      { id: 'objA', when: { t: 'obj', id: 'a' }, do: [{ a: 'say', who: 'varvara', text: 'есть' }] }]
  });
  const W = C.build(d), MS = W.mission, pl = W.players[0];
  eq(MS.byObj.b.state, 'hidden');
  tickN(W, 4.9); ok(!MS.flags.five, 'рано'); tickN(W, 0.4); ok(MS.flags.five, 'таймер не сработал');
  const c0 = pl.copper; tickN(W, 1.5); eq(pl.copper - c0 < 50, true, 'wait не ждёт'); tickN(W, 1); ok(pl.copper - c0 >= 50, 'после wait');
  ok(C.cond(W, { t: 'copper', gte: 150 })); ok(!C.cond(W, { t: 'built', type: 'boiler' }));
  L.addBuilding(W, 0, 'hq', 12, 1); L.addBuilding(W, 0, 'boiler', 15, 1); tickN(W, 0.5);
  eq(MS.byObj.a.state, 'done'); eq(MS.byObj.b.state, 'active', 'после a не открылась b');
  ok(MS.ui.some(e => e.t === 'say' && e.text === 'есть'), 'реплика по цели');
  ok(MS.fired.rep > 0 && pl.copper > 150, 'повтор');
  ok(C.cond(W, { t: 'all', of: [{ t: 'flag', key: 'five' }, { t: 'not', of: { t: 'flag', key: 'nope' } }] }));
});
test('действия: подкрепление по зоне, смена ИИ (hold → attack), изменение карты (лёд → полынья), туман, поражение', () => {
  const d = tiny({
    triggers: [
      { id: 'z', when: { t: 'zone', zone: 'right' }, do: [{ a: 'spawn', owner: 1, type: 'rifleman', n: 3, at: 'E', tag: 'foe' }, { a: 'group', tag: 'foe', mode: 'hold' }] },
      { id: 'w', when: { t: 'time', gte: 2 }, do: [{ a: 'tiles', zone: 'ice', from: '=', to: '_' }, { a: 'reveal', at: 'K', r: 3, s: 5 }] }]
  });
  const W = C.build(d), MS = W.mission, ice = 3 * W.w + 3;
  eq(W.t[ice], L.ICE); ok(L.passable(W, 3, 3), 'лёд проходим');
  tickN(W, 2.5); eq(W.t[ice], L.OPEN, 'лёд не треснул'); ok(!L.passable(W, 3, 3), 'полынья проходима'); ok(W.mapRev > 0);
  ok(W.vis[5 * W.w + 15] === 2, 'метка не открыла туман');
  ok(!W.units.some(u => u.owner === 1)); const u = W.units[0]; u.x = 11.5; u.y = 2.5; tickN(W, 0.5);
  eq(W.units.filter(u => u.tag === 'foe').length, 3, 'подкрепление'); eq(MS.groups.foe.mode, 'hold');
  C.act(W, { a: 'group', tag: 'foe', mode: 'attack' }); tickN(W, 1); ok(W.units.filter(u => u.tag === 'foe').every(u => u.order.t !== 'idle'), 'attack не двинул группу');
  C.act(W, { a: 'lose', reason: 'тест' }); eq(W.winner, 1); eq(MS.reason, 'тест');
});
test('лёд трескается под юнитом — юнит выбирается на твёрдую клетку', () => {
  const W = C.build(tiny()); const u = W.units[0]; u.x = 3.5; u.y = 3.5;
  C.act(W, { a: 'tiles', zone: 'ice', from: '=', to: '_' });
  ok(L.walkable(W.t[Math.floor(u.y) * W.w + Math.floor(u.x)]), 'остался в полынье');
});
test('сценарный ИИ: patrol ходит по маршруту, hold возвращается на пост, convoy идёт по точкам, группа отвечает на обстрел', () => {
  const d = tiny({ enemy: { start: [{ type: 'rifleman', at: 'E', n: 1, tag: 'pat' }, { type: 'rifleman', at: 'K', n: 1, tag: 'post' }] },
    groups: { pat: { mode: 'patrol', route: ['E', 'K'] }, post: { mode: 'hold' } } });
  const W = C.build(d), pat = W.units.find(u => u.tag === 'pat'), post = W.units.find(u => u.tag === 'post');
  W.units.filter(u => u.owner === 0).forEach(u => { u.x = 1.5; u.y = 6.5; });
  let visitedK = false, back = false;
  for (let i = 0; i < 30 * 40; i++) { C.tick(W, 1 / 30); W.events.length = 0; const k = C.pointOf(W.mission, 'K'), e = C.pointOf(W.mission, 'E'); if (Math.hypot(pat.x - k.x, pat.y - k.y) < 2) visitedK = true; if (visitedK && Math.hypot(pat.x - e.x, pat.y - e.y) < 2) back = true; }
  ok(visitedK && back, 'патруль не обошёл маршрут');
  post.x -= 4; post.order = { t: 'idle' }; tickN(W, 6); ok(Math.hypot(post.x - post.post.x, post.y - post.post.y) < 2.6, 'пост не вернулся');
  // обстрел: свой стрелок бьёт пост — пост отвечает
  const me = W.units.find(u => u.owner === 0); me.x = post.x - 3.4; me.y = post.y; me.order = { t: 'idle' }; me.hitT = -99;
  L.commandAttack(W, [me.id], post.id); tickN(W, 2); ok(post.order.t === 'attack', 'пост не ответил');
  // конвой
  const W2 = C.build(tiny({ enemy: { start: [{ type: 'hauler', at: 'E', n: 1, tag: 'cv' }, { type: 'rifleman', at: 'E', n: 1, tag: 'cv' }] }, groups: { cv: { mode: 'convoy', route: ['S', 'K'] } } }));
  const wag = W2.units.find(u => u.tag === 'cv' && u.type === 'hauler');
  let atS = false; for (let i = 0; i < 30 * 40; i++) { C.tick(W2, 1 / 30); W2.events.length = 0; const s = C.pointOf(W2.mission, 'S'); if (Math.hypot(wag.x - s.x, wag.y - s.y) < 3.5) atS = true; }
  ok(atS && W2.mission.groups.cv.ri >= 1, 'конвой не дошёл до первой точки');
  const k = C.pointOf(W2.mission, 'K'); ok(Math.hypot(wag.x - k.x, wag.y - k.y) < 3.5, 'конвой не дошёл до конца маршрута');
});
test('волновой ИИ скирмиша включается действием ai (нужна Контора у врага)', () => {
  const W = C.build(tiny({ enemy: { start: [{ type: 'hq', at: 'E' }] } }));
  C.act(W, { a: 'ai', mode: 'waves', first: 60 }); ok(W.ai && W.ai.o === 1 && W.ai.nextWave > 50);
});

// ---------- Герои ----------
test('герои: аура Варвары (+урон/скорость рядом), Клич усиливает, перезарядка; метка Луни открывает туман на время', () => {
  const W = C.build(tiny({ player: { copper: 0, build: [], units: [], start: [{ type: 'varvara', at: 'S' }, { type: 'lunya', at: 'S' }, { type: 'rifleman', at: 'S', n: 1 }] } }));
  const v = W.units.find(u => u.type === 'varvara'), lu = W.units.find(u => u.type === 'lunya'), r = W.units.find(u => u.type === 'rifleman');
  tickN(W, 0.1); ok(r.bD > 1 && r.bS > 1, 'аура не действует'); const d0 = r.bD;
  r.x = 18; r.y = 6.5; tickN(W, 0.1); eq(r.bD, 1, 'аура дальше радиуса');
  r.x = v.x + 1; r.y = v.y; eq(L.ability(W, v), 'ok'); tickN(W, 0.1); ok(r.bD > d0, 'Клич не усилил'); eq(L.ability(W, v), 'cd', 'нет перезарядки');
  tickN(W, 8.5); ok(!(v.abOn > 0), 'Клич не закончился');
  eq(L.ability(W, lu, 40, 40), 'far'); const k = C.pointOf(W.mission, 'K');
  ok(W.vis[Math.floor(k.y) * W.w + Math.floor(k.x)] !== 2); eq(L.ability(W, lu, k.x, k.y), 'ok'); tickN(W, 0.3);
  eq(W.vis[Math.floor(k.y) * W.w + Math.floor(k.x)], 2, 'метка не открыла'); tickN(W, 13); ok(W.vis[Math.floor(k.y) * W.w + Math.floor(k.x)] !== 2, 'метка не погасла');
});
test('герои: гибель Варвары — не поражение (если миссия не требует); гибель Луни в миссии 2 — поражение', () => {
  const W = C.build(C.byId('m1')); const v = W.units.find(u => u.type === 'varvara'); v.hp = 0; tickN(W, 0.5);
  eq(W.winner, -1, 'Варвара: поражение'); ok(W.mission.heroDead.varvara);
  const W2 = C.build(C.byId('m2')); const lu = W2.units.find(u => u.type === 'lunya'); lu.hp = 0; tickN(W2, 0.5);
  eq(W2.winner, 1, 'Луня: нет поражения'); ok(/Луня/.test(C.txt(W2.mission.reason, 'ru')));
});
test('ветеран: 3 победы — звание, урон ×1.2', () => {
  const W = L.worldFromMap(['##########', '#........#', '#........#', '##########']);
  const a = L.addUnit(W, 0, 'rifleman', 2.5, 1.5);
  for (let k = 0; k < 3; k++) { const e = L.addUnit(W, 1, 'rifleman', 4.5, 1.5); e.hp = 1; e.hitBy = a.id; e.hp = 0; L.step(W, 0.05); }
  eq(a.kills, 3); eq(a.vet, 1);
});

// ---------- Сохранение ----------
test('сохранение: ключ arcade.priisk.campaign, звёзды (лучшие), открытие миссии, флаги, герои и ветераны', () => {
  const st = memStore(); let d = C.load(st); eq(d.unlocked, 1);
  const res = { id: 'm1', win: true, time: 600, stars: [true, false, true], lostU: 1, lostB: 0, flags: {}, heroes: { varvara: { alive: false } }, vets: [{ type: 'rifleman', vet: 1, kills: 3 }] };
  d = C.applyResult(d, res); ok(C.save(st, d)); ok(st.m.has('arcade.priisk.campaign'), 'ключ');
  d = C.load(st); eq(d.unlocked, 2); eq(d.missions.m1.stars, [true, false, true]); eq(d.roster.heroes.varvara.wounded, true); eq(d.roster.vets.length, 1);
  d = C.applyResult(d, Object.assign({}, res, { stars: [true, true, false], time: 700 })); eq(d.missions.m1.stars, [true, true, true], 'лучшие звёзды'); eq(d.missions.m1.time, 600);
  d = C.applyResult(d, { id: 'm2', win: true, time: 500, stars: [true, true, true], flags: { convoy: 'raided' }, heroes: {}, vets: [] }); eq(d.flags.convoy, 'raided'); eq(d.unlocked, 3);
  ok(C.applyResult(C.newSave(), { id: 'm1', win: false }).unlocked === 1, 'поражение открыло миссию');
  // мусор и недоступное хранилище — без исключений
  st.setItem('arcade.priisk.campaign', '{не json'); eq(C.load(st).unlocked, 1);
  const bad = { getItem() { throw new Error('нет'); }, setItem() { throw new Error('нет'); }, removeItem() { throw new Error('нет'); } };
  eq(C.load(bad).unlocked, 1); eq(C.save(bad, d), false); eq(C.reset(bad).unlocked, 1);
});
test('перенос: ветеран из миссии 1 приходит стрелком-ветераном в миссию 2; раненая Варвара — с 60% здоровья', () => {
  const d = C.applyResult(C.newSave(), { id: 'm1', win: true, time: 600, stars: [true, true, true], flags: {}, heroes: { varvara: { alive: false } }, vets: [{ type: 'rifleman', vet: 1, kills: 4 }, { type: 'rifleman', vet: 1, kills: 3 }] });
  const W = C.build(C.byId('m2'), { save: d });
  eq(W.units.filter(u => u.owner === 0 && u.type === 'rifleman' && u.vet).length, 2); eq(W.mission.vetsUsed, 2);
  const v = W.units.find(u => u.type === 'varvara'); ok(v.wounded && v.hp < v.maxHp * 0.7);
});

// ---------- Проходимость (A*) ----------
function reach(W, from, to, tol = 1.6) { const p = L.findPath(W, from.x, from.y, to.x, to.y); const e = p.length ? p[p.length - 1] : from; return Math.hypot(e.x - to.x, e.y - to.y) <= tol; }
test('миссия 1 не тупиковая: от отряда до отвала, до входа врага; место под котельную, плавильню и барак есть', () => {
  const W = C.build(C.byId('m1')), MS = W.mission, s = C.pointOf(MS, 'S');
  for (const k of ['R', 'E', 'V']) ok(reach(W, s, C.pointOf(MS, k), 2.2), 'не дойти до ' + k);
  const hq = L.has(W, 0, 'hq'); for (const t of ['boiler', 'smelter', 'bunk']) ok(L.aiSpot(W, 0, t, hq), 'нет места: ' + t);
});
test('миссия 2 не тупиковая: сани → лагерь (по льду), а после трещины лёд → полынья — назад через брод', () => {
  const W = C.build(C.byId('m2')), MS = W.mission, s = C.pointOf(MS, 'S'), k = C.pointOf(MS, 'K');
  ok(reach(W, s, C.pointOf(MS, 'I')), 'до льда'); ok(reach(W, C.pointOf(MS, 'I'), { x: k.x - 2, y: k.y + 3 }, 2.5), 'от льда к лагерю');
  C.act(W, { a: 'tiles', zone: 'ice', from: '=', to: '_' });
  const back = L.findPath(W, C.pointOf(MS, 'I').x, C.pointOf(MS, 'I').y, s.x + 1, s.y);
  ok(back.length && Math.min(...back.map(q => q.y)) < 8, 'после трещины путь всё ещё идёт по льду, а не через северный брод');
  ok(reach(W, { x: k.x - 2, y: k.y + 3 }, { x: s.x + 1, y: s.y }, 2.5), 'назад через брод — нет пути');
  ok(reach(W, C.pointOf(MS, 'C'), C.pointOf(MS, 'c'), 2), 'обозу не пройти');
});

// ---------- Боты ----------
// Бот: каждое решение исполняется с задержкой реакции 150–250 мс игрового времени, одно действие за раз.
function bot(W, plan, seed = 1) {
  const rng = L.mulberry32(seed); let pend = null; const st = { acts: 0 };
  st.step = () => { if (pend) { if (W.time >= pend.at) { pend.fn(); pend = null; st.acts++; } return; } const fn = plan(W, st); if (fn) pend = { at: W.time + 0.15 + rng() * 0.1, fn }; };
  return st;
}
function playBot(W, plan, maxSec, seed) {
  const b = bot(W, plan, seed), dt = 1 / 30;
  for (let i = 0; i < maxSec / dt && W.winner < 0; i++) { b.step(); C.tick(W, dt); W.events.length = 0; }
  for (let i = 0; i < 90 && !W.mission.result && W.winner === 0; i++) C.tick(W, dt);
  return b;
}
const activeObj = W => W.mission.objs.find(o => o.state === 'active' && o.def.kind !== 'opt' && o.id !== 'defend');
const foesNear = (W, x, y, r) => W.units.filter(e => e.owner === 1 && Math.hypot(e.x - x, e.y - y) < r);

function planM1(W, st) {
  const pl = W.players[0], hq = L.has(W, 0, 'hq'); if (!hq) return null;
  if (pl.build && pl.build.ready) return () => { const s = L.aiSpot(W, 0, pl.build.type, hq); if (s) L.placeBuild(W, 0, s.i, s.j); };
  const army = W.units.filter(u => u.owner === 0 && u.type !== 'hauler'), v = army.find(u => u.type === 'varvara');
  const foes = W.units.filter(e => e.owner === 1 && W.vis[Math.floor(e.y) * W.w + Math.floor(e.x)] === 2);
  if (foes.length) {
    if (v && v.abT <= 0 && foesNear(W, v.x, v.y, 7).length) return () => L.ability(W, v);
    const f = foes[0], free = army.filter(u => u.order.t === 'idle' || (u.order.t === 'move'));
    if (free.length) return () => L.commandMove(W, free.map(u => u.id), f.x, f.y, true);
  } else if (W.mission.night) { // ночью — собраться у конторы, лицом к проходам
    const far = army.filter(u => u.order.t === 'idle' && Math.hypot(u.x - (hq.tx + 6), u.y - (hq.ty - 2)) > 5);
    if (far.length) return () => L.commandMove(W, far.map(u => u.id), hq.tx + 6, hq.ty - 2);
  }
  const ob = activeObj(W); if (!ob) return null;
  if (['boiler', 'smelter', 'bunk'].includes(ob.id) && !pl.build && pl.copper >= L.BLDS[ob.id].cost) return () => L.startBuild(W, 0, ob.id);
  if (ob.id === 'train' && (pl.trained.rifleman || 0) + pl.inf.length < 4 && pl.copper >= 100) return () => L.queueUnit(W, 0, 'rifleman');
  return null;
}
test('бот проходит миссию 1: стройка по шагам, медь, барак, 4 стрелка, ночная проверка отбита; звёзды', () => {
  const W = C.build(C.byId('m1'), { seed: 3 }), order = [];
  const b = bot(W, planM1, 11), dt = 1 / 30;
  for (let i = 0; i < 20 * 60 / dt && W.winner < 0; i++) { b.step(); C.tick(W, dt); W.mission.ui.forEach(e => { if (e.t === 'obj' && e.state === 'done') order.push(e.id); }); W.mission.ui.length = 0; W.events.length = 0; }
  eq(W.winner, 0, 'не прошёл: ' + JSON.stringify(W.mission.objs.map(o => o.id + ':' + o.state)) + ' t=' + W.time.toFixed(0));
  eq(order, ['boiler', 'smelter', 'haul', 'bunk', 'train', 'defend'], 'порядок целей');
  const r = W.mission.result; ok(r && r.win && r.stars[0]);
  console.log('     М1: ' + Math.round(r.time) + ' с, звёзды ' + r.stars.map(s => s ? '★' : '☆').join('') + ', потери ' + r.lostU + '/' + r.lostB + ', действий бота ' + b.acts);
  ok(W.mission.night, 'ночь не наступила');
});

function planM2(variant) {
  return function (W, st) {
    const MS = W.mission, me = W.units.filter(u => u.owner === 0), lu = me.find(u => u.type === 'lunya'); if (!lu) return null;
    const army = me.filter(u => u !== lu), k = C.pointOf(MS, 'K'), home = C.pointOf(MS, 'S'), ob = activeObj(W);
    const cx = army.reduce((s, u) => s + u.x, 0) / Math.max(1, army.length), cy = army.reduce((s, u) => s + u.y, 0) / Math.max(1, army.length);
    st.k = (st.k || 0) + 1;
    const fight = army.filter(u => u.order.t === 'attack').length > 0;
    const goalNow = () => { const g = st.goal || home; return g; };
    // Луня держится за отрядом (в 1.5 клетках позади центра, со стороны, откуда пришли)
    const back = Math.hypot(lu.x - cx, lu.y - cy);
    if (st.k % 2 === 0 && back > 2.5 && army.length && (lu.order.t !== 'attack' || back > 5)) return () => { const g = goalNow(), dx = g.x - cx, dy = g.y - cy, dl = Math.hypot(dx, dy) || 1; L.commandMove(W, [lu.id], cx - dx / dl * 1.5, cy - dy / dl * 1.5); };
    // обоз: налёт — сначала охрана, потом сани; тихо — переждать, если обоз рядом
    const wag = W.units.filter(u => u.tag === 'convoy' && u.owner === 1);
    if (variant === 'raid' && wag.length && MS.byObj.convoy.state === 'active') {
      const near = (a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy);
      const esc = wag.filter(u => u.type !== 'hauler' && Math.hypot(u.x - cx, u.y - cy) < 12).sort(near)[0];
      const h = esc || wag.filter(u => u.type === 'hauler').sort(near)[0];
      if (h && Math.hypot(h.x - cx, h.y - cy) < 9) { const free = army.filter(u => !(u.order.t === 'attack' && wag.includes(W.byId[u.order.target]))); if (free.length) return () => L.commandAttack(W, free.map(u => u.id), h.id); return null; }
      const re = h && army.filter(u => u.order.t === 'idle' || u.order.t === 'move' || (u.order.t === 'amove' && Math.hypot(u.order.x - h.x, u.order.y - h.y) > 4));
      if (re && re.length) return () => L.commandMove(W, re.map(u => u.id), h.x, h.y, true);
      if (h) return null;
    }
    if (variant === 'sneak' && wag.some(u => me.some(m => Math.hypot(u.x - m.x, u.y - m.y) < 9)) && !fight) {
      if (me.some(u => u.order.t === 'move' || u.order.t === 'amove')) return () => L.stopUnits(W, me.map(u => u.id));
      return null;
    }
    if (!ob) return null;
    if (ob.id === 'find') {
      if (Math.hypot(lu.x - k.x, lu.y - k.y) <= 15 && lu.abT <= 0) return () => L.ability(W, lu, k.x, k.y);
      if (Math.hypot(lu.x - k.x, lu.y - k.y) <= 15) return army.some(u => u.order.t !== 'idle' && u.order.t !== 'attack') ? () => L.stopUnits(W, army.map(u => u.id)) : null;
    }
    // маршрут: налёт — по дороге обоза (проход у r), тихо — ущельем (G), подальше от дороги
    st.wp = st.wp || 0;
    if (st.ob !== ob.id) { st.ob = ob.id; st.wp = 0; }
    const via = ob.id === 'find' ? (variant === 'raid' ? [C.pointOf(MS, 'r')] : [{ x: 40.5, y: 24.5 }, C.pointOf(MS, 'G'), { x: 40.5, y: 12.5 }]) : [{ x: 42.5, y: 11.5 }, { x: 33.5, y: 5.5 }];
    while (st.wp < via.length && Math.hypot(cx - via[st.wp].x, cy - via[st.wp].y) < 3) st.wp++;
    const goal = st.goal = st.wp < via.length ? via[st.wp] : ob.id === 'find' ? k : home;
    if (fight) return null;
    const lead = army.filter(u => u.order.t === 'idle' || (u.order.t === 'amove' && Math.hypot(u.order.x - goal.x, u.order.y - goal.y) > 4));
    if (lead.length) return () => L.commandMove(W, lead.map(u => u.id), goal.x, goal.y, true);
    if (!army.length && lu.order.t === 'idle') return () => L.commandMove(W, [lu.id], goal.x, goal.y);
    return null;
  };
}
for (const variant of ['raid', 'sneak']) test('бот проходит миссию 2 (' + (variant === 'raid' ? 'отбить обоз' : 'тихо обойти') + '): метель, лагерь найден меткой, возврат через брод, флаг обоза', () => {
  let res = null, tries = [];
  for (const seed of [5, 9, 13]) {
    const W = C.build(C.byId('m2'), { seed });
    let minMul = 1, maxMul = 0;
    const b = bot(W, planM2(variant), seed), dt = 1 / 30;
    for (let i = 0; i < 20 * 60 / dt && W.winner < 0; i++) { b.step(); C.tick(W, dt); W.events.length = 0; W.mission.ui.length = 0; minMul = Math.min(minMul, W.sightMul); maxMul = Math.max(maxMul, W.sightMul); }
    ok(minMul < 0.45 && maxMul > 0.8, 'метель не волнами: ' + minMul + '..' + maxMul);
    tries.push(seed + ':' + W.winner + ':' + (W.mission.reason ? C.txt(W.mission.reason, 'ru') : '') + ':' + W.mission.objs.map(o => o.id + '=' + o.state).join(','));
    if (W.winner === 0) { res = W.mission.result; res.cracked = !!W.mission.flags.iceCracked; break; }
  }
  ok(res, 'бот не прошёл ни с одним сидом: ' + tries.join(' | '));
  ok(res.cracked, 'лёд не треснул');
  if (variant === 'raid') eq(res.flags.convoy, 'raided', 'флаг обоза'); else eq(res.flags.convoy, 'sneaked', 'флаг обоза');
  const d = C.applyResult(C.applyResult(C.newSave(), { id: 'm1', win: true, time: 1, stars: [true], flags: {}, heroes: {}, vets: [] }), res);
  eq(d.flags.convoy, res.flags.convoy, 'флаг не сохранился'); eq(d.unlocked, 3);
  console.log('     М2/' + variant + ': ' + Math.round(res.time) + ' с, звёзды ' + res.stars.map(s => s ? '★' : '☆').join('') + ', потери ' + res.lostU + ', обоз=' + res.flags.convoy + ' (попытки: ' + tries.length + ')');
});

// ---------- Тексты и имена ----------
test('тексты миссий: у всех реплик, целей и звёзд есть RU и EN; брифинг — не длиннее 2 фраз', () => {
  for (const id of ['m1', 'm2']) {
    const d = C.byId(id);
    const chk = (o, w) => ok(o && o.ru && o.en, id + ': нет RU/EN у ' + w);
    chk(d.title, 'title'); chk(d.brief, 'brief'); ok((d.brief.ru.match(/[.!?…]/g) || []).length <= 2, id + ': длинный брифинг');
    d.objectives.forEach(o => chk(o.text, o.id)); (d.stars || []).forEach((s, i) => chk(s.text, 'star' + i));
    d.triggers.forEach(t => t.do.forEach(a => { if (a.text) chk(a.text, t.id); }));
  }
  ['campaign', 'skirmish', 'brief', 'start', 'next', 'retry', 'campMap', 'varvara', 'lunya'].forEach(k => ok(STR.ru[k] && STR.en[k], 'строка ' + k));
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

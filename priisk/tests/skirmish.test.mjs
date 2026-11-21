/* ПРИИСК · tests/skirmish.test.mjs — реиграбельность скирмиша (Node, без зависимостей, ~1–2 мин).
   Запуск: node priisk/tests/skirmish.test.mjs
   Покрытие: уровни ИИ (Лёгкий / Обычный / Трудный: какой ИИ создаётся, ручки «Лёгкого», без бонусов меди у «Трудного»);
   ОТПЕЧАТКИ «Обычного» — состояние мира через 4–6 игровых минут совпадает с версией до уровней сложности (классика, ИИ против ИИ,
   против ИИ-Сизых, за Сизых; 3 сида); карты (генерируемая не изменилась, три рукотворные: размеры, центральная симметрия клеток и
   меди, базы на симметричных местах, путь от конторы до конторы, вся медь достижима, гребни под ветряки у обеих баз, обе стороны и
   ИИ-Сизые ставятся); короткие партии ИИ против ИИ на каждой карте (доигрывают до победы < 25 мин); пат (медь не идёт —
   все в бой; в миссиях — никогда); достижения (правила, no-op без хука, хук издания, повтор не уходит, учёт карт).
   Таблицы побед «ИИ против ИИ» (10 сидов, обе стороны) — tests/skirmish-ai.test.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
function boot(extra = {}) {
  const sb = Object.assign({ console, Math, setTimeout, clearTimeout, Date }, extra); sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  for (const f of ['js/i18n.js', 'js/game.js', 'js/achieve.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  return sb.PRIISK;
}
const P = boot(), L = P.logic;

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
// партия ИИ против ИИ: владелец 0 — ИИ уровня l0 (L.aiTick), владелец 1 — ИИ мира уровня l1
function duel(seed, l0, l1, extra = {}, maxMin = 25, dt = 1 / 20) {
  const W = L.newWorld(Object.assign({ seed, level: l1 }, extra)), A0 = L.makeAI(W, 0, l0);
  for (let i = 0, n = Math.round(maxMin * 60 / dt); i < n && W.winner < 0; i++) { L.aiTick(W, dt, A0); L.step(W, dt); W.events.length = 0; }
  return W;
}

// ---------- уровни ----------
test('уровни: easy / normal / hard; без уровня — «Обычный» как раньше (объект ИИ без lvl, newAI)', () => {
  eq(L.AI_LEVELS, ['easy', 'normal', 'hard']);
  const W0 = L.newWorld({ seed: 3 }), W1 = L.newWorld({ seed: 3, level: 'normal' }), Wn = L.newAI(L.newWorld({ seed: 3, ai: false }), 1);
  eq(Object.keys(W0.ai).sort(), Object.keys(Wn).sort(), 'поля ИИ без уровня');
  ok(W0.ai.lvl === undefined && W1.ai.lvl === undefined && !W0.ai.hard, 'у «Обычного» нет ручек');
  const We = L.newWorld({ seed: 3, level: 'easy' }), Wh = L.newWorld({ seed: 3, level: 'hard' });
  eq([We.ai.lvl, We.ai.tick, We.ai.haul, We.ai.noIron, We.ai.nextWave, We.ai.waveSize], ['easy', 2, 1, true, 420, 3], 'ручки «Лёгкого»');
  ok(Wh.ai.hard && Wh.ai.lvl === 'hard', '«Трудный» — свой ИИ');
  // ИИ-Сизые и скирмиш за Сизых тоже знают уровень
  const Sz = L.newWorld({ seed: 3, foe: 'sizye', level: 'hard' }), Se = L.newWorld({ seed: 3, foe: 'sizye', level: 'easy' }), Cs = L.newWorld({ seed: 3, side: 'sizye', level: 'hard' });
  ok(Sz.ai.sz && Sz.ai.micro && Sz.ai.lvl === 'hard', 'ИИ-Сизые «Трудный»: фокус огня');
  ok(Se.ai.sz && Se.ai.tick === 2 && Se.ai.nextWave === 720, 'ИИ-Сизые «Лёгкий»');
  ok(Cs.ai.hard && L.facOf(Cs, 1) === 'copper', 'за Сизых: ИИ Медного Ключа «Трудный»');
});
test('«Трудный» без бонусов: стартовая медь, отряд, цены и скорость производства — как у игрока', () => {
  const W = L.newWorld({ seed: 4, level: 'hard' });
  eq(W.players[1].copper, W.players[0].copper, 'медь');
  eq(W.units.filter(u => u.owner === 1).map(u => u.type).sort(), W.units.filter(u => u.owner === 0).map(u => u.type).sort(), 'отряд');
  const p = W.players[1], c0 = p.copper;
  for (let i = 0; i < 20 * 240; i++) { L.step(W, 1 / 20); W.events.length = 0; }
  ok(p.mined > 0 && p.copper <= c0 + p.mined + 1e-6, 'медь только добычей: ' + p.copper + ' ≤ ' + c0 + ' + ' + p.mined);
});

// ---------- отпечатки «Обычного» (до уровней сложности) ----------
const FP = { idle1: '3fa13b82', duel1: '85fab87f', foe1: '720151cc', side1: '5684fd7e', idle2: 'fc2f3ab', duel2: '3adef18a', foe2: '24f85478', side2: '64deeaa2', idle3: '2b9c3d59', duel3: '8f46b7b5', foe3: 'c3e68fa8', side3: '88c53a3b' };
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }
function snap(W) { return JSON.stringify([W.time.toFixed(2), W.units.map(u => [u.type, u.owner, u.x.toFixed(3), u.y.toFixed(3), Math.round(u.hp)]), W.blds.map(b => [b.type, b.owner, b.tx, b.ty, Math.round(b.hp)]), W.players.slice(0, 2).map(p => [Math.round(p.copper), p.mined, p.kills]), W.winner]); }
test('отпечатки «Обычного»: классика, ИИ против ИИ, против ИИ-Сизых, за Сизых — как до изменений (3 сида, 4–6 минут)', () => {
  const got = {};
  for (const seed of [1, 2, 3]) for (const mode of ['idle', 'duel', 'foe', 'side']) {
    const W = L.newWorld({ seed, foe: mode === 'foe' ? 'sizye' : undefined, side: mode === 'side' ? 'sizye' : undefined });
    const A0 = mode === 'duel' ? L.newAI(W, 0) : null, dt = 1 / 30, n = (mode === 'duel' || mode === 'idle' ? 360 : 240) * 30;
    let h = fnv(snap(W));
    for (let i = 0; i < n && W.winner < 0; i++) { if (A0) L.aiStep(W, dt, A0); L.step(W, dt); if (i % 900 === 899) h = fnv(h + snap(W)); }
    got[mode + seed] = h;
  }
  eq(got, FP);
});

// ---------- карты ----------
test('карты: gen + три рукотворные; генерируемая с map: "gen" — та же, что без карты', () => {
  eq(L.SK_MAPS, ['gen', 'pass', 'isles', 'veins']);
  const a = L.newWorld({ seed: 11, ai: false }), b = L.newWorld({ seed: 11, map: 'gen', ai: false });
  eq(Array.from(a.t).join(''), Array.from(b.t).join('')); eq(Array.from(a.ore).join(','), Array.from(b.ore).join(','));
  eq([a.w, a.h], [64, 48]);
});
for (const map of ['pass', 'isles', 'veins']) {
  test(`карта ${map}: размер, центральная симметрия (клетки, медь, базы), путь до соседа, вся медь достижима, гребни у баз`, () => {
    const W = L.newWorld({ seed: 1, map, ai: false }), D = L.SK_DEF[map];
    eq([W.w, W.h, W.map], [D.w, D.h, map]);
    for (let k = 0; k < W.w * W.h; k++) { const m = W.w * W.h - 1 - k; if (W.t[k] !== W.t[m] || W.ore[k] !== W.ore[m]) throw new Error('несимметрично в клетке ' + (k % W.w) + ',' + ((k / W.w) | 0)); }
    const h0 = W.blds.find(b => b.owner === 0 && b.type === 'hq'), h1 = W.blds.find(b => b.owner === 1 && b.type === 'hq');
    eq([h1.tx, h1.ty], [W.w - h0.tx - 3, W.h - h0.ty - 3], 'базы');
    const r = L.skReach(W); ok(r.ok, 'достижимость ' + JSON.stringify(r));
    let ore = 0; for (let k = 0; k < W.w * W.h; k++) ore += W.ore[k];
    ok(ore > 30000, 'меди мало: ' + ore);
    // старт: свой отряд стоит на земле
    W.units.forEach(u => ok(L.walkable(W.t[Math.floor(u.y) * W.w + Math.floor(u.x)]), 'юнит в скале'));
    // Сизые: у обеих баз есть место под ветряк (гребень)
    const Ws = L.newWorld({ seed: 1, map, side: 'sizye', ai: false }), Wf = L.newWorld({ seed: 1, map, foe: 'sizye', ai: false });
    ok(L.szMillSpot(Ws, 0, L.center(Ws.blds.find(b => b.owner === 0))), 'ветряк у базы игрока-Сизых');
    ok(L.szMillSpot(Wf, 1, L.center(Wf.blds.find(b => b.owner === 1))), 'ветряк у базы ИИ-Сизых');
    eq(Array.from(Ws.t).join(''), Array.from(W.t).join(''), 'карта та же при любой стороне');
  });
}
test('карты: короткие партии ИИ против ИИ («Обычный» и «Трудный» против «Обычного», Сизые) доигрывают до победы < 25 мин', () => {
  const rows = [];
  for (const map of ['pass', 'isles', 'veins']) {
    for (const [l0, l1, extra] of [['normal', 'normal', {}], ['hard', 'normal', {}], ['normal', 'normal', { foe: 'sizye' }]]) {
      const W = duel(2, l0, l1, Object.assign({ map }, extra));
      rows.push(`${map} ${l0}/${l1}${extra.foe ? '/Сизые' : ''}: ${W.winner}@${(W.time / 60).toFixed(1)}`);
      ok(W.winner >= 0, 'ничья: ' + rows[rows.length - 1]);
      ok(W.players[0].mined > 2000 && W.players[1].mined > 1000, 'не добывали: ' + map);
    }
  }
  console.log('     ' + rows.join(' · '));
});
test('пат скирмиша: медь не идёт 2 минуты и купить рудовоз не на что — ИИ ведёт всех на контору; в миссии — нет', () => {
  const W = L.newWorld({ seed: 5 }), A = W.ai;
  W.time = 400; W.players[1].copper = 100; A.minedV = W.players[1].mined; A.minedT = 250;
  const hq0 = W.blds.find(b => b.owner === 0 && b.type === 'hq');
  A.t = 0; A.nextWave = 1e9; L.aiStep(W, 0.1, A);
  const army = W.units.filter(u => u.owner === 1 && u.type !== 'hauler');
  ok(army.length && army.every(u => u.wave && Math.hypot(u.order.x - hq0.tx - 1, u.order.y - hq0.ty - 1) < 4), 'не пошли');
  const W2 = L.newWorld({ seed: 5 }); W2.mission = {}; W2.time = 400; W2.players[1].copper = 100; W2.ai.minedV = 0; W2.ai.minedT = 0; W2.ai.t = 0; W2.ai.nextWave = 1e9;
  L.aiStep(W2, 0.1, W2.ai); ok(!W2.units.some(u => u.owner === 1 && u.wave), 'в миссии пата нет');
});

// ---------- достижения ----------
function fakeWin(o = {}) {
  const W = L.newWorld({ seed: 2, side: o.side, foe: o.foe, ai: false }); W.winner = 0; W.time = o.time != null ? o.time : 700; W.players[0].lostB = o.lostB || 0; return W;
}
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; }
test('достижения: на сайте хука нет — вызовы no-op (не падают), в журнале — что открыто бы было', () => {
  const Q = boot(); ok(!Q.Edition || !Q.Edition.achieve, 'хука нет');
  const got = Q.achieve.skirmish(fakeWin(), { map: 'gen', level: 'normal', store: mem() });
  eq(got, ['ACH_SK_COPPER', 'ACH_SK_NOLOSS'], 'классика за 11,7 мин без потерь зданий');
  eq(Q.achieve.log, got);
});
test('достижения скирмиша: сторона, против ветра, трудный, быстро, без потерь, все карты (учёт в arcade.priisk.skirmish)', () => {
  const calls = [], Q = boot(); Q.Edition = { achieve: id => calls.push(id) };
  const st = mem();
  eq(Q.achieve.skirmish(fakeWin({ lostB: 1 }), { map: 'gen', level: 'normal', store: st }), ['ACH_SK_COPPER']);
  eq(Q.achieve.skirmish(fakeWin({ foe: 'sizye', time: 590, lostB: 1 }), { map: 'pass', level: 'hard', store: st }), ['ACH_SK_VS_WIND', 'ACH_SK_HARD', 'ACH_SK_FAST']);
  eq(Q.achieve.skirmish(fakeWin({ side: 'sizye', lostB: 0 }), { map: 'isles', level: 'easy', store: st }), ['ACH_SK_SIZYE', 'ACH_SK_NOLOSS']);
  eq(JSON.parse(st.m['arcade.priisk.skirmish']).maps, { gen: 1, pass: 1, isles: 1 });
  eq(Q.achieve.skirmish(fakeWin({ lostB: 2 }), { map: 'veins', level: 'normal', store: st }), ['ACH_SK_ALL_MAPS'], 'четвёртая карта');
  eq(Q.achieve.skirmish(fakeWin({ lostB: 2 }), { map: 'gen:last', level: 'normal', store: st }), [], 'повтор в том же запуске в мост не уходит');
  eq(calls, ['ACH_SK_COPPER', 'ACH_SK_VS_WIND', 'ACH_SK_HARD', 'ACH_SK_FAST', 'ACH_SK_SIZYE', 'ACH_SK_NOLOSS', 'ACH_SK_ALL_MAPS']);
  const W = fakeWin(); W.winner = 1; eq(Q.achieve.skirmish(W, { store: st }), [], 'поражение — ничего');
  const Wm = fakeWin(); Wm.mission = {}; eq(Q.achieve.skirmish(Wm, { store: st }), [], 'миссия — не скирмиш');
  // хук бросил исключение — игра не ломается
  const R = boot(); R.Edition = { achieve: () => { throw new Error('мост'); } }; eq(R.achieve.skirmish(fakeWin(), { map: 'gen', store: null }), ['ACH_SK_COPPER', 'ACH_SK_NOLOSS']);
});
test('достижения кампаний: первая миссия, финалы, эпилог, все звёзды (только если финал в сборке), свои — из def.achieve', () => {
  const calls = [], Q = boot(); Q.Edition = { achieve: id => calls.push(id) };
  const m1 = { id: 'm1', n: 1, stars: [{}, {}] }, m2 = { id: 'm2', n: 2, stars: [{}], achieve: [{ id: 'ACH_M2_SNEAK', flags: { convoy: 'sneaked' } }] };
  const m3 = { id: 'm3', n: 3, finale: {}, stars: [{}, {}] }, s8 = { id: 's8', n: 8, camp: 'sizye', stars: [{}, {}], achieve: [{ id: 'ACH_S8_ROPE', star: 1 }] };
  const data = { missions: { m1: { stars: [true, true, true] } } };
  eq(Q.achieve.mission({ id: 'm1', win: true, stars: [true, true, true], flags: {} }, m1, data, [m1]), ['ACH_M1'], 'демо (финала нет) — без «все звёзды»');
  eq(Q.achieve.mission({ id: 'm2', win: true, stars: [true, false], flags: { convoy: 'escaped' } }, m2, data, [m1, m2, m3]), []);
  eq(Q.achieve.mission({ id: 'm2', win: true, stars: [true, true], flags: { convoy: 'sneaked' } }, m2, data, [m1, m2, m3]), ['ACH_M2_SNEAK']);
  data.missions.m2 = { stars: [true, true] }; data.missions.m3 = { stars: [true, true, false] };
  eq(Q.achieve.mission({ id: 'm3', win: true, stars: [true, true, false], flags: {} }, m3, data, [m1, m2, m3]), ['ACH_COPPER_DONE'], 'не все звёзды');
  data.missions.m3.stars[2] = true;
  eq(Q.achieve.mission({ id: 'm3', win: true, stars: [true, true, true], flags: {} }, m3, data, [m1, m2, m3]), ['ACH_COPPER_STARS'], 'все звёзды; финал уже открыт');
  eq(Q.achieve.mission({ id: 's8', win: false, stars: [false, false, true], flags: {} }, s8, {}, [s8]), [], 'поражение');
  eq(Q.achieve.mission({ id: 's8', win: true, stars: [true, false, true], flags: {} }, s8, {}, [s8]), []);
  eq(Q.achieve.mission({ id: 's8', win: true, stars: [true, true, true], flags: {} }, s8, {}, [s8]), ['ACH_S8_ROPE']);
  eq(Q.achieve.mission({ id: 'e1', win: true, stars: [true], flags: {} }, { id: 'e1', n: 1, camp: 'both', finale: {} }, {}, []), ['ACH_EPILOGUE']);
  eq(Q.achieve.IDS.length, 16, '16 достижений'); ok(calls.every(id => Q.achieve.IDS.includes(id)));
});
test('достижения: id совпадают со списком для Steamworks (docs/steam/priisk/achievements.md, если есть приватное дерево)', () => {
  const doc = path.resolve(ROOT, '../../arcade-full/docs/steam/priisk/achievements.md');
  if (!fs.existsSync(doc)) { console.log('     (нет arcade-full — пропуск)'); return; }
  const ids = [...fs.readFileSync(doc, 'utf8').matchAll(/^\|\s*`(ACH_[A-Z0-9_]+)`/gm)].map(m => m[1]);
  eq(ids.slice().sort(), P.achieve.IDS.slice().sort());
});

for (const [name, fn] of queue) {
  try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n     ')); }
}
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

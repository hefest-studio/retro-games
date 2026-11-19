/* ПРИИСК · tests/campaign.test.mjs — кампания публичной (демо) сборки: парсер ASCII-карт, условия/триггеры/действия,
   сценарный ИИ, герои, сохранение прогресса (localStorage-ключ arcade.priisk.campaign), бот проходит миссию 1 (реакция 150–250 мс,
   цели по порядку), миссия 1 не тупиковая (A*), тексты RU/EN; издание: флаг сборки, реестр миссий без m2, замочки 2–10, экран демо.
   Общий код для миссий полной версии (укрепления, ремонт, механик, поезд/колонна, мост, смена карты, if/carry/when; для миссий 7–8 —
   союзник, пожар и вода, захват инженером, многочастная громада и приманка под гейзер) — на мини-картах.
   Тесты миссий 2+ — в приватной полной сборке (arcade-full/priisk/tests/campaign-full.test.mjs). Стоп-лист имён — в engine.test.mjs.
   Запуск: node priisk/tests/campaign.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadGame, test, eq, ok, runAll, memStore, helpers } from './lib.mjs';

const G = loadGame();
const { P, L, C, STR } = G;
const { tickN, tiny, reach, bot, activeObj, foesNear, checkTexts, checkMap } = helpers(G);

// ---------- Парсер ----------
test('парсер: размеры, клетки (скала/вода/лёд/полынья/медь), точки; кривая строка — ошибка', () => {
  const m = C.parseMap(['#.~=_', '#oOAa', '#####'], { a: 'o' });
  eq([m.w, m.h], [5, 3]);
  eq([...m.t.slice(0, 5)], [L.ROCK, L.GROUND, L.WATER, L.ICE, L.OPEN]);
  eq([m.ore[6], m.ore[7], m.ore[8], m.ore[9]], [300, 500, 0, 300], 'медь и точка-с-легендой');
  eq(m.points.A, [{ i: 3, j: 1 }]); eq(m.points.a, [{ i: 4, j: 1 }]);
  let threw = false; try { C.parseMap(['###', '##']); } catch (e) { threw = true; } ok(threw, 'не поймали кривую строку');
});
test('парсер: карта миссии 1 — прямоугольная, с рамкой из скал, все точки на проходимых клетках', () => { checkMap('m1'); });

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
test('герои: гибель Варвары в миссии 1 — не поражение (миссия её не требует)', () => {
  const W = C.build(C.byId('m1')); const v = W.units.find(u => u.type === 'varvara'); v.hp = 0; tickN(W, 0.5);
  eq(W.winner, -1, 'Варвара: поражение'); ok(W.mission.heroDead.varvara);
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
  d = C.applyResult(d, { id: 'm1', win: true, time: 650, stars: [true, true, true], flags: { claim: 'held' }, heroes: {}, vets: [] }); eq(d.flags.claim, 'held', 'флаги'); eq(d.unlocked, 2, 'в демо дальше миссии 2 не открывается');
  ok(C.applyResult(C.newSave(), { id: 'm1', win: false }).unlocked === 1, 'поражение открыло миссию');
  // мусор и недоступное хранилище — без исключений
  st.setItem('arcade.priisk.campaign', '{не json'); eq(C.load(st).unlocked, 1);
  const bad = { getItem() { throw new Error('нет'); }, setItem() { throw new Error('нет'); }, removeItem() { throw new Error('нет'); } };
  eq(C.load(bad).unlocked, 1); eq(C.save(bad, d), false); eq(C.reset(bad).unlocked, 1);
});

// ---------- Проходимость (A*) ----------
test('миссия 1 не тупиковая: от отряда до отвала, до входа врага; место под котельную, плавильню и барак есть', () => {
  const W = C.build(C.byId('m1')), MS = W.mission, s = C.pointOf(MS, 'S');
  for (const k of ['R', 'E', 'V']) ok(reach(W, s, C.pointOf(MS, k), 2.2), 'не дойти до ' + k);
  const hq = L.has(W, 0, 'hq'); for (const t of ['boiler', 'smelter', 'bunk']) ok(L.aiSpot(W, 0, t, hq), 'нет места: ' + t);
});

// ---------- Бот ----------
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

// ---------- Издание (демо) и реестр миссий ----------
test('издание: флаг сборки PRIISK_EDITION = demo в публичном дереве, ?demo / ?edition=full|demo, ссылка «Узнать больше»', () => {
  const E = P.Edition, src = fs.readFileSync(path.join(ROOT, 'js/edition.js'), 'utf8');
  ok(/var PRIISK_EDITION = 'demo';/.test(src), 'в публичном дереве флаг должен быть demo'); eq(E.BUILD, 'demo'); eq(P.EDITION, 'demo');
  ok(typeof E.MORE_URL === 'string' && E.MORE_URL === '../', 'ссылка «Узнать больше» → каталог');
  eq(E.resolve('', 'demo'), 'demo'); eq(E.resolve('', 'full'), 'full'); eq(E.resolve('?demo', 'full'), 'demo'); eq(E.resolve('?x=1&demo', 'full'), 'demo');
  eq(E.resolve('?edition=full', 'demo'), 'full'); eq(E.resolve('?edition=demo', 'full'), 'demo'); eq(E.resolve('?demolition', 'full'), 'full', 'ложное срабатывание');
  eq(E.playable('demo', 'm1'), true); eq(E.playable('demo', 'm2'), false); eq(E.playable('full', 'm2'), true);
  eq(E.stub('demo'), 'full'); eq(E.stub('full'), 'soon');
  eq(E.afterWin('demo', false, true), 'demo'); eq(E.afterWin('demo', true, true), 'next'); eq(E.afterWin('full', false, true), 'map'); eq(E.afterWin('demo', false, false), 'map');
  const d = E.finale('demo'), f = E.finale('full');
  eq(d.kind, 'demo'); eq(d.items.join(), 'toMap,more'); eq(f.kind, 'soon'); eq(f.items.join(), 'toMap');
  for (const k of ['demoTitle', 'demoSub', 'soonTitle', 'soonSub', 'more', 'toMap', 'lockedFull', 'lockedFullSub']) ok(STR.ru[k] && STR.en[k], 'строка ' + k);
  ok(/полной верси/i.test(STR.ru.demoTitle) && /full version/i.test(STR.en.demoTitle), 'текст экрана демо');
  ok(/полной верси/i.test(STR.ru.lockedFull) && /full version/i.test(STR.en.lockedFull), 'текст замочка');
  ok(!/[а-яё]/i.test(['demoTitle', 'demoSub', 'soonTitle', 'soonSub', 'more', 'lockedFull', 'lockedFullSub'].map(k => STR.en[k]).join(' ')), 'кириллица в EN');
});
test('реестр миссий: в демо — только m1; файлов миссий 2+ в публичном дереве нет; index.html грузит миссии только через реестр', () => {
  eq(P.MISSION_FILES.demo, ['m1']); eq(P.missionFiles('demo'), ['m1']); ok(P.missionFiles('full').includes('m2'), 'full-список без m2');
  eq(P.MISSIONS.map(m => m.id), ['m1'], 'зарегистрированы лишние миссии'); eq(C.byId('m2'), null); eq(G.missing, []);
  const files = fs.readdirSync(path.join(ROOT, 'js/missions')).sort(); eq(files, ['index.js', 'm1.js'], 'лишние файлы в js/missions');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(!/missions\/m\d/.test(html), 'index.html подключает файл миссии напрямую'); ok(/js\/missions\/index\.js/.test(html), 'нет реестра в index.html');
  ok(html.indexOf('js/edition.js') < html.indexOf('js/missions/index.js') && html.indexOf('js/campaign.js') < html.indexOf('js/missions/index.js') && html.indexOf('js/missions/index.js') < html.indexOf('js/campaign-ui.js'), 'порядок скриптов');
  // упоминаний содержимого миссий 2+ в публичном коде нет (только названия на карте кампании)
  for (const f of ['js/campaign.js', 'js/campaign-ui.js', 'js/main.js', 'js/missions/m1.js']) ok(!/register\(\{\s*id: 'm2'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
});
test('нет файла миссии из списка сборки — игра не ломается: миссия пропущена, остальные на месте', () => {
  const G2 = loadGame({ build: 'full' });
  eq(G2.missing, G2.P.MISSION_FILES.full, 'файлы миссий 2+ не должны лежать в публичном дереве'); ok(G2.missing.includes('m2') && G2.missing.includes('m4'), 'реестр full: ' + G2.missing); eq(G2.P.MISSIONS.map(m => m.id), ['m1']);
  const W = G2.C.build(G2.C.byId('m1')); for (let i = 0; i < 30; i++) G2.C.tick(W, 1 / 30); eq(W.winner, -1);
});
test('сохранение из полной версии (открыта миссия 3) в демо не открывает миссию 2', () => {
  const st = memStore(); st.setItem(C.KEY, JSON.stringify({ v: 1, unlocked: 3, missions: { m1: { stars: [true], time: 1 }, m2: { stars: [true], time: 1 } }, flags: {}, roster: { heroes: {}, vets: [] } }));
  const d = C.load(st); eq(d.unlocked, 3); ok(!P.Edition.playable(P.EDITION, 'm2') && !C.byId('m2'), 'm2 доступна в демо');
});

// ---------- Тексты и имена ----------
test('тексты миссии 1: у всех реплик, целей и звёзд есть RU и EN; брифинг — не длиннее 2 фраз', () => {
  checkTexts('m1');
  ['campaign', 'skirmish', 'brief', 'start', 'next', 'retry', 'campMap', 'varvara', 'lunya'].forEach(k => ok(STR.ru[k] && STR.en[k], 'строка ' + k));
});

// ---------- общий код движка для миссий полной версии (укрепления, ремонт, механик, поезд, смена карты) — проверка на мини-картах ----------
const FORT_MAP = [
  '##############################',
  '#S...........................#',
  '#............................#',
  '#....................~~~~....#',
  '#.......H............====..E.#',
  '#....................====....#',
  '#....................~~~~....#',
  '#............................#',
  '#T...........................#',
  '##############################'];
function fortDef(extra = {}) {
  return Object.assign({ id: 'tf', n: 98, title: 'т', brief: 'т', map: FORT_MAP, zones: { ice: { x: 21, y: 4, w: 4, h: 2 }, east: { x: 25, y: 1, w: 4, h: 8 } },
    player: { copper: 1000, build: ['boiler', 'palisade', 'tower'], units: [], repair: true, start: [{ type: 'hq', at: 'H' }] }, enemy: { start: [] },
    objectives: [{ id: 'x', icon: 'eye', text: 'т', done: { t: 'time', gte: 9999 } }], triggers: [] }, extra);
}
test('укрепления (общий код): частокол/вышка ставятся до 7 клеток от своих зданий (обычные — до 4), частокол — не потеря здания, вышка стреляет', () => {
  const W = C.build(fortDef()), hq = W.blds[0];
  ok(L.FORT_LIST.join() === 'palisade,tower' && L.BUILD_LIST.indexOf('tower') < 0, 'укрепления попали в скирмиш');
  ok(L.canPlace(W, 0, 'palisade', hq.tx + 3 + 6, hq.ty), 'частокол в 6 клетках — нельзя');
  ok(!L.canPlace(W, 0, 'boiler', hq.tx + 3 + 6, hq.ty), 'котельная в 6 клетках — можно');
  const pal = L.addBuilding(W, 0, 'palisade', hq.tx + 5, hq.ty + 1); ok(!L.passable(W, pal.tx, pal.ty), 'частокол проходим');
  pal.hp = 0; tickN(W, 0.1); eq(W.players[0].lostB, 0, 'частокол — потеря здания'); eq(W.players[0].lost, 0);
  const tw = L.addBuilding(W, 0, 'tower', hq.tx + 4, hq.ty - 3), e = L.addUnit(W, 1, 'rifleman', tw.tx + 5, tw.ty + 1); e.order = { t: 'idle' };
  const h0 = e.hp; tickN(W, 1.5); ok(e.hp < h0 && tw.fireT > 0, 'вышка не стреляет');
});
test('ремонт зданий (общий код): за медь, до полной прочности; без меди встаёт; в скирмише закрыт', () => {
  const W = C.build(fortDef()), hq = W.blds[0], pl = W.players[0];
  ok(W.repairOn); eq(L.setRepair(W, hq, true), false, 'целое здание чинится');
  hq.hp = 1000; ok(L.setRepair(W, hq, true)); const c0 = pl.copper; tickN(W, 3);
  ok(hq.hp > 1100 && pl.copper < c0, 'не чинится за медь'); pl.copper = 0.5; tickN(W, 0.5); ok(!hq.repair, 'без меди не встал');
  pl.copper = 5000; L.setRepair(W, hq, true); tickN(W, 30); eq(hq.hp, hq.maxHp); ok(!hq.repair, 'не выключился на полной');
  ok(!L.newWorld({ seed: 2 }).repairOn, 'ремонт открыт в скирмише');
});
test('механик Сава (общий код): на месте чинит технику рядом, «Аврал» — быстро и с перезарядкой; пехоту не лечит', () => {
  const W = C.build(fortDef({ player: { copper: 0, build: [], units: [], start: [{ type: 'sava', at: 'S' }, { type: 'crawler', at: 'S' }, { type: 'rifleman', at: 'S' }] } }));
  const sa = W.units.find(u => u.type === 'sava'), cr = W.units.find(u => u.type === 'crawler'), rf = W.units.find(u => u.type === 'rifleman');
  ok(W.mission.heroes.sava, 'Сава не герой миссии'); cr.hp = 100; rf.hp = 20; tickN(W, 2); ok(cr.hp > 105 && rf.hp === 20, 'чинит не то: ' + cr.hp + ' / ' + rf.hp);
  const h = cr.hp; eq(L.ability(W, sa), 'ok'); tickN(W, 1); ok(cr.hp > h + 30, 'Аврал слабый'); eq(L.ability(W, sa), 'cd');
});
test('поезд и колонна (общий код): train — тягач + вагоны по следу; convoy с halt стоит, пока враг рядом; locked; prey — охота за тегом', () => {
  const W = C.build(fortDef({ player: { copper: 0, build: [], units: [], start: [{ type: 'train', at: 'H', tag: 'tr', wagons: 2, heading: 0, locked: true }] },
    groups: { tr: { owner: 0, mode: 'convoy', route: ['S'], halt: 5 } } }));
  const t = W.units.find(u => u.type === 'tractor'), ws = W.units.filter(u => u.type === 'wagon');
  eq(ws.length, 2); ok(t.locked && ws.every(w => w.locked && w.tag === 'tr'), 'не заперты/без тега'); eq(ws[0].tow, t.id); eq(ws[1].tow, ws[0].id);
  tickN(W, 4); ok(t.x < C.pointOf(W.mission, 'H').x - 2, 'тягач не едет');
  ws.forEach((w, i) => { const d = Math.hypot(w.x - (i ? ws[0] : t).x, w.y - (i ? ws[0] : t).y); ok(d > 0.8 && d < 1.7, 'сцепка ' + d); });
  const e = L.addUnit(W, 1, 'rifleman', t.x - 3, t.y); e.order = { t: 'idle' }; tickN(W, 1); const x0 = t.x; tickN(W, 1.5);
  ok(Math.abs(t.x - x0) < 0.05 && W.mission.groups.tr.halted, 'колонна не встала');
  C.act(W, { a: 'group', tag: 'hunt', owner: 1, mode: 'attack', prey: 'tr', target: 'T' }); e.tag = 'hunt'; e.order = { t: 'idle' }; tickN(W, 1);
  ok(e.order.t === 'attack' || (e.order.t === 'amove' && Math.hypot(e.order.x - t.x, e.order.y - t.y) < 4), 'prey: охотник идёт не к колонне');
});
test('смена карты (общий код): tiles перестраивает пути через исчезнувшие клетки; if/else; carry-флаги из сохранения; when у стартовых сил; условия hp и builtIn', () => {
  const def = fortDef({ carry: ['convoy'], flags: { convoy: 'sneaked' }, enemy: { start: [{ type: 'rifleman', at: 'E', n: 2, tag: 'r', when: { t: 'flag', key: 'convoy', value: 'raided' } }, { type: 'crawler', at: 'E', tag: 'c', when: { t: 'not', of: { t: 'flag', key: 'convoy', value: 'raided' } } }] } });
  const sv = C.newSave(); sv.flags.convoy = 'raided';
  const W = C.build(def, { save: sv }); eq(W.mission.flags.convoy, 'raided'); eq(W.units.filter(u => u.owner === 1).map(u => u.type).join(), 'rifleman,rifleman');
  const D = C.build(def); eq(D.mission.flags.convoy, 'sneaked'); eq(D.units.filter(u => u.owner === 1).map(u => u.type).join(), 'crawler');
  // путь по льду → лёд в полынью → путь в обход
  const u = L.addUnit(W, 0, 'rifleman', 26.5, 4.5); L.commandMove(W, [u.id], 18.5, 4.5); ok(u.path.length && u.path.every(q => q.y > 3 && q.y < 7), 'путь не по льду');
  C.act(W, { a: 'tiles', zone: 'ice', from: '=', to: '_' });
  ok(u.path.length && (Math.min(...u.path.map(q => q.y)) < 3 || Math.max(...u.path.map(q => q.y)) > 6), 'путь не перестроен в обход: ' + JSON.stringify(u.path));
  C.run(W, [{ a: 'if', when: { t: 'flag', key: 'convoy', value: 'raided' }, do: [{ a: 'flag', key: 'y', value: 1 }], else: [{ a: 'flag', key: 'y', value: 2 }] }]); eq(W.mission.flags.y, 1);
  C.run(D, [{ a: 'if', when: { t: 'flag', key: 'convoy', value: 'raided' }, do: [{ a: 'flag', key: 'y', value: 1 }], else: [{ a: 'flag', key: 'y', value: 2 }] }]); eq(D.mission.flags.y, 2);
  const hq = W.blds[0]; hq.tag = 'h'; hq.hp = hq.maxHp * 0.5; ok(C.cond(W, { t: 'hp', tag: 'h', lte: 0.5 }) && !C.cond(W, { t: 'hp', tag: 'h', gte: 0.9 }), 'условие hp');
  L.addBuilding(W, 0, 'palisade', 26, 2); ok(C.cond(W, { t: 'builtIn', type: 'palisade', zone: 'east' }) && !C.cond(W, { t: 'builtIn', type: 'tower', zone: 'east' }), 'условие builtIn');
});
test('мост (клетка «:»): проходим, tiles превращает его в полынью', () => {
  const W = C.build(fortDef({ map: FORT_MAP.map((r, j) => j === 4 || j === 5 ? r.replace('====', '::::') : r), zones: { br: { x: 21, y: 4, w: 4, h: 2 } } }));
  eq(W.t[4 * W.w + 22], L.BRIDGE); ok(L.walkable(L.BRIDGE)); C.act(W, { a: 'tiles', zone: 'br', from: ':', to: '_' }); eq(W.t[4 * W.w + 22], L.OPEN);
});

// ---------- общий код для миссий 5–6 полной версии (бур и вышка, заряды, договор, ИИ гонки, перенос зданий, подземный жар) ----------
const HEAT_MAP = [
  '##############################',
  '#S.........,,,,..........OOO.#',
  '#..........,,,,..........OOO.#',
  '#....H.....,11,..........OOO.#',
  '#..........,11,..............#',
  '#..........,,,,......g.....K.#',
  '#....OOO.......^.............#',
  '#....OOO.....................#',
  '#....OOO.....................#',
  '##############################'];
function heatDef(extra = {}) {
  return Object.assign({ id: 'th', n: 97, title: 'т', brief: 'т', map: HEAT_MAP, legend: { '1': ',' },
    zones: { stage1: { pts: ['1'] }, mid: { x: 11, y: 1, w: 4, h: 5 } }, treaty: true, race: { goal: 500 }, shaky: { dmg: 0.01 },
    geysers: { g: { at: 'g', r: 2, period: 10, warn: 3, dmg: 30 } },
    player: { copper: 2000, build: ['boiler', 'bunk', 'works'], units: ['rifleman', 'sapper', 'drill'], pack: true, start: [{ type: 'hq', at: 'H' }, { type: 'drill', at: 'S' }, { type: 'sapper', at: 'S' }, { type: 'rifleman', at: 'S', n: 2 }] },
    enemy: { copper: 2000, start: [{ type: 'hq', at: 'K', tag: 'kontora' }] },
    objectives: [{ id: 'x', icon: 'eye', text: 'т', done: { t: 'mined', gte: 500 } }], triggers: [] }, extra);
}
test('подземный жар (общий код): «,» — зыбкий грунт (проходим, строить нельзя, здания трещат), «^» — провал (непроходим); зона-точки pts', () => {
  const m = C.parseMap(['#.,^#'], {}); eq([...m.t], [L.ROCK, L.GROUND, L.SHAKY, L.PIT, L.ROCK]);
  ok(L.walkable(L.SHAKY) && !L.walkable(L.PIT), 'проходимость');
  const W = C.build(heatDef()); ok(!L.canPlace(W, 0, 'boiler', 11, 1) && !L.canDeploy(W, 0, 'boiler', 11, 1), 'на зыбком строится');
  eq(C.zoneCells(W, W.mission, 'stage1').length, 4); ok(C.inZone(W.mission, 'stage1', 12.5, 3.5) && !C.inZone(W.mission, 'stage1', 11.5, 3.5), 'inZone pts');
  // здание на зыбком трещит; провал под ним — гибнет
  const b = L.addBuilding(W, 0, 'boiler', 12, 3), h0 = b.hp; tickN(W, 3); ok(b.shaky && b.hp < h0 - 10, 'не трещит: ' + b.hp);
  C.act(W, { a: 'quake', zone: 'stage1', s: 2 }); eq(W.mission.warn.length, 1); tickN(W, 2.2); eq(W.mission.warn.length, 0, 'предупреждение не гаснет');
  C.act(W, { a: 'tiles', zone: 'stage1', to: '^' }); tickN(W, 0.1); ok(!W.byId[b.id] && W.players[0].lostB === 1, 'здание над провалом цело');
});
test('гейзер (общий код): предупреждение за warn с, выброс бьёт по области; burst — сценарный удар сразу', () => {
  const W = C.build(heatDef()), MS = W.mission, g = MS.geys.g, p = C.pointOf(MS, 'g'), u = L.addUnit(W, 0, 'rifleman', p.x + 1, p.y);
  let warnAt = -1, burstAt = -1; tickN(W, 12, 1 / 30, () => { if (g.warn && warnAt < 0) warnAt = W.time; if (g.n && burstAt < 0) burstAt = W.time; return g.n > 0; });
  ok(warnAt > 0 && burstAt - warnAt > 2.5 && burstAt - warnAt < 3.5, 'предупреждение: ' + warnAt + ' → ' + burstAt); ok(u.hp <= 31, 'урон: ' + u.hp);
  C.act(W, { a: 'geyser', id: 'g', on: false }); const n0 = g.n; tickN(W, 12); eq(g.n, n0, 'выключенный бьёт');
  C.act(W, { a: 'geyser', id: 'g', burst: true }); ok(g.on); tickN(W, 3.5); eq(g.n, n0 + 1, 'burst не ударил сразу');
});
test('бур и буровая вышка (общий код): разворот только на богатой жиле, качает медь сама, шумит (видно сквозь туман), сворачивается обратно в бур', () => {
  const W = C.build(heatDef()), d = W.units.find(u => u.type === 'drill'), pl = W.players[0];
  ok(!L.canDeploy(W, 0, 'rig', 2, 1), 'вышка без жилы'); const at = L.deploySpot(W, 0, 'rig', 6, 7); ok(at, 'на жиле нет места');
  L.commandDeploy(W, d.id, at.i, at.j); ok(tickN(W, 20, 1 / 30, () => W.blds.some(b => b.type === 'rig')), 'не развернулся');
  const rig = W.blds.find(b => b.type === 'rig'); ok(rig.setup > 0); const m0 = pl.mined; tickN(W, L.SETUP + 5);
  ok(pl.mined - m0 >= L.BLDS.rig.rate * 4, 'не качает: ' + (pl.mined - m0)); ok(C.cond(W, { t: 'mined', gte: 1 }));
  const er = L.addBuilding(W, 1, 'rig', 25, 1); W.vis.fill(0); L.updateVis(W); ok(L.visibleTo0(W, er), 'чужую вышку не слышно');
  const back = L.pack(W, rig); ok(back && back.type === 'drill' && !W.byId[rig.id], 'вышка не свернулась в бур');
  eq(L.BUILD_LIST.concat(L.UNIT_LIST).filter(t => t === 'rig' || t === 'drill' || t === 'sapper').length, 0, 'попало в скирмиш');
});
test('заряды (общий код): подрывник закладывает заряд с таймером, взрыв сносит вышку; свои рядом — обезвреживают; Контору заряжать нельзя', () => {
  const W = C.build(heatDef()), er = L.addBuilding(W, 1, 'rig', 25, 1), sp = W.units.find(u => u.type === 'sapper'), hq1 = L.has(W, 1, 'hq');
  ok(!L.canPlantOn(W, hq1), 'Контору можно заряжать'); eq(L.smartKind(W, 0, [sp.id], 26, 2, er), 'plant');
  sp.x = 23.5; sp.y = 2.5; L.commandPlant(W, [sp.id], er.id); ok(tickN(W, 6, 1 / 30, () => W.charges.length > 0), 'не заложил'); eq(W.charges[0].target, er.id);
  ok(tickN(W, L.CHARGE.timer + 1, 1 / 30, () => !W.byId[er.id]), 'не взорвалось'); ok(C.cond(W, { t: 'razed', owner: 1, type: 'rig' }), 'razed');
  const er2 = L.addBuilding(W, 1, 'rig', 25, 1), guard = L.addUnit(W, 1, 'rifleman', 25, 3.5); guard.order = { t: 'idle' }; guard.calm = true;
  sp.x = 24; sp.y = 1.5; L.commandPlant(W, [sp.id], er2.id); ok(tickN(W, 4, 1 / 30, () => W.charges.length > 0), 'второй не заложил');
  ok(tickN(W, 4, 1 / 30, () => !W.charges.length), 'охрана не обезвредила'); ok(W.byId[er2.id], 'взорвалось при охране');
});
test('договор и мирные (общий код): по зданиям пули не берут и сами по ним не стреляют, выстрел засчитан (hit); calm — не стреляют и по ним не стреляют', () => {
  const W = C.build(heatDef()), hq1 = L.has(W, 1, 'hq'), r = W.units.find(u => u.type === 'rifleman');
  r.x = hq1.tx - 2; r.y = hq1.ty + 1; r.order = { t: 'idle' }; tickN(W, 2); eq(W.hits['0:kontora'] || 0, 0, 'сам стреляет по зданию');
  L.commandAttack(W, [r.id], hq1.id); tickN(W, 2); ok(C.cond(W, { t: 'hit', by: 0, tag: 'kontora' }) && hq1.hp === hq1.maxHp, 'по договору пробил / не засчитал');
  const S = C.build(heatDef({ treaty: false })), h2 = L.has(S, 1, 'hq'), r2 = S.units.find(u => u.type === 'rifleman'); L.commandAttack(S, [r2.id], h2.id); r2.x = h2.tx - 2; r2.y = h2.ty + 1; tickN(S, 2); ok(h2.hp < h2.maxHp, 'без договора не пробивает');
  const c = L.addUnit(W, 1, 'rifleman', r.x, r.y + 1.5); c.calm = true; c.order = { t: 'idle' }; r.order = { t: 'idle' }; tickN(W, 3); ok(c.hp === c.maxHp && r.hp === r.maxHp, 'мирный в бою');
});
test('перенос зданий (общий код): свернуть → фургон (не работает, Контора жива) → развернуть где угодно на твёрдом → сборка → работает; фургон разбит — потеря здания', () => {
  const W = C.build(heatDef()), pl = W.players[0], b = L.addBuilding(W, 0, 'boiler', 7, 2); L.calcPower(W); const p0 = pl.pOut;
  ok(L.canPack(W, b)); const v = L.pack(W, b); ok(v.type === 'van' && v.packed.type === 'boiler' && pl.pOut === p0 - 20, 'фургон / пар');
  ok(L.canDeploy(W, 0, 'boiler', 20, 6) && !L.canPlace(W, 0, 'boiler', 20, 6), 'разворот не «где угодно»');
  L.commandDeploy(W, v.id, 20, 6); ok(tickN(W, 30, 1 / 30, () => !!L.has(W, 0, 'boiler')), 'не развернулся'); const nb = L.has(W, 0, 'boiler');
  eq(pl.pOut, p0 - 20, 'в сборке даёт пар'); tickN(W, L.SETUP + 0.3); eq(pl.pOut, p0, 'после сборки нет пара');
  const hv = L.pack(W, L.has(W, 0, 'hq')); ok(L.hqAlive(W, 0) && !L.has(W, 0, 'hq')); tickN(W, 1); eq(W.winner, -1, 'Контора в фургоне — поражение');
  const v2 = L.pack(W, nb); v2.hp = 0; tickN(W, 0.1); eq(pl.lostB, 1, 'разбитый фургон — не потеря здания');
  hv.hp = 0; tickN(W, 0.1); eq(W.winner, 1, 'разбили фургон с Конторой — не поражение');
  const S = C.build(heatDef({ player: Object.assign({}, heatDef().player, { pack: false }) })); ok(!L.canPack(S, L.has(S, 0, 'hq')), 'перенос без разрешения миссии');
});
test('ИИ гонки (общий код): ставит бур на свою жилу, держит охрану, ходит в набег подрывниками на вышку соперника, Контору не трогает', () => {
  const W = C.build(heatDef({ enemy: { copper: 3000, start: [{ type: 'hq', at: 'K', tag: 'kontora' }] } }));
  L.addBuilding(W, 1, 'boiler', 22, 7); L.addBuilding(W, 1, 'bunk', 19, 7); L.addBuilding(W, 1, 'works', 17, 1);
  C.act(W, { a: 'ai', mode: 'race', spots: [{ x: 26.5, y: 2.5 }], rigs: 1, haulers: 0, sappers: 2, escort: 1, guards: 1, first: 5, every: 40 });
  ok(W.ai && W.ai.race, 'ИИ гонки не включился'); eq(W.ai.spots.length, 1);
  const d = W.units.find(u => u.type === 'drill'), at = L.deploySpot(W, 0, 'rig', 6, 7); d.x = at.i + 1; d.y = at.j + 1; L.deployNow(W, d, at.i, at.j);
  let planted = 0; tickN(W, 120, 1 / 30, () => { if (W.charges.some(c => c.owner === 1)) planted++; return false; });
  ok(W.blds.some(b => b.owner === 1 && b.type === 'rig'), 'ИИ не поставил вышку'); ok(W.ai.raids > 0 && planted > 0, 'набега с зарядом не было');
  ok(W.units.some(u => u.owner === 1 && u.type === 'rifleman'), 'нет охраны'); eq(W.hits['1:kontora'] || 0, 0);
});

// ---------- Общий код миссий 7–8 полной версии: союзник, пожар и вода, захват, многочастная громада ----------
const WAR_MAP = [
  '########################################',
  '#S.......~~~......................OOO..#',
  '#........~~~..d.......1...........OOO..#',
  '#..H.....P...........RRR....g.....OOO..#',
  '#....................RRR...............#',
  '#..........q.........RRR..2.........B..#',
  '#......................................#',
  '#...A........K...........t.....E.......#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '########################################'];
function warDef(extra = {}) {
  return Object.assign({ id: 'tw', n: 96, title: 'т', brief: 'т', map: WAR_MAP, legend: { R: '.' },
    zones: { gate: { at: 'K', r: 2 }, mine: { at: '1', r: 7 } }, teams: [0, 1, 0], paint: { 2: 1 }, sand: 60,
    depots: { barrels: { at: 'd', w: 200 }, pile: { at: 'q', w: 9999, kind: 'sand' } },
    geysers: { g: { at: 'g', r: 2.4, period: 10, warn: 3, dmg: 30, on: false } },
    player: { copper: 1000, build: ['boiler', 'pump', 'tower'], units: ['rifleman', 'bowser', 'engineer', 'sapper', 'drill'],
      start: [{ type: 'hq', at: 'H' }, { type: 'boiler', at: 'A' }, { type: 'sava', at: 'S' }, { type: 'rifleman', at: 'S', n: 2 }, { type: 'bowser', at: 'S', n: 1, water: 100 }, { type: 'hauler', at: 'S', n: 1 }, { type: 'engineer', at: 'S', n: 1 }, { type: 'sapper', at: 'S', n: 1 }, { type: 'drill', at: 'S', n: 1 }] },
    enemy: { copper: 0, start: [{ type: 'shaft', at: 'R', tag: 'rudnik' }, { type: 'store', at: 't', tag: 'sstore', stock: 400 }, { type: 'rifleman', at: 'K', n: 2, tag: 'sz', calm: true }] },
    groups: { sz: { owner: 1, mode: 'hold' } },
    objectives: [{ id: 'fork', icon: 'ally', text: 'т' }, { id: 'hold', icon: 'clock', text: 'т', done: { t: 'since', obj: 'fork', gte: 5 } }],
    triggers: [{ id: 'help', when: { t: 'all', of: [{ t: 'zone', zone: 'gate' }, { t: 'not', of: { t: 'flag', key: 'alliance' } }] }, do: [{ a: 'flag', key: 'alliance', value: 'helped' }, { a: 'objective', id: 'fork', state: 'done' }, { a: 'owner', tag: 'sz', to: 2, calm: false }, { a: 'owner', tag: 'rudnik', to: 2 }, { a: 'paint', owner: 1, to: 3 }] }] }, extra);
}
test('союзник (общий код): развилка действием — юнит в зоне → owner; владелец 2 в команде игрока: не стреляем друг в друга, общий обзор, ПКМ по союзнику — «идти»; чужака бьют оба; цвет paint; since', () => {
  const W = C.build(warDef()), MS = W.mission, sz = W.units.filter(u => u.tag === 'sz'), r = W.units.find(u => u.type === 'rifleman' && u.owner === 0), shaft = W.blds.find(b => b.tag === 'rudnik');
  ok(L.hostile(W, 0, 1) && !L.hostile(W, 0, 2) && L.hostile(W, 2, 1) && L.friendTo0(W, 2) && !L.friendTo0(W, 1), 'команды'); eq(shaft.pi, 1);
  tickN(W, 2); eq(MS.flags.alliance, undefined); ok(!L.visibleTo0(W, sz[0]), 'мирных Сизых видно издалека');
  const K = C.pointOf(MS, 'K'); r.x = K.x + 1; r.y = K.y; tickN(W, 1); eq(MS.flags.alliance, 'helped'); ok(sz.every(u => u.owner === 2 && !u.calm && u.pi === 1), 'не союзники'); eq(shaft.owner, 2);
  r.x = 2.5; r.y = 9.5; L.updateVis(W); ok(L.visibleTo0(W, sz[0]) && L.visibleTo0(W, shaft), 'нет общего обзора');
  eq(L.smartKind(W, 0, [r.id], sz[0].x, sz[0].y, sz[0]), 'move'); tickN(W, 3); ok(sz.every(u => u.hp === 60) && r.hp === 60, 'союзники стреляют друг в друга');
  const foe = L.addUnit(W, 1, 'rifleman', sz[0].x + 3, sz[0].y + 1); eq(foe.pi, 3, 'цвет третьей силы'); ok(tickN(W, 12, 1 / 30, () => foe.hp <= 0 || sz.some(u => u.hp < 60)), 'союзник и чужак не дерутся');
  tickN(W, 3); ok(!C.cond(W, { t: 'since', obj: 'fork', gte: 100 }) && C.cond(W, { t: 'since', obj: 'fork', gte: 3 }), 'since'); eq(MS.byObj.hold.state, 'done');
  ok(!L.newWorld({ seed: 3 }).team, 'команды в скирмише'); eq(L.newWorld({ seed: 3 }).players.length, 3);
});
test('пожар и вода (общий код): огонь разгорается, жжёт юнитов и здания, даёт новые очаги; водовоз: бочки → огонь; рудовоз с песком (def.sand); Сава засыпает; насос — только у воды; группа douse', () => {
  const W = C.build(warDef()), MS = W.mission, shaft = W.blds.find(b => b.tag === 'rudnik'), bw = W.units.find(u => u.type === 'bowser'), hl = W.units.find(u => u.type === 'hauler'), sv = W.units.find(u => u.type === 'sava');
  C.act(W, { a: 'fire', at: '1', tag: 'mine', r: 1.7, max: 200, hp: 150, grow: 5, bdps: 10, spread: 4, area: { at: '1', r: 5 }, cap: 3 });
  const f = W.fires[0], h0 = shaft.hp, vic = L.addUnit(W, 0, 'rifleman', f.x + 0.5, f.y); tickN(W, 12);
  ok(f.hp > 190, 'не разгорается'); ok(shaft.hp < h0, 'здание не горит'); ok(vic.hp < 60 || !W.byId[vic.id], 'юнит не горит'); ok(W.fires.length >= 2 && W.fires.length <= 3, 'очагов: ' + W.fires.length);
  ok(C.cond(W, { t: 'fires', tag: 'mine', gte: 2 }) && !C.cond(W, { t: 'fires', tag: 'mine', lte: 0 }), 'условие fires');
  // водовоз: пустой → ПКМ по бочкам (fill), ПКМ по огню (douse); бочки убывают
  bw.water = 0; bw.x = 13; bw.y = 4; const dp = W.depots[0]; eq(L.smartKind(W, 0, [bw.id], dp.x, dp.y, null), 'fill'); eq(L.smartKind(W, 0, [bw.id], f.x, f.y, null), 'douse'); eq(L.smartKind(W, 0, [W.units.find(u => u.type === 'rifleman').id], f.x, f.y, null), 'move');
  L.commandSmart(W, 0, [bw.id], f.x, f.y, null); ok(tickN(W, 20, 1 / 30, () => bw.water > 60), 'не набрал'); ok(dp.w < 200, 'бочки не убывают');
  ok(tickN(W, 40, 1 / 30, () => (MS.doused.mine || 0) >= 1), 'не потушил'); ok(C.cond(W, { t: 'doused', tag: 'mine' }), 'условие doused');
  // рудовоз возит песок только там, где миссия разрешила; Сава засыпает рядом
  eq(L.waterCap(W, hl), 60); eq(L.waterCap(L.newWorld({ seed: 2 }), hl), 0, 'песок в скирмише');
  C.act(W, { a: 'douse' }); tickN(W, 0.2); C.act(W, { a: 'fire', at: '2', tag: 'b', max: 200, grow: 0, bdps: 0, dps: 0 }); const f2 = W.fires[W.fires.length - 1];
  hl.x = f2.x - 4; hl.y = f2.y + 2; hl.water = 0; const q = W.depots[1]; hl.x = q.x - 1.5; hl.y = q.y - 1; L.commandDouse(W, [hl.id], f2.id); ok(tickN(W, 40, 1 / 30, () => f2.hp < 150), 'песок не гасит'); ok(hl.water < 60, 'песок не тратится');
  W.treaty = true; f2.hp = 200; sv.x = f2.x + f2.r + 1.5; sv.y = f2.y + 2; sv.path = []; sv.order = { t: 'idle' }; // договор: Сава не отвлекается на чужой копёр рядом
  hl.order = { t: 'idle' }; hl.water = 0; tickN(W, 3); ok(f2.hp < 180, 'Сава не засыпает');
  // насос — только у воды, зато где угодно; водовоз наливается у него без счёта
  ok(!L.canPlace(W, 0, 'pump', 14, 8), 'насос без воды'); ok(L.canPlace(W, 0, 'pump', 12, 2), 'насос у воды не ставится'); const pump = L.addBuilding(W, 0, 'pump', 12, 2);
  bw.water = 0; dp.w = 0; eq(L.waterSource(W, bw).id, pump.id); eq(L.smartKind(W, 0, [bw.id], 13, 3, pump), 'fill');
  // группа douse: водовозы союзника сами тушат в своей зоне
  C.act(W, { a: 'douse' }); tickN(W, 0.2); eq(W.fires.length, 0, 'действие douse не гасит');
  const ab = L.addUnit(W, 2, 'bowser', 20, 7); ab.tag = 'szb'; ab.water = 100; C.act(W, { a: 'group', tag: 'szb', owner: 2, mode: 'douse', zone: 'mine' }); C.act(W, { a: 'fire', at: '1', tag: 'c', max: 120, grow: 0 });
  ok(tickN(W, 30, 1 / 30, () => (MS.doused.c || 0) >= 1), 'союзный водовоз не тушит');
  eq(L.BUILD_LIST.concat(L.UNIT_LIST).filter(t => ['pump', 'store', 'shaft', 'bowser', 'engineer', 'colossus'].includes(t)).length, 0, 'попало в скирмиш');
});
test('захват (общий код): инженер занимает чужое здание (склад отдаёт медь), охрана рядом не пускает, Контору и союзное — нельзя; группа capture — инженеры ИИ занимают наше; договор — пулей здания не берут', () => {
  const W = C.build(warDef({ treaty: true })), MS = W.mission, e = W.units.find(u => u.type === 'engineer'), st = W.blds.find(b => b.tag === 'sstore'), shaft = W.blds.find(b => b.tag === 'rudnik'), hq = L.has(W, 0, 'hq');
  ok(L.canCapture(W, 0, st) && !L.canCapture(W, 1, hq) && !L.canCapture(W, 0, hq), 'canCapture'); e.x = st.tx - 1; e.y = st.ty + 1;
  eq(L.smartKind(W, 0, [e.id], st.tx + 1, st.ty + 1, st), 'capture'); const g = L.addUnit(W, 1, 'rifleman', st.tx + 1, st.ty + 3.5); g.calm = false; ok(L.guarded(W, st), 'охраны не видно');
  L.commandSmart(W, 0, [e.id], st.tx + 1, st.ty + 1, st); const c0 = W.players[0].copper; tickN(W, 1); eq(st.owner, 1, 'занят под охраной'); g.hp = 0;
  ok(tickN(W, 5, 1 / 30, () => st.owner === 0), 'не занят'); eq(W.players[0].copper - c0, 400, 'медь склада'); ok(!W.byId[e.id], 'инженер не вошёл'); tickN(W, 0.3);
  ok(C.cond(W, { t: 'captured' }) && C.cond(W, { t: 'owned', tag: 'sstore' }) && !C.cond(W, { t: 'owned', owner: 1, tag: 'sstore' }), 'условия captured/owned'); eq(W.players[0].lost, 0, 'инженер посчитан потерей');
  // союзное здание не берём; ИИ-группа capture забирает наш склад обратно, если его не охраняют
  C.act(W, { a: 'owner', tag: 'rudnik', to: 2 }); ok(!L.canCapture(W, 0, shaft), 'берём союзное');
  W.units.filter(u => u.owner === 0 && L.UNITS[u.type].weapon).forEach(u => { u.x = 2.5; u.y = 9.5; }); W.units.filter(u => u.tag === 'sz').forEach(u => { u.hp = 0; });
  C.act(W, { a: 'spawn', owner: 1, type: 'engineer', n: 1, at: 'E', tag: 'rt' }); C.act(W, { a: 'spawn', owner: 1, type: 'rifleman', n: 1, at: 'E', tag: 'rt' }); C.act(W, { a: 'group', tag: 'rt', owner: 1, mode: 'capture', tags: ['sstore'] });
  ok(tickN(W, 20, 1 / 30, () => st.owner === 1), 'ИИ не отбил склад'); ok(C.cond(W, { t: 'owned', owner: 1, tag: 'sstore' }), 'owned по первому тегу'); eq(L.has(W, 0, 'boiler').owner, 0, 'ИИ взял здание без тега из списка');
  // договор: по зданию пуля не берёт
  const r = W.units.find(u => u.type === 'rifleman' && u.owner === 0); r.x = st.tx - 2; r.y = st.ty; const h0 = st.hp; W.units.filter(u => u.owner === 1).forEach(u => { u.hp = 0; }); L.commandAttack(W, [r.id], st.id); tickN(W, 2); eq(st.hp, h0, 'договор не держит');
});
test('громада (общий код): узлы со своей прочностью; попадание — в ближайший к стрелку целый узел; эффекты: кабина — пушка, котёл — пар и ход, бур — здания, гусеницы — ход; все узлы — уничтожена; условия part/parts', () => {
  const W = C.build(warDef()), MS = W.mission; W.units.filter(u => u.tag === 'sz').forEach(u => { u.hp = 0; }); W.blds.filter(b => b.owner === 1).forEach(b => { b.hp = 0; }); tickN(W, 0.1);
  C.act(W, { a: 'spawn', owner: 1, type: 'colossus', n: 1, at: 'B', tag: 'boss', heading: Math.PI }); C.act(W, { a: 'boss', tag: 'boss', route: ['E', 'K'], cfg: { parts: { tracks: 300, drill: 200, cabin: 150, boiler: 250 }, ventEvery: 6, ventWarn: 1, vent: 2 } });
  const b = W.units.find(u => u.tag === 'boss'), part = k => L.partOf(b, k); eq(b.parts.map(p => p.k).join(), 'tracks,drill,cabin,boiler'); eq(b.hp, 900); eq(b.maxHp, 900); eq(b.bs.route.length, 2);
  const at = (f, s) => ({ x: b.x + Math.cos(b.heading) * f - Math.sin(b.heading) * s, y: b.y + Math.sin(b.heading) * f + Math.cos(b.heading) * s }), toward = (f, s) => { const q = at(f, s); return L.partToward(b, q.x, q.y).k; };
  eq([toward(8, 0), toward(0, 8), toward(0, -8), toward(-8, 0)], ['drill', 'tracks', 'tracks', 'cabin'], 'какой узел откуда');
  // идёт по маршруту, пушка стреляет; с кормы сбиваем кабину — пушка молчит
  const x0 = b.x, vic = L.addUnit(W, 0, 'hauler', b.x - 4, b.y + 4); tickN(W, 4); ok(b.x < x0 - 0.8, 'не идёт'); ok(vic.hp < vic.maxHp, 'пушка молчит');
  { const q = at(-8, 0); L.hitPart(W, b, 500, 'shell', q.x, q.y); } eq(part('cabin').hp, 0); eq(b.hp, 900 - 150 - (300 - part('tracks').hp) - (200 - part('drill').hp) - (250 - part('boiler').hp), 'hp = сумма узлов');
  vic.hp = vic.maxHp; vic.x = b.x - 4; vic.y = b.y + 4; tickN(W, 4); eq(vic.hp, vic.maxHp, 'пушка без кабины стреляет');
  // пар: предупреждение → выброс рядом с корпусом; без котла — нет, и ход тише
  vic.x = b.x; vic.y = b.y + 2.6; let vent = 0; tickN(W, 12, 1 / 30, () => { if (b.bs.st === 'vent') vent++; vic.x = b.x; vic.y = b.y + 2.6; return false; }); ok(vent > 30, 'нет выброса'); ok(vic.hp < vic.maxHp, 'пар не жжёт');
  const v1 = b.x; b.bs.st = 'walk'; b.bs.vent = 99; tickN(W, 3); const fast = v1 - b.x; part('boiler').hp = 1; { const q = at(0, 0); L.hitPart(W, b, 5, 'shell', q.x, q.y); } eq(part('boiler').hp, 0);
  vent = 0; const v2 = b.x; b.bs.vent = 0; tickN(W, 3, 1 / 30, () => { if (b.bs.st !== 'walk') vent++; return false; }); eq(vent, 0, 'пар без котла'); ok(v2 - b.x < fast * 0.7 && v2 - b.x > 0.1, 'ход без котла: ' + fast.toFixed(2) + ' → ' + (v2 - b.x).toFixed(2));
  // здание на пути: бур берёт быстро, корпус — медленно
  const put = () => { const t = L.addBuilding(W, 0, 'tower', Math.floor(b.x) - 5, Math.floor(b.y) - 1); b.heading = Math.PI; b.bs.goal = null; b.path = []; const t0 = W.time; ok(tickN(W, 120, 1 / 30, () => !W.byId[t.id]), 'здание устояло'); return W.time - t0; };
  vic.hp = 0; const withDrill = put(); part('drill').hp = 1; { const q = at(8, 0); L.hitPart(W, b, 5, 'shell', q.x, q.y); } const noDrill = put(); ok(noDrill > withDrill + 4, 'без бура не медленнее: ' + withDrill.toFixed(1) + ' / ' + noDrill.toFixed(1));
  // гусеницы — стоит; последний узел — конец
  tickN(W, 0.3); ok(C.cond(W, { t: 'part', tag: 'boss', k: 'drill' }) && C.cond(W, { t: 'parts', tag: 'boss', gte: 3 }) && !C.cond(W, { t: 'parts', tag: 'boss', gte: 4 }), 'part/parts');
  b.bs.goal = null; const x1 = b.x; tickN(W, 2); ok(b.x < x1 - 0.1, 'встала раньше времени'); part('tracks').hp = 1; { const q = at(0, 8); L.hitPart(W, b, 5, 'shell', q.x, q.y); }
  ok(b.hp <= 0, 'жива без узлов'); tickN(W, 0.3); ok(!W.byId[b.id] && C.cond(W, { t: 'gone', tag: 'boss' }) && C.cond(W, { t: 'parts', gte: 4 }), 'не уничтожена');
});
test('громада (общий код): идёт на шум буровой вышки (частокол — не приманка), гейзер обваривает все узлы и останавливает (не чаще scaldCd); заряд подрывника — в ближний узел; дошла — bossDone, без гусениц стоит', () => {
  const W = C.build(warDef()), MS = W.mission; W.units.filter(u => u.tag === 'sz').forEach(u => { u.hp = 0; }); W.blds.filter(b => b.owner === 1).forEach(b => { b.hp = 0; }); tickN(W, 0.1);
  C.act(W, { a: 'spawn', owner: 1, type: 'colossus', n: 1, at: 'B', tag: 'boss', heading: Math.PI }); C.act(W, { a: 'boss', tag: 'boss', route: ['E', 'K'], cfg: { parts: { tracks: 3000, drill: 2000, cabin: 1500, boiler: 2500 }, steam: 400, stun: 4, ventEvery: 999, lureLoud: 12, charge: 700 } });
  const b = W.units.find(u => u.tag === 'boss'), d = W.units.find(u => u.type === 'drill'), at = L.deploySpot(W, 0, 'rig', 35, 2); ok(at, 'нет места под вышку');
  L.addBuilding(W, 0, 'palisade', 33, 8); tickN(W, 1.5); eq(b.bs.lure, 0, 'частокол — приманка');
  d.x = at.i + 1; d.y = at.j + 1; const rig = L.deployNow(W, d, at.i, at.j); rig.setup = 0; tickN(W, 1.5); eq(b.bs.lure, rig.id, 'не идёт на шум вышки');
  // гейзер по дороге к вышке: обварило все узлы, встала; второй выброс подряд не берёт
  b.x = 25; b.y = 4; b.path = []; b.bs.goal = null; C.act(W, { a: 'geyser', id: 'g' }); const hp0 = b.parts.map(p => p.hp);
  ok(tickN(W, 25, 1 / 30, () => (MS.scalded.boss || 0) >= 1), 'не обварило'); ok(b.parts.every((p, n) => p.hp <= hp0[n] - 399), 'не все узлы'); ok(b.bs.stun > 3, 'не встала'); ok(C.cond(W, { t: 'scalded', tag: 'boss' }) && !C.cond(W, { t: 'scalded', gte: 2 }), 'scalded');
  const xs = b.x; tickN(W, 2); eq(b.x, xs, 'едет оглушённая'); ok(!L.bossSteam(W, b), 'обварило дважды подряд'); b.bs.scaldT = -999; ok(L.bossSteam(W, b), 'после паузы не берёт');
  // заряд подрывника: с кормы — в кабину
  C.act(W, { a: 'geyser', id: 'g', on: false }); rig.hp = 0; b.bs.stun = 40; const sp = W.units.find(u => u.type === 'sapper'), c0 = L.partOf(b, 'cabin').hp; sp.x = b.x - Math.cos(b.heading) * 3; sp.y = b.y - Math.sin(b.heading) * 3;
  eq(L.smartKind(W, 0, [sp.id], b.x, b.y, b), 'plant'); L.commandPlant(W, [sp.id], b.id); ok(tickN(W, 16, 1 / 30, () => L.partOf(b, 'cabin').hp < c0), 'заряд не ударил'); eq(c0 - L.partOf(b, 'cabin').hp, 700, 'урон заряда');
  // маршрут до конца → bossDone, потом идёт на ближайшее чужое здание (Контора)
  b.bs.stun = 0; b.sm = 30; ok(tickN(W, 30, 1 / 30, () => C.cond(W, { t: 'bossDone', tag: 'boss' })), 'не дошла'); ok(tickN(W, 40, 1 / 30, () => W.winner === 1), 'Контору не снесла');
});

await runAll();

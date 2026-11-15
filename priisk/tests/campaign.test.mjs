/* ПРИИСК · tests/campaign.test.mjs — кампания публичной (демо) сборки: парсер ASCII-карт, условия/триггеры/действия,
   сценарный ИИ, герои, сохранение прогресса (localStorage-ключ arcade.priisk.campaign), бот проходит миссию 1 (реакция 150–250 мс,
   цели по порядку), миссия 1 не тупиковая (A*), тексты RU/EN; издание: флаг сборки, реестр миссий без m2, замочки 2–10, экран демо.
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
  eq(G2.missing, ['m2'], 'm2 не должен лежать в публичном дереве'); eq(G2.P.MISSIONS.map(m => m.id), ['m1']);
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

await runAll();

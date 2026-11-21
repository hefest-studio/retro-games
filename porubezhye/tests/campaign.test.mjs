/* ПОРУБЕЖЬЕ · tests/campaign.test.mjs — движок кампаний на мини-картах (Node, без браузера; миссий полной версии здесь нет —
   только маленькие тестовые миссии-данные). Запуск: node porubezhye/tests/campaign.test.mjs
   Проверяет: карту миссии (легенда, ресурсы, точки), общее ядро сценария js/scenario.js (триггеры с wait/if, цели after/hidden/opt/fail,
   звёзды, победа/поражение), условия и действия ПОРУБЕЖЬЯ (зоны, спавн, сценарный ИИ групп, смена клеток, обзор, мороз, allow),
   пролёты моста (вода у берега → настил → снова вода), мороз и тепло обеих рас, знамя Ярины, Тихона, дрова, перенос героев и прогресс;
   под миссии 4–7: место работ (сборка), засека (tough), Топотун (топот), третья сторона и отношения, колонна (convoy) и уход с карты
   (exit/escaped), сопровождение (follow), ползущий Зимний вал, общая карта битвы (registerBattle), сцена итога кампании в UI. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sb = { console, Math, Array, Map, Set, Object, JSON, Uint8Array, Int32Array, Float32Array, location: { search: '' } }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ['js/i18n.js', 'js/edition.js', 'js/missions/index.js', 'js/game.js', 'js/scenario.js', 'js/campaign.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const P = sb.PORUB, C = P.campaign, S = P.scenario, T = P.T, TR = P.TERR;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e.stack || e.message).split('\n').slice(0, 2).join(' | ')); } }
const ok = (c, m) => { if (!c) throw new Error(m || 'ложь'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); };
const run = (g, s) => { for (let t = 0; t < s; t += 0.05) g.update(0.05); };

// мини-карта 24×12: острог слева, река посередине (x 11–12), лёд-брод внизу, сухостой, снег справа
const MAP = [
  '########################',
  '#H.......a.~~....*****.#',
  '#.........a~~....*E***.#',
  '#..........~~....*****.#',
  '#....S.....~~....**t**.#',
  '#..........~~.....t*...#',
  '#....$.....~~..........#',
  '#..........~~......t...#',
  '#..........~~.....,,,..#',
  '#..........==.....,K,..#',
  '#..........==..........#',
  '########################'];
function mini(extra) {
  return Object.assign({ id: 'mini', n: 1, camp: 'wright', race: 'wright', foe: 'thicket', title: { ru: 'Мини', en: 'Mini' }, map: MAP, ground: '.', legend: { E: '*' },
    zones: { east: { x: 13, y: 1, w: 10, h: 10 }, river: { x: 11, y: 1, w: 2, h: 8 }, ford: { x: 11, y: 9, w: 2, h: 2 }, home: { at: 'H', r: 4 } },
    player: { res: { a: 500, r: 100 }, start: [{ type: 'hall', at: 'H' }, { type: 'worker', at: 'S', n: 3 }, { type: 'yarina', at: 'S' }] },
    enemy: { start: [] }, objectives: [], triggers: [] }, extra || {});
}
const mk = (extra, o) => C.build(mini(extra), Object.assign({ fogOff: true }, o || {}));

test('карта миссии: размеры, легенда, ресурсы (янтарь, смола 2×2, сухостой), точки; ошибки — понятные', () => {
  const mp = C.parseMap(mini());
  eq([mp.w, mp.h], [24, 12]); eq(mp.terr[1 * 24 + 11], TR.WATER); eq(mp.terr[9 * 24 + 11], TR.ICE); eq(mp.terr[1 * 24 + 17], TR.SNOW); eq(mp.terr[2 * 24 + 18], TR.SNOW, 'легенда E → снег');
  eq(mp.nodes.map(n => n.type).sort().join(), 'amber,amber,resin,timber,timber,timber');
  ok(mp.points.H && mp.points.S && mp.points.K, 'точки');
  let e1 = null; try { C.parseMap(mini({ map: MAP.slice(0, 3).concat(['#..']) })); } catch (e) { e1 = e.message; } ok(/строка 3/.test(e1), e1);
  let e2 = null; try { C.parseMap(mini({ map: MAP.map((r, i) => i === 3 ? r.replace('..', '?.') : r) })); } catch (e) { e2 = e.message; } ok(/неизвестная клетка/.test(e2), e2);
});
test('сборка: стартовые силы, ресурсы, герои, без ИИ скирмиша и без автопобеды (endRule none)', () => {
  const g = mk(); eq([g.MW, g.MH], [24, 12]);
  eq(g.ents.filter(e => e.owner === 0 && e.kind === 'u').length, 4); ok(g.ents.find(e => e.type === 'hall' && e.done), 'острог'); eq(g.res[0].a, 500);
  ok(g.mission.heroes.yarina, 'герой не учтён'); eq(g.ai, null); run(g, 2); eq(g.winner, -1, 'у врага нет зданий — но победы нет');
});
test('ядро сценария: wait / if, цели after → active, opt не мешает победе, звёзды, победа через 2 с', () => {
  const g = mk({
    objectives: [{ id: 'a', text: 'A', done: { t: 'flag', key: 'x' } }, { id: 'b', after: 'a', text: 'B', done: { t: 'time', gte: 3 } }, { id: 'o', kind: 'opt', text: 'O', done: { t: 'time', gte: 999 } }],
    stars: [{ text: 's1', when: { t: 'time', lte: 100 } }, { text: 's2', when: { t: 'flag', key: 'never' } }],
    triggers: [{ id: 't1', when: { t: 'time', gte: 1 }, do: [{ a: 'wait', s: 0.5 }, { a: 'if', when: { t: 'time', gte: 1.4 }, do: [{ a: 'flag', key: 'x' }], else: [{ a: 'flag', key: 'bad' }] }] }] });
  const MS = g.mission; eq(MS.byObj.b.state, 'hidden'); run(g, 2); ok(MS.flags.x && !MS.flags.bad, 'if/wait'); eq(MS.byObj.a.state, 'done'); eq(MS.byObj.b.state, 'active');
  run(g, 2.5); eq(MS.byObj.b.state, 'done'); eq(g.winner, -1, 'победа сразу'); run(g, 2.2); eq(g.winner, 0); eq(MS.result.win, true); eq(MS.result.stars, [true, true, false]);
});
test('ядро сценария: провал обязательной цели и список lose → поражение с причиной; повтор триггера repeat', () => {
  const g = mk({ objectives: [{ id: 'a', text: 'A', fail: { t: 'time', gte: 2 }, failText: 'late' }], triggers: [{ id: 'r', repeat: 1, when: { t: 'time', gte: 0 }, do: [{ a: 'res', k: 'w', n: 1 }] }] });
  run(g, 3); eq(g.winner, 1); eq(g.mission.result.reason, 'late'); ok(g.res[0].w >= 2, 'repeat: ' + g.res[0].w);
  const g2 = mk({ objectives: [{ id: 'a', text: 'A', done: { t: 'time', gte: 99 } }], lose: [{ when: { t: 'not', of: { t: 'built', type: 'hall' } }, reason: 'hall' }] });
  g2._kill(g2.ents.find(e => e.type === 'hall'), null); run(g2, 0.5); eq(g2.mission.result.reason, 'hall');
});
test('условия: zone / units / trained / gathered / killed / gone / alive / near / seen', () => {
  const g = mk({ fogOff: false }, { fogOff: false }), MS = g.mission, cond = c => C.cond(g, c);
  ok(!cond({ t: 'zone', zone: 'east', who: 'worker' })); const w = g.ents.find(e => e.type === 'worker'); w.x = 15 * T; w.y = 5 * T; ok(cond({ t: 'zone', zone: 'east', who: 'worker' }));
  ok(!cond({ t: 'zone', zone: 'east', who: 'worker', all: true }), 'all — не все');
  ok(cond({ t: 'units', type: 'worker', gte: 3, lte: 3 })); ok(cond({ t: 'near', who: 'worker', of: 'nobody', r: 2 }) === false);
  C.act(g, { a: 'spawn', owner: 1, type: 'stinger', n: 2, at: 'K', tag: 'foe' }); ok(cond({ t: 'alive', tag: 'foe', gte: 2 })); ok(!cond({ t: 'gone', tag: 'foe' }));
  g.ents.filter(e => e.tag === 'foe').forEach(e => g._kill(e, w)); ok(cond({ t: 'killed', tag: 'foe', gte: 2 }) && cond({ t: 'gone', tag: 'foe' }));
  const hall = g.ents.find(e => e.type === 'hall'); g.cmd(0, { t: 'train', id: hall.id, type: 'worker' }); run(g, 13); ok(cond({ t: 'trained', type: 'worker', n: 1 }), 'trained');
  const am = g.ents.find(e => e.kind === 'n' && e.type === 'amber'); g.cmd(0, { t: 'gather', ids: [g.ents.find(e => e.type === 'worker' && e !== w).id], target: am.id }); run(g, 15); ok(cond({ t: 'gathered', type: 'amber', gte: 5 }), 'gathered ' + MS.gath.amber);
  ok(!cond({ t: 'seen', zone: { at: 'K', r: 1 } }), 'точка в тумане видна'); C.act(g, { a: 'reveal', at: 'K', r: 3, s: 5 }); g._updateVis(); ok(cond({ t: 'seen', zone: { at: 'K', r: 1 } }), 'reveal не открыл');
});
test('сценарный ИИ: группа attack идёт к точке и бьёт врага; hold поднимается, когда её обстреляли', () => {
  const g = mk({ groups: { g1: { mode: 'attack', target: 'H' } } }); C.act(g, { a: 'spawn', owner: 1, type: 'stinger', n: 2, at: 'S', tag: 'g1' });
  const hall = g.ents.find(e => e.type === 'hall'), hp0 = hall.hp; g.ents.filter(e => e.owner === 0 && e.kind === 'u').forEach(u => g._kill(u, null, true));
  run(g, 25); ok(hall.hp < hp0, 'атака не дошла до острога');
  const g2 = mk(); C.act(g2, { a: 'spawn', owner: 1, type: 'shell', n: 1, at: 'K', tag: 'h' }); C.act(g2, { a: 'group', tag: 'h', mode: 'hold' });
  const sh = g2.ents.find(e => e.tag === 'h'); sh.hitT = g2.t + 0.01; run(g2, 1); ok(g2.mission.groups.h.alerted, 'не встревожились');
});
test('действия: tiles (вода → юниты выталкиваются, здание на затопленном — рушится), allow, build, despawn, res', () => {
  const g = mk({ player: { res: { a: 500 }, build: ['house'], units: ['worker'], start: [{ type: 'hall', at: 'H' }, { type: 'worker', at: 'S', n: 2 }] } });
  ok(!g.canPlace(0, 'gunhouse', 7, 7).ok && g.canPlace(0, 'gunhouse', 7, 7).why === 'nobuild', 'allow: стрельня разрешена');
  const hall = g.ents.find(e => e.type === 'hall'); g.res[0].r = 100; eq(g.trainBlock(0, hall, 'worker'), null);
  C.act(g, { a: 'allow', build: ['gunhouse'] }); ok(g.canPlace(0, 'gunhouse', 7, 7).ok, 'allow не открыл: ' + g.canPlace(0, 'gunhouse', 7, 7).why);
  const w = g.ents.find(e => e.type === 'worker'); w.x = 11.5 * T; w.y = 9.5 * T; // на льду брода
  C.act(g, { a: 'tiles', zone: 'ford', to: '~' }); eq(g.terr[9 * 24 + 11], TR.WATER); ok(g.walkPx(w.x, w.y), 'юнит остался в воде'); ok(g.terrRev > 0, 'карта не перерисуется');
  C.act(g, { a: 'build', type: 'house', at: 'S', tag: 'hh' }); const hh = g.ents.find(e => e.tag === 'hh'); ok(hh && hh.done, 'build');
  C.act(g, { a: 'tiles', zone: { x: hh.tx, y: hh.ty, w: 1, h: 1 }, to: '~' }); ok(hh.dead, 'изба на воде стоит');
  C.act(g, { a: 'spawn', owner: 1, type: 'beetle', n: 3, at: 'K', tag: 'z' }); C.act(g, { a: 'despawn', tag: 'z' }); ok(!g.ents.some(e => !e.dead && e.tag === 'z'), 'despawn');
});
test('пролёт моста: только на воду у берега/настила; готов — настил и проход; снесён — снова вода, кто стоял — на берегу', () => {
  const g = mk({ player: { res: { a: 1000 }, build: ['span'], start: [{ type: 'hall', at: 'H' }, { type: 'worker', at: 'S', n: 3 }] } });
  eq(g.canPlace(0, 'span', 5, 5).why, 'blocked', 'на суше'); ok(g.canPlace(0, 'span', 11, 4).ok, 'у берега нельзя');
  const ws = g.ents.filter(e => e.type === 'worker'); const sp = g.cmd(0, { t: 'build', ids: ws.map(u => u.id), type: 'span', tx: 11, ty: 4 }); ok(sp, 'не поставили');
  ok(!g.passable(11, 4), 'недостроенный проходим'); run(g, 25); ok(sp.done, 'не достроили: ' + sp.prog.toFixed(2));
  eq(g.terr[4 * 24 + 11], TR.BRIDGE); ok(g.passable(11, 4) && g.passable(12, 5), 'настил непроходим'); eq(g.entAt(11.5 * T, 4.5 * T, 0).id, sp.id, 'настил не выбирается кликом');
  const pth = g.pathToTile(8, 4, 15, 4); ok(pth && pth.found, 'через мост не пройти');
  ws[0].x = 11.5 * T; ws[0].y = 4.5 * T; C.act(g, { a: 'spawn', owner: 1, type: 'stinger', n: 1, at: 'S', tag: 'x' }); g._kill(sp, g.ents.find(e => e.tag === 'x'));
  eq(g.terr[4 * 24 + 11], TR.WATER); ok(g.walkPx(ws[0].x, ws[0].y), 'юнит в воде'); eq(g.mission.spanLost, 1); ok(!C.cond(g, { t: 'spanLost', lte: 0 }));
});
test('мороз: вдали от тепла ходят и добывают медленнее; у избы и знамени тепло; у Чащи тепло на грибнице; рост Чащи мёрзнет сильнее', () => {
  const g = mk({ cold: { from: 1, to: 1 } }); run(g, 0.1); eq(g.cold, 1);
  const w = g.ents.find(e => e.type === 'worker'), hall = g.ents.find(e => e.type === 'hall');
  w.x = 20 * T; w.y = 10 * T; w.warmT = 0; ok(g.coldMove(w) < 0.75 && g.coldWork(w) < 0.65, 'мороз не действует');
  w.x = hall.x + 2 * T; w.y = hall.y + 3 * T; w.warmT = 0; eq(g.coldMove(w), 1, 'у острога холодно'); ok(g.coldWork(w) > 0.8);
  const y = g.ents.find(e => e.type === 'yarina'); y.x = 20 * T; y.y = 9 * T; y.warmT = 0; ok(!g.warm(y)); ok(g.cmd(0, { t: 'banner', id: y.id }), 'знамя'); y.warmT = 0; ok(g.warm(y), 'у знамени холодно');
  eq(g.cmd(0, { t: 'banner', id: y.id }), false, 'перезарядка не работает');
  ok(g.coldGrow(0) > g.coldGrow(1), 'Чаща должна мёрзнуть сильнее (рост)');
  const gt = C.build(mini({ race: 'thicket', foe: 'wright', player: { res: { a: 500 }, start: [{ type: 'stump', at: 'H' }, { type: 'beetle', at: 'S', n: 1 }] }, cold: { from: 1, to: 1 } }), { fogOff: true }); run(gt, 0.6);
  const bt = gt.ents.find(e => e.type === 'beetle'), st = gt.ents.find(e => e.type === 'stump'); bt.x = st.x; bt.y = st.y + 3 * T; bt.warmT = 0; ok(gt.warm(bt), 'на грибнице холодно'); bt.x = 20 * T; bt.warmT = 0; ok(!gt.warm(bt));
  // ход: за 2 с на морозе вдали от тепла проходят меньше
  const g0 = mk(), g1 = mk({ cold: { from: 0.9, to: 0.9 } }); for (const G of [g0, g1]) { const u = G.ents.find(e => e.type === 'worker'); u.x = 14 * T; u.y = 7 * T; G.cmd(0, { t: 'move', ids: [u.id], x: 21 * T, y: 7 * T }); G._x0 = u.x; G._u = u; run(G, 1.5); }
  ok(g1._u.x - g1._x0 < (g0._u.x - g0._x0) * 0.85, 'мороз не замедлил: ' + (g1._u.x - g1._x0) + ' / ' + (g0._u.x - g0._x0));
  // снег вязнет сам по себе
  ok(P.TSPD[TR.SNOW] < 1, 'снег не замедляет');
});
test('мороз меняется по def.cold и действием cold { to, over }', () => {
  const g = mk({ cold: { from: 0, to: 1, at0: 10, at1: 20 } }); run(g, 5); eq(g.cold, 0); run(g, 10); ok(Math.abs(g.cold - 0.5) < 0.02, 'середина ' + g.cold);
  C.act(g, { a: 'cold', to: 0, over: 4 }); run(g, 2); ok(g.cold > 0.15 && g.cold < 0.4, 'спад ' + g.cold); run(g, 3); eq(g.cold, 0);
});
test('знамя Ярины ускоряет стройку рядом в 1,75 раза; Тихон строит за двоих', () => {
  const prog = (useBanner, who) => { const g = mk({ player: { res: { a: 1000 }, start: [{ type: 'hall', at: 'H' }, { type: who, at: 'S' }, { type: 'yarina', at: 'S' }] } });
    const w = g.ents.find(e => e.type === who), y = g.ents.find(e => e.type === 'yarina'); const b = g.cmd(0, { t: 'build', ids: [w.id], type: 'house', tx: 7, ty: 8 }); ok(b, 'изба не поставлена'); run(g, 3);
    if (useBanner) { y.x = b.x; y.y = b.y + 40; g.cmd(0, { t: 'banner', id: y.id }); } const p0 = b.prog; run(g, 6); return b.prog - p0; };
  const base = prog(false, 'worker'), ban = prog(true, 'worker'), tk = prog(false, 'tikhon');
  ok(Math.abs(ban / base - 1.75) < 0.1, 'знамя: ' + (ban / base).toFixed(2)); ok(Math.abs(tk / base - 2) < 0.1, 'Тихон: ' + (tk / base).toFixed(2));
});
test('герои не обучаются; Тихон чинит вдвое быстрее; смерть героя → heroDead и «пал» в итоге', () => {
  const g = mk({ player: { res: { a: 500 }, start: [{ type: 'hall', at: 'H' }, { type: 'tikhon', at: 'S' }, { type: 'yarina', at: 'S' }] }, objectives: [{ id: 'a', text: 'A', done: { t: 'time', gte: 9 } }] });
  const hall = g.ents.find(e => e.type === 'hall'); eq(g.trainBlock(0, hall, 'yarina'), 'nobuild');
  hall.hp = 500; const tk = g.ents.find(e => e.type === 'tikhon'); g.cmd(0, { t: 'repair', ids: [tk.id], target: hall.id }); run(g, 8); ok(hall.hp > 500 + 14 * 2 * 3, 'ремонт ' + hall.hp);
  g._kill(g.ents.find(e => e.type === 'yarina'), null); ok(g.mission.heroDead.yarina); run(g, 4); eq(g.mission.result.heroes.yarina.alive, false);
});
test('дрова: сухостой рубят в res.w; иссякла жила — рабочий ищет следующую рядом с ней, а не у склада', () => {
  const g = mk(), w = g.ents.find(e => e.type === 'worker'), tim = g.ents.filter(e => e.kind === 'n' && e.type === 'timber');
  const n0 = tim.find(n => n.tx === 19 && n.ty === 4); n0.amt = 4; g.cmd(0, { t: 'gather', ids: [w.id], target: n0.id }); run(g, 30);
  ok(g.res[0].w >= 4 && g.stats[0].wood >= 4, 'дрова не пришли'); ok(n0.dead, 'жила не иссякла');
  const cur = g.get(w.ord.id); ok(w.ord.t === 'gather' && cur && cur.type === 'timber' && Math.hypot(cur.x - n0.x, cur.y - n0.y) < 4 * T, 'не перешёл к соседнему сухостою');
});
test('прогресс: сохранение/загрузка по кампаниям, битое хранилище, открытие следующей, звёзды — лучшие, герой ранен → 60% в следующей', () => {
  const mem = new Map(), store = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  let d = C.load(store, 'wright'); eq(d.unlocked, 1);
  d = C.applyResult(d, { id: 'mini', n: 1, win: true, stars: [true, false, true], time: 300, flags: { grove: 'cut' }, heroes: { yarina: { alive: false } }, lostU: 2, lostB: 0 }); C.save(store, 'wright', d);
  ok(mem.has('arcade.porubezhye.campaign.wright')); const d2 = C.load(store, 'wright'); eq(d2.unlocked, 2); eq(d2.flags.grove, 'cut'); eq(d2.roster.heroes.yarina.wounded, true);
  C.applyResult(d2, { id: 'mini', n: 1, win: true, stars: [true, true, false], time: 400, flags: {}, heroes: {}, lostU: 0, lostB: 0 }); eq(d2.missions.mini.stars, [true, true, true]); eq(d2.missions.mini.time, 300);
  eq(C.load(store, 'thicket').unlocked, 1, 'кампании смешались');
  mem.set('arcade.porubezhye.campaign.wright', '{oops'); eq(C.load(store, 'wright').unlocked, 1, 'битый JSON');
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  eq(C.load(bad, 'wright').unlocked, 1); eq(C.save(bad, 'wright', d), false); C.reset(bad, 'wright');
  const g = C.build(mini({ heroes: ['yarina'], carry: ['grove'] }), { save: d2, fogOff: true }), y = g.ents.find(e => e.type === 'yarina'); ok(y.wounded && Math.round(y.hp) === Math.round(y.maxhp * 0.6), 'ранена ' + y.hp); eq(g.mission.flags.grove, 'cut', 'carry');
});
// ---------- под миссии 4–7 ----------
test('место работ: идёт, пока у места стоит who и рядом нет врага; помощники ускоряют; site { on, time }; условие site', () => {
  const g = C.build(mini({ sites: { s: { at: 'S', r: 2.5, time: 20, who: 'yarina', help: 'worker', helpMax: 2, helpK: 0.5 } } })), MS = g.mission;
  const y = g.ents.find(e => e.type === 'yarina'), sp = C.pointOf(MS, 'S');
  g.ents.filter(e => e.type === 'worker').forEach(w => { w.x = 30 * T; w.y = 8 * T; w.ord = { t: 'idle' }; }); g.ents.filter(e => e.type === 'worker').forEach(w => { w.x = 2 * T; w.y = 9.5 * T; });
  y.x = sp.x * T; y.y = sp.y * T; run(g, 5); const p1 = MS.sites.s.prog; ok(p1 > 0.2 && p1 < 0.3, 'без помощников ' + p1);
  g.ents.filter(e => e.type === 'worker').forEach(w => { w.x = sp.x * T + T; w.y = sp.y * T; }); run(g, 5); ok(MS.sites.s.prog - p1 > 0.45, 'с помощниками ' + (MS.sites.s.prog - p1));
  const foe = g._addUnit(1, 'stinger', sp.x * T + 2 * T, sp.y * T); foe.sm = 0.0001; const p2 = MS.sites.s.prog; run(g, 0.5); ok(MS.sites.s.hot && MS.sites.s.prog === p2, 'враг рядом — стоит');
  g._kill(foe, null, true); y.x = 20 * T; run(g, 1); ok(!MS.sites.s.busy, 'без who — стоит');
  y.x = sp.x * T; y.y = sp.y * T; C.act(g, { a: 'site', id: 's', time: 1 }); run(g, 1); ok(C.cond(g, { t: 'site', id: 's' }), 'не дошло ' + JSON.stringify(MS.sites.s) + ' ' + y.ord.t); ok(MS.ui.some(e => e.t === 'siteDone'), 'нет события');
});
test('засека (tough): немашины почти не берут, шагоход — в полную силу; Топотун: топот бьёт врагов рядом, перезарядка', () => {
  const g = C.build(mini({ enemy: { start: [{ type: 'hollow', at: 'K', tag: 'bar', tough: 0.15 }] } })), b = g.ents.find(e => e.tag === 'bar');
  const sh = g._addUnit(0, 'shooter', 0, 0), st = g._addUnit(0, 'stomper', b.x - 3 * T, b.y);
  const h0 = b.hp; g._damage(b, 10, sh); ok(Math.abs(h0 - b.hp - 1.5) < 1e-6, 'пищаль ' + (h0 - b.hp)); const h1 = b.hp; g._damage(b, 10, st); eq(h1 - b.hp, 10, 'шагоход');
  const f1 = g._addUnit(1, 'stinger', st.x + T, st.y), f2 = g._addUnit(1, 'stinger', st.x + 6 * T, st.y);
  ok(g.cmd(0, { t: 'stomp', id: st.id }), 'топот'); ok(f1.hp < f1.maxhp && f2.hp === f2.maxhp, 'урон по радиусу'); ok(!g.cmd(0, { t: 'stomp', id: st.id }), 'без перезарядки');
  ok(g.def(st).hero && g.def(st).mech, 'Топотун — герой-машина'); ok(g.trainBlock(0, g.ents.find(e => e.type === 'hall'), 'sled') === 'nobuild', 'сани не обучаются');
});
test('третья сторона: owner 2, отношения neutral/ally/enemy; нейтрала сами не бьют, A+клик — бьют; союзник бьётся с врагом; rel меняет', () => {
  const g = C.build(mini({ third: { race: 'thicket', rel: { 0: 'neutral', 1: 'ally' }, start: [{ type: 'stinger', at: 'K', n: 1, tag: 'nb' }] } })), MS = g.mission;
  eq(g.sides, 3); eq(g.relOf(2, 0), 'neutral'); eq(g.relOf(2, 1), 'ally'); eq(g.relOf(0, 1), 'enemy'); ok(!g.hostile(0, 2) && g.hostile(0, 1), 'враждебность');
  const nb = g.ents.find(e => e.tag === 'nb'), sh = g._addUnit(0, 'shooter', nb.x - 3 * T, nb.y); run(g, 3); eq(nb.hp, nb.maxhp, 'нейтрала обстреляли сами');
  g.cmd(0, { t: 'attack', ids: [sh.id], target: nb.id }); run(g, 2); ok(nb.hp < nb.maxhp, 'явный приказ не исполнен');
  C.act(g, { a: 'rel', side: 2, with: 0, to: 'ally' }); C.act(g, { a: 'rel', side: 2, with: 1, to: 'enemy' }); ok(C.cond(g, { t: 'rel', side: 2, with: 0, is: 'ally' }));
  ok(sh.ord.t !== 'attack' || !g.get(sh.ord.id) || g.get(sh.ord.id).owner !== 2, 'по союзнику продолжают бить');
  const foe = g._addUnit(1, 'stinger', nb.x + 2 * T, nb.y); run(g, 6); ok(foe.dead || foe.hp < foe.maxhp, 'союзник не бьётся с врагом');
});
test('колонна (convoy): locked — игрок не управляет; идёт по точкам, встаёт при враге, трогается; exit → escaped (не «убит»); follow', () => {
  const g = C.build(mini({ player: { res: { a: 0, r: 0 }, start: [{ type: 'hall', at: 'H' }, { type: 'sled', at: 'S', n: 2, tag: 'cv', locked: true }, { type: 'yarina', at: 'H' }] },
    zones: { out: { at: 'K', r: 2 } }, groups: { cv: { owner: 0, mode: 'convoy', route: ['K'], stop: 4 } } })), MS = g.mission;
  const sl = g.ents.filter(e => e.tag === 'cv'); ok(!g.cmd(0, { t: 'move', ids: sl.map(u => u.id), x: 40, y: 40 }) || sl.every(u => u.ord.t !== 'move' || u.ord.x !== 40), 'игрок управляет санями');
  run(g, 3); ok(sl.some(u => u.ord.t === 'move'), 'колонна не пошла');
  const foe = g._addUnit(1, 'stinger', sl[0].x + 2 * T, sl[0].y); foe.sm = 0.0001; run(g, 1); ok(MS.groups.cv.halted && sl.every(u => u.ord.t === 'idle'), 'не встала'); ok(MS.ui.some(e => e.t === 'convoyStop'));
  g._kill(foe, null, true); run(g, 40); ok(MS.groups.cv.arrived, 'не дошла'); ok(sl.every(u => !u.dead && u.hp === u.maxhp), 'сани сами воевали');
  C.act(g, { a: 'exit', tag: 'cv', zone: 'out' }); ok(C.cond(g, { t: 'escaped', tag: 'cv', gte: 2 }), 'не ушли'); ok(!C.cond(g, { t: 'killed', tag: 'cv' }), 'ушедшие посчитаны убитыми');
  const g2 = C.build(mini({ third: { race: 'thicket', rel: { 0: 'neutral' }, start: [{ type: 'envoy', at: 'K', tag: 'env', locked: true }] }, groups: { env: { owner: 2, mode: 'follow', lead: 'yarina', r: 1.5 } } }));
  const y = g2.ents.find(e => e.type === 'yarina'), en = g2.ents.find(e => e.tag === 'env'); run(g2, 12); ok(Math.hypot(en.x - y.x, en.y - y.y) < 3 * T, 'посол не идёт за Яриной');
});
test('Зимний вал: фронт ползёт, ряды за ним — лёд (вода тоже, лес остаётся), за валом медленнее и мороз жжёт; stop; условие wall', () => {
  const g = C.build(mini()), MS = g.mission, w = g.ents.find(e => e.type === 'worker');
  C.act(g, { a: 'wall', dir: 'e', pos: 0, speed: 2, dps: 10, stop: 12 }); run(g, 3); ok(Math.abs(g.wall.pos - 6) < 0.1, 'позиция ' + g.wall.pos); ok(C.cond(g, { t: 'wall', gte: 5.9 }));
  eq(g.terrAt(3, 3), TR.ICE, 'трава не замёрзла'); eq(g.terrAt(0, 3), TR.WOOD, 'лес/кромка'); eq(g.terrAt(8, 3), TR.GRASS, 'впереди вала уже лёд');
  w.x = 3 * T; w.y = 5 * T; ok(g.inWall(w.x, w.y) && g.coldMove(w) < 0.7, 'за валом не медленнее'); const h = w.hp; run(g, 1); ok(w.hp < h, 'мороз не жжёт');
  run(g, 5); eq(g.wall.pos, 12, 'stop'); eq(g.terrAt(11, 3), TR.ICE, 'река не замёрзла'); C.act(g, { a: 'wallOff' }); eq(g.wall, null);
});
test('общая карта битвы: registerBattle → миссия с battle берёт карту, зоны и силы своей расы и расы врага (+ more); зеркально для Чащи', () => {
  P.registerBattle('t-battle', { map: MAP, ground: '.', legend: { E: '*' }, zones: { east: { x: 13, y: 1, w: 10, h: 10 } },
    forces: { wright: [{ type: 'hall', at: 'H' }, { type: 'shooter', at: 'S', n: 2 }], thicket: [{ type: 'stump', at: 'K' }, { type: 'stinger', at: 'E', n: 3 }] } });
  P.registerMission({ id: 't-w', n: 1, camp: 'wright', race: 'wright', battle: 't-battle', zones: { mine: { at: 'S', r: 2 } }, player: { more: [{ type: 'yarina', at: 'S' }] }, objectives: [] });
  P.registerMission({ id: 't-t', n: 1, camp: 'thicket', race: 'thicket', foe: 'wright', battle: 't-battle', objectives: [] });
  const dw = C.byId('t-w'), dt = C.byId('t-t'); ok(C.playable(dw) && dw.map === MAP && dw.zones.east && dw.zones.mine, 'карта/зоны');
  const gw = C.build(dw), gt = C.build(dt);
  ok(gw.ents.some(e => e.owner === 0 && e.type === 'yarina') && gw.ents.filter(e => e.owner === 1 && e.type === 'stinger').length === 3, 'силы Мастеровых');
  ok(gt.ents.some(e => e.owner === 0 && e.type === 'stump') && gt.ents.some(e => e.owner === 1 && e.type === 'hall'), 'силы Чащи — зеркально');
  P.MISSIONS.splice(P.MISSIONS.indexOf(dw), 1); P.MISSIONS.splice(P.MISSIONS.indexOf(dt), 1); delete P.BATTLES['t-battle'];
});
test('UI кампании: сцена итога кампании (finale) и счётчики новых целей есть в campaign-ui.js; строки RU/EN новых механик', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'js/campaign-ui.js'), 'utf8');
  ok(/finale: drawFinale/.test(ui) && /UI\.openFinale/.test(ui) && /case 'site'/.test(ui) && /case 'escaped'/.test(ui) && /drawWall/.test(ui), 'нет итога/счётчиков/вала');
  for (const k of ['u_stomper', 'd_stomper', 'u_sled', 'u_envoy', 'stomp', 'stompTip', 'sideAlly', 'sideNeutral', 'siteBusy', 'siteHot', 'siteIdle', 'convoyStop', 'finT', 'finCont', 'finBtn', 'deny_stompCd'])
    { ok(P.STR.ru[k] && P.STR.en[k], k); ok(!/[а-яё]/i.test(P.STR.en[k]), 'кириллица в EN: ' + k); }
});
test('скирмиш не тронут: карта 64×48 по умолчанию, ИИ на месте, мороза нет', () => {
  const g = P.create({ seed: 1, playerRace: 'wright' }); eq([g.MW, g.MH], [64, 48]); ok(g.ai, 'нет ИИ'); eq(g.cold, 0); eq(g.mission, undefined);
  const w = g.ents.find(e => e.type === 'worker'); eq(g.coldMove(w), 1);
});
test('общее ядро (кандидат в _shared): экспорт HefestScenario без знания об игре', () => {
  ok(sb.HefestScenario === S); const src = fs.readFileSync(path.join(ROOT, 'js/scenario.js'), 'utf8'); ok(!/PORUB\.(Game|RACES|TERR|render)/.test(src), 'scenario.js знает об игре');
  const MS = S.create({ id: 'x', objectives: [{ id: 'a', done: { t: 'flag', key: 'k' } }], triggers: [{ id: 't', when: { t: 'time', gte: 1 }, do: [{ a: 'flag', key: 'k' }, { a: 'custom' }] }] });
  let t = 0, ended = null, custom = 0; const H = { now: () => t, cond: () => undefined, act: a => (a.a === 'custom' ? (custom++, true) : undefined), end: w => { ended = w; } };
  for (; t < 4; t += 0.25) S.step(MS, H, 0.25); eq(custom, 1); eq(ended, true);
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

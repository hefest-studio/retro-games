// _shared/tests/campaign-core.test.mjs — общее ядро кампаний (_shared/campaign-core.js) и кит экранов (_shared/campaign-ui-kit.js)
// на мини-сценариях, без игры: карта и легенда, точки и зоны, триггеры wait/if/repeat, цели after/hidden/opt/fail, поражение и
// автопобеда, словари условий/действий игры, строгий и «старый» порядок шага, звёзды, прогресс (сохранение, лучшие звёзды, герои,
// ветераны, перенос флагов своей и чужой кампании), финал по флагам; копии в играх совпадают с общими.
// Запуск: node _shared/tests/campaign-core.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SH = path.resolve(HERE, '..'), REPO = path.resolve(SH, '..');
const sb = { console, Math, JSON }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ['campaign-core.js', 'campaign-ui-kit.js']) vm.runInContext(fs.readFileSync(path.join(SH, f), 'utf8'), sb, { filename: f });
const K = sb.HefestCampaign, U = sb.HefestCampaignUI;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function throws(fn, re, m) { let e = null; try { fn(); } catch (x) { e = x; } ok(e && (!re || re.test(e.message)), (m || 'нет ошибки') + (e ? ': ' + e.message : '')); }
const plain = o => JSON.parse(JSON.stringify(o));

// мини-игра: мир { t, units:[{ x, y, owner, tag }], log }; условия near, many; действия spawn, ping
function mini(def, extra = {}) {
  const world = { t: 0, ended: null, units: [], log: [] };
  const MS = K.create(def, extra.flags);
  MS.points = K.parseMap(def.map || ['....'], { tiles: { '.': 0, '#': 1 } }).points;
  const H = K.handler(Object.assign({ ctx: world, now: () => world.t, end: w => { world.ended = w; world.log.push('end:' + w); },
    conds: { units: (W, c) => W.units.filter(u => !c.tag || u.tag === c.tag).length >= (c.gte || 1),
      inZone: (W, c, M) => W.units.some(u => K.inZone(M, c.zone, u.x, u.y)) },
    acts: { spawn: (W, a, M) => { const p = K.pointOf(M, a.at); for (let i = 0; i < (a.n || 1); i++) W.units.push({ x: p.x, y: p.y, tag: a.tag }); K.noteSpawn(M, a.tag); },
      ping: (W, a) => { W.log.push('ping:' + (a.v || '')); } } }, extra.H || {}));
  const run = (sec, dt = 0.25) => { for (let i = 0; i < Math.round(sec / dt); i++) { world.t += dt; K.step(MS, H, dt); } };
  return { world, MS, H, run };
}

// ---------- карта ----------
test('карта: легенда игры, точки (по умолчанию — символы не из tiles), клетка под точкой из legend/ground, хук cell', () => {
  const cells = [];
  const m = K.parseMap(['#.~A', '#oB.'], { tiles: { '#': 1, '.': 0, '~': 2, 'o': 0 }, legend: { B: '~' }, cell: (k, i, j, ch, base) => cells.push(ch + base) });
  eq([m.w, m.h], [4, 2]); eq([...m.t], [1, 0, 2, 0, 1, 0, 2, 0]); eq(Object.keys(m.points), ['A', 'B']); eq(m.points.B, [{ i: 2, j: 1 }]);
  eq(cells.join(' '), '## .. ~~ A. ## oo B~ ..');
});
test('карта: свои isPoint/under (метки ресурсов без точки), неизвестная клетка — ошибка или код unknown, кривая строка — ошибка', () => {
  const m = K.parseMap(['.aK', '.9.'], { tiles: { '.': 0, ',': 3 }, ground: ',', isPoint: ch => /[A-Z0-9]/.test(ch), under: ch => ch === 'a' || /[A-Z0-9]/.test(ch) });
  eq([...m.t], [0, 3, 3, 0, 3, 0]); eq(Object.keys(m.points).sort(), ['9', 'K']);
  throws(() => K.parseMap(['.x'], { tiles: { '.': 0 }, isPoint: () => false, id: 'm7' }), /карта m7: неизвестная клетка «x» \(1,0\)/);
  eq([...K.parseMap(['.x'], { tiles: { '.': 0 }, isPoint: () => false, unknown: 9 }).t], [0, 9]);
  throws(() => K.parseMap(['...', '..'], { tiles: { '.': 0 } }), /карта: строка 1 длиной 2, ждали 3/);
});
test('точки и зоны: центр точки, угол, круг/прямоугольник/клетки букв, центр и радиус зоны, клетки зоны в пределах карты', () => {
  const MS = { def: { zones: { c: { at: 'K', r: 1.2 }, box: { x: 0, y: 0, w: 2, h: 2 }, p: { pts: ['1', '2'] } } }, points: K.parseMap(['K1..', '.2.2', '....'], { tiles: { '.': 0 } }).points };
  eq(K.pointOf(MS, 'K'), { x: 0.5, y: 0.5 }); eq(K.pointOf(MS, '2'), { x: 2.5, y: 1.5 }); eq(K.pointOf(MS, { x: 3, y: 4 }), { x: 3, y: 4 }); eq(K.cornerOf(MS, '2'), { i: 1, j: 1 });
  throws(() => K.pointOf(MS, 'Z'), /нет точки «Z»/); throws(() => K.inZone(MS, 'nope', 0, 0), /нет зоны «nope»/);
  ok(K.inZone(MS, 'c', 1.5, 0.5) && !K.inZone(MS, 'c', 2.5, 0.5)); ok(K.inZone(MS, 'box', 1.9, 1.9) && !K.inZone(MS, 'box', 2, 0));
  ok(K.inZone(MS, 'p', 3.2, 1.7) && !K.inZone(MS, 'p', 2.2, 1.7));
  eq(K.zoneCenter(MS, 'box'), { x: 1, y: 1 }); eq(K.zoneRadius(MS, 'c'), 1.2); eq(K.zoneRadius(MS, 'p'), 1.5); eq(K.zoneRadius(MS, 'box'), 1);
  eq(K.zoneCells(MS, 'c', 4, 3), [{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 0, j: 1 }]); eq(K.zoneCells(MS, 'p', 3, 3), [{ i: 1, j: 0 }, { i: 1, j: 1 }]);
});

// ---------- сценарий ----------
test('триггеры: wait откладывает остаток списка, if/else с вложенным wait, repeat — не чаще раза в N с, разовый — один раз', () => {
  const def = { id: 'x', map: ['K...'], triggers: [
    { id: 'a', when: { t: 'time', gte: 1 }, do: [{ a: 'ping', v: 'a1' }, { a: 'wait', s: 2 }, { a: 'ping', v: 'a2' }] },
    { id: 'b', when: { t: 'time', gte: 0.5 }, do: [{ a: 'if', when: { t: 'flag', key: 'f' }, do: [{ a: 'ping', v: 'yes' }], else: [{ a: 'wait', s: 1 }, { a: 'ping', v: 'no' }] }] },
    { id: 'r', repeat: 2, when: { t: 'time', gte: 0 }, do: [{ a: 'ping', v: 'r' }] }] };
  const { world, run } = mini(def); run(4.5);
  eq(world.log.join(' '), 'ping:r ping:a1 ping:no ping:r ping:a2 ping:r');
});
test('цели: after открывается после выполнения, hidden — действием objective, opt не держит победу, все обязательные — победа через 2 с', () => {
  const def = { id: 'x', map: ['K...'], objectives: [{ id: 'one', done: { t: 'flag', key: 'one' } }, { id: 'two', after: 'one', done: { t: 'units', tag: 'g', gte: 2 } },
    { id: 'sec', hidden: true, kind: 'opt', done: { t: 'flag', key: 'never' } }],
  triggers: [{ id: 's', when: { t: 'time', gte: 1 }, do: [{ a: 'flag', key: 'one' }, { a: 'spawn', at: 'K', n: 2, tag: 'g' }, { a: 'objective', id: 'sec' }] }] };
  const { world, MS, run } = mini(def);
  eq(MS.objs.map(o => o.state), ['active', 'hidden', 'hidden']); run(1.5);
  eq(MS.objs.map(o => o.state), ['done', 'done', 'active']); eq(world.ended, null); eq(MS.spawned.g, 1);
  run(2); eq(world.ended, true); eq(MS.over, true); ok(MS.ui.some(e => e.t === 'obj' && e.id === 'two' && e.state === 'active'));
});
test('поражение: провал обязательной цели (failText → причина), список def.lose, действие lose; исход ставится один раз', () => {
  let r = mini({ id: 'x', objectives: [{ id: 'o', fail: { t: 'time', gte: 1 }, failText: 'поздно' }], lose: [{ when: { t: 'time', gte: 1 }, reason: 'lst' }] }); r.run(2);
  eq([r.world.ended, r.MS.reason, r.world.log.length], [false, 'поздно', 1]);
  r = mini({ id: 'x', objectives: [{ id: 'o', kind: 'opt', fail: { t: 'time', gte: 1 } }, { id: 'm' }], lose: [{ when: { t: 'time', gte: 1.5 }, reason: 'lst' }] }); r.run(3);
  eq([r.world.ended, r.MS.reason, r.MS.byObj.o.state], [false, 'lst', 'failed']);
  r = mini({ id: 'x', objectives: [{ id: 'o' }], triggers: [{ id: 'l', when: { t: 'time', gte: 1 }, do: [{ a: 'lose' }, { a: 'ping' }] }] }); r.run(2);
  eq([r.MS.reason, r.world.log.join()], [null, 'end:false,ping:']);
  r = mini({ id: 'x', objectives: [{ id: 'o', fail: { t: 'time', gte: 1 } }] }); r.run(2); eq(r.MS.reason, 'obj', 'причина по умолчанию');
});
test('действие win: срок delay (по умолчанию winDelay), повторный win срок не переносит; manualWin — без автопобеды', () => {
  let r = mini({ id: 'x', objectives: [{ id: 'o' }], triggers: [{ id: 'w', when: { t: 'time', gte: 1 }, do: [{ a: 'win', delay: 0.5 }] }, { id: 'w2', when: { t: 'time', gte: 1.25 }, do: [{ a: 'win', delay: 5 }] }] });
  r.run(1.25); eq(r.world.ended, null); r.run(0.5); eq(r.world.ended, true);
  r = mini({ id: 'x', manualWin: true, objectives: [{ id: 'o', done: { t: 'time', gte: 0 } }] }); r.run(5); eq(r.world.ended, null, 'manualWin');
  r = mini({ id: 'x', objectives: [{ id: 'o' }], triggers: [{ id: 'w', when: { t: 'time', gte: 1 }, do: [{ a: 'win' }] }] }, { H: { winDelay: 1.5 } }); r.run(2.25); eq(r.world.ended, null); r.run(0.5); eq(r.world.ended, true);
});
test('строгий шаг (по умолчанию) останавливается на исходе; strict:false — старый порядок ПРИИСКа: триггеры шага дорабатывают, провал цели задаёт причину', () => {
  const def = { id: 'x', objectives: [{ id: 'o', fail: { t: 'time', gte: 1 }, failText: 'цель' }], triggers: [{ id: 'a', when: { t: 'time', gte: 1 }, do: [{ a: 'lose', reason: 'триггер' }] }, { id: 'b', when: { t: 'time', gte: 1 }, do: [{ a: 'ping', v: 'b' }] }] };
  let r = mini(def); r.run(1); eq([r.MS.reason, r.world.log.join()], ['триггер', 'end:false']);
  const over = { v: false };
  r = mini(def, { H: { strict: false, failReason: null, over: () => over.v } }); r.world.end = null;
  r.H.end = w => { over.v = true; r.world.log.push('end:' + w); }; r.run(1);
  eq([r.MS.reason, r.world.log.join()], ['цель', 'end:false,ping:b,end:false']);
  r = mini({ id: 'x', objectives: [{ id: 'o' }], triggers: [{ id: 'w', when: { t: 'time', gte: 1 }, do: [{ a: 'win', delay: 0.5 }] }, { id: 'w2', when: { t: 'time', gte: 1.25 }, do: [{ a: 'win', delay: 5 }] }] }, { H: { strict: false } });
  r.run(2); eq(r.world.ended, null, 'strict:false — повторный win переносит срок, как в ПРИИСКе');
});
test('словари игры: свои условия/действия, extend — новая механика без правки ядра; неизвестное — понятная ошибка; запасные H.cond/H.act', () => {
  const r = mini({ id: 'x', map: ['K...'] });
  ok(!K.cond(r.MS, r.H, { t: 'units', gte: 1 })); K.act(r.MS, r.H, { a: 'spawn', at: 'K', tag: 'q' }); ok(K.cond(r.MS, r.H, { t: 'all', of: [{ t: 'units' }, { t: 'not', of: { t: 'flag', key: 'z' } }] }));
  throws(() => K.cond(r.MS, r.H, { t: 'magic' }), /неизвестное условие magic/); throws(() => K.act(r.MS, r.H, { a: 'magic' }), /неизвестное действие magic/);
  K.extend(r.H, { conds: { magic: () => true }, acts: { magic: (W) => W.log.push('magic') } }); ok(K.cond(r.MS, r.H, { t: 'magic' })); K.act(r.MS, r.H, { a: 'magic' }); eq(r.world.log, ['magic']);
  throws(() => K.cond(r.MS, r.H, { t: 'constructor' }), /неизвестное условие constructor/, 'имя из прототипа объекта — не условие');
  const MS = K.create({ id: 'y' }), H = { now: () => 0, end() {}, cond: c => (c.t === 'old' ? 1 : undefined), act: a => (a.a === 'old' ? true : undefined) };
  ok(K.cond(MS, H, { t: 'old' }) === true); K.act(MS, H, { a: 'old' }); K.act(MS, H, { a: 'say', who: 'h', text: 'т' }); eq(MS.ui[0].life, 6, 'H — простой объект, умолчания ядра');
  throws(() => K.handler({ now: () => 0 }), /нужны now\(\) и end\(win\)/);
});
test('общие условия: since, obj state, heroDead, killed (тег, список тегов, тег:тип); звёзды — на момент победы', () => {
  const r = mini({ id: 'x', objectives: [{ id: 'o', done: { t: 'flag', key: 'k' } }], stars: [{ when: { t: 'killed', tag: ['a', 'b'], gte: 3 } }, { when: { t: 'heroDead', hero: 'h' } }, { when: { t: 'killed', tag: 'a', type: 'wolf' } }] });
  K.noteKill(r.MS, 'a', 'wolf'); K.noteKill(r.MS, 'b', 'bear'); K.noteKill(r.MS, 'b'); K.noteKill(r.MS, null, 'x');
  eq(plain(r.MS.killed), { a: 1, 'a:wolf': 1, b: 2, 'b:bear': 1 });
  r.MS.flags.k = 1; r.run(0.25); ok(K.cond(r.MS, r.H, { t: 'obj', id: 'o' })); ok(!K.cond(r.MS, r.H, { t: 'since', obj: 'o', gte: 1 })); r.world.t += 1; ok(K.cond(r.MS, r.H, { t: 'since', obj: 'o', gte: 1 }));
  eq(K.stars(r.MS, r.H, true), [true, true, false, true]); eq(K.stars(r.MS, r.H, false), [false, false, false, false]);
  r.MS.heroes.h = 5; r.MS.heroDead.h = true; eq(plain(K.heroesOf(r.MS)), { h: { alive: false } });
});
test('группа: setGroup — умолчания (owner 1, hold), свои поля игры, тревога сохраняется при смене приказа', () => {
  const MS = { groups: {} }; K.setGroup(MS, { tag: 'g', mode: 'patrol' }, { t: 0 }); MS.groups.g.alerted = true;
  K.setGroup(MS, { tag: 'g', mode: 'attack', target: 'K' }, { t: 0 }); eq(plain(MS.groups.g), { owner: 1, mode: 'attack', ri: 0, t: 0, alerted: true, tag: 'g', target: 'K' });
});

// ---------- прогресс ----------
function memStore() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }
test('сохранение: формат v1 прежний (с ветеранами и меткой кампании — по опциям), битое/чужое → новое, хранилище бросает — без падения', () => {
  eq(K.newSave(), { v: 1, unlocked: 1, missions: {}, flags: {}, roster: { heroes: {} } }); eq(K.newSave({ vets: true, camp: 'sizye' }), { v: 1, unlocked: 1, missions: {}, flags: {}, roster: { heroes: {}, vets: [] }, camp: 'sizye' });
  const st = memStore(); st.setItem('k', '{не json'); eq(K.load(st, 'k'), K.newSave()); st.setItem('k', JSON.stringify({ v: 2, unlocked: 5 })); eq(K.load(st, 'k').unlocked, 1);
  st.setItem('k', JSON.stringify({ v: 1, unlocked: '3', missions: 7, flags: null, roster: { heroes: { h: { wounded: true } }, vets: 'x' } }));
  eq(K.load(st, 'k', { vets: true }), { v: 1, unlocked: 3, missions: {}, flags: {}, roster: { heroes: { h: { wounded: true } }, vets: [] } });
  const bad = { getItem() { throw new Error('нет доступа'); }, setItem() { throw new Error('квота'); }, removeItem() { throw new Error('x'); } };
  eq(K.load(bad, 'k'), K.newSave()); eq(K.save(bad, 'k', {}), false); eq(K.reset(bad, 'k', { vets: true }).roster.vets, []); eq(K.load(null, 'k'), K.newSave());
  // сохранение старого формата читается и пишется обратно без изменений (ключи игр прежние — проверяют их тесты)
  const old = { v: 1, unlocked: 4, missions: { m1: { stars: [true, false, true], time: 300, lostU: 1, lostB: 0 } }, flags: { convoy: 'raided' }, roster: { heroes: { varvara: { wounded: false } }, vets: [{ type: 'rifleman', vet: 2, kills: 5 }] } };
  st.setItem('o', JSON.stringify(old)); const d = K.load(st, 'o', { vets: true }); eq(d, old); ok(K.save(st, 'o', d)); eq(st.getItem('o'), JSON.stringify(old));
});
test('итог миссии: лучшие звёзды и время, флаги, герои (пал — ранен), ветераны (до N), открывается n + 1; поражение ничего не меняет', () => {
  let d = K.newSave({ vets: true });
  K.applyResult(d, { id: 'm2', n: 2, win: false, stars: [false], time: 9, flags: { x: 1 } }); eq(d, K.newSave({ vets: true }));
  K.applyResult(d, { id: 'm2', n: 2, win: true, stars: [true, true, false], time: 500, lostU: 3, lostB: 1, flags: { route: 'short' }, heroes: { a: { alive: false }, b: { alive: true } }, vets: [1, 2, 3, 4].map(k => ({ type: 't' + k })) }, { vets: 3 });
  K.applyResult(d, { id: 'm2', n: 2, win: true, stars: [true, false, true], time: 600, lostU: 0, lostB: 0, flags: { route: 'long' }, heroes: { a: { alive: true } }, vets: [] }, { vets: 3 });
  eq(d.missions.m2, { stars: [true, true, true], time: 500, lostU: 0, lostB: 0 }); eq(d.flags.route, 'long'); eq(d.roster.heroes, { a: { wounded: false }, b: { wounded: false } }); eq(d.unlocked, 3); eq(d.roster.vets, []);
  ok(!K.wounded(d, 'a')); d.roster.heroes.a.wounded = true; ok(K.wounded(d, 'a')); ok(!K.wounded(null, 'a'));
  const e = K.newSave(); K.applyResult(e, { id: 'q', win: true, stars: [true], time: 1 }); eq(e.unlocked, 1, 'без номера — не открывает'); K.applyResult(e, { id: 'q', win: true, stars: [true], time: 1 }, { n: 4 }); eq(e.unlocked, 5);
  ok(!('vets' in e.roster), 'без vets ветераны не заводятся');
});
test('перенос флагов: carry — из своей кампании, xcarry — из чужой как camp.flag + camp.done; нет сохранения — нет флагов', () => {
  const sv = { missions: { m1: {}, m2: {} }, flags: { convoy: 'raided', alliance: 'ally' } };
  eq(K.carried({ carry: ['convoy', 'nope'] }, sv), { convoy: 'raided' }); eq(K.carried({ carry: ['convoy'] }, null), {});
  const asked = []; const get = c => { asked.push(c); return c === 'copper' ? sv : null; };
  eq(K.xcarried({ xcarry: { copper: ['alliance', 'nope'], sizye: ['x'] } }, get), { 'copper.done': 2, 'copper.alliance': 'ally' }); eq(asked, ['copper', 'sizye']);
  const def = { id: 'e', flags: { base: 1 }, objectives: [] }; eq(plain(K.create(def, Object.assign(K.carried({ carry: ['convoy'] }, sv), { t: 2 })).flags), { base: 1, convoy: 'raided', t: 2 });
});
test('открытие флагами других кампаний (unlockState) и финал по флагам: flagsMatch, pick, flagCond (+ свой тип), starsOf', () => {
  const saves = { a: { missions: { fin: {} }, flags: { end: 'peace' } }, b: { missions: {}, flags: { end: 'war' } } }, done = (k, s) => !!(s && s.missions.fin);
  eq(K.unlockState({ a: { end: ['peace', 'truce'] }, b: { end: 'war' } }, k => saves[k], done), { open: false, camps: { a: { done: true, match: true }, b: { done: false, match: true } } });
  saves.b.missions.fin = {}; eq(K.unlockState({ a: { end: 'peace' }, b: { end: 'war' } }, k => saves[k], done).open, true); eq(K.unlockState({}, k => saves[k], done).open, false);
  ok(K.flagsMatch({ a: 1, b: [2, 3] }, { a: 1, b: 3 }) && !K.flagsMatch({ a: 1 }, { a: 2 }) && K.flagsMatch(null, {}));
  eq(K.pick({ key: 'e', good: 'Г', other: 'Д' }, { e: 'good' }), 'Г'); eq(K.pick({ key: 'e', good: 'Г', other: 'Д' }, { e: 'x' }), 'Д'); eq(K.pick({ ru: 'т' }, {}), { ru: 'т' }); eq(K.pick(null, {}), null);
  const fl = { a: 'x', b: true };
  ok(K.flagCond(null, fl) && K.flagCond({ t: 'all', of: [{ t: 'flag', key: 'a', value: 'x' }, { t: 'flag', key: 'b' }] }, fl) && !K.flagCond({ t: 'not', of: { t: 'any', of: [{ t: 'flag', key: 'b' }] } }, fl));
  ok(!K.flagCond({ t: 'stars', gte: 2 }, fl)); ok(K.flagCond({ t: 'stars', gte: 2 }, fl, w => w.t === 'stars' && 3 >= w.gte));
  const st = K.starsOf([{ id: 'm1', n: 1 }, { id: 'm2', n: 2 }], { missions: { m1: { stars: [true, false, true, true] } } });
  eq(st, { rows: [{ n: 1, id: 'm1', stars: [true, false, true], done: true }, { n: 2, id: 'm2', stars: [false, false, false], done: false }], total: 2, max: 6 });
  eq(K.starsOf([{ id: 'm1', n: 1 }], null).total, 0);
});
test('реестр и карта кампании: upsert заменяет по id и сортирует по n; nodeState — пройдена / открыта / закрыта', () => {
  const l = []; K.upsert(l, { id: 'b', n: 2 }); K.upsert(l, { id: 'a', n: 1 }); K.upsert(l, { id: 'b', n: 2, v: 2 }); eq(l, [{ id: 'a', n: 1 }, { id: 'b', n: 2, v: 2 }]);
  const d = { unlocked: 2, missions: { a: {} } }; eq([K.nodeState({ id: 'a', n: 1 }, d), K.nodeState({ id: 'b', n: 2 }, d), K.nodeState({ id: 'c', n: 3 }, d)], ['done', 'open', 'closed']);
  eq(K.txt({ ru: 'р', en: 'e' }, 'en'), 'e'); eq(K.txt({ ru: 'р' }, 'en'), 'р'); eq(K.txt('s', 'en'), 's'); eq(K.txt(null), '');
});

// ---------- кит экранов ----------
test('кит экранов: перенос строк, «мм:сс», звезда, кнопка под точкой (верхняя — последняя), точка события в координатах canvas', () => {
  const c = { font: '', measureText: s => ({ width: s.length * 10 }), pts: [], beginPath() { this.pts = []; }, lineTo(x, y) { this.pts.push([x, y]); }, closePath() {} };
  eq(U.wrap(c, 'раз два три четыре', 75, 14, 700, 'F'), ['раз два', 'три', 'четыре']); eq(c.font, '700 14px F'); eq(U.wrap(c, 'оченьдлинноеслово', 20, 12, null, 'F'), ['оченьдлинноеслово']);
  eq([U.fmtTime(0), U.fmtTime(61.4), U.fmtTime(3599.6), U.fmtTime(-5, true), U.fmtTime(null)], ['00:00', '01:01', '60:00', '00:00', '00:00']);
  U.starPath(c, 10, 10, 8); eq(c.pts.length, 10); eq(c.pts[0].map(Math.round), [10, 2]);
  const hot = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 40, y: 20, w: 20, h: 20 }]; eq([U.hitAt(hot, { x: 45, y: 25 }), U.hitAt(hot, { x: 5, y: 5 }), U.hitAt(hot, { x: 100, y: 5 })], [1, 0, -1]);
  const cv = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 640, height: 360 }) }; eq(U.canvasPoint(cv, { clientX: 330, clientY: 200 }, 1280, 720), { x: 640, y: 360 });
  const ls = {}, cv2 = Object.assign({ style: {}, addEventListener: (n, f) => { ls[n] = f; }, removeEventListener: (n) => { delete ls[n]; } }, cv); let pressed = -1, hov = -2, act = true, prevented = 0;
  const off = U.bindHot(cv2, { active: () => act, list: () => hot, size: () => ({ w: 1280, h: 720 }), press: (i) => { pressed = i; }, hover: (i) => { hov = i; } });
  ls.pointermove({ clientX: 12, clientY: 22 }); eq([hov, cv2.style.cursor], [0, 'pointer']); ls.pointerdown({ clientX: 12, clientY: 22, preventDefault: () => prevented++ }); eq([pressed, prevented], [0, 1]);
  act = false; ls.pointerdown({ clientX: 12, clientY: 22, preventDefault: () => prevented++ }); eq(prevented, 1, 'неактивный экран'); off(); eq(Object.keys(ls), []);
});

// ---------- копии в играх и отсутствие знаний об игре ----------
test('ядро и кит без знания об игре и без DOM; копии js/campaign-core.js, js/campaign-ui-kit.js в играх совпадают с _shared (bash build.sh)', () => {
  for (const f of ['campaign-core.js', 'campaign-ui-kit.js']) {
    const src = fs.readFileSync(path.join(SH, f), 'utf8'), body = src.replace(/^\/\*[\s\S]*?\*\//, '');
    ok(src.includes('Источник — _shared/' + f), f + ': нет метки источника для build.sh'); ok(!/PRIISK|PORUB|document\.|localStorage/.test(body), f + ' знает об игре или DOM');
    let copies = 0;
    for (const d of fs.readdirSync(REPO)) {
      const idx = path.join(REPO, d, 'index.html'); if (!fs.existsSync(idx) || !fs.readFileSync(idx, 'utf8').includes('src="./js/' + f + '"')) continue;
      eq(fs.readFileSync(path.join(REPO, d, 'js', f), 'utf8') === src, true, d + '/js/' + f + ' рассинхронизирован (bash build.sh)'); copies++;
    }
    ok(copies >= 2, f + ': ждали копии в priisk и porubezhye, нашли ' + copies);
  }
  ok(/CAMPAIGN_FILES=.*campaign-core\.js/.test(fs.readFileSync(path.join(REPO, 'build.sh'), 'utf8')), 'build.sh не синхронизирует файлы кампаний');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

/* СБОРКА · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node sborka/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/maps.js, js/game.js) — в node:vm с шимом window.
   Покрытие: конструктор (цены, характеристики, валидность всех 1125 сборок), поиск пути по рельефу для разных шасси
   (камни, болото, скалы, дорога, без срезания углов), экономика (нет тупика: с нуля база всегда даёт дешёвого робота),
   захват заводов (спор, база — только после ядра), ядро/руины/отстройка, бой, турель и ремонт у базы, приказы, прямое
   управление, условия победы, генератор карт (симметрия, достижимость), сохранение боя (детерминизм после восстановления),
   ИИ Артели не зависает (ИИ против ИИ на всех картах), производительность (100 роботов), i18n, музыка, страница,
   правило имён; баланс — ботом-полководцем с реакцией 150–250 мс (tests/bot.mjs): карта 1 — ≥ 70% побед. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/maps.js', 'js/game.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const SB = sandbox.SBORKA, L = SB.logic, MP = SB.maps, T = L.T, TS = L.TS;
const { playMap, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 30); i++){ if (fn && fn(i) === false) return i; game.update(1 / 30); } return -1; }
// Своя карта из строк: '.' земля, '^' камни, '~' болото, '#' скала, '=' дорога; 'P' — база игрока, 'E' — база Артели, 'm/e/d/a/c' — цеха
function mapFrom(rows){
  const h = rows.length, w = rows[0].length, t = new Array(w * h).fill(T.GROUND), facs = [];
  const K = { m: 'metal', e: 'energy', d: 'drive', a: 'arms', c: 'chips' };
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    t[y * w + x] = ch === '^' ? T.ROCK : ch === '~' ? T.SWAMP : ch === '#' ? T.CLIFF : ch === '=' ? T.ROAD : T.GROUND;
    if (ch === 'P') facs.push({ type: 'base', tx: x, ty: y, owner: 0 });
    if (ch === 'E') facs.push({ type: 'base', tx: x, ty: y, owner: 1 });
    if (K[ch]) facs.push({ type: K[ch], tx: x, ty: y, owner: -1 });
  }));
  facs.sort((a, b) => (a.type === 'base' ? a.owner : 9) - (b.type === 'base' ? b.owner : 9));
  return { w, h, t, factories: facs, biome: 'meadow' };
}
const SPEC0 = Object.assign({}, MP.MAPS[0], { lvl: 0 });
function quiet(rows, opts = {}){ return SB.Game(Object.assign({ spec: SPEC0, map: mapFrom(rows), startRobots: false, aiSides: [] }, opts)); }
const OPEN = ['##############################', ...Array.from({ length: 14 }, (_, y) => '#' + (y === 11 ? 'P..' : '...') + '.'.repeat(21) + (y === 1 ? 'E..' : '...') + '#'), '##############################'];

// ---------- Конструктор ----------
test('конструктор: цены сборок складываются из шасси, модулей и электроники; ресурсы пяти видов', () => {
  eq(L.RES, ['metal', 'energy', 'drive', 'arms', 'chips']);
  eq(L.costOf(L.TPL.scout), { metal: 4, energy: 0, drive: 1, arms: 1, chips: 0 }, 'разведчик');
  eq(L.costOf({ chassis: 'hover', w: ['beam', 'core', null], brain: 'smart' }), { metal: 6, energy: 11, drive: 2, arms: 3, chips: 3 }, 'антиграв+луч+ядро+умный');
  const c1 = L.costOf({ chassis: 'tracks', w: ['hammer'] }), c2 = L.costOf({ chassis: 'tracks', w: ['hammer', 'hammer'] });
  ok(c2.metal - c1.metal === L.WEAPON.hammer.cost.metal && c2.arms - c1.arms === L.WEAPON.hammer.cost.arms, 'второй модуль — плюс его цена');
  ok(L.costOf({ chassis: 'wheels', w: ['hammer'], brain: 'basic' }).chips === 1, 'мозг стоит электронику');
});
test('конструктор: характеристики — гусеницы крепче, колёса быстрее, модули утяжеляют, мозг даёт обзор и точность', () => {
  const W = L.stats({ chassis: 'wheels', w: ['hammer'] }), Tr = L.stats({ chassis: 'tracks', w: ['hammer'] }), Hv = L.stats({ chassis: 'hover', w: ['hammer'] });
  ok(Tr.hp > Hv.hp && Hv.hp > W.hp, 'прочность: ' + [W.hp, Hv.hp, Tr.hp]);
  ok(W.speed > Hv.speed && Hv.speed > Tr.speed, 'скорость: ' + [W.speed, Hv.speed, Tr.speed].map(Math.round));
  const W3 = L.stats({ chassis: 'wheels', w: ['hammer', 'rocket', 'beam'] }); ok(W3.speed < W.speed && W3.hp > W.hp, 'три модуля тяжелее и крепче');
  eq(W3.range, L.WEAPON.rocket.range, 'дальность — по самому дальнобойному'); ok(Math.abs(W3.dps - (2 / 1 + 3 / 2.1 + 1 / 0.3)) < 1e-9, 'урон/с — сумма');
  const b0 = L.stats({ chassis: 'wheels', w: ['hammer'], brain: 'none' }), b2 = L.stats({ chassis: 'wheels', w: ['hammer'], brain: 'smart' });
  ok(b2.sight > b0.sight && b2.acc > b0.acc, 'умный мозг видит дальше и стреляет точнее');
  ok(L.stats({ chassis: 'tracks', w: ['core'] }).core && L.stats({ chassis: 'tracks', w: ['core'] }).range === 0, 'ядро — не оружие');
});
test('конструктор: валидность — нужен модуль, не больше 3 слотов и одного ядра; все 1125 сборок проверены', () => {
  eq(L.validate({ chassis: 'wheels', w: [null, null, null] }).why, 'empty');
  eq(L.validate({ chassis: 'wheels', w: ['core', 'core'] }).why, 'cores');
  eq(L.validate({ chassis: 'wheels', w: ['hammer', 'hammer', 'hammer', 'hammer'] }).why, 'slots');
  eq(L.validate({ chassis: 'wheels', w: ['laser'] }).why, 'module');
  eq(L.validate({ chassis: 'legs', w: ['hammer'] }).why, 'chassis');
  eq(L.validate({ chassis: 'wheels', w: ['hammer'], brain: 'giant' }).why, 'brain');
  let n = 0, valid = 0;
  for (const ch of L.CH_LIST) for (const a of L.W_LIST) for (const b of L.W_LIST) for (const c of L.W_LIST) for (const br of L.BR_LIST){
    const d = { chassis: ch, w: [a, b, c], brain: br }, v = L.validate(d), cost = L.costOf(d), st = L.stats(d); n++;
    const mods = [a, b, c].filter(Boolean), cores = mods.filter(x => x === 'core').length;
    eq(v.ok, mods.length > 0 && cores <= 1, JSON.stringify(d));
    if (v.ok) valid++;
    ok(L.RES.every(r => cost[r] >= 0 && Number.isFinite(cost[r])) && st.hp > 0 && st.speed > 20 && Number.isFinite(st.dps), 'числа: ' + JSON.stringify(d));
  }
  eq(n, 1125); console.log('     сборок: ' + n + ', годных: ' + valid);
  Object.keys(L.TPL).forEach(k => ok(L.validate(L.TPL[k]).ok, 'образец ' + k));
});

// ---------- Путь по рельефу ----------
const TERR = [
  '####################',
  '#......^^...~~.....#',
  '#......^^...~~.....#',
  '#......^^...~~.....#',
  '#......^^...~~.....#',
  '#......^^...~~.....#',
  '#......^^...~~.....#',
  '####################'];
test('путь: колёса не проходят камни, гусеницы — камни, но не болото, антиграв — всё, кроме скал', () => {
  const M = mapFrom(TERR);
  ok(!L.astar(M, 2, 3, 10, 3, L.CHASSIS.wheels.pass), 'колёса — нет'); ok(L.astar(M, 2, 3, 10, 3, L.CHASSIS.tracks.pass), 'гусеницы через камни');
  ok(!L.astar(M, 2, 3, 16, 3, L.CHASSIS.tracks.pass), 'гусеницы не в болото'); ok(L.astar(M, 2, 3, 16, 3, L.CHASSIS.hover.pass), 'антиграв над болотом');
  const M2 = mapFrom(['#######', '#..#..#', '#######']); L.CH_LIST.forEach(c => ok(!L.astar(M2, 1, 1, 5, 1, L.CHASSIS[c].pass), 'скала держит ' + c));
});
test('путь: 8 сторон без срезания углов; сглаженный путь проходим; дорога выгоднее для колёс', () => {
  const M = mapFrom(['##########', '#....#...#', '#.##.#.#.#', '#..#...#.#', '##.#####.#', '#........#', '##########']);
  const p = L.astar(M, 1, 1, 8, 1, L.CHASSIS.wheels.pass); ok(p, 'путь есть');
  for (let i = 1; i < p.length; i++){ const [x0, y0] = p[i - 1], [x1, y1] = p[i];
    ok(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) === 1); ok(L.tget(M, x1, y1) !== T.CLIFF);
    if (x1 !== x0 && y1 !== y0) ok(L.tget(M, x1, y0) !== T.CLIFF && L.tget(M, x0, y1) !== T.CLIFF, 'угол не срезан'); }
  const px = L.findPath(M, 24, 24, 136, 24, L.CHASSIS.wheels.pass, 4); let ax = 24, ay = 24;
  px.forEach(q => { ok(L.walkable(M, ax, ay, q.x, q.y, L.CHASSIS.wheels.pass, 0), 'отрезок проходим'); ax = q.x; ay = q.y; });
  // дорога в обход: колёса выберут её, если она быстрее прямой по земле
  const R = mapFrom(['##########', '#========#', '#........#', '#........#', '##########']);
  const pr = L.astar(R, 1, 2, 8, 2, [1, 0, 0, 0, 0.2]), pr2 = L.astar(R, 1, 2, 8, 2, [1, 0, 0, 0, 3]);
  ok(pr.every(q => q[1] >= 2), 'медленная дорога — в обход'); ok(pr2.some(q => q[1] === 1), 'быстрая дорога — по ней');
});
test('движение: гусеничный робот доезжает через камни, колёсный — встаёт, антиграв — через болото; никто не въезжает в скалу', () => {
  const g = quiet(['######################', '#P.....^^...~~.......#', '#......^^...~~.......#', '#......^^...~~......E#', '#......^^...~~.......#', '######################']), S = g.state();
  const tr = g._spawn(0, { chassis: 'tracks', w: ['hammer'] }, 40, 72, 'guard'), wh = g._spawn(0, { chassis: 'wheels', w: ['hammer'] }, 40, 56, 'guard'), hv = g._spawn(0, { chassis: 'hover', w: ['hammer'] }, 40, 40, 'guard');
  g.order([tr.id, wh.id], 'guard', 10 * TS + 8, 3 * TS + 8); g.order([hv.id], 'guard', 16 * TS + 8, 2 * TS + 8);
  let bad = 0; run(g, 25, () => { S.robots.forEach(r => { if (!r.st.pass[L.tileAt(S.map, r.x, r.y)]) bad++; }); });
  eq(bad, 0, 'в непроходимых клетках'); ok(D(tr, { x: 168, y: 56 }) < 8, 'гусеницы доехали: ' + tr.x.toFixed(0)); ok(wh.x < 7 * TS, 'колёса остались до камней'); ok(D(hv, { x: 264, y: 40 }) < 8, 'антиграв перелетел болото');
});

// ---------- Экономика ----------
test('экономика: заводы дают свой ресурс; база — всё понемногу; потолок 99', () => {
  const g = quiet(['##########', '#P..m.e..#', '#........#', '#..d.a.c.#', '#.......E#', '##########']), S = g.state();
  S.factories.forEach(f => { if (f.type !== 'base') f.owner = 0; });
  L.RES.forEach(r => { S.res[0][r] = 0; }); run(g, 60);
  L.RES.forEach(r => ok(S.res[0][r] > 60 / L.PROD.base[r] + (r === 'chips' ? 60 / L.PROD.chips.chips : 0) * 0.8, r + ': ' + S.res[0][r]));
  S.res[0].metal = 98; run(g, 30); eq(S.res[0].metal, 99, 'потолок');
});
test('экономика: нет тупика — с нулём ресурсов и одной базой дешёвый робот собирается за ≤ 30 с', () => {
  const g = quiet(OPEN), S = g.state();
  L.RES.forEach(r => { S.res[0][r] = 0; });
  eq(g.build(0, L.TPL.scout).why, 'res', 'сразу нельзя');
  let t = -1; run(g, 40, i => { if (L.canAfford(S.res[0], L.costOf(L.TPL.scout))) { t = i / 30; return false; } });
  ok(t > 0 && t <= 30, 'накопилось за ' + t.toFixed(1) + ' с');
  const b = g.build(0, L.TPL.scout); ok(b.ok && b.robot.side === 0, 'собран'); ok(L.RES.every(r => S.res[0][r] >= 0), 'долгов нет');
  // и даже без базы стартовый запас + любой цех... база не теряется бесследно: без своих заводов сборка невозможна, а не зависает
  S.factories[0].owner = 1; eq(g.build(0, L.TPL.scout).why, 'factory');
});
test('сборка: на любом своём заводе, предел 24 робота, деньги списываются', () => {
  const g = quiet(['############', '#P...m.....#', '#..........#', '#.........E#', '############']), S = g.state();
  const m = S.factories.find(f => f.type === 'metal'); eq(g.build(0, L.TPL.scout, m.id).why, 'factory', 'нейтральный — нельзя');
  m.owner = 0; S.res[0] = { metal: 99, energy: 99, drive: 99, arms: 99, chips: 99 };
  const b = g.build(0, L.TPL.tank, m.id, 'guard'); ok(b.ok && D(b.robot, m) < 40, 'собран у литейного'); eq(b.robot.order.kind, 'guard');
  eq(S.res[0].metal, 99 - L.costOf(L.TPL.tank).metal);
  for (let i = 0; i < 30; i++) { S.res[0] = { metal: 99, energy: 99, drive: 99, arms: 99, chips: 99 }; g.build(0, L.TPL.scout); }
  eq(S.robots.filter(r => r.side === 0).length, L.ROBOT_CAP); eq(g.build(0, L.TPL.scout).why, 'cap');
  eq(g.build(0, { chassis: 'wheels', w: [] }).why, 'empty');
});

// ---------- Захват, ядро, бой ----------
test('захват: робот на площадке берёт нейтральный цех за 7 с; при споре прогресс стоит', () => {
  const g = quiet(['############', '#P...m.....#', '#..........#', '#.........E#', '############']), S = g.state(), m = S.factories.find(f => f.type === 'metal');
  const r = g._spawn(0, L.TPL.scout, m.x, m.y, 'guard'); g.order([r.id], 'guard', m.x, m.y);
  const e = g._spawn(1, { chassis: 'tracks', w: ['beam'] }, m.x + 6, m.y, 'guard'); g.order([e.id], 'guard', m.x + 6, m.y); S.invuln = true; e.st.guns = []; e.hp = e.max = 1e9;
  run(g, 10); eq(m.owner, -1, 'спор'); eq(m.cap.prog, 0);
  e.dead = true; let t = -1; run(g, 12, i => { if (m.owner === 0) { t = i / 30; return false; } });
  ok(t > 6 && t < 8, 'захват за ' + t.toFixed(1) + ' с'); eq(S.stats.caps[0], 1);
});
test('база Артели: без ядра не захватывается; ядро выключает оборону на 40 с — тогда берётся', () => {
  const g = quiet(OPEN), S = g.state(), eb = S.factories[1]; S.invuln = true;
  const rs = [0, 1, 2].map(i => g._spawn(0, { chassis: 'tracks', w: ['core', 'hammer'], brain: 'basic' }, eb.x - 4 + i * 4, eb.y + 4, 'guard'));
  g.order(rs.map(r => r.id), 'guard', eb.x, eb.y);
  run(g, 35); eq(eb.owner, 1, 'база стоит'); eq(eb.cap.prog, 0);
  ok(g._detonate(rs[0], eb), 'подрыв'); ok(eb.disT > 0 && !rs[0].core, 'оборона выключена, ядро израсходовано');
  let t = -1; run(g, 40, i => { if (eb.owner === 0) { t = i / 30; return false; } });
  ok(t > 0, 'взята за ' + t.toFixed(1) + ' с'); run(g, 1); eq(S.phase, 'won'); eq(S.result.how, 'base');
});
test('ядро: приказ «рушить заводы» — сапёр сам едет к цеху Артели и подрывает; руины отстраиваются нейтральными через 45 с', () => {
  const g = quiet(['##################', '#P...........a...#', '#................#', '#...............E#', '##################']), S = g.state(), a = S.factories.find(f => f.type === 'arms');
  a.owner = 1; S.invuln = true;
  const s = g._spawn(0, L.TPL.sapper, 60, 40, 'factories');
  let t = -1; run(g, 40, i => { if (a.ruinT > 0) { t = i / 30; return false; } });
  ok(t > 0, 'подорвал за ' + t.toFixed(1) + ' с'); eq(a.owner, -1); ok(!s.core);
  const before = S.res[1].arms; run(g, 20); eq(a.ruinT > 0, true, 'руины'); ok(g.factoryAt(a.x, a.y) === a);
  ok(S.res[1].arms - before <= Math.ceil(20 / L.PROD.base.arms) + 1, 'руины ничего не производили: +' + (S.res[1].arms - before));
  run(g, 27); eq(a.ruinT, 0, 'отстроен'); eq(a.owner, -1, 'нейтральный');
});
test('бой: молот-пушки разбивают врага; луч бьёт только вблизи; турель базы стреляет, у базы свои чинятся', () => {
  const g = quiet(OPEN), S = g.state();
  const a = g._spawn(0, { chassis: 'tracks', w: ['hammer', 'hammer'], brain: 'smart' }, 200, 120, 'guard'), e = g._spawn(1, L.TPL.scout, 260, 120, 'guard');
  g.order([e.id], 'guard', 260, 120);
  run(g, 15); ok(e.dead || !S.robots.includes(e), 'враг разбит'); eq(S.stats.kills[0], 1);
  a.dead = true; run(g, 0.1);
  const b = g._spawn(0, { chassis: 'tracks', w: ['beam'] }, 200, 160, 'guard'), e2 = g._spawn(1, { chassis: 'tracks', w: ['beam'] }, 200 + 90, 160, 'guard'); b.order.x = 200; e2.order = { kind: 'guard', x: 290, y: 160 };
  b.thinkT = 99; e2.thinkT = 99; b.tgt = e2.id; run(g, 3); eq(e2.hp, e2.max, 'луч не достаёт на 90 px');
  const pb = S.factories[0], t = g._spawn(1, { chassis: 'tracks', w: ['hammer'] }, pb.x + 90, pb.y, 'guard'); t.st.guns = []; t.thinkT = 99;
  run(g, 4); ok(t.hp < t.max, 'турель базы попала');
  const hurt = g._spawn(0, L.TPL.tank, pb.x + 10, pb.y + 10, 'guard'); hurt.hp = 3; hurt.thinkT = 99; run(g, 6); ok(hurt.hp > 6, 'ремонт у базы: ' + hurt.hp.toFixed(1));
});
test('приказы: «за мной» — к дирижаблю; «охрана» — на точку; «бить роботов» с мозгом — через всю долину; «захват» — к ближнему цеху', () => {
  const g = quiet(['##############################', '#P...........................#', '#...........m................#', '#............................#', '#............................#', '#...........................E#', '##############################']), S = g.state(); S.invuln = true;
  const f = g._spawn(0, L.TPL.scout, 60, 40, 'follow'); g.setShip(300, 70); run(g, 8); ok(D(f, S.ship) < 40, 'у дирижабля: ' + D(f, S.ship).toFixed(0));
  g.order([f.id], 'guard', 100, 70); run(g, 6); ok(D(f, { x: 100, y: 70 }) < 6, 'на точке охраны');
  const h = g._spawn(0, { chassis: 'wheels', w: ['hammer'], brain: 'basic' }, 60, 70, 'robots'), e = g._spawn(1, L.TPL.scout, 420, 80, 'guard'); e.st.guns = []; g.order([e.id], 'guard', 420, 80);
  run(g, 12); ok(!S.robots.includes(e), 'охотник нашёл и разбил');
  const c = g._spawn(0, L.TPL.scout, 60, 60, 'capture'); run(g, 15); ok(S.factories.find(q => q.type === 'metal').owner === 0, 'цех захвачен');
  eq(g.order([c.id], 'dance'), 0, 'неизвестный приказ отклонён');
});
test('прямое управление: вселиться, ехать клавишами по проходимым клеткам, стрелять, выйти (робот остаётся охранять)', () => {
  const g = quiet(TERR.map((r, y) => y === 2 ? '#P' + r.slice(2) : y === 5 ? r.slice(0, 18) + 'E#' : r)), S = g.state(); S.invuln = true;
  const r = g._spawn(0, { chassis: 'wheels', w: ['hammer'] }, 50, 72, 'capture');
  ok(g.possess(r.id) && S.poss === r.id); g.drive(1, 0, false); run(g, 6);
  ok(r.x > 80 && r.x < 7 * TS, 'доехал до камней и встал: ' + r.x.toFixed(0));
  const e = g._spawn(1, L.TPL.scout, r.x, r.y + 40, 'guard'); e.st.guns = []; e.thinkT = 99; g.drive(0, 0, true); run(g, 10); ok(!S.robots.includes(e), 'огонь в прямом управлении');
  ok(!g.detonate(), 'без ядра подрыва нет');
  ok(g.release() && S.poss === null); eq(r.order.kind, 'guard');
  ok(!g.possess(e.id), 'вражеского нельзя');
});
test('победа и поражение: удержание всех цехов 90 с; потеря своей базы — поражение', () => {
  const g = quiet(['##########', '#P..m....#', '#....e...#', '#.......E#', '##########']), S = g.state();
  S.factories.forEach(f => { if (f.type !== 'base') f.owner = 0; });
  run(g, 85); eq(S.phase, 'play'); ok(S.allT[0] > 80); run(g, 6); eq(S.phase, 'won'); eq(S.result.how, 'all');
  const g2 = quiet(OPEN), S2 = g2.state(); S2.factories[0].owner = 1; run(g2, 0.1); eq(S2.phase, 'lost'); eq(S2.result.won, false);
});

// ---------- Карты ----------
test('карты: 5 кампании + схватка; детерминизм, центральная симметрия, база↔база по дороге для колёс, все цеха достижимы гусеницами', () => {
  eq(MP.MAPS.length, 5); MP.MAPS.forEach((m, i) => { eq(m.id, i + 1); eq(m.lvl, i); });
  const specs = MP.MAPS.concat([1, 2, 3, 7, 11, 19, 23, 42].map(s => MP.skirmish(s)));
  specs.forEach(spec => {
    const M = MP.genMap(spec), M2 = MP.genMap(spec); eq(M.t.join(''), M2.t.join(''), 'детерминизм ' + spec.key);
    let asym = 0; for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.t[y * M.w + x] !== M.t[(M.h - 1 - y) * M.w + (M.w - 1 - x)]) asym++;
    ok(asym === 0, 'симметрия ' + spec.key + ': ' + asym);
    eq(M.factories.length, 2 + (spec.neutral.length >> 1) * 2, 'цехов ' + spec.key);
    const pads = M.factories.map(f => MP.padTile(f));
    const labT = MP.components(M.w, M.h, M.t, L.CHASSIS.tracks.pass), labW = MP.components(M.w, M.h, M.t, L.CHASSIS.wheels.pass);
    pads.forEach((p, i) => ok(labT[p.y * M.w + p.x] === labT[pads[0].y * M.w + pads[0].x] && labT[p.y * M.w + p.x] >= 0, spec.key + ': цех ' + i + ' недостижим гусеницами'));
    ok(labW[pads[1].y * M.w + pads[1].x] === labW[pads[0].y * M.w + pads[0].x], spec.key + ': колёса не доезжают до базы Артели');
    ok(M.factories[0].owner === 0 && M.factories[1].owner === 1 && M.factories.slice(2).every(f => f.owner === -1));
  });
  const sizes = MP.MAPS.map(m => m.w * m.h); ok(sizes.every((s, i) => !i || s > sizes[i - 1]), 'карты растут');
});

// ---------- Сохранение ----------
test('сохранение: снимок боя → JSON → восстановление; дальше бой идёт так же, как без сохранения', () => {
  const a = SB.Game({ spec: MP.MAPS[1], seed: 77, aiSides: [0, 1] }); run(a, 40);
  const snap = JSON.parse(JSON.stringify(a.snapshot()));
  ok(JSON.stringify(snap).length < 120000, 'снимок компактный: ' + JSON.stringify(snap).length);
  const b = SB.Game({ restore: snap }); run(a, 30); run(b, 30);
  const sig = g => { const S = g.state(); return S.robots.map(r => r.id + ':' + r.x.toFixed(2) + ',' + r.y.toFixed(2) + ':' + r.hp.toFixed(2)).join('|') + '#' + S.factories.map(f => f.owner).join('') + '#' + JSON.stringify(S.res); };
  eq(sig(b), sig(a), 'расхождение после восстановления');
});

// ---------- ИИ ----------
test('ИИ Артели не зависает: ИИ против ИИ 10 мин на каждой карте и схватках — строит, воюет, роботы не стоят «застрявшими»', () => {
  const specs = MP.MAPS.concat([MP.skirmish(5), MP.skirmish(9)]);
  specs.forEach(spec => {
    const g = SB.Game({ spec, seed: spec.seed, aiSides: [0, 1] }), S = g.state(); let stuck = 0, robotT = 0, maxStep = 0;
    const last = new Map();
    for (let i = 0; i < 30 * 600 && S.phase === 'play'; i++){
      const t0 = performance.now(); g.update(1 / 30); maxStep = Math.max(maxStep, performance.now() - t0);
      for (const r of S.robots){ robotT += 1 / 30; const p = last.get(r.id); if (p && r.path && Math.hypot(r.x - p.x, r.y - p.y) < 0.05) stuck += 1 / 30; last.set(r.id, { x: r.x, y: r.y }); }
    }
    ok(S.stats.built[0] >= 4 && S.stats.built[1] >= 4, spec.key + ': собрано ' + S.stats.built);
    ok(S.stats.caps[0] + S.stats.caps[1] >= 4, spec.key + ': захватов ' + S.stats.caps);
    ok(stuck / Math.max(1, robotT) < 0.03, spec.key + ': застревания ' + (stuck / robotT * 100).toFixed(1) + '%');
    ok(maxStep < 60, spec.key + ': самый долгий шаг ' + maxStep.toFixed(1) + ' мс');
    console.log('     ' + spec.key + ': ' + S.phase + ' за ' + S.time.toFixed(0) + ' с, собрано ' + S.stats.built + ', захватов ' + S.stats.caps + ', застревания ' + (stuck / Math.max(1, robotT) * 100).toFixed(2) + '%');
  });
});
test('производительность: 100 роботов в бою — средний шаг логики < 4 мс', () => {
  const g = SB.Game({ spec: MP.MAPS[4], seed: 3, startRobots: false, aiSides: [] }), S = g.state(), rnd = mulberry32(5), names = Object.keys(L.TPL);
  while (S.robots.length < 100){
    const side = S.robots.length % 2, x = (side ? 0.55 : 0.1) * S.map.w * TS + rnd() * 0.35 * S.map.w * TS, y = 40 + rnd() * (S.map.h * TS - 80), d = L.TPL[names[S.robots.length % names.length]];
    if (L.stats(d).pass[L.tileAt(S.map, x, y)]) g._spawn(side, d, x, y, ['capture', 'robots', 'factories'][S.robots.length % 3]);
  }
  S.robots.forEach(r => { r.hp = r.max = 1e6; });   // все 100 живы до конца замера — бой идёт, но никто не выбывает
  run(g, 2);
  const t0 = performance.now(), N = 300; for (let i = 0; i < N; i++) g.update(1 / 30); const ms = (performance.now() - t0) / N;
  console.log('     100 роботов: ' + ms.toFixed(2) + ' мс на шаг (осталось ' + S.robots.length + ')');
  ok(S.robots.length === 100, 'роботов ' + S.robots.length); ok(ms < 4, 'медленно: ' + ms.toFixed(2) + ' мс');
});

// ---------- i18n, музыка, страница, имена ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть все ресурсы, цеха, модули, приказы, карты', () => {
  const ru = Object.keys(SB.STR.ru).sort(), en = Object.keys(SB.STR.en).sort(); eq(ru, en);
  ru.forEach(k => ok(String(SB.STR.ru[k]).trim() && String(SB.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score', 'tapstart'].forEach(k => ok(SB.STR.ru[k], 'ключ движка ' + k));
  L.RES.forEach(r => ok(SB.STR.ru['r_' + r])); Object.keys(L.PROD).forEach(f => ok(SB.STR.ru['f_' + f], f));
  L.CH_LIST.forEach(c => ok(SB.STR.ru['c_' + c] && SB.STR.ru['cd_' + c])); L.W_LIST.forEach(w => ok(SB.STR.ru['w_' + (w || 'none')] && SB.STR.ru['wd_' + (w || 'none')]));
  L.BR_LIST.forEach(b => ok(SB.STR.ru['b_' + b] && SB.STR.ru['bd_' + b])); L.ORDERS.forEach(o => ok(SB.STR.ru['o_' + o] && SB.STR.ru['ob_' + o]));
  Object.keys(L.TPL).forEach(t => ok(SB.STR.ru['t_' + t])); MP.MAPS.forEach(m => ok(SB.STR.ru['m' + m.id] && SB.STR.ru['d' + m.id]));
  ['empty', 'cores', 'res', 'cap', 'factory'].forEach(w => ok(SB.STR.ru['why_' + w]));
  eq(SB.STR.ru.title, 'СБОРКА');
});
test('музыка: трек sborka разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.sborka; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas 640×512, скрипты по порядку, тач-кнопки и пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="640" height="512"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/maps.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ['fire', 'core', 'next', 'poss', 'build'].forEach(a => ok(html.includes('data-act="' + a + '"'), 'кнопка ' + a));
  ['U', 'D', 'L', 'R'].forEach(d => ok(html.includes('data-d="' + d + '"'), 'дпад ' + d));
  ok(/data-pause/.test(html)); ok(!/https?:\/\/(?!arcade\.hefest\.ru|www\.w3\.org)/.test(html), 'внешних ссылок нет');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ['modern', 'classic'].forEach(t => { const box = { console, Math }; box.window = box; vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/' + t + '.js'), 'utf8'), box); const P = box.SBORKA[t]; ok(P.team.length === 2 && P.res.metal && P.biome.meadow && P.biome.marsh && P.biome.rust, 'палитра ' + t); });
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ и vzvod/ + оригинал жанра и его издатель)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGNhbm5vbiA/Zm9kZGVyfHNlbnNpYmxlID9zb2Z0fNC6W9GN0LBd0L3QvT/QvtC9ID/RhNC+0LTQtD/QtdGAfNGE0L7QtNC0P9C10YB80YHQtdC90YHQuNCx0Lt8XGJqb29sc1xifNC00LbRg9C70YF80L/Rg9GI0LXRh9C9W9CwLdGP0ZFdKiA/0LzRj9GBfG5ldGhlciA/ZWFydGh8YXJndXMgP3ByZXNzfNC9W9C10Y1d0Ldb0LXRjV3RgCA/W9C10ZHRjV3RgNGCfNC9W9C10Y1d0YJb0LXRjV3RgCA/W9C10ZFd0YDRgnzQsNGA0LPRg9GBID/Qv9GA0LXRgdGB', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 15, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['TmV0aGVyIEVhcnRo', 'TmV0aGVyRWFydGg=', 'QXJndXMgUHJlc3M=', '0J3QtdC30LXRgCDQldGA0YI=', '0J3QtdGC0LXRgCDQgdGA0YI=', '0JDRgNCz0YPRgSDQn9GA0LXRgdGB'].forEach(b => ok(BAD.test(u(b)), 'стоп-лист ловит оригинал жанра и издателя (и транслит): ' + b));
  ['СБОРКА', 'Гефест', 'Наковальня', 'Ржавая Артель', 'нетерпение', 'конструктор', 'антиграв', 'гусеницы', 'Долина Заводов', 'CONTRACT.md', 'ракета'].forEach(w => ok(!BAD.test(w), 'ложное срабатывание: ' + w));
});

// ---------- Бот-полководец: проходимость и баланс (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
test('баланс: бот (реакция 150–250 мс) побеждает на карте 1 в ≥ 70% из 20 партий, без застреваний', () => {
  const R = []; for (let s = 1; s <= 20; s++) R.push(playMap(SB, MP.MAPS[0], s));
  const w = R.filter(r => r.won).length, t = R.filter(r => r.won).map(r => r.time);
  console.log('     карта 1: побед ' + w + '/20, время ' + (t.length ? Math.min(...t).toFixed(0) + '–' + Math.max(...t).toFixed(0) + ' с' : '—') + ', застревания ≤ ' + (Math.max(...R.map(r => r.stuckFrac)) * 100).toFixed(1) + '%');
  ok(w >= 14, 'слишком сложно: ' + w + '/20'); ok(R.every(r => r.stuckFrac < 0.03), 'застревания');
});
test('проходимость кампании: бот выигрывает каждую карту хотя бы раз из 6; сложность растёт', () => {
  const rates = MP.MAPS.map((m, i) => { const R = []; for (let s = 1; s <= 6; s++) R.push(playMap(SB, m, s + 100 * i)); return R.filter(r => r.won).length; });
  const sk = []; for (let s = 1; s <= 4; s++) sk.push(playMap(SB, MP.skirmish(s), s));
  console.log('     побед бота по картам 1–5 (из 6): ' + rates.join(', ') + '; схватка: ' + sk.filter(r => r.won).length + '/4');
  rates.forEach((w, i) => ok(w >= 1, 'карта ' + (i + 1) + ' не пройдена'));
  ok(rates[4] <= rates[0], 'карта 5 не легче первой');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

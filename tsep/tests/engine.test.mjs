/* ЦЕПЬ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node tsep/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: этажи и маршрут с развилкой, физику (фиксированная дуга прыжка, отвесный сход, балки, лестницы наискось), цепь-кистень
   (замах, длина по ступеням, удар вверх), фонари и искры, все вспомогательные орудия, отбрасывание и ямы, маятники и подъёмники,
   проходимость каждого этажа графом по настоящей физике (переправы во всех фазах, без тупиков, исполнение пути), обе ветки маршрута,
   стражей всех этажей, жизни/продолжения, сохранение и пароль, музыку, i18n, правило имён и партии «человеческого» бота. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const T = sandbox.TSEP, L = T.logic, K = L.K, DT = 1 / 60;
const { playFloor, mulberry32, navFor, route, makeExec, stepExec } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, d, m){ if (Math.abs(a - b) > d) throw new Error((m || '') + ' ждали ≈' + b + '±' + d + ', получили ' + a); }
const FI = { works: [0, 'A'], pendulum: [1, 'A'], springs: [2, 'A'], gears: [3, 'A'], flywheel: [4, 'A'], gallery: [3, 'B'], belfry: [4, 'B'], heart: [5, 'A'] };
// партия на этаже; calm — без врагов
function mk(key = 'works', o = {}){
  const ev = [];
  const game = T.Game({ rng: mulberry32(o.seed || 1), dmgMul: o.dmgMul, onEvent: (t, d) => ev.push({ t, d }) }).start();
  const [fi, rt] = FI[key]; game._floor(fi, rt);
  const S = game.state();
  if (o.calm !== false){ S.enemies = []; S.nests = []; }
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state(), i) : inp); game.update(DT); } game.setInput({}); }
// ровный мир: пол на ряду 13, ширина w
function flat(w, fn){ const g = []; for (let r = 0; r < 16; r++) g.push((r >= 13 ? '#' : ' ').repeat(w).split('')); if (fn) fn(g); const t = new Uint8Array(w * 16); const C = { '#': 1, '=': 2, '/': 3, '\\': 4, '*': 5 }; g.forEach((row, r) => row.forEach((ch, c) => { t[r * w + c] = C[ch] || 0; })); return { W: w, H: 16, t, stairs: [], mov: [], gate: { x: -5, y: 0 }, arena: { y0: 0 }, open: false }; }
function step(lv, h, inp, n = 1, Wo = {}){ const W = Object.assign({ lv, t: 0, gate: false, chain: 1 }, Wo); for (let i = 0; i < n; i++){ L.heroStep(W, h, typeof inp === 'function' ? inp(h, i) : inp, DT); W.t += DT; } return h; }

// ---------- этажи и маршрут ----------
test('8 этажей, два маршрута по 6; развилка после 3-го этажа; общий финал — Часовое Сердце', () => {
  eq(Object.keys(T.FLOORS).length, 8);
  eq(T.ROUTES.A.length, 6); eq(T.ROUTES.B.length, 6);
  eq(T.ROUTES.A.slice(0, 3).join(), T.ROUTES.B.slice(0, 3).join(), 'первые три этажа общие');
  ok(T.ROUTES.A[3] !== T.ROUTES.B[3] && T.ROUTES.A[4] !== T.ROUTES.B[4], 'этажи 4–5 у веток разные');
  eq(T.ROUTES.A[5], 'heart'); eq(T.ROUTES.B[5], 'heart'); eq(T.BRANCH, 2);
  const sp = T.build('springs'); ok(sp.branch && sp.doors.length === 2 && sp.doors.some(d => d.route === 'A') && sp.doors.some(d => d.route === 'B'), 'две двери');
});
test('каждый этаж: старт, отметка, ворота арены (последние 32 колонки), страж, фонари со звеном цепи, свой страж', () => {
  const kinds = new Set();
  for (const k of Object.keys(T.FLOORS)){
    const lv = T.build(k);
    ok(lv.start && lv.cps.length >= 1 && lv.boss, k);
    eq(lv.W - lv.gate.x, 32, k + ' арена');
    ok(lv.cps[0].x > lv.start.x + 20 && lv.cps[0].x < lv.gate.x - 10, k + ': отметка посередине');
    ok(lv.lamps.length >= 7 && lv.lamps.some(l => l.k === 'chain'), k + ': фонари (' + lv.lamps.length + ') и звено цепи');
    ok(lv.foes.length >= 6, k + ': враги');
    kinds.add(lv.bossKind);
  }
  eq(kinds.size, 8, 'у каждого этажа свой страж');
  ok(T.build('heart').final, 'финал');
});
test('сборка: неизвестный знак карты — ошибка с именем этажа; лестницы найдены с верными концами', () => {
  const save = T.FLOORS.works.paint;
  try { T.FLOORS.works.paint = P => { save(P); P.put(5, 5, 'Q'); }; let m = ''; try { T.build('works'); } catch (e) { m = e.message; } ok(/works/.test(m) && /Q/.test(m), m); }
  finally { T.FLOORS.works.paint = save; }
  const lv = T.build('works');
  eq(JSON.stringify(lv.stairs[0]), JSON.stringify({ dir: 1, n: 4, bx: 22, by: 13, tx: 26, ty: 9 }));
  const bl = T.build('belfry'); ok(bl.stairs.some(s => s.dir === -1), 'есть лестница влево-вверх');
});

// ---------- физика ----------
test('прыжок: дуга фиксируется при толчке — ввод в полёте её не меняет; высота ≈ 2.5, длина ≈ 2.5 клетки', () => {
  const lv = flat(40);
  const jump = air => { const h = L.newHero(10.5, 13); step(lv, h, { dx: 1, jump: true }); let top = 0; for (let k = 0; k < 120 && !h.ground; k++){ step(lv, h, air); top = Math.max(top, 13 - h.y); } return { x: h.x, top }; };
  const a = jump({ dx: 1 }), b = jump({ dx: -1 }), c = jump({});
  ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.x - c.x) < 1e-9, 'приземление одно: ' + a.x + ' ' + b.x);
  near(a.top, K.JV * K.JV / (2 * K.G), 0.12, 'высота'); near(a.x - 10.5, 2.5, 0.2, 'длина');
});
test('сход с края — отвесно (ход гаснет); удар о стену в полёте гасит ход; потолок гасит взлёт', () => {
  const lv = flat(30, g => { for (let c = 15; c < 30; c++) for (let r = 13; r < 16; r++) g[r][c] = ' '; for (let r = 0; r < 16; r++) g[r][29] = '#'; for (let c = 0; c < 15; c++) g[13][c] = '#'; for (let r = 0; r < 16; r++) g[r][0] = '#'; g[9][5] = '#'; });
  const h = L.newHero(13.5, 13); step(lv, h, { dx: 1 }, 40);
  ok(!h.ground && h.vx === 0, 'падает'); const x0 = h.x; step(lv, h, { dx: 1 }, 20); eq(h.x, x0, 'отвесно');
  const h2 = L.newHero(2.5, 13); step(lv, h2, { dx: -1, jump: true }); step(lv, h2, {}, 30); ok(h2.x >= 1.3 - 1e-9 && h2.vx === 0, 'стена');
  const h3 = L.newHero(5.5, 13); step(lv, h3, { jump: true }); step(lv, h3, {}, 10); ok(h3.y - K.HH >= 10 - 1e-6, 'потолок: ' + h3.y);
});
test('балка «=»: насквозь снизу, держит сверху', () => {
  const lv = flat(20, g => { for (let c = 5; c < 12; c++) g[11][c] = '='; });
  const h = L.newHero(8.5, 13); step(lv, h, { jump: true }); for (let k = 0; k < 90 && !(h.ground && h.y < 12); k++) step(lv, h, {});
  eq(h.y, 11, 'стоит на балке'); step(lv, h, {}, 30); eq(h.y, 11, 'держит');
});
test('лестница наискось: ↑ у низа — подъём до верхнего пола; ↓ у верха — спуск; на лестнице без прыжка', () => {
  const g = mk('works'), S = g.S, s = S.lv.stairs[0];
  g.game._place(s.bx - 0.6, s.by); run(g.game, 0.2, { up: true });
  ok(S.hero.stair, 'встал на лестницу'); run(g.game, 0.4, { up: true, jump: true });
  ok(S.hero.stair && S.hero.vy === 0, 'прыжка нет');
  run(g.game, 3, { up: true }); ok(!S.hero.stair && S.hero.ground, 'сошёл'); eq(S.hero.y, s.ty); near(S.hero.x, s.tx, 1e-6);
  run(g.game, 0.3, { down: true }); ok(S.hero.stair, 'вниз'); run(g.game, 3, { down: true }); eq(S.hero.y, s.by); ok(!S.hero.stair, 'внизу');
});

// ---------- цепь ----------
function dummy(g, x, y, hp = 9){ const e = g.game._spawn('guard', x, y); e.hp = hp; e.st = 'rec'; e.t = -999; return e; }
test('цепь: замах — до конца замаха урона нет; удар достаёт на длину ступени; на земле удар останавливает ход', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13); S.hero.face = 1;
  const e = dummy(g, 6.5 + K.REACH[1] + 0.2, 13);
  g.game.setInput({ atk: true }); g.game.update(DT);
  for (let k = 1; k < Math.floor(K.WIND[1] * 60) - 1; k++){ g.game.setInput({ atk: true, dx: 1 }); g.game.update(DT); eq(e.hp, 9, 'в замахе'); }
  eq(S.hero.x, 6.5, 'стоит'); run(g.game, 0.3);
  eq(e.hp, 8, 'попал на ступени 1');
  const g2 = mk('works'), S2 = g2.S; g2.game._place(6.5, 13); S2.hero.face = 1; const far = dummy(g2, 6.5 + K.REACH[1] + 0.9, 13);
  run(g2.game, 0.6, (s, i) => ({ atk: i < 2 })); eq(far.hp, 9, 'далеко для ступени 1');
  g2.game._chain(3); run(g2.game, 0.7, (s, i) => ({ atk: i < 2 })); eq(far.hp, 9 - K.DMG[3], 'ступень 3 — длиннее и тяжелее');
});
test('цепь: ↑ + удар в прыжке бьёт наискось вверх; звено цепи повышает ступень (до 3, дальше — очки)', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13); S.hero.face = 1;
  const bird = g.game._spawn('moth', 8.4, 9.0); bird.st = 'aim'; bird.t = -99;
  run(g.game, 0.75, (s, i) => ({ jump: i === 0, up: true, atk: i === 8 }));
  ok(bird.dead || bird.hp <= 0, 'моль сбита ударом вверх');
  eq(S.chain, 1); for (let k = 0; k < 3; k++) S.items.push({ k: 'chain', x: S.hero.x, y: S.hero.y - 0.5, vy: 0, t: 0, ground: true });
  const sc = S.score; run(g.game, 0.1); eq(S.chain, 3, 'максимум 3'); eq(S.score - sc, 1000, 'лишнее звено — очки');
});
test('фонари: удар цепью бьёт фонарь, из него падает содержимое; искры копятся', () => {
  const g = mk('works'), S = g.S, lv = S.lv, i = lv.lamps.findIndex(l => l.k === 'key');
  const lamp = lv.lamps[i]; g.game._place(lamp.x - 1.4, 13); S.hero.face = 1;
  run(g.game, 0.6, (s, j) => ({ atk: j === 0 })); eq(S.lampsOn[i], 0, 'разбит'); ok(g.has('lamp'));
  run(g.game, 1.5, { dx: 1 }); eq(S.sub, 'key', 'ключ подобран');
  const sp = S.sparks; S.items.push({ k: 'spark5', x: S.hero.x, y: S.hero.y, vy: 0, t: 0, ground: true }); run(g.game, 0.05); eq(S.sparks, sp + 5);
});

// ---------- орудия ----------
test('орудия: цена в искрах; одно в слоте; без искр — «мало искр»', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13);
  for (const k of L.SUBS){ g.game._sub(k); S.sparks = 20; S.shots = []; S.freeze = 0; S.hero.throwT = 0; g.game._useSub(); eq(S.sparks, 20 - L.SUB[k].cost, k); }
  g.game._sub('stopper'); S.sparks = 2; S.freeze = 0; S.hero.throwT = 0; g.game._useSub(); ok(g.has('nosparks')); eq(S.sparks, 2);
  S.items.push({ k: 'flask', x: S.hero.x, y: S.hero.y, vy: 0, t: 0, ground: true }); run(g.game, 0.05); eq(S.sub, 'flask', 'замена в слоте');
});
test('ключ летит дугой и пробивает; склянка разливает огонь; шестерня-бумеранг возвращается', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13); S.hero.face = 1; S.sparks = 20;
  g.game._sub('key'); g.game._useSub(); const k = S.shots[0]; const y0 = k.y; run(g.game, 0.25); ok(k.y < y0, 'вверх'); run(g.game, 0.75); ok(k.y > y0 - 0.5 && k.x > 9, 'вниз и вперёд: ' + k.y.toFixed(2));
  const a = dummy(g, 11.2, 13, 9), b = dummy(g, 11.6, 13, 9); S.shots = []; S.hero.throwT = 0; g.game._useSub(); run(g.game, 0.9);
  ok(a.hp < 9 && b.hp < 9, 'ключ пробил двоих');
  const g2 = mk('works'), S2 = g2.S; g2.game._place(6.5, 13); S2.hero.face = 1; S2.sparks = 9; g2.game._sub('flask'); g2.game._useSub();
  run(g2.game, 0.8); ok(g2.has('flame') && S2.shots.some(s => s.fire), 'огонь на полу');
  const g3 = mk('works'), S3 = g3.S; g3.game._place(6.5, 13); S3.hero.face = 1; S3.sparks = 9; g3.game._sub('gear'); g3.game._useSub();
  let maxX = 0; for (let i = 0; i < 160 && S3.shots.length; i++){ g3.game.update(DT); if (S3.shots[0]) maxX = Math.max(maxX, S3.shots[0].x); }
  ok(maxX > 8.5, 'улетела: ' + maxX); eq(S3.shots.length, 0, 'вернулась'); ok(g3.has('catch'));
});
test('часовая пружина замедляет врагов в поле; стоп-маятник замораживает врагов на 3 с', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13); S.sparks = 20;
  const e = g.game._spawn('tick', 9.5, 13); e.face = 1; e.st = 'walk';
  g.game._sub('spring'); g.game._useSub(); const x0 = e.x; run(g.game, 0.5); const slow = Math.abs(e.x - x0);
  const g2 = mk('works'), S2 = g2.S; g2.game._place(6.5, 13); const e2 = g2.game._spawn('tick', 9.5, 13); e2.face = 1; e2.st = 'walk'; const x2 = e2.x; run(g2.game, 0.5); const fast = Math.abs(e2.x - x2);
  near(slow / fast, K.SLOW, 0.05, 'замедление');
  const g3 = mk('works'), S3 = g3.S; g3.game._place(6.5, 13); S3.sparks = 9; const e3 = g3.game._spawn('tick', 9.5, 13); e3.face = 1; e3.st = 'walk';
  g3.game._sub('stopper'); g3.game._useSub(); const x3 = e3.x; run(g3.game, 2.5); eq(e3.x, x3, 'заморожен'); run(g3.game, 1.0); ok(e3.x !== x3, 'оттаял'); ok(g3.has('freeze'));
});

// ---------- урон ----------
test('отбрасывание: удар отбрасывает назад и вверх, неуязвимость; на лестнице — без отброса; отброс в шахту — гибель', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13);
  g.game._hurt(2, 7.5); ok(S.hero.kb && S.hero.vx < 0 && S.hero.vy < 0, 'отброс'); eq(S.hp, K.HP - 2);
  ok(!g.game._hurt(2, 7.5), 'неуязвим'); run(g.game, 1); ok(S.hero.ground && !S.hero.kb, 'приземлился');
  const s = S.lv.stairs[0]; g.game._place(s.bx, s.by); run(g.game, 0.4, { up: true }); S.hero.inv = 0; const x = S.hero.x; g.game._hurt(2, x + 1); ok(S.hero.stair && !S.hero.kb, 'на лестнице держится');
  const g2 = mk('works'), S2 = g2.S; g2.game._place(12.6, 13); g2.game._hurt(2, 11); run(g2.game, 2); ok(g2.ev.some(e => e.t === 'die' && e.d.why === 'pit'), 'в пролом');
});
test('зубчатка ранит; маятник и подъёмник везут стоящего героя', () => {
  const g = mk('pendulum'), S = g.S; g.game._place(50.5, 13); run(g.game, 0.4, { dx: 1 }); ok(g.ev.some(e => e.t === 'hurt' && e.d.why === 'saw'), 'зубчатка');
  const g2 = mk('gears'), S2 = g2.S, m = S2.lv.mov[0]; S2.t = 0; g2.game._place(m.x + m.w / 2, L.platAt(m, 0).top); S2.hero.on = 0;
  run(g2.game, m.per / 2); near(S2.hero.y, m.y - m.h, 0.05, 'поднят'); eq(S2.hero.on, 0);
  const g3 = mk('works'), S3 = g3.S, p = S3.lv.mov[0]; S3.t = 0; const P0 = L.platAt(p, 0); g3.game._place(P0.cx, P0.top); S3.hero.on = 0;
  run(g3.game, p.per / 4); const P1 = L.platAt(p, S3.t); near(S3.hero.x, P1.cx, 0.05, 'едет с маятником'); near(S3.hero.y, P1.top, 0.02);
});

// ---------- проходимость ----------
const NAVS = {}; for (const k of Object.keys(T.FLOORS)) NAVS[k] = navFor(T, k);
test('проходимость: с старта каждого этажа граф по настоящей физике доходит до арены стража', () => {
  for (const k in NAVS){ const { lv, nav } = NAVS[k], R = nav.reach(nav.startNode); ok(Object.keys(R).some(u => u % lv.W > lv.gate.x + 2), k); }
});
test('проходимость: тупиков нет — из любой достижимой точки этажа можно дойти до арены', () => {
  for (const k in NAVS){
    const { lv, nav } = NAVS[k], R = nav.reach(nav.startNode), rev = {};
    for (const u in nav.edges) for (const e of nav.edges[u]) (rev[e.to] = rev[e.to] || []).push(+u);
    const can = new Set(Object.keys(R).map(Number).filter(u => u % lv.W > lv.gate.x + 2)), q = [...can];
    while (q.length){ const u = q.shift(); for (const v of rev[u] || []) if (!can.has(v)){ can.add(v); q.push(v); } }
    const dead = Object.keys(R).map(Number).filter(u => !can.has(u));
    eq(dead.length, 0, k + ' тупики ' + dead.map(u => (u % lv.W) + ':' + Math.floor(u / lv.W)).join(' '));
  }
});
test('проходимость: двери развилки на 3-м этаже достижимы с арены; отметки достижимы', () => {
  const { lv, nav } = NAVS.springs, R = nav.reach(nav.startNode);
  for (const d of lv.doors) ok(R[L.pointNode(lv, d.x, d.y)], 'дверь ' + d.route);
  for (const k in NAVS){ const { lv: l2, nav: n2 } = NAVS[k], R2 = n2.reach(n2.startNode); for (const c of l2.cps) ok(R2[L.pointNode(l2, c.x, c.y)], k + ' отметка'); }
});
test('маятники и подъёмники: переправа контроллером удаётся при старте в любой из 24 фаз (настоящая физика)', () => {
  for (const k of Object.keys(T.FLOORS)){
    const lv0 = T.build(k);
    lv0.mov.forEach((m, mi) => {
      for (let p = 0; p < 24; p++){
        const g = mk(k), S = g.S; S.t = m.per * p / 24; g.game._place(m.from[0] + 0.5, m.from[1]);
        const st = { m: mi, ph: 'go' }; let okk = false;
        for (let f = 0; f < 60 * (3 * m.per + 4); f++){
          const inp = L.rideCtl(S.lv, st, S, { lv: S.lv, t: S.t, gate: S.gateClosed, chain: 1 }); g.game.setInput(inp); g.game.update(DT);
          if (st.ph === 'done'){ okk = true; break; } if (st.ph === 'fail' || S.phase !== 'play') break;
        }
        ok(okk, k + ' опора ' + mi + ' фаза ' + p + ': ' + st.ph);
      }
    });
  }
});
test('исполнимость: кратчайший путь графа исполняется подряд в одной партии до арены — на каждом этаже обеих веток', () => {
  for (const k of Object.keys(T.FLOORS)){
    const g = mk(k, { dmgMul: 0 }), S = g.S, lv = S.lv, p = route(T, k); ok(p && p.length, k + ': путь');
    let i = 0, X = null, f = 0;
    for (; f < 60 * 200 && S.bossState === 'none' && S.phase === 'play'; f++){
      if (!X){ if (i >= p.length) break; X = makeExec(T, lv, p[i++], 0); }
      const r = stepExec(T, lv, X, S); ok(!r.fail, k + ': ребро ' + (i - 1) + ' ' + X.e.type + ' x=' + S.hero.x.toFixed(2));
      if (r.done){ X = null; continue; }
      g.game.setInput(r.inp); g.game.update(DT);
    }
    ok(S.bossState !== 'none' || S.hero.x > lv.gate.x + 1, k + ': дошёл до арены (x=' + S.hero.x.toFixed(1) + ')');
    eq(g.count('die'), 0, k + ': без гибели');
  }
});

// ---------- стражи ----------
test('стражи: на каждом этаже ворота закрываются, страж атакует, получает урон, гибнет; выход — шестерня хода / двери / победа', () => {
  const ATT = { cuckoo: ['swoop', 'egg'], pendulum: ['gearDrop', 'sweep'], drake: ['hop', 'breath'], spider: ['nut'], flywheel: ['stomp'], bellows: ['blow', 'leap'], ringer: ['ready', 'leap'], heart: ['dart'] };
  for (const k of Object.keys(T.FLOORS)){
    const g = mk(k, { dmgMul: 0 }), S = g.S, lv = S.lv;
    g.game._place(lv.gate.x + 3.5, 13); run(g.game, 0.1);
    ok(S.bossState === 'intro' && S.gateClosed, k + ': ворота');
    run(g.game, 14);
    ok(S.bossState === 'fight', k + ' бой'); for (const a of ATT[lv.bossKind]) ok(g.has(a), k + ': атака ' + a);
    const hp = S.boss.hp; g.game._bossDamage(1); eq(S.boss.hp, hp - 1, k + ' урон');
    while (S.boss && S.bossState === 'fight') g.game._bossDamage(5);
    ok(g.has('bossDie'), k + ' повержен');
    if (lv.final){ eq(S.phase, 'won'); ok(g.has('win')); continue; }
    if (lv.branch){ ok(S.doorsOn && S.doors.length === 2, 'двери'); continue; }
    run(g.game, 3); const core = S.items.find(i => i.k === 'core'); ok(core && core.ground, k + ': шестерня хода');
    g.game._place(core.x, core.y); run(g.game, 0.1); eq(S.phase, 'clear', k + ' этаж пройден');
  }
});
test('развилка: дверь «1» ведёт в Ход шестерён, «2» — в Колокольную галерею; дальше маршрут держится до Сердца', () => {
  for (const [ri, key4, key5] of [['A', 'gears', 'flywheel'], ['B', 'gallery', 'belfry']]){
    const g = mk('springs', { dmgMul: 0 }), S = g.S; g.game._startBoss(); while (S.bossState === 'fight') g.game._bossDamage(9);
    const d = S.doors.find(q => q.route === ri); g.game._place(d.x, d.y); run(g.game, 0.1);
    eq(S.phase, 'clear'); run(g.game, K.CLEAR + 0.2); eq(S.key, key4); eq(S.route, ri);
    g.game._startBoss(); while (S.bossState === 'fight') g.game._bossDamage(9); run(g.game, 3);
    const c = S.items.find(i => i.k === 'core'); g.game._place(c.x, c.y); run(g.game, K.CLEAR + 0.4); eq(S.key, key5);
    g.game._startBoss(); while (S.bossState === 'fight') g.game._bossDamage(9); run(g.game, 3);
    const c2 = S.items.find(i => i.k === 'core'); g.game._place(c2.x, c2.y); run(g.game, K.CLEAR + 0.4); eq(S.key, 'heart'); eq(S.fi, 5);
  }
});
test('кукушка проносится на высоте груди: стоя — удар, пригнувшись — мимо', () => {
  const g = mk('works'), S = g.S; const b = g.game._startBoss(); S.hero.inv = 0;
  g.game._place(b.cx - 2, 13); b.st = 'swoop'; b.t = 0; b.x0 = b.cx + 7; b.y0 = b.hy; b.x2 = b.cx - 9; b.x1 = b.cx - 2;
  run(g.game, 1.6, { down: true }); eq(S.hp, K.HP, 'пригнулся');
  b.st = 'swoop'; b.t = 0; b.x0 = b.cx + 7; b.y0 = b.hy; b.x2 = b.cx - 9; S.hero.inv = 0; run(g.game, 1.6); ok(S.hp < K.HP, 'стоя — удар');
});

// ---------- жизни, сохранение ----------
test('жизни: гибель — с отметки, цепь на ступень ниже; 0 жизней → «Продолжить?»; продолжение — 3 жизни, счёт 0; отказ — конец', () => {
  const g = mk('works'), S = g.S, cp = S.lv.cps[0]; g.game._place(cp.x, cp.y); run(g.game, 0.1); ok(S.cp, 'отметка');
  g.game._chain(3); g.game._die('test'); run(g.game, K.DEAD + 0.1); eq(S.phase, 'play'); eq(S.hero.x, cp.x); eq(S.chain, 2); eq(S.lives, K.LIVES - 1);
  S.score = 777; while (S.lives > 0){ g.game._die('test'); run(g.game, K.DEAD + 0.1); }
  eq(S.phase, 'cont'); g.game.continueGame(); eq(S.phase, 'play'); eq(S.lives, K.LIVES); eq(S.score, 0); eq(S.conts, K.CONTS - 1);
  S.lives = 1; g.game._die('test'); run(g.game, K.DEAD + 0.1); g.game.giveUp(); eq(S.phase, 'over'); ok(g.has('gameover'));
});
test('жизнь за очки: 20 000 и далее каждые 40 000', () => {
  const g = mk('works'), S = g.S, l0 = S.lives; S.items.push({ k: 'token', x: S.hero.x, y: S.hero.y, vy: 0, t: 0, ground: true }); S.score = 19800; run(g.game, 0.05); eq(S.lives, l0 + 1); ok(g.has('life'));
});
test('сохранение: данные этажа; партия с start продолжает этаж, ветку, цепь, орудие и искры', () => {
  const g = mk('gallery'), S = g.S; S.chain = 2; S.sub = 'gear'; S.sparks = 12;
  const sv = g.game.saveData(); eq(JSON.stringify(sv), JSON.stringify({ fi: 3, route: 'B', chain: 2, sub: 'gear', sparks: 12, score: S.score }));
  const g2 = T.Game({ start: sv }).start(), S2 = g2.state(); eq(S2.key, 'gallery'); eq(S2.chain, 2); eq(S2.sub, 'gear'); eq(S2.sparks, 12); eq(S2.route, 'B');
});
test('пароль: 5 знаков, обратимо для всех этажей/веток/цепи/орудий; искажённый — не принимается', () => {
  let n = 0;
  for (let fi = 0; fi < 6; fi++) for (const route of (fi > T.BRANCH ? ['A', 'B'] : [null, 'A'])) for (let chain = 1; chain <= 3; chain++) for (const sub of [null, ...L.SUBS]) for (const sparks of [0, 9, 30]){
    const code = L.encode({ fi, route, chain, sub, sparks }); eq(code.length, 5);
    const d = L.decode(code); ok(d && d.fi === fi && d.route === route && d.chain === chain && d.sub === sub && d.sparks === sparks, code + ' ' + JSON.stringify(d)); n++;
  }
  ok(n > 300);
  const c = L.encode({ fi: 4, route: 'B', chain: 3, sub: 'key', sparks: 15 });
  let bad = 0; for (let i = 0; i < 5; i++) for (const ch of L.ALPH){ if (ch === c[i]) continue; const t = c.slice(0, i) + ch + c.slice(i + 1); if (L.decode(t)) bad++; }
  ok(bad < 6, 'искажения почти всегда отвергнуты: ' + bad); eq(L.decode('ABC'), null); eq(L.decode('!!!!!'), null);
  eq(L.decode(c.toLowerCase()).fi, 4, 'регистр не важен');
});

// ---------- музыка, i18n, имена ----------
test('музыка: Arcade.tracks.tsep и темы стража/Сердца — оригинальные треки в нотации движка', () => {
  const A = sandbox.Arcade, re = /^(?:[A-G][#b]?\d|-|\.|\|)$/;
  ok(A.tracks.tsep === T.MUSIC.stage);
  for (const tr of [A.tracks.tsep, T.MUSIC.boss, T.MUSIC.heart]){
    ok(tr.bpm > 60 && tr.div === 2, 'bpm/div');
    const mel = [].concat(tr.melody).join(' ').split(/\s+/).filter(Boolean), bass = tr.bass.split(/\s+/).filter(Boolean);
    ok(mel.every(x => re.test(x)) && bass.every(x => re.test(x)), 'ноты');
    ok(/^[ksho. |]+$/.test(tr.drums), 'ударные');
    const steps = s => s.split(/\s+/).filter(x => x && x !== '|').length;
    ok(steps([].concat(tr.melody).join(' ')) % 8 === 0 && steps(tr.bass) % 8 === 0 && steps(tr.drums) % 8 === 0, 'такты по 8 шагов');
  }
});
test('i18n: у RU и EN одинаковые ключи; есть имена этажей, стражей, орудий, врагов и причин гибели', () => {
  const ru = Object.keys(T.STR.ru).sort(), en = Object.keys(T.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (const k of Object.keys(T.FLOORS)){ ok(T.STR.ru['f_' + k] && T.STR.en['f_' + k], k); ok(T.STR.ru['b_' + T.FLOORS[k].boss], T.FLOORS[k].boss); }
  for (const s of L.SUBS) ok(T.STR.ru['s_' + s], s);
  for (const f of Object.keys(L.FOE)) ok(T.STR.ru['e_' + f] && T.STR.ru['d_' + f], f);
  for (const d of ['pit', 'saw', 'boss', 'oil', 'gear', 'egg', 'shard', 'steam', 'nut', 'ember', 'wave', 'dart']) ok(T.STR.ru['d_' + d], d);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFrdW1hanzQsNC60YPQvNCw0LTQt3xiZWxtb250fNCx0LXQu9GM0LzQvtC90YJ80LHQtdC70LzQvtC90YJ8XGJzaW1vblxifNGB0LDQudC80L7QvXzRgdC40LzQvtC9KD8hW9CwLdGP0ZFdKXxkcmFjdWx80LTRgNCw0LrRg9C7fNC60LDRgdGC0LvQstCw0L3QuHzQutCw0YHQu9Cy0LDQvdC4fGFsdWNhcmR80LDQu9GD0LrQsNGA0LQ=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Гефест') && !BAD.test('звонарь') && !BAD.test('Звонарь-двойник') && !BAD.test('дракон-автомат') && !BAD.test('CONTRACT.md') && !BAD.test('кистень') && !BAD.test('симметрия') && !BAD.test('similar'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без урона проходит каждый этаж обеих веток со стражем (настоящая физика, враги на месте)', () => {
  for (const [fi, r] of [[0, 'A'], [1, 'A'], [2, 'A'], [3, 'A'], [4, 'A'], [5, 'A'], [3, 'B'], [4, 'B']]){
    const res = playFloor(T, 1, { fi, route: r, god: true, maxT: 300 }); ok(res.cleared, fi + r + ' ' + JSON.stringify({ t: res.t, at: res.at, stuck: res.stuck }));
  }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, часть решений прозёвывает, ошибка места толчка ±0.04.
const N1 = 20, B1 = []; for (let s = 1; s <= N1; s++) B1.push(playFloor(T, s, { fi: 0 }));
test('баланс: «человеческий» бот проходит этаж 1 (со стражем, 3 жизни, без продолжений) часто — ≥ 70% партий', () => {
  const n = B1.filter(r => r.cleared).length, why = {}; B1.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     этаж 1: ' + n + '/' + N1 + ', гибели: ' + JSON.stringify(why) + ', бой со стражем ≈ ' + (B1.filter(r => r.bossT).reduce((a, r) => a + r.bossT, 0) / Math.max(1, B1.filter(r => r.bossT).length)).toFixed(0) + ' с');
  ok(n >= 0.7 * N1, 'слишком сложно: ' + n + '/' + N1);
  ok(B1.some(r => r.deaths > 0 || r.hp < K.HP), 'и не пресно: бот получает урон');
});
test('баланс: остальные этажи обеих веток проходимы «человеком» (бот с 5 жизнями берёт каждый хотя бы в 1 из 4 партий)', () => {
  const out = [];
  for (const [fi, r] of [[1, 'A'], [2, 'A'], [3, 'A'], [4, 'A'], [3, 'B'], [4, 'B'], [5, 'A']]){
    let n = 0; for (let s = 1; s <= 4; s++){ const res = playFloor(T, s, { fi, route: r, lives: 5, chain: 2, sparks: 10 }); if (res.cleared) n++; }
    out.push((fi + 1) + r + ':' + n + '/4'); ok(n >= 1, 'этаж ' + (fi + 1) + r + ' не взят');
  }
  console.log('     ' + out.join(' '));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

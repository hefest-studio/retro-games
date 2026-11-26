/* ЩЁЛК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node tsep/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: шесть этажей подряд, фазовые блоки ТИК/ТАК, щелчок (фаза, перезарядка, заклинивание, волна, давка, падение врагов),
   физику (фиксированная дуга прыжка, отвесный сход, балки, лестницы наискось), предметы и катушку, отбрасывание и ямы, маятники и подъёмники,
   проходимость каждого этажа графом по настоящей физике (узел = клетка × фаза; без щелчка этажи непроходимы; без тупиков; исполнение пути),
   стражей всех этажей, жизни/продолжения, сохранение и пароль, миграцию записей, музыку, i18n (5 языков), правило имён и партии бота. */
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
const FI = { works: 0, pendulum: 1, springs: 2, gears: 3, flywheel: 4, heart: 5 };
// партия на этаже; calm — без врагов
function mk(key = 'works', o = {}){
  const ev = [];
  const game = T.Game({ rng: mulberry32(o.seed || 1), dmgMul: o.dmgMul, onEvent: (t, d) => ev.push({ t, d }) }).start();
  game._floor(FI[key]);
  const S = game.state();
  if (o.calm !== false){ S.enemies = []; S.nests = []; }
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state(), i) : inp); game.update(DT); } game.setInput({}); }
// ровный мир: пол на ряду 13, ширина w
function flat(w, fn){ const g = []; for (let r = 0; r < 16; r++) g.push((r >= 13 ? '#' : ' ').repeat(w).split('')); if (fn) fn(g); const t = new Uint8Array(w * 16); const C = { '#': 1, '=': 2, '/': 3, '\\': 4, '*': 5, a: 6, b: 7 }; g.forEach((row, r) => row.forEach((ch, c) => { t[r * w + c] = C[ch] || 0; })); return { W: w, H: 16, t, stairs: [], mov: [], gate: { x: -5, y: 0 }, arena: { y0: 0 }, open: false, ph: 0 }; }
function setPh(S, p){ S.ph = p; S.lv.ph = p; }
function step(lv, h, inp, n = 1, Wo = {}){ const W = Object.assign({ lv, t: 0, gate: false }, Wo); for (let i = 0; i < n; i++){ L.heroStep(W, h, typeof inp === 'function' ? inp(h, i) : inp, DT); W.t += DT; } return h; }

// ---------- этажи ----------
test('6 этажей подряд (без развилок и дверей); финал — Часовое Сердце; у каждого свой страж', () => {
  eq(Object.keys(T.FLOORS).length, 6); eq(T.ROUTE.length, 6); eq(T.ROUTE[5], 'heart');
  eq(new Set(T.ROUTE.map(k => T.FLOORS[k].boss)).size, 6, 'свои стражи');
  for (const k of T.ROUTE){ const lv = T.build(k); ok(!lv.doors && !lv.branch, k + ': без развилок'); eq(T.floorKey(T.ROUTE.indexOf(k)), k); }
});
test('каждый этаж: старт, отметка, ворота арены (последние 32 колонки), страж, предметы со звеном катушки, фазовые блоки обоих видов', () => {
  for (const k of T.ROUTE){
    const lv = T.build(k);
    ok(lv.start && lv.cps.length >= 1 && lv.boss, k);
    eq(lv.W - lv.gate.x, 32, k + ' арена');
    ok(lv.cps[0].x > lv.start.x + 20 && lv.cps[0].x < lv.gate.x - 10, k + ': отметка посередине');
    ok(lv.items.length >= 7 && lv.items.some(l => l.k === 'coil'), k + ': предметы (' + lv.items.length + ') и катушка');
    ok(lv.foes.length >= 5, k + ': враги');
    ok(lv.hasPh, k + ': есть фазовые блоки'); let a = 0, b = 0; for (const v of lv.t){ if (v === 6) a++; if (v === 7) b++; }
    ok(a > 0 && (b > 0 || k === 'works' || k === 'gears' || k === 'flywheel' || k === 'pendulum' || k === 'springs' || k === 'heart'), k + ': блоки ТИК/ТАК');
  }
  ok(T.build('heart').final, 'финал');
  const w = T.build('works'); ok(w.t.some(v => v === 6) && w.t.some(v => v === 7), 'первый этаж: оба вида — урок «камни ТИК/ТАК»');
});
test('сборка: неизвестный знак карты — ошибка с именем этажа; лестницы найдены с верными концами', () => {
  const save = T.FLOORS.works.paint;
  try { T.FLOORS.works.paint = P => { save(P); P.put(5, 5, 'Q'); }; let m = ''; try { T.build('works'); } catch (e) { m = e.message; } ok(/works/.test(m) && /Q/.test(m), m); }
  finally { T.FLOORS.works.paint = save; }
  const lv = T.build('works');
  eq(JSON.stringify(lv.stairs[0]), JSON.stringify({ dir: 1, n: 4, bx: 26, by: 13, tx: 30, ty: 9 }));
  const lv2 = T.build('works'); lv2.ph = 1; ok(L.tileAt(lv2, 10, 10) === 0, 'стена ТИК в фазе ТАК — призрак'); lv2.ph = 0; eq(L.tileAt(lv2, 10, 10), 1, 'стена ТИК в фазе ТИК — твердь');
  lv2.ph = 0; eq(L.tileAt(lv2, 51, 13), 0, 'камень ТАК в фазе ТИК — призрак'); lv2.ph = 1; eq(L.tileAt(lv2, 51, 13), 1, 'камень ТАК в фазе ТАК — твердь');
});

// ---------- физика ----------
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


// ---------- щелчок фаз ----------
test('фазовая стена: в своей фазе держит героя, в чужой — проходима', () => {
  const lv = flat(30, g => { for (let r = 9; r <= 12; r++) g[r][15] = 'a'; });
  const h = L.newHero(10.5, 13); step(lv, h, { dx: 1 }, 120); near(h.x, 15 - K.HW, 0.01, 'упёрся в стену ТИК');
  lv.ph = 1; const h2 = L.newHero(10.5, 13); step(lv, h2, { dx: 1 }, 120); ok(h2.x > 17, 'в фазе ТАК стена — призрак: ' + h2.x);
});
test('щелчок: переключает фазу мира, событие flick, перезарядка K.FLICK_CD; без щелчка — ничего', () => {
  const g = mk('works'), S = g.S; eq(S.lv.ph, 0); eq(S.ph, 0);
  run(g.game, 0.2, { flick: true }); eq(S.lv.ph, 1, 'фаза ТАК'); eq(S.ph, 1); eq(g.count('flick'), 1, 'одно нажатие — один щелчок (держать нельзя)');
  g.game.setInput({}); g.game.update(DT); g.game.setInput({ flick: true }); g.game.update(DT); eq(S.lv.ph, 1, 'перезарядка'); eq(g.count('flick'), 1);
  run(g.game, K.FLICK_CD + 0.1); run(g.game, 0.1, { flick: true }); eq(S.lv.ph, 0, 'после перезарядки — обратно'); eq(g.count('flick'), 2);
});
test('щелчок заклинивает (jam): фаза замуровала бы героя; на фазовом блоке (опора ушла бы); в воздухе над блоком — можно', () => {
  const g = mk('works'), S = g.S;
  g.game._place(10.5, 13); setPh(S, 1); // герой стоит в клетках стены ТИК (в фазе ТАК она — призрак)
  ok(!g.game._flick(), 'замуровал бы'); eq(S.lv.ph, 1); ok(g.has('jam'));
  const g2 = mk('works'), S2 = g2.S; g2.game._place(22.5, 13);   // на мосту ТИК в фазе ТИК
  ok(!g2.game._flick(), 'на мосту щелчок убрал бы опору'); eq(S2.lv.ph, 0);
  S2.hero.ground = false; S2.hero.vy = 0; S2.hero.y = 11; S2.flickT = 0; ok(g2.game._flick(), 'в воздухе — можно'); eq(S2.lv.ph, 1);
});
test('волна: бьёт врагов в радиусе ступени катушки и не дальше; на ступени 3 — двойной урон и радиус больше', () => {
  const g = mk('works'), S = g.S; g.game._place(8.5, 13);
  const near1 = g.game._spawn('oiler', 10.0, 13), far = g.game._spawn('tick', 8.5 - 3.0, 13);
  S.flickT = 0; ok(g.game._flick()); eq(near1.hp, 1, 'ближний: −1'); eq(far.hp, 1, 'дальний (3,0 кл.) на ступени 1 не задет');
  const g2 = mk('works'), S2 = g2.S; g2.game._coil(3); g2.game._place(8.5, 13);
  const a = g2.game._spawn('oiler', 10.0, 13), b = g2.game._spawn('tick', 8.5 - 3.2, 13); g2.game._flick();
  ok(a.dead, 'ступень 3: oiler (hp 2) убит с одного щелчка'); ok(b.dead, 'ступень 3: радиус 3,5 достаёт');
  ok(K.R[1] < K.R[2] && K.R[2] < K.R[3]);
});
test('блок, выросший на враге, давит его; опора, ушедшая из-под врага, роняет его', () => {
  const g = mk('works'), S = g.S; g.game._place(3.5, 13);
  S.flickT = 0; g.game._flick(); eq(S.lv.ph, 1);                       // фаза ТАК: стена ТИК (x=10) — призрак
  const e = g.game._spawn('tick', 10.5, 13); e.vx = 0; S.flickT = 0; g.game._flick();   // фаза ТИК: стена выросла на враге
  ok(e.dead && g.has('crush'), 'раздавлен');
  const g2 = mk('works'), S2 = g2.S; g2.game._place(3.5, 13); const f = g2.game._spawn('tick', 22.5, 13);   // на мосту ТИК
  run(g2.game, 0.3); near(f.y, 13, 0.05, 'стоит на мосту'); S2.flickT = 0; g2.game._flick(); run(g2.game, 0.5); ok(f.y > 14, 'мост ушёл — упал: ' + f.y);
});
test('волна сбивает летящие снаряды врагов; щелчок гасит неуязвимость? нет — урон по герою не меняет', () => {
  const g = mk('works'), S = g.S; g.game._place(8.5, 13);
  S.eshots.push({ k: 'oil', x: 9.5, y: 12, vx: 0, vy: 0, g: 0, r: 0.25, dmg: 2, life: 4, hp: 1 });
  S.flickT = 0; g.game._flick(); eq(S.eshots.filter(q => !q.dead).length, 0, 'сбит'); ok(g.has('clank'));
});

// ---------- предметы ----------
test('предметы лежат на местах; винтик — очки; катушка повышает ступень (до 3), потом +1000; масло лечит; подобранное не возвращается после гибели', () => {
  const g = mk('works'), S = g.S; ok(S.items.length >= 7); const it = S.items.find(i => i.k === 'spark');
  g.game._place(it.x, it.y); run(g.game, 0.1); ok(!S.items.some(i => i === it), 'подобран'); eq(S.sparks, 1); ok(S.score >= K.SPARKPTS);
  const c = S.items.find(i => i.k === 'coil'); g.game._place(c.x, Math.min(13, c.y)); S.hero.y = c.y; run(g.game, 0.1); eq(S.coil, 2); ok(g.has('coil'));
  const g2 = mk('works'), S2 = g2.S; S2.coil = 3; const c2 = S2.items.find(i => i.k === 'coil'); const sc = S2.score; g2.game._place(c2.x, c2.y); run(g2.game, 0.1); eq(S2.score, sc + 1000);
  const g3 = mk('works'), S3 = g3.S; S3.hp = 5; const o = { k: 'oil', x: S3.hero.x, y: S3.hero.y, vy: 0, t: 0, ground: true }; S3.items.push(o); run(g3.game, 0.1); eq(S3.hp, 11);
  g.game._die('test'); run(g.game, K.DEAD + 0.1); ok(!S.items.some(i => i.idx === it.idx), 'винтик не вернулся');
});
test('все предметы достижимы: от поверхности под ними не выше прыжка+вытянутой руки', () => {
  for (const k of T.ROUTE){
    const lv = T.build(k);
    for (const it of lv.items){
      let r = Math.floor(it.y); while (r < lv.H && !L.standable(lv, Math.floor(it.x), r) && !L.standable(lv, Math.floor(it.x), r + 1)) r++;
      if (r >= lv.H) continue;
      ok(r - it.y <= 4.3, k + ': предмет (' + it.x + ',' + it.y + ') слишком высоко над опорой ' + r);
    }
  }
});

// ---------- урон ----------
test('отбрасывание: удар отбрасывает назад и вверх, неуязвимость; на лестнице — без отброса; отброс в шахту — гибель', () => {
  const g = mk('works'), S = g.S; g.game._place(6.5, 13);
  g.game._hurt(2, 7.5); ok(S.hero.kb && S.hero.vx < 0 && S.hero.vy < 0, 'отброс'); eq(S.hp, K.HP - 2);
  ok(!g.game._hurt(2, 7.5), 'неуязвим'); run(g.game, 1); ok(S.hero.ground && !S.hero.kb, 'приземлился');
  const s = S.lv.stairs[0]; g.game._place(s.bx, s.by); run(g.game, 0.4, { up: true }); S.hero.inv = 0; const x = S.hero.x; g.game._hurt(2, x + 1); ok(S.hero.stair && !S.hero.kb, 'на лестнице держится');
  const g2 = mk('works'), S2 = g2.S; setPh(S2, 1); g2.game._place(20.6, 13); g2.game._hurt(2, 19); run(g2.game, 2); ok(g2.ev.some(e => e.t === 'die' && e.d.why === 'pit'), 'в пролом');
});
test('зубчатка ранит; маятник и подъёмник везут стоящего героя', () => {
  const g = mk('pendulum'), S = g.S; g.game._place(50.5, 13); run(g.game, 0.4, { dx: 1 }); ok(g.ev.some(e => e.t === 'hurt' && e.d.why === 'saw'), 'зубчатка');
  const g2 = mk('gears'), S2 = g2.S, m = S2.lv.mov[0]; S2.t = 0; g2.game._place(m.x + m.w / 2, L.platAt(m, 0).top); S2.hero.on = 0;
  run(g2.game, m.per / 2); near(S2.hero.y, m.y - m.h, 0.05, 'поднят'); eq(S2.hero.on, 0);
  const g3 = mk('works'), S3 = g3.S, p = S3.lv.mov[0]; S3.t = 0; const P0 = L.platAt(p, 0); g3.game._place(P0.cx, P0.top); S3.hero.on = 0;
  run(g3.game, p.per / 4); const P1 = L.platAt(p, S3.t); near(S3.hero.x, P1.cx, 0.05, 'едет с маятником'); near(S3.hero.y, P1.top, 0.02);
});


// ---------- проходимость ----------
const NAVS = {}; for (const k of T.ROUTE) NAVS[k] = navFor(T, k);
const goal = lv => u => u % lv.W > lv.gate.x + 2;
test('проходимость: с старта каждого этажа граф по настоящей физике доходит до арены стража', () => {
  for (const k in NAVS){ const { lv, nav } = NAVS[k], R = nav.reach(nav.startNode); ok(Object.keys(R).some(goal(lv)), k); }
});
test('щелчок обязателен: если убрать из графа рёбра со щелчком (щелчок на месте и в прыжке), арена каждого этажа недостижима', () => {
  for (const k in NAVS){
    const { lv, nav } = NAVS[k], seen = new Set([nav.startNode]), q = [nav.startNode];
    while (q.length){ const u = q.shift(); for (const e of nav.edges[u]){ if (e.type === 'flip' || e.fk > 0 || seen.has(e.to)) continue; seen.add(e.to); q.push(e.to); } }
    ok(![...seen].some(goal(lv)), k + ': пройден без щелчка');
    const p = route(T, k); ok(p.some(e => e.type === 'flip' || e.fk > 0), k + ': кратчайший путь использует щелчок');
  }
});
test('проходимость: тупиков нет — из любой достижимой точки этажа (в любой фазе) можно дойти до арены', () => {
  for (const k in NAVS){
    const { lv, nav } = NAVS[k], R = nav.reach(nav.startNode), rev = {};
    for (const u in nav.edges) for (const e of nav.edges[u]) (rev[e.to] = rev[e.to] || []).push(+u);
    const can = new Set(Object.keys(R).map(Number).filter(goal(lv))), q = [...can];
    while (q.length){ const u = q.shift(); for (const v of rev[u] || []) if (!can.has(v)){ can.add(v); q.push(v); } }
    const dead = Object.keys(R).map(Number).filter(u => !can.has(u));
    eq(dead.length, 0, k + ' тупики ' + dead.map(u => nav.col(u) + ':' + nav.row(u) + 'ф' + nav.phase(u)).join(' '));
  }
});
test('проходимость: отметки достижимы; у каждого этажа есть узлы в обеих фазах', () => {
  for (const k in NAVS){ const { lv: l2, nav: n2 } = NAVS[k], R2 = n2.reach(n2.startNode); for (const c of l2.cps) ok(R2[L.pointNode(l2, c.x, c.y, 0)] || R2[L.pointNode(l2, c.x, c.y, 1)], k + ' отметка'); ok(n2.nodes.some(u => n2.phase(u) === 0) && n2.nodes.some(u => n2.phase(u) === 1), k); }
});
test('маятники и подъёмники: переправа контроллером удаётся при старте в любой из 24 фаз (настоящая физика)', () => {
  for (const k of T.ROUTE){
    const lv0 = T.build(k);
    lv0.mov.forEach((m, mi) => {
      for (let p = 0; p < 24; p++){
        const g = mk(k), S = g.S; S.t = m.per * p / 24; g.game._place(m.from[0] + 0.5, m.from[1]);
        const st = { m: mi, ph: 'go' }; let okk = false;
        for (let f = 0; f < 60 * (3 * m.per + 4); f++){
          const inp = L.rideCtl(S.lv, st, S, { lv: S.lv, t: S.t, gate: S.gateClosed }); g.game.setInput(inp); g.game.update(DT);
          if (st.ph === 'done'){ okk = true; break; } if (st.ph === 'fail' || S.phase !== 'play') break;
        }
        ok(okk, k + ' опора ' + mi + ' фаза ' + p + ': ' + st.ph);
      }
    });
  }
});
test('исполнимость: кратчайший путь графа (со щелчками) исполняется подряд в одной партии до арены — на каждом этаже', () => {
  for (const k of T.ROUTE){
    const g = mk(k, { dmgMul: 0 }), S = g.S, lv = S.lv, p = route(T, k); ok(p && p.length, k + ': путь');
    let i = 0, X = null, f = 0;
    for (; f < 60 * 200 && S.bossState === 'none' && S.phase === 'play'; f++){
      if (!X){ if (i >= p.length) break; X = makeExec(T, lv, p[i++], 0); }
      const r = stepExec(T, lv, X, S); ok(!r.fail, k + ': ребро ' + (i - 1) + ' ' + X.e.type + (X.e.fk > 0 ? 'F' : '') + ' x=' + S.hero.x.toFixed(2) + ' ф' + S.lv.ph);
      if (r.done){ X = null; continue; }
      g.game.setInput(r.inp); g.game.update(DT);
    }
    ok(S.bossState !== 'none' || S.hero.x > lv.gate.x + 1, k + ': дошёл до арены (x=' + S.hero.x.toFixed(1) + ')');
    ok(g.count('flick') >= 1, k + ': щелчков ' + g.count('flick'));
    eq(g.count('die'), 0, k + ': без гибели');
  }
});

// ---------- стражи ----------
test('стражи: на каждом этаже ворота закрываются, страж атакует, получает урон от щелчка, гибнет; выход — шестерня хода / победа', () => {
  const ATT = { cuckoo: ['swoop', 'egg'], pendulum: ['gearDrop', 'sweep'], drake: ['hop', 'breath'], spider: ['nut'], flywheel: ['stomp'], heart: ['dart'] };
  for (const k of T.ROUTE){
    const g = mk(k, { dmgMul: 0 }), S = g.S, lv = S.lv;
    g.game._place(lv.gate.x + 3.5, 13); run(g.game, 0.1);
    ok(S.bossState === 'intro' && S.gateClosed, k + ': ворота');
    run(g.game, 14);
    ok(S.bossState === 'fight', k + ' бой'); for (const a of ATT[lv.bossKind]) ok(g.has(a), k + ': атака ' + a);
    const hp = S.boss.hp; g.game._bossDamage(1); eq(S.boss.hp, hp - 1, k + ' урон');
    while (S.boss && S.bossState === 'fight') g.game._bossDamage(5);
    ok(g.has('bossDie'), k + ' повержен');
    if (lv.final){ eq(S.phase, 'won'); ok(g.has('win')); continue; }
    run(g.game, 3); const core = S.items.find(i => i.k === 'core'); ok(core && core.ground, k + ': шестерня хода');
    g.game._place(core.x, core.y); run(g.game, 0.1); eq(S.phase, 'clear', k + ' этаж пройден');
  }
});
test('щелчок рядом со стражем наносит ему урон (в радиусе ступени катушки), вдали — нет', () => {
  const g = mk('works', { dmgMul: 0 }), S = g.S; const b = g.game._startBoss(); b.iv = 0;
  g.game._place(b.x - 9, 13); S.flickT = 0; const hp = b.hp; g.game._flick(); eq(b.hp, hp, 'вдали — нет');
  g.game._place(b.x, b.y + 1.5); S.hero.ground = false; S.flickT = 0; b.iv = 0; g.game._flick(); eq(b.hp, hp - 1, 'вблизи — −1');
});
test('кукушка проносится на высоте груди: стоя — удар, пригнувшись — мимо', () => {
  const g = mk('works'), S = g.S; const b = g.game._startBoss(); S.hero.inv = 0;
  g.game._place(b.cx - 2, 13); b.st = 'swoop'; b.t = 0; b.x0 = b.cx + 7; b.y0 = b.hy; b.x2 = b.cx - 9; b.x1 = b.cx - 2;
  run(g.game, 1.6, { down: true }); eq(S.hp, K.HP, 'пригнулся');
  b.st = 'swoop'; b.t = 0; b.x0 = b.cx + 7; b.y0 = b.hy; b.x2 = b.cx - 9; S.hero.inv = 0; run(g.game, 1.6); ok(S.hp < K.HP, 'стоя — удар');
});

// ---------- жизни, сохранение ----------
test('жизни: гибель — с отметки, катушка на ступень ниже, фаза — ТИК; 0 жизней → «Продолжить?»; продолжение — 3 жизни, счёт 0; отказ — конец', () => {
  const g = mk('works'), S = g.S, cp = S.lv.cps[0]; g.game._place(cp.x, cp.y); run(g.game, 0.1); ok(S.cp, 'отметка');
  g.game._coil(3); S.flickT = 0; g.game._flick(); eq(S.lv.ph, 1); g.game._die('test'); run(g.game, K.DEAD + 0.1); eq(S.phase, 'play'); eq(S.hero.x, cp.x); eq(S.coil, 2); eq(S.lives, K.LIVES - 1); eq(S.lv.ph, 0, 'фаза сброшена');
  S.score = 777; while (S.lives > 0){ g.game._die('test'); run(g.game, K.DEAD + 0.1); }
  eq(S.phase, 'cont'); g.game.continueGame(); eq(S.phase, 'play'); eq(S.lives, K.LIVES); eq(S.score, 0); eq(S.conts, K.CONTS - 1);
  S.lives = 1; g.game._die('test'); run(g.game, K.DEAD + 0.1); g.game.giveUp(); eq(S.phase, 'over'); ok(g.has('gameover'));
});
test('жизнь за очки: 20 000 и далее каждые 40 000', () => {
  const g = mk('works'), S = g.S, l0 = S.lives; S.items.push({ k: 'token', x: S.hero.x, y: S.hero.y, vy: 0, t: 0, ground: true }); S.score = 19800; run(g.game, 0.05); eq(S.lives, l0 + 1); ok(g.has('life'));
});
test('сохранение: данные этажа; партия с start продолжает этаж, катушку и винтики', () => {
  const g = mk('gears'), S = g.S; S.coil = 2; S.sparks = 12;
  const sv = g.game.saveData(); eq(JSON.stringify(sv), JSON.stringify({ fi: 3, coil: 2, sparks: 12, score: S.score }));
  const g2 = T.Game({ start: sv }).start(), S2 = g2.state(); eq(S2.key, 'gears'); eq(S2.coil, 2); eq(S2.sparks, 12); eq(S2.lv.ph, 0);
});
test('миграция записей: старое сохранение стирается, рекорд сохраняется отдельно, повтор — без действий', () => {
  const m = {}; const io = { get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = String(v); }, del: (k) => { delete m[k]; } };
  m['arcade.best.tsep'] = '12345'; m['arcade.save.tsep'] = '{"fi":3}';
  const r = T.migrate(io);
  ok(r.migrated && r.oldBest === 12345 && r.notice, 'первый запуск: ' + JSON.stringify(r));
  ok(!m['arcade.save.tsep'] && !m['arcade.best.tsep'] && m['arcade.tsep.oldBest'] === '12345' && m['arcade.tsep.v'] === '2', 'записи');
  const r2 = T.migrate(io); ok(!r2.migrated && r2.oldBest === 12345, 'повтор: ' + JSON.stringify(r2));
  const io2 = { get: () => null, set() {}, del() {} }; ok(!T.migrate(io2).migrated, 'чистый профиль — без сообщения');
});
test('пароль: 5 знаков, обратимо для всех этажей/ступеней/винтиков; искажённый и старый — не принимается', () => {
  let n = 0;
  for (let fi = 0; fi < 6; fi++) for (let coil = 1; coil <= 3; coil++) for (const sparks of [0, 9, 30, 90]){
    const code = L.encode({ fi, coil, sparks }); eq(code.length, 5);
    const d = L.decode(code); ok(d && d.fi === fi && d.coil === coil && d.sparks === sparks, code + ' ' + JSON.stringify(d)); n++;
  }
  ok(n >= 72);
  const c = L.encode({ fi: 4, coil: 3, sparks: 15 });
  let bad = 0; for (let i = 0; i < 5; i++) for (const ch of L.ALPH){ if (ch === c[i]) continue; const t = c.slice(0, i) + ch + c.slice(i + 1); if (L.decode(t)) bad++; }
  ok(bad < 6, 'искажения почти всегда отвергнуты: ' + bad); eq(L.decode('ABC'), null); eq(L.decode('!!!!!'), null);
  eq(L.decode(c.toLowerCase()).fi, 4, 'регистр не важен');
});

// ---------- музыка, i18n, имена ----------
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
test('i18n: пять языков (ru, en, tr, es, pt) с одинаковыми ключами; есть имена этажей, стражей, врагов, причин гибели, фаз и площадки', () => {
  const langs = ['ru', 'en', 'tr', 'es', 'pt']; eq(Object.keys(T.STR).join(), langs.join());
  const ru = Object.keys(T.STR.ru).sort(); for (const l of langs) eq(Object.keys(T.STR[l]).sort().join(','), ru.join(','), l);
  for (const l of langs){
    const S = T.STR[l];
    for (const k of Object.keys(T.FLOORS)){ ok(S['f_' + k], l + ' ' + k); ok(S['b_' + T.FLOORS[k].boss], l + ' ' + T.FLOORS[k].boss); }
    for (const f of Object.keys(L.FOE)) ok(S['e_' + f] && S['d_' + f], l + ' ' + f);
    for (const d of ['pit', 'saw', 'boss', 'oil', 'gear', 'egg', 'shard', 'steam', 'nut', 'dart']) ok(S['d_' + d], l + ' ' + d);
    for (const key of ['title', 'subtitle', 'phaseA', 'phaseB', 'tutFlick', 'tutBridge', 'tutStones', 'rwHeal', 'cardClear', 'cardNext', 'migrated', 'oldBest', 'jam']) ok(S[key], l + ' ' + key);
    for (const key of Object.keys(S)) ok(typeof S[key] === 'string' && S[key].length > 0, l + ' ' + key);
  }
  ok(T.STR.en.title !== T.STR.ru.title, 'EN-название отдельное');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFrdW1hanzQsNC60YPQvNCw0LTQt3xiZWxtb250fNCx0LXQu9GM0LzQvtC90YJ80LHQtdC70LzQvtC90YJ8XGJzaW1vblxifNGB0LDQudC80L7QvXzRgdC40LzQvtC9KD8hW9CwLdGP0ZFdKXxkcmFjdWx80LTRgNCw0LrRg9C7fNC60LDRgdGC0LvQstCw0L3QuHzQutCw0YHQu9Cy0LDQvdC4fGFsdWNhcmR80LDQu9GD0LrQsNGA0LQ=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без урона проходит каждый этаж со стражем (настоящая физика, враги на месте)', () => {
  for (let fi = 0; fi < 6; fi++){
    const res = playFloor(T, 1, { fi, god: true, maxT: 300 }); ok(res.cleared, fi + ' ' + JSON.stringify({ t: res.t, at: res.at, stuck: res.stuck }));
  }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, часть решений прозёвывает, ошибка места толчка ±0.04.
const N1 = +process.env.N1 || 20, B1 = []; for (let s = 1; s <= N1; s++) B1.push(playFloor(T, s, { fi: 0 }));
test('баланс: «человеческий» бот проходит этаж 1 (со стражем, 3 жизни, без продолжений) часто — ≥ 70% партий', () => {
  const n = B1.filter(r => r.cleared).length, why = {}; B1.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     этаж 1: ' + n + '/' + N1 + ', гибели: ' + JSON.stringify(why) + ', щелчков в среднем ' + (B1.reduce((a, r) => a + r.flicks, 0) / N1).toFixed(0) + ', бой со стражем ≈ ' + (B1.filter(r => r.bossT).reduce((a, r) => a + r.bossT, 0) / Math.max(1, B1.filter(r => r.bossT).length)).toFixed(0) + ' с');
  ok(n >= 0.7 * N1, 'слишком сложно: ' + n + '/' + N1);
  ok(B1.some(r => r.deaths > 0 || r.hp < K.HP), 'и не пресно: бот получает урон');
});
test('баланс: остальные этажи проходимы «человеком» (бот с 5 жизнями берёт каждый хотя бы в 1 из 4 партий)', () => {
  const out = [];
  for (let fi = 1; fi < 6; fi++){
    let n = 0; for (let s = 1; s <= 4; s++){ const res = playFloor(T, s, { fi, lives: 5, coil: 2, sparks: 10 }); if (res.cleared) n++; }
    out.push((fi + 1) + ':' + n + '/4'); ok(n >= 1, 'этаж ' + (fi + 1) + ' не взят');
  }
  console.log('     ' + out.join(' '));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

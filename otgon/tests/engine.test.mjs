/* ОТГОН · tests/engine.test.mjs — автотесты логики, музыки, страницы и правила имён (Node, без зависимостей).
   Запуск: node otgon/tests/engine.test.mjs   (QUICK=1 — без долгих прогонов бота). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { playOtgon, mulberry32 } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const box = { console, Math, JSON, Array, Object };
box.window = box; box.globalThis = box; vm.createContext(box);
for (const f of ['js/game.js', 'js/meta.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box, { filename: f });
const O = box.OTGON, L = O.logic, K = L.K, LEGS = L.LEGS;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e){ failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error((m || '') + ' ждали ' + B + ', получили ' + A); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// ---------- помощники ----------
const DT = 1 / 60;
const herdOf = (n, food = 0.9, pep = 0.9) => Array.from({ length: n }, (_, i) => ({ id: i, mark: i, food, pep }));
// игра «стадо стоит в точке x участка lv» (lv с нуля)
function mk(lv = 0, x = 600, o = {}){
  const log = [], evs = [];
  const g = O.Game({ rng: mulberry32(o.seed || 7), snapshot: { v: 1, lv, x, herd: o.herd || herdOf(o.n || 10, o.food, o.pep), gone: o.gone || [], T: 0 }, onEvent: (t, d) => { log.push(t); evs.push([t, d]); } }).start();
  g.log = log; g.evs = evs; return g;
}
function run(g, sec, fn){ for (let i = 0; i < sec * 60; i++){ if (fn && fn(g.state(), i / 60) === false) break; g.update(DT); } }
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cenOf = list => ({ x: list.reduce((a, c) => a + c.x, 0) / list.length, y: list.reduce((a, c) => a + c.y, 0) / list.length });
const spread = g => { const a = g.alive(), c = cenOf(a); return Math.max(...a.map(q => D(q, c))); };
const count = (g, t) => g.log.filter(x => x === t).length;
const lostWhy = g => g.evs.filter(e => e[0] === 'lost').map(e => e[1].why);

// ---------- Участки ----------
test('путь: 6 участков, у каждого костёр, чекпоинты по возрастанию, трава для привала; коридор нигде не уже 55', () => {
  eq(LEGS.length, 6); ok(LEGS[5].last && LEGS.slice(0, 5).every(l => !l.last), 'последний участок — пастбище');
  LEGS.forEach((l, i) => {
    ok(l.camp[0] > l.len - 500 && l.grass.length >= 3, 'участок ' + (i + 1));
    ok(l.cps.every((c, j) => j === 0 || c > l.cps[j - 1]) && l.cps.length >= 3, 'чекпоинты ' + (i + 1));
    for (let x = 0; x <= l.len; x += 20) { const w = L.botY(l, x) - L.topY(l, x); ok(w >= 55, 'участок ' + (i + 1) + ', x=' + x + ': ширина ' + w.toFixed(0)); }
  });
});
test('путь: опасности распределены — карнизы (3), реки (3), буран, гроза, птицы (4), развилки (3); смена времени суток', () => {
  eq(LEGS.filter(l => l.drops.length).length, 3, 'карнизы'); eq(LEGS.reduce((a, l) => a + l.rivers.length, 0), 3, 'реки');
  eq(LEGS.filter(l => l.bliz).length, 1); eq(LEGS.filter(l => l.storm).length, 1); eq(LEGS.filter(l => l.birds).length, 4); eq(LEGS.filter(l => l.isl).length, 3, 'развилки');
  LEGS.forEach(l => ok(L.todAt(l, l.len) > L.todAt(l, 0) + 0.2, 'время суток идёт'));
  ok(L.todAt(LEGS[5], 9000) < 0.4, 'финал — днём');
});
test('развилка: верхняя ветка — узкий карниз над провалом, нижняя — широкая и вязкая (медленнее)', () => {
  LEGS.filter(l => l.isl).forEach(l => {
    const x = (l.isl.x0 + l.isl.x1) / 2, a = L.islAt(l, x), up = a.t - L.topY(l, x), dn = L.botY(l, x) - a.b;
    ok(up > 50 && up < 90 && dn > up * 1.7, 'ширины: ' + up.toFixed(0) + ' / ' + dn.toFixed(0));
    ok(L.slowAt(l, x, a.b + 30) && !L.slowAt(l, x, a.t - 20), 'вязкая только нижняя');
    ok(L.laneY(l, x, 'up') < a.t && L.laneY(l, x, 'down') > a.b, 'линии веток');
  });
});

// ---------- Стадное поведение ----------
test('стадо: без причины не разбегается — минута покоя, все рядом, никто не отбился и не потерян', () => {
  const g = mk(0, 600); run(g, 60);
  ok(spread(g) < 110, 'разброс ' + spread(g).toFixed(0)); ok(g.alive().length === 10 && !g.alive().some(c => c.stray), 'отбившиеся'); eq(count(g, 'lost'), 0);
});
test('стадо: подпасок идёт сзади — стадо уходит от него вперёд и держится вместе', () => {
  const g = mk(0, 600), x0 = cenOf(g.alive()).x;
  run(g, 30, s => { const c = cenOf(g.alive()); g.setMove(s.hero.x < c.x - 60 ? 1 : 0.5, (c.y - s.hero.y) / 60, false); });
  const c = cenOf(g.alive()); ok(c.x - x0 > 900, 'прошли ' + (c.x - x0).toFixed(0)); ok(spread(g) < 150, 'разброс ' + spread(g).toFixed(0)); ok(!g.alive().some(q => q.stray));
});
test('стадо: подпасок уходит прочь — стадо за ним не идёт и не пугается', () => {
  const g = mk(0, 1000), x0 = cenOf(g.alive()).x;
  run(g, 8, () => g.setMove(-1, 0, true)); ok(Math.abs(cenOf(g.alive()).x - x0) < 40, 'сдвиг ' + (cenOf(g.alive()).x - x0));
});
test('свист: разбредшееся стадо собирается к подпаску (и перестаёт считаться отбившимся)', () => {
  const g = mk(0, 3000), s = g.state();
  g.alive().forEach((c, i) => { c.x = s.hero.x + Math.cos(i) * (150 + i * 12); c.y = 300 + Math.sin(i) * 120; });
  ok(spread(g) > 150); run(g, 10, () => { g.whistle(); });
  ok(g.alive().every(c => D(c, s.hero) < 95), 'далеко: ' + Math.max(...g.alive().map(c => D(c, s.hero))).toFixed(0)); ok(count(g, 'whistle') >= 5 && s.hero.wT >= 0);
});
test('свист: есть перезарядка и радиус — дальний за ' + K.WHISTLE_R + ' не слышит', () => {
  const g = mk(0, 3000), s = g.state(), far = g.alive()[9]; far.x = s.hero.x + K.WHISTLE_R + 80;
  ok(g.whistle() && !g.whistle(), 'перезарядка'); ok(far.callT <= 0 && g.alive()[1].callT > 0, 'радиус');
});
test('посох: направляет стадо туда, куда смотрит подпасок, и поднимает упрямца', () => {
  const g = mk(0, 3000), s = g.state(), y0 = cenOf(g.alive()).y;
  run(g, 0.3, () => g.setMove(0, -1, false)); g.setMove(0, 0, false);
  g.alive()[2].balk = 3; ok(g.staff() && !g.staff(), 'перезарядка'); eq(g.alive()[2].balk, 0);
  run(g, 3); ok(cenOf(g.alive()).y < y0 - 60, 'стадо не пошло вверх: ' + (cenOf(g.alive()).y - y0).toFixed(0));
  ok(g.alive().every(c => c.y > L.topY(LEGS[0], c.x)), 'в стену не уходят');
});
test('отбившийся: стоит и ждёт; свист рядом — идёт за подпаском обратно к стаду', () => {
  const g = mk(0, 3000), s = g.state(), c = g.alive()[5]; c.x += 520; run(g, 4);
  ok(c.stray, 'не считается отбившимся'); const x0 = c.x; run(g, 6); ok(Math.abs(c.x - x0) < 40, 'убрёл сам');
  run(g, 60, (st, t) => {   // сходить за ним: подойти, свистнуть, вернуться к стаду, зовя
    const cen = cenOf(g.alive().filter(q => q !== c)), far = D(c, cen) > 150;
    if (!far) return false;
    if (D(c, st.hero) > 200) g.setMove(Math.sign(c.x - st.hero.x), (c.y - st.hero.y) / 80, true);
    else { g.whistle(); if (D(c, st.hero) < 90) g.setMove(Math.sign(cen.x - st.hero.x), (cen.y - st.hero.y) / 80, false); else g.setMove(0, 0); }
  });
  run(g, 2, () => g.setMove(0, 0)); ok(!c.stray && D(c, cenOf(g.alive())) < 170, 'не вернулся: ' + D(c, cenOf(g.alive())).toFixed(0));
});
test('нравы: вожак, два упрямца, два пугливых, обжора, копуша; упрямец встаёт (balk), пугливый пугается сильнее', () => {
  const t = L.TEMPERS; eq(t.filter(x => x === 'lead').length, 1); eq(t.filter(x => x === 'stubborn').length, 2); eq(t.filter(x => x === 'timid').length, 2); eq(t.filter(x => x === 'glutton').length, 1); eq(t.filter(x => x === 'dawdler').length, 1);
  const g = mk(0, 600); run(g, 90, s => { const c = cenOf(g.alive()); g.setMove(s.hero.x < c.x - 60 ? 1 : 0.4, (c.y - s.hero.y) / 60, false); });
  ok(count(g, 'balk') >= 1, 'упрямцы ни разу не встали');
  const st = mk(4, 2600), a = st.alive(); a.forEach(c => { c.x = 2700; c.y = 300; }); st.state().strikes.push({ x: 2760, y: 300, t: 0.01 }); st.update(DT);
  ok(a[3].fear > a[1].fear * 1.3, 'пугливый ' + a[3].fear + ' vs ' + a[1].fear);
});

// ---------- Забота: голод, усталость, привал ----------
test('голод и усталость: в пути убывают, бегом — быстрее', () => {
  const walk = mk(0, 600), runG = mk(0, 600);
  const drive = (g, fast) => run(g, 25, s => { const c = cenOf(g.alive()); g.setMove(s.hero.x < c.x - 50 ? 1 : 0.4, (c.y - s.hero.y) / 60, fast); });
  drive(walk, false); drive(runG, true);
  const f = g => g.alive().reduce((a, c) => a + c.food, 0) / 10, p = g => g.alive().reduce((a, c) => a + c.pep, 0) / 10;
  ok(f(walk) < 0.86 && p(walk) < 0.86, 'шагом: ' + f(walk) + ' / ' + p(walk)); ok(f(runG) < f(walk) - 0.02 && p(runG) < p(walk) - 0.04, 'бегом не быстрее: ' + f(runG) + ' / ' + p(runG));
});
test('голод: голодное и уставшее стадо идёт заметно медленнее', () => {
  const dist = (food, pep) => { const g = mk(0, 2800, { food, pep }), x0 = cenOf(g.alive()).x; run(g, 20, s => { g.alive().forEach(c => { c.food = food; c.pep = pep; }); const c = cenOf(g.alive()); g.setMove(s.hero.x < c.x - 50 ? 1 : 0.4, (c.y - s.hero.y) / 60, false); }); return cenOf(g.alive()).x - x0; };
  const full = dist(0.9, 0.9), weak = dist(0.1, 0.1); ok(weak < full * 0.7, weak.toFixed(0) + ' vs ' + full.toFixed(0));
});
test('привал: на траве стадо пасётся и наедается; у воды — пьёт и отдыхает; просто стоя — отдыхает медленно', () => {
  const l = LEGS[0], gr = l.grass[0], g = mk(0, gr[0] - 80, { food: 0.3, pep: 0.9 }); g.alive().forEach((c, i) => { c.x = gr[0] + Math.cos(i) * 40; c.y = gr[1] + Math.sin(i) * 40; });
  run(g, 3); ok(g.alive().filter(c => c.graze).length >= 8, 'не пасутся'); run(g, 22); ok(g.alive().every(c => c.food > 0.9), 'не наелись: ' + Math.min(...g.alive().map(c => c.food)));
  const w = l.water[0], g2 = mk(0, w[0] - 160, { food: 1, pep: 0.3 }); run(g2, 30); ok(g2.alive().every(c => c.pep > 0.85), 'не отдохнули у воды: ' + Math.min(...g2.alive().map(c => c.pep)));
  const g3 = mk(0, 4300, { food: 1, pep: 0.3 }); run(g3, 20); const p = Math.min(...g3.alive().map(c => c.pep)); ok(p > 0.42 && p < 0.6, 'отдых стоя: ' + p);
});
test('привал: стадо само тянется к траве поблизости, когда его не гонят; обжора сворачивает к траве даже на ходу', () => {
  const l = LEGS[0], gr = l.grass[0], g = mk(0, gr[0] - 300, { food: 0.5, pep: 1 }); run(g, 25);
  ok(g.alive().filter(c => Math.hypot(c.x - gr[0], c.y - gr[1]) < gr[2]).length >= 8, 'не дошли до травы');
  ok(g.alive().every(c => c.food > 0.6));
});

// ---------- Опасности ----------
const botRun = (from, to, o = {}) => playOtgon(O, o.seed || 3, { from: { v: 1, lv: from[0], x: from[1], herd: herdOf(10, 0.95, 0.95), gone: [] }, maxT: o.maxT || 600, branch: o.branch, stop: s => s.lv !== from[0] || s.hero.x > to, react: o.react });
test('карниз: спокойное стадо держится от края; бот проводит гуськом без потерь (3 карниза)', () => {
  const g = mk(1, 3000); run(g, 40); eq(count(g, 'lost'), 0, 'сами падают');
  [[1, 2200, 4700], [4, 2900, 5000], [5, 4900, 6800]].forEach(([lv, a, b]) => { const r = botRun([lv, a], b, { seed: lv + 1 }); ok(r.x > b && r.home >= 9 && !r.stuck, 'участок ' + (lv + 1) + ': ' + JSON.stringify({ x: r.x | 0, home: r.home, lost: r.lost })); });
});
test('карниз: перепуганное существо может сорваться — это потеря, но не конец игры', () => {
  const g = mk(1, 3200), l = LEGS[1], c = g.alive()[3]; c.y = L.botY(l, c.x) - 14; c.fear = 1; c.fx = c.x; c.fy = c.y - 80;
  run(g, 4); eq(lostWhy(g), ['fall']); eq(g.alive().length, 9); eq(g.state().phase, 'play'); eq(g.state().gone[0].id, 3);
});
test('река: спокойное стадо в глубину не идёт; по броду проходит; бегом загнанное в глубину уносит течением', () => {
  const l = LEGS[2], r = l.rivers[0], g = mk(2, r.x - 240), s = g.state();
  g.alive().forEach((c, i) => { c.x = r.x - 60 - (i % 3) * 22; c.y = r.f1 + 40 + (i % 4) * 16; });   // мимо брода
  run(g, 14, st => { st.hero.y = r.f1 + 70; g.setMove(st.hero.x < r.x - 110 ? 1 : 0.3, 0, false); });
  eq(count(g, 'lost'), 0, 'шагом в глубину'); ok(g.alive().every(c => c.x < r.x + 4 || (c.y >= r.f0 && c.y <= r.f1)), 'кто-то в глубине');
  const b = botRun([2, r.x - 500], r.x + r.w + 200); ok(b.x > r.x + r.w && b.home === 10, 'бот по броду: ' + JSON.stringify(b.lost) + ' x=' + (b.x | 0));
  const g2 = mk(2, r.x - 160); g2.alive().forEach((c, i) => { c.x = r.x - 50 - (i % 3) * 20; c.y = r.f1 + 50 + (i % 4) * 14; });
  run(g2, 0.2, () => g2.setMove(1, 0, true)); g2.staff(); run(g2, 9, () => { g2.setMove(1, 0, true); g2.staff(); });
  ok(lostWhy(g2).filter(w => w === 'river').length >= 3, 'течение никого не унесло: ' + lostWhy(g2)); eq(g2.state().phase === 'play' || g2.state().phase === 'alone', true);
});
test('река: упрямец встаёт у воды; посох его сдвигает', () => {
  const l = LEGS[2], r = l.rivers[0], g = mk(2, r.x - 200), mid = (r.f0 + r.f1) / 2;
  g.alive().forEach((c, i) => { c.x = r.x - 60 - (i % 5) * 20; c.y = mid - 20 + (i % 3) * 20; });
  run(g, 12, st => { st.hero.y = mid; g.setMove(st.hero.x < r.x - 130 ? 1 : 0.3, 0, false); });
  ok(count(g, 'balk') >= 1, 'упрямцы не встали у брода');
});
test('буран: сбивает с пути и глушит свист; бот проводит стадо свистом (без потерь)', () => {
  const l = LEGS[3], g = mk(3, 3400), s = g.state();
  ok(L.zoneK(l.bliz, 3400) === 1 && L.zoneK(l.bliz, 1000) === 0); g.whistle(); ok(s.lastWhistleR < K.WHISTLE_R * 0.6, 'радиус свиста ' + s.lastWhistleR);
  const dist = lv => { const q = mk(lv, 3000), x0 = cenOf(q.alive()).x; run(q, 25, st => { q.alive().forEach(c => { c.food = c.pep = 0.9; }); const c = cenOf(q.alive()); q.setMove(st.hero.x < c.x - 60 ? 1 : 0.4, (c.y - st.hero.y) / 60, false); }); return cenOf(q.alive()).x - x0; };
  const calm = dist(0), bl = dist(3); ok(bl < calm * 0.85, 'в буран не медленнее: ' + bl.toFixed(0) + ' vs ' + calm.toFixed(0));
  const r = botRun([3, 2200], 5200, { maxT: 900 }); ok(r.x > 5200 && r.home === 10 && !r.stuck, JSON.stringify({ x: r.x | 0, home: r.home, t: r.time | 0 }));
});
test('птицы: без присмотра птица пикирует — существо в испуге убегает; подпасок рядом или взмах посоха отгоняют', () => {
  const g = mk(1, 5400), s = g.state(); s.birdT = 0.1; s.hero.x -= 400;
  run(g, 6); ok(count(g, 'bird') === 1 && count(g, 'dive') === 1 && count(g, 'swoop') === 1 && count(g, 'bolt') >= 1, 'нет пике: ' + g.log.join(','));
  const g2 = mk(1, 5400), s2 = g2.state(); s2.birdT = 0.1; run(g2, 1.5); ok(s2.bird && s2.bird.ph === 'circle', 'птица не кружит');
  const tg = g2.alive().find(c => c.id === s2.bird.id); s2.hero.x = tg.x - 30; s2.hero.y = tg.y; run(g2, 1); ok(count(g2, 'shoo') === 1 && count(g2, 'swoop') === 0, 'рядом не отогнал');
  const g3 = mk(1, 5400), s3 = g3.state(); s3.birdT = 0.1; s3.hero.x -= 150; run(g3, 2); ok(s3.bird, 'нет птицы'); s3.hero.x = s3.bird.x - 120; s3.hero.y = s3.bird.y + 80; g3.staff(); run(g3, 3);
  ok(count(g3, 'shoo') === 1 && count(g3, 'swoop') === 0, 'посох не отогнал'); ok(!s3.bird && s3.birdT > 10, 'птица не улетела');
});
test('птицы: вне своей зоны не появляются', () => { const g = mk(1, 1000); g.state().birdT = 0.1; run(g, 8); eq(count(g, 'bird'), 0); });
test('гроза: молния предупреждает меткой, удар пугает и разгоняет; свист заранее успокаивает', () => {
  const hit = calm => { const g = mk(4, 2600), s = g.state(), a = g.alive(); a.forEach((c, i) => { c.x = 2700 + (i % 4) * 20; c.y = 280 + (i % 3) * 20; }); if (calm) g.whistle(); s.strikes.push({ x: 2740, y: 300, t: 0.4 }); run(g, 3); return g; };
  const a = hit(false), b = hit(true);
  ok(count(a, 'thunder') === 1 && count(a, 'bolt') >= 5, 'не разбежались: ' + count(a, 'bolt')); eq(count(b, 'bolt'), 0, 'свист не помог');
  const g = mk(4, 2600); g.state().strikeT = 0.1; run(g, 0.5); ok(count(g, 'charge') === 1 && g.state().strikes.length === 1 && g.state().strikes[0].t > 1, 'нет метки-предупреждения');
  const q = mk(4, 800); q.state().strikeT = 0.1; run(q, 5); eq(count(q, 'charge'), 0, 'молния вне зоны');
});
test('гроза и буран проходимы ботом: гребень с карнизом в грозу — потери не больше одной', () => {
  const r = botRun([4, 1700], 6000, { maxT: 900 }); ok(r.x > 6000 && r.home >= 9 && !r.stuck, JSON.stringify({ x: r.x | 0, home: r.home, lost: r.lost }));
});

// ---------- Развилки ----------
test('развилки: обе ветки проходимы ботом; верхняя (карниз) быстрее нижней (вязкой)', () => {
  LEGS.forEach((l, lv) => { if (!l.isl) return;
    const up = botRun([lv, l.isl.x0 - 760], l.isl.x1 + 150, { branch: 'up', seed: 11 }), dn = botRun([lv, l.isl.x0 - 760], l.isl.x1 + 150, { branch: 'down', seed: 11 });
    ok(up.x > l.isl.x1 && dn.x > l.isl.x1 && !up.stuck && !dn.stuck, 'участок ' + (lv + 1) + ' не пройден: ' + (up.x | 0) + ' / ' + (dn.x | 0));
    ok(up.home >= 9 && dn.home === 10, 'потери: ' + JSON.stringify(up.lost) + ' / ' + JSON.stringify(dn.lost));
    ok(up.time < dn.time - 8, 'участок ' + (lv + 1) + ': верхняя ' + up.time.toFixed(0) + ' c, нижняя ' + dn.time.toFixed(0) + ' c');
  });
});
test('развилка: в вязкой нижней ветке стадо идёт медленнее; с карниза над провалом можно сорваться', () => {
  const l = LEGS[0], x = 5800, a = L.islAt(l, x);
  const g = mk(0, x), c = g.alive()[1]; g.alive().forEach(q => { q.y = (a.b + L.botY(l, q.x)) / 2; }); g.state().hero.y = c.y; run(g, 0.3, () => g.setMove(1, 0)); g.staff(); run(g, 3);
  const v = g.alive().reduce((s, q) => s + q.vx, 0) / 10; ok(v > 20 && v < K.TROT * 0.65, 'скорость в вязком: ' + v.toFixed(1));
  const g2 = mk(0, x), d = g2.alive()[1]; d.y = a.t - 10; d.fear = 1; d.fx = d.x; d.fy = d.y - 60; run(g2, 3); eq(lostWhy(g2), ['fall']);
});

// ---------- Костёр, чекпоинты, сохранение, финал ----------
test('чекпоинт-тур: сохраняет участок, место и стадо', () => {
  const l = LEGS[0], g = mk(0, l.cps[0] - 150); run(g, 12, s => { const c = cenOf(g.alive()); g.setMove(s.hero.x < c.x + 200 ? 1 : 0, 0, false); });
  const cp = g.evs.find(e => e[0] === 'checkpoint'); ok(cp, 'нет чекпоинта'); ok(cp[1].save.lv === 0 && cp[1].save.x > l.cps[0] && cp[1].save.herd.length === 10, JSON.stringify(cp[1].save).slice(0, 80));
});
test('костёр: подпасок у огня со стадом → ночёвка; следующий участок с утра, стадо отдохнуло, чекпоинт записан', () => {
  const l = LEGS[0], g = mk(0, l.camp[0] - 150, { food: 0.5, pep: 0.3 }), s = g.state();
  run(g, 20, st => { g.setMove(st.hero.x < l.camp[0] - 4 ? 1 : 0, (l.camp[1] - st.hero.y) / 30, false); g.whistle(); });
  eq(s.phase, 'camp'); eq(count(g, 'camp'), 1); const t0 = s.hero.x; g.update(1); eq(s.hero.x, t0, 'на ночёвке мир стоит');
  ok(g.nextLeg() && !g.nextLeg()); eq(s.lv, 1); eq(s.phase, 'play'); ok(s.hero.x < 400 && g.alive().length === 10 && g.alive().every(c => c.pep === 1 && c.food >= 0.7));
  ok(L.todAt(LEGS[1], s.hero.x) < 0.15, 'утро'); const cp = g.evs.filter(e => e[0] === 'checkpoint').pop()[1].save; eq([cp.lv, cp.herd.length], [1, 10]);
});
test('костёр: кто остался далеко позади — отстал (потеря), но путь продолжается', () => {
  const l = LEGS[0], g = mk(0, l.camp[0] - 150), s = g.state(), c = g.alive()[6]; c.x = l.camp[0] - 900;
  run(g, 20, st => { g.setMove(st.hero.x < l.camp[0] - 4 ? 1 : 0, (l.camp[1] - st.hero.y) / 30, false); });
  eq(s.phase, 'camp'); eq(lostWhy(g), ['left']); eq(g.alive().length, 9);
});
test('сохранение: снимок переживает JSON и восстанавливает участок, место, стадо, метки и ушедших', () => {
  const g = mk(2, 4000, { herd: herdOf(10).filter(h => h.id !== 4 && h.id !== 7), gone: [{ id: 4, why: 'fall', lv: 1, mark: 4 }, { id: 7, why: 'river', lv: 2, mark: 7 }] });
  g.setMark(2, 8); g.alive()[0].food = 0.66; const sn = JSON.parse(JSON.stringify(g.snapshot()));
  const h = O.Game({ snapshot: sn }).start(), s = h.state();
  eq([s.lv, Math.round(s.hero.x), h.alive().length, s.gone.length], [2, 4000, 8, 2]); eq(h.alive().map(c => c.id), [0, 1, 2, 3, 5, 6, 8, 9]);
  eq(h.alive().find(c => c.id === 2).mark, 8, 'метка'); eq(h.alive()[0].food, 0.66); eq(h.alive().find(c => c.id === 3).temper, 'timid', 'нрав по номеру');
  eq(s.cpIdx, LEGS[2].cps.filter(x => x <= 4000).length, 'пройденные туры');
});
test('метки: можно сменить метку любому существу (10 пиктограмм по кругу)', () => {
  const g = mk(0, 600); eq(L.MARKS.length, 10); g.setMark(3, 12); eq(g.alive()[3].mark, 2); g.setMark(3, -1); eq(g.alive()[3].mark, 9); eq(g.snapshot().herd[3].mark, 9);
});
test('финал: летнее пастбище считает доведённых — потеря не конец игры, но влияет на итог', () => {
  const l = LEGS[5], g = mk(5, l.camp[0] - 150, { herd: herdOf(10).filter(h => h.id % 3 !== 0), gone: [0, 3, 6, 9].map(id => ({ id, why: 'fall', lv: 1, mark: id })) });
  run(g, 20, st => { g.setMove(st.hero.x < l.camp[0] - 4 ? 1 : 0, (l.camp[1] - st.hero.y) / 30, false); g.whistle(); });
  eq(g.state().phase, 'won'); const w = g.evs.find(e => e[0] === 'win')[1]; eq([w.home, w.total], [6, 10]); eq(w.ids, [1, 2, 4, 5, 7, 8]); ok(!g.nextLeg());
});
test('все потерялись: фаза «один» (откат к последнему чекпоинту делает оболочка), снимок чекпоинта цел', () => {
  const g = mk(1, 3200, { n: 2 }), l = LEGS[1], cp = JSON.stringify(g.state().cp);
  g.alive().forEach(c => { c.y = L.botY(l, c.x) + 6; }); run(g, 1); eq(g.state().phase, 'alone'); eq(count(g, 'alone'), 1); eq(JSON.stringify(g.state().cp), cp); eq(JSON.parse(cp).herd.length, 2);
});

// ---------- i18n, музыка, страница, имена ----------
test('i18n: RU/EN — одинаковые ключи, свои названия', () => {
  eq(Object.keys(O.STR.ru).sort(), Object.keys(O.STR.en).sort()); eq(O.STR.ru.title, 'ОТГОН'); eq(O.STR.en.title, 'WINDSHANKS');
  ok(!/[а-яё]/i.test(Object.values(O.STR.en).join(' ')), 'кириллица в EN');
});
// музыка — как в _shared/tests/music.test.mjs: фейковый AudioContext, трек играет и планирует ноты
function musicEnv(){
  const listeners = {}, timers = [];
  function param(v){ return { value: v, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(x){ if (!(x > 0)) throw new Error('exp ≤0'); }, setTargetAtTime(){} }; }
  function node(){ return { connect(){}, disconnect(){}, start(){}, stop(){}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
  class AC { constructor(){ this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; } createOscillator(){ return node(); } createGain(){ return node(); } createBiquadFilter(){ return node(); } createBufferSource(){ return node(); } createBuffer(c, len){ return { getChannelData: () => new Float32Array(len) }; } resume(){} suspend(){} }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); } },
    addEventListener(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); }, setInterval(fn){ timers.push(fn); return timers.length; }, clearInterval(id){ timers[id - 1] = null; },
    setTimeout(){ return 0; }, requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){}, performance: { now: () => 0 }, AudioContext: AC };
  const canvas = { width: 100, height: 100, style: {}, addEventListener(){}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener(){}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), win);
  return { win, fire: ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault(){} })), tick: (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); } };
}
test('музыка: трек otgon и все 7 тем участков — 8–16 тактов, ноты в диапазоне, трек играет (>30 нот в окне, без ошибок)', () => {
  const env = musicEnv(), A = env.win.Arcade;
  ok(A.tracks.otgon && A.otgonTracks.length === 7 && A.tracks.otgon === A.otgonTracks[0], 'треки');
  A.otgonTracks.forEach((tr, i) => { const c = A.parseTrack(tr), perBar = c.div * 4, bars = c.melody.length / perBar;
    ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тема ' + (i + 1) + ': тактов ' + bars);
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'тема ' + (i + 1) + ': голоса не кратны мелодии');
    [c.melody, c.bass].forEach(v => v.forEach(n => { if (n) ok(n.f > 40 && n.f < 2200, 'нота ' + n.f); })); });
  ok(new Set(A.otgonTracks.map(t => t.melody.join('|'))).size === 7, 'темы разные');
  for (let i = 0; i < 7; i++) {   // каждая тема в окне 10 с даёт > 30 нот
    const e2 = musicEnv(), A2 = e2.win.Arcade; A2.tracks.otgon = A2.otgonTracks[i];
    const g = A2.createGame({ canvas: '#c', gameId: 'otgon' }); g.useStandardScreens(); g.scene('play', {}); g.goto('play'); e2.fire('keydown');
    const ac = g.audio.ac; for (let k = 0; k < 200; k++) e2.tick(ac, 0.05);
    ok(g.audio.music.stats.scheduled > 30 && g.audio.music.stats.errors === 0, 'тема ' + (i + 1) + ': ' + JSON.stringify(g.audio.music.stats));
    if (i === 0) { g.audio.setMusic(A2.otgonTracks[4]); for (let k = 0; k < 80; k++) e2.tick(ac, 0.05); ok(g.audio.music.stats.errors === 0, 'смена темы'); }
  }
});
test('страница: фавикон студии, «← Каталог» с data-en, canvas 960×540, порядок скриптов, тач-кнопки (крестовина, свист, посох, бег, пауза); engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="540"/.test(html), 'canvas');
  eq([...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]), ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/meta.js', 'js/audio.js', 'js/render.js', 'js/main.js']);
  ['U', 'D', 'L', 'R'].forEach(d => ok(html.includes('data-d="' + d + '"'), 'кнопка ' + d));
  ['bPause', 'bWhistle', 'bStaff', 'bRun'].forEach(id => ok(html.includes('id="' + id + '"'), id));
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'нет внешних ссылок');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8'); ok(/a\.back\s*\{[^}]*position:\s*fixed/.test(css) && /z-index:\s*20/.test(css), 'ссылка видна поверх');
  ok(/\.pad \.act\s*\{[^}]*position:\s*fixed/.test(css) && /touch-action:\s*none/.test(css), 'тач-кнопки');
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'); ok(/'otgon\.save'/.test(main) && /touchmove/.test(main) && /moveTo\(/.test(main), 'сохранение, стик и тап');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список + ориентиры жанра этой игры и их студии)
  const BASE = 'dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==';
  const GENRE = 'aGVyZGxpbmd8b2tvbW90aXZlfGNhbGljb3JufNGF0LXRgNC00LvQuNC90LN80L7QutC+0LzQvtGC0LjQsnzQutCw0LvQuNC60L7RgNC9fGxvbmUgP3NhaWxzfGNoYW5naW5nID90aWRlc3xcYmZhciA/OnxzaGVwaGVyZC4/cyBjcm9zc2luZ3xzaGVlcCA/cmFpZGVyfGZsb2NrID8h';
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  const BAD = new RegExp(u(BASE) + '|' + u(GENRE), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  // ловит ориентиры жанра и их студию (в base64), не ловит наши имена и обычные слова
  ['SGVyZGxpbmc=', 'T2tvbW90aXZl', 'Q2FsaWNvcm4=', '0KXQtdGA0LTQu9C40L3Qsw==', 'RkFSOiBMb25lIFNhaWxz'].forEach(b => ok(BAD.test(u(b)), 'стоп-лист ловит ориентир жанра'));
  ok(!BAD.test('ОТГОН') && !BAD.test('WINDSHANKS') && !BAD.test('Гефест') && !BAD.test('ветроног') && !BAD.test('herd-boy') && !BAD.test('a herd of woollies') && !BAD.test('how far the flock is'), 'без ложных срабатываний');
});

// ---------- Проходимость: «человеческий» бот ----------
// ---------- волна 3: звёзды участков, реклама за награду, языки ----------
test('мета: звёзды участка (дошли / без потерь / всё стадо цело), 6 участков, открытие по порядку', () => {
  const M = O.meta, mem = {}, G = M.Progress({ get: k => (k in mem ? mem[k] : null), set: (k, v) => { mem[k] = v; } });
  eq(M.LEVELS, LEGS.length); eq(M.stars({ lost: 0, alive: 10, total: 10 }).n, 3); eq(M.stars({ lost: 0, alive: 8, total: 10 }).n, 2); eq(M.stars({ lost: 2, alive: 6, total: 10 }).n, 1);
  ok(!G.unlocked(2)); ok(G.record(1, 1)); ok(G.unlocked(2)); ok(!G.record(1, 1)); eq(mem['arcade.otgon.stars.1'], '1');
});
test('реклама: returnOne — последний отбившийся снова в стаде рядом с подпаском; reviveAd после «стадо разбрелось» — двое, путь продолжается', () => {
  const ev = []; const g = O.Game({ onEvent: (t, d) => ev.push(t) }).start(), S = g.state();
  ok(!g.canReturn()); const c = g.alive()[0]; c.st = 'gone'; S.gone.push({ id: c.id, why: 'test', lv: 0, mark: c.mark });
  ok(g.canReturn()); ok(g.returnOne()); eq(c.st, 'ok'); eq(S.gone.length, 0); ok(ev.includes('back'));
  g.alive().forEach(q => { q.st = 'gone'; S.gone.push({ id: q.id, why: 'test', lv: 0, mark: q.mark }); }); S.phase = 'alone';
  ok(g.reviveAd()); eq(S.phase, 'play'); eq(g.alive().length, 2); g.update(0.05); eq(S.phase, 'play');
});
test('языки: ru/en/tr/es/pt — одинаковые ключи; название RU ОТГОН, EN/TR/ES/PT WINDSHANKS', () => {
  const ks = Object.keys(O.STR.en).sort().join(','); eq(Object.keys(O.STR).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(O.STR[l]).sort().join(','), ks, l);
  eq(O.STR.ru.title, 'ОТГОН'); for (const l of ['en', 'tr', 'es', 'pt']) eq(O.STR[l].title, 'WINDSHANKS', l);
});
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
const RUNS = [1, 2, 3, 4, 5, 6].map(sd => playOtgon(O, sd, { maxT: 3600, branch: sd % 2 ? 'down' : 'up' }));
test('бот (реакция 150–250 мс, только ход/бег, свист и посох) доводит до летнего пастбища не меньше 2/3 стада во всех 6 партиях, без зависаний', () => {
  RUNS.forEach((r, i) => ok(r.won && !r.stuck && r.home >= 7, 'сид ' + (i + 1) + ': ' + JSON.stringify({ won: r.won, stuck: r.stuck, lv: r.lv, x: Math.round(r.x), home: r.home, lost: r.lost })));
  RUNS.forEach(r => eq(r.final.home, r.home));
});
test('длительность пути: 25–40 минут у бота; чекпоинты по пути (≥ 20), 5 ночёвок', () => {
  const mins = RUNS.map(r => +(r.time / 60).toFixed(1)); console.log('     минуты: ' + mins.join(', ') + '; довёл: ' + RUNS.map(r => r.home).join(',') + '; свистов: ' + RUNS.map(r => r.events.whistle).join(',') + '; посох: ' + RUNS.map(r => r.events.staff).join(','));
  ok(mins.every(m => m >= 25 && m <= 40), 'вне 25–40 мин'); ok(RUNS.every(r => r.cps >= 20), 'мало чекпоинтов'); ok(RUNS.every(r => r.events.camp === 5), 'ночёвки');
});
test('бот с медленной реакцией (300–450 мс) тоже доводит не меньше 2/3 стада', () => {
  const r = playOtgon(O, 11, { react: [0.3, 0.45], maxT: 4200 });
  console.log('     медленный бот: ' + (r.time / 60).toFixed(1) + ' мин, довёл ' + r.home + ', потери ' + JSON.stringify(r.lost));
  ok(r.won && !r.stuck && r.home >= 7, JSON.stringify({ lv: r.lv, x: Math.round(r.x), home: r.home }));
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

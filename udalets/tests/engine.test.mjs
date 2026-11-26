/* УДАЛЕЦ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node udalets/tests/engine.test.mjs (QUICK=1 — без партий «человеческого» бота).
   Логика (js/levels.js + js/game.js) — в node:vm с шимом window. Переделка 2026-11: мехи, горны, продухи, крыльчатки. */
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
const U = sandbox.UDALETS, L = U.logic, COLS = L.COLS, ROWS = L.ROWS, DT = 1 / 60;
const { playUdalets, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// игра без обитателей (если не сказано иначе); ev — журнал событий
function mk(level = 1, opts = {}){
  const ev = [];
  const game = U.Game(Object.assign({ rng: mulberry32(1), level, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state(); if (!opts.keepEnemies) S.enemies = [];
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0, jump = false, keep = false){
  for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(DT); if (!keep) game.state().enemies = []; }
  game.setInput(0, 0, false);
}
// выдох с места s = { n, face } (из spotsFor): встать, повернуться, дунуть k раз
function blowFrom(t, s, k = 1){
  t.game._place(s.n % t.S.LV.w, Math.floor(s.n / t.S.LV.w)); t.S.hero.face = s.face;
  for (let i = 0; i < k; i++){ t.game.puff(s.face); run(t.game, L.PUFF_CD + 0.02); }
}
const LVS = U.LEVELS.map((d, i) => L.build(d, i + 1));
const kinds = LV => new Set(LV.spawns.map(s => s.k));

// ---------- уровни ----------
test('10 уровней, экраны 26×15, по 2–3 экрана; старт и 2–5 горнов; к каждому горну есть место для выдоха', () => {
  eq(U.LEVELS.length, 10);
  LVS.forEach((LV, i) => {
    const n = U.LEVELS[i].rooms.length; ok(n >= 2 && n <= 3, 'экранов ' + n);
    ok(LV.start, 'старт ' + (i + 1)); ok(LV.furn.length >= 2 && LV.furn.length <= 5, 'горнов на ' + (i + 1) + ': ' + LV.furn.length);
    LV.furn.forEach(f => ok(L.spotsFor(LV, f.c, f.r).length > 0, 'горн без места L' + (i + 1)));
    U.LEVELS[i].rooms.forEach(r => { eq(r.length, ROWS); r.forEach(s => eq(s.length, COLS)); });
  });
});
test('переделка: на уровнях нет прежних знаков (Кубок, дверь, ружьё, патроны, ранец, топливо, вход в кладовую)', () => {
  const all = U.LEVELS.map(d => d.rooms.flat().join('')).join('');
  for (const ch of ['K', 'E', 'G', 'A', 'J', 'F', 'W']) ok(!all.includes(ch), 'знак ' + ch);
  ok(!('BONUS' in U), 'бонус-уровня нет');
});
test('прогрессия: подсказка на 1-м, подскок нужен с 1-го, крыльчатки с 4-го, продухи с 5-го, плевуны — только с 7-го', () => {
  ok(LVS[0].signs.length > 0, 'табличка на 1-м'); ok(LVS[0].spawns.length === 0, '1-й без обитателей');
  LVS.forEach((LV, i) => { const n = i + 1;
    if (n < 4) eq(LV.vanes.length, 0, 'крыльчатки рано на ' + n); if (n < 5) eq(LV.vents.length, 0, 'продухи рано на ' + n);
    if (n < 7) ok(!kinds(LV).has('s'), 'плевун рано на ' + n); });
  ok(LVS.filter(LV => LV.vanes.length).length >= 3, 'крыльчаток мало'); ok(LVS.filter(LV => LV.vents.length).length >= 5, 'продухов мало');
  ok(LVS.slice(6).every(LV => kinds(LV).has('s')), 'плевуны на 7–10'); ok(LVS.slice(1).every(LV => LV.spawns.length > 0), 'обитатели со 2-го');
  LVS.forEach(LV => LV.shut.forEach(s => ok(LV.vanes.some(v => v.room === s.room), 'заслонка без крыльчатки L' + LV.idx)));
});
test('опасности всех трёх видов, тайники за ложными стенами, лишняя жизнь в тайнике', () => {
  const all = LVS.map(LV => LV.t.join('')).join('');
  ok(all.includes('^') && all.includes('~') && all.includes('a'), 'шипы/огонь/кислота');
  ok(LVS.filter(LV => LV.t.includes('%')).length >= 4, 'тайников мало');
  ok(LVS.some(LV => LV.items.some(i => i.k === '+')), 'лишняя жизнь');
});

// ---------- физика ----------
test('физика: бег 6 кл/с, прыжок ≈ 3,3 клетки вверх, стены держат', () => {
  const { game, S } = mk(1); game._place(19, 14);
  run(game, 0.5, 1); ok(Math.abs(S.hero.x - 22.5) < 0.05, 'бег: ' + S.hero.x);
  game._place(2, 14); let top = 14; game.setInput(0, 0, true);
  for (let i = 0; i < 60; i++){ game.update(DT); game.setInput(0, 0, false); top = Math.min(top, S.hero.y); }
  ok(14 - top > 3.1 && 14 - top < 3.5, 'высота ' + (14 - top).toFixed(2)); ok(S.hero.ground);
  game._place(1, 14); run(game, 1, -1); ok(S.hero.x >= 1 + L.HW, 'стена слева');
});
test('подскок: выдох вниз в прыжке поднимает ещё на ≈ 2 клетки — раз за прыжок; на земле — не подбрасывает', () => {
  const { game, S, has } = mk(1); game._place(2, 14); let top = 14;
  game.setInput(0, 0, true); game.update(DT); game.setInput(0, 0, false);
  for (let i = 0; i < 20; i++){ game.update(DT); top = Math.min(top, S.hero.y); }
  ok(game.puff('down')); for (let i = 0; i < 60; i++){ game.update(DT); top = Math.min(top, S.hero.y); }
  ok(14 - top > 4.6 && 14 - top < 5.8, 'высота с подскоком ' + (14 - top).toFixed(2)); ok(has('lift'));
  // второй выдох в том же прыжке не подбрасывает
  const b = mk(1); b.game._place(2, 14); b.game.setInput(0, 0, true); b.game.update(DT); b.game.setInput(0, 0, false);
  run(b.game, 0.2); b.game.puff('down'); run(b.game, 0.35); const vy = b.S.hero.vy; b.game.puff('down'); b.game.update(DT); ok(b.S.hero.vy > vy, 'второй подскок');
  const c = mk(1); c.game._place(2, 14); c.game.puff('down'); run(c.game, 0.3); eq(c.S.hero.y, 14, 'на земле');
});
test('продух: восходящий поток поднимает и держит у верха столба; в сторону — выход из потока', () => {
  const { game, S } = mk(6), LV = S.LV, v = LV.vents[0];
  game._place(v.c, v.r); run(game, 2.5);
  ok(S.hero.y < v.top + 1.6 && S.hero.y > v.top - 0.2, 'висит у верха: ' + S.hero.y.toFixed(2) + ' верх ' + v.top); ok(S.hero.up, 'в потоке');
  ok(L.updraft(LV, S.hero), 'updraft');
});
test('шипы, огонь и кислота — гибель; потеря жизни и возврат в безопасное место с неуязвимостью', () => {
  for (const [lv, ch] of [[1, '^'], [2, '~'], [4, 'a']]){
    const { game, S, has, ev } = mk(lv), LV = S.LV;
    let c = -1, r = -1; for (let k = 0; k < LV.t.length && c < 0; k++) if (LV.t[k] === ch && L.isSolid(LV, k % LV.w, Math.floor(k / LV.w) + 1) && L.isNode(LV, k % LV.w - 1, Math.floor(k / LV.w) + 1)){ c = k % LV.w; r = Math.floor(k / LV.w); }
    ok(c >= 0, 'нет ' + ch); game._place(c - 1, r + 1); run(game, 0.5, 1);
    ok(has('die'), 'гибель от ' + ch); eq(S.lives, 2); eq(ev.find(e => e.t === 'die').d.why, { '^': 'spike', '~': 'fire', a: 'acid' }[ch]);
    run(game, 1.5); eq(S.phase, 'play'); ok(S.inv > 0, 'неуязвимость'); ok(!L.hazardHit(LV, S.hero), 'вернулся в безопасное место');
  }
});
test('3 жизни — конец игры; лишняя жизнь за каждые 30 000 очков (не больше 5)', () => {
  const { game, S, has } = mk(1);
  for (let k = 0; k < 3; k++){ game._die('spike'); run(game, 1.5); }
  ok(S.over, 'конец'); ok(has('gameover'));
  const b = mk(1); b.S.score = 29990; const it = b.S.LV.items.find(i => i.k === 'g'); b.game._place(it.c, it.r + 1); run(b.game, 0.1);
  eq(b.S.lives, 4, 'лишняя жизнь'); ok(b.has('life'));
});

// ---------- горны ----------
test('горн: 3 выдоха — пылает (+1000, точка возврата); все горны — цех ожил, бонус за время, следующий уровень', () => {
  const t = mk(1), LV = t.S.LV, f = LV.furn[0], s = L.spotsFor(LV, f.c, f.r)[0];
  blowFrom(t, s, 1); eq(t.S.heat[f.id], 1); ok(t.has('heat'));
  blowFrom(t, s, 1); eq(t.S.heat[f.id], 2); ok(!t.has('lit'));
  blowFrom(t, s, 1); eq(t.S.heat[f.id], 3); ok(t.has('lit')); eq(t.S.lit, 1); eq(t.S.score, L.PTS.O);
  ok(Math.abs(t.S.cp.x - t.S.hero.x) < 1e-6, 'точка возврата у горна');
  blowFrom(t, s, 2); eq(t.S.lit, 1, 'пылающий не считается дважды');
  const f2 = LV.furn[1]; blowFrom(t, L.spotsFor(LV, f2.c, f2.r)[0], 3);
  ok(t.has('clear')); ok(t.ev.find(e => e.t === 'clear').d.bonus >= L.PTS.clear); eq(t.S.phase, 'clear');
  run(t.game, 2.5); eq(t.S.level, 2); eq(t.S.lit, 0); eq(t.S.phase, 'play');
});
test('выдох не проходит сквозь стену и бьёт не дальше 3,5 клетки; смотреть надо на горн', () => {
  const t = mk(1), LV = t.S.LV, f = LV.furn[0];
  t.game._place(f.c - 5, f.r + 1); t.S.hero.face = 1; t.game.puff(1); run(t.game, 0.4); eq(t.S.heat[f.id], 0, 'далеко');
  t.game._place(f.c - 2, f.r + 1); t.S.hero.face = -1; t.game.puff(); run(t.game, 0.4); eq(t.S.heat[f.id], 0, 'спиной');
  t.S.hero.face = 1; t.game.puff(); run(t.game, 0.4); eq(t.S.heat[f.id], 1, 'лицом');
  const b = L.gustBox(LV, L.newHero(1, 14), -1); ok(b.reach < 0.6, 'стена гасит выдох: ' + b.reach);
});
test('после 10-го уровня — победа', () => {
  const t = mk(10), LV = t.S.LV;
  LV.vanes.forEach(v => L.openShutters(LV, v.room));
  LV.furn.forEach(f => blowFrom(t, L.spotsFor(LV, f.c, f.r)[0], 3));
  run(t.game, 2.5); ok(t.S.won && t.has('win'));
});
test('крыльчатка: выдох раскручивает её и поднимает заслонки своего экрана (насовсем)', () => {
  const t = mk(4), LV = t.S.LV, v = LV.vanes[0], sh = LV.shut.filter(s => s.room === v.room);
  ok(sh.length > 0); ok(sh.every(s => L.isSolid(LV, s.c, s.r)), 'закрыто');
  blowFrom(t, L.spotsFor(LV, v.c, v.r)[0], 1);
  ok(t.has('vane')); ok(t.S.spun[v.id]); ok(sh.every(s => !L.isSolid(LV, s.c, s.r) && s.open), 'открыто'); ok(LV.ver > 0);
  ok(LV.shut.filter(s => s.room !== v.room).every(s => !s.open), 'чужие заслонки на месте');
});

// ---------- обитатели ----------
test('обитатели: касание — гибель; выдох гасит искрокрыла (+200), оглушает шестерняка (безвреден) и отбрасывает', () => {
  const t1 = mk(1); t1.S.enemies = [{ id: 1, k: 'w', room: 0, alive: true, dir: -1, t: 0, cd: 9, x: 5.9, y: 14, stun: 0, pt: 0, pv: 0, vy: 0 }];
  t1.game._place(5, 14); t1.S.inv = 0; t1.game.update(DT); ok(t1.has('die'), 'касание ходока');
  const t2 = mk(1); t2.game._place(3, 14); t2.S.hero.face = 1;
  t2.S.enemies = [{ id: 1, k: 'f', room: 0, alive: true, dir: -1, t: 0, cd: 9, x: 5.5, y: 13.2, y0: 13.2, ph: 0, stun: 0, pt: 0, pv: 0 },
                  { id: 2, k: 'w', room: 0, alive: true, dir: -1, t: 0, cd: 9, x: 6.0, y: 14, stun: 0, pt: 0, pv: 0, vy: 0 }];
  t2.game.puff(); for (let i = 0; i < 6; i++) t2.game.update(DT);
  ok(!t2.S.enemies[0].alive && t2.has('kill'), 'искрокрыл погас'); eq(t2.S.kills, 1);
  const w = t2.S.enemies[1]; ok(w.stun > 0 && !L.harmful(w), 'оглушён'); for (let i = 0; i < 20; i++) t2.game.update(DT); ok(w.x > 6.8, 'отброшен: ' + w.x.toFixed(2));
  w.x = t2.S.hero.x + 0.2; t2.S.inv = 0; t2.game.update(DT); ok(!t2.has('die'), 'оглушённый не трогает');
});
test('шестерняка можно сдуть в кислоту (+300)', () => {
  const t = mk(4), LV = t.S.LV;   // L4: кислота cols 7–9, пол 14
  t.game._place(4, 14); t.S.hero.face = 1;
  t.S.enemies = [{ id: 1, k: 'w', room: 0, alive: true, dir: 1, t: 0, cd: 9, x: 6.3, y: 14, stun: 0, pt: 0, pv: 0, vy: 0 }];
  t.game.puff(); run(t.game, 1, 0, 0, false, true);
  ok(!t.S.enemies[0].alive, 'сгинул'); const k = t.ev.find(e => e.t === 'kill'); ok(k && k.d.how === 'drop' && k.d.pts === L.PTS.drop);
});
test('плевун стреляет в героя; выдох гасит уголёк', () => {
  const t0 = mk(7, { keepEnemies: true }), s = t0.S.enemies.find(e => e.k === 's');
  t0.game._place(Math.floor(s.x) - 3, Math.floor(s.y) + 2); for (let i = 0; i < 60 * 4 && !t0.has('eshoot'); i++){ t0.game.setInput(0, 0, false); t0.game.update(DT); }
  ok(t0.has('eshoot'), 'плевун выстрелил');
  const t = mk(1); t.game._place(3, 14); t.S.hero.face = 1; t.S.eshots = [{ x: 5.5, y: 13.2, vx: -6, room: 0, alive: true }];
  t.game.puff(); t.game.update(DT); ok(t.has('snuff') && !t.S.eshots.length, 'уголёк погас');
});
test('ходок не сходит с платформы сам', () => {
  const LV = LVS[2], e = { k: 'w', room: 1, x: 37.5, y: 7, dir: 1, t: 0, stun: 0, pt: 0, pv: 0, vy: 0 }; for (let i = 0; i < 600; i++) L.enemyStep(LV, e, DT, null, null);
  ok(L.isSolid(LV, Math.floor(e.x), 7) && e.y === 7, 'ходок на опоре');
});

// ---------- проходимость (граф: узлы «стою на клетке», рёбра — настоящая физика; заслонки — по стадиям) ----------
function stages(i){
  const LV = L.build(U.LEVELS[i], i + 1), W = LV.w, out = []; let from = [LV.start.r * W + LV.start.c]; const spun = new Set();
  for (;;){
    const nav = L.Nav(LV), R = nav.reach(from); out.push({ LV, nav, R, ver: LV.ver, map: LV.t.slice() });
    let opened = false;
    for (const v of LV.vanes){ if (spun.has(v.id)) continue; if (L.spotsFor(LV, v.c, v.r).some(s => R[s.n])){ spun.add(v.id); if (L.openShutters(LV, v.room)) opened = true; } }
    if (!opened) return { LV, W, st: out, spun };
    from = Object.keys(R).map(Number);
  }
}
const GR = LVS.map((_, i) => stages(i));
test('проходимость: на каждом уровне все горны достижимы (с подъёмом заслонок), крыльчатки раскручиваются', () => {
  GR.forEach((G, i) => {
    const R = G.st[G.st.length - 1].R;
    G.LV.furn.forEach(f => ok(L.spotsFor(G.LV, f.c, f.r).some(s => R[s.n]), 'горн ' + f.c + ',' + f.r + ' L' + (i + 1)));
    eq(G.spun.size, G.LV.vanes.length, 'крыльчатки L' + (i + 1));
  });
});
test('подскок и продухи нужны: без выдоха вниз и потока часть горнов недостижима (уровни 1, 3, 6–10)', () => {
  [0, 2, 5, 6, 7, 8, 9].forEach(i => {
    const LV = L.build(U.LEVELS[i], i + 1); LV.vanes.forEach(v => L.openShutters(LV, v.room)); LV.up = {};
    const acts = L.ACTS; const keep = acts.slice(); L.ACTS.length = 0; keep.filter(a => a.k === 'walk' || a.k === 'jump').forEach(a => L.ACTS.push(a));
    try { const R = L.Nav(LV).reach([LV.start.r * LV.w + LV.start.c]); ok(LV.furn.some(f => !L.spotsFor(LV, f.c, f.r).some(s => R[s.n])), 'всё достижимо без мехов L' + (i + 1)); }
    finally { L.ACTS.length = 0; keep.forEach(a => L.ACTS.push(a)); }
  });
});
test('нет тупиков: из любого достижимого места можно дойти до каждого горна (и до крыльчатки, пока заслонки закрыты)', () => {
  GR.forEach((G, i) => {
    G.st.forEach((st, k) => {
      const LV = G.LV; const cur = LV.t; LV.t = st.map; LV.ver = st.ver;
      const last = k === G.st.length - 1;
      const targets = last ? LV.furn.map(f => L.spotsFor(LV, f.c, f.r)) : LV.vanes.map(v => L.spotsFor(LV, v.c, v.r)).filter(sp => sp.some(s => st.R[s.n]));
      for (const n of Object.keys(st.R).map(Number)){
        const R2 = st.nav.reach([n]);
        if (last) targets.forEach(sp => ok(sp.some(s => R2[s.n]), 'тупик L' + (i + 1) + ' в ' + (n % G.W) + ',' + Math.floor(n / G.W)));
        else ok(targets.some(sp => sp.some(s => R2[s.n])), 'тупик до крыльчатки L' + (i + 1) + ' в ' + (n % G.W) + ',' + Math.floor(n / G.W));
      }
      LV.t = cur;
    });
  });
});
test('граф совпадает с физикой игры: по 40 случайных рёбер каждого уровня воспроизводятся в Game', () => {
  const rng = mulberry32(42); let checked = 0;
  GR.forEach((G, i) => {
    const st = G.st[0], nodes = Object.keys(st.R).map(Number);
    for (let k = 0; k < 40; k++){
      const n = nodes[Math.floor(rng() * nodes.length)], es = st.nav.edges(n); if (!es.length) continue;
      const e = es[Math.floor(rng() * es.length)], a = L.ACTS[e.a];
      const { game, S } = mk(i + 1);
      game._place(n % G.W, Math.floor(n / G.W)); const X0 = S.hero.x, mem = { X0 }; let t = 0, f = null;
      for (let s = 0; s < 420 && !f; s++){ const inp = L.drive(a, t, S.hero, X0, 0, mem); game.setInput(inp.dx, inp.dy, inp.jump); if (inp.lift) game.puff('down'); game.update(DT); S.enemies = []; t += DT; f = L.finished(a, t, S.hero, mem); }
      eq(f, 'ok', 'L' + (i + 1) + ' ребро ' + a.k); eq(S.phase, 'play', 'L' + (i + 1) + ' без гибели'); eq(L.nodeOf(S.LV, S.hero), e.to, 'L' + (i + 1) + ' узел'); checked++;
    }
  });
  ok(checked >= 380, 'проверено ' + checked);
});
test('исполнимость: бот без ошибок (обитатели не трогают) проходит каждый уровень в настоящей физике без гибели', () => {
  for (let lv = 1; lv <= 10; lv++){
    const r = playUdalets(U, 1, { perfect: true, god: true, level: lv, only: true, maxT: 300 });
    eq(r.cleared, 1, 'уровень ' + lv); eq(r.deaths, 0, 'гибель на ' + lv + ': ' + r.log.join(','));
  }
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек udalets подключается по gameId, длины кратны такту', () => {
  const T = sandbox.Arcade.tracks.udalets; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0); ok(n(T.melody) >= 64, '8+ тактов');
});
test('языки: ru/en/tr/es/pt — одинаковые ключи, названия всех уровней; название RU УДАЛЕЦ, EN/TR/ES/PT BELLOWKIN', () => {
  const S = U.STR, ks = Object.keys(S.ru).sort().join(','); eq(Object.keys(S).join(','), 'ru,en,tr,es,pt');
  for (const l of ['en', 'tr', 'es', 'pt']) eq(Object.keys(S[l]).sort().join(','), ks, l);
  for (const l in S) for (let k = 1; k <= 10; k++) ok(S[l]['lv' + k], l + ' lv' + k);
  eq(S.ru.title, 'УДАЛЕЦ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'BELLOWKIN', l);
});
test('страница: фавикон, «← Каталог», canvas 624×400, скрипты по порядку, стик и кнопки ●/◆, пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон'); ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'каталог');
  ok(/<canvas id="c" width="624" height="400"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order.join(','), 'engine.js,js/music.js,js/i18n.js,js/levels.js,js/game.js,js/audio.js,js/render.js,js/stick.js,js/main.js');
  ok(/data-stick/.test(html) && html.includes('data-d="A"') && /id="bPuff"/.test(html) && /id="bPause"/.test(html), 'тач');
  eq(fs.readFileSync(path.join(ROOT, 'js/stick.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', 'otsek', 'js', 'stick.js'), 'utf8'), 'stick.js — копия otsek');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\//.test(html), 'нет внешних ссылок');
});
// ---------- площадка: реклама за награду, тач-схема, «Без рекламы» и таблица лидеров ----------
test('реклама: reviveAd после последней жизни — 1 жизнь у точки возврата; boost — +1 жизнь (до 5)', () => {
  const a = mk(1); ok(!a.game.reviveAd(), 'в игре — нельзя');
  a.S.lives = 1; a.game._die('spike'); run(a.game, 2); eq(a.S.phase, 'over'); ok(a.S.over && a.has('gameover'));
  ok(a.game.reviveAd()); eq(a.S.phase, 'play'); eq(a.S.lives, 1); ok(!a.S.over); ok(a.S.inv > 0, 'неуязвимость');
  ok(a.game.canBoost()); ok(a.game.boost()); eq(a.S.lives, 2); a.S.lives = L.LIFE_MAX; ok(!a.game.canBoost());
});
test('тач-схема: стик js/stick.js, карточка «цех ожил» с межстраничной, menuFit, рекорд прежним ключом (g.persist)', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/ArcadeStick\.create/.test(main) && /stick\.active/.test(main), 'стик');
  ok(/g\.adBreak\(\)/.test(main) && /g\.adReady\(\)/.test(main), 'межстраничная по нажатию на карточке');
  ok(/menuFit/.test(main), 'menuFit'); ok(/g\.persist\('arcade\.best\.udalets', 'max'\)/.test(main), 'рекорд прежним ключом');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'udalets', boards: ['udalets'], test, ok }); }
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список аркады + оригинал жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8') + '|' + Buffer.from('ZGFuZ2Vyb3VzID9kYXZlfFxiZGF2ZVxifNC0W9GN0LVd0LnQsg==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('rocket pack') && !BAD.test('daredevil') && !BAD.test('Гефест') && !BAD.test('Удалец') && !BAD.test('CONTRACT.md'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии «человеческого» бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// tests/bot.mjs: реакция 150–250 мс, ошибки времени нажатий, часть обитателей замечает с опозданием, терпение ~5 с.
// 40 партий (сиды 1..40). Цели: 1-й уровень ≥ 90%, вся игра (10 уровней на 3 жизнях + лишние) ≈ 25–65%.
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playUdalets(U, s));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.cleared >= 1 || r.won).length; console.log('     1-й уровень: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: вся игра — 25–65% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(11).fill(0); BAL.forEach(r => dist[r.won ? 10 : r.level - 1]++);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const wt = BAL.filter(r => r.won).map(r => r.time);
  console.log('     победы: ' + n + '/' + N + '; конец на уровнях 1..10/победа: ' + dist.join(',') + '; гибели: ' + JSON.stringify(why) + '; время побед, с: ' + (wt.length ? Math.min(...wt).toFixed(0) + '–' + Math.max(...wt).toFixed(0) : '—'));
  ok(n >= 0.25 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.65 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => !r.won && !r.over), 'бот «завис»: сиды ' + BAL.filter(r => !r.won && !r.over).map(r => r.seed).join(','));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

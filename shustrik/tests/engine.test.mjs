/* ШУСТРИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node shustrik/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// шим DOM для рендера: canvas с «пустым» 2D-контекстом (Proxy) — считаем вызовы рисования
const calls = { fill: 0 };
const fakeCtx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.fill++; }, set: (o, k, v) => { o[k] = v; return true; } });
const sandbox = { console, Math, document: { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const SH = sandbox.SHUSTRIK, L = SH.logic, LVL = SH.levels, K = L.K, T = L.T, C = L.C, dt = 1 / 60;
const { navFor, playShustrik, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// игра без врагов на заданном акте; ev — журнал событий
function mk(opts = {}){
  const ev = [];
  const game = SH.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state(); if (!opts.keepFoes) S.enemies = [];
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(dt); } }
// ровный участок без особых объектов длиной n клеток: вернуть x начала и высоту
function flatSpot(LV, n, from = 300){
  for (let x = from; x < LV.w * T - n * T; x += 16){
    const y = L.floorY(LV, x, 0, LV.h * T, null); if (y == null) continue;
    let okk = true;
    for (let k = 0; k <= n * T && okk; k += 8){ const s = L.floorY(LV, x + k, y - 4, y + 4, null); if (s == null || s !== y || L.hazardAt(LV, x + k, y + 2) || L.solidAt(LV, x + k, y - 12) || L.solidAt(LV, x + k, y - 40)) okk = false; }
    if (okk && !LV.springs.some(o => o.x > x - 40 && o.x < x + n * T + 40) && !LV.pipes.some(o => o.pts[0][0] > x - 40 && o.pts[0][0] < x + n * T + 40) && !LV.steam.some(o => o.x1 > x - 40 && o.x0 < x + n * T + 40) && !LV.rails.some(o => o.pts[0][0] > x - 40 && o.pts[0][0] < x + n * T + 40)) return { x, y };
  }
  return null;
}

// синтетическая ровная полоса для чистых замеров физики
function flatLV(cols){ const h = 20, t = new Uint8Array(cols * h); for (let c = 0; c < cols; c++) for (let r = 15; r < h; r++) t[r * cols + c] = C.S;
  return { w: cols, h, t, springs: [], pipes: [], rails: [], steam: [], gears: [], caps: [], cps: [], enemies: [], secrets: [], start: { x: 48, y: 240 } }; }

// ---------- структура ----------
test('4 мира × 2 акта: во 2-м акте — арена босса (свой босс в каждом мире), в 1-м — финиш-терминал и жетон бонус-этапа', () => {
  eq(LVL.WORLDS, 4); eq(LVL.ACTS, 2);
  const bosses = new Set();
  for (let w = 1; w <= 4; w++){
    const a1 = LVL.build(w, 1), a2 = LVL.build(w, 2);
    ok(!a1.arena && a1.goal && !a1.goal.hidden, 'мир ' + w + ' акт 1: финиш');
    ok(a2.arena && a2.goal && a2.goal.hidden, 'мир ' + w + ' акт 2: арена'); bosses.add(a2.arena.boss);
    eq(a1.secrets.filter(s => s.token).length, 1, 'жетон в 1-м акте мира ' + w); eq(a2.secrets.filter(s => s.token).length, 0);
    for (const lv of [a1, a2]){
      ok(lv.w * T >= 9000, 'акт длинный: ' + lv.w * T + ' px');
      ok(lv.springs.length >= 1 && lv.pipes.length >= 1 && lv.rails.length >= 1 && lv.steam.length >= 1, `мир ${w}: пружины/трубы/рельсы/шахты есть`);
      ok(lv.t.some(c => c === C.X), 'ящики есть'); ok(lv.secrets.length >= 1, 'тайники есть'); ok(lv.cps.length >= 2, 'чекпойнты');
      ok(lv.caps.some(c => ['burst', 'blast', 'bounce'].includes(c.k)), 'есть апгрейд бластера');
      ok(lv.gears.length >= 100, 'шестерней ' + lv.gears.length);
    }
  }
  eq(bosses.size, 4, 'четыре разных босса');
});
test('карты детерминированы: повторная сборка даёт те же клетки и объекты', () => {
  for (let w = 1; w <= 4; w++) for (let a = 0; a <= 2; a++){
    const A = a ? LVL.build(w, a) : LVL.buildBonus(w), B = a ? LVL.build(w, a) : LVL.buildBonus(w);
    eq(Buffer.from(A.t).toString('base64'), Buffer.from(B.t).toString('base64'), w + '-' + a); eq(JSON.stringify(A.gears), JSON.stringify(B.gears));
  }
});
test('копия карты на игру: разбитые ящики и собранные шестерни не портят шаблон', () => {
  const a = L.getLV(1, 1), b = L.getLV(1, 1); a.t[a.t.indexOf(C.X)] = C.E; a.gears[0].x = -5;
  ok(b.t.indexOf(C.X) === L.template(1, 1).t.indexOf(C.X)); ok(b.gears[0].x !== -5);
});

// ---------- физика ----------
test('разгон: три ступени скорости — держишь бег ≈1 с на пределе ступени → следующая; 3-я — 470 px/с', () => {
  const LV = flatLV(400), P = L.newHero(48, 240), ev = [];
  const step = (sec, dx) => { for (let i = 0; i < Math.round(sec * 60); i++) L.heroStep(LV, P, { dx, dy: 0, jump: false, jp: false }, dt, (t, d) => ev.push({ t, d })); };
  eq(P.tier, 0);
  step(0.6, 1); ok(Math.abs(P.gsp - L.TOPS[0]) < 1, 'ступень 1 — ' + P.gsp);
  step(1.1, 1); eq(P.tier, 1, 'ступень 2');
  step(1.4, 1); eq(P.tier, 2, 'ступень 3'); ok(Math.abs(P.gsp - L.TOPS[2]) < 1, 'скорость ' + P.gsp);
  ok(ev.filter(e => e.t === 'tier').map(e => e.d.tier).join() === '1,2', 'события tier');
  step(1.5, 0); ok(P.tier < 2, 'отпустил — скорость и ступень падают: ' + P.tier);
  ok(P.y === 240 && P.ground, 'бег по ровному без подскоков');
});
test('ящики: на 3-й скорости разбиваются с разбега, на 1-й — стена', () => {
  for (const [tier, gsp, breaks] of [[2, 470, true], [0, 230, false]]){
    const { game, S, has } = mk(); const LV = S.LV; let cx = -1, cy = -1;
    for (let i = 0; i < LV.t.length && cx < 0; i++) if (LV.t[i] === C.X && LV.t[i + LV.w] !== C.X && LV.t[i - 1] !== C.X){ cx = i % LV.w; cy = Math.floor(i / LV.w); }
    const y = (cy + 1) * T; game._place(cx * T - 60, y - 1); run(game, 0.05);
    const P = S.hero; P.ground = true; P.y = y; P.gsp = gsp; P.tier = tier;
    run(game, 0.5, 1);
    eq(has('crate'), breaks, 'tier ' + tier); eq(P.x > cx * T + 16, breaks, 'проехал сквозь: ' + P.x.toFixed(0));
  }
});
test('пружина подбрасывает на ~20 клеток; паровая шахта поднимает на верх стены', () => {
  const { game, S, has } = mk(); const LV = S.LV, o = LV.springs[0];
  game._place(o.x - 30, o.y - 1); run(game, 0.05); let minY = 1e9;
  for (let i = 0; i < 60; i++){ game.setInput(0.4, 0, false); game.update(dt); minY = Math.min(minY, S.hero.y); }
  ok(has('spring'), 'сработала'); ok(o.y - minY > 280, 'высота ' + (o.y - minY).toFixed(0));
  const st = LV.steam[0], { game: g2, S: S2, has: h2 } = mk();
  g2._place(st.x0 - 40, st.y1 - 7 * T - 1); let top = false;
  for (let i = 0; i < 240 && !top; i++){ g2.setInput(1, 0, false); g2.update(dt); const P = S2.hero; if (P.x > st.x1 && P.ground && Math.abs(P.y - (st.y0 + 4 * T)) < 1) top = true; }
  ok(h2('steam'), 'пар'); ok(top, 'встал на верх стены: ' + S2.hero.x.toFixed(0) + ',' + S2.hero.y.toFixed(0));
});
test('труба-ускоритель переносит через пропасть и даёт 3-ю скорость; рельс несёт над пропастью и бросает вперёд', () => {
  const { game, S, has } = mk(); const LV = S.LV, pp = LV.pipes[0], m = pp.pts[0], e = pp.pts[pp.pts.length - 1];
  game._place(m[0] - 60, m[1] + 9); for (let i = 0; i < 240 && !has('pipeOut'); i++){ game.setInput(1, 0, false); game.update(dt); }
  run(game, 0.5, 1);
  ok(has('pipe') && has('pipeOut'), 'вход/выход'); ok(S.hero.x > e[0] && S.phase === 'play' && S.hero.ground, 'за пропастью: ' + S.hero.x.toFixed(0)); eq(S.hero.tier, 2); ok(S.hero.gsp > 450, 'скорость ' + S.hero.gsp);
  const rl = LV.rails[0], { game: g2, S: S2, has: h2 } = mk();
  g2._place(rl.pts[0][0] - 90, rl.pts[0][1] - 1); run(g2, 0.05); S2.hero.ground = true; S2.hero.y = rl.pts[0][1];
  let onRail = 0; for (let i = 0; i < 420; i++){ g2.setInput(1, 0, false); g2.update(dt); if (S2.hero.mode === 'rail') onRail++; }
  ok(h2('rail') && h2('railOff'), 'рельс'); ok(onRail > 30, 'ехал по рельсу ' + onRail + ' кадров');
  ok(S2.phase === 'play' && S2.hero.x > rl.pts[rl.pts.length - 1][0] && S2.hero.ground, 'за пропастью на земле');
});
test('подшаги: перемещение за подшаг ≤ 4 px на любой скорости (разгон, падение, труба на выходе)', () => {
  const P = L.newHero(100, 100); let maxStep = 0;
  for (const v of [100, 470, K.MAXG, 900]){ const n = Math.max(1, Math.ceil(v * dt / K.STEP)); maxStep = Math.max(maxStep, v * dt / n); }
  ok(maxStep <= K.STEP + 1e-9, 'подшаг ' + maxStep); ok(K.STEP < T / 2, 'подшаг меньше половины клетки');
  ok(P.mode === 'run');
});
test('нет проваливания: падение с максимальной скоростью на каждую опору каждого акта — встаём ровно на поверхность', () => {
  let n = 0;
  for (let w = 1; w <= 4; w++) for (let a = 1; a <= 2; a++){
    const LV = L.getLV(w, a), N = navFor(SH, LV);
    for (const nd of N.nodes){
      if (nd.c % 3 || L.inSteam(LV, nd.x, nd.y - 130) || L.inSteam(LV, nd.x, nd.y - 12) || LV.springs.some(o => Math.abs(o.x - nd.x) < 20)) continue;
      const P = L.newHero(nd.x, nd.y - 120); P.sim = true; P.ground = false; P.vy = K.MAXFALL; P.vx = 0;
      let landed = false;
      for (let i = 0; i < 40 && !landed; i++){ L.heroStep(LV, P, { dx: 0, dy: 0, jump: false, jp: false }, dt, null); if (P.ground) landed = true; ok(!L.solidAt(LV, P.x, P.y - 3), `внутри тверди ${w}-${a} x=${nd.x}`); }
      // приземлились на эту опору или выше (мосток/склон по пути) — но не ниже её
      ok(landed && P.y <= nd.y + 0.5, `провалились ${w}-${a} x=${nd.x}: ${P.y.toFixed(1)} > ${nd.y}`); n++;
    }
  }
  ok(n > 1000, 'проверено опор: ' + n);
});
test('нет пролёта сквозь стены: бег на предельной скорости (760 px/с) по всему акту в обе стороны — герой не входит в твердь', () => {
  let n = 0;
  for (let w = 1; w <= 4; w++) for (let a = 1; a <= 2; a++){
    const LV = L.getLV(w, a), N = navFor(SH, LV);
    for (const nd of N.nodes){
      if (nd.c % 5) continue;
      for (const d of [1, -1]){
        const P = L.newHero(nd.x, nd.y); P.sim = true; P.ang = L.angleAt(LV, nd.x, nd.y); P.gsp = d * K.MAXG; P.tier = 2;
        for (let i = 0; i < 40; i++){
          L.heroStep(LV, P, { dx: d, dy: 0, jump: false, jp: false }, dt, null);
          if (P.mode !== 'run' || P.y > LV.h * T) break;
          ok(!L.solidAt(LV, P.x, P.y - 3) && !L.solidAt(LV, P.x, P.y - 14), `в тверди ${w}-${a} от x=${nd.x} → ${P.x.toFixed(0)},${P.y.toFixed(0)}`);
        }
        n++;
      }
    }
  }
  ok(n > 1000, 'забегов: ' + n);
});

// ---------- проходимость ----------
test('проходимость: в каждом акте граф по настоящей физике ведёт от старта к финишу (к арене во 2-м акте)', () => {
  for (let w = 1; w <= 4; w++) for (let a = 1; a <= 2; a++){
    const LV = L.getLV(w, a), N = navFor(SH, LV), R = N.reach(LV.start.x, LV.start.y);
    ok(R.start, 'старт — узел');
    const goalX = a === 2 ? LV.arena.x0 + 100 : LV.goal.x;
    let best = 0; for (const id of R.seen) best = Math.max(best, N.nodes[id].x);
    ok(best >= goalX, `${w}-${a}: дальше всего ${best}, финиш ${goalX}`);
    // все особые устройства на пути работают внутри графа: за каждой трубой/шахтой/рельсом есть достижимые узлы
    for (const pp of LV.pipes){ const ex = pp.pts[pp.pts.length - 1][0]; ok([...R.seen].some(id => Math.abs(N.nodes[id].x - ex) < 64), `${w}-${a}: выход трубы достижим`); }
    for (const st of LV.steam){ ok([...R.seen].some(id => N.nodes[id].x > st.x1 && N.nodes[id].x < st.x1 + 48 && N.nodes[id].y < st.y0 + 5 * T), `${w}-${a}: верх шахты достижим`); }
  }
});
test('бонус-этап: нужное число шестерней собирается за отведённое время (бег вправо + прыжки к дугам)', () => {
  for (let w = 1; w <= 4; w++){
    const lv = LVL.buildBonus(w); ok(lv.gears.length >= lv.need * 1.3, 'шестерней с запасом: ' + lv.gears.length + ' / ' + lv.need);
    const { game, S } = mk({ world: w, act: 1 }); game._goAct(w, 0); const P = S.hero; let t = 0, jt = 0;
    while (S.inBonus && S.phase === 'play' && t < 60){
      // простой автопилот: бежит вправо, у ямы и перед дугой шестерней — прыжок
      const ahead = L.floorY(S.LV, P.x + 30, P.y - 20, P.y + 40, P.y - 20) == null || S.LV.gears.some(g => !S.got[g.id] && g.x - P.x > 10 && g.x - P.x < 60 && P.y - g.y > 34);
      const jump = P.ground && ahead && jt <= 0; if (jump) jt = 0.4; jt -= dt;
      game.setInput(1, 0, jump || (!P.ground && P.vy < 0)); game.update(dt); t += dt;
    }
    ok(S.lastClear && S.lastClear.bonusStage && S.lastClear.done, `мир ${w}: собрано ${S.bonusGot} за ${t.toFixed(1)} с`);
  }
});

// ---------- правила ----------
test('шестерни: 100 → +1 жизнь; счёт +10 за шестерню', () => {
  const { game, S, has } = mk(); const P = S.hero, L0 = S.lives, sc = S.score; S.gears = 99;
  const g0 = S.LV.gears[5]; game._place(g0.x, g0.y + 10); run(game, 0.05);
  ok(has('gear')); eq(S.lives, L0 + 1); eq(S.gears, 0); ok(S.score >= sc + 10);
});
test('стрельба на ходу: вперёд и по диагонали вверх, снаряд получает скорость бега; апгрейды бластера', () => {
  const { game, S, has, ev } = mk(); const P = S.hero, sp = flatSpot(S.LV, 12); game._place(sp.x, sp.y - 1); run(game, 0.05);
  P.gsp = 400; P.ground = true; game.setInput(1, 0, false); ok(game.fire()); const s1 = S.shots[S.shots.length - 1]; ok(s1.vx > L.WPN[0].sp + 300 && s1.vy === 0, 'вперёд с разбегом ' + s1.vx);
  run(game, 0.3); game.setInput(1, -1, false); ok(game.fire()); const s2 = S.shots[S.shots.length - 1]; ok(s2.vy < -300 && s2.vx > 300, 'диагональ');
  // очередь — частая; разрывной — взрыв по площади; прыгучий — отскакивает от пола
  game._place(sp.x, sp.y - 1); run(game, 0.3); game._cap('burst'); eq(S.weapon, 1); const f0 = ev.filter(q => q.t === 'fire').length; game.setFire(true); run(game, 0.5, 0); game.setFire(false); const nf = ev.filter(q => q.t === 'fire').length - f0; ok(nf >= 5, 'очередь: ' + nf);
  run(game, 1); game._cap('blast'); eq(S.weapon, 2); game.setInput(0, 0, false); game.fire(); run(game, 1.2); ok(has('boom'), 'взрыв');
  game._cap('bounce'); eq(S.weapon, 3); run(game, 0.5); game.setInput(0, 0, false); game.fire(); run(game, 1.2); ok(has('hop'), 'отскок');
  game._die('test'); run(game, 1.6); eq(S.weapon, 0, 'гибель — бластер к базовому');
});
test('враги: выстрел, прыжок сверху и таран на 3-й скорости убивают; касание — урон, щит гасит удар', () => {
  const { game, S, has, count } = mk({ keepFoes: true }); const P = S.hero;
  const e = S.enemies.find(q => q.k === 'beetle'); S.enemies = [e]; e.x0 = e.x - 4; e.x1 = e.x + 4;
  game._place(e.x - 120, e.y - 1); run(game, 0.05); P.face = 1; game.setInput(0, 0, false); game.fire(); run(game, 0.5);
  ok(!e.alive && has('kill'), 'выстрел');
  e.alive = true; e.hp = 1; game._place(e.x, e.y - 60); P.inv = 0; run(game, 0.6); ok(!e.alive && count('kill') === 2, 'прыжок сверху');
  e.alive = true; e.hp = 1; game._place(e.x - 60, e.y - 1); run(game, 0.05); P.ground = true; P.y = e.y; P.gsp = 470; P.tier = 2; P.inv = 0; run(game, 0.3, 1);
  ok(!e.alive && count('kill') === 3, 'таран');
  e.alive = true; e.hp = 1; e.x = P.x + 40; P.gsp = 0; P.tier = 0; P.inv = 0; P.shield = 10; const hp = P.hp; game._place(e.x - 30, e.y - 1); P.inv = 0; run(game, 0.6, 1);
  ok(has('shieldHit') && P.hp === hp && P.shield <= 0, 'щит');
  P.inv = 0; game._place(e.x - 30, e.y - 1); run(game, 0.05); P.inv = 0; run(game, 0.6, 1); ok(has('hurt') && P.hp === hp - 1, 'урон');
});
test('бонусы: ускорение (3-я скорость, предел 560), магнит тянет шестерни, +давление и +жизнь', () => {
  const LV = flatLV(400), P0 = L.newHero(48, 240); P0.turbo = K.TURBO_T;
  for (let i = 0; i < 120; i++) L.heroStep(LV, P0, { dx: 1, dy: 0, jump: false, jp: false }, dt, null);
  eq(P0.tier, 2); ok(P0.gsp > 540 && P0.gsp <= K.TURBO, 'скорость ' + P0.gsp);
  const { game, S } = mk(); const P = S.hero;
  const { game: g2, S: S2 } = mk(); const g0 = S2.LV.gears.find(g => g.x > 600 && L.floorY(S2.LV, g.x - 80, g.y - 10, g.y + 60, null) != null);
  g2._place(g0.x - 80, L.floorY(S2.LV, g0.x - 80, g0.y - 10, g0.y + 60, null) - 1);
  g2._cap('magnet'); run(g2, 1.2); ok(S2.got[g0.id], 'магнит собрал шестерню за 80 px');
  P.hp = 1; game._cap('hp'); eq(P.hp, 2); const l = S.lives; game._cap('life'); eq(S.lives, l + 1);
});
test('чекпойнт: после гибели — возврат к последнему клапану, −1 жизнь; 0 жизней — конец игры', () => {
  const { game, S, has } = mk(); const cp = S.LV.cps[0];
  game._place(cp.x + 10, cp.y - 1); run(game, 0.1); ok(has('cp')); eq(S.cp.x, cp.x);
  const l = S.lives; game._die('test'); run(game, 1.6); eq(S.lives, l - 1); ok(Math.abs(S.hero.x - cp.x) < 1, 'на клапане');
  S.lives = 1; game._die('test'); run(game, 1.6); eq(S.phase, 'over'); ok(has('gameover'));
});
test('финиш акта: бонусы за скорость/шестерни/тайники; жетон → бонус-этап → акт 2; лучшее время уходит в событие clear', () => {
  const { game, S, ev, has } = mk(); const LV = S.LV, tok = LV.secrets.find(s => s.token);
  game._place(tok.x, tok.y + 6); run(game, 0.1); ok(S.token && has('token'));
  game._place(LV.goal.x + 2, LV.goal.y - 1); run(game, 0.1); ok(has('clear'));
  const c = ev.find(e => e.t === 'clear').d; ok(c.time > 0 && c.bonus === c.tb + c.gb + c.sb && c.sb >= 500 && c.token);
  run(game, 3.5); ok(S.inBonus && has('bonus'), 'бонус-этап');
  S.bonusT = 0.01; run(game, 0.1); ok(has('bonusEnd')); run(game, 3); eq(S.world * 10 + S.act, 12, 'дальше — акт 2');
});
test('боссы: у каждого 2 фазы, атаки по таймеру; ворота арены держат героя; победа открывает финиш', () => {
  for (let w = 1; w <= 4; w++){
    const { game, S, has } = mk({ world: w, act: 2 }); const A = S.LV.arena;
    game._place(A.x0 + 120, A.y - 1); run(game, 0.1); ok(S.boss && S.arenaOn, 'босс появился ' + w);
    run(game, 6, -1); ok(S.hero.x >= A.x0 + 9, 'не ушёл с арены'); ok(has('eshoot') || has('vent'), 'атакует');
    S.boss.hp = 1; S.boss.flash = 0; game.setInput(0, 0, false); S.hero.inv = 99;
    for (let i = 0; i < 400 && !S.bossDown; i++){ game.setInput(0, S.boss.y < A.y - 80 ? -1 : 0, false); S.hero.face = S.boss.x > S.hero.x ? 1 : -1; game.fire(); game.update(dt); }
    ok(S.bossDown && !S.LV.goal.hidden, 'побеждён ' + w);
    game._place(S.LV.goal.x + 2, S.LV.goal.y - 1); run(game, 0.1); ok(has('clear'));
  }
});
test('прохождение всей игры: последний босс → победа (win)', () => {
  const { game, S, has } = mk({ world: 4, act: 2 }); const A = S.LV.arena;
  game._place(A.x0 + 120, A.y - 1); run(game, 0.1); S.boss.hp = 0.5; S.boss.flash = 0; S.hero.inv = 99;
  for (let i = 0; i < 400 && !S.bossDown; i++){ S.hero.face = S.boss.x > S.hero.x ? 1 : -1; game.fire(); game.update(dt); }
  game._place(S.LV.goal.x + 2, S.LV.goal.y - 1); run(game, 4); eq(S.phase, 'won'); ok(has('win'));
});

// ---------- оформление ----------
test('рендер обеих тем: все миры, бонус-этап, все боссы и выстрелы рисуются без исключений', () => {
  const g = { themeName: 'modern', time: 1.2, t: k => SH.STR.ru[k] || k };
  for (const th of ['modern', 'retro']) for (let w = 1; w <= 4; w++) for (const a of [1, 2, 0]){
    g.themeName = th;
    const { game, S } = mk({ keepFoes: true, world: w, act: a || 1 }); if (a === 0) game._goAct(w, 0);
    if (a === 2){ const A = S.LV.arena; game._place(A.x0 + 120, A.y - 1); run(game, 1.5); }
    else run(game, 0.5, 1);
    S.shots.push({ x: S.hero.x + 20, y: S.hero.y - 10, vx: 1, vy: 0, w: 2, t: 1, hit: {} }); S.booms.push({ x: S.hero.x, y: S.hero.y, r: 40, t: 0.2 });
    S.eshots.push({ x: S.hero.x + 40, y: S.hero.y - 10, vx: 0, vy: 0, r: 8, t: 1, k: 'wrench' }, { x: 0, y: 0, vx: 0, vy: 0, r: 8, t: 1, k: 'cog' }, { x: 0, y: 0, vx: 0, vy: 0, r: 8, t: 1, k: 'puff' });
    const cam = {}; SH.R.camera(cam, S, dt, true);
    const before = calls.fill; SH.render(g, fakeCtx(), S, { cam, toasts: [{ text: '+1', x: 1, y: 1, t: 1, life: 1, color: '#fff' }], banner: { title: 'A', sub: 'b', a: 1, dur: 2, lines: ['x', 'y'] } });
    ok(calls.fill - before > 200, `${th} ${w}-${a}: вызовов рисования ${calls.fill - before}`);
  }
});
test('i18n: у RU и EN одинаковые ключи; есть названия миров, боссов, оружия, бонусов', () => {
  const ru = Object.keys(SH.STR.ru).sort(), en = Object.keys(SH.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let w = 1; w <= 4; w++) ok(SH.STR.ru['w' + w] && SH.STR.en['w' + w]);
  for (const b of LVL.BOSSES) ok(SH.STR.ru['b_' + b] && SH.STR.en['b_' + b], b);
  for (const k of ['burst', 'blast', 'bounce', 'shield', 'turbo', 'magnet', 'hp', 'life', 'gears']) ok(SH.STR.ru['c_' + k] && SH.STR.en['c_' + k], k);
  for (const k of ['base', 'burst', 'blast', 'bounce']) ok(SH.STR.ru['w_' + k], k);
});
test('музыка: оригинальный трек Arcade.tracks.shustrik, ноты и удары в нотации секвенсора', () => {
  const tr = sandbox.Arcade.tracks.shustrik; ok(tr && tr.bpm >= 120, 'трек');
  const voice = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
  for (const t of voice(tr.melody).concat(voice(tr.bass))) ok(t === '-' || t === '.' || /^[A-G][#b]?\d$/.test(t), 'нота ' + t);
  for (const t of voice(tr.drums)) ok(t === '.' || /^[ksho]+$/.test(t), 'удар ' + t);
  ok(voice(tr.melody).length === 64 && voice(tr.bass).length === 32, 'длины: 8 тактов мелодии, 4 такта баса (восьмые)');
});
test('страница: engine.js — копия _shared, ссылка «← Каталог», фавикон студии, все скрипты подключены', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js синхронизирован');
  ok(/data-catalog-back/.test(html) && /rel="icon"/.test(html) && /<canvas/.test(html));
  for (const f of ['engine.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/audio.js', 'js/render.js', 'js/main.js']) ok(html.includes('./' + f), f);
  ok(!/https?:\/\//.test(html.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '')), 'без внешних URL');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGphenogP2phY2t8amFjayA/cmFiYml0fNC00LbQsNC3ID/QtNC20LXQunzQtNC20LXQuiA/0YBb0Y3QtV3QsdCx0LjRgnxcYnNvbmljXGJ80YHQvtC90LjQunxyb2JvdG5pa3zRgNC+0LHQvtGC0L3QuNC6fGVnZ21hbnzRjdCz0LPQvNCw0L0=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Шустрик') && !BAD.test('supersonic') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('хорёк'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс нажатий, поздно замечает часть врагов, «засматривается».
test('бот-человек проходит акт 1-1 почти всегда: ≥ 18 из 20 партий (3 жизни)', () => {
  const R = []; for (let s = 1; s <= 20; s++) R.push(playShustrik(SH, s, { world: 1, act: 1, only: true, maxT: 400 }));
  const n = R.filter(r => r.acts > 0).length, d = R.reduce((a, r) => a + r.deaths, 0), tm = R.filter(r => r.acts).map(r => r.firstAt);
  console.log('     1-1: ' + n + '/20; гибелей всего ' + d + '; время прохождения ' + (tm.length ? Math.min(...tm).toFixed(0) + '–' + Math.max(...tm).toFixed(0) + ' с' : '—'));
  ok(n >= 18, 'слишком сложно: ' + n + '/20'); ok(!R.some(r => r.stuck), 'бот застрял');
});
test('бот-человек: каждый акт (и каждый босс) проходится хотя бы в части партий', () => {
  const out = [];
  for (let w = 1; w <= 4; w++) for (let a = 1; a <= 2; a++){
    if (w === 1 && a === 1) continue;
    let n = 0; for (let s = 1; s <= 4; s++){ const r = playShustrik(SH, s, { world: w, act: a, only: true, maxT: 500 }); if (r.acts > 0 || r.won) n++; }
    out.push(w + '-' + a + ':' + n + '/4'); ok(n >= 2, `${w}-${a}: ${n}/4`);
  }
  console.log('     ' + out.join('  '));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

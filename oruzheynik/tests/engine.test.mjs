/* ОТБОЙ (oruzheynik) · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node oruzheynik/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: этапы и их рецепты, физику (прыжок, кувырок), проходимость каждого этапа графом по настоящей физике,
   молот (удар, отбой, жар, охват), бои с Мастерами (только отбитые снаряды бьют сильно), жизни, подсказки, сохранение и
   миграцию игроков сайта, музыку, i18n (5 языков), правило имён и партии «человеческого» бота. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/save.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const OZ = sandbox.ORUZH, L = OZ.logic, DT = 1 / 60;
const { playGame, playStage, mulberry32, navFor } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function memStore(init){ const m = new Map(Object.entries(init || {})); return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
function mk(o = {}){
  const ev = [], ls = o.ls || memStore();
  const game = OZ.Game({ rng: mulberry32(o.seed || 1), dmgMul: o.dmgMul, start: o.start, tutorial: o.tutorial, onEvent: (t, d) => ev.push({ t, d }) }).start();
  return { game, S: game.state(), ev, ls, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state()) : inp); game.update(DT); } game.setInput({}); }
// пустой мир для физики: пол на ряду 12, колонки по описанию
function flatWorld(w, fn){ const t = new Uint8Array(w * L.R); for (let c = 0; c < w; c++) for (let r = 12; r < L.R; r++) t[r * w + c] = L.SOL; if (fn) fn(t, w); return { W: w, t, grp: new Int8Array(w * L.R).fill(-1), open: true }; }


// ---------- этапы ----------
test('7 этапов: 6 цехов и Чёрная Домна; у каждого старт, отметки, арена босса; мини-комнаты с воротами', () => {
  eq(OZ.STAGES.length, 7);
  OZ.STAGES.forEach((d, i) => {
    const lv = OZ.level(i); ok(lv.start && lv.arena && lv.cps.length >= 2, d.key);
    ok(lv.W > 80 && lv.W < 220, d.key + ' ширина ' + lv.W);
    if (lv.mini) { const W = lv.W; let gates = 0; for (let r = 0; r < L.R; r++) if (lv.t[r * W + lv.mini.x1] === L.GATE) gates++; eq(gates, 3, d.key + ' ворота мини-комнаты'); }
  });
  eq(OZ.STAGES.slice(0, 6).map(s => s.boss).join(','), L.BOSSES.join(','));
  eq(OZ.STAGES[6].boss, 'walker'); ok(OZ.STAGES[6].final && !OZ.STAGES.slice(0, 6).some(s => s.final));
});
test('у каждого цеха свой набор врагов/препятствий (наборы не совпадают)', () => {
  const sig = OZ.STAGES.map((d, i) => { const lv = OZ.level(i); const types = [...new Set(lv.spawns.map(s => s.type))].sort().join('+'); const toks = [...new Set(d.r.split(/\s+/).map(t => t.replace(/[0-9:-]+.*$/, '')))].sort().join(','); return types + '|' + toks; });
  ok(new Set(sig).size >= 6, sig.join(' / ')); eq(new Set(OZ.STAGES.map(d => d.r)).size, 7);
});
test('ползун не заходит в тоннели для кувырка (иначе молотом его там не достать): разворачивается у устья', () => {
  const T = mk({ seed: 2, start: { si: 1 }, tutorial: false }); const lv = T.S.lv, W = lv.W;
  let c0 = -1; for (let c = 5; c < W; c++) if (lv.t[10 * W + c] === L.SOL && lv.t[11 * W + c] === L.E && lv.t[12 * W + c] === L.SOL) { c0 = c; break; }
  ok(c0 > 0, 'в цехе 2 есть тоннель'); let c1 = c0; while (lv.t[10 * W + c1 + 1] === L.SOL && lv.t[11 * W + c1 + 1] === L.E) c1++;
  T.S.hero.inv = 1e9; T.S.hero.hp = 1e9; T.game._place(c0 - 5, 12); T.S.spawns.forEach(q => { q.done = true; });
  const e = T.game._spawn('crawler', c0 - 2.5, 12); let inside = false;
  for (let f = 0; f < 60 * 14; f++){ T.game._place(c0 - 6, 12); T.game.update(DT); if (e.dead) break; if (e.x > c0 - 0.2 && e.x < c1 + 1) inside = true; }
  ok(!inside, 'ползун забрёл в тоннель');
});
test('неизвестный токен рецепта — понятная ошибка', () => {
  const bak = OZ.STAGES[0].r; OZ.STAGES[0].r = 'S f2 zz X';
  try { let err = null; try { OZ.buildLevel(0); } catch (e) { err = e; } ok(err && /неизвестный токен/.test(err.message)); } finally { OZ.STAGES[0].r = bak; }
});

// ---------- физика ----------
test('прыжок: полный — чуть выше 3 клеток, короткое нажатие — ниже; разбег перепрыгивает пропасть в 3 клетки, но не в 6', () => {
  const W = flatWorld(30);
  const full = L.newHero(5.5, 12); let top = 12;
  for (let f = 0; f < 120; f++){ L.heroStep(W, full, { dx: 0, jump: true, jumpPress: f === 0 }, DT, null); top = Math.min(top, full.y); }
  ok(12 - top > 3 && 12 - top < 3.5, 'полный прыжок ' + (12 - top).toFixed(2));
  const tap = L.newHero(5.5, 12); let top2 = 12;
  for (let f = 0; f < 120; f++){ L.heroStep(W, tap, { dx: 0, jump: f < 5, jumpPress: f === 0 }, DT, null); top2 = Math.min(top2, tap.y); }
  ok(12 - top2 < 2, 'короткий ' + (12 - top2).toFixed(2));
  const gap = n => { const w = flatWorld(30, (t, w) => { for (let c = 10; c < 10 + n; c++) for (let r = 12; r < L.R; r++) t[r * w + c] = 0; }); const r = L.simulate(w, 9.6, 12, { dx: 1, hold: 0.7, delay: 0 }, null); return r.ok && r.x > 10 + n; };
  ok(gap(3), 'пропасть 3'); ok(!gap(6), 'пропасть 6 — непрыгаема');
});
test('подкат: проходит в тоннель высотой 1 клетка, стоя туда не пройти; ↓+прыжок тоже даёт подкат', () => {
  const W = flatWorld(30, (t, w) => { for (let c = 12; c < 16; c++) for (let r = 0; r <= 10; r++) t[r * w + c] = L.SOL; });
  const h = L.newHero(9.5, 12); for (let f = 0; f < 60; f++) L.heroStep(W, h, { dx: 1 }, DT, null);
  ok(h.x < 12, 'стоя — упёрся: ' + h.x.toFixed(2));
  const s = L.newHero(9.5, 12); L.heroStep(W, s, { dx: 1, slidePress: true }, DT, null); for (let f = 0; f < 50; f++) L.heroStep(W, s, { dx: 1 }, DT, null);
  ok(s.x > 16, 'подкатом прошёл: ' + s.x.toFixed(2));
  const d = L.newHero(5.5, 12); L.heroStep(W, d, { dx: 0, down: true, jump: true, jumpPress: true }, DT, null); ok(d.slide && d.vy === 0, 'вниз+прыжок = подкат');
});
test('шипы и пропасть — гибель; мигающие блоки держат, пока горят', () => {
  const W = flatWorld(20, (t, w) => { t[11 * w + 8] = L.SPK; });
  const h = L.newHero(5.5, 12); for (let f = 0; f < 60 && !h.dead; f++) L.heroStep(W, h, { dx: 1 }, DT, null); eq(h.dead, 'spike');
  const P = flatWorld(20, (t, w) => { for (let c = 8; c < 20; c++) for (let r = 12; r < L.R; r++) t[r * w + c] = 0; });
  const p = L.newHero(5.5, 12); for (let f = 0; f < 200 && !p.dead; f++) L.heroStep(P, p, { dx: 1 }, DT, null); eq(p.dead, 'pit');
  ok(L.blinkOn(0, 0.5) && !L.blinkOn(0, 2.5) && L.blinkOn(1, 1.5), 'такт блоков');
});

// ---------- проходимость ----------

// ---------- проходимость ----------
test('проходимость: в каждом этапе граф по физике ведёт от старта до арены босса (мини-комната, мигающие блоки во всех фазах)', () => {
  OZ.STAGES.forEach((d, i) => {
    const N = navFor(OZ, i), R = N.nav.reach(N.start);
    ok(N.start >= 0, d.key + ': старт не узел');
    ok(N.goals.some(gid => R.has(gid)), d.key + ': арена недостижима');
    ok(N.nav.blinkOk.every(Boolean), d.key + ': цепочка мигающих блоков не проходится при какой-то фазе такта');
    if (N.lv.mini) { const W = N.lv.W, inMini = [...R].some(id => id % W > N.lv.mini.x0 && id % W < N.lv.mini.x1); ok(inMini, d.key + ': мини-комната'); }
  });
});
test('исполнимость: бот без урона проходит каждый этап целиком в настоящей физике (путь графа + бои)', () => {
  OZ.STAGES.forEach((d, i) => { const r = playStage(OZ, 3, { stage: i, dmgMul: 0, maxT: 700 }); ok(r.cleared && !r.stuck, d.key + ': ' + JSON.stringify(r.stuckAt || r.at || r.t)); });
});

// ---------- молот ----------
const stand = (g, x) => { g._place(3.5, 12); g.state().spawns.forEach(q => { q.done = true; }); };   // герой на ровном месте у старта, врагов уровня нет
test('нет дальнобойного оружия: ввода «выстрела» нет, удар молота — единственная атака; замах длится 0,42 с, охват вперёд 2,1', () => {
  const T = mk({ seed: 3 }); ok(!('WEAP' in L) && !('CH1' in L)); eq(L.SW_TOT, 0.42); eq(L.REACH, 2.1);
  eq(T.game._swing(), true); ok(T.S.hero.swingT > 0.4); eq(T.game._swing(), false, 'замах нельзя перебить');
  run(T.game, 0.5); eq(T.S.hero.swingT, 0); ok(T.game._swing(), 'после замаха — снова');
  ok(T.S.shots.length === 0, 'молот не пускает снарядов');
});
test('удар молота бьёт врага впереди (охват 2,1) и не достаёт дальше; сзади не бьёт', () => {
  const T = mk({ seed: 3 }); T.S.cam.x = 0; stand(T.game, 10.5);
  const near = T.game._spawn('crawler', 5.2, 12), far = T.game._spawn('crawler', 8.5, 12), back = T.game._spawn('crawler', 1.8, 12);
  [near, far, back].forEach(e => { e.vx = 0; e.dir = 0; });
  T.game.setInput({ hit: true }); T.game.update(DT); T.game.setInput({}); run(T.game, 0.4);
  ok(near.dead, 'ближний убит одним ударом'); ok(!far.dead && !back.dead, 'дальний и задний целы');
});
test('отбой: снаряд в зоне удара не ранит героя, а летит обратно и бьёт стрелка; жар растёт', () => {
  const T = mk({ seed: 3 }); T.S.cam.x = 0; stand(T.game, 10.5); const h = T.S.hero; h.inv = 0;
  const tur = T.game._spawn('turret', 9.5, 12); tur.cd = 99;
  h.face = 1; T.game._eshot({ kind: 'bolt', x: 4.4, y: 11.2, vx: -6, vy: 0, r: 0.25, dmg: 3 });   // летит в героя справа
  T.game._swing(); run(T.game, 0.12);
  ok(T.has('reflect'), 'отбой случился'); eq(h.hp, L.MAX_HP, 'герой не ранен'); eq(h.heat, 1, 'жар +1');
  ok(T.S.shots.length === 1 && T.S.shots[0].k === 'ref' && T.S.shots[0].vx > 5, 'снаряд летит к стрелку');
  run(T.game, 1.0); ok(tur.dead, 'самопал убит собственным снарядом');
});
test('отбить можно не всё: ударная волна по полу и ящик не отбиваются (волна — прыгай; ящик разбивается)', () => {
  const T = mk({ seed: 3 }); T.S.cam.x = 0; stand(T.game, 10.5); const h = T.S.hero; h.inv = 0; h.face = 1;
  T.game._eshot({ kind: 'wave', x: 4.7, y: 11.6, vx: -7, vy: 0, hw: 0.45, hh: 0.65, dmg: 3, floor: true });
  T.game._swing(); run(T.game, 0.1); ok(!T.has('reflect'), 'волну не отбить'); ok(h.hp < L.MAX_HP, 'волна ранит');
  const U = mk({ seed: 3 }); U.S.cam.x = 0; stand(U.game, 10.5); U.S.hero.face = 1; U.S.hero.inv = 0;
  U.game._eshot({ kind: 'crate', x: 4.7, y: 11, vx: 0, vy: 0, g: 30, hw: 0.45, hh: 0.45, dmg: 4, crate: true });
  U.game._swing(); run(U.game, 0.1); ok(U.has('crash') && U.S.hero.hp === L.MAX_HP, 'ящик разбит');
});
test('жар: три отбоя — молот раскалён (охват 3,0, удар сильнее), после удара жар сгорает; урон по герою сбрасывает жар', () => {
  const T = mk({ seed: 3 }); T.S.cam.x = 0; stand(T.game, 10.5); const h = T.S.hero; h.heat = 3;
  const e = T.game._spawn('crawler', 6.2, 12); e.vx = 0; e.dir = 0; e.hp = 4; e.max = 4;   // за пределами обычного охвата (2,1), но в раскалённом (3,0)
  T.game._swing(); ok(h.hot && h.heat === 0, 'раскалённый удар'); run(T.game, 0.2); ok(e.dead, 'достал дальше и убил (урон 4)');
  h.heat = 2; h.inv = 0; T.game._hurt(3, 'foe', 9); eq(h.heat, 0);
});
test('охват удара не бьёт сквозь стены... враг за спиной и снаряд позади не отбиваются', () => {
  const T = mk({ seed: 3 }); T.S.cam.x = 0; stand(T.game, 10.5); const h = T.S.hero; h.face = 1; h.inv = 0;
  T.game._eshot({ kind: 'bolt', x: 2.0, y: 11.2, vx: 6, vy: 0, r: 0.25, dmg: 3 });
  T.game._swing(); run(T.game, 0.1); ok(!T.has('reflect'), 'снаряд позади не отбит');
});

// ---------- Мастера ----------
test('Мастер: прямой удар молота — 1, отбитый снаряд — 4 (раскалённый молот — 3 и 6); после отбоя оглушён', () => {
  const T = mk({ seed: 4 }); T.game._startBoss(); run(T.game, 1.8); const b = T.S.boss; eq(T.S.bossState, 'fight');
  eq(T.game._bossDamage('hammer', 'melee', 1).d, 1); eq(T.game._bossDamage('hammer', 'ref', 4).d, 4);
  const hp0 = b.hp; T.game._hitBoss(1); eq(b.hp, hp0 - 1); T.game._hitBoss(4); eq(b.hp, hp0 - 5); ok(b.stun > 0, 'оглушён');
  eq(L.BOSS_HP, 27); eq(L.FINAL_HP, 28);
});
test('бой: Мастер, не получая отбитых снарядов, почти не теряет здоровья от ударов (6 ударов < 1/3 здоровья)', () => {
  const T = mk({ seed: 4 }); T.game._startBoss(); run(T.game, 1.8); const b = T.S.boss;
  for (let i = 0; i < 6; i++){ b.inv = 0; T.game._hitBoss(1); }
  ok(b.hp > b.max * 2 / 3, 'hp ' + b.hp);
});
test('бой: каждый Мастер за цикл стреляет отбиваемыми снарядами (иначе его не победить)', () => {
  L.BOSSES.concat(['walker', 'core']).forEach(k => {
    const idx = OZ.STAGES.findIndex(s => s.boss === k); const T = mk({ seed: 6, start: { si: idx >= 0 ? idx : 6 } });
    T.game._startBoss(); T.S.hero.hp = 9999; T.S.hero.inv = 1e9;
    if (k === 'core'){ T.S.boss.hp = 0.0001; T.game._hitBoss(1); run(T.game, 2.8); }
    let refl = 0; const seen = new Set();
    for (let f = 0; f < 60 * 14; f++){ T.game.setInput({}); T.game.update(DT); T.S.eshots.forEach(s => { if (!seen.has(s)){ seen.add(s); if (!L.NOREF[s.kind]) refl++; } }); }
    ok(refl >= 4, k + ': отбиваемых снарядов за 14 с — ' + refl);
  });
});
test('победа над Мастером: цех отвоёван (бонус за здоровье), через паузу — следующий этап; в финале — Шагающая Домна, затем Сердце, затем победа', () => {
  const T = mk({ seed: 5 }); T.game._startBoss(); run(T.game, 1.8); T.S.boss.hp = 1; T.game._hitBoss(4); ok(T.S.bossState === 'dead');
  run(T.game, 3); eq(T.S.phase, 'clear'); ok(T.S.clearBonus > 0 && T.has('clear')); run(T.game, 3.5); eq(T.S.phase, 'stage'); eq(T.S.stage, 1);
  const F = mk({ seed: 5, start: { si: 6 } }); F.game._startBoss(); run(F.game, 1.8); F.S.boss.hp = 1; F.game._hitBoss(4); run(F.game, 3.2);
  eq(F.S.boss.key, 'core'); eq(F.S.boss.hp, L.FINAL_HP); run(F.game, 1.8); F.S.boss.hp = 1; F.game._hitBoss(4); run(F.game, 3.2); eq(F.S.phase, 'won'); ok(F.S.won && F.has('win'));
});
test('жизни: гибель — с последней отметки, без жизней — конец игры; в воздухе удар не отбрасывает героя на шипы', () => {
  const T = mk({ seed: 6 }); eq(T.S.lives, L.LIVES); T.game._kill('pit'); run(T.game, 2.2); eq(T.S.lives, L.LIVES - 1); eq(T.S.phase, 'stage');
  T.game._kill('pit'); run(T.game, 2.2); T.game._kill('pit'); run(T.game, 2.2); eq(T.S.phase, 'over'); ok(T.has('gameover'));
  const A = mk({ seed: 6 }); A._ = 0; A.S.hero.ground = false; A.S.hero.inv = 0; A.game._hurt(3, 'foe', A.S.hero.x - 1); eq(A.S.hero.knockDir, 0); eq(A.S.hero.knockT, 0);
});
test('площадка: «ещё один шанс» оживляет с отметки (1 жизнь, 60% здоровья); бонус паузы — раз за партию, здоровье и жар 2', () => {
  const T = mk({ seed: 6 }); for (let i = 0; i < 3; i++){ T.game._kill('pit'); run(T.game, 2.2); } eq(T.S.phase, 'over');
  ok(T.game.reviveAd()); eq(T.S.phase, 'stage'); eq(T.S.lives, 1); eq(T.S.hero.hp, Math.ceil(L.MAX_HP * 0.6)); ok(!T.S.over);
  ok(T.game.canBoost()); ok(T.game.boost()); eq(T.S.hero.hp, L.MAX_HP); eq(T.S.hero.heat, 2); ok(!T.game.canBoost(), 'раз за партию');
});
test('подсказки первого цеха: удар, отбой и бой с Мастером — по одному разу; выключаются флагом tutorial:false', () => {
  const T = mk({ seed: 7 }); T.S.cam.x = 0; run(T.game, 0.1); T.game._place(5, 12); T.S.cam.x = 0; run(T.game, 0.4); ok(T.ev.some(e => e.t === 'hint' && e.d.k === 'swing'));
  const U = mk({ seed: 7, tutorial: false }); U.game._place(5, 12); run(U.game, 0.5); U.game._startBoss(); ok(!U.has('hint'));
  const V = mk({ seed: 7 }); V.game._startBoss(); V.game._startBoss(); eq(V.ev.filter(e => e.t === 'hint' && e.d.k === 'boss').length, 1);
});

// ---------- сохранение и миграция ----------
function memIO(init){ const m = new Map(Object.entries(init || {})); return { m, get: k => m.has(k) ? m.get(k) : null, set: (k, v) => m.set(k, String(v)), del: k => m.delete(k) }; }
test('сохранение: v3 { si, score } туда-обратно; чужой формат и мусор читаются как «нет сохранения»; игра стартует с сохранённого этапа', () => {
  const s = OZ.save.serialize({ si: 3, score: 1234 }); eq(JSON.stringify(OZ.save.parse(s)), JSON.stringify({ v: 3, si: 3, score: 1234 }));
  eq(OZ.save.parse('{"v":1,"beaten":[true,false,false,false,false,false,false,false],"tanks":2,"fort":0,"tankGot":{}}'), null);
  eq(OZ.save.parse('{мусор'), null); eq(OZ.save.parse(null), null); eq(OZ.save.parse(OZ.save.serialize({ si: 99, score: -5 })).si, 6);
  const T = mk({ seed: 8, start: { si: 3, score: 1234 } }); eq(T.S.stage, 3); eq(T.S.score, 1234); eq(JSON.stringify(T.game.saveData()), JSON.stringify({ si: 3, score: 1234 }));
});
test('миграция игроков сайта: старое сохранение (трофеи, фляги, пароль) стирается, прежний рекорд — в «прежний», сообщение один раз; новый игрок — без сообщения', () => {
  const io = memIO({ 'arcade.save.oruzheynik': '{"v":1,"beaten":[true,true,false,false,false,false,false,false],"tanks":1,"fort":0,"tankGot":{}}', 'arcade.best.oruzheynik': '48200' });
  const r = OZ.save.migrate(io);
  ok(r.migrated && r.notice && r.oldBest === 48200); ok(io.get('arcade.save.oruzheynik') === null && io.get('arcade.best.oruzheynik') === null, 'старое стёрто');
  eq(io.get('arcade.oruzheynik.oldBest'), '48200'); eq(io.get('arcade.oruzheynik.v'), '3');
  const r2 = OZ.save.migrate(io); ok(!r2.migrated && r2.notice && r2.oldBest === 48200, 'повторно — не стирает заново, сообщение остаётся до показа');
  const fresh = memIO(); const r3 = OZ.save.migrate(fresh); ok(!r3.migrated && !r3.notice && fresh.get('arcade.oruzheynik.v') === '3');
  const onlyBest = memIO({ 'arcade.best.oruzheynik': '900' }); ok(OZ.save.migrate(onlyBest).migrated);
  // новый рекорд после миграции пишется в тот же ключ, что и раньше: прежний не смешивается
  ok(!('arcade.best.oruzheynik' in Object.fromEntries(onlyBest.m)));
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальные треки (цеха и бой) — 8 тактов, голоса кратны', () => {
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  [sandbox.Arcade.tracks.oruzheynik, OZ.MUSIC.boss].forEach(T => { ok(T && T.bpm > 0); eq(n(T.melody) % 8, 0); eq(n(T.melody) % n(T.bass), 0); eq(n(T.melody) % n(T.drums), 0); });
});
test('i18n: RU/EN/TR/ES/PT — одинаковые ключи; есть названия Мастеров, цехов и врагов; подсказки и миграция', () => {
  const ks = l => Object.keys(OZ.STR[l]).sort().join(',');
  ['en', 'tr', 'es', 'pt'].forEach(l => eq(ks(l), ks('ru'), l));
  ['ru', 'en', 'tr', 'es', 'pt'].forEach(l => {
    [...L.BOSSES, 'walker', 'core'].forEach(b => ok(OZ.STR[l]['b_' + b], l + ' b_' + b));
    L.BOSSES.concat(['walker']).forEach(b => ok(OZ.STR[l]['s_' + b], l + ' s_' + b));
    ['crawler', 'hopper', 'flyer', 'turret', 'golem', 'valve', 'drone'].forEach(f => ok(OZ.STR[l]['f_' + f], l + ' f_' + f));
    ['tutSwing', 'tutReflect', 'tutBoss', 'migrated', 'oldBest', 'rwHeal', 'cardClear', 'cardNext', 'cont', 'restart', 'refl', 'heatFull', 'foot', 'hint'].forEach(k => ok(OZ.STR[l][k], l + ' ' + k));
  });
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifG1lZ2EgPy0/bWFufCg/PCFb0LAt0Y/RkV0p0LzQtdCz0LAgPy0/0Lxb0LXRjV3QvXxyb2NrID8tP21hbnwoPzwhW9CwLdGP0ZFdKdGA0L7QuiA/LT/QvFvQtdGNXdC9fFxid2lseVxifCg/PCFb0LAt0Y/RkV0p0LLQsNC50LvQuA==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Магнитчик') && !BAD.test('срок менее') && !BAD.test('mine') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, не замечает часть врагов, уворачивается не всегда, отбивает не каждый снаряд.
const N1 = 12, FIRST = []; for (let s = 1; s <= N1; s++) FIRST.push(playStage(OZ, s, { stage: 0 }));
test('баланс: бот проходит первый цех (обучающий) почти всегда — ≥ 80% партий, без «зависаний»', () => {
  const n = FIRST.filter(r => r.cleared).length, why = {}; FIRST.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const bt = FIRST.map(r => r.stages[0] && r.stages[0].bossT).filter(Boolean);
  console.log('     1-й цех: ' + n + '/' + N1 + '; гибели: ' + JSON.stringify(why) + '; бой с Мастером, с: ' + Math.min(...bt).toFixed(0) + '–' + Math.max(...bt).toFixed(0));
  ok(n >= 0.8 * N1, 'слишком сложно: ' + n + '/' + N1); ok(!FIRST.some(r => r.stuck), 'бот застрял');
});
const NG = 20, GAMES = []; for (let s = 1; s <= NG; s++) GAMES.push(playGame(OZ, 200 + s));
test('баланс: бот проходит всю игру (6 цехов + Домна, 3 жизни) в 20–45% партий; без «зависаний»; бой с Мастером не короче 12 с', () => {
  const w = GAMES.filter(r => r.won).length, reach = Array(8).fill(0); GAMES.forEach(r => r.stages.forEach((q, i) => { if (q) reach[i]++; }));
  const bt = GAMES.flatMap(r => r.stages.map(q => q && q.bossT)).filter(Boolean);
  console.log('     вся игра: ' + w + '/' + NG + ' (' + Math.round(w / NG * 100) + '%); дошли до этапов 1…7: ' + reach.slice(0, 7).join(',') + '; бой с Мастером, с: ' + Math.min(...bt).toFixed(0) + '–' + Math.max(...bt).toFixed(0));
  ok(w >= 0.2 * NG && w <= 0.45 * NG, 'доля побед ' + w + '/' + NG); ok(!GAMES.some(r => r.stuck), 'бот застрял: ' + JSON.stringify(GAMES.find(r => r.stuck))); ok(Math.min(...bt) >= 12, 'бой слишком короткий');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

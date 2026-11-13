/* СКОК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node skok/tests/engine.test.mjs (QUICK=1 — без графов проходимости и партий бота).
   Логика (js/*.js без DOM) грузится в node:vm с шимом window. */
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
const SK = sandbox.SKOK, L = SK.logic, K = L.K, T = L.T, MAP = SK.MAP, LV_ = SK.levels;
const { passability, playLevel } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const DT = 1 / 60;

// мини-уровень из ASCII (для физики): ряды снизу, сверху добиваются воздухом до 18
function mini(rows){ const w = rows[0].length, t = []; for (let i = 0; i < 18 - rows.length; i++) t.push('.'.repeat(w)); return { id: 'mini', r: 1, w, h: 18, t: t.concat(rows), items: [], enemies: [], camps: [], crates: {} }; }
function sim(W, P, sec, inp){ for (let i = 0; i < Math.round(sec * 60); i++) L.heroStep(W, P, typeof inp === 'function' ? inp(i, P) : inp, DT, null); return P; }
function mk(id, opts = {}, carry){
  const ev = [];
  const game = SK.Game(Object.assign({ rng: L.mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts));
  game.startLevel(id, carry);
  const S = game.state();
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, last: t => [...ev].reverse().find(e => e.t === t) };
}
function run(game, sec, dx = 0, dy = 0, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(DT); } game.setInput(0, 0, false); }
function peak(suit, runFrames, hold = 40){
  const LV = mini(['#'.repeat(80), '#'.repeat(80)]), W = { LV }, P = L.newHero(40, 16 * T); P.suit = suit;
  sim(W, P, runFrames / 60, { dx: 1, dy: 0, jump: false });
  let top = P.y, f = 0;
  for (; f < 120; f++){ L.heroStep(W, P, { dx: 1, dy: 0, jump: f < hold }, DT, null); top = Math.min(top, P.y); if (f > 3 && P.ground) break; }
  return 16 * T - top;
}

// ---------- уровни и карта ----------
test('уровни: 4 края × (5 уровней + крепость) + 4 стычки; ряды одной ширины, старт, часовня/арена, фонарь', () => {
  eq(LV_.LEVELS.length, 28);
  for (const r of [1, 2, 3, 4]){
    const ls = LV_.LEVELS.filter(l => l.r === r);
    eq(ls.filter(l => l.n >= 1 && l.n <= 5).length, 5, 'край ' + r); eq(ls.filter(l => l.fort).length, 1); eq(ls.filter(l => l.ambush).length, 1);
  }
  for (const [name, c] of Object.entries(LV_.CH)) c.forEach((row, i) => eq(row.length, c[0].length, 'кусок ' + name + ' ряд ' + i));
  for (const id of LV_.ids){
    const LV = LV_.build(id);
    eq(LV.t.length, 18); LV.t.forEach(r => eq(r.length, LV.w, id));
    ok(LV.start, id + ' старт');
    if (LV.ambush) { eq(LV.w, 32); eq(LV.enemies.length, 5); continue; }
    if (LV.fort) { ok(LV.boss && LV.enemies.some(e => e.k === 'Z'), id + ' хозяин'); ok(LV.arenaX > 0); }
    else { ok(LV.exit, id + ' часовня'); ok(LV.exit.tx > LV.w - 12, id + ': часовня в конце'); }
    ok(LV.camps.length >= 1, id + ' фонарь');
  }
});
test('склоны: под каждым «/» и «\\» — твердь, сверху — не твердь; стык с соседней землёй по высоте', () => {
  for (const id of LV_.ids){ const LV = LV_.build(id);
    for (let ty = 0; ty < LV.h; ty++) for (let tx = 0; tx < LV.w; tx++){ const ch = LV.t[ty][tx]; if (!L.isSlope(ch)) continue;
      ok(L.isSolid(L.tileAt(LV, tx, ty + 1)), id + ' под склоном ' + tx + ',' + ty);
      const hi = ch === '/' ? tx + 1 : tx - 1, nb = L.tileAt(LV, hi, ty);
      ok(L.isSolid(nb) || L.isSlope(L.tileAt(LV, hi, ty - 1)), id + ' верхний край склона ' + tx + ',' + ty);
    }
  }
});
test('костюмы: ящики «*» есть в каждом крае, каждый костюм встречается; ключ — по одному на край, есть тайная дверь', () => {
  const seen = {};
  for (const id of LV_.ids){ const LV = LV_.build(id); for (const k in LV.crates) if (LV.crates[k].k === 'suit') { seen[LV.crates[k].suit] = 1; ok(L.SUITS.includes(LV.crates[k].suit), id); } }
  L.SUITS.forEach(s => ok(seen[s], 'костюм ' + s));
  for (const r of [1, 2, 3, 4]){
    const ls = LV_.LEVELS.filter(l => l.r === r && l.key); eq(ls.length, 1, 'ключ края ' + r);
    const LV = LV_.build(ls[0].id); ok(LV.items.some(i => i.k === 'key'), 'ключ лежит'); ok(LV.door, 'дверь'); ok(LV.items.find(i => i.k === 'key').tx < LV.door.tx, 'ключ до двери');
  }
});
test('карта: 4 края × 8 узлов (5 уровней, крепость, лавка-лотерея, «угадай рычаг»); рёбра к существующим узлам', () => {
  eq(MAP.NODES.length, 32);
  MAP.EDGES.forEach(e => ok(MAP.node(e.a) && MAP.node(e.b), e.a + '→' + e.b));
  for (const r of [1, 2, 3, 4]){ const ns = MAP.NODES.filter(n => n.r === r); eq(ns.filter(n => n.kind === 'level').length, 5); eq(ns.filter(n => n.kind === 'shop').length, 1); eq(ns.filter(n => n.kind === 'lever').length, 1); eq(ns.filter(n => n.kind === 'fort').length, 1); }
  MAP.NODES.filter(n => n.kind === 'level' || n.kind === 'fort').forEach(n => ok(LV_.byId[n.id], 'уровень узла ' + n.id));
});
test('карта: связность — без тайных выходов открывается всё, кроме «угадай рычаг»; с тайными — и они; сначала открыт только 1-1', () => {
  const p = { cleared: {}, secret: {}, played: {} };
  const sweep = () => { for (let guard = 0; guard < 80; guard++){ let ch = false; for (const n of MAP.NODES) if (MAP.isOpen(p, n.id) && !MAP.done(p, n.id)){ if (n.kind === 'level' || n.kind === 'fort') p.cleared[n.id] = 1; else p.played[n.id] = 1; ch = true; } if (!ch) break; } };
  sweep();
  for (const n of MAP.NODES){ if (n.kind === 'lever') ok(!MAP.isOpen(p, n.id), 'рычаг ' + n.id + ' закрыт без тайного выхода'); else ok(MAP.done(p, n.id), 'достижим ' + n.id); }
  ok(p.cleared[MAP.FINAL], 'финал');
  LV_.LEVELS.filter(l => l.key).forEach(l => p.secret[l.id] = 1); sweep();
  for (const n of MAP.NODES) ok(MAP.done(p, n.id), 'с тайными — ' + n.id);
  const p0 = { cleared: {}, secret: {}, played: {} }; eq(MAP.NODES.filter(n => MAP.isOpen(p0, n.id)).map(n => n.id).join(), '1-1');
});
test('карта: тайный выход открывает «угадай рычаг» → короткий путь к крепости; ходьба по тропам симметрична', () => {
  const p = { cleared: { '1-1': 1, '1-2': 1, '1-3': 1 }, secret: {}, played: {} };
  ok(!MAP.isOpen(p, '1-R')); ok(!MAP.neighbors(p, '1-3').includes('1-R'));
  p.secret['1-3'] = 1; ok(MAP.isOpen(p, '1-R')); ok(MAP.neighbors(p, '1-3').includes('1-R'));
  ok(!MAP.isOpen(p, '1-F')); p.played['1-R'] = 1; ok(MAP.isOpen(p, '1-F'), 'крепость через рычаг, минуя 1-4 и 1-5');
  p.cleared['1-F'] = 1; ok(MAP.isOpen(p, '2-1'), 'следующий край');
  for (const n of MAP.NODES) for (const m of MAP.neighbors(p, n.id)) ok(MAP.neighbors(p, m).includes(n.id), n.id + '↔' + m);
});
test('бродяги: ходят только по открытым узлам-уровням своего края; встреча с героем — «meet»', () => {
  const p = SK.save.blank(); p.cleared = { '1-1': 1, '1-2': 1, '1-3': 1, '1-4': 1 };
  const rng = L.mulberry32(5), roam = MAP.roam(1), seen = new Set();
  for (let i = 0; i < 60; i++){ const r = L.wanderStep(MAP, p, 1, rng, '9-9'); ok(r === 'moved', 'ход ' + i); ok(roam.includes(p.wand[1].at) && MAP.isOpen(p, p.wand[1].at), p.wand[1].at); seen.add(p.wand[1].at); }
  ok(seen.size >= 3, 'бродит по разным узлам: ' + [...seen]);
  p.wand[1].at = '1-2'; let met = false; for (let i = 0; i < 40 && !met; i++) { p.wand[1].at = '1-2'; met = L.wanderStep(MAP, p, 1, rng, '1-3') === 'meet'; } ok(met, 'встреча');
  p.wand[1].dead = 1; eq(L.wanderStep(MAP, p, 1, rng, '1-3'), null, 'побеждённый не ходит');
  const p2 = SK.save.blank(); eq(L.wanderStep(MAP, p2, 1, rng, '1-1'), null, 'бродяга спит, пока его узел закрыт');
});

// ---------- физика ----------
test('прыжок: высота от удержания; разбег выше; пружинные башмаки выше всех', () => {
  const lo = peak(null, 0, 3), hi = peak(null, 0, 40), run = peak(null, 60, 40), boots = peak('boots', 0, 40);
  ok(lo < hi * 0.55, 'короткое нажатие ниже: ' + lo + ' / ' + hi);
  ok(hi > 3.6 * T && hi < 4.6 * T, 'с места ≈ 4 клетки: ' + hi);
  ok(run > hi + 10 && run < 6 * T, 'с разбега выше: ' + run);
  ok(boots > hi * 1.35, 'башмаки: ' + boots);
});
test('разгон: сначала шаг (90), через ~0,5 с — бег (150)', () => {
  const LV = mini(['#'.repeat(200), '#'.repeat(200)]), W = { LV }, P = L.newHero(40, 16 * T);
  sim(W, P, 0.3, { dx: 1, dy: 0, jump: false }); ok(Math.abs(P.vx - K.WALK) < 1, 'шаг ' + P.vx);
  sim(W, P, 0.6, { dx: 1, dy: 0, jump: false }); ok(Math.abs(P.vx - K.RUN) < 1, 'бег ' + P.vx);
  sim(W, P, 0.4, { dx: 0, dy: 0, jump: false }); eq(P.vx, 0); sim(W, P, 0.3, { dx: 1, dy: 0, jump: false }); ok(P.vx <= K.WALK + 1, 'после остановки разгон заново: ' + P.vx);
});
test('крылья-зонтик: удержание прыжка в падении — планирование (медленно и дальше); медный панцирь падает быстрее и бьёт о землю', () => {
  const LV = mini(['#'.repeat(200), '#'.repeat(200)]), W = { LV };
  const P = L.newHero(40, 6 * T); P.y = 6 * T; P.ground = false; P.suit = 'wings';
  sim(W, P, 0.5, { dx: 1, dy: 0, jump: true }); ok(P.glide && Math.abs(P.vy - K.GLIDE) < 1, 'парит ' + P.vy);
  const Q = L.newHero(40, 6 * T); Q.ground = false; sim(W, Q, 0.3, { dx: 1, dy: 0, jump: true }); ok(Q.vy > 300, 'без крыльев — падение');
  const A = L.newHero(40, 6 * T); A.ground = false; A.suit = 'armor'; const ev = []; L.heroStep(W, A, { dx: 0, dy: 1, jump: false }, DT, t => ev.push(t)); ok(A.pound && ev.includes('pound'), 'удар о землю'); ok(A.vy >= K.POUND - 1);
});
test('склоны: вверх и вниз по склону без отрыва; ↓ на склоне — подкат с разгоном', () => {
  const LV = mini(['.........../##\\.........', '........../####\\........', '########################', '########################']);
  const W = { LV }, P = L.newHero(4 * T, 16 * T);
  let minY = P.y, air = 0;
  for (let i = 0; i < 200 && P.x < 21 * T; i++){ L.heroStep(W, P, { dx: 1, dy: 0, jump: false }, DT, null); minY = Math.min(minY, P.y); if (!P.ground && i > 1) air++; }
  ok(Math.abs(minY - 14 * T) < 1, 'поднялся на плато: ' + minY); ok(air <= 3, 'шёл по склону, а не прыгал: ' + air); ok(P.x > 18 * T, 'прошёл холм ' + P.x);
  const S2 = L.newHero(15 * T + 8, 0); S2.y = L.slopeS('\\', 15, 15, S2.x); S2.ground = true;
  sim(W, S2, 0.2, { dx: 0, dy: 1, jump: false }); ok(S2.slide && S2.vx > 60, 'подкат вниз: ' + S2.vx);
});
test('доски — только сверху; шипы колют (кроме панциря); смола и пропасть — гибель', () => {
  const LV = mini(['....TTTT....', '............', '............', '############', '############']), W = { LV };
  const P = L.newHero(5 * T + 8, 16 * T);
  sim(W, P, 0.6, { dx: 0, dy: 0, jump: true }); sim(W, P, 0.6, { dx: 0, dy: 0, jump: false }); eq(P.y, 13 * T, 'прыгнул сквозь доску снизу и встал на неё');
  const H = mini(['............', '............', '####^^^~~###', '############']), WH = { LV: H };
  const S0 = L.newHero(1 * T + 8, 16 * T); sim(WH, S0, 0.05, { dx: 0, dy: 0, jump: false }); eq(L.hazard(H, S0), null, 'на земле — безопасно');
  const Sp = L.newHero(5 * T + 8, 16 * T); sim(WH, Sp, 0.05, { dx: 0, dy: 0, jump: false }); eq(L.hazard(H, Sp), 'spike');
  Sp.suit = 'armor'; eq(L.hazard(H, Sp), null, 'панцирь');
  const Tr = L.newHero(7 * T + 8, 14 * T); Tr.ground = false; sim(WH, Tr, 0.4, { dx: 0, dy: 0, jump: false }); eq(L.hazard(H, Tr), 'tar');
  eq(L.hazard(H, { x: 5, y: 21 * T }), 'fall');
});
// ---------- правила ----------
function placeEnemy(S, k, tx){ const e = S.enemies.find(x => x.k === k) || S.enemies[0]; e.k = k; e.x = tx * T + 8; e.y = 16 * T; e.awake = true; e.alive = true; e.vx = 0; Object.assign(e, { hw: L.EDEF[k].hw, h: L.EDEF[k].h }); S.enemies.forEach(o => { if (o !== e) o.alive = false; }); return e; }
test('прыжок на врага: враг сбит, отскок (выше, если держать прыжок), серия очков растёт', () => {
  const m = mk('1-1'), S = m.S, e = placeEnemy(S, 'g', 10);
  S.hero.x = e.x; S.hero.y = e.y - 30; S.hero.vy = 200; S.hero.ground = false; S.hero.inv = 0;
  for (let i = 0; i < 20 && e.alive; i++){ m.game.setInput(0, 0, true); m.game.update(DT); }
  ok(!e.alive && m.has('stomp'), 'сбит'); ok(S.hero.vy < -300, 'отскок с удержанием ' + S.hero.vy);
  const k1 = m.last('kill').d.pts;
  const e2 = S.enemies[1]; Object.assign(e2, { k: 'g', alive: true, awake: true, x: S.hero.x, y: 16 * T, hw: 6, h: 12, vx: 0, dir: 1 });
  for (let i = 0; i < 80 && e2.alive; i++){ m.game.setInput(0, 0, false); m.game.update(DT); e2.x = S.hero.x; }
  ok(!e2.alive, 'второй сбит в той же серии'); ok(m.last('kill').d.pts > k1, 'серия: ' + k1 + ' → ' + m.last('kill').d.pts);
});
test('удар сбоку: костюм теряется (фартук держит лишний удар), без костюма — минус жизнь', () => {
  const m = mk('1-1', {}, { lives: 5, nuts: 0, score: 0, suit: 'apron', suitHp: 2 }), S = m.S, P = S.hero;
  P.inv = 0; m.game._hurt('g', P.x + 5); eq(P.suit, 'apron'); eq(P.suitHp, 1, 'фартук прожжён');
  P.inv = 0; m.game._hurt('g', P.x + 5); eq(P.suit, null, 'костюм снят'); ok(m.has('unsuit'));
  eq(S.phase, 'play'); P.inv = 0; m.game._hurt('g', P.x + 5); eq(S.phase, 'dead'); eq(S.lives, 4);
  run(m.game, 2); eq(S.phase, 'play', 'переигровка с фонаря/старта'); ok(m.has('respawn'));
});
test('игольник: сверху колется (кроме медного панциря); панцирем — сбит; подкат и заклёпки сбивают', () => {
  let m = mk('3-1'), S = m.S, e = placeEnemy(S, 'n', 10);
  S.hero.x = e.x; S.hero.y = e.y - 26; S.hero.vy = 200; S.hero.ground = false; S.hero.inv = 0;
  run(m.game, 0.3); ok(e.alive && (S.phase === 'dead' || m.has('hurt') || m.has('die')), 'укололся');
  m = mk('3-1', {}, { lives: 5, nuts: 0, score: 0, suit: 'armor' }); S = m.S; e = placeEnemy(S, 'n', 10);
  S.hero.x = e.x; S.hero.y = e.y - 26; S.hero.vy = 200; S.hero.ground = false; S.hero.inv = 0;
  run(m.game, 0.3); ok(!e.alive, 'в панцире — сбит'); eq(S.hero.suit, 'armor');
  m = mk('1-1', {}, { lives: 5, nuts: 0, score: 0, suit: 'apron', suitHp: 2 }); S = m.S; e = placeEnemy(S, 'n', 14); S.hero.x = 8 * T; S.hero.face = 1; S.hero.inv = 0;
  ok(m.game.fire(), 'бросок'); ok(m.has('fire')); for (let i = 0; i < 120 && e.alive; i++){ m.game.setInput(0, 0, false); m.game.update(DT); }
  ok(!e.alive && m.last('kill').d.how === 'rivet', 'заклёпка сбила');
  m = mk('1-1'); ok(!m.game.fire(), 'без фартука заклёпок нет');
});
test('ящики: удар головой — гайка; ящик-россыпь даёт 6; ящик с костюмом выбрасывает сундучок → костюм; 100 гаек = жизнь', () => {
  const m = mk('1-1'), S = m.S, LV = S.LV; S.enemies.forEach(e => { e.alive = false; });
  const crates = Object.entries(LV.crates).map(([k, c]) => ({ idx: +k, c, tx: +k % LV.w, ty: Math.floor(+k / LV.w) }));
  const nutC = crates.find(c => c.c.k === 'nut'), suitC = crates.find(c => c.c.k === 'suit');
  S.hero.x = nutC.tx * T + 8; S.hero.y = 16 * T; S.hero.vx = 0;
  const n0 = S.nuts; run(m.game, 0.5, 0, 0, true); eq(S.nuts, n0 + 1, 'гайка'); eq(L.tileAt(LV, nutC.tx, nutC.ty), 'u', 'ящик пуст');
  S.hero.x = suitC.tx * T + 8; S.hero.y = 16 * T; S.hero.vx = 0; S.hero.vy = 0; m.game.update(DT); m.game.setInput(0, 0, true); for (let i = 0; i < 30; i++) m.game.update(DT);
  ok(m.ev.some(e => e.t === 'crate' && e.d.k === 'suit' && e.d.suit === 'boots'), 'сундучок выпал'); eq(L.tileAt(LV, suitC.tx, suitC.ty), 'u');
  for (let i = 0; i < 150 && !S.hero.suit; i++){ const q = S.pickups[0]; if (q && q.t > 0.3) { S.hero.x = q.x; S.hero.y = q.y; } m.game.setInput(0, 0, false); m.game.update(DT); }
  eq(S.hero.suit, 'boots'); ok(m.has('suit'));
  const m2 = mk('1-4'), LV2 = m2.S.LV, multi = Object.entries(LV2.crates).find(([k, c]) => c.n === 6), mi = +multi[0];
  for (let i = 0; i < 8; i++) m2.game._bump(mi % LV2.w, Math.floor(mi / LV2.w));
  eq(m2.S.nuts, 6, 'шесть гаек'); eq(L.tileAt(LV2, mi % LV2.w, Math.floor(mi / LV2.w)), 'u');
  const m3 = mk('1-1', {}, { lives: 3, nuts: 99, score: 0 }); m3.S.enemies.forEach(e => { e.alive = false; }); m3.S.hero.x = nutC.tx * T + 8; m3.S.hero.y = 16 * T; run(m3.game, 0.5, 0, 0, true);
  eq(m3.S.nuts, 0); eq(m3.S.lives, 4, '+жизнь за сотню'); ok(m3.has('life'));
});
test('хрупкие коробы: ломает удар панцирем о землю (и заклёпки), обычный прыжок — нет', () => {
  const m = mk('1-4', {}, { lives: 5, nuts: 0, score: 0, suit: 'armor' }), S = m.S, LV = S.LV;
  let bx = -1, by = -1; for (let ty = 0; ty < LV.h && bx < 0; ty++) { const i = LV.t[ty].indexOf('x'); if (i >= 0) { bx = i; by = ty; } }
  S.hero.x = bx * T + 8; S.hero.y = (by - 3) * T; S.hero.vy = 0; S.hero.ground = false;
  m.game.setInput(0, 1, false); m.game.update(DT); run(m.game, 0.5);
  ok(m.has('quake') && m.has('break'), 'удар о землю'); eq(L.tileAt(LV, bx, by), '.', 'короб разбит');
});
test('часовня: колокол выше — больше очков; касание столба без колокола — малый звон; уровень пройден', () => {
  const res = [];
  for (const hit of ['low', 'high', 'post']){
    const m = mk('1-1'), S = m.S, P = S.hero;
    if (hit === 'post'){ S.time = Math.PI / 2.1 - 0.3; P.x = S.bell.x - 20; P.y = S.bell.gy; run(m.game, 1, 1, 0, false); }
    else { S.time = hit === 'high' ? Math.PI / 2.1 - DT : -DT; m.game.update(DT); const by = S.bell.y; P.x = S.bell.x - 8; P.y = by + 12; P.vy = -10; P.ground = false; m.game.setInput(0, 0, true); m.game.update(DT); }
    run(m.game, 2.5); const b = m.last('bell'); ok(b, hit); ok(m.has('clear'), 'пройден ' + hit); res.push(b.d);
  }
  ok(res[0].hit && res[1].hit && !res[2].hit, 'колокол задет'); ok(res[1].pts > res[0].pts, 'выше — больше: ' + res[0].pts + ' < ' + res[1].pts); eq(res[2].pts, L.PTS.bell[0]); eq(L.PTS.bell[5], 5000);
});
test('тайная дверь: без ключа не открывается, с ключом ↑ у двери — тайный выход', () => {
  const m = mk('1-3'), S = m.S, LV = S.LV, D = LV.door;
  S.hero.x = D.tx * T + 8; S.hero.y = (D.ty + 1) * T; run(m.game, 0.3, 0, -1); eq(S.phase, 'play', 'без ключа');
  const key = LV.items.find(i => i.k === 'key'); S.hero.x = key.tx * T + 8; S.hero.y = (key.ty + 1) * T; run(m.game, 0.1); ok(S.keyGot, 'ключ');
  S.hero.x = D.tx * T + 8; S.hero.y = (D.ty + 1) * T; S.hero.vx = 0; run(m.game, 0.3, 0, -1); eq(S.phase, 'clear'); run(m.game, 2);
  const c = m.last('clear'); ok(c && c.d.secret, 'тайный выход');
});
test('крепость: хозяин спит до входа на арену; 3 прыжка на голову (или 9 заклёпок) — крепость взята', () => {
  const m = mk('1-F'), S = m.S, B = S.boss; ok(B && B.st === 'sleep');
  S.hero.x = S.LV.arenaX + 60; S.hero.y = 16 * T; run(m.game, 0.2); ok(m.has('bossIntro') && B.st !== 'sleep');
  for (let h = 0; h < 3; h++){ B.inv = 0; S.hero.x = B.x; S.hero.y = B.y - B.h - 6; S.hero.vy = 200; S.hero.ground = false; S.hero.inv = 1; m.game.setInput(0, 0, false); for (let i = 0; i < 6; i++) m.game.update(DT); }
  ok(!B.alive && m.has('bossDown'), 'взята: hp ' + B.hp); run(m.game, 2); const c = m.last('clear'); ok(c && c.d.boss);
  const m2 = mk('1-F', {}, { lives: 5, nuts: 0, score: 0, suit: 'apron', suitHp: 2 }), S2 = m2.S, B2 = S2.boss; S2.hero.x = S2.LV.arenaX + 60; S2.hero.y = 16 * T; run(m2.game, 0.1);
  for (let k = 0; k < 3; k++){ B2.inv = 0; for (let j = 0; j < 3; j++) S2.rivets.push({ x: B2.x, y: B2.y - 10, vx: 0, vy: 0, t: 0, b: 0 }), m2.game.update(DT); }
  eq(B2.hp, B2.hpMax - 3, 'по 3 заклёпки на удар');
});
test('стычка с бродягой: сбить всех — победа (+очки, +15 гаек)', () => {
  const m = mk('2-A', { god: true }), S = m.S; eq(S.enemies.length, 5);
  S.enemies.forEach(e => { e.alive = false; }); run(m.game, 0.1); ok(m.has('ambushWon')); run(m.game, 2); ok(m.last('clear').d.ambush);
});
test('мини-игры: лавка — три разных приза; рычаг — одна верная из 4, две попытки; призы применяются', () => {
  const rng = L.mulberry32(3);
  for (let i = 0; i < 20; i++){ const b = SK.mini.shop(rng); eq(b.length, 3); eq(new Set(b.map(x => x.k)).size, 3); ok(L.SUITS.includes(b.find(x => x.k === 'suit').suit)); }
  const G = SK.mini.lever(rng); eq(G.n, 4); const wrong = [0, 1, 2, 3].filter(i => i !== G.good);
  eq(SK.mini.pull(G, wrong[0]), 'miss'); eq(SK.mini.pull(G, wrong[0]), null, 'тот же рычаг'); eq(SK.mini.pull(G, wrong[1]), 'lose'); eq(SK.mini.pull(G, G.good), null, 'попытки кончились');
  const G2 = SK.mini.lever(rng); eq(SK.mini.pull(G2, G2.good), 'win');
  const c = { lives: 3, nuts: 90, suit: null, suitHp: 1 }; SK.mini.apply(c, { k: 'nuts', n: 20 }); eq(c.nuts, 10); eq(c.lives, 4); SK.mini.apply(c, { k: 'suit', suit: 'apron' }); eq(c.suit, 'apron'); eq(c.suitHp, 2); SK.mini.apply(c, { k: 'life' }); eq(c.lives, 5);
});

// ---------- сохранение ----------
function memLS(init = {}){ const m = Object.assign({}, init); return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
test('сохранение: пустое → чистая карта; запись/чтение; итог уровня, тайный выход, стычка', () => {
  const ls = memLS(), st = SK.save.store(ls); const p = st.load();
  eq(p.at, '1-1'); eq(p.lives, 5); eq(Object.keys(p.cleared).length, 0); eq(p.wand[1].at, '1-3');
  SK.save.apply(p, '1-1', {}); SK.save.apply(p, '1-3', { secret: true }); SK.save.apply(p, '1-A', {}); p.lives = 7; p.nuts = 42; p.suit = 'wings'; p.at = '1-3'; st.save(p);
  const q = SK.save.store(ls).load();
  ok(q.cleared['1-1'] && q.cleared['1-3'] && q.secret['1-3']); ok(!q.cleared['1-A'], 'стычка — не уровень'); eq(q.wand[1].dead, 1); eq(q.lives, 7); eq(q.nuts, 42); eq(q.suit, 'wings');
  eq(q.at, '1-1', 'закрытый узел 1-3 (нет 1-2) → 1-1');
  const st2 = SK.save.stats(q); eq(st2.cleared, 2); eq(st2.secret, 1); eq(st2.total, 24);
});
test('сохранение: миграция черновика v1 (ключ arcade.skok.map) → v2 в arcade.save.skok, старый ключ удалён; мусор и будущая версия — чистая карта', () => {
  const ls = memLS({ 'arcade.skok.map': JSON.stringify({ v: 1, done: ['1-1', '1-2', '9-9'], doors: ['1-2', '1-3'], node: '1-2', lives: 4, nuts: 17 }) });
  const p = SK.save.store(ls).load();
  ok(p.cleared['1-1'] && p.cleared['1-2'] && !p.cleared['9-9'], 'чужие id отброшены'); ok(p.secret['1-2'] && !p.secret['1-3'], 'тайный — только у пройденного');
  eq(p.at, '1-2'); eq(p.lives, 4); eq(p.nuts, 17);
  ok(!('arcade.skok.map' in ls._m), 'старый ключ удалён'); eq(JSON.parse(ls._m['arcade.save.skok']).v, 2);
  eq(SK.save.parse('{"v":9}').at, '1-1'); eq(SK.save.parse('не json').lives, 5); eq(SK.save.migrate({ v: 2, cleared: {}, suit: 'cape', lives: -3 }).suit, null);
  eq(SK.save.migrate({ v: 2, cleared: {}, lives: -3 }).lives, 1);
  const ls2 = memLS({ 'arcade.save.skok': JSON.stringify({ v: 1, done: ['1-1'], node: '1-1' }) }); const p2 = SK.save.store(ls2).load(); ok(p2.cleared['1-1']); eq(JSON.parse(ls2._m['arcade.save.skok']).v, 2, 'v1 под новым ключом переписан в v2');
});

// ---------- музыка, i18n, правило имён ----------
test('музыка: оригинальный трек skok подключается по gameId; карта, крепость, мини-игры', () => {
  const Tk = sandbox.Arcade.tracks.skok; ok(Tk && Tk.bpm > 0 && Tk.melody && Tk.bass && Tk.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(Tk.melody) % 8, 0); eq(n(Tk.bass) % 8, 0);
  ['map', 'fort', 'game'].forEach(k => ok(SK.MUSIC[k] && SK.MUSIC[k].melody, k));
});
test('i18n: у RU и EN одинаковые ключи; есть названия всех уровней, узлов, костюмов, хозяев крепостей', () => {
  const ru = Object.keys(SK.STR.ru).sort(), en = Object.keys(SK.STR.en).sort(); eq(ru.join(','), en.join(','));
  LV_.ids.forEach(id => ok(SK.STR.ru['n_' + id] && SK.STR.en['n_' + id], id));
  MAP.NODES.forEach(n => ok(SK.STR.ru['n_' + n.id], n.id));
  L.SUITS.forEach(s => ok(SK.STR.ru['s_' + s] && SK.STR.ru['sd_' + s], s));
  Object.values(LV_.BOSS).forEach(b => ok(SK.STR.ru['b_' + b] && SK.STR.en['b_' + b], b));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifG1hcmlvKD8hbil80LzQsNGA0LjQvig/IdC9KXxsdWlnaXzQu9GD0LjQtNC20Lh8Ym93c2VyfNCx0L7Rg9C30LXRgHzQsdCw0YPQt9C10YB8a29vcGF8KD88IVvQsC3Rj9GRXSnQutGD0L/QsCg/IVvQsC3Rj9GRXSl8Z29vbWJhfNCz0YPQvNCx0LA=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Скок') && !BAD.test('Гефест') && !BAD.test('марионетка') && !BAD.test('marionette') && !BAD.test('покупатель') && !BAD.test('лавка-лотерея') && !BAD.test('CONTRACT.md'), 'без ложных срабатываний');
  ok(BAD.test(Buffer.from('U3VwZXIgTWFyaW8=', 'base64').toString()) && BAD.test(Buffer.from('0JrRg9C/0LA=', 'base64').toString()), 'новые имена ловятся');
});

// ---------- проходимость (графы по физике) и бот (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графов и бота)'); process.exit(failed ? 1 : 0); }
test('граф проходимости честный: яма в 9 клеток без костюма непроходима', () => {
  const LV = LV_.build('1-1'); LV.t = LV.t.map((r, i) => i >= 16 ? r.slice(0, 40) + '.........' + r.slice(49) : r);
  ok(!passability(SK, LV, null).exit, 'не должно проходиться');
});
test('фартук не меняет физику (граф без костюма покрывает и его)', () => {
  const LV = mini(['....##......../#', '################', '################']), W = { LV };
  const a = L.newHero(30, 15 * T), b = L.newHero(30, 15 * T); b.suit = 'apron';
  for (let i = 0; i < 200; i++){ const inp = { dx: i < 120 ? 1 : 0, dy: 0, jump: (i % 50) < 25 }; L.heroStep(W, a, inp, DT, null); L.heroStep(W, b, inp, DT, null); }
  eq(a.x, b.x); eq(a.y, b.y);
});
for (const suit of [null, 'boots', 'wings', 'armor']){
  test('проходимость: каждый уровень (часовня / арена крепости) проходим ' + (suit ? 'в костюме «' + suit + '»' : 'без костюма') + '; ключ и тайная дверь достижимы', () => {
    for (const id of LV_.ids){
      const LV = LV_.build(id); if (LV.ambush) continue;
      const r = passability(SK, LV, suit);
      ok(r.exit, id + ': выход недостижим (узлов ' + r.reached + '/' + r.nodes + ')');
      if (LV.door){ ok(r.key, id + ': ключ'); ok(r.door, id + ': дверь от ключа'); }
    }
  });
}
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс нажатий ±2–3 кадра, иногда не замечает врага.
test('бот-«человек» проходит 1-1 почти всегда (≥ 85% из 40 партий, 5 жизней)', () => {
  const N = 40, R = []; for (let s = 1; s <= N; s++) R.push(playLevel(SK, '1-1', s));
  const won = R.filter(r => r.won).length, deaths = R.reduce((a, r) => a + r.deaths, 0), tm = R.filter(r => r.won).map(r => r.time);
  console.log('     1-1: ' + won + '/' + N + '; смертей всего ' + deaths + '; время, с: ' + Math.min(...tm).toFixed(0) + '–' + Math.max(...tm).toFixed(0));
  ok(won >= 0.85 * N, 'слишком сложно: ' + won + '/' + N); ok(!R.some(r => r.stuck), 'застрял: ' + R.filter(r => r.stuck).map(r => r.seed));
  ok(deaths > 0, 'не слишком пресно: бот иногда ошибается');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

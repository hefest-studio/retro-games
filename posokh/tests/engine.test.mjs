/* ПОСОХ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node posokh/tests/engine.test.mjs (QUICK=1 — без графов проходимости и партий бота).
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
const PS = sandbox.POSOKH, L = PS.logic, K = L.K, T = L.T, LVS = PS.levels;
const { navFor, passability, playExp, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const DT = 1 / 60;
// мини-уровень из ASCII (ряды снизу, сверху добиваются воздухом до 18)
function mini(rows){ const w = rows[0].length, t = []; for (let i = 0; i < 18 - rows.length; i++) t.push('.'.repeat(w)); const LV = { id: 'mini', w, h: 18, ceil: 0, t: t.concat(rows), marks: [] }; return { LV, g: L.grid(LV) }; }
function sim(W, P, sec, inp, ev){ for (let i = 0; i < Math.round(sec * 60); i++) L.heroStep(W, P, typeof inp === 'function' ? inp(i, P) : inp, DT, ev || null); return P; }
function mk(id, carry, opts = {}){
  const ev = [];
  const game = PS.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts));
  game.start(id, carry || {});
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, up = false, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, up, jump); game.update(DT); } game.setInput(0, false, false); }
function memLS(){ const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }
// поставить героиню стоять на клетку (tx, опора ty) в игре
function stand(r, tx, ty, face = 1){ r.game._place(tx, ty - 1); r.S.hero.face = face; r.S.hero.inv = 99; run(r.game, 0.05); }
function throwNow(r, up = false){ r.S.cool = 0; r.game.setInput(0, up, false); r.game.throwStake(); for (let i = 0; i < 60 && (i === 0 || r.S.darts.length); i++){ r.game.setInput(0, up, false); r.game.update(DT); } }

// ---------- участки ----------
test('маршрут: 5 участков по порядку, у каждого старт, флажки, 3 репера, мягкая порода, тайник, страж с решёткой, арена хозяина', () => {
  eq(LVS.ids.join(), 'mine,swamp,ridge,sunk,tower');
  for (const id of LVS.ids){
    const LV = LVS.build(id);
    eq(LV.t.length, 18); LV.t.forEach(r => eq(r.length, LV.w, id));
    ok(LV.w >= 150, id + ' ширина ' + LV.w);
    ok(LV.start && LV.guardAt && LV.bossAt && LV.arenaX > 0, id);
    ok(LV.flags.length >= 2, id + ' флажки');
    eq(LV.marks.length, LVS.MARKS, id + ' реперы');
    ok(LV.t.join('').split('=').length > 40, id + ' мягкой породы мало');
    ok(LV.t.some(r => r.includes('X')), id + ' решётка стража');
    ok(LV.bossAt.tx > LV.arenaX && LV.guardAt.tx < LV.arenaX, id + ': страж до арены, хозяин в ней');
    ok(LV.t.some(r => r.includes('c')), id + ' тайник');
    ok(LV.total >= 1000, id + ' образцов на ' + LV.total);
    ok(LV.items.some(i => i.k === 'pie'), id + ' термос');
    ok(L.BOSS[LV.boss], id + ' хозяин ' + LV.boss);
  }
  eq(new Set(LVS.EXP.map(e => e.boss)).size, 5, 'у каждого участка свой хозяин');
});

// ---------- физика ----------
const flat = c => mini([c.repeat(40), '#'.repeat(40), '#'.repeat(40)]);
test('физика: прыжок ≈ 4 клетки, отпустил кнопку — ниже; пого (стойки на посохе) больше нет', () => {
  const W = flat('.'); let P = L.newHero(100, 15 * T), top = P.y;
  sim(W, P, 1, (i, p) => { top = Math.min(top, p.y); return { dx: 0, jump: true }; }); const full = 15 * T - top;
  ok(full > 3.9 * T && full < 4.6 * T, 'высота ' + full / T);
  P = L.newHero(100, 15 * T); top = P.y; sim(W, P, 1, (i, p) => { top = Math.min(top, p.y); return { dx: 0, jump: i < 4 }; }); ok(15 * T - top < full * 0.6, 'короткий прыжок');
  ok(!('POGO0' in K) && !('pogo' in L.newHero(0, 0)), 'механики посоха-пружины нет');
});
test('шипы ранят всегда; мостки: снизу проходятся, сверху держат', () => {
  const W = flat('^'); const P = L.newHero(100, 15 * T); let sp = 0; sim(W, P, 0.1, { dx: 0 }, t => { if (t === 'spike') sp++; }); ok(sp > 0, 'шипы ранят');
  const W2 = mini(['...........', '...-----...', '...........', '...........', '#'.repeat(11), '#'.repeat(11), '#'.repeat(11)]);
  const P2 = L.newHero(5 * T + 8, 15 * T); let top = P2.y; sim(W2, P2, 0.5, (i, p) => { top = Math.min(top, p.y); return { dx: 0, jump: i < 30 }; });
  ok(top < 12 * T, 'пролетела снизу'); ok(P2.ground && P2.y === 12 * T, 'стоит на мостках: ' + P2.y / T);
});
// ---------- вехи ----------
// стенка из мягкой породы (=) справа, камень (#) — ещё правее
const wall = () => mini(['..........==....##', '..........==....##', '..........==....##', '..........==....##', '..........==....##', '..........==....##', '..........==....##', '##################', '##################', '##################']);
test('веха: в мягкую породу втыкается вбок — получается ступенька в 2 клетки над полом; с ↑ — под 45° выше', () => {
  const W = wall(); const P = L.newHero(7 * T + 8, 15 * T); P.face = 1;
  const r = L.stakeRay(W, P, false); eq(r.k, 'peg'); eq(r.tx, 9); eq(r.ty, 13);
  const P2 = L.newHero(6 * T + 8, 15 * T); P2.face = 1; const r2 = L.stakeRay(W, P2, true); eq(r2.k, 'peg'); ok(r2.ty < 13, 'вверх — выше: ' + r2.ty);
  const P3 = L.newHero(13 * T + 8, 15 * T); P3.face = 1; const r3 = L.stakeRay(W, P3, false); eq(r3.k, 'clink', 'камень — отскок');
  const P4 = L.newHero(13 * T + 8, 15 * T); P4.face = -1; const r4 = L.stakeRay(W, P4, false); eq(r4.k, 'peg', 'мягкая стена с другой стороны'); eq(r4.tx, 12);
  const P5 = L.newHero(2 * T + 8, 15 * T); P5.face = -1; eq(L.stakeRay(W, P5, false).k, 'clink', 'край мира — камень');
});
test('веха-ступенька держит героиню сверху; лесенка: с вехи бросок вбок даёт следующую на 2 клетки выше', () => {
  const W = wall(); W.g[13][9] = '|';
  const P = L.newHero(8 * T + 8, 15 * T); sim(W, P, 1, (i) => ({ dx: i > 6 && i < 30 ? 1 : 0, jump: i < 30 }));
  ok(P.ground && P.y === 13 * T && P.on === '|', 'стоит на вехе: ' + P.y / T + ' ' + P.on);
  P.face = 1; const r = L.stakeRay(W, P, false); eq(r.k, 'peg'); eq(r.ty, 11, 'следующая ступенька на 2 выше');
});
test('в игре: бросок, полёт, ступенька; не больше трёх вех — четвёртая убирает самую старую', () => {
  const r = mk('mine'), S = r.S, LV = S.LV;
  // мягкая стена обучения: первая '=' в ряду 14
  const wx = LV.t[14].indexOf('='); ok(wx > 0);
  stand(r, wx - 2, 15, 1); throwNow(r); ok(r.has('throw') && r.has('peg'), 'веха воткнута'); eq(S.pegs.length, 1); eq(S.W.g[13][wx - 1], '|');
  for (const tx of [wx - 3, wx - 4, wx - 5]) { stand(r, tx, 15, 1); throwNow(r, true); }
  eq(S.pegs.length, K.PEGS, 'не больше трёх'); ok(r.has('unpeg'), 'старая ушла'); eq(S.W.g[13][wx - 1], '.', 'первая веха исчезла');
  ok(S.throws >= 4);
});
test('веха сбивает врага, ломает треснувший столбик целиком, снимает репер (+1000, один раз)', () => {
  const r = mk('mine'), S = r.S, LV = S.LV;
  const e = S.enemies[0]; stand(r, Math.floor(e.x / T) - 4, Math.round(e.y / T), 1); e.vx = 0; const sc = S.score;
  throwNow(r); ok(!e.alive && r.has('kill'), 'враг сбит'); ok(S.score > sc);
  const m = LV.marks[0]; S.W.g[m.ty][m.tx] = 'Q';
  // бросок прямо в репер: героиня слева на высоте броска
  S.hero = L.newHero((m.tx - 3) * T + 8, m.ty * T + K.STAKE_DY + 6); S.hero.face = 1; S.cool = 0; r.game.throwStake(); run(r.game, 0.5);
  ok(r.has('mark') && S.marks[m.id], 'репер снят'); eq(S.W.g[m.ty][m.tx], 'q');
  const s1 = S.score; S.hero = L.newHero((m.tx - 3) * T + 8, m.ty * T + K.STAKE_DY + 6); S.hero.face = 1; S.cool = 0; r.game.throwStake(); run(r.game, 0.5); eq(S.score, s1, 'второй раз — без очков');
  // треснувший столбик (два c друг над другом) — одна веха
  let cx = -1, cy = -1; for (let y = 0; y < LV.h && cx < 0; y++){ const i = LV.t[y].indexOf('c'); if (i >= 0){ cx = i; cy = y; } }
  ok(cx >= 0); S.hero = L.newHero((cx - 3) * T + 8, (cy + 1) * T + K.STAKE_DY - 8); S.hero.face = 1; S.cool = 0; r.game.throwStake(); run(r.game, 0.5);
  ok(r.has('crack'), 'камень треснул'); ok(!S.W.g.some(row => row.includes('c')) || S.W.g[cy][cx] === '.', 'столбик осыпался'); eq(S.W.g[cy + 1][cx] === 'c', false);
});
test('страж и хозяин: вехи ранят; решётка открыта после стража; арена запирается, после хозяина — тригопункт, взят — участок снят', () => {
  const r = mk('mine', { score: 700 }), S = r.S, LV = S.LV;
  ok(S.W.g.some(row => row.includes('X')));
  S.hero = L.newHero(LV.guardAt.tx * T - 5 * T, (LV.guardAt.ty + 1) * T); S.hero.inv = 99; run(r.game, 0.1); ok(S.guard.awake && r.has('guardWake'));
  for (let k = 0; k < 20 && S.guard.alive; k++){ S.guard.inv = 0; S.hero = L.newHero(S.guard.x - 4 * T, S.guard.y); S.hero.inv = 99; S.hero.face = 1; S.guard.vx = 0; S.cool = 0; r.game.throwStake(); run(r.game, 0.4); }
  ok(!S.guard.alive && r.has('guardDown'), 'страж повержен, hp ' + S.guard.hp); ok(!S.W.g.some(row => row.includes('X')), 'решётка открыта');
  S.hero = L.newHero((LV.arenaX + 5) * T, (LV.h - 3) * T); S.hero.inv = 99; run(r.game, 0.05);
  ok(S.boss.awake && S.W.g.some(row => row.includes('A')), 'арена заперта');
  r.game._killBoss(); ok(S.sign && !S.W.g.some(row => row.includes('A')), 'тригопункт, арена открыта');
  for (let i = 0; i < 120 && S.phase === 'play'; i++){ S.hero.x = S.sign.x; S.hero.y = S.sign.y + 8; r.game.update(DT); }
  eq(S.phase, 'clear'); const res = r.ev.find(e => e.t === 'clear').d; ok(res.won && res.score >= 700 + L.PTS.boss, JSON.stringify(res));
});
test('хозяева: у каждого свой характер (прыжки / плевки / рывки / пике / пар) и он ранит касанием', () => {
  const kinds = new Set();
  for (const id of LVS.ids){
    const r = mk(id), S = r.S, LV = S.LV;
    S.hero = L.newHero((LV.arenaX + 5) * T, (LV.h - 3) * T); S.hero.inv = 99; run(r.game, 6);
    const evs = r.ev.map(e => e.t); for (const t of ['leap', 'shoot', 'dash', 'thud']) if (evs.includes(t)) kinds.add(id + ':' + t);
    ok(S.boss.awake, id);
  }
  ok([...kinds].some(k => k.endsWith('dash')) && [...kinds].some(k => k.endsWith('shoot')) && [...kinds].some(k => k.endsWith('leap')), [...kinds].join());
});
test('жизни: три раны — минус жизнь и возврат к привалу (вехи убраны); жизни кончились — конец игры', () => {
  const r = mk('mine', { lives: 2 }), S = r.S;
  S.pegs.push({ tx: 1, ty: 1 });
  for (let i = 0; i < 3; i++){ S.hero.inv = 0; r.game._hurt(); }
  eq(S.phase, 'dead'); eq(S.lives, 1); run(r.game, 2); eq(S.phase, 'play'); eq(S.hearts, K.HEARTS); eq(S.pegs.length, 0);
  r.game._die('test'); eq(S.phase, 'over'); ok(r.has('gameover') && S.over);
});
test('термос лечит, оберег даёт жизнь; образцы идут в очки', () => {
  const r = mk('mine'), S = r.S;
  S.hearts = 1; const p = S.LV.items.find(i => i.k === 'pie'); S.hero.x = p.tx * T + 8; S.hero.y = (p.ty + 1) * T; run(r.game, 0.05); eq(S.hearts, 2);
  const l = S.LV.items.find(i => i.k === 'life'); const lv = S.lives; S.hero.x = l.tx * T + 8; S.hero.y = (l.ty + 1) * T; run(r.game, 0.05); eq(S.lives, lv + 1);
  const g = S.LV.items.find(i => i.k === 'big'); const s0 = S.score; S.hero.x = g.tx * T + 8; S.hero.y = (g.ty + 1) * T; run(r.game, 0.05); eq(S.score - s0, L.PTS.big);
});
test('снятые реперы при повторе участка уже сняты (q) и очков не дают', () => {
  const r = mk('mine', { marks: [0, 2] }), S = r.S;
  eq(S.W.g[S.LV.marks[0].ty][S.LV.marks[0].tx], 'q'); eq(S.W.g[S.LV.marks[1].ty][S.LV.marks[1].tx], 'Q'); ok(S.marks[0] && S.marks[2] && !S.marks[1]);
});
test('реклама: reviveAd после последней жизни — 1 жизнь у привала; boost — +1 жизнь (до 9)', () => {
  const r = mk('mine', { lives: 1 }); ok(!r.game.reviveAd(), 'в игре — нельзя');
  r.game._die('test'); eq(r.S.phase, 'over');
  ok(r.game.reviveAd()); eq(r.S.phase, 'play'); eq(r.S.lives, 1); ok(!r.S.over);
  ok(r.game.canBoost()); ok(r.game.boost()); eq(r.S.lives, 2); r.S.lives = K.MAXLIVES; ok(!r.game.canBoost());
});

// ---------- сохранение ----------
test('сохранение v2: чистый старт, участки открываются по порядку, реперы копятся, «полная карта», конец жизней сжигает только очки', () => {
  const ls = memLS(), st = PS.save.store(ls);
  ok(!st.has()); const p = st.load(); eq(p.score, 0); eq(p.at, 'mine');
  ok(PS.save.isOpen(p, 'mine') && !PS.save.isOpen(p, 'swamp'));
  PS.save.apply(p, { id: 'mine', won: true, marks: [0, 2], score: 4200, lives: 4 }); st.save(p); ok(st.has());
  const q = st.load(); ok(q.cleared.mine && PS.save.isOpen(q, 'swamp') && !PS.save.isOpen(q, 'ridge')); eq(q.score, 4200); eq(q.lives, 4); eq(q.marks.mine.join(), '0,2');
  PS.save.apply(q, { id: 'mine', won: true, marks: [1], score: 5000 }); eq(q.marks.mine.join(), '0,1,2'); eq(PS.save.markCount(q), 3);
  PS.save.burn(q); eq(q.score, 0); eq(q.lives, 3); ok(q.cleared.mine && q.marks.mine.length === 3, 'пройденное и реперы остались');
  LVS.ids.forEach(id => { q.cleared[id] = 1; q.marks[id] = [0, 1, 2]; }); ok(PS.save.allCleared(q) && PS.save.fullMap(q));
  st.setAch({ fullMap: 1, ends: 1 }); st.wipe(); ok(!st.has()); eq(st.ach().fullMap, 1);
});
test('миграция v1 (прежняя игра: ключи, казна, предметы) → v2: пройденные экспедиции сохранены, остальное сброшено, плашка «обновлена»', () => {
  const ls = memLS(), st = PS.save.store(ls);
  ls.setItem(PS.save.KEY, JSON.stringify({ v: 1, cleared: { mine: 1, tower: 1 }, keys: { mine: 1, tower: 1, swamp: 1 }, items: { gear: 1 }, relics: { lens: 1 }, taken: { mine: [1] }, bank: 23400, lives: 5, at: 'tower' }));
  const p = st.load();
  eq(Object.keys(p.cleared).sort().join(), 'mine,swamp,tower'); eq(p.score, 0); eq(p.lives, 3); eq(p.note, 0, 'показать плашку');
  ok(PS.save.isOpen(p, 'ridge') && PS.save.isOpen(p, 'tower') && !PS.save.isOpen(p, 'sunk'), 'открыты по порядку и пройденные');
  eq(p.at, 'ridge', 'первый непройденный открытый');
  eq(JSON.parse(ls.getItem(PS.save.KEY)).v, 2, 'перезаписано в v2'); ok(!('bank' in JSON.parse(ls.getItem(PS.save.KEY))));
  const p2 = st.load(); eq(p2.note, 0); p2.note = 1; st.save(p2); eq(st.load().note, 1, 'плашка — один раз');
});
test('сохранение: битые данные, чужая версия, мусорные поля — безопасный откат', () => {
  const ls = memLS(), st = PS.save.store(ls);
  ls.setItem(PS.save.KEY, '{oops'); eq(st.load().score, 0); ok(!st.has());
  ls.setItem(PS.save.KEY, JSON.stringify({ v: 99, score: 5 })); eq(st.load().score, 0);
  ls.setItem(PS.save.KEY, JSON.stringify({ v: 2, score: -50, lives: 0, at: 'луна', cleared: { mine: 1, xx: 1 }, marks: { mine: [1, {}, 1, 7, 99] } }));
  const p = st.load(); eq(p.score, 0); eq(p.lives, 3); eq(p.at, 'swamp'); eq(Object.keys(p.cleared).join(), 'mine'); eq(p.marks.mine.join(), '1,7');
  const thr = { getItem(){ throw new Error('x'); }, setItem(){ throw new Error('x'); }, removeItem(){ throw new Error('x'); } };
  const s2 = PS.save.store(thr); eq(s2.load().score, 0); s2.save(p); s2.wipe(); eq(JSON.stringify(s2.ach()), '{}');
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек posokh подключается по gameId; карта и хозяин — свои темы', () => {
  const Tr = sandbox.Arcade.tracks.posokh; ok(Tr && Tr.bpm > 0 && Tr.melody && Tr.bass && Tr.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  for (const tr of [Tr, PS.MUSIC.camp, PS.MUSIC.boss]){ eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); }
  ok(PS.MUSIC.camp !== Tr && PS.MUSIC.boss !== Tr);
});
test('языки: ru/en/tr/es/pt — одинаковые ключи; название RU ПОСОХ, EN/TR/ES/PT POLEMARK; есть участки, хозяева, стражи', () => {
  const S = PS.STR, ks = Object.keys(S.en).sort().join(','); eq(Object.keys(S).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(S[l]).sort().join(','), ks, l);
  eq(S.ru.title, 'ПОСОХ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'POLEMARK', l);
  for (const E of LVS.EXP) for (const k of ['x_' + E.id, 'xd_' + E.id, 'b_' + E.boss, 'bd_' + E.boss, 'g_' + E.guard]) for (const l of Object.keys(S)) ok(S[l][k], l + ' ' + k);
  for (const l of Object.keys(S)) ok(!/пого|pogo|пружин|spring staff/i.test(JSON.stringify(S[l])), l + ': следы прежней механики');
});
test('страница и площадка: engine.js — копия _shared, стик js/stick.js — копия otsek, кнопки ● и веха, menuFit, межстраничная по нажатию', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js синхронизирован');
  eq(fs.readFileSync(path.join(ROOT, 'js/stick.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', 'otsek', 'js', 'stick.js'), 'utf8'), 'stick.js — копия');
  ok(/data-catalog-back/.test(html) && /rel="icon"/.test(html) && /<canvas/.test(html));
  for (const f of ['engine.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/save.js', 'js/game.js', 'js/audio.js', 'js/render.js', 'js/stick.js', 'js/main.js']) ok(html.includes('./' + f), f);
  ok(/data-stick/.test(html) && /id="bThrow"/.test(html) && /data-d="A"/.test(html), 'стик, веха, прыжок');
  ok(!/https?:\/\//.test(html.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '')), 'без внешних URL');
  ok(/ArcadeStick\.create/.test(main) && /stick\.active/.test(main), 'стик'); ok(/menuFit/.test(main), 'menuFit');
  ok(/g\.adBreak\(\)/.test(main) && /g\.adReady\(\)/.test(main), 'межстраничная по нажатию после участка');
  ok(/useRewardedContinue/.test(main) && /useRewardedBonus/.test(main) && /g\.persist\('arcade\.best\.posokh'/.test(main), 'rewarded, облако');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'posokh', boards: ['posokh'], test, ok }); }
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8'), 'i');
  // дополнение для этой игры (оригинал жанра, его герои, правообладатели; с транслитом) — тоже в base64
  const BAD2 = new RegExp(Buffer.from('ZHVjayA/dGFsZXN8c2Nyb29nZXxtYyA/ZHVja3xkaXNuZXl80LTQsNC6ID/RgtC10LnQu9C3fNGB0LrRgNGD0LTQtnzQvNCw0LogP9C00LDQunzQtNC40YHQvdC1W9C50Y9dfNGD0YLQuNC90YvQtSDQuNGB0YLQvtGA0LjQuA==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const txt = fs.readFileSync(f, 'utf8'); for (const B of [BAD, BAD2]){ const m = txt.match(B); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); } }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)) && !BAD2.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  for (const w of ['Ярослава', 'посох', 'веха', 'репер', 'Гефест', 'CONTRACT.md', 'Медные копи', 'Буревестник', 'дискета']) ok(!BAD.test(w) && !BAD2.test(w), 'ложное срабатывание: ' + w);
});


// ---------- проходимость (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графов и бота)'); process.exit(failed ? 1 : 0); }
const NAV = {}, PASS = {};
for (const id of LVS.ids){ const LV = LVS.build(id); NAV[id] = navFor(PS, LV); PASS[id] = passability(PS, LV, NAV[id]); }
test('проходимость: в каждом участке по физике (с вехами) достижимы страж (до решётки) и арена хозяина', () => {
  for (const id of LVS.ids){ const p = PASS[id]; ok(p.guardOk, id + ' страж'); ok(p.bossOk, id + ' арена'); }
});
test('проходимость: все образцы, термосы и обереги достижимы; все 3 репера — с достижимого места броском', () => {
  for (const id of LVS.ids){ const p = PASS[id]; eq(p.itemsOk, p.items, id + ' недоступно: ' + p.missing.map(i => i.k + '@' + i.tx + ',' + i.ty).join(' ')); eq(p.marksOk.length, LVS.MARKS, id + ' реперы'); }
});
test('вехи — ключевая механика: без бросков ни в одном участке не дойти до хозяина, и часть образцов и реперов недоступна', () => {
  for (const id of LVS.ids){ const p = PASS[id]; ok(!p.bossNoPeg, id + ': арена без вех'); ok(p.gemsNoPeg < p.gems, id + ': все образцы без вех'); ok(p.marksNoPeg.length < LVS.MARKS, id + ': все реперы без вех'); }
});
test('тайники: каждый треснувший камень достижим для броска', () => {
  for (const id of LVS.ids){
    const LV = LVS.build(id), p = PASS[id], R = p.all.R;
    for (let y = 0; y < LV.h; y++) for (let x = 0; x < LV.w; x++) if (LV.t[y][x] === 'c'){
      let y0 = y; while (y0 > 0 && LV.t[y0 - 1][x] === 'c') y0--; let y1 = y; while (y1 < LV.h - 1 && LV.t[y1 + 1][x] === 'c') y1++;
      let hit = false; for (let yy = y0; yy <= y1; yy++) hit = hit || (p.nav.crackFrom.get(x + ',' + yy) || []).some(u => R.has(u));
      ok(hit, id + ': камень ' + x + ',' + y);
    }
  }
});

// ---------- партии бота ----------
test('исполнимость: бот без урона проходит каждый участок (вехи, страж, хозяин, тригопункт) в настоящей физике', () => {
  for (const id of LVS.ids){ const r = playExp(PS, id, 1, { god: true, nav: NAV[id], maxT: 400 }); ok(r.won, id + ': ' + JSON.stringify({ t: r.time, stuck: r.stuck, d: r.deaths })); ok(r.throws > 3, id + ' бросков ' + r.throws); }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс нажатий, иногда не замечает врага.
// 30 партий в первом участке маршрута (Медные копи, с обучением). Цель — «часто»: ≥ 70%.
const N = 30, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playExp(PS, 'mine', s, { nav: NAV.mine }));
test('баланс: «человеческий» бот проходит первый участок в ≥ 70% партий, но не без потерь', () => {
  const n = BAL.filter(r => r.won).length, hurts = BAL.reduce((a, r) => a + r.hurts, 0), deaths = BAL.reduce((a, r) => a + r.deaths, 0);
  console.log('     Медные копи: ' + n + '/' + N + ' побед, ран ' + hurts + ', потерь жизни ' + deaths + ', ср. время ' + (BAL.reduce((a, r) => a + r.time, 0) / N).toFixed(0) + ' с');
  ok(n >= 0.7 * N, 'слишком сложно: ' + n + '/' + N); ok(hurts > N, 'слишком легко: ран ' + hurts);
  ok(!BAL.some(r => r.stuck), 'бот завис: ' + BAL.filter(r => r.stuck).map(r => r.seed).join());
});
test('баланс: остальные участки «человеческому» боту тоже по силам (≥ 50% из 8 партий каждый)', () => {
  for (const id of LVS.ids.slice(1)){ let w = 0; for (let s = 1; s <= 8; s++) if (playExp(PS, id, s, { nav: NAV[id] }).won) w++; console.log('     ' + id + ': ' + w + '/8'); ok(w >= 4, id + ': ' + w + '/8'); }
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

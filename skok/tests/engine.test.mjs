/* СКОК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей). Переделка 2026-11: заводной ключ, лебёдки, Верстак.
   Запуск: node skok/tests/engine.test.mjs (QUICK=1 — без графов проходимости и партий бота).
   Логика (js/*.js без DOM) грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/save.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const SK = sandbox.SKOK, L = SK.logic, K = L.K, T = L.T, MAP = SK.MAP, LV_ = SK.levels;
const { passability, playLevel } = await import('./bot.mjs');

// Графы проходимости (4 костюма × все уровни) и 40 партий бота — самая долгая часть файла. Каждая задача — чистая функция уровня
// и seed'а, поэтому их можно считать в отдельных потоках: результат тот же, что подряд. Этот же файл — и поток-исполнитель.
// Потоков — по числу ядер (BOT_THREADS=1 — подряд, как раньше).
const job = ([kind, a, b]) => kind === 'pass' ? passability(SK, LV_.build(a), b) : playLevel(SK, a, b);
if (!isMainThread){
  parentPort.on('message', ([i, j]) => parentPort.postMessage([i, job(j)]));
  await new Promise(() => {});   // поток живёт, пока его не закроет главный
}
function runJobs(jobs){
  const n = Math.max(1, Math.min(jobs.length, +process.env.BOT_THREADS || (os.availableParallelism ? os.availableParallelism() : os.cpus().length)));
  if (n === 1) return Promise.resolve(jobs.map(job));
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length); let next = 0, done = 0; const pool = [];
    const feed = (w) => { if (next < jobs.length){ const i = next++; w.postMessage([i, jobs[i]]); } };
    for (let k = 0; k < n; k++){
      const w = new Worker(new URL(import.meta.url)); pool.push(w);
      w.on('message', ([i, r]) => { out[i] = r; if (++done === jobs.length){ pool.forEach(x => x.terminate()); resolve(out); } else feed(w); });
      w.on('error', (e) => { pool.forEach(x => x.terminate()); reject(e); });
      feed(w);
    }
  });
}

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const DT = 1 / 60;

// мини-уровень из ASCII (для физики): ряды снизу, сверху добиваются воздухом до 18
function mini(rows){ const w = rows[0].length, t = []; for (let i = 0; i < 18 - rows.length; i++) t.push('.'.repeat(w)); return { id: 'mini', r: 1, w, h: 18, t: t.concat(rows), items: [], enemies: [], camps: [], groups: [] }; }
function sim(W, P, sec, inp){ for (let i = 0; i < Math.round(sec * 60); i++) L.heroStep(W, P, typeof inp === 'function' ? inp(i, P) : inp, DT, null); return P; }
function mk(id, opts = {}, carry){
  const ev = [];
  const game = SK.Game(Object.assign({ rng: L.mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts));
  game.startLevel(id, carry);
  const S = game.state();
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, last: t => [...ev].reverse().find(e => e.t === t) };
}
function run(game, sec, dx = 0, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, jump); game.update(DT); } game.setInput(0, false); }
// враг рядом с героем на ровном месте уровня 1-1 (старт): остальных врагов убрать
function withFoe(k, dx = 20, opts = {}){
  const t = mk('1-1', opts); const S = t.S, P = S.hero;
  const D = L.EDEF[k]; S.enemies = [{ id: 0, k, x: P.x + dx, y: P.y, x0: P.x + dx, y0: P.y, vx: 0, vy: 0, dir: -1, hw: D.hw, h: D.h, alive: true, awake: true, t: 0, st: 'walk', stT: 9, ground: true, dead: 0, stop: 0 }];
  P.inv = 0; return t;
}

test('уровни: 4 края × (4 уровня + крепость); ряды одной ширины, старт, деталь/арена, фонарь, лебёдка с механизмом в каждом', () => {
  eq(LV_.ids.length, 20);
  for (const id of LV_.ids){
    const LV = LV_.build(id);
    ok(LV.t.every(r => r.length === LV.w), id + ': ширина рядов'); eq(LV.h, 18);
    ok(LV.start, id + ': старт'); ok(LV.fort ? !LV.exit && LV.boss && LV.enemies.some(e => e.k === 'Z') : !!LV.exit, id + ': финиш');
    ok(LV.camps.length >= 1, id + ': фонарь');
    ok(LV.groups.length >= 1 && LV.groups.every(gr => gr.winch && gr.tiles.length), id + ': лебёдка и механизм');
  }
  for (let r = 1; r <= 4; r++) eq(MAP.region(r).join(','), [1, 2, 3, 4, 'F'].map(n => r + '-' + n).join(','));
});
test('склоны: под каждым «/» и «\\» — твердь, сверху — не твердь', () => {
  for (const id of LV_.ids){ const LV = LV_.build(id);
    for (let y = 0; y < LV.h - 1; y++) for (let x = 0; x < LV.w; x++){ const ch = LV.t[y][x]; if (ch !== '/' && ch !== '\\') continue;
      ok(L.isSolid(L.tileAt(LV, x, y + 1)), id + ' склон без опоры ' + x + ',' + y); ok(!L.isSolid(L.tileAt(LV, x, y - 1)), id + ' над склоном твердь'); } }
});
test('Верстак: открыт только 1-1; уровень открывается после предыдущего, следующий край — после крепости', () => {
  const p = SK.save.blank(); ok(MAP.isOpen(p, '1-1') && !MAP.isOpen(p, '1-2'));
  p.cleared['1-1'] = 1; ok(MAP.isOpen(p, '1-2') && !MAP.isOpen(p, '1-3'));
  ['1-2', '1-3', '1-4'].forEach(id => p.cleared[id] = 1); ok(MAP.isOpen(p, '1-F') && !MAP.isOpen(p, '2-1'));
  p.cleared['1-F'] = 2; ok(MAP.isOpen(p, '2-1')); eq(MAP.next('1-F'), '2-1'); eq(MAP.next('4-F'), null);
});
test('прыжок: высота от удержания (≈4 клетки), без разгона-«бега»: скорость одна', () => {
  const LV = mini(['#'.repeat(40), '#'.repeat(40)]), W = { LV, plats: [] };
  const hi = (hold) => { const P = L.newHero(100, 16 * T); let top = P.y; sim(W, P, 1.2, (i) => { top = Math.min(top, P.y); return { dx: 0, jump: i < hold }; }); return 16 * T - top; };
  const a = hi(4), b = hi(40); ok(b > 60 && b < 72, 'высокий прыжок ' + b); ok(a < b - 25, 'короткое нажатие — ниже: ' + a);
  const P = L.newHero(40, 16 * T); sim(W, P, 2, { dx: 1, jump: false }); eq(Math.round(P.vx), K.RUN, 'одна скорость бега');
});
test('доски — только сверху; шипы ранят; смола и пропасть — гибель', () => {
  const LV = mini(['..........', '...TTTT...', '..........', '..........', '##########', '##########']), W = { LV, plats: [] };
  const P = L.newHero(4 * T + 8, 16 * T); sim(W, P, 0.8, (i) => ({ dx: 0, jump: i < 40 })); eq(P.y, 13 * T, 'встал на доску снизу через доску');
  const LS = mini(['....', '#^^#', '####']); const Q = L.newHero(1 * T + 8, 16 * T); Q.x = 1 * T + 8; Q.y = 16 * T; const W2 = { LV: LS }; L.heroStep(W2, Q, { dx: 0, jump: false }, DT, null); eq(L.hazard(LS, Q), 'spike');
  eq(L.hazard(mini(['.~~.', '####']), Object.assign(L.newHero(24, 17 * T), {})), 'tar');
  eq(L.hazard(LV, Object.assign(L.newHero(24, 20 * T))), 'fall');
});
test('касание заведённого врага ранит с любой стороны — прыжком врага не сбить; 3 сердца, потом минус пружина', () => {
  const t = withFoe('g', 0); run(t.game, 0.05); eq(t.S.hearts, 2, 'сбоку'); ok(t.has('hurt'));
  const u = withFoe('g', 0); u.S.hero.y -= 40; u.S.hero.vy = 200; u.S.hero.ground = false; run(u.game, 0.4);
  ok(u.S.enemies[0].alive, 'враг жив после прыжка сверху'); ok(u.S.hearts < 3, 'сверху — тоже удар');
  const v = withFoe('g', 0); v.game._hurt(); v.S.hero.inv = 0; v.game._hurt(); v.S.hero.inv = 0; v.game._hurt();
  eq(v.S.phase, 'dead'); eq(v.S.lives, K.LIVES - 1);
});
test('ключ: удар останавливает врага (не ранит, служит опорой), второй удар разбирает (+3 гайки); завод кончился — враг пошёл', () => {
  const t = withFoe('g', 16), e = t.S.enemies[0];
  ok(t.game.strike()); ok(e.stop > 4.9, 'остановлен'); ok(t.has('stopE')); eq(t.S.score, L.PTS.stop);
  ok(!t.game.strike(), 'перезарядка ключа'); run(t.game, 0.4);
  e.x = t.S.hero.x; run(t.game, 0.2); eq(t.S.hearts, 3, 'остановленный не ранит');
  const P = t.S.hero; P.y = e.y - e.h - 20; P.vy = 0; P.ground = false; P.inv = 0; run(t.game, 0.5); eq(P.y, e.y - e.h, 'стоит на остановленном');
  P.y = e.y; e.x = P.x + 14; run(t.game, 0.4); ok(t.game.strike()); ok(!e.alive && t.has('dismantle')); eq(t.S.nuts, 3);
  const w = withFoe('m', 16); w.game.strike(); run(w.game, 5.2); ok(w.S.enemies[0].stop === 0 && w.has('rewind'), 'завод кончился');
});
test('ключ: остановленный пружинник — батут; остановленный игольник — не опора; молот и хозяин в ходьбе — «звяк», без вреда', () => {
  const t = withFoe('h', 16), e = t.S.enemies[0]; t.game.strike();
  const P = t.S.hero; P.x = e.x; P.y = e.y - e.h - 30; P.vy = 100; P.ground = false; let minY = 1e9;
  for (let i = 0; i < 50; i++){ t.game.setInput(0, false); t.game.update(DT); minY = Math.min(minY, P.y); }
  ok(t.has('boing') && minY < e.y - e.h - 90, 'подбросило: ' + (e.y - e.h - minY));
  const n = withFoe('n', 16); n.game.strike(); ok(n.S.enemies[0].stop > 0); run(n.game, 0.05); eq(n.S.W.plats.length, 0, 'игольник — не опора');
  const z = withFoe('P', 16); z.S.enemies[0].top = 0; z.S.enemies[0].bottom = 500; z.game.strike(); ok(z.has('clank') && !z.S.enemies[0].stop);
});
test('лебёдка: удар — мост выдвигается звено за звеном, держится 8 с и убирается; пружинная плита заведена — подбрасывает', () => {
  const t = mk('1-1'), gr = t.S.LV.groups[0], P = t.S.hero, LV = t.S.LV;
  P.x = gr.winch.tx * T + 8 - 12; P.y = (gr.winch.ty + 1) * T; P.face = 1; t.game.setInput(0, false); t.game.update(DT);
  ok(t.game.strike() && gr.t > 7.9 && t.has('wind'), 'заведено');
  const bs = gr.tiles.filter(q => q.k === 'b'); run(t.game, 0.12); const ext = bs.filter(q => L.tileAt(LV, q.tx, q.ty) === 'Y').length; ok(ext > 0 && ext < bs.length, 'выдвигается постепенно: ' + ext);
  run(t.game, 1); ok(bs.every(q => L.tileAt(LV, q.tx, q.ty) === 'Y'), 'мост целиком');
  P.x = gr.winch.tx * T + 8 - 40; run(t.game, 7.2); ok(bs.every(q => L.tileAt(LV, q.tx, q.ty) === 'b') && t.has('unwind'), 'убран');
  const s = mk('1-2'), g2 = s.S.LV.groups[0], q = g2.tiles.find(x => x.k === 'S'); ok(q, 'плита в 1-2');
  s.game._wind(0); eq(L.tileAt(s.S.LV, q.tx, q.ty), 'Q');
  const H = s.S.hero; H.x = q.tx * T + 8; H.y = q.ty * T - 30; H.vy = 50; H.ground = false; H.inv = 9; s.S.enemies = []; let minY = 1e9;
  for (let i = 0; i < 40; i++){ s.game.setInput(0, false); s.game.update(DT); minY = Math.min(minY, H.y); }
  ok(q.ty * T - minY > 120, 'подбросило на ' + (q.ty * T - minY));
});
test('короб: удар ключом вскрывает (+3 гайки, +20); гайки и сердце-шестерня собираются', () => {
  const t = mk('1-1'), LV = t.S.LV, P = t.S.hero; t.S.enemies = [];
  let cx = -1, cy = -1; for (let y = 0; y < LV.h && cx < 0; y++) for (let x = 0; x < LV.w; x++) if (LV.t[y][x] === 'x' && L.tileAt(LV, x - 1, y) === '.' && L.isSolid(L.tileAt(LV, x, y + 1))) { cx = x; cy = y; break; }
  ok(cx > 0, 'короб найден'); P.x = cx * T - 6; P.y = (cy + 1) * T; P.face = 1; t.game.update(DT);
  ok(t.game.strike() && L.tileAt(LV, cx, cy) === '.' && t.S.nuts === 3 && t.S.opened === 1, 'вскрыт');
  const n = LV.items.find(i => i.k === 'nut'); P.x = n.tx * T + 8; P.y = n.ty * T + 14; t.game.update(DT); ok(t.S.got[n.id] && t.S.nutsGot === 1);
  const h = mk('1-3'); const hi = h.S.LV.items.find(i => i.k === 'heart'); ok(hi, 'сердце в 1-3'); h.S.hearts = 1; h.S.hero.x = hi.tx * T + 8; h.S.hero.y = hi.ty * T + 14; h.game.update(DT); eq(h.S.hearts, 2);
});
test('деталь-финиш: звёзды — ★ дошёл, ★ все гайки и короба, ★ без ударов; бонус за время', () => {
  const t = mk('1-1'), LV = t.S.LV, P = t.S.hero; t.S.enemies = [];
  P.x = LV.exit.tx * T + 8; P.y = (LV.exit.ty + 1) * T; t.game.update(DT);
  eq(t.S.phase, 'clear'); eq(t.S.ring.stars, 2, 'без ударов, но не все гайки'); ok(t.S.ring.time > 0, 'бонус за время');
  run(t.game, 1.7); const c = t.last('clear'); ok(c && c.d.stars === 2 && c.d.score === t.S.score);
  const u = mk('1-1'); u.S.enemies = []; u.S.nutsGot = u.S.LV.nuts; u.S.opened = u.S.LV.crates; u.S.hits = 1; u.S.hero.x = P.x; u.S.hero.y = P.y; u.game.update(DT); eq(u.S.ring.stars, 2);
  const w = mk('1-1'); w.S.enemies = []; w.S.nutsGot = w.S.LV.nuts; w.S.opened = w.S.LV.crates; w.S.hero.x = P.x; w.S.hero.y = P.y; w.game.update(DT); eq(w.S.ring.stars, 3);
});
test('крепость: хозяин спит до арены; ключ берёт его только пока он подзаводится; после удара отскакивает; побеждён — уровень пройден', () => {
  const t = mk('1-F'), B = t.S.boss, P = t.S.hero, LV = t.S.LV; ok(B && B.st === 'sleep');
  P.x = LV.arenaX + 60; P.y = 16 * T; run(t.game, 0.1); eq(B.st, 'walk'); ok(t.has('bossIntro'));
  P.inv = 99; B.x = P.x + 16; B.st = 'walk'; P.face = 1; t.game.strike(); eq(B.hp, B.hpMax, 'в ходьбе — без вреда'); ok(t.has('clank'));
  for (let k = 0; k < B.hpMax; k++){ run(t.game, 0.7); B.st = 'wind'; B.stT = 2; B.inv = 0; B.x = P.x + 16; B.y = P.y; P.face = 1; ok(t.game.strike(), 'удар'); }
  ok(!B.alive && t.S.phase === 'clear' && t.S.ring.boss, 'побеждён');
});
test('пружины: конец — game over; «ещё шанс» за рекламу — 3 пружины с фонаря; бонус — все сердца', () => {
  const t = mk('1-1', {}, { lives: 1 }); t.S.enemies = []; t.game._die('test'); run(t.game, 1.8); eq(t.S.phase, 'over'); ok(t.has('gameover'));
  ok(t.game.revive()); eq(t.S.phase, 'play'); eq(t.S.lives, 3); eq(t.S.hearts, 3); ok(!t.game.revive(), 'только из over');
  t.S.hearts = 1; ok(t.game.canBoost() && t.game.boost()); eq(t.S.hearts, 3); ok(!t.game.canBoost());
});
test('сохранение v3: пустое; итог уровня (звёзды — лучшие, рекорд уровня — лучший), сумма рекордов', () => {
  const p = SK.save.blank(); eq(p.v, 3); ok(SK.save.apply(p, '1-1', 2, 3000)); ok(!SK.save.apply(p, '1-1', 1, 2000)); eq(p.cleared['1-1'], 2); eq(p.best['1-1'], 3000);
  SK.save.apply(p, '1-2', 3, 4500); eq(SK.save.total(p), 7500); const q = SK.save.parse(SK.save.serialize(p)); eq(JSON.stringify(q), JSON.stringify(p));
  const st = SK.save.stats(p); eq(st.cleared, 2); eq(st.stars, 5); eq(st.maxStars, 60);
});
test('сохранение: миграция v2 (карта до переделки) → v3 — уровни 1–4 и крепости переносятся до первой «дыры», 5-е уровни убраны, сообщение', () => {
  const old = { v: 2, cleared: { '1-1': 1, '1-2': 1, '1-3': 1, '1-4': 1, '1-5': 1, '1-F': 1, '2-1': 1, '2-3': 1 }, secret: { '1-3': 1 }, played: { '1-S': 1 }, wand: {}, at: '2-1', lives: 7, nuts: 40, suit: 'apron', suitHp: 2, score: 99999 };
  const p = SK.save.migrate(old); ok(p.migrated); eq(Object.keys(p.cleared).join(','), '1-1,1-2,1-3,1-4,1-F,2-1'); eq(JSON.stringify(p.best), '{}');
  const mem = new Map([['arcade.skok.map', JSON.stringify({ v: 1, done: ['1-1', '1-2'], doors: [], node: '1-2', lives: 3, nuts: 5 })]]);
  const ls = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const st = SK.save.store(ls), q = st.load(); ok(q.migrated && q.cleared['1-2'] && !mem.has('arcade.skok.map'), 'черновой ключ v1 перенесён');
  eq(JSON.parse(mem.get(SK.save.KEY)).v, 3, 'записан v3');
  eq(JSON.stringify(SK.save.parse('мусор')), JSON.stringify(SK.save.blank())); eq(JSON.stringify(SK.save.parse('{"v":9}')), JSON.stringify(SK.save.blank()));
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/arcade\.skok\.oldBest/.test(main) && /g\.t\('migrated'\)/.test(main), 'прежний рекорд уходит в историю, сообщение на титуле');
});
test('узнаваемость (переделка 2026-11): нет прыжка-по-врагам, костюмов, ударов головой по ящикам, карты мира с мини-играми, финиша-столба', () => {
  const code = ['js/game.js', 'js/levels.js', 'js/main.js', 'js/render.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  for (const w of ['stomp', 'combo', 'suit', 'apron', 'wings', 'armor', 'boots', 'bump(', 'bell', 'chapel', 'shop', 'lever', 'wander', 'ambush', 'slide', 'pound', 'rivet']) ok(!code.includes(w), 'осталось: ' + w);
});
test('музыка: оригинальный трек skok подключается по gameId; Верстак, крепость', () => {
  ok(sandbox.Arcade.tracks.skok && SK.MUSIC.level === sandbox.Arcade.tracks.skok && SK.MUSIC.map && SK.MUSIC.fort);
});
test('языки: ru/en/tr/es/pt — одинаковые ключи; RU СКОК, EN/TR/ES/PT KEYWINDER; названия уровней, краёв, хозяев', () => {
  const S = SK.STR, ks = Object.keys(S.ru).sort().join(','); eq(Object.keys(S).join(','), 'ru,en,tr,es,pt');
  for (const l of ['en', 'tr', 'es', 'pt']) eq(Object.keys(S[l]).sort().join(','), ks, l);
  eq(S.ru.title, 'СКОК'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'KEYWINDER', l);
  for (const l of Object.keys(S)){ LV_.ids.forEach(id => ok(S[l]['n_' + id], l + ' ' + id)); Object.values(LV_.BOSS).forEach(b => ok(S[l]['b_' + b], l + ' ' + b)); }
});
test('страница: фавикон студии, «← Каталог», canvas 512×288, скрипты по порядку, ◀ ▶ ● ⚙ II; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон'); ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="512" height="288"/.test(html), 'canvas');
  eq([...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]).join(','), 'engine.js,js/music.js,js/i18n.js,js/levels.js,js/save.js,js/game.js,js/audio.js,js/render.js,js/main.js');
  ok(/data-d="L"/.test(html) && /data-d="R"/.test(html) && /data-d="A"/.test(html) && /id="bKey"/.test(html) && /id="bPause"/.test(html), 'кнопки');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'нет внешних ссылок');
});
test('площадка: ещё шанс и бонус за рекламу, межстраничная между уровнями по нажатию, облако прогресса, menuFit', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/g\.useRewardedContinue\(\{ revive/.test(main) && /g\.useRewardedBonus\(\{ key: 'rwHeart'/.test(main), 'реклама за награду');
  ok(/g\.adBreak\(\)/.test(main) && /function finishResult/.test(main), 'adBreak');
  ok(/g\.persist\(SK\.save\.KEY, 'last'\)/.test(main) && /g\.persist\('arcade\.best\.skok', 'max'\)/.test(main), 'облако');
  ok(/menuFit/.test(main), 'menuFit');
});
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'skok', boards: ['skok'], test, ok }); }
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifG1hcmlvKD8hbil80LzQsNGA0LjQvig/IdC9KXxsdWlnaXzQu9GD0LjQtNC20Lh8Ym93c2VyfNCx0L7Rg9C30LXRgHzQsdCw0YPQt9C10YB8a29vcGF8KD88IVvQsC3Rj9GRXSnQutGD0L/QsCg/IVvQsC3Rj9GRXSl8Z29vbWJhfNCz0YPQvNCx0LA=', 'base64'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Скок') && !BAD.test('Гефест') && !BAD.test('KEYWINDER') && !BAD.test('Верстак') && !BAD.test('CONTRACT.md'), 'без ложных срабатываний');
  ok(BAD.test(Buffer.from('U3VwZXIgTWFyaW8=', 'base64').toString()) && BAD.test(Buffer.from('0JrRg9C/0LA=', 'base64').toString()), 'новые имена ловятся');
});

// ---------- проходимость (графы по физике) и бот (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графов и бота)'); process.exit(failed ? 1 : 0); }
test('граф проходимости честный: пропасть 10 клеток без моста непроходима', () => {
  const LV = mini(['..........................', '##########..........######', '##########..........######']); LV.start = { tx: 2, ty: 16 }; LV.exit = { tx: 22, ty: 16 };
  ok(!passability(SK, LV, false).exit, 'не должно проходиться');
});
const N = 6, JOBS = [...LV_.ids.flatMap(id => [['pass', id, true], ['pass', id, false]]), ...LV_.ids.flatMap(id => Array.from({ length: N }, (_, i) => ['play', id, i + 1])), ...Array.from({ length: 34 }, (_, i) => ['play', '1-1', N + i + 1])];
const RES = await runJobs(JOBS), resOf = (kind, a, b) => RES[JOBS.findIndex(j => j[0] === kind && j[1] === a && j[2] === b)];
test('проходимость (графы «по-человечески» надёжных прыжков): с заводом каждый уровень проходим и все лебёдки достижимы; без завода — нет (механика обязательна)', () => {
  for (const id of LV_.ids){
    const a = resOf('pass', id, true), b = resOf('pass', id, false);
    ok(a.exit, id + ': выход недостижим (узлов ' + a.reached + '/' + a.nodes + ')'); ok(a.winches.every(Boolean), id + ': лебёдка недостижима');
    ok(!b.exit, id + ': проходится без ключа'); ok(b.winches[0], id + ': первая лебёдка недостижима без завода');
  }
});
test('баланс: бот-«человек» (реакция 150–250 мс, 5 пружин) проходит каждый из 20 уровней (≥ 5 из ' + N + ' партий) и 1-1 почти всегда', () => {
  let deaths = 0;
  for (const id of LV_.ids){
    const R = Array.from({ length: N }, (_, i) => resOf('play', id, i + 1)), won = R.filter(r => r.won).length; deaths += R.reduce((a, r) => a + r.deaths, 0);
    ok(won >= N - 1, id + ': ' + won + '/' + N); ok(!R.some(r => r.stuck), id + ': застрял ' + R.filter(r => r.stuck).map(r => r.seed));
    ok(R.some(r => r.stops > 0) || LV_.build(id).enemies.every(e => e.k === 'P' || e.k === 'Z'), id + ': бот ни разу не остановил врага');
  }
  const R1 = Array.from({ length: N + 34 }, (_, i) => resOf('play', '1-1', i + 1)), w1 = R1.filter(r => r.won).length;
  console.log('     1-1: ' + w1 + '/' + R1.length + '; смертей на всех уровнях: ' + deaths);
  ok(w1 >= 0.85 * R1.length, '1-1: ' + w1); ok(deaths > 0, 'не слишком пресно: бот иногда ошибается');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

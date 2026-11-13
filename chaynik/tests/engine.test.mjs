/* ЧАЙНИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node chaynik/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// шим DOM для рендера: canvas с «пустым» 2D-контекстом (Proxy) — считаем вызовы рисования
const calls = { n: 0 };
const fakeCtx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.n++; }, set: (o, k, v) => { o[k] = v; return true; } });
const sandbox = { console, Math, setTimeout: () => 0, setInterval: () => 0, clearInterval(){}, document: { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['engine.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/audio.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const CH = sandbox.CHAYNIK, L = CH.logic, LVL = CH.levels, K = L.K, T = LVL.T, C = LVL.C, PZ = CH.puzzle, dt = 1 / 60;
const { playLevel, playRace, playPuzzle, playFly, playBoss, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function mk(level = 1, opts = {}){
  const ev = [];
  const game = CH.Game(Object.assign({ seed: 1, level, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  return { game, S: game.state(), LV: game.level(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, last: t => [...ev].reverse().find(e => e.t === t) };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(inp); game.update(dt); } }
function noFoes(S){ S.enemies = []; }

// ---------- структура ----------
test('6 уровней, у каждого свой жанр-гэг: plat, race, plat(вода), puzzle, fly, boss', () => {
  eq(LVL.COUNT, 6); eq(Object.values(LVL.KINDS).join(','), 'plat,race,plat,puzzle,fly,boss');
  const l1 = LVL.build(1), l3 = LVL.build(3), l6 = LVL.build(6);
  ok(l1.hooks.length >= 8 && l1.taps.length >= 3 && l1.magnets.length >= 2 && l1.cycle.length >= 2, 'уровень 1: вилки-лианы, краны, магниты, мигающие конфорки');
  ok(l1.t.some(v => v === C.F) && l1.t.some(v => v === C.X), 'конфорки и вилки-шипы'); ok(l1.cps.length >= 4 && l1.goal, 'чекпойнты и финиш');
  ok(l3.water && l3.bubbles.length >= 4 && l3.surface > 0 && l3.goal.k === 'raft', 'уровень 3: вода, пузыри, плотик');
  ok(l6.arena && l6.hooks.length === 5 && l6.taps.length === 2, 'уровень 6: арена с крюками и кранами');
  ok(L.TRACK.len >= 9000 && L.TRACK.obs.filter(o => o.k === 'hole').length >= 4, 'трасса гонки с прорехами');
  ok(LVL.FLY.waves.length >= 25 && LVL.FLY.waves.some(w => w.k === 'cloud'), 'полёт: волны и облака холода');
});
test('детерминизм и snapshot/restore: одинаковый сид → одинаковое состояние; восстановление — точная копия', () => {
  const a = mk(1), b = mk(1); run(a.game, 3, { x: 1, fire: true }); run(b.game, 3, { x: 1, fire: true });
  eq(a.game.snapshot(), b.game.snapshot());
  const snap = a.game.snapshot(); run(a.game, 1, { x: -1, jump: true }); a.game.restore(snap); eq(a.game.snapshot(), snap);
});

// ---------- физика ----------
test('физика: бег ≈ 170 px/с, прыжок ≈ 5,6 клетки (90 px), короткий прыжок ниже', () => {
  const { game, S } = mk(1); noFoes(S); game._place(5 * T, 18 * T);
  run(game, 0.3); run(game, 1, { x: 1 }); ok(Math.abs(S.hero.vx - K.RUN) < 1, 'vx ' + S.hero.vx);
  game._place(5 * T, 18 * T); run(game, 0.2); let top = 1e9; for (let i = 0; i < 60; i++){ game.setInput({ jump: true }); game.update(dt); top = Math.min(top, S.hero.y); }
  const full = 18 * T - top; ok(full > 84 && full < 96, 'высота ' + full);
  game._place(5 * T, 18 * T); run(game, 0.3); top = 1e9; for (let i = 0; i < 60; i++){ game.setInput({ jump: i < 4 }); game.update(dt); top = Math.min(top, S.hero.y); }
  ok(18 * T - top < full * 0.6, 'короткий ' + (18 * T - top));
});

// ---------- пар, перегрев, кипяток ----------
test('перегрев: держим пар ≈ 2,4 с → ПЕРЕГРЕВ, струя гаснет; остывание до 25 % — снова можно', () => {
  const { game, S, has } = mk(1); noFoes(S); game._place(8 * T, 18 * T);
  let t = 0; while (!S.over && t < 5){ game.setInput({ fire: true }); game.update(dt); t += dt; }
  ok(S.over && has('overheat'), 'перегрев'); ok(t > 2 && t < 2.8, 'время до перегрева ' + t.toFixed(2));
  S.puffs = []; run(game, 0.3, { fire: true }); eq(S.puffs.length, 0, 'при перегреве пар не идёт');
  let c = 0; while (S.over && c < 5){ game.setInput({}); game.update(dt); c += dt; }
  ok(!S.over && has('cooled') && S.heat <= K.HEAT_RESUME + 0.01, 'остыл за ' + c.toFixed(2));
  run(game, 0.1, { fire: true }); ok(S.puffs.length > 0, 'снова пар');
});
test('остужение у крана: под краном перегрев проходит в разы быстрее', () => {
  const cool = (atTap) => { const { game, S, LV } = mk(1); noFoes(S); const tp = LV.taps[0]; game._place(atTap ? tp.x : 8 * T, atTap ? 18 * T : 18 * T); S.heat = 1; S.over = true; let t = 0; while (S.over && t < 9){ game.setInput({}); game.update(dt); t += dt; } return t; };
  const slow = cool(false), fast = cool(true); ok(fast * 2 < slow, 'у крана ' + fast.toFixed(2) + ' с, без — ' + slow.toFixed(2) + ' с');
});
test('кипяток: только по полному заряду, тратит заряд и греет; чайный лист даёт треть заряда', () => {
  const { game, S, has, count } = mk(1); noFoes(S); game._place(8 * T, 18 * T);
  game._charge(0.5); run(game, 0.05, { boil: true }); ok(has('noCharge') && !has('boil'));
  game._charge(1); run(game, 0.1); run(game, 0.05, { boil: true }); eq(count('boil'), 1); ok(S.charge < 0.05 && S.heat >= K.BOIL_HEAT - 0.05, 'заряд ' + S.charge + ' жар ' + S.heat);
  ok(S.puffs.some(p => p.boil), 'летит струя кипятка');
  const lf = mk(1); lf.game._charge(0); const it = lf.LV.items.find(i => i.k === 'leaf'); lf.game._place(it.x, it.y + 12); run(lf.game, 0.05); ok(Math.abs(lf.S.charge - K.LEAF) < 0.02, 'лист: ' + lf.S.charge);
});
test('кипяток сильнее струи: тостер (4 ед.) падает с одного кипятка, от одного облачка пара — нет', () => {
  const { game, S } = mk(1); const ts = S.enemies.find(e => e.k === 'toaster'); S.enemies = [ts];
  game._place(ts.x - 90, ts.y); S.hero.face = 1; ts.cd = 99; game._charge(1);
  run(game, 0.06, { fire: true }); run(game, 0.3); ok(!ts.dead && ts.hp < 4, 'пар только щиплет: ' + ts.hp);
  run(game, 0.05, { boil: true }); run(game, 0.4); ok(ts.dead, 'кипяток уничтожил');
});
test('магнит: подтягивает, касание — «прилип» (смерть); кипяток размагничивает', () => {
  const { game, S, LV, last } = mk(1); noFoes(S); const m = LV.magnets[0];
  game._place(m.x + 20, m.y + 64); S.hero.ground = false; run(game, 1.5); eq(S.phase, 'dead'); eq(last('die').d.kind, 'magnet');
  const b = mk(1); noFoes(b.S); const m2 = b.LV.magnets[0]; b.game._place(m2.x - 6, 18 * T); b.S.hero.face = 1; b.game._charge(1); run(b.game, 0.2);
  b.game.setInput({ boil: true, y: -1 }); b.game.update(dt); run(b.game, 0.5, { y: -1 });   // кипятком вверх
  ok(b.S.magOff[m2.id] && b.has('demag'), 'размагничен');
  b.game._place(m2.x + 20, m2.y + 64); b.S.hero.ground = false; run(b.game, 1); eq(b.S.phase, 'play', 'выключенный магнит не тянет');
});
test('конфорка: ожог −1 и подброс; последний ожог — смерть «выкипел»', () => {
  const { game, S, has, last } = mk(1); noFoes(S); const c = 44; game._place(c * T + 8, 20 * T - 2);
  run(game, 0.05); ok(has('scald') && S.hero.hp === 2 && S.hero.vy < 0, 'ожог');
  const b = mk(1); noFoes(b.S); b.S.hero.hp = 1; b.game._place(c * T + 8, 20 * T - 2); run(b.game, 0.05); eq(b.last('die').d.kind, 'boil');
});
test('вилки-шипы: ранят и подбрасывают; падение в пропасть — «улетел под стол»', () => {
  const { game, S, has } = mk(1); noFoes(S); game._place(140 * T, 16 * T); run(game, 0.5); ok(has('hurt') && S.hero.hp < 3);
  const b = mk(1); noFoes(b.S); b.game._place(16 * T + 8, 15 * T); run(b.game, 2); eq(b.last('die').d.kind, 'fall');
});
test('ручка-хват: в воздухе у вилки ↑ — хват; раскачка накачивается; прыжок отпускает с разгоном', () => {
  const { game, S, LV, has } = mk(1); noFoes(S); const k = LV.hooks[0];
  game._place(k.x - 6, k.y + 44); S.hero.vy = -50; S.hero.ground = false;
  game.setInput({ y: -1 }); game.update(dt); ok(S.hero.hook && has('grab'), 'зацепился');
  let maxA = 0; for (let i = 0; i < 180; i++){ const h = S.hero.hook; game.setInput({ x: h.w * Math.cos(h.th) >= 0 ? 1 : -1 }); game.update(dt); maxA = Math.max(maxA, Math.abs(S.hero.hook.th)); }
  ok(maxA > 0.9, 'размах ' + maxA.toFixed(2));
  while (!(S.hero.hook.w > 2 && Math.abs(S.hero.hook.th) < 0.3)) { const h = S.hero.hook; game.setInput({ x: h.w * Math.cos(h.th) >= 0 ? 1 : -1 }); game.update(dt); }
  game.setInput({ jump: true }); game.update(dt); ok(!S.hero.hook && S.hero.vx > 150 && S.hero.vy < -150 && has('release'), 'отпуск: vx ' + S.hero.vx.toFixed(0) + ' vy ' + S.hero.vy.toFixed(0));
});
test('сценки бездействия: свист (5 с) → колечки пара (9 с) → сон (13 с), любое действие будит', () => {
  const { game, S, ev } = mk(1); noFoes(S); game._place(5 * T, 18 * T); run(game, 14);
  eq(ev.filter(e => e.t === 'idle').map(e => e.d.stage).join(','), '1,2,3'); eq(S.idleStage, 3);
  run(game, 0.1, { x: 1 }); eq(S.idleStage, 0);
});
test('уровень 3: тепло тает в чае, пузыри греют и поднимают; без тепла — «остыл»', () => {
  const { game, S, LV, last } = mk(3); noFoes(S); const b = LV.bubbles[0];
  game._place((b.x0 + b.x1) / 2, b.y1 - 2); S.warm = 0.5; run(game, 0.8); ok(S.warm > 0.6 && S.hero.y < b.y1 - 60, 'подняло: y ' + S.hero.y.toFixed(0));
  const c = mk(3); noFoes(c.S); c.game._place(5 * T, 97 * T); c.S.warm = 0.05; run(c.game, 3); eq(c.last('die').d.kind, 'cold');
});

// ---------- жизни и продолжения ----------
test('жизни и продолжения: 3 жизни → «конец игры»; два продолжения (уровень заново, счёт с нуля), третьего нет', () => {
  const { game, S, has } = mk(1); noFoes(S);
  const kill = () => { game._die('crack'); run(game, 2); };
  kill(); kill(); eq(S.lives, 1); kill(); eq(S.phase, 'over'); ok(has('gameover'));
  S.score = 5000; ok(game.continueGame()); eq(S.lives, 3); eq(S.score, 0); eq(S.cont, 1); eq(S.phase, 'play');
  for (let i = 0; i < 3; i++) kill(); ok(game.continueGame()); eq(S.cont, 0);
  for (let i = 0; i < 3; i++) kill(); ok(!game.continueGame(), 'продолжений больше нет');
});
test('счёт и доп. жизнь каждые 25 000; прохождение уровня → бонус и переход на следующий', () => {
  const { game, S, has } = mk(1); S.score = 24990; game._clear(); ok(S.lives === 4 && has('life'), 'доп. жизнь');
  run(game, 3.5); eq(S.level, 2); eq(S.kind, 'race');
});

// ---------- головоломка ----------
test('головоломка: правила — крошка под сахарком хрустит, пар при сахарке будит, конфорка горит 2 хода из 4, будильник звенит на 40-м ходу', () => {
  const B = L.PB, s0 = B.init;
  const carryAt = (x, y, extra = {}) => Object.assign(JSON.parse(JSON.stringify(s0)), { x, y, carry: true }, extra);
  // слева от крошки (1,3) стоим на (1,4) с сахарком — шаг вверх = хруст
  eq(PZ.step(B, carryAt(1, 4), 'U').fail, 'crunch');
  eq(PZ.step(B, carryAt(5, 5), 'pR').fail, 'puff');
  const bk = B.burners[0], bx = bk % B.w, by = Math.floor(bk / B.w);
  const near = carryAt(bx - 1, by, { t: 3 }); eq(PZ.step(B, near, 'R').fail, 'melt', 'шаг на горящую (t=4 → 0 mod 4)');
  eq(PZ.step(B, carryAt(bx - 1, by, { t: 1 }), 'R').fail, null, 'на погасшую (t=2) — можно');
  const s = JSON.parse(JSON.stringify(s0)); s.t = 39; eq(PZ.step(B, s, 'pD').fail, 'alarm');
  // пар сдувает крошку (без сахарка), 3 облачка — перегрев, кран остужает
  const p = JSON.parse(JSON.stringify(s0)); p.x = 1; p.y = 4; let r = PZ.step(B, p, 'pU'); ok(r.s.crumbs.length === s0.crumbs.length - 1 && r.s.heat === 1);
  r.s.heat = 3; eq(PZ.step(B, r.s, 'pU').moved, false, 'перегрет');
});
const SOL = PZ.solve(L.PB);
test('головоломка: решение существует (поиск в ширину), ' + (SOL ? SOL.length : '—') + ' ходов; настоящая игра проходит его до конца', () => {
  ok(SOL && SOL.length >= 40 && SOL.length <= 90, 'длина ' + (SOL && SOL.length));
  const r = playPuzzle(CH, SOL); ok(r.cleared, JSON.stringify(r));
});
test('головоломка не решается «в лоб»: без будильника, без крана и без пара — решений нет', () => {
  const B = L.PB;
  ok(!PZ.solve(Object.assign({}, B, { clockAt: -5 })), 'будильник обязателен');
  ok(!PZ.solve(Object.assign({}, B, { taps: [] })), 'кран обязателен (больше трёх облачков пара)');
  ok(!PZ.solve(B, null, 3e6, ['U', 'D', 'L', 'R']), 'без пара не пройти');
});

// ---------- гонка ----------
test('гонка: финиш достижим — «человеческая» тактика (прыжки + ускорение паром) обгоняет перечницу на всех сидах', () => {
  const rs = [1, 2, 3, 4, 5].map(s => playRace(CH, s));
  rs.forEach((r, i) => ok(r.won, 'сид ' + (i + 1) + ': ' + JSON.stringify(r)));
  console.log('     запас на финише, px: ' + rs.map(r => Math.round(r.margin)).join(', ') + '; время ≈ ' + rs[0].time.toFixed(1) + ' с');
});
test('гонка: без прыжков и без ускорения перечница первая (препятствия и пар что-то значат)', () => {
  ok(!playRace(CH, 1, { jump: false }).won, 'без прыжков'); ok(!playRace(CH, 1, { boost: false }).won, 'без пара');
});
test('гонка: солонка — авария, крошка тормозит, кипяток сносит препятствие впереди', () => {
  const { game, S, has } = mk(2); run(game, 2.5); const R = S.race;
  const sh = L.TRACK.obs.find(o => o.k === 'shaker'); R.x = sh.x - 40; R.v = 300; run(game, 0.3, { x: 1 }); ok(has('crash') && R.v < 120, 'авария');
  const b = mk(2); run(b.game, 2.5); const R2 = b.S.race; const sh2 = L.TRACK.obs.find(o => o.k === 'shaker'); R2.x = sh2.x - 150; R2.v = 200; b.game._charge(1); b.game.setInput({ boil: true }); b.game.update(dt); ok(b.has('blast') && R2.got[sh2.id], 'снесло');
});

// ---------- полёт и босс ----------
test('полёт: пар сбивает муху, касание врага — пробоина в пакетике, три — «пакетик лопнул»', () => {
  const { game, S, has, last } = mk(5); const F = S.fly;
  S.enemies.push({ id: 'x', k: 'ffly', x: F.x + 80, y: F.y + 6, y0: F.y + 6, vx: 0, vy: 0, hp: 0.7, t: 0, dead: false, flash: 0, cd: 9, mode: 0 });
  run(game, 0.4, { fire: true }); ok(has('kill'), 'сбил');
  F.inv = 0; for (let i = 0; i < 3; i++){ F.inv = 0; S.enemies.push({ id: 'y' + i, k: 'pop', x: F.x, y: F.y, y0: F.y, vx: 0, vy: 0, hp: 2, t: 0, dead: false, flash: 0, cd: 9 }); game.setInput({}); game.update(dt); }
  eq(last('die').d.kind, 'pop');
});
test('Сервиз: заварник под защитой, пока живы сахарница и молочник; струя пара лишь нагревает, трескает только кипяток (по горячему — ×2)', () => {
  const { game, S, has } = mk(6); run(game, 1.7); const B = S.boss, sug = B.parts[0], tp = B.parts[1];
  game._place(sug.x - 70, 18 * T); S.hero.face = 1; S.hero.inv = 99;
  for (let i = 0; i < 40; i++){ game.setInput({ fire: true }); game.update(dt); }
  eq(sug.cracks, 0, 'пар не трескает'); ok(sug.temp > 0.3, 'нагрел ' + sug.temp.toFixed(2));
  game._charge(1); sug.temp = 0.6; game.setInput({ boil: true }); game.update(dt); run(game, 0.4); eq(sug.cracks, 2, 'кипяток по горячему');
  B.sp = 0; game._place(tp.x + 42, 18 * T); S.hero.face = -1; game._charge(1); game.setInput({ boil: true, x: -1 }); game.update(dt); run(game, 0.5); eq(tp.cracks, 0, 'щит'); ok(has('shield'), 'звон щита');
});

// ---------- музыка, тексты, правило имён ----------
test('музыка: Arcade.tracks.chaynik и 5 тем уровней — 8–16 тактов, голоса кратны, ноты в диапазоне', () => {
  const A = sandbox.Arcade; const keys = ['chaynik', 'chaynik:2', 'chaynik:3', 'chaynik:4', 'chaynik:5', 'chaynik:6'];
  for (const k of keys){ const t = A.tracks[k]; ok(t, 'нет ' + k); const c = A.parseTrack(t), per = c.div * 4 === 12 ? 6 : c.div * 4, bars = c.melody.length / per;
    ok(Number.isInteger(bars) && bars >= 8 && bars <= 16, k + ': тактов ' + bars); ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, k + ': кратность');
    [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, k + ': нота ' + e.f)); }
  ok(new Set(keys.map(k => JSON.stringify(A.tracks[k].melody))).size === 6, 'темы разные');
});
test('i18n: у RU и EN одинаковые ключи; есть названия и гэги всех уровней, подписи всех смертей', () => {
  const ru = Object.keys(CH.STR.ru).sort(), en = Object.keys(CH.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (let n = 1; n <= 6; n++) ok(CH.STR.ru['l' + n] && CH.STR.en['g' + n]);
  ['boil', 'crack', 'magnet', 'fall', 'cold', 'pop', 'race', 'woke_crunch', 'woke_melt', 'woke_puff', 'woke_alarm'].forEach(k => ok(CH.STR.ru['d_' + k] && CH.STR.en['d_' + k], k));
});
test('рендер: все режимы и смерти рисуются без исключений в обеих темах', () => {
  const g = { themeName: 'modern', time: 1, th: () => ({ ink: '#fff', muted: '#aaa', accent: '#fa0', bad: '#f00', good: '#0f0' }), t: k => k, i18n: { lang: 'ru' } };
  for (const theme of ['modern', 'retro']) for (let n = 1; n <= 6; n++){
    g.themeName = theme; const { game, S } = mk(n); run(game, 0.5, { x: 1, fire: true });
    CH.R.scene(g, fakeCtx(), S, { LV: game.level(), cam: { x: 0, y: 0 }, banner: { title: 'x', sub: 'y', a: 1, dur: 2 } });
    if (S.hero) for (const k of ['boil', 'crack', 'magnet', 'cold', 'fall']){ S.phase = 'dead'; S.deathKind = k; S.phaseT = 1; CH.R.scene(g, fakeCtx(), S, { LV: game.level(), cam: { x: 0, y: 0 } }); }
  }
  ok(calls.n > 1000, 'вызовов рисования ' + calls.n);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGVhcnRod29ybXxcYmppbVxifNC00LbQuNC8KD8hW9CwLdGP0ZFdKXxb0LXRkV3RgNGB0LLQvtGA0Lx80Y3RgNGB0LLQvtGA0Lx8cHN5LT9jcm93fNC/0YHQsNC5LT/QutGA0L5b0YPQvl18cXVlZW4gP3NsdWd8c2x1Zy0/Zm9yLT9hLT9idXR0fNC60L7RgNC+0LvQtdCy0LBbLSBd0YHQu9C40LfQvXxzaGlueSA/ZW50ZXJ0YWlubWVudHxpbnRlcnBsYXl80LjQvdGC0LXRgNC/0LvQtdC5', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 13, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('ЧАЙНИК') && !BAD.test('Заварник') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('chaynik'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибки времени нажатий ±40 мс, часть врагов не замечает, иногда «зевает».
test('проходимость уровня 1: «идеальный» бот без бессмертия проходит; «человеческий» — часто (≥ 7 из 10)', () => {
  const p = playLevel(CH, 1, 1, { perfect: true }); ok(p.cleared, 'идеальный: ' + JSON.stringify(p));
  const rs = []; for (let s = 1; s <= 10; s++) rs.push(playLevel(CH, 1, s));
  const n = rs.filter(r => r.cleared).length, deaths = {}; rs.forEach(r => r.why.forEach(k => deaths[k] = (deaths[k] || 0) + 1));
  console.log('     уровень 1: прошёл ' + n + '/10; время побед, с: ' + rs.filter(r => r.cleared).map(r => r.time.toFixed(0)).join(',') + '; смерти: ' + JSON.stringify(deaths));
  ok(n >= 7, 'слишком сложно: ' + n + '/10'); ok(!rs.some(r => r.stuck), 'бот застрял');
});
test('проходимость уровня 3 (чайная глубина): идеальный бот и «человеческий» (≥ 4 из 6)', () => {
  ok(playLevel(CH, 3, 1, { perfect: true }).cleared, 'идеальный');
  const rs = []; for (let s = 1; s <= 6; s++) rs.push(playLevel(CH, 3, s)); const n = rs.filter(r => r.cleared).length;
  console.log('     уровень 3: прошёл ' + n + '/6'); ok(n >= 4, n + '/6');
});
test('проходимость уровня 5 (полёт): бот без урона доходит до мухобойки и сбивает её; «человеческий» уклонист — хотя бы иногда', () => {
  for (const s of [1, 2]) ok(playFly(CH, s, { god: true }).cleared, 'сид ' + s);
  const rs = []; for (let s = 1; s <= 10; s++) rs.push(playFly(CH, s)); const n = rs.filter(r => r.cleared).length;
  console.log('     уровень 5: уклонист прошёл ' + n + '/10 (3 жизни, без продолжений)'); ok(n >= 1, n + '/10');
});
test('проходимость уровня 6 (Сервиз): бот побеждает три фарфоровых босса (≥ 4 из 6)', () => {
  const rs = []; for (let s = 1; s <= 6; s++) rs.push(playBoss(CH, s)); const n = rs.filter(r => r.cleared).length;
  console.log('     уровень 6: победил ' + n + '/6; время, с: ' + rs.filter(r => r.cleared).map(r => r.time.toFixed(0)).join(','));
  ok(n >= 4, n + '/6');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

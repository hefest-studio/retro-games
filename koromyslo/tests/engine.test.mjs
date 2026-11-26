/* КОРОМЫСЛО · tests/engine.test.mjs — автотесты логики, вызова дня, строк и баланса (Node, без зависимостей).
   Запуск: node koromyslo/tests/engine.test.mjs. Логика (js/game.js, js/daily.js, js/i18n.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/daily.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const K = sandbox.KOROMYSLO, L = K.logic;
const { playKoromyslo, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// партия; ev — журнал событий; put(i, v) — положить гирьку v в чашу i напрямую (без падения) и разрешить ход
function setup(opts = {}) {
  const ev = [];
  const game = K.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game._S;
  const put = (i, v, rust) => { S.pans[i].push(game._mk(v, rust)); };
  const has = (t) => ev.some((e) => e.t === t), count = (t) => ev.filter((e) => e.t === t).length;
  return { game, S, ev, put, has, count };
}
function run(game, sec) { for (let i = 0; i < Math.round(sec * 60); i++) game.update(1 / 60); }
function dropAs(game, S, i, v) { S.cur = game._mk(v); ok(game.drop(i), 'бросок в ' + i); run(game, 1.0); }   // 1 с — гирька и окалина успевают упасть

// ---------- устройство ----------
test('коромысло: 8 чаш, плечи 4-3-2-1 | 1-2-3-4, зеркало i ↔ 7−i, вместимость 4, допуск 10, 3 жизни', () => {
  eq(L.PANS, 8); eq(L.DIST.join(), '4,3,2,1,1,2,3,4'); eq(L.SIDE.join(), '-1,-1,-1,-1,1,1,1,1');
  for (let i = 0; i < 8; i++) { eq(L.DIST[L.mirror(i)], L.DIST[i]); eq(L.SIDE[L.mirror(i)], -L.SIDE[i]); }
  eq(L.CAP, 4); eq(L.LIMIT, 10); eq(L.MAX_LIVES, 3);
  eq(L.panAt(-1, 4), 0); eq(L.panAt(-1, 1), 3); eq(L.panAt(1, 1), 4); eq(L.panAt(1, 4), 7);
});
test('момент: T = Σ сторона·плечо·вес (лево — минус)', () => {
  const { S, put } = setup(); put(0, 2); put(5, 3); put(5, 1);   // −4·2 + 2·4 = 0
  eq(L.torque(S.pans), 0); put(3, 1); eq(L.torque(S.pans), -1); put(7, 2); eq(L.torque(S.pans), 7);
});
test('снятие пары: равный вес в зеркальных чашах (любое число гирек) → обе пусты, очки = вес·плечо·гирек·5', () => {
  const { game, S, put, ev } = setup(); put(1, 2); put(1, 1);
  dropAs(game, S, 6, 3);
  eq(S.pans[1].length, 0); eq(S.pans[6].length, 0);
  const c = ev.find((e) => e.t === 'clear'); ok(c, 'нет события clear'); eq(c.d.d, 3); eq(c.d.sum, 3); eq(c.d.n, 3); eq(c.d.pts, 3 * 3 * 3 * 5);
  eq(S.score, 135); eq(S.clears, 1);
});
test('разный вес напротив — пары нет; пустая зеркальная чаша — пары нет', () => {
  const { game, S, put, has } = setup(); put(2, 2);
  dropAs(game, S, 5, 1); ok(!has('clear')); eq(S.pans[2].length + S.pans[5].length, 2);
  dropAs(game, S, 3, 1); ok(!has('clear'), 'одна гирька без пары не снимается');
});
test('комбо: пара на ходу подряд — множитель растёт; ход без пары — сброс', () => {
  const { game, S, put, ev } = setup(); put(3, 1); put(2, 2); put(1, 1);
  dropAs(game, S, 4, 1); dropAs(game, S, 5, 2); dropAs(game, S, 6, 1);
  const cl = ev.filter((e) => e.t === 'clear').map((e) => e.d.mult); eq(cl.join(), '1,2,3'); eq(S.maxCombo, 3);
  dropAs(game, S, 3, 1); eq(S.combo, 0);
});
test('перевес: |T| > допуска → крайняя чаша тяжёлой стороны опрокидывается, −1 жизнь, T снова в допуске', () => {
  const { game, S, put, ev } = setup(); put(0, 2); put(1, 1);  // T = −11? нет: −8 −3 = −11 → сразу проверим через бросок
  S.pans[1] = [];                                                // T = −8
  dropAs(game, S, 2, 2);                                         // T = −12 → перевес
  const t = ev.find((e) => e.t === 'tip'); ok(t, 'нет перевеса'); eq(t.d.side, -1); eq(t.d.dumped[0].pan, 0);
  eq(S.lives, 2); eq(S.pans[0].length, 0); ok(Math.abs(L.torque(S.pans)) <= 10);
});
test('равновесие: ход без пары с T = 0 — бонус 10 × уровень', () => {
  const { game, S, put, ev } = setup(); put(0, 1);
  dropAs(game, S, 4, 4);   // −4 + 4 = 0, пары нет (4 ≠ 1 в зеркале 3? зеркало 4 — чаша 3, пустая)
  ok(ev.some((e) => e.t === 'even' && e.d.pts === 10), 'нет бонуса равновесия'); eq(S.score, 10);
});
test('уровень: каждые 4 пары; жизнь возвращается на уровнях 4, 7, 10…; параметры растут', () => {
  const { game, S, put } = setup(); S.lives = 2;
  for (let k = 0; k < 4; k++) { put(3, 1); dropAs(game, S, 4, 1); }
  eq(S.level, 2); eq(S.lives, 2, 'на 2-м уровне жизнь не добавляется');
  S.level = 3; S.lvlClears = 3; put(3, 1); dropAs(game, S, 4, 1); eq(S.level, 4); eq(S.lives, 3, 'на 4-м — +1');
  const p = (l) => L.levelParams(l);
  eq(p(1).maxW, 2); eq(p(1).fuse, 0); eq(p(1).debrisEvery, 0); eq(p(2).maxW, 3); ok(p(2).fuse > 7);
  ok(p(3).debrisEvery > 0); eq(p(9).maxW, 6); eq(p(12).fuse, 2.5); eq(p(3).limit, 10); eq(p(4).limit, 9); eq(p(6).limit, 8); eq(p(9).limit, 7);
  for (let l = 2; l < 12; l++) { ok(p(l + 1).fuse <= p(l).fuse, 'фитиль не растёт'); ok(p(l + 1).maxW >= p(l).maxW); ok(p(l + 1).limit <= p(l).limit); }
});
test('фитиль: не успел — гирька падает сама в чашу под кареткой (или ближайшую свободную)', () => {
  const { game, S, put, has } = setup({ level: 2 }); ok(S.fuseMax > 7, 'на 2-м уровне есть фитиль');
  game.setCursor(6); for (let k = 0; k < 4; k++) put(6, 1);
  run(game, S.fuseMax + 0.6); ok(has('fuse')); ok(S.pans[5].length + S.pans[7].length >= 1, 'гирька в соседней чаше');
});
test('полная чаша: бросок отклонён (событие full); все полны → «некуда», −1 жизнь и опрокидывание', () => {
  const a = setup(); for (let k = 0; k < 4; k++) a.put(2, 1); ok(!a.game.drop(2)); ok(a.has('full')); eq(a.S.phase, 'aim');
  const b = setup(); for (let i = 0; i < 8; i++) for (let k = 0; k < 4; k++) b.put(i, i === 0 ? 1 : (i === 7 ? 1 : 2 + (i % 2)));
  b.S.pans[7].pop(); b.S.pans[0].pop(); b.S.pans[0].push(b.game._mk(2));   // T: лево 4·(1+1+1+2)… (неважно) — главное: после броска места нет
  b.S.pans[7] = b.S.pans[7].slice(0, 3); const lv = b.S.lives;
  b.S.cur = b.game._mk(1); b.game.drop(7); run(b.game, 1);
  ok(b.ev.some((e) => e.t === 'tip'), 'нет опрокидывания при «некуда»'); ok(b.S.lives < lv);
});
test('окалина: с 3-го уровня ржавая гирька раз в N ходов и не опрокидывает коромысло сама', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { game, S, ev } = setup({ level: 5, seed });
    for (let k = 0; k < 24 && !S.over; k++) {
      if (S.phase !== 'aim') { run(game, 0.2); continue; }
      const m = L.bestMove(S.pans, S.cur.v, { limit: game.params().limit }); if (m < 0) break; game.drop(m); run(game, 1);
    }
    const deb = ev.filter((e) => e.t === 'debris'); ok(deb.length >= 3, 'мало окалины: ' + deb.length);
    for (const d of deb) { const i = ev.indexOf(d); const nxt = ev.slice(i + 1, i + 4); ok(!nxt.some((e) => e.t === 'tip' && !e.d.jam), 'окалина опрокинула (сид ' + seed + ')'); }
  }
});
test('обучение: гирьки 2, 2, 1, 1; подсказка — L2, зеркало, L4, зеркало; после 4 ходов — tutDone', () => {
  const { game, S, ev } = setup({ tutorial: true });
  eq(S.cur.v, 2); eq(S.next.v, 2); eq(S.hint, 2); eq(S.cursor, 2); eq(S.fuseMax, 0);
  game.drop(S.hint); run(game, 0.6); eq(S.hint, 5); game.drop(S.hint); run(game, 0.6);
  ok(ev.some((e) => e.t === 'clear'), 'первая пара не снялась'); eq(S.hint, 0); eq(S.cur.v, 1);
  game.drop(S.hint); run(game, 0.6); eq(S.hint, 7); game.drop(S.hint); run(game, 0.6);
  ok(ev.some((e) => e.t === 'tutDone')); eq(S.tut, -1); eq(S.hint, -1); eq(S.clears, 2);
});
test('подсказка обучения следует за игроком: первая гирька не туда — вторая подсказывается в зеркало', () => {
  const { game, S } = setup({ tutorial: true }); game.drop(1); run(game, 0.6); eq(S.hint, 6);
});
test('бот-подсказка bestMove: снимает пару, если можно; не перевешивает; -1 — некуда', () => {
  const { S, put } = setup(); put(1, 3);
  eq(L.bestMove(S.pans, 3), 6);
  S.pans = [[], [], [], [], [], [], [], []]; put(1, 3);   // T = −9: любая гирька 2 слева — перевес
  const m = L.bestMove(S.pans, 2); ok(L.SIDE[m] > 0, 'бросает на тяжёлую сторону: ' + m);
  const full = Array.from({ length: 8 }, () => [1, 1, 1, 1].map((v) => ({ v })));
  eq(L.bestMove(full, 1), -1);
});
test('реклама: reviveAd после поражения — 1 жизнь, крайние чаши пусты; boost — +1 жизнь до 3', () => {
  const { game, S, put } = setup(); ok(!game.reviveAd(), 'в игре — нельзя');
  put(0, 2); put(1, 2); put(6, 1); S.lives = 1; game._tip(false); ok(S.over && S.lives === 0);
  put(0, 1); ok(game.reviveAd()); eq(S.lives, 1); ok(!S.over); eq(S.phase, 'aim'); ok(S.cur);
  [0, 1, 6, 7].forEach((i) => eq(S.pans[i].length, 0));
  ok(game.canBoost()); ok(game.boost()); eq(S.lives, 2); game.boost(); eq(S.lives, 3); ok(!game.canBoost()); ok(!game.boost());
});
test('детерминизм: один сид — одна партия бота (вызов дня одинаков у всех)', () => {
  const a = playKoromyslo(K, 7), b = playKoromyslo(K, 7); eq(JSON.stringify(a), JSON.stringify(b));
});

// ---------- вызов дня ----------
test('вызов дня: сид от даты, рекорд дня и серия одним числом (облако «max»), новый день — новый рекорд', () => {
  const D = K.daily, mem = {}, store = { get: (k) => (k in mem ? mem[k] : null), set: (k, v) => { mem[k] = String(v); } };
  eq(D.KEY_BEST, 'arcade.koromyslo.daily'); eq(D.KEY_STREAK, 'arcade.koromyslo.streak');
  ok(D.seed(20261126) !== D.seed(20261127)); eq(D.label(20261126), '26.11');
  const d1 = D.Daily(store, 20261126); eq(d1.best(), 0);
  let r = d1.submit(500); eq(r.best, 500); ok(r.isNew); eq(r.streak, 1);
  r = d1.submit(300); eq(r.best, 500); ok(!r.isNew);
  const d2 = D.Daily(store, 20261127); eq(d2.best(), 0); r = d2.submit(120); eq(r.best, 120); eq(r.streak, 2);
  ok(+mem[D.KEY_BEST] > 20261126 * 1e7 + 500, 'поздний день — больше число');
  const s1 = d1.rng(), s2 = D.Daily(store, 20261126).rng(); eq(s1(), s2());
});

// ---------- строки ----------
test('языки: ru/en/tr/es/pt — одинаковые ключи; название RU КОРОМЫСЛО, EN/TR/ES/PT POISEWRIGHT', () => {
  const T = K.STR, ks = Object.keys(T.en).sort().join(','); eq(Object.keys(T).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(T[l]).sort().join(','), ks, l);
  eq(T.ru.title, 'КОРОМЫСЛО'); for (const l of ['en', 'tr', 'es', 'pt']) eq(T[l].title, 'POISEWRIGHT', l);
  for (const l of Object.keys(T)) for (const [k, v] of Object.entries(T[l])) ok(typeof v === 'string' && v.trim(), l + '.' + k + ' пусто');
});
test('музыка: трек koromyslo зарегистрирован, 8 тактов мелодии на 4 такта баса', () => {
  const t = sandbox.Arcade.tracks.koromyslo; ok(t && t.bpm && t.melody && t.bass && t.drums);
  const steps = (s) => (Array.isArray(s) ? s.join(' ') : s).split(/\s+/).filter((x) => x && x !== '|').length;
  eq(steps(t.melody), 64); eq(steps(t.bass), 32);
});

// ---------- баланс (бот tests/bot.mjs) ----------
// «Человеческий» бот: думает 0,6–1,6 с (+0,07 с на гирьку на коромысле), торопится при фитиле, разброс оценки, 4 % промахов.
// 40 партий (сиды 1..40, чётные — с обучением), ~10 с. Цели: 1-й уровень — все; медиана партии 1,5–4 мин игрового времени;
// до 5-го уровня ≥ 70 %; до 12-го ≤ 30 %; потерь жизней на уровень во второй половине больше; партии не бесконечны.
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playKoromyslo(K, s, { tutorial: s % 2 === 0 }));
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
test('баланс: 1-й уровень проходят все партии бота; медиана партии 90–240 с; ни одна не упёрлась в лимит 15 мин', () => {
  const l2 = BAL.filter((r) => r.level >= 2).length, t = med(BAL.map((r) => r.time));
  console.log('     уровень 2+: ' + l2 + '/' + N + '; медиана ' + t + ' с; уровни: ' + JSON.stringify(BAL.map((r) => r.level).sort((a, b) => a - b)));
  eq(l2, N); ok(t >= 90 && t <= 240, 'медиана ' + t); ok(!BAL.some((r) => r.capped), 'бесконечная партия');
});
test('баланс: до 5-го уровня ≥ 70 %, до 12-го ≤ 30 % партий', () => {
  const a = BAL.filter((r) => r.level >= 5).length, b = BAL.filter((r) => r.level >= 12).length;
  console.log('     5+: ' + a + '/' + N + '; 12+: ' + b + '/' + N + '; медиана счёта ' + med(BAL.map((r) => r.score)));
  ok(a >= 0.7 * N, 'слишком сложно: ' + a); ok(b <= 0.3 * N, 'слишком легко: ' + b);
});
test('непресность: опрокидываний на уровень больше после 6-го, чем до', () => {
  let early = 0, late = 0, ne = 0, nl = 0;
  for (const r of BAL) { for (const l of r.lostAt) { if (l <= 5) early++; else late++; } ne += Math.min(r.level, 5); nl += Math.max(0, r.level - 5); }
  const a = early / ne, b = late / Math.max(1, nl); console.log('     опрокидываний на уровень: 1–5 → ' + a.toFixed(2) + ', 6+ → ' + b.toFixed(2));
  ok(b > a * 2, 'нет нарастания: ' + a.toFixed(2) + ' → ' + b.toFixed(2));
});

// ---------- площадка: «Без рекламы» и таблицы лидеров ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'koromyslo', boards: ['koromyslo', 'koromysloDaily'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

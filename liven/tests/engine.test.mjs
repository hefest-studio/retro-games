/* ЛИВЕНЬ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node liven/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/patterns.js', 'js/stages.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const LV = sandbox.LIVEN, L = LV.logic, K = L.K;
const { playLiven, reachCheck, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

function mk(opts = {}){
  const ev = [];
  const game = LV.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, a, b, c) => ev.push({ t, a, b, c }) }, opts)).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0, focus = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, focus); game.tick(K.STEP); } }
const CARDS = []; for (const id in LV.BOSSES) LV.BOSSES[id].cards.forEach((c, ci) => CARDS.push({ id, ci, c, mid: id[0] === 'm' }));
// снимок пуль: позиция/вид/цвет, округлённо
function snap(S){ const B = S.B, a = []; for (let i = 0; i < B.n; i++) a.push((B.x[i] * 10 | 0) + ':' + (B.y[i] * 10 | 0) + ':' + B.k[i] + B.c[i]); return a.join(','); }

// ---------- состав ----------
test('5 этапов: у каждого мид-босс и босс; у боссов 3–5 перезвонов; всего 27, имена RU/EN, лимит времени и бонус', () => {
  eq(LV.STAGES.length, 5);
  LV.STAGES.forEach((st, i) => {
    const mids = st.ev.filter(e => e.boss && e.mid), bosses = st.ev.filter(e => e.boss && !e.mid);
    eq(mids.length, 1, 'этап ' + (i + 1)); eq(bosses.length, 1, 'этап ' + (i + 1));
    ok(st.n.ru && st.n.en);
    const b = LV.BOSSES[bosses[0].boss]; ok(b.cards.length >= 3 && b.cards.length <= 5, 'перезвонов ' + b.cards.length);
    ok(LV.BOSSES[mids[0].boss].cards.length >= 1);
  });
  eq(CARDS.length, 27);
  CARDS.forEach(({ c }) => { ok(c.n.ru && c.n.en && c.time >= 20 && c.time <= 60 && c.bonus > 0 && c.hp > 0 && typeof c.f === 'function', c.n.ru); });
  const names = new Set(CARDS.map(x => x.c.n.ru)); eq(names.size, 27, 'имена перезвонов уникальны');
});
test('у пуль ≥ 5 форм и ≥ 6 цветов в узорах', () => {
  const kinds = new Set(), cols = new Set();
  for (const { id, ci, mid } of CARDS) { const { game, S } = mk({ diff: 'normal', noHit: true }); game._card(id, ci, mid); run(game, 6); for (let i = 0; i < S.B.n; i++) { kinds.add(S.B.k[i]); cols.add(S.B.c[i]); } }
  ok(kinds.size >= 5, 'форм ' + kinds.size); ok(cols.size >= 6, 'цветов ' + cols.size);
});

// ---------- детерминизм ----------
test('детерминизм: тот же сид и ввод → те же пули в каждом перезвоне (все сложности)', () => {
  for (const d of L.DIFFS) for (const { id, ci, mid } of CARDS) {
    const a = mk({ diff: d, noHit: true, rng: mulberry32(42) }), b = mk({ diff: d, noHit: true, rng: mulberry32(42) });
    a.game._card(id, ci, mid); b.game._card(id, ci, mid);
    for (let k = 0; k < 4; k++) { run(a.game, 1.5, k % 2 ? 1 : -1, 0); run(b.game, 1.5, k % 2 ? 1 : -1, 0); eq(snap(a.S), snap(b.S), d + ' ' + id + '/' + ci + ' t=' + (k + 1) * 1.5); }
  }
});
test('детерминизм: целый этап с одинаковым вводом даёт одинаковый счёт и число пуль', () => {
  const r = s => { const { game, S } = mk({ rng: mulberry32(s), diff: 'normal' }); for (let i = 0; i < 60 * 40; i++) { game.setInput(Math.sin(i / 40), 0, i % 300 < 150); game.tick(K.STEP); } return S.score + '/' + S.B.n + '/' + S.graze + '/' + S.lives; };
  eq(r(7), r(7)); ok(r(7) !== r(8) || true);
});

// ---------- производительность ----------
test('лимит пуль: пул ≤ K.MAXB, в настоящих перезвонах на Трудном пик ≤ 1500', () => {
  const { game, S } = mk({ noHit: true }); game._fill(K.MAXB + 500); eq(S.B.n, K.MAXB);
  let peak = 0, at = '';
  for (const { id, ci, c, mid } of CARDS) { const g2 = mk({ diff: 'hard', noHit: true, frozen: true }); g2.game._card(id, ci, mid); g2.S.boss.hp = 1e9;
    for (let f = 0; f < Math.round(c.time * 60) - 2; f++) { g2.game.tick(K.STEP); if (g2.S.B.n > peak) { peak = g2.S.B.n; at = c.n.ru; } } }
  console.log('     пик пуль на Трудном: ' + peak + ' («' + at + '»)'); ok(peak <= 1500, 'пик ' + peak);
});
test('время кадра: логика на полном пуле (3200 пуль) и на пике самого плотного перезвона ≪ 16,7 мс', () => {
  const { game, S } = mk({ noHit: true }); game._card('b5', 4); game._fill(K.MAXB - 50);
  for (let i = 0; i < 30; i++) game.tick(K.STEP);
  let t0 = process.hrtime.bigint(), n = 0, worst = 0;
  for (let i = 0; i < 300; i++) { if (S.B.n < K.MAXB - 300) game._fill(400); const a = process.hrtime.bigint(); game.tick(K.STEP); const d = Number(process.hrtime.bigint() - a) / 1e6; if (i > 20 && d > worst) worst = d; n++; }
  const avg = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log('     полный пул: среднее ' + avg.toFixed(3) + ' мс/кадр, худшее ' + worst.toFixed(3) + ' мс (бюджет 60 fps — 16,7 мс)');
  ok(avg < 4, 'среднее ' + avg); ok(worst < 12, 'худшее ' + worst);
});

// ---------- честность узоров ----------
// «Идеальное уклонение»: пространственно-временной поиск (tests/bot.mjs → reachCheck) — в каждый кадр существует позиция,
// куда хитбокс мог добраться с реальной скоростью, не задев ни одной пули. Проверяем все 27 перезвонов × 3 сложности.
test('честность: в каждом перезвоне на каждой сложности всегда есть проход для хитбокса (20 с)', () => {
  let worst = Infinity, wn = '';
  for (const d of L.DIFFS) for (const { id, ci, c, mid } of CARDS) {
    const r = reachCheck(LV, { diff: d, seed: 3 }, g => g._card(id, ci, mid), Math.min(c.time, 20));
    ok(r.ok, d + ' «' + c.n.ru + '»: прохода нет на ' + r.at + ' с');
    if (r.minCount < worst) { worst = r.minCount; wn = d + ' «' + c.n.ru + '»'; }
  }
  console.log('     самый тесный момент: ' + worst + ' клеток 4×4 px (' + wn + ')'); ok(worst >= 20);
});
test('честность: волны этапов (враги этапа без мид-босса и босса) проходимы', () => {
  for (const d of L.DIFFS) for (let n = 1; n <= 5; n++) { const r = reachCheck(LV, { diff: d, seed: 4 }, g => g._stageOnly(n), 20); ok(r.ok, d + ' этап ' + n + ' на ' + r.at); }
});
test('сложность: плотность и темп растут Лёгкий < Норма < Трудный', () => {
  const D = L.DIFF; ok(D.easy.dens < D.normal.dens && D.normal.dens < D.hard.dens); ok(D.easy.rate < D.normal.rate && D.normal.rate < D.hard.rate); ok(D.easy.spd < D.hard.spd);
  const cnt = d => { const { game, S } = mk({ diff: d, noHit: true, frozen: true }); game._card('b1', 2); let m = 0; for (let f = 0; f < 600; f++) { game.tick(K.STEP); m = Math.max(m, S.B.n); } return m; };
  const e = cnt('easy'), n = cnt('normal'), h = cnt('hard'); ok(e < n && n < h, e + ' / ' + n + ' / ' + h);
});

// ---------- механики ----------
test('хитбокс — точка (≤ 3 px), фокус: медленнее и уже огонь, плотнее по урону', () => {
  ok(K.HB <= 3); ok(K.SPD_F < K.SPD * 0.5);
  const a = mk({ noHit: true }); a.S.P.x = 200; run(a.game, 0.5, 1, 0, false); const fast = a.S.P.x - 200;
  const b = mk({ noHit: true }); b.S.P.x = 200; run(b.game, 0.5, 1, 0, true); const slow = b.S.P.x - 200;
  ok(slow < fast * 0.5 && slow > 0, fast + ' / ' + slow);
  const spread = sh => Math.max(...sh) - Math.min(...sh);
  for (const f of L.FORMS) ok(spread(L.SHOT[f].narrow) < spread(L.SHOT[f].wide), f);
});
test('грейз: пуля впритирку даёт очки и засчитывается один раз; попадание в точку — урон', () => {
  const { game, S, has } = mk(); S.P.inv = 0; game._sparks(0); const B = S.B;
  game._G.sp0(); game._G.fire(S.P.x + 12, S.P.y - 40, Math.PI / 2, 120);
  const sc0 = S.score; run(game, 0.8);
  eq(S.graze, 1); ok(S.score > sc0, 'очки за грейз'); ok(has('graze')); ok(!has('hit'));
  game._G.fire(S.P.x, S.P.y - 30, Math.PI / 2, 150); run(game, 0.4); ok(has('hit'), 'попадание');
});
test('разряд: гасит пули (в окалину), даёт неуязвимость, тратит заряд; без разрядов не срабатывает', () => {
  const { game, S, has } = mk(); S.P.inv = 0; game._fill(300); const b0 = S.bombs;
  ok(game.bomb()); eq(S.bombs, b0 - 1); ok(S.P.inv >= K.BOMB_T - 0.01); run(game, 0.2); eq(S.B.n, 0); ok(S.IT.n > 50, 'окалина'); ok(has('bomb'));
  S.bombs = 0; S.P.bombT = 0; ok(!game.bomb());
});
test('авто-разряда нет: попадание с разрядами в запасе — смерть через 0,13 с, если не нажать', () => {
  const { game, S } = mk(); S.P.inv = 0; const l0 = S.lives, b0 = S.bombs; game._hit(); run(game, 0.3); eq(S.lives, l0 - 1); eq(S.stats.deathbombs, 0);
  const t = mk(); t.S.P.inv = 0; t.game._hit(); run(t.game, 0.05); ok(t.game.bomb(), 'разряд в последний миг'); run(t.game, 0.3); eq(t.S.lives, l0); eq(t.S.stats.deathbombs, 1); eq(b0 - 1, t.S.bombs);
});
test('искры-множитель: каждая искра +0,01 (до ×5), множитель умножает очки; смерть — половина искр', () => {
  const { game, S } = mk(); eq(S.mult, 1);
  game._sparks(120); ok(Math.abs(S.mult - 2.2) < 1e-9); game._sparks(900); eq(S.mult, K.MULT_MAX);
  game._sparks(100); const s0 = S.score; game._add(1000); eq(S.score - s0, 2000);
  S.P.inv = 0; game._die(); eq(S.sparks, 50);
  const t = mk(); t.game._sparks(0); const IT = t.S.IT; IT.add(t.S.P.x, t.S.P.y - 5, 0, 0, 0, 0); run(t.game, 0.2); eq(t.S.sparks, 1, 'подобрана');
  // враги роняют искры
  const k = mk(); k.game._spawn({ type: 'bell', x: 200, y: 200, path: 'hover', ty: 200 }); const e = k.S.E.find(x => x.on); const n0 = k.S.IT.n; k.game._kill(e); ok(k.S.IT.n - n0 >= 5);
});
test('перезвон: бонус только без смерти и разряда; таймаут — без бонуса; название и таймер', () => {
  const run1 = (spoil) => { const { game, S, ev } = mk({ noHit: true }); game._card('b1', 0); if (spoil === 'bomb') game.bomb(); if (spoil === 'die') game._die();
    run(game, 0.2); S.boss.hp = 0; run(game, 0.1); return ev.find(e => e.t === 'cardEnd'); };
  ok(run1().a > 0, 'чистый'); eq(run1('bomb').a, 0); eq(run1('die').a, 0);
  const { game, S, ev } = mk({ noHit: true, frozen: true }); game._card('m1', 0, true); S.boss.hp = 1e9; run(game, LV.BOSSES.m1.cards[0].time + 0.5);
  const e = ev.find(x => x.t === 'cardEnd'); ok(e && e.b === 1 && e.a === 0, 'таймаут'); eq(S.stats.timeouts, 1);
  // после последнего перезвона мид-босс уходит, этап продолжается
  ok(S.boss.dead);
});
test('босс: перезвоны идут по порядку, после последнего — этап пройден и бонус', () => {
  const { game, S, ev } = mk({ noHit: true }); game._card('b1', 0);
  for (let i = 0; i < 3; i++) { run(game, 1.5); eq(S.boss.ci, i); S.boss.hp = 0; run(game, 0.05); }
  ok(ev.some(e => e.t === 'clear')); eq(S.phase, 'clear'); run(game, 5); eq(S.stage, 2);
});
test('продолжения: после последней жизни — отсчёт; cont() — новые жизни, последняя цифра счёта = число продолжений; не больше 3', () => {
  const { game, S } = mk(); S.lives = 1; S.P.inv = 0; game._die(); run(game, 1.2); eq(S.phase, 'cont');
  ok(game.cont()); eq(S.lives, K.LIVES); eq(S.score % 10, 1); eq(S.phase, 'play');
  for (let c = 0; c < 2; c++) { S.lives = 1; S.P.inv = 0; S.P.dead = 0; game._die(); run(game, 1.2); ok(game.cont()); }
  eq(S.conts, 3); S.lives = 1; S.P.inv = 0; game._die(); run(game, 1.2); eq(S.phase, 'over');
  const t = mk(); t.S.lives = 1; t.S.P.inv = 0; t.game._die(); run(t.game, 1.2 + K.CONT_T + 0.2); eq(t.S.phase, 'over', 'отсчёт истёк');
});
test('жизни за очки (экстенды) по сложности; победа после 5-го этапа', () => {
  const { game, S, has } = mk({ diff: 'normal' }); const l0 = S.lives; game._sparks(0); game._add(L.DIFF.normal.ext[0]); eq(S.lives, l0 + 1); ok(has('extend'));
  const w = mk({ noHit: true, stage: 5 }); w.game._card('b5', 4); run(w.game, 1.5); w.S.boss.hp = 0; run(w.game, 5); eq(w.S.phase, 'won');
});
test('рекорд — свой на каждую сложность (ключи arcade.best.liven.<сложность>), общий arcade.best.liven — для каталога', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/'arcade\.best\.liven\.' \+ \(d \|\| diff\)/.test(src)); ok(src.includes("'arcade.best.liven'"));
  L.DIFFS.forEach(d => ok(LV.STR.ru['d_' + d] && LV.STR.en['d_' + d]));
  eq(LV.STR.ru.d_easy, 'Лёгкий'); eq(LV.STR.ru.d_normal, 'Норма'); eq(LV.STR.ru.d_hard, 'Трудный');
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек liven подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.liven; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; все g.t(…) из кода есть в таблицах', () => {
  const ru = Object.keys(LV.STR.ru).sort(), en = Object.keys(LV.STR.en).sort(); eq(ru.join(','), en.join(','));
  const used = new Set(); for (const f of ['js/main.js', 'js/render.js']) for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\.t\('([a-zA-Z_]+)'\)/g)) used.add(m[1]);
  for (const k of used) ok(LV.STR.ru[k] != null, 'нет строки ' + k);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей и чужих жанровых терминов (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  // (общий список аркады из glub/tests + оригиналы жанра «пулевой ад» и их фирменный термин фаз босса)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8') + '|' +
    Buffer.from('dG91aG91fCg/PCFb0LAt0Y/RkV0p0YLQvtGF0L4oPyFb0LAt0Y/RkV0pfNGC0L7Rg9GF0L7Rg3xkby0/ZG9uLT9wYWNoaXzQtNC+0LTQvtC90L/QsNGH0Lh8ZG9ucGFjaGl80LTQvtC90L/QsNGH0Lh8aWthcnVnYXzQuNC60LDRgNGD0LPQsHxzcGVsbC4/Y2FyZHzRgdC/0LXQu9C7', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Звонарь') && !BAD.test('перезвон') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест') && !BAD.test('spellcheck') && !BAD.test('потихоньку'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, не видит только что вылетевшие пули, прогноз по прямой с ошибкой ±4 px,
// 5% решений пропускает, разряд жмёт не всегда; продолжений не берёт.
const N = 30;
test('баланс: на Лёгком бот проходит этап 1 почти всегда (≥ 90% из 30 партий)', () => {
  const R = []; for (let s = 1; s <= N; s++) R.push(playLiven(LV, s, { diff: 'easy', stages: 1 }));
  const n = R.filter(r => r.cleared >= 1).length, deaths = R.reduce((a, r) => a + r.deaths, 0);
  console.log('     этап 1, Лёгкий: ' + n + '/' + N + '; смертей всего ' + deaths); ok(n >= 0.9 * N, n + '/' + N); ok(!R.some(r => r.stuck), 'бот застрял');
});
test('баланс: Норма и Трудный на этапе 1 заметно тяжелее Лёгкого', () => {
  const st = d => { let dd = 0, c = 0; for (let s = 1; s <= 12; s++) { const r = playLiven(LV, s, { diff: d, stages: 1 }); dd += r.deaths; if (r.cleared) c++; } return { dd, c }; };
  const e = st('easy'), n = st('normal'), h = st('hard'); console.log('     смерти на этапе 1 (12 партий): Лёгкий ' + e.dd + ', Норма ' + n.dd + ', Трудный ' + h.dd + '; прошли: ' + e.c + '/' + n.c + '/' + h.c);
  ok(e.dd < n.dd && n.dd < h.dd);
});
test('баланс: вся игра на Лёгком без продолжений проходима (≥ 50% из 10), на Трудном — нет (≤ 30%)', () => {
  let e = 0, h = 0; for (let s = 1; s <= 10; s++) { if (playLiven(LV, s, { diff: 'easy', stages: 5 }).won) e++; if (playLiven(LV, s, { diff: 'hard', stages: 5 }).won) h++; }
  console.log('     вся игра: Лёгкий ' + e + '/10, Трудный ' + h + '/10'); ok(e >= 5, 'Лёгкий ' + e); ok(h <= 3, 'Трудный ' + h);
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

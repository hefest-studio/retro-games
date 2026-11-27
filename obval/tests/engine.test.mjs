/* ОБВАЛ · tests/engine.test.mjs — автотесты «Крепильщика»: опора и обрушение породы, шахтёры, крепи, решатель, 24 шахты, строки, музыка, миграция, правило имён, баланс ботом.
   Запуск: node obval/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика грузится в node:vm. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { play } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, JSON }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const OB = sandbox.OBVAL, K = OB.K, LV = OB.LEVELS;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const mk = (map, o = {}) => OB.Game(Object.assign({ level: { id: 0, map, stock: o.stock || 0 }, par: 1 }, o));
const at = (g, x, y) => y * g.L.W + x;
const rows = (g) => { const S = g.state(), L = g.L, out = []; for (let y = 0; y < L.H; y++) { let r = ''; for (let x = 0; x < L.W; x++) { const i = y * L.W + x; let ch = '.'; if (L.wall[i]) ch = '#'; else if (S.blk[i] === 1) ch = 'R'; else if (S.blk[i] === 2) ch = 'P';
  for (let k = 0; k < S.mp.length; k++) if (S.mp[k] === i && S.ms[k] === 0) ch = S.md[k] > 0 ? '>' : '<'; else if (S.mp[k] === i && S.ms[k] === 2) ch = '%'; r += ch; } out.push(r); } return out; };

// ---------- опора и обрушение ----------
test('опора: порода на скале и на крепи держится; без опоры — падает на клетку вниз и ложится на пол', () => {
  const g = mk(['#####', '#.R.#', '#.P.#', '#...#', '#####']); eq(rows(g)[1], '#.R.#'); ok(OB.isSettled(g.L, OB.initState(g.L)));
  g.act(at(g, 2, 2)); eq(rows(g).join('|'), '#####|#...#|#...#|#.R.#|#####');
});
test('свод: порода зажата с двух сторон скалой, крепью или устойчивой породой — держится без опоры снизу', () => {
  const g = mk(['#####', '#RRR#', '#...#', '#...#', '#####']); ok(OB.isSettled(g.L, OB.initState(g.L)), 'ряд от стены до стены стоит');
  const h = mk(['#######', '#R.R..#', '#.....#', '#.....#', '#######']); ok(!OB.isSettled(h.L, OB.initState(h.L)), 'одиночные камни без опоры не стоят');
});
test('цепь: выбил крепь в ряду — весь ряд, державшийся сводом, рушится, а порода сверху — за ним', () => {
  const g = mk(['#########', '#.......#', '#..R....#', '#RRRPRRR#', '#.......#', '#.......#', '#########']); ok(OB.isSettled(g.L, OB.initState(g.L)));
  g.act(at(g, 4, 3)); eq(rows(g).join('|'), '#########|#.......#|#.......#|#.......#|#..R....#|#RRR.RRR#|#########');
});
test('стопка: упавшая порода ложится на другую (опора снизу), а не проваливается', () => {
  const g = mk(['#####', '#.R.#', '#.R.#', '#.P.#', '#...#', '#####']); g.act(at(g, 2, 3)); eq(rows(g).join('|'), '#####|#...#|#...#|#.R.#|#.R.#|#####');
});
test('щель: порода падает в яму шириной 1 и застревает на её краю (зажата скалой с двух сторон) — получается мост вровень с полом', () => {
  const g = mk(['#########', '#...R...#', '#...P...#', '#>.....E#', '####.####', '#########']); g.act(at(g, 4, 2)); eq(rows(g)[4], '####R####', 'камень лёг в яму'); ok(g.state().cleared, 'шахтёр прошёл по мосту');
});

// ---------- крепи ----------
test('крепь: ставится в пустую клетку на опору (скала, крепь или порода), запас убывает; выбитая крепь возвращается в запас', () => {
  const g = mk(['#######', '#.....#', '#>....#', '#######'], { stock: 1 }); eq(g.state().stock, 1); ok(g.canAct(at(g, 3, 2)) && !g.canAct(at(g, 3, 1)), 'ставить можно только на опору');
  ok(g.act(at(g, 3, 2)).ok); eq(g.state().stock, 0); ok(g.isProp(at(g, 3, 2))); ok(!g.canAct(at(g, 4, 2)), 'запас кончился'); eq(g.act(at(g, 4, 2)).why, 'stock');
  ok(g.act(at(g, 3, 2)).ok); eq(g.state().stock, 1, 'вернулась в запас'); ok(g.canAct(at(g, 4, 2)));
});
test('крепь: нельзя ставить на скалу, на породу, на клетку без опоры снизу', () => {
  const g = mk(['#####', '#.R.#', '#.P.#', '#...#', '#####'], { stock: 2 }); eq(g.act(at(g, 0, 1)).why, 'wall'); eq(g.act(at(g, 2, 1)).why, 'rock'); eq(g.act(at(g, 1, 1)).why, 'nofloor');
});

// ---------- шахтёры ----------
test('шахтёр: идёт вперёд до упора (стена, порода, крепь, обрыв) и стоит; поворачивать не умеет', () => {
  const g = mk(['#########', '#.......#', '#>..P...#', '#########']); g.act(at(g, 4, 2)); eq(rows(g)[2], '#......>#');
  const h = mk(['#########', '#.......#', '#.<P....#', '#########']); h.act(at(h, 3, 2)); eq(rows(h)[2], '#<......#');
});
test('шахтёр: у обрыва стоит, пока яма не засыпана; потом доходит до выхода и спасён', () => {
  const g = mk(['#########', '#...R...#', '#...P...#', '#>.....E#', '####.####', '#########']); ok(OB.initState(g.L).mp.length === 1); g.act(at(g, 4, 2)); ok(g.state().cleared && g.state().saved === 1);
  const h = mk(['#########', '#.......#', '#.P.....#', '#>.....E#', '####.####', '#########']); h.act(at(h, 2, 2));
  ok(!h.state().cleared, 'без моста дальше ямы не уйдёт'); eq(h.state().mp[0], 3 * 9 + 3);
});
test('шахтёр: падает вместе с опорой; 2 клетки — цел, 3 и больше — гибнет', () => {
  const a = mk(['#####', '#.>.#', '#.P.#', '#...#', '#####']); a.act(at(a, 2, 2)); ok(!a.state().dead, '2 клетки — цел'); eq(a.state().mp[0], 3 * 5 + 3, 'упал и прошёл вперёд до стены');
  const b = mk(['#####', '#.>.#', '#.P.#', '#...#', '#...#', '#####']); b.act(at(b, 2, 2)); ok(b.state().dead, '3 клетки — гибель'); eq(rows(b)[4][2], '%');
  const c = mk(['#####', '#.>.#', '#.P.#', '#...#', '#...#', '#...#', '#####']); c.act(at(c, 2, 2)); ok(c.state().dead, '4 клетки — гибель');
});
test('шахтёр: порода, упавшая на него, убивает; после гибели ходов нет, отмена возвращает', () => {
  const g = mk(['#####', '#.R.#', '#.P.#', '#.>.#', '#####']); const r = g.act(at(g, 2, 2)); ok(r.ok && g.state().dead); eq(g.act(at(g, 1, 3)).why, 'dead'); ok(g.stuck()); ok(g.undo()); ok(!g.state().dead); eq(g.state().moves, 0);
});
test('шахтёр: дошёл до выхода — спасён и убран с поля; шахтёры не проходят друг через друга', () => {
  const L = OB.parse({ id: 0, map: ['#########', '#>.>...E#', '#########'] }), st = OB.initState(L); OB.walk(L, st, null); eq(st.mp.join(), '11,16'); eq(st.ms.join(), '0,1', 'второй спасён, первый стоит за ним');
});
test('очаг: победа — когда засыпаны все очаги и спасены все шахтёры', () => {
  const g = mk(['#####', '#.R.#', '#.P.#', '#.X.#', '#####']); ok(!g.state().cleared); g.act(at(g, 2, 2)); ok(g.state().cleared); eq(g.state().filled, 1);
  const h = mk(['#########', '#.R.....#', '#.P.....#', '#.X..>.E#', '#########']); h.act(at(h, 2, 2)); ok(h.state().cleared && h.state().filled === 1 && h.state().saved === 1);
});

// ---------- партия ----------
test('партия: отмена возвращает состояние и ход, «заново» — старт; подсказка — первый ход кратчайшего решения', () => {
  const g = OB.Game({ level: LV[7], par: OB.solve(OB.parse(LV[7])).moves }); const s0 = rows(g).join('|'), h = g.hint(); ok(h >= 0 && g.canAct(h));
  g.act(h); eq(g.state().moves, 1); ok(g.undo()); eq(g.state().moves, 0); eq(rows(g).join('|'), s0); ok(!g.undo(), 'пустая история');
  g.act(h); g.restart(); eq(g.state().moves, 0); eq(rows(g).join('|'), s0); eq(g.state().stock, LV[7].stock);
});
test('тупик: стартовая шахта без выхода из положения определяется исчерпывающим поиском', () => {
  const g = mk(['#######', '#>...E#', '###.###', '#######']); ok(g.stuck(), 'ямы нечем засыпать, ходов нет — тупик'); const h = mk(['#######', '#>.P.E#', '#######']); ok(!h.stuck());
});
test('звёзды: ≤ par — 3, ≤ par + max(2, ⌈par/2⌉) — 2, иначе 1', () => {
  eq(OB.starsFor(2, 2), 3); eq(OB.starsFor(4, 2), 2); eq(OB.starsFor(5, 2), 1); eq(OB.starsFor(6, 6), 3); eq(OB.starsFor(9, 6), 2); eq(OB.starsFor(10, 6), 1); eq(OB.starsFor(14, 9), 2); eq(OB.starsFor(15, 9), 1);
});
test('события: place / remove / crush / fall / save / clear / undo', () => {
  const ev = []; const g = OB.Game({ level: LV[1], par: 1, onEvent: (t) => ev.push(t) }); g.act(at(g, 2, 3)); ok(ev.includes('remove') && ev.includes('save') && ev.includes('clear'));
  const e2 = []; const h = OB.Game({ level: LV[2], par: 2, onEvent: (t) => e2.push(t) }); h.act(at(h, 2, 5)); h.act(at(h, 2, 3)); h.undo(); ok(e2.includes('place') && e2.includes('remove') && e2.includes('undo'));
  const e3 = []; const k = mk(['#####', '#.R.#', '#.P.#', '#.>.#', '#####']); const kk = OB.Game({ level: { id: 0, map: ['#####', '#.R.#', '#.P.#', '#.>.#', '#####'] }, par: 1, onEvent: (t) => e3.push(t) }); kk.act(at(kk, 2, 2)); ok(e3.includes('crush') && e3.includes('dead'));
});
test('клон/детерминизм: два прогона одной шахты идентичны, решатель не использует случайность', () => {
  const a = OB.solve(OB.parse(LV[18])), b = OB.solve(OB.parse(LV[18])); eq(JSON.stringify(a.path), JSON.stringify(b.path));
  const src = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'); ok(!/Math\.random/.test(src), 'в логике нет Math.random');
});

// ---------- 24 шахты ----------
test('шахты: 24 штуки, карты вручную собраны и выверены, ровные строки, id по порядку, есть шахтёр или очаг, нет дублей', () => {
  eq(LV.length, 24); const seen = new Set();
  LV.forEach((d, i) => { eq(d.id, i + 1); const L = OB.parse(d); ok(L.miners0.length + L.hazList.length >= 1, 'нет цели ' + d.id); ok(!L.miners0.length || L.exits.length >= 1, 'нет выхода ' + d.id); ok(L.W <= 9 && L.H <= 10, 'размер ' + d.id);
    for (let x = 0; x < L.W; x++) { eq(L.wall[x], 1); eq(L.wall[(L.H - 1) * L.W + x], 1); } const k = d.map.join(''); ok(!seen.has(k), 'дубль ' + d.id); seen.add(k); });
});
test('шахты: каждая решается; par = кратчайшее решение решателя; в начале порода неподвижна, шахтёры не на выходе, не решено', () => {
  LV.forEach((d) => { const L = OB.parse(d), r = OB.solve(L); ok(r.solved, 'не решается ' + d.id); eq(r.moves, d.par, 'par шахты ' + d.id); const st = OB.initState(L); ok(OB.isSettled(L, st), 'порода падает в начале ' + d.id); ok(!OB.won(L, st), 'решено в начале ' + d.id);
    L.miners0.forEach((m) => ok(!L.exit[m.p], 'шахтёр на выходе ' + d.id)); L.hazList.forEach((h) => eq(st.blk[h], 0, 'очаг занят ' + d.id)); eq(st.stock, d.stock, 'запас ' + d.id); });
});
test('шахты: решение по шагам действительно приводит к победе через Game (звёзды 3), без гибели шахтёров', () => {
  LV.forEach((d) => { const g = OB.Game({ level: d, par: d.par }), r = OB.solve(g.L); r.path.forEach((c) => ok(g.act(c).ok, 'ход невозможен ' + d.id)); ok(g.state().cleared && !g.state().dead, d.id); eq(g.state().stars, 3); });
});
test('шахты: кривая сложности — par не убывает более чем на 1; первые обучающие (1–6) короткие; последняя ≥ 8; есть очаги, шахтёры, запас крепей', () => {
  for (let i = 1; i < LV.length; i++) ok(LV[i].par >= LV[i - 1].par - 1, 'par падает на ' + (i + 1)); ok(LV.slice(0, 6).every((d) => d.par <= 2)); ok(LV[23].par >= 8);
  ok(LV.some((d) => OB.parse(d).hazList.length >= 2), 'нет шахт с двумя очагами'); ok(LV.some((d) => d.stock >= 2), 'нет шахт с запасом 2'); ok(LV.slice(0, 5).some((d) => OB.parse(d).miners0.length === 0), 'нет безлюдной шахты-обучения');
});
test('подсказка: из начала — первый ход решения; тупиков в стартовом состоянии нет', () => {
  LV.forEach((d) => { const g = OB.Game({ level: d, par: d.par }); const h = g.hint(); ok(h >= 0 && g.canAct(h), 'подсказка ' + d.id); ok(!g.stuck(), 'тупик в начале ' + d.id); eq(h, OB.solve(g.L).path[0]); });
});
test('решатель: кратчайший поиск укладывается в разумный предел (< 3 с на шахту, ≤ 120 000 состояний)', () => {
  LV.forEach((d) => { const t = Date.now(), r = OB.solve(OB.parse(d)); ok(r.explored <= 120000 && Date.now() - t < 3000, 'долго ' + d.id); });
});
test('прежняя механика удалена: нет копания, алмазов, светлячков/бабочек, шахтёра с фонарём, поля 40×22, legacy.html, host.js', () => {
  const bad = []; for (const f of ['js/game.js', 'js/levels.js', 'js/render.js', 'js/main.js', 'js/i18n.js', 'index.html']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (/diamond|алмаз|светляч|firefl|бабочк|butterfl|самоцвет|lantern|фонар|boulder|валун|40\s*[x×]\s*22|bonus.?time|таймер/i.test(t)) bad.push(f); }
  ok(!bad.length, bad.join()); for (const f of ['legacy.html', 'js/host.js', 'js/mine.js', 'src', 'tools', 'screenshots', 'assets']) ok(!fs.existsSync(path.join(ROOT, f)), 'остался ' + f);
});

// ---------- сохранения ----------
test('миграция: старый рекорд очков → «прежний рекорд», звёзды с нуля, сообщение; повторный запуск молчит; чистый игрок — без сообщения', () => {
  const store = { 'arcade.best.obval': '3400' }, io = { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); }, del: (k) => { delete store[k]; } };
  let m = OB.save.migrate(io); ok(m.migrated && m.notice); eq(m.oldBest, 3400); eq(store['arcade.best.obval'], undefined); eq(store['arcade.obval.oldBest'], '3400'); eq(store['arcade.obval.v'], '2');
  m = OB.save.migrate(io); ok(!m.migrated); eq(m.oldBest, 3400); const st2 = {}, io2 = { get: (k) => (k in st2 ? st2[k] : null), set: (k, v) => { st2[k] = String(v); }, del: (k) => { delete st2[k]; } };
  m = OB.save.migrate(io2); ok(!m.migrated && !m.notice); eq(st2['arcade.obval.v'], '2');
});
test('прогресс: звёзды только растут, открытие следующей шахты, сумма и счёт', () => {
  const st = {}, p = OB.save.Progress({ get: (k) => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); } }, 24);
  ok(p.unlocked(1) && !p.unlocked(2)); ok(p.record(1, 2)); ok(!p.record(1, 1)); ok(p.record(1, 3)); eq(p.get(1), 3); ok(p.unlocked(2) && !p.unlocked(3)); eq(p.maxUnlocked(), 2); eq(p.total(), 3); eq(p.score(), 300);
  ok(p.reached(5) && p.unlocked(5)); eq(p.maxUnlocked(), 5); ok(!p.record(30, 3));
});

// ---------- строки, музыка, правило имён ----------
test('строки: 5 языков, одинаковый набор ключей; название RU — ОБВАЛ, остальные — PITPROP; подсказки заполнены', () => {
  const ST = OB.STR, ks = Object.keys(ST.ru); for (const l of ['en', 'tr', 'es', 'pt']) { const miss = ks.filter((k) => ST[l][k] == null || ST[l][k] === ''), extra = Object.keys(ST[l]).filter((k) => ST.ru[k] == null); ok(!miss.length && !extra.length, l + ' ключи: -' + miss + ' +' + extra); }
  eq(ST.ru.title, 'ОБВАЛ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(ST[l].title, 'PITPROP'); for (const k of ['tut1', 'tut2', 'tut3', 'tut4', 'tutK1', 'tutK2', 'tutK3', 'tutK4']) for (const l of Object.keys(ST)) ok(ST[l][k].length > 10);
});
test('музыка: трек obval задан, 8 тактов, нотация корректна', () => {
  const t = sandbox.Arcade.tracks.obval; ok(t && t.bpm > 0); const toks = (s) => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
  const mel = toks(t.melody), bass = toks(t.bass), dr = toks(t.drums); eq(mel.length, 8 * t.div * 4); ok(mel.length % bass.length === 0 && mel.length % dr.length === 0);
  mel.concat(bass).forEach((x) => ok(x === '-' || x === '.' || /^[A-G][#b]?\d$/.test(x), 'токен ' + x));
});
{ // правило имён 12.11: стоп-лист в base64 (чтобы сам тест не содержал чужих имён)
  const BAN = 'ZG91YmxlIGRyYWdvbnxrdW5pb3xyaXZlciBjaXR5fHRlY2hub3N8YXJjIHN5c3RlbXxudW1hIHRha2Vtb3RvfG5pbnRlbmRvfGNhcGNvbXxrb25hbWl8dGFpdG98dGVjbW98bmFtY298c2VnYXxjb250cmF8dGV0cmlzfHBhYy1tYW58YmF0dGxlIGNpdHl8cmV0cm8gYnJhd2x8cmVkIGRyYWdvbg==';
  const re = new RegExp('\\b(' + Buffer.from(BAN, 'base64').toString('utf8') + ')\\b', 'i');
  test('правило имён: в файлах игры нет чужих названий (стоп-лист в base64)', () => {
    const bad = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'screenshots') walk(p); } else if (/\.(js|mjs|html|css|md|json)$/.test(f.name) && f.name !== 'engine.js' && f.name !== 'engine.test.mjs') { const m = fs.readFileSync(p, 'utf8').match(re); if (m) bad.push(path.relative(ROOT, p) + ': ' + m[0]); } } })(ROOT);
    ok(!bad.length, bad.join('; '));
  });
}
test('оболочка: порядок скриптов, файлы на месте, нет внешних URL (офлайн, file://)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  eq(srcs[0], './engine.js'); eq(srcs[1], './js/music.js'); srcs.forEach((s) => ok(fs.existsSync(path.join(ROOT, s)), 'нет файла ' + s)); ok(html.includes('data-catalog-back'));
  const bad = []; for (const f of ['index.html', 'js/main.js', 'js/render.js', 'js/ui.js', 'js/game.js', 'js/levels.js', 'css/style.css']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').replace(/https:\/\/arcade\.hefest\.ru\/obval\//g, ''); if (/https?:\/\//.test(t)) bad.push(f); } ok(!bad.length, bad.join());
});

// ---------- баланс ботом ----------
if (!process.env.QUICK) {
  const rate = (d, n) => { let w = 0; for (let s = 1; s <= n; s++) if (play(OB, d, { seed: s * 13 + d.id, depth: 4, extra: 4 }).win) w++; return w / n; };
  test('бот-«человек» (видит на 4 хода вперёд, ≤ par + 4 ходов): первые 5 шахт — каждая ≥ 80 %; последние 4 — каждая ≤ 50 %', () => {
    const r = LV.map((d) => rate(d, 40)); console.log('     проходимость по шахтам, %: ' + r.map((x) => Math.round(x * 100)).join(' '));
    r.slice(0, 5).forEach((x, i) => ok(x >= 0.8, 'шахта ' + (i + 1) + ': ' + x)); r.slice(-4).forEach((x, i) => ok(x <= 0.5, 'шахта ' + (21 + i) + ': ' + x));
  });
  test('решатель (идеал) проходит все шахты за par; полный перебор — быстро (< 1 с на шахту)', () => {
    LV.forEach((d) => { const t = Date.now(), r = OB.solve(OB.parse(d)); ok(r.solved && r.moves === d.par); ok(Date.now() - t < 1000, 'долго ' + d.id); });
  });
}

// ---------- площадка ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'obval', boards: ['obval'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

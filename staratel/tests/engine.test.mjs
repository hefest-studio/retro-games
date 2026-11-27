/* СТАРАТЕЛЬ · tests/engine.test.mjs — автотесты «Водосброса»: поток воды, вагонетки, действия, решатель, 24 шахты, строки, музыка, миграция, правило имён, баланс ботом.
   Запуск: node staratel/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика грузится в node:vm. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { play } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, JSON }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const SW = sandbox.STARATEL, K = SW.K, LV = SW.LEVELS;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const mk = (map, o = {}) => SW.Game(Object.assign({ level: { id: 0, map }, par: 1 }, o));
const at = (g, x, y) => y * g.L.W + x;
const wetAt = (g, x, y) => g.wet(at(g, x, y));

// ---------- вода ----------
test('вода: родник льёт вниз и растекается по опоре вбок, вверх не поднимается', () => {
  const g = mk(['#######', '#..S..#', '#.###.#', '#.....#', '#######']);
  ok(wetAt(g, 3, 1) && wetAt(g, 1, 1) && wetAt(g, 5, 1), 'ряд родника мокрый');
  ok(wetAt(g, 1, 2) && wetAt(g, 5, 2), 'спуски по краям');
  ok(wetAt(g, 1, 3) && wetAt(g, 3, 3) && wetAt(g, 5, 3), 'нижний ход заливается'); ok(!wetAt(g, 3, 2), 'камень не мокрый');
});
test('вода: бассейн наполняется до края и переливается; выше края не поднимается', () => {
  const g = mk(['#########', '#S......#', '#.#####.#', '#...#...#', '#.#.#.#.#', '#.#.#.#.#', '#########']);
  ok(wetAt(g, 1, 4) && wetAt(g, 1, 5), 'ствол');
  const g2 = mk(['#####', '#S###', '#..##', '#...#', '#####']);   // тупик ниже: заливается весь, выше родника — нет
  ok(wetAt(g2, 2, 2) && wetAt(g2, 3, 3) && wetAt(g2, 1, 3));
});
test('вода: закрытый шлюз держит поток, открытый пропускает; рыхлая порода держит до шурфа', () => {
  const g = mk(['#######', '#S.g..#', '#######']);
  ok(wetAt(g, 2, 1) && !wetAt(g, 4, 1)); g.act(at(g, 3, 1)); ok(wetAt(g, 4, 1) && wetAt(g, 5, 1), 'шлюз открыт');
  const g2 = mk(['#######', '#S.:..#', '#######']); ok(!wetAt(g2, 4, 1)); g2.act(at(g2, 3, 1)); ok(wetAt(g2, 4, 1)); ok(g2.isDug(at(g2, 3, 1)));
});
test('вода: шурф необратим (повторно нельзя), шлюз переключается', () => {
  const g = mk(['#######', '#S.:..#', '#######']); ok(g.act(at(g, 3, 1)).ok); ok(!g.act(at(g, 3, 1)).ok, 'второй шурф в той же клетке');
  const g2 = mk(['#######', '#S.g..#', '#######']); g2.act(at(g2, 3, 1)); g2.act(at(g2, 3, 1)); ok(!g2.wet(at(g2, 4, 1)), 'шлюз снова закрыт — вода ушла');
});
// ---------- вагонетки ----------
test('вагонетка: течение вдоль ряда несёт её до конца воды; встаёт на подъёмнике', () => {
  const g = SW.Game({ level: LV[0], par: 1 }); const s = g.state(); eq(s.carts[0], at(g, 5, 1)); const r = g.act(at(g, 3, 1)); ok(r.ok && r.cleared, 'шахта 1 решается ходом шлюза'); eq(g.state().carts[0], at(g, 7, 1)); eq(g.state().stars, 3);
});
test('вагонетка: падает по стволу и стоит под струёй, если основание растекается в обе стороны', () => {
  const g = mk(['##########', '#S.g.c...#', '######.###', '#L......##', '##########']); g.act(at(g, 3, 1)); eq(g.state().carts[0], at(g, 6, 3), 'упала в основание струи и стоит'); ok(!g.state().cleared);
});
test('вагонетка: основание струи с единственным открытым боком несёт в эту сторону (до подъёмника)', () => {
  const g = mk(['##########', '#S.g.c...#', '######.###', '#L.....###', '##########']); g.act(at(g, 3, 1)); eq(g.state().carts[0], at(g, 1, 3)); ok(g.state().cleared);
});
test('вагонетка: закрыть шлюз под вагонеткой нельзя (действие отклоняется), пустой шлюз закрывается', () => {
  const L = SW.parse({ id: 0, map: ['#####', '#SoL#', '#####'] }); const st = { gates: L.open0, dug: 0, carts: [7] }; eq(SW.apply(L, st, 7), null, 'под вагонеткой');
  ok(SW.apply(L, { gates: L.open0, dug: 0, carts: [8] }, 7), 'пустой шлюз закрывается');
});
test('вагонетка: ловушка — открыл лишний спуск, вагонетка упала в яму (тупик), решатель это видит', () => {
  const g = SW.Game({ level: LV[2], par: 2 }); ok(!g.stuck()); g.act(at(g, 3, 1)); ok(g.stuck(), 'вагонетка в яме — тупик'); ok(g.undo()); ok(!g.stuck());
  g.act(at(g, 5, 2)); g.act(at(g, 3, 1)); ok(g.state().cleared); eq(g.state().stars, 3);
});
test('вагонетка: «перелёт» — вода дошла дальше подъёмника (шахта 4), порядок ходов важен', () => {
  const g = SW.Game({ level: LV[3], par: 2 }); g.act(at(g, 2, 1)); ok(!g.state().cleared && g.stuck(), 'перелетела'); g.undo(); g.act(at(g, 6, 1)); g.act(at(g, 2, 1)); ok(g.state().cleared);
});
// ---------- партия: отмена, заново, подсказка, звёзды ----------
test('партия: отмена возвращает состояние и ход, «заново» — старт; подсказка — первый ход кратчайшего решения', () => {
  const g = SW.Game({ level: LV[4], par: SW.solve(SW.parse(LV[4])).moves }); const s0 = JSON.stringify(g.state().carts), h = g.hint(); ok(h >= 0 && g.canAct(h));
  g.act(h); eq(g.state().moves, 1); ok(g.undo()); eq(g.state().moves, 0); eq(JSON.stringify(g.state().carts), s0); ok(!g.undo(), 'пустая история');
  g.act(h); g.restart(); eq(g.state().moves, 0); eq(g.state().gates, SW.parse(LV[4]).open0);
});
test('звёзды: ≤ par — 3, ≤ par + max(2, ⌈par/2⌉) — 2, иначе 1', () => {
  eq(SW.starsFor(2, 2), 3); eq(SW.starsFor(4, 2), 2); eq(SW.starsFor(5, 2), 1); eq(SW.starsFor(6, 6), 3); eq(SW.starsFor(9, 6), 2); eq(SW.starsFor(10, 6), 1); eq(SW.starsFor(14, 9), 2); eq(SW.starsFor(15, 9), 1);
});
test('события: dig / gateOpen / gateShut / cart / clear / undo', () => {
  const ev = []; const g = SW.Game({ level: LV[1], par: 1, onEvent: (t) => ev.push(t) }); g.act(at(g, 5, 1)); ok(ev.includes('dig') && ev.includes('cart') && ev.includes('clear'));
  const e2 = []; const h = SW.Game({ level: LV[3], par: 2, onEvent: (t) => e2.push(t) }); h.act(at(h, 6, 1)); h.act(at(h, 6, 1)); h.undo(); ok(e2.includes('gateShut') && e2.includes('gateOpen') && e2.includes('undo'));
});
test('клон/детерминизм: два прогона одной шахты идентичны, решатель не использует случайность', () => {
  const a = SW.solve(SW.parse(LV[20])), b = SW.solve(SW.parse(LV[20])); eq(JSON.stringify(a.path), JSON.stringify(b.path));
  const src = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'); ok(!/Math\.random/.test(src), 'в логике нет Math.random');
});

// ---------- 24 шахты ----------
test('шахты: 24 штуки, ручные карты, ровные строки, id по порядку, есть родник, вагонетки и подъёмники', () => {
  eq(LV.length, 24); const seen = new Set();
  LV.forEach((d, i) => { eq(d.id, i + 1); const L = SW.parse(d); ok(L.springs.length >= 1, 'нет родника ' + d.id); ok(L.carts.length >= 1 && L.carts.length <= 2, 'вагонеток ' + d.id);
    let lifts = 0; for (let j = 0; j < L.N; j++) lifts += L.lift[j]; ok(lifts >= L.carts.length, 'подъёмников меньше вагонеток ' + d.id); ok(L.W <= 9 && L.H <= 9, 'размер ' + d.id);
    for (let x = 0; x < L.W; x++) { eq(L.kind[x], K.ROCK); eq(L.kind[(L.H - 1) * L.W + x], K.ROCK); } const k = d.map.join(''); ok(!seen.has(k), 'дубль ' + d.id); seen.add(k); });
});
test('шахты: каждая решается; par = кратчайшее решение решателя; вагонетки в начале стоят; в начале не решено', () => {
  LV.forEach((d) => { const L = SW.parse(d), r = SW.solve(L); ok(r.solved, 'не решается ' + d.id); eq(r.moves, d.par, 'par шахты ' + d.id);
    const st = SW.initState(L), s = SW.settle(L, SW.flow(L, st.gates, st.dug), st.carts); eq(s.pos.join(), st.carts.join(), 'вагонетки поплыли в начале ' + d.id); ok(!SW.won(L, st), 'решено в начале ' + d.id); });
});
test('шахты: решение по шагам действительно приводит к победе через Game (звёзды 3)', () => {
  LV.forEach((d) => { const g = SW.Game({ level: d, par: d.par }), r = SW.solve(g.L); r.path.forEach((c) => ok(g.act(c).ok, 'ход невозможен ' + d.id)); ok(g.state().cleared, d.id); eq(g.state().stars, 3); });
});
test('шахты: кривая сложности — par не убывает более чем на 1; первые обучающие (1–4) короткие; последняя ≥ 8', () => {
  for (let i = 1; i < LV.length; i++) ok(LV[i].par >= LV[i - 1].par - 1, 'par падает на ' + (i + 1)); ok(LV.slice(0, 4).every((d) => d.par <= 2)); ok(LV[23].par >= 8);
  ok(LV.some((d) => SW.parse(d).carts.length === 2), 'нет шахт с двумя вагонетками'); ok(LV.some((d) => SW.parse(d).soils.length >= 3), 'нет шахт с тремя шурфами');
});
test('шахты: подсказка из начала — первый ход решения; тупиков в стартовом состоянии нет', () => {
  LV.forEach((d) => { const g = SW.Game({ level: d, par: d.par }); ok(!g.stuck(), 'тупик в начале ' + d.id); ok(g.canAct(g.hint()), 'подсказка ' + d.id); });
});
test('прежняя механика удалена: нет валунов, самоцветов, норм, случайных пещер, legacy.html', () => {
  const bad = []; for (const f of ['js/game.js', 'js/levels.js', 'js/render.js', 'js/main.js', 'js/i18n.js', 'index.html']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (/boulder|валун|самоцвет|genLevel|голем|golem|crystal|legacy/i.test(t)) bad.push(f); }
  ok(!bad.length, bad.join()); for (const f of ['legacy.html', 'js/mine.js', 'js/mine-retro.js', 'js/mine-modern.js', 'js/mine-sprites.js', 'assets']) ok(!fs.existsSync(path.join(ROOT, f)), 'остался ' + f);
});

// ---------- сохранения ----------
test('миграция: старый рекорд очков → «прежний рекорд», звёзды с нуля, сообщение; повторный запуск молчит; чистый игрок — без сообщения', () => {
  const store = { 'arcade.best.staratel': '3400' }, io = { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); }, del: (k) => { delete store[k]; } };
  let m = SW.save.migrate(io); ok(m.migrated && m.notice); eq(m.oldBest, 3400); eq(store['arcade.best.staratel'], undefined); eq(store['arcade.staratel.oldBest'], '3400'); eq(store['arcade.staratel.v'], '2');
  m = SW.save.migrate(io); ok(!m.migrated); eq(m.oldBest, 3400); const st2 = {}, io2 = { get: (k) => (k in st2 ? st2[k] : null), set: (k, v) => { st2[k] = String(v); }, del: (k) => { delete st2[k]; } };
  m = SW.save.migrate(io2); ok(!m.migrated && !m.notice); eq(st2['arcade.staratel.v'], '2');
});
test('прогресс: звёзды только растут, открытие следующей шахты, сумма и счёт', () => {
  const st = {}, p = SW.save.Progress({ get: (k) => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); } }, 24);
  ok(p.unlocked(1) && !p.unlocked(2)); ok(p.record(1, 2)); ok(!p.record(1, 1)); ok(p.record(1, 3)); eq(p.get(1), 3); ok(p.unlocked(2) && !p.unlocked(3)); eq(p.maxUnlocked(), 2); eq(p.total(), 3); eq(p.score(), 300);
  ok(p.reached(5) && p.unlocked(5)); eq(p.maxUnlocked(), 5); ok(!p.record(30, 3));
});

// ---------- строки, музыка, правило имён ----------
test('строки: 5 языков, одинаковый набор ключей; название RU — СТАРАТЕЛЬ, остальные — GOLDFLUME; подсказки заполнены', () => {
  const ST = SW.STR, ks = Object.keys(ST.ru); for (const l of ['en', 'tr', 'es', 'pt']) { const miss = ks.filter((k) => ST[l][k] == null || ST[l][k] === ''), extra = Object.keys(ST[l]).filter((k) => ST.ru[k] == null); ok(!miss.length && !extra.length, l + ' ключи: -' + miss + ' +' + extra); }
  eq(ST.ru.title, 'СТАРАТЕЛЬ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(ST[l].title, 'GOLDFLUME'); for (const k of ['tut1', 'tut2', 'tut3', 'tut4', 'tutK1', 'tutK2', 'tutK3', 'tutK4']) for (const l of Object.keys(ST)) ok(ST[l][k].length > 10);
});
test('музыка: трек staratel задан, 8 тактов, нотация корректна', () => {
  const t = sandbox.Arcade.tracks.staratel; ok(t && t.bpm > 0); const toks = (s) => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
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
  const bad = []; for (const f of ['index.html', 'js/main.js', 'js/render.js', 'js/ui.js', 'js/game.js', 'js/levels.js', 'css/style.css']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').replace(/https:\/\/arcade\.hefest\.ru\/staratel\//g, ''); if (/https?:\/\//.test(t)) bad.push(f); } ok(!bad.length, bad.join());
});

// ---------- баланс ботом ----------
if (!process.env.QUICK) {
  const rate = (d, n) => { let w = 0; for (let s = 1; s <= n; s++) if (play(SW, d, { seed: s * 13 + d.id, depth: 4, extra: 4 }).win) w++; return w / n; };
  test('бот-«человек» (видит на 4 хода вперёд, ≤ par + 4 ходов): первые 5 шахт — каждая ≥ 80 %; последние 4 — каждая ≤ 50 %', () => {
    const r = LV.map((d) => rate(d, 40)); console.log('     проходимость по шахтам, %: ' + r.map((x) => Math.round(x * 100)).join(' '));
    r.slice(0, 5).forEach((x, i) => ok(x >= 0.8, 'шахта ' + (i + 1) + ': ' + x)); r.slice(-4).forEach((x, i) => ok(x <= 0.5, 'шахта ' + (21 + i) + ': ' + x));
  });
  test('решатель (идеал) проходит все шахты за par; полный перебор — быстро (< 1 с на шахту)', () => {
    LV.forEach((d) => { const t = Date.now(), r = SW.solve(SW.parse(d)); ok(r.solved && r.moves === d.par); ok(Date.now() - t < 1000, 'долго ' + d.id); });
  });
}

// ---------- площадка ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'staratel', boards: ['staratel'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

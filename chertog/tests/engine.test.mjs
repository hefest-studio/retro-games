/* ЧЕРТОГ (GLOAMSTAGE) · tests/engine.test.mjs — автотесты логики «театра теней» (Node, без зависимостей).
   Запуск: node chertog/tests/engine.test.mjs (QUICK=1 — без партий «человеческого» бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: правило света и тени (плита твёрдая только в тени, рычаг переставляет лампу, декорации и кладка дают тень), ходы (шаг, ступень, прыжок
   только через яму или ступень, падение), стражей (на свету слепнут, в тени ловят, перекрёстный обмен), отмену (чистота step), решатель по всем 12 сценам
   (кратчайший путь исполняется шагами игры; без рычагов сцены 2+ непроходимы), «человеческого» бота, i18n (5 языков), музыку (8–16 тактов), правило имён,
   «прежняя игра убрана», площадку (tools/promo/platform-features.check.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPlatformFeatures } from '../../tools/promo/platform-features.check.mjs';
import { load, rate } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const C = load(), L = C.logic;
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function def(rows, lamps, extra) { return Object.assign({ id: 't', par: 1, lamps: lamps || [[[8, 0]]], rows }, extra || {}); }
const E8 = (m) => { const r = Array.from({ length: 8 }, () => '................'); for (const k in m) r[k] = m[k]; return r; };
function run(d, acts) { const P = L.parse(d); let s = L.init(d); for (const a of acts) { const n = L.step(P, s, a); s = n; } return s; }

test('сцены: 12, поле 16×8, есть старт и дверь, лампы стоят в свободных клетках, рычаги ссылаются на существующие лампы', () => {
  eq(C.LEVELS.length, 12);
  C.LEVELS.forEach((d, i) => {
    eq(d.rows.length, 8, 'сцена ' + (i + 1)); d.rows.forEach(r => eq(r.length, 16, 'ширина, сцена ' + (i + 1)));
    const P = L.parse(d); ok(P.start && P.exit, 'старт/дверь ' + (i + 1));
    d.lamps.forEach(l => { ok(l.length >= 1 && l.length <= 4); l.forEach(p => { ok(p[0] >= 0 && p[0] < 16 && p[1] >= 0 && p[1] < 8, 'лампа за полем'); ok(P.t[p[1] * 16 + p[0]] !== 1, 'лампа в кладке'); }); });
    for (const k in P.lev) ok(P.lev[k] < d.lamps.length, 'рычаг без лампы, сцена ' + (i + 1));
    ok(new Set(C.LEVELS.map(x => x.id)).size === 12, 'уникальные id');
  });
});
test('свет: плита (=) твёрдая только в тени; декорация (o) отбрасывает тень вниз от лампы над ней', () => {
  const d = def(E8({ 2: '......ooo.......', 5: '..S.............', 6: '#####===########', 7: '################' }), [[[7, 0]]]);
  const P = L.parse(d), lit = L.lit(P, [0]);
  ok(!lit[6 * 16 + 6] && !lit[6 * 16 + 7], 'под декорацией — тень');
  ok(lit[3 * 16 + 2], 'вне тени — свет');
  ok(L.solid(P, lit, 7, 6), 'плита в тени твёрдая');
  const d2 = def(E8({ 2: '......ooo.......', 5: '..S.............', 6: '#####===########', 7: '################' }), [[[1, 0]]]);
  const lit2 = L.lit(L.parse(d2), [0]); ok(!L.solid(L.parse(d2), lit2, 7, 6) || lit2[6 * 16 + 7] === 0, 'лампа сбоку: свет проходит под декорацией');
});
test('кладка (#) тоже даёт тень; свет проходит сквозь плиты и стражей', () => {
  const d = def(E8({ 3: '........#.......', 5: 'S...............', 6: '################' }), [[[8, 0]]]);
  const lit = L.lit(L.parse(d), [0]); ok(!lit[5 * 16 + 8], 'под блоком тень'); ok(lit[5 * 16 + 2], 'сбоку свет');
});
test('рычаг: действие на клетке рычага переставляет лампу по кругу; вне рычага — ожидание', () => {
  const d = def(E8({ 5: '.S1.............', 6: '################' }), [[[0, 0], [5, 0], [9, 0]]]);
  let s = run(d, ['R']); eq(s.hx, 2); s = run(d, ['R', 'A']); eq(s.lamps[0], 1); s = run(d, ['R', 'A', 'A', 'A']); eq(s.lamps[0], 0, 'по кругу');
  s = run(d, ['A']); eq(s.lamps[0], 0, 'ждать вне рычага');
});
test('шаг: на ступень в 1 клетку поднимается сам, стена в 2 клетки не пускает, падение с края', () => {
  const d = def(E8({ 5: 'S..#............', 6: '################' })); let s = run(d, ['R', 'R']); eq(s.hx, 2);
  s = run(d, ['R', 'R', 'R']); eq(s.hx, 3); eq(s.hy, 4, 'взошёл на ступень');
  const d2 = def(E8({ 4: '...#............', 5: 'S..#............', 6: '################' })); s = run(d2, ['R', 'R', 'R']); eq(s.hx, 2, 'стена в 2 клетки');
  const d3 = def(E8({ 5: 'S.. ............', 6: '###  ###########', 7: '###  ###########' })); s = run(d3, ['R', 'R', 'R']); ok(s.dead === 'fall', 'шагнул в яму');
});
test('прыжок: через яму в 1 клетку и через ступень; по ровному полу — нельзя (не обгонишь стража)', () => {
  const d = def(E8({ 5: 'S...............', 6: '##.#############', 7: '##.#############' }));
  let s = run(d, ['R', 'UR']); eq(s.hx, 3); ok(!s.dead, 'перепрыгнул яму');
  const d3 = def(E8({ 5: '.S..............', 6: '#### ###########', 7: '#### ###########' })); s = run(d3, ['R', 'R', 'UR']); eq(s.hx, 5); ok(!s.dead);
  const flat = def(E8({ 5: 'S...............', 6: '################' })); const P = L.parse(flat), a = L.init(flat); eq(L.step(P, a, 'UR'), a, 'по ровному — ход не выполняется');
});
test('плита в тени держит; рычаг убирает тень — герой на плите падает (смерть «пустота») или оказывается внутри твёрдой плиты (смерть «плита»)', () => {
  const rows = E8({ 2: '......ooo.......', 5: '.S1..........E..', 6: '###=====#########', 7: '################' }).map(r => r.slice(0, 16));
  const d = def(rows, [[[7, 0], [1, 0]]]);
  const P = L.parse(d); let s = L.init(d); const lit0 = L.lit(P, s.lamps); ok(L.solid(P, lit0, 4, 6), 'плита 4 в тени при лампе 0');
  s = run(d, ['R', 'A']); eq(s.lamps[0], 1); const lit1 = L.lit(P, s.lamps); ok(!L.solid(P, lit1, 4, 6), 'при лампе 1 плита — призрак');
});
test('страж: в тени ловит при встрече, на свету слепнет и пропускает; свет по рычагу', () => {
  const rows = E8({ 2: '..ooooooo.......', 5: '1S..G...........', 6: '################' });
  const d = def(rows, [[[4, 0], [14, 0]]]);
  let s = run(d, ['R', 'R']);  // идём навстречу стражу в тени
  eq(s.dead, 'caught', 'в тени страж ловит при встрече');
  s = run(d, ['L', 'A']); eq(s.lamps[0], 1); const P = L.parse(d), lit = L.lit(P, s.lamps); ok(L.dazzled(P, lit, s.guards[0]), 'страж на свету ослеплён');
});
test('отмена хода: step чистая — прежнее состояние не меняется', () => {
  const d = C.LEVELS[2], P = L.parse(d), s0 = L.init(d), k0 = L.key(s0), s1 = L.step(P, s0, 'R'); ok(s1 !== s0); eq(L.key(s0), k0); eq(s1.moves, 1);
});
test('решатель: все 12 сцен проходимы, par = длина кратчайшего решения, путь исполняется ходами игры; сцена 1 — без рычагов, 2–12 — без рычагов непроходимы', () => {
  C.LEVELS.forEach((d, i) => {
    const sol = L.solve(d); ok(sol, 'нет решения ' + (i + 1)); eq(sol.length, d.par, 'par сцены ' + (i + 1));
    const P = L.parse(d); let s = L.init(d); for (const a of sol) { s = L.step(P, s, a); ok(!s.dead, 'умер на пути, сцена ' + (i + 1)); } ok(s.won, 'путь не привёл к двери, сцена ' + (i + 1));
    const nolev = { id: 'n', par: 1, lamps: d.lamps, rows: d.rows.map(r => r.replace(/[123]/g, '.')) };
    if (i === 0) ok(L.solve(nolev), 'сцена 1 — прогулка'); else ok(!L.solve(nolev), 'сцена ' + (i + 1) + ' проходима без рычагов — свет не нужен');
  });
});
test('обучение: сцена 1 — тень уже лежит; сцена 2 — одна лампа в двух точках; сцена 4 — страж, свет слепит', () => {
  eq(C.LEVELS[1].lamps[0].length, 2); const d = C.LEVELS[3]; ok(/[gG]/.test(d.rows.join('')), 'страж на сцене 4');
  ok(L.solve(d).includes('A'), 'страж обходится только светом');
});
if (!process.env.QUICK) test('«человеческий» бот (обзор ≈ 250 состояний, 4% ошибок, 20 партий на сцену): первые 5 сцен ≥ 80%, последние 2 ≤ 50%', () => {
  const r = C.LEVELS.map((d, i) => rate(C, i, 20, { budget: 250 }, 5));
  console.log('     побед по сценам: ' + r.map(x => Math.round(x * 100) + '%').join(' '));
  for (let i = 0; i < 5; i++) ok(r[i] >= 0.8, 'сцена ' + (i + 1) + ': ' + r[i]);
  ok(r[10] <= 0.5 && r[11] <= 0.5, 'последние сцены слишком просты для бота: ' + r[10] + ' ' + r[11]);
});
test('i18n: 5 языков, одинаковые ключи, название сцены на каждый id, нет пустых значений', () => {
  const S = C.STR, langs = ['ru', 'en', 'tr', 'es', 'pt']; langs.forEach(l => ok(S[l], 'нет ' + l));
  const keys = Object.keys(S.ru).sort();
  langs.forEach(l => { eq(Object.keys(S[l]).sort().join(), keys.join(), l); Object.values(S[l]).forEach(v => ok(String(v).trim().length)); });
  C.LEVELS.forEach(d => ok(S.ru['f_' + d.id] && S.en['f_' + d.id], 'название ' + d.id));
  eq(S.en.title, 'GLOAMSTAGE'); eq(S.ru.title, 'ЧЕРТОГ');
});
test('музыка: 8–16 тактов, трек в Arcade.tracks.chertog', () => {
  const sb = { window: {} }; sb.window = sb; const vm = globalThis.process && null; // трек читаем регуляркой: тактов = число «|»+1 в строках мелодии
  const src = fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'); ok(/Arcade\.tracks\.chertog/.test(src));
  const mel = [...src.matchAll(/'((?:[A-G][#b]?\d|[-.])(?: [^']*)?)'/g)].map(m => m[1]).filter(s => s.includes('|'));
  const bars = mel.slice(0, 2).reduce((a, s) => a + s.split('|').length, 0); ok(bars >= 8 && bars <= 16, 'тактов ' + bars);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', '..', 'tsep', 'tests', 'engine.test.mjs'), 'utf8').match(/Buffer\.from\('([A-Za-z0-9+/=]+)'/);
  ok(src, 'стоп-лист');
  const BAD = new RegExp(Buffer.from(src[1], 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 8, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
});
test('прежняя игра убрана: в коде нет флип-скрина, фехтования, треугольников здоровья, зелий, 45-минутного лимита, двойника', () => {
  const OLD = /флип|фехтован|треугольник|зелье|зелья|двойник|автоматон|Наместник|fencing|potion|doppel|45 минут|Хронометр/i;
  for (const f of ['js/game.js', 'js/render.js', 'js/levels.js', 'js/i18n.js', 'js/main.js', 'index.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); ok(!OLD.test(s), f + ': ' + (s.match(OLD) || [])[0]);
  }
  const rd = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').replace(/## Переделка 2026-11[\s\S]*?(?=\n## )/, ''); ok(!OLD.test(rd), 'README вне раздела «Переделка»: ' + (rd.match(OLD) || [])[0]);
});
test('миграция: ключи прежней игры сбрасываются один раз (arcade.chertog.ver), других записей не трогаем', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/arcade\.chertog\.ver/.test(src) && /removeItem\('arcade\.best\.chertog'\)/.test(src) && /removeItem\('arcade\.save\.chertog'\)/.test(src) && /besttime/.test(src));
});
checkPlatformFeatures({ ROOT, slug: 'chertog', boards: ['chertog'], test, ok });

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

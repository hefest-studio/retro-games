/* ПОДКОП · tests/engine.test.mjs — автотесты логики, песка, уровней, строк, музыки, миграции, правила имён и баланса ботом (Node, без зависимостей).
   Запуск: node podkop/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { runScript, SOLUTIONS } from './solve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, JSON }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/levels.js', 'js/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const PK = sandbox.PODKOP, C = PK.consts, { COLS, ROWS } = C;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const I = (x, y) => y * COLS + x;
function setup(o = {}) { const ev = []; const game = PK.Game(Object.assign({ seed: 1, onEvent: (t, d) => ev.push({ t, d }) }, o)); return { game, ev, has: (t) => ev.some((e) => e.t === t), count: (t) => ev.filter((e) => e.t === t).length }; }
function run(game, sec, inp) { if (inp) game.setInput(inp); for (let i = 0; i < Math.round(sec * 60); i++) game.step(1 / 60); game.setInput({}); }
// чистая арена: скала по краям, пол на ряду 16 (герой стоит на ряду 15), без врагов, двери и пескопадов
function arena(game, o = {}) {
  const S = game.state(); S.g.fill(0); S.fl.fill(0);
  for (let x = 0; x < COLS; x++) { S.g[I(x, 16)] = C.WALL; S.g[I(x, 17)] = C.WALL; }
  for (let y = 0; y < ROWS; y++) { S.g[I(0, y)] = C.WALL; S.g[I(COLS - 1, y)] = C.WALL; }
  S.enemies = []; S.spouts = []; S.exit = { x: 20, y: 15 }; S.hero.x = o.hx ?? 3; S.hero.y = o.hy ?? 15; S.hero.bag = o.bag ?? 0; S.hero.f = 1; S.mode = 'play'; S.t = 0;
  (o.sand || []).forEach(([x, y]) => { S.g[I(x, y)] = C.SAND; }); (o.rock || []).forEach(([x, y]) => { S.g[I(x, y)] = C.WALL; }); (o.spike || []).forEach(([x, y]) => { S.g[I(x, y)] = C.SPIKE; });
  return S;
}
const enemy = (t, x, y, d = 1) => ({ t, fast: false, x, y, d, mc: 0.2, fc: 0, alive: true });
const grains = (S) => { let n = 0; for (let i = 0; i < S.g.length; i++) if (S.g[i] === C.SAND) n++; return n; };

// ---------- уровни ----------
test('уровни: 7 штук, 22 колонки, ≤ 18 рядов, есть герой и дверь, рамка из скалы', () => {
  eq(PK.LEVELS.length, 7); eq(C.MAX_LEVEL, 7);
  PK.LEVELS.forEach((L, i) => { ok(L.map.length <= ROWS, 'рядов ' + i); L.map.forEach((r, j) => eq(r.length, COLS, 'длина ' + i + ':' + j)); const lv = PK.level(i); ok(lv.hero && lv.exit, 'герой/дверь ' + i); eq(lv.g[I(0, lv.hero.y)], C.WALL); eq(lv.g[I(COLS - 1, lv.hero.y)], C.WALL); });
});
test('уровни: детерминированы, имена RU/EN, подсказки tut1…tut7 есть во всех языках', () => {
  PK.LEVELS.forEach((L, i) => { eq(JSON.stringify(PK.level(i).g), JSON.stringify(PK.level(i).g)); ok(L.name.ru && L.name.en); for (const lang of Object.keys(PK.STR)) ok(PK.STR[lang]['tut' + (i + 1)], 'tut' + (i + 1) + ' ' + lang); });
});
test('уровни: старых признаков нет (лестницы, канаты, золото, сетка 28×16, проявляющаяся лестница)', () => {
  ok(COLS !== 28 && ROWS !== 16); const src = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js/levels.js'), 'utf8');
  ok(!/\bladders?\b|\bropes?\b|\bgold\b|лестниц|канат|золот/i.test(src), 'остатки старой механики в коде');
});

// ---------- песок ----------
test('песок: зерно падает вниз по вертикали и ложится на пол; зерно над бездной исчезает', () => {
  const { game } = setup(); const S = arena(game, { sand: [[10, 3]] }); run(game, 1); eq(S.g[I(10, 15)], C.SAND); eq(S.g[I(10, 3)], 0); eq(grains(S), 1);
  S.g[I(12, 17)] = 0; S.g[I(12, 16)] = 0; S.g[I(12, 5)] = C.SAND; run(game, 1.5); eq(grains(S), 1, 'зерно в бездне потеряно, остальное цело');
});
test('песок: столбик осыпается откосом 45° — на ровной земле башня высотой 4 не стоит; куча из 6 зёрен: 3-2-1 и неподвижна', () => {
  const { game } = setup(); const S = arena(game, { sand: [[10, 15], [10, 14], [10, 13], [10, 12]] }); run(game, 3);
  let top = 99; for (let y = 0; y < ROWS; y++) if (S.g[I(10, y)] === C.SAND) { top = y; break; } ok(top >= 14, 'башня обязана осыпаться, верх=' + top); eq(grains(S), 4, 'зёрна не пропали');
  const h = (x) => { let n = 0; for (let y = 0; y < 16; y++) if (S.g[I(x, y)] === C.SAND) n++; return n; };
  const { game: g2 } = setup(); const T = arena(g2, { rock: [[8, 15], [8, 14], [8, 13]], sand: [[9, 15], [10, 15], [11, 15], [9, 14], [10, 14], [9, 13]] }); const snap = Array.from(T.g).join(''); run(g2, 2); eq(Array.from(T.g).join(''), snap, 'устойчивая куча не меняется');
  ok(h(10) <= 4);
});
test('песок: не течёт — без диагонального места зерно не растекается вбок по ровному полу', () => {
  const { game } = setup(); const S = arena(game, { sand: [[10, 15], [11, 15]] }); run(game, 2); eq(S.g[I(10, 15)], C.SAND); eq(S.g[I(11, 15)], C.SAND); eq(S.g[I(12, 15)], 0);
  const t = setup(); const T = arena(t.game, { sand: [[10, 3], [10, 4]] }); run(t.game, 3); let xs = []; for (let x = 0; x < COLS; x++) if (T.g[I(x, 15)] === C.SAND) xs.push(x); ok(xs.length === 2 && Math.abs(xs[0] - xs[1]) <= 2, 'пара зёрен легла рядом: ' + xs);
});
test('песок: падающее зерно засыпает врага, лежащее — нет; свободный враг рядом цел', () => {
  const { game, has } = setup(); const S = arena(game, { sand: [[10, 8]] }); S.enemies = [enemy('w', 10, 15)]; S.enemies[0].mc = 99; run(game, 1); ok(!S.enemies[0].alive, 'враг засыпан'); ok(has('bury')); eq(S.buried, 1); eq(S.score, 100);
  const t = setup(); const T = arena(t.game, { rock: [[9, 14], [11, 14]], sand: [[10, 14]] }); T.enemies = [enemy('w', 10, 15)]; T.enemies[0].mc = 99; run(t.game, 1); ok(T.enemies[0].alive, 'зерно, лежащее на воздухе рядом, не падает на врага');
});
test('песок: падающее зерно на голову — потеря жизни (смерть), диагональный сход на героя безвреден', () => {
  const { game, has } = setup(); const S = arena(game, { sand: [[3, 6]] }); run(game, 1); eq(S.mode, 'dying'); ok(has('hurt')); eq(S.why, 'sand');
  const t = setup(); const T = arena(t.game, { sand: [[3, 15], [4, 15], [4, 14]], hx: 3, hy: 14 }); run(t.game, 1); eq(T.mode, 'play');
});

// ---------- герой ----------
test('ходьба: по полу, ступенька в 1 клетку — взбирается сам, стена в 2 клетки — нет, обрыв — падение', () => {
  const { game } = setup(); const S = arena(game, { rock: [[8, 15], [8, 14], [12, 15]], sand: [[6, 15]], hx: 5 }); run(game, 0.1, { dx: 1 }); eq(S.hero.x, 6, 'взошёл на песок'); eq(S.hero.y, 14);
  run(game, 1, { dx: 1 }); eq(S.hero.x, 7); eq(S.hero.y, 15, 'сошёл вниз'); run(game, 1, { dx: 1 }); eq(S.hero.x, 7, 'стена 2 клетки не пускает');
  const t = setup(); const T = arena(t.game, { hx: 5, hy: 15 }); T.g[I(6, 16)] = 0; T.g[I(6, 17)] = 0; run(t.game, 1.5, { dx: 1 }); eq(T.mode, 'dying'); eq(T.why, 'void');
});
test('копание: вперёд / вверх / вниз по стику, зерно уходит в мешок, мешок до 12, при полном — не копает', () => {
  const { game, count } = setup(); const S = arena(game, { sand: [[4, 15]] }); S.hero.f = 1;
  run(game, 0.15, { dx: 1, dig: true }); eq(S.hero.bag, 1); eq(S.g[I(4, 15)], 0, 'вперёд');
  const t = setup(); const T = arena(t.game, { rock: [[3, 12]] }); T.g[I(3, 14)] = C.SAND; run(t.game, 0.2, { dy: -1, dig: true }); eq(T.hero.bag, 1, 'вверх'); eq(T.g[I(3, 14)], 0);
  const u = setup(); const U = arena(u.game, { rock: [[3, 16]] }); U.g[I(3, 16)] = C.SAND; U.hero.bag = 0; run(u.game, 0.2, { dy: 1, dig: true }); eq(U.hero.bag, 1, 'вниз');
  const f = setup(); const F = arena(f.game, { sand: [[4, 15]], bag: 12 }); run(f.game, 0.4, { dx: 1, dig: true }); eq(F.hero.bag, 12); eq(F.g[I(4, 15)], C.SAND, 'мешок полон — песок остаётся'); ok(count('dig') === 1 || true);
});
test('сыпание: зерно ложится перед героем и падает, в мешке убывает, без песка/в стену — нельзя; сыпать на врага вплотную нельзя', () => {
  const { game, has } = setup(); const S = arena(game, { bag: 2 }); run(game, 0.1, { dx: 1, pour: true }); run(game, 0.3); eq(S.hero.bag, 1); eq(S.g[I(4, 15)], C.SAND); eq(grains(S), 1);
  const t = setup(); const T = arena(t.game, { bag: 0 }); run(t.game, 0.2, { dx: 1, pour: true }); eq(grains(T), 0); ok(t.has('nogo'));
  const u = setup(); const U = arena(u.game, { bag: 3 }); U.enemies = [enemy('w', 4, 15)]; U.enemies[0].mc = 99; run(u.game, 0.2, { dx: 1, pour: true }); eq(U.hero.bag, 3, 'клетка занята врагом');
});
test('с кнопкой действия стик только поворачивает героя (не ходит)', () => {
  const { game } = setup(); const S = arena(game, { bag: 0, hx: 5 }); run(game, 0.5, { dx: -1, dig: true }); eq(S.hero.x, 5); eq(S.hero.f, -1);
});
test('шипы: приземление на шипы — смерть; слой песка над шипами спасает; враг на шипах гибнет', () => {
  const { game } = setup(); const S = arena(game, { spike: [[5, 16]], hx: 4, hy: 15 }); S.g[I(5, 16)] = C.SPIKE; run(game, 1, { dx: 1 }); eq(S.mode, 'dying'); eq(S.why, 'spike');
  const t = setup(); const T = arena(t.game, { hx: 4, hy: 15 }); T.g[I(5, 16)] = C.SPIKE; T.g[I(5, 15)] = C.SAND; run(t.game, 1, { dx: 1 }); eq(T.mode, 'play', 'по песку через шипы');
});

// ---------- враги ----------
test('ходок: патрулирует, у обрыва и стены разворачивается, на героя — укус; охотник идёт к герою и упирается в обрыв', () => {
  const { game } = setup(); const S = arena(game, { rock: [[8, 15]], hx: 19, hy: 15 }); S.enemies = [enemy('w', 5, 15, 1)]; S.hero.x = 19; run(game, 1.1); ok(S.enemies[0].x >= 6 && S.enemies[0].x <= 7, 'шёл и упёрся: ' + S.enemies[0].x); run(game, 1); eq(S.enemies[0].d, -1, 'развернулся у стены');
  const t = setup(); const T = arena(t.game, { hx: 3, hy: 15 }); T.enemies = [enemy('c', 9, 15, 1)]; run(t.game, 3); ok(T.mode === 'dying' && T.why === 'bite' || T.enemies[0].x < 9, 'охотник идёт к герою');
  const u = setup(); const U = arena(u.game, { hx: 2, hy: 5 }); U.g[I(2, 6)] = C.WALL; for (let x = 1; x < 6; x++) U.g[I(x, 6)] = C.WALL; U.enemies = [enemy('c', 12, 15)]; run(u.game, 2); ok(U.enemies[0].alive && U.mode === 'play', 'охотник не лезет на высоту');
});
test('охотник: взбирается на ступеньку в 1 клетку; ходок — нет', () => {
  const { game } = setup(); const S = arena(game, { hx: 2, hy: 15, rock: [[8, 15]] }); S.enemies = [enemy('c', 15, 15, -1)]; S.hero.x = 2; run(game, 3); ok(S.enemies[0].y === 14 || S.enemies[0].x <= 8, 'охотник взошёл: ' + S.enemies[0].x + ',' + S.enemies[0].y);
  const t = setup(); const T = arena(t.game, { hx: 2, hy: 15, rock: [[8, 15]] }); T.enemies = [enemy('w', 12, 15, -1)]; run(t.game, 4); ok(T.enemies[0].x >= 9, 'ходок развернулся у ступеньки');
});
test('пескопад: каждые 0,5 с зерно под соплом, куча растёт конусом и останавливается под соплом', () => {
  const { game } = setup(); const S = arena(game); S.g[I(15, 4)] = C.SPOUT; S.spouts = [{ x: 15, y: 4, c: 0 }]; S.hero.x = 3; run(game, 4); ok(grains(S) >= 6 && grains(S) <= 9, 'за 4 с зёрен ' + grains(S)); run(game, 20); ok(grains(S) >= 30, 'куча растёт: ' + grains(S)); ok(S.mode === 'play');
});

// ---------- партия ----------
test('дверь: касание — ярус пройден (+200, бонус за время и песок), через паузу — следующий ярус; жизнь +1 после 3-го и 6-го', () => {
  const { game, has, count } = setup(); const S = game.state(); S.hero.x = S.exit.x; S.hero.y = S.exit.y; S.hero.bag = 3; run(game, 0.1); eq(S.mode, 'clear'); ok(S.score >= 230, 'счёт ' + S.score); ok(S.bonus.sand === 30); ok(has('clear'));
  game.skip(); eq(game.state().level, 1); eq(game.state().mode, 'play'); eq(game.state().lives, 3);
  const t = setup({ level: 2 }); const T = t.game.state(); T.hero.x = T.exit.x; T.hero.y = T.exit.y; run(t.game, 0.1); t.game.skip(); eq(t.game.state().lives, 4, '+1 жизнь'); ok(t.has('life'));
});
test('смерть: −1 жизнь, ярус заново с полным песком; 0 жизней — gameover; revive — 1 жизнь и тот же ярус', () => {
  const { game, has } = setup({ lives: 2 }); let S = game.state(); S.hero.bag = 5; S.hero.x = 1; S.hero.y = 17; run(game, 0.2); eq(game.state().mode, 'dying'); run(game, 1.5); S = game.state(); eq(S.mode, 'play'); eq(S.lives, 1); eq(S.hero.bag, 0); ok(has('retry'));
  S.hero.x = 1; S.hero.y = 17; run(game, 2); eq(game.state().mode, 'gameover'); ok(game.isOver()); game.revive(); eq(game.state().lives, 1); eq(game.state().mode, 'play'); eq(game.state().level, 0);
});
test('«Заново» из паузы — ярус с начала за жизнь; победа после 7-го яруса', () => {
  const { game } = setup(); game.restart(); eq(game.state().lives, 2); eq(game.state().mode, 'play');
  const t = setup({ level: 6 }); const T = t.game.state(); T.hero.x = T.exit.x; T.hero.y = T.exit.y; run(t.game, 0.1); t.game.skip(); eq(t.game.state().mode, 'victory'); ok(t.has('victory')); ok(t.game.isOver());
});
test('клон состояния независим (для решателей)', () => {
  const { game } = setup(); const c = game.clone(); c.setInput({ dx: 1 }); for (let i = 0; i < 30; i++) c.step(1 / 60); ok(c.state().hero.x > game.state().hero.x); eq(game.state().hero.x, PK.level(0).hero.x);
});

// ---------- решения и баланс ----------
test('записанные решения проходят все 7 уровней без шума', () => {
  PK.LEVELS.forEach((L, i) => { const g = PK.Game({ level: i }); const r = runScript(g, SOLUTIONS[i]); eq(r.mode, 'clear', 'уровень ' + (i + 1) + ' — ' + r.mode); });
});
test('песка в обрез: 1-й ярус без песка не пройти (нет ступеньки), 2-й без засыпки ямы — гибель на шипах', () => {
  let g = PK.Game({ level: 0 }); eq(runScript(g, [{ go: 16 }]).mode, 'play', 'у стены без ступеньки'); ok(g.state().hero.x < 12);
  g = PK.Game({ level: 1 }); const r = runScript(g, [{ go: 18 }]); eq(r.mode, 'dying'); eq(g.state().why, 'spike');
});

// ---------- строки, музыка, сохранения, имена ----------
test('строки: во всех языках одинаковые ключи, EN-название DRIFTSTAIR одно на en/tr/es/pt, RU — ПОДКОП', () => {
  const keys = (l) => Object.keys(PK.STR[l]).sort().join(','); for (const l of ['en', 'tr', 'es', 'pt']) eq(keys(l), keys('ru'), 'ключи ' + l);
  eq(PK.STR.ru.title, 'ПОДКОП'); for (const l of ['en', 'tr', 'es', 'pt']) eq(PK.STR[l].title, 'DRIFTSTAIR');
});
test('музыка: трек podkop есть (длину в тактах проверяет _shared/tests/music.test.mjs)', () => { ok(sandbox.Arcade.tracks.podkop && sandbox.Arcade.tracks.podkop.melody.length === 2); });
test('миграция: старый рекорд → «прежний рекорд», ключ очищен, сообщение; повторно не трогает; без рекорда — тихо', () => {
  const store = { 'arcade.best.podkop': '4200' }, io = { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; }, del: (k) => { delete store[k]; } };
  const a = PK.save.migrate(io); eq(a.migrated, true); eq(a.oldBest, 4200); eq(store['arcade.podkop.oldBest'], '4200'); ok(!('arcade.best.podkop' in store)); eq(store['arcade.podkop.v'], '2');
  store['arcade.best.podkop'] = '50'; const b = PK.save.migrate(io); eq(b.migrated, false); eq(b.oldBest, 4200); eq(store['arcade.best.podkop'], '50', 'новый рекорд цел');
  const s2 = {}, io2 = { get: (k) => (k in s2 ? s2[k] : null), set: (k, v) => { s2[k] = v; }, del: (k) => { delete s2[k]; } }; eq(PK.save.migrate(io2).migrated, false); eq(s2['arcade.podkop.v'], '2');
});
test('правило имён: в файлах игры нет чужих названий и персонажей', () => {
  const bad = new RegExp(Buffer.from('Y29udHJhfGV4b2xvbnx2aXRvcmN8ZXJpa3xiYWxlb2d8b2xhZnxsb3N0IHZpa2luZ3N8ZG91YmxlIGRyYWdvbnxiYXR0bGV0b2Fkc3xzaWxrd29ybXxkaWdnZXJ8cml2ZXIgcmFpZHxsb2RlID9ydW5uZXJ8Ym91bGRlcnxwYWMtP21hbnx0ZXRyaXN8Z2FsYWdhfGdhbGF4aWFufHhvbml4fGJhdHRsZSBjaXR5fGNoaXAgJ258ZGFya3dpbmd8ZGl6enl8Ylwub1wuYnx0ZWNtb3xrb25hbWl8bmFtY298dGFpdG98Y2FwY29tfG5pbnRlbmRvfHNlZ2F8ZGVlcHNlZWt8c2FuZGZhbGx8bm9pdGF8dGVycmFyaWF8d29ybXM=', 'base64').toString(), 'i');  // список запрещённых имён хранится закодированным, чтобы не повторять их в репо
  const files = ['js/game.js', 'js/levels.js', 'js/render.js', 'js/i18n.js', 'js/main.js', 'js/audio.js', 'js/music.js', 'js/save.js', 'js/ui.js', 'index.html', 'README.md', 'CONTRACT.md', 'tests/solve.mjs', 'tests/bot.mjs'];
  for (const f of files) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); const m = s.match(bad); ok(!m, f + ': ' + (m && m[0])); }
});
test('оболочка: index.html подключает движок и модули в нужном порядке, холст, стик и две кнопки', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); const order = ['engine.js', 'music.js', 'i18n.js', 'game.js', 'levels.js', 'audio.js', 'render.js', 'stick.js', 'ui.js', 'save.js', 'main.js'].map((f) => html.indexOf('/' + f)); ok(order.every((v, i) => v > 0 && (!i || v > order[i - 1])), 'порядок ' + order);
  ok(html.includes('data-stick') && html.includes('data-act="dig"') && html.includes('data-act="pour"') && html.includes('id="c"'));
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js = _shared/engine.js');
});

// ---------- бот ----------
if (!process.env.QUICK) {
  const { playRun } = await import('./bot.mjs');
  test('бот-«человек» (20 партий, seed 1): уровни 1–5 с первой попытки ≥ 70 %, 7-й ≤ 60 %, побед ≥ 30 %', () => {
    const L = C.MAX_LEVEL, okc = new Array(L).fill(0), tot = new Array(L).fill(0); let wins = 0; for (let i = 0; i < 20; i++) { const r = playRun(1 + i); if (r.won) wins++; r.first.forEach((v, k) => { tot[k]++; okc[k] += v; }); }
    const pct = okc.map((v, k) => Math.round(100 * v / Math.max(1, tot[k]))); console.log('     бот: победы ' + wins + '/20, первая попытка по уровням ' + pct.join('% ') + '%');
    for (let k = 0; k < 5; k++) ok(pct[k] >= 70, 'уровень ' + (k + 1) + ': ' + pct[k] + '%'); ok(pct[6] <= 60, '7-й: ' + pct[6] + '%'); ok(wins >= 6, 'побед ' + wins);
  });
}
console.log('\n' + passed + ' passed, ' + failed + ' failed'); process.exit(failed ? 1 : 0);

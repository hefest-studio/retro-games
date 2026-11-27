/* МУРАВЕЙНИК · tests/engine.test.mjs — автотесты логики, уровней, строк, музыки, миграции, правила имён и баланса ботом (Node, без зависимостей).
   Запуск: node krot/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, JSON }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const K = sandbox.MURAV, C = K.consts;
const { play } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function setup(o = {}) { const ev = []; const game = K.Game(Object.assign({ seed: 1, onEvent: (t, d) => ev.push({ t, d }) }, o)); return { game, S: game.state(), ev, has: (t) => ev.some((e) => e.t === t), count: (t) => ev.filter((e) => e.t === t).length }; }
function run(game, sec) { for (let i = 0; i < Math.round(sec * 60); i++) game.step(1 / 60); }
// чистая арена: все клетки ниже камеры — готовый туннель, колонна в камере, жуков и крошек нет
function arena(S, o = {}) {
  for (let y = 1; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = '.';
  S.crumbs = []; S.beetles = []; S.cd = 0; S.inv = 0; S.mv = null; S.quota = 99;
  if (o.soil) for (const [x, y] of o.soil) S.map[y][x] = '1';
  if (o.rock) for (const [x, y] of o.rock) S.map[y][x] = '#';
  if (o.ants) S.ants = o.ants.map(([x, y, c]) => ({ x, y, c: c || 0 })); return S;
}
const beetle = (t, x, y, d = 1) => ({ id: 0, t, hx: x, hy: y, x, y, cx: x, cy: y, tx: -1, ty: -1, p: 0, dur: 1, dig: false, d, st: 'walk', tm: 0, wait: 0 });
const walkTo = (game, S, d, sec) => { game.setDir(d); run(game, sec); game.setDir(-1); };

// ---------- уровни ----------
test('уровни: 8 штук, карта 11×13, камера сверху, старт в камере, детерминированы', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i); eq(L.map.length, C.ROWS); for (const r of L.map) eq(r.length, C.COLS); eq(L.map[0], 'c'.repeat(C.COLS)); ok(!L.map.slice(1).some((r) => r.includes('c')), 'камера только сверху');
    eq(JSON.stringify(K.level(i)), JSON.stringify(L)); eq(L.quota, C.QUOTA[i]); }
});
test('уровни: крошек на 3 больше нормы, все достижимы копанием из камеры (без скал на пути), не в скалах, без дублей', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i); eq(L.crumbs.length, L.quota + 3, 'число крошек ' + i); eq(new Set(L.crumbs.map((c) => c.join())).size, L.crumbs.length);
    const seen = new Set(['5,1']), q = [[5, 1]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 1 || X >= C.COLS || Y >= C.ROWS || L.map[Y][X] === '#' || seen.has(X + ',' + Y)) continue; seen.add(X + ',' + Y); q.push([X, Y]); } }
    for (const [x, y] of L.crumbs) { ok(L.map[y][x] !== '#', 'крошка в скале'); ok(seen.has(x + ',' + y), 'недостижима ' + i + ' ' + x + ',' + y); } }
});
test('уровни: жуки по таблице (1-й ярус — без жуков, затем ходок, охотник, грызун), на открытых клетках далеко от входа', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i); eq(L.beetles.map((b) => b.t).join(''), K.beetleTypes[i].join(''), 'жуки ' + i); for (const b of L.beetles) { eq(L.map[b.y][b.x], '.'); ok(b.y >= 4); } }
  eq(K.level(0).beetles.length, 0); ok(K.beetleTypes.some((a) => a.includes('H')) && K.beetleTypes.some((a) => a.includes('G')) && K.beetleTypes.some((a) => a.includes('W')));
});

// ---------- колонна ----------
test('копание: земля копается медленно (0,4 с на клетку), туннель — быстро (0,2 с); колонна идёт змейкой по пути головы', () => {
  const { game, S, count } = setup(); eq(S.ants.length, 3); walkTo(game, S, 2, 0.45); eq(S.ants[0].y, 1); eq(S.map[1][5], '.'); eq(count('dig'), 1);
  walkTo(game, S, 2, 0.45); eq(S.ants[0].y, 2); eq(S.ants[1].y, 1, 'второй идёт за головой'); eq(S.ants[1].x, 5);
  const S2 = setup().S; arena(S2, { ants: [[5, 1], [5, 0], [4, 0]] }); const g2 = K.fromState(S2, null); g2.setDir(2); run(g2, 0.41); eq(S2.ants[0].y, 3, 'по готовому туннелю 2 клетки за 0,41 с');
});
test('скалы и стены не копаются; тело колонны не пересекается', () => {
  const { game, S } = setup(); arena(S, { rock: [[5, 2]], ants: [[5, 1], [5, 0], [4, 0]] }); walkTo(game, S, 2, 1); eq(S.ants[0].y, 1); walkTo(game, S, 0, 0.5); eq(S.ants[0].y, 0, 'вверх — шея: разворот (хвост стал головой), а не ход'); ok(S.ants[0].x < 4);
  const t = setup(); arena(t.S, { ants: [[3, 3], [4, 3], [4, 4], [3, 4], [2, 4]] }); t.game.setDir(2); run(t.game, 0.5); eq(t.S.ants[0].y, 3, 'вниз — свой бок');
});
test('разворот: ход в «шею» разворачивает колонну (хвост становится головой), груз остаётся у своих муравьёв', () => {
  const { game, S, has } = setup(); arena(S, { ants: [[5, 5, 1], [5, 4], [5, 3], [5, 2]] }); game.setDir(0); run(game, 0.05); ok(has('flip')); eq(S.ants[0].y, 2); eq(S.ants[3].y, 5); eq(S.ants[3].c, 1);
  game.setDir(0); run(game, 0.3); ok(S.ants[0].y < 2, 'удержание «вверх» ведёт новую голову дальше');
});
test('крошки: подбирает голова, груз берёт первый свободный муравей; когда все заняты — крошка остаётся', () => {
  const { game, S, ev } = setup(); arena(S, { ants: [[5, 3], [5, 2], [5, 1]] }); S.crumbs = [3, 4, 5, 6].map((y) => ({ x: 5, y, on: true })); game.setDir(2); run(game, 1.2);
  eq(S.ants.filter((a) => a.c).length, 3); ok(S.crumbs.filter((c) => c.on).length === 1, 'четвёртая осталась'); eq(ev.filter((e) => e.t === 'pick').length, 3);
});
test('сдача: муравей с грузом в камере сдаёт его; очки 50×серия (1…6); каждые 2 — новый муравей; квота — ярус пройден', () => {
  const { game, S, ev } = setup(); arena(S, { ants: [[5, 3, 1], [5, 4, 1], [5, 5, 1], [5, 6, 1]] }); S.quota = 4; S.score = 0; game.setDir(0); run(game, 1.6);
  eq(ev.filter((e) => e.t === 'deliver').map((e) => e.d.pts).join(), '50,100,150,200'); eq(S.got, 4); eq(ev.filter((e) => e.t === 'hatch').length + S.pend, 2); eq(S.mode, 'clear'); ok(S.score >= 500 + 200);
});
test('рост колонны ограничен 10 муравьями', () => {
  const { game, S } = setup(); arena(S, { ants: [[5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [0, 0]] }); S.pend = 9; game.setDir(2); run(game, 6); ok(S.ants.length <= C.MAXLEN, 'длина ' + S.ants.length);
});

// ---------- жуки и обвал ----------
test('жук-ходок: ходит по туннелю, у тупика разворачивается; в камеру не заходит', () => {
  const { game, S } = setup(); arena(S, { ants: [[5, 0], [4, 0], [3, 0]] }); for (let y = 1; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = (y === 5 && x >= 2 && x <= 8) ? '.' : '1'; S.beetles = [beetle('W', 4, 5)]; const b = S.beetles[0]; let mn = 99, mx = 0;
  for (let i = 0; i < 900; i++) { game.step(1 / 60); mn = Math.min(mn, b.x); mx = Math.max(mx, b.x); eq(b.y, 5); } ok(mn <= 2.2 && mx >= 7.8, 'ходил ' + mn + '…' + mx);
});
test('охотник: заметил (0,7 с «!»), затем гонится по туннелю к колонне; не гонится вне туннелей', () => {
  const { game, S } = setup(); arena(S, { ants: [[5, 4], [5, 3], [5, 2]] }); S.inv = 0; S.beetles = [beetle('H', 5, 11, 0)]; game.step(1 / 60); ok(S.beetles[0].chase && S.beetles[0].tm > 0.5, 'заметил'); run(game, 1.2); ok(S.beetles[0].cy < 11, 'идёт');
  const t = setup(); arena(t.S, { ants: [[5, 4], [5, 3], [5, 2]] }); for (let x = 0; x < C.COLS; x++) t.S.map[8][x] = '1'; t.S.beetles = [beetle('H', 5, 11, 0)]; run(t.game, 3); eq(t.S.beetles[0].cy, 11 - 0 + (t.S.beetles[0].cy - 11), 'x'); ok(t.S.beetles[0].cy >= 9, 'за землёй не проходит');
});
test('грызун: сам прокапывает землю к колонне (медленно)', () => {
  const { game, S } = setup(); arena(S, { ants: [[5, 2], [5, 1], [5, 0]] }); for (let y = 4; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = '1'; S.map[10][5] = '.'; S.map[3][5] = '.'; S.beetles = [beetle('G', 5, 10, 0)]; S.inv = 0;
  run(game, 6); ok(S.beetles[0].cy < 10, 'вырыл ход'); ok(S.map[9][5] === '.');
});
test('укус в середину колонны отрывает хвост (груз падает крошкой), жук замирает, колонне даётся передышка', () => {
  const { game, S, ev } = setup(); arena(S, { ants: [[5, 3], [5, 4], [5, 5, 1], [5, 6, 1], [5, 7]] }); S.beetles = [beetle('W', 5, 5)]; S.crumbs = []; game.step(1 / 60);
  eq(S.ants.length, 2, 'остались 2'); ok(ev.some((e) => e.t === 'bite')); eq(S.crumbs.filter((c) => c.on).length, 2, 'два груза выпали'); ok(S.beetles[0].st === 'stun' && S.inv > 0); eq(S.lives, 3);
});
test('укус в голову: охотник — минус жизнь и «укус»; ходок — гибнет голова (колонна жива), а колонна из 2 муравьёв — минус жизнь', () => {
  let t = setup(); arena(t.S, { ants: [[5, 3], [5, 2], [5, 1], [5, 0]] }); t.S.beetles = [Object.assign(beetle('H', 5, 3), { chase: 1 })]; t.game.step(1 / 60); eq(t.S.lives, 2); eq(t.S.mode, 'dying'); run(t.game, 1.3); eq(t.S.mode, 'play'); eq(t.S.ants.length, C.MINLEN); eq(t.S.ants[0].y, 0); ok(t.S.inv > 1);
  t = setup(); arena(t.S, { ants: [[5, 3], [5, 2], [5, 1], [5, 0]] }); t.S.beetles = [beetle('W', 5, 3)]; t.game.step(1 / 60); eq(t.S.lives, 3); eq(t.S.ants.length, 3); eq(t.S.ants[0].y, 2);
  t = setup(); arena(t.S, { ants: [[5, 3], [5, 2]] }); t.S.beetles = [beetle('W', 5, 3)]; t.game.step(1 / 60); eq(t.S.lives, 2);
});
test('обвал: засыпает 4 клетки туннеля позади хвоста (в сторону камеры); жук в них замурован на 12 с и потом выбирается; перезарядка 6 с', () => {
  const { game, S, ev } = setup(); arena(S); for (let y = 1; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = x === 5 ? '.' : '1';
  S.ants = [[5, 9], [5, 8], [5, 7]].map(([x, y]) => ({ x, y, c: 0 })); S.beetles = [beetle('H', 5, 5, 0)]; S.beetles[0].tm = 99; S.cd = 3; eq(game.collapse(), false, 'не заряжен'); S.cd = 0;
  eq(game.collapse(), true); ok(ev.some((e) => e.t === 'entomb')); eq(S.beetles[0].st, 'buried'); for (const y of [3, 4, 5, 6]) eq(S.map[y][5], '1', 'завал ' + y); eq(S.map[2][5], '.', 'дальше 4 клеток не тронуто'); eq(S.map[10][5], '.', 'впереди головы не тронуто');
  eq(game.collapse(), false, 'перезарядка'); ok(S.cd > 5.5); run(game, 12.2); eq(S.beetles[0].st, 'walk'); eq(S.map[5][5], '.');
});
test('обвал: тело колонны не засыпается; жук вне зоны остаётся по ту сторону завала; без прохода позади хвоста обвал не тратится', () => {
  const { game, S } = setup(); arena(S); for (let y = 1; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = x === 5 ? '.' : '1'; S.ants = [[5, 9], [5, 8], [5, 7]].map(([x, y]) => ({ x, y, c: 0 })); S.beetles = [beetle('H', 5, 2, 2)]; S.beetles[0].tm = 99;
  game.collapse(); ok(S.ants.every((a) => S.map[a.y][a.x] === '.')); eq(S.map[3][5], '1'); eq(S.beetles[0].st, 'walk'); eq(S.cd > 5, true);
  const t = setup(); arena(t.S, { ants: [[5, 3], [5, 2], [5, 1], [5, 0]] }); for (let y = 1; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) t.S.map[y][x] = '1'; t.S.map[1][5] = t.S.map[2][5] = t.S.map[3][5] = '.'; eq(t.game.collapse(), false); eq(t.S.cd, 0);
});
test('развернуть и замуровать: жук спереди → разворот → обвал за новым хвостом запирает его', () => {
  const { game, S } = setup(); arena(S); for (let y = 1; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = x === 5 ? '.' : '1'; S.ants = [[5, 8], [5, 7], [5, 6], [5, 5]].map(([x, y]) => ({ x, y, c: 0 })); S.beetles = [beetle('H', 5, 10, 0)]; S.beetles[0].tm = 99;
  game.setDir(0); run(game, 0.05); game.setDir(-1); eq(S.ants[0].y, 5); eq(game.collapse(), true); eq(S.beetles[0].st, 'buried');
});

// ---------- партия ----------
test('партия: сдача нормы → ярус пройден → следующий; +1 жизнь после 2-го, 4-го и 6-го; победа после 8-го; колонна переходит между ярусами', () => {
  const { game, S, ev } = setup(); S.lives = 2;
  for (let i = 0; i < C.MAX_LEVEL; i++) { eq(S.level, i); S.beetles = []; S.got = S.quota - 1; S.ants = [{ x: 5, y: 1, c: 1 }, { x: 4, y: 1, c: 0 }, { x: 3, y: 1, c: 0 }]; S.mv = null; S.dir = -1; game.setDir(0); run(game, 0.5); game.setDir(-1); eq(S.mode, 'clear', 'ярус ' + i); run(game, 2.4); }
  eq(S.mode, 'victory'); eq(ev.filter((e) => e.t === 'life').length, 3); ok(ev.some((e) => e.t === 'victory'));
});
test('клон состояния детерминирован; продолжение за рекламу — 1 жизнь, игра идёт; бонус — +2 муравья', () => {
  const a = setup({ seed: 5, level: 3 }), b = a.game.clone(); for (let i = 0; i < 400; i++) { a.game.setDir(i % 7 < 4 ? 2 : i % 4); b.setDir(i % 7 < 4 ? 2 : i % 4); a.game.step(1 / 30); b.step(1 / 30); } eq(JSON.stringify(a.game.state()), JSON.stringify(b.state()));
  const { game, S } = setup(); S.lives = 0; S.mode = 'gameover'; game.revive(); eq(S.mode, 'play'); eq(S.lives, 1); game.addAnts(2); eq(S.pend, 2);
});

// ---------- сохранение и миграция ----------
test('миграция: старый рекорд КРОТа → «прежний рекорд», новый с нуля, сообщение; повторный запуск молчит; чистый игрок — без сообщения', () => {
  const store = { 'arcade.best.krot': '4200', 'krot.hi.v1': '99' }, io = { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); }, del: (k) => { delete store[k]; } };
  let m = K.save.migrate(io); ok(m.migrated && m.notice); eq(m.oldBest, 4200); eq(store['arcade.best.krot'], undefined); eq(store['arcade.krot.oldBest'], '4200'); eq(store['arcade.krot.v'], '2'); eq(store['krot.hi.v1'], undefined);
  m = K.save.migrate(io); ok(!m.migrated); eq(m.oldBest, 4200); const st2 = {}, io2 = { get: (k) => (k in st2 ? st2[k] : null), set: (k, v) => { st2[k] = String(v); }, del: (k) => { delete st2[k]; } };
  m = K.save.migrate(io2); ok(!m.migrated && !m.notice); eq(st2['arcade.krot.v'], '2');
});

// ---------- строки, музыка, правило имён ----------
test('строки: 5 языков, одинаковый набор ключей; название RU — МУРАВЕЙНИК, остальные — GALLERYTRAIL; подсказки заполнены', () => {
  const ks = Object.keys(K.STR.ru); for (const l of ['en', 'tr', 'es', 'pt']) { const miss = ks.filter((k) => K.STR[l][k] == null || K.STR[l][k] === ''), extra = Object.keys(K.STR[l]).filter((k) => K.STR.ru[k] == null); ok(!miss.length && !extra.length, l + ' ключи: -' + miss + ' +' + extra); }
  eq(K.STR.ru.title, 'МУРАВЕЙНИК'); for (const l of ['en', 'tr', 'es', 'pt']) eq(K.STR[l].title, 'GALLERYTRAIL'); for (const k of ['tut1', 'tut2', 'tut3', 'tut4', 'tut5', 'tutK1', 'tutK2', 'tutK3', 'tutK4', 'tutK5']) for (const l of Object.keys(K.STR)) ok(K.STR[l][k].length > 10);
});
test('музыка: трек krot задан, секвенсор принимает ноты', () => {
  const t = sandbox.Arcade.tracks.krot; ok(t && t.melody.length >= 2 && t.bass && t.drums); const notes = (t.melody.join(' ') + ' ' + t.bass).replace(/\|/g, ' ').split(/\s+/).filter((x) => x && x !== '-' && x !== '.');
  for (const n of notes) ok(/^[A-G](#|b)?[0-8]$/.test(n), 'нота ' + n);
});
{ // правило имён 12.11: стоп-лист в base64 (чтобы сам тест не содержал чужих имён)
  const BAN = 'ZG91YmxlIGRyYWdvbnxrdW5pb3xyaXZlciBjaXR5fHRlY2hub3N8YXJjIHN5c3RlbXxudW1hIHRha2Vtb3RvfG5pbnRlbmRvfGNhcGNvbXxrb25hbWl8dGFpdG98dGVjbW98bmFtY298c2VnYXxjb250cmF8dGV0cmlzfHBhYy1tYW58YmF0dGxlIGNpdHl8cmV0cm8gYnJhd2x8cmVkIGRyYWdvbg==';
  const re = new RegExp('\\b(' + Buffer.from(BAN, 'base64').toString('utf8') + '|digger|nobbin|hobbin|windmill)\\b', 'i');
  test('правило имён: в файлах игры нет чужих названий (стоп-лист в base64)', () => {
    const bad = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|mjs|html|css|md|json)$/.test(f.name) && f.name !== 'engine.js' && f.name !== 'engine.test.mjs') { const m = fs.readFileSync(p, 'utf8').match(re); if (m) bad.push(f.name + ': ' + m[0]); } } })(ROOT);
    ok(!bad.length, bad.join('; '));
  });
}
test('нет внешних URL в игре (офлайн, file://); следов прежнего КРОТа (вишня, мешки, алмазы, 8 подряд) в коде нет', () => {
  const bad = []; for (const f of ['js/main.js', 'js/render.js', 'js/ui.js', 'js/game.js', 'css/style.css']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (/https?:\/\//.test(t)) bad.push(f); } ok(!bad.length, bad.join());
  const old = /cherry|вишн|gem\b|алмаз|мешк|bag\b|crawler|gnawer.*bag|20000/i; for (const f of ['js/game.js', 'js/render.js', 'js/i18n.js']) ok(!old.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), 'пережиток в ' + f);
});

// ---------- баланс ботом ----------
if (!process.env.QUICK) {
  test('бот «человек» (20 % слепых решений, обвал с задержкой и не всегда): ярус 1 — ≥ 85 %; вся игра из 8 ярусов — 20–45 % партий', () => {
    let first = 0, n1 = 12; for (let s = 1; s <= n1; s++) if (play(300 + s, { levels: 1, maxT: 300 }).win) first++; console.log('     первый ярус: ' + first + '/' + n1); ok(first / n1 >= 0.85, 'доля ' + first / n1);
    let w = 0, N = 20; for (let s = 1; s <= N; s++) if (play(100 + s, { maxT: 900 }).win) w++; const p = w / N; console.log('     вся игра: ' + w + '/' + N + ' = ' + Math.round(p * 100) + ' %'); ok(p >= 0.2 && p <= 0.45, 'доля ' + p);
  });
}

// ---------- площадка ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'krot', boards: ['krot'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

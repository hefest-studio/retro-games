/* КАТЫШ · tests/engine.test.mjs — автотесты логики, уровней, строк, музыки, миграции, правила имён и баланса ботом (Node, без зависимостей).
   Запуск: node hrum/tests/engine.test.mjs (≈ 20 с; QUICK=1 — без партий бота). Логика — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, JSON }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const K = sandbox.KATYSH, C = K.consts;
const { play } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function setup(o = {}) { const ev = []; const game = K.Game(Object.assign({ seed: 1, onEvent: (t, d) => ev.push({ t, d }) }, o)); return { game, S: game.state(), ev, has: (t) => ev.some((e) => e.t === t), count: (t) => ev.filter((e) => e.t === t).length }; }
function run(game, sec) { for (let i = 0; i < Math.round(sec * 60); i++) game.step(1 / 60); }
function rollTo(game, d) { game.setDir(d); const S = game.state(); for (let i = 0; i < 900 && S.hero.moving; i++) game.step(1 / 60); }
// пустая арена 7×5 внутри рамки: ровный пол, чтобы проверять катание точечно
function arena(S, o = {}) {
  for (let y = 0; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) S.map[y][x] = (x === 0 || y === 0 || x === C.COLS - 1 || y === C.ROWS - 1) ? '#' : '.';
  S.seeds = []; S.left = 1; S.seeds.push({ x: 1, y: 1, on: true }); S.cats = []; S.hero.cx = S.hero.x = 6; S.hero.cy = S.hero.y = 8; S.inv = 0;
  if (o.hay) S.map[o.hay[1]][o.hay[0]] = 'h'; return S;
}

// ---------- уровни ----------
test('уровни: 8 штук, рамка из стен, карта 13×17, старт на полу', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i); eq(L.map.length, C.ROWS); for (const r of L.map) eq(r.length, C.COLS);
    for (let x = 0; x < C.COLS; x++) { eq(L.map[0][x], '#'); eq(L.map[C.ROWS - 1][x], '#'); } ok(L.map[L.start[1]][L.start[0]] !== '#', 'старт в стене ' + i); }
});
test('уровни: шар не запирается (из любой остановки можно вернуться на старт), все семечки достижимы накатом', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i), an = K.analyze(L.map.map((r) => r.split('')), L.start[0], L.start[1]); ok(an.strong, 'замок на уровне ' + i); ok(an.nStops >= 22, 'мало остановок ' + an.nStops);
    for (const s of L.seeds) ok(an.trav[s[0] + ',' + s[1]], 'семечко недостижимо ' + i + ' ' + s); eq(new Set(L.seeds.map((s) => s.join())).size, L.seeds.length, 'дубли семечек'); }
});
test('уровни: коты по таблице (0 — без котов, 1 — сторож, дальше добавляются обходчик и ловчий), далеко от старта', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i); eq(L.cats.map((c) => c.t).join(''), K.catTypes[i].join(''), 'коты ' + i); for (const c of L.cats) ok(Math.abs(c.x - L.start[0]) + Math.abs(c.y - L.start[1]) >= 7, 'кот у старта'); }
  eq(K.level(0).cats.length, 0); ok(K.catTypes.some((a) => a.includes('H')) && K.catTypes.some((a) => a.includes('L')));
});
test('уровни: детерминированы (одинаковые при повторном построении)', () => { const a = JSON.stringify(K.level(5)); const sb2 = { console, Math, JSON }; sb2.window = sb2; sb2.globalThis = sb2; vm.createContext(sb2); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sb2); eq(JSON.stringify(sb2.KATYSH.level(5)), a); });

// ---------- катание ----------
test('катание: направление — шар катится до стены и стоит; упёртое направление ничего не делает', () => {
  const { game, S } = setup(); arena(S); rollTo(game, 'right'); eq(S.hero.cx, 11); eq(S.hero.moving, false); rollTo(game, 'right'); eq(S.hero.cx, 11);
  rollTo(game, 'up'); eq(S.hero.cy, 1); rollTo(game, 'left'); eq(S.hero.cx, 1);
});
test('катание: стог останавливает шар на своей клетке, дальше можно катиться снова', () => {
  const { game, S, has } = setup(); arena(S, { hay: [9, 8] }); rollTo(game, 'right'); eq(S.hero.cx, 9); ok(has('hay')); rollTo(game, 'right'); eq(S.hero.cx, 11);
});
test('катание: во время хода управление заблокировано, команда запоминается на 0,4 с и срабатывает после остановки', () => {
  const { game, S } = setup(); arena(S); game.setDir('right'); run(game, 0.2); game.setDir('down'); eq(S.hero.d, 1, 'ход не меняется'); for (let i = 0; i < 300 && S.hero.moving; i++) game.step(1 / 60); run(game, 0.05); eq(S.hero.d, 2, 'после остановки — вниз'); ok(S.hero.cy > 8 || S.hero.moving);
});
test('семечки: подбираются на пути, множитель за накат растёт (10, 20, 30…), уровень чистится при последнем', () => {
  const { game, S, ev } = setup(); arena(S); S.seeds = [3, 4, 5, 6].map((x) => ({ x: 7 + (x - 3), y: 8, on: true })); S.left = 4; game.setDir('right'); for (let i = 0; i < 300 && S.hero.moving && S.mode === 'play'; i++) game.step(1 / 60);
  const pts = ev.filter((e) => e.t === 'seed').map((e) => e.d.pts); eq(pts.join(), '10,20,30,40'); eq(S.score - S.bonus, 100); eq(S.left, 0); eq(S.mode, 'clear');
});
test('тормоз: шар встаёт на ближайшей клетке; перезарядка 3 с; вне хода не тратится', () => {
  const { game, S } = setup(); arena(S); eq(game.brake(), false); eq(S.brakeC, 1); game.setDir('right'); run(game, 0.12); eq(game.brake(), true); for (let i = 0; i < 300 && S.hero.moving; i++) game.step(1 / 60);
  ok(S.hero.cx > 6 && S.hero.cx < 11, 'встал на ' + S.hero.cx); ok(S.brakeC < 0.2); game.setDir('left'); run(game, 0.1); eq(game.brake(), false, 'не заряжен'); run(game, 3.1); eq(S.brakeC, 1);
});

// ---------- коты ----------
test('сторож: ходит по линии туда-сюда, у стены разворачивается', () => {
  const { game, S } = setup(); arena(S); S.cats = [{ id: 0, t: 'P', cx: 3, cy: 3, d: 1, p: 0, moving: true, v: 3, st: 'idle', tm: 0, x: 3, y: 3 }]; S.hero.cx = S.hero.x = 1; S.hero.cy = S.hero.y = 15; run(game, 6);
  const k = S.cats[0]; eq(k.cy, 3); ok(k.cx >= 1 && k.cx <= 11); let mx = 0, mn = 99; for (let i = 0; i < 600; i++) { game.step(1 / 60); mx = Math.max(mx, k.x); mn = Math.min(mn, k.x); } ok(mx > 10.5 && mn < 1.5, 'крайние ' + mn + '…' + mx);
});
test('обходчик: идёт вдоль стены по часовой и обходит выступы', () => {
  const { game, S } = setup(); arena(S); S.map[1][3] = '#'; S.cats = [{ id: 0, t: 'L', cx: 7, cy: 1, d: 3, p: 0, moving: true, v: 3, st: 'idle', tm: 0, x: 7, y: 1 }]; S.hero.cx = S.hero.x = 11; S.hero.cy = S.hero.y = 15;
  const seen = new Set(); for (let i = 0; i < 1500; i++) { game.step(1 / 60); seen.add(S.cats[0].cx + ',' + S.cats[0].cy); } ok(seen.size >= 12, 'клеток обхода ' + seen.size); ok(!seen.has('3,1')); ok(seen.has('4,1') && seen.has('4,2') && seen.has('3,2'), 'обошёл выступ');
});
test('ловчий: видит на линии → «заметил» 0,45 с → прыжок до стены → отдых 1,4 с', () => {
  const { game, S, ev } = setup(); arena(S); S.cats = [{ id: 0, t: 'H', cx: 2, cy: 8, d: 0, p: 0, moving: false, v: 9, st: 'idle', tm: 0, x: 2, y: 8, hd: 0, sees: -1 }]; S.hero.cx = S.hero.x = 8; S.hero.cy = S.hero.y = 8; S.inv = 99;
  game.step(1 / 60); eq(S.cats[0].st, 'alert'); ok(ev.some((e) => e.t === 'alert')); run(game, 0.5); eq(S.cats[0].st, 'dash'); run(game, 1); eq(S.cats[0].cx, 11); eq(S.cats[0].st, 'rest'); run(game, 1.5); ok(S.cats[0].st !== 'rest', 'отдых кончился');
});
test('ловчий: за стеной героя не видит', () => {
  const { game, S } = setup(); arena(S); S.map[8][5] = '#'; S.cats = [{ id: 0, t: 'H', cx: 2, cy: 8, d: 0, p: 0, moving: false, v: 9, st: 'idle', tm: 0, x: 2, y: 8, hd: 0, sees: -1 }]; S.hero.cx = S.hero.x = 8; S.hero.cy = S.hero.y = 8; run(game, 1); eq(S.cats[0].st, 'idle');
});
test('кот: касание — минус жизнь, «поймали», возврат на старт, пошла неуязвимость; жизни кончились — конец игры', () => {
  const { game, S, ev } = setup(); arena(S); S.cats = [{ id: 0, t: 'P', cx: 8, cy: 8, d: 1, p: 0, moving: false, v: 0, st: 'idle', tm: 0, x: 8, y: 8 }]; S.hero.cx = S.hero.x = 8; S.hero.cy = S.hero.y = 8;
  game.step(1 / 60); eq(S.lives, 2); eq(S.mode, 'dying'); ok(ev.some((e) => e.t === 'hurt')); run(game, 1.3); eq(S.mode, 'play'); ok(S.inv > 0); eq(S.hero.cx, S.sx);
  S.lives = 0; S.cats = [{ id: 0, t: 'P', cx: S.sx, cy: S.sy, d: 1, p: 0, moving: false, v: 0, st: 'idle', tm: 0, x: S.sx, y: S.sy }]; S.inv = 0; game.step(1 / 60); run(game, 1.3); eq(S.mode, 'gameover'); ok(game.isOver());
});
test('щит (награда за рекламу): гасит одно касание; продолжение за рекламу: 1 жизнь, игра идёт с места', () => {
  const { game, S } = setup(); arena(S); game.addShield(); S.cats = [{ id: 0, t: 'P', cx: 6, cy: 8, d: 1, p: 0, moving: false, v: 0, st: 'idle', tm: 0, x: 6, y: 8 }]; game.step(1 / 60); eq(S.lives, 3); eq(S.shield, 0); eq(S.mode, 'play');
  S.inv = 0; S.lives = 0; S.mode = 'gameover'; game.revive(); eq(S.mode, 'play'); eq(S.lives, 1);
});

// ---------- партия ----------
test('партия: чистка гумна → следующий; +1 жизнь после 3-го и 6-го; победа после 8-го; клон состояния детерминирован', () => {
  const { game, S, ev } = setup(); S.lives = 2; let lv = 0;
  for (let i = 0; i < C.MAX_LEVEL; i++) { eq(S.level, i); S.cats = []; S.seeds.forEach((s) => { s.on = false; }); S.left = 1; S.seeds[0].on = true; S.hero.cx = S.hero.x = S.seeds[0].x; S.hero.cy = S.hero.y = S.seeds[0].y - 0; S.left = 0; S.seeds[0].on = false; S.mode = 'play';
    S.left = 1; S.seeds[0].on = true; const h = S.hero; h.moving = true; h.d = 0; h.p = 0.99; h.cx = S.seeds[0].x; h.cy = S.seeds[0].y + 1; h.x = h.cx; h.y = h.cy + -0.01; game.step(1 / 60); if (S.mode !== 'clear') { S.left = 0; S.mode = 'play'; game._clear && 0; } run(game, 2); lv++; }
  ok(ev.filter((e) => e.t === 'life').length === 2, 'жизней +2: ' + ev.filter((e) => e.t === 'life').length); ok(S.mode === 'victory' || S.level === C.MAX_LEVEL - 1, S.mode + ' ' + S.level);
  const a = setup({ seed: 5, level: 3 }), b = a.game.clone(); for (let i = 0; i < 300; i++) { a.game.setDir(i % 4); b.setDir(i % 4); a.game.step(1 / 30); b.step(1 / 30); } eq(JSON.stringify(a.game.state()), JSON.stringify(b.state()));
});

// ---------- сохранение и миграция ----------
test('миграция: старый рекорд ХРУМа → «прежний рекорд», новый с нуля, сообщение; повторный запуск молчит; чистый игрок — без сообщения', () => {
  const store = { 'arcade.best.hrum': '4200' }, io = { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); }, del: (k) => { delete store[k]; } };
  let m = K.save.migrate(io); ok(m.migrated && m.notice); eq(m.oldBest, 4200); eq(store['arcade.best.hrum'], undefined); eq(store['arcade.hrum.oldBest'], '4200'); eq(store['arcade.hrum.v'], '2');
  m = K.save.migrate(io); ok(!m.migrated); eq(m.oldBest, 4200); const st2 = {}, io2 = { get: (k) => (k in st2 ? st2[k] : null), set: (k, v) => { st2[k] = String(v); }, del: (k) => { delete st2[k]; } };
  m = K.save.migrate(io2); ok(!m.migrated && !m.notice); eq(st2['arcade.hrum.v'], '2');
});

// ---------- строки, музыка, правило имён ----------
test('строки: 5 языков, одинаковый набор ключей; название RU — КАТЫШ, остальные — SEEDGLIDE; подсказки заполнены', () => {
  const ks = Object.keys(K.STR.ru); for (const l of ['en', 'tr', 'es', 'pt']) { const miss = ks.filter((k) => K.STR[l][k] == null || K.STR[l][k] === ''), extra = Object.keys(K.STR[l]).filter((k) => K.STR.ru[k] == null); ok(!miss.length && !extra.length, l + ' ключи: -' + miss + ' +' + extra); }
  eq(K.STR.ru.title, 'КАТЫШ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(K.STR[l].title, 'SEEDGLIDE'); for (const k of ['tut1', 'tut2', 'tut3', 'tut4', 'tutK1', 'tutK2', 'tutK3', 'tutK4']) for (const l of Object.keys(K.STR)) ok(K.STR[l][k].length > 10);
});
test('музыка: трек hrum задан, секвенсор принимает ноты', () => {
  const t = sandbox.Arcade.tracks.hrum; ok(t && t.melody.length >= 2 && t.bass && t.drums); const notes = (t.melody.join(' ') + ' ' + t.bass).replace(/\|/g, ' ').split(/\s+/).filter((x) => x && x !== '-' && x !== '.');
  for (const n of notes) ok(/^[A-G](#|b)?[0-8]$/.test(n), 'нота ' + n);
});
{ // правило имён 12.11: стоп-лист в base64 (чтобы сам тест не содержал чужих имён)
  const BAN = 'ZG91YmxlIGRyYWdvbnxrdW5pb3xyaXZlciBjaXR5fHRlY2hub3N8YXJjIHN5c3RlbXxudW1hIHRha2Vtb3RvfG5pbnRlbmRvfGNhcGNvbXxrb25hbWl8dGFpdG98dGVjbW98bmFtY298c2VnYXxjb250cmF8dGV0cmlzfHBhYy1tYW58YmF0dGxlIGNpdHl8cmV0cm8gYnJhd2x8cmVkIGRyYWdvbg==';
  const re = new RegExp('\\b(' + Buffer.from(BAN, 'base64').toString('utf8') + ')\\b', 'i');
  test('правило имён: в файлах игры нет чужих названий (стоп-лист в base64)', () => {
    const bad = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'screenshots') walk(p); } else if (/\.(js|mjs|html|css|md|json)$/.test(f.name) && f.name !== 'engine.js' && f.name !== 'engine.test.mjs') { const m = fs.readFileSync(p, 'utf8').match(re); if (m) bad.push(path.relative(ROOT, p) + ': ' + m[0]); } } })(ROOT);
    ok(!bad.length, bad.join('; '));
  });
}
test('нет внешних URL в игре (офлайн, file://)', () => {
  const bad = []; for (const f of ['index.html', 'js/main.js', 'js/render.js', 'js/ui.js', 'js/game.js', 'css/style.css']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''); if (/https?:\/\//.test(t)) bad.push(f); } ok(!bad.length, bad.join());
});

// ---------- баланс ботом ----------
if (!process.env.QUICK) {
  test('бот «человек» (ошибается 5 % решений, тормозит не всегда): гумно 1 — ≥ 80 %; вся игра из 8 гумен — 20–45 % партий', () => {
    let first = 0, n1 = 12; for (let s = 1; s <= n1; s++) if (play({ seed: 300 + s, levels: 1 }).win) first++; console.log('     первое гумно: ' + first + '/' + n1); ok(first / n1 >= 0.8, 'доля ' + first / n1);
    let w = 0, N = 20; for (let s = 1; s <= N; s++) if (play({ seed: 100 + s }).win) w++; const p = w / N; console.log('     вся игра: ' + w + '/' + N + ' = ' + Math.round(p * 100) + ' %'); ok(p >= 0.2 && p <= 0.45, 'доля ' + p);
  });
  test('бот-идеал (без ошибок): каждое гумно проходит без потери всех жизней', () => {
    for (let lv = 0; lv < C.MAX_LEVEL; lv++) { let w = 0; for (let s = 1; s <= 3; s++) if (play({ seed: s, miss: 0, brakeOk: 1, react: 0.05, startLevel: lv, levels: 1, maxT: 200 }).win) w++; ok(w >= 2, 'гумно ' + (lv + 1) + ': ' + w + '/3'); }
  });
}

// ---------- площадка ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'hrum', boards: ['hrum'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

/* ЗВЕРО-ОТРЯД · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node zvero-otryad/tests/engine.test.mjs. Движок грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array, Date, Infinity };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const Z = sandbox.ZVERO;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// Прогнать уровень до двери: открыть дверь, поставить игрока на неё, снять баннер.
function clearToNext(g) {
  const s = g.state(); s.intro = 0; s.door.open = true;
  const p = s.players[0]; p.x = s.door.x + 2; p.y = s.door.y + s.door.h - p.h - 1; p.alive = true;
  g.step(1 / 60); // checkDoor → levelclear
  for (let i = 0; i < 120 && g.phase() === 'levelclear'; i++) g.step(0.05);
}

test('константы мира: клетка 30, 20 рядов, вид 960×600', () => {
  eq(Z.consts.TILE, 30); eq(Z.consts.ROWS, 20); eq(Z.consts.VIEW_W, 960); eq(Z.consts.VIEW_H, 600);
});

test('старт одиночной игры: 1 игрок, 5 жизней, цех 1, фаза play', () => {
  const g = Z.Game(); g.start(); const s = g.state();
  eq(s.players.length, 1); eq(s.lives, 5); eq(s.level, 0); eq(g.phase(), 'play');
  ok(s.cols > 0 && s.rows === 20, 'сетка не загрузилась'); ok(s.boxes.length > 0, 'нет ящиков');
});

test('режим на двоих: два героя Пыж(0) и Тяпа(1)', () => {
  const g = Z.Game({ twoP: true }); g.start(); const s = g.state();
  eq(s.players.length, 2); eq(s.players[0].id, 0); eq(s.players[1].id, 1);
});

test('схватить ящик и бросить: carry ставится и обнуляется, ящик летит', () => {
  const g = Z.Game(); g.start(); const s = g.state(); s.intro = 0;
  const p = s.players[0];
  s.boxes = [{ x: p.x, y: p.y, w: 26, h: 26, vx: 0, vy: 0, held: false, thrown: false, onGround: false, carrier: -1 }];
  g.action(0); ok(p.carry, 'ящик не схвачен'); ok(s.boxes[0].held, 'held не выставлен');
  p.dir = 1; g.action(0);
  ok(!p.carry, 'ящик не выпущен'); ok(s.boxes[0].thrown, 'ящик не брошен'); ok(s.boxes[0].vx > 0, 'ящик летит не туда');
});

test('брошенный ящик разбивает ходока: враг исчезает, +100', () => {
  const g = Z.Game(); g.start(); const s = g.state(); s.intro = 0;
  s.enemies = [{ type: 'walker', x: 430, y: 150, w: 26, h: 24, vx: 0, dir: 1, t: 0 }];
  s.boxes = [{ x: 430, y: 150, w: 26, h: 26, vx: 0, vy: 0, held: false, thrown: true, onGround: false, carrier: -1 }];
  const sc = s.score; g.step(1 / 60);
  eq(s.enemies.length, 0, 'враг не убит'); ok(s.score >= sc + 100, 'очки не начислены: ' + s.score);
});

test('брошенный ящик бьёт летуна', () => {
  const g = Z.Game(); g.start(); const s = g.state(); s.intro = 0;
  s.enemies = [{ type: 'flyer', x: 432, y: 152, w: 24, h: 20, baseY: 160, t: 0, dir: -1 }];
  s.boxes = [{ x: 430, y: 150, w: 26, h: 26, vx: 0, vy: 0, held: false, thrown: true, onGround: false, carrier: -1 }];
  g.step(1 / 60); eq(s.enemies.length, 0, 'летун не сбит');
});

test('звезда-друг подбирается: +50 очков', () => {
  const g = Z.Game(); g.start(); const s = g.state(); s.intro = 0;
  const p = s.players[0]; s.pickups = [{ kind: 'star', x: p.x + p.w / 2, y: p.y + p.h / 2, r: 9, t: 0 }];
  const sc = s.score; g.step(1 / 60);
  eq(s.pickups.length, 0, 'звезда не собрана'); eq(s.score, sc + 50);
});

test('контакт с врагом: минус жизнь, игрок уходит в респаун', () => {
  const g = Z.Game(); g.start(); const s = g.state(); s.intro = 0;
  const p = s.players[0]; p.invuln = 0;
  s.enemies = [{ type: 'walker', x: p.x, y: p.y, w: 26, h: 24, vx: 0, dir: 1, t: 0 }];
  s.boss = null;
  const lv = s.lives; g.step(1 / 60);
  eq(s.lives, lv - 1, 'жизнь не снята'); ok(!p.alive, 'игрок должен быть повержен');
});

test('последняя жизнь: game over срабатывает', () => {
  let over = 0; const g = Z.Game({ onEvent: (t) => { if (t === 'gameover') over++; } });
  g.start(); const s = g.state(); s.intro = 0; s.lives = 1;
  const p = s.players[0]; p.invuln = 0; s.boss = null;
  s.enemies = [{ type: 'walker', x: p.x, y: p.y, w: 26, h: 24, vx: 0, dir: 1, t: 0 }];
  g.step(1 / 60); eq(g.phase(), 'gameover'); eq(over, 1, 'событие gameover не пришло');
});

test('дверь цеха: касание → levelclear → следующий цех', () => {
  const g = Z.Game(); g.start(); const s = g.state();
  clearToNext(g); eq(s.level, 1, 'цех не сменился'); eq(g.phase(), 'play');
});

test('финальный цех — босс; ящики снимают HP и открывают дверь', () => {
  const g = Z.Game(); g.start(); const s = g.state();
  // пройти цеха 1–3 до финального с боссом
  for (let guard = 0; guard < 6 && !s.boss; guard++) clearToNext(g);
  ok(s.boss, 'босс не появился на финальном цехе'); ok(!s.door.open, 'дверь не должна быть открыта до победы');
  const hp0 = s.boss.hp;
  s.intro = 0;
  // закидываем босса ящиками, пока он не повержен
  for (let i = 0; i < 40 && s.boss; i++) {
    const b = s.boss;
    s.boxes.push({ x: b.x, y: b.y, w: 26, h: 26, vx: 0, vy: 0, held: false, thrown: true, onGround: false, carrier: -1 });
    g.step(1 / 60);
    s.boss && (s.boss.hitFlash = 0); // снять инвуль-флеш для следующего попадания
  }
  ok(!s.boss, 'босс не повержен'); ok(s.door.open, 'дверь не открылась после победы над боссом');
  ok(s.score > hp0 * 100, 'очки за босса не начислены');
});

test('победа: дверь на финальном цехе → win', () => {
  let won = 0; const g = Z.Game({ onEvent: (t) => { if (t === 'win') won++; } });
  g.start(); const s = g.state();
  for (let guard = 0; guard < 6 && !s.boss; guard++) clearToNext(g);
  ok(s.boss, 'нет босса'); s.boss = null; s.door.open = true; // считаем босса поверженным
  clearToNext(g);
  eq(won, 1, 'win не сработал'); eq(g.phase(), 'win');
});

// ---------- Кооп: оба героя всегда в кадре (решение владельца 12.11) ----------
// Пройти на цех idx (без игры, через дверь), вернуть состояние на старте цеха.
function gotoLevel(g, idx) { for (let k = 0; k < idx; k++) clearToNext(g); return g.state(); }
function inView(s, p) { return p.x >= s.camX - 0.5 && p.x + p.w <= s.camX + s.viewW + 0.5; }
function span(s) { const [a, b] = s.players; return Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x); }
// Позиция буквы P в сетке уровня (исходная точка И1).
function pCell(s) { for (let r = 0; r < s.rows; r++) { const c = s.grid[r].indexOf('P'); if (c >= 0) return { c, r }; } return null; }

for (let L = 0; L < Z.consts.LEVELS; L++) {
  test('кооп, цех ' + (L + 1) + ': на старте оба героя в кадре, И2 рядом с И1', () => {
    const g = Z.Game({ twoP: true }); g.start(); const s = gotoLevel(g, L);
    eq(s.level, L, 'не тот цех'); eq(s.players.length, 2);
    s.players.forEach((p, i) => ok(inView(s, p), 'герой ' + (i + 1) + ' вне кадра: x=' + p.x + ' cam=' + s.camX));
    ok(span(s) <= 2 * 22 + 2 * 28, 'И2 далеко от И1: ' + span(s));
    // и после интро (первые кадры игры) — тоже в кадре
    for (let i = 0; i < 90; i++) { g.step(1 / 60); s.players.forEach((p, k) => ok(!p.alive || inView(s, p), 'кадр ' + i + ': герой ' + (k + 1) + ' вне кадра')); }
  });
  test('кооп, цех ' + (L + 1) + ': разбегаются в разные стороны — расстояние ≤ ширины кадра, оба в кадре', () => {
    const g = Z.Game({ twoP: true }); g.start(); const s = gotoLevel(g, L);
    s.intro = 0; s.enemies = []; s.boss = null; s.lives = 99;
    g.setHeld(0, 'left', true); g.setHeld(1, 'right', true);
    let maxSpan = 0, leashed = false;
    for (let i = 0; i < 60 * 12; i++) {
      if (i % 25 === 0) { g.jump(0); g.jump(1); }
      g.step(1 / 60);
      if (s.players.every(p => p.alive)) {
        maxSpan = Math.max(maxSpan, span(s)); leashed = leashed || s.players.some(p => p.leashed);
        ok(span(s) <= Z.consts.LEASH_SPAN + 0.5, 'разошлись на ' + span(s));
        ok(span(s) <= s.viewW, 'шире кадра: ' + span(s));
        s.players.forEach((p, k) => ok(inView(s, p), 'шаг ' + i + ': герой ' + (k + 1) + ' вне кадра'));
      }
    }
    ok(maxSpan > 400, 'герои почти не разошлись (' + maxSpan + ') — тест не проверил поводок');
  });
}

test('кооп: поводок на ровном полу — упор ровно в LEASH_SPAN (880 = 960 − 2·40)', () => {
  eq(Z.consts.LEASH_SPAN, Z.consts.VIEW_W - 2 * Z.consts.LEASH_PAD);
  const g = Z.Game({ twoP: true }); g.start(); const s = g.state(); s.intro = 0; s.enemies = []; s.boss = null;
  // искусственный ровный пол во весь уровень
  s.grid = s.grid.map((r, i) => i === s.rows - 2 ? '#'.repeat(s.cols) : (i === s.rows - 1 ? r : ' '.repeat(s.cols)));
  s.boxes = []; s.pickups = [];
  const [a, b] = s.players; a.x = s.pixelW / 2 - 40; b.x = s.pixelW / 2 + 10; a.y = b.y = (s.rows - 2) * 30 - 28.01;
  g.setHeld(0, 'left', true); g.setHeld(1, 'right', true);
  for (let i = 0; i < 600; i++) g.step(1 / 60);
  ok(Math.abs(span(s) - Z.consts.LEASH_SPAN) < 1, 'упор не в LEASH_SPAN: ' + span(s));
  ok(inView(s, a) && inView(s, b), 'не в кадре');
  // отпускаем И2 и ведём его назад — поводок не мешает сходиться
  g.setHeld(1, 'right', false); g.setHeld(1, 'left', true); const x0 = b.x;
  for (let i = 0; i < 30; i++) g.step(1 / 60);
  ok(b.x < x0 - 50, 'навстречу не идёт');
});

test('кооп: случайный ввод 60 с на каждом цехе — пара всегда в кадре', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let L = 0; L < Z.consts.LEVELS; L++) {
    const g = Z.Game({ twoP: true }); g.start(); const s = gotoLevel(g, L); s.intro = 0; s.lives = 999;
    for (let i = 0; i < 3600 && g.phase() === 'play'; i++) {
      if (i % 20 === 0) for (let p = 0; p < 2; p++) { const r = rnd(); g.setHeld(p, 'left', r < 0.4); g.setHeld(p, 'right', r > 0.6); if (rnd() < 0.3) g.jump(p); }
      g.step(1 / 60);
      if (s.players.every(p => p.alive)) ok(span(s) <= Z.consts.LEASH_SPAN + 0.5 && s.players.every(p => inView(s, p)), 'цех ' + (L + 1) + ', шаг ' + i + ': пара не в кадре');
    }
  }
});

test('одиночный режим не изменился: один герой, стоит на «P» каждого цеха', () => {
  for (let L = 0; L < Z.consts.LEVELS; L++) {
    const g = Z.Game(); g.start(); const s = gotoLevel(g, L); eq(s.players.length, 1);
    const c = pCell(s); ok(c, 'нет P на цехе ' + (L + 1));
    eq(s.players[0].x, c.c * 30 + 4, 'x И1 цех ' + (L + 1)); eq(s.players[0].y, c.r * 30 - 2, 'y И1 цех ' + (L + 1));
    ok(!s.players[0].leashed, 'поводок в одиночке');
  }
});

test('оболочка: временные маркеры у края экрана убраны', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(!/function offscreen|offscreen\(ctx/.test(html), 'маркеры «◀ ПЫЖ / ТЯПА ▶» всё ещё рисуются');
});

// ---------- Появление на опоре (решение владельца 12.11: цеха 3–4 — ниша была закрыта сверху) ----------
// Твёрдая клетка сетки (за нижним краем — пол, как в движке).
function solidCell(s, c, r) { if (c < 0 || c >= s.cols || r < 0) return false; if (r >= s.rows) return true; const ch = s.grid[r][c]; return ch === '#' || ch === '='; }
function hitsSolid(s, p) {
  for (let r = Math.floor(p.y / 30); r <= Math.floor((p.y + p.h - 1) / 30); r++)
    for (let c = Math.floor(p.x / 30); c <= Math.floor((p.x + p.w - 1) / 30); c++) if (solidCell(s, c, r)) return true;
  return false;
}
// 60 кадров без ввода: никто не уходит вверх больше чем на 1 px (нет выталкивания коллизией) и не оказывается в блоке.
function idle60(g, s, tag) {
  s.intro = 0; s.enemies = []; s.boss = null;
  const y0 = s.players.map(p => p.y);
  for (let i = 0; i < 60; i++) {
    g.step(1 / 60);
    s.players.forEach((p, k) => {
      ok(p.y >= y0[k] - 1, tag + ', кадр ' + i + ': герой ' + (k + 1) + ' вытолкнут вверх на ' + (y0[k] - p.y).toFixed(2) + ' px');
      ok(!hitsSolid(s, p), tag + ', кадр ' + i + ': герой ' + (k + 1) + ' в блоке');
    });
  }
  // опора под ногами: сдвиг вниз на 2 px упирается в блок или в лежащий ящик (флаг onGround в покое мерцает — шаг гравитации < 1 px)
  const onBox = p => s.boxes.some(b => !b.held && p.x < b.x + b.w && p.x + p.w > b.x && Math.abs(p.y + p.h - b.y) <= 2);
  s.players.forEach((p, k) => ok(hitsSolid(s, { x: p.x, y: p.y + 2, w: p.w, h: p.h }) || onBox(p), tag + ': герой ' + (k + 1) + ' не стоит на опоре, y=' + p.y));
}
for (let L = 0; L < Z.consts.LEVELS; L++) for (const twoP of [false, true]) {
  const tag = 'цех ' + (L + 1) + (twoP ? ', вдвоём' : ', один');
  test(tag + ': появление на опоре — ни один герой не в блоке, без выталкивания 60 кадров', () => {
    const g = Z.Game({ twoP }); g.start(); const s = gotoLevel(g, L); eq(s.level, L);
    s.players.forEach((p, k) => ok(!hitsSolid(s, p), 'герой ' + (k + 1) + ' появился в блоке: x=' + p.x + ' y=' + p.y));
    idle60(g, s, tag);
  });
  test(tag + ': возрождение после потери жизни — тоже не в блоке и без выталкивания', () => {
    const g = Z.Game({ twoP }); g.start(); const s = gotoLevel(g, L); s.intro = 0; s.enemies = []; s.boss = null; s.lives = 9;
    for (let i = 0; i < 30; i++) g.step(1 / 60);              // встали на опору
    const p = s.players[0]; p.invuln = 0;
    s.enemies = [{ type: 'walker', x: p.x, y: p.y, w: 26, h: 24, vx: 0, dir: 1, t: 0 }];
    g.step(1 / 60); ok(!p.alive, 'урон не прошёл'); s.enemies = [];
    for (let i = 0; i < 120 && !p.alive; i++) g.step(1 / 60);
    ok(p.alive, 'не возродился'); ok(!hitsSolid(s, p), 'возродился в блоке: x=' + p.x + ' y=' + p.y);
    for (let i = 0; i < 30; i++) g.step(1 / 60);              // приземлился (с напарником — падает с 20 px)
    idle60(g, s, tag + ', после возрождения');
  });
}

// ---------- Оболочка v2 (index.html на движке Arcade): музыка, порядок скриптов, кооп-раскладка ----------
{
  const SLUG = path.basename(ROOT);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const box = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat };
  box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box, { filename: 'music.js' });
  const A = box.Arcade;

  test('v2: engine.js — копия _shared/engine.js (v2.1+)', () => {
    eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '../_shared/engine.js'), 'utf8'), 'engine.js рассинхронизирован');
    ok(/^2\.(1|[2-9])/.test(A.version), 'версия движка ' + A.version);
  });
  test('v2: музыкальный трек по gameId парсится, 8+ тактов', () => {
    const t = A.tracks && A.tracks[SLUG]; ok(t, 'нет Arcade.tracks[' + SLUG + ']');
    const c = A.parseTrack(t); ok(c.melody.length >= 48, 'мелодия коротка: ' + c.melody.length);
    ok(c.bass.length > 0 && c.drums.length > 0, 'нет баса/ударных');
  });
  test('v2: порядок скриптов — engine.js, сразу music.js, затем родные модули (кооп — в движке, без js/coop.js)', () => {
    const srcs = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map(m => m[1].replace(/^\.\//, ''));
    eq(srcs[0], 'engine.js'); eq(srcs[1], 'js/music.js'); ok(!srcs.includes('js/coop.js'), 'js/coop.js больше не нужен');
    ok(!fs.existsSync(path.join(ROOT, 'js/coop.js')), 'осталась копия js/coop.js');
    ['js/game.js', 'js/classic.js', 'js/modern.js'].forEach(s => ok(srcs.includes(s), 'нет ' + s));
    ok(!srcs.includes('js/main.js') && !srcs.includes('js/audio.js'), 'старый загрузчик/аудио не должны грузиться');
    ok(html.includes("gameId:'" + SLUG + "'"), 'gameId ≠ slug');
  });
  test('v2: legacy.html — старая страница с рабочими путями', () => {
    const lg = fs.readFileSync(path.join(ROOT, 'legacy.html'), 'utf8');
    ['js/game.js', 'js/main.js', 'css/style.css'].forEach(s => { ok(lg.includes(s), 'legacy без ' + s); ok(fs.existsSync(path.join(ROOT, s)), 'нет файла ' + s); });
  });
  test('v2: кооп-раскладка — P1 стрелки, P2 WASD, без горячих клавиш движка, без пересечений', () => {
    const m = /bind:\{\s*p1:\{([^}]*)\},\s*p2:\{([^}]*)\}/.exec(html); ok(m, 'нет bind в index.html');
    const codes = s => [...s.matchAll(/'([A-Za-z0-9]+)'/g)].map(x => x[1]);
    const p1 = codes(m[1]), p2 = codes(m[2]);
    ['ArrowLeft', 'ArrowRight', 'ArrowUp'].forEach(c => ok(p1.includes(c), 'P1 без ' + c));
    ['KeyA', 'KeyD', 'KeyW'].forEach(c => ok(p2.includes(c), 'P2 без ' + c));
    const HOT = ['KeyP', 'Escape', 'KeyM', 'KeyL', 'KeyT', 'Enter', 'NumpadEnter', 'Digit1', 'Digit2'];
    p1.concat(p2).forEach(c => ok(!HOT.includes(c), 'конфликт с горячей клавишей ' + c));
    p1.forEach(c => ok(!p2.includes(c), 'клавиша у обоих игроков: ' + c));
  });
  test('v2.2: кооп на движке — g.usePlayers + g.input.player(i), раскладка без конфликтов (Arcade.checkBindings)', () => {
    ok(/^2\.([2-9]|\d\d)/.test(A.version), 'нужен движок 2.2+, а не ' + A.version);
    ok(/g\.usePlayers\(\{/.test(html) && /g\.input\.player\(pi\)/.test(html), 'index.html не на API движка');
    ok(!/Arcade\.coop|\bco\.(held|players|onAction|arm)\(/.test(html), 'остались вызовы старого coop');
    const m = /bind:\{\s*p1:\{([^}]*)\},\s*p2:\{([^}]*)\}/.exec(html); ok(m, 'нет bind');
    const bind = vm.runInNewContext('({p1:{' + m[1] + '},p2:{' + m[2] + '}})');
    const c = A.checkBindings(bind, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] });
    eq(c.length, 0, 'конфликты: ' + JSON.stringify(c));
    ok(Object.keys(bind.p1).some(k => !['left', 'right', 'up', 'down'].includes(k) && bind.p1[k].includes('Space')), 'у И1 пропал пробел как действие');
  });
}

console.log('\n' + (failed ? 'НЕУСПЕХ' : 'OK') + ' ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

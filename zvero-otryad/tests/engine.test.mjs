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

// ---------- Оболочка v2 (index.html на движке Arcade): музыка, порядок скриптов, кооп-раскладка ----------
{
  const SLUG = path.basename(ROOT);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const box = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat };
  box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box, { filename: 'music.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/coop.js'), 'utf8'), box, { filename: 'coop.js' });
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
  test('v2: порядок скриптов — engine.js, сразу music.js, затем coop.js и родные модули', () => {
    const srcs = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map(m => m[1].replace(/^\.\//, ''));
    eq(srcs[0], 'engine.js'); eq(srcs[1], 'js/music.js'); eq(srcs[2], 'js/coop.js');
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
  test('v2: Arcade.coop — фабрика есть', () => { eq(typeof A.coop, 'function'); });
}

console.log('\n' + (failed ? 'НЕУСПЕХ' : 'OK') + ' ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

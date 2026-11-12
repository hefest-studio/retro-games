/* РЕДУТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node redut/tests/engine.test.mjs. Движок грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array, Object, Date, JSON, String };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const R = sandbox.REDUT;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// Перевести игру в боевой режим без вступительного баннера.
function playing(g) { const s = g.state(); s.phase = 'play'; s.intro = 0; return s; }

test('геометрия: 15×15, клетка 40', () => {
  eq(R.consts.COLS, 15); eq(R.consts.ROWS, 15); eq(R.consts.CELL, 40); eq(R.consts.FIELD, 600);
});

test('старт: 1 игрок, 3 жизни, база цела, волна 1', () => {
  const g = R.Game({}); g.start(); const s = g.state();
  eq(s.players.length, 1); eq(s.players[0].lives, 3); ok(s.base.alive, 'база должна быть цела');
  eq(s.stage, 0); eq(s.phase, 'play'); eq(s.numPlayers, 1);
});

test('кооп: 2 игрока создаются', () => {
  const g = R.Game({ players: 2 }); g.start(); const s = g.state();
  eq(s.players.length, 2); eq(s.players[1].idx, 1);
});

test('карта 15×15 и база-редут снизу по центру', () => {
  const g = R.Game({}); g.start(); const s = g.state();
  eq(s.grid.length, 15); eq(s.grid[0].length, 15);
  eq(s.grid[14][7], 'A', 'в (7,14) должна быть база');
  eq(s.grid[13][7], 'B', 'над базой кирпич-подкова');
  eq(s.grid[14][6], 'B'); eq(s.grid[14][8], 'B');
});

test('выстрел игрока рождает пулю, кулдаун держит вторую', () => {
  const g = R.Game({}); g.start(); const s = playing(g); s.players[0].cd = 0;
  g.fire(0); eq(s.bullets.length, 1, 'первая пуля'); ok(s.bullets[0].owner === 'p', 'пуля игрока');
  g.fire(0); eq(s.bullets.length, 1, 'вторая не вылетает (кулдаун/лимит)');
});

test('пуля крошит кирпич', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  const before = s.brickMask['6,13']; ok(before === 15, 'кирпич (6,13) цел: ' + before);
  s.bullets.push({ owner: 'p', pIdx: 0, x: 235, y: 540, dir: 'right', vx: 320, vy: 0, power: 0, life: 2, r: 4 });
  for (let i = 0; i < 6; i++) g.step(1 / 60);
  const after = s.brickMask['6,13'];
  ok(after === undefined || after < 15, 'кирпич должен быть повреждён, стало ' + after);
});

test('попадание в базу → поражение', () => {
  let over = 0; const g = R.Game({ onEvent: (t) => { if (t === 'gameover') over++; } });
  g.start(); const s = playing(g);
  s.grid[13][7] = '.'; delete s.brickMask['7,13']; // откроем проход к базе сверху
  s.bullets.push({ owner: 'e', x: 300, y: 515, dir: 'down', vx: 0, vy: 320, power: 0, life: 2, r: 4 });
  for (let i = 0; i < 12 && s.phase === 'play'; i++) g.step(1 / 60);
  eq(s.phase, 'gameover'); ok(!s.base.alive, 'база разрушена'); eq(over, 1);
});

test('пуля игрока уничтожает врага, +очки', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  s.enemies.push({ kind: 'basic', x: 130, y: 90, dir: 'down', hp: 1, spd: 60, bonus: false, spawn: 0, reDir: 9, fireCd: 9, t: 0 });
  const sc = s.score;
  s.bullets.push({ owner: 'p', pIdx: 0, x: 148, y: 108, dir: 'up', vx: 0, vy: -320, power: 0, life: 2, r: 4 });
  for (let i = 0; i < 4; i++) g.step(1 / 60);
  eq(s.enemies.length, 0, 'враг уничтожен'); ok(s.score >= sc + 100, 'очки выросли: ' + s.score); eq(s.killed, 1);
});

test('пуля врага снимает жизнь у игрока', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  const p = s.players[0]; p.shield = 0; const lv = p.lives;
  s.bullets.push({ owner: 'e', x: p.x + 18, y: p.y + 18, dir: 'up', vx: 0, vy: 0, power: 0, life: 2, r: 4 });
  g.step(1 / 60);
  eq(p.lives, lv - 1, 'жизнь снята');
});

test('усилитель «жизнь» добавляет жизнь, «апгрейд» — силу, «стоп» — заморозку', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  const p = s.players[0]; const lv = p.lives;
  s.powerups.push({ kind: 'life', x: p.x + 18, y: p.y + 18, t: 0, life: 10 });
  g.step(1 / 60); eq(p.lives, lv + 1, 'жизнь добавлена'); eq(s.powerups.length, 0);
  s.powerups.push({ kind: 'upgrade', x: p.x + 18, y: p.y + 18, t: 0, life: 10 });
  g.step(1 / 60); eq(p.power, 1, 'сила выросла');
  s.powerups.push({ kind: 'freeze', x: p.x + 18, y: p.y + 18, t: 0, life: 10 });
  g.step(1 / 60); ok(s.freeze > 0, 'заморозка включена');
});

test('танк не выходит за границу поля', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  const p = s.players[0]; p.x = R.consts.OFF; p.shield = 0;
  g.setHeld(0, 'left', true);
  for (let i = 0; i < 30; i++) g.step(1 / 60);
  ok(p.x >= 0, 'не ушёл за левый край: ' + p.x);
});

test('движение вверх уменьшает Y', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  const p = s.players[0]; const y0 = p.y; p.shield = 0; s.enemies = [];
  g.setHeld(0, 'up', true);
  for (let i = 0; i < 20; i++) g.step(1 / 60);
  ok(p.y < y0, 'танк поехал вверх: ' + y0 + '→' + p.y);
});

test('зачистка волны → следующая стадия', () => {
  const g = R.Game({}); g.start(); const s = playing(g);
  s.killed = s.total; s.enemies = []; s.spawned = s.total;
  g.step(1 / 60); eq(s.phase, 'levelclear', 'волна отбита');
  s.banner = 0.0001; g.step(1 / 60); eq(s.stage, 1); eq(s.phase, 'play');
});

test('зачистка последней волны → победа', () => {
  let won = 0; const g = R.Game({ onEvent: (t) => { if (t === 'win') won++; } });
  g.start(); const s = playing(g); s.stage = 2; s.total = 1; s.killed = 1; s.enemies = []; s.spawned = 1;
  g.step(1 / 60); eq(s.phase, 'levelclear');
  s.banner = 0.0001; g.step(1 / 60); eq(won, 1, 'победа'); eq(s.phase, 'win');
});

test('пауза переключается', () => {
  const g = R.Game({}); g.start(); ok(!g.isPaused()); g.pause(); ok(g.isPaused()); g.pause(); ok(!g.isPaused());
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

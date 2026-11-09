/* КОЛОБОК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node kolobok/tests/engine.test.mjs. Движок грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Date, Array, setTimeout, clearInterval, setInterval };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'), sandbox, { filename: 'i18n.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const K = sandbox.KOLOBOK;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

test('все строки полян ровно 24 символа, 6 полян', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
  const m = src.match(/var ROOMS = \[([\s\S]*?)\n  \];/);
  ok(m, 'блок ROOMS не найден');
  const rows = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  eq(rows.length, 90, 'строк всего');
  eq(rows.filter((r) => r.length !== 24).length, 0, 'строк неверной ширины');
});

test('константы геометрии: 40px, 24x15', () => {
  eq(K.consts.TILE, 40); eq(K.consts.COLS, 24); eq(K.consts.ROWS, 15);
});

test('старт: 3 жизни, 0 ягод, пустая сумка, всего 6 ягод', () => {
  const g = K.Game(); g.start(); const s = g.state();
  eq(s.lives, 3); eq(s.berries, 0); eq(s.bag.length, 0);
  eq(s.totalBerries, 6); eq(s.roomId, 0); eq(s.phase, 'play'); ok(s.player, 'нет игрока');
});

test('гравитация: колобок падает на землю (onGround)', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0;
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  ok(s.player.onGround, 'не приземлился');
  ok(s.player.y < s.pixelH, 'провалился сквозь мир');
});

test('сбор ягоды: +1 к счётчику', () => {
  const g = K.Game(); g.start(); const s = g.state();
  // в поляне 0 ягода на row12 col3
  s.player.x = 3 * 40 + 7; s.player.y = 12 * 40 - 2; s.intro = 0;
  const before = s.berries;
  for (let i = 0; i < 10; i++) g.update(1 / 60);
  ok(s.berries > before, 'ягода не собрана: ' + s.berries);
});

test('сбор предмета: ключ попадает в сумку', () => {
  const g = K.Game(); g.start(); const s = g.state();
  // в поляне 0 ключ на row12 col14
  s.player.x = 14 * 40 + 7; s.player.y = 12 * 40 - 2; s.intro = 0;
  for (let i = 0; i < 10; i++) g.update(1 / 60);
  ok(s.bag.indexOf('key') >= 0, 'ключ не подобран: ' + JSON.stringify(s.bag));
});

test('сумка не больше 3 предметов', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.bag = ['key', 'plank', 'bucket'];
  s.grid[0] = 'k' + s.grid[0].slice(1);
  s.player.x = 7; s.player.y = 0; s.intro = 0;
  for (let i = 0; i < 6; i++) g.update(1 / 60);
  ok(s.bag.length <= 3, 'в сумке больше 3: ' + s.bag.length);
});

test('ключ открывает калитку (D исчезает, ключ тратится)', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; s.bag = ['key'];
  s.grid[5] = s.grid[5].slice(0, 10) + 'D' + s.grid[5].slice(11);
  g.use();
  ok(s.grid.join('').indexOf('D') < 0, 'калитка осталась');
  ok(s.bag.indexOf('key') < 0, 'ключ не потрачен');
});

test('доска мостит речку (~ → =, доска тратится)', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; s.bag = ['plank'];
  s.grid[6] = s.grid[6].slice(0, 8) + '~~~' + s.grid[6].slice(11);
  g.use();
  ok(s.grid.join('').indexOf('~') < 0, 'речка не перекрыта');
  ok(s.grid[6].indexOf('=') >= 0, 'мост не поставлен');
  ok(s.bag.indexOf('plank') < 0, 'доска не потрачена');
});

test('ведро тушит костёр (^ исчезает, ведро тратится)', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; s.bag = ['bucket'];
  s.grid[6] = s.grid[6].slice(0, 12) + '^^' + s.grid[6].slice(14);
  g.use();
  ok(s.grid.join('').indexOf('^') < 0, 'костёр не потушен');
  ok(s.bag.indexOf('bucket') < 0, 'ведро не потрачено');
});

test('опасность (речка) отнимает жизнь', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; const lv = s.lives;
  // поставим воду прямо под игрока
  const col = Math.floor((s.player.x + s.player.w / 2) / 40);
  const row = Math.floor((s.player.y + s.player.h / 2) / 40);
  s.grid[row] = s.grid[row].slice(0, col) + '~' + s.grid[row].slice(col + 1);
  s.player.invuln = 0;
  for (let i = 0; i < 3; i++) g.update(1 / 60);
  eq(s.lives, lv - 1, 'жизнь не снята');
});

test('флип-скрин: уход за правый край ведёт на поляну 1', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; s.player.x = s.pixelW + 5;
  g.update(1 / 60);
  eq(s.roomId, 1, 'не перешли на соседнюю поляну');
});

test('победа: все ягоды + дом → win', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; s.berries = s.totalBerries;
  s.goal = { x: s.player.x, y: s.player.y, w: 40, h: 40 };
  for (let i = 0; i < 3; i++) g.update(1 / 60);
  eq(g.phase(), 'win', 'нет победы');
});

test('без всех ягод дом не засчитывает победу', () => {
  const g = K.Game(); g.start(); const s = g.state();
  s.intro = 0; s.berries = 1;
  s.goal = { x: s.player.x, y: s.player.y, w: 40, h: 40 };
  for (let i = 0; i < 3; i++) g.update(1 / 60);
  ok(g.phase() !== 'win', 'победа без ягод');
});

test('пауза переключается', () => {
  const g = K.Game(); g.start();
  ok(!g.isPaused()); g.pause(); ok(g.isPaused()); g.pause(); ok(!g.isPaused());
});

test('500 шагов с бегом вправо — без исключений, фаза валидна', () => {
  const g = K.Game(); g.start();
  const valid = ['play', 'dying', 'warp', 'gameover', 'win'];
  for (let i = 0; i < 500; i++) { g.setHeld('right', true); if (i % 40 === 0) g.jump(); if (i % 30 === 0) g.use(); g.update(1 / 60); }
  ok(valid.indexOf(g.phase()) >= 0, 'неожиданная фаза ' + g.phase());
});

console.log('\nИтого: ' + passed + ' ок, ' + failed + ' провалов');
process.exit(failed ? 1 : 0);

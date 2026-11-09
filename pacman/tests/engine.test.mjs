/* PAC-MAN · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node pacman/tests/engine.test.mjs. Движок грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array, Date };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const PM = sandbox.PM;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

test('карта валидна: 28×31, 254 точки, все достижимы', () => {
  const v = PM.validate(); ok(v.ok, 'проблемы: ' + v.problems.join('; ')); eq(v.dots, 254); eq(v.reachDots, 254);
});

test('размеры поля 28×31', () => { const g = PM.Game(); eq(g.COLS, 28); eq(g.ROWS, 31); });

test('старт: Пакман, 3 жизни, все точки на месте', () => {
  const g = PM.Game(); g.start(); const s = g.state();
  ok(s.pac, 'нет Пакмана'); eq(s.lives, 3); eq(s.dotsLeft, s.dotsTotal); eq(s.dotsTotal, 254); eq(s.level, 1);
});

test('canGo: стена блокирует, коридор проходим', () => {
  const g = PM.Game(); g.start();
  ok(!g._canGo(1, 1, 'up', false), 'сквозь верхнюю стену нельзя');
  ok(g._canGo(1, 1, 'right', false), 'по верхнему коридору можно');
});

test('ворота дома: Пакману нельзя, призраку можно', () => {
  const g = PM.Game(); g.start(); const s = g.state();
  // найдём клетку над воротами '='
  let gx = -1, gy = -1;
  for (let y = 0; y < s.ROWS; y++) for (let x = 0; x < s.COLS; x++) if (s.maze[y][x] === '=') { gx = x; gy = y; }
  ok(gx >= 0, 'ворота не найдены');
  ok(!g._canGo(gx, gy - 1, 'down', false), 'Пакман не должен проходить ворота');
  ok(g._canGo(gx, gy - 1, 'down', true), 'призрак должен проходить ворота');
});

test('движение влево: Пакман ест точку, +10 очков', () => {
  const g = PM.Game(); g.start(); const s = g.state(); s.mode = 'play';
  const before = s.dotsLeft; s.pac.dir = 'left'; s.pac.next = 'left';
  for (let i = 0; i < 40; i++) g.step(1 / 60);
  ok(s.score >= 10, 'очки не выросли: ' + s.score);
  ok(s.dotsLeft < before, 'точки не съедены');
});

test('энергетик: испуг включается, +50', () => {
  const g = PM.Game(); g.start(); const s = g.state();
  // позиция энергетика (1,3)
  eq(s.maze[3][1], 'o', 'в (1,3) не энергетик'); g._eatAt(1, 3);
  ok(s.fright, 'испуг не включился'); ok(s.score >= 50, 'очки за энергетик');
});

// пин Пакмана в угол (1,1) мордой в стену — не двигается, призрак кладём туда же
function pinCorner(s) { s.pac.x = 1; s.pac.y = 1; s.pac.dir = 'up'; s.pac.next = 'up'; }

test('съесть испуганного призрака: +200, призрак → глаза', () => {
  const g = PM.Game(); g.start(); const s = g.state(); s.mode = 'play'; pinCorner(s); s.maze[1][1] = '-';
  s.fright = true; s.frightT = 5; const gh = s.ghosts[0]; gh.mode = 'fright'; gh.x = 1; gh.y = 1;
  const sc = s.score; g.step(1 / 60);
  eq(s.score, sc + 200, 'очки за призрака'); eq(gh.mode, 'eyes', 'призрак не стал глазами');
});

test('столкновение с обычным призраком: минус жизнь', () => {
  const g = PM.Game(); g.start(); const s = g.state(); s.mode = 'play'; pinCorner(s);
  const gh = s.ghosts[0]; gh.mode = 'chase'; gh.x = 1; gh.y = 1;
  const lv = s.lives; g.step(1 / 60);
  eq(s.lives, lv - 1, 'жизнь не снята');
});

test('победа: съедена последняя точка → win', () => {
  let won = 0; const g = PM.Game({ onEvent: (t) => { if (t === 'win') won++; } }); g.start(); const s = g.state(); s.mode = 'play';
  for (let y = 0; y < s.ROWS; y++) for (let x = 0; x < s.COLS; x++) { const c = s.maze[y][x]; if (c === '.' || c === 'o') s.maze[y][x] = '-'; }
  s.maze[23][12] = '.'; s.dotsLeft = 1; s.pac.dir = 'left'; s.pac.next = 'left';
  for (let i = 0; i < 120 && s.mode === 'play'; i++) g.step(1 / 60);
  eq(won, 1, 'win не сработал'); eq(s.dotsLeft, 0);
});

test('цель Блинки в режиме chase — клетка Пакмана', () => {
  const g = PM.Game(); g.start(); const s = g.state(); s.globalMode = 'chase';
  const t = g._ghostTarget(s.ghosts[0]); // blinky
  eq(t[0], Math.round(s.pac.x)); eq(t[1], Math.round(s.pac.y));
});

test('туннель: выход слева появляется справа', () => {
  const g = PM.Game(); g.start(); const s = g.state(); s.mode = 'play';
  s.pac.x = 1; s.pac.y = PM.consts.TUNNEL_ROW; s.pac.dir = 'left'; s.pac.next = 'left';
  for (let i = 0; i < 80; i++) g.step(1 / 60);
  ok(s.pac.x > 20, 'Пакман не телепортировался через туннель, x=' + s.pac.x.toFixed(1));
});

console.log('\n' + (failed ? 'НЕУСПЕХ' : 'OK') + ' ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);

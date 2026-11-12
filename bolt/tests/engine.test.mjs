/* БОЛТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей) + проверка трека музыки.
   Запуск: node bolt/tests/engine.test.mjs. Движок игры грузится в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { window: null, globalThis: null, console, Math, Array, Date, JSON, Object, Error, parseInt };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
const B = sandbox.BOLT;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function run(g, n, dt) { for (let i = 0; i < (n || 1); i++) g.update(dt || 0.05); }

test('namespace и API на месте', () => {
  ok(B && typeof B.Game === 'function', 'нет BOLT.Game'); eq(B.consts.TILE, 30); eq(B.consts.VIEW_W, 960);
});
test('старт: play, 3 жизни, счёт 0, уровень 0, есть игрок и дверь', () => {
  const g = B.Game(); g.start(); const s = g.state();
  eq(s.phase, 'play'); eq(s.lives, 3); eq(s.score, 0); eq(s.level, 0); ok(s.player, 'нет игрока'); ok(s.door, 'нет двери');
});
test('во время интро прыжок/выстрел не срабатывают', () => {
  const ev = []; const g = B.Game({ onEvent: t => ev.push(t) }); g.start();
  g.jump(); g.shoot(); ok(!ev.includes('jump') && !ev.includes('shoot'), ev.join(','));
});
test('после интро игрок стоит на земле, выстрел создаёт пулю с откатом', () => {
  const ev = []; const g = B.Game({ onEvent: t => ev.push(t) }); g.start(); run(g, 40);
  ok(g.state().player.onGround, 'не на земле'); g.shoot(); g.shoot();
  eq(g.state().bullets.length, 1, 'откат не сработал'); ok(ev.includes('shoot'));
});
test('прыжок с земли — вертикальная скорость вверх', () => {
  const g = B.Game(); g.start(); run(g, 40); g.jump(); ok(g.state().player.vy < 0, 'vy ' + g.state().player.vy);
});
test('бег вправо сдвигает игрока', () => {
  const g = B.Game(); g.start(); run(g, 40); const x0 = g.state().player.x;
  g.setHeld('right', true); run(g, 10); ok(g.state().player.x > x0, 'не сдвинулся');
});
test('пауза замораживает мир', () => {
  const g = B.Game(); g.start(); run(g, 40); g.setHeld('right', true); g.pause(); ok(g.isPaused());
  const x0 = g.state().player.x; run(g, 10); eq(g.state().player.x, x0, 'двигается в паузе');
});
test('заряд батареи убывает со временем', () => {
  const g = B.Game(); g.start(); run(g, 40); const c0 = g.state().charge; run(g, 40); ok(g.state().charge < c0, 'заряд не тратится');
});
test('трек музыки js/music.js: валидная нотация, 8 тактов', () => {
  const A = {}; const sb = { window: { Arcade: A } }; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), sb);
  const t = sb.window.Arcade.tracks.bolt; ok(t && t.bpm > 0, 'нет трека');
  const toks = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
  const mel = toks(t.melody); eq(mel.length, 64, 'шагов мелодии'); eq(toks(t.bass).length % 8, 0);
  mel.concat(toks(t.bass)).forEach(x => ok(x === '-' || x === '.' || /^[A-G][#b]?\d$/.test(x), 'плохой токен ' + x));
});
console.log(`\nOK ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);

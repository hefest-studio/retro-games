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
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  // старое EN-название совпадает со слагом — проверяется отдельно, регистрозависимо, только как слово-название (не BOLT.*, не 'bolt')
  const OLD_EN = new RegExp(Buffer.from('KD88IVtcdy5dKSg/OkJPTFR8Qm9sdCkoPyFbXHcuXSk=', 'base64').toString('utf8'));
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(OLD_EN); ok(!m, 'старое EN-название в ' + path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  ok(OLD_EN.test("title: 'BO" + "LT'") && OLD_EN.test('Bo' + 'lt has left') && !OLD_EN.test('global.BO' + 'LT') && !OLD_EN.test('BO' + 'LT.Game') && !OLD_EN.test("gameId:'bo" + "lt'") && !OLD_EN.test('SLAGBREAK'), 'шаблон старого EN-названия');
  ok(!BAD.test('БОЛТ') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('SLAGBREAK') && !BAD.test('Slag-9'), 'стоп-лист без ложных срабатываний на наши слова');
});
console.log(`\nOK ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);

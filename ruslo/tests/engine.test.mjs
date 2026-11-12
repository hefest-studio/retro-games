/* РУСЛО · tests/engine.test.mjs — автотесты логики (Node, без зависимостей) + трек музыки + оболочка v2.
   Запуск: node ruslo/tests/engine.test.mjs. Родные core.js/lang.js/game.js грузятся в node:vm с шимом
   window/document: без canvas#game game.js не запускает свой цикл — им управляют через RUSLO.test (как оболочка v2).
   Интеграционные UI-тесты старой страницы — ruslo/tools/test-*.js (теперь против legacy.html). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const el = () => ({ dataset: {}, setAttribute() {}, classList: { toggle() {}, add() {} } });
const store = {};
const sandbox = {
  console, Math, Array, Object, JSON, Error, Number, String, Map, Date, RegExp, Promise,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: {
    readyState: 'complete', title: '', body: el(), documentElement: el(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, createElement: () => ({ getContext: () => null }),
  },
  addEventListener() {}, requestAnimationFrame() { return 0; },
  matchMedia: () => ({ matches: false }), devicePixelRatio: 1,
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/core.js', 'js/lang.js', 'js/game.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const RUSLO = sandbox.RUSLO;
const T = RUSLO.test;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function steps(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) T.update(1 / 60); }
function fresh() { ['left', 'right', 'up', 'down', 'fire'].forEach((k) => T.hold(k, false)); T.startGame(); T.clearEnemies(); T.seekClear(); }

test('namespace: RUSLO.S, RUSLO.test, RUSLO.Render-контракт, поле 360×540', () => {
  ok(RUSLO.S && T && typeof T.startGame === 'function' && typeof T.update === 'function' && typeof T.hold === 'function');
  eq(RUSLO.W, 360); eq(RUSLO.H, 540);
});
test('без canvas#game родной цикл не стартует: режим menu, ошибок нет', () => {
  eq(RUSLO.S.mode, 'menu'); eq(RUSLO.S.errors.length, 0);
});
test('startGame: полёт, 3 жизни, полный бак, мост впереди, счёт 0', () => {
  fresh(); const s = T.state();
  eq(s.mode, 'play'); eq(s.lives, 3); eq(s.fuel, 100); eq(s.score, 0); eq(s.level, 1); ok(s.bridge && s.bridge.alive, 'нет моста');
});
test('←/→ двигают самолёт', () => {
  fresh(); const x0 = T.state().planeX; T.hold('right', true); steps(0.4); T.hold('right', false);
  ok(T.state().planeX > x0, 'вправо не сдвинулся');
  const x1 = T.state().planeX; T.hold('left', true); steps(0.4); T.hold('left', false);
  ok(T.state().planeX < x1, 'влево не сдвинулся');
});
test('↑ разгоняет, ↓ тормозит', () => {
  fresh(); T.hold('up', true); steps(1); const fast = T.state().speed; T.hold('up', false);
  T.hold('down', true); steps(1); const slow = T.state().speed; T.hold('down', false);
  ok(fast > slow, fast + ' <= ' + slow);
});
test('огонь (пробел/action → hold fire) выпускает пули, есть откат и лимит 4', () => {
  fresh(); T.hold('fire', true); steps(0.02); const n1 = T.state().bullets; ok(n1 >= 1, 'нет пули');
  steps(0.05); eq(T.state().bullets, n1, 'откат не работает'); steps(2); ok(T.state().bullets <= 4, 'больше 4 пуль'); T.hold('fire', false);
});
test('топливо расходуется; пустой бак → потеря жизни и возрождение', () => {
  fresh(); const f0 = RUSLO.S.fuel; steps(1); ok(RUSLO.S.fuel < f0, 'топливо не тратится');
  T.setFuel(0.01); steps(0.1); eq(RUSLO.S.mode, 'dying'); eq(RUSLO.S.lives, 2);
  steps(2); eq(RUSLO.S.mode, 'play', 'не возродился'); ok(RUSLO.S.fuel > 55, 'бак после возрождения ' + RUSLO.S.fuel);
});
test('мост: несколько попаданий разрушают, через паузу — уровень 2', () => {
  fresh(); T.nearBridge(600); T.bridgeHits(10); ok(!RUSLO.S.bridge.alive, 'мост цел'); ok(RUSLO.S.score >= 550, 'очки за мост');
  T.setInvuln(30); T.refuel(); steps(2.2); eq(RUSLO.S.level, 2);
});
test('конец игры: mode over, рекорд обновлён', () => {
  fresh(); RUSLO.S.score = 4321; T.forceGameOver(); eq(RUSLO.S.mode, 'over'); ok(RUSLO.S.hi >= 4321, 'hi ' + RUSLO.S.hi);
});
test('язык: RUSLO.setLang переключает подписи HUD', () => {
  RUSLO.setLang('en'); eq(RUSLO.t('hudFuel'), 'FUEL'); RUSLO.setLang('ru'); ok(RUSLO.t('hudFuel') !== 'FUEL');
});
test('трек js/music.js: валидная нотация, 8 тактов, голоса кратны', () => {
  const sb = { window: { Arcade: {} } }; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), sb);
  const t = sb.window.Arcade.tracks.ruslo; ok(t && t.bpm > 0, 'нет Arcade.tracks.ruslo');
  const toks = (s) => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/);
  const mel = toks(t.melody), bass = toks(t.bass), dr = toks(t.drums);
  eq(mel.length, 8 * t.div * 4, 'шагов мелодии'); ok(mel.length % bass.length === 0 && mel.length % dr.length === 0, 'не кратны');
  mel.concat(bass).forEach((x) => ok(x === '-' || x === '.' || /^[A-G][#b]?\d$/.test(x), 'плохой токен ' + x));
});
test('оболочка v2: engine.js → music.js первыми, нет canvas#game, миграция рекорда, legacy.html', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  eq(srcs[0], './engine.js'); eq(srcs[1], './js/music.js');
  ok(!/id="game"/.test(html), 'canvas#game запустил бы родной цикл');
  ok(/ruslo\.hi/.test(html) && /arcade\.best\.ruslo/.test(html), 'нет миграции рекорда');
  ok(fs.existsSync(path.join(ROOT, 'legacy.html')) && fs.existsSync(path.join(ROOT, 'engine.js')));
});
test('миграция localStorage: riverraid.* → ruslo.*, старые удалены, новые не затираются', () => {
  const mk = (init) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const a = mk({ 'riverraid.hi': '4242', 'riverraid.lang': '"en"', 'riverraid.gfx': '"modern"', 'riverraid.sound': 'false', 'riverraid.volume': '0.3' });
  RUSLO.store.migrate(a);
  eq(a.m.get('ruslo.hi'), '4242', 'рекорд'); eq(a.m.get('ruslo.lang'), '"en"', 'язык'); eq(a.m.get('ruslo.volume'), '0.3', 'громкость');
  ok(![...a.m.keys()].some((k) => k.startsWith('riverraid.')), 'старые ключи не удалены: ' + [...a.m.keys()]);
  const b = mk({ 'riverraid.hi': '4242', 'ruslo.hi': '5000' });
  RUSLO.store.migrate(b);
  eq(b.m.get('ruslo.hi'), '5000', 'новый рекорд затёрт старым'); ok(!b.m.has('riverraid.hi'), 'старый не удалён');
});
console.log(`\nOK ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);

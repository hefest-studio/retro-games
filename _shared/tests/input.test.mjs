/* _shared/tests/input.test.mjs — тесты API движка v2.2 (Node, без зависимостей):
   • g.menu.addItem/removeItem/items/setHint (title и pause, до и после useStandardScreens, сохранение выбора);
   • ввод по игрокам g.input.setPlayers / player(i): раздельные раскладки, dir/pressed/onPress, режим 1 игрока
     (обе раскладки ведут И1), повтор (repeat), «взвод» 120 мс после входа в play, только в сцене play;
   • проверка конфликтов с горячими клавишами (Arcade.checkBindings + console.warn), Space у И1 допустим как действие;
   • g.input.touchOnly (coarse-указатель до первого keydown) и g.usePlayers (пункт «Игроки», 1/2, тач — 1 игрок, хранение).
   Запуск: node _shared/tests/input.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8');

function makeEnv(o = {}) {
  const L = { cap: {}, bub: {} }, warns = [];
  let t = 1000;
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date,
    console: { log() {}, error() {}, warn(m) { warns.push(m); } },
    localStorage: { _d: Object.assign({}, o.store || {}), getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn, opt) { const b = (opt === true || (opt && opt.capture)) ? L.cap : L.bub; (b[ev] = b[ev] || []).push(fn); },
    removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    performance: { now: () => t },
    matchMedia: (q) => ({ matches: !!o.coarse && /pointer: coarse/.test(q) }),
  };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true, fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: 'engine.js' });
  const key = (type, code, extra = {}) => {
    const e = Object.assign({ type, code, repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }, extra);
    (L.cap[type] || []).forEach(f => f(e)); (L.bub[type] || []).forEach(f => f(e));
    return e;
  };
  return { win, A: win.Arcade, warns, key, tick: (ms) => { t += ms; }, store: win.localStorage._d, fire: (ev) => (L.bub[ev] || []).forEach(f => f({})) };
}
function game(env, extra = {}) {
  const g = env.A.createGame(Object.assign({ canvas: '#c', width: 320, height: 200, gameId: 'tst' }, extra));
  g.useStandardScreens({ title: 'T', lives: 1 });
  g.scene('play', { realtime: true });
  g.start('title');
  return g;
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

const BIND = { p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Slash', 'Period', 'Space'] },
  p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'ShiftLeft'] } };

test('версия движка 2.2.0', () => { eq(makeEnv().A.version, '2.2.0'); });

// ---------- меню ----------
test('меню: встроенные ключи title и pause', () => {
  const g = game(makeEnv());
  eq(g.menu.items('title'), ['play', 'lang', 'theme', 'sound']);
  eq(g.menu.items('pause'), ['resume', 'sound', 'menu']);
});
test('меню: addItem after/before/index/в конец, замена по ключу, removeItem', () => {
  const g = game(makeEnv());
  g.menu.addItem({ key: 'a', label: 'A', after: 'play' });
  g.menu.addItem({ key: 'b', label: () => 'B', after: 'a' });
  g.menu.addItem({ key: 'z', label: 'Z' });
  g.menu.addItem({ key: 'q', label: 'Q', before: 'sound' });
  g.menu.addItem({ key: 'i0', label: 'I', index: 0 });
  eq(g.menu.items(), ['i0', 'play', 'a', 'b', 'lang', 'theme', 'q', 'sound', 'z']);
  g.menu.addItem({ key: 'a', label: 'A2', after: 'theme' }); // тот же ключ — переезд, без дубля
  eq(g.menu.items(), ['i0', 'play', 'b', 'lang', 'theme', 'a', 'q', 'sound', 'z']);
  ok(g.menu.removeItem('i0') && g.menu.removeItem('q') && g.menu.removeItem('z') && g.menu.removeItem('a') && g.menu.removeItem('b'));
  ok(!g.menu.removeItem('nope'), 'удаление несуществующего — false');
  eq(g.menu.items(), ['play', 'lang', 'theme', 'sound']);
  g.menu.addItem({ key: 'x', label: 'X', scene: 'pause', after: 'resume' });
  eq(g.menu.items('pause'), ['resume', 'x', 'sound', 'menu']);
});
test('меню: пункт до useStandardScreens применяется при создании; выбранный пункт не сдвигается', () => {
  const env = makeEnv(), g = env.A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'tst' });
  g.menu.addItem({ key: 'early', label: 'E', after: 'play' });
  g.menu.addItem({ key: 'gone', label: 'G' }); g.menu.removeItem('gone');
  g.useStandardScreens({}); g.scene('play', { realtime: true }); g.start('title');
  eq(g.menu.items(), ['play', 'early', 'lang', 'theme', 'sound']);
  const m = g.menu.get('title'); m.sel = 3; // theme
  g.menu.addItem({ key: 'n', label: 'N', after: 'play' });
  eq(m.current().key, 'theme', 'выбор уехал');
});
test('меню: onSelect по Enter вызывается от лица движка', () => {
  const env = makeEnv(), g = game(env); let who = null;
  g.menu.addItem({ key: 'k', label: 'K', after: 'play', onSelect() { who = this; } });
  env.key('keydown', 'ArrowDown'); env.key('keyup', 'ArrowDown'); env.key('keydown', 'Enter');
  ok(who === g, 'onSelect не вызван / не тот this');
});
test('меню: setHint — строки и {text,dim} рисуются под меню заставки', () => {
  const g = game(makeEnv()), drawn = [];
  g.text = (s, x, y, o) => drawn.push({ s, y, c: o && o.color });
  g.menu.setHint(() => ['раз', { text: 'два', dim: true }]);
  g.scenes.title.draw.call(g, g.ctx);
  const a = drawn.find(d => d.s === 'раз'), b = drawn.find(d => d.s === 'два');
  ok(a && b, 'подсказка не нарисована'); eq(b.y - a.y, 20); eq(a.c, g.th().ink); eq(b.c, g.th().muted);
});

// ---------- раскладки / конфликты ----------
test('checkBindings: горячие клавиши движка и общие клавиши — конфликты; Space у И1 как действие — можно', () => {
  const A = makeEnv().A;
  eq(A.checkBindings(BIND).length, 0, 'эталонная раскладка');
  const bad = A.checkBindings({ p1: { left: ['Space'], fire: ['KeyP'] }, p2: { fire: ['Space', 'KeyM', 'ArrowLeft'], jump: ['Enter'] } });
  eq(bad.map(x => x.player + ':' + x.code + ':' + x.why).sort(),
    ['0:KeyP:hotkey', '0:Space:hotkey', '1:Enter:hotkey', '1:KeyM:hotkey', '1:Space:hotkey', '1:Space:shared'].sort());
  ['KeyP', 'Escape', 'KeyM', 'KeyL', 'KeyT', 'Enter', 'Space'].forEach(c => ok(A.hotkeys.includes(c), 'нет ' + c + ' в hotkeys'));
  eq(A.checkBindings({ p1: { fire: ['Digit1'] } }, { reserved: ['Digit1'] }).length, 1, 'reserved');
});
test('setPlayers: конфликт → console.warn при инициализации', () => {
  const env = makeEnv(), g = game(env);
  const c = g.input.setPlayers({ bind: { p1: { fire: ['KeyT'] }, p2: { fire: ['KeyF'] } } });
  eq(c.length, 1); ok(env.warns.length === 1 && /KeyT/.test(env.warns[0]), 'нет предупреждения: ' + env.warns.join(';'));
  env.warns.length = 0; g.input.setPlayers({ bind: BIND }); eq(env.warns.length, 0);
});

// ---------- ввод по игрокам ----------
function coopGame(players) {
  const env = makeEnv(), g = game(env), shots = [];
  g.input.setPlayers({ bind: BIND, actions: ['fire'], repeat: ['fire'], count: players });
  [0, 1].forEach(pi => g.input.player(pi).onPress(n => shots.push(pi + ':' + n)));
  return { env, g, shots, play() { g.goto('play'); env.tick(200); } };
}
test('2 игрока: независимые dir/pressed, onPress по своему игроку', () => {
  const { env, g, shots, play } = coopGame(2); play();
  const P1 = g.input.player(0), P2 = g.input.player(1);
  env.key('keydown', 'ArrowLeft'); env.key('keydown', 'KeyD'); env.key('keydown', 'KeyW');
  eq(P1.dir, { x: -1, y: 0 }); eq(P2.dir, { x: 1, y: -1 });
  ok(P1.pressed('left') && !P1.pressed('right') && P2.pressed('right') && !P2.pressed('left'));
  env.key('keyup', 'ArrowLeft'); eq(P1.dir, { x: 0, y: 0 });
  env.key('keydown', 'Slash'); env.key('keydown', 'KeyF'); env.key('keydown', 'Space');
  eq(shots, ['0:fire', '1:fire', '0:fire']);
  ok(g.input.player(1) === P2, 'player(i) — один объект');
});
test('1 игрок: обе раскладки ведут И1, у И2 ничего', () => {
  const { env, g, shots, play } = coopGame(1); play();
  env.key('keydown', 'KeyA'); eq(g.input.player(0).dir.x, -1); ok(!g.input.player(1).pressed('left'));
  env.key('keydown', 'KeyF'); eq(shots, ['0:fire']);
  g.input.setPlayerCount(2); ok(!g.input.player(0).pressed('left') && g.input.player(1).pressed('left'), 'переключение 1→2');
});
test('onPress: только в play, через 120 мс после входа; повтор — только для repeat; preventDefault в play', () => {
  const { env, g, shots } = coopGame(2);
  const e0 = env.key('keydown', 'Slash'); eq(shots.length, 0, 'в title стреляет'); ok(!e0.defaultPrevented, 'в меню / не должен глушиться');
  g.goto('play'); env.key('keydown', 'KeyF'); eq(shots.length, 0, 'сразу после входа стреляет');
  env.tick(150); const e1 = env.key('keydown', 'KeyF', { repeat: true }); eq(shots, ['1:fire']); ok(e1.defaultPrevented);
  g.input.setPlayers({ bind: BIND, actions: ['fire'], repeat: [] });
  env.key('keydown', 'KeyF', { repeat: true }); eq(shots.length, 1, 'repeat без разрешения');
  ok(g.input.player(0).pressed('up') === false);
  env.key('keydown', 'ArrowUp'); ok(g.input.player(0).pressed('up'), 'held вне actions всё равно отслеживается');
});
test('по умолчанию actions = все не-направления', () => {
  const env = makeEnv(), g = game(env), got = [];
  g.input.setPlayers({ bind: { p1: { left: ['ArrowLeft'], jump: ['ArrowUp'], grab: ['Slash'] }, p2: {} } });
  g.input.player(0).onPress(n => got.push(n)); g.goto('play'); env.tick(200);
  env.key('keydown', 'ArrowLeft'); env.key('keydown', 'ArrowUp'); env.key('keydown', 'Slash');
  eq(got, ['jump', 'grab']);
});
test('blur сбрасывает зажатые клавиши игроков', () => {
  const { env, g, play } = coopGame(2); play();
  env.key('keydown', 'KeyA'); ok(g.input.player(1).pressed('left'));
  env.fire('blur'); ok(!g.input.player(1).pressed('left'));
});

// ---------- touchOnly / usePlayers ----------
test('touchOnly: coarse-указатель → true до первого (настоящего) keydown', () => {
  const env = makeEnv({ coarse: true }), g = game(env);
  ok(g.input.touchOnly, 'должно быть true');
  env.key('keydown', 'KeyQ', { isTrusted: false }); ok(g.input.touchOnly, 'синтетическое событие не снимает');
  env.key('keydown', 'KeyQ'); ok(!g.input.touchOnly, 'не снялось по keydown');
  ok(!game(makeEnv()).input.touchOnly, 'на десктопе — false');
});
test('usePlayers: пункт «Игроки» после «Играть», клавиши 1/2 на заставке, хранение arcade.players.<id>', () => {
  const env = makeEnv(), g = game(env, { strings: { ru: { players: 'Игроки' }, en: {} } });
  const P = g.usePlayers({ bind: BIND, actions: ['fire'] });
  eq(g.menu.items(), ['play', 'players', 'lang', 'theme', 'sound']);
  eq(P.count(), 1); env.key('keydown', 'Digit2'); eq(g.input.playerCount, 2); eq(env.store['arcade.players.tst'], '2');
  const m = g.menu.get(); ok(/Игроки: 2/.test(m.items[1].label()), m.items[1].label());
  m.items[1].onSelect.call(g); eq(g.input.playerCount, 1);
  g.goto('play'); env.key('keydown', 'Digit2'); eq(g.input.playerCount, 1, '1/2 работают только на заставке');
  const env2 = makeEnv({ store: { 'arcade.players.tst': '2' } }), g2 = game(env2); g2.usePlayers({ bind: BIND });
  eq(g2.input.playerCount, 2, 'выбор не восстановился');
});
test('usePlayers на «только тач»: 1 игрок, 2 недоступно до клавиатуры; подсказка — 1 строка', () => {
  const env = makeEnv({ coarse: true, store: { 'arcade.players.tst': '2' } }), g = game(env);
  g.usePlayers({ bind: BIND, hint: { ru: ['И1', 'И2'], en: ['P1', 'P2'] } });
  eq(g.input.playerCount, 1); g.players.set(2); eq(g.input.playerCount, 1);
  ok(/тач/.test(g.menu.get().items[1].label()));
  const drawn = []; g.text = (s) => drawn.push(s); g.scenes.title.draw.call(g, g.ctx);
  ok(drawn.includes('И1') && !drawn.includes('И2'), drawn.join('|'));
  env.key('keydown', 'Digit2'); eq(g.input.playerCount, 2, 'физическая клавиша разблокирует кооп');
});
test('usePlayers: Digit1/2 и Numpad — в reserved (конфликт → warn)', () => {
  const env = makeEnv(), g = game(env);
  g.usePlayers({ bind: { p1: { fire: ['Digit1'] }, p2: {} } });
  ok(env.warns.some(w => /Digit1/.test(w)), env.warns.join(';'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

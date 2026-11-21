/* _shared/tests/gamepad.test.mjs — геймпад движка v2.9 (Node, без зависимостей; navigator.getGamepads — мок):
   • нет Gamepad API / getGamepads бросает — без ошибок; подключение/отключение (onConnect, сообщение, автопауза, отпускание клавиш);
   • оси: мёртвая зона, гистерезис стика, D-pad; кнопки → виртуальные клавиши (DOM KeyboardEvent и запасной путь без DOM), автоповтор;
   • меню движка геймпадом (↑↓, A — выбор, B — назад, Start — Enter, пауза: Start/B — «Продолжить»);
   • play: A/B/X/Y/LB/RB/LT/RT → клавиши по умолчанию; раскладки setPlayers/usePlayers: И1 и И2 (второй геймпад), 1 игрок — оба → И1;
   • configure({ play:false }), onButton, stick/trigger, rumble (vibrationActuator, hapticActuators, выкл), стили подписей, prompt, tapstart.
   Запуск: node _shared/tests/gamepad.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8');

function makeCtx(log) {
  const base = { imageSmoothingEnabled: true, measureText: (s) => ({ width: String(s).length * 6 }) };
  return new Proxy(base, { get(t, k) { if (k in t) return t[k]; return (...a) => { if (log && (k === 'fillText' || k === 'arc')) log.push([k, a[0]]); }; }, set(t, k, v) { t[k] = v; return true; } });
}
// o.pads — массив (мутируемый) «геймпадов»; o.nav === false — без navigator; o.throws — getGamepads бросает; o.dom === false — без KeyboardEvent
function makeEnv(o = {}) {
  const L = { cap: {}, bub: {} }, warns = [], errors = [], draws = [];
  let t = 1000;
  const fire = (type, e) => { (L.cap[type] || []).forEach(f => f(e)); (L.bub[type] || []).forEach(f => f(e)); };
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, Promise, String, Number, isFinite,
    console: { log() {}, error(e) { errors.push(e); }, warn(m) { warns.push(m); } },
    localStorage: { _d: Object.assign({}, o.store || {}), getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    addEventListener(ev, fn, opt) { const b = (opt === true || (opt && opt.capture)) ? L.cap : L.bub; (b[ev] = b[ev] || []).push(fn); },
    removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 0; },
    requestAnimationFrame(fn) { win._rafFn = fn; return 0; }, cancelAnimationFrame() {},
    performance: { now: () => t },
    matchMedia: () => ({ matches: false }),
  };
  const pads = o.pads || [];
  if (o.nav !== false) win.navigator = { getGamepads() { if (o.throws) throw new Error('SecurityError'); return pads.slice(); } };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => makeCtx(draws) };
  const attrs = {};
  const sent = [];
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false, documentElement: { setAttribute(k, v) { attrs[k] = v; } } };
  if (o.dom !== false) {
    win.KeyboardEvent = class { constructor(type, init) { Object.assign(this, init); this.type = type; this.isTrusted = false; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } stopPropagation() {} };
    win.document.body = { dispatchEvent(e) { sent.push(e); fire(e.type, e); return true; } };
  }
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: 'engine.js' });
  const key = (type, code, extra = {}) => { const e = Object.assign({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }, extra); fire(type, e); return e; };
  // кадр цикла движка: время + rAF (в цикле — опрос геймпада)
  const frame = (ms = 16) => { t += ms; if (win._rafFn) win._rafFn(t); };
  return { win, A: win.Arcade, pads, warns, errors, draws, attrs, sent, key, frame, fire, tick: (ms) => { t += ms; }, store: win.localStorage._d };
}
function pad(index = 0, id = 'Generic pad (STANDARD GAMEPAD)', extra = {}) {
  return Object.assign({ index, id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }, extra);
}
const IX = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
const btn = (p, n, on) => { p.buttons[IX[n]] = { pressed: !!on, value: on ? 1 : 0 }; };
function game(env, extra = {}) {
  const g = env.A.createGame(Object.assign({ canvas: '#c', width: 320, height: 200, gameId: 'tst' }, extra));
  g.useStandardScreens({ title: 'T', lives: 1 });
  g.scene('play', { realtime: true });
  g.start('title');
  env.frame(1);
  return g;
}
const press = (env, p, n, ms = 16) => { btn(p, n, true); env.frame(ms); btn(p, n, false); env.frame(ms); };

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e)); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ---------- версия, отсутствие API ----------
test('версия движка 2.9.0; API геймпада экспортировано', () => {
  const A = makeEnv().A; eq(A.version, '2.9.0'); ok(typeof A.Gamepads === 'function' && A.padNames.includes('start') && A.padKeys.a === 'Space');
});
test('без navigator.getGamepads: игра стартует, кадры идут, count 0, rumble false — без ошибок', () => {
  const env = makeEnv({ nav: false }), g = game(env);
  for (let i = 0; i < 5; i++) env.frame();
  ok(!g.gamepad.supported); eq(g.gamepad.count(), 0); eq(g.rumble(200), false); eq(g.gamepad.stick('left'), { x: 0, y: 0 }); eq(env.errors.length, 0, 'ошибки: ' + env.errors.join(';'));
});
test('getGamepads бросает (Permissions-Policy в iframe) — опрос выключается, ошибок нет', () => {
  const env = makeEnv({ throws: true }), g = game(env); env.frame(); env.frame();
  ok(!g.gamepad.supported); eq(env.errors.length, 0);
});

// ---------- подключение / отключение ----------
test('подключение: onConnect, сообщение «Геймпад подключён» вне игры, устройство gamepad и <html data-input> после нажатия', () => {
  const env = makeEnv(), g = game(env), got = [];
  g.gamepad.onConnect((info, on) => got.push([info.slot, info.player, on]));
  const p = pad(0); env.pads.push(p); env.frame();
  eq(got, [[0, 0, true]]); eq(g.gamepad.count(), 1); ok(g._padToast && /подключён/.test(g._padToast.text), JSON.stringify(g._padToast));
  for (let i = 0; i < 160; i++) env.frame(16); ok(!g._padToast, 'плашка не исчезла');
  eq(g.input.device, 'keyboard', 'до нажатия устройство не меняется');
  press(env, p, 'a'); eq(g.input.device, 'gamepad'); eq(env.attrs['data-input'], 'gamepad');
  env.key('keydown', 'KeyQ'); eq(g.input.device, 'keyboard', 'настоящая клавиша → keyboard');
});
test('отключение во время игры: зажатые клавиши отпущены, автопауза, сообщение; null-слоты и connected:false — как отключение', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame();
  g.goto('play'); env.tick(200);
  btn(p, 'left', true); env.frame(); ok(g.input.pressed('left'), 'влево не зажато');
  env.pads[0] = null; env.frame();
  ok(!g.input.pressed('left'), 'клавиша не отпущена'); eq(g._sceneName, 'pause'); ok(/отключён/.test(g._padToast.text)); eq(g.gamepad.count(), 0);
  const q = pad(1); env.pads[0] = q; env.frame(); eq(g.gamepad.count(), 1); q.connected = false; env.frame(); eq(g.gamepad.count(), 0);
});

// ---------- оси ----------
test('стик: мёртвая зона и гистерезис направлений (нажатие > 0.5, отпускание < 0.35)', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  p.axes[0] = 0.2; env.frame(); eq(g.input.dir.x, 0, 'в мёртвой зоне');
  p.axes[0] = 0.45; env.frame(); eq(g.input.dir.x, 0, 'ниже порога нажатия');
  p.axes[0] = 0.6; env.frame(); eq(g.input.dir.x, 1, 'вправо');
  p.axes[0] = 0.4; env.frame(); eq(g.input.dir.x, 1, 'гистерезис: держится');
  p.axes[0] = 0.3; env.frame(); eq(g.input.dir.x, 0, 'отпущено');
  p.axes[1] = -0.9; env.frame(); eq(g.input.dir.y, -1, 'вверх');
});
test('g.gamepad.stick: радиальная мёртвая зона 0.25 и масштаб 0…1; правый стик; trigger', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame();
  p.axes = [0.2, 0.1, 0, 0]; env.frame(); eq(g.gamepad.stick('left'), { x: 0, y: 0 });
  p.axes = [0.625, 0, 0, -1]; env.frame(); const s = g.gamepad.stick('left'); ok(near(s.x, 0.5) && s.y === 0, JSON.stringify(s));
  ok(near(g.gamepad.stick('right').y, -1)); p.axes = [3, 0, 0, 0]; env.frame(); ok(near(g.gamepad.stick().x, 1), 'обрезка до 1');
  p.buttons[7] = { pressed: false, value: 0.3 }; env.frame(); ok(near(g.gamepad.trigger('right'), 0.3)); eq(g.gamepad.trigger('left'), 0);
  g.gamepad.configure({ deadzone: 0.5 }); p.axes = [0.4, 0, 0, 0]; env.frame(); eq(g.gamepad.stick().x, 0, 'своя мёртвая зона');
});
test('D-pad и стик вместе — одно направление; кнопки-числа (не объекты) тоже читаются', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  btn(p, 'right', true); p.axes[0] = 0.9; env.frame(); eq(g.input.dir.x, 1);
  btn(p, 'right', false); env.frame(); eq(g.input.dir.x, 1, 'стик ещё держит'); p.axes[0] = 0; env.frame(); eq(g.input.dir.x, 0);
  p.buttons[IX.down] = 1; env.frame(); eq(g.input.dir.y, 1); p.buttons[IX.down] = 0; env.frame(); eq(g.input.dir.y, 0);
});

// ---------- меню ----------
test('меню заставки: ↓ / стик вниз — следующий пункт, A — выбор («Играть» → play)', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame();
  const m = g.menu.get('title'); eq(m.sel, 0);
  press(env, p, 'down'); eq(m.sel, 1); p.axes[1] = 0.8; env.frame(); p.axes[1] = 0; env.frame(); eq(m.sel, 2);
  press(env, p, 'up'); press(env, p, 'up'); eq(m.sel, 0);
  press(env, p, 'a'); eq(g._sceneName, 'play');
});
test('меню: Start — Enter (выбор), пункт g.menu.addItem выбирается A', () => {
  const env = makeEnv(), g = game(env), p = pad(0); let hit = 0; env.pads.push(p); env.frame();
  g.menu.addItem({ key: 'k', label: 'K', after: 'play', onSelect() { hit++; } });
  press(env, p, 'down'); press(env, p, 'a'); eq(hit, 1);
  g.goto('title'); g.menu.get('title').sel = 0; press(env, p, 'start'); eq(g._sceneName, 'play', 'Start на заставке не запустил');
});
test('пауза: Start в play → пауза; в стандартной паузе Start и B → «Продолжить»; со своей press — P', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame();
  g.goto('play'); env.tick(200); press(env, p, 'start'); eq(g._sceneName, 'pause');
  press(env, p, 'start'); eq(g._sceneName, 'play'); press(env, p, 'select'); eq(g._sceneName, 'pause', 'Select — меню паузы');
  press(env, p, 'b'); eq(g._sceneName, 'play', 'B в паузе — назад в игру');
  let got = []; g.scenes.pause.press = function (a) { got.push(a); if (a === 'pause') this.goto('play', { resume: true }); };
  press(env, p, 'start'); press(env, p, 'start'); eq(g._sceneName, 'play'); eq(got, ['pause']);
  press(env, p, 'start'); const pm = g.menu.get('pause'); press(env, p, 'down'); eq(pm.sel, 1, 'навигация в паузе');
});
test('финал: A — «дальше» (в меню); подпись tapstart при геймпаде — «A — дальше», иначе «пробел / тап»', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame();
  eq(g.t('tapstart'), 'пробел / тап'); g.goto('win'); press(env, p, 'a'); eq(g._sceneName, 'title');
  eq(g.t('tapstart'), 'A — дальше'); g.i18n.set('en'); eq(g.t('tapstart'), 'A — continue');
  env.key('keydown', 'KeyQ'); eq(g.t('tapstart'), 'space / tap');
});

// ---------- play: кнопки → клавиши ----------
test('play без раскладок: A — Space (action), B — KeyX, X — KeyZ, Y — KeyC, LB — KeyQ, RB — KeyE, LT — Shift, RT — KeyF', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  const acts = []; g.scenes.play.press = (a) => acts.push(a);
  btn(p, 'a', true); env.frame(); ok(g.input.pressed('action') && g.input.codes.Space); btn(p, 'a', false); env.frame(); ok(!g.input.pressed('action'));
  eq(acts, ['action']);
  for (const [n, c] of [['b', 'KeyX'], ['x', 'KeyZ'], ['y', 'KeyC'], ['lb', 'KeyQ'], ['rb', 'KeyE'], ['lt', 'ShiftLeft'], ['rt', 'KeyF']]) {
    btn(p, n, true); env.frame(); ok(g.input.codes[c], n + ' → ' + c); btn(p, n, false); env.frame(); ok(!g.input.codes[c], n + ' отпущена');
  }
  g.gamepad.configure({ keys: { b: 'KeyE' } }); btn(p, 'b', true); env.frame(); ok(g.input.codes.KeyE, 'configure keys'); btn(p, 'b', false); env.frame();
});
test('DOM-путь: KeyboardEvent на body с code/key/keyCode, arcadePad, isTrusted:false — его видят обработчики игры', () => {
  const env = makeEnv(), g = game(env), p = pad(0), seen = []; env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  env.win.addEventListener('keydown', (e) => seen.push(e.code + '|' + e.key + '|' + e.keyCode + '|' + !!e.arcadePad + '|' + e.isTrusted));
  btn(p, 'y', true); env.frame(); btn(p, 'left', true); env.frame();
  eq(seen, ['KeyC|c|67|true|false', 'ArrowLeft|ArrowLeft|37|true|false']);
  ok(env.sent.every((e) => e.bubbles && e.cancelable), 'bubbles/cancelable');
});
test('без KeyboardEvent (запасной путь) — клавиши прямо в ввод движка', () => {
  const env = makeEnv({ dom: false }), g = game(env), p = pad(0); env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  btn(p, 'right', true); env.frame(); eq(g.input.dir.x, 1); btn(p, 'right', false); env.frame(); eq(g.input.dir.x, 0);
});
test('автоповтор: удержание → keydown repeat:true через 320 мс, затем каждые 70 мс; Start не повторяется', () => {
  const env = makeEnv(), g = game(env), p = pad(0), rep = []; env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  env.win.addEventListener('keydown', (e) => rep.push(e.code + (e.repeat ? '+' : '')));
  btn(p, 'right', true); env.frame(16); for (let i = 0; i < 20; i++) env.frame(16); // ≈ 336 мс
  ok(rep[0] === 'ArrowRight' && rep.filter((r) => r === 'ArrowRight+').length === 1, rep.join(','));
  for (let i = 0; i < 9; i++) env.frame(16); // +144 мс → ещё ≈ 2
  const n = rep.filter((r) => r === 'ArrowRight+').length; ok(n >= 2 && n <= 4, 'повторов ' + n);
  btn(p, 'right', false); env.frame(); rep.length = 0; g.goto('pause');
  btn(p, 'select', true); for (let i = 0; i < 40; i++) env.frame(16); ok(!rep.some((r) => /\+$/.test(r)), 'Select повторился: ' + rep.join(','));
});
test('две кнопки на одну клавишу — одно нажатие, отпускание после обеих; blur — всё отпущено, зажатое снова нажимается', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame(); g.goto('play'); env.tick(200);
  g.gamepad.configure({ keys: { x: 'Space' } });
  btn(p, 'a', true); env.frame(); btn(p, 'x', true); env.frame(); btn(p, 'a', false); env.frame(); ok(g.input.pressed('action'), 'отпустилось раньше времени');
  btn(p, 'x', false); env.frame(); ok(!g.input.pressed('action'));
  btn(p, 'left', true); env.frame(); ok(g.input.pressed('left'));
  env.fire('blur', {}); ok(!g.input.pressed('left'), 'blur'); env.frame(); ok(g.input.pressed('left'), 'снова нажато после blur');
});

// ---------- игроки ----------
const BIND = { p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Slash', 'Period', 'Space'], jump: ['KeyK'] },
  p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'ShiftLeft'], jump: ['KeyG'] } };
test('usePlayers, 2 игрока: 1-й геймпад → И1, 2-й → И2 (направления и действия раскладки), onPress по игроку', () => {
  const env = makeEnv(), g = game(env, { strings: { ru: { players: 'Игроки' }, en: {} } }), shots = [];
  g.usePlayers({ bind: BIND, actions: ['fire', 'jump'] }); g.players.set(2);
  [0, 1].forEach((i) => g.input.player(i).onPress((n) => shots.push(i + ':' + n)));
  const p1 = pad(0), p2 = pad(3); env.pads.push(p1, p2); env.frame(); eq(g.gamepad.list().map((x) => x.player), [0, 1]);
  g.goto('play'); env.tick(200);
  btn(p2, 'left', true); env.frame(); ok(g.input.player(1).pressed('left') && !g.input.player(0).pressed('left'), 'И2 влево');
  btn(p1, 'right', true); env.frame(); eq(g.input.player(0).dir.x, 1);
  press(env, p2, 'a'); press(env, p1, 'a'); press(env, p2, 'b'); press(env, p1, 'b');
  eq(shots, ['1:fire', '0:fire', '1:jump', '0:jump']);
  press(env, p2, 'rb'); ok(!env.sent.some((e) => e.code === 'KeyE'), 'у И2 нет клавиши для RB — кнопка молчит');
});
test('usePlayers, 1 игрок: оба геймпада ведут И1; players:[1,0] меняет порядок', () => {
  const env = makeEnv(), g = game(env); g.usePlayers({ bind: BIND, actions: ['fire'] }); g.players.set(1);
  const shots = []; g.input.player(0).onPress((n) => shots.push('0:' + n)); g.input.player(1).onPress((n) => shots.push('1:' + n));
  const p1 = pad(0), p2 = pad(1); env.pads.push(p1, p2); env.frame(); g.goto('play'); env.tick(200);
  btn(p2, 'left', true); env.frame(); ok(g.input.player(0).pressed('left'), 'второй геймпад — И1'); btn(p2, 'left', false); env.frame();
  press(env, p2, 'a'); eq(shots, ['0:fire']);
  g.players.set(2); g.gamepad.configure({ players: [1, 0] }); eq(g.gamepad.list().map((x) => x.player), [1, 0]);
  btn(p1, 'left', true); env.frame(); ok(g.input.player(1).pressed('left'), 'players:[1,0]');
});
test('configure({ actions }) — своя кнопка для действия; меню при раскладке — по-прежнему стрелки и Space', () => {
  const env = makeEnv(), g = game(env); g.input.setPlayers({ bind: BIND, actions: ['fire', 'jump'] });
  g.gamepad.configure({ actions: { a: 'jump', b: 'fire' } }); const got = []; g.input.player(0).onPress((n) => got.push(n));
  const p = pad(0); env.pads.push(p); env.frame();
  press(env, p, 'down'); eq(g.menu.get('title').sel, 1, 'меню'); g.goto('play'); env.tick(200);
  press(env, p, 'a'); press(env, p, 'b'); eq(got, ['jump', 'fire']);
});

// ---------- игра читает геймпад сама ----------
test('configure({ play:false }): в play кнопки и стик клавиш не шлют, Start — пауза; onButton получает всё', () => {
  const env = makeEnv(), g = game(env, { gamepad: { play: false } }), p = pad(0), ev = []; env.pads.push(p); env.frame();
  g.gamepad.onButton((n, down, info) => ev.push(n + (down ? '+' : '-') + info.slot));
  g.goto('play'); env.tick(200); env.sent.length = 0;
  press(env, p, 'a'); p.axes[0] = 1; env.frame(); p.axes[0] = 0; env.frame();
  eq(env.sent.length, 0, 'клавиши: ' + env.sent.map((e) => e.code).join(',')); ok(!g.input.dir.x);
  eq(ev, ['a+0', 'a-0', 'right+0', 'right-0']); ok(g.gamepad.pressed('a') === false);
  btn(p, 'x', true); env.frame(); ok(g.gamepad.pressed('x') && g.gamepad.pressed('x', 0) && !g.gamepad.pressed('x', 1)); btn(p, 'x', false); env.frame();
  press(env, p, 'start'); eq(g._sceneName, 'pause');
  g.goto('play'); env.tick(200); g.gamepad.configure({ keys: { select: 'KeyB', start: null } }); env.sent.length = 0;
  press(env, p, 'select'); eq(env.sent.map((e) => e.type + ':' + e.code), ['keydown:KeyB', 'keyup:KeyB'], 'keys.select в play'); eq(g._sceneName, 'play');
  press(env, p, 'start'); eq(g._sceneName, 'play', 'start:null — молчит'); g.goto('pause'); press(env, p, 'start'); eq(g._sceneName, 'play', 'в паузе Start — как всегда');
});

// ---------- вибрация ----------
test('rumble: vibrationActuator.playEffect с параметрами; hapticActuators.pulse; выкл arcade.rumble=0; по игроку', () => {
  const env = makeEnv(), g = game(env), calls = [];
  const p = pad(0, 'x', { vibrationActuator: { type: 'dual-rumble', playEffect: (t, o) => { calls.push([t, o.duration, o.strongMagnitude, o.weakMagnitude]); return Promise.reject(new Error('busy')); } } });
  const q = pad(1, 'y', { hapticActuators: [{ pulse: (v, ms) => { calls.push(['pulse', v, ms]); return Promise.resolve(true); } }] });
  const r = pad(2, 'z'); env.pads.push(p, q, r); env.frame();
  ok(g.rumble({ ms: 120, strong: 1, weak: 0.2 })); eq(calls, [['dual-rumble', 120, 1, 0.2], ['pulse', 1, 120]]);
  calls.length = 0; ok(g.rumble({ ms: 80, player: 1 })); eq(calls, [['pulse', 0.6, 80]], 'player 1 — слоты 1 и 2 (у третьего нет актуатора)');
  calls.length = 0; g.gamepad.setRumble(false); eq(g.rumble(100), false); eq(calls.length, 0); eq(env.store['arcade.rumble'], '0');
  const env2 = makeEnv(), g2 = game(env2); env2.pads.push(pad(0)); env2.frame(); eq(g2.rumble(100), false, 'без актуатора');
  eq(env.errors.length, 0);
});

// ---------- подписи и подсказки ----------
test('стиль подписей по id: по умолчанию буквы, вендор 054c — фигуры, 057e — буквы по месту; prompt по устройству', () => {
  const A = makeEnv().A; eq(A.padStyle('Generic (STANDARD GAMEPAD)'), 'letters'); eq(A.padStyle('Wireless (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'shapes');
  eq(A.padStyle('054c-09cc-Wireless'), 'shapes'); eq(A.padStyle('Pro (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'alt'); eq(A.padStyle('28de-11ff-Virtual'), 'letters');
  const env = makeEnv(), g = game(env); eq(g.prompt('a'), 'Space'); eq(g.prompt('b'), 'X'); eq(g.prompt('start'), 'P'); eq(g.prompt('left'), '←');
  const p = pad(0, 'Wireless (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'); env.pads.push(p); env.frame(); press(env, p, 'down');
  eq(g.prompt('a'), '✕'); eq(g.prompt('lb'), 'L1'); eq(g.gamepad.glyph('y'), '△'); eq(g.prompt('up'), '↑');
  g.gamepad.configure({ style: 'deck' }); eq(g.prompt('a'), 'A'); eq(g.prompt('rt'), 'R2'); g.gamepad.configure({ style: null }); eq(g.prompt('a'), '\u2715');
});
test('подсказка геймпада в меню: рисуется только при геймпаде (A … / B …), cfg.hints:false — нет; drawPrompt без ошибок', () => {
  const env = makeEnv(), g = game(env), p = pad(0); env.pads.push(p); env.frame();
  let calls = 0; const dp = g.drawPrompt; g.drawPrompt = function (items) { calls++; this._lastPrompt = items; return dp.apply(this, arguments); };
  env.frame(); eq(calls, 0, 'клавиатура — без подсказки геймпада');
  press(env, p, 'down'); ok(calls > 0, 'нет подсказки'); eq(g._lastPrompt.map((x) => x[0]), ['a'], 'на заставке — только A');
  g.goto('pause'); env.frame(); eq(g._lastPrompt.map((x) => x[0] + ':' + x[1]), ['a:выбрать', 'b:Продолжить']);
  g.goto('play'); calls = 0; env.frame(); eq(calls, 0, 'в игре движок подсказку не рисует');
  g.gamepad.configure({ hints: false }); g.goto('title'); env.frame(); eq(calls, 0);
  ok(dp.call(g, [['a', 'ok'], ['lb', 'L'], ['start', 'S'], ['select', ''], ['up', 'u']], 10, 10, { pill: true }) > 0); ok(dp.call(g, [['a', 'ok']], 10, 10, { device: 'keyboard' }) > 0);
  eq(env.errors.length, 0);
});
test('встроенные строки pad_* есть во всех языках движка', () => {
  const env = makeEnv(), g = game(env);
  for (const l of ['ru', 'en', 'tr', 'es', 'pt']) { g.i18n.lang = l; for (const k of ['pad_ok', 'pad_back', 'pad_next', 'pad_on', 'pad_off']) ok(g.t(k) && g.t(k) !== k, l + ':' + k); }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

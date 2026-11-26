/* _shared/tests/autopause.test.mjs — движок v2.10 (Node, без зависимостей):
   • автопауза на сайте (без площадки): скрытая вкладка в play → пауза (g.awayPaused), видимая — остаётся экран паузы, игрок продолжает сам;
     вне play — ничего; createGame({ autoPause:false }) — выключено; у игры без сцены pause — только заморозка цикла (без скачка dt);
     blur окна на сайте паузу не ставит и звук не трогает;
   • с площадкой (platform.js) — прежний путь: скрытая вкладка → пауза, blur → пауза и тишина; без сцены pause — без заморозки;
   • касания: Arcade.touchOk(e) — preventDefault только у cancelable, эмуляция мыши после касания пропускается; тач-дпад, кнопка паузы
     usePlayers и холст (меню) не зовут preventDefault у неотменяемых касаний и не дают второго нажатия от эмуляции мыши;
     [data-arcade-touch] на пульте/кнопках/холсте и правило touch-action:none.
   Запуск: node _shared/tests/autopause.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENGINE = fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8');
const PLATFORM = fs.readFileSync(path.join(ROOT, '_shared/platform.js'), 'utf8');

function el(tag, attrs = {}) {
  const L = {};
  return { tag, style: {}, dataset: {}, _a: Object.assign({}, attrs), _L: L, textContent: '', children: [],
    getAttribute(k) { return k in this._a ? this._a[k] : null; }, setAttribute(k, v) { this._a[k] = String(v); }, hasAttribute(k) { return k in this._a; },
    addEventListener(ev, f) { (L[ev] = L[ev] || []).push(f); }, removeEventListener() {},
    querySelectorAll(q) { return this.children.filter((c) => (q === '[data-d]' && c.dataset.d) || (q === '[data-pause]' && c.hasAttribute('data-pause'))); },
    querySelector(q) { return this.querySelectorAll(q)[0] || null; },
    fire(ev, o = {}) { const e = Object.assign({ type: ev, cancelable: true, defaultPrevented: false, changedTouches: [{ clientX: 5, clientY: 5 }], preventDefault() { this.defaultPrevented = true; this.prevented = (this.prevented || 0) + 1; } }, o); (L[ev] || []).forEach((f) => f(e)); return e; } };
}
function makeEnv({ platform = false, opts = {} } = {}) {
  let t = 1000, raf = null;
  const wl = {}, dl = {}, styles = [];
  const ac = { state: 'running', calls: [], suspend() { this.calls.push('suspend'); }, resume() { this.calls.push('resume'); }, currentTime: 0, destination: {},
    createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, type: '' }; },
    createGain() { return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; } };
  const win = { console: { log() {}, error() {}, warn() {} }, Math, Object, Array, JSON, Error, Promise, Date, parseInt, parseFloat, Float32Array, setTimeout, clearTimeout,
    location: { search: '', hostname: 'localhost', hash: '', protocol: 'https:' },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    addEventListener(ev, f) { (wl[ev] = wl[ev] || []).push(f); }, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {},
    requestAnimationFrame(f) { raf = f; return 1; }, cancelAnimationFrame() {}, performance: { now: () => t } };
  const canvas = el('canvas'); canvas.width = 100; canvas.height = 100;
  canvas.getContext = () => ({ imageSmoothingEnabled: true, save() {}, restore() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 10 }), beginPath() {}, arc() {}, fill() {} });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  const body = el('body'), html = el('html');
  win.document = { hidden: false, readyState: 'complete', body, documentElement: html, currentScript: null,
    querySelector(q) { return q === '#c' ? canvas : null; }, querySelectorAll() { return []; }, getElementById() { return null; },
    addEventListener(ev, f) { (dl[ev] = dl[ev] || []).push(f); }, createElement(tag) { const e = el(tag); if (tag === 'style') styles.push(e); return e; },
    head: { appendChild() {} } };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  if (platform) vm.runInContext(PLATFORM, win, { filename: 'platform.js' });
  vm.runInContext(ENGINE, win, { filename: 'engine.js' });
  const g = win.Arcade.createGame(Object.assign({ canvas: '#c', width: 100, height: 100, gameId: 'tst' }, opts));
  g.audio.ac = ac; g.audio.unlocked = true;
  const fireWin = (ev, o = {}) => (wl[ev] || []).forEach((f) => f(Object.assign({ type: ev }, o)));
  const setHidden = (h) => { win.document.hidden = h; (dl.visibilitychange || []).forEach((f) => f({ type: 'visibilitychange' })); };
  return { win, g, A: win.Arcade, canvas, ac, styles, fireWin, setHidden, frame: (ms) => { t += ms; if (raf) raf(t); }, tick: (ms) => { t += ms; } };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function playGame(env, { pause = true } = {}) {
  const g = env.g, upd = { n: 0, dt: [] };
  if (pause) g.useStandardScreens({});
  g.scene('play', { update(dt) { upd.n++; upd.dt.push(dt); }, draw() {} });
  if (!pause) g.scene('title', { realtime: true, draw() {} });
  g.start('play');
  return upd;
}

const queue = []; let passed = 0, failed = 0;
function test(name, fn) { queue.push([name, fn]); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// ---------- автопауза на сайте ----------
test('сайт: скрытая вкладка в play → пауза (awayPaused); видимая — экран паузы остаётся; «Продолжить» — игрок', () => {
  const e = makeEnv(), g = e.g; playGame(e); ok(g.platform === null); eq(g._sceneName, 'play');
  e.setHidden(true); eq(g._sceneName, 'pause', 'hidden → пауза'); ok(g.awayPaused, 'awayPaused');
  e.setHidden(false); eq(g._sceneName, 'pause', 'вкладка видна — игра ждёт игрока');
  g.goto('play', { resume: true }); eq(g._sceneName, 'play'); ok(!g.awayPaused, 'после продолжения флаг снят');
  g.pause(); ok(!g.awayPaused, 'пауза игрока (P) — не автопауза');
});
test('сайт: вне play (заставка, пауза, финал) скрытая вкладка сцену не меняет', () => {
  const e = makeEnv(), g = e.g; playGame(e);
  for (const sc of ['title', 'gameover', 'win']) { g.goto(sc); e.setHidden(true); eq(g._sceneName, sc); e.setHidden(false); }
  g.goto('play'); g.pause(); e.setHidden(true); eq(g._sceneName, 'pause'); ok(!g.awayPaused); e.setHidden(false);
});
test('сайт: createGame({ autoPause:false }) — скрытая вкладка паузу не ставит и цикл не морозит', () => {
  const e = makeEnv({ opts: { autoPause: false } }), g = e.g; const u = playGame(e);
  e.setHidden(true); eq(g._sceneName, 'play'); ok(!g._hiddenFreeze); const n = u.n; e.frame(20); ok(u.n > n, 'цикл идёт'); e.setHidden(false);
});
test('сайт: у игры без сцены pause — только заморозка цикла, при возврате без скачка времени', () => {
  const e = makeEnv(), g = e.g; const u = playGame(e, { pause: false }); ok(!g.scenes.pause);
  e.frame(17); const n0 = u.n; ok(n0 > 0, 'цикл шёл');
  e.setHidden(true); eq(g._sceneName, 'play', 'сцена та же'); ok(g._hiddenFreeze, 'заморожено');
  e.frame(17); e.frame(5000); eq(u.n, n0, 'пока вкладка скрыта — update не зовётся');
  e.setHidden(false); ok(!g._hiddenFreeze); u.dt.length = 0; e.frame(17); ok(u.n > n0, 'цикл снова идёт');
  ok(u.dt.reduce((a, b) => a + b, 0) <= 0.05, 'нет скачка dt после возврата: ' + u.dt.join(','));
});
test('сайт: blur окна — без паузы и без тишины (iframe/devtools дают ложные blur)', () => {
  const e = makeEnv(), g = e.g; playGame(e); e.ac.calls.length = 0;
  e.fireWin('blur'); eq(g._sceneName, 'play'); ok(!e.ac.calls.includes('suspend')); e.fireWin('focus');
});

// ---------- площадка: прежний путь ----------
test('площадка: скрытая вкладка → пауза, blur → пауза и тишина (как v2.7); без сцены pause — без заморозки (как раньше)', async () => {
  const e = makeEnv({ platform: true }), g = e.g; ok(g.platform, 'platform.js подключён'); await e.win.Platform.init(); playGame(e); await sleep(5); eq(g._sceneName, 'play');
  e.setHidden(true); eq(g._sceneName, 'pause', 'hidden → пауза'); e.setHidden(false); eq(g._sceneName, 'pause');
  g.goto('play', { resume: true }); e.ac.calls.length = 0; e.fireWin('blur'); eq(g._sceneName, 'pause', 'blur → пауза'); ok(e.ac.calls.includes('suspend'), 'blur → тишина'); ok(g.awayPaused); e.fireWin('focus');
  const n = makeEnv({ platform: true }), g2 = n.g; await n.win.Platform.init(); playGame(n, { pause: false }); await sleep(5);
  n.setHidden(true); eq(g2._sceneName, 'play'); ok(!g2._hiddenFreeze, 'на площадке поведение прежнее'); n.setHidden(false);
  const o = makeEnv({ platform: true, opts: { autoPause: false } }), g3 = o.g; await o.win.Platform.init(); playGame(o); await sleep(5);
  o.setHidden(true); eq(g3._sceneName, 'play', 'autoPause:false и на площадке'); o.fireWin('blur'); eq(g3._sceneName, 'play');
});

// ---------- касания ----------
test('Arcade.touchOk: preventDefault только у cancelable; эмуляция мыши ≤ 800 мс после касания — пропуск', () => {
  const e = makeEnv(), T = e.A.touchOk; ok(typeof T === 'function');
  let p = 0; const mk = (type, c) => ({ type, cancelable: c, preventDefault() { p++; } });
  ok(T(mk('touchstart', true))); eq(p, 1, 'отменяемое — отменено');
  ok(T(mk('touchstart', false))); eq(p, 1, 'неотменяемое — preventDefault не зовётся');
  eq(T(mk('mousedown')), false, 'mousedown сразу после касания — эмуляция'); eq(T(mk('click')), false); eq(T(mk('mouseup')), false);
  e.tick(900); ok(T(mk('mousedown')), 'мышь через 900 мс — настоящая');
  ok(T({ type: 'x' }) && T(null), 'прочие события');
  e.tick(10); e.fireWin('touchend'); eq(T(mk('mousedown')), false, 'касание в любом месте страницы (window, capture) — отметка');
});
test('тач-дпад: неотменяемое касание — нажатие есть, preventDefault нет; эмуляция мыши второго нажатия не даёт; data-arcade-touch', () => {
  const e = makeEnv(), g = e.g; playGame(e);
  const pad = el('div'), bA = el('button'), bL = el('button'); bA.dataset.d = 'A'; bL.dataset.d = 'L'; pad.children.push(bA, bL);
  const got = []; g.input.onPress((a) => got.push(a)); g.input.bindDpad(pad);
  ok(pad.hasAttribute('data-arcade-touch') && bA.hasAttribute('data-arcade-touch'), 'атрибуты touch-action');
  const s = bA.fire('touchstart', { cancelable: false }); ok(!s.prevented, 'preventDefault не вызван'); ok(g.input.pressed('action'));
  const en = bA.fire('touchend', { cancelable: true }); ok(en.prevented, 'отменяемое touchend — отменено'); ok(!g.input.pressed('action'));
  bA.fire('mousedown'); bA.fire('mouseup'); eq(got.filter((x) => x === 'action').length, 1, 'одно касание — одно нажатие');
  e.tick(1000); bL.fire('mousedown'); ok(g.input.pressed('left'), 'мышь — как раньше'); bL.fire('mouseup'); ok(!g.input.pressed('left'));
  const c = bL.fire('touchstart'); ok(c.prevented, 'отменяемое касание — отменяется как раньше'); bL.fire('touchend');
  const css = e.styles.map((s) => s.textContent).join(''); ok(/:where\(\[data-arcade-touch\]\)\{touch-action:none\}/.test(css), 'правило touch-action: ' + css);
});
test('холст: тап по меню — один выбор; неотменяемое касание + click-эмуляция — без второго выбора; холст с data-arcade-touch', () => {
  const e = makeEnv(), g = e.g; g.useStandardScreens({}); let sel = 0;
  g.scene('play', { update() {}, draw() {} }); g.start('title'); ok(e.canvas.hasAttribute('data-arcade-touch'));
  const m = g.current._menu; m.items[0].onSelect = () => sel++; m.pointer = () => true;
  const s = e.canvas.fire('touchstart', { cancelable: false }); ok(!s.prevented); eq(sel, 1);
  e.canvas.fire('click', { clientX: 5, clientY: 5 }); eq(sel, 1, 'click-эмуляция пропущена');
  e.tick(1000); e.canvas.fire('click', { clientX: 5, clientY: 5 }); eq(sel, 2, 'клик мышью — как раньше');
  const c = e.canvas.fire('touchstart'); ok(c.prevented, 'отменяемое касание по меню — отменено'); eq(sel, 3);
});
test('usePlayers: кнопка паузы [data-pause] — неотменяемое касание ставит паузу один раз (эмуляция mousedown не снимает её)', () => {
  const e = makeEnv(), g = e.g; const pad = el('div'), bp = el('button', { 'data-pause': '' }); pad.children.push(bp);
  g.useStandardScreens({}); g.usePlayers({ bind: { p1: { fire: ['Space'] }, p2: { fire: ['KeyF'] } }, pad }); g.scene('play', { update() {}, draw() {} }); g.start('play');
  ok(bp.hasAttribute('data-arcade-touch')); const s = bp.fire('touchstart', { cancelable: false }); ok(!s.prevented); eq(g._sceneName, 'pause');
  bp.fire('mousedown'); eq(g._sceneName, 'pause', 'эмуляция мыши не продолжила игру');
  e.tick(1000); bp.fire('mousedown'); eq(g._sceneName, 'play', 'мышь — как раньше');
});
test('версия движка 2.10.0', () => { eq(makeEnv().A.version, '2.10.0'); });

for (const [name, fn] of queue) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e)); } }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

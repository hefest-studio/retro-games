/* ПРИИСК · tests/audio.test.mjs — процедурные звуки мира (js/audio.js) в headless: движок в node:vm с фейковым AudioContext
   (как tests/music.test.mjs). Проверяет: до первого жеста и при выключенном звуке — тишина (контекст не создаётся);
   после жеста все звуки (гейзер с нарастанием и выброс, взрыв малый/большой, обломки, скрип и лязг клети, стук бура)
   создают узлы без ошибок; огибающие валидны (exponentialRamp > 0); пиковая громкость не выше 0.15 (в духе beep() движка
   0.07 и прежних звуков ПРИИСКА ≤ 0.12); троттлинг частых звуков; подключение в index.html и main.js.
   Запуск: node priisk/tests/audio.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, '..');
function makeEnv() {
  const listeners = {}, peaks = [], log = [];
  function param(v, kind) { return { value: v, setValueAtTime(x) { if (kind === 'gain') peaks.push(x); }, linearRampToValueAtTime(x) { if (kind === 'gain') peaks.push(x); },
    exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ramp ≤0'); if (kind === 'gain') peaks.push(x); }, setTargetAtTime() {} }; }
  function node(kind) { return { kind, connect() {}, disconnect() {}, start() { log.push(kind); }, stop() {}, frequency: param(440), detune: param(0), gain: param(1, 'gain'), Q: param(1), type: '', loop: false, buffer: null }; }
  class FakeAC {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; FakeAC.made++; }
    createOscillator() { return node('osc'); } createGain() { return node('gain'); }
    createBiquadFilter() { return node('filter'); } createBufferSource() { return node('noise'); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() {} suspend() {}
  }
  FakeAC.made = 0;
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt, Date,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    setInterval() { return 0; }, clearInterval() {}, setTimeout() { return 0; }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    performance: { now: () => 0 }, AudioContext: FakeAC };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  for (const f of ['engine.js', 'js/audio.js']) vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), win, { filename: f });
  const fire = ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault() {} }));
  return { win, FakeAC, peaks, log, fire };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const ALL = [['geyserRise', 3], ['geyser'], ['blast', true], ['blast', false], ['debris'], ['cageCreak'], ['cageClank'], ['rigKnock']];

test('до первого жеста — тишина: AudioContext не создаётся, звуки возвращают false', () => {
  const env = makeEnv(), g = env.win.Arcade.createGame({ canvas: '#c', gameId: 'priisk-audio-test' }), A = env.win.PRIISK.audio.install(g);
  ALL.forEach(([n, a]) => ok(A[n](a) === false, n));
  ok(env.FakeAC.made === 0 && A.stats.made === 0, 'контекст создан до жеста');
});
test('после жеста все звуки создаются без ошибок (гейзер, взрыв ×2, обломки, клеть ×2, бур), огибающие валидны', () => {
  const env = makeEnv(), g = env.win.Arcade.createGame({ canvas: '#c', gameId: 'priisk-audio-test' }), A = env.win.PRIISK.audio.install(g);
  env.fire('keydown');
  ALL.forEach(([n, a]) => ok(A[n](a) === true, n + ' не прозвучал'));
  ok(A.stats.made === ALL.length && A.stats.errors === 0, JSON.stringify(A.stats));
  ok(env.log.includes('noise') && env.log.includes('osc'), 'нет шума/осцилляторов');
  ok(env.FakeAC.made === 1, 'контекстов ' + env.FakeAC.made);
});
test('громкость согласована: пики огибающих ≤ 0.15 (beep движка — 0.07, прежние звуки ПРИИСКА ≤ 0.12)', () => {
  const env = makeEnv(), g = env.win.Arcade.createGame({ canvas: '#c', gameId: 'priisk-audio-test' }), A = env.win.PRIISK.audio.install(g);
  env.fire('keydown'); env.peaks.length = 0;
  ALL.forEach(([n, a]) => A[n](a));
  const env2 = env.peaks.filter(x => x !== 0.9); // 0.9 — общий узел master (масштаб, не огибающая)
  const mx = Math.max(...env2); ok(mx <= 0.15 && mx >= 0.04, 'пик ' + mx);
});
test('троттлинг: один и тот же звук подряд не накладывается (бур — не чаще 120 мс, гейзер-выброс — 350 мс)', () => {
  const env = makeEnv(), g = env.win.Arcade.createGame({ canvas: '#c', gameId: 'priisk-audio-test' }), A = env.win.PRIISK.audio.install(g);
  env.fire('keydown');
  ok(A.rigKnock() === true && A.rigKnock() === false, 'бур без паузы');
  ok(A.geyser() === true && A.geyser() === false, 'гейзер без паузы');
});
test('звук выключен (M) — тишина', () => {
  const env = makeEnv(), g = env.win.Arcade.createGame({ canvas: '#c', gameId: 'priisk-audio-test' }), A = env.win.PRIISK.audio.install(g);
  env.fire('keydown'); g.audio.enabled = false;
  ALL.forEach(([n, a]) => ok(A[n](a) === false, n));
});
test('подключение: index.html грузит js/audio.js до main.js; main.js вешает звуки на события geyser/blast/die/lift*/carFall и состояние мира', () => {
  const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8'), order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  ok(order.indexOf('js/audio.js') >= 0 && order.indexOf('js/audio.js') < order.indexOf('js/main.js'), order.join(','));
  const main = fs.readFileSync(path.join(GAME, 'js/main.js'), 'utf8');
  ['geyserRise', "'geyser'", "'blast'", "'debris'", "'cageCreak'", "'cageClank'", "'rigKnock'"].forEach(k => ok(main.includes(k), 'main.js: ' + k));
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

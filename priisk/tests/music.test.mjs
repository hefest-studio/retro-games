/* ПРИИСК · tests/music.test.mjs — музыка игры (js/music.js) по образцу _shared/tests/music.test.mjs: движок в node:vm
   с фейковым AudioContext. Три трека (меню / поле / бой): парсятся, 8–16 тактов, голоса кратны мелодии, ноты в диапазоне,
   за 10 с игры планируется >30 нот без ошибок; темпы различаются (меню медленнее поля, бой быстрее), треки разные.
   Arcade.tracks.priisk — основной (его же проверяет общий тест _shared). Переключение по сценам — в tests/browser.mjs.
   Запуск: node priisk/tests/music.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, '..');
function param(v) { return { value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ramp ≤0'); }, setTargetAtTime() {} }; }
function node(log, kind) { return { kind, connect() {}, disconnect() {}, start(t) { log.push({ kind, t, type: this.type }); }, stop() {}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
function makeEnv() {
  const listeners = {}, timers = [], log = [];
  class FakeAC {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
    createOscillator() { return node(log, 'osc'); } createGain() { return node(log, 'gain'); }
    createBiquadFilter() { return node(log, 'filter'); } createBufferSource() { return node(log, 'noise'); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() { this.state = 'running'; } suspend() { this.state = 'suspended'; }
  }
  const win = {
    console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval(id) { timers[id - 1] = null; },
    setTimeout() { return 0; }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    performance: { now: () => 0 }, AudioContext: FakeAC,
  };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(GAME, 'engine.js'), 'utf8'), win, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(GAME, 'js/music.js'), 'utf8'), win, { filename: 'music.js' });
  const fire = ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault() {} }));
  const tick = (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); };
  return { win, log, fire, tick };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

const NAMES = { menu: 'priisk-menu', field: 'priisk', battle: 'priisk-battle' };
test('три трека зарегистрированы: Arcade.tracks.priisk (поле), priisk-menu, priisk-battle; priiskTracks — те же объекты', () => {
  const A = makeEnv().win.Arcade;
  for (const [k, id] of Object.entries(NAMES)) { ok(A.tracks[id], 'нет ' + id); ok(A.priiskTracks[k] === A.tracks[id], 'priiskTracks.' + k); }
});
for (const [k, id] of Object.entries(NAMES)) test(`трек ${k}: парсится, 8–16 тактов, голоса кратны, ноты в диапазоне, >30 нот за 10 с без ошибок (обе темы)`, () => {
  for (const theme of ['modern', 'retro']) {
    const env = makeEnv(), A = env.win.Arcade, t = A.tracks[id], c = A.parseTrack(t);
    const bars = c.melody.length / (c.div * 4); ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тактов ' + bars);
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'голоса не кратны');
    [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, 'нота вне диапазона ' + e.f));
    const g = A.createGame({ canvas: '#c', gameId: 'priisk', music: t }); g.setTheme(theme); g.useStandardScreens(); g.scene('play', {});
    env.fire('keydown'); g.goto('play'); for (let i = 0; i < 200; i++) env.tick(g.audio.ac, 0.05);
    ok(g.audio.music.stats.scheduled > 30 && g.audio.music.stats.errors === 0, JSON.stringify(g.audio.music.stats));
  }
});
test('характер: меню медленнее поля, бой быстрее поля; мелодии всех трёх разные; лад — с минорной терцией от тоники баса', () => {
  const A = makeEnv().win.Arcade, T = A.priiskTracks;
  ok(T.menu.bpm < T.field.bpm && T.battle.bpm > T.field.bpm, 'темпы ' + [T.menu.bpm, T.field.bpm, T.battle.bpm]);
  const mel = t => [].concat(t.melody).join(' ');
  ok(new Set([mel(T.menu), mel(T.field), mel(T.battle)]).size === 3, 'одинаковые мелодии');
  for (const t of [T.menu, T.field, T.battle]) {
    const tonic = t.bass.trim().split(/\s+/)[0].replace(/-?\d$/, ''), IX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const pc = n => (IX[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0) + 12) % 12, root = pc(tonic);
    const notes = mel(t).split(/\s+/).filter(x => /^[A-G]/.test(x)).map(x => (pc(x) - root + 12) % 12);
    ok(notes.includes(3) && !notes.includes(4), 'не минор: ' + tonic);
  }
});
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);

/* _shared/tests/music.test.mjs — тесты музыкального секвенсора engine.js (Node, без зависимостей).
   Движок грузится в node:vm с фейковыми window/AudioContext; проверяются нотация, жизненный цикл
   по сценам (play/pause/stop), политика автоплея (до жеста — тишина), mute, тембры тем
   и треки всех игр на v2 (js/music.js). Запуск: node _shared/tests/music.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const GAMES = ['kaskad', 'hrum', 'bolt', 'kolobok', 'plashch', 'roy', 'razrez', 'redut', 'zvero-otryad', 'zvero-otryad-2', 'krot', 'ruslo', 'staratel', 'podkop', 'kladka', 'zaslon', 'fitil', 'katakomby', 'yuz', 'puzyr', 'pereprava', 'zastava', 'sputnik', 'eskadrilya', 'nalyot', 'glub', 'taynik', 'zheoda', 'udalets', 'ugolyok', 'grom', 'druzhina', 'chertog', 'dozor', 'rikoshet', 'liven', 'oruzheynik', 'shustrik', 'podryad', 'dospeh', 'lednik', 'gornilo', 'tsep', 'ten', 'skok', 'posokh', 'chaynik', 'list'];

function param(v) { return { value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ramp ≤0'); }, setTargetAtTime() {} }; }
function node(log, kind) { return { kind, connect() {}, disconnect() {}, start(t) { log.push({ kind, t, type: this.type }); }, stop() {}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
function makeEnv() {
  const listeners = {}, timers = [];
  const log = [];
  class FakeAC {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; FakeAC.made++; }
    createOscillator() { return node(log, 'osc'); } createGain() { return node(log, 'gain'); }
    createBiquadFilter() { return node(log, 'filter'); } createBufferSource() { return node(log, 'noise'); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() { this.state = 'running'; } suspend() { this.state = 'suspended'; }
  }
  FakeAC.made = 0;
  const win = {
    console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval(id) { timers[id - 1] = null; },
    setTimeout(fn) { return 0; }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    performance: { now: () => 0 }, AudioContext: FakeAC,
  };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8'), win, { filename: 'engine.js' });
  const fire = (ev) => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault() {} }));
  const tick = (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); };
  return { win, log, fire, tick, FakeAC, activeTimers: () => timers.filter(Boolean).length };
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function near(a, b, m) { if (Math.abs(a - b) > 0.01) throw new Error((m || '') + ` ждали ${b}, получили ${a}`); }

const TRACK = { bpm: 120, div: 2, melody: 'A4 - . C5 | E5 . . .', bass: 'A2 . E2 .', drums: 'k h s kh' };

test('noteFreq: A4=440, C4≈261.63, Bb3=A#3, E#4=F4', () => {
  const { win } = makeEnv(); const A = win.Arcade;
  near(A.noteFreq('A4'), 440); near(A.noteFreq('C4'), 261.63); near(A.noteFreq('Bb3'), A.noteFreq('A#3')); near(A.noteFreq('E#4'), A.noteFreq('F4'));
});
test('parseTrack: «-» тянет ноту, «.» пауза, «|» игнор, ударные', () => {
  const { win } = makeEnv(); const c = win.Arcade.parseTrack(TRACK);
  ok(c.melody.length === 8, 'шагов мелодии ' + c.melody.length); ok(c.melody[0].len === 2, 'длительность A4');
  ok(c.melody[1] === null && c.melody[2] === null, 'тянется/пауза'); ok(c.drums[3].hit === 'kh', 'комбо-удар'); ok(c.steps === 8);
});
test('parseTrack: неизвестная нота — понятная ошибка', () => {
  const { win } = makeEnv(); let err = '';
  try { win.Arcade.parseTrack({ melody: 'H9' }); } catch (e) { err = e.message; } ok(/H9/.test(err), err);
});
test('автоплей: до жеста AudioContext не создаётся и нот нет', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK });
  g.useStandardScreens(); g.scene('play', {}); g.goto('title'); g.audio.beep(440, .1); g.goto('play');
  ok(env.FakeAC.made === 0, 'контекст создан до жеста'); ok(g.audio.music.stats.scheduled === 0);
});
test('жест → музыка в play стартует, ноты планируются', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK });
  g.useStandardScreens(); g.scene('play', {}); g.goto('play'); env.fire('keydown');
  ok(env.FakeAC.made === 1, 'контекст не создан'); const ac = g.audio.ac;
  for (let i = 0; i < 40; i++) env.tick(ac, 0.05);
  const st = g.audio.music.stats; ok(st.scheduled > 10, 'нот ' + st.scheduled); ok(st.errors === 0, 'ошибок ' + st.errors);
});
test('пауза держит позицию, resume продолжает; title/gameover — стоп и сброс', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK });
  g.useStandardScreens(); g.scene('play', {}); env.fire('pointerdown'); g.goto('play'); const ac = g.audio.ac, m = g.audio.music;
  for (let i = 0; i < 10; i++) env.tick(ac, 0.05);
  g.pause(); ok(!m.playing, 'играет в паузе'); const st = m.step, n = m.stats.scheduled;
  for (let i = 0; i < 10; i++) env.tick(ac, 0.05); ok(m.stats.scheduled === n, 'планирует в паузе');
  g.goto('play', { resume: true }); ok(m.playing && m.step > 0 && m.step <= st + 4, `resume не с того места: было ${st}, стало ${m.step}`);
  g.gameover(); ok(!m.playing && m.step === 0, 'gameover не остановил'); ok(env.activeTimers() === 0, 'таймер не снят');
  g.goto('play'); ok(m.playing); g.goto('title'); ok(!m.playing); g.win(); ok(!m.playing);
});
test('mute (M) глушит музыку и возвращает её в игре', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK });
  g.useStandardScreens(); g.scene('play', {}); env.fire('keydown'); g.goto('play'); const m = g.audio.music;
  g.audio.toggle(); ok(!m.playing, 'играет при mute'); g.audio.toggle(); ok(m.playing, 'не вернулась');
  g.audio.toggle(); g.goto('play'); ok(!m.playing, 'mute игнорируется при старте'); g.audio.toggle();
});
test('тембр по теме: retro — square/triangle, modern — фильтр+sine', () => {
  for (const theme of ['retro', 'modern']) {
    const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK }); g.setTheme(theme);
    g.useStandardScreens(); g.scene('play', {}); env.fire('keydown'); g.goto('play');
    for (let i = 0; i < 20; i++) env.tick(g.audio.ac, 0.05);
    const types = new Set(env.log.filter(e => e.kind === 'osc').map(e => e.type));
    if (theme === 'retro') ok(types.has('square') && types.has('triangle') && !types.has('sine'), [...types].join(','));
    else ok(types.has('sine') && !types.has('square'), [...types].join(','));
  }
});
test('совместимость v2.0: registerMusic(theme, null) и g.playMusic() без трека — тихо', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't' });
  g.audio.registerMusic('retro', null); g.audio.registerMusic('modern', null); env.fire('keydown');
  g.playMusic(); g.stopMusic(); ok(!g.audio.music.playing);
});
test('совместимость v2.0: legacy-плеер {start,stop} по теме', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't' }); let s = 0, e = 0;
  g.audio.registerMusic('modern', { start() { s++; }, stop() { e++; } }); env.fire('keydown');
  g.playMusic(); g.stopMusic(); ok(s === 1 && e === 1, `start ${s} stop ${e}`);
});
test('registerMusic(theme, track) — свой трек под тему', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK });
  const R = { bpm: 90, melody: 'C4' }; g.audio.registerMusic('retro', R);
  g.setTheme('modern'); ok(g.audio.music.current().src === TRACK); g.setTheme('retro'); ok(g.audio.music.current().src === R);
});
test('musicAuto:false — движок не трогает музыку по сценам', () => {
  const env = makeEnv(); const g = env.win.Arcade.createGame({ canvas: '#c', gameId: 't', music: TRACK, musicAuto: false });
  g.useStandardScreens(); g.scene('play', {}); env.fire('keydown'); g.goto('play'); ok(!g.audio.music.playing);
  g.playMusic(); ok(g.audio.music.playing); g.stopMusic(); ok(!g.audio.music.playing);
});
for (const slug of GAMES) {
  test(`трек ${slug}: js/music.js парсится, 8–16 тактов, ноты в диапазоне, играет без ошибок`, () => {
    const env = makeEnv(); const A = env.win.Arcade;
    vm.runInContext(fs.readFileSync(path.join(ROOT, slug, 'js/music.js'), 'utf8'), env.win, { filename: slug + '/music.js' });
    const t = A.tracks[slug]; ok(t, 'нет Arcade.tracks.' + slug);
    const c = A.parseTrack(t), perBar = c.div * 4 === 12 ? 6 : c.div * 4; // 6/8 при div 3
    const bars = c.melody.length / perBar; ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тактов мелодии ' + bars);
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'голоса не кратны мелодии');
    [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, 'нота вне диапазона ' + e.f));
    const g = A.createGame({ canvas: '#c', gameId: slug }); g.useStandardScreens(); g.scene('play', {});
    env.fire('keydown'); g.goto('play'); for (let i = 0; i < 200; i++) env.tick(g.audio.ac, 0.05);
    ok(g.audio.music.stats.scheduled > 30 && g.audio.music.stats.errors === 0, JSON.stringify(g.audio.music.stats));
  });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

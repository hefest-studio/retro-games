#!/usr/bin/env node
/**
 * saga-2 · tools/audio-test.mjs
 * Офлайн-тест SAGA2.audio с заглушкой AudioContext (Node, без npm).
 *
 * Проверяет: поверхность API, все имена SFX, безопасность вызовов до unlock,
 * идемпотентность playMusic, all-треки, mute/volume, pause/resume, stop и
 * отсутствие утечек таймеров, валидность нотных данных (8-16 тактов, BPM,
 * корректные частоты/гейны, детерминизм).
 *
 * Запуск: node tools/audio-test.mjs   (код 0 = всё зелёное)
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8');

/* ------------------------------------------------------------------ */
/* мини-фреймворк                                                      */
/* ------------------------------------------------------------------ */
let checks = 0;
let failures = 0;
function check(name, cond, extra) {
  checks++;
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failures++;
    console.error('  FAIL ' + name + (extra === undefined ? '' : ' :: ' + extra));
  }
}
function section(title) {
  console.log('\n== ' + title + ' ==');
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* ------------------------------------------------------------------ */
/* заглушка WebAudio                                                   */
/* ------------------------------------------------------------------ */
class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.calls = [];
  }
  _set(v, kind) {
    if (typeof v !== 'number' || Number.isNaN(v)) throw new Error('Param: не число (' + v + ')');
    this.value = v;
    this.calls.push([kind, v]);
    return this;
  }
  setValueAtTime(v) { return this._set(v, 'set'); }
  linearRampToValueAtTime(v) { return this._set(v, 'linear'); }
  exponentialRampToValueAtTime(v) {
    if (!(v > 0)) throw new Error('exponentialRampToValueAtTime: цель должна быть > 0, получено ' + v);
    return this._set(v, 'exp');
  }
  setTargetAtTime(v) { return this._set(v, 'target'); }
  cancelScheduledValues() { return this; }
  setValueCurveAtTime() { return this; }
}

let nodeSerial = 0;
class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.id = ++nodeSerial;
    this.outputs = [];
    this.disconnected = false;
    ctx.nodes.push(this);
  }
  connect(dest) {
    if (!dest) throw new Error('connect: пустой destination');
    this.outputs.push(dest);
    return dest;
  }
  disconnect() {
    this.outputs.length = 0;
    this.disconnected = true;
  }
}

class FakeGain extends FakeNode {
  constructor(ctx) { super(ctx, 'gain'); this.gain = new FakeParam(1); }
}
class FakeOscillator extends FakeNode {
  constructor(ctx) {
    super(ctx, 'oscillator');
    this.type = 'sine';
    this.frequency = new FakeParam(440);
    this.detune = new FakeParam(0);
    this.onended = null;
    this.startedAt = null;
    this.stoppedAt = null;
    this.wave = null;
  }
  setPeriodicWave(w) { this.wave = w; }
  start(t) { this.startedAt = t; this.ctx.started++; }
  stop(t) { this.stoppedAt = t; this.ctx.stopped++; }
}
class FakeBufferSource extends FakeNode {
  constructor(ctx) {
    super(ctx, 'bufferSource');
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new FakeParam(1);
    this.onended = null;
    this.startedAt = null;
    this.stoppedAt = null;
  }
  start(t) { this.startedAt = t; this.ctx.started++; }
  stop(t) { this.stoppedAt = t; this.ctx.stopped++; }
}
class FakeBiquadFilter extends FakeNode {
  constructor(ctx) {
    super(ctx, 'biquad');
    this.type = 'lowpass';
    this.frequency = new FakeParam(350);
    this.Q = new FakeParam(1);
    this.gain = new FakeParam(0);
  }
}
class FakeWaveShaper extends FakeNode {
  constructor(ctx) {
    super(ctx, 'waveshaper');
    this.curve = null;
    this.oversample = 'none';
  }
}
class FakeCompressor extends FakeNode {
  constructor(ctx) {
    super(ctx, 'compressor');
    this.threshold = new FakeParam(-24);
    this.knee = new FakeParam(30);
    this.ratio = new FakeParam(12);
    this.attack = new FakeParam(0.003);
    this.release = new FakeParam(0.25);
  }
}
class FakeBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._data = [];
    for (let i = 0; i < channels; i++) this._data.push(new Float32Array(length));
  }
  getChannelData(i) { return this._data[i]; }
}
class FakeAudioContext {
  constructor() {
    FakeAudioContext.instances.push(this);
    this.state = 'suspended';
    this.sampleRate = 44100;
    this._time = 0;
    this.nodes = [];
    this.waves = [];
    this.started = 0;
    this.stopped = 0;
    this.destination = new FakeNode(this, 'destination');
  }
  get currentTime() { return this._time; }
  advance(dt) { this._time += dt; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { return new FakeGain(this); }
  createOscillator() { return new FakeOscillator(this); }
  createBufferSource() { return new FakeBufferSource(this); }
  createBiquadFilter() { return new FakeBiquadFilter(this); }
  createDynamicsCompressor() { return new FakeCompressor(this); }
  createWaveShaper() { return new FakeWaveShaper(this); }
  createBuffer(ch, len, rate) { return new FakeBuffer(ch, len, rate); }
  createPeriodicWave(real, imag, opts) {
    const w = { real, imag, opts, kind: 'periodic' };
    this.waves.push(w);
    return w;
  }
}
FakeAudioContext.instances = [];

/* ------------------------------------------------------------------ */
/* таймеры с учётом утечек                                             */
/* ------------------------------------------------------------------ */
const timers = new Map();
let nextTimerId = 1000;
function fakeSetInterval(fn, ms) {
  const id = nextTimerId++;
  const real = setInterval(fn, ms);
  timers.set(id, { real, kind: 'interval', ms });
  return id;
}
function fakeClearInterval(id) {
  const t = timers.get(id);
  if (t) { clearInterval(t.real); timers.delete(id); }
}
function fakeSetTimeout(fn, ms) {
  const id = nextTimerId++;
  const real = setTimeout(() => {
    timers.delete(id);
    try { fn(); } catch (e) { console.error('  !! таймер упал:', e && e.message); }
  }, ms);
  timers.set(id, { real, kind: 'timeout', ms });
  return id;
}
function fakeClearTimeout(id) {
  const t = timers.get(id);
  if (t) { clearTimeout(t.real); timers.delete(id); }
}
function countIntervals() {
  let n = 0;
  for (const t of timers.values()) if (t.kind === 'interval') n++;
  return n;
}
function countTimeouts() {
  let n = 0;
  for (const t of timers.values()) if (t.kind === 'timeout') n++;
  return n;
}

/* ------------------------------------------------------------------ */
/* загрузка модуля в vm-песочнице (как классический скрипт)            */
/* ------------------------------------------------------------------ */
const windowObj = { AudioContext: FakeAudioContext, SAGA2: {} };
const sandbox = {
  window: windowObj,
  console,
  setInterval: fakeSetInterval,
  clearInterval: fakeClearInterval,
  setTimeout: fakeSetTimeout,
  clearTimeout: fakeClearTimeout
};
try {
  vm.runInNewContext(CODE, sandbox, { filename: 'js/audio.js' });
} catch (e) {
  console.error('FATAL: audio.js не загрузился:', e && e.stack);
  process.exit(1);
}
const audio = windowObj.SAGA2 && windowObj.SAGA2.audio;
const deb = audio && audio._debug;

/* ------------------------------------------------------------------ */
/* 1. API                                                              */
/* ------------------------------------------------------------------ */
section('1. API поверхности');
check('SAGA2.audio создан', !!audio);
if (!audio) process.exit(1);
const api = [
  'unlock', 'isReady', 'playMusic', 'stopMusic', 'pauseMusic', 'resumeMusic',
  'sfx', 'setMuted', 'toggleMuted', 'getMuted', 'setVolume'
];
for (const fn of api) check('SAGA2.audio.' + fn + ' — функция', typeof audio[fn] === 'function');
check('в глобальном неймспейсе только SAGA2.audio',
  Object.keys(windowObj.SAGA2).length === 1 && windowObj.SAGA2.audio === audio,
  Object.keys(windowObj.SAGA2).join(','));

const CONTRACT_SFX = [
  'jump', 'land', 'step', 'switch', 'headbutt', 'break', 'sword', 'bow',
  'arrowHit', 'hookShoot', 'hookHit', 'hookDetach', 'lever', 'plateOn',
  'plateOff', 'doorOpen', 'doorClose', 'rune', 'checkpoint', 'hurt', 'death',
  'respawn', 'block', 'enemyHit', 'enemyDie', 'exit', 'lava', 'win', 'lose'
];
const UI_SFX = ['uiMove', 'uiClick', 'uiBack'];
const sfxNames = deb.getSfxNames();
for (const name of CONTRACT_SFX.concat(UI_SFX)) {
  check('SFX "' + name + '" объявлен', sfxNames.indexOf(name) !== -1);
}
check('всего SFX: ' + (CONTRACT_SFX.length + UI_SFX.length),
  sfxNames.length === CONTRACT_SFX.length + UI_SFX.length, sfxNames.length);

/* ------------------------------------------------------------------ */
/* 2. Вызовы до unlock                                                 */
/* ------------------------------------------------------------------ */
section('2. Безопасность до unlock');
check('isReady() до unlock = false', audio.isReady() === false);
let preUnlockThrew = null;
try {
  audio.playMusic('title');
  audio.playMusic('none');
  audio.sfx('jump');
  audio.sfx('uiClick');
  audio.sfx('несуществующий');
  audio.setVolume(0.5);
  audio.setMuted(true);
  audio.setMuted(false);
  audio.pauseMusic();
  audio.resumeMusic();
  audio.stopMusic();
  audio.stopMusic(0.2);
} catch (e) {
  preUnlockThrew = e;
}
check('все вызовы до unlock без исключений', !preUnlockThrew, preUnlockThrew && preUnlockThrew.message);
check('sfx до unlock = false', audio.sfx('jump') === false);
check('getVolume после setVolume(0.5) = 0.5', audio.getVolume() === 0.5);
audio.setVolume(0.8);
check('volume восстановлен', audio.getVolume() === 0.8);
check('SFX-список непустой', sfxNames.length > 0);
check('после stopMusic до unlock трек = null', audio.getCurrentMusic() === null);

// pending: playMusic до unlock должен стартовать после unlock
audio.playMusic('title');
check('pending-трек запомнен', audio.getCurrentMusic() === 'title');
const unlock1 = audio.unlock();
check('unlock() вернул true', unlock1 === true);
check('после unlock pending-трек заиграл', deb.getMusicId() === 'title');
check('after unlock isReady() = true', audio.isReady() === true);
check('состояние контекста running', deb.getContextState() === 'running');
check('создан ровно один AudioContext', FakeAudioContext.instances.length === 1);
audio.unlock();
check('повторный unlock идемпотентен', FakeAudioContext.instances.length === 1);
check('планировщик запущен без утечки (1 интервал)', countIntervals() === 1);
audio.stopMusic(0.05);
check('stopMusic снял планировщик', countIntervals() === 0);
check('stopMusic обнулил трек', deb.getMusicId() === null);

const ctx = FakeAudioContext.instances[0];

/* ------------------------------------------------------------------ */
/* 3. Все SFX                                                          */
/* ------------------------------------------------------------------ */
section('3. SFX: все имена синтезируются');
const startedBeforeSfx = ctx.started;
let badSfx = [];
for (const name of sfxNames) {
  let okSfx = false;
  try { okSfx = audio.sfx(name); } catch (e) { okSfx = false; }
  if (okSfx !== true) badSfx.push(name);
}
check('все ' + sfxNames.length + ' SFX вернули true', badSfx.length === 0, badSfx.join(','));
check('SFX создали звуковые источники', ctx.started > startedBeforeSfx);
check('неизвестный SFX = false', audio.sfx('nope') === false);
check('sfx(undefined) = false', audio.sfx() === false);

/* ------------------------------------------------------------------ */
/* 4. Музыка: планирование и идемпотентность                           */
/* ------------------------------------------------------------------ */
section('4. Музыка: планировщик и идемпотентность');
check('playMusic("title") = true', audio.playMusic('title') === true);
check('трек title активен', deb.getMusicId() === 'title');
check('планировщик запущен', deb.isSchedulerRunning() === true);
check('один интервал планировщика', countIntervals() === 1);

await sleep(90); // даём реальному setInterval сработать
check('реальный тик запланировал ноты', ctx.started > startedBeforeSfx);
const plannedAfterRealTick = ctx.started;
for (let i = 0; i < 30; i++) {
  ctx.advance(0.1);
  deb.tickNow();
}
check('ноты планируются дальше по времени', ctx.started > plannedAfterRealTick, ctx.started);
check('ошибок планировщика нет', deb.getSchedulerErrors() === 0, deb.getSchedulerErrors());
const stepBeforeRepeat = deb.getMusicStep();
const intervalsBeforeRepeat = countIntervals();
audio.playMusic('title');
audio.playMusic('title');
await sleep(60);
check('повторный playMusic не запускает второй таймер', countIntervals() === intervalsBeforeRepeat);
check('повторный playMusic не сбрасывает позицию', deb.getMusicStep() >= stepBeforeRepeat,
  stepBeforeRepeat + ' -> ' + deb.getMusicStep());

const shapers = ctx.nodes.filter((n) => n.kind === 'waveshaper');
check('мастер-лимитер установлен', shapers.length >= 1, shapers.length);
if (shapers.length) {
  const curve = shapers[0].curve;
  let mono = true, inRange = true;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i] < curve[i - 1]) mono = false;
    if (Math.abs(curve[i]) > 0.99) inRange = false;
  }
  check('кривая лимитера монотонная', mono);
  check('кривая лимитера не выходит за 0.99', inRange);
  check('кривая лимитера прозрачна в середине',
    Math.abs(curve[Math.floor(curve.length / 2)]) < 0.002,
    curve[Math.floor(curve.length / 2)]);
}
// Fade при смене трека: только плавные рампы, без мгновенного нуля.
const fadeLog = deb.getFadeLog();
const fadeStart = fadeLog.filter((f) => f.kind === 'start').pop();
check('fade-in нового трека: 0.0001 -> trim за 0.5 с',
  !!fadeStart && fadeStart.from === 0.0001 && fadeStart.to === 1 && fadeStart.fade === 0.5,
  JSON.stringify(fadeStart));
audio.stopMusic(0.3);
const fadeStop = deb.getFadeLog().filter((f) => f.kind === 'stop').pop();
check('fade-out: плавная рампа до 0.0001 за 0.3 с, не в нуль',
  !!fadeStop && fadeStop.to === 0.0001 && fadeStop.fade === 0.3 && fadeStop.from > 0.0001,
  JSON.stringify(fadeStop));
check('stopMusic не ставит gain в 0 мгновенно',
  deb.getFadeLog().every((f) => f.kind !== 'stop' || f.to > 0));
audio.playMusic('title');

const badFreq = ctx.nodes.filter((n) => n.kind === 'oscillator')
  .filter((n) => !(isFinite(n.frequency.value) && n.frequency.value > 0));
check('все частоты осцилляторов > 0 и конечны', badFreq.length === 0, badFreq.length);
const badParams = ctx.nodes.filter((n) => n.gain).filter((n) => {
  const v = n.gain.value;
  return !(typeof v === 'number' && isFinite(v) && v >= 0);
});
check('громкости неотрицательны и конечны', badParams.length === 0, badParams.length);

/* ------------------------------------------------------------------ */
/* 5. Все треки + none                                                 */
/* ------------------------------------------------------------------ */
section('5. Все треки и "none"');
for (const id of ['game0', 'game1', 'game2', 'ending']) {
  const ok = audio.playMusic(id);
  check('playMusic("' + id + '") = true', ok === true);
  check('трек ' + id + ' активен', deb.getMusicId() === id);
  check('планировщик для ' + id + ' один', countIntervals() === 1);
  ctx.advance(0.6);
  deb.tickNow();
  check('трек ' + id + ' планирует ноты без ошибок', deb.getSchedulerErrors() === 0, deb.getSchedulerErrors());
}
const noneOk = audio.playMusic('none');
check('playMusic("none") = true', noneOk === true);
check('"none" остановил музыку', deb.getMusicId() === null);
check('"none" снял планировщик', countIntervals() === 0);
check('неизвестный трек = false', audio.playMusic('nope') === false);
check('playMusic(null) = true и стоп', audio.playMusic(null) === true && deb.getMusicId() === null);

/* ------------------------------------------------------------------ */
/* 6. Mute / volume                                                    */
/* ------------------------------------------------------------------ */
section('6. Mute и громкость');
audio.setMuted(false);
audio.setVolume(0.8);
audio.playMusic('game0');
ctx.advance(0.3);
deb.tickNow();
audio.setMuted(true);
check('getMuted() = true', audio.getMuted() === true);
check('мастер-гейн = 0 при mute', deb.getMasterGain() === 0, deb.getMasterGain());
const sourcesAtMute = ctx.started;
check('sfx при mute не создаёт узлов и возвращает false', audio.sfx('sword') === false && ctx.started === sourcesAtMute);
check('mute не останавливает музыку', deb.getMusicId() === 'game0' && deb.isSchedulerRunning() === true);
check('mute не останавливает планировщик', countIntervals() === 1);
audio.setVolume(0.5);
check('смена громкости при mute не поднимает звук', deb.getMasterGain() === 0);
audio.setMuted(false);
check('unmute восстанавливает громкость 0.5', deb.getMasterGain() === 0.5, deb.getMasterGain());
check('toggleMuted() -> true', audio.toggleMuted() === true && audio.getMuted() === true);
check('toggleMuted() -> false', audio.toggleMuted() === false && audio.getMuted() === false);
check('setVolume(2) клампится в 1', audio.setVolume(2) === 1);
check('setVolume(-1) клампится в 0', audio.setVolume(-1) === 0);
check('setVolume(NaN) игнорируется', audio.setVolume(NaN) === 0);
audio.setVolume(0.8);
check('громкость 0.8 применена к мастеру', deb.getMasterGain() === 0.8, deb.getMasterGain());

/* ------------------------------------------------------------------ */
/* 7. Pause / resume                                                   */
/* ------------------------------------------------------------------ */
section('7. Пауза и resume');
audio.pauseMusic();
check('пауза приглушает музыкальную шину', deb.getMusicBusGain() === 0.18, deb.getMusicBusGain());
check('пауза не убивает трек', deb.getMusicId() === 'game0');
check('пауза не снимает планировщик', deb.isSchedulerRunning() === true && countIntervals() === 1);
audio.resumeMusic();
check('resume возвращает громкость шины 1', deb.getMusicBusGain() === 1, deb.getMusicBusGain());
audio.resumeMusic();
check('повторный resume безопасен', deb.getMusicBusGain() === 1);
// страховка: смена трека после паузы не оставляет музыку приглушённой
audio.pauseMusic();
audio.playMusic('game2');
check('playMusic после паузы снимает duck', deb.getMusicBusGain() === 1, deb.getMusicBusGain());
audio.pauseMusic();
audio.resumeMusic();

/* ------------------------------------------------------------------ */
/* 8. Stop и очистка                                                   */
/* ------------------------------------------------------------------ */
section('8. Stop и отсутствие утечек');
audio.stopMusic(0.25);
check('stopMusic очистил трек', deb.getMusicId() === null);
check('stopMusic снял интервал', countIntervals() === 0);
check('stopMusic снял isSchedulerRunning', deb.isSchedulerRunning() === false);
let cycles = true;
for (let i = 0; i < 8; i++) {
  try {
    audio.playMusic(i % 2 ? 'game1' : 'game2');
    ctx.advance(0.4);
    deb.tickNow();
    audio.stopMusic(0.03);
  } catch (e) {
    cycles = false;
  }
}
check('8 циклов start/stop без исключений', cycles);
check('после циклов нет интервалов', countIntervals() === 0);
check('после циклов трек null', deb.getMusicId() === null);
check('stopMusic без музыки безопасен', (() => { try { audio.stopMusic(); return true; } catch (e) { return false; } })());
check('ошибок планировщика за весь прогон нет', deb.getSchedulerErrors() === 0, deb.getSchedulerErrors());

/* ------------------------------------------------------------------ */
/* 9. Валидность нотных данных                                         */
/* ------------------------------------------------------------------ */
section('9. Данные треков');
const v1 = deb.validateTracks();
check('нет ошибок компиляции треков', v1.errors.length === 0, v1.errors.join('; '));
check('нет отложенных ошибок компиляции', deb.getCompileErrors().length === 0, deb.getCompileErrors().join('; '));
check('скомпилировано 5 треков', v1.tracks.length === 5, v1.tracks.length);
const expectedBpm = { title: 90, game0: 132, game1: 140, game2: 120, ending: 100 };
for (const tr of v1.tracks) {
  check('BPM ' + tr.id + ' = ' + expectedBpm[tr.id], tr.bpm === expectedBpm[tr.id], tr.bpm);
  check('тактов у ' + tr.id + ': ' + tr.bars + ' (8 или 16)', tr.bars === 8 || tr.bars === 16);
  check('ноты ' + tr.id + ' > 24', tr.noteCount > 24, tr.noteCount);
  const minDrums = tr.id === 'title' ? 8 : 20;
  check('барабаны ' + tr.id + ' >= ' + minDrums, tr.drumEvents >= minDrums, tr.drumEvents);
  check('диапазон нот ' + tr.id + ' в MIDI 24..100', tr.minMidi >= 24 && tr.maxMidi <= 100,
    tr.minMidi + '..' + tr.maxMidi);
}
const byId = Object.fromEntries(v1.tracks.map((t) => [t.id, t]));
check('title: 8 тактов, пэд и «ветер»', byId.title.bars === 8 && byId.title.hasPad && byId.title.hasWind);
check('ending: 8 тактов и пэд', byId.ending.bars === 8 && byId.ending.hasPad);
check('game0/game1/game2: по 16 тактов',
  !!byId.game0 && !!byId.game1 && !!byId.game2 &&
  byId.game0.bars === 16 && byId.game1.bars === 16 && byId.game2.bars === 16);
const v2 = deb.validateTracks();
check('данные детерминированы (повторный разбор совпал)',
  JSON.stringify(v1.tracks) === JSON.stringify(v2.tracks));
check('id треков полный набор',
  deb.getTrackIds().sort().join(',') === 'ending,game0,game1,game2,title',
  deb.getTrackIds().sort().join(','));

/* ------------------------------------------------------------------ */
/* 10. Финальная уборка                                                */
/* ------------------------------------------------------------------ */
section('10. Финальная уборка');
audio.stopMusic(0.02);
audio.setMuted(false);
audio.setVolume(0.8);
check('музыка остановлена', deb.getMusicId() === null && countIntervals() === 0);
await sleep(900); // release-таймеры должны отработать сами
check('все cleanup-таймеры отработали', countTimeouts() === 0, countTimeouts());
check('интервалов не осталось', countIntervals() === 0);
check('schedulerErrors = 0', deb.getSchedulerErrors() === 0, deb.getSchedulerErrors());

/* ------------------------------------------------------------------ */
console.log('\n' + (failures === 0
  ? 'OK: ' + checks + ' проверок, всё зелёное'
  : 'FAILED: ' + failures + ' из ' + checks + ' проверок'));
process.exit(failures === 0 ? 0 : 1);

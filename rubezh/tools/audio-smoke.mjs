#!/usr/bin/env node
/**
 * audio-smoke.mjs — dependency-free smoke test for rubezh/src/audio.js
 *
 * Загружает движок через vm в поддельный window с mock AudioContext,
 * прогоняет весь публичный API и проверяет:
 *   - отсутствие исключений до/после unlock, с мусорными аргументами;
 *   - автозапуск отложенного трека после unlock;
 *   - идемпотентность startMusic, переключение треков, затухание и очистку таймеров;
 *   - mute/unmute (с сохранением трека), громкость и клампы;
 *   - все SFX, visibilitychange (suspend/resume);
 *   - отсутствие предупреждений компилятора партитуры (длины паттернов);
 *   - деградацию без AudioContext и работу через webkitAudioContext;
 *   - отсутствие запрещённых подстрок (закрывающий тег, URL, модульный синтаксис).
 *
 * Запуск: node tools/audio-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, '../src/audio.js'), 'utf8');

/* ------------------------------------------------------------------ */
/* Mock WebAudio                                                       */
/* ------------------------------------------------------------------ */
class Param {
  constructor(value) {
    this.value = value;
    this.events = 0;
  }
  setValueAtTime(v) { this.value = v; this.events++; return this; }
  linearRampToValueAtTime(v) { this.value = v; this.events++; return this; }
  exponentialRampToValueAtTime(v) {
    assert.ok(v > 0, 'exponentialRampToValueAtTime target must be > 0, got ' + v);
    this.value = v;
    this.events++;
    return this;
  }
  cancelScheduledValues() { this.events++; return this; }
  setTargetAtTime(v) { this.value = v; this.events++; return this; }
}

function node(extra) {
  return Object.assign({
    _connected: null,
    _disconnected: false,
    connect(dest) { this._connected = dest; return dest; },
    disconnect() { this._disconnected = true; this._connected = null; }
  }, extra);
}

function makeStats() {
  return { ac: 0, osc: 0, gain: 0, buffer: 0, src: 0, filt: 0, comp: 0, shaper: 0, delay: 0, panner: 0, wave: 0, starts: 0 };
}

function makeAudioContextClass(stats) {
  return class MockAudioContext {
    constructor() {
      stats.ac++;
      this.state = 'suspended';
      this.sampleRate = 48000;
      this._t0 = Date.now();
      this._listeners = {};
      this.destination = node({});
    }
    get currentTime() { return (Date.now() - this._t0) / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    addEventListener(type, fn) { (this._listeners[type] || (this._listeners[type] = [])).push(fn); }
    removeEventListener() {}
    createGain() { stats.gain++; return node({ gain: new Param(1) }); }
    createOscillator() {
      stats.osc++;
      return node({
        type: 'sine',
        frequency: new Param(440),
        detune: new Param(0),
        setPeriodicWave() {},
        start(t) {
          assert.ok(!this._started, 'oscillator started twice');
          this._started = t == null ? 0 : t;
          stats.starts++;
        },
        stop(t) { this._stopped = t; }
      });
    }
    createBufferSource() {
      stats.src++;
      return node({
        buffer: null,
        loop: false,
        playbackRate: new Param(1),
        start(t, offset) {
          assert.ok(!this._started, 'buffer source started twice');
          if (offset != null) assert.ok(offset >= 0 && offset < 10, 'bad noise offset ' + offset);
          this._started = t == null ? 0 : t;
          stats.starts++;
        },
        stop() {}
      });
    }
    createBuffer(channels, length, sampleRate) {
      stats.buffer++;
      const data = [];
      for (let i = 0; i < channels; i++) data.push(new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData(i) { return data[i]; }
      };
    }
    createBiquadFilter() {
      stats.filt++;
      return node({ type: 'lowpass', frequency: new Param(350), Q: new Param(1), gain: new Param(0) });
    }
    createDynamicsCompressor() {
      stats.comp++;
      return node({
        threshold: new Param(-24), knee: new Param(30), ratio: new Param(12),
        attack: new Param(0.003), release: new Param(0.25)
      });
    }
    createWaveShaper() { stats.shaper++; return node({ curve: null, oversample: 'none' }); }
    createDelay(max) { stats.delay++; return node({ delayTime: new Param(0), maxDelay: max }); }
    createStereoPanner() { stats.panner++; return node({ pan: new Param(0) }); }
    createPeriodicWave(real, imag) {
      stats.wave++;
      assert.ok(real.length === imag.length, 'PeriodicWave arrays must match');
      return { real, imag };
    }
  };
}

function makeWindow({ withAudioContext = true, webkitOnly = false } = {}) {
  const warnings = [];
  const listeners = { window: {}, document: {} };
  const doc = {
    hidden: false,
    addEventListener(type, fn) { (listeners.document[type] || (listeners.document[type] = [])).push(fn); },
    removeEventListener(type, fn) {
      const arr = listeners.document[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    }
  };
  const win = {
    document: doc,
    console: {
      warn: (...args) => warnings.push(args.join(' ')),
      log: () => {},
      error: (...args) => warnings.push('ERROR ' + args.join(' '))
    },
    addEventListener(type, fn) { (listeners.window[type] || (listeners.window[type] = [])).push(fn); },
    removeEventListener(type, fn) {
      const arr = listeners.window[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    }
  };
  if (withAudioContext && !webkitOnly) {
    const stats = makeStats();
    win.AudioContext = makeAudioContextClass(stats);
    win.__stats = stats;
  } else if (webkitOnly) {
    const stats = makeStats();
    win.webkitAudioContext = makeAudioContextClass(stats);
    win.__stats = stats;
  }
  return { win, doc, warnings, listeners };
}

function loadAudio(win) {
  const liveIntervals = new Set();
  // Эмулируем браузерное поведение: нативный setInterval, вызванный как метод
  // постороннего объекта, бросает "Illegal invocation". Так тест ловит ошибки,
  // которые Node-таймеры прощают.
  function browserBrandCheck(self, name) {
    if (self !== undefined && self !== win && self !== sandbox) {
      throw new TypeError('Illegal invocation: ' + name);
    }
  }
  const sandbox = {
    window: win,
    setTimeout,
    clearTimeout,
    setInterval: function (fn, ms) {
      browserBrandCheck(this, 'setInterval');
      const id = setInterval(fn, ms);
      liveIntervals.add(id);
      return id;
    },
    clearInterval: function (id) {
      browserBrandCheck(this, 'clearInterval');
      liveIntervals.delete(id);
      clearInterval(id);
    }
  };
  const context = vm.createContext(sandbox);
  const before = new Set(Object.keys(win));
  vm.runInContext(SOURCE, context, { filename: 'rubezh/src/audio.js' });
  const api = win.RUBEZH_AUDIO;
  assert.ok(api && typeof api === 'object', 'window.RUBEZH_AUDIO must be defined');
  const added = Object.keys(win).filter((k) => !before.has(k));
  assert.deepEqual(added, ['RUBEZH_AUDIO'], 'engine must add exactly one global, got: ' + added.join(', '));
  return { api, liveIntervals };
}

function fire(listeners, type) {
  for (const fn of listeners.document[type] || []) fn({ type });
}

/* ------------------------------------------------------------------ */
/* Статические проверки файла                                          */
/* ------------------------------------------------------------------ */
function staticChecks() {
  assert.ok(!/<\/script/i.test(SOURCE), 'audio.js must not contain a closing script tag');
  assert.ok(!/https?:\/\//i.test(SOURCE), 'audio.js must not contain URLs');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\./.test(SOURCE), 'audio.js must not use network APIs');
  assert.ok(!/\bimport\b/.test(SOURCE), 'audio.js must not use import');
  assert.ok(!/\bexport\b/.test(SOURCE), 'audio.js must not use export');
  assert.ok(!/new\s+AudioContext\s*\(/.test(SOURCE), 'AudioContext must be constructed lazily, not at top level');
  assert.ok(/new AC\(\)/.test(SOURCE), 'AudioContext construction expected inside buildContext');
}

/* ------------------------------------------------------------------ */
/* Сценарий 1: полный жизненный цикл                                   */
/* ------------------------------------------------------------------ */
async function mainScenario() {
  const { win, doc, warnings, listeners } = makeWindow();
  const { api, liveIntervals } = loadAudio(win);

  assert.equal(warnings.length, 0, 'song compiler warnings:\n' + warnings.join('\n'));

  // --- до unlock ---
  assert.equal(api.isReady(), false, 'isReady must be false before unlock');
  assert.equal(win.__stats.ac, 0, 'AudioContext must not exist before unlock');
  assert.equal(api.getMuted(), false);
  assert.equal(api.getVolume(), 0.8);
  assert.equal(api.unlock, api.unlock); // методы на месте
  ['title', 'stage1', 'stage2', 'boss', 'victory', 'gameover'].forEach((n) => api.startMusic(n));
  api.sfx('shot');
  api.sfx('explode');
  api.startMusic(undefined);
  api.startMusic('nope');
  api.startMusic(42);
  api.stopMusic('bogus');
  api.setVolume('bogus');
  assert.equal(api.isReady(), false);
  assert.equal(win.__stats.ac, 0, 'startMusic/sfx must not build a context before unlock');
  assert.equal(win.__stats.osc, 0, 'sfx before unlock must be silent');
  assert.equal(liveIntervals.size, 0, 'no scheduler before unlock');

  // Запрос музыки до unlock должен запомниться и стартовать сам.
  api.startMusic('stage1');
  assert.equal(liveIntervals.size, 0, 'still no scheduler before unlock');

  // --- unlock: должен запустить отложенный трек ---
  const u1 = api.unlock();
  assert.equal(u1, true, 'unlock must report success');
  assert.equal(api.isReady(), true, 'isReady must be true after unlock');
  assert.equal(win.__stats.ac, 1, 'exactly one AudioContext');
  await sleep(250);
  assert.ok(win.__stats.starts > 0, 'music notes must be scheduled after unlock');
  assert.equal(liveIntervals.size, 1, 'exactly one scheduler interval');

  // --- повторный unlock безопасен ---
  for (let i = 0; i < 4; i++) api.unlock();
  assert.equal(win.__stats.ac, 1, 'repeated unlock reuses the context');

  // --- startMusic того же трека идемпотентен ---
  api.startMusic('gameover');
  const startsBefore = win.__stats.starts;
  const gainBefore = win.__stats.gain;
  api.startMusic('gameover');
  api.startMusic('gameover');
  assert.equal(win.__stats.starts, startsBefore, 'same-track startMusic must not duplicate scheduling');
  assert.equal(win.__stats.gain, gainBefore, 'same-track startMusic must not create a second track');
  assert.equal(liveIntervals.size, 1, 'no double scheduler');

  // --- переключение всех треков ---
  for (const name of ['title', 'stage1', 'stage2', 'boss', 'victory', 'gameover', 'stage1']) {
    api.startMusic(name);
    await sleep(90);
    assert.equal(api.isReady(), true);
    assert.equal(liveIntervals.size, 1, 'one scheduler while switching tracks');
    assert.equal(win.__stats.ac, 1);
  }

  // --- stopMusic: затухание и полная очистка таймеров ---
  api.stopMusic(0.12);
  api.stopMusic(0.12); // идемпотентность
  await sleep(600);
  assert.equal(liveIntervals.size, 0, 'scheduler must stop after stopMusic');
  api.stopMusic(0);
  api.stopMusic();
  assert.equal(liveIntervals.size, 0);

  // --- mute / unmute сохраняет трек ---
  api.startMusic('stage1');
  await sleep(200);
  assert.ok(win.__stats.starts > 0);
  assert.equal(api.setMuted(true), true);
  assert.equal(api.getMuted(), true);
  assert.equal(liveIntervals.size, 0, 'muted engine must not schedule');
  const mutedStarts = win.__stats.starts;
  await sleep(120);
  assert.equal(win.__stats.starts, mutedStarts, 'no notes scheduled while muted');
  assert.equal(api.toggleMuted(), false, 'toggleMuted returns new state');
  assert.equal(api.getMuted(), false);
  await sleep(250);
  assert.ok(win.__stats.starts > mutedStarts, 'unmute resumes the remembered track');
  assert.equal(liveIntervals.size, 1);

  // --- все SFX ---
  const sfxNames = ['shot', 'shot_spread', 'shot_laser', 'shot_machine', 'jump', 'land', 'hit',
    'explode', 'powerup', 'weapon', 'death', 'checkpoint', 'select', 'start', 'boss_hit', 'alarm'];
  for (const name of sfxNames) {
    const before = win.__stats.starts;
    api.sfx(name);
    await sleep(4);
    assert.ok(win.__stats.starts > before, 'sfx "' + name + '" must create audible nodes');
  }
  api.sfx('no-such-sfx');
  api.sfx(null);
  api.sfx(42);
  api.sfx({});

  // --- громкость и клампы ---
  api.setVolume(5);
  assert.equal(api.getVolume(), 1, 'volume clamps high');
  api.setVolume(-3);
  assert.equal(api.getVolume(), 0, 'volume clamps low');
  api.setVolume('abc');
  assert.equal(api.getVolume(), 0, 'non-numeric volume ignored');
  api.setVolume(0.8);
  assert.equal(api.getVolume(), 0.8);

  // --- visibilitychange: скрыть -> планировщик стоит, показать -> играет ---
  api.startMusic('stage1');
  await sleep(150);
  doc.hidden = true;
  fire(listeners, 'visibilitychange');
  assert.equal(liveIntervals.size, 0, 'hidden tab stops scheduling');
  await sleep(80);
  doc.hidden = false;
  fire(listeners, 'visibilitychange');
  await sleep(250);
  assert.equal(api.isReady(), true, 'context resumed on visibility');
  assert.equal(liveIntervals.size, 1, 'scheduler resumed on visibility');
  const resumedStarts = win.__stats.starts;
  await sleep(150);
  assert.ok(win.__stats.starts > resumedStarts, 'music continues after visibility resume');

  // --- финальная уборка ---
  api.startMusic('title');
  await sleep(120);
  api.stopMusic(0.1);
  await sleep(600);
  assert.equal(liveIntervals.size, 0, 'no runaway intervals at the end');
  api.stopMusic();
  api.setMuted(false);
  assert.equal(warnings.length, 0, 'no warnings during the run:\n' + warnings.join('\n'));
}

/* ------------------------------------------------------------------ */
/* Сценарий 2: AudioContext вообще нет                                 */
/* ------------------------------------------------------------------ */
async function missingContextScenario() {
  const { win, warnings } = makeWindow({ withAudioContext: false });
  const { api, liveIntervals } = loadAudio(win);
  assert.equal(warnings.length, 0, 'song compiler warnings: ' + warnings.join('\n'));
  assert.equal(typeof api.unlock, 'function');
  assert.equal(api.unlock(), false, 'unlock returns false without WebAudio');
  assert.equal(api.isReady(), false);
  api.startMusic('stage1');
  api.sfx('explode');
  api.stopMusic();
  api.setMuted(true);
  assert.equal(api.getMuted(), true);
  api.setMuted(false);
  api.setVolume(0.5);
  assert.equal(api.getVolume(), 0.5);
  assert.equal(api.toggleMuted(), true);
  api.startMusic('boss');
  api.stopMusic(0);
  await sleep(100);
  assert.equal(liveIntervals.size, 0, 'no timers without AudioContext');
}

/* ------------------------------------------------------------------ */
/* Сценарий 3: только webkitAudioContext (Safari)                      */
/* ------------------------------------------------------------------ */
async function webkitScenario() {
  const { win, warnings } = makeWindow({ webkitOnly: true });
  const { api, liveIntervals } = loadAudio(win);
  assert.equal(warnings.length, 0, 'song compiler warnings: ' + warnings.join('\n'));
  assert.equal(api.unlock(), true, 'webkitAudioContext fallback works');
  assert.equal(api.isReady(), true);
  api.startMusic('boss');
  await sleep(200);
  assert.ok(win.__stats.starts > 0, 'music plays through webkitAudioContext');
  api.stopMusic(0.1);
  await sleep(500);
  assert.equal(liveIntervals.size, 0);
}

/* ------------------------------------------------------------------ */
try {
  staticChecks();
  await mainScenario();
  await missingContextScenario();
  await webkitScenario();
  console.log('OK audio smoke');
  process.exit(0);
} catch (err) {
  console.error('FAIL audio smoke:', err && err.stack ? err.stack : err);
  process.exit(1);
}
